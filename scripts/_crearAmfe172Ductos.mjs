/**
 * _crearAmfe172Ductos.mjs — crea el AMFE 172 (INSONOS / DUCTOS DE CALEFACCION, VW427 Patagonia,
 * cliente COZZUOL) en Supabase, rederivado al estandar de la casa.
 *
 * POR QUE SE REDERIVA Y NO SE PARCHEA EL REVA-4
 * Medido sobre sus 436 filas: 18 de 30 modos de falla tienen "error de operario" como causa
 * (prohibido por amfe.md §6 y por el gate CAUSE_CAPACITACION), "Control visual del operario"
 * repetido identico ~15 veces, severidad cargada por CAUSA en vez de por modo de falla, AP
 * escrito a mano ("Medio"/"M"/"L") en vez de calculado, Paso 6 vacio, y la OP70 repite literal
 * el modo de falla de la OP60. Diagnostico completo: docs/ductos-amfe-hallazgos.md
 *
 * DE DONDE SALE CADA DATO (no hay ninguno inventado)
 *   - Materiales y cantidades: export del ERP arb `C:\tmp\RELACIONES.TXT` del 21/08/2026.
 *   - Remaches 28 = 16 + 12: `INSUMOS_DUCTOS_CODIGOS_ARB.xlsx` hoja Consumptions, textual
 *     "16 remaches + 12 remaches"; desglose por nivel en el sinoptico REV05.
 *   - Los 8 braquets (4+1+1+2): mismas dos fuentes. Son las "visagras" de la HO.
 *   - Densidad superficial 400 +/- 30 g/m2 y su metodo: `PP-PET SOR MATERIAL REQUIREMENT
 *     52171.docx` + CVTC 52171-2023 §5.2.1 + Anexo A. OJO: la norma fija el METODO y remite el VALOR al plano;
 *     el 400 +/- 30 sale de la especificacion de material del cliente, no de la norma.
 *   - Flamabilidad <= 70 mm/min, GB 8410-2006, probeta 356x100 mm, min. 5 probetas:
 *     CVTC 52034-2021 §4.2.1.2, referenciada por CVTC 52171 §5.2.4.
 *   - Pasos, maquinas y utillajes: las 4 hojas de operacion de MP8146/MP8147/MP8148.
 *   - Secuencia y numeracion: Flujograma 158 Rev.A (regla no-pfd-no-ho: manda el flujograma).
 *
 * DECISIONES DE FAK QUE CIERRAN DUDAS (24/08/2026)
 *   - Espesor de la espuma: **gana el arb, 7 mm**. Fak: "la que este en el arb es la que vale,
 *     asi deberia ser". Se cierra la discusion 6 vs 7 mm; el AMFE no lleva el valor igual,
 *     porque los parametros van al Plan de Control.
 *   - Los codigos internos del arb NO van en el AMFE. El material se nombra; su codigo vive en
 *     la BOM. Fak, 24/08: "pusiste codigos que encima acabas de ver que probablemente
 *     cambiemos". El codigo interno no cambia — lo que falta es el del PROVEEDOR — pero de
 *     todos modos no corresponde en un documento que lee el cliente.
 *   - Part number del cliente: no existe en ninguna fuente del legajo.
 *
 * Uso:  node scripts/_crearAmfe172Ductos.mjs            (dry-run: arma, valida y muestra)
 *       node scripts/_crearAmfe172Ductos.mjs --apply    (escribe en Supabase)
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, parseData, calculateAP } from './_lib/amfeIo.mjs';

const APPLY = process.argv.includes('--apply');
const AMFE_KEY = 'AMFE-DUC-PAT';   // clave en Supabase (los de Patagonia usan clave, no numero)
const NUMERO_EMPRESA = '172';      // el que va en el documento oficial y en el listado maestro

/**
 * AP oficial. Se usa `calculateAP` de _lib/amfeIo.mjs, que es la transcripcion de la
 * Figura 3.5-3 del AIAG-VDA — la misma que usa el resto del sistema. No se reimplementa
 * aca: fue justamente una tabla propia mal transcrita la que tuvo 760 AP mal hasta el
 * 22/08/2026 (memoria `verificar_contra_la_fuente`). Nunca S*O*D.
 */
const calcularAP = calculateAP;

const id = () => randomUUID();

/**
 * causa(texto, prevencion, O, deteccion, D, S del MODO DE FALLA) — el AP se CALCULA.
 *
 * Los pares de alias del schema (`cause`/`description`, `ap`/`actionPriority`) se llenan
 * los dos: si uno queda vacio, el export o la UI que lee "el otro" muestra celda vacia
 * (check FIELD_ALIAS_DESYNC).
 *
 * Con AP=H el validador exige accion o el placeholder autorizado (bloqueante IATF). Se
 * pone el PLACEHOLDER, no una accion inventada: las acciones de optimizacion las define
 * el equipo APQP (amfe.md §5 y autonomy-contract).
 */
function causa(descripcion, prevControl, O, detControl, D, extra = {}) {
  return {
    id: id(),
    cause: descripcion,
    description: descripcion,
    preventionControl: prevControl,
    detectionControl: detControl,
    occurrence: O,
    detection: D,
    ...extra,
  };
}

/**
 * falla(descripcion, efecto, causas) — la S sale del EFECTO y el AP se calcula ACA.
 *
 * Ni la severidad ni el AP se pueden escribir a mano en ningun lado de este archivo: la S
 * la trae el efecto y el AP lo deriva `calculateAP`. Es la unica forma de que no vuelva a
 * pasar que dos modos de falla con el mismo efecto lleven S distintas.
 */
function falla(descripcion, ef, causas) {
  for (const c of causas) {
    const ap = calcularAP(ef.s, c.occurrence, c.detection);
    c.ap = ap;
    c.actionPriority = ap;
    if (ap === 'H' && !c.optimizationAction) c.optimizationAction = 'Pendiente definicion equipo APQP';
    // Toda causa con S=9 en este documento es de incumplimiento reglamentario (flamabilidad),
    // y `amfe.md` §2 dice que eso genera CC obligatoria independiente de S/O. Se asigna aca
    // para que no dependa de acordarse causa por causa. Normalmente las CC las pone solo Fak
    // (core-prohibiciones §2); para este AMFE lo autorizo el 24/08/2026: "D roja visible + CC
    // en el dato". Si el efecto deja de ser reglamentario, esto no se dispara.
    if (ef.s >= 9 && !c.specialChar) c.specialChar = 'CC';
  }
  return {
    id: id(),
    description: descripcion,
    failureMode: descripcion,
    severity: ef.s,
    effectLocal: ef.local,
    effectNextLevel: ef.next,
    effectEndUser: ef.end,
    causes: causas,
  };
}

function funcion(descripcion, requisitos, fallas) {
  return {
    id: id(),
    description: descripcion,
    functionDescription: descripcion,
    requirements: requisitos,
    failures: fallas,
  };
}

function we(type, name, funciones) {
  return { id: id(), name, type, functions: funciones };
}

function operacion(numero, nombre, funcionOperacion, funcionFoco, workElements) {
  return {
    id: id(),
    opNumber: numero,
    operationNumber: numero,
    name: nombre,
    operationName: nombre,
    operationFunction: funcionOperacion,
    focusElementFunction: funcionFoco,
    workElements,
  };
}

// ---------------------------------------------------------------------------
// Efectos (3 niveles obligatorios) — CADA EFECTO TRAE SU PROPIA SEVERIDAD.
//
// La S se asigna al EFECTO, no al modo de falla (AIAG-VDA §3.5.8: "Severity is a rating
// number associated with the most serious effect for a given failure mode"). Por eso la S
// vive aca y no la elige quien escribe la falla: asi es estructuralmente imposible que dos
// modos de falla con el MISMO efecto lleven severidades distintas — que es exactamente el
// hallazgo que devolvio la auditoria de cliente del 24/08 (un mismo efecto con S=5, 7, 8 y 9).
//
// Cada valor esta tomado de la Tabla P1 PFMEA SEVERITY del manual (leida en el original,
// pag. 116 del PDF), no de una tabla interna:
//   S=9  "Noncompliance with regulations"
//   S=8  "100% of product affected may have to be scrapped" / paro de mas de un turno
//   S=7  "A portion of the production run may have to be scrapped"
//   S=6  "Loss of convenience function"
// ---------------------------------------------------------------------------
const EF_SCRAP_INTERNO = {
  s: 7,   // P1: "A portion of the production run may have to be scrapped"
  local: 'Pieza rechazada en el puesto, se genera scrap de material',
  next: 'Reposicion del corte y atraso en la entrega del lote',
  end: 'Sin efecto en el vehiculo: la pieza no sale de planta',
};
const EF_RUIDO = {
  s: 6,   // P1 usuario final: "Loss of convenience function" (la funcion del insono es absorber ruido)
  local: 'Pieza aceptada con menor capacidad de absorcion acustica',
  next: 'El desvio se detecta en la linea de montaje del cliente',
  end: 'Mayor nivel de ruido en el habitaculo',
};
const EF_NO_MONTA = {
  s: 8,   // P1 "Ship to Plant": "Line shutdown greater than full production shift"
  local: 'Conjunto que no cierra con el sustrato plastico',
  next: 'Paro de linea e imposibilidad de ensamblar el conjunto',
  end: 'Vehiculo no ensamblable con esa pieza',
};
const EF_LEGAL = {
  s: 9,   // P1 usuario final: "Noncompliance with regulations"
  local: 'Material sin evidencia de cumplimiento de la norma del cliente',
  next: 'Bloqueo del lote en la recepcion del cliente',
  end: 'Incumplimiento de requisito de seguridad y reglamentacion en el vehiculo',
};
const EF_FALTANTE = {
  s: 8,   // P1 "Ship to Plant": paro de linea en el cliente
  local: 'Medio despachado con cantidad o identificacion incorrecta',
  next: 'Faltante o sobrante en la linea del cliente; reconteo del medio',
  end: 'Riesgo de paro de linea en el cliente final',
};

// ---------------------------------------------------------------------------
// OP 10 — RECEPCION. Aca vive la caracteristica D / CC (seguridad y reglamentacion).
// ---------------------------------------------------------------------------
const OP10 = operacion('10', 'RECEPCION DE MATERIALES',
  'Recibir, identificar y liberar la materia prima directa e indirecta contra los requisitos del cliente antes de habilitarla a produccion',
  'Materia prima liberada, identificada por lote y con evidencia de ensayo segun norma del cliente',
  [
    we('Material', 'Thinsulate', [
      funcion(
        'Aportar la capacidad de absorcion acustica especificada por el cliente',
        'Densidad superficial segun la especificacion de material del cliente',
        [
          falla('Material recibido fuera de la densidad superficial especificada', EF_RUIDO, [
            causa('Rollo recibido con una densidad distinta a la de la orden de compra',
              'El material se pide por su codigo de articulo y se recibe con certificado por lote',
              3,
              'Control de peso por lote con balanza electronica, con registro del resultado',
              6),
            causa('Variacion del material dentro de un mismo lote',
              'Densidad superficial declarada al proveedor en la especificacion de compra',
              4,
              'Control de peso por lote con balanza electronica',
              6),
          ]),
          falla('Material recibido sin evidencia de ensayo de flamabilidad contra la norma del cliente', EF_LEGAL, [
            causa('Certificado de lote sin el ensayo que exige la especificacion del material',
              'La especificacion de compra exige el ensayo de flamabilidad del material',
              5,
              'Ensayo de flamabilidad del lote en camara de flamabilidad',
              6, { specialChar: 'CC' }),
            causa('Lote liberado a produccion antes de contar con su certificado',
              'Material en estado pendiente de control en el sector de recepcion hasta contar con el certificado del lote',
              3,
              'Ensayo de flamabilidad del lote en camara de flamabilidad antes de habilitar el material',
              6, { specialChar: 'CC' }),
          ]),
          falla('Material recibido con contenido de polvo por encima del limite', EF_RUIDO, [
            causa('Degradacion de la fibra durante el transporte o el almacenamiento',
              'Requisito de contenido de polvo declarado al proveedor en la especificacion de compra',
              4,
              'Verificacion del certificado de lote contra el requisito de contenido de polvo',
              7),
          ]),
        ]),
    ]),
    we('Material', 'Espuma', [
      funcion(
        'Aportar el espesor y la densidad especificados en la zona de las bocas del defroster',
        'Espuma conforme al codigo de articulo indicado en la orden de compra',
        [
          falla('Espuma recibida con espesor distinto del especificado', EF_NO_MONTA, [
            causa('Espuma entregada con un espesor distinto al indicado en la orden de compra',
              'El material se pide por su codigo de articulo y se recibe con certificado por lote',
              5,
              'Control dimensional del espesor por lote en recepcion',
              7),
          ]),
        ]),
    ]),
    we('Material', 'Braquets del defroster central', [
      funcion(
        'Aportar los puntos de fijacion del defroster central',
        'Braquets del conjunto segun la BOM del producto',
        [
          falla('Faltante o mezcla de tipos de braquet en la entrega', EF_NO_MONTA, [
            causa('Los cuatro tipos de braquet tienen aspecto similar y se reciben en el mismo envio',
              'Recepcion por tipo de braquet, con conteo contra la BOM',
              4,
              'Conteo por tipo de braquet contra la BOM del conjunto al ingresar el lote',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de recepcion', [
      funcion(
        'Registrar el lote e identificar el material segun el procedimiento de recepcion',
        'Todo material ingresado queda registrado en el ERP arb con codigo y lote antes de pasar a produccion',
        [
          falla('Material ingresado sin registro de lote en el sistema', EF_LEGAL, [
            causa('El material se descarga directamente en el sector de produccion sin pasar por recepcion',
              'Sector de recepcion fisicamente separado, con material en estado pendiente de control hasta su liberacion',
              3,
              'Conciliacion entre el remito del proveedor y el alta de lote en el ERP arb',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Procedimiento de recepcion e inspeccion de materiales', [
      funcion(
        'Definir que se controla, con que metodo y contra que norma en cada material recibido',
        'Cada material tiene definido su ensayo, su norma y su criterio de aceptacion',
        [
          falla('Material liberado sin el ensayo que exige la norma del cliente', EF_LEGAL, [
            causa('Lote liberado a produccion sin contrastar el certificado contra el requisito del cliente',
              'Requisitos del cliente incorporados a la especificacion de compra del material',
              4,
              'Verificacion documental por lote contra la norma aplicable antes de liberar',
              7, { specialChar: 'CC' }),
          ]),
        ]),
    ]),
    we('Measurement', 'Balanza y probeta de flamabilidad', [
      funcion(
        'Controlar el peso del material y su comportamiento a la llama',
        'Balanza electronica del sector de recepcion',
        [
          falla('Control de peso no representativo del lote', EF_RUIDO, [
            causa('El control se reporta sin seguir el metodo definido para el material',
              'Metodo de control definido en el plan de control de recepcion del material',
              4,
              'El registro de recepcion exige el resultado del control para dar el material por liberado',
              7),
          ]),
        ]),
    ]),
    we('Environment', 'Sector de recepcion de materia prima', [
      funcion(
        'Preservar el material entre la recepcion y su uso',
        'Material separado por estado (pendiente de control / controlado e identificado)',
        [
          falla('Mezcla de material pendiente de control con material ya liberado', EF_LEGAL, [
            causa('Ambos estados comparten el mismo sector sin separacion fisica',
              'Sectores separados e identificados para material pendiente de control y material liberado',
              3,
              'Verificacion de la identificacion del material al retirarlo para produccion',
              7),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
// OP 20 — CORTE. Aplica a los 7 codigos. El corte es INTERNO (definicion de Fak 24/08/2026).
// ---------------------------------------------------------------------------
const OP20 = operacion('20', 'CORTE DE TELA EN MESA DE CORTE',
  'Cortar el thinsulate en mesa de corte automatica segun el programa y la tizada de cada codigo',
  'Cortes conformes al patron, identificados por codigo y sin contaminacion',
  [
    we('Machine', 'Mesa de corte automatica con sistema de vacio', [
      funcion(
        'Fijar el material por vacio y cortar con cuchilla siguiendo el programa cargado',
        'El corte reproduce el patron de la tizada de cada codigo dentro de la tolerancia del mylar de control',
        [
          falla('Desviacion dimensional del corte respecto del patron', EF_NO_MONTA, [
            causa('Perdida de vacio en la mesa: el material se desplaza durante el corte',
              'Verificacion del vacio de la mesa al inicio de cada lote, segun la hoja de operaciones',
              4,
              'Verificacion de las piezas cortadas contra el mylar de control en la estacion de corte',
              7),
            causa('Desgaste de la cuchilla de corte',
              'Cambio de cuchilla segun el plan de mantenimiento de la mesa de corte',
              4,
              'Verificacion de las piezas cortadas contra el mylar de control en la estacion de corte',
              7),
          ]),
          falla('Corte incompleto: la pieza queda unida al pliego', EF_SCRAP_INTERNO, [
            causa('Profundidad de corte insuficiente para el espesor del thinsulate',
              'Parametros de corte definidos por codigo en la hoja de operaciones',
              4,
              'Separacion manual de las piezas al retirar el pliego, donde el corte incompleto queda a la vista',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Programa de corte y tizada por codigo', [
      funcion(
        'Determinar el patron y el anidado de cada uno de los 7 codigos',
        'Cada codigo tiene su programa y su tizada identificados; el operario selecciona el que corresponde a la orden',
        [
          falla('Corte ejecutado con el programa de otro codigo', EF_NO_MONTA, [
            causa('Los siete codigos se cortan en la misma mesa y sus programas tienen nombres similares',
              'La orden de produccion indica el codigo y el programa que le corresponde',
              4,
              'Verificacion de la pieza cortada contra el mylar del codigo indicado en la orden',
              7),
          ]),
        ]),
    ]),
    we('Material', 'Thinsulate liberado por recepcion', [
      funcion(
        'Aportar el material especificado al corte de los 7 codigos',
        'Solo se corta material identificado como liberado por recepcion',
        [
          falla('Se corta material no liberado o de otra especificacion', EF_LEGAL, [
            causa('El rollo se retira del sector sin verificar su identificacion de estado',
              'Material liberado identificado y separado del pendiente de control en el sector de recepcion',
              3,
              'Verificacion de la identificacion del rollo contra la orden antes de montarlo en la mesa',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de mesa de corte', [
      funcion(
        'Montar el rollo, seleccionar el programa y separar e identificar los cortes',
        'Los cortes se identifican por codigo al separarlos del pliego',
        [
          falla('Cortes de distintos codigos mezclados al separarlos del pliego', EF_NO_MONTA, [
            causa('La tizada anida piezas de varios codigos en el mismo pliego y se separan sin identificar',
              'Identificacion del contenedor por codigo antes de empezar a separar los cortes del pliego',
              5,
              'Verificacion de la identificacion del contenedor contra el mylar del codigo antes del traslado',
              7),
          ]),
        ]),
    ]),
    we('Measurement', 'Mylar de control por codigo', [
      funcion(
        'Verificar el corte contra el patron fisico de cada codigo',
        'Existe un mylar por codigo, identificado y vigente',
        [
          falla('Verificacion hecha contra un mylar de otro codigo o deteriorado', EF_NO_MONTA, [
            causa('Los mylares se guardan juntos y sin identificacion visible del codigo',
              'Mylares identificados por codigo y con control de vigencia',
              4,
              'El registro de control de corte exige anotar el codigo del mylar utilizado',
              7),
          ]),
        ]),
    ]),
    we('Environment', 'Sector de mesa de corte', [
      funcion(
        'Mantener el material y los cortes libres de contaminacion',
        'Sector con limpieza periodica definida',
        [
          falla('Contaminacion de los cortes con polvo o particulas del sector', EF_RUIDO, [
            causa('Acumulacion de recortes y polvo de fibra alrededor de la mesa',
              'Limpieza periodica del sector de corte definida en el procedimiento',
              4,
              'Inspeccion visual del corte al separarlo del pliego',
              7),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
// OP 30 / 40 / 50 — solo MP8147
// ---------------------------------------------------------------------------
const OP30 = operacion('30', 'LAMINADO Y ADHESIVADO DE ESPUMA (Aplica solo a MP8147)',
  'Adherir la espuma a la lamina adhesiva antes del troquelado',
  'Conjunto espuma + adhesivo sin burbujas ni zonas sin adherir',
  [
    we('Material', 'Espuma y lamina adhesiva', [
      funcion(
        'Formar el conjunto espuma-adhesivo que despues se troquela',
        'Espuma y lamina adhesiva segun la BOM del conjunto',
        [
          falla('Zonas sin adherir entre la espuma y la lamina adhesiva', EF_NO_MONTA, [
            causa('Presion de laminado insuficiente sobre la superficie completa',
              'Parametros de laminado definidos en la hoja de operaciones',
              4,
              'Inspeccion visual del conjunto laminado antes de pasar al troquelado',
              7),
            causa('Lamina adhesiva aplicada sobre espuma con polvo de fibra en superficie',
              'Espuma almacenada protegida hasta su uso en el puesto de laminado',
              4,
              'Inspeccion visual de la superficie de la espuma antes de aplicar la lamina',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de laminado', [
      funcion(
        'Posicionar la espuma y aplicar la lamina adhesiva segun la hoja de operaciones',
        'La lamina cubre la superficie definida sin desbordes',
        [
          falla('Lamina adhesiva desplazada respecto de la espuma', EF_SCRAP_INTERNO, [
            causa('El puesto no tiene referencia de posicionado para alinear lamina y espuma',
              'Marcas de posicionado en la mesa de laminado',
              4,
              'Inspeccion visual del conjunto laminado contra la hoja de operaciones',
              7),
          ]),
        ]),
    ]),
  ]);

const OP40 = operacion('40', 'TROQUELADO DE ESPUMA (Aplica solo a MP8147)',
  'Troquelar el conjunto espuma-adhesivo para obtener las tiras que se aplican en las bocas del defroster',
  'Tiras troqueladas conformes al troquel, en la cantidad definida por conjunto',
  [
    we('Machine', 'Troqueladora', [
      funcion(
        'Cortar el conjunto laminado con el troquel correspondiente a la pieza',
        'Corte pasante y limpio, con las tiras separadas del sobrante',
        [
          falla('Troquelado incompleto: la tira no se separa del sobrante', EF_SCRAP_INTERNO, [
            causa('Filo del troquel desgastado por cantidad de golpes acumulados',
              'Plan de mantenimiento y control de filo de los troqueles',
              4,
              'Separacion manual de las tiras tras el golpe, donde el corte incompleto queda a la vista',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Identificacion de troqueles por pieza', [
      funcion(
        'Asignar a cada pieza el troquel que le corresponde',
        'Cada troquel esta identificado y su codigo figura en la hoja de operaciones',
        [
          falla('Uso de un troquel que no corresponde a la pieza', EF_NO_MONTA, [
            causa('Los troqueles se guardan juntos y su identificacion no es visible en el puesto',
              'Troqueles identificados con su codigo y referenciados en la hoja de operaciones',
              3,
              'Verificacion del codigo del troquel contra la hoja de operaciones antes de empezar el lote',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de troquelado', [
      funcion(
        'Posicionar el conjunto laminado en el troquel y evacuar las tiras',
        'Las tiras salen con la longitud definida en la hoja de operaciones',
        [
          falla('Conjunto mal posicionado en el troquel', EF_SCRAP_INTERNO, [
            causa('El troquel no tiene topes que limiten la posicion del conjunto',
              'Marcas de posicionado en la mesa de la troqueladora',
              3,
              'Verificacion de la tira troquelada contra la pieza patron del puesto',
              7),
          ]),
        ]),
    ]),
  ]);

const OP50 = operacion('50', 'PREARMADO Y REMACHADO DE BRAQUETS (Aplica solo a MP8147)',
  'Presentar el sustrato plastico con sus braquets y remacharlos en las posiciones definidas',
  'Braquets remachados en las zonas definidas en la hoja de operaciones',
  [
    we('Material', 'Braquets 1 a 4 y remaches POP', [
      funcion(
        'Fijar los ocho braquets al sustrato del defroster central',
        'Remachado de los braquets en las zonas definidas en la hoja de operaciones',
        [
          falla('Braquet montado en una posicion que no le corresponde', EF_NO_MONTA, [
            causa('Los cuatro tipos de braquet son parecidos entre si y se presentan juntos en el puesto',
              'Presentacion de los braquets separados por tipo en el puesto, segun la hoja de operaciones',
              4,
              'Verificacion del conjunto remachado contra la pieza patron del puesto',
              7),
          ]),
          falla('Remache faltante en alguna de las zonas definidas', EF_NO_MONTA, [
            causa('Las zonas se remachan en secuencia y no hay marca de avance sobre la pieza',
              'Secuencia de remachado numerada en la hoja de operaciones',
              4,
              'Conteo de remaches del conjunto contra la pieza patron antes de pasar al soldado',
              7),
          ]),
        ]),
    ]),
    we('Machine', 'Remachadora', [
      funcion(
        'Conformar el remache contra el sustrato y el braquet',
        'Remache conformado sin deformar el sustrato plastico',
        [
          falla('Remache flojo: no fija el braquet al sustrato', EF_NO_MONTA, [
            causa('Presion de la remachadora por debajo de la necesaria para el espesor del conjunto',
              'Parametro de presion definido en la hoja de operaciones del puesto',
              3,
              'Verificacion manual de la fijacion de cada braquet al terminar el conjunto',
              7),
            causa('Deformacion del sustrato plastico por exceso de presion en el remachado',
              'Parametro de presion definido en la hoja de operaciones del puesto',
              3,
              'Inspeccion visual del sustrato alrededor de cada remache contra la pieza patron',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Hoja de operaciones del prearmado', [
      funcion(
        'Definir la secuencia de las ocho zonas y la cantidad de remaches',
        'La hoja indica las zonas 1 a 8 y los 16 remaches del defroster',
        [
          falla('El conjunto avanza sin los 12 remaches del Air Duct Connect Bracket', EF_NO_MONTA, [
            causa('El conjunto se remacha en dos etapas y la segunda no tiene referencia visual en el puesto',
              'Ayuda visual del puesto con la secuencia completa de remachado del conjunto',
              5,
              'Conteo de remaches del conjunto contra la BOM en la inspeccion final',
              8),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
// OP 60 / 70 — MP8146, MP8147, MP8148
// ---------------------------------------------------------------------------
const OP60 = operacion('60', 'SOLDADO POR ULTRASONIDO (Aplica solo a MP8146, MP8147, MP8148)',
  'Soldar el insono al sustrato plastico por ultrasonido en los puntos definidos',
  'Todos los puntos de soldadura ejecutados, sin dañar el sustrato ni la cara vista del insono',
  [
    we('Machine', 'Equipo de soldadura por ultrasonido', [
      funcion(
        'Aportar la energia de soldadura en cada punto definido',
        'Parametros de soldadura segun la hoja de operaciones de cada pieza',
        [
          falla('Punto de soldadura sin fusion: el insono no queda fijado', EF_NO_MONTA, [
            causa('Energia por debajo de la necesaria para el espesor del conjunto',
              'Parametros de soldadura definidos por pieza en la hoja de operaciones',
              3,
              'Verificacion de la fijacion del insono en cada punto contra la pieza patron del puesto',
              7),
            causa('Desgaste del sonotrodo, que reduce la energia transmitida',
              'Plan de mantenimiento del equipo de ultrasonido',
              3,
              'Verificacion de la fijacion del insono en cada punto contra la pieza patron del puesto',
              7),
          ]),
          falla('Soldadura excesiva que perfora el insono o marca el sustrato', EF_RUIDO, [
            causa('Energia por encima de la necesaria para el espesor del conjunto',
              'Parametros de soldadura definidos por pieza en la hoja de operaciones',
              3,
              'Inspeccion visual de la cara vista del insono y del sustrato en cada punto soldado',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Cantidad y ubicacion de los puntos de soldadura', [
      funcion(
        'Definir cuantos puntos y donde se sueldan en cada pieza',
        'La cantidad de puntos definida prevalece sobre la posicion original del diseño del sustrato',
        [
          falla('Zonas definidas que quedan sin soldar', EF_NO_MONTA, [
            causa('Los puntos se marcan sobre el sustrato plastico y no siempre coinciden con el diseño del insono de tela',
              'Cantidad de puntos definida por pieza en la hoja de operaciones, con ayuda visual del recorrido',
              4,
              'Conteo de los puntos soldados contra la pieza patron del puesto al terminar el conjunto',
              7),
          ]),
        ]),
    ]),
    we('Machine', 'Dispositivo de posicionado del sustrato', [
      funcion(
        'Sujetar el sustrato en posicion durante el soldado',
        'La pieza queda fija y en posicion al bajar el dispositivo, segun la hoja de operaciones del MP8146',
        [
          falla('Sustrato desplazado durante el soldado', EF_NO_MONTA, [
            causa('El dispositivo no retiene la pieza en toda su longitud',
              'Fijacion de la alineacion con los primeros puntos de ultrasonido antes de completar el resto, segun la hoja de operaciones',
              4,
              'Verificacion de la posicion del insono contra la pieza patron al terminar el conjunto',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de soldado', [
      funcion(
        'Posicionar el insono sobre el sustrato y ejecutar los puntos',
        'El insono cubre la zona definida antes del primer punto',
        [
          falla('Insono posicionado fuera de la zona que debe cubrir', EF_RUIDO, [
            causa('El insono es flexible y no tiene referencia propia de posicionado sobre el sustrato',
              'Piloto de localizacion y ayuda visual de posicionado en el puesto, segun la hoja de operaciones',
              4,
              'Verificacion de la cobertura del insono contra la pieza patron antes de soldar',
              7),
          ]),
        ]),
    ]),
  ]);

const OP70 = operacion('70', 'ENSAMBLE DE SUSTRATOS CONSIGNADOS (Aplica solo a MP8146, MP8147, MP8148)',
  'Unir los sustratos plasticos consignados entre si y con el connect bracket para formar el conjunto entregable',
  'Conjunto completo, con todos sus componentes y sin faltantes',
  [
    we('Material', 'Sustratos plasticos consignados', [
      funcion(
        'Aportar los componentes plasticos que forman cada conjunto',
        'Cada codigo terminado lleva los componentes que define su BOM en el ERP',
        [
          falla('Conjunto ensamblado con un componente que no le corresponde', EF_NO_MONTA, [
            causa('Los sustratos del defroster central, RH y LH se presentan juntos en el puesto',
              'Presentacion de los componentes separados por codigo en el puesto de ensamble',
              4,
              'Verificacion del conjunto contra la pieza patron de cada codigo antes de la inspeccion final',
              8),
          ]),
          falla('Faltante de un componente en el conjunto', EF_NO_MONTA, [
            causa('El conjunto se arma en varias etapas y no hay verificacion de completitud entre ellas',
              'Secuencia de ensamble definida en la hoja de operaciones',
              4,
              'Verificacion del conjunto completo contra la BOM en la inspeccion final',
              8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de ensamble', [
      funcion(
        'Unir los componentes segun la secuencia definida',
        'La union queda firme y sin holgura entre componentes',
        [
          falla('Union floja entre el connect bracket y el conjunto', EF_NO_MONTA, [
            causa('Union del connect bracket ejecutada sin verificar la cantidad de remaches del conjunto',
              'Secuencia de ensamble del conjunto definida en la hoja de operaciones',
              5,
              'Conteo de remaches del conjunto contra la BOM en la inspeccion final',
              8),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
// OP 80 / 90 — los 7 codigos
// ---------------------------------------------------------------------------
const OP80 = operacion('80', 'INSPECCION FINAL',
  'Verificar el conjunto terminado contra la pieza patron y la BOM antes de liberarlo al embalaje',
  'Conjunto conforme, completo e identificado',
  [
    we('Measurement', 'Pieza patron por codigo', [
      funcion(
        'Servir de referencia de comparacion del conjunto terminado',
        'Existe una pieza patron por codigo, identificada y vigente',
        [
          falla('Conjunto liberado sin comparar contra la pieza patron del codigo', EF_NO_MONTA, [
            causa('No hay pieza patron disponible para todos los codigos en el puesto de inspeccion',
              'Piezas patron de los conjuntos definidas e identificadas por codigo en el puesto',
              4,
              'El registro de inspeccion final exige indicar la pieza patron utilizada',
              8),
          ]),
        ]),
    ]),
    we('Man', 'Inspector de calidad', [
      funcion(
        'Verificar aspecto, completitud e identificacion del conjunto',
        'Se verifica el 100% de los conjuntos antes del embalaje',
        [
          falla('Defecto de aspecto en la cara vista del insono que llega al cliente', EF_RUIDO, [
            causa('El defecto de soldadura queda en una zona que no se observa en la posicion habitual de inspeccion',
              'Secuencia de inspeccion definida que recorre todas las zonas soldadas',
              4,
              'Inspeccion visual del 100% de los conjuntos contra la pieza patron',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Criterio de aceptacion de la inspeccion final', [
      funcion(
        'Definir que se acepta y que se rechaza',
        'Conjunto conforme al patron de su codigo, completo y correctamente identificado',
        [
          falla('Criterio de aceptacion aplicado de forma distinta entre turnos', EF_RUIDO, [
            causa('Criterio de aceptacion aplicado sin una referencia fisica comun a los dos turnos',
              'Pieza patron del codigo disponible en el puesto de inspeccion final',
              5,
              'Verificacion del conjunto contra la pieza patron de su codigo',
              7),
          ]),
        ]),
    ]),
  ]);

const OP90 = operacion('90', 'EMBALAJE, IDENTIFICACION Y CONTROL DE CANTIDADES',
  'Embalar los conjuntos en su medio, identificarlos y verificar la cantidad de despacho',
  'Medio con la cantidad correcta, identificado y sin daño a las piezas',
  [
    we('Material', 'Medio de embalaje y etiqueta', [
      funcion(
        'Contener e identificar las piezas hasta el cliente',
        'Un medio identificado por codigo y cantidad, segun la ficha de embalaje del proyecto',
        [
          falla('Medio despachado con identificacion incorrecta', EF_FALTANTE, [
            causa('Los siete codigos comparten el mismo formato de etiqueta y de medio',
              'Etiqueta emitida desde el sistema con el codigo de la orden de produccion',
              3,
              'Verificacion de la etiqueta contra el contenido del medio antes de cerrarlo',
              7),
          ]),
          falla('Medio despachado sin identificacion', EF_FALTANTE, [
            causa('El medio se cierra antes de recibir la etiqueta impresa',
              'Secuencia de embalaje que coloca la etiqueta antes del cierre del medio',
              3,
              'Verificacion de la presencia de etiqueta en el control de cantidades de despacho',
              7),
          ]),
        ]),
    ]),
    we('Method', 'Control de cantidades de despacho', [
      funcion(
        'Verificar que la cantidad del medio coincide con la declarada',
        'La cantidad por medio esta definida en la ficha de embalaje del proyecto',
        [
          falla('Cantidad de piezas por medio menor a la declarada', EF_FALTANTE, [
            causa('El conteo se hace una sola vez y por la misma persona que embala',
              'Cantidad por medio definida en la ficha de embalaje y visible en el puesto',
              3,
              'Segundo conteo por un metodo distinto al utilizado para embalar',
              7),
          ]),
          falla('Cantidad de piezas por medio mayor a la declarada', EF_FALTANTE, [
            causa('El conteo se hace una sola vez y por la misma persona que embala',
              'Cantidad por medio definida en la ficha de embalaje y visible en el puesto',
              3,
              'Segundo conteo por un metodo distinto al utilizado para embalar',
              7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de embalaje', [
      funcion(
        'Colocar las piezas en el medio sin dañarlas',
        'Las piezas se ubican sin contacto directo ni presion entre ellas',
        [
          falla('Pieza deformada o marcada por la disposicion dentro del medio', EF_RUIDO, [
            causa('Las piezas se apilan sin separadores y quedan bajo presion durante el traslado',
              'Disposicion de las piezas en el medio definida en la ficha de embalaje del proyecto',
              4,
              'Inspeccion visual de la disposicion de las piezas antes de cerrar el medio',
              7),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
const OPERACIONES = [OP10, OP20, OP30, OP40, OP50, OP60, OP70, OP80, OP90];

const doc = {
  header: {
    scope: 'INSONOS / DUCTOS DE CALEFACCION - VW427-1LA_K-PATAGONIA',
    subject: 'INSONOS / DUCTOS DE CALEFACCION',
    partNumber: 'MP8137 / MP8146 / MP8147 / MP8148 / MP8149 / MP8150 / MP8151',
    applicableParts: [
      'MP8137 HUSH_PANEL ASS',
      'MP8146 AIR DUCT SUB ASS1',
      'MP8147 DEFROSTER DUCT CTR SUBSTRATE ASS',
      'MP8148 CONSL AIR DUCT ASS',
      'MP8149 IP_UPPER_SUBSTRATE',
      'MP8150 FRONT EXTEND PANEL LH y RH',
      'MP8151 CNSL_SIDE PANEL LH y RH',
    ].join(', '),
    client: 'COZZUOL',
    customerName: 'COZZUOL',
    companyName: 'BARACK MERCOSUL',
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    modelYear: 'VW427-1LA_K - PATAGONIA',
    amfeNumber: NUMERO_EMPRESA,
    rev: 'A',
    revisionLevel: 'A',
    amfeDate: '24/08/2026',
    revDate: '24/08/2026',
    responsibleEngineer: 'Carlos Baptista (Ingenieria)',
    processResponsible: 'Carlos Baptista',
    elaboratedBy: 'Facundo Santoro',
    preparedBy: 'Facundo Santoro',
    reviewedBy: 'Carlos Baptista',
    approvedBy: '',
    plantApproval: '',
    coreTeam: [
      'Carlos Baptista (Ingenieria)',
      'Manuel Meszaros (Calidad)',
      'Marcelo Nieve (Calidad)',
      'Paulo Centurion (Producto)',
    ],
    confidentiality: 'Confidencial',
  },
  operations: OPERACIONES,
  revisions: [
    {
      rev: 'A',
      date: '24/08/2026',
      item: 'N/A.',
      // En una Rev. A va 'EMISION INICIAL.' y nada mas. El log lo lee el CLIENTE y la
      // auditoria IATF: enumerar ahi que se incorporo o que se alineo cuenta que antes no
      // estaba. Lo que cambio vive en el mail y en docs/ductos-amfe-hallazgos.md.
      // Memoria `feedback_documento_no_confiesa_como_se_hizo`.
      details: 'EMISION INICIAL.',
      pswDate: '',
      modifiedBy: 'FS',
    },
  ],
};

// ---------------------------------------------------------------------------
// Estadisticas y chequeos propios antes de tocar Supabase
// ---------------------------------------------------------------------------
let nWE = 0, nFn = 0, nFM = 0, nCausas = 0, sinAP = 0, tbd = 0, conCC = 0, causasConSOD = 0;
const apCount = {};
for (const op of doc.operations) {
  for (const w of op.workElements) {
    nWE++;
    for (const f of w.functions) {
      nFn++;
      if (/TBD/.test(f.requirements)) tbd++;
      for (const fm of f.failures) {
        nFM++;
        for (const c of fm.causes) {
          nCausas++;
          if (!c.ap) sinAP++; else apCount[c.ap] = (apCount[c.ap] || 0) + 1;
          if (fm.severity && c.occurrence && c.detection) causasConSOD++;
          if (c.specialChar === 'CC') conCC++;
          if (/TBD/.test(c.preventiveControl) || /TBD/.test(c.detectionControl)) tbd++;
        }
      }
    }
  }
}

console.log(`AMFE ${NUMERO_EMPRESA} — INSONOS / DUCTOS DE CALEFACCION\n`);
console.log(`  operaciones : ${doc.operations.length}`);
console.log(`  work elements: ${nWE}`);
console.log(`  funciones   : ${nFn}`);
console.log(`  modos de falla: ${nFM}`);
console.log(`  causas      : ${nCausas}`);
console.log(`  AP          : ${Object.entries(apCount).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`  sin AP      : ${sinAP}`);
console.log(`  con CC      : ${conCC}`);
console.log(`  con TBD     : ${tbd}`);

// chequeos duros propios
const errores = [];
if (sinAP) errores.push(`${sinAP} causas sin AP calculado`);
for (const op of doc.operations) {
  if (!op.workElements.length) errores.push(`OP${op.opNumber} sin work elements`);
  for (const w of op.workElements) for (const f of w.functions) {
    if (!f.failures.length) errores.push(`OP${op.opNumber}/${w.name} funcion sin fallas`);
    for (const fm of f.failures) {
      if (!fm.effectLocal || !fm.effectNextLevel || !fm.effectEndUser) errores.push(`OP${op.opNumber} FM sin los 3 efectos`);
      if (!fm.causes.length) errores.push(`OP${op.opNumber} FM sin causas`);
      for (const c of fm.causes) {
        if (/error de operario|error humano|error del operario/i.test(c.description)) errores.push(`OP${op.opNumber} causa "error de operario": ${c.description.slice(0, 40)}`);
        if (/capacitaci/i.test(c.preventiveControl)) errores.push(`OP${op.opNumber} control preventivo de capacitacion`);
      }
    }
  }
}
console.log(errores.length ? `\nERRORES:\n  ${errores.join('\n  ')}` : '\nChequeos propios: OK (sin "error de operario", sin controles de capacitacion, 3 efectos en todos los FM, todos los AP calculados)');

mkdirSync('tmp/ductos', { recursive: true });
writeFileSync('tmp/ductos/amfe172.json', JSON.stringify(doc, null, 1));
console.log('\nJSON escrito en tmp/ductos/amfe172.json');

if (!APPLY) {
  console.log('\nDRY-RUN. Corre con --apply para escribir en Supabase.');
  process.exit(errores.length ? 1 : 0);
}
if (errores.length) { console.error('\nNO se escribe: hay errores.'); process.exit(1); }

const sb = await connectSupabase();
const { data: ex } = await sb.from('amfe_documents').select('id,amfe_number').eq('amfe_number', AMFE_KEY);
if (ex && ex.length) { console.error(`\n${AMFE_KEY} YA EXISTE (id=${ex[0].id}). No se duplica.`); process.exit(1); }

const nuevoId = randomUUID();
const { error } = await sb.from('amfe_documents').insert({
  id: nuevoId,
  amfe_number: AMFE_KEY,
  project_name: 'VW427-1LA_K-PATAGONIA',
  subject: doc.header.subject,
  client: 'COZZUOL',
  part_number: doc.header.partNumber,
  responsible: doc.header.processResponsible,
  organization: 'BARACK MERCOSUL',
  status: 'draft',
  operation_count: doc.operations.length,
  cause_count: nCausas,
  // Estos tres los lee el registro de la app para mostrar el riesgo del documento. Si quedan
  // en 0 el AMFE aparece como si no tuviera ninguna causa de prioridad alta. Se calculan con
  // la MISMA logica que `computeAmfeStats()` de utils/repositories/amfeRepository.ts.
  // Los omiti en la primera carga y el auditor los encontro en 0 con 35 causas AP=H reales.
  ap_h_count: apCount.H || 0,
  ap_m_count: apCount.M || 0,
  coverage_percent: nCausas > 0 ? Math.round((causasConSOD / nCausas) * 100) : 0,
  start_date: '2026-08-24',
  last_revision_date: '2026-08-24',
  revision_level: 'A',
  data: JSON.stringify(doc),
  revisions: JSON.stringify(doc.revisions),
  checksum: '',
});
if (error) { console.error('INSERT FALLO:', error.message); process.exit(1); }

const { data: v } = await sb.from('amfe_documents').select('id,operation_count,cause_count,data').eq('id', nuevoId).single();
const back = parseData(v.data);
console.log(`\nINSERT OK id=${nuevoId}`);
console.log(`  verificado: ops=${v.operation_count} causas=${v.cause_count} | data.operations es array: ${Array.isArray(back.operations)} | ops leidas: ${back.operations.length}`);
