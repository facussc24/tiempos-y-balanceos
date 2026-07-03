/**
 * Llena los controles preventionControl/detectionControl que actualmente son
 * "TBD" usando una biblioteca canonica extraida del AMFE-ARM-PAT (gold standard
 * Barack validado por Fak). Indexada por (op_type, we_type).
 *
 * NO inventa: cada control viene de un AMFE ya validado por Fak.
 * Si el (op_type, we_type) no esta en biblioteca, mantiene "TBD".
 *
 * Uso:
 *   node scripts/_fillTbdControlsFromCanon.mjs            # dry-run
 *   node scripts/_fillTbdControlsFromCanon.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Biblioteca: (op_type x we_type) -> { prevention, detection }
// Fuente: AMFE-ARM-PAT (validado por Fak) extraido 2026-05-27
// ─────────────────────────────────────────────────────────────────────────────

const CANON = {
  'recepcion': {
    'Machine': {
      prev: 'Procedimientos de logistica sobre estiba segura del material',
      det:  'Inspeccion visual de danos y suciedad en el embalaje al recibir',
    },
    'Man': {
      prev: 'Instruccion de trabajo de recepcion con responsabilidades del operador',
      det:  'Autocontrol visual del operador al recibir el material',
    },
    'Material': {
      prev: 'Requisitos contractuales de calidad y auditorias al proveedor',
      det:  'Control dimensional por muestreo y revision del certificado',
    },
    'Method': {
      prev: 'Estandar operacional que exige el uso del sistema ARB en recepcion',
      det:  'Verificacion del certificado de conformidad y registro de lote',
    },
    'Measurement': {
      prev: 'Instruccion de trabajo de recepcion que exige verificacion fisica',
      det:  'Inspeccion visual en recepcion con instrumentos calibrados',
    },
    'Environment': {
      prev: 'Procedimiento de almacenamiento con condiciones controladas',
      det:  'Verificacion visual del sector de recepcion al arranque',
    },
  },
  'corte': {
    'Machine': {
      prev: 'Mantenimiento preventivo y verificacion de cuchillas al inicio del lote',
      det:  'Verificacion de piezas cortadas con mylar de control en la estacion',
    },
    'Man': {
      prev: 'Instruccion de trabajo con fotos de referencia de alineacion',
      det:  'Autocontrol visual de alineacion por el operador',
    },
    'Material': {
      prev: 'Procedimientos de limpieza periodica en el area de corte',
      det:  'Inspeccion visual de la pieza cortada',
    },
    'Method': {
      prev: 'Hoja de operacion con parametros de corte definidos',
      det:  'Verificacion de primera pieza al arranque del lote',
    },
    'Measurement': {
      prev: 'Calibracion periodica de instrumentos de medicion',
      det:  'Verificacion con mylar de control fisico',
    },
    'Environment': {
      prev: 'Iluminacion estandarizada en el sector de corte',
      det:  'Verificacion visual del puesto de trabajo',
    },
  },
  'mylar': {
    'Machine': {
      prev: 'Mantenimiento del troquel o herramienta de control',
      det:  'Verificacion de primera pieza al arranque',
    },
    'Man': {
      prev: 'Instruccion de trabajo de control con mylar',
      det:  'Autocontrol visual con plantilla de referencia',
    },
    'Method': {
      prev: 'Procedimiento de control dimensional definido',
      det:  'Verificacion de pieza contra mylar al arranque y por muestreo',
    },
    'Measurement': {
      prev: 'Mylar de control validado y calibrado periodicamente',
      det:  'Inspeccion 100% con plantilla mylar en estacion',
    },
  },
  'costura': {
    'Machine': {
      prev: 'Las costureras configuran la maquina segun hojas de operacion',
      det:  'Calibre para verificar puntadas',
    },
    'Man': {
      prev: 'Las maquinas poseen una guia y el operador sigue instruccion de trabajo',
      det:  'Inspeccion visual en linea',
    },
    'Material': {
      prev: 'Las hojas de operaciones indican que hilo utilizar y set-up de control',
      det:  'Inspeccion visual al arranque y por lote',
    },
    'Method': {
      prev: 'Configuracion de maquina segun especificaciones y checklist diaria',
      det:  'Verificacion con calibre por muestreo',
    },
    'Measurement': {
      prev: 'Calibracion periodica de instrumentos de medicion de puntada',
      det:  'Verificacion de muestra patron de costura por turno',
    },
    'Environment': {
      prev: 'Iluminacion estandarizada en el puesto de costura',
      det:  'Inspeccion visual del puesto al arranque',
    },
  },
  'enfundado': {
    'Machine': {
      prev: 'Mantenimiento de moldes y dispositivos de enfundado',
      det:  'Verificacion visual de primera pieza al arranque',
    },
    'Man': {
      prev: 'Instruccion estandar de enfundado con fotos de referencia',
      det:  'Inspeccion visual por el operador de tapizado',
    },
    'Method': {
      prev: 'Procedimiento de enfundado con secuencia definida',
      det:  'Verificacion de primera pieza por el lider',
    },
  },
  'varilla': {
    'Machine': {
      prev: 'Mantenimiento del dispositivo de insercion de varilla',
      det:  'Verificacion visual de varilla insertada',
    },
    'Man': {
      prev: 'Instruccion de trabajo de insercion de varilla con fotos',
      det:  'Autocontrol visual del operador con criterio OK/NOK',
    },
    'Material': {
      prev: 'Especificacion de varilla con dimensiones y propiedades validadas',
      det:  'Inspeccion visual de varilla al alimentar la estacion',
    },
    'Method': {
      prev: 'Procedimiento de insercion de varilla con secuencia definida',
      det:  'Verificacion de primera pieza por el lider al arranque',
    },
  },
  'insercion': {
    'Machine': {
      prev: 'Mantenimiento del dispositivo de insercion',
      det:  'Verificacion visual del componente insertado',
    },
    'Man': {
      prev: 'Instruccion de trabajo de insercion con fotos de posicionamiento',
      det:  'Autocontrol visual por el operador',
    },
    'Material': {
      prev: 'Especificacion del componente a insertar con dimensiones validadas',
      det:  'Inspeccion visual del componente al alimentar la estacion',
    },
    'Method': {
      prev: 'Procedimiento de insercion con secuencia definida',
      det:  'Verificacion de primera pieza al arranque del lote',
    },
  },
  'inyeccion': {
    'Machine': {
      prev: 'Hoja de parametros con alarmas configuradas en panel',
      det:  'Inspeccion visual 100% y comparacion con pieza patron',
    },
    'Man': {
      prev: 'Instruccion de trabajo con foto y aprobacion del lider al arranque',
      det:  'El lider verifica el registro de primera pieza',
    },
    'Material': {
      prev: 'Verificacion del certificado del lote y especificacion de mezcla',
      det:  'Ensayo de propiedades de la pieza inyectada por muestreo',
    },
    'Method': {
      prev: 'Verificacion de hoja de parametros al arranque con firma del operador',
      det:  'Primera pieza aprobada por el lider antes de continuar el lote',
    },
    'Measurement': {
      prev: 'Calibracion periodica de instrumentos de medicion de proceso',
      det:  'Verificacion contra patron y bloqueo si la calibracion esta vencida',
    },
    'Environment': {
      prev: 'Purga periodica de filtros de aire comprimido',
      det:  'Verificacion de filtro al arranque y de pieza por muestreo',
    },
  },
  'pu': {  // mismo que inyeccion (PU)
    'Machine': { prev: 'Uso de ayudas visuales y hoja de operaciones de inyectora PU', det: 'Control visual del operario y verificacion de primera pieza' },
    'Man': { prev: 'Instruccion de trabajo con foto y aprobacion del lider', det: 'El lider verifica el registro de primera pieza' },
    'Material': { prev: 'Verificacion del certificado de lote de poliol e isocianato', det: 'Ensayo de propiedades de la pieza espumada por muestreo' },
    'Method': { prev: 'Hoja de parametros de inyeccion PU con firma del operador al arranque', det: 'Primera pieza aprobada por el lider antes de continuar' },
    'Measurement': { prev: 'Calibracion periodica de balanza de dosificacion', det: 'Verificacion vs patron y bloqueo si la calibracion esta vencida' },
    'Environment': { prev: 'Control de temperatura de molde y aire comprimido', det: 'Verificacion de filtros al arranque y por muestreo' },
  },
  'espumado': {  // alias de inyeccion PU
    'Machine': { prev: 'Uso de ayudas visuales y hoja de operaciones de inyectora PU', det: 'Control visual del operario y verificacion de primera pieza' },
    'Man': { prev: 'Instruccion de trabajo con foto y aprobacion del lider', det: 'El lider verifica el registro de primera pieza' },
    'Material': { prev: 'Verificacion del certificado de lote de poliol e isocianato', det: 'Ensayo de propiedades de la pieza espumada por muestreo' },
    'Method': { prev: 'Hoja de parametros de inyeccion PU con firma del operador al arranque', det: 'Primera pieza aprobada por el lider antes de continuar' },
    'Measurement': { prev: 'Calibracion periodica de balanza de dosificacion', det: 'Verificacion vs patron y bloqueo si la calibracion esta vencida' },
    'Environment': { prev: 'Control de temperatura de molde y aire comprimido', det: 'Verificacion de filtros al arranque y por muestreo' },
  },
  'pre-inyeccion': {
    'Machine': { prev: 'Mantenimiento de pistola etiquetadora y mesa de armado', det: 'Verificacion visual al arranque del lote' },
    'Man': { prev: 'Instruccion de trabajo con fotos de carga al molde', det: 'Autocontrol del operador al cargar el molde' },
    'Material': { prev: 'Especificacion de bolsa y etiqueta validada con cliente', det: 'Inspeccion visual de etiqueta y bolsa al alimentar' },
    'Method': { prev: 'Procedimiento de carga al molde con secuencia definida', det: 'Verificacion de primera pieza por el lider' },
  },
  'control final': {
    'Machine': { prev: 'Mantenimiento de mesa e instrumentos de control final', det: 'Verificacion visual del estado de los instrumentos' },
    'Man': { prev: 'Instruccion de control final con criterios de aceptacion', det: 'Inspeccion 100% por el inspector de calidad' },
    'Method': { prev: 'Procedimiento de control final con plan de muestreo', det: 'Verificacion contra patron visual y dimensional' },
    'Measurement': { prev: 'Calibracion de instrumentos de control final', det: 'Verificacion contra patron al arranque y por muestreo' },
    'Environment': { prev: 'Iluminacion estandarizada en el sector de control', det: 'Verificacion del puesto al arranque' },
  },
  'reproceso': {
    'Man': { prev: 'Instruccion de reproceso con fotos de referencia OK/NOK', det: 'Inspeccion visual de la pieza retrabajada antes de continuar' },
    'Material': { prev: 'Especificacion de hilo o adhesivo para retrabajo validada', det: 'Verificacion visual del material antes de aplicar' },
    'Method': { prev: 'Procedimiento de reproceso con secuencia definida', det: 'Aprobacion de la pieza retrabajada por el lider' },
  },
  'embalaje': {
    'Machine': { prev: 'Mantenimiento de pistola etiquetadora y mesa de armado', det: 'Verificacion visual al arranque' },
    'Man': { prev: 'Instruccion de embalaje con fotos de paletizado correcto', det: 'Autocontrol del operador de embalaje' },
    'Material': { prev: 'Especificacion de embalaje (KLT, cartones, etiquetas) validada', det: 'Inspeccion visual de embalaje al alimentar' },
    'Method': { prev: 'Instructivo de embalaje y etiquetado con secuencia definida', det: 'Verificacion de cantidad y etiqueta por el lider' },
    'Measurement': { prev: 'Calibracion de balanza de verificacion de peso de embalaje', det: 'Verificacion de peso por muestreo' },
    'Environment': { prev: 'Iluminacion estandarizada en el sector de embalaje', det: 'Verificacion del puesto al arranque' },
  },
  'tapizado': {
    'Machine': { prev: 'Tolerancias del molde de tapizado definidas', det: 'Prueba funcional rapida del componente tapizado' },
    'Man': { prev: 'Instruccion estandar de tapizado con fotos de referencia', det: 'Inspeccion visual por el operador de tapizado' },
    'Method': { prev: 'Procedimiento de tapizado con secuencia definida', det: 'Verificacion de primera pieza por el lider' },
  },
  'troquelado': {
    'Machine': { prev: 'Mantenimiento del troquel y verificacion de filo de cuchilla', det: 'Verificacion de primera pieza con galga' },
    'Man': { prev: 'Instruccion de trabajo con fotos de set-up de troquel', det: 'Autocontrol visual por el operador' },
    'Material': { prev: 'Especificacion de la cuchilla de troquel validada', det: 'Verificacion visual del filo al arranque' },
    'Method': { prev: 'Procedimiento de set-up de troquel con secuencia definida', det: 'Verificacion de primera pieza por el lider' },
    'Measurement': { prev: 'Calibracion periodica de galga de control', det: 'Verificacion con galga al arranque y por muestreo' },
  },
  'adhesivado': {
    'Machine': { prev: 'Puesta a punto y verificacion manual de fechas de caducidad', det: 'Gestion de stock por FIFO y verificacion visual' },
    'Man': { prev: 'Instruccion de trabajo con croquis de posicion y cantidad', det: 'Inspeccion visual de primera pieza y autocontrol' },
    'Material': { prev: 'Especificacion de adhesivo por tipo de aplicacion', det: 'Ensayo de adherencia por muestreo' },
    'Method': { prev: 'Procedimiento de adhesivado con tiempo de curado definido', det: 'Verificacion de adherencia por muestreo' },
    'Measurement': { prev: 'Calibracion de cronometro de curado', det: 'Verificacion vs patron al arranque' },
    'Environment': { prev: 'Ventilacion del sector de adhesivado', det: 'Verificacion visual del puesto al arranque' },
  },
};

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getOpType(opName) {
  const n = normalize(opName);
  if (n.includes('control final')) return 'control final';
  if (n.includes('mylar') || (n.includes('plantilla') && n.includes('control'))) return 'mylar';
  if (n.includes('adhesivado')) return 'adhesivado';
  if (n.includes('inyeccion') && (n.includes('plast') || /\bplas/.test(n))) return 'inyeccion';
  if (n.includes('inyeccion') || /\bpu\b/.test(n) || /\bpur\b/.test(n) || n.includes('espumado')) return 'pu';
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

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(2); }

const allPlans = [];
const summary = { prev: 0, det: 0, noMap: 0 };

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;
  for (const op of after.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const opName = op.name || op.operationName || '';
    const opType = getOpType(opName);
    if (!opType) continue;

    for (const we of op.workElements || []) {
      const weType = we.type || '';
      const canon = CANON[opType]?.[weType];
      if (!canon) {
        // No tenemos mapping para esta combinacion
        for (const fn of we.functions || []) {
          for (const fm of fn.failures || []) {
            for (const c of fm.causes || []) {
              if (normalize(c.preventionControl || '') === 'tbd' || normalize(c.detectionControl || '') === 'tbd') {
                summary.noMap++;
              }
            }
          }
        }
        continue;
      }
      for (const fn of we.functions || []) {
        for (const fm of fn.failures || []) {
          for (const c of fm.causes || []) {
            if (normalize(c.preventionControl || '') === 'tbd') {
              c.preventionControl = canon.prev;
              const prev = Array.isArray(c._autoFilled) ? c._autoFilled : (c._autoFilled ? [c._autoFilled] : []);
              c._autoFilled = Array.from(new Set([...prev, 'preventionControl']));
              summary.prev++;
              changes++;
            }
            if (normalize(c.detectionControl || '') === 'tbd') {
              c.detectionControl = canon.det;
              const prev = Array.isArray(c._autoFilled) ? c._autoFilled : (c._autoFilled ? [c._autoFilled] : []);
              c._autoFilled = Array.from(new Set([...prev, 'detectionControl']));
              summary.det++;
              changes++;
            }
          }
        }
      }
    }
  }
  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen ===`);
console.log(`preventionControl llenados:  ${summary.prev}`);
console.log(`detectionControl llenados:   ${summary.det}`);
console.log(`TBDs sin mapping (mantienen): ${summary.noMap}`);
console.log(`AMFEs afectados:             ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
