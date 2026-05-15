/**
 * Auditor read-only de WE.name placeholders + failures mal alocados en AMFEs.
 *
 * Detecta:
 *   1. WE_PROCESS_OP_PLACEHOLDER: WE.name match /^proceso\s+op\s+\d*$/i
 *   2. WE_GENERIC_LABEL: WE.name matchea GENERIC_LABELS (machine/maquina/man/material/method/measurement/environment + variantes)
 *   3. WE_NAME_EQUALS_TYPE: normalize(WE.name) === normalize(translate(WE.type))
 *   4. WE_NAME_FOREIGN_OPNUMBER: WE.name contiene "Op N" con N != op.opNumber (residuo renumeracion)
 *   5. FN_GENERIC_LABEL: function.description matchea GENERIC_LABELS
 *   6. FAILURE_MISALLOCATED: failure.description tiene keyword que NO pertenece al nombre de la OP
 *
 * Source: reglas amfe-leer-contenido-antes-de-renumerar.md + amfe-funciones-3-niveles.md
 *
 * Uso:
 *   node scripts/_auditWePlaceholdersAndAllocation.mjs                  # todos los AMFEs
 *   node scripts/_auditWePlaceholdersAndAllocation.mjs --filter=HF-PAT  # solo uno
 *   node scripts/_auditWePlaceholdersAndAllocation.mjs --json           # solo JSON, sin tabla
 *
 * Output: tmp/we_placeholders_audit.json + docs/auto-mejora/we-placeholders-findings.md + console
 * Exit: 1 si CRITICAL > 0, 0 si solo warnings, 2 si error de ejecucion.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  GENERIC_LABELS,
  TYPE_TRANSLATION as _TYPE_TRANSLATION,
  KEYWORD_OP_TAGS,
  normalize,
  isGeneric6MLabel as isGenericLabel,
  extractForeignOpNumber,
} from './_lib/genericLabels.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE_TRANSLATION en este auditor usaba claves lowercase (machine/maquina);
// el JSON shared las usa con PascalCase WE.type (Machine/Material/etc.).
// Construir vista compatible que indexe por lowercase para no romper la logica
// existente de nameEqualsType.
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_TRANSLATION = Object.fromEntries(
  Object.entries(_TYPE_TRANSLATION).map(([k, v]) => [normalize(k), v.map(normalize)])
);

function nameEqualsType(weName, weType) {
  if (!weName || !weType) return false;
  const nName = normalize(weName);
  const variants = TYPE_TRANSLATION[normalize(weType)] || [normalize(weType)];
  return variants.includes(nName);
}

function isProcessOpPlaceholder(weName) {
  return /^proceso\s+op\s*\d*\s*$/i.test((weName || '').trim());
}

function getOpTags(opName) {
  const n = normalize(opName);
  const tags = [];
  if (n.includes('costura')) tags.push('costura');
  if (n.includes('corte')) tags.push('corte');
  if (n.includes('inyeccion') || n.includes('pu')) tags.push('inyeccion', 'pu', 'espumado');
  if (n.includes('embalaje')) tags.push('embalaje');
  if (n.includes('recepcion')) tags.push('recepcion');
  if (n.includes('varilla') || n.includes('insercion')) tags.push('varilla', 'insercion');
  if (n.includes('enfundado') || n.includes('tapizado')) tags.push('enfundado', 'tapizado');
  if (n.includes('mylar') || n.includes('control con plantilla')) tags.push('mylar', 'control mylar', 'control forma');
  if (n.includes('troquelado')) tags.push('troquelado');
  if (n.includes('reproceso') || n.includes('retrabajo')) tags.push('reproceso');
  if (n.includes('control final')) tags.push('control final');
  if (n.includes('precinto') || n.includes('bolsa') || n.includes('cierre del molde')) tags.push('inyeccion', 'pu', 'pre-inyeccion');
  return tags;
}

function detectMisallocatedKeyword(failureDesc, opTags) {
  // Si el failure matchea 2+ reglas con tags incompatibles, es AMBIGUO -> no marcar como misallocated
  const n = normalize(failureDesc);
  const matchedRules = [];
  for (const rule of KEYWORD_OP_TAGS) {
    for (const kw of rule.keywords) {
      if (n.includes(normalize(kw))) {
        matchedRules.push({ keyword: kw, validOpTags: rule.validOpTags });
        break;
      }
    }
  }
  if (matchedRules.length === 0) return [];

  // Si alguna regla matcheada ES coherente con la OP actual -> failure esta OK
  const anyCoherent = matchedRules.some(r => r.validOpTags.some(t => opTags.includes(t)));
  if (anyCoherent) return [];

  // Si hay 2+ reglas incompatibles entre si (ambiguo), NO marcar
  if (matchedRules.length >= 2) {
    const tagSet = new Set(matchedRules.flatMap(r => r.validOpTags));
    // Si todas las reglas comparten al menos 1 tag, NO es ambiguo (todas concuerdan)
    const allShare = matchedRules.every(r => matchedRules[0].validOpTags.some(t => r.validOpTags.includes(t)));
    if (!allShare) return [];  // ambiguo -> no marcar
  }

  // Marcar (solo si 1 regla y no coherente, o varias pero todas con mismos tags)
  return [{ keyword: matchedRules[0].keyword, expectedOpTags: matchedRules[0].validOpTags }];
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const filter = (argv.find(a => a.startsWith('--filter='))?.split('=')[1]) || null;
const jsonOnly = argv.includes('--json');

// ─────────────────────────────────────────────────────────────────────────────
// Connect Supabase
// ─────────────────────────────────────────────────────────────────────────────

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─────────────────────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────────────────────

let query = sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (filter) query = query.ilike('amfe_number', `%${filter}%`);
const { data: rows, error } = await query;
if (error) { console.error('Error leyendo amfe_documents:', error); process.exit(2); }

const reports = [];

for (const row of rows || []) {
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!d || !Array.isArray(d.operations)) continue;

  const findings = [];

  for (const op of d.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const opName = op.name || op.operationName || '';
    const opTags = getOpTags(opName);

    // Check 5: fn-level genericos
    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      const weName = we.name || we.description || '';
      const weType = we.type || '';

      // Check 1: Proceso Op X
      if (isProcessOpPlaceholder(weName)) {
        findings.push({
          type: 'WE_PROCESS_OP_PLACEHOLDER',
          severity: 'CRITICAL',
          opNumber, opName, weIdx: wi,
          weName, weType,
          message: 'WE.name = "Proceso Op X" (placeholder pobre, sin recurso real)',
        });
      } else if (isGenericLabel(weName)) {
        // Check 2: GENERIC_LABELS puros
        findings.push({
          type: 'WE_GENERIC_LABEL',
          severity: 'CRITICAL',
          opNumber, opName, weIdx: wi,
          weName, weType,
          message: `WE.name = "${weName}" es etiqueta 6M generica sin recurso especifico`,
        });
      } else if (nameEqualsType(weName, weType)) {
        // Check 3: name == type traducido
        findings.push({
          type: 'WE_NAME_EQUALS_TYPE',
          severity: 'CRITICAL',
          opNumber, opName, weIdx: wi,
          weName, weType,
          message: `WE.name "${weName}" === type traducido "${weType}" (copia-pega de la categoria)`,
        });
      }

      // Check 4: foreign opNumber en WE.name
      const foreign = extractForeignOpNumber(weName, opNumber);
      if (foreign !== null && !isProcessOpPlaceholder(weName)) {
        findings.push({
          type: 'WE_NAME_FOREIGN_OPNUMBER',
          severity: 'CRITICAL',
          opNumber, opName, weIdx: wi,
          weName, weType,
          message: `WE.name contiene "Op ${foreign}" pero esta en OP ${opNumber} (residuo de renumeracion)`,
        });
      } else if (isProcessOpPlaceholder(weName)) {
        // Si el name es "Proceso Op N" puro, ver si N != opNumber
        const m = /^proceso\s+op\s*(\d+)/i.exec(weName.trim());
        if (m && parseInt(m[1]) !== opNumber) {
          findings.push({
            type: 'WE_NAME_FOREIGN_OPNUMBER',
            severity: 'CRITICAL',
            opNumber, opName, weIdx: wi,
            weName, weType,
            message: `WE.name = "Proceso Op ${m[1]}" pero esta en OP ${opNumber}`,
          });
        }
      }

      // Iterar functions y failures
      for (let fi = 0; fi < (we.functions || []).length; fi++) {
        const fn = we.functions[fi];
        const fnDesc = fn.description || fn.functionDescription || '';

        // Check 5: function generica
        if (isGenericLabel(fnDesc)) {
          findings.push({
            type: 'FN_GENERIC_LABEL',
            severity: 'WARNING',
            opNumber, opName, weIdx: wi, fnIdx: fi,
            fnDescription: fnDesc,
            message: `function.description "${fnDesc}" es etiqueta 6M generica`,
          });
        }

        // Check 6: failures mal alocadas
        for (let mi = 0; mi < (fn.failures || []).length; mi++) {
          const fm = fn.failures[mi];
          const fmDesc = fm.description || fm.failureMode || '';
          if (!fmDesc) continue;

          const misallocations = detectMisallocatedKeyword(fmDesc, opTags);
          for (const mis of misallocations) {
            findings.push({
              type: 'FAILURE_MISALLOCATED',
              severity: 'CRITICAL',
              opNumber, opName, weIdx: wi, fnIdx: fi, fmIdx: mi,
              failureDesc: fmDesc.substring(0, 100),
              keywordHit: mis.keyword,
              expectedOpTags: mis.expectedOpTags,
              message: `failure "${fmDesc.substring(0, 60)}..." contiene "${mis.keyword}" (debe ir a OP tipo ${mis.expectedOpTags.join('/')}); OP actual = ${opName} (tags: ${opTags.join(',') || '(ninguno)'})`,
            });
          }
        }
      }
    }
  }

  reports.push({
    amfeId: row.id,
    amfeNumber: row.amfe_number,
    projectName: row.project_name,
    findings,
    counts: {
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      warning: findings.filter(f => f.severity === 'WARNING').length,
      byType: findings.reduce((acc, f) => { acc[f.type] = (acc[f.type] || 0) + 1; return acc; }, {}),
    },
  });
}

const summary = {
  timestamp: new Date().toISOString(),
  amfesAuditados: reports.length,
  amfesConFindings: reports.filter(r => r.findings.length > 0).length,
  totalCritical: reports.reduce((a, r) => a + r.counts.critical, 0),
  totalWarning: reports.reduce((a, r) => a + r.counts.warning, 0),
  byType: reports.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r.counts.byType)) acc[k] = (acc[k] || 0) + v;
    return acc;
  }, {}),
};

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

const tmpDir = new URL('../tmp', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
const jsonPath = join(tmpDir, 'we_placeholders_audit.json');
writeFileSync(jsonPath, JSON.stringify({ summary, reports }, null, 2));

const mdDir = new URL('../docs/auto-mejora', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (!existsSync(mdDir)) mkdirSync(mdDir, { recursive: true });
const mdPath = join(mdDir, 'we-placeholders-findings.md');
let md = `# WE Placeholders + Failure Allocation — ${summary.timestamp}\n\n`;
md += `**Resumen global**: ${summary.totalCritical} CRITICAL, ${summary.totalWarning} WARNING en ${summary.amfesConFindings}/${summary.amfesAuditados} AMFEs.\n\n`;
md += `**Por tipo**: ${Object.entries(summary.byType).map(([k, v]) => `${k}=${v}`).join(', ') || '(ninguno)'}\n\n`;
md += `## Detalle por AMFE\n\n`;
for (const r of reports.filter(r => r.findings.length > 0).sort((a, b) => b.counts.critical - a.counts.critical)) {
  md += `### ${r.amfeNumber} (${r.projectName})\n`;
  md += `${r.counts.critical} CRITICAL + ${r.counts.warning} WARNING\n\n`;
  md += `| Type | OP | Detalle |\n|---|---|---|\n`;
  for (const f of r.findings) {
    md += `| ${f.severity} ${f.type} | ${f.opNumber} ${f.opName?.substring(0, 30) || ''} | ${f.message.substring(0, 140).replace(/\|/g, '\\|')} |\n`;
  }
  md += `\n`;
}
writeFileSync(mdPath, md);

if (!jsonOnly) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   AUDITOR — WE Placeholders + Failure Allocation          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`AMFEs auditados:       ${summary.amfesAuditados}`);
  console.log(`AMFEs con findings:    ${summary.amfesConFindings}`);
  console.log(`Total CRITICAL:        ${summary.totalCritical}`);
  console.log(`Total WARNING:         ${summary.totalWarning}`);
  console.log(`\nPor tipo:`);
  for (const [k, v] of Object.entries(summary.byType)) console.log(`  ${k.padEnd(32)} ${v}`);
  console.log(`\nTop AMFEs con findings:`);
  for (const r of reports.filter(r => r.findings.length > 0).sort((a, b) => b.counts.critical - a.counts.critical).slice(0, 10)) {
    console.log(`  ${r.amfeNumber.padEnd(22)} CRIT=${String(r.counts.critical).padStart(3)} WARN=${String(r.counts.warning).padStart(3)}`);
  }
  console.log(`\nOutput: ${jsonPath}`);
  console.log(`        ${mdPath}`);
}

process.exit(summary.totalCritical > 0 ? 1 : 0);
