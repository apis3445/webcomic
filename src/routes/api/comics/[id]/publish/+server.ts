import { dev } from '$app/environment';
import { resolveSheetNumber } from '$lib/sheets';
import type { RequestHandler } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Log a structured publish error (safe in prod) and return a generic 500 to the client.
// Detailed Supabase fields only included in dev to avoid leaking schema/Postgres
// constraint names through log aggregators.
function publishErrorResponse(
	reqId: string,
	stage: string,
	error: unknown,
	status = 500,
	extra: Record<string, unknown> = {}
): Response {
	const err = (error ?? {}) as { message?: string; code?: string; name?: string; status?: number };
	console.error('[publish]', reqId, stage, {
		status: err.status,
		code: err.code,
		name: err.name,
		...(dev ? { message: err.message } : {})
	});
	return new Response(
		JSON.stringify({ error: 'Could not publish your comic. Please try again.', reqId, ...extra }),
		{ status }
	);
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const reqId = newReqId();
	const comicId = params.id;
	if (!comicId)
		return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });

	// Ensure user is owner
	const { data: userData, error: userErr } = await locals.supabase.auth.getUser();
	const userId = userData?.user?.id;
	if (userErr || !userId)
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });

	const { data: comicRow, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id')
		.eq('id', comicId)
		.maybeSingle();
	if (comicErr || !comicRow)
		return new Response(JSON.stringify({ error: 'Comic not found' }), { status: 404 });
	if ((comicRow as any).owner_id !== userId)
		return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

	// Accept optional payload with template and panels/bubbles to persist before publishing
	const payload: any = await request.json().catch(() => null);

	// Page the client was editing when it hit Publish (sheets.number).
	// Older clients never send it — default to 1. An out-of-range value
	// (non-integer/NaN, < 1, or > MAX_SHEETS) is rejected rather than clamped,
	// so it can't silently overwrite a different existing page.
	const sheetNumber = resolveSheetNumber(payload?.sheetNumber);
	if (sheetNumber === null)
		return new Response(JSON.stringify({ error: 'Invalid sheetNumber' }), { status: 400 });

	if (payload && (payload.templateId || payload.panels)) {
		try {
			const isUuid = (s: any) =>
				typeof s === 'string' &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

			let safeTemplateIdPub: string | null = null;
			if (typeof payload.templateId === 'string') {
				if (isUuid(payload.templateId)) {
					safeTemplateIdPub = payload.templateId;
				} else {
					const { data: tmpl } = await locals.supabase
						.from('sheet_templates')
						.select('id')
						.eq('slug', payload.templateId)
						.maybeSingle();
					if (tmpl && (tmpl as any).id) safeTemplateIdPub = (tmpl as any).id;
					else if (payload.templateId)
						console.warn(`publish: could not resolve template slug "${payload.templateId}"`);
				}
			}

			const sheetUpsert: { comic_id: string; number: number; template_id?: string } = {
				comic_id: comicId,
				number: sheetNumber
			};
			if (safeTemplateIdPub) sheetUpsert.template_id = safeTemplateIdPub;
			const { data: sheetRow, error: sheetUpsertErr } = await locals.supabase
				.from('sheets')
				.upsert(sheetUpsert, { onConflict: 'comic_id,number' })
				.select('id')
				.single();
			if (sheetUpsertErr || !sheetRow || typeof (sheetRow as any).id !== 'string') {
				throw new Error(`sheet upsert failed: ${sheetUpsertErr?.message ?? 'missing id'}`);
			}

			const sheetId = (sheetRow as { id: string }).id;

			// Upsert panels and bubbles (simple approach: find panel by sheet_id + index)
			if (Array.isArray(payload.panels)) {
				for (const p of payload.panels) {
					const idx = p.index;
					if (typeof idx !== 'number' || !Number.isFinite(idx)) {
						console.warn('publish: skipping panel with invalid index', p);
						continue;
					}
					// Pick the oldest existing panel for this (sheet, index). Tolerates legacy
					// duplicates created by older upload-image runs without erroring.
					const { data: existingPanels, error: panelSelectErr } = await locals.supabase
						.from('panels')
						.select('id, created_at')
						.eq('sheet_id', sheetId)
						.eq('index', idx)
						.order('created_at', { ascending: true });
					if (panelSelectErr) {
						console.error('publish: panel select failed', panelSelectErr);
						continue;
					}
					let panelId: string;
					if (existingPanels && existingPanels.length > 0) {
						const candidate = (existingPanels[0] as any).id;
						if (typeof candidate !== 'string') {
							console.error('publish: existing panel missing id', existingPanels[0]);
							continue;
						}
						panelId = candidate;
						// update geometry if provided
						const geom: any = {};
						if (typeof p.x === 'number') geom.x = p.x;
						if (typeof p.y === 'number') geom.y = p.y;
						if (typeof p.w === 'number') geom.w = p.w;
						if (typeof p.h === 'number') geom.h = p.h;
						if (Object.keys(geom).length > 0) {
							const { error: panelUpdErr } = await locals.supabase
								.from('panels')
								.update(geom)
								.eq('id', panelId);
							if (panelUpdErr) console.error('publish: panel update failed', panelUpdErr);
						}
					} else {
						const { data: insertedPanel, error: panelInsertErr } = await locals.supabase
							.from('panels')
							.insert({
								sheet_id: sheetId,
								index: idx,
								x: p.x ?? null,
								y: p.y ?? null,
								w: p.w ?? null,
								h: p.h ?? null
							})
							.select('id')
							.single();
						if (panelInsertErr || !insertedPanel || typeof (insertedPanel as any).id !== 'string') {
							console.error('publish: panel insert failed', panelInsertErr);
							continue;
						}
						panelId = (insertedPanel as any).id;
					}

					// Replace bubbles for this panel: delete and insert. Skip the insert
					// if the delete failed so we don't leave partial state behind.
					const { error: bubbleDelErr } = await locals.supabase
						.from('bubbles')
						.delete()
						.eq('panel_id', panelId);
					if (bubbleDelErr) {
						console.error('publish: bubble delete failed', bubbleDelErr);
						continue;
					}
					if (Array.isArray(p.bubbles) && p.bubbles.length) {
						const toInsert = p.bubbles.map((b: any, bi: number) => ({
							panel_id: panelId,
							sheet_id: sheetId,
							author_id: userId,
							text: b.text,
							x: b.x,
							y: b.y,
							w: b.width ?? b.w,
							h: b.height ?? b.h,
							z_index: typeof b.z_index === 'number' ? b.z_index : bi,
							style: b.type ?? b.style ?? null
						}));
						const { error: bubbleInsErr } = await locals.supabase.from('bubbles').insert(toInsert);
						if (bubbleInsErr) console.error('publish: bubble insert failed', bubbleInsErr);
					}
				}
			}
		} catch (e: any) {
			console.error('Failed to persist panels/bubbles before publish', e);
			// Continue — publishing can still proceed using existing DB rows
		}
	}

	// Fetch images for comic. Include public_url so we can skip ones already
	// pushed to the public bucket (idempotent retries).
	const { data: images, error: imagesErr } = await locals.supabase
		.from('images')
		.select('id, storage_path, bucket, filename, mime, public_url')
		.eq('comic_id', comicId);
	if (imagesErr) {
		return publishErrorResponse(reqId, 'images_select', imagesErr);
	}

	const publicBucket = 'public-comics';
	const results: Array<{ id: string; public_url?: string; failed?: true }> = [];
	let failedCount = 0;

	for (const img of images as any[]) {
		// Idempotency: if this image was already published in a previous
		// (partially-successful) run, reuse the existing public_url.
		if (img.public_url) {
			results.push({ id: img.id, public_url: img.public_url });
			continue;
		}
		try {
			let path = img.storage_path;
			const bucket = img.bucket || 'comics';

			// Normalize path: if stored path includes bucket prefix, strip it
			if (path?.startsWith(bucket + '/')) {
				path = path.slice(bucket.length + 1);
			}

			// Download from private bucket
			const { data: downloaded, error: dlErr } = await locals.supabase.storage
				.from(bucket)
				.download(path);
			if (dlErr || !downloaded) {
				const e = (dlErr ?? {}) as {
					message?: string;
					status?: number;
					statusCode?: string | number;
					name?: string;
				};
				// Orphaned row: the storage object is gone (e.g. it was replaced
				// and the old file deleted while a legacy duplicate row still
				// pointed at it) and nothing public references it. Drop the row
				// instead of failing — otherwise one orphan permanently blocks
				// publishing the whole comic. The panel simply renders without
				// an image until the user re-uploads one.
				const notFound =
					e.status === 404 ||
					e.statusCode === 404 ||
					e.statusCode === '404' ||
					/not.?found/i.test(e.message ?? '');
				if (notFound) {
					console.warn('[publish]', reqId, 'orphaned_image_dropped', {
						image_id: img.id,
						...(dev ? { path } : {})
					});
					const { error: delErr } = await locals.supabase.from('images').delete().eq('id', img.id);
					if (delErr) {
						console.error('[publish]', reqId, 'orphaned_image_delete_failed', {
							image_id: img.id
						});
					}
					continue;
				}
				console.error('[publish]', reqId, 'image_download', {
					image_id: img.id,
					status: e.status,
					name: e.name,
					...(dev ? { message: e.message, path } : {})
				});
				results.push({ id: img.id, failed: true });
				failedCount++;
				continue;
			}

			// Normalize to Uint8Array
			let bytes: Uint8Array;
			if (downloaded instanceof Uint8Array) {
				bytes = downloaded;
			} else if (typeof (downloaded as any).arrayBuffer === 'function') {
				const ab = await (downloaded as any).arrayBuffer();
				bytes = new Uint8Array(ab);
			} else if (
				(downloaded as any).toString &&
				typeof (downloaded as any).toString === 'function'
			) {
				// fallback
				const ab = await (downloaded as any).arrayBuffer?.();
				bytes = ab ? new Uint8Array(ab) : new Uint8Array();
			} else {
				bytes = new Uint8Array();
			}

			// Detect MIME from bytes (fallback to stored mime if available)
			function detectImageMime(bytes: Uint8Array): string | null {
				if (
					bytes.length >= 4 &&
					bytes[0] === 0x89 &&
					bytes[1] === 0x50 &&
					bytes[2] === 0x4e &&
					bytes[3] === 0x47
				)
					return 'image/png';
				if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
					return 'image/jpeg';
				if (
					bytes.length >= 12 &&
					bytes[8] === 0x57 &&
					bytes[9] === 0x45 &&
					bytes[10] === 0x42 &&
					bytes[11] === 0x50
				)
					return 'image/webp';
				if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
					return 'image/gif';
				const head = new TextDecoder().decode(bytes.slice(0, 256)).toLowerCase();
				if (head.includes('<svg')) return 'image/svg+xml';
				return null;
			}

			const detected = detectImageMime(bytes);
			const contentType = detected || img.mime || 'application/octet-stream';

			const filename = img.filename || path.split('/').pop() || `${img.id}`;
			const publicRelativePath = `${comicId}/${filename}`;

			// Upload to public bucket (include content type)
			const { error: upErr } = await locals.supabase.storage
				.from(publicBucket)
				.upload(publicRelativePath, bytes, { upsert: true, contentType });
			if (upErr) {
				const e = upErr as { message?: string; status?: number; name?: string };
				console.error('[publish]', reqId, 'image_upload_public', {
					image_id: img.id,
					status: e.status,
					name: e.name,
					...(dev ? { message: e.message } : {})
				});
				results.push({ id: img.id, failed: true });
				failedCount++;
				continue;
			}

			const { data: urlData } = await locals.supabase.storage
				.from(publicBucket)
				.getPublicUrl(publicRelativePath as string);
			const publicUrl = (urlData as any)?.publicUrl || '';

			// Save public_url on images row
			const { error: updErr } = await locals.supabase
				.from('images')
				.update({ public_url: publicUrl })
				.eq('id', img.id);
			if (updErr) {
				const e = updErr as { message?: string; status?: number; name?: string };
				console.error('[publish]', reqId, 'image_url_save', {
					image_id: img.id,
					status: e.status,
					name: e.name,
					...(dev ? { message: e.message } : {})
				});
				results.push({ id: img.id, failed: true });
				failedCount++;
				continue;
			}

			results.push({ id: img.id, public_url: publicUrl });
		} catch (e: any) {
			console.error('[publish]', reqId, 'image_loop_unexpected', {
				image_id: img.id,
				...(dev ? { message: e?.message } : {})
			});
			results.push({ id: img.id, failed: true });
			failedCount++;
		}
	}

	// Refuse to flip is_public if any image failed — half-published comics
	// render empty panels on the public viewer. Successful images already have
	// their public_url persisted, so a client retry is cheap (idempotent loop
	// above skips them).
	if (failedCount > 0) {
		console.error('[publish]', reqId, 'partial_failure', {
			total: (images as any[]).length,
			failed: failedCount
		});
		return new Response(
			JSON.stringify({
				error: `Some images could not be published (${failedCount} of ${(images as any[]).length}). Please try again.`,
				reqId,
				failedCount,
				totalCount: (images as any[]).length
			}),
			{ status: 502 }
		);
	}

	// Set comic is_public = true
	const { error: publishErr } = await locals.supabase
		.from('comics')
		.update({ is_public: true })
		.eq('id', comicId);
	if (publishErr) {
		return publishErrorResponse(reqId, 'set_public', publishErr);
	}

	// Also return a canonical path for the published comic page
	const comic_path = `/comics/${comicId}`;
	return new Response(JSON.stringify({ success: true, results, comic_path }), { status: 200 });
};
