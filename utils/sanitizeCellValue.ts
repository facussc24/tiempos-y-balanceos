/**
 * Sanitize a cell value to prevent Excel formula injection.
 * Prefixes with a single quote (') if the value starts with =, @, +, -, tab, or CR/LF.
 * The single quote is Excel's standard "text prefix" and won't display in the cell.
 *
 * Shared utility used by both AMFE and Control Plan Excel exports.
 */
export function sanitizeCellValue(value: string | number | undefined | null): string | number {
    if (value == null) return '';
    if (typeof value === 'number') return value;
    const s = String(value);
    if (s.length > 0 && '=@+-\t\r\n'.includes(s[0])) return "'" + s;
    return s;
}
