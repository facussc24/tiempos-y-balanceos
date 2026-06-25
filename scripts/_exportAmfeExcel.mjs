/**
 * _exportAmfeExcel.mjs — Exporta AMFE-3 y AMFE-4 (serie) a un Excel de revision rapida.
 * Lee el archivo persistido del resultado MCP (flat query, 1 fila por causa, con campo 'amfe'),
 * lo parsea, agrupa por AMFE en hojas, y genera el xlsx con AP coloreado (H rojo/M ambar/L verde)
 * y CC/SC resaltado. Salida en C:\Users\facun\Documents\AMFE_SERIE_PWA\.
 */
import ExcelJS from 'exceljs';
import { readFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv[2] || 'C:/Users/facun/.claude/projects/C--Users-facun-OneDrive-Documentos/dc9ddeea-1979-4e4d-b759-03a2bd8992f2/tool-results/mcp-a174b030-f4bf-4d80-a56f-a6a142cea470-execute_sql-1782350190766.txt';

// --- parse persisted MCP result -> rows[] ---
const fileTxt = readFileSync(SRC, 'utf8');
const wrapper = JSON.parse(fileTxt);              // { result: "...<untrusted-data>\n[...]\n</...>..." }
const m = wrapper.result.match(/\n(\[[\s\S]*\])\n<\/untrusted-data/);
if (!m) { console.error('No pude extraer el array de datos'); process.exit(1); }
const outer = JSON.parse(m[1]);                   // [{ rows: [ {...}, ... ] }]
const rows = outer[0].rows;
console.log('Filas leidas:', rows.length);

// --- agrupar por AMFE ---
const SHEETS = {
  'AMFE-3 Grampas (SERIE)': rows.filter(r => r.amfe === 'AMFE-3'),
  'AMFE-4 Aplix+TNT (SERIE)': rows.filter(r => r.amfe === 'AMFE-4'),
};

const COLS = [
  { h: 'OP', k: 'opn', w: 6 }, { h: 'Operacion', k: 'op_name', w: 30 },
  { h: 'Func. Operacion (N2)', k: 'op_func', w: 30 },
  { h: 'Elemento (6M)', k: 'we_name', w: 26 }, { h: 'Tipo', k: 'we_type', w: 11 },
  { h: 'Func. Elemento (N3)', k: 'func', w: 30 }, { h: 'Modo de Falla', k: 'failure', w: 30 },
  { h: 'Efecto Local', k: 'ef_local', w: 24 }, { h: 'Efecto Sig. Nivel', k: 'ef_next', w: 24 }, { h: 'Efecto Usuario Final', k: 'ef_user', w: 24 },
  { h: 'Causa', k: 'cause', w: 30 },
  { h: 'S', k: 's', w: 4 }, { h: 'O', k: 'o', w: 4 }, { h: 'D', k: 'd', w: 4 }, { h: 'AP', k: 'ap', w: 5 }, { h: 'CC/SC', k: 'sc', w: 7 },
  { h: 'Control Prevencion', k: 'prev', w: 30 }, { h: 'Control Deteccion', k: 'det', w: 30 }, { h: 'Accion', k: 'prev_action', w: 22 },
];
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const BORD = () => { const s = { style: 'thin', color: { argb: 'FFBFBFBF' } }; return { top: s, left: s, bottom: s, right: s }; };

const wb = new ExcelJS.Workbook();
wb.creator = 'Barack Mercosul'; wb.created = new Date('2026-06-24T12:00:00Z');

function addSheet(name, data) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLS.map(c => ({ header: c.h, key: c.k, width: c.w }));
  data.forEach(r => ws.addRow(r));
  const hr = ws.getRow(1);
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  hr.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hr.height = 32;
  hr.eachCell(c => { c.fill = fill('FF1F3864'); c.border = BORD(); });
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell({ includeEmpty: true }, c => { c.border = BORD(); });
    for (const k of ['opn', 's', 'o', 'd', 'ap', 'sc', 'we_type']) row.getCell(k).alignment = { vertical: 'middle', horizontal: 'center' };
    const ap = row.getCell('ap');
    if (ap.value === 'H') { ap.fill = fill('FFFF0000'); ap.font = { bold: true, color: { argb: 'FFFFFFFF' } }; }
    else if (ap.value === 'M') { ap.fill = fill('FFFFC000'); ap.font = { bold: true }; }
    else if (ap.value === 'L') ap.fill = fill('FF92D050');
    const sc = row.getCell('sc');
    if (sc.value === 'CC') { sc.fill = fill('FFFF0000'); sc.font = { bold: true, color: { argb: 'FFFFFFFF' } }; }
    else if (sc.value === 'SC') { sc.fill = fill('FFFFC000'); sc.font = { bold: true }; }
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: COLS.length } };
  return ws.rowCount - 1;
}

let total = 0;
for (const [name, data] of Object.entries(SHEETS)) { const n = addSheet(name, data); console.log(`hoja "${name}": ${n} filas`); total += n; }

const dir = 'C:/Users/facun/Documents/AMFE_SERIE_PWA';
mkdirSync(dir, { recursive: true });
const dest = `${dir}/AMFE_Serie_PWA_2026-06-24.xlsx`;
await wb.xlsx.writeFile(dest);
console.log(`OK Excel: ${dest} (${total} filas)`);
