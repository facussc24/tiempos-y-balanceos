/**
 * _crearAmfeUpperTrimming.mjs — AMFE de proceso 174 del UPPER TRIM PANEL de consola central
 * (Cozzuol / VW427 Patagonia): MP8405 SINGLE (2HC.864.263.C) y MP8404 DUAL (2HC.864.263.B).
 * Primera emision: la pieza no tenia ni flujograma ni AMFE (pedido de Calidad del 01/10/2026).
 *
 * Sin --apply arma el documento, lo valida y deja el JSON en tmp/. Con --apply lo crea en
 * Supabase o, si ya existe, lo actualiza en su lugar. Crear el AMFE y usar el numero 174 del
 * Listado Maestro tienen el OK de Fak del 01/10/2026 (autonomy-contract §B y §F).
 *
 * REHECHO EL 01/10/2026 A LA TARDE. La primera version salio contra un flujograma al que le
 * faltaban el control con mylar y el control de adhesivado, y declaraba "sin control" casi en
 * todo (54 de 59 causas en prioridad alta). Fak: "es raro que este todo tan alto... no me
 * convence... fijate si encontras mas info". Se relevo con cuatro agentes y lo que cambio fue:
 *   - HAY piezas hechas: 41 despachadas a Cozzuol (remitos 59146 del 19/08 y 59699 del 25/09),
 *     sin devoluciones; Manuel Meszaros, 15/09: "no problems during the wrapping trials. The
 *     first delivery is OK". Programa de la semana 40: 20 SINGLE y 30 DUAL por dia. No es un
 *     proceso "sin experiencia": la prevencion que existe es de CONDUCTA (operarios del sector
 *     con practica), que por la Tabla P2 oficial es O=8, no O=10.
 *   - El adhesivado y el tapizado se hacen en el sector del IP Pad (planillas de PCP
 *     "Adhesivado IP y Upper Trimming" y "Tapizado IP PAD y UPPER TRIM", con piezas OK, NOK y
 *     scrap por hora): cabina con campana de extraccion, set up de lanzamiento y guantes
 *     anticorte son los del AMFE 149 de ese sector.
 *   - El corte se hace en la mesa de corte, con su hoja general, su ficha de set up y el
 *     control con mylar (como el AMFE 173). El mylar del Upper Trim todavia no esta hecho.
 *   - La inflamabilidad SI se ensayo en el laboratorio de Barack, con la camara MC 184:
 *     informe N°19-26 del 10/09/2026 (rechazado) y N°20-26 del 25/09/2026.
 *   - Adherencia: el plan de validacion TL 496 Rev.00 (08/07/2026) la pide por PV 2034; esta
 *     planificada, sin resultado. No hay ensayo de serie.
 *
 * DE DONDE SALE CADA DATO
 *   - Secuencia y numeracion: tools/flowchart/data/160-UPPER-TRIM-PANEL.json (manda el
 *     flujograma, regla no-pfd-no-ho). Se lee del archivo y se compara en ORDEN.
 *   - Proceso: pliego "Dispositivo Tapizado Manual Console Central Component" Rev.01 del
 *     27/04/2026, lista de herramentales, pliego de punzonado (23/07/2026: 10 zonas, sin rebaba
 *     ni deformacion, guardas), cotizacion del troquelador (27/08/2026: dos pulsadores, troquel
 *     y posicionador por variante, cilindros seleccionables), BOM del arb, DXF de tizada.
 *   - Adhesivo: ficha Fenoclor HT.AD FA (secado, reactivacion con calor y prensado), IO-08
 *     (mezcla), planes de recepcion 729 y 730 (certificado por partida; color, viscosidad y
 *     vencimiento, una muestra por lote de entrega).
 *   - Embossing: manual de Suzhou Jfortune, instructivo de la prensa (verificar en cada turno
 *     la parada de emergencia y el mando bimanual) y hojas de proceso Rev.A del 24/09/2026.
 *     La temperatura del molde y la especificacion del logo no estan en ningun documento.
 *   - Requisitos: plano 2HC.864.263 (nota 4: sin defectos visibles; inflamabilidad; adherencia
 *     segun TL 496; color y apariencia segun FAKOM), TL 496 §3.3, PV 2034, TL 1010.
 *   - Embalaje: gama GE-103 Rev.1 (medio retornable, carton entre pisos, etiqueta).
 *
 * LO QUE NO EXISTE PARA ESTA PIEZA Y POR ESO NO SE DECLARA COMO CONTROL
 * Hoja de proceso del adhesivado, del activado, del tapizado, del virolado y del troquelado;
 * muestra patron (Cozzuol, 29/05/2026: "No master sample available"); criterios escritos del
 * control final; plan de recepcion de la microfibra y del sustrato; ensayo de adherencia de
 * serie. El AMFE dice DONDE FALTA CONTROL; no se rellena.
 *
 * SIGLAS: ninguna. Las CC/SC las asigna Fak o el cliente (core-prohibiciones §2). El script
 * lista al final las causas que por S y O son candidatas, para que el decida.
 *
 * Uso:  node scripts/_crearAmfeUpperTrimming.mjs            (arma, valida y muestra; no escribe)
 *       node scripts/_crearAmfeUpperTrimming.mjs --apply    (escribe en Supabase)
 */

import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, parseData, calculateAP } from './_lib/amfeIo.mjs';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { validateAmfeDoc, validateEquipoMultifuncional, printIssues, nivelPorCriterio } from './_lib/amfeValidator.mjs';

const APPLY = process.argv.includes('--apply');
const FECHA_ISO = '2026-10-01';

const AMFE_KEY = 'AMFE-UT-PAT';
// Numero del Listado_Maestro_AMFE.xlsx (el ultimo cargado era el 173), tomado con el OK de Fak
// del 01/10/2026.
const NUMERO_EMPRESA = '174';
const FECHA = '01/10/2026';
const FLUJOGRAMA = 'tools/flowchart/data/160-UPPER-TRIM-PANEL.json';

// Ids estables entre corridas: el gate identifica cada hallazgo por el id de su operacion.
let _n = 0;
const id = () => `utp-${String(++_n).padStart(4, '0')}`;

function causa(descripcion, prevControl, O, detControl, D) {
  return {
    id: id(),
    cause: descripcion,
    description: descripcion,
    preventionControl: prevControl,
    preventiveControl: prevControl,
    detectionControl: detControl,
    occurrence: O,
    detection: D,
  };
}

/** La S sale del EFECTO y el AP se calcula. Un AP=H sin accion va con la celda vacia. */
function falla(descripcion, ef, causas) {
  for (const c of causas) {
    const ap = calculateAP(ef.s, c.occurrence, c.detection);
    c.ap = ap;
    c.actionPriority = ap;
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
  return { id: id(), description: descripcion, functionDescription: descripcion, requirements: requisitos, failures: fallas };
}
function we(type, name, funciones) {
  return { id: id(), name, type, functions: funciones };
}
function operacion(numero, nombre, funcionOperacion, workElements) {
  return {
    id: id(), opNumber: numero, operationNumber: numero,
    name: nombre, operationName: nombre,
    operationFunction: funcionOperacion, focusElementFunction: FOCO,
    workElements,
  };
}

// Nivel 1 (amfe.md §8): que entrega la pieza. Identico en todas las operaciones.
const FOCO = 'Funcion Interna: Entregar el Upper Trim Panel tapizado en microfibra, con los agujeros libres y el logo de carga grabado, conforme al plano y con la inflamabilidad y la adherencia que exige el cliente'
  + ' / Funcion del Cliente: Permitir el armado de la consola central en Cozzuol sin clasificacion ni retrabajo'
  + ' / Funcion del Usuario Final: Aspecto y tacto de la consola central, con la zona de carga inalambrica identificada';

// ---------------------------------------------------------------------------
// CONTROLES QUE SE REPITEN
// ---------------------------------------------------------------------------
const SIN_PREVENCION = 'Sin control preventivo';
// Tabla P2 oficial (SETEC pag. 104-105): un control de CONDUCTA, que depende del operario, tiene
// "un pequeno efecto" (8-9) o es "algo efectivo" (6-7). Es lo que hay hoy en los pasos manuales
// sin hoja de proceso propia: gente del sector que ya tapiza piezas parecidas. No es O=10 (sin
// ningun control), y la evidencia dice que algo efectivo es: 41 piezas entregadas sin
// devolucion y "no problems during the wrapping trials" (Calidad, 15/09/2026). O=7, el
// extremo peor de esa banda, hasta que haya hoja de proceso y registro de rechazos.
const OPERARIO = 'Operarios del sector con practica en piezas tapizadas a mano';
const O_OPERARIO = 7;
const VISUAL_FINAL = 'Control visual 100% en el control final de calidad';
// El plan de validacion TL 496 pide la adherencia por PV 2034, una sola vez y todavia sin
// resultado. Eso valida el proceso; no es un control de la produccion. En la serie no hay
// ensayo de adherencia: D=10 (tercera pasada de la auditoria de cliente, 01/10/2026: con D=9
// la misma ausencia valia 9 aca y 10 en "sin control posterior").
const ADHERENCIA = 'Sin ensayo de adherencia en la serie';
const D_ADHERENCIA = 10;

// ---------------------------------------------------------------------------
// EFECTOS — cada uno trae su S, de la Tabla P1 oficial (SETEC pag. 101-103).
//   10 riesgo agudo para el operario · 9 incumplimiento de regulacion · 8 riesgo cronico para
//   el operario · 7 parte de la produccion a scrap / reemplazo en el campo · 6 paro de linea
//   de hasta una hora · 5 retrabajo fuera de linea / clasificacion sin paro.
// ---------------------------------------------------------------------------
const EF_LEGAL_FUEGO = {
  s: 9,
  local: 'Microfibra sin evidencia de cumplir el limite de velocidad de combustion',
  next: 'Bloqueo del lote en la recepcion de Cozzuol',
  end: 'Incumplimiento de un requisito legal de inflamabilidad en el habitaculo del vehiculo',
};
// Material que entra a produccion sin liberar: el efecto mas grave es el de la microfibra,
// que ya llego una vez sin tratamiento antiflama. Tres pasadas de la auditoria de cliente lo
// marcaron: la S es la del efecto mas grave del modo de falla (Tabla P1).
const EF_SIN_LIBERAR = {
  s: 9,
  local: 'Material sin liberar usado en la pieza',
  next: 'Bloqueo del lote en la recepcion de Cozzuol',
  end: 'Posible incumplimiento del requisito legal de inflamabilidad en el habitaculo del vehiculo',
};
// Sustrato o pieza fuera de las medidas de montaje del plano: no entra en la consola. P1-7.
const EF_NO_MONTA = {
  s: 7,
  local: 'Pieza fuera de las medidas de montaje del plano',
  next: 'Pieza que no se puede montar en la consola central: rechazo del lote en Cozzuol',
  end: 'Sin efecto en el vehiculo: la pieza no llega a montarse',
};
const EF_DESPEGUE = {
  s: 7,
  local: 'Microfibra con adherencia insuficiente sobre el sustrato',
  next: 'Rechazo y clasificacion de piezas en la recepcion de Cozzuol',
  end: 'Despegue de la microfibra en el uso, con reemplazo de la pieza en el campo',
};
const EF_SCRAP_INTERNO = {
  s: 7,
  local: 'Pieza o material rechazado en el puesto, se genera scrap',
  next: 'Reposicion de la pieza y atraso del lote',
  end: 'Sin efecto en el vehiculo: la pieza no sale de planta',
};
// Agujero tapado o corrido: la pieza no se puede montar. P1-7 en la planta del cliente.
const EF_MONTAJE = {
  s: 7,
  local: 'Pieza con agujeros tapados o corridos respecto de los del sustrato',
  next: 'Pieza que no se puede montar en la consola central: rechazo del lote en Cozzuol',
  end: 'Sin efecto en el vehiculo: la pieza no llega a montarse',
};
// Defecto de aspecto: S=5, la calibracion de la casa para piezas de cabina (amfe.md §1:
// arrugas, delaminacion y aspecto van en 5-6) y la misma que Fak fijo para el AMFE 173 el
// 22/09/2026 ("Posible clasificacion de piezas en la planta del cliente" es P1-5).
// El 01/10/2026 la auditoria de cliente pidio subirlo a 7 porque la pieza rechazada se
// scrapea, y lo aplique sin cruzarlo con esa calibracion: quedaban 15 modos de falla de
// aspecto con la misma gravedad que un despegue en el campo. Se vuelve a 5. Lo que SI va en
// 7 es el dano que deja el sustrato a la vista (EF_SCRAP_VISTA) y el scrap de material.
const EF_ASPECTO = {
  s: 5,
  local: 'Pieza con desvio de aspecto en zona vista',
  next: 'Posible clasificacion de piezas en la planta de Cozzuol',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
const EF_ASPECTO_REPROCESO = {
  s: 5,
  local: 'Pieza con mancha de adhesivo en zona vista, que va a reproceso',
  next: 'Posible clasificacion de piezas en la planta de Cozzuol',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
const EF_SCRAP_VISTA = {
  s: 7,
  local: 'Pieza rechazada en el puesto, se genera scrap',
  next: 'Posible clasificacion de piezas en la planta de Cozzuol',
  end: 'Sustrato a la vista en el borde de la pieza',
};
// Dano que aparece DESPUES del control final (adentro del medio): lo ve el cliente. P1-5.
const EF_ASPECTO_CLIENTE = {
  s: 5,
  local: 'Pieza marcada dentro del medio, despues del control final',
  next: 'Clasificacion de piezas en la planta de Cozzuol',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
// Defecto que se le escapa al control final. El peor de los que mira es el agujero tapado.
const EF_ESCAPE = {
  s: 7,
  local: 'Pieza no conforme embalada como conforme',
  next: 'Rechazo y clasificacion de piezas en Cozzuol; la pieza con un agujero tapado no se puede montar',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
const EF_CANTIDAD = {
  s: 6,
  local: 'Medio con una cantidad de piezas distinta de la pedida',
  next: 'Faltante en la recepcion de Cozzuol, con reposicion urgente',
  end: 'Sin efecto en el vehiculo',
};
const EF_VARIANTE = {
  s: 6,
  local: 'Medio con piezas de una variante distinta de la que indica su etiqueta',
  next: 'Pieza de la variante equivocada en la linea de Cozzuol: clasificacion y reposicion urgente',
  end: 'Sin efecto en el vehiculo',
};
const EF_SEG_OPERARIO = {
  s: 10,
  local: 'Riesgo de salud o seguridad para el operario del puesto; posible incumplimiento de la Ley 19587',
  next: 'Sin efecto en la planta del cliente',
  end: 'Sin efecto en el vehiculo',
};
const EF_SALUD_CRONICA = {
  s: 8,
  local: 'Riesgo cronico para la salud del operario del puesto; posible incumplimiento de la Ley 19587',
  next: 'Sin efecto en la planta del cliente',
  end: 'Sin efecto en el vehiculo',
};

// ===========================================================================
// OP 10 — RECEPCION DE MATERIA PRIMA
// ===========================================================================
const OP10 = operacion('10', 'RECEPCION DE MATERIA PRIMA',
  'Recibir, identificar y liberar la microfibra, el sustrato y el adhesivo antes de habilitarlos a produccion',
  [
    we('Material', 'Microfibra suede Meisheng MS-9PQ009-BK25-2', [
      funcion(
        'Cumplir el limite de velocidad de combustion que exige el cliente',
        'Inflamabilidad segun el plano de la pieza y TL 1010',
        [
          // Ya paso: el primer lote llego sin tratamiento antiflama y el ensayo interno del
          // 10/09/2026 (informe N°19-26, camara MC 184) dio rechazado. O=8. La deteccion existe
          // y funciono, pero es un ensayo que se hizo a pedido, no por lote: P3-9.
          falla('Microfibra recibida sin tratamiento antiflama', EF_LEGAL_FUEGO, [
            causa('El articulo existe en una version sin tratamiento antiflama, que se distingue por el ultimo digito del codigo',
              'Codigo de la version antiflama cargado en el maestro de insumos y en la lista de materiales',
              8, 'Ensayo de inflamabilidad en el laboratorio de Barack con camara de flamabilidad, por muestreo', 9),
          ]),
        ]),
      funcion(
        'Entregar la microfibra con el color, el espesor y el gramaje que pide el plano',
        'Color y apariencia segun el plano y la referencia de color del cliente; espesor y gramaje segun el plano',
        [
          falla('Microfibra recibida con un color distinto del aprobado', EF_ASPECTO, [
            causa('Variacion de tono entre partidas del proveedor',
              'Articulo y color declarados en la orden de compra',
              6, 'Sin muestra patron de color para comparar en la recepcion', 10),
          ]),
          // El informe del proveedor del lote 260819-04 da un espesor por encima del rango del
          // plano: la variacion ya se vio. O=8.
          falla('Microfibra recibida con espesor o gramaje fuera del plano', EF_ASPECTO, [
            causa('Variacion del proceso del proveedor entre partidas',
              'Ficha tecnica del proveedor con el espesor y el gramaje del articulo',
              8, 'Sin plan de control de recepcion para este material', 10),
          ]),
          falla('Rollo recibido manchado, marcado o con pliegues', EF_SCRAP_INTERNO, [
            causa('Dano del rollo en el transporte desde el proveedor',
              SIN_PREVENCION,
              10, 'Inspeccion visual del estado del rollo al recibirlo', 8),
          ]),
        ]),
    ]),
    we('Material', 'Sustrato plastico inyectado provisto por Cozzuol', [
      funcion(
        'Entregar el sustrato dentro de medida y sin deformaciones, rebabas ni marcas',
        'Sustrato de la variante pedida, segun el plano y apto para tapizar',
        [
          // Hay un informe dimensional del 08/09/2026 sobre una pieza, con cotas fuera de plano.
          // Es una medicion unica, no un control de recepcion: P3-9.
          falla('Sustrato recibido fuera de medida', EF_NO_MONTA, [
            causa('Variacion dimensional del proceso de inyeccion del proveedor',
              SIN_PREVENCION,
              10, 'Control dimensional por muestreo, sin plan de control de recepcion para el sustrato', 9),
          ]),
          falla('Sustrato recibido deformado, con rebabas o con marcas', EF_ASPECTO, [
            causa('Dano o defecto de inyeccion que llega en el lote del proveedor',
              SIN_PREVENCION,
              10, 'Sin plan de control de recepcion para el sustrato', 10),
          ]),
        ]),
    ]),
    we('Material', 'Adhesivo FA y reticulante GV', [
      funcion(
        'Entregar el adhesivo y el reticulante especificados, dentro de su vencimiento',
        'Adhesivo FA y reticulante GV de Fenoclor, con certificado por partida',
        [
          // Planes de recepcion 729 y 730: certificado por partida; color, viscosidad y
          // vencimiento, una muestra por lote de entrega. Material de serie hace anos: O=3.
          falla('Adhesivo o reticulante recibido distinto del especificado o cerca de su vencimiento', EF_DESPEGUE, [
            causa('El proveedor entrega una partida distinta de la pedida o con poca vida util',
              'Certificado de calidad del proveedor por partida',
              3, 'Control de recepcion de color, viscosidad y vencimiento contra el certificado, una muestra por lote de entrega', 9),
          ]),
        ]),
    ]),
    we('Method', 'Identificacion y liberacion del material en el deposito', [
      funcion(
        'Que a produccion solo salga material ingresado, controlado e identificado',
        'Material identificado por lote y liberado antes de habilitarlo al sector',
        [
          falla('Material entregado a produccion sin haber sido ingresado ni liberado', EF_SIN_LIBERAR, [
            causa('El material se retira del deposito antes de que termine su control de recepcion',
              'Zona de material pendiente de control fisicamente separada de la de material liberado',
              4, 'Control de la identificacion de lote en el sector, al inicio de turno', 9),
          ]),
        ]),
    ]),
    we('Environment', 'Deposito de materia prima', [
      funcion(
        'Almacenar la materia prima sin degradarla',
        'Deposito libre de filtraciones',
        [
          falla('Materia prima mojada por filtraciones del techo', EF_SCRAP_INTERNO, [
            causa('Deterioro de la cubierta del deposito',
              'Mantenimiento preventivo de la cubierta',
              3, 'Control visual del deposito en el recorrido de turno y despues de cada lluvia', 8),
          ]),
        ]),
    ]),
    we('Machine', 'Autoelevador del deposito', [
      funcion(
        'Mover la materia prima sin danarla y sin generar riesgo',
        'Autoelevador en condiciones de uso, con check list previo',
        [
          // Redactadas como en el AMFE del Armrest Door Panel de Patagonia (mismo deposito).
          falla('Autoelevador operado con una falla no detectada', EF_SEG_OPERARIO, [
            causa('Falla en el sistema hidraulico o en los frenos del autoelevador',
              'Check list diario del autoelevador y mantenimiento preventivo',
              6, 'Inspeccion previa al uso en cada turno', 8),
          ]),
          falla('Dano del embalaje de la materia prima durante el movimiento', EF_SCRAP_INTERNO, [
            causa('El material se deposita sin proteccion durante el movimiento y el almacenaje',
              'Procedimiento de estiba y uso de embalajes cerrados',
              5, 'Inspeccion visual del estado del embalaje al recibirlo en el sector', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 20 — CORTE DE MICROFIBRA
// Mesa de corte: hoja general del sector y ficha de set up, como en el AMFE 173. El hueco del
// cargador sale cortado de la mesa (uno en SINGLE, dos en DUAL); los agujeros chicos se
// troquelan despues de tapizar (OP 50).
// ===========================================================================
const OP20 = operacion('20', 'CORTE DE MICROFIBRA',
  'Cortar la microfibra con el contorno y el hueco del cargador del patron liberado de cada variante',
  [
    we('Method', 'Patron y programa de corte', [
      funcion(
        'Cortar el contorno y el hueco del cargador del patron liberado',
        'Programa de corte de la revision liberada del patron de cada variante',
        [
          // El programa equivocado se ve en la plantilla, pero solo en la primera pieza: P3-9.
          falla('Contorno o hueco del cargador distinto del patron liberado', EF_SCRAP_INTERNO, [
            causa('El programa de corte cargado en la mesa no es el de la revision liberada del patron',
              'Codigo y nombre del programa verificados en el set up de la mesa de corte',
              4, 'Control de forma de la primera pieza contra la plantilla mylar', 9),
          ]),
          falla('Se corta una variante distinta de la pedida', EF_SCRAP_INTERNO, [
            causa('Los archivos de corte de las dos variantes conviven en el programa y se diferencian por un hueco',
              'Codigo y nombre del programa verificados en el set up de la mesa de corte',
              4, 'Control de forma de la primera pieza contra la plantilla mylar de la variante', 9),
          ]),
          falla('Microfibra montada en la mesa con la cara vista invertida', EF_SCRAP_INTERNO, [
            causa('El rollo entra en el portarrollos en los dos sentidos',
              'La planilla de corte indica como se coloca el rollo',
              4, 'Control visual de la posicion de la cara vista contra la planilla de corte', 8),
          ]),
        ]),
      funcion(
        'Cortar el material que pide la orden de corte',
        'Microfibra de la version antiflama, identificada por el codigo del rollo',
        [
          // Mismo riesgo que en la recepcion, del lado de planta: O=8.
          falla('Se corta microfibra de la version sin tratamiento antiflama', EF_LEGAL_FUEGO, [
            causa('Los rollos de las dos versiones se distinguen solo por el codigo de su etiqueta',
              'Rollo identificado en la recepcion con su codigo de material',
              8, 'Verificacion del codigo del rollo contra la planilla de corte, antes de montarlo', 8),
          ]),
        ]),
    ]),
    we('Machine', 'Mesa de corte automatica', [
      funcion(
        'Cortar con la calidad de filo y la posicion que pide el patron',
        'Cuchilla dentro de su medida de uso y material alineado sobre la mesa',
        [
          falla('Borde de la microfibra deshilachado o con rebaba', EF_ASPECTO, [
            causa('La cuchilla pierde filo entre dos afilados',
              'Afilado automatico de la cuchilla y criterio de cambio por ancho minimo, verificado en el set up',
              4, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra mal alineada sobre la mesa de corte', EF_SCRAP_INTERNO, [
            causa('El material se detiene antes o despues de la marca y queda fuera de escuadra',
              'Lineas de tope al costado de la mesa y chequeo automatico de medidas por sensores',
              4, 'Verificacion visual del material contra las marcas, antes de cada corte', 8),
          ]),
          falla('Corte incompleto, con zonas sin separar', EF_SCRAP_INTERNO, [
            causa('La succion cae durante el corte y la capa se mueve',
              'El corte no arranca hasta que el vacio esta activo',
              5, 'Control del tendido y del despegue de la capa durante el corte', 8),
          ]),
        ]),
    ]),
    we('Measurement', 'Identificacion del corte', [
      funcion(
        'Que del corte salga la variante y la cantidad correcta, identificada',
        'Corte identificado con la variante y la cantidad de la orden',
        [
          falla('Corte identificado con una variante o una cantidad que no corresponde', EF_SCRAP_INTERNO, [
            causa('La etiqueta se coloca en el bin despues de retirar el corte',
              'Etiqueta emitida con la orden de corte',
              4, 'Cotejo de la etiqueta contra el contenido al cerrar el bin', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 21 — CONTROL CON MYLAR
// Fak, 01/10/2026: "siempre en corte hay control con mylar". Es el control de la hoja general
// de mesa de corte: plantilla codificada por referencia y material, banda de tolerancia,
// criterio en los dos sentidos, y liberacion de la primera pieza por el inspector de calidad
// (ficha de set up). Redactado como la OP 21 del AMFE 173. La plantilla de esta pieza todavia
// hay que hacerla: eso es un pendiente del proyecto, no una fila del AMFE.
// ===========================================================================
const OP21 = operacion('21', 'CONTROL CON MYLAR',
  'Liberar el corte contra la plantilla mylar de la variante antes de seguir cortando el lote',
  [
    we('Measurement', 'Plantilla mylar de control', [
      funcion(
        'Verificar el contorno y el hueco del cargador de la pieza cortada contra la plantilla de su variante',
        'Pieza dentro del area OK de la plantilla: ni mas grande ni mas chica',
        [
          falla('Se libera el corte contra la plantilla de la otra variante', EF_SCRAP_INTERNO, [
            causa('Las plantillas de las dos variantes se diferencian por un hueco',
              'Plantilla codificada por referencia y material',
              4, 'Cotejo de la identificacion de la plantilla contra la planilla de corte', 8),
          ]),
          // Lo que se le escapa a este control se ve recien al tapizar: la tela no llega al
          // borde. La deteccion es aguas abajo, a la vista.
          falla('Pieza mas chica que el area OK que pasa como conforme', EF_SCRAP_VISTA, [
            causa('Una pieza mas chica entra dentro del contorno de la plantilla y parece conforme',
              'Banda de tolerancia marcada en la plantilla, con criterio en los dos sentidos',
              4, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Method', 'Liberacion del lote', [
      funcion(
        'Que el lote no avance hasta que la primera pieza este liberada',
        'Primera pieza liberada por el inspector de calidad antes de producir',
        [
          falla('El lote sigue cortandose antes de liberar la primera pieza', EF_SCRAP_INTERNO, [
            causa('La mesa puede seguir cortando mientras se hace el control de la primera pieza',
              'Liberacion de la primera pieza por el inspector de calidad antes de producir',
              5, 'Firma del inspector en la ficha de liberacion de inicio de produccion', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 30 — ADHESIVADO DE MICROFIBRA Y SUSTRATO
// Adhesivo FA con reticulante GV, a pistola, sobre las dos partes, en el sector de adhesivado
// que comparte con el IP Pad (cabina con campana de extraccion, set up de lanzamiento: AMFE
// 149). La mezcla tiene instruccion (IO-08); la aplicacion sobre esta pieza no tiene hoja.
// ===========================================================================
const OP30 = operacion('30', 'ADHESIVADO DE MICROFIBRA Y SUSTRATO',
  'Aplicar adhesivo sobre la microfibra y sobre el sustrato y dejarlo secar antes del activado',
  [
    we('Material', 'Mezcla de adhesivo FA con reticulante GV', [
      funcion(
        'Usar el adhesivo mezclado en la relacion definida, dentro de su vencimiento y de su vida util',
        'Mezcla segun la instruccion IO-08, con componentes vigentes',
        [
          falla('Mezcla de adhesivo fuera de la relacion definida', EF_DESPEGUE, [
            causa('El reticulante se vuelca a mano en la lata de adhesivo',
              'Instruccion IO-08: una botella de reticulante por lata de adhesivo',
              4, 'Sin control de la mezcla despues de preparada', 10),
          ]),
          // El set up se hace al lanzar el turno, no en cada mezcla: P3-9.
          falla('Adhesivo o reticulante vencido usado en la mezcla', EF_DESPEGUE, [
            causa('El componente vence estando en el deposito o en el puesto',
              'Fecha de vencimiento en la etiqueta de cada envase',
              4, 'Verificacion de las fechas de vencimiento en el set up de lanzamiento del sector', 9),
          ]),
          falla('Mezcla de adhesivo usada fuera de su vida util', EF_DESPEGUE, [
            causa('La mezcla preparada queda en el puesto sin la hora de preparacion a la vista',
              SIN_PREVENCION,
              10, 'Sin registro de la hora de preparacion de la mezcla', 10),
          ]),
        ]),
    ]),
    we('Machine', 'Pistola de adhesivado', [
      funcion(
        'Aplicar el adhesivo en forma uniforme sobre las dos partes',
        'Microfibra y sustrato cubiertos por completo, sin exceso',
        [
          falla('Adhesivo insuficiente o con zonas sin cubrir', EF_DESPEGUE, [
            causa('El adhesivo se rocia con pistola manual y la cobertura depende del recorrido',
              OPERARIO,
              O_OPERARIO, 'Control visual del colocado del adhesivo en la inspeccion de pieza adhesivada', 8),
          ]),
          falla('Exceso de adhesivo que traspasa la microfibra o deja zonas brillantes', EF_ASPECTO, [
            causa('La cantidad de adhesivo depende de la regulacion de la pistola y de las pasadas',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    // Ficha tecnica del adhesivo FA: se deja secar antes de reactivarlo con calor.
    we('Method', 'Secado del adhesivo antes del activado', [
      funcion(
        'Dejar secar el adhesivo aplicado antes de activarlo',
        'Adhesivo seco antes del activado, segun la ficha tecnica del adhesivo',
        [
          falla('Pieza que pasa al activado con el adhesivo sin secar', EF_DESPEGUE, [
            causa('Las piezas adhesivadas esperan sin la hora de adhesivado a la vista',
              SIN_PREVENCION,
              10, 'Sin registro de la hora de adhesivado en la pieza', 10),
          ]),
        ]),
    ]),
    // Riesgo cronico (vapores de solvente): P1-8, no 10.
    we('Environment', 'Cabina de adhesivado', [
      funcion(
        'Mantener el puesto ventilado durante la aplicacion',
        'Extraccion en marcha mientras se adhesiva',
        [
          falla('Operario expuesto a los vapores del adhesivo', EF_SALUD_CRONICA, [
            causa('La aplicacion a pistola genera niebla de adhesivo en el puesto',
              'Cabina de adhesivado con campana de extraccion',
              3, 'Control del funcionamiento de la extraccion al inicio de turno', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 31 — INSPECCION DE PIEZA ADHESIVADA
// El sector registra piezas OK, NOK y scrap por hora (planilla de PCP "Adhesivado IP y Upper
// Trimming"). No hay una referencia escrita de la zona que tiene que quedar cubierta.
// ===========================================================================
const OP31 = operacion('31', 'INSPECCION DE PIEZA ADHESIVADA',
  'Verificar la microfibra y el sustrato adhesivados antes de activar el adhesivo',
  [
    we('Measurement', 'Control visual de la pieza adhesivada', [
      funcion(
        'Verificar que el adhesivo cubrio las dos partes de manera uniforme',
        'Sin zonas sin adhesivo y sin exceso, con registro de piezas conformes y no conformes',
        [
          // Lo que se le escapa a este control ya no se ve: el adhesivo queda tapado.
          falla('Pieza con falta de adhesivo que pasa el control', EF_DESPEGUE, [
            causa('La cobertura del adhesivo se juzga a ojo, sin una referencia de la zona que debe quedar cubierta',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 32 — REPROCESO: FALTA DE ADHESIVO
// El de las piezas tapizadas hermanas (flujogramas 153, 154 y 159): reponer adhesivo en la
// zona donde falto y volver al control. Sin hoja escrita para esta pieza.
// ===========================================================================
const OP32 = operacion('32', 'REPROCESO: FALTA DE ADHESIVO',
  'Reponer adhesivo en la zona de la microfibra o del sustrato donde falto',
  [
    we('Method', 'Reposicion manual de adhesivo en la zona faltante', [
      funcion(
        'Cubrir con adhesivo la zona faltante sin cargar de mas el resto',
        'Adhesivo uniforme en la zona reprocesada',
        [
          falla('Zona sin adhesivo que queda sin cubrir despues del reproceso', EF_DESPEGUE, [
            causa('El adhesivo se repone a mano solo en la zona donde falto',
              OPERARIO,
              O_OPERARIO, 'Reverificacion en la inspeccion de pieza adhesivada', 8),
          ]),
          falla('Exceso de adhesivo en la zona reprocesada que traspasa la microfibra', EF_ASPECTO, [
            causa('La zona reprocesada recibe una segunda capa de adhesivo',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Pieza reprocesada que pasa al activado sin volver a la inspeccion', EF_DESPEGUE, [
            causa('La pieza reprocesada no lleva una identificacion que la distinga de la ya inspeccionada',
              SIN_PREVENCION,
              10, 'Sin control posterior a la inspeccion de pieza adhesivada', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 40 — ACTIVADO DEL ADHESIVO CON CALOR
// La ficha tecnica del adhesivo FA dice que el pegado se hace por reactivacion con calor
// (infrarrojo, flash o aire caliente) y posterior prensado; Fak lo confirmo el 01/10/2026. La
// lista de herramentales no tiene una maquina para esto, y ningun documento fija la
// temperatura ni el tiempo.
// ===========================================================================
const OP40 = operacion('40', 'ACTIVADO DEL ADHESIVO CON CALOR',
  'Reactivar con calor el adhesivo de la microfibra y del sustrato justo antes del tapizado',
  [
    we('Method', 'Aplicacion de calor sobre el adhesivo', [
      funcion(
        'Llevar el adhesivo de las dos partes a su temperatura de activado',
        'Adhesivo activado en toda la superficie, sin dano de la microfibra ni del sustrato',
        [
          falla('Adhesivo sin activar o activado en forma despareja', EF_DESPEGUE, [
            causa('La temperatura que alcanza el adhesivo depende del tiempo y de la distancia de aplicacion del calor',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Pieza que se tapiza con el adhesivo ya enfriado', EF_DESPEGUE, [
            causa('La pieza activada espera antes del tapizado sin un tiempo maximo a la vista',
              SIN_PREVENCION,
              10, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Microfibra o sustrato marcado por exceso de calor', EF_ASPECTO, [
            causa('El calor se aplica sin una temperatura ni un tiempo de referencia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    // Guantes y ropa de trabajo: el equipo de proteccion del sector para el trabajo con calor
    // (AMFE 149). Es un control de conducta: O=7, igual que en la trincheta y en la prensa.
    we('Man', 'Operador de Produccion', [
      funcion(
        'Aplicar el calor sin exponerse a una quemadura',
        'Guantes puestos durante el activado',
        [
          falla('Quemadura del operario al aplicar el calor', EF_SEG_OPERARIO, [
            causa('El calor se aplica cerca de las manos que sostienen la pieza',
              'Guantes y ropa de trabajo del sector',
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 41 — TAPIZADO MANUAL
// ===========================================================================
const OP41 = operacion('41', 'TAPIZADO MANUAL',
  'Posicionar la microfibra con el adhesivo activado sobre el sustrato, asentarla y prensarla sin arrugas',
  [
    we('Method', 'Posicionado de la microfibra sobre el sustrato', [
      funcion(
        'Ubicar la microfibra centrada, con el hueco del cargador sobre el del sustrato',
        'Microfibra centrada respecto del sustrato y del hueco del cargador',
        [
          falla('Microfibra desalineada respecto del sustrato o del hueco del cargador', EF_ASPECTO, [
            causa('La microfibra se posiciona a mano, sin un tope que la ubique sobre el sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Method', 'Asentado y prensado manual de la microfibra', [
      funcion(
        'Asentar y prensar la microfibra sobre toda la superficie del sustrato',
        'Microfibra adherida en toda la superficie, sin arrugas, pliegues, burbujas, manchas ni marcas de presion en zona vista',
        [
          falla('Pieza tapizada con arrugas o pliegues en zona vista', EF_ASPECTO, [
            causa('La microfibra se estira y se acomoda a mano sobre las curvas del sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          // La ficha del adhesivo pide reactivacion con calor y posterior prensado. El
          // prensado corto no se ve.
          falla('Microfibra asentada con presion insuficiente', EF_DESPEGUE, [
            causa('La presion de asentado se da a mano y no se mide',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Microfibra con marcas de presion', EF_ASPECTO, [
            causa('La presion para asentar la microfibra se da a mano, sin una referencia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra con burbujas o levantada del sustrato', EF_DESPEGUE, [
            causa('El asentado a mano no llega a toda la superficie en los radios del sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Cara vista de la microfibra manchada con adhesivo', EF_ASPECTO_REPROCESO, [
            causa('La cara vista toca restos de adhesivo de la mesa o de las manos durante el tapizado',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 42 — VIROLADO + REFILADO
// A mano. Para la pared del hueco del cargador existe un virolador que sostiene la microfibra
// mientras el adhesivo toma (utillaje propio, entregado el 20/08/2026). El refilado es con
// trincheta; los guantes anticorte son los del sector (AMFE 149).
// ===========================================================================
const OP42 = operacion('42', 'VIROLADO + REFILADO',
  'Doblar la microfibra sobre los bordes del sustrato y del hueco del cargador y cortar el sobrante',
  [
    we('Method', 'Virolado manual de los bordes', [
      funcion(
        'Dejar la microfibra doblada y pegada en todo el contorno',
        'Bordes virolados y adheridos, sin tela despegada',
        [
          falla('Borde de la microfibra despegado en el contorno de la pieza', EF_DESPEGUE, [
            causa('El doblez se hace a mano y se suelta antes de que el adhesivo tome',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Machine', 'Virolador del hueco del cargador', [
      funcion(
        'Sostener la microfibra contra la pared del hueco mientras el adhesivo toma',
        'Microfibra adherida a la pared del hueco en todo su contorno',
        [
          // Hay una ayuda tecnica, pero sin historial en serie: O=5 (Tabla P2).
          falla('Microfibra despegada en la pared del hueco del cargador', EF_DESPEGUE, [
            causa('La microfibra doblada tiende a volver a su posicion mientras el adhesivo toma',
              'Virolador que sostiene la microfibra contra la pared del hueco',
              5, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Method', 'Refilado manual del sobrante', [
      funcion(
        'Cortar el sobrante de microfibra al ras del borde',
        'Sobrante cortado al ras, sin rebaba ni deshilachado y sin sustrato a la vista',
        [
          falla('Borde refilado con rebaba o deshilachado', EF_ASPECTO, [
            causa('El sobrante se corta a mano, sin una guia para la herramienta',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra cortada de mas, con el sustrato a la vista', EF_SCRAP_VISTA, [
            causa('La herramienta de corte se guia a mano contra el borde del sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de Produccion', [
      funcion(
        'Refilar sin exponerse al filo de la herramienta',
        'Guantes anticorte puestos durante el refilado',
        [
          falla('Corte del operario con la trincheta de refilado', EF_SEG_OPERARIO, [
            causa('El refilado se hace con una trincheta de filo expuesto',
              'Guantes anticorte del sector',
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 50 — TROQUELADO DE AGUJEROS
// Dispositivo troquelador neumatico (pliego del 23/07/2026 y cotizacion del 27/08/2026):
// troquel y posicionador para cada variante, cilindros seleccionables, manejo con dos
// pulsadores. Fak, 01/10/2026: "asumamos que si".
// ===========================================================================
const OP50 = operacion('50', 'TROQUELADO DE AGUJEROS',
  'Abrir en la microfibra los agujeros del sustrato, sobre la pieza ya tapizada',
  [
    we('Machine', 'Dispositivo troquelador neumatico', [
      funcion(
        'Troquelar la microfibra sobre cada agujero del sustrato',
        'Todos los agujeros del sustrato libres, sin rebaba ni deformacion alrededor',
        [
          falla('Agujero sin troquelar o troquelado incompleto', EF_MONTAJE, [
            causa('Troquel desgastado que no llega a separar la microfibra',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Agujero troquelado corrido respecto del agujero del sustrato', EF_MONTAJE, [
            causa('La pieza queda mal apoyada en el dispositivo',
              'Posicionador de la pieza propio de cada variante',
              5, VISUAL_FINAL, 8),
          ]),
          falla('Pieza troquelada con los cilindros de la otra variante', EF_MONTAJE, [
            causa('Los cilindros que actuan se seleccionan a mano segun la variante',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Recorte de microfibra que queda dentro del agujero', EF_MONTAJE, [
            causa('El troquel corta la microfibra pero no expulsa el recorte',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra marcada o desgarrada alrededor del agujero', EF_ASPECTO, [
            causa('Troquel sin filo que arrastra la microfibra en lugar de cortarla',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de Produccion', [
      funcion(
        'Cargar y retirar la pieza sin exponerse a los troqueles',
        'Manos fuera de la zona de troquelado durante el ciclo',
        [
          falla('Atrapamiento de la mano en el dispositivo troquelador', EF_SEG_OPERARIO, [
            causa('La pieza se acomoda con la mano dentro de la zona de troquelado',
              'Accionamiento del dispositivo con dos pulsadores',
              3, 'Sin verificacion periodica de los pulsadores definida', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 60 — EMBOSSING DEL LOGO DE CARGA
// Prensa servo con molde calefaccionado y mando bimanual. Hay hoja de proceso de la prensa; la
// temperatura y los parametros para esta pieza no estan validados: O=9 (Tabla P2, control de
// conducta en la primera aplicacion de un procedimiento nuevo).
// ===========================================================================
const OP60 = operacion('60', 'EMBOSSING DEL LOGO DE CARGA',
  'Grabar el logo de carga inalambrica sobre la microfibra de la pieza tapizada',
  [
    we('Machine', 'Prensa servo de embossing con molde calefaccionado', [
      funcion(
        'Grabar el logo completo, definido y en su posicion',
        'Logo completo y en posicion, sin dano de la microfibra alrededor',
        [
          falla('Logo grabado incompleto o con poca definicion', EF_ASPECTO, [
            causa('Temperatura del molde por debajo de la que necesita la microfibra',
              'Hoja de proceso de la prensa, con el control de temperatura del molde antes de producir',
              9, VISUAL_FINAL, 8),
            causa('Carrera de la prensa mas corta que la que necesita la pieza',
              'Hoja de proceso de la prensa, con los parametros de referencia del proveedor',
              9, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra quemada, brillante o marcada alrededor del logo', EF_ASPECTO, [
            causa('Temperatura del molde por encima de la que admite la microfibra',
              'Hoja de proceso de la prensa, con el control de temperatura del molde antes de producir',
              9, VISUAL_FINAL, 8),
            causa('Tiempo de prensado mas largo que el que admite la microfibra',
              'Hoja de proceso de la prensa, con los parametros de referencia del proveedor',
              9, VISUAL_FINAL, 8),
          ]),
          falla('Logo grabado fuera de posicion o girado', EF_ASPECTO, [
            causa('La posicion de la pieza bajo el molde no tiene una referencia definida',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de Produccion', [
      funcion(
        'Cargar y retirar la pieza sin exponerse al molde',
        'Manos fuera de la zona de prensado durante el ciclo y guantes en el puesto',
        [
          // El instructivo de la prensa pide verificar en cada turno la parada de emergencia y
          // que el mando bimanual no este puenteado.
          falla('Atrapamiento de la mano entre el molde y la pieza', EF_SEG_OPERARIO, [
            causa('La pieza se acomoda con la mano dentro de la zona de prensado',
              'Mando bimanual y parada de emergencia de la prensa',
              3, 'Verificacion de la parada de emergencia y del mando bimanual en cada turno', 8),
          ]),
          falla('Quemadura del operario con el molde caliente', EF_SEG_OPERARIO, [
            causa('El molde trabaja caliente y queda al alcance de la mano al cargar y retirar la pieza',
              'Guantes indicados en la hoja de proceso de la prensa',
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 70 — CONTROL FINAL DE CALIDAD
// Visual al 100 %. El plano pide la pieza sin defectos visibles; no hay muestra patron ni
// criterios escritos, ni ensayo de adherencia de serie.
// ===========================================================================
const OP70 = operacion('70', 'CONTROL FINAL DE CALIDAD',
  'Controlar al 100 % la pieza terminada antes de embalarla y decidir si sigue, va a reproceso o es scrap',
  [
    we('Measurement', 'Control visual de la pieza terminada', [
      funcion(
        'Detectar en la pieza terminada los defectos del tapizado, de los agujeros y del logo',
        'Sin defectos visibles segun el plano: rayones, manchas, bordes sueltos ni arrugas; todos los agujeros libres; logo completo y en posicion',
        [
          // Lo que se le escapa a este control no lo mira nadie despues: D=10.
          falla('Pieza con un defecto que pasa el control final', EF_ESCAPE, [
            causa('El aspecto se juzga a ojo, sin muestra patron ni criterios de aceptacion escritos',
              SIN_PREVENCION,
              10, 'Sin control posterior al control final', 10),
          ]),
        ]),
      funcion(
        'Volver a controlar toda pieza que sale de un reproceso',
        'Pieza reprocesada reverificada en el control final antes de embalarla',
        [
          falla('Pieza reprocesada que se embala sin volver al control final', EF_ESCAPE, [
            causa('La pieza reprocesada no lleva una identificacion que la distinga de la ya controlada',
              SIN_PREVENCION,
              10, 'Sin control posterior al control final', 10),
          ]),
        ]),
      funcion(
        'Verificar la adherencia de la microfibra sobre el sustrato',
        'Adherencia segun TL 496 y PV 2034',
        [
          falla('Pieza con adherencia por debajo del requisito que pasa el control final', EF_DESPEGUE, [
            causa('El control final es visual y la adherencia no se ve',
              SIN_PREVENCION,
              10, ADHERENCIA, D_ADHERENCIA),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 71 y 72 — LOS REPROCESOS DEL CONTROL FINAL
// Los que ya tienen las piezas tapizadas hermanas y aplican a una pieza sin costura
// (flujogramas 153 y 159). Entran desde la Rev. A por el criterio de Fak del 23/09/2026: los
// reprocesos conocidos y posibles van de entrada. Ninguno tiene hoja escrita para esta pieza.
// ===========================================================================
const reproceso = (numero, nombre, funcionOp, elemento, funcionElemento, requisito, fallas) => operacion(numero, nombre,
  funcionOp, [we('Method', elemento, [
    funcion(funcionElemento, requisito, fallas),
  ])]);

const OP71 = reproceso('71', 'REPROCESO: REACTIVACION DE ADHESIVO POR CALOR',
  'Volver a pegar con calor la zona o el borde despegado de la pieza terminada',
  'Reactivado manual del adhesivo en la zona despegada',
  'Aplicar calor y presion sobre la zona despegada sin marcar la cara vista',
  'Microfibra adherida en la zona reprocesada, sin marcas en la cara vista',
  [
    falla('Zona que vuelve a despegarse despues del reproceso', EF_DESPEGUE, [
      causa('El calor y la presion del reproceso se aplican a mano',
        OPERARIO,
        O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
    ]),
    falla('Microfibra marcada o brillante por el calor del reproceso', EF_ASPECTO, [
      causa('El calor se aplica del lado de la cara vista sin una temperatura de referencia',
        OPERARIO,
        O_OPERARIO, 'Reverificacion en el control final', 8),
    ]),
  ]);

const OP72 = reproceso('72', 'REPROCESO: MANCHA DE ADHESIVO',
  'Borrar la mancha de adhesivo de la cara vista de la pieza terminada',
  'Borrado manual de la mancha de adhesivo',
  'Quitar el adhesivo de la cara vista sin marcar la microfibra',
  'Cara vista sin restos de adhesivo ni marcas del borrado',
  [
    falla('Cara vista con restos de adhesivo o marcada despues del borrado', EF_ASPECTO, [
      causa('El borrado se hace a mano sobre la cara vista',
        OPERARIO,
        O_OPERARIO, 'Reverificacion en el control final', 8),
    ]),
  ]);

// ===========================================================================
// OP 80 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO  (gama de embalaje GE-103)
// ===========================================================================
const OP80 = operacion('80', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
  'Embalar e identificar la pieza terminada segun la gama de embalaje',
  [
    we('Method', 'Embalaje e identificacion del medio', [
      funcion(
        'Embalar con la cantidad, la variante y la identificacion que pide el cliente',
        'Cantidad por medio, separadores e identificacion segun la gama de embalaje',
        [
          falla('Medio despachado con una cantidad distinta de la de la gama', EF_CANTIDAD, [
            causa('Las piezas se cuentan a mano por piso al armar el medio',
              'Gama de embalaje con las piezas por piso y los pisos por medio',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          falla('Pieza de una variante embalada en el medio de la otra', EF_VARIANTE, [
            causa('Las dos variantes se embalan en el mismo sector y se diferencian por un hueco del cargador',
              SIN_PREVENCION,
              10, 'Sin control de la variante de cada pieza al armar el medio', 10),
          ]),
          falla('Medio despachado con una etiqueta que no corresponde a su contenido', EF_VARIANTE, [
            causa('La etiqueta se coloca a mano al completar el medio',
              'Etiqueta definida en la gama de embalaje',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          // El carton separa los pisos, no las piezas de un mismo piso: son dos causas. Lo que
          // se marca adentro del medio cerrado ya no lo ve nadie en planta: D=10.
          falla('Microfibra marcada o sucia por el propio embalaje', EF_ASPECTO_CLIENTE, [
            causa('Las piezas de un piso se apoyan sobre las del piso de abajo',
              'Carton entre pisos y piezas con el lado vista hacia arriba, segun la gama de embalaje',
              4, 'Sin control del medio despues de cerrado', 10),
            causa('Dentro de un mismo piso las piezas quedan en contacto entre si',
              SIN_PREVENCION,
              10, 'Sin control del medio despues de cerrado', 10),
          ]),
        ]),
    ]),
  ]);

const OPERACIONES = [OP10, OP20, OP21, OP30, OP31, OP32, OP40, OP41, OP42, OP50, OP60, OP70, OP71, OP72, OP80];

const doc = {
  header: {
    scope: 'UPPER TRIM PANEL - CONSOLA CENTRAL - VW427 PATAGONIA - COZZUOL / VW',
    subject: 'UPPER TRIM PANEL - CONSOLA CENTRAL',
    partNumber: 'MP8404 / MP8405',
    applicableParts: [
      'MP8405 SINGLE 50W SUEDE COVER FRAME (2HC.864.263.C)',
      'MP8404 DUAL 50W SUEDE COVER FRAME (2HC.864.263.B)',
    ].join(', '),
    client: 'COZZUOL',
    customerName: 'COZZUOL / VW',
    companyName: 'BARACK MERCOSUL',
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    modelYear: 'VW427 PATAGONIA',
    amfeNumber: NUMERO_EMPRESA,
    rev: 'A',
    revisionLevel: 'A',
    amfeDate: FECHA,
    revDate: FECHA,
    responsibleEngineer: 'Carlos Baptista (Ingenieria)',
    processResponsible: 'Carlos Baptista',
    elaboratedBy: 'Facundo Santoro',
    preparedBy: 'Facundo Santoro',
    reviewedBy: 'Carlos Baptista',
    approvedBy: '',
    plantApproval: '',
    // La nomina vigente vive en core/amfe/nominaBarack.data.json (check EQUIPO_PERSONA_NO_TRABAJA).
    coreTeam: [
      'Facundo Santoro (Ingenieria)',
      'Carlos Baptista (Ingenieria)',
      'Pablo Gamboa (Ingenieria)',
      'Manuel Meszaros (Calidad)',
      'Cristina Rabago (Seguridad e Higiene)',
    ],
    confidentiality: 'Confidencial',
  },
  operations: OPERACIONES,
  revisions: [
    {
      rev: 'A',
      date: FECHA,
      item: 'N/A.',
      details: 'EMISION INICIAL DEL AMFE DE PROCESO DEL UPPER TRIM PANEL DE CONSOLA CENTRAL.',
      pswDate: '',
      modifiedBy: 'FS',
    },
  ],
};

// ---------------------------------------------------------------------------
// Estadisticas y chequeos propios
// ---------------------------------------------------------------------------
let nWE = 0, nFn = 0, nFM = 0, nCausas = 0;
const apCount = {};
const errores = [];
const candidatas = [];
const sinPrevencion = [];
const sinDeteccion = [];
// "Sin ..." y "No hay ..." dicen que el control no existe: las dos formas, en las dos columnas
// (la auditoria de cierre del 01/10/2026 marco que el chequeo anterior miraba una sola).
const NO_EXISTE = /^(Sin |No hay )/i;
for (const op of doc.operations) {
  if (!op.workElements.length) errores.push(`OP${op.opNumber} sin work elements`);
  if (op.operationFunction === op.focusElementFunction) errores.push(`OP${op.opNumber}: la funcion de la operacion es igual a la del elemento foco`);
  for (const w of op.workElements) {
    nWE++;
    for (const f of w.functions) {
      nFn++;
      if (f.description === op.operationFunction) errores.push(`OP${op.opNumber}/${w.name}: la funcion del elemento es igual a la de la operacion`);
      if (!f.failures.length) errores.push(`OP${op.opNumber}/${w.name}: funcion sin fallas`);
      for (const fm of f.failures) {
        nFM++;
        if (!fm.effectLocal || !fm.effectNextLevel || !fm.effectEndUser) errores.push(`OP${op.opNumber}: modo de falla sin los 3 efectos: ${fm.description}`);
        if (!fm.causes.length) errores.push(`OP${op.opNumber}: modo de falla sin causas: ${fm.description}`);
        for (const c of fm.causes) {
          nCausas++;
          if (!c.ap) errores.push(`OP${op.opNumber}: causa sin AP: ${c.description}`);
          else apCount[c.ap] = (apCount[c.ap] || 0) + 1;
          if (/error de oper|error del oper|error humano|capacitaci/i.test(`${c.description} ${c.preventiveControl}`)) errores.push(`OP${op.opNumber}: causa o control de "error de operario / capacitacion": ${c.description}`);
          if (NO_EXISTE.test(c.preventiveControl) && c.occurrence !== 10) errores.push(`OP${op.opNumber}: una prevencion que no existe lleva O=10 y tiene ${c.occurrence}: ${c.preventiveControl}`);
          if (c.preventiveControl === OPERARIO && c.occurrence !== O_OPERARIO) errores.push(`OP${op.opNumber}: el control de conducta lleva O=${O_OPERARIO} y tiene ${c.occurrence}`);
          if (NO_EXISTE.test(c.detectionControl) && c.detection !== 10) errores.push(`OP${op.opNumber}: una deteccion que no existe lleva D=10 y tiene ${c.detection}: ${c.detectionControl}`);
          if (NO_EXISTE.test(c.preventiveControl)) sinPrevencion.push(`OP ${op.opNumber} · ${fm.description}`);
          if (c.detection === 10) sinDeteccion.push(`OP ${op.opNumber} · ${fm.description}`);
          const nivel = nivelPorCriterio(fm.severity, c.occurrence);
          if (nivel) candidatas.push({ op: op.opNumber, fm: fm.description, s: fm.severity, o: c.occurrence, nivel });
        }
      }
    }
  }
}
if (/TBD/.test(JSON.stringify(doc))) errores.push('hay un TBD en el documento');

// Las operaciones son las del flujograma, EN SU ORDEN y con su nombre. Se lee del archivo en
// orden de lectura (rama por rama, el reproceso despues de su control) y no se ordena por
// numero: ordenado, una 41 dibujada antes de la 40 pasaba (auditoria de cierre del 01/10/2026).
// Un almacenado con numero (el WIP del corte) no es una operacion con AMFE.
const flujo = JSON.parse(readFileSync(FLUJOGRAMA, 'utf8'));
const sinAcentos = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const pasosDelFlujo = [];
(function juntar(seq) {
  for (const p of seq || []) {
    if (p.stepId && p.type !== 'storage') pasosDelFlujo.push(p);
    if (p.branchSide?.stepId) pasosDelFlujo.push(p.branchSide);
    if (p.branchSide?.sequence) juntar(p.branchSide.sequence);
    for (const rama of p.branches || []) juntar(Array.isArray(rama) ? rama : rama.sequence);
  }
})(flujo.flow);
const delFlujo = pasosDelFlujo.map((p) => ({ n: p.stepId, nombre: sinAcentos(p.description) }));
const mias = doc.operations.map((o) => ({ n: o.opNumber, nombre: o.name }));
if (JSON.stringify(delFlujo.map((x) => x.n)) !== JSON.stringify(mias.map((x) => x.n))) {
  errores.push(`las operaciones no son las del flujograma, o no estan en su orden: flujograma ${delFlujo.map((x) => x.n).join(',')} / AMFE ${mias.map((x) => x.n).join(',')}`);
}
for (const f of delFlujo) {
  const m = mias.find((x) => x.n === f.n);
  if (m && m.nombre !== f.nombre) errores.push(`OP ${f.n}: el flujograma dice "${f.nombre}" y el AMFE "${m.nombre}"`);
}

// Un efecto que dice SCRAP no puede quedar en la banda de retrabajo (amfe.md §13: S=6 para
// abajo son bandas de retrabajo; si el efecto dice scrap, va 7 u 8).
for (const op of doc.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) {
  if (fm.severity < 7 && /scrap/i.test(fm.effectLocal)) {
    errores.push(`OP${op.opNumber}: "${fm.description}" dice scrap en su efecto y tiene S=${fm.severity}`);
  }
}

console.log(`AMFE ${NUMERO_EMPRESA} — UPPER TRIM PANEL, CONSOLA CENTRAL\n`);
console.log(`  operaciones   : ${doc.operations.length}`);
console.log(`  work elements : ${nWE}`);
console.log(`  funciones     : ${nFn}`);
console.log(`  modos de falla: ${nFM}`);
console.log(`  causas        : ${nCausas}`);
console.log(`  AP            : ${Object.entries(apCount).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`  sin control preventivo: ${sinPrevencion.length}   sin deteccion: ${sinDeteccion.length}`);

console.log('\nPor operacion:');
for (const op of doc.operations) {
  const fms = op.workElements.flatMap((w) => w.functions.flatMap((f) => f.failures));
  const aps = fms.flatMap((fm) => fm.causes.map((c) => c.ap));
  console.log(`  ${op.opNumber.padStart(2)} ${op.name.padEnd(48)} fallas ${String(fms.length).padStart(2)}  H=${aps.filter((a) => a === 'H').length} M=${aps.filter((a) => a === 'M').length} L=${aps.filter((a) => a === 'L').length}`);
}

const val = validateAmfeDoc(doc, doc.header.subject, AMFE_KEY);
printIssues('validador de la casa', val);
const nomina = validateEquipoMultifuncional(doc, AMFE_KEY);
if (nomina.length) errores.push(`${nomina.length} problemas de nomina en la caratula`);
if (val.critical.length) errores.push(`${val.critical.length} criticos del validador`);

console.log(errores.length
  ? `\nERRORES (${errores.length}):\n  ${errores.join('\n  ')}`
  : '\nChequeos propios: OK (operaciones del flujograma en su orden, 3 efectos, AP calculado, sin TBD, sin "error de operario")');

if (process.argv.includes('--candidatas')) {
  console.log('\nCandidatas a caracteristica especial por S y O (las asigna Fak, el script no marca ninguna):');
  for (const c of candidatas) console.log(`  OP ${c.op.padStart(2)}  S=${c.s} O=${c.o}  ${String(c.nivel).padEnd(14)} ${c.fm}`);
} else {
  console.log(`\n${candidatas.length} causas son candidatas a caracteristica especial por S y O (--candidatas las lista; las asigna Fak).`);
}

mkdirSync('tmp/uppertrim', { recursive: true });
writeFileSync('tmp/uppertrim/amfe_upper_trimming.json', JSON.stringify(doc, null, 1));
console.log('\nJSON escrito en tmp/uppertrim/amfe_upper_trimming.json');

if (!APPLY) {
  console.log('DRY-RUN. Corre con --apply para escribir en Supabase.');
  process.exit(errores.length ? 1 : 0);
}
if (errores.length) { console.error('\nNO se escribe: hay errores.'); process.exit(1); }

const causasConSOD = doc.operations.flatMap((o) => o.workElements.flatMap((w) => w.functions.flatMap((f) => f.failures.flatMap((fm) => fm.causes.filter((c) => fm.severity && c.occurrence && c.detection))))).length;
const columnas = {
  subject: doc.header.subject,
  part_number: doc.header.partNumber,
  responsible: doc.header.processResponsible,
  operation_count: doc.operations.length,
  cause_count: nCausas,
  ap_h_count: apCount.H || 0,
  ap_m_count: apCount.M || 0,
  coverage_percent: nCausas > 0 ? Math.round((causasConSOD / nCausas) * 100) : 0,
  last_revision_date: FECHA_ISO,
  revision_level: 'A',
  data: JSON.stringify(doc),
  revisions: JSON.stringify(doc.revisions),
};

const sb = await connectSupabase();
const { data: ex, error: errSel } = await sb.from('amfe_documents').select('id,amfe_number,updated_at,data').eq('amfe_number', AMFE_KEY);
if (errSel) { console.error('SELECT FALLO:', errSel.message); process.exit(1); }
if (ex && ex.length > 1) { console.error(`Hay ${ex.length} filas ${AMFE_KEY}: no se toca nada.`); process.exit(1); }

let idDoc;
if (ex && ex.length === 1) {
  // Ya existe: se actualiza en su lugar. Este script es el generador del documento.
  idDoc = ex[0].id;
  const vivo = parseData(ex[0].data);
  console.log(`\n${AMFE_KEY} ya existe (id=${idDoc}, updated_at=${ex[0].updated_at}). Se ACTUALIZA en su lugar.`);
  // El generador PISA lo que este en la app. Si alguien ya cargo ahi una sigla, una accion o
  // una revision nueva, eso se perderia sin que el gate lo frene (auditoria de cierre del
  // 01/10/2026): se corta aca y se decide a mano.
  const editadoEnLaApp = [];
  for (const o of vivo.operations || []) for (const w of o.workElements || []) for (const f of w.functions || []) for (const fm of f.failures || []) for (const c of fm.causes || []) {
    if (c.specialChar) editadoEnLaApp.push(`sigla ${c.specialChar} en OP ${o.opNumber}`);
    if (c.preventionAction || c.detectionAction) editadoEnLaApp.push(`accion cargada en OP ${o.opNumber}`);
  }
  if ((vivo.revisions || []).length > 1) editadoEnLaApp.push(`${vivo.revisions.length} revisiones`);
  if (editadoEnLaApp.length && !process.argv.includes('--pisar-lo-de-la-app')) {
    console.error(`\nNO se actualiza: el documento vivo tiene cosas que este generador no escribe:\n  ${[...new Set(editadoEnLaApp)].join('\n  ')}`);
    console.error('Pasarlas al generador, o correr con --pisar-lo-de-la-app si se quieren perder.');
    process.exit(1);
  }
  await runWithValidation(
    [{ id: idDoc, amfeNumber: AMFE_KEY, productName: doc.header.subject, before: vivo, after: doc }],
    true,
    async () => {
      const { error: errUpd } = await sb.from('amfe_documents').update({ ...columnas, updated_at: new Date().toISOString() }).eq('id', idDoc);
      if (errUpd) { console.error('UPDATE FALLO:', errUpd.message); process.exit(1); }
    },
  );
} else {
  idDoc = randomUUID();
  const { error } = await sb.from('amfe_documents').insert({
    id: idDoc,
    amfe_number: AMFE_KEY,
    project_name: 'VWA/PATAGONIA/UPPER_TRIM_PANEL',
    client: 'COZZUOL',
    organization: 'BARACK MERCOSUL',
    status: 'draft',
    start_date: FECHA_ISO,
    checksum: '',
    ...columnas,
  });
  if (error) { console.error('INSERT FALLO:', error.message); process.exit(1); }
  console.log(`\nINSERT OK id=${idDoc}`);
}

// Relectura de control: que el data quedo legible y que hay UNA sola fila con esa clave.
const { data: v } = await sb.from('amfe_documents').select('id,operation_count,cause_count,updated_at,data').eq('amfe_number', AMFE_KEY);
const back = parseData(v[0].data);
console.log(`  verificado: filas=${v.length} ops=${v[0].operation_count} causas=${v[0].cause_count} | data.operations es array: ${Array.isArray(back.operations)} | ops leidas: ${back.operations.length} | updated_at ${v[0].updated_at}`);
process.exit(v.length === 1 && back.operations.length === doc.operations.length ? 0 : 1);
