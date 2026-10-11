/**
 * _imprimir.py no deja basura en el TEMP (cola HOY-13, 10/10/2026): el 10/10 habia 1,08 GB de tres corridas
 * viejas y una corrida en seco de 2 paginas dejo un archivo de 956 MB. Lo que ya se mando va a la PAPELERA
 * (nunca un borrado permanente: regla de la casa, incidente 2026-08-07); en seco queda solo la vista previa;
 * `--conservar` deja todo; y al arrancar, las carpetas imprimir_* de mas de 24 h del TEMP van a la Papelera.
 *
 * Dos pruebas corren el script de verdad (python + Ghostscript del PDFCreator); si falta alguno, lo dicen en voz
 * alta y se saltean: un verde sin correr nada no es un verde.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_imprimir.py');
const GS = 'C:\\Program Files\\PDFCreator\\Ghostscript\\Bin\\gswin32c.exe';
// un PDF versionado y sin nombre de IA adentro (docs/VOZ_DE_FAK.pdf nombra a Claude y el gate de firma lo frena, bien)
const PDF = path.join(RAIZ, 'public', 'ref-flujograma.pdf');
// La Papelera es de Windows (PowerShell + Microsoft.VisualBasic): en el CI de GitHub (Linux) las dos pruebas que
// corren el script se saltean en voz alta; el 10/10 a las 22:14 el CI quedo rojo porque corrian igual y la carpeta
// «vieja» no iba a ninguna Papelera.
const esWindows = process.platform === 'win32';
const hayPython = esWindows && spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;
const puedeCorrer = hayPython && fs.existsSync(GS) && fs.existsSync(PDF);
if (!puedeCorrer) console.warn('SALTEADO imprimirTemporal: hace falta Windows, python, Ghostscript y public/ref-flujograma.pdf');

describe('_imprimir.py: la carpeta temporal (HOY-13)', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');

  it('nunca borra en forma permanente: todo va a la Papelera de Windows', () => {
    expect(src).toContain("'SendToRecycleBin'");
    expect(src).not.toMatch(/shutil\.rmtree|os\.remove\(|os\.unlink\(|os\.rmdir\(|-Recurse|-Force/);
  });

  it('la carpeta de un trabajo mandado va a la Papelera en el finally, salvo --seco o --conservar', () => {
    const finallyIdx = src.indexOf('    finally:');
    expect(finallyIdx).toBeGreaterThan(0);
    const tramo = src.slice(finallyIdx, finallyIdx + 600);
    expect(tramo).toMatch(/if not a\.seco and not a\.conservar:\s*\n\s+a_papelera\(tmp\)/);
    expect(src).toContain("'--conservar'");
  });

  it.skipIf(!puedeCorrer)('en seco deja la vista previa y manda el archivo de impresion a la Papelera', () => {
    const antes = new Set(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('imprimir_')));
    const r = spawnSync('python', [SCRIPT, PDF, '--seco', '--paginas', '1'], { encoding: 'utf8', cwd: RAIZ, timeout: 110000 });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('SECO: no se mando nada.');
    expect(r.stdout).toContain('fue a la Papelera');
    const nuevas = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('imprimir_') && !antes.has(n));
    expect(nuevas.length).toBe(1);
    const carpeta = path.join(os.tmpdir(), nuevas[0]);
    const quedo = fs.readdirSync(carpeta);
    expect(quedo).toContain('vista_previa.png');
    expect(quedo).not.toContain('trabajo.pxl');
    // la carpeta de esta prueba tambien va a la Papelera, por el mismo camino del script
    const limpio = spawnSync('python', ['-c', `import sys; sys.path.insert(0, r'${path.join(RAIZ, 'scripts')}'); import _imprimir; print(_imprimir.a_papelera(r'${carpeta}'))`], { encoding: 'utf8', timeout: 60000 });
    expect(limpio.stdout.trim()).toBe('True');
    expect(fs.existsSync(carpeta)).toBe(false);
  });

  it.skipIf(!hayPython)('limpiar_viejas manda a la Papelera solo las imprimir_* de mas de 24 h y deja las nuevas', () => {
    const vieja = fs.mkdtempSync(path.join(os.tmpdir(), 'imprimir_'));
    const nueva = fs.mkdtempSync(path.join(os.tmpdir(), 'imprimir_'));
    fs.writeFileSync(path.join(vieja, 'x.txt'), 'prueba');
    const hace2dias = (Date.now() - 48 * 3600 * 1000) / 1000;
    fs.utimesSync(vieja, hace2dias, hace2dias);
    const r = spawnSync('python', ['-c', `import sys; sys.path.insert(0, r'${path.join(RAIZ, 'scripts')}'); import _imprimir; print(len(_imprimir.limpiar_viejas()))`], { encoding: 'utf8', timeout: 90000 });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(fs.existsSync(vieja)).toBe(false);
    expect(fs.existsSync(nueva)).toBe(true);
    // la nueva de esta prueba tambien va a la Papelera
    spawnSync('python', ['-c', `import sys; sys.path.insert(0, r'${path.join(RAIZ, 'scripts')}'); import _imprimir; _imprimir.a_papelera(r'${nueva}')`], { encoding: 'utf8', timeout: 60000 });
    expect(fs.existsSync(nueva)).toBe(false);
  });
});
