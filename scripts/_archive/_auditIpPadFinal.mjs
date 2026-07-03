import { readFileSync } from 'fs';
const amfes = JSON.parse(readFileSync('backups/2026-04-08T12-52-56/amfe_documents.json','utf8'));
const ip = amfes.find(a => a.id === 'c9b93b84-f804-4cd0-91c1-c4878db41b97');
let d = ip.data;
if (typeof d === 'string') d = JSON.parse(d);

const errors = [], warnings = [], ok = [];

// 1. Numbering
const expected = ['10','20','30','40','50','60','70','80','90','100','110','120','130'];
const actual = d.operations.map(o => o.opNumber);
if (JSON.stringify(expected) === JSON.stringify(actual)) ok.push('Numbering: ' + actual.join(','));
else errors.push('Numbering: expected ' + expected.join(',') + ' got ' + actual.join(','));

// 2. Aliases
let aliasBad = 0;
d.operations.forEach(op => {
  if (op.opNumber !== op.operationNumber) { aliasBad++; errors.push('OP ' + op.opNumber + ' opNumber!=operationNumber: ' + op.operationNumber); }
  if (op.name !== op.operationName) { aliasBad++; errors.push('OP ' + op.opNumber + ' name!=operationName'); }
});
if (aliasBad === 0) ok.push('All op aliases synced');

// 3. WEs
let weBad = 0;
d.operations.forEach(op => {
  op.workElements?.forEach(we => {
    if (!we.name || !we.type) { weBad++; warnings.push('OP ' + op.opNumber + ' WE missing name/type'); }
  });
});
if (weBad === 0) ok.push('All WEs have name+type');

// 4. Causes
let causeNoAp = 0, totalC = 0, totalF = 0, totalWE = 0;
d.operations.forEach(op => {
  totalWE += (op.workElements || []).length;
  op.workElements?.forEach(we => {
    we.functions?.forEach(fn => {
      fn.failures?.forEach(f => {
        totalF++;
        f.causes?.forEach(c => {
          totalC++;
          if (c.ap === undefined && c.actionPriority === undefined) causeNoAp++;
        });
      });
    });
  });
});
if (causeNoAp === 0) ok.push('All causes have ap');
else warnings.push(causeNoAp + ' causes missing ap');

// 5. No PRIMER
if (d.operations.some(o => (o.name || '').includes('PRIMER'))) errors.push('PRIMER found!');
else ok.push('No PRIMER');

// 6. Equipment
if (d.operations.some(o => o.workElements?.some(we => (we.name || '').toLowerCase().includes('pistola de ultrasonido')))) errors.push('pistola de ultrasonido!');
else ok.push('Equipment names OK');

// 7. VDA effects
let missingEffects = 0;
d.operations.forEach(op => {
  op.workElements?.forEach(we => {
    we.functions?.forEach(fn => {
      fn.failures?.forEach(f => {
        if (!f.effectLocal || !f.effectNextLevel || !f.effectEndUser) missingEffects++;
      });
    });
  });
});
if (missingEffects === 0) ok.push('All failures have 3-level VDA effects');
else warnings.push(missingEffects + ' failures missing VDA effects');

// PFD coherence
const pfds = JSON.parse(readFileSync('backups/2026-04-08T12-52-56/pfd_documents.json','utf8'));
const pfd = pfds.find(p => p.id === 'pfd-ippads-trim-asm-upr-wrapping');
let pd = pfd.data;
if (typeof pd === 'string') pd = JSON.parse(pd);
const pfdOps = pd.steps.filter(s => s.stepNumber && s.stepType === 'operation');
const amfeNums = new Set(d.operations.map(o => o.opNumber));
let pfdMissing = 0;
pfdOps.forEach(s => {
  const n = s.stepNumber.replace('OP ', '');
  if (!amfeNums.has(n)) { pfdMissing++; warnings.push('PFD OP ' + n + ' ' + s.description + ' not in AMFE'); }
});
if (pfdMissing === 0) ok.push('PFD<->AMFE: all PFD ops covered');

console.log('=== AUDIT IP PAD AMFE (post-fix) ===');
console.log('Ops:', d.operations.length, '| WEs:', totalWE, '| Failures:', totalF, '| Causes:', totalC);
console.log('\nBLOCKERS:', errors.length);
errors.forEach(e => console.log('  X', e));
console.log('WARNINGS:', warnings.length);
warnings.forEach(w => console.log('  !', w));
console.log('OK:', ok.length);
ok.forEach(o => console.log('  +', o));
console.log('\nResult:', errors.length === 0 ? 'PASS' : 'FAIL');
