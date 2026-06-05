import type { RequestHandler } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const POST: RequestHandler = async ({ params, locals, request }) => {
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

			// Ensure sheet #1 exists. Throw on any error so the surrounding catch
			// logs the failure and skips the pre-persist block entirely (publish
			// can still proceed against existing DB rows).
			const { data: sheetSelect, error: sheetSelectErr } = await locals.supabase
				.from('sheets')
				.select('id')
				.eq('comic_id', comicId)
				.eq('number', 1)
				.maybeSingle();
			if (sheetSelectErr) {
				throw new Error(`sheet select failed: ${sheetSelectErr.message}`);
			}
			let sheetRow: { id: string } | null = sheetSelect as { id: string } | null;
			if (!sheetRow) {
				const { data: newSheet, error: newSheetErr } = await locals.supabase
					.from('sheets')
					.insert({
						comic_id: comicId,
						number: 1,
						template_id: safeTemplateIdPub
					})
					.select('id')
					.single();
				if (newSheetErr || !newSheet || typeof (newSheet as any).id !== 'string') {
					throw new Error(`sheet insert failed: ${newSheetErr?.message ?? 'missing id'}`);
				}
				sheetRow = newSheet as { id: string };
			} else if (payload.templateId && safeTemplateIdPub) {
				// Only update when slug resolved; otherwise we'd wipe the existing template.
				if (typeof sheetRow.id !== 'string') {
					throw new Error('invalid sheet record (missing id)');
				}
				const { error: tmplUpdErr } = await locals.supabase
					.from('sheets')
					.update({ template_id: safeTemplateIdPub })
					.eq('id', sheetRow.id);
				if (tmplUpdErr) {
					throw new Error(`sheet template update failed: ${tmplUpdErr.message}`);
				}
			}

			const sheetId = sheetRow.id;
			if (typeof sheetId !== 'string') {
				throw new Error('resolved sheetId is not a string');
			}

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
						const toInsert = p.bubbles.map((b: any) => ({
							panel_id: panelId,
							sheet_id: sheetId,
							author_id: userId,
							text: b.text,
							x: b.x,
							y: b.y,
							w: b.width ?? b.w,
							h: b.height ?? b.h,
							z_index: b.z_index ?? 0,
							style: b.type ?? b.style ?? null
						}));
						const { error: bubbleInsErr } = await locals.supabase
							.from('bubbles')
							.insert(toInsert);
						if (bubbleInsErr) console.error('publish: bubble insert failed', bubbleInsErr);
					}
				}
			}
		} catch (e: any) {
			console.error('Failed to persist panels/bubbles before publish', e);
			// Continue — publishing can still proceed using existing DB rows
		}
	}

	// Fetch images for comic
	const { data: images, error: imagesErr } = await locals.supabase
		.from('images')
		.select('id, storage_path, bucket, filename')
		.eq('comic_id', comicId);
	if (imagesErr) {
		console.error('images select error', imagesErr);
		return new Response(JSON.stringify({ error: imagesErr.message }), { status: 500 });
	}

	const publicBucket = 'public-comics';
	const results: Array<{ id: string; public_url?: string; error?: string }> = [];

	for (const img of images as any[]) {
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
				console.error('download error', dlErr);
				results.push({ id: img.id, error: dlErr?.message ?? 'download failed' });
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
				console.error('upload public error', upErr);
				results.push({ id: img.id, error: upErr.message });
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
				console.error('update image public_url error', updErr);
				results.push({ id: img.id, error: updErr.message });
				continue;
			}

			results.push({ id: img.id, public_url: publicUrl });
		} catch (e: any) {
			console.error('publish loop error', e);
			results.push({ id: img.id, error: e?.message ?? 'unknown' });
		}
	}

	// Set comic is_public = true
	const { error: publishErr } = await locals.supabase
		.from('comics')
		.update({ is_public: true })
		.eq('id', comicId);
	if (publishErr) {
		console.error('failed to set comic public', publishErr);
		return new Response(JSON.stringify({ error: publishErr.message, results }), { status: 500 });
	}

	// Also return a canonical path for the published comic page
	const comic_path = `/comics/${comicId}`;
	return new Response(JSON.stringify({ success: true, results, comic_path }), { status: 200 });
};
