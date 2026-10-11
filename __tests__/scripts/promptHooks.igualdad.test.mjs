// El hook fusionado da lo MISMO que los cuatro sueltos sobre mensajes reales de Fak (plan P10 §2). Necesita los
// registros de ~/.claude/projects y corre 5 procesos por mensaje: solo con HOOKS_IGUALDAD=1 (o =<n> para menos mensajes
// con la PC cargada). Sin la variable o sin registros dice SALTEADO en voz alta (plan §6.2), no «paso». La linea
// «igualdad: ...» se pega en la sintesis. Desde C1a, caracteristicas-especiales-prompt.sh es un wrapper del mismo
// modulo que usa el fusionado: esa pieza se compara consigo misma; las otras tres son la comparacion de verdad.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEPARADOR, textoDe } from '../../scripts/_lib/promptHooks.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // con jsdom, `new URL` no da una URL de Node
const HOOKS = path.join(RAIZ, '.claude', 'hooks');
const VIEJOS = ['caracteristicas-especiales-prompt.sh', 'correccion-guard.sh', 'explicar-prompt.sh', 'hora-prompt.sh'];
// Claude Code guarda los registros en ~/.claude/projects/<cwd con todo lo que no es letra o numero cambiado por '-'>
const DIR = process.env.HOOKS_IGUALDAD_DIR || path.join(os.homedir(), '.claude', 'projects', path.resolve(RAIZ).replace(/[^A-Za-z0-9]/g, '-'));
const CON_TEMA = /\bcc\b|\bsc\b|critic|significativ|no entiendo|explica|sintetiz|hasta las|cronometro/i;
const V = String(process.env.HOOKS_IGUALDAD || '');
const N = /^\d+$/.test(V) && Number(V) > 1 ? Number(V) : 20;

/** Los N mensajes: hasta 10 de los mas nuevos que tocan un tema de alguna pieza (para que el test no este ciego), el resto los mas nuevos sin mas. */
function corpus(n) {
  let archivos = [];
  try { archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(DIR, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs); } catch { return []; }
  const conTema = []; const otros = [];
  for (const archivo of archivos.slice(0, 40)) {
    for (const l of fs.readFileSync(archivo, 'utf8').split('\n')) {
      let j; try { j = JSON.parse(l); } catch { continue; }
      const c = j?.type === 'user' && !j.isMeta ? j.message?.content : null;
      if (typeof c !== 'string' || /^\s*</.test(c) || c.length < 5) continue;       // tool_result, avisos de la app
      (CON_TEMA.test(c) ? conTema : otros).push({ transcript_path: archivo, cwd: RAIZ, hook_event_name: 'UserPromptSubmit', prompt: c });
    }
    if (conTema.length >= 10 && otros.length >= n) break;
  }
  return [...conTema.slice(0, 10), ...otros].slice(0, n);
}
const correrSh = (sh, payload) => textoDe(execFileSync('bash', [path.join(HOOKS, sh)], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: 'off' }, timeout: 60000 }));

describe('prompt-hooks.sh = los cuatro hooks sueltos (mensajes reales)', () => {
  const mensajes = V ? corpus(N) : [];
  if (!mensajes.length) console.warn(`SALTEADO: promptHooks.igualdad necesita HOOKS_IGUALDAD=1 y registros en ${DIR} (${V ? 'no hay registros' : 'sin la variable'}). NO es un verde.`);
  it.skipIf(!mensajes.length)('la salida fusionada es la concatenacion de las cuatro, en orden, mensaje por mensaje', () => {
    const diferencias = []; let inyectados = 0;
    mensajes.forEach((m, i) => {
      // ids de sesion distintos para cada lado: correccion-guard guarda por sesion hasta donde leyo el registro
      const viejo = VIEJOS.map((sh) => correrSh(sh, { ...m, session_id: `igualdad-${i}-viejo` })).filter(Boolean).join(SEPARADOR);
      const nuevo = correrSh('prompt-hooks.sh', { ...m, session_id: `igualdad-${i}-nuevo` });
      if (viejo) inyectados++;
      if (viejo !== nuevo) diferencias.push({ i, prompt: m.prompt.slice(0, 60), viejo: viejo.slice(0, 120), nuevo: nuevo.slice(0, 120) });
    });
    console.warn(`igualdad: ${mensajes.length} mensajes, ${inyectados} con alguna inyeccion, ${diferencias.length} diferencias`);
    expect(diferencias).toEqual([]);
    expect(inyectados, 'ninguna pieza hablo en los mensajes: el corpus no prueba nada').toBeGreaterThan(0);
  }, 110000);
});
