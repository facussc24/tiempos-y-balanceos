#!/usr/bin/env node
/**
 * Verification script — checks all fixes were applied correctly
 */
import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

function parseData(row) { return typeof row.data === 'string' ? JSON.parse(row.data) : row.data; }

let pass = 0, fail = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    pass++;
  } else {
    console.log(`  FAIL: ${name} ${detail}`);
    fail++;
  }
}

async function main() {
  await initSupabase();

  // ── 1. All 8 AMFEs have flamabilidad ──
  console.log('\n=== CHECK 1: All AMFEs have flamabilidad ===');
  const amfes = await selectSql("SELECT amfe_number, data FROM amfe_documents WHERE amfe_number IN ('AMFE-00001', 'AMFE-ARMREST-001', 'AMFE-TOPROLL-001', 'AMFE-151', 'AMFE-153', 'AMFE-155', 'AMFE-PWA-112', 'AMFE-PWA-113')");

  for (const amfe of amfes) {
    const d = parseData(amfe);
    let hasFlamab = false;
    for (const op of (d.operations || [])) {
      for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
          for (const f of (fn.failures || [])) {
            if (/flamab/i.test(f.description)) hasFlamab = true;
          }
        }
      }
    }
    check(`${amfe.amfe_number} has flamabilidad`, hasFlamab);
  }

  // ── 2. All 8 CPs have at least 1 CC item ──
  console.log('\n=== CHECK 2: All CPs have CC items ===');
  const cps = await selectSql("SELECT control_plan_number, data FROM cp_documents WHERE control_plan_number NOT LIKE '%L1%' AND control_plan_number NOT LIKE '%L2%' AND control_plan_number NOT LIKE '%L3%'");

  for (const cp of cps) {
    const d = parseData(cp);
    const ccCount = (d.items || []).filter(i => i.specialCharClass === 'CC').length;
    check(`${cp.control_plan_number} has CC items (${ccCount})`, ccCount > 0);
  }

  // ── 3. No PWA product references TL 1010 ──
  console.log('\n=== CHECK 3: No PWA references TL 1010 ===');
  for (const table of ['amfe_documents', 'cp_documents', 'ho_documents']) {
    let query;
    if (table === 'amfe_documents') {
      query = `SELECT amfe_number as num, data FROM ${table} WHERE amfe_number LIKE '%PWA%'`;
    } else if (table === 'cp_documents') {
      query = `SELECT control_plan_number as num, data FROM ${table} WHERE control_plan_number LIKE '%TELAS%'`;
    } else {
      query = `SELECT part_description as num, data FROM ${table} WHERE part_description ILIKE '%telas%' OR part_description ILIKE '%termoform%' OR part_description ILIKE '%planas%'`;
    }
    const rows = await selectSql(query);
    for (const row of rows) {
      const str = JSON.stringify(parseData(row));
      const hasTL = /TL.?1010/i.test(str);
      check(`${table.split('_')[0]} ${row.num}: no TL 1010`, !hasTL, hasTL ? '(CONTAINS TL 1010!)' : '');
    }
  }

  // ── 4. No empty VDA effects ──
  console.log('\n=== CHECK 4: No empty VDA effects ===');
  const allAmfes = await selectSql("SELECT amfe_number, data FROM amfe_documents WHERE amfe_number NOT LIKE '%L1%' AND amfe_number NOT LIKE '%L2%' AND amfe_number NOT LIKE '%L3%'");
  let emptyEffects = 0;
  for (const amfe of allAmfes) {
    const d = parseData(amfe);
    for (const op of (d.operations || [])) {
      for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
          for (const f of (fn.failures || [])) {
            if (!f.effectLocal || !f.effectNextLevel || !f.effectEndUser) {
              emptyEffects++;
            }
          }
        }
      }
    }
  }
  check(`No empty VDA effects across all AMFEs`, emptyEffects === 0, `(${emptyEffects} empty effects found)`);

  // ── 5. No orphan QC items in headrests ──
  console.log('\n=== CHECK 5: No orphan QC items in headrests ===');
  const hrHos = await selectSql("SELECT part_description, data FROM ho_documents WHERE part_description ILIKE '%apoyacabeza%'");
  let orphanQcs = 0;
  for (const ho of hrHos) {
    const d = parseData(ho);
    for (const sheet of (d.sheets || [])) {
      for (const qc of (sheet.qualityChecks || [])) {
        if (!qc.cpItemId || qc.cpItemId.trim() === '') {
          orphanQcs++;
        }
      }
    }
  }
  check(`No orphan QC items in headrests`, orphanQcs === 0, `(${orphanQcs} orphans found)`);

  // ── 6. No duplicates in Top Roll Op 50 ──
  console.log('\n=== CHECK 6: No duplicates in Top Roll Op 50 ===');
  const [trAmfe] = await selectSql("SELECT data FROM amfe_documents WHERE amfe_number = 'AMFE-TOPROLL-001'");
  const trData = parseData(trAmfe);
  const op50 = trData.operations.find(op => op.opNumber === '50');
  let dupes = 0;
  if (op50) {
    for (const we of (op50.workElements || [])) {
      for (const fn of (we.functions || [])) {
        const seen = new Set();
        for (const f of (fn.failures || [])) {
          if (seen.has(f.description)) dupes++;
          seen.add(f.description);
        }
      }
    }
  }
  check(`No duplicate failures in Top Roll Op 50`, dupes === 0, `(${dupes} duplicates)`);

  // ── 7. No empty prevention controls in PWA ──
  console.log('\n=== CHECK 7: No empty prevention controls in PWA ===');
  const pwaAmfes = await selectSql("SELECT amfe_number, data FROM amfe_documents WHERE amfe_number LIKE '%PWA%'");
  let emptyPrev = 0;
  for (const amfe of pwaAmfes) {
    const d = parseData(amfe);
    for (const op of (d.operations || [])) {
      for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
          for (const f of (fn.failures || [])) {
            for (const c of (f.causes || [])) {
              if (!c.preventionControl || c.preventionControl.trim() === '') {
                emptyPrev++;
              }
            }
          }
        }
      }
    }
  }
  check(`No empty prevention controls in PWA`, emptyPrev === 0, `(${emptyPrev} empty)`);

  // ── 8. Insert Op 100 severity = 4 ──
  console.log('\n=== CHECK 8: Insert Op 100 severity ===');
  const [insertAmfe] = await selectSql("SELECT data FROM amfe_documents WHERE amfe_number = 'AMFE-00001'");
  const insertData = parseData(insertAmfe);
  const op100 = insertData.operations.find(op => op.opNumber === '100');
  let sev10in100 = false;
  if (op100) {
    for (const we of (op100.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const f of (fn.failures || [])) {
          if (/intenta quitar/i.test(f.description) && f.severity === 10) {
            sev10in100 = true;
          }
        }
      }
    }
  }
  check(`Insert Op 100 "quitar pieza" severity != 10`, !sev10in100);

  // ── 9. Telas Termoformadas has Control Final ──
  console.log('\n=== CHECK 9: Telas Termoformadas has Control Final ===');
  const [termoAmfe] = await selectSql("SELECT data FROM amfe_documents WHERE amfe_number = 'AMFE-PWA-113'");
  const termoData = parseData(termoAmfe);
  const hasControlFinal = termoData.operations.some(op => op.opNumber === '80' || /control.*final/i.test(op.name || ''));
  check(`Telas Termoformadas AMFE has Control Final`, hasControlFinal);

  const termoCps = await selectSql("SELECT data, control_plan_number FROM cp_documents WHERE control_plan_number ILIKE '%TERMO%'");
  if (termoCps.length > 0) {
    const termoCpData = parseData(termoCps[0]);
    const hasCpControlFinal = termoCpData.items.some(i => i.processStepNumber === '80');
    check(`Telas Termoformadas CP has Op 80 items`, hasCpControlFinal);
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  RESULTS: ${pass} PASS, ${fail} FAIL`);
  console.log(`${'='.repeat(50)}`);

  close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); close(); process.exit(1); });
