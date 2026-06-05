<script lang="ts">
	import { browser } from '$app/environment';
	import { Stage, Layer, Image, Group, Text, Circle, Line, Path } from 'svelte-konva';
	import type { KonvaEventObject } from 'konva/lib/Node';
	import { comicState } from '../comicState.svelte';
	// Server-backed upload flow: POST FormData to /api/upload-image and create comics via /api/comics
	// (using event.locals.supabase on the server)

	let { index, class: className = '' }: { index: number; class?: string } = $props();

	let width = $state(0);
	let height = $state(0);
	let fileInput: HTMLInputElement | undefined;
	let uploading = $state(false);

	const panel = $derived(comicState.panels[index]);
	const bgImage = $derived(panel.bgImage);
	const bubbles = $derived(panel.bubbles);
	const isActivePanel = $derived(comicState.activePanelIndex === index);

	function dragOver(e: DragEvent) {
		e.preventDefault();
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
			comicState.setPanelBgImage(index, URL.createObjectURL(file));
		}
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
			await uploadImageServer(file, index);
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	async function uploadImageServer(file: File, panelIndex: number) {
		uploading = true;
		try {
			// Ensure comic exists server-side
			let comicId: string | null = comicState.comicId;
			if (!comicId) {
				const res = await fetch('/api/comics', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: 'Untitled', description: '' })
				});
				if (!res.ok) {
					console.error('Failed to create comic');
					return;
				}
				const body = await res.json();
				comicId = body.id ?? null;
				if (!comicId) {
					console.error('Comic create response missing id');
					return;
				}
				comicState.setComicId(comicId);
			}

			// Measure image dimensions in browser before upload so server stores width/height
			let width = 0;
			let height = 0;
			try {
				// Prefer createImageBitmap when available — it's more robust during HMR/teardown
				if (typeof createImageBitmap === 'function') {
					try {
						const bmp = await createImageBitmap(file as Blob);
						width = bmp.width || 0;
						height = bmp.height || 0;
						bmp.close();
					} catch (err) {
						// fallback to Image approach below
						console.warn('createImageBitmap failed, falling back to Image:', err);
						const imgUrl = URL.createObjectURL(file);
						await new Promise<void>((resolve) => {
							let settled = false;
							const img = new window.Image();
							img.onload = () => {
								if (settled) return;
								settled = true;
								try {
									width = img.naturalWidth || img.width || 0;
									height = img.naturalHeight || img.height || 0;
								} catch {
									/* ignore */
								}
								try {
									URL.revokeObjectURL(imgUrl);
								} catch {
									/* ignore */
								}
								resolve();
							};
							img.onerror = () => {
								if (settled) return;
								settled = true;
								try {
									URL.revokeObjectURL(imgUrl);
								} catch {
									/* ignore */
								}
								resolve();
							};
							setTimeout(() => {
								if (settled) return;
								settled = true;
								try {
									URL.revokeObjectURL(imgUrl);
								} catch {
									/* ignore */
								}
								resolve();
							}, 5000);
							img.src = imgUrl;
						});
					}
				} else {
					// Fallback: use Image load
					const imgUrl = URL.createObjectURL(file);
					await new Promise<void>((resolve) => {
						let settled = false;
						const img = new window.Image();
						img.onload = () => {
							if (settled) return;
							settled = true;
							try {
								width = img.naturalWidth || img.width || 0;
								height = img.naturalHeight || img.height || 0;
							} catch {
								/* ignore */
							}
							try {
								URL.revokeObjectURL(imgUrl);
							} catch {
								/* ignore */
							}
							resolve();
						};
						img.onerror = () => {
							if (settled) return;
							settled = true;
							try {
								URL.revokeObjectURL(imgUrl);
							} catch {
								/* ignore */
							}
							resolve();
						};
						setTimeout(() => {
							if (settled) return;
							settled = true;
							try {
								URL.revokeObjectURL(imgUrl);
							} catch {
								/* ignore */
							}
							resolve();
						}, 5000);
						img.src = imgUrl;
					});
				}
			} catch (e) {
				console.error('Error measuring image dimensions', e);
			}

			const form = new FormData();
			form.append('file', file);
			form.append('panelIndex', String(panelIndex + 1));
			form.append('sheetNumber', '1');
			// comicId is guaranteed to be set above; assert non-null to satisfy TypeScript
			form.append('comicId', comicId!);
			if (width > 0) form.append('width', String(width));
			if (height > 0) form.append('height', String(height));

			const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: form });
			if (!uploadRes.ok) {
				console.error('Upload failed');
				return;
			}
			const data = await uploadRes.json();
			if (data.url) {
				comicState.setPanelBgImage(panelIndex, data.url);
			}
		} catch (err) {
			console.error('uploadImageServer error', err);
		} finally {
			uploading = false;
		}
	}

	function openFilePicker(e?: Event) {
		e?.stopPropagation();
		fileInput?.click();
	}

	function handleStageClick(e: KonvaEventObject<MouseEvent>) {
		e.evt.stopPropagation();
		comicState.selectPanel(index);
		openFilePicker();
	}

	const bgScale = $derived.by(() => {
		if (!bgImage) return { x: 1, y: 1, offsetX: 0, offsetY: 0 };
		const scale = Math.max(width / bgImage.width, height / bgImage.height); // Cover scale
		return {
			x: scale,
			y: scale,
			offsetX: (width - bgImage.width * scale) / 2,
			offsetY: (height - bgImage.height * scale) / 2
		};
	});

	function onBubbleDragMove(e: { target: { x(): number; y(): number } }, bubbleId: number) {
		const activeBubble = panel.bubbles.find((b) => b.id === bubbleId);
		if (activeBubble) {
			activeBubble.x = e.target.x();
			activeBubble.y = e.target.y();
		}
	}

	function onBubbleClick(e: KonvaEventObject<MouseEvent>, bubbleId: number) {
		e.cancelBubble = true;
		e.evt.stopPropagation();
		comicState.selectPanel(index);
		comicState.selectBubble(bubbleId);
	}

	function observeSize(node: HTMLElement) {
		const observer = new ResizeObserver(() => {
			width = node.clientWidth;
			height = node.clientHeight;
			comicState.panels[index].stageW = width;
			comicState.panels[index].stageH = height;
		});
		observer.observe(node);
		return () => observer.disconnect();
	}

	// Scalloped thought-cloud outline: anchor points on an inner ellipse,
	// outward quadratic-bezier bumps between them give the puffy silhouette.
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

	// Generate a single seamless SVG Path for the bubble + tail
	function getBubblePathData(type: string, w: number, h: number): string {
		if (type === 'left-cloud' || type === 'right-cloud') {
			return buildCloudPath(w, h);
		}

		const r = type.includes('oval') ? Math.min(w, h) / 2 : type === 'box' ? 0 : 4;

		if (type === 'left-oval' || type === 'box-izq') {
			// Rounded rectangle/oval body with built-in left pointing tail
			return `M ${r} 0 
				L ${w - r} 0 
				A ${r} ${r} 0 0 1 ${w} ${r} 
				L ${w} ${h - r} 
				A ${r} ${r} 0 0 1 ${w - r} ${h} 
				L ${w * 0.45} ${h} 
				L ${w * 0.15} ${h + 15} 
				L ${w * 0.3} ${h} 
				L ${r} ${h} 
				A ${r} ${r} 0 0 1 0 ${h - r} 
				L 0 ${r} 
				A ${r} ${r} 0 0 1 ${r} 0 
				Z`;
		}
		if (type === 'right-oval' || type === 'box-der') {
			// Rounded rectangle/oval body with built-in right pointing tail
			return `M ${r} 0 
				L ${w - r} 0 
				A ${r} ${r} 0 0 1 ${w} ${r} 
				L ${w} ${h - r} 
				A ${r} ${r} 0 0 1 ${w - r} ${h} 
				L ${w * 0.7} ${h} 
				L ${w * 0.85} ${h + 15} 
				L ${w * 0.55} ${h} 
				L ${r} ${h} 
				A ${r} ${r} 0 0 1 0 ${h - r} 
				L 0 ${r} 
				A ${r} ${r} 0 0 1 ${r} 0 
				Z`;
		}
		if (type === 'box') {
			// Caption style flat box
			return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
		}
		if (type === 'burst') {
			const cx = w / 2;
			const cy = h / 2;
			const outerRx = (w / 2) * 0.95;
			const outerRy = (h / 2) * 0.95;
			const innerRx = outerRx * 0.55;
			const innerRy = outerRy * 0.55;
			const numPoints = 12;
			const parts: string[] = [];
			for (let i = 0; i < numPoints * 2; i++) {
				const angle = (i * Math.PI) / numPoints - Math.PI / 2;
				const rx = i % 2 === 0 ? outerRx : innerRx;
				const ry = i % 2 === 0 ? outerRy : innerRy;
				const x = cx + rx * Math.cos(angle);
				const y = cy + ry * Math.sin(angle);
				parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
			}
			return parts.join(' ') + ' Z';
		}
		return '';
	}
</script>

<div
	class="panel-container {className}"
	class:active={isActivePanel}
	role="region"
	aria-label="Comic panel {index + 1}"
	{@attach observeSize}
>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png"
		onchange={handleFileSelect}
		style="display: none;"
	/>
	{#if browser && width > 0 && height > 0}
		<div class="stage-wrapper">
			{#if !bgImage}
				<div class="placeholder" aria-hidden="true">
					<div class="placeholder-content">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="placeholder-icon"
						>
							<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
							<path d="m3 16 5-5a2 2 0 0 1 3 0l5 5" />
							<path d="m14 14 1-1a2 2 0 0 1 3 0l3 3" />
							<circle cx="8" cy="8" r="1.5" />
							<path d="M19 1.5v6" />
							<path d="M16 4.5h6" />
						</svg>
						<span class="placeholder-text">Click or drop an image</span>
					</div>
				</div>
			{/if}
			<div
				class="stage-canvas-wrapper"
				role="region"
				aria-label={'Comic panel drop area for panel ' + (index + 1)}
				ondragover={dragOver}
				ondrop={drop}
			>
				<Stage {width} {height} onclick={handleStageClick}>
					<Layer>
						{#if bgImage}
							<Image
								image={bgImage}
								x={bgScale.offsetX}
								y={bgScale.offsetY}
								scaleX={bgScale.x}
								scaleY={bgScale.y}
								width={bgImage.width}
								height={bgImage.height}
							/>
						{/if}
						{#each bubbles as bubble (bubble.id)}
							{@const isSelected = comicState.activeBubbleId === bubble.id && isActivePanel}
							{@const strokeColor = isSelected ? '#2563eb' : '#000000'}
							{@const strokeW = isSelected ? 3.5 : 3.0}
							<Group
								x={bubble.x}
								y={bubble.y}
								draggable
								ondragmove={(e) => onBubbleDragMove(e, bubble.id)}
								onclick={(e) => onBubbleClick(e, bubble.id)}
							>
								<!-- Seamless Path Bubble Outline -->
								<Path
									data={getBubblePathData(bubble.type, bubble.width, bubble.height)}
									fill="#ffffff"
									stroke={strokeColor}
									strokeWidth={strokeW}
								/>

								<!-- Thought-cloud floating tail circles, trailing down from the bubble -->
								{#if bubble.type === 'left-cloud'}
									<Circle
										x={bubble.width * 0.2}
										y={bubble.height + 6}
										radius={6}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={2}
									/>
									<Circle
										x={bubble.width * 0.1}
										y={bubble.height + 16}
										radius={3.5}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={1.5}
									/>
								{:else if bubble.type === 'right-cloud'}
									<Circle
										x={bubble.width * 0.8}
										y={bubble.height + 6}
										radius={6}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={2}
									/>
									<Circle
										x={bubble.width * 0.9}
										y={bubble.height + 16}
										radius={3.5}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={1.5}
									/>
								{/if}

								<!-- Speech Bubble Text -->
								{@const isCloudT =
									bubble.type === 'left-cloud' || bubble.type === 'right-cloud'}
								{@const isOvalT = bubble.type === 'left-oval' || bubble.type === 'right-oval'}
								{@const padH = isCloudT ? 32 : isOvalT ? 16 : 6}
								{@const padV = isCloudT ? 14 : 6}
								<Text
									text={bubble.text}
									x={padH}
									y={padV}
									width={Math.max(bubble.width - padH * 2, 1)}
									height={Math.max(bubble.height - padV * 2, 1)}
									fontSize={15}
									fontStyle="bold"
									fontFamily="system-ui, sans-serif"
									align="center"
									verticalAlign="middle"
									padding={0}
									fill="#000000"
								/>

								<!-- Top-Right 'X' Delete Badge when selected -->
								{#if isSelected}
									<Group
										x={bubble.width}
										y={0}
										onclick={(e) => {
											e.cancelBubble = true;
											e.evt.stopPropagation();
											comicState.deleteBubble(bubble.id);
										}}
									>
										<Circle radius={10} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
										<Line points={[-4, -4, 4, 4]} stroke="#ffffff" strokeWidth={2} />
										<Line points={[4, -4, -4, 4]} stroke="#ffffff" strokeWidth={2} />
									</Group>
								{/if}
							</Group>
						{/each}
					</Layer>
				</Stage>
			</div>

			{#if uploading}
				<div class="uploading-overlay" aria-hidden="true">
					<div class="uploading-inner">
						<svg class="spinner" viewBox="0 0 50 50" aria-hidden="true">
							<circle
								cx="25"
								cy="25"
								r="20"
								fill="none"
								stroke-width="5"
								stroke="#ffffff"
								stroke-opacity="0.95"
							></circle>
						</svg>
						<div class="uploading-text">Uploading…</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.panel-container {
		border: 4px solid #000000;
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		background-color: #ffffff;
		box-sizing: border-box;
		cursor: pointer;
		transition:
			border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.2s ease;
	}

	.panel-container.active {
		border-color: #2563eb;
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);
		z-index: 5;
	}

	.stage-wrapper {
		position: absolute;
		inset: 0;
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		pointer-events: none;
	}

	.placeholder-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: #94a3b8;
		pointer-events: none;
	}

	.placeholder-icon {
		width: 42px;
		height: 42px;
		flex-shrink: 0;
	}

	.placeholder-text {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: -0.01em;
		text-align: center;
	}

	.stage-canvas-wrapper {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	/* Small upload button overlay (visible and keyboard accessible) */
	.upload-button {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 3;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: none;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
	}

	.upload-button:focus {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	/* Uploading overlay */
	.uploading-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 6;
	}
	.uploading-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: #fff;
	}
	.spinner {
		width: 44px;
		height: 44px;
		animation: spin 1s linear infinite;
	}
	.spinner circle {
		stroke-dasharray: 126;
		stroke-dashoffset: 31.5;
		stroke-linecap: round;
		stroke: #fff;
	}
	.uploading-text {
		margin-top: 6px;
		font-weight: 700;
		color: #fff;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
