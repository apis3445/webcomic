import type { PageServerLoad } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = params.id;
	if (!id) return { status: 400, error: 'comic id required' };

	// Fetch comic and ensure it's public
	const { data: comic, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id, name, description, is_public, thumbnail_path')
		.eq('id', id)
		.maybeSingle();

	if (comicErr || !comic) {
		return { status: 404 };
	}

	if (!comic.is_public) {
		return { status: 403 };
	}

	// Fetch sheets (with template) for this comic
	const { data: sheets, error: sheetsErr } = await locals.supabase
		.from('sheets')
		.select('id, number, template_id')
		.eq('comic_id', id)
		.order('number', { ascending: true });

	if (sheetsErr) {
		console.error('Failed to load sheets', sheetsErr);
		return { status: 500 };
	}

	// Resolve template slugs explicitly (one query for every sheet's template)
	// so each page can render its own layout. Embedded join via
	// sheet_templates(slug) silently returns null without a FK.
	const templateIds = [
		...new Set((sheets || []).map((s: any) => s.template_id).filter(Boolean))
	] as string[];
	const slugByTemplateId = new Map<string, string | null>();
	if (templateIds.length) {
		const { data: tmpls } = await locals.supabase
			.from('sheet_templates')
			.select('id, slug')
			.in('id', templateIds);
		for (const t of (tmpls ?? []) as Array<{ id: string; slug: string | null }>) {
			slugByTemplateId.set(t.id, t.slug);
		}
	}

	// Sheets with their slug attached, in page order.
	const sheetsWithSlug = (sheets || []).map((s: any) => ({
		...s,
		templateSlug: s.template_id ? (slugByTemplateId.get(s.template_id) ?? null) : null
	}));

	const sheetIds = (sheets || []).map((s: any) => s.id);

	// Fetch panels for these sheets
	const { data: panels, error: panelsErr } = await locals.supabase
		.from('panels')
		.select('id, sheet_id, index, x, y, w, h')
		.in('sheet_id', sheetIds)
		.order('index', { ascending: true });

	if (panelsErr) {
		console.error('Failed to load panels', panelsErr);
		return { status: 500 };
	}

	const panelIds = (panels || []).map((p: any) => p.id);

	// Fetch bubbles for these panels. Order by z_index so the public viewer
	// renders the same stacking the user set in the editor; created_at is the
	// stable tiebreak when two bubbles share a z (e.g. legacy rows pre-z_index).
	const { data: bubbles, error: bubblesErr } = await locals.supabase
		.from('bubbles')
		.select('id, panel_id, text, x, y, w, h, z_index, style, author_id, created_at')
		.in('panel_id', panelIds)
		.order('z_index', { ascending: true })
		.order('created_at', { ascending: true });

	if (bubblesErr) {
		console.error('Failed to load bubbles', bubblesErr);
		return { status: 500 };
	}

	// Fetch images
	const { data: imgs, error: imgsErr } = await locals.supabase
		.from('images')
		.select('id, panel_id, public_url, filename, width, height')
		.eq('comic_id', id)
		.order('created_at', { ascending: true });

	if (imgsErr) {
		console.error('Failed to load images for public comic', imgsErr);
		return { status: 500 };
	}

	// Assemble panels grouped by sheet and in order
	const panelsById = new Map(
		(panels || []).map((p: any) => [p.id, { ...p, bubbles: [] as any[], image: null }])
	);
	for (const b of bubbles || []) {
		const entry = panelsById.get(b.panel_id);
		if (entry) entry.bubbles.push(b);
	}
	for (const im of imgs || []) {
		const entry = panelsById.get(im.panel_id);
		if (entry) entry.image = im;
	}

	// Flatten into ordered array by sheet number then panel index
	const orderedPanels: any[] = [];
	const sheetsById = new Map((sheets || []).map((s: any) => [s.id, s]));
	const panelsSorted = (panels || []).slice().sort((a: any, b: any) => {
		const aSheet = sheetsById.get(a.sheet_id)?.number ?? 0;
		const bSheet = sheetsById.get(b.sheet_id)?.number ?? 0;
		if (aSheet !== bSheet) return aSheet - bSheet;
		return (a.index ?? 0) - (b.index ?? 0);
	});
	for (const p of panelsSorted) {
		const entry = panelsById.get(p.id);
		orderedPanels.push({ panel: p, bubbles: entry?.bubbles || [], image: entry?.image || null });
	}

	// Cover for the magazine view: prefer the uploaded cover (signed URL from
	// the private bucket — same pattern as the browse gallery), falling back
	// to the first published panel image.
	let coverUrl: string | null = null;
	if ((comic as any).thumbnail_path) {
		const { data: thumb } = await locals.supabase.storage
			.from('comics')
			.createSignedUrl((comic as any).thumbnail_path, 60 * 60 * 24);
		coverUrl = thumb?.signedUrl ?? null;
	}
	if (!coverUrl) {
		coverUrl = (imgs || []).find((im: any) => im.public_url)?.public_url ?? null;
	}

	return {
		comic,
		sheets: sheetsWithSlug,
		panels: orderedPanels,
		coverUrl
	};
};
