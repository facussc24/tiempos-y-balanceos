import { readFileSync, writeFileSync } from 'fs';
const data = JSON.parse(readFileSync('scripts/_dumped_amfes.json', 'utf8'));
const a2 = data['AMFE-2'];
const target = [80, 90, 100, 101, 102, 103, 105, 110, 120];
let out = '';
for (const op of a2.operations) {
  const n = op.opNumber ?? op.operationNumber;
  if (!target.includes(n)) continue;
  out += '=== OP ' + n + ' | ' + (op.name || op.operationName) + ' ===\n';
  out += '  fn: ' + (op.focusElementFunction || '').slice(0, 240) + '\n';
  out += '  opFn: ' + (op.operationFunction || '').slice(0, 140) + '\n';
  out += '  WEs: ' + (op.workElements || []).length + '\n';
  for (const we of (op.workElements || [])) {
    out += '    - [' + we.type + '] ' + we.name + ' (functions: ' + (we.functions || []).length + ')\n';
    for (const fn of (we.functions || [])) {
      out += '       fn.desc: ' + ((fn.description || fn.functionDescription || '').slice(0, 120)) + '\n';
      for (const fl of (fn.failures || [])) {
        out += '         FAIL: ' + (fl.description || '').slice(0, 100) + ' (causas: ' + (fl.causes || []).length + ')\n';
      }
    }
  }
}
writeFileSync('scripts/_amfe2_refs.txt', out);
console.log('Wrote scripts/_amfe2_refs.txt (' + out.length + ' chars)');
