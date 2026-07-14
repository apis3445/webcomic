<script>
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const error = $derived(
		page.url.searchParams.get('error_description') ?? 'Something went wrong during sign in.'
	);
</script>

<svelte:head>
	<title>Sign in error — Zinemash</title>
</svelte:head>

<div class="wrap">
	<div class="halftone" aria-hidden="true"></div>

	<div class="card">
		<div class="badge" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="32" height="32">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
				/>
			</svg>
		</div>

		<h1 class="title">Oops!</h1>
		<p class="kicker">Sign in failed</p>
		<p class="desc">{error}</p>

		<a href={resolve('/login')} class="btn">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16m0 5v-5h5"
				/>
			</svg>
			Try again
		</a>
	</div>
</div>

<style>
	.wrap {
		position: relative;
		/* Full viewport: this page lives outside the (main) layout group, so
		   there is no navbar to subtract. */
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f4f7fc;
		padding: 2rem;
		overflow: hidden;
	}

	.halftone {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(63, 81, 181, 0.08) 1.5px, transparent 1.5px);
		background-size: 18px 18px;
		pointer-events: none;
		z-index: 0;
	}

	.card {
		position: relative;
		z-index: 1;
		background: #ffffff;
		border: 3px solid #1a237e;
		border-radius: 16px;
		box-shadow: 8px 8px 0 #3f51b5;
		padding: 2.5rem 2rem 2rem;
		max-width: 440px;
		width: 100%;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
		font-family: 'Comic Neue', system-ui, sans-serif;
	}

	.badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		background: #fbbf24;
		color: #1a237e;
		border: 3px solid #1a237e;
		border-radius: 50%;
		box-shadow: 4px 4px 0 #1a237e;
		margin-bottom: 0.2rem;
		transform: rotate(-6deg);
	}

	.title {
		font-family: 'Caveat', cursive;
		font-size: 3.4rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #fbbf24;
		-webkit-text-stroke: 2.5px #1a237e;
		text-shadow: 5px 5px 0 #3f51b5;
		paint-order: stroke fill;
		margin: 0;
		line-height: 0.95;
	}

	.kicker {
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1a237e;
		margin: 0;
		letter-spacing: 0.01em;
	}

	.desc {
		font-family: 'Comic Neue', sans-serif;
		color: #283593;
		font-size: 1rem;
		margin: 0.2rem 0 0.8rem;
		line-height: 1.55;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
		padding: 0.8rem 1.6rem;
		background: #fbbf24;
		color: #1a237e;
		text-decoration: none;
		font-family: 'Patrick Hand', sans-serif;
		font-size: 1.1rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		border-radius: 10px;
		border: 3px solid #1a237e;
		box-shadow: 5px 5px 0 #1a237e;
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease,
			background 0.15s;
	}

	.btn:hover {
		transform: translate(-2px, -2px);
		box-shadow: 7px 7px 0 #1a237e;
		background: #fcd34d;
	}

	.btn:active {
		transform: translate(2px, 2px);
		box-shadow: 3px 3px 0 #1a237e;
	}

	@media (max-width: 480px) {
		.card {
			padding: 2rem 1.4rem;
		}

		.title {
			font-size: 2.8rem;
		}
	}
</style>
