#!/usr/bin/env node
/**
 * fix-amfe-english-standalone.mjs
 *
 * Translate ~847 standalone English terms in ALL AMFEs.
 * These are bare English words in Spanish text (NOT in parentheses —
 * those were already handled by fix-english-parentheses.mjs).
 *
 * Usage: node scripts/fix-amfe-english-standalone.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Replacement rules ──────────────────────────────────────────────────────
// Order matters: multi-word patterns BEFORE single-word to avoid partial matches.
// e.g. "Checking Fixture" must be matched before "Checking" alone (if it existed).
// e.g. "Edge Folding" before "Edge" alone.

const REPLACEMENTS = [
  // Multi-word patterns first (longer matches win)
  [/\bFirst Piece Approval\b/gi, 'Aprobación primera pieza'],
  [/\bChecking Fixture\b/gi, 'Dispositivo de control'],
  [/\bEdge Folding\b/gi, 'Plegado de bordes'],
  [/\bEDGE FOLDING\b/g, 'PLEGADO DE BORDE'],
  [/\bSponge layer\b/gi, 'Capa de espuma'],
  [/\bWrong Label\b/gi, 'Etiqueta incorrecta'],
  [/\bLoose [Aa]ssembly\b/gi, 'Ensamble flojo'],
  [/\bCold Weld\b/gi, 'Soldadura fría'],
  [/\bAngel [Hh]air\b/gi, 'Hilachas'],
  [/\bHot Knife\b/gi, 'Cuchilla caliente'],
  [/\bBoundary Samples?\b/gi, 'Muestras límite'],
  [/\bMixed Parts?\b/gi, 'Piezas mezcladas'],
  [/\bRead-?through\b/gi, 'Transparencia'],

  // High frequency single terms
  [/\bSet[\s-]?up\b/gi, 'Puesta a punto'],
  [/\bScrap\b/gi, 'Descarte'],
  [/\bChecklist\b/gi, 'Lista de verificación'],
  [/\bCoC\b/g, 'Certificado de conformidad'],       // case-sensitive

  // Lower frequency single terms
  [/\bInterlock\b/gi, 'Enclavamiento'],
  [/\bdunnage\b/gi, 'Embalaje de transporte'],
  [/\bRelief\b/g, 'Rebaje'],                         // case-sensitive
  [/\bScuffing\b/gi, 'Rozadura'],
  [/\bShortage\b/gi, 'Faltante'],

  // Acronyms — case-sensitive, strict word boundary
  [/\bSOS\b/g, 'Hoja de operación estándar'],
  [/\bFAI\b/g, 'Aprobación primera pieza'],
];

// Track per-term counts
const termCounts = new Map();
for (const [pattern] of REPLACEMENTS) {
  termCounts.set(pattern.source, 0);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
  return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

/**
 * Apply all replacements to a single string value.
 * Returns { text, count } where count = number of individual replacements made.
 */
function applyReplacements(text) {
  if (typeof text !== 'string') return { text, count: 0 };

  let result = text;
  let count = 0;

  for (const [pattern, replacement] of REPLACEMENTS) {
    // We need a fresh regex each time because of the /g flag + lastIndex state
    const re = new RegExp(pattern.source, pattern.flags);
    const before = result;
    result = result.replace(re, replacement);
    if (result !== before) {
      // Count how many replacements this pattern made in this string
      const re2 = new RegExp(pattern.source, pattern.flags);
      let matchCount = 0;
      let m;
      while ((m = re2.exec(before)) !== null) {
        matchCount++;
        if (!re2.global) break;
      }
      count += matchCount;
      termCounts.set(pattern.source, (termCounts.get(pattern.source) || 0) + matchCount);
    }
  }

  return { text: result, count };
}

/**
 * Deep-traverse an object/array, applying replacements to all string values.
 * Returns { data, totalCount }.
 */
function deepTraverse(obj) {
  if (typeof obj === 'string') {
    const { text, count } = applyReplacements(obj);
    return { data: text, totalCount: count };
  }

  if (Array.isArray(obj)) {
    let totalCount = 0;
    const newArr = [];
    for (let i = 0; i < obj.length; i++) {
      const { data, totalCount: childCount } = deepTraverse(obj[i]);
      newArr.push(data);
      totalCount += childCount;
    }
    return { data: newArr, totalCount };
  }

  if (obj !== null && typeof obj === 'object') {
    let totalCount = 0;
    const newObj = {};
    for (const key of Object.keys(obj)) {
      const { data, totalCount: childCount } = deepTraverse(obj[key]);
      newObj[key] = data;
      totalCount += childCount;
    }
    return { data: newObj, totalCount };
  }

  // Non-string primitive (number, boolean, null)
  return { data: obj, totalCount: 0 };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await initSupabase();

  let grandTotal = 0;

  console.log('\n========================================');
  console.log('  AMFE — STANDALONE ENGLISH REPLACEMENTS');
  console.log('========================================\n');

  const amfeDocs = await selectSql('SELECT id, project_name, data FROM amfe_documents');
  console.log(`  Loaded ${amfeDocs.length} AMFE documents\n`);

  const perDoc = [];

  for (const doc of amfeDocs) {
    const data = parseData(doc);
    const { data: newData, totalCount } = deepTraverse(data);

    if (totalCount === 0) {
      perDoc.push({ name: doc.project_name, id: doc.id, count: 0 });
      continue;
    }

    grandTotal += totalCount;
    perDoc.push({ name: doc.project_name, id: doc.id, count: totalCount });

    // Save back
    const checksum = createHash('sha256').update(JSON.stringify(newData)).digest('hex');
    const jsonStr = JSON.stringify(newData).replace(/'/g, "''");
    await execSql(
      `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
    );
    console.log(`  [AMFE] ${doc.project_name} — ${totalCount} replacements (saved, checksum: ${checksum.slice(0, 16)}...)`);
  }

  // ─── Report ─────────────────────────────────────────────────────────────

  console.log('\n========================================');
  console.log('  PER-TERM REPORT');
  console.log('========================================');

  // Sort descending by count
  const termEntries = [...termCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // Map pattern source back to a readable label
  for (const [patternSrc, count] of termEntries) {
    // Find the replacement text for this pattern
    const rule = REPLACEMENTS.find(([p]) => p.source === patternSrc);
    const label = rule ? rule[1] : patternSrc;
    console.log(`  ${String(count).padStart(5)}  ${patternSrc}  →  ${label}`);
  }

  if (termEntries.length === 0) {
    console.log('  (no replacements made)');
  }

  console.log('\n========================================');
  console.log('  PER-DOCUMENT REPORT');
  console.log('========================================');

  for (const { name, id, count } of perDoc) {
    if (count > 0) {
      console.log(`  ${String(count).padStart(5)}  ${name} (${id})`);
    }
  }

  const docsModified = perDoc.filter(d => d.count > 0).length;
  const docsUnchanged = perDoc.filter(d => d.count === 0).length;

  console.log('\n========================================');
  console.log('  GRAND TOTAL');
  console.log('========================================');
  console.log(`  Replacements:      ${grandTotal}`);
  console.log(`  Documents modified: ${docsModified}`);
  console.log(`  Documents unchanged: ${docsUnchanged}`);

  close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  close();
  process.exit(1);
});
