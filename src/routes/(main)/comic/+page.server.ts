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

export interface LoadedComic {
	id: string;
	name: string | null;
	templateSlug: string | null;
	panels: LoadedPanel[];
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

export const load: PageServerLoad = async ({ url, locals }) => {
	const id = url.searchParams.get('id');
	if (!id) return { comic: null };

	const { data: userData } = await locals.supabase.auth.getUser();
	const userId = userData?.user?.id;
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

	// Resolve template slug via explicit lookup. Avoids relying on a PostgREST
	// embedded join, which silently returns null when the FK constraint between
	// sheets.template_id and sheet_templates.id is missing.
	let templateSlug: string | null = null;
	const firstTemplateId = sheets.find((s) => s.template_id)?.template_id;
	if (firstTemplateId) {
		const { data: tmpl } = await locals.supabase
			.from('sheet_templates')
			.select('slug')
			.eq('id', firstTemplateId)
			.maybeSingle();
		templateSlug = (tmpl as { slug: string | null } | null)?.slug ?? null;
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
		if (imageUrlByPanel.has(img.panel_id)) continue;
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

	const panelData: LoadedPanel[] = panels.map((p, i) => ({
		index: typeof p.index === 'number' ? p.index : i + 1,
		imageUrl: imageUrlByPanel.get(p.id) ?? null,
		bubbles: (bubblesByPanel.get(p.id) ?? []).map((b, bi): Bubble => ({
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
		}))
	}));

	const loaded: LoadedComic = {
		id: comic.id,
		name: comic.name,
		templateSlug,
		panels: panelData
	};

	return { comic: loaded };
};
