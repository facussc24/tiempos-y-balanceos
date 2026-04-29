/**
 * Parser Familia A — BOMs con columnas Nivel 1/2/3 + Process + Material
 *
 * Cubre:
 * - NOVAX Tapizadas Puerta Rev.11 (1 archivo, 6 BOMs por sheet con variantes FR/RR)
 * - VW Patagonia Armrest Rear V5 (1 archivo, 1 BOM)
 * - VW Patagonia Headrest V3 (1 archivo, 3 productos × 4 variantes = 12 BOMs)
 * - VW Patagonia IP PAD V3 (1 archivo, 2 BOMs LOW + HIGH)
 * - COZZUOL Upper Trim Panel (1 archivo, 1 BOM con 2 colores)
 *
 * Output: dry-run JSON imprimible (no escribe a Supabase desde acá).
 *
 * Uso:
 *   node scripts/_parseBomFamilyA.mjs                 # parsea todos
 *   node scripts/_parseBomFamilyA.mjs --novax-only    # solo NOVAX (smoke test)
 *   node scripts/_parseBomFamilyA.mjs --out file.json # escribe JSON al archivo
 */

import XLSX from 'xlsx-js-style';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const NOVAX_RUTA = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/NOVAX/Tapizadas puerta/14-Especificaciones de Materiales/01- BOM/00- BOM MATERIAL/BOM DOOR PANEL - ONLY MATERIAL. Rev.11.xlsx';

const VW_ARMREST = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/Armrest Rear/1-APQP/7-Lista de materiales preliminares/01_BOM MATERIAL/PATAGONIA_ARMREST REAR_BOM Barack_V5_20260331.xlsx';
const VW_HEADREST = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/Headrest/APQP/7-Lista de materiales preliminares/01_BOM MATERIAL/PATAGONIA_HEADREST SET_BOM Barack_V3_20260311.xlsx';
const VW_IPPAD = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/IP PADs/APQP/7-Lista de materiales/1_BOM/PATAGONIA_IP PAD_BOM Barack_V3_20260409.xlsx';

const COZZUOL = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/COZZUOL/00- Upper Trimming/UPPER TRIM PANEL COZZUOL/02- BOM/BOM UPPER TRIM PANEL.xlsx';

// -------------------------------------------------------------------------
// Mapeo Process/Material → categoria visual BOM
// -------------------------------------------------------------------------

function mapToCategory({ process: p, material: m, descripcion: d, rawMaterial: r }) {
    const M = String(m || '').toUpperCase();
    const D = String(d || '').toUpperCase();
    const P = String(p || '').toUpperCase();
    const R = String(r || '').toUpperCase();

    // FILM (verifica antes de PLASTICO porque "Film PES" tiene "PES" pero es FILM)
    if (D.includes('FILM') || M.includes('FILM')) return 'FILM';

    // ETIQUETA
    if (D.includes('ETIQUETA') || D.includes('LABEL') || D.includes('ROTULO')) return 'ETIQUETA';

    // CARTON / EMBALAJE
    if (D.includes('CARTON') || D.includes('CAJA') || D.includes('BOLSA') || M.includes('CORRUGADO')) return 'CARTON';

    // PRIMER
    if (D.includes('PRIMER') || M.includes('PRIMER')) return 'PRIMER';

    // ADHESIVO / RETICULANTE — adhesivos, hilos de costura, cintas, sikamelt, fenoclor, tesa
    if (
        D.includes('TESA') || D.includes('SIKAMELT') || D.includes('SIKA-') ||
        D.includes('FENOCLOR') || D.includes('ADFA') || D.includes('REGV') ||
        D.includes('ADHESIV') || D.includes('HOTMELT') || D.includes('GLUE') ||
        D.includes('CINTA BIFAZ') || D.includes('ACRILIC') ||
        D.includes('HILO') || M.includes('POLYESTER') && (D.includes('HILO') || D.includes('SEAM') || D.includes('THREAD')) ||
        D.includes('THREAD') || D.includes('SEAM')
    ) return 'ADHESIVO_RETICULANTE';

    // FUNDA — vinilo, cuero sintetico, fabric, tela, IMG bilaminate (ese es de FUNDA en Barack)
    if (
        D.includes('VINILO') || D.includes('VINYL') ||
        M.includes('PVC') && (D.includes('NARBE') || D.includes('TITAN') || D.includes('GRAY') || D.includes('BLACK')) ||
        D.includes('CUERO') || D.includes('LEATHER') ||
        D.includes('FABRIC') || D.includes('TELA') ||
        D.includes('JACQUARD') || D.includes('AUNDE') ||
        D.includes('TPO BILAMIN') || M.includes('NONWOVEN') && D.includes('FUNDA')
    ) return 'FUNDA';

    // SUSTRATO — espuma, EPP, foam, PU, sustrato plastico, fieltro, refuerzos no-tejido
    if (
        M.includes('FOAM') || M.includes('EPP') || M.includes('PU FOAM') ||
        D.includes('FOAM') || D.includes('ESPUMA') || D.includes('EPP') ||
        D.includes('PUR') || D.includes('POLIOL') || D.includes('ISOCYAN') ||
        D.includes('FIELTRO') || D.includes('REFUERZO') ||
        D.includes('SUSTRATO') ||
        M.includes('NONWOVEN') || D.includes('NON-WOVEN') || D.includes('NONWOVEN') ||
        D.includes('MONOFELT') ||
        D.includes('SKELETON') || D.includes('CARRIER') || D.includes('FRAME') ||
        D.includes('CORE')
    ) return 'SUSTRATO';

    // PLASTICO — PC/ABS, ABS, PP, PE, plasticos inyectados
    if (
        M.includes('PC/ABS') || M.includes('PC+ABS') || M.includes('CYCOLOY') ||
        M.includes('ABS') || M.includes('PP') || M.includes('POLYPROP') ||
        M.includes('CYCOLAC') ||
        P.includes('INJECTION') || P.includes('INYECCION')
    ) return 'PLASTICO';

    return 'OTROS';
}

// -------------------------------------------------------------------------
// Helper: detectar fila de header (busca "Nivel 1" en columna A o B)
// -------------------------------------------------------------------------

function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const row = rows[i].map(c => String(c || '').trim().toLowerCase());
        if (row.some(c => c === 'nivel 1' || c === 'nivel1') &&
            row.some(c => c.includes('codigo proveedor') || c.includes('código proveedor')) &&
            row.some(c => c.includes('descripcion') || c.includes('descripción'))) {
            return i;
        }
    }
    return -1;
}

// -------------------------------------------------------------------------
// Helper: indices de columnas relevantes a partir del header
// -------------------------------------------------------------------------

function buildColIndex(headerRow) {
    const norm = headerRow.map(c => String(c || '').toLowerCase().trim());
    const find = (needles) => norm.findIndex(c => needles.some(n => c === n || c.includes(n)));
    return {
        nivel1: find(['nivel 1']),
        nivel2: find(['nivel 2']),
        nivel3: find(['nivel 3']),
        codigoProveedor: find(['codigo proveedor', 'código proveedor']),
        descripcion: find(['descripcion', 'descripción']),
        process: find(['process', 'proceso']),
        material: find(['material']),
        color: find(['color']),
        rawMaterial: find(['raw material', 'proveedor']),
        qty: find(['qty / part', 'qty/part', 'qty', 'cantidad', 'consumo']),
        unit: find(['unit', 'unidad', 'u.m.']),
    };
}

// -------------------------------------------------------------------------
// Helper: extraer metadata del header de la sheet (filas 0-3 antes del header)
// -------------------------------------------------------------------------

function extractMetadata(rows, headerRowIdx) {
    const meta = { project: '', partName: '', partNumber: '', revision: '', fechaEmision: '', autor: '' };
    for (let i = 0; i < headerRowIdx; i++) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim();
            const lower = cell.toLowerCase();
            const next = String(row[j + 1] || '').trim();
            if (lower.startsWith('project') && next) meta.project = next;
            else if (lower.startsWith('part name') && next) meta.partName = next;
            else if (lower.startsWith('part number') && next) meta.partNumber = next;
            else if (lower.startsWith('fecha de emisi') || lower.startsWith('fecha emisi')) {
                // El valor puede estar en la misma celda separado por : o en la siguiente
                const colonIdx = cell.indexOf(':');
                if (colonIdx !== -1 && cell.length > colonIdx + 1) {
                    meta.fechaEmision = cell.slice(colonIdx + 1).trim();
                } else if (next) meta.fechaEmision = next;
            }
            else if (lower.startsWith('revision') || lower.startsWith('revisi')) {
                if (next) meta.revision = next;
            }
            else if (lower.startsWith('realiz') || lower.startsWith('autor')) {
                const colonIdx = cell.indexOf(':');
                if (colonIdx !== -1) meta.autor = cell.slice(colonIdx + 1).trim();
                else if (next) meta.autor = next;
            }
        }
    }
    return meta;
}

// -------------------------------------------------------------------------
// Parser de UNA sheet → BomGroup[] + metadata
// -------------------------------------------------------------------------

function parseSheet(ws, sheetName) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    if (range.e.r > 800 || range.e.c > 60) {
        const safeRef = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: Math.min(range.e.r, 100), c: Math.min(range.e.c, 30) },
        });
        ws['!ref'] = safeRef;
    }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const headerIdx = findHeaderRow(rows);
    if (headerIdx === -1) return null;

    const meta = extractMetadata(rows, headerIdx);
    const cols = buildColIndex(rows[headerIdx]);

    const items = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const desc = String(r[cols.descripcion] || '').trim();
        const codigoProv = String(r[cols.codigoProveedor] || '').trim();
        const nivel1 = String(r[cols.nivel1] || '').trim();
        const nivel2 = String(r[cols.nivel2] || '').trim();
        const nivel3 = String(r[cols.nivel3] || '').trim();
        // Skip todas las filas sin descripcion — son agrupadoras, totales o vacias
        if (!desc) continue;
        // Skip filas que repitan headers (revision-history, summary)
        if (desc.toLowerCase().includes('total') && !codigoProv) continue;

        const qtyRaw = String(r[cols.qty] || '').trim();
        const unit = String(r[cols.unit] || '').trim();
        const proveedor = String(r[cols.rawMaterial] || '').trim();
        const process = String(r[cols.process] || '').trim();
        const material = String(r[cols.material] || '').trim();
        const color = String(cols.color !== -1 ? r[cols.color] || '' : '').trim();

        const categoria = mapToCategory({ process, material, descripcion: desc, rawMaterial: proveedor });

        // codigoInterno: priorizar nivel mas profundo no vacio
        const codigoInterno = nivel3 || nivel2 || nivel1 || '';

        items.push({
            id: uuidv4(),
            codigoInterno,
            codigoProveedor: codigoProv,
            descripcion: color && !desc.includes(color) ? `${desc} (${color})` : desc,
            consumo: qtyRaw,
            unidad: normalizeUnit(unit),
            proveedor,
            imagen: '',
            leaderX: 0,
            leaderY: 0,
            observaciones: process ? `Proceso: ${process}` : '',
            _categoria: categoria,
        });
    }

    // Agrupar items por categoria, en orden canonico
    const CATEGORIES = ['PLASTICO','FUNDA','SUSTRATO','ADHESIVO_RETICULANTE','ETIQUETA','CARTON','PRIMER','FILM','OTROS'];
    const groupsMap = new Map();
    for (const cat of CATEGORIES) groupsMap.set(cat, { id: uuidv4(), categoria: cat, items: [] });
    for (const item of items) {
        const cat = item._categoria;
        delete item._categoria;
        groupsMap.get(cat).items.push(item);
    }
    // Numerar correlativo 1..N en orden de categoria + orden de aparicion
    let numero = 1;
    for (const cat of CATEGORIES) {
        for (const it of groupsMap.get(cat).items) {
            it.numero = String(numero++);
        }
    }
    const groups = CATEGORIES
        .map(c => groupsMap.get(c))
        .filter(g => g.items.length > 0);

    return { meta, groups, totalItems: items.length };
}

function normalizeUnit(u) {
    const s = String(u || '').toUpperCase().trim();
    if (s === 'KG' || s === 'KILOGRAM' || s === 'KILO') return 'KG';
    if (s === 'ML' || s === 'M2' || s === 'MT2') return 'MT2';
    if (s === 'M' || s === 'MT') return 'MT';
    if (s === 'UN' || s === 'U' || s === 'UN.' || s === 'UNID') return 'UN';
    if (s === 'L' || s === 'LT' || s === 'LITRO') return 'L';
    if (s === 'ROLL') return 'ROLL';
    return '';
}

// -------------------------------------------------------------------------
// Builder: convertir parsed sheets a BomDocument(s)
// -------------------------------------------------------------------------

function buildBomDocument({ bomNumber, partNumber, descripcion, cliente, proyecto, familia, revision, fechaEmision, elaboradoPor, variants }) {
    return {
        id: uuidv4(),
        bomNumber,
        cliente,
        proyecto,
        familia,
        partNumber,
        revision: revision || 'A',
        doc: {
            header: {
                organization: 'BARACK MERCOSUL',
                bomNumber,
                partNumber,
                descripcion,
                cliente,
                proyecto,
                familia,
                revision: revision || 'A',
                fechaEmision: fechaEmision || '',
                elaboradoPor: elaboradoPor || '',
                aprobadoPor: '',
            },
            imagenProducto: '',
            variants,
        },
    };
}

// -------------------------------------------------------------------------
// Strategies por archivo
// -------------------------------------------------------------------------

function parseNovax(filepath) {
    const wb = XLSX.readFile(filepath);
    const docs = [];
    let bomCounter = 1;

    // NOVAX agrupa: un BOM "Top Roll" con variantes FR/RR (2 sheets), idem Insert, idem Armrest
    const groupings = [
        { familia: 'Top Roll Patagonia', sheets: ['BOM FRONT TOP ROLL', 'BOM REAR TOP ROLL'], variantNames: ['Front', 'Rear'] },
        { familia: 'Insert Patagonia', sheets: ['BOM FRONT INSERT', 'BOM RR INSERT'], variantNames: ['Front', 'Rear'] },
        { familia: 'Armrest Door Panel Patagonia', sheets: ['BOM FRONT ARMREST', 'BOM REAR ARMREST'], variantNames: ['Front', 'Rear'] },
    ];

    for (const g of groupings) {
        const variants = [];
        let firstMeta = null;
        for (let i = 0; i < g.sheets.length; i++) {
            const sheetName = g.sheets[i];
            if (!wb.Sheets[sheetName]) continue;
            const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
            if (!parsed) continue;
            if (!firstMeta) firstMeta = parsed.meta;
            variants.push({
                id: uuidv4(),
                name: g.variantNames[i] || sheetName,
                partNumber: parsed.meta.partNumber || '',
                groups: parsed.groups,
            });
        }
        if (variants.length === 0) continue;
        const bomNumber = `BOM-NOVAX-${String(bomCounter++).padStart(3, '0')}`;
        docs.push(buildBomDocument({
            bomNumber,
            partNumber: variants[0].partNumber || '',
            descripcion: g.familia,
            cliente: 'NOVAX',
            proyecto: firstMeta?.project || 'VW427/1LA-K_PATAGONIA',
            familia: g.familia,
            revision: 'Rev.11',
            fechaEmision: firstMeta?.fechaEmision || '',
            elaboradoPor: firstMeta?.autor || '',
            variants,
        }));
    }
    return docs;
}

function parseVwArmrest(filepath) {
    const wb = XLSX.readFile(filepath);
    const docs = [];
    const targetSheet = wb.SheetNames.find(s => s.toLowerCase().startsWith('bom'));
    if (!targetSheet) return docs;
    const parsed = parseSheet(wb.Sheets[targetSheet], targetSheet);
    if (!parsed) return docs;
    docs.push(buildBomDocument({
        bomNumber: 'BOM-VW-PAT-ARMREST',
        partNumber: parsed.meta.partNumber || '',
        descripcion: parsed.meta.partName || 'Armrest Rear Patagonia',
        cliente: 'VWA',
        proyecto: parsed.meta.project || 'VW427-1LA_K-PATAGONIA',
        familia: 'Armrest Door Panel Patagonia',
        revision: parsed.meta.revision || 'V5',
        fechaEmision: parsed.meta.fechaEmision || '',
        elaboradoPor: parsed.meta.autor || '',
        variants: [{ id: uuidv4(), name: '', partNumber: parsed.meta.partNumber || '', groups: parsed.groups }],
    }));
    return docs;
}

function parseVwHeadrest(filepath) {
    const wb = XLSX.readFile(filepath);
    const docs = [];

    // Headrest: 12 BOMs = 3 productos (FRONT, REAR CENTER, REAR OUTER) × 4 variantes (base + .A/.B/.C)
    // Agrupamos por producto base (sheet name antes del .A/.B/.C)
    const grouped = new Map();
    for (const sheetName of wb.SheetNames) {
        if (!sheetName.toUpperCase().startsWith('BOM')) continue;
        // Detectar variant suffix .A/.B/.C en el sheet name
        const variantMatch = sheetName.match(/\.([A-Z])\s*$/);
        const variantSuffix = variantMatch ? variantMatch[1] : '';
        const baseName = sheetName.replace(/\.[A-Z]\s*$/, '').trim();
        if (!grouped.has(baseName)) grouped.set(baseName, []);
        grouped.get(baseName).push({ sheetName, variantSuffix });
    }

    let bomCounter = 1;
    for (const [baseName, sheetsInGroup] of grouped.entries()) {
        const variants = [];
        let firstMeta = null;
        for (const { sheetName, variantSuffix } of sheetsInGroup) {
            const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
            if (!parsed) continue;
            if (!firstMeta) firstMeta = parsed.meta;
            variants.push({
                id: uuidv4(),
                name: variantSuffix ? `Variante ${variantSuffix}` : 'Base',
                partNumber: parsed.meta.partNumber || '',
                groups: parsed.groups,
            });
        }
        if (variants.length === 0) continue;
        // Inferir nombre del producto del baseName: "BOM 2HC.881.901" → familia "Headrest Front" si match
        const familia = inferHeadrestFamily(baseName, sheetsInGroup, firstMeta);
        docs.push(buildBomDocument({
            bomNumber: `BOM-VW-PAT-HRC-${String(bomCounter++).padStart(2, '0')}`,
            partNumber: variants[0].partNumber || '',
            descripcion: firstMeta?.partName || familia,
            cliente: 'VWA',
            proyecto: firstMeta?.project || 'VW427-1LA_K-PATAGONIA',
            familia,
            revision: 'V3',
            fechaEmision: firstMeta?.fechaEmision || '',
            elaboradoPor: firstMeta?.autor || '',
            variants,
        }));
    }
    return docs;
}

function inferHeadrestFamily(baseName, sheets, meta) {
    const partName = String(meta?.partName || '').toUpperCase();
    if (partName.includes('FRONT')) return 'Headrest Front Patagonia';
    if (partName.includes('REAR CENTER') || partName.includes('REAR CEN')) return 'Headrest Rear Center Patagonia';
    if (partName.includes('REAR OUTER') || partName.includes('REAR OUT')) return 'Headrest Rear Outer Patagonia';
    return 'Headrest Patagonia';
}

function parseVwIpPad(filepath) {
    const wb = XLSX.readFile(filepath);
    const docs = [];
    let bomCounter = 1;

    // IP PAD: 1 BOM con 2 variantes (LOW + HIGH)
    const variants = [];
    let firstMeta = null;
    for (const sheetName of wb.SheetNames) {
        if (sheetName.toLowerCase() === 'caratula') continue;
        const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
        if (!parsed) continue;
        if (!firstMeta) firstMeta = parsed.meta;
        let varName = 'Default';
        const upperName = sheetName.toUpperCase();
        if (upperName.includes('LOW')) varName = 'PL1 Low';
        else if (upperName.includes('HIGH')) varName = 'PL2/PL3 High';
        variants.push({
            id: uuidv4(),
            name: varName,
            partNumber: parsed.meta.partNumber || '',
            groups: parsed.groups,
        });
    }
    if (variants.length === 0) return docs;
    docs.push(buildBomDocument({
        bomNumber: 'BOM-VW-PAT-IPPAD',
        partNumber: variants[0].partNumber || '',
        descripcion: firstMeta?.partName || 'IP PAD Patagonia',
        cliente: 'VWA',
        proyecto: firstMeta?.project || 'VW427-1LA_K-PATAGONIA',
        familia: 'IP PAD',
        revision: 'V3',
        fechaEmision: firstMeta?.fechaEmision || '',
        elaboradoPor: firstMeta?.autor || '',
        variants,
    }));
    return docs;
}

function parseCozzuolUpperTrim(filepath) {
    const wb = XLSX.readFile(filepath);
    const docs = [];
    const variants = [];
    let firstMeta = null;
    for (const sheetName of wb.SheetNames) {
        const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
        if (!parsed) continue;
        if (!firstMeta) firstMeta = parsed.meta;
        // Sheet names: "Upper TRIM stone Gray" / "Upper TRIM Soul Black"
        const colorMatch = sheetName.match(/(stone gray|soul black|gray|black)/i);
        const variantName = colorMatch ? colorMatch[0].replace(/\s+/g, ' ').trim() : sheetName;
        variants.push({
            id: uuidv4(),
            name: variantName,
            partNumber: parsed.meta.partNumber || '',
            groups: parsed.groups,
        });
    }
    if (variants.length === 0) return docs;
    docs.push(buildBomDocument({
        bomNumber: 'BOM-COZZUOL-UPPER-TRIM',
        partNumber: variants[0].partNumber || '',
        descripcion: firstMeta?.partName || 'Upper Trim Panel',
        cliente: 'COZZUOL',
        proyecto: firstMeta?.project || '',
        familia: 'Upper Trim Panel',
        revision: firstMeta?.revision || 'A',
        fechaEmision: firstMeta?.fechaEmision || '',
        elaboradoPor: firstMeta?.autor || '',
        variants,
    }));
    return docs;
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);
    const novaxOnly = args.includes('--novax-only');
    const outIdx = args.indexOf('--out');
    const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

    const allDocs = [];

    function safeParse(label, fn, path) {
        if (!fs.existsSync(path)) {
            console.error(`[SKIP] ${label}: archivo no existe — ${path}`);
            return;
        }
        try {
            const docs = fn(path);
            console.error(`[OK]   ${label}: ${docs.length} BOM(s) — ${docs.reduce((n, d) => n + d.doc.variants.reduce((m, v) => m + v.groups.reduce((k, g) => k + g.items.length, 0), 0), 0)} items totales`);
            allDocs.push(...docs);
        } catch (e) {
            console.error(`[ERROR] ${label}: ${e.message}`);
        }
    }

    safeParse('NOVAX Tapizadas Puerta Rev.11', parseNovax, NOVAX_RUTA);
    if (!novaxOnly) {
        safeParse('VW Patagonia Armrest V5', parseVwArmrest, VW_ARMREST);
        safeParse('VW Patagonia Headrest V3', parseVwHeadrest, VW_HEADREST);
        safeParse('VW Patagonia IP PAD V3', parseVwIpPad, VW_IPPAD);
        safeParse('COZZUOL Upper Trim Panel', parseCozzuolUpperTrim, COZZUOL);
    }

    console.error(`\n=== TOTAL: ${allDocs.length} BOM document(s) ===`);
    for (const d of allDocs) {
        const items = d.doc.variants.reduce((s, v) => s + v.groups.reduce((g, x) => g + x.items.length, 0), 0);
        const cats = new Set(d.doc.variants.flatMap(v => v.groups.map(g => g.categoria)));
        console.error(`  - ${d.bomNumber} | ${d.familia} | ${d.doc.variants.length} variant(s) | ${items} items | cats: ${[...cats].join(',')}`);
    }

    if (outPath) {
        fs.writeFileSync(outPath, JSON.stringify(allDocs, null, 2));
        console.error(`\nWrote JSON: ${outPath}`);
    }
}

main();
