import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function thumbnailErrorResponse(
	reqId: string,
	stage: string,
	error: unknown,
	status = 500
): Response {
	const err = (error ?? {}) as { message?: string; code?: string; name?: string; status?: number };
	console.error('[thumbnail]', reqId, stage, {
		status: err.status,
		code: err.code,
		name: err.name,
		...(dev ? { message: err.message } : {})
	});
	return new Response(
		JSON.stringify({ error: 'Could not save thumbnail. Please try again.', reqId }),
		{ status }
	);
}

function detectImageMime(bytes: Uint8Array): string | null {
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
		return 'image/png';
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
		return 'image/webp';
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
	const head = new TextDecoder().decode(bytes.slice(0, 256)).toLowerCase();
	if (head.includes('<svg')) return 'image/svg+xml';
	return null;
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const reqId = newReqId();
	const comicId = params.id;
	if (!comicId)
		return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });

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

	const form = await request.formData();
	const file = form.get('file') as File | null;
	if (!file)
		return new Response(JSON.stringify({ error: 'file is required' }), { status: 400 });

	const arrayBuffer = await file.arrayBuffer();
	const uint8 = new Uint8Array(arrayBuffer);
	const detected = detectImageMime(uint8);
	const mime = detected || file.type || '';
	if (!mime || !ALLOWED.has(mime))
		return new Response(
			JSON.stringify({ error: 'Only image files are allowed (jpg, png, webp, gif, svg).' }),
			{ status: 400 }
		);

	const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
	const storagePath = `${comicId}/thumbnail/cover.${ext}`;

	const { error: upErr } = await locals.supabase.storage
		.from('comics')
		.upload(storagePath, uint8, { upsert: true, contentType: mime });
	if (upErr) return thumbnailErrorResponse(reqId, 'storage_upload', upErr);

	const { error: updErr } = await locals.supabase
		.from('comics')
		.update({ thumbnail_path: storagePath })
		.eq('id', comicId);
	if (updErr) return thumbnailErrorResponse(reqId, 'row_update', updErr);

	const { data: urlData } = await locals.supabase.storage
		.from('comics')
		.createSignedUrl(storagePath, 60 * 60 * 24);

	return new Response(
		JSON.stringify({ thumbnail_url: urlData?.signedUrl ?? '', thumbnail_path: storagePath }),
		{ status: 200 }
	);
};
