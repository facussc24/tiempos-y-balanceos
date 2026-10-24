/**
 * Gate de barrido del recorrido (gate 3d, 23/10/2026): barrido.py. Lo lanza por subproceso con el Python del 3D
 * (.venv-cad) y mira las dos direcciones que se pueden mirar sin armar piezas: el autotest propio separa BIEN de MAL
 * (exit 0), y lo que no se puede medir NUNCA sale verde (exit 2 con medido:false). Los casos D1 a D10 con piezas del
 * banco y el virolador real estan en .claude/skills/cad-design/scripts/test_gate_barrido.py. Si no esta el Python del
 * 3D, los de subproceso se saltean.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCR = join(RAIZ, '.claude', 'skills', 'cad-design', 'scripts');
const GATE = join(SCR, 'barrido.py');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);

function gate(args) {
  const r = spawnSync(PY, ['-I', GATE, ...args], {
    encoding: 'utf8',
    timeout: 240000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', CAD_GATE_TEST: '1' },
  });
  const linea = (r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith('{"gate": "barrido"'));
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), json: linea ? JSON.parse(linea) : null };
}

describe('gate de barrido: canon y renglon de retiro', () => {
  it('canon: aviso hasta el 30/10 inclusive, dedo 25 y mano 100 con fuente, tope 120 s, luz de dedo en aviso', () => {
    const c = JSON.parse(readFileSync(join(SCR, 'barridoCanon.data.json'), 'utf8'));
    expect(c.aviso_hasta).toBe('2026-10-30');
    expect(c.dedo_mm).toBe(25);
    expect(c.mano_mm).toBe(100);
    expect(c._dedo_mano).toMatch(/ISO 13854/);
    expect(c.tope_segundos).toBe(120);
    expect(c.luces_frenan).toBe(false);
    expect(c.luces_revisar).toBe('2026-10-30');
    expect(c.guarda_fraccion_seccion).toBeGreaterThan(0);
    expect(c.guarda_fraccion_seccion).toBeLessThanOrEqual(1);
    expect(c.frase_minima).toBeGreaterThanOrEqual(10);
  });
  it('retiros.data.json tiene el renglon cad-design:barrido-aviso-a-freno con fecha de revision', () => {
    const r = JSON.parse(readFileSync(join(RAIZ, 'scripts', '_lib', 'retiros.data.json'), 'utf8'));
    const f = r.retiros_decididos['cad-design:barrido-aviso-a-freno'];
    expect(f).toBeTruthy();
    expect(f.revisar).toBe('2026-10-30');
    expect(f.justifica).toMatch(/\d/);
    expect(f.fuente).toMatch(/test_gate_barrido\.py/);
  });
});

describe.skipIf(!HAY_PY)('gate de barrido por subproceso (Python del 3D)', () => {
  it('el autotest propio separa BIEN de MAL (exit 0)', () => {
    const r = gate(['--solo-autotest']);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/AUTOTEST OK/);
  }, 240000);
  it('json que no existe: NO MEDIDO (exit 2, medido false), nunca verde', () => {
    const r = gate([join(SCR, 'no_existe_barrido.json')]);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.medido).toBe(false);
    expect(r.json && r.json.veredicto).toBe('no_medido');
  }, 240000);
  it('rango nulo [0, 0] y STEP que no existe: NO MEDIDO (exit 2), nunca verde', () => {
    const d = mkdtempSync(join(tmpdir(), 'gate_barrido_'));
    const j = join(d, 'conjunto.json');
    writeFileSync(j, JSON.stringify({ partes: ['base', 'palanca'], archivos: { base: 'no.step', palanca: 'no.step' },
      movil: 'palanca', eje: { origen: [0, 0, 0], dir: [0, -1, 0] }, rango_grados: [0, 0] }));
    const r = gate([j]);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.medido).toBe(false);
  }, 240000);
});
