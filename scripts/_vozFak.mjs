/**
 * _vozFak.mjs — medir como escribe Fak, y revisar que un mail mio suene a el.
 *
 * POR QUE
 *   Fak, 11/09/2026: *"cuando envio un mail siempre pongo 'hice el amfe', no 'logramos'…
 *   para que de ahora en mas vos realmente me reemplaces"*. El perfil no se escribe a mano:
 *   si lo escribo yo es mi idea de el. Se MIDE de los mails que el mando.
 *
 * COMANDOS
 *   node scripts/_vozFak.mjs --medir            # regenera scripts/_lib/vozFak.data.json
 *   node scripts/_vozFak.mjs --revisar <txt>    # semaforo de un borrador (o - para stdin)
 *   node scripts/_vozFak.mjs --selftest         # el gate contra el corpus, en las dos direcciones
 *   node scripts/_vozFak.mjs --diff             # que le cambio Fak a mis borradores antes de mandarlos
 *
 * NO ESCRIBE NADA FUERA DE `scripts/_lib/vozFak.data.json`, y solo con --medir.
 * El contenido de los mails NO sale de `.mail-cache/` (repo publico).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAILS_JSONL } from './_lib/mailCache.mjs';
import { revisarVoz, formatear, cargarPerfil, cuerpoPropio, PERFIL_JSON, ROJO } from './_lib/vozGate.mjs';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * VOZ PURA: hasta 2026-02 inclusive. Despues de esa fecha ya hay mails que redacte yo
 * saliendo de su casilla, y medirlos seria medirme a mi mismo (el repo arranca 2026-02-25).
 */
export const CORTE_VOZ_PURA = '2026-03-01';
const ENVIADOS = 'Elementos enviados';

/** Los mails que Fak mando, con cuerpo. Streaming: el jsonl pesa 21 MB. */
export async function leerEnviados({ hasta = null, desde = null, jsonl = MAILS_JSONL } = {}) {
    const out = [];
    if (!fs.existsSync(jsonl)) return out;
    const rl = readline.createInterface({ input: fs.createReadStream(jsonl, 'utf8'), crlfDelay: Infinity });
    for await (const linea of rl) {
        if (!linea.trim()) continue;
        let m;
        try { m = JSON.parse(linea); } catch { continue; }
        if (!String(m.carpeta ?? '').includes(ENVIADOS)) continue;
        const fecha = String(m.fecha ?? '');
        if (hasta && fecha >= hasta) continue;
        if (desde && fecha < desde) continue;
        const cuerpo = cuerpoPropio(m.cuerpo).replace(/[ \t]+/g, ' ').trim();
        if (cuerpo.split(/\s+/).length < 3) continue;   // reenvios sin texto propio
        // Notificaciones de Planner/Teams reenviadas: salen de su casilla pero no las escribio el.
        if (/te ha asignado|Microsoft Corporation|no-?reply|notificaci[oó]n autom/i.test(cuerpo)) continue;
        out.push({ fecha, para: String(m.para ?? ''), asunto: String(m.asunto ?? ''), cuerpo });
    }
    return out;
}

const percentil = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function contar(lista) {
    const c = new Map();
    for (const x of lista) c.set(x, (c.get(x) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

export function medirPerfil(mails) {
    const largos = mails.map((m) => m.cuerpo.length);
    const palabras = mails.map((m) => m.cuerpo.split(/\s+/).length);
    const arranques = [], cierres = [];
    let singular = 0, plural = 0;
    const RE_SG = /\b(hice|envi[oó]|adjunto|revis[eé]|arm[eé]|detect[eé]|necesito|quedo|actualic[eé]|calcul[eé]|complet[eé]|corregi|corregí|mand[eé]|cargu[eé])\b/gi;
    const RE_PL = /\b(hicimos|logramos|revisamos|enviamos|adjuntamos|analizamos|armamos|detectamos|actualizamos|corregimos)\b/gi;
    for (const m of mails) {
        const t = m.cuerpo;
        singular += (t.match(RE_SG) || []).length;
        plural += (t.match(RE_PL) || []).length;
        // Solo lineas de texto: fuera URLs, restos de firma y separadores, que si no se
        // cuelan en el top de arranques y el perfil deja de ser legible.
        const lineas = t.split('\n').map((x) => x.trim())
            .filter((x) => x && !/^[<(]?https?:|^[_\-=*]{3,}|@barackmercosul|^\W*$/i.test(x));
        if (!lineas.length) continue;
        const prim = sinTildes(lineas[0]).replace(/[,:.!].*$/, '').slice(0, 22).trim();
        if (prim) arranques.push(prim);
        const ult = sinTildes(lineas[lineas.length - 1]).replace(/[.!]$/, '').slice(0, 22).trim();
        if (ult) cierres.push(ult);
    }
    const top = (lista, min) => contar(lista).filter(([, n]) => n >= min).slice(0, 12)
        .map(([texto, n]) => ({ texto, n }));
    return {
        _generado: new Date().toISOString().slice(0, 10),
        _fuente: `.mail-cache/mails.jsonl · "${ENVIADOS}" · hasta ${CORTE_VOZ_PURA} (voz pura)`,
        _como_se_regenera: 'node scripts/_vozFak.mjs --medir',
        n: mails.length,
        largo: {
            mediana: percentil(largos, 50), p75: percentil(largos, 75), p90: percentil(largos, 90),
            testamento: 2500,
            palabras_mediana: percentil(palabras, 50), palabras_p90: percentil(palabras, 90),
        },
        persona: {
            singular_por_mail: +(singular / mails.length).toFixed(2),
            plural_por_mail: +(plural / mails.length).toFixed(2),
        },
        arranques: top(arranques, 5),
        cierres: top(cierres, 5),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest: el gate se audita en las dos direcciones (que pueda dar rojo Y que pueda dar verde)
// ─────────────────────────────────────────────────────────────────────────────

/** Casos dirigidos, todos textuales del corpus o de mis borradores. */
export const CASOS = [
    ['MIO 01/09 a Carlos y Leo', 'Carlos, Leo,\n\nActualizamos en INCA la capacidad del apoyabrazos trasero central de Patagonia.\n\nSaludos', ROJO],
    ['MIO 07/09 a Pablo', 'Pablo,\n\nCorregimos en el arb el punzonado de dos piezas de 100 grs/m2: 21-9689 y 21-8944.\n\nSaludos', ROJO],
    ['MIO 11/09 a Novax', 'Estimados,\n\nRevisamos a fondo los AMFE y los flujogramas que mande el 08/09 y tenian varios errores.\n\nSaludos', ROJO],
    ['FAK con un tercero nombrado', 'Buenos dias, Junto con Paulo Centurion y Nicolas Perez, hicimos modificaciones en el Top Roll de P703.', null],
    ['FAK propuesta a futuro', 'Si al revisarlo detectas algun detalle que quisieras cambiar o ajustar, avisame y lo revisamos juntos.', null],
    ['FAK el area informa', 'Buenas tardes, Les informamos que actualizamos el AMFE de Proceso y las hojas de proceso asociadas.', null],
    ['FAK queria informarles', 'Hola, Queria informarles que ya cargamos la nueva tizada en la mesa de corte.', null],
    ['FAK mail tipico', 'Adjunto tambien el flujograma actualizado.', null],
    ['FAK en singular', 'Buen dia, Actualice el arb con los consumos del P703. Adjunto el extracto de las 10 piezas. Saludos.', null],
    ['MIO giro de informe', 'Manuel,\n\nTe paso el estado del PPAP.\n\nTres cosas para mirar:\n\n- Los tres AMFE son de la version del 24/08.\n', ROJO],
    ['MIO formula formal', 'Estimados, Por medio de la presente se procedio a corregir el AMFE. Cordialmente,', ROJO],
];

async function selftest() {
    const perfil = cargarPerfil();
    let fallas = 0;
    console.log('CASOS DIRIGIDOS (rojo esperado vs verde esperado)');
    for (const [nombre, texto, esperado] of CASOS) {
        const r = revisarVoz(texto, perfil);
        const dio = r.rojos > 0 ? ROJO : null;
        const ok = dio === esperado;
        if (!ok) fallas++;
        const codigos = r.hallazgos.filter((h) => h.nivel === ROJO).map((h) => h.codigo).join(',') || '-';
        console.log(`  ${ok ? 'OK   ' : 'FALLA'} ${dio === ROJO ? 'ROJO ' : 'verde'}  ${nombre.padEnd(30)} ${codigos}`);
    }

    const mails = await leerEnviados({ hasta: CORTE_VOZ_PURA });
    if (!mails.length) {
        console.log('\nSin cache de mails: no se puede correr la mitad que importa (los falsos rojos).');
        return fallas ? 1 : 0;
    }
    const conRojo = [];
    for (const m of mails) {
        const r = revisarVoz(m.cuerpo, perfil);
        if (r.rojos) conRojo.push({ m, r });
    }
    const pct = (100 * conRojo.length) / mails.length;
    console.log(`\nFALSOS ROJOS sobre la voz pura de Fak: ${conRojo.length} de ${mails.length} (${pct.toFixed(2)}%)`);
    const porCodigo = contar(conRojo.flatMap(({ r }) => r.hallazgos.filter((h) => h.nivel === ROJO).map((h) => h.codigo)));
    for (const [cod, n] of porCodigo) console.log(`   ${String(n).padStart(4)}  ${cod}`);
    for (const { m, r } of conRojo.slice(0, 5)) {
        console.log(`   ej [${m.fecha.slice(0, 10)}] ${r.hallazgos.find((h) => h.nivel === ROJO).codigo}: "${m.cuerpo.slice(0, 90)}"`);
    }
    if (pct > 2) { console.log('\n>2% de falsos rojos: el gate esta midiendo MI idea de Fak. No se cablea asi.'); fallas++; }
    console.log(fallas ? `\n${fallas} FALLAS` : '\nSELFTEST OK');
    return fallas ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────

async function medir() {
    const mails = await leerEnviados({ hasta: CORTE_VOZ_PURA });
    if (!mails.length) {
        console.error(`Sin mails en ${MAILS_JSONL}. Corre antes: python scripts/_mails.py --sync`);
        process.exit(2);
    }
    const perfil = medirPerfil(mails);
    fs.writeFileSync(PERFIL_JSON, JSON.stringify(perfil, null, 2) + '\n', 'utf8');
    console.log(`PERFIL DE VOZ — ${perfil.n} mails de Fak (hasta ${CORTE_VOZ_PURA})`);
    console.log(`  largo:   mediana ${perfil.largo.mediana} car (${perfil.largo.palabras_mediana} palabras) · p75 ${perfil.largo.p75} · p90 ${perfil.largo.p90}`);
    console.log(`  persona: singular ${perfil.persona.singular_por_mail}/mail · plural ${perfil.persona.plural_por_mail}/mail`);
    console.log(`  arranca: ${perfil.arranques.slice(0, 6).map((a) => `${a.texto} (${a.n})`).join(' · ')}`);
    console.log(`  cierra:  ${perfil.cierres.slice(0, 6).map((a) => `${a.texto} (${a.n})`).join(' · ')}`);
    console.log(`\nEscrito en ${path.relative(RAIZ, PERFIL_JSON)}`);
}

function revisar(ruta) {
    const texto = ruta === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(ruta, 'utf8');
    const r = revisarVoz(texto);
    console.log(formatear(r, { titulo: ruta === '-' ? 'VOZ DEL MAIL' : path.basename(ruta) }));
    process.exit(r.rojos ? 1 : 0);
}

/**
 * --diff: que le cambio Fak a un borrador mio antes de mandarlo. Esa diferencia es la
 * correccion explicita, y es lo que ningun modelo de estilo puede adivinar solo.
 */
async function diff() {
    const escritorio = process.env.ESCRITORIO_FAK
        || path.join(process.env.USERPROFILE || '', 'OneDrive - BARACK ARGENTINA SRL', 'Desktop');
    if (!fs.existsSync(escritorio)) { console.error(`No encuentro el Escritorio: ${escritorio}`); process.exit(2); }
    const borradores = [];
    const caminar = (dir, nivel = 0) => {
        if (nivel > 2) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) caminar(p, nivel + 1);
            else if (/^_mail.*\.txt$/i.test(e.name)) borradores.push(p);
        }
    };
    caminar(escritorio);
    const enviados = await leerEnviados({ desde: '2026-08-01' });
    console.log(`BORRADORES MIOS: ${borradores.length} · ENVIADOS desde 08/2026: ${enviados.length}\n`);
    for (const b of borradores) {
        const texto = fs.readFileSync(b, 'utf8');
        const r = revisarVoz(texto);
        console.log(`── ${path.relative(escritorio, b)}`);
        console.log(formatear(r, { titulo: 'borrador' }).split('\n').map((l) => `   ${l}`).join('\n'));
        const clave = path.basename(b, '.txt').replace(/^_mail[^a-z0-9]*/i, '').slice(0, 25).toLowerCase();
        const parecidos = enviados.filter((e) => sinTildes(e.asunto).includes(sinTildes(clave).slice(0, 12)));
        if (parecidos.length) {
            const e = parecidos[parecidos.length - 1];
            const rr = revisarVoz(e.cuerpo);
            console.log(`   ENVIADO [${e.fecha.slice(0, 10)}] "${e.asunto.slice(0, 60)}" — ${e.cuerpo.length} car vs ${r.largo} del borrador`);
            console.log(`   ${rr.rojos ? 'salio con ROJO' : 'salio limpio'}${e.cuerpo.length < r.largo ? ' · Fak lo ACORTO' : ''}`);
        }
        console.log('');
    }
}

// El CLI solo cuando se corre el archivo; el test lo importa por sus exports.
const esCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const args = esCli ? process.argv.slice(2) : ['--nada'];
const cmd = args[0];
if (cmd === '--nada') { /* importado como modulo */ }
else if (cmd === '--medir') await medir();
else if (cmd === '--revisar') revisar(args[1] || '-');
else if (cmd === '--selftest') process.exit(await selftest());
else if (cmd === '--diff') await diff();
else {
    console.log(`Uso:
  node scripts/_vozFak.mjs --medir           regenera el perfil desde el cache de mails
  node scripts/_vozFak.mjs --revisar <txt>   semaforo de un borrador ("-" para stdin)
  node scripts/_vozFak.mjs --selftest        el gate en las dos direcciones
  node scripts/_vozFak.mjs --diff            que le cambio Fak a mis borradores`);
}
