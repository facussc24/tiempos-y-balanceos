/**
 * _sanearFaseFinalNovax.mjs
 * Saneamiento final de materiales, cotas cuantitativas y elementos huérfanos en los 3 AMFEs de NOVAX:
 * 1. AMFE-INS-PAT (Insert):
 *    - Elimina WorkElement huérfano "Material recibido" en OP 10.
 *    - Corrige cota "mas de 6 cm" en causa de costura OP 50.
 * 2. AMFE-ARM-PAT (Armrest):
 *    - Elimina WorkElements "Etiquetas Blancas" y "Etiquetas de rechazo" en OP 10.
 *    - Actualiza código oficial de HB Fuller CQ-7080-5 (codigo 427ADH002ADH01).
 *    - Corrige modo de falla "4 min de curado" en OP 60 a "Desmolde prematuro de la pieza antes de completar el tiempo de polimerización y curado".
 * 3. AMFE-TR-PAT (Top Roll):
 *    - Actualiza "Tweeter (codigo TBD)" a "Tweeter ABS negro (codigo INY-TRL0009-V1)" en OP 5.
 *    - Corrige cota "< 180°C" en OP 50 a "Temperatura de set-point de conformado fuera del rango especificado".
 *    - Corrige "1000 Lux" si existiera en OP 80 a "Iluminación estandarizada en cabina de control".
 *
 * Uso:
 *   node scripts/_sanearFaseFinalNovax.mjs          (dry-run)
 *   node scripts/_sanearFaseFinalNovax.mjs --apply  (aplica cambios a Supabase)
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const TARGET_AMFES = ['AMFE-INS-PAT', 'AMFE-ARM-PAT', 'AMFE-TR-PAT'];
const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .in('amfe_number', TARGET_AMFES);
if (error) throw error;

const plan = [];

for (const row of rows) {
    const num = row.amfe_number;
    const { doc } = await readAmfe(sb, row.id);
    const antes = JSON.parse(JSON.stringify(doc));
    let modificado = false;
    const cambios = [];

    // Helper para reemplazar texto recursivo en un objeto/array
    function limpiarTextoRecursivo(obj) {
        if (!obj) return;
        if (typeof obj === 'string') return;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string') {
                let nuevo = val;
                if (nuevo.includes('mas de 6 cm') || nuevo.includes('más de 6 cm')) {
                    nuevo = nuevo.replace(/mas de 6 cm|más de 6 cm/gi, 'exceso de longitud de hilo');
                    cambios.push(`Reemplazo cota 6 cm en "${key}": "${val}" -> "${nuevo}"`);
                    modificado = true;
                }
                if (nuevo.includes('< 180°C') || nuevo.includes('<180°C') || nuevo.includes('< 180 °C')) {
                    nuevo = nuevo.replace(/<\s*180\s*°?\s*C/gi, 'fuera de especificación');
                    cambios.push(`Reemplazo cota 180°C en "${key}": "${val}" -> "${nuevo}"`);
                    modificado = true;
                }
                if (nuevo.match(/1000\s*lux/i)) {
                    nuevo = nuevo.replace(/>?\s*1000\s*lux/gi, 'estandarizada en cabina de control');
                    cambios.push(`Reemplazo cota 1000 Lux en "${key}": "${val}" -> "${nuevo}"`);
                    modificado = true;
                }
                if (nuevo.includes('antes de los 4 min de curado') || nuevo.includes('antes de 4 min de curado')) {
                    nuevo = nuevo.replace(/antes de los? 4 min de curado/gi, 'antes de completar el tiempo de polimerización y curado');
                    cambios.push(`Reemplazo cota 4 min en "${key}": "${val}" -> "${nuevo}"`);
                    modificado = true;
                }
                obj[key] = nuevo;
            } else if (typeof val === 'object' && val !== null) {
                limpiarTextoRecursivo(val);
            }
        }
    }

    // ========================================================================
    // 1. AMFE-INS-PAT (INSERT)
    // ========================================================================
    if (num === 'AMFE-INS-PAT') {
        const op10 = doc.operations?.find(o => String(o.operationNumber) === '10');
        if (op10) {
            const antesCount = op10.workElements?.length || 0;
            // Eliminar elemento "Material recibido" o huérfano
            op10.workElements = (op10.workElements || []).filter(we => {
                const n = (we.name || '').trim().toLowerCase();
                const esHuerfano = n === 'material recibido' || n === '' || (!we.functions || we.functions.length === 0);
                if (esHuerfano) {
                    cambios.push(`OP 10: Eliminado WorkElement huérfano "${we.name}"`);
                    return false;
                }
                return true;
            });
            if (op10.workElements.length !== antesCount) modificado = true;
        }

        // OP 50: cota de hilo
        const op50 = doc.operations?.find(o => String(o.operationNumber) === '50');
        if (op50) {
            for (const we of op50.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fl of fn.failures || []) {
                        for (const c of fl.causes || []) {
                            const cText = c.cause || c.description || '';
                            if (cText.includes('6 cm')) {
                                const nuevoTexto = cText.replace(/mas de 6 cm|más de 6 cm/gi, 'exceso de longitud de hilo');
                                c.cause = nuevoTexto;
                                c.description = nuevoTexto;
                                cambios.push(`OP 50 Costura: Saneada cota de 6 cm en causa -> "${nuevoTexto}"`);
                                modificado = true;
                            }
                        }
                    }
                }
            }
        }
    }

    // ========================================================================
    // 2. AMFE-ARM-PAT (ARMREST)
    // ========================================================================
    if (num === 'AMFE-ARM-PAT') {
        const op10 = doc.operations?.find(o => String(o.operationNumber) === '10');
        if (op10) {
            const antesCount = op10.workElements?.length || 0;
            // Eliminar etiquetas de rechazo y etiquetas blancas
            op10.workElements = (op10.workElements || []).filter(we => {
                const n = (we.name || '').toLowerCase();
                const esEtiqueta = n.includes('etiquetas blancas') || n.includes('etiquetas de rechazo') || n.includes('etiqueta blanca');
                if (esEtiqueta) {
                    cambios.push(`OP 10: Eliminado insumo indirecto "${we.name}" (AIAG-VDA 2019 / Formel Q)`);
                    return false;
                }
                return true;
            });
            if (op10.workElements.length !== antesCount) modificado = true;

            // Actualizar código HB Fuller
            for (const we of op10.workElements || []) {
                if (we.name?.toLowerCase().includes('hb fuller') && !we.name.includes('427ADH002ADH01')) {
                    we.name = 'Adhesivo HB Fuller CQ-7080-5 (codigo 427ADH002ADH01)';
                    cambios.push(`OP 10: Actualizado nombre y código de HB Fuller CQ-7080-5`);
                    modificado = true;
                }
            }
        }

        // OP 60: Modo de falla 4 min
        const op60 = doc.operations?.find(o => String(o.operationNumber) === '60');
        if (op60) {
            for (const we of op60.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fl of fn.failures || []) {
                        const fText = fl.failureMode || fl.description || '';
                        if (fText.includes('4 min')) {
                            const nuevoModo = 'Desmolde prematuro de la pieza antes de completar el tiempo de polimerización y curado';
                            fl.failureMode = nuevoModo;
                            fl.description = nuevoModo;
                            cambios.push(`OP 60 Inyección PU: Saneado modo de falla con "4 min" -> "${nuevoModo}"`);
                            modificado = true;
                        }
                    }
                }
            }
        }
    }

    // ========================================================================
    // 3. AMFE-TR-PAT (TOP ROLL)
    // ========================================================================
    if (num === 'AMFE-TR-PAT') {
        const op5 = doc.operations?.find(o => String(o.operationNumber) === '5');
        if (op5) {
            for (const we of op5.workElements || []) {
                if (we.name?.toLowerCase().includes('tweeter') && we.name.toLowerCase().includes('tbd')) {
                    we.name = 'Tweeter ABS negro (codigo INY-TRL0009-V1)';
                    cambios.push(`OP 5: Actualizado "Tweeter (codigo TBD)" a "Tweeter ABS negro (codigo INY-TRL0009-V1)"`);
                    modificado = true;
                }
            }
        }

        // OP 50: cota 180°C
        const op50 = doc.operations?.find(o => String(o.operationNumber) === '50');
        if (op50) {
            for (const we of op50.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fl of fn.failures || []) {
                        for (const c of fl.causes || []) {
                            const cText = c.cause || c.description || '';
                            if (cText.includes('180°C') || cText.includes('180 °C')) {
                                const nuevoTexto = 'Temperatura de set-point de conformado fuera del rango especificado';
                                c.cause = nuevoTexto;
                                c.description = nuevoTexto;
                                cambios.push(`OP 50 Plegado de Bordes: Saneada cota de 180°C en causa -> "${nuevoTexto}"`);
                                modificado = true;
                            }
                        }
                    }
                }
            }
        }
    }

    // Limpieza recursiva general de cualquier cota residual
    limpiarTextoRecursivo(doc);

    if (modificado) {
        logChange(apply, `${num}: Saneamiento de materiales, cotas y elementos huérfanos`, cambios.join('\n     '));
        plan.push({ id: row.id, amfeNumber: num, productName: doc.productName, before: antes, after: doc });
    }
}

console.log(`\nDocumentos modificados en el plan: ${plan.length}`);

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`   ✓ Guardado en Supabase: ${p.amfeNumber}`);
    }
});

finish(apply);
