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
 *     con practica). Por la Tabla P2 oficial un control de conducta va de 6 a 9; se uso O=7
 *     (ver O_OPERARIO). Es un JUICIO: lo respaldan los dos remitos y el mail de Calidad; en
 *     contra, la planilla de cumplimiento del cliente decia "entregado 0" al 29/09 y la
 *     tercera pasada del auditor pidio 8 o 9. Esa evidencia NO cubre el repaso de adhesivo
 *     (operacion 31) ni la terminacion (70). Queda dicho a Fak; si el decide 8, cambia
 *     O_OPERARIO y 11 causas de aspecto pasan de prioridad media a alta (contado el 02/10).
 *   - El adhesivado y el tapizado se registran junto con los del IP Pad (programa de la semana
 *     40: "REGISTRO DE PRODUCCION - ADHESIVADO IP Y UPPER TRIMMING" y "Tapizado IP PAD y UPPER
 *     TRIM", con piezas por hora y scrap). De ese sector se toma solo lo que es del LUGAR
 *     (campana de extraccion, set up de lanzamiento, guantes). El METODO del IP Pad no se
 *     copia: Fak, 02/10/2026, "capaz no va a ser igual al IP Pad... solo lo confirmado, lo que
 *     vas con evidencia".
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
 *   - Proceso: flujo de proceso de la cotizacion (PATAGONIA_UPPER_TRIM_PANEL_(BOM).xlsx,
 *     P. Centurion, 20/08/2025, en la carpeta de Ingenieria de la pieza): corte, adhesivado de
 *     la tela y adhesivado del sustrato (10,25 g cada uno, "por proyeccion o por rodillo"),
 *     alineado manual con dispositivo en mesa, virolado manual CON PISTOLA DE CALOR ("tiene
 *     complejidad en el virolado del agujero interior"), muro de calidad y embalaje. Es el
 *     unico papel de la pieza que dice con que se da calor, y lo dice para el virolado.
 *   - Tambien: pliego "Dispositivo Tapizado Manual Console Central Component" Rev.01 del
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
 * REVISION DE CALIDAD DEL 02/10/2026 (marcas de Cecilia Rodriguez sobre el flujograma y notas
 * de Agustina; fotos en la carpeta de la tarea). Lo que entro en esta version:
 *   - Los reprocesos 32, 71 y 72 no se declaran: el repaso de adhesivo queda dentro de la 31 y
 *     la reactivacion de bordes y la limpieza de adhesivo son la terminacion, dentro de la 70.
 *     Sus modos de falla siguen analizados (IATF 16949 8.7.1.4; RAC N 2 de la auditoria 2019).
 *   - D/TLD en las tres causas de inflamabilidad (S=9): la asigna Fak, ver dtld().
 *   - Grumos de adhesivo por la pistola sucia (instruccion IO-15 del SGC).
 *   - Textos cortos, como el resto de los AMFE de la casa (amfe.md 11): la causa tenia 12
 *     palabras de mediana y 61 de 75 pasaban de 10; en los otros AMFE la mediana es de 4 a 7.
 * Lo que espera la reunion de AMFE con Calidad y Seguridad e Higiene: limpieza del sustrato con
 * alcohol isopropilico antes de adhesivar (no consta que se haga hoy), ensayo de adherencia de
 * serie, "agregar medio ambiente", el control con mylar "al 100 %", el almacenamiento WIP (22).
 *
 * PROPUESTA DEL 20/10/2026 (sin emitir, sigue Rev. A hacia afuera por pedido de Fak del 09/10):
 *   - Inflamabilidad: VW (Diego Pandolfi, 16/10/2026: "considerar el sustrato forrado como
 *     muestra para la validacion de flamabilidad") y Carlos Baptista (16/10, a Ingenieria:
 *     "actualizamos el AMFE, el flujograma y el resto de la documentacion"): se valida con la
 *     pieza tapizada, no se ensaya la materia prima, y Compras compra el vinilo sin ignifugo
 *     (con ignifugo tambien sirve). Fuera "microfibra sin antiflama" (OP 10) y "se corta la
 *     version sin antiflama" (OP 20). Queda la microfibra de un articulo distinto del validado.
 *     La pieza tapizada ya se ensayo: Manuel Meszaros, 25/09/2026, "el ensayo en producto
 *     terminado tiene un resultado OK en ambas condiciones" (con y sin tratamiento).
 *   - Reunion de AMFE con Calidad y Seguridad e Higiene del 09/10/2026 (lista de la carpeta del
 *     Escritorio "AMFE CON SEGURIDAD E HIGIENE"): sentido del pelo en el corte, sustrato
 *     consignado controlado a la vista, almacenamiento WIP 22 en el AMFE, guantes calor-corte,
 *     extraccion controlada por Seguridad e Higiene, residuos especiales con manifiesto.
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
 *       ... --sin-bom   saltea el cruce de materiales contra el export del arb (C:\tmp\RELACIONES.TXT)
 *       ... --candidatas   lista las causas candidatas a caracteristica especial
 */

import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { validateAmfeDoc, validateEquipoMultifuncional, printIssues } from './_lib/amfeValidator.mjs';
import { crearConstructores, chequeosDeAutoria, leerBomDelArb, materialesContraBom } from './_lib/amfeAutoria.mjs';

const APPLY = process.argv.includes('--apply');
const FECHA_ISO = '2026-10-01';

const AMFE_KEY = 'AMFE-UT-PAT';
// Numero del Listado_Maestro_AMFE.xlsx (el ultimo cargado era el 173), tomado con el OK de Fak
// del 01/10/2026.
const NUMERO_EMPRESA = '174';
const FECHA = '01/10/2026';
const REV = 'A';   // la letra sube cuando el documento se EMITE (amfe.md 4bis); criterio en revision, 08/10/2026
// La fecha de revision se mueve con el ultimo cambio aunque la letra espere a la emision
// (amfe.md 4bis.3): propuesta del 20/10/2026.
const REV_FECHA = '21/10/2026';
const REV_FECHA_ISO = '2026-10-21';
const FLUJOGRAMA = 'tools/flowchart/data/160-UPPER-TRIM-PANEL.json';

// Nivel 1 (amfe.md §8): que entrega la pieza. Identico en todas las operaciones.
const FOCO = 'Funcion Interna: Entregar el Upper Trim Panel tapizado en microfibra, con los agujeros libres y el logo de carga grabado, conforme al plano y con la inflamabilidad y la adherencia que exige el cliente'
  + ' / Funcion del Cliente: Permitir el armado de la consola central en Cozzuol sin clasificacion ni retrabajo'
  + ' / Funcion del Usuario Final: Aspecto y tacto de la consola central, con la zona de carga inalambrica identificada';

// Constructores comunes a los generadores (ids estables, S en el efecto, AP calculado).
const { causa, falla, funcion, we, operacion } = crearConstructores({ prefijo: 'utp', foco: FOCO });

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
const VISUAL_ADHESIVADO = 'Control visual del adhesivo en la inspeccion de pieza adhesivada';
// D/TLD: la marca de VW para la caracteristica critica (S = 9 o 10; aca, la inflamabilidad, que
// es requisito legal). La pidio Calidad al revisar la Rev. A el 02/10/2026 ("proceso 10, poner
// D"; "control de flamabilidad -> D"). Las tres causas marcadas tienen S=9 por su efecto. La
// asigna Fak: sin su OK esta propuesta no se escribe (caracteristicas-especiales.md §4).
const dtld = (c) => ({ ...c, specialChar: 'D/TLD' });
// El plan de validacion TL 496 pide la adherencia por PV 2034, una sola vez y todavia sin
// resultado. Eso valida el proceso; no es un control de la produccion. En la serie no hay
// ensayo de adherencia: D=10 (tercera pasada de la auditoria de cliente, 01/10/2026: con D=9
// la misma ausencia valia 9 aca y 10 en "sin control posterior").
const ADHERENCIA = 'Sin ensayo de adherencia en la serie';
// Reunion de AMFE del 09/10/2026: guante "calor-corte" para el trabajo con calor y con cuchilla
// (OP 40, 42 y 70); donde no es comodo se usa el de tareas generales. Sigue siendo un control
// de conducta: O=7.
const GUANTE_CALOR_CORTE = 'Guantes calor-corte del sector';
// Reunion de AMFE del 09/10/2026: la extraccion la controla Seguridad e Higiene.
const EXTRACCION = 'Extraccion con filtros repuestos segun planilla de Seguridad e Higiene';
const EXTRACCION_CONTROL = 'Control de las turbinas por Seguridad e Higiene';
const D_ADHERENCIA = 10;

// ---------------------------------------------------------------------------
// EFECTOS — cada uno trae su S, de la Tabla P1 oficial (SETEC pag. 101-103).
//   10 riesgo agudo para el operario · 9 incumplimiento de regulacion · 8 riesgo cronico para
//   el operario · 7 parte de la produccion a scrap / reemplazo en el campo · 6 paro de linea
//   de hasta una hora · 5 retrabajo fuera de linea / clasificacion sin paro.
// ---------------------------------------------------------------------------
// Desde el 16/10/2026 la inflamabilidad se valida con la pieza tapizada (VW): el efecto es el
// de la pieza, no el de la microfibra sola.
const EF_LEGAL_FUEGO = {
  s: 9,
  local: 'Pieza tapizada sin evidencia de cumplir el limite de velocidad de combustion',
  next: 'Bloqueo del lote en la recepcion de Cozzuol',
  end: 'Incumplimiento de un requisito legal de inflamabilidad en el habitaculo del vehiculo',
};
// Material que entra a produccion sin liberar. La recepcion verifica que el articulo sea el
// pedido: sin liberar puede entrar una microfibra distinta de la validada con la pieza
// tapizada, y ese es el efecto mas grave (Tabla P1-9). El 20/10/2026 la propuesta lo habia
// bajado a 7 y la auditoria de cliente lo marco (SETEC pag. 100: la S es la del efecto mas grave).
const EF_SIN_LIBERAR = {
  s: 9,
  local: 'Material sin liberar usado en la pieza',
  next: 'Bloqueo del lote en la recepcion de Cozzuol',
  end: 'Posible pieza con un material no validado: incumplimiento del requisito legal de inflamabilidad',
};
// Residuo especial descartado como comun: incumplimiento de la reglamentacion dentro de la
// planta. P1-9 ("in-plant regulatory noncompliance"), como la seguridad del operario que se
// escribe con la Ley 19587.
const EF_RESIDUO = {
  s: 9,
  local: 'Residuo especial fuera del circuito de manifiesto; posible incumplimiento de la ley de residuos peligrosos',
  next: 'Sin efecto en la planta del cliente',
  end: 'Sin efecto en el vehiculo',
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
const EF_ASPECTO_TERMINACION = {
  s: 5,
  local: 'Pieza con mancha de adhesivo en zona vista, que se limpia en la terminacion',
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
        'Entregar la microfibra del articulo validado con la pieza tapizada',
        'Articulo con el que la pieza tapizada cumple la inflamabilidad del plano y TL 1010',
        [
          // 16/10/2026 (VW): la inflamabilidad se valida con la pieza tapizada y la materia
          // prima no se ensaya; sirve con y sin ignifugo (Carlos, 16/10). La pieza tapizada se
          // ensayo OK con las dos (Manuel Meszaros, 25/09/2026). Lo que queda es un articulo
          // distinto del validado: el material esta direccionado por VW y ya llego una vez un
          // lote pedido solo por codigo, sin plano ni norma (Manuel, 24/09): O=4. En la
          // recepcion no hay ensayo de inflamabilidad: D=10.
          // Sigla: S=9 -> critica por criterio (D/TLD para VW). La tenia asignada por Fak la
          // inflamabilidad de la OP 10 (08 y 09/10/2026); aca sigue a la misma caracteristica
          // en su fila nueva. 21/10/2026, Fak: "las decisiones del amfe tomalas vos": queda por
          // criterio (S=9, I-AC-005 punto 5). El plano no la designa (cajetin Safety doc. vacio).
          falla('Microfibra de un articulo distinto del validado', EF_LEGAL_FUEGO, [
            dtld(causa('Cambio de articulo o proveedor sin revalidar la pieza',
              'Material direccionado por VW, codigo en la lista de materiales',
              4, 'Sin ensayo de inflamabilidad en la recepcion', 10)),
          ]),
        ]),
      funcion(
        'Entregar la microfibra con el color, el espesor y el gramaje que pide el plano',
        'Color y apariencia segun el plano y la referencia de color del cliente; espesor y gramaje segun el plano',
        [
          falla('Microfibra recibida con un color distinto del aprobado', EF_ASPECTO, [
            causa('Variacion de tono entre partidas del proveedor',
              'Articulo y color declarados en la orden de compra',
              6, 'Sin muestra patron de color en la recepcion', 10),
          ]),
          // El informe del proveedor del lote 260819-04 da un espesor por encima del rango del
          // plano: la variacion ya se vio. O=8.
          falla('Microfibra recibida con espesor o gramaje fuera del plano', EF_ASPECTO, [
            causa('Variacion del proceso del proveedor entre partidas',
              'Ficha tecnica del proveedor con espesor y gramaje',
              8, 'Sin plan de control de recepcion para este material', 10),
          ]),
          falla('Rollo recibido manchado, marcado o con pliegues', EF_SCRAP_INTERNO, [
            causa('Dano del rollo en el transporte',
              SIN_PREVENCION,
              10, 'Inspeccion visual del estado del rollo al recibirlo', 8),
          ]),
        ]),
    ]),
    // Reunion de AMFE del 09/10/2026: el sustrato es material CONSIGNADO por Cozzuol y en la
    // recepcion solo se controla a la vista (aristas, rebabas y punto de inyeccion). El resto
    // de ese tramo del audio es dudoso y no se usa. Si el control es al 100 % no consta: P3-9.
    we('Material', 'Sustrato plastico consignado por Cozzuol', [
      funcion(
        'Entregar el sustrato dentro de medida y sin deformaciones, rebabas ni marcas',
        'Sustrato de la variante pedida, segun el plano y apto para tapizar',
        [
          // Hay un informe dimensional del 08/09/2026 sobre una pieza, con cotas fuera de plano.
          // Fue una medicion unica; en la recepcion de serie no se mide (reunion del 09/10).
          falla('Sustrato recibido fuera de medida', EF_NO_MONTA, [
            causa('Variacion dimensional de la inyeccion del proveedor',
              SIN_PREVENCION,
              10, 'Sin control dimensional en la recepcion: material consignado', 10),
          ]),
          falla('Sustrato con rebabas, aristas o punto de inyeccion marcado', EF_ASPECTO, [
            causa('Defecto de inyeccion o dano en el lote recibido',
              SIN_PREVENCION,
              10, 'Inspeccion visual de aristas, rebabas y punto de inyeccion', 9),
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
          falla('Adhesivo o reticulante distinto del pedido o por vencer', EF_DESPEGUE, [
            causa('Partida equivocada o con poca vida util',
              'Certificado de calidad del proveedor por partida',
              3, 'Control de color, viscosidad y vencimiento, una muestra por lote', 9),
          ]),
        ]),
    ]),
    we('Method', 'Identificacion y liberacion del material en el deposito', [
      funcion(
        'Que a produccion solo salga material ingresado, controlado e identificado',
        'Material identificado por lote y liberado antes de habilitarlo al sector',
        [
          // S=9 O=4: critica por criterio; la D/TLD la tenia asignada Fak (08/10/2026) y queda
          // (21/10/2026, Fak: "las decisiones del amfe tomalas vos").
          falla('Material entregado a produccion sin liberar', EF_SIN_LIBERAR, [
            dtld(causa('Material retirado antes de terminar su control de recepcion',
              'Zona de material pendiente separada de la de liberado',
              4, 'Control de la identificacion de lote al inicio de turno', 9)),
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
              3, 'Control visual del deposito en cada turno y tras cada lluvia', 8),
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
            causa('Falla hidraulica o de frenos del autoelevador',
              'Check list diario del autoelevador y mantenimiento preventivo',
              6, 'Inspeccion previa al uso en cada turno', 8),
          ]),
          falla('Dano del embalaje de la materia prima durante el movimiento', EF_SCRAP_INTERNO, [
            causa('Material movido o estibado sin proteccion',
              'Procedimiento de estiba y uso de embalajes cerrados',
              5, 'Inspeccion visual del embalaje al recibirlo en el sector', 8),
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
            causa('Programa de corte de una revision no liberada',
              'Codigo y nombre del programa verificados en el set up',
              4, 'Control de la primera pieza con la plantilla mylar', 9),
          ]),
          falla('Se corta una variante distinta de la pedida', EF_SCRAP_INTERNO, [
            causa('Las dos variantes se diferencian solo por un hueco',
              'Codigo y nombre del programa verificados en el set up',
              4, 'Control de la primera pieza con la plantilla mylar de la variante', 9),
          ]),
          falla('Microfibra montada con la cara vista invertida', EF_SCRAP_INTERNO, [
            causa('El rollo entra en los dos sentidos',
              'Planilla de corte con el sentido del rollo',
              4, 'Control visual de la cara vista contra la planilla de corte', 8),
          ]),
          // Reunion de AMFE del 09/10/2026: el sentido del pelo de la microfibra se agrega como
          // caracteristica a controlar en el corte. Hoy no hay control escrito: O=10 y D=10.
          // (La fila "se corta la version sin antiflama" salio el 20/10/2026: VW valida con la
          // pieza tapizada y sirven las dos versiones; ademas el cliente habia pedido el 09/10
          // sacar la D/TLD del corte.)
          falla('Pieza cortada con el pelo en otro sentido', EF_ASPECTO, [
            causa('Sentido del pelo sin definir para el corte',
              SIN_PREVENCION,
              10, 'Sin control del sentido del pelo en el corte', 10),
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
              'Afilado automatico y cambio de cuchilla por ancho minimo',
              4, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra mal alineada sobre la mesa de corte', EF_SCRAP_INTERNO, [
            causa('Material detenido fuera de la marca, sin escuadra',
              'Lineas de tope en la mesa y sensores de medida',
              4, 'Verificacion visual del material contra las marcas, antes de cada corte', 8),
          ]),
          falla('Corte incompleto, con zonas sin separar', EF_SCRAP_INTERNO, [
            causa('Caida de la succion durante el corte',
              'El corte no arranca sin vacio activo',
              5, 'Control del tendido y del despegue de la capa durante el corte', 8),
          ]),
        ]),
    ]),
    we('Measurement', 'Identificacion del corte', [
      funcion(
        'Que del corte salga la variante y la cantidad correcta, identificada',
        'Corte identificado con la variante y la cantidad de la orden',
        [
          falla('Corte identificado con otra variante u otra cantidad', EF_SCRAP_INTERNO, [
            causa('Etiqueta colocada despues de retirar el corte',
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
          falla('Corte liberado con la plantilla de la otra variante', EF_SCRAP_INTERNO, [
            causa('Plantillas que se diferencian solo por un hueco',
              'Plantilla codificada por referencia y material',
              4, 'Cotejo de la identificacion de la plantilla contra la planilla de corte', 8),
          ]),
          // Lo que se le escapa a este control se ve recien al tapizar: la tela no llega al
          // borde. La deteccion es aguas abajo, a la vista.
          falla('Pieza mas chica que el area OK dada por conforme', EF_SCRAP_VISTA, [
            causa('La pieza chica entra dentro del contorno de la plantilla',
              'Banda de tolerancia en la plantilla, en los dos sentidos',
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
            causa('La mesa no queda bloqueada durante el control',
              'Liberacion de la primera pieza por el inspector de calidad',
              5, 'Firma del inspector en la ficha de liberacion de inicio de produccion', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 22 — ALMACENAMIENTO EN MEDIOS WIP
// Reunion de AMFE del 09/10/2026: los almacenamientos intermedios se declaran en el flujograma y
// en el AMFE, y llevan hoja de proceso (cuantas piezas y en que medio). Cambia el criterio de la
// casa (amfe.md §9: el WIP no tenia AMFE propio): decision de esa reunion, a confirmar por Fak.
// La hoja todavia no existe: la cantidad por medio no esta definida.
// ===========================================================================
const OP22 = operacion('22', 'ALMACENAMIENTO EN MEDIOS WIP',
  'Guardar los cortes de microfibra hasta el tapizado sin danarlos ni mezclar variantes',
  [
    we('Method', 'Medio WIP de cortes', [
      funcion(
        'Guardar los cortes sin marcarlos y separados por variante',
        'Cortes identificados por variante, sin marcas ni pliegues',
        [
          falla('Corte marcado o plegado en el medio WIP', EF_SCRAP_INTERNO, [
            causa('Cantidad de cortes por medio sin definir',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Cortes de las dos variantes en el mismo medio', EF_SCRAP_INTERNO, [
            causa('Medios WIP iguales para las dos variantes',
              'Etiqueta emitida con la orden de corte',
              4, 'Cotejo de la etiqueta contra el contenido al cerrar el bin', 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 30 — ADHESIVADO DE MICROFIBRA Y SUSTRATO
// Adhesivo FA con reticulante GV sobre las dos partes: el flujo de proceso de la cotizacion
// (20/08/2025) tiene un adhesivado de la tela y otro del sustrato, 10,25 g cada uno, que es de
// donde sale el consumo cargado en el arb. CON QUE se aplica no esta definido en ningun papel
// de la pieza (ese flujo dice "por proyeccion o por rodillo"; la ficha del adhesivo, "a
// soplete o pincel") y el 01/10/2026 se estaba discutiendo como mejorarlo: no se nombra la
// herramienta. La mezcla tiene instruccion (IO-08); la aplicacion sobre esta pieza no tiene hoja.
// La pistola entra solo por los grumos: la nombran las notas de Calidad del 02/10/2026 ("limpieza
// de pistola - grumos") y el plan de control preliminar de Calidad (PC UPER TRIM Rev 0, 05/10/2026:
// "presion de pistola adhesivadora", "limpieza de pistola con diluyente al final de turno").
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
            causa('Reticulante agregado a mano',
              'Instruccion IO-08, una botella de reticulante por lata',
              4, 'Sin control de la mezcla despues de preparada', 10),
          ]),
          // El set up se hace al lanzar el turno, no en cada mezcla: P3-9.
          falla('Adhesivo o reticulante vencido usado en la mezcla', EF_DESPEGUE, [
            causa('Componente vencido en el deposito o en el puesto',
              'Fecha de vencimiento en la etiqueta de cada envase',
              4, 'Verificacion de vencimientos en el set up de lanzamiento', 9),
          ]),
          falla('Mezcla de adhesivo usada fuera de su vida util', EF_DESPEGUE, [
            causa('Mezcla sin la hora de preparacion a la vista',
              SIN_PREVENCION,
              10, 'Sin registro de la hora de preparacion de la mezcla', 10),
          ]),
        ]),
    ]),
    we('Method', 'Aplicacion del adhesivo', [
      funcion(
        'Aplicar el adhesivo en forma uniforme sobre las dos partes',
        'Microfibra y sustrato cubiertos por completo, sin exceso',
        [
          falla('Adhesivo insuficiente o con zonas sin cubrir', EF_DESPEGUE, [
            causa('Aplicacion manual, la cobertura varia entre piezas',
              OPERARIO,
              O_OPERARIO, VISUAL_ADHESIVADO, 8),
          ]),
          falla('Exceso de adhesivo que traspasa o deja brillo', EF_ASPECTO, [
            causa('Cantidad de adhesivo por pieza sin referencia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    // Pedido de Calidad al revisar la Rev. A (02/10/2026): "limpieza de pistola - grumos". El
    // adhesivo mezclado va a la marmita (IO-08) y la limpieza de la pistola tiene instruccion
    // propia en el SGC (IO-15, Rev.01). Falta confirmar en la reunion de AMFE que en este
    // sector se limpia con esa instruccion y cada cuanto: por eso no lleva frecuencia.
    we('Machine', 'Pistola de adhesivado', [
      funcion(
        'Aplicar el adhesivo sin grumos',
        'Pistola limpia, sin restos de adhesivo seco',
        [
          falla('Grumos de adhesivo sobre la pieza', EF_ASPECTO, [
            causa('Restos de adhesivo seco en la pistola',
              'Limpieza de la pistola segun la instruccion IO-15',
              4, VISUAL_ADHESIVADO, 8),
          ]),
        ]),
    ]),
    // El secado del adhesivo (ficha tecnica del FA) se analizaba aca hasta el 20/10/2026; desde
    // el 21/10 esta en la OP 33, el almacenamiento donde las piezas quedan secando.
    // Riesgo cronico (vapores de solvente): P1-8, no 10. La ficha del adhesivo dice que es de
    // base solvente. Reunion de AMFE del 09/10/2026: el control de la extraccion lo hace
    // Seguridad e Higiene (turbinas y planilla de reposicion de filtros). La frecuencia de ese
    // control no se dijo: no cubre todos los turnos, P3-9.
    we('Environment', 'Sector de adhesivado', [
      funcion(
        'Mantener el puesto ventilado durante la aplicacion',
        'Extraccion en marcha mientras se adhesiva',
        [
          falla('Operario expuesto a los vapores del adhesivo', EF_SALUD_CRONICA, [
            causa('Adhesivo de base solvente que libera vapores',
              EXTRACCION,
              3, EXTRACCION_CONTROL, 9),
          ]),
        ]),
    ]),
    // Reunion de AMFE del 09/10/2026 ("agregar medio ambiente"): los residuos (latas de
    // adhesivo, trapos con solvente, recortes) se declaran como residuos especiales gestionados
    // con manifiesto, en general, sin detallar lo que va a chatarra. El control de la separacion
    // en el puesto no se nombro: D=10. Sigla: ninguna (21/10/2026, decidido con el pedido de Fak
    // "las decisiones del amfe tomalas vos"). Es un efecto en la planta, no una caracteristica
    // del producto: igual que las 8 causas de seguridad del operario (S=10) de este AMFE, que
    // tampoco llevan sigla. D/TLD no puede ser: es legal sobre el vehiculo y la designa VW.
    we('Environment', 'Residuos del sector de adhesivado', [
      funcion(
        'Separar los residuos con adhesivo o solvente como residuo especial',
        'Residuos especiales gestionados con manifiesto',
        [
          falla('Residuo con adhesivo o solvente descartado como comun', EF_RESIDUO, [
            causa('Latas, trapos y recortes con adhesivo en el puesto',
              'Residuos especiales gestionados con manifiesto',
              4, 'Sin control de la separacion de residuos en el puesto', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 31 — INSPECCION DE PIEZA ADHESIVADA
// El sector registra piezas OK, NOK y scrap por hora (planilla de PCP "Adhesivado IP y Upper
// Trimming"). No hay una referencia escrita de la zona que tiene que quedar cubierta.
//
// 02/10/2026: Calidad y el cliente pidieron no declarar el reproceso de falta de adhesivo (la
// operacion 32 de la primera Rev. A). La tarea no desaparece: completar el adhesivo donde falto
// es parte de esta operacion, y sus tres modos de falla siguen analizados aca (IATF 16949
// 8.7.1.4 pide el analisis de riesgo; sin el, en 2019 fue la no conformidad de la RAC N 2).
// ===========================================================================
const OP31 = operacion('31', 'INSPECCION DE PIEZA ADHESIVADA',
  'Verificar el adhesivado de la microfibra y del sustrato y completarlo donde falte, antes del activado',
  [
    we('Measurement', 'Control visual de la pieza adhesivada', [
      funcion(
        'Verificar que el adhesivo cubrio las dos partes de manera uniforme',
        'Sin zonas sin adhesivo y sin exceso, con registro de piezas conformes y no conformes',
        [
          // Lo que se le escapa a este control ya no se ve: el adhesivo queda tapado.
          falla('Pieza con falta de adhesivo que pasa el control', EF_DESPEGUE, [
            causa('Cobertura juzgada a ojo, sin referencia de la zona',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
        ]),
    ]),
    we('Method', 'Repaso de adhesivo en la zona faltante', [
      funcion(
        'Completar el adhesivo en la zona faltante sin cargar de mas el resto',
        'Adhesivo uniforme en la zona repasada',
        [
          // 08/10/2026 (auditoria de cliente): el repaso se hace DESPUES de la inspeccion de la
          // 31 y el adhesivo queda tapado al tapizar; la misma operacion dice que la pieza
          // repasada no vuelve a un control. Ningun control la ve: D=10.
          falla('Zona sin adhesivo que queda sin cubrir despues del repaso', EF_DESPEGUE, [
            causa('Adhesivo repuesto a mano en la zona faltante',
              OPERARIO,
              O_OPERARIO, 'Sin control posterior al repaso', 10),
          ]),
          falla('Exceso de adhesivo en la zona repasada', EF_ASPECTO, [
            causa('La zona repasada recibe una segunda capa',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Pieza repasada que pasa al activado sin control', EF_DESPEGUE, [
            causa('Pieza repasada sin identificacion',
              SIN_PREVENCION,
              10, 'Sin control posterior a la inspeccion de pieza adhesivada', 10),
          ]),
        ]),
    ]),
    // 08/10/2026 (auditoria de cliente): el repaso usa el mismo adhesivo de base solvente que la
    // OP 30, en el mismo sector: mismo riesgo y mismo control que en la OP 30.
    we('Environment', 'Sector de adhesivado', [
      funcion(
        'Mantener el puesto ventilado durante el repaso',
        'Extraccion en marcha mientras se repasa el adhesivo',
        [
          falla('Operario expuesto a los vapores del adhesivo en el repaso', EF_SALUD_CRONICA, [
            causa('Adhesivo de base solvente que libera vapores',
              EXTRACCION,
              3, EXTRACCION_CONTROL, 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 33 — ALMACENAMIENTO EN MEDIOS WIP PARA SECADO DEL ADHESIVO
// Reunion de AMFE del 09/10/2026 (audio, min 25:59): "y el adhesivo tambien tenes tu WIP", sin
// respuesta. 21/10/2026, Fak en planta (audio de WhatsApp, 0:49 a 1:08): las piezas adhesivadas
// necesitan quedar secando en algun lado y el medio no esta disenado; Fak, en el chat: "dijo que
// si vamos a necesitar un WIP, no esta disenado". Mismo criterio que la 22 (los WIP se declaran,
// decision de la reunion). El numero 32 no se usa: fue el reproceso de la primera Rev. A y la
// pregunta de si los reprocesos vuelven al flujograma sigue abierta. Medio, cantidad de piezas y
// tiempo de secado: sin definir.
// ===========================================================================
const OP33 = operacion('33', 'ALMACENAMIENTO EN MEDIOS WIP PARA SECADO DEL ADHESIVO',
  'Dejar secar el adhesivo de la microfibra y del sustrato hasta el activado sin danar las piezas',
  [
    we('Method', 'Medio WIP de secado', [
      funcion(
        'Guardar las piezas adhesivadas sin que el adhesivo toque nada ni junte suciedad',
        'Piezas separadas, con la cara adhesivada libre, identificadas por variante',
        [
          falla('Pieza adhesivada marcada o con suciedad pegada en el medio', EF_SCRAP_INTERNO, [
            causa('Medio de secado sin definir',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    // Ficha tecnica del adhesivo FA: se deja secar antes de reactivarlo con calor. Viene de la
    // OP 30 (hasta el 20/10/2026), sin cambios en la falla, la causa ni los controles.
    we('Method', 'Secado del adhesivo antes del activado', [
      funcion(
        'Dejar secar el adhesivo aplicado antes de activarlo',
        'Adhesivo seco antes del activado, segun la ficha tecnica del adhesivo',
        [
          falla('Pieza que pasa al activado con el adhesivo sin secar', EF_DESPEGUE, [
            causa('Piezas en espera sin la hora de adhesivado',
              SIN_PREVENCION,
              10, 'Sin registro de la hora de adhesivado en la pieza', 10),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 40 — ACTIVADO DEL ADHESIVO CON CALOR
// La ficha tecnica del adhesivo FA dice que el pegado se hace por reactivacion con calor
// (infrarrojo, flash o aire caliente) y posterior prensado; Fak lo confirmo el 01/10/2026. La
// lista de herramentales no tiene una maquina para esto, y ningun documento fija la
// temperatura ni el tiempo. El unico papel de la pieza que nombra una fuente de calor es el
// flujo de proceso de la cotizacion, y la nombra para el virolado (pistola de calor, OP 42):
// aca no se nombra la herramienta. Reunion de AMFE del 09/10/2026 (audio, min 12:30 a 13:17):
// se pregunto si la pistola de calor es para el adhesivo o para la tela ("son dos metodos
// totalmente distintos") y no hubo respuesta: el metodo lo define Ingenieria y hay que ver el
// proceso real. 21/10/2026: Fak lo pregunto en planta (audio de WhatsApp de esa manana, 0:15 a
// 0:26): "¿con que activamos el adhesivo? ¿con pistola de calor?" ... "por ahora si". Se nombra
// la pistola de calor; tiempo, distancia y temperatura siguen sin definir.
// ===========================================================================
const OP40 = operacion('40', 'ACTIVADO DEL ADHESIVO CON CALOR',
  'Reactivar con calor el adhesivo de la microfibra y del sustrato justo antes del tapizado',
  [
    we('Machine', 'Pistola de calor', [
      funcion(
        'Llevar el adhesivo de las dos partes a su temperatura de activado',
        'Adhesivo activado en toda la superficie, sin dano de la microfibra ni del sustrato',
        [
          falla('Adhesivo sin activar o activado en forma despareja', EF_DESPEGUE, [
            causa('Pistola de calor usada sin tiempo ni distancia definidos',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Pieza que se tapiza con el adhesivo ya enfriado', EF_DESPEGUE, [
            causa('Espera sin tiempo maximo entre activado y tapizado',
              SIN_PREVENCION,
              10, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Microfibra o sustrato marcado por exceso de calor', EF_ASPECTO, [
            causa('Pistola de calor sin temperatura ni tiempo de referencia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    // Guantes y ropa de trabajo: el equipo de proteccion del sector para el trabajo con calor.
    // Es un control de conducta: O=7, igual que en el refilado y en la prensa.
    we('Man', 'Operador de Produccion', [
      funcion(
        'Aplicar el calor sin exponerse a una quemadura',
        'Guantes puestos durante el activado',
        [
          falla('Quemadura del operario al aplicar el calor', EF_SEG_OPERARIO, [
            causa('Calor aplicado cerca de la mano que sostiene la pieza',
              GUANTE_CALOR_CORTE,
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
          falla('Microfibra desalineada respecto del sustrato o del hueco', EF_ASPECTO, [
            causa('La microfibra se posiciona a mano sobre el sustrato',
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
            causa('Microfibra estirada a mano sobre las curvas del sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          // La ficha del adhesivo pide reactivacion con calor y posterior prensado. El
          // prensado corto no se ve.
          falla('Microfibra asentada con presion insuficiente', EF_DESPEGUE, [
            causa('Presion de asentado manual, sin medicion',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
          falla('Microfibra con marcas de presion', EF_ASPECTO, [
            causa('Presion de asentado manual, sin referencia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra con burbujas o levantada del sustrato', EF_DESPEGUE, [
            causa('El asentado a mano no llega a los radios',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Cara vista de la microfibra manchada con adhesivo', EF_ASPECTO_TERMINACION, [
            causa('Restos de adhesivo en la mesa o en las manos',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 42 — VIROLADO + REFILADO
// A mano y con pistola de calor: lo dice el flujo de proceso de la cotizacion (20/08/2025),
// "el virolado se realiza manualmente con pistola de calor; tiene complejidad en el virolado
// del agujero interior". Para la pared del hueco del cargador existe un virolador que sostiene
// la microfibra mientras el adhesivo toma (utillaje propio, entregado el 20/08/2026). El
// pliego del 27/04/2026 dice que se refila "en zonas indicadas" y no nombra la herramienta.
// ===========================================================================
const OP42 = operacion('42', 'VIROLADO + REFILADO',
  'Doblar la microfibra sobre los bordes del sustrato y del hueco del cargador y cortar el sobrante',
  [
    we('Method', 'Virolado manual de los bordes', [
      funcion(
        'Dejar la microfibra doblada y pegada en todo el contorno',
        'Bordes virolados y adheridos, sin tela despegada',
        [
          falla('Borde de la microfibra despegado en el contorno', EF_DESPEGUE, [
            causa('El doblez se suelta antes de que el adhesivo tome',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Machine', 'Pistola de calor', [
      funcion(
        'Dar calor al borde para que el adhesivo tome en el doblez',
        'Borde adherido en todo el contorno, sin marcas de calor en la cara vista',
        [
          falla('Borde despegado por falta de calor en el doblez', EF_DESPEGUE, [
            causa('Pistola de calor usada sin tiempo ni distancia definidos',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra marcada o brillante por el calor en el borde', EF_ASPECTO, [
            causa('Pistola de calor sin temperatura ni tiempo de referencia',
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
            causa('La microfibra doblada se vuelve mientras el adhesivo toma',
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
            causa('Sobrante cortado a mano, sin guia',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra cortada de mas, con el sustrato a la vista', EF_SCRAP_VISTA, [
            causa('Herramienta guiada a mano contra el borde del sustrato',
              OPERARIO,
              O_OPERARIO, VISUAL_FINAL, 8),
          ]),
        ]),
    ]),
    we('Man', 'Operador de Produccion', [
      funcion(
        'Virolar y refilar sin exponerse al filo de la herramienta ni al calor de la pistola',
        'Guantes puestos durante el virolado y el refilado',
        [
          falla('Corte del operario con la herramienta de refilado', EF_SEG_OPERARIO, [
            causa('Refilado a mano con herramienta de filo expuesto',
              GUANTE_CALOR_CORTE,
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
          falla('Quemadura del operario con la pistola de calor', EF_SEG_OPERARIO, [
            causa('Pistola usada cerca de la mano que sostiene el doblez',
              GUANTE_CALOR_CORTE,
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
            causa('Cilindros seleccionados a mano segun la variante',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Recorte de microfibra que queda dentro del agujero', EF_MONTAJE, [
            causa('El troquel corta la microfibra pero no expulsa el recorte',
              SIN_PREVENCION,
              10, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra marcada o desgarrada alrededor del agujero', EF_ASPECTO, [
            causa('Troquel sin filo que arrastra la microfibra',
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
            causa('Mano dentro de la zona de troquelado al acomodar',
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
            causa('Temperatura del molde baja para la microfibra',
              'Hoja de proceso con control de temperatura antes de producir',
              9, VISUAL_FINAL, 8),
            causa('Carrera de la prensa corta para la pieza',
              'Hoja de proceso con los parametros de referencia del proveedor',
              9, VISUAL_FINAL, 8),
          ]),
          falla('Microfibra quemada, brillante o marcada alrededor del logo', EF_ASPECTO, [
            causa('Temperatura del molde alta para la microfibra',
              'Hoja de proceso con control de temperatura antes de producir',
              9, VISUAL_FINAL, 8),
            causa('Tiempo de prensado largo para la microfibra',
              'Hoja de proceso con los parametros de referencia del proveedor',
              9, VISUAL_FINAL, 8),
          ]),
          falla('Logo grabado fuera de posicion o girado', EF_ASPECTO, [
            causa('Pieza bajo el molde sin referencia de posicion',
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
            causa('Mano dentro de la zona de prensado al acomodar',
              'Mando bimanual y parada de emergencia de la prensa',
              3, 'Verificacion de parada de emergencia y mando bimanual en cada turno', 8),
          ]),
          falla('Quemadura del operario con el molde caliente', EF_SEG_OPERARIO, [
            causa('Molde caliente al alcance de la mano en la carga',
              'Guantes indicados en la hoja de proceso de la prensa',
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
  ]);

// ===========================================================================
// OP 70 — TERMINACION Y CONTROL FINAL DE CALIDAD
// Visual al 100 %. El plano pide la pieza sin defectos visibles; no hay muestra patron ni
// criterios escritos, ni ensayo de adherencia de serie.
//
// 02/10/2026: Calidad reviso la Rev. A y pidio que los reprocesos 71 (reactivacion de adhesivo
// por calor) y 72 (mancha de adhesivo) no se declaren como reproceso: "poner como operacion de
// terminacion" (notas de Agustina; marcas de Cecilia Rodriguez sobre el flujograma). Segun Fak
// lo pidio el cliente en la visita de ese dia. Las dos tareas pasan a ser la terminacion de la
// pieza, en este mismo puesto, y sus modos de falla siguen analizados aca: IATF 16949 8.7.1.4
// pide el analisis de riesgo de lo que se retrabaja, y en 2019 la auditoria externa le marco a
// Barack una no conformidad por un retrabajo de tapizado sin AMFE ni instruccion (RAC N 2).
// Ninguna de las dos tareas tiene hoja escrita para esta pieza.
// ===========================================================================
const OP70 = operacion('70', 'TERMINACION Y CONTROL FINAL DE CALIDAD',
  'Terminar la pieza y controlarla al 100 % antes de embalarla',
  [
    we('Method', 'Terminacion de bordes con calor', [
      funcion(
        'Volver a pegar con calor y presion el borde que quedo levantado',
        'Microfibra adherida en todo el contorno, sin marcas en la cara vista',
        [
          falla('Borde que vuelve a despegarse despues de la terminacion', EF_DESPEGUE, [
            causa('Calor y presion aplicados a mano',
              OPERARIO,
              O_OPERARIO, ADHERENCIA, D_ADHERENCIA),
          ]),
          // 08/10/2026 (auditoria de cliente): esta misma operacion dice que no hay secuencia
          // definida entre la terminacion y el control: no se puede acreditar el control final.
          falla('Microfibra marcada o brillante por el calor de la terminacion', EF_ASPECTO, [
            causa('Calor sobre la cara vista sin temperatura de referencia',
              OPERARIO,
              O_OPERARIO, 'Sin control posterior a la terminacion', 10),
          ]),
        ]),
    ]),
    we('Method', 'Limpieza de restos de adhesivo', [
      funcion(
        'Quitar los restos de adhesivo de la cara vista sin marcar la microfibra',
        'Cara vista sin restos de adhesivo ni marcas de la limpieza',
        [
          falla('Cara vista con restos de adhesivo o marcada al limpiar', EF_ASPECTO, [
            causa('Limpieza a mano sobre la cara vista',
              OPERARIO,
              O_OPERARIO, 'Sin control posterior a la terminacion', 10),
          ]),
        ]),
    ]),
    // 08/10/2026 (auditoria de cliente): la terminacion aplica calor como el activado (OP 40) y
    // el virolado (OP 42), en el mismo sector: mismo riesgo y mismo control que en la OP 40.
    we('Man', 'Operador de Produccion', [
      funcion(
        'Aplicar el calor de la terminacion sin exponerse a una quemadura',
        'Guantes puestos durante la terminacion',
        [
          falla('Quemadura del operario en la terminacion con calor', EF_SEG_OPERARIO, [
            causa('Calor aplicado cerca de la mano que sostiene la pieza',
              GUANTE_CALOR_CORTE,
              7, 'Control del uso de guantes en el recorrido de turno', 9),
          ]),
        ]),
    ]),
    we('Measurement', 'Control visual de la pieza terminada', [
      funcion(
        'Detectar en la pieza terminada los defectos del tapizado, de los agujeros y del logo',
        'Sin defectos visibles segun el plano: rayones, manchas, bordes sueltos ni arrugas; todos los agujeros libres; logo completo y en posicion',
        [
          // Lo que se le escapa a este control no lo mira nadie despues: D=10.
          falla('Pieza con un defecto que pasa el control final', EF_ESCAPE, [
            causa('Aspecto juzgado a ojo, sin muestra patron ni criterios',
              SIN_PREVENCION,
              10, 'Sin control posterior al control final', 10),
          ]),
        ]),
      funcion(
        'Controlar la pieza despues de terminarla',
        'Toda pieza terminada pasa por el control visual antes de embalarla',
        [
          falla('Pieza embalada sin control despues de la terminacion', EF_ESCAPE, [
            causa('Sin secuencia definida entre la terminacion y el control',
              SIN_PREVENCION,
              10, 'Sin control posterior al control final', 10),
          ]),
        ]),
      funcion(
        'Verificar la adherencia de la microfibra sobre el sustrato',
        'Adherencia segun TL 496 y PV 2034',
        [
          falla('Pieza con adherencia baja que pasa el control final', EF_DESPEGUE, [
            causa('La adherencia no se ve en un control visual',
              SIN_PREVENCION,
              10, ADHERENCIA, D_ADHERENCIA),
          ]),
        ]),
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
          falla('Medio con una cantidad distinta de la de la gama', EF_CANTIDAD, [
            causa('Piezas contadas a mano por piso',
              'Gama de embalaje con piezas por piso y pisos por medio',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          falla('Pieza embalada en el medio de la otra variante', EF_VARIANTE, [
            causa('Variantes embaladas juntas, se diferencian por un hueco',
              SIN_PREVENCION,
              10, 'Sin control de la variante de cada pieza al armar el medio', 10),
          ]),
          falla('Medio con una etiqueta que no corresponde', EF_VARIANTE, [
            causa('La etiqueta se coloca a mano al completar el medio',
              'Etiqueta definida en la gama de embalaje',
              4, 'Autocontrol segun P-09/I', 8),
          ]),
          // El carton separa los pisos, no las piezas de un mismo piso: son dos causas. Lo que
          // se marca adentro del medio cerrado ya no lo ve nadie en planta: D=10.
          falla('Microfibra marcada o sucia por el propio embalaje', EF_ASPECTO_CLIENTE, [
            causa('Piezas apoyadas sobre las del piso de abajo',
              'Carton entre pisos y lado vista hacia arriba, segun gama',
              4, 'Sin control del medio despues de cerrado', 10),
            causa('Piezas de un mismo piso en contacto entre si',
              SIN_PREVENCION,
              10, 'Sin control del medio despues de cerrado', 10),
          ]),
        ]),
    ]),
  ]);

const OPERACIONES = [OP10, OP20, OP21, OP22, OP30, OP31, OP33, OP40, OP41, OP42, OP50, OP60, OP70, OP80];

const doc = {
  header: {
    scope: 'UPPER TRIM PANEL - CONSOLA CENTRAL - VW427 PATAGONIA - COZZUOL / VW',
    subject: 'UPPER TRIM PANEL - CONSOLA CENTRAL',
    partNumber: 'MP8404 / MP8405',
    // El plano 2HC.864.263 (hoja 4) no le da numero propio a la cubierta suede (items 17 a 20):
    // los numeros son de los CONJUNTOS en los que va. La SINGLE va en el .C y en el .D.
    applicableParts: [
      'MP8405 SINGLE 50W SUEDE COVER FRAME (conjuntos 2HC.864.263.C y 2HC.864.263.D)',
      'MP8404 DUAL 50W SUEDE COVER FRAME (conjunto 2HC.864.263.B)',
    ].join(', '),
    client: 'COZZUOL',
    customerName: 'COZZUOL / VW',
    companyName: 'BARACK MERCOSUL',
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    modelYear: 'VW427 PATAGONIA',
    amfeNumber: NUMERO_EMPRESA,
    rev: REV,
    revisionLevel: REV,
    amfeDate: FECHA,
    revDate: REV_FECHA,
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
    // La fila de la PROXIMA letra se agrega recien cuando el documento se emite (amfe.md 4bis).
    // Fak, 08/10/2026: "la revision B solo se hace cuando vamos a someter el APQP al cliente";
    // el criterio exacto lo define la tarea aparte que se abrio ese dia. Texto ya preparado:
    // PROXIMA_REVISION, abajo.
  ],
};

// ---------------------------------------------------------------------------
// Estadisticas y chequeos propios
// ---------------------------------------------------------------------------
// Los chequeos de autoria son los comunes (scripts/_lib/amfeAutoria.mjs): operaciones del
// flujograma en su orden y con su nombre, tres efectos, AP de la tabla, un control que no
// existe lleva 10, scrap con S >= 7, niveles de funcion distintos, sin TBD.
const flujo = JSON.parse(readFileSync(FLUJOGRAMA, 'utf8'));
// El chequeo comun no cuenta un almacenado numerado como operacion con AMFE (criterio de la
// casa hasta la reunion del 09/10/2026). En este AMFE el WIP 22 si va: se lo marca como paso
// solo para la comparacion, sin tocar el flujograma ni el chequeo de los demas AMFE.
const ALMACENAMIENTOS_CON_AMFE = ['22', '33'];
const flujoParaChequeo = JSON.parse(JSON.stringify(flujo), (k, v) => (
  v && v.type === 'storage' && ALMACENAMIENTOS_CON_AMFE.includes(String(v.stepId)) ? { ...v, type: 'operation' } : v));
const { errores, stats, candidatas, sinPrevencion, sinDeteccion } = chequeosDeAutoria(doc, {
  flujograma: flujoParaChequeo,
  controlDeConducta: { texto: OPERARIO, o: O_OPERARIO },
});
const { nWE, nFn, nFM, nCausas, apCount } = stats;

// LOS MATERIALES DE LA RECEPCION SON LOS DE LA BOM DEL ARB, en las dos direcciones (Fak,
// 02/10/2026, antes de pasarle el AMFE a Calidad: "fijate si tiene los materiales el AMFE, eso
// es importante"). Cada codigo de insumo de la BOM dice que material de la OP 10 lo cubre.
// La etiqueta no es materia prima que se recibe y se controla como tal: se trata en el embalaje.
const PRODUCTOS_ARB = ['MP8404', 'MP8405'];
const COBERTURA_BOM = {
  '13600': 'Sustrato plastico consignado por Cozzuol',
  '13601': 'Sustrato plastico consignado por Cozzuol',
  '9PQ009-BK25-2': 'Microfibra suede Meisheng MS-9PQ009-BK25-2',
  'AD - ADFA15': 'Adhesivo FA y reticulante GV',
  'AD - REGV0.6': 'Adhesivo FA y reticulante GV',
  'ET-SATO-50X20': { fuera: 'etiqueta de identificacion: se coloca y se controla en el embalaje (OP 80)' },
};
let notaBom;
if (process.argv.includes('--sin-bom')) {
  notaBom = 'OJO: corrida con --sin-bom, los materiales NO se cruzaron contra la BOM del arb.';
  // --sin-bom es para armar y mirar sin el export a mano. A Supabase no se escribe sin el cruce.
  if (APPLY) errores.push('--sin-bom no va junto con --apply: sin cruzar los materiales con la BOM del arb no se escribe');
} else {
  try {
    const { lineas, fecha } = leerBomDelArb(PRODUCTOS_ARB);
    const fallasBom = materialesContraBom({ doc, bom: lineas, cobertura: COBERTURA_BOM });
    errores.push(...fallasBom);
    notaBom = `materiales contra la BOM del arb (export del ${fecha.toISOString().slice(0, 10)}): ${fallasBom.length ? `${fallasBom.length} diferencias` : 'cierra en las dos direcciones'}`;
  } catch (e) {
    errores.push(`no se pudo cruzar con la BOM del arb: ${e.message}`);
    notaBom = 'materiales contra la BOM del arb: NO SE PUDO LEER';
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
console.log(`  ${notaBom}`);

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
  last_revision_date: REV_FECHA_ISO,
  revision_level: REV,
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

// Fila de revision preparada para la proxima emision (cambios con OK de Fak del 08/10/2026:
// pedido de Cozzuol de no declarar reprocesos, observaciones de Calidad del 02/10, D/TLD).
// eslint-disable-next-line no-unused-vars
const PROXIMA_REVISION = {
  // 20/10/2026: se suman la inflamabilidad sobre la pieza tapizada (VW, 16/10) y lo de la
  // reunion de AMFE del 09/10. La parte de los reprocesos sigue esperando la validacion de
  // Calidad (mail de Fak del 19/10).
  item: '10, 20, 22, 30, 31, 32, 33, 40, 42, 70, 71, 72',
  details: 'OP 32 SE INTEGRA A LA OP 31: EL REPASO DE ADHESIVO ES PARTE DE LA INSPECCION DE PIEZA ADHESIVADA. OP 71 Y 72 SE INTEGRAN A LA OP 70, QUE PASA A TERMINACION Y CONTROL FINAL DE CALIDAD (REACTIVACION DE BORDES CON CALOR Y LIMPIEZA DE ADHESIVO). OP 30: GRUMOS DE ADHESIVO POR PISTOLA SUCIA. OP 10 Y 20: LA INFLAMABILIDAD SE VALIDA CON LA PIEZA TAPIZADA (VW); SALE EL ENSAYO DE LA MICROFIBRA Y LA D/TLD QUEDA EN LA OP 10. OP 10: SUSTRATO CONSIGNADO CON CONTROL VISUAL. OP 20: SENTIDO DEL PELO. OP 22: ALMACENAMIENTO WIP. OP 33: ALMACENAMIENTO WIP PARA SECADO DEL ADHESIVO (EL SECADO PASA DE LA OP 30 A LA 33). OP 40: ACTIVADO CON PISTOLA DE CALOR. OP 30 Y 31: EXTRACCION Y RESIDUOS ESPECIALES. OP 40, 42 Y 70: GUANTES CALOR-CORTE. OP 31 Y 70: RIESGOS DEL OPERARIO EN EL REPASO Y EN LA TERMINACION.',
};
