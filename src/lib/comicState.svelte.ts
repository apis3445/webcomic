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
}

export interface PanelState {
	bgImage: HTMLImageElement | undefined;
	bgImageUrl: string;
	bubbles: Bubble[];
}

function createPanels(count: number): PanelState[] {
	const safeCount =
		typeof count === 'number' && count >= 1 ? Math.floor(count) : DEFAULT_PANEL_COUNT;
	return Array.from({ length: safeCount }, () => ({
		bgImage: undefined,
		bgImageUrl: '',
		bubbles: []
	}));
}

class ComicState {
	templateId = $state<TemplateId>('grid-3x3');
	activePanelIndex = $state<number | undefined>(0);
	activeBubbleId = $state<number | undefined>(undefined);

	panels = $state<PanelState[]>(createPanels(9));

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
		const newBubble: Bubble = {
			id: nextId,
			x: 80,
			y: 80,
			width: type === 'burst' ? 160 : 140,
			height: type === 'burst' ? 130 : 50,
			text,
			type
		};

		// Resize to fit text when running in the browser
		if (browser) {
			this.resizeBubble(newBubble);
		}

		panel.bubbles = [...panel.bubbles, newBubble];
		this.activeBubbleId = nextId;
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
		const paddingH = 12; // 6px left + 6px right (Konva padding 6)
		const paddingV = 12; // 6px top + 6px bottom
		const font = 'bold 15px system-ui';

		const size = this.measureTextSize(bubble.text || '', font);
		// Preserve sensible minimums for certain bubble types
		const minWidth = bubble.type === 'burst' ? 160 : 50;
		const minHeight = bubble.type === 'burst' ? 130 : 24;
		bubble.width = Math.max(Math.ceil(size.width + paddingH), minWidth);
		bubble.height = Math.max(Math.ceil(size.height + paddingV), minHeight);
	}

	private measureTextSize(text: string, font: string): { width: number; height: number } {
		if (!browser) {
			return { width: 0, height: 15 };
		}

		// Reuse an offscreen canvas when possible
		let canvas = (this as any)._measureCanvas as HTMLCanvasElement | undefined;
		if (!canvas) {
			canvas = document.createElement('canvas');
			(this as any)._measureCanvas = canvas;
		}
		const ctx = canvas.getContext('2d');
		if (!ctx) return { width: 0, height: 15 };

		ctx.font = font;
		const metrics = ctx.measureText(text || '');
		const width = metrics.width;
		let height = 15;
		if ('actualBoundingBoxAscent' in metrics && 'actualBoundingBoxDescent' in metrics) {
			height = (metrics as any).actualBoundingBoxAscent + (metrics as any).actualBoundingBoxDescent;
		} else {
			// Fallback approximate height using font size
			height = 15 * 1.2;
		}
		return { width, height };
	}

	setPanelBgImage(index: number, url: string) {
		const panel = this.panels[index];
		if (!panel) return;

		if (!browser) {
			panel.bgImageUrl = url;
			return;
		}

		const img = new window.Image();
		img.crossOrigin = 'Anonymous';
		img.onload = () => {
			panel.bgImage = img;
			panel.bgImageUrl = url;
			// Force reactive refresh
			this.panels = [...this.panels];
		};
		img.src = url;
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
				? { bgImage: old[i].bgImage, bgImageUrl: old[i].bgImageUrl, bubbles: [...old[i].bubbles] }
				: { bgImage: undefined, bgImageUrl: '', bubbles: [] }
		);
		this.activePanelIndex = 0;
		this.activeBubbleId = undefined;
	}

	clearAll() {
		this.panels = createPanels(getPanelCount(this.templateId));
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
							this.setPanelBgImage(idx, pData.bgImageUrl);
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
