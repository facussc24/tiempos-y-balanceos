/**
 * Las plantillas del formato de la casa (tanda 16, piezas 5, 6 y 7): scripts/plantillasCasa.py las arma desde el tema y
 * cada una tiene que pasar el revisor de contenido (scripts/revisar.py) y no decir que la hizo una IA (_sinFirmaIA.py
 * con el logo como freno). Se arman en una carpeta temporal: el test no depende de los archivos de templates/.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const hayPython = spawnSync(PY, ['-c', 'import pptx, openpyxl, fitz'], { encoding: 'utf8' }).status === 0;
const py = (...a) => spawnSync(PY, a, { encoding: 'utf8', timeout: 240000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

describe.runIf(hayPython)('plantillas de la casa', () => {
  it('arma las cuatro y cada una pasa el revisor y la firma', () => {
    const d = mkdtempSync(join(tmpdir(), 'plantillas-'));
    try {
      const g = py(join(RAIZ, 'scripts/plantillasCasa.py'), '--salida', d);
      expect(g.status, g.stdout + g.stderr).toBe(0);
      const hechas = readdirSync(d).sort();
      expect(hechas).toEqual(['CASA_EXCEL_B2.xltx', 'CASA_HOJA_A3.pptx', 'CASA_PRESENTACION_LEER.pptx', 'CASA_PRESENTACION_PROYECTAR.pptx']);
      for (const f of hechas) {
        const tipo = f.includes('PROYECTAR') ? ['--tipo', 'proyectar'] : [];
        const r = py(join(RAIZ, 'scripts/revisar.py'), join(d, f), '--sin-render', ...tipo);
        expect(r.status, `${f}\n${r.stdout}`).toBe(0);
        const fi = py(join(RAIZ, 'scripts/_sinFirmaIA.py'), '--logo-bloquea', join(d, f));
        expect(fi.status, `${f}\n${fi.stdout}`).toBe(0);
      }
    } finally { rmSync(d, { recursive: true, force: true }); }
  }, 250000);
});
