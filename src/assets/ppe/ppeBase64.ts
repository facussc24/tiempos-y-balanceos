/**
 * PPE & Logo Base64 conversion for PDF export.
 *
 * Converts Vite-resolved image URLs to base64 data URIs
 * for embedding in html2pdf.js HTML strings.
 * Cached after first call.
 */

import { PPE_IMAGES } from './index';
import barackLogo from '../barack_logo.png';
import { logger } from '../../../utils/logger';

let ppeBase64Cache: Record<string, string> | null = null;
let logoBase64Cache: string | null = null;

async function urlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

/** Get all PPE images as base64 data URIs for PDF embedding. */
export async function getPpeBase64Map(): Promise<Record<string, string>> {
    if (ppeBase64Cache) return ppeBase64Cache;

    const entries = Object.entries(PPE_IMAGES);
    const results: Record<string, string> = {};

    for (const [id, url] of entries) {
        try {
            results[id] = await urlToBase64(url);
        } catch (err) {
            logger.warn('[PPE] Failed to load image for', id, err);
            results[id] = '';
        }
    }

    ppeBase64Cache = results;
    return results;
}

/** Get the Barack logo as base64 data URI for PDF embedding. */
export async function getLogoBase64(): Promise<string> {
    if (logoBase64Cache) return logoBase64Cache;
    try {
        logoBase64Cache = await urlToBase64(barackLogo);
        return logoBase64Cache;
    } catch (err) {
        logger.warn('[PPE] Failed to load Barack logo:', err);
        return '';
    }
}
