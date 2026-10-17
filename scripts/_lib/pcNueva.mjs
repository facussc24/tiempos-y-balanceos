/**
 * pcNueva.mjs — que le falta a ESTA PC para correr los scripts de la casa, y el comando que lo arregla. Tanda 1.6 del plan
 * del sistema (16/10/2026): lo que viaja por la nube (memoria, reglas, skills, hooks, repo) llega solo a una PC nueva; lo que
 * NO viaja son PROGRAMAS, y hasta hoy nadie lo decia. Medido en CATA el 15/10 (`casa_cata_estado.md`): sin `node_modules`,
 * Python con cero paquetes, sin `.venv-cad`, sin ffmpeg, sin Ghostscript, sin Bambu Studio, sin los mods; una hoja de
 * proceso, un AMFE, un 3D y un mail por Outlook fallaban en la primera linea.
 *
 * Lo llama `node scripts/_nube.mjs --sincronizar` despues de bajar (un renglon de aviso si falta algo, nada si no).
 * No instala nada: instalar es setup y lleva el si de Fak en el chat (`npm ci` y `pip install -r requirements.txt` los
 * corre la sesion de esa PC desde C:\Dev\BarackMercosul). Logica pura en `faltantes()`; la medicion real en `medirPc()`.
 * Tests: __tests__/scripts/pcNueva.test.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARCA_PC_NUEVA = '[PC NUEVA]';

/**
 * Lo que hace falta importar en Python para los scripts VIVOS del repo (requirements.txt, en el mismo orden; el auditor del
 * 16/10 listo los 13 ultimos con el script que los importa). matplotlib NO esta: vive en .venv-cad (skill cad-design) y la
 * PC principal no lo tiene en su Python base (medido el 16/10/2026; los 21 de esta lista si los tiene).
 */
export const IMPORTS_PYTHON = ['pptx', 'PIL', 'openpyxl', 'fitz', 'numpy', 'win32com', 'ezdxf', 'docx',
  'cv2', 'segno', 'scipy', 'shapely', 'lib3mf', 'pillow_heif', 'xlrd', 'olefile', 'pytesseract', 'rapidocr_onnxruntime', 'pypdf', 'faster_whisper', 'extract_msg', 'xlsxwriter'];
/** El Ghostscript que usa la casa es el de PDFCreator (scripts/_imprimir.py, GS): el de ghostscript.com no sirve para imprimir. */
export const GHOSTSCRIPT_PDFCREATOR = ['PDFCreator', 'Ghostscript', 'Bin', 'gswin32c.exe'];

/**
 * Cada pieza: que es, como se mide (con las dependencias inyectadas) y el comando que la arregla. El comando se escribe
 * como se tipea en la carpeta del repo; lo que es un instalador de un sitio se dice como tal, sin inventar un id.
 */
export const PIEZAS_PC = [
  { clave: 'node_modules', que: 'los paquetes de Node del repo (Supabase, exceljs, playwright)', comando: 'npm ci',
    falta: (d) => !d.existe(path.join(d.repo, 'node_modules', '@supabase', 'supabase-js')) },
  { clave: 'python', que: (d) => `los paquetes de Python de requirements.txt (faltan: ${(d.python().faltan || []).join(', ') || '?'})`, comando: 'pip install -r requirements.txt',
    falta: (d) => d.python().estado === 'faltan' },
  { clave: 'python-programa', que: 'Python 3.12 en el PATH (hace falta para hojas de proceso, PDF, mails y 3D)', comando: 'instalar Python 3.12 desde python.org (marcar «Add to PATH»)',
    falta: (d) => d.python().estado === 'sin-python' },
  { clave: 'venv-cad', que: 'el entorno 3D .venv-cad (build123d, cadquery, trimesh, gmsh)', comando: 'ver el skill cad-design: python -m venv .venv-cad y su pip install',
    falta: (d) => !d.existe(path.join(d.repo, '.venv-cad')) },
  { clave: 'ffmpeg', que: 'ffmpeg/ffprobe (verificar y recortar los videos del telefono)', comando: 'winget install Gyan.FFmpeg',
    falta: (d) => !d.cual('ffmpeg') },
  { clave: 'ghostscript', que: 'el Ghostscript de PDFCreator (imprimir un PDF: scripts/_imprimir.py lo pasa a PCL con el)', comando: 'instalar PDFCreator (trae ese Ghostscript; el de ghostscript.com no le sirve a _imprimir.py)',
    falta: (d) => !d.existe(path.join(d.programas, ...GHOSTSCRIPT_PDFCREATOR)) },
  { clave: 'bambu-studio', que: 'Bambu Studio (laminar para la impresora 3D)', comando: 'instalar Bambu Studio desde bambulab.com',
    falta: (d) => !d.existe(path.join(d.programas, 'Bambu Studio')) },
  { clave: 'mods', que: 'los mods de la casa (tablero, presupuesto de agentes, recordatorio de temas)', comando: 'node scripts/_modsInstalar.mjs --aplicar',
    falta: (d) => !d.existe(path.join(d.home, '.claude', 'mods-casa')) },
];

/**
 * Funcion pura: las piezas que faltan segun las dependencias dadas.
 * @param {{repo: string, home: string, programas: string, existe: (p: string) => boolean, cual: (prog: string) => boolean,
 *   python: () => {estado: 'ok'|'faltan'|'sin-python'|'no-medido', faltan: string[]}}} d
 */
export function faltantes(d) {
  return PIEZAS_PC.filter((p) => { try { return p.falta(d); } catch { return false; } });
}

/** El «que» de una pieza, que puede depender de lo medido (los paquetes de Python que faltan). */
export const queDe = (p, d) => (typeof p.que === 'function' ? p.que(d) : p.que);

/** El renglon para la sincronizacion: '' si no falta nada. */
export function avisoPcNueva(d) {
  const f = faltantes(d);
  if (!f.length) return '';
  const lista = f.map((p) => `${queDe(p, d)} -> ${p.comando}`).join(' · ');
  return `${MARCA_PC_NUEVA} A esta PC (${d.pc || os.hostname()}) le falta${f.length === 1 ? '' : 'n'} ${f.length} cosa${f.length === 1 ? '' : 's'} para correr los scripts de la casa: ${lista}. ` +
    'Se instalan con el si de Fak en el chat, desde la carpeta del repo; lo que viaja por la nube (memoria, reglas, skills, hooks) ya esta.';
}

/** Las dependencias reales de esta PC (lee el disco, pregunta por los programas; no instala nada). */
export function medirPc({ repo, home = os.homedir(), programas = process.env.ProgramFiles || 'C:\\Program Files', pc = process.env.COMPUTERNAME || os.hostname() } = {}) {
  const existe = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
  const cual = (prog) => {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [prog], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    return r.status === 0 && String(r.stdout || '').trim().length > 0;
  };
  let pyCache = null;
  // Un solo arranque de Python: imprime los modulos que no encuentra (find_spec no los importa, asi que no tarda).
  const python = () => {
    if (pyCache) return pyCache;
    const codigo = 'import importlib.util, sys; print(" ".join(m for m in sys.argv[1:] if importlib.util.find_spec(m) is None))';
    const r = spawnSync('python', ['-I', '-c', codigo, ...IMPORTS_PYTHON], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    // Sin Python = no esta el programa (ENOENT, 9009 o el aviso de la Store). Un python que se colgo o fallo al arrancar
    // es «no medido», no «falta Python» (auditor 16/10, H9): ninguna pieza avisa y la proxima pasada vuelve a medir.
    if (r.error) pyCache = { estado: r.error.code === 'ENOENT' ? 'sin-python' : 'no-medido', faltan: [] };
    else if (r.status === 9009 || (r.status !== 0 && /not found|no se reconoce|Microsoft Store/i.test(`${r.stderr}${r.stdout}`))) pyCache = { estado: 'sin-python', faltan: [] };
    else if (r.status !== 0) pyCache = { estado: 'no-medido', faltan: [] };
    else {
      const faltan = String(r.stdout || '').trim().split(/\s+/).filter(Boolean);
      pyCache = { estado: faltan.length ? 'faltan' : 'ok', faltan };
    }
    return pyCache;
  };
  return { repo, home, programas, pc, existe, cual, python };
}
