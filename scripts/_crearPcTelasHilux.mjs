/**
 * _crearPcTelasHilux.mjs — rehace los planes de control de las telas Hilux de PWA (planas 581D y
 * termoformadas 582D) desde los AMFE 157 y 163 reescritos el 09/10/2026 (_crearAmfeTelasPlanas157.mjs
 * y _crearAmfeTelasTermoformadas163.mjs). Escribe cp_documents.data.items; el Excel en el formato de
 * Calidad lo arma scripts/_cpFormatoCalidadPwa.py.
 *
 * POR QUE: Manuel Meszaros (08/10/2026) pidio AMFE y plan de control actualizados por el reclamo de
 * agujas; la revision fila por fila del 09/10 contra los planes de Calidad encontro que los planes de
 * marzo tenian valores sin papel, responsables genericos y materiales faltantes. Fak, 09/10/2026:
 * *"usa los valores de la HO de temperatura... responsables usa los que Calidad define... corregi lo
 * de flamabilidad... si faltan materiales agregalos"*. En el plan de control los parametros son
 * obligatorios (Fak, 09/10/2026).
 *
 * DE DONDE SALE CADA VALOR (en el documento no se cita: queda aca)
 *   582D: plano ECN04 (monofelt 140 g/m2 min., blanco, BSDM0500 100 mm/min, forma ±3,0 mm, agujeros
 *     ±5%), plano felt asiento (1500 g/m2, t=5,0), plano 304883/84 (2,5±0,5 mm, Shore A >50), BOM del
 *     arb (ancho 1,7 m; tesa 52110), BOM del proyecto 09/07/2026 (aplix: 25 asiento, 23 respaldo; Fak:
 *     "el de la BOM porque la hizo Paulo"), HO-984 nuevas 02/07/2026 (horno 165-175 °C, 32 s;
 *     prensa: ciclo, numero de molde, seguros y barrera; ultrasonido 0,4 s y amperaje; refuerzos y
 *     aplix "cada operacion"), HO-984 anterior OP 90 (20 piezas por bolsa 900x600, etiqueta 100x60).
 *   581D: BOM del legajo y del arb (punzonado 140 g/m2, ancho 2 m; refuerzo 1000 g/m2 t=5 mm;
 *     refuerzo 250 g/m2; aplix 15x15 a 20x20 mm; cantidad de aplix por codigo), hojas de operaciones
 *     21-94xx (aguja 14 overlock y 16/18 recta; pieza patron; orificios 100%; cantidad de aplix al
 *     inicio y fin de turno), gama GE-251 (50 piezas por bolsa en 63-68, 25 en 69-75).
 *   Los dos: practica de Calidad para telas PWA, PC PWA.xlsx de Cecilia Rodriguez (camara MC184,
 *     balanza, cinta MC406, calibre MC413, una muestra por lote de entrega, P-10/I + ARB, reaccion
 *     P-14 en recepcion y P-09/I en proceso; hilos: tipo, color, numero metrico; aplix 0,8 ±0,1).
 *   Agujas: Manuel Meszaros 08/10/2026; tamaño de muestra TBD hasta que diga si es a cada plancha.
 *
 * Uso:  node scripts/_crearPcTelasHilux.mjs            (muestra)
 *       node scripts/_crearPcTelasHilux.mjs --apply    (escribe)
 */
import { randomUUID } from 'crypto';
import { connectSupabase, parseData, saveCp } from './_lib/amfeIo.mjs';

const APPLY = process.argv.includes('--apply');

const REC = 'Inspector de recepción de materiales';
const LAB = 'Laboratorio interno';
const OP = 'Operador de producción';
const INSP = 'Inspector de calidad';
const R_REC = 'Rechazar lote s/ P-14';
const R_PROC = 'Detener, separar y avisar al líder s/ P-09/I';
const LOTE = ['1 muestra', 'Por lote de entrega'];
const ARB = 'P-10/I / ARB';

// fila: [op, nombreOp, maquina, material, producto, proceso, sigla, especificacion, tecnica, tam, frec, metodo, resp, reaccion]
const fila = (op, nombre, maq, mat, prod, proc, sigla, esp, tec, tam, frec, met, resp, reac) => ({
  id: randomUUID(), processStepNumber: `OP ${op}`, processDescription: nombre, machineDeviceTool: maq,
  componentMaterial: mat, characteristicNumber: '', productCharacteristic: prod, processCharacteristic: proc,
  specialCharClass: sigla, classification: sigla, specialChar: sigla, specification: esp,
  evaluationTechnique: tec, sampleSize: tam, sampleFrequency: frec, controlMethod: met,
  reactionPlanOwner: resp, reactionPlan: reac, controlProcedure: '',
});
const recepcion = (nombre, mat, prod, esp, tec, sigla = '', resp = REC) => fila('10', nombre, '', mat, prod, '', sigla, esp, tec, LOTE[0], LOTE[1], ARB, resp, R_REC);
const agujasRec = (nombre, mat) => fila('10', nombre, '', mat, 'Presencia de agujas rotas', '', 'CC', 'Sin agujas ni fragmentos metálicos', 'Control táctil', 'TBD', 'Por lote de entrega', ARB, REC, R_REC);
const fuego = (nombre, mat, norma) => recepcion(nombre, mat, 'Inflamabilidad', `< 100 mm/min (${norma})`, 'Cámara de flamabilidad MC184', 'CC', LAB);

// ── 582D ────────────────────────────────────────────────────────────────────
const R10 = 'RECEPCION E INSPECCION DE MATERIA PRIMA';
const ITEMS_582D = [
  recepcion(R10, 'Punzonado 3180_1700_BCM', 'Peso', '≥ 140 g/m2', 'Balanza electrónica'),
  recepcion(R10, 'Punzonado 3180_1700_BCM', 'Ancho', '1700 mm', 'Cinta métrica MC406'),
  recepcion(R10, 'Punzonado 3180_1700_BCM', 'Color', 'Blanco', 'Visual / patrón'),
  fuego(R10, 'Punzonado 3180_1700_BCM', 'BSDM0500'),
  recepcion(R10, 'Fieltro 1500 g/m2', 'Peso', '1500 g/m2', 'Balanza electrónica'),
  recepcion(R10, 'Fieltro 1500 g/m2', 'Espesor', '5,0 mm', 'Medición de espesor'),
  fuego(R10, 'Fieltro 1500 g/m2', 'BSDM0500'),
  agujasRec(R10, 'Fieltro 1500 g/m2'),
  recepcion(R10, 'Tricapa 600 g/m2', 'Espesor', '2,5 ± 0,5 mm', 'Medición de espesor'),
  recepcion(R10, 'Tricapa 600 g/m2', 'Dureza', 'Shore A > 50 (JIS K 6253)', 'Certificado del proveedor'),
  agujasRec(R10, 'Tricapa 600 g/m2'),
  recepcion(R10, 'Aplix metal resin', 'Espesor', '0,8 ± 0,1 mm', 'Calibre vernier MC413'),
  recepcion(R10, 'Rollo adhesivo tesa 52110', 'Vencimiento', 'Vigente', 'Visual en etiqueta'),
  fila('20', 'CORTE DE TELAS EN MESA DE CORTE', 'Mesa de corte', '', 'Medida del blank', 'Programa de tizada', '', 'Conforme a mylar', 'Superposición con mylar', '1 pieza', 'Inicio de corte y tras intervención', 'Set-up de lanzamiento', OP, R_PROC),
  fila('21', 'CONTROL CON MYLAR', 'Mylar seat back / seat cushion', '', 'Medida del blank', '', '', 'Conforme a mylar', 'Superposición con mylar', '1 pieza', 'Inicio de corte y tras intervención', 'Autocontrol', OP, R_PROC),
  fila('30', 'CALENTAMIENTO EN HORNO', 'Horno', '', '', 'Temperatura de horno', '', '165 - 175 °C', 'Controlador de temperatura', '1', 'Inicio de turno / mantenimiento / corte de energía', 'Set-up de lanzamiento', OP, R_PROC),
  fila('30', 'CALENTAMIENTO EN HORNO', 'Horno', '', '', 'Tiempo de calentamiento', '', '32 s', 'Timer con alarma / cronómetro', '1', 'Inicio de turno / mantenimiento / corte de energía', 'Set-up de lanzamiento', OP, R_PROC),
  fila('40', 'TERMOFORMADO DE TELAS', 'Prensa de termoformado', '', '', 'Ciclo de prensa', '', '32 s', 'Visual + cronómetro', '1', 'Inicio de turno', 'Set-up de lanzamiento', OP, R_PROC),
  fila('40', 'TERMOFORMADO DE TELAS', 'Prensa de termoformado', '', '', 'Número de molde', '', 'Molde de la pieza en producción', 'Visual', '1', 'Inicio de turno', 'Set-up de lanzamiento', OP, R_PROC),
  fila('40', 'TERMOFORMADO DE TELAS', 'Prensa de termoformado', '', '', 'Seguros del molde y barrera', '', 'Operativos', 'Visual / manual', '1', 'Inicio de turno', 'Set-up de lanzamiento', OP, R_PROC),
  fila('40', 'TERMOFORMADO DE TELAS', 'Prensa de termoformado', '', 'Termoformado completo, sin quemaduras ni marcas', '', '', 'Conforme a pieza patrón', 'Visual + manual', '100%', 'Cada pieza', 'Autocontrol', OP, R_PROC),
  fila('50', 'CORTE LASER Y VERIFICACION DE TELAS', 'Robot de corte láser', '', 'Contorno y agujeros', 'Programa de corte', '', 'Forma ± 3,0 mm; agujeros ± 5%', 'Visual', '100%', 'Cada pieza', 'Autocontrol', OP, R_PROC),
  fila('51', 'RETRABAJO MANUAL DE CORTE', 'Tijera', '', 'Contorno corregido', '', '', 'Forma ± 3,0 mm', 'Visual, re-verificación en OP 50', '100%', 'Cada pieza retrabajada', 'Autocontrol', OP, R_PROC),
  fila('60', 'PLEGADO DE PESTAÑAS', 'Dispositivo de plegado', '', 'Pestaña plegada sobre la línea de pliegue', '', '', 'Conforme a pieza patrón', 'Visual', 'TBD', 'TBD', 'Autocontrol', OP, R_PROC),
  fila('61', 'ULTRASONIDO', 'Soldadora por ultrasonido', '', '', 'Tiempo de soldadura', '', '0,4 s', 'Seteo por pines', '1', 'Inicio de turno', 'Set-up de lanzamiento', OP, R_PROC),
  fila('61', 'ULTRASONIDO', 'Soldadora por ultrasonido', '', '', 'Amperaje de soldadura', '', 'Dentro de rango del indicador', 'Indicador de aguja', '1', 'Inicio de turno', 'Set-up de lanzamiento', OP, R_PROC),
  fila('70', 'ADHESIVADO DE REFUERZOS', '', 'Rollo adhesivo tesa 52110', 'Adhesivo sin zonas sin cubrir ni burbujas', '', '', 'Plancha cubierta completa', 'Visual', '100%', 'Cada plancha', 'Autocontrol', OP, R_PROC),
  fila('80', 'TROQUELADO DE REFUERZOS Y APLIX', 'Troqueladora', '', 'Medida del refuerzo', '', '', 'Conforme a plano (65 x 20 mm asiento; 106 x 48 mm lateral)', 'Visual', '1 pieza', 'Primer golpe', 'Autocontrol', OP, R_PROC),
  fila('80', 'TROQUELADO DE REFUERZOS Y APLIX', 'Troqueladora', '', 'Presencia de agujas rotas en el fieltro', '', 'CC', 'Sin agujas ni fragmentos metálicos', 'Control táctil', 'TBD', 'TBD', 'Autocontrol', OP, R_PROC),
  fila('90', 'APLICACION DE REFUERZOS', 'Útil de montaje con pines', '', 'Refuerzo correcto', '', '', 'Seat cushion: 2 x 30-9210; seat back: 1 x 30-2909', 'Visual', '100%', 'Cada operación', 'Autocontrol', OP, R_PROC),
  fila('90', 'APLICACION DE REFUERZOS', 'Útil de montaje con pines', '', 'Sin delaminación y con adherencia total', '', '', 'Refuerzo pegado en toda su superficie', 'Visual', '100%', 'Cada operación', 'Autocontrol', OP, R_PROC),
  fila('90', 'APLICACION DE REFUERZOS', 'Útil de montaje con pines', '', 'Agujeros sin obturar', '', '', 'Agujeros de tela y refuerzo libres', 'Manual', '100%', 'Cada operación', 'Autocontrol', OP, R_PROC),
  fila('100', 'APLICACION DE APLIX', '', 'Aplix metal resin', 'Cantidad y posición de aplix', '', '', 'Seat cushion: 25; seat back: 23; agujeros de referencia cubiertos', 'Visual', '100%', 'Cada operación', 'Autocontrol', OP, R_PROC),
  fila('100', 'APLICACION DE APLIX', '', '', 'Agujeros de indexación', '', '', 'Sin cubrir', 'Visual', '100%', 'Cada operación', 'Autocontrol', OP, R_PROC),
  fila('110', 'CONTROL FINAL DE CALIDAD', '', '', 'Forma, refuerzos, aplix y agujeros', '', '', 'Forma ± 3,0 mm; conforme a pieza patrón', 'Visual', '100%', 'Cada pieza', 'Inspección final', INSP, R_PROC),
  fila('111', 'REPROCESO: REUBICACION DE APLIX', '', 'Aplix metal resin', 'Aplix reubicado y adherido', '', '', 'Sobre su agujero de referencia', 'Visual, re-verificación en OP 110', '100%', 'Cada pieza reprocesada', 'Autocontrol', OP, R_PROC),
  fila('120', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', '', 'Bolsa 60 x 90 / etiqueta 100 x 60', 'Cantidad por bolsa', '', '', '20 piezas', 'Conteo visual', '1 bolsa', 'Cada bolsa', 'Registro de control', OP, 'Corregir cantidad s/ P-09/I'),
  fila('120', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', '', '', 'Identificación', '', '', 'Etiqueta 100 x 60 con datos completos', 'Visual', '1 bolsa', 'Cada bolsa', 'Autocontrol', OP, 'Corregir etiqueta s/ P-09/I'),
];

// ── 581D ────────────────────────────────────────────────────────────────────
const P10 = 'RECEPCION DE MATERIALES';
const ITEMS_581D = [
  recepcion(P10, 'Punzonado PES 110 + TNT PP 30', 'Peso', '140 g/m2 ± 10%', 'Balanza electrónica'),
  recepcion(P10, 'Punzonado PES 110 + TNT PP 30', 'Ancho', '2000 ± 20 mm', 'Cinta métrica MC406'),
  recepcion(P10, 'Punzonado PES 110 + TNT PP 30', 'Color', 'Blanco', 'Visual / patrón'),
  fuego(P10, 'Punzonado PES 110 + TNT PP 30', 'norma PWA'),
  recepcion(P10, 'Hilo Caimán 120', 'Tipo, color y número métrico', 'Fibra cortada, blanco, 40/2, 100% spun poliéster', 'Visual en etiqueta / patrón'),
  recepcion(P10, 'Hilo poliéster texturizado', 'Tipo, color y número métrico', 'Texturizado, blanco (51), 150/1, 100% poliéster', 'Visual en etiqueta / patrón'),
  recepcion(P10, 'Aplix metal resin', 'Espesor', '0,8 ± 0,1 mm', 'Calibre vernier MC413'),
  recepcion(P10, 'Fieltro 1000 g/m2 (21-9467/68)', 'Peso y espesor', '1000 g/m2; 5 mm', 'Balanza electrónica / medición de espesor'),
  fuego(P10, 'Fieltro 1000 g/m2 (21-9467/68)', 'norma PWA'),
  agujasRec(P10, 'Fieltro 1000 g/m2 (21-9467/68)'),
  recepcion(P10, 'Punzonado 250 g/m2 (21-9469 a 9475)', 'Peso', '250 g/m2', 'Balanza electrónica'),
  fuego(P10, 'Punzonado 250 g/m2 (21-9469 a 9475)', 'norma PWA'),
  agujasRec(P10, 'Punzonado 250 g/m2 (21-9469 a 9475)'),
  fila('15', 'PREPARACION DE CORTE', 'Mesa de corte', '', 'Lado de la tela', '', '', 'Cara lisa del lado definido por referencia', 'Visual / pieza patrón', '1 pieza', 'Inicio de lote y cambio de referencia', 'Autocontrol', OP, R_PROC),
  fila('15', 'PREPARACION DE CORTE', 'Mesa de corte', '', 'Tendido', '', '', 'Sin arrugas, TNT sobre las líneas de referencia', 'Visual', '100%', 'Cada tendido', 'Autocontrol', OP, R_PROC),
  fila('20', 'CORTE DE TELA', 'Cortadora automática', '', 'Medida de la pieza', 'Programa de corte por código', '', 'Conforme a mylar', 'Superposición con mylar', '1 pieza', 'Inicio de turno y tras intervención', 'Set-up de lanzamiento', OP, R_PROC),
  fila('20', 'CORTE DE TELA', 'Cortadora automática', '', 'Orificios guía', '', '', 'Presentes y en posición', 'Visual', '100%', 'Cada pieza', 'Registro de control', OP, R_PROC),
  fila('30', 'TROQUELADO DE APLIX', 'Troqueladora continua', 'Aplix metal resin', 'Medida del aplix', '', '', '15 x 15 a 20 x 20 mm', 'Calibre vernier MC413', '1 pieza', 'Inicio de turno y tras intervención', 'Set-up de lanzamiento', OP, R_PROC),
  fila('40', 'TROQUELADO DE REFUERZO', 'Troquel de refuerzos', '', 'Medida del refuerzo', '', '', 'Conforme a plano', 'Visual', '1 pieza', 'Primer golpe', 'Autocontrol', OP, R_PROC),
  fila('40', 'TROQUELADO DE REFUERZO', 'Troquel de refuerzos', '', 'Presencia de agujas rotas en el fieltro', '', 'CC', 'Sin agujas ni fragmentos metálicos', 'Control táctil', 'TBD', 'TBD', 'Autocontrol', OP, R_PROC),
  fila('50', 'COSTURA RECTA / OVERLOCK', 'Máquina recta / overlock', '', '', 'Aguja', '', 'N° 14 overlock; N° 16/18 recta', 'Visual', '1', 'Inicio de turno y cambio de versión', 'Set-up', OP, R_PROC),
  fila('50', 'COSTURA RECTA / OVERLOCK', 'Máquina recta / overlock', '', 'Costura conforme', '', '', 'Conforme a pieza patrón, del lado liso', 'Visual / pieza patrón', '1 pieza', 'Inicio de turno, cambio de versión y tras mantenimiento', 'Set-up', INSP, R_PROC),
  fila('50', 'COSTURA RECTA / OVERLOCK', 'Máquina recta / overlock', '', 'Fragmentos de aguja rota', '', 'CC', 'Sin fragmentos de aguja en la pieza', 'TBD', 'TBD', 'TBD', 'TBD', OP, R_PROC),
  fila('60', 'APLICACION DE APLIX', '', 'Aplix metal resin', 'Cantidad de aplix', '', '', '63-66: 11; 67/68: 5; 69/70: 39; 71/72: 42; 74/75: 34', 'Visual', '1', 'Inicio y fin de turno', 'Registro de control', OP, R_PROC),
  fila('60', 'APLICACION DE APLIX', '', '', 'Posición del aplix', '', '', 'Sobre los orificios guía', 'Visual / pieza patrón', '1', 'Inicio y fin de turno', 'Registro de control', OP, R_PROC),
  fila('70', 'INSPECCION FINAL', 'Puesto con luz LED', '', 'Costuras, aplix y refuerzos', '', '', 'Conforme a pieza patrón', 'Visual', '100%', 'Cada pieza', 'Inspección final', INSP, R_PROC),
  fila('70', 'INSPECCION FINAL', '', '', 'Adherencia del aplix', '', '', 'Sin aplix flojo', 'Prueba de tirón manual', 'TBD', 'TBD', 'Inspección final', INSP, R_PROC),
  fila('80', 'EMBALAJE', '', 'Bolsa / etiqueta 100 x 60', 'Cantidad por bolsa', '', '', '21-9463 a 9468: 50 piezas; 21-9469 a 9475: 25 piezas', 'Conteo visual', '1 bolsa', 'Cada bolsa', 'Registro de control', OP, 'Corregir cantidad s/ P-09/I'),
  fila('80', 'EMBALAJE', '', '', 'Identificación', '', '', 'Etiqueta 100 x 60 con el código de la pieza', 'Visual', '1 bolsa', 'Cada bolsa', 'Autocontrol', OP, 'Corregir etiqueta s/ P-09/I'),
];

const PLANES = [
  { id: '332bcdda-a7d8-4d28-a41d-3961472ccb0e', nombre: 'PWA/HILUX/TELAS_PLANAS', items: ITEMS_581D,
    header: { partNumber: '21-9463 / 21-9464 / 21-9465 / 21-9466 / 21-9467 / 21-9468 / 21-9469 / 21-9470 / 21-9471 / 21-9472 / 21-9474 / 21-9475', partName: 'Telas planas Hilux 581D' } },
  { id: '85fd046d-a3bd-4de1-a9f9-d2fd51466999', nombre: 'PWA/HILUX/TELAS_TERMOFORMADAS', items: ITEMS_582D,
    header: { partNumber: '21-9640 / 21-9641 / 21-9642 / 21-9643 / 304883 / 304884', partName: 'Telas termoformadas Hilux 582D' } },
];

const sb = await connectSupabase();
for (const p of PLANES) {
  const { data: fila0, error } = await sb.from('cp_documents').select('project_name,data').eq('id', p.id).single();
  if (error) throw error;
  if (fila0.project_name !== p.nombre) throw new Error(`esperaba ${p.nombre}`);
  const doc = parseData(fila0.data);
  const nuevo = { ...doc, header: { ...doc.header, ...p.header, rev: 'A', revision: 'A' }, items: p.items };
  const tbd = p.items.filter((i) => /TBD/.test(JSON.stringify(i))).map((i) => `${i.processStepNumber} ${i.productCharacteristic || i.processCharacteristic}`);
  console.log(`\n${p.nombre}: ${doc.items.length} -> ${p.items.length} filas · CC ${p.items.filter((i) => i.specialCharClass === 'CC').length} · con TBD: ${tbd.join(' | ')}`);
  for (const i of p.items) console.log(`  ${i.processStepNumber.padEnd(7)} ${(i.productCharacteristic || i.processCharacteristic).padEnd(44)} ${i.specialCharClass.padEnd(3)} ${i.specification}`);
  if (APPLY) {
    await saveCp(sb, p.id, nuevo, { extraFields: { item_count: p.items.length } });
    const { data: v } = await sb.from('cp_documents').select('data').eq('id', p.id).single();
    console.log(`  guardado: ${parseData(v.data).items.length} filas`);
  }
}
process.exit(0);
