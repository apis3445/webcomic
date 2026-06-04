<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>WebComic — Create your comic</title>
	<meta name="description" content="Create your comic with templates and bubbles!" />
</svelte:head>

<!-- Hero -->
<section class="hero">
	<div class="hero-bg" aria-hidden="true"></div>
	<div class="hero-glow-1" aria-hidden="true"></div>
	<div class="hero-glow-2" aria-hidden="true"></div>
	<div class="hero-halftone" aria-hidden="true"></div>

	<!-- Comic burst bubble -->
	<div class="hero-bubble" aria-hidden="true">
		<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<pattern id="halftone" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
					<circle cx="3" cy="3" r="1.3" fill="#1a237e" />
				</pattern>
			</defs>
			<!-- Halftone corner accents -->
			<circle cx="16" cy="16" r="16" fill="url(#halftone)" opacity="0.45" />
			<circle cx="184" cy="16" r="16" fill="url(#halftone)" opacity="0.45" />
			<circle cx="16" cy="184" r="16" fill="url(#halftone)" opacity="0.45" />
			<circle cx="184" cy="184" r="16" fill="url(#halftone)" opacity="0.45" />
			<!-- Burst shape (12-spike polygon) -->
			<polygon
				points="192,100 165.7,117.6 179.7,146 148.1,148.1 146,179.7 117.6,165.7 100,192 82.4,165.7 54,179.7 51.9,148.1 20.3,146 34.3,117.6 8,100 34.3,82.4 20.3,54 51.9,51.9 54,20.3 82.4,34.3 100,8 117.6,34.3 146,20.3 148.1,51.9 179.7,54 165.7,82.4"
				fill="#ffffff"
				stroke="#1a237e"
				stroke-width="5"
				stroke-linejoin="miter"
			/>
			<!-- Tick marks -->
			<g stroke="#1a237e" stroke-width="4" stroke-linecap="round">
				<line x1="166" y1="31" x2="171" y2="22" />
				<line x1="159" y1="27" x2="164" y2="18" />
				<line x1="34" y1="31" x2="29" y2="22" />
				<line x1="41" y1="27" x2="36" y2="18" />
				<line x1="174" y1="87" x2="183" y2="84" />
				<line x1="174" y1="97" x2="183" y2="94" />
				<line x1="170" y1="167" x2="177" y2="175" />
				<line x1="163" y1="163" x2="170" y2="171" />
			</g>
			<!-- Text -->
			<text
				x="100"
				y="93"
				text-anchor="middle"
				font-family="Caveat, cursive"
				font-weight="700"
				font-size="28"
				fill="#1a237e">It's</text
			>
			<text
				x="100"
				y="122"
				text-anchor="middle"
				font-family="Caveat, cursive"
				font-weight="700"
				font-size="28"
				fill="#1a237e">Free!</text
			>
		</svg>
	</div>

	<div class="hero-content">
		<h1 class="hero-title">Your Story.<br />Your Comic.</h1>
		<p class="hero-sub">
			Turn your ideas into a webcomic in minutes. Pick a template, drop in your images, add speech
			bubbles — and share it with the world.
		</p>
		<div class="hero-ctas">
			<a href={resolve('/login')} class="cta-primary">
				<svg
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.5"
						d="M13 10V3L4 14h7v7l9-11h-7z"
					/>
				</svg>
				Try it free
			</a>
			<a href={resolve('/comic')} class="cta-ghost">Editor →</a>
		</div>
		<p class="hero-note">Takes about 5 minutes · No design skills needed</p>
	</div>
</section>

<!-- How it works -->
<section class="features" id="features">
	<div class="features-inner">
		<h2 class="section-title">Make a comic in one afternoon.</h2>
		<div class="cards">
			<div class="card card-1">
				<div class="step-num-bg">
					<div class="step-num">01</div>
				</div>
				<h3 class="card-title">Choose your template</h3>
				<p class="card-desc">
					Pick from ready-made panel layouts. Mix and stack them any way you like — no code, no
					fuss.
				</p>
			</div>
			<div class="card card-2">
				<div class="step-num-bg">
					<div class="step-num">02</div>
				</div>
				<h3 class="card-title">Drop in your images</h3>
				<p class="card-desc">
					Drag your artwork or photos into each panel. Resize, crop, and arrange until it looks just
					right.
				</p>
			</div>
			<div class="card card-3">
				<div class="step-num-bg">
					<div class="step-num">03</div>
				</div>
				<h3 class="card-title">Add speech bubbles</h3>
				<p class="card-desc">
					Place bubbles anywhere, type your dialogue, and style them to match your comic's
					personality.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA strip -->
<section class="cta-strip">
	<div class="cta-strip-inner">
		<p class="cta-strip-eyebrow">What are you waiting for?</p>
		<h2 class="cta-strip-title">Your first comic is one click away.</h2>
		<a href={resolve('/login')} class="cta-primary">
			<svg
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				width="18"
				height="18"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M13 10V3L4 14h7v7l9-11h-7z"
				/>
			</svg>
			Create your comic — it's free
		</a>
		<p class="cta-strip-note">
			No account? <a href={resolve('/comic')} class="cta-strip-link">Browse comics first</a>
		</p>
	</div>
</section>

<style>
	/* ── Animations ── */
	@keyframes float {
		0%,
		100% {
			transform: translateY(0) rotate(12deg);
		}
		50% {
			transform: translateY(-12px) rotate(10deg);
		}
	}

	@keyframes glow {
		0%,
		100% {
			opacity: 0.12;
			transform: scale(1);
		}
		50% {
			opacity: 0.18;
			transform: scale(1.1);
		}
	}

	/* ── Hero ── */
	.hero {
		position: relative;
		min-height: calc(100vh - 64px);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #f4f7fc;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		background-image: url('/comic_hero_bg.png');
		background-size: cover;
		background-position: center;
		opacity: 0.16;
		z-index: 1;
		mix-blend-mode: multiply;
	}

	.hero-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(244, 247, 252, 0.1) 0%,
			rgba(244, 247, 252, 0.5) 60%,
			#f4f7fc 100%
		);
	}

	/* Soft glowing pastel ambient spots based on #3f51b5 */
	.hero-glow-1 {
		position: absolute;
		top: 10%;
		right: 15%;
		width: 450px;
		height: 450px;
		background: radial-gradient(circle, rgba(63, 81, 181, 0.22) 0%, transparent 70%);
		filter: blur(40px);
		z-index: 2;
		animation: glow 8s ease-in-out infinite;
	}

	.hero-glow-2 {
		position: absolute;
		bottom: 10%;
		left: 10%;
		width: 500px;
		height: 500px;
		background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
		filter: blur(50px);
		z-index: 2;
		animation: glow 10s ease-in-out infinite alternate;
	}

	/* Retro comic halftone dot overlay */
	.hero-halftone {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(63, 81, 181, 0.05) 1.5px, transparent 1.5px);
		background-size: 24px 24px;
		opacity: 0.8;
		z-index: 3;
		pointer-events: none;
	}

	.hero-bubble {
		position: absolute;
		right: 8%;
		top: 20%;
		width: 160px;
		height: 160px;
		transform: rotate(12deg);
		z-index: 20;
		filter: drop-shadow(4px 4px 0 rgba(26, 35, 126, 0.15));
		pointer-events: none;
		animation: float 4.5s ease-in-out infinite;
	}

	.hero-bubble svg {
		width: 100%;
		height: 100%;
	}

	.hero-content {
		position: relative;
		z-index: 10;
		text-align: center;
		padding: 4rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.8rem;
		max-width: 720px;
		margin: 0 auto;
	}

	.hero-title {
		font-family: 'Caveat', cursive;
		font-size: clamp(3.8rem, 10vw, 7rem);
		font-weight: 700;
		line-height: 0.9;
		margin: 0;
		letter-spacing: 0.04em;
		color: #fbbf24;
		-webkit-text-stroke: 3px #1a237e;
		text-shadow:
			6px 6px 0 #3f51b5,
			12px 12px 0 rgba(63, 81, 181, 0.2);
		paint-order: stroke fill;
	}

	.hero-sub {
		font-size: 1.25rem;
		font-weight: 500;
		color: #283593;
		margin: 0;
		line-height: 1.75;
		max-width: 560px;
	}

	.hero-ctas {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.cta-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.9rem 2rem;
		background: #fbbf24;
		color: #1a237e;
		text-decoration: none;
		font-size: 1.1rem;
		font-weight: 800;
		border-radius: 10px;
		border: 3px solid #1a237e;
		box-shadow: 5px 5px 0 #1a237e;
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease;
		font-family: 'Patrick Hand', sans-serif;
	}

	.cta-primary:hover {
		transform: translate(-2px, -2px);
		box-shadow: 7px 7px 0 #1a237e;
	}

	.cta-primary:active {
		transform: translate(2px, 2px);
		box-shadow: 3px 3px 0 #1a237e;
	}

	.cta-ghost {
		color: #3f51b5;
		text-decoration: none;
		font-size: 1.05rem;
		font-weight: 600;
		padding: 0.8rem 1.8rem;
		border-radius: 10px;
		background: rgba(63, 81, 181, 0.04);
		border: 2px solid rgba(63, 81, 181, 0.2);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s,
			transform 0.15s;
	}

	.cta-ghost:hover {
		border-color: #fbbf24;
		color: #b45309;
		background: rgba(251, 191, 36, 0.08);
		transform: translateY(-1px);
	}

	.hero-note {
		font-size: 1.05rem;
		font-weight: 600;
		color: #3f51b5;
		letter-spacing: 0.01em;
		margin: 0;
	}

	/* ── Features ── */
	.features {
		background: #f4f7fc;
		padding: 6rem 1.5rem;
		position: relative;
	}

	/* Subtle transition separator */
	.features::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(63, 81, 181, 0.15), transparent);
	}

	.features-inner {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4rem;
	}

	.section-title {
		font-family: 'Caveat', cursive;
		font-size: clamp(2.4rem, 6vw, 3.8rem);
		font-weight: 700;
		letter-spacing: 0.05em;
		color: #1a237e;
		margin: 0;
		text-align: center;
		text-shadow: 0 4px 12px rgba(63, 81, 181, 0.05);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2.2rem;
		width: 100%;
	}

	/* Comic panels styled with white backgrounds and blue shadows (#3f51b5) */
	.card {
		background: #ffffff;
		border: 3.5px solid #1a237e;
		border-radius: 16px;
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-shadow: 8px 8px 0 #3f51b5;
		transition:
			border-color 0.25s,
			box-shadow 0.25s,
			transform 0.25s;
		position: relative;
		overflow: hidden;
	}

	.card-1 {
		transform: rotate(-0.7deg);
	}
	.card-2 {
		transform: rotate(0.8deg);
	}
	.card-3 {
		transform: rotate(-0.5deg);
	}

	.card:hover {
		border-color: #00bcd4;
		box-shadow: 12px 12px 0 #00bcd4;
		transform: translateY(-6px) scale(1.02) rotate(0deg);
		z-index: 10;
	}

	/* Dotted halftone background for step indicator */
	.step-num-bg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 12px;
		border: 2.5px solid #1a237e;
		background: radial-gradient(rgba(63, 81, 181, 0.08) 1.5px, transparent 1.5px), #e8eaf6;
		background-size: 8px 8px;
		margin-bottom: 0.5rem;
		align-self: flex-start;
	}

	.step-num {
		font-family: 'Caveat', cursive;
		font-size: 2.4rem;
		font-weight: 700;
		color: #3f51b5;
		line-height: 1;
		text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.8);
	}

	.card-title {
		font-family: 'Comic Neue', cursive;
		font-size: 1.45rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #1a237e;
		margin: 0;
	}

	.card-desc {
		font-size: 1.05rem;
		color: #374151;
		margin: 0;
		line-height: 1.7;
	}

	/* ── CTA strip ── */
	.cta-strip {
		background: linear-gradient(135deg, #e8eaf6 0%, #e0f7fa 100%);
		border-top: 3.5px solid #1a237e;
		border-bottom: 3.5px solid #1a237e;
		padding: 6rem 1.5rem;
		position: relative;
		overflow: hidden;
	}

	/* Halftone effect overlay in CTA Strip */
	.cta-strip::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(63, 81, 181, 0.03) 1.5px, transparent 1.5px);
		background-size: 20px 20px;
		opacity: 0.8;
		pointer-events: none;
	}

	.cta-strip-inner {
		max-width: 680px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		text-align: center;
		position: relative;
		z-index: 2;
	}

	.cta-strip-eyebrow {
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #3f51b5;
		margin: 0;
		text-transform: uppercase;
	}

	.cta-strip-title {
		font-family: 'Caveat', cursive;
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #1a237e;
		margin: 0 0 0.5rem;
		text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.8);
	}

	.cta-strip-note {
		font-size: 0.95rem;
		color: #374151;
		margin: 0;
	}

	.cta-strip-link {
		color: #1a237e;
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.15s;
	}

	.cta-strip-link:hover {
		color: #fbbf24;
	}

	@media (max-width: 900px) {
		.cards {
			grid-template-columns: 1fr;
			gap: 1.8rem;
		}

		.card {
			transform: none !important;
		}
	}

	@media (max-width: 768px) {
		.hero-bubble {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.hero-ctas {
			flex-direction: column;
			width: 100%;
		}

		.cta-primary,
		.cta-ghost {
			width: 100%;
			justify-content: center;
		}
	}
</style>
