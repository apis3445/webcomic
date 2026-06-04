<script lang="ts">
	import type { BubbleType } from '../comicState.svelte';

	let {
		type,
		label,
		active = false,
		onclick
	}: {
		type: BubbleType;
		label: string;
		active?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button type="button" class="bubble-btn" class:active {onclick} aria-label="Add {label} bubble">
	<div class="svg-container">
		{#if type === 'left-oval'}
			<!-- Oval Left Preview -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="4"
					y="2"
					width="40"
					height="22"
					rx="11"
					ry="11"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<path
					d="M14 23 L10 29 L18 23"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linejoin="round"
				/>
			</svg>
		{:else}
			<!-- Fallback placeholder or specific bubble style -->
		{/if}

		{#if type === 'right-oval'}
			<!-- Oval Right Preview -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="4"
					y="2"
					width="40"
					height="22"
					rx="11"
					ry="11"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<path
					d="M34 23 L38 29 L30 23"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}

		{#if type === 'left-cloud'}
			<!-- Cloud Left Preview (Thought Bubble) -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M12 18 C8 18 5 15 5 12 C5 9 8 6 12 6 C13 3 17 1 22 1 C28 1 32 4 33 8 C37 8 40 10 40 13 C40 16 37 19 33 19 Z"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<circle
					cx="10"
					cy="23"
					r="2.5"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<circle
					cx="7"
					cy="27"
					r="1.5"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.25"
				/>
			</svg>
		{/if}

		{#if type === 'right-cloud'}
			<!-- Cloud Right Preview -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M15 19 C11 19 8 16 8 13 C8 10 11 8 15 8 C16 4 20 1 26 1 C31 1 35 3 36 6 C40 6 43 9 43 12 C43 15 40 18 36 18 Z"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<circle
					cx="38"
					cy="23"
					r="2.5"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<circle
					cx="41"
					cy="27"
					r="1.5"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.25"
				/>
			</svg>
		{/if}

		{#if type === 'box-izq'}
			<!-- Square Box Left Tail -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="4"
					y="2"
					width="40"
					height="20"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<path
					d="M12 22 L8 28 L16 22"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}

		{#if type === 'box-der'}
			<!-- Square Box Right Tail -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="4"
					y="2"
					width="40"
					height="20"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<path
					d="M36 22 L40 28 L32 22"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}

		{#if type === 'box'}
			<!-- Neutral Caption Box -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="4"
					y="5"
					width="40"
					height="22"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
				/>
				<line
					x1="8"
					y1="11"
					x2="40"
					y2="11"
					stroke="currentColor"
					stroke-width="1"
					stroke-dasharray="2 2"
				/>
				<line
					x1="8"
					y1="16"
					x2="32"
					y2="16"
					stroke="currentColor"
					stroke-width="1"
					stroke-dasharray="2 2"
				/>
			</svg>
		{/if}

		{#if type === 'burst'}
			<!-- Burst / Explosion Bubble Preview -->
			<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<polygon
					points="24,1 25.85,8.29 31.64,3.48 28.85,10.47 36.36,9.98 30,14 36.36,18.02 28.85,17.53 31.64,24.52 25.85,19.71 24,27 22.15,19.71 16.36,24.52 19.15,17.53 11.64,18.02 18,14 11.64,9.98 19.15,10.47 16.36,3.48 22.15,8.29"
					fill="var(--preview-bg)"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linejoin="miter"
				/>
			</svg>
		{/if}
	</div>
	<span class="label-text">{label}</span>
</button>

<style>
	.bubble-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 10px 8px;
		background: #ffffff;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		cursor: pointer;
		color: #64748b;
		--preview-bg: #ffffff;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		min-width: 80px;
	}

	.bubble-btn:hover {
		color: #2563eb;
		border-color: #3b82f6;
		--preview-bg: #eff6ff;
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
	}

	.bubble-btn.active {
		color: #ffffff;
		background: #2563eb;
		border-color: #2563eb;
		--preview-bg: #2563eb;
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
	}

	.bubble-btn.active:hover {
		color: #ffffff;
		background: #1d4ed8;
		border-color: #1d4ed8;
		--preview-bg: #1d4ed8;
	}

	.svg-container {
		width: 46px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 6px;
	}

	.svg-container svg {
		width: 100%;
		height: 100%;
	}

	.label-text {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-align: center;
	}
</style>
