// permisoUnUso.mjs — un permiso de un solo uso (`~/.claude/.apqp-listado-ok` y los demas de Fak) lo arma la sesion solo
// con la frase de Fak en el mismo turno, citada en el comando (tanda 3 del plan del sistema, pieza 9, 16/10/2026).
//
// POR QUE: el informe de CATA del 15/10/2026 (`casa_guardianes_frenos.md`, seccion 3 bis) midio 10 permisos armados por
// la propia sesion en 30 dias: 4 con un si explicito de Fak en su ultimo mensaje, 2 sin ningun si visible, y el
// `touch ~/.claude/.arb-cerrar-ok && taskkill //F //PID 17096` del 02/10 15:17, que se apoyo en «vos deberias
// solucionarlo todo automaticamente»: el freno no evito nada. El permiso era una puerta que la sesion se abria sola.
//
// QUE HACE: si un comando ARMA un permiso de Fak (redireccion, touch, New-Item, Set-Content, Out-File, cp, mkdir), pide la
// cita `# Fak DD/MM HH:MM: "texto"` y la compara con el ULTIMO mensaje real de Fak del transcript (el mismo filtro que el
// OK de un mail: `mensajesDeFak` de mailOkFak.mjs): el texto citado tiene que estar en ese mensaje y la hora tiene que ser
// la suya. Un formato bien escrito con un texto que Fak no dijo no pasa. Sin transcript que leer, frena (falla cerrado).
// Armar el permiso con la tool Write/Edit frena siempre: el permiso se arma por consola, con la cita a la vista.
// Lo que no frena: leer, listar o borrar un permiso, y los pases que la regla de su guardian deja a la propia sesion
// (`de_la_sesion` del canon `permisosUnUso.data.json`).
//
// LIMITE CONOCIDO: mira el texto del comando; un script que crea el archivo por dentro (fs.writeFileSync en un .mjs
// corrido por ruta) no lo nombra. Es una red contra el habito, como commit-rutas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinCuerposHeredoc, comandosSimples } from './shellTexto.mjs';
import { mensajesDeFak } from './mailOkFak.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
let _canon;
export function canonPermisos() {
  if (_canon === undefined) {
    try { _canon = JSON.parse(fs.readFileSync(path.join(AQUI, 'permisosUnUso.data.json'), 'utf8')); } catch { _canon = null; }
  }
  return _canon;
}

const escaparRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function permisoRe(lista) {
  // `~/.claude/./.x` es la misma ruta (auditor Opus 17/10)
  return new RegExp(`(?:^|[\\\\/])\\.claude[\\\\/]+(?:\\.[\\\\/]+)*(${lista.map((p) => escaparRe(p.archivo)).join('|')})(?![\\w.-])`, 'i');
}
const VERBO_ARMA = /^(?:touch|New-Item|ni|Set-Content|sc|Out-File|Add-Content|ac|cp|copy|Copy-Item|cpi|install|mkdir|md|tee|mv|move|Move-Item|mi|ln)$/i;
const VERBO_DESTINO = /^(?:cp|copy|Copy-Item|cpi|install|mv|move|Move-Item|mi|ln)$/i;
// Si el canon no se puede leer no se sabe que permisos son de Fak: un comando que arma algo con forma de permiso frena
// (falla cerrado; auditor Opus 17/10).
const FORMA_PERMISO = /(?:^|[\\/])\.claude[\\/]+(?:\.[\\/]+)*(\.[\w-]+-ok|\.agent-limit)(?![\w.-])/i;

/** Los permisos DE FAK que el comando ARMA: ['.apqp-listado-ok', ...] ([] si ninguno). Leer o borrar no cuenta. */
export function permisosQueArma(cmd) {
  const canon = canonPermisos();
  const re = canon?.de_fak?.length ? permisoRe(canon.de_fak) : FORMA_PERMISO;
  const c = sinCuerposHeredoc(String(cmd ?? ''));
  if (!re.test(c) && !/\.claude/i.test(c)) return [];
  const arma = new Set();
  // `cd ~/.claude && touch .arb-cerrar-ok`: los argumentos relativos se miran pegados a la carpeta de los `cd`
  let dir = '';
  const conDir = (a) => (dir && !/^(?:[A-Za-z]:|[\\/~$])/.test(a) ? `${dir}/${a}` : a);
  const anotar = (a) => { const m = conDir(String(a)).match(re); if (m) arma.add((canon ? m[1] : m[1]).toLowerCase()); };
  for (const s of comandosSimples(c)) {
    const p = s.palabras.filter((w, i) => !(i === 0 && /^[A-Za-z_]\w*=/.test(w)));
    const verbo = String(p[0] ?? '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
    if (/^(?:cd|pushd|Set-Location|sl)$/i.test(verbo)) { dir = String(p.slice(1).find((a) => !a.startsWith('-')) ?? ''); continue; }
    for (const r of s.redirs) if (/>/.test(r.op)) anotar(r.t);
    if (!VERBO_ARMA.test(verbo)) continue;
    // cp/mv/ln: solo el DESTINO; los demas verbos, cualquier argumento
    const args = p.slice(1).filter((a) => !a.startsWith('-'));
    for (const a of VERBO_DESTINO.test(verbo) ? args.slice(-1) : args) anotar(a);
  }
  return [...arma];
}

/** ¿El archivo de un Write/Edit es un permiso de Fak? Devuelve su nombre o ''. */
export function permisoDeArchivo(file) {
  const canon = canonPermisos();
  if (!canon?.de_fak?.length) return '';
  const m = String(file ?? '').match(permisoRe(canon.de_fak));
  return m ? m[1].toLowerCase() : '';
}

/** La cita del comando: { dia, mes, hora, minuto, texto } o null. Se busca afuera de los cuerpos de heredoc. */
export function citaDe(cmd) {
  const canon = canonPermisos();
  if (!canon?.cita?.regex) return null;
  const m = sinCuerposHeredoc(String(cmd ?? '')).match(new RegExp(canon.cita.regex));
  if (!m) return null;
  return { dia: Number(m[1]), mes: Number(m[2]), hora: Number(m[3]), minuto: Number(m[4]), texto: m[5] };
}

/** Sin tildes, sin mayusculas, sin signos: «Hacelo, sí!» y «hacelo si» son lo mismo. */
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

/**
 * Veredicto puro: { ok: true } o { ok: false, motivo }. `mensajes` = mensajesDeFak(transcript) (null si no se pudo leer).
 * Vale el ULTIMO mensaje de Fak: el si tiene que ser de este turno, no de una hora antes.
 */
export function verificarCita({ cita, mensajes, canon = canonPermisos() }) {
  if (!cita) return { ok: false, motivo: 'el comando no trae la cita de Fak (# Fak DD/MM HH:MM: "lo que dijo")' };
  const minimas = canon?.cita?.palabras_minimas ?? 2;
  const tol = canon?.cita?.minutos_de_tolerancia ?? 5;
  const offset = canon?.cita?.utc_offset_horas ?? -3;
  const texto = normalizar(cita.texto);
  if (texto.split(' ').filter(Boolean).length < minimas) return { ok: false, motivo: `la cita tiene menos de ${minimas} palabras: «${cita.texto}»` };
  if (mensajes === null) return { ok: false, motivo: 'no pude leer el transcript de la sesion para comparar la cita con lo que Fak escribio' };
  const ultimo = (mensajes || []).reduce((a, m) => (!a || m.ts > a.ts ? m : a), null);
  if (!ultimo) return { ok: false, motivo: 'en esta sesion no hay ningun mensaje de Fak: el si tiene que ser suyo, de este turno' };
  // por palabras ENTERAS: un pedazo de palabra («e la t») no es una cita (auditor Opus 17/10)
  if (!` ${normalizar(ultimo.texto)} `.includes(` ${texto} `)) return { ok: false, motivo: `«${cita.texto}» no esta en el ultimo mensaje de Fak` };
  const local = new Date(ultimo.ts + offset * 3600_000);
  const citada = Date.UTC(local.getUTCFullYear(), cita.mes - 1, cita.dia, cita.hora, cita.minuto);
  const real = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes());
  if (Math.abs(citada - real) > tol * 60_000) {
    const dos = (n) => String(n).padStart(2, '0');
    return { ok: false, motivo: `la cita dice ${dos(cita.dia)}/${dos(cita.mes)} ${dos(cita.hora)}:${dos(cita.minuto)} y el ultimo mensaje de Fak es del ${dos(local.getUTCDate())}/${dos(local.getUTCMonth() + 1)} ${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}` };
  }
  return { ok: true };
}

/** Todo junto, para el guardian: { permisos, ok, motivo }. permisos=[] si el comando no arma ninguno. */
export function evaluarPermisoBash({ cmd, transcriptPath }) {
  const permisos = permisosQueArma(cmd);
  if (!permisos.length) return { permisos, ok: true };
  const v = verificarCita({ cita: citaDe(cmd), mensajes: transcriptPath ? mensajesDeFak(transcriptPath) : null });
  return { permisos, ...v };
}

/** Una linea en el registro (`~/.claude/.permisos-un-uso.log`): fecha, sesion, permisos, veredicto, cita. No tira nunca. */
export function anotar(home, { sesion, permisos, ok, motivo, cmd }) {
  try {
    const c = citaDe(cmd);
    const linea = [new Date().toISOString(), sesion || '-', permisos.join(','), ok ? 'pasa' : 'frena', ok ? (c ? `«${c.texto}»` : '') : motivo].join('\t');
    fs.appendFileSync(path.join(home, '.claude', '.permisos-un-uso.log'), `${linea.replace(/\n/g, ' ')}\n`);
  } catch { /* sin permiso de escritura: no hay donde decirlo */ }
}
