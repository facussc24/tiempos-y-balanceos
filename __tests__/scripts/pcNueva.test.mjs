// pcNueva (tanda 1.6, 16/10/2026): que le falta a una PC para correr los scripts de la casa. Logica pura con las
// dependencias inyectadas (lo que existe, que programa esta, que dice python), en las dos direcciones.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { faltantes, avisoPcNueva, queDe, PIEZAS_PC, IMPORTS_PYTHON, MARCA_PC_NUEVA, medirPc } from '../../scripts/_lib/pcNueva.mjs';

const REPO = 'C:\\Dev\\BarackMercosul';
const HOME = 'C:\\Users\\catav';
const PROGRAMAS = 'C:\\Program Files';
const todo = new Set([
  path.join(REPO, 'node_modules', '@supabase', 'supabase-js'), path.join(REPO, '.venv-cad'),
  path.join(PROGRAMAS, 'Bambu Studio'), path.join(PROGRAMAS, 'PDFCreator', 'Ghostscript', 'Bin', 'gswin32c.exe'), path.join(HOME, '.claude', 'mods-casa'),
]);
const PY = { ok: { estado: 'ok', faltan: [] }, faltan: { estado: 'faltan', faltan: ['pptx', 'PIL', 'fitz'] }, sin: { estado: 'sin-python', faltan: [] }, noMedido: { estado: 'no-medido', faltan: [] } };
const deps = ({ sin = [], programas = ['ffmpeg', 'gswin64c'], python = PY.ok } = {}) => ({
  repo: REPO, home: HOME, programas: PROGRAMAS, pc: 'CATA',
  existe: (p) => todo.has(p) && !sin.some((s) => p.includes(s)),
  cual: (prog) => programas.includes(prog),
  python: () => python,
});

describe('pcNueva — que falta y que comando lo arregla', () => {
  it('VERDE: una PC completa no tiene faltantes y el aviso es vacio', () => {
    expect(faltantes(deps())).toEqual([]);
    expect(avisoPcNueva(deps())).toBe('');
  });

  it('ROJO: CATA el 15/10 (sin node_modules, sin paquetes de Python, sin venv, sin ffmpeg, sin Ghostscript, sin Bambu, sin mods): 7 faltantes', () => {
    const d = deps({ sin: ['node_modules', '.venv-cad', 'Bambu Studio', 'PDFCreator', 'mods-casa'], programas: [], python: PY.faltan });
    const f = faltantes(d).map((p) => p.clave);
    expect(f).toEqual(['node_modules', 'python', 'venv-cad', 'ffmpeg', 'ghostscript', 'bambu-studio', 'mods']);
    const aviso = avisoPcNueva(d);
    expect(aviso.startsWith(`${MARCA_PC_NUEVA} A esta PC (CATA) le faltan 7 cosas`)).toBe(true);
    expect(aviso).toContain('-> npm ci');
    expect(aviso).toContain('requirements.txt (faltan: pptx, PIL, fitz) -> pip install -r requirements.txt');
    expect(aviso).toContain('-> winget install Gyan.FFmpeg');
    expect(aviso).toContain('-> node scripts/_modsInstalar.mjs --aplicar');
    expect(aviso).toContain('con el si de Fak');
  });

  it('una sola cosa: singular, y el comando justo', () => {
    const aviso = avisoPcNueva(deps({ programas: ['gswin64c'] }));
    expect(aviso).toContain('le falta 1 cosa');
    expect(aviso).toContain('ffmpeg/ffprobe');
    expect(aviso).not.toContain('npm ci');
  });

  it('sin Python en el PATH se dice que falta el programa, no los paquetes; un python que no contesto (H9) no avisa nada', () => {
    expect(faltantes(deps({ python: PY.sin })).map((p) => p.clave)).toEqual(['python-programa']);
    expect(faltantes(deps({ python: PY.noMedido })).map((p) => p.clave)).toEqual([]);
  });

  it('H4: el Ghostscript que se mide es el de PDFCreator (el que usa _imprimir.py), no el de ghostscript.com; una pieza que revienta al medir no cuenta como faltante', () => {
    const sinPdfCreator = deps({ sin: ['PDFCreator'] });
    const f = faltantes(sinPdfCreator);
    expect(f.map((p) => p.clave)).toEqual(['ghostscript']);
    expect(queDe(f[0], sinPdfCreator)).toContain('PDFCreator');
    expect(f[0].comando).toContain('PDFCreator');
    expect(f[0].comando).not.toMatch(/^instalar Ghostscript desde ghostscript\.com/);
    const d = deps(); d.cual = () => { throw new Error('where roto'); };
    expect(faltantes(d).map((p) => p.clave)).toEqual([]);
  });

  it('las piezas tienen clave unica, un que y un comando; los imports de Python son los de requirements.txt (sin matplotlib, que es de .venv-cad)', () => {
    expect(new Set(PIEZAS_PC.map((p) => p.clave)).size).toBe(PIEZAS_PC.length);
    const d = deps({ python: PY.faltan });
    for (const p of PIEZAS_PC) { expect(queDe(p, d).length).toBeGreaterThan(5); expect(p.comando.length).toBeGreaterThan(3); }
    expect(IMPORTS_PYTHON).toEqual(['pptx', 'PIL', 'openpyxl', 'fitz', 'numpy', 'win32com', 'ezdxf', 'docx',
      'cv2', 'segno', 'scipy', 'shapely', 'lib3mf', 'pillow_heif', 'xlrd', 'olefile', 'pytesseract', 'rapidocr_onnxruntime', 'pypdf', 'faster_whisper', 'extract_msg']);
    const req = fs.readFileSync(path.join(process.cwd(), 'requirements.txt'), 'utf8');
    for (const paq of ['python-pptx', 'Pillow', 'openpyxl', 'PyMuPDF', 'pywin32', 'numpy', 'ezdxf', 'python-docx',
      'opencv-python', 'segno', 'scipy', 'shapely', 'lib3mf', 'pillow-heif', 'xlrd', 'olefile', 'pytesseract', 'rapidocr-onnxruntime', 'pypdf', 'faster-whisper', 'extract-msg']) expect(req).toContain(`\n${paq}\n`);
    expect(req).not.toMatch(/^matplotlib$/m);
  });

  it('medirPc en esta PC devuelve funciones y un python que contesta estado y lista de faltantes', () => {
    const d = medirPc({ repo: process.cwd() });
    expect(typeof d.existe).toBe('function');
    const py = d.python();
    expect(['ok', 'faltan', 'sin-python', 'no-medido']).toContain(py.estado);
    expect(Array.isArray(py.faltan)).toBe(true);
    expect(d.existe(process.cwd())).toBe(true);
  });
});
