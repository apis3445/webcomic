<!-- src/routes/account/Avatar.svelte -->
<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';

	interface Props {
		url?: string;
		supabase: SupabaseClient;
		onupload?: () => void;
	}
	let { url = $bindable(), supabase, onupload }: Props = $props();

	let avatarUrl: string | null = $state(null);
	let uploading = $state(false);
	let files: FileList | undefined = $state();

	const downloadImage = async (path: string) => {
		try {
			const { data, error } = await supabase.storage.from('avatars').download(path);
			if (error) throw error;
			avatarUrl = URL.createObjectURL(data);
		} catch (error) {
			if (error instanceof Error) {
				console.log('Error downloading image: ', error.message);
			}
		}
	};

	const uploadAvatar = async () => {
		try {
			uploading = true;
			if (!files || files.length === 0) {
				throw new Error('You must select an image to upload.');
			}
			const file = files[0];
			const fileExt = file.name.split('.').pop();
			const filePath = `${Math.random()}.${fileExt}`;
			const { error } = await supabase.storage.from('avatars').upload(filePath, file);
			if (error) throw error;
			url = filePath;
			setTimeout(() => {
				onupload?.();
			}, 100);
		} catch (error) {
			if (error instanceof Error) {
				alert(error.message);
			}
		} finally {
			uploading = false;
		}
	};

	$effect(() => {
		if (url) downloadImage(url);
	});
</script>

<div class="avatar-wrapper">
	<div class="avatar-ring">
		<label class="avatar-label" for="avatar-upload">
			{#if avatarUrl}
				<img src={avatarUrl} alt="Avatar" class="avatar-img" />
			{:else}
				<div class="avatar-placeholder">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
						/>
					</svg>
				</div>
			{/if}
			<div class="avatar-overlay">
				{#if uploading}
					<div class="upload-spinner"></div>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
						/>
					</svg>
					<span>Change photo</span>
				{/if}
			</div>
		</label>
	</div>
	<input
		type="file"
		id="avatar-upload"
		accept="image/*"
		bind:files
		onchange={uploadAvatar}
		disabled={uploading}
		style="display: none;"
	/>
</div>

<style>
	.avatar-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.avatar-ring {
		width: 7rem;
		height: 7rem;
		border-radius: 50%;
		padding: 3px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 100%);
	}

	.avatar-label {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
		cursor: pointer;
		position: relative;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-placeholder svg {
		width: 2.5rem;
		height: 2.5rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.avatar-overlay {
		position: absolute;
		inset: 0;
		background: rgba(59, 7, 100, 0.75);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: white;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.avatar-overlay svg {
		width: 1.4rem;
		height: 1.4rem;
	}

	.avatar-label:hover .avatar-overlay {
		opacity: 1;
	}

	.upload-spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
