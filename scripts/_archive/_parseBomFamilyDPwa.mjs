/**
 * Parser Familia D — PWA Toyota Telas Planas + Telas Termoformadas
 *
 * Solo carga BOMs cuyo producto tenga AMFE en Supabase (regla del proyecto).
 * Familias con AMFE: Telas Planas PWA, Telas Termoformadas PWA.
 *
 * Telas Planas: 1 sheet, header en fila 1, jerarquia por indentacion ("→").
 *   Cada "Articulo Principal" (21-9463, 21-9464...) = 1 variante del BOM.
 *
 * Telas Termoformadas: 3 sheets (BOM ASIENTO, BOM RESPALDO, REFUERZO LATERAL).
 *   Cada sheet = 1 variante. Headers repetidos antes de cada bloque de items.
 *
 * Output: JSON list de BomDocuments (formato igual a Familia A).
 */

import XLSX from 'xlsx-js-style';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const TELAS_PLANAS = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/PWA/1- TOYOTA_TELAS_ PLANAS_581D/APQP/7-Lista de materiales/Listado de materiales.xlsx';
const TELAS_TERMO = '//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/PWA/2-TOYOTA_TELAS_TERMOFORMADAS_582D/APQP/7-Lista de materiales/TOYOTA_TELAS_TERMOFORMADAS_582D_BOM Barack_Preliminar .xlsx';

const CATEGORIES = ['PLASTICO','FUNDA','SUSTRATO','ADHESIVO_RETICULANTE','ETIQUETA','CARTON','PRIMER','FILM','OTROS'];

function normalizeUnit(u) {
    const s = String(u || '').toUpperCase().trim();
    if (s === 'KG') return 'KG';
    if (s === 'ML' || s === 'M2' || s === 'MT2') return 'MT2';
    if (s === 'M' || s === 'MT') return 'MT';
    if (s === 'UN' || s === 'UNID' || s === 'U') return 'UN';
    if (s === 'L') return 'L';
    if (s === 'ROLL') return 'ROLL';
    return '';
}

function mapTelasCategoria({ codigo, descripcion, material }) {
    const C = String(codigo || '').toUpperCase();
    const D = String(descripcion || '').toUpperCase();
    const M = String(material || '').toUpperCase();

    // Hilos
    if (C.startsWith('HILO') || D.includes('HILO')) return 'ADHESIVO_RETICULANTE';
    // Aplix (velcro de sujecion)
    if (C.startsWith('APLIX') || D.includes('APLIX')) return 'ADHESIVO_RETICULANTE';
    // Adhesivos
    if (D.includes('ADHESIV') || D.includes('CINTA NO TEJIDA')) return 'ADHESIVO_RETICULANTE';
    // Tela base / corte
    if (C.startsWith('COR-TEL') || D.includes('CORTE TELA')) return 'SUSTRATO';
    // Tela material
    if (D.includes('TELA NO TEJIDA') || D.includes('PUNZ.') || D.includes('MONOFELT') || M.includes('PUNZONADO') || M.includes('BICOMP')) return 'FUNDA';
    // Refuerzo / Fieltro
    if (D.includes('REFUERZO') || D.includes('FIELTRO') || M.includes('FIELTRO')) return 'SUSTRATO';
    // Troquelados
    if (C.startsWith('TRO-TEL') || C.startsWith('TROTEL')) return 'SUSTRATO';

    return 'OTROS';
}

// =========================================================================
// Telas Planas — 1 BOM, N variantes (1 por Articulo Principal)
// =========================================================================

function parseTelasPlanas(filepath) {
    const wb = XLSX.readFile(filepath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

    // Header en fila 1 (indice 1 en 0-based pero 1 en 1-based, depende de cuantos rows hay arriba)
    // El reporte dice: rows starting at row 1 with header. Filas de datos desde idx 2.
    // Columnas: B=Articulo Principal, C=Codigo Componente, D=Descripcion, E=U.M., F=Cantidad, G=Plano, H=Fecha, I=Aplix
    // Las filas 0-based: rows[1] = header, rows[2]+ = data

    // Agrupar por articulo principal
    const variantsMap = new Map(); // articuloPN -> { items: [...] }
    let currentArticulo = '';

    // El sheet tiene rango B1:I78, asi sheet_to_json indexa desde col B = idx 0
    // Header (idx 1): Articulo Principal | Codigo Componente | Descripcion | U.M. | Cantidad (Consumo) | N° Plano | Fecha | Cant. Aplix
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        const articulo = String(r[0] || '').trim();
        if (articulo) currentArticulo = articulo;
        const codigo = String(r[1] || '').replace(/^\s*→\s*/, '').trim();
        const desc = String(r[2] || '').trim();
        const um = String(r[3] || '').trim();
        const cantidad = String(r[4] || '').trim();
        const plano = String(r[5] || '').trim();
        // Skip filas vacias o de header repetido
        if (!desc && !codigo) continue;
        if (!currentArticulo) continue;
        if (codigo.toLowerCase() === 'codigo' || desc.toLowerCase() === 'descripcion') continue;

        if (!variantsMap.has(currentArticulo)) {
            variantsMap.set(currentArticulo, []);
        }
        const categoria = mapTelasCategoria({ codigo, descripcion: desc, material: '' });
        variantsMap.get(currentArticulo).push({
            id: uuidv4(),
            codigoInterno: codigo,
            codigoProveedor: '',
            descripcion: desc,
            consumo: cantidad,
            unidad: normalizeUnit(um),
            proveedor: '',
            imagen: '',
            leaderX: 0,
            leaderY: 0,
            observaciones: plano ? `ECN: ${plano}` : '',
            _categoria: categoria,
        });
    }

    // Build variants
    const variants = [];
    for (const [articulo, items] of variantsMap.entries()) {
        const groupsMap = new Map();
        for (const cat of CATEGORIES) groupsMap.set(cat, { id: uuidv4(), categoria: cat, items: [] });
        for (const it of items) {
            const cat = it._categoria;
            delete it._categoria;
            groupsMap.get(cat).items.push(it);
        }
        let n = 1;
        for (const cat of CATEGORIES) {
            for (const it of groupsMap.get(cat).items) it.numero = String(n++);
        }
        const groups = CATEGORIES.map(c => groupsMap.get(c)).filter(g => g.items.length > 0);
        variants.push({
            id: uuidv4(),
            name: articulo,
            partNumber: articulo,
            groups,
        });
    }

    return [{
        id: uuidv4(),
        bomNumber: 'BOM-PWA-TELAS-PLANAS',
        partNumber: variants.map(v => v.partNumber).join(' / '),
        cliente: 'PWA',
        proyecto: '581D Toyota',
        familia: 'Telas Planas PWA',
        revision: 'A',
        doc: {
            header: {
                organization: 'BARACK MERCOSUL',
                bomNumber: 'BOM-PWA-TELAS-PLANAS',
                partNumber: variants.length > 0 ? `${variants[0].partNumber} a ${variants[variants.length-1].partNumber}` : '',
                descripcion: 'Telas Planas PWA Toyota',
                cliente: 'PWA',
                proyecto: '581D Toyota',
                familia: 'Telas Planas PWA',
                revision: 'A',
                fechaEmision: '',
                elaboradoPor: '',
                aprobadoPor: '',
            },
            imagenProducto: '',
            variants,
        },
    }];
}

// =========================================================================
// Telas Termoformadas — 1 BOM, 3 variantes (ASIENTO, RESPALDO, REFUERZO LATERAL)
// =========================================================================

function parseTelasTermoformadas(filepath) {
    const wb = XLSX.readFile(filepath);
    const variants = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

        // Detectar BOM title (fila 3 normalmente)
        let title = sheetName;
        for (let i = 0; i < Math.min(rows.length, 6); i++) {
            const cell = String(rows[i][2] || '').trim();
            if (cell && !cell.toLowerCase().includes('bom:') && cell.length > 5) {
                title = cell;
                break;
            }
        }

        // El sheet de termoformadas tiene rango A1:T24, sheet_to_json indexa desde col A = idx 0
        // Header tipico: row[2-5]: BOM:, title... row[5+]: Codigo | Material | Gramaje | Descripcion | Cant.X pieza | Consumo | Unidad
        const items = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const codigo = String(r[2] || '').trim();
            const material = String(r[3] || '').trim();
            const gramaje = String(r[4] || '').trim();
            const desc = String(r[5] || '').trim();
            const cantPieza = String(r[6] || '').trim();
            const consumo = String(r[7] || '').trim();
            const unidad = String(r[8] || '').trim();

            // Skip headers
            if (codigo.toLowerCase() === 'código' || codigo.toLowerCase() === 'codigo') continue;
            // Skip empty
            if (!desc && !codigo) continue;
            // Skip filas con desc tipo "BOM:"
            if (codigo.toLowerCase() === 'bom:') continue;

            // Algunos formatos tienen consumo en col 6 cuando cantPieza esta vacio
            const cantidadFinal = consumo || cantPieza || '';

            const categoria = mapTelasCategoria({ codigo, descripcion: desc, material });
            items.push({
                id: uuidv4(),
                codigoInterno: codigo === '-' ? '' : codigo,
                codigoProveedor: '',
                descripcion: material && material !== '-' ? `${desc} (${material}${gramaje && gramaje !== '-' ? ', ' + gramaje : ''})` : desc,
                consumo: cantidadFinal,
                unidad: normalizeUnit(unidad),
                proveedor: '',
                imagen: '',
                leaderX: 0,
                leaderY: 0,
                observaciones: '',
                _categoria: categoria,
            });
        }

        if (items.length === 0) continue;

        const groupsMap = new Map();
        for (const cat of CATEGORIES) groupsMap.set(cat, { id: uuidv4(), categoria: cat, items: [] });
        for (const it of items) {
            const cat = it._categoria;
            delete it._categoria;
            groupsMap.get(cat).items.push(it);
        }
        let n = 1;
        for (const cat of CATEGORIES) {
            for (const it of groupsMap.get(cat).items) it.numero = String(n++);
        }
        const groups = CATEGORIES.map(c => groupsMap.get(c)).filter(g => g.items.length > 0);

        variants.push({
            id: uuidv4(),
            name: sheetName.replace(/^BOM\s+/i, '').trim(),
            partNumber: title.length < 80 ? title : '',
            groups,
        });
    }

    if (variants.length === 0) return [];

    return [{
        id: uuidv4(),
        bomNumber: 'BOM-PWA-TELAS-TERMO',
        partNumber: variants[0].partNumber || '',
        cliente: 'PWA',
        proyecto: '582D Toyota',
        familia: 'Telas Termoformadas PWA',
        revision: 'A',
        doc: {
            header: {
                organization: 'BARACK MERCOSUL',
                bomNumber: 'BOM-PWA-TELAS-TERMO',
                partNumber: variants[0].partNumber || '',
                descripcion: 'Telas Termoformadas PWA Toyota',
                cliente: 'PWA',
                proyecto: '582D Toyota',
                familia: 'Telas Termoformadas PWA',
                revision: 'A',
                fechaEmision: '',
                elaboradoPor: '',
                aprobadoPor: '',
            },
            imagenProducto: '',
            variants,
        },
    }];
}

// =========================================================================
// Main
// =========================================================================

function main() {
    const args = process.argv.slice(2);
    const outIdx = args.indexOf('--out');
    const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
    const all = [];

    function safe(label, fn, p) {
        if (!fs.existsSync(p)) { console.error(`[SKIP] ${label}: not found`); return; }
        try {
            const docs = fn(p);
            const items = docs.reduce((s, d) => s + d.doc.variants.reduce((m, v) => m + v.groups.reduce((g, x) => g + x.items.length, 0), 0), 0);
            console.error(`[OK]   ${label}: ${docs.length} BOM, ${docs.reduce((s, d) => s + d.doc.variants.length, 0)} variantes, ${items} items`);
            all.push(...docs);
        } catch (e) { console.error(`[ERR] ${label}: ${e.message}`); }
    }

    safe('PWA Telas Planas', parseTelasPlanas, TELAS_PLANAS);
    safe('PWA Telas Termoformadas', parseTelasTermoformadas, TELAS_TERMO);

    console.error(`\nTotal: ${all.length} BOMs`);
    for (const d of all) {
        const items = d.doc.variants.reduce((s, v) => s + v.groups.reduce((g, x) => g + x.items.length, 0), 0);
        console.error(`  ${d.bomNumber} | ${d.familia} | ${d.doc.variants.length} var | ${items} items`);
    }
    if (outPath) {
        fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
        console.error(`\nWrote ${outPath}`);
    }
}

main();
