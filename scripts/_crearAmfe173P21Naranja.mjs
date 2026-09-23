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
// Fecha de REVISION: la del ultimo cambio (23/09/2026, correcciones de la auditoria de cliente).
// La Rev. A se EMITIO el 21/09 (FECHA, la de la fila de revisiones y la del listado maestro);
// amfe.md §4bis: la letra no cambia hasta la proxima emision, la fecha de revision si se mueve.
const FECHA_REVISION = '23/09/2026';
const FECHA_REVISION_ISO = '2026-09-23';

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

/**
 * El AMFE no cita al Plan de Control. Fak, 23/09/2026: "no citemos a un PC y menos si es viejo,
 * eso no me gusta nada". El PC que se citaba era el del P21 hilo verde (rev M) y el P21 rev H,
 * con otra numeracion de operaciones: en la OP 100 decia "Operacion 120", que en este AMFE es el
 * embalaje. Las citas quedan en el codigo de este generador como rastro de DE DONDE salio cada
 * control; al documento no llegan. Saca "(Plan de Control ...)" entero y el tramo
 * "; Plan de Control ..." o ", Plan de Control ..." adentro de un parentesis con otras fuentes.
 * El "Plan de control de recepcion de materiales (P-10/I)" NO es el Plan de Control de la pieza:
 * es el procedimiento de recepcion, y se queda.
 */
function sinPlanDeControl(texto) {
  if (typeof texto !== 'string') return texto;
  return texto
    .replace(/\s*\(Plan de Control (?:rev|P21|\d)[^()]*\)/g, '')
    .replace(/[;,]\s*Plan de Control (?:rev|P21|\d)[^();]*(?=[;)])/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;)])/g, '$1')
    .trim();
}

/**
 * El documento no cita de donde sale cada control. Fak, 23/09/2026, mirando el Excel que va al
 * cliente: "hay demasiadas aclaraciones, no aclares tanto... (OP 21; HO mesa de corte, hoja 28)
 * esa esta al pedo, molestan la verdad". Las fuentes quedan en el codigo de este generador (el
 * rastro de por que cada fila dice lo que dice); al documento no llegan. Se saca el parentesis
 * que CITA (hoja, HO, SET UP, manual, instructivo, procedimiento, plano, carta, OP de origen) y
 * se deja el que es parte de lo que se controla: (+2 / -0), (RH / LH), (BX138 / 12124E).
 */
const CITA = /\b(HO|hojas?|SET ?UP|manual|IO-\d|I-MT-|P-\d|OP \d|plan de validacion|carta de nominacion|plano|REV\.?\s?\d|Rev\.?\s?[A-Z0-9])/i;
function sinCitas(texto) {
  if (typeof texto !== 'string') return texto;
  return texto
    .replace(/\s*\(([^()]*)\)/g, (todo, adentro) => (CITA.test(adentro) ? '' : todo))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();
}

function causa(descripcion, prevControl, O, detControl, D, extra = {}) {
  prevControl = sinCitas(sinPlanDeControl(prevControl));
  detControl = sinCitas(sinPlanDeControl(detControl));
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
  requisitos = sinCitas(sinPlanDeControl(requisitos));
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
// Eligio (a).
//
// CORREGIDO EL 22/09/2026 A (b), tambien por decision de Fak, despues de que una auditoria de
// cliente contra la Tabla P1 mostrara la contradiccion que (a) dejaba adentro del documento:
// "costura vista con dos lineas en lugar de una" quedaba S=9, es decir MAS GRAVE que "paro de
// linea en la planta del cliente / vehiculo no ensamblable", que es S=8. Un desvio de
// especificacion no es "Noncompliance with regulations": el efecto que Barack puede sostener
// es el que ya escribe la fila de al lado, el rechazo del lote en la recepcion de SMRC, y eso
// es P1-8 ("Stop shipment possible" en la columna Ship to Plant; "100% of product affected may
// have to be scrapped" en Your Plant).
//
// Lo que NO cambia: las <cc/h> siguen siendo <cc/h>. Las designo el cliente en su LSC v1 y esa
// designacion es un dato suyo, no una consecuencia de nuestra S (regla
// caracteristicas-especiales.md §2bis: si el cliente designo y la S por efecto no llega a 9,
// se informa la diferencia, NO se sube la S). Las tres <cc/s> de inflamabilidad se quedan en
// S=9 por su propio efecto, que si dice incumplimiento legal.
// 22/09/2026 (tarde) — el texto del nivel USUARIO decia "vehiculo montado con una pieza que no
// corresponde a la especificacion homologada", y eso se lee como incumplimiento de regulacion
// (P1-9). El par texto/S no cerraba: la S es 8, asi que el texto dice lo que describe el 8 de
// la Tabla P1 ("stop shipment possible; field repair or replacement required").
const EF_PIEZA_DISTINTA = {
  s: 8,
  local: 'Pieza fabricada con un material, un hilo o una costura distintos de los aprobados',
  next: 'Rechazo del lote completo en la recepcion de SMRC y posible paro de envios',
  end: 'Posible reemplazo de la pieza en el campo',
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
// 22/09/2026 — bajado de S=7 a S=5, y es el MISMO error que el de las <cc/h>: la S estaba por
// encima de lo que dice su propio efecto. La Tabla P1 califica lo que PASA, y este efecto ya
// escribe el criterio del nivel 5 casi textual: "Posible clasificacion de piezas en la planta
// del cliente" es P1-5, "Sort required. No Line Shutdown"; la columna de usuario final de un
// desvio de aspecto llega a 4, "appearance unacceptable to most customers". El 7 exige
// "Line shutdown 1 hour ~ Full Production Shift", que este efecto no describe.
// En el mismo documento, el efecto de scrap interno tambien estaba en 7 — ese SI corresponde
// (P1-7: "A portion of the production run may have to be scrapped") y no se toca.
const EF_ASPECTO = {
  s: 5,
  local: 'Pieza con desvio de aspecto en zona vista del apoyabrazos',
  next: 'Posible clasificacion de piezas en la planta del cliente',
  end: 'Aspecto por debajo del estandar percibido por el usuario',
};
// El nivel "cliente" decia "ausentismo e incumplimiento de la Ley 19587 en la planta": eso pasa
// en la planta de BARACK, no en la de SMRC. Los tres niveles son la propia planta, la planta
// del cliente y el usuario (manual SETEC pag. 90, lamina 180).
// Costura que no aguanta: floja, salteada o sin atraque. P1-7, igual que el despegue: la
// costura se abre en el uso y la pieza se reemplaza en el campo.
const EF_COSTURA = {
  s: 7,
  local: 'Costura con resistencia insuficiente',
  next: 'Rechazo y clasificacion de piezas en la recepcion de SMRC',
  end: 'Costura que se abre en el uso, con reemplazo de la pieza en el campo',
};
// Defecto que el residente de Barack retrabaja en la planta de SMRC antes del montaje
// (orificios obstruidos, exceso de material). P1-5: "a portion of the production run has to
// be reworked off line and accepted" / "sort required".
const EF_RETRABAJO_CLIENTE = {
  s: 5,
  local: 'Pieza que necesita retrabajo antes del montaje',
  next: 'Clasificacion y retrabajo de piezas en la planta de SMRC',
  end: 'Sin efecto en el vehiculo si se retrabaja antes del montaje',
};
// S=10 es el riesgo AGUDO (corte, aguja, quemadura, golpe) y S=8 el CRONICO, el que se acumula
// con el tiempo (postura, repeticion, ruido): Tabla P1 oficial, SETEC pag. 101-102 (laminas 202
// y 203: "riesgo de salud y/o seguridad agudo" = 10; "cronico para el trabajador de la linea" = 8).
// Hasta el 23/09/2026 los dos iban en 10; lo separo la auditoria de cliente del 23/09 y lo aprobo
// Fak ("tabla oficial ni mas ni menos").
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
// Pegado deficiente del vinilo sobre el sustrato. Hasta el 22/09 el mismo resultado fisico se
// calificaba con dos S distintas segun la operacion: "falta de adhesivo" S=8 (paro de linea) y
// "adhesivo insuficiente" S=5 (aspecto), "primer vencido" S=8 y "primer incompleto" S=5. La S
// sale del EFECTO, y el efecto es uno: el vinilo se despega. Tabla P1-7: "field repair or
// replacement required (Assembly to End User) other than for regulatory noncompliance" y
// "a portion of the production run may have to be scrapped".
const EF_DESPEGUE = {
  s: 7,
  local: 'Vinilo con adherencia insuficiente sobre el sustrato',
  next: 'Rechazo y clasificacion de piezas en la recepcion de SMRC',
  end: 'Despegue del vinilo en el uso, con reemplazo de la pieza en el campo',
};
// Pieza sin su etiqueta de trazabilidad (IO-16). No cambia la funcion; el cliente clasifica y
// reidentifica: P1-5 "Sort required. No line shutdown".
const EF_IDENTIFICACION = {
  s: 5,
  local: 'Pieza sin trazabilidad de su lote de fabricacion',
  next: 'Clasificacion y reidentificacion de piezas en SMRC',
  end: 'Sin efecto en la funcion del vehiculo',
};
// Medio con una cantidad distinta de la ficha. El paro de linea (S=8) no lo produce un error de
// conteo: el faltante se repone. P1-6: "line shutdown up to one hour".
const EF_CANTIDAD = {
  s: 6,
  local: 'Medio con una cantidad de piezas distinta de la ficha de embalaje',
  next: 'Faltante o sobrante en la recepcion de SMRC, con reposicion urgente',
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
            // La causa decia "el pedido NO exige el certificado" y la prevencion "la especificacion
            // SI lo exige": la fila se negaba sola. Lo que puede fallar es la entrega, no el pedido.
            // D=7: cotejo humano del papel, lote por lote (amfe.md §13).
            causa('El proveedor entrega el lote sin el certificado de ensayo D45 1333 o con el de otro lote',
              'Especificacion de compra a York con el limite de velocidad de combustion y el certificado por lote como condicion de entrega',
              3, 'Cotejo del certificado de cada lote contra la especificacion antes de liberarlo', 8,
              sc('SC 1.1', 'cc/s')),
          ]),
          falla('Vinilo que pierde el comportamiento al fuego con el envejecimiento', EF_LEGAL_FUEGO, [
            // D=9, no 5. El plan de validacion del 31/07/2026 hace este ensayo "1 vez inicio de
            // proyecto": es una validacion, no un control de serie. Tabla P3-9: "random or
            // sporadic audits". Un 5 le ponia al documento una deteccion por lote que no existe.
            causa('Degradacion del material tras 100 h a 40 C con 95 % de humedad relativa',
              'Requisito de envejecimiento declarado a York en la especificacion de compra',
              3, 'Ensayo en camara climatica una vez, al inicio del proyecto (plan de validacion del 31/07/2026); sin ensayo por lote', 9,
              sc('SC 1.2', 'cc/s')),
            causa('Degradacion del material tras 100 h a 100 C',
              'Requisito de envejecimiento declarado a York en la especificacion de compra',
              3, 'Ensayo en camara climatica una vez, al inicio del proyecto (plan de validacion del 31/07/2026); sin ensayo por lote', 9,
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
              3, 'Cotejo de la certificacion del proveedor de cada lote, que el LSC v1 exige de forma explicita', 8,
              sc('SC 1.4', 'cc/h')),
          ]),
        ]),
      funcion(
        'Mantener adherido el recubrimiento a su backing durante la vida del vehiculo',
        'SC 1.5: fuerza de arrancamiento a 90 grados >= 5 N/cm despues de los ciclos de envejecimiento 4AF + 6BF, metodo D51 1485',
        [
          falla('Fuerza de arrancamiento a 90 grados por debajo de 5 N/cm', EF_PIEZA_DISTINTA, [
            // El plan de validacion pide este ensayo "1 vez cada inicio de lote (turno)" y "cada
            // 3 M": es por muestreo, no al 100 % -> P3-9.
            causa('El proveedor entrega un lote con adherencia insuficiente entre el vinilo y su backing de espuma',
              'Requisito >= 5 N/cm y metodo D51 1485 declarados a York en la especificacion de compra',
              3, 'Ensayo de arrancamiento por muestreo, al inicio de lote y cada 3 meses (plan de validacion del 31/07/2026)', 9,
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
              4, 'Cotejo de la etiqueta del cono contra la orden de compra, cono por cono, en la recepcion', 8,
              sc('SC 2.5', 'cc/h')),
          ]),
        ]),
    ]),
    // El Plan de Control rev M (Operacion 10, items 3, 5 y 6) recibe tambien el primer PPBL3-A/B,
    // el adhesivo FA con su reticulante GV y el hilo de union, y la Rev.A no tenia ningun modo de
    // falla de recepcion para ellos. El control es el de la recepcion general (P-10/I, "1 pieza
    // por entrega") -> muestreo, P3-9.
    we('Material', 'Hilo de union, primer PPBL3 y adhesivo FA con reticulante GV', [
      funcion(
        'Recibir los insumos de costura y de pegado que define el proceso',
        'SC 2.6: hilo de union Nylon M40 negro. Primer PPBL3-A y PPBL3-B, adhesivo FA con reticulante GV, dentro de su vencimiento',
        [
          falla('Hilo de union recibido distinto del Nylon M40 negro', EF_PIEZA_DISTINTA, [
            causa('El hilo se recibe contra el remito y el control es por muestreo',
              'Plan de control de recepcion de materiales (P-10/I)',
              4, 'Control de recepcion, 1 pieza por entrega (Plan de Control rev M, Operacion 10, item 6)', 9,
              sc('SC 2.6', 'cc/h')),
          ]),
          falla('Primer o adhesivo recibido distinto del especificado o vencido', EF_DESPEGUE, [
            causa('Los componentes se reciben contra el remito y el control es por muestreo',
              'Plan de control de recepcion de materiales (P-10/I)',
              4, 'Control de recepcion, 1 pieza por entrega (Plan de Control rev M, Operacion 10, items 3 y 5)', 9),
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
              4, 'Control de la identificacion de lote en el sector antes de arrancar el turno', 8),
          ]),
          falla('Se toma para produccion materia prima obsoleta', EF_SCRAP_INTERNO, [
            causa('El material obsoleto permanece en el deposito junto al vigente',
              'Material obsoleto identificado y en zona propia',
              3, 'Control de la identificacion del rollo antes de habilitarlo al corte', 8),
          ]),
          falla('Se utilizan pallets distintos de los definidos', EF_SCRAP_INTERNO, [
            causa('No esta definido por escrito cual es el pallet que corresponde a cada material',
              'Sin control preventivo',
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
              3, 'Control visual de la distancia al techo en el recorrido de turno', 8),
          ]),
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
    we('Maquina', 'Autoelevador del deposito', [
      funcion(
        'Mover la materia prima sin danarla y sin generar riesgo',
        'Autoelevador en condiciones de uso, con check list previo',
        [
          falla('Autoelevador operado sin el check list previo o con una falla no detectada', EF_SEG_OPERARIO, [
            causa('El check list no esta disponible en el puesto y el equipo arranca igual sin completarlo',
              'Check list de autoelevador definido',
              3, 'Verificacion del check list firmado al inicio de turno', 8),
            causa('Falta de mantenimiento preventivo del autoelevador',
              'Plan de mantenimiento preventivo del equipo',
              3, 'Control del estado del equipo en el check list de inicio de turno', 8),
          ]),
          falla('Dano de la caja que contiene la materia prima durante el movimiento', EF_SCRAP_INTERNO, [
            causa('El ancho de pasillo y la altura de carga no dejan margen para maniobrar con la carga a la vista',
              'Carteleria de circulacion en el deposito',
              3, 'Control visual del estado de las cajas al recibirlas en el sector', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 20 — CORTE DE VINILO O TELA  (incluye lo que el 127 abria como 20.1 a 20.5)
// ===========================================================================
// 23/09/2026 — la SC 1.6 (limite de corte del TEP en la zona de insercion de la platina, +2 / -0)
// estaba aca y se MUDO a la OP 91. El LSC v1 (pestaña ADDITIONAL INFORMATION) mide el corte
// contra el "limite de apoyabrazo inyectado": ese borde no existe en la mesa, donde el vinilo se
// corta plano. Lo corta el troquel sobre la pieza tapizada (HO 927, hoja 110.1: "al borde del
// plastico o con maximo 2 mm de sobrante, carac. plano 18B01"). Lo encontro la auditoria de
// cliente del 23/09/2026 y lo aprobo Fak el mismo dia.
// 22/09/2026 (tarde) — auditada contra la HO de mesa de corte (archivo "REV.F", cajetin Rev A,
// 13/05/2026: se cita como "HO mesa de corte" con su hoja), la ficha SET UP Mesa de corte Rev.G
// (29/04/2025, hoja VINILO) y el Plan de Control rev M, Operacion 20.2. La Rev.A citaba una
// planilla PE-MC-002 que sale de la HO 025, que esta en OBSOLETO y ademas es la de la MESA 2.
// Recupera los modos de falla que el AMFE 127 tenia y la Rev.A perdio: capas, largo de capa,
// lado vista, nylon, plato, corte incompleto y punzonado.
const OP20 = operacion('20', 'CORTE DE VINILO',
  'Cortar los componentes de vinilo segun el patron liberado de la pieza',
  'Componentes cortados dentro del patron, identificados y contados por bin',
  [
    we('Metodo', 'Patron y programa de corte', [
      funcion(
        'Cortar el contorno del patron liberado de la pieza',
        'Programa de corte de la revision liberada del patron',
        [
          // D=9: el programa equivocado se ve en la plantilla mylar, pero solo en la PRIMERA
          // pieza de la tizada (OP 21): no cubre el 100 % (P3-9).
          falla('Contorno del componente distinto del patron liberado', EF_SCRAP_INTERNO, [
            causa('El programa de corte cargado en la mesa no es el de la revision liberada del patron',
              'Codigo y nombre del programa verificados en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G, item 1 J)',
              4, 'Control de forma de la primera pieza contra la plantilla mylar (OP 21; HO mesa de corte, hoja 28)', 9),
          ]),
        ]),
      funcion(
        'Cortar el componente correcto, del material correcto y en la cantidad pedida',
        'Componente, material, lado vista, cantidad de capas y largo de capa segun la planilla de mesa de corte',
        [
          falla('Se corta un material distinto del que pide la planilla de corte', EF_SCRAP_INTERNO, [
            causa('Los rollos de vinilo de distintos granos y colores se parecen entre si en el deposito del sector',
              'Rollo identificado en la recepcion con su codigo de material (P-10/I)',
              6, 'Verificacion del codigo de material del rollo contra la planilla de corte, antes de montarlo (HO mesa de corte, hoja 20)', 8),
          ]),
          falla('Vinilo montado con el lado vista invertido', EF_SCRAP_INTERNO, [
            causa('El rollo entra en el portarrollos en los dos sentidos',
              'La planilla de corte indica como se coloca el rollo (HO mesa de corte, hoja 20)',
              4, 'Control visual de la posicion del lado vista contra la planilla de corte (HO mesa de corte, hoja 20)', 8),
          ]),
          falla('Cantidad de capas distinta de la de la planilla de corte', EF_SCRAP_INTERNO, [
            // La cantidad se carga en cada tizada; el control es de set up (inicio de turno,
            // mantenimiento, corte de energia, problema de calidad) -> no cubre cada tizada, P3-9.
            causa('La cantidad de capas se ingresa a mano en el panel en cada tizada',
              'Reset del contador de capas y cantidad segun la planilla de mesa de corte (HO mesa de corte, hoja 23)',
              4, 'Control visual de la cantidad de capas en el set up (SET UP Mesa de corte Rev.G, item 1 A; Plan de Control rev M, Operacion 20.2)', 9),
          ]),
          falla('Largo de capa distinto del de la planilla', EF_SCRAP_INTERNO, [
            causa('El largo de la capa se ingresa a mano en el panel',
              'Largo de tizada y demasia indicados en la planilla de mesa de corte (HO mesa de corte, hoja 23)',
              4, 'Medicion del largo con regla en la primera capa de cada tizada (HO mesa de corte, hoja 23)', 6),
          ]),
          falla('Se corta con una medida distinta de la del patron', EF_SCRAP_INTERNO, [
            // La medida NO se toma a mano: el patron entra como archivo en el programa Cutting
            // Control (HO mesa de corte, hoja 26) y la maquina rechaza los datos que exceden el
            // area de corte (manual YIN p.43, Y_UNDER / Y_OVER). La causa que queda es el
            // escalado del marker.
            causa('El marker se genera con una escala o una demasia distinta de la del patron liberado',
              'Archivo de corte de la pieza elegido en el programa Cutting Control (HO mesa de corte, hoja 26) y verificado por codigo y nombre en el set up (SET UP Mesa de corte Rev.G, item 1 J)',
              4, 'Control de forma contra la pieza patron, al inicio y al fin de turno (Plan de Control rev M, Operacion 20.2), y contra la plantilla mylar (OP 21)', 8),
          ]),
          falla('Se selecciona el archivo de corte equivocado', EF_SCRAP_INTERNO, [
            causa('Los archivos de corte de las distintas piezas conviven en la misma carpeta del programa',
              'Codigo y nombre del programa verificados en el set up (SET UP Mesa de corte Rev.G, item 1 J)',
              3, 'Control de forma de la primera pieza contra la plantilla mylar (OP 21)', 6),
          ]),
        ]),
    ]),
    // ---------------------------------------------------------------------
    // La mesa es una YIN HY-H/S con manual de fabrica (138 paginas) y dos hojas de operaciones
    // del SGC: HO MESA DE CORTE REV.F (13/05/2026) y HO 025 REV.2. La Rev.A de este AMFE se
    // escribio sin abrir ninguna de las tres, y por eso declaraba que NO existian cosas que la
    // maquina tiene y los documentos describen. Fak, 22/09/2026: "hay documentos de nuestras
    // mesas de corte... hay info para que agarres de varios lados para no poner TBD", y
    // "buscate los manuales de la maquina para entenderla".
    // ---------------------------------------------------------------------
    we('Maquina', 'Mesa de corte automatica YIN HY-H/S', [
      funcion(
        'Cortar con la calidad de filo y el seteo que pide el patron',
        'Cuchilla dentro de su medida de uso y cabezal referenciado a su origen',
        [
          falla('Corte imperfecto por cuchilla fuera de su medida de uso', EF_SCRAP_INTERNO, [
            // EL CRITERIO EXISTE Y ES NUMERICO. HO MESA DE CORTE REV.F hoja 25: "ANCHO DE
            // CUCHILLA (4 mm min.) - CON CALIBRE MC167 - OP - Antes de cada corte - Set up",
            // y el manual YIN p.52-53 dice lo mismo ("N series 7.8mm knife, grind to 4mm then
            // change"). El MC167 esta CALIBRADO (cronograma 2026 REV.7, fila 37: calibre
            // Vernier 150 mm WEMBLEY, 0,01 mm, aprobado). Ademas la maquina afila sola por
            // intervalo en metros (manual p.51, parametro 8).
            // D=6 y no 5 porque es galga sin R&R confirmado (Tabla P3: el 5 lo exige).
            causa('El ancho de cuchilla medido no se transcribe al parametro del programa',
              'Afilado automatico por intervalo en metros y criterio de cambio por ancho minimo (manual YIN, p.53), verificado en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G), item 1 G',
              4, 'Medicion del ancho de cuchilla con calibre MC167 calibrado, antes de cada corte (HO MESA DE CORTE REV.F, hoja 25)', 6),
          ]),
          falla('Cabezal fuera de su posicion de origen al arrancar el corte', EF_SCRAP_INTERNO, [
            // La maquina NO "permite arrancar en cualquier lado": tiene sensores de origen y
            // exige restaurar el origen mecanico + JOG despues de cada apagado o parada de
            // emergencia (manual YIN p.42-43, p.57). El alineado del cabezal se hace con el
            // laser rojo de la maquina (HO MESA DE CORTE REV.F, hoja 26).
            causa('Se omite la restauracion de origen despues de un corte de energia o una parada de emergencia',
              'Sensores de origen de la mesa y restauracion de origen obligatoria tras cada apagado (manual YIN, p.42)',
              4, 'Alineacion del cabezal con el laser rojo de la maquina antes de dar marcha (HO MESA DE CORTE REV.F, hoja 26)', 8),
          ]),
          falla('Vinilo mal alineado sobre la mesa de corte', EF_SCRAP_INTERNO, [
            // LA REFERENCIA EXISTE: son las lineas rojas marcadas al costado de la mesa, y hay
            // control visual antes de cada corte (HO MESA DE CORTE REV.F hoja 24; en la HO 025
            // la misma referencia es la "marca verde"). Encima la maquina chequea sola las
            // medidas del vinilo con sus sensores antes de cortar (hoja 27; manual p.53,
            // parametros 14 "Section checking" y 15 "Fabric width checking").
            causa('El vinilo se detiene antes o despues de la marca y queda fuera de escuadra',
              'Lineas rojas de tope al costado de la mesa, chequeo automatico de medidas por sensores, y control de apilado en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G), item 1 C',
              4, 'Verificacion visual del vinilo contra las marcas rojas, antes de cada corte (HO MESA DE CORTE REV.F, hoja 24)', 8),
          ]),
          falla('Corte con vacio insuficiente sobre el tendido', EF_SCRAP_INTERNO, [
            // El corte no arranca sin vacio (manual p.43) y el cabezal se bloquea solo contra
            // el arrastre del film (p.53, parametro 25). Lo que la maquina NO tiene es alarma
            // de CAIDA de vacio durante el corte: "Absorption low" figura como sintoma en la
            // tabla de fallas (p.75), no como aviso automatico. Esa es la causa real.
            causa('La succion cae durante el corte y la maquina no avisa: no hay alarma de vacio',
              'El corte no arranca hasta que el vacio esta activo (manual YIN, p.43)',
              5, 'Control del tendido y del despegue de la capa durante el corte', 8),
            // El 127 lo tenia ("nylon mal colocado") y la Rev.A lo perdio. HO mesa de corte,
            // hoja 26, paso 1: el nylon tiene que tapar TODA la zona de succion.
            causa('El nylon se extiende a mano y puede no tapar por completo la zona de succion',
              'Instruccion de cubrir todas las capas y la zona de succion con el nylon (HO mesa de corte, hoja 26)',
              4, 'Control del tendido y del despegue de la capa durante el corte', 8),
          ]),
          falla('Corte detenido a mitad de ciclo por baja presion de aire', EF_SCRAP_INTERNO, [
            // El presostato que corta el corte es lo que PRODUCE este modo de falla, no lo
            // previene: estaba escrito como prevencion. Lo que previene es que la mesa no
            // arranque por debajo de 0,5 MPa. Y la alarma es deteccion por maquina sin
            // verificacion periodica documentada: D=7, no 4 (el 4 exige verificar el
            // poka-yoke, P3).
            causa('La presion de la red cae por debajo de 0,35 MPa durante el corte',
              'La mesa exige 0,5 MPa para arrancar el corte (manual YIN, p.42)',
              3, 'Alarma en pantalla y zumbador de la mesa al caer la presion (manual YIN, p.44)', 7),
          ]),
          falla('Plato sin elevar al arrancar el corte', EF_SCRAP_INTERNO, [
            // El 127 lo tenia y la Rev.A lo perdio. HO mesa de corte, hoja 27, paso 3.
            causa('La elevacion del plato es un paso manual que se repite en cada corte',
              'Secuencia de arranque escrita en la hoja (HO mesa de corte, hoja 27)',
              4, 'Control visual de la posicion del cabezal y de la elevacion del plato antes de cada corte (HO mesa de corte, hoja 27)', 8),
          ]),
          falla('Pieza cortada incompleta o con sobrante en los agujeros', EF_SCRAP_INTERNO, [
            // Plan de Control rev M, Operacion 20.2, items 4 a 6: "que no quede incompleto",
            // "agujeros segun pieza patron", "punzonado de agujeros sin sobrante".
            causa('La cuchilla pierde filo entre dos afilados y deja zonas sin separar',
              'Afilado automatico de la cuchilla por intervalo en metros (manual YIN, p.51, parametro 8)',
              4, 'Control visual del corte completo y de los agujeros contra la pieza patron: 1 pieza al inicio y al fin de turno y autocontrol del operario por lote (Plan de Control rev M, Operacion 20.2)', 9),
          ]),
        ]),
    ]),
    we('Mano de Obra', 'Puesto de mesa de corte', [
      funcion(
        'Operar la mesa sin exponer al operario a las herramientas de corte',
        'EPP de corte disponible y protecciones de la mesa en su lugar',
        [
          falla('Exposicion del operario a un corte con la herramienta', EF_SEG_OPERARIO, [
            // Esto NO es un TBD: el documento que asigna EPP por puesto existe y la fila MESA
            // DE CORTE lleva ropa, protector auditivo, zapatos, barbijo y faja lumbar — la
            // columna de guantes esta VACIA (`SEGURIDAD\EPP SEGUN PUESTO DE TRABAJO.docx`), y
            // en la matriz de dotacion la columna "Guantes Calor-corte" esta en "-" para las
            // cinco personas de mesa de corte. O sea que el guante no esta asignado a este
            // puesto. Queda como diferencia para que la resuelvan Fak y Seguridad e Higiene.
            causa('El documento de EPP por puesto no le asigna guantes anticorte a la mesa de corte',
              'Verificacion de EPP en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G), item 7 A, contra la matriz de EPP por puesto',
              6, 'Control del uso de EPP en el set up y en el recorrido de turno', 9),
          ]),
          falla('Sobreesfuerzo al trasladar y cargar el rollo en la mesa', EF_SEG_OPERARIO, [
            // HO mesa de corte, hoja 20: el rollo se busca en el deposito y se lleva a la mesa
            // (paso 2), se ubica en la parte trasera (paso 3) y recien ahi el boton lo BAJA a la
            // posicion de trabajo (paso 4). O sea que el traslado y la carga son a mano; el
            // boton solo baja el rollo ya cargado. El 127 decia lo mismo: "se cargan
            // manualmente los rollos en el portarrollos".
            causa('El traslado del rollo y su carga en el portarrollos se hacen a mano, sin un medio mecanico declarado',
              'Faja lumbar asignada al puesto por la matriz de EPP',
              6, 'Control del metodo de traslado en el recorrido de turno', 9),
          ]),
        ]),
    ]),
    we('Medicion', 'Identificacion del bin de corte', [
      funcion(
        'Que del corte salga la cantidad correcta y correctamente identificada',
        'Bin identificado con la descripcion y la cantidad de la orden',
        [
          falla('Bin identificado con una descripcion o una cantidad que no corresponde a su contenido', EF_SCRAP_INTERNO, [
            causa('La etiqueta se completa a mano despues de cerrar el bin',
              'Etiqueta emitida con la orden de corte',
              3, 'Cotejo de la etiqueta contra el contenido al cerrar el bin', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 21 — CONTROL DE PRIMERA PIEZA CONTRA MYLAR
// ===========================================================================
// El control que faltaba entero, y el primero que Fak echo de menos: "corte de vinilo y luego
// no esta el control por mylar". Existe, esta documentado y es un puesto de control propio —
// por eso es una OPERACION del flujograma (la 21, con el numero de su sector) y no una linea
// perdida adentro del corte.
//
// HO mesa de corte (archivo REV.F, cajetin Rev A, 13/05/2026), hoja 28: plantilla codificada
// por referencia y material, banda de tolerancia +/-1 mm, y la NOTA CRITICA: "el control es
// bidireccional. La pieza no debe quedar ni mas grande ni mas chica que el area OK". Frecuencia:
// inicio de turno, mantenimiento, corte de energia, problema de calidad. El Plan de Control rev M
// (Operacion 20.2) agrega el control por pieza patron a inicio y fin de turno, con registro y a
// cargo del Operador de Calidad. (La HO 025 REV.2 que citaba la Rev.A esta en OBSOLETO.)
const OP21 = operacion('21', 'CONTROL DE PRIMERA PIEZA CONTRA MYLAR',
  'Liberar el corte contra la plantilla antes de seguir cortando el lote',
  'Contorno dentro del area OK de la plantilla, con banda de +/- 1 mm',
  [
    we('Medicion', 'Plantilla mylar de control', [
      funcion(
        'Verificar el contorno de la pieza cortada contra la plantilla de su referencia',
        'Control bidireccional: la pieza no puede quedar ni mas grande ni mas chica que el area OK',
        [
          falla('Se libera el lote contra una plantilla que no es la de esta pieza', EF_SCRAP_INTERNO, [
            causa('Las plantillas de las distintas referencias se parecen entre si',
              'Plantilla codificada por referencia y material (HO mesa de corte, hoja 28), y pieza patron y control de forma en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G, items 6 B a 6 D)',
              4, 'Cotejo de la identificacion de la plantilla contra la planilla de corte (HO mesa de corte, hoja 28)', 8),
          ]),
          falla('Pieza mas chica que el area OK que pasa como conforme', EF_SCRAP_INTERNO, [
            // Este es el modo de falla que la nota critica de la HO senala: el control es
            // bidireccional justamente porque la pieza chica "entra" en la plantilla y pasa.
            // La Rev.A citaba la HO 025 REV.2, que esta en OBSOLETO: la frecuencia vigente es la
            // de la hoja 28 (inicio de turno, mantenimiento, corte de energia, problema de
            // calidad), mas la pieza patron al inicio y al fin de turno del Plan de Control.
            causa('Una pieza mas chica entra dentro del contorno de la plantilla y parece conforme',
              'Banda de tolerancia marcada en la plantilla, con criterio bidireccional escrito en la hoja (HO mesa de corte, hoja 28)',
              4, 'Verificacion del contorno contra el area OK de la plantilla al inicio de turno y despues de mantenimiento, corte de energia o problema de calidad (HO mesa de corte, hoja 28)', 6),
          ]),
        ]),
    ]),
    we('Metodo', 'Liberacion del lote', [
      funcion(
        'Que el lote no avance hasta que la primera pieza este liberada',
        'Primera pieza OK liberada por el inspector de calidad antes de producir',
        [
          falla('El lote sigue cortandose antes de liberar la primera pieza', EF_SCRAP_INTERNO, [
            causa('La mesa puede seguir cortando mientras se hace el control de la primera pieza',
              'Liberacion de la primera pieza OK por el inspector de calidad antes de producir (SET UP Mesa de corte Rev.G, items 3 B y 8)',
              5, 'Firma del inspector en la ficha de liberacion de inicio de produccion (SET UP Mesa de corte Rev.G)', 8),
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
          falla('Toma de refilado fuera de 6,5 -0,5 mm', EF_ASPECTO, [
            // La causa anterior decia "a mano alzada, sin plantilla". Es falsa: la HO 927 REV6
            // hoja 30 dice "Colocar pieza en pie de maquina usando la guia de referencia", la
            // maquina es una refiladora y el control es "Toma de refilado 6,5mm -0,5 mm /
            // Regla / OP / 1 / Set up". Hay guia, instrumento y criterio.
            causa('La guia del pie de maquina se corre al pasar piezas de distinto espesor',
              'Guia de referencia en el pie de la refiladora (HO 927 REV6, hoja 30)',
              4, 'Medicion de la toma de refilado con regla en el set up (HO 927 REV6, hoja 30)', 6),
          ]),
        ]),
    ]),
    we('Mano de Obra', 'Puesto de refilado', [
      funcion(
        'Trabajar el turno sin carga postural excesiva',
        'Puesto con silla ergonomica',
        [
          falla('Dolores lumbares del operario del puesto', EF_SALUD_CRONICA, [
            // "Adquisicion de sillas ergonomicas" es una ACCION planificada, no un control de
            // prevencion vigente: escrita como control, el documento decia que el riesgo ya
            // estaba cubierto. Y el mismo texto aparecia en dos operaciones con D=8 y D=10 -
            // el mismo control no puede tener dos detecciones.
            causa('El puesto no tiene silla ergonomica asignada',
              'Sin control preventivo',
              10,'Relevamiento de puestos y seguimiento por Seguridad e Higiene', 9),
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
          // Ni la HO ni el Plan de Control declaran un cotejo del CONO: lo que existe es el
          // control visual del hilo sobre la pieza, 1 pieza al inicio y al fin de turno (Plan de
          // Control rev M, Operacion 40). Un cambio de cono a mitad de turno no queda cubierto:
          // P3-9. OJO: la HO 927 hoja 40 dice "HILO UNION 040 / BX69 11527E color 823" y el Plan
          // de Control "hilo 40/3 color 191 o 0711"; el LSC v1 dice Nylon M40 negro. Informado.
          falla('Costura de union ejecutada con un hilo distinto del Nylon M40 negro', EF_PIEZA_DISTINTA, [
            causa('El hilo de union se cambia a mano cuando se termina el cono',
              'Hilo de union especificado en la hoja de operaciones de la pieza',
              4, 'Control visual del hilo sobre la pieza, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 40)', 9,
              sc('SC 2.6', 'cc/h')),
          ]),
        ]),
    ]),
    we('Maquina', 'Maquina de costura de union', [
      funcion(
        'Mantener la densidad de puntada, la tension y los atraques del seteo liberado',
        'Densidad de puntada, tension del hilo, atraques de 2 a 3 puntadas y aguja N 18 segun la hoja de operaciones',
        [
          falla('La puntada se achica respecto del seteo', EF_ASPECTO, [
            // La HO 40 no tiene control con calibre; el Plan de Control si, pero 1 pieza al
            // inicio y al fin de turno. La perilla se corre durante el turno -> P3-9.
            causa('El largo de puntada se ajusta con una perilla que no tiene traba',
              'Seteo verificado en el set up de la maquina',
              3, 'Control de puntada con calibre, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 40)', 9),
          ]),
          // Los tres que siguen los controlan la HO 927 hoja 40 y el Plan de Control rev M
          // (Operacion 40, items 2 a 6 y 9) y la Rev.A no los tenia.
          falla('Costura floja o salteada', EF_COSTURA, [
            causa('La tension del hilo se regula en la maquina y se corre durante el turno',
              'Tension del hilo verificada en el set up de inicio de turno (HO 927 REV6, hoja 40)',
              4, 'Control visual de costura floja o salteada contra muestra patron: 1 pieza al inicio y al fin de turno por el operador de calidad y autocontrol del operario por lote (Plan de Control rev M, Operacion 40), y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
          falla('Atraque inicial o final faltante o fuera de 2 a 3 puntadas', EF_COSTURA, [
            causa('El atraque se hace a mano al principio y al final de cada costura',
              'Atraque de 2 a 3 puntadas especificado en la hoja (HO 927 REV6, hoja 40)',
              4, 'Autocontrol visual de los atraques en cada pieza, con sello del legajo (HO 927 REV6, hoja 40)', 8),
          ]),
          falla('Costura hecha con una aguja distinta de la especificada', EF_ASPECTO, [
            causa('La aguja se cambia a mano cuando se rompe',
              'Aguja especificada en la hoja de operaciones',
              3, 'Control visual de la aguja, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 40)', 9),
          ]),
          falla('Las puntadas se achican al pasar por la curva', EF_ASPECTO, [
            causa('El radio de la curva del patron obliga a reducir el avance en esa zona',
              'Sin control preventivo',
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
            // HO 927 hoja 40: piquetes y referencias, "Inicio de turno / Cambio de lote". La
            // Rev.A decia "al arrancar cada pieza", que no lo dice ningun documento. La guia se
            // corre entre piezas y el control es por set up -> P3-9.
            causa('La guia de la maquina es regulable y no queda fijada entre piezas',
              'Guia de referencia en el pie de la maquina (HO 927 REV6, hoja 40)',
              3, 'Control visual de piquetes y referencias al inicio de turno y en cada cambio de lote (HO 927 REV6, hoja 40)', 9),
          ]),
          falla('Desvio de la linea de costura de union', EF_ASPECTO, [
            causa('El tramo recto de la costura no tiene apoyo lateral en toda su longitud',
              'Guia de referencia en el pie de la maquina (HO 927 REV6, hoja 40)',
              3, 'Control visual de la costura contra la muestra patron: 1 pieza al inicio y al fin de turno y autocontrol del operario por lote (Plan de Control rev M, Operacion 40), y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Puesto de costura de union', [
      funcion(
        'Trabajar el turno sin riesgo para la salud del operario',
        'Iluminacion, ruido, proteccion de aguja y puesto segun Ley 19587',
        [
          falla('Tendinitis o dolor articular en el brazo del operario', EF_SALUD_CRONICA, [
            causa('El ciclo del puesto es repetitivo y no hay rotacion ni pausa activa definidas',
              'Sin control preventivo',
              10, 'Seguimiento de Seguridad e Higiene y del servicio medico', 8),
          ]),
          falla('Herida del operario con la aguja de la maquina', EF_SEG_OPERARIO, [
            causa('No todas las maquinas del puesto tienen la proteccion de aguja montada',
              'Algunas maquinas ya tienen proteccion ante rotura de aguja',
              8, 'Control del estado de las protecciones en el recorrido de turno', 8),
          ]),
          falla('Tension en el brazo por el borde de la mesa', EF_SALUD_CRONICA, [
            causa('Las puntas del borde de la mesa del puesto no estan redondeadas',
              'Algunas mesas ya tienen las puntas redondeadas',
              8, 'Relevamiento de las mesas del sector', 8),
          ]),
          falla('Perdida de audicion del operario', EF_SALUD_CRONICA, [
            causa('El nivel de ruido del sector supera el limite sin proteccion auditiva',
              'Protectores auditivos como EPP del puesto',
              3, 'Medicion con decibelimetro y control del uso de EPP', 8),
          ]),
          falla('Dolores lumbares del operario del puesto', EF_SALUD_CRONICA, [
            causa('El puesto no tiene silla ergonomica asignada',
              'Sin control preventivo',
              10,'Relevamiento de puestos y seguimiento por Seguridad e Higiene', 9),
          ]),
          falla('Iluminacion del puesto por debajo del nivel requerido', EF_ASPECTO, [
            causa('La luminaria del puesto no esta en el plan de mantenimiento preventivo',
              'Iluminacion en el sector y en la maquina de costura',
              5, 'Medicion con luxometro segun el plan de mediciones', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 50 — COSTURA VISTA, PESPUNTE SIMPLE DE UNA LINEA.
// Es LA operacion que cambia el ECR-0368291, y donde viven SC 2.1 a 2.5.
// ===========================================================================
const OP50 = operacion('41', 'COSTURA VISTA - PESPUNTE SIMPLE, UNA LINEA',
  'Ejecutar la costura vista del apoyabrazos con pespunte simple de una sola linea',
  'Costura vista de una linea, a 4 +0 / -1 mm de la linea de union, con 10 a 11 puntos cada 50 mm, en hilo naranja Linhanyl BX138',
  [
    we('Metodo', 'Tipo y cantidad de costura vista', [
      funcion(
        'Ejecutar la costura vista con el tipo de puntada y la cantidad de lineas que designo el cliente',
        'SC 2.1: pespunte simple HAQ (rebatida / seam deck).  SC 2.2: 1 sola linea de costura',
        [
          // Las dos filas que siguen son causas de SET UP (se eligen al arrancar el lote), asi
          // que el control de primera pieza SI las ve. Pero es visual y humano: D=8 (P3 oficial,
          // SETEC pag. 110: inspeccion humana con metodo no probado).
          // La hoja de operaciones propia de la pieza nueva va como control ACTUAL: Fak, 23/09/2026,
          // "la costura va a existir, podes poner la hoja de proceso porque si o si va a estar...
          // no hables en futuro". La HO la emite Ingenieria para el arranque de la pieza.
          falla('Costura vista ejecutada con un tipo de puntada distinto del pespunte simple HAQ', EF_PIEZA_DISTINTA, [
            causa('El puesto produce tambien las versiones anteriores del P21 y el seteo de la maquina se comparte',
              'Hoja de operaciones propia de la pieza nueva, separada de la de las versiones anteriores',
              4, 'Cotejo de la primera pieza del lote contra la muestra patron de la pieza nueva', 8,
              sc('SC 2.1', 'cc/h')),
          ]),
          falla('Costura vista ejecutada con dos lineas en lugar de una sola', EF_PIEZA_DISTINTA, [
            // El sector cose tambien la version de dos lineas paralelas (Plan de Control rev M,
            // Operacion 50: "paralelismo entre las vistas", "distancia entre costura de 3,5 mm").
            causa('En el mismo sector se cosen versiones del P21 con dos lineas de costura vista',
              'Hoja de operaciones propia de la pieza nueva, con el tipo de puntada y la cantidad de lineas',
              4, 'Cotejo de la primera pieza del lote contra la muestra patron de la pieza nueva', 8,
              sc('SC 2.2', 'cc/h')),
          ]),
        ]),
    ]),
    we('Metodo', 'Posicion y densidad de la costura vista', [
      funcion(
        'Dejar la linea de costura en la posicion y con la densidad que designo el cliente',
        'SC 2.3: 4 +0 / -1 mm por arriba de la linea de union de vinilos.  SC 2.4: 10 a 11 puntos cada 50 mm',
        [
          // La medicion con calibre de la distancia a la union es 1 pieza al inicio y al fin de
          // turno (Plan de Control rev M, "Operacion 40 (Solo Hilo Verde)", item 7). La guia se
          // corre DURANTE el turno: el control no cubre cada pieza -> P3-9.
          falla('Linea de costura vista fuera de 4 +0 / -1 mm por arriba de la linea de union de vinilo', EF_PIEZA_DISTINTA, [
            causa('La guia del pie de la maquina es regulable y no queda fijada entre lotes',
              'Guia de referencia en el pie de la maquina (HO 927 REV6, hoja 50)',
              5, 'Medicion con calibre de la distancia a la linea de union, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 40)', 9,
              sc('SC 2.3', 'cc/h')),
          ]),
          // La HO 927 hoja 50 pone el conteo con calibre como PASO de la operacion ("Controlar
          // con calibre 10 puntadas cada 50 mm"): se hace en cada pieza. Por eso D=6 (galga al
          // 100 %, sin R&R) y no 9.
          falla('Cantidad de puntos fuera de 10 a 11 cada 50 mm', EF_PIEZA_DISTINTA, [
            causa('El largo de puntada se ajusta con una perilla sin traba y se corre con la vibracion',
              'Largo de puntada seteado y verificado en el set up de la maquina',
              5, 'Conteo de puntos con calibre en cada pieza, como paso de la operacion (HO 927 REV6, hoja 50)', 6,
              sc('SC 2.4', 'cc/h')),
            causa('El avance se reduce al pasar por la curva del contorno',
              'Sin control preventivo',
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
          // Ni la HO ni el Plan de Control declaran un cotejo del cono: lo que existe es el
          // control visual del hilo sobre la pieza, 1 pieza al inicio y al fin de turno. Un
          // cambio de cono a mitad de turno no queda cubierto -> P3-9 (la Rev.A decia D=4).
          falla('Costura vista ejecutada con un hilo distinto del Linhanyl BX138 naranja', EF_PIEZA_DISTINTA, [
            causa('El hilo vista se cambia a mano cuando se termina el cono',
              'Hilo vista especificado en la hoja de operaciones de la pieza',
              4, 'Control visual del hilo sobre la pieza contra la muestra patron, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 50)', 9,
              sc('SC 2.5', 'cc/h')),
          ]),
        ]),
    ]),
    we('Maquina', 'Maquina de costura vista', [
      funcion(
        'Mantener la tension, los atraques y la toma de costura del seteo liberado',
        'Tension del hilo, atraques de 2 a 3 puntadas, aguja N 22 y toma de costura de 8 +/- 1 mm segun la hoja de operaciones',
        [
          falla('Costura vista floja o salteada', EF_COSTURA, [
            causa('La tension del hilo se regula en la maquina y se corre durante el turno',
              'Tension del hilo verificada en el set up de inicio de turno (HO 927 REV6, hoja 50)',
              4, 'Control visual de costura floja o salteada contra muestra patron: 1 pieza al inicio y al fin de turno por el operador de calidad y autocontrol del operario por lote (Plan de Control rev M, Operacion 50), y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
          falla('Atraque inicial o final faltante o fuera de 2 a 3 puntadas', EF_COSTURA, [
            causa('El atraque se hace a mano al principio y al final de cada costura',
              'Atraque de 2 a 3 puntadas especificado en la hoja (HO 927 REV6, hoja 50)',
              4, 'Control visual del atraque contra muestra patron y autocontrol del operario por lote (Plan de Control rev M, Operacion 40)', 9),
          ]),
          // La Rev.A tenia dos filas identicas, "por encima" y "por debajo" de 8 mm, con la
          // misma causa y los mismos controles. Es un solo modo de falla: fuera de 8 +/- 1.
          falla('Toma de costura fuera de 8 +/- 1 mm', EF_ASPECTO, [
            causa('La guia del puesto admite apoyar la pieza en mas de una posicion',
              'Guia de referencia en el pie de la maquina (HO 927 REV6, hoja 50)',
              3, 'Medicion con calibre, 1 pieza al inicio y al fin de turno (Plan de Control rev M, Operacion 40)', 9),
          ]),
          falla('Desvio de la linea de costura vista respecto del contorno', EF_ASPECTO, [
            causa('El tramo curvo no tiene apoyo lateral en toda su longitud',
              'Guia de referencia en el pie de la maquina (HO 927 REV6, hoja 50)',
              3, 'Control visual de la costura contra la muestra patron: 1 pieza al inicio y al fin de turno y autocontrol del operario por lote (Plan de Control rev M, Operacion 50), y con plantilla de alineacion al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
        ]),
    ]),
    we('Medio Ambiente', 'Puesto de costura vista', [
      funcion(
        'Trabajar el turno sin riesgo para la salud del operario',
        'Iluminacion, ruido, proteccion de aguja y puesto segun Ley 19587',
        [
          falla('Tendinitis o dolor articular en el brazo del operario', EF_SALUD_CRONICA, [
            causa('El ciclo del puesto es repetitivo y no hay rotacion ni pausa activa definidas',
              'Sin control preventivo',
              10, 'Seguimiento de Seguridad e Higiene y del servicio medico', 8),
          ]),
          falla('Herida del operario con la aguja de la maquina', EF_SEG_OPERARIO, [
            causa('No todas las maquinas del puesto tienen la proteccion de aguja montada',
              'Algunas maquinas ya tienen proteccion ante rotura de aguja',
              8, 'Control del estado de las protecciones en el recorrido de turno', 8),
          ]),
          falla('Tension en el brazo por el borde de la mesa', EF_SALUD_CRONICA, [
            causa('Las puntas del borde de la mesa del puesto no estan redondeadas',
              'Algunas mesas ya tienen las puntas redondeadas',
              8, 'Relevamiento de las mesas del sector', 8),
          ]),
          falla('Perdida de audicion del operario', EF_SALUD_CRONICA, [
            causa('El nivel de ruido del sector supera el limite sin proteccion auditiva',
              'Protectores auditivos como EPP del puesto',
              3, 'Medicion con decibelimetro y control del uso de EPP', 8),
          ]),
          // El AMFE 127 lo tiene en la costura vista y la Rev.A solo lo habia dejado en la de union.
          falla('Dolores lumbares del operario del puesto', EF_SALUD_CRONICA, [
            causa('El puesto no tiene silla ergonomica asignada',
              'Sin control preventivo',
              10, 'Relevamiento de puestos y seguimiento por Seguridad e Higiene', 9),
          ]),
          falla('Iluminacion del puesto por debajo del nivel requerido', EF_ASPECTO, [
            causa('La luminaria del puesto no esta en el plan de mantenimiento preventivo',
              'Iluminacion en el sector y en la maquina de costura',
              5, 'Medicion con luxometro segun el plan de mediciones', 9),
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
    // Una limpieza mala no se ve en esta operacion: se ve cuando el vinilo se despega. Por eso
    // todo este bloque va al efecto de despegue (S=7) y no a aspecto ni a scrap interno.
    we('Material', 'Producto de limpieza del sustrato', [
      funcion(
        'Limpiar el sustrato con el producto que define el proceso',
        'Alcohol isopropilico, segun la hoja de operaciones',
        [
          falla('Limpieza realizada con un producto distinto del especificado', EF_DESPEGUE, [
            // La Rev.A declaraba un "control del envase al inicio de turno" que ningun
            // documento tiene. Lo que hay es la especificacion en la hoja.
            causa('En el puesto puede haber mas de un producto de limpieza',
              'Alcohol isopropilico especificado en la hoja (HO 927 REV6, hoja 60)',
              4, 'Sin control especifico del producto en el puesto', 10),
          ]),
        ]),
    ]),
    we('Metodo', 'Limpieza y secado', [
      funcion(
        'Eliminar los contaminantes de toda la superficie y respetar el secado antes del primer',
        'Superficie sin aureolas una vez evaporado el alcohol; secado de 5 minutos (Plan de Control rev M, Operacion 60)',
        [
          // El unico control que declaran la HO 927 (hoja 60) y el Plan de Control rev M
          // (Operacion 60), y el unico modo de falla que la Rev.A perdio de esta operacion.
          falla('Pieza con aureolas despues de evaporado el alcohol', EF_DESPEGUE, [
            causa('El alcohol se aplica con pincel y se frota a mano sobre toda la superficie',
              'Limpieza de toda la superficie con pincel limpio y alcohol isopropilico hasta eliminar los contaminantes (HO 927 REV6, hoja 60)',
              4, 'Control visual de aureolas por el operario, por lote (HO 927 REV6, hoja 60; Plan de Control rev M, Operacion 60)', 9),
          ]),
          // Las dos filas de tiempo: la prevencion es TBD, asi que O=10 (P2: "no hay controles
          // preventivos"), y la deteccion NO existe -la causa lo dice- asi que D=10. La Rev.A
          // tenia O=4 y un "control del tiempo transcurrido" que su propia causa negaba.
          falla('Pieza pasada al primer con menos de 5 minutos de secado', EF_DESPEGUE, [
            causa('El puesto no tiene un medio para saber cuando cada pieza cumplio su tiempo',
              'Sin control preventivo',
              10, 'Sin control del tiempo de secado en el puesto', 10),
          ]),
          falla('Pieza limpia que espera demasiado antes del primer', EF_DESPEGUE, [
            causa('No hay un limite superior de espera definido',
              'Sin control preventivo',
              10, 'Sin control del tiempo de espera en el puesto', 10),
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
const OP70 = operacion('61', 'APLICACION DE PRIMER',
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
          // La Rev.A decia en la causa que el envase NO se coteja, y en la deteccion que SI: la
          // fila se negaba sola. El control existe desde el reclamo (Plan de Control rev M,
          // Operacion 60: "verificar la fecha de vencimiento del primer componente A y/o B antes
          // de utilizarlo", inicio y fin de turno). Lo que puede fallar es que el vencido este.
          falla('Primer aplicado despues de su fecha de vencimiento', EF_DESPEGUE, [
            causa('Quedan en el puesto envases de primer de mas de un lote, con fechas de vencimiento distintas',
              'Control de vencimiento del primer en la recepcion del material (P-10/I)',
              4, 'Verificacion de la fecha de vencimiento de los componentes A y B contra la identificacion del envase, al inicio y al fin de turno (Plan de Control rev M, Operacion 60)', 8),
          ]),
          falla('Mezcla de primer fuera de la proporcion de los componentes A y B', EF_DESPEGUE, [
            // La Rev.A declaraba un "registro de preparacion con hora" que ningun documento
            // tiene. Lo que hay: vasos dosificadores con marca (IO-07, Plan de Control 60.1).
            causa('Los componentes se vierten a mano en los vasos dosificadores',
              'Vasos dosificadores con la marca de llenado de cada componente (IO-07; Plan de Control rev M, Operacion 60.1)',
              4, 'Control visual del llenado de los vasos hasta la marca, en cada preparacion (Plan de Control rev M, Operacion 60.1)', 8),
          ]),
          // Vida util: la HO 927 hoja 70 y el IO-07 dicen 8 h; el Plan de Control rev M dice
          // 9 h. Se cita la hoja (la de planta) y la diferencia queda informada a Calidad.
          falla('Mezcla de primer usada despues del fin de su vida util', EF_DESPEGUE, [
            causa('La mezcla preparada no lleva la hora de preparacion a la vista',
              'Una mezcla nueva por turno, que no debe durar mas de 8 h abierta (HO 927 REV6, hoja 70; IO-07)',
              4, 'Sin registro de la hora de preparacion de la mezcla', 10),
          ]),
        ]),
    ]),
    // El otro modo de falla del AMFE 127 que la Rev.A habia perdido. El IO-19 pide cubrir la
    // cara superior, la cara lateral, los ojales y las esquinas: una aplicacion incompleta deja
    // zonas sin adherencia y el vinilo se despega despues del horno.
    we('Metodo', 'Aplicacion del primer con pincel', [
      funcion(
        'Cubrir toda la superficie que despues recibe el adhesivo, sin exceso',
        'Cara superior, cara lateral, ojales y esquinas cubiertos segun IO-19; secado de 3 a 5 minutos; pieza identificada con la hora del primer (HO 927 REV6, hoja 70)',
        [
          // La Rev.A decia "el primer es transparente y no se distingue a simple vista": no lo
          // respalda ningun documento, y ademas negaba el control visual que venia al lado.
          falla('Primer aplicado en forma incompleta sobre el sustrato', EF_DESPEGUE, [
            causa('La aplicacion es manual, con pincel, sobre cuatro zonas distintas de la pieza',
              'Instructivo IO-19 con las zonas a cubrir, en el puesto',
              5, 'Control visual de la pieza con primer, autocontrol del operario por lote (Plan de Control rev M, Operacion 70)', 9),
          ]),
          // Defecto que ya ocurrio: exceso de primer en cara no vista, con 8D (noviembre 2025).
          falla('Primer aplicado en exceso o fuera de la cara a tratar', EF_ASPECTO, [
            causa('La cantidad de primer que carga el pincel depende del operario en cada pasada',
              'Aplicacion sobre la cara superior de la pieza (HO 927 REV6, hoja 70; IO-19)',
              5, 'Control visual de la pieza con primer, autocontrol del operario por lote (Plan de Control rev M, Operacion 70)', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 80 — ADHESIVADO DE PIEZA PLASTICA Y VINILO
// ===========================================================================
const OP80 = operacion('70', 'ADHESIVADO DE PIEZA PLASTICA Y VINILO',
  'Aplicar adhesivo sobre el sustrato y el vinilo antes del tapizado',
  'Adhesivo aplicado en la zona y la cantidad que define el proceso, con el sector ventilado',
  [
    // 22/09/2026 (tarde) — la Rev.A tenia UN modo de falla de adhesivado y el AMFE 127 seis. Se
    // recuperan contra el Plan de Control rev M (Operacion 80, items 1 a 5) y la HO 927 (hojas 70,
    // 80.1 y 80.2): adhesivo incorrecto, mezcla 1:1 y su vida util, las 48 h desde el primer y el
    // exceso que mancha la cara vista. La "ayuda visual de la zona" que declaraba la Rev.A no
    // esta en ningun documento: se cita lo que la hoja dice.
    we('Material', 'Adhesivo FA con reticulante GV', [
      funcion(
        'Usar el adhesivo especificado, mezclado 1:1 y dentro de su vida util',
        'Adhesivo FA con reticulante GV, relacion 1:1, vida util de la mezcla de dos turnos (HO 927 REV6, hoja 80.1; Plan de Control rev M, Operacion 80)',
        [
          falla('Adhesivo o reticulante distinto del especificado', EF_DESPEGUE, [
            causa('El adhesivo y el reticulante se cargan a mano en el tanque',
              'Adhesivo FA y reticulante GV especificados en la hoja (HO 927 REV6, hoja 80.1)',
              3, 'Control visual del adhesivo correcto, 1 muestra al inicio de turno, con registro, por el operador de calidad (Plan de Control rev M, Operacion 80)', 9),
          ]),
          falla('Mezcla de adhesivo fuera de la relacion 1:1 o usada despues de dos turnos', EF_DESPEGUE, [
            causa('La lata de 18 l y la botella de 600 g se mezclan a mano en el tanque',
              'Relacion 1:1 y vida util de dos turnos escritas en la hoja (HO 927 REV6, hoja 80.1)',
              4, 'Control visual de la mezcla, 1 muestra al inicio de turno, con registro (Plan de Control rev M, Operacion 80)', 9),
          ]),
        ]),
    ]),
    we('Metodo', 'Aplicacion del adhesivo', [
      funcion(
        'Aplicar el adhesivo en forma uniforme, sin exceso, dentro de las 48 h del primer',
        'Colocado uniforme sobre la cara externa de la pieza plastica (HO 927 REV6, hojas 80.1 y 80.2); adhesivado dentro de las 48 h de aplicado el primer (HO 927 REV6, hoja 70)',
        [
          falla('Adhesivo aplicado en cantidad insuficiente o con zonas sin cubrir', EF_DESPEGUE, [
            causa('El adhesivo se rocia con pistola manual y la cobertura depende del recorrido',
              'Colocado uniforme sobre la cara externa de la pieza, segun la hoja (HO 927 REV6, hojas 80.1 y 80.2)',
              4, 'Control visual del colocado uniforme en la OP 71', 8),
          ]),
          falla('Exceso de adhesivo que mancha la cara vista', EF_ASPECTO, [
            causa('El adhesivo se rocia con pistola manual y la cantidad depende del recorrido',
              'Colocado uniforme sobre la cara externa de la pieza, segun la hoja (HO 927 REV6, hojas 80.1 y 80.2)',
              4, 'Control visual de manchas de adhesivo en la cara vista contra pieza patron y biblia de defectos, en el horno (HO 927 REV6, hoja 90.1)', 8),
          ]),
          falla('Pieza con primer adhesivada despues de las 48 h', EF_DESPEGUE, [
            causa('Las piezas con primer esperan en estanteria hasta el adhesivado',
              'Etiqueta con la hora de aplicacion del primer en cada pieza (HO 927 REV6, hoja 70)',
              4, 'Control visual de la etiqueta de hora antes de adhesivar, autocontrol por lote (Plan de Control rev M, Operacion 80)', 9),
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
// OP 71 — CONTROL DE ADHESIVADO
// ===========================================================================
// Fak, 22/09/2026: "despues el control de adhesivado no lo pusiste". Existe y esta escrito:
// HO 927 REV6, hojas 80.1 y 80.2 — "Colocado de adhesivo en forma uniforme" y "Verificar que
// NO hayan grumos de adhesivo en la superficie", los dos visuales. Es tambien el punto donde se
// detectan los tres reprocesos conocidos de la pieza (limpieza, primer y adhesivo: OP 72 a 74).
//
// En la familia este control es un puesto propio: en el AMFE 153 es la OP 71 "INSPECCION DE
// PIEZA ADHESIVADA". Lo que NO existe en ningun documento, y por eso no se declara: control
// de caudal, de peso, de espesor o de temperatura del adhesivo, y ninguna alarma. Todo el
// control de esta operacion es visual mas el limite de tiempo.
const OP71 = operacion('71', 'CONTROL DE ADHESIVADO',
  'Verificar la pieza adhesivada antes de mandarla al horno',
  'Adhesivo uniforme, sin grumos y dentro de su ventana de tiempo',
  [
    we('Medicion', 'Control visual de la pieza adhesivada', [
      funcion(
        'Verificar que el adhesivo cubrio la superficie de manera uniforme',
        'Sin zonas sin adhesivo y sin grumos en la superficie',
        [
          // La Rev.A decia "el adhesivo es transparente y no se distingue a simple vista" (sin
          // fuente) y al lado declaraba un control visual: se negaba sola. La causa real es que
          // la cobertura se juzga a ojo sin una referencia de la zona. La frecuencia: la HO dice
          // "1 / set up" y el Plan de Control agrega el autocontrol del operario por lote.
          falla('Pieza con falta de adhesivo que pasa el control', EF_DESPEGUE, [
            causa('La cobertura del adhesivo se juzga a ojo, sin una referencia de la zona que debe quedar cubierta',
              'Colocado uniforme sobre la cara externa de la pieza, segun la hoja (HO 927 REV6, hojas 80.1 y 80.2)',
              5, 'Control visual del colocado uniforme: primera pieza en el set up (HO 927 REV6, hojas 80.1 y 80.2) y autocontrol del operario por lote (Plan de Control rev M, Operacion 80)', 9),
          ]),
          // La vida util del tanque no es lo que el Plan de Control da como causa de los grumos:
          // es la acumulacion en el sistema, y la prevencion es la limpieza IO-15 de cada turno.
          falla('Pieza con grumos de adhesivo en la superficie', EF_ASPECTO, [
            causa('El adhesivo se acumula en el sistema de aplicacion y forma grumos',
              'Limpieza del sistema de adhesivado segun IO-15 al finalizar cada turno (Plan de Control rev M, Operacion 80, item 5)',
              4, 'Control visual de grumos en la superficie (HO 927 REV6, hojas 80.1 y 80.2)', 8),
          ]),
          // "Control del tiempo de espera" no lo dice ningun documento: la hoja pone el limite
          // de 24 h y el scrap, pero la pieza adhesivada no lleva su hora. Sin deteccion: D=10.
          falla('Pieza adhesivada que se usa fuera de su ventana de 24 h', EF_DESPEGUE, [
            causa('La pieza adhesivada queda en la estanteria sin su hora de adhesivado a la vista',
              'Limite de 24 horas escrito en la hoja, con scrap del producto que lo supera (HO 927 REV6, hojas 80.1 y 80.2)',
              4, 'Sin registro de la hora de adhesivado en la pieza', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 72, 73 y 74 — LOS REPROCESOS DEL ADHESIVADO
// ===========================================================================
// Fak, 22/09/2026: "busca vos mismo los retrabajos conocidos, hicimos durante mucho tiempo
// esta pieza". Son los tres que tienen METODO ESCRITO para el P21, y los tres cuelgan del
// control de adhesivado (OP 71), que es donde la hoja los detecta:
//   - Hojas "Ret- Limpieza" (50-1), "Ret- primer" (50-1) y "Ret- adhesivo" (60-1) de la
//     HO APB Rev 14 (27/04/2022, P21 tela y cuero; existen desde la Rev 3 de 2019), seccion
//     ADHESIVADO. Cada una: "colocar la pieza plastica nuevamente para aplicar [alcohol /
//     primer / adhesivo] en la zona faltante".
//   - AMFE unificado B7-T73A-T7X-T71A-P21 REV09 (15/03/2021), OP 150: "retrabajo de pieza
//     permitido (re limpiar la pieza / re adhesivar / primer la superficie) y llevar la pieza
//     al lugar donde se origino el defecto".
//   - Plan de Control rev M (15/02/2024), Operacion 80.1: "RETRABAJO - colocar adhesivo en
//     zonas donde falte".
//   - Plan de Control del P21 rev H (08/10/2024, PPAP Final\7- Control plan), fila 99:
//     "Retrabajo permitido sobre la aplicacion incorrecta del primer".
//   - El de limpieza solo esta en la HO APB Rev 14 y en el AMFE unificado: no paso a la HO 927
//     (2023 en adelante) ni se dio de baja por escrito. Queda dibujado y avisado.
// POR QUE VAN EN EL AMFE Y NO SOLO EN EL FLUJOGRAMA: IATF 16949 §8.7.1.4. Barack ya tuvo una NC
// menor por esto en esta linea (auditoria externa del 28/06/2019: "reworking process without
// work instruction nor FMEA analysis").
// Lo que NO se retrabaja: el tapizado ("no se debe retirar la tela/vinilo luego de colocada").
const reproceso = (numero, nombre, funcionOp, requisito, fallas) => operacion(numero, nombre,
  funcionOp, requisito, [we('Metodo', 'Reproceso manual en el sector de adhesivado', [
    funcion(funcionOp, requisito, fallas),
  ])]);

const OP72 = reproceso('72', 'REPROCESO: LIMPIEZA DEFICIENTE',
  'Volver a limpiar con alcohol la superficie de la pieza plastica indicada',
  'Superficie limpia, sin aureolas',
  [
    falla('Zona reprocesada que sigue con contaminantes', EF_DESPEGUE, [
      causa('El alcohol se aplica solo sobre la zona senalada y el limite de la zona se juzga a ojo',
        'Hoja de reproceso con fotos de referencia (HO APB Rev 14, hoja Ret- Limpieza)',
        4, 'Reverificacion en la OP 71: control visual del colocado uniforme', 8),
    ]),
  ]);

const OP73 = reproceso('73', 'REPROCESO: FALTA DE PRIMER',
  'Reponer primer en la zona de la pieza plastica donde falto',
  'Zona faltante cubierta con primer segun IO-19',
  [
    falla('Zona sin primer que queda sin cubrir despues del reproceso', EF_DESPEGUE, [
      causa('El primer se repone a mano solo en la zona faltante',
        'Retrabajo permitido sobre la aplicacion incorrecta del primer (Plan de Control P21 rev H), con hoja de reproceso y fotos de referencia (HO APB Rev 14, hoja Ret- primer)',
        4, 'Reverificacion en la OP 71: control visual del colocado uniforme', 8),
    ]),
  ]);

const OP74 = reproceso('74', 'REPROCESO: FALTA DE ADHESIVO',
  'Reponer adhesivo en la zona de la pieza donde falto',
  'Adhesivo uniforme en la zona faltante, dentro de las 48 h del primer',
  [
    falla('Zona sin adhesivo que queda sin cubrir despues del reproceso', EF_DESPEGUE, [
      causa('El adhesivo se repone a mano solo en la zona donde falto',
        'Retrabajo permitido sobre la aplicacion incorrecta del adhesivo: colocar adhesivo en las zonas donde falte (Plan de Control rev M, Operacion 80.1)',
        4, 'Control visual, autocontrol por lote (Plan de Control rev M, Operacion 80.1), y reverificacion en la OP 71', 9),
    ]),
    falla('Exceso de adhesivo en la zona reprocesada que mancha la cara vista', EF_ASPECTO, [
      causa('La zona reprocesada recibe una segunda capa de adhesivo',
        'Retrabajo limitado a las zonas donde falte adhesivo (Plan de Control rev M, Operacion 80.1)',
        4, 'Control visual de manchas de adhesivo en la cara vista, en el horno (HO 927 REV6, hoja 90.1)', 8),
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
const OP90A = operacion('80', 'ACTIVADO DEL ADHESIVO EN HORNO',
  'Activar el adhesivo de las dos partes antes del montaje',
  'Sustrato y vinilo dentro de la ventana de temperatura y de ciclo del horno',
  [
    we('Maquina', 'Horno de activado', [
      funcion(
        'Llevar el adhesivo a su temperatura de activado',
        'Temperatura de la pieza dentro de la ventana y ciclo completo',
        [
          // "Verificacion de la temperatura de la PIEZA" no la dice ningun documento: la HO 90.1
          // controla manchas y grumos, y la ficha de set up la temperatura del HORNO. Un adhesivo
          // mal activado se ve recien cuando el vinilo no pega: deteccion aguas abajo, D=8.
          falla('Adhesivo que sale del horno por debajo de su temperatura de activado', EF_DESPEGUE, [
            causa('El horno se habilita para trabajar antes de estabilizar su temperatura',
              'Horno calibrado a una temperatura de corte de 66 C, minimo de 55 C para la primera pieza y ciclo de 150 a 180 s (HO 927 REV6, hoja 90.1)',
              4, 'Control visual del pegado en el tapizado y en la inspeccion final', 8),
          ]),
          falla('Pieza sobrecalentada en el horno', EF_ASPECTO, [
            causa('La pieza queda en el horno mas alla del ciclo cuando el puesto siguiente esta ocupado',
              'Retiro de las piezas al completarse el ciclo del tapizado de la pieza anterior, entre 150 y 180 s (HO 927 REV6, hoja 90.1)',
              4, 'Control visual de vinilo quemado o marcado contra la biblia de defectos, en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
        ]),
    ]),
  ]);

const OP90 = operacion('81', 'TAPIZADO',
  'Montar la funda cosida sobre el sustrato adhesivado',
  'Funda montada sin arrugas, centrada y con la costura vista en su posicion',
  [
    we('Metodo', 'Montaje de la funda sobre el sustrato', [
      funcion(
        'Montar la funda centrada y sin arrugas',
        'Funda centrada sobre el sustrato, costura vista alineada con el contorno',
        [
          // 22/09/2026 (tarde) — la Rev.A decia "el sustrato se sostiene a mano, sin dispositivo"
          // y citaba una "ayuda visual del montaje" que no esta en ningun documento. Lo que dice
          // la HO 927 hoja 90.2 es la secuencia: espatula del centro a los bordes, presion con la
          // mano y correccion del viboreo en caliente. Y la O no puede ser 3: arrugas, pliegues
          // y hundimientos son los defectos que mas rechaza el residente de Barack en SMRC
          // (hundimiento 346, arrugas 182 piezas NOK en 2025-2026, planilla Calidad Cliente V7).
          falla('Pieza tapizada con arrugas, pliegues o hundimientos en zona vista', EF_ASPECTO, [
            causa('El vinilo caliente se estira y se acomoda a mano sobre las curvas del sustrato',
              'Secuencia de tapizado con espatula del centro hacia los bordes y correccion del viboreo en caliente (HO 927 REV6, hoja 90.2)',
              6, 'Control visual contra pieza patron y biblia de defectos: set up de primera pieza y registro de control de calidad (HO 927 REV6, hoja 90.2), y control al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
          // Defecto que YA le llego al cliente tres veces: QR 213667 (2021), QR 235682
          // (29/07/2025, "vinilo corto - mal refilado") y QR 236562 (10/2025, "vinilo corto").
          // La HO 90.2 lo exige ("tiene que llegar exactamente hasta los bordes") y el Plan de
          // Control rev M lo tiene en la Operacion 100 con el reclamo al lado. La Rev.A no lo
          // tenia en ninguna fila. Nace aca (vinilo que no se estira hasta el borde) o en el
          // refilado (OP 90, corte de mas).
          falla('Vinilo que no llega hasta el borde del sustrato', EF_ASPECTO, [
            causa('El vinilo no se estira hasta el borde en las curvas del sustrato',
              'Secuencia de tapizado con espatula del centro hacia los bordes para asegurar cobertura completa (HO 927 REV6, hoja 90.2)',
              6, 'Control visual del vinilo hasta el borde contra pieza patron y biblia de defectos, al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
          falla('Espuma del vinilo desgarrada', EF_ASPECTO, [
            causa('El vinilo se reacomoda en caliente sobre el sustrato despues de apoyado',
              'Correccion del viboreo en caliente segun la foto de la hoja (HO 927 REV6, hoja 90.2)',
              4, 'Control visual contra pieza patron y biblia de defectos, set up de primera pieza y registro de control (HO 927 REV6, hoja 90.2; Plan de Control rev M, Operacion 100)', 8),
          ]),
          // La Rev.A mandaba esto a la OP 82 con D=7, y la OP 82 es de primera pieza. Pero la
          // inspeccion final SI verifica la alineacion en todas las piezas, con plantilla (HO
          // 927 hoja 120: "plantilla de alineacion de costura", registro "control calidad
          // 100%"): plantilla = galga por atributo al 100 %, D=6.
          falla('Costura vista fuera de su alineacion sobre el radio del sustrato', EF_ASPECTO, [
            causa('La funda se acomoda a mano y el talon de costura se corre en la curva delantera',
              'Talon de costura apoyado sobre el radio superior del sustrato desde la curva delantera, segun las fotos de la hoja (HO 927 REV6, hoja 90.2)',
              5, 'Alineacion con regla mylar en la OP 82 y con plantilla de alineacion de costura al 100 % en la inspeccion final (HO 927 REV6, hojas 90.2 y 120)', 6),
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
// OP 82 — CONTROL DE ALINEACION DE COSTURA CON REGLA MYLAR
// ===========================================================================
// HO 927 REV6, hoja 90.2, celda L39: "Control visual y soporte pieza Patron + Biblia Defectos.
// Alineacion visual de costura utilizando regla Mylar de soporte". Responsable OP, frecuencia
// 1, registro "Set up 1° pieza OK + Registro control calidad". Entro en la REV.5 (31/10/2025):
// las REV.2 y REV.3 no lo tienen.
//
// Lo que verifica es la ALINEACION de la costura sobre el radio del sustrato despues del
// tapizado. NO es la SC 2.3 del cliente (posicion de la linea a 4 +0 / -1 mm de la union), que
// se fija y se mide en la costura vista (OP 41). La Rev.A las confundia y el flujograma le
// dibujaba <cc/h> a esta operacion sin ninguna causa con esa sigla detras: la marca se saca.
//
// Si la pieza da NO CONFORME va a SCRAP: re-tapizar esta prohibido. HO 927 REV.2, hoja 90.2:
// "No se debe retirar la tela/vinilo luego de colocada (para evitar desgarro de espuma)", y lo
// mismo la HO APB Rev 14, OP 100.
//
// La Rev.A tenia un segundo modo de falla, "el control se hace solo en la primera pieza", que
// describia la frecuencia y no una falla, y que ademas contradecia a la hoja 120: la
// alineacion se verifica en todas las piezas en la inspeccion final.
const OP82 = operacion('82', 'CONTROL DE ALINEACION DE COSTURA CON REGLA MYLAR',
  'Verificar la alineacion de la costura vista sobre la pieza tapizada',
  'Costura vista alineada segun la regla mylar, contra pieza patron y Biblia de Defectos',
  [
    we('Medicion', 'Regla mylar de alineacion de costura', [
      funcion(
        'Verificar que la costura vista quedo alineada despues del montaje',
        'Alineacion de la costura contra la regla mylar, en el set up de primera pieza con registro de control de calidad',
        [
          falla('Pieza con la costura desalineada que pasa el control', EF_ASPECTO, [
            causa('La regla se apoya a mano y su posicion sobre la pieza depende del operario',
              'Regla mylar de soporte en el puesto y pieza patron (HO 927 REV6, hoja 90.2)',
              4, 'Alineacion de la costura con regla mylar en el set up de primera pieza (HO 927 REV6, hoja 90.2) y con plantilla al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 6),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 100 — REFILADO CON MASCARA
// ===========================================================================
const OP100 = operacion('90', 'REFILADO CON MASCARA',
  'Refilar el sobrante de vinilo de la pieza tapizada usando la mascara',
  'Borde refilado al ras de la mascara, sin cortar el sustrato',
  [
    // 22/09/2026 (tarde) — la Rev.A tenia dos modos de falla y ninguno de los que el cliente
    // reclamo. Esta es la operacion de los reclamos de vinilo corto (QR 235682 "mal refilado",
    // QR 236562), cuya accion fue justamente la MASCARA (8D con SMRC, oct-nov 2025), y la de los
    // defectos que mas retrabaja el residente de Barack en SMRC: exceso de material (738 piezas)
    // y orificios obstruidos (519), planilla Calidad Cliente V7. La HO 927 hoja 100 (rev 6,
    // 27/01/2026) ya trae el metodo nuevo: cuter perpendicular con mascara, orificios libres,
    // zona de soldadura limpia y etiqueta de identificacion (IO-16).
    we('Metodo', 'Refilado con cuter y mascara', [
      funcion(
        'Refilar el sobrante al ras del sustrato siguiendo la mascara',
        'Vinilo hasta el borde superior del plastico, o separacion dentro del maximo de 4,5 mm; sin excedentes; 17 orificios libres; zona de soldadura sin restos (HO 927 REV6, hoja 100; Plan de Control rev M, Operaciones 100.2 y 120)',
        [
          falla('Vinilo refilado de mas, que no llega hasta el borde del sustrato', EF_ASPECTO, [
            causa('El cuter se inclina durante el recorrido y corta por dentro del borde',
              'Mascara de refilado y cuter perpendicular al plano de la pieza en todo el recorrido (HO 927 REV6, hoja 100)',
              5, 'Control visual del vinilo hasta el borde contra el limite maximo de separacion, y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
          falla('Exceso de material sin refilar en el contorno', EF_RETRABAJO_CLIENTE, [
            causa('El refilado se hace a mano con cuter y el sobrante se juzga a ojo contra la referencia',
              'Refilado segun contorno de referencia visual, con mascara y pieza patron (HO 927 REV6, hoja 100)',
              6, 'Control visual de excedentes contra pieza patron y biblia de defectos (HO 927 REV6, hoja 100) y al 100 % en la inspeccion final', 8),
          ]),
          falla('Orificios obstruidos por material sin refilar', EF_RETRABAJO_CLIENTE, [
            causa('Los orificios se liberan a mano con el cuter, uno por uno',
              'Verificacion de los orificios contra la pieza patron y la biblia de defectos, como paso de la operacion (HO 927 REV6, hoja 100, paso 2)',
              6, 'Control visual de los 17 orificios libres al 100 % en la inspeccion final (Plan de Control rev M, Operacion 120)', 8),
          ]),
          // Restos en la zona donde SMRC suelda el apoyabrazos al panel de puerta: la soldadura
          // no toma y el conjunto no se puede ensamblar. Es el efecto de paro de linea.
          falla('Restos de espuma o vinilo en la zona de soldadura', EF_PARO_LINEA, [
            causa('El sobrante de la zona de soldadura se retira a mano despues del refilado',
              'Limpieza de la zona de soldadura escrita como paso de la operacion (HO 927 REV6, hoja 100, paso 3)',
              4, 'Control visual de la zona de soldadura, autocontrol por lote y al 100 % en la inspeccion final (Plan de Control rev M, Operaciones 90 y 120)', 8),
          ]),
          falla('Corte o raya del sustrato durante el refilado', EF_SCRAP_INTERNO, [
            causa('La profundidad de corte no esta limitada por el utillaje',
              'Sin control preventivo',
              10, 'Control visual de rayas y cortes contra pieza patron y biblia de defectos (HO 927 REV6, hoja 100)', 8),
          ]),
        ]),
    ]),
    we('Metodo', 'Identificacion de la pieza', [
      funcion(
        'Identificar cada pieza con su etiqueta de trazabilidad',
        'Etiqueta de identificacion segun IO-16, al lado de las costillas de refuerzo (HO 927 REV6, hoja 100; Plan de Control rev M, Operacion 100.1)',
        [
          falla('Pieza sin la etiqueta de identificacion', EF_IDENTIFICACION, [
            causa('La etiqueta se imprime y se coloca a mano en cada pieza',
              'Impresion y colocacion de la etiqueta segun IO-16 (HO 927 REV6, hoja 100, paso 4)',
              3, 'Control visual de la etiqueta, autocontrol por lote (Plan de Control rev M, Operacion 100.1)', 9),
          ]),
          // 23/09/2026 — mezcla de mano. La pieza es un par espejo (FR.RH 00257327 / FR.LH
          // 00257328) y el AMFE no analizaba la mezcla de manos (auditoria de cliente del 23/09;
          // Fak: "agrega el analisis de mezcla de mano"). La hoja de identificacion de la HO 927
          // (hoja 110.2 en la REV.5) dice "una vez identificado el lado de la pieza, se procede a
          // colocar la etiqueta" y controla "que la identificacion corresponda a la pieza",
          // visual, OP, 100 %. O=5: prevencion por instruccion (amfe.md §6).
          falla('Pieza identificada con la etiqueta de la otra mano (RH / LH)', EF_IDENTIFICACION, [
            causa('Las piezas RH y LH son simetricas y se etiquetan en el mismo puesto',
              'Identificacion del lado de la pieza antes de colocar la etiqueta (HO 927, hoja de identificacion)',
              5, 'Control visual de que la etiqueta corresponda a la mano de la pieza, al 100 % por el operario (HO 927, hoja de identificacion)', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 110 — TROQUELADO
// ===========================================================================
// 22/09/2026 (tarde) — la Rev.A tenia "hilo corrido", que es un defecto de TELA (el Plan de
// Control dice "sin hilos corridos en tela") y esta pieza es de vinilo TEP; y decia que la pieza
// se apoya "sin posicionador", cuando la HO 927 hoja 110.1 describe el posicionador y la base de
// grillon. Se rehace contra la hoja 110.1 (sobrante maximo 2 mm, plano 18B01, con regla
// milimetrada) y el Plan de Control rev M, Operacion 110, donde estan los QRCI 2 y 9.
const OP110 = operacion('91', 'TROQUELADO DE VINILO',
  'Troquelar el vinilo de la pieza tapizada en las zonas que define el proceso',
  'Troquelado centrado en la cavidad, al borde del plastico o con un sobrante de 2 mm como maximo, sin danar el plastico',
  [
    we('Maquina', 'Dispositivo de troquelado', [
      // 23/09/2026 — aca vive la SC 1.6 del cliente (sc/f): el troquel corta el vinilo sobre la
      // pieza tapizada, y la HO 927 hoja 110.1 pide "al borde del plastico o con maximo 2 mm de
      // sobrante (carac. plano 18B01)", que es el +2 / -0 del LSC v1 medido contra el borde del
      // plastico inyectado. Vino de la OP 20 (ver alli por que). El efecto es el de la SC 1.6
      // tal como la designo el cliente, significativa FUNCIONAL: el vinilo de mas en la zona de
      // insercion de la platina impide ensamblar el conjunto (antes estas filas iban con S=5 de
      // aspecto). S=8 con O=5 y O=4: la sigla cierra con el criterio (S 5-8 y O >= 4).
      // El retrabajo con cuter de la hoja 110.3 se dio de baja en la HO 927 REV.5 (31/10/2025):
      // un defecto de corte va a scrap.
      funcion(
        'Troquelar el vinilo en la zona de insercion de la platina dentro del limite que fija el cliente',
        'SC 1.6: vinilo al borde del plastico o con 2 mm de sobrante como maximo (+2 / -0) en la zona de insercion de la platina (caracteristica 18B01 del plano; HO 927 REV6, hoja 110.1)',
        [
          falla('Vinilo troquelado con mas de 2 mm de sobrante en la zona de insercion de la platina', EF_PARO_LINEA, [
            // I-MT-003 Rev A: "Controlar filo. En caso de perdida de filo se retira el fleje y se
            // lo afila". El instructivo no nombra ningun registro ("ANEXOS: No posee") ni un
            // criterio numerico (golpes u horas).
            causa('El filo del troquel se desgasta entre dos afilados',
              'Control de filo y fleje del troquel con reafilado (I-MT-003 Rev A)',
              5, 'Control del sobrante con regla milimetrada por el operario, como paso de la operacion (HO 927 REV6, hoja 110.1)', 6,
              sc('SC 1.6', 'sc/f')),
          ]),
          falla('Troquelado descentrado: vinilo por debajo del borde del plastico o con mas de 2 mm de sobrante', EF_PARO_LINEA, [
            causa('La pieza se apoya a mano sobre el posicionador y la base de grillon antes de cada golpe',
              'Posicionador y base de grillon del dispositivo (HO 927 REV6, hoja 110.1, paso 1)',
              4, 'Control visual del troquelado centrado y del posicionado: 1 pieza al inicio y al fin de turno por el operador de calidad y autocontrol del operario por lote, y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8,
              sc('SC 1.6', 'sc/f')),
          ]),
        ]),
      funcion(
        'Troquelar sin danar el plastico',
        'Pieza asentada sobre el posicionador y la base de grillon (HO 927 REV6, hoja 110.1, paso 1)',
        [
          falla('Plastico danado por el troquelado', EF_SCRAP_INTERNO, [
            causa('La pieza mal asentada deja el plastico debajo de la linea de corte del troquel',
              'Posicionador y base de grillon del dispositivo (HO 927 REV6, hoja 110.1, paso 1)',
              4, 'Control visual de plastico danado: 1 pieza al inicio y al fin de turno por el operador de calidad y autocontrol del operario por lote (Plan de Control rev M, Operacion 110), y al 100 % en la inspeccion final (HO 927 REV6, hoja 120)', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 120 — INSPECCION FINAL.  Aca se cubren los ensayos SC 3.1 a 3.7 del conjunto.
// El flujograma 159 numera 120 INSPECCION FINAL: resuelve la colision con el Rev.03,
// que usaba el 120 para un traslado y dejaba la inspeccion sin numero.
// ===========================================================================
// 23/09/2026 — la inspeccion final y el muro de calidad son la MISMA operacion. Fak: "la
// inspeccion final es en realidad lo mismo que el muro de calidad, unificalos". Hasta hoy el
// muro era la OP 110, con un solo modo de falla cuya causa decia justamente que "repite una
// inspeccion visual con los mismos criterios que la inspeccion final". Queda la OP 100 con el
// requisito de la carta de nominacion (100 % hasta 5.000 piezas buenas) y el embalaje pasa a 110.
const OP120 = operacion('100', 'INSPECCION FINAL / MURO DE CALIDAD',
  'Inspeccionar al 100 % la pieza terminada contra los criterios de aceptacion antes de embalarla, como muro de calidad hasta 5.000 piezas buenas consecutivas',
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
          // 22/09/2026 (tarde) — la causa decia que la inspeccion "no mide la posicion de la
          // costura", y la HO 927 hoja 120 dice lo contrario: "biblia de defectos para criterios
          // de aspecto + plantilla de alineacion de costura", con camino de inspeccion por zonas
          // A, B y C y registro en la "planilla de control calidad 100%".
          falla('Pieza no conforme que pasa la inspeccion final', EF_PIEZA_DISTINTA, [
            causa('Los criterios de aspecto se juzgan a ojo, pieza por pieza, contra la biblia de defectos',
              'Biblia de defectos, pieza patron y plantilla de alineacion de costura en el puesto, con camino de inspeccion por zonas A, B y C (HO 927 REV6, hoja 120)',
              4, 'Control al 100 % como muro de calidad hasta 5.000 piezas buenas consecutivas (carta de nominacion, pag. 8), con registro en la planilla de control de calidad e identificacion con etiqueta roja de cada pieza no conforme (HO 927 REV6, hoja 120)', 8),
          ]),
          // Plan de Control rev M, Operacion 120, item 1: adherencia del tapizado de 10 N como
          // referencia, con dinamometro. Es por muestreo -> P3-9. La Rev.A no tenia ningun modo
          // de falla de despegue del vinilo en todo el documento.
          falla('Adherencia del tapizado por debajo de 10 N', EF_DESPEGUE, [
            causa('El pegado deficiente no siempre se ve en una inspeccion visual',
              'Adherencia minima de 10 N definida como criterio de aceptacion de la pieza',
              4, 'Ensayo de adherencia con dinamometro, por muestreo (Plan de Control rev M, Operacion 120)', 9),
          ]),
        ]),
      funcion(
        'Verificar que el apoyabrazos ensamblado cumple los ensayos de validacion del cliente',
        'SC 3.1 fogging (B62 0400), 3.2 frotamiento (D45 1010), 3.3 flexibilidad, 3.4 esfuerzo excepcional y 3.5 solicitacion dinamica (ST 01439), 3.6 envejecimiento climatico (D47 1309), 3.7 usura (D14 1055 y D47 1309)',
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
              4, 'Ensayos de validacion a cargo de SMRC', 10,
              sc('SC 3.1 a 3.7', 'cc/h')),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 101 y 102 — LOS REPROCESOS DE LA INSPECCION FINAL
// ===========================================================================
// Fak, 23/09/2026: "retrabajo de puntada, ya tenemos un instructivo hecho, puntada floja...
// borrado de la mancha de adhesivo, unicamente esos 2... son retrabajos conocidos que deben estar
// declarados, ponelos en un lugar logico". Los dos se hacen sobre la pieza TERMINADA y se detectan
// en la inspeccion final (OP 100): cuelgan de ella, como los 72-74 cuelgan del control de
// adhesivado, y vuelven a reverificarse en la OP 100. Resuelve el pendiente de la HO 927 hoja 120,
// que decia "etiqueta roja para posterior scrap o retrabajo" sin decir cual retrabajo.
//   - Puntada floja: HO-106 "Reproceso: puntada floja", Rev A del 14/05/2026 (F.Santoro / G.Cal),
//     en HOJAS DE OPERACIONES\4- RETRABAJOS. Aguja Nm140 del lado interno, tensar el hilo,
//     cauterizar con encendedor del lado interno, verificar la tension pasando la aguja bajo el
//     hilo. OJO: la hoja nombra solo los codigos de AMAROK.
//   - Mancha de adhesivo: no tiene hoja escrita. Sin control preventivo (O=10, P2 oficial).
const reprocesoFinal = (numero, nombre, funcionOp, requisito, fallas) => operacion(numero, nombre,
  funcionOp, requisito, [we('Metodo', 'Reproceso manual de la pieza terminada', [
    funcion(funcionOp, requisito, fallas),
  ])]);

const OP_RET_PUNTADA = reprocesoFinal('101', 'REPROCESO: PUNTADA FLOJA',
  'Tensar y fijar la puntada floja de la costura vista de la pieza terminada',
  'Costura vista con la tension correcta y sin marcas en el vinilo',
  [
    falla('Puntada que sigue floja despues del reproceso', EF_COSTURA, [
      causa('La tension del hilo se da a mano con la aguja',
        'Hoja de reproceso HO-106 de puntada floja, con la verificacion de la tension',
        4, 'Verificacion de la tension con la aguja en cada pieza reprocesada, y reverificacion en la OP 100', 8),
    ]),
    falla('Vinilo quemado o marcado al cauterizar el hilo', EF_ASPECTO, [
      causa('El hilo se cauteriza con un encendedor cerca del vinilo',
        'Cauterizado del lado interno de la pieza, segun la hoja de reproceso HO-106',
        4, 'Control visual de la pieza reprocesada y reverificacion en la OP 100', 8),
    ]),
  ]);

const OP_RET_MANCHA = reprocesoFinal('102', 'REPROCESO: MANCHA DE ADHESIVO',
  'Borrar la mancha de adhesivo de la cara vista de la pieza terminada',
  'Cara vista sin restos de adhesivo ni marcas del borrado',
  [
    falla('Cara vista con restos de adhesivo o marcada despues del borrado', EF_ASPECTO, [
      causa('El borrado se hace a mano y sin un metodo escrito',
        'Sin control preventivo',
        10, 'Reverificacion en la OP 100: control visual al 100 % contra la biblia de defectos', 8),
    ]),
  ]);

// (OP 110 MURO DE CALIDAD: unificada con la inspeccion final en la OP 100 el 23/09/2026.)

// ===========================================================================
// OP 110 — EMBALAJE E IDENTIFICACION (era la 120 hasta que el muro se unifico con la OP 100)
// ===========================================================================
const OP130 = operacion('110', 'EMBALAJE E IDENTIFICACION',
  'Embalar e identificar la pieza terminada segun la ficha de embalaje del cliente',
  'Medio embalado con la cantidad y la identificacion que pide el cliente',
  [
    we('Metodo', 'Embalaje e identificacion del medio', [
      funcion(
        'Embalar con la cantidad y la identificacion que pide el cliente',
        'Cantidad por medio e identificacion segun la ficha de embalaje',
        [
          // Un error de conteo no para la linea del cliente: se repone. P1-6, no 8.
          falla('Medio despachado con una cantidad distinta de la de la ficha', EF_CANTIDAD, [
            causa('Las piezas se cuentan a mano por piso al armar el medio',
              'Modulo de embalaje segun el cuadro de la hoja: 4 piezas por piso, 5 pisos, 20 piezas por caja (HO 927 REV6, hoja 130)',
              3, 'Control visual del modulo de embalaje por el operario (HO 927 REV6, hoja 130)', 8),
          ]),
          // Defecto que YA le llego al cliente, reincidente: QR 235703 "APB P21 sin costura -
          // identificacion incorrecta" (30/07/2025) y "hoy otra vez enviaron 20 piezas con error
          // de referencia" (SMRC, 01/10/2025); 8D cerrado en noviembre de 2025. O=6: proceso
          // conocido con no conformidades repetidas. El control del Plan de Control es 1 medio
          // al final del turno -> P3-9. La Rev.A decia O=3.
          falla('Medio despachado con una etiqueta que no corresponde a su contenido', EF_PARO_LINEA, [
            causa('La etiqueta del medio se coloca a mano al completar el embalaje, y en el sector se embalan varias versiones del P21',
              'Identificacion segun el codigo de la pieza (Plan de Control rev M, Operacion 130)',
              6, 'Control visual de la identificacion, 1 medio al final del turno (Plan de Control rev M, Operacion 130)', 9),
          ]),
          // 23/09/2026 — mezcla de mano en el medio. La hoja de embalaje (HO 927 REV6, hoja 130)
          // arma el modulo (4 piezas por piso, 5 pisos, carton entre pisos) y no pide separar ni
          // verificar la mano de cada pieza: D=10, sin control declarado. Lo que previene es la
          // etiqueta de cada pieza con su mano (hoja de identificacion). S=8: una pieza de la otra
          // mano no se puede montar en esa posicion del panel de puerta.
          falla('Pieza de una mano embalada en el medio de la otra (RH / LH)', EF_PARO_LINEA, [
            causa('Las piezas RH y LH son simetricas y se embalan en el mismo sector',
              'Cada pieza lleva su etiqueta con la mano identificada (HO 927, hoja de identificacion)',
              5, 'Sin control de la mano de cada pieza al armar el medio', 10),
          ]),
          // La Rev.A decia "el medio no tiene separadores". La HO 927 hoja 130 dice lo contrario:
          // carton en la base "para que no se ensucien o rallen las piezas" y un carton por piso.
          // Ya paso: QRCI 04/2020 "vinilo marcado por el embalaje". Y "marcado" es el defecto
          // que mas piezas le manda a retrabajo al residente de Barack en SMRC (1.117 piezas,
          // planilla Calidad Cliente V7), aunque no todo el marcado sale de aca. O=5, no 3.
          falla('Vinilo marcado o danado por el propio embalaje', EF_ASPECTO, [
            causa('Dentro de un mismo piso las piezas quedan en contacto entre si',
              'Carton en la base y entre pisos, piezas dispuestas en forma cruzada (HO 927 REV6, hoja 130)',
              5, 'Control visual del medio por el operario al cerrarlo (HO 927 REV6, hoja 130)', 8),
          ]),
        ]),
    ]),
  ]);

// En el orden del flujograma. La Rev.A tenia la 71 antes que la 70.
const OPERACIONES = [OP10, OP20, OP21, OP30, OP40, OP50, OP60, OP70, OP80, OP71, OP72, OP73, OP74, OP90A, OP90, OP82, OP100, OP110, OP120, OP_RET_PUNTADA, OP_RET_MANCHA, OP130];

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
    revDate: FECHA_REVISION,
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
// 23/09/2026 — Fak, antes de mandarlo al cliente: "intentemos eliminar los TBD del AMFE... no
// queda bien... ante la duda simplificalo un poco pero no dejes TBDs". Los 11 que habia eran
// controles preventivos que no existen, todos con O=10: se escriben "Sin control preventivo",
// que es lo que dice la P2 oficial para O=10 (SETEC pag. 104). Un TBD nuevo frena la corrida.
if (tbd) errores.push(`${tbd} campos con TBD: el documento va al cliente sin TBD (Fak, 23/09/2026)`);

// 1) las 13 operaciones del flujograma 159, ni una mas ni una menos
// La serie sale del flujograma 159 Rev.A rehecho el 22/09/2026: una decena por SECTOR,
// avanzando en la unidad. 20-21 mesa de corte · 30 refilado · 40-41 costura · 60-61 limpieza
// y primer · 70-71 adhesivado y su control · 80-82 horno, tapizado y el control con mylar ·
// 90-91 refilado con mascara y troquelado · 100 inspeccion final · 110 embalaje.
// 22/09/2026 (tarde): se suman los reprocesos 72-74 del adhesivado y el muro de calidad (110),
// y el embalaje pasa a 120.
const DEL_FLUJOGRAMA = ['10', '20', '21', '30', '40', '41', '60', '61', '70', '71', '72', '73', '74', '80', '81', '82', '90', '91', '100', '101', '102', '110'];
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
  console.log('\nDECIDIDO por Fak el 22/09/2026: la S de estas filas es 8, la del efecto que Barack');
  console.log('puede sostener (SMRC rechaza el lote -> P1-8 "Stop shipment possible"). La lectura');
  console.log('alternativa -que montar una pieza no homologada es incumplimiento reglamentario,');
  console.log('S=9- estuvo vigente el 21/09 y se dio vuelta porque dejaba una contradiccion adentro');
  console.log('del documento: "costura con dos lineas" quedaba mas grave que un paro de linea.');
  console.log('\n  Las <cc/h> se quedan: las designo el CLIENTE en su LSC v1 y eso es un dato suyo,');
  console.log('  no una consecuencia de nuestra S. El validador lo informa como diferencia');
  console.log('  (CARACTERISTICA_CLIENTE_S_MENOR, warning) y el export corre. Lo que sigue');
  console.log('  frenando es una sigla critica con S<9 SIN fuente del cliente declarada.');
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
        last_revision_date: FECHA_REVISION_ISO,
        revision_level: 'A',
        data: JSON.stringify(doc),
        revisions: JSON.stringify(doc.revisions),
        // La tabla no tiene trigger: sin esto la fila seguia diciendo 21/09 despues de las
        // escrituras del 22/09 (saveAmfe() lo pone solo; este UPDATE es crudo).
        updated_at: new Date().toISOString(),
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
  last_revision_date: FECHA_REVISION_ISO,
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
