/**
 * _crearAmfeTelasPlanas157.mjs — AMFE de proceso 157 de las TELAS PLANAS PWA Hilux (proyecto 581D):
 * 21-9463 a 21-9472, 21-9474 y 21-9475. Reescribe el AMFE-1 de la base para que siga al flujograma
 * 150 Rev B-1 que mando Pablo Gamboa el 07/10/2026, y deja UN solo AMFE 157 (habia dos: el de la base
 * y el Rev.B-1 del equipo de Paulo, en el legajo).
 *
 * POR QUE: Pablo, 07/10/2026: *"te anexo correcciones correspondientes a telas lisas de PWA, solo
 * faltaria agregar la op de troquelar refuerzos al AMFE para unificar todo"*. Fak, 09/10/2026: *"si
 * dale hace todo"*, con el nuestro como base. Reclamo PWA del 20/08/2026: el fieltro de 1000 g/m2
 * de Textil Valerio (FIEL31000MUL) va en 21-9467/68 (BOM del arb).
 *
 * DE DONDE SALE CADA DATO (relevado el 09/10/2026)
 *   - Secuencia: flujograma 150 Rev B-1 (PDF de Pablo; sin JSON en el repo): 10 recepcion, 15
 *     preparacion de corte, 20 corte, 30 troquelado de aplix, 40 troquelado de refuerzo, 50 costura
 *     recta / overlock, 60 aplicacion de aplix, 70 inspeccion final, 80 embalaje. El flujograma dice
 *     "CORTE DE VINILO Y TELA" en la 20: la pieza no tiene vinilo (BOM); el AMFE dice "CORTE DE TELA"
 *     y la diferencia se le informa a Fak.
 *   - Materiales: BOM del arb (export 08/10/2026) y BOM del legajo (Estructura Producto Rev. A):
 *     punzonado PES 110 + TNT PP 30 (140 g/m2), hilos Caiman 120 y texturizado, aplix metal resin
 *     (15x15 a 20x20 mm), refuerzo 1000 g/m2 (9467/68) y 250 g/m2 (9469-75).
 *   - 15: informe de TryOut del 25/03/2026 (cara lisa / felpuda invertida) y revision del AMFE Rev.B-1
 *     del 25/03 (P. Gamboa).
 *   - 20/30/50/60/70/80: AMFE Rev.B-1 (troqueladora continua de aplix, cuchilla, tolerancia de corte,
 *     tiron manual e inspeccion 100% en el control final), hojas de operaciones 21-94xx (orificios
 *     guia del aplix, aguja 14 overlock y 16/18 recta, pieza patron al inicio de turno, costura del
 *     lado liso, cantidad de aplix por codigo), gama de embalaje GE-251 Rev.A.
 *   - Inflamabilidad: practica de Calidad para telas PWA (camara MC184, una muestra por lote).
 *   - Agujas: mensaje de Manuel Meszaros (08/10/2026) y D7 del 8D (F. Santoro, 15/10/2026).
 *
 * LO QUE NO TIENE PAPEL Y POR ESO NO SE DECLARA COMO CONTROL
 * Hoja de operaciones de recepcion, preparacion de corte, corte, troquelados e inspeccion final;
 * metodo de la prueba de tiron (fuerza y muestreo); maquina del troquelado de refuerzo.
 *
 * SIGLAS: CC donde la S es 9 o 10: inflamabilidad (S9), agujas de punzonado y fragmento de aguja de
 * costura (S10, lesion del ocupante; criterio decidido con Fak el 09/10/2026). Sin SC: las del AMFE
 * anterior tenian O < 4 o S fuera de 5-8 (caracteristicas-especiales.md).
 *
 * Uso:  node scripts/_crearAmfeTelasPlanas157.mjs            (arma, valida y muestra)
 *       node scripts/_crearAmfeTelasPlanas157.mjs --apply    (escribe en Supabase)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { validateAmfeDoc, printIssues } from './_lib/amfeValidator.mjs';
import { crearConstructores, chequeosDeAutoria, leerBomDelArb, materialesContraBom, sinAcentos } from './_lib/amfeAutoria.mjs';

const APPLY = process.argv.includes('--apply');
const ID = '57011560-d4c1-4a8a-83f0-ed37a2bab1d5';
const AMFE_KEY = 'AMFE-1';
const FECHA = '09/10/2026';
const CODIGOS = ['21-9463', '21-9464', '21-9465', '21-9466', '21-9467', '21-9468', '21-9469', '21-9470', '21-9471', '21-9472', '21-9474', '21-9475'];

const OPS_FLUJOGRAMA = [
  ['10', 'RECEPCION DE MATERIALES'], ['15', 'PREPARACION DE CORTE'], ['20', 'CORTE DE TELA'],
  ['30', 'TROQUELADO DE APLIX'], ['40', 'TROQUELADO DE REFUERZO'], ['50', 'COSTURA RECTA / OVERLOCK'],
  ['60', 'APLICACION DE APLIX'], ['70', 'INSPECCION FINAL'], ['80', 'EMBALAJE'],
];

const FOCO = 'Funcion Interna: Entregar telas planas cosidas, con refuerzos y aplix, sin cuerpos extraños, conformes al plano'
  + ' / Funcion del Cliente: Permitir el espumado y armado del asiento en PWA sin retrabajo'
  + ' / Funcion del Usuario Final: Asiento sin deformaciones y con la inflamabilidad exigida';
const { causa, falla, funcion, we, operacion } = crearConstructores({ prefijo: 'tp157', foco: FOCO });

const SIN_PREV = 'Sin control preventivo';
const SIN_DET = 'Sin control de deteccion';
const HO = 'Hoja de operaciones del puesto';
const OPERARIO = 'Operarios del sector con practica';
const O_CONDUCTA = 7;
const CERT = 'Certificado del proveedor por lote';
const O_CERT = 5;
// Materiales que las telas de SERIE de PWA usan hace años con los mismos codigos (AMFE 159/160 y
// PC PWA.xlsx de Calidad: punzonado PES 110 + TNT PP 30, hilos 120 y 150/1, aplix metal resin):
// P2 O=3, "probado en serie". Los refuerzos de fieltro son del proyecto: O=5.
const CERT_SERIE = 'Certificado del proveedor por lote, material de serie';
const O_SERIE = 3;
const PATRON = 'Pieza patron al inicio de turno y cambio de version';
const VISUAL_FINAL = 'Inspeccion visual 100% en la inspeccion final';
const cc = (c) => ({ ...c, specialChar: 'CC' });
const ACCION_8D = {
  preventionAction: 'Actualizacion del AMFE del proveedor del fieltro por el reclamo PWA 20/08/2026',
  responsible: 'F. Santoro', targetDate: '15/10/2026',
};

const EF_AGUJA = { s: 10, local: 'Riesgo de lesion del operario al manipular el material', next: 'Riesgo de lesion del operario de PWA; reclamo de cliente', end: 'Aguja dentro del asiento: riesgo de lesion al ocupante' };
const EF_FUEGO = { s: 9, local: 'Material sin evidencia de cumplir la norma de inflamabilidad', next: 'Bloqueo del lote en PWA', end: 'Incumplimiento del requisito legal de inflamabilidad del asiento' };
const EF_SCRAP = { s: 7, local: 'Material o pieza rechazada en el puesto, se genera scrap', next: 'Reposicion y atraso del lote', end: 'Sin efecto en el vehiculo: la pieza no sale de planta' };
const EF_MEDIDA = { s: 7, local: 'Pieza fuera de medida, se scrapea', next: 'Pieza que no asienta en el molde de espumado de PWA', end: 'Asiento con deformacion o arruga' };
const EF_ORIFICIOS = { s: 7, local: 'Pieza sin los orificios guia en su lugar', next: 'Aplix fuera de lugar: la tela no se fija en el molde de PWA', end: 'Funda desplazada en el asiento' };
const EF_APLIX = { s: 7, local: 'Aplix faltante, corrido o flojo', next: 'Tela que no se fija en el molde de PWA: rechazo', end: 'Funda desplazada en el asiento' };
const EF_COSTURA = { s: 7, local: 'Costura abierta o fuera de posicion, se scrapea', next: 'Pieza que se abre en el espumado de PWA', end: 'Asiento con costura abierta o deformacion' };
const EF_REFUERZO = { s: 7, local: 'Refuerzo faltante, corrido o fuera de medida', next: 'Rechazo y clasificacion en PWA', end: 'Asiento sin el refuerzo en su lugar: deformacion en el uso' };
const EF_CARA = { s: 6, local: 'Pieza con la cara felpuda hacia afuera', next: 'Posible clasificacion de piezas en PWA', end: 'Aspecto no conforme del asiento' };
const EF_ESCAPE = { s: 7, local: 'Pieza no conforme embalada como conforme', next: 'Rechazo y clasificacion de piezas en PWA', end: 'Asiento con deformacion o funda desplazada' };
const EF_CANTIDAD = { s: 6, local: 'Bolsa con cantidad distinta de la definida', next: 'Faltante en la recepcion de PWA', end: 'Sin efecto en el vehiculo' };
const EF_MEZCLA = { s: 6, local: 'Bolsa con piezas de otro codigo', next: 'Pieza equivocada en la linea de PWA: clasificacion', end: 'Sin efecto en el vehiculo' };

// ── OP 10 ────────────────────────────────────────────────────────────────────
const agujas = (material) => falla(`Presencia de agujas rotas en ${material} (cuerpo extraño metalico)`, EF_AGUJA, [
  cc({ ...causa('Agujas del punzonado del proveedor quebradas dentro del material', SIN_PREV, 10,
    'Control tactil de presencia de agujas en recepcion y en troquelado', 9), ...ACCION_8D }),
]);
const fuego = (nombre) => falla(`${nombre} fuera de norma de inflamabilidad`, EF_FUEGO, [
  cc(causa('Lote del proveedor fuera de especificacion', CERT, O_CERT, 'Ensayo en camara MC184, 1 muestra por lote', 9)),
]);
const OP10 = operacion('10', 'RECEPCION DE MATERIALES',
  'Recibir, inspeccionar y liberar tela, hilos, aplix y refuerzos antes de usarlos', [
    we('Material', 'Punzonado PES 110 + TNT PP 30 blanco', [
      funcion('Proveer tela con el gramaje, el ancho y la inflamabilidad especificados', '', [
        falla('Tela fuera de norma de inflamabilidad', EF_FUEGO, [
          cc(causa('Lote del proveedor fuera de especificacion', CERT_SERIE, O_SERIE, 'Ensayo en camara MC184, 1 muestra por lote', 9)),
        ]),
        falla('Gramaje o ancho de la tela fuera de especificacion', EF_MEDIDA, [
          causa('Lote del proveedor fuera de tolerancia', CERT_SERIE, O_SERIE, 'Pesada y medicion de ancho de muestra, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Hilo Caiman poliester 120 blanco', [
      funcion('Proveer el hilo de union con titulo y color especificados', '', [
        falla('Hilo de otro titulo o color', EF_COSTURA, [
          causa('Lote del proveedor equivocado', CERT_SERIE, O_SERIE, 'Verificacion visual de etiqueta y color, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Hilo poliester texturizado blanco', [
      funcion('Proveer el hilo de overlock con titulo y color especificados', '', [
        falla('Hilo texturizado de otro titulo o color', EF_COSTURA, [
          causa('Lote del proveedor equivocado', CERT_SERIE, O_SERIE, 'Verificacion visual de etiqueta y color, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Aplix metal resin APLIX-A999R8395', [
      funcion('Proveer aplix con espesor y agarre especificados', '', [
        falla('Aplix con espesor o agarre fuera de especificacion', EF_APLIX, [
          causa('Lote del proveedor fuera de tolerancia', CERT_SERIE, O_SERIE, 'Control de espesor con calibre MC413, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Refuerzo de fieltro 1000 g/m2 FIEL31000MUL', [
      funcion('Proveer fieltro con el espesor del plano, sin cuerpos extraños', '', [
        agujas('el fieltro'),
        fuego('Fieltro'),
        falla('Espesor o gramaje del fieltro fuera de plano', EF_REFUERZO, [
          causa('Lote del proveedor fuera de tolerancia', CERT, O_CERT, 'Pesada y medicion de espesor de muestra, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Refuerzo punzonado 250 g/m2', [
      funcion('Proveer punzonado con el gramaje del plano, sin cuerpos extraños', '', [
        agujas('el punzonado'),
        fuego('Refuerzo de punzonado'),
      ]),
    ]),
    we('Man', 'Inspector de recepcion de materiales', [
      funcion('Inspeccionar y liberar el material segun su plan de recepcion', '', [
        falla('Material no liberado pasa a produccion', EF_FUEGO, [
          causa('Material sin inspeccionar retirado del sector de recepcion', 'Sector de recepcion separado e identificado', 5, 'Verificacion de identificacion al retirar material', 9),
        ]),
      ]),
    ]),
  ]);

// ── OP 15 / 20 ───────────────────────────────────────────────────────────────
const OP15 = operacion('15', 'PREPARACION DE CORTE',
  'Tender la tela del lado correcto, alineada y sin arrugas, segun la tizada', [
    we('Man', 'Operador de produccion', [
      funcion('Tender la tela con la cara lisa del lado definido', '', [
        falla('Tela tendida con la cara felpuda del lado equivocado', EF_CARA, [
          causa('Cara lisa y felpuda dificiles de distinguir', 'Ayuda visual con el lado correcto por referencia', 5, 'Control visual con pieza patron despues del corte', 9),
        ]),
        falla('Tela tendida con arrugas o desplazada', EF_SCRAP, [
          causa('TNT desplazado respecto de las lineas de referencia', OPERARIO, O_CONDUCTA, 'Control visual de las perforaciones despues del corte', 8),
        ]),
      ]),
    ]),
  ]);

const OP20 = operacion('20', 'CORTE DE TELA',
  'Cortar las piezas con la medida del plano y los orificios guia del aplix', [
    we('Machine', 'Cortadora automatica', [
      funcion('Cortar las piezas y los orificios segun el programa de cada codigo', '', [
        falla('Pieza fuera de la tolerancia de medida', EF_MEDIDA, [
          causa('Programa de corte de otro codigo', 'Programa de corte por codigo en el set-up', 5, 'Control con mylar de la primera pieza', 9),
          causa('Cuchilla desgastada', 'Cambio de cuchilla por desgaste', 5, 'Control con mylar de la primera pieza', 9),
        ]),
        falla('Orificio guia faltante o corrido', EF_ORIFICIOS, [
          causa('Programa de corte de otro codigo', 'Programa de corte por codigo en el set-up', 5, 'Control visual de orificios en cada pieza', 8),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Cargar el material sin pliegues y retirar las piezas', '', [
        falla('Pieza cortada con un pliegue del TNT', EF_ORIFICIOS, [
          causa('TNT cargado con un pliegue', OPERARIO, O_CONDUCTA, 'Control visual de orificios en cada pieza', 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 30 / 40 ───────────────────────────────────────────────────────────────
const OP30 = operacion('30', 'TROQUELADO DE APLIX',
  'Troquelar el aplix a la medida del plano', [
    we('Machine', 'Troqueladora continua', [
      funcion('Troquelar el aplix a medida', '', [
        falla('Aplix troquelado fuera de medida', EF_APLIX, [
          causa('Troquel desgastado o dañado', 'Mantenimiento preventivo del troquel', 5, 'Control con calibre del primer golpe', 9),
          causa('Rollo de aplix corrido en la guia del troquel', OPERARIO, O_CONDUCTA, 'Control con calibre del primer golpe', 9),
        ]),
      ]),
    ]),
  ]);

const OP40 = operacion('40', 'TROQUELADO DE REFUERZO',
  'Troquelar los refuerzos de fieltro con la forma del plano', [
    we('Machine', 'Troquel de refuerzos', [
      funcion('Troquelar los refuerzos a medida', '', [
        falla('Refuerzo fuera de medida', EF_REFUERZO, [
          causa('Troquel desgastado o dañado', 'Mantenimiento preventivo del troquel', 5, 'Control visual del primer golpe', 9),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Verificar al tacto el fieltro antes de troquelar', '', [
        falla('Refuerzo troquelado con aguja rota adentro', EF_AGUJA, [
          cc(causa('Aguja retenida en el fieltro no detectada en recepcion', 'Control tactil de presencia de agujas en recepcion', 8,
            'Control tactil de presencia de agujas en el fieltro al troquelar', 9)),
        ]),
      ]),
    ]),
  ]);

// ── OP 50 / 60 ───────────────────────────────────────────────────────────────
const OP50 = operacion('50', 'COSTURA RECTA / OVERLOCK',
  'Unir las piezas y coser los refuerzos con costura recta y overlock', [
    we('Machine', 'Maquina de coser recta y overlock', [
      funcion('Coser con la aguja y el hilo especificados', '', [
        falla('Costura salteada o con puntadas irregulares', EF_COSTURA, [
          causa('Aguja despuntada o mal colocada', 'Aguja especificada verificada en el set-up', 5, PATRON, 9),
          causa('Tension de hilo incorrecta', 'Tension verificada en el set-up', 5, PATRON, 9),
        ]),
        falla('Fragmento de aguja rota en la pieza', EF_AGUJA, [
          cc(causa('Aguja quebrada durante la costura', 'Aguja especificada verificada en el set-up', 5, SIN_DET, 10)),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Coser las zonas de la hoja del lado liso', '', [
        falla('Costura desviada o en otra zona', EF_COSTURA, [
          causa('Pieza mal guiada en la maquina', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
        falla('Refuerzo cosido corrido o del lado equivocado', EF_REFUERZO, [
          causa('Refuerzo presentado al reves', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
        falla('Costura del lado felpudo', EF_CARA, [
          causa('Pieza presentada al reves', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
      ]),
    ]),
  ]);

const OP60 = operacion('60', 'APLICACION DE APLIX',
  'Pegar la cantidad de aplix de cada codigo sobre los orificios guia', [
    we('Man', 'Operador de produccion', [
      funcion('Colocar cada aplix sobre su orificio guia', '', [
        falla('Aplix faltante', EF_APLIX, [
          causa('Aplix omitido en un punto', HO, O_CONDUCTA, 'Control visual de cantidad en cada pieza', 8),
        ]),
        falla('Aplix corrido o torcido', EF_APLIX, [
          causa('Aplix pegado fuera del orificio guia', HO, O_CONDUCTA, 'Control visual de posicion en cada pieza', 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 70 / 80 ───────────────────────────────────────────────────────────────
const OP70 = operacion('70', 'INSPECCION FINAL',
  'Inspeccionar costuras, aplix y refuerzos de cada pieza antes de embalar', [
    we('Man', 'Inspector de calidad', [
      funcion('Inspeccionar cada pieza bajo luz y separar las no conformes', '', [
        falla('Pieza no conforme liberada', EF_ESCAPE, [
          causa('Defecto de costura o aplix no visto', 'Puesto de inspeccion con luz LED', 6, 'Inspeccion visual de cada pieza', 8),
        ]),
        falla('Aplix flojo no detectado', EF_APLIX, [
          causa('Adherencia del aplix no verificada', SIN_PREV, 10, 'Prueba de tiron manual', 9),
        ]),
      ]),
    ]),
  ]);

const OP80 = operacion('80', 'EMBALAJE',
  'Embalar las piezas conformes por codigo e identificar cada bolsa', [
    we('Man', 'Operador de produccion', [
      funcion('Colocar la cantidad de la gama por bolsa y etiquetarla', '', [
        falla('Bolsa con cantidad distinta de la definida', EF_CANTIDAD, [
          causa('Conteo manual de piezas', OPERARIO, O_CONDUCTA, 'Control visual de cantidad por bolsa', 8),
        ]),
        falla('Piezas de otro codigo en la bolsa', EF_MEZCLA, [
          causa('Codigos parecidos en el mismo puesto', OPERARIO, O_CONDUCTA, 'Control visual de etiqueta contra contenido', 8),
        ]),
        falla('Pieza deformada dentro de la bolsa', EF_SCRAP, [
          causa('Piezas dobladas sin proteger el aplix', HO, O_CONDUCTA, SIN_DET, 10),
        ]),
      ]),
    ]),
  ]);

const operations = [OP10, OP15, OP20, OP30, OP40, OP50, OP60, OP70, OP80];
const sb = await connectSupabase();
const { doc: vivo, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== AMFE_KEY) throw new Error(`esperaba ${AMFE_KEY} y lei ${amfe_number}`);
const doc = {
  ...vivo,
  header: {
    ...vivo.header,
    amfeNumber: '157',
    subject: 'Proceso de fabricacion - Telas Planas Hilux 581D',
    partNumber: CODIGOS.join(' / '),
    applicableParts: CODIGOS.join(', '),
    revDate: FECHA,
  },
  operations,
  revisions: [
    { rev: 'A', date: '13/03/2026', item: 'N/A', details: 'EMISION INICIAL.', pswDate: '', modifiedBy: 'FS' },
    { rev: 'A', date: FECHA, item: 'TODAS',
      details: 'SE ALINEA AL FLUJOGRAMA 150 REV B-1 Y SE UNIFICA CON EL AMFE 157 DE PROYECTO: ALTA DEL TROQUELADO DE REFUERZO; CARA LISA / FELPUDA EN PREPARACION DE CORTE. AGUJAS ROTAS EN LOS REFUERZOS CON CONTROL TACTIL EN RECEPCION Y TROQUELADO (RECLAMO PWA 20/08/2026).',
      pswDate: '', modifiedBy: 'FS' },
  ],
};

const { errores, stats, candidatas } = chequeosDeAutoria(doc, {});
const mios = doc.operations.map((o) => `${o.opNumber} ${sinAcentos(o.name)}`);
const flujo = OPS_FLUJOGRAMA.map(([n, nom]) => `${n} ${sinAcentos(nom)}`);
if (JSON.stringify(mios) !== JSON.stringify(flujo)) errores.push(`las operaciones no son las del flujograma 150 Rev B-1:\n    AMFE ${mios.join(' | ')}`);
for (const op of doc.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) for (const c of fm.causes) {
  if ([HO, OPERARIO].includes(c.preventionControl) && c.occurrence !== O_CONDUCTA) errores.push(`OP${op.opNumber}: control de conducta con O=${c.occurrence}`);
  if (c.specialChar === 'CC' && fm.severity < 9) errores.push(`OP${op.opNumber}: CC con S=${fm.severity}`);
}
const COBERTURA = {
  'TPES110/PP30B A': 'Punzonado PES 110 + TNT PP 30 blanco',
  'HILO CAIMAN 120': 'Hilo Caiman poliester 120 blanco',
  'HILO POLI TEXT': 'Hilo poliester texturizado blanco',
  'APLIX-A999R8395': 'Aplix metal resin APLIX-A999R8395',
  'FIEL31000MUL': 'Refuerzo de fieltro 1000 g/m2 FIEL31000MUL',
  '3250T_30_2000_5': 'Refuerzo punzonado 250 g/m2',
  'BA 60 90': { fuera: 'bolsa de embalaje: se controla en el embalaje (OP 80)' },
  'ET-SATO-100X60': { fuera: 'etiqueta: se coloca y se controla en el embalaje (OP 80)' },
  'ET-SATO-50X20': { fuera: 'etiqueta: se coloca y se controla en el embalaje (OP 80)' },
};
const { lineas, fecha } = leerBomDelArb(CODIGOS);
const fallasBom = materialesContraBom({ doc, bom: lineas, cobertura: COBERTURA });
errores.push(...fallasBom);
const { nWE, nFM, nCausas, apCount } = stats;
console.log('AMFE 157 — TELAS PLANAS HILUX 581D');
console.log(`  operaciones ${doc.operations.length} · WE ${nWE} · modos de falla ${nFM} · causas ${nCausas} · AP ${Object.entries(apCount).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`  materiales contra la BOM del arb (export ${fecha.toISOString().slice(0, 10)}): ${fallasBom.length ? fallasBom.length + ' diferencias' : 'cierra en las dos direcciones'}`);
for (const op of doc.operations) {
  const cs = op.workElements.flatMap((w) => w.functions.flatMap((f) => f.failures.flatMap((fm) => fm.causes)));
  console.log(`   ${op.opNumber.padStart(3)} ${op.name.padEnd(30)} causas ${String(cs.length).padStart(2)}  H=${cs.filter((c) => c.ap === 'H').length} M=${cs.filter((c) => c.ap === 'M').length} L=${cs.filter((c) => c.ap === 'L').length}`);
}
const val = validateAmfeDoc(doc, doc.header.subject, AMFE_KEY);
printIssues('validador de la casa', val);
if (val.critical.length) errores.push(`${val.critical.length} criticos del validador`);
console.log(errores.length ? `\nERRORES (${errores.length}):\n  ${errores.join('\n  ')}` : '\nChequeos propios: OK');
console.log(`${candidatas.length} causas candidatas a caracteristica especial por S y O.`);
mkdirSync('tmp/amfe157', { recursive: true });
writeFileSync('tmp/amfe157/amfe157.json', JSON.stringify(doc, null, 1));
if (!APPLY) { console.log('DRY-RUN. --apply para escribir.'); process.exit(errores.length ? 1 : 0); }
if (errores.length) { console.error('NO se escribe: hay errores.'); process.exit(1); }
await runWithValidation([{ id: ID, amfeNumber: AMFE_KEY, productName: doc.header.subject, before: vivo, after: doc }], true, async () => {
  await saveAmfe(sb, ID, doc, { expectedAmfeNumber: AMFE_KEY, extraFields: { revisions: JSON.stringify(doc.revisions), project_name: 'PWA/HILUX/TELAS_PLANAS' } });
  console.log('guardado AMFE-1 (157)');
});
process.exit(0);
