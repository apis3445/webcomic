import { browser } from '$app/environment';

export type BubbleType =
	| 'left-cloud'
	| 'right-cloud'
	| 'left-oval'
	| 'right-oval'
	| 'box-izq'
	| 'box-der'
	| 'box';

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

class ComicState {
	activePanelIndex = $state<number | undefined>(0); // Default focus on the first panel
	activeBubbleId = $state<number | undefined>(undefined);

	panels = $state<PanelState[]>([
		{
			bgImage: undefined,
			bgImageUrl: '',
			bubbles: [
			]
		},
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] },
		{ bgImage: undefined, bgImageUrl: '', bubbles: [] }
	]);

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
			width: 140,
			height: 50,
			text,
			type
		};

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
			// Force Svelte Konva redraw by re-assigning bubbles array
			if (this.activePanelIndex !== undefined) {
				this.panels[this.activePanelIndex].bubbles = [
					...this.panels[this.activePanelIndex].bubbles
				];
			}
		}
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

	// Global deck tools
	clearAll() {
		this.panels.forEach((p) => {
			p.bgImage = undefined;
			p.bgImageUrl = '';
			p.bubbles = [];
		});
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

export const comicState = new ComicState();
