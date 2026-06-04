<script>
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	const error = $derived(
		$page.url.searchParams.get('error_description') ?? 'Something went wrong during sign in.'
	);
</script>

<svelte:head>
	<title>Sign in error — WebComic</title>
</svelte:head>

<div class="wrap">
	<div class="card">
		<div class="icon">⚠️</div>
		<h1 class="title">Sign in failed</h1>
		<p class="desc">{error}</p>
		<a href={resolve('/login')} class="btn">Try again</a>
	</div>
</div>

<style>
	.wrap {
		min-height: calc(100vh - 64px);
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fff;
		padding: 2rem;
	}

	.card {
		background: #1e1b4b;
		border: 2px solid rgba(251, 191, 36, 0.25);
		border-radius: 14px;
		padding: 2.5rem 2rem;
		max-width: 420px;
		width: 100%;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.icon {
		font-size: 2.5rem;
	}

	.title {
		font-family: 'Bangers', cursive;
		font-size: 2rem;
		letter-spacing: 0.05em;
		color: #fef08a;
		margin: 0;
	}

	.desc {
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.95rem;
		margin: 0;
		line-height: 1.6;
	}

	.btn {
		margin-top: 0.5rem;
		padding: 0.6rem 1.4rem;
		background: #fbbf24;
		color: #1e1b4b;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 700;
		border-radius: 6px;
		border: 2px solid #000;
		box-shadow: 3px 3px 0 #000;
		transition:
			transform 0.1s,
			box-shadow 0.1s;
	}

	.btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: 4px 4px 0 #000;
	}
</style>
