import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
/* eslint-disable @typescript-eslint/no-explicit-any */

function newReqId(): string {
	return Math.random().toString(36).slice(2, 10);
}

// Log a structured save error (safe in prod) and return a generic 500 to the client.
// Detailed Supabase fields are only logged in dev to avoid leaking schema/Postgres
// constraint names through centralized log aggregators.
function saveErrorResponse(reqId: string, stage: string, error: unknown, status = 500): Response {
	const err = (error ?? {}) as { message?: string; code?: string; name?: string; status?: number };
	console.error('[save]', reqId, stage, {
		status: err.status,
		code: err.code,
		name: err.name,
		...(dev ? { message: err.message } : {})
	});
	return new Response(
		JSON.stringify({ error: 'Could not save your comic. Please try again.', reqId }),
		{ status }
	);
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const reqId = newReqId();
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

	const payload: any = await request.json().catch(() => null);

	// Update comic metadata if provided
	if (payload && typeof payload.name === 'string') {
		const { error: updErr } = await locals.supabase
			.from('comics')
			.update({ name: payload.name })
			.eq('id', comicId);
		if (updErr) {
			return saveErrorResponse(reqId, 'update_comic_name', updErr);
		}
	}

	try {
		const isUuid = (s: any) =>
			typeof s === 'string' &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

		let safeTemplateId: string | null = null;
		if (payload && typeof payload.templateId === 'string') {
			if (isUuid(payload.templateId)) {
				safeTemplateId = payload.templateId;
			} else {
				const { data: tmpl } = await locals.supabase
					.from('sheet_templates')
					.select('id')
					.eq('slug', payload.templateId)
					.maybeSingle();
				if (tmpl && (tmpl as any).id) safeTemplateId = (tmpl as any).id;
				else if (payload.templateId)
					console.warn('[save]', reqId, `could not resolve template slug "${payload.templateId}"`);
			}
		}

		if (payload && (payload.templateId || Array.isArray(payload.panels))) {
			// Ensure sheet #1 exists
			const { data: sheetSelect, error: sheetSelectErr } = await locals.supabase
				.from('sheets')
				.select('id')
				.eq('comic_id', comicId)
				.eq('number', 1)
				.maybeSingle();
			if (sheetSelectErr) {
				console.error('[save]', reqId, 'sheet select failed', sheetSelectErr);
				return new Response(JSON.stringify({ error: 'Failed to load sheet' }), { status: 500 });
			}
			let sheetRow: { id: string } | null = sheetSelect as { id: string } | null;
			if (!sheetRow) {
				const { data: newSheet, error: newSheetErr } = await locals.supabase
					.from('sheets')
					.insert({ comic_id: comicId, number: 1, template_id: safeTemplateId })
					.select('id')
					.single();
				if (newSheetErr || !newSheet || typeof (newSheet as any).id !== 'string') {
					console.error('[save]', reqId, 'failed to create sheet', newSheetErr);
					return new Response(JSON.stringify({ error: 'Failed to ensure sheet exists' }), {
						status: 500
					});
				}
				sheetRow = newSheet as { id: string };
			} else if (payload.templateId && safeTemplateId) {
				// Only update template_id when slug resolved to a valid UUID.
				// Otherwise we'd wipe an existing valid template — losing the user's selection on reload.
				if (typeof sheetRow.id !== 'string') {
					return new Response(JSON.stringify({ error: 'Invalid sheet record' }), { status: 500 });
				}
				const { error: tmplUpdErr } = await locals.supabase
					.from('sheets')
					.update({ template_id: safeTemplateId })
					.eq('id', sheetRow.id);
				if (tmplUpdErr) {
					return saveErrorResponse(reqId, 'sheet_template_update', tmplUpdErr);
				}
			}

			const sheetId = sheetRow.id;
			if (typeof sheetId !== 'string') {
				return new Response(JSON.stringify({ error: 'Resolved sheet id is not a string' }), {
					status: 500
				});
			}

			// Upsert panels and bubbles (find panel by sheet_id + index)
			if (Array.isArray(payload.panels)) {
				for (const p of payload.panels) {
					const idx = p.index;
					if (typeof idx !== 'number' || !Number.isFinite(idx)) {
						console.warn('[save]', reqId, 'skipping panel with invalid index', p);
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
						return saveErrorResponse(reqId, 'panel_select', panelSelectErr);
					}
					let panelId: string;
					if (existingPanels && existingPanels.length > 0) {
						const candidate = (existingPanels[0] as any).id;
						if (typeof candidate !== 'string') {
							console.error('[save]', reqId, 'existing panel missing id', existingPanels[0]);
							return new Response(JSON.stringify({ error: 'Invalid panel record' }), {
								status: 500
							});
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
							if (panelUpdErr) {
								return saveErrorResponse(reqId, 'panel_update', panelUpdErr);
							}
						}
					} else {
						const { data: insertedPanel, error: insertErr } = await locals.supabase
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
						if (insertErr || !insertedPanel || typeof (insertedPanel as any).id !== 'string') {
							console.error('[save]', reqId, 'failed to insert panel', insertErr);
							return new Response(JSON.stringify({ error: 'Failed to insert panel' }), {
								status: 500
							});
						}
						panelId = (insertedPanel as any).id;
					}

					// Replace bubbles for this panel: delete and insert. Stop if delete
					// fails so we don't leave partial state behind.
					const { error: bubbleDelErr } = await locals.supabase
						.from('bubbles')
						.delete()
						.eq('panel_id', panelId);
					if (bubbleDelErr) {
						return saveErrorResponse(reqId, 'bubble_delete', bubbleDelErr);
					}
					if (Array.isArray(p.bubbles) && p.bubbles.length) {
						const toInsert = p.bubbles.map((b: any, bi: number) => ({
							panel_id: panelId,
							sheet_id: sheetId,
							author_id: userId,
							text: b.text,
							x: b.x,
							y: b.y,
							w: b.width ?? b.w,
							h: b.height ?? b.h,
							// Preserve insertion order if the client (or legacy state)
							// didn't send a z_index. Avoids every bubble stacking at 0.
							z_index: typeof b.z_index === 'number' ? b.z_index : bi,
							style: b.type ?? b.style ?? null
						}));
						const { error: bubbleInsErr } = await locals.supabase
							.from('bubbles')
							.insert(toInsert);
						if (bubbleInsErr) {
							return saveErrorResponse(reqId, 'bubble_insert', bubbleInsErr);
						}
					}
				}
			}
		}
	} catch (e: any) {
		return saveErrorResponse(reqId, 'unexpected', e);
	}

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
