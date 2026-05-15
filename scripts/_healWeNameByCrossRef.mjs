/**
 * Healing cross-ref de WE.name y fn.description en AMFEs Supabase.
 *
 * Reemplaza placeholders genericos (etiquetas 6M, "Proceso Op X", fn vacias) por
 * texto canonico extraido del cross-ref con otros AMFEs Barack vivos. El engine
 * (scripts/_lib/healingEngine.mjs) decide la jerarquia de fuentes y la confianza.
 *
 * Regla absoluta: dry-run por default. NUNCA escribe si engine retorna value=null
 * (registra TBD pero deja el campo intacto). NUNCA usa allowNewCritical:true.
 *
 * Uso:
 *   node scripts/_healWeNameByCrossRef.mjs                              # dry-run, todos los AMFEs
 *   node scripts/_healWeNameByCrossRef.mjs --filter=ARM                 # dry-run, solo AMFEs con "ARM" en amfe_number
 *   node scripts/_healWeNameByCrossRef.mjs --filter=HF-PAT --apply      # aplicar
 *   node scripts/_healWeNameByCrossRef.mjs --field=we                   # solo WE.name
 *   node scripts/_healWeNameByCrossRef.mjs --field=fn                   # solo fn.description
 *   node scripts/_healWeNameByCrossRef.mjs --report=docs/auto-mejora/x.md
 *
 * Backup obligatorio antes (skill supabase-safety):
 *   node scripts/_backup.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe, saveAmfe, parseData } from './_lib/amfeIo.mjs';
import { isGeneric6MLabel, classifyWeNameVsType } from './_lib/genericLabels.mjs';
import {
  findCanonicalWeName,
  findCanonicalFnDescription,
  classifyOpType,
} from './_lib/healingEngine.mjs';

// ─── Args parsing ──────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const rawArgs = process.argv.slice(2);

function getArgValue(name) {
  const prefix = `--${name}=`;
  const hit = rawArgs.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const filterArg = getArgValue('filter');
const fieldArg = (getArgValue('field') || 'both').toLowerCase();
if (!['we', 'fn', 'both'].includes(fieldArg)) {
  console.error(`ERROR: --field debe ser we | fn | both (recibido: ${fieldArg})`);
  process.exit(1);
}

function todayUTCDate() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const reportPath = getArgValue('report') || `docs/auto-mejora/heal-cross-ref-baseline-${todayUTCDate()}.md`;

console.log(`Config: filter=${filterArg || '(sin filtro)'} field=${fieldArg} report=${reportPath}`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseRowData(raw) {
  // parseData del helper centralizado maneja double-serialize. Fallback inline igual.
  try {
    return parseData(raw);
  } catch {
    if (raw == null) return null;
    if (typeof raw !== 'string') return raw;
    try {
      const p = JSON.parse(raw);
      if (typeof p === 'string') {
        try { return JSON.parse(p); } catch { return null; }
      }
      return p;
    } catch {
      return null;
    }
  }
}

function isWeNameCandidateToHeal(weName, weType) {
  const trimmed = (weName || '').trim();
  if (!trimmed) return true; // vacio = candidato a TBD/canonical
  if (isGeneric6MLabel(trimmed)) return true;
  if (/^proceso\s+op\s+\d*$/i.test(trimmed)) return true;
  const cls = classifyWeNameVsType(trimmed, weType);
  if (cls && cls.ok === false) return true;
  return false;
}

function isFnDescCandidateToHeal(fnDesc) {
  const trimmed = (fnDesc || '').trim();
  if (!trimmed) return true;
  if (isGeneric6MLabel(trimmed)) return true;
  if (trimmed.length < 10) return true;
  return false;
}

function shortStr(s, n = 60) {
  if (s == null) return '';
  const str = String(s).replace(/\s+/g, ' ').trim();
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function mdEscape(s) {
  if (s == null) return '';
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

// ─── Main flow ────────────────────────────────────────────────────────────────

const sb = await connectSupabase();

const { data: allRows, error: listErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data');
if (listErr) {
  console.error('ERROR list:', listErr.message);
  process.exit(1);
}

// Parsear todos los AMFEs una sola vez (el engine los necesita como pool de cross-ref)
const allAmfes = [];
for (const row of allRows) {
  const doc = safeParseRowData(row.data);
  if (!doc || !Array.isArray(doc.operations)) {
    console.warn(`  skip ${row.amfe_number}: data unparseable o sin operations`);
    continue;
  }
  allAmfes.push({ id: row.id, amfe_number: row.amfe_number, doc });
}
console.log(`Total AMFEs parseados: ${allAmfes.length}`);

// Filtrar targets
const targets = allAmfes.filter(a => {
  if (!filterArg) return true;
  return (a.amfe_number || '').toLowerCase().includes(filterArg.toLowerCase());
});
console.log(`Targets tras filter: ${targets.length}`);

if (targets.length === 0) {
  console.log('Nada que procesar.');
  process.exit(0);
}

// Stats acumulados
const stats = {
  weFixed: 0,
  fnFixed: 0,
  tbd: 0,
  byConfidence: { high: 0, medium: 0, low: 0 },
  byAmfe: {},
};
const plan = [];
const changeRows = []; // para el reporte md

for (const target of targets) {
  const beforeClone = structuredClone(target.doc);
  const localChanges = [];

  for (const op of target.doc.operations || []) {
    const opName = op.name || op.operationName || '';
    const opNum = op.opNumber || op.operationNumber || '';
    const opType = classifyOpType(opName);

    for (const we of op.workElements || []) {
      const weType = we.type || '';
      const weNameBefore = we.name || '';

      // ── WE.name healing ──
      if (fieldArg !== 'fn') {
        if (isWeNameCandidateToHeal(weNameBefore, weType)) {
          const r = findCanonicalWeName({
            opName,
            opType,
            weType,
            allAmfes,
            currentAmfeId: target.id,
          });
          const row = {
            amfe: target.amfe_number,
            opNum,
            opType,
            weType,
            field: 'WE.name',
            current: weNameBefore,
            candidate: r && r.value ? r.value : null,
            source: r ? r.source : 'tbd',
            sourceAmfe: r ? (r.sourceAmfeNumber || '') : '',
            sourceOp: r ? (r.sourceOpNumber || '') : '',
            confidence: r ? r.confidence : 'low',
            action: r && r.value ? 'PROPOSE_APPLY' : 'TBD_NO_MATCH',
            reason: r ? (r.reason || '') : '',
          };
          changeRows.push(row);
          if (r && r.value) {
            we.name = r.value;
            stats.weFixed++;
            stats.byConfidence[row.confidence] = (stats.byConfidence[row.confidence] || 0) + 1;
            localChanges.push(row);
          } else {
            stats.tbd++;
            localChanges.push(row);
          }
        }
      }

      // ── fn.description healing ──
      if (fieldArg !== 'we') {
        for (const fn of we.functions || []) {
          const fnDescBefore = fn.description || fn.functionDescription || '';
          if (isFnDescCandidateToHeal(fnDescBefore)) {
            const r = findCanonicalFnDescription({
              opName,
              opType,
              weType,
              weName: we.name, // ya posiblemente actualizado por el paso anterior
              allAmfes,
              currentAmfeId: target.id,
            });
            const row = {
              amfe: target.amfe_number,
              opNum,
              opType,
              weType,
              field: 'fn.description',
              current: fnDescBefore,
              candidate: r && r.value ? r.value : null,
              source: r ? r.source : 'tbd',
              sourceAmfe: r ? (r.sourceAmfeNumber || '') : '',
              sourceOp: r ? (r.sourceOpNumber || '') : '',
              confidence: r ? r.confidence : 'low',
              action: r && r.value ? 'PROPOSE_APPLY' : 'TBD_NO_MATCH',
              reason: r ? (r.reason || '') : '',
            };
            changeRows.push(row);
            if (r && r.value) {
              fn.description = r.value;
              // syncFieldAliases dentro de saveAmfe completa functionDescription al guardar.
              stats.fnFixed++;
              stats.byConfidence[row.confidence] = (stats.byConfidence[row.confidence] || 0) + 1;
              localChanges.push(row);
            } else {
              stats.tbd++;
              localChanges.push(row);
            }
          }
        }
      }
    }
  }

  if (localChanges.length === 0) {
    console.log(`\n[${target.amfe_number}] sin candidatos.`);
    continue;
  }

  stats.byAmfe[target.amfe_number] = localChanges.length;
  console.log(`\n[${target.amfe_number}] ${localChanges.length} cambios propuestos:`);
  for (const c of localChanges) {
    const arrow = c.candidate ? `→ "${shortStr(c.candidate, 60)}"` : '→ (TBD: sin match)';
    console.log(
      `  OP ${c.opNum} ${c.weType} ${c.field} [${c.source}/${c.confidence}] "${shortStr(c.current, 50)}" ${arrow}`,
    );
  }

  plan.push({
    id: target.id,
    amfeNumber: target.amfe_number,
    productName: target.amfe_number,
    before: beforeClone,
    after: target.doc,
  });
}

console.log(`\n=== STATS ===`);
console.log(`  WE.name reparados: ${stats.weFixed}`);
console.log(`  fn.description reparados: ${stats.fnFixed}`);
console.log(`  Casos TBD (sin match): ${stats.tbd}`);
console.log(
  `  Confidence: high=${stats.byConfidence.high || 0} medium=${stats.byConfidence.medium || 0} low=${stats.byConfidence.low || 0}`,
);

// ─── Reporte markdown ─────────────────────────────────────────────────────────

function buildReport() {
  const lines = [];
  lines.push(`# Healing cross-ref baseline — ${todayUTCDate()}`);
  lines.push('');
  lines.push('Generado por `scripts/_healWeNameByCrossRef.mjs` en dry-run.');
  lines.push('');
  lines.push('## Resumen');
  lines.push('');
  lines.push(`- AMFEs evaluados: ${targets.length} (filter=${filterArg || 'ninguno'}, field=${fieldArg})`);
  lines.push(`- WE.name reparados (PROPOSE_APPLY): ${stats.weFixed}`);
  lines.push(`- fn.description reparados (PROPOSE_APPLY): ${stats.fnFixed}`);
  lines.push(`- Casos TBD (requieren Fak): ${stats.tbd}`);
  lines.push(
    `- Confidence breakdown: high=${stats.byConfidence.high || 0} medium=${stats.byConfidence.medium || 0} low=${stats.byConfidence.low || 0}`,
  );
  lines.push('');
  lines.push('## Cambios propuestos por AMFE');
  lines.push('');

  // Agrupar changeRows por AMFE
  const byAmfe = {};
  for (const r of changeRows) {
    (byAmfe[r.amfe] ||= []).push(r);
  }
  const amfes = Object.keys(byAmfe).sort();
  if (amfes.length === 0) {
    lines.push('_Sin candidatos en los AMFEs evaluados._');
    lines.push('');
  }
  for (const amfeNum of amfes) {
    lines.push(`### ${amfeNum}`);
    lines.push('');
    lines.push('| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |');
    lines.push('|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|');
    for (const r of byAmfe[amfeNum]) {
      const from = r.sourceAmfe ? `${r.sourceAmfe}${r.sourceOp ? ' OP' + r.sourceOp : ''}` : '—';
      lines.push(
        `| ${mdEscape(r.opNum)} | ${mdEscape(r.opType)} | ${mdEscape(r.weType)} | ${mdEscape(r.field)} | ${mdEscape(shortStr(r.current, 60))} | ${mdEscape(r.candidate ? shortStr(r.candidate, 60) : '(null)')} | ${mdEscape(r.source)} | ${mdEscape(from)} | ${mdEscape(r.confidence)} | ${mdEscape(r.action)} |`,
      );
    }
    lines.push('');
  }

  // TBD detail
  const tbdRows = changeRows.filter(r => r.action === 'TBD_NO_MATCH');
  lines.push('## Casos TBD que requieren input de Fak');
  lines.push('');
  if (tbdRows.length === 0) {
    lines.push('_Ninguno._');
  } else {
    let i = 1;
    for (const r of tbdRows) {
      const ctx = `${r.amfe} OP ${r.opNum} (${r.opType}) — ${r.weType} ${r.field}`;
      lines.push(`${i}. **${ctx}**`);
      lines.push(`   - Current: \`${shortStr(r.current, 90)}\``);
      if (r.reason) lines.push(`   - Razon engine: ${r.reason}`);
      lines.push('');
      i++;
    }
  }

  lines.push('## Comando para aplicar');
  lines.push('');
  lines.push('```');
  const filterSnippet = filterArg ? ` --filter=${filterArg}` : '';
  const fieldSnippet = fieldArg !== 'both' ? ` --field=${fieldArg}` : '';
  lines.push(`node scripts/_healWeNameByCrossRef.mjs${filterSnippet}${fieldSnippet} --apply`);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

try {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, buildReport(), 'utf8');
  console.log(`\nReporte md: ${reportPath}`);
} catch (e) {
  console.error(`WARN: no se pudo escribir reporte md (${reportPath}): ${e.message}`);
}

// ─── Validation + commit ──────────────────────────────────────────────────────

if (plan.length === 0) {
  console.log('\nNada por aplicar.');
  process.exit(0);
}

const result = await runWithValidation(plan, apply, async () => {
  for (const p of plan) {
    await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
    console.log(`  ✓ Guardado ${p.amfeNumber}`);
  }
});

if (result.blocked) {
  console.error('\nBLOCKED por validator pre-commit. No se aplicaron cambios.');
  process.exit(1);
}

console.log(
  `\n${apply ? 'APLICADOS' : 'SIMULADOS'} ${stats.weFixed + stats.fnFixed} cambios en ${plan.length} AMFE(s). TBD pendientes: ${stats.tbd}.`,
);
if (!apply) console.log('Si esta bien, correr de nuevo con --apply.');
process.exit(0);
