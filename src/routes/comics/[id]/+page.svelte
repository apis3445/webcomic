<script lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
	import { onMount } from 'svelte';
	const { data } = $props();
	const { comic, panels: orderedPanels, sheets } = data as { comic: any; panels: any[]; sheets?: any[] };

	// panels is an ordered array of { panel, bubbles, image }
	const panels = orderedPanels || [];

	// Choose template heuristically: prefer sheet.template_id mapping if available (legacy), otherwise infer from panel count
	let templateId: string | null = null;
	if (sheets && sheets.length) {
		templateId = sheets[0].template_id ?? null;
	}
	if (!templateId) {
		if (panels.length === 6) templateId = 'page-1-2-3';
		else templateId = 'grid-3x3';
	}

	// Client-side scaling for bubble overlay
	function makeScaleCalculator(imgEl: HTMLImageElement | null, storedWidth: number | null) {
		return () => {
			if (!imgEl) return { scaleX: 1, scaleY: 1 };
			const dispW = imgEl.clientWidth || imgEl.width || 1;
			const dispH = imgEl.clientHeight || imgEl.height || 1;
			const origW = storedWidth || (imgEl.naturalWidth || dispW) || dispW;
			const scaleX = dispW / origW;
			const scaleY = scaleX; // maintain aspect
			return { scaleX, scaleY };
		};
	}

	// Helper to produce inline style for bubble overlay
	function getBubbleStyle(b: any, imgEl: HTMLImageElement | undefined, storedWidth: number | undefined, storedHeight?: number | undefined) {
		try {
			if (!imgEl) return '';
			const dispW = imgEl.clientWidth || imgEl.width || imgEl.naturalWidth || 1;
			const dispH = imgEl.clientHeight || imgEl.height || imgEl.naturalHeight || 1;
			const origW = storedWidth || imgEl.naturalWidth || dispW || 1;
			const origH = storedHeight || imgEl.naturalHeight || dispH || 1;
			const scaleX = dispW / origW;
			const scaleY = dispH / origH;
			const left = (b.x || 0) * scaleX;
			const top = (b.y || 0) * scaleY;
			const w = (b.w || b.width || 120) * scaleX;
			const h = (b.h || b.height || 24) * scaleY;
			// Use transform translate to position; set size so bubble wraps correctly
			return `transform: translate(${Math.round(left)}px, ${Math.round(top)}px); width: ${Math.max(40, Math.round(w))}px; height: ${Math.max(18, Math.round(h))}px;`;
		} catch (e) {
			return '';
		}
	}
</script>

<svelte:head>
	<title>{comic?.name ?? 'Comic'}</title>
	<meta name="description" content={comic?.description ?? ''} />
</svelte:head>

<main class="published-container">
	<header class="published-header">
		<h1>{comic?.name}</h1>
		{#if comic?.description}
			<p class="desc">{comic.description}</p>
		{/if}
	</header>

	<section class="published-grid" class:template-page={templateId === 'page-1-2-3'}>
		{#each panels as item (item.panel.id)}
			<div class="published-cell">
				{#if item.image?.public_url}
					<div class="panel-image-wrap" style="position:relative;">
						<img bind:this={item._imgEl} src={item.image.public_url} alt={item.image.filename || 'Panel image'} loading="lazy" />
						{#if item.bubbles?.length}
							{#each item.bubbles as b (b.id)}
								{#if typeof b.x === 'number' && typeof b.y === 'number'}
									<!-- Position using inline transform; calculate scale from stored width/height if available -->
									<div
										class="bubble-overlay"
										style={getBubbleStyle(b, item._imgEl, item.image?.width, item.image?.height)}
									>
										<div class="bubble-inner">{b.text}</div>
									</div>
								{:else}
									<div class="bubble-list-static">
										{b.text}
									</div>
								{/if}
							{/each}
						{/if}
					</div>	
				{/if}
			</div>
		{/each}
	</section>
</main>

<style>
	.published-container {
		padding: 20px;
		max-width: 1000px;
		margin: 0 auto;
	}
	.published-header {
		text-align: center;
		margin-bottom: 20px;
	}
	.published-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.published-cell {
		position: relative;
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}
	.published-cell img {
		width: 100%;
		height: auto;
		display: block;
	}
	.desc {
		color: #374151;
	}
	.bubble-list {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bubble-text {
		background: rgba(255, 255, 255, 0.9);
		color: #111827;
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 0.9rem;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
	}
	@media (max-width: 900px) {
		.published-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 480px) {
		.published-grid {
			grid-template-columns: 1fr;
		}
	}

	.bubble-overlay {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
	}
	.bubble-inner {
		background: rgba(255,255,255,0.9);
		padding: 6px 8px;
		border-radius: 8px;
		box-shadow: 0 2px 6px rgba(0,0,0,0.12);
		pointer-events: auto;
	}
	.panel-image-wrap img { display:block; width:100%; height:auto; }
	/* page template adjustments similar to editor */
	.published-grid.template-page { grid-template-columns: repeat(6, 1fr); }
	.published-grid.template-page .published-cell:nth-child(1) { grid-column: 1 / -1; }
	.published-grid.template-page .published-cell:nth-child(2),
	.published-grid.template-page .published-cell:nth-child(3) { grid-column: span 3; }
	.published-grid.template-page .published-cell:nth-child(4),
	.published-grid.template-page .published-cell:nth-child(5),
	.published-grid.template-page .published-cell:nth-child(6) { grid-column: span 2; }
</style>
