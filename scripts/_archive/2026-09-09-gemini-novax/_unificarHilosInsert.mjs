/**
 * _unificarHilosInsert.mjs
 *
 * Unifica en AMFE 158 (AMFE-INS-PAT) OP 10 los tres renglones duplicados de hilo de vista
 * (Jet Black, Alpe Gray y Gray Violet) en un unico WorkElement familiar multicroma:
 * "Hilo vista 20/3 (Linhanyl) - 3 variantes de color (Jet Black FX483TK-E0PTO, Alpe Gray FX483TK-11930E, Gray Violet FX483TK-11703E)"
 *
 * Mantiene intacto el hilo de union 30/3:
 * "Hilo de union 30/3 Jet Black (Linhanyl) (codigo FX284-E0PTO)"
 *
 * Uso:
 *   node scripts/_unificarHilosInsert.mjs          (dry-run)
 *   node scripts/_unificarHilosInsert.mjs --apply  (aplica cambios a Supabase y actualiza cache live)
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { calculateAP } from './_lib/apTable.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-INS-PAT');
if (error) throw error;
if (!rows?.length) throw new Error('No se encontro AMFE-INS-PAT');

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

const op10 = doc.operations?.find(o => String(o.operationNumber || o.opNumber) === '10');
if (!op10) throw new Error('No se encontro OP 10 en AMFE-INS-PAT');

// Filtrar los tres hilos de vista viejos
const hilosViejos = op10.workElements.filter(we => {
    const n = we.workElementName || we.name || '';
    return n.includes('Hilo vista 20/3') || n.includes('FX483TK');
});

console.log('Hilos viejos a unificar:', hilosViejos.map(we => we.workElementName || we.name));

if (hilosViejos.length === 0) {
    console.log('No hay hilos viejos para unificar. Ya podria estar unificado.');
    process.exit(0);
}

const baseWE = hilosViejos[0];
const baseFn = baseWE.functions?.[0];
const baseFms = baseFn?.failures || [];

// Crear el nuevo WorkElement unificado reutilizando IDs del primero para mantener trazabilidad
const weUnificado = {
    id: baseWE.id,
    workElementName: 'Hilo vista 20/3 (Linhanyl) - 3 variantes de color (Jet Black FX483TK-E0PTO, Alpe Gray FX483TK-11930E, Gray Violet FX483TK-11703E)',
    name: 'Hilo vista 20/3 (Linhanyl) - 3 variantes de color (Jet Black FX483TK-E0PTO, Alpe Gray FX483TK-11930E, Gray Violet FX483TK-11703E)',
    workElementType: 'Material',
    type: 'Material',
    description: '',
    _autoFilled: true,
    functions: [
        {
            id: baseFn?.id || randomUUID(),
            description: 'Aportar el hilo de vista con el articulo, la variante de color especificada y la cantidad de cabos segun BOM',
            functionDescription: 'Aportar el hilo de vista con el articulo, la variante de color especificada y la cantidad de cabos segun BOM',
            requirements: '',
            failures: [
                {
                    id: baseFms[0]?.id || randomUUID(),
                    description: 'Color del hilo fuera del patron',
                    failureMode: 'Color del hilo fuera del patron',
                    effectLocal: 'Lote segregado en recepcion',
                    effectNextLevel: 'Costura visible con tono distinto al del tapizado',
                    effectEndUser: 'Defecto de apariencia en la costura vista',
                    severity: 6,
                    occurrence: 3,
                    detection: 4,
                    ap: calculateAP(6, 3, 4) || 'L',
                    actionPriority: calculateAP(6, 3, 4) || 'L',
                    causes: [
                        {
                            id: baseFms[0]?.causes?.[0]?.id || randomUUID(),
                            cause: 'Partida del proveedor con variacion de tono',
                            description: 'Partida del proveedor con variacion de tono',
                            severity: 6,
                            occurrence: 3,
                            detection: 7,
                            ap: calculateAP(6, 3, 7) || 'M',
                            actionPriority: calculateAP(6, 3, 7) || 'M',
                            specialChar: '',
                            preventionControl: 'Verificacion segun P-14',
                            detectionControl: 'Inspeccion visual con patron de color, 1 muestra por lote (P-10/I, planes de recepcion 1062 / 1063 / 1064)',
                            preventionAction: '',
                            detectionAction: '',
                            optimizationAction: '',
                            responsible: '',
                            targetDate: '',
                            status: '',
                            _autoFilled: true
                        }
                    ]
                },
                {
                    id: baseFms[1]?.id || randomUUID(),
                    description: 'Cantidad de cabos distinta a la especificada',
                    failureMode: 'Cantidad de cabos distinta a la especificada',
                    effectLocal: 'Lote segregado en recepcion',
                    effectNextLevel: 'Resistencia de la costura fuera de lo previsto',
                    effectEndUser: 'Costura que se abre en uso',
                    severity: 7,
                    occurrence: 2,
                    detection: 5,
                    ap: calculateAP(7, 2, 5) || 'M',
                    actionPriority: calculateAP(7, 2, 5) || 'M',
                    causes: [
                        {
                            id: baseFms[1]?.causes?.[0]?.id || randomUUID(),
                            cause: 'Error de preparacion del pedido en el proveedor',
                            description: 'Error de preparacion del pedido en el proveedor',
                            severity: 7,
                            occurrence: 2,
                            detection: 7,
                            ap: calculateAP(7, 2, 7) || 'M',
                            actionPriority: calculateAP(7, 2, 7) || 'M',
                            specialChar: '',
                            preventionControl: 'Verificacion segun P-14',
                            detectionControl: 'Inspeccion visual, 1 muestra por lote (P-10/I, planes de recepcion 1062 / 1063 / 1064)',
                            preventionAction: '',
                            detectionAction: '',
                            optimizationAction: '',
                            responsible: '',
                            targetDate: '',
                            status: '',
                            _autoFilled: true
                        }
                    ]
                },
                {
                    id: baseFms[2]?.id || randomUUID(),
                    description: 'Articulo entregado distinto al pedido',
                    failureMode: 'Articulo entregado distinto al pedido',
                    effectLocal: 'Lote segregado en recepcion',
                    effectNextLevel: 'Hilo equivocado montado en la maquina de costura',
                    effectEndUser: 'Costura con hilo que no corresponde a la variante de la pieza',
                    severity: 6,
                    occurrence: 3,
                    detection: 5,
                    ap: calculateAP(6, 3, 5) || 'L',
                    actionPriority: calculateAP(6, 3, 5) || 'L',
                    causes: [
                        {
                            id: baseFms[2]?.causes?.[0]?.id || randomUUID(),
                            cause: 'Error de despacho del proveedor',
                            description: 'Error de despacho del proveedor',
                            severity: 6,
                            occurrence: 3,
                            detection: 5,
                            ap: calculateAP(6, 3, 5) || 'L',
                            actionPriority: calculateAP(6, 3, 5) || 'L',
                            specialChar: '',
                            preventionControl: 'Verificacion segun P-14',
                            detectionControl: 'Verificacion de la etiqueta del material contra orden de compra, 1 muestra por lote (P-10/I, planes de recepcion 1062 / 1063 / 1064)',
                            preventionAction: '',
                            detectionAction: '',
                            optimizationAction: '',
                            responsible: '',
                            targetDate: '',
                            status: '',
                            _autoFilled: true
                        }
                    ]
                },
                {
                    id: baseFms[3]?.id || randomUUID(),
                    description: 'Flamabilidad del hilo fuera de especificacion',
                    failureMode: 'Flamabilidad del hilo fuera de especificacion',
                    effectLocal: 'Lote no conforme, material a segregar',
                    effectNextLevel: 'Rechazo del ensayo de flamabilidad del conjunto',
                    effectEndUser: 'Riesgo para la seguridad del usuario del vehiculo',
                    severity: 9,
                    occurrence: 3,
                    detection: 5,
                    ap: calculateAP(9, 3, 5) || 'M',
                    actionPriority: calculateAP(9, 3, 5) || 'M',
                    causes: [
                        {
                            id: baseFms[3]?.causes?.[0]?.id || randomUUID(),
                            cause: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                            description: 'Lote del proveedor sin ensayo de flamabilidad conforme',
                            severity: 9,
                            occurrence: 3,
                            detection: 5,
                            ap: calculateAP(9, 3, 5) || 'M',
                            actionPriority: calculateAP(9, 3, 5) || 'M',
                            specialChar: '',
                            preventionControl: 'Certificado del proveedor por lote (P-14)',
                            detectionControl: 'Certificado del proveedor conforme Norma VW 50106, anual (P-10/I y ARB, planes de recepcion 1062 / 1063 / 1064)',
                            preventionAction: '',
                            detectionAction: '',
                            optimizationAction: '',
                            responsible: '',
                            targetDate: '',
                            status: '',
                            _autoFilled: true
                        }
                    ]
                }
            ]
        }
    ]
};

// Encontrar el indice del primer hilo viejo para insertar en esa posicion
const idxPrimero = op10.workElements.findIndex(we => {
    const n = we.workElementName || we.name || '';
    return n.includes('Hilo vista 20/3') || n.includes('FX483TK');
});

// Filtrar hilos viejos
op10.workElements = op10.workElements.filter(we => {
    const n = we.workElementName || we.name || '';
    return !(n.includes('Hilo vista 20/3') || n.includes('FX483TK'));
});

// Insertar el unificado en la posicion correcta
if (idxPrimero >= 0) {
    op10.workElements.splice(idxPrimero, 0, weUnificado);
} else {
    op10.workElements.push(weUnificado);
}

logChange(apply, 'AMFE-INS-PAT: Unificacion de 3 hilos de vista en un solo WorkElement multicroma (Jet Black, Alpe Gray, Gray Violet)');

const plan = [{ id: row.id, amfeNumber: 'AMFE-INS-PAT', productName: doc.productName, before: antes, after: doc }];

await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: 'AMFE-INS-PAT' });
    console.log('   ✓ Guardado en Supabase: AMFE-INS-PAT');
    fs.writeFileSync('tmp/amfe_ins_pat_live.json', JSON.stringify(doc, null, 2), 'utf-8');
    console.log('   ✓ Actualizado tmp/amfe_ins_pat_live.json');
});

finish(apply);
