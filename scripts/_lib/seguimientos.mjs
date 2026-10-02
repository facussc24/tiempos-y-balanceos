/**
 * seguimientos.mjs — logica pura de los SEGUIMIENTOS CON FECHA (lo que hay que volver a pedir
 * hasta que alguien conteste). La usan `scripts/_seguimientos.mjs` y su test.
 *
 * Pedido de Fak, 02/10/2026: "deberiamos tener memorias con fechas que chequees constantemente
 * en las sesiones o minimo 1 vez al dia... no me puedo olvidar de esto... el lunes y el viernes
 * de cada semana debemos insistir... a la tercera vez que no me respondan pongo al director en copia".
 *
 * Un seguimiento:
 *   { id, que, abierto: 'AAAA-MM-DD', dias: ['lunes','viernes'], estado: 'abierto'|'cerrado',
 *     intentos: [{ fecha, que, enviado }],          // cuenta solo lo que SALIO (enviado: true)
 *     escalar: { despues_de: 3, sumar_cc: ['...'] },  // con 3 enviados sin respuesta, el siguiente lleva la copia
 *     se_cierra_cuando, mail: { asunto, para, cc } }
 *
 * Los datos NO viven en el repo (es publico): viven en la memoria `project_seguimientos_con_fecha.md`,
 * adentro de un bloque ```json. Este modulo solo calcula.
 *
 * EL ERROR CARO ES QUE EL AVISO SE CALLE. Auditoria del 02/10/2026 (dos fallas reales):
 *   1. un dato mal escrito (un dia con un typo, una fecha en otro formato) dejaba el arranque
 *      MUDO, y un seguimiento malo callaba a los sanos. Ahora cada seguimiento se evalua
 *      aparte y el que esta mal escrito se AVISA con su error, por la misma salida que los demas.
 *   2. un borrador sin enviar contaba como "ya se hizo hoy" y como "ultimo pedido": apagaba el
 *      aviso hasta el proximo dia de insistencia. Ahora solo cuenta lo ENVIADO, y el borrador
 *      que quedo esperando se avisa en cada arranque.
 */

export const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** 'AAAA-MM-DD' -> Date local a las 12:00 (el mediodia evita el corrimiento por huso horario). */
export function aFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) throw new Error(`fecha invalida: "${iso}" (va AAAA-MM-DD)`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  // 2026-02-31 "existe" para Date (lo corre a marzo): la fecha tiene que volver igual.
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    throw new Error(`fecha que no existe: "${iso}"`);
  }
  return d;
}

export function aIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const nombreDia = (iso) => DIAS[aFecha(iso).getDay()];

function sumarDias(iso, n) {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aIso(d);
}

/** Dias de insistencia (por nombre) -> indices 0..6. Un nombre que no existe es un error, no se ignora. */
export function diasDeInsistencia(seg) {
  if (!Array.isArray(seg.dias) || !seg.dias.length) throw new Error(`el seguimiento "${seg.id}" no dice que dias se insiste (dias: ["lunes", "viernes"])`);
  return seg.dias.map((nombre) => {
    const i = DIAS.indexOf(sinTildes(nombre));
    if (i < 0) throw new Error(`el seguimiento "${seg.id}" nombra un dia que no existe: "${nombre}"`);
    return i;
  });
}

/**
 * Estado de UN seguimiento al dia `hoy`. Tira un error si el seguimiento esta mal escrito
 * (sin fecha de apertura, un dia que no existe, un intento con la fecha en otro formato):
 * el que llama decide como avisarlo, pero NO se calcula sobre datos rotos.
 *   enviados          cuantos pedidos salieron de verdad
 *   ultimo            fecha del ultimo pedido ENVIADO (o el dia que se abrio, si no salio ninguno)
 *   tocaHoy           hoy es dia de insistir (o quedo uno atrasado) y hoy todavia no SALIO nada
 *   atrasado          paso un dia de insistencia despues del ultimo envio y no salio nada
 *   proxima           proxima fecha de insistencia (hoy, si toca o esta atrasado)
 *   proximoNumero     que numero de pedido seria el siguiente
 *   escala / cc       si el siguiente ya lleva la copia de escalamiento, y a quien
 *   sinEnviar         el primer pedido todavia no salio
 *   borradorPendiente fecha del borrador que se armo despues del ultimo envio y sigue sin salir
 */
export function estadoDe(seg, hoy) {
  aFecha(hoy);
  aFecha(seg.abierto);
  const idx = diasDeInsistencia(seg);
  if (seg.intentos !== undefined && !Array.isArray(seg.intentos)) throw new Error(`el seguimiento "${seg.id}" tiene "intentos" que no es una lista`);
  const intentos = seg.intentos || [];
  for (const i of intentos) aFecha(i.fecha);

  const posUltimoEnviado = intentos.map((i) => !!i.enviado).lastIndexOf(true);
  const fechasEnviadas = intentos.filter((i) => i.enviado).map((i) => i.fecha).sort();
  const enviados = fechasEnviadas.length;
  const ultimo = enviados ? fechasEnviadas[enviados - 1] : seg.abierto;
  const salioHoy = fechasEnviadas.includes(hoy);
  const pendientes = intentos.slice(posUltimoEnviado + 1).filter((i) => !i.enviado);
  const borradorPendiente = pendientes.length ? pendientes[pendientes.length - 1].fecha : null;

  const esDia = (iso) => idx.includes(aFecha(iso).getDay());
  let atrasado = false;
  for (let d = sumarDias(ultimo, 1); d < hoy; d = sumarDias(d, 1)) {
    if (esDia(d)) { atrasado = true; break; }
  }
  const sinEnviar = enviados === 0;
  const tocaHoy = !salioHoy && (esDia(hoy) || atrasado) && hoy > seg.abierto;

  let proxima = hoy;
  if (!tocaHoy) {
    proxima = sumarDias(hoy, 1);
    while (!esDia(proxima)) proxima = sumarDias(proxima, 1);
  }
  const despuesDe = Number(seg.escalar?.despues_de);
  const cc = Array.isArray(seg.escalar?.sumar_cc) ? seg.escalar.sumar_cc.filter(Boolean) : [];
  const escala = seg.escalar?.despues_de !== undefined && seg.escalar?.despues_de !== null
    && Number.isFinite(despuesDe) && enviados >= despuesDe;
  return {
    enviados, ultimo, tocaHoy, atrasado: atrasado && !salioHoy, proxima,
    proximoNumero: enviados + 1, escala, cc: escala ? cc : [], sinEnviar, borradorPendiente,
  };
}

export function abiertos(datos) {
  if (!datos || !Array.isArray(datos.seguimientos)) throw new Error('el bloque json no tiene la lista "seguimientos"');
  return datos.seguimientos.filter((s) => s && s.estado !== 'cerrado');
}

const fechaCorta = (iso) => `${nombreDia(iso)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const conCopia = (e) => (e.escala ? ` CON ${e.cc.length ? e.cc.join(' y ') : 'LA COPIA DE ESCALAMIENTO (falta cargar a quien)'} EN COPIA` : '');

export const TOPE_HOOK = 10;   // seguimientos que se detallan en el arranque; el resto se cuenta

/** El renglon de UN seguimiento para el arranque. Si esta mal escrito, lo dice: nunca se calla. */
export function renglonHook(s, hoy) {
  const id = s?.id || '(sin id)';
  let e;
  try {
    e = estadoDe(s, hoy);
  } catch (err) {
    return `- ${id}: ESTA MAL ESCRITO en la memoria y no se puede saber si hoy toca (${err.message}). Arreglarlo AHORA y decirselo a Fak.`;
  }
  let l = `- ${id}: ${s.que}. `;
  if (e.sinEnviar) {
    l += `EL PRIMER PEDIDO TODAVIA NO SALIO (abierto el ${fechaCorta(s.abierto)}${e.borradorPendiente ? `, borrador armado el ${fechaCorta(e.borradorPendiente)}` : ''}): decirselo a Fak al empezar. `;
  } else if (e.tocaHoy) {
    l += `HOY TOCA INSISTIR${e.atrasado ? ' (atrasado)' : ''}: pedido numero ${e.proximoNumero}, el ultimo ENVIADO fue el ${fechaCorta(e.ultimo)}. `;
    l += e.borradorPendiente
      ? `Ya hay un borrador de ese pedido armado el ${fechaCorta(e.borradorPendiente)} SIN ENVIAR: no armar otro, decirselo a Fak al empezar. `
      : `Antes mirar si contestaron; si no, dejarle a Fak el borrador listo${conCopia(e)} y decirselo al empezar. `;
    l += 'No se envia sin su OK. ';
  } else {
    l += `${e.enviados} pedido(s) enviados, el ultimo el ${fechaCorta(e.ultimo)}; se insiste el ${fechaCorta(e.proxima)}${conCopia(e)}. `;
    if (e.borradorPendiente) l += `OJO: hay un borrador armado el ${fechaCorta(e.borradorPendiente)} SIN ENVIAR. `;
  }
  if (s.se_cierra_cuando) l += `Se cierra cuando: ${s.se_cierra_cuando}.`;
  return l.trim();
}

/** Texto para el hook de arranque: corto, y vacio SOLO si no hay nada abierto. */
export function textoHook(datos, hoy) {
  const segs = abiertos(datos);
  if (!segs.length) return '';
  const lineas = ['[SEGUIMIENTOS CON FECHA — Fak, 02/10/2026: "no me puedo olvidar de esto". Detalle: memoria project_seguimientos_con_fecha]'];
  for (const s of segs.slice(0, TOPE_HOOK)) lineas.push(renglonHook(s, hoy));
  if (segs.length > TOPE_HOOK) lineas.push(`... y ${segs.length - TOPE_HOOK} mas: node scripts/_seguimientos.mjs los lista todos.`);
  return lineas.join('\n');
}

/**
 * Saca de la memoria el bloque ```json que tiene la lista "seguimientos" (puede haber otro
 * bloque json de ejemplo antes). Devuelve { datos, antes, despues, salto } para reescribirlo.
 */
export function leerBloque(md) {
  const re = /```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g;
  let m;
  let primerError = null;
  while ((m = re.exec(md)) !== null) {
    let datos;
    try { datos = JSON.parse(m[1]); } catch (e) { primerError = primerError || e; continue; }
    if (datos && typeof datos === 'object' && 'seguimientos' in datos) {
      return { datos, antes: md.slice(0, m.index), despues: md.slice(m.index + m[0].length), salto: md.includes('\r\n') ? '\r\n' : '\n' };
    }
  }
  if (primerError) throw new Error(`el bloque json de la memoria de seguimientos no se puede leer: ${primerError.message}`);
  throw new Error('la memoria de seguimientos no tiene un bloque ```json con la lista "seguimientos"');
}

export function escribirBloque({ datos, antes, despues, salto = '\n' }) {
  const json = JSON.stringify(datos, null, 2).split('\n').join(salto);
  return `${antes}\`\`\`json${salto}${json}${salto}\`\`\`${despues}`;
}

export function buscar(datos, id) {
  const lista = Array.isArray(datos?.seguimientos) ? datos.seguimientos : [];
  const s = lista.find((x) => x && x.id === id);
  if (!s) throw new Error(`no hay un seguimiento "${id}" (hay: ${lista.map((x) => x?.id).join(', ') || 'ninguno'})`);
  return s;
}

/**
 * Anota un intento. Se valida TODO antes de tocar los datos: un seguimiento mal escrito, uno
 * cerrado, una fecha futura o un envio repetido el mismo dia no se anotan (un envio contado dos
 * veces adelanta la copia al director un mail antes).
 */
export function anotar(datos, id, { fecha, que, enviado, hoy }) {
  const s = buscar(datos, id);
  if (s.estado === 'cerrado') throw new Error(`el seguimiento "${id}" esta cerrado: no se anota nada`);
  if (!que || String(que).startsWith('--')) throw new Error('falta --que: que se hizo');
  aFecha(fecha);
  if (hoy && fecha > hoy) throw new Error(`la fecha ${fecha} es futura (hoy es ${hoy})`);
  estadoDe(s, hoy || fecha);
  if (enviado && (s.intentos || []).some((i) => i.enviado && i.fecha === fecha)) {
    throw new Error(`ya hay un pedido ENVIADO anotado el ${fecha} en "${id}": no se cuenta dos veces`);
  }
  s.intentos = [...(s.intentos || []), { fecha, que: String(que), enviado: !!enviado }];
  return s;
}

export function cerrar(datos, id, { fecha, motivo }) {
  const s = buscar(datos, id);
  if (!motivo || String(motivo).startsWith('--')) throw new Error('falta --motivo: por que se cierra');
  aFecha(fecha);
  s.estado = 'cerrado';
  s.cerrado = { fecha, motivo: String(motivo) };
  return s;
}
