/**
 * Gate de fases con criterio de salida (gate 3f, 24/10/2026): gate_fase.py. Mira el canon, el renglon de retiro y el
 * cableado en la entrega, y lanza el gate por subproceso con el Python del 3D (.venv-cad) en las dos direcciones que se
 * pueden mirar sin armar piezas: el autotest propio separa BIEN de MAL (exit 0), y lo que no se puede medir NUNCA sale
 * verde (exit 2 con veredicto no_medido). Los casos F1 a F7 con piezas del banco y el virolador real estan en
 * .claude/skills/cad-design/scripts/test_gate_fase.py. Si no esta el Python del 3D, los de subproceso se saltean.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCR = join(RAIZ, '.claude', 'skills', 'cad-design', 'scripts');
const GATE = join(SCR, 'gate_fase.py');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);

function gate(args, test = true) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  if (test) env.CAD_GATE_TEST = '1';
  else delete env.CAD_GATE_TEST;
  const r = spawnSync(PY, ['-I', GATE, ...args], { encoding: 'utf8', timeout: 120000, env });
  const linea = (r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith('{"gate": "fase"'));
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), json: linea ? JSON.parse(linea) : null };
}

describe('gate de fases: canon, renglon de retiro y cableado', () => {
  it('canon: aviso hasta el 30/10 inclusive, las cinco fases de P1 y el OK de Fak en la 0 y la 2', () => {
    const c = JSON.parse(readFileSync(join(SCR, 'faseCanon.data.json'), 'utf8'));
    expect(c.aviso_hasta).toBe('2026-10-30');
    expect(c.frase_minima).toBeGreaterThanOrEqual(10);
    expect(c.fases.map((f) => f.nombre)).toEqual(['contrato', 'concepto', 'mecanismo', 'detalle', 'entrega']);
    expect(c.fases.filter((f) => f.pide_ok_fak).map((f) => f.n)).toEqual([0, 2]);
    for (const f of c.fases) expect(f.fuente).toMatch(/P1 l\.\d+/);
  });
  it('retiros.data.json tiene el renglon cad-design:fases-aviso-a-freno con fecha de revision', () => {
    const r = JSON.parse(readFileSync(join(RAIZ, 'scripts', '_lib', 'retiros.data.json'), 'utf8'));
    const f = r.retiros_decididos['cad-design:fases-aviso-a-freno'];
    expect(f).toBeTruthy();
    expect(f.revisar).toBe('2026-10-30');
    expect(f.justifica).toMatch(/\d/);
    expect(f.fuente).toMatch(/test_gate_fase\.py/);
  });
  it('export_deliverables.py corre el gate de fases antes de crear la carpeta destino y deja saltearlo con --reason', () => {
    const s = readFileSync(join(SCR, 'export_deliverables.py'), 'utf8');
    expect(s).toMatch(/"cantos", "barrido", "fases"\]/);
    expect(s).toMatch(/\[GATE fases\]/);
    const iGate = s.indexOf('fases_res = gate_fases(w, args.pieces, args.hoy)');
    const iDest = s.indexOf('os.makedirs(args.deliver, exist_ok=True)');
    expect(iGate).toBeGreaterThan(0);
    expect(iGate).toBeLessThan(iDest);
  });
});

describe.skipIf(!HAY_PY)('gate de fases por subproceso (Python del 3D)', () => {
  it('el autotest propio separa BIEN de MAL (exit 0)', () => {
    const r = gate(['--solo-autotest']);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/AUTOTEST OK/);
  }, 120000);
  it('workdir sin fases.json: NO MEDIDO (exit 2, veredicto no_medido), nunca verde', () => {
    const d = mkdtempSync(join(tmpdir(), 'gate_fase_'));
    const r = gate(['pasar', '--fase', '3', '--workdir', d]);
    expect(r.status, r.out).toBe(2);
    expect(r.json && r.json.veredicto).toBe('no_medido');
  }, 120000);
  it('fases.json roto: NO MEDIDO (exit 2) y no se sobreescribe', () => {
    const d = mkdtempSync(join(tmpdir(), 'gate_fase_'));
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'fases.json'), '{roto');
    const r = gate(['pasar', '--fase', '2', '--workdir', d]);
    expect(r.status, r.out).toBe(2);
    expect(readFileSync(join(d, 'fases.json'), 'utf8')).toBe('{roto');
  }, 120000);
  it('--hoy sin CAD_GATE_TEST=1: NO MEDIDO (exit 2)', () => {
    const d = mkdtempSync(join(tmpdir(), 'gate_fase_'));
    const r = gate(['pasar', '--fase', '3', '--workdir', d, '--hoy', '2026-11-02'], false);
    expect(r.status, r.out).toBe(2);
    expect(r.out).toMatch(/CAD_GATE_TEST/);
  }, 120000);
});
