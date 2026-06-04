<script lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
	const { data } = $props();
	const { comic, panels: orderedPanels } = data as { comic: any; panels: any[] };

	// panels is an ordered array of { panel, bubbles, image }
	const panels = orderedPanels || [];
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

	<section class="published-grid">
		{#each panels as item (item.panel.id)}
			<div class="published-cell">
				{#if item.image?.public_url}
					<img
						src={item.image.public_url}
						alt={item.image.filename || 'Panel image'}
						loading="lazy"
					/>
				{:else}
					<div class="placeholder">Image not available</div>
				{/if}

				{#if item.bubbles?.length}
					<ul class="bubble-list">
						{#each item.bubbles as b (b.id)}
							<li class="bubble-text">{b.text}</li>
						{/each}
					</ul>
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
</style>
