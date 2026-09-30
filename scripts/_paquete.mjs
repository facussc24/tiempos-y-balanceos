/**
 * _paquete.mjs — la base de Claude de Ingenieria: Fak la PUBLICA en la nube y cada compañero la
 * ACTUALIZA sin que nadie le pise lo suyo (diseño acordado con Fak el 30/09/2026).
 *
 * SIN dependencias (solo modulos de Node): corre en una PC recien instalada, sin `npm install`.
 * Este script viaja dentro de la propia base, asi que NO lleva escritos los datos personales
 * de Fak: sus patrones prohibidos viven en `scripts/_lib/paquete.data.json`, que no se publica.
 *
 * USO (la carpeta `--nube` es `Base Claude Ingenieria` de la biblioteca de SharePoint sincronizada;
 * si no se pasa, se la busca por patron porque el nombre de la biblioteca lleva tilde y cambia
 * entre PCs):
 *   node scripts/_paquete.mjs --publicar [--nota "texto simple"] [--simular] [--forzar]
 *   node scripts/_paquete.mjs --ver
 *   node scripts/_paquete.mjs --actualizar [--simular] [--reponer]
 *   node scripts/_paquete.mjs --perfil "Nombre Apellido - Sector"       (una vez por PC)
 *   node scripts/_paquete.mjs --aportar <ruta> [--autor "..."] [--que "..."] [--simular]
 *   node scripts/_paquete.mjs --aportes [--autor "..."]                 (lo lee Fak)
 *   node scripts/_paquete.mjs --pendrive <carpeta> [--nota "..."]       (lo corre Fak: arma <carpeta>\Base + Instalar.*)
 *   node scripts/_paquete.mjs --donde                                   (imprime la carpeta de la nube; lo usa la sync)
 *   --nube <carpeta>  --origen <carpeta>  --destino <carpeta>  --lista <json>   (para probar)
 *
 * QUE HAY EN LA NUBE
 *   contenido\...          copia de los archivos de la lista (misma ruta relativa que en el repo)
 *   MANIFIESTO.json        sha256 y tamaño de cada archivo
 *   NOVEDADES.md           lo nuevo de cada version, arriba, en palabras simples
 *   VERSION.json           SE ESCRIBE AL FINAL y trae el hash del MANIFIESTO: si una PC ve una
 *                          version a medias (OneDrive todavia bajando) no coincide y no toca nada
 *   aportes\<autor>\...    lo que cada compañero quiso compartir (nunca dentro de `contenido`)
 *
 * REGLAS QUE ESTE SCRIPT HACE CUMPLIR (Fak, 30/09/2026)
 *   - `--actualizar` NUNCA borra nada y solo toca lo que publicamos. Si el compañero cambio un
 *     archivo nuestro, no se lo pisa: la version nueva queda al lado como `<archivo>.fak-nueva`
 *     y la lista en `.claude/paquete-pendientes.md` (su Claude se lo sugiere).
 *   - Antes de tocar nada verifica TODOS los hashes de la nube; si falta algo corta con
 *     "OneDrive todavia esta bajando" (codigo de salida 3: reintentar mas tarde, no es un error).
 *   - Lo que llega de la nube es DATO: una ruta que se sale de la carpeta, o que pisaria la
 *     configuracion, los hooks o los archivos propios del compañero, se rechaza.
 *   - `--publicar` se niega si un archivo de la lista trae datos personales, claves o rutas de
 *     memoria/cache; si importa un archivo que no esta en la lista; o si algo de la lista esta
 *     en `no_van`. `--aportar` pasa por el mismo filtro de secretos.
 *
 * Codigos de salida: 0 bien · 1 error o rechazo · 3 la nube todavia no esta completa.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

export const NOMBRE_CARPETA_NUBE = 'Base Claude Ingenieria';
export const FORMATO = 1;
export const SUFIJO_NUEVA = '.fak-nueva';
export const REL_INSTALADO = '.claude/.paquete-instalado.json';
export const REL_PENDIENTES = '.claude/paquete-pendientes.md';
export const REL_PERFIL = '.claude/perfil-equipo.json';
export const REL_LOCK = '.claude/.paquete.lock';
export const REL_RESPALDO = '.claude/_respaldo-paquete';
export const REL_LISTA = 'scripts/_lib/paquete.data.json';
/** Windows no abre rutas de 260+ caracteres. Se deja margen: otra PC tiene otro nombre de usuario. */
export const LIMITE_RUTA = 239;
export const LIMITE_MB_TOTAL = 100;
export const LIMITE_MB_ARCHIVO = 15;
export const MAX_ARCHIVOS_APORTE = 500;
export const LOCK_VENCE_MIN = 60;

/** Carpetas (y archivos sueltos de la raiz) donde puede caer algo de la nube en la PC del compañero. */
const RAICES_PERMITIDAS = ['.claude/skills/', '.claude/rules/', '.claude/commands/', '.claude/agents/', 'scripts/', 'docs/', 'tools/'];
const ARCHIVOS_RAIZ_PERMITIDOS = ['claude.equipo.md'];
/** Lo que la nube NO puede escribir nunca, aunque este dentro de una raiz permitida. */
const RUTAS_NEGADAS = [
    { re: /(^|\/)[.]env([.]|$)/i, motivo: 'es un archivo de variables de entorno (lleva claves)' },
    { re: /(^|\/)[.]git(\/|$)/i, motivo: 'es la carpeta de git' },
    { re: /^[.]claude\/settings/i, motivo: 'es la configuración de Claude Code del compañero' },
    { re: /^[.]claude\/hooks(\/|$)/i, motivo: 'son hooks: ejecutan código solos y no viajan por la nube' },
    { re: /(^|\/)[.]mcp[.]json$/i, motivo: 'es configuración de conectores' },
    { re: /(^|\/)node_modules(\/|$)/i, motivo: 'es una carpeta de dependencias instaladas' },
    { re: /[.]fak-nueva$/i, motivo: 'es un archivo interno de la sincronización' },
    { re: /^[.]claude\/(_respaldo-paquete|[.]paquete|paquete-pendientes|perfil-equipo)/i, motivo: 'es un archivo interno de la sincronización' },
];
/** Sensibles para un APORTE (ademas de las RUTAS_NEGADAS). */
const APORTE_NEGADO = [
    { re: /(^|\/)settings(\.local)?\.json$/i, motivo: 'es configuración de Claude Code (puede traer permisos o claves)' },
    { re: /\.(pem|key|pfx|p12|pst|ost|sqlite|db)$/i, motivo: 'es un archivo de claves, buzon o base de datos' },
    { re: /\.(exe|dll|msi|bat|cmd|scr|lnk)$/i, motivo: 'es un ejecutable' },
    { re: /(^|\/)(credentials?|secrets?)([.\-_]|$)/i, motivo: 'parece un archivo de credenciales' },
];

// ---------------------------------------------------------------------------------------------
// Utilidades chicas
// ---------------------------------------------------------------------------------------------

const p2 = (n) => String(n).padStart(2, '0');
export const isoLocal = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
export const fechaCorta = (d) => isoLocal(d).slice(0, 10);
export const fechaEs = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const selloCarpeta = (d) => isoLocal(d).replace('T', '_').replace(/:/g, '');

export const sha256 = (datos) => createHash('sha256').update(datos).digest('hex');
export const sha256Archivo = (p) => sha256(fs.readFileSync(p));
const aPosix = (p) => String(p).split(path.sep).join('/').replace(/\\/g, '/');
const normTexto = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);

/** Copia con las claves ordenadas a cualquier profundidad: el mismo objeto da siempre el mismo texto. */
export function ordenarClaves(v) {
    if (Array.isArray(v)) return v.map(ordenarClaves);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenarClaves(v[k])]));
    return v;
}
export const jsonCanonico = (obj) => `${JSON.stringify(ordenarClaves(obj), null, 2)}\n`;

/** Un editor de Windows puede dejar un BOM al principio: se ignora (se mira el codigo, no se escribe el caracter). */
const sinBom = (texto) => (texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto);

export function leerJson(p, porDefecto = null) {
    try { return JSON.parse(sinBom(fs.readFileSync(p, 'utf8'))); } catch { return porDefecto; }
}

/** Escribe por un temporal y renombra: nadie (ni OneDrive) ve nunca un archivo a medias. */
export function escribirAtomico(p, datos) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, datos);
    fs.renameSync(tmp, p);
}

/** Copia un archivo y comprueba que llego igual. Devuelve su sha256. */
function copiarVerificando(origen, destino, hashEsperado) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp`;
    fs.copyFileSync(origen, tmp);
    const h = sha256Archivo(tmp);
    if (hashEsperado && h !== hashEsperado) {
        try { fs.unlinkSync(tmp); } catch { /* el temporal es nuestro */ }
        throw new Error(`la copia de ${path.basename(origen)} llego distinta a lo esperado`);
    }
    fs.renameSync(tmp, destino);
    return h;
}

// ---------------------------------------------------------------------------------------------
// Rutas: que puede viajar y que no
// ---------------------------------------------------------------------------------------------

/** Una ruta relativa de la base: con "/", sin "..", sin letra de unidad, sin nombres que Windows no acepta. */
export function rutaSegura(rel) {
    if (typeof rel !== 'string' || !rel || rel.length > 400) return false;
    if (rel.includes('\\') || rel.includes('\0') || rel.includes(':') || rel.startsWith('/')) return false;
    return rel.split('/').every((s) => s !== '' && s !== '.' && s !== '..' && !/[. ]$/.test(s) && !/[<>"|?*]/.test(s));
}

/** null si esa ruta puede viajar en la base; si no, el motivo. */
export function motivoRutaNoPermitida(rel) {
    if (!rutaSegura(rel)) return 'la ruta no es segura (sale de la carpeta o tiene caracteres que Windows no acepta)';
    const min = rel.toLowerCase();
    for (const n of RUTAS_NEGADAS) if (n.re.test(min)) return n.motivo;
    if (!RAICES_PERMITIDAS.some((r) => min.startsWith(r)) && !ARCHIVOS_RAIZ_PERMITIDOS.includes(min)) {
        return 'esta fuera de las carpetas que la base puede tocar (.claude/skills, .claude/rules, .claude/commands, .claude/agents, scripts, docs, tools, CLAUDE.equipo.md)';
    }
    return null;
}

const empiezaCon = (rel, base) => { const a = rel.toLowerCase(); const b = base.toLowerCase().replace(/\/+$/, ''); return a === b || a.startsWith(`${b}/`); };

/** `.md` dentro de `.claude/` cuyo encabezado declara `hooks:` (una skill o un agente pueden ejecutar codigo solos). */
export function frontmatterConHooks(rel, texto) {
    if (!/^[.]claude\/.*[.]md$/i.test(rel)) return false;
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(texto));
    return !!m && /^\s*hooks\s*:/m.test(m[1]);
}

// ---------------------------------------------------------------------------------------------
// Filtro de datos personales y secretos (el mismo para publicar y para aportar)
// ---------------------------------------------------------------------------------------------
// Los patrones estan escritos con [.] y similares a proposito: este archivo viaja en la base y
// el filtro lo revisa a el tambien, asi que no puede contener, literal, lo que prohibe.

const GENERICOS = [
    { re: /(?<![\w.])[.]env(?!\w)/i, motivo: 'nombra un archivo de variables de entorno (lleva claves)' },
    { re: /eyJ[A-Za-z0-9_-]{15,}[.][A-Za-z0-9_-]{10,}[.]/, motivo: 'parece un token JWT (clave de acceso)' },
    { re: /sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}/, motivo: 'parece una clave de API' },
    { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: 'es una clave privada' },
    { re: /(?:password|passwd|contrase[nñ]a)\s*[:=]\s*["'][^"'\s]{4,}["']/i, motivo: 'parece una contraseña escrita en el archivo' },
    { re: /[A-Za-z]:[\\/]+Users[\\/]+(?!Public\b|Default\b|All Users\b|%|<)[^\\/\s"'<>|*?]+/i, motivo: 'trae la ruta de la carpeta personal de una PC' },
    { re: /[.]sgc-cache/i, motivo: 'nombra la carpeta de cache de documentos de la empresa' },
    { re: /[.]claude[\\/]+projects/i, motivo: 'nombra la carpeta de memoria de Claude' },
    { re: /MEMORY[.]md/, motivo: 'nombra el indice de memoria de Claude' },
    { re: /Barack-cereb[r]o|Barack-docs-loca[l]/i, motivo: 'nombra la carpeta del cerebro o de los documentos locales' },
];
/** Usuarios y nombres de PC demasiado comunes para usarlos como filtro. */
const IDENTIDADES_COMUNES = new Set(['user', 'users', 'admin', 'administrator', 'administrador', 'public', 'default', 'system', 'guest', 'owner', 'desktop', 'laptop', 'localhost']);
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/** El usuario de Windows y el nombre de la PC de quien corre esto: si aparecen en un archivo, es un dato personal. */
export function identidadLocal() {
    let usuario = '';
    try { usuario = os.userInfo().username; } catch { usuario = process.env.USERNAME || ''; }
    return { usuario, pc: process.env.COMPUTERNAME || os.hostname() };
}

/** Patrones de datos propios de quien publica (archivo de la lista, que no viaja). */
export function patronesDeLista(lista) {
    const out = [];
    for (const e of (lista && lista.prohibido_contenido) || []) {
        if (typeof e === 'string') out.push({ re: new RegExp(escapar(e), 'i'), motivo: `contiene "${e}"` });
        else if (e && e.regex) out.push({ re: new RegExp(e.regex, 'i'), motivo: e.motivo || `coincide con ${e.regex}` });
        else if (e && e.texto) out.push({ re: new RegExp(escapar(e.texto), 'i'), motivo: e.motivo || `contiene "${e.texto}"` });
    }
    return out;
}

export function patronesFiltro({ lista = null, identidad = identidadLocal() } = {}) {
    const out = [...GENERICOS, ...patronesDeLista(lista)];
    for (const nombre of [identidad && identidad.usuario, identidad && identidad.pc]) {
        if (!nombre || nombre.length < 5 || IDENTIDADES_COMUNES.has(nombre.toLowerCase())) continue;
        out.push({ re: new RegExp(`(?<![A-Za-z0-9])${escapar(nombre)}(?![A-Za-z0-9])`, 'i'), motivo: 'trae el nombre de usuario o de la PC de quien lo publica' });
    }
    return out;
}

/**
 * Busca los patrones en cada archivo. Devuelve [{ruta, linea, motivo}] (linea null en binarios).
 * Hasta 5 lineas por patron y archivo; si dos patrones caen en la misma linea se juntan sus motivos.
 */
export function revisarContenido(archivos, patrones) {
    const hallazgos = [];
    for (const [rel, abs] of archivos) {
        let buf;
        try { buf = fs.readFileSync(abs); } catch (e) { hallazgos.push({ ruta: rel, linea: null, motivo: `no se pudo leer (${e.code || e.message})` }); continue; }
        const binario = buf.includes(0);
        const texto = binario ? buf.toString('latin1') : buf.toString('utf8');
        const porLinea = new Map();
        for (const { re, motivo } of patrones) {
            const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
            let n = 0;
            for (const m of texto.matchAll(global)) {
                if (++n > 5) break;
                const linea = binario ? null : texto.slice(0, m.index).split('\n').length;
                const k = String(linea);
                const motivos = porLinea.get(k) || { linea, motivos: [] };
                if (!motivos.motivos.includes(motivo)) motivos.motivos.push(motivo);
                porLinea.set(k, motivos);
            }
        }
        for (const { linea, motivos } of porLinea.values()) hallazgos.push({ ruta: rel, linea, motivo: motivos.join(' / ') });
    }
    return hallazgos;
}

// ---------------------------------------------------------------------------------------------
// La lista: que entra
// ---------------------------------------------------------------------------------------------

export function cargarLista(rutaLista) {
    const l = leerJson(rutaLista);
    if (!l) throw new Error(`no pude leer la lista de publicacion: ${rutaLista}`);
    return l;
}

/** Errores de forma de la lista (vacio = bien). Es lo que corre tambien el test de la lista real. */
export function revisarLista(lista) {
    const errores = [];
    if (!lista || typeof lista !== 'object') return ['la lista no es un JSON valido'];
    if (!Array.isArray(lista.incluir) || lista.incluir.length === 0) errores.push('"incluir" esta vacio o no es una lista');
    const noVan = (lista.no_van || []).map((x) => (typeof x === 'string' ? x : x.ruta)).filter(Boolean);
    for (const e of lista.incluir || []) {
        const ruta = e && e.ruta;
        if (typeof ruta !== 'string') { errores.push(`una entrada de "incluir" no tiene "ruta": ${JSON.stringify(e)}`); continue; }
        const m = motivoRutaNoPermitida(ruta.replace(/\/+$/, ''));
        if (m) errores.push(`"${ruta}" no puede viajar: ${m}`);
        for (const nv of noVan) if (empiezaCon(ruta, nv) || empiezaCon(nv, ruta)) errores.push(`"${ruta}" choca con "${nv}" de la lista no_van (lo personal de Fak)`);
    }
    for (const e of lista.prohibido_contenido || []) {
        try { patronesDeLista({ prohibido_contenido: [e] }); } catch (err) { errores.push(`patron prohibido invalido ${JSON.stringify(e)}: ${err.message}`); }
    }
    return errores;
}

const excluidoPorNombre = (lista, nombre) => {
    const n = nombre.toLowerCase();
    return (lista.excluir_nombres || []).some((x) => x.toLowerCase() === n) || (lista.excluir_sufijos || []).some((s) => n.endsWith(s.toLowerCase()));
};

/**
 * Convierte la lista en archivos reales. Devuelve { archivos: Map(rel -> ruta absoluta), omitidos, errores }.
 * Una entrada que no existe es un error salvo que lleve "opcional": true.
 */
export function expandirLista(origen, lista) {
    const archivos = new Map();
    const omitidos = [];
    const errores = [];
    const recorrer = (dirAbs, dirRel) => {
        let entradas;
        try { entradas = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (e) { errores.push(`no pude leer la carpeta ${dirRel}: ${e.code || e.message}`); return; }
        entradas.sort((a, b) => (a.name < b.name ? -1 : 1));
        for (const d of entradas) {
            const rel = `${dirRel}/${d.name}`;
            if (excluidoPorNombre(lista, d.name)) { omitidos.push({ ruta: rel, motivo: 'excluido por nombre' }); continue; }
            if (d.isSymbolicLink()) { omitidos.push({ ruta: rel, motivo: 'es un enlace: no se sigue' }); continue; }
            if (d.isDirectory()) recorrer(path.join(dirAbs, d.name), rel);
            else if (d.isFile()) archivos.set(rel, path.join(dirAbs, d.name));
        }
    };
    for (const e of lista.incluir || []) {
        const rel = String(e.ruta).replace(/\/+$/, '');
        const abs = path.join(origen, ...rel.split('/'));
        let st;
        try { st = fs.lstatSync(abs); } catch { st = null; }
        if (!st) {
            if (e.opcional) omitidos.push({ ruta: rel, motivo: 'opcional y todavia no existe' });
            else errores.push(`la lista incluye "${rel}" y no existe en ${origen}`);
            continue;
        }
        if (st.isSymbolicLink()) { omitidos.push({ ruta: rel, motivo: 'es un enlace: no se sigue' }); continue; }
        if (st.isDirectory()) recorrer(abs, rel);
        else if (excluidoPorNombre(lista, path.basename(rel))) omitidos.push({ ruta: rel, motivo: 'excluido por nombre' });
        else archivos.set(rel, abs);
    }
    return { archivos: new Map([...archivos].sort((a, b) => (a[0] < b[0] ? -1 : 1))), omitidos, errores };
}

/** Importaciones relativas de los .mjs que apuntan a un archivo que NO esta en la base. */
export function importsQueFaltan(archivos) {
    const faltan = [];
    const res = [
        /(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g,
        /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
        /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
        /^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm,
    ];
    for (const [rel, abs] of archivos) {
        if (!/[.](mjs|js)$/i.test(rel)) continue;
        let texto;
        try { texto = fs.readFileSync(abs, 'utf8'); } catch { continue; }
        for (const re of res) {
            for (const m of texto.matchAll(re)) {
                const destino = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
                const candidatos = /[.]\w+$/.test(destino) ? [destino] : [`${destino}.mjs`, `${destino}.js`, `${destino}.json`, `${destino}/index.mjs`];
                if (!candidatos.some((c) => archivos.has(c))) faltan.push({ desde: rel, hacia: destino });
            }
        }
    }
    return faltan;
}

/** Rutas de scripts/docs/tools que los .md de la base nombran y que no viajan (aviso, no frena). */
export function referenciasSueltas(archivos) {
    const vistas = new Map();
    const re = /(?<![\w/\\.-])((?:scripts|docs|tools)\/[A-Za-z0-9_./-]*[A-Za-z0-9_-][.](?:mjs|py|md|json|ps1|ts|js|pptx|xlsx|pdf))/g;
    for (const [rel, abs] of archivos) {
        if (!/[.]md$/i.test(rel)) continue;
        let texto;
        try { texto = fs.readFileSync(abs, 'utf8'); } catch { continue; }
        for (const m of texto.matchAll(re)) {
            const hacia = m[1];
            if (archivos.has(hacia)) continue;
            const v = vistas.get(hacia) || { hacia, desde: new Set() };
            v.desde.add(rel);
            vistas.set(hacia, v);
        }
    }
    return [...vistas.values()].map((v) => ({ hacia: v.hacia, desde: [...v.desde] })).sort((a, b) => b.desde.length - a.desde.length || (a.hacia < b.hacia ? -1 : 1));
}

// ---------------------------------------------------------------------------------------------
// Donde esta la nube
// ---------------------------------------------------------------------------------------------

/**
 * Carpeta `Base Claude Ingenieria` de la biblioteca de SharePoint sincronizada, o null.
 * Cuelga de `<home>\<...BARACK...>\<biblioteca>\` y el nombre de la biblioteca lleva tilde y cambia
 * entre PCs, asi que se BUSCA comparando sin tildes ni mayusculas. Se mira con statSync y no con el
 * Dirent: la carpeta de OneDrive puede ser un reparse point. No se inventa una ruta: si no esta, null.
 */
export function buscarNube(home = process.env.USERPROFILE || os.homedir()) {
    const esDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
    const listar = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
    const buscada = normTexto(NOMBRE_CARPETA_NUBE);
    const encontradas = [];
    for (const nombreRaiz of listar(home).filter((n) => /BARACK/i.test(n))) {
        const raiz = path.join(home, nombreRaiz);
        if (!esDir(raiz)) continue;
        const esOneDrivePersonal = /^OneDrive/i.test(nombreRaiz);
        for (const n of listar(raiz)) {
            const p = path.join(raiz, n);
            if (!esDir(p)) continue;
            if (normTexto(n) === buscada) { encontradas.push({ p, prioridad: 2 }); continue; }
            // la OneDrive personal es enorme: solo se mira adentro de los atajos a bibliotecas
            if (esOneDrivePersonal && !/^documents -|ingenier/.test(normTexto(n))) continue;
            for (const m of listar(p)) {
                if (normTexto(m) === buscada && esDir(path.join(p, m))) encontradas.push({ p: path.join(p, m), prioridad: /ingenier/.test(normTexto(n)) ? 0 : 1 });
            }
        }
    }
    encontradas.sort((a, b) => a.prioridad - b.prioridad);
    return encontradas.length ? encontradas[0].p : null;
}

// ---------------------------------------------------------------------------------------------
// Leer lo publicado y comprobarlo
// ---------------------------------------------------------------------------------------------

/**
 * Lectura barata de la publicacion: VERSION.json + MANIFIESTO.json coherentes entre si.
 * estado: 'ok' | 'sin_version' | 'version_ilegible' | 'sin_manifiesto' | 'manifiesto_distinto' | 'manifiesto_invalido'
 * Los cuatro del medio significan "todavia no esta completa" (esperar); 'manifiesto_invalido' es un problema real.
 */
export function leerPublicacion(nube) {
    const pVersion = path.join(nube, 'VERSION.json');
    if (!fs.existsSync(pVersion)) return { estado: 'sin_version', mensaje: 'todavía no hay una versión completa publicada (falta VERSION.json)' };
    const version = leerJson(pVersion);
    if (!version || !Number.isInteger(version.version) || typeof version.manifest_sha256 !== 'string') {
        return { estado: 'version_ilegible', mensaje: 'VERSION.json está a medias o es ilegible' };
    }
    const pManifiesto = path.join(nube, 'MANIFIESTO.json');
    let bytes;
    try { bytes = fs.readFileSync(pManifiesto); } catch { return { estado: 'sin_manifiesto', version: version.version, mensaje: 'falta MANIFIESTO.json' }; }
    if (sha256(bytes) !== version.manifest_sha256) {
        return { estado: 'manifiesto_distinto', version: version.version, mensaje: 'MANIFIESTO.json no coincide con VERSION.json (la publicación se está subiendo)' };
    }
    let manifiesto;
    try { manifiesto = JSON.parse(sinBom(bytes.toString('utf8'))); } catch { return { estado: 'manifiesto_invalido', version: version.version, mensaje: 'MANIFIESTO.json no es un JSON valido' }; }
    const problemas = [];
    if (!manifiesto || typeof manifiesto.archivos !== 'object' || manifiesto.archivos === null) problemas.push('el manifiesto no tiene "archivos"');
    else {
        for (const [rel, e] of Object.entries(manifiesto.archivos)) {
            const m = motivoRutaNoPermitida(rel);
            if (m) problemas.push(`${rel}: ${m}`);
            else if (!e || typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256) || !Number.isInteger(e.bytes)) problemas.push(`${rel}: hash o tamaño invalido`);
        }
    }
    if (problemas.length) return { estado: 'manifiesto_invalido', version: version.version, mensaje: 'el manifiesto trae rutas o datos que no se aceptan', problemas };
    return { estado: 'ok', version: version.version, fecha: version.fecha, manifiesto, manifiestoSha: version.manifest_sha256, info: version };
}

/** Comprueba en la nube que cada archivo del manifiesto esta y es igual (por tamaño y sha256). */
export function verificarContenido(nube, manifiesto, subconjunto = null) {
    const faltan = [];
    const distintos = [];
    for (const [rel, e] of Object.entries(manifiesto.archivos)) {
        if (subconjunto && !subconjunto.has(rel)) continue;
        const abs = path.join(nube, 'contenido', ...rel.split('/'));
        let st;
        try { st = fs.statSync(abs); } catch { faltan.push(rel); continue; }
        if (!st.isFile() || st.size !== e.bytes) { distintos.push(rel); continue; }
        let h;
        try { h = sha256Archivo(abs); } catch { faltan.push(rel); continue; }
        if (h !== e.sha256) distintos.push(rel);
    }
    return { ok: faltan.length === 0 && distintos.length === 0, faltan, distintos };
}

const MSJ_BAJANDO = 'OneDrive todavía está bajando la base. No se tocó nada; probá de nuevo en un rato.';

// ---------------------------------------------------------------------------------------------
// NOVEDADES.md
// ---------------------------------------------------------------------------------------------

const ENCABEZADO_NOVEDADES = '# Novedades de la base de Claude de Ingeniería\n\nLo más nuevo va arriba. Lo arma `node scripts/_paquete.mjs --publicar`.\n';

/** Como se llama una ruta en palabras de planta: { grupo, nombre }. */
export function describirRuta(rel) {
    let m;
    if ((m = /^[.]claude\/skills\/([^/]+)\//.exec(rel))) return { grupo: 'skill', nombre: m[1] };
    if ((m = /^[.]claude\/rules\/([^/]+?)([.]md)?$/.exec(rel))) return { grupo: 'regla', nombre: m[1] };
    if ((m = /^[.]claude\/commands\/([^/]+?)([.]md)?$/.exec(rel))) return { grupo: 'comando', nombre: m[1] };
    if ((m = /^[.]claude\/agents\/([^/]+?)([.]md)?$/.exec(rel))) return { grupo: 'agente', nombre: m[1] };
    if (/^scripts\//.test(rel)) return { grupo: 'script', nombre: rel.replace(/^scripts\//, '') };
    return { grupo: 'otro', nombre: rel };
}
const TITULOS = { skill: 'Skills', regla: 'Reglas', comando: 'Comandos', agente: 'Agentes', script: 'Scripts', otro: 'Otros archivos' };

export function armarEntradaNovedades({ version, fecha, nuevos, cambiados, retirados, notas, previosPorSkill }) {
    const L = [`## Versión ${version} - ${fechaEs(fecha)}`, ''];
    for (const n of notas || []) L.push(`- ${n}`);
    if ((notas || []).length) L.push('');
    const grupos = {};   // grupo -> Map(nombre -> 'nuevo' | 'cambiado')
    const marcar = (rels, cambio) => {
        for (const rel of rels) {
            const { grupo, nombre } = describirRuta(rel);
            const m = (grupos[grupo] ||= new Map());
            // una skill es "nueva" si ninguno de sus archivos estaba publicado; un archivo nuevo en una skill que ya estaba es "actualizada"
            const estado = grupo === 'skill' ? (previosPorSkill.has(nombre) ? 'cambiado' : 'nuevo') : cambio;
            if (m.get(nombre) !== 'nuevo') m.set(nombre, estado);
        }
    };
    marcar(nuevos, 'nuevo');
    marcar(cambiados, 'cambiado');
    for (const g of Object.keys(TITULOS)) {
        if (!grupos[g]) continue;
        const fem = g === 'skill' || g === 'regla';
        L.push(`**${TITULOS[g]}**`);
        for (const [nombre, estado] of grupos[g]) {
            L.push(`- ${nombre} (${estado === 'nuevo' ? (fem ? 'nueva' : 'nuevo') : (fem ? 'actualizada' : 'actualizado')})`);
        }
        L.push('');
    }
    if (retirados.length) {
        L.push('**Sacado de la base** (en tu PC sigue como está; si no lo usás, lo podés borrar)');
        for (const r of retirados) L.push(`- ${r}`);
        L.push('');
    }
    if (!nuevos.length && !cambiados.length && !retirados.length && !(notas || []).length) L.push('- Republicada sin cambios de contenido.', '');
    return L.join(String.fromCharCode(10));
}

/** Pone la entrada nueva arriba de las anteriores, debajo del encabezado. */
export function insertarNovedades(previo, entrada) {
    const base = previo && previo.trim() ? previo.replace(/\r\n/g, '\n') : ENCABEZADO_NOVEDADES;
    const i = base.search(/^## Versi[oó]n /m);
    if (i === -1) return `${base.trimEnd()}\n\n${entrada.trimEnd()}\n`;
    return `${base.slice(0, i)}${entrada.trimEnd()}\n\n${base.slice(i)}`;
}

/** Entradas de NOVEDADES.md con version mayor a `desde`. */
export function novedadesDesde(texto, desde) {
    const bloques = String(texto || '').replace(/\r\n/g, '\n').split(/^(?=## Versi[oó]n )/m).filter((b) => /^## Versi[oó]n /.test(b));
    return bloques.map((b) => ({ version: Number(/^## Versi[oó]n (\d+)/.exec(b)[1]), texto: b.trimEnd() })).filter((b) => b.version > desde);
}

// ---------------------------------------------------------------------------------------------
// PUBLICAR
// ---------------------------------------------------------------------------------------------

/**
 * @returns {{estado:'publicado'|'sin_novedades'|'simulado'|'rechazado', version?:number, errores:string[], avisos:string[], ...}}
 * No escribe NADA si hay un solo error. La nube se escribe en este orden: contenido, MANIFIESTO,
 * NOVEDADES y, al final, VERSION.json.
 */
export function publicar({ origen, nube, lista, notas = [], simular = false, forzar = false, ahora = new Date(), identidad = identidadLocal() }) {
    const res = { estado: 'rechazado', errores: [], avisos: [], nuevos: [], cambiados: [], retirados: [], sobrantes: [], omitidos: [] };
    if (fs.existsSync(path.join(origen, REL_INSTALADO))) {
        res.errores.push('esta PC recibe la base (tiene .claude/.paquete-instalado.json): solo la PC de origen publica');
        return res;
    }
    if (!nube) { res.errores.push(`no encuentro la carpeta "${NOMBRE_CARPETA_NUBE}" en la biblioteca sincronizada. Creala una vez en la biblioteca de SharePoint o pasá --nube <carpeta>`); return res; }
    if (!fs.existsSync(nube)) { res.errores.push(`la carpeta de la nube no existe: ${nube}`); return res; }

    res.errores.push(...revisarLista(lista));
    const { archivos, omitidos, errores: erroresLista } = expandirLista(origen, lista);
    res.omitidos = omitidos;
    res.errores.push(...erroresLista);
    if (res.errores.length) return res;
    if (archivos.size === 0) { res.errores.push('la lista no trajo ningun archivo'); return res; }

    // --- revision de cada archivo (todo se junta: Fak ve todos los problemas de una vez)
    let total = 0;
    const hashes = new Map();
    for (const [rel, abs] of archivos) {
        const motivo = motivoRutaNoPermitida(rel);
        if (motivo) res.errores.push(`${rel}: ${motivo}`);
        const largo = path.join(nube, 'contenido', ...rel.split('/')).length;
        if (largo > LIMITE_RUTA) res.errores.push(`${rel}: en la nube la ruta mide ${largo} caracteres (tope ${LIMITE_RUTA}): Windows no la abriria. Acortar el nombre`);
        const st = fs.statSync(abs);
        total += st.size;
        if (st.size > LIMITE_MB_ARCHIVO * 1024 * 1024) res.errores.push(`${rel}: pesa ${(st.size / 1048576).toFixed(1)} MB (tope ${LIMITE_MB_ARCHIVO} MB)`);
        const buf = fs.readFileSync(abs);
        hashes.set(rel, { sha256: sha256(buf), bytes: buf.length });
        if (frontmatterConHooks(rel, buf.toString('utf8'))) res.errores.push(`${rel}: el encabezado declara "hooks:" (ejecutaria codigo solo en la PC del compañero)`);
    }
    if (total > LIMITE_MB_TOTAL * 1024 * 1024) res.errores.push(`la lista pesa ${(total / 1048576).toFixed(1)} MB (tope ${LIMITE_MB_TOTAL} MB)`);
    for (const h of revisarContenido(archivos, patronesFiltro({ lista, identidad }))) {
        res.errores.push(`${h.ruta}${h.linea ? `:${h.linea}` : ''}: ${h.motivo}`);
    }
    for (const f of importsQueFaltan(archivos)) res.errores.push(`${f.desde} importa ${f.hacia}, que no esta en la lista`);
    if (res.errores.length) return res;

    for (const r of referenciasSueltas(archivos)) res.avisos.push(`${r.hacia} lo nombran ${r.desde.length} archivo(s) de la base (ej. ${r.desde[0]}) y no viaja`);

    // --- que cambio respecto de lo ya publicado
    const previa = leerJson(path.join(nube, 'MANIFIESTO.json'));
    const previos = (previa && previa.archivos) || {};
    const pub = leerPublicacion(nube);
    const versionPrevia = pub.version || (previa && Number.isInteger(previa.version) ? previa.version : 0);
    for (const [rel, h] of hashes) {
        if (!previos[rel]) res.nuevos.push(rel);
        else if (previos[rel].sha256 !== h.sha256) res.cambiados.push(rel);
    }
    res.retirados = Object.keys(previos).filter((r) => !hashes.has(r)).sort();
    const sinCambios = !res.nuevos.length && !res.cambiados.length && !res.retirados.length;
    if (sinCambios && pub.estado === 'ok' && verificarContenido(nube, pub.manifiesto).ok && !forzar) {
        res.estado = 'sin_novedades';
        res.version = versionPrevia;
        return res;
    }
    res.version = versionPrevia + 1;
    const contenidoNube = path.join(nube, 'contenido');
    if (fs.existsSync(contenidoNube)) {
        const enNube = [];
        const rec = (d, r) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rr = r ? `${r}/${e.name}` : e.name; if (e.isDirectory()) rec(path.join(d, e.name), rr); else enNube.push(rr); } };
        rec(contenidoNube, '');
        res.sobrantes = enNube.filter((r) => !hashes.has(r) && !r.endsWith('.tmp')).sort();
    }
    if (simular) { res.estado = 'simulado'; return res; }

    // --- escribir: contenido -> manifiesto -> novedades -> VERSION (al final)
    try {
        for (const [rel, abs] of archivos) {
            const dest = path.join(contenidoNube, ...rel.split('/'));
            let igual = false;
            try { igual = fs.statSync(dest).size === hashes.get(rel).bytes && sha256Archivo(dest) === hashes.get(rel).sha256; } catch { igual = false; }
            if (!igual) copiarVerificando(abs, dest, hashes.get(rel).sha256);
        }
        const manifiesto = { formato: FORMATO, version: res.version, generado: isoLocal(ahora), archivos: Object.fromEntries(hashes) };
        const textoManifiesto = jsonCanonico(manifiesto);
        escribirAtomico(path.join(nube, 'MANIFIESTO.json'), textoManifiesto);

        const previosPorSkill = new Set(Object.keys(previos).map((r) => describirRuta(r)).filter((d) => d.grupo === 'skill').map((d) => d.nombre));
        const entrada = armarEntradaNovedades({ version: res.version, fecha: ahora, nuevos: res.nuevos, cambiados: res.cambiados, retirados: res.retirados, notas, previosPorSkill });
        let previo = '';
        try { previo = fs.readFileSync(path.join(nube, 'NOVEDADES.md'), 'utf8'); } catch { previo = ''; }
        escribirAtomico(path.join(nube, 'NOVEDADES.md'), insertarNovedades(previo, entrada));

        const version = { formato: FORMATO, version: res.version, fecha: isoLocal(ahora), archivos: hashes.size, bytes: total, manifest_sha256: sha256(textoManifiesto) };
        escribirAtomico(path.join(nube, 'VERSION.json'), jsonCanonico(version));
    } catch (e) {
        res.errores.push(`se cortó la publicación: ${e.message}. VERSION.json no se actualizó, así que nadie recibe una versión a medias; volvé a correr --publicar`);
        res.estado = 'rechazado';
        return res;
    }
    // --- control final: lo que quedo en la nube tiene que verificar con el mismo codigo que usa el receptor
    const despues = leerPublicacion(nube);
    if (despues.estado !== 'ok' || !verificarContenido(nube, despues.manifiesto).ok) {
        res.errores.push('la nube quedo inconsistente despues de publicar (no coincide con lo escrito)');
        res.estado = 'rechazado';
        return res;
    }
    res.estado = 'publicado';
    res.bytes = total;
    res.archivos = hashes.size;
    return res;
}

// ---------------------------------------------------------------------------------------------
// ACTUALIZAR (lado del compañero)
// ---------------------------------------------------------------------------------------------

export function leerInstalado(destino) {
    return leerJson(path.join(destino, ...REL_INSTALADO.split('/')), null);
}

/** Decide que hacer con UN archivo. Es el corazon de "nunca pisar lo del compañero". */
export function decidirArchivo({ nuevoHash, localHash, instaladoHash, reponer = false }) {
    if (localHash === nuevoHash) return 'igual';                 // ya esta como lo publicamos
    if (instaladoHash === nuevoHash) {                           // lo nuestro no cambio desde la ultima vez
        if (localHash === null) return reponer ? 'nuevo' : 'sacado';   // el compañero lo saco: se respeta
        return 'propio';                                         // lo modifico el compañero y no hay nada nuevo de Fak
    }
    if (localHash === null) return instaladoHash === undefined ? 'nuevo' : (reponer ? 'nuevo' : 'sacado');
    if (instaladoHash !== undefined && localHash === instaladoHash) return 'actualizar';   // sin tocar: se reemplaza (con respaldo)
    return 'tocado';                                             // cambio el compañero (o ya habia algo suyo): al lado, como .fak-nueva
}

export const TEXTO_SIN_PENDIENTES = '# Sin cambios pendientes de la base de Ingeniería\n\nTodo lo que publicó Fak está aplicado. Este archivo se rehace solo.\n';

export function armarPendientes({ version, fecha, tocados, sacados, retirados }) {
    if (!tocados.length && !sacados.length && !retirados.length) return null;
    const L = [
        '# Cambios de la base de Ingeniería que esperan tu OK',
        '',
        `Lo arma la sincronización (versión ${version}, publicada el ${fechaEs(fecha)}). No lo edites: se rehace solo.`,
        '',
        'Para Claude: al empezar una sesión en este proyecto, si hay pendientes, avisale a la persona en una línea por archivo:',
        '"Por la sincronización de hoy te conviene cambiar <archivo>, ¿lo aplico?". Compará el archivo de la persona con su `.fak-nueva`,',
        'explicale simple qué cambia y aplicá solo lo que ella acepte. Si lo aplica, el `.fak-nueva` ya no hace falta (se borra con su OK).',
        'Nada de esto se aplica solo: la sincronización nunca pisa ni borra lo que la persona cambió o agregó.',
        '',
    ];
    if (tocados.length) {
        L.push('## Tienen una versión nueva de Fak (tu archivo quedó como estaba)', '');
        for (const t of tocados) L.push(`- \`${t}\`  ->  la nueva está en \`${t}${SUFIJO_NUEVA}\``);
        L.push('');
    }
    if (sacados.length) {
        L.push('## Los sacaste vos (no se volvieron a poner)', '');
        for (const s of sacados) L.push(`- \`${s}\``);
        L.push('', 'Si querés alguno de vuelta: `node scripts/_paquete.mjs --actualizar --reponer`.', '');
    }
    if (retirados.length) {
        L.push('## Fak dejó de publicarlos (siguen en tu PC)', '');
        for (const r of retirados) L.push(`- \`${r}\``);
        L.push('');
    }
    return L.join('\n');
}

function tomarLock(destino, ahora) {
    const p = path.join(destino, ...REL_LOCK.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    for (let intento = 0; intento < 2; intento++) {
        try {
            const fd = fs.openSync(p, 'wx');
            fs.writeSync(fd, `${process.pid} ${isoLocal(ahora)}\n`);
            fs.closeSync(fd);
            return () => { try { fs.unlinkSync(p); } catch { /* ya no esta */ } };
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
            let viejo = false;
            try { viejo = Date.now() - fs.statSync(p).mtimeMs > LOCK_VENCE_MIN * 60000; } catch { viejo = false; }
            if (!viejo) return null;
            try { fs.unlinkSync(p); } catch { return null; }
        }
    }
    return null;
}

/**
 * @returns {{estado:'actualizado'|'al_dia'|'esperar'|'error'|'ocupado'|'simulado', ...}}
 * Nunca borra. Antes de tocar nada verifica la nube completa.
 */
export function actualizar({ destino, nube, reponer = false, simular = false, ahora = new Date() }) {
    const res = { estado: 'error', errores: [], contadores: { nuevos: 0, actualizados: 0, iguales: 0, tocados: 0, sacados: 0, propios: 0 }, tocados: [], sacados: [], retirados: [], plan: [] };
    if (!nube || !fs.existsSync(nube)) { res.errores.push(`no encuentro la carpeta "${NOMBRE_CARPETA_NUBE}" (¿OneDrive ya sincronizo la biblioteca?)`); return res; }
    const instalado = leerInstalado(destino);
    if (!instalado && fs.existsSync(path.join(destino, ...REL_LISTA.split('/')))) {
        res.errores.push('esta es la PC de origen de la base (tiene la lista de publicacion): no se actualiza desde la nube. Para probar usa --destino <otra carpeta>');
        return res;
    }

    const pub = leerPublicacion(nube);
    if (pub.estado === 'manifiesto_invalido') { res.errores.push(`${pub.mensaje}: ${(pub.problemas || []).slice(0, 5).join(' | ')}`); return res; }
    if (pub.estado !== 'ok') { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (${pub.mensaje})`; return res; }
    res.version = pub.version;
    const man = pub.manifiesto.archivos;
    const inst = (instalado && instalado.archivos) || {};
    const versionNueva = !instalado || instalado.version !== pub.version || instalado.manifest_sha256 !== pub.manifiestoSha;

    // --- plan: solo mira el disco local y el manifiesto
    const aInstalar = [];   // { rel, modo: 'nuevo'|'actualizar'|'tocado' }
    const nuevoRecord = { ...inst };
    for (const [rel, e] of Object.entries(man)) {
        const abs = path.join(destino, ...rel.split('/'));
        let localHash = null;
        try { localHash = fs.statSync(abs).isFile() ? sha256Archivo(abs) : null; } catch { localHash = null; }
        const que = decidirArchivo({ nuevoHash: e.sha256, localHash, instaladoHash: inst[rel], reponer });
        res.plan.push({ rel, que });
        if (que === 'igual') { res.contadores.iguales++; nuevoRecord[rel] = e.sha256; }
        else if (que === 'propio') res.contadores.propios++;
        else if (que === 'sacado') { res.contadores.sacados++; res.sacados.push(rel); }
        else if (que === 'nuevo') { res.contadores.nuevos++; aInstalar.push({ rel, modo: 'nuevo' }); }
        else if (que === 'actualizar') { res.contadores.actualizados++; aInstalar.push({ rel, modo: 'actualizar' }); }
        else if (que === 'tocado') {
            res.contadores.tocados++;
            res.tocados.push(rel);
            const nueva = `${abs}${SUFIJO_NUEVA}`;
            let yaEsta = false;
            try { yaEsta = sha256Archivo(nueva) === e.sha256; } catch { yaEsta = false; }
            if (!yaEsta) aInstalar.push({ rel, modo: 'tocado' });
        }
    }
    res.retirados = Object.keys(inst).filter((r) => !(r in man)).sort();
    for (const r of res.retirados) delete nuevoRecord[r];

    const pendientesTexto = armarPendientes({ version: pub.version, fecha: new Date(pub.fecha || ahora), tocados: res.tocados, sacados: res.sacados, retirados: res.retirados });
    const pPendientes = path.join(destino, ...REL_PENDIENTES.split('/'));
    let pendientesActual = null;
    try { pendientesActual = fs.readFileSync(pPendientes, 'utf8'); } catch { pendientesActual = null; }
    // sin pendientes y con el archivo de una vez anterior: se deja el texto "sin pendientes" (y se queda quieto)
    const pendientesEsperado = pendientesTexto ?? (pendientesActual === null ? null : TEXTO_SIN_PENDIENTES);
    const cambiaPendientes = pendientesEsperado !== pendientesActual;
    const hayTrabajo = aInstalar.length > 0 || versionNueva || cambiaPendientes || jsonCanonico(nuevoRecord) !== jsonCanonico(inst);
    if (!hayTrabajo) { res.estado = 'al_dia'; return res; }

    // --- seguridad de lo que se va a escribir + verificacion de la nube ANTES de tocar nada
    const necesarios = versionNueva ? null : new Set(aInstalar.map((a) => a.rel));
    const v = verificarContenido(nube, pub.manifiesto, necesarios);
    if (!v.ok) {
        res.estado = 'esperar';
        res.mensaje = `${MSJ_BAJANDO} (faltan ${v.faltan.length}, distintos ${v.distintos.length}: ${[...v.faltan, ...v.distintos].slice(0, 3).join(', ')}${v.faltan.length + v.distintos.length > 3 ? ', ...' : ''})`;
        return res;
    }
    for (const { rel } of aInstalar) {
        if (!/^[.]claude\/.*[.]md$/i.test(rel)) continue;
        if (frontmatterConHooks(rel, fs.readFileSync(path.join(nube, 'contenido', ...rel.split('/')), 'utf8'))) {
            res.errores.push(`${rel}: el encabezado declara "hooks:"; no se instala`);
        }
    }
    if (res.errores.length) return res;
    if (simular) { res.estado = 'simulado'; return res; }

    // --- escribir (con lock, respaldo de lo reemplazado y sin borrar nada)
    const soltar = tomarLock(destino, ahora);
    if (!soltar) { res.estado = 'ocupado'; res.mensaje = 'otra sincronizacion esta corriendo en esta PC'; return res; }
    try {
        const carpetaRespaldo = path.join(destino, ...REL_RESPALDO.split('/'), selloCarpeta(ahora));
        let huboRespaldo = false;
        for (const { rel, modo } of aInstalar) {
            const origenNube = path.join(nube, 'contenido', ...rel.split('/'));
            const abs = path.join(destino, ...rel.split('/'));
            const hash = man[rel].sha256;
            try {
                if (modo === 'tocado') {
                    copiarVerificando(origenNube, `${abs}${SUFIJO_NUEVA}`, hash);
                } else {
                    if (modo === 'actualizar') {
                        const resp = path.join(carpetaRespaldo, ...rel.split('/'));
                        fs.mkdirSync(path.dirname(resp), { recursive: true });
                        fs.copyFileSync(abs, resp);
                        huboRespaldo = true;
                    }
                    copiarVerificando(origenNube, abs, hash);
                    nuevoRecord[rel] = hash;
                }
            } catch (e) {
                res.errores.push(`${rel}: ${e.code || e.message}`);
                if (modo !== 'tocado') { res.contadores[modo === 'nuevo' ? 'nuevos' : 'actualizados']--; }
            }
        }
        if (huboRespaldo) { const r = leerInstalado(destino); if (r) escribirAtomico(path.join(carpetaRespaldo, '.paquete-instalado.json'), jsonCanonico(r)); }
        if (cambiaPendientes && pendientesEsperado !== null) escribirAtomico(pPendientes, pendientesEsperado);
        const historial = ((instalado && instalado.historial) || []).slice(-19);
        const nuevoInstalado = {
            formato: FORMATO, version: pub.version, manifest_sha256: pub.manifiestoSha, publicada: pub.fecha, actualizado: isoLocal(ahora),
            archivos: nuevoRecord,
            pendientes: { tocados: res.tocados, sacados: res.sacados, retirados: res.retirados },
            historial: [...historial, { fecha: isoLocal(ahora), version: pub.version, nuevos: res.contadores.nuevos, actualizados: res.contadores.actualizados, tocados: res.contadores.tocados, errores: res.errores.length }],
        };
        escribirAtomico(path.join(destino, ...REL_INSTALADO.split('/')), jsonCanonico(nuevoInstalado));
        res.respaldo = huboRespaldo ? carpetaRespaldo : null;
    } finally {
        soltar();
    }
    res.estado = res.errores.length ? 'error' : 'actualizado';
    return res;
}

// ---------------------------------------------------------------------------------------------
// VER
// ---------------------------------------------------------------------------------------------

export function ver({ destino, nube }) {
    const instalado = leerInstalado(destino);
    const r = { instalada: instalado ? { version: instalado.version, fecha: instalado.actualizado } : null, publicada: null, estadoNube: null, novedades: [], pendientes: null };
    if (instalado && instalado.pendientes) r.pendientes = instalado.pendientes;
    if (!nube || !fs.existsSync(nube)) { r.estadoNube = 'sin_nube'; return r; }
    const pub = leerPublicacion(nube);
    r.estadoNube = pub.estado;
    if (pub.estado === 'ok') {
        r.publicada = { version: pub.version, fecha: pub.fecha };
        let texto = '';
        try { texto = fs.readFileSync(path.join(nube, 'NOVEDADES.md'), 'utf8'); } catch { texto = ''; }
        r.novedades = novedadesDesde(texto, instalado ? instalado.version : 0);
    } else r.mensaje = pub.mensaje;
    return r;
}

// ---------------------------------------------------------------------------------------------
// APORTES (lado del compañero) y su lectura (Fak)
// ---------------------------------------------------------------------------------------------

/** "Nombre Apellido - Sector" -> { nombre, sector, carpeta } o { error }. */
export function parseAutor(texto) {
    const t = String(texto || '').replace(/\s+/g, ' ').trim();
    const i = t.lastIndexOf(' - ');
    if (i < 1) return { error: 'el autor va como "Nombre Apellido - Sector" (ej: "Federico Leonardo Lattanzi - Ingenieria")' };
    const nombre = t.slice(0, i).trim();
    const sector = t.slice(i + 3).trim();
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,58}$/u.test(nombre) || nombre.split(' ').length < 2) return { error: 'el nombre tiene que ser nombre y apellido, solo letras' };
    if (!/^[\p{L}\p{M}][\p{L}\p{M} ]{1,28}$/u.test(sector)) return { error: 'el sector tiene que ser solo letras (ej: Ingenieria, Calidad, Compras)' };
    return { nombre, sector, carpeta: `${nombre} - ${sector}` };
}

export function leerPerfil(destino) { return leerJson(path.join(destino, ...REL_PERFIL.split('/')), null); }

export function guardarPerfil({ destino, autor, ahora = new Date() }) {
    const a = parseAutor(autor);
    if (a.error) return { estado: 'error', errores: [a.error] };
    escribirAtomico(path.join(destino, ...REL_PERFIL.split('/')), jsonCanonico({ autor: a.carpeta, nombre: a.nombre, sector: a.sector, guardado: isoLocal(ahora) }));
    return { estado: 'guardado', autor: a.carpeta };
}

const nombreParaCarpeta = (s) => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-').replace(/[. ]+$/g, '').replace(/^-+|-+$/g, '').slice(0, 60) || 'aporte';

/** Descripcion automatica de un aporte: la `description` de su SKILL.md. */
function descripcionAutomatica(archivos) {
    for (const [rel, abs] of archivos) {
        if (!/(^|\/)SKILL[.]md$/i.test(rel)) continue;
        const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(abs, 'utf8'));
        const d = m && /^description:\s*(.+)$/m.exec(m[1]);
        if (d) return d[1].replace(/^["']|["']$/g, '').trim().slice(0, 300);
    }
    return null;
}

/**
 * Copia algo del compañero a `aportes\<autor>\<fecha>-<nombre>\` de la nube. Nunca escribe en
 * `contenido\`, nunca pisa un aporte anterior (si el nombre existe, agrega -2, -3...) y pasa por
 * el mismo filtro de secretos que --publicar.
 */
export function aportar({ ruta, autor, que, nube, destino, lista = null, simular = false, ahora = new Date(), identidad = identidadLocal() }) {
    const res = { estado: 'rechazado', errores: [], avisos: [] };
    if (!nube || !fs.existsSync(nube)) { res.errores.push(`no encuentro la carpeta "${NOMBRE_CARPETA_NUBE}" (¿OneDrive ya sincronizo la biblioteca?)`); return res; }
    const quien = parseAutor(autor || (leerPerfil(destino) || {}).autor);
    if (quien.error) {
        res.errores.push(autor ? quien.error : 'falta saber quien sos: preguntale a la persona su nombre y apellido y su sector y guardalo con --perfil "Nombre Apellido - Sector"');
        return res;
    }
    const origenAbs = path.resolve(ruta || '');
    let st;
    try { st = fs.lstatSync(origenAbs); } catch { st = null; }
    if (!st) { res.errores.push(`no existe lo que queres aportar: ${ruta}`); return res; }
    if (st.isSymbolicLink()) { res.errores.push('lo que queres aportar es un enlace: pasá la carpeta o el archivo real'); return res; }

    // archivos del aporte (ruta relativa adentro del aporte)
    const archivos = new Map();
    const omitidos = [];
    const sinLista = lista || {};
    const dentroDeDestino = path.relative(path.resolve(destino), origenAbs);
    const relBase = dentroDeDestino && !dentroDeDestino.startsWith('..') && !path.isAbsolute(dentroDeDestino) ? aPosix(dentroDeDestino) : null;
    const recorrer = (dirAbs, dirRel) => {
        for (const d of fs.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const rel = `${dirRel}/${d.name}`;
            if (excluidoPorNombre({ excluir_nombres: ['__pycache__', 'node_modules', '.git', 'Thumbs.db', 'desktop.ini'], excluir_sufijos: ['.pyc', '.tmp', '.log', SUFIJO_NUEVA] }, d.name)) { omitidos.push(rel); continue; }
            if (d.isSymbolicLink()) { omitidos.push(rel); continue; }
            if (d.isDirectory()) recorrer(path.join(dirAbs, d.name), rel);
            else if (d.isFile()) archivos.set(rel, path.join(dirAbs, d.name));
            if (archivos.size > MAX_ARCHIVOS_APORTE) return;
        }
    };
    const base = path.basename(origenAbs);
    if (st.isDirectory()) recorrer(origenAbs, relBase || base); else archivos.set(relBase || base, origenAbs);
    if (archivos.size === 0) { res.errores.push('no hay archivos para aportar en esa ruta'); return res; }
    if (archivos.size > MAX_ARCHIVOS_APORTE) { res.errores.push(`son mas de ${MAX_ARCHIVOS_APORTE} archivos: aporta una carpeta mas chica (una skill, un script)`); return res; }

    let total = 0;
    for (const [rel, abs] of archivos) {
        const min = rel.toLowerCase();
        for (const n of [...RUTAS_NEGADAS, ...APORTE_NEGADO]) if (n.re.test(min)) res.errores.push(`${rel}: ${n.motivo}`);
        const s = fs.statSync(abs);
        total += s.size;
        if (s.size > LIMITE_MB_ARCHIVO * 1024 * 1024) res.errores.push(`${rel}: pesa ${(s.size / 1048576).toFixed(1)} MB (tope ${LIMITE_MB_ARCHIVO} MB)`);
        if (frontmatterConHooks(rel, fs.readFileSync(abs, 'utf8'))) res.errores.push(`${rel}: el encabezado declara "hooks:" (ejecutaria codigo solo en otras PCs)`);
    }
    if (total > LIMITE_MB_TOTAL * 1024 * 1024) res.errores.push(`el aporte pesa ${(total / 1048576).toFixed(1)} MB (tope ${LIMITE_MB_TOTAL} MB)`);
    for (const h of revisarContenido(archivos, patronesFiltro({ lista: sinLista, identidad }))) res.errores.push(`${h.ruta}${h.linea ? `:${h.linea}` : ''}: ${h.motivo}`);
    const descripcion = (que && String(que).trim()) || descripcionAutomatica(archivos);
    if (!descripcion) res.errores.push('falta una frase de que es (--que "..."): el LEEME del aporte la necesita para que Fak entienda que es');
    if (res.errores.length) return res;

    // carpeta del autor (mismo nombre sin tildes ni mayusculas = misma carpeta) y carpeta del aporte sin pisar
    const aportes = path.join(nube, 'aportes');
    let carpetaAutor = quien.carpeta;
    try { const ya = fs.readdirSync(aportes).find((n) => normTexto(n) === normTexto(quien.carpeta)); if (ya) carpetaAutor = ya; } catch { /* todavia no hay aportes */ }
    const dirAutor = path.join(aportes, carpetaAutor);
    const nombreBase = `${fechaCorta(ahora)}-${nombreParaCarpeta(path.basename(origenAbs, st.isFile() ? path.extname(origenAbs) : ''))}`;
    let nombre = nombreBase;
    for (let i = 2; fs.existsSync(path.join(dirAutor, nombre)); i++) nombre = `${nombreBase}-${i}`;
    const dirAporte = path.join(dirAutor, nombre);
    for (const rel of archivos.keys()) {
        const largo = path.join(dirAporte, ...rel.split('/')).length;
        if (largo > LIMITE_RUTA) { res.errores.push(`${rel}: en la nube la ruta mide ${largo} caracteres (tope ${LIMITE_RUTA}): Windows no la abriria. Aporta desde una carpeta mas corta`); return res; }
    }
    res.autor = carpetaAutor;
    res.carpeta = dirAporte;
    res.archivos = archivos.size;
    res.omitidos = omitidos;
    if (simular) { res.estado = 'simulado'; return res; }

    try {
        for (const [rel, abs] of archivos) copiarVerificando(abs, path.join(dirAporte, ...rel.split('/')), null);
        const L = [`# ${nombre.slice(11)}`, '', `- Autor: ${carpetaAutor}`, `- Fecha: ${fechaEs(ahora)}`, `- Qué es: ${descripcion}`, `- Archivos (${archivos.size}, ${kb(total)}):`];
        for (const [rel, abs] of archivos) L.push(`  - ${rel} (${kb(fs.statSync(abs).size)})`);
        L.push('', 'Este aporte NO forma parte de la base oficial: Fak lo revisa y decide si lo incorpora.', '');
        escribirAtomico(path.join(dirAporte, 'LEEME.md'), L.join('\n'));
    } catch (e) {
        res.errores.push(`se corto el aporte: ${e.message}`);
        return res;
    }
    res.estado = 'aportado';
    return res;
}

/** Lo aportado, por autor (para Fak). */
export function listarAportes({ nube, autor = null }) {
    const aportes = path.join(nube || '', 'aportes');
    const out = [];
    let autores = [];
    try { autores = fs.readdirSync(aportes, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { return out; }
    for (const a of autores) {
        if (autor && normTexto(a) !== normTexto(autor)) continue;
        const lista = [];
        for (const d of fs.readdirSync(path.join(aportes, a), { withFileTypes: true }).filter((x) => x.isDirectory()).sort((x, y) => (x.name < y.name ? -1 : 1))) {
            let leeme = '';
            try { leeme = fs.readFileSync(path.join(aportes, a, d.name, 'LEEME.md'), 'utf8'); } catch { leeme = ''; }
            const q = /^- Qu[eé] es: (.+)$/m.exec(leeme);
            const n = /^- Archivos \((\d+)/m.exec(leeme);
            lista.push({ carpeta: d.name, queEs: q ? q[1] : '(sin LEEME)', archivos: n ? Number(n[1]) : null });
        }
        out.push({ autor: a, aportes: lista });
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// PENDRIVE: la base + el instalador, para llevarlo en mano a la PC de un compañero
// ---------------------------------------------------------------------------------------------

/** Lo que va en la RAIZ del pendrive (al lado de la carpeta `Base`). Vive en tools/paquete-equipo/. */
export const REL_INSTALADOR = 'tools/paquete-equipo';
export const ARCHIVOS_PENDRIVE = ['Instalar.cmd', 'Instalar.ps1', 'LEEME.txt'];

/**
 * Arma `<pendrive>\Base` (la misma publicacion que iria a la nube) y copia al lado los archivos de
 * instalacion. El instalador corre `_paquete.mjs --actualizar --nube <pendrive>\Base`, asi que el
 * pendrive se instala con EXACTAMENTE la misma logica que la nube (sin pisar lo que ya tenga el
 * compañero). La carpeta del pendrive tiene que existir: no se inventan unidades ni carpetas madre.
 */
export function armarPendrive({ origen, pendrive, lista, notas = [], forzar = false, ahora = new Date(), identidad = identidadLocal() }) {
    const res = { estado: 'rechazado', errores: [], avisos: [], copiados: [] };
    if (!pendrive) { res.errores.push('falta la carpeta del pendrive (--pendrive <carpeta>)'); return res; }
    res.pendrive = pendrive;
    res.base = path.join(pendrive, 'Base');
    let st;
    try { st = fs.statSync(pendrive); } catch { st = null; }
    if (!st || !st.isDirectory()) { res.errores.push(`la carpeta del pendrive no existe: ${pendrive} (¿está puesto el pendrive?)`); return res; }

    const instaladores = new Map();
    for (const n of ARCHIVOS_PENDRIVE) {
        const abs = path.join(origen, ...REL_INSTALADOR.split('/'), n);
        if (fs.existsSync(abs)) instaladores.set(`${REL_INSTALADOR}/${n}`, abs);
        else res.errores.push(`falta ${REL_INSTALADOR}/${n}`);
    }
    if (res.errores.length) return res;
    for (const h of revisarContenido(instaladores, patronesFiltro({ lista, identidad }))) res.errores.push(`${h.ruta}${h.linea ? `:${h.linea}` : ''}: ${h.motivo}`);
    if (res.errores.length) return res;

    fs.mkdirSync(res.base, { recursive: true });
    const r = publicar({ origen, nube: res.base, lista, notas, forzar, ahora, identidad });
    res.publicacion = r;
    res.avisos.push(...r.avisos);
    if (r.estado === 'rechazado') { res.errores.push(...r.errores); return res; }
    try {
        for (const [rel, abs] of instaladores) {
            copiarVerificando(abs, path.join(pendrive, path.basename(rel)), sha256Archivo(abs));
            res.copiados.push(path.basename(rel));
        }
    } catch (e) { res.errores.push(`no pude copiar los archivos de instalacion: ${e.message}`); return res; }
    res.estado = 'listo';
    return res;
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

export function parsearArgs(argv) {
    const a = { notas: [] };
    const conValor = new Set(['nube', 'origen', 'destino', 'lista', 'nota', 'autor', 'que', 'aportar', 'perfil', 'pendrive']);
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const k = argv[i].slice(2);
        if (conValor.has(k)) {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) { a.error = `--${k} necesita un valor`; break; }
            if (k === 'nota') a.notas.push(v); else a[k] = v;
            i++;
        } else a[k] = true;
    }
    return a;
}

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const say = (s = '') => console.log(s);

function imprimirLista(titulo, items, max = 12) {
    if (!items.length) return;
    say(titulo);
    for (const x of items.slice(0, max)) say(`    - ${x}`);
    if (items.length > max) say(`    ... y ${items.length - max} mas`);
}

function main() {
    const a = parsearArgs(process.argv.slice(2));
    if (a.error) { console.error(`✗ ${a.error}`); return 1; }
    const origen = path.resolve(a.origen || RAIZ);
    const destino = path.resolve(a.destino || RAIZ);
    const nube = a.nube ? path.resolve(a.nube) : buscarNube();
    const modos = ['publicar', 'actualizar', 'ver', 'aportar', 'aportes', 'perfil', 'pendrive', 'donde'].filter((k) => a[k]);
    if (modos.length !== 1) {
        say('Uso: node scripts/_paquete.mjs --publicar | --ver | --actualizar | --aportar <ruta> | --aportes | --perfil "Nombre Apellido - Sector"');
        say('     Fak: --pendrive <carpeta del pendrive> (arma Base + el instalador) · --donde (muestra la carpeta de la nube)');
        say('     opciones: --nota "texto" · --simular · --forzar · --reponer · --autor "..." · --que "..." · --nube <carpeta> · --destino <carpeta>');
        return modos.length ? 1 : 0;
    }
    const modo = modos[0];

    if (modo === 'donde') {
        if (nube && fs.existsSync(nube)) { say(nube); return 0; }
        console.error(`✗ no encuentro la carpeta "${NOMBRE_CARPETA_NUBE}" en la biblioteca sincronizada`);
        return 1;
    }

    if (modo === 'pendrive') {
        const rutaLista = path.resolve(a.lista || path.join(origen, ...REL_LISTA.split('/')));
        let lista;
        try { lista = cargarLista(rutaLista); } catch (e) { console.error(`✗ ${e.message}`); return 1; }
        const r = armarPendrive({ origen, pendrive: path.resolve(a.pendrive), lista, notas: a.notas, forzar: !!a.forzar });
        say(`Pendrive → ${r.pendrive}`);
        if (r.estado !== 'listo') {
            console.error(`\n✗ NO QUEDO LISTO (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 40)) console.error(`    - ${e}`);
            return 1;
        }
        const p = r.publicacion;
        say(`  Base: versión ${p.version} (${p.estado === 'sin_novedades' ? 'ya estaba al día' : `${p.archivos} archivos, ${kb(p.bytes)}`})`);
        say(`  Instalador: ${r.copiados.join(', ')}`);
        imprimirLista(`  Avisos (no frenan):`, r.avisos, 15);
        say('\n✓ Listo. En la PC del compañero: doble click en Instalar.cmd del pendrive.');
        return 0;
    }

    if (modo === 'publicar') {
        const rutaLista = path.resolve(a.lista || path.join(origen, ...REL_LISTA.split('/')));
        let lista;
        try { lista = cargarLista(rutaLista); } catch (e) { console.error(`✗ ${e.message}`); return 1; }
        const r = publicar({ origen, nube, lista, notas: a.notas, simular: !!a.simular, forzar: !!a.forzar });
        say(`Base de Claude → ${nube || '(sin carpeta de nube)'}`);
        if (r.estado === 'rechazado') {
            console.error(`\n✗ NO SE PUBLICO NADA (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 40)) console.error(`    - ${e}`);
            if (r.errores.length > 40) console.error(`    ... y ${r.errores.length - 40} mas`);
            return 1;
        }
        imprimirLista(`  Nuevos (${r.nuevos.length}):`, r.nuevos);
        imprimirLista(`  Cambiados (${r.cambiados.length}):`, r.cambiados);
        imprimirLista(`  Sacados de la lista (${r.retirados.length}; en la nube quedan, en las PCs tambien):`, r.retirados);
        imprimirLista(`  En la nube y fuera de la lista (no se borran):`, r.sobrantes);
        imprimirLista(`  Avisos (no frenan):`, r.avisos, 15);
        if (r.estado === 'sin_novedades') { say(`\nSin novedades: lo publicado (version ${r.version}) ya es igual a la lista. Con --forzar se republica igual.`); return 0; }
        if (r.estado === 'simulado') { say(`\nSimulado: se publicaria la version ${r.version}. No se escribio nada.`); return 0; }
        say(`\n✓ Publicada la version ${r.version}: ${r.archivos} archivos, ${kb(r.bytes)}. VERSION.json se escribio al final.`);
        return 0;
    }

    if (modo === 'actualizar') {
        const r = actualizar({ destino, nube, reponer: !!a.reponer, simular: !!a.simular });
        if (r.estado === 'esperar') { say(`⏳ ${r.mensaje}`); return 3; }
        if (r.estado === 'ocupado') { say(`⏳ ${r.mensaje}`); return 3; }
        if (r.estado === 'al_dia') { say(`Al dia: version ${r.version}.`); return 0; }
        const c = r.contadores;
        if (r.errores.length && r.estado === 'error') {
            console.error('✗ No se actualizo:');
            for (const e of r.errores.slice(0, 20)) console.error(`    - ${e}`);
            if (!c.nuevos && !c.actualizados) return 1;
        }
        say(`${r.estado === 'simulado' ? 'Simulado' : 'Actualizado'} a la version ${r.version}: ${c.nuevos} nuevos · ${c.actualizados} actualizados · ${c.iguales} iguales · ${c.propios} tuyos sin novedad de Fak`);
        imprimirLista(`  Con version nueva de Fak, pero tocaste el tuyo — quedo al lado como ${SUFIJO_NUEVA} (${r.tocados.length}):`, r.tocados);
        imprimirLista(`  Los sacaste vos (no se repusieron; --reponer los trae) (${r.sacados.length}):`, r.sacados);
        imprimirLista(`  Fak dejo de publicarlos (siguen en tu PC) (${r.retirados.length}):`, r.retirados);
        if (r.respaldo) say(`  Respaldo de lo reemplazado: ${r.respaldo}`);
        if (r.tocados.length || r.sacados.length || r.retirados.length) say(`  Detalle: ${REL_PENDIENTES}`);
        return r.errores.length ? 1 : 0;
    }

    if (modo === 'ver') {
        const r = ver({ destino, nube });
        say(r.instalada ? `Instalada en esta PC: version ${r.instalada.version} (${r.instalada.fecha})` : 'Instalada en esta PC: nada (esta PC no recibe la base, o todavia no se instalo)');
        if (r.estadoNube === 'sin_nube') say(`Nube: no encuentro la carpeta "${NOMBRE_CARPETA_NUBE}"`);
        else if (r.publicada) say(`Publicada en la nube: version ${r.publicada.version} (${r.publicada.fecha})`);
        else say(`Nube: todavia no hay una version completa (${r.mensaje})`);
        if (r.instalada && r.publicada && r.publicada.version > r.instalada.version) say(`\nFaltan ${r.publicada.version - r.instalada.version} version(es). Lo nuevo:\n`);
        for (const n of r.novedades) say(`${n.texto}\n`);
        if (r.pendientes && (r.pendientes.tocados.length || r.pendientes.sacados.length)) say(`Pendientes tuyos: ${r.pendientes.tocados.length} con ${SUFIJO_NUEVA}, ${r.pendientes.sacados.length} sacados (ver ${REL_PENDIENTES})`);
        return 0;
    }

    if (modo === 'perfil') {
        const r = guardarPerfil({ destino, autor: a.perfil });
        if (r.estado !== 'guardado') { console.error(`✗ ${r.errores.join(' ')}`); return 1; }
        say(`Perfil guardado en ${REL_PERFIL}: ${r.autor}`);
        return 0;
    }

    if (modo === 'aportar') {
        let lista = null;
        const rutaLista = path.resolve(a.lista || path.join(destino, ...REL_LISTA.split('/')));
        if (fs.existsSync(rutaLista)) lista = leerJson(rutaLista);
        const r = aportar({ ruta: a.aportar, autor: a.autor, que: a.que, nube, destino, lista, simular: !!a.simular });
        if (r.estado === 'rechazado') {
            console.error(`✗ No se aporto nada (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 30)) console.error(`    - ${e}`);
            return 1;
        }
        say(`${r.estado === 'simulado' ? 'Simulado' : '✓ Aportado'}: ${r.archivos} archivo(s) → ${r.carpeta}`);
        return 0;
    }

    if (modo === 'aportes') {
        const lista = listarAportes({ nube, autor: a.autor || null });
        if (!lista.length) { say('Todavia no hay aportes.'); return 0; }
        for (const x of lista) {
            say(`${x.autor} (${x.aportes.length})`);
            for (const ap of x.aportes) say(`    ${ap.carpeta}${ap.archivos !== null ? ` [${ap.archivos} archivo(s)]` : ''} — ${ap.queEs}`);
        }
        return 0;
    }
    return 1;
}

// Solo corre como script; importado (por el test) no hace nada.
const comoScript = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (comoScript) process.exitCode = main();
