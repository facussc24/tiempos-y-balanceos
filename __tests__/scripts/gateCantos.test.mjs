/**
 * Gate de cantos convexos donde va la mano (gate 3c, 23/10/2026): gate_aristas.py --cantos-convexos.
 * Lo lanza por subproceso con el Python del 3D (.venv-cad) y mira las dos direcciones que se pueden mirar sin armar
 * piezas: el autotest propio separa BIEN de MAL (exit 0), y lo que no se puede medir NUNCA sale verde (exit 2 con
 * medido:false). Los casos C1 a C9 con piezas del banco estan en
 * .claude/skills/cad-design/scripts/test_gate_cantos.py. Si no esta el Python del 3D, los de subproceso se saltean.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCR = join(RAIZ, '.claude', 'skills', 'cad-design', 'scripts');
const GATE = join(SCR, 'gate_aristas.py');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);

function gate(args) {
  const r = spawnSync(PY, ['-I', GATE, '--cantos-convexos', ...args], {
    encoding: 'utf8',
    timeout: 240000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', CAD_GATE_TEST: '1' },
  });
  const linea = (r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith('{"gate": "cantos_convexos"'));
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), json: linea ? JSON.parse(linea) : null };
}

describe('gate de cantos: canon y renglon de retiro', () => {
  it('canon: R1,5 con fuente, aviso hasta el 30/10 inclusive, sin zona en la entrega es aviso', () => {
    const c = JSON.parse(readFileSync(join(SCR, 'cantosCanon.data.json'), 'utf8'));
    expect(c.umbral_mm).toBe(1.5);
    expect(c._umbral_mm).toMatch(/ficha-utillajes\.md/);
    expect(c.aviso_hasta).toBe('2026-10-30');
    expect(c.sin_zona_en_entrega).toBe('aviso');
    expect(c.frase_minima).toBeGreaterThanOrEqual(10);
  });
  it('retiros.data.json tiene el renglon cad-design:cantos-aviso-a-freno con fecha de revision', () => {
    const r = JSON.parse(readFileSync(join(RAIZ, 'scripts', '_lib', 'retiros.data.json'), 'utf8'));
    const f = r.retiros_decididos['cad-design:cantos-aviso-a-freno'];
    expect(f).toBeTruthy();
    expect(f.revisar).toBe('2026-10-30');
    expect(f.justifica).toMatch(/\d/);
  });
});

describe.skipIf(!HAY_PY)('gate de cantos por subproceso (Python del 3D)', () => {
  it('el autotest propio separa BIEN de MAL (exit 0)', () => {
    const r = gate(['--solo-autotest']);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/AUTOTEST OK/);
  }, 240000);
  it('sin zona de mano: NO MEDIDO (exit 2, medido false), nunca verde', () => {
    const r = gate(['--step', join(SCR, 'no_existe_cantos.step')]);
    expect(r.status, r.out).toBe(2);
    expect(r.out).toMatch(/falta zona de mano/);
    expect(r.json && r.json.medido).toBe(false);
  }, 240000);
  it('STEP que no existe: NO MEDIDO (exit 2), nunca verde', () => {
    const r = gate(['--step', join(SCR, 'no_existe_cantos.step'), '--sin-zona', 'pieza entera']);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.veredicto).toBe('no_medido');
  }, 240000);
});
