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
 */

export const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** 'AAAA-MM-DD' -> Date local a las 12:00 (el mediodia evita el corrimiento por huso horario). */
export function aFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) throw new Error(`fecha invalida: "${iso}" (va AAAA-MM-DD)`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
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
  const dias = (seg.dias || []).map(sinTildes);
  if (!dias.length) throw new Error(`el seguimiento "${seg.id}" no dice que dias se insiste`);
  return dias.map((d) => {
    const i = DIAS.indexOf(d);
    if (i < 0) throw new Error(`el seguimiento "${seg.id}" nombra un dia que no existe: "${d}"`);
    return i;
  });
}

/**
 * Estado de UN seguimiento al dia `hoy`.
 *   enviados        cuantos pedidos salieron de verdad
 *   ultimo          fecha del ultimo movimiento (el ultimo intento, o el dia que se abrio)
 *   tocaHoy         hoy es dia de insistir y hoy todavia no se hizo nada
 *   atrasado        paso un dia de insistencia despues del ultimo movimiento y nadie insistio
 *   proxima         proxima fecha de insistencia (hoy, si toca o esta atrasado)
 *   proximoNumero   que numero de pedido seria el siguiente
 *   escala / cc     si el siguiente ya lleva la copia de escalamiento, y a quien
 *   sinEnviar       el primer pedido todavia no salio (borrador armado, falta mandarlo)
 */
export function estadoDe(seg, hoy) {
  const idx = diasDeInsistencia(seg);
  const intentos = seg.intentos || [];
  const enviados = intentos.filter((i) => i.enviado).length;
  const fechas = intentos.map((i) => i.fecha).filter(Boolean).sort();
  const ultimo = fechas.length ? fechas[fechas.length - 1] : seg.abierto;
  const hechoHoy = intentos.some((i) => i.fecha === hoy);

  const esDia = (iso) => idx.includes(aFecha(iso).getDay());
  let atrasado = false;
  for (let d = sumarDias(ultimo, 1); d < hoy; d = sumarDias(d, 1)) {
    if (esDia(d)) { atrasado = true; break; }
  }
  const sinEnviar = enviados === 0;
  const tocaHoy = !hechoHoy && (esDia(hoy) || atrasado) && hoy > seg.abierto;

  let proxima = hoy;
  if (!tocaHoy) {
    proxima = sumarDias(hoy, 1);
    while (!esDia(proxima)) proxima = sumarDias(proxima, 1);
  }
  const despuesDe = seg.escalar?.despues_de;
  const escala = Number.isFinite(despuesDe) && enviados >= despuesDe;
  return {
    enviados, ultimo, tocaHoy, atrasado: atrasado && !hechoHoy, proxima,
    proximoNumero: enviados + 1, escala, cc: escala ? (seg.escalar.sumar_cc || []) : [], sinEnviar,
  };
}

export const abiertos = (datos) => (datos?.seguimientos || []).filter((s) => s.estado !== 'cerrado');

const fechaCorta = (iso) => `${nombreDia(iso)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Texto para el hook de arranque: corto, y vacio si no hay nada abierto. */
export function textoHook(datos, hoy) {
  const segs = abiertos(datos);
  if (!segs.length) return '';
  const lineas = ['[SEGUIMIENTOS CON FECHA — Fak, 02/10/2026: "no me puedo olvidar de esto". Detalle: memoria project_seguimientos_con_fecha]'];
  for (const s of segs) {
    const e = estadoDe(s, hoy);
    let l = `- ${s.id}: ${s.que}. `;
    if (e.sinEnviar) l += `EL PRIMER PEDIDO TODAVIA NO SALIO (borrador armado el ${fechaCorta(s.abierto)}): decirselo a Fak al empezar. `;
    else if (e.tocaHoy) l += `HOY TOCA INSISTIR${e.atrasado ? ' (atrasado)' : ''}: pedido numero ${e.proximoNumero}, el ultimo fue el ${fechaCorta(e.ultimo)}. Antes mirar si contestaron; si no, dejarle a Fak el borrador listo${e.escala ? ` CON ${e.cc.join(' y ')} EN COPIA` : ''} y decirselo al empezar. No se envia sin su OK. `;
    else l += `${e.enviados} pedido(s) enviados, el ultimo el ${fechaCorta(e.ultimo)}; se insiste el ${fechaCorta(e.proxima)}. `;
    if (s.se_cierra_cuando) l += `Se cierra cuando: ${s.se_cierra_cuando}.`;
    lineas.push(l.trim());
  }
  return lineas.join('\n');
}

/** Saca el bloque ```json de la memoria. Devuelve { datos, antes, despues } para poder reescribirlo. */
export function leerBloque(md) {
  const m = /```json\s*\n([\s\S]*?)\n```/.exec(md);
  if (!m) throw new Error('la memoria de seguimientos no tiene el bloque ```json');
  return { datos: JSON.parse(m[1]), antes: md.slice(0, m.index), despues: md.slice(m.index + m[0].length) };
}

export function escribirBloque({ datos, antes, despues }) {
  return `${antes}\`\`\`json\n${JSON.stringify(datos, null, 2)}\n\`\`\`${despues}`;
}

export function buscar(datos, id) {
  const s = (datos.seguimientos || []).find((x) => x.id === id);
  if (!s) throw new Error(`no hay un seguimiento "${id}" (hay: ${(datos.seguimientos || []).map((x) => x.id).join(', ') || 'ninguno'})`);
  return s;
}

export function anotar(datos, id, { fecha, que, enviado }) {
  const s = buscar(datos, id);
  if (!que) throw new Error('falta --que: que se hizo');
  aFecha(fecha);
  s.intentos = [...(s.intentos || []), { fecha, que, enviado: !!enviado }];
  return s;
}

export function cerrar(datos, id, { fecha, motivo }) {
  const s = buscar(datos, id);
  if (!motivo) throw new Error('falta --motivo: por que se cierra');
  s.estado = 'cerrado';
  s.cerrado = { fecha, motivo };
  return s;
}
