/**
 * AIAG-VDA FMEA Action Priority (AP) Lookup Table
 * 
 * Based on the AIAG & VDA FMEA Handbook (1st Edition, 2019).
 * Maps every combination of Severity (1-10), Occurrence (1-10), Detection (1-10)
 * to an Action Priority level: H (High), M (Medium), or L (Low).
 * 
 * Key principle: Severity is the DOMINANT factor. Safety-critical severities (9-10)
 * almost always result in H, regardless of O and D.
 */

type AP = 'H' | 'M' | 'L';

// The table is structured as apLookup[S][O][D] → AP
// Index 0 is unused (ratings go from 1-10)
const apLookup: AP[][][] = buildAPTable();

function buildAPTable(): AP[][][] {
    // Initialize 11x11x11 (index 0 unused)
    const table: AP[][][] = Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () =>
            Array(11).fill('L')
        )
    );

    // ═══════════════════════════════════════════════════
    // SEVERITY 10 (Safety / Regulatory — highest urgency)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 2 && d <= 2) {
                table[10][o][d] = 'M';
            } else if (o === 1 && d <= 3) {
                table[10][o][d] = 'M';
            } else {
                table[10][o][d] = 'H';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 9 (Safety / Regulatory with warning)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 2 && d <= 3) {
                table[9][o][d] = 'M';
            } else if (o <= 3 && d <= 2) {
                table[9][o][d] = 'M';
            } else {
                table[9][o][d] = 'H';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 8 (High severity — major disruption)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 2 && d <= 3) {
                table[8][o][d] = 'L';
            } else if (o <= 3 && d <= 4) {
                table[8][o][d] = 'M';
            } else if (o <= 4 && d <= 3) {
                table[8][o][d] = 'M';
            } else if (o >= 7 || d >= 7) {
                table[8][o][d] = 'H';
            } else {
                table[8][o][d] = 'M';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 7 (High severity)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 2 && d <= 3) {
                table[7][o][d] = 'L';
            } else if (o <= 3 && d <= 5) {
                table[7][o][d] = 'L';
            } else if (o <= 5 && d <= 3) {
                table[7][o][d] = 'L';
            } else if (o >= 8 || d >= 8) {
                table[7][o][d] = 'H';
            } else if (o >= 6 && d >= 6) {
                table[7][o][d] = 'H';
            } else {
                table[7][o][d] = 'M';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 6 (Moderate severity)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 3 && d <= 5) {
                table[6][o][d] = 'L';
            } else if (o <= 5 && d <= 3) {
                table[6][o][d] = 'L';
            } else if (o >= 8 && d >= 8) {
                table[6][o][d] = 'H';
            } else if (o >= 9 || d >= 9) {
                table[6][o][d] = 'H';
            } else if (o >= 7 && d >= 7) {
                table[6][o][d] = 'H';
            } else {
                table[6][o][d] = 'M';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 5 (Moderate severity)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 4 && d <= 5) {
                table[5][o][d] = 'L';
            } else if (o <= 5 && d <= 4) {
                table[5][o][d] = 'L';
            } else if (o >= 8 && d >= 8) {
                table[5][o][d] = 'H';
            } else if (o >= 9 && d >= 6) {
                table[5][o][d] = 'H';
            } else if (o >= 6 && d >= 9) {
                table[5][o][d] = 'H';
            } else {
                table[5][o][d] = 'M';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 4 (Low-moderate severity)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 5 && d <= 6) {
                table[4][o][d] = 'L';
            } else if (o <= 6 && d <= 5) {
                table[4][o][d] = 'L';
            } else if (o >= 9 && d >= 9) {
                table[4][o][d] = 'H';
            } else if (o >= 9 && d >= 7) {
                table[4][o][d] = 'M';
            } else if (o >= 7 && d >= 9) {
                table[4][o][d] = 'M';
            } else {
                table[4][o][d] = 'M';
            }
        }
    }
    // Fix: S=4 with moderate combinations should be L
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o <= 5 && d <= 6) table[4][o][d] = 'L';
            if (o <= 6 && d <= 5) table[4][o][d] = 'L';
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 3 (Low severity — minor annoyance)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o >= 10 && d >= 10) {
                table[3][o][d] = 'M';
            } else if (o >= 9 && d >= 9) {
                table[3][o][d] = 'M';
            } else {
                table[3][o][d] = 'L';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 2 (Very low — minor effect)
    // ═══════════════════════════════════════════════════
    for (let o = 1; o <= 10; o++) {
        for (let d = 1; d <= 10; d++) {
            if (o >= 10 && d >= 10) {
                table[2][o][d] = 'M';
            } else {
                table[2][o][d] = 'L';
            }
        }
    }

    // ═══════════════════════════════════════════════════
    // SEVERITY 1 (No effect) — Always L
    // ═══════════════════════════════════════════════════
    // Already initialized to 'L'

    return table;
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
    // Validate inputs
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);

    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) {
        return '';
    }
    if (isNaN(sInt) || isNaN(oInt) || isNaN(dInt)) {
        return '';
    }

    return apLookup[sInt][oInt][dInt];
}
