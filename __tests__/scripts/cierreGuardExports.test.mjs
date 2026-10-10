// cierre-guard · H14 (10/10/2026): el chequeo 4 ("escribiste un entregable y no lo abriste") no veia `exports/`,
// donde viven casi todos los entregables (R4 #1: 112 pptx, xlsx y pdf desde el 01/09).
//
// Lo escrito en exports/ se lee del DISCO (lo escrito despues del mensaje que abrio el turno), no del comando: medido
// sobre 251 transcripts, el archivo casi nunca aparece en el texto del comando que lo genera. Se reclama solo lo que
// el mensaje de cierre NOMBRA y que no tiene una mirada terminada despues de su fecha.
//
// En las dos direcciones. Los casos salen de dos mediciones sobre los transcripts reales del 01 al 10/10:
//   - la mia, antes de escribir la regla: "contacto.png" y "entera.png" calzaban con palabras comunes de 20 cierres;
//   - la del auditor Opus sobre la primera version (informe .sgc-cache/sesion-2026-10-10/auditor_H14.md): 4 errores
//     reales (B1 y B4 cambiaban lo de AFUERA del repo; B2 y B3 frenaban con el archivo ya abierto) y los bordes R1-R9.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  decidir, relevarTranscript, exportsDelTurno, cierreNombra, entregablesSinAbrir, entregablesEnComando, REPO,
} from '../../scripts/_lib/cierreGuard.mjs';

const l = (o) => JSON.stringify(o);
// T0 queda una hora ADELANTE del reloj: `exportsDelTurno` mira tambien la fecha de creacion (una copia nace hoy), y
// un archivo de prueba recien creado no puede caer adentro del turno por haber nacido ahora.
const T0 = Math.ceil(Date.now() / 60_000) * 60_000 + 3_600_000;
const iso = (min) => new Date(T0 + min * 60_000).toISOString();
const user = (texto, min = 0) => l({ type: 'user', timestamp: iso(min), message: { content: texto } });
const enCola = (texto, min) => l({ type: 'attachment', timestamp: iso(min), attachment: { type: 'queued_command', commandMode: 'prompt', prompt: texto } });
const asis = (b, min = 1, id = undefined) => l({ type: 'assistant', timestamp: iso(min), message: { content: [{ type: 'tool_use', id, ...b }] } });
const resultado = (id, min, error = false) => l({ type: 'user', timestamp: iso(min), message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: error, content: 'ok' }] } });
function transcriptDe(lineas) {
  const f = path.join(os.tmpdir(), `cg-h14-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(f, [...lineas].join('\n') + '\n');
  return f;
}
const DESK = 'C:\\Users\\FacundoS-PC\\Desktop\\tarea';

describe('H14 · lo de AFUERA del repo no cambio (auditor B1 y B4)', () => {
  it('B1: una copia de exports/ hacia afuera sigue registrando el destino de afuera como escrito', () => {
    expect(entregablesEnComando(`cp exports/X/a.pdf "${DESK}\\a.pdf"`)).toEqual({ escritos: [`${DESK}\\a.pdf`], mirados: [] });
    expect(entregablesEnComando(`Copy-Item exports/X/a.pdf -Destination "${DESK}\\a.pdf"`).escritos).toEqual([`${DESK}\\a.pdf`]);
  });
  it('B4: un verificador sobre un archivo de exports/ NO da por mirado uno de afuera con el mismo nombre', async () => {
    const f = transcriptDe([
      user('arma la difusion'),
      asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } }, 1),
      asis({ name: 'Bash', input: { command: "python - <<'EOF'\nimport fitz\nd = fitz.open(\"exports/VIEJO/difusion.pdf\")\nEOF" } }, 2),
    ]);
    try { expect((await relevarTranscript(f)).sinMirar.map((e) => e.nombre)).toEqual(['difusion.pdf']); } finally { fs.unlinkSync(f); }
  });
  it('una ruta de exports/ no es un entregable para el mecanismo de afuera', () => {
    expect(entregablesEnComando('python scripts/x.py --out "exports/X/a.xlsx"')).toEqual({ escritos: [], mirados: [] });
  });
});

describe('H14 · cierreNombra: cuando el mensaje de cierre nombra un archivo de exports/', () => {
  const xlsx = { nombre: 'tabla_consumos_h14.xlsx', rel: 'exports/PRUEBA_H14/Tabla_consumos_H14.xlsx' };
  it('ROJO (lo nombra): con extension, sin extension si tiene forma de nombre de archivo, o por su carpeta', () => {
    expect(cierreNombra('Listo, quedó en exports/PRUEBA_H14/Tabla_consumos_H14.xlsx.', xlsx)).toBe(true);
    expect(cierreNombra('Listo: la Tabla_consumos_H14 quedó armada.', xlsx)).toBe(true);
    expect(cierreNombra('Listo, quedó en `exports/PRUEBA_H14/`.', xlsx)).toBe(true);
    expect(cierreNombra('Listo, quedó en exports\\PRUEBA_H14', xlsx)).toBe(true);
    expect(cierreNombra('Todo en exports/PRUEBA_H14, commiteado.', xlsx)).toBe(true);
    expect(cierreNombra('Listo, quedó en C:\\Dev\\BarackMercosul\\exports\\PRUEBA_H14\\.', xlsx)).toBe(true);
  });
  it('VERDE: palabras comunes no son un nombre de archivo (medido 10/10: "contacto.png", "entera.png")', () => {
    expect(cierreNombra('con Luciano Lo Castro como contacto, para reenviárselas a Capuana.', { nombre: 'contacto.png', rel: 'exports/F/_trabajo/critica/contacto.png' })).toBe(false);
    expect(cierreNombra('el diff de la base entera. Commiteado y pusheado.', { nombre: 'entera.png', rel: 'exports/L/_trabajo/auditoria3/entera.png' })).toBe(false);
  });
  it('VERDE: un nombre corto adentro de otro nombre no calza (auditor R5: "22.pdf" en "HO-971-22.pdf", "01.png" en "render-01.png")', () => {
    const p22 = { nombre: '22.pdf', rel: 'exports/I/fuentes/971/22.pdf' };
    expect(cierreNombra('Listo, revisé HO-986 hoja22.pdf.', p22)).toBe(false);
    expect(cierreNombra('Listo, revisé HO-971-22.pdf.', p22)).toBe(false);
    expect(cierreNombra('Listo, el render-01.png quedó bien.', { nombre: '01.png', rel: 'exports/X/_trabajo/01.png' })).toBe(false);
    expect(cierreNombra('Listo, la página 22.pdf quedó bien.', p22)).toBe(true);
  });
  it('VERDE: la carpeta no arrastra imagenes, subcarpetas, otra ruta que empieza igual ni otra carpeta (auditor R5)', () => {
    expect(cierreNombra('Listo, quedó en exports/PRUEBA_H14/.', { nombre: 'render.png', rel: 'exports/PRUEBA_H14/render.png' })).toBe(false);
    expect(cierreNombra('Listo, quedó en exports/PRUEBA_H14/.', { nombre: 'paso.xlsx', rel: 'exports/PRUEBA_H14/_trabajo/paso.xlsx' })).toBe(false);
    expect(cierreNombra('Listo, quedó en exports/PRUEBA_H14/Otro_archivo_01.pdf.', xlsx)).toBe(false);
    expect(cierreNombra('Listo, quedó en exports/PRUEBA_H14_V2/.', xlsx)).toBe(false);
    expect(cierreNombra('Listo, todo en exports/.', { nombre: 'suelto.pdf', rel: 'exports/suelto.pdf' })).toBe(false);
    expect(cierreNombra('Listo, quedó en exports/HO_CORREGIDAS_20261007/APB CEN/.', { nombre: 'apb patagonia ho 971.xlsx', rel: 'exports/HO_CORREGIDAS_20261007/APB/APB PATAGONIA HO 971.xlsx' })).toBe(false);
    expect(cierreNombra('Listo, quedó en docs/exports/PRUEBA_H14/.', xlsx)).toBe(false);
    expect(cierreNombra('Listo, quedó en .claude/worktrees/abc/exports/PRUEBA_H14/.', xlsx)).toBe(false);
  });
  it('un nombre con la tilde descompuesta (NFD) se reconoce igual', () => {
    const a = { nombre: 'revisión_final_01.pdf', rel: 'exports/X/Revisión_final_01.pdf' };
    expect(cierreNombra(`Listo, quedó ${'Revisión_final_01.pdf'.normalize('NFD')}.`, a)).toBe(true);
  });
});

describe('H14 · exportsDelTurno: lo escrito en exports/ despues del mensaje que abrio el turno', () => {
  let repo;
  const poner = (rel, min) => {
    const p = path.join(repo, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x');
    const t = new Date(T0 + min * 60_000);
    fs.utimesSync(p, t, t);
  };
  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-h14-repo-'));
    poner('exports/T/nuevo_01.xlsx', 5);
    poner('exports/T/viejo_01.xlsx', -30);
    poner('exports/T/.build/render.png', 5);
    poner('exports/T/~$nuevo_01.xlsx', 5);
    poner('exports/T/notas.txt', 5);
    poner('docs/afuera_de_exports.pdf', 5);
  });
  afterAll(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('trae solo lo nuevo de exports/, sin .build, sin temporales de Office y sin lo que no es entregable', () => {
    const r = exportsDelTurno({ ultimoMensajeFakTs: iso(0) }, repo);
    expect(r.map((a) => a.rel)).toEqual(['exports/T/nuevo_01.xlsx']);
    expect(r[0].nombre).toBe('nuevo_01.xlsx');
    expect(Math.round(r[0].mtimeMs)).toBe(T0 + 5 * 60_000);
  });
  it('auditor R3: el turno empieza en el mensaje que lo ABRIO (turnoTs), no en uno escrito a mitad del turno', () => {
    expect(exportsDelTurno({ turnoTs: iso(0), ultimoMensajeFakTs: iso(6) }, repo).map((a) => a.rel)).toEqual(['exports/T/nuevo_01.xlsx']);
    expect(exportsDelTurno({ ultimoMensajeFakTs: iso(6) }, repo)).toEqual([]);
  });
  it('auditor R4: una copia que conserva la fecha vieja del origen se ve igual, porque NACIO en el turno', () => {
    // el archivo se crea ahora (una hora antes de T0): con el turno abierto dos horas antes de T0, nacio adentro
    const r = exportsDelTurno({ turnoTs: iso(-120) }, repo).map((a) => a.rel).sort();
    expect(r).toEqual(['exports/T/nuevo_01.xlsx', 'exports/T/viejo_01.xlsx']);
    fs.utimesSync(path.join(repo, 'exports', 'T', 'viejo_01.xlsx'), new Date(T0 - 30 * 86_400_000), new Date(T0 - 30 * 86_400_000));
    expect(exportsDelTurno({ turnoTs: iso(-120) }, repo).map((a) => a.rel).sort()).toEqual(['exports/T/nuevo_01.xlsx', 'exports/T/viejo_01.xlsx']);
  });
  it('auditor R1: el tope no corta antes de llegar al entregable (401 imagenes antes, en orden alfabetico)', () => {
    for (let i = 0; i < 401; i++) poner(`exports/A_FOTOS/f${String(i).padStart(3, '0')}.png`, 5);
    const r = exportsDelTurno({ turnoTs: iso(0) }, repo);
    expect(r.length).toBe(402);
    expect(r.some((a) => a.rel === 'exports/T/nuevo_01.xlsx')).toBe(true);
  });
  it('auditor R9: con el repo colgado de una carpeta `.claude` (un worktree) las subcarpetas se barren igual', () => {
    const wt = path.join(repo, '.claude', 'worktrees', 'w');
    const p = path.join(wt, 'exports', 'T', 'nuevo_02.xlsx');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x');
    fs.utimesSync(p, new Date(T0 + 300_000), new Date(T0 + 300_000));
    expect(exportsDelTurno({ turnoTs: iso(0) }, wt).map((a) => a.rel)).toEqual(['exports/T/nuevo_02.xlsx']);
  });
  it('sin la hora del turno no barre nada; sin carpeta exports/ no rompe', () => {
    expect(exportsDelTurno({}, repo)).toEqual([]);
    expect(exportsDelTurno({ ultimoMensajeFakTs: '' }, repo)).toEqual([]);
    expect(exportsDelTurno({ turnoTs: iso(0) }, path.join(repo, 'no-existe'))).toEqual([]);
  });
});

describe('H14 · el cierre: escrito en exports/ en el turno, nombrado y sin abrir', () => {
  const NOMBRE = 'Tabla_consumos_H14.xlsx';
  const REL = `exports/PRUEBA_H14/${NOMBRE}`;
  const ABS = path.join(REPO, 'exports', 'PRUEBA_H14', NOMBRE);
  const enDisco = (min, rel = REL) => [{ nombre: path.basename(rel).toLowerCase(), rel, mtimeMs: T0 + min * 60_000 }];
  const deps = (deExports) => ({ pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {}, firmaIA: () => [], exportsDelTurno: () => deExports });
  const cierre = (f, msg, deExports, extra = {}) => decidir({ session_id: 's-h14', transcript_path: f, last_assistant_message: msg }, { ...deps(deExports), ...extra });
  const generar = asis({ name: 'Bash', input: { command: 'python scripts/hotmelt/generar.py' } }, 4, 'g1');   // lo escribe por dentro: el comando no nombra el archivo
  const LISTO = `Listo, quedó en ${REL}.`;

  it('ROJO: generado por un programa (el comando no lo nombra), nombrado en el cierre y nunca abierto → bloquea', async () => {
    const f = transcriptDe([user('armame la tabla de consumos'), generar, resultado('g1', 5)]);
    try {
      const d = await cierre(f, LISTO, enDisco(5));
      expect(d.ok).toBe(false);
      expect(d.titulo).toMatch(/de exports\/ .* no lo abriste/);
      expect(d.detalle).toContain(REL);
    } finally { fs.unlinkSync(f); }
  });

  it('ROJO por su motivo: lo mire ANTES de la ultima escritura', async () => {
    const f = transcriptDe([user('armame la tabla'), asis({ name: 'Read', input: { file_path: ABS } }, 3, 'r1'), resultado('r1', 3), generar, resultado('g1', 5)]);
    try { expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(false); } finally { fs.unlinkSync(f); }
  });

  it('ROJO: el cierre nombra solo la carpeta y el documento esta directamente ahi', async () => {
    const f = transcriptDe([user('armame la tabla'), generar]);
    try { expect((await cierre(f, 'Listo, quedó en exports/PRUEBA_H14/.', enDisco(5))).ok).toBe(false); } finally { fs.unlinkSync(f); }
  });

  it('ROJO: un Read que vuelve con ERROR no es una mirada (auditor R7: 25 de 63 Read de PDF fallan en esta PC)', async () => {
    const f = transcriptDe([user('armame la tabla'), generar, asis({ name: 'Read', input: { file_path: ABS } }, 6, 'r1'), resultado('r1', 6, true)]);
    try { expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(false); } finally { fs.unlinkSync(f); }
  });

  it('ROJO: mirar OTRO archivo con la misma raiz (el .csv de entrada) no cuenta (auditor R2)', async () => {
    const f = transcriptDe([user('armame la tabla'), generar, asis({ name: 'Read', input: { file_path: 'C:\\Dev\\BarackMercosul\\tmp\\Tabla_consumos_H14.csv' } }, 6, 'r1'), resultado('r1', 6)]);
    try { expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(false); } finally { fs.unlinkSync(f); }
  });

  it('VERDE: lo abri despues, de las formas en que se abre de verdad (auditor B3: 228 de 339 verificaciones reales no traian la ruta entera)', async () => {
    const miradas = {
      'Read del archivo': asis({ name: 'Read', input: { file_path: ABS } }, 6, 'm'),
      'verificador con la ruta relativa': asis({ name: 'Bash', input: { command: `python scripts/_xlsxAPdf.py "${REL}"` } }, 6, 'm'),
      'cd a la carpeta y nombre pelado': asis({ name: 'Bash', input: { command: `cd /c/Dev/BarackMercosul/exports/PRUEBA_H14 && cmd //c start "" "${NOMBRE}"` } }, 6, 'm'),
      'python -c con comillas adentro de comillas': asis({ name: 'Bash', input: { command: `py -3 -c "import openpyxl; print(openpyxl.load_workbook('${NOMBRE}').sheetnames)"` } }, 6, 'm'),
      'barras dobles': asis({ name: 'PowerShell', input: { command: `Start-Process "exports\\\\PRUEBA_H14\\\\${NOMBRE}"` } }, 6, 'm'),
      'una copia y un verificador en el mismo comando': asis({ name: 'Bash', input: { command: `cp _trabajo/t.xlsx "${NOMBRE}" && python -c "import openpyxl; openpyxl.load_workbook('${NOMBRE}')"` } }, 6, 'm'),
      'la ruta en una variable, con la carpeta a la vista': asis({ name: 'Bash', input: { command: 'f=$(ls exports/PRUEBA_H14/Tabla*.xlsx | head -1); python scripts/_xlsxAPdf.py "$f"' } }, 6, 'm'),
      'el render con el mismo nombre': asis({ name: 'Read', input: { file_path: 'C:\\Users\\x\\AppData\\Local\\Temp\\Tabla_consumos_H14.png' } }, 6, 'm'),
      'una tool MCP que lo abre': asis({ name: 'mcp__office__abrir', input: { path: `C:\\Dev\\BarackMercosul\\exports\\PRUEBA_H14\\${NOMBRE}` } }, 6, 'm'),
    };
    for (const [como, mirada] of Object.entries(miradas)) {
      const f = transcriptDe([user('armame la tabla'), generar, resultado('g1', 5), mirada, resultado('m', 6)]);
      try {
        const rel = await relevarTranscript(f);
        expect(entregablesSinAbrir(LISTO, rel, enDisco(5)), como).toEqual([]);
        expect((await cierre(f, LISTO, enDisco(5))).ok, como).toBe(true);
      } finally { fs.unlinkSync(f); }
    }
  });

  it('VERDE: generar y verificar en el MISMO comando es mirar (auditor B2, caso real f14f5aae 07/10 18:35)', async () => {
    // el comando se lanza a los 4 min, escribe el archivo a los 5 y vuelve a los 6: la mirada vale por la hora del RESULTADO
    const todoJunto = asis({ name: 'Bash', input: { command: `python armar.py && python -c "import openpyxl; openpyxl.load_workbook('exports/PRUEBA_H14/${NOMBRE}')" && cmd //c start "" "${ABS}"` } }, 4, 'j1');
    const f = transcriptDe([user('armame la tabla'), todoJunto, resultado('j1', 6)]);
    const g = transcriptDe([user('armame la tabla'), todoJunto]);     // sin resultado todavia: la hora es la del lanzamiento
    try {
      expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(true);
      expect((await cierre(g, LISTO, enDisco(5))).ok).toBe(false);
    } finally { fs.unlinkSync(f); fs.unlinkSync(g); }
  });

  it('VERDE: lo que abre un subagente (el auditor) cuenta (auditor R8)', async () => {
    const f = transcriptDe([user('armame la tabla'), generar, resultado('g1', 5)]);
    const dirSub = path.join(f.replace(/\.jsonl$/i, ''), 'subagents');
    fs.mkdirSync(dirSub, { recursive: true });
    fs.writeFileSync(path.join(dirSub, 'agent-a1.jsonl'), [asis({ name: 'Read', input: { file_path: ABS } }, 7, 's1'), resultado('s1', 7)].join('\n') + '\n');
    try { expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(true); } finally { fs.unlinkSync(f); fs.rmSync(f.replace(/\.jsonl$/i, ''), { recursive: true, force: true }); }
  });

  it('auditor R3: un mensaje de Fak a mitad del turno no corre el comienzo del turno ni borra las miradas', async () => {
    const f = transcriptDe([user('armame la tabla', 0), generar, resultado('g1', 5), enCola('¿falta mucho?', 6)]);
    try {
      const rel = await relevarTranscript(f);
      expect(rel.turnoTs).toBe(iso(0));
      expect(rel.ultimoMensajeFakTs).toBe(iso(6));
      expect((await cierre(f, LISTO, enDisco(5))).ok).toBe(false);
    } finally { fs.unlinkSync(f); }
  });

  it('VERDE: un intermedio que el cierre no nombra no frena (ni una imagen ni lo de una subcarpeta de la carpeta nombrada)', async () => {
    const f = transcriptDe([user('armame la tabla'), generar, resultado('g1', 5), asis({ name: 'Read', input: { file_path: ABS } }, 6, 'r1'), resultado('r1', 6)]);
    const disco = [...enDisco(5), ...enDisco(5, 'exports/PRUEBA_H14/_trabajo/paso1_crudo.csv'), ...enDisco(5, 'exports/PRUEBA_H14/render_previo.png'), ...enDisco(5, 'exports/OTRA_TAREA/de_otra_sesion.pdf')];
    try { expect((await cierre(f, LISTO, disco)).ok).toBe(true); } finally { fs.unlinkSync(f); }
  });

  it('VERDE: sin declarar cierre no reclama', async () => {
    const f = transcriptDe([user('armame la tabla'), generar]);
    try { expect((await cierre(f, `La ${NOMBRE} va por la mitad; me falta tu dato de la hoja 2.`, enDisco(5))).ok).toBe(true); } finally { fs.unlinkSync(f); }
  });

  it('VERDE: ya reclamado (archivo@fecha) no se repite; si se vuelve a escribir, si', async () => {
    const f = transcriptDe([user('armame la tabla'), generar]);
    const reclamos = [];
    const memoria = { yaReclamado: (sid, k) => reclamos.includes(k), reclamar: (sid, k) => reclamos.push(k) };
    try {
      expect((await cierre(f, LISTO, enDisco(5), memoria)).ok).toBe(false);
      expect(reclamos).toEqual([`${NOMBRE.toLowerCase()}@${T0 + 5 * 60_000}`]);
      expect((await cierre(f, LISTO, enDisco(5), memoria)).ok).toBe(true);
      expect((await cierre(f, LISTO, enDisco(9), memoria)).ok).toBe(false);
    } finally { fs.unlinkSync(f); }
  });

  it('lo de AFUERA del repo sigue frenando aunque el cierre no lo nombre, y el titulo lo dice', async () => {
    const f = transcriptDe([user('arma la difusion'), asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } })]);
    try {
      const d = await cierre(f, `Listo, todo en ${DESK}.`, []);
      expect(d.ok).toBe(false);
      expect(d.titulo).toMatch(/afuera del repo y no lo abriste/);
    } finally { fs.unlinkSync(f); }
  });

  it('el relevador real no barre el disco cuando el transcript no trae hora (los tests viejos del chequeo 4 no cambian)', async () => {
    const f = transcriptDe([l({ type: 'user', message: { content: 'armame la tabla' } })]);
    try { expect(exportsDelTurno(await relevarTranscript(f))).toEqual([]); } finally { fs.unlinkSync(f); }
  });
});
