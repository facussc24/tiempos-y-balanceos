/**
 * powerpointQuit — ¿un .py que abre PowerPoint por COM lo cierra sin mirar si Fak tenia algo abierto?
 *
 * PowerPoint es de UNA sola instancia: `Dispatch("PowerPoint.Application")` se engancha al que ya
 * esta abierto, y un `Quit()` sin condicion cierra tambien el deck que Fak este mirando. Paso el
 * 23/09/2026 y volvio el 02/10/2026 en un script nuevo. El patron de la casa es el de
 * `scripts/img/exportar_png.py`:
 *
 *     ppt = win32com.client.Dispatch("PowerPoint.Application")
 *     habia_abiertas = ppt.Presentations.Count          # ANTES de abrir la propia
 *     ...
 *     if habia_abiertas == 0 and ppt.Presentations.Count == 0:
 *         ppt.Quit()
 *
 * Lee la LLAMADA entera, no un renglon (LECCIONES 12/09/2026): junta los renglones logicos, sube
 * por la sangria hasta los `if` que encierran al Quit y sigue de donde sale la variable del "antes".
 * Ante lo que no puede leer (un Quit sobre algo que no sabe que es) frena: no lo da por bueno.
 * Tambien frena al .py que mata el proceso POWERPNT (taskkill, Stop-Process, kill): es el mismo
 * daño sin pasar por Quit.
 *
 * Limite conocido: mira cada archivo por separado. Un `def cerrar(app): app.Quit()` en un modulo que
 * no nombra a PowerPoint ni a `.Presentations` no se juzga.
 *
 * Test en las dos direcciones: `__tests__/scripts/powerpointQuit.test.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Carpetas que no se barren: one-shots viejos que ya no se corren. */
export const EXCLUIDAS = ['scripts/_archive/', 'scripts/archive/'];

const ES_POWERPOINT = /^powerpoint\.application(?:\.\d+)?$/i;         // tambien "PowerPoint.Application.16"
const ES_APLICACION = /^\w+\.application(?:\.\d+)?$/i;
const USA_PRESENTATIONS = /\.\s*Presentations\b/;                       // la coleccion es solo de PowerPoint
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Separa el Python en codigo y literales. Devuelve `codigo` (mismo largo y mismos renglones que la
 * fuente, con los comentarios y el contenido de los strings en blanco) y `literales` ({linea, texto}).
 * Asi un `Quit()` nombrado en un comentario o en un docstring no cuenta como llamada.
 */
export function separar(fuente) {
    const src = String(fuente).replace(/\r\n?/g, '\n');
    const out = [];
    const literales = [];
    let linea = 1;
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '#') {
            while (i < src.length && src[i] !== '\n') { out.push(' '); i++; }
            continue;
        }
        if (c === '"' || c === "'") {
            const triple = src.startsWith(c.repeat(3), i);
            const cierre = triple ? c.repeat(3) : c;
            const inicio = linea;
            let texto = '';
            out.push(...cierre);
            i += cierre.length;
            while (i < src.length && !src.startsWith(cierre, i)) {
                if (!triple && src[i] === '\n') break;          // string sin cerrar: termina en el renglon
                const n = src[i] === '\\' && i + 1 < src.length ? 2 : 1;
                for (let k = 0; k < n; k++) {
                    const ch = src[i + k];
                    texto += ch;
                    if (ch === '\n') { out.push('\n'); linea++; } else out.push(' ');
                }
                i += n;
            }
            if (src.startsWith(cierre, i)) { out.push(...cierre); i += cierre.length; }
            literales.push({ linea: inicio, texto });
            continue;
        }
        if (c === '\n') linea++;
        out.push(c);
        i++;
    }
    return { codigo: out.join(''), literales };
}

/** Renglones logicos: junta lo que sigue adentro de un parentesis abierto o despues de una `\`. */
export function renglones(codigo) {
    const fisicos = codigo.split('\n');
    const logicos = [];
    let actual = null;
    let abiertos = 0;
    fisicos.forEach((crudo, idx) => {
        const sigue = /\\\s*$/.test(crudo);
        const texto = crudo.replace(/\\\s*$/, '');
        if (!actual) {
            if (!texto.trim()) return;
            const blancos = texto.match(/^[ \t]*/)[0].replace(/\t/g, '        ');
            actual = { linea: idx + 1, hasta: idx + 1, sangria: blancos.length, texto: texto.trim() };
        } else {
            actual.texto += ' ' + texto.trim();
            actual.hasta = idx + 1;
        }
        for (const ch of texto) {
            if ('([{'.includes(ch)) abiertos++;
            else if (')]}'.includes(ch)) abiertos = Math.max(0, abiertos - 1);
        }
        if (abiertos === 0 && !sigue) { logicos.push(actual); actual = null; }
    });
    if (actual) logicos.push(actual);
    return logicos;
}

/** La condicion de un `if`/`elif`: lo que va hasta el primer `:` fuera de parentesis. */
function condicionDe(texto) {
    const m = /^(?:if|elif)\b/.exec(texto);
    if (!m) return null;
    let abiertos = 0;
    for (let i = m[0].length; i < texto.length; i++) {
        const ch = texto[i];
        if ('([{'.includes(ch)) abiertos++;
        else if (')]}'.includes(ch)) abiertos--;
        else if (ch === ':' && abiertos === 0) return texto.slice(m[0].length, i).trim();
    }
    return texto.slice(m[0].length).trim();
}

/** Las condiciones de los `if` que encierran al renglon `i` (hasta el `def` o `class` que lo contiene). */
function condicionesQueEncierran(logicos, i) {
    const conds = [];
    const propia = condicionDe(logicos[i].texto);        // `if cond: ppt.Quit()` en un solo renglon
    if (propia !== null) conds.push(propia);
    let nivel = logicos[i].sangria;
    for (let j = i - 1; j >= 0 && nivel > 0; j--) {
        const l = logicos[j];
        if (l.sangria >= nivel) continue;
        nivel = l.sangria;
        if (/^(?:async\s+def|def|class)\b/.test(l.texto)) break;
        const c = condicionDe(l.texto);                  // un `else:` no aporta condicion: su `if` no lo encierra
        if (c !== null) conds.push(c);
    }
    return conds;
}

/**
 * ¿El archivo maneja PowerPoint por COM? Lo abre (un string que es exactamente el ProgID, no una
 * mencion) o usa su coleccion `.Presentations` sobre una aplicacion que le llega de otro modulo.
 */
export function abrePowerPoint(fuente) {
    const { codigo, literales } = separar(fuente);
    return literales.some((l) => ES_POWERPOINT.test(l.texto.trim())) || USA_PRESENTATIONS.test(codigo);
}

/**
 * Todos los `Quit` de PowerPoint del archivo: [{ linea, receptor, falta }], con `falta` vacio si
 * lleva el resguardo. Vacio si el archivo no maneja PowerPoint.
 */
export function quitsDePowerPoint(fuente) {
    const { codigo, literales } = separar(fuente);
    if (!literales.some((l) => ES_POWERPOINT.test(l.texto.trim())) && !USA_PRESENTATIONS.test(codigo)) return [];
    const logicos = renglones(codigo);
    const idxDe = (linea) => logicos.findIndex((l) => l.linea <= linea && linea <= l.hasta);

    // variable -> donde se le asigno una aplicacion COM, y cual
    const asignaciones = [];
    for (const lit of literales) {
        const progid = lit.texto.trim();
        if (!ES_APLICACION.test(progid)) continue;
        const i = idxDe(lit.linea);
        if (i < 0) continue;
        const m = /^([A-Za-z_][\w.]*)\s*=(?!=)/.exec(logicos[i].texto);
        if (m) asignaciones.push({ variable: m[1], idx: i, esPowerPoint: ES_POWERPOINT.test(progid) });
    }
    // La ultima vez que se le asigno ALGO a la variable hasta el renglon `i`. Si no fue una aplicacion
    // COM (`app = abrir_ppt()`) no se sabe que es, y se la trata como PowerPoint. Dos ProgID en el
    // mismo renglon (`"Excel..." if x else "PowerPoint..."`): manda PowerPoint.
    const ultimaAsignacion = (variable, i) => {
        const asigna = new RegExp(`^${escapar(variable)}\\s*=(?!=)`);
        let k = i;
        while (k >= 0 && !asigna.test(logicos[k].texto)) k--;
        if (k < 0) return null;
        const com = asignaciones.filter((a) => a.variable === variable && a.idx === k);
        return { idx: k, esPowerPoint: !com.length || com.some((a) => a.esPowerPoint) };
    };

    // referencias a Quit: llamado (`ppt.Quit()`), nombrado (`(pres.Close, app.Quit)`) o por texto
    // (`getattr(x, "Quit")`). COM no distingue mayusculas: `ppt.quit()` tambien cierra.
    const referencias = [];
    logicos.forEach((l, i) => {
        for (const m of l.texto.matchAll(/([A-Za-z_][\w.]*)?\s*\.\s*Quit\b/gi)) referencias.push({ idx: i, receptor: m[1] || null });
    });
    for (const lit of literales) {
        if (lit.texto.trim().toLowerCase() !== 'quit') continue;
        const i = idxDe(lit.linea);
        if (i >= 0) referencias.push({ idx: i, receptor: null });
    }

    const hallazgos = [];
    for (const { idx, receptor } of referencias) {
        const linea = logicos[idx].linea;
        if (!receptor) {
            hallazgos.push({ linea, receptor: '?', falta: 'no se lee a que se le hace Quit: escribirlo como `<app>.Quit()` adentro del `if` del resguardo' });
            continue;
        }
        const asignada = ultimaAsignacion(receptor, idx);
        if (asignada && !asignada.esPowerPoint) continue;            // es el Quit de Excel, Word u otra aplicacion
        const desde = asignada ? asignada.idx : 0;
        const r = escapar(receptor);
        const conds = condicionesQueEncierran(logicos, idx);
        const cuentaDespues = new RegExp(`(?:(?<![\\w.])${r}\\.Presentations\\.Count\\s*==\\s*0(?![\\w.])|(?<![\\w.])0\\s*==\\s*${r}\\.Presentations\\.Count(?![\\w.]))`);
        const falta = [];

        if (!conds.some((c) => cuentaDespues.test(c))) {
            falta.push(`no esta adentro de un \`if\` que mire \`${receptor}.Presentations.Count == 0\``);
        }

        // el "antes": una variable comparada con 0 que salio de <app>.Presentations.Count ANTES de abrir la propia
        const candidatas = new Set();
        for (const c of conds) {
            for (const m of c.matchAll(/([A-Za-z_][\w.]*)\s*==\s*0(?![\w.])/g)) if (!/\.Count$/.test(m[1])) candidatas.add(m[1]);
            for (const m of c.matchAll(/(?<![\w.])0\s*==\s*([A-Za-z_][\w.]*)/g)) if (!/\.Count$/.test(m[1])) candidatas.add(m[1]);
        }
        const abre = new RegExp(`(?<![\\w.])${r}\\.Presentations\\.(?:Open\\w*|Add)\\s*\\(`);
        const primeraApertura = logicos.findIndex((l, k) => k >= desde && k <= idx && abre.test(l.texto));
        const medidas = [...candidatas].filter((v) => {
            const mide = new RegExp(`^${escapar(v)}\\s*=\\s*${r}\\.Presentations\\.Count\\s*;?$`);
            const k = logicos.findIndex((l, n) => n >= desde && n < idx && mide.test(l.texto));
            return k >= 0 && (primeraApertura < 0 || k < primeraApertura);
        });
        if (!medidas.length) {
            falta.push(`no compara con 0 una variable guardada con \`= ${receptor}.Presentations.Count\` ANTES de abrir la presentacion`);
        }

        // un `or` o un `not (` en la condicion DEL RESGUARDO lo da vuelta; en un `if` ajeno que lo encierra, no
        const comparaMedida = medidas.map((v) => new RegExp(`(?<![\\w.])${escapar(v)}\\s*==\\s*0(?![\\w.])|(?<![\\w.])0\\s*==\\s*${escapar(v)}(?![\\w.])`));
        const delResguardo = conds.filter((c) => cuentaDespues.test(c) || comparaMedida.some((re) => re.test(c)));
        if (delResguardo.some((c) => /\bor\b|\bnot\s*\(/.test(c))) {
            falta.push('la condicion del resguardo lleva `or` o `not (`: sus dos partes van unidas con `and`');
        }

        hallazgos.push({ linea, receptor, falta: falta.join('; ') });
    }
    return hallazgos.sort((a, b) => a.linea - b.linea);
}

/** Los `Quit` de PowerPoint que NO llevan el resguardo: [{ linea, receptor, falta }]. */
export function quitsSinResguardo(fuente) {
    return quitsDePowerPoint(fuente).filter((q) => q.falta);
}

/**
 * ¿El .py mata el proceso de PowerPoint? Nombra POWERPNT en un string y trae con que matarlo
 * (taskkill, Stop-Process, pskill, wmic, `.kill()`, `.terminate()`). Preguntar si esta abierto
 * (`tasklist`, `Get-Process`) no cuenta. Devuelve [{ linea, receptor, falta }].
 */
export function matanElProceso(fuente) {
    const { codigo, literales } = separar(fuente);
    const nombra = literales.find((l) => /powerpnt/i.test(l.texto));
    if (!nombra) return [];
    const mata = literales.some((l) => /taskkill|stop-process|pskill|\bwmic\b/i.test(l.texto)) || /\.\s*(?:kill|terminate)\s*\(/.test(codigo);
    if (!mata) return [];
    return [{ linea: nombra.linea, receptor: 'POWERPNT', falta: 'mata el proceso POWERPNT: cierra tambien lo que Fak tenga abierto, y ahi no hay resguardo posible' }];
}

/** Todo lo que el archivo hace para cerrar PowerPoint sin resguardo: sus Quit y el proceso muerto a mano. */
export function sinResguardo(fuente) {
    return [...quitsSinResguardo(fuente), ...matanElProceso(fuente)].sort((a, b) => a.linea - b.linea);
}

/**
 * Los .py del repo, con barras `/` y relativos a `raiz`: los versionados y los nuevos sin ignorar
 * (el del 02/10 era un script recien escrito). Sale de git: respeta el .gitignore y no entra por
 * enlaces. Si git no contesta, tira: un barrido de cero archivos no puede dar verde.
 */
export function pysDelRepo(raiz) {
    const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ':(icase)*.py', ':(icase)*.pyw'],
        { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error('git ls-files no contesto en ' + raiz + ': ' + (r.stderr || r.error || ''));
    return [...new Set(r.stdout.split('\0').filter(Boolean))]
        .filter((p) => !EXCLUIDAS.some((x) => p.startsWith(x)))
        .filter((p) => fs.existsSync(path.join(raiz, p)))
        .sort();
}

/**
 * Barre el repo. Devuelve { abren: [rutas que manejan PowerPoint], quits: { ruta: cuantos Quit de
 * PowerPoint le leyo }, hallazgos: [{ archivo, linea, receptor, falta }] lo que cierra sin resguardo }.
 */
export function barrer(raiz) {
    const abren = [];
    const quits = {};
    const hallazgos = [];
    for (const rel of pysDelRepo(raiz)) {
        const fuente = fs.readFileSync(path.join(raiz, rel), 'utf8');
        if (!/powerp|presentations/i.test(fuente)) continue;
        if (abrePowerPoint(fuente)) {
            abren.push(rel);
            quits[rel] = quitsDePowerPoint(fuente).length;
        }
        for (const h of sinResguardo(fuente)) hallazgos.push({ archivo: rel, ...h });
    }
    return { abren, quits, hallazgos };
}
