/**
 * Excel cell character limit (per ECMA-376, 4th edition §18.3.1.53).
 * Strings exceeding this will be silently truncated by Excel.
 */
export const EXCEL_CELL_LIMIT = 32767;

/**
 * Sanitize a cell value to prevent Excel formula injection and enforce length limits.
 * - Prefixes with a single quote (') if the value starts with =, @, +, -, tab, or CR/LF.
 *   The single quote is Excel's standard "text prefix" and won't display in the cell.
 * - Truncates strings exceeding Excel's 32,767 character cell limit to prevent
 *   silent data corruption when the file is opened.
 *
 * Shared utility used by AMFE, Control Plan, HO, PFD, and Solicitud Excel exports.
 */
export function sanitizeCellValue(value: string | number | undefined | null): string | number {
    if (value == null) return '';
    if (typeof value === 'number') return value;
    let s = String(value);
    if (s.length > 0 && '=@+-\t\r\n'.includes(s[0])) s = "'" + s;
    // FIX: Truncate to Excel cell limit to prevent silent data loss
    if (s.length > EXCEL_CELL_LIMIT) {
        s = s.substring(0, EXCEL_CELL_LIMIT);
    }
    return s;
}
