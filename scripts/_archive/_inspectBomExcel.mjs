// Read-only inspector for BOM Excel files in the server.
// Prints sheet names, headers and first few rows so we can design the parser.
// Usage: node scripts/_inspectBomExcel.mjs "<path-to-xlsx>"

import XLSX from 'xlsx-js-style';
import fs from 'fs';

const path = process.argv[2];
if (!path) {
    console.error('Usage: node scripts/_inspectBomExcel.mjs <path>');
    process.exit(1);
}
if (!fs.existsSync(path)) {
    console.error('File not found:', path);
    process.exit(1);
}

const wb = XLSX.readFile(path);
console.log('===== FILE:', path);
console.log('Sheets:', wb.SheetNames);
console.log();

for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    console.log(`----- Sheet: "${sheetName}" range ${ws['!ref']}, ${range.e.r + 1} rows × ${range.e.c + 1} cols -----`);
    // Cap range to avoid out-of-memory on corrupted sheets (1M rows × 16k cols).
    if (range.e.r > 500 || range.e.c > 50) {
        const safeRef = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.min(range.e.r, 60), c: Math.min(range.e.c, 20) } });
        ws['!ref'] = safeRef;
        console.log(`  (CLAMPED to ${safeRef} for safety)`);
    }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const limit = Math.min(rows.length, 25);
    for (let i = 0; i < limit; i++) {
        const row = rows[i];
        const trimmed = row.slice(0, 15).map(c => String(c).slice(0, 35));
        console.log(`  [${String(i).padStart(2, '0')}]`, trimmed.join(' | '));
    }
    if (rows.length > limit) console.log(`  ... (${rows.length - limit} more rows)`);
    console.log();
}
