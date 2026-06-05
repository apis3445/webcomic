<script lang="ts">
	import '../../../app.css';
	import Panel from '$lib/components/Panel.svelte';
	import BubbleButton from '$lib/components/BubbleButton.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		comicState,
		type BubbleType,
		type TemplateId,
		type PanelState
	} from '$lib/comicState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let step = $state<'select' | 'edit'>('select');
	let bubbleText = $state('');
	let printImageUrls = $state<string[]>([]);
	let newComicName = $state('');
	let thumbnailFile = $state<File | null>(null);
	let thumbnailPreviewUrl = $state<string | null>(null);
	let creatingComic = $state(false);

	// URL is the source of truth: ?id=X loads the comic into editor; no id => new-comic picker.
	$effect(() => {
		if (data.comic) {
			if (comicState.comicId !== data.comic.id) {
				suppressNextAutosave = true;
				comicState.hydrate(data.comic);
			}
			step = 'edit';
		} else {
			suppressNextAutosave = true;
			comicState.reset();
			lastSavedSnapshot = '';
			saveStatus = 'idle';
			step = 'select';
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
	const AUTOSAVE_DEBOUNCE_MS = 1500;

	function buildSnapshot(): string {
		return JSON.stringify({
			title: comicState.title,
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
					type: b.type
				}))
			}))
		});
	}

	async function saveNow() {
		const cid = comicState.comicId;
		if (!cid) return;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		const snapshotAtStart = buildSnapshot();
		saveStatus = 'saving';
		saveError = null;
		try {
			const payload = {
				name: comicState.title,
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
		}
	}

	function scheduleAutosave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTimer = null;
			saveNow();
		}, AUTOSAVE_DEBOUNCE_MS);
	}

	// Watch edit state; schedule autosave when the snapshot diverges from the last saved one.
	$effect(() => {
		const cid = comicState.comicId;
		if (!cid || step !== 'edit') return;
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
			alert('No comic to publish — save or upload an image first.');
			return;
		}
		publishError = null;
		publishModalOpen = true;
		publishStep = 'Starting publish...';
		publishLoading = true;
		try {
			// Send current client-side template and bubbles so server can persist them before publishing
			const payload = {
				templateId: comicState.templateId,
				panels: comicState.panels.map((p: PanelState, idx: number) => ({
					index: idx + 1,
					w: p.stageW || undefined,
					h: p.stageH || undefined,
					bubbles: p.bubbles
				}))
			};
			publishStep = "Publishing";
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
		const newCount = id === 'grid-3x3' ? 9 : 6;
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
		try {
			const res = await fetch('/api/comics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newComicName || 'Untitled' })
			});
			const body = await res.json();
			if (!res.ok) {
				alert(body?.error ?? 'Failed to create comic');
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
			// Reflect the new comic in the URL so reloads / navigation hydrate correctly
			await goto(resolve(`/comic?id=${newId}`), { replaceState: true, noScroll: true });
		} catch (e: unknown) {
			alert(String(e));
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
	<!-- Template Picker -->
	{#if step === 'select'}
		<div class="template-picker">
			<div class="picker-form">
				<h2 class="picker-title">Create a new comic</h2>
				<p class="picker-subtitle">Give it a name, add a cover, then pick a layout</p>

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
					<span class="form-label">Cover Image <span class="form-label-hint">(optional)</span></span>
					{#if thumbnailPreviewUrl}
						<div class="thumb-preview-wrap">
							<img src={thumbnailPreviewUrl} alt="Cover preview" class="thumb-preview" />
							<button class="thumb-remove" onclick={removeThumbnail} title="Remove">×</button>
						</div>
					{:else}
						<label class="thumb-dropzone" for="thumbnail-input">
							<span class="thumb-icon">🖼</span>
							<span class="thumb-label">Click to upload cover image</span>
							<span class="thumb-hint">JPG · PNG · WebP · recommended 3:4</span>
						</label>
						<input
							id="thumbnail-input"
							type="file"
							accept="image/*"
							class="visually-hidden"
							onchange={handleThumbnailChange}
						/>
					{/if}
				</div>

				<div class="form-divider">
					<span>Choose a layout to start editing</span>
				</div>

				<div class="template-cards">
					<!-- Template A: Classic 3×3 -->
					<button
						class="template-card"
						onclick={() => selectTemplate('grid-3x3')}
						disabled={creatingComic}
					>
						<div class="preview-grid preview-3x3">
							{#each { length: 9 }, i (i)}
								<div class="preview-cell"></div>
							{/each}
						</div>
						<div class="template-card-info">
							<span class="template-name">Classic 3×3</span>
							<span class="template-desc">9 equal panels</span>
						</div>
					</button>

					<!-- Template B: Page Layout -->
					<button
						class="template-card"
						onclick={() => selectTemplate('page-1-2-3')}
						disabled={creatingComic}
					>
						<div class="preview-grid preview-page">
							{#each { length: 6 }, i (i)}
								<div class="preview-cell"></div>
							{/each}
						</div>
						<div class="template-card-info">
							<span class="template-name">Page Layout</span>
							<span class="template-desc">6 panels · 1 + 2 + 3</span>
						</div>
					</button>
				</div>

				{#if creatingComic}
					<div class="creating-label">Creating your comic…</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Main Workspace -->
	{#if step === 'edit'}
		<main class="studio-layout">
			<!-- Canvas Grid -->
			<section class="canvas-workspace">
				<div class="comic-grid" class:template-page={comicState.templateId === 'page-1-2-3'}>
					{#each comicState.panels as _panel, i (i)}
						<Panel index={i} />
					{/each}
				</div>
			</section>

			<!-- Inspector Sidebar -->
			<aside class="control-sidebar">
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
					
					<button
						class="save-button"
						onclick={saveNow}
						disabled={saveStatus === 'saving'}
					>
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
				</div>
			</aside>
		</main>
	{/if}

	{#if publishModalOpen}
		<div
			class="modal-backdrop"
			onclick={(e) => { if (e.target === e.currentTarget && !publishLoading) closePublishModal(); }}
			onkeydown={(e) => { if (e.key === 'Escape' && !publishLoading) closePublishModal(); }}
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
						<button class="modal-btn modal-btn-secondary" onclick={closePublishModal}>Dismiss</button>
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
							<button
								class="modal-copy-btn"
								onclick={copyPublicUrl}
								title="Copy link"
							>
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
								class="modal-btn modal-btn-primary"
							>View Comic ↗</a>
						{/if}
						<button class="modal-btn modal-btn-secondary" onclick={closePublishModal}>Done</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Print View -->
<div class="print-only">
	<div class="print-comic-grid" class:print-template-page={comicState.templateId === 'page-1-2-3'}>
		{#each printImageUrls as url, i (i)}
			{#if url}
				<img src={url} alt="Panel {i + 1}" class="print-panel" />
			{:else}
				<div class="print-panel print-panel-empty"></div>
			{/if}
		{/each}
	</div>
</div>

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
		transition: border-color 0.15s, background 0.15s;
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

	.save-button {
		width: 100%;
		padding: 10px 12px;
		background: #166534;
		color: #fff;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s, color 0.12s;
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
	.save-status[data-status='saved'] { color: #16a34a; }
	.save-status[data-status='error'] { color: #b91c1c; }
	.save-status[data-status='dirty'] { color: #b45309; }
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
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
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
		from { opacity: 0; transform: scale(0.88) translateY(16px); }
		to   { opacity: 1; transform: scale(1)   translateY(0); }
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
	.modal-close-x:hover { background: #e2e8f0; }

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
	.modal-copy-btn:hover { background: #e2e8f0; }

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
		transition: background 0.12s, transform 0.1s;
	}
	.modal-btn:active { transform: scale(0.97); }

	.modal-btn-primary {
		background: #007f8a;
		color: #fff;
	}
	.modal-btn-primary:hover { background: #005f68; }

	.modal-btn-secondary {
		background: #f1f5f9;
		color: #334155;
	}
	.modal-btn-secondary:hover { background: #e2e8f0; }

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
		to { transform: rotate(360deg); }
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

		.print-panel,
		.print-panel-empty {
			width: 100%;
			aspect-ratio: 3 / 4;
			border: 4px solid #000;
			box-sizing: border-box;
			background: #fff;
		}

		.print-panel {
			object-fit: cover;
			display: block;
		}
	}
</style>
