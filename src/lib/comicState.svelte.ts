import { browser } from '$app/environment';
/* eslint-disable @typescript-eslint/no-explicit-any */

export type TemplateId = 'grid-3x3' | 'page-1-2-3';

const PANEL_COUNTS: Record<TemplateId, number> = {
	'grid-3x3': 9,
	'page-1-2-3': 6
};

const DEFAULT_PANEL_COUNT = 1;

// Canvas font string used for both bubble text measurement (here) and
// rendering (Panel.svelte's Konva <Text>). Keep these in sync so the
// measured line breaks match what Konva actually draws.
const BUBBLE_FONT = 'bold 15px system-ui';

function getPanelCount(id: TemplateId): number {
	const count = PANEL_COUNTS[id];
	if (typeof count !== 'number' || count < 1) {
		console.warn(
			`Unknown or invalid panel count for template "${id}", falling back to ${DEFAULT_PANEL_COUNT}`
		);
		return DEFAULT_PANEL_COUNT;
	}
	return count;
}

export type BubbleType =
	| 'left-cloud'
	| 'right-cloud'
	| 'left-oval'
	| 'right-oval'
	| 'box-izq'
	| 'box-der'
	| 'box'
	| 'burst';

export interface Bubble {
	id: number;
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	type: BubbleType;
	// Higher z_index renders on top of lower ones. Persisted server-side
	// so overlapping bubbles keep a stable, user-controllable order.
	z_index: number;
}

export interface PanelState {
	bgImage: HTMLImageElement | undefined;
	bgImageUrl: string;
	bubbles: Bubble[];
	stageW: number;
	stageH: number;
}

function createPanels(count: number): PanelState[] {
	const safeCount =
		typeof count === 'number' && count >= 1 ? Math.floor(count) : DEFAULT_PANEL_COUNT;
	return Array.from({ length: safeCount }, () => ({
		bgImage: undefined,
		bgImageUrl: '',
		bubbles: [],
		stageW: 0,
		stageH: 0
	}));
}

class ComicState {
	templateId = $state<TemplateId>('grid-3x3');
	activePanelIndex = $state<number | undefined>(0);
	activeBubbleId = $state<number | undefined>(undefined);

	panels = $state<PanelState[]>(createPanels(9));

	private _measureCanvas: HTMLCanvasElement | undefined;

	// Persisted draft id for current comic (set after first upload)
	comicId = $state<string | null>(null);
	// Title of the comic (editable by user)
	title = $state<string>('Untitled');

	setComicId(id: string) {
		this.comicId = id;
	}

	setTitle(name: string) {
		this.title = name;
	}

	// Active selectors derived properties
	get activePanel(): PanelState | undefined {
		if (this.activePanelIndex === undefined) return undefined;
		return this.panels[this.activePanelIndex];
	}

	get activeBubble(): Bubble | undefined {
		const panel = this.activePanel;
		if (!panel || this.activeBubbleId === undefined) return undefined;
		return panel.bubbles.find((b) => b.id === this.activeBubbleId);
	}

	// Actions
	selectPanel(index: number) {
		this.activePanelIndex = index;
		// Focus first bubble in the selected panel if available, otherwise clear bubble selection
		const panel = this.panels[index];
		if (panel && panel.bubbles.length > 0) {
			this.activeBubbleId = panel.bubbles[0].id;
		} else {
			this.activeBubbleId = undefined;
		}
	}

	selectBubble(id: number) {
		this.activeBubbleId = id;
	}

	addBubble(type: BubbleType, text: string = 'New text...') {
		const panel = this.activePanel;
		if (!panel) return;

		const nextId = panel.bubbles.reduce((max, b) => Math.max(max, b.id), 0) + 1;
		const topZ = panel.bubbles.reduce((max, b) => Math.max(max, b.z_index ?? 0), 0);
		const newBubble: Bubble = {
			id: nextId,
			x: 80,
			y: 80,
			width: type === 'burst' ? 160 : 140,
			height: type === 'burst' ? 130 : 50,
			text,
			type,
			z_index: topZ + 1
		};

		// Resize to fit text when running in the browser
		if (browser) {
			this.resizeBubble(newBubble, panel.stageW);
		}

		panel.bubbles = [...panel.bubbles, newBubble];
		this.activeBubbleId = nextId;
	}

	bringActiveBubbleToFront() {
		const panel = this.activePanel;
		const bubble = this.activeBubble;
		if (!panel || !bubble) return;
		const topZ = panel.bubbles.reduce((max, b) => Math.max(max, b.z_index ?? 0), 0);
		if (bubble.z_index === topZ) return;
		bubble.z_index = topZ + 1;
		panel.bubbles = [...panel.bubbles];
	}

	sendActiveBubbleToBack() {
		const panel = this.activePanel;
		const bubble = this.activeBubble;
		if (!panel || !bubble) return;
		const bottomZ = panel.bubbles.reduce(
			(min, b) => Math.min(min, b.z_index ?? 0),
			bubble.z_index
		);
		if (bubble.z_index === bottomZ) return;
		bubble.z_index = bottomZ - 1;
		panel.bubbles = [...panel.bubbles];
	}

	deleteBubble(id: number) {
		const panel = this.activePanel;
		if (!panel) return;

		panel.bubbles = panel.bubbles.filter((b) => b.id !== id);
		if (this.activeBubbleId === id) {
			this.activeBubbleId = panel.bubbles[0]?.id ?? undefined;
		}
	}

	updateActiveBubbleText(text: string) {
		const bubble = this.activeBubble;
		const panel = this.activePanel;
		if (bubble) {
			bubble.text = text;
			// Resize to fit updated text when in browser
			if (browser) {
				this.resizeBubble(bubble, panel?.stageW ?? 0);
			}
			// Force Svelte Konva redraw by re-assigning bubbles array
			if (this.activePanelIndex !== undefined) {
				this.panels[this.activePanelIndex].bubbles = [
					...this.panels[this.activePanelIndex].bubbles
				];
			}
		}
	}

	// Recompute every bubble's size in the given panel against its current
	// stageW. Called from Panel.svelte once the ResizeObserver reports a real
	// width — bubbles created before that moment used fallback caps and need
	// to reflow now that the true panel width is known. Cheap when stageW
	// is unchanged: each bubble's size is fully determined by its text + the
	// panel width, so we just write the same value back.
	reflowPanelBubbles(panelIndex: number) {
		if (!browser) return;
		const panel = this.panels[panelIndex];
		if (!panel || panel.bubbles.length === 0) return;
		for (const bubble of panel.bubbles) {
			this.resizeBubble(bubble, panel.stageW);
		}
		// Re-assign so svelte-konva sees the change and redraws.
		panel.bubbles = [...panel.bubbles];
	}

	// Resize a bubble to fit its text content using an offscreen canvas measurement.
	// Wraps long text at a max content width and respects explicit \n line breaks
	// from the textarea so the bubble grows downward instead of stretching wide.
	// stageW is passed explicitly (not read from activePanel) so this can be
	// called for any panel — e.g. from reflowPanelBubbles once the panel's
	// ResizeObserver reports a real width.
	private resizeBubble(bubble: Bubble, stageW: number) {
		if (!browser) return;
		const isCloud = bubble.type === 'left-cloud' || bubble.type === 'right-cloud';
		const isBurst = bubble.type === 'burst';
		const font = BUBBLE_FONT;
		// Konva Text uses lineHeight=1 by default at fontSize=15 → ~18px is close
		// enough for layout sizing without leaving big gaps inside the bubble.
		const lineHeight = 18;

		const maxContentWidth = this.bubbleMaxContentWidth(bubble, stageW);

		const lines = this.wrapText(bubble.text || '', font, maxContentWidth);

		let widest = 0;
		for (const line of lines) {
			const w = this.measureTextSize(line, font).width;
			if (w > widest) widest = w;
		}
		const contentW = Math.min(widest, maxContentWidth);
		const contentH = Math.max(lines.length, 1) * lineHeight;

		const bounds = this.boundsForContent(bubble, contentW, contentH);

		// Preserve sensible minimums for certain bubble types
		const minWidth = isBurst ? 160 : isCloud ? 100 : 50;
		const minHeight = isBurst ? 130 : isCloud ? 56 : 24;
		bubble.width = Math.max(bounds.w, minWidth);
		bubble.height = Math.max(bounds.h, minHeight);
	}

	// Public helper: returns the bubble's text already wrapped to fit inside
	// the bubble's content area. Panel.svelte joins these with '\n' and passes
	// the result to Konva <Text wrap="none"> so what's drawn matches what was
	// measured — no clipping for long unbroken tokens.
	getWrappedBubbleText(bubble: Bubble, stageW: number): string {
		const maxContentWidth = this.bubbleMaxContentWidth(bubble, stageW);
		const lines = this.wrapText(bubble.text || '', BUBBLE_FONT, maxContentWidth);
		return lines.join('\n');
	}

	// Shape-aware inner rect that lies inside the visible bubble outline (not
	// just inside the bounding box). For irregular shapes (cloud, burst) the
	// safe area is an inscribed rectangle in the inner ellipse / inner star;
	// for rectangles/ovals it's the bounding box minus a fixed padding.
	// Used by both the text renderer (Panel.svelte) and the sizing math here.
	bubbleInnerRect(bubble: Bubble): { x: number; y: number; w: number; h: number } {
		const isCloud = bubble.type === 'left-cloud' || bubble.type === 'right-cloud';
		const isBurst = bubble.type === 'burst';
		const isOval = bubble.type === 'left-oval' || bubble.type === 'right-oval';
		// Cloud inner ellipse has axes ~0.4w × 0.38h (see buildCloudPath). The
		// largest axis-aligned rectangle inscribed in that ellipse is a·√2 by
		// b·√2 → ~0.566w × 0.537h. We pull in a touch further so the rounded
		// puffs at the corners stay clear of the text.
		if (isCloud) {
			const w = bubble.width * 0.52;
			const h = bubble.height * 0.5;
			return { x: (bubble.width - w) / 2, y: (bubble.height - h) / 2, w, h };
		}
		// Burst: 12-point star with elliptical radii innerRx = 0.261·w and
		// innerRy = 0.261·h. The largest axis-aligned rectangle inscribed in
		// an ellipse (rx, ry) has half-dimensions rx/√2 × ry/√2, so the safe
		// rect is ~0.37w × 0.37h of the bounding box. We use 0.36 for a 3%
		// margin so the corners stay clear of the inner valleys at angles
		// ±45°, ±135° where the boundary touches the inscribed ellipse.
		if (isBurst) {
			const w = bubble.width * 0.36;
			const h = bubble.height * 0.36;
			return { x: (bubble.width - w) / 2, y: (bubble.height - h) / 2, w, h };
		}
		const padH = isOval ? 16 : 6;
		const padV = 6;
		return {
			x: padH,
			y: padV,
			w: Math.max(bubble.width - padH * 2, 1),
			h: Math.max(bubble.height - padV * 2, 1)
		};
	}

	// Inverse of bubbleInnerRect for sizing: given desired content dimensions,
	// return the bubble bounds that will hold them.
	private boundsForContent(
		bubble: Bubble,
		contentW: number,
		contentH: number
	): { w: number; h: number } {
		const isCloud = bubble.type === 'left-cloud' || bubble.type === 'right-cloud';
		const isBurst = bubble.type === 'burst';
		const isOval = bubble.type === 'left-oval' || bubble.type === 'right-oval';
		if (isCloud) {
			return { w: Math.ceil(contentW / 0.52), h: Math.ceil(contentH / 0.5) };
		}
		if (isBurst) {
			return { w: Math.ceil(contentW / 0.36), h: Math.ceil(contentH / 0.36) };
		}
		const padH = isOval ? 16 : 6;
		const padV = 6;
		return { w: Math.ceil(contentW + padH * 2), h: Math.ceil(contentH + padV * 2) };
	}

	// Max content width (inner safe area) before wrapping. Cap bubble width
	// first to a comfortable reading width per type (so a bubble in a wide
	// 16:7 hero panel doesn't span the whole panel), then convert that bubble
	// width cap into a content width cap via the same shape factor used by
	// bubbleInnerRect. stageW narrows the cap further when the panel is
	// smaller than the absolute max.
	private bubbleMaxContentWidth(bubble: Bubble, stageW: number): number {
		const isCloud = bubble.type === 'left-cloud' || bubble.type === 'right-cloud';
		const isBurst = bubble.type === 'burst';
		const isOval = bubble.type === 'left-oval' || bubble.type === 'right-oval';
		// Absolute bubble-width caps (px). Clouds and bursts need extra room
		// because only ~52% (cloud) or 36% (burst) of the bounding box is
		// actually usable for text after accounting for the shape outline.
		const absoluteMaxBubbleW = isCloud ? 400 : isBurst ? 500 : 280;
		const panelMargin = 16;
		const panelCap =
			stageW > 0 ? Math.max(stageW - panelMargin, 60) : absoluteMaxBubbleW;
		const maxBubbleW = Math.min(absoluteMaxBubbleW, panelCap);
		// Convert bubble-width cap into content-width cap (matches inner rect).
		if (isCloud) return Math.max(maxBubbleW * 0.52, 40);
		if (isBurst) return Math.max(maxBubbleW * 0.36, 40);
		const padH = isOval ? 16 : 6;
		return Math.max(maxBubbleW - padH * 2, 40);
	}

	// Soft-wrap text at maxWidth. Tries word boundaries first; if a single word
	// is still wider than maxWidth (long URLs, "AAAA…"), splits that word at the
	// character level so every produced line fits. Preserves explicit \n breaks.
	private wrapText(text: string, font: string, maxWidth: number): string[] {
		if (!browser) return [text];
		if (!this._measureCanvas) {
			this._measureCanvas = document.createElement('canvas');
		}
		const ctx = this._measureCanvas.getContext('2d');
		if (!ctx) return [text];
		ctx.font = font;

		const result: string[] = [];
		const paragraphs = text.split('\n');
		for (const para of paragraphs) {
			if (para === '') {
				result.push('');
				continue;
			}
			const words = para.split(/\s+/);
			let current = '';
			for (const word of words) {
				// If the word itself is wider than the line, break it at character
				// boundaries. The first chunk may need to combine with the current
				// line; the remainder becomes its own lines.
				if (ctx.measureText(word).width > maxWidth) {
					const chunks = this.splitWordByChars(ctx, word, maxWidth);
					for (let i = 0; i < chunks.length; i++) {
						const chunk = chunks[i];
						if (i === 0) {
							const test = current === '' ? chunk : current + ' ' + chunk;
							if (ctx.measureText(test).width > maxWidth && current !== '') {
								result.push(current);
								current = chunk;
							} else {
								current = test;
							}
						} else {
							if (current !== '') result.push(current);
							current = chunk;
						}
					}
					continue;
				}
				const test = current === '' ? word : current + ' ' + word;
				if (ctx.measureText(test).width > maxWidth && current !== '') {
					result.push(current);
					current = word;
				} else {
					current = test;
				}
			}
			if (current !== '') result.push(current);
		}
		return result.length > 0 ? result : [''];
	}

	// Greedily slice an over-long word into char chunks that each fit maxWidth.
	private splitWordByChars(
		ctx: CanvasRenderingContext2D,
		word: string,
		maxWidth: number
	): string[] {
		const chunks: string[] = [];
		let current = '';
		for (const ch of word) {
			const next = current + ch;
			if (ctx.measureText(next).width > maxWidth && current !== '') {
				chunks.push(current);
				current = ch;
			} else {
				current = next;
			}
		}
		if (current !== '') chunks.push(current);
		return chunks.length > 0 ? chunks : [word];
	}

	private measureTextSize(text: string, font: string): { width: number; height: number } {
		if (!browser) {
			return { width: 0, height: 15 };
		}

		if (!this._measureCanvas) {
			this._measureCanvas = document.createElement('canvas');
		}
		const ctx = this._measureCanvas.getContext('2d');
		if (!ctx) return { width: 0, height: 15 };

		ctx.font = font;
		const metrics = ctx.measureText(text || '');
		const width = metrics.width;
		const ascent = metrics.actualBoundingBoxAscent;
		const descent = metrics.actualBoundingBoxDescent;
		const height =
			typeof ascent === 'number' && typeof descent === 'number' ? ascent + descent : 15 * 1.2;
		return { width, height };
	}

	setPanelBgImage(index: number, url: string): Promise<void> {
		const panel = this.panels[index];
		if (!panel) return Promise.reject(new Error('panel not found'));

		if (!browser) {
			panel.bgImageUrl = url;
			return Promise.resolve();
		}

		// Capture the URL we're about to replace so we can revoke it after the
		// new image has decoded — if it was a blob: URL, releasing the previous
		// one avoids unbounded growth across repeat uploads in the same session.
		const previousUrl = panel.bgImageUrl;

		return new Promise<void>((resolve, reject) => {
			const img = new window.Image();
			// Intentionally not setting img.crossOrigin = 'Anonymous'. CORS is only
			// required if we ever read pixel data via canvas.toDataURL/getImageData
			// (we don't — Konva just displays). Forcing CORS would trip a preflight
			// and silently fail on storage URLs lacking strict CORS headers.
			img.onload = () => {
				// onload fires once bytes are in, but the image may still fail to
				// decode (corrupt payload, unsupported pixel format, exceeds the
				// platform's max bitmap size). decode() surfaces those explicitly
				// instead of letting Konva paint a broken image silently.
				img.decode().then(
					() => {
						panel.bgImage = img;
						panel.bgImageUrl = url;
						// Force reactive refresh
						this.panels = [...this.panels];
						resolve();
						// Defer revoking the previous blob URL until after the current
						// render cycle commits — revoking synchronously here races with
						// Konva/Svelte still reading from the old src during the swap,
						// which can blank the panel for a frame. http(s) URLs untouched.
						if (previousUrl && previousUrl !== url && previousUrl.startsWith('blob:')) {
							const raf =
								typeof requestAnimationFrame === 'function'
									? requestAnimationFrame
									: (cb: () => void) => setTimeout(cb, 0);
							raf(() => {
								try {
									URL.revokeObjectURL(previousUrl);
								} catch {
									/* ignore */
								}
							});
						}
					},
					(err) => {
						console.error('setPanelBgImage: image failed to decode', { index, url, err });
						reject(new Error('Image failed to decode'));
					}
				);
			};
			img.onerror = () => {
				console.error('setPanelBgImage: image failed to load', { index, url });
				reject(new Error('Image failed to load'));
			};
			img.src = url;
		});
	}

	get hasContent(): boolean {
		return this.panels.some((p) => p.bgImageUrl !== '' || p.bubbles.length > 0);
	}

	// Global deck tools
	setTemplate(id: TemplateId) {
		const count = getPanelCount(id);
		const old = this.panels;
		this.templateId = id;
		this.panels = Array.from({ length: count }, (_, i) =>
			i < old.length
				? { bgImage: old[i].bgImage, bgImageUrl: old[i].bgImageUrl, bubbles: [...old[i].bubbles], stageW: old[i].stageW, stageH: old[i].stageH }
				: { bgImage: undefined, bgImageUrl: '', bubbles: [], stageW: 0, stageH: 0 }
		);
		this.activePanelIndex = 0;
		this.activeBubbleId = undefined;
	}

	clearAll() {
		this.panels = createPanels(getPanelCount(this.templateId));
		this.activePanelIndex = 0;
		this.activeBubbleId = undefined;
	}

	reset() {
		this.templateId = 'grid-3x3';
		this.panels = createPanels(getPanelCount('grid-3x3'));
		this.activePanelIndex = 0;
		this.activeBubbleId = undefined;
		this.comicId = null;
		this.title = 'Untitled';
	}

	hydrate(payload: {
		id: string;
		name: string | null;
		templateSlug?: string | null;
		panels: Array<{
			index: number;
			imageUrl: string | null;
			bubbles: Bubble[];
		}>;
	}) {
		const slugIsKnown =
			payload.templateSlug === 'grid-3x3' || payload.templateSlug === 'page-1-2-3';
		const templateId: TemplateId = slugIsKnown
			? (payload.templateSlug as TemplateId)
			: payload.panels.length === 6
				? 'page-1-2-3'
				: 'grid-3x3';
		const count = getPanelCount(templateId);
		this.templateId = templateId;
		this.panels = createPanels(count);
		this.comicId = payload.id;
		this.title = payload.name || 'Untitled';
		for (const pData of payload.panels) {
			const idx = (pData.index ?? 1) - 1;
			if (idx < 0 || idx >= this.panels.length) continue;
			// Fill in z_index defaults for legacy rows that pre-date the field
			// (those persisted with z_index=0 across the board).
			this.panels[idx].bubbles = pData.bubbles.map((b, i) => ({
				...b,
				z_index: typeof b.z_index === 'number' ? b.z_index : i
			}));
			if (pData.imageUrl) {
				this.setPanelBgImage(idx, pData.imageUrl).catch((err) => {
					console.warn('hydrate: panel image failed to load', { idx, err });
				});
			}
		}
		this.activePanelIndex = 0;
		this.activeBubbleId = undefined;
	}

	exportJSON(): string {
		const data = this.panels.map((p) => ({
			bgImageUrl: p.bgImageUrl,
			bubbles: p.bubbles
		}));
		return JSON.stringify(data, null, 2);
	}

	importJSON(jsonString: string) {
		try {
			const data = JSON.parse(jsonString);
			if (Array.isArray(data)) {
				data.forEach((pData, idx) => {
					if (this.panels[idx]) {
						this.panels[idx].bubbles = pData.bubbles || [];
						if (pData.bgImageUrl) {
							this.setPanelBgImage(idx, pData.bgImageUrl).catch((err) => {
								console.warn('importJSON: panel image failed to load', { idx, err });
							});
						} else {
							this.panels[idx].bgImage = undefined;
							this.panels[idx].bgImageUrl = '';
						}
					}
				});
				this.selectPanel(0);
			}
		} catch (e) {
			console.error('Failed to parse comic state JSON', e);
		}
	}
}

export type ComicStateType = ComicState;

export const comicState = new ComicState();
