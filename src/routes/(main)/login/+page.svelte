<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, SubmitFunction } from './$types.js';
	import PasswordLogin from '$lib/components/PasswordLogin.svelte';
	import SignUp from '$lib/components/SignUp.svelte';
	import Logo from '$lib/components/Logo.svelte';

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
	<title>Sign In — Zinemash</title>
</svelte:head>

<div class="page">
	<section class="hero">
		<div class="hero-left">
			<div class="hero-copy">
				<div class="badge">✦ New — Comic creator v2</div>
				<h1 class="hero-title">
					<Logo size="lg" />
				</h1>
				<p class="hero-sub">
					Mash your pages into a zine — drop photos, panels and doodles into a comic universe.
				</p>
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
		display: flex;
		align-items: center;
		gap: 1.1rem;
		margin: 0;
		line-height: 1;
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
		gap: 0.4rem;
		padding: 0.3rem;
		background: rgba(63, 81, 181, 0.08);
		border: 2.5px solid #1a237e;
		border-radius: 14px;
		box-shadow: 3px 3px 0 #3f51b5;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.55rem 0.6rem;
		background: transparent;
		border: 2px solid transparent;
		border-radius: 8px;
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		color: #3f51b5;
		cursor: pointer;
		transition:
			color 0.18s,
			background 0.18s,
			border-color 0.18s,
			box-shadow 0.12s,
			transform 0.08s;
	}

	.tab-btn:hover {
		color: #1a237e;
		background: rgba(255, 255, 255, 0.6);
	}

	.tab-btn.active {
		color: #1a237e;
		background: #fbbf24;
		border-color: #1a237e;
		box-shadow: 2px 2px 0 #1a237e;
	}

	/* RIGHT PANEL */
	.hero-right {
		position: relative;
		width: 42%;
		background: #f4f7fc;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		border-left: 2.5px solid #1a237e;
		min-height: 100%;
	}

	/* Halftone dot pattern background matching landing page */
	.hero-right::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(63, 81, 181, 0.08) 1.5px, transparent 1.5px);
		background-size: 18px 18px;
		pointer-events: none;
		z-index: 0;
	}

	.form-wrap {
		position: relative;
		z-index: 1;
		padding: 3rem 3rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		font-family: 'Comic Neue', system-ui, sans-serif;
	}

	.form-header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-title {
		font-family: 'Caveat', cursive;
		font-size: 3rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		margin: 0;
		color: #fbbf24;
		line-height: 0.95;
		-webkit-text-stroke: 2px #1a237e;
		text-shadow: 4px 4px 0 #3f51b5;
		paint-order: stroke fill;
	}

	.form-desc {
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1.05rem;
		color: #283593;
		margin: 0 0 0.2rem;
		line-height: 1.5;
	}

	/* ── FORM FIELDS (shared with PasswordLogin / SignUp children) ── */
	:global(.field) {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1.1rem;
	}

	:global(.field-label) {
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		color: #1a237e;
		letter-spacing: 0.01em;
	}

	:global(.field-input-wrap) {
		position: relative;
		display: flex;
		align-items: center;
	}

	:global(.field-input-wrap.has-icon .field-icon) {
		position: absolute;
		left: 0.85rem;
		width: 18px;
		height: 18px;
		color: #3f51b5;
		pointer-events: none;
		z-index: 1;
	}

	:global(.field-input) {
		width: 100%;
		padding: 0.75rem 1rem;
		font-family: 'Comic Neue', 'Patrick Hand', sans-serif;
		font-size: 1rem;
		font-weight: 500;
		color: #1a237e;
		background: #ffffff;
		border: 2.5px solid #1a237e;
		border-radius: 10px;
		box-shadow: 3px 3px 0 #3f51b5;
		transition:
			border-color 0.15s,
			box-shadow 0.1s,
			transform 0.1s;
		box-sizing: border-box;
	}

	:global(.field-input-wrap.has-icon .field-input) {
		padding-left: 2.5rem;
	}

	:global(.field-input::placeholder) {
		color: #9ca3c4;
		font-weight: 400;
	}

	:global(.field-input:focus) {
		outline: none;
		border-color: #1a237e;
		box-shadow: 4px 4px 0 #06b6d4;
	}

	:global(.field-input:hover:not(:focus)) {
		transform: translate(-1px, -1px);
		box-shadow: 4px 4px 0 #3f51b5;
	}

	:global(.field-error) {
		display: block;
		margin-top: 0.3rem;
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 0.95rem;
		font-weight: 700;
		color: #dc2626;
	}

	/* ── SUBMIT BUTTON (shared) — mirrors .cta-primary on landing ── */
	:global(.submit-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.9rem 1.5rem;
		margin-top: 0.5rem;
		font-family: 'Patrick Hand', sans-serif;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: #1a237e;
		background: #fbbf24;
		border: 3px solid #1a237e;
		border-radius: 10px;
		box-shadow: 5px 5px 0 #1a237e;
		cursor: pointer;
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease,
			background 0.15s;
	}

	:global(.submit-btn:hover:not(:disabled)) {
		transform: translate(-2px, -2px);
		box-shadow: 7px 7px 0 #1a237e;
		background: #fcd34d;
	}

	:global(.submit-btn:active:not(:disabled)) {
		transform: translate(2px, 2px);
		box-shadow: 3px 3px 0 #1a237e;
	}

	:global(.submit-btn:disabled) {
		cursor: not-allowed;
		opacity: 0.65;
	}

	:global(.btn-icon) {
		width: 18px;
		height: 18px;
	}

	:global(.spinner) {
		width: 16px;
		height: 16px;
		border: 2.5px solid rgba(26, 35, 126, 0.25);
		border-top-color: #1a237e;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── MESSAGE BANNERS (shared) ── */
	:global(.msg-banner) {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.75rem 0.9rem;
		border: 2.5px solid #1a237e;
		border-radius: 10px;
		box-shadow: 3px 3px 0 #3f51b5;
		font-family: 'Patrick Hand', 'Comic Neue', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	:global(.msg-banner.success) {
		background: #d1fae5;
		color: #065f46;
	}

	:global(.msg-banner.error) {
		background: #fee2e2;
		color: #991b1b;
	}

	:global(.msg-icon) {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		margin-top: 2px;
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
