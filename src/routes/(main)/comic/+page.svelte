<script lang="ts">
	import '../../../app.css';
	import Panel from '$lib/components/Panel.svelte';
	import BubbleButton from '$lib/components/BubbleButton.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { untrack, tick, flushSync } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getPanelStage } from '$lib/panelStages';
	import {
		comicState,
		type Bubble,
		type BubbleType,
		type TemplateId,
		type PanelState
	} from '$lib/comicState.svelte';
	import { TEMPLATES, getTemplate } from '$lib/templates';
	import { MAX_SHEETS } from '$lib/sheets';
	import { onDestroy } from 'svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Wizard steps: 1. cover (title + cover image) → 2. layout (pick a page
	// template) → 3. edit (panel editor). Designed so future steps (more
	// pages, back cover) slot in between 'layout' and 'edit'.
	type WizardStep = 'cover' | 'layout' | 'edit';
	let step = $state<WizardStep>('cover');
	let bubbleText = $state('');
	let newComicName = $state('');
	let thumbnailFile = $state<File | null>(null);
	let thumbnailPreviewUrl = $state<string | null>(null);
	let creatingComic = $state(false);
	let createError = $state<string | null>(null);
	// Surfaced under the page bar: add-page cap errors and delete-page failures.
	let pageBarError = $state<string | null>(null);
	let savingCover = $state(false);
	let coverError = $state<string | null>(null);
	let isPrintMode = $state(false);

	// Cover already stored server-side for this comic (signed URL), if any.
	// Refreshed via invalidateAll() after a new cover upload.
	const existingCoverUrl = $derived(data.comic?.thumbnailUrl ?? null);

	// ── Pages (sheets) ──────────────────────────────────────────────────────
	type SheetData = {
		number: number;
		templateSlug: string | null;
		panels: Array<{ index: number; imageUrl: string | null; bubbles: Bubble[] }>;
	};
	// comicState only holds the page being edited; the other pages live here
	// so switching doesn't refetch. Kept in sync by stashCurrentSheet() before
	// every switch. Plain Map — only the page-bar list below is rendered.
	let sheetCache = new SvelteMap<number, SheetData>();
	let pageNumbers = $state<number[]>([1]);
	// True once the highest page number reaches the cap, so the next page would
	// exceed MAX_SHEETS. Used to disable the "Add page" control.
	let atPageCap = $derived(Math.max(...pageNumbers, comicState.sheetNumber) >= MAX_SHEETS);
	// When set, the wizard's layout step is picking a template for this new
	// page instead of changing the current page's layout.
	let pendingNewPage = $state<number | null>(null);
	// Re-entry guard for createNewPage: it awaits two saves, and a second
	// template-card click inside that window would add the same page twice
	// (duplicate keys in the page bar).
	let addingPage = $state(false);
	// Re-entry guard for deleteCurrentPage; also drives the button's busy label.
	let deletingPage = $state(false);

	// One flattened image per panel (Konva stage.toDataURL) used by the print
	// view, so speech bubbles and text print along with the background. null
	// entries fall back to the panel's raw background image.
	let printSnapshots = $state<(string | null)[]>([]);

	function buildPrintSnapshots() {
		// Clear bubble selection so the blue highlight and delete badge
		// don't end up in the printed output, and flush so Konva has the
		// deselected scene before we rasterize it.
		comicState.activeBubbleId = undefined;
		flushSync();
		printSnapshots = comicState.panels.map((_, i) => {
			const stage = getPanelStage(i);
			if (!stage) return null;
			try {
				return stage.toDataURL({ pixelRatio: 2 });
			} catch (err) {
				// Tainted canvas (background image without CORS headers) — the
				// print view falls back to the raw background for this panel.
				console.warn('print: panel snapshot failed, using background image', { i, err });
				return null;
			}
		});
	}

	async function printComic() {
		buildPrintSnapshots();
		isPrintMode = true;
		await tick();
		window.print();
	}

	$effect(() => {
		if (!browser) return;

		const mql = window.matchMedia('print');
		const onChange = (e: MediaQueryListEvent) => (isPrintMode = e.matches);
		// Also covers Cmd/Ctrl+P: beforeprint fires synchronously before the
		// browser captures the page, so flushSync makes the freshly snapshotted
		// print view real DOM in time.
		const onBefore = () => {
			if (step === 'edit') buildPrintSnapshots();
			isPrintMode = true;
			flushSync();
		};
		const onAfter = () => (isPrintMode = false);

		isPrintMode = mql.matches;
		mql.addEventListener('change', onChange);
		window.addEventListener('beforeprint', onBefore);
		window.addEventListener('afterprint', onAfter);

		return () => {
			mql.removeEventListener('change', onChange);
			window.removeEventListener('beforeprint', onBefore);
			window.removeEventListener('afterprint', onAfter);
		};
	});

	// URL is the source of truth: ?id=X loads the comic into the editor
	// (?step=cover|layout opens that wizard step instead, e.g. "Change cover"
	// from My Comics); no id => new-comic wizard starting at the cover step.
	$effect(() => {
		const stepParam = page.url.searchParams.get('step');
		if (data.comic) {
			if (comicState.comicId !== data.comic.id) {
				suppressNextAutosave = true;
				comicState.hydrate(data.comic);
				sheetCache = new SvelteMap(data.comic.sheets.map((s) => [s.number, s]));
				pageNumbers = data.comic.sheets.map((s) => s.number);
				pendingNewPage = null;
			} else if (untrack(() => sheetCache.size) === 0) {
				// Fresh component mount for a comic that's still loaded in the
				// singleton comicState (e.g. navigating away and back): rebuild
				// the page cache/bar from server data, keeping comicState as is.
				// Union with the current page in case it was added but never
				// reached the server.
				sheetCache = new SvelteMap(data.comic.sheets.map((s) => [s.number, s]));
				pageNumbers = [
					...new Set([...data.comic.sheets.map((s) => s.number), comicState.sheetNumber])
				].sort((a, b) => a - b);
			}
			if (stepParam === 'cover' || stepParam === 'layout') {
				// untrack: typing the new title into the cover form must not
				// re-trigger this effect and clobber the input.
				if (stepParam === 'cover') newComicName = untrack(() => comicState.title);
				step = stepParam;
			} else {
				step = 'edit';
			}
		} else {
			suppressNextAutosave = true;
			comicState.reset();
			newComicName = '';
			lastSavedSnapshot = '';
			saveStatus = 'idle';
			sheetCache = new SvelteMap();
			pageNumbers = [1];
			pendingNewPage = null;
			step = 'cover';
		}
	});

	let publishLoading = $state(false);
	let publishError = $state<string | null>(null);
	let publishModalOpen = $state(false);
	let publishStep = $state('');
	let comicPublicUrl = $state<string | null>(null);
	let urlCopied = $state(false);

	// ── Save / autosave state ───────────────────────────────────────────────
	let saveStatus = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	let lastSavedSnapshot = '';
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressNextAutosave = false;
	// In-flight guard: prevents two saveNow() calls from racing into the same comic.
	let saveInFlight = false;
	// The currently running save, exposed so saveNow() can hand callers a promise
	// that resolves only when the underlying request finishes. Explicit user
	// actions (page switch / new page) await this to guarantee persistence before
	// they swap pages.
	let savePromise: Promise<void> | null = null;
	const AUTOSAVE_DEBOUNCE_MS = 1500;

	function buildSnapshot(): string {
		return JSON.stringify({
			title: comicState.title,
			sheetNumber: comicState.sheetNumber,
			templateId: comicState.templateId,
			panels: comicState.panels.map((p: PanelState) => ({
				stageW: p.stageW,
				stageH: p.stageH,
				bubbles: p.bubbles.map((b) => ({
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					text: b.text,
					type: b.type,
					// Must be included so bring-to-front / send-to-back operations
					// (which only change z_index) trip the dirty check and autosave.
					z_index: b.z_index
				}))
			}))
		});
	}

	// Always returns a promise that resolves once persistence has actually settled,
	// so callers can reliably `await saveNow()` before swapping pages. If a save is
	// already in flight we don't start a parallel POST; we wait for it to finish and
	// then run one more save, guaranteeing the latest edits (made while the first
	// request was in flight) also reach the server before the promise resolves.
	// doSave never throws — it records failures in saveStatus/saveError — so the
	// returned promise resolves rather than rejects; callers check saveStatus.
	function saveNow(): Promise<void> {
		const cid = comicState.comicId;
		if (!cid) return Promise.resolve();
		if (saveInFlight) {
			return (savePromise ?? Promise.resolve()).then(() => saveNow());
		}
		savePromise = doSave(cid);
		return savePromise;
	}

	async function doSave(cid: string): Promise<void> {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		saveInFlight = true;
		const snapshotAtStart = buildSnapshot();
		saveStatus = 'saving';
		saveError = null;
		try {
			const payload = {
				name: comicState.title,
				sheetNumber: comicState.sheetNumber,
				templateId: comicState.templateId,
				panels: comicState.panels.map((p: PanelState, idx: number) => ({
					index: idx + 1,
					w: p.stageW || undefined,
					h: p.stageH || undefined,
					bubbles: p.bubbles
				}))
			};
			const res = await fetch(`/api/comics/${cid}/save`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				saveError = body?.error ?? 'Save failed';
				saveStatus = 'error';
				return;
			}
			lastSavedSnapshot = snapshotAtStart;
			// If the user made more edits while saving, mark dirty so autosave kicks in again
			saveStatus = buildSnapshot() === lastSavedSnapshot ? 'saved' : 'dirty';
		} catch (e: unknown) {
			saveError = (e as Error)?.message ?? 'Save failed';
			saveStatus = 'error';
		} finally {
			saveInFlight = false;
			savePromise = null;
		}
	}

	function scheduleAutosave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTimer = null;
			saveNow();
		}, AUTOSAVE_DEBOUNCE_MS);
	}

	// Cancel any pending autosave when the component unmounts so navigation
	// can't trigger a stray network write after teardown. Also revoke the
	// thumbnail preview blob URL so it doesn't linger in memory until GC.
	onDestroy(() => {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (thumbnailPreviewUrl) {
			URL.revokeObjectURL(thumbnailPreviewUrl);
			thumbnailPreviewUrl = null;
		}
	});

	// Flush pending edits when the user closes the tab or navigates away.
	// sendBeacon is the only POST allowed during unload (regular fetch is killed),
	// so we mirror saveNow()'s payload through it. The user is also prompted to
	// confirm if there are unsaved changes still in flight.
	function hasUnsavedChanges(): boolean {
		if (!comicState.comicId) return false;
		if (saveTimer !== null) return true;
		if (saveInFlight) return true;
		return saveStatus === 'dirty' || saveStatus === 'saving' || saveStatus === 'error';
	}

	function flushSaveBeacon() {
		const cid = comicState.comicId;
		if (!cid) return;
		try {
			const payload = {
				name: comicState.title,
				sheetNumber: comicState.sheetNumber,
				templateId: comicState.templateId,
				panels: comicState.panels.map((p: PanelState, idx: number) => ({
					index: idx + 1,
					w: p.stageW || undefined,
					h: p.stageH || undefined,
					bubbles: p.bubbles
				}))
			};
			const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
			navigator.sendBeacon(`/api/comics/${cid}/save`, blob);
		} catch {
			// sendBeacon can throw on quota; nothing actionable during unload
		}
	}

	$effect(() => {
		if (!browser) return;

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (!hasUnsavedChanges()) return;
			flushSaveBeacon();
			e.preventDefault();
			// Some browsers still require this for the confirmation dialog
			e.returnValue = '';
		};

		// pagehide is more reliable than beforeunload on mobile/iOS Safari
		// for actually firing the beacon when the tab is suspended.
		const handlePageHide = () => {
			if (hasUnsavedChanges()) flushSaveBeacon();
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		window.addEventListener('pagehide', handlePageHide);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('pagehide', handlePageHide);
		};
	});

	// Watch edit state; schedule autosave when the snapshot diverges from the last saved one.
	$effect(() => {
		const cid = comicState.comicId;
		if (!cid || step !== 'edit') {
			// Leaving edit mode (or no comic) — cancel any pending autosave so it
			// can't fire against a stale/reset comicState.
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = null;
			}
			return;
		}
		const snap = buildSnapshot();
		if (snap === lastSavedSnapshot) return;
		if (suppressNextAutosave) {
			suppressNextAutosave = false;
			lastSavedSnapshot = snap;
			saveStatus = 'saved';
			return;
		}
		saveStatus = 'dirty';
		scheduleAutosave();
	});

	async function copyPublicUrl() {
		if (!comicPublicUrl) return;
		try {
			await navigator.clipboard.writeText(comicPublicUrl);
			urlCopied = true;
			setTimeout(() => (urlCopied = false), 2000);
		} catch {
			// fallback: select the input text
		}
	}

	async function publishComic() {
		const comicId = comicState.comicId;
		if (!comicId) {
			publishError = 'Save or upload an image before publishing.';
			publishModalOpen = true;
			publishStep = 'Failed';
			return;
		}
		publishError = null;
		publishModalOpen = true;
		publishStep = 'Starting publish...';
		publishLoading = true;
		try {
			// Send current client-side template and bubbles so server can persist them before publishing
			const payload = {
				sheetNumber: comicState.sheetNumber,
				templateId: comicState.templateId,
				panels: comicState.panels.map((p: PanelState, idx: number) => ({
					index: idx + 1,
					w: p.stageW || undefined,
					h: p.stageH || undefined,
					bubbles: p.bubbles
				}))
			};
			publishStep = 'Publishing';
			const res = await fetch(`/api/comics/${comicId}/publish`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json();
			if (!res.ok) {
				publishError = body?.error ?? 'Publish failed';
				publishStep = 'Failed';
			} else {
				// Build a canonical public URL for the comic (path returned by server)
				if (body?.comic_path) {
					comicPublicUrl = `${location.origin}${body.comic_path}`;
				}
				publishStep = 'Finished';
			}
		} catch (e: unknown) {
			publishError = (e as Error)?.message ?? String(e);
			publishStep = 'Failed';
		} finally {
			publishLoading = false;
		}
	}

	function closePublishModal() {
		publishModalOpen = false;
	}

	async function selectTemplate(id: TemplateId) {
		// "+ Add page" flow: the chosen template belongs to the new page, not
		// the one currently loaded.
		if (pendingNewPage !== null) {
			await createNewPage(id);
			return;
		}
		const newCount = getTemplate(id).panelCount;
		const panelsToRemove = comicState.panels.slice(newCount);
		const wouldLoseContent =
			comicState.hasContent &&
			panelsToRemove.some((p: PanelState) => p.bgImageUrl !== '' || p.bubbles.length > 0);

		if (wouldLoseContent) {
			const dropped = panelsToRemove.length;
			if (
				!confirm(
					`Switching templates will permanently remove the last ${dropped} panel(s) which contain content. Continue?`
				)
			) {
				return;
			}
		}

		// Create a comic first if necessary, then enter edit mode
		await createAndStart(id);
	}

	function goToStep(target: WizardStep) {
		if (target === step) return;
		// Edit step only exists once the comic has been created.
		if (target === 'edit' && !comicState.comicId) return;
		// Navigating the wizard cancels a pending "+ Add page" flow.
		pendingNewPage = null;
		if (target === 'cover') {
			// Re-sync the form with the saved title when (re)opening the cover step.
			if (comicState.comicId) newComicName = comicState.title;
			coverError = null;
		}
		step = target;
	}

	// ── Page (sheet) switching ──────────────────────────────────────────────

	// Mirror the page currently loaded in comicState back into the cache so
	// its edits survive switching to another page.
	function stashCurrentSheet() {
		sheetCache.set(comicState.sheetNumber, {
			number: comicState.sheetNumber,
			templateSlug: comicState.templateId,
			panels: comicState.panels.map((p: PanelState, idx: number) => ({
				index: idx + 1,
				imageUrl: p.bgImageUrl || null,
				bubbles: p.bubbles.map((b) => ({ ...b }))
			}))
		});
	}

	// Page number a save-then-switch is waiting on; drives the spinner in the
	// page bar and blocks concurrent switches while the save is in flight.
	let switchingToPage = $state<number | null>(null);

	async function switchPage(n: number) {
		if (n === comicState.sheetNumber || switchingToPage !== null) return;
		const target = sheetCache.get(n);
		if (!target) return;
		// Save the page being left before swapping it out — its edits only
		// live in comicState. Block the switch if the save fails so nothing
		// is stranded. When the page has no unsaved edits (and no save is in
		// flight), skip the round trip so the switch is instant.
		stashCurrentSheet();
		if (saveInFlight || buildSnapshot() !== lastSavedSnapshot) {
			switchingToPage = n;
			try {
				await saveNow();
			} finally {
				switchingToPage = null;
			}
			if (saveStatus === 'error') return;
		}
		suppressNextAutosave = true;
		comicState.loadSheet(target);
	}

	function addPage() {
		const next = Math.max(...pageNumbers, comicState.sheetNumber) + 1;
		// Enforce the shared cap so we never create a page the API would reject
		// (or, previously, silently clamp onto an existing page).
		if (next > MAX_SHEETS) {
			pageBarError = `A comic can have at most ${MAX_SHEETS} pages.`;
			return;
		}
		pageBarError = null;
		pendingNewPage = next;
		step = 'layout';
	}

	async function createNewPage(templateId: TemplateId) {
		const number = pendingNewPage;
		if (number === null || addingPage) return;
		addingPage = true;
		try {
			stashCurrentSheet();
			await saveNow();
			if (saveStatus === 'error') {
				createError = saveError ?? 'Could not save the current page. Please try again.';
				return;
			}
			const sheet: SheetData = { number, templateSlug: templateId, panels: [] };
			sheetCache.set(number, sheet);
			// Set-dedupe: belt and braces against the same number sneaking in
			// twice (duplicate keys crash the page bar's keyed each).
			pageNumbers = [...new Set([...pageNumbers, number])].sort((a, b) => a - b);
			suppressNextAutosave = true;
			comicState.loadSheet(sheet);
			pendingNewPage = null;
			step = 'edit';
			// Persist the new (empty) sheet right away so it exists server-side
			// with its template even if the user navigates off without editing.
			await saveNow();
		} finally {
			addingPage = false;
		}
	}

	function cancelAddPage() {
		pendingNewPage = null;
		step = 'edit';
	}

	async function deleteCurrentPage() {
		const cid = comicState.comicId;
		const n = comicState.sheetNumber;
		if (!cid || deletingPage || pageNumbers.length <= 1) return;
		if (!confirm(`Delete page ${n}? Its panels, images and speech bubbles will be lost.`)) {
			return;
		}
		deletingPage = true;
		pageBarError = null;
		try {
			// The page is going away: cancel its pending autosave and wait out any
			// in-flight save, so a late save (which upserts the sheet) can't
			// recreate the row server-side after the delete.
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = null;
			}
			await (savePromise ?? Promise.resolve());
			const res = await fetch(`/api/comics/${cid}/sheets/${n}`, { method: 'DELETE' });
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				pageBarError = body?.error ?? 'Could not delete the page. Please try again.';
				return;
			}
			// Mirror the server: drop the page and apply its renumbering (later
			// pages shift down one). Order is preserved, so the remaining old
			// numbers map positionally onto the server-reported new ones; if the
			// server couldn't report them, compute the expected shift locally.
			const deletedPos = pageNumbers.indexOf(n);
			const oldNumbers = pageNumbers.filter((p) => p !== n);
			const newNumbers: number[] =
				Array.isArray(body?.pageNumbers) && body.pageNumbers.length === oldNumbers.length
					? body.pageNumbers
					: oldNumbers.map((p) => (p > n ? p - 1 : p));
			const remapped = new SvelteMap<number, SheetData>();
			oldNumbers.forEach((oldN, i) => {
				const sheet = sheetCache.get(oldN);
				if (!sheet) return;
				sheet.number = newNumbers[i];
				remapped.set(newNumbers[i], sheet);
			});
			sheetCache = remapped;
			pageNumbers = [...newNumbers];
			// Show the page that took the deleted page's place (or the new last page).
			const target = sheetCache.get(
				newNumbers[Math.min(Math.max(deletedPos, 0), newNumbers.length - 1)]
			);
			if (target) {
				suppressNextAutosave = true;
				comicState.loadSheet(target);
			}
		} catch (e: unknown) {
			console.error('deleteCurrentPage failed', e);
			pageBarError = 'Network error. Please check your connection and try again.';
		} finally {
			deletingPage = false;
		}
	}

	// Persist title + cover changes for an existing comic, then move on.
	// For a brand-new comic nothing exists server-side yet, so the cover step
	// just collects local state and createAndStart() persists it on creation.
	async function saveCoverAndContinue(nextStep: 'edit' | 'layout') {
		const cid = comicState.comicId;
		if (!cid) {
			step = 'layout';
			return;
		}
		savingCover = true;
		coverError = null;
		try {
			comicState.setTitle(newComicName.trim() || 'Untitled');
			await saveNow();
			if (saveStatus === 'error') {
				coverError = saveError ?? 'Could not save changes. Please try again.';
				return;
			}
			if (thumbnailFile) {
				const fd = new FormData();
				fd.append('file', thumbnailFile);
				const res = await fetch(`/api/comics/${cid}/thumbnail`, { method: 'POST', body: fd });
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					coverError = body?.error ?? 'Could not save the cover image. Please try again.';
					return;
				}
				thumbnailFile = null;
				if (thumbnailPreviewUrl) {
					URL.revokeObjectURL(thumbnailPreviewUrl);
					thumbnailPreviewUrl = null;
				}
			}
			// Refresh server data (new signed cover URL) and drop any ?step=
			// param so a reload lands back in the editor, not the wizard.
			if (page.url.searchParams.has('step')) {
				await goto(resolve(`/comic?id=${cid}`), { replaceState: true, noScroll: true });
			} else {
				await invalidateAll();
			}
			step = nextStep;
		} catch (e: unknown) {
			console.error('saveCoverAndContinue failed', e);
			coverError = 'Network error. Please check your connection and try again.';
		} finally {
			savingCover = false;
		}
	}

	// Leave the cover step without persisting anything: discard the pending
	// cover file selection and the (possibly edited) title field.
	function cancelCoverEdit() {
		removeThumbnail();
		coverError = null;
		if (comicState.comicId) newComicName = comicState.title;
		step = 'edit';
	}

	function handleThumbnailChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) return;
		thumbnailFile = file;
		if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
		thumbnailPreviewUrl = URL.createObjectURL(file);
	}

	function removeThumbnail() {
		thumbnailFile = null;
		if (thumbnailPreviewUrl) {
			URL.revokeObjectURL(thumbnailPreviewUrl);
			thumbnailPreviewUrl = null;
		}
	}

	async function createAndStart(templateId: TemplateId) {
		// If we already have a comicId, just switch template and go to edit
		if (comicState.comicId) {
			comicState.setTemplate(templateId);
			step = 'edit';
			return;
		}

		creatingComic = true;
		createError = null;
		try {
			const res = await fetch('/api/comics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newComicName || 'Untitled' })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				createError = body?.error ?? 'Could not create comic. Please try again.';
				return;
			}
			const newId = body.id;

			// Upload thumbnail if the user selected one
			if (thumbnailFile) {
				const fd = new FormData();
				fd.append('file', thumbnailFile);
				await fetch(`/api/comics/${newId}/thumbnail`, { method: 'POST', body: fd });
			}

			suppressNextAutosave = true;
			comicState.setComicId(newId);
			comicState.setTitle(newComicName || 'Untitled');
			comicState.setTemplate(templateId);
			step = 'edit';
			// Thumbnail preview is no longer displayed after we switch to edit mode —
			// revoke the blob URL now instead of waiting for component teardown.
			if (thumbnailPreviewUrl) {
				URL.revokeObjectURL(thumbnailPreviewUrl);
				thumbnailPreviewUrl = null;
			}
			thumbnailFile = null;
			// Reflect the new comic in the URL so reloads / navigation hydrate correctly
			await goto(resolve(`/comic?id=${newId}`), { replaceState: true, noScroll: true });
		} catch (e: unknown) {
			console.error('createAndStart failed', e);
			createError = 'Network error. Please check your connection and try again.';
		} finally {
			creatingComic = false;
		}
	}

	// Reactively sync local textarea text when active bubble changes
	$effect(() => {
		const activeB = comicState.activeBubble;
		if (activeB) {
			bubbleText = activeB.text;
		} else {
			bubbleText = '';
		}
	});

	function handleTextChange(e: Event) {
		const val = (e.target as HTMLTextAreaElement).value;
		bubbleText = val;
		if (comicState.activeBubble) {
			comicState.updateActiveBubbleText(val);
		}
	}

	function handleAddBubble(type: BubbleType) {
		if (comicState.activePanelIndex === undefined) return;
		const text = bubbleText.trim() !== '' ? bubbleText : 'Bubble Text';
		comicState.addBubble(type, text);
	}
</script>

<div class="app-container no-print">
	<!-- Wizard: cover + layout steps -->
	{#if step === 'cover' || step === 'layout'}
		<div class="template-picker">
			<div class="picker-form">
				<nav class="wizard-steps" aria-label="Comic setup steps">
					<button
						type="button"
						class="wizard-step"
						class:active={step === 'cover'}
						onclick={() => goToStep('cover')}
					>
						<span class="wizard-step-num">1</span> Cover
					</button>
					<span class="wizard-arrow" aria-hidden="true">→</span>
					<button
						type="button"
						class="wizard-step"
						class:active={step === 'layout'}
						onclick={() => goToStep('layout')}
					>
						<span class="wizard-step-num">2</span> Page layout
					</button>
					<span class="wizard-arrow" aria-hidden="true">→</span>
					<button
						type="button"
						class="wizard-step"
						disabled={!comicState.comicId}
						onclick={() => goToStep('edit')}
					>
						<span class="wizard-step-num">3</span> Edit page
					</button>
				</nav>

				{#if step === 'cover'}
					<div>
						<h2 class="picker-title">
							{comicState.comicId ? 'Title & cover' : 'Create a new comic'}
						</h2>
						<p class="picker-subtitle">
							{comicState.comicId
								? 'Update the comic title and cover image'
								: 'Give it a name and an optional cover, then pick a layout'}
						</p>
					</div>

					<div class="form-row">
						<label for="new-comic-name" class="form-label">Comic Title</label>
						<input
							id="new-comic-name"
							type="text"
							class="form-input"
							bind:value={newComicName}
							placeholder="My awesome comic"
						/>
					</div>

					<div class="form-row">
						<span class="form-label"
							>Cover Image <span class="form-label-hint">(optional)</span></span
						>
						{#if thumbnailPreviewUrl}
							<div class="thumb-preview-wrap">
								<img src={thumbnailPreviewUrl} alt="New cover preview" class="thumb-preview" />
								<button class="thumb-remove" onclick={removeThumbnail} title="Remove">×</button>
							</div>
						{:else if existingCoverUrl}
							<div class="thumb-preview-wrap">
								<img src={existingCoverUrl} alt="Current cover" class="thumb-preview" />
							</div>
							<label class="thumb-replace" for="thumbnail-input">Replace cover image</label>
						{:else}
							<label class="thumb-dropzone" for="thumbnail-input">
								<span class="thumb-icon">🖼</span>
								<span class="thumb-label">Click to upload cover image</span>
								<span class="thumb-hint">JPG · PNG · WebP · recommended 3:4</span>
							</label>
						{/if}
						<input
							id="thumbnail-input"
							type="file"
							accept="image/*"
							class="visually-hidden"
							onchange={handleThumbnailChange}
						/>
					</div>

					{#if coverError}
						<div class="create-error" role="alert" aria-live="assertive">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							<span>{coverError}</span>
							<button
								type="button"
								class="create-error-close"
								aria-label="Dismiss"
								onclick={() => (coverError = null)}>×</button
							>
						</div>
					{/if}

					<div class="wizard-actions">
						{#if comicState.comicId}
							<button
								class="wizard-btn wizard-btn-primary"
								onclick={() => saveCoverAndContinue('edit')}
								disabled={savingCover}
							>
								{savingCover ? 'Saving…' : 'Save & continue editing'}
							</button>
							<button
								class="wizard-btn wizard-btn-secondary"
								onclick={() => saveCoverAndContinue('layout')}
								disabled={savingCover}
							>
								{savingCover ? 'Saving…' : 'Save & change layout'}
							</button>
							<button
								class="wizard-btn wizard-btn-ghost"
								onclick={cancelCoverEdit}
								disabled={savingCover}
							>
								Cancel
							</button>
						{:else}
							<button class="wizard-btn wizard-btn-primary" onclick={() => goToStep('layout')}>
								Next: choose a layout →
							</button>
						{/if}
					</div>
				{:else}
					<div>
						<h2 class="picker-title">
							{pendingNewPage !== null
								? `Choose a layout for page ${pendingNewPage}`
								: 'Choose a page layout'}
						</h2>
						<p class="picker-subtitle">
							{pendingNewPage !== null
								? 'The new page is added to your comic as soon as you pick a layout'
								: comicState.comicId
									? 'Pick a new layout for this page, or keep the current one'
									: 'Pick how the panels are arranged — editing starts right after'}
						</p>
					</div>

					{#if createError}
						<div class="create-error" role="alert" aria-live="assertive">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							<span>{createError}</span>
							<button
								type="button"
								class="create-error-close"
								aria-label="Dismiss"
								onclick={() => (createError = null)}>×</button
							>
						</div>
					{/if}

					<div class="template-cards">
						{#each TEMPLATES as template (template.id)}
							<button
								class="template-card"
								class:template-card-current={pendingNewPage === null &&
									comicState.comicId !== null &&
									template.id === comicState.templateId}
								onclick={() => selectTemplate(template.id)}
								disabled={creatingComic || addingPage}
							>
								<div class="preview-grid {template.previewClass}">
									{#each { length: template.panelCount }, i (i)}
										<div class="preview-cell"></div>
									{/each}
								</div>
								<div class="template-card-info">
									<span class="template-name">{template.name}</span>
									<span class="template-desc">{template.description}</span>
								</div>
							</button>
						{/each}
					</div>

					<div class="wizard-actions">
						{#if pendingNewPage !== null}
							<button
								class="wizard-btn wizard-btn-ghost"
								onclick={cancelAddPage}
								disabled={addingPage}
							>
								Cancel — back to the editor
							</button>
						{:else}
							{#if comicState.comicId}
								<button class="wizard-btn wizard-btn-primary" onclick={() => goToStep('edit')}>
									Keep current layout →
								</button>
							{/if}
							<button
								class="wizard-btn wizard-btn-ghost"
								onclick={() => goToStep('cover')}
								disabled={creatingComic}
							>
								← Back to cover
							</button>
						{/if}
					</div>

					{#if creatingComic}
						<div class="creating-label">Creating your comic…</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Main Workspace -->
	{#if step === 'edit'}
		<main class="studio-layout">
			<!-- Canvas Grid -->
			<section class="canvas-workspace">
				<div class="workspace-inner">
					{#if comicState.comicId}
						<nav class="page-bar" aria-label="Comic pages">
							{#each pageNumbers as n (n)}
								<button
									class="page-tab"
									class:active={n === comicState.sheetNumber}
									onclick={() => switchPage(n)}
									disabled={switchingToPage !== null}
								>
									Page {n}
									{#if switchingToPage === n}
										<span class="page-tab-spinner" aria-label="Saving…"></span>
									{/if}
								</button>
							{/each}
							<button
								class="page-tab page-tab-add"
								onclick={addPage}
								disabled={atPageCap}
								title={atPageCap ? `Maximum of ${MAX_SHEETS} pages reached` : 'Add a new page'}
							>
								+ Add page
							</button>
							<button
								class="page-tab page-tab-delete"
								onclick={deleteCurrentPage}
								disabled={pageNumbers.length <= 1 || deletingPage}
								title={pageNumbers.length <= 1
									? 'A comic must keep at least one page'
									: `Delete page ${comicState.sheetNumber}`}
							>
								{deletingPage ? 'Deleting…' : '🗑 Delete page'}
							</button>
						</nav>
						{#if pageBarError}
							<p class="page-bar-error" role="alert">{pageBarError}</p>
						{/if}
					{/if}
					<div class="comic-grid {getTemplate(comicState.templateId).layoutClass}">
						{#each comicState.panels as _panel, i (i)}
							<Panel index={i} />
						{/each}
					</div>
				</div>
			</section>

			<!-- Inspector Sidebar -->
			<aside class="control-sidebar">
				<div class="sidebar-card comic-title-card">
					<span class="comic-title-text" title={comicState.title}>{comicState.title}</span>
					<button
						class="comic-title-edit"
						onclick={() => goToStep('cover')}
						title="Change title & cover"
						aria-label="Change title & cover">✎</button
					>
				</div>
				<div class="sidebar-card">
					<label for="bubble-text-editor" class="card-label">Bubble Text:</label>
					<textarea
						id="bubble-text-editor"
						class="bubble-textarea"
						placeholder="Type speech bubble text here..."
						value={bubbleText}
						oninput={handleTextChange}
					></textarea>
					<div class="bubble-palette-grid">
						<BubbleButton
							type="left-oval"
							label="Left Oval"
							onclick={() => handleAddBubble('left-oval')}
						/>
						<BubbleButton
							type="right-oval"
							label="Right Oval"
							onclick={() => handleAddBubble('right-oval')}
						/>
						<BubbleButton
							type="left-cloud"
							label="Left Cloud"
							onclick={() => handleAddBubble('left-cloud')}
						/>
						<BubbleButton
							type="right-cloud"
							label="Right Cloud"
							onclick={() => handleAddBubble('right-cloud')}
						/>
						<BubbleButton
							type="box-izq"
							label="Left Box"
							onclick={() => handleAddBubble('box-izq')}
						/>
						<BubbleButton
							type="box-der"
							label="Right Box"
							onclick={() => handleAddBubble('box-der')}
						/>
						<BubbleButton type="box" label="Box" onclick={() => handleAddBubble('box')} />
						<BubbleButton type="burst" label="Burst" onclick={() => handleAddBubble('burst')} />
					</div>

					<button class="save-button" onclick={saveNow} disabled={saveStatus === 'saving'}>
						{#if saveStatus === 'saving'}Saving…{:else}Save{/if}
					</button>
					<div class="save-status" data-status={saveStatus}>
						{#if saveStatus === 'saving'}
							<span class="save-dot" aria-hidden="true"></span> Saving…
						{:else if saveStatus === 'saved'}
							<span class="save-check" aria-hidden="true">✓</span> All changes saved
						{:else if saveStatus === 'dirty'}
							<span class="save-dot save-dot-dirty" aria-hidden="true"></span> Unsaved changes
						{:else if saveStatus === 'error'}
							<span class="save-x" aria-hidden="true">!</span>
							{saveError ?? 'Save failed'}
						{/if}
					</div>
					<button class="publish-button" onclick={publishComic} disabled={publishLoading}>
						{#if publishLoading}Publishing...{:else}Publish{/if}
					</button>
					{#if publishError}
						<div style="margin-top:8px;color:#b91c1c">{publishError}</div>
					{/if}
					<button class="print-button" onclick={printComic}>🖨 Print</button>
					<p class="print-hint">
						Prints the current page — choose “Save as PDF” in the dialog to export
					</p>
				</div>
			</aside>
		</main>
	{/if}

	{#if publishModalOpen}
		<div
			class="modal-backdrop"
			onclick={(e) => {
				if (e.target === e.currentTarget && !publishLoading) closePublishModal();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape' && !publishLoading) closePublishModal();
			}}
			role="dialog"
			aria-modal="true"
			aria-live="polite"
			tabindex={-1}
		>
			<div class="modal-card">
				{#if publishLoading}
					<div class="modal-loading">
						<div class="spinner"></div>
						<p class="modal-loading-title">Publishing…</p>
						<p class="modal-loading-step">{publishStep}</p>
					</div>
				{:else if publishError}
					<div class="modal-icon modal-icon-error">✕</div>
					<h2 class="modal-title">Publish failed</h2>
					<p class="modal-error-msg">{publishError}</p>
					<div class="modal-actions">
						<button class="modal-btn modal-btn-secondary" onclick={closePublishModal}
							>Dismiss</button
						>
					</div>
				{:else}
					<button class="modal-close-x" onclick={closePublishModal} title="Close">✕</button>
					<div class="modal-icon modal-icon-success">✓</div>
					<h2 class="modal-title">Comic published!</h2>
					<p class="modal-subtitle">Your comic is live and ready to share.</p>

					{#if comicPublicUrl}
						<div class="modal-url-row">
							<input
								class="modal-url-input"
								type="text"
								readonly
								value={comicPublicUrl}
								onclick={(e) => (e.target as HTMLInputElement).select()}
							/>
							<button class="modal-copy-btn" onclick={copyPublicUrl} title="Copy link">
								{#if urlCopied}✓{:else}📋{/if}
							</button>
						</div>
						{#if urlCopied}
							<span class="modal-copied-hint">Copied!</span>
						{/if}
					{/if}

					<div class="modal-actions">
						{#if comicPublicUrl}
							<a
								href={comicPublicUrl}
								target="_blank"
								rel="external noreferrer noopener"
								class="modal-btn modal-btn-primary">View Comic ↗</a
							>
						{/if}
						<button class="modal-btn modal-btn-secondary" onclick={closePublishModal}>Done</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Print View -->
{#if isPrintMode}
	<div class="print-only">
		<div class="print-comic-grid {getTemplate(comicState.templateId).printLayoutClass}">
			{#each comicState.panels as panel, i (i)}
				<!-- Prefer the flattened stage snapshot (background + bubbles + text);
					 fall back to the raw background image if the snapshot failed. -->
				{@const printSrc = printSnapshots[i] ?? panel.bgImageUrl}
				{#if printSrc}
					<img src={printSrc} alt="Panel {i + 1}" class="print-panel" />
				{:else}
					<div class="print-panel print-panel-empty"></div>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background-color: #fff;
		margin: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	:global(.container) {
		padding: 0 !important;
		margin: 0 !important;
		max-width: 100% !important;
		width: 100% !important;
	}

	.app-container {
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - 64px);
	}

	/* ── Template Picker ── */
	.template-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		flex: 1;
		background: #f8fafc;
		padding: 40px 16px;
	}

	.picker-form {
		width: 100%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* ── Wizard chrome ── */
	.wizard-steps {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.wizard-step {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		border: 2px solid #e2e8f0;
		border-radius: 999px;
		background: #fff;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.wizard-step:hover:not([disabled]) {
		border-color: #007f8a;
		color: #007f8a;
	}

	.wizard-step.active {
		border-color: #007f8a;
		background: #f0fdfc;
		color: #007f8a;
	}

	.wizard-step[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.wizard-step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #e2e8f0;
		color: #475569;
		font-size: 0.75rem;
		font-weight: 800;
	}

	.wizard-step.active .wizard-step-num {
		background: #007f8a;
		color: #fff;
	}

	.wizard-arrow {
		color: #cbd5e1;
		font-weight: 700;
	}

	.wizard-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}

	.wizard-btn {
		padding: 10px 20px;
		border-radius: 8px;
		font-size: 0.92rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		border: 2px solid transparent;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.wizard-btn[disabled] {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.wizard-btn-primary {
		background: #007f8a;
		color: #fff;
	}

	.wizard-btn-primary:hover:not([disabled]) {
		background: #005f68;
	}

	.wizard-btn-secondary {
		background: #fff;
		color: #007f8a;
		border-color: #007f8a;
	}

	.wizard-btn-secondary:hover:not([disabled]) {
		background: #f0fdfc;
	}

	.wizard-btn-ghost {
		background: none;
		color: #64748b;
	}

	.wizard-btn-ghost:hover:not([disabled]) {
		color: #0f172a;
	}

	.thumb-replace {
		align-self: flex-start;
		font-size: 0.85rem;
		font-weight: 700;
		color: #007f8a;
		cursor: pointer;
		text-decoration: underline;
	}

	.thumb-replace:hover {
		color: #005f68;
	}

	.picker-title {
		margin: 0 0 4px;
		font-size: 1.8rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.03em;
	}

	.picker-subtitle {
		margin: 0;
		font-size: 0.95rem;
		color: #64748b;
		font-weight: 400;
	}

	/* Form fields */
	.form-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 700;
		color: #334155;
		letter-spacing: 0.02em;
	}

	.form-label-hint {
		font-weight: 400;
		color: #94a3b8;
	}

	.form-input {
		width: 100%;
		padding: 10px 14px;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		font-size: 1rem;
		font-family: inherit;
		background: #fff;
		box-sizing: border-box;
		transition: border-color 0.15s;
		color: #0f172a;
	}

	.form-input:focus {
		outline: none;
		border-color: #007f8a;
	}

	/* Thumbnail */
	.thumb-dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 28px 16px;
		border: 2px dashed #cbd5e1;
		border-radius: 12px;
		cursor: pointer;
		background: #fff;
		transition:
			border-color 0.15s,
			background 0.15s;
		text-align: center;
	}

	.thumb-dropzone:hover {
		border-color: #007f8a;
		background: #f0fdfc;
	}

	.thumb-icon {
		font-size: 1.8rem;
	}

	.thumb-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: #334155;
	}

	.thumb-hint {
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.thumb-preview-wrap {
		position: relative;
		display: inline-block;
		max-width: 200px;
	}

	.thumb-preview {
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border-radius: 10px;
		border: 2px solid #e2e8f0;
		display: block;
	}

	.thumb-remove {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #be123c;
		color: #fff;
		border: none;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Divider above template cards */
	.form-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #94a3b8;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.form-divider::before,
	.form-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	.template-cards {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		justify-content: center;
		/* Break out of .picker-form's 600px max-width so up to 4 cards
		   (4 × 260px + 3 × 20px gap = 1100px) fit per row on wide screens.
		   Falls back to the viewport width minus side padding on smaller screens. */
		width: min(1100px, calc(100vw - 32px));
		position: relative;
		left: 50%;
		transform: translateX(-50%);
	}

	.create-error {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		margin-bottom: 0.6rem;
		background: #fee2e2;
		color: #991b1b;
		border: 2.5px solid #1a237e;
		border-radius: 10px;
		box-shadow: 3px 3px 0 #3f51b5;
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.35;
	}

	.create-error svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: #991b1b;
		margin-top: 1px;
	}

	.create-error span {
		flex: 1;
		min-width: 0;
		word-break: break-word;
	}

	.create-error-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: #991b1b;
		font-size: 1.4rem;
		line-height: 1;
		font-weight: 800;
		cursor: pointer;
		padding: 0 0.25rem;
		margin: -2px -2px 0 0;
	}

	.create-error-close:hover {
		color: #1a237e;
	}

	.creating-label {
		text-align: center;
		font-size: 0.9rem;
		color: #007f8a;
		font-weight: 600;
	}

	.template-card {
		width: 260px;
		padding: 24px;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 16px;
		cursor: pointer;
		transition: all 0.18s ease;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
		text-align: left;
		font-family: inherit;
	}

	.template-card:hover {
		border-color: #007f8a;
		transform: translateY(-3px) scale(1.01);
		box-shadow: 0 12px 32px rgba(0, 127, 138, 0.14);
	}

	.template-card:active {
		transform: translateY(0) scale(0.99);
	}

	/* Layout currently saved for this comic */
	.template-card-current {
		border-color: #007f8a;
		box-shadow: 0 0 0 3px rgba(0, 127, 138, 0.15);
	}

	/* Preview grids */
	.preview-grid {
		width: 100%;
		aspect-ratio: 3 / 4;
		display: grid;
		gap: 4px;
		background: #e2e8f0;
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 16px;
		padding: 4px;
		box-sizing: border-box;
	}

	.preview-cell {
		background: #f1f5f9;
		border-radius: 3px;
		border: 1px solid #cbd5e1;
	}

	.preview-3x3 {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
	}

	.preview-page {
		grid-template-columns: repeat(6, 1fr);
	}

	.preview-page .preview-cell:nth-child(1) {
		grid-column: 1 / -1;
	}

	.preview-page .preview-cell:nth-child(2),
	.preview-page .preview-cell:nth-child(3) {
		grid-column: span 3;
	}

	.preview-page .preview-cell:nth-child(4),
	.preview-page .preview-cell:nth-child(5),
	.preview-page .preview-cell:nth-child(6) {
		grid-column: span 2;
	}

	.preview-strip {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: 1fr;
	}

	.preview-vertical {
		grid-template-columns: 1fr;
		grid-template-rows: repeat(4, 1fr);
	}

	.preview-hero {
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: 2fr 1fr;
	}

	.preview-hero .preview-cell:nth-child(1) {
		grid-column: 1 / -1;
	}

	.template-card-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.template-name {
		font-size: 1rem;
		font-weight: 700;
		color: #0f172a;
	}

	.template-desc {
		font-size: 0.85rem;
		color: #64748b;
	}

	/* ── Studio Layout (editor) ── */
	.studio-layout {
		display: grid;
		grid-template-columns: 1fr 320px;
		flex: 1;
		overflow: hidden;
		height: calc(100dvh - 64px);
	}

	.canvas-workspace {
		background: #f1f5f9;
		padding: 24px;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	.workspace-inner {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* ── Page bar ── */
	.page-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.page-tab {
		padding: 6px 14px;
		border: 2px solid #cbd5e1;
		border-radius: 999px;
		background: #fff;
		color: #475569;
		font-size: 0.85rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition:
			border-color 0.12s,
			color 0.12s,
			background 0.12s;
	}

	.page-tab:hover {
		border-color: #007f8a;
		color: #007f8a;
	}

	.page-tab.active {
		background: #007f8a;
		border-color: #007f8a;
		color: #fff;
	}

	.page-tab-add {
		border-style: dashed;
	}

	.page-tab-delete {
		border-style: dashed;
	}

	.page-tab-delete:hover:not(:disabled) {
		border-color: #be123c;
		color: #be123c;
	}

	.page-tab:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.page-tab-spinner {
		display: inline-block;
		width: 0.85em;
		height: 0.85em;
		margin-left: 6px;
		vertical-align: -0.1em;
		border-radius: 50%;
		border: 2px solid #cbd5e1;
		border-top-color: #007f8a;
		animation: spin 0.8s linear infinite;
	}

	.page-tab:disabled:hover {
		border-color: #cbd5e1;
		color: #475569;
	}

	.page-bar-error {
		margin: 6px 0 0;
		color: #991b1b;
		font-size: 0.85rem;
		font-weight: 700;
	}

	/* ── Comic Grids ── */

	/* Template A: Classic 3×3 */
	.comic-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		width: 100%;
	}

	.comic-grid :global(.panel-container) {
		aspect-ratio: 3 / 4;
		height: auto;
	}

	/* Template B: Page Layout (1+2+3) */
	.comic-grid.template-page {
		grid-template-columns: repeat(6, 1fr);
	}

	.comic-grid.template-page :global(.panel-container:nth-child(1)) {
		grid-column: 1 / -1;
		aspect-ratio: 16 / 7;
	}

	.comic-grid.template-page :global(.panel-container:nth-child(2)),
	.comic-grid.template-page :global(.panel-container:nth-child(3)) {
		grid-column: span 3;
		aspect-ratio: 3 / 4;
	}

	.comic-grid.template-page :global(.panel-container:nth-child(4)),
	.comic-grid.template-page :global(.panel-container:nth-child(5)),
	.comic-grid.template-page :global(.panel-container:nth-child(6)) {
		grid-column: span 2;
		aspect-ratio: 3 / 4;
	}

	/* Template C: Sunday Strip — 3 wide panels in one row */
	.comic-grid.template-strip {
		grid-template-columns: repeat(3, 1fr);
	}

	.comic-grid.template-strip :global(.panel-container) {
		aspect-ratio: 4 / 3;
	}

	/* Template D: Webtoon Vertical — 4 panels stacked, narrow column */
	.comic-grid.template-vertical {
		grid-template-columns: 1fr;
		max-width: 520px;
		margin: 0 auto;
	}

	.comic-grid.template-vertical :global(.panel-container) {
		aspect-ratio: 16 / 9;
	}

	/* Template E: Action Spread — 1 hero panel + 4 reactions */
	.comic-grid.template-hero {
		grid-template-columns: repeat(4, 1fr);
	}

	.comic-grid.template-hero :global(.panel-container:nth-child(1)) {
		grid-column: 1 / -1;
		aspect-ratio: 16 / 7;
	}

	.comic-grid.template-hero :global(.panel-container:nth-child(n + 2)) {
		aspect-ratio: 1 / 1;
	}

	/* Responsive — tablet */
	@media (max-width: 900px) {
		.studio-layout {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}

		.comic-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.comic-grid.template-page :global(.panel-container:nth-child(n + 4)) {
			grid-column: span 3;
		}

		.comic-grid.template-hero {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Responsive — phone */
	@media (max-width: 540px) {
		.comic-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.comic-grid.template-page :global(.panel-container) {
			grid-column: 1 / -1;
			aspect-ratio: 4 / 3;
		}

		.comic-grid.template-strip,
		.comic-grid.template-hero {
			grid-template-columns: 1fr;
		}

		.comic-grid.template-hero :global(.panel-container:nth-child(n + 2)) {
			aspect-ratio: 4 / 3;
		}
	}

	/* ── Sidebar ── */
	.control-sidebar {
		padding-left: 10px;
		padding-right: 10px;
		background: #ffffff;
		border-left: 1px solid #e2e8f0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	@media (max-width: 900px) {
		.control-sidebar {
			border-left: none;
			border-top: 1px solid #e2e8f0;
			max-height: 260px;
		}
	}

	.sidebar-card {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.comic-title-card {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 16px;
		margin-top: 16px;
	}

	.comic-title-text {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.comic-title-edit {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #fff;
		color: #475569;
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			border-color 0.12s,
			color 0.12s;
	}

	.comic-title-edit:hover {
		border-color: #007f8a;
		color: #007f8a;
	}

	.card-label {
		font-size: 13px;
		font-weight: 700;
		color: #334155;
	}

	.bubble-textarea {
		width: 100%;
		min-height: 80px;
		max-height: 140px;
		padding: 10px;
		border: 2px solid #cbd5e1;
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		box-sizing: border-box;
		resize: vertical;
		transition: border-color 0.2s;
	}

	.bubble-textarea:focus {
		outline: none;
		border-color: #2563eb;
	}

	.bubble-palette-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.publish-button {
		width: 100%;
		padding: 10px 12px;
		background: #2563eb;
		border: none;
		color: white;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
	}
	.publish-button[disabled] {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.print-button {
		width: 100%;
		margin-top: 8px;
		padding: 10px 12px;
		background: #fff;
		border: 2px solid #334155;
		color: #334155;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition:
			background 0.12s,
			color 0.12s;
	}

	.print-button:hover {
		background: #334155;
		color: #fff;
	}

	.print-hint {
		margin: 4px 0 0;
		font-size: 0.72rem;
		color: #94a3b8;
		text-align: center;
	}

	.save-button {
		width: 100%;
		padding: 10px 12px;
		background: #166534;
		color: #fff;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition:
			background 0.12s,
			color 0.12s;
		margin-bottom: 8px;
	}
	.save-button:hover:not([disabled]) {
		background: #1a237e;
		color: #ffffff;
	}
	.save-button[disabled] {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.save-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		color: #64748b;
		min-height: 18px;
		margin-bottom: 12px;
	}
	.save-status[data-status='saved'] {
		color: #16a34a;
	}
	.save-status[data-status='error'] {
		color: #b91c1c;
	}
	.save-status[data-status='dirty'] {
		color: #b45309;
	}
	.save-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #94a3b8;
		animation: save-pulse 1s ease-in-out infinite;
	}
	.save-dot-dirty {
		background: #f59e0b;
		animation: none;
	}
	.save-check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #16a34a;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}
	.save-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #b91c1c;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}
	@keyframes save-pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	/* ── Publish modal ── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 500;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.modal-card {
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		padding: 40px 36px 32px;
		width: 100%;
		max-width: 440px;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
		animation: modal-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.88) translateY(16px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-close-x {
		position: absolute;
		top: 14px;
		right: 14px;
		background: #f1f5f9;
		border: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 0.8rem;
		cursor: pointer;
		color: #64748b;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.12s;
	}
	.modal-close-x:hover {
		background: #e2e8f0;
	}

	.modal-icon {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		font-weight: 900;
		margin-bottom: 4px;
	}
	.modal-icon-success {
		background: #dcfce7;
		color: #16a34a;
	}
	.modal-icon-error {
		background: #fee2e2;
		color: #dc2626;
	}

	.modal-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
	}

	.modal-subtitle {
		margin: 0;
		font-size: 0.9rem;
		color: #64748b;
	}

	.modal-error-msg {
		margin: 0;
		font-size: 0.9rem;
		color: #dc2626;
		word-break: break-word;
	}

	/* URL row */
	.modal-url-row {
		display: flex;
		width: 100%;
		border: 1.5px solid #e2e8f0;
		border-radius: 10px;
		overflow: hidden;
		margin-top: 4px;
	}

	.modal-url-input {
		flex: 1;
		padding: 9px 12px;
		border: none;
		outline: none;
		font-size: 0.8rem;
		color: #334155;
		background: #f8fafc;
		font-family: 'SF Mono', 'Fira Code', monospace;
		min-width: 0;
		cursor: text;
	}

	.modal-copy-btn {
		padding: 0 14px;
		border: none;
		background: #f1f5f9;
		border-left: 1.5px solid #e2e8f0;
		cursor: pointer;
		font-size: 1rem;
		transition: background 0.12s;
		flex-shrink: 0;
	}
	.modal-copy-btn:hover {
		background: #e2e8f0;
	}

	.modal-copied-hint {
		font-size: 0.78rem;
		color: #16a34a;
		font-weight: 600;
		margin-top: -6px;
	}

	/* Actions */
	.modal-actions {
		display: flex;
		gap: 10px;
		width: 100%;
		margin-top: 8px;
	}

	.modal-btn {
		flex: 1;
		padding: 11px 0;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		border: none;
		transition:
			background 0.12s,
			transform 0.1s;
	}
	.modal-btn:active {
		transform: scale(0.97);
	}

	.modal-btn-primary {
		background: #007f8a;
		color: #fff;
	}
	.modal-btn-primary:hover {
		background: #005f68;
	}

	.modal-btn-secondary {
		background: #f1f5f9;
		color: #334155;
	}
	.modal-btn-secondary:hover {
		background: #e2e8f0;
	}

	/* Loading state */
	.modal-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 8px 0;
	}

	.spinner {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 3px solid #e2e8f0;
		border-top-color: #007f8a;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.modal-loading-title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #0f172a;
	}

	.modal-loading-step {
		margin: 0;
		font-size: 0.85rem;
		color: #64748b;
	}

	/* ── Print ── */
	.print-only {
		display: none;
	}

	@media print {
		.no-print {
			display: none !important;
		}

		/* Overlays injected directly under <body> (dev toolbars, browser
		   extensions, floating buttons) are position:fixed, sit outside this
		   page's .no-print scope, and Chrome paints fixed elements onto every
		   printed page — they showed up stamped over the comic. Hide everything
		   in the document and re-show only the print view. visibility (not
		   display) so the print view's ancestors keep their layout. */
		:global(body *) {
			visibility: hidden !important;
		}

		.print-only,
		.print-only :global(*) {
			visibility: visible !important;
		}

		@page {
			size: letter portrait;
			margin: 0.5in;
		}

		.print-only {
			display: flex !important;
			flex-direction: column;
			box-sizing: border-box;
			width: calc(8.5in - 1in);
			height: calc(11in - 1in);
			margin: 0 auto;
			padding: 0.25in;
		}

		.print-comic-grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 16px;
			width: 100%;
			flex: 1;
		}

		.print-comic-grid.print-template-page {
			grid-template-columns: repeat(6, 1fr);
			grid-template-rows: 2fr 3fr 3fr;
			height: 100%;
		}

		.print-comic-grid.print-template-page .print-panel:nth-child(1) {
			grid-column: 1 / -1;
		}

		.print-comic-grid.print-template-page .print-panel:nth-child(2),
		.print-comic-grid.print-template-page .print-panel:nth-child(3) {
			grid-column: span 3;
		}

		.print-comic-grid.print-template-page .print-panel:nth-child(4),
		.print-comic-grid.print-template-page .print-panel:nth-child(5),
		.print-comic-grid.print-template-page .print-panel:nth-child(6) {
			grid-column: span 2;
		}

		/* Page layout panels fill their grid cell — no fixed aspect-ratio */
		.print-comic-grid.print-template-page .print-panel,
		.print-comic-grid.print-template-page .print-panel-empty {
			aspect-ratio: unset;
			height: 100%;
		}

		.print-comic-grid.print-template-strip {
			grid-template-columns: repeat(3, 1fr);
		}

		.print-comic-grid.print-template-strip .print-panel,
		.print-comic-grid.print-template-strip .print-panel-empty {
			aspect-ratio: 4 / 3;
		}

		/* Sized from the page height, not a fixed width: four 16:9 panels at a
		   fixed width overflow the printable height of a letter page and spill
		   the last panel onto a second sheet. Split the height into equal rows
		   and derive each panel's width from its row height instead. */
		.print-comic-grid.print-template-vertical {
			grid-template-columns: 1fr;
			grid-template-rows: repeat(4, minmax(0, 1fr));
			height: 100%;
			justify-items: center;
		}

		.print-comic-grid.print-template-vertical .print-panel,
		.print-comic-grid.print-template-vertical .print-panel-empty {
			aspect-ratio: 16 / 9;
			width: auto;
			height: 100%;
			max-width: 100%;
		}

		.print-comic-grid.print-template-hero {
			grid-template-columns: repeat(4, 1fr);
			grid-template-rows: 2fr 1fr;
		}

		.print-comic-grid.print-template-hero .print-panel:nth-child(1),
		.print-comic-grid.print-template-hero .print-panel-empty:nth-child(1) {
			grid-column: 1 / -1;
		}

		.print-comic-grid.print-template-hero .print-panel,
		.print-comic-grid.print-template-hero .print-panel-empty {
			aspect-ratio: unset;
			height: 100%;
		}

		.print-panel,
		.print-panel-empty {
			width: 100%;
			aspect-ratio: 3 / 4;
			border: 4px solid #000;
			box-sizing: border-box;
			background: #fff;
			/* Grid items default to min-width/height auto, which for an <img>
			   is its intrinsic size — the 2× stage snapshots would force the
			   1fr columns wider than the page and push the last column off the
			   paper. Allow panels to shrink to their track instead. */
			min-width: 0;
			min-height: 0;
		}

		.print-panel {
			object-fit: cover;
			display: block;
		}
	}
</style>
