/**
 * Shared AIAG-VDA 2019 AP calculation for Node.js scripts.
 * Exact replica of modules/amfe/apTable.ts logic (JavaScript version).
 */

function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    // S = 9-10
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) {
        if (d >= 7) return 'H';
        if (d >= 5) return 'M';
        return 'L';
    }
    return 'L';
}

export function calcAP(severity, occurrence, detection) {
    const s = Number(severity) || 0;
    const o = Number(occurrence) || 0;
    const d = Number(detection) || 0;
    if (s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return '';
    return apRule(Math.round(s), Math.round(o), Math.round(d));
}
