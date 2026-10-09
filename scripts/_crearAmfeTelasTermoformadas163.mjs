/**
 * _crearAmfeTelasTermoformadas163.mjs — AMFE de proceso 163 de las TELAS TERMOFORMADAS PWA
 * (Toyota Hilux / RR2 PADS 737D, proyecto 582D): 21-9640/41 (seat cushion), 21-9642/43 (seat back)
 * y los refuerzos laterales 304883/304884. Reescribe el AMFE-2 de la base para que siga al
 * flujograma I-IN-002/III Rev B (24/09/2026).
 *
 * POR QUE: Pablo Gamboa, 08/10/2026 ("DOCUMENTACION DE TELAS TERMOFORMADAS"): *"en el caso del AMFE
 * hay que ajustarlo lo mejor posible para que coincida con el flujograma"*. El AMFE de marzo
 * describia costura de refuerzos, reprocesos de costura, kits y almacenamiento que el proceso no
 * tiene, y no tenia horno, plegado, ultrasonido ni adhesivado. Fak, 09/10/2026: *"el laser existe...
 * y el refuerzo si se pega"*, *"si hace falta actualizar los AMFEs hacelo"*. Y el reclamo PWA del
 * 20/08/2026 (agujas de punzonado en fieltro): control tactil en recepcion y en troquelado.
 *
 * DE DONDE SALE CADA DATO (relevado el 09/10/2026; tabla completa en la carpeta de la tarea)
 *   - Secuencia y nombres: flujograma Rev B (PDF; no hay JSON en tools/flowchart/data, por eso la
 *     lista OPS_FLUJOGRAMA va escrita aca y se compara en orden).
 *   - OP 30, 40, 60, 61, 90, 100: hojas de operaciones nuevas HO-984 (P. Centurion, 02/07/2026,
 *     mandadas por Pablo el 08/10): horno 165-175 °C y 32 s con controlador, timer y alarma; prensa
 *     con doble pulsador, seguros del molde y barrera; ultrasonido 0,4 s y amperaje al inicio de
 *     turno; refuerzos sobre util con pines (no obturar agujeros, no delaminar, adherencia total);
 *     aplix sobre agujeros de referencia. La HO vieja (150 °C y 60 s, 18/03) quedo superada.
 *   - OP 10: planos (ECN04: monofelt 140 g/m2 min., blanco, BSDM0500 100 mm/min max.; felt asiento
 *     BSDL2603-3N 1500 g/m2 t=5; felt lateral 304883/84 2,5±0,5 mm, Shore A >50, adhesivo con papel
 *     siliconado), FT154, BOM del arb (export del 08/10/2026). Practica de Calidad para recepcion de
 *     telas PWA (PC PWA.xlsx: camara MC184, balanza, calibre MC413, una muestra por lote).
 *   - OP 20/21: tizada (CONSUMO BLANKS DE THERMO.xlsx), minuta de visita KW35 ("las telas se cortan
 *     en Mesa de Corte. Mylar disponible"), mylar de seat back y seat cushion (13/07/2026).
 *   - OP 50: minuta KW35 (robot laser instalado, en pruebas; ajuste manual de corte en 9640/41).
 *   - OP 70/80: BOM del arb (rollo tesa 52110; fieltro 1500 y tricapa 600), Hoja2 de la BOM del
 *     proyecto (tizadas de troquelado).
 *   - OP 120: HO vieja OP 90 (20 piezas por bolsa 900x600, etiqueta 100x60, control de cantidad).
 *   - Agujas: mensaje de Manuel Meszaros (08/10/2026) y D7 del 8D (F. Santoro, 15/10/2026).
 *
 * LO QUE NO TIENE PAPEL Y POR ESO NO SE DECLARA COMO CONTROL
 * Hoja de operaciones de 10, 20, 21, 50, 51, 70, 80, 110, 111 y 120; ciclo de control de la OP 60
 * (TBD en la HO); parametros del laser; medio de control final (calibre en cotizacion); gama de
 * embalaje; muestra patron; ficha del aplix y del adhesivo. El AMFE dice donde falta control.
 *
 * Decisiones con Fak (09/10/2026): el corte laser se queda (la tijera es el retrabajo 51); el
 * refuerzo se pega. Datos que los papeles no cierran y quedan para confirmar: cantidad de aplix
 * (20 en el plano, 24 en la HO vieja, 23/25 en la BOM) y la temperatura/tiempo de horno (minuta:
 * 170 °C nominal, 30+5 s).
 *
 * SIGLAS: CC solo donde la S es 9 o 10 (caracteristicas-especiales.md): inflamabilidad (S9, legal) y
 * agujas (S10, lesion del ocupante; decidido con Fak el 09/10/2026). Sin SC.
 *
 * Uso:  node scripts/_crearAmfeTelasTermoformadas163.mjs            (arma, valida y muestra)
 *       node scripts/_crearAmfeTelasTermoformadas163.mjs --apply    (escribe en Supabase)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { validateAmfeDoc, printIssues } from './_lib/amfeValidator.mjs';
import { crearConstructores, chequeosDeAutoria, leerBomDelArb, materialesContraBom, sinAcentos } from './_lib/amfeAutoria.mjs';

const APPLY = process.argv.includes('--apply');
const ID = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';
const AMFE_KEY = 'AMFE-2';
const FECHA = '09/10/2026';

const OPS_FLUJOGRAMA = [
  ['10', 'RECEPCION E INSPECCION DE MATERIA PRIMA'], ['20', 'CORTE DE TELAS EN MESA DE CORTE'],
  ['21', 'CONTROL CON MYLAR'], ['30', 'CALENTAMIENTO EN HORNO'], ['40', 'TERMOFORMADO DE TELAS'],
  ['50', 'CORTE LASER Y VERIFICACION DE TELAS'], ['51', 'RETRABAJO MANUAL DE CORTE'],
  ['60', 'PLEGADO DE PESTAÑAS'], ['61', 'ULTRASONIDO'], ['70', 'ADHESIVADO DE REFUERZOS'],
  ['80', 'TROQUELADO DE REFUERZOS Y APLIX'], ['90', 'APLICACION DE REFUERZOS'],
  ['100', 'APLICACION DE APLIX'], ['110', 'CONTROL FINAL DE CALIDAD'],
  ['111', 'REPROCESO: REUBICACION DE APLIX'], ['120', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO'],
];

const FOCO = 'Funcion Interna: Entregar telas termoformadas con refuerzos y aplix, sin cuerpos extraños, conformes al plano'
  + ' / Funcion del Cliente: Permitir el espumado y armado del asiento en PWA sin retrabajo'
  + ' / Funcion del Usuario Final: Asiento sin deformaciones y con la inflamabilidad exigida';
const { causa, falla, funcion, we, operacion } = crearConstructores({ prefijo: 'tt163', foco: FOCO });

// ── Controles que se repiten ─────────────────────────────────────────────────
const SIN_PREV = 'Sin control preventivo';
const SIN_DET = 'Sin control de deteccion';
const HO = 'Hoja de operaciones del puesto';            // control de conducta con hoja escrita
const OPERARIO = 'Operarios del sector con practica';    // conducta, sin hoja propia
const O_CONDUCTA = 7;                                    // P2: control de conducta "algo efectivo" (6-7), el peor
const CERT = 'Certificado del proveedor por lote';
const O_CERT = 5;                                        // P2: proceso similar con no conformidades aisladas
// El aplix metal resin es el mismo de las telas de serie de PWA (PC PWA.xlsx): P2 O=3.
const VISUAL_FINAL = 'Control visual 100% en el control final';
const SETUP = 'Set-up de lanzamiento al inicio de turno';
const cc = (c) => ({ ...c, specialChar: 'CC' });
const ACCION_8D = {
  preventionAction: 'Actualizacion del AMFE del proveedor del fieltro por el reclamo PWA 20/08/2026',
  responsible: 'F. Santoro', targetDate: '15/10/2026',
};

// ── Efectos (S de la Tabla P1, SETEC pag. 101-103) ───────────────────────────
const EF_AGUJA = { s: 10, local: 'Riesgo de lesion del operario al manipular el material', next: 'Riesgo de lesion del operario de PWA; reclamo de cliente', end: 'Aguja dentro del asiento: riesgo de lesion al ocupante' };
const EF_FUEGO = { s: 9, local: 'Material sin evidencia de cumplir BSDM0500', next: 'Bloqueo del lote en PWA', end: 'Incumplimiento del requisito legal de inflamabilidad del asiento' };
const EF_OPERARIO = { s: 10, local: 'Riesgo agudo para el operario del puesto', next: 'Sin efecto en PWA', end: 'Sin efecto en el vehiculo' };
const EF_FORMA = { s: 7, local: 'Tela con forma fuera de plano, se scrapea', next: 'Tela que no asienta en el molde de espumado de PWA', end: 'Asiento con deformacion o arruga' };
const EF_SCRAP = { s: 7, local: 'Material o tela rechazada en el puesto, se genera scrap', next: 'Reposicion y atraso del lote', end: 'Sin efecto en el vehiculo: la pieza no sale de planta' };
const EF_REFUERZO = { s: 7, local: 'Refuerzo despegado, corrido o fuera de medida', next: 'Rechazo y clasificacion en PWA', end: 'Asiento sin el refuerzo en su lugar: deformacion en el uso' };
const EF_AGUJEROS = { s: 7, local: 'Agujeros de la tela tapados o corridos', next: 'Tela que no se indexa en el molde de PWA', end: 'Sin efecto en el vehiculo: la pieza no se puede armar' };
const EF_APLIX = { s: 7, local: 'Aplix faltante, corrido o despegado', next: 'Tela que no se fija en el molde de PWA: rechazo', end: 'Funda desplazada en el asiento' };
const EF_ASPECTO = { s: 5, local: 'Tela con quemadura o marca', next: 'Posible clasificacion de piezas en PWA', end: 'Aspecto por debajo del estandar' };
const EF_ESCAPE = { s: 7, local: 'Pieza no conforme embalada como conforme', next: 'Rechazo y clasificacion de piezas en PWA', end: 'Asiento con deformacion o funda desplazada' };
const EF_CANTIDAD = { s: 6, local: 'Bolsa con cantidad distinta de la pedida', next: 'Faltante en la recepcion de PWA', end: 'Sin efecto en el vehiculo' };
const EF_MEZCLA = { s: 6, local: 'Bolsa con piezas de otra mano o modelo', next: 'Pieza equivocada en la linea de PWA: clasificacion', end: 'Sin efecto en el vehiculo' };

// ── OP 10 ────────────────────────────────────────────────────────────────────
const recepcionAgujas = (material) => falla(`Presencia de agujas rotas en ${material} (cuerpo extraño metalico)`, EF_AGUJA, [
  cc({ ...causa('Agujas del punzonado del proveedor quebradas dentro del material', SIN_PREV, 10,
    'Control tactil de presencia de agujas en recepcion y en troquelado', 9), ...ACCION_8D }),
]);
const recepcionFuego = (nombre) => falla(`${nombre} fuera de la norma de inflamabilidad BSDM0500`, EF_FUEGO, [
  cc(causa('Lote del proveedor fuera de especificacion', CERT, O_CERT, 'Ensayo en camara MC184, 1 muestra por lote', 9)),
]);
const OP10 = operacion('10', 'RECEPCION E INSPECCION DE MATERIA PRIMA',
  'Recibir, inspeccionar y liberar telas, refuerzos, aplix y adhesivo antes de usarlos', [
    we('Material', 'Punzonado blanco para termoformar 3180_1700_BCM', [
      funcion('Proveer tela con el gramaje y la inflamabilidad del plano', '', [
        recepcionFuego('Tela'),
        falla('Gramaje de la tela por debajo del plano', EF_FORMA, [
          causa('Lote del proveedor fuera de tolerancia de gramaje', CERT, O_CERT, 'Pesada de muestra en balanza, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Fieltro prensado 1500 g/m2 (refuerzo de asiento)', [
      funcion('Proveer fieltro con el espesor del plano, sin cuerpos extraños', '', [
        recepcionAgujas('el fieltro'),
        recepcionFuego('Fieltro'),
        falla('Espesor del fieltro fuera de plano', EF_REFUERZO, [
          causa('Lote del proveedor fuera de tolerancia de espesor', CERT, O_CERT, 'Medicion de espesor de muestra, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Punzonado tricapa 600 g/m2 (refuerzo de respaldo)', [
      funcion('Proveer tricapa con el espesor y la dureza del plano', '', [
        recepcionAgujas('el tricapa'),
        falla('Espesor o dureza del tricapa fuera de plano', EF_REFUERZO, [
          causa('Lote del proveedor fuera de especificacion', CERT, O_CERT, 'Medicion de espesor de muestra, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Aplix metal resin APLIX-A999R8395', [
      funcion('Proveer aplix con medida y agarre especificados', '', [
        falla('Aplix con espesor o medida fuera de especificacion', EF_APLIX, [
          causa('Lote del proveedor fuera de tolerancia', 'Certificado del proveedor por lote, material de serie', 3, 'Control de espesor con calibre MC413, 1 por lote', 9),
        ]),
      ]),
    ]),
    we('Material', 'Rollo adhesivo tesa 52110', [
      funcion('Proveer adhesivo vigente para pegar los refuerzos', '', [
        falla('Adhesivo vencido o fuera de especificacion', EF_REFUERZO, [
          causa('Rollo con fecha vencida o mal almacenado', 'Almacenamiento FIFO en sector de recepcion', 6, 'Verificacion de vencimiento en recepcion', 8),
        ]),
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

// ── OP 20 / 21 ───────────────────────────────────────────────────────────────
const OP20 = operacion('20', 'CORTE DE TELAS EN MESA DE CORTE',
  'Cortar los blanks de tela segun la tizada de cada pieza', [
    we('Machine', 'Mesa de corte', [
      funcion('Cortar blanks con la medida de la tizada', '', [
        falla('Blank fuera de medida', EF_SCRAP, [
          causa('Programa de tizada de otra pieza', 'Programa de corte identificado por pieza', 5, 'Control con mylar del blank cortado', 9),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Tender la tela alineada y sin arrugas', '', [
        falla('Tela tendida con arrugas o desalineada', EF_SCRAP, [
          causa('Tendido sin alinear el borde del rollo', OPERARIO, O_CONDUCTA, 'Control con mylar del blank cortado', 9),
        ]),
      ]),
    ]),
  ]);

const OP21 = operacion('21', 'CONTROL CON MYLAR',
  'Verificar cada blank contra el mylar de su pieza antes del horno', [
    we('Measurement', 'Mylar de seat back y seat cushion', [
      funcion('Comparar el blank contra el mylar de su pieza', '', [
        falla('Blank fuera de medida pasa al horno', EF_FORMA, [
          causa('Mylar de la otra pieza usado en el control', 'Mylar identificado por pieza', 5, 'Control visual del termoformado en OP 40', 8),
          causa('Mylar mal apoyado sobre el blank', OPERARIO, O_CONDUCTA, 'Control visual del termoformado en OP 40', 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 30 / 40 ───────────────────────────────────────────────────────────────
const OP30 = operacion('30', 'CALENTAMIENTO EN HORNO',
  'Calentar el blank a temperatura y tiempo de la hoja antes de termoformar', [
    we('Machine', 'Horno', [
      funcion('Calentar el blank a la temperatura y el tiempo de la hoja', '', [
        falla('Temperatura de horno fuera de rango', EF_FORMA, [
          causa('Resistencia del horno fuera de servicio', 'Controlador de temperatura de horno', 4, SETUP, 9),
        ]),
        falla('Tela quemada por exceso de calor', EF_SCRAP, [
          causa('Tela retirada despues de la alarma', 'Timer con alarma sonora', 4, 'Control visual del termoformado en OP 40', 8),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Retirar la tela al sonar la alarma y llevarla a la prensa', '', [
        falla('Tela fria al llegar a la prensa', EF_FORMA, [
          causa('Demora entre el horno y la prensa', HO, O_CONDUCTA, 'Control visual del termoformado en OP 40', 8),
        ]),
        falla('Quemadura del operario al retirar la tela', EF_OPERARIO, [
          causa('Contacto con la tela o el horno caliente', 'Guantes de proteccion termica', 4, SIN_DET, 10),
        ]),
      ]),
    ]),
  ]);

const OP40 = operacion('40', 'TERMOFORMADO DE TELAS',
  'Conformar la tela caliente en la prensa con la forma del molde', [
    we('Machine', 'Prensa con molde de termoformado', [
      funcion('Conformar la tela con la forma del molde', '', [
        falla('Termoformado incompleto o con arrugas', EF_FORMA, [
          causa('Ciclo de prensa distinto del estandar', 'Ciclo de prensa estandar en el set-up', 5, 'Control visual y manual de cada tela', 8),
        ]),
        falla('Tela conformada con el molde equivocado', EF_FORMA, [
          causa('Molde de otra pieza montado en la prensa', 'Numero de molde verificado en el set-up', 4, 'Control visual y manual de cada tela', 8),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Extender la tela contra el tope y accionar la prensa', '', [
        falla('Tela descentrada en el molde', EF_FORMA, [
          causa('Tela sin apoyar contra el tope trasero', HO, O_CONDUCTA, 'Control visual y manual de cada tela', 8),
        ]),
        falla('Atrapamiento de manos en la prensa', EF_OPERARIO, [
          causa('Acceso a la zona del molde durante el ciclo', 'Botonera doble, seguros del molde y barrera', 3, 'Verificacion de barrera y seguros al inicio de turno', 9),
        ]),
      ]),
    ]),
  ]);

// ── OP 50 / 51 ───────────────────────────────────────────────────────────────
const OP50 = operacion('50', 'CORTE LASER Y VERIFICACION DE TELAS',
  'Recortar el perimetro y los agujeros de la tela termoformada con el laser', [
    we('Machine', 'Robot de corte laser', [
      funcion('Cortar perimetro y agujeros segun plano', '', [
        falla('Corte incompleto o fuera de contorno', EF_FORMA, [
          causa('Programa de corte de otra pieza', 'Programa de corte por pieza', 5, 'Verificacion visual de cada tela despues del corte', 8),
          causa('Tela mal posicionada en el dispositivo', OPERARIO, O_CONDUCTA, 'Verificacion visual de cada tela despues del corte', 8),
        ]),
        falla('Agujero faltante o corrido', EF_AGUJEROS, [
          causa('Programa de corte de otra pieza', 'Programa de corte por pieza', 5, 'Verificacion visual de cada tela despues del corte', 8),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Cargar la tela y retirarla del laser', '', [
        falla('Lesion ocular del operario', EF_OPERARIO, [
          causa('Exposicion al haz sin proteccion', 'Proteccion ocular en el puesto', 4, SIN_DET, 10),
        ]),
      ]),
    ]),
  ]);

const OP51 = operacion('51', 'RETRABAJO MANUAL DE CORTE',
  'Completar a mano el corte que el laser no termino y volver a verificar', [
    we('Man', 'Operador de produccion', [
      funcion('Completar el corte con tijera sobre la marca', '', [
        falla('Corte manual fuera de contorno', EF_FORMA, [
          causa('Corte a mano sin guia', OPERARIO, O_CONDUCTA, 'Re-verificacion visual en OP 50', 8),
        ]),
        falla('Corte de un agujero de indexacion', EF_AGUJEROS, [
          causa('Corte a mano sin guia', OPERARIO, O_CONDUCTA, 'Re-verificacion visual en OP 50', 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 60 / 61 ───────────────────────────────────────────────────────────────
const OP60 = operacion('60', 'PLEGADO DE PESTAÑAS',
  'Plegar las pestañas del seat back sobre la linea pre-debilitada', [
    we('Machine', 'Dispositivo de plegado', [
      funcion('Plegar la pestaña sobre la linea de pliegue', '', [
        falla('Pestaña plegada fuera de la linea', EF_FORMA, [
          causa('Tela mal apoyada en el dispositivo', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
      ]),
    ]),
  ]);

const OP61 = operacion('61', 'ULTRASONIDO',
  'Fijar las pestañas plegadas con puntos de ultrasonido', [
    we('Machine', 'Soldadora por ultrasonido', [
      funcion('Soldar las pestañas con el tiempo seteado', '', [
        falla('Punto de soldadura flojo o faltante', EF_FORMA, [
          causa('Tiempo de soldadura distinto del seteado', 'Seteo del tiempo por pines', 4, SETUP, 9),
          causa('Amperaje de soldadura fuera de rango', 'Indicador de amperaje en la soldadora', 4, SETUP, 9),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Aplicar los puntos en la secuencia de la hoja', '', [
        falla('Punto de soldadura fuera de posicion', EF_FORMA, [
          causa('Secuencia de puntos no respetada', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 70 / 80 ───────────────────────────────────────────────────────────────
const OP70 = operacion('70', 'ADHESIVADO DE REFUERZOS',
  'Laminar el adhesivo sobre el material de los refuerzos antes de troquelar', [
    we('Man', 'Operador de produccion', [
      funcion('Aplicar el adhesivo cubriendo toda la plancha', '', [
        falla('Adhesivo con zonas sin cubrir o con burbujas', EF_REFUERZO, [
          causa('Adhesivo aplicado sin tensar el rollo', OPERARIO, O_CONDUCTA, 'Control visual de adherencia en OP 90', 8),
        ]),
      ]),
    ]),
  ]);

const OP80 = operacion('80', 'TROQUELADO DE REFUERZOS Y APLIX',
  'Troquelar los refuerzos y el aplix con la forma del plano', [
    we('Machine', 'Troqueladora', [
      funcion('Troquelar refuerzos y aplix a medida de plano', '', [
        falla('Refuerzo o aplix fuera de medida', EF_REFUERZO, [
          causa('Troquel desgastado o dañado', 'Mantenimiento preventivo del troquel', 5, 'Control visual del primer golpe', 9),
          causa('Troquel de otra pieza montado', 'Troquel identificado por pieza', 4, 'Control visual del primer golpe', 9),
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

// ── OP 90 / 100 ──────────────────────────────────────────────────────────────
const OP90 = operacion('90', 'APLICACION DE REFUERZOS',
  'Pegar los refuerzos sobre la tela en el util de montaje', [
    we('Machine', 'Util de montaje con pines', [
      funcion('Posicionar tela y refuerzo con los mismos pines', '', [
        falla('Refuerzo corrido respecto de la tela', EF_REFUERZO, [
          causa('Tela o refuerzo fuera de los pines', HO, O_CONDUCTA, 'Control visual de cada pieza en el puesto', 8),
        ]),
        falla('Agujeros obturados por el refuerzo', EF_AGUJEROS, [
          causa('Refuerzo colocado fuera de los pines', HO, O_CONDUCTA, 'Control manual de agujeros en cada pieza', 8),
        ]),
      ]),
    ]),
    we('Man', 'Operador de produccion', [
      funcion('Pegar el refuerzo correcto con adherencia total', '', [
        falla('Refuerzo despegado o delaminado', EF_REFUERZO, [
          causa('Superficie sin presionar al pegar', HO, O_CONDUCTA, 'Control visual de cada pieza en el puesto', 8),
        ]),
        falla('Refuerzo de otra pieza o faltante', EF_REFUERZO, [
          causa('Refuerzos de asiento y respaldo en el mismo puesto', HO, O_CONDUCTA, VISUAL_FINAL, 8),
        ]),
      ]),
    ]),
  ]);

const OP100 = operacion('100', 'APLICACION DE APLIX',
  'Pegar los aplix sobre los agujeros de referencia de la tela', [
    we('Man', 'Operador de produccion', [
      funcion('Cubrir cada agujero de referencia con un aplix', '', [
        falla('Agujero de referencia sin aplix', EF_APLIX, [
          causa('Aplix omitido en un punto', HO, O_CONDUCTA, 'Control visual de cada pieza en el puesto', 8),
        ]),
        falla('Aplix sobre un agujero de indexacion', EF_AGUJEROS, [
          causa('Confusion entre agujero de referencia e indexacion', HO, O_CONDUCTA, 'Control visual de cada pieza en el puesto', 8),
        ]),
      ]),
    ]),
  ]);

// ── OP 110 / 111 / 120 ───────────────────────────────────────────────────────
const OP110 = operacion('110', 'CONTROL FINAL DE CALIDAD',
  'Verificar forma, refuerzos, aplix y agujeros de cada pieza antes de embalar', [
    we('Man', 'Inspector de calidad', [
      funcion('Inspeccionar cada pieza y separar las no conformes', '', [
        falla('Pieza no conforme liberada', EF_ESCAPE, [
          causa('Sin calibre de control final definido', SIN_PREV, 10, 'Control visual de cada pieza', 8),
        ]),
      ]),
    ]),
  ]);

const OP111 = operacion('111', 'REPROCESO: REUBICACION DE APLIX',
  'Despegar el aplix mal ubicado y pegarlo en su agujero, y re-verificar', [
    we('Man', 'Operador de produccion', [
      funcion('Reubicar el aplix sobre su agujero de referencia', '', [
        falla('Aplix reubicado sin adherencia', EF_APLIX, [
          causa('Aplix despegado reutilizado', OPERARIO, O_CONDUCTA, 'Re-verificacion en el control final', 8),
        ]),
      ]),
    ]),
  ]);

const OP120 = operacion('120', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
  'Embalar las piezas conformes por modelo e identificar cada bolsa', [
    we('Man', 'Operador de produccion', [
      funcion('Colocar la cantidad definida por bolsa y etiquetarla', '', [
        falla('Bolsa con cantidad distinta de la definida', EF_CANTIDAD, [
          causa('Conteo manual de piezas', OPERARIO, O_CONDUCTA, 'Control visual de cantidad por bolsa', 8),
        ]),
        falla('Piezas de otra mano o modelo en la bolsa', EF_MEZCLA, [
          causa('Piezas LH y RH en el mismo puesto', OPERARIO, O_CONDUCTA, 'Control visual de etiqueta contra contenido', 8),
        ]),
      ]),
    ]),
  ]);

// ── Documento ───────────────────────────────────────────────────────────────
const operations = [OP10, OP20, OP21, OP30, OP40, OP50, OP51, OP60, OP61, OP70, OP80, OP90, OP100, OP110, OP111, OP120];
const sb = await connectSupabase();
const { doc: vivo, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== AMFE_KEY) throw new Error(`esperaba ${AMFE_KEY} y lei ${amfe_number}`);
const doc = {
  ...vivo,
  header: {
    ...vivo.header,
    amfeNumber: '163',
    subject: 'Proceso de fabricacion - Telas Termoformadas 582D',
    partNumber: '21-9640 / 21-9641 / 21-9642 / 21-9643 / 304883 / 304884',
    applicableParts: '21-9640, 21-9641, 21-9642, 21-9643, 304883, 304884',
    revDate: FECHA,
  },
  operations,
  revisions: [
    { rev: 'A', date: '13/03/2026', item: 'N/A', details: 'EMISION INICIAL.', pswDate: '', modifiedBy: 'FS' },
    { rev: 'A', date: FECHA, item: 'TODAS',
      details: 'SE ALINEA AL FLUJOGRAMA REV B: HORNO, CORTE LASER CON RETRABAJO MANUAL, PLEGADO DE PESTAÑAS, ULTRASONIDO, ADHESIVADO Y APLICACION DE REFUERZOS (PEGADO, SIN COSTURA). AGUJAS ROTAS EN FIELTRO Y TRICAPA CON CONTROL TACTIL EN RECEPCION Y TROQUELADO (RECLAMO PWA 20/08/2026).',
      pswDate: '', modifiedBy: 'FS' },
  ],
};

// Chequeos
const { errores, stats, candidatas } = chequeosDeAutoria(doc, { controlDeConducta: null });
const numerosMios = doc.operations.map((o) => `${o.opNumber} ${sinAcentos(o.name)}`);
const numerosFlujo = OPS_FLUJOGRAMA.map(([n, nom]) => `${n} ${sinAcentos(nom)}`);
if (JSON.stringify(numerosMios) !== JSON.stringify(numerosFlujo)) errores.push(`las operaciones no son las del flujograma Rev B:\n    AMFE ${numerosMios.join(' | ')}`);
for (const op of doc.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) for (const c of fm.causes) {
  if ([HO, OPERARIO].includes(c.preventionControl) && c.occurrence !== O_CONDUCTA) errores.push(`OP${op.opNumber}: control de conducta con O=${c.occurrence}`);
  if (c.specialChar === 'CC' && fm.severity < 9) errores.push(`OP${op.opNumber}: CC con S=${fm.severity}`);
}
const COBERTURA = {
  '3180_1700_BCM': 'Punzonado blanco para termoformar 3180_1700_BCM',
  '582TEL001TRO01': 'Fieltro prensado 1500 g/m2 (refuerzo de asiento)',
  '3600_TRICAPA': 'Punzonado tricapa 600 g/m2 (refuerzo de respaldo)',
  'APLIX-A999R8395': 'Aplix metal resin APLIX-A999R8395',
  '52110': 'Rollo adhesivo tesa 52110',
  'BA 60 90': { fuera: 'bolsa de embalaje: se controla en el embalaje (OP 120)' },
  'ET-SATO-100X60': { fuera: 'etiqueta: se coloca y se controla en el embalaje (OP 120)' },
};
const { lineas, fecha } = leerBomDelArb(['21-9640', '21-9641', '21-9642', '21-9643', '304883', '304884']);
const fallasBom = materialesContraBom({ doc, bom: lineas, cobertura: COBERTURA });
errores.push(...fallasBom);

const { nWE, nFM, nCausas, apCount } = stats;
console.log(`AMFE 163 — TELAS TERMOFORMADAS 582D`);
console.log(`  operaciones ${doc.operations.length} · WE ${nWE} · modos de falla ${nFM} · causas ${nCausas} · AP ${Object.entries(apCount).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`  materiales contra la BOM del arb (export ${fecha.toISOString().slice(0, 10)}): ${fallasBom.length ? fallasBom.length + ' diferencias' : 'cierra en las dos direcciones'}`);
for (const op of doc.operations) {
  const cs = op.workElements.flatMap((w) => w.functions.flatMap((f) => f.failures.flatMap((fm) => fm.causes)));
  console.log(`   ${op.opNumber.padStart(3)} ${op.name.padEnd(46)} causas ${String(cs.length).padStart(2)}  H=${cs.filter((c) => c.ap === 'H').length} M=${cs.filter((c) => c.ap === 'M').length} L=${cs.filter((c) => c.ap === 'L').length}`);
}
const val = validateAmfeDoc(doc, doc.header.subject, AMFE_KEY);
printIssues('validador de la casa', val);
if (val.critical.length) errores.push(`${val.critical.length} criticos del validador`);
console.log(errores.length ? `\nERRORES (${errores.length}):\n  ${errores.join('\n  ')}` : '\nChequeos propios: OK');
console.log(`${candidatas.length} causas candidatas a caracteristica especial por S y O (las CC puestas: inflamabilidad y agujas).`);
mkdirSync('tmp/amfe163', { recursive: true });
writeFileSync('tmp/amfe163/amfe163.json', JSON.stringify(doc, null, 1));
if (!APPLY) { console.log('DRY-RUN. --apply para escribir.'); process.exit(errores.length ? 1 : 0); }
if (errores.length) { console.error('NO se escribe: hay errores.'); process.exit(1); }
await runWithValidation([{ id: ID, amfeNumber: AMFE_KEY, productName: doc.header.subject, before: vivo, after: doc }], true, async () => {
  await saveAmfe(sb, ID, doc, { expectedAmfeNumber: AMFE_KEY, extraFields: { revisions: JSON.stringify(doc.revisions), project_name: 'PWA/HILUX/TELAS_TERMOFORMADAS' } });
  console.log('guardado AMFE-2 (163)');
});
process.exit(0);
