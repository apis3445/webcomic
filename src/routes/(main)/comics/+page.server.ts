import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: claimsData, error: claimsError } = await locals.supabase.auth.getClaims();
	if (claimsError || !claimsData?.claims) {
		return { comics: [] };
	}
	const userId = claimsData.claims.sub;

	const { data: comics, error } = await locals.supabase
		.from('comics')
		.select('id, name, is_public, updated_at, thumbnail_path')
		.eq('owner_id', userId)
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Failed fetching user comics', error);
		return { comics: [] };
	}

	const comicsWithThumbs = await Promise.all(
		(comics || []).map(async (c) => {
			if (!c.thumbnail_path) return { ...c, thumbnail_url: null };
			const { data } = await locals.supabase.storage
				.from('comics')
				.createSignedUrl(c.thumbnail_path, 60 * 60 * 24);
			return { ...c, thumbnail_url: data?.signedUrl ?? null };
		})
	);

	return { comics: comicsWithThumbs };
};
