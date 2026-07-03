import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync(new URL('../backups/amfe_pdfs/AMFE_de_Proceso___INSERTO.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'utf8'));
console.log('Pages:', d.total_pages);
for (const p of d.pages) {
  console.log('Page ' + p.page_number + ': ' + p.tables.length + ' tables, ' + (p.tables[0]?.rows||0) + ' rows');
  if (p.tables[0]) {
    const ops = new Set();
    for (const row of p.tables[0].data) {
      const opNum = (row[0]||'').trim();
      const opName = (row[1]||'').trim();
      if (opNum && opName && opNum.match(/^\d+$/)) {
        ops.add(opNum + ': ' + opName.substring(0,60));
      }
    }
    for (const op of [...ops]) console.log('  OP ' + op);
  }
}
