/**
 * _regenerarAmfesServidor.ts — regenera los AMFE oficiales que viven en el
 * servidor Y: a partir de un dump de `amfe_documents`, respetando la carpeta y
 * el nombre de archivo que ya existen.
 *
 * Uso:
 *   npx tsx scripts/_regenerarAmfesServidor.ts <dump.txt> [--apply] [--solo <nro>]
 *
 * El dump es el archivo que persiste el MCP de Supabase al correr:
 *   select id, amfe_number, subject, part_number, status, data, revisions
 *   from amfe_documents order by amfe_number;
 *
 * Sin --apply hace DRY-RUN: imprime la correspondencia documento <-> archivo con
 * la evidencia que la sustenta y no escribe nada.
 *
 * REGLA DE SEGURIDAD — nunca adivina. Un documento se escribe sobre un archivo
 * solo si el archivo ACTUAL confirma que es el mismo AMFE (mismo numero, mismo
 * tema o mismo numero de pieza). Sin confirmacion se saltea y se reporta: es
 * preferible dejar un archivo viejo que pisar el AMFE de otra pieza.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';

const RAIZ = 'Y:/Ingenieria/Documentacion Gestion Ingenieria/13. Analisis del modo de falla y sus efectos ( I-AC-005.3)';
const CARPETAS_ACTIVAS = ['2. AMFES DE PROCESO', '3. AMFES MAESTROS'];
const EXCLUIR = /OBSOLETO|_POR_REVISAR|BACKUP/i;

interface DumpRow {
    id: string; amfe_number: string | null; subject: string | null;
    part_number: string | null; status: string | null; data: string; revisions: string | null;
}

/** Normaliza para comparar: sin acentos, sin puntuacion, mayusculas. */
function norm(s: unknown): string {
    return String(s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function leerDump(path: string): DumpRow[] {
    const raw = readFileSync(path, 'utf8');
    let texto = raw;
    try { texto = (JSON.parse(raw) as { result: string }).result; } catch { /* texto plano */ }
    const m = texto.match(/\n(\[[\s\S]*\])\n/);
    if (!m) throw new Error('No pude extraer el array JSON del dump');
    return JSON.parse(m[1]) as DumpRow[];
}

/** Todos los .xlsx activos del servidor (sin obsoletos ni backups). */
function listarXlsx(dir: string, acc: string[] = []): string[] {
    for (const nombre of readdirSync(dir)) {
        const p = join(dir, nombre);
        if (EXCLUIR.test(nombre)) continue;
        if (statSync(p).isDirectory()) listarXlsx(p, acc);
        else if (/\.xlsx$/i.test(nombre) && !nombre.startsWith('~$')) acc.push(p);
    }
    return acc;
}

/**
 * Identidad del AMFE segun el archivo que HOY esta en el servidor. Busca las
 * etiquetas por texto porque las plantillas historicas no comparten coordenadas.
 */
function identidadDelArchivo(path: string): { nro: string; tema: string; pieza: string } {
    const wb = XLSX.readFile(path, { sheetRows: 20 });
    const campos: Record<string, string> = {};
    const ETIQUETAS: Array<[RegExp, string]> = [
        [/^N.?\s*DE\s*AMFE|^AMFE\s*NRO/i, 'nro'],
        [/^TEMA|^ASUNTO/i, 'tema'],
        [/^NRO\.?\s*PIEZA|^CODIGO\s*DE\s*PIEZA/i, 'pieza'],
    ];
    for (const hoja of wb.SheetNames) {
        const ws = wb.Sheets[hoja];
        const ref = ws['!ref']; if (!ref) continue;
        const range = XLSX.utils.decode_range(ref);
        for (let r = range.s.r; r <= Math.min(range.e.r, 19); r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                const v = cell?.v; if (typeof v !== 'string') continue;
                for (const [re, key] of ETIQUETAS) {
                    if (campos[key] || !re.test(v.trim())) continue;
                    for (let k = c + 1; k <= Math.min(c + 6, range.e.c); k++) {
                        const nv = ws[XLSX.utils.encode_cell({ r, c: k })]?.v;
                        if (nv != null && String(nv).trim() !== '') { campos[key] = String(nv).trim(); break; }
                    }
                }
            }
        }
    }
    return { nro: campos.nro ?? '', tema: campos.tema ?? '', pieza: campos.pieza ?? '' };
}

/** Numero de AMFE que anuncia la carpeta contenedora ("150 - APOYABRAZOS..." -> "150"). */
function nroDeLaCarpeta(path: string): string {
    const partes = path.replace(/\\/g, '/').split('/');
    for (let i = partes.length - 2; i >= 0; i--) {
        const m = /^(\d{2,4})\s*-\s*/.exec(partes[i]);
        if (m) return m[1];
    }
    const m = /AMFE\s+(\d{2,4})\s*-/.exec(partes[partes.length - 1]);
    return m ? m[1] : '';
}

// ---------------------------------------------------------------- main
const SRC = process.argv[2];
const APPLY = process.argv.includes('--apply');
const soloIdx = process.argv.indexOf('--solo');
const SOLO = soloIdx > -1 ? process.argv[soloIdx + 1] : null;
if (!SRC) { console.error('Uso: npx tsx scripts/_regenerarAmfesServidor.ts <dump.txt> [--apply] [--solo <nro>]'); process.exit(1); }

const docs = leerDump(SRC);
const archivos = CARPETAS_ACTIVAS.flatMap(c => listarXlsx(join(RAIZ, c)));
console.info(`Documentos en el dump: ${docs.length}  |  xlsx activos en el servidor: ${archivos.length}\n`);

const identidades = new Map(archivos.map(f => [f, identidadDelArchivo(f)]));

interface Match { doc: DumpRow; archivo: string; motivo: string }

/** Datos de identidad de cada documento, ya normalizados. */
const perfiles = docs.map(doc => {
    const header = (() => { try { return JSON.parse(doc.data)?.header ?? {}; } catch { return {}; } })();
    return {
        doc,
        nro: norm(doc.amfe_number ?? header.amfeNumber),
        tema: norm(doc.subject || header.subject || header.scope),
        pieza: norm(doc.part_number || header.partNumber),
        temaCrudo: String(doc.subject || header.subject || header.scope || ''),
    };
});

/**
 * Matcheo en pasadas, de la senal mas fuerte a la mas debil, sacando de la pila
 * los archivos ya asignados. En una sola pasada el AMFE 129 ("IP DECORATIVE PA2
 * AMAROK") se llevaba el archivo del 128 ("IP DECORATIVE PA2 AMAROK - IP CORTO")
 * porque su tema esta CONTENIDO en el del otro.
 */
const matches: Match[] = [];
const libres = new Set(archivos);
const pendientes = new Set(perfiles);

type Regla = { nombre: string; test: (p: typeof perfiles[number], archivo: string) => string | null };
const REGLAS: Regla[] = [
    {
        nombre: 'nro',
        test: (p, a) => {
            const id = identidades.get(a)!;
            if (!/^\d{2,4}$/.test(p.nro)) return null;
            if (p.nro === norm(id.nro) || p.nro === norm(nroDeLaCarpeta(a))) return `N° AMFE ${p.nro} = carpeta/archivo`;
            return null;
        },
    },
    {
        nombre: 'pieza',
        test: (p, a) => {
            const pieza = norm(identidades.get(a)!.pieza);
            if (!p.pieza || !pieza) return null;
            return (p.pieza === pieza || pieza.startsWith(p.pieza) || p.pieza.startsWith(pieza))
                ? `Nro. pieza "${identidades.get(a)!.pieza}" coincide` : null;
        },
    },
    {
        nombre: 'tema exacto',
        test: (p, a) => {
            const tema = norm(identidades.get(a)!.tema);
            return p.tema && tema && p.tema === tema ? `TEMA "${identidades.get(a)!.tema}" identico` : null;
        },
    },
    {
        nombre: 'carpeta',
        test: (p, a) => {
            // Los maestros no tienen numero ni pieza: su carpeta lleva el nombre del proceso.
            const partes = a.replace(/\\/g, '/').split('/');
            const carpeta = norm(partes[partes.length - 2]);
            if (!p.tema || !carpeta) return null;
            return (carpeta === p.tema || carpeta.includes(p.tema) || p.tema.includes(carpeta))
                ? `carpeta "${partes[partes.length - 2]}" coincide con el tema` : null;
        },
    },
    {
        nombre: 'tema contenido',
        test: (p, a) => {
            const tema = norm(identidades.get(a)!.tema);
            if (!p.tema || !tema) return null;
            return (tema.includes(p.tema) || p.tema.includes(tema))
                ? `TEMA "${identidades.get(a)!.tema}" contiene/esta contenido` : null;
        },
    },
];

const conflictos: Array<{ perfil: typeof perfiles[number]; candidatos: string[]; regla: string }> = [];
for (const regla of REGLAS) {
    for (const p of [...pendientes]) {
        const candidatos = [...libres].filter(a => regla.test(p, a) !== null);
        if (candidatos.length === 0) continue;
        if (candidatos.length > 1) { conflictos.push({ perfil: p, candidatos, regla: regla.nombre }); continue; }
        matches.push({ doc: p.doc, archivo: candidatos[0], motivo: regla.test(p, candidatos[0])! });
        libres.delete(candidatos[0]);
        pendientes.delete(p);
    }
}
const sinMatch = [...pendientes].map(p => p.doc);

const porArchivo = new Map<string, Match[]>();
for (const m of matches) porArchivo.set(m.archivo, [...(porArchivo.get(m.archivo) ?? []), m]);
const ambiguos = [...porArchivo.entries()].filter(([, v]) => v.length > 1);

const rel = (p: string) => p.replace(RAIZ, '').replace(/\\/g, '/').replace(/^\//, '');

console.info('=== CORRESPONDENCIA CONFIRMADA ===');
for (const m of matches) {
    if (porArchivo.get(m.archivo)!.length > 1) continue;
    console.info(`  ${(m.doc.amfe_number ?? '?').padEnd(26)} -> ${rel(m.archivo)}\n      ${m.motivo}`);
}
if (ambiguos.length) {
    console.info('\n=== AMBIGUOS (NO SE TOCAN) ===');
    for (const [archivo, ms] of ambiguos) console.info(`  ${rel(archivo)} <- ${ms.map(m => m.doc.amfe_number).join(' Y ')}`);
}
if (conflictos.length) {
    console.info('\n=== CONFLICTOS: un documento matcheo con VARIOS archivos (NO SE TOCAN) ===');
    for (const c of conflictos) {
        console.info(`  ${c.perfil.doc.amfe_number} (regla "${c.regla}") -> ${c.candidatos.map(rel).join('  |  ')}`);
    }
}
if (sinMatch.length) {
    console.info('\n=== DOCUMENTOS SIN ARCHIVO EN EL SERVIDOR (no se escriben) ===');
    for (const d of sinMatch) console.info(`  ${d.amfe_number ?? d.id} | tema="${d.subject}" | pieza="${d.part_number}"`);
}
const huerfanos = archivos.filter(a => !porArchivo.has(a));
if (huerfanos.length) {
    console.info('\n=== ARCHIVOS DEL SERVIDOR SIN DOCUMENTO EN SUPABASE (quedan como estan) ===');
    for (const a of huerfanos) console.info(`  ${rel(a)}`);
}

if (!APPLY) { console.info('\nDRY-RUN. Nada escrito. Volve a correr con --apply para regenerar.'); process.exit(0); }

console.info('\n=== REGENERANDO ===');
let ok = 0, fallos = 0;
for (const m of matches) {
    if (porArchivo.get(m.archivo)!.length > 1) continue;
    const nro = m.doc.amfe_number ?? m.doc.id;
    if (SOLO && norm(SOLO) !== norm(nro)) continue;
    try {
        const doc = JSON.parse(m.doc.data);
        const wb = buildAmfeOficialWorkbook(doc, {
            revisions: m.doc.revisions ?? '[]',
            status: (m.doc.status ?? 'draft') as AmfeLifecycleStatus,
        });
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        writeFileSync(m.archivo, Buffer.from(buf));
        console.info(`  OK   ${String(nro).padEnd(26)} -> ${rel(m.archivo)}`);
        ok++;
    } catch (e) {
        console.error(`  FALLO ${nro}: ${e instanceof Error ? e.message : String(e)}`);
        fallos++;
    }
}
console.info(`\nRegenerados ${ok}  |  fallos ${fallos}  |  ambiguos salteados ${ambiguos.length}  |  sin match ${sinMatch.length}`);
