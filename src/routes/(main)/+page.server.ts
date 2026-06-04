import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data, error } = await supabase.auth.getClaims();

	if (!error && data?.claims) {
		redirect(303, '/comic');
	}

	return {};
};
