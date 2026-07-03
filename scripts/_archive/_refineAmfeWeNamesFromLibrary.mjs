/**
 * Refina los WE.name que quedaron como "Pendiente definicion equipo APQP" tras
 * el fix masivo (_fixAmfePlaceholdersAndAllocation.mjs). Aplica nombres canonicos
 * extraidos de la biblioteca cross-AMFE Barack + AIAG-VDA.
 *
 * BIBLIOTECA (consolidada por 6 agents Explore — sesion 2026-05-14):
 * Para cada (op_type, we_type) -> nombre canonico Barack-wide o "TBD" si no hay.
 *
 * Solo modifica WEs donde WE.name === "Pendiente definicion equipo APQP" — NO
 * toca WEs con nombres reales ya validados por el equipo APQP.
 *
 * Uso:
 *   node scripts/_refineAmfeWeNamesFromLibrary.mjs                  # dry-run TODOS
 *   node scripts/_refineAmfeWeNamesFromLibrary.mjs --filter=HF-PAT  # solo uno
 *   node scripts/_refineAmfeWeNamesFromLibrary.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const PLACEHOLDER_ACTUAL = 'Pendiente definicion equipo APQP';
const TBD = 'TBD';

// ─────────────────────────────────────────────────────────────────────────────
// Biblioteca canonica (op_type -> we_type -> nombre)
// Source: 6 agents Explore que leyeron ARM-PAT, INS-PAT, AMFE-1, AMFE-2,
//         AIAG-VDA externos, y cross-reference de los 12 AMFEs Supabase
// ─────────────────────────────────────────────────────────────────────────────

// IMPORTANTE: regla amfe.md "1 item por WE, NO agrupar con /". Cada celda
// debe tener UN solo recurso real. Si la operacion usa varios, el equipo APQP
// los desglosara en WEs separados despues.
const LIBRARY = {
  'recepcion': {
    'Machine': 'Autoelevador',
    'Man': 'Inspector de recepcion',
    'Material': 'Etiquetas de identificacion de materia prima',
    'Method': 'Procedimiento de recepcion P-14',
    'Measurement': 'Calibre',
    'Environment': 'Sector de recepcion',
  },
  'corte': {
    'Machine': 'Mesa de corte',
    'Man': 'Operador de corte',
    'Material': 'Cuchilla de corte',
    'Method': 'Programa de corte',
    'Measurement': 'Cinta metrica',
    'Environment': 'Sector de corte',
  },
  'mylar': {
    'Machine': TBD,
    'Man': 'Operador de control',
    'Material': TBD,
    'Method': 'Procedimiento de control dimensional',
    'Measurement': 'Plantilla mylar de control',
    'Environment': TBD,
  },
  'costura': {
    'Machine': 'Maquina de coser industrial',
    'Man': 'Costurera',
    'Material': 'Hilo de costura',
    'Method': 'Configuracion de puntada',
    'Measurement': 'Muestra patron de costura',
    'Environment': 'Iluminacion del puesto de costura',
  },
  'enfundado': {
    'Machine': TBD,
    'Man': 'Operador de tapizado',
    'Material': TBD,
    'Method': 'Procedimiento de enfundado',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'varilla': {
    'Machine': TBD,
    'Man': 'Operador de insercion de varilla',
    'Material': 'Varilla metalica',
    'Method': 'Procedimiento de insercion de varilla',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'insercion': {
    'Machine': TBD,
    'Man': 'Operador de insercion',
    'Material': 'Componente a insertar',
    'Method': 'Procedimiento de insercion',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'inyeccion': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'pu': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'espumado': {
    'Machine': 'Inyectora de poliuretano',
    'Man': 'Operador de inyectora',
    'Material': 'Mezcla de poliol e isocianato',
    'Method': 'Hoja de parametros de inyeccion',
    'Measurement': 'Balanza de dosificacion',
    'Environment': 'Temperatura de molde',
  },
  'pre-inyeccion': {
    'Machine': 'Pistola etiquetadora',
    'Man': 'Operador de produccion',
    'Material': 'Bolsa para molde',
    'Method': 'Procedimiento de carga al molde',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'control final': {
    'Machine': 'Mesa de control final',
    'Man': 'Inspector de calidad',
    'Material': TBD,
    'Method': 'Procedimiento de control final',
    'Measurement': 'Patron visual de referencia',
    'Environment': 'Iluminacion estandarizada',
  },
  'reproceso': {
    'Machine': TBD,
    'Man': 'Operador de reproceso',
    'Material': 'Hilo de retrabajo',
    'Method': 'Instruccion de reproceso',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'embalaje': {
    'Machine': 'Pistola etiquetadora',
    'Man': 'Operador de embalaje',
    'Material': 'Embalaje KLT',
    'Method': 'Instructivo de embalaje y etiquetado',
    'Measurement': 'Verificacion de etiqueta de identificacion',
    'Environment': 'Iluminacion del sector',
  },
  'tapizado': {
    'Machine': TBD,
    'Man': 'Operador de tapizado',
    'Material': TBD,
    'Method': 'Procedimiento de tapizado',
    'Measurement': TBD,
    'Environment': TBD,
  },
  'troquelado': {
    'Machine': 'Troqueladora',
    'Man': 'Operador de troquelado',
    'Material': 'Cuchilla de troquel',
    'Method': 'Set-up de troquel',
    'Measurement': 'Galga de control post-corte',
    'Environment': TBD,
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
  // Orden de specificidad descendente
  if (n.includes('control final')) return 'control final';
  if (n.includes('mylar') || n.includes('plantilla')) return 'mylar';
  if (n.includes('inyeccion') || /\bpu\b/.test(n) || n.includes('espumado')) return 'inyeccion';
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

// ─────────────────────────────────────────────────────────────────────────────
// Args + Supabase
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const filter = (argv.find(a => a.startsWith('--filter='))?.split('=')[1]) || null;
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
const dudas = [];  // tablita de casos donde no pudimos inferir
const summary = { refined: 0, tbd: 0, dudas: 0 };

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

    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      const weName = (we.name || we.description || '').trim();
      const weType = we.type || '';

      // Solo refinar si tiene el placeholder actual
      if (normalize(weName) !== normalize(PLACEHOLDER_ACTUAL)) continue;

      const libEntry = LIBRARY[opType]?.[weType];
      if (!libEntry || libEntry === TBD) {
        // Sin mapeo o explicito TBD -> ponerle TBD (Fak prefiere corto)
        we.name = TBD;
        we.description = TBD;
        we._autoFilled = Array.from(new Set([...(we._autoFilled || []), 'name']));
        console.log(`  OP ${opNumber} (${opType || 'unknown'}) WE[${wi}] type=${weType}: TBD (sin biblioteca)`);
        if (!opType) {
          dudas.push({ amfe: row.amfe_number, opNumber, opName, weType, motivo: 'opType no detectado por heuristica' });
          summary.dudas++;
        }
        summary.tbd++;
        changes++;
      } else {
        we.name = libEntry;
        we.description = libEntry;
        we._autoFilled = Array.from(new Set([...(we._autoFilled || []), 'name']));
        console.log(`  OP ${opNumber} (${opType}) WE[${wi}] type=${weType}: "${libEntry}"`);
        summary.refined++;
        changes++;
      }
    }
  }

  if (changes === 0) {
    console.log('  (sin placeholders por refinar)');
    continue;
  }

  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen ===`);
console.log(`WEs refinados (biblioteca):   ${summary.refined}`);
console.log(`WEs marcados TBD:             ${summary.tbd}`);
console.log(`Dudas (opType no detectado):  ${summary.dudas}`);

if (dudas.length > 0) {
  console.log(`\n--- Tabla de dudas ---`);
  for (const d of dudas) {
    console.log(`  ${d.amfe} OP ${d.opNumber} "${d.opName}" type=${d.weType}: ${d.motivo}`);
  }
}

if (allPlans.length === 0) {
  console.log('Nada que aplicar.');
  process.exit(0);
}

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
