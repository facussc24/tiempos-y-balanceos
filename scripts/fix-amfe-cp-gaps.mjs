/**
 * Fix AMFE→CP gaps: Find AMFE failure modes without CP items
 * and create the missing CP items + HO qcItems.
 *
 * Usage: node scripts/fix-amfe-cp-gaps.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://fbfsbbewmgoegjgnkkag.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseData(raw) {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function login() {
    const { error } = await supabase.auth.signInWithPassword({
        email: 'admin@barack.com',
        password: 'U3na%LNSYVmVCYvP',
    });
    if (error) throw new Error(`Auth failed: ${error.message}`);
    console.log('✓ Authenticated\n');
}

async function loadAllDocs() {
    const [amfeRes, cpRes, hoRes] = await Promise.all([
        supabase.from('amfe_documents').select('id, project_name, part_number, data'),
        supabase.from('cp_documents').select('id, project_name, part_number, data'),
        supabase.from('ho_documents').select('id, linked_cp_project, data'),
    ]);
    if (amfeRes.error) throw amfeRes.error;
    if (cpRes.error) throw cpRes.error;
    if (hoRes.error) throw hoRes.error;
    return { amfes: amfeRes.data, cps: cpRes.data, hos: hoRes.data };
}

/** Find AMFE failure modes NOT covered by any CP item */
function findGaps(amfeData, cpData) {
    const gaps = [];
    if (!amfeData?.operations || !cpData?.items) return gaps;

    // Build set of failure IDs already covered by CP
    const coveredFailureIds = new Set();
    for (const item of cpData.items) {
        if (item.amfeFailureId) coveredFailureIds.add(item.amfeFailureId);
        for (const fid of (item.amfeFailureIds ?? [])) coveredFailureIds.add(fid);
    }

    // Also check by characteristic text match (some items linked without amfeFailureId)
    const existingChars = new Set();
    for (const item of cpData.items) {
        const prodChar = (item.productCharacteristic || '').toLowerCase().trim();
        const procChar = (item.processCharacteristic || '').toLowerCase().trim();
        if (prodChar) existingChars.add(prodChar);
        if (procChar) existingChars.add(procChar);
    }

    for (const op of amfeData.operations) {
        // Use opNumber (actual field name in DB)
        const opNum = op.opNumber || op.operationNumber || '';
        const opName = op.name || op.operationName || '';

        for (const we of (op.workElements ?? [])) {
            for (const fn of (we.functions ?? [])) {
                for (const fail of (fn.failures ?? [])) {
                    if (coveredFailureIds.has(fail.id)) continue;

                    // Check fuzzy match by failure description
                    const failDesc = (fail.description || '').toLowerCase().trim();
                    if (existingChars.has(failDesc)) continue;

                    const causes = fail.causes ?? [];
                    const highestAp = causes.reduce((best, c) => {
                        const ap = (c.actionPriority || '').toUpperCase();
                        if (ap === 'H') return 'H';
                        if (ap === 'M' && best !== 'H') return 'M';
                        if (best) return best;
                        return ap || 'L';
                    }, '') || 'L';

                    const highestSev = causes.reduce((max, c) => {
                        const sv = Number(c.severity) || 0;
                        return sv > max ? sv : max;
                    }, 0);

                    const preventions = [...new Set(causes.map(c => c.preventionControl).filter(Boolean))];
                    const detections = [...new Set(causes.map(c => c.detectionControl).filter(Boolean))];

                    gaps.push({
                        opNumber: opNum,
                        opName: opName,
                        failureId: fail.id,
                        failureDescription: fail.description,
                        ap: highestAp,
                        severity: highestSev,
                        causeIds: causes.map(c => c.id),
                        preventionControls: preventions,
                        detectionControls: detections,
                    });
                }
            }
        }
    }
    return gaps;
}

/** Create a CP item from a gap */
function createCpItem(gap, cpData) {
    let classification = '';
    if (gap.severity >= 9) classification = 'CC';
    else if (gap.severity >= 7) classification = 'SC';

    // Reuse existing operation info from CP
    const existingOpItem = cpData.items.find(
        i => (i.processStepNumber || '').trim() === (gap.opNumber || '').trim()
    );
    const processDesc = existingOpItem?.processDescription || gap.opName || '';
    const machineTool = existingOpItem?.machineDeviceTool || 'N/A';

    return {
        id: randomUUID(),
        processStepNumber: gap.opNumber,
        processDescription: processDesc,
        machineDeviceTool: machineTool,
        componentMaterial: '', // general controls, no specific material
        characteristicNumber: '',
        productCharacteristic: gap.failureDescription,
        processCharacteristic: '',
        specialCharClass: classification,
        specification: inferSpecification(gap),
        evaluationTechnique: gap.preventionControls.join(' / ') || 'Inspección visual',
        sampleSize: '100%',
        sampleFrequency: 'Cada recepción',
        controlMethod: gap.detectionControls.join(' / ') || 'Inspección visual',
        reactionPlan: 'Segregar lote, notificar según P-09/I',
        reactionPlanOwner: 'Recepción de materiales',
        controlProcedure: '',
        amfeCauseIds: gap.causeIds,
        amfeFailureId: gap.failureId,
        amfeFailureIds: [gap.failureId],
        amfeAp: gap.ap,
        amfeSeverity: gap.severity,
        operationCategory: 'recepcion',
        autoFilledFields: ['evaluationTechnique', 'controlMethod', 'reactionPlan', 'reactionPlanOwner', 'sampleFrequency'],
    };
}

function inferSpecification(gap) {
    const desc = (gap.failureDescription || '').toLowerCase();
    if (desc.includes('color')) return 'Según orden de producción y muestras patrón';
    if (desc.includes('documentación') || desc.includes('trazabilidad')) return 'Remito completo, certificados vigentes, trazabilidad de lote';
    if (desc.includes('contaminación') || desc.includes('suciedad')) return 'Material limpio, sin contaminantes visibles ni residuos';
    if (desc.includes('flamabilidad')) return 'Según TL 1010 VW';
    return 'Según especificación de proceso';
}

/** Create HO qcItem from CP item */
function createHoQcItem(cpItem) {
    return {
        id: randomUUID(),
        cpItemId: cpItem.id,
        characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic,
        controlMethod: cpItem.controlMethod,
        frequency: cpItem.sampleFrequency,
        responsible: cpItem.reactionPlanOwner,
        specification: cpItem.specification,
        reactionPlan: cpItem.reactionPlan,
    };
}

/** Match AMFE↔CP↔HO by project_name */
function matchDocSets(amfes, cps, hos) {
    const sets = [];
    for (const amfe of amfes) {
        const pn = amfe.project_name;
        const cp = cps.find(c => c.project_name === pn);
        const ho = hos.find(h => h.linked_cp_project === pn);
        if (cp) {
            sets.push({ amfe, cp, ho, projectName: pn });
        }
    }
    return sets;
}

async function main() {
    await login();
    const { amfes, cps, hos } = await loadAllDocs();
    console.log(`Loaded: ${amfes.length} AMFEs, ${cps.length} CPs, ${hos.length} HOs`);

    const sets = matchDocSets(amfes, cps, hos);
    console.log(`Matched: ${sets.length} AMFE↔CP pairs by project_name\n`);

    let totalGaps = 0;
    let totalCpCreated = 0;
    let totalHoCreated = 0;

    for (const { amfe, cp, ho, projectName } of sets) {
        const amfeData = parseData(amfe.data);
        const cpData = parseData(cp.data);

        const gaps = findGaps(amfeData, cpData);

        if (gaps.length === 0) {
            console.log(`✓ ${projectName}: 0 gaps`);
            continue;
        }

        console.log(`\n⚠ ${projectName}: ${gaps.length} gaps`);
        totalGaps += gaps.length;

        const newCpItems = gaps.map(g => createCpItem(g, cpData));
        for (const item of newCpItems) {
            console.log(`  + OP ${item.processStepNumber} — "${item.productCharacteristic}" [AP=${item.amfeAp}, S=${item.amfeSeverity}]`);
        }

        // Update CP
        const updatedCpData = { ...cpData, items: [...cpData.items, ...newCpItems] };
        // Must stringify back since DB stores as string
        const { error: cpErr } = await supabase
            .from('cp_documents')
            .update({ data: JSON.stringify(updatedCpData) })
            .eq('id', cp.id);

        if (cpErr) {
            console.error(`  ✗ CP update failed: ${cpErr.message}`);
            continue;
        }
        totalCpCreated += newCpItems.length;
        console.log(`  ✓ ${newCpItems.length} CP items added`);

        // Update HO — add qcItems for OP 10 gaps
        if (ho) {
            const hoData = parseData(ho.data);
            const op10Sheet = hoData.sheets?.find(sh =>
                (sh.operationNumber || '').trim() === '10' ||
                (sh.linkedCpOperationNumber || '').trim() === '10'
            );

            if (op10Sheet) {
                const op10CpItems = newCpItems.filter(i => (i.processStepNumber || '').trim() === '10');
                const existingChars = new Set(
                    (op10Sheet.qcItems || []).map(q => (q.characteristic || '').toLowerCase().trim())
                );
                const newQcs = op10CpItems
                    .map(ci => createHoQcItem(ci))
                    .filter(q => !existingChars.has((q.characteristic || '').toLowerCase().trim()));

                if (newQcs.length > 0) {
                    op10Sheet.qcItems = [...(op10Sheet.qcItems || []), ...newQcs];

                    const { error: hoErr } = await supabase
                        .from('ho_documents')
                        .update({ data: JSON.stringify(hoData) })
                        .eq('id', ho.id);

                    if (hoErr) {
                        console.error(`  ✗ HO update failed: ${hoErr.message}`);
                    } else {
                        totalHoCreated += newQcs.length;
                        console.log(`  ✓ ${newQcs.length} HO qcItems added to OP 10`);
                    }
                }
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESUMEN:`);
    console.log(`  Productos analizados: ${sets.length}`);
    console.log(`  Gaps encontrados: ${totalGaps}`);
    console.log(`  CP items creados: ${totalCpCreated}`);
    console.log(`  HO qcItems creados: ${totalHoCreated}`);
}

main().catch(console.error);
