import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const comicId = params.id;
	if (!comicId) return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });

	// Ensure user and ownership
	const { data: userData, error: userErr } = await locals.supabase.auth.getUser();
	const userId = userData?.user?.id;
	if (userErr || !userId) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });

	// Verify ownership
	const { data: comicRow, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id')
		.eq('id', comicId)
		.maybeSingle();
	if (comicErr || !comicRow) return new Response(JSON.stringify({ error: 'Comic not found' }), { status: 404 });
	if ((comicRow as any).owner_id !== userId) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

	// Attempt delete (may cascade depending on DB constraints)
	const { error: delErr } = await locals.supabase.from('comics').delete().eq('id', comicId);
	if (delErr) {
		console.error('Failed to delete comic', delErr);
		return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });
	}

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
