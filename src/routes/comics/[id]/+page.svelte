<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { untrack } from 'svelte';
	const { data } = $props();
	const {
		comic,
		panels: orderedPanels,
		templateSlug,
		user
	} = untrack(
		() =>
			data as {
				comic: any;
				panels: any[];
				sheets?: any[];
				templateSlug?: string | null;
				user: any;
			}
	);

	const panels = orderedPanels || [];

	const templateId: string = (() => {
		if (templateSlug === 'grid-3x3' || templateSlug === 'page-1-2-3') return templateSlug;
		if (panels.length === 6) return 'page-1-2-3';
		return 'grid-3x3';
	})();

	// Percentage-based positioning: coords are in Konva stage pixels, so divide by stage dimensions.
	function getBubbleStyle(b: any, stageW: number, stageH: number) {
		if (!stageW || !stageH) return '';
		const left = (b.x / stageW) * 100;
		const top = (b.y / stageH) * 100;
		const w = ((b.w || b.width || 120) / stageW) * 100;
		const h = ((b.h || b.height || 24) / stageH) * 100;
		return `left:${left.toFixed(3)}%; top:${top.toFixed(3)}%; width:${w.toFixed(3)}%; height:${h.toFixed(3)}%;`;
	}

	function buildCloudPath(w: number, h: number): string {
		const cx = w / 2;
		const cy = h / 2;
		const innerA = w * 0.4;
		const innerB = h * 0.38;
		const outerA = w * 0.5;
		const outerB = h * 0.52;
		const N = 12;
		const parts: string[] = [];
		for (let i = 0; i <= N; i++) {
			const angle = (i / N) * 2 * Math.PI;
			const x = cx + innerA * Math.cos(angle);
			const y = cy + innerB * Math.sin(angle);
			if (i === 0) {
				parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
			} else {
				const mid = ((i - 0.5) / N) * 2 * Math.PI;
				const ctrlX = cx + outerA * Math.cos(mid);
				const ctrlY = cy + outerB * Math.sin(mid);
				parts.push(`Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`);
			}
		}
		parts.push('Z');
		return parts.join(' ');
	}

	// Mirrors the path generator from Panel.svelte for editor-consistent shapes.
	function getBubblePath(type: string, w: number, h: number): string {
		if (type === 'left-cloud' || type === 'right-cloud') return buildCloudPath(w, h);
		const r = type.includes('oval') ? Math.min(w, h) / 2 : type === 'box' ? 0 : 4;
		if (type === 'left-oval' || type === 'box-izq') {
			return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${w * 0.45} ${h} L ${w * 0.15} ${h + 15} L ${w * 0.3} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
		}
		if (type === 'right-oval' || type === 'box-der') {
			return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${w * 0.7} ${h} L ${w * 0.85} ${h + 15} L ${w * 0.55} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
		}
		if (type === 'box') {
			return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
		}
		if (type === 'burst') {
			const cx = w / 2,
				cy = h / 2;
			const outerRx = (w / 2) * 0.95,
				outerRy = (h / 2) * 0.95;
			const innerRx = outerRx * 0.55,
				innerRy = outerRy * 0.55;
			const numPoints = 12;
			const parts: string[] = [];
			for (let i = 0; i < numPoints * 2; i++) {
				const angle = (i * Math.PI) / numPoints - Math.PI / 2;
				const rx = i % 2 === 0 ? outerRx : innerRx;
				const ry = i % 2 === 0 ? outerRy : innerRy;
				parts.push(
					`${i === 0 ? 'M' : 'L'} ${(cx + rx * Math.cos(angle)).toFixed(1)} ${(cy + ry * Math.sin(angle)).toFixed(1)}`
				);
			}
			return parts.join(' ') + ' Z';
		}
		return '';
	}
</script>

<svelte:head>
	<title>{comic?.name ?? 'Comic'}</title>
	<meta name="description" content={comic?.description ?? ''} />
</svelte:head>

<Navbar user={user ?? null} />

<main class="published-container">
	<header class="published-header">
		<h1>{comic?.name}</h1>
		{#if comic?.description}
			<p class="desc">{comic.description}</p>
		{/if}
	</header>

	<section class="published-grid" class:template-page={templateId === 'page-1-2-3'}>
		{#each panels as item (item.panel.id)}
			{@const stageW = (item.panel?.w > 0 ? item.panel.w : null) ?? item.image?.width ?? 0}
			{@const stageH = (item.panel?.h > 0 ? item.panel.h : null) ?? item.image?.height ?? 0}
			{@const hasStageDims = item.panel?.w > 0 && item.panel?.h > 0}
			<div class="published-cell">
				{#if item.image?.public_url}
					<div
						class="panel-image-wrap"
						style={hasStageDims ? `aspect-ratio: ${item.panel.w} / ${item.panel.h}` : ''}
					>
						<img
							src={item.image.public_url}
							alt={item.image.filename || 'Panel image'}
							loading="lazy"
							class:cover={hasStageDims}
						/>
						{#if item.bubbles?.length}
							{#each item.bubbles as b (b.id)}
								{#if typeof b.x === 'number' && typeof b.y === 'number' && stageW && stageH}
									{@const bw = b.w || b.width || 120}
									{@const bh = b.h || b.height || 24}
									{@const btype = b.style || 'left-oval'}
									{@const isCloud = btype === 'left-cloud' || btype === 'right-cloud'}
									{@const isOval = btype === 'left-oval' || btype === 'right-oval'}
									{@const padH = isCloud ? 32 : isOval ? 16 : 6}
									{@const padV = isCloud ? 14 : 6}
									<div
										class="bubble-overlay"
										class:bubble-cloud={isCloud}
										class:bubble-oval={isOval}
										style={getBubbleStyle(b, stageW, stageH)}
									>
										<svg
											class="bubble-svg"
											viewBox="0 0 {bw} {bh}"
											width="100%"
											height="100%"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d={getBubblePath(btype, bw, bh)}
												fill="white"
												stroke="black"
												stroke-width="3"
											/>
											{#if btype === 'left-cloud'}
												<circle
													cx={bw * 0.2}
													cy={bh + 6}
													r="6"
													fill="white"
													stroke="black"
													stroke-width="2"
												/>
												<circle
													cx={bw * 0.1}
													cy={bh + 16}
													r="3.5"
													fill="white"
													stroke="black"
													stroke-width="1.5"
												/>
											{:else if btype === 'right-cloud'}
												<circle
													cx={bw * 0.8}
													cy={bh + 6}
													r="6"
													fill="white"
													stroke="black"
													stroke-width="2"
												/>
												<circle
													cx={bw * 0.9}
													cy={bh + 16}
													r="3.5"
													fill="white"
													stroke="black"
													stroke-width="1.5"
												/>
											{/if}
											<foreignObject
												x={padH}
												y={padV}
												width={Math.max(bw - padH * 2, 1)}
												height={Math.max(bh - padV * 2, 1)}
											>
												<div
													xmlns="http://www.w3.org/1999/xhtml"
													class="bubble-text-svg"
												>{b.text}</div>
											</foreignObject>
										</svg>
									</div>
								{:else}
									<div class="bubble-list-static">{b.text}</div>
								{/if}
							{/each}
						{/if}
					</div>
				{:else}
					<div class="panel-empty"></div>
				{/if}
			</div>
		{/each}
	</section>
</main>
<Footer />

<style>
	.published-container {
		padding: 20px 20px 100px;
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
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}
	.panel-empty {
		aspect-ratio: 4 / 3;
		background: #f3f4f6;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
	}
	.published-cell img {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 8px;
	}
	.published-cell img.cover {
		height: 100%;
		object-fit: cover;
	}
	.desc {
		color: #374151;
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

	.panel-image-wrap {
		position: relative;
		overflow: visible;
	}
	.bubble-overlay {
		position: absolute;
		pointer-events: none;
		overflow: visible;
		z-index: 10;
	}
	.bubble-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	/* HTML inside <foreignObject>: CSS lengths are interpreted in viewBox units,
	 * so font-size: 15 here matches the editor's Konva fontSize={15} and scales
	 * automatically with the rendered bubble size. */
	.bubble-text-svg {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		font-weight: 700;
		font-size: 15px;
		line-height: 1.1;
		text-align: center;
		color: #000;
		word-break: break-word;
		overflow: hidden;
	}
	/* page template adjustments similar to editor */
	.published-grid.template-page {
		grid-template-columns: repeat(6, 1fr);
	}
	.published-grid.template-page .published-cell:nth-child(1) {
		grid-column: 1 / -1;
	}
	.published-grid.template-page .published-cell:nth-child(2),
	.published-grid.template-page .published-cell:nth-child(3) {
		grid-column: span 3;
	}
	.published-grid.template-page .published-cell:nth-child(4),
	.published-grid.template-page .published-cell:nth-child(5),
	.published-grid.template-page .published-cell:nth-child(6) {
		grid-column: span 2;
	}
</style>
