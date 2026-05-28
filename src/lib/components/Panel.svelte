<script lang="ts">
	import { browser } from '$app/environment';
	import { Stage, Layer, Image, Group, Text, Rect, Circle, Line, Path } from 'svelte-konva';
	import type { KonvaEventObject } from 'konva/lib/Node';
	import { comicState } from '../comicState.svelte';

	let { index, class: className = '' }: { index: number; class?: string } = $props();

	let width = $state(0);
	let height = $state(0);
	let fileInput: HTMLInputElement | undefined;

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

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
			comicState.setPanelBgImage(index, URL.createObjectURL(file));
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	function openFilePicker(e?: Event) {
		e?.stopPropagation();
		fileInput?.click();
	}

	function handleStageClick(e: KonvaEventObject<MouseEvent>) {
		e.evt.stopPropagation();
		comicState.selectPanel(index);
		if (!bgImage) {
			openFilePicker();
		}
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
		e.evt.stopPropagation();
		comicState.selectPanel(index);
		comicState.selectBubble(bubbleId);
	}

	function observeSize(node: HTMLElement) {
		const observer = new ResizeObserver(() => {
			width = node.clientWidth;
			height = node.clientHeight;
		});
		observer.observe(node);
		return () => observer.disconnect();
	}

	// Generate a single seamless SVG Path for the bubble + tail
	function getBubblePathData(type: string, w: number, h: number): string {
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
		return '';
	}
</script>

<div
	class="panel-container {className}"
	class:active={isActivePanel}
	role="region"
	aria-label="Comic panel {index + 1}"
	{@attach observeSize}
	ondragover={dragOver}
	ondrop={drop}
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
			<div class="stage-canvas-wrapper">
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
								<!-- Seamless Path Bubble Outline for Ovals and Boxes -->
								{#if bubble.type !== 'left-cloud' && bubble.type !== 'right-cloud'}
									<Path
										data={getBubblePathData(bubble.type, bubble.width, bubble.height)}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={strokeW}
									/>
								{:else}
									<!-- Cloud thought bubble with floating circles -->
									{#if bubble.type === 'left-cloud'}
										<Circle
											cx={bubble.width * 0.25}
											cy={bubble.height + 4}
											radius={6}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={2}
										/>
										<Circle
											cx={bubble.width * 0.15}
											cy={bubble.height + 11}
											radius={4}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={1.5}
										/>
										<Circle
											cx={bubble.width * 0.08}
											cy={bubble.height + 16}
											radius={2.5}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={1}
										/>
									{:else if bubble.type === 'right-cloud'}
										<Circle
											cx={bubble.width * 0.75}
											cy={bubble.height + 4}
											radius={6}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={2}
										/>
										<Circle
											cx={bubble.width * 0.85}
											cy={bubble.height + 11}
											radius={4}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={1.5}
										/>
										<Circle
											cx={bubble.width * 0.92}
											cy={bubble.height + 16}
											radius={2.5}
											fill="#ffffff"
											stroke={strokeColor}
											strokeWidth={1}
										/>
									{/if}
									<Rect
										width={bubble.width}
										height={bubble.height}
										fill="#ffffff"
										stroke={strokeColor}
										strokeWidth={strokeW}
										cornerRadius={18}
									/>
								{/if}

								<!-- Speech Bubble Text -->
								<Text
									text={bubble.text}
									fontSize={15}
									fontStyle="bold"
									fontFamily="system-ui, sans-serif"
									align="center"
									verticalAlign="middle"
									width={bubble.width}
									height={bubble.height}
									padding={10}
									fill="#000000"
								/>

								<!-- Top-Right 'X' Delete Badge when selected -->
								{#if isSelected}
									<Group
										x={bubble.width}
										y={0}
										onclick={(e) => {
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
</style>
