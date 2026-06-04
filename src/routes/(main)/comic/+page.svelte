<script lang="ts">
	import '../../../app.css';
	import Panel from '$lib/components/Panel.svelte';
	import BubbleButton from '$lib/components/BubbleButton.svelte';
	import {
		comicState,
		type BubbleType,
		type TemplateId,
		type ComicStateType
	} from '$lib/comicState.svelte';

	let step = $state<'select' | 'edit'>('select');
	let bubbleText = $state('');
	let printImageUrls = $state<string[]>([]);
	let newComicName =  $state('');

	type PublishResult = { id?: string; public_url?: string; error?: string };

	let publishLoading = $state(false);
	let publishError = $state<string | null>(null);
	let publishResults = $state<PublishResult[]>([]);
	let publishModalOpen = $state(false);
	let publishStep = $state('');
	let publishDetails = $state<PublishResult[]>([]);
	let comicPublicUrl = $state<string | null>(null);

	async function publishComic() {
		const comicId = (comicState as ComicStateType).comicId;
		if (!comicId) {
			alert('No comic to publish — save or upload an image first.');
			return;
		}
		if (!confirm('Publish this comic? This will make images public. Continue?')) return;
		publishError = null;
		publishResults = [];
		publishDetails = [];
		publishModalOpen = true;
		publishStep = 'Starting publish...';
		publishLoading = true;
		try {
			publishStep = 'Copying images to public bucket...';
			// Send current client-side template and bubbles so server can persist them before publishing
			const payload = {
				templateId: (comicState as ComicStateType).templateId,
				panels: (comicState as ComicStateType).panels.map((p, idx) => ({
					index: idx + 1,
					bubbles: p.bubbles
				}))
			};
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
				publishResults = body.results || [];
				publishDetails = publishResults;
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
			panelsToRemove.some((p) => p.bgImageUrl !== '' || p.bubbles.length > 0);

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

	async function createAndStart(templateId: TemplateId) {
		// If we already have a comicId, just switch template and go to edit
		if ((comicState as ComicStateType).comicId) {
			comicState.setTemplate(templateId);
			step = 'edit';
			return;
		}

		// Create new comic with the provided name and then enter editor
		try {
			const payload = { name: newComicName };
			const res = await fetch('/api/comics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json();
			if (!res.ok) {
				alert(body?.error ?? 'Failed to create comic');
				return;
			}
			const newId = body.id;
			comicState.setComicId(newId);
			comicState.setTitle(newComicName);
			// Set the chosen template
			comicState.setTemplate(templateId);
			step = 'edit';
		} catch (e: unknown) {
			alert(String(e));
		}
	}

	let saveLoading = $state(false);

	async function saveComic() {
		const comicId = (comicState as ComicStateType).comicId;
		if (!comicId) {
			alert('No comic to save');
			return;
		}
		saveLoading = true;
		try {
			const payload = {
				name: (comicState as ComicStateType).title,
				templateId: (comicState as ComicStateType).templateId,
				panels: (comicState as ComicStateType).panels.map((p, idx) => ({ index: idx + 1, bubbles: p.bubbles }))
			};
			const res = await fetch(`/api/comics/${comicId}/save`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const body = await res.json();
				alert(body?.error ?? 'Save failed');
			} else {
				// Optionally show a toast or brief confirmation
				console.log('Saved');
			}
		} catch (e: unknown) {
			alert(String(e));
		} finally {
			saveLoading = false;
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
			<div class="picker-hero">
				<h2 class="picker-title">Choose your comic layout</h2>
				<p class="picker-subtitle">Pick a template to get started</p>
				<div style="margin-top:12px;">
					<label for="new-comic-name" class="card-label">Comic Title</label>
					<input id="new-comic-name" type="text" class="comic-title-input" bind:value={newComicName} placeholder="Untitled comic" />
				</div>
			</div>

			<div class="template-cards">
				<!-- Template A: Classic 3×3 -->
				<button class="template-card" onclick={() => selectTemplate('grid-3x3')}>
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
				<button class="template-card" onclick={() => selectTemplate('page-1-2-3')}>
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
					<label class="card-label">Title</label>
					<input
						type="text"
						class="comic-title-input"
						value={(comicState as ComicStateType).title}
						oninput={(e) => comicState.setTitle((e.target as HTMLInputElement).value)}
					/>
					<div style="margin-top:8px;display:flex;gap:8px;">
						<button class="save-button" onclick={saveComic} disabled={saveLoading}>{#if saveLoading}Saving...{:else}Save{/if}</button>
					</div>
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
				</div>

				<div class="sidebar-card">
					<span class="card-label">Speech Bubble Palette:</span>
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
				</div>

				<div class="sidebar-card">
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
		<section class="publish-banner" role="status" aria-live="polite">
			<div class="publish-inner">
				<div class="publish-step">{publishStep}</div>
				{#if publishLoading}
					<div class="spinner" aria-hidden="true"></div>
				{/if}
				{#if comicPublicUrl}
					<div class="publish-public-url">
						Public comic: <a href={comicPublicUrl} target="_blank" rel="external noreferrer noopener">{comicPublicUrl}</a>
					</div>
				{/if}
				{#if publishDetails && publishDetails.length}
					<div class="publish-results">
						<ul>
							{#each publishDetails as r, idx (r.id || idx)}
								<li>
									{#if r.public_url}
										<a href={r.public_url} target="_blank" rel="external noreferrer noopener">{r.public_url}</a>
									{:else}
										<span class="muted">{r.error}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				<div class="publish-actions">
					<button class="publish-close" onclick={closePublishModal}>Dismiss</button>
				</div>
			</div>
		</section>
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
		height: 100vh;
		overflow: hidden;
	}

	/* ── Template Picker ── */
	.template-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 40px;
		padding: 40px 24px;
		background: #f8fafc;
		overflow-y: auto;
	}

	.picker-hero {
		text-align: center;
	}

	.picker-title {
		margin: 0 0 8px;
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.03em;
	}

	.picker-subtitle {
		margin: 0;
		font-size: 1rem;
		color: #64748b;
		font-weight: 400;
	}

	.template-cards {
		display: flex;
		gap: 28px;
		flex-wrap: wrap;
		justify-content: center;
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
		height: 100%;
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
		background: #ffffff;
		border-left: 1px solid #e2e8f0;
		padding: 20px;
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

	/* Publish banner */
	.publish-banner {
		width: 100%;
		background: #198754;
		color: #fff;
		padding: 12px 16px;
		box-shadow: 0 2px 8px rgba(2, 6, 23, 0.2);
		margin-bottom: 12px;
	}
	.publish-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.publish-step {
		font-weight: 700;
	}
	.spinner {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid rgba(255, 255, 255, 0.18);
		border-top-color: #60a5fa;
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.publish-results ul {
		margin: 0;
		padding-left: 18px;
	}
	.publish-close {
		padding: 6px 10px;
		border-radius: 6px;
		background: #e5e7eb;
		border: none;
		cursor: pointer;
	}
	.publish-public-url {
		font-weight: 700;
		margin-right: 12px;
	}
	.publish-public-url a {
		color: #60a5fa; /* light blue for strong contrast on dark banner */
		text-decoration: underline;
	}
	.publish-public-url a:visited {
		color: #3b82f6; /* visited color: slightly different blue */
	}
	.publish-public-url a:focus,
	.publish-public-url a:hover {
		color: #93c5fd;
		text-decoration: underline;
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
