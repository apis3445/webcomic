<script lang="ts">
	import { resolve } from '$app/paths';

	type PublicComic = {
		id: string;
		name: string | null;
		description: string | null;
		thumbnail_url: string | null;
	};

	const { data } = $props() as { data: { comics: PublicComic[] } };
</script>

<svelte:head>
	<title>Browse comics</title>
	<meta name="description" content="Browse public comics created by the community." />
</svelte:head>

<section class="page">
	<header class="page-header">
		<h1>Browse comics</h1>
		<p class="subtitle">Discover comics published by the community.</p>
	</header>

	{#if data.comics.length === 0}
		<div class="empty">
			<div class="empty-icon">📚</div>
			<p class="empty-title">No public comics yet</p>
			<p class="empty-sub">Be the first to publish one!</p>
			<a href={resolve('/comic')} class="empty-cta">Create a comic</a>
		</div>
	{:else}
		<div class="grid">
			{#each data.comics as comic (comic.id)}
				<a class="card" href={resolve(`/comics/${comic.id}`)}>
					<div class="cover">
						{#if comic.thumbnail_url}
							<img src={comic.thumbnail_url} alt={comic.name ?? 'Comic cover'} />
						{:else}
							<div class="cover-placeholder" aria-hidden="true">
								<span>📄</span>
							</div>
						{/if}
					</div>
					<div class="card-body">
						<h2 class="card-title">{comic.name ?? 'Untitled'}</h2>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 48px 24px 64px;
	}

	.page-header {
		text-align: center;
		margin-bottom: 40px;
	}

	.page-header h1 {
		font-family: 'Caveat', cursive;
		font-size: clamp(2.6rem, 6vw, 4rem);
		color: #1a237e;
		margin: 0 0 8px;
		letter-spacing: 0.03em;
	}

	.subtitle {
		font-size: 1.05rem;
		color: #475569;
		margin: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 24px;
	}

	.card {
		background: #ffffff;
		border: 3px solid #1a237e;
		border-radius: 14px;
		box-shadow: 6px 6px 0 #3f51b5;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.card:hover {
		transform: translate(-2px, -2px);
		box-shadow: 9px 9px 0 #3f51b5;
	}

	.cover {
		width: 100%;
		aspect-ratio: 3 / 4;
		background: #f1f5f9;
		overflow: hidden;
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cover-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		opacity: 0.5;
		background: linear-gradient(135deg, #e8eaf6 0%, #e0f7fa 100%);
	}

	.card-body {
		padding: 12px 14px 14px;
	}

	.card-title {
		font-family: 'Comic Neue', 'Patrick Hand', cursive;
		font-size: 1.1rem;
		font-weight: 700;
		color: #1a237e;
		margin: 0;
		line-height: 1.3;
		word-break: break-word;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 64px 24px;
		gap: 10px;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #0f172a;
		margin: 0;
	}

	.empty-sub {
		font-size: 0.95rem;
		color: #64748b;
		margin: 0 0 12px;
	}

	.empty-cta {
		display: inline-flex;
		align-items: center;
		padding: 0.7rem 1.6rem;
		background: #fbbf24;
		color: #1a237e;
		text-decoration: none;
		font-weight: 800;
		border-radius: 10px;
		border: 3px solid #1a237e;
		box-shadow: 4px 4px 0 #1a237e;
	}

	.empty-cta:hover {
		transform: translate(-1px, -1px);
		box-shadow: 6px 6px 0 #1a237e;
	}

	@media (max-width: 480px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 16px;
		}
	}
</style>
