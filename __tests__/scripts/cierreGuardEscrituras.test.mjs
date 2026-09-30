// cierre-guard · "archivos sin commitear" cuenta solo lo que ESTA sesion ESCRIBIO (30/09/2026).
//
// Medicion (25 transcripts con el aviso, 09/2026): el relevador contaba como "tocado" cualquier
// archivo de codigo NOMBRADO en un comando —un cat, un grep, un node --check— y los de los
// subagentes: una sesion con 9 archivos escritos figuraba con 465 tocados, y la mayoria de los
// avisos listaban lo que OTRA sesion dejo sucio en el mismo repo (CLAUDE.md, LECCIONES, un .py de
// otra tarea). Ahora cuenta lo que la sesion escribio: Write/Edit/MultiEdit/NotebookEdit y los
// comandos de `cierreCanon.data.json › escrituras`. Lo que no se puede ubicar es OPACO.
//
// Se prueba en las DOS direcciones:
//   VERDE (el falso positivo ya no sale): leer, buscar o correr un chequeo no es tocar.
//   ROJO  (lo que tiene que frenar sigue frenando): escribir con Write/Edit, con `>`, con
//         `sed -i`, con `git add`, o por un interprete que no se ubica, sigue contando.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  escrituraEnComando, relevarTranscript, relevarPendientes, decidir, REPO, CANON,
} from '../../scripts/_lib/cierreGuard.mjs';

// Los casos con un git real (init, add, commit en un repo temporal) levantan varios procesos: con la PC cargada
// pasaron los 15 s del config. El tope es por carga, no por logica (mismo criterio que hooksVarios/guardianes).
vi.setConfig({ testTimeout: 60_000 });

const esc = (c) => {
  const r = escrituraEnComando(c);
  return { escritos: [...r.escritos].sort(), opaco: r.opaco };
};

describe('escrituraEnComando · VERDE: leer, buscar y chequear no es tocar', () => {
  it.each([
    ['cat CLAUDE.md'],
    ['grep -n "x" scripts/_lib/guardianes.mjs docs/LECCIONES_APRENDIDAS.md | head -20'],
    ['head -40 .claude/skills/hojas-de-proceso/scripts/redaccion.py'],
    ['node --check scripts/_lib/cierreGuard.mjs'],
    ['sed -n 1,5p scripts/foo.mjs'],
    ['git status --porcelain && git diff HEAD -- scripts/a.mjs && git log --oneline -5 -- CLAUDE.md'],
    ['git show HEAD:docs/x.md'],
    ['ls -la scripts/_lib/*.mjs'],
    ['npm run build'],
    ['npx vitest run __tests__/scripts/x.test.mjs --pool=threads'],
    ['npx tsc --noEmit'],
    ['cd /c/Dev/BarackMercosul && git commit -m "fix: tocar scripts/x.mjs"'],
    ['git push origin main'],
    ['echo hola > /dev/null 2>&1'],
    ['wc -l scripts/_lib/guardianes.mjs && find scripts -name "*.py" | head'],
    ['cp informe.pdf "C:\\Users\\FacundoS-PC\\Desktop\\tarea\\informe.pdf"'],
  ])('%s → no escribe nada del repo y no es opaco', (cmd) => {
    expect(esc(cmd)).toEqual({ escritos: [], opaco: false });
  });

  it('PowerShell: leer y filtrar no es tocar', () => {
    expect(esc('Get-ChildItem scripts | Where-Object { $_.Name -like "*.mjs" } | Select-Object Name')).toEqual({ escritos: [], opaco: false });
    expect(esc('Get-Content CLAUDE.md | Select-String "x"')).toEqual({ escritos: [], opaco: false });
  });
});

describe('escrituraEnComando · ROJO: lo que escribe sigue contando', () => {
  it.each([
    ["sed -i 's/a/b/' scripts/foo.mjs", ['scripts/foo.mjs']],
    ["sed -i -e 's/a/b/' -e 's/c/d/' scripts/foo.mjs docs/x.md", ['docs/x.md', 'scripts/foo.mjs']],
    ["perl -pi -e 's/a/b/' scripts/foo.py", ['scripts/foo.py']],
    ["cat > docs/x.md <<'EOF'\nimport y from './y.mjs';\nEOF", ['docs/x.md']],
    ['echo x >> scripts/_lib/z.json', ['scripts/_lib/z.json']],
    ['printf "a" | tee scripts/t.sh', ['scripts/t.sh']],
    ['git add scripts/a.mjs docs/b.md', ['docs/b.md', 'scripts/a.mjs']],
    ['git restore scripts/a.mjs', ['scripts/a.mjs']],
    ['git checkout -- scripts/a.mjs', ['scripts/a.mjs']],
    ['git rm docs/viejo.md', ['docs/viejo.md']],
    ['mv scripts/a.mjs scripts/b.mjs', ['scripts/a.mjs', 'scripts/b.mjs']],
    ['cp scripts/a.mjs scripts/b.mjs', ['scripts/b.mjs']],
    ['rm docs/x.md', ['docs/x.md']],
    ['touch scripts/nuevo.mjs', ['scripts/nuevo.mjs']],
    ["Set-Content -Path scripts/x.mjs -Value 'hola (mundo) $x'", ['scripts/x.mjs']],
    ['Get-Date | Out-File docs/x.md', ['docs/x.md']],
  ])('%s', (cmd, esperado) => {
    expect(esc(cmd).escritos).toEqual(esperado);
  });

  it('una ruta absoluta de adentro del repo se relativiza', () => {
    expect(esc(`cat > "${REPO}\\docs\\x.md" <<'EOF'\nhola\nEOF`).escritos).toEqual(['docs/x.md']);
    expect(esc(`sed -i 's/a/b/' ${REPO.replace(/\\/g, '/')}/scripts/foo.mjs`).escritos).toEqual(['scripts/foo.mjs']);
  });
});

describe('escrituraEnComando · OPACO: lo que no se ubica no se da por inocente', () => {
  it.each([
    ['python scripts/x.py --apply'],
    ["python - <<'EOF'\nopen('docs/x.md','w').write('a')\nEOF"],
    ['node scripts/_generar.mjs'],
    ['bash scripts/deploy.sh'],
    ['git add .'],
    ['git add -A'],
    ['git add scripts/_lib'],                                // una carpeta
    ['git stash'],
    ['git checkout main'],
    ['git pull --rebase'],
    ['for f in scripts/*.mjs; do sed -i s/a/b/ "$f"; done'],
    ['sed -i s/a/b/ scripts/*.mjs'],
    ['rm -rf tmp/carpeta'],
    ['find . -name "*.bak" -exec rm {} ;'],
    ['npm install left-pad'],
    ['npx prettier --write scripts/x.mjs'],
    ['xargs -n1 node'],
    ['un-verbo-que-nadie-conoce scripts/x.mjs'],
    ['git -C otra-carpeta add x.mjs'],
    ["'texto' | Out-File docs/x.md; hay-un-verbo-raro"],
  ])('%s → opaco', (cmd) => {
    expect(esc(cmd).opaco).toBe(true);
  });

  it('un cd a otra carpeta vuelve opaca toda ruta relativa que sigue (no se sabe relativa a que)', () => {
    const r = esc('cd scripts && sed -i s/a/b/ foo.mjs');
    expect(r.opaco).toBe(true);
    expect(r.escritos).toEqual(['foo.mjs']);                 // igual se anota, por si acierta
    expect(esc(`cd ${REPO.replace(/\\/g, '/')} && sed -i s/a/b/ scripts/foo.mjs`)).toEqual({ escritos: ['scripts/foo.mjs'], opaco: false });
    expect(esc('cd "$(git rev-parse --show-toplevel)" && git add scripts/a.mjs').opaco).toBe(false);
  });

  it('un interprete con --check o --version solo mira: no es opaco', () => {
    expect(esc('node --check scripts/x.mjs').opaco).toBe(false);
    expect(esc('python --version').opaco).toBe(false);
  });
});

describe('escrituraEnComando · un interprete que corre codigo: lo que NOMBRA cuenta (asi editan las sesiones cuando no usan Edit)', () => {
  // Casos REALES de septiembre: d5ac4fb1 edito apTable.ts con un `python - <<EOF` (def sub(ruta, viejo, nuevo))
  // y deeb4d2b edito autonomy-contract.md con `py -3 -c "p='...'"`. Con "solo lo que escribe un verbo conocido"
  // esos archivos se perdian: el guard dejaba cerrar con el trabajo sin commitear.
  it('ROJO: python con heredoc que reescribe un archivo → ese archivo cuenta (y es opaco)', () => {
    const r = esc("python - <<'EOF'\nimport io\nruta = 'modules/amfe/apTable.ts'\nt = io.open(ruta, encoding='utf-8').read()\nio.open(ruta, 'w', encoding='utf-8').write(t.replace('a', 'b'))\nEOF");
    expect(r).toEqual({ escritos: ['modules/amfe/apTable.ts'], opaco: true });
  });
  it('ROJO: py -3 -c con la ruta pegada a p= y entre comillas; node -e; pwsh -Command; shutil; sed -i dentro de bash -c', () => {
    expect(esc('py -3 -c "p=\'.claude/rules/autonomy-contract.md\'; s=open(p,encoding=\'utf-8\').read(); open(p,\'w\',encoding=\'utf-8\').write(s)"').escritos).toEqual(['.claude/rules/autonomy-contract.md']);
    expect(esc('node -e "require(\'fs\').writeFileSync(\'scripts/_lib/z.json\', \'{}\')"').escritos).toEqual(['scripts/_lib/z.json']);
    expect(esc('pwsh -Command "Set-Content -Path docs/x.md -Value hola"').escritos).toEqual(['docs/x.md']);
    expect(esc('python -c "import shutil; shutil.copy(\'docs/a.md\', \'docs/b.md\')"').escritos.sort()).toEqual(['docs/a.md', 'docs/b.md']);
    expect(esc('bash -c "sed -i s/a/b/ scripts/foo.sh"').escritos).toEqual(['scripts/foo.sh']);
    expect(esc('python -c "from pathlib import Path; Path(\'docs/n.md\').write_text(\'x\')"').escritos).toEqual(['docs/n.md']);
  });
  it('VERDE (el falso positivo de 0e101d1f): un py -c / node -e que solo LEE un archivo lo nombra sin tocarlo', () => {
    // visto el 30/09/2026: `py -3 -c "import json; d=json.load(open('.../vocabulario.data.json'))..."` contaba el json como tocado
    const soloLee = esc('py -3 -c "import json; d=json.load(open(\'.claude/skills/hojas-de-proceso/vocabulario.data.json\', encoding=\'utf-8\')); print(type(d))"');
    expect(soloLee).toEqual({ escritos: [], opaco: true });                // sigue siendo opaco: no sabemos que mas hizo
    expect(esc('py -3 -c "p=\'.claude/rules/autonomy-contract.md\'; s=open(p,encoding=\'utf-8\').read(); print(len(s))"').escritos).toEqual([]);
    expect(esc('node -e "const c=JSON.parse(require(\'fs\').readFileSync(\'scripts/_lib/cierreCanon.data.json\',\'utf8\')); console.log(Object.keys(c))"').escritos).toEqual([]);
    expect(esc('open(p, \'r\')').escritos).toEqual([]);
  });
  it('ROJO: una ruta absoluta (Windows o Git Bash) adentro del codigo se relativiza', () => {
    expect(esc(`python -c "open(r'${REPO}\\scripts\\x.py','w')"`).escritos).toEqual(['scripts/x.py']);
    expect(esc(`python -c "open('${REPO.replace(/\\/g, '/')}/scripts/y.py','w')"`).escritos).toEqual(['scripts/y.py']);
  });
  it('VERDE: el script que el interprete EJECUTA no es un archivo que escribe; sin una marca de escritura en el comando, lo que recibe como argumento tampoco se atribuye (queda opaco)', () => {
    expect(esc('python scripts/_corre.py')).toEqual({ escritos: [], opaco: true });
    expect(esc('node scripts/_generar.mjs docs/salida.md --apply')).toEqual({ escritos: [], opaco: true });
    expect(esc('bash scripts/deploy.sh').escritos).toEqual([]);
    // con una marca de escritura en el mismo comando, el argumento si cuenta, y el script ejecutado sigue sin contar
    expect(esc('python scripts/_corre.py docs/salida.md > docs/log.md').escritos).toEqual(['docs/log.md', 'docs/salida.md']);
  });
  it('VERDE: sin interprete, nombrar el mismo archivo no es tocarlo (cat, grep, sed -n, git diff, node --check)', () => {
    for (const cmd of [
      'cat modules/amfe/apTable.ts',
      'grep -n "sub(" modules/amfe/apTable.ts scripts/_lib/amfeIo.mjs',
      'sed -n 1,20p .claude/rules/autonomy-contract.md',
      'git diff HEAD -- modules/amfe/apTable.ts',
      'node --check scripts/_lib/amfeIo.mjs',
      'python --version',
    ]) expect(esc(cmd), cmd).toEqual({ escritos: [], opaco: false });
  });
  it('un script pegado con un blob de 300 KB (base64) no cuelga el hook: tiempo lineal y el blob no es una ruta', () => {
    const blob = 'QUJD'.repeat(75_000);                                  // 300 KB de una sola corrida de caracteres de ruta
    const t0 = Date.now();
    const r = esc(`python - <<'EOF'\nimg = "${blob}"\nopen('docs/x.md', 'w').write(img)\nEOF`);
    const r2 = esc(`python -c "img='${blob}'; open('docs/y.md','w').write(img)"`);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.escritos).toEqual(['docs/x.md']);
    expect(r2.escritos).toEqual(['docs/y.md']);
  });
  it('VERDE: lo que un heredoc de git (mensaje de commit) dice no es un archivo', () => {
    expect(esc("git commit -F - <<'MSG'\nfix: arregla scripts/_lib/cierreGuard.mjs y docs/x.md\nMSG").escritos).toEqual([]);
  });
});

describe('cierreCanon › escrituras: listas canonicas, no regex', () => {
  it('trae las listas de verbos y ninguna vacia', () => {
    const e = CANON.escrituras;
    for (const k of ['lectores', 'cd', 'escriben_todo', 'borran', 'mueven', 'copian', 'sed_en_sitio', 'git_lee', 'git_escribe_rutas', 'git_checkout']) {
      expect(Array.isArray(e[k]) && e[k].length > 0, k).toBe(true);
    }
    // un verbo de escritura no puede estar tambien entre los que solo leen
    const lectores = new Set(e.lectores);
    for (const k of ['escriben_todo', 'borran', 'mueven', 'copian']) for (const v of e[k]) expect(lectores.has(v), `${v} esta en ${k} y en lectores`).toBe(false);
    for (const v of e.git_escribe_rutas) expect(e.git_lee.includes(v), `git ${v} escribe y figura como lector`).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── transcripts de sesiones
const l = (o) => JSON.stringify(o);
const asis = (b, extra = {}) => l({ type: 'assistant', timestamp: '2026-09-30T10:00:00.000Z', message: { content: [{ type: 'tool_use', ...b }] }, ...extra });
const user = (texto, ts = '2026-09-30T09:00:00.000Z') => l({ type: 'user', timestamp: ts, message: { content: texto } });
const bash = (command) => asis({ name: 'Bash', input: { command } });
const write = (rel) => asis({ name: 'Write', input: { file_path: `${REPO}\\${rel.replace(/\//g, '\\')}`, content: '' } });
function transcriptDe(lineas) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-esc-'));
  const f = path.join(dir, 'ses.jsonl');
  fs.writeFileSync(f, `${lineas.join('\n')}\n`);
  return { f, dir, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('relevarTranscript · los tocados son lo ESCRITO, no lo nombrado', () => {
  it('VERDE (el caso real): una sesion que lee CLAUDE.md y LECCIONES con cat/grep y escribe UN archivo → tocados = solo ese', async () => {
    const t = transcriptDe([
      user('arregla el hook'),
      bash('cat CLAUDE.md && grep -n x docs/LECCIONES_APRENDIDAS.md'),
      bash('node --check scripts/_lib/cierreGuard.mjs && git diff HEAD -- .claude/skills/hojas-de-proceso/scripts/redaccion.py'),
      write('scripts/_lib/cierreGuard.mjs'),
      bash('npm run build'),
    ]);
    try {
      const r = await relevarTranscript(t.f);
      expect([...r.tocados]).toEqual(['scripts/_lib/cierreGuard.mjs']);
    } finally { t.limpiar(); }
  });

  it('VERDE: una sesion que solo leyo y chequeo → Set vacio (cero pendientes propios), no null', async () => {
    const t = transcriptDe([user('mira esto'), bash('cat CLAUDE.md'), bash('git status && git diff HEAD -- scripts/a.mjs'), bash('npx vitest run --pool=threads')]);
    try {
      const r = await relevarTranscript(t.f);
      expect(r.tocados).toBeInstanceOf(Set);
      expect(r.tocados.size).toBe(0);
      expect(r.huboOpaco).toBe(false);
    } finally { t.limpiar(); }
  });

  it('VERDE: lo que lee un SUBAGENTE tampoco es tocado; lo que escribe, si', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-esc-sub-'));
    const f = path.join(dir, 'ses.jsonl');
    fs.writeFileSync(f, `${[user('audita'), asis({ name: 'Agent', input: { prompt: 'audita' } })].join('\n')}\n`);
    fs.mkdirSync(path.join(dir, 'ses', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ses', 'subagents', 'agent-1.jsonl'), `${[
      user('audita'),
      bash('grep -rn x scripts/_lib/amfeValidator.mjs CLAUDE.md'),
      asis({ name: 'Edit', input: { file_path: `${REPO}\\scripts\\sub.mjs`, old_string: 'a', new_string: 'b' } }),
    ].join('\n')}\n`);
    try {
      expect([...(await relevarTranscript(f)).tocados]).toEqual(['scripts/sub.mjs']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('ROJO sigue rojo: sed -i, cat >, git add y un interprete junto con un Write → todo lo ubicable cuenta', async () => {
    const t = transcriptDe([
      user('dale'),
      bash("sed -i 's/a/b/' scripts/foo.mjs"),
      bash("cat > docs/x.md <<'EOF'\nhola\nEOF"),
      bash('git add scripts/a.mjs'),
      write('CLAUDE.md'),
      bash('python scripts/_corre.py'),
    ]);
    try {
      const r = await relevarTranscript(t.f);
      expect([...r.tocados].sort()).toEqual(['CLAUDE.md', 'docs/x.md', 'scripts/a.mjs', 'scripts/foo.mjs']);
      expect(r.huboOpaco).toBe(true);
    } finally { t.limpiar(); }
  });

  it('ROJO: una sesion que solo corrio un interprete (nada ubicable) → tocados null e `inicio` = su primer mensaje (se cuenta lo sucio desde ahi)', async () => {
    const t = transcriptDe([user('corre el script', '2026-09-30T09:15:00.000Z'), bash('python scripts/_corre.py --apply'), bash('cat CLAUDE.md')]);
    try {
      const r = await relevarTranscript(t.f);
      expect(r.tocados).toBe(null);
      expect(r.inicio).toBe(Date.parse('2026-09-30T09:15:00.000Z'));
    } finally { t.limpiar(); }
  });

  it('ROJO: una sesion que lanzo un agente y no escribio nada ubicable → null (el agente pudo escribir donde no se ve)', async () => {
    const t = transcriptDe([user('audita'), asis({ name: 'Agent', input: { prompt: 'audita' } })]);
    try { expect((await relevarTranscript(t.f)).tocados).toBe(null); } finally { t.limpiar(); }
  });
});

// ─────────────────────────────────────────────────────────── pendientes contra un git de verdad
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('relevarPendientes · git status de un repo real, intersectado con lo escrito por la sesion', () => {
  // relevarPendientes tambien mira (y VACIA) el flag de Supabase del TEMP: que no sea el de la PC real,
  // porque se comeria el recordatorio de backup de otra sesion que este corriendo.
  const TEMP_REAL = process.env.TEMP;
  const TEMP_FALSO = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-temp-'));
  beforeAll(() => { process.env.TEMP = TEMP_FALSO; });
  afterAll(() => {
    if (TEMP_REAL === undefined) delete process.env.TEMP; else process.env.TEMP = TEMP_REAL;
    fs.rmSync(TEMP_FALSO, { recursive: true, force: true });
  });

  function repoConSucio() {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-git-'));
    git(repo, 'init', '-q');
    fs.mkdirSync(path.join(repo, 'scripts'));
    for (const f of ['CLAUDE.md', 'scripts/mio.mjs', 'scripts/ajeno.mjs', 'scripts/viejo.mjs', 'scripts/borrado.mjs']) fs.writeFileSync(path.join(repo, f), 'v1\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    // dos archivos sucios: uno "de otra sesion" con mtime de ayer, y los de ahora
    fs.writeFileSync(path.join(repo, 'scripts/viejo.mjs'), 'v2-viejo\n');
    const ayer = new Date(Date.now() - 24 * 3600 * 1000);
    fs.utimesSync(path.join(repo, 'scripts/viejo.mjs'), ayer, ayer);
    fs.writeFileSync(path.join(repo, 'scripts/mio.mjs'), 'v2-mio\n');
    fs.writeFileSync(path.join(repo, 'scripts/ajeno.mjs'), 'v2-ajeno\n');
    fs.writeFileSync(path.join(repo, 'scripts/nuevo.mjs'), 'v1\n');          // sin trackear
    fs.rmSync(path.join(repo, 'scripts/borrado.mjs'));
    return repo;
  }
  const nombres = (pend) => (pend.find((x) => /sin commitear/.test(x)) || '').replace(/^.*\(/, '').replace(/\).*$/, '');

  it('con los tocados de la sesion: solo esos aparecen (VERDE: el resto es de otra sesion)', () => {
    const repo = repoConSucio();
    try {
      // (relevarPendientes suma tambien avisos de LECCIONES y Supabase del repo real: se mira solo el de git)
      const pend = relevarPendientes(new Set(['scripts/mio.mjs']), { repo }).filter((x) => /sin commitear/.test(x));
      expect(pend.length).toBe(1);
      expect(pend[0]).toMatch(/hay 1 archivo\(s\) sin commitear \(scripts\/mio\.mjs\)/);
    } finally { fs.rmSync(repo, { recursive: true, force: true }); }
  });

  it('ROJO: lo que la sesion escribio y sigue sin commitear SIGUE apareciendo, nuevo o borrado', () => {
    const repo = repoConSucio();
    try {
      const pend = relevarPendientes(new Set(['scripts/mio.mjs', 'scripts/borrado.mjs']), { repo });
      expect(pend[0]).toMatch(/hay 2 archivo\(s\)/);
      expect(nombres(pend)).toContain('scripts/borrado.mjs');
      // nada escrito por la sesion (Set vacio): ningun pendiente propio
      expect(relevarPendientes(new Set(), { repo }).filter((x) => /sin commitear/.test(x))).toEqual([]);
    } finally { fs.rmSync(repo, { recursive: true, force: true }); }
  });

  it('sesion opaca (tocados null) con `desde`: cuenta lo modificado desde que arranco y lo borrado; NO lo sucio de ayer', () => {
    const repo = repoConSucio();
    try {
      const desde = Date.now() - 3600 * 1000;                                  // la sesion arranco hace una hora
      const n = nombres(relevarPendientes(null, { desde, repo }));
      expect(n).toContain('scripts/mio.mjs');
      expect(n).toContain('scripts/ajeno.mjs');                                // concurrente: no se puede distinguir, se cuenta
      expect(n).toContain('scripts/borrado.mjs');                              // borrado: no se sabe, cuenta
      expect(n).not.toContain('scripts/viejo.mjs');                            // sucio de ayer: no es de esta sesion
    } finally { fs.rmSync(repo, { recursive: true, force: true }); }
  });

  it('sin transcript (tocados null y sin `desde`): TODO lo sucio, como antes — fallar al lado seguro', () => {
    const repo = repoConSucio();
    try {
      const pend = relevarPendientes(null, { repo });
      expect(pend[0]).toMatch(/hay 5 archivo\(s\) sin commitear/);             // ajeno, borrado, mio, nuevo (sin trackear) y viejo
    } finally { fs.rmSync(repo, { recursive: true, force: true }); }
  });
});

// ─────────────────────────────────────────────────────────── decidir
describe('decidir · le pasa a los pendientes los tocados y desde cuando', () => {
  const base = { session_id: 's-esc', last_assistant_message: 'Listo, commiteado y pusheado.' };
  const deps = { enCooldown: () => false, marcar: () => {} };

  it('sesion opaca: pendientes(null, { desde: inicio })', async () => {
    let args = null;
    const r = await decidir(base, { ...deps, pendientes: (...a) => { args = a; return ['hay 1 archivo(s) sin commitear (x.mjs)']; }, fueraEnEsteTurno: async () => ({ fuera: false, tocados: null, inicio: 1234 }) });
    expect(r.ok).toBe(false);                                                  // ROJO: con pendientes medibles sigue frenando
    expect(args[0]).toBe(null);
    expect(args[1]).toEqual({ desde: 1234 });
  });

  it('sin transcript: pendientes(null, { desde: undefined }) → cuenta todo, como hoy', async () => {
    let args = null;
    await decidir(base, { ...deps, pendientes: (...a) => { args = a; return []; }, fueraEnEsteTurno: async () => ({ fuera: false }) });
    expect(args[0]).toBe(null);
    expect(args[1].desde).toBeUndefined();
  });

  it('VERDE: con los tocados de la sesion y nada pendiente de ellos, el cierre pasa', async () => {
    const r = await decidir(base, { ...deps, pendientes: () => [], fueraEnEsteTurno: async () => ({ fuera: false, tocados: new Set(['scripts/a.mjs']) }) });
    expect(r.ok).toBe(true);
  });
});
