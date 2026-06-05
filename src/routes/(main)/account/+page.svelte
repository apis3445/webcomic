<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Avatar from './Avatar.svelte';

	let { data, form } = $props();
	let { claims, supabase, profile } = $derived(data);
	let profileForm: HTMLFormElement;
	let loadingProfile = $state(false);
	let loadingPassword = $state(false);
	let loadingSignOut = $state(false);
	let fullName = $derived(profile?.full_name ?? '');
	let username = $derived(profile?.username ?? '');
	let website = $derived(profile?.website ?? '');
	let avatarUrl = $derived(profile?.avatar_url ?? '');

	const handleSubmit: SubmitFunction = () => {
		loadingProfile = true;
		return async ({ update }) => {
			loadingProfile = false;
			update();
		};
	};

	const handlePasswordSubmit: SubmitFunction = () => {
		loadingPassword = true;
		return async ({ update }) => {
			loadingPassword = false;
			update();
		};
	};

	const handleSignOut: SubmitFunction = () => {
		loadingSignOut = true;
		return async ({ update }) => {
			loadingSignOut = false;
			update();
		};
	};
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Lora:wght@600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="account-page">
	<div class="account-layout">
		<!-- Sidebar -->
		<aside class="sidebar">
			<div class="sidebar-inner">
				<div class="sidebar-avatar-wrap">
					<Avatar
						{supabase}
						bind:url={avatarUrl}
						onupload={() => profileForm.requestSubmit()}
					/>
				</div>
				<div class="sidebar-identity">
					<h2 class="sidebar-name">{fullName || 'Your Name'}</h2>
					<p class="sidebar-email">{claims?.email ?? ''}</p>
				</div>
				<div class="sidebar-divider"></div>
				<form method="post" action="?/signout" use:enhance={handleSignOut}>
					<button class="signout-btn" type="submit" disabled={loadingSignOut}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
							/>
						</svg>
						Sign out
					</button>
				</form>
			</div>
		</aside>

		<!-- Main content -->
		<main class="main-content">
			<!-- Profile section -->
			<section class="content-section">
				<div class="section-header">
					<div class="section-icon-wrap">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
							/>
						</svg>
					</div>
					<div>
						<h3 class="section-title">Profile</h3>
						<p class="section-desc">Update your personal information</p>
					</div>
				</div>

				<form method="post" action="?/update" use:enhance={handleSubmit} bind:this={profileForm}>
					<input type="hidden" name="avatarUrl" value={avatarUrl} />

					<div class="form-grid">
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
									type="text"
									value={claims?.email ?? ''}
									disabled
									class="field-input"
								/>
							</div>
						</div>

						<div class="field">
							<label for="fullName" class="field-label">Full name</label>
							<div class="field-input-wrap has-icon">
								<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								<input
									id="fullName"
									class="field-input"
									name="fullName"
									type="text"
									value={form?.fullName ?? fullName}
									placeholder="Jane Doe"
								/>
							</div>
						</div>

						<div class="field">
							<label for="username" class="field-label">Username</label>
							<div class="field-input-wrap has-icon">
								<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
									/>
								</svg>
								<input
									id="username"
									class="field-input"
									name="username"
									type="text"
									value={form?.username ?? username}
									placeholder="@yourname"
								/>
							</div>
						</div>

						<div class="field">
							<label for="website" class="field-label">Website</label>
							<div class="field-input-wrap has-icon">
								<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
									/>
								</svg>
								<input
									id="website"
									class="field-input"
									name="website"
									type="url"
									value={form?.website ?? website}
									placeholder="https://yoursite.com"
								/>
							</div>
						</div>
					</div>

					<div class="form-actions">
						<input
							type="submit"
							class="submit-btn"
							value={loadingProfile ? 'Saving...' : 'Save changes'}
							disabled={loadingProfile}
						/>
					</div>
				</form>
			</section>

			<!-- Password section -->
			<section class="content-section">
				<div class="section-header">
					<div class="section-icon-wrap">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					</div>
					<div>
						<h3 class="section-title">Password</h3>
						<p class="section-desc">Add or update your sign-in password</p>
					</div>
				</div>

				<form method="post" action="?/setPassword" use:enhance={handlePasswordSubmit}>
					{#if form?.action === 'setPassword' && form?.message !== undefined}
						<div class="msg-banner {form.success ? 'success' : 'error'}">
							<svg class="msg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if form.success}
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
							<span>{form.message}</span>
						</div>
					{/if}

					<div class="form-grid">
						<div class="field">
							<label for="new-password" class="field-label">New password</label>
							<div class="field-input-wrap has-icon">
								<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
								<input
									id="new-password"
									name="password"
									type="password"
									class="field-input"
									placeholder="Min. 6 characters"
									minlength="6"
									required
								/>
							</div>
						</div>

						<div class="field">
							<label for="confirm-password" class="field-label">Confirm password</label>
							<div class="field-input-wrap has-icon">
								<svg class="field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<input
									id="confirm-password"
									name="confirm"
									type="password"
									class="field-input"
									placeholder="Repeat password"
									minlength="6"
									required
								/>
							</div>
						</div>
					</div>

					<div class="form-actions">
						<input
							type="submit"
							class="submit-btn"
							value={loadingPassword ? 'Saving...' : 'Set password'}
							disabled={loadingPassword}
						/>
					</div>
				</form>
			</section>
		</main>
	</div>
</div>

<style>
	.account-page {
		display: flex;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.account-layout {
		display: grid;
		grid-template-columns: 260px 1fr;
		gap: 1.5rem;
		width: 100%;
		max-width: 860px;
		align-items: start;
	}

	/* ── Sidebar ── */
	.sidebar {
		border-radius: 16px;
		background: linear-gradient(135deg, #3f51b5, #1a237e);
		box-shadow: 0 8px 32px rgba(91, 33, 182, 0.35);
		overflow: hidden;
		position: sticky;
		top: 2rem;
	}

	.sidebar-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem 1.5rem 1.5rem;
		gap: 1rem;
	}

	.sidebar-avatar-wrap {
		margin-bottom: 0.25rem;
	}

	.sidebar-identity {
		text-align: center;
	}

	.sidebar-name {
		font-family: 'Lora', 'Georgia', serif;
		font-size: 1.1rem;
		font-weight: 700;
		color: #fff;
		margin: 0 0 0.3rem;
		line-height: 1.3;
	}

	.sidebar-email {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.65);
		margin: 0;
		word-break: break-all;
	}

	.sidebar-divider {
		width: 100%;
		height: 1px;
		background: rgba(255, 255, 255, 0.15);
		margin: 0.25rem 0;
	}

	.signout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.65rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.signout-btn svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.signout-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.18);
		color: #fff;
		border-color: rgba(255, 255, 255, 0.35);
	}

	.signout-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── Main content ── */
	.main-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.content-section {
		background: #fff;
		border-radius: 16px;
		padding: 1.75rem 2rem;
		box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* ── Section header ── */
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding-bottom: 1.25rem;
		border-bottom: 1.5px solid #f1f5f9;
	}

	.section-icon-wrap {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 10px;
		background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.section-icon-wrap svg {
		width: 1.1rem;
		height: 1.1rem;
		color: #5b21b6;
	}

	.section-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
		margin: 0 0 0.15rem;
	}

	.section-desc {
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 0;
	}

	/* ── Form grid ── */
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-actions {
		padding-top: 0.25rem;
	}

	/* ── Responsive ── */
	@media (max-width: 680px) {
		.account-layout {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.content-section {
			padding: 1.5rem;
		}
	}
</style>
