import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const POST: RequestHandler = async ({ request, locals }) => {
	const form = await request.formData();
	const file = form.get('file') as File | null;
	const panelIndexStr = form.get('panelIndex') as string | null;
	const sheetNumberStr = form.get('sheetNumber') as string | null;
	let comicId = form.get('comicId') as string | null;

	const panelIndex = panelIndexStr ? parseInt(panelIndexStr, 10) : 1;
	const sheetNumber = sheetNumberStr ? parseInt(sheetNumberStr, 10) : 1;

	if (!file) return new Response(JSON.stringify({ error: 'file is required' }), { status: 400 });

	const { data: userData, error: userErr } = await locals.supabase.auth.getUser();
	if (dev) console.log('upload-image auth.getUser result', { userData, userErr });
	const userId = userData?.user?.id;
	if (userErr || !userId) {
		console.error('upload-image: no authenticated user', { userErr });
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	} else if (dev) {
		console.log('upload-image: authenticated userId', userId);
	}

	// Ensure comic exists
	if (!comicId) {
		const { data: comicData, error: cErr } = await locals.supabase
			.from('comics')
			.insert({ owner_id: userId, name: 'Untitled', description: '', is_public: false })
			.select('id')
			.single();
		if (cErr) {
			console.error('Failed to create comic', cErr);
			return new Response(JSON.stringify({ error: cErr.message }), { status: 500 });
		}
		comicId = comicData.id;
	}

	// Ensure sheet exists (sheetNumber)
	let sheetId: string;
	const { data: existingSheet, error: existingSheetErr } = await locals.supabase
		.from('sheets')
		.select('id')
		.eq('comic_id', comicId)
		.eq('number', sheetNumber)
		.maybeSingle();
	if (existingSheetErr) {
		console.error('Failed to lookup sheet', existingSheetErr);
		return new Response(JSON.stringify({ error: existingSheetErr.message }), { status: 500 });
	}
	if (existingSheet && (existingSheet as any).id) {
		sheetId = (existingSheet as any).id;
	} else {
		const { data: newSheet, error: sErr } = await locals.supabase
			.from('sheets')
			.insert({ comic_id: comicId, number: sheetNumber, template_id: null })
			.select('id')
			.single();
		if (sErr || !newSheet) {
			console.error('Failed to create sheet', sErr);
			return new Response(JSON.stringify({ error: sErr?.message ?? 'sheet create failed' }), {
				status: 500
			});
		}
		sheetId = newSheet.id;
	}

	// Find existing panel for this (sheet, index) or create one. Avoids duplicate
	// panel rows when an image is re-uploaded — duplicates break save/publish
	// because their maybeSingle() lookup errors and they end up creating a third
	// panel that bubbles attach to but no image points at.
	const panelIndex1 = panelIndex;
	let panelId: string;
	const { data: existingPanels } = await locals.supabase
		.from('panels')
		.select('id, created_at')
		.eq('sheet_id', sheetId)
		.eq('index', panelIndex1)
		.order('created_at', { ascending: true });
	if (existingPanels && existingPanels.length > 0) {
		panelId = (existingPanels[0] as any).id;
	} else {
		const { data: panelData, error: pErr } = await locals.supabase
			.from('panels')
			.insert({ sheet_id: sheetId, index: panelIndex1 })
			.select('id')
			.single();
		if (pErr || !panelData) {
			console.error('Failed to create panel', pErr);
			return new Response(JSON.stringify({ error: pErr?.message ?? 'panel create failed' }), {
				status: 500
			});
		}
		panelId = panelData.id;
	}

	// Read blob bytes and validate MIME
	const arrayBuffer = await file.arrayBuffer();
	const uint8 = new Uint8Array(arrayBuffer);

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
		return null;
	}

	// No webp: the public-comics bucket rejects image/webp, so a webp panel
	// image uploads fine but then fails every publish. Reject it up front.
	const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif']);
	const detected = detectImageMime(uint8);
	if (!detected || !ALLOWED.has(detected)) {
		return new Response(JSON.stringify({ error: 'Only jpg, png and gif images are allowed.' }), {
			status: 400
		});
	}
	const mime = detected;

	// Upload to storage with explicit content type
	const filename = `${Date.now()}-${file.name}`;
	// Use relative path inside the bucket (do NOT include the bucket name)
	const relativePath = `${comicId}/sheets/${sheetNumber}/panels/${panelIndex1}/${filename}`;
	// Include uploader metadata to satisfy any storage RLS that checks object metadata
	const uploadOpts: any = {
		upsert: true,
		contentType: mime,
		metadata: { user_id: userId, uploaded_by: userId }
	};
	const { error: upErr } = await locals.supabase.storage
		.from('comics')
		.upload(relativePath, uint8, uploadOpts);
	if (upErr) {
		console.error('Upload error', {
			message: upErr.message,
			status: upErr.status,
			statusCode: upErr.statusCode,
			details: (upErr as any).details ?? null,
			body: (upErr as any).body ?? null
		});
		return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
	}

	// Get a signed URL for private bucket access (expires in 24 hours)
	const bucketName = 'comics';
	const publicPathForUrl = relativePath;
	const { data: urlData, error: urlErr } = await locals.supabase.storage
		.from(bucketName)
		.createSignedUrl(publicPathForUrl as string, 60 * 60 * 24);
	if (urlErr) console.error('createSignedUrl error', urlErr);
	const publicUrl = (urlData as any)?.signedUrl ?? '';

	// Verify comic ownership is visible under auth (helps diagnose RLS failures)
	const { data: comicRow, error: comicFetchErr } = await locals.supabase
		.from('comics')
		.select('owner_id')
		.eq('id', comicId)
		.single();
	if (comicFetchErr || !comicRow) {
		console.error('Failed to fetch comic for ownership check', comicFetchErr);
		return new Response(JSON.stringify({ error: 'comic not found or inaccessible' }), {
			status: 404
		});
	}
	if ((comicRow as any).owner_id !== userId) {
		console.error('Owner mismatch for image insert', {
			comicOwner: (comicRow as any).owner_id,
			userId,
			comicId
		});
		return new Response(JSON.stringify({ error: 'forbidden: you are not the comic owner' }), {
			status: 403
		});
	}

	// Read optional width/height from the client
	const widthStr = form.get('width') as string | null;
	const heightStr = form.get('height') as string | null;
	const widthVal = widthStr ? parseInt(widthStr, 10) : null;
	const heightVal = heightStr ? parseInt(heightStr, 10) : null;

	// Insert image metadata (include width/height if provided).
	// public_url is explicitly cleared: when this upsert replaces a panel's
	// image, the old published copy no longer matches — publish skips rows
	// that already have a public_url, so leaving the stale one in place would
	// pin the public site to the old image forever.
	const imageRow: any = {
		panel_id: panelId,
		sheet_id: sheetId,
		comic_id: comicId,
		storage_path: relativePath,
		bucket: 'comics',
		filename: file.name,
		mime,
		uploaded_by: userId,
		public_url: null
	};
	if (typeof widthVal === 'number' && !Number.isNaN(widthVal)) imageRow.width = widthVal;
	if (typeof heightVal === 'number' && !Number.isNaN(heightVal)) imageRow.height = heightVal;

	// Capture the prior storage path before upsert overwrites it — we need it
	// to delete the old file from the bucket. One panel → one image row,
	// enforced by the UNIQUE constraint on images.panel_id.
	const { data: priorImage, error: priorImgErr } = await locals.supabase
		.from('images')
		.select('storage_path, bucket')
		.eq('panel_id', panelId)
		.maybeSingle();
	if (priorImgErr) {
		console.error('Failed to read prior image row', priorImgErr);
		return new Response(JSON.stringify({ error: priorImgErr.message }), { status: 500 });
	}

	const { data: imgData, error: imgErr } = await locals.supabase
		.from('images')
		.upsert(imageRow, { onConflict: 'panel_id' })
		.select('*')
		.single();
	if (imgErr || !imgData) {
		console.error('Images upsert error', imgErr);
		return new Response(JSON.stringify({ error: imgErr?.message ?? 'images upsert failed' }), {
			status: 500
		});
	}

	// Remove the prior storage object now that the DB row points at the new
	// path. Failures are logged but don't fail the request: an orphan file is
	// recoverable, a failed save isn't.
	const priorPath = (priorImage as { storage_path?: string | null } | null)?.storage_path ?? null;
	const priorBucket =
		((priorImage as { bucket?: string | null } | null)?.bucket ?? null) || 'comics';
	if (priorPath && priorPath !== relativePath) {
		const { error: rmErr } = await locals.supabase.storage.from(priorBucket).remove([priorPath]);
		if (rmErr) {
			console.warn('Failed to remove prior storage object', { priorBucket, priorPath, rmErr });
		}
	}

	return new Response(
		JSON.stringify({ comicId, sheetId, panelId, url: publicUrl, image: imgData }),
		{ status: 201 }
	);
};
