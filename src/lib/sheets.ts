// Single source of truth for the page (sheet) count limit, shared by the editor
// and every endpoint that writes a sheet. Keeping the cap in one place avoids the
// mismatch where the client could create page numbers the API would silently
// clamp — which overwrote an existing page instead of persisting a new one.

/** Maximum number of pages (sheets) a single comic can have. */
export const MAX_SHEETS = 100;

/**
 * Normalize an incoming sheet number into the valid range [1, MAX_SHEETS].
 *
 * - Missing (`undefined`/`null`/empty string) resolves to `1`, since older
 *   clients never sent a sheetNumber and meant the first page.
 * - A present value that is not a positive integer within range returns `null`.
 *   Callers reject these (HTTP 400) rather than clamping, so an out-of-range page
 *   can never silently overwrite a different one.
 *
 * Accepts strings (e.g. multipart form fields) as well as numbers.
 */
export function resolveSheetNumber(value: unknown): number | null {
	if (value === undefined || value === null || value === '') return 1;
	const n = typeof value === 'string' ? Number(value) : value;
	if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_SHEETS) {
		return null;
	}
	return n;
}
