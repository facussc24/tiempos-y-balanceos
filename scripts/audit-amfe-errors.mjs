#!/usr/bin/env node
/**
 * AMFE Audit Script — Language, Role, Vocabulary, and Naming Convention Errors
 *
 * Traverses ALL AMFE documents in Supabase and checks:
 * a) English text in parentheses (exhaustive search in all text fields)
 * b) Role errors (invalid department names, invented roles)
 * c) Academic/non-plant vocabulary
 * d) Operation naming convention (uppercase, CATEGORÍA - DETALLE pattern)
 */
import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

// ─── Configuration ──────────────────────────────────────────────────────────

// Pattern: parenthesized text starting with uppercase, containing English-like words
const ENGLISH_PARENS_RE = /\([A-Z][a-zA-Z\s\-\/]+\)/g;

// Known valid roles (from real team)
const VALID_ROLES = [
  'Carlos Baptista (Ingeniería)',
  'Manuel Meszaros (Calidad)',
  'Marianna Vera (Producción)',
  'Ingeniería',
  'Calidad',
  'Producción',
  'Mantenimiento',
  'Logística',
];

// Role patterns to flag
const ROLE_ERRORS = [
  { pattern: /Ingeniería\s+de\s+Calidad/gi, issue: '"Ingeniería de Calidad" no existe — debería ser "Calidad"' },
  { pattern: /Ingeniería\s+de\s+Producto/gi, issue: '"Ingeniería de Producto" — verificar si existe este rol' },
  { pattern: /Ingeniería\s+de\s+Proceso/gi, issue: '"Ingeniería de Proceso" — verificar si existe este rol' },
  { pattern: /Ing\.\s*de\s+Calidad/gi, issue: '"Ing. de Calidad" no existe — debería ser "Calidad"' },
  { pattern: /Ing\.\s*de\s+Producto/gi, issue: '"Ing. de Producto" — verificar si existe este rol' },
  { pattern: /Ing\.\s*de\s+Proceso/gi, issue: '"Ing. de Proceso" — verificar si existe este rol' },
  { pattern: /Ingeniería\s+de\s+Manufactura/gi, issue: '"Ingeniería de Manufactura" — verificar si existe este rol' },
  { pattern: /Ing\.\s*de\s+Manufactura/gi, issue: '"Ing. de Manufactura" — verificar si existe este rol' },
  { pattern: /Ingeniero\s+de\s+Calidad/gi, issue: '"Ingeniero de Calidad" — debería ser "Calidad"' },
  { pattern: /Ingeniero\s+de\s+Proceso/gi, issue: '"Ingeniero de Proceso" — verificar' },
  { pattern: /Ingeniero\s+de\s+Producto/gi, issue: '"Ingeniero de Producto" — verificar' },
  { pattern: /Técnico\s+de\s+Calidad/gi, issue: '"Técnico de Calidad" — verificar si existe este rol' },
  { pattern: /Supervisor\s+de\s+Calidad/gi, issue: '"Supervisor de Calidad" — verificar si existe este rol' },
  { pattern: /Jefe\s+de\s+Calidad/gi, issue: '"Jefe de Calidad" — verificar si existe este rol' },
  { pattern: /Departamento\s+de\s+/gi, issue: 'Uso de "Departamento de..." — usar nombre directo del área' },
];

// Academic vocabulary → plant vocabulary mapping
const ACADEMIC_TERMS = [
  { pattern: /degradación\s+superficial/gi, suggestion: 'Ralladura / Marca / Rayón' },
  { pattern: /adhesión\s+insuficiente/gi, suggestion: 'Se despega / No pega' },
  { pattern: /deformación\s+plástica/gi, suggestion: 'Se dobla / Se deforma' },
  { pattern: /discontinuidad\s+dimensional/gi, suggestion: 'Fuera de medida / No entra' },
  { pattern: /contaminación\s+particulada/gi, suggestion: 'Suciedad / Basura / Pelusa' },
  { pattern: /desviación\s+geométrica/gi, suggestion: 'Fuera de medida / Torcido' },
  { pattern: /deterioro\s+progresivo/gi, suggestion: 'Se gasta / Se rompe' },
  { pattern: /anomalía\s+funcional/gi, suggestion: 'No funciona / Falla' },
  { pattern: /deficiencia\s+estructural/gi, suggestion: 'Se rompe / Debil' },
  { pattern: /incompatibilidad\s+dimensional/gi, suggestion: 'No entra / No encaja' },
  { pattern: /desprendimiento\s+del\s+material/gi, suggestion: 'Se despega / Se sale' },
  { pattern: /variación\s+cromática/gi, suggestion: 'Diferencia de color / Cambio de tono' },
  { pattern: /degradación\s+térmica/gi, suggestion: 'Se quema / Se derrite' },
  { pattern: /abrasión\s+superficial/gi, suggestion: 'Rayón / Ralladura' },
  { pattern: /fractura\s+del\s+material/gi, suggestion: 'Se rompe / Se quiebra' },
  { pattern: /verificación\s+dimensional/gi, suggestion: 'Medir / Control dimensional' },
  { pattern: /monitoreo\s+continuo/gi, suggestion: 'Control permanente / Chequeo continuo' },
  { pattern: /inspección\s+visual\s+exhaustiva/gi, suggestion: 'Control visual / Inspección visual' },
  { pattern: /evaluación\s+periódica/gi, suggestion: 'Control periódico / Chequeo' },
  { pattern: /implementación\s+de\s+controles/gi, suggestion: 'Controlar / Poner control' },
  { pattern: /protocolo\s+de\s+inspección/gi, suggestion: 'Instrucción de control / Pauta de inspección' },
  { pattern: /procedimiento\s+estandarizado/gi, suggestion: 'Instrucción de trabajo / Procedimiento' },
];

// Operation naming convention: should be UPPERCASE, pattern: CATEGORÍA - DETALLE
const OP_NAME_UPPER_RE = /^[A-ZÁÉÍÓÚÑÜ0-9\s\-\/\.\,\(\)]+$/;

// ─── Findings collectors ────────────────────────────────────────────────────

const findings = {
  englishParens: [],
  roleErrors: [],
  academicVocab: [],
  opNaming: [],
};

// ─── Helper: get all text fields from a value at a given path ────────────────

function collectTextFields(obj, path, collector) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string' && obj.trim().length > 0) {
    collector.push({ path, text: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectTextFields(item, `${path}[${i}]`, collector));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      // Skip non-text fields (ids, numeric values)
      if (key === 'id' || key === 'severity' || key === 'occurrence' || key === 'detection' || key === 'rpn') continue;
      collectTextFields(val, `${path}.${key}`, collector);
    }
  }
}

// ─── Field-level traversal (for structured reporting) ────────────────────────

const TEXT_FIELDS_OPERATION = ['name', 'description'];
const TEXT_FIELDS_WORK_ELEMENT = ['name', 'type', 'description'];
const TEXT_FIELDS_FUNCTION = ['description'];
const TEXT_FIELDS_FAILURE = ['description', 'effectLocal', 'effectNextLevel', 'effectEndUser'];
const TEXT_FIELDS_CAUSE = [
  'cause', 'preventionControl', 'detectionControl', 'preventionAction',
  'detectionAction', 'actionTaken', 'observations', 'responsible',
  'specialChar',
];
const TEXT_FIELDS_HEADER = [
  'organization', 'client', 'team', 'responsible', 'processResponsible',
  'partName', 'partNumber', 'model', 'modelYear',
];

function checkText(text, fieldPath, amfeProject, opName, findings) {
  if (!text || typeof text !== 'string') return;

  // a) English in parentheses
  const englishMatches = text.matchAll(ENGLISH_PARENS_RE);
  for (const m of englishMatches) {
    findings.englishParens.push({
      amfe: amfeProject,
      operation: opName,
      fieldPath,
      match: m[0],
      context: text.length > 120 ? text.substring(0, 120) + '...' : text,
    });
  }

  // b) Role errors
  for (const roleCheck of ROLE_ERRORS) {
    roleCheck.pattern.lastIndex = 0; // reset global regex
    const roleMatches = text.matchAll(roleCheck.pattern);
    for (const m of roleMatches) {
      findings.roleErrors.push({
        amfe: amfeProject,
        operation: opName,
        fieldPath,
        match: m[0],
        issue: roleCheck.issue,
        context: text.length > 120 ? text.substring(0, 120) + '...' : text,
      });
    }
  }

  // c) Academic vocabulary
  for (const acadCheck of ACADEMIC_TERMS) {
    acadCheck.pattern.lastIndex = 0;
    const acadMatches = text.matchAll(acadCheck.pattern);
    for (const m of acadMatches) {
      findings.academicVocab.push({
        amfe: amfeProject,
        operation: opName,
        fieldPath,
        match: m[0],
        suggestion: acadCheck.suggestion,
        context: text.length > 120 ? text.substring(0, 120) + '...' : text,
      });
    }
  }
}

function traverseAmfe(data, amfeProject, findings) {
  // Check header fields
  const header = data.header || {};
  for (const field of TEXT_FIELDS_HEADER) {
    if (header[field]) {
      checkText(header[field], `header.${field}`, amfeProject, '(header)', findings);
    }
  }
  // Check team array if exists
  if (Array.isArray(header.team)) {
    header.team.forEach((member, i) => {
      if (typeof member === 'string') {
        checkText(member, `header.team[${i}]`, amfeProject, '(header)', findings);
      } else if (member && member.name) {
        checkText(member.name, `header.team[${i}].name`, amfeProject, '(header)', findings);
      }
      if (member && member.role) {
        checkText(member.role, `header.team[${i}].role`, amfeProject, '(header)', findings);
      }
    });
  } else if (typeof header.team === 'string') {
    checkText(header.team, `header.team`, amfeProject, '(header)', findings);
  }

  // Traverse operations
  const operations = data.operations || [];
  for (const op of operations) {
    const opName = `OP ${op.opNumber || '?'}: ${op.name || '(sin nombre)'}`;

    // d) Operation naming: check uppercase and pattern
    if (op.name) {
      const name = op.name.trim();
      if (!OP_NAME_UPPER_RE.test(name)) {
        findings.opNaming.push({
          amfe: amfeProject,
          opNumber: op.opNumber,
          name: name,
          issue: 'No está completamente en MAYÚSCULAS',
        });
      }
      if (!name.includes(' - ') && !name.includes(' – ')) {
        findings.opNaming.push({
          amfe: amfeProject,
          opNumber: op.opNumber,
          name: name,
          issue: 'No sigue patrón CATEGORÍA - DETALLE (falta separador " - ")',
        });
      }
    }

    // Check operation-level text fields
    for (const field of TEXT_FIELDS_OPERATION) {
      checkText(op[field], `op[${op.opNumber}].${field}`, amfeProject, opName, findings);
    }

    // Work elements
    const workElements = op.workElements || [];
    for (let wei = 0; wei < workElements.length; wei++) {
      const we = workElements[wei];
      for (const field of TEXT_FIELDS_WORK_ELEMENT) {
        checkText(we[field], `op[${op.opNumber}].we[${wei}].${field}`, amfeProject, opName, findings);
      }

      // Functions
      const functions = we.functions || [];
      for (let fi = 0; fi < functions.length; fi++) {
        const fn = functions[fi];
        for (const field of TEXT_FIELDS_FUNCTION) {
          checkText(fn[field], `op[${op.opNumber}].we[${wei}].fn[${fi}].${field}`, amfeProject, opName, findings);
        }

        // Failures
        const failures = fn.failures || [];
        for (let fli = 0; fli < failures.length; fli++) {
          const fail = failures[fli];
          for (const field of TEXT_FIELDS_FAILURE) {
            checkText(fail[field], `op[${op.opNumber}].we[${wei}].fn[${fi}].fail[${fli}].${field}`, amfeProject, opName, findings);
          }

          // Causes
          const causes = fail.causes || [];
          for (let ci = 0; ci < causes.length; ci++) {
            const cause = causes[ci];
            for (const field of TEXT_FIELDS_CAUSE) {
              checkText(cause[field], `op[${op.opNumber}].we[${wei}].fn[${fi}].fail[${fli}].cause[${ci}].${field}`, amfeProject, opName, findings);
            }
          }
        }
      }
    }
  }
}

// ─── Also do a brute-force scan of ALL string values (catches anything missed) ──

function bruteForceTextScan(data, amfeProject, findings) {
  const allTexts = [];
  collectTextFields(data, 'data', allTexts);

  for (const { path, text } of allTexts) {
    // Only check English parens in brute force (structured check handles the rest)
    const englishMatches = text.matchAll(ENGLISH_PARENS_RE);
    for (const m of englishMatches) {
      // Check if already found in structured scan
      const alreadyFound = findings.englishParens.some(
        f => f.amfe === amfeProject && f.match === m[0] && f.context === (text.length > 120 ? text.substring(0, 120) + '...' : text)
      );
      if (!alreadyFound) {
        findings.englishParens.push({
          amfe: amfeProject,
          operation: '(brute-force scan)',
          fieldPath: path,
          match: m[0],
          context: text.length > 120 ? text.substring(0, 120) + '...' : text,
        });
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

await initSupabase();

console.log('='.repeat(100));
console.log('AMFE AUDIT — Language, Role, Vocabulary & Naming Convention Errors');
console.log('='.repeat(100));

const rows = await selectSql('SELECT id, amfe_number, project_name, data FROM amfe_documents ORDER BY amfe_number');
console.log(`\nLoaded ${rows.length} AMFE documents.\n`);

for (const row of rows) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const project = row.project_name || `AMFE-${row.amfe_number}`;
  console.log(`Processing: ${project} (AMFE #${row.amfe_number}) — ${(data.operations || []).length} operations`);

  traverseAmfe(data, project, findings);
  bruteForceTextScan(data, project, findings);
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('\n');
console.log('='.repeat(100));
console.log('RESULTS');
console.log('='.repeat(100));

// a) English in parentheses
console.log('\n' + '─'.repeat(100));
console.log(`A) ENGLISH TEXT IN PARENTHESES — ${findings.englishParens.length} findings`);
console.log('─'.repeat(100));
if (findings.englishParens.length === 0) {
  console.log('  (none found)');
} else {
  // Group by AMFE
  const grouped = {};
  for (const f of findings.englishParens) {
    if (!grouped[f.amfe]) grouped[f.amfe] = [];
    grouped[f.amfe].push(f);
  }
  for (const [amfe, items] of Object.entries(grouped)) {
    console.log(`\n  📄 ${amfe}:`);
    for (const f of items) {
      console.log(`    ⚠ ${f.match}`);
      console.log(`      Path:      ${f.fieldPath}`);
      console.log(`      Operation: ${f.operation}`);
      console.log(`      Context:   "${f.context}"`);
    }
  }
}

// b) Role errors
console.log('\n' + '─'.repeat(100));
console.log(`B) ROLE ERRORS — ${findings.roleErrors.length} findings`);
console.log('─'.repeat(100));
if (findings.roleErrors.length === 0) {
  console.log('  (none found)');
} else {
  const grouped = {};
  for (const f of findings.roleErrors) {
    if (!grouped[f.amfe]) grouped[f.amfe] = [];
    grouped[f.amfe].push(f);
  }
  for (const [amfe, items] of Object.entries(grouped)) {
    console.log(`\n  📄 ${amfe}:`);
    for (const f of items) {
      console.log(`    ⚠ Found: "${f.match}"`);
      console.log(`      Issue:     ${f.issue}`);
      console.log(`      Path:      ${f.fieldPath}`);
      console.log(`      Operation: ${f.operation}`);
      console.log(`      Context:   "${f.context}"`);
    }
  }
}

// c) Academic vocabulary
console.log('\n' + '─'.repeat(100));
console.log(`C) ACADEMIC/NON-PLANT VOCABULARY — ${findings.academicVocab.length} findings`);
console.log('─'.repeat(100));
if (findings.academicVocab.length === 0) {
  console.log('  (none found)');
} else {
  const grouped = {};
  for (const f of findings.academicVocab) {
    if (!grouped[f.amfe]) grouped[f.amfe] = [];
    grouped[f.amfe].push(f);
  }
  for (const [amfe, items] of Object.entries(grouped)) {
    console.log(`\n  📄 ${amfe}:`);
    for (const f of items) {
      console.log(`    ⚠ Found: "${f.match}"`);
      console.log(`      Suggestion: ${f.suggestion}`);
      console.log(`      Path:       ${f.fieldPath}`);
      console.log(`      Operation:  ${f.operation}`);
      console.log(`      Context:    "${f.context}"`);
    }
  }
}

// d) Operation naming convention
console.log('\n' + '─'.repeat(100));
console.log(`D) OPERATION NAMING CONVENTION — ${findings.opNaming.length} findings`);
console.log('─'.repeat(100));
if (findings.opNaming.length === 0) {
  console.log('  (none found)');
} else {
  const grouped = {};
  for (const f of findings.opNaming) {
    if (!grouped[f.amfe]) grouped[f.amfe] = [];
    grouped[f.amfe].push(f);
  }
  for (const [amfe, items] of Object.entries(grouped)) {
    console.log(`\n  📄 ${amfe}:`);
    for (const f of items) {
      console.log(`    ⚠ OP ${f.opNumber}: "${f.name}"`);
      console.log(`      Issue: ${f.issue}`);
    }
  }
}

// Summary
console.log('\n' + '='.repeat(100));
console.log('SUMMARY');
console.log('='.repeat(100));
console.log(`  Documents scanned:           ${rows.length}`);
console.log(`  A) English in parentheses:   ${findings.englishParens.length}`);
console.log(`  B) Role errors:              ${findings.roleErrors.length}`);
console.log(`  C) Academic vocabulary:       ${findings.academicVocab.length}`);
console.log(`  D) Operation naming issues:   ${findings.opNaming.length}`);
console.log(`  TOTAL FINDINGS:              ${findings.englishParens.length + findings.roleErrors.length + findings.academicVocab.length + findings.opNaming.length}`);
console.log('='.repeat(100));

close();
