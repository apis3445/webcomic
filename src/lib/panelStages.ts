// Registry of live Konva stages keyed by panel index. Panel.svelte registers
// its stage on mount and unregisters on destroy; the editor's print flow reads
// them to flatten each panel (background + bubbles + text) into a single image
// via stage.toDataURL(). A plain Map (not $state) — consumers only read it
// inside event handlers, never reactively.
import type { Stage as KonvaStage } from 'konva/lib/Stage';

const stages = new Map<number, KonvaStage>();

export function registerPanelStage(index: number, stage: KonvaStage | null) {
	if (stage) {
		stages.set(index, stage);
	} else {
		stages.delete(index);
	}
}

export function getPanelStage(index: number): KonvaStage | undefined {
	return stages.get(index);
}
