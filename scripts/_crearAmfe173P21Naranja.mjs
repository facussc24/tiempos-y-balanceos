/**
 * _crearAmfe173P21Naranja.mjs — crea el AMFE 173 (APB P21 HILO NARANJA COSTURA SIMPLE,
 * MY2026, cliente SMRC / Stellantis) en Supabase, rederivado al estandar de la casa.
 *
 * QUE PIEZA ES
 * ECR-0368291 del 17/06/2026, "New ver sewing with orange thread": pespunte SIMPLE de UNA
 * linea. El cliente abrio part numbers nuevos (00257327-01-NHZD FR.RH / 00257328-01-NHZD
 * FR.LH), asi que es una PIEZA NUEVA y este AMFE nace en Rev. A — no es una revision del
 * AMFE 127 Rev.O, que es con el que se produce hoy el cuero, el verde, el azul y el naranja
 * anterior y NO se toca (criterio de Fak del 11/09/2026, memoria `pieza_nueva_no_es_revision`).
 *
 * POR QUE SE REDERIVA Y NO SE COPIA EL 127
 * Medido sobre sus 102 causas el 21/09/2026:
 *   - 70 de 102 (69 %) tienen "error del operario" como causa — prohibido por amfe.md §6 y
 *     por el gate CAUSE_CAPACITACION. Ademas hay 11 escritas "error del opeario".
 *   - 95 de 102 controles de deteccion son la palabra "Visual", repetida identica.
 *   - Solo 25 causas distintas en 102 filas.
 *   - La severidad esta cargada por CAUSA y no por MODO DE FALLA: dentro de un mismo bloque
 *     conviven S=8, S=7 y S=5.
 *   - La columna de caracteristicas especiales esta VACIA en las 1944 filas, aunque el
 *     cliente designo 19.
 *   - La hoja esta rotulada "AMFE-FMEA DE DISENO" y las columnas de AP dicen "AP DFMEA",
 *     siendo un AMFE de PROCESO.
 * Mismo criterio que se uso para rederivar el 172 (ver _crearAmfe172Ductos.mjs).
 *
 * DE DONDE SALE CADA DATO (no hay ninguno inventado)
 *   - Las 19 caracteristicas especiales, con su valor nominal, su tolerancia, su metodo de
 *     ensayo y la SIGLA QUE LES PUSO EL CLIENTE: `P21 ARMREST_SSRT MY2026_LSC_v1.xlsx`
 *     (10/07/2026, G. Medina; el 13/07 agrego la SC 1.6), hoja LSC, en
 *     ...\P21 SSRT-MY2026 HILO NARANJA\APQP\1. Imput\
 *   - Secuencia y numeracion de operaciones: Flujograma 159 Rev.A
 *     (tools/flowchart/data/159-APB-P21-MY2026.json). Regla no-pfd-no-ho: manda el flujograma.
 *   - Modos de falla, controles y pasos de planta: AMFE 127 Rev.O (`P21 AMFE REV2.xlsx`) y
 *     HO 927 REV6, leidos operacion por operacion.
 *   - Plazos y volumenes: SNL Amendment 02-Rev03, firmada 26/08/2026.
 *
 * LAS SIGLAS LAS PUSO EL CLIENTE, NO BARACK
 * El LSC v1 tiene tres columnas de marcado y cada una es una sigla distinta:
 *     K = ( S ) = <cc/s>   critica de seguridad
 *     L = ( H ) = <cc/h>   critica de homologacion
 *     M = ( M ) = <sc/f>   significativa funcional
 * Leidas celda por celda el 21/09/2026, el reparto del cliente es:
 *     cc/s : SC 1.1, 1.2, 1.3                                          (3)
 *     cc/h : SC 1.4, 1.5, 2.1 a 2.6, 3.1 a 3.7                         (15)
 *     sc/f : SC 1.6                                                    (1)
 * O sea que 16 de las 19 son CRITICAS, y entre ellas esta toda la costura. Eso no lo decide
 * Barack: `core-prohibiciones` §2 dice que las CC/SC las asigna Fak O EL CLIENTE, y aca las
 * asigno el cliente en su propio formulario.
 *
 * SEGURIDAD DEL OPERARIO: ALTA S, PERO NO ES CC — decision de Fak, 21/09/2026
 * El 127 tiene 21 causas con S=10 cuyo efecto declarado es "riesgo de salud o seguridad para
 * el operario" (tendinitis, perdida de audicion, dolores lumbalgicos, herida con la aguja,
 * quemadura). Esa S es correcta en la columna "Impact to Process / Plant" de la Tabla P1,
 * pero una caracteristica CRITICA es una exigencia sobre el VEHICULO. Fak, 21/09/2026:
 * "esas 20 sacalas de CC". Se mantienen como modos de falla con su S, SIN specialChar.
 *
 * Uso:  node scripts/_crearAmfe173P21Naranja.mjs            (dry-run: arma, valida y muestra)
 *       node scripts/_crearAmfe173P21Naranja.mjs --apply    (escribe en Supabase)
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, parseData, calculateAP } from './_lib/amfeIo.mjs';

const APPLY = process.argv.includes('--apply');
const AMFE_KEY = 'AMFE-P21-NAR-MY26';
const NUMERO_EMPRESA = '173';   // proximo ID libre del Listado_Maestro_AMFE.xlsx (max cargado: 172)
const FECHA = '21/09/2026';
const FECHA_ISO = '2026-09-21';

const calcularAP = calculateAP;
const id = () => randomUUID();

function causa(descripcion, prevControl, O, detControl, D, extra = {}) {
  return {
    id: id(),
    cause: descripcion,
    description: descripcion,
    preventionControl: prevControl,
    preventiveControl: prevControl,
    detectionControl: detControl,
    occurrence: O,
    detection: D,
    ...extra,
  };
}

/**
 * falla(descripcion, efecto, causas) — la S sale del EFECTO y el AP se CALCULA.
 *
 * La sigla NO se deriva de la S: viene del LSC del cliente y se pasa explicita en
 * `extra.specialChar` de cada causa, o con el helper `sc()`. Esto es a proposito: en este
 * documento hay causas con S=9/10 que NO son caracteristica especial (las de seguridad del
 * operario), asi que asignar por S seria exactamente el error que Fak mando corregir.
 */
function falla(descripcion, ef, causas) {
  for (const c of causas) {
    const ap = calcularAP(ef.s, c.occurrence, c.detection);
    c.ap = ap;
    c.actionPriority = ap;
    if (ap === 'H' && !c.optimizationAction) c.optimizationAction = 'Pendiente definicion equipo APQP';
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

/**
 * Marca una causa con la caracteristica especial que designo el CLIENTE en su LSC v1.
 *
 * OJO CON LA SIGLA QUE SE ESCRIBE. SMRC usa su propia notacion (`<cc/s>` critica de
 * seguridad, `<cc/h>` critica de homologacion, `<sc/f>` significativa funcional). Esa
 * notacion NO esta en el canon de la casa (`core/amfe/caracteristicasEspeciales.data.json`),
 * asi que el validador la rechaza como SIGLA_DESCONOCIDA — y hace bien: una sigla que
 * ninguna fuente propia reconoce no se adivina (regla `caracteristicas-especiales.md` §5).
 *
 * Entonces, igual que con VW (interna CC/SC, documento para VW D/TLD), en el AMFE va la
 * sigla INTERNA de Barack y la notacion del cliente queda citada como fuente:
 *     <cc/s> y <cc/h>  ->  CC      <sc/f>  ->  SC
 * Queda pendiente para Fak agregar la notacion de SMRC al canon; hasta entonces no se
 * inventa una sigla nueva en un documento controlado.
 */
const SIGLA_BARACK = { 'cc/s': 'CC', 'cc/h': 'CC', 'sc/f': 'SC' };
function sc(caracteristica, siglaCliente) {
  const propia = SIGLA_BARACK[siglaCliente];
  if (!propia) throw new Error(`sigla de cliente no mapeada: ${siglaCliente}`);
  return {
    specialChar: propia,
    specialCharCustomer: siglaCliente,
    specialCharSource: `LSC v1 del cliente, ${caracteristica} (SMRC la marca <${siglaCliente}>)`,
  };
}

function funcion(descripcion, requisitos, fallas) {
  return { id: id(), description: descripcion, functionDescription: descripcion, requirements: requisitos, failures: fallas };
}
function we(type, name, funciones) {
  return { id: id(), name, type, functions: funciones };
}
function operacion(numero, nombre, funcionOperacion, funcionFoco, workElements) {
  return {
    id: id(), opNumber: numero, operationNumber: numero,
    name: nombre, operationName: nombre,
    operationFunction: funcionOperacion, focusElementFunction: funcionFoco,
    workElements,
  };
}

// ---------------------------------------------------------------------------
// EFECTOS — cada uno trae su propia S, tomada de la Tabla P1 PFMEA SEVERITY del
// manual AIAG-VDA (pag. 116 del PDF, la misma lectura que uso el AMFE 172).
//   S=10 "Impact to Plant": riesgo de salud o seguridad del operario
//   S=9  "Noncompliance with regulations" (usuario final) / incumplimiento reglamentario
//   S=8  "Line shutdown greater than full production shift" (ship to plant)
//   S=7  "A portion of the production run may have to be scrapped"
//   S=6  "Loss of convenience function"
// ---------------------------------------------------------------------------
const EF_LEGAL_FUEGO = {
  s: 9,
  local: 'Vinilo sin evidencia de cumplir el limite de velocidad de combustion del cliente',
  next: 'Bloqueo del lote en la recepcion de SMRC',
  end: 'Incumplimiento de un requisito legal de inflamabilidad en el habitaculo del vehiculo',
};
const EF_HOMOLOGACION = {
  s: 9,
  local: 'Pieza fabricada fuera de una caracteristica que el cliente designo como critica',
  next: 'Rechazo del lote y bloqueo del PPAP en SMRC',
  end: 'Vehiculo montado con una pieza distinta de la homologada',
};
const EF_PARO_LINEA = {
  s: 8,
  local: 'Conjunto que no se puede ensamblar sobre el panel de puerta',
  next: 'Paro de linea en la planta del cliente',
  end: 'Vehiculo no ensamblable con esa pieza',
};
const EF_SCRAP_INTERNO = {
  s: 7,
  local: 'Pieza rechazada en el puesto, se genera scrap de material',
  next: 'Reposicion de la pieza y atraso del lote',
  end: 'Sin efecto en el vehiculo: la pieza no sale de planta',
};
const EF_ASPECTO = {
  s: 7,
  local: 'Pieza con desvio de aspecto en zona vista del apoyabrazos',
  next: 'Posible clasificacion de piezas en la planta del cliente',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
const EF_SEG_OPERARIO = {
  s: 10,
  local: 'Riesgo de salud o seguridad para el operario del puesto',
  next: 'Ausentismo y posible incumplimiento de la Ley 19587 en la planta',
  end: 'Sin efecto en el vehiculo',
};

// ===========================================================================
// OP 10 — RECEPCION DE MATERIA PRIMA
// Aca viven las caracteristicas del vinilo (SC 1.1 a 1.5) y la identidad del hilo (SC 2.5).
// ===========================================================================
const OP10 = operacion('10', 'RECEPCION DE MATERIA PRIMA',
  'Recibir, identificar y liberar el vinilo TEP, el hilo y el sustrato contra los requisitos del cliente antes de habilitarlos a produccion',
  'Materia prima liberada, identificada por lote y con la evidencia de ensayo que exige el LSC del cliente',
  [
    we('Material', 'Vinilo TEP Zina espumado (grano V252, color Mistral HZD, proveedor York)', [
      funcion(
        'Cumplir el limite de velocidad de combustion que fija el cliente',
        'SC 1.1 a nuevo, SC 1.2 tras 100 h a 40 C y 95 % HR, SC 1.3 tras 100 h a 100 C: <= 100 mm/min, metodo D45 1333',
        [
          falla('Vinilo recibido sin evidencia de ensayo de combustion del lote', EF_LEGAL_FUEGO, [
            causa('El pedido de compra no exige el certificado de ensayo D45 1333 por lote',
              'Especificacion de compra a York con el limite de velocidad de combustion y el metodo D45 1333 como condicion de entrega',
              3, 'Cotejo del certificado del lote contra la especificacion, lote por lote, antes de liberar', 9,
              sc('SC 1.1', 'cc/s')),
          ]),
          falla('Vinilo que pierde el comportamiento al fuego con el envejecimiento', EF_LEGAL_FUEGO, [
            causa('Degradacion del material tras 100 h a 40 C con 95 % de humedad relativa',
              'Requisito de envejecimiento declarado a York en la especificacion de compra',
              3, 'Ensayo en camara climatica en Barack segun el plan de validacion del 31/07/2026', 5,
              sc('SC 1.2', 'cc/s')),
            causa('Degradacion del material tras 100 h a 100 C',
              'Requisito de envejecimiento declarado a York en la especificacion de compra',
              3, 'Ensayo en camara climatica en Barack segun el plan de validacion del 31/07/2026', 5,
              sc('SC 1.3', 'cc/s')),
          ]),
        ]),
      funcion(
        'Entregar el vinilo con la construccion y el aspecto de la pieza aprobada',
        'SC 1.4: TEP Zina espumado, vinilo 1 +/-0,1 mm, espuma (backing) 5 +/-0,5 mm, grano V252, color Mistral HZD, proveedor York',
        [
          falla('Vinilo recibido con espesor, grano o color distintos del especificado', EF_HOMOLOGACION, [
            causa('Los rollos de distintos granos y colores llegan sin una identificacion que los distinga en el deposito',
              'Un solo grano y un solo color habilitados para esta pieza, declarados en la orden de compra',
              3, 'Certificacion del proveedor de materia prima para cada lote, que el LSC v1 exige de forma explicita', 6,
              sc('SC 1.4', 'cc/h')),
          ]),
        ]),
      funcion(
        'Mantener adherido el recubrimiento a su backing durante la vida del vehiculo',
        'SC 1.5: fuerza de arrancamiento a 90 grados >= 5 N/cm despues de los ciclos de envejecimiento 4AF + 6BF, metodo D51 1485',
        [
          falla('Fuerza de arrancamiento a 90 grados por debajo de 5 N/cm', EF_HOMOLOGACION, [
            causa('Adherencia insuficiente entre el vinilo y su backing de espuma en el lote entregado',
              'Requisito >= 5 N/cm y metodo D51 1485 declarados a York en la especificacion de compra',
              3, 'Ensayo de arrancamiento segun el plan de validacion del 31/07/2026', 6,
              sc('SC 1.5', 'cc/h')),
          ]),
        ]),
    ]),
    we('Material', 'Hilo de costura vista naranja Linhanyl BX138', [
      funcion(
        'Entregar el hilo de costura vista de la pieza aprobada',
        'SC 2.5: Nylon 6.6, color Orange Zeus T90 / FHS-F090, proveedor Linhanyl SA, codigo 12124E, articulo BX138, titulo 1600 a 1980 dtex, resistencia > 9100 gf',
        [
          falla('Hilo de costura vista recibido distinto del especificado', EF_HOMOLOGACION, [
            causa('Los conos de los distintos articulos de Linhanyl son visualmente parecidos y se almacenan juntos',
              'Un unico articulo de hilo vista habilitado para esta pieza (BX138 / 12124E), declarado en la orden de compra',
              4, 'Cotejo de la etiqueta del cono contra la orden de compra, cono por cono, en la recepcion', 5,
              sc('SC 2.5', 'cc/h')),
          ]),
        ]),
    ]),
    we('Metodo', 'Identificacion y liberacion del material en el deposito', [
      funcion(
        'Que a produccion solo salga material ingresado, controlado e identificado',
        'Material identificado por lote y liberado antes de habilitarlo al sector',
        [
          falla('Material entregado a produccion sin haber sido ingresado ni liberado', EF_SCRAP_INTERNO, [
            causa('El circuito admite entregar material directo al sector cuando hay una urgencia de produccion',
              'Zona de material pendiente de control fisicamente separada de la de material liberado',
              4, 'Control de la identificacion de lote en el sector antes de arrancar el turno', 7),
          ]),
          falla('Se toma para produccion materia prima obsoleta', EF_SCRAP_INTERNO, [
            causa('El material obsoleto permanece en el deposito junto al vigente',
              'Material obsoleto identificado y en zona propia',
              3, 'Control de la identificacion del rollo antes de habilitarlo al corte', 7),
          ]),
          falla('Se utilizan pallets distintos de los definidos', EF_SCRAP_INTERNO, [
            causa('No esta definido por escrito cual es el pallet que corresponde a cada material',
              'TBD - falta definir el pallet por material',
              10, 'Control visual del pallet en la recepcion del material', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Deposito de materia prima', [
      funcion(
        'Almacenar la materia prima sin degradarla y sin generar riesgo en el sector',
        'Estiba segun las especificaciones del fabricante, distancia al techo y deposito libre de filtraciones',
        [
          falla('Apilado de la materia prima fuera de las especificaciones del fabricante', EF_SEG_OPERARIO, [
            causa('La altura maxima de estiba de cada material no esta indicada en el lugar donde se apila',
              'Carteleria y ayuda visual de estiba en el deposito',
              6, 'Control visual de la estiba en el recorrido de turno', 8),
            causa('La distancia libre entre la estiba y el techo queda por debajo de 80 cm',
              'Carteleria que indica como debe quedar la estiba',
              3, 'Control visual de la distancia al techo en el recorrido de turno', 7),
          ]),
          falla('Productos quimicos inflamables apilados junto a la materia prima', EF_SEG_OPERARIO, [
            causa('El deposito no tiene una zona propia y senalizada para los inflamables',
              'Procedimiento de almacenamiento de productos quimicos',
              3, 'Control visual del sector en el recorrido de turno', 7),
          ]),
          falla('Materia prima mojada por filtraciones del techo', EF_SCRAP_INTERNO, [
            causa('Deterioro de la cubierta del deposito',
              'Mantenimiento preventivo de la cubierta',
              3, 'Control visual del deposito en el recorrido de turno y despues de cada lluvia', 7),
          ]),
        ]),
    ]),
    we('Maquina', 'Autoelevador del deposito', [
      funcion(
        'Mover la materia prima sin danarla y sin generar riesgo',
        'Autoelevador en condiciones de uso, con check list previo',
        [
          falla('Autoelevador operado sin el check list previo o con una falla no detectada', EF_SEG_OPERARIO, [
            causa('El check list no esta disponible en el puesto y el equipo arranca igual sin completarlo',
              'Check list de autoelevador definido',
              3, 'Verificacion del check list firmado al inicio de turno', 7),
            causa('Falta de mantenimiento preventivo del autoelevador',
              'Plan de mantenimiento preventivo del equipo',
              3, 'Control del estado del equipo en el check list de inicio de turno', 7),
          ]),
          falla('Dano de la caja que contiene la materia prima durante el movimiento', EF_SCRAP_INTERNO, [
            causa('El ancho de pasillo y la altura de carga no dejan margen para maniobrar con la carga a la vista',
              'Carteleria de circulacion en el deposito',
              3, 'Control visual del estado de las cajas al recibirlas en el sector', 7),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 20 — CORTE DE VINILO O TELA  (incluye lo que el 127 abria como 20.1 a 20.5)
// Aca vive la SC 1.6, el limite de corte en la zona de insercion de la platina.
// ===========================================================================
const OP20 = operacion('20', 'CORTE DE VINILO O TELA',
  'Cortar los componentes de vinilo o tela segun el patron liberado de la pieza',
  'Componentes cortados dentro del patron, identificados y contados por bin',
  [
    we('Metodo', 'Patron y programa de corte', [
      funcion(
        'Cortar dentro del limite que el cliente fija para la zona de insercion de la platina',
        'SC 1.6: tolerancia de corte de tela / TEP en la zona de insercion de platina, +2 / -0',
        [
          falla('Corte de tela o TEP fuera del limite +2 / -0 en la zona de insercion de la platina', EF_PARO_LINEA, [
            causa('El programa de corte cargado en la mesa no es el de la revision liberada del patron',
              'Un unico archivo de corte habilitado por pieza, con su revision, en la carpeta de la mesa',
              4, 'Verificacion de la pieza cortada contra el patron en la zona de insercion, primera pieza del lote', 7,
              sc('SC 1.6', 'sc/f')),
          ]),
        ]),
      funcion(
        'Cortar el componente correcto, del material correcto y en la cantidad pedida',
        'Componente, material y cantidad segun la orden de corte',
        [
          falla('Se corta un material distinto del que pide la orden', EF_SCRAP_INTERNO, [
            causa('Los rollos de vinilo de distintos granos y colores se parecen entre si y estan en el mismo portarrollos',
              'Identificacion del rollo con su codigo a la vista en el portarrollos',
              10, 'Cotejo del codigo del rollo contra la orden de corte antes de arrancar la mesa', 8),
          ]),
          falla('Se corta con una medida distinta de la del patron', EF_SCRAP_INTERNO, [
            causa('La medida se toma a mano sobre la mesa en vez de salir del programa',
              'Corte por programa, sin medicion manual',
              10, 'Verificacion de la primera pieza del lote contra el patron', 8),
          ]),
          falla('Se selecciona el archivo de corte equivocado', EF_SCRAP_INTERNO, [
            causa('Los archivos de corte de las distintas piezas tienen nombres parecidos en la misma carpeta',
              'Nombre de archivo con codigo de pieza y revision',
              3, 'Verificacion del nombre del archivo abierto contra la orden de corte', 9),
          ]),
        ]),
    ]),
    we('Maquina', 'Mesa de corte automatica', [
      funcion(
        'Cortar con la calidad de filo y el seteo que pide el patron',
        'Cuchilla dentro de su medida de uso y cabezal en posicion de trabajo',
        [
          falla('Corte imperfecto en la capa cortada', EF_SCRAP_INTERNO, [
            causa('La cuchilla se usa mas alla de su medida minima porque no hay un criterio de cambio definido',
              'Medida minima de cuchilla definida y calibre en el puesto',
              5, 'Medicion de la cuchilla con calibre antes de arrancar el corte', 9),
          ]),
          falla('Cabezal mal posicionado al arrancar el corte', EF_SCRAP_INTERNO, [
            causa('La maquina permite arrancar con el cabezal fuera de la posicion de origen',
              'Posicion de origen marcada en la mesa',
              10, 'Verificacion de la posicion del cabezal antes de dar marcha', 9),
          ]),
          falla('Vinilo mal alineado sobre la mesa de corte', EF_SCRAP_INTERNO, [
            causa('La mesa no tiene una referencia fisica de alineacion del ancho del rollo',
              'TBD - falta definir la referencia de alineacion en la mesa',
              7, 'Verificacion del alineado del vinilo antes de dar marcha', 9),
          ]),
          falla('Nylon de vacio mal colocado sobre el tendido', EF_SCRAP_INTERNO, [
            causa('El nylon se coloca a mano y no hay una marca de hasta donde debe cubrir',
              'Ayuda visual del tendido en el puesto',
              10, 'Verificacion del vacio antes de arrancar el corte', 9),
          ]),
        ]),
    ]),
    we('Mano de Obra', 'Puesto de mesa de corte', [
      funcion(
        'Operar la mesa sin exponer al operario a las herramientas de corte',
        'EPP de corte disponible y protecciones de la mesa en su lugar',
        [
          falla('Exposicion del operario a un corte con la herramienta', EF_SEG_OPERARIO, [
            causa('No hay guantes anticorte asignados al puesto en cantidad suficiente',
              'Guantes anticorte definidos como EPP del puesto',
              10, 'Control del uso de EPP en el recorrido de turno', 8),
          ]),
          falla('Carga manual de los rollos en el portarrollos', EF_SEG_OPERARIO, [
            causa('No hay un medio mecanico para subir el rollo al portarrollos',
              'TBD - falta definir el medio de izaje del rollo',
              10, 'Control del metodo de carga en el recorrido de turno', 8),
          ]),
          falla('Levantamiento incorrecto del plato de la mesa', EF_SEG_OPERARIO, [
            causa('El plato se levanta a mano y no tiene asistencia ni punto de agarre definido',
              'TBD - falta definir la asistencia para el levantamiento del plato',
              10, 'Control del metodo en el recorrido de turno', 8),
          ]),
        ]),
    ]),
    we('Medicion', 'Control y despacho del corte', [
      funcion(
        'Que del corte salga la cantidad correcta, identificada y sin piezas no conformes',
        'Bin identificado con la descripcion y la cantidad de la orden',
        [
          falla('Piezas no conformes pasan el control del puesto', EF_SCRAP_INTERNO, [
            causa('El control es visual y no hay un patron de comparacion en el puesto',
              'TBD - falta el patron de comparacion en el puesto de corte',
              5, 'Control visual contra el patron del puesto', 8),
          ]),
          falla('Bin identificado con una descripcion que no corresponde a su contenido', EF_SCRAP_INTERNO, [
            causa('La etiqueta se completa a mano despues de cerrar el bin',
              'Etiqueta emitida con la orden de corte',
              3, 'Cotejo de la etiqueta contra el contenido al cerrar el bin', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 30 — REFILADO DE COMPONENTES CORTADOS
// ===========================================================================
const OP30 = operacion('30', 'REFILADO DE COMPONENTES CORTADOS',
  'Refilar los componentes cortados dejando el borde dentro del patron',
  'Componente refilado sin faltante ni exceso de material',
  [
    we('Metodo', 'Refilado del componente', [
      funcion(
        'Dejar el borde del componente dentro del patron',
        'Borde refilado segun la ayuda visual de la pieza',
        [
          falla('Componente sin refilar', EF_ASPECTO, [
            causa('El paso de refilado no tiene una senal que indique si ya se hizo sobre esa pieza',
              'Ayuda visual del borde terminado en el puesto',
              3, 'Control visual del borde contra la ayuda visual', 8),
          ]),
          falla('Refilado fuera del patron, por defecto o por exceso', EF_ASPECTO, [
            causa('El refilado se hace a mano alzada, sin plantilla que limite el corte',
              'TBD - falta la plantilla de refilado',
              3, 'Control visual del borde contra la ayuda visual', 8),
          ]),
        ]),
    ]),
    we('Mano de Obra', 'Puesto de refilado', [
      funcion(
        'Trabajar el turno sin carga postural excesiva',
        'Puesto con silla ergonomica',
        [
          falla('Dolores lumbares del operario del puesto', EF_SEG_OPERARIO, [
            causa('El puesto no tiene silla ergonomica asignada',
              'Adquisicion de sillas ergonomicas',
              9, 'Relevamiento de puestos y seguimiento por Seguridad e Higiene', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 40 — COSTURA DE UNION.  Aca vive la SC 2.6 (hilo de union M40 negro).
// ===========================================================================
const OP40 = operacion('40', 'COSTURA DE UNION',
  'Unir por costura los componentes de vinilo que forman la funda del apoyabrazos',
  'Union cosida con el hilo especificado, continua y dentro de la toma de costura',
  [
    we('Material', 'Hilo de costura de union', [
      funcion(
        'Unir los vinilos con el hilo que el cliente designo',
        'SC 2.6: hilo Nylon, Thread M40, color negro standard',
        [
          falla('Costura de union ejecutada con un hilo distinto del Nylon M40 negro', EF_HOMOLOGACION, [
            causa('En el puesto conviven conos de hilo de union y de hilo vista, de articulos distintos',
              'Un solo cono de hilo de union habilitado en el puesto, identificado en la hoja de operaciones',
              4, 'Cotejo del cono montado contra la hoja de operaciones al inicio de turno y en cada cambio de lote', 6,
              sc('SC 2.6', 'cc/h')),
          ]),
        ]),
    ]),
    we('Maquina', 'Maquina de costura de union', [
      funcion(
        'Mantener la densidad de puntada y la toma de costura del seteo liberado',
        'Densidad de puntada y toma de costura segun la hoja de operaciones',
        [
          falla('La puntada se achica respecto del seteo', EF_ASPECTO, [
            causa('El largo de puntada se ajusta con una perilla que no tiene traba',
              'Seteo verificado en el set up de la maquina',
              3, 'Conteo de puntadas con calibre al inicio de turno', 8),
          ]),
          falla('Las puntadas se achican al pasar por la curva', EF_ASPECTO, [
            causa('El radio de la curva del patron obliga a reducir el avance en esa zona',
              'TBD - falta evaluar el radio de la curva con Ingenieria de producto',
              10, 'Control de la zona de curva en la pieza terminada', 8),
          ]),
        ]),
    ]),
    we('Metodo', 'Posicionado de la pieza en el puesto', [
      funcion(
        'Coser con la pieza en la posicion que define la hoja de operaciones',
        'Pieza apoyada contra la guia de la maquina, con los piquetes coincidentes',
        [
          falla('Pieza posicionada fuera de la guia', EF_ASPECTO, [
            causa('La guia de la maquina es regulable y no queda fijada entre piezas',
              'Guia de referencia en el pie de la maquina',
              3, 'Control de la coincidencia de piquetes al arrancar cada pieza', 8),
          ]),
          falla('Desvio de la linea de costura de union', EF_ASPECTO, [
            causa('El tramo recto de la costura no tiene apoyo lateral en toda su longitud',
              'Las maquinas del puesto tienen guia',
              3, 'Control visual de la costura terminada contra la muestra patron', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Puesto de costura de union', [
      funcion(
        'Trabajar el turno sin riesgo para la salud del operario',
        'Iluminacion, ruido, proteccion de aguja y puesto segun Ley 19587',
        [
          falla('Tendinitis o dolor articular en el brazo del operario', EF_SEG_OPERARIO, [
            causa('El ciclo del puesto es repetitivo y no hay rotacion ni pausa activa definidas',
              'Rotacion de puestos y pausa activa',
              10, 'Seguimiento de Seguridad e Higiene y del servicio medico', 8),
          ]),
          falla('Herida del operario con la aguja de la maquina', EF_SEG_OPERARIO, [
            causa('No todas las maquinas del puesto tienen la proteccion de aguja montada',
              'Algunas maquinas ya tienen proteccion ante rotura de aguja',
              8, 'Control del estado de las protecciones en el recorrido de turno', 8),
          ]),
          falla('Tension en el brazo por el borde de la mesa', EF_SEG_OPERARIO, [
            causa('Las puntas del borde de la mesa del puesto no estan redondeadas',
              'Algunas mesas ya tienen las puntas redondeadas',
              8, 'Relevamiento de las mesas del sector', 8),
          ]),
          falla('Perdida de audicion del operario', EF_SEG_OPERARIO, [
            causa('El nivel de ruido del sector supera el limite sin proteccion auditiva',
              'Protectores auditivos como EPP del puesto',
              3, 'Medicion con decibelimetro y control del uso de EPP', 7),
          ]),
          falla('Dolores lumbares del operario del puesto', EF_SEG_OPERARIO, [
            causa('El puesto no tiene silla ergonomica asignada',
              'Adquisicion de sillas ergonomicas',
              9, 'Relevamiento de puestos y seguimiento por Seguridad e Higiene', 10),
          ]),
          falla('Iluminacion del puesto por debajo del nivel requerido', EF_ASPECTO, [
            causa('La luminaria del puesto no esta en el plan de mantenimiento preventivo',
              'Iluminacion en el sector y en la maquina de costura',
              5, 'Medicion con luxometro segun el plan de mediciones', 6),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 50 — COSTURA VISTA, PESPUNTE SIMPLE DE UNA LINEA.
// Es LA operacion que cambia el ECR-0368291, y donde viven SC 2.1 a 2.5.
// ===========================================================================
const OP50 = operacion('50', 'COSTURA VISTA - PESPUNTE SIMPLE, UNA LINEA',
  'Ejecutar la costura vista del apoyabrazos con pespunte simple de una sola linea',
  'Costura vista de una linea, a 4 +0 / -1 mm de la linea de union, con 10 a 11 puntos cada 50 mm, en hilo naranja Linhanyl BX138',
  [
    we('Metodo', 'Tipo y cantidad de costura vista', [
      funcion(
        'Ejecutar la costura vista con el tipo de puntada y la cantidad de lineas que designo el cliente',
        'SC 2.1: pespunte simple HAQ (rebatida / seam deck).  SC 2.2: 1 sola linea de costura',
        [
          falla('Costura vista ejecutada con un tipo de puntada distinto del pespunte simple HAQ', EF_HOMOLOGACION, [
            causa('El puesto produce tambien las versiones anteriores del P21 y el seteo de la maquina se comparte',
              'Hoja de operaciones propia de la pieza nueva, separada de la de las versiones anteriores',
              4, 'Cotejo de la primera pieza del lote contra la muestra patron de la pieza nueva', 6,
              sc('SC 2.1', 'cc/h')),
          ]),
          falla('Costura vista ejecutada con dos lineas en lugar de una sola', EF_HOMOLOGACION, [
            causa('La maquina de doble aguja de las versiones anteriores esta disponible en el mismo sector',
              'Puesto y maquina identificados para la pieza de una sola linea',
              4, 'Cotejo de la primera pieza del lote contra la muestra patron de la pieza nueva', 4,
              sc('SC 2.2', 'cc/h')),
          ]),
        ]),
    ]),
    we('Metodo', 'Posicion y densidad de la costura vista', [
      funcion(
        'Dejar la linea de costura en la posicion y con la densidad que designo el cliente',
        'SC 2.3: 4 +0 / -1 mm por arriba de la linea de union de vinilos.  SC 2.4: 10 a 11 puntos cada 50 mm',
        [
          falla('Linea de costura vista fuera de 4 +0 / -1 mm de la linea de union', EF_HOMOLOGACION, [
            causa('La guia del pie de la maquina es regulable y no queda fijada entre lotes',
              'Guia de referencia seteada y verificada en el set up, contra la hoja de operaciones',
              5, 'Medicion con calibre de la distancia a la linea de union, al inicio de turno y en cada cambio de lote', 6,
              sc('SC 2.3', 'cc/h')),
          ]),
          falla('Cantidad de puntos fuera de 10 a 11 cada 50 mm', EF_HOMOLOGACION, [
            causa('El largo de puntada se ajusta con una perilla sin traba y se corre con la vibracion',
              'Largo de puntada seteado y verificado en el set up de la maquina',
              5, 'Conteo de puntos con calibre contra la hoja de operaciones, al inicio de turno y en cada cambio de lote', 6,
              sc('SC 2.4', 'cc/h')),
            causa('El avance se reduce al pasar por la curva del contorno',
              'TBD - falta evaluar el radio de la curva con Ingenieria de producto',
              10, 'Conteo con calibre de los puntos en la zona de curva de la pieza terminada', 8,
              sc('SC 2.4', 'cc/h')),
          ]),
        ]),
    ]),
    we('Material', 'Hilo de costura vista naranja', [
      funcion(
        'Ejecutar la costura vista con el hilo que designo el cliente',
        'SC 2.5: Linhanyl articulo BX138, codigo 12124E, Nylon 6.6, color Orange Zeus T90 / FHS-F090',
        [
          falla('Costura vista ejecutada con un hilo distinto del Linhanyl BX138 naranja', EF_HOMOLOGACION, [
            causa('En el sector conviven los conos de las variantes verde, azul y cuero de la misma pieza',
              'Un solo articulo de hilo vista habilitado en el puesto, identificado en la hoja de operaciones',
              4, 'Cotejo de la etiqueta del cono montado contra la hoja de operaciones al inicio de turno', 4,
              sc('SC 2.5', 'cc/h')),
          ]),
        ]),
    ]),
    we('Metodo', 'Toma de costura y posicionado', [
      funcion(
        'Mantener la toma de costura y el posicionado del seteo liberado',
        'Toma de costura 8 +/- 1 mm y piquetes coincidentes, segun la hoja de operaciones',
        [
          falla('Toma de costura por encima de 8 mm', EF_ASPECTO, [
            causa('La guia del puesto admite apoyar la pieza en mas de una posicion',
              'Guia de referencia en el pie de la maquina',
              3, 'Medicion de la toma de costura con calibre al inicio de turno', 8),
          ]),
          falla('Toma de costura por debajo de 8 mm', EF_ASPECTO, [
            causa('La guia del puesto admite apoyar la pieza en mas de una posicion',
              'Guia de referencia en el pie de la maquina',
              3, 'Medicion de la toma de costura con calibre al inicio de turno', 8),
          ]),
          falla('Desvio de la linea de costura vista respecto del contorno', EF_ASPECTO, [
            causa('El tramo curvo no tiene apoyo lateral en toda su longitud',
              'Las maquinas del puesto tienen guia',
              3, 'Control visual de la costura terminada contra la muestra patron', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Puesto de costura vista', [
      funcion(
        'Trabajar el turno sin riesgo para la salud del operario',
        'Iluminacion, ruido, proteccion de aguja y puesto segun Ley 19587',
        [
          falla('Tendinitis o dolor articular en el brazo del operario', EF_SEG_OPERARIO, [
            causa('El ciclo del puesto es repetitivo y no hay rotacion ni pausa activa definidas',
              'Rotacion de puestos y pausa activa',
              10, 'Seguimiento de Seguridad e Higiene y del servicio medico', 8),
          ]),
          falla('Herida del operario con la aguja de la maquina', EF_SEG_OPERARIO, [
            causa('No todas las maquinas del puesto tienen la proteccion de aguja montada',
              'Algunas maquinas ya tienen proteccion ante rotura de aguja',
              8, 'Control del estado de las protecciones en el recorrido de turno', 8),
          ]),
          falla('Tension en el brazo por el borde de la mesa', EF_SEG_OPERARIO, [
            causa('Las puntas del borde de la mesa del puesto no estan redondeadas',
              'Algunas mesas ya tienen las puntas redondeadas',
              8, 'Relevamiento de las mesas del sector', 8),
          ]),
          falla('Perdida de audicion del operario', EF_SEG_OPERARIO, [
            causa('El nivel de ruido del sector supera el limite sin proteccion auditiva',
              'Protectores auditivos como EPP del puesto',
              3, 'Medicion con decibelimetro y control del uso de EPP', 7),
          ]),
          falla('Iluminacion del puesto por debajo del nivel requerido', EF_ASPECTO, [
            causa('La luminaria del puesto no esta en el plan de mantenimiento preventivo',
              'Iluminacion en el sector y en la maquina de costura',
              5, 'Medicion con luxometro segun el plan de mediciones', 6),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 60 — LIMPIEZA DE PIEZA PLASTICA
// ===========================================================================
const OP60 = operacion('60', 'LIMPIEZA DE PIEZA PLASTICA',
  'Limpiar el sustrato plastico antes del primer y del adhesivado',
  'Sustrato limpio, con el producto especificado y con el tiempo de secado cumplido',
  [
    we('Material', 'Producto de limpieza del sustrato', [
      funcion(
        'Limpiar el sustrato con el producto que define el proceso',
        'Producto de limpieza segun la hoja de operaciones',
        [
          falla('Limpieza realizada con un producto distinto del especificado', EF_SCRAP_INTERNO, [
            causa('En el puesto hay mas de un producto de limpieza en envases parecidos',
              'Un solo producto habilitado en el puesto, identificado en la hoja de operaciones',
              4, 'Control del envase en el puesto al inicio de turno', 8),
          ]),
        ]),
    ]),
    we('Metodo', 'Tiempo de secado', [
      funcion(
        'Respetar el tiempo de secado antes del paso siguiente',
        'Tiempo de secado de 5 minutos segun la hoja de operaciones',
        [
          falla('Pieza pasada al paso siguiente con menos de 5 minutos de secado', EF_ASPECTO, [
            causa('El puesto no tiene un medio para saber cuando cada pieza cumplio su tiempo',
              'TBD - falta el control de tiempo en el puesto',
              4, 'Control del tiempo transcurrido antes de habilitar la pieza', 8),
          ]),
          falla('Pieza demorada mas alla del tiempo de secado', EF_ASPECTO, [
            causa('No hay un limite superior definido ni una senal cuando se pasa',
              'TBD - falta definir el limite superior de espera',
              4, 'Control del tiempo transcurrido antes de habilitar la pieza', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 70 — APLICACION DE PRIMER
// ===========================================================================
const OP70 = operacion('70', 'APLICACION DE PRIMER',
  'Aplicar primer sobre el sustrato plastico cuando la pieza lo requiere',
  'Primer preparado segun su mezcla y aplicado dentro de su vida util',
  [
    we('Material', 'Primer de dos componentes', [
      funcion(
        'Preparar y usar el primer segun su especificacion',
        'Mezcla de los componentes y uso dentro de las 9 horas de preparada',
        [
          falla('Primer aplicado sin mezclar sus componentes', EF_PARO_LINEA, [
            causa('La preparacion no deja registro de que la mezcla se hizo',
              'Instructivo de preparacion en el puesto',
              4, 'Registro de preparacion del primer con hora', 8),
          ]),
          falla('Primer usado despues de las 9 horas de preparado', EF_ASPECTO, [
            causa('El envase preparado no lleva la hora de preparacion a la vista',
              'Identificacion del envase con la hora de preparacion',
              4, 'Control de la hora del envase antes de usarlo', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 80 — ADHESIVADO DE PIEZA PLASTICA Y VINILO
// ===========================================================================
const OP80 = operacion('80', 'ADHESIVADO DE PIEZA PLASTICA Y VINILO',
  'Aplicar adhesivo sobre el sustrato y el vinilo antes del tapizado',
  'Adhesivo aplicado en la zona y la cantidad que define el proceso, con el sector ventilado',
  [
    we('Metodo', 'Aplicacion del adhesivo', [
      funcion(
        'Aplicar el adhesivo en la zona y la cantidad definidas',
        'Zona y cantidad de adhesivo segun la hoja de operaciones',
        [
          falla('Adhesivo aplicado fuera de la zona definida o en cantidad insuficiente', EF_ASPECTO, [
            causa('La zona de aplicacion no esta marcada sobre el sustrato ni sobre una plantilla',
              'Ayuda visual de la zona de aplicacion en el puesto',
              3, 'Control visual de la aplicacion antes del tapizado', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Ventilacion del sector de adhesivado', [
      funcion(
        'Mantener el sector ventilado durante la aplicacion',
        'Ventilacion del sector segun Ley 19587',
        [
          falla('Sector de adhesivado sin la ventilacion requerida', EF_SEG_OPERARIO, [
            causa('El equipo de extraccion del sector no esta en el plan de mantenimiento preventivo',
              'Extraccion instalada en el sector',
              2, 'Control del funcionamiento de la extraccion al inicio de turno', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 90 — TAPIZADO
// ===========================================================================
const OP90 = operacion('90', 'TAPIZADO',
  'Montar la funda cosida sobre el sustrato adhesivado',
  'Funda montada sin arrugas, centrada y con la costura vista en su posicion',
  [
    we('Metodo', 'Montaje de la funda sobre el sustrato', [
      funcion(
        'Montar la funda centrada y sin arrugas',
        'Funda centrada sobre el sustrato, costura vista alineada con el contorno',
        [
          falla('Funda montada descentrada o con arrugas en zona vista', EF_ASPECTO, [
            causa('El sustrato se sostiene a mano durante el montaje, sin un dispositivo que lo posicione',
              'Ayuda visual del montaje en el puesto',
              3, 'Control visual de la pieza terminada contra la muestra patron', 8),
          ]),
        ]),
    ]),
    we('Mano de Obra', 'Puesto de tapizado', [
      funcion(
        'Trabajar el turno sin riesgo de quemadura',
        'Guantes como EPP del puesto',
        [
          falla('Quemadura del operario en el puesto', EF_SEG_OPERARIO, [
            // El 127 califica esta causa con O=1. No se puede sostener: la Figura 3.5-3
            // marca O=1 con D distinto de 1 como IMPLAUSIBLE ("O=1 implausible without
            // D=1"), porque O=1 significa que la prevencion elimino la falla, y aca la
            // unica prevencion es que los guantes esten definidos como EPP. Se califica
            // O=3 ("ocurrencias aisladas"). Queda anotado como hallazgo sobre el 127.
            causa('Los guantes del puesto no estan disponibles en todos los turnos',
              'Guantes definidos como EPP del puesto',
              3, 'Control del uso de EPP en el recorrido de turno', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 100 — REFILADO CON MASCARA
// ===========================================================================
const OP100 = operacion('100', 'REFILADO CON MASCARA',
  'Refilar el sobrante de vinilo de la pieza tapizada usando la mascara',
  'Borde refilado al ras de la mascara, sin cortar el sustrato',
  [
    we('Maquina', 'Mascara de refilado', [
      funcion(
        'Refilar el sobrante siguiendo el contorno de la mascara',
        'Mascara de la pieza montada y en su posicion',
        [
          falla('Refilado fuera del contorno de la mascara', EF_ASPECTO, [
            causa('La mascara no tiene un enclavamiento que impida trabajar con ella mal montada',
              'Mascara identificada por pieza',
              3, 'Control visual del borde terminado contra la muestra patron', 8),
          ]),
          falla('Corte del sustrato durante el refilado', EF_SCRAP_INTERNO, [
            causa('La profundidad de corte no esta limitada por el utillaje',
              'TBD - falta el tope de profundidad en el utillaje',
              3, 'Control visual del sustrato en la pieza terminada', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 110 — TROQUELADO
// ===========================================================================
const OP110 = operacion('110', 'TROQUELADO',
  'Troquelar el vinilo de la pieza tapizada en las zonas que define el proceso',
  'Troquelado en posicion, sin corrimiento del hilo del vinilo',
  [
    we('Maquina', 'Troquel', [
      funcion(
        'Troquelar en la posicion definida sin danar el vinilo',
        'Troquel en su posicion y con el filo en condiciones',
        [
          falla('Hilo del vinilo corrido en la zona troquelada', EF_ASPECTO, [
            causa('El filo del troquel se usa mas alla de su condicion porque no hay criterio de cambio definido',
              'TBD - falta definir el criterio de cambio de filo del troquel',
              10, 'Control visual de la zona troquelada en la pieza terminada', 8),
          ]),
          falla('Troquelado fuera de posicion', EF_ASPECTO, [
            causa('La pieza se apoya sin un posicionador que la fije durante el golpe',
              'Ayuda visual del posicionado en el puesto',
              3, 'Control visual de la posicion en la pieza terminada', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 120 — INSPECCION FINAL.  Aca se cubren los ensayos SC 3.1 a 3.7 del conjunto.
// El flujograma 159 numera 120 INSPECCION FINAL: resuelve la colision con el Rev.03,
// que usaba el 120 para un traslado y dejaba la inspeccion sin numero.
// ===========================================================================
const OP120 = operacion('120', 'INSPECCION FINAL',
  'Inspeccionar la pieza terminada contra los criterios de aceptacion antes de embalarla',
  'Pieza conforme a la muestra patron y a las caracteristicas designadas por el cliente',
  [
    we('Medicion', 'Inspeccion de la pieza terminada', [
      funcion(
        'Detectar en la pieza terminada los desvios de las caracteristicas designadas',
        'Criterios de aceptacion segun la muestra patron y el LSC v1 del cliente',
        [
          falla('Pieza no conforme que pasa la inspeccion final', EF_HOMOLOGACION, [
            causa('La inspeccion es visual al 100 % y no cubre la medicion de la posicion ni la densidad de la costura',
              'Muestra patron de la pieza nueva disponible en el puesto',
              4, 'Control al 100 % contra la muestra patron, mas la medicion con calibre de la posicion y la densidad de la costura vista', 7),
          ]),
        ]),
      funcion(
        'Verificar que el apoyabrazos ensamblado cumple los ensayos de validacion del cliente',
        'SC 3.1 fogging, 3.2 frotamiento, 3.3 flexibilidad, 3.4 esfuerzo excepcional, 3.5 solicitacion dinamica, 3.6 envejecimiento climatico, 3.7 usura. Los siete quedaron a cargo de SMRC en el plan de validacion del 31/07/2026',
        [
          falla('Apoyabrazos ensamblado que no cumple un ensayo de validacion del cliente', EF_HOMOLOGACION, [
            causa('La pieza se fabrica con una combinacion de sustrato y recubrimiento que no reproduce la que se valido',
              'Materiales y proceso congelados contra la pieza de validacion',
              2, 'Ensayos de validacion a cargo de SMRC segun el plan del 31/07/2026: Barack no los ejecuta', 7,
              sc('SC 3.1 a 3.7', 'cc/h')),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 130 — EMBALAJE E IDENTIFICACION
// ===========================================================================
const OP130 = operacion('130', 'EMBALAJE E IDENTIFICACION',
  'Embalar e identificar la pieza terminada segun la ficha de embalaje del cliente',
  'Medio embalado con la cantidad y la identificacion que pide el cliente',
  [
    we('Metodo', 'Embalaje e identificacion del medio', [
      funcion(
        'Embalar con la cantidad y la identificacion que pide el cliente',
        'Cantidad por medio e identificacion segun la ficha de embalaje',
        [
          falla('Medio despachado con una cantidad distinta de la de la ficha', EF_PARO_LINEA, [
            causa('El conteo se hace a mano y no hay un medio que fije la cantidad por bandeja',
              'Ficha de embalaje en el puesto',
              3, 'Reconteo del medio antes de cerrarlo', 7),
          ]),
          falla('Medio despachado con una etiqueta que no corresponde a su contenido', EF_PARO_LINEA, [
            causa('Las etiquetas de las cuatro variantes del P21 son parecidas y se imprimen en el mismo puesto',
              'Etiqueta emitida contra la orden de despacho',
              3, 'Cotejo de la etiqueta contra el contenido al cerrar el medio', 7),
          ]),
          falla('Pieza embalada con dano por el propio embalaje', EF_ASPECTO, [
            causa('El medio no tiene separadores que eviten el contacto entre piezas en zona vista',
              'Ficha de embalaje con el medio definido',
              3, 'Control visual de la pieza al cerrar el medio', 7),
          ]),
        ]),
    ]),
  ]);

const OPERACIONES = [OP10, OP20, OP30, OP40, OP50, OP60, OP70, OP80, OP90, OP100, OP110, OP120, OP130];

const doc = {
  header: {
    scope: 'APB P21 HILO NARANJA COSTURA SIMPLE - MY2026 - SMRC / STELLANTIS',
    subject: 'APB P21 HILO NARANJA COSTURA SIMPLE (MY2026)',
    partNumber: '00257327-01-NHZD / 00257328-01-NHZD',
    applicableParts: [
      '00257327-01-NHZD ARMREST P21 FR.RH - STITCH ORANGE SIMPLE LINE',
      '00257328-01-NHZD ARMREST P21 FR.LH - STITCH ORANGE SIMPLE LINE',
    ].join(', '),
    client: 'SMRC',
    customerName: 'SMRC / STELLANTIS',
    companyName: 'BARACK MERCOSUL',
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    modelYear: 'P21M - SSRT MY2026',
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
    // Equipo del AMFE 127, menos Marcelo Nieve (renuncio). Carlos Baptista es el responsable
    // de todos los AMFEs (memoria `carlos_baptista_responsable_todos_los_amfes`).
    coreTeam: [
      'Facundo Santoro (Ingenieria)',
      'Carlos Baptista (Ingenieria)',
      'Araceli Maidana (Ingenieria)',
      'Pablo Gamboa (Ingenieria)',
      'Manuel Meszaros (Calidad)',
      'Cristina Rabago (Seguridad e Higiene)',
      'Valeria Atencio (Seguridad e Higiene)',
    ],
    confidentiality: 'Confidencial',
  },
  operations: OPERACIONES,
  revisions: [
    {
      rev: 'A',
      date: FECHA,
      item: 'N/A.',
      details: 'EMISION INICIAL DEL AMFE DE PROCESO DE LA PIEZA APB P21 HILO NARANJA CON COSTURA SIMPLE DE UNA LINEA (ECR-0368291).',
      pswDate: '',
      modifiedBy: 'FS',
    },
  ],
};

// ---------------------------------------------------------------------------
// Estadisticas y chequeos propios antes de tocar Supabase
// ---------------------------------------------------------------------------
let nWE = 0, nFn = 0, nFM = 0, nCausas = 0, sinAP = 0, tbd = 0, causasConSOD = 0;
const apCount = {};
const siglaCount = {};
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
          if (c.specialChar) siglaCount[c.specialChar] = (siglaCount[c.specialChar] || 0) + 1;
          if (/TBD/.test(c.preventiveControl || '') || /TBD/.test(c.detectionControl || '')) tbd++;
        }
      }
    }
  }
}

console.log(`AMFE ${NUMERO_EMPRESA} — APB P21 HILO NARANJA COSTURA SIMPLE (MY2026)\n`);
console.log(`  operaciones   : ${doc.operations.length}`);
console.log(`  work elements : ${nWE}`);
console.log(`  funciones     : ${nFn}`);
console.log(`  modos de falla: ${nFM}`);
console.log(`  causas        : ${nCausas}`);
console.log(`  AP            : ${Object.entries(apCount).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`  sin AP        : ${sinAP}`);
console.log(`  siglas        : ${Object.entries(siglaCount).map(([k, v]) => `${k}=${v}`).join('  ') || '(ninguna)'}`);
console.log(`  con TBD       : ${tbd}`);

// --- chequeos duros propios ---
const errores = [];
if (sinAP) errores.push(`${sinAP} causas sin AP calculado`);

// 1) las 13 operaciones del flujograma 159, ni una mas ni una menos
const DEL_FLUJOGRAMA = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100', '110', '120', '130'];
const mias = doc.operations.map((o) => o.opNumber);
for (const n of DEL_FLUJOGRAMA) if (!mias.includes(n)) errores.push(`falta la OP ${n} del flujograma 159`);
for (const n of mias) if (!DEL_FLUJOGRAMA.includes(n)) errores.push(`la OP ${n} no existe en el flujograma 159`);

// 2) las 19 caracteristicas del LSC v1, cada una con la sigla que le puso el cliente
const LSC = {
  'SC 1.1': 'cc/s', 'SC 1.2': 'cc/s', 'SC 1.3': 'cc/s',
  'SC 1.4': 'cc/h', 'SC 1.5': 'cc/h', 'SC 1.6': 'sc/f',
  'SC 2.1': 'cc/h', 'SC 2.2': 'cc/h', 'SC 2.3': 'cc/h',
  'SC 2.4': 'cc/h', 'SC 2.5': 'cc/h', 'SC 2.6': 'cc/h',
  'SC 3.1': 'cc/h', 'SC 3.2': 'cc/h', 'SC 3.3': 'cc/h', 'SC 3.4': 'cc/h',
  'SC 3.5': 'cc/h', 'SC 3.6': 'cc/h', 'SC 3.7': 'cc/h',
};
const cubiertas = new Map();
for (const op of doc.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) for (const c of fm.causes) {
  if (!c.specialChar) continue;
  const m = /LSC v1 del cliente, (.+)$/.exec(c.specialCharSource || '');
  if (!m) { errores.push(`causa con sigla ${c.specialChar} sin citar de donde sale: ${c.description.slice(0, 40)}`); continue; }
  const etiqueta = m[1].replace(/\s*\(SMRC.*$/, '');
  const items = etiqueta.includes(' a ')
    ? (() => { const [a, b] = etiqueta.split(' a '); const g = a.split('.')[0]; const i0 = +a.split('.')[1], i1 = +b.split('.')[1]; return Array.from({ length: i1 - i0 + 1 }, (_, k) => `${g}.${i0 + k}`); })()
    : [etiqueta];
  for (const it of items) {
    if (!(it in LSC)) { errores.push(`la sigla cita "${it}", que no existe en el LSC v1`); continue; }
    if (LSC[it] !== c.specialCharCustomer) errores.push(`${it}: el LSC v1 dice "${LSC[it]}" y la causa lleva "${c.specialCharCustomer}"`);
    if (SIGLA_BARACK[LSC[it]] !== c.specialChar) errores.push(`${it}: "${LSC[it]}" del cliente se escribe "${SIGLA_BARACK[LSC[it]]}" y la causa lleva "${c.specialChar}"`);
    cubiertas.set(it, (cubiertas.get(it) || 0) + 1);
  }
  // una CC exige S>=9 (gate CAUSE_CC_LOW_SEVERITY)
  if (c.specialChar === 'CC' && fm.severity < 9) errores.push(`${etiqueta}: CC con S=${fm.severity} (<9)`);
}
for (const it of Object.keys(LSC)) if (!cubiertas.has(it)) errores.push(`la caracteristica ${it} del LSC v1 no esta cubierta por ninguna causa`);

// 3) el estandar de la casa
for (const op of doc.operations) {
  if (!op.workElements.length) errores.push(`OP${op.opNumber} sin work elements`);
  for (const w of op.workElements) for (const f of w.functions) {
    if (!f.failures.length) errores.push(`OP${op.opNumber}/${w.name} funcion sin fallas`);
    for (const fm of f.failures) {
      if (!fm.effectLocal || !fm.effectNextLevel || !fm.effectEndUser) errores.push(`OP${op.opNumber} FM sin los 3 efectos: ${fm.description.slice(0, 40)}`);
      if (!fm.causes.length) errores.push(`OP${op.opNumber} FM sin causas`);
      for (const c of fm.causes) {
        if (/error de oper|error del oper|error humano|error del opeario/i.test(c.description)) errores.push(`OP${op.opNumber} causa "error de operario": ${c.description.slice(0, 40)}`);
        if (/capacitaci/i.test(c.preventiveControl || '')) errores.push(`OP${op.opNumber} control preventivo de capacitacion`);
        if ((c.detectionControl || '').trim().toLowerCase() === 'visual') errores.push(`OP${op.opNumber} control de deteccion que dice solo "Visual"`);
      }
    }
  }
}

// 4) Nada de la version anterior donde se DESCRIBE el proceso de esta pieza.
//
// El barrido va sobre los campos que dicen que es y como se hace ESTA pieza (funciones de
// la operacion, del elemento foco, descripcion y requisitos de cada funcion, y los modos de
// falla). NO va sobre la descripcion de las CAUSAS: ahi nombrar la maquina de doble aguja o
// los conos de las otras variantes es correcto y util, porque el riesgo real del puesto es
// justamente confundirse con las versiones que conviven en el sector.
const camposDescriptivos = [];
for (const op of doc.operations) {
  camposDescriptivos.push(op.name, op.operationFunction, op.focusElementFunction);
  for (const w of op.workElements) {
    camposDescriptivos.push(w.name);
    for (const f of w.functions) {
      camposDescriptivos.push(f.description, f.requirements);
      for (const fm of f.failures) camposDescriptivos.push(fm.description);
    }
  }
}
camposDescriptivos.push(doc.header.scope, doc.header.subject, doc.header.applicableParts);
const texto = camposDescriptivos.join('   ').toLowerCase();
for (const [pat, que] of [
  [/doble aguja/, 'doble aguja'],
  [/coats/, 'hilo COATS'],
  [/fx284|12125/, 'hilo verde FX284 / 12125'],
  [/hilo verde|hilo azul|p21 cuero|hilo celeste/, 'otra variante del P21'],
  [/tal[oó]n de costura\s*[<>]\s*8/, 'el talon de 8 mm como si fuera la posicion de la linea'],
]) {
  if (pat.test(texto)) errores.push(`el documento describe esta pieza nombrando ${que}, que es de la version anterior`);
}

console.log(errores.length
  ? `\nERRORES (${errores.length}):\n  ${errores.join('\n  ')}`
  : '\nChequeos propios: OK\n  - las 13 operaciones del flujograma 159, sin sobrantes\n  - las 19 caracteristicas del LSC v1 cubiertas, cada una con la sigla del cliente\n  - ninguna sigla critica con S<9\n  - sin "error de operario", sin controles de capacitacion, sin deteccion que diga solo "Visual"\n  - los 3 efectos en todos los modos de falla y todos los AP calculados\n  - nada de la version anterior (doble aguja, COATS, hilo verde/azul/cuero)');

mkdirSync('tmp/p21naranja', { recursive: true });
writeFileSync('tmp/p21naranja/amfe173.json', JSON.stringify(doc, null, 1));
console.log('\nJSON escrito en tmp/p21naranja/amfe173.json');

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
  project_name: 'P21 SSRT MY2026 - HILO NARANJA',
  subject: doc.header.subject,
  client: 'SMRC',
  part_number: doc.header.partNumber,
  responsible: doc.header.processResponsible,
  organization: 'BARACK MERCOSUL',
  status: 'draft',
  operation_count: doc.operations.length,
  cause_count: nCausas,
  ap_h_count: apCount.H || 0,
  ap_m_count: apCount.M || 0,
  coverage_percent: nCausas > 0 ? Math.round((causasConSOD / nCausas) * 100) : 0,
  start_date: FECHA_ISO,
  last_revision_date: FECHA_ISO,
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
