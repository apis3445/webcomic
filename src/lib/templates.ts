// Single source of truth for comic templates. Adding a new template means
// adding one entry here and one block of CSS in each grid root that should
// render it (editor, published view, print, picker preview).

export type TemplateId = 'grid-3x3' | 'page-1-2-3' | 'strip-3' | 'vertical-4' | 'hero-5';

export interface TemplateDefinition {
	id: TemplateId;
	name: string;
	description: string;
	panelCount: number;
	// CSS modifier class added to .comic-grid (editor) and .published-grid
	// (public view). Empty string means "default styles only".
	layoutClass: string;
	// CSS modifier class added to .print-comic-grid in the print view.
	printLayoutClass: string;
	// CSS class applied to .preview-grid inside the picker card.
	previewClass: string;
}

export const TEMPLATES: TemplateDefinition[] = [
	{
		id: 'grid-3x3',
		name: 'Classic 3×3',
		description: '9 equal panels',
		panelCount: 9,
		layoutClass: '',
		printLayoutClass: '',
		previewClass: 'preview-3x3'
	},
	{
		id: 'page-1-2-3',
		name: 'Page Layout',
		description: '6 panels · 1 + 2 + 3',
		panelCount: 6,
		layoutClass: 'template-page',
		printLayoutClass: 'print-template-page',
		previewClass: 'preview-page'
	},
	{
		id: 'strip-3',
		name: 'Sunday Strip',
		description: '3 panels · horizontal',
		panelCount: 3,
		layoutClass: 'template-strip',
		printLayoutClass: 'print-template-strip',
		previewClass: 'preview-strip'
	},
	{
		id: 'vertical-4',
		name: 'Webtoon Vertical',
		description: '4 panels · stacked',
		panelCount: 4,
		layoutClass: 'template-vertical',
		printLayoutClass: 'print-template-vertical',
		previewClass: 'preview-vertical'
	},
	{
		id: 'hero-5',
		name: 'Action Spread',
		description: '5 panels · 1 hero + 4',
		panelCount: 5,
		layoutClass: 'template-hero',
		printLayoutClass: 'print-template-hero',
		previewClass: 'preview-hero'
	}
];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'grid-3x3';

const TEMPLATE_BY_ID = new Map<TemplateId, TemplateDefinition>(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: TemplateId): TemplateDefinition {
	return TEMPLATE_BY_ID.get(id) ?? TEMPLATE_BY_ID.get(DEFAULT_TEMPLATE_ID)!;
}

export function isTemplateId(value: unknown): value is TemplateId {
	return typeof value === 'string' && TEMPLATE_BY_ID.has(value as TemplateId);
}

// Resolve a template from a possibly-unknown slug, falling back to inferring
// by panel count (legacy rows pre-date the slug column).
export function resolveTemplateId(slug: string | null | undefined, panelCount: number): TemplateId {
	if (isTemplateId(slug)) return slug;
	const match = TEMPLATES.find((t) => t.panelCount === panelCount);
	return match?.id ?? DEFAULT_TEMPLATE_ID;
}
