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

  const findings = [];
  const push = (level, check, msg) => findings.push({ level, check, msg });

  // === CHECK 1: Data Integrity ===
  let data = doc.data;
  const rawType = typeof data;
  if (rawType === 'string') {
    push('WARNING', '1-SERIALIZATION', `data is stored as string (TEXT), not JSONB object. typeof=${rawType}`);
    data = JSON.parse(data);
    if (typeof data === 'string') {
      push('BLOCKER', '1-DOUBLE-SERIAL', 'DOUBLE SERIALIZATION DETECTED');
      console.log(JSON.stringify({ findings }, null, 2));
      return;
    }
  } else {
    push('OK', '1-SERIALIZATION', 'data is object (JSONB). OK');
  }

  const ops = data.operations || [];
  const header = data.header || {};

  // Count actual operations, WEs, failures, causes
  let totalWEs = 0, totalFailures = 0, totalCauses = 0;
  let apH = 0, apM = 0, apL = 0, apEmpty = 0;

  for (const op of ops) {
    const wes = op.workElements || [];
    totalWEs += wes.length;
    for (const we of wes) {
      for (const fn of (we.functions || [])) {
        const fails = fn.failures || [];
        totalFailures += fails.length;
        for (const f of fails) {
          const causes = f.causes || [];
          totalCauses += causes.length;
          for (const c of causes) {
            const ap = (c.ap || c.actionPriority || '').toString().toUpperCase();
            if (ap === 'H') apH++;
            else if (ap === 'M') apM++;
            else if (ap === 'L') apL++;
            else apEmpty++;
          }
        }
      }
    }
  }

  // Count checks
  if (ops.length !== doc.operation_count) {
    push('BLOCKER', '1-OP-COUNT', `operation_count metadata=${doc.operation_count} but actual=${ops.length}`);
  } else {
    push('OK', '1-OP-COUNT', `operation_count matches: ${ops.length}`);
  }

  if (totalCauses !== doc.cause_count) {
    push('WARNING', '1-CAUSE-COUNT', `cause_count metadata=${doc.cause_count} but actual=${totalCauses}`);
  } else {
    push('OK', '1-CAUSE-COUNT', `cause_count matches: ${totalCauses}`);
  }

  // === CHECK HEADER: partNumber, confidentiality ===
  if (!header.partNumber || header.partNumber.trim() === '') {
    push('BLOCKER', 'HEADER-PN', 'partNumber is EMPTY');
  } else {
    push('OK', 'HEADER-PN', `partNumber: ${header.partNumber}`);
  }

  if (!header.confidentiality || header.confidentiality.trim() === '') {
    push('BLOCKER', 'HEADER-CONF', 'confidentiality is EMPTY');
  } else {
    push('OK', 'HEADER-CONF', `confidentiality: ${header.confidentiality}`);
  }

  // === CHECK DATES dd/MM/yyyy ===
  const dateFields = ['startDate', 'revDate'];
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  for (const df of dateFields) {
    const val = header[df];
    if (!val) {
      push('WARNING', 'DATES', `header.${df} is empty`);
    } else if (!dateRegex.test(val)) {
      push('BLOCKER', 'DATES', `header.${df}="${val}" does NOT match dd/MM/yyyy`);
    } else {
      push('OK', 'DATES', `header.${df}="${val}" OK`);
    }
  }

  // Check all date fields in causes (targetDate)
  let targetDateIssues = 0;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          for (const c of (f.causes || [])) {
            if (c.targetDate && c.targetDate.trim() !== '') {
              if (!dateRegex.test(c.targetDate)) {
                // Check if it is yyyy-MM-dd format
                if (/^\d{4}-\d{2}-\d{2}/.test(c.targetDate)) {
                  targetDateIssues++;
                  push('WARNING', 'DATES-CAUSE', `OP ${op.operationNumber} cause targetDate="${c.targetDate}" uses yyyy-MM-dd, not dd/MM/yyyy`);
                }
              }
            }
          }
        }
      }
    }
  }

  // === CHECK 2: VDA Structure ===
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '?';
    const opName = op.operationName || op.name || '?';
    const wes = op.workElements || [];

    if (wes.length === 0) {
      push('WARNING', '2-NO-WE', `OP ${opNum} "${opName}" has 0 work elements`);
    } else if (wes.length === 1) {
      push('WARNING', '2-FEW-WE', `OP ${opNum} "${opName}" has only 1 WE (probably missing 6M elements)`);
    }

    for (const we of wes) {
      const weName = we.name || we.description || '?';
      const fns = we.functions || [];
      if (fns.length === 0) {
        push('WARNING', '2-NO-FN', `OP ${opNum} WE "${weName}" has 0 functions`);
      }

      for (const fn of fns) {
        const fails = fn.failures || [];
        if (fails.length === 0) {
          // Not necessarily a problem - some functions may not have failures defined yet
        }

        for (const f of fails) {
          const fDesc = (f.description || '').substring(0, 50);

          // Check 3 effects
          if (!f.effectLocal || f.effectLocal.trim() === '') {
            push('BLOCKER', '2-EFFECT', `OP ${opNum} failure "${fDesc}" missing effectLocal`);
          }
          if (!f.effectNextLevel || f.effectNextLevel.trim() === '') {
            push('BLOCKER', '2-EFFECT', `OP ${opNum} failure "${fDesc}" missing effectNextLevel`);
          }
          if (!f.effectEndUser || f.effectEndUser.trim() === '') {
            push('BLOCKER', '2-EFFECT', `OP ${opNum} failure "${fDesc}" missing effectEndUser`);
          }

          const causes = f.causes || [];
          if (causes.length === 0) {
            push('WARNING', '2-NO-CAUSE', `OP ${opNum} failure "${fDesc}" has 0 causes`);
          }

          for (const c of causes) {
            const cDesc = (c.cause || c.description || '').substring(0, 50);
            const s = c.severity;
            const o = c.occurrence;
            const d = c.detection;

            // Check 2b: S/O/D completeness
            const hasS = s !== undefined && s !== null && s !== '' && s !== 0;
            const hasO = o !== undefined && o !== null && o !== '' && o !== 0;
            const hasD = d !== undefined && d !== null && d !== '' && d !== 0;

            if (!hasS || !hasO || !hasD) {
              push('BLOCKER', '2b-SOD', `OP ${opNum} cause "${cDesc}" incomplete S=${s} O=${o} D=${d}`);
            }

            // Check AP calculated
            const ap = c.ap || c.actionPriority || '';
            if (hasS && hasO && hasD && !ap) {
              push('WARNING', '2-NO-AP', `OP ${opNum} cause "${cDesc}" has S/O/D but no AP`);
            }
          }
        }
      }
    }

    // Check 2a: focusElementFunction and operationFunction
    if (wes.length > 0) {
      if (!op.focusElementFunction || op.focusElementFunction.trim() === '') {
        push('BLOCKER', '2a-FEF', `OP ${opNum} "${opName}" missing focusElementFunction`);
      } else {
        // Check 3 perspectives
        const fef = op.focusElementFunction;
        const hasInterno = /intern/i.test(fef);
        const hasCliente = /client/i.test(fef);
        const hasUsuario = /usuario/i.test(fef) || /final/i.test(fef);
        if (!hasInterno || !hasCliente || !hasUsuario) {
          push('WARNING', '2a-FEF-3PERSP', `OP ${opNum} focusElementFunction may lack 3 perspectives (Interno/Cliente/Usuario final)`);
        }
      }
      if (!op.operationFunction || op.operationFunction.trim() === '') {
        push('BLOCKER', '2a-OF', `OP ${opNum} "${opName}" missing operationFunction`);
      }
    }
  }

  // === CHECK 6: Naming ===
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '?';
    const opName = op.operationName || op.name || '?';
    if (opName !== opName.toUpperCase()) {
      push('WARNING', '6-UPPERCASE', `OP ${opNum} "${opName}" is not fully UPPERCASE`);
    }
  }

  // === CHECK 7: opNumber as string ===
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber;
    if (typeof opNum !== 'string') {
      push('BLOCKER', '7-OPNUM-TYPE', `OP operationNumber is ${typeof opNum}, not string`);
    }
  }

  // === CUSTOM: OP 110 naming ===
  let op110Found = false;
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '';
    const opName = op.operationName || op.name || '';
    if (opNum === '110') {
      op110Found = true;
      if (opName !== 'SOLDADURA CON ULTRASONIDO Y ENSAMBLE') {
        push('BLOCKER', 'CUSTOM-OP110', `OP 110 name is "${opName}" but should be "SOLDADURA CON ULTRASONIDO Y ENSAMBLE"`);
      } else {
        push('OK', 'CUSTOM-OP110', 'OP 110 name correct');
      }
    }
  }
  if (!op110Found) {
    push('BLOCKER', 'CUSTOM-OP110', 'OP 110 not found in operations list');
  }

  // === CUSTOM: OP 130 no packaging content ===
  let op130Found = false;
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '';
    const opName = op.operationName || op.name || '';
    if (opNum === '130') {
      op130Found = true;
      const opJson = JSON.stringify(op).toLowerCase();
      const pkgKeywords = ['embalaje', 'embalado', 'empaque', 'caja', 'packaging', 'pallet', 'palletizado', 'etiquetado'];
      const foundPkg = pkgKeywords.filter(k => opJson.includes(k));
      if (foundPkg.length > 0) {
        push('BLOCKER', 'CUSTOM-OP130', `OP 130 "${opName}" contains packaging content: ${foundPkg.join(', ')}`);
      } else {
        push('OK', 'CUSTOM-OP130', `OP 130 "${opName}" does NOT contain packaging content`);
      }
    }
  }
  if (!op130Found) {
    push('WARNING', 'CUSTOM-OP130', 'OP 130 not found');
  }

  // === CUSTOM: OP 10 separate WEs ===
  const requiredWEs = ['Vinilo PVC', 'Espuma PU', 'Sustrato PP+EPDM', 'Clips', 'Logo airbag', 'Tornillos', 'Difusor'];
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '';
    if (opNum === '10') {
      const wes = op.workElements || [];
      const weNames = wes.map(w => w.name || w.description || '');

      for (const req of requiredWEs) {
        const found = weNames.some(n => n.toLowerCase().includes(req.toLowerCase()));
        if (!found) {
          push('BLOCKER', 'CUSTOM-OP10-WE', `OP 10 missing separate WE for "${req}". WEs: [${weNames.join(' | ')}]`);
        } else {
          push('OK', 'CUSTOM-OP10-WE', `OP 10 has WE containing "${req}"`);
        }
      }

      // Check no WE groups multiple required items
      for (const we of wes) {
        const weName = we.name || we.description || '';
        const matchCount = requiredWEs.filter(r => weName.toLowerCase().includes(r.toLowerCase())).length;
        if (matchCount >= 2) {
          push('BLOCKER', 'CUSTOM-OP10-GROUPED', `OP 10 WE "${weName}" groups ${matchCount} required items together`);
        }
      }
    }
  }

  // === CUSTOM: Logo airbag CC (S>=9) ===
  let logoAirbagFound = false;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      const weName = (we.name || we.description || '').toLowerCase();
      if (weName.includes('logo') && weName.includes('airbag')) {
        logoAirbagFound = true;
        for (const fn of (we.functions || [])) {
          for (const f of (fn.failures || [])) {
            for (const c of (f.causes || [])) {
              const s = c.severity;
              const sc = c.specialChar || '';
              if (s >= 9 && sc === 'CC') {
                push('OK', 'CUSTOM-LOGO-CC', `Logo airbag cause S=${s} has CC. OK`);
              } else if (s >= 9 && sc !== 'CC') {
                push('BLOCKER', 'CUSTOM-LOGO-CC', `Logo airbag cause S=${s} should be CC but specialChar="${sc}"`);
              } else if (s < 9) {
                push('WARNING', 'CUSTOM-LOGO-SEV', `Logo airbag cause has S=${s}, expected S>=9 for safety`);
              }
            }
          }
        }
      }
    }
  }
  if (!logoAirbagFound) {
    push('BLOCKER', 'CUSTOM-LOGO-MISSING', 'No WE found with "Logo" + "airbag" in name');
  }

  // === CUSTOM: severity in failure (f.severity) ===
  let failuresWithSeverity = 0;
  let failuresWithoutSeverity = 0;
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          if (f.severity !== undefined && f.severity !== null && f.severity !== '') {
            failuresWithSeverity++;
          } else {
            failuresWithoutSeverity++;
          }
        }
      }
    }
  }
  push(
    failuresWithoutSeverity > 0 ? 'WARNING' : 'OK',
    'CUSTOM-FSEV',
    `Failures with f.severity: ${failuresWithSeverity}/${failuresWithSeverity + failuresWithoutSeverity}. Missing: ${failuresWithoutSeverity}`
  );

  // === CHECK 3: Severity calibration spot-check ===
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '?';
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          for (const c of (f.causes || [])) {
            const s = c.severity;
            const fDescFull = (f.description || '').toLowerCase();
            const cDescFull = (c.cause || c.description || '').toLowerCase();
            const weNameFull = (we.name || '').toLowerCase();

            if (s >= 9) {
              const safetyKeywords = ['flamab', 'voc', 'airbag', 'filo', 'borde', 'seguridad', 'logo', 'quemadura', 'incendio', 'toxi', 'normativa', 'legal'];
              const isSafety = safetyKeywords.some(k => fDescFull.includes(k) || cDescFull.includes(k) || weNameFull.includes(k));

              if (!isSafety) {
                push('WARNING', '3-SEV-HIGH', `OP ${opNum} S=${s} for non-obvious-safety: fail="${(f.description||'').substring(0,60)}" cause="${(c.cause||c.description||'').substring(0,60)}"`);
              }
            }
          }
        }
      }
    }
  }

  // === TOTALS ===
  console.log('=== AUDIT SUMMARY ===');
  console.log(`Document: ${header.scope || 'N/A'}`);
  console.log(`Status: ${doc.status}`);
  console.log(`Operations: ${ops.length} (metadata: ${doc.operation_count})`);
  console.log(`Work Elements: ${totalWEs}`);
  console.log(`Failures: ${totalFailures}`);
  console.log(`Causes: ${totalCauses} (metadata: ${doc.cause_count})`);
  console.log(`AP: H=${apH}, M=${apM}, L=${apL}, empty=${apEmpty}`);
  console.log(`Header partNumber: "${header.partNumber || ''}"`);
  console.log(`Header confidentiality: "${header.confidentiality || ''}"`);
  console.log(`Header startDate: "${header.startDate || ''}"`);
  console.log(`Header revDate: "${header.revDate || ''}"`);
  console.log(`Header revision: "${header.revision || ''}"`);
  console.log(`Header team: "${header.team || ''}"`);
  console.log(`Header responsible: "${header.responsible || ''}"`);
  console.log(`Header approvedBy: "${header.approvedBy || ''}"`);

  console.log('\n=== OPERATIONS LIST ===');
  for (const op of ops) {
    const opNum = op.operationNumber || op.opNumber || '?';
    const opName = op.operationName || op.name || '?';
    const wes = op.workElements || [];
    let opCauses = 0, opFailures = 0;
    for (const we of wes) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          opFailures++;
          opCauses += (f.causes || []).length;
        }
      }
    }
    const hasFEF = op.focusElementFunction ? 'Y' : 'N';
    const hasOF = op.operationFunction ? 'Y' : 'N';
    console.log(`  OP ${opNum.padStart(3)} | ${opName.padEnd(55)} | WEs=${wes.length} | Fails=${opFailures} | Causes=${opCauses} | FEF=${hasFEF} | OF=${hasOF}`);
    for (const we of wes) {
      console.log(`         WE: [${(we.type || '?').padEnd(12)}] ${we.name || we.description || '?'}`);
    }
  }

  // Print findings
  const blockers = findings.filter(f => f.level === 'BLOCKER');
  const warnings = findings.filter(f => f.level === 'WARNING');
  const oks = findings.filter(f => f.level === 'OK');

  console.log(`\n=== FINDINGS: ${blockers.length} BLOCKERS, ${warnings.length} WARNINGS, ${oks.length} OK ===`);

  if (blockers.length > 0) {
    console.log(`\nBLOCKERS (${blockers.length}):`);
    for (const f of blockers) {
      console.log(`  [BLOCKER] ${f.check}: ${f.msg}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    for (const f of warnings) {
      console.log(`  [WARNING] ${f.check}: ${f.msg}`);
    }
  }

  console.log(`\nOK (${oks.length}):`);
  for (const f of oks) {
    console.log(`  [OK] ${f.check}: ${f.msg}`);
  }
}

main().catch(e => console.error(e));
