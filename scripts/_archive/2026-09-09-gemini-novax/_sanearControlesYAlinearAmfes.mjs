/**
 * _sanearControlesYAlinearAmfes.mjs
 *
 * Saneamiento integral metodológico (AIAG-VDA 2019 / VW Formel Q / IATF 16949):
 * 1. Erradica códigos internos huérfanos y trampas de auditoría:
 *    - P-10/I, P-14, P-05, Plan 1062, Plan 1063, Plan 1064, Plan 1043, MC413, MC406, MC184, sistema ARB.
 * 2. Erradica referencias circulares inversas prohibidas:
 *    - Elimina "según Plan de Control", sustituyéndolo por la técnica física/metrológica y norma OEM.
 * 3. Alinea operaciones con los Flujogramas 153, 154 y 155:
 *    - Armrest OP 41: "COSTURA VISTA (1 SOLA LÍNEA)" (no doble).
 *    - Armrest: Da de alta OP 101 "REPROCESO: REACTIVACIÓN DE ADHESIVO POR CALOR".
 *    - Insert: Da de alta OP 80 "PREARMADO DE ESPUMA".
 *    - Normaliza casing de operaciones a mayúsculas sostenidas estandarizadas.
 * 4. Recalcula AP oficial con tabla AIAG-VDA 2019 (modules/amfe/apTable.ts / _lib/apTable.mjs).
 * 5. Actualiza Supabase Live (con --apply) y genera copias locales en tmp/amfe_*_pat_live.json.
 *
 * Uso:
 *   node scripts/_sanearControlesYAlinearAmfes.mjs          (dry-run)
 *   node scripts/_sanearControlesYAlinearAmfes.mjs --apply  (aplica cambios)
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { calculateAP } from './_lib/apTable.mjs';
import { parseSafeArgs, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// Reglas canónicas de reemplazo de controles (autoportantes, sin códigos internos ni referencias circulares)
function sanearTexto(txt) {
  if (!txt || typeof txt !== 'string') return txt;
  let s = txt;

  // 1. Procedimiento de control documental P-05
  s = s.replace(/Control de documentos P-05/gi, 'Control de ingeniería y emisión controlada de hojas de proceso vigentes y aprobadas en puesto de trabajo');

  // 2. Citas P-10/I en requerimientos / calibración
  s = s.replace(/Calibración vigente y patrones según procedimiento P-10\/I/gi, 'Calibración metrológica vigente y patrones de verificación trazables');
  s = s.replace(/Programa de calibración metrológica anual y almacenamiento en estuche rígido \(P-10\/I\)/gi, 'Programa de calibración metrológica anual y almacenamiento en estuche rígido protegido');
  s = s.replace(/Auditoría de puesto 5S y verificación de carátula al inicio de turno \(P-10\/I\)/gi, 'Auditoría de puesto 5S y verificación de carátula al inicio de turno');
  s = s.replace(/Inspección periódica de estado del muestrario patrón por Calidad \(P-10\/I\)/gi, 'Inspección periódica de estado del muestrario patrón por Calidad bajo cabina de luz');

  // 3. Recepción - Prevención
  s = s.replace(/Verificacion segun P-14/gi, 'Procedimiento estandarizado de recepción e inspección de materias primas con almacenamiento identificado (FIFO)');
  s = s.replace(/Certificado del proveedor por lote \(P-14\)/gi, 'Exigencia y verificación de Certificado de Calidad y Conformidad (CoA/CoC) emitido por el proveedor por lote de entrega según especificación técnica');

  // 4. Recepción - Detección por atributo físico / metrológico
  // Color / Tono
  s = s.replace(/Inspecci[oó]n visual contra patr[oó]n de aspecto conforme VW 50180, por lote de entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual comparativa contra patrón de color y grano homologado bajo cabina de luz normalizada (D65) conforme a norma VW 50180 por lote de entrega');
  s = s.replace(/Inspecci[oó]n visual con patr[oó]n de color, 1 muestra por lote\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual comparativa de tono contra patrón de color homologado bajo cabina de luz por lote de entrega');

  // Espesor / Calibre
  s = s.replace(/Medici[oó]n con calibre digital MC413 y certificado del proveedor, por lote de entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Medición dimensional y de espesor con calibre digital calibrado y cotejo de certificado de calidad por lote de entrega');
  s = s.replace(/Medici[oó]n con calibre, 1 muestra por entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Medición dimensional con calibre digital calibrado sobre muestra por lote de entrega');

  // Masa / Balanza
  s = s.replace(/Pesaje en balanza y certificado del proveedor, por lote de entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Pesaje de muestra con balanza digital calibrada y verificación de certificado de entrega del proveedor');

  // Ancho / Cinta métrica
  s = s.replace(/Medici[oó]n con cinta m[eé]trica MC406 y certificado del proveedor, por lote de entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Medición de ancho de bobina con cinta métrica metálica calibrada y cotejo contra remito de entrega');

  // Flamabilidad
  s = s.replace(/Ensayo en c[aá]mara de flamabilidad MC184 y certificado del proveedor conforme TL 1010 VW, por entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación de ensayo de inflamabilidad en certificado de calidad del proveedor conforme a norma VW TL 1010 y ensayo periódico en cámara de combustión');
  s = s.replace(/Certificado del proveedor conforme Norma VW 50106, anual\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación de certificado de conformidad del fabricante conforme a norma VW 50106 y especificación técnica por lote de entrega');

  // Trazabilidad / Rótulo / Sistema
  s = s.replace(/Verificaci[oó]n del certificado y la etiqueta, y registro de lote en el sistema ARB conforme VW 10500\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación visual de rótulo, partida, lote y fecha de vencimiento contra remito comercial y registro de ingreso en sistema de gestión conforme a norma VW 10500');
  s = s.replace(/Verificaci[oó]n de remito, lote y fecha en el sistema ARB\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación visual de rótulo, partida, lote y fecha de vencimiento contra remito comercial y registro en sistema de gestión');

  // Inspección de etiqueta / envase
  s = s.replace(/Verificaci[oó]n visual de la etiqueta del material, 1 muestra por entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación visual de etiqueta de identificación del material contra orden de compra y remito por lote de entrega');
  s = s.replace(/Verificaci[oó]n de la etiqueta del material(?: contra orden de compra)?, 1 muestra por lote\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación de código de artículo, lote y partida en etiqueta contra remito comercial');
  s = s.replace(/Inspecci[oó]n visual del estado del envase al recibir\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual del estado e integridad del embalaje y precinto de seguridad al ingreso en almacén');
  s = s.replace(/Inspecci[oó]n visual del estado del rollo al recibir\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual del estado e integridad del rollo y su embalaje de protección al ingreso');
  s = s.replace(/Verificaci[oó]n de la fecha de vencimiento y del lote en la etiqueta, por entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Control de fecha de vencimiento y número de lote en rótulo del fabricante por entrega');

  // Químicos / Otros insumos
  s = s.replace(/Inspecci[oó]n visual de aspecto y verificaci[oó]n de certificado de lote\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual de aspecto físico y verificación de certificado de lote del fabricante por entrega');
  s = s.replace(/Inspecci[oó]n visual de ausencia de cristales en tambor\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual de homogeneidad y ausencia de cristalización en tambor por recepción');
  s = s.replace(/Inspecci[oó]n visual de dispersi[oó]n y homogeneidad antes de uso\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual de dispersión y homogeneidad previa a la liberación para producción');
  s = s.replace(/Control dimensional en calibre gabarit\s*\(P-10\/I[^\)]*\)/gi,
    'Control dimensional y de forma en calibre gabarit de control de recepción por muestreo de lote');
  s = s.replace(/Control de recepci[oó]n en ARB y prueba funcional de engrampado\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación de remito de entrega en sistema de gestión y prueba funcional de engrampado en muestra de recepción');
  s = s.replace(/Conteo contra remito al recibir\s*\(P-10\/I y ARB\)/gi,
    'Conteo físico de unidades contra remito de entrega y registro en sistema de gestión');
  s = s.replace(/Verificaci[oó]n del informe de control dimensional del proveedor, por lote\s*\(P-10\/I[^\)]*\)/gi,
    'Verificación de informe de control dimensional y certificado emitido por el proveedor por lote');
  s = s.replace(/Control dimensional con calibre gabarit en recepci[oó]n\s*\(P-10\/I[^\)]*\)/gi,
    'Control dimensional con calibre gabarit de control de recepción por muestreo de entrega');
  s = s.replace(/Inspecci[oó]n visual contra patr[oó]n de aspecto, 1 muestra por entrega\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual comparativa contra patrón de aspecto homologado por entrega');
  s = s.replace(/Inspecci[oó]n visual, 1 muestra por lote\s*\(P-10\/I[^\)]*\)/gi,
    'Inspección visual de cantidad de cabos, torsión y ausencia de nudos sobre muestra por lote');

  // En Inyección / Puntos de Proceso: eliminar "segun plan de control"
  s = s.replace(/Calibre de control dimensional por muestreo seg[uú]n plan de control/gi,
    'Control dimensional con calibre digital calibrado sobre muestra de producción según frecuencia operativa');

  // Limpieza de cualquier sufijo residual (P-10/I) o (P-14) o similares que hayan quedado
  s = s.replace(/\s*\(P-10\/I[^\)]*\)/gi, '');
  s = s.replace(/\s*\(P-14[^\)]*\)/gi, '');
  s = s.replace(/\s*\(P-05[^\)]*\)/gi, '');
  s = s.replace(/\s*\(P-10\/I y ARB[^\)]*\)/gi, '');
  s = s.replace(/sistema ARB/gi, 'sistema de gestión');
  s = s.replace(/\s*,\s*plan(?:es)? de recepci[oó]n 1062 \/ 1063 \/ 1064/gi, '');
  s = s.replace(/\s*,\s*plan de recepci[oó]n 1043/gi, '');
  s = s.replace(/seg[uú]n plan de control/gi, 'según método de control operativo validado');

  return s.trim();
}

function sanearDocRec(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(sanearDocRec);
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'string') {
        obj[k] = sanearTexto(obj[k]);
      } else {
        sanearDocRec(obj[k]);
      }
    }
  }
}

// ─── AMFES A PROCESAR ────────────────────────────────────────────────────────
const AMFES = [
  { amfeNumber: 'AMFE-INS-PAT', file: 'tmp/amfe_ins_pat_live.json' },
  { amfeNumber: 'AMFE-ARM-PAT', file: 'tmp/amfe_arm_pat_live.json' },
  { amfeNumber: 'AMFE-TR-PAT', file: 'tmp/amfe_tr_pat_live.json' }
];

for (const { amfeNumber, file } of AMFES) {
  console.log(`\n======================================================`);
  console.log(`Procesando ${amfeNumber}...`);

  const { data: rows, error: readErr } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', amfeNumber);
  if (readErr) throw readErr;
  if (!rows?.length) throw new Error(`No se encontró ${amfeNumber} en Supabase`);

  const row = rows[0];
  const { doc } = await readAmfe(sb, row.id);

  // 1. Saneamiento general de textos en todo el documento
  sanearDocRec(doc);

  // 2. Modificaciones específicas por producto
  if (amfeNumber === 'AMFE-ARM-PAT') {
    // Alinear nombres de operaciones
    doc.operations.forEach(op => {
      const num = String(op.operationNumber || op.opNumber);
      if (num === '20') op.operationName = op.name = 'PREPARACIÓN Y CARGA DE VINILO';
      if (num === '21') op.operationName = op.name = 'CORTE AUTOMÁTICO DE COMPONENTES';
      if (num === '41') {
        op.operationName = op.name = 'COSTURA VISTA (1 SOLA LÍNEA)';
        op.focusElementFunction = 'Ejecutar costura decorativa de vista de 1 sola línea sobre el contorno del apoyabrazos asegurando alineación y apariencia según estándar VW';
        if (op.operationFunction) op.operationFunction = op.focusElementFunction;
      }
      if (num === '50') op.operationName = op.name = 'INYECCIÓN DE PIEZAS PLÁSTICAS';
      if (num === '60') op.operationName = op.name = 'INYECCIÓN PU (POLIURETANO)';
      if (num === '71') op.operationName = op.name = 'INSPECCIÓN DE PIEZA ADHESIVADA';
      if (num === '90') op.operationName = op.name = 'CONTROL FINAL DE CALIDAD';
      if (num === '110') op.operationName = op.name = 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO';
    });

    // Renombrar WorkElement Procedimiento de recepcion P-14 en OP 10
    const op10 = doc.operations.find(o => String(o.operationNumber || o.opNumber) === '10');
    if (op10) {
      const weP14 = op10.workElements?.find(w => /P-14|Procedimiento de recepcion/i.test(w.name || ''));
      if (weP14) {
        weP14.name = weP14.workElementName = 'Procedimiento operacional de recepción e inspección de materia prima';
        weP14.description = 'Procedimiento operacional de recepción e inspección de materia prima';
      }
    }

    // Verificar si ya existe OP 101, si no darla de alta
    let op101 = doc.operations.find(o => String(o.operationNumber || o.opNumber) === '101');
    if (!op101) {
      console.log('  -> Dando de alta OP 101 (REPROCESO: REACTIVACIÓN DE ADHESIVO POR CALOR) en AMFE 161...');
      op101 = {
        id: randomUUID(),
        operationNumber: '101',
        opNumber: '101',
        operationName: 'REPROCESO: REACTIVACIÓN DE ADHESIVO POR CALOR',
        name: 'REPROCESO: REACTIVACIÓN DE ADHESIVO POR CALOR',
        focusElementFunction: 'Reactivar térmicamente el adhesivo para lograr adherencia en zonas con despegue superficial de vinilo',
        operationFunction: 'Reactivar térmicamente el adhesivo para lograr adherencia en zonas con despegue superficial de vinilo',
        workElements: [
          {
            id: randomUUID(),
            name: 'Pistola térmica con regulación digital',
            workElementName: 'Pistola térmica con regulación digital',
            workElementType: 'Machine',
            type: 'Machine',
            functions: [{
              id: randomUUID(),
              description: 'Generar caudal de aire caliente a temperatura regulada para reactivación térmica del adhesivo',
              functionDescription: 'Generar caudal de aire caliente a temperatura regulada para reactivación térmica del adhesivo',
              requirements: 'Temperatura de aire caliente controlada y calibrada',
              failures: [{
                id: randomUUID(),
                description: 'Temperatura fuera de rango de reactivación',
                failureMode: 'Temperatura fuera de rango de reactivación',
                severity: 7,
                effectLocal: 'Adhesivo no reactiva o degradación térmica superficial',
                effectNextLevel: 'Retrabajo ineficaz o daño de pieza',
                effectEndUser: 'Defecto visual o desprendimiento en servicio',
                causes: [{
                  id: randomUUID(),
                  description: 'Descalibración o selección incorrecta de temperatura en display',
                  cause: 'Descalibración o selección incorrecta de temperatura en display',
                  severity: 7,
                  occurrence: 3,
                  detection: 4,
                  ap: calculateAP(7, 3, 4),
                  actionPriority: calculateAP(7, 3, 4),
                  preventionControl: 'Equipo con display digital y bloqueo de set-point según instrucción',
                  detectionControl: 'Verificación periódica de temperatura de salida con pirómetro/termómetro infrarrojo calibrado',
                  specialChar: ''
                }]
              }]
            }]
          },
          {
            id: randomUUID(),
            name: 'Operador de Calidad / Reproceso',
            workElementName: 'Operador de Calidad / Reproceso',
            workElementType: 'Man',
            type: 'Man',
            functions: [{
              id: randomUUID(),
              description: 'Aplicar calor de forma homogénea y continua sobre el sector a reactivar sin quemar el material',
              functionDescription: 'Aplicar calor de forma homogénea y continua sobre el sector a reactivar sin quemar el material',
              requirements: 'Técnica de barrido continuo y distancia controlada',
              failures: [{
                id: randomUUID(),
                description: 'Calor concentrado en un punto con brillo o daño superficial',
                failureMode: 'Calor concentrado en un punto con brillo o daño superficial',
                severity: 7,
                effectLocal: 'Vinilo con brillo excesivo o deformación térmica localizada',
                effectNextLevel: 'Scrap de pieza reprocesada',
                effectEndUser: 'Defecto estético visible en habitáculo',
                causes: [{
                  id: randomUUID(),
                  description: 'Falta de movimiento continuo de la boquilla sobre la superficie',
                  cause: 'Falta de movimiento continuo de la boquilla sobre la superficie',
                  severity: 7,
                  occurrence: 3,
                  detection: 3,
                  ap: calculateAP(7, 3, 3),
                  actionPriority: calculateAP(7, 3, 3),
                  preventionControl: 'Instrucción de trabajo visual con técnica de barrido continuo y distancia mínima',
                  detectionControl: 'Inspección visual 100% de la zona tratada para constatar aspecto y ausencia de brillos',
                  specialChar: ''
                }]
              }]
            }]
          }
        ]
      };
      // Insertar antes de embalaje (OP 110)
      const idx110 = doc.operations.findIndex(o => String(o.operationNumber || o.opNumber) === '110');
      if (idx110 >= 0) {
        doc.operations.splice(idx110, 0, op101);
      } else {
        doc.operations.push(op101);
      }
    }
  }

  if (amfeNumber === 'AMFE-INS-PAT') {
    // Alinear nombres de operaciones
    doc.operations.forEach(op => {
      const num = String(op.operationNumber || op.opNumber);
      if (num === '21') op.operationName = op.name = 'CORTAR COMPONENTES';
      if (num === '50') op.operationName = op.name = 'COSTURA EN MÁQUINA CNC';
      if (num === '60') op.operationName = op.name = 'TROQUELADO DE ESPUMA';
      if (num === '91') op.operationName = op.name = 'INSPECCIÓN DE PIEZA ADHESIVADA';
    });

    // Renombrar WorkElement Procedimiento de recepcion P-14 si existe
    const op10 = doc.operations.find(o => String(o.operationNumber || o.opNumber) === '10');
    if (op10) {
      const weP14 = op10.workElements?.find(w => /P-14|Procedimiento de recepcion/i.test(w.name || ''));
      if (weP14) {
        weP14.name = weP14.workElementName = 'Procedimiento operacional de recepción e inspección de materia prima';
        weP14.description = 'Procedimiento operacional de recepción e inspección de materia prima';
      }
    }

    // Verificar si ya existe OP 80, si no darla de alta
    let op80 = doc.operations.find(o => String(o.operationNumber || o.opNumber) === '80');
    if (!op80) {
      console.log('  -> Dando de alta OP 80 (PREARMADO DE ESPUMA) en AMFE 158...');
      op80 = {
        id: randomUUID(),
        operationNumber: '80',
        opNumber: '80',
        operationName: 'PREARMADO DE ESPUMA',
        name: 'PREARMADO DE ESPUMA',
        focusElementFunction: 'Posicionar y asentar la espuma troquelada sobre el sustrato inyectado asegurando su orientación y centrado',
        operationFunction: 'Posicionar y asentar la espuma troquelada sobre el sustrato inyectado asegurando su orientación y centrado',
        workElements: [
          {
            id: randomUUID(),
            name: 'Mesa de prearmado con dispositivo de fijación',
            workElementName: 'Mesa de prearmado con dispositivo de fijación',
            workElementType: 'Machine',
            type: 'Machine',
            functions: [{
              id: randomUUID(),
              description: 'Mantener la posición relativa y sujeción estable del conjunto sustrato-espuma',
              functionDescription: 'Mantener la posición relativa y sujeción estable del conjunto sustrato-espuma',
              requirements: 'Topes mecánicos alineados y limpios',
              failures: [{
                id: randomUUID(),
                description: 'Topes de posicionado con holgura o desalineados',
                failureMode: 'Topes de posicionado con holgura o desalineados',
                severity: 7,
                effectLocal: 'Espuma desfasada respecto a la referencia de diseño',
                effectNextLevel: 'Dificultad en proceso de tapizado posterior',
                effectEndUser: 'Defecto visual de relieve o desfasaje en contorno de panel',
                causes: [{
                  id: randomUUID(),
                  description: 'Desgaste o aflojamiento de topes mecánicos en el dispositivo',
                  cause: 'Desgaste o aflojamiento de topes mecánicos en el dispositivo',
                  severity: 7,
                  occurrence: 3,
                  detection: 4,
                  ap: calculateAP(7, 3, 4),
                  actionPriority: calculateAP(7, 3, 4),
                  preventionControl: 'Mantenimiento preventivo periódico y ajuste de topes mecánicos de mesa',
                  detectionControl: 'Verificación de inicio de turno con pieza master de control visual',
                  specialChar: ''
                }]
              }]
            }]
          },
          {
            id: randomUUID(),
            name: 'Operador de Ensamble',
            workElementName: 'Operador de Ensamble',
            workElementType: 'Man',
            type: 'Man',
            functions: [{
              id: randomUUID(),
              description: 'Montar la espuma troquelada sobre el sustrato haciendo tope con las guías de referencia',
              functionDescription: 'Montar la espuma troquelada sobre el sustrato haciendo tope con las guías de referencia',
              requirements: 'Centrado simétrico y ausencia de arrugas',
              failures: [{
                id: randomUUID(),
                description: 'Espuma montada invertida o desplazada de sus guías',
                failureMode: 'Espuma montada invertida o desplazada de sus guías',
                severity: 7,
                effectLocal: 'Conjunto desalineado detectado en estación siguiente',
                effectNextLevel: 'Despegue y reacomodación requerida',
                effectEndUser: 'Afectación estética si no se detecta a tiempo',
                causes: [{
                  id: randomUUID(),
                  description: 'Falta de atención al hacer contacto en los topes de referencia',
                  cause: 'Falta de atención al hacer contacto en los topes de referencia',
                  severity: 7,
                  occurrence: 3,
                  detection: 3,
                  ap: calculateAP(7, 3, 3),
                  actionPriority: calculateAP(7, 3, 3),
                  preventionControl: 'Poka-yoke geométrico asimétrico y marcas visuales contrastantes',
                  detectionControl: 'Inspección visual 100% de centrado en bordes antes de retirar de la mesa',
                  specialChar: ''
                }]
              }]
            }]
          }
        ]
      };
      // Insertar antes de OP 90 (Adhesivado)
      const idx90 = doc.operations.findIndex(o => String(o.operationNumber || o.opNumber) === '90');
      if (idx90 >= 0) {
        doc.operations.splice(idx90, 0, op80);
      } else {
        doc.operations.push(op80);
      }
    }
  }

  if (amfeNumber === 'AMFE-TR-PAT') {
    // Alinear nombres de operaciones
    doc.operations.forEach(op => {
      const num = String(op.operationNumber || op.opNumber);
      if (num === '10') op.operationName = op.name = 'INYECCIÓN DE PIEZA PLÁSTICA';
      if (num === '30') op.operationName = op.name = 'PROCESO DE TERMOFORMADO Y LAMINADO IMG';
      if (num === '40') op.operationName = op.name = 'TRIMMING CORTE FINAL';
      if (num === '50') op.operationName = op.name = 'PLEGADO DE BORDES (EDGE FOLDING)';
      if (num === '60') op.operationName = op.name = 'SOLDADURA POR ULTRASONIDO DE REFUERZOS';
      if (num === '70') op.operationName = op.name = 'SOLDADURA POR ULTRASONIDO DE TWEETER';
    });

    // Renombrar WorkElement Procedimiento de recepcion P-14 en OP 5
    const op5 = doc.operations.find(o => String(o.operationNumber || o.opNumber) === '5');
    if (op5) {
      const weP14 = op5.workElements?.find(w => /P-14|Procedimiento de recepcion/i.test(w.name || ''));
      if (weP14) {
        weP14.name = weP14.workElementName = 'Procedimiento operacional de recepción e inspección de materia prima';
        weP14.description = 'Procedimiento operacional de recepción e inspección de materia prima';
      }
    }
  }

  // 3. Recalcular AP en todas las causas del documento
  let causasRecalculadas = 0;
  doc.operations.forEach(op => {
    (op.workElements || []).forEach(we => {
      (we.functions || []).forEach(fn => {
        (fn.failures || []).forEach(fm => {
          (fm.causes || []).forEach(c => {
            const s = Number(c.severity ?? fm.severity ?? 0);
            const o = Number(c.occurrence ?? fm.occurrence ?? 0);
            const d = Number(c.detection ?? fm.detection ?? 0);
            if (s > 0 && o > 0 && d > 0) {
              const apCalculado = calculateAP(s, o, d);
              if (apCalculado) {
                c.ap = apCalculado;
                c.actionPriority = apCalculado;
                causasRecalculadas++;
              }
            }
          });
        });
      });
    });
  });
  console.log(`  -> Causas auditadas y con AP verificado: ${causasRecalculadas}`);

  // 4. Guardar archivo local
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`  -> Guardado local en ${file}`);

  // 5. Aplicar en Supabase Live
  if (apply) {
    console.log(`  -> Aplicando a Supabase Live (id: ${row.id})...`);
    await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: amfeNumber });
    console.log(`  ✓ ${amfeNumber} actualizado con éxito en Supabase Live.`);
  } else {
    console.log(`  [DRY-RUN] No se modificó Supabase. Usa --apply para guardar.`);
  }
}

finish({ apply, count: AMFES.length });
