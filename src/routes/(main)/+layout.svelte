<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data, children } = $props();
</script>

<div class="layout">
	<Navbar user={data.user ?? null} />
	<main class="layout-content">
		{@render children()}
	</main>
	<Footer />
</div>

<style>
	.layout {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.layout-content {
		flex: 1;
		padding-bottom: 40px;
	}
</style>
