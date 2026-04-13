const SUPABASE_URL = 'https://fbfsbbewmgoegjgnkkag.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4';
const DOC_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

async function main() {
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@barack.com', password: 'U3na%LNSYVmVCYvP' })
  });
  const auth = await authResp.json();

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/amfe_documents?id=eq.${DOC_ID}&select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json'
    }
  });
  const rows = await resp.json();
  const doc = rows[0];
  let data = doc.data;
  if (typeof data === 'string') data = JSON.parse(data);
  const ops = data.operations || [];

  // 1. Detail OP 130 - what packaging content is in it?
  console.log('=== OP 130 DETAIL ===');
  for (const op of ops) {
    if ((op.operationNumber || op.opNumber) === '130') {
      console.log('Name:', op.operationName || op.name);
      console.log('WEs:');
      for (const we of (op.workElements || [])) {
        console.log(`  WE: [${we.type}] "${we.name || we.description}"`);
        for (const fn of (we.functions || [])) {
          console.log(`    Fn: "${fn.description}"`);
          for (const f of (fn.failures || [])) {
            console.log(`      Fail: "${f.description}" | effectLocal: "${f.effectLocal}" | effectNextLevel: "${f.effectNextLevel}" | effectEndUser: "${f.effectEndUser}"`);
            for (const c of (f.causes || [])) {
              console.log(`        Cause: "${c.cause || c.description}" | S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap || c.actionPriority}`);
              console.log(`          prev: "${c.preventionControl}" | det: "${c.detectionControl}"`);
            }
          }
        }
      }
    }
  }

  // 2. Detail Logo airbag
  console.log('\n=== LOGO AIRBAG DETAIL ===');
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      const weName = (we.name || we.description || '').toLowerCase();
      if (weName.includes('logo') && weName.includes('airbag')) {
        console.log(`OP ${op.operationNumber}: WE: [${we.type}] "${we.name || we.description}"`);
        for (const fn of (we.functions || [])) {
          console.log(`  Fn: "${fn.description}"`);
          for (const f of (fn.failures || [])) {
            console.log(`  Fail: "${f.description}" | f.severity=${f.severity}`);
            for (const c of (f.causes || [])) {
              console.log(`    Cause: "${c.cause || c.description}" | S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap || c.actionPriority} | specialChar="${c.specialChar || ''}"`);
            }
          }
        }
      }
    }
  }

  // 3. f.severity check for ALL failures
  console.log('\n=== F.SEVERITY CHECK ===');
  let total = 0, withSev = 0, withoutSev = 0;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          total++;
          if (f.severity !== undefined && f.severity !== null && f.severity !== '') {
            withSev++;
          } else {
            withoutSev++;
            console.log(`  MISSING f.severity: OP ${op.operationNumber} fail="${(f.description || '').substring(0,60)}" (value: ${f.severity})`);
          }
        }
      }
    }
  }
  console.log(`Total failures: ${total}, with severity: ${withSev}, without: ${withoutSev}`);

  // 4. OP 100 naming check
  console.log('\n=== OP 100 NAMING ===');
  for (const op of ops) {
    if ((op.operationNumber || op.opNumber) === '100') {
      console.log(`OP 100 name: "${op.operationName || op.name}"`);
      // Check for English terms
      const name = op.operationName || op.name || '';
      if (/WRAPPING|EDGE FOLDING|TRIMMING/i.test(name)) {
        console.log('  WARNING: Contains English terms');
      }
    }
  }

  // 5. Check all cause targetDates format
  console.log('\n=== TARGET DATE FORMATS ===');
  let dateIssues = 0;
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          for (const c of (f.causes || [])) {
            if (c.targetDate && c.targetDate.trim() !== '') {
              if (!dateRegex.test(c.targetDate)) {
                dateIssues++;
                console.log(`  BAD DATE: OP ${op.operationNumber} cause="${(c.cause||c.description||'').substring(0,40)}" targetDate="${c.targetDate}"`);
              }
            }
          }
        }
      }
    }
  }
  console.log(`Date issues found: ${dateIssues}`);

  // 6. Check for "capacitacion" as cause
  console.log('\n=== CAPACITACION CHECK ===');
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          for (const c of (f.causes || [])) {
            const cText = (c.cause || c.description || '').toLowerCase();
            if (cText.includes('capacitaci') || cText.includes('entrenamiento') || cText.includes('no capacitado')) {
              console.log(`  FOUND: OP ${op.operationNumber} cause="${c.cause || c.description}"`);
            }
          }
        }
      }
    }
  }

  // 7. OP 10 WE detail
  console.log('\n=== OP 10 WE DETAIL ===');
  for (const op of ops) {
    if ((op.operationNumber || op.opNumber) === '10') {
      for (const we of (op.workElements || [])) {
        const weName = we.name || we.description || '';
        console.log(`  WE: [${we.type}] "${weName}" | fns=${(we.functions||[]).length}`);
        for (const fn of (we.functions || [])) {
          console.log(`    Fn: "${fn.description}" | fails=${(fn.failures||[]).length}`);
        }
      }
    }
  }

  // 8. Check 2a focusElementFunction detail for all ops
  console.log('\n=== FOCUS ELEMENT FUNCTION DETAIL ===');
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '?';
    const fef = op.focusElementFunction || '';
    const of2 = op.operationFunction || '';
    console.log(`  OP ${opNum}: FEF=${fef ? '"' + fef.substring(0, 100) + '..."' : 'EMPTY'}`);
    console.log(`         OF=${of2 ? '"' + of2.substring(0, 100) + '..."' : 'EMPTY'}`);
  }
}

main().catch(e => console.error(e));
