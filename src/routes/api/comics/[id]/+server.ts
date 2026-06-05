import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Recursively list every object under a folder prefix in a Supabase storage
// bucket. Supabase's `.list(prefix)` is a single-level read, so we walk down
// each sub-prefix until we've collected all leaf object paths.
async function listAllObjects(
	supabase: App.Locals['supabase'],
	bucket: string,
	prefix: string
): Promise<string[]> {
	const out: string[] = [];
	const stack: string[] = [prefix];
	while (stack.length) {
		const current = stack.pop()!;
		const { data, error } = await supabase.storage.from(bucket).list(current, { limit: 1000 });
		if (error) throw error;
		for (const entry of data ?? []) {
			const full = current ? `${current}/${entry.name}` : entry.name;
			// Folder entries have no id/metadata in Supabase's response — recurse into them
			if (!entry.id) stack.push(full);
			else out.push(full);
		}
	}
	return out;
}

async function purgeStorage(
	supabase: App.Locals['supabase'],
	bucket: string,
	prefix: string,
	reqId: string,
	stage: string
): Promise<void> {
	try {
		const paths = await listAllObjects(supabase, bucket, prefix);
		if (paths.length === 0) return;
		const { error } = await supabase.storage.from(bucket).remove(paths);
		if (error) {
			console.error('[delete_comic]', reqId, stage, {
				bucket,
				prefix,
				removed: 0,
				...(dev ? { message: (error as { message?: string }).message } : {})
			});
		}
	} catch (e: unknown) {
		const msg = (e as { message?: string })?.message;
		console.error('[delete_comic]', reqId, stage, {
			bucket,
			prefix,
			...(dev ? { message: msg } : {})
		});
		// Don't rethrow — storage cleanup is best-effort. The DB row delete is
		// what determines whether the comic is gone from the user's perspective.
	}
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const reqId = newReqId();
	const comicId = params.id;
	if (!comicId)
		return new Response(JSON.stringify({ error: 'comic id required' }), { status: 400 });

	// Ensure user and ownership
	const { data: userData, error: userErr } = await locals.supabase.auth.getUser();
	const userId = userData?.user?.id;
	if (userErr || !userId)
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });

	// Verify ownership
	const { data: comicRow, error: comicErr } = await locals.supabase
		.from('comics')
		.select('id, owner_id')
		.eq('id', comicId)
		.maybeSingle();
	if (comicErr || !comicRow)
		return new Response(JSON.stringify({ error: 'Comic not found' }), { status: 404 });
	if ((comicRow as { owner_id: string }).owner_id !== userId)
		return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

	// Storage cleanup first — failures here are non-fatal (best-effort), but
	// doing it before the DB delete means the ownership check above still
	// applies (we'd lose the gate after the row is gone).
	await purgeStorage(locals.supabase, 'comics', comicId, reqId, 'purge_comics');
	await purgeStorage(locals.supabase, 'public-comics', comicId, reqId, 'purge_public');

	// Now delete the DB row (relies on FK ON DELETE CASCADE for sheets/panels/
	// bubbles/images rows — same trust as before this change).
	const { error: delErr } = await locals.supabase.from('comics').delete().eq('id', comicId);
	if (delErr) {
		const e = delErr as { message?: string; code?: string; name?: string; status?: number };
		console.error('[delete_comic]', reqId, 'row_delete', {
			status: e.status,
			code: e.code,
			name: e.name,
			...(dev ? { message: e.message } : {})
		});
		return new Response(
			JSON.stringify({ error: 'Could not delete comic. Please try again.', reqId }),
			{ status: 500 }
		);
	}

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
