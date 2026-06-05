import type { PageServerLoad } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const load: PageServerLoad = async ({ locals }) => {
	const { data: comics, error } = await locals.supabase
		.from('comics')
		.select('id, name, description, thumbnail_path, updated_at')
		.eq('is_public', true)
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Failed fetching public comics', error);
		return { comics: [] };
	}

	const comicIds = (comics || []).map((c: any) => c.id);

	// Fetch images that have a public_url for these comics — used as fallback thumbnails
	const { data: images } = comicIds.length
		? await locals.supabase
				.from('images')
				.select('comic_id, public_url, created_at')
				.in('comic_id', comicIds)
				.not('public_url', 'is', null)
				.order('created_at', { ascending: true })
		: { data: [] as any[] };

	const firstImageByComic = new Map<string, string>();
	for (const img of (images || []) as any[]) {
		if (!firstImageByComic.has(img.comic_id) && img.public_url) {
			firstImageByComic.set(img.comic_id, img.public_url);
		}
	}

	// Resolve thumbnails: prefer the comic's uploaded thumbnail (signed url from private bucket),
	// otherwise fall back to the first image's public_url.
	const comicsWithThumbs = await Promise.all(
		(comics || []).map(async (c: any) => {
			let thumbnail_url: string | null = null;
			if (c.thumbnail_path) {
				const { data } = await locals.supabase.storage
					.from('comics')
					.createSignedUrl(c.thumbnail_path, 60 * 60);
				thumbnail_url = data?.signedUrl ?? null;
			}
			if (!thumbnail_url) {
				thumbnail_url = firstImageByComic.get(c.id) ?? null;
			}
			return {
				id: c.id,
				name: c.name,
				description: c.description,
				thumbnail_url
			};
		})
	);

	return { comics: comicsWithThumbs };
};
