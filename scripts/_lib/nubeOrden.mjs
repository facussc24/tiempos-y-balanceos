/**
 * nubeOrden.mjs — logica de la tanda 7 del plan del sistema (17/10/2026): el simulado de la carpeta unica
 * (`scripts/_nubeSimular.mjs`) y el mapa de la biblioteca de Ingenieria (`scripts/_nubeMapa.mjs`).
 *
 * REGLA DE LA TANDA: NADA SE MUEVE NI SE BORRA EN LA NUBE. Esta libreria no tiene ninguna funcion que escriba en la
 * nube: lee el canon (`nubeOrden.data.json`), recibe lo que midio `nubeMedir.ps1` (solo atributos, ningun archivo
 * abierto) y lo que encontro la busqueda en el repo y en `~/.claude`, y arma el texto. Lo unico que se escribe es el
 * `.md` en `exports/explicaciones/` (`rutaSalida`, con su test).
 *
 * Por que la busqueda es por TRAMO DE RUTA y no por texto suelto: «FACUNDO» como texto encuentra a Facundo Santoro y
 * a `VARIOS\FACUNDO`; lo que se rompe al mover es el codigo que arma la ruta con ese nombre entre barras o comillas.
 * Y se separa el codigo (se rompe al mover) del texto (queda desactualizado: reglas, memorias, skills).
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, existsSync, unlinkSync, rmdirSync } from 'fs';
import { join, relative, resolve, extname, basename, dirname, sep } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// dirname(fileURLToPath(...)) y no new URL('.', ...): en el entorno jsdom de vitest esa URL no es de esquema file
const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = resolve(AQUI, '..', '..');
export const CANON_RUTA = join(AQUI, 'nubeOrden.data.json');

export function cargarCanon(ruta = CANON_RUTA) {
    return JSON.parse(readFileSync(ruta, 'utf8'));
}

/** Los argumentos que no conoce frenan (leccion del 11/09: lo que escribe frena ante un argumento desconocido). */
export function leerArgs(argv, conValor = [], banderas = []) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (banderas.includes(a)) { out[a.replace(/^--/, '')] = true; continue; }
        if (conValor.includes(a)) {
            if (i + 1 >= argv.length) throw new Error(`falta el valor de ${a}`);
            out[a.replace(/^--/, '')] = argv[++i];
            continue;
        }
        throw new Error(`argumento desconocido: ${a}`);
    }
    return out;
}

/**
 * El checkout principal: desde un worktree (`<repo>\.claude\worktrees\<x>`) es `<repo>`. `exports/explicaciones/` esta
 * en .gitignore, asi que un informe escrito adentro de un worktree se pierde al borrarlo: va siempre al principal.
 */
export function raizPrincipal(raiz = RAIZ_REPO) {
    return String(raiz).replace(/[\\/]\.claude[\\/]worktrees[\\/][^\\/]+[\\/]?$/, '');
}

/**
 * Donde se escribe el informe: SOLO adentro de `exports/explicaciones/` del checkout principal. El nombre es un nombre
 * de archivo `.md` pelado (sin barras ni `..`): por la linea de comandos no entra ninguna ruta, y menos una de la
 * biblioteca.
 */
export function rutaSalida(nombreArchivo, raizRepo = raizPrincipal()) {
    const n = String(nombreArchivo ?? '');
    if (!/^[A-Za-z0-9_.-]+\.md$/.test(n) || n.includes('..')) throw new Error(`nombre de archivo no valido: «${n}» (solo un nombre .md, sin carpetas)`);
    const dir = resolve(raizRepo, 'exports', 'explicaciones');
    const r = resolve(dir, n);
    if (!r.startsWith(dir + sep)) throw new Error(`la salida tiene que quedar en exports/explicaciones: ${r}`);
    return r;
}

export function escaparRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Expresion que encuentra `nombre` como TRAMO de una ruta: antes, el principio de la linea, una barra, una comilla,
 * un parentesis, un espacio o «; despues, una barra, una comilla, un parentesis, », un punto y coma, una coma o el
 * fin. Distingue mayusculas (FACUNDO no es Facundo).
 */
export function reTramo(nombre) {
    // tambien una barra vertical o un corchete: el nombre adentro de una expresion regular (`|Claude Barack|`), que el
    // auditor del 17/10 encontro sin listar en FIRMA_EXENTOS_RE
    // 'm': un archivo entero se busca de una vez, y el nombre al final de un renglon tiene que contar
    return new RegExp(String.raw`(?:^|[\\/'"\x60(\s«=|\[\]?!])(${escaparRe(nombre)})(?=$|[\\/'"\x60)»;,|(\]$])`, 'gm');
}

/**
 * Un nombre de carpeta COMUN (una sola palabra: OBSOLETO, IATF, VARIOS, PROYECTOS, TAOS) aparece en el codigo por
 * otras razones; uno con espacios o parentesis («INGENIERIA BARACK (NUNCA BORRAR)», «Base Claude Ingenieria») no.
 * Solo al comun se le pide que el renglon lo use como ruta (auditor ronda 2: pedirselo a todos escondia nubeRutas.mjs).
 */
export function esNombreComun(nombre) {
    return !/[\s()]/.test(String(nombre));
}

/** codigo / tarea / texto, por la extension y por donde vive. */
export function clasificarArchivo(ruta, canon) {
    const r = String(ruta).replace(/\\/g, '/');
    const ext = extname(r).toLowerCase();
    // el encargo de una sesion hija (tarea «hija-*») corre una sola vez: nombra rutas, pero no se rompe nada al mover
    if (/\/\.claude\/scheduled-tasks\/hija-/.test(r)) return 'texto';
    if (/\/\.claude\/scheduled-tasks\//.test(r) || r.startsWith('schtasks:')) return 'tarea';
    if (canon.alcance_busqueda.extensiones_codigo.includes(ext)) return 'codigo';
    // un .json de canon que lee un programa (scripts/_lib/*.data.json, settings) cuenta como codigo
    if (ext === '.json' && /(^|\/)(scripts|tools|mods|hooks)\/|settings\.json$|^programa de esta PC:|^nube: /.test(r)) return 'codigo';
    return 'texto';
}

/** Un renglon de codigo que es solo un comentario: nombra la carpeta pero no la busca. */
export function esComentario(linea, ruta) {
    const t = String(linea).trim();
    if (/^(?:\/\/|\/\*|\*|<!--)/.test(t)) return true;
    if (/\.(?:py|ps1|sh)$/i.test(ruta) && t.startsWith('#')) return true;
    if (/\.(?:cmd|bat)$/i.test(ruta) && /^(?:rem\b|::)/i.test(t)) return true;
    // en un canon .json, los campos que empiezan con «_» son notas («_fuente», «_que_es»), no datos que lea un programa
    if (/\.json$/i.test(ruta) && /^"_[A-Za-z]/.test(t)) return true;
    return false;
}

/** Tapa lo que parezca una clave antes de mostrar un renglon (por si una linea con la ruta trae otra cosa). */
export function taparSecretos(linea) {
    return String(linea)
        .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '[clave tapada]')
        .replace(/\b(?:eyJ[A-Za-z0-9_-]{20,}|[A-Za-z0-9+/]{40,}={0,2})\b/g, '[dato largo tapado]');
}

/**
 * Busca `nombre` como tramo de ruta en una lista de archivos ya leidos.
 * @param {Array<{ruta:string, texto:string, origen:string}>} archivos
 * @param {string} nombre
 * @param {{excluirSiAntes?: string, canon: object, tambien?: string, exigirEnArchivo?: string}} opts — `tambien`: el
 *   archivo tiene que nombrar ademas esta otra carpeta (el padre, para las de segundo nivel); `exigirEnArchivo`: el
 *   archivo tiene que hablar de la biblioteca (para un nombre comun como FACUNDO, que tambien es un usuario del arb).
 *   En el codigo, un renglon que es solo un comentario no cuenta. Los programas de esta tanda no cuentan.
 * @returns {Array<{ruta, origen, linea, texto, categoria}>}
 */
export function buscarReferencias(archivos, nombre, opts) {
    const { canon, excluirSiAntes, tambien, exigirEnArchivo, lineaDeRuta = false, excluirLinea } = opts;
    const reExigir = exigirEnArchivo ? new RegExp(exigirEnArchivo, 'i') : null;
    const reExcluirLinea = excluirLinea ? new RegExp(excluirLinea) : null;
    const propios = new Set(canon.alcance_busqueda.excluir_archivos || []);
    const re = reTramo(nombre);
    const reAntes = excluirSiAntes ? new RegExp(excluirSiAntes) : null;
    // `tambien` puede ser una lista: la carpeta de arriba y sus otros nombres (los de antes de la cuarentena)
    const padres = [].concat(tambien || []).filter(Boolean);
    const contienePadre = (s) => padres.some((p) => { const r = reTramo(p); return r.test(s); });
    const out = [];
    for (const a of archivos) {
        if (!a.texto || !a.texto.includes(nombre) || propios.has(a.ruta)) continue;
        if (reExigir && !reExigir.test(a.texto)) continue;
        const cat = clasificarArchivo(a.ruta, canon);
        if (padres.length && !contienePadre(a.texto)) continue;
        const lineas = a.texto.split(/\r?\n/);
        for (let i = 0; i < lineas.length; i++) {
            const l = lineas[i];
            if (!l.includes(nombre)) continue;
            if (cat !== 'texto' && esComentario(l, a.ruta)) continue;
            if (reExcluirLinea && reExcluirLinea.test(l)) continue;
            re.lastIndex = 0;
            let m, vale = false;
            while ((m = re.exec(l))) {
                const ini = m.index + m[0].length - m[1].length;
                if (reAntes && reAntes.test(l.slice(0, ini))) continue;
                // un nombre comun cuenta solo usado como ruta: pegado a una barra o en el renglon de su carpeta de arriba
                if (lineaDeRuta) {
                    const pegado = /[\\/]/.test(l[ini - 1] || '') || /[\\/]/.test(l[ini + nombre.length] || '');
                    if (!pegado && !(padres.length && contienePadre(l))) continue;
                }
                vale = true; break;
            }
            if (!vale) continue;
            out.push({ ruta: a.ruta, origen: a.origen, linea: i + 1, texto: taparSecretos(l.trim()).slice(0, 160), categoria: cat });
        }
    }
    return out;
}

/** La misma busqueda para cada nombre de la carpeta (el de hoy y sus alias), sin repetir un renglon. */
export function buscarConAlias(archivos, nombres, opts) {
    const vistos = new Set();
    const out = [];
    for (const n of nombres) {
        for (const r of buscarReferencias(archivos, n, opts)) {
            const k = `${r.origen}|${r.ruta}|${r.linea}`;
            if (!vistos.has(k)) { vistos.add(k); out.push(r); }
        }
    }
    return out;
}

/**
 * En que PC corre cada programa afectado: [{ pc, fuente, programas: [{ruta, carpetas}] }]. Un programa puede correr en
 * mas de una PC (el de mails de esta PC y su copia en la de Calidad). Lo que ningun prefijo nombra no se asigna.
 */
export function porPc(items, canon) {
    return canon.pcs.map((p) => ({
        pc: p.pc,
        fuente: p.fuente,
        programas: items.filter((x) => p.prefijos.some((pre) => x.ruta.startsWith(pre))),
    }));
}

/** Agrupa las referencias por archivo: { ruta, origen, categoria, lineas:[n...] }. */
export function porArchivo(refs) {
    const m = new Map();
    for (const r of refs) {
        const k = `${r.origen}|${r.ruta}`;
        if (!m.has(k)) m.set(k, { ruta: r.ruta, origen: r.origen, categoria: r.categoria, lineas: [], ejemplo: r.texto });
        m.get(k).lineas.push(r.linea);
    }
    return [...m.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.ruta.localeCompare(b.ruta));
}

/**
 * Los programas que dependen de «Claude Fak» sin nombrarla: importan nubeRutas y llaman a buscarNube() (o usan su
 * CARPETA_EN_INGENIERIA), que devuelve esa carpeta. Los que solo usan buscarBiblioteca() no dependen de ella.
 */
export function dependientesDeNubeRutas(archivos, canon) {
    return archivos
        .filter((a) => clasificarArchivo(a.ruta, canon) === 'codigo' && /nubeRutas(?:\.mjs)?['"]/.test(a.texto || '') && /buscarNube\s*\(|CARPETA_EN_INGENIERIA/.test(a.texto || '') && !/nubeRutas\.mjs$/.test(a.ruta) && !(canon.alcance_busqueda.excluir_archivos || []).includes(a.ruta))
        .map((a) => a.ruta)
        .sort();
}

/** El plan de la carpeta unica sobre lo que hay HOY en la raiz (lista de nombres de primer nivel). */
export function planCarpetaUnica(nombresRaiz, canon, nombreUnico) {
    const destinos = new Map(canon.destinos.map((d) => [d.id, d]));
    const enRaiz = new Set(nombresRaiz);
    const filas = canon.carpetas.map((c) => {
        const d = c.destino ? destinos.get(c.destino) : null;
        return {
            nombre: c.nombre,
            existe: enRaiz.has(c.nombre),
            ya_no_esta: c.ya_no_esta || null,
            destino: d ? `${nombreUnico}\\${d.nombre}` : null,
            destino_id: c.destino,
            motivo: c.motivo,
            opciones: c.opciones || null,
            excluir_si_antes: c.excluir_si_antes || null,
            exigir_en_archivo: c.exigir_en_archivo || null,
            excluir_linea_si: c.excluir_linea_si || null,
            alias: c.alias || [],
            partes: (c.partes || []).map((p) => ({ ...p, destino: `${nombreUnico}\\${destinos.get(p.destino).nombre}\\${p.sub}` })),
        };
    });
    const conocidas = new Set(canon.carpetas.map((c) => c.nombre));
    const reNueva = new RegExp(canon.detectar_nuevas, 'i');
    const nuevas = nombresRaiz.filter((n) => !conocidas.has(n) && reNueva.test(n) && n !== nombreUnico);
    return { filas, nuevas };
}

/** LEEME propuestos: el de la raiz y uno por subcarpeta destino. Cinco renglones cada uno. */
export function leemes(canon, nombreUnico) {
    const out = [{ carpeta: nombreUnico, renglones: canon.leeme_raiz.map((l) => l.replace('{NOMBRE}', nombreUnico)) }];
    for (const d of canon.destinos) out.push({ carpeta: `${nombreUnico}\\${d.nombre}`, renglones: d.leeme });
    return out;
}

/** Tipo de una carpeta del mapa: primera regla que la nombra; si ninguna, el de su padre; si no, «sin clasificar». */
export function tipoDeCarpeta(nombre, nivel, canon, tipoPadre = null) {
    for (const t of canon.tipos) {
        if (t.nivel && t.nivel !== nivel) continue;
        if (new RegExp(t.re, 'i').test(nombre)) return { tipo: t.tipo, motivo: t.motivo, heredado: false };
    }
    if (tipoPadre && tipoPadre.tipo !== 'varios tipos (ver el segundo nivel)') return { tipo: tipoPadre.tipo, motivo: `como su carpeta de arriba`, heredado: true };
    return { tipo: 'sin clasificar', motivo: 'ninguna regla la nombra', heredado: false };
}

/**
 * Quien escribe ahi, INFERIDO (los archivos sincronizados tienen de dueño al usuario de esta PC: el atributo no dice
 * quien los hizo). Sale de cuantos archivos cambiaron en los ultimos dias, del mas nuevo, y de si un programa de la
 * casa la nombra en su codigo.
 */
export function quienEscribe(m, programas = 0, dias = 30, canon = null) {
    if (!m) return 'sin dato';
    const prog = programas ? `; la nombra${programas === 1 ? '' : 'n'} ${programas} programa${programas === 1 ? '' : 's'} de la casa` : '';
    if (!m.archivos) return `nadie: solo carpetas vacías${prog}`;
    if (!m.recientes) return `nadie en ${dias} días (último cambio ${m.ultima ? m.ultima.slice(0, 10) : 'sin fecha'})${prog}`;
    const quien = quienPorNombre(m.ultimo_nombre, m.ultimo_carpeta, canon);
    const donde = m.ultimo_carpeta ? ` en ${recortar(m.ultimo_carpeta, 45)}` : '';
    // lo inferido es del archivo MAS NUEVO, no de la carpeta entera (auditor ronda 2: 2 de 466 tenian nombre de PC)
    return `${m.recientes} cambiado${m.recientes === 1 ? '' : 's'} en ${dias} días; el más nuevo, «${recortar(m.ultimo_nombre, 40)}»${donde} (${m.ultima}), parece de ${quien}${prog}`;
}

/** Quien escribe un archivo, por su nombre y su carpeta (reglas del canon); sin regla, que no se sabe. */
export function quienPorNombre(nombre, carpeta, canon) {
    const reglas = canon?.quien_por_nombre || [];
    for (const r of reglas) {
        const re = new RegExp(r.re, 'i');
        if (re.test(String(nombre ?? '')) || re.test(String(carpeta ?? ''))) return r.quien;
    }
    return canon?.quien_por_defecto || 'no se sabe por el nombre';
}

export function recortar(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

export function mb(bytes) {
    const v = Number(bytes || 0) / (1024 * 1024);
    if (v >= 1024) return `${(v / 1024).toFixed(1).replace('.', ',')} GB`;
    return `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')} MB`;
}

/**
 * La frase del espacio libre de C: antes y despues de medir, sin afirmar de mas (auditor 17/10: una corrida bajo 1 GB
 * mientras medía y la frase decia igual «nada se bajo»). El libre lo mueve cualquier programa de la PC; la prueba de que
 * la medicion no bajo nada es que no abre archivos y que «en esta PC» no sube de una corrida a otra.
 */
export function fraseEspacio(antes, despues) {
    const gb = (b) => (Number(b) / 1024 ** 3).toFixed(2).replace('.', ',');
    const dif = Number(antes) - Number(despues);
    const base = `Espacio libre en C: ${gb(antes)} GB al empezar y ${gb(despues)} GB al terminar`;
    if (dif > 200 * 1024 ** 2) return `${base}: **bajó ${gb(dif)} GB mientras se medía**. La medición no abre archivos; qué usó ese espacio no se midió. Lo que prueba que no se bajó nada de la nube es la columna «En esta PC», que no tiene por qué subir entre una corrida y otra.`;
    return `${base} (prácticamente igual). La medición mira los atributos de cada archivo y no abre ninguno: un archivo que vive solo en la nube no se baja.`;
}

export function celda(s) { return String(s ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' '); }

// ── Recoleccion (lee archivos LOCALES: el repo y ~/.claude; nunca la nube, salvo los que nubeMedir dio como locales) ──

/** Lista los archivos de texto o codigo debajo de `dir`, sin entrar a las carpetas excluidas. */
export function listarArchivos(dir, canon) {
    const exts = new Set([...canon.alcance_busqueda.extensiones_codigo, ...canon.alcance_busqueda.extensiones_texto]);
    const excl = new Set(canon.alcance_busqueda.excluir_carpetas);
    const out = [];
    const pila = [dir];
    while (pila.length) {
        const d = pila.pop();
        let ents;
        try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
        for (const e of ents) {
            const p = join(d, e.name);
            if (e.isDirectory()) { if (!excl.has(e.name)) pila.push(p); continue; }
            if (!e.isFile() || !exts.has(extname(e.name).toLowerCase())) continue;
            out.push(p);
        }
    }
    return out;
}

/** Lee los archivos del alcance: repo + ~/.claude. Devuelve [{ruta (para mostrar), texto, origen}]. */
export function recolectar(canon, { raizRepo = RAIZ_REPO, home, localAppData = process.env.LOCALAPPDATA } = {}) {
    const tope = canon.alcance_busqueda.tope_bytes;
    const out = [];
    const leer = (p, mostrar, origen) => {
        try { if (statSync(p).size > tope) return; out.push({ ruta: mostrar, texto: readFileSync(p, 'utf8'), origen }); } catch { /* ilegible: se saltea */ }
    };
    for (const d of canon.alcance_busqueda.repo) {
        for (const p of listarArchivos(join(raizRepo, d), canon)) leer(p, relative(raizRepo, p).replace(/\\/g, '/'), 'repo');
    }
    if (home) {
        for (const d of canon.alcance_busqueda.home) {
            for (const p of listarArchivos(join(home, d), canon)) leer(p, '~/' + relative(home, p).replace(/\\/g, '/'), 'esta PC');
        }
    }
    // los programas de las tareas de Windows instalados en %LOCALAPPDATA% (la tarea de mails de esta PC corre de ahi)
    if (localAppData) {
        for (const d of canon.alcance_busqueda.programas_de_esta_pc || []) {
            for (const p of listarArchivos(join(localAppData, d), canon)) leer(p, 'programa de esta PC: ' + relative(localAppData, p).replace(/\\/g, '/'), 'esta PC');
        }
    }
    return out;
}

/** Convierte la salida de `schtasks /query /v /fo csv` en «archivos» de un renglon por tarea (nombre + accion). */
export function tareasDeWindows(csv) {
    const filas = String(csv || '').split(/\r?\n/).filter(Boolean);
    const out = [];
    for (const f of filas) {
        const campos = f.match(/"([^"]*)"/g)?.map((c) => c.slice(1, -1)) || [];
        if (campos.length < 3 || /^(Nombre de host|HostName)$/i.test(campos[0])) continue;
        out.push({ ruta: `schtasks:${campos[1]}`, texto: campos.join(' | '), origen: 'tarea de Windows' });
    }
    // la misma tarea aparece una vez por disparador: queda una
    const vistos = new Set();
    return out.filter((t) => (vistos.has(t.ruta) ? false : vistos.add(t.ruta)));
}

/**
 * Suma a `archivos` los programas que viven en la nube y corren copiados en otras PC, SOLO los que `nubeMedir.ps1` dio
 * como bajados en esta PC (local = true): uno solo-nube no se abre, para no bajarlo. Devuelve los que quedaron sin leer.
 */
export function sumarCopiasDeLaNube(archivos, bib, leibles, canon) {
    const noLeidos = [];
    for (const l of leibles || []) {
        if (!l.local) { noLeidos.push(l.ruta); continue; }
        if (l.bytes > canon.copias_en_la_nube.tope_bytes) continue;
        try { archivos.push({ ruta: `nube: ${l.ruta.replace(/\\/g, '/')}`, texto: readFileSync(join(bib, l.ruta), 'utf8'), origen: 'copia en la nube' }); } catch { noLeidos.push(l.ruta); }
    }
    return noLeidos;
}

/** Las tareas de Windows de esta PC, como «archivos» de un renglon (vacio si schtasks no contesta). */
export function leerTareasDeWindows() {
    const st = spawnSync('schtasks', ['/query', '/v', '/fo', 'csv'], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    return tareasDeWindows(st.stdout || '');
}

/**
 * Corre `nubeMedir.ps1` (solo atributos) y devuelve su JSON. La raiz y los nombres viajan en un archivo temporal,
 * no por la linea de comandos (las tildes de «Ingeniería» en un argumento de powershell.exe son una trampa conocida).
 */
export function medirPorAtributos(raiz, carpetas, { topeSeg = 120, dias = 30, leibles = null } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'nubeMedir-'));
    const entrada = join(dir, 'entrada.json');
    const salida = join(dir, 'salida.json');
    writeFileSync(entrada, JSON.stringify({ raiz, carpetas, tope_seg: topeSeg, dias_recientes: dias, leibles }), 'utf8');
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(AQUI, 'nubeMedir.ps1'), '-Entrada', entrada, '-Salida', salida], { encoding: 'utf8', timeout: (topeSeg * carpetas.length + 300) * 1000, windowsHide: true });
    if (r.status !== 0 || !existsSync(salida)) throw new Error(`nubeMedir.ps1 no termino (estado ${r.status}): ${(r.stderr || r.error || '').toString().slice(0, 300)}`);
    const out = JSON.parse(readFileSync(salida, 'utf8').replace(/^﻿/, ''));
    for (const f of [entrada, salida]) { try { unlinkSync(f); } catch { /* temporal */ } }
    try { rmdirSync(dir); } catch { /* temporal */ }
    // ConvertTo-Json devuelve un objeto suelto cuando la lista tiene uno solo
    out.carpetas = [].concat(out.carpetas || []);
    out.leibles = [].concat(out.leibles || []);
    return out;
}

export { basename };
