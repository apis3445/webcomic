import type { PageServerLoad } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = params.id;
	if (!id) return { status: 400, error: 'comic id required' };

	// Fetch comic and ensure it's public
	const { data: comic, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id, name, description, is_public')
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

	// Resolve the template slug explicitly so the page can render the right layout.
	// Embedded join via sheet_templates(slug) silently returns null without a FK.
	let templateSlug: string | null = null;
	const firstTemplateId = (sheets || []).find((s: any) => s.template_id)?.template_id;
	if (firstTemplateId) {
		const { data: tmpl } = await locals.supabase
			.from('sheet_templates')
			.select('slug')
			.eq('id', firstTemplateId)
			.maybeSingle();
		templateSlug = (tmpl as { slug: string | null } | null)?.slug ?? null;
	}

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

	return {
		comic,
		sheets: sheets || [],
		templateSlug,
		panels: orderedPanels
	};
};
