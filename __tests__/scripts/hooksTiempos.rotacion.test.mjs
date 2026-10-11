// Rotacion del registro de tiempos (P9, pendiente de C0) y el nombre del hook por env (P10).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anotar, correrMedido, rotarSiPesa } from '../../scripts/_lib/hooksTiempos.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tiempos-')), 'claude-hooks-tiempos.jsonl');
const viejo = (ruta) => ruta.replace(/\.jsonl$/, '.1.jsonl');
const eperm = () => { throw new Error('EPERM: operation not permitted'); };

describe('rotacion del registro (crece ~1 MB por mes)', () => {
  it('VERDE: pasado el tope, anotar pasa el registro a .1.jsonl y el renglon nuevo arranca otro', () => {
    const ruta = tmp(); fs.writeFileSync(ruta, 'x'.repeat(100));
    expect(anotar({ ev: 'fin', id: '1' }, { ruta, rotar: (r) => rotarSiPesa(r, { tope: 50 }) })).toBe(true);
    expect(fs.readFileSync(viejo(ruta), 'utf8')).toBe('x'.repeat(100));
    expect(fs.readFileSync(ruta, 'utf8')).toBe('{"ev":"fin","id":"1"}\n');
  });
  it('ROJO: por debajo del tope no rota', () => {
    const ruta = tmp(); fs.writeFileSync(ruta, 'x'.repeat(100));
    expect(rotarSiPesa(ruta, { tope: 1000 })).toBe(false); expect(fs.existsSync(viejo(ruta))).toBe(false);
  });
  it('ROJO: sin archivo o sin poder renombrar (Windows: otro lo tiene abierto) no rota, y anotar sigue en el mismo', () => {
    expect(rotarSiPesa(path.join(os.tmpdir(), 'no-existe-' + Date.now() + '.jsonl'))).toBe(false);
    const ruta = tmp(); fs.writeFileSync(ruta, 'x'.repeat(100));
    expect(anotar({ ev: 'fin', id: '2' }, { ruta, rotar: (r) => rotarSiPesa(r, { tope: 50, renombrar: eperm }) })).toBe(true);
    expect(fs.readFileSync(ruta, 'utf8').startsWith('x'.repeat(100))).toBe(true); expect(fs.existsSync(viejo(ruta))).toBe(false);
  });
});

describe('correrMedido: el nombre del hook lo manda el .sh', () => {
  const decidir = async () => ({ ok: true, titulo: 't' });
  const fases = async (env) => {
    const ruta = tmp();
    await correrMedido({ decidir, depsReales: {}, payload: { session_id: 's' }, env: { ...env, CLAUDE_HOOKS_TIEMPOS: ruta } });
    return JSON.parse(fs.readFileSync(ruta, 'utf8').trim());
  };
  it('VERDE: con CLAUDE_HOOKS_TIEMPOS_HOOK=stop-hooks el renglon de fases dice stop-hooks (el lector lo junta con inicio/fin)', async () => {
    expect((await fases({ CLAUDE_HOOKS_TIEMPOS_HOOK: 'stop-hooks' })).hook).toBe('stop-hooks');
  });
  it('ROJO: sin la variable sigue diciendo cierre-guard (la linea de base de P9 no cambia)', async () => {
    expect((await fases({})).hook).toBe('cierre-guard');
  });
});
