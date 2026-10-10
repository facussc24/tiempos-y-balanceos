// @vitest-environment node
/**
 * Chequeo 10 del cierre-guard (cola H4, 09/10/2026): un turno que termina en ingles no cierra; se rehace en castellano.
 *
 * Fak, 07/10/2026: "deja de hablar en ingles". R4: 65 turnos en ingles desde el 01/09. Los ROJOS son finales de turno
 * REALES sacados de los registros (sesion 11220d75 del 23/09 y otros), con sus palabras; los VERDES, castellano con
 * palabras en ingles de uso en la casa (build, push, commit), una cita en ingles y un bloque de codigo. Medido sobre
 * 1.568 finales de turno reales: el detector marca 27 (12 el viejo de _tokens.mjs, ninguno perdido) y 0 en castellano.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { esIngles, contarIdioma, soloProsa } from '../../scripts/_lib/idioma.mjs';
import { decidir } from '../../scripts/_lib/cierreGuard.mjs';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');

const ROJOS = [
  'Rendering the 3D model headless with Playwright (same engine the flowchart generator uses) to get clean shots of the fronts.',
  'PowerPoint still has the first version open, so the new one goes out as "v2". Editing slides 8 to 11 in the build.',
  'Understood: your PowerPoint has edits of yours. The final version goes on top of your file, changing only the slides I touched.',
  'Committing the skill and the capture script (build first, as the rule requires).',
  'Transcribing the two new audios first.',
  'Correction applied to the model. Rendering the fronts to check them against your screenshots.',
  'Script works over your file. Checking Gemini.',
  'Small repetition cleanup: "lo que buscamos lograr" appeared three times and "tres luminarias" twice in a row.',
];
const VERDES = [
  'Terminé a las **21:30**. El último cambio de código se subió a las 20:24 y después corrí la suite completa de tests.',
  'Corrí el build y el push; el deploy quedó verde en staging y el commit es `9b796e1a`.',
  'Listo. Commit `abc1234` y push a main; el CI está verde.',
  'La norma dice textual: "the supplier shall document the process flow and the control plan"; o sea, el flujograma va antes.',
  'Quedó así:\n```js\nconst x = items.filter((i) => i.ok);\n// the filtered list is what we return\nreturn x;\n```\nSigo con el test.',
  'Bien. Ahora **Ruffini**, que es el paso que convierte ese `0` en los paréntesis. Es mecánico.',
  'Está todo bajado. **Y el plano te contesta la pregunta de las siglas mejor que yo**: dice textual > TLD.',
  'Ya bajé el DWG con tu Chrome, así que no necesito ningún permiso más: andá a dormir tranquilo. Sigo con la cola.',
  'OK.',
  'API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment.',
];

describe('idioma · esIngles', () => {
  it('ROJO: los finales de turno reales en ingles', () => { for (const t of ROJOS) expect(esIngles(t), t).toBe(true); });
  it('VERDE: castellano con build/push/commit, una cita en ingles, codigo, un OK corto y un error de la API', () => {
    for (const t of VERDES) expect(esIngles(t), t).toBe(false);
  });
  it('soloProsa saca codigo, rutas, links y citas; contarIdioma cuenta palabras de un solo idioma', () => {
    expect(soloProsa('ver `the file` en C:\\Dev\\x\\the.txt y https://the.com/and "the quoted sentence here" listo')).not.toMatch(/the/);
    expect(contarIdioma('Transcribing the two new audios first.')).toMatchObject({ en: 5, es: 0 });   // transcribing, the, two, new, first
    expect(contarIdioma('El build quedó verde.')).toMatchObject({ en: 0, es: 2 });   // el, quedó (build y verde no cuentan)
  });
});

describe('cierre-guard · chequeo 10: el turno termina en ingles', () => {
  const deps = { pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {} };
  const transcript = () => {
    const f = path.join(os.tmpdir(), `cg-idioma-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(f, `${JSON.stringify({ type: 'user', timestamp: '2026-10-09T12:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'dale, segui con eso' } })}\n`);
    return f;
  };
  const cierre = async (texto, extra = {}) => { const f = transcript(); try { return await decidir({ session_id: 's10', transcript_path: f, last_assistant_message: texto, ...extra }, deps); } finally { fs.unlinkSync(f); } };

  it('ROJO: frena con el titulo del idioma, una sola vez por turno', async () => {
    const r = await cierre(ROJOS[0]);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/termina en ingles/);
    expect(r.detalle).toMatch(/castellano/);
    expect((await cierre(ROJOS[0], { stop_hook_active: true })).ok).toBe(true);
  });
  it('VERDE: el mismo mensaje en castellano pasa', async () => {
    expect((await cierre('Renderizo el modelo 3D sin ventana con Playwright (el mismo motor del generador de flujogramas) para sacar capturas limpias de los frentes.')).ok).toBe(true);
    expect((await cierre(VERDES[1])).ok).toBe(true);
  });
  it('el hook cierre-guard.sh: ROJO exit 2 con un final en ingles, VERDE exit 0 en castellano', () => {
    const correr = (texto) => spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'cierre-guard.sh')], {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'prueba-idioma', last_assistant_message: texto }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: RAIZ },
    });
    const rojo = correr(ROJOS[4]);
    expect(rojo.status, rojo.stderr).toBe(2);
    expect(rojo.stderr).toMatch(/termina en ingles/);
    expect(correr('Transcribo primero los dos audios nuevos.').status).toBe(0);
  });
});
