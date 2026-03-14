const XLSX = require('xlsx-js-style');
const file = process.argv[2];
const wb = XLSX.readFile(file);
console.log('=== SHEETS:', wb.SheetNames);
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  console.log('\n=== SHEET:', name, '| Range:', ws['!ref'], '| Rows:', range.e.r+1, '| Cols:', range.e.c+1);
  if (ws['!merges']) console.log('Merges:', JSON.stringify(ws['!merges'].slice(0,20)));
  // Print column widths
  if (ws['!cols']) console.log('ColWidths:', JSON.stringify(ws['!cols'].slice(0,20)));
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  data.forEach((row, i) => {
    const vals = row.map(v => v === '' ? '.' : String(v).substring(0, 50));
    if (vals.some(v => v !== '.')) console.log('R' + (i+1) + ':', vals.join(' | '));
  });
  // Print formulas
  console.log('\n--- FORMULAS ---');
  Object.keys(ws).forEach(cell => {
    if (cell.startsWith('!')) return;
    if (ws[cell].f) console.log(cell + ': =' + ws[cell].f);
  });
});
