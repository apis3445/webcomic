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

	let payload: any = null;
	try {
		payload = await request.json();
	} catch (e) {
		payload = null;
	}

	// Update comic metadata if provided
	if (payload && typeof payload.name === 'string') {
		const { error: updErr } = await locals.supabase.from('comics').update({ name: payload.name }).eq('id', comicId);
		if (updErr) {
			console.error('failed to update comic name', updErr);
			return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });
		}
	}

	try {
		if (payload && (payload.templateId || Array.isArray(payload.panels))) {
			// Ensure sheet #1 exists
			let { data: sheetRow } = await locals.supabase
				.from('sheets')
				.select('id')
				.eq('comic_id', comicId)
				.eq('number', 1)
				.maybeSingle();
			if (!sheetRow) {
				const { data: newSheet, error: newSheetErr } = await locals.supabase
					.from('sheets')
					.insert({ comic_id: comicId, number: 1, template_id: payload.templateId ?? null })
					.select('id')
					.single();
				if (newSheetErr || !newSheet || !(newSheet as any).id) {
					console.error('failed to create sheet', newSheetErr);
					return new Response(JSON.stringify({ error: 'Failed to ensure sheet exists' }), { status: 500 });
				}
				sheetRow = newSheet;
			} else if (payload.templateId) {
				// update template_id
				if (!(sheetRow as any).id) {
					return new Response(JSON.stringify({ error: 'Invalid sheet record' }), { status: 500 });
				}
				await locals.supabase.from('sheets').update({ template_id: payload.templateId }).eq('id', (sheetRow as any).id);
			}

			const sheetId = (sheetRow as any).id;

			// Upsert panels and bubbles (find panel by sheet_id + index)
			if (Array.isArray(payload.panels)) {
				for (const p of payload.panels) {
					const idx = p.index;
					// find existing panel
					const { data: existingPanel } = await locals.supabase
						.from('panels')
						.select('id')
						.eq('sheet_id', sheetId)
						.eq('index', idx)
						.maybeSingle();
					let panelId: string;
					if (existingPanel && (existingPanel as any).id) {
						panelId = (existingPanel as any).id;
						// update geometry if provided
						const geom: any = {};
						if (typeof p.x === 'number') geom.x = p.x;
						if (typeof p.y === 'number') geom.y = p.y;
						if (typeof p.w === 'number') geom.w = p.w;
						if (typeof p.h === 'number') geom.h = p.h;
						if (Object.keys(geom).length > 0) {
							await locals.supabase.from('panels').update(geom).eq('id', panelId);
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
							if (insertErr || !insertedPanel || !(insertedPanel as any).id) {
								console.error('failed to insert panel', insertErr);
								return new Response(JSON.stringify({ error: 'Failed to insert panel' }), { status: 500 });
							}
							panelId = (insertedPanel as any).id;
						}

					// Replace bubbles for this panel: delete and insert
					await locals.supabase.from('bubbles').delete().eq('panel_id', panelId);
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
							style: b.style ?? null
						}));
						await locals.supabase.from('bubbles').insert(toInsert);
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
