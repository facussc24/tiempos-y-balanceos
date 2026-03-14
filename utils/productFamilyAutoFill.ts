/**
 * Product Family Auto-Fill
 *
 * Resolves the "applicableParts" field for a given product:
 * 1. First checks if the product belongs to a family → returns family members
 * 2. Fallback: returns products from the same customer line (capped to avoid huge lists)
 */

import { getFamiliesByProductCode, getFamilyMembers } from './repositories/familyRepository';
import { listProducts } from './repositories/productRepository';

/** Max sibling codes to include when falling back to line-based lookup. */
const LINE_FALLBACK_LIMIT = 50;

/** Max applicable-part codes to render in exports (PDF/Excel headers). */
export const APPLICABLE_PARTS_DISPLAY_MAX = 20;

/**
 * Truncate a newline-separated list of applicable parts for display.
 * If the list exceeds `max` entries, keeps the first `max` and appends "... y N más".
 */
export function truncateApplicableParts(parts: string, max = APPLICABLE_PARTS_DISPLAY_MAX): string {
    if (!parts) return parts;
    const lines = parts.split('\n').filter(l => l.trim());
    if (lines.length <= max) return lines.join('\n');
    const remaining = lines.length - max;
    return [...lines.slice(0, max), `... y ${remaining} más`].join('\n');
}

/**
 * Resolve applicable parts for a given product.
 * Returns newline-separated product codes (excluding the given product itself),
 * or null if no siblings found.
 */
export async function resolveApplicableParts(
    codigo: string,
    lineaCode: string,
): Promise<string | null> {
    // 1. Try family-based lookup
    try {
        const families = await getFamiliesByProductCode(codigo, lineaCode);
        if (families.length > 0) {
            const members = await getFamilyMembers(families[0].id);
            const siblings = members
                .map(m => m.codigo ?? '')
                .filter(c => c && c !== codigo);
            return siblings.length > 0 ? siblings.join('\n') : null;
        }
    } catch {
        // Family lookup failed — fall through to line-based
    }

    // 2. Fallback: line-based siblings (capped to LINE_FALLBACK_LIMIT)
    try {
        const products = await listProducts({ lineaCode, activeOnly: true, limit: LINE_FALLBACK_LIMIT + 1 });
        const siblings = products
            .map(p => p.codigo)
            .filter(c => c !== codigo)
            .slice(0, LINE_FALLBACK_LIMIT);
        return siblings.length > 0 ? siblings.join('\n') : null;
    } catch {
        return null;
    }
}
