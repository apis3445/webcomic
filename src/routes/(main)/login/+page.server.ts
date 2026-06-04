import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const validEmail = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,8}$/.test(email);

		if (!validEmail) {
			return fail(400, {
				tab: 'magic',
				errors: { email: 'Please enter a valid email address' },
				email
			});
		}

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: `${url.origin}/auth/confirm` }
		});

		if (error) {
			console.error('Supabase signInWithOtp error:', error);
			return fail(400, {
				tab: 'magic',
				success: false,
				email,
				message: 'There was an issue. Please contact support.'
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
			return fail(400, { tab: 'register', success: false, message: error.message });
		}

		return {
			tab: 'register',
			success: true,
			message: 'Account created! Check your email to verify your address.'
		};
	}
};
