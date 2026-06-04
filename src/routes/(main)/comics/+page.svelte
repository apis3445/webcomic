<script lang="ts">
import { onMount } from 'svelte';
import { resolve } from '$app/paths';
import { goto } from '$app/navigation';
import { comicState, type ComicStateType } from '$lib/comicState.svelte';

let comics: any[] = [];
let loading = false;

onMount(async () => {
loading = true;
try {
const res = await fetch('/api/my-comics');
if (res.ok) {
const data = await res.json();
comics = data.comics || [];
}
} catch (e) {
console.error('Failed to load comics', e);
} finally {
loading = false;
}
});

async function deleteComic(c: any) {
if (!confirm(`Delete \"${c.name}\"? This cannot be undone.`)) return;
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

function editComic(c: any) {
comicState.setComicId(c.id);
comicState.setTitle(c.name || 'Untitled');
goto(resolve('/comic'));
}
</script>

<svelte:head>
<title>My Comics</title>
</svelte:head>

<section class="page-container">
<h1>My Comics</h1>
{#if loading}
<p>Loading…</p>
{:else if comics.length === 0}
<p>No comics yet. <a href={resolve('/comic')}>Create one</a>.</p>
{:else}
<ul class="comic-list">
{#each comics as c (c.id)}
<li class="comic-item">
<div class="comic-info">
<span class="comic-name">{c.name}</span>
{#if c.is_public}
<span class="comic-badge">Public</span>
{/if}
{#if (comicState as ComicStateType).comicId === c.id}
<span class="comic-badge current">Current</span>
{/if}
</div>
<div class="comic-actions">
<button on:click={() => editComic(c)}>Edit</button>
<button on:click={() => deleteComic(c)}>Delete</button>
<a href={resolve(`/comics/${c.id}`)} target="_blank" rel="noopener">View</a>
</div>
</li>
{/each}
</ul>
{/if}
</section>

<style>
.page-container { padding: 24px; }
.comic-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.comic-item { display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #e6eafc; padding:12px; border-radius:8px; }
.comic-info { display:flex; align-items:center; gap:8px; }
.comic-name { font-weight:700; }
.comic-actions { display:flex; gap:8px; }
.comic-badge { background:#e6f4ea; color:#065f46; padding:2px 6px; border-radius:999px; font-size:0.8rem; }
.comic-badge.current { background:#dbeafe; color:#1e40af; }
</style>
