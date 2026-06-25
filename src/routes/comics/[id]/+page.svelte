<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { getTemplate, resolveTemplateId } from '$lib/templates';
	import { fade } from 'svelte/transition';

	type PageProps = {
		comic: any;
		panels: any[];
		sheets?: any[];
		coverUrl?: string | null;
		user: any;
	};

	const { data }: { data: PageProps } = $props();

	// Read reactively via $derived so future invalidations re-render the page
	// instead of being silently dropped (was wrapped in untrack() before).
	const comic = $derived(data.comic);
	const user = $derived(data.user);
	const panels = $derived(data.panels ?? []);
	const sheets = $derived(data.sheets ?? []);

	// One entry per page (sheet) that has content, each with its own resolved
	// template so multi-page comics can mix layouts. Pages whose panels are all
	// empty are skipped entirely — same policy as the per-cell skip below.
	const pages = $derived.by(() => {
		// Plain Map on purpose: it's a local temporary inside a derived —
		// a reactive SvelteMap must not be mutated during derivation.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const bySheet = new Map<string, any[]>();
		for (const item of panels) {
			const sid = item.panel.sheet_id;
			const list = bySheet.get(sid) ?? [];
			list.push(item);
			bySheet.set(sid, list);
		}
		return sheets
			.map((s: any) => {
				const items = bySheet.get(s.id) ?? [];
				return {
					sheet: s,
					template: getTemplate(resolveTemplateId(s.templateSlug, items.length)),
					items
				};
			})
			.filter((p: any) =>
				p.items.some((it: any) => Boolean(it.image?.public_url) || Boolean(it.bubbles?.length))
			);
	});

	// ── Magazine view ───────────────────────────────────────────────────────
	// Multi-page comics open like a real magazine: two facing pages per
	// spread with prev/next navigation. Single-page comics keep the plain
	// scroll view, and a toggle lets readers switch at any time.
	let viewModeOverride = $state<'magazine' | 'scroll' | null>(null);
	const viewMode = $derived(viewModeOverride ?? (pages.length > 1 ? 'magazine' : 'scroll'));
	const coverUrl = $derived(data.coverUrl ?? null);
	// The magazine starts closed, showing the front cover; opening it reveals
	// the first spread. Going back from the first spread closes it again.
	let opened = $state(false);

	// 2-page spreads: [p1, p2], [p3, p4], … (last spread may be a single page).
	const spreads = $derived.by(() => {
		const out: any[][] = [];
		for (let i = 0; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
		return out;
	});
	let spreadIndex = $state(0);
	// Clamp instead of writing state back: pages can shrink between loads.
	const safeSpreadIndex = $derived(Math.min(spreadIndex, Math.max(spreads.length - 1, 0)));
	const currentSpread = $derived(spreads[safeSpreadIndex] ?? []);

	function prevSpread() {
		if (safeSpreadIndex > 0) {
			spreadIndex = safeSpreadIndex - 1;
		} else {
			// Already on the first spread — close the magazine back to its cover.
			opened = false;
		}
	}

	function nextSpread() {
		if (safeSpreadIndex < spreads.length - 1) spreadIndex = safeSpreadIndex + 1;
	}

	function openComic() {
		spreadIndex = 0;
		opened = true;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (viewMode !== 'magazine') return;
		if (!opened) {
			if (e.key === 'ArrowRight' || e.key === 'Enter') openComic();
			return;
		}
		if (e.key === 'ArrowLeft') prevSpread();
		else if (e.key === 'ArrowRight') nextSpread();
	}

	// ── Manual page turning ─────────────────────────────────────────────────
	// Grab a page's outer edge and drag it toward the spine: a real two-faced
	// sheet folds over in 3D following the pointer. Its back shows the page
	// that lands face-up, and the page underneath is revealed as it lifts.
	// Past ~45% the fold animates to completion on release ('forward'),
	// otherwise it springs back ('back').
	const TURN_DRAG_RANGE = 320; // px of horizontal drag for a full turn
	let turnDrag = $state<{
		dir: 'next' | 'prev';
		startX: number;
		progress: number;
		settling: 'forward' | 'back' | null;
	} | null>(null);

	// Pages taking part in a flip: the lifting sheet's front and back faces,
	// and the page revealed underneath it. Spreads:
	// current [A,B] → next [C,D]: sheet front=B back=C, underlay=D.
	// current [C,D] → prev [A,B]: sheet front=C back=B, underlay=A.
	// A lone last page renders as [E, blank], so prev from it works the same
	// (front=E, back/under from the previous spread).
	const flipParts = $derived.by(() => {
		if (!turnDrag || currentSpread.length === 0) return null;
		if (turnDrag.dir === 'next') {
			// A lone page is always the last spread — there is no next to flip to.
			if (currentSpread.length < 2) return null;
			const next = spreads[safeSpreadIndex + 1] ?? [];
			return { front: currentSpread[1], back: next[0] ?? null, under: next[1] ?? null };
		}
		// No flip back from the first spread: closing the book to its cover is
		// a crossfade (the ‹ button), not a page turn — a half-spread cover
		// mid-fold reads as broken.
		if (safeSpreadIndex === 0) return null;
		const prev = spreads[safeSpreadIndex - 1] ?? [];
		return { front: currentSpread[0], back: prev[1] ?? null, under: prev[0] ?? null };
	});

	function startTurn(e: PointerEvent, dir: 'next' | 'prev') {
		if (turnDrag) return;
		if (dir === 'next' && safeSpreadIndex >= spreads.length - 1) return;
		if (dir === 'prev' && safeSpreadIndex === 0) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		turnDrag = { dir, startX: e.clientX, progress: 0, settling: null };
	}

	function moveTurn(e: PointerEvent) {
		if (!turnDrag || turnDrag.settling) return;
		const dx = e.clientX - turnDrag.startX;
		// "next" drags the right edge leftward; "prev" the left edge rightward.
		const toward = turnDrag.dir === 'next' ? -dx : dx;
		turnDrag.progress = Math.min(Math.max(toward / TURN_DRAG_RANGE, 0), 1);
	}

	function endTurn() {
		if (!turnDrag || turnDrag.settling) return;
		const { dir, progress } = turnDrag;
		if (!flipParts) {
			turnDrag = null;
			return;
		}
		// At the extremes there is nothing left to animate: the transform
		// wouldn't change, transitionend would never fire, and the sheet would
		// stay frozen mid-flip while the spread index lags behind (clicking ‹
		// then appeared to jump back to the cover). Resolve immediately.
		if (progress < 0.02) {
			turnDrag = null;
			return;
		}
		if (progress > 0.98) {
			turnDrag = null;
			if (dir === 'next') nextSpread();
			else prevSpread();
			return;
		}
		turnDrag.settling = progress > 0.45 ? 'forward' : 'back';
		// Safety net: transitionend can be swallowed (hidden tab, replaced
		// element) — resolve manually once the animation must have finished.
		const current = turnDrag;
		setTimeout(() => {
			if (turnDrag === current && turnDrag?.settling) onSheetSettled();
		}, 600);
	}

	// The settle animation finished: commit (or cancel) the page turn.
	function onSheetSettled() {
		if (!turnDrag?.settling) return;
		const { dir, settling } = turnDrag;
		turnDrag = null;
		if (settling === 'forward') {
			if (dir === 'next') nextSpread();
			else prevSpread();
		}
	}

	// Rotation of the folding sheet (0° flat … ±180° fully turned).
	function sheetStyle(): string {
		if (!turnDrag) return '';
		const sign = turnDrag.dir === 'next' ? -1 : 1;
		const deg =
			turnDrag.settling === 'forward'
				? 180
				: turnDrag.settling === 'back'
					? 0
					: turnDrag.progress * 180;
		return `transform: rotateY(${deg * sign}deg);`;
	}

	// Static page that must hide while its flip-sheet twin is in the air.
	function hiddenForFlip(side: 'left' | 'right'): boolean {
		if (!flipParts || !turnDrag) return false;
		return turnDrag.dir === 'next' ? side === 'right' : side === 'left';
	}

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

	{#snippet pageGrid(pageEntry: any)}
		<section class="published-grid {pageEntry.template.layoutClass}">
			{#each pageEntry.items as item (item.panel.id)}
				{@const stageW = (item.panel?.w > 0 ? item.panel.w : null) ?? item.image?.width ?? 0}
				{@const stageH = (item.panel?.h > 0 ? item.panel.h : null) ?? item.image?.height ?? 0}
				{@const hasStageDims = item.panel?.w > 0 && item.panel?.h > 0}
				{@const hasImage = Boolean(item.image?.public_url)}
				{@const hasBubbles = Boolean(item.bubbles?.length)}
				<!-- Skip the cell entirely when a panel has no content: a published
			     comic that renders empty dashed placeholders looks broken to
			     readers (and the dashed box is shorter than image panels, so
			     the grid also looks ragged). Empty slots simply vanish. -->
				{#if hasImage || hasBubbles}
					<div class="published-cell">
						<div
							class="panel-image-wrap"
							class:panel-image-wrap-empty={!hasImage}
							style={hasStageDims ? `aspect-ratio: ${item.panel.w} / ${item.panel.h}` : ''}
						>
							{#if hasImage}
								<img
									src={item.image.public_url}
									alt={item.image.filename || 'Panel image'}
									loading="lazy"
									class:cover={hasStageDims}
								/>
							{/if}
							{#if hasBubbles}
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
													<div xmlns="http://www.w3.org/1999/xhtml" class="bubble-text-svg">
														{b.text}
													</div>
												</foreignObject>
											</svg>
										</div>
									{:else}
										<div class="bubble-list-static">{b.text}</div>
									{/if}
								{/each}
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</section>
	{/snippet}

	{#if pages.length > 1}
		<div class="view-toggle" role="group" aria-label="View mode">
			<button
				class:active={viewMode === 'magazine'}
				onclick={() => (viewModeOverride = 'magazine')}
			>
				📖 Magazine
			</button>
			<button class:active={viewMode === 'scroll'} onclick={() => (viewModeOverride = 'scroll')}>
				📜 Scroll
			</button>
		</div>
	{/if}

	{#if viewMode === 'magazine'}
		<!-- Stacked stage: cover and open book occupy the same grid cell so
		     switching between them crossfades in place instead of swapping
		     layouts abruptly. -->
		<div class="mag-stage">
			{#if !opened}
				<div class="mag-cover-wrap" in:fade={{ duration: 220 }} out:fade={{ duration: 160 }}>
					<button class="mag-cover" onclick={openComic} aria-label="Open the comic">
						{#if coverUrl}
							<img src={coverUrl} alt="{comic?.name ?? 'Comic'} cover" class="mag-cover-img" />
						{:else}
							<span class="mag-cover-title">{comic?.name}</span>
						{/if}
					</button>
					<button class="mag-open-btn" onclick={openComic}>Open the comic →</button>
				</div>
			{:else}
				<div class="mag-reader" in:fade={{ duration: 220 }} out:fade={{ duration: 160 }}>
					<div class="magazine">
						<button
							class="mag-nav"
							onclick={prevSpread}
							aria-label={safeSpreadIndex === 0 ? 'Back to cover' : 'Previous pages'}
						>
							‹
						</button>
						{#key safeSpreadIndex}
							<div
								class="mag-spread"
								class:mag-turning={turnDrag !== null}
								in:fade={{ duration: 180 }}
							>
								{#each currentSpread as pageEntry, pi (pageEntry.sheet.id)}
									{@const side = pi === 0 ? 'left' : 'right'}
									<div class="mag-page" class:mag-page-hidden={hiddenForFlip(side)}>
										{@render pageGrid(pageEntry)}
										<div class="mag-page-num">Page {pageEntry.sheet.number}</div>
									</div>
								{/each}
								{#if currentSpread.length === 1}
									<!-- Lone last page: blank right half so the book keeps its
								     two-page shape and flips stay continuous. -->
									<div class="mag-page mag-page-blank" aria-hidden="true"></div>
								{/if}

								{#if flipParts && turnDrag}
									{@const onRight = turnDrag.dir === 'next'}
									<!-- Page revealed underneath the lifting sheet -->
									<div
										class="mag-underlay"
										class:mag-half-right={onRight}
										class:mag-half-left={!onRight}
									>
										{#if flipParts.under}
											<div class="mag-page mag-page-fill">
												{@render pageGrid(flipParts.under)}
												<div class="mag-page-num">Page {flipParts.under.sheet.number}</div>
											</div>
										{/if}
									</div>
									<!-- The folding sheet itself: front face is the page being
							     turned, back face is the page that lands face-up. -->
									<div
										class="mag-sheet"
										class:mag-half-right={onRight}
										class:mag-half-left={!onRight}
										class:mag-sheet-settling={turnDrag.settling !== null}
										style={sheetStyle()}
										ontransitionend={onSheetSettled}
									>
										<div class="mag-sheet-face mag-sheet-front">
											<div class="mag-page mag-page-fill">
												{@render pageGrid(flipParts.front)}
												<div class="mag-page-num">Page {flipParts.front.sheet.number}</div>
											</div>
										</div>
										<div class="mag-sheet-face mag-sheet-back">
											{#if flipParts.back}
												<div class="mag-page mag-page-fill">
													{@render pageGrid(flipParts.back)}
													<div class="mag-page-num">Page {flipParts.back.sheet.number}</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}
								<!-- Edge grips: drag a page border toward the spine to turn it.
						     Decorative duplicates of the arrow buttons (which remain the
						     accessible navigation), hence aria-hidden. -->
								{#if safeSpreadIndex < spreads.length - 1}
									<div
										class="mag-turn-zone mag-turn-zone-right"
										onpointerdown={(e) => startTurn(e, 'next')}
										onpointermove={moveTurn}
										onpointerup={endTurn}
										onpointercancel={endTurn}
										aria-hidden="true"
									></div>
								{/if}
								{#if safeSpreadIndex > 0}
									<div
										class="mag-turn-zone mag-turn-zone-left"
										onpointerdown={(e) => startTurn(e, 'prev')}
										onpointermove={moveTurn}
										onpointerup={endTurn}
										onpointercancel={endTurn}
										aria-hidden="true"
									></div>
								{/if}
							</div>
						{/key}
						<button
							class="mag-nav"
							onclick={nextSpread}
							disabled={safeSpreadIndex >= spreads.length - 1}
							aria-label="Next pages"
						>
							›
						</button>
					</div>
					<p class="mag-indicator">
						{currentSpread.length === 2
							? `Pages ${currentSpread[0].sheet.number}–${currentSpread[1].sheet.number}`
							: `Page ${currentSpread[0]?.sheet.number ?? ''}`} · {pages.length}
						{pages.length === 1 ? 'page' : 'pages'} total
					</p>
				</div>
			{/if}
		</div>
	{:else}
		{#each pages as pageEntry (pageEntry.sheet.id)}
			{#if pages.length > 1}
				<div class="page-label">Page {pageEntry.sheet.number}</div>
			{/if}
			<!-- Bordered sheet so it's clear where one page ends and the next
			     starts when scrolling. -->
			<div class="scroll-page">
				{@render pageGrid(pageEntry)}
			</div>
		{/each}
	{/if}
</main>
<Footer />
<svelte:window onkeydown={handleKeydown} />

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
	/* ── Magazine view ── */
	.view-toggle {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin-bottom: 20px;
	}
	.view-toggle button {
		padding: 6px 16px;
		border: 2px solid #e2e8f0;
		border-radius: 999px;
		background: #fff;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition:
			border-color 0.12s,
			color 0.12s,
			background 0.12s;
	}
	.view-toggle button:hover {
		border-color: #007f8a;
		color: #007f8a;
	}
	.view-toggle button.active {
		border-color: #007f8a;
		background: #f0fdfc;
		color: #007f8a;
	}

	/* Cover and open book stack in the same grid cell so toggling between
	   them crossfades in place (Svelte keeps the outgoing element rendered
	   during its out: transition). */
	.mag-stage {
		display: grid;
	}
	.mag-stage > * {
		grid-area: 1 / 1;
		min-width: 0;
	}

	/* Closed magazine: the front cover, click to open. */
	.mag-cover-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
	}
	.mag-cover {
		position: relative;
		width: min(380px, 72vw);
		aspect-ratio: 3 / 4;
		padding: 0;
		border: 1px solid #e2e8f0;
		border-radius: 6px 14px 14px 6px;
		overflow: hidden;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Fallback cover when there's no image */
		background: linear-gradient(135deg, #007f8a, #1a237e);
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
		transition:
			transform 0.18s,
			box-shadow 0.18s;
	}
	.mag-cover:hover {
		transform: translateY(-5px);
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28);
	}
	.mag-cover-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Bound-spine shading on the left edge of the cover. */
	.mag-cover::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 16px;
		background: linear-gradient(to right, rgba(0, 0, 0, 0.22), transparent);
		pointer-events: none;
	}
	.mag-cover-title {
		position: relative;
		padding: 20px;
		color: #fff;
		font-size: 1.6rem;
		font-weight: 800;
		text-align: center;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
		word-break: break-word;
	}
	.mag-open-btn {
		padding: 9px 22px;
		border: 2px solid #007f8a;
		border-radius: 999px;
		background: #007f8a;
		color: #fff;
		font-size: 0.9rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.12s;
	}
	.mag-open-btn:hover {
		background: #005f68;
	}

	.magazine {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mag-nav {
		flex-shrink: 0;
		width: 42px;
		height: 42px;
		border: 2px solid #e2e8f0;
		border-radius: 50%;
		background: #fff;
		color: #334155;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		transition:
			border-color 0.12s,
			color 0.12s;
	}
	.mag-nav:hover:not([disabled]) {
		border-color: #007f8a;
		color: #007f8a;
	}
	.mag-nav[disabled] {
		opacity: 0.35;
		cursor: default;
	}

	/* The open magazine: two facing pages joined at a spine. */
	.mag-spread {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		box-shadow: 0 14px 36px rgba(0, 0, 0, 0.14);
		/* 3D stage for the manual page-turn effect */
		position: relative;
		perspective: 1800px;
		/* Real-magazine footprint for the whole spread (two 3:4 pages side by
		   side = 3:2). The ratio lives on the spread, not the pages: pages are
		   grid items that stretch to the row, so both stay exactly equal in
		   height even when one holds less content or a taller layout. Content
		   taller than the ratio still grows. */
		aspect-ratio: 3 / 2;
	}
	.mag-page {
		min-width: 0;
		padding: 18px 18px 12px;
		/* Column flex so the page number pins to the bottom of the spread
		   even when the facing page is taller. */
		display: flex;
		flex-direction: column;
		/* Springs back smoothly when a drag is released below the turn
		   threshold; disabled mid-drag so the page tracks the pointer 1:1. */
		transition:
			transform 0.28s ease,
			filter 0.28s ease;
		backface-visibility: hidden;
	}
	.mag-spread.mag-turning .mag-page {
		transition: none;
	}

	.mag-page-hidden {
		visibility: hidden;
	}
	/* Blank right half shown when the last spread has a lone page. */
	.mag-page-blank {
		background: #fdfdfd;
	}
	.mag-page-fill {
		height: 100%;
		box-sizing: border-box;
	}

	/* Halves of the spread used by the flip overlay elements. */
	.mag-half-right {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 50%;
	}
	.mag-half-left {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 50%;
	}

	/* Page revealed beneath the lifting sheet, with a soft shadow falling
	   from the fold. */
	.mag-underlay {
		z-index: 2;
		background: #fff;
		overflow: hidden;
	}
	.mag-underlay::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to right, rgba(15, 23, 42, 0.1), transparent 35%);
		pointer-events: none;
	}
	.mag-half-left.mag-underlay::after {
		background: linear-gradient(to left, rgba(15, 23, 42, 0.1), transparent 35%);
	}

	/* The folding sheet: two faces back to back, rotating around the spine. */
	.mag-sheet {
		z-index: 30;
		transform-style: preserve-3d;
		pointer-events: none;
	}
	.mag-half-right.mag-sheet {
		transform-origin: left center;
	}
	.mag-half-left.mag-sheet {
		transform-origin: right center;
	}
	.mag-sheet-settling {
		transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.35, 1);
	}
	.mag-sheet-face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		background: #fff;
		border: 1px solid #e2e8f0;
		box-shadow: 0 6px 24px rgba(15, 23, 42, 0.18);
		overflow: hidden;
	}
	.mag-sheet-back {
		transform: rotateY(180deg);
	}

	/* Invisible grips on the outer page borders for drag-to-turn. */
	.mag-turn-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 56px;
		z-index: 20;
		cursor: grab;
		/* Required so pointermove keeps firing on touch instead of scrolling */
		touch-action: none;
	}
	.mag-turn-zone:active {
		cursor: grabbing;
	}
	.mag-turn-zone-right {
		right: 0;
		border-radius: 0 10px 10px 0;
	}
	.mag-turn-zone-left {
		left: 0;
		border-radius: 10px 0 0 10px;
	}
	.mag-turn-zone-right:hover {
		background: linear-gradient(to left, rgba(15, 23, 42, 0.08), transparent);
	}
	.mag-turn-zone-left:hover {
		background: linear-gradient(to right, rgba(15, 23, 42, 0.08), transparent);
	}

	/* Curled-corner affordance at the bottom outer corners: a folded bit of
	   paper that grows when hovered, hinting "grab me". */
	.mag-turn-zone::after {
		content: '';
		position: absolute;
		bottom: 0;
		width: 44px;
		height: 44px;
		pointer-events: none;
		opacity: 0.75;
		transition:
			transform 0.16s ease,
			opacity 0.16s ease;
	}
	.mag-turn-zone-right::after {
		right: 0;
		border-radius: 0 0 10px 0;
		background: linear-gradient(to top left, #b9c4d2 0%, #e6ebf2 22%, #f8fafc 38%, transparent 52%);
		transform-origin: bottom right;
	}
	.mag-turn-zone-left::after {
		left: 0;
		border-radius: 0 0 0 10px;
		background: linear-gradient(
			to top right,
			#b9c4d2 0%,
			#e6ebf2 22%,
			#f8fafc 38%,
			transparent 52%
		);
		transform-origin: bottom left;
	}
	.mag-turn-zone:hover::after {
		transform: scale(1.5);
		opacity: 1;
	}
	.mag-page .published-grid {
		flex: 1;
		/* Keep panel rows at the top instead of stretching to fill the gap. */
		align-content: start;
	}
	/* Webtoon vertical layout inside a magazine page: at full page width its
	   stacked 16:9 panels tower ~2.4× taller than the page is wide, blowing
	   past the 3:4 footprint and stretching the whole spread. Narrow the
	   column so the stack's total height also lands at ~3:4 — like a webtoon
	   strip printed on a magazine page. Panels keep their own aspect ratio,
	   so bubble alignment is unaffected. */
	.mag-page .published-grid.template-vertical {
		width: 58%;
		max-width: none;
		margin: 0 auto;
	}
	/* Spine: inner shadow falling toward the center fold. */
	.mag-page:first-child:not(:only-child) {
		border-right: 1px solid #e2e8f0;
		background: linear-gradient(to left, rgba(15, 23, 42, 0.07), transparent 14%);
	}
	.mag-page:last-child:not(:only-child) {
		background: linear-gradient(to right, rgba(15, 23, 42, 0.07), transparent 14%);
	}
	.mag-page-num {
		margin-top: auto;
		padding-top: 12px;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
	}
	.mag-indicator {
		margin-top: 14px;
		text-align: center;
		font-size: 0.85rem;
		font-weight: 600;
		color: #64748b;
	}

	@media (max-width: 720px) {
		/* Facing pages don't fit on phones — stack them inside the spread.
		   Drop the fixed footprint too: a stacked column with blank paper
		   would be needlessly tall. */
		.mag-spread {
			grid-template-columns: 1fr;
			aspect-ratio: auto;
		}
		/* Stacked pages: no edges to grab, and a blank half is just dead space. */
		.mag-turn-zone,
		.mag-page-blank {
			display: none;
		}
		.mag-spread-single {
			max-width: 100%;
		}
		.mag-page:first-child:not(:only-child) {
			border-right: none;
			border-bottom: 1px solid #e2e8f0;
			background: none;
		}
		.mag-page:last-child:not(:only-child) {
			background: none;
		}
		.mag-nav {
			width: 34px;
			height: 34px;
		}
	}

	/* Scroll view: each page on its own bordered sheet so the boundary
	   between consecutive pages is obvious. */
	.scroll-page {
		background: #fff;
		border: 1.5px solid #cbd5e1;
		border-radius: 10px;
		padding: 16px;
		box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
	}
	.scroll-page + .page-label {
		margin-top: 40px;
	}

	/* Page separator label, shown only for multi-page comics */
	.page-label {
		margin: 36px 0 12px;
		font-size: 0.85rem;
		font-weight: 800;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.page-label:first-of-type {
		margin-top: 0;
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
	/* Panel with bubbles but no image — give the wrap a paper-like backdrop
	   so the bubbles have a surface to sit on instead of floating in 0×0. */
	.panel-image-wrap-empty {
		aspect-ratio: 4 / 3;
		background: #ffffff;
		border: 2px solid #1a237e;
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
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
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

	.published-grid.template-strip {
		grid-template-columns: repeat(3, 1fr);
	}

	.published-grid.template-vertical {
		grid-template-columns: 1fr;
		max-width: 520px;
		margin: 0 auto;
	}

	.published-grid.template-hero {
		grid-template-columns: repeat(4, 1fr);
	}

	.published-grid.template-hero .published-cell:nth-child(1) {
		grid-column: 1 / -1;
	}

	@media (max-width: 900px) {
		.published-grid.template-hero {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.published-grid.template-strip,
		.published-grid.template-hero {
			grid-template-columns: 1fr;
		}
	}
</style>
