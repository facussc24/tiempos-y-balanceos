/**
 * _crearAmfeUpperTrimming.mjs — arma el AMFE de proceso del UPPER TRIM PANEL de consola
 * central (Cozzuol / VW427 Patagonia): MP8405 SINGLE (2HC.864.263.C) y MP8404 DUAL
 * (2HC.864.263.B). Es la PRIMERA emision: la pieza no tenia ni flujograma ni AMFE (pedido de
 * Calidad del 01/10/2026).
 *
 * HOY ES SOLO BORRADOR. No escribe en Supabase: arma el documento, lo valida y deja el JSON en
 * tmp/. Crear un AMFE desde cero y usar un numero del Listado Maestro llevan el OK de Fak
 * (autonomy-contract §B y §F); el camino que escribe se agrega cuando ese OK este.
 *
 * DE DONDE SALE CADA DATO
 *   - Secuencia y numeracion: tools/flowchart/data/BORRADOR-UPPER-TRIMMING.json (manda el
 *     flujograma, regla no-pfd-no-ho). Se lee del archivo, no se copia a mano.
 *   - Proceso: pliego de dispositivos "Dispositivo Tapizado Manual Console Central Component"
 *     Rev.01 del 27/04/2026 (cuna de posicionado, cuna de doblado y refilado, punzonado,
 *     grabado), video de planta del 31/07/2026 (adhesivo a pistola sobre tela y sustrato,
 *     tapizado y doblado a mano), BOM del arb (adhesivo FA + reticulante GV), DXF de tizada
 *     (el hueco del cargador sale cortado de la mesa: 1 en SINGLE, 2 en DUAL).
 *   - Prensa de grabado: manual de Suzhou Jfortune y las hojas de proceso de la prensa
 *     (scripts/embossing/): mando bimanual, parada de emergencia, molde calefaccionado con
 *     controlador de temperatura, guantes. La temperatura y los parametros para ESTA pieza no
 *     estan validados (scripts/embossing/falta.txt).
 *   - Embalaje: gama GE-103 Rev.1 (cajon retornable, carton entre pisos, lado vista arriba).
 *   - Requisitos del cliente: TL 496 (aspecto del tapizado), PV 2034 (adherencia) y TL 1010
 *     (inflamabilidad; Manuel Meszaros, mail del 09/09/2026).
 *   - Microfibra: el articulo de Meisheng existe en dos versiones que se distinguen por el
 *     ultimo digito del codigo; la antiflama es MS-9PQ009-BK25-2 (cargada en el arb el
 *     01/10/2026) y lo que se recibio hasta hoy es la -1 (memoria
 *     project_upper_trimming_codigos_arb).
 *   - Recepcion del adhesivo: planes 729 (Adhesivo FA) y 730 (Reticulante GV) de
 *     `Recepcion De Materiales\1 - Planes de control\ADHESIVOS\FENOCLOR`. Para la microfibra y
 *     para el sustrato de Cozzuol NO hay plan de recepcion en esa carpeta (mirado 01/10/2026).
 *   - Deposito, autoelevador y mesa de corte: los mismos de la planta, redactados como en el
 *     AMFE 173 (scripts/_crearAmfe173P21Naranja.mjs), que cita la HO de mesa de corte y su
 *     ficha de set up.
 *
 * LO QUE NO EXISTE PARA ESTA PIEZA Y POR ESO NO SE DECLARA
 * Hoja de proceso del adhesivado, del tapizado, del doblado y del punzonado; muestra patron;
 * criterios de aceptacion de la inspeccion final; ensayo de adherencia; metodo de reproceso.
 * Donde no hay control preventivo va "Sin control preventivo" con O=10 (Tabla P2 oficial), y
 * donde no hay deteccion, D=10. El AMFE dice DONDE FALTA CONTROL; no se rellena.
 *
 * SIGLAS: ninguna. Las CC/SC las asigna Fak o el cliente (core-prohibiciones §2). El script
 * lista al final las causas que por S y O son candidatas, para que el decida.
 *
 * Uso:  node scripts/_crearAmfeUpperTrimming.mjs      (arma, valida y muestra; no escribe)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { calculateAP } from './_lib/amfeIo.mjs';
import { validateAmfeDoc, validateEquipoMultifuncional, printIssues, nivelPorCriterio } from './_lib/amfeValidator.mjs';

const AMFE_KEY = 'AMFE-UT-PAT';
// Proximo libre del Listado_Maestro_AMFE.xlsx leido el 01/10/2026 (el ultimo cargado es el 173).
// Se usa recien con el OK de Fak: la fila del listado es registro compartido.
const NUMERO_EMPRESA = '174';
const FECHA = '01/10/2026';
const FLUJOGRAMA = 'tools/flowchart/data/BORRADOR-UPPER-TRIMMING.json';

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
const FOCO = 'Funcion Interna: Entregar el Upper Trim Panel tapizado en microfibra, con los agujeros libres y el logo de carga grabado, conforme a la muestra aprobada'
  + ' / Funcion del Cliente: Permitir el armado de la consola central en Cozzuol sin clasificacion ni retrabajo'
  + ' / Funcion del Usuario Final: Aspecto y tacto de la consola central, con la zona de carga inalambrica identificada';

const SIN_PREVENCION = 'Sin control preventivo';
const VISUAL_FINAL = 'Inspeccion visual 100% en la inspeccion final';

// ---------------------------------------------------------------------------
// EFECTOS — cada uno trae su S, de la Tabla P1 oficial (SETEC pag. 101-103).
//   10 riesgo agudo para el operario · 9 incumplimiento de regulacion · 7 parte de la
//   produccion a scrap / reemplazo en el campo · 6 paro de linea de hasta una hora ·
//   5 clasificacion de piezas sin paro de linea.
// ---------------------------------------------------------------------------
const EF_LEGAL_FUEGO = {
  s: 9,
  local: 'Microfibra sin evidencia de cumplir el limite de velocidad de combustion',
  next: 'Bloqueo del lote en la recepcion de Cozzuol',
  end: 'Incumplimiento de un requisito legal de inflamabilidad en el habitaculo del vehiculo',
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
// Agujero tapado o corrido: la pieza no se puede montar. No llega al vehiculo; el efecto es
// de la planta del cliente. P1-7: paro de linea de una hora a un turno, posible freno de envios.
const EF_MONTAJE = {
  s: 7,
  local: 'Pieza con agujeros que no coinciden con los del sustrato',
  next: 'Pieza que no se puede montar en la consola central: rechazo del lote en Cozzuol',
  end: 'Sin efecto en el vehiculo: la pieza no llega a montarse',
};
const EF_ASPECTO = {
  s: 5,
  local: 'Pieza con desvio de aspecto en zona vista',
  next: 'Posible clasificacion de piezas en la planta de Cozzuol',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
const EF_IDENTIFICACION = {
  s: 5,
  local: 'Cajon sin la identificacion que corresponde a su contenido',
  next: 'Clasificacion y reidentificacion de piezas en Cozzuol',
  end: 'Sin efecto en la funcion del vehiculo',
};
const EF_CANTIDAD = {
  s: 6,
  local: 'Cajon con una cantidad o una variante distinta de la pedida',
  next: 'Faltante en la recepcion de Cozzuol, con reposicion urgente',
  end: 'Sin efecto en el vehiculo',
};
const EF_SEG_OPERARIO = {
  s: 10,
  local: 'Riesgo de salud o seguridad para el operario del puesto; posible incumplimiento de la Ley 19587',
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
        'Inflamabilidad segun TL 1010',
        [
          // El riesgo no es teorico: lo recibido hasta el 01/10/2026 es la version -1, cuya
          // ficha no trae dato de inflamabilidad. O=8 (P2: proceso conocido con problemas).
          // La orden de compra abierta todavia nombra la -1: por eso la prevencion que se
          // puede declarar es el codigo cargado en el maestro, no la orden.
          falla('Microfibra recibida sin tratamiento antiflama', EF_LEGAL_FUEGO, [
            causa('El articulo existe en una version sin tratamiento antiflama, que se distingue por el ultimo digito del codigo',
              'Codigo de la version antiflama cargado en el maestro de insumos y en la lista de materiales',
              8, 'Sin ensayo de inflamabilidad definido en la recepcion de este material', 10),
          ]),
        ]),
      funcion(
        'Entregar la microfibra con el color, el espesor y el gramaje de la muestra aprobada',
        'Color, espesor y gramaje segun la ficha tecnica del proveedor',
        [
          falla('Microfibra recibida con un color distinto del aprobado', EF_ASPECTO, [
            causa('Variacion de tono entre partidas del proveedor',
              'Articulo y color declarados en la orden de compra',
              6, 'Sin muestra patron de color para comparar en la recepcion', 10),
          ]),
          falla('Microfibra recibida con espesor o gramaje distinto del de la ficha tecnica', EF_ASPECTO, [
            causa('Variacion del proceso del proveedor entre partidas',
              'Ficha tecnica del proveedor con el espesor y el gramaje del articulo',
              6, 'Sin plan de control de recepcion para este material', 10),
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
        'Entregar el sustrato sin deformaciones, rebabas ni marcas',
        'Sustrato de la variante pedida, apto para tapizar',
        [
          falla('Sustrato recibido deformado, con rebabas o con marcas', EF_ASPECTO, [
            causa('Variacion del proceso de inyeccion del proveedor',
              SIN_PREVENCION,
              10, 'Sin plan de control de recepcion para el sustrato', 10),
          ]),
        ]),
    ]),
    we('Material', 'Adhesivo FA y reticulante GV', [
      funcion(
        'Entregar el adhesivo y el reticulante especificados, dentro de su vencimiento',
        'Adhesivo FA y reticulante GV de Fenoclor, con lote y fecha de vencimiento',
        [
          // Material de serie hace anos en la planta: O=3. El control es el del plan de
          // recepcion del material, que es por muestreo: D=9.
          falla('Adhesivo o reticulante recibido distinto del especificado o vencido', EF_DESPEGUE, [
            causa('Los componentes se reciben contra el remito y el control es por muestreo',
              'Plan de control de recepcion del adhesivo FA y del reticulante GV',
              3, 'Control de recepcion segun el plan del material, por muestreo', 9),
          ]),
        ]),
    ]),
    we('Method', 'Identificacion y liberacion del material en el deposito', [
      funcion(
        'Que a produccion solo salga material ingresado, controlado e identificado',
        'Material identificado por lote y liberado antes de habilitarlo al sector',
        [
          falla('Material entregado a produccion sin haber sido ingresado ni liberado', EF_SCRAP_INTERNO, [
            causa('El circuito admite entregar material directo al sector cuando hay una urgencia de produccion',
              'Zona de material pendiente de control fisicamente separada de la de material liberado',
              4, 'Control de la identificacion de lote en el sector antes de arrancar el turno', 8),
          ]),
        ]),
    ]),
    we('Environment', 'Deposito de materia prima', [
      funcion(
        'Almacenar la materia prima sin degradarla y sin generar riesgo en el sector',
        'Estiba segun las especificaciones del fabricante y deposito libre de filtraciones',
        [
          falla('Productos quimicos inflamables apilados junto a la materia prima', EF_SEG_OPERARIO, [
            causa('El deposito no tiene una zona propia y senalizada para los inflamables',
              'Procedimiento de almacenamiento de productos quimicos',
              3, 'Control visual del sector en el recorrido de turno', 8),
          ]),
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
          falla('Autoelevador operado sin el check list previo o con una falla no detectada', EF_SEG_OPERARIO, [
            causa('El check list no esta disponible en el puesto y el equipo arranca igual sin completarlo',
              'Check list de autoelevador definido',
              3, 'Verificacion del check list firmado al inicio de turno', 8),
          ]),
          falla('Dano del embalaje de la materia prima durante el movimiento', EF_SCRAP_INTERNO, [
            causa('El ancho de pasillo y la altura de carga no dejan margen para maniobrar con la carga a la vista',
              'Carteleria de circulacion en el deposito',
              3, 'Control visual del estado del embalaje al recibirlo en el sector', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 20 — CORTE DE MICROFIBRA
// El hueco del cargador sale cortado de la mesa (contorno interior del DXF de tizada: uno en
// SINGLE, dos en DUAL). Los agujeros chicos NO: se punzonan despues de tapizar (OP 50).
// ===========================================================================
const OP20 = operacion('20', 'CORTE DE MICROFIBRA',
  'Cortar la microfibra con el contorno y el hueco del cargador del patron liberado de cada variante',
  [
    we('Method', 'Patron y programa de corte', [
      funcion(
        'Cortar el contorno y el hueco del cargador del patron liberado',
        'Programa de corte de la revision liberada del patron de cada variante',
        [
          falla('Contorno o hueco del cargador distinto del patron liberado', EF_SCRAP_INTERNO, [
            causa('El programa de corte cargado en la mesa no es el de la revision liberada del patron',
              'Codigo y nombre del programa verificados en el set up de la mesa de corte',
              4, 'Sin control de primera pieza documentado para esta pieza', 10),
          ]),
          // Un corte SINGLE no se puede tapizar sobre un sustrato DUAL sin que se note: el
          // hueco no esta. Deteccion aguas abajo, a la vista: D=8.
          falla('Se corta una variante distinta de la pedida', EF_SCRAP_INTERNO, [
            causa('Los archivos de corte de las dos variantes conviven en el programa y se diferencian por un hueco',
              'Codigo y nombre del programa verificados en el set up de la mesa de corte',
              3, 'Control visual de los huecos al posicionar la microfibra sobre el sustrato, en el tapizado', 8),
          ]),
        ]),
      funcion(
        'Cortar el material que pide la orden de corte',
        'Microfibra de la version antiflama, identificada por el codigo del rollo',
        [
          // Mismo riesgo que en la recepcion, del lado de planta: mientras haya rollos de la
          // version -1, se pueden montar en la mesa. O=8.
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
              4, 'Medicion del ancho de cuchilla con calibre, antes de cada corte', 6),
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
            causa('La etiqueta se completa a mano despues de retirar el corte',
              'Etiqueta emitida con la orden de corte',
              3, 'Cotejo de la etiqueta contra el contenido al cerrar el bin', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 30 — ADHESIVADO DE MICROFIBRA Y SUSTRATO
// Adhesivo FA con reticulante GV, a pistola, sobre las dos partes (video de planta del
// 31/07/2026 y BOM del arb). La mezcla tiene instruccion (IO-08); la aplicacion sobre esta
// pieza no tiene hoja.
// ===========================================================================
const OP30 = operacion('30', 'ADHESIVADO DE MICROFIBRA Y SUSTRATO',
  'Aplicar adhesivo sobre la microfibra y sobre el sustrato antes del tapizado',
  [
    we('Material', 'Mezcla de adhesivo FA con reticulante GV', [
      funcion(
        'Usar el adhesivo mezclado en la relacion definida y dentro de su vida util',
        'Mezcla segun la instruccion IO-08',
        [
          falla('Mezcla de adhesivo fuera de la relacion definida o usada fuera de su vida util', EF_DESPEGUE, [
            causa('El reticulante se vuelca a mano en la lata de adhesivo',
              'Instruccion IO-08: una botella de reticulante por lata de adhesivo',
              4, 'Sin control de la mezcla definido para esta pieza', 10),
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
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Exceso de adhesivo que traspasa la microfibra o deja zonas brillantes', EF_ASPECTO, [
            causa('La cantidad de adhesivo depende de la regulacion de la pistola y de las pasadas',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Method', 'Espera entre el adhesivado y el tapizado', [
      funcion(
        'Tapizar dentro del tiempo abierto del adhesivo',
        'Pieza adhesivada tapizada antes de que el adhesivo pierda pegajosidad',
        [
          falla('Pieza adhesivada que se tapiza fuera del tiempo abierto del adhesivo', EF_DESPEGUE, [
            causa('Las piezas adhesivadas esperan sin la hora de adhesivado a la vista',
              SIN_PREVENCION,
              10, 'Sin registro de la hora de adhesivado en la pieza', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 40 — POSICIONADO Y TAPIZADO DE MICROFIBRA SOBRE SUSTRATO
// A mano. El pliego preve una cuna de posicionado; al 21/08/2026 no habia ninguna liberada.
// ===========================================================================
const OP40 = operacion('40', 'POSICIONADO Y TAPIZADO DE MICROFIBRA SOBRE SUSTRATO',
  'Posicionar la microfibra adhesivada sobre el sustrato y asentarla sin arrugas',
  [
    we('Machine', 'Cuna de posicionado del sustrato', [
      funcion(
        'Sostener el sustrato y dar la referencia de posicion de la microfibra',
        'Microfibra centrada, con el hueco del cargador sobre el del sustrato',
        [
          falla('Microfibra desalineada respecto del sustrato o del hueco del cargador', EF_ASPECTO, [
            causa('La microfibra se posiciona a mano, sin un tope que la ubique sobre el sustrato',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Method', 'Tapizado manual de la microfibra', [
      funcion(
        'Asentar la microfibra sobre toda la superficie del sustrato',
        'Sin arrugas, pliegues, burbujas ni marcas de presion en zona vista',
        [
          falla('Pieza tapizada con arrugas o pliegues en zona vista', EF_ASPECTO, [
            causa('La microfibra se estira y se acomoda a mano sobre las curvas del sustrato',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra con marcas de presion', EF_ASPECTO, [
            causa('La presion para asentar la microfibra se da a mano, sin una referencia',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra con burbujas o zonas sin pegar', EF_DESPEGUE, [
            causa('El asentado a mano no llega a toda la superficie en los radios del sustrato',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 41 — DOBLADO DE BORDES Y REFILADO
// A mano. El pliego preve una cuna de doblado y refilado (tampoco liberada). Para la pared
// del hueco del cargador existe un virolador que sostiene la microfibra mientras el adhesivo
// toma (utillaje propio, entregado el 20/08/2026).
// ===========================================================================
const OP41 = operacion('41', 'DOBLADO DE BORDES Y REFILADO',
  'Doblar la microfibra sobre los bordes del sustrato y del hueco del cargador y cortar el sobrante',
  [
    we('Method', 'Doblado manual de los bordes', [
      funcion(
        'Dejar la microfibra doblada y pegada en todo el contorno',
        'Bordes doblados y adheridos, sin tela despegada',
        [
          falla('Borde de la microfibra despegado en el contorno de la pieza', EF_DESPEGUE, [
            causa('El doblez se hace a mano y se suelta antes de que el adhesivo tome',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Machine', 'Virolador del hueco del cargador', [
      funcion(
        'Sostener la microfibra contra la pared del hueco mientras el adhesivo toma',
        'Microfibra adherida a la pared del hueco en todo su contorno',
        [
          // Hay una ayuda tecnica, pero sin historial en serie: O=5, no 3 (Tabla P2).
          falla('Microfibra despegada en la pared del hueco del cargador', EF_DESPEGUE, [
            causa('La microfibra doblada tiende a volver a su posicion mientras el adhesivo toma',
              'Virolador que sostiene la microfibra contra la pared del hueco',
              5, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Machine', 'Cuna de doblado y refilado', [
      funcion(
        'Sostener la pieza y guiar el corte del sobrante',
        'Sobrante cortado al ras, sin rebaba ni deshilachado y sin sustrato a la vista',
        [
          falla('Borde refilado con rebaba o deshilachado', EF_ASPECTO, [
            causa('El sobrante se corta a mano, sin una guia para la herramienta',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          // Sin metodo de reproceso definido: la pieza va a scrap.
          falla('Microfibra cortada de mas, con el sustrato a la vista', EF_SCRAP_INTERNO, [
            causa('La herramienta de corte se guia a mano contra el borde del sustrato',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 50 — PUNZONADO DE AGUJEROS
// Dispositivo neumatico del pliego (zonas de punzonado sobre la pieza ya tapizada).
// ===========================================================================
const OP50 = operacion('50', 'PUNZONADO DE AGUJEROS',
  'Abrir en la microfibra los agujeros del sustrato, sobre la pieza ya tapizada',
  [
    we('Machine', 'Dispositivo de punzonado neumatico', [
      funcion(
        'Punzonar la microfibra sobre cada agujero del sustrato',
        'Todos los agujeros del sustrato libres y sin dano alrededor',
        [
          falla('Agujero sin punzonar o punzonado incompleto', EF_MONTAJE, [
            causa('Punzon desgastado que no llega a separar la microfibra',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Agujero punzonado corrido respecto del agujero del sustrato', EF_MONTAJE, [
            causa('La pieza queda mal apoyada en el nido del dispositivo',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra marcada o desgarrada alrededor del agujero', EF_ASPECTO, [
            causa('Punzon sin filo que arrastra la microfibra en lugar de cortarla',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 60 — GRABADO DE LOGO DE CARGA
// Prensa servo con molde calefaccionado y mando bimanual. Hay hoja de proceso de la prensa;
// la temperatura y los parametros para esta pieza no estan validados: O=9 (Tabla P2, primera
// aplicacion de un procedimiento nuevo, sin experiencia).
// ===========================================================================
const OP60 = operacion('60', 'GRABADO DE LOGO DE CARGA',
  'Grabar el logo de carga inalambrica sobre la microfibra de la pieza tapizada',
  [
    we('Machine', 'Prensa servo de grabado con molde calefaccionado', [
      funcion(
        'Grabar el logo completo, definido y en su posicion',
        'Logo segun la muestra aprobada, sin dano de la microfibra alrededor',
        [
          falla('Logo grabado incompleto o con poca definicion', EF_ASPECTO, [
            causa('Temperatura del molde o carrera de la prensa por debajo de lo que necesita la microfibra',
              'Hoja de proceso de la prensa, con el control de temperatura del molde antes de producir',
              9, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra quemada, brillante o marcada alrededor del logo', EF_ASPECTO, [
            causa('Temperatura del molde o tiempo de prensado por encima de lo que admite la microfibra',
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
          falla('Atrapamiento de la mano entre el molde y la pieza', EF_SEG_OPERARIO, [
            causa('La pieza se acomoda con la mano dentro de la zona de prensado',
              'Mando bimanual y parada de emergencia de la prensa',
              3, 'Sin verificacion periodica del mando bimanual definida', 10),
          ]),
          falla('Quemadura del operario con el molde caliente', EF_SEG_OPERARIO, [
            causa('El molde trabaja caliente y queda al alcance de la mano al cargar y retirar la pieza',
              'Guantes indicados en la hoja de proceso de la prensa',
              4, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 70 — INSPECCION FINAL
// Visual al 100 %. No hay muestra patron ni criterios escritos para esta pieza, ni ensayo de
// adherencia: se declara tal cual.
// ===========================================================================
const OP70 = operacion('70', 'INSPECCION FINAL',
  'Inspeccionar al 100 % la pieza terminada antes de embalarla',
  [
    we('Measurement', 'Inspeccion visual de la pieza terminada', [
      funcion(
        'Detectar en la pieza terminada los defectos de aspecto del tapizado',
        'Sin tela despegada o desalineada, zonas brillantes, adhesivo que traspasa, arrugas, marcas de presion ni bordes deshilachados, segun TL 496',
        [
          falla('Pieza con un defecto de aspecto que pasa la inspeccion final', EF_ASPECTO, [
            causa('El aspecto se juzga a ojo, sin muestra patron ni criterios de aceptacion escritos',
              SIN_PREVENCION,
              10, 'Inspeccion visual 100% de la pieza terminada', 8),
          ]),
        ]),
      funcion(
        'Asegurar la adherencia de la microfibra sobre el sustrato',
        'Adherencia segun PV 2034',
        [
          falla('Pieza con adherencia por debajo del requisito que pasa la inspeccion final', EF_DESPEGUE, [
            causa('El pegado deficiente no siempre se ve en una inspeccion visual',
              'Requisito de adherencia definido por la norma del cliente',
              6, 'Sin ensayo de adherencia definido para esta pieza', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 80 — EMBALAJE E IDENTIFICACION  (gama de embalaje GE-103)
// ===========================================================================
const OP80 = operacion('80', 'EMBALAJE E IDENTIFICACION',
  'Embalar e identificar la pieza terminada segun la gama de embalaje',
  [
    we('Method', 'Embalaje e identificacion del cajon', [
      funcion(
        'Embalar con la cantidad, la variante y la identificacion que pide el cliente',
        'Cantidad por cajon, separadores e identificacion segun la gama de embalaje',
        [
          falla('Cajon despachado con una cantidad distinta de la de la gama', EF_CANTIDAD, [
            causa('Las piezas se cuentan a mano por piso al armar el cajon',
              'Gama de embalaje con las piezas por piso y los pisos por cajon',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          falla('Pieza de una variante embalada en el cajon de la otra', EF_CANTIDAD, [
            causa('Las dos variantes se embalan en el mismo sector y se diferencian por un hueco del cargador',
              'Etiqueta del cajon con el codigo de la variante',
              5, 'Sin control de la variante de cada pieza al armar el cajon', 10),
          ]),
          falla('Cajon despachado con una etiqueta que no corresponde a su contenido', EF_IDENTIFICACION, [
            causa('La etiqueta se coloca a mano al completar el cajon',
              'Etiqueta definida en la gama de embalaje',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          falla('Microfibra marcada o sucia por el propio embalaje', EF_ASPECTO, [
            causa('Dentro de un mismo piso las piezas quedan en contacto entre si',
              'Carton entre pisos y piezas con el lado vista hacia arriba, segun la gama de embalaje',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
        ]),
    ]),
  ]);

const OPERACIONES = [OP10, OP20, OP30, OP40, OP41, OP50, OP60, OP70, OP80];

const doc = {
  header: {
    scope: 'UPPER TRIM PANEL - CONSOLA CENTRAL - VW427 PATAGONIA - COZZUOL / VW',
    subject: 'UPPER TRIM PANEL - CONSOLA CENTRAL',
    partNumber: '2HC.864.263.C / 2HC.864.263.B',
    applicableParts: [
      '2HC.864.263.C SINGLE 50W SUEDE COVER FRAME (MP8405)',
      '2HC.864.263.B DUAL 50W SUEDE COVER FRAME (MP8404)',
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
for (const op of doc.operations) {
  if (!op.workElements.length) errores.push(`OP${op.opNumber} sin work elements`);
  if (op.operationFunction === op.focusElementFunction) errores.push(`OP${op.opNumber}: la funcion de la operacion es igual a la del elemento foco`);
  for (const w of op.workElements) {
    nWE++;
    for (const f of w.functions) {
      nFn++;
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
          if (c.preventiveControl === SIN_PREVENCION && c.occurrence !== 10) errores.push(`OP${op.opNumber}: "${SIN_PREVENCION}" lleva O=10 y tiene ${c.occurrence}`);
          if (/^Sin /.test(c.detectionControl) && c.detection !== 10) errores.push(`OP${op.opNumber}: una deteccion que no existe lleva D=10 y tiene ${c.detection}`);
          if (c.preventiveControl === SIN_PREVENCION) sinPrevencion.push(`OP ${op.opNumber} · ${fm.description}`);
          if (c.detection === 10) sinDeteccion.push(`OP ${op.opNumber} · ${fm.description}`);
          const nivel = nivelPorCriterio(fm.severity, c.occurrence);
          if (nivel) candidatas.push({ op: op.opNumber, fm: fm.description, s: fm.severity, o: c.occurrence, nivel });
        }
      }
    }
  }
}
const todoElTexto = JSON.stringify(doc);
if (/TBD/.test(todoElTexto)) errores.push('hay un TBD en el documento');

// Las operaciones son las del flujograma, en su orden, con su nombre. Se lee del archivo.
const flujo = JSON.parse(readFileSync(FLUJOGRAMA, 'utf8'));
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const delFlujo = flujo.flow.filter((p) => p.stepId).map((p) => ({ n: p.stepId, nombre: sinAcentos(p.description) }));
const mias = doc.operations.map((o) => ({ n: o.opNumber, nombre: o.name }));
if (JSON.stringify(delFlujo.map((x) => x.n)) !== JSON.stringify(mias.map((x) => x.n))) {
  errores.push(`las operaciones no son las del flujograma: flujograma ${delFlujo.map((x) => x.n).join(',')} / AMFE ${mias.map((x) => x.n).join(',')}`);
}
for (const f of delFlujo) {
  const m = mias.find((x) => x.n === f.n);
  if (m && m.nombre !== f.nombre) errores.push(`OP ${f.n}: el flujograma dice "${f.nombre}" y el AMFE "${m.nombre}"`);
}

console.log(`AMFE ${NUMERO_EMPRESA} (numero a confirmar) — UPPER TRIM PANEL, CONSOLA CENTRAL — BORRADOR\n`);
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
  console.log(`  ${op.opNumber.padStart(2)} ${op.name.padEnd(54)} fallas ${String(fms.length).padStart(2)}  H=${aps.filter((a) => a === 'H').length} M=${aps.filter((a) => a === 'M').length} L=${aps.filter((a) => a === 'L').length}`);
}

const val = validateAmfeDoc(doc, doc.header.subject, AMFE_KEY);
printIssues('validador de la casa', val);
const nomina = validateEquipoMultifuncional(doc, AMFE_KEY);
if (nomina.length) errores.push(`${nomina.length} problemas de nomina en la caratula`);
if (val.critical.length) errores.push(`${val.critical.length} criticos del validador`);

console.log(errores.length
  ? `\nERRORES (${errores.length}):\n  ${errores.join('\n  ')}`
  : '\nChequeos propios: OK (operaciones del flujograma, 3 efectos, AP calculado, sin TBD, sin "error de operario")');

console.log('\nCandidatas a caracteristica especial por S y O (las asigna Fak, el script no marca ninguna):');
for (const c of candidatas) console.log(`  OP ${c.op.padStart(2)}  S=${c.s} O=${c.o}  ${String(c.nivel).padEnd(14)} ${c.fm}`);

mkdirSync('tmp/uppertrim', { recursive: true });
writeFileSync('tmp/uppertrim/amfe_upper_trimming.json', JSON.stringify(doc, null, 1));
console.log('\nJSON escrito en tmp/uppertrim/amfe_upper_trimming.json');
console.log('BORRADOR: no se escribio en Supabase.');
process.exit(errores.length ? 1 : 0);
