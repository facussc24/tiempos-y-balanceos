#!/usr/bin/env node
/**
 * Arma el paquete "el Claude de Ingenieria para otra persona" (pedido de Fak, 08/10/2026, para Pedro Ergo):
 * sin los frenos del asistente por area, con lo que sabe el Claude de Facundo filtrado y con la identidad de
 * la persona. Lo instala `instalar.ps1` con doble clic en el `.cmd` que queda en la raiz de la salida.
 *
 *   node tools/claude-area/persona/armar.mjs --persona pedro --out <carpeta> [--herramientas <dir>] [--ocultar] [--reemplazar]
 *
 * Que entra: las memorias de `memorias.data.json` (`van`), limpias; un archivo de principios en vez de las
 * feedback; el TEXTO de las skills de la lista (sus programas viajan en la caja de herramientas, `repo.zip`);
 * los dos ayudantes; las fichas de la empresa del asistente por area (`conocimiento/<carpeta>`, sin los .json de
 * personas y privados). Que NO: lo personal de Facundo (su mail, a quien copia, su PC, su Escritorio, sus
 * seguimientos). Al final `validarTexto()` corre sobre TODO lo que va a ~\.claude de la persona y, si queda algo,
 * no deja el paquete. Los .zip de la caja no se validan aca: los arma `armar_herramientas.mjs` con sus exclusiones.
 *
 * Caso que lo origino: la copia cruda del 07/10 a la PC de Carlos (`ACTUALIZACION_CLAUDE_LIMPIO\memoria`)
 * le dejo un Claude que decia que el usuario era Facundo, con su mail, y que Carlos iba siempre en copia.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MEMORIA_FAK = path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory');
const SKILLS_REPO = path.resolve(AQUI, '..', '..', '..', '.claude', 'skills');
const REPO_AREA = 'C:\\Dev\\barack-claude';

// Malas palabras que aparecen en citas textuales de Fak. Borde por letra (no \b): "Artículo" no es "culo".
const FEO = /(?<![\p{L}\d])(carajo|puta|putas|boludo|boluda|boludos|boludez|mierda|pelotud\w*|al pedo|remada|idiota|concha|choto|garcha)(?![\p{L}\d])/iu;

/** Lo que no puede salir en ningun archivo del paquete. Devuelve la lista de problemas (vacia = ok). */
export function validarTexto(texto, ruta = '') {
    const prob = [];
    const reglas = [
        [/(?<![\p{L}\d])fak(?![\p{L}\d])/iu, 'nombra a "Fak" (el usuario del paquete es otra persona)'],
        [/f\.santoro@|santorofacundo|facundo\.santoro@/i, 'trae el mail de Facundo'],
        [/FacundoS-PC|C:[\\/]+Users[\\/]+facun(?![\p{L}])/iu, 'trae una ruta de la PC de Facundo'],
        [/siempre en (copia|CC)/i, 'trae una regla de copias fijas'],
        [/Carlos[^.\n]{0,60}(m[ií]nimo|siempre)[^.\n]{0,30}(copia|\bCC\b)/i, 'trae la regla de Carlos en copia'],
        [/hecho con IA|generado con IA/i, 'habla de documentos hechos con IA'],
        [FEO, 'trae una mala palabra'],
    ];
    texto.split(/\r?\n/).forEach((l, i) => {
        for (const [re, motivo] of reglas) if (re.test(l)) prob.push(`${ruta}:${i + 1}: ${motivo} -> ${l.trim().slice(0, 120)}`);
    });
    return prob;
}

/** Reemplazos exactos por archivo, antes del filtro general (la linea queda, sin lo que sobra). */
const REEMPLAZOS = {
    'reference_impresoras_ricoh_red_barack.md': [['Se llamaba `impresora de mierda`; desde', 'Desde']],
    'reference_caracteristicas_especiales_notacion_barack.md': [['"¿Qué carajo es W?"', '"¿Qué es W?"']],
    'explicar-mejor/SKILL.md': [
        ['6. Abrila con el programa de arriba (la skill `leer-archivo`, sección "Abrirle el archivo"):', '6. Abrila en pantalla:'],
        ['"${CLAUDE_PLUGIN_ROOT}/bin/node.exe" "${CLAUDE_PLUGIN_ROOT}/herramientas/abrir.mjs" \'<ruta del .html>\'', 'powershell -NoProfile -Command "Start-Process \'<ruta del .html>\'"'],
        ['en la carpeta de trabajo de la persona, `C:\\ClaudeBarack\\Trabajo\\explicacion-<tema>.html`.', 'en la carpeta en la que está trabajando la persona, con el nombre `explicacion-<tema>.html`.'],
        ['No va al servidor ni a la nube ni a `publicado`, y no se manda a nadie.', 'No va al servidor ni a la nube, y no se manda a nadie.'],
        [' Si dice `NO SE VE ABIERTO`, pegale en el chat la respuesta de arriba de la página y la ruta, y no la abras de nuevo.', ''],
    ],
};

/** Lineas que se sacan enteras: temas de la relacion de Facundo con otros, o comandos del asistente por area. */
const QUITAR_LINEAS = [
    /\*\*Mail a Pedro Ergo\*\*/,                          // como le contesta Fak a Pedro: no va en el Claude de Pedro
    /Mail a Carlos Baptista con copia a Andrés Santoro y Pedro Ergo/,
    /^\s*originSessionId:/,                              // ids de sesiones de la PC de Fak
    /Si un control te frena \(FRENADO\)/,                // en este paquete no hay controles
];
/** En las skills, ademas, las filas que nombran guardianes y pruebas del repo de Fak (en las memorias quedan: son contexto). */
const QUITAR_EN_SKILLS = [/\.claude\/hooks\/|__tests__\//];

/**
 * En una skill, el que aprueba es la persona que la usa, no Facundo (auditoria del 08/10: 49 frases en 10 skills
 * mandaban a pedirle el OK a Facundo). Va antes del cambio general "Fak" -> "Facundo", que queda para las citas.
 */
const APRUEBA_EN_SKILLS = [
    [/(?<![\p{L}\d])(OK|ok|visto bueno|sí|si) de Fak(?![\p{L}\d])/gu, '$1 de la persona'],
    [/(?<![\p{L}\d])((?:le )?(?:pregunt|consult|avis|ped|mostr|confirm)[a-záéí]*) a Fak(?![\p{L}\d])/giu, '$1 a la persona'],
    [/(?<![\p{L}\d])Fak (aprueba|decide|elige|confirma|firma|lo ve|la ve|lo mira)(?![\p{L}\d])/gu, 'la persona $1'],
];

/** Las malas palabras de las citas se cambian por una neutra, asi la cita sigue entera; lo que quede, corta el renglon. */
const L = '(?<![\\p{L}\\d])', R = '(?![\\p{L}\\d])';
const SUAVIZAR = [
    [new RegExp(`${L}ni puta idea${R}`, 'giu'), 'ni idea'],
    [new RegExp(`${L}un(\\r?\\n)carajo${R} ?`, 'giu'), 'nada$1'],
    [new RegExp(`${L}(qu[eé]) carajo${R}`, 'giu'), '$1'],
    [new RegExp(`${L}un carajo${R}`, 'giu'), 'nada'],
    [new RegExp(`${L}y a la mierda${R}`, 'giu'), 'y listo'],
    [new RegExp(` de mierda${R}`, 'giu'), ''],
    [new RegExp(`${L}al pedo${R}`, 'giu'), 'de más'],
    [new RegExp(`${L}como un pelotudo de${R}`, 'giu'), 'como a un chico de'],
    [new RegExp(`${L}a prueba de boludos${R}`, 'giu'), 'a prueba de todo'],
    [new RegExp(`${L}es una remada${R}`, 'giu'), 'es muy largo'],
];

/** Limpia un texto: rutas de la PC de Fak, reemplazos, lineas a sacar, "Fak" -> "Facundo", links a memorias que no van. */
export function limpiarTexto(texto, { archivo = '', incluidas = null } = {}) {
    let t = texto.replace(/^\uFEFF/, '');
    // archivo: "<skill>/<ruta>" para una skill, "conocimiento/<area>/<ruta>" para una ficha, "<nombre>.md" para una memoria
    const esSkill = archivo.includes('/') && !archivo.startsWith('conocimiento/');
    for (const [a, b] of REEMPLAZOS[archivo] || []) t = t.split(a).join(b);
    for (const [re, b] of SUAVIZAR) t = t.replace(re, b);
    if (esSkill) for (const [re, b] of APRUEBA_EN_SKILLS) t = t.replace(re, b);
    const eol = t.includes('\r\n') ? '\r\n' : '\n';
    const quitadas = [];
    const reglas = esSkill ? [...QUITAR_LINEAS, ...QUITAR_EN_SKILLS] : QUITAR_LINEAS;
    t = t.split(/\r?\n/).filter((l) => {
        if (reglas.some((re) => re.test(l)) || FEO.test(l)) { quitadas.push(l); return false; }
        return true;
    }).join(eol);
    t = t.replace(/C:[\\/]+Users[\\/]+(FacundoS-PC|facun)(?![\p{L}])/giu, '%USERPROFILE%')
        .replace(/\/c\/Users\/FacundoS-PC/gi, '%USERPROFILE%')
        .replace(/FacundoS-PC/gi, 'la PC de Facundo')
        .replace(/(?<![\p{L}\d])Fak \(yo\)/gu, 'Facundo')
        .replace(/(?<![\p{L}\d])FAK(?![\p{L}\d])/gu, 'FACUNDO')
        .replace(/(?<![\p{L}\d])Fak(?![\p{L}\d])/giu, 'Facundo');
    if (incluidas) t = t.replace(/\[\[([^\]\n]+)\]\]/g, (m, n) => (incluidas.has(n) ? m : `\`${n}\``));
    return { texto: t, quitadas };
}

/** Descripcion corta del frontmatter, para el indice MEMORY.md. */
export function descripcion(texto) {
    const m = texto.match(/^description:\s*(.*)$/m);
    let d = m ? m[1].trim() : '';
    d = d.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
    return d.length > 100 ? `${d.slice(0, 97).trimEnd()}...` : d;
}

// Claude Code lee de MEMORY.md los primeros 200 renglones o 25.000 caracteres (medido en el ejecutable 2.1.293:
// `QL=200,vne=25000`). El indice se arma por debajo de esto, con lugar para lo que anote la persona.
export const TOPE_INDICE = { renglones: 170, caracteres: 21000 };

function args(argv) {
    const a = { ocultar: false, reemplazar: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--persona') a.persona = argv[++i];
        else if (k === '--out') a.out = argv[++i];
        else if (k === '--memoria') a.memoria = argv[++i];
        else if (k === '--repo-area') a.repoArea = argv[++i];
        else if (k === '--herramientas') a.herramientas = argv[++i];
        else if (k === '--ocultar') a.ocultar = true;
        else if (k === '--reemplazar') a.reemplazar = true;
        else throw new Error(`argumento desconocido: ${k} (no se armo nada)`);
    }
    if (!a.persona || !a.out) throw new Error('uso: --persona <clave> --out <carpeta> [--herramientas <dir>] [--ocultar] [--reemplazar]');
    return a;
}

function escribir(p, contenido) { if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, contenido); }
/** Lo que se valida (todo lo que va a ~\.claude de la persona es de estos tipos). */
const esTexto = (p) => /\.(md|txt|json|ps1|cmd)$/i.test(p);
/** De una skill viaja solo su texto: los programas (.py, .mjs, imagenes, datos) estan en la caja de herramientas. */
const textoDeSkill = (p) => /\.(md|txt)$/i.test(p);
/** Los .zip de la caja de herramientas, en el orden en que los abre instalar.ps1. */
export const HERRAMIENTAS = ['repo.zip', 'node_modules.zip', 'node.zip', 'python.zip', 'playwright.zip'];
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function listar(dir, base = dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listar(p, base)); else out.push(path.relative(base, p));
    }
    return out;
}

export function armar(opciones) {
    const memoria = opciones.memoria || MEMORIA_FAK;
    const repoArea = opciones.repoArea || REPO_AREA;
    const persona = JSON.parse(fs.readFileSync(path.join(AQUI, `${opciones.persona}.json`), 'utf8'));
    const datos = JSON.parse(fs.readFileSync(path.join(AQUI, 'memorias.data.json'), 'utf8'));
    const out = path.resolve(opciones.out);
    const inst = path.join(out, '_instalador');
    if (fs.existsSync(inst) && !opciones.reemplazar) throw new Error(`ya hay un paquete en ${inst} (con --reemplazar se renombra el viejo, no se borra)`);
    // Se arma adentro del destino y se renombra al final: nada queda en %TEMP% (cada armado son ~450 MB) y no se
    // copia carpeta entera (fs.cpSync rompe los nombres con tilde: auditoria del 08/10).
    if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });   // la raiz de un pendrive ya existe y mkdir da EPERM
    const staging = path.join(out, `_instalador.armando-${process.pid}`);
    fs.mkdirSync(staging);
    const informe = { memorias: 0, lineasQuitadas: 0, skills: [], conocimiento: 0, problemas: [] };
    const incluidas = new Set(datos.van.map((f) => f.replace(/\.md$/, '')));
    incluidas.add('feedback_principios_de_trabajo');

    // 1) memorias, limpias, + principios + MEMORY.md
    const indice = { reference: [], project: [] };
    for (const f of datos.van) {
        const src = path.join(memoria, f);
        if (!fs.existsSync(src)) throw new Error(`no esta la memoria ${f} en ${memoria}`);
        const { texto, quitadas } = limpiarTexto(fs.readFileSync(src, 'utf8'), { archivo: f, incluidas });
        informe.lineasQuitadas += quitadas.length;
        escribir(path.join(staging, 'memoria', f), texto);
        (f.startsWith('project_') ? indice.project : indice.reference).push(`- ${f} — ${descripcion(texto)}`);
        informe.memorias++;
    }
    fs.copyFileSync(path.join(AQUI, 'plantillas', 'feedback_principios_de_trabajo.md'), path.join(staging, 'memoria', 'feedback_principios_de_trabajo.md'));
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const memoryMd = [
        `# Memoria — ${persona.nombre} (${persona.puesto})`,
        '',
        `> Lo de abajo lo aprendió el asistente de Facundo Santoro (Ingeniería) trabajando en Barack hasta el ${fecha}.`,
        `> Es conocimiento de la empresa. Cuando una memoria dice "Facundo", habla de él (la fuente), no de con quién hablás:`,
        `> tu usuario es ${persona.nombre}. Lo que ${persona.nombre_corto} te enseñe va en archivos nuevos, en esta misma carpeta.`,
        `> Los "falta" y "pendiente" de las memorias de proyecto son tareas de Ingeniería, no de ${persona.nombre_corto}.`,
        '',
        '> Cada renglón es un archivo de esta carpeta: abrilo cuando el tema venga al caso.',
        '',
        '- feedback_principios_de_trabajo.md — cómo trabajar: verificar, citar la fuente, no inventar, mails, borrar, entregables',
        '',
        '## Conocimiento de la empresa (dónde vive cada cosa, cómo funciona)',
        ...indice.reference,
        '',
        '## Proyectos (estado a la fecha que dice cada uno: si importa, verificalo en la fuente)',
        ...indice.project,
        '',
    ].join('\n');
    const renglones = memoryMd.split('\n').length;
    if (renglones > TOPE_INDICE.renglones || memoryMd.length > TOPE_INDICE.caracteres) {
        throw new Error(`el indice MEMORY.md queda de ${renglones} renglones y ${memoryMd.length} caracteres (tope ${TOPE_INDICE.renglones} y ${TOPE_INDICE.caracteres}): Claude no lo leeria entero`);
    }
    informe.indice = { renglones, caracteres: memoryMd.length };
    escribir(path.join(staging, 'memoria', 'MEMORY.md'), memoryMd);

    // 2) skills: solo su texto, limpio
    for (const s of datos.skills) {
        const desdeArea = s === 'explicar-mejor';
        const src = desdeArea ? path.join(repoArea, 'plugins', 'barack-area', 'skills', s) : path.join(SKILLS_REPO, s);
        if (!fs.existsSync(path.join(src, 'SKILL.md'))) throw new Error(`no esta la skill ${s} en ${src}`);
        for (const rel of listar(src)) {
            if (!textoDeSkill(rel) || /(^|[\\/])__pycache__[\\/]/.test(rel)) continue;
            const { texto, quitadas } = limpiarTexto(fs.readFileSync(path.join(src, rel), 'utf8'), { archivo: `${s}/${rel.replace(/\\/g, '/')}` });
            informe.lineasQuitadas += quitadas.length;
            escribir(path.join(staging, 'skills', s, rel), texto);
        }
        informe.skills.push(s);
    }

    // 3) ayudantes, CLAUDE.md, persona, instalador
    fs.mkdirSync(path.join(staging, 'agentes'), { recursive: true });
    for (const a of ['investigador.md', 'explorador.md']) fs.copyFileSync(path.join(AQUI, 'plantillas', 'agentes', a), path.join(staging, 'agentes', a));
    fs.copyFileSync(path.join(AQUI, 'plantillas', 'CLAUDE.md'), path.join(staging, 'CLAUDE.md'));
    fs.copyFileSync(path.join(AQUI, 'instalar.ps1'), path.join(staging, 'instalar.ps1'));
    fs.copyFileSync(path.join(AQUI, 'desinstalar.ps1'), path.join(staging, 'desinstalar.ps1'));
    escribir(path.join(staging, 'persona.json'), JSON.stringify({ ...persona, fecha_paquete: fecha }, null, 2));

    // 4) fichas de la empresa del asistente por area (sin los .json: personas, privados, mails privados)
    for (const c of persona.conocimiento || []) {
        const src = path.join(repoArea, 'conocimiento', c);
        if (!fs.existsSync(src)) throw new Error(`no estan las fichas ${c} en ${src}`);
        for (const rel of listar(src)) {
            if (!/\.(md|txt)$/i.test(rel)) continue;
            const { texto, quitadas } = limpiarTexto(fs.readFileSync(path.join(src, rel), 'utf8'), { archivo: `conocimiento/${c}/${rel}` });
            informe.lineasQuitadas += quitadas.length;
            escribir(path.join(staging, 'conocimiento', c, rel), texto);
            informe.conocimiento++;
        }
    }

    // 5) control de TODO lo que va a ~\.claude de la persona (persona.json lleva su mail, que es el que corresponde)
    for (const rel of listar(staging)) {
        if (rel === 'instalar.ps1' || rel === 'desinstalar.ps1') continue;
        if (!esTexto(rel)) { informe.problemas.push(`${rel}: no es texto y no deberia estar (lo que no se puede revisar no viaja)`); continue; }
        informe.problemas.push(...validarTexto(fs.readFileSync(path.join(staging, rel), 'utf8'), rel));
    }
    if (informe.problemas.length) return { ok: false, informe, staging };

    // 6) la caja de herramientas (los .zip de armar_herramientas.mjs): sin ella, las skills con programas no andan
    if (opciones.herramientas) {
        const dir = path.join(staging, 'herramientas');
        fs.mkdirSync(dir, { recursive: true });
        for (const z of HERRAMIENTAS) {
            const src = path.join(opciones.herramientas, z);
            if (!fs.existsSync(src)) throw new Error(`falta ${z} en ${opciones.herramientas} (armalo con armar_herramientas.mjs)`);
            fs.copyFileSync(src, path.join(dir, z));
        }
        fs.copyFileSync(path.join(AQUI, 'plantillas', 'CAJA_CLAUDE.md'), path.join(dir, 'CAJA_CLAUDE.md'));
        informe.herramientas = HERRAMIENTAS.length;
    }

    // 7) manifiesto: el instalador controla que llego todo, igual y sin nada de mas, antes de tocar nada
    const archivos = listar(staging);
    const manifiesto = {
        persona: persona.clave,
        generado: new Date().toISOString(),
        archivos: archivos.map((rel) => ({ ruta: rel.replace(/\//g, '\\'), bytes: fs.statSync(path.join(staging, rel)).size, sha256: sha(path.join(staging, rel)) })),
    };
    escribir(path.join(staging, 'paquete.json'), JSON.stringify(manifiesto, null, 2));

    // 8) a su lugar: el viejo se renombra (no se borra), el nuevo toma el nombre y se vuelve a verificar
    if (fs.existsSync(inst)) fs.renameSync(inst, `${inst}.anterior-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}`);
    fs.renameSync(staging, inst);
    const distintos = manifiesto.archivos.filter((a) => sha(path.join(inst, a.ruta)) !== a.sha256).map((a) => a.ruta);
    if (distintos.length) throw new Error(`despues de armar no quedaron iguales: ${distintos.slice(0, 5).join(', ')}`);
    const cmd = fs.readFileSync(path.join(AQUI, 'instalar.cmd'), 'utf8').replace(/\{\{NOMBRE\}\}/g, persona.nombre);
    escribir(path.join(out, persona.nombre_instalador), cmd.replace(/\r?\n/g, '\r\n'));
    if (opciones.ocultar && process.platform === 'win32') execFileSync('attrib', ['+h', inst]);
    return { ok: true, informe, salida: out, instalador: path.join(out, persona.nombre_instalador), archivos: manifiesto.archivos.length + 1 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const r = armar(args(process.argv.slice(2)));
        const i = r.informe;
        if (!r.ok) {
            console.error(`NO se armo: ${i.problemas.length} renglones con cosas que no pueden salir (lo armado quedo en ${r.staging} para mirarlo):`);
            for (const p of i.problemas.slice(0, 60)) console.error(`  ${p}`);
            process.exit(1);
        }
        console.log(`OK: ${r.instalador}`);
        console.log(`   ${i.memorias} memorias + principios, ${i.skills.length} skills (${i.skills.join(', ')}), ${i.conocimiento} fichas, ${i.lineasQuitadas} renglones sacados, ${r.archivos} archivos en total`);
        console.log(`   indice de memoria: ${i.indice.renglones} renglones, ${i.indice.caracteres} caracteres; herramientas: ${i.herramientas ? `${i.herramientas} zip` : 'NO (sin --herramientas las skills con programas no andan)'}`);
    } catch (e) { console.error(`ERROR: ${e.message}`); process.exit(2); }
}
