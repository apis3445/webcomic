<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let { supabase } = $derived(data);

	onMount(() => {
		const { data: authData } = supabase.auth.onAuthStateChange((event) => {
			if (event !== 'INITIAL_SESSION') {
				invalidate('supabase:auth');
			}
		});

		return () => authData.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>WebComic</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Comic+Neue:wght@300;400;700&family=Patrick+Hand&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}
