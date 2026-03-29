/**
 * Formula template builders for balancing Excel export.
 * Handles cell reference generation and Excel formula construction.
 */

/** Convert 0-based column index to Excel column letter(s): 0→"A", 25→"Z", 26→"AA" */
function colLetter(col: number): string {
    let result = '';
    let n = col;
    while (n >= 0) {
        result = String.fromCharCode((n % 26) + 65) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}

/** Convert 0-based col/row to Excel cell address: (0, 4) → "A5" */
function cellAddr(col: number, row: number): string {
    return `${colLetter(col)}${row + 1}`;
}

/** Build Excel range string: (0,0, 2,4) → "A1:C5" */
function rangeAddr(startCol: number, startRow: number, endCol: number, endRow: number): string {
    return `${cellAddr(startCol, startRow)}:${cellAddr(endCol, endRow)}`;
}

/** AVERAGE formula over specific cells (for time measurements, skipping blanks) */
function averageFormula(cells: string[]): string {
    if (cells.length === 0) return '0';
    if (cells.length === 1) return cells[0];
    return `AVERAGE(${cells.join(',')})`;
}

/** Standard time formula: avg * rating * (1 + fatigue) */
function standardTimeFormula(avgCell: string, ratingCell: string, fatiguePct: number): string {
    if (fatiguePct > 0) {
        return `${avgCell}*${ratingCell}*(1+${fatiguePct / 100})`;
    }
    return `${avgCell}*${ratingCell}`;
}

/** Takt time formula: (available_minutes * 60) / demand
 *  FIX: Added IF guard to prevent #DIV/0! when demand cell is 0 */
function taktFormula(availMinutesCell: string, demandCell: string): string {
    return `IF(${demandCell}>0,(${availMinutesCell}*60)/${demandCell},0)`;
}

/** Pieces per hour: 3600 / cycle_time */
function piecesPerHourFormula(cycleTimeCell: string): string {
    return `IF(${cycleTimeCell}>0,3600/${cycleTimeCell},0)`;
}

/** Station assignment matrix cell: IF matched, return std time, else 0 */
function assignmentFormula(stationCol: number, headerRow: number, operatorCell: string, stdTimeCell: string): string {
    const stationHeader = cellAddr(stationCol, headerRow);
    return `IF(${stationHeader}=${operatorCell},${stdTimeCell},0)`;
}
