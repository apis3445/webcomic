<script lang="ts">
	interface Props {
		size?: 'sm' | 'lg';
	}
	let { size = 'sm' }: Props = $props();
</script>

<span class="z-mark" class:lg={size === 'lg'} aria-hidden="true">
	<span class="z-block z-top"></span>
	<span class="z-block z-diag"></span>
	<span class="z-block z-bottom"></span>
</span>
<span class="logo-text" class:lg={size === 'lg'}>
	<span class="logo-zine">zine</span><span class="logo-mash">mash</span>
</span>

<style>
	.z-mark {
		position: relative;
		display: inline-block;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
	}

	.z-mark.lg {
		width: 76px;
		height: 76px;
	}

	.z-block {
		position: absolute;
		border: 2px solid #000;
		box-shadow: 4px 4px 0 #000;
	}

	.z-mark.lg .z-block {
		border-width: 3px;
		box-shadow: 6px 6px 0 #000;
	}

	.z-top {
		top: 0;
		left: 0;
		width: 32px;
		height: 10px;
		background: #facc15;
		transform: rotate(-4deg);
		z-index: 3;
	}

	.z-mark.lg .z-top {
		width: 64px;
		height: 20px;
	}

	.z-diag {
		top: 14px;
		left: 4px;
		width: 30px;
		height: 10px;
		background: #06b6d4;
		transform: rotate(-45deg);
		transform-origin: center;
		z-index: 2;
	}

	.z-mark.lg .z-diag {
		top: 28px;
		left: 8px;
		width: 60px;
		height: 20px;
	}

	.z-bottom {
		bottom: 0;
		right: 0;
		width: 32px;
		height: 10px;
		background: #ffffff;
		transform: rotate(3deg);
		z-index: 1;
	}

	.z-mark.lg .z-bottom {
		width: 64px;
		height: 20px;
	}

	.logo-text {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 1.65rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1;
		text-transform: lowercase;
	}

	.logo-text.lg {
		font-size: clamp(3rem, 7vw, 4.6rem);
	}

	.logo-zine {
		color: #ffffff;
	}

	.logo-mash {
		color: #06b6d4;
	}
</style>
