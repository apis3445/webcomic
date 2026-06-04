import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
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
		console.error('Failed fetching user comics', error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'content-type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ comics: comics || [] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
