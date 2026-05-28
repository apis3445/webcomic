<script lang="ts">
	import '../app.css';
	import { tick } from 'svelte';
	import Panel from '$lib/components/Panel.svelte';
	import BubbleButton from '$lib/components/BubbleButton.svelte';
	import { comicState, type BubbleType } from '$lib/comicState.svelte';

	let bubbleText = $state('');
	let fileInputRef: HTMLInputElement | undefined;
	let printImageUrls = $state<string[]>([]);

	// Reactively sync local textarea text when active bubble changes
	$effect(() => {
		const activeB = comicState.activeBubble;
		if (activeB) {
			bubbleText = activeB.text;
		} else {
			bubbleText = '';
		}
	});

	// Handle typing in the text area
	function handleTextChange(e: Event) {
		const val = (e.target as HTMLTextAreaElement).value;
		bubbleText = val;
		if (comicState.activeBubble) {
			comicState.updateActiveBubbleText(val);
		}
	}

	// Add bubble of specific type
	function handleAddBubble(type: BubbleType) {
		if (comicState.activePanelIndex === undefined) return;
		const text = bubbleText.trim() !== '' ? bubbleText : 'Bubble Text';
		comicState.addBubble(type, text);
	}

	// Global action: Save
	function handleSaveJSON() {
		const jsonStr = comicState.exportJSON();
		const blob = new Blob([jsonStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `comic-draft-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Global action: Open JSON trigger
	function handleOpenJSONClick() {
		fileInputRef?.click();
	}

	function handleFileImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (evt) => {
				const text = evt.target?.result as string;
				if (text) {
					comicState.importJSON(text);
				}
			};
			reader.readAsText(file);
		}
		input.value = '';
	}

	// Print — capture each panel's canvas layers into a flat PNG before printing
	async function handlePrint() {
		const wrappers = document.querySelectorAll('.canvas-workspace .stage-canvas-wrapper');

		printImageUrls = Array.from(wrappers).map((wrapper) => {
			const canvases = wrapper.querySelectorAll('canvas');
			if (!canvases.length) return '';

			const first = canvases[0] as HTMLCanvasElement;
			const composite = document.createElement('canvas');
			composite.width = first.width;
			composite.height = first.height;
			const ctx = composite.getContext('2d');
			if (!ctx) return '';

			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, composite.width, composite.height);
			canvases.forEach((c) => ctx.drawImage(c as HTMLCanvasElement, 0, 0));

			return composite.toDataURL('image/png');
		});

		await tick();
		window.print();
	}
</script>

<div class="app-container no-print">
	<!-- Sleek Top Header & Action Deck -->
	<header class="studio-header">
		<div class="logo-area">
			<span class="emoji-logo">🎨</span>
			<div class="logo-text">
				<h1>Abi's Testing Dojo | Comic generator</h1>
			</div>
		</div>

		<!-- Global Action Toolbar -->
		<div class="workspace-toolbar">
			<button
				class="toolbar-btn primary"
				onclick={() => comicState.clearAll()}
				title="Nuevo (Clear panels)"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M5 12h14M12 5v14" /></svg
				>
				New
			</button>

			<button class="toolbar-btn" onclick={handleOpenJSONClick} title="Open (Load project JSON)">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg
				>
				Open
			</button>
			<input
				bind:this={fileInputRef}
				type="file"
				accept=".json"
				onchange={handleFileImport}
				style="display: none;"
			/>

			<button class="toolbar-btn" onclick={handleSaveJSON} title="Save (Download project JSON)">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline
						points="17 21 17 13 7 13 7 21"
					/><polyline points="7 3 7 8 15 8" /></svg
				>
				Save
			</button>

			<button class="toolbar-btn" onclick={handlePrint} title="Print (Print or PDF)">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><polyline points="6 9 6 2 18 2 18 9" /><path
						d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
					/><rect x="6" y="14" width="12" height="8" /></svg
				>
				Print
			</button>
		</div>
	</header>

	<!-- Main Workspace -->
	<main class="studio-layout">
		<!-- 1. Left Side Canvas Grid -->
		<section class="canvas-workspace">
			<div class="comic-grid">
				<Panel index={0} class="panel-1" />
				<Panel index={1} class="panel-2" />
				<Panel index={2} class="panel-3" />
				<Panel index={3} class="panel-4" />
				<Panel index={4} class="panel-5" />
				<Panel index={5} class="panel-6" />
				<Panel index={6} class="panel-7" />
				<Panel index={7} class="panel-8" />
				<Panel index={8} class="panel-9" />
			</div>
		</section>

		<!-- 2. Right Inspector Sidebar -->
		<aside class="control-sidebar">
			<div class="sidebar-card">
				<h2>Inspector</h2>
				<div class="active-badge">
					{#if comicState.activePanelIndex !== undefined}
						<span>Active Panel: <strong>Panel #{comicState.activePanelIndex + 1}</strong></span>
					{:else}
						<span class="warning">No Panel Selected</span>
					{/if}
				</div>
			</div>

			<!-- Speech Bubble Text Area -->
			<div class="sidebar-card">
				<label for="bubble-text-editor" class="card-label">Texto a insertar:</label>
				<textarea
					id="bubble-text-editor"
					class="bubble-textarea"
					placeholder="Type speech bubble text here..."
					value={bubbleText}
					oninput={handleTextChange}
				></textarea>
			</div>

			<!-- Speech Bubble Shapes Library -->
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

					<BubbleButton type="box-izq" label="Left Box" onclick={() => handleAddBubble('box-izq')} />
					<BubbleButton type="box-der" label="Right Box" onclick={() => handleAddBubble('box-der')} />

					<BubbleButton type="box" label="Box" onclick={() => handleAddBubble('box')} />
				</div>
			</div>
		</aside>
	</main>
</div>

<!-- Print View — uses pre-captured PNG snapshots of each panel's canvas -->
<div class="print-only">
	<div class="print-comic-grid">
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
		background-color: #f8fafc;
		margin: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	.app-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* Studio Header */
	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid #e2e8f0;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
		z-index: 10;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.emoji-logo {
		font-size: 28px;
	}

	.logo-text h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 800;
		color: #007f8a;
		letter-spacing: -0.02em;
	}

	/* Workspace Toolbar */
	.workspace-toolbar {
		display: flex;
		gap: 8px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		font-size: 13.5px;
		font-weight: 600;
		color: #334155;
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.toolbar-btn:hover {
		background: #f1f5f9;
		border-color: #cbd5e1;
		color: #0f172a;
	}

	.toolbar-btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #ffffff;
	}

	.toolbar-btn.primary:hover {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	/* Main Studio Layout */
	.studio-layout {
		display: grid;
		grid-template-columns: 1fr 340px;
		flex: 1;
		overflow: hidden;
		height: 100%;
	}

	/* Canvas Workspace (Left) */
	.canvas-workspace {
		background: #f1f5f9;
		padding: 24px;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	.comic-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, 300px);
		grid-auto-rows: auto;
		gap: 16px;
		width: 100%;
		justify-content: center;
	}

	.comic-grid :global(.panel-container) {
		aspect-ratio: 3 / 4;
		height: auto;
	}

	/* smaller screens tweak: ensure single column on very small viewports */
	@media (max-width: 480px) {
		.comic-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}

	/* Control Sidebar (Right) */
	.control-sidebar {
		background: #ffffff;
		border-left: 1px solid #e2e8f0;
		padding: 20px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: -4px 0 16px rgba(0, 0, 0, 0.02);
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

	.sidebar-card h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: #0f172a;
	}

	.active-badge {
		font-size: 13px;
		color: #475569;
	}

	.card-label {
		font-size: 13px;
		font-weight: 700;
		color: #334155;
		margin-bottom: 2px;
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
		transition: border-color 0.2s ease;
		resize: vertical;
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

	/* Print styling rules */
	.print-only {
		display: none;
	}

	@media print {
		.no-print {
			display: none !important;
		}
		/* Ensure printed pages match US Letter and content fits inside margins */
		@page {
			size: letter portrait;
			margin: 0.5in;
		}

		.print-only {
			display: block !important;
			box-sizing: border-box;
			/* fit the printable area inside the page margins */
			width: calc(8.5in - 1in); /* page width minus left/right margins */
			height: calc(11in - 1in); /* page height minus top/bottom margins */
			margin: 0 auto;
			padding: 0.25in;
		}

		.print-comic-grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 16px;
			width: 100%;
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
