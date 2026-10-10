/**
 * _orquestador.mjs — el chequeo de la hora de una sesion que Fak dejo trabajando sola (cola HOY-17, 10/10/2026).
 *
 * Fak, 10/10/2026 18:48: "te pongo reglas y te las olvidas... ¿como te vas a asegurar de que no sigan pasando estas
 * cosas?". Este comando imprime, leido de los registros y no de lo que la sesion recuerda, el estado de las reglas de
 * la tanda ANTES de escribir el renglon de la hora (y cada vez que el latido sale con «exit code 5»):
 *
 *   node scripts/_orquestador.mjs --hora [--sesion <id>] [--hija <local_id>]... [--horas-hijas 24]
 *
 *   · la hora fijada y si el latido esta corriendo (scripts/_lib/horaGuard.mjs);
 *   · el cupo: NO se puede medir desde node (lo da la herramienta get_usage de la app): lo dice asi, no inventa;
 *   · los pedidos a la API de ESTA sesion en las ultimas 2 horas (del registro) y lo que gasto la PC (del ledger);
 *   · cuantos despertares seguidos del latido lleva sin avance, y si eso ya es «parado»;
 *   · las preguntas abiertas a Fak que tiene la lista en «Lo que necesita a Fak»;
 *   · las hijas (sesiones lanzadas por una tarea en las ultimas 24 horas): como arrancaron (scripts/_hijaEstado.mjs),
 *     en que modelo y modo estan, cuando escribieron por ultima vez y cuando hicieron su ultimo commit.
 *
 * Solo lee. Sale siempre con 0 salvo un argumento que no conoce (2): es un informe, no un control. Lo que avisa son
 * AVISOS (renglones que empiezan con «AVISO»); los frenos siguen siendo los de siempre.
 * Limite conocido: nada obliga a correrlo. Lo que si llega solo es el codigo de salida 5 del latido.
 * La logica vive en scripts/_lib/tandaReglas.mjs (tests: __tests__/scripts/tandaReglas.test.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vigente, latidoVivo, enLocal, sesionActual } from './_lib/horaGuard.mjs';
import {
  REPO, CANON, CANON_ROTO, DESPERTARES, VENTANA_API_MS, buscarRegistro, estadoApi, leerTanda, preguntasEnLista, leerEventos, textoAvisoApi,
} from './_lib/tandaReglas.mjs';
import { estadoHija, RAIZ_APP } from './_hijaEstado.mjs';

const hhmm = (ms) => enLocal(new Date(ms)).slice(11);

/** Lo que la PC gasto por la API en la ventana, del ledger del mes (no tiene la sesion: es de todas). */
export function ledgerEnVentana(desdeMs, hastaMs, dir = process.env.BARACK_API_DIR || path.join(REPO, '.sgc-cache', 'api')) {
  const out = { pedidos: 0, usd: 0, tareas: [] };
  const d = new Date(hastaMs);
  const meses = new Set([new Date(desdeMs), d].map((f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`));
  for (const mes of meses) {
    let texto = '';
    try { texto = fs.readFileSync(path.join(dir, `ledger_${mes}.jsonl`), 'utf8'); } catch { continue; }
    for (const l of texto.split('\n')) {
      if (!l.trim()) continue;
      let e;
      try { e = JSON.parse(l); } catch { continue; }
      const ms = Date.parse(String(e.ts || '').replace(' ', 'T'));        // sello local sin zona
      if (!(ms >= desdeMs && ms <= hastaMs)) continue;
      out.pedidos++;
      out.usd += Number(e.costoUsd) || 0;
      out.tareas.push(String(e.tarea || ''));
    }
  }
  return out;
}

/** Los registros de la app de las sesiones lanzadas por una tarea y tocadas en las ultimas `horas` horas. */
export function hijasRecientes({ raizApp = RAIZ_APP(), ahoraMs = Date.now(), horas = 24, menos = null } = {}) {
  const out = [];
  const pila = [[raizApp, 0]];
  while (pila.length) {
    const [dir, prof] = pila.pop();
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (prof < 3) pila.push([p, prof + 1]); continue; }
      if (!/^local_.+\.json$/.test(e.name)) continue;
      try {
        if (ahoraMs - fs.statSync(p).mtimeMs > horas * 3600000) continue;
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!d.scheduledTaskId || (menos && d.cliSessionId === menos)) continue;
        out.push({ id: e.name.replace(/\.json$/, ''), titulo: d.title || '', tarea: d.scheduledTaskId, actividad: Number(d.lastActivityAt) || fs.statSync(p).mtimeMs });
      } catch { /* un registro roto no frena el informe */ }
    }
  }
  return out.sort((a, b) => b.actividad - a.actividad);
}

/** Los renglones del chequeo de la hora. Puro salvo lo que leen sus dependencias (inyectables en los tests). */
export function renglonesDeLaHora({ sesion, ahora = new Date(), home, hijasPedidas = [], horasHijas = 24, deps = {} } = {}) {
  const d = { vigente, latidoVivo, buscarRegistro, estadoApi, leerTanda, preguntasEnLista, ledgerEnVentana, hijasRecientes, estadoHija, leerEventos, ...deps };
  const ahoraMs = ahora.getTime();
  const out = [`CHEQUEO DE LA HORA · ${enLocal(ahora)} · sesión ${String(sesion || '?').slice(0, 8)}`];
  const avisos = [];
  const vig = sesion ? d.vigente(sesion, { ahora, home }) : null;
  if (vig) {
    const lat = d.latidoVivo(sesion, { ahora, home });
    out.push(`- Hora fijada: hasta las ${vig.hasta} · latido: ${lat.vivo ? `corriendo (despierta a las ${hhmm(lat.senal.despierta_ms)})` : 'NO está corriendo: lanzalo'} · lista: ${vig.lista || 'sin archivo'}`);
  } else {
    out.push('- Hora fijada: ninguna vigente para esta sesión (las reglas de la tanda se miden igual, pero el latido no las avisa).');
  }
  out.push('- Cupo: no se puede medir desde acá. Miralo con get_usage (de esta sesión y de cada hija): se mira cada hora y pasado el 85 % de la ventana de 5 h no se lanzan hijas ni agentes.');

  const registro = sesion ? d.buscarRegistro(sesion, home) : null;
  const api = d.estadoApi({ sesion, ahora, home, registro });
  const led = d.ledgerEnVentana(ahoraMs - VENTANA_API_MS, ahoraMs);
  // «0 pedidos» se dice solo si se pudo medir: sin registro, o con uno que no se llega a leer, se dice eso (auditor 10/10)
  const noMedido = !registro || /sin registro|no se pudo medir|ilegible|no entra/.test(String(api.motivo || ''));
  const deSesion = noMedido ? `NO SE PUDO MEDIR los pedidos de esta sesión (${registro ? api.motivo : 'no encuentro su registro'})` : `${api.pedidos} pedido(s) de esta sesión en las últimas ${CANON.api.ventana_min / 60} horas`;
  if (CANON_ROTO) out.push('- OJO: scripts/_lib/tandaCanon.data.json no se pudo leer: las reglas de la tanda están APAGADAS (no avisan nada). Arreglar el archivo.');
  out.push(`- API: ${deSesion} · en el ledger de la PC, de todas las sesiones: ${led.pedidos} pedido(s), US$ ${led.usd.toFixed(2)}`);
  if (api.aviso) avisos.push(textoAvisoApi(api));

  const st = sesion ? d.leerTanda(sesion, home) : {};
  const sin = Number(st.sinAvance) || 0;
  const enLista = d.preguntasEnLista(vig?.lista || null);
  const espera = st.espera ? `el asistente escribió «${st.espera.frase}» a las ${hhmm(st.espera.ms)} y Fak no contestó después` : null;
  const vieja = Number.isFinite(st.ultimo_ms) && ahoraMs - st.ultimo_ms > 30 * 60000;
  out.push(`- Despertares seguidos sin avance: ${vieja ? `sin cuenta vigente (la última anotada es de otra tanda: ${st.ultimo})` : `${sin}${st.ultimo ? ` (último despertar anotado: ${String(st.ultimo).slice(11)})` : ' (el latido todavía no anotó ninguno)'}`}`);
  out.push(`- Preguntas abiertas a Fak: ${enLista.length} en la lista${enLista.length ? `: ${enLista.slice(0, 4).map((p) => `«${p}»`).join(' · ')}${enLista.length > 4 ? ' …' : ''}` : ''}${espera ? ` · ${espera}` : ''}`);
  if (!vieja && sin >= DESPERTARES && (enLista.length || espera)) {
    avisos.push(`PARADO: ${sin} despertares seguidos sin commit, sin archivos, sin agentes, sin hijas y sin API, con una pregunta abierta a Fak. Hacé lo que no depende de la respuesta: «Trabajo que puedo hacer solo» de la lista.`);
  }

  const ids = [...new Set([...hijasPedidas, ...d.hijasRecientes({ ahoraMs, horas: horasHijas, menos: sesion }).map((h) => h.id)])];
  if (!ids.length) out.push(`- Sesiones lanzadas: ninguna sesión lanzada por una tarea en las últimas ${horasHijas} horas.`);
  for (const id of ids) {
    let r;
    try { r = d.estadoHija({ id, ahoraMs }); } catch (e) { out.push(`- Sesión lanzada ${id.slice(0, 14)}: no se pudo leer (${e?.message ?? e})`); continue; }
    const t = r.transcript;
    let commit = 'commits: no se pudo leer su registro';
    if (t?.archivo) {
      const ev = d.leerEventos(t.archivo, ahoraMs - horasHijas * 3600000);
      if (ev.ok === false) commit = `commits: no se pudo medir (${ev.motivo || 'registro ilegible'})`;
      else commit = ev.commits.length ? `último commit a las ${hhmm(ev.commits.at(-1))} (${ev.commits.length} en ${horasHijas} h)` : 'sin commits en su registro';
    }
    const hace = t?.ultimoTs ? `${Math.round((ahoraMs - t.ultimoTs) / 60000)} min` : '?';
    out.push(`- Sesión lanzada ${id.slice(0, 14)} «${(r.app?.title || '').slice(0, 50)}»: modelo ${r.app?.model ?? '?'} · modo ${r.app?.permissionMode ?? t?.modoActual ?? '?'} · escribió hace ${hace} · ${commit}${r.ok ? '' : ` · ${r.ojos.length} para MIRAR`}`);
    for (const o of r.ojos) out.push(`    OJO: ${o}`);
  }

  if (avisos.length) { out.push(''); for (const a of avisos) out.push(`AVISO · ${a}`); } else out.push('', 'Sin avisos de las reglas de la tanda.');
  return { renglones: out, avisos };
}

function main(argv) {
  const op = { hijas: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hora') { op.hora = true; continue; }
    if ((a === '--sesion' || a === '--hija' || a === '--horas-hijas') && i + 1 < argv.length) {
      const v = argv[++i];
      if (a === '--hija') op.hijas.push(v); else op[a.slice(2)] = v;
      continue;
    }
    console.log(`no conozco el argumento ${a}. No hago nada.\nuso: node scripts/_orquestador.mjs --hora [--sesion <id>] [--hija <local_id>]... [--horas-hijas 24]`);
    return 2;
  }
  if (!op.hora) { console.log('uso: node scripts/_orquestador.mjs --hora [--sesion <id>] [--hija <local_id>]... [--horas-hijas 24]'); return 2; }
  const horas = /^\d+$/.test(op['horas-hijas'] ?? '') ? Number(op['horas-hijas']) : 24;
  const sesion = op.sesion || process.env.CLAUDE_CODE_SESSION_ID || sesionActual();
  const r = renglonesDeLaHora({ sesion, hijasPedidas: op.hijas, horasHijas: horas });
  console.log(r.renglones.join('\n'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
