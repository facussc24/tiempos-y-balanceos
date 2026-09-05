/**
 * Tests de scripts/_lib/guardianes.mjs — los 13 guardianes PreToolUse portados de bash a node
 * (Ola 2, 05/09/2026) + el nuevo script-inline-guard.
 *
 * Cada guardian se prueba EN LAS DOS DIRECCIONES (rojo: bloquea lo que tiene que bloquear;
 * verde: deja pasar el trabajo de todos los dias), con los casos de sus tests bash originales
 * mas los que motivaron la Ola 2:
 *   - los recordatorios 1x/h salen como additionalContext con exit 0, no como bloqueo;
 *   - un bloqueo en la misma llamada NO consume el cooldown del recordatorio;
 *   - el consumos-guard ya no dispara con la palabra suelta "consumo" (poblacion real);
 *   - borrado-masivo V4 no se dispara con un COMENTARIO que nombra fs.rename/mv;
 *   - causas-ajenas ve las memorias escritas con ruta Windows (antes no);
 *   - arb-cerrar: la exencion de lectores se ancla al comando entero (bypass por 2da linea);
 *   - JSON roto: los guardianes caen a su red y ademas rescatan el comando a mano.
 *
 * Los payloads van con JSON.stringify: a mano en una string de shell los backslashes de
 * Windows se colapsan y el guardian cae en su rama de fallback (verde por el motivo equivocado).
 * Este archivo cita los patrones peligrosos como DATO; los guardianes lo eximen por `.test.`.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// El bloque "por bash" levanta _dispatcher.sh + node varias veces por caso: solo tarda
// decimas, con la suite entera en paralelo en Windows paso los 15 s (05/09/2026). 60 s aca.
vi.setConfig({ testTimeout: 60_000 });
import {
  parsear, matriz, correr, resolver, evaluar, GUARDIANES, TODOS, NOMBRES,
  medirInline, sinCuerposHeredoc, frasesCausalesSinFuente, ultimaRuta, INLINE_MAX, comandoTocaSecreto,
} from '../../scripts/_lib/guardianes.mjs';

const RAIZ = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'guardianes-'));
const HOME = path.join(TMP, 'home');
const ESC_FLAGS = path.join(TMP, 'esc');
fs.mkdirSync(path.join(HOME, '.claude'), { recursive: true });
fs.mkdirSync(ESC_FLAGS, { recursive: true });
const ENV = { ...process.env, TMPDIR: TMP, HOME, ESCRITORIO_GUARD_FLAGDIR: ESC_FLAGS };
const AHORA = 1_800_000_000;
afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temp */ } });

const FLAGS = () => [...fs.readdirSync(TMP).filter((f) => f.endsWith('.flag')).map((f) => path.join(TMP, f)),
  ...fs.readdirSync(path.join(HOME, '.claude')).filter((f) => f.endsWith('.flag')).map((f) => path.join(HOME, '.claude', f)),
  ...fs.readdirSync(ESC_FLAGS).map((f) => path.join(ESC_FLAGS, f))];
const limpiarFlags = () => { for (const f of FLAGS()) fs.rmSync(f, { force: true }); };

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const ps = (command) => ({ tool_name: 'PowerShell', tool_input: { command } });
const escribir = (file_path, content = 'x') => ({ tool_name: 'Write', tool_input: { file_path, content } });
const editar = (file_path, new_string = 'x') => ({ tool_name: 'Edit', tool_input: { file_path, old_string: 'a', new_string } });

/** Evalua en proceso, con flags aislados. Devuelve { exit, err, ctx, res, contexto }. */
function ev(payload, { ahora = AHORA, nombres, env = ENV } = {}) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const { ctx, res, salida } = evaluar(raw, { env, ahora, nombres });
  return { exit: salida.exit, err: salida.stderr, out: salida.stdout, contexto: salida.contexto, ctx, res };
}
/** Recordatorio de una llamada, con los flags limpios antes (si no, la 2da llamada cae en el cooldown). */
const rec = (payload, opts) => { limpiarFlags(); return ev(payload, opts).contexto; };
const ESC = 'C:\\Users\\facun\\OneDrive\\Escritorio';
const BIB = 'C:\\Users\\facun\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - INGENIERIA BARACK (NUNCA BORRAR)';
const ARCH = `${BIB}\\1- GENERAL\\TAREAS CERRADAS`;

beforeEach(limpiarFlags);

// ───────────────────────────────────────────────────────────── matriz y parseo
describe('matriz por herramienta (replica los matchers historicos de settings.json)', () => {
  it('Bash: los de shell + los cuatro; sin file-guard ni causas', () => {
    const m = matriz('Bash');
    expect(m).toEqual(expect.arrayContaining(['supabase-guard', 'validator-check', 'renumber-guard', 'push-guard', 'arb-cerrar-guard', 'script-inline-guard', 'escritorio-guard', 'mail-guard', 'borrado-masivo-guard']));
    expect(m).not.toContain('file-guard');
    expect(m).not.toContain('causas-ajenas-guard');
  });
  it('Write: file-guard + causas + los cuatro; sin arb ni push', () => {
    const m = matriz('Write');
    expect(m).toEqual(expect.arrayContaining(['file-guard', 'causas-ajenas-guard', 'cad-guard', 'escritorio-guard']));
    expect(m).not.toContain('arb-cerrar-guard');
    expect(m).not.toContain('push-guard');
  });
  it('Read: ninguno · tool ilegible: TODOS (fallar hacia el lado seguro es correr de mas)', () => {
    expect(matriz('Read')).toEqual([]);
    expect(matriz('')).toEqual(TODOS);
    expect([...TODOS].sort()).toEqual([...NOMBRES].sort());
  });
});

describe('parseo', () => {
  it('JSON valido: campos crudos y limpios', () => {
    const c = parsear(JSON.stringify(bash('ls\n-la')));
    expect(c.ok).toBe(true);
    expect(c.cmd).toBe('ls\n-la');
    expect(c.cmd6).toBe('ls -la');
    expect(c.parsed3).toBe('Bash\x1fls -la\x1f');
  });
  it('JSON roto: ok=false, campos vacios de verdad, y el comando rescatado a mano (con escapes)', () => {
    const c = parsear('{"tool_name":"Bash","tool_input":{"command":"rm -rf \\"C:\\\\x\\" /c/Users/a/Escritorio/t"');
    expect(c.ok).toBe(false);
    expect(c.cmd).toBe('');
    expect(c.parsed4).toBe('');
    expect(c.rescate.tool).toBe('Bash');
    expect(c.rescate.cmd).toBe('rm -rf "C:\\x" /c/Users/a/Escritorio/t');
  });
});

// ───────────────────────────────────────────────────────────── motor: recordatorios y bloqueos
describe('motor — recordatorios como additionalContext, cooldown y bloqueos', () => {
  it('un recordatorio sale con exit 0 y JSON hookSpecificOutput en stdout, y consume el cooldown', () => {
    const r = ev(bash(`ls "${ESC}"`));
    expect(r.exit).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(j.hookSpecificOutput.additionalContext).toMatch(/CERRADA = la ultima accion/);
    expect(fs.existsSync(path.join(ESC_FLAGS, 'escritorio-guard.flag'))).toBe(true);
    const r2 = ev(bash(`ls "${ESC}"`), { ahora: AHORA + 100 });
    expect(r2.exit).toBe(0);
    expect(r2.out).toBe('');
    const r3 = ev(bash(`ls "${ESC}"`), { ahora: AHORA + 3601 });
    expect(r3.out).toMatch(/ESCRITORIO-GUARD/);
  });
  it('si en la misma llamada hay un bloqueo, el recordatorio no sale y NO consume su hora', () => {
    const r = ev(bash(`taskkill /IM produc.exe /F && ls "${ESC}"`));
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/ARB-CERRAR-GUARD/);
    expect(r.out).toBe('');
    expect(fs.existsSync(path.join(ESC_FLAGS, 'escritorio-guard.flag'))).toBe(false);
    // el reintento sin el kill recibe el recordatorio
    expect(ev(bash(`ls "${ESC}"`)).out).toMatch(/ESCRITORIO-GUARD/);
  });
  it('dos guardianes bloqueando: los dos mensajes, en orden, exit 2', () => {
    const r = ev(bash(`taskkill /IM produc.exe /F; rm -rf "${ESC}\\x"`));
    expect(r.exit).toBe(2);
    expect(r.err.indexOf('ARB-CERRAR-GUARD')).toBeGreaterThan(-1);
    expect(r.err.indexOf('ESCRITORIO-GUARD')).toBeGreaterThan(r.err.indexOf('ARB-CERRAR-GUARD'));
  });
  it('dos recordatorios distintos en una llamada salen juntos en un solo additionalContext', () => {
    const r = ev(bash(`python cad.py --step "${ESC}/pieza.step"`));
    expect(r.exit).toBe(0);
    expect(r.contexto).toMatch(/CAD-GUARD/);
    expect(r.contexto).toMatch(/ESCRITORIO-GUARD/);
  });
  it('un guardian que revienta BLOQUEA con el error (no aprueba en silencio)', () => {
    GUARDIANES['_revienta'] = () => { throw new Error('boom'); };
    try {
      const res = correr(['_revienta'], parsear(JSON.stringify(bash('ls'))), { ahora: AHORA, env: ENV });
      expect(res.bloqueos).toHaveLength(1);
      expect(res.bloqueos[0].texto).toMatch(/boom/);
      expect(resolver(res, { ahora: AHORA }).exit).toBe(2);
    } finally { delete GUARDIANES['_revienta']; }
  });
  it('un comando inocente: exit 0, sin stdout ni stderr', () => {
    const r = ev(bash('npm run build && git status'));
    expect(r).toMatchObject({ exit: 0, out: '', err: '' });
  });
});

// ───────────────────────────────────────────────────────────── escritorio-guard
describe('escritorio-guard (bloqueos duros)', () => {
  it('bloquea rm / Remove-Item / rmtree en el Escritorio y en la biblioteca NUNCA BORRAR', () => {
    expect(ev(bash(`rm -rf "${ESC}\\Insert"`)).err).toMatch(/NADA SE BORRA NUNCA/);
    expect(ev(bash(`Remove-Item -Recurse "${ESC}\\_TERMINADAS 2026\\x"`)).exit).toBe(2);
    expect(ev(bash(`python -c "import shutil; shutil.rmtree(r'${ESC}\\x')"`)).exit).toBe(2);
    expect(ev(bash(`rm -rf "${BIB}\\1- GENERAL\\FICHAS DE EMBALAJE\\x.xlsx"`)).exit).toBe(2);
    expect(ev(bash(`del "${ARCH}\\2026\\x"`)).exit).toBe(2);
    expect(ev(bash(`rd /s /q "${ARCH}\\2026"`)).exit).toBe(2);
    // HUECO TAPADO 05/09 (auditor de la Ola 2): `ri` es el alias PowerShell de Remove-Item.
    expect(ev(ps(`ri -Recurse -Force "${ESC}\\Insert"`)).exit).toBe(2);
    expect(ev(ps(`ri "${ESC}\\Insert\\nota.txt"`)).exit).toBe(2);
  });
  it('"del Escritorio" en prosa no es un borrado (del = preposicion)', () => {
    expect(ev(bash('git commit -m "docs: la sintesis va antes de tocar cosas del Escritorio (OneDrive, Y:)"')).exit).toBe(0);
    expect(ev(bash(`git commit -m "feat: el rastro va a 1- GENERAL\\TAREAS CERRADAS; antes salia del Escritorio"`)).exit).toBe(0);
  });
  it('bloquea mover a mano hacia/desde el archivo; permite el script y mover DENTRO del Escritorio', () => {
    expect(ev(bash(`mv "${ESC}\\X" "${ARCH}\\2026\\"`)).err).toMatch(/Mover y registrar son UNA operacion/);
    expect(ev(bash(`Move-Item "${ARCH}\\2026\\X" "${ESC}"`)).exit).toBe(2);
    expect(ev(bash('node scripts/_escritorio.mjs --archivar "X" --cerrada 2026-07-31 --que "a" --donde "b"')).exit).toBe(0);
    expect(ev(bash(`mv "${ESC}\\a.txt" "${ESC}\\Insert\\a.txt"`)).exit).toBe(0);
  });
  it('bloquea el listado a mano, el LEEME suelto y GENERAR el entregable en el Escritorio', () => {
    expect(ev(escribir(`${ARCH}\\2026\\LISTADO DE TAREAS CERRADAS 2026.xlsx`)).err).toMatch(/no se toca a mano/);
    expect(ev(escribir(`${ESC}\\Insert\\LEEME - por que esta aca.txt`)).err).toMatch(/archivo auxiliar suelto/);
    expect(ev(escribir(`${ESC}\\Insert\\README.md`)).exit).toBe(2);
    expect(ev(escribir(`${ESC}\\Insert\\Consumos SMRC.xlsx`)).err).toMatch(/GENERANDO un entregable adentro del Escritorio/);
    expect(ev(bash(`python scripts/_pdfBomArb.py --out "${ESC}/tarea/difusion.pdf"`)).err).toMatch(/GENERANDO un entregable/);
    expect(ev(escribir(`${BIB}\\2. CONSUMO DE MATERIAL BOM\\Consumos SMRC.xlsx`)).exit).toBe(0);
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\README.md')).exit).toBe(0);
    // lo que Fak va a USAR YA va suelto en el Escritorio (10/08/2026): dxf/plt/stl no se cortan
    expect(ev(escribir(`${ESC}\\patron.dxf`)).exit).toBe(0);
  });
  it('JSON roto con un rm en el Escritorio: bloquea POR EL BORRADO, no por el recordatorio', () => {
    const roto = '{"tool_name":"Bash","tool_input":{"command":"rm -rf /c/Users/FacundoS-PC/OneDrive/Escritorio/tarea"';
    const r = ev(roto, { ahora: AHORA });
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/NADA SE BORRA NUNCA/);
  });
});

// ───────────────────────────────────────────────────────────── cad / patrones / HO
describe('cad-guard y patrones-guard (recordatorios por tool_name)', () => {
  it('cad: python sobre un .step recuerda; un ls que menciona .step no; Write de .py con build123d si', () => {
    expect(rec(bash('python medir.py pieza.step'))).toMatch(/CAD-GUARD/);
    expect(rec(bash('ls -la posicionador.step'))).toBe('');
    expect(rec(escribir('C:\\Dev\\_x\\build.py', 'from build123d import *\nBox(1,1,1)'))).toMatch(/GATE PRE-MODELADO/);
    expect(rec(escribir('C:\\Dev\\_x\\notas.py', 'print(1)'))).toBe('');
  });
  it('cad: con JSON roto cae a la red (grep del crudo) y recuerda con exit 0', () => {
    const r = ev('{"tool_name":"Bash","tool_input":{"command":"python m.py --usa-gmsh"');
    expect(r.exit).toBe(0);
    expect(r.contexto).toMatch(/CAD-GUARD/);
  });
  it('patrones: python + .dxf recuerda; Write de .plt recuerda; cat de un .dxf no', () => {
    expect(rec(bash('python mover.py patron.dxf'))).toMatch(/PATRONES-GUARD/);
    expect(rec(escribir('C:\\x\\patron.plt', 'IN;'))).toMatch(/GATE 1 — APLOMO/);
    expect(rec(bash('cat patron.dxf | head'))).toBe('');
  });
  it('patrones: el flag vive en ~/.claude, no en TMPDIR', () => {
    ev(bash('python mover.py patron.dxf'));
    expect(fs.existsSync(path.join(HOME, '.claude', 'patrones-guard.flag'))).toBe(true);
  });
});

describe('ho-numeracion-guard', () => {
  it('recuerda con HO-986, "hoja de proceso" y el formulario I-IN-002.4; calla con el resto', () => {
    expect(rec(bash('ls "Y:/x/HOJAS DE OPERACIONES/HO-986"'))).toMatch(/HO-GUARD/);
    expect(rec(escribir('C:\\x\\I-IN-002.4-R01 APB.xlsx'))).toMatch(/LA NUMERACION LA MANDA EL FLUJOGRAMA/);
    expect(rec(bash('git log --oneline | head'))).toBe('');
  });
});

// ───────────────────────────────────────────────────────────── consumos: lista canonica
describe('consumos-entregable-guard — lista canonica, probada contra los disparos reales 15/08-04/09', () => {
  const recuerda = (p) => /CONSUMOS-GUARD/.test(rec(p));
  it('SI recuerda: trabajo real de consumos / BOM / arb / entregable ejecutable', () => {
    expect(recuerda(bash('ls -la "Y:/Ingenieria/14. Estructura producto (I-IN-002II)/2. CONSUMO DE MATERIAL BOM/BOMS/SMRC/P21/"'))).toBe(true);
    expect(recuerda(bash('cd /c/tmp && grep -niE "79976|79978|FSC" INSUMOS.TXT | iconv -f latin1 -t utf8'))).toBe(true);
    expect(recuerda(bash('python scripts/_arbSustituir.py --tabla x.csv --apply'))).toBe(true);
    expect(recuerda(bash('node scripts/_validarConsumos.mjs "tabla P703.xlsx"'))).toBe(true);
    expect(recuerda(bash('find "/y/Ingenieria/.../VW427-1LA_K-PATAGONIA" -maxdepth 3 -type d -iname "*tizada*"'))).toBe(true);
    // El entregable se escribe en su carpeta por tipo (en el Escritorio lo BLOQUEA escritorio-guard,
    // y con un bloqueo en la llamada los recordatorios no salen: eso lo cubre el describe del motor).
    expect(recuerda(escribir('Y:\\Ingenieria\\14. Estructura producto\\2. CONSUMO DE MATERIAL BOM\\carga arb P703.xlsx'))).toBe(true);
    expect(recuerda(bash('head -60 "Aplix arb - pendientes P280828 y doble consumo por pieza.txt"'))).toBe(true);
  });
  it('NO recuerda: escribir SOBRE consumos (memorias, LECCIONES, reglas, hooks) ni la palabra suelta', () => {
    expect(recuerda(editar('C:\\Users\\FacundoS-PC\\.claude\\projects\\C--Dev-BarackMercosul\\memory\\reference_aplix_consumo_dos_unidades.md'))).toBe(false);
    expect(recuerda(bash('cat -n .claude/hooks/consumos-entregable-guard.sh'))).toBe(false);
    expect(recuerda(bash("python - <<'PYEOF'\np='docs/LECCIONES_APRENDIDAS.md'\nanchor='\\n## Consumos de material\\n'\nPYEOF"))).toBe(false);
    expect(recuerda(bash('git commit -m "docs(lecciones): un consumo que no cuadra se normaliza a la unidad que gobierna"'))).toBe(false);
    expect(recuerda(bash('grep -nE "RELACIONES|ARTICULO|INSUMOS" scripts/_arbVer.py | head -15'))).toBe(false);
    expect(recuerda(bash('for f in feedback_formato_carga_arb feedback_destino_material; do cat "$M/$f.md"; done'))).toBe(false);
  });
  it('la lista vive en consumosCanon.data.json, no en el codigo', () => {
    const canon = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/_lib/consumosCanon.data.json'), 'utf8'));
    expect(Array.isArray(canon.guard_disparadores)).toBe(true);
    expect(canon.guard_disparadores.length).toBeGreaterThanOrEqual(4);
    for (const d of canon.guard_disparadores) expect(() => new RegExp(d.regex, 'i')).not.toThrow();
    expect(typeof canon.guard_excluir_rutas).toBe('string');
    expect(typeof canon.guard_entregable_regex).toBe('string');
  });
});

// ───────────────────────────────────────────────────────────── mail-guard
describe('mail-guard (casos de mail-guard.test.sh)', () => {
  const INCIDENTE = bash('python - <<PY\nimport win32com.client as win32\nol=win32.Dispatch("Outlook.Application"); ns=ol.GetNamespace("MAPI")\nit=ns.GetDefaultFolder(16).Items.Item(1)\nit.Send()\nPY');
  it('bloquea el .Send() suelto del 14/08, SendAndReceive, y el .Send() metido por Write/Edit', () => {
    expect(ev(INCIDENTE).err).toMatch(/MAIL-GUARD — BLOQUEO/);
    expect(ev(bash('python -c "import win32com.client as w; w.Dispatch(\\"Outlook.Application\\").GetNamespace(\\"MAPI\\").SendAndReceive(False)"')).exit).toBe(2);
    expect(ev(escribir('x.py', 'import win32com.client\nol=win32com.client.Dispatch("Outlook.Application")\nm=ol.CreateItem(0)\nm.Send()')).exit).toBe(2);
    expect(ev(editar('x.py', 'ol=Dispatch("Outlook.Application")\nmsg=ol.CreateItem(0)\nmsg.Send()')).exit).toBe(2);
  });
  it('deja pasar la via autorizada, Display, ReplyAll sin enviar, leer mails y un Send que no es Outlook', () => {
    expect(ev(bash('python scripts/_mailEnviar.py --buscar "APB TRA CEN" --enviar')).exit).toBe(0);
    expect(ev(bash('python -c "import win32com.client as w; w.Dispatch(\\"Outlook.Application\\").CreateItem(0).Display()"')).exit).toBe(0);
    expect(ev(bash('python scripts/_mails.py --buscar Nieve')).exit).toBe(0);
    expect(ev(bash('node -e "socket.Send()"')).exit).toBe(0);
    expect(ev(bash('python -c "import win32com.client as w; w.Dispatch(\\"Outlook.Application\\").GetNamespace(\\"MAPI\\").GetDefaultFolder(6).Items.Item(1).ReplyAll().Display()"')).exit).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────── arb-cerrar-guard
describe('arb-cerrar-guard (casos de arb-cerrar-guard.test.sh + el bypass por segunda linea)', () => {
  const INCIDENTE = bash('python - <<PY\nimport ctypes\nu=ctypes.windll.user32\nif cls(h) in ("ProdWindow","TabCtrl"): found.append(h)\nfor h in found: u.PostMessageW(h,0x0010,0,0)\nPY');
  it('bloquea matar el proceso: taskkill, Stop-Process, .Kill(), .CloseMainWindow(), os.kill, wmic, shutdown', () => {
    expect(ev(bash('taskkill /IM produc.exe /F')).err).toMatch(/matar el proceso del arb/);
    expect(ev(ps('Get-Process produc | Stop-Process -Force')).exit).toBe(2);
    expect(ev(ps('(Get-Process -Name produc).Kill()')).exit).toBe(2);
    expect(ev(ps('(Get-Process -Name produc).CloseMainWindow()')).exit).toBe(2);
    expect(ev(bash('python -c "import os,signal; os.kill(pid_produc, signal.SIGTERM)"')).exit).toBe(2);
    expect(ev(bash('wmic process where name=PRODUC.EXE delete')).exit).toBe(2);
    expect(ev(bash('shutdown /l /f')).exit).toBe(2);
  });
  it('bloquea cerrar la ventana principal: WM_CLOSE a ProdWindow (incidente), 0x10, pywinauto, Alt+F4', () => {
    expect(ev(INCIDENTE).err).toMatch(/clase ProdWindow/);
    expect(ev(bash('python -c "h=ventana(_Produccion_); u.SendMessageW(h,0x0010,0,0)"')).err).toMatch(/titulo Produccion/);
    expect(ev(bash('python -c "u.PostMessageW(h_ProdWindow,0x10,0,0)"')).exit).toBe(2);
    expect(ev(bash('python -c "from pywinauto import Application; Application().connect(title=_Produccion_).window().close()"')).exit).toBe(2);
    expect(ev(ps('$w = New-Object -ComObject WScript.Shell; $w.AppActivate(_Produccion_); $w.SendKeys(_%{F4}_)')).exit).toBe(2);
  });
  it('deja pasar el metodo documentado y el trabajo diario', () => {
    expect(ev(bash('python -c "if _Maestro de Insumos_ in txt(h): u.PostMessageW(h,0x0010,0,0)"')).exit).toBe(0);
    expect(ev(bash('python scripts/_arbVer.py reset')).exit).toBe(0);
    expect(ev(ps('Get-Process produc | Select-Object Id,MainWindowTitle')).exit).toBe(0);
    expect(ev(bash('python scripts/_arbSustituir.py --tabla x.csv --apply')).exit).toBe(0);
    expect(ev(bash('taskkill /IM node.exe /F')).exit).toBe(0);
  });
  it('no estorba al que audita o documenta el guardian, pero un lector encadenado a un shell no se exime', () => {
    expect(ev(bash('grep -nE "WM_CLOSE|0x0010|DestroyWindow|EndTask|ProdWindow|taskkill" .claude/skills/arb-operar/SKILL.md')).exit).toBe(0);
    expect(ev(bash('git show 222674cf -- .claude/hooks/arb-cerrar-guard.sh')).exit).toBe(0);
    expect(ev(bash('cat <<EOF | bash\ntaskkill /IM produc.exe /F\nEOF')).exit).toBe(2);
    expect(ev(bash('git commit -F - <<EOF\nfix: tapar bypasses\n\nTapados: .Kill() y taskkill sobre produc.exe y wmic delete.\nEOF')).exit).toBe(0);
    expect(ev(bash('cat > notas.txt <<EOF\nprobar taskkill /IM produc.exe /F\nEOF')).exit).toBe(0);
    expect(ev(bash('taskkill /IM produc.exe /F && git commit -F - <<EOF\nnota\nEOF')).exit).toBe(2);
  });
  it('BYPASS TAPADO 05/09: una segunda linea que empieza con grep ya no exime al kill de la primera', () => {
    expect(ev(bash('taskkill /IM produc.exe /F\ngrep x y')).exit).toBe(2);
  });
  it('el escape de Fak vale UNA vez y se consume', () => {
    const ok = path.join(HOME, '.claude', '.arb-cerrar-ok');
    fs.writeFileSync(ok, '');
    const r = ev(INCIDENTE);
    expect(r.exit).toBe(0);
    expect(r.err).toMatch(/consumido/);
    expect(fs.existsSync(ok)).toBe(false);
    expect(ev(INCIDENTE).exit).toBe(2);
  });
  it('sinCuerposHeredoc deja las lineas de comando y saca el contenido', () => {
    expect(sinCuerposHeredoc('git commit -F - <<EOF\ntaskkill produc\nEOF\necho fin')).toBe('git commit -F - <<EOF\necho fin');
  });
});

// ───────────────────────────────────────────────────────────── borrado-masivo-guard
describe('borrado-masivo-guard (V1-V4, exclusiones y el falso positivo de los comentarios)', () => {
  const LOTE = 'Get-ChildItem -Path $R -Recurse | ForEach-Object {\n  Copy-Item -LiteralPath $_.FullName -Destination $D\n  Remove-Item -LiteralPath $_.FullName\n}';
  it('V1: -Recurse + -Include sin \\* bloquea; con -Filter o con \\* pasa', () => {
    expect(ev(bash("powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -File -Include *.step,*.dxf\"")).err).toMatch(/V1/);
    expect(ev(bash("powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -Filter *.step\"")).exit).toBe(0);
    expect(ev(bash("powershell -Command \"Get-ChildItem -Path 'C:\\x\\*' -Recurse -Include *.step\"")).exit).toBe(0);
  });
  it('V2: .ps1 con acentos bloquea; ASCII pasa; acentos fuera de un .ps1 no importan', () => {
    expect(ev(escribir('C:\\tmp\\mover.ps1', "$BIB = 'C:\\Users\\x\\Ingeniería y Proyecto - General'\nGet-Item $BIB\n")).err).toMatch(/V2/);
    expect(ev(escribir('C:\\tmp\\ok.ps1', '$p = $args[0]\nGet-Item -LiteralPath $p\n')).exit).toBe(0);
    expect(ev(escribir('C:\\tmp\\notas.md', 'Ingeniería y Proyecto')).exit).toBe(0);
  });
  it('V3: borrado permanente bloquea; Papelera, git rm y temporales pasan', () => {
    expect(ev(bash("powershell -Command \"Remove-Item -LiteralPath 'C:\\x' -Force\"")).err).toMatch(/V3/);
    expect(ev(bash('rm -rf /c/Dev/BarackMercosul/modules/x')).exit).toBe(2);
    expect(ev(bash('python -c "import shutil; shutil.rmtree(d)"')).exit).toBe(2);
    expect(ev(bash("powershell -Command \"[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')\"")).exit).toBe(0);
    expect(ev(bash('git rm -rf modules/oldFeature/')).exit).toBe(0);
    expect(ev(bash('rm -rf /c/Users/x/AppData/Local/Temp/claude/scratchpad/w')).exit).toBe(0);
    expect(ev(bash('rm -rf node_modules && npm ci')).exit).toBe(0);
  });
  it('V4: recorrer + borrar sin dry-run bloquea (ps1 y python); con dry-run / -WhatIf pasa', () => {
    expect(ev(escribir('C:\\tmp\\rescatar.ps1', LOTE)).err).toMatch(/V4/);
    expect(ev(escribir('C:\\tmp\\rescatar.ps1', `param([switch]$DryRun)\n${LOTE}`)).exit).toBe(0);
    expect(ev(escribir('C:\\tmp\\rescatar.ps1', LOTE.replace('Remove-Item -LiteralPath $_.FullName', 'Remove-Item -LiteralPath $_.FullName -WhatIf'))).exit).toBe(0);
    expect(ev(escribir('C:\\tmp\\mover.py', 'import os, shutil\nfor f in os.listdir(origen):\n    shutil.move(os.path.join(origen, f), destino)')).err).toMatch(/V4/);
    expect(ev(escribir('C:\\tmp\\mover.py', 'import os, shutil\nDRY_RUN = True\nfor f in os.listdir(origen):\n    shutil.move(os.path.join(origen, f), destino)')).exit).toBe(0);
    expect(ev(escribir('C:\\tmp\\uno.sh', 'mv "$1" "$2"\n')).exit).toBe(0);
  });
  it('FALSO POSITIVO TAPADO 05/09: un comentario que nombra fs.rename/mv junto a un for NO es V4', () => {
    expect(ev(escribir('C:\\Dev\\x\\lector.mjs', '// Sin literales fs.rename ni mv: este script solo LEE.\nfor (const f of fs.readdirSync(d)) console.log(f);')).exit).toBe(0);
    expect(ev(escribir('C:\\Dev\\x\\lector.py', '# no hace rm ni mv, recorre\nfor f in os.listdir(d):\n    print(f)')).exit).toBe(0);
    // pero el mismo codigo FUERA del comentario sigue bloqueando
    expect(ev(escribir('C:\\Dev\\x\\borra.mjs', 'for (const f of fs.readdirSync(d)) fs.rmSync(f);')).err).toMatch(/V4/);
  });
  it('excepcion de tests, guardianes y este modulo; un .ps1 real con el mismo texto si bloquea', () => {
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\__tests__\\scripts\\x.test.mjs', 'Remove-Item -Force ; shutil.rmtree(d)')).exit).toBe(0);
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\.claude\\hooks\\borrado-masivo-guard.sh', 'echo "Remove-Item -Force"')).exit).toBe(0);
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\scripts\\_lib\\guardianes.mjs', 'const X = /shutil\\.rmtree|Remove-Item -Force/; for (const a of b) {}')).exit).toBe(0);
    expect(ev(escribir('C:\\tmp\\real.ps1', 'Remove-Item -Force $p')).exit).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────── causas-ajenas-guard
describe('causas-ajenas-guard (casos de su .test.sh + ruta Windows)', () => {
  const mem = (content, file = '/x/memory/reference_algo.md') => escribir(file, content);
  it('bloquea las 4 frases reales que hubo que purgar', () => {
    expect(ev(mem('El 15 g sale de leer el numero del codigo AD-ADFA15.')).err).toMatch(/CAUSAS-AJENAS-GUARD/);
    expect(ev(mem('La BOM dice 18KG: confundieron los litros con los kilos.')).exit).toBe(2);
    expect(ev(mem('El arb tiene 15,00 donde el resto tiene 0,015: se comio la coma.', '/x/docs/LECCIONES_APRENDIDAS.md')).exit).toBe(2);
    expect(ev(mem('Cambiaron la unidad a BI y nadie recalculo los numeros.')).exit).toBe(2);
  });
  it('deja pasar el ESTADO, la frase con fuente, la inferencia declarada, archivos fuera de alcance y el que documenta la regla', () => {
    expect(ev(mem('La BOM dice BIDON 18KG y la etiqueta de la lata dice NETO 15 Kg.')).exit).toBe(0);
    expect(ev(mem('Segun el mail del 11/12/2025 de Fak, confundieron la unidad.')).exit).toBe(0);
    expect(ev(mem('Probablemente nadie recalculo los numeros, no consta.')).exit).toBe(0);
    expect(ev(mem('alguien copio esto y nadie recalculo nada', '/x/components/Foo.tsx')).exit).toBe(0);
    expect(ev(mem('se comio la coma, confundieron, nadie recalculo', '/x/memory/feedback_no_inventar_causas_de_errores_ajenos.md')).exit).toBe(0);
  });
  it('AGUJERO TAPADO 05/09: la memoria escrita con ruta Windows (como la escribe la tool Write) tambien se mira', () => {
    expect(ev(mem('La BOM dice 18KG: confundieron los litros con los kilos.', 'C:\\Users\\FacundoS-PC\\.claude\\projects\\C--Dev-BarackMercosul\\memory\\reference_x.md')).exit).toBe(2);
    expect(ev(mem('nadie recalculo nada', 'C:\\Dev\\BarackMercosul\\.claude\\rules\\amfe.md')).exit).toBe(2);
  });
  it('frasesCausalesSinFuente devuelve las frases, sin repetir', () => {
    expect(frasesCausalesSinFuente('se comio la coma; otra vez se comio la coma')).toEqual(['se comio la coma']);
  });
});

// ───────────────────────────────────────────────────────────── file-guard / renumber / validator / push / supabase
describe('file-guard', () => {
  it('bloquea .env, .env.local, package-lock y .git; recuerda RULE-GATE al tocar una regla; el resto pasa', () => {
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\.env.local')).err).toMatch(/archivo protegido/);
    expect(ev(escribir('/c/Dev/BarackMercosul/.env')).exit).toBe(2);
    expect(ev(editar('package-lock.json')).exit).toBe(2);
    expect(ev(escribir('C:\\Dev\\BarackMercosul\\.git\\HEAD')).exit).toBe(2);
    const r = ev(editar('C:\\Dev\\BarackMercosul\\.claude\\rules\\amfe.md'));
    expect(r.exit).toBe(0);
    expect(r.contexto).toMatch(/RULE-GATE/);
    expect(ev(editar('C:\\Dev\\BarackMercosul\\README.md')).exit).toBe(0);
  });
});

describe('renumber-guard', () => {
  it('bloquea renumerar con --apply sin --i-read-content; dry-run, bypass y menciones pasan', () => {
    expect(ev(bash('node scripts/_renumberOps.mjs --apply')).err).toMatch(/RENUMBER-GUARD BLOQUEO/);
    expect(ev(bash('node scripts/_realignWe.mjs --amfe 150 --apply')).exit).toBe(2);
    expect(ev(bash('node scripts/_renumberOps.mjs')).exit).toBe(0);
    expect(ev(bash('node scripts/_renumberOps.mjs --apply --i-read-content')).exit).toBe(0);
    expect(ev(bash('git commit -m "scripts/_renumberOps.mjs --apply listo"')).exit).toBe(0);
  });
});

describe('validator-check (script leido desde CLAUDE_PROJECT_DIR)', () => {
  const proy = path.join(TMP, 'proy');
  fs.mkdirSync(path.join(proy, 'scripts'), { recursive: true });
  const env = { ...ENV, CLAUDE_PROJECT_DIR: proy };
  it('bloquea un .mjs --apply que escribe amfe_documents.data sin runWithValidation; con el gate pasa', () => {
    fs.writeFileSync(path.join(proy, 'scripts', '_fixSinGate.mjs'), "await sb.from('amfe_documents').update({ data: doc }).eq('id', id);\n");
    fs.writeFileSync(path.join(proy, 'scripts', '_fixConGate.mjs'), "import { runWithValidation } from './_lib/dryRunGuard.mjs';\nawait sb.from('amfe_documents').update({ data: doc });\n");
    fs.writeFileSync(path.join(proy, 'scripts', '_soloMeta.mjs'), "await sb.from('amfe_documents').update({ title: 'x' });\n");
    expect(ev(bash('node scripts/_fixSinGate.mjs --apply'), { env }).err).toMatch(/VALIDATOR-CHECK BLOQUEO/);
    expect(ev(bash('node scripts/_fixConGate.mjs --apply'), { env }).exit).toBe(0);
    expect(ev(bash('node scripts/_soloMeta.mjs --apply'), { env }).exit).toBe(0);
    expect(ev(bash('node scripts/_fixSinGate.mjs'), { env }).exit).toBe(0);
  });
});

describe('push-guard (repo temporal via CLAUDE_PROJECT_DIR)', () => {
  const repo = path.join(TMP, 'repo');
  const env = { ...ENV, CLAUDE_PROJECT_DIR: repo };
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  fs.mkdirSync(repo, { recursive: true });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'App.tsx'), 'export default 1;');
  git('add', 'App.tsx');
  git('commit', '-qm', 'x');
  it('sin dist bloquea; dist mas nuevo pasa; codigo mas nuevo que dist bloquea; un comando que no es push no mira nada', () => {
    expect(ev(bash('git push origin main'), { env }).err).toMatch(/no existe dist\/index.html/);
    fs.mkdirSync(path.join(repo, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'dist', 'index.html'), '<html>');
    const t0 = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(repo, 'App.tsx'), t0, t0);
    expect(ev(bash('git push origin main'), { env }).exit).toBe(0);
    const t1 = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(repo, 'App.tsx'), t1, t1);
    expect(ev(bash('git push'), { env }).err).toMatch(/mas nuevo que el ultimo build/);
    expect(ev(bash('git status'), { env }).exit).toBe(0);
  });
});

describe('supabase-guard (solo deteccion: el backup lo corre el .sh)', () => {
  it('marca los scripts destructivos y no las menciones ni las auditorias', () => {
    expect(ev(bash('node scripts/_fixAlgo.mjs --apply')).res.supabase).toBe(true);
    expect(ev(bash('node scripts/_seedFamilias.mjs')).res.supabase).toBe(true);
    expect(ev(bash('npx node scripts/_auditAll.mjs --summary')).res.supabase).toBe(false);
    expect(ev(bash('git commit -m "fix: scripts/_fixAlgo.mjs --apply"')).res.supabase).toBe(false);
    expect(ev(bash('node scripts/_fixAlgo.mjs --apply')).exit).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────── script-inline-guard
describe('script-inline-guard — comandos REALES de los transcripts', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(RAIZ, '__tests__/scripts/fixtures/comandosInline.json'), 'utf8'));
  it('los rojos reales (cat > archivo, python -, node -e, python -c) bloquean con el aviso', () => {
    expect(fx.rojos.length).toBeGreaterThanOrEqual(5);
    for (const c of fx.rojos) {
      const r = ev(bash(c.command), { nombres: ['script-inline-guard'] });
      expect(r.exit, `${c.chars} ${c.inicio}`).toBe(2);
      expect(r.err).toMatch(/SCRIPT-INLINE-GUARD/);
    }
  });
  it('el cat > archivo recibe el mensaje de usar Write; el python - el de correr por ruta', () => {
    const cat = fx.rojos.find((c) => /cat > scripts\/_lib\/cierreGuard/.test(c.command));
    expect(ev(bash(cat.command), { nombres: ['script-inline-guard'] }).err).toMatch(/Usa la tool Write/);
    const py = fx.rojos.find((c) => /python - <</.test(c.command));
    expect(ev(bash(py.command), { nombres: ['script-inline-guard'] }).err).toMatch(/ejecutalo POR RUTA/);
  });
  it('los verdes reales (commits largos con heredoc que alimenta a git) pasan', () => {
    expect(fx.verdes.length).toBeGreaterThanOrEqual(3);
    for (const c of fx.verdes) expect(ev(bash(c.command), { nombres: ['script-inline-guard'] }).exit, `${c.chars} ${c.inicio}`).toBe(0);
  });
  it('umbral: un heredoc de menos de 3.000 pasa; uno de mas bloquea; sin heredoc ni -e no mira el largo', () => {
    const x = 'x'.repeat(INLINE_MAX - 50);
    expect(ev(bash(`python - <<'PY'\n${x}\nPY`)).exit).toBe(0);
    expect(ev(bash(`python - <<'PY'\n${'x'.repeat(INLINE_MAX + 50)}\nPY`)).exit).toBe(2);
    expect(ev(bash(`for f in ${Array.from({ length: 400 }, (_, i) => `a${i}`).join(' ')}; do echo $f; done`)).exit).toBe(0);
  });
  it('medirInline: excluye los heredocs de git/gh, cuenta el heredoc sin cerrar y el node -e entero', () => {
    expect(medirInline('git commit -F - <<EOF\n' + 'y'.repeat(5000) + '\nEOF').inline).toBe(0);
    expect(medirInline('python - <<PY\n' + 'y'.repeat(4000)).inline).toBeGreaterThan(3900);
    expect(medirInline('cat > x.py <<EOF\nabc\nEOF').archivo).toBe(4);
    const nodeE = `node -e '${'z'.repeat(3500)}'`;
    expect(medirInline(nodeE).inline).toBe(nodeE.length);
  });
  it('FALSO POSITIVO TAPADO 05/09: un commit largo cuyo MENSAJE nombra "node -e / python -" no es un script pegado', () => {
    // El primer commit de la Ola 2 lo bloqueo su propio guardian: el detector miraba el cuerpo del heredoc.
    const commit = `git add a.mjs b.sh && \\\ngit commit -q -F - <<'EOF'\nfeat: guardian para heredoc / node -e / python - pegados\n${'x'.repeat(3200)}\nEOF\ngit log --oneline -1`;
    expect(medirInline(commit).inline).toBe(0);
    expect(ev(bash(commit)).exit).toBe(0);
    // Pero el node -e de verdad, fuera del heredoc, sigue contando entero.
    expect(ev(bash(`node -e 'x' && git commit -F - <<'EOF'\nmsg\nEOF\nnode -e '${'z'.repeat(3100)}'`)).exit).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────── documentacion-oficial-guard
// Los dos casos rojos son literalmente el incidente del 05/09/2026: guarde una guia MIA
// (armada reordenando la ayuda online del BeOn) junto al Formel Q, y le cambie el nombre al PDF
// que habia mandado VW. Regla: .claude/rules/documentacion-oficial.md
describe('documentacion-oficial-guard — en la carpeta del original no entra nada mio', () => {
  const BIBL = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)';
  const MAN = `${BIBL}\\4- MANUALES\\Fórmula Q Piezas Nuevas Integral VW`;
  const SCRATCH = 'C:\\Users\\FACUND~1\\AppData\\Local\\Temp\\claude\\C--Dev-BarackMercosul\\abc\\scratchpad';
  const solo = { nombres: ['documentacion-oficial-guard'] };
  const doc = (p) => ev(p, solo);

  it('ROJO — el incidente: escribir mi guia entre los originales, y renombrar el PDF que mando VW', () => {
    const guia = doc(escribir(`${MAN}\\BeOn - Guia de carga (EMPB) - 09-2026.pdf`));
    expect(guia.exit).toBe(2);
    expect(guia.err).toMatch(/DOCUMENTACION-OFICIAL/);
    const ren = doc(bash(`mv "${MAN}\\Documentos que deben cargar en BEON.pdf" "${MAN}\\Documentos que deben cargar en BEON - VW 06-06-2022.pdf"`));
    expect(ren.exit).toBe(2);
    expect(ren.err).toMatch(/nombre que le puso el emisor/);
  });

  it('ROJO — copiar ahi algo generado en esta PC, generarlo directo adentro, y el .txt que no es transcripcion', () => {
    expect(doc(bash(`cp "${SCRATCH}\\guia_sacada.pdf" "${MAN}\\BeOn - Guia.pdf"`)).exit).toBe(2);
    expect(doc(ps(`Copy-Item "C:\\Dev\\BarackMercosul\\tmp\\resumen.docx" "${MAN}\\resumen.docx"`)).exit).toBe(2);
    expect(doc(bash(`python scripts/_beon.py --out "${MAN}\\ayuda.pdf"`)).exit).toBe(2);
    // Un .txt no zafa por ser .txt: sin fuente ni fecha de consulta es un resumen mio.
    expect(doc(escribir(`${MAN}\\BeOn - lo que dice la ayuda.txt`, 'La carga se hace en 8 pasos...')).exit).toBe(2);
  });

  it('VERDE — la transcripcion con fuente y fecha, la carpeta TRADUCIDOS, y sacar de ahi lo que no va', () => {
    const transcripcion = [
      'Fuente: https://sso.volkswagen.de/beon-doc/onlineHelp/en/BeOn.htm',
      'Fecha de consulta: 05/09/2026',
      'Como se obtuvo: navegador con la sesion del portal VW abierta (la ayuda pide login).',
      '', 'BeOn — Bemusterung Online', '...',
    ].join('\n');
    expect(doc(escribir(`${MAN}\\BeOn - ayuda online - transcripcion 05-09-2026.txt`, transcripcion)).exit).toBe(0);
    expect(doc(escribir(`${MAN}\\TRADUCIDOS\\Formel_Q_Neuteile Integral - ES.txt`, 'texto traducido')).exit).toBe(0);
    // Sacar un archivo mio de la carpeta del original es la unica correccion posible: no se bloquea.
    expect(doc(bash(`mv "${MAN}\\BeOn - Guia de carga.pdf" "${SCRATCH}\\guia_sacada.pdf"`)).exit).toBe(0);
    // Y el original que manda el emisor entra tal cual, desde donde llego (un adjunto, Descargas).
    expect(doc(bash(`cp "${BIBL}\\6- ARCHIVO DE CORREO\\ADJUNTOS\\Formel_Q.pdf" "${MAN}\\Formel_Q.pdf"`)).exit).toBe(0);
    expect(doc(bash(`mv "C:\\Users\\FacundoS-PC\\Downloads\\Formel_Q_Neuteile.pdf" "${MAN}\\Formel_Q_Neuteile.pdf"`)).exit).toBe(0);
    // Leer un manual con una opcion que se parece a "generar": `grep -o` / `sort -o` no generan nada.
    expect(doc(bash(`grep -o "BeOn" "${MAN}\\Handbook QPN.pdf"`)).exit).toBe(0);
    expect(doc(bash(`python scripts/_leerPlano.py "${MAN}\\Handbook QPN.pdf" --out "C:\\Dev\\BarackMercosul\\tmp\\qpn.txt"`)).exit).toBe(0);
  });

  it('VERDE — leer la carpeta solo recuerda 1x/h; fuera de la zona no dice nada', () => {
    expect(rec(bash(`ls -la "${MAN}"`), solo)).toMatch(/DOCUMENTACION-OFICIAL — RECORDATORIO/);
    expect(rec(escribir(`${BIBL}\\1- GENERAL\\FORMATOS GENERAL\\guia BeOn.pdf`), solo)).toBe('');
    expect(rec(bash('git commit -m "docs: 4- MANUALES no lleva archivos mios"'), solo)).toBe('');
    // El guardian, su wrapper, su test y la regla NOMBRAN las carpetas como dato: no se disparan.
    expect(rec(editar('C:\\Dev\\BarackMercosul\\.claude\\rules\\documentacion-oficial.md'), solo)).toBe('');
    expect(rec(escribir('C:\\Dev\\BarackMercosul\\__tests__\\scripts\\guardianes.test.mjs'), solo)).toBe('');
  });

  it('VERDE — la transcripcion se puede COPIAR desde el scratchpad: se mira el archivo, no el nombre', () => {
    const conCabecera = path.join(TMP, 'scratchpad', 'beon_ayuda_en.txt');
    const sinCabecera = path.join(TMP, 'scratchpad', 'beon_resumen.txt');
    fs.mkdirSync(path.dirname(conCabecera), { recursive: true });
    fs.writeFileSync(conCabecera, 'Fuente: https://sso.volkswagen.de/beon-doc/onlineHelp/en/BeOn.htm\nFecha de consulta: 05/09/2026\n\nWelcome...');
    fs.writeFileSync(sinCabecera, 'La carga se hace en 8 pasos, lo primero que conviene es...');
    expect(doc(bash(`cp "${conCabecera}" "${MAN}\\BeOn - ayuda online (en) - transcripcion 05-09-2026.txt"`)).exit).toBe(0);
    // El mismo comando con un .txt que NO declara de donde salio sigue bloqueado.
    expect(doc(bash(`cp "${sinCabecera}" "${MAN}\\BeOn - resumen.txt"`)).exit).toBe(2);
  });

  it('ultimaRuta: el destino de un cp/mv es el ultimo token con pinta de ruta, no una opcion', () => {
    expect(ultimaRuta('cp "a b/x.pdf" "C:\\M\\4- MANUALES\\x.pdf"')).toBe('C:\\M\\4- MANUALES\\x.pdf');
    expect(ultimaRuta('cp -r origen/ destino/ --verbose')).toBe('destino/');
    expect(ultimaRuta('echo hola')).toBe('');
  });
});

// ───────────────────────────────────────────────────────────── secretos-guard
// H7 de la auditoria del entorno (04/09/2026): el deny `Read(**/.env.local)` no cubre Bash
// (`head -c 1 .env.local | wc -c` -> 1) y `.qr-secret` no figuraba en ningun deny.
describe('secretos-guard — .env.local y .qr-secret no se leen ni se pisan desde la shell', () => {
  const solo = { nombres: ['secretos-guard'] };
  const rojo = (p) => {
    const r = ev(p, solo);
    expect(r.exit, p.tool_input.command).toBe(2);
    expect(r.err).toMatch(/SECRETOS-GUARD/);
    return r;
  };
  const verde = (p) => expect(ev(p, solo).exit, p.tool_input.command).toBe(0);

  it('ROJO — la evasion que midio el auditor y las lecturas directas', () => {
    rojo(bash('head -c 1 .env.local | wc -c'));
    rojo(bash('cat .env.local'));
    rojo(bash('cat "C:\\Dev\\BarackMercosul\\.env.local"'));
    rojo(bash('type C:\\Dev\\BarackMercosul\\.qr-secret'));
    rojo(bash('sed -n 1,3p .env.local'));
    rojo(bash('grep VITE_SUPABASE_ANON_KEY .env.local'));
    rojo(bash('tail -n 2 .env.production.local'));
    rojo(bash('cat .env'));
  });
  it('ROJO — por interprete, por source y por redireccion (leer con < y pisar con >)', () => {
    rojo(bash(`python -c "print(open('.env.local').read())"`));
    rojo(bash(`node -e "console.log(require('fs').readFileSync('.qr-secret','utf8'))"`));
    rojo(bash('export $(cat .env.local | xargs)'));
    rojo(bash('set -a; . .env.local; set +a'));
    rojo(bash('source .env.local && node scripts/x.mjs'));
    rojo(bash('while read l; do echo "$l"; done < .env.local'));
    const pisa = rojo(bash('echo "VITE_X=1" >> .env.local'));
    expect(pisa.err).toMatch(/pisa un archivo de secretos/);
    rojo(bash('echo nueva-clave > .qr-secret'));
  });
  it('ROJO — PowerShell', () => {
    rojo(ps('Get-Content .env.local'));
    rojo(ps('gc C:\\Dev\\BarackMercosul\\.qr-secret | Out-String'));
    rojo(ps('Select-String VITE .env.local'));
  });
  it('VERDE — lo que la casa hace de verdad con esos archivos', () => {
    verde(bash('cp .env.local .claude/worktrees/x/.env.local')); // memoria worktree_sin_env_local
    verde(bash('ls -la .env.local .qr-secret'));
    verde(bash('test -f .env.local && echo ok'));
    verde(bash('stat -c %s .env.local'));
    verde(bash('git check-ignore -v .env.local'));
    verde(bash('node scripts/_nube.mjs --subir --aplicar'));
    verde(bash('node scripts/_backup.mjs'));
    verde(bash('cat .env.example'));
    verde(bash('cat README.md && head docs/LECCIONES_APRENDIDAS.md'));
    verde(bash('grep -rn "VITE_SUPABASE" --include=*.ts .'));
    verde(ps('Test-Path .env.local'));
  });
  it('VERDE — nombrarlo no es leerlo: grep con el patron entre comillas, commits, tests, process.env', () => {
    verde(bash('grep -rn "\\.env\\.local" scripts/ .claude/'));
    verde(bash('git commit -m "fix(guard): cat .env.local queda bloqueado desde Bash"'));
    verde(bash(`git commit -q -F - <<'EOF'\nfeat: secretos-guard\n\nhead -c 1 .env.local | wc -c ya no pasa.\nEOF`));
    verde(bash('npx vitest run __tests__/scripts/guardianes.test.mjs -t secretos'));
    verde(bash('echo "process.env.VITE_SUPABASE_URL" && node -e "console.log(process.env.HOME)"'));
    verde(bash('npm install dotenv && cat .envrc'));
  });
  it('comandoTocaSecreto: dice QUE archivo y COMO', () => {
    expect(comandoTocaSecreto('cat .env.local')).toEqual({ como: 'lectura', nombres: ['.env.local'] });
    expect(comandoTocaSecreto('echo x > .qr-secret').como).toBe('redireccion');
    expect(comandoTocaSecreto('set -a; . .env.local').como).toBe('source');
    expect(comandoTocaSecreto('ls .env.local')).toBeNull();
    expect(comandoTocaSecreto('')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────── por bash: wrappers y despachador
describe('por bash — los wrappers finos y el despachador (el camino real)', () => {
  const correrSh = (script, payload, extraEnv = {}) => {
    const r = spawnSync('bash', [path.join(RAIZ, '.claude/hooks', script)], {
      input: typeof payload === 'string' ? payload : JSON.stringify(payload), encoding: 'utf8', env: { ...ENV, ...extraEnv },
    });
    return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  };
  it('escritorio-guard.sh suelto: bloquea el rm y recuerda con additionalContext', () => {
    expect(correrSh('escritorio-guard.sh', bash(`rm -rf "${ESC}\\Insert"`)).code).toBe(2);
    const r = correrSh('escritorio-guard.sh', bash(`ls "${ESC}"`));
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).hookSpecificOutput.additionalContext).toMatch(/ESCRITORIO-GUARD/);
  });
  it('documentacion-oficial-guard.sh suelto: bloquea la guia mia entre los originales y recuerda al leer', () => {
    const MAN = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)\\4- MANUALES';
    expect(correrSh('documentacion-oficial-guard.sh', escribir(`${MAN}\\BeOn - Guia de carga.pdf`)).code).toBe(2);
    const r = correrSh('documentacion-oficial-guard.sh', bash(`ls "${MAN}/"`));
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).hookSpecificOutput.additionalContext).toMatch(/DOCUMENTACION-OFICIAL/);
  });
  it('_dispatcher.sh: inocente 0 · Read 0 · rm en el Escritorio 2 · JSON roto con rm 2 · CAD roto recuerda con 0', () => {
    expect(correrSh('_dispatcher.sh', bash('echo hola')).code).toBe(0);
    expect(correrSh('_dispatcher.sh', { tool_name: 'Read', tool_input: { file_path: 'a.txt' } }).code).toBe(0);
    expect(correrSh('_dispatcher.sh', bash(`rm -rf "${ESC}\\Insert"`)).code).toBe(2);
    expect(correrSh('_dispatcher.sh', '{"tool_name":"Bash","tool_input":{"command":"rm -rf /c/Users/FacundoS-PC/OneDrive/Escritorio/tarea"').code).toBe(2);
    const cad = correrSh('_dispatcher.sh', '{"tool_name":"Bash","tool_input":{"command":"python m.py --usa-gmsh"');
    expect(cad.code).toBe(0);
    expect(cad.out).toMatch(/CAD-GUARD/);
  });
  it('causas-ajenas-guard.sh con HOOK_FILE/HOOK_PARSED4 y sin stdin (como su .test.sh)', () => {
    const r = spawnSync('bash', [path.join(RAIZ, '.claude/hooks/causas-ajenas-guard.sh')], {
      encoding: 'utf8', env: { ...ENV, HOOK_FILE: '/x/memory/m.md', HOOK_PARSED4: 'Cambiaron la unidad a BI y nadie recalculo los numeros.' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(r.status).toBe(2);
  });
});
