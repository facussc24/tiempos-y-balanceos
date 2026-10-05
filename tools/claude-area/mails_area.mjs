#!/usr/bin/env node
/**
 * mails_area.mjs - paso "mails" de la tarea "Barack - Claude por area" (la corre sync_area.ps1 en cada PC).
 *
 * Deja en la nube de Ingenieria los mails de TRABAJO de esta PC, en segundo plano y sin Claude (cero tokens),
 * SOLO si la lista de personas publicada dice `"mails": "sube"` para la persona de esta PC. Es el programa
 * tools/paquete-equipo/mails_equipo.py (el que usa la primera PC desde septiembre) sin Python: la lectura de
 * Outlook la hace mails_outlook.ps1 (PowerShell 5.1, solo lectura) y lo demas va con el Node del plugin.
 *
 * Quien decide: la lista de personas (`conocimiento/comun/personas.json`) y la lista de lo privado
 * (`conocimiento/comun/mails_privados.json`) viajan en el paquete FIRMADO. Aca se leen las copias instaladas, que la
 * tarea repone y verifica contra la firma antes de este paso: solo quien publica prende la subida en una PC o saca a
 * alguien de lo privado. Lo que esto cuida es que ninguna PC suba por error ni por un cambio suelto. No es un candado
 * contra la propia persona: quien arma a proposito su copia del programa con sus listas puede subir SUS mails a SU
 * carpeta, que es lo mismo que puede hacer a mano copiando un mail a la biblioteca.
 *
 * Que hace con cada mail del buzon (el filtro corre en ESTA PC, antes de que nada salga):
 *     privado    -> NO sube. Es lo FIRME del filtro: una casilla o un dominio de la lista de lo privado en De, "en
 *                   nombre de", Para, CC o copia oculta; esa casilla, o el nombre y apellido de una persona de la lista,
 *                   en cualquier lugar del asunto, del texto, de un adjunto o de la carpeta (un mail citado, reenviado o
 *                   firmado por ella); un remitente de Anthropic (los codigos de acceso de la cuenta); una casilla que no
 *                   se pudo leer o un campo con otra forma (sin eso no hay contra que filtrar)
 *     cuarentena -> NO sube. Es una RED, no una garantia: sueldos, salud, sanciones, gremiales, claves y demas temas
 *                   personales, buscados por palabras en todo lo que subiria (asunto, texto, adjuntos, carpeta, nombres y
 *                   casillas). Un mail personal que no use ninguna de esas palabras pasa: se le dice a la persona.
 *     en espera  -> el mail de menos de un dia: todavia no sube (la persona tiene ese dia para borrarlo). Y el primer
 *                   dia despues de prenderse la PC solo se deja el aviso: la primera copia es al dia siguiente.
 *     entrada    -> <biblioteca de Ingenieria>\Claude Barack\mails\_entrada\<persona>\<fecha-hora>.jsonl
 *
 * Reglas que cumple:
 *   - Apagado por defecto: sin fila de la persona, con dos filas, sin PC en la fila o con cualquier valor que no sea
 *     "sube", no hace NADA (ni mira Outlook).
 *   - Sin la lista de lo privado, o con una sin completar o mal escrita, no sube nada.
 *   - La casilla de la propia persona en lo privado: no sube nunca. Si el buzon abierto no es el de su casilla: tampoco.
 *   - Solo AGREGA archivos en la nube: no borra ni pisa (un nombre repetido se desempata con -2, -3...).
 *   - No guarda adjuntos (solo sus nombres), no publica la copia oculta, y no deja copias de los mails en el disco.
 *   - No se esconde: en cuanto la PC queda lista para subir deja un aviso escrito en la carpeta de trabajo de la persona,
 *     y otro el dia que se apaga.
 *   - Si Outlook deja de contestar (puede ser un cartel de seguridad en la pantalla de la persona), corta al minuto; a la
 *     segunda vez seguida deja de intentar por una semana y lo dice en la salud de la PC.
 *   - Lo hecho queda en `<estado>\mails-area-subidos.txt`: una corrida cortada no pierde avance. Si se corta justo entre
 *     subir un archivo y anotarlo, la corrida siguiente lo sube de nuevo (queda repetido; nunca se pierde).
 *
 * Lo que este programa NO puede ver y hay que saber: un mail personal que no nombre ninguno de los temas, y una persona
 * de Direccion o de Recursos Humanos que no este en la lista de lo privado. Y lo que ya subio no lo retira: solo agrega.
 *
 * Uso (desde su instalacion, `<casa>\publicado\programas\`):
 *   node mails_area.mjs --home C:\ClaudeBarack --raiz-nube "<...>\CLAUDE POR AREA" --estado <carpeta de estado>
 *        [--simular] [--max-minutos 10] [--dias-atras 90]
 * Escribe UN renglon JSON con el resultado. Codigos: 0 bien (incluye "apagado", "primer_dia", "pausado" y "parcial por tiempo") -
 * 1 error - 3 la fila no trae la casilla o el buzon abierto es otro - 4 Outlook clasico no esta abierto o no contesta
 * (se reintenta) - 5 falta completar lo privado - 6 no se ve la carpeta de la nube.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DIAS_ATRAS = 90;
export const MARGEN_DIAS = 3;          // cada pasada completa vuelve a mirar los ultimos 3 dias
export const GRACIA_HORAS = 24;        // un mail sube recien un dia despues: la persona tiene ese dia para borrarlo
export const LOTE = 300;               // mails por archivo
export const MAX_MINUTOS = 10;         // la tarea corta este paso a los 12 (y Windows corta la tarea entera a los 30)
export const SEGUNDOS_SIN_RESPUESTA = 75;   // sin una linea del lector en ese tiempo: Outlook no contesta
export const DIAS_DE_PAUSA = 7;        // despues de dos corridas seguidas sin respuesta
export const CARPETA_HERMANA = 'Claude Barack';
export const NOMBRE_AVISO = 'AVISO - los mails de trabajo de esta PC se comparten con Ingenieria.txt';
export const ARCHIVO_ESTADO = 'mails-area-estado.json';
export const ARCHIVO_SUBIDOS = 'mails-area-subidos.txt';

/** Sin tildes, en minusculas, con un solo espacio y sin los caracteres que no se ven (guion blando, ancho cero). */
export function normalizar(s) {
    return String(s ?? '').replace(/[­​-‏⁠﻿]/g, '').normalize('NFD').replace(/\p{M}+/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * El texto como lo mira el filtro de temas: ademas de normalizar, separa las palabras pegadas (ReciboSueldo) y cambia
 * por espacio los guiones, puntos, barras, signos y numeros (recibo_de_sueldo_0926.pdf, RR.HH., sueldos2026).
 */
export function paraTemas(s) {
    return normalizar(String(s ?? '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\s]+/gu, ' '));
}
/**
 * Para buscar NOMBRES: «PedroErgo» -> «Pedro Ergo», «CVLerma» -> «CV Lerma» (donde cambia de minuscula a mayuscula, o
 * despues de una sigla, hay otra palabra). La red de temas no usa el corte de la sigla: partiria «DNIs» o «RRHHs».
 */
export function separarPegadas(s) {
    return String(s ?? '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2');
}

const MES = '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';
// Temas que NO salen de la PC (una red: se buscan por palabras, sin tildes, en todo lo que subiria).
const TEMAS_LISTA = [
    // sueldos y pagos al personal («suelde», de soldar, no es un sueldo)
    'sueld(?:o|os|ito|itos|azo)', 'salari\\p{L}+', 'haberes', '(?:el|su|mi|tu|del) haber (?:de|del|mensual)', 'remuneraci\\p{L}+',
    'recibos? firmados?', `recibos? (?:de |del mes de |del mes )?${MES}`, `liquidacion(?:es)? (?:de |del mes de |del mes |del |mensual )?(?:final(?:es)?|mes|${MES})`,
    'aguinaldos?', 'paritarias?', '(?:adelantos?|anticipos?) (?:de |del )?(?:vacaciones|quincena)', 'pedidos? de (?:anticipos?|adelantos?)', 'vales? de (?:adelantos?|caja)', 'adelanto para',
    'presentismo', 'pago de (?:la |las )?quincenas?', 'cobr\\p{L}+ la quincena', 'horas? extras?', 'jornal(?:es)?', 'categoria y basico', 'basico de convenio',
    'bonos? (?:de fin de ani?o|anual(?:es)?|por (?:productividad|desempeno))', 'pin de (?:la |su |tu )?tarjeta', 'gratificaci\\p{L}+', 'prestamos? (?:al|a|del) personal', 'prestamos? personal(?:es)?', 'impuesto a las ganancias',
    // salud
    'licencias? (?:medicas?|psiquiatricas?|sin goce|con goce|gremial(?:es)?|por (?:enfermedad|maternidad|paternidad|duelo|examen|estudio|matrimonio|mudanza|fallecimiento|nacimiento))',
    '(?:de|pidio|tomo|toma|pide) licencia', 'certificados? medicos?', 'partes? (?:medicos?|de enfermo)', 'turnos? medicos?', 'historias? clinicas?', 'diagnostic\\p{L}+ medic\\p{L}+',
    'reposo (?:medico|laboral)', 'dias de reposo', 'carpetas? medicas?', 'altas? medicas?', 'aptos? medicos?', 'estudios medicos', 'medic[oa] laboral', 'medicina laboral',
    'accident\\p{L}*', 'obras? social(?:es)?', 'prepagas?', 'examen(?:es)? (?:medicos?|preocupacional(?:es)?|periodicos?)', 'enferm\\p{L}+', 'embaraz\\p{L}+',
    'internad[oa]s?', 'internaron', 'internacion(?:es)?', '(?:lo|la|me|te|los|las) oper(?:aron|an|o|a)', 'cirugias?', 'fallec\\p{L}+', 'psicolog\\p{L}+', 'psiquiatr\\p{L}+',
    'covid', 'oncolog\\p{L}+', 'discapacidad(?:es)?', 'alcoholemia', 'dopaje', 'aseguradora de riesgos',
    // disciplina, altas y bajas
    'sancion\\p{L}*', 'apercibi\\p{L}+', 'suspen[ds]\\p{L}+', 'despid\\p{L}+', 'desped\\p{L}+', 'desvincul\\p{L}+', 'telegramas?', 'renunci\\p{L}+',
    'legajos? (?:personal(?:es)?|del? (?:empleado|personal|operario)s?)', 'evaluacion(?:es)? de desempeno(?! (?:de |del |de los |a )?(?:los )?proveedor)', 'preaviso', 'indemniz\\p{L}+',
    'ausentismo', 'llegadas? tarde', 'llamados? de atencion', 'amonest\\p{L}+', 'descargos?', 'acoso', 'denunci\\p{L}+', '(?:bajas?|egresos?|busquedas?) de personal',
    'antecedentes penales', 'curriculum\\p{L}*', 'candidat[oa]s?', 'postulantes?',
    // gremiales y judiciales («sin embargo» no es un embargo)
    'sindicat\\p{L}+', 'sindical(?:es)?', 'gremi\\p{L}+', 'delegad[oa]s?', 'smata', 'huelgas?', 'asambleas?', 'comision(?:es)? internas?', 'medidas? de fuerza', 'conciliacion obligatoria', 'seccional(?:es)?',
    '(?<!sin )embargo', 'embargos', 'embarga\\p{L}+', 'embargu\\p{L}+', 'cuotas? alimentarias?', '(?:juicios?|demandas?) laboral(?:es)?', 'laboralistas?', 'oficios? judicial(?:es)?', 'cartas? documento', 'divorci\\p{L}+',
    // recursos humanos como tema
    'recursos humanos', 'rr ?hh', 'capital humano',
    // claves, codigos y datos personales
    'contrasen\\p{L}+', 'passwords?', 'senhas?', 'clave de acceso', 'claves? (?:nuevas?|temporal(?:es)?|provisorias?)', '(?:tu|su|mi|la) clave (?:es|nueva|del|de|para)', 'usuario y clave', 'usuario (?:\\p{L}+ ){0,3}clave',
    'credenciales', 'tokens? de (?:acceso|seguridad)', 'codigos? de (?:seguridad|verificacion|acceso|un solo uso|autenticacion|activacion)', 'verification codes?', 'security codes?',
    'home ?banking', 'cbu', 'cvu', 'tarjetas? de (?:credito|debito)', 'resumen(?:es)? de (?:la )?tarjeta', 'dni', 'cuil', 'mercado pago',
    // en ingles y en portugues
    'salary', 'salaries', 'payroll', 'sick leave', 'resignation', 'termination letter', 'medical certificate', 'holerite', 'folha de pagamento', 'atestado medico', 'demissao',
];
export const TEMAS = new RegExp(`(?<!\\p{L})(?:${TEMAS_LISTA.join('|')})(?!\\p{L})`, 'u');
// Lo que tambien se busca ADENTRO de una palabra (recibosueldo.pdf, CERTIFICADOMEDICO.jpg, sueldos@estudio.com).
export const RAICES = /sueldo|haberes|aguinaldo|salario|salarial|remuneracion|certificadomedico|licenciamedica|partemedico|historiaclinica|rrhh|recursoshumanos|capitalhumano|despido|desvincul|sancion|renuncia|telegrama|indemniz|legajopersonal|contrasena|password|homebanking|liquidacionfinal|obrasocial|preocupacional|apercibi|curriculum|payroll|salary|smata|sindicat/u;
// La despedida de un mail no es un despido. Solo estas formas: «a Perez lo despido el viernes» SI es un despido.
export const NO_CUENTAN = /(?<!\p{L})(?:me despido|nos despedimos|(?:se despide|despido)(?: muy)? (?:atentamente|cordialmente))(?!\p{L})/gu;
// Una casilla de un sector (no de una persona) que es de personal o de direccion, de cualquier empresa.
const CASILLAS_DE_SECTOR = new Set(['personal', 'rrhh', 'rh', 'hr', 'recursoshumanos', 'sueldos', 'liquidaciones', 'liquidacion', 'direccion', 'directorio', 'presidencia', 'gerenciageneral', 'capitalhumano', 'legales', 'nominas', 'payroll', 'empleos', 'seleccion']);
const NOMBRES_DE_SECTOR = /(?<!\p{L})(?:direccion|directorio|presidencia)(?!\p{L})/u;
// Una carpeta de Outlook con uno de estos nombres es de la persona, no del trabajo.
const CARPETAS_PERSONALES = new Set(['personal', 'personales', 'privado', 'privada', 'privados', 'particular', 'particulares', 'familia', 'familiar', 'mio', 'mios', 'mis cosas', 'cosas mias']);

/** ¿El texto (crudo) nombra un tema que no sale? */
export function nombraTema(crudo, palabrasExtra = []) {
    const texto = paraTemas(crudo).replace(NO_CUENTAN, ' ');
    if (TEMAS.test(texto) || RAICES.test(texto)) return true;
    return palabrasExtra.some((r) => r.test(texto));
}

// Los codigos de acceso de la cuenta de Claude viajan por mail: esos nunca suben (cualquier subdominio).
export const esDeAnthropic = (casilla) => /(?:^|[.@])(?:anthropic\.com|claude\.ai|claude\.com)$/.test(String(casilla));

export const RE_CASILLA = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const RE_CASILLA_EN_TEXTO = /[a-z0-9._%+-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;      // hasta 64 antes de la arroba: sin tope, un texto largo sin espacios tarda
const RE_DOMINIO = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const paraRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * La casilla limpia de lo que llegue (con espacios, comillas, «Nombre <casilla>», «smtp:», un punto al final), o ''
 * si no tiene forma de casilla (una direccion interna de Exchange, un nombre, otra cosa que no sea texto).
 */
export function casillaLimpia(x) {
    if (typeof x !== 'string') return '';
    let c = x.trim();
    if (/\/o=|\/cn=/i.test(c)) return '';
    const m = /<\s*([^<>\s]+@[^<>\s]+?)\s*>/.exec(c);
    if (m) c = m[1];
    c = c.replace(/^[\s'"<]+|[\s'">]+$/g, '').replace(/^smtp:/i, '').trim().replace(/[.,;]+$/, '').toLowerCase();
    return RE_CASILLA.test(c) ? c : '';
}

/** Las palabras de un texto ya normalizado (letras). */
const palabrasDe = (texto) => String(texto).split(/[^\p{L}]+/u).filter(Boolean);
const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const esCarpeta = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const esEnlace = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
const dos = (n) => String(n).padStart(2, '0');
export const isoLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
const sello = (d) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
const diaMesAnio = (d, sep = '/') => `${dos(d.getDate())}${sep}${dos(d.getMonth() + 1)}${sep}${d.getFullYear()}`;

/** 'AAAA-MM-DD HH:MM', 'AAAA-MM-DDTHH:MM:SS' o 'AAAA-MM-DD' -> Date local (o null). */
export function parsearFecha(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(texto ?? ''));
    if (!m) return null;
    const [a, me, d, h, mi, s] = m.slice(1).map((x) => (x ? Number(x) : 0));
    const f = new Date(a, me - 1, d, h, mi, s);
    return Number.isNaN(f.getTime()) || f.getMonth() !== me - 1 || f.getDate() !== d ? null : f;
}

function escribirAtomico(ruta, texto) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const tmp = `${ruta}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, texto, 'utf8');
    fs.renameSync(tmp, ruta);
}

const RESERVADOS = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
/** Nombre de carpeta valido en Windows. */
export function carpetaSegura(nombre) {
    const n = String(nombre ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.{2,}/g, '.').replace(/^[ .]+|[ .]+$/g, '').slice(0, 80);
    return RESERVADOS.test(n) ? `_${n}` : n;
}

/** ¿El nombre de PC de la fila es el de esta PC? (Windows corta a 15 letras el nombre corto, y el largo puede traer el dominio) */
export function mismaPc(deLaFila, real) {
    const a = normalizar(deLaFila);
    const b = normalizar(real);
    if (!a || !b) return false;
    const corto = b.split('.')[0];
    return a === b || a === corto || a === corto.slice(0, 15) || a === b.slice(0, 15);
}

/**
 * La persona de ESTA PC en la lista publicada, para prender la subida. Mas estricto que el instalador: tiene que haber
 * UNA sola fila con ese usuario de Windows (dos filas: apagado), y la fila tiene que traer la PC y ser esta PC.
 * Las bajas no cuentan.
 */
export function personaQueSube(personas, { usuario, pc }) {
    const lista = personas && Array.isArray(personas.personas) ? personas.personas : [];
    const u = normalizar(usuario);
    if (!u) return null;
    const filas = lista.filter((p) => p && typeof p === 'object' && !p.baja && normalizar(p.usuario_windows) === u);
    if (filas.length !== 1) return null;
    return mismaPc(filas[0].pc, pc) ? filas[0] : null;
}

/** Quien usa esta PC, para decidir si sube: lo que dice WINDOWS (no las variables de entorno ni `perfil.json`). */
export function identidadReal() {
    // Windows deja cambiar el nombre que contesta con esta variable: se saca antes de preguntar
    delete process.env._CLUSTER_NETWORK_NAME_;
    let usuario = '';
    try { usuario = os.userInfo().username; } catch { usuario = ''; }
    return { usuario, pc: os.hostname() };
}

const CLAVES_DE_LA_LISTA = ['direcciones', 'dominios', 'nombres', 'apellidos', 'palabras_extra', 'total_direcciones'];
/**
 * La lista de lo privado. { estado: 'falta'|'roto'|'incompleto'|'ok', direcciones:Set, dominios:Set, nombres:[[palabras]], palabras:[RegExp] }.
 * Mal escrita vale lo mismo que no tenerla (falla cerrado): otra codificacion, una clave repetida o desconocida, algo que
 * no es una lista de textos, una casilla con una coma, un punto o un «<» de mas, un dominio que no es un dominio, un nombre
 * que no es nombre y apellido, un «TBD» en cualquier lado, ninguna casilla, o una cuenta (`total_direcciones`) que no
 * coincide con las casillas que hay.
 */
export function cargarPrivados(ruta) {
    if (!fs.existsSync(ruta)) return { estado: 'falta' };
    let crudo;
    try { crudo = fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, ''); } catch { return { estado: 'roto' }; }
    // guardado en otra codificacion (ANSI, UTF-16): las letras con tilde llegan rotas y un nombre dejaria de coincidir
    if (crudo.includes('\uFFFD') || crudo.includes('\u0000')) return { estado: 'roto' };
    let d;
    try { d = JSON.parse(crudo); } catch { return { estado: 'roto' }; }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { estado: 'roto' };
    let incompleto = false;
    // una clave escrita dos veces: JSON se queda con la ultima sin avisar
    for (const k of CLAVES_DE_LA_LISTA) if ((crudo.match(new RegExp(`"${k}"\\s*:`, 'g')) || []).length > 1) incompleto = true;
    for (const k of Object.keys(d)) if (!k.startsWith('_') && !CLAVES_DE_LA_LISTA.includes(k)) incompleto = true;
    const textos = (k) => {
        const v = d[k];
        if (v === undefined) return [];
        if (!Array.isArray(v)) { incompleto = true; return []; }
        const out = [];
        for (const x of v) { if (typeof x !== 'string' || !x.trim() || /tbd/i.test(x)) incompleto = true; else out.push(x.trim()); }
        return out;
    };
    const direcciones = new Set();
    for (const x of textos('direcciones')) { const c = x.toLowerCase(); if (!RE_CASILLA.test(c)) incompleto = true; else direcciones.add(c); }
    const dominios = new Set();
    for (const x of textos('dominios')) { const c = x.toLowerCase().replace(/^@/, ''); if (!RE_DOMINIO.test(c)) incompleto = true; else dominios.add(c); }
    // un nombre es nombre y apellido, con letras: una sola palabra («Ana», «Direccion») frenaria cualquier mail o ninguno
    const nombres = [];
    for (const x of textos('nombres')) {
        const p = palabrasDe(normalizar(x)).filter((w) => w.length > 1);
        if (!/^[\p{L} .'-]+$/u.test(x) || p.length < 2 || p.join('').length < 5) incompleto = true; else nombres.push(p);
    }
    // un apellido que alcanza solo para saber de quien se habla («Ergo»): una palabra, de 4 letras o mas
    const apellidos = [];
    for (const x of textos('apellidos')) { const a = normalizar(x); if (!/^\p{L}{4,}$/u.test(a)) incompleto = true; else apellidos.push(a); }
    const palabras = [];
    for (const x of textos('palabras_extra')) {
        const n = paraTemas(x);
        if (n.replace(/\s/g, '').length < 3) incompleto = true; else palabras.push(new RegExp(`(?<!\\p{L})${paraRegex(n)}(?!\\p{L})`, 'u'));
    }
    if (direcciones.size === 0) incompleto = true;
    // la cuenta escrita a mano por quien publica: un renglon borrado o repetido sin querer no pasa
    if (!Number.isInteger(d.total_direcciones) || d.total_direcciones !== direcciones.size) incompleto = true;
    return { estado: incompleto ? 'incompleto' : 'ok', direcciones, dominios, nombres, apellidos, palabras };
}

/** ¿Esa casilla (ya limpia) es de lo privado? Por casilla, o por dominio (y sus subdominios). */
export function esPrivada(casilla, priv) {
    if (priv.direcciones.has(casilla)) return true;
    const dom = casilla.split('@').pop();
    for (const d of priv.dominios) if (dom === d || dom.endsWith(`.${d}`)) return true;
    return false;
}

/** Las casillas del mail (De, en nombre de, Para, CC y copia oculta), o null si alguna no se puede leer. */
export function casillasDe(m) {
    const out = new Set();
    const de = casillaLimpia(m.de_mail);
    if (!de) return null;
    out.add(de);
    if (m.representa_mail !== undefined && m.representa_mail !== null && m.representa_mail !== '') {
        const r = casillaLimpia(m.representa_mail);
        if (!r) return null;
        out.add(r);
    }
    for (const k of ['para_mails', 'cc_mails', 'cco_mails']) {
        const v = m[k];
        if (v === undefined && k === 'cco_mails') continue;
        if (!Array.isArray(v)) return null;
        for (const x of v) { const c = casillaLimpia(x); if (!c) return null; out.add(c); }
    }
    return out;
}

/** ¿Las palabras del texto traen ese nombre? Todas sus palabras juntas (en cualquier orden, con una de mas en el medio como mucho), o la inicial y el apellido. */
export function nombreEnPalabras(palabras, nombre) {
    const n = nombre.length;
    const apellido = nombre[n - 1];
    const inicial = nombre[0][0];
    for (let i = 0; i < palabras.length; i++) {
        if (palabras[i] === apellido && (palabras[i - 1] === inicial || palabras[i + 1] === inicial)) return true;      // «P. Ergo», «Ergo, P.»
        if (!nombre.includes(palabras[i])) continue;
        const ventana = palabras.slice(i, i + n + 1);
        if (nombre.every((p) => ventana.includes(p))) return true;      // «Pedro Ergo», «Ergo, Pedro», «Pedro A. Ergo»
    }
    return false;
}

/**
 * El texto para buscarle casillas: en minusculas y con la arroba y el punto «armados» («paergo (at) barack…»,
 * «paergo @\nbarack…», «paergo%40barack…», «barack (dot) com»).
 */
const paraCasillas = (s) => String(s ?? '').toLowerCase()
    .replace(/\s+/g, ' ')      // primero un solo espacio: con miles de espacios seguidos lo de abajo tardaria segundos
    .replace(/\s*(?:\(\s*(?:at|a|arroba)\s*\)|\[\s*(?:at|a|arroba)\s*\]|\{\s*(?:at|a|arroba)\s*\}|%40|&#0*64;|&#x0*40;|=40|(?<=\s)(?:arroba|at)(?=\s))\s*/g, '@')
    .replace(/\s*(?:\(\s*(?:dot|punto)\s*\)|\[\s*(?:dot|punto)\s*\])\s*/g, '.')
    .replace(/[­​-‏⁠﻿]/g, '')
    .replace(/\s*@\s*/g, '@');

/** Todo lo de texto que trae un mail (lo que sube y lo que no): sus campos y sus casillas. */
function textosDe(m) {
    const listas = ['adjuntos', 'para_mails', 'cc_mails', 'cco_mails'].flatMap((k) => (Array.isArray(m[k]) ? m[k] : []));
    return [m.id, m.asunto, m.cuerpo, m.carpeta, m.de, m.para, m.cc, m.de_mail, m.representa_mail, ...listas].filter((x) => typeof x === 'string');
}

/**
 * ¿El mail trae a alguien de lo privado adentro? Su casilla en cualquier lugar (un mail citado o reenviado), lo de antes
 * de la arroba cuando es inconfundible («paergo»), o su nombre y apellido —tambien pegados («PedroErgo.pdf») o adentro de
 * una casilla («pedro.ergo@gmail.com»)— en cualquier campo: el identificador, el asunto, el texto, un adjunto, la carpeta,
 * los nombres que muestra Outlook y las casillas (una cita «Fulano escribio:», su firma, un reenvio, su correo personal).
 */
export function nombraPrivado(m, priv) {
    const partes = textosDe(m);
    const crudo = paraCasillas(partes.join('\n'));
    for (const c of crudo.match(RE_CASILLA_EN_TEXTO) || []) if (esDeAnthropic(c.replace(/\.$/, ''))) return true;
    for (const dir of priv.direcciones) {
        if (new RegExp(`(?<![a-z0-9])${paraRegex(dir)}(?![a-z0-9-])`).test(crudo)) return true;
        const local = dir.split('@')[0];
        // lo de antes de la arroba, solo: unicamente si es inconfundible (6 letras o mas, sin puntos: «paergo» si, «pablo» no)
        if (/^[a-z0-9]{6,}$/.test(local) && new RegExp(`(?<![a-z0-9])${paraRegex(local)}(?![a-z0-9])`).test(crudo)) return true;
    }
    for (const d of priv.dominios) if (new RegExp(`@(?:[a-z0-9-]+\\.)*${paraRegex(d)}(?![a-z0-9-])`).test(crudo)) return true;
    if (priv.nombres.length || priv.apellidos.length) {
        const palabras = palabrasDe(normalizar(separarPegadas(partes.join('\n'))));
        const seguido = ` ${palabras.join(' ')} `;
        for (const nom of priv.nombres) {
            if (nombreEnPalabras(palabras, nom)) return true;
            // pegado en una sola palabra: «pedroergo», «ergopedro», y la inicial con el apellido («pergo») como palabra entera
            if (seguido.includes(nom.join('')) || seguido.includes([...nom].reverse().join(''))) return true;
            if (seguido.includes(` ${nom[0][0]}${nom[nom.length - 1]} `)) return true;
        }
        // un apellido de la lista: como palabra, y los de 5 letras o mas tambien adentro de otra («cvlerma», «notavillagra»)
        for (const a of priv.apellidos) if (a.length >= 5 ? seguido.includes(a) : palabras.includes(a)) return true;
    }
    return false;
}

const CAMPOS_DE_TEXTO = ['id', 'eid', 'carpeta', 'fecha', 'de', 'de_mail', 'para', 'cc', 'asunto', 'conversacion', 'cuerpo'];
const CAMPOS_DE_LISTA = ['para_mails', 'cc_mails', 'adjuntos'];
/** Lo UNICO que se publica de un mail: estos campos, con su forma. Cualquier otro que traiga no sale. */
export function paraPublicar(m) {
    const out = {};
    for (const k of CAMPOS_DE_TEXTO) out[k] = typeof m[k] === 'string' ? m[k] : '';
    for (const k of CAMPOS_DE_LISTA) out[k] = Array.isArray(m[k]) ? m[k].map(String) : [];
    // sale lo mismo que se miro: las casillas limpias y de la fecha solo la fecha
    out.de_mail = casillaLimpia(out.de_mail);
    out.para_mails = out.para_mails.map(casillaLimpia);
    out.cc_mails = out.cc_mails.map(casillaLimpia);
    out.fecha = (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/.exec(out.fecha) || [''])[0];
    return out;
}

/** 'privado' (no sube), 'cuarentena' (tampoco) o 'entrada'. Ante la duda, no sube. */
export function clasificar(m, priv) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return 'privado';
    if (!priv || priv.estado !== 'ok') return 'privado';      // sin la lista de lo privado completa no hay filtro: nada sube
    // cada campo que subiria tiene que tener su forma: lo que no se sabe leer no se puede filtrar
    for (const k of CAMPOS_DE_TEXTO) if (m[k] !== undefined && typeof m[k] !== 'string') return 'privado';
    if (m.adjuntos !== undefined && (!Array.isArray(m.adjuntos) || m.adjuntos.some((a) => typeof a !== 'string'))) return 'privado';
    if (!parsearFecha(m.fecha)) return 'privado';
    if (!/^[0-9a-f]*$/i.test(m.eid ?? '') || !/^[0-9a-f]*$/i.test(m.conversacion ?? '')) return 'privado';      // son identificadores de Outlook, no texto
    const dirs = casillasDe(m);
    // Sin una casilla legible (remitente, a nombre de quien, o un destinatario) el filtro no tiene contra que comparar.
    if (!dirs || m.sin_resolver) return 'privado';
    for (const d of dirs) if (esDeAnthropic(d) || esPrivada(d, priv)) return 'privado';
    if (nombraPrivado(m, priv)) return 'privado';
    // --- la red de temas: todo lo que subiria
    for (const d of dirs) if (CASILLAS_DE_SECTOR.has(d.split('@')[0])) return 'cuarentena';
    if (NOMBRES_DE_SECTOR.test(normalizar(`${m.de ?? ''} ; ${m.para ?? ''} ; ${m.cc ?? ''}`))) return 'cuarentena';
    if (String(m.carpeta ?? '').split(/[\\/]/).some((parte) => CARPETAS_PERSONALES.has(normalizar(parte)))) return 'cuarentena';
    // quien lo mando lo marco en Outlook como personal, privado o confidencial (0 = normal)
    if (m.reserva !== undefined && m.reserva !== 0) return 'cuarentena';
    const todo = [m.id, m.asunto, ...(m.adjuntos || []), m.cuerpo, m.carpeta, m.de, m.para, m.cc, ...dirs].map((x) => x ?? '').join('\n');
    if (nombraTema(todo, priv.palabras)) return 'cuarentena';
    return 'entrada';
}

/** La carpeta `...\Claude Barack\mails` de la biblioteca de Ingenieria, a partir de `...\CLAUDE POR AREA`. null si no se ve. */
export function carpetaDeMails(raizNube) {
    if (!raizNube) return null;
    const raiz = path.resolve(raizNube);
    if (normalizar(path.basename(raiz)) !== 'claude por area' || !esCarpeta(raiz)) return null;
    const hermana = path.join(path.dirname(raiz), CARPETA_HERMANA);
    return esCarpeta(hermana) && !esEnlace(hermana) ? path.join(hermana, 'mails') : null;
}

/** El nombre de la carpeta de la persona: lo de antes de la arroba de su casilla (con el dominio si no es el de la empresa). */
export function autorDe(persona) {
    const mail = casillaLimpia(persona?.mail);
    if (!mail) return '';
    const [local, dominio] = mail.split('@');
    const limpio = (s) => s.replace(/[^a-z0-9._-]/g, '-');
    return carpetaSegura(dominio === 'barackmercosul.com' ? limpio(local) : `${limpio(local)}@${limpio(dominio)}`);
}

const idLimpio = (id) => String(id ?? '').replace(/\s+/g, ' ').trim();

function idsSubidos(ruta) {
    const ids = new Set();
    try { for (const ln of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) if (ln.trim()) ids.add(ln.trim()); } catch { /* todavia no hay */ }
    return ids;
}

/** Tira un error si la lista de lo ya subido no se va a poder escribir (no es un archivo, o no deja abrirlo para agregar). */
function comprobarQueSePuedeAnotar(ruta) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    let st = null;
    try { st = fs.statSync(ruta); } catch { st = null; }
    if (st && !st.isFile()) throw new Error('la lista de lo ya subido no es un archivo');
    fs.closeSync(fs.openSync(ruta, 'a'));
}

function anotarIds(ruta, lote) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.appendFileSync(ruta, lote.map((m) => `${idLimpio(m.id)}\n`).join(''), 'utf8');
}

/** Un archivo NUEVO en `<mails>\_entrada\<autor>\`. Nunca pisa uno existente ni escribe a traves de un enlace. */
export function escribirLote(carpetaMails, autor, lista, ahora) {
    const entrada = path.join(carpetaMails, '_entrada');
    const carpeta = path.join(entrada, autor);
    for (const p of [path.dirname(carpetaMails), carpetaMails, entrada, carpeta]) if (esEnlace(p)) throw new Error('la carpeta de mails de la nube es un enlace a otro lado: no escribo');
    fs.mkdirSync(carpeta, { recursive: true });
    const base = sello(ahora);
    let ruta = path.join(carpeta, `${base}.jsonl`);
    for (let i = 2; i < 1000 && fs.existsSync(ruta); i++) ruta = path.join(carpeta, `${base}-${i}.jsonl`);
    if (fs.existsSync(ruta)) throw new Error('no encontre un nombre libre para el archivo de mails');
    const tmp = path.join(carpeta, `.${path.basename(ruta)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.subiendo`);
    fs.writeFileSync(tmp, lista.map((m) => `${JSON.stringify(m)}\n`).join(''), { encoding: 'utf8', flag: 'wx' });
    if (fs.existsSync(ruta)) throw new Error('aparecio un archivo con ese nombre mientras escribia');
    fs.renameSync(tmp, ruta);
    return ruta;
}

const TEXTO_AVISO = (desde) => [
    `Desde el ${desde}, en esta PC está prendido que tus mails de trabajo se copien a la nube de Ingeniería.`,
    '',
    'QUÉ SE COPIA',
    'Los mails de tu casilla de Outlook, recibidos y enviados: quién lo mandó, a quién, el asunto, el texto, el nombre de',
    'los adjuntos y en qué carpeta de tu correo está. Los adjuntos no se copian, ni la copia oculta. La primera vez se',
    'copian los últimos 90 días; después, solo lo nuevo.',
    '',
    'CUÁNDO',
    'La primera copia se hace un día después de la fecha de este aviso: hasta entonces no se copia nada.',
    'Después, un mail se copia recién un día después de que llegó o de que lo mandaste: lo que borres antes no se copia.',
    'Se copian solos cuando el Outlook clásico está abierto con tu casilla (al iniciar sesión y cada 4 horas). Con el',
    'Outlook cerrado, o con el Outlook nuevo, no se copia nada.',
    '',
    'QUÉ NO SE COPIA',
    'Los mails con Dirección o Recursos Humanos, aunque vengan citados, reenviados o firmados adentro de otro. Los que',
    'están en una carpeta tuya que se llame «Personal» o «Privado», y los que Outlook tiene marcados como personales,',
    'privados o confidenciales. Los borradores, los eliminados, el correo no deseado y los chats guardados.',
    'Y los que nombran sueldos, salud, sanciones, temas gremiales, claves u otros temas personales.',
    'Eso último lo busca un programa por palabras: un mail personal que no use ninguna de esas palabras se copia igual.',
    'Lo que no quieras compartir, borralo en el día, pasalo a una carpeta «Personal», o avisá.',
    '',
    'QUIÉN LOS PUEDE LEER',
    'La gente de Ingeniería, en la biblioteca de Ingeniería (carpeta «Claude Barack», «mails»).',
    '',
    'CÓMO FUNCIONA',
    'Lo hace solo un programa de esta PC. Solo lee: no manda, no borra y no cambia nada de tu correo.',
    '',
    'PARA APAGARLO',
    'Avisale a Ingeniería (Facundo Santoro). Se apaga desde ahí y deja de copiar. Lo que ya se copió queda en la nube',
    'hasta que Ingeniería lo saque.',
    '',
    'Esto se prendió porque lo acordaste con Ingeniería.',
    '',
].join('\r\n');

/**
 * El aviso a la persona. Si ya esta (y tiene algo escrito) no se toca; vacio, se vuelve a escribir. La fecha es la del dia
 * en que se prendio (`desde`), no la del dia en que se escribe. Devuelve true si lo escribio ahora.
 */
export function dejarAvisoALaPersona(home, desde) {
    const carpeta = path.join(home, 'Trabajo');
    const ruta = path.join(carpeta, NOMBRE_AVISO);
    let tamano = -1;
    try { tamano = fs.statSync(ruta).size; } catch { tamano = -1; }
    if (tamano > 0) return false;
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(ruta, `\uFEFF${TEXTO_AVISO(diaMesAnio(desde))}`, { encoding: 'utf8', flag: tamano === 0 ? 'w' : 'wx' });
    return true;
}

/** Otro aviso, con la fecha en el nombre (no pisa ninguno): el dia que se apaga, o el dia que se vuelve a prender. */
function dejarAvisoDeCambio(home, ahora, prendido) {
    const carpeta = path.join(home, 'Trabajo');
    // con la hora en el nombre: si se apaga y se prende el mismo dia, se ve cual es el ultimo
    const cuando = `${diaMesAnio(ahora, '-')} a las ${dos(ahora.getHours())}.${dos(ahora.getMinutes())}`;
    const nombre = prendido
        ? `AVISO - desde el ${cuando} los mails de esta PC se comparten de nuevo.txt`
        : `AVISO - desde el ${cuando} los mails de esta PC ya no se comparten.txt`;
    const ruta = path.join(carpeta, nombre);
    if (fs.existsSync(ruta)) return false;
    const texto = prendido
        ? `Desde el ${diaMesAnio(ahora)}, en esta PC volvió a prenderse que tus mails de trabajo se copien a la nube de Ingeniería.\r\nQué se copia, qué no y cómo se apaga está en el otro aviso de esta carpeta:\r\n«${NOMBRE_AVISO}».\r\n`
        : `Desde el ${diaMesAnio(ahora)}, los mails de esta PC ya no se copian a la nube de Ingeniería.\r\nLo que se copió hasta ese día sigue en la nube hasta que Ingeniería lo saque: si querés que lo saquen, avisale a Ingeniería (Facundo Santoro).\r\n`;
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(ruta, `\uFEFF${texto}`, { encoding: 'utf8', flag: 'wx' });
    return true;
}

/** Mails de un .jsonl (SOLO PRUEBAS), con la misma forma que entrega el lector de Outlook (puede traer el renglon "buzon"). */
async function* mailsDeJsonl(ruta, corte, conocidos, ctx) {
    for (const ln of fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
        if (!ln.trim()) continue;
        if (Date.now() > ctx.limite) { ctx.completa = false; return; }
        let m;
        try { m = JSON.parse(ln); } catch { continue; }
        if (m && m.t === 'buzon') { ctx.buzon = casillaLimpia(m.casilla); ctx.vioBuzon = true; if (ctx.buzon !== ctx.casilla) return; continue; }
        if (!m || typeof m !== 'object' || Array.isArray(m) || (m.t !== undefined && m.t !== 'mail')) continue;
        ctx.revisados++;
        const f = parsearFecha(m.fecha);
        if (f && f < corte) continue;
        const id = idLimpio(m.id);
        if (!id || conocidos.has(id)) continue;
        conocidos.add(id);
        const { t: _t, ...resto } = m;
        yield { ...resto, id };
    }
}

/** Mails del Outlook clasico abierto, por el lector en PowerShell (solo lectura). Deja en ctx lo que paso. */
async function* mailsDeOutlook({ lector, corte, idsPath, maxSegundos, env, conocidos, segundosSinRespuesta }, ctx) {
    const ps = path.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', lector, '-Desde', isoLocal(corte), '-MaxSegundos', String(maxSegundos)];
    if (fs.existsSync(idsPath)) args.push('-Conocidos', idsPath);
    const hijo = spawn(ps, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const cortar = () => { try { hijo.kill(); } catch { /* ya termino */ } };
    const reloj = setTimeout(() => { ctx.completa = false; cortar(); }, (maxSegundos + 90) * 1000);
    // El lector manda una linea cada 10 segundos mientras Outlook le contesta. Si Outlook muestra un cartel de seguridad
    // la lectura queda esperando a la persona: no se la deja colgada, se corta y se anota.
    let perro = null;
    const pasear = () => { if (perro) clearTimeout(perro); perro = setTimeout(() => { ctx.colgado = true; ctx.completa = false; cortar(); }, segundosSinRespuesta * 1000); };
    let vioFin = false;
    pasear();      // desde que arranca: si Outlook no contesta ni para decir de quien es el buzon, tambien se corta
    try {
        const rl = readline.createInterface({ input: hijo.stdout, crlfDelay: Infinity });
        for await (const ln of rl) {
            if (!ln.trim()) continue;
            let j;
            try { j = JSON.parse(ln); } catch { continue; }
            if (!j || typeof j !== 'object') continue;
            pasear();
            if (j.t === 'buzon') { ctx.buzon = casillaLimpia(j.casilla); ctx.vioBuzon = true; if (ctx.buzon !== ctx.casilla) break; continue; }
            if (j.t === 'latido') continue;
            if (j.t === 'estado') { ctx.outlook = { estado: String(j.estado || 'error'), detalle: String(j.detalle || '') }; continue; }
            if (j.t === 'fin') { vioFin = true; if (j.completa !== true) ctx.completa = false; ctx.revisados += Number(j.revisados) || 0; ctx.fallados += Number(j.fallados) || 0; continue; }
            if (j.t !== 'mail') continue;
            // sin saber de quien es el buzon no sale ningun mail
            if (!ctx.vioBuzon) { ctx.buzon = ''; break; }
            const id = idLimpio(j.id);
            if (!id || conocidos.has(id)) continue;
            conocidos.add(id);
            const { t: _t, ...m } = j;
            yield { ...m, id };
        }
    } finally {
        clearTimeout(reloj);
        if (perro) clearTimeout(perro);
        if (!vioFin) { ctx.completa = false; if (!ctx.outlook && !ctx.colgado && ctx.vioBuzon && ctx.buzon === ctx.casilla) ctx.outlook = { estado: 'error', detalle: 'el lector de Outlook no termino' }; }
        cortar();
    }
}

const CODIGO = { apagado: 0, ok: 0, parcial: 0, privado: 0, simulado: 0, pausado: 0, primer_dia: 0, sin_casilla: 3, otro_buzon: 3, outlook_cerrado: 4, outlook_nuevo: 4, sin_outlook: 4, outlook_no_responde: 4, sin_filtro: 5, filtro_incompleto: 5, sin_nube: 6, error: 1 };
// Con estos resultados la PC sigue LISTA para subir (la fila dice "sube", lo privado esta completo y la persona tiene su aviso).
const SIGUE_LISTA = new Set(['ok', 'parcial', 'pausado', 'primer_dia', 'otro_buzon', 'outlook_cerrado', 'outlook_nuevo', 'sin_outlook', 'outlook_no_responde', 'error', 'sin_nube']);

/**
 * Una corrida. `opciones`: { home, raizNube, estado, simular, maxMinutos, diasAtras } y, SOLO PARA LAS PRUEBAS (no llegan
 * por la linea de comandos): { fuenteJsonl, lector, ahora, env, identidad, segundosSinRespuesta }.
 * Devuelve { codigo, resumen } y no tira excepciones por lo esperable.
 */
export async function correr(opciones) {
    const env = opciones.env || process.env;
    const ahora = opciones.ahora instanceof Date ? opciones.ahora : new Date();
    const home = path.resolve(opciones.home || 'C:\\ClaudeBarack');
    const estadoDir = path.resolve(opciones.estado || path.join(env.LOCALAPPDATA || home, 'BarackEquipo'));
    const estadoPath = path.join(estadoDir, ARCHIVO_ESTADO);
    const idsPath = path.join(estadoDir, ARCHIVO_SUBIDOS);
    const simular = !!opciones.simular;
    const previo = leerJson(estadoPath) || {};
    let escritos = 0;         // mails que de verdad quedaron escritos en la nube en esta corrida
    let lista = false;        // paso los controles de esta corrida: la fila, lo privado, la casilla, la nube y el aviso
    const salir = (resultado, extra = {}) => {
        const { estado: masEstado, ...resumen } = { resultado, ...extra };
        // El estado local es lo que lee el aviso de arranque del asistente, para no negarlo ni afirmarlo de mas:
        //   habilitada    = la PC esta lista para subir y la persona ya tiene su aviso escrito;
        //   subidos_total = cuantos mails subio en total (no baja nunca: lo que subio, subio).
        if (!simular && (Object.keys(previo).length > 0 || resultado !== 'apagado')) {
            const subidos = (Number(previo.subidos_total) || 0) + escritos;
            // sin la nube a la vista en esta corrida: sigue como venia (si ya estaba lista, lo sigue estando)
            const habilitada = SIGUE_LISTA.has(resultado) && (lista || (resultado === 'sin_nube' && previo.habilitada === true));
            const nuevo = { ...previo, ...masEstado, habilitada, subidos_total: subidos, resultado, ultima: isoLocal(ahora) };
            // se apago una PC a la que se le habia avisado que estaba prendida: la persona se entera por escrito, igual que
            // cuando se prendio (aunque en el medio haya pasado por otro estado: lo que cuenta es que tiene aquel aviso)
            if (resultado === 'apagado' && previo.aviso_desde && !previo.apagada_desde) {
                try { dejarAvisoDeCambio(home, ahora, false); nuevo.apagada_desde = isoLocal(ahora); } catch { /* el aviso no frena el apagado */ }
            }
            for (const k of Object.keys(nuevo)) if (nuevo[k] === undefined || nuevo[k] === null) delete nuevo[k];
            try { escribirAtomico(estadoPath, `${JSON.stringify(nuevo, null, 2)}\n`); } catch { /* el estado no frena */ }
        }
        return { codigo: CODIGO[resultado] ?? 1, resumen };
    };

    // 1) ¿esta PC sube? Solo si la lista publicada lo dice para ESTA persona en ESTA PC.
    const comun = path.join(home, 'publicado', 'conocimiento', 'comun');
    const identidad = opciones.identidad && typeof opciones.identidad === 'object' ? opciones.identidad : identidadReal();
    const persona = personaQueSube(leerJson(path.join(comun, 'personas.json')), identidad);
    if (!persona || persona.mails !== 'sube') return salir('apagado');

    // 2) lo privado: sin la lista completa no sale nada
    const priv = cargarPrivados(path.join(comun, 'mails_privados.json'));
    if (priv.estado === 'falta' || priv.estado === 'roto') return salir('sin_filtro', { detalle: 'no esta la lista de lo privado en lo instalado, o no se puede leer' });
    if (priv.estado === 'incompleto') return salir('filtro_incompleto', { detalle: 'la lista de lo privado esta sin completar o mal escrita' });
    const casilla = casillaLimpia(persona.mail);
    const autor = autorDe(persona);
    if (!casilla || !autor) return salir('sin_casilla', { detalle: 'la fila de la persona no trae su casilla de mail' });
    if (esPrivada(casilla, priv)) return salir('privado', { detalle: 'la casilla de esta persona esta en la lista de lo privado' });

    // 3) a donde: la carpeta de mails de la biblioteca de Ingenieria
    const carpetaMails = carpetaDeMails(opciones.raizNube);
    if (!carpetaMails) return salir('sin_nube', { detalle: 'no veo la biblioteca de Ingenieria (se reintenta)' });

    // La PC esta lista: la persona se entera ANTES de que se lea nada.
    const desde = parsearFecha(previo.aviso_desde) || ahora;
    let avisoNuevo = false;
    const marcas = { aviso_desde: isoLocal(desde) };
    // se vuelve a prender despues de un apagado: el dia de espera corre de nuevo desde hoy
    let prendidaDesde = desde;
    if (!simular) {
        try {
            avisoNuevo = dejarAvisoALaPersona(home, desde);
            if (previo.apagada_desde) { dejarAvisoDeCambio(home, ahora, true); marcas.apagada_desde = null; marcas.prendida_de_nuevo = isoLocal(ahora); prendidaDesde = ahora; }
            else if (parsearFecha(previo.prendida_de_nuevo)) prendidaDesde = parsearFecha(previo.prendida_de_nuevo);
        } catch { return salir('error', { detalle: 'no pude dejarle el aviso a la persona: no leo nada' }); }
    }
    lista = true;
    const privados = `${priv.direcciones.size} casillas, ${priv.dominios.size} dominios, ${priv.nombres.length} nombres, ${priv.apellidos.length} apellidos`;

    // El primer dia solo se avisa: la primera copia (que trae los ultimos 90 dias) es recien un dia despues, para que la
    // persona pueda leer el aviso y sacar o pasar a su carpeta «Personal» lo que no quiera compartir.
    if (!simular && ahora.getTime() - prendidaDesde.getTime() < GRACIA_HORAS * 3600000) {
        return salir('primer_dia', { autor, privados, aviso_nuevo: avisoNuevo, detalle: 'la persona tiene su aviso desde hace menos de un dia: la primera copia es despues', estado: marcas });
    }

    // Si Outlook no contesto dos veces seguidas (puede ser un cartel de seguridad en la pantalla), no se insiste por una semana.
    const pausa = parsearFecha(previo.pausado_hasta);
    if (pausa && pausa > ahora) return salir('pausado', { autor, privados, detalle: `Outlook no contesto dos veces seguidas: no se vuelve a intentar hasta el ${diaMesAnio(pausa)}`, estado: marcas });

    // 4) desde cuando, y hasta cuando (el mail de menos de un dia espera)
    const dias = Number(opciones.diasAtras) > 0 ? Number(opciones.diasAtras) : DIAS_ATRAS;
    const diasAtras = (d, n) => new Date(d.getTime() - n * 86400000);
    let corte;
    if (previo.marca && parsearFecha(previo.marca)) corte = diasAtras(parsearFecha(previo.marca), MARGEN_DIAS);
    else corte = parsearFecha(previo.corte_inicial) || diasAtras(ahora, dias);
    const hasta = new Date(ahora.getTime() - GRACIA_HORAS * 3600000);

    const conocidos = idsSubidos(idsPath);
    const maxMin = Number(opciones.maxMinutos) > 0 ? Number(opciones.maxMinutos) : MAX_MINUTOS;
    const ctx = { limite: Date.now() + maxMin * 60000, completa: true, revisados: 0, fallados: 0, outlook: null, casilla, buzon: null, vioBuzon: false, colgado: false };
    const lector = opciones.lector || path.join(path.dirname(fileURLToPath(import.meta.url)), 'mails_outlook.ps1');
    let fuente;
    if (opciones.fuenteJsonl) fuente = mailsDeJsonl(opciones.fuenteJsonl, corte, conocidos, ctx);
    else {
        if (!fs.existsSync(lector)) return salir('error', { detalle: 'no esta el lector de Outlook', estado: marcas });
        const sinRespuesta = Number(opciones.segundosSinRespuesta) > 0 ? Number(opciones.segundosSinRespuesta) : SEGUNDOS_SIN_RESPUESTA;
        fuente = mailsDeOutlook({ lector, corte, idsPath, maxSegundos: Math.max(30, Math.round(maxMin * 60) - 60), env, conocidos, segundosSinRespuesta: sinRespuesta }, ctx);
    }

    const cuenta = { privado: 0, cuarentena: 0, entrada: 0 };
    let nuevos = 0;
    let enEspera = 0;
    let lote = [];
    const volcar = () => {
        const suben = [];
        for (const m of lote) {
            // un mail que el filtro no puede terminar de mirar (cualquier error) no sube, y no traba a los demas
            let c = 'privado';
            try { c = clasificar(m, priv); } catch { c = 'privado'; }
            cuenta[c]++;
            // privado y cuarentena no salen de la PC; de lo que sube sale solo la lista cerrada de campos
            if (c === 'entrada') suben.push(paraPublicar(m));
        }
        if (!simular) {
            // antes de subir, que se pueda anotar: si no, cada corrida volveria a subir lo mismo
            comprobarQueSePuedeAnotar(idsPath);
            if (suben.length) { escribirLote(carpetaMails, autor, suben, ahora); escritos += suben.length; }
            anotarIds(idsPath, lote);
        }
        lote = [];
    };
    const datos = () => ({ autor, desde: isoLocal(corte).slice(0, 10), revisados: ctx.revisados, fallados: ctx.fallados, nuevos, en_espera: enEspera, entrada: cuenta.entrada, cuarentena: cuenta.cuarentena, privado: cuenta.privado, privados, aviso_nuevo: avisoNuevo });
    try {
        for await (const m of fuente) {
            // el mail de menos de un dia todavia no sube ni se anota: lo va a mirar una corrida de mas adelante
            const f = parsearFecha(m && m.fecha);
            if (f && f > hasta) { enEspera++; continue; }
            lote.push(m);
            nuevos++;
            if (lote.length >= LOTE) volcar();
        }
        if (lote.length) volcar();
    } catch (e) {
        return salir('error', { ...datos(), detalle: `no pude escribir (en la nube o en la lista de lo ya subido): ${String(e && e.message ? e.message : e).slice(0, 200)}`, estado: marcas });
    }

    // Outlook dejo de contestar: se anota, y a la segunda seguida se pausa
    if (ctx.colgado) {
        const colgadas = (Number(previo.colgadas) || 0) + 1;
        const masEstado = { ...marcas, colgadas };
        if (colgadas >= 2) masEstado.pausado_hasta = isoLocal(new Date(ahora.getTime() + DIAS_DE_PAUSA * 86400000));
        return salir('outlook_no_responde', { ...datos(), detalle: 'Outlook dejo de contestar: puede haber un cartel de seguridad en la pantalla de la persona', estado: simular ? {} : masEstado });
    }
    // el buzon abierto tiene que ser el de la casilla de la fila (con el lector de verdad, siempre; en las pruebas, si lo dicen)
    if ((ctx.vioBuzon || !opciones.fuenteJsonl) && ctx.buzon !== casilla && !ctx.outlook) return salir('otro_buzon', { ...datos(), detalle: 'el buzon abierto en Outlook no es el de la casilla de esta persona (o no se pudo saber de quien es)', estado: marcas });
    if (ctx.outlook && nuevos === 0) {
        const mapa = { cerrado: 'outlook_cerrado', nuevo: 'outlook_nuevo', no_instalado: 'sin_outlook', no_responde: 'outlook_no_responde' };
        return salir(mapa[ctx.outlook.estado] || 'error', { ...datos(), detalle: ctx.outlook.detalle, estado: marcas });
    }
    if (simular) return salir('simulado', { ...datos(), completa: ctx.completa });
    const estado = { ...marcas, corte_inicial: previo.corte_inicial || isoLocal(corte), autor, revisados: ctx.revisados, nuevos, completa: ctx.completa, colgadas: 0, pausado_hasta: null };
    if (ctx.completa) estado.marca = isoLocal(ahora);
    return salir(ctx.completa ? 'ok' : 'parcial', { ...datos(), estado });
}

function leerArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--simular') a.simular = true;
        else if (k.startsWith('--') && i + 1 < argv.length) a[k.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    }
    return a;
}

const mismaRuta = (a, b) => { const r = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } }; return r(a).toLowerCase() === r(b).toLowerCase(); };
const esElPrograma = !!process.argv[1] && mismaRuta(process.argv[1], fileURLToPath(import.meta.url));
if (esElPrograma) {
    const a = leerArgs(process.argv.slice(2));
    const fin = (resumen, codigo) => { process.stdout.write(`${JSON.stringify(resumen)}\n`); process.exit(codigo); };
    if (!a.home || !a.estado) fin({ resultado: 'error', detalle: 'faltan --home y --estado' }, 1);
    // Corre solo desde su instalacion (`<casa>\publicado\programas\`) y con las listas de ESA instalacion: no se le puede
    // apuntar a otra carpeta con otras listas. Por la linea de comandos no hay fuente de prueba, ni otro lector, ni otra hora.
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    if (path.basename(aqui).toLowerCase() !== 'programas' || path.basename(path.dirname(aqui)).toLowerCase() !== 'publicado' || !mismaRuta(a.home, path.resolve(aqui, '..', '..'))) {
        fin({ resultado: 'error', detalle: 'este programa corre solo desde su instalacion y con las listas de esa instalacion' }, 1);
    }
    correr({ home: a.home, raizNube: a.raizNube, estado: a.estado, simular: a.simular, maxMinutos: a.maxMinutos, diasAtras: a.diasAtras })
        .then(({ codigo, resumen }) => fin(resumen, codigo))
        .catch((e) => fin({ resultado: 'error', detalle: String(e && e.message ? e.message : e).slice(0, 200) }, 1));
}
