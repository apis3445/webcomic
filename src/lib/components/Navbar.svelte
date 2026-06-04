<script lang="ts">
	import type { User } from '@supabase/supabase-js';
	import { resolve } from '$app/paths';
	import type { Attachment } from 'svelte/attachments';

	interface Props {
		user: User | null;
	}
	let { user }: Props = $props();

	let menuOpen = $state(false);

	const displayName = $derived(
		(user?.user_metadata?.full_name as string | undefined) ||
			user?.email?.split('@')[0] ||
			'Account'
	);

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	const closeOnOutside: Attachment<HTMLElement> = (node) => {
		if (!menuOpen) return;

		function handleClick(event: MouseEvent) {
			if (!node.contains(event.target as Node)) closeMenu();
		}
		function handleKey(event: KeyboardEvent) {
			if (event.key === 'Escape') closeMenu();
		}

		document.addEventListener('click', handleClick);
		document.addEventListener('keydown', handleKey);

		return () => {
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKey);
		};
	};
</script>

<header class="navbar">
	<div class="navbar-inner">
		<a href={resolve('/')} class="logo">
			<span class="logo-text">WebComic</span>
		</a>

		<nav class="nav-links">
			{#if user}
				<a href={resolve('/comics')} class="nav-link">My Comics</a>
				<a href={resolve('/comic')} class="nav-link">New Comic</a>
			{:else}
				<a href={resolve('/#features')} class="nav-link">How it works</a>
				<a href={resolve('/comic')} class="nav-link">Editor</a>
			{/if}
		</nav>

		<div class="nav-actions">
			{#if user}
				<div class="user-menu" {@attach closeOnOutside}>
					<button
						type="button"
						class="user-trigger"
						onclick={toggleMenu}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
					>
						<svg
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							width="15"
							height="15"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						<span class="user-name-text">{displayName}</span>
						<svg
							class="chevron"
							class:open={menuOpen}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							width="12"
							height="12"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{#if menuOpen}
						<div class="user-dropdown" role="menu">
							<a
								href={resolve('/account')}
								class="dropdown-item"
								role="menuitem"
								onclick={closeMenu}
							>
								<svg
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									width="16"
									height="16"
									aria-hidden="true"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								Account
							</a>
							<form method="POST" action="/auth/signout">
								<button type="submit" class="dropdown-item dropdown-signout" role="menuitem">
									<svg
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										width="16"
										height="16"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
										/>
									</svg>
									Sign Out
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<a href={resolve('/login')} class="btn-primary">Sign In</a>
			{/if}
		</div>
	</div>
</header>

<style>
	.navbar {
		position: sticky;
		top: 0;
		z-index: 100;
		background: #3f51b5;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 2.5px solid rgba(255, 255, 255, 0.15);
	}

	/* Micro dot overlay pattern in header */
	.navbar::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1.5px, transparent 1.5px);
		background-size: 16px 16px;
		pointer-events: none;
		z-index: -1;
	}

	.navbar-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1.5rem;
		height: 64px;
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		flex-shrink: 0;
		transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.logo:hover {
		transform: scale(1.05) rotate(-2deg);
	}

	.logo-text {
		font-family: 'Comic Neue', sans-serif;
		font-size: 1.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #ffffff;
		text-shadow: 2px 2px 0 rgba(26, 35, 126, 0.6);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
	}

	.nav-link {
		padding: 0.5rem 1rem;
		color: rgba(255, 255, 255, 0.85);
		text-decoration: none;
		font-size: 0.92rem;
		font-weight: 600;
		border-radius: 8px;
		transition:
			color 0.15s,
			background 0.15s,
			transform 0.1s;
	}

	.nav-link:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	/* Logged-in dropdown */
	.user-menu {
		position: relative;
	}

	.user-trigger {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: rgba(255, 255, 255, 0.05);
		border: 2px solid rgba(255, 255, 255, 0.25);
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.9rem;
		font-weight: 600;
		font-family: inherit;
		padding: 0.45rem 0.9rem;
		border-radius: 8px;
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s,
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.user-trigger:hover,
	.user-trigger[aria-expanded='true'] {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.15);
		border-color: #ffffff;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.05);
	}

	.user-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 130px;
	}

	.chevron {
		transition: transform 0.18s ease;
		flex-shrink: 0;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.user-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 180px;
		background: #ffffff;
		border: 3px solid #1a237e;
		border-radius: 12px;
		box-shadow: 6px 6px 0 #3f51b5;
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 200;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.6rem 0.85rem;
		background: none;
		border: none;
		color: #1a237e;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		text-align: left;
		text-decoration: none;
		border-radius: 6px;
		cursor: pointer;
		transition:
			color 0.12s,
			background 0.12s;
	}

	.dropdown-item:hover,
	.dropdown-item:focus-visible {
		background: rgba(63, 81, 181, 0.06);
		color: #3f51b5;
		outline: none;
	}

	.dropdown-signout {
		color: #4b5563;
	}

	.dropdown-signout:hover,
	.dropdown-signout:focus-visible {
		color: #dc2626;
		background: rgba(239, 68, 68, 0.06);
	}

	.user-dropdown form {
		margin: 0;
	}

	.btn-primary {
		padding: 0.5rem 1.2rem;
		background: #fbbf24;
		color: #1a237e;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 700;
		border-radius: 8px;
		border: 2px solid #1a237e;
		box-shadow: 3px 3px 0 #1a237e;
		transition:
			transform 0.1s,
			box-shadow 0.1s;
	}

	.btn-primary:hover {
		transform: translate(-1px, -1px);
		box-shadow: 4.5px 4.5px 0 #1a237e;
	}

	.btn-primary:active {
		transform: translate(1px, 1px);
		box-shadow: 1.5px 1.5px 0 #1a237e;
	}

	@media (max-width: 640px) {
		.nav-links {
			display: none;
		}

		.user-name-text {
			max-width: 90px;
		}
	}

</style>
