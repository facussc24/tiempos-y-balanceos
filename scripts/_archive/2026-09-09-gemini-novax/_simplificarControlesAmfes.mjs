/**
 * _simplificarControlesAmfes.mjs
 *
 * Saneamiento y simplificación radical a lenguaje de planta natural (pedido por Fak):
 * - Erradica completamente cualquier mención a normas alemanas (VW 50180, TL 1010, VW 50106, VW 10500).
 * - Erradica completamente siglas teóricas o en inglés como CoA/CoC o D65.
 * - Erradica cualquier mención residual a ARB.
 * - Corrige modos de falla ("Flamabilidad fuera de lo exigido por TL 1010 VW" -> "Material no cumple requisito de inflamabilidad").
 * - Convierte todos los controles a lenguaje directo de taller ("simplista"):
 *     * Inspección visual contra patrón de color por lote
 *     * Medición con calibre digital por lote
 *     * Medición de ancho con cinta métrica por entrega
 *     * Pesaje en balanza por entrega
 *     * Verificación de certificado de inflamabilidad del proveedor
 *     * Verificación de etiqueta, remito y lote de entrega
 *     * Certificado del proveedor por lote
 *     * Procedimiento de recepción de materia prima
 *
 * Uso:
 *   node scripts/_simplificarControlesAmfes.mjs          (dry-run)
 *   node scripts/_simplificarControlesAmfes.mjs --apply  (aplica a Supabase)
 */

import fs from 'fs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

function limpiarCadena(txt) {
  if (!txt || typeof txt !== 'string') return txt;
  let s = txt;

  // Modos de falla
  s = s.replace(/Flamabilidad fuera de lo exigido por TL 1010 VW/gi, 'Material no cumple requisito de inflamabilidad');

  // Color / aspecto
  s = s.replace(/Inspección visual comparativa contra patrón de color y grano homologado bajo cabina de luz normalizada \(D65\) conforme a norma VW 50180 por lote de entrega/gi,
    'Inspección visual contra patrón de color por lote');
  s = s.replace(/Inspección visual comparativa de tono contra patrón de color homologado bajo cabina de luz por lote de entrega/gi,
    'Inspección visual contra patrón de color por lote');
  s = s.replace(/Inspección visual comparativa contra patrón de aspecto homologado por entrega/gi,
    'Inspección visual contra patrón de aspecto por lote');
  s = s.replace(/Inspección periódica de estado del muestrario patrón por Calidad bajo cabina de luz/gi,
    'Inspección periódica del muestrario patrón por Calidad');
  s = s.replace(/Inspección periódica de estado del muestrario patrón por Calidad/gi,
    'Inspección periódica del muestrario patrón por Calidad');

  // Dimensional / Calibre / Cinta / Balanza
  s = s.replace(/Medición dimensional y de espesor con calibre digital calibrado y cotejo de certificado de calidad por lote de entrega/gi,
    'Medición con calibre digital por lote');
  s = s.replace(/Medición dimensional con calibre digital calibrado sobre muestra por lote de entrega/gi,
    'Medición con calibre digital sobre muestra');
  s = s.replace(/Medición de ancho de bobina con cinta métrica metálica calibrada y cotejo contra remito de entrega/gi,
    'Medición de ancho con cinta métrica por entrega');
  s = s.replace(/Pesaje de muestra con balanza digital calibrada y verificación de certificado de entrega del proveedor/gi,
    'Pesaje en balanza por entrega');
  s = s.replace(/Control dimensional y de forma en calibre gabarit de control de recepción por muestreo de lote/gi,
    'Control dimensional con calibre gabarit por lote');
  s = s.replace(/Control dimensional con calibre gabarit de control de recepción por muestreo de entrega/gi,
    'Control dimensional con calibre gabarit por entrega');
  s = s.replace(/Control dimensional con calibre digital calibrado sobre muestra de producción según frecuencia operativa/gi,
    'Control con calibre por muestreo');
  s = s.replace(/Control con calibre gabarit de control de recepción por muestreo de entrega/gi,
    'Control dimensional con calibre gabarit por entrega');
  s = s.replace(/Control de planitud en calibre gabarit \(P-10\/I\)/gi,
    'Control de planitud con calibre gabarit');
  s = s.replace(/Control dimensional con calibre gabarit en recepcion/gi,
    'Control dimensional con calibre gabarit');

  // Inflamabilidad / Ensayos
  s = s.replace(/Verificación de ensayo de inflamabilidad en certificado de calidad del proveedor conforme a norma VW TL 1010 y ensayo periódico en cámara de combustión/gi,
    'Verificación de certificado de inflamabilidad del proveedor');
  s = s.replace(/Verificación de ensayo de inflamabilidad en certificado de calidad del proveedor conforme a norma VW TL 1010/gi,
    'Verificación de certificado de inflamabilidad del proveedor');
  s = s.replace(/Certificado de flamabilidad del proveedor\s*,?\s*por entrega/gi,
    'Verificación de certificado de inflamabilidad del proveedor');
  s = s.replace(/Verificación de certificado de conformidad del fabricante conforme a norma VW 50106 y especificación técnica por lote de entrega/gi,
    'Verificación de certificado del proveedor por lote');

  // Trazabilidad / Rótulo / Remito
  s = s.replace(/Verificación visual de rótulo, partida, lote y fecha de vencimiento contra remito comercial y registro de ingreso en sistema de gestión conforme a norma VW 10500/gi,
    'Verificación de etiqueta, remito y lote de entrega');
  s = s.replace(/Verificación visual de rótulo, partida, lote y fecha de vencimiento contra remito comercial y registro en sistema de gestión/gi,
    'Verificación de etiqueta, remito y lote de entrega');
  s = s.replace(/Verificación visual de etiqueta de identificación del material contra orden de compra y remito por lote de entrega/gi,
    'Verificación de etiqueta del material por lote');
  s = s.replace(/Verificación de código de artículo, lote y partida en etiqueta contra remito comercial/gi,
    'Verificación de código y lote en etiqueta');
  s = s.replace(/Verificación de remito de entrega en sistema de gestión y prueba funcional de engrampado en muestra de recepción/gi,
    'Prueba de engrampado sobre muestra');
  s = s.replace(/Control de recepcion en ARB y prueba funcional de carga con engrampadora/gi,
    'Prueba de engrampado sobre muestra');
  s = s.replace(/Conteo físico de unidades contra remito de entrega y registro en sistema de gestión/gi,
    'Conteo de piezas contra remito al recibir');
  s = s.replace(/Verificación de informe de control dimensional y certificado emitido por el proveedor por lote/gi,
    'Verificación de certificado del proveedor por lote');
  s = s.replace(/Control de recepción en sistema de gestión y prueba funcional de engrampado en muestra de recepción/gi,
    'Prueba de engrampado sobre muestra');

  // Prevención y Procedimientos
  s = s.replace(/Exigencia y verificación de Certificado de Calidad y Conformidad \(CoA\/CoC\) emitido por el proveedor por lote de entrega según especificación técnica/gi,
    'Certificado de calidad del proveedor por lote');
  s = s.replace(/Exigencia y verificación de Certificado de Calidad y Conformidad \(CoA\/CoC\) del proveedor por lote/gi,
    'Certificado de calidad del proveedor por lote');
  s = s.replace(/Procedimiento estandarizado de recepción e inspección de materias primas con almacenamiento identificado \(FIFO\)/gi,
    'Procedimiento de recepción de materia prima');
  s = s.replace(/Procedimiento operacional estandarizado de recepción e inspección de materias primas con almacenamiento identificado \(FIFO\)/gi,
    'Procedimiento de recepción de materia prima');
  s = s.replace(/Procedimiento operacional de recepción e inspección de materia prima/gi,
    'Procedimiento de recepción de materia prima');
  s = s.replace(/Control de ingeniería y emisión controlada de hojas de proceso vigentes y aprobadas en puesto de trabajo/gi,
    'Hojas de proceso controladas en el puesto');
  s = s.replace(/El sistema impide la emisión de ubicaciones hasta que todos los campos del ARB sean completados/gi,
    'Control de recepción antes de habilitar stock');
  s = s.replace(/El sistema de gestión obliga a registrar lote y código en recepción y verifica contra base de datos/gi,
    'Registro de lote y código en recepción');
  s = s.replace(/Validación informática en sistema de gestión que bloquea la habilitación de stock hasta verificar remito y certificado/gi,
    'Control de recepción antes de habilitar stock');
  s = s.replace(/Procedimiento operacional estándar que exige el registro informático obligatorio de ingreso/gi,
    'Procedimiento de recepción de materia prima');
  s = s.replace(/Programa de calibración metrológica anual y almacenamiento en estuche rígido protegido/gi,
    'Calibración periódica y almacenamiento en estuche');
  s = s.replace(/Verificación de cero y calibración con patrón patrón antes de cada turno/gi,
    'Verificación con patrón al inicio de turno');
  s = s.replace(/Verificación de cero y calibración con patrón antes de cada turno/gi,
    'Verificación con patrón al inicio de turno');
  s = s.replace(/Inspección visual del estado e integridad del embalaje y precinto de seguridad al ingreso en almacén/gi,
    'Inspección visual del estado del embalaje al recibir');
  s = s.replace(/Inspección visual del estado e integridad del rollo y su embalaje de protección al ingreso/gi,
    'Inspección visual del estado del rollo al recibir');
  s = s.replace(/Control de fecha de vencimiento y número de lote en rótulo del fabricante por entrega/gi,
    'Control de fecha de vencimiento y lote en rótulo');
  s = s.replace(/Inspección visual de aspecto físico y verificación de certificado de lote del fabricante por entrega/gi,
    'Inspección visual de aspecto y certificado de lote');
  s = s.replace(/Inspección visual de homogeneidad y ausencia de cristalización en tambor por recepción/gi,
    'Inspección visual de aspecto del producto al recibir');
  s = s.replace(/Inspección visual de dispersión y homogeneidad previa a la liberación para producción/gi,
    'Inspección visual de homogeneidad antes de usar');
  s = s.replace(/Inspección visual de cantidad de cabos, torsión y ausencia de nudos sobre muestra por lote/gi,
    'Inspección visual del hilo sobre muestra por lote');

  // Limpiezas genéricas de residuos
  s = s.replace(/\s*\(CoA\/CoC\)/gi, '');
  s = s.replace(/conforme a norma VW 50180/gi, '');
  s = s.replace(/conforme a norma VW TL 1010/gi, '');
  s = s.replace(/conforme a norma VW 50106/gi, '');
  s = s.replace(/conforme a norma VW 10500/gi, '');
  s = s.replace(/conforme Norma VW 50106/gi, '');
  s = s.replace(/conforme TL 1010 VW/gi, '');
  s = s.replace(/conforme VW 50180/gi, '');
  s = s.replace(/conforme VW 10500/gi, '');
  s = s.replace(/bajo cabina de luz normalizada \(D65\)/gi, '');
  s = s.replace(/bajo cabina de luz normalizada/gi, '');
  s = s.replace(/bajo cabina de luz/gi, '');
  s = s.replace(/en cámara de combustión/gi, '');
  s = s.replace(/según estándar VW/gi, 'según estándar de calidad');
  s = s.replace(/patrón patrón/gi, 'patrón');
  s = s.replace(/\s*,\s*anual/gi, '');

  // Limpieza de espacios y puntuación sobrante
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\s*,\s*$/g, '');
  s = s.replace(/\s*\.\s*$/g, '');

  return s.trim();
}

function limpiarDoc(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(limpiarDoc);
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (k === 'id') continue; // nunca tocar UUIDs
      if (typeof obj[k] === 'string') {
        obj[k] = limpiarCadena(obj[k]);
      } else {
        limpiarDoc(obj[k]);
      }
    }
  }
}

const AMFES = [
  { amfeNumber: 'AMFE-INS-PAT', file: 'tmp/amfe_ins_pat_live.json' },
  { amfeNumber: 'AMFE-ARM-PAT', file: 'tmp/amfe_arm_pat_live.json' },
  { amfeNumber: 'AMFE-TR-PAT', file: 'tmp/amfe_tr_pat_live.json' }
];

for (const { amfeNumber, file } of AMFES) {
  console.log(`\n======================================================`);
  console.log(`Simplificando textos en ${amfeNumber}...`);

  const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number')
    .eq('amfe_number', amfeNumber);
  if (error) throw error;

  const row = rows[0];
  const { doc } = await readAmfe(sb, row.id);

  limpiarDoc(doc);

  // Guardar copia local
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`  -> Guardado local en ${file}`);

  if (apply) {
    console.log(`  -> Aplicando a Supabase Live (id: ${row.id})...`);
    await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: amfeNumber });
    console.log(`  ✓ ${amfeNumber} actualizado en Supabase Live.`);
  } else {
    console.log(`  [DRY-RUN] Usa --apply para guardar en Supabase.`);
  }
}

finish({ apply, count: AMFES.length });
