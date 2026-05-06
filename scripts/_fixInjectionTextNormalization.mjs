/**
 * Normalizacion de texto en los 5 AMFEs de inyeccion (master + 4 variantes):
 *
 *   1. Reemplazar "muestra maestra" -> "pieza patron" (terminologia Barack)
 *   2. Agregar n y tildes faltantes en palabras tecnicas frecuentes
 *   3. Reformular 2 terminos confusos:
 *      - "Soplado de canales no ejecutado al bajar molde" -> "Canales sin soplar al bajar molde"
 *      - "Limpieza de venteos no ejecutada" -> "Venteos sin limpiar en mantenimiento"
 *   4. Header: poblar companyName="BARACK MERCOSUL" + preparedBy="Facundo Santoro" si estan vacios
 *   5. Placeholder "Pendiente definicion equipo APQP" en causas AP=H sin accion (regla amfe-aph-pending)
 *
 * NO toca: severidades, ocurrencias, detecciones, AP, modos de falla, controles existentes.
 *
 * Uso:
 *   node scripts/_fixInjectionTextNormalization.mjs           # dry-run
 *   node scripts/_fixInjectionTextNormalization.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// IDs por amfe_number (resolved de la query)
const TARGETS = ['AMFE-MAESTRO-INY-001', 'AMFE-INS-PAT', 'VWA-PAT-IPPADS-001', 'AMFE-ARM-PAT', 'AMFE-TR-PAT'];
const APQP_PLACEHOLDER = 'Pendiente definicion equipo APQP';

// === REPLACEMENTS ===
const TEXT_REPLACEMENTS = [
  // 1. Pieza patron (Barack terminology)
  { from: /muestra maestra/gi, to: 'pieza patron' },
  { from: /muestra patron/gi, to: 'pieza patron' },

  // 2. Reformulacion de terminos confusos
  { from: /Soplado de canales no ejecutado al bajar molde/gi, to: 'Canales sin soplar al bajar molde' },
  { from: /Limpieza de venteos no ejecutada/gi, to: 'Venteos sin limpiar en mantenimiento' },

  // 3. Tildes en palabras tecnicas (orden: largo -> corto para evitar partial replace)
  { from: /\binspeccion\b/gi, to: m => m[0] === 'I' ? 'Inspección' : 'inspección' },
  { from: /\bcompactacion\b/gi, to: m => m[0] === 'C' ? 'Compactación' : 'compactación' },
  { from: /\bverificacion\b/gi, to: m => m[0] === 'V' ? 'Verificación' : 'verificación' },
  { from: /\bidentificacion\b/gi, to: m => m[0] === 'I' ? 'Identificación' : 'identificación' },
  { from: /\bcontaminacion\b/gi, to: m => m[0] === 'C' ? 'Contaminación' : 'contaminación' },
  { from: /\bcalibracion\b/gi, to: m => m[0] === 'C' ? 'Calibración' : 'calibración' },
  { from: /\binyeccion\b/gi, to: m => m[0] === 'I' ? 'Inyección' : 'inyección' },
  { from: /\bdosificacion\b/gi, to: m => m[0] === 'D' ? 'Dosificación' : 'dosificación' },
  { from: /\boperacion\b/gi, to: m => m[0] === 'O' ? 'Operación' : 'operación' },
  { from: /\bposicion\b/gi, to: m => m[0] === 'P' ? 'Posición' : 'posición' },
  { from: /\badhesion\b/gi, to: m => m[0] === 'A' ? 'Adhesión' : 'adhesión' },
  { from: /\bpresion\b/gi, to: m => m[0] === 'P' ? 'Presión' : 'presión' },
  { from: /\bdecision\b/gi, to: m => m[0] === 'D' ? 'Decisión' : 'decisión' },
  { from: /\bparametros\b/gi, to: m => m[0] === 'P' ? 'Parámetros' : 'parámetros' },
  { from: /\bplastica\b/gi, to: m => m[0] === 'P' ? 'Plástica' : 'plástica' },
  { from: /\bplastico\b/gi, to: m => m[0] === 'P' ? 'Plástico' : 'plástico' },
  { from: /\blinea\b/gi, to: m => m[0] === 'L' ? 'Línea' : 'línea' },
  { from: /\bdano\b/gi, to: m => m[0] === 'D' ? 'Daño' : 'daño' },
  { from: /\bdanado\b/gi, to: m => m[0] === 'D' ? 'Dañado' : 'dañado' },
  { from: /\bdanada\b/gi, to: m => m[0] === 'D' ? 'Dañada' : 'dañada' },
  { from: /\bdanados\b/gi, to: m => m[0] === 'D' ? 'Dañados' : 'dañados' },
  { from: /\bdanadas\b/gi, to: m => m[0] === 'D' ? 'Dañadas' : 'dañadas' },
];

function normalizeText(s) {
  if (typeof s !== 'string' || !s) return s;
  let out = s;
  for (const r of TEXT_REPLACEMENTS) {
    if (typeof r.to === 'function') {
      out = out.replace(r.from, (m) => r.to({ 0: m[0] }));
    } else {
      out = out.replace(r.from, r.to);
    }
  }
  return out;
}

// Iterar todos los strings de un objeto (deep)
function deepNormalize(obj, counters) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (typeof item === 'string') {
        const n = normalizeText(item);
        if (n !== item) { obj[i] = n; counters.replacements++; }
      } else {
        deepNormalize(item, counters);
      }
    });
    return obj;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string') {
      const n = normalizeText(v);
      if (n !== v) { obj[k] = n; counters.replacements++; }
    } else if (typeof v === 'object' && v !== null) {
      deepNormalize(v, counters);
    }
  }
  return obj;
}

// Resolver IDs
const { data: allDocs } = await sb.from('amfe_documents').select('id, amfe_number');
const idMap = new Map(allDocs.map(d => [d.amfe_number, d.id]));

const plan = [];
let totalReplacements = 0;
let totalHeaderFixes = 0;
let totalApqpPlaceholders = 0;

for (const num of TARGETS) {
  const id = idMap.get(num);
  if (!id) { console.log(`  ⚠ ${num} no encontrado`); continue; }

  const { doc: before } = await readAmfe(sb, id);
  const after = JSON.parse(JSON.stringify(before));
  const counters = { replacements: 0 };

  // 1-3. Normalizar texto en todo el doc
  deepNormalize(after, counters);

  // 4. Header
  const header = after.header || {};
  let headerFixes = 0;
  if (!header.companyName || header.companyName.trim() === '') {
    header.companyName = 'BARACK MERCOSUL';
    headerFixes++;
  }
  if (!header.preparedBy || header.preparedBy.trim() === '') {
    header.preparedBy = 'Facundo Santoro';
    headerFixes++;
  }
  after.header = header;

  // 5. APQP placeholder en APH sin accion
  let apqpPlaceholders = 0;
  for (const op of after.operations || []) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const f of fn.failures || []) {
          for (const c of f.causes || []) {
            const ap = c.ap || c.actionPriority || '';
            const prevEmpty = !c.preventionAction || c.preventionAction.trim() === '';
            const detEmpty = !c.detectionAction || c.detectionAction.trim() === '';
            // Solo placeholder cuando AMBOS estan vacios (regla amfe-aph-pending: "no tiene accion definida")
            if (ap === 'H' && prevEmpty && detEmpty) {
              c.preventionAction = APQP_PLACEHOLDER;
              c.detectionAction = APQP_PLACEHOLDER;
              apqpPlaceholders += 2;
            }
          }
        }
      }
    }
  }

  console.log(`\n${num}:`);
  console.log(`  Replacements texto: ${counters.replacements}`);
  console.log(`  Header fixes: ${headerFixes}`);
  console.log(`  APQP placeholders: ${apqpPlaceholders}`);

  totalReplacements += counters.replacements;
  totalHeaderFixes += headerFixes;
  totalApqpPlaceholders += apqpPlaceholders;

  if (counters.replacements + headerFixes + apqpPlaceholders > 0) {
    plan.push({ id, amfeNumber: num, productName: num, before, after });
  }
}

console.log(`\n=== TOTAL ===`);
console.log(`Texto: ${totalReplacements}`);
console.log(`Header: ${totalHeaderFixes}`);
console.log(`APQP placeholders: ${totalApqpPlaceholders}`);
console.log(`Docs a actualizar: ${plan.length}`);

await runWithValidation(plan, apply, async () => {
  for (const change of plan) {
    await saveAmfe(sb, change.id, change.after);
    console.log(`  ✓ saved ${change.amfeNumber}`);
  }
});

finish(apply);
