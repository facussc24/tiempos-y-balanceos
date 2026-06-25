/**
 * Fix universal de incoherencias WE.type vs failure semantica.
 *
 * Aplica 3 correcciones segun AIAG-VDA 2019 PFMEA Steps 2+4:
 *
 * 1. DEDUP_WE_INTRA_OP: dos WEs en misma OP con normalize(type+name) identicos
 *    -> fusionar (mover failures del segundo al primero, eliminar segundo).
 *
 * 2. RECLASIFY_FAILURE_BY_KEYWORD: failure.description matchea keywords canonicos
 *    de una categoria M distinta a WE.type actual -> mover el failure al WE de la
 *    misma OP con el type correcto. Si no existe ese WE, crearlo con nombre
 *    canonico de la biblioteca (mismo mapping que _refineAmfeWeNamesFromLibrary.mjs).
 *    Causes/S/O/D/controles preservados intactos.
 *
 * 3. CLEAN_FN_DESC_EQUALS_OP_NAME: si function.description == op.name normalizado,
 *    vaciar (regla amfe-funciones-3-niveles.md Nivel 3: function.description debe
 *    describir contribucion del recurso al paso, NO el nombre de la OP).
 *
 * Reglas aplicadas:
 *  - amfe.md: 1M por linea (no agrupar items)
 *  - amfe-leer-contenido-antes-de-renumerar.md: leer failures antes de reclasificar
 *  - amfe-funciones-3-niveles.md: function.description != op.name
 *  - amfe-placeholder-last-resort.md: usar biblioteca canonica antes de placeholder
 *  - autonomy-contract.md B: NO inventar contenido tecnico; mover preserva contenido
 *
 * Source de keywords: investigacion 2026-05-14 (AIAG-VDA + Quality-One + Pretesh Biswas)
 *
 * Uso:
 *   node scripts/_fixAmfeWeTypeCoherence.mjs                  # dry-run TODOS
 *   node scripts/_fixAmfeWeTypeCoherence.mjs --filter=HF-PAT
 *   node scripts/_fixAmfeWeTypeCoherence.mjs --apply --allow-new-critical
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Keyword -> M category (canonica AIAG-VDA + Barack)
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_M_CATEGORY = [
  // Material: propiedades del material directo + normativas + ensayos de material
  { category: 'Material', keywords: [
    'flamabilidad', 'flammability', 'tl 1010', 'pv 1303', 'pv 2005', 'vw 50180',
    'voc', 'emisiones', 'organicas volatiles',
    'eu 2000/53', 'anexo ii', 'reach', 'rohs', 'imds',
    'intemperie', 'solidez', 'escala grises', 'decoloracion', 'ciclo termico',
    'dureza del material', 'densidad', 'espesor material',
    'color material', 'variacion de color', 'cambia color',
    'propiedades del material', 'especificacion del material',
    'material con especificacion erronea', 'material con humedad',
    'seleccion incorrecta del material', 'vinilo equivocado',
    'material no cumple', 'material rechazado', 'material vencido',
    'contaminacion del material', 'sustancia prohibida',
  ]},
  // Method: documentacion, procedimientos, instrucciones, dossier
  { category: 'Method', keywords: [
    'documentacion', 'falta de documentacion', 'documentacion de lote',
    'trazabilidad', 'identificacion del lote', 'identificacion de lote',
    'albaran', 'remito', 'orden de compra',
    'procedimiento incompleto', 'procedimiento no ejecutado',
    'instruccion no seguida', 'instruccion incompleta',
    'p-09', 'p-14', 'p-10', 'p-13', 'p-05',
    'i-in-', 'i-co-', 'i-cor-',
    'hoja de operacion', 'wi ', 'work instruction',
    'check-list', 'criterio de aceptacion', 'criterio aceptacion',
    'dossier', 'parametros no documentados',
  ]},
  // Man: error operario, manipulacion, atencion
  { category: 'Man', keywords: [
    'error de operario', 'error humano',
    'operador coloco mal', 'mal posicionado por operador',
    'manipulacion inadecuada', 'manipulacion incorrecta',
    'falta de atencion del operador', 'omision del operador',
    'colocacion incorrecta por operador',
  ]},
  // Machine: equipo, parametros maquina, desgaste, sensores
  { category: 'Machine', keywords: [
    'rebaba', 'flash en pieza', 'fuga de material',
    'presion fuera', 'temperatura del molde', 'tiempo de ciclo',
    'desgaste del molde', 'desgaste de herramienta', 'desgaste de cuchilla',
    'sensor defectuoso', 'sensor no funciona', 'poka-yoke fallido',
    'mantenimiento de maquina', 'mantenimiento preventivo de equipo',
    'canales de refrigeracion', 'refrigeracion del tornillo',
    'lubricacion de maquina', 'velocidad de carrera',
  ]},
  // Measurement: instrumentos, calibracion
  { category: 'Measurement', keywords: [
    'descalibrado', 'fuera de calibracion', 'calibracion vencida',
    'instrumento descalibrado', 'balanza descalibrada',
    'cronometro defectuoso', 'medidor defectuoso',
    'msa', 'gauge r&r', 'patron visual danado', 'patron visual deteriorado',
  ]},
  // Environment: condiciones ambientales (NO confundir con OP de RECEPCION)
  { category: 'Environment', keywords: [
    'iluminacion insuficiente', 'iluminacion deficiente', 'iluminacion baja',
    'ventilacion insuficiente', 'falta de ventilacion',
    'temperatura ambiente fuera', 'humedad ambiente alta',
    'ruido excesivo', 'contaminacion ambiental',
    'condiciones ambientales inadecuadas',
  ]},
];

// Biblioteca canonica de WE.name por (op_type, we_type) — copia de _refineAmfeWeNamesFromLibrary.mjs
const LIBRARY = {
  'recepcion': {
    'Machine': 'Autoelevador', 'Man': 'Inspector de recepcion',
    'Material': 'Material recibido', 'Method': 'Procedimiento de recepcion P-14',
    'Measurement': 'Calibre', 'Environment': 'Sector de recepcion',
  },
  'corte': {
    'Machine': 'Mesa de corte', 'Man': 'Operador de produccion',
    'Material': 'Cuchilla de corte', 'Method': 'Programa de corte',
    'Measurement': 'Cinta metrica', 'Environment': 'Sector de corte',
  },
  'mylar': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'TBD', 'Method': 'Procedimiento de control dimensional',
    'Measurement': 'Plantilla mylar de control', 'Environment': 'TBD',
  },
  'costura': {
    'Machine': 'Maquina de coser industrial', 'Man': 'Costurera',
    'Material': 'Hilo de costura', 'Method': 'Configuracion de puntada',
    'Measurement': 'Muestra patron de costura', 'Environment': 'Iluminacion del puesto de costura',
  },
  'enfundado': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'TBD', 'Method': 'Procedimiento de enfundado',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'varilla': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'Varilla metalica', 'Method': 'Procedimiento de insercion de varilla',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'insercion': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'Componente a insertar', 'Method': 'Procedimiento de insercion',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'inyeccion': {
    'Machine': 'Inyectora de poliuretano', 'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato', 'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion', 'Environment': 'Temperatura de molde',
  },
  'pu': {
    'Machine': 'Inyectora de poliuretano', 'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato', 'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion', 'Environment': 'Temperatura de molde',
  },
  'espumado': {
    'Machine': 'Inyectora de poliuretano', 'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato', 'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion', 'Environment': 'Temperatura de molde',
  },
  'pre-inyeccion': {
    'Machine': 'Pistola etiquetadora', 'Man': 'Operador de produccion',
    'Material': 'Bolsa para molde', 'Method': 'Procedimiento de carga al molde',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'control final': {
    'Machine': 'Mesa de control final', 'Man': 'Inspector de calidad',
    'Material': 'TBD', 'Method': 'Procedimiento de control final',
    'Measurement': 'Patron visual de referencia', 'Environment': 'Iluminacion estandarizada',
  },
  'reproceso': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'Hilo de retrabajo', 'Method': 'Instruccion de reproceso',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'embalaje': {
    'Machine': 'Pistola etiquetadora', 'Man': 'Operador de produccion',
    'Material': 'Embalaje KLT', 'Method': 'Instructivo de embalaje y etiquetado',
    'Measurement': 'Verificacion de etiqueta', 'Environment': 'Iluminacion del sector',
  },
  'tapizado': {
    'Machine': 'TBD', 'Man': 'Operador de produccion',
    'Material': 'TBD', 'Method': 'Procedimiento de tapizado',
    'Measurement': 'TBD', 'Environment': 'TBD',
  },
  'troquelado': {
    'Machine': 'Troqueladora', 'Man': 'Operador de produccion',
    'Material': 'Cuchilla de troquel', 'Method': 'Set-up de troquel',
    'Measurement': 'Galga de control', 'Environment': 'TBD',
  },
  'adhesivado': {
    'Machine': 'Pistola de adhesivado', 'Man': 'Operador de produccion',
    'Material': 'Adhesivo', 'Method': 'Procedimiento de adhesivado',
    'Measurement': 'Cronometro de curado', 'Environment': 'Ventilacion',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getOpType(opName) {
  const n = normalize(opName);
  if (n.includes('control final')) return 'control final';
  if (n.includes('mylar') || (n.includes('plantilla') && n.includes('control'))) return 'mylar';
  if (n.includes('adhesivado')) return 'adhesivado';
  if (n.includes('inyeccion') || /\bpu\b/.test(n) || /\bpur\b/.test(n) || n.includes('espumado')) return 'inyeccion';
  if (n.includes('precinto') || n.includes('bolsa') || n.includes('cierre del molde')) return 'pre-inyeccion';
  if (n.includes('insercion') && n.includes('varilla')) return 'varilla';
  if (n.includes('insercion')) return 'insercion';
  if (n.includes('enfundado') || n.includes('enfundar')) return 'enfundado';
  if (n.includes('costura')) return 'costura';
  if (n.includes('corte')) return 'corte';
  if (n.includes('troquelado')) return 'troquelado';
  if (n.includes('tapizado')) return 'tapizado';
  if (n.includes('reproceso') || n.includes('retrabajo')) return 'reproceso';
  if (n.includes('embalaje')) return 'embalaje';
  if (n.includes('recepcion')) return 'recepcion';
  return null;
}

function keywordMatch(haystackNorm, kwRaw) {
  const kw = normalize(kwRaw);
  if (!kw) return false;
  // Keywords cortas (<= 5 chars) requieren word boundary para evitar substring spurious
  // Ej. "voc" no matchea "vinilo equivocado". "pu" no matchea "puntada".
  if (kw.length <= 5) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystackNorm);
  }
  // Keywords largas: substring OK
  return haystackNorm.includes(kw);
}

function classifyFailureByKeyword(failureDesc) {
  const n = normalize(failureDesc);
  const hits = [];
  for (const rule of KEYWORD_M_CATEGORY) {
    for (const kw of rule.keywords) {
      if (keywordMatch(n, kw)) {
        hits.push({ category: rule.category, keyword: kw });
        break;
      }
    }
  }
  if (hits.length === 0) return null;
  const uniqueCats = [...new Set(hits.map(h => h.category))];
  if (uniqueCats.length > 1) return null;  // ambiguo
  return hits[0];
}

function findOrCreateWeByType(op, targetType, opType) {
  // Buscar WE con type=targetType en la misma OP
  const existing = (op.workElements || []).find(we => we.type === targetType);
  if (existing) return existing;
  // Crear nuevo WE con nombre canonico de la biblioteca o TBD
  const libName = LIBRARY[opType]?.[targetType] || 'TBD';
  const newWe = {
    type: targetType,
    name: libName,
    description: libName,
    functions: [{ description: '', failures: [] }],
    _autoFilled: ['name', 'type'],
  };
  if (!Array.isArray(op.workElements)) op.workElements = [];
  op.workElements.push(newWe);
  return newWe;
}

function getFirstFunction(we) {
  if (!Array.isArray(we.functions) || we.functions.length === 0) {
    we.functions = [{ description: '', failures: [] }];
  }
  if (!Array.isArray(we.functions[0].failures)) we.functions[0].failures = [];
  return we.functions[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Args + Supabase
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const filter = (argv.find(a => a.startsWith('--filter='))?.split('=')[1]) || null;
const allowNewCritical = argv.includes('--allow-new-critical');
const { apply } = parseSafeArgs();

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

let q = sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (filter) q = q.ilike('amfe_number', `%${filter}%`);
const { data: rows, error } = await q;
if (error) { console.error(error); process.exit(2); }

// ─────────────────────────────────────────────────────────────────────────────
// Process
// ─────────────────────────────────────────────────────────────────────────────

const allPlans = [];
const summary = { dedup: 0, reclassified: 0, fnCleaned: 0, ambiguous: 0 };

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  console.log(`\n--- ${row.amfe_number} (${row.project_name}) ---`);
  let changes = 0;

  for (const op of after.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const opName = op.name || op.operationName || '';
    const opType = getOpType(opName);
    const opNameNorm = normalize(opName);

    // ── Paso 1: DEDUP WEs intra-OP (mismo type+name)
    const seen = new Map();
    const weToRemoveIdx = [];
    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      const key = normalize(we.type || '') + '|' + normalize(we.name || '');
      if (seen.has(key)) {
        // Duplicado: mover failures de we[wi] a we[seen.get(key)] y marcar para eliminar
        const dstIdx = seen.get(key);
        const dstWe = op.workElements[dstIdx];
        const dstFn = getFirstFunction(dstWe);
        for (const fn of (we.functions || [])) {
          for (const fm of (fn.failures || [])) {
            dstFn.failures.push(fm);
          }
        }
        console.log(`  OP ${opNumber}: DEDUP WE[${wi}] "${we.name}" (${we.type}) -> WE[${dstIdx}] mismo type+name`);
        weToRemoveIdx.push(wi);
        summary.dedup++;
        changes++;
      } else {
        seen.set(key, wi);
      }
    }
    for (const idx of weToRemoveIdx.sort((a, b) => b - a)) {
      op.workElements.splice(idx, 1);
    }

    // ── Paso 2: Limpiar function.description == op.name
    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      for (let fi = 0; fi < (we.functions || []).length; fi++) {
        const fn = we.functions[fi];
        const fnDesc = fn.description || fn.functionDescription || '';
        if (fnDesc && normalize(fnDesc) === opNameNorm) {
          console.log(`  OP ${opNumber}: CLEAN fn[${wi}/${fi}].description "${fnDesc}" -> "" (= op.name)`);
          fn.description = '';
          fn.functionDescription = '';
          fn._autoFilled = Array.from(new Set([...(fn._autoFilled || []), 'description']));
          summary.fnCleaned++;
          changes++;
        }
      }
    }

    // ── Paso 3: Reclasificar failures por keyword
    // Iterar copy snapshot
    const movements = [];  // {srcWeIdx, srcFnIdx, srcFmIdx, dstType, fm}
    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      for (let fi = 0; fi < (we.functions || []).length; fi++) {
        const fn = we.functions[fi];
        for (let mi = 0; mi < (fn.failures || []).length; mi++) {
          const fm = fn.failures[mi];
          const fmDesc = fm.description || fm.failureMode || '';
          if (!fmDesc) continue;
          const classification = classifyFailureByKeyword(fmDesc);
          if (!classification) {
            // Ambiguo o sin match
            const n = normalize(fmDesc);
            if (KEYWORD_M_CATEGORY.some(r => r.keywords.some(k => keywordMatch(n, k)))) {
              summary.ambiguous++;
            }
            continue;
          }
          if (classification.category === we.type) continue;  // coherente
          movements.push({ srcWeIdx: wi, srcFnIdx: fi, srcFmIdx: mi, dstType: classification.category, fm, keyword: classification.keyword });
        }
      }
    }

    // Aplicar movimientos en orden inverso para no romper indices
    movements.sort((a, b) => {
      if (a.srcWeIdx !== b.srcWeIdx) return b.srcWeIdx - a.srcWeIdx;
      if (a.srcFnIdx !== b.srcFnIdx) return b.srcFnIdx - a.srcFnIdx;
      return b.srcFmIdx - a.srcFmIdx;
    });

    for (const m of movements) {
      const srcWe = op.workElements[m.srcWeIdx];
      const srcFn = srcWe.functions[m.srcFnIdx];
      // Remove del src
      srcFn.failures.splice(m.srcFmIdx, 1);
      // Crear/encontrar dst WE
      const dstWe = findOrCreateWeByType(op, m.dstType, opType);
      const dstFn = getFirstFunction(dstWe);
      dstFn.failures.push(m.fm);
      const fmDescShort = (m.fm.description || '').substring(0, 55);
      console.log(`  OP ${opNumber}: MOVE failure "${fmDescShort}..." (kw="${m.keyword}") ${srcWe.type} -> ${m.dstType}`);
      summary.reclassified++;
      changes++;
    }
  }

  if (changes === 0) {
    console.log('  (sin cambios)');
    continue;
  }

  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen global ===`);
console.log(`WEs deduplicados:           ${summary.dedup}`);
console.log(`Failures reclasificados:    ${summary.reclassified}`);
console.log(`Functions limpiadas:        ${summary.fnCleaned}`);
console.log(`Failures ambiguos (skip):   ${summary.ambiguous}`);
console.log(`AMFEs afectados:            ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical });
