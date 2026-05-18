/**
 * Fix: Observaciones Fak sesion 2026-05-17 (parte B — post-cierre M).
 *
 * Aplica 4 fixes "claros" + persistencia:
 *
 * 1. Quitar "Pistola etiquetadora" Machine de OPs de embalaje (no aplica en
 *    embalaje, solo en OP60 PRECINTO del HF-PAT). Reemplazar nombre por
 *    "Etiquetadora impresora" (etiquetadora con tinta que imprime etiquetas
 *    de PN/identificacion para embalaje).
 *    - AMFE-HF-PAT OP90 WE "Pistola etiquetadora"
 *    - AMFE-HRC-PAT OP100 WE "Pistola etiquetadora"
 *
 * 2. Agregar funcion vacia a HF-PAT OP50 + OP51 WE "Operador de produccion":
 *    - OP50 ENFUNDADO: "Insertar inserto EPP y posicionar la funda antes del
 *      cierre de molde"
 *    - OP51 INSERCION DE VARILLA: usar el operationFunction que ya existe
 *      "Insertar varilla en funda asegurando vinilo como reten para evitar
 *      fuga PU"
 *
 * 3. Agregar WE Method en AMFE-INS-PAT OP120 EMBALAJE (solo tiene Man).
 *    NUEVO WE Method "Procedimiento de embalaje y etiquetado" sin failures
 *    (equipo APQP los completa).
 *
 * NOTA: NO se tocan las MESAS como Machine porque investigacion AIAG-VDA
 * confirma que "inspection devices, fixtures" estan listados como Machine.
 *
 * Uso:
 *   node scripts/_fix-observaciones-fak-2026-05-17b.mjs           # dry-run
 *   node scripts/_fix-observaciones-fak-2026-05-17b.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const cache = new Map();
async function loadDoc(amfeNumber) {
    if (cache.has(amfeNumber)) return cache.get(amfeNumber);
    const meta = all.find(a => a.amfe_number === amfeNumber);
    if (!meta) throw new Error(`AMFE not found: ${amfeNumber}`);
    const read = await readAmfe(sb, meta.id);
    const entry = { meta, read, before: read.doc, after: JSON.parse(JSON.stringify(read.doc)) };
    cache.set(amfeNumber, entry);
    return entry;
}

// === FIX 1: Pistola etiquetadora -> Etiquetadora impresora (en embalaje solamente) ===
{
    for (const num of ['AMFE-HF-PAT', 'AMFE-HRC-PAT']) {
        const entry = await loadDoc(num);
        for (const op of (entry.after.operations || [])) {
            const opName = (op.name || op.operationName || '').toUpperCase();
            if (!/EMBALAJE|EMPAQUE/.test(opName)) continue;
            for (const we of (op.workElements || [])) {
                if (!/^Pistola\s+etiquetadora$/i.test(we.name || '')) continue;
                const oldName = we.name;
                we.name = 'Etiquetadora impresora';
                logChange(apply, `#1 ${num} OP${op.opNumber || op.operationNumber} ${opName.slice(0, 25)} WE rename`,
                    { before: oldName, after: we.name });
            }
        }
    }
}

// === FIX 2: Funciones HF-PAT OP50 + OP51 Operador de produccion ===
{
    const entry = await loadDoc('AMFE-HF-PAT');
    for (const op of (entry.after.operations || [])) {
        const opn = +(op.opNumber || op.operationNumber);
        if (opn !== 50 && opn !== 51) continue;
        for (const we of (op.workElements || [])) {
            if (we.type !== 'Man') continue;
            if (!/operador\s+de\s+produccion/i.test(we.name || '')) continue;
            for (const fn of (we.functions || [])) {
                const oldFn = fn.description || fn.functionDescription || '';
                if (oldFn && oldFn.trim() !== '') continue; // ya tiene fn

                let newFn;
                if (opn === 50) {
                    newFn = 'Insertar inserto EPP y posicionar la funda antes del cierre de molde';
                } else if (opn === 51) {
                    // Usar operationFunction si existe
                    newFn = op.operationFunction || 'Insertar varilla en funda asegurando vinilo como retén para evitar fuga PU';
                }
                fn.description = newFn;
                fn.functionDescription = newFn;
                logChange(apply, `#2 HF-PAT OP${opn} WE Operador de produccion fn`,
                    { before: '(vacia)', after: newFn });
            }
        }
    }
}

// === FIX 3: Agregar WE Method en INS-PAT OP120 EMBALAJE ===
{
    const entry = await loadDoc('AMFE-INS-PAT');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 120);
    if (op && /EMBALAJE|EMPAQUE/i.test(op.name || op.operationName || '')) {
        const hasMethod = (op.workElements || []).some(w => w.type === 'Method');
        if (!hasMethod) {
            const newWE = {
                type: 'Method',
                name: 'Procedimiento de embalaje y etiquetado',
                functions: [{
                    description: 'Definir cantidad por bulto, identificacion y secuencia de carga',
                    functionDescription: 'Definir cantidad por bulto, identificacion y secuencia de carga',
                    failures: [],
                }],
            };
            op.workElements = op.workElements || [];
            op.workElements.push(newWE);
            logChange(apply, `#3 INS-PAT OP120 EMBALAJE — agregar WE Method`,
                { name: newWE.name, fn: newWE.functions[0].description });
        }
    }
}

const plan = [];
for (const [, entry] of cache) {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) continue;
    plan.push({
        id: entry.meta.id,
        amfeNumber: entry.meta.amfe_number,
        productName: entry.read.row.project_name,
        before: entry.before,
        after: entry.after,
    });
}
console.log(`\nResumen: ${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);
