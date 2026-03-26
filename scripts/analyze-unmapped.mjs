import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fbfsbbewmgoegjgnkkag.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4');
await supabase.auth.signInWithPassword({ email: 'admin@barack.com', password: 'U3na%LNSYVmVCYvP' });

const { data: amfeRows, error: ae } = await supabase.from('amfe_documents').select('data').eq('id', '938978d7-7e49-4d72-bc3e-8673320e9737');
if (ae || !amfeRows?.length) { console.error('AMFE load failed', ae); process.exit(1); }
const amfe = JSON.parse(amfeRows[0].data);

const { data: cpRows, error: ce } = await supabase.from('cp_documents').select('data').eq('id', '8942ef5b-2a20-42cd-ba71-84817a6b784b');
if (ce || !cpRows?.length) { console.error('CP load failed', ce); process.exit(1); }
const cp = JSON.parse(cpRows[0].data);

// Build cause map AND failure map
const causeMap = new Map();
const failureMap = new Map();
for (const op of amfe.operations) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        const sev = Number(fail.severity) || 0;
        const causes = (fail.causes || []);
        failureMap.set(fail.id, { severity: sev, causes, opNumber: op.opNumber });
        for (const c of causes) {
          causeMap.set(c.id, { ap: c.ap, severity: sev, occurrence: c.occurrence, detection: c.detection });
        }
      }
    }
  }
}

console.log('AMFE causes:', causeMap.size, '| Failure modes:', failureMap.size);

// Analyze CP items
let matched = 0, matchedByFailure = 0, totalUnmapped = 0;
const unmappedByAp = { H: 0, M: 0, L: 0, '': 0 };
const unmappedBySev = {};
const matchedByFailureDetails = [];

for (const item of cp.items) {
  const causeIds = item.amfeCauseIds || [];
  const hasCauseMatch = causeIds.some(id => causeMap.has(id));

  if (hasCauseMatch) { matched++; continue; }

  totalUnmapped++;
  unmappedByAp[item.amfeAp || '']++;
  unmappedBySev[item.amfeSeverity || 0] = (unmappedBySev[item.amfeSeverity || 0] || 0) + 1;

  // Try matching by amfeFailureId or amfeFailureIds
  const failureIds = [...new Set([item.amfeFailureId, ...(item.amfeFailureIds || [])])].filter(Boolean);
  const failureMatch = failureIds.some(fid => failureMap.has(fid));
  if (failureMatch) {
    matchedByFailure++;
    if (matchedByFailureDetails.length < 3) {
      const fid = failureIds.find(fid => failureMap.has(fid));
      const fail = failureMap.get(fid);
      matchedByFailureDetails.push({
        step: item.processStepNumber,
        currentAp: item.amfeAp,
        char: (item.processCharacteristic || item.productCharacteristic || '').substring(0, 60),
        failureCauses: fail.causes.map(c => c.ap)
      });
    }
  }
}

console.log('\n=== UNMAPPED ITEMS ANALYSIS ===');
console.log('Total CP items:', cp.items.length);
console.log('Matched by causeId:', matched);
console.log('Unmatched:', totalUnmapped);
console.log('  Matchable by failureId:', matchedByFailure);
console.log('  Truly unmapped:', totalUnmapped - matchedByFailure);
console.log('Unmapped by current AP:', unmappedByAp);
console.log('Unmapped by severity:', JSON.stringify(unmappedBySev));
console.log('Sample failure-matched:', matchedByFailureDetails);

// Check: how many CP items have empty amfeCauseIds?
let emptyCauseIds = 0;
let singleCause = 0;
let multiCause = 0;
for (const item of cp.items) {
  const n = (item.amfeCauseIds || []).length;
  if (n === 0) emptyCauseIds++;
  else if (n === 1) singleCause++;
  else multiCause++;
}
console.log('\namfeCauseIds length distribution:');
console.log('  Empty:', emptyCauseIds);
console.log('  1 cause:', singleCause);
console.log('  2+ causes:', multiCause);

// Check a specific unmapped causeId
const sampleUnmapped = cp.items.find(it => {
  const ids = it.amfeCauseIds || [];
  return ids.length > 0 && !ids.some(id => causeMap.has(id));
});
if (sampleUnmapped) {
  console.log('\nSample unmapped item:');
  console.log('  causeIds:', sampleUnmapped.amfeCauseIds);
  console.log('  failureId:', sampleUnmapped.amfeFailureId);
  console.log('  failureId in AMFE?', failureMap.has(sampleUnmapped.amfeFailureId));
}

// ALL unique causeIds from CP
const allCpCauseIds = new Set();
for (const item of cp.items) {
  for (const id of (item.amfeCauseIds || [])) allCpCauseIds.add(id);
}
const matchedCauseIds = [...allCpCauseIds].filter(id => causeMap.has(id));
console.log('\nUnique causeIds in CP:', allCpCauseIds.size);
console.log('Found in AMFE:', matchedCauseIds.length);
console.log('Not found:', allCpCauseIds.size - matchedCauseIds.length);

await supabase.auth.signOut();
