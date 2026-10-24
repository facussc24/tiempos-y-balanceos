/**
 * Gate de tornillos: largo de agarre y de rosca contra la pila real (gate 3e, 23/10/2026): gate_tornillos.py.
 * Lo lanza por subproceso con el Python del 3D (.venv-cad) y mira las dos direcciones que se pueden mirar sin armar
 * conjuntos: el autotest propio separa BIEN de MAL (exit 0), y lo que no se puede medir NUNCA sale verde (exit 2 con
 * medido:false). Los casos E1 a E5 con conjuntos armados estan en
 * .claude/skills/cad-design/scripts/test_gate_tornillos.py. Si no esta el Python del 3D, los de subproceso se saltean.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCR = join(RAIZ, '.claude', 'skills', 'cad-design', 'scripts');
const GATE = join(SCR, 'gate_tornillos.py');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);

function gate(args) {
  const r = spawnSync(PY, ['-I', GATE, ...args], {
    encoding: 'utf8',
    timeout: 240000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', CAD_GATE_TEST: '1' },
  });
  const linea = (r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith('{"gate": "tornillos"'));
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), json: linea ? JSON.parse(linea) : null };
}

describe('gate de tornillos: canon y renglon de retiro', () => {
  it('canon: aviso hasta el 30/10 inclusive, R2/R3 con fuente, los numeros sin fuente quedan en null', () => {
    const c = JSON.parse(readFileSync(join(SCR, 'tornillosCanon.data.json'), 'utf8'));
    expect(c.aviso_hasta).toBe('2026-10-30');
    expect(c.frase_minima).toBeGreaterThanOrEqual(10);
    expect(c.rosca_en_plastico_D).toEqual([1.5, 2.5]);
    expect(c._rosca_en_plastico_D).toMatch(/ficha-fdm\.md/);
    expect(c._tuerca_impresa_altura_min_D).toMatch(/R2/);
    expect(c.sobresale_min_pasos).toBeNull();
    expect(c.inserto_holgura_mm).toBeNull();
  });
  it('retiros.data.json tiene el renglon cad-design:tornillos-aviso-a-freno despues del de cantos', () => {
    const r = JSON.parse(readFileSync(join(RAIZ, 'scripts', '_lib', 'retiros.data.json'), 'utf8'));
    const f = r.retiros_decididos['cad-design:tornillos-aviso-a-freno'];
    expect(f).toBeTruthy();
    expect(f.revisar).toBe('2026-10-30');
    expect(f.justifica).toMatch(/\d/);
    const claves = Object.keys(r.retiros_decididos);
    expect(claves.indexOf('cad-design:tornillos-aviso-a-freno')).toBe(claves.indexOf('cad-design:cantos-aviso-a-freno') + 1);
  });
});

describe.skipIf(!HAY_PY)('gate de tornillos por subproceso (Python del 3D)', () => {
  it('el autotest propio separa BIEN de MAL (exit 0)', () => {
    const r = gate(['--solo-autotest']);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/AUTOTEST OK/);
  }, 240000);
  it('STEP que no existe: NO MEDIDO (exit 2, medido false), nunca verde', () => {
    const r = gate(['--step', join(SCR, 'no_existe_tornillos.step'), '--tornillos', join(SCR, 'tornillosCanon.data.json')]);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.medido).toBe(false);
  }, 240000);
  it('sin --tornillos: NO MEDIDO (exit 2), nunca verde', () => {
    const r = gate(['--step', join(SCR, 'no_existe_tornillos.step')]);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.veredicto).toBe('no_medido');
  }, 240000);
});
