import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const reqId = newReqId();
	const body = await request.json();
	const name = body?.name ?? 'Untitled';
	const description = body?.description ?? '';

	// Ensure user (verified JWT claims; sub is the user id)
	const { data: claimsData, error: claimsErr } = await locals.supabase.auth.getClaims();
	const userId = claimsData?.claims?.sub;
	if (claimsErr || !userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	}

	const { data, error } = await locals.supabase
		.from('comics')
		.insert({ owner_id: userId, name, description, is_public: false })
		.select('id')
		.single();

	if (error) {
		console.error('[comics_create]', reqId, 'insert_error', {
			status: (error as { status?: number }).status,
			code: (error as { code?: string }).code,
			name: error.name,
			...(dev ? { message: error.message } : {})
		});
		return new Response(
			JSON.stringify({ error: 'Could not create comic. Please try again.', reqId }),
			{ status: 400 }
		);
	}

	return new Response(JSON.stringify({ id: data.id }), { status: 201 });
};
