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

	const payload: any = await request.json().catch(() => null);

	// Update comic metadata if provided
	if (payload && typeof payload.name === 'string') {
		const { error: updErr } = await locals.supabase
			.from('comics')
			.update({ name: payload.name })
			.eq('id', comicId);
		if (updErr) {
			console.error('failed to update comic name', updErr);
			return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });
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
					console.warn(`save: could not resolve template slug "${payload.templateId}"`);
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
				console.error('save: sheet select failed', sheetSelectErr);
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
					console.error('failed to create sheet', newSheetErr);
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
					console.error('save: sheet template update failed', tmplUpdErr);
					return new Response(JSON.stringify({ error: tmplUpdErr.message }), { status: 500 });
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
						console.warn('save: skipping panel with invalid index', p);
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
						console.error('save: panel select failed', panelSelectErr);
						return new Response(JSON.stringify({ error: panelSelectErr.message }), {
							status: 500
						});
					}
					let panelId: string;
					if (existingPanels && existingPanels.length > 0) {
						const candidate = (existingPanels[0] as any).id;
						if (typeof candidate !== 'string') {
							console.error('save: existing panel missing id', existingPanels[0]);
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
								console.error('save: panel update failed', panelUpdErr);
								return new Response(JSON.stringify({ error: panelUpdErr.message }), {
									status: 500
								});
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
							console.error('failed to insert panel', insertErr);
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
						console.error('save: bubble delete failed', bubbleDelErr);
						return new Response(JSON.stringify({ error: bubbleDelErr.message }), {
							status: 500
						});
					}
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
							style: b.type ?? b.style ?? null
						}));
						const { error: bubbleInsErr } = await locals.supabase
							.from('bubbles')
							.insert(toInsert);
						if (bubbleInsErr) {
							console.error('save: bubble insert failed', bubbleInsErr);
							return new Response(JSON.stringify({ error: bubbleInsErr.message }), {
								status: 500
							});
						}
					}
				}
			}
		}
	} catch (e: any) {
		console.error('Failed to persist panels/bubbles during save', e);
		return new Response(JSON.stringify({ error: e?.message ?? 'save failed' }), { status: 500 });
	}

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
