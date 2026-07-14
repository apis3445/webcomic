import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';

function maskEmail(email: string | null | undefined): string {
	if (!email || typeof email !== 'string') return '<none>';
	const at = email.indexOf('@');
	if (at < 1) return '<invalid>';
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const localMasked =
		local.length <= 2 ? `${local[0]}*` : `${local[0]}***${local[local.length - 1]}`;
	return `${localMasked}@${domain}`;
}

function newCorrelationId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data, error } = await supabase.auth.getClaims();

	if (!error && data?.claims) {
		redirect(303, '/comic');
	}

	return {};
};

export const actions: Actions = {
	magicLink: async (event) => {
		const {
			request,
			url,
			locals: { supabase }
		} = event;
		const reqId = newCorrelationId();

		const formData = await request.formData();
		const email = (formData.get('email') ?? '').toString().trim();

		const validEmail =
			/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
				email
			);
		if (!validEmail) {
			console.warn('[magicLink]', reqId, 'invalid_email');
			return fail(400, {
				tab: 'magic',
				errors: { email: 'Please enter a valid email address' },
				email
			});
		}

		try {
			const emailRedirectTo = `${url.origin}/auth/confirm`;
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo }
			});

			if (error) {
				console.error('[magicLink]', reqId, 'otp_error', {
					status: error.status,
					code: (error as { code?: string }).code,
					name: error.name,
					...(dev ? { email: maskEmail(email), message: error.message } : {})
				});
				return fail(400, {
					tab: 'magic',
					success: false,
					email,
					message: 'Unable to send magic link. Please try again.',
					reqId
				});
			}
		} catch (err) {
			console.error('[magicLink]', reqId, 'unexpected_error', {
				name: (err as Error)?.name,
				...(dev ? { email: maskEmail(email), message: (err as Error)?.message } : {})
			});
			return fail(500, {
				tab: 'magic',
				success: false,
				email,
				message: 'Something went wrong sending the magic link. Please try again later.',
				reqId
			});
		}

		return {
			tab: 'magic',
			success: true,
			message: 'Please check your email for a magic link to log into the website.'
		};
	},

	password: async (event) => {
		const {
			request,
			locals: { supabase }
		} = event;
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, {
				tab: 'password',
				success: false,
				message: 'Email and password are required.'
			});
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			return fail(400, { tab: 'password', success: false, message: 'Invalid email or password.' });
		}

		redirect(303, '/comic');
	},

	signUp: async (event) => {
		const {
			request,
			locals: { supabase }
		} = event;
		const reqId = newCorrelationId();
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirm = formData.get('confirm') as string;

		if (password !== confirm) {
			return fail(400, { tab: 'register', success: false, message: 'Passwords do not match.' });
		}

		if (password.length < 6) {
			return fail(400, {
				tab: 'register',
				success: false,
				message: 'Password must be at least 6 characters.'
			});
		}

		const { error } = await supabase.auth.signUp({ email, password });

		if (error) {
			console.error('[signUp]', reqId, 'signup_error', {
				status: error.status,
				code: (error as { code?: string }).code,
				name: error.name,
				...(dev ? { email: maskEmail(email), message: error.message } : {})
			});
			return fail(400, {
				tab: 'register',
				success: false,
				message: 'Unable to create account. Please try again.',
				reqId
			});
		}

		return {
			tab: 'register',
			success: true,
			message: 'Account created! Check your email to verify your address.'
		};
	}
};
