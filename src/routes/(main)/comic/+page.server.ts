import type { PageServerLoad } from './$types';
import type { Bubble, BubbleType } from '$lib/comicState.svelte';

interface ComicRow {
	id: string;
	owner_id: string;
	name: string | null;
	description: string | null;
	thumbnail_path: string | null;
}

interface SheetRow {
	id: string;
	number: number;
	template_id: string | null;
}

interface PanelRow {
	id: string;
	sheet_id: string;
	index: number;
	x: number | null;
	y: number | null;
	w: number | null;
	h: number | null;
}

interface BubbleRow {
	id: string;
	panel_id: string;
	text: string | null;
	x: number | null;
	y: number | null;
	w: number | null;
	h: number | null;
	z_index: number | null;
	style: string | null;
}

interface ImageRow {
	id: string;
	panel_id: string;
	storage_path: string | null;
	bucket: string | null;
	public_url: string | null;
}

export interface LoadedPanel {
	index: number;
	imageUrl: string | null;
	bubbles: Bubble[];
}

export interface LoadedSheet {
	number: number;
	templateSlug: string | null;
	panels: LoadedPanel[];
}

export interface LoadedComic {
	id: string;
	name: string | null;
	thumbnailUrl: string | null;
	// Pages in ascending sheets.number order; always at least one entry so the
	// editor has a page to load.
	sheets: LoadedSheet[];
}

const KNOWN_BUBBLE_TYPES: ReadonlySet<BubbleType> = new Set<BubbleType>([
	'left-cloud',
	'right-cloud',
	'left-oval',
	'right-oval',
	'box-izq',
	'box-der',
	'box',
	'burst'
]);

function toBubbleType(style: string | null): BubbleType {
	return style && KNOWN_BUBBLE_TYPES.has(style as BubbleType) ? (style as BubbleType) : 'box';
}

export const load: PageServerLoad = async ({ url, locals, depends }) => {
	// This load's result is derived from the signed-in user (owner check
	// below), so re-run it when the session changes — the root layout
	// invalidates 'supabase:auth' on every auth state change.
	depends('supabase:auth');

	const id = url.searchParams.get('id');
	if (!id) return { comic: null };

	// Verified JWT claims; sub is the user id (drives the owner check below).
	const { data: claimsData } = await locals.supabase.auth.getClaims();
	const userId = claimsData?.claims?.sub;
	if (!userId) return { comic: null };

	const { data: comicRaw, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id, name, description, thumbnail_path')
		.eq('id', id)
		.maybeSingle();
	if (comicErr || !comicRaw) return { comic: null };
	const comic = comicRaw as ComicRow;
	if (comic.owner_id !== userId) return { comic: null };

	const { data: sheetsRaw } = await locals.supabase
		.from('sheets')
		.select('id, number, template_id')
		.eq('comic_id', id)
		.order('number', { ascending: true });
	const sheets = (sheetsRaw ?? []) as SheetRow[];

	// Resolve template slugs via explicit lookup (one query for all sheets).
	// Avoids relying on a PostgREST embedded join, which silently returns null
	// when the FK constraint between sheets.template_id and sheet_templates.id
	// is missing.
	const templateIds = [...new Set(sheets.map((s) => s.template_id).filter(Boolean))] as string[];
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

	const sheetIds = sheets.map((s) => s.id);

	const { data: panelsRaw } = sheetIds.length
		? await locals.supabase
				.from('panels')
				.select('id, sheet_id, index, x, y, w, h')
				.in('sheet_id', sheetIds)
				.order('index', { ascending: true })
		: { data: [] };
	const panels = (panelsRaw ?? []) as PanelRow[];

	const panelIds = panels.map((p) => p.id);

	const { data: bubblesRaw } = panelIds.length
		? await locals.supabase
				.from('bubbles')
				.select('id, panel_id, text, x, y, w, h, z_index, style')
				.in('panel_id', panelIds)
				.order('created_at', { ascending: true })
		: { data: [] };
	const bubbles = (bubblesRaw ?? []) as BubbleRow[];

	const { data: imagesRaw } = await locals.supabase
		.from('images')
		.select('id, panel_id, storage_path, bucket, public_url')
		.eq('comic_id', id);
	const images = (imagesRaw ?? []) as ImageRow[];

	const imageUrlByPanel = new Map<string, string | null>();
	for (const img of images) {
		let url: string | null = img.public_url ?? null;
		if (!url && img.storage_path) {
			const { data } = await locals.supabase.storage
				.from(img.bucket || 'comics')
				.createSignedUrl(img.storage_path, 60 * 60 * 24);
			url = data?.signedUrl ?? null;
		}
		imageUrlByPanel.set(img.panel_id, url);
	}

	const bubblesByPanel = new Map<string, BubbleRow[]>();
	for (const b of bubbles) {
		const list = bubblesByPanel.get(b.panel_id) ?? [];
		list.push(b);
		bubblesByPanel.set(b.panel_id, list);
	}

	const toLoadedPanel = (p: PanelRow, i: number): LoadedPanel => ({
		index: typeof p.index === 'number' ? p.index : i + 1,
		imageUrl: imageUrlByPanel.get(p.id) ?? null,
		bubbles: (bubblesByPanel.get(p.id) ?? []).map(
			(b, bi): Bubble => ({
				id: bi + 1,
				text: b.text ?? '',
				x: b.x ?? 0,
				y: b.y ?? 0,
				width: b.w ?? 140,
				height: b.h ?? 50,
				type: toBubbleType(b.style),
				// Fallback to insertion order so legacy bubbles (all z_index=0) get
				// a deterministic, stable order on first reload instead of "whatever
				// the DB returned this time".
				z_index: typeof b.z_index === 'number' ? b.z_index : bi
			})
		)
	});

	const loadedSheets: LoadedSheet[] = sheets.map((s) => ({
		number: s.number,
		templateSlug: s.template_id ? (slugByTemplateId.get(s.template_id) ?? null) : null,
		panels: panels.filter((p) => p.sheet_id === s.id).map(toLoadedPanel)
	}));
	if (loadedSheets.length === 0) {
		loadedSheets.push({ number: 1, templateSlug: null, panels: [] });
	}

	let thumbnailUrl: string | null = null;
	if (comic.thumbnail_path) {
		const { data } = await locals.supabase.storage
			.from('comics')
			.createSignedUrl(comic.thumbnail_path, 60 * 60 * 24);
		thumbnailUrl = data?.signedUrl ?? null;
	}

	const loaded: LoadedComic = {
		id: comic.id,
		name: comic.name,
		thumbnailUrl,
		sheets: loadedSheets
	};

	return { comic: loaded };
};
