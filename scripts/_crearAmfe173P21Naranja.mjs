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
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { validateEquipoMultifuncional } from './_lib/amfeValidator.mjs';

const APPLY = process.argv.includes('--apply');
const AMFE_KEY = 'AMFE-P21-NAR-MY26';
const NUMERO_EMPRESA = '173';   // proximo ID libre del Listado_Maestro_AMFE.xlsx (max cargado: 172)
const FECHA = '21/09/2026';
const FECHA_ISO = '2026-09-21';

const calcularAP = calculateAP;

/**
 * Ids ESTABLES entre corridas. Eran `randomUUID()` y eso dejaba CIEGO al gate: `issueKey()`
 * del validador identifica cada hallazgo por el id de su operacion, asi que con ids nuevos
 * en cada corrida el diff before/after marcaba como "introducidos" hasta los 21 avisos que
 * ya estaban. Un control que avisa siempre lo mismo no lo mira nadie, y peor: tapa el aviso
 * que si es nuevo.
 *
 * Un contador con prefijo alcanza porque el documento se arma siempre en el mismo orden.
 * Si se inserta una operacion en el medio, los ids de ahi para abajo corren y la corrida
 * siguiente avisa de mas UNA vez; eso es visible y se entiende, a diferencia del ruido fijo.
 */
let _n = 0;
const id = () => `p21nar-${String(++_n).padStart(4, '0')}`;

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
    // Un AP=H sin accion va con la CELDA VACIA. El placeholder "Pendiente definicion equipo
    // APQP" quedo prohibido el 21/09/2026 (Fak, viendo el PDF del 131: "saca esa mierda, no
    // la quiero ni ver en el AMFE"), y lo frena el check CAUSE_APH_PLACEHOLDER_PROHIBIDO.
    // La accion la define el equipo cuando decide definirla; mientras tanto no se escribe nada.
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
    // Va la sigla del CLIENTE. Fak, 21/09/2026: "no, usa las del cliente... incorporalas a
    // nuestro canon porque las vamos a volver a utilizar, son las oficiales de SMRC". Estan
    // en core/amfe/caracteristicasEspeciales.data.json con su tabla de conversion, asi que
    // el validador las reconoce. El equivalente interno viaja al lado para el que lo precise.
    specialChar: siglaCliente,
    specialCharBarack: propia,
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
// La pieza no es la que se homologo: material, hilo o costura distintos de los que el cliente
// designo. El efecto en el USUARIO FINAL es que el vehiculo se monta con una pieza que no es
// la de su homologacion, y eso cae en "Noncompliance with regulations" de la Tabla P1 -> S=9.
//
// DECISION DE FAK, 21/09/2026. La tomo el con las dos lecturas delante:
//   (a) montar un vehiculo con una pieza no homologada ES incumplimiento reglamentario -> 9
//   (b) el efecto que Barack puede describir es el rechazo del lote -> 8
// Eligio (a), que es ademas el razonamiento del propio cliente: por eso SMRC marca estas
// caracteristicas como <cc/h>, critica de HOMOLOGACION.
//
// La S sigue saliendo del EFECTO, no de la sigla: lo que cambio es el efecto que se declara.
// La diferencia que el script reportaba se cerro por decision, no subiendo un numero suelto.
const EF_PIEZA_DISTINTA = {
  s: 9,
  local: 'Pieza fabricada con un material, un hilo o una costura distintos de los homologados',
  next: 'Rechazo del lote completo en la recepcion de SMRC',
  end: 'Vehiculo montado con una pieza que no corresponde a su homologacion',
};
// (Hubo un EF_ASPECTO_COSTURA con S=7 para la posicion y la densidad de la costura. Quedo sin
//  uso: la SC 2.3 y la SC 2.4 tambien son <cc/h> del cliente, asi que por la decision de Fak
//  del 21/09 van al mismo efecto de homologacion que el resto. Si alguna vez aparece un desvio
//  de costura que el cliente NO designo, ese si es aspecto y vuelve a necesitar su propio
//  efecto: los desvios que hoy van por EF_ASPECTO son justamente esos.)
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
          falla('Vinilo recibido con espesor, grano o color distintos del especificado', EF_PIEZA_DISTINTA, [
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
          falla('Fuerza de arrancamiento a 90 grados por debajo de 5 N/cm', EF_PIEZA_DISTINTA, [
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
          falla('Hilo de costura vista recibido distinto del especificado', EF_PIEZA_DISTINTA, [
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
            // El control de prevencion NO puede afirmar lo que la causa niega: decia "medida
            // minima de cuchilla DEFINIDA" al lado de una causa que dice que ese criterio no
            // existe. Lo que si hay en el puesto es el calibre.
            causa('La cuchilla se usa mas alla de su medida minima porque no hay un criterio de cambio definido',
              'Calibre en el puesto para medir la cuchilla',
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
              'TBD - falta asegurar la provision de guantes anticorte del puesto',
              10, 'Control del uso de EPP en el recorrido de turno', 9),
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
            // La deteccion decia "contra el patron del puesto" y la causa dice que ese patron
            // NO existe: el control se apoyaba en algo que la misma fila niega. Sin criterio
            // contra el cual comparar no hay metodo de deteccion establecido -> Tabla P3, D=10.
            causa('El control es visual y no hay un patron de comparacion en el puesto',
              'TBD - falta el patron de comparacion en el puesto de corte',
              5, 'Control visual del operario, sin patron contra el cual comparar', 10),
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
          falla('Costura de union ejecutada con un hilo distinto del Nylon M40 negro', EF_PIEZA_DISTINTA, [
            causa('El puesto admite montar cualquier cono de hilo que este disponible',
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
              'TBD - falta definir la rotacion de puestos y la pausa activa',
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
          falla('Costura vista ejecutada con un tipo de puntada distinto del pespunte simple HAQ', EF_PIEZA_DISTINTA, [
            causa('El puesto produce tambien las versiones anteriores del P21 y el seteo de la maquina se comparte',
              'Hoja de operaciones propia de la pieza nueva, separada de la de las versiones anteriores',
              4, 'Cotejo de la primera pieza del lote contra la muestra patron de la pieza nueva', 6,
              sc('SC 2.1', 'cc/h')),
          ]),
          falla('Costura vista ejecutada con dos lineas en lugar de una sola', EF_PIEZA_DISTINTA, [
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
          falla('Linea de costura vista fuera de 4 +0 / -1 mm de la linea de union', EF_PIEZA_DISTINTA, [
            causa('La guia del pie de la maquina es regulable y no queda fijada entre lotes',
              'Guia de referencia seteada y verificada en el set up, contra la hoja de operaciones',
              5, 'Medicion con calibre de la distancia a la linea de union, al inicio de turno y en cada cambio de lote', 6,
              sc('SC 2.3', 'cc/h')),
          ]),
          falla('Cantidad de puntos fuera de 10 a 11 cada 50 mm', EF_PIEZA_DISTINTA, [
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
          falla('Costura vista ejecutada con un hilo distinto del Linhanyl BX138 naranja', EF_PIEZA_DISTINTA, [
            causa('El puesto admite montar cualquier cono de hilo que este en el sector',
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
              'TBD - falta definir la rotacion de puestos y la pausa activa',
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
// El sustrato SIEMPRE lleva primer, y siempre lo llevo. Verificado el 21/09/2026 en once
// documentos: OP 70 propia en la HO 927 desde la REV.2 (2023), instructivos IO-07 (mezcla) e
// IO-19 (aplicacion), items PPBL-3A/3B en la BOM 927 Rev03 y en la BOM 127 Rev7, consumo en el
// arb, y el plano RP-00238891 V06 con la misma materia prima (>P/E< -HC PPT X9127) para las 17
// piezas — el ECR-0368291 solo cambia la costura. La Rev.A decia "cuando la pieza lo requiere":
// ese condicional no lo respalda ninguna fuente y el flujograma lo dibujaba como una
// bifurcacion cuya rama NO no aterrizaba en ningun lado.
//
// La vida util de la mezcla (9 h) y su receta son PARAMETROS: van al Plan de Control, no aca
// (amfe.md §11). El modo de falla nombra el fenomeno.
const OP70 = operacion('70', 'APLICACION DE PRIMER',
  'Aplicar primer sobre el sustrato plastico antes del adhesivado',
  'Primer vigente, mezclado segun IO-07 y aplicado segun IO-19 dentro de su vida util',
  [
    we('Material', 'Primer de dos componentes', [
      funcion(
        'Preparar y usar el primer segun su especificacion',
        'Componentes mezclados y mezcla usada dentro de su vida util',
        [
          // Este modo de falla YA PASO y llego como reclamo del cliente: el log de revisiones
          // del Plan de Control rev L registra "Revision por reclamo de cliente QR 219344
          // primer vencido". El AMFE 127 lo tiene con S=8; la Rev.A de este documento lo habia
          // perdido. Un AMFE nuevo que no contiene la falla que ya le ocurrio al cliente es
          // hallazgo de auditoria (IATF 16949 §10.2: lecciones aprendidas).
          falla('Primer aplicado despues de su fecha de vencimiento', EF_PARO_LINEA, [
            causa('El envase en el puesto no se coteja contra su fecha de vencimiento antes de usarlo',
              'Control de vencimiento del primer en la recepcion del material',
              4, 'Verificacion de la fecha de vencimiento del envase antes de preparar la mezcla', 7),
          ]),
          falla('Primer aplicado sin mezclar sus componentes', EF_PARO_LINEA, [
            causa('La preparacion no deja registro de que la mezcla se hizo',
              'Instructivo IO-07 de mezcla en el puesto',
              4, 'Registro de preparacion del primer con hora', 8),
          ]),
          falla('Primer usado despues del fin de su vida util', EF_ASPECTO, [
            causa('El envase preparado no lleva la hora de preparacion a la vista',
              'TBD - falta la identificacion del envase con la hora de preparacion',
              4, 'Control de la hora del envase antes de usarlo', 8),
          ]),
        ]),
    ]),
    // El otro modo de falla del AMFE 127 que la Rev.A habia perdido. El IO-19 pide cubrir la
    // cara superior, la cara lateral, los ojales y las esquinas: una aplicacion incompleta deja
    // zonas sin adherencia y el vinilo se despega despues del horno.
    we('Metodo', 'Aplicacion del primer con pincel', [
      funcion(
        'Cubrir toda la superficie que despues recibe el adhesivo',
        'Cara superior, cara lateral, ojales y esquinas cubiertos segun IO-19',
        [
          falla('Primer aplicado en forma incompleta sobre el sustrato', EF_ASPECTO, [
            causa('El primer es transparente y la zona cubierta no se distingue a simple vista',
              'Instructivo IO-19 con la secuencia de aplicacion en el puesto',
              5, 'Control visual de la pieza antes de pasar al adhesivado', 8),
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
// La Rev.A saltaba del adhesivado al tapizado y se comia una operacion entera. El ACTIVADO DEL
// ADHESIVO EN HORNO lo declaran TRES fuentes independientes: HO 927 REV6 hoja 90.1 (corte
// 66 °C, minimo 55 °C, ciclo 150-180 s), AMFE 127 OP 90.1, y Plan de Control rev M fila 166
// ("Activado de adhesivo en pieza plastica y vinilo", maquina Horno, con tres QRCI detras).
// Se adopta la particion 90.1 / 90.2 de la HO, que es la numeracion del flujograma 159.
const OP90A = operacion('90.1', 'ACTIVADO DEL ADHESIVO EN HORNO',
  'Activar el adhesivo de las dos partes antes del montaje',
  'Sustrato y vinilo dentro de la ventana de temperatura y de ciclo del horno',
  [
    we('Maquina', 'Horno de activado', [
      funcion(
        'Llevar el adhesivo a su temperatura de activado',
        'Temperatura de la pieza dentro de la ventana y ciclo completo',
        [
          falla('Adhesivo que sale del horno por debajo de su temperatura de activado', EF_PARO_LINEA, [
            causa('El horno se habilita para trabajar antes de estabilizar su temperatura',
              'Corte de temperatura seteado en el panel del horno',
              4, 'Verificacion de la temperatura de la pieza al salir del horno', 8),
          ]),
          falla('Pieza sobrecalentada en el horno', EF_ASPECTO, [
            causa('La pieza queda en el horno mas alla del ciclo cuando el puesto siguiente esta ocupado',
              'Ciclo del horno definido en la hoja de operaciones',
              4, 'Control del tiempo de ciclo en el puesto', 8),
          ]),
        ]),
    ]),
  ]);

const OP90 = operacion('90.2', 'TAPIZADO',
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
          // El control con REGLA MYLAR. Sale de la HO 927 REV6, hoja 90.2, celda L39:
          // "Alineacion visual de costura utilizando regla Mylar de soporte", responsable OP,
          // frecuencia 1, registro "Set up 1° pieza OK + Registro control calidad". Entro en la
          // REV.5 (31/10/2025). Es el unico medio del proceso que verifica la posicion de la
          // costura, que es caracteristica designada por el cliente, y la Rev.A de este AMFE no
          // lo tenia en ninguna fila. Tampoco esta en el Plan de Control: hay que declararlo.
          falla('Costura vista fuera de su alineacion sobre el radio del sustrato', EF_ASPECTO, [
            causa('La funda se acomoda a mano y el talon de costura se corre en la curva delantera',
              'Regla mylar de soporte en el puesto (HO 927, hoja 90.2)',
              4, 'Alineacion de la costura con regla mylar, primera pieza del lote y registro de control de calidad', 7),
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
          // La fila se contradecia a si misma: la causa decia que la inspeccion NO mide la
          // costura y el control declaraba que SI la mide con calibre, y de esa segunda
          // frase salia el D=7. El auditor lo marco el 21/09/2026 (Tabla P3 / A3.2 3.5.2:
          // "controles que pueden no ejecutarse realmente"). Se deja lo que de verdad pasa:
          // la inspeccion final es visual contra la muestra patron. La MEDICION de la
          // posicion y la densidad ya vive donde corresponde, en la OP 50, al inicio de
          // turno y en cada cambio de lote.
          falla('Pieza no conforme que pasa la inspeccion final', EF_PIEZA_DISTINTA, [
            causa('La inspeccion final compara contra la muestra patron y no mide la posicion ni la densidad de la costura',
              'Muestra patron de la pieza nueva disponible en el puesto',
              4, 'Control visual al 100 % contra la muestra patron, en la estacion de inspeccion final', 7),
          ]),
        ]),
      funcion(
        'Verificar que el apoyabrazos ensamblado cumple los ensayos de validacion del cliente',
        'SC 3.1 fogging (B62 0400), 3.2 frotamiento (D45 1010), 3.3 flexibilidad, 3.4 esfuerzo excepcional y 3.5 solicitacion dinamica (ST 01439), 3.6 envejecimiento climatico (D47 1309), 3.7 usura (D14 1055 y D47 1309). Los siete quedaron a cargo de SMRC en el plan de validacion del 31/07/2026',
        [
          falla('Apoyabrazos ensamblado que no cumple un ensayo de validacion del cliente', EF_PIEZA_DISTINTA, [
            causa('La pieza se fabrica con una combinacion de sustrato y recubrimiento que no reproduce la que se valido',
              'Materiales y proceso congelados contra la pieza de validacion',
              // D=10, no 7: la Tabla P3 califica "each detection activity performed PRIOR TO
              // SHIPMENT of the product". Un ensayo que corre el cliente DESPUES de recibir la
              // pieza no es un control de deteccion de Barack. Declararlo con D=7 le pone al
              // documento una deteccion propia que no existe.
              // La O tampoco puede ser 2: P2-2 exige "carryover application" con historial de
              // capacidad en serie, y esta combinacion de sustrato y recubrimiento es nueva.
              4, 'Sin control propio: los ensayos B62 0400, D45 1010, ST 01439, D47 1309 y D14 1055 quedaron a cargo de SMRC en el plan de validacion del 31/07/2026', 10,
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

const OPERACIONES = [OP10, OP20, OP30, OP40, OP50, OP60, OP70, OP80, OP90A, OP90, OP100, OP110, OP120, OP130];

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
    // 21/09/2026 — la primera version de esta lista salio del AMFE 127 (agosto 2024) copiada
    // tal cual, y Fak la cazo apenas abrio el archivo: Araceli Maidana se habia ido en marzo
    // de 2024 (o sea que el 127 YA estaba mal) y Valeria Atencio en agosto de 2025.
    // Un dato de PERSONAS no se hereda de un documento viejo. Hoy la nomina, con la evidencia
    // de cada alta y cada baja, vive en core/amfe/nominaBarack.data.json y la revisa el check
    // EQUIPO_PERSONA_NO_TRABAJA, que frena el --apply y el export oficial.
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
const DEL_FLUJOGRAMA = ['10', '20', '30', '40', '50', '60', '70', '80', '90.1', '90.2', '100', '110', '120', '130'];
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
const diferencias = [];
const criticasQueCierran = [];
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
    if (LSC[it] !== c.specialChar) errores.push(`${it}: el LSC v1 dice "${LSC[it]}" y la causa lleva "${c.specialChar}"`);
    cubiertas.set(it, (cubiertas.get(it) || 0) + 1);
  }
  // una CC exige S>=9 (gate CAUSE_CC_LOW_SEVERITY)
  // OJO: aca NO se frena por "critica con S<9". Esa diferencia es real y se INFORMA
  // (regla caracteristicas-especiales.md §2bis): el cliente designa por su criterio y
  // nuestra S sale del efecto. Subir la S para que cierre es fabricar el riesgo.
  if (c.specialChar && c.specialChar.startsWith('cc') && fm.severity >= 9) criticasQueCierran.push(etiqueta);
  if (c.specialChar && c.specialChar.startsWith('cc') && fm.severity < 9) diferencias.push({ ca: etiqueta, sigla: c.specialChar, s: fm.severity, fm: fm.description });
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
const texto = camposDescriptivos.join('\n').toLowerCase();
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
  : `\nChequeos propios: OK\n  - las ${DEL_FLUJOGRAMA.length} operaciones del flujograma 159, sin sobrantes\n  - las 19 caracteristicas del LSC v1 cubiertas, cada una con la sigla que les puso el cliente\n  - sin "error de operario", sin controles de capacitacion, sin deteccion que diga solo "Visual"\n  - los 3 efectos en todos los modos de falla y todos los AP calculados\n  - nada de la version anterior (doble aguja, COATS, hilo verde/azul/cuero)`);

// ---------------------------------------------------------------------------
// LA DIFERENCIA QUE DECIDE FAK — no es un error del documento, es una discrepancia real
//
// El cliente designa por SU criterio y nuestra severidad sale del EFECTO (Tabla P1). Cuando
// las dos no coinciden, la regla `caracteristicas-especiales.md` §2bis dice que se INFORMA,
// nunca que se sube la S: inflar la severidad para que cierre con la marca es fabricar el
// riesgo. Asi que el documento sale con la S honesta y con la sigla del cliente, y la
// diferencia se pone sobre la mesa.
// ---------------------------------------------------------------------------
if (diferencias.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(`DIFERENCIA CLIENTE vs EFECTO — ${diferencias.length} causas. LA DECIDE FAK, no el script.`);
  console.log('='.repeat(78));
  console.log('\nSMRC marco estas caracteristicas como CRITICAS. Por la Tabla P1 el efecto que');
  console.log('producen no llega a S=9 ("Noncompliance with regulations"), asi que la S quedo');
  console.log('en el valor que le corresponde al efecto:\n');
  const porSigla = new Map();
  for (const d of diferencias) {
    const k = `${d.sigla} · S=${d.s} · ${d.fm}`;
    if (!porSigla.has(k)) porSigla.set(k, []);
    porSigla.get(k).push(d.ca);
  }
  for (const [k, cas] of porSigla) console.log(`  ${cas.join(', ').padEnd(22)}  ${k}`);
  console.log('\nLas dos lecturas, para que la decision sea con las dos delante:');
  console.log('  (a) Montar un vehiculo con una pieza que no es la homologada ES un incumplimiento');
  console.log('      reglamentario -> S=9 y la critica cierra sola. Es el razonamiento del cliente.');
  console.log('  (b) El efecto que Barack puede describir es que SMRC rechaza el lote y para su');
  console.log('      linea -> S=8 por la columna Ship to Plant. Es lo que dice el documento hoy.');
  console.log('\n  Mientras quede en (b), el validador va a marcar CAUSE_CC_LOW_SEVERITY en esas');
  console.log('  causas y el export oficial no corre. Eso NO es una falla del documento: es el');
  console.log('  gate mostrando una discrepancia que tiene que resolver una persona.');
  console.log(`\n  Criticas que SI cierran con S>=9 por su propio efecto: ${criticasQueCierran.length ? [...new Set(criticasQueCierran)].join(', ') : 'ninguna'}`);
}

mkdirSync('tmp/p21naranja', { recursive: true });
writeFileSync('tmp/p21naranja/amfe173.json', JSON.stringify(doc, null, 1));
console.log('\nJSON escrito en tmp/p21naranja/amfe173.json');

if (!APPLY) {
  console.log('\nDRY-RUN. Corre con --apply para escribir en Supabase.');
  process.exit(errores.length ? 1 : 0);
}
if (errores.length) { console.error('\nNO se escribe: hay errores.'); process.exit(1); }

const sb = await connectSupabase();
const { data: ex } = await sb.from('amfe_documents').select('id,amfe_number,updated_at,data').eq('amfe_number', AMFE_KEY);

// Si ya existe, se ACTUALIZA en su lugar. Este script es el generador del documento: la
// version que vale es siempre la ultima que salio de aca. Insertar un segundo
// AMFE-P21-NAR-MY26 dejaria dos verdades; y dejar la vieja seria peor todavia, porque la
// primera carga tenia las severidades derivadas de la sigla (el error del 21/09).
if (ex && ex.length) {
  const id0 = ex[0].id;
  console.log(`\n${AMFE_KEY} ya existe (id=${id0}, updated_at=${ex[0].updated_at}). Se ACTUALIZA en su lugar.`);

  // Gate obligatorio (amfe.md §14): compara el documento que esta hoy contra el que va a
  // quedar y frena si el cambio METE criticos nuevos. Sacar criticos no lo frena, que es
  // justo lo que hace esta corrida con las dos personas que ya no trabajan en Barack.
  await runWithValidation(
    [{ id: id0, amfeNumber: AMFE_KEY, productName: doc.header.subject, before: parseData(ex[0].data), after: doc }],
    true,
    async () => {
      const { error: errUpd } = await sb.from('amfe_documents').update({
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
      }).eq('id', id0);
      if (errUpd) { console.error('UPDATE FALLO:', errUpd.message); process.exit(1); }
    },
  );

  const { data: v0 } = await sb.from('amfe_documents').select('id,operation_count,cause_count,updated_at,data').eq('id', id0).single();
  const back0 = parseData(v0.data);
  // Relectura de control: que el data quedo legible, que las severidades son las nuevas y
  // que en la caratula no quedo nadie que no trabaje.
  const sev = new Set();
  for (const op of back0.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) sev.add(fm.severity);
  console.log(`UPDATE OK`);
  console.log(`  verificado: ops=${v0.operation_count} causas=${v0.cause_count} | data.operations es array: ${Array.isArray(back0.operations)} | ops leidas: ${back0.operations.length}`);
  console.log(`  severidades presentes: ${[...sev].sort((a, b) => a - b).join(', ')}`);
  console.log(`  equipo multifuncional: ${back0.header.coreTeam.join(' · ')}`);
  console.log(`  problemas de nomina: ${validateEquipoMultifuncional(back0, AMFE_KEY).length}`);
  console.log(`  updated_at: ${v0.updated_at}`);
  process.exit(0);
}

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
