import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Defence in depth: only accept `next` values that are clearly a same-site
// relative path. Even though URL.pathname encoding mostly prevents
// cross-origin redirects, an attacker-controlled `next` could still
// CRLF-inject, traverse to unintended paths, or be flipped to a
// protocol-relative URL via `//evil.com`. Reject anything other than a
// single-leading-slash path made of safe characters.
function sanitizeNext(raw: string | null): string {
	if (!raw) return '/comic';
	if (!raw.startsWith('/')) return '/comic';
	if (raw.startsWith('//')) return '/comic'; // protocol-relative
	if (raw.includes('\\') || raw.includes('\n') || raw.includes('\r')) return '/comic';
	if (raw.includes('://')) return '/comic';
	return raw;
}

function newCorrelationId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Translate a raw Supabase auth error into a short, user-safe message. The
// underlying SDK message (e.g. "PKCE code verifier not found in storage…")
// must stay in server logs only — never echoed to the user.
function friendlyAuthMessage(error: { message?: string; code?: string }): string {
	const msg = (error.message ?? '').toLowerCase();
	if (msg.includes('code verifier') || msg.includes('pkce')) {
		return 'This magic link must be opened in the same browser where you requested it. Please request a new link from this device.';
	}
	if (msg.includes('expired') || error.code === 'otp_expired') {
		return 'This link has expired. Please request a new one.';
	}
	return 'Something went wrong during sign in. Please try again.';
}

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const reqId = newCorrelationId();
	const code = url.searchParams.get('code');
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const next = sanitizeNext(url.searchParams.get('next'));
	const inboundError = url.searchParams.get('error');
	const inboundErrorDescription = url.searchParams.get('error_description');

	const redirectTo = new URL(url);
	redirectTo.pathname = next;
	redirectTo.searchParams.delete('code');
	redirectTo.searchParams.delete('token_hash');
	redirectTo.searchParams.delete('type');
	redirectTo.searchParams.delete('next');
	redirectTo.searchParams.delete('error');
	redirectTo.searchParams.delete('error_description');

	// Supabase bounced back without verifying (redirect URL not allow-listed,
	// expired link, already used, etc.). The raw description goes to logs only;
	// the user sees a curated message.
	if (inboundError) {
		console.warn('[auth/confirm]', reqId, 'inbound_error', {
			error: inboundError,
			description: inboundErrorDescription
		});
		redirectTo.pathname = '/auth/error';
		redirectTo.searchParams.set(
			'error_description',
			friendlyAuthMessage({ message: inboundErrorDescription ?? '', code: inboundError })
		);
		redirect(303, redirectTo);
	}

	// PKCE flow (default for @supabase/ssr) — magic link sends a `code`
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			redirect(303, redirectTo);
		}
		console.error('[auth/confirm]', reqId, 'exchange_error', {
			status: error.status,
			code: (error as { code?: string }).code,
			name: error.name,
			message: error.message
		});
		redirectTo.pathname = '/auth/error';
		redirectTo.searchParams.set('error_description', friendlyAuthMessage(error));
		redirect(303, redirectTo);
	}

	// OTP / token-hash flow (older or email OTP without PKCE)
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		if (!error) {
			redirect(303, redirectTo);
		}
		console.error('[auth/confirm]', reqId, 'verify_error', {
			status: error.status,
			code: (error as { code?: string }).code,
			name: error.name,
			message: error.message
		});
		redirectTo.pathname = '/auth/error';
		redirectTo.searchParams.set('error_description', friendlyAuthMessage(error));
		redirect(303, redirectTo);
	}

	console.warn('[auth/confirm]', reqId, 'no_token');
	redirectTo.pathname = '/auth/error';
	redirectTo.searchParams.set('error_description', 'Missing or invalid magic link token.');
	redirect(303, redirectTo);
};
