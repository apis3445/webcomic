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

<form method="POST" action="?/signUp" use:enhance={handleSubmit}>
	{#if form?.tab === 'register' && form?.message !== undefined}
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

	<div class="field">
		<label for="su-email" class="field-label">Email address</label>
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
				id="su-email"
				name="email"
				type="email"
				class="field-input"
				placeholder="you@example.com"
				required
			/>
		</div>
	</div>

	<div class="field">
		<label for="su-password" class="field-label">Password</label>
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
				id="su-password"
				name="password"
				type="password"
				class="field-input"
				placeholder="Min. 6 characters"
				required
				minlength="6"
			/>
		</div>
	</div>

	<div class="field">
		<label for="su-confirm" class="field-label">Confirm password</label>
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
				id="su-confirm"
				name="confirm"
				type="password"
				class="field-input"
				placeholder="Repeat password"
				required
				minlength="6"
			/>
		</div>
	</div>

	<button class="submit-btn" type="submit" disabled={loading}>
		{#if loading}
			<span class="spinner"></span>
			<span>Creating account...</span>
		{:else}
			<svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
				/>
			</svg>
			<span>Create account</span>
		{/if}
	</button>
</form>
