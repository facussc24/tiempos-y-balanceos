// compactacion-registro.sh (PreCompact y PostCompact) y su logica scripts/_lib/compactacionRegistro.mjs.
// El payload se arma con JSON.stringify, nunca a mano en el shell (plan 1.3.3). Es un hook que observa: no tiene rojo,
// pero se prueba en las dos direcciones lo que importa: anota cuando el payload es bueno, y con un payload roto NO
// frena la compactacion (sale con 0) y deja el error en su log.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { correr, renglonDe, tokensDelUltimoTurno } from '../../scripts/_lib/compactacionRegistro.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'compactacion-'));
const leerRegistro = (raiz) => fs.readFileSync(path.join(raiz, '.claude', 'state', 'compactaciones.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

function transcript(dir, usage) {
  const ruta = path.join(dir, 't.jsonl');
  fs.writeFileSync(ruta, [
    JSON.stringify({ type: 'user', message: { content: 'hola' } }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, cache_read_input_tokens: 100, cache_creation_input_tokens: 10 } } }),
    JSON.stringify({ type: 'assistant', message: { usage } }),
    '{"type":"assistant","message":{"usa', // un renglon cortado al final no rompe
  ].join('\n'));
  return ruta;
}

describe('compactacionRegistro', () => {
  test('PreCompact automatico: fecha, sesion, causa, tokens del ultimo turno y si hubo instrucciones', () => {
    const dir = tmp();
    const t = transcript(dir, { input_tokens: 5, cache_read_input_tokens: 960000, cache_creation_input_tokens: 7000 });
    const ahora = new Date('2026-10-16T19:00:00Z');
    expect(correr(JSON.stringify({ hook_event_name: 'PreCompact', session_id: 'abc', transcript_path: t, trigger: 'auto', custom_instructions: '' }), { raiz: dir, ahora })).toBe(0);
    expect(leerRegistro(dir)).toEqual([{ fecha: '2026-10-16T19:00:00.000Z', evento: 'PreCompact', sesion: 'abc', causa: 'auto', tokens_ultimo_turno: 967005, con_instrucciones: false }]);
  });

  test('PostCompact por inactividad: causa idle y el largo del resumen; sin transcript no inventa tokens', () => {
    const r = renglonDe({ hook_event_name: 'PostCompact', session_id: 's', trigger: 'idle', compact_summary: 'x'.repeat(1234) }, new Date(0));
    expect(r).toEqual({ fecha: '1970-01-01T00:00:00.000Z', evento: 'PostCompact', sesion: 's', causa: 'idle', largo_resumen: 1234 });
    expect(tokensDelUltimoTurno('C:/no/existe.jsonl')).toBeNull();
  });

  test('un payload roto no frena la compactacion: sale con 0 y el error queda en su log', () => {
    const dir = tmp();
    expect(correr('{esto no es json', { raiz: dir })).toBe(0);
    expect(fs.existsSync(path.join(dir, '.claude', 'state', 'compactaciones.jsonl'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, '.claude', 'state', 'compactaciones.errores.log'), 'utf8')).toMatch(/JSON/);
  });

  test('compactacion-registro.sh por el camino real (bash -> node): anota y sale con 0, tambien con basura', () => {
    const dir = tmp();
    const sh = path.join(RAIZ, '.claude', 'hooks', 'compactacion-registro.sh');
    // El hook busca el .mjs en CLAUDE_PROJECT_DIR: se le da una raiz falsa con el script copiado, para no tocar la real.
    fs.mkdirSync(path.join(dir, 'scripts', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, 'scripts', '_lib', 'compactacionRegistro.mjs'), path.join(dir, 'scripts', '_lib', 'compactacionRegistro.mjs'));
    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
    const bien = spawnSync('bash', [sh], { input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 'x1', trigger: 'manual' }), env, encoding: 'utf8' });
    expect(bien.status).toBe(0);
    expect(leerRegistro(dir).at(-1)).toMatchObject({ evento: 'PreCompact', sesion: 'x1', causa: 'manual' });
    const mal = spawnSync('bash', [sh], { input: 'basura', env, encoding: 'utf8' });
    expect(mal.status).toBe(0);
  });

  test('esta cableado en settings.json en PreCompact y en PostCompact', () => {
    const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
    for (const ev of ['PreCompact', 'PostCompact']) {
      expect(JSON.stringify(s.hooks[ev])).toContain('compactacion-registro.sh');
    }
    // Lo que no se toca (plan 1.3.3): ni idleCompaction ni la ventana de autocompactado.
    expect(s.idleCompaction).toBeUndefined();
    expect(s.env?.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBeUndefined();
  });
});
