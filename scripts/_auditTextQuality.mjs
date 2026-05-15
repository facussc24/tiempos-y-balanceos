/**
 * Auditor L2 — 5 checks WARNING calidad textual 6M. Plan: warm-plotting-snowflake.md
 *
 * Detecta (todos severity=WARNING, ninguno bloquea):
 *   1. FN_TOO_SHORT: function.description con length < MIN_FN_DESCRIPTION_LENGTH
 *   2. FN_NO_VERB: function.description que no comienza con verbo (VERB_WHITELIST o gerundio/infinitivo)
 *   3. FN_ALL_CAPS_SHORT: function.description todo MAYUSCULAS y <= 4 palabras (probable etiqueta)
 *   4. OP_FUNCTION_SEMANTIC_MISMATCH: op.name vs op.operationFunction segun OP_NAME_SEMANTIC_DICT
 *   5. WE_NAME_FOREIGN_TYPE: WE.name no corresponde a WE.type segun MATERIAL_NAME_FOREIGN_TYPE_PATTERNS
 *
 * Source: reglas amfe-funciones-3-niveles.md + scripts/_lib/genericLabels.mjs
 *
 * Uso CLI:
 *   node scripts/_auditTextQuality.mjs                  # todos los AMFEs
 *   node scripts/_auditTextQuality.mjs --filter=HF-PAT  # solo uno
 *   node scripts/_auditTextQuality.mjs --json           # solo JSON, sin tabla
 *
 * Output: tmp/text_quality_audit.json + docs/auto-mejora/text-quality-findings.md + console
 * Exit:
 *   0 — OK o solo WARNING
 *   1 — CRITICAL > 0 (no deberia ocurrir, todos los checks son WARNING; defensivo)
 *   2 — error fatal de ejecucion (auth, network, parsing)
 *
 * Tambien exporta `auditAmfeTextQuality(doc, amfeNumber): Issue[]` para tests en memoria.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  MIN_FN_DESCRIPTION_LENGTH,
  isTextDescriptive,
  startsWithVerb,
  isAllCapsShort,
  detectOpFunctionSemanticMismatch,
  classifyWeNameVsType,
} from './_lib/genericLabels.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Funcion pura testeable: aplica los 5 checks sobre un doc en memoria.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audita la calidad textual 6M de un AMFE doc (en memoria).
 * @param {object} doc - amfe document parseado (con .operations[])
 * @param {string} amfeNumber - identificador del AMFE para anotar en issues
 * @returns {Array<object>} issues detectados
 */
export function auditAmfeTextQuality(doc, amfeNumber) {
  const issues = [];
  if (!doc || !Array.isArray(doc.operations)) return issues;

  for (const op of doc.operations) {
    const opNumber = op.opNumber || op.operationNumber;
    const opName = op.name || op.operationName || '';
    const opFn = op.operationFunction || '';

    // Check 4 — OP_FUNCTION_SEMANTIC_MISMATCH (a nivel OP, antes de iterar WEs)
    const semCheck = detectOpFunctionSemanticMismatch(opName, opFn);
    if (semCheck.ok === false) {
      issues.push({
        type: 'OP_FUNCTION_SEMANTIC_MISMATCH',
        severity: 'WARNING',
        amfe: amfeNumber,
        opNumber,
        opName,
        message: semCheck.mismatch || `OP "${opName}" mismatch con operationFunction`,
      });
    }

    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      const weName = we.name || we.description || '';
      const weType = we.type || '';

      // Check 5 — WE_NAME_FOREIGN_TYPE
      const weCheck = classifyWeNameVsType(weName, weType);
      if (weCheck.ok === false) {
        issues.push({
          type: 'WE_NAME_FOREIGN_TYPE',
          severity: 'WARNING',
          amfe: amfeNumber,
          opNumber,
          opName,
          weIdx: wi,
          weName,
          weType,
          message: weCheck.issue || `WE.name "${weName}" no corresponde a type "${weType}"`,
        });
      }

      for (let fi = 0; fi < (we.functions || []).length; fi++) {
        const fn = we.functions[fi];
        const fnDesc = fn.description || fn.functionDescription || '';
        if (!fnDesc || !fnDesc.trim()) continue; // sin contenido, otros auditores lo flagean

        // Check 1 — FN_TOO_SHORT
        const desc = isTextDescriptive(fnDesc, MIN_FN_DESCRIPTION_LENGTH);
        if (desc.ok === false && /Longitud/.test(desc.reason || '')) {
          issues.push({
            type: 'FN_TOO_SHORT',
            severity: 'WARNING',
            amfe: amfeNumber,
            opNumber,
            opName,
            weIdx: wi,
            weName,
            weType,
            fnIdx: fi,
            fnDescription: fnDesc,
            message: `function.description "${fnDesc.slice(0, 60)}" muy corta (< ${MIN_FN_DESCRIPTION_LENGTH} chars)`,
          });
        }

        // Check 2 — FN_NO_VERB
        if (!startsWithVerb(fnDesc)) {
          issues.push({
            type: 'FN_NO_VERB',
            severity: 'WARNING',
            amfe: amfeNumber,
            opNumber,
            opName,
            weIdx: wi,
            weName,
            weType,
            fnIdx: fi,
            fnDescription: fnDesc,
            message: `function.description "${fnDesc.slice(0, 60)}" no comienza con verbo`,
          });
        }

        // Check 3 — FN_ALL_CAPS_SHORT
        if (isAllCapsShort(fnDesc, 4)) {
          issues.push({
            type: 'FN_ALL_CAPS_SHORT',
            severity: 'WARNING',
            amfe: amfeNumber,
            opNumber,
            opName,
            weIdx: wi,
            weName,
            weType,
            fnIdx: fi,
            fnDescription: fnDesc,
            message: `function.description "${fnDesc}" en mayusculas y <=4 palabras (etiqueta?)`,
          });
        }
      }
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — solo se ejecuta cuando el script corre directo (no en import desde test)
// ─────────────────────────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    const argvHref = new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
    return import.meta.url === argvHref;
  } catch {
    return false;
  }
})();

if (isMain) {
  await runCli();
}

async function runCli() {
  const argv = process.argv.slice(2);
  const filter = (argv.find(a => a.startsWith('--filter='))?.split('=')[1]) || null;
  const jsonOnly = argv.includes('--json');

  let sb;
  try {
    const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    const envText = readFileSync(envPath, 'utf8');
    const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
    sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
  } catch (e) {
    console.error('Error conectando a Supabase:', e.message || e);
    process.exit(2);
  }

  let query = sb.from('amfe_documents').select('id, amfe_number, project_name, data');
  if (filter) query = query.ilike('amfe_number', `%${filter}%`);

  const { data: rows, error } = await query;
  if (error) {
    console.error('Error leyendo amfe_documents:', error);
    process.exit(2);
  }

  const reports = [];
  for (const row of rows || []) {
    const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    if (!d || !Array.isArray(d.operations)) continue;

    const findings = auditAmfeTextQuality(d, row.amfe_number);
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
    totalAmfes: reports.length,
    amfesConFindings: reports.filter(r => r.findings.length > 0).length,
    totalIssues: reports.reduce((a, r) => a + r.findings.length, 0),
    totalCritical: reports.reduce((a, r) => a + r.counts.critical, 0),
    totalWarning: reports.reduce((a, r) => a + r.counts.warning, 0),
    byType: reports.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.counts.byType)) acc[k] = (acc[k] || 0) + v;
      return acc;
    }, {}),
  };

  // Output JSON
  const tmpDir = new URL('../tmp', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const jsonPath = join(tmpDir, 'text_quality_audit.json');
  writeFileSync(jsonPath, JSON.stringify({ summary, reports }, null, 2));

  // Output Markdown
  const mdDir = new URL('../docs/auto-mejora', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  if (!existsSync(mdDir)) mkdirSync(mdDir, { recursive: true });
  const mdPath = join(mdDir, 'text-quality-findings.md');
  let md = `# Text Quality Audit (L2) — ${summary.timestamp}\n\n`;
  md += `**Resumen global**: ${summary.totalCritical} CRITICAL, ${summary.totalWarning} WARNING en ${summary.amfesConFindings}/${summary.totalAmfes} AMFEs.\n\n`;
  md += `**Por tipo**: ${Object.entries(summary.byType).map(([k, v]) => `${k}=${v}`).join(', ') || '(ninguno)'}\n\n`;
  md += `## Top 5 AMFEs con mas issues\n\n`;
  const top5 = [...reports].filter(r => r.findings.length > 0)
    .sort((a, b) => b.findings.length - a.findings.length).slice(0, 5);
  if (top5.length === 0) md += '_(ninguno)_\n\n';
  for (const r of top5) {
    md += `- **${r.amfeNumber}** (${r.projectName}): ${r.findings.length} issues\n`;
  }
  md += `\n## Detalle por AMFE\n\n`;
  for (const r of reports.filter(r => r.findings.length > 0)
    .sort((a, b) => b.findings.length - a.findings.length)) {
    md += `### ${r.amfeNumber} (${r.projectName})\n`;
    md += `${r.counts.critical} CRITICAL + ${r.counts.warning} WARNING\n\n`;
    md += `| Type | OP | Detalle |\n|---|---|---|\n`;
    for (const f of r.findings) {
      const opLabel = `${f.opNumber || ''} ${(f.opName || '').substring(0, 30)}`.trim();
      md += `| ${f.severity} ${f.type} | ${opLabel} | ${(f.message || '').substring(0, 140).replace(/\|/g, '\\|')} |\n`;
    }
    md += `\n`;
  }
  writeFileSync(mdPath, md);

  if (!jsonOnly) {
    console.info('\n╔════════════════════════════════════════════════════════════╗');
    console.info('║   AUDITOR L2 — Calidad Textual 6M (FN/OP/WE)              ║');
    console.info('╚════════════════════════════════════════════════════════════╝\n');
    console.info(`AMFEs auditados:       ${summary.totalAmfes}`);
    console.info(`AMFEs con findings:    ${summary.amfesConFindings}`);
    console.info(`Total CRITICAL:        ${summary.totalCritical}`);
    console.info(`Total WARNING:         ${summary.totalWarning}`);
    console.info(`\nPor tipo:`);
    for (const [k, v] of Object.entries(summary.byType)) {
      console.info(`  ${k.padEnd(34)} ${v}`);
    }
    console.info(`\nTop AMFEs con findings:`);
    for (const r of reports.filter(r => r.findings.length > 0)
      .sort((a, b) => b.findings.length - a.findings.length).slice(0, 10)) {
      console.info(`  ${r.amfeNumber.padEnd(22)} CRIT=${String(r.counts.critical).padStart(3)} WARN=${String(r.counts.warning).padStart(3)}`);
    }
    console.info(`\nOutput: ${jsonPath}`);
    console.info(`        ${mdPath}`);
  }

  process.exit(summary.totalCritical > 0 ? 1 : 0);
}
