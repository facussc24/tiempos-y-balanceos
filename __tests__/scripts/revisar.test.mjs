/**
 * scripts/revisar.py — el revisor de contenido de un entregable (tanda 16, pieza 2).
 * Caso de respuesta conocida: los 13 entregables que Fak devolvio por la forma (informe G, tabla 1.3), como gemelos
 * minimos armados en scripts/_lib/revisarCasos.py: los 10 por contenido dan ROJO antes y VERDE despues; los 3
 * visuales dan VERDE en la version que quedo. Los entregables reales aceptados (exports/, fuera de git) se corrieron en
 * local el 18/10: 0 falsos rojos (docs/FORMATO_CASA.md).
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const hayPython = spawnSync(PY, ['-c', 'import pptx, openpyxl, fitz'], { encoding: 'utf8' }).status === 0;
const revisar = (...args) => spawnSync(PY, [join(RAIZ, 'scripts/revisar.py'), ...args], { encoding: 'utf8', timeout: 240000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

describe.runIf(hayPython)('revisar.py', () => {
  it('los 13 casos conocidos: 10 por contenido ROJO antes y VERDE despues, 3 visuales VERDE', () => {
    const r = revisar('--selftest');
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/10 de 10 dan ROJO antes y VERDE despues/);
    expect(r.stdout).toMatch(/SELFTEST OK/);
  }, 250000);

  it('un texto con «qué haría» y un bloque NOTAS da ROJO con el renglon, y sale 1', () => {
    const d = mkdtempSync(join(tmpdir(), 'revisar-'));
    try {
      const f = join(d, 'resumen.txt');
      writeFileSync(f, 'Las tres campañas siguen activas\nNOTAS: el alcance sale de Meta\nQué haría yo: subir el presupuesto\n');
      const r = revisar(f, '--sin-render', '--json');
      expect(r.status).toBe(1);
      const rep = JSON.parse(r.stdout);
      const rojo = (id) => rep.reglas.find((x) => x.regla === id);
      expect(rojo('notas-de-mas').estado).toBe('ROJO');
      expect(rojo('notas-de-mas').donde).toMatch(/renglon 2/);
      expect(rojo('recomendaciones').estado).toBe('ROJO');
      writeFileSync(f, 'Las tres campañas siguen activas\nAlcance total 12.400 personas\n');
      expect(revisar(f, '--sin-render').status).toBe(0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }, 60000);

  it('sin archivo no hace nada y sale 2', () => {
    expect(revisar(join(tmpdir(), 'no-existe-revisar.pptx')).status).toBe(2);
  });
});
