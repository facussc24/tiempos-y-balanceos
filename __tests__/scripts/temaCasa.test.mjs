/**
 * El tema de la casa (tanda 16, pieza 3): scripts/_lib/tema.json + sus cargadores temaCasa.mjs y temaCasa.py.
 * Dos direcciones: con el logo oficial carga; con un logo que no es el oficial (o sin logo) FRENA, en JS y en Python.
 * Y los generadores que pasaron a leerlo: el azul de cabecera da el MISMO valor de antes (salida identica) y ya no
 * queda escrito a mano.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarTema, colorCss, letraCss, sha256 } from '../../scripts/_lib/temaCasa.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const TEMA = JSON.parse(readFileSync(join(RAIZ, 'scripts/_lib/tema.json'), 'utf8'));
const OFICIAL = '6798d5bc388318b17386055d1c27b8c2dfa83ae168a78b185a89e81953449657';
const PY = process.platform === 'win32' ? 'python' : 'python3';
const hayPython = spawnSync(PY, ['-c', 'import pptx'], { encoding: 'utf8' }).status === 0;

/** Una raiz falsa con el tema y un logo dado. */
function raizFalsa(contenidoLogo) {
  const d = mkdtempSync(join(tmpdir(), 'tema-'));
  mkdirSync(join(d, 'tools/flowchart/assets'), { recursive: true });
  if (contenidoLogo !== null) writeFileSync(join(d, TEMA.logo.ruta_repo), contenidoLogo);
  writeFileSync(join(d, 'tema.json'), JSON.stringify(TEMA));
  return d;
}

describe('tema de la casa', () => {
  it('el logo del tema es el oficial (el mismo sha256 que el canon de firma)', () => {
    expect(TEMA.logo.sha256).toBe(OFICIAL);
    const firma = JSON.parse(readFileSync(join(RAIZ, 'scripts/_lib/firmaIA.data.json'), 'utf8'));
    expect(firma.logo.oficial.sha256).toBe(OFICIAL);
    expect(sha256(join(RAIZ, TEMA.logo.ruta_repo))).toBe(OFICIAL);
  });

  it('JS: carga con el logo oficial y da colores y letra', () => {
    const t = cargarTema();
    expect(t.logo.ruta).toMatch(/barack_logo\.png$/);
    expect(colorCss('cabecera')).toBe('#44546A');
    expect(letraCss()).toMatch(/^"Calibri"/);
    expect(() => colorCss('violeta')).toThrow(/no tiene el color/);
  });

  it('JS: frena con un logo que no es el oficial, y sin logo', () => {
    const d1 = raizFalsa(Buffer.from('no soy el logo'));
    const d2 = raizFalsa(null);
    try {
      expect(() => cargarTema({ rutaTema: join(d1, 'tema.json'), raiz: d1 })).toThrow(/NO es el oficial/);
      expect(() => cargarTema({ rutaTema: join(d2, 'tema.json'), raiz: d2 })).toThrow(/no esta el logo/);
      copyFileSync(join(RAIZ, TEMA.logo.ruta_repo), join(d2, TEMA.logo.ruta_repo));
      expect(cargarTema({ rutaTema: join(d2, 'tema.json'), raiz: d2 }).colores.cabecera.valor).toBe('44546A');
    } finally { rmSync(d1, { recursive: true, force: true }); rmSync(d2, { recursive: true, force: true }); }
  });

  it.runIf(hayPython)('Python: el comando dice VERDE con el oficial y frena con otro logo', () => {
    const ok = spawnSync(PY, [join(RAIZ, 'scripts/_lib/temaCasa.py')], { encoding: 'utf8' });
    expect(ok.status, ok.stdout + ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/VERDE/);
    const d = raizFalsa(Buffer.from('otro logo'));
    try {
      const r = spawnSync(PY, ['-c', [
        'import sys; sys.path.insert(0, sys.argv[1]); import temaCasa',
        'try:\n    temaCasa.cargar(ruta_tema=sys.argv[2] + "/tema.json", raiz=sys.argv[2]); print("CARGO")\nexcept temaCasa.TemaError as e:\n    print("FRENO", e)',
      ].join('\n'), join(RAIZ, 'scripts/_lib'), d], { encoding: 'utf8' });
      expect(r.stdout).toMatch(/^FRENO .*NO es el oficial/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('ningun script vuelve a nombrar el logo no oficial de la lamina; la lamina pide el logo al tema', () => {
    // el PNG viejo (scripts/lamina_proceso/logo_barack.png, sha256 deef25cd...) queda en el disco sin uso: borrar lleva pregunta
    const r = spawnSync('git', ['ls-files', '*.py', '*.mjs', '*.js', '*.sh'], { cwd: RAIZ, encoding: 'utf8' });
    const quienLoNombra = r.stdout.split(/\r?\n/).filter(Boolean)
      .filter((p) => !p.startsWith('__tests__/'))
      .filter((p) => { try { return readFileSync(join(RAIZ, p), 'utf8').includes('logo_barack.png'); } catch { return false; } });
    expect(quienLoNombra).toEqual([]);
    expect(readFileSync(join(RAIZ, 'scripts/lamina_proceso/insert_patagonia.py'), 'utf8')).toMatch(/temaCasa\.logo\(\)/);
  });

  // la lamina regenerada el 18/10 vive en exports/ (fuera de git): este control corre solo en la PC que la tiene
  const LAMINA = 'C:/Dev/BarackMercosul/exports/LAMINA_PROCESO_INSERT_LOGO_OFICIAL_20261018/Proceso de fabricacion - Insert Patagonia.pptx';
  it.runIf(hayPython && existsSync(LAMINA))('la lamina del Insert regenerada lleva adentro el logo oficial (sha256) y no el viejo', () => {
    const codigo = 'import zipfile, hashlib, sys\nz = zipfile.ZipFile(sys.argv[1])\nfor n in z.namelist():\n    if n.startswith("ppt/media/"): print(hashlib.sha256(z.read(n)).hexdigest())';
    const r = spawnSync(PY, ['-c', codigo, LAMINA], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const hashes = r.stdout.split(/\r?\n/).filter(Boolean);
    expect(hashes).toContain(OFICIAL);
    expect(hashes.some((h) => h.startsWith('deef25cd'))).toBe(false);
  });

  it('el azul de la casa lo eligio el dueño (18/10) y los generadores que tenian otro azul lo leen del tema', () => {
    expect(TEMA.colores.acento.valor).toBe('44546A');
    expect(TEMA.colores.acento.estado).toMatch(/ELEGIDO/);
    for (const p of ['scripts/lamina_proceso/motor.py', '.claude/skills/superficie-vinilo-3d/scripts/svlib_lamina.py', 'scripts/hilos/matriz_hilos.py', 'scripts/hilos/plan_medicion_hilos.py']) {
      const t = readFileSync(join(RAIZ, p), 'utf8');
      expect(t, p).toMatch(/temaCasa\.color\("acento"\)/);
      expect(t, p).not.toMatch(/AZUL\w* = "004E98"|AZUL_B = RGBColor\(0x1B, 0x4F, 0x8F\)|AZUL\w* = '1F3A5F'|AZUL = RGBColor\(0x1F, 0x3A, 0x5F\)/);
    }
  });

  const MIGRADOS = ['scripts/img/generar_hojas_img.py', 'scripts/hotmelt/generar_hojas_hotmelt.py', 'scripts/hotmelt/generar_hojas_hotmelt_a3.py', 'scripts/hotmelt/hoja_pptx.py', 'scripts/novax/generar_hojas_insert.py'];

  it('los generadores migrados ya no escriben el azul a mano y lo piden al tema', () => {
    for (const p of [...MIGRADOS, 'scripts/hotmelt/cuadro_estructura.py']) {
      const t = readFileSync(join(RAIZ, p), 'utf8');
      expect(t, p).not.toMatch(/RGBColor\(0x44, 0x54, 0x6A\)|bg_color="#44546A"/);
      expect(t, p).toMatch(/temaCasa\.color\("cabecera"\)/);
    }
    const ta = readFileSync(join(RAIZ, 'scripts/_temasAbiertos.mjs'), 'utf8');
    expect(ta).not.toMatch(/'#44546A'|--azul:#44546A/);
    expect(ta).toMatch(/colorCss\('cabecera'\)/);
  });

  it.runIf(hayPython)('los generadores migrados dan el mismo azul de antes (salida identica)', () => {
    const codigo = [
      'import importlib.util, sys, os',
      'from pptx.dml.color import RGBColor',
      'for p in sys.argv[1:]:',
      '    sys.path.insert(0, os.path.dirname(p))',
      '    s = importlib.util.spec_from_file_location("m", p); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
      '    sys.stderr.write(("IGUAL " if m.AZUL == RGBColor(0x44, 0x54, 0x6A) else "DISTINTO ") + os.path.basename(p) + "\\n")',
    ].join('\n');
    const r = spawnSync(PY, ['-c', codigo, ...MIGRADOS.map((p) => join(RAIZ, p))], { encoding: 'utf8', timeout: 120000 });
    expect(r.status, r.stderr).toBe(0);
    expect((r.stderr.match(/^IGUAL /gm) || []).length, r.stderr).toBe(MIGRADOS.length);
  }, 150000);
});
