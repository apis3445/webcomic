import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: claimsData, error } = await supabase.auth.getClaims();

	if (error || !claimsData?.claims) {
		redirect(303, '/');
	}

	const { claims } = claimsData;

	const { data: profile } = await supabase
		.from('profiles')
		.select(`username, full_name, website, avatar_url`)
		.eq('id', claims.sub)
		.single();

	return { claims, profile };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const fullName = formData.get('fullName') as string;
		const username = formData.get('username') as string;
		const website = formData.get('website') as string;
		const avatarUrl = formData.get('avatarUrl') as string;

		const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

		if (claimsError || !claimsData?.claims) {
			return fail(401, { fullName, username, website, avatarUrl });
		}

		const { error } = await supabase.from('profiles').upsert({
			id: claimsData.claims.sub,
			full_name: fullName,
			username,
			website,
			avatar_url: avatarUrl,
			updated_at: new Date()
		});

		if (error) {
			return fail(500, {
				fullName,
				username,
				website,
				avatarUrl
			});
		}

		return {
			fullName,
			username,
			website,
			avatarUrl
		};
	},
	setPassword: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const password = formData.get('password') as string;
		const confirm = formData.get('confirm') as string;

		if (password !== confirm) {
			return fail(400, {
				action: 'setPassword',
				success: false,
				message: 'Passwords do not match.'
			});
		}

		if (password.length < 6) {
			return fail(400, {
				action: 'setPassword',
				success: false,
				message: 'Password must be at least 6 characters.'
			});
		}

		const { error } = await supabase.auth.updateUser({ password });

		if (error) {
			return fail(400, { action: 'setPassword', success: false, message: error.message });
		}

		return { action: 'setPassword', success: true, message: 'Password updated successfully.' };
	},

	signout: async ({ locals: { supabase } }) => {
		await supabase.auth.signOut();
		redirect(303, '/');
	}
};
