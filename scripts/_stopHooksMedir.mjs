/**
 * _stopHooksMedir.mjs — cuantos cierres frenaron los hooks Stop (cierre-guard, pregunta-guard, hora-guard) y que paso
 * despues (tanda 9, pieza 11; «lo que se mide antes de tocar un hook», anthropic_a_fondo b).
 *
 * Los hooks Stop no dejan un registro propio; lo que queda es el mensaje «Stop hook feedback: [bash …/<hook>.sh]: …»
 * que Claude Code le devuelve a la sesion en el registro (.jsonl). Por cada uno se mira el turno siguiente del
 * asistente: si corrio una herramienta, el freno hizo trabajar (un cierre evitado); si solo volvio a escribir, se cuenta
 * como «volvio a cerrar». Tambien se mide la racha mas larga de frenos seguidos sin un mensaje de Fak en el medio:
 * Claude Code corta a los 8 (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`), y ese numero lo cambia Fak, no una sesion.
 *
 *   node scripts/_stopHooksMedir.mjs [--desde 2026-10-01] [--json]
 *
 * Solo lee los registros de ~/.claude/projects/C--Dev-BarackMercosul*.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** «Stop hook feedback: [bash "…/.claude/hooks/cierre-guard.sh"]: CIERRE-GUARD: el turno …» → { hook, motivo } o null. */
export function leerFreno(texto) {
  const t = String(texto ?? '');
  if (!/^\s*Stop hook feedback:/.test(t)) return null;
  const m = t.match(/hooks[\\/]+([a-z0-9-]+)\.sh/i);
  const resto = t.replace(/^[\s\S]*?\.sh"?\]:\s*/, '').replace(/\s+/g, ' ').trim();
  return { hook: m ? m[1] : 'otro', motivo: resto.slice(0, 90) };
}

/** Puro: recorre los eventos de UNA sesion ([{tipo:'freno',hook,motivo}|{tipo:'fak'}|{tipo:'asistente',herramienta}]). */
export function medirSesion(eventos, cap = 8) {
  const porHook = {}; let racha = 0; let rachaMax = 0; let topes = 0; let pendiente = null;
  const nota = (h, k) => { porHook[h] ||= { frenos: 0, trabajo: 0, volvioACerrar: 0 }; porHook[h][k] += 1; };
  // Un turno del asistente viene en varias lineas (pensamiento, texto, herramienta): el freno se resuelve como
  // «trabajo» si CUALQUIER linea del turno siguiente usa una herramienta; si llega otro freno o un mensaje de Fak
  // antes, como «volvio a cerrar».
  for (const e of eventos) {
    if (e.tipo === 'freno') {
      if (pendiente) nota(pendiente, 'volvioACerrar');
      nota(e.hook, 'frenos'); pendiente = e.hook; racha += 1; rachaMax = Math.max(rachaMax, racha); if (racha === cap) topes += 1;
    } else if (e.tipo === 'asistente') {
      if (pendiente && e.herramienta) { nota(pendiente, 'trabajo'); pendiente = null; }
    } else if (e.tipo === 'fak') { if (pendiente) nota(pendiente, 'volvioACerrar'); racha = 0; pendiente = null; }
  }
  if (pendiente) nota(pendiente, 'volvioACerrar');
  return { porHook, rachaMax, topes };
}

function textoUsuario(o) {
  const c = o.message?.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c) || c.some((b) => b?.type === 'tool_result')) return null;
  return c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
}

function main(argv) {
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const desde = arg('--desde', '2026-10-01');
  const base = path.join(os.homedir(), '.claude', 'projects');
  const total = {}; let sesiones = 0, conFreno = 0, rachaMax = 0, topes = 0;
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    if (!d.startsWith('C--Dev-BarackMercosul')) continue;
    for (const f of fs.readdirSync(path.join(base, d))) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(base, d, f);
      if (fs.statSync(p).mtime.toISOString().slice(0, 10) < desde) continue;
      const ev = [];
      for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
        if (!l || l.includes('"isSidechain":true')) continue;
        if (!l.includes('"type":"user"') && !l.includes('"type":"assistant"')) continue;
        let o; try { o = JSON.parse(l); } catch { continue; }
        if (String(o.timestamp ?? '').slice(0, 10) < desde) continue;
        if (o.type === 'assistant') { ev.push({ tipo: 'asistente', herramienta: (o.message?.content || []).some((b) => b?.type === 'tool_use') }); continue; }
        const t = textoUsuario(o); if (t == null || !t.trim()) continue;
        const fr = leerFreno(t);
        if (fr) ev.push({ tipo: 'freno', ...fr }); else if (!o.isMeta && !/^\s*</.test(t)) ev.push({ tipo: 'fak' });
      }
      sesiones += 1;
      const r = medirSesion(ev);
      if (Object.keys(r.porHook).length) conFreno += 1;
      rachaMax = Math.max(rachaMax, r.rachaMax); topes += r.topes;
      for (const [h, v] of Object.entries(r.porHook)) { total[h] ||= { frenos: 0, trabajo: 0, volvioACerrar: 0 }; for (const k of Object.keys(v)) total[h][k] += v[k]; }
    }
  }
  const salida = { desde, sesiones, conFreno, rachaMax, topes, porHook: total };
  if (argv.includes('--json')) { console.log(JSON.stringify(salida, null, 2)); return 0; }
  console.log(`FRENOS DE LOS HOOKS STOP desde ${desde} · ${sesiones} sesiones, ${conFreno} con algun freno · racha mas larga ${rachaMax} · veces que se llego al tope de 8: ${topes}`);
  for (const [h, v] of Object.entries(total).sort((a, b) => b[1].frenos - a[1].frenos)) {
    console.log(`  ${h.padEnd(22)} ${String(v.frenos).padStart(5)} frenos · despues trabajo (cierre evitado) ${v.trabajo} · volvio a cerrar ${v.volvioACerrar}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
