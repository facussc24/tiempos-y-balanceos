/**
 * Fix: actualizar tabla `products` con los 12 codigos APC Patagonia (3 productos x 4 variantes L)
 * al formato canonico dictado por Fak (sesion 2026-05-17):
 *
 *   - codigo: con puntos cada 3 digitos (ej. "2HC.881.901 RL1")
 *   - descripcion: terminologia Barack en castellano ("APC DELANTERO L0 - PVC Titan Black")
 *
 * Pre-verificado:
 *   - Las 12 filas existen en `products` con linea_code='VWA'
 *   - No hay referencias en projects.data al codigo viejo (no rompe FKs)
 *
 * Uso:
 *   node scripts/_fix-apc-products-codigo-canonico.mjs           # dry-run
 *   node scripts/_fix-apc-products-codigo-canonico.mjs --apply
 */
import { connectSupabase } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';

const UPDATES = [
    // APC DELANTERO (HF-PAT)
    { oldCodigo: '2HC881901 RL1',  newCodigo: '2HC.881.901 RL1',   newDesc: 'APC DELANTERO L0 - PVC Titan Black' },
    { oldCodigo: '2HC881901A GFV', newCodigo: '2HC.881.901.A GFV', newDesc: 'APC DELANTERO L1 - FABRIC Jacquard Black' },
    { oldCodigo: '2HC881901B GEV', newCodigo: '2HC.881.901.B GEV', newDesc: 'APC DELANTERO L2 - PVC Andino Gray' },
    { oldCodigo: '2HC881901C EFG', newCodigo: '2HC.881.901.C EFG', newDesc: 'APC DELANTERO L3 - PVC Dark Slate' },
    // APC TRASERO CENTRAL (HRC-PAT)
    { oldCodigo: '2HC885900 RL1',  newCodigo: '2HC.885.900 RL1',   newDesc: 'APC TRASERO CENTRAL L0 - PVC Titan Black' },
    { oldCodigo: '2HC885900A EIF', newCodigo: '2HC.885.900.A EIF', newDesc: 'APC TRASERO CENTRAL L1 - FABRIC Jacquard Black' },
    { oldCodigo: '2HC885900B SIY', newCodigo: '2HC.885.900.B SIY', newDesc: 'APC TRASERO CENTRAL L2 - PVC Andino Gray' },
    { oldCodigo: '2HC885900C SIY', newCodigo: '2HC.885.900.C SIY', newDesc: 'APC TRASERO CENTRAL L3 - PVC Dark Slate' },
    // APC TRASERO LATERAL (HRO-PAT)
    { oldCodigo: '2HC885901 RL1',  newCodigo: '2HC.885.901 RL1',   newDesc: 'APC TRASERO LATERAL L0 - PVC Titan Black' },
    { oldCodigo: '2HC885901A GFU', newCodigo: '2HC.885.901.A GFU', newDesc: 'APC TRASERO LATERAL L1 - FABRIC Jacquard Black' },
    { oldCodigo: '2HC885901B GEQ', newCodigo: '2HC.885.901.B GEQ', newDesc: 'APC TRASERO LATERAL L2 - PVC Andino Gray' },
    { oldCodigo: '2HC885901C DZS', newCodigo: '2HC.885.901.C DZS', newDesc: 'APC TRASERO LATERAL L3 - PVC Dark Slate' },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

let total = 0;
let skipped = 0;
for (const u of UPDATES) {
    // Buscar fila por codigo viejo
    const { data: rows, error } = await sb.from('products')
        .select('id, codigo, descripcion')
        .eq('codigo', u.oldCodigo);
    if (error) { console.warn(`  ERROR ${u.oldCodigo}: ${error.message}`); skipped++; continue; }
    if (!rows || rows.length === 0) {
        // Quizas ya esta canonico
        const { data: rowsNew } = await sb.from('products').select('id, codigo, descripcion').eq('codigo', u.newCodigo);
        if (rowsNew && rowsNew.length > 0) {
            console.log(`  SKIP ${u.newCodigo} ya canonico`);
            skipped++;
        } else {
            console.warn(`  NOT FOUND ${u.oldCodigo}`);
            skipped++;
        }
        continue;
    }
    const row = rows[0];
    logChange(apply, `products: ${row.codigo} -> ${u.newCodigo}`,
        { old_desc: row.descripcion, new_desc: u.newDesc });

    if (apply) {
        const { error: upErr } = await sb.from('products')
            .update({ codigo: u.newCodigo, descripcion: u.newDesc, updated_at: new Date().toISOString() })
            .eq('id', row.id);
        if (upErr) {
            console.error(`  FAIL update ${row.id}: ${upErr.message}`);
            continue;
        }
    }
    total++;
}

console.log(`\nResumen: ${total} filas a actualizar, ${skipped} saltadas.`);
finish(apply);
process.exit(0);
