import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export const GET: RequestHandler = async ({ locals }) => {
	const reqId = newReqId();
	const { data: claimsData, error: claimsError } = await locals.supabase.auth.getClaims();
	if (claimsError || !claimsData?.claims) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
	}

	const userId = claimsData.claims.sub;

	const { data: comics, error } = await locals.supabase
		.from('comics')
		.select('id, name, is_public, updated_at')
		.eq('owner_id', userId)
		.order('updated_at', { ascending: false });

	if (error) {
		const e = error as { message?: string; code?: string; name?: string; status?: number };
		console.error('[my_comics]', reqId, 'list_error', {
			status: e.status,
			code: e.code,
			name: e.name,
			...(dev ? { message: e.message } : {})
		});
		return new Response(
			JSON.stringify({ error: 'Could not load your comics. Please try again.', reqId }),
			{ status: 500, headers: { 'content-type': 'application/json' } }
		);
	}

	return new Response(JSON.stringify({ comics: comics || [] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
