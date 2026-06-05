<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
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
	// Read reactively so navigation back to this page (or `invalidateAll()`
	// after a delete) reflects the latest server state instead of a stale
	// snapshot. The previous local mutation pattern lost reactivity for any
	// state change other than delete.
	const comics = $derived<ComicSummary[]>((data.comics as ComicSummary[]) ?? []);

	let deleteError = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	async function deleteComic(c: ComicSummary) {
		if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
		deleteError = null;
		deletingId = c.id;
		try {
			const res = await fetch(`/api/comics/${c.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				deleteError = body?.error ?? 'Could not delete comic. Please try again.';
				return;
			}
			// Re-fetch the comics list from the server instead of trying to
			// patch local state — guarantees the UI matches the DB even if
			// background changes happened.
			await invalidateAll();
		} catch (e) {
			console.error('delete error', e);
			deleteError = 'Network error. Please check your connection and try again.';
		} finally {
			deletingId = null;
		}
	}

	function dismissDeleteError() {
		deleteError = null;
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

	{#if deleteError}
		<div class="delete-error" role="alert" aria-live="assertive">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<span>{deleteError}</span>
			<button type="button" class="delete-error-close" onclick={dismissDeleteError} aria-label="Dismiss">×</button>
		</div>
	{/if}

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
						<button
							class="action-btn action-delete"
							onclick={() => deleteComic(c)}
							disabled={deletingId === c.id}
						>
							{deletingId === c.id ? 'Deleting…' : 'Delete'}
						</button>
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

	.delete-error {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		margin-bottom: 1rem;
		background: #fee2e2;
		color: #991b1b;
		border: 2.5px solid #1a237e;
		border-radius: 10px;
		box-shadow: 3px 3px 0 #3f51b5;
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.35;
	}

	.delete-error svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: #991b1b;
		margin-top: 1px;
	}

	.delete-error span {
		flex: 1;
		min-width: 0;
		word-break: break-word;
	}

	.delete-error-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: #991b1b;
		font-size: 1.4rem;
		font-weight: 800;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.25rem;
	}

	.delete-error-close:hover {
		color: #1a237e;
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
