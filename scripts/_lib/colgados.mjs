/**
 * colgados.mjs — ¿algo que lance esta quieto y no me entere?
 *
 * 04/10/2026: cuatro conversaciones del examen estuvieron 55 minutos esperando un cartel de permiso (pidieron leer fuera
 * de su carpeta) y yo esperaba «que terminen». Fak: «que no vuelva a pasar eso de perder 55 minutos». Una conversacion o
 * un agente que no escribe hace 10 minutos se MIRA: aca se mira por programa.
 *
 * Como se sabe, del registro (.jsonl) de una conversacion o de un agente, sin abrir ninguna ventana:
 *   - el ultimo renglon es del asistente y pide una herramienta que no tiene resultado  -> espera esa herramienta
 *     (casi siempre un cartel de permiso; a veces una herramienta colgada);
 *   - el ultimo renglon es el resultado de una herramienta, o un mensaje, y nadie contesto -> espera al modelo;
 *   - el ultimo renglon es del asistente y cierra el turno -> termino: no esta colgada.
 * Solo lectura. No decide nada: dice que mirar.
 */
import fs from 'node:fs';
import path from 'node:path';

const COLA_BYTES = 4 * 1048576;

/** Los ultimos renglones de un archivo grande (sin leerlo entero). */
export function colaDe(ruta, bytes = COLA_BYTES) {
  let fd = null;
  try {
    const total = fs.statSync(ruta).size;
    const n = Math.min(total, bytes);
    const buf = Buffer.alloc(n);
    fd = fs.openSync(ruta, 'r');
    fs.readSync(fd, buf, 0, n, total - n);
    const lineas = buf.toString('utf8').split('\n');
    if (n < total) lineas.shift();
    return lineas;
  } catch { return []; } finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* nada */ } } }
}

const corto = (o, n = 110) => { let s = ''; try { s = JSON.stringify(o); } catch { s = String(o); } return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * El estado de un registro a una hora dada.
 * @returns {{ estado: 'termino'|'trabajando'|'espera_herramienta'|'espera_modelo'|'vacio', quietaMin: number|null, espera?: string, ultimoMs: number|null }}
 * `hastaMs`: no mira renglones posteriores a esa hora (para repetir un caso viejo con su hora).
 */
export function estadoDe(lineas, ahoraMs, { minutos = 10, hastaMs = null } = {}) {
  const usos = new Map();
  const hechos = new Set();
  let ultimo = null;
  for (const l of lineas) {
    if (!l || l[0] !== '{') continue;
    let j = null; try { j = JSON.parse(l); } catch { continue; }
    if (j.type !== 'user' && j.type !== 'assistant') continue;
    const ms = typeof j.timestamp === 'string' ? Date.parse(j.timestamp) : NaN;
    if (hastaMs !== null && Number.isFinite(ms) && ms > hastaMs) continue;
    const c = j.message && j.message.content;
    let pide = false; let resultado = false; let interrumpido = false;
    if (Array.isArray(c)) {
      for (const b of c) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'tool_use') { usos.set(b.id, `${b.name} ${corto(b.input)}`); pide = true; }
        if (b.type === 'tool_result') { hechos.add(b.tool_use_id); resultado = true; }
        if (b.type === 'text' && /^\[Request interrupted by user/.test(b.text || '')) interrumpido = true;
      }
    } else if (typeof c === 'string' && /^\[Request interrupted by user/.test(c)) interrumpido = true;
    ultimo = { tipo: j.type, ms: Number.isFinite(ms) ? ms : (ultimo ? ultimo.ms : null), pide, resultado, interrumpido, fin: j.message && j.message.stop_reason };
  }
  if (!ultimo) return { estado: 'vacio', quietaMin: null, ultimoMs: null };
  const quietaMin = ultimo.ms === null ? null : Math.floor((ahoraMs - ultimo.ms) / 60000);
  const pend = [...usos.entries()].filter(([id]) => !hechos.has(id)).map(([, v]) => v);
  // la persona la freno a mano, o el asistente cerro el turno: no esta colgada
  if (ultimo.interrumpido) return { estado: 'termino', quietaMin, ultimoMs: ultimo.ms };
  if (ultimo.tipo === 'assistant' && !ultimo.pide && !pend.length) return { estado: 'termino', quietaMin, ultimoMs: ultimo.ms };
  if (quietaMin === null || quietaMin < minutos) return { estado: 'trabajando', quietaMin, ultimoMs: ultimo.ms };
  if (pend.length) return { estado: 'espera_herramienta', quietaMin, espera: pend[pend.length - 1], ultimoMs: ultimo.ms };
  return { estado: 'espera_modelo', quietaMin, ultimoMs: ultimo.ms };
}

/** Los registros de conversaciones y de agentes tocados en las ultimas `horas`, debajo de `raiz` (~/.claude/projects). */
export function registrosRecientes(raiz, ahoraMs, horas = 3) {
  const out = [];
  const desde = ahoraMs - horas * 3600000;
  const mirar = (dir, clase, proyecto) => {
    let nombres = [];
    try { nombres = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const n of nombres) {
      const p = path.join(dir, n.name);
      if (n.isFile() && n.name.endsWith('.jsonl')) {
        let m = 0; try { m = fs.statSync(p).mtimeMs; } catch { continue; }
        if (m >= desde) out.push({ ruta: p, clase, proyecto, id: n.name.replace(/\.jsonl$/, ''), mtimeMs: m });
      } else if (n.isDirectory() && clase === 'conversacion') {
        mirar(path.join(p, 'subagents'), 'agente', proyecto);       // <proyecto>/<sesion>/subagents/*.jsonl
      }
    }
  };
  let proyectos = [];
  try { proyectos = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return out; }
  for (const d of proyectos) mirar(path.join(raiz, d.name), 'conversacion', d.name);
  return out;
}

/** Un renglon para leer: que esta quieto, hace cuanto y que espera. */
export function renglon(r, e) {
  const que = e.estado === 'espera_herramienta'
    ? `espera una herramienta sin resultado (¿cartel de permiso?): ${e.espera}`
    : 'espera al modelo (o su proceso se corto)';
  const donde = r.proyecto.replace(/^C--/, '').replace(/--claude-worktrees-.*/, ' (copia de trabajo)');
  return `QUIETA hace ${e.quietaMin} min · ${r.clase} · ${donde} · ${r.id.slice(0, 8)} · ${que}`;
}

/** Todo junto: los registros recientes que estan colgados. */
export function colgados({ raiz, ahoraMs = Date.now(), minutos = 10, horas = 3, hastaMs = null } = {}) {
  const out = [];
  for (const r of registrosRecientes(raiz, hastaMs ?? ahoraMs, hastaMs !== null ? 24 * 365 : horas)) {
    const e = estadoDe(colaDe(r.ruta), ahoraMs, { minutos, hastaMs });
    // en un repaso con hora (`hastaMs`) entran solo los que tuvieron movimiento en las `horas` anteriores a esa hora
    if (hastaMs !== null && (e.ultimoMs === null || e.ultimoMs < hastaMs - horas * 3600000)) continue;
    if (e.estado === 'espera_herramienta' || e.estado === 'espera_modelo') out.push({ ...r, ...e, texto: renglon(r, e) });
  }
  return out.sort((a, b) => b.quietaMin - a.quietaMin);
}
