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
	let payload: any = null;
	try {
		payload = await request.json();
	} catch (e) {
		payload = null;
	}

	if (payload && (payload.templateId || payload.panels)) {
		try {
			// Ensure sheet #1 exists
			let { data: sheetRow } = await locals.supabase
				.from('sheets')
				.select('id')
				.eq('comic_id', comicId)
				.eq('number', 1)
				.maybeSingle();
			if (!sheetRow) {
				const { data: newSheet } = await locals.supabase
					.from('sheets')
					.insert({ comic_id: comicId, number: 1, template_id: payload.templateId ?? null })
					.select('id')
					.single();
				sheetRow = newSheet;
			} else if (payload.templateId) {
				// update template_id
				await locals.supabase
					.from('sheets')
					.update({ template_id: payload.templateId })
					.eq('id', sheetRow.id);
			}

			const sheetId = sheetRow.id;

			// Upsert panels and bubbles (simple approach: find panel by sheet_id + index)
			if (Array.isArray(payload.panels)) {
				for (const p of payload.panels) {
					const idx = p.index;
					// find existing panel
					const { data: existingPanel } = await locals.supabase
						.from('panels')
						.select('id')
						.eq('sheet_id', sheetId)
						.eq('index', idx)
						.maybeSingle();
					let panelId: string;
					if (existingPanel && (existingPanel as any).id) {
						panelId = (existingPanel as any).id;
						// update geometry if provided
						const geom: any = {};
						if (typeof p.x === 'number') geom.x = p.x;
						if (typeof p.y === 'number') geom.y = p.y;
						if (typeof p.w === 'number') geom.w = p.w;
						if (typeof p.h === 'number') geom.h = p.h;
						if (Object.keys(geom).length > 0) {
							await locals.supabase.from('panels').update(geom).eq('id', panelId);
						}
					} else {
						const { data: insertedPanel } = await locals.supabase
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
						panelId = (insertedPanel as any).id;
					}

					// Replace bubbles for this panel: delete and insert
					await locals.supabase.from('bubbles').delete().eq('panel_id', panelId);
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
							style: b.style ?? null
						}));
						await locals.supabase.from('bubbles').insert(toInsert);
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
