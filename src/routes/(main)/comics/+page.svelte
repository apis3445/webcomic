<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { comicState } from '$lib/comicState.svelte';
	import type { PageData } from './$types';

	interface ComicSummary {
		id: string;
		name: string;
		is_public: boolean | null;
		updated_at: string | null;
		thumbnail_path: string | null;
		thumbnail_url: string | null;
	}

	const { data }: { data: PageData } = $props();
	let comics = $state<ComicSummary[]>(untrack(() => data.comics as ComicSummary[]) ?? []);

	async function deleteComic(c: ComicSummary) {
		if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
		try {
			const res = await fetch(`/api/comics/${c.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				alert(body?.error ?? 'Delete failed');
				return;
			}
			comics = comics.filter((x) => x.id !== c.id);
		} catch (e) {
			console.error('delete error', e);
			alert('Delete failed');
		}
	}

	function editComic(c: ComicSummary) {
		goto(resolve(`/comic?id=${c.id}`));
	}

	function createNewComic() {
		goto(resolve('/comic'));
	}

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>My Comics</title>
</svelte:head>

<section class="page-container">
	<div class="page-header">
		<h1>My Comics</h1>
		<button class="create-button" onclick={createNewComic}>+ New Comic</button>
	</div>

	{#if comics.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📖</div>
			<p class="empty-title">No comics yet</p>
			<p class="empty-sub">Create your first comic to get started</p>
			<button class="create-button" onclick={createNewComic}>+ Create Comic</button>
		</div>
	{:else}
		<div class="comics-grid">
			{#each comics as c (c.id)}
				<div class="comic-card">
					<button class="card-cover-btn" onclick={() => editComic(c)}>
						{#if c.thumbnail_url}
							<img src={c.thumbnail_url} alt={c.name} class="card-cover" />
						{:else}
							<div class="card-cover card-cover-placeholder">
								<span class="placeholder-icon">📄</span>
							</div>
						{/if}
					</button>

					<div class="card-body">
						<div class="card-meta">
							<span class="card-name">{c.name}</span>
							<div class="card-badges">
								{#if c.is_public}
									<span class="badge badge-public">Public</span>
								{/if}
								{#if comicState.comicId === c.id}
									<span class="badge badge-current">Current</span>
								{/if}
							</div>
						</div>
						{#if c.updated_at}
							<span class="card-date">{formatDate(c.updated_at)}</span>
						{/if}
					</div>

					<div class="card-actions">
						<button class="action-btn action-edit" onclick={() => editComic(c)}>Edit</button>
						<a
							href={resolve(`/comics/${c.id}`)}
							target="_blank"
							rel="noopener"
							class="action-btn action-view">View</a
						>
						<button class="action-btn action-delete" onclick={() => deleteComic(c)}>Delete</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-container {
		padding: 32px 24px;
		max-width: 1100px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 28px;
	}

	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
	}

	.create-button {
		background: #007f8a;
		color: #fff;
		border: none;
		padding: 10px 20px;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}

	.create-button:hover {
		background: #005f68;
	}

	/* ── Empty state ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 24px;
		gap: 10px;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		line-height: 1;
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
		margin: 0 0 8px;
	}

	/* ── Card grid ── */
	.comics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 20px;
	}

	.comic-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		transition: box-shadow 0.18s, transform 0.18s;
	}

	.comic-card:hover {
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	/* Cover */
	.card-cover-btn {
		all: unset;
		cursor: pointer;
		display: block;
		width: 100%;
	}

	.card-cover {
		width: 100%;
		aspect-ratio: 3 / 4;
		display: block;
		object-fit: cover;
		background: #f1f5f9;
	}

	.card-cover-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
	}

	.placeholder-icon {
		font-size: 2.5rem;
		opacity: 0.5;
	}

	/* Card body */
	.card-body {
		padding: 12px 14px 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.card-meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}

	.card-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.3;
		word-break: break-word;
	}

	.card-badges {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.badge {
		padding: 2px 7px;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.badge-public {
		background: #dcfce7;
		color: #166534;
	}

	.badge-current {
		background: #dbeafe;
		color: #1e40af;
	}

	.card-date {
		font-size: 0.78rem;
		color: #94a3b8;
	}

	/* Card actions */
	.card-actions {
		display: flex;
		gap: 6px;
		padding: 10px 14px 12px;
		border-top: 1px solid #f1f5f9;
	}

	.action-btn {
		flex: 1;
		padding: 6px 0;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		border: 1px solid transparent;
		transition: background 0.12s;
	}

	.action-edit {
		background: #007f8a;
		color: #fff;
		border-color: #007f8a;
	}

	.action-edit:hover {
		background: #005f68;
		border-color: #005f68;
	}

	.action-view {
		background: #f8fafc;
		color: #334155;
		border-color: #e2e8f0;
	}

	.action-view:hover {
		background: #e2e8f0;
	}

	.action-delete {
		background: #fff1f2;
		color: #be123c;
		border-color: #fecdd3;
	}

	.action-delete:hover {
		background: #fecdd3;
	}

	@media (max-width: 480px) {
		.comics-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.page-header h1 {
			font-size: 1.4rem;
		}
	}
</style>
