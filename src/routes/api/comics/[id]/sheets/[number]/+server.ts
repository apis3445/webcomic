import { dev } from '$app/environment';
import { MAX_SHEETS } from '$lib/sheets';
import type { RequestHandler } from './$types';

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Log a structured delete error (safe in prod) and return a generic 500 to the
// client. Detailed Supabase fields are only logged in dev to avoid leaking
// schema/Postgres constraint names through centralized log aggregators.
function deleteErrorResponse(reqId: string, stage: string, error: unknown, status = 500): Response {
	const err = (error ?? {}) as { message?: string; code?: string; name?: string; status?: number };
	console.error('[delete_sheet]', reqId, stage, {
		status: err.status,
		code: err.code,
		name: err.name,
		...(dev ? { message: err.message } : {})
	});
	return new Response(
		JSON.stringify({ error: 'Could not delete the page. Please try again.', reqId }),
		{ status }
	);
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const reqId = newReqId();
	const comicId = params.id;
	if (!comicId)
		return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });
	const number = Number(params.number);
	if (!Number.isInteger(number) || number < 1 || number > MAX_SHEETS)
		return new Response(JSON.stringify({ error: 'Invalid sheet number' }), { status: 400 });

	// Ensure user is owner. Authorization is based on the request's verified
	// JWT claims (getClaims validates the token; sub is the user id) rather
	// than a getUser() lookup.
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

	const { data: sheetsRaw, error: sheetsErr } = await locals.supabase
		.from('sheets')
		.select('id, number')
		.eq('comic_id', comicId)
		.order('number', { ascending: true });
	if (sheetsErr) return deleteErrorResponse(reqId, 'sheets_select', sheetsErr);
	const sheets = (sheetsRaw ?? []) as Array<{ id: string; number: number }>;
	const target = sheets.find((s) => s.number === number);
	if (!target) return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404 });
	if (sheets.length <= 1)
		return new Response(JSON.stringify({ error: 'A comic must keep at least one page.' }), {
			status: 400
		});

	// Snapshot the storage paths this sheet's images rows point at. Must be
	// read before the row delete, whose FK cascade removes the images rows —
	// and the paths can't be rebuilt from the sheet number: after a renumber
	// (below) a page's files stay under its original number prefix, so a
	// prefix purge could hit another live page's uploads. The files themselves
	// are only removed after the DB delete succeeds, so a failed delete never
	// leaves rows pointing at already-deleted files.
	const { data: imagesRaw, error: imagesErr } = await locals.supabase
		.from('images')
		.select('storage_path, bucket')
		.eq('sheet_id', target.id);
	const pathsByBucket = new Map<string, string[]>();
	if (imagesErr) {
		console.error('[delete_sheet]', reqId, 'images_select', {
			...(dev ? { message: (imagesErr as { message?: string }).message } : {})
		});
	} else {
		for (const img of (imagesRaw ?? []) as Array<{
			storage_path: string | null;
			bucket: string | null;
		}>) {
			if (!img.storage_path) continue;
			const bucket = img.bucket || 'comics';
			pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), img.storage_path]);
		}
	}

	// Delete the sheet row; FK ON DELETE CASCADE removes its panels, bubbles
	// and images rows.
	const { error: delErr } = await locals.supabase.from('sheets').delete().eq('id', target.id);
	if (delErr) return deleteErrorResponse(reqId, 'sheet_delete', delErr);

	// Best-effort storage cleanup, now that the rows are gone. A failure here
	// only orphans files in the bucket (logged, and cleanable by a follow-up
	// job); it never fails the request.
	for (const [bucket, paths] of pathsByBucket) {
		const { error: rmErr } = await locals.supabase.storage.from(bucket).remove(paths);
		if (rmErr) {
			console.error('[delete_sheet]', reqId, 'storage_remove', {
				bucket,
				count: paths.length,
				...(dev ? { message: (rmErr as { message?: string }).message } : {})
			});
		}
	}

	// Shift the later pages down one so numbers stay contiguous. Ascending
	// order keeps the (comic_id, number) unique constraint satisfied at every
	// step — each update moves a row into the slot just freed below it. On a
	// failure we stop (the next update would conflict with the row that didn't
	// move) and leave a gap, which everything tolerates: sheets are always
	// ordered by number and nothing assumes contiguity.
	for (const s of sheets) {
		if (s.number <= number) continue;
		const { error: renumErr } = await locals.supabase
			.from('sheets')
			.update({ number: s.number - 1 })
			.eq('id', s.id);
		if (renumErr) {
			console.error('[delete_sheet]', reqId, 'renumber', {
				sheet_number: s.number,
				...(dev ? { message: (renumErr as { message?: string }).message } : {})
			});
			break;
		}
	}

	// Report the authoritative remaining page numbers so the client can mirror
	// whatever renumbering actually happened. If this read fails the delete
	// still succeeded — return success without the list and let the client
	// fall back to computing the expected shift locally.
	const { data: afterRaw, error: afterErr } = await locals.supabase
		.from('sheets')
		.select('number')
		.eq('comic_id', comicId)
		.order('number', { ascending: true });
	if (afterErr) {
		console.error('[delete_sheet]', reqId, 'sheets_reselect', {
			...(dev ? { message: (afterErr as { message?: string }).message } : {})
		});
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	}
	const pageNumbers = ((afterRaw ?? []) as Array<{ number: number }>).map((s) => s.number);

	return new Response(JSON.stringify({ success: true, pageNumbers }), { status: 200 });
};
