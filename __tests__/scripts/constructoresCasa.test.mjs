/**
 * Constructores de la casa (propuesta 2 del informe 3D, 24/10/2026): cadlib/constructores.py (build123d) y su gemelo
 * scripts/catia/constructores_casa.py (CATIA), con el lenguaje de diseno y el catalogo de la casa como datos.
 * Sin el Python del 3D corre lo que se puede mirar en los json (un numero vive en un solo lugar, cada ficha apunta a un
 * caso del banco que existe); con el Python, los dos tests en las dos direcciones (test_constructores.py: BIEN/MAL de
 * cada constructor y paridad de nombres y parametros con CATIA; test_constructores_casa.py: colocar() no llega a CATIA
 * con un espejo).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL = join(RAIZ, '.claude', 'skills', 'cad-design');
const SCR = join(SKILL, 'scripts');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);
const leer = (p) => JSON.parse(readFileSync(p, 'utf8'));

describe('lenguaje de diseno de la casa (datos)', () => {
  const L = leer(join(SKILL, 'data', 'lenguaje_diseno.json'));
  it('el radio de la mano apunta al canon de cantos y no repite el numero', () => {
    const r = L.radios.mano_y_pieza;
    expect(r.desde).toBe('scripts/cantosCanon.data.json#umbral_mm');
    expect(r).not.toHaveProperty('mm');
    expect(leer(join(SCR, 'cantosCanon.data.json')).umbral_mm).toBe(1.5);
  });
  it('cada radio y chaflan trae su fuente; el tamano del chaflan de cama esta A DECIDIR', () => {
    for (const g of ['radios', 'chaflanes']) {
      for (const [n, v] of Object.entries(L[g])) expect(v.fuente, `${g}.${n}`).toBeTruthy();
    }
    expect(L.chaflanes.cara_de_cama.mm).toBeNull();
    expect(L.chaflanes.cara_de_cama.angulo_deg).toBe(45);
    expect(L.chaflanes.cara_de_cama.estado_mm).toMatch(/A DECIDIR/);
  });
  it('tornilleria comun con su fuente y color por funcion marcado como opinion', () => {
    expect(L.tornilleria.fuente).toMatch(/feedback_tornilleria_comun_argentina/);
    expect(L.tornilleria.tuerca_impresa_alto_min_D.desde).toBe('scripts/tornillosCanon.data.json#tuerca_impresa_altura_min_D');
    expect(L.color_por_funcion.estado).toMatch(/opinion/);
  });
});

describe('catalogo de la casa', () => {
  const C = leer(join(SKILL, 'data', 'catalogo_casa.json'));
  it('caja, placa, colocar y la palanca de MakerWorld, cada una con su caso del banco', () => {
    const ids = C.fichas.map((f) => f.id);
    for (const id of ['caja', 'placa', 'colocar', 'palanca_traba_makerworld']) expect(ids).toContain(id);
    expect(new Set(ids).size, 'ids repetidos').toBe(ids.length);
    for (const f of C.fichas) {
      const caso = f.banco.split(' ')[0];
      expect(existsSync(join(RAIZ, ...caso.split('/'))), `${f.id}: ${caso}`).toBe(true);
      expect(f.estado, f.id).toBeTruthy();
    }
  });
  it('los constructores dicen donde viven en build123d y en CATIA, y ese archivo existe', () => {
    for (const f of C.fichas.filter((x) => x.tipo === 'constructor')) {
      expect(f.donde.build123d, f.id).toMatch(/^cadlib\.constructores\./);
      expect(f.donde.catia, f.id).toMatch(/^scripts\/catia\/constructores_casa\.py /);
    }
    expect(existsSync(join(SCR, 'cadlib', 'constructores.py'))).toBe(true);
    expect(existsSync(join(RAIZ, 'scripts', 'catia', 'constructores_casa.py'))).toBe(true);
  });
  it('la palanca de MakerWorld se apunta con sha256 y no entra al repo publico', () => {
    const p = C.fichas.find((f) => f.id === 'palanca_traba_makerworld');
    expect(p.licencia).toMatch(/PUBLICO/);
    for (const v of Object.values(p.archivos.piezas_stl)) expect(v.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(join(RAIZ, 'evals', 'banco3d', 'ejercicios', '22_constructor_colocar', 'stl'))).toBe(false);
  });
});

describe.skipIf(!HAY_PY)('constructores por subproceso (Python del 3D)', () => {
  it('test_constructores.py: BIEN/MAL de cada constructor y paridad con CATIA', () => {
    const r = spawnSync(PY, ['-I', join(SCR, 'test_constructores.py')], {
      encoding: 'utf8', timeout: 600000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    expect(r.status, (r.stdout || '') + (r.stderr || '')).toBe(0);
    expect(r.stdout).toMatch(/RESULTADO: OK/);
  }, 600000);
  it('test_constructores_casa.py: colocar() no llega a CATIA con un espejo', () => {
    const r = spawnSync(PY, ['-I', '-m', 'unittest', 'discover', '-s', join(RAIZ, 'scripts', 'catia', 'tests'),
      '-p', 'test_constructores_casa.py'], { encoding: 'utf8', timeout: 120000 });
    expect(r.status, (r.stdout || '') + (r.stderr || '')).toBe(0);
  }, 120000);
});
