/**
 * _alinearNovaxSiglas.mjs — las siglas de caracteristica especial de los AMFE de NOVAX
 * (158 Insert, 161 Armrest, 162 Top Roll) salen del CRITERIO, causa por causa.
 *
 * EL CRITERIO (I-AC-005 rev.B punto 5 · manual AIAG-VDA pag. 129 · regla always-on
 * `.claude/rules/caracteristicas-especiales.md`, fuente unica core/amfe/caracteristicasEspeciales.data.json):
 *   - CRITICA      = S 9 o 10, O indistinto  -> para VW se escribe D/TLD
 *   - SIGNIFICATIVA = S 5 a 8 Y O >= 4        -> SC (VW no tiene sigla propia; la W no existe)
 *   - lo demas     = sin sigla
 * La sigla de una causa se justifica SOLO con la S y la O de ESA causa. Nunca porque otro
 * documento (backup, Rev.A de un flujograma, plan de control viejo) la tenia. Fak, 11/09/2026:
 * *"estas tirando como al azar... es un error gravisimo que debemos corregir para siempre"*.
 *
 * QUE HACE (plan aprobado por Fak el 11/09/2026, hallazgos B-1 a B-4, B-7, B-8, B-9):
 *   (a) en los 3 AMFE, cada causa queda con la sigla que le da el criterio (OS/HI se respetan);
 *   (b) AMFE 158 OP 22: repone el modo de falla "Omision de la operacion de inspeccion" con su
 *       causa "Operador de produccion omite la tarea de verificacion visual" (S8 O6 D9) y sus
 *       controles, tal como estaban en backups/2026-09-08T17-06-35 — es el modo de falla
 *       estandar de una operacion de control (el AMFE lo conserva en 70-71 y 110) y se habia
 *       borrado el 09/09. Va en el WE Man "Operador de Produccion" porque la causa es una
 *       omision del operador (amfe.md §9). Su sigla NO se copia del backup (traia "W"): sale del
 *       criterio, S8 O6 -> SC. El placeholder de AP=H va en `optimizationAction`.
 *   (c) caratula: `partNumber` / `applicableParts` con los codigos Novax del flujograma
 *       (158: 16 codigos, N 227 y N 389 a N 403; 161: 4; 162: 4) — se leen de
 *       tools/flowchart/data/*.json, no se tipean;
 *   (d) fila de revision Rev.A 11/09/2026 en cada uno (texto de planta, sin cocina interna) y
 *       header.revDate acorde (amfe.md §17.6);
 *   (e) metadata.cause_count / operation_count sincronizados (saveAmfe ya sincroniza la fila);
 *   (f) imprime tmp/export-novax/siglas_casillero17.md — la lista causa por causa (S, O, regla,
 *       sigla) que es el listado del casillero 17 del PPAP y la evidencia de cada marca del
 *       flujograma — y la tabla por operacion.
 *
 * NO asigna nada por cuenta propia: Fak aprobo estas siglas en el plan del 11/09/2026 (por eso
 * el --apply lleva --allow-specialchar, el candado de dryRunGuard). Cualquier otra sigla que
 * el criterio no de, no se escribe.
 *
 * Uso:
 *   node scripts/_alinearNovaxSiglas.mjs                          dry-run (lista y listado .md)
 *   node scripts/_alinearNovaxSiglas.mjs --apply --allow-specialchar
 *   node scripts/_alinearNovaxSiglas.mjs --marcar-flujogramas     escribe tools/flowchart/data/15{3,4,5}*.json:
 *       marcas por paso = union de las siglas de sus causas en el AMFE live, cajetin Rev.C 11/09/2026,
 *       leyenda sin citas y fila C (paso 6 del plan)
 *   node scripts/_alinearNovaxSiglas.mjs --verificar              flujograma JSON vs Supabase live
 *       (la marca de cada paso del flujograma = union de las siglas de sus causas en el AMFE)
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe, saveAmfe, syncFieldAliases, calculateAP, countAmfeStats } from './_lib/amfeIo.mjs';
import { nivelPorCriterio, nivelDeSigla, esSinMarca, normalizarSigla, CARACTERISTICAS_ESPECIALES as CE } from './_lib/amfeValidator.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOW_DIR = path.join(RAIZ, 'tools', 'flowchart', 'data');
const OUT_DIR = path.join(RAIZ, 'tmp', 'export-novax');
const FECHA = '11/09/2026';
const BACKUP_OP22 = path.join(RAIZ, 'backups', '2026-09-08T17-06-35', 'amfe_documents.json');

const DOCS = {
    'AMFE-INS-PAT': {
        id: '7cfe2db7-9e5a-4b46-804d-76194557c581', numero: '158', producto: 'INSERT', flujograma: '154-INSERT',
        revisionItem: '10, 20, 21, 22, 50, 60, 70-71, 90, 91, 93, 100, 101, 102, 110',
        revisionDetalle: 'SE REVISAN LAS CARACTERISTICAS ESPECIALES DE TODAS LAS OPERACIONES: D/TLD EN LA INFLAMABILIDAD DE LOS MATERIALES (OP. 10) Y SC EN LAS CAUSAS QUE CORRESPONDEN. SE REPONE EL MODO DE FALLA DE OMISION DEL CONTROL CON MYLAR (OP. 22). SE COMPLETAN LOS CODIGOS DE PRODUCTO EN LA CARATULA.',
    },
    'AMFE-ARM-PAT': {
        id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', numero: '161', producto: 'ARMREST DOOR PANEL', flujograma: '153-ARMREST-DOOR-PANEL',
        revisionItem: '10, 20, 21, 30, 40, 41, 50, 70, 71, 80, 81, 82, 100',
        revisionDetalle: 'SE REVISAN LAS CARACTERISTICAS ESPECIALES DE TODAS LAS OPERACIONES: D/TLD EN LA INFLAMABILIDAD DE LOS MATERIALES (OP. 10) Y SC EN LAS CAUSAS QUE CORRESPONDEN. SE COMPLETAN LOS CODIGOS DE PRODUCTO EN LA CARATULA.',
    },
    'AMFE-TR-PAT': {
        id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3', numero: '162', producto: 'TOP ROLL', flujograma: '155-TOP-ROLL',
        revisionItem: '5, 10, 50, 80',
        revisionDetalle: 'SE REVISAN LAS CARACTERISTICAS ESPECIALES DE TODAS LAS OPERACIONES: SE QUITA LA SC DE LA ETIQUETA EN EL CONTROL FINAL (OP. 80) Y SE MARCAN CON SC LAS CAUSAS QUE CORRESPONDEN. SE COMPLETAN LOS CODIGOS DE PRODUCTO EN LA CARATULA.',
    },
};

const VW = CE.simbologia.VW;                       // { CRITICA: 'D/TLD', SIGNIFICATIVA: 'SC', ... }
const ORDEN_SIGLA = [VW.CRITICA, VW.SIGNIFICATIVA];
const numOp = (op) => String(op.opNumber ?? op.operationNumber ?? '').trim();
const nombreOp = (op) => String(op.name ?? op.operationName ?? '').trim();
const textoCausa = (c) => String(c.description ?? c.cause ?? '').trim();
const sevEfectiva = (f, c) => (Number(f.severity) || null) ?? (Number(c.severity) || null);

/** Sigla que el criterio da para S y O, en simbologia VW; '' si ninguna. */
function siglaPorCriterio(S, O) {
    const nivel = nivelPorCriterio(S, O);
    return nivel ? VW[nivel] : '';
}
/** Regla legible para el listado. */
function reglaTexto(S, O) {
    const nivel = nivelPorCriterio(S, O);
    if (nivel === 'CRITICA') return `S ${S} >= 9 -> critica`;
    if (nivel === 'SIGNIFICATIVA') return `S ${S} en 5-8 y O ${O} >= 4 -> significativa`;
    if (S >= 5 && S <= 8) return `S ${S} en 5-8 pero O ${O} < 4 -> ninguna`;
    return `S ${S} < 5 -> ninguna`;
}

/** Codigos Novax del flujograma, ordenados por numero. */
function codigosDelFlujograma(clave) {
    const j = JSON.parse(fs.readFileSync(path.join(FLOW_DIR, `${clave}.json`), 'utf8'));
    const nums = j.products.map((p) => Number(String(p.code).replace(/\D/g, ''))).filter(Number.isFinite);
    return [...new Set(nums)].sort((a, b) => a - b);
}
/** "N 227 / N 389 a N 403": los consecutivos se compactan en un rango. */
function compactar(nums) {
    const partes = [];
    for (let i = 0; i < nums.length;) {
        let j = i;
        while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
        partes.push(j - i >= 2 ? `N ${nums[i]} a N ${nums[j]}` : nums.slice(i, j + 1).map((n) => `N ${n}`).join(' / '));
        i = j + 1;
    }
    return partes.join(' / ');
}

/** Todos los nodos con stepId del flow, esten donde esten (branches, branchSide.sequence...). Devuelve los objetos reales. */
function nodosDelFlow(flow) {
    const nodos = [];
    const visitar = (x) => {
        if (Array.isArray(x)) { x.forEach(visitar); return; }
        if (!x || typeof x !== 'object') return;
        if (x.stepId) nodos.push(x);
        for (const v of Object.values(x)) if (v && typeof v === 'object') visitar(v);
    };
    visitar(flow);
    return nodos;
}
const leerFlujograma = (clave) => JSON.parse(fs.readFileSync(path.join(FLOW_DIR, `${clave}.json`), 'utf8'));
/** [{stepId, criticalType, type}] del flujograma. */
function pasosDelFlujograma(clave) {
    return nodosDelFlow(leerFlujograma(clave).flow).map((x) => ({ stepId: String(x.stepId), criticalType: String(x.criticalType ?? '').trim(), type: x.type }));
}

/**
 * Cuando una fila del AMFE cubre un RANGO de pasos del flujograma, la marca va a todos los pasos
 * del rango — salvo que el modo de falla con sigla nombre un paso concreto. Unico caso hoy:
 * AMFE 158 "70-71 INYECCION DE PIEZAS PLASTICAS Y CONTROL DE PIEZA INYECTADA": sus dos causas SC
 * son "Omision de la operacion de inspeccion dimensional de cotas index" = el paso 71 CONTROL DE
 * PIEZA INYECTADA, no la inyeccion (70). En el 161, "80-82" (tapizado) tiene la SC en "Pieza mal
 * cerrada": no nombra un paso, asi que va a 80, 81 y 82.
 */
const PASOS_DE_RANGO = { 'AMFE-INS-PAT': { '70-71': ['71'] } };
const marcasDe = (texto) => new Set(String(texto ?? '').split(',').map((s) => normalizarSigla(s)).filter(Boolean));
const formatoMarca = (set) => ORDEN_SIGLA.filter((s) => set.has(s)).join(' , ');

/** Pasos del flujograma que cubre una operacion del AMFE: "70-71" -> ['70','71']; "10" -> ['10']. */
function pasosDeOp(n) {
    const m = n.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return [n];
    const [a, b] = [Number(m[1]), Number(m[2])];
    return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/** Union de siglas por operacion, calculada con el criterio sobre el doc dado. */
function unionPorOp(doc) {
    const out = new Map();
    for (const op of doc.operations) {
        const set = new Set();
        for (const we of op.workElements ?? []) for (const fn of we.functions ?? []) for (const f of fn.failures ?? []) for (const c of f.causes ?? []) {
            const s = normalizarSigla(c.specialChar);
            if (s && !esSinMarca(s)) set.add(s);
        }
        out.set(numOp(op), set);
    }
    return out;
}

// ── (b) la causa de la OP 22 del 158, del backup del 08/09 ───────────────────────────────────
function causaOp22DelBackup() {
    const rows = JSON.parse(fs.readFileSync(BACKUP_OP22, 'utf8'));
    const lista = Array.isArray(rows) ? rows : Object.values(rows);
    const r = lista.find((x) => x.amfe_number === 'AMFE-INS-PAT');
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    const op = d.operations.find((o) => numOp(o) === '22');
    for (const we of op.workElements) for (const fn of we.functions) for (const f of fn.failures) for (const c of f.causes) {
        if (/omite la tarea de verificaci/i.test(textoCausa(c))) return { failure: f, cause: c };
    }
    throw new Error('backup 2026-09-08T17-06-35: no encuentro la causa "omite la tarea de verificacion" en la OP 22 del AMFE-INS-PAT');
}
function reponerOp22(doc, cambios) {
    const op = doc.operations.find((o) => numOp(o) === '22');
    if (!op) throw new Error('AMFE-INS-PAT: no hay OP 22');
    const yaEsta = (op.workElements ?? []).some((we) => (we.functions ?? []).some((fn) => (fn.failures ?? []).some((f) => /omisi[oó]n de la operaci[oó]n de inspecci/i.test(f.description ?? ''))));
    if (yaEsta) { cambios.push('OP 22: el modo de falla "Omision de la operacion de inspeccion" ya esta (no se duplica)'); return; }
    const we = (op.workElements ?? []).find((w) => w.type === 'Man' && /operador de producci/i.test(w.name ?? ''));
    if (!we || !we.functions?.length) throw new Error('AMFE-INS-PAT OP 22: no encuentro el WE Man "Operador de Produccion" con una funcion');
    const { failure: fb, cause: cb } = causaOp22DelBackup();
    const S = Number(fb.severity), O = Number(cb.occurrence), D = Number(cb.detection);
    const ap = calculateAP(S, O, D);
    const causa = {
        id: randomUUID(),
        description: textoCausa(cb), cause: textoCausa(cb),
        severity: S, occurrence: O, detection: D,
        ap, actionPriority: ap,
        preventionControl: cb.preventionControl, detectionControl: cb.detectionControl,
        specialChar: siglaPorCriterio(S, O),           // S8 O6 -> SC. El backup traia "W": no se copia.
        characteristicNumber: '', preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        optimizationAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
    };
    const falla = {
        id: randomUUID(),
        description: fb.description,
        effectLocal: fb.effectLocal, effectNextLevel: fb.effectNextLevel, effectEndUser: fb.effectEndUser,
        severity: S, occurrence: O, detection: D, ap,
        causes: [causa],
    };
    we.functions[0].failures.push(falla);
    cambios.push(`OP 22: repuesto "${fb.description}" / "${textoCausa(cb)}" S${S} O${O} D${D} AP ${ap} -> ${causa.specialChar || 'sin sigla'} (WE ${we.name}; controles del backup 08/09)`);
}

// ── (a) siglas por criterio ─────────────────────────────────────────────────────────────────
function aplicarCriterio(doc, filas, cambios) {
    let dtld = 0, sc = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements ?? []) for (const fn of we.functions ?? []) for (const f of fn.failures ?? []) for (const c of f.causes ?? []) {
            const S = sevEfectiva(f, c), O = Number(c.occurrence) || null;
            const antes = String(c.specialChar ?? '').trim();
            const nivelAntes = nivelDeSigla(antes);
            let despues = antes;
            if (nivelAntes === 'SEGURIDAD_OPERADOR' || nivelAntes === 'ALTO_IMPACTO') {
                cambios.push(`OP ${numOp(op)}: se respeta ${antes} en "${textoCausa(c)}" (no sale del criterio S/O)`);
            } else if (S == null || O == null) {
                cambios.push(`OP ${numOp(op)}: "${textoCausa(c)}" sin S u O (S=${S} O=${O}); no se toca la sigla "${antes}"`);
            } else {
                despues = siglaPorCriterio(S, O);
                if (despues !== antes) {
                    c.specialChar = despues;
                    cambios.push(`OP ${numOp(op)}: "${textoCausa(c)}" S${S} O${O} · ${JSON.stringify(antes)} -> ${JSON.stringify(despues)} (${reglaTexto(S, O)})`);
                }
            }
            if (despues === VW.CRITICA) dtld++;
            if (despues === VW.SIGNIFICATIVA) sc++;
            filas.push({ op: numOp(op), opNombre: nombreOp(op), we: `${we.type} · ${we.name}`, falla: f.description, S, causa: textoCausa(c), O, regla: S != null && O != null ? reglaTexto(S, O) : 'sin S u O', sigla: despues });
        }
    }
    return { dtld, sc };
}

// ── (c) (d) (e) caratula, revision, contadores ──────────────────────────────────────────────
function caratulaYRevision(doc, cfg, cambios) {
    const codigos = codigosDelFlujograma(cfg.flujograma);
    const partNumber = compactar(codigos);
    const applicableParts = codigos.map((n) => `N ${n}`).join(', ');
    doc.header ??= {};
    if (doc.header.partNumber !== partNumber) { cambios.push(`caratula partNumber: "${doc.header.partNumber}" -> "${partNumber}"`); doc.header.partNumber = partNumber; }
    if (doc.header.applicableParts !== applicableParts) { cambios.push(`caratula applicableParts: "${doc.header.applicableParts}" -> "${applicableParts}"`); doc.header.applicableParts = applicableParts; }

    doc.revisions ??= [];
    if (!doc.revisions.some((r) => r.date === FECHA && String(r.details ?? '').includes('CARACTERISTICAS ESPECIALES DE TODAS'))) {
        doc.revisions.push({ rev: 'A', date: FECHA, item: cfg.revisionItem, details: cfg.revisionDetalle, pswDate: '', modifiedBy: 'FS' });
        cambios.push(`revision: fila Rev.A ${FECHA} (item ${cfg.revisionItem})`);
    }
    if (doc.header.revDate !== FECHA) { cambios.push(`caratula revDate: "${doc.header.revDate}" -> "${FECHA}"`); doc.header.revDate = FECHA; }

    if (doc.metadata && typeof doc.metadata === 'object') {
        const st = countAmfeStats(doc);
        if (doc.metadata.cause_count !== st.causeCount || doc.metadata.operation_count !== st.opCount) {
            cambios.push(`metadata: cause_count ${doc.metadata.cause_count} -> ${st.causeCount}, operation_count ${doc.metadata.operation_count} -> ${st.opCount}`);
            doc.metadata.cause_count = st.causeCount;
            doc.metadata.operation_count = st.opCount;
        }
    }
}

// ── (f) listado del casillero 17 ────────────────────────────────────────────────────────────
function escribirListado(porDoc) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const L = [];
    L.push('# Caracteristicas especiales de las tapizadas de puerta NOVAX — listado del casillero 17');
    L.push('');
    L.push(`Generado el ${FECHA} por scripts/_alinearNovaxSiglas.mjs desde Supabase live. Criterio del I-AC-005 rev.B punto 5:`);
    L.push('CRITICA = S 9 o 10 (para VW se escribe D/TLD) · SIGNIFICATIVA = S 5 a 8 y O >= 4 (SC). La sigla de cada causa sale de su S y su O.');
    L.push('La marca de cada operacion del flujograma es la union de las siglas de sus causas en el AMFE.');
    L.push('');
    for (const { clave, cfg, filas, union } of porDoc) {
        L.push(`## AMFE ${cfg.numero} — ${cfg.producto} (${clave}) · flujograma ${cfg.flujograma.split('-')[0]}`);
        L.push('');
        L.push('### Marca por operacion');
        L.push('');
        L.push('| OP | Operacion | Marca en el flujograma | Causas D/TLD | Causas SC |');
        L.push('|---|---|---|---|---|');
        for (const [n, set] of union) {
            const fl = filas.filter((r) => r.op === n);
            L.push(`| ${n} | ${fl[0]?.opNombre ?? ''} | ${formatoMarca(set) || '—'} | ${fl.filter((r) => r.sigla === VW.CRITICA).length} | ${fl.filter((r) => r.sigla === VW.SIGNIFICATIVA).length} |`);
        }
        L.push('');
        L.push('### Causa por causa (solo las que llevan sigla)');
        L.push('');
        L.push('| OP | Elemento | Modo de falla | S | Causa | O | Regla | Sigla |');
        L.push('|---|---|---|---|---|---|---|---|');
        for (const r of filas.filter((x) => x.sigla)) {
            L.push(`| ${r.op} | ${r.we} | ${r.falla} | ${r.S} | ${r.causa} | ${r.O} | ${r.regla} | **${r.sigla}** |`);
        }
        L.push('');
        const sinSigla58 = filas.filter((x) => !x.sigla && x.S >= 5 && x.S <= 8);
        L.push(`Causas con S 5-8 que NO llevan SC porque su O es 3 o menos: ${sinSigla58.length} (de ${filas.length} causas). Si la ocurrencia se recalifica con datos de planta, esta lista cambia sola.`);
        L.push('');
    }
    const out = path.join(OUT_DIR, 'siglas_casillero17.md');
    fs.writeFileSync(out, L.join('\n'), 'utf8');
    return out;
}

// ── --verificar: flujograma JSON vs live ────────────────────────────────────────────────────
async function verificar(sb) {
    let divergencias = 0;
    for (const [clave, cfg] of Object.entries(DOCS)) {
        const { doc } = await readAmfe(sb, cfg.id);
        const union = unionPorOp(doc);
        const pasos = pasosDelFlujograma(cfg.flujograma);
        const porPaso = new Map(pasos.map((p) => [p.stepId, marcasDe(p.criticalType)]));
        console.log(`\n=== ${clave} (AMFE ${cfg.numero}) vs flujograma ${cfg.flujograma} ===`);
        const cubiertos = new Set();
        for (const [n, esperado] of union) {
            const ids = PASOS_DE_RANGO[clave]?.[n] ?? pasosDeOp(n);
            const enFlujo = ids.filter((i) => porPaso.has(i));
            if (!enFlujo.length) { console.log(`  ⚠ OP ${n} del AMFE no tiene paso en el flujograma (esperado ${formatoMarca(esperado) || '—'})`); continue; }
            const real = new Set(enFlujo.flatMap((i) => [...porPaso.get(i)]));
            enFlujo.forEach((i) => cubiertos.add(i));
            const ok = [...esperado].every((s) => real.has(s)) && [...real].every((s) => esperado.has(s));
            if (!ok) { divergencias++; console.log(`  ✗ OP ${n}: AMFE dice ${formatoMarca(esperado) || '—'} · flujograma (${enFlujo.join('/')}) dice ${formatoMarca(real) || '—'}`); }
            else console.log(`  ✓ OP ${n}: ${formatoMarca(esperado) || '—'}`);
        }
        for (const p of pasos) {
            if (cubiertos.has(p.stepId)) continue;
            if (porPaso.get(p.stepId).size) { divergencias++; console.log(`  ✗ paso ${p.stepId} del flujograma marca ${p.criticalType} y no hay operacion del AMFE que lo respalde`); }
        }
    }
    console.log(`\n${divergencias === 0 ? '✓ 0 divergencias: cada marca del flujograma tiene su causa en el AMFE' : `✗ ${divergencias} divergencia(s)`}`);
    process.exit(divergencias ? 1 : 0);
}

// ── --marcar-flujogramas: las marcas del flujograma salen del AMFE live (paso 6 del plan) ─────
const REV_C = {
    'AMFE-INS-PAT': { item: '10 / 20-22 / 50 / 60 / 71 / 90-93 / 100-102 / 110' },
    'AMFE-ARM-PAT': { item: '10 / 20-22 / 30 / 40-41 / 50 / 70-71 / 80-82 / 90 / 100' },
    'AMFE-TR-PAT': { item: '5 / 10 / 50 / 80' },
};
const TEXTO_NIVEL_FLUJO = { [VW.CRITICA]: 'CARACTERÍSTICA CRÍTICA', [VW.SIGNIFICATIVA]: 'CARACTERÍSTICA SIGNIFICATIVA' };
async function marcarFlujogramas(sb) {
    for (const [clave, cfg] of Object.entries(DOCS)) {
        const { doc } = await readAmfe(sb, cfg.id);
        const union = unionPorOp(doc);
        // marca esperada por paso del flujograma
        const esperado = new Map();
        for (const [n, set] of union) {
            const ids = PASOS_DE_RANGO[clave]?.[n] ?? pasosDeOp(n);
            for (const i of ids) esperado.set(i, new Set([...(esperado.get(i) ?? []), ...set]));
        }
        const j = leerFlujograma(cfg.flujograma);
        const cambios = [];
        const usadas = new Set();
        for (const nodo of nodosDelFlow(j.flow)) {
            const set = esperado.get(String(nodo.stepId)) ?? new Set();
            const nueva = formatoMarca(set);
            const vieja = nodo.critical ? String(nodo.criticalType ?? '') : '';
            if (nueva) { nodo.critical = true; nodo.criticalType = nueva; nodo.criticalColor = 'black'; set.forEach((s) => usadas.add(s)); }
            else { delete nodo.critical; delete nodo.criticalType; delete nodo.criticalColor; }
            if (nueva !== vieja) cambios.push(`paso ${nodo.stepId} ${nodo.description}: "${vieja || '—'}" -> "${nueva || '—'}"`);
        }
        // cajetin, leyenda (sin citar instructivos ni manuales: Fak 08/09/2026) y fila de revision
        j.header.revision = 'C';
        j.header.revisionDate = FECHA;
        j.header.specialChars = ORDEN_SIGLA.filter((s) => usadas.has(s)).map((s) => ({ mark: s, meaning: TEXTO_NIVEL_FLUJO[s] }));
        const ops = [...union].filter(([, s]) => s.size);
        const conD = ops.filter(([, s]) => s.has(VW.CRITICA)).map(([n]) => n);
        const soloSC = ops.filter(([, s]) => !s.has(VW.CRITICA)).map(([n]) => (PASOS_DE_RANGO[clave]?.[n] ?? [n]).join('-'));
        const details = `SE ALINEAN LAS CARACTERISTICAS ESPECIALES CON EL AMFE ${cfg.numero}: D/TLD Y SC EN LA RECEPCION (${conD.join(', ')}) Y SC EN ${soloSC.slice(0, -1).join(', ')} Y ${soloSC.at(-1)}.`;
        j.revisions ??= [];
        if (!j.revisions.some((r) => r.rev === 'C')) j.revisions.push({ rev: 'C', date: FECHA, item: REV_C[clave].item, details, pswDate: '', modifiedBy: 'FS' });
        else Object.assign(j.revisions.find((r) => r.rev === 'C'), { date: FECHA, item: REV_C[clave].item, details });
        for (const k of ['_fuente_de_las_siglas', '_nota_caracteristicas_especiales']) if (k in j) { delete j[k]; cambios.push(`se saca la clave interna ${k}`); }
        const destino = path.join(FLOW_DIR, `${cfg.flujograma}.json`);
        fs.writeFileSync(destino, JSON.stringify(j, null, 2) + '\n', 'utf8');
        console.log(`\n=== ${cfg.flujograma}.json -> Rev.C ${FECHA} (${cambios.length} cambios de marca) ===`);
        for (const c of cambios) console.log('  ' + c);
        console.log('  leyenda: ' + j.header.specialChars.map((s) => `${s.mark} = ${s.meaning}`).join(' · '));
        console.log('  fila C: ' + details);
    }
    process.exit(0);
}

// ── main ────────────────────────────────────────────────────────────────────────────────────
const sb = await connectSupabase();
if (process.argv.includes('--verificar')) await verificar(sb);
if (process.argv.includes('--marcar-flujogramas')) await marcarFlujogramas(sb);

const { apply } = parseSafeArgs();
const plan = [];
const commits = [];
const porDoc = [];
for (const [clave, cfg] of Object.entries(DOCS)) {
    const { doc, row } = await readAmfe(sb, cfg.id);
    if (row.amfe_number !== clave) throw new Error(`${cfg.id}: esperaba ${clave}, la fila dice ${row.amfe_number}`);
    const before = JSON.parse(JSON.stringify(doc));
    const cambios = [];
    if (clave === 'AMFE-INS-PAT') reponerOp22(doc, cambios);
    const filas = [];
    const { dtld, sc } = aplicarCriterio(doc, filas, cambios);
    caratulaYRevision(doc, cfg, cambios);
    syncFieldAliases(doc);
    const union = unionPorOp(doc);

    console.log(`\n===== ${clave} (AMFE ${cfg.numero} ${cfg.producto}) — ${filas.length} causas: ${dtld} D/TLD · ${sc} SC =====`);
    for (const c of cambios) logChange(apply, `${clave} · ${c}`);
    console.log('  marca por operacion: ' + [...union].map(([n, s]) => `${n}=${formatoMarca(s) || '—'}`).join(' · '));

    porDoc.push({ clave, cfg, filas, union });
    plan.push({ id: cfg.id, amfeNumber: clave, productName: cfg.producto, before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, cfg.id, doc, { expectedAmfeNumber: clave });
        const { doc: live, row: r2 } = await readAmfe(sb, cfg.id);
        const st = countAmfeStats(live);
        if (r2.cause_count !== st.causeCount) throw new Error(`POST-CHECK ${clave}: cause_count fila ${r2.cause_count} != doc ${st.causeCount}`);
        const u = unionPorOp(live);
        console.log(`POST-CHECK live ${clave}: ${st.causeCount} causas · ` + [...u].filter(([, s]) => s.size).map(([n, s]) => `${n}=${formatoMarca(s)}`).join(' · '));
    });
}

const listado = escribirListado(porDoc);
console.log(`\nListado del casillero 17: ${path.relative(RAIZ, listado)}`);

await runWithValidation(plan, apply, async () => { for (const c of commits) await c(); });
finish(apply);
