/**
 * desdoblarIpPadCostura.mjs
 *
 * Desdobla la OP 40 COSTURA del AMFE IP PAD en 3 operaciones:
 *   - OP 40 REFILADO (nueva, con WEs estándar de refilado pre-costura)
 *   - OP 41 COSTURA UNIÓN (conserva WE #1 "Máquina de coser" del OP 40 actual
 *     + su método común + fallas intactas)
 *   - OP 42 COSTURA VISTA (conserva WE #2 "Máquina de coser" del OP 40 actual
 *     + método adaptado + fallas intactas)
 *
 * Fak autorizó 2026-04-23 crear OP 40 REFILADO con fallas estándar del proceso
 * de refilado de vinilo PVC previo a costura (industria textil/automotriz).
 * Ninguna falla específica al producto es inventada — son modos universales
 * del proceso de corte/recorte pre-costura.
 *
 * SOD assignments: conservadores (mayoría AP=L), alineados con:
 *   - reglas amfe.md (S=4-6 para cosméticos/retrabajo)
 *   - escalas calibradas para cabina interior VW
 * El equipo APQP puede ajustar en próxima revisión.
 *
 * Dry-run por default. --apply para ejecutar.
 */

import { parseSafeArgs, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { randomUUID } from 'crypto';

const { apply } = parseSafeArgs();
const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

const sb = await connectSupabase();
const { doc: docBefore, amfe_number } = await readAmfe(sb, AMFE_ID);

// Deep clone para computar "after"
const doc = JSON.parse(JSON.stringify(docBefore));

// ── Ubicar OP 40 actual ─────────────────────────────────────────────────────
const op40Index = doc.operations.findIndex(op => {
  const num = op.opNumber || op.operationNumber;
  return String(num) === '40';
});
if (op40Index < 0) throw new Error('OP 40 not found');
const op40Original = doc.operations[op40Index];

// Extraer los 3 WEs actuales:
//   [0] Machine "Máquina de coser" (unión)
//   [1] Machine "Máquina de coser" (vista)
//   [2] Method "Patron de costura (union+vista)"
const weUnionOriginal = op40Original.workElements[0];
const weVistaOriginal = op40Original.workElements[1];
const weMethodOriginal = op40Original.workElements[2];

// ── Helpers ─────────────────────────────────────────────────────────────────
function mkCause({ cause, severity, occurrence, detection, prevention, detectionCtrl, ap, charNum }) {
  return {
    cause,
    description: cause,
    severity,
    occurrence,
    detection,
    preventionControl: prevention,
    detectionControl: detectionCtrl,
    ap,
    actionPriority: ap,
    specialChar: '',
    characteristicNumber: String(charNum),
    filterCode: '',
  };
}

function mkFailure(desc, effects, causes) {
  // effects = { local, nextLevel, endUser }
  const maxS = Math.max(0, ...causes.map(c => c.severity || 0));
  const maxO = Math.max(0, ...causes.map(c => c.occurrence || 0));
  const maxD = Math.max(0, ...causes.map(c => c.detection || 0));
  const apCounts = { H: 0, M: 0, L: 0 };
  for (const c of causes) apCounts[c.ap] = (apCounts[c.ap] || 0) + 1;
  const fmAp = apCounts.H ? 'H' : apCounts.M ? 'M' : 'L';
  const pc = causes.map(c => c.preventionControl).filter(Boolean).join(' / ');
  const dc = causes.map(c => c.detectionControl).filter(Boolean).join(' / ');
  return {
    id: randomUUID(),
    description: desc,
    failureMode: desc,
    effectLocal: effects.local,
    effectNextLevel: effects.nextLevel,
    effectEndUser: effects.endUser,
    // Campos legacy fm-level (VDA 2019 deprecados pero leidos por exports)
    severity: maxS,
    occurrence: maxO,
    detection: maxD,
    ap: fmAp,
    actionPriority: fmAp,
    preventionControl: pc,
    detectionControl: dc,
    specialChar: '',
    classification: '',
    causes,
  };
}

const EFFECT_DIMENSION = {
  local: 'Panel fuera de medida, retrabajo offline o scrap',
  nextLevel: 'No ensambla correctamente en costura union/vista, paro de linea',
  endUser: 'Desajuste dimensional del IP PAD en tablero, ruido S&R, percepcion de baja calidad',
};
const EFFECT_BORDE = {
  local: 'Borde irregular o sucio requiere retrabajo antes de costura',
  nextLevel: 'Costura posterior saltada o desviada por borde defectuoso',
  endUser: 'Costura visible con defectos esteticos en habitaculo',
};
const EFFECT_DANO_UTIL = {
  local: 'Panel danado en zona visible, scrap',
  nextLevel: 'Perdida de pieza, reposicion de material, atraso en linea',
  endUser: 'Posible pieza defectuosa enviada al cliente (rechazo)',
};
const EFFECT_PATRON = {
  local: 'Pieza producida fuera de especificacion del cliente',
  nextLevel: 'Detencion de linea al detectar no conformidad',
  endUser: 'Pieza con costura fuera de diseno aprobado por el cliente',
};
const EFFECT_PATRON_INCORRECTO = {
  local: 'Piezas producidas con geometria incorrecta, scrap',
  nextLevel: 'Mezcla de productos, posible llegada de pieza equivocada al cliente',
  endUser: 'Pieza no intercambiable con vehiculo, rechazo del cliente',
};
const EFFECT_AUTOCONTROL = {
  local: 'No se detecta deriva de proceso al arranque, scrap latente',
  nextLevel: 'Lote completo con desvio pasa al siguiente puesto',
  endUser: 'Posible llegada al cliente de piezas fuera de especificacion',
};

// Effects base del focus del AMFE (los mismos que otras OPs)
const FOCUS = 'Interno: Ensamble y encastre del pad en tablero de instrumentos, integridad de bordes / Cliente (VW): Montaje del modulo en el vehiculo / Usuario final: Estetica del habitaculo, ausencia de Squeak & Rattle, confort tactil';

// ═══════════════════════════════════════════════════════════════════════════
// OP 40 — REFILADO
// ═══════════════════════════════════════════════════════════════════════════
const op40Refilado = {
  opNumber: '40',
  operationNumber: '40',
  name: 'REFILADO',
  operationName: 'REFILADO',
  focusElementFunction: FOCUS,
  operationFunction: 'Recortar el contorno del panel de vinilo PVC a dimension especificada antes de costura, asegurando bordes limpios y rectos para union y costura posterior',
  workElements: [
    {
      type: 'Machine',
      name: 'Maquina refiladora',
      functions: [
        {
          description: 'Recortar contorno del panel PVC segun plantilla',
          functionDescription: 'Recortar contorno del panel PVC segun plantilla',
          requirements: 'Cuchilla afilada, plantilla calibrada, velocidad de avance segun dossier',
          failures: [
            mkFailure('Corte fuera de dimension (panel mas chico)', EFFECT_DIMENSION, [
              mkCause({ cause: 'Cuchilla desafilada o desgastada', severity: 5, occurrence: 4, detection: 4, prevention: 'Afilado programado de cuchilla, dossier de cambio', detectionCtrl: 'Calibre dimensional primera pieza', ap: 'L', charNum: 1 }),
              mkCause({ cause: 'Plantilla mal posicionada', severity: 5, occurrence: 3, detection: 4, prevention: 'Verificacion de plantilla al inicio de turno', detectionCtrl: 'Calibre dimensional primera pieza', ap: 'L', charNum: 1 }),
            ]),
            mkFailure('Sobrante de material en borde (refilado incompleto)', EFFECT_BORDE, [
              mkCause({ cause: 'Velocidad de avance incorrecta', severity: 4, occurrence: 5, detection: 4, prevention: 'Parametros de refiladora segun dossier', detectionCtrl: 'Inspeccion visual 100%', ap: 'L', charNum: 2 }),
              mkCause({ cause: 'Cuchilla mellada', severity: 4, occurrence: 4, detection: 4, prevention: 'Afilado programado de cuchilla', detectionCtrl: 'Inspeccion visual 100%', ap: 'L', charNum: 2 }),
            ]),
            mkFailure('Borde deshilachado o sucio', EFFECT_BORDE, [
              mkCause({ cause: 'Cuchilla sin filo adecuado', severity: 4, occurrence: 4, detection: 5, prevention: 'Control de estado de cuchilla por turno', detectionCtrl: 'Inspeccion visual 100% calidad de borde', ap: 'L', charNum: 3 }),
              mkCause({ cause: 'Velocidad de corte inadecuada', severity: 4, occurrence: 4, detection: 5, prevention: 'Parametros de refiladora segun dossier', detectionCtrl: 'Inspeccion visual 100% calidad de borde', ap: 'L', charNum: 3 }),
            ]),
            mkFailure('Dano en zona util del panel (corte invasivo)', EFFECT_DANO_UTIL, [
              mkCause({ cause: 'Pieza mal posicionada en plantilla', severity: 6, occurrence: 3, detection: 4, prevention: 'Plantilla con topes de posicionamiento', detectionCtrl: 'Inspeccion visual 100% zona util', ap: 'M', charNum: 4 }),
              mkCause({ cause: 'Plantilla desajustada', severity: 6, occurrence: 3, detection: 4, prevention: 'Verificacion de plantilla al inicio de turno + cada N piezas', detectionCtrl: 'Inspeccion visual 100% zona util', ap: 'M', charNum: 4 }),
            ]),
          ],
        },
      ],
    },
    {
      type: 'Method',
      name: 'Plantilla de refilado',
      functions: [
        {
          description: 'Definir trayectoria de corte consistente entre piezas',
          functionDescription: 'Definir trayectoria de corte consistente entre piezas',
          requirements: 'Plantilla en buen estado, calibrada, identificada por part number',
          failures: [
            mkFailure('Plantilla desgastada o deformada', EFFECT_DIMENSION, [
              mkCause({ cause: 'Uso prolongado sin reemplazo', severity: 5, occurrence: 3, detection: 5, prevention: 'Programa de reemplazo de plantillas por ciclos', detectionCtrl: 'Inspeccion dimensional primera pieza', ap: 'L', charNum: 5 }),
            ]),
            mkFailure('Plantilla incorrecta para el part number', EFFECT_PATRON_INCORRECTO, [
              mkCause({ cause: 'Error de seleccion de plantilla por operador', severity: 6, occurrence: 3, detection: 4, prevention: 'Plantilla identificada con PN visible + verificacion al setup', detectionCtrl: 'Verificacion dimensional primera pieza', ap: 'M', charNum: 6 }),
            ]),
          ],
        },
      ],
    },
    {
      type: 'Man',
      name: 'Operador de refiladora',
      functions: [
        {
          description: 'Ejecutar el refilado segun procedimiento y aplicar autocontrol',
          functionDescription: 'Ejecutar el refilado segun procedimiento y aplicar autocontrol',
          requirements: 'Operario autorizado, con instruccion de trabajo a disposicion',
          failures: [
            mkFailure('Omision de autocontrol al arranque del turno', EFFECT_AUTOCONTROL, [
              mkCause({ cause: 'Instruccion de trabajo no disponible o confusa', severity: 5, occurrence: 4, detection: 5, prevention: 'Instruccion de trabajo visible en puesto + autocontrol primera pieza', detectionCtrl: 'Verificacion dimensional primera pieza del turno', ap: 'L', charNum: 7 }),
            ]),
          ],
        },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// OP 41 — COSTURA UNIÓN (WE #1 original)
// ═══════════════════════════════════════════════════════════════════════════
const weUnionNew = JSON.parse(JSON.stringify(weUnionOriginal));
weUnionNew.name = 'Maquina de coser (union)';

const op41Union = {
  opNumber: '41',
  operationNumber: '41',
  name: 'COSTURA UNION',
  operationName: 'COSTURA UNION',
  focusElementFunction: FOCUS,
  operationFunction: 'Coser la union entre paneles del cobertor de vinilo para formar la funda del IP PAD',
  workElements: [
    weUnionNew,
    {
      type: 'Method',
      name: 'Patron de costura union',
      functions: [
        {
          description: 'Seguir patron correcto para union de paneles',
          functionDescription: 'Seguir patron correcto para union de paneles',
          requirements: 'Patron vigente, disponible en puesto',
          failures: [
            mkFailure('Patron de costura danado o desactualizado', EFFECT_PATRON, [
              mkCause({ cause: 'Patron no revisado por tiempo prolongado', severity: 5, occurrence: 3, detection: 5, prevention: 'Control de documentos segun P-05, revisiones periodicas', detectionCtrl: 'Inspeccion visual comparativa con patron maestro', ap: 'L', charNum: 1 }),
            ]),
          ],
        },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// OP 42 — COSTURA VISTA (WE #2 original)
// ═══════════════════════════════════════════════════════════════════════════
const weVistaNew = JSON.parse(JSON.stringify(weVistaOriginal));
weVistaNew.name = 'Maquina de coser (vista)';

const op42Vista = {
  opNumber: '42',
  operationNumber: '42',
  name: 'COSTURA VISTA',
  operationName: 'COSTURA VISTA',
  focusElementFunction: FOCUS,
  operationFunction: 'Realizar costura decorativa visible sobre la funda del IP PAD segun diseno del cliente',
  workElements: [
    weVistaNew,
    {
      type: 'Method',
      name: 'Patron de costura vista',
      functions: [
        {
          description: 'Seguir patron correcto para costura decorativa',
          functionDescription: 'Seguir patron correcto para costura decorativa',
          requirements: 'Patron vigente, disponible en puesto',
          failures: [
            mkFailure('Patron de costura vista danado o desactualizado', EFFECT_PATRON, [
              mkCause({ cause: 'Patron no revisado por tiempo prolongado', severity: 5, occurrence: 3, detection: 5, prevention: 'Control de documentos segun P-05, revisiones periodicas', detectionCtrl: 'Inspeccion visual comparativa con patron maestro', ap: 'L', charNum: 1 }),
            ]),
          ],
        },
      ],
    },
  ],
};

// ── Reemplazar OP 40 por las 3 nuevas ───────────────────────────────────────
doc.operations.splice(op40Index, 1, op40Refilado, op41Union, op42Vista);

// Log del plan
console.log(`\nPlan: AMFE ${amfe_number}`);
console.log(`  Antes: ${docBefore.operations.length} ops (OP 40 "COSTURA" con 3 WEs)`);
console.log(`  Despues: ${doc.operations.length} ops:`);
console.log(`    OP 40 REFILADO — ${op40Refilado.workElements.length} WEs, ${op40Refilado.workElements.reduce((n, we) => n + we.functions.reduce((m, fn) => m + (fn.failures?.length || 0), 0), 0)} failures`);
console.log(`    OP 41 COSTURA UNION — ${op41Union.workElements.length} WEs, ${op41Union.workElements.reduce((n, we) => n + we.functions.reduce((m, fn) => m + (fn.failures?.length || 0), 0), 0)} failures (incluye WE #1 original con ${weUnionOriginal.functions.reduce((m, fn) => m + (fn.failures?.length || 0), 0)} failures preservadas)`);
console.log(`    OP 42 COSTURA VISTA — ${op42Vista.workElements.length} WEs, ${op42Vista.workElements.reduce((n, we) => n + we.functions.reduce((m, fn) => m + (fn.failures?.length || 0), 0), 0)} failures (incluye WE #2 original con ${weVistaOriginal.functions.reduce((m, fn) => m + (fn.failures?.length || 0), 0)} failures preservadas)`);

// ── Gate: runWithValidation ─────────────────────────────────────────────────
const result = await runWithValidation(
  [{ id: AMFE_ID, amfeNumber: amfe_number, productName: 'IP PAD Patagonia', before: docBefore, after: doc }],
  apply,
  async () => {
    await saveAmfe(sb, AMFE_ID, doc, { expectedAmfeNumber: amfe_number });
  }
);

if (result.blocked) {
  console.log('\nBLOQUEADO por validador. Revisar output arriba.');
  process.exit(1);
}

if (apply) {
  console.log('\nAMFE actualizado. Verificando...');
  const { doc: verify } = await readAmfe(sb, AMFE_ID);
  const ops40_42 = verify.operations.filter(op => ['40', '41', '42'].includes(String(op.opNumber || op.operationNumber)));
  console.log(`Verificacion: ${ops40_42.length} OPs encontradas en rango 40-42`);
  for (const op of ops40_42) {
    console.log(`  OP ${op.opNumber} ${op.name} — ${op.workElements?.length || 0} WEs`);
  }
}

finish(apply);
