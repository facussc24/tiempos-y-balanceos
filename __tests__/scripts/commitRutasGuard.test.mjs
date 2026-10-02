/**
 * commit-rutas-guard — los dos sentidos.
 *
 * El indice de git es UNO para todas las sesiones que trabajan en el worktree principal. Los ROJOS
 * son lo que ya paso tres veces (30/08, 11/09 y 02/10/2026: `git add` por nombre + `git commit`
 * pelado, y el commit `cee8f1b2` salio con 12 archivos de otra sesion). Los VERDES son el commit de
 * todos los dias, que no se puede frenar: con las rutas despues de `--`, y todo lo que nombra
 * "git commit" sin ser un commit.
 *
 * Regla: .claude/rules/git-deploy.md, paso 2.
 */
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GUARDIANES, matriz, evaluar, commitsSinRutas, leerArgsDeCommit } from '../../scripts/_lib/guardianes.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-rutas-'));
afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temp */ } });
// Una carpeta que NO es un repo: el guardian no puede confundir estos casos con "estoy en un merge".
const ENV = { HOME: TMP, TMPDIR: TMP, CLAUDE_PROJECT_DIR: TMP };

/** ctx minimo, con la forma que arma parsear() cuando el JSON del hook se leyo bien. */
const ctx = (cmd, { tool = 'Bash', cwd = '' } = {}) => ({
    ok: true, tool, toolL: tool.toLowerCase(), cmd, cmd6: cmd, file: '', fileL: '', body6: '', raw: '', cwd,
    rescate: { tool: tool.toLowerCase(), cmd, file: '', content: '' },
});
const correr = (cmd, opts) => GUARDIANES['commit-rutas-guard'](ctx(cmd, opts), { env: ENV });
/** Por el camino entero (JSON del hook -> exit), solo con este guardian. */
const exit = (command, tool = 'Bash') => evaluar(JSON.stringify({ tool_name: tool, tool_input: { command } }), { nombres: ['commit-rutas-guard'], env: ENV }).salida.exit;

const HEREDOC_SIN = "git add docs/a.md && git commit -q -F - <<'MSG'\ndocs: algo\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nMSG\ngit push -q origin main";
const HEREDOC_CON = "git add docs/a.md && git commit -q -F - -- docs/a.md <<'MSG'\ndocs: un git commit -m x sin rutas ya no pasa\nMSG\ngit push -q origin main";
const CAT_SIN = "git add a.md && git commit -q -m \"$(cat <<'EOF'\ndocs(x): el boton es \"Add\", no \"Replace\"\nEOF\n)\" && git push";
const CAT_CON = "git add a.md && git commit -q -m \"$(cat <<'EOF'\ndocs(x): el boton es \"Add\", no \"Replace\"\nEOF\n)\" -- a.md && git push";

const ROJOS = [
    ['sin rutas', 'git commit -m x'],
    ['mensaje por stdin, sin rutas', 'git commit -q -F -'],
    ['-a: todo lo modificado', 'git commit -am x'],
    ['--all', 'git commit --all -m x'],
    ['el caso del 02/10: git add por nombre y commit pelado', 'git add a.mjs b.mjs && git commit -m "fix: x" && git push origin main'],
    ['mensaje por heredoc, sin rutas', HEREDOC_SIN],
    ['mensaje por $(cat <<EOF), sin rutas', CAT_SIN],
    ['--amend sin rutas (se lleva lo que haya en el indice)', 'git commit --amend --no-edit'],
    ['--include suma las rutas a lo que ya esta en el indice', 'git commit --include -m x -- a'],
    ['-i, lo mismo', 'git commit -i a -m x'],
    ['`--` sin nada atras', 'git commit -m x --'],
    ['`.` como ruta es todo', 'git commit -m x -- .'],
    ['las rutas solo en una variable (vacia = el indice entero)', 'git commit -m x -- $ARCHIVOS'],
    ['las rutas salen de un $(git status): es "todo lo modificado", sea de quien sea', "FILES=$(git status --porcelain | cut -c4-); git add -- $FILES && git commit -q -F - -- $FILES <<'MSG'\nfix: x\nMSG"],
    ['el mensaje en una variable no cuenta como ruta', 'MSG="fix: algo"; git commit -m "$MSG"'],
    ['F=a.md delante del commit no llega a $F (el shell lo expande antes)', 'F=a.md git commit -m x -- $F'],
    ['git -C <repo> commit', 'git -C /c/Dev/BarackMercosul commit -m x'],
    ['git -c k=v commit', 'git -c user.name=x commit -m x'],
    ['con una variable delante', 'GIT_AUTHOR_DATE=2026-10-02 git commit -m x'],
    ['adentro de bash -c', 'bash -c "git add a && git commit -m x"'],
    ['el mensaje nombra rutas, el commit no las lleva', 'git commit -m "mover -- a b"'],
    ['en PowerShell', 'git commit -m "x"', 'PowerShell'],
    // ── lo que encontro la auditoria del 02/10/2026 (cada uno pasaba y con git de verdad se llevaba lo ajeno)
    ['las palabras de un comentario no son rutas', 'git commit -m "fix: x"  # commit de la tarea'],
    ['rutas de un $(...) con parentesis adentro', "git commit -m x -- $(git ls-files -m | grep -E '\\.(md|mjs)$')"],
    ['rutas de un $(...) anidado', 'git commit -m x -- $(echo $(git diff --name-only))'],
    ['el commit adentro de un $(...)', 'OUT=$(git commit -m "fix: x" 2>&1); echo "$OUT"'],
    ['./. tambien es todo', 'git commit -m x -- ./.'],
    ['.. desde una subcarpeta', 'git commit -m x -- ..'],
    ['** entre comillas', "git commit -m x -- '**'"],
    ['*.* es todo', "git commit -m x -- '*.*'"],
    [':/* y :(top)*', "git commit -m x -- ':/*' && git commit -m y -- ':(top)*'"],
    ['solo una exclusion: todo menos eso', "git commit -m x -- ':!nada'"],
    ['"$PWD/" es la carpeta entera', 'git commit -m x -- "$PWD/"'],
    ['por xargs: la lista se arma sola', 'git diff --name-only | xargs git commit -m x --'],
    ['--pathspec-from-file: la lista se arma sola', 'git diff --name-only | git commit -m x --pathspec-from-file=-'],
    ['adentro de eval', 'eval "git commit -m x"'],
    ['adentro de cmd /c', 'cmd /c "git commit -m x"'],
    ['adentro de powershell -Command', 'powershell -NoProfile -Command "git commit -m x"'],
    ['el heredoc que alimenta a bash', "bash <<'EOF'\ngit commit -m x\nEOF"],
    ['nice -n 5 delante', 'nice -n 5 git commit -m x'],
    ['sudo -u delante', 'sudo -u fak git commit -m x'],
    ['env -u delante', 'env -u FOO git commit -m x'],
    ['timeout delante', 'timeout 30 git commit -m x'],
    ['git.exe con su ruta', '"C:/Program Files/Git/cmd/git.exe" commit -m x'],
    ['git --attr-source HEAD commit', 'git --attr-source HEAD commit -m x'],
    ['--no-dry-run apaga el --dry-run', 'git commit --dry-run --no-dry-run -m x'],
    ['--no-only apaga el --only', 'git commit --amend --only --no-only -m x'],
    ['continuacion de linea con CRLF', 'git commit \\\r\n-m "x"'],
    ['el valor de --author no es una ruta', 'git commit --author "A <a@a>" -m x'],
    ['el valor de --date, de -F y de -t tampoco', 'git commit --date now -t plantilla.txt -F msg.txt'],
    ['ni el de --cleanup, --trailer, --squash, --reuse-message', 'git commit --cleanup strip --trailer "x: y" --squash abc && git commit --reuse-message HEAD'],
];

const VERDES = [
    ['rutas despues de --', 'git commit -m x -- a b'],
    ['--only con la ruta', 'git commit --only a -m x'],
    ['--amend con ruta', 'git commit --amend --no-edit -- a'],
    ['--amend --only: cambia solo el mensaje', 'git commit --amend --only -m "mensaje nuevo"'],
    ['mensaje por heredoc, con rutas (y el mensaje nombra un commit sin rutas)', HEREDOC_CON],
    ['mensaje por $(cat <<EOF), con rutas', CAT_CON],
    ['-m pegado y varias rutas con espacios', 'git commit -qm"x" -- "docs/a b.md" scripts/_lib/guardianes.mjs'],
    ['--author y --date llevan valor: no son rutas, y las rutas estan', 'git commit --author "A <a@a>" --date now -m x -- a'],
    ['una ruta escrita con variable adelante', 'git commit -m x -- "$RAIZ/docs/a.md"'],
    ['las rutas en una variable ESCRITA en el mismo comando (caso real, 22/09)', "F=\"scripts/_bomLegajo.py .claude/skills/carga-arb/SKILL.md\" && git add $F && git commit -q -F - -- $F <<'EOF'\nfeat(bom): x\nEOF"],
    ['rutas sueltas, sin `--` (para git es lo mismo que --only)', 'git commit docs/LECCIONES_APRENDIDAS.md -m "docs(lecciones): x"'],
    ['--dry-run no guarda nada', 'git commit --dry-run -m x'],
    ['git commit-tree no es un commit', 'git commit-tree abc123 -p HEAD -m x'],
    ['un echo que lo nombra', 'echo "git commit"'],
    ['un echo sin comillas', 'echo git commit -m x'],
    ['un grep que lo busca', 'grep -rn "git commit -m" .claude/rules'],
    ['git log / show / status', 'git log --grep "commit sin rutas" && git show --stat HEAD && git status'],
    ['un script escrito por heredoc que lo contiene', "cat > tmp/x.sh <<'EOF'\ngit commit -m x\nEOF"],
    ['un comando que no es de git', 'npm run build && node scripts/_cierreSesion.mjs --sin-build'],
    // ── la otra direccion de lo que encontro la auditoria: lo mismo, bien escrito, sigue pasando
    ['con rutas y un comentario al final', 'git commit -m "fix: x" -- a.md  # commit de la tarea'],
    ['un # adentro del mensaje no es un comentario', 'git commit -m "#123: arreglo" -- a.md'],
    ['una ruta escrita con $(pwd) adelante', 'git commit -m x -- "$(pwd)/docs/a.md"'],
    ['las rutas en una variable escrita con export', 'export F="a.md b.md"; git commit -m x -- $F'],
    ['commit vacio con --only: no toca el indice', 'git commit --allow-empty --only -m "disparar CI"'],
    ['una carpeta y un glob parcial son rutas', "git commit -m x -- docs scripts/_lib '*.md'"],
    ['una ruta que sube una carpeta', 'git commit -m x -- ../docs/a.md'],
    ['nice delante, con rutas', 'nice -n 5 git commit -m x -- a.md'],
    ['eval, con rutas', 'eval "git commit -m x -- a.md"'],
    ['adentro de un $(...), con rutas', 'OUT=$(git commit -m "fix: x" -- a.md 2>&1); echo "$OUT"'],
    ['un comentario que lo nombra', 'git log --oneline -3 # despues: git commit -m x'],
    ['un for que lo imprime', 'for f in a b; do echo git commit -m $f; done'],
    ['command -v git', 'command -v git && echo "hay git para el commit"'],
];

describe('commit-rutas-guard', () => {
    it.each(ROJOS)('ROJO: %s', (_que, cmd, tool) => {
        expect(correr(cmd, { tool })?.tipo).toBe('bloqueo');
        expect(exit(cmd, tool)).toBe(2);
    });
    it.each(VERDES)('VERDE: %s', (_que, cmd) => {
        expect(correr(cmd)).toBe(null);
        expect(exit(cmd)).toBe(0);
    });

    it('el bloqueo dice por que, en castellano, y el comando correcto', () => {
        const r = correr('git commit -m x');
        expect(r.texto).toContain('no dice QUE archivos guarda');
        expect(r.texto).toContain('git commit -m "mensaje" -- ruta1 ruta2');
        expect(r.texto).toContain('git-deploy.md');
        expect(correr('git commit -am x').texto).toContain('`-a`');
        expect(correr('git commit -m x -- .').texto).toContain('es TODO');
        expect(correr('git commit -m x -- $(git diff --name-only)').texto).toContain('no trae las rutas ESCRITAS');
    });

    it('el modulo no lleva el caracter invisible U+E000 escrito literal (un editor que se lo come rompe todos los guardianes)', () => {
        const fuente = fs.readFileSync(path.join(process.cwd(), 'scripts/_lib/guardianes.mjs'), 'utf8');
        expect(fuente.includes(String.fromCharCode(0xE000))).toBe(false);
    });

    it('si el mismo comando hizo `git add` por nombre, el bloqueo devuelve esas rutas listas para pegar', () => {
        const r = correr('git add scripts/a.mjs "docs/b c.md" && git commit -m x');
        expect(r.texto).toContain('-- scripts/a.mjs "docs/b c.md"');
        // un `git add .` no se ofrece como ruta: es justo lo que la regla prohibe
        expect(correr('git add . && git commit -m x').texto).not.toContain('En este mismo comando');
    });

    it('commitsSinRutas: el motivo de cada commit del comando, no solo del primero', () => {
        expect(commitsSinRutas('git commit -m x -- a && git commit -am y').malos.map((m) => m.motivo)).toEqual(['todo']);
        expect(commitsSinRutas('git commit -m x; git commit -m y -- .').malos.map((m) => m.motivo)).toEqual(['sin-rutas', 'ruta-todo']);
    });

    it('leerArgsDeCommit: el valor de una opcion nunca cuenta como ruta', () => {
        expect(leerArgsDeCommit(['-m', 'a', '-F', '-', '-C', 'HEAD', '--fixup', 'abc', '--mess', 'b']).rutas).toEqual([]);
        expect(leerArgsDeCommit(['-m', 'x', 'a', 'b']).rutas).toEqual(['a', 'b']);
        expect(leerArgsDeCommit(['--message=x', '-S', '-uno', '--', '-raro']).rutas).toEqual(['-raro']);
    });

    describe('el commit que cierra un merge o un cherry-pick (git no acepta rutas ahi)', () => {
        const repoEn = (nombre, marca) => {
            const repo = path.join(TMP, nombre);
            fs.mkdirSync(repo);
            spawnSync('git', ['init', '-q'], { cwd: repo });
            if (marca) fs.writeFileSync(path.join(repo, '.git', marca), '0'.repeat(40));
            return repo.replace(/\\/g, '/');
        };
        const enMerge = repoEn('en-merge', 'MERGE_HEAD');
        const enPick = repoEn('en-pick', 'CHERRY_PICK_HEAD');
        const limpio = repoEn('limpio', '');
        const tipo = (cmd, cwd) => correr(cmd, { cwd })?.tipo;

        it('VERDE: pasa sin rutas, con un aviso que le llega al modelo', () => {
            expect(tipo('git commit --no-edit', enMerge)).toBe('recordatorio');
            expect(tipo('git commit --no-edit', enPick)).toBe('recordatorio');
            expect(correr('git commit --no-edit', { cwd: enMerge }).texto).toContain('git show --stat HEAD');
            // parado en otra carpeta, con el repo en merge nombrado por su ruta
            expect(tipo(`cd "${enMerge}" && git commit --no-edit`, limpio)).toBe('recordatorio');
            expect(tipo(`git -C "${enMerge}" commit --no-edit`, limpio)).toBe('recordatorio');
        });
        it('ROJO: fuera de un merge, o con -a adentro de uno', () => {
            expect(tipo('git commit -m x', limpio)).toBe('bloqueo');
            expect(tipo('git commit -am x', enMerge)).toBe('bloqueo');
            expect(tipo('git commit -m x -- .', enMerge)).toBe('bloqueo');
        });
        it('ROJO: la excepcion no se presta — otro repo, una carpeta que no se sabe, o un segundo commit', () => {
            expect(tipo(`git -C "${limpio}" commit -m x`, enMerge)).toBe('bloqueo');
            expect(tipo(`cd "${limpio}" && git commit -m x`, enMerge)).toBe('bloqueo');
            expect(tipo('cd otra && git commit -m x', enMerge)).toBe('bloqueo');
            expect(tipo('bash -c "git commit -m x"', enMerge)).toBe('bloqueo');
            expect(tipo('git commit --no-edit && git add otro.md && git commit -m "resto"', enMerge)).toBe('bloqueo');
        });
    });

    it('corre con Bash y PowerShell, no con Write ni Edit (esta en la matriz de shell)', () => {
        for (const t of ['Bash', 'PowerShell']) expect(matriz(t)).toContain('commit-rutas-guard');
        for (const t of ['Write', 'Edit']) expect(matriz(t)).not.toContain('commit-rutas-guard');
    });

    it('JSON roto: mira el comando rescatado a mano', () => {
        const roto = (c) => evaluar(`{"tool_name":"Bash","tool_input":{"command":"${c}"`, { nombres: ['commit-rutas-guard'], env: ENV }).salida.exit;
        expect(roto('git commit -m x')).toBe(2);
        expect(roto('git commit -m x -- a b')).toBe(0);
    });
});
