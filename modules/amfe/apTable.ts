/**
 * AIAG-VDA FMEA Action Priority (AP) Lookup Table
 *
 * Exact reproduction of the AIAG & VDA FMEA Handbook (1st Edition, June 2019)
 * PFMEA Action Priority table. Maps every combination of Severity (1-10),
 * Occurrence (1-10), Detection (1-10) to H (High), M (Medium), or L (Low).
 *
 * The standard groups severity into 5 ranges: 9-10, 7-8, 4-6, 2-3, 1.
 * Within each range, O and D thresholds determine the AP level.
 */

type AP = 'H' | 'M' | 'L';

// The table is structured as apLookup[S][O][D] → AP
// Index 0 is unused (ratings go from 1-10)
const apLookup: AP[][][] = buildAPTable();

function buildAPTable(): AP[][][] {
    // Initialize 11x11x11 (index 0 unused) — default all to 'L'
    const table: AP[][][] = Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () =>
            Array(11).fill('L')
        )
    );

    for (let s = 1; s <= 10; s++) {
        for (let o = 1; o <= 10; o++) {
            for (let d = 1; d <= 10; d++) {
                table[s][o][d] = apRule(s, o, d);
            }
        }
    }

    return table;
}

/**
 * Pure rule-based AP determination per AIAG-VDA 2019 PFMEA standard.
 * Grouped by the 5 severity ranges published in the handbook.
 */
function apRule(s: number, o: number, d: number): AP {
    // ── S = 1: Always L ──────────────────────────────────────
    if (s <= 1) return 'L';

    // ── S = 2-3: Only M when O=8-10 AND D=5-10 ──────────────
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }

    // ── S = 4-6 ──────────────────────────────────────────────
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';     // O=8-10: D≥5→H, D≤4→M
        if (o >= 6) return d >= 2 ? 'M' : 'L';      // O=6-7:  D≥2→M, D=1→L
        if (o >= 4) return d >= 7 ? 'M' : 'L';      // O=4-5:  D≥7→M, D≤6→L
        return 'L';                                   // O=1-3:  always L
    }

    // ── S = 7-8 ──────────────────────────────────────────────
    if (s <= 8) {
        if (o >= 8) return 'H';                       // O=8-10: always H
        if (o >= 6) return d >= 2 ? 'H' : 'M';       // O=6-7:  D≥2→H, D=1→M
        if (o >= 4) return d >= 7 ? 'H' : 'M';       // O=4-5:  D≥7→H, D≤6→M
        if (o >= 2) return d >= 5 ? 'M' : 'L';       // O=2-3:  D≥5→M, D≤4→L
        return 'L';                                    // O=1:    always L
    }

    // ── S = 9-10 ─────────────────────────────────────────────
    if (o >= 6) return 'H';                            // O=6-10: always H
    if (o >= 4) return d >= 2 ? 'H' : 'M';            // O=4-5:  D≥2→H, D=1→M
    if (o >= 2) {                                      // O=2-3:
        if (d >= 7) return 'H';                        //   D≥7→H
        if (d >= 5) return 'M';                        //   D=5-6→M
        return 'L';                                    //   D≤4→L
    }
    return 'L';                                        // O=1:    always L
}

/**
 * Calculate the Action Priority (AP) based on AIAG-VDA FMEA standard.
 * 
 * @param s - Severity rating (1-10)
 * @param o - Occurrence rating (1-10)
 * @param d - Detection rating (1-10)
 * @returns 'H' | 'M' | 'L' | '' (empty if inputs invalid)
 */
export function calculateAP(s: number, o: number, d: number): 'H' | 'M' | 'L' | '' {
    // Validate inputs — NaN check MUST come first, before Math.round,
    // because NaN comparisons always return false (bypassing range checks)
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';

    return apLookup[sInt][oInt][dInt];
}
