<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, SubmitFunction } from './$types.js';
	import PasswordLogin from '$lib/components/PasswordLogin.svelte';
	import SignUp from '$lib/components/SignUp.svelte';

	interface Props {
		form: ActionData;
	}
	let { form }: Props = $props();

	let loading = $state(false);
	let email = $state('');
	let activeTab = $state<'magic' | 'password' | 'register'>('magic');

	const handleSubmit: SubmitFunction = () => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	};
</script>

<svelte:head>
	<title>Sign In — WebComic</title>
</svelte:head>

<div class="page">
	<section class="hero">
		<div class="hero-left">
			<div class="hero-copy">
				<div class="badge">✦ New — Comic creator v2</div>
				<h1 class="hero-title">Web Comic</h1>
				<p class="hero-sub">Create your comic universe with exciting templates and features!</p>
			</div>
		</div>

		<div class="hero-right" id="signin">
			<div class="form-wrap">
				<div class="form-header">
					<h2 class="form-title">
						{activeTab === 'register' ? 'Create account' : 'Sign In'}
					</h2>
				</div>

				<div class="auth-body">
					<div class="auth-tabs" role="tablist">
						<button
							role="tab"
							class="tab-btn"
							class:active={activeTab === 'magic'}
							aria-selected={activeTab === 'magic'}
							onclick={() => (activeTab = 'magic')}
						>
							<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
							Magic link
						</button>
						<button
							role="tab"
							class="tab-btn"
							class:active={activeTab === 'register'}
							aria-selected={activeTab === 'register'}
							onclick={() => (activeTab = 'register')}
						>
							<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 118 0zM3 20a6 6 0 0112 0v1H3v-1z"
								/>
							</svg>
							Register
						</button>
						<button
							role="tab"
							class="tab-btn"
							class:active={activeTab === 'password'}
							aria-selected={activeTab === 'password'}
							onclick={() => (activeTab = 'password')}
						>
							<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
							Sign in
						</button>
					</div>

					<p class="form-desc">
						{#if activeTab === 'magic'}
							Enter your email and we'll send you a sign-in link — no password needed.
						{:else if activeTab === 'password'}
							Sign in with your email and password.
						{:else}
							Create a new account with your email and a password.
						{/if}
					</p>

					{#if activeTab === 'magic'}
						<form method="POST" action="?/magicLink" use:enhance={handleSubmit}>
							{#if (form as Record<string, unknown>)?.tab === 'magic' && (form as Record<string, unknown>)?.message !== undefined}
								<div
									class="msg-banner {(form as Record<string, unknown>)?.success
										? 'success'
										: 'error'}"
								>
									<svg class="msg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if (form as Record<string, unknown>)?.success}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										{:else}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										{/if}
									</svg>
									<span>{(form as Record<string, unknown>)?.message as string}</span>
								</div>
							{/if}

							<div class="field">
								<label for="email" class="field-label">Email address</label>
								<div class="field-input-wrap has-icon">
									<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
									<input
										id="email"
										name="email"
										type="email"
										class="field-input"
										placeholder="you@example.com"
										bind:value={email}
										required
									/>
								</div>
								{#if (form as Record<string, unknown>)?.errors}
									<span class="field-error"
										>{((form as Record<string, unknown>).errors as Record<string, string>)
											.email}</span
									>
								{/if}
							</div>

							<button class="submit-btn" type="submit" disabled={loading}>
								{#if loading}
									<span class="spinner"></span>
									<span>Sending...</span>
								{:else}
									<svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
									<span>Email me a sign-in link</span>
								{/if}
							</button>
						</form>
					{:else if activeTab === 'password'}
						<PasswordLogin form={form as Record<string, unknown>} />
					{:else}
						<SignUp form={form as Record<string, unknown>} />
					{/if}
				</div>
			</div>

			<footer class="form-footer">
				Made with <span class="heart">❤️</span> for creators by Abi
			</footer>
		</div>
	</section>
</div>

<style>
	.page {
		min-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
	}

	/* ── HERO SPLIT ── */
	.hero {
		display: flex;
		flex-direction: row;
		flex: 1;
	}

	/* LEFT PANEL */
	.hero-left {
		position: relative;
		width: 58%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		background-image: url('/comic_hero_bg.png');
		background-size: cover;
		background-position: center;
	}

	.hero-left::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(0, 0, 0, 0.55) 0%,
			rgba(30, 0, 60, 0.35) 50%,
			transparent 100%
		);
		pointer-events: none;
		z-index: 1;
	}

	.hero-copy {
		position: relative;
		z-index: 10;
		padding: 3rem 3.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		max-width: 480px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #fbbf24;
		color: #1e1b4b;
		font-size: 0.82rem;
		font-weight: 700;
		padding: 0.4rem 1.1rem;
		border-radius: 999px;
		border: 2px solid #000;
		box-shadow: 3px 3px 0 #000;
		width: fit-content;
		letter-spacing: 0.01em;
	}

	.hero-title {
		font-family: 'Bangers', cursive;
		font-size: clamp(4rem, 8vw, 6rem);
		line-height: 0.9;
		margin: 0;
		letter-spacing: 0.05em;
		white-space: nowrap;
		color: #fef08a;
		-webkit-text-stroke: 3px #000;
		text-shadow:
			5px 5px 0 #4a0080,
			9px 9px 0 rgba(74, 0, 128, 0.45);
		paint-order: stroke fill;
	}

	.hero-sub {
		font-size: 1.1rem;
		font-weight: 500;
		color: #fff;
		margin: 0;
		line-height: 1.65;
		max-width: 380px;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
	}

	/* ── TABS ── */
	.auth-body {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.auth-tabs {
		display: flex;
		border-bottom: 2px solid #e2e8f0;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.7rem 1rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		font-size: 0.88rem;
		font-weight: 600;
		color: #94a3b8;
		cursor: pointer;
		transition:
			color 0.18s,
			border-color 0.18s;
		font-family: inherit;
	}

	.tab-btn:hover {
		color: #5b21b6;
	}

	.tab-btn.active {
		color: #5b21b6;
		border-bottom-color: #5b21b6;
	}

	/* RIGHT PANEL */
	.hero-right {
		width: 42%;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		border-left: 1px solid #e2e8f0;
		min-height: 100%;
	}

	.heart {
		color: #ef4444;
	}

	/* ── RESPONSIVE ── */
	@media (max-width: 900px) {
		.hero {
			flex-direction: column;
		}

		.hero-left {
			width: 100%;
			min-height: 70vw;
			align-items: flex-end;
			justify-content: center;
		}

		.hero-right {
			width: 100%;
			min-height: unset;
			border-left: none;
			border-top: 1px solid #e2e8f0;
		}

		.form-wrap {
			padding: 2.5rem 1.5rem;
		}

		.hero-copy {
			padding: 2rem 2rem 2.5rem;
			text-align: center;
			align-items: center;
		}
	}
</style>
