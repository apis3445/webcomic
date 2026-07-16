import { dev } from '$app/environment';
import { resolveSheetNumber } from '$lib/sheets';
import type { RequestHandler } from './$types';

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Log a structured delete error (safe in prod) and return a generic 500 to the
// client. Detailed Supabase fields are only logged in dev to avoid leaking
// schema/Postgres constraint names through centralized log aggregators.
function deleteErrorResponse(reqId: string, stage: string, error: unknown, status = 500): Response {
	const err = (error ?? {}) as { message?: string; code?: string; name?: string; status?: number };
	console.error('[delete_panel_image]', reqId, stage, {
		status: err.status,
		code: err.code,
		name: err.name,
		...(dev ? { message: err.message } : {})
	});
	return new Response(
		JSON.stringify({ error: 'Could not remove the image. Please try again.', reqId }),
		{ status }
	);
}

// Supabase's storage.remove() caps the array it accepts per call, so paths are
// deleted in chunks of this size (same constant as the comic delete endpoint).
// Any per-chunk failure is logged and skipped — cleanup stays best-effort.
const STORAGE_REMOVE_BATCH = 1000;

// Removes the background image of one panel: deletes the images row(s) and
// their storage objects (private original + published copy). The panel row
// itself is kept — bubbles attach to it.
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	const reqId = newReqId();
	const comicId = params.id;
	if (!comicId)
		return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });

	const payload: { sheetNumber?: unknown; panelIndex?: unknown } | null = await request
		.json()
		.catch(() => null);
	const sheetNumber = resolveSheetNumber(payload?.sheetNumber);
	if (sheetNumber === null)
		return new Response(JSON.stringify({ error: 'Invalid sheetNumber' }), { status: 400 });
	const panelIndex = payload?.panelIndex;
	if (typeof panelIndex !== 'number' || !Number.isInteger(panelIndex) || panelIndex < 1)
		return new Response(JSON.stringify({ error: 'Invalid panelIndex' }), { status: 400 });

	// Ensure user is owner (verified JWT claims; sub is the user id).
	const { data: claimsData, error: claimsErr } = await locals.supabase.auth.getClaims();
	const userId = claimsData?.claims?.sub;
	if (claimsErr || !userId)
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });

	const { data: comicRow, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id')
		.eq('id', comicId)
		.maybeSingle();
	if (comicErr || !comicRow)
		return new Response(JSON.stringify({ error: 'Comic not found' }), { status: 404 });
	if ((comicRow as { owner_id: string }).owner_id !== userId)
		return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

	// A missing sheet/panel/image row means there is nothing to delete — report
	// success so the client can clear its local state (idempotent delete).
	const { data: sheetRow, error: sheetErr } = await locals.supabase
		.from('sheets')
		.select('id')
		.eq('comic_id', comicId)
		.eq('number', sheetNumber)
		.maybeSingle();
	if (sheetErr) return deleteErrorResponse(reqId, 'sheet_select', sheetErr);
	if (!sheetRow) return new Response(JSON.stringify({ success: true }), { status: 200 });

	// All panels at this (sheet, index) — tolerates legacy duplicate panel rows
	// created by older upload runs, same as upload-image/publish.
	const { data: panelsRaw, error: panelsErr } = await locals.supabase
		.from('panels')
		.select('id')
		.eq('sheet_id', (sheetRow as { id: string }).id)
		.eq('index', panelIndex);
	if (panelsErr) return deleteErrorResponse(reqId, 'panels_select', panelsErr);
	const panelIds = ((panelsRaw ?? []) as Array<{ id: string }>).map((p) => p.id);
	if (panelIds.length === 0)
		return new Response(JSON.stringify({ success: true }), { status: 200 });

	// Snapshot storage paths before deleting the rows — they can't be rebuilt
	// afterwards. Files are removed only after the row delete succeeds, so a
	// failed delete never leaves rows pointing at already-deleted files.
	const { data: imagesRaw, error: imagesErr } = await locals.supabase
		.from('images')
		.select('id, storage_path, bucket, filename, public_url')
		.in('panel_id', panelIds);
	if (imagesErr) return deleteErrorResponse(reqId, 'images_select', imagesErr);
	const images = (imagesRaw ?? []) as Array<{
		id: string;
		storage_path: string | null;
		bucket: string | null;
		filename: string | null;
		public_url: string | null;
	}>;
	if (images.length === 0) return new Response(JSON.stringify({ success: true }), { status: 200 });

	const { error: delErr } = await locals.supabase
		.from('images')
		.delete()
		.in(
			'id',
			images.map((i) => i.id)
		);
	if (delErr) return deleteErrorResponse(reqId, 'images_delete', delErr);

	// Best-effort storage cleanup, now that the rows are gone. A failure here
	// only orphans files in the bucket (logged); it never fails the request.
	const pathsByBucket = new Map<string, string[]>();
	for (const img of images) {
		if (img.storage_path) {
			const bucket = img.bucket || 'comics';
			pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), img.storage_path]);
		}
		// The published copy lives at `${comicId}/${filename}` in public-comics
		// (see publish/+server.ts) and is only present once public_url was set.
		if (img.public_url && img.filename) {
			pathsByBucket.set('public-comics', [
				...(pathsByBucket.get('public-comics') ?? []),
				`${comicId}/${img.filename}`
			]);
		}
	}
	for (const [bucket, paths] of pathsByBucket) {
		for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
			const chunk = paths.slice(i, i + STORAGE_REMOVE_BATCH);
			const { error: rmErr } = await locals.supabase.storage.from(bucket).remove(chunk);
			if (rmErr) {
				console.error('[delete_panel_image]', reqId, 'storage_remove', {
					bucket,
					batch_offset: i,
					batch_size: chunk.length,
					...(dev ? { message: (rmErr as { message?: string }).message } : {})
				});
			}
		}
	}

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
