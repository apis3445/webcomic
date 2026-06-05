import { browser } from '$app/environment';
/* eslint-disable @typescript-eslint/no-explicit-any */

export type TemplateId = 'grid-3x3' | 'page-1-2-3';

const PANEL_COUNTS: Record<TemplateId, number> = {
	'grid-3x3': 9,
	'page-1-2-3': 6
};

const DEFAULT_PANEL_COUNT = 1;

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
			this.resizeBubble(newBubble);
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
		if (bubble) {
			bubble.text = text;
			// Resize to fit updated text when in browser
			if (browser) {
				this.resizeBubble(bubble);
			}
			// Force Svelte Konva redraw by re-assigning bubbles array
			if (this.activePanelIndex !== undefined) {
				this.panels[this.activePanelIndex].bubbles = [
					...this.panels[this.activePanelIndex].bubbles
				];
			}
		}
	}

	// Resize a bubble to fit its text content using an offscreen canvas measurement
	private resizeBubble(bubble: Bubble) {
		if (!browser) return;
		const isCloud = bubble.type === 'left-cloud' || bubble.type === 'right-cloud';
		const isOval = bubble.type === 'left-oval' || bubble.type === 'right-oval';
		// Horizontal/vertical padding totals (both sides). Must match Panel.svelte's text inset.
		const paddingH = (isCloud ? 32 : isOval ? 16 : 6) * 2;
		const paddingV = (isCloud ? 14 : 6) * 2;
		const font = 'bold 15px system-ui';

		const size = this.measureTextSize(bubble.text || '', font);
		// Preserve sensible minimums for certain bubble types
		const minWidth = bubble.type === 'burst' ? 160 : isCloud ? 100 : 50;
		const minHeight = bubble.type === 'burst' ? 130 : isCloud ? 56 : 24;
		bubble.width = Math.max(Math.ceil(size.width + paddingH), minWidth);
		bubble.height = Math.max(Math.ceil(size.height + paddingV), minHeight);
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
				panel.bgImage = img;
				panel.bgImageUrl = url;
				// Force reactive refresh
				this.panels = [...this.panels];
				resolve();
				// Release the previous blob URL (if any) once we've safely
				// swapped to the new image. http(s) URLs are untouched.
				if (previousUrl && previousUrl !== url && previousUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(previousUrl);
					} catch {
						/* ignore */
					}
				}
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
