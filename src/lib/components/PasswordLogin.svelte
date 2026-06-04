<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	interface Props {
		form: Record<string, unknown> | null;
	}
	let { form }: Props = $props();

	let loading = $state(false);

	const handleSubmit: SubmitFunction = () => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	};
</script>

<form method="POST" action="?/password" use:enhance={handleSubmit}>
	{#if form?.tab === 'password' && form?.message !== undefined}
		<div class="msg-banner {form.success ? 'success' : 'error'}">
			<svg class="msg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="field">
		<label for="pw-email" class="field-label">Email address</label>
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
				id="pw-email"
				name="email"
				type="email"
				class="field-input"
				placeholder="you@example.com"
				required
			/>
		</div>
	</div>

	<div class="field">
		<label for="pw-password" class="field-label">Password</label>
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
				id="pw-password"
				name="password"
				type="password"
				class="field-input"
				placeholder="••••••••"
				required
			/>
		</div>
	</div>

	<button class="submit-btn" type="submit" disabled={loading}>
		{#if loading}
			<span class="spinner"></span>
			<span>Signing in...</span>
		{:else}
			<svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
				/>
			</svg>
			<span>Sign in</span>
		{/if}
	</button>
</form>
