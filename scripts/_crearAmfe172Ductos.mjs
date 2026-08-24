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
 *     52171.docx` + CVTC 52171-2023 Anexo A (promedio de 3 probetas, precision 1 g/m2).
 *   - Flamabilidad <= 70 mm/min, GB 8410-2006, probeta 356x100 mm, min. 5 probetas:
 *     CVTC 52034-2021 §4.2.1.2, referenciada por CVTC 52171 §5.2.4.
 *   - Pasos, maquinas y utillajes: las 4 hojas de operacion de MP8146/MP8147/MP8148.
 *   - Secuencia y numeracion: Flujograma 158 Rev.A (regla no-pfd-no-ho: manda el flujograma).
 *
 * LO QUE VA TBD A PROPOSITO (core-prohibiciones §1: falta el dato real, no se inventa)
 *   - Espesor de la espuma: el ERP y la BOM dicen 7 mm, el AMFE viejo dice 6 mm. Sin plano ni
 *     ficha del proveedor Mentvil no se puede dirimir. La densidad 60 kg/m3 si es unanime.
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
function causa(descripcion, prevControl, O, detControl, D, severidadFM, extra = {}) {
  const ap = calcularAP(severidadFM, O, D);
  return {
    id: id(),
    cause: descripcion,
    description: descripcion,
    preventionControl: prevControl,
    detectionControl: detControl,
    occurrence: O,
    detection: D,
    ap,
    actionPriority: ap,
    ...(ap === 'H' ? { optimizationAction: 'Pendiente definicion equipo APQP' } : {}),
    ...extra,
  };
}

/** falla(desc, S, efectos{local,next,end}, causas[]) — la S es del MODO DE FALLA. */
function falla(descripcion, S, ef, causas) {
  return {
    id: id(),
    description: descripcion,
    failureMode: descripcion,
    severity: S,
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
// Efectos reutilizables (3 niveles obligatorios — amfe.md §3)
// ---------------------------------------------------------------------------
const EF_SCRAP_INTERNO = {
  local: 'Pieza rechazada en el puesto, se genera scrap de material',
  next: 'Reposicion del corte y atraso en la entrega del lote a Cozzuol',
  end: 'Sin efecto en el vehiculo: la pieza no sale de planta',
};
const EF_RUIDO = {
  local: 'Pieza aceptada con menor capacidad de absorcion acustica',
  next: 'Cozzuol monta el conjunto y el desvio se detecta recien en linea VW',
  end: 'Mayor nivel de ruido en el habitaculo',
};
const EF_NO_MONTA = {
  local: 'Conjunto que no cierra con el sustrato plastico',
  next: 'Paro de linea en Cozzuol e imposibilidad de ensamblar el conjunto',
  end: 'Vehiculo no ensamblable con esa pieza',
};
const EF_LEGAL = {
  local: 'Material sin evidencia de cumplimiento de la norma del cliente',
  next: 'Rechazo del PPAP por Cozzuol y bloqueo del lote',
  end: 'Incumplimiento de requisito de seguridad y reglamentacion en el vehiculo',
};
const EF_FALTANTE = {
  local: 'Medio despachado con cantidad o identificacion incorrecta',
  next: 'Faltante o sobrante en la linea de Cozzuol; reconteo del medio',
  end: 'Riesgo de paro de linea en el cliente final',
};

// ---------------------------------------------------------------------------
// OP 10 — RECEPCION. Aca vive la caracteristica D / CC (seguridad y reglamentacion).
// ---------------------------------------------------------------------------
const OP10 = operacion('10', 'RECEPCION DE MATERIALES',
  'Recibir, identificar y liberar la materia prima directa e indirecta contra los requisitos del cliente antes de habilitarla a produccion',
  'Materia prima liberada, identificada por lote y con evidencia de ensayo segun norma del cliente',
  [
    we('Material', 'Thinsulate 427TEL002COR01 (rollo 1,6 m x 50 m, SINOYQX)', [
      funcion(
        'Aportar la capacidad de absorcion acustica especificada por el cliente',
        'Densidad superficial 400 +/- 30 g/m2 segun CVTC 52171-2023 §5.1.1. Metodo: Anexo A de la misma norma, promedio de 3 probetas con precision de 1 g/m2',
        [
          falla('Material recibido fuera de la densidad superficial especificada', 7, EF_RUIDO, [
            causa('El rollo entregado corresponde a una densidad distinta de la solicitada en la orden de compra',
              'La orden de compra indica el codigo 427TEL002COR01 con su densidad; el proveedor emite certificado por lote',
              3,
              'Ensayo de densidad superficial por lote segun el metodo del Anexo A de CVTC 52171-2023, con registro del resultado',
              4, 7),
            causa('Variacion del proceso del proveedor dentro de un mismo lote',
              'Tolerancia de densidad superficial declarada al proveedor en la especificacion de compra',
              4,
              'Ensayo de densidad superficial por lote segun el metodo del Anexo A de CVTC 52171-2023',
              4, 7),
          ]),
          falla('Material recibido sin evidencia de ensayo de flamabilidad contra la norma del cliente', 9, EF_LEGAL, [
            causa('El certificado del proveedor declara ensayos de otras normas (UL 94, DIN 4102, EN 45545-2, FMVSS 302) y no CVTC 52034 / GB 8410',
              'La especificacion de compra exige ensayo de flamabilidad segun CVTC 52034-2021 y su remision a GB 8410-2006',
              5,
              'Verificacion documental del certificado de flamabilidad del lote contra el criterio de aceptacion de CVTC 52034-2021 y su remision a GB 8410-2006',
              5, 9, { specialChar: 'CC' }),
            causa('Lote liberado a produccion antes de recibir el certificado del proveedor',
              'Material en estado pendiente de control en el sector de recepcion hasta contar con el certificado del lote',
              3,
              'Verificacion documental del certificado de lote contra CVTC 52034 antes de habilitar el material',
              4, 9, { specialChar: 'CC' }),
          ]),
          falla('Material recibido con contenido de polvo por encima del limite', 6, EF_RUIDO, [
            causa('Degradacion de la fibra por manipulacion o almacenamiento del proveedor',
              'Requisito de contenido de polvo declarado al proveedor segun CVTC 52167',
              4,
              'Verificacion del certificado de lote contra el criterio de contenido de polvo de CVTC 52167',
              5, 6),
          ]),
        ]),
    ]),
    we('Material', 'Espuma 427ESP003TRO01 (60 kg/m3, proveedor Mentvil)', [
      funcion(
        'Aportar el espesor y la densidad especificados en la zona de las bocas del defroster',
        'Densidad 60 kg/m3. ESPESOR: TBD — el ERP y la BOM declaran 7 mm y el AMFE anterior 6 mm; no hay plano ni ficha del proveedor que lo dirima',
        [
          falla('Espuma recibida con espesor distinto del especificado', 6, EF_NO_MONTA, [
            causa('La especificacion de compra no fija un espesor unico: conviven 6 mm y 7 mm en la documentacion interna',
              'TBD — requiere definir el espesor contra el plano del cliente o la ficha del proveedor antes de fijar el control',
              5,
              'TBD — control dimensional de espesor por lote, a definir junto con la especificacion',
              6, 6),
          ]),
        ]),
    ]),
    we('Material', 'Braquets 427VAR002/003/004/005MON01 (Defroster Duct Ctr Braquet 1 a 4)', [
      funcion(
        'Aportar los 8 puntos de fijacion del defroster central (4 + 1 + 1 + 2 por conjunto)',
        'Ocho braquets por conjunto MP8147, segun BOM del ERP y sinoptico del producto',
        [
          falla('Faltante o mezcla de tipos de braquet en la entrega', 6, EF_NO_MONTA, [
            causa('Los cuatro tipos de braquet tienen aspecto similar y se reciben en el mismo envio',
              'Recepcion por codigo de articulo, con conteo por tipo contra la cantidad que define la BOM',
              4,
              'Conteo por tipo de braquet contra la BOM del conjunto al ingresar el lote',
              4, 6),
          ]),
        ]),
    ]),
    we('Man', 'Operador de recepcion', [
      funcion(
        'Registrar el lote e identificar el material segun el procedimiento de recepcion',
        'Todo material ingresado queda registrado en el ERP arb con codigo y lote antes de pasar a produccion',
        [
          falla('Material ingresado sin registro de lote en el sistema', 5, EF_LEGAL, [
            causa('El material se descarga directamente en el sector de produccion sin pasar por recepcion',
              'Sector de recepcion fisicamente separado, con material en estado pendiente de control hasta su liberacion',
              3,
              'Conciliacion entre el remito del proveedor y el alta de lote en el ERP arb',
              4, 5),
          ]),
        ]),
    ]),
    we('Method', 'Procedimiento de recepcion e inspeccion de materiales', [
      funcion(
        'Definir que se controla, con que metodo y contra que norma en cada material recibido',
        'Cada material tiene definido su ensayo, su norma y su criterio de aceptacion',
        [
          falla('Material liberado sin el ensayo que exige la norma del cliente', 9, EF_LEGAL, [
            causa('El procedimiento de recepcion no incorpora todavia los requisitos de las normas CVTC del proyecto',
              'Especificaciones CVTC 52171, 52034, 52088, 22001 y 52167 incorporadas al procedimiento de recepcion del proyecto',
              4,
              'Verificacion documental por lote contra la norma aplicable antes de liberar',
              5, 9, { specialChar: 'CC' }),
          ]),
        ]),
    ]),
    we('Measurement', 'Balanza y probeta de flamabilidad', [
      funcion(
        'Medir la densidad superficial y verificar el comportamiento a la llama',
        'Balanza con resolucion acorde al metodo del Anexo A de CVTC 52171-2023',
        [
          falla('Medicion de densidad superficial no representativa', 6, EF_RUIDO, [
            causa('Se reporta el valor de una sola probeta en lugar del promedio de tres que exige el metodo',
              'Metodo de ensayo del Anexo A de CVTC 52171 incorporado al registro de recepcion, con las tres probetas',
              4,
              'El registro de recepcion exige las tres mediciones y su promedio para dar por valido el ensayo',
              4, 6),
          ]),
        ]),
    ]),
    we('Environment', 'Sector de recepcion de materia prima', [
      funcion(
        'Preservar el material entre la recepcion y su uso',
        'Material separado por estado (pendiente de control / controlado e identificado)',
        [
          falla('Mezcla de material pendiente de control con material ya liberado', 7, EF_LEGAL, [
            causa('Ambos estados comparten el mismo sector sin separacion fisica',
              'Sectores separados e identificados para material pendiente de control y material liberado',
              3,
              'Verificacion de la identificacion del material al retirarlo para produccion',
              5, 7),
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
          falla('Desviacion dimensional del corte respecto del patron', 7, EF_NO_MONTA, [
            causa('Perdida de vacio en la mesa: el material se desplaza durante el corte',
              'Verificacion del vacio de la mesa al inicio de cada lote, segun la hoja de operaciones',
              4,
              'Verificacion de las piezas cortadas contra el mylar de control en la estacion de corte',
              4, 7),
            causa('Desgaste de la cuchilla de corte',
              'Cambio de cuchilla segun el plan de mantenimiento de la mesa de corte',
              4,
              'Verificacion de las piezas cortadas contra el mylar de control en la estacion de corte',
              4, 7),
          ]),
          falla('Corte incompleto: la pieza queda unida al pliego', 5, EF_SCRAP_INTERNO, [
            causa('Profundidad de corte insuficiente para el espesor del thinsulate',
              'Parametros de corte definidos por codigo en la hoja de operaciones',
              4,
              'Separacion manual de las piezas al retirar el pliego, donde el corte incompleto queda a la vista',
              3, 5),
          ]),
        ]),
    ]),
    we('Method', 'Programa de corte y tizada por codigo', [
      funcion(
        'Determinar el patron y el anidado de cada uno de los 7 codigos',
        'Cada codigo tiene su programa y su tizada identificados; el operario selecciona el que corresponde a la orden',
        [
          falla('Corte ejecutado con el programa de otro codigo', 8, EF_NO_MONTA, [
            causa('Los siete codigos se cortan en la misma mesa y sus programas tienen nombres similares',
              'La orden de produccion indica el codigo y el programa que le corresponde',
              4,
              'Verificacion de la pieza cortada contra el mylar del codigo indicado en la orden',
              4, 8),
          ]),
        ]),
    ]),
    we('Material', 'Thinsulate 427TEL002COR01 liberado por recepcion', [
      funcion(
        'Aportar el material especificado al corte de los 7 codigos',
        'Solo se corta material identificado como liberado por recepcion',
        [
          falla('Se corta material no liberado o de otra especificacion', 8, EF_LEGAL, [
            causa('El rollo se retira del sector sin verificar su identificacion de estado',
              'Material liberado identificado y separado del pendiente de control en el sector de recepcion',
              3,
              'Verificacion del codigo y la identificacion del rollo contra la orden antes de montarlo en la mesa',
              4, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de mesa de corte', [
      funcion(
        'Montar el rollo, seleccionar el programa y separar e identificar los cortes',
        'Los cortes se identifican por codigo al separarlos del pliego',
        [
          falla('Cortes de distintos codigos mezclados al separarlos del pliego', 6, EF_NO_MONTA, [
            causa('La tizada anida piezas de varios codigos en el mismo pliego y se separan sin identificar',
              'Identificacion del contenedor por codigo antes de empezar a separar los cortes del pliego',
              5,
              'Verificacion de la identificacion del contenedor contra el mylar del codigo antes del traslado',
              5, 6),
          ]),
        ]),
    ]),
    we('Measurement', 'Mylar de control por codigo', [
      funcion(
        'Verificar el corte contra el patron fisico de cada codigo',
        'Existe un mylar por codigo, identificado y vigente',
        [
          falla('Verificacion hecha contra un mylar de otro codigo o deteriorado', 7, EF_NO_MONTA, [
            causa('Los mylares se guardan juntos y sin identificacion visible del codigo',
              'Mylares identificados por codigo y con control de vigencia',
              4,
              'El registro de control de corte exige anotar el codigo del mylar utilizado',
              5, 7),
          ]),
        ]),
    ]),
    we('Environment', 'Sector de mesa de corte', [
      funcion(
        'Mantener el material y los cortes libres de contaminacion',
        'Sector con limpieza periodica definida',
        [
          falla('Contaminacion de los cortes con polvo o particulas del sector', 4, EF_RUIDO, [
            causa('Acumulacion de recortes y polvo de fibra alrededor de la mesa',
              'Limpieza periodica del sector de corte definida en el procedimiento',
              4,
              'Inspeccion visual del corte al separarlo del pliego',
              5, 4),
          ]),
        ]),
    ]),
  ]);

// ---------------------------------------------------------------------------
// OP 30 / 40 / 50 — solo MP8147
// ---------------------------------------------------------------------------
const OP30 = operacion('30', 'LAMINADO Y ADHESIVADO DE ESPUMA (Aplica solo a MP8147)',
  'Adherir la espuma a la lamina adhesiva tesa antes del troquelado',
  'Conjunto espuma + adhesivo sin burbujas ni zonas sin adherir',
  [
    we('Material', 'Espuma 427ESP003TRO01 y rollo tesa 52110 (1500 mm x 200 m)', [
      funcion(
        'Formar el conjunto espuma-adhesivo que despues se troquela',
        'Consumo de espuma y de tesa identicos por conjunto (0,03714 m2 cada uno, segun BOM del ERP)',
        [
          falla('Zonas sin adherir entre la espuma y la lamina adhesiva', 6, EF_NO_MONTA, [
            causa('Presion de laminado insuficiente sobre la superficie completa',
              'Parametros de laminado definidos en la hoja de operaciones',
              4,
              'Inspeccion visual del conjunto laminado antes de pasar al troquelado',
              5, 6),
            causa('Lamina adhesiva aplicada sobre espuma con polvo de fibra en superficie',
              'Espuma almacenada protegida hasta su uso en el puesto de laminado',
              4,
              'Inspeccion visual de la superficie de la espuma antes de aplicar la lamina',
              5, 6),
          ]),
        ]),
    ]),
    we('Man', 'Operador de laminado', [
      funcion(
        'Posicionar la espuma y aplicar la lamina adhesiva segun la hoja de operaciones',
        'La lamina cubre la superficie definida sin desbordes',
        [
          falla('Lamina adhesiva desplazada respecto de la espuma', 5, EF_SCRAP_INTERNO, [
            causa('El puesto no tiene referencia de posicionado para alinear lamina y espuma',
              'Marcas de posicionado en la mesa de laminado',
              4,
              'Inspeccion visual del conjunto laminado contra la hoja de operaciones',
              5, 5),
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
          falla('Troquelado incompleto: la tira no se separa del sobrante', 4, EF_SCRAP_INTERNO, [
            causa('Filo del troquel desgastado por cantidad de golpes acumulados',
              'Plan de mantenimiento y control de filo de los troqueles',
              4,
              'Separacion manual de las tiras tras el golpe, donde el corte incompleto queda a la vista',
              3, 4),
          ]),
        ]),
    ]),
    we('Method', 'Identificacion de troqueles por pieza', [
      funcion(
        'Asignar a cada pieza el troquel que le corresponde',
        'Cada troquel esta identificado y su codigo figura en la hoja de operaciones',
        [
          falla('Uso de un troquel que no corresponde a la pieza', 7, EF_NO_MONTA, [
            causa('Los troqueles se guardan juntos y su identificacion no es visible en el puesto',
              'Troqueles identificados con su codigo y referenciados en la hoja de operaciones',
              3,
              'Verificacion del codigo del troquel contra la hoja de operaciones antes de empezar el lote',
              5, 7),
          ]),
        ]),
    ]),
    we('Man', 'Operador de troquelado', [
      funcion(
        'Posicionar el conjunto laminado en el troquel y evacuar las tiras',
        'Las tiras salen con la longitud definida de 670 mm segun la hoja de operaciones',
        [
          falla('Conjunto mal posicionado en el troquel', 6, EF_SCRAP_INTERNO, [
            causa('El troquel no tiene topes que limiten la posicion del conjunto',
              'Marcas de posicionado en la mesa de la troqueladora',
              3,
              'Verificacion de la tira troquelada contra la pieza patron del puesto',
              5, 6),
          ]),
        ]),
    ]),
  ]);

const OP50 = operacion('50', 'PREARMADO Y REMACHADO DE BRAQUETS (Aplica solo a MP8147)',
  'Presentar el sustrato plastico con sus ocho braquets y remacharlos en las posiciones definidas',
  'Ocho braquets remachados en las zonas 1 a 8 con 16 remaches, segun la hoja de operaciones',
  [
    we('Material', 'Braquets 1 a 4 (4+1+1+2 por conjunto) y remaches POP 7,6 x 3,6 mm', [
      funcion(
        'Fijar los ocho braquets al sustrato del defroster central',
        'Dieciseis remaches en las ocho zonas definidas en la hoja de operaciones del MP8147 CENTRAL',
        [
          falla('Braquet montado en una posicion que no le corresponde', 7, EF_NO_MONTA, [
            causa('Los cuatro tipos de braquet son parecidos entre si y se presentan juntos en el puesto',
              'Presentacion de los braquets separados por tipo en el puesto, segun la hoja de operaciones',
              4,
              'Verificacion del conjunto remachado contra la pieza patron del puesto',
              5, 7),
          ]),
          falla('Remache faltante en alguna de las ocho zonas', 7, EF_NO_MONTA, [
            causa('Las ocho zonas se remachan en secuencia y no hay marca de avance sobre la pieza',
              'Secuencia de remachado numerada de 1 a 8 en la hoja de operaciones',
              4,
              'Conteo de remaches del conjunto contra la pieza patron antes de pasar al soldado',
              4, 7),
          ]),
        ]),
    ]),
    we('Machine', 'Remachadora', [
      funcion(
        'Conformar el remache contra el sustrato y el braquet',
        'Remache conformado sin deformar el sustrato plastico',
        [
          falla('Remache flojo: no fija el braquet al sustrato', 7, EF_NO_MONTA, [
            causa('Presion de la remachadora por debajo de la necesaria para el espesor del conjunto',
              'Parametro de presion definido en la hoja de operaciones del puesto',
              3,
              'Verificacion manual de la fijacion de cada braquet al terminar el conjunto',
              5, 7),
            causa('Deformacion del sustrato plastico por exceso de presion en el remachado',
              'Parametro de presion definido en la hoja de operaciones del puesto',
              3,
              'Inspeccion visual del sustrato alrededor de cada remache contra la pieza patron',
              5, 7),
          ]),
        ]),
    ]),
    we('Method', 'Hoja de operaciones del prearmado', [
      funcion(
        'Definir la secuencia de las ocho zonas y la cantidad de remaches',
        'La hoja indica las zonas 1 a 8 y los 16 remaches del defroster',
        [
          falla('El conjunto avanza sin los 12 remaches del Air Duct Connect Bracket', 6, EF_NO_MONTA, [
            causa('La hoja de operaciones documenta los 16 remaches del defroster pero no los 12 del connect bracket, que si estan en la BOM',
              'TBD — completar la hoja de operaciones con los 12 remaches del MP7457 antes de fijar el control preventivo',
              5,
              'Conteo de remaches del conjunto contra la BOM en la inspeccion final',
              4, 6),
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
    we('Machine', 'Pistola de ultrasonido', [
      funcion(
        'Aportar la energia de soldadura en cada punto definido',
        'Parametros de soldadura segun la hoja de operaciones de cada pieza',
        [
          falla('Punto de soldadura sin fusion: el insono no queda fijado', 7, EF_NO_MONTA, [
            causa('Energia por debajo de la necesaria para el espesor del conjunto',
              'Parametros de soldadura definidos por pieza en la hoja de operaciones',
              3,
              'Verificacion de la fijacion del insono en cada punto contra la pieza patron del puesto',
              5, 7),
            causa('Desgaste del sonotrodo, que reduce la energia transmitida',
              'Plan de mantenimiento del equipo de ultrasonido',
              3,
              'Verificacion de la fijacion del insono en cada punto contra la pieza patron del puesto',
              5, 7),
          ]),
          falla('Soldadura excesiva que perfora el insono o marca el sustrato', 7, EF_RUIDO, [
            causa('Energia por encima de la necesaria para el espesor del conjunto',
              'Parametros de soldadura definidos por pieza en la hoja de operaciones',
              3,
              'Inspeccion visual de la cara vista del insono y del sustrato en cada punto soldado',
              4, 7),
          ]),
        ]),
    ]),
    we('Method', 'Cantidad y ubicacion de los puntos de soldadura', [
      funcion(
        'Definir cuantos puntos y donde se sueldan en cada pieza',
        'La cantidad de puntos definida prevalece sobre la posicion original del diseño del sustrato',
        [
          falla('Zonas definidas que quedan sin soldar', 7, EF_NO_MONTA, [
            causa('Los puntos se marcan sobre el sustrato plastico y no siempre coinciden con el diseño del insono de tela',
              'Cantidad de puntos definida por pieza en la hoja de operaciones, con ayuda visual del recorrido',
              4,
              'Conteo de los puntos soldados contra la pieza patron del puesto al terminar el conjunto',
              4, 7),
          ]),
        ]),
    ]),
    we('Machine', 'Dispositivo de posicionado del sustrato', [
      funcion(
        'Sujetar el sustrato en posicion durante el soldado',
        'La pieza queda fija y en posicion al bajar el dispositivo, segun la hoja de operaciones del MP8146',
        [
          falla('Sustrato desplazado durante el soldado', 6, EF_NO_MONTA, [
            causa('El dispositivo no retiene la pieza en toda su longitud',
              'Fijacion de la alineacion con los primeros puntos de ultrasonido antes de completar el resto, segun la hoja de operaciones',
              4,
              'Verificacion de la posicion del insono contra la pieza patron al terminar el conjunto',
              5, 6),
          ]),
        ]),
    ]),
    we('Man', 'Operador de soldado', [
      funcion(
        'Posicionar el insono sobre el sustrato y ejecutar los puntos',
        'El insono cubre la zona definida antes del primer punto',
        [
          falla('Insono posicionado fuera de la zona que debe cubrir', 6, EF_RUIDO, [
            causa('El insono es flexible y no tiene referencia propia de posicionado sobre el sustrato',
              'Piloto de localizacion y ayuda visual de posicionado en el puesto, segun la hoja de operaciones',
              4,
              'Verificacion de la cobertura del insono contra la pieza patron antes de soldar',
              5, 6),
          ]),
        ]),
    ]),
  ]);

const OP70 = operacion('70', 'ENSAMBLE DE SUSTRATOS CONSIGNADOS (Aplica solo a MP8146, MP8147, MP8148)',
  'Unir los sustratos plasticos consignados entre si y con el connect bracket para formar el conjunto entregable',
  'Conjunto completo, con todos sus componentes y sin faltantes',
  [
    we('Material', 'Sustratos consignados MP8156 / MP8157 / MP8158 / MP8159 / MP8160 y MP7457', [
      funcion(
        'Aportar los componentes plasticos que forman cada conjunto',
        'Cada codigo terminado lleva los componentes que define su BOM en el ERP',
        [
          falla('Conjunto ensamblado con un componente que no le corresponde', 8, EF_NO_MONTA, [
            causa('Los sustratos del defroster central, RH y LH se presentan juntos en el puesto',
              'Presentacion de los componentes separados por codigo en el puesto de ensamble',
              4,
              'Verificacion del conjunto contra la pieza patron de cada codigo antes de la inspeccion final',
              4, 8),
          ]),
          falla('Faltante de un componente en el conjunto', 8, EF_NO_MONTA, [
            causa('El conjunto se arma en varias etapas y no hay verificacion de completitud entre ellas',
              'Secuencia de ensamble definida en la hoja de operaciones',
              4,
              'Verificacion del conjunto completo contra la BOM en la inspeccion final',
              4, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de ensamble', [
      funcion(
        'Unir los componentes segun la secuencia definida',
        'La union queda firme y sin holgura entre componentes',
        [
          falla('Union floja entre el connect bracket y el conjunto', 7, EF_NO_MONTA, [
            causa('Los 12 remaches del connect bracket no estan documentados en ninguna hoja de operaciones',
              'TBD — completar la hoja de operaciones del ensamble con los 12 remaches del MP7457',
              5,
              'Conteo de remaches del conjunto contra la BOM en la inspeccion final',
              4, 7),
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
          falla('Conjunto liberado sin comparar contra la pieza patron del codigo', 7, EF_NO_MONTA, [
            causa('No hay pieza patron disponible para todos los codigos en el puesto de inspeccion',
              'Piezas patron de los conjuntos definidas e identificadas por codigo en el puesto',
              4,
              'El registro de inspeccion final exige indicar la pieza patron utilizada',
              5, 7),
          ]),
        ]),
    ]),
    we('Man', 'Inspector de calidad', [
      funcion(
        'Verificar aspecto, completitud e identificacion del conjunto',
        'Se verifica el 100% de los conjuntos antes del embalaje',
        [
          falla('Defecto de aspecto en la cara vista del insono que llega al cliente', 6, EF_RUIDO, [
            causa('El defecto de soldadura queda en una zona que no se observa en la posicion habitual de inspeccion',
              'Secuencia de inspeccion definida que recorre todas las zonas soldadas',
              4,
              'Inspeccion visual del 100% de los conjuntos contra la pieza patron',
              4, 6),
          ]),
        ]),
    ]),
    we('Method', 'Criterio de aceptacion de la inspeccion final', [
      funcion(
        'Definir que se acepta y que se rechaza',
        'TBD — el criterio de aceptacion vive en el Plan de Control, que todavia no existe para este producto',
        [
          falla('Criterio de aceptacion aplicado de forma distinta entre turnos', 6, EF_RUIDO, [
            causa('El producto no tiene Plan de Control emitido, que es donde se fija el criterio y la frecuencia',
              'TBD — emitir el Plan de Control del producto (elemento de Calidad en la matriz de PPAP de Cozzuol)',
              5,
              'TBD — a definir junto con el Plan de Control',
              6, 6),
          ]),
        ]),
    ]),
  ]);

const OP90 = operacion('90', 'EMBALAJE, IDENTIFICACION Y CONTROL DE CANTIDADES',
  'Embalar los conjuntos en su medio, identificarlos y verificar la cantidad de despacho',
  'Medio con la cantidad correcta, identificado y sin daño a las piezas',
  [
    we('Material', 'Medio de embalaje y etiqueta ET-SATO-100X60', [
      funcion(
        'Contener e identificar las piezas hasta el cliente',
        'Un medio identificado por codigo y cantidad, segun la ficha de embalaje del proyecto',
        [
          falla('Medio despachado con identificacion incorrecta', 8, EF_FALTANTE, [
            causa('Los siete codigos comparten el mismo formato de etiqueta y de medio',
              'Etiqueta emitida desde el sistema con el codigo de la orden de produccion',
              3,
              'Verificacion de la etiqueta contra el contenido del medio antes de cerrarlo',
              4, 8),
          ]),
          falla('Medio despachado sin identificacion', 8, EF_FALTANTE, [
            causa('El medio se cierra antes de recibir la etiqueta impresa',
              'Secuencia de embalaje que coloca la etiqueta antes del cierre del medio',
              3,
              'Verificacion de la presencia de etiqueta en el control de cantidades de despacho',
              4, 8),
          ]),
        ]),
    ]),
    we('Method', 'Control de cantidades de despacho', [
      funcion(
        'Verificar que la cantidad del medio coincide con la declarada',
        'La cantidad por medio esta definida en la ficha de embalaje del proyecto',
        [
          falla('Cantidad de piezas por medio menor a la declarada', 8, EF_FALTANTE, [
            causa('El conteo se hace una sola vez y por la misma persona que embala',
              'Cantidad por medio definida en la ficha de embalaje y visible en el puesto',
              3,
              'Segundo conteo por un metodo distinto al utilizado para embalar',
              4, 8),
          ]),
          falla('Cantidad de piezas por medio mayor a la declarada', 6, EF_FALTANTE, [
            causa('El conteo se hace una sola vez y por la misma persona que embala',
              'Cantidad por medio definida en la ficha de embalaje y visible en el puesto',
              3,
              'Segundo conteo por un metodo distinto al utilizado para embalar',
              4, 6),
          ]),
        ]),
    ]),
    we('Man', 'Operador de embalaje', [
      funcion(
        'Colocar las piezas en el medio sin dañarlas',
        'Las piezas se ubican sin contacto directo ni presion entre ellas',
        [
          falla('Pieza deformada o marcada por la disposicion dentro del medio', 7, EF_RUIDO, [
            causa('Las piezas se apilan sin separadores y quedan bajo presion durante el traslado',
              'Disposicion de las piezas en el medio definida en la ficha de embalaje del proyecto',
              4,
              'Inspeccion visual de la disposicion de las piezas antes de cerrar el medio',
              5, 7),
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
    approvedBy: 'TBD',
    plantApproval: 'TBD',
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
      details: 'EMISION INICIAL. SE IDENTIFICA LA CARACTERISTICA DE SEGURIDAD Y REGLAMENTACION EXIGIDA POR EL CLIENTE Y SE INCORPORAN LOS REQUISITOS DE LAS NORMAS CVTC 52171, 52034, 52088, 22001 Y 52167. NUMERACION ALINEADA CON EL FLUJOGRAMA 158.',
      pswDate: '',
      modifiedBy: 'FS',
    },
  ],
};

// ---------------------------------------------------------------------------
// Estadisticas y chequeos propios antes de tocar Supabase
// ---------------------------------------------------------------------------
let nWE = 0, nFn = 0, nFM = 0, nCausas = 0, sinAP = 0, tbd = 0, conCC = 0;
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
