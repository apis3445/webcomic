import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const name = body?.name ?? 'Untitled';
	const description = body?.description ?? '';

	// Ensure user
	const { data: userData, error: userErr } = await locals.supabase.auth.getUser();
	const userId = userData?.user?.id;
	if (userErr || !userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	}

	const { data, error } = await locals.supabase
		.from('comics')
		.insert({ owner_id: userId, name, description, is_public: false })
		.select('id')
		.single();

	if (error) {
		console.error('create comic error', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 400 });
	}

	return new Response(JSON.stringify({ id: data.id }), { status: 201 });
};
