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

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const next = sanitizeNext(url.searchParams.get('next'));

	const redirectTo = new URL(url);
	redirectTo.pathname = next;
	redirectTo.searchParams.delete('code');
	redirectTo.searchParams.delete('token_hash');
	redirectTo.searchParams.delete('type');
	redirectTo.searchParams.delete('next');

	// PKCE flow (default for @supabase/ssr) — magic link sends a `code`
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, redirectTo);
	}

	// OTP / token-hash flow (older or email OTP without PKCE)
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		if (!error) redirect(303, redirectTo);
	}

	redirectTo.pathname = '/auth/error';
	redirect(303, redirectTo);
};
