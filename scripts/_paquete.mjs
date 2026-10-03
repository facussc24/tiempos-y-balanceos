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
 *   node scripts/_paquete.mjs --generar-clave                           (una vez, en la PC que publica: el par de claves de firma)
 *   node scripts/_paquete.mjs --publicar --rollback <N>                 (vuelve a publicar la version N como version nueva)
 *   node scripts/_paquete.mjs --chequear                                (en milisegundos: ¿hay version nueva? no copia nada)
 *   node scripts/_paquete.mjs --actualizar --area <id>                  (instala lo comun mas lo de esa area)
 *   --nube <carpeta>  --origen <carpeta>  --destino <carpeta>  --lista <json>   (para probar)
 *   --proyecto area|ingenieria  --clave <archivo>  --clave-publica <archivo>  --sin-firma
 *
 * DOS ESTRUCTURAS DE NUBE (01/10/2026). Por defecto, la de siempre; con `--proyecto area` o la
 * variable CLAUDE_AREA_NUBE, la del proyecto "un Claude por area" (tools/claude-area/CONTRATO.md):
 *   ingenieria:  <biblioteca>\Base Claude Ingenieria\            (publicado y buzon en la misma carpeta)
 *   area:        <biblioteca>\CLAUDE POR AREA\1- PUBLICADO\      (lo que bajan las PC)
 *                <biblioteca>\CLAUDE POR AREA\4- BUZON\          (lo que suben: salud\, aportes\)
 *
 * QUE HAY EN LA NUBE (en la carpeta publicada)
 *   contenido\...          copia de los archivos de la lista (misma ruta relativa que en el repo)
 *   MANIFIESTO.json        sha256, tamaño y areas de cada archivo + lapidas (lo retirado y desde cuando)
 *   MANIFIESTO.sig         firma Ed25519 del MANIFIESTO (la clave privada vive solo en la PC que publica)
 *   NOVEDADES.md           lo nuevo de cada version, arriba, en palabras simples
 *   historial\v<N>\        el manifiesto (y su firma) de cada version publicada, para volver atras
 *   historial\_objetos\    el contenido de todas las versiones, un archivo por hash (lo que no cambio no se repite)
 *   VERSION.json           SE ESCRIBE AL FINAL y trae el hash del MANIFIESTO y el de la firma: si una PC
 *                          ve una version a medias (OneDrive todavia bajando) no coincide y no toca nada
 *   aportes\<autor>\...    lo que cada compañero quiso compartir (nunca dentro de `contenido`)
 *   salud\<pc>.json        lo que cada PC cuenta de si misma al terminar --actualizar (bien o mal)
 *
 * REGLAS QUE ESTE SCRIPT HACE CUMPLIR (Fak, 30/09/2026; firma, lapidas y areas: 01/10/2026)
 *   - `--actualizar` NUNCA borra nada y solo toca lo que publicamos. Si el compañero cambio un
 *     archivo nuestro, no se lo pisa: la version nueva queda al lado como `<archivo>.fak-nueva`
 *     y la lista en `.claude/paquete-pendientes.md` (su Claude se lo sugiere).
 *   - Lo que se retira de la base (lapida) se MUEVE a `.claude/_cuarentena-paquete/<fecha>/` solo si
 *     en la PC sigue identico a lo publicado; si la persona lo cambio, se queda y se anota.
 *   - Antes de tocar nada verifica TODOS los hashes de la nube; si falta algo corta con
 *     "OneDrive todavia esta bajando" (codigo de salida 3: reintentar mas tarde, no es un error).
 *   - Si la PC tiene instalada la clave publica del publicador, EXIGE firma valida: sin firma, firma
 *     de otra clave o manifiesto tocado -> no toca nada (codigo de salida 4). En el proyecto de
 *     siempre (`ingenieria`) una PC sin clave publica se comporta como antes y lo dice; en el proyecto
 *     `area` una PC sin clave publica NO instala nada (codigo 4): tiene que poder comprobar quien publico.
 *   - La version nunca retrocede: un rollback legitimo sale como version nueva, asi que una nube con una
 *     version MENOR que la instalada es un manifiesto viejo vuelto a poner (codigo 4, nada se toca). El
 *     numero de version viaja adentro del manifiesto firmado y tiene que coincidir con VERSION.json.
 *   - Lo que llega de la nube es DATO: una ruta que se sale de la carpeta, o que pisaria la
 *     configuracion, los hooks o los archivos propios del compañero, se rechaza (tambien en lapidas
 *     y en el historial).
 *   - `--publicar` se niega si un archivo de la lista trae datos personales, claves o rutas de
 *     memoria/cache; si importa un archivo que no esta en la lista; o si algo de la lista esta
 *     en `no_van`. `--aportar` pasa por el mismo filtro de secretos.
 *
 * Codigos de salida: 0 bien · 1 error o rechazo · 3 la nube todavia no esta completa · 4 la PC no acepta lo
 * publicado (firma invalida o ausente, le falta la clave publica, o la version retrocede).
 * `--chequear`: 0 al_dia · 2 hay_novedades · 3 sin_nube o nube_incompleta · 5 sin_instalar.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

export const NOMBRE_CARPETA_NUBE = 'Base Claude Ingenieria';
/**
 * Las dos estructuras de nube. `carpeta` se busca en la biblioteca sincronizada; `publicado` y `buzon`
 * cuelgan de ella (null = la misma carpeta). No se renombra ni se mueve nada de la nube real: la de
 * `ingenieria` sigue tal cual esta instalada.
 */
export const PROYECTOS = {
    ingenieria: { carpeta: NOMBRE_CARPETA_NUBE, publicado: null, buzon: null },
    area: { carpeta: 'CLAUDE POR AREA', publicado: '1- PUBLICADO', buzon: '4- BUZON' },
};
export const PROYECTO_POR_DEFECTO = 'ingenieria';
/** Identificadores de area (tools/claude-area/CONTRATO.md). Sin `areas` en la lista = `comun`. */
export const AREAS = ['comun', 'calidad', 'ingenieria', 'logistica', 'compras', 'produccion', 'mantenimiento', 'rrhh', 'direccion'];
export const AREA_COMUN = 'comun';
export const AREA_TODAS = 'todas';
export const FORMATO = 1;
export const SUFIJO_NUEVA = '.fak-nueva';
export const REL_INSTALADO = '.claude/.paquete-instalado.json';
export const REL_PENDIENTES = '.claude/paquete-pendientes.md';
export const REL_PERFIL = '.claude/perfil-equipo.json';
export const REL_LOCK = '.claude/.paquete.lock';
export const REL_RESPALDO = '.claude/_respaldo-paquete';
export const REL_CUARENTENA = '.claude/_cuarentena-paquete';
export const REL_LISTA = 'scripts/_lib/paquete.data.json';
/** Firma del manifiesto. La clave privada NUNCA se copia al repo ni a la nube. */
export const NOMBRE_CLAVE_PRIVADA = 'publicador.key';
export const NOMBRE_CLAVE_PUBLICA = 'publicador.pub';
export const ALGORITMO_FIRMA = 'ed25519';
export const CODIGO_SALIDA_FIRMA = 4;
export const CARPETA_HISTORIAL = 'historial';
export const CARPETA_OBJETOS = '_objetos';
/** Windows no abre rutas de 260+ caracteres. Se deja margen: otra PC tiene otro nombre de usuario. */
export const LIMITE_RUTA = 239;
export const LIMITE_MB_TOTAL = 100;
export const LIMITE_MB_ARCHIVO = 15;
/** Tope de un programa declarado en `ejecutables` de la lista (el Node del plugin pesa unos 85 MB). */
export const LIMITE_MB_EJECUTABLE = 120;
export const MAX_ARCHIVOS_APORTE = 500;
export const LOCK_VENCE_MIN = 60;

/**
 * Carpetas (y archivos sueltos de la raiz) donde puede caer algo de la nube en la PC, POR PROYECTO.
 * En `area` todo lo que el asistente lee como verdad viaja firmado adentro de cuatro carpetas: el plugin
 * (`marketplace/`, el unico lugar donde pueden viajar hooks), las reglas de la casa (`casa/`), el
 * conocimiento (`conocimiento/`, con una carpeta por area) y los programas de la PC (`programas/`).
 */
const RAICES_POR_PROYECTO = {
    // en ingenieria una raiz entera ("scripts") NO es una entrada valida de la lista: se publica de a archivos o subcarpetas
    ingenieria: { carpetas: ['.claude/skills/', '.claude/rules/', '.claude/commands/', '.claude/agents/', 'scripts/', 'docs/', 'tools/'], sueltos: ['claude.equipo.md'], raizEntera: false, texto: '.claude/skills, .claude/rules, .claude/commands, .claude/agents, scripts, docs, tools, CLAUDE.equipo.md' },
    // en area las cuatro raices son justamente las unidades que se publican enteras
    area: { carpetas: ['marketplace/', 'casa/', 'conocimiento/', 'programas/'], sueltos: [], raizEntera: true, texto: 'marketplace, casa, conocimiento, programas' },
};
/** En el proyecto `area` los hooks viajan solo adentro del plugin (que llega firmado); afuera se rechazan. */
const RAIZ_HOOKS_AREA = 'marketplace/';
/** Lo que la nube NO puede escribir nunca, aunque este dentro de una raiz permitida. */
const RUTAS_NEGADAS = [
    { re: /(^|\/)[.]env([.]|$)/i, motivo: 'es un archivo de variables de entorno (lleva claves)' },
    { re: /(^|\/)[.]git(\/|$)/i, motivo: 'es la carpeta de git' },
    { re: /^[.]claude\/settings/i, motivo: 'es la configuración de Claude Code del compañero' },
    { re: /^[.]claude\/hooks(\/|$)/i, motivo: 'son hooks: ejecutan código solos y no viajan por la nube' },
    { re: /(^|\/)[.]mcp[.]json$/i, motivo: 'es configuración de conectores' },
    { re: /(^|\/)node_modules(\/|$)/i, motivo: 'es una carpeta de dependencias instaladas' },
    { re: /[.]fak-nueva$/i, motivo: 'es un archivo interno de la sincronización' },
    { re: /^[.]claude\/(_respaldo-paquete|_cuarentena-paquete|[.]paquete|paquete-pendientes|perfil-equipo)/i, motivo: 'es un archivo interno de la sincronización' },
    { re: /(^|\/)publicador[.](key|pub)$/i, motivo: 'es la clave de firma: no viaja por la nube' },
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

/** null si esa ruta puede viajar en la base de ese proyecto; si no, el motivo. */
export function motivoRutaNoPermitida(rel, proyecto = PROYECTO_POR_DEFECTO) {
    if (!rutaSegura(rel)) return 'la ruta no es segura (sale de la carpeta o tiene caracteres que Windows no acepta)';
    const min = rel.toLowerCase();
    for (const n of RUTAS_NEGADAS) if (n.re.test(min)) return n.motivo;
    const def = RAICES_POR_PROYECTO[proyecto] || RAICES_POR_PROYECTO[PROYECTO_POR_DEFECTO];
    if (!def.carpetas.some((r) => min.startsWith(r) || (def.raizEntera && min === r.slice(0, -1))) && !def.sueltos.includes(min)) {
        return `esta fuera de las carpetas que la base puede tocar (${def.texto})`;
    }
    return null;
}

const empiezaCon = (rel, base) => { const a = rel.toLowerCase(); const b = base.toLowerCase().replace(/\/+$/, ''); return a === b || a.startsWith(`${b}/`); };

/**
 * `.md` cuyo encabezado declara `hooks:` (una skill o un agente pueden ejecutar codigo solos) donde no
 * puede: en `ingenieria`, cualquier `.md` dentro de `.claude/`; en `area`, cualquier `.md` FUERA de
 * `marketplace/` (adentro del plugin los hooks son parte de lo que se firma).
 */
export function frontmatterConHooks(rel, texto, proyecto = PROYECTO_POR_DEFECTO) {
    if (!/[.]md$/i.test(rel)) return false;
    const min = rel.toLowerCase();
    if (proyecto === 'area' ? min.startsWith(RAIZ_HOOKS_AREA) : !min.startsWith('.claude/')) return false;
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
    // Auditoria 01/10/2026: lo que el filtro de arriba no veia. Una variable de entorno con el valor
    // pelado (sin comillas), las claves nuevas de Supabase y la direccion de un proyecto de Supabase.
    { re: /^[ \t]*(?:export[ \t]+)?[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ANON_KEY)[A-Z0-9_]*[ \t]*=[ \t]*(?=[A-Za-z0-9_+/=-]*[0-9])(?=[A-Za-z0-9_+/=-]*[A-Za-z])[A-Za-z0-9_+/=-]{8,}[ \t]*$/m, motivo: 'parece una clave escrita sin comillas en una variable' },
    { re: /sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/, motivo: 'parece una clave de Supabase' },
    { re: /[a-z0-9]{15,}[.]supabase[.]co(?![a-z])/i, motivo: 'trae la direccion de un proyecto de Supabase' },
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

/** Las areas de una entrada de la lista, ordenadas y sin repetir. Sin `areas` = comun. */
export function areasDeEntrada(e) {
    const a = e && Array.isArray(e.areas) ? e.areas : null;
    if (!a || a.length === 0) return [AREA_COMUN];
    return [...new Set(a.map((x) => normTexto(String(x))))].sort();
}

/** Las areas de un archivo del manifiesto (manifiestos viejos no traen `areas`: comun). */
export const areasDelArchivo = (entrada) => (entrada && Array.isArray(entrada.areas) && entrada.areas.length ? entrada.areas : [AREA_COMUN]);

/** Errores de forma de la lista (vacio = bien). Es lo que corre tambien el test de la lista real. */
export function revisarLista(lista, proyecto = PROYECTO_POR_DEFECTO) {
    const errores = [];
    if (!lista || typeof lista !== 'object') return ['la lista no es un JSON valido'];
    if (!Array.isArray(lista.incluir) || lista.incluir.length === 0) errores.push('"incluir" esta vacio o no es una lista');
    if (lista.proyecto !== undefined && lista.proyecto !== proyecto) errores.push(`esta lista es del proyecto "${lista.proyecto}" y se esta publicando el proyecto "${proyecto}"`);
    if (lista.sin_filtro_identidad !== undefined && (!Array.isArray(lista.sin_filtro_identidad) || lista.sin_filtro_identidad.some((x) => typeof x !== 'string'))) errores.push('"sin_filtro_identidad" tiene que ser una lista de rutas');
    const noVan = (lista.no_van || []).map((x) => (typeof x === 'string' ? x : x.ruta)).filter(Boolean);
    for (const e of lista.incluir || []) {
        const ruta = e && e.ruta;
        if (typeof ruta !== 'string') { errores.push(`una entrada de "incluir" no tiene "ruta": ${JSON.stringify(e)}`); continue; }
        const m = motivoRutaNoPermitida(ruta.replace(/\/+$/, ''), proyecto);
        if (m) errores.push(`"${ruta}" no puede viajar: ${m}`);
        for (const nv of noVan) if (empiezaCon(ruta, nv) || empiezaCon(nv, ruta)) errores.push(`"${ruta}" choca con "${nv}" de la lista no_van (lo personal de Fak)`);
        if (e.areas !== undefined) {
            if (!Array.isArray(e.areas) || e.areas.some((x) => typeof x !== 'string')) errores.push(`"${ruta}": "areas" tiene que ser una lista de nombres de area`);
            else for (const a of areasDeEntrada(e)) if (!AREAS.includes(a)) errores.push(`"${ruta}": el area "${a}" no existe (van: ${AREAS.join(', ')})`);
        }
    }
    for (const e of lista.prohibido_contenido || []) {
        try { patronesDeLista({ prohibido_contenido: [e] }); } catch (err) { errores.push(`patron prohibido invalido ${JSON.stringify(e)}: ${err.message}`); }
    }
    // `ejecutables`: programas de Windows que viajan firmados (el Node que usan los controles del plugin). Van por su
    // ruta EXACTA, una por una: no pasan el filtro de texto (un binario trae cadenas que parecen claves) ni el tope por
    // archivo, y a cambio se exige que sean un .exe de verdad (ver publicar()).
    if (lista.ejecutables !== undefined) {
        if (!Array.isArray(lista.ejecutables) || lista.ejecutables.some((x) => typeof x !== 'string')) errores.push('"ejecutables" tiene que ser una lista de rutas');
        else for (const r of lista.ejecutables) {
            if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*[.]exe$/.test(r) || r.includes('..') || r.includes('//')) errores.push(`"ejecutables": "${r}" tiene que ser la ruta exacta de un .exe (sin comodines ni "..")`);
            else if (!(lista.incluir || []).some((e) => e && typeof e.ruta === 'string' && empiezaCon(r, e.ruta.replace(/\/+$/, '')))) errores.push(`"ejecutables": "${r}" no está adentro de nada de "incluir"`);
        }
    }
    return errores;
}

const excluidoPorNombre = (lista, nombre) => {
    const n = nombre.toLowerCase();
    return (lista.excluir_nombres || []).some((x) => x.toLowerCase() === n) || (lista.excluir_sufijos || []).some((s) => n.endsWith(s.toLowerCase()));
};

/**
 * Convierte la lista en archivos reales. Devuelve { archivos: Map(rel -> ruta absoluta), areas: Map(rel -> [areas]), omitidos, errores }.
 * Una entrada que no existe es un error salvo que lleve "opcional": true. Si dos entradas traen el
 * mismo archivo, sus areas se juntan.
 */
export function expandirLista(origen, lista) {
    const archivos = new Map();
    const areas = new Map();
    const omitidos = [];
    const errores = [];
    const anotar = (rel, abs, areasEntrada) => {
        archivos.set(rel, abs);
        areas.set(rel, [...new Set([...(areas.get(rel) || []), ...areasEntrada])].sort());
    };
    const recorrer = (dirAbs, dirRel, areasEntrada) => {
        let entradas;
        try { entradas = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (e) { errores.push(`no pude leer la carpeta ${dirRel}: ${e.code || e.message}`); return; }
        entradas.sort((a, b) => (a.name < b.name ? -1 : 1));
        for (const d of entradas) {
            const rel = `${dirRel}/${d.name}`;
            if (excluidoPorNombre(lista, d.name)) { omitidos.push({ ruta: rel, motivo: 'excluido por nombre' }); continue; }
            if (d.isSymbolicLink()) { omitidos.push({ ruta: rel, motivo: 'es un enlace: no se sigue' }); continue; }
            if (d.isDirectory()) recorrer(path.join(dirAbs, d.name), rel, areasEntrada);
            else if (d.isFile()) anotar(rel, path.join(dirAbs, d.name), areasEntrada);
        }
    };
    for (const e of lista.incluir || []) {
        const rel = String(e.ruta).replace(/\/+$/, '');
        const abs = path.join(origen, ...rel.split('/'));
        const areasEntrada = areasDeEntrada(e);
        let st;
        try { st = fs.lstatSync(abs); } catch { st = null; }
        if (!st) {
            if (e.opcional) omitidos.push({ ruta: rel, motivo: 'opcional y todavia no existe' });
            else errores.push(`la lista incluye "${rel}" y no existe en ${origen}`);
            continue;
        }
        if (st.isSymbolicLink()) { omitidos.push({ ruta: rel, motivo: 'es un enlace: no se sigue' }); continue; }
        if (st.isDirectory()) recorrer(abs, rel, areasEntrada);
        else if (excluidoPorNombre(lista, path.basename(rel))) omitidos.push({ ruta: rel, motivo: 'excluido por nombre' });
        else anotar(rel, abs, areasEntrada);
    }
    const orden = [...archivos.keys()].sort();
    return { archivos: new Map(orden.map((r) => [r, archivos.get(r)])), areas: new Map(orden.map((r) => [r, areas.get(r)])), omitidos, errores };
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
 * Carpeta publicada de la biblioteca de SharePoint sincronizada, o null. Por defecto es
 * `Base Claude Ingenieria`; con `proyecto = 'area'` es `CLAUDE POR AREA\1- PUBLICADO` (la carpeta madre
 * tiene que existir; `1- PUBLICADO` la crea el primer --publicar, como `contenido\`).
 * Cuelga de `<home>\<...BARACK...>\<biblioteca>\` y el nombre de la biblioteca lleva tilde y cambia
 * entre PCs, asi que se BUSCA comparando sin tildes ni mayusculas. Se mira con statSync y no con el
 * Dirent: la carpeta de OneDrive puede ser un reparse point. No se inventa una ruta: si no esta, null.
 */
export function buscarNube(home = process.env.USERPROFILE || os.homedir(), proyecto = PROYECTO_POR_DEFECTO) {
    const def = PROYECTOS[proyecto];
    if (!def) return null;
    const raizProyecto = buscarCarpetaEnBiblioteca(home, def.carpeta);
    if (!raizProyecto) return null;
    return def.publicado ? path.join(raizProyecto, def.publicado) : raizProyecto;
}

/** Nombre con el que se le habla a la persona de la carpeta de la nube de ese proyecto. */
export function nombreNube(proyecto = PROYECTO_POR_DEFECTO) {
    const def = PROYECTOS[proyecto] || PROYECTOS[PROYECTO_POR_DEFECTO];
    return def.publicado ? `${def.carpeta}\\${def.publicado}` : def.carpeta;
}

/**
 * Donde escriben las PC (salud, aportes). En la estructura de areas es `4- BUZON`, hermana de
 * `1- PUBLICADO`; en la de siempre es la misma carpeta publicada. Se decide por el nombre de la
 * carpeta, asi una nube pasada con --nube se interpreta igual que una encontrada sola.
 */
export function carpetaBuzon(nube) {
    if (!nube) return null;
    const def = PROYECTOS.area;
    if (normTexto(path.basename(nube)) === normTexto(def.publicado)) return path.join(path.dirname(nube), def.buzon);
    return nube;
}

function buscarCarpetaEnBiblioteca(home, nombreCarpeta) {
    const esDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
    const listar = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
    const buscada = normTexto(nombreCarpeta);
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
// Firma del manifiesto (Ed25519, solo node:crypto)
// ---------------------------------------------------------------------------------------------
// La PC que publica firma el texto exacto de MANIFIESTO.json; cada PC que tiene instalada la clave
// publica verifica ese mismo texto. Alguien con escritura en la biblioteca puede cambiar un archivo,
// pero no puede producir una firma que la clave publica acepte. VERSION.json (que se escribe al final)
// lleva el hash de MANIFIESTO.sig: si la firma todavia no bajo por OneDrive se espera, no se rechaza.

/** Ruta por defecto de la clave privada: `<home>\.claude-area\publicador.key` (o CLAUDE_AREA_CLAVE). */
export function rutaClavePrivadaPorDefecto(env = process.env) {
    if (env.CLAUDE_AREA_CLAVE) return path.resolve(env.CLAUDE_AREA_CLAVE);
    return path.join(env.USERPROFILE || os.homedir(), '.claude-area', NOMBRE_CLAVE_PRIVADA);
}

/**
 * Donde puede estar la clave publica en la PC que actualiza (CONTRATO.md): con CLAUDE_AREA_ESTADO
 * se mira SOLO ahi (es la forma de probar sin tocar la PC); si no, la carpeta de programas (la pone
 * el instalador con administrador) y despues la del usuario. null = esta PC no exige firma.
 */
export function buscarClavePublica(env = process.env) {
    const candidatas = env.CLAUDE_AREA_ESTADO
        ? [path.join(env.CLAUDE_AREA_ESTADO, NOMBRE_CLAVE_PUBLICA)]
        : [
            env.ProgramFiles ? path.join(env.ProgramFiles, 'Claude Barack', NOMBRE_CLAVE_PUBLICA) : null,
            env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'BarackEquipo', NOMBRE_CLAVE_PUBLICA) : null,
        ].filter(Boolean);
    for (const c of candidatas) { try { if (fs.statSync(c).isFile()) return c; } catch { /* no esta */ } }
    return null;
}

/** Huella corta de una clave publica (sha256 del DER): para decir "la firma es de otra clave". */
export function huellaClave(clavePublica) {
    return sha256(clavePublica.export({ type: 'spki', format: 'der' })).slice(0, 16);
}

/**
 * Crea el par de claves si no existe. Se NIEGA a pisar una clave privada existente: si hace falta otra,
 * la persona la mueve a mano primero. Deja al lado `publicador.pub`, que es lo unico que viaja a las PC.
 */
export function generarClave({ rutaClave }) {
    const res = { estado: 'error', errores: [], avisos: [], clave: rutaClave, publica: path.join(path.dirname(rutaClave), NOMBRE_CLAVE_PUBLICA) };
    if (fs.existsSync(rutaClave)) {
        res.estado = 'existe';
        res.errores.push(`ya hay una clave privada en ${rutaClave}: no se pisa. Si de verdad querés otra, movela a mano primero (las PC que tengan la clave pública vieja van a rechazar lo que firmes con la nueva)`);
        return res;
    }
    if (fs.existsSync(res.publica)) res.avisos.push(`había un ${NOMBRE_CLAVE_PUBLICA} sin su clave privada: se reemplazó por el nuevo`);
    const { publicKey, privateKey } = generateKeyPairSync(ALGORITMO_FIRMA);
    fs.mkdirSync(path.dirname(rutaClave), { recursive: true });
    // 'wx': si entre el existsSync y aca aparecio una clave, falla en vez de pisarla
    const fd = fs.openSync(rutaClave, 'wx', 0o600);
    try { fs.writeSync(fd, privateKey.export({ type: 'pkcs8', format: 'pem' })); } finally { fs.closeSync(fd); }
    escribirAtomico(res.publica, publicKey.export({ type: 'spki', format: 'pem' }));
    res.estado = 'creada';
    res.huella = huellaClave(publicKey);
    return res;
}

/** La clave privada (KeyObject) o { error }. No se loguea ni se devuelve su contenido. */
export function leerClavePrivada(ruta) {
    let pem;
    try { pem = fs.readFileSync(ruta, 'utf8'); } catch (e) { return { error: `no pude leer la clave privada ${ruta} (${e.code || e.message})` }; }
    try {
        const k = createPrivateKey(pem);
        if (k.asymmetricKeyType !== ALGORITMO_FIRMA) return { error: `la clave privada ${ruta} no es ${ALGORITMO_FIRMA}` };
        return { clave: k };
    } catch (e) { return { error: `la clave privada ${ruta} no se entiende (${e.message})` }; }
}

/** La clave publica (KeyObject) desde una ruta o un texto PEM, o { error }. */
export function leerClavePublica(rutaOPem) {
    let pem = String(rutaOPem || '');
    if (!/^-----BEGIN /.test(pem.trimStart())) {
        try { pem = fs.readFileSync(rutaOPem, 'utf8'); } catch (e) { return { error: `no pude leer la clave pública ${rutaOPem} (${e.code || e.message})` }; }
    }
    try {
        const k = createPublicKey(pem);
        if (k.asymmetricKeyType !== ALGORITMO_FIRMA) return { error: `la clave pública no es ${ALGORITMO_FIRMA}` };
        return { clave: k };
    } catch (e) { return { error: `la clave pública no se entiende (${e.message})` }; }
}

/** Firma los bytes del manifiesto. Devuelve el texto de MANIFIESTO.sig (JSON) y la huella de la clave. */
export function firmarManifiesto(bytesManifiesto, clavePrivada) {
    const firma = sign(null, bytesManifiesto, clavePrivada);
    const huella = huellaClave(createPublicKey(clavePrivada));
    const texto = jsonCanonico({ formato: FORMATO, algoritmo: ALGORITMO_FIRMA, firma: firma.toString('base64'), manifest_sha256: sha256(bytesManifiesto), clave: huella });
    return { texto, huella };
}

/**
 * Verifica MANIFIESTO.sig contra los bytes del manifiesto con la clave publica de esta PC.
 * estado: 'valida' | 'firma_pendiente' (VERSION.json dice que hay firma y todavia no bajo o no coincide:
 * esperar) | 'sin_firma' (la publicacion no esta firmada) | 'ilegible' | 'invalida' | 'otra_clave'.
 * Solo 'valida' habilita a tocar algo; 'firma_pendiente' es "esperar", el resto es rechazo.
 */
export function verificarFirma({ nube, bytesManifiesto, clavePublica, infoVersion }) {
    // infoVersion es el VERSION.json leido (si se tiene): su campo `firma` dice si la publicacion vino firmada.
    // Sin ese campo la publicacion NO esta firmada, aunque haya quedado un MANIFIESTO.sig de una version anterior.
    const declarada = infoVersion && infoVersion.firma && typeof infoVersion.firma === 'object' ? infoVersion.firma : null;
    if (infoVersion && !declarada) return { estado: 'sin_firma', mensaje: 'la publicación no está firmada (VERSION.json no declara firma) y esta PC exige firma: tiene la clave pública del publicador' };
    let bytesSig;
    try { bytesSig = fs.readFileSync(path.join(nube, 'MANIFIESTO.sig')); } catch { bytesSig = null; }
    if (!bytesSig) {
        if (declarada) return { estado: 'firma_pendiente', mensaje: 'la firma del manifiesto (MANIFIESTO.sig) todavía no bajó' };
        return { estado: 'sin_firma', mensaje: 'la publicación no está firmada y esta PC exige firma (tiene la clave pública del publicador)' };
    }
    if (declarada && typeof declarada.sha256 === 'string' && sha256(bytesSig) !== declarada.sha256) {
        return { estado: 'firma_pendiente', mensaje: 'MANIFIESTO.sig no coincide con VERSION.json (la publicación se está subiendo)' };
    }
    let sig;
    try { sig = JSON.parse(sinBom(bytesSig.toString('utf8'))); } catch { sig = null; }
    if (!sig || sig.algoritmo !== ALGORITMO_FIRMA || typeof sig.firma !== 'string' || !/^[A-Za-z0-9+/=]{80,100}$/.test(sig.firma)) {
        return { estado: 'ilegible', mensaje: 'MANIFIESTO.sig no tiene la forma esperada' };
    }
    let ok = false;
    try { ok = verify(null, bytesManifiesto, clavePublica, Buffer.from(sig.firma, 'base64')); } catch { ok = false; }
    if (ok) return { estado: 'valida', huella: huellaClave(clavePublica) };
    const huella = huellaClave(clavePublica);
    if (typeof sig.clave === 'string' && sig.clave !== huella) {
        return { estado: 'otra_clave', mensaje: `la firma es de otra clave (${sig.clave}) que la instalada en esta PC (${huella})` };
    }
    return { estado: 'invalida', mensaje: 'la firma no corresponde a este manifiesto: alguien lo cambió después de publicarlo, o la firma está dañada' };
}

const MSJ_FIRMA_RECHAZADA = 'No se tocó nada: la publicación de la nube no pasa la verificación de firma.';

/** En el proyecto de areas (por --proyecto / CLAUDE_AREA_NUBE, o porque la nube ES `1- PUBLICADO`) la PC tiene que poder verificar la firma. */
export const exigeFirma = ({ nube, proyecto }) => proyecto === 'area' || (!!nube && normTexto(path.basename(nube)) === normTexto(PROYECTOS.area.publicado));

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
    const problemas = problemasDeManifiesto(manifiesto);
    if (problemas.length) return { estado: 'manifiesto_invalido', version: version.version, mensaje: 'el manifiesto trae rutas o datos que no se aceptan', problemas };
    // el numero de version viaja ADENTRO del manifiesto (que es lo firmado): un VERSION.json reescrito con otro numero no vale
    if (!Number.isInteger(manifiesto.version) || manifiesto.version !== version.version) {
        return { estado: 'manifiesto_invalido', version: version.version, mensaje: 'el manifiesto trae rutas o datos que no se aceptan', problemas: [`el manifiesto dice ser la versión ${manifiesto.version} y VERSION.json dice ${version.version}`] };
    }
    const firma = version.firma && typeof version.firma === 'object' ? version.firma : null;
    return { estado: 'ok', version: version.version, fecha: version.fecha, manifiesto, manifiestoSha: version.manifest_sha256, info: version, bytesManifiesto: bytes, firma, proyecto: proyectoDelManifiesto(manifiesto) };
}

const ES_HASH = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const ES_AREA = (s) => typeof s === 'string' && /^[a-z][a-z0-9_-]{0,29}$/.test(s);
/** El proyecto que declara un manifiesto (los de antes del 01/10/2026 no lo traen: son de ingenieria). */
export const proyectoDelManifiesto = (m) => (m && m.proyecto !== undefined ? m.proyecto : PROYECTO_POR_DEFECTO);

/** Problemas de forma de un manifiesto (vacio = bien). Lo usa la nube y tambien el historial. */
export function problemasDeManifiesto(manifiesto) {
    const problemas = [];
    if (!manifiesto || typeof manifiesto.archivos !== 'object' || manifiesto.archivos === null) { problemas.push('el manifiesto no tiene "archivos"'); return problemas; }
    const proyecto = proyectoDelManifiesto(manifiesto);
    if (!PROYECTOS[proyecto]) { problemas.push(`el manifiesto declara un proyecto que no existe: ${JSON.stringify(manifiesto.proyecto)}`); return problemas; }
    for (const [rel, e] of Object.entries(manifiesto.archivos)) {
        const m = motivoRutaNoPermitida(rel, proyecto);
        if (m) problemas.push(`${rel}: ${m}`);
        else if (!e || !ES_HASH(e.sha256) || !Number.isInteger(e.bytes)) problemas.push(`${rel}: hash o tamaño invalido`);
        // areas: solo se mira la forma (un area nueva en la lista no puede dejar afuera a toda la nube)
        else if (e.areas !== undefined && (!Array.isArray(e.areas) || e.areas.length === 0 || !e.areas.every(ES_AREA))) problemas.push(`${rel}: areas invalidas`);
    }
    if (manifiesto.lapidas !== undefined) {
        if (!Array.isArray(manifiesto.lapidas)) problemas.push('las lapidas no son una lista');
        else {
            for (const l of manifiesto.lapidas) {
                if (!l || typeof l.ruta !== 'string') { problemas.push('una lapida no tiene ruta'); continue; }
                const m = motivoRutaNoPermitida(l.ruta, proyecto);
                if (m) problemas.push(`lapida ${l.ruta}: ${m}`);
                else if (!Number.isInteger(l.desde_version) || (l.sha256 !== undefined && l.sha256 !== null && !ES_HASH(l.sha256))) problemas.push(`lapida ${l.ruta}: datos invalidos`);
                else if (l.ruta in manifiesto.archivos) problemas.push(`lapida ${l.ruta}: tambien figura como archivo publicado`);
            }
        }
    }
    return problemas;
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
        L.push('**Sacado de la base** (en tu PC pasa a la carpeta de cuarentena si está como se publicó; si lo cambiaste, se queda)');
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
// HISTORIAL: cada version publicada queda en la nube para poder volver atras
// ---------------------------------------------------------------------------------------------
// `historial\v<N>\MANIFIESTO.json` (+ `.sig`) y el contenido en `historial\_objetos\<2 letras>\<sha256>`:
// un archivo por hash, asi lo que no cambio entre versiones no se vuelve a subir ni a bajar en cada PC.

const rutaObjeto = (nube, sha) => path.join(nube, CARPETA_HISTORIAL, CARPETA_OBJETOS, sha.slice(0, 2), sha);
export const carpetaVersionHistorial = (nube, n) => path.join(nube, CARPETA_HISTORIAL, `v${n}`);

function guardarHistorial({ nube, version, archivos, hashes, textoManifiesto, textoSig }) {
    for (const [rel, abs] of archivos) {
        const { sha256: h, bytes } = hashes.get(rel);
        const obj = rutaObjeto(nube, h);
        let ya = false;
        try { ya = fs.statSync(obj).size === bytes; } catch { ya = false; }
        if (!ya) copiarVerificando(abs, obj, h);
    }
    const dir = carpetaVersionHistorial(nube, version);
    escribirAtomico(path.join(dir, 'MANIFIESTO.json'), textoManifiesto);
    if (textoSig) escribirAtomico(path.join(dir, 'MANIFIESTO.sig'), textoSig);
}

/**
 * Lee la version N del historial, la verifica (forma del manifiesto y hash de cada objeto) y la deja
 * lista para republicar: { archivos, areas, hashes, manifiesto } o { errores }. Lo que hay en el
 * historial tambien es DATO: pasa por las mismas reglas de rutas que el manifiesto de la nube.
 */
export function leerHistorial(nube, n) {
    if (!Number.isInteger(n) || n < 1) return { errores: [`--rollback necesita el numero de una version publicada (1, 2, 3...), no "${n}"`] };
    const dir = carpetaVersionHistorial(nube, n);
    const man = leerJson(path.join(dir, 'MANIFIESTO.json'));
    if (!man) return { errores: [`no hay una version ${n} en el historial de la nube (${dir})`] };
    const problemas = problemasDeManifiesto(man);
    if (problemas.length) return { errores: [`el manifiesto de la version ${n} trae datos que no se aceptan: ${problemas.slice(0, 5).join(' | ')}`] };
    const errores = [];
    if (man.version !== n) errores.push(`el manifiesto guardado como v${n} dice ser la version ${man.version}`);
    const archivos = new Map();
    const areas = new Map();
    const hashes = new Map();
    for (const rel of Object.keys(man.archivos).sort()) {
        const e = man.archivos[rel];
        const obj = rutaObjeto(nube, e.sha256);
        let st;
        try { st = fs.statSync(obj); } catch { st = null; }
        if (!st || !st.isFile() || st.size !== e.bytes) { errores.push(`${rel}: falta su contenido en el historial (${e.sha256.slice(0, 12)}...)`); continue; }
        if (sha256Archivo(obj) !== e.sha256) { errores.push(`${rel}: el contenido guardado en el historial no coincide con su hash`); continue; }
        archivos.set(rel, obj);
        areas.set(rel, areasDelArchivo(e));
        hashes.set(rel, { sha256: e.sha256, bytes: e.bytes });
    }
    if (errores.length) return { errores };
    return { archivos, areas, hashes, manifiesto: man };
}

/** Una lapida heredada del manifiesto anterior se conserva solo si tiene la forma correcta. */
const lapidaValida = (l, proyecto) => l && typeof l.ruta === 'string' && !motivoRutaNoPermitida(l.ruta, proyecto) && Number.isInteger(l.desde_version) && (l.sha256 === undefined || l.sha256 === null || ES_HASH(l.sha256));

// ---------------------------------------------------------------------------------------------
// PUBLICAR
// ---------------------------------------------------------------------------------------------

/**
 * @returns {{estado:'publicado'|'sin_novedades'|'simulado'|'rechazado', version?:number, errores:string[], avisos:string[], ...}}
 * No escribe NADA si hay un solo error. La nube se escribe en este orden: contenido, MANIFIESTO,
 * MANIFIESTO.sig, NOVEDADES, historial y, al final, VERSION.json.
 * - `clavePrivada`: ruta de la clave de firma. Si existe se firma; si no, solo se publica sin firma
 *   cuando la version anterior tampoco estaba firmada (o con `sinFirma`).
 * - `rollback: N`: en vez de la lista, se publica el contenido de la version N del historial como
 *   version nueva (lo que no estaba en N queda como lapida).
 */
export function publicar({ origen, nube, lista, notas = [], simular = false, forzar = false, ahora = new Date(), identidad = identidadLocal(), clavePrivada = null, sinFirma = false, rollback = null, motivoRetiro = null, proyecto = PROYECTO_POR_DEFECTO }) {
    const res = { estado: 'rechazado', errores: [], avisos: [], nuevos: [], cambiados: [], retirados: [], areasCambiadas: [], sobrantes: [], omitidos: [], firmada: false };
    if (fs.existsSync(path.join(origen, REL_INSTALADO))) {
        res.errores.push('esta PC recibe la base (tiene .claude/.paquete-instalado.json): solo la PC de origen publica');
        return res;
    }
    if (!nube) { res.errores.push(`no encuentro la carpeta "${nombreNube(proyecto)}" en la biblioteca sincronizada. Creala una vez en la biblioteca de SharePoint o pasá --nube <carpeta>`); return res; }
    // la carpeta publicada del proyecto de areas (`1- PUBLICADO`) es del programa: se crea al escribir si su carpeta madre existe
    const crearNube = !fs.existsSync(nube);
    if (crearNube && !(normTexto(path.basename(nube)) === normTexto(PROYECTOS.area.publicado) && fs.existsSync(path.dirname(nube)))) {
        res.errores.push(`la carpeta de la nube no existe: ${nube}`);
        return res;
    }

    // --- la clave de firma
    let clave = null;
    if (clavePrivada && fs.existsSync(clavePrivada)) {
        const k = leerClavePrivada(clavePrivada);
        if (k.error) { res.errores.push(k.error); return res; }
        clave = k.clave;
    }
    const versionAnterior = leerJson(path.join(nube, 'VERSION.json'));
    if (!clave) {
        if (versionAnterior && versionAnterior.firma && !sinFirma) {
            res.errores.push(`la versión anterior estaba firmada y no encuentro la clave privada${clavePrivada ? ` en ${clavePrivada}` : ''}: no se publica sin firma (si es a propósito, pasá --sin-firma)`);
            return res;
        }
        // en el proyecto de areas ninguna PC acepta una publicacion sin firma: publicarla seria tirar la version
        if (exigeFirma({ nube, proyecto }) && !sinFirma) {
            res.errores.push(`en el proyecto de áreas toda publicación va firmada y no encuentro la clave privada${clavePrivada ? ` en ${clavePrivada}` : ''}: generala una vez con --generar-clave (o pasá --sin-firma si es a propósito)`);
            return res;
        }
        res.avisos.push(`se publica SIN firma${clavePrivada ? ` (no hay clave privada en ${clavePrivada})` : ''}: una PC con la clave pública instalada la rechaza. Se genera una vez con --generar-clave`);
    }

    // --- que se publica: la lista, o una version del historial (rollback)
    let archivos; let areasPorRel; let notasFinales = notas;
    if (rollback !== null && rollback !== undefined) {
        const h = leerHistorial(nube, Number(rollback));
        if (h.errores) { res.errores.push(...h.errores); return res; }
        archivos = h.archivos;
        areasPorRel = h.areas;
        res.rollback = Number(rollback);
        notasFinales = [`Se volvió a la versión ${res.rollback}`, ...notas];
    } else {
        res.errores.push(...revisarLista(lista, proyecto));
        const exp = expandirLista(origen, lista);
        res.omitidos = exp.omitidos;
        res.errores.push(...exp.errores);
        if (res.errores.length) return res;
        archivos = exp.archivos;
        areasPorRel = exp.areas;
    }
    if (archivos.size === 0) { res.errores.push('la lista no trajo ningun archivo'); return res; }

    // --- revision de cada archivo (todo se junta: Fak ve todos los problemas de una vez)
    let total = 0;
    const hashes = new Map();
    // Los `ejecutables` de la lista (ruta exacta): no cuentan para los topes de texto ni pasan el filtro de texto; se
    // exige que esten y que sean un programa de Windows (empiezan con "MZ"). Si la lista declara uno y no viaja, no se
    // publica: los controles del plugin lo llaman por su ruta y sin el quedarian apagados.
    const ejecutables = new Set(lista && Array.isArray(lista.ejecutables) ? lista.ejecutables : []);
    for (const r of ejecutables) if (!archivos.has(r)) res.errores.push(`${r}: la lista lo declara en "ejecutables" y no está en lo que se publica`);
    for (const [rel, abs] of archivos) {
        const motivo = motivoRutaNoPermitida(rel, proyecto);
        if (motivo) res.errores.push(`${rel}: ${motivo}`);
        const largo = path.join(nube, 'contenido', ...rel.split('/')).length;
        if (largo > LIMITE_RUTA) res.errores.push(`${rel}: en la nube la ruta mide ${largo} caracteres (tope ${LIMITE_RUTA}): Windows no la abriria. Acortar el nombre`);
        const st = fs.statSync(abs);
        const esEjecutable = ejecutables.has(rel);
        if (!esEjecutable) total += st.size;
        const tope = esEjecutable ? LIMITE_MB_EJECUTABLE : LIMITE_MB_ARCHIVO;
        if (st.size > tope * 1024 * 1024) res.errores.push(`${rel}: pesa ${(st.size / 1048576).toFixed(1)} MB (tope ${tope} MB)`);
        const buf = fs.readFileSync(abs);
        hashes.set(rel, { sha256: sha256(buf), bytes: buf.length });
        if (esEjecutable) { if (!(buf.length > 1024 && buf[0] === 0x4d && buf[1] === 0x5a)) res.errores.push(`${rel}: está en "ejecutables" y no es un programa de Windows`); continue; }
        if (/[.](?:exe|dll|com|scr|msi)$/i.test(rel)) res.errores.push(`${rel}: es un programa y no está en "ejecutables" de la lista: no viaja`);
        if (frontmatterConHooks(rel, buf.toString('utf8'), proyecto)) res.errores.push(`${rel}: el encabezado declara "hooks:" (ejecutaria codigo solo en la PC del compañero)`);
    }
    if (total > LIMITE_MB_TOTAL * 1024 * 1024) res.errores.push(`la lista pesa ${(total / 1048576).toFixed(1)} MB (tope ${LIMITE_MB_TOTAL} MB)`);
    // `sin_filtro_identidad` (la lista de personas, que nombra a todos, incluido quien publica) pasa el filtro de claves y
    // rutas pero no el del nombre de usuario / PC de quien publica; todo lo demas pasa el filtro entero.
    const sinIdentidad = new Set(lista && Array.isArray(lista.sin_filtro_identidad) ? lista.sin_filtro_identidad : []);
    const filtroEntero = new Map([...archivos].filter(([rel]) => !sinIdentidad.has(rel) && !ejecutables.has(rel)));
    const soloGenerico = new Map([...archivos].filter(([rel]) => sinIdentidad.has(rel) && !ejecutables.has(rel)));
    for (const h of revisarContenido(filtroEntero, patronesFiltro({ lista, identidad }))) {
        res.errores.push(`${h.ruta}${h.linea ? `:${h.linea}` : ''}: ${h.motivo}`);
    }
    for (const h of revisarContenido(soloGenerico, patronesFiltro({ lista, identidad: { usuario: '', pc: '' } }))) {
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
        else if (areasDelArchivo(previos[rel]).join(',') !== areasPorRel.get(rel).join(',')) res.areasCambiadas.push(rel);
    }
    res.retirados = Object.keys(previos).filter((r) => !hashes.has(r)).sort();
    const sinCambios = !res.nuevos.length && !res.cambiados.length && !res.retirados.length && !res.areasCambiadas.length;
    if (sinCambios && pub.estado === 'ok' && verificarContenido(nube, pub.manifiesto).ok && !forzar && !res.rollback) {
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
    // --- lapidas: las heredadas que siguen retiradas + lo que se retira ahora (con el hash que tenia publicado)
    const heredadas = (Array.isArray(previa && previa.lapidas) ? previa.lapidas : []).filter((l) => lapidaValida(l, proyecto) && !hashes.has(l.ruta) && !res.retirados.includes(l.ruta));
    const motivo = motivoRetiro || (res.rollback ? `no estaba en la versión ${res.rollback}` : 'salió de la lista de publicación');
    const nuevasLapidas = res.retirados.map((r) => ({ ruta: r, desde_version: res.version, motivo, sha256: ES_HASH(previos[r].sha256) ? previos[r].sha256 : null }));
    const lapidas = [...heredadas, ...nuevasLapidas].sort((a, b) => (a.ruta < b.ruta ? -1 : 1));
    res.lapidas = lapidas.length;
    if (simular) { res.estado = 'simulado'; return res; }

    // --- escribir: contenido -> manifiesto -> firma -> novedades -> historial -> VERSION (al final)
    try {
        if (crearNube) fs.mkdirSync(nube, { recursive: true });
        for (const [rel, abs] of archivos) {
            const dest = path.join(contenidoNube, ...rel.split('/'));
            let igual = false;
            try { igual = fs.statSync(dest).size === hashes.get(rel).bytes && sha256Archivo(dest) === hashes.get(rel).sha256; } catch { igual = false; }
            if (!igual) copiarVerificando(abs, dest, hashes.get(rel).sha256);
        }
        const manifiesto = {
            formato: FORMATO, version: res.version, generado: isoLocal(ahora),
            ...(proyecto !== PROYECTO_POR_DEFECTO ? { proyecto } : {}),
            archivos: Object.fromEntries([...hashes].map(([rel, h]) => [rel, { ...h, areas: areasPorRel.get(rel) }])),
            lapidas,
        };
        const textoManifiesto = jsonCanonico(manifiesto);
        escribirAtomico(path.join(nube, 'MANIFIESTO.json'), textoManifiesto);

        let textoSig = null;
        let infoFirma = null;
        if (clave) {
            const t0 = process.hrtime.bigint();
            const f = firmarManifiesto(Buffer.from(textoManifiesto, 'utf8'), clave);
            res.ms_firma = Number(process.hrtime.bigint() - t0) / 1e6;
            textoSig = f.texto;
            escribirAtomico(path.join(nube, 'MANIFIESTO.sig'), textoSig);
            infoFirma = { algoritmo: ALGORITMO_FIRMA, sha256: sha256(textoSig), clave: f.huella };
            // En el proyecto de areas la clave PUBLICA viaja al lado de lo publicado para la primera instalacion de una
            // PC (confianza en el primer uso: ver clavePublicaParaInstalar). Es publica: no revela nada.
            if (exigeFirma({ nube, proyecto })) {
                const pem = createPublicKey(clave).export({ type: 'spki', format: 'pem' });
                const pPub = path.join(nube, NOMBRE_CLAVE_PUBLICA);
                let igual = false;
                try { igual = fs.readFileSync(pPub, 'utf8') === pem; } catch { igual = false; }
                if (!igual) escribirAtomico(pPub, pem);
            }
        }

        const previosPorSkill = new Set(Object.keys(previos).map((r) => describirRuta(r)).filter((d) => d.grupo === 'skill').map((d) => d.nombre));
        const entrada = armarEntradaNovedades({ version: res.version, fecha: ahora, nuevos: res.nuevos, cambiados: res.cambiados, retirados: res.retirados, notas: notasFinales, previosPorSkill });
        let previo = '';
        try { previo = fs.readFileSync(path.join(nube, 'NOVEDADES.md'), 'utf8'); } catch { previo = ''; }
        escribirAtomico(path.join(nube, 'NOVEDADES.md'), insertarNovedades(previo, entrada));

        guardarHistorial({ nube, version: res.version, archivos, hashes, textoManifiesto, textoSig });

        const version = { formato: FORMATO, version: res.version, fecha: isoLocal(ahora), archivos: hashes.size, bytes: total, manifest_sha256: sha256(textoManifiesto), firma: infoFirma, lapidas: lapidas.length };
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
    if (clave) {
        const v = verificarFirma({ nube, bytesManifiesto: despues.bytesManifiesto, clavePublica: createPublicKey(clave), infoVersion: despues.info });
        if (v.estado !== 'valida') { res.errores.push(`la firma que quedó en la nube no verifica (${v.estado}): ${v.mensaje || ''}`); res.estado = 'rechazado'; return res; }
        res.firmada = true;
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

/**
 * En el proyecto `area` lo que hay en `publicado\` es de la instalacion, no de la persona (y queda adentro de la
 * carpeta que abre el asistente, asi que puede cambiarse o borrarse por error): lo que falte o tenga otro hash se
 * REPONE desde la nube verificada aunque la version no haya cambiado; lo cambiado se guarda antes en cuarentena.
 * No hay `.fak-nueva`, ni "propio", ni "sacado".
 */
export function decidirArchivoArea({ nuevoHash, localHash, instaladoHash }) {
    if (localHash === nuevoHash) return 'igual';
    if (localHash === null) return instaladoHash === undefined ? 'nuevo' : 'repuesto';     // faltaba
    if (instaladoHash !== undefined && localHash === instaladoHash) return 'actualizar';   // version nueva, archivo sin tocar
    return 'repuesto';                                                                    // alguien lo cambio
}

/** Huella barata de un archivo instalado (tamaño + fecha): lo que compara `--chequear` sin hashear. */
export function huellaArchivo(abs) {
    try { const st = fs.statSync(abs); return st.isFile() ? { bytes: st.size, mtime: Math.floor(st.mtimeMs) } : null; } catch { return null; }
}

/** Los archivos del registro cuya huella (tamaño + fecha) ya no coincide con la anotada, o que faltan. */
export function archivosConOtraHuella(destino, huellas) {
    const cambiados = [];
    for (const [rel, h] of Object.entries(huellas || {})) {
        if (!h || !rutaSegura(rel)) continue;
        const ahora = huellaArchivo(path.join(destino, ...rel.split('/')));
        if (!ahora || ahora.bytes !== h.bytes || ahora.mtime !== h.mtime) cambiados.push(rel);
    }
    return cambiados;
}

/** Lo que hay adentro de `publicado\` y no esta en el manifiesto (no se borra: se anota). Lo interno de la sincronizacion no cuenta. */
export function archivosExtranos(destino, manifiesto) {
    const out = [];
    const rec = (d, r) => {
        let entradas;
        try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of entradas) {
            const rel = r ? `${r}/${e.name}` : e.name;
            if (!r && e.name === '.claude') continue;   // registro, respaldos, cuarentena, pendientes
            if (e.isDirectory()) rec(path.join(d, e.name), rel);
            else if (e.isFile() && !(rel in manifiesto) && !/[.]tmp$/i.test(e.name)) out.push(rel);
        }
    };
    rec(destino, '');
    return out.sort();
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

export function armarPendientes({ version, fecha, tocados, sacados, retirados, retiradosTuyos = [] }) {
    if (!tocados.length && !sacados.length && !retirados.length && !retiradosTuyos.length) return null;
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
    if (retiradosTuyos.length) {
        L.push('## Fak los retiró de la base, pero vos los habías cambiado (quedan en tu PC)', '');
        for (const r of retiradosTuyos) L.push(`- \`${r}\``);
        L.push('', 'Si ya no los usás, los podés borrar vos. La sincronización no toca lo que cambiaste.', '');
    }
    if (retirados.length) {
        L.push('## Fak dejó de publicarlos (siguen en tu PC)', '');
        for (const r of retirados) L.push(`- \`${r}\``);
        L.push('');
    }
    return L.join('\n');
}

/**
 * El area de esta PC: `--area`, o la que diga perfil.json (en CLAUDE_AREA_HOME, en el destino, o el
 * perfil-equipo.json de siempre). null = solo lo comun. "todas" instala todo (la PC de Fak, las pruebas).
 */
export function resolverArea({ area = null, destino, env = process.env, home = null }) {
    if (area) {
        const a = normTexto(area);
        if (a === AREA_TODAS || a === '*') return { area: AREA_TODAS };
        if (!AREAS.includes(a)) return { error: `el área "${area}" no existe (van: ${AREAS.join(', ')}, o "todas")` };
        return { area: a };
    }
    const candidatos = [home ? path.join(home, 'perfil.json') : null, env.CLAUDE_AREA_HOME ? path.join(env.CLAUDE_AREA_HOME, 'perfil.json') : null, path.join(destino, 'perfil.json'), path.join(destino, ...REL_PERFIL.split('/'))].filter(Boolean);
    for (const p of candidatos) {
        const perfil = leerJson(p);
        if (!perfil || typeof perfil.area !== 'string' || !perfil.area.trim()) continue;
        const a = normTexto(perfil.area);
        if (!AREAS.includes(a)) return { error: `el área "${perfil.area}" que dice ${p} no existe (van: ${AREAS.join(', ')})` };
        return { area: a, desde: p };
    }
    return { area: null };
}

/** Un archivo del manifiesto le toca a esta PC si es comun o de su area. */
export const esDeMiArea = (entrada, area) => area === AREA_TODAS || areasDelArchivo(entrada).some((a) => a === AREA_COMUN || a === area);

/**
 * Lleva UN archivo a la cuarentena con un solo rename (la cuarentena vive en la misma carpeta de
 * proyecto, mismo disco): no hay copia ni borrado, y si el rename falla el archivo se queda donde
 * estaba y se anota el error. El plan (origen -> destino, un renglon por archivo) lo imprime
 * `--actualizar --simular`, que es el dry-run de la actualizacion.
 */
function moverACuarentena(abs, destinoCuarentena) {
    fs.mkdirSync(path.dirname(destinoCuarentena), { recursive: true });
    fs.renameSync(abs, destinoCuarentena);
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
 * @returns {{estado:'actualizado'|'al_dia'|'esperar'|'error'|'ocupado'|'simulado'|'firma_rechazada'|'sin_clave'|'version_anterior', ...}}
 * Nunca borra. Antes de tocar nada verifica la nube completa y, si esta PC tiene la clave publica,
 * la firma. `simular` es el dry-run: devuelve el plan (archivo por archivo, cuarentena incluida) y no
 * escribe. Al final, salga como salga, deja la salud de esta PC en el buzon de la nube.
 */
export function actualizar(opts) {
    const { nube, simular = false } = opts;
    const ahora = opts.ahora || new Date();
    // la identidad con la que se firma la salud: la del perfil de la PC si lo hay (misma regla que el plugin y la tarea), si no la de Windows
    const identidad = identidadDePerfil(opts.home, opts.identidad || identidadLocal());
    const res = actualizarAdentro({ ...opts, ahora, identidad });
    // salud: lo que esta PC cuenta de si misma, bien o mal. Nunca frena ni cambia el resultado.
    if (!simular && !res.sinSalud && nube && fs.existsSync(nube) && res.estado !== 'ocupado') {
        try { res.salud = escribirSalud({ nube, salud: armarSalud({ destino: opts.destino, res, identidad, ahora }) }); }
        catch (e) { res.avisos.push(`no pude dejar la salud de esta PC en la nube: ${e.message}`); }
    }
    return res;
}

function actualizarAdentro({ destino, nube, reponer = false, simular = false, ahora, identidad, area = null, clavePublica = null, proyecto = PROYECTO_POR_DEFECTO, home = null, env = process.env }) {
    const res = {
        estado: 'error', errores: [], avisos: [],
        contadores: { nuevos: 0, actualizados: 0, iguales: 0, tocados: 0, sacados: 0, propios: 0, fuera_de_area: 0, cuarentena: 0, repuestos: 0 },
        tocados: [], sacados: [], retirados: [], retiradosTuyos: [], cuarentena: [], repuestos: [], extranos: [], plan: [], firma: 'no_verificada', area: null,
    };
    if (!nube || !fs.existsSync(nube)) { res.errores.push(`no encuentro la carpeta "${nombreNube(proyecto)}" (¿OneDrive ya sincronizo la biblioteca?)`); return res; }
    const instalado = leerInstalado(destino);
    if (!instalado && fs.existsSync(path.join(destino, ...REL_LISTA.split('/')))) {
        res.errores.push('esta es la PC de origen de la base (tiene la lista de publicacion): no se actualiza desde la nube. Para probar usa --destino <otra carpeta>');
        res.sinSalud = true;
        return res;
    }
    const areaRes = resolverArea({ area, destino, env, home });
    if (areaRes.error) { res.errores.push(areaRes.error); return res; }
    res.area = areaRes.area;

    // --- en el proyecto de areas la PC TIENE que poder comprobar quien publico: sin clave publica no se instala nada
    if (!clavePublica && exigeFirma({ nube, proyecto })) {
        res.estado = 'sin_clave';
        res.firma = 'sin_clave';
        res.mensaje = 'A esta PC le falta la clave para comprobar que la actualización es de Barack: no se tocó nada. Avisale al administrador.';
        res.errores.push(res.mensaje);
        return res;
    }

    const pub = leerPublicacion(nube);
    if (pub.estado === 'manifiesto_invalido') { res.errores.push(`${pub.mensaje}: ${(pub.problemas || []).slice(0, 5).join(' | ')}`); return res; }
    if (pub.estado !== 'ok') { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (${pub.mensaje})`; return res; }
    res.version = pub.version;

    // --- firma: si esta PC tiene la clave publica del publicador, la publicacion tiene que venir firmada por el
    if (clavePublica) {
        const k = leerClavePublica(clavePublica);
        if (k.error) { res.errores.push(k.error); return res; }
        const v = verificarFirma({ nube, bytesManifiesto: pub.bytesManifiesto, clavePublica: k.clave, infoVersion: pub.info });
        res.firma = v.estado;
        if (v.estado === 'firma_pendiente') { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (${v.mensaje})`; return res; }
        if (v.estado !== 'valida') { res.estado = 'firma_rechazada'; res.mensaje = `${MSJ_FIRMA_RECHAZADA} ${v.mensaje}`; res.errores.push(v.mensaje); return res; }
    }

    // --- la version nunca retrocede: un rollback legitimo sale como version NUEVA, asi que una nube con una version
    //     menor que la instalada es un manifiesto viejo (con su firma legitima) vuelto a poner en la raiz
    if (instalado && Number.isInteger(instalado.version) && pub.version < instalado.version) {
        res.estado = 'version_anterior';
        res.mensaje = `La nube tiene una versión más vieja (${pub.version}) que la de esta PC (${instalado.version}): no se tocó nada. Avisale al administrador.`;
        res.errores.push(res.mensaje);
        return res;
    }

    // --- lo que le toca a esta PC: lo comun mas lo de su area; el resto ni se toca ni se olvida
    const manTodo = pub.manifiesto.archivos;
    const man = Object.fromEntries(Object.entries(manTodo).filter(([, e]) => esDeMiArea(e, res.area)));
    res.contadores.fuera_de_area = Object.keys(manTodo).length - Object.keys(man).length;
    const inst = (instalado && instalado.archivos) || {};
    const versionNueva = !instalado || instalado.version !== pub.version || instalado.manifest_sha256 !== pub.manifiestoSha;

    // --- plan: solo mira el disco local y el manifiesto
    //     En el proyecto de areas `publicado\` es de la instalacion: lo que falta o cambio se repone (decidirArchivoArea).
    const enArea = exigeFirma({ nube, proyecto }) || pub.proyecto === 'area';
    const aInstalar = [];   // { rel, modo: 'nuevo'|'actualizar'|'tocado'|'repuesto', cuarentena }
    const nuevoRecord = { ...inst };
    // huellas (tamaño + fecha) para --chequear: las de lo que esta en el manifiesto pero fuera de la vista de esta PC se conservan
    const huellas = {};
    for (const [rel, h] of Object.entries((instalado && instalado.huellas) || {})) if (rel in manTodo && !(rel in man)) huellas[rel] = h;
    for (const [rel, e] of Object.entries(man)) {
        const abs = path.join(destino, ...rel.split('/'));
        let localHash = null;
        try { localHash = fs.statSync(abs).isFile() ? sha256Archivo(abs) : null; } catch { localHash = null; }
        const que = enArea ? decidirArchivoArea({ nuevoHash: e.sha256, localHash, instaladoHash: inst[rel] }) : decidirArchivo({ nuevoHash: e.sha256, localHash, instaladoHash: inst[rel], reponer });
        res.plan.push({ rel, que });
        if (que === 'igual') { res.contadores.iguales++; nuevoRecord[rel] = e.sha256; if (enArea) huellas[rel] = huellaArchivo(abs); }
        else if (que === 'repuesto') { res.contadores.repuestos++; res.repuestos.push({ rel, motivo: localHash === null ? 'faltaba' : 'cambiado' }); aInstalar.push({ rel, modo: 'repuesto', cuarentena: localHash !== null }); }
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

    // --- lapidas: lo que Fak retiro. Identico a lo publicado -> cuarentena; cambiado por la persona -> se queda y se anota
    const lapidas = Array.isArray(pub.manifiesto.lapidas) ? pub.manifiesto.lapidas : [];
    const conLapida = new Set(lapidas.map((l) => l.ruta));
    const aCuarentena = [];   // { rel, abs }
    for (const l of lapidas) {
        if (l.ruta in manTodo) continue;
        const abs = path.join(destino, ...l.ruta.split('/'));
        let localHash = null;
        try { localHash = fs.statSync(abs).isFile() ? sha256Archivo(abs) : null; } catch { localHash = null; }
        if (localHash === null) continue;
        const eraNuestro = inst[l.ruta] !== undefined;
        if (localHash === inst[l.ruta] || (l.sha256 && localHash === l.sha256)) { aCuarentena.push({ rel: l.ruta, abs }); res.plan.push({ rel: l.ruta, que: 'cuarentena' }); }
        else if (eraNuestro) { res.retiradosTuyos.push(l.ruta); res.plan.push({ rel: l.ruta, que: 'retirado_tuyo' }); }
        // si nunca fue nuestro y no es igual a lo publicado, es de la persona: ni se toca ni se nombra
    }
    res.contadores.cuarentena = aCuarentena.length;
    // sin lapida (publicacion vieja): como siempre, siguen en la PC y se anotan
    res.retirados = Object.keys(inst).filter((r) => !(r in manTodo) && !conLapida.has(r)).sort();
    for (const r of Object.keys(inst)) if (!(r in manTodo)) delete nuevoRecord[r];
    // en areas, lo que aparecio adentro de publicado\ y no es de la publicacion: no se borra, se anota (va a la salud)
    if (enArea) res.extranos = archivosExtranos(destino, manTodo);

    const pendientesTexto = armarPendientes({ version: pub.version, fecha: new Date(pub.fecha || ahora), tocados: res.tocados, sacados: res.sacados, retirados: res.retirados, retiradosTuyos: res.retiradosTuyos });
    const pPendientes = path.join(destino, ...REL_PENDIENTES.split('/'));
    let pendientesActual = null;
    try { pendientesActual = fs.readFileSync(pPendientes, 'utf8'); } catch { pendientesActual = null; }
    // sin pendientes y con el archivo de una vez anterior: se deja el texto "sin pendientes" (y se queda quieto)
    const pendientesEsperado = pendientesTexto ?? (pendientesActual === null ? null : TEXTO_SIN_PENDIENTES);
    const cambiaPendientes = pendientesEsperado !== pendientesActual;
    const huellasCambian = enArea && jsonCanonico(huellas) !== jsonCanonico((instalado && instalado.huellas) || {});
    const hayTrabajo = aInstalar.length > 0 || aCuarentena.length > 0 || versionNueva || cambiaPendientes || jsonCanonico(nuevoRecord) !== jsonCanonico(inst) || huellasCambian;
    if (!hayTrabajo) { res.estado = 'al_dia'; return res; }

    // --- seguridad de lo que se va a escribir + verificacion de la nube ANTES de tocar nada
    const necesarios = versionNueva ? new Set(Object.keys(man)) : new Set(aInstalar.map((a) => a.rel));
    const v = verificarContenido(nube, pub.manifiesto, necesarios);
    if (!v.ok) {
        res.estado = 'esperar';
        res.mensaje = `${MSJ_BAJANDO} (faltan ${v.faltan.length}, distintos ${v.distintos.length}: ${[...v.faltan, ...v.distintos].slice(0, 3).join(', ')}${v.faltan.length + v.distintos.length > 3 ? ', ...' : ''})`;
        return res;
    }
    for (const { rel } of aInstalar) {
        if (!/[.]md$/i.test(rel)) continue;
        if (frontmatterConHooks(rel, fs.readFileSync(path.join(nube, 'contenido', ...rel.split('/')), 'utf8'), pub.proyecto)) {
            res.errores.push(`${rel}: el encabezado declara "hooks:"; no se instala`);
        }
    }
    if (res.errores.length) return res;
    const carpetaCuarentena = path.join(destino, ...REL_CUARENTENA.split('/'), selloCarpeta(ahora));
    res.carpetaCuarentena = aCuarentena.length || aInstalar.some((a) => a.cuarentena) ? carpetaCuarentena : null;
    if (simular) { res.estado = 'simulado'; return res; }

    // --- escribir (con lock, respaldo de lo reemplazado y sin borrar nada)
    const soltar = tomarLock(destino, ahora);
    if (!soltar) { res.estado = 'ocupado'; res.mensaje = 'otra sincronizacion esta corriendo en esta PC'; return res; }
    try {
        const carpetaRespaldo = path.join(destino, ...REL_RESPALDO.split('/'), selloCarpeta(ahora));
        let huboRespaldo = false;
        let huboCuarentena = false;
        for (const { rel, modo, cuarentena } of aInstalar) {
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
                    // repuesto con el archivo cambiado: lo que habia va a la cuarentena con fecha ANTES de reponer (no se pierde)
                    if (modo === 'repuesto' && cuarentena) { moverACuarentena(abs, path.join(carpetaCuarentena, ...rel.split('/'))); huboCuarentena = true; }
                    copiarVerificando(origenNube, abs, hash);
                    nuevoRecord[rel] = hash;
                    if (enArea) huellas[rel] = huellaArchivo(abs);
                }
            } catch (e) {
                res.errores.push(`${rel}: ${e.code || e.message}`);
                if (modo === 'nuevo') res.contadores.nuevos--;
                else if (modo === 'actualizar') res.contadores.actualizados--;
                else if (modo === 'repuesto') { res.contadores.repuestos--; res.repuestos = res.repuestos.filter((x) => x.rel !== rel); }
            }
        }
        // cuarentena: un rename por archivo (y su .fak-nueva si quedo uno); lo que no se pudo mover se queda
        for (const { rel, abs } of aCuarentena) {
            try {
                moverACuarentena(abs, path.join(carpetaCuarentena, ...rel.split('/')));
                const nueva = `${abs}${SUFIJO_NUEVA}`;
                if (fs.existsSync(nueva)) moverACuarentena(nueva, path.join(carpetaCuarentena, ...`${rel}${SUFIJO_NUEVA}`.split('/')));
                res.cuarentena.push(rel);
            } catch (e) {
                res.errores.push(`${rel}: no pude moverlo a cuarentena (${e.code || e.message})`);
                res.contadores.cuarentena--;
            }
        }
        if (!res.cuarentena.length && !huboCuarentena) res.carpetaCuarentena = null;
        if (huboRespaldo) { const r = leerInstalado(destino); if (r) escribirAtomico(path.join(carpetaRespaldo, '.paquete-instalado.json'), jsonCanonico(r)); }
        if (cambiaPendientes && pendientesEsperado !== null) escribirAtomico(pPendientes, pendientesEsperado);
        const historial = ((instalado && instalado.historial) || []).slice(-19);
        const nuevoInstalado = {
            formato: FORMATO, version: pub.version, manifest_sha256: pub.manifiestoSha, publicada: pub.fecha, actualizado: isoLocal(ahora),
            area: res.area, firma: res.firma, proyecto: pub.proyecto,
            archivos: nuevoRecord,
            // en areas, la huella (tamaño + fecha) de cada archivo instalado: lo que `--chequear` compara sin hashear
            ...(enArea ? { huellas: Object.fromEntries(Object.entries(huellas).filter(([, h]) => h)) } : {}),
            pendientes: { tocados: res.tocados, sacados: res.sacados, retirados: res.retirados, retiradosTuyos: res.retiradosTuyos },
            historial: [...historial, { fecha: isoLocal(ahora), version: pub.version, nuevos: res.contadores.nuevos, actualizados: res.contadores.actualizados, tocados: res.contadores.tocados, repuestos: res.contadores.repuestos, cuarentena: res.cuarentena.length, errores: res.errores.length }],
        };
        escribirAtomico(path.join(destino, ...REL_INSTALADO.split('/')), jsonCanonico(nuevoInstalado));
        res.respaldo = huboRespaldo ? carpetaRespaldo : null;
        // proyecto de areas: las reglas de la casa (en la raiz de la PC) se regeneran desde lo recien instalado
        if (home && enArea) {
            try { res.casa = regenerarCasa({ home, publicado: destino, perfil: leerJson(path.join(home, 'perfil.json')), ahora }); }
            catch (e) { res.avisos.push(`no pude actualizar las reglas de la casa: ${e.message}`); }
        }
    } finally {
        soltar();
    }
    res.estado = res.errores.length ? 'error' : 'actualizado';
    if (res.repuestos.length) res.mensaje = `${res.repuestos.length} archivo(s) repuesto(s) desde la nube: ${res.repuestos.map((x) => `${x.rel} (${x.motivo})`).join(', ')}`;
    return res;
}

// ---------------------------------------------------------------------------------------------
// SALUD: lo que cada PC cuenta de si misma en el buzon de la nube (formato de CONTRATO.md)
// ---------------------------------------------------------------------------------------------

/** Lo que este programa sabe; lo que no sabe (politica, Outlook, Python, discos) queda en null para que lo complete la tarea. */
export function armarSalud({ destino, res, identidad, ahora }) {
    const inst = leerInstalado(destino);
    const bien = res.estado === 'actualizado' || res.estado === 'al_dia';
    const firmaOk = res.firma === 'valida' ? true : (res.firma === 'no_verificada' || res.firma === 'firma_pendiente' || res.firma === undefined ? null : false);
    return {
        pc: identidad.pc || null,
        usuario_windows: identidad.usuario || null,
        area: res.area ?? (inst && inst.area) ?? null,
        version_instalada: inst && Number.isInteger(inst.version) ? inst.version : 0,
        version_publicada_vista: Number.isInteger(res.version) ? res.version : 0,
        ultima_sync_ok: bien ? isoLocal(ahora) : (inst && inst.actualizado) || null,
        firma_ok: firmaOk,
        politica: null, outlook: null, python: null, ve_Y: null, ve_Z: null, disco_libre_gb: null,
        // `errores` es lo que el tablero pinta de rojo: solo lo que fallo de verdad en ESTA corrida. La espera
        // por OneDrive (estado 'esperar') es normal y va en `mensaje`, no en `errores`.
        errores: res.estado === 'esperar' ? [] : [...res.errores],
        estado: res.estado,
        mensaje: res.mensaje || null,
        // areas: lo que se repuso desde la nube en esta corrida (faltaba o estaba cambiado) y lo que aparecio en publicado\ sin ser publicado
        repuestos: (res.repuestos || []).map((x) => x.rel),
        extranos: (res.extranos || []).slice(0, 50),
        escrito: isoLocal(ahora),
    };
}

/** Nombre de PC apto para carpeta, con la MISMA regla que el plugin (asi `salud\<pc>.json` y `avisos\<pc>\` coinciden). */
export const nombrePcCarpeta = (pc) => String(pc || '').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 40) || 'pc-sin-nombre';

/** `<home>\perfil.json` manda sobre el nombre de Windows para `pc` y `usuario_windows` (CONTRATO: "<pc> = perfil.json -> pc, o el nombre de Windows"). */
export function identidadDePerfil(home, identidad) {
    if (!home) return identidad;
    const perfil = leerJson(path.join(home, 'perfil.json'));
    if (!perfil || typeof perfil !== 'object') return identidad;
    return { usuario: (typeof perfil.usuario_windows === 'string' && perfil.usuario_windows) || identidad.usuario, pc: (typeof perfil.pc === 'string' && perfil.pc) || identidad.pc };
}

/** `salud\<pc>.json` en el buzon (4- BUZON en la estructura de areas; la misma carpeta en la de siempre). Escritura atomica. */
export function escribirSalud({ nube, salud }) {
    const p = path.join(carpetaBuzon(nube), 'salud', `${nombrePcCarpeta(salud.pc)}.json`);
    escribirAtomico(p, jsonCanonico(salud));
    return p;
}

// ---------------------------------------------------------------------------------------------
// CHEQUEO RAPIDO: ¿hay version nueva? (lo llama el aviso al abrir Claude; no verifica hashes ni copia)
// ---------------------------------------------------------------------------------------------

/**
 * Compara VERSION.json de la nube con lo instalado. Lee dos archivos chicos y nada mas (en el proyecto de areas,
 * ademas, mira tamaño y fecha de cada archivo instalado contra lo anotado: si algo falta o cambio, avisa con el
 * mismo codigo de "hay novedades" y `motivo: 'instalacion_tocada'`; la reposicion la hace --actualizar).
 * estado: 'al_dia' | 'hay_novedades' | 'sin_nube' | 'sin_instalar' | 'nube_incompleta'. `ms` es lo que tardo adentro.
 */
export function chequear({ destino, nube }) {
    const t0 = process.hrtime.bigint();
    const fin = (estado, extra) => ({ estado, ...extra, ms: Math.round(Number(process.hrtime.bigint() - t0) / 1e3) / 1e3 });
    if (!nube || !fs.existsSync(nube)) return fin('sin_nube', { publicada: null, instalada: null });
    const version = leerJson(path.join(nube, 'VERSION.json'));
    const instalado = leerInstalado(destino);
    const instalada = instalado && Number.isInteger(instalado.version) ? instalado.version : null;
    if (!version || !Number.isInteger(version.version) || typeof version.manifest_sha256 !== 'string') return fin('nube_incompleta', { publicada: null, instalada });
    if (!instalado) return fin('sin_instalar', { publicada: version.version, instalada: null, fecha_publicada: version.fecha || null });
    const base = { publicada: version.version, instalada, fecha_publicada: version.fecha || null, firmada: !!version.firma };
    if (instalado.manifest_sha256 !== version.manifest_sha256) return fin('hay_novedades', { ...base, motivo: 'version_nueva' });
    if (instalado.proyecto === 'area' && instalado.huellas && typeof instalado.huellas === 'object') {
        const cambiados = archivosConOtraHuella(destino, instalado.huellas);
        if (cambiados.length) return fin('hay_novedades', { ...base, motivo: 'instalacion_tocada', cambiados: cambiados.slice(0, 5), total_cambiados: cambiados.length });
    }
    return fin('al_dia', base);
}
export const CODIGOS_CHEQUEO = { al_dia: 0, hay_novedades: 2, sin_nube: 3, nube_incompleta: 3, sin_instalar: 5 };

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
        r.publicada = { version: pub.version, fecha: pub.fecha, firmada: !!pub.firma };
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
    const aportes = path.join(carpetaBuzon(nube), 'aportes');
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
    const aportes = path.join(nube ? carpetaBuzon(nube) : '', 'aportes');
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
/** Donde viaja Node en el pendrive: un solo archivo, que el instalador usa si la PC no tiene Node. */
export const NODE_EN_PENDRIVE = ['node', 'node.exe'];

export function armarPendrive({ origen, pendrive, lista, notas = [], forzar = false, ahora = new Date(), identidad = identidadLocal(), nodeExe = null, clavePrivada = null, sinFirma = false }) {
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
    const r = publicar({ origen, nube: res.base, lista, notas, forzar, ahora, identidad, clavePrivada, sinFirma });
    res.publicacion = r;
    res.avisos.push(...r.avisos);
    if (r.estado === 'rechazado') { res.errores.push(...r.errores); return res; }
    try {
        for (const [rel, abs] of instaladores) {
            copiarVerificando(abs, path.join(pendrive, path.basename(rel)), sha256Archivo(abs));
            res.copiados.push(path.basename(rel));
        }
        // la clave PUBLICA viaja en la raiz del pendrive para que el instalador la deje en la PC; la privada nunca
        const pub = clavePrivada ? path.join(path.dirname(clavePrivada), NOMBRE_CLAVE_PUBLICA) : null;
        if (pub && fs.existsSync(clavePrivada) && fs.existsSync(pub)) {
            copiarVerificando(pub, path.join(pendrive, NOMBRE_CLAVE_PUBLICA), sha256Archivo(pub));
            res.copiados.push(NOMBRE_CLAVE_PUBLICA);
        }
    } catch (e) { res.errores.push(`no pude copiar los archivos de instalacion: ${e.message}`); return res; }
    // Node viaja en el pendrive (Fak, 01/10/2026: "¿el pendrive no puede instalar node si no lo tenes?").
    // Es el mismo node.exe que corre este script: un archivo solo, sin instalador ni permisos de
    // administrador. Si ya esta y es identico no se vuelve a copiar (85 MB a un pendrive tardan).
    if (nodeExe) {
        try {
            const destinoNode = path.join(pendrive, ...NODE_EN_PENDRIVE);
            const hash = sha256Archivo(nodeExe);
            if (!(fs.existsSync(destinoNode) && sha256Archivo(destinoNode) === hash)) {
                fs.mkdirSync(path.dirname(destinoNode), { recursive: true });
                copiarVerificando(nodeExe, destinoNode, hash);
            }
            res.copiados.push(NODE_EN_PENDRIVE.join('/'));
            res.node = destinoNode;
        } catch (e) { res.avisos.push(`no pude dejar Node en el pendrive (${e.message}): el compañero va a necesitar tenerlo instalado`); }
    }
    res.estado = 'listo';
    return res;
}

// ---------------------------------------------------------------------------------------------
// INSTALAR (proyecto `area`): una PC sin nada queda lista para que la persona abra Claude en <home> (la raiz)
// ---------------------------------------------------------------------------------------------
// Orden: clave publica -> publicacion completa y firmada -> quien es (personas.json, verificado por hash
// antes de leerlo) -> perfil.json -> copia verificada de lo comun + lo de su area -> la casa (reglas, CLAUDE.md, Trabajo\) -> el plugin
// a nivel usuario (solo dos claves en settings.json, con respaldo) -> el marcador, AL FINAL.
// Es repetible: correrlo dos veces no cambia nada; una instalacion cortada se completa al repetir.

export const NOMBRE_MARKETPLACE = 'barack';
export const NOMBRE_PLUGIN = 'barack-area';
export const REL_REGLAS_CASA = '.claude/rules/casa.md';
export const MARCADOR_INSTALADO = 'instalado.json';

/** `<home>` del proyecto de areas: CLAUDE_AREA_HOME o `C:\ClaudeBarack` (las pruebas pasan siempre una carpeta temporal). */
export function rutaHomePorDefecto(env = process.env) {
    return env.CLAUDE_AREA_HOME ? path.resolve(env.CLAUDE_AREA_HOME) : 'C:\\ClaudeBarack';
}
/** Estado de la PC: CLAUDE_AREA_ESTADO o `%LOCALAPPDATA%\BarackEquipo`. */
export function rutaEstadoPorDefecto(env = process.env) {
    if (env.CLAUDE_AREA_ESTADO) return path.resolve(env.CLAUDE_AREA_ESTADO);
    return path.join(env.LOCALAPPDATA || path.join(env.USERPROFILE || os.homedir(), 'AppData', 'Local'), 'BarackEquipo');
}
/** La carpeta de configuracion de Claude Code del usuario: la misma que mira Claude (CLAUDE_CONFIG_DIR, o `~\.claude`). */
export function rutaClaudeDirPorDefecto(env = process.env) {
    return env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(env.USERPROFILE || os.homedir(), '.claude');
}

/** Busca a la persona en personas.json por usuario de Windows (sin mayusculas ni tildes) o, si no, por nombre de PC. Las bajas no cuentan. */
export function buscarPersona(personas, { usuario, pc }) {
    const lista = personas && Array.isArray(personas.personas) ? personas.personas : [];
    const activas = lista.filter((p) => p && typeof p === 'object' && !p.baja);
    const n = (s) => normTexto(String(s || ''));
    return activas.find((p) => n(p.usuario_windows) && n(p.usuario_windows) === n(usuario))
        || activas.find((p) => n(p.pc) && n(p.pc) === n(pc))
        || null;
}

/** El perfil.json del contrato a partir de la persona; si no figura, queda sin area asignada (`comun`) y sin nombre. */
export function armarPerfil({ persona, identidad }) {
    const area = persona && AREAS.includes(normTexto(persona.area || '')) ? normTexto(persona.area) : AREA_COMUN;
    const texto = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    return {
        nombre: persona ? texto(persona.nombre, 60) : '',
        mail: persona ? texto(persona.mail, 80) : '',
        area,
        puesto: persona ? texto(persona.puesto, 80) : '',
        rol: persona && persona.rol ? texto(persona.rol, 30) : 'usuario',
        pc: texto(identidad.pc, 40),
        usuario_windows: texto(identidad.usuario, 40),
    };
}

/**
 * La clave publica con la que esta PC verifica lo publicado: la indicada (--clave-publica), si no la ya fijada en
 * `<estado>\publicador.pub`, y si no hay ninguna, por UNICA vez la que viaja al lado de lo publicado
 * (`1- PUBLICADO\publicador.pub`), que queda fijada. RIESGO (confianza en el primer uso): quien pueda escribir en
 * la biblioteca en el momento de esa primera instalacion puede plantar su clave y su publicacion; desde la segunda
 * vez un cambio de clave se rechaza. La forma segura es que la primera clave llegue por el pendrive o la ponga
 * el administrador (`--clave-publica`).
 */
export function clavePublicaParaInstalar({ nube, estado, clavePublica = null, simular = false }) {
    const fijada = path.join(estado, NOMBRE_CLAVE_PUBLICA);
    const fijar = (desde, origen) => {
        const k = leerClavePublica(desde);
        if (k.error) return { error: k.error };
        if (fs.existsSync(fijada) && sha256Archivo(fijada) !== sha256Archivo(desde)) {
            return { error: `esta PC ya tiene fijada otra clave pública (${fijada}): un cambio de clave lo hace el administrador a mano` };
        }
        const pendienteFijar = !fs.existsSync(fijada);
        if (pendienteFijar && simular) return { ruta: desde, fijada, pendienteFijar, origen, huella: huellaClave(k.clave) };   // --simular: se usa la de origen, no se fija
        if (pendienteFijar) { fs.mkdirSync(estado, { recursive: true }); copiarVerificando(desde, fijada, sha256Archivo(desde)); }
        return { ruta: fijada, fijada, pendienteFijar: false, origen, huella: huellaClave(k.clave) };
    };
    if (clavePublica) return fijar(clavePublica, 'indicada');
    if (fs.existsSync(fijada)) {
        const k = leerClavePublica(fijada);
        return k.error ? { error: k.error } : { ruta: fijada, origen: 'fijada', huella: huellaClave(k.clave) };
    }
    const enNube = path.join(nube, NOMBRE_CLAVE_PUBLICA);
    if (fs.existsSync(enNube)) return fijar(enNube, 'nube_primera_vez');
    return { error: 'A esta PC le falta la clave para comprobar que la instalación es de Barack: avisale al administrador.' };
}

/**
 * Habilita el plugin a nivel usuario: agrega SOLO `extraKnownMarketplaces.barack` y `enabledPlugins["barack-area@barack"]`
 * al settings.json del usuario, con un respaldo antes y sin pisar ni reordenar nada mas. Un settings.json que no se
 * entiende no se toca. Devuelve { estado: 'habilitado'|'ya_estaba'|'error', ruta, respaldo }.
 */
export function habilitarPlugin({ claudeDir, rutaMarketplace, ahora = new Date(), simular = false }) {
    const ruta = path.join(claudeDir, 'settings.json');
    const idPlugin = `${NOMBRE_PLUGIN}@${NOMBRE_MARKETPLACE}`;
    const claves = [`extraKnownMarketplaces.${NOMBRE_MARKETPLACE} = { source: "directory", path: "${rutaMarketplace}" }`, `enabledPlugins["${idPlugin}"] = true`];
    let actual = {};
    let habia = false;
    if (fs.existsSync(ruta)) {
        habia = true;
        const texto = sinBom(fs.readFileSync(ruta, 'utf8'));
        if (texto.trim()) {
            try { actual = JSON.parse(texto); } catch { return { estado: 'error', ruta, error: `la configuración de Claude del usuario (${ruta}) no se entiende: no la toco. Que la revise el administrador` }; }
            if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return { estado: 'error', ruta, error: `la configuración de Claude del usuario (${ruta}) no tiene la forma esperada: no la toco` };
        }
    }
    const fuente = { source: 'directory', path: rutaMarketplace };
    const ekm = actual.extraKnownMarketplaces && typeof actual.extraKnownMarketplaces === 'object' ? actual.extraKnownMarketplaces : {};
    const ep = actual.enabledPlugins && typeof actual.enabledPlugins === 'object' ? actual.enabledPlugins : {};
    const yaMarket = ekm[NOMBRE_MARKETPLACE] && ekm[NOMBRE_MARKETPLACE].source && JSON.stringify(ordenarClaves(ekm[NOMBRE_MARKETPLACE].source)) === JSON.stringify(ordenarClaves(fuente));
    if (yaMarket && ep[idPlugin] === true) return { estado: 'ya_estaba', ruta, respaldo: null, claves };
    let respaldo = null;
    if (habia) {
        respaldo = `${ruta}.respaldo-${selloCarpeta(ahora)}`;
        for (let i = 2; fs.existsSync(respaldo); i++) respaldo = `${ruta}.respaldo-${selloCarpeta(ahora)}-${i}`;
    }
    if (simular) return { estado: 'habilitaria', ruta, respaldo, claves };
    if (respaldo) fs.copyFileSync(ruta, respaldo);
    const nuevo = {
        ...actual,
        extraKnownMarketplaces: { ...ekm, [NOMBRE_MARKETPLACE]: { ...(ekm[NOMBRE_MARKETPLACE] || {}), source: fuente } },
        enabledPlugins: { ...ep, [idPlugin]: true },
    };
    escribirAtomico(ruta, `${JSON.stringify(nuevo, null, 2)}\n`);   // sin reordenar las claves de la persona
    return { estado: 'habilitado', ruta, respaldo, claves };
}

/**
 * La persona abre Claude en `<home>` (la RAIZ, decision del 01/10/2026): asi `publicado\conocimiento\...` queda adentro
 * de la carpeta abierta y Claude Code lo lee sin pedir permiso. Las reglas de la casa van en `<home>\.claude\rules\casa.md`
 * (copia del casa/CLAUDE.md publicado; se regeneran en cada actualizacion); `<home>\CLAUDE.md` es de la persona y se
 * crea una sola vez, corto; `Trabajo\` es donde deja SUS archivos (con un LEEME si esta vacia). Migracion de la
 * version anterior, que ponia las reglas en `Trabajo\.claude\rules\casa.md`: ese archivo se lleva a la cuarentena de
 * lo publicado para que no queden dos copias; el `Trabajo\CLAUDE.md` de la persona no se toca.
 */
export function regenerarCasa({ home, publicado, perfil = null, simular = false, fuenteSimulada = null, ahora = new Date() }) {
    const res = { reglas: 'sin_cambios', claudeMd: 'sin_cambios', trabajo: 'sin_cambios', migrado: null, rutas: [] };
    // con --simular lo publicado todavia no se copio: para el plan se mira la copia de la nube (solo para listar la ruta)
    const enPublicado = path.join(publicado, 'casa', 'CLAUDE.md');
    const fuente = fs.existsSync(enPublicado) ? enPublicado : (simular && fuenteSimulada && fs.existsSync(fuenteSimulada) ? fuenteSimulada : null);
    const destino = path.join(home, ...REL_REGLAS_CASA.split('/'));
    if (!fuente) res.reglas = 'sin_fuente';
    else {
        const texto = `<!-- Reglas de la casa de Claude de Barack. Las deja la instalación y se actualizan solas: no editar acá. La copia maestra es publicado/casa/CLAUDE.md. -->\n\n${fs.readFileSync(fuente, 'utf8')}`;
        let actual = null;
        try { actual = fs.readFileSync(destino, 'utf8'); } catch { actual = null; }
        if (actual !== texto) {
            res.reglas = actual === null ? 'creado' : 'actualizado';
            res.rutas.push(destino);
            if (!simular) escribirAtomico(destino, texto);
        }
    }
    const cm = path.join(home, 'CLAUDE.md');
    if (!fs.existsSync(cm)) {
        const quien = perfil && perfil.nombre ? ` de ${perfil.nombre}` : '';
        res.claudeMd = 'creado';
        res.rutas.push(cm);
        if (!simular) escribirAtomico(cm, `# Claude de Barack Mercosul${quien}\n\nAcá se trabaja. Tus archivos van en la carpeta \`Trabajo\`. Lo que llega de la nube está en \`publicado\` y no se toca a mano (se repone solo). Las reglas de la casa están en \`.claude/rules/casa.md\` y se actualizan solas: no hace falta tocarlas.\n`);
    }
    // Trabajo\: la carpeta de la persona. Si no existe o esta vacia, un LEEME corto; si tiene cosas, no se toca.
    const trabajo = path.join(home, 'Trabajo');
    const leeme = path.join(trabajo, 'LEEME.txt');
    let vacia = true;
    try { vacia = fs.readdirSync(trabajo).length === 0; } catch { vacia = true; }
    if (vacia) {
        res.trabajo = 'creado';
        res.rutas.push(leeme);
        if (!simular) escribirAtomico(leeme, 'Esta carpeta es tuya: aca van tus archivos (planillas, notas, lo que armes con Claude).\r\nLo que llega de la nube esta en la carpeta "publicado", al lado, y no se toca a mano: se repone solo.\r\n');
    }
    // migracion: las reglas de la version anterior vivian en Trabajo\.claude\rules\casa.md -> a la cuarentena (nada se borra)
    const viejo = path.join(trabajo, ...REL_REGLAS_CASA.split('/'));
    if (fs.existsSync(viejo)) {
        const aDonde = path.join(publicado, ...REL_CUARENTENA.split('/'), selloCarpeta(ahora), 'Trabajo', ...REL_REGLAS_CASA.split('/'));
        res.migrado = aDonde;
        res.rutas.push(aDonde);
        if (!simular) moverACuarentena(viejo, aDonde);
    }
    return res;
}

/** ¿`ruta` esta adentro de un repo git? Devuelve la raiz del repo o null. */
export function dentroDeRepoGit(ruta) {
    let d = path.resolve(ruta || '.');
    for (;;) {
        if (fs.existsSync(path.join(d, '.git'))) return d;
        const p = path.dirname(d);
        if (p === d) return null;
        d = p;
    }
}

/**
 * Señales de que esta es la PC del administrador (la que publica), donde una instalacion DE VERDAD no corre sola:
 * tiene la clave privada de firma en su lugar real, la carpeta de la PC esta adentro de un repo git, o este programa
 * corre desde el repo de origen (el que tiene la lista de publicacion). Devuelve la lista de motivos (vacia = no).
 */
export function pcDelAdministrador({ env = process.env, home, raizScript = null }) {
    const motivos = [];
    const clave = rutaClavePrivadaPorDefecto(env);
    if (fs.existsSync(clave)) motivos.push(`tiene la clave privada de firma (${clave})`);
    const repoHome = home ? dentroDeRepoGit(home) : null;
    if (repoHome) motivos.push(`la carpeta de la PC está adentro de un repo git (${repoHome})`);
    if (raizScript && dentroDeRepoGit(raizScript) && fs.existsSync(path.join(raizScript, ...REL_LISTA.split('/')))) motivos.push(`este programa corre desde el repo de origen (${raizScript})`);
    return motivos;
}

/**
 * Todo o nada: o todas las rutas son las reales (instalacion de verdad) o todas son de prueba. Una mezcla —carpetas
 * temporales para la PC pero el settings.json real, o una nube temporal con la salud en la real— no corre.
 * `indicadores` dice, por ruta, si vino indicada (prueba) o se toma la real; `cuales` son las que cuentan para
 * ese comando. Devuelve null o el mensaje de una linea.
 */
export function mezclaPruebaReal(indicadores, cuales) {
    const NOMBRES = {
        home: 'la carpeta de la PC (--home / CLAUDE_AREA_HOME)', nube: 'la nube (--nube / CLAUDE_AREA_NUBE)',
        estado: 'el estado de la PC (CLAUDE_AREA_ESTADO)', usuarioHome: 'la configuración de Claude del usuario (--usuario-home)',
    };
    const dePrueba = cuales.filter((c) => indicadores[c]);
    const reales = cuales.filter((c) => !indicadores[c]);
    if (!dePrueba.length || !reales.length) return null;
    return `estás mezclando carpetas de prueba y reales. De prueba: ${dePrueba.map((c) => NOMBRES[c]).join(', ')}. Reales: ${reales.map((c) => NOMBRES[c]).join(', ')}. O todas de prueba o ninguna. No se tocó nada.`;
}

/** Un aviso para el administrador en el buzon, con el formato del contrato (lo lee el tablero). */
function dejarAvisoInstalacion({ nube, identidad, area, tipo, mensaje, ahora }) {
    const dir = path.join(carpetaBuzon(nube), 'avisos', nombrePcCarpeta(identidad.pc));
    const cuerpo = { nivel: 'hoy', tipo, mensaje, cuando: isoLocal(ahora), pc: identidad.pc || '', usuario_windows: identidad.usuario || '', area, origen: 'instalador' };
    const base = `${isoLocal(ahora).replace(/:/g, '')}-${tipo}`;
    let ruta = path.join(dir, `${base}.json`);
    for (let i = 2; fs.existsSync(ruta); i++) ruta = path.join(dir, `${base}-${i}.json`);
    escribirAtomico(ruta, `${JSON.stringify(cuerpo, null, 2)}\n`);
    return ruta;
}

/**
 * @returns {{estado:'instalado'|'ya_instalado'|'esperar'|'sin_clave'|'firma_rechazada'|'version_anterior'|'error', ...}}
 * `antesDe(paso)` es un gancho de las pruebas: se llama antes de cada paso ('clave', 'publicacion', 'persona', 'copia',
 * 'trabajo', 'plugin', 'marcador') y sirve para simular un corte.
 */
export function instalar({ nube, home, estado, claudeDir, clavePublica = null, identidad = identidadLocal(), ahora = new Date(), antesDe = null, simular = false, env = process.env }) {
    const res = { estado: 'error', errores: [], avisos: [], pasos: [], plan: [], home, estado_dir: estado, claudeDir };
    const paso = (n) => { res.pasos.push(n); if (antesDe) antesDe(n); };
    const anotar = (que, ruta) => res.plan.push({ que, ruta });   // con --simular es TODO lo que se escribiria; sin el, lo que se escribio
    if (!nube || !fs.existsSync(nube)) { res.estado = 'esperar'; res.mensaje = 'No encuentro la carpeta publicada de la nube: ¿OneDrive ya la bajó? Probá de nuevo en un rato.'; return res; }
    if (!home || !estado || !claudeDir) { res.errores.push('falta la carpeta de la PC, la de estado o la de configuración de Claude (CLAUDE_AREA_HOME, CLAUDE_AREA_ESTADO, --usuario-home o sus opciones)'); return res; }
    const publicado = path.join(home, 'publicado');
    res.publicado = publicado;

    // 1) la clave publica con la que esta PC va a comprobar TODO lo que baje
    paso('clave');
    const k = clavePublicaParaInstalar({ nube, estado, clavePublica, simular });
    if (k.error) { res.estado = 'sin_clave'; res.mensaje = k.error; res.errores.push(k.error); return res; }
    res.clave = k;
    if (k.pendienteFijar || k.origen === 'nube_primera_vez' || (k.origen === 'indicada' && k.ruta === k.fijada && !simular)) anotar('clave pública fijada', k.fijada);
    if (k.origen === 'nube_primera_vez') res.avisos.push(`la clave pública se ${simular ? 'tomaría' : 'tomó'} de la nube por primera vez (huella ${k.huella}) y ${simular ? 'quedaría' : 'quedó'} fijada en esta PC: desde ahí un cambio de clave se rechaza`);

    // 2) la publicacion: completa y firmada con esa clave
    paso('publicacion');
    const pub = leerPublicacion(nube);
    if (pub.estado === 'manifiesto_invalido') { res.errores.push(`${pub.mensaje}: ${(pub.problemas || []).slice(0, 5).join(' | ')}`); return res; }
    if (pub.estado !== 'ok') { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (${pub.mensaje})`; return res; }
    const kp = leerClavePublica(k.ruta);
    if (kp.error) { res.errores.push(kp.error); return res; }
    const v = verificarFirma({ nube, bytesManifiesto: pub.bytesManifiesto, clavePublica: kp.clave, infoVersion: pub.info });
    res.firma = v.estado;
    if (v.estado === 'firma_pendiente') { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (${v.mensaje})`; return res; }
    if (v.estado !== 'valida') { res.estado = 'firma_rechazada'; res.mensaje = `${MSJ_FIRMA_RECHAZADA} ${v.mensaje}`; res.errores.push(v.mensaje); return res; }
    res.version = pub.version;

    // 3) quien es: personas.json se verifica por hash contra el manifiesto firmado ANTES de leerlo
    paso('persona');
    const relPersonas = ['conocimiento/personas.json', 'conocimiento/comun/personas.json'].find((r) => pub.manifiesto.archivos[r]);
    let personas = null;
    if (relPersonas) {
        const vp = verificarContenido(nube, pub.manifiesto, new Set([relPersonas]));
        if (!vp.ok) { res.estado = 'esperar'; res.mensaje = `${MSJ_BAJANDO} (todavía no bajó la lista de personas)`; return res; }
        personas = leerJson(path.join(nube, 'contenido', ...relPersonas.split('/')));
        if (!personas) res.avisos.push('la lista de personas no se pudo leer: la PC queda sin área asignada');
    } else res.avisos.push('lo publicado no trae la lista de personas: la PC queda sin área asignada');
    const persona = buscarPersona(personas, identidad);
    const perfil = armarPerfil({ persona, identidad });
    res.perfil = perfil;
    res.persona = !!persona;
    const pPerfil = path.join(home, 'perfil.json');
    const textoPerfil = jsonCanonico(perfil);
    let perfilActual = null;
    try { perfilActual = fs.readFileSync(pPerfil, 'utf8'); } catch { perfilActual = null; }
    const perfilCambia = perfilActual !== textoPerfil;
    if (perfilCambia) {
        if (perfilActual !== null) { anotar('copia del perfil anterior', `${pPerfil}.anterior-${selloCarpeta(ahora)}`); if (!simular) fs.copyFileSync(pPerfil, `${pPerfil}.anterior-${selloCarpeta(ahora)}`); }   // nada se pisa sin copia
        anotar(perfilActual === null ? 'perfil nuevo' : 'perfil actualizado', pPerfil);
        if (!simular) escribirAtomico(pPerfil, textoPerfil);
    }

    // 4) la copia verificada de lo comun + lo de su area (misma logica que --actualizar: nunca pisa, nunca borra)
    paso('copia');
    const act = actualizar({ destino: publicado, nube, clavePublica: k.ruta, proyecto: 'area', area: perfil.area, identidad, ahora, home: simular ? null : home, simular, env });
    res.actualizacion = act;
    if (act.estado !== 'actualizado' && act.estado !== 'al_dia' && act.estado !== 'simulado') {
        res.errores.push(...act.errores);
        if (act.mensaje) res.mensaje = act.mensaje;
        res.estado = ['esperar', 'sin_clave', 'firma_rechazada', 'version_anterior'].includes(act.estado) ? act.estado : 'error';
        return res;
    }
    for (const p of act.plan || []) if (p.que === 'nuevo' || p.que === 'actualizar') anotar(`archivo publicado (${p.que})`, path.join(publicado, ...p.rel.split('/')));
    if (act.respaldo) anotar('respaldo de lo reemplazado', act.respaldo);

    // 5) la casa: las reglas en <home>\.claude\rules\casa.md, el CLAUDE.md de la persona (solo si no existe) y Trabajo\
    paso('casa');
    res.casa = regenerarCasa({ home, publicado, perfil, simular, fuenteSimulada: path.join(nube, 'contenido', 'casa', 'CLAUDE.md'), ahora });
    // la migracion de Trabajo\.claude\rules la puede haber hecho ya el --actualizar de arriba: se informa igual
    if (!res.casa.migrado && act.casa && act.casa.migrado) { res.casa.migrado = act.casa.migrado; res.casa.rutas.push(act.casa.migrado); }
    for (const r of res.casa.rutas) anotar('casa (reglas, CLAUDE.md de la persona, Trabajo)', r);

    // 6) el plugin, a nivel usuario, con lo minimo en settings.json
    paso('plugin');
    const marketplace = path.join(publicado, 'marketplace');
    const traePlugin = fs.existsSync(path.join(marketplace, '.claude-plugin', 'marketplace.json')) || (simular && pub.manifiesto.archivos['marketplace/.claude-plugin/marketplace.json']);
    if (!traePlugin) {
        res.errores.push('lo publicado no trae el plugin (falta marketplace/.claude-plugin/marketplace.json): la instalación queda incompleta y sin marcador');
        return res;
    }
    const hp = habilitarPlugin({ claudeDir, rutaMarketplace: marketplace, ahora, simular });
    if (hp.estado === 'error') { res.errores.push(hp.error); return res; }
    res.plugin = hp;
    if (hp.estado !== 'ya_estaba') {
        if (hp.respaldo) anotar('respaldo de settings.json', hp.respaldo);
        anotar(`settings.json del usuario (${hp.claves.join(' · ')})`, hp.ruta);
    }

    // 7) si la persona no figura, el administrador se entera (una vez por perfil escrito, no en cada corrida)
    if (!persona && perfilCambia) {
        if (simular) anotar('aviso "sin persona" al buzón', path.join(carpetaBuzon(nube), 'avisos', nombrePcCarpeta(identidad.pc)));
        else {
            try { res.avisoSinPersona = dejarAvisoInstalacion({ nube, identidad, area: perfil.area, tipo: 'sin-persona', mensaje: `${identidad.usuario || 'alguien'} en ${identidad.pc || 'una PC'} no figura en la lista de personas: quedó instalada sin área asignada`, ahora }); anotar('aviso "sin persona" al buzón', res.avisoSinPersona); }
            catch (e) { res.avisos.push(`no pude dejar el aviso de persona sin asignar: ${e.message}`); }
        }
    }

    // 8) el marcador, AL FINAL (si ya estaba igual, no se reescribe: correr dos veces no cambia nada)
    paso('marcador');
    const pMarcador = path.join(home, MARCADOR_INSTALADO);
    const previo = leerJson(pMarcador);
    const marcador = { formato: FORMATO, version: pub.version, area: perfil.area, usuario_windows: perfil.usuario_windows, pc: perfil.pc, plugin: `${NOMBRE_PLUGIN}@${NOMBRE_MARKETPLACE}`, claude_dir: claudeDir, clave: k.huella, instalado: previo && previo.instalado ? previo.instalado : isoLocal(ahora), ultima_vez: isoLocal(ahora) };
    const sinCambios = previo && previo.version === marcador.version && previo.area === marcador.area && previo.clave === marcador.clave && act.estado === 'al_dia' && hp.estado === 'ya_estaba' && !perfilCambia;
    if (!sinCambios) { anotar('marcador de instalado (al final)', pMarcador); if (!simular) escribirAtomico(pMarcador, jsonCanonico(marcador)); }
    const rutaSalud = path.join(carpetaBuzon(nube), 'salud', `${nombrePcCarpeta(identidad.pc)}.json`);
    anotar('salud de esta PC en el buzón', rutaSalud);
    if (simular) { res.estado = 'simulado'; res.version = pub.version; return res; }
    try { res.salud = escribirSalud({ nube, salud: { ...armarSalud({ destino: publicado, res: { ...act, estado: sinCambios ? 'al_dia' : 'instalado', errores: [] }, identidad, ahora }), area: perfil.area } }); }
    catch (e) { res.avisos.push(`no pude dejar la salud de esta PC en la nube: ${e.message}`); }
    res.estado = sinCambios ? 'ya_instalado' : 'instalado';
    return res;
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

/** Las opciones que existen. Cualquier otra cosa es un error: un argumento mal escrito NO se ignora (01/10/2026: un `--help` ignorado instalo de verdad). */
export const OPCIONES_CON_VALOR = ['nube', 'origen', 'destino', 'lista', 'nota', 'autor', 'que', 'aportar', 'perfil', 'pendrive', 'area', 'proyecto', 'clave', 'clave-publica', 'rollback', 'motivo', 'home', 'usuario-home', 'claude-dir'];
export const OPCIONES_BANDERA = ['publicar', 'actualizar', 'instalar', 'ver', 'aportes', 'donde', 'generar-clave', 'chequear', 'simular', 'forzar', 'reponer', 'sin-firma', 'nube-real'];

export function parsearArgs(argv) {
    const a = { notas: [] };
    const conValor = new Set(OPCIONES_CON_VALOR);
    const banderas = new Set(OPCIONES_BANDERA);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h' || arg === '/?') { a.help = true; continue; }
        if (!arg.startsWith('--')) { a.error = `no entiendo "${arg}": las opciones empiezan con -- (probá --help)`; break; }
        const k = arg.slice(2);
        if (conValor.has(k)) {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) { a.error = `--${k} necesita un valor`; break; }
            if (k === 'nota') a.notas.push(v); else a[k] = v;
            i++;
        } else if (banderas.has(k)) a[k] = true;
        else { a.error = `opción desconocida: ${arg} (probá --help). No se hizo nada`; break; }
    }
    if (a['claude-dir'] && !a['usuario-home']) a['usuario-home'] = a['claude-dir'];   // nombre viejo de la misma opcion
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

/**
 * Proyecto, nube, destino y claves a partir de los argumentos y de las variables del CONTRATO:
 *   CLAUDE_AREA_NUBE   la carpeta `CLAUDE POR AREA` (la nube publicada es su `1- PUBLICADO`); implica --proyecto area
 *   CLAUDE_AREA_HOME   la carpeta de la PC (`C:\ClaudeBarack`): el destino es su `publicado\`
 *   CLAUDE_AREA_CLAVE  la clave privada de firma (solo la PC que publica)
 *   CLAUDE_AREA_ESTADO la carpeta de estado de la PC, donde puede estar `publicador.pub`
 * --nube, --destino, --clave y --clave-publica le ganan a las variables.
 */
export function resolverEntorno(a, env = process.env, raiz = RAIZ) {
    const proyecto = a.proyecto || (env.CLAUDE_AREA_NUBE ? 'area' : PROYECTO_POR_DEFECTO);
    if (!PROYECTOS[proyecto]) return { error: `--proyecto tiene que ser ${Object.keys(PROYECTOS).join(' o ')}` };
    const esArea = proyecto === 'area';
    const nube = a.nube ? path.resolve(a.nube)
        : (esArea && env.CLAUDE_AREA_NUBE) ? path.join(path.resolve(env.CLAUDE_AREA_NUBE), PROYECTOS.area.publicado)
            : buscarNube(env.USERPROFILE || os.homedir(), proyecto);
    const origen = path.resolve(a.origen || raiz);
    // la PC del proyecto de areas: --home, CLAUDE_AREA_HOME o C:\ClaudeBarack (y su `publicado\` es el destino)
    const homeIndicado = !!(a.home || env.CLAUDE_AREA_HOME);
    const home = a.home ? path.resolve(a.home) : (env.CLAUDE_AREA_HOME ? path.resolve(env.CLAUDE_AREA_HOME) : (esArea ? rutaHomePorDefecto(env) : null));
    const destino = path.resolve(a.destino || ((esArea && home) ? path.join(home, 'publicado') : raiz));
    const estado = rutaEstadoPorDefecto(env);
    const claudeDir = a['usuario-home'] ? path.resolve(a['usuario-home']) : rutaClaudeDirPorDefecto(env);
    const clavePrivada = a.clave ? path.resolve(a.clave) : rutaClavePrivadaPorDefecto(env);
    const clavePublica = a['clave-publica'] ? path.resolve(a['clave-publica']) : buscarClavePublica(env);
    // que rutas vinieron INDICADAS (prueba) y cuales se toman reales: la regla "todo o nada" de --instalar / --actualizar en area
    const indicadores = { home: homeIndicado, destino: !!a.destino, nube: !!(a.nube || env.CLAUDE_AREA_NUBE), estado: !!env.CLAUDE_AREA_ESTADO, usuarioHome: !!a['usuario-home'] };
    const nubeAutomatica = !a.nube && !env.CLAUDE_AREA_NUBE;
    return { proyecto, nube, origen, destino, home, homeIndicado, estado, claudeDir, clavePrivada, clavePublica, indicadores, nubeAutomatica };
}

function imprimirUso() {
    say('Uso: node scripts/_paquete.mjs --publicar | --ver | --actualizar | --chequear | --aportar <ruta> | --aportes | --perfil "Nombre Apellido - Sector"');
    say('     Fak: --pendrive <carpeta del pendrive> (arma Base + el instalador) · --donde (muestra la carpeta de la nube)');
    say('          --generar-clave (una vez: el par de claves de firma) · --publicar --rollback <N> (vuelve a la version N)');
    say('     PC nueva del proyecto de areas: --instalar --proyecto area [--simular] [--home <carpeta>] [--usuario-home <carpeta .claude>] [--clave-publica <archivo>] [--forzar]');
    say('       (para PROBAR: CLAUDE_AREA_HOME, CLAUDE_AREA_NUBE, CLAUDE_AREA_ESTADO y --usuario-home, TODAS; una mezcla de prueba y real no corre)');
    say('     opciones: --nota "texto" · --simular · --forzar · --reponer · --area <id> · --proyecto area|ingenieria · --autor "..." · --que "..."');
    say('              --nube <carpeta> · --destino <carpeta> · --clave <archivo> · --clave-publica <archivo> · --sin-firma · --motivo "..." · --nube-real');
    say('     --help muestra esto y no hace nada. Una opcion que no existe es un error y tampoco hace nada.');
}

function main() {
    const a = parsearArgs(process.argv.slice(2));
    if (a.error) { console.error(`✗ ${a.error}`); return 1; }
    if (a.help) { imprimirUso(); return 0; }
    const ent = resolverEntorno(a);
    if (ent.error) { console.error(`✗ ${ent.error}`); return 1; }
    const { proyecto, nube, origen, destino, home, homeIndicado, estado, claudeDir, clavePrivada, clavePublica, indicadores, nubeAutomatica } = ent;
    const modos = ['publicar', 'actualizar', 'instalar', 'ver', 'aportar', 'aportes', 'perfil', 'pendrive', 'donde', 'generar-clave', 'chequear'].filter((k) => a[k]);
    if (modos.length !== 1) { imprimirUso(); return modos.length ? 1 : 0; }
    const modo = modos[0];
    if (a.rollback !== undefined && !/^\d+$/.test(String(a.rollback))) { console.error('✗ --rollback necesita el numero de una version publicada (ej: --rollback 3)'); return 1; }

    if (modo === 'instalar') {
        if (proyecto !== 'area' && !exigeFirma({ nube, proyecto })) { console.error('✗ --instalar es del proyecto de áreas: pasá --proyecto area (o la variable CLAUDE_AREA_NUBE)'); return 1; }
        // todo o nada: carpetas de prueba para la PC pero el settings.json real (o al reves) no corre
        const mezcla = mezclaPruebaReal(indicadores, ['home', 'nube', 'estado', 'usuarioHome']);
        if (mezcla) { console.error(`✗ ${mezcla} Para probar: CLAUDE_AREA_HOME, CLAUDE_AREA_NUBE, CLAUDE_AREA_ESTADO y --usuario-home, las cuatro.`); return 1; }
        // la PC del administrador no se instala sola de verdad
        if (!indicadores.home && !a.forzar) {
            const motivos = pcDelAdministrador({ env: process.env, home, raizScript: RAIZ });
            if (motivos.length) { console.error(`✗ Esta parece la PC del administrador (${motivos.join('; ')}): acá una instalación de verdad no corre sola. Si de verdad querés, pasá --forzar. No se tocó nada.`); return 1; }
        }
        const r = instalar({ nube, home, estado, claudeDir, clavePublica: a['clave-publica'] ? path.resolve(a['clave-publica']) : null, identidad: identidadLocal(), simular: !!a.simular });
        if (r.estado === 'simulado') {
            say(`Simulado: --instalar (versión ${r.version}, ${r.perfil.nombre || 'persona sin asignar'}, área ${r.perfil.area}) escribiría ${r.plan.length} cosa(s) y no escribió ninguna:`);
            for (const p of r.plan) say(`    - ${p.ruta}  (${p.que})`);
            imprimirLista('  Avisos:', r.avisos, 10);
            return 0;
        }
        if (r.estado === 'esperar') { say(`⏳ ${r.mensaje}`); return 3; }
        if (r.estado === 'sin_clave' || r.estado === 'firma_rechazada' || r.estado === 'version_anterior') { console.error(`✗ ${r.mensaje || r.errores.join(' ')}`); return CODIGO_SALIDA_FIRMA; }
        if (r.estado === 'error') {
            console.error(`✗ No quedó instalado (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 20)) console.error(`    - ${e}`);
            return 1;
        }
        const quien = r.perfil.nombre ? `${r.perfil.nombre} (área ${r.perfil.area})` : `persona sin asignar (área ${r.perfil.area}): el administrador ya tiene el aviso`;
        say(`✓ ${r.estado === 'ya_instalado' ? 'Ya estaba instalado' : 'Instalado'}: versión ${r.version}, ${quien}.`);
        say(`  Abrí Claude en ${r.home} (tus archivos van en ${path.join(r.home, 'Trabajo')}).   Plugin: ${r.plugin.estado === 'habilitado' ? `habilitado en ${r.plugin.ruta}` : 'ya estaba habilitado'}${r.plugin.respaldo ? ` (respaldo: ${r.plugin.respaldo})` : ''}`);
        if (r.casa && r.casa.migrado) say(`  Las reglas viejas de Trabajo\\.claude\\rules pasaron a cuarentena: ${r.casa.migrado}`);
        imprimirLista('  Avisos:', r.avisos, 10);
        return 0;
    }

    if (modo === 'donde') {
        if (nube && fs.existsSync(nube)) { say(nube); return 0; }
        console.error(`✗ no encuentro la carpeta "${nombreNube(proyecto)}" en la biblioteca sincronizada`);
        return 1;
    }

    if (modo === 'generar-clave') {
        const r = generarClave({ rutaClave: clavePrivada });
        if (r.estado !== 'creada') { console.error(`✗ ${r.errores.join(' ')}`); return 1; }
        say(`✓ Clave de firma creada (huella ${r.huella}).`);
        say(`  Privada: ${r.clave}  <- se queda en esta PC. No va al repo ni a la nube.`);
        say(`  Pública: ${r.publica}  <- esta es la que se instala en cada PC (el pendrive la lleva).`);
        imprimirLista('  Avisos:', r.avisos, 5);
        return 0;
    }

    if (modo === 'chequear') {
        const r = chequear({ destino, nube });
        say(JSON.stringify(r));
        return CODIGOS_CHEQUEO[r.estado] ?? 1;
    }

    if (modo === 'pendrive') {
        const rutaLista = path.resolve(a.lista || path.join(origen, ...REL_LISTA.split('/')));
        let lista;
        try { lista = cargarLista(rutaLista); } catch (e) { console.error(`✗ ${e.message}`); return 1; }
        const nodeExe = process.platform === 'win32' && /node\.exe$/i.test(process.execPath) ? process.execPath : null;
        const r = armarPendrive({ origen, pendrive: path.resolve(a.pendrive), lista, notas: a.notas, forzar: !!a.forzar, nodeExe, clavePrivada, sinFirma: !!a['sin-firma'] });
        say(`Pendrive → ${r.pendrive}`);
        if (r.estado !== 'listo') {
            console.error(`\n✗ NO QUEDO LISTO (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 40)) console.error(`    - ${e}`);
            return 1;
        }
        const p = r.publicacion;
        say(`  Base: versión ${p.version} (${p.estado === 'sin_novedades' ? 'ya estaba al día' : `${p.archivos} archivos, ${kb(p.bytes)}`})${p.firmada ? ', firmada' : ''}`);
        say(`  Instalador: ${r.copiados.join(', ')}`);
        imprimirLista(`  Avisos (no frenan):`, r.avisos, 15);
        say('\n✓ Listo. En la PC del compañero: doble click en Instalar.cmd del pendrive.');
        return 0;
    }

    if (modo === 'publicar') {
        // en el proyecto de areas la nube no se adivina para publicar: o se indica, o se confirma que es la real
        if (proyecto === 'area' && nubeAutomatica && !a['nube-real']) { console.error('✗ Sin --nube ni CLAUDE_AREA_NUBE esto publicaría a la nube REAL del proyecto de áreas. Si es eso lo que querés, pasá --nube-real. No se hizo nada.'); return 1; }
        const rutaLista = path.resolve(a.lista || path.join(origen, ...REL_LISTA.split('/')));
        let lista = null;
        if (a.rollback === undefined) { try { lista = cargarLista(rutaLista); } catch (e) { console.error(`✗ ${e.message}`); return 1; } }
        const r = publicar({ origen, nube, lista, notas: a.notas, simular: !!a.simular, forzar: !!a.forzar, clavePrivada, sinFirma: !!a['sin-firma'], rollback: a.rollback === undefined ? null : Number(a.rollback), motivoRetiro: a.motivo || null, proyecto });
        say(`Base de Claude → ${nube || '(sin carpeta de nube)'}`);
        if (r.estado === 'rechazado') {
            console.error(`\n✗ NO SE PUBLICO NADA (${r.errores.length} problema(s)):`);
            for (const e of r.errores.slice(0, 40)) console.error(`    - ${e}`);
            if (r.errores.length > 40) console.error(`    ... y ${r.errores.length - 40} mas`);
            return 1;
        }
        if (r.rollback) say(`  Vuelta a la versión ${r.rollback} (se publica como versión nueva)`);
        imprimirLista(`  Nuevos (${r.nuevos.length}):`, r.nuevos);
        imprimirLista(`  Cambiados (${r.cambiados.length}):`, r.cambiados);
        imprimirLista(`  Cambiaron de área (${r.areasCambiadas.length}):`, r.areasCambiadas);
        imprimirLista(`  Retirados (${r.retirados.length}; en la nube quedan; en cada PC pasan a cuarentena si están como se publicaron):`, r.retirados);
        imprimirLista(`  En la nube y fuera de la lista (no se borran):`, r.sobrantes);
        imprimirLista(`  Avisos (no frenan):`, r.avisos, 15);
        if (r.estado === 'sin_novedades') { say(`\nSin novedades: lo publicado (version ${r.version}) ya es igual a la lista. Con --forzar se republica igual.`); return 0; }
        if (r.estado === 'simulado') { say(`\nSimulado: se publicaria la version ${r.version}${r.lapidas ? ` con ${r.lapidas} lápida(s)` : ''}. No se escribio nada.`); return 0; }
        say(`\n✓ Publicada la version ${r.version}: ${r.archivos} archivos, ${kb(r.bytes)}, ${r.firmada ? `firmada (${r.ms_firma.toFixed(1)} ms)` : 'SIN FIRMA'}${r.lapidas ? `, ${r.lapidas} lápida(s)` : ''}. VERSION.json se escribio al final.`);
        return 0;
    }

    if (modo === 'actualizar') {
        const enArea = exigeFirma({ nube, proyecto });
        if (enArea) {
            // todo o nada tambien aca: un --destino de prueba con la nube real escribiria la salud de una PC falsa en el buzon real
            const mezcla = mezclaPruebaReal({ ...indicadores, home: indicadores.home || indicadores.destino }, ['home', 'nube', 'estado']);
            if (mezcla) { console.error(`✗ ${mezcla}`); return 1; }
        }
        // las reglas de la casa se regeneran solo con una carpeta de PC INDICADA (--home / CLAUDE_AREA_HOME): nunca con la real por defecto
        const r = actualizar({ destino, nube, reponer: !!a.reponer, simular: !!a.simular, area: a.area || null, clavePublica, proyecto, home: enArea && homeIndicado ? home : null });
        const pie = () => { if (r.salud) say(`  Salud de esta PC: ${r.salud}`); for (const av of r.avisos || []) say(`  Aviso: ${av}`); };
        if (r.estado === 'esperar') { say(`⏳ ${r.mensaje}`); pie(); return 3; }
        if (r.estado === 'ocupado') { say(`⏳ ${r.mensaje}`); return 3; }
        if (r.estado === 'firma_rechazada' || r.estado === 'sin_clave' || r.estado === 'version_anterior') { console.error(`✗ ${r.mensaje}`); pie(); return CODIGO_SALIDA_FIRMA; }
        const firmaTxt = r.firma === 'valida' ? 'firma verificada' : 'esta PC no tiene la clave pública: la firma no se verificó';
        const areaTxt = r.area ? `área ${r.area}` : 'solo lo común (esta PC no tiene área)';
        if (r.estado === 'al_dia') { say(`Al dia: version ${r.version} (${firmaTxt}; ${areaTxt}).`); pie(); return 0; }
        const c = r.contadores;
        if (r.errores.length && r.estado === 'error') {
            console.error('✗ No se actualizo:');
            for (const e of r.errores.slice(0, 20)) console.error(`    - ${e}`);
            if (!c.nuevos && !c.actualizados && !c.cuarentena) { pie(); return 1; }
        }
        say(`${r.estado === 'simulado' ? 'Simulado' : 'Actualizado'} a la version ${r.version}: ${c.nuevos} nuevos · ${c.actualizados} actualizados · ${c.iguales} iguales · ${c.propios} tuyos sin novedad de Fak${c.repuestos ? ` · ${c.repuestos} repuestos` : ''}${c.fuera_de_area ? ` · ${c.fuera_de_area} de otras áreas (no se tocan)` : ''}`);
        say(`  ${firmaTxt}; ${areaTxt}`);
        imprimirLista(`  ${r.estado === 'simulado' ? 'Se repondrían' : 'Repuestos'} desde la nube (faltaban o estaban cambiados; lo cambiado quedó en cuarentena) (${r.repuestos.length}):`, r.repuestos.map((x) => `${x.rel} (${x.motivo})`));
        imprimirLista(`  En publicado y fuera de lo publicado (no se borran; quedan anotados en la salud) (${r.extranos.length}):`, r.extranos);
        if (r.casa && r.casa.migrado) say(`  Las reglas viejas de Trabajo\\.claude\\rules pasaron a cuarentena: ${r.casa.migrado}`);
        imprimirLista(`  Con version nueva de Fak, pero tocaste el tuyo — quedo al lado como ${SUFIJO_NUEVA} (${r.tocados.length}):`, r.tocados);
        imprimirLista(`  Los sacaste vos (no se repusieron; --reponer los trae) (${r.sacados.length}):`, r.sacados);
        if (r.carpetaCuarentena) {
            const lista = r.plan.filter((p) => p.que === 'cuarentena').map((p) => `${p.rel}  ->  ${path.join(r.carpetaCuarentena, ...p.rel.split('/'))}`);
            imprimirLista(`  ${r.estado === 'simulado' ? 'Pasarían' : 'Pasaron'} a cuarentena (retirados de la base, estaban como se publicaron; nada se borra) (${lista.length}):`, lista, 50);
        }
        imprimirLista(`  Fak los retiró pero vos los habías cambiado (quedan en tu PC) (${r.retiradosTuyos.length}):`, r.retiradosTuyos);
        imprimirLista(`  Fak dejo de publicarlos (siguen en tu PC) (${r.retirados.length}):`, r.retirados);
        if (r.respaldo) say(`  Respaldo de lo reemplazado: ${r.respaldo}`);
        if (r.tocados.length || r.sacados.length || r.retirados.length || r.retiradosTuyos.length) say(`  Detalle: ${REL_PENDIENTES}`);
        pie();
        return r.errores.length ? 1 : 0;
    }

    if (modo === 'ver') {
        const r = ver({ destino, nube });
        say(r.instalada ? `Instalada en esta PC: version ${r.instalada.version} (${r.instalada.fecha})` : 'Instalada en esta PC: nada (esta PC no recibe la base, o todavia no se instalo)');
        if (r.estadoNube === 'sin_nube') say(`Nube: no encuentro la carpeta "${nombreNube(proyecto)}"`);
        else if (r.publicada) say(`Publicada en la nube: version ${r.publicada.version} (${r.publicada.fecha}${r.publicada.firmada ? ', firmada' : ', sin firma'})`);
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
