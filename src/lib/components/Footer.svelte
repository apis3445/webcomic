<footer class="footer">
	<!-- Halftone dot overlay -->
	<div class="footer-halftone" aria-hidden="true"></div>

	<!-- Bottom bar -->
	<div class="footer-bottom">
		<p class="footer-copy">© {new Date().getFullYear()} WebComic. Made with ❤️ for storytellers.</p>
		<p class="footer-made">Your story, your comicss.</p>
	</div>
</footer>

<style>
	.footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: linear-gradient(135deg, #e8eaf6 0%, #e3f2fd 100%);
		border-top: 3.5px solid #1a237e;
		overflow: hidden;
	}

	/* Halftone dot overlay */
	.footer-halftone {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(63, 81, 181, 0.04) 1.5px, transparent 1.5px);
		background-size: 22px 22px;
		pointer-events: none;
		z-index: 0;
	}

	/* ── Bottom bar ── */
	.footer-bottom {
		position: relative;
		z-index: 1;
		border-top: 2px solid rgba(26, 35, 126, 0.18);
		margin: 0 auto;
		padding: .8rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.footer-copy,
	.footer-made {
		font-size: 0.85rem;
		color: #4b5563;
		margin: 0;
	}

	.footer-made {
		font-style: italic;
		color: #3f51b5;
		font-weight: 600;
	}

	@media (max-width: 560px) {
		.footer-bottom {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
