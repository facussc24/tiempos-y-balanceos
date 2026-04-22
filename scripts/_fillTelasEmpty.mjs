/**
 * _fillTelasEmpty.mjs — Llena campos vacios de Telas Planas y Termoformadas
 * que se ven como celdas en blanco en UI/export. NO toca campos prohibidos:
 *   - specialChar (CC/SC): solo Fak
 *   - preventionAction / detectionAction / responsible / targetDate / status /
 *     observations (acciones): solo equipo APQP
 *
 * Campos que SI completa:
 *   - header.applicableParts (si esta vacio) = header.partNumber
 *   - op.machineDeviceTool (si missing) = inferido del primer WE tipo Machine, o nombre de op
 *   - op.responsible (si missing) = rol generico por tipo de operacion
 *   - op.productLocation (si missing) = "Linea de produccion"
 *
 * Pasa por runWithValidation() — bloquea si el cambio introduce criticos.
 *
 * Uso:
 *   node scripts/_fillTelasEmpty.mjs           # dry-run, muestra preview
 *   node scripts/_fillTelasEmpty.mjs --apply   # aplica
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();

const TARGETS = [
    { id: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5', label: 'TELAS_PLANAS' },
    { id: 'c5201ba9-1225-4663-b7a1-5430f9ee8912', label: 'TELAS_TERMOFORMADAS' },
];

const sb = await connectSupabase();

/**
 * Infiere el responsable generico a partir del nombre/categoria de la operacion.
 * Usa roles estandar Barack (ver .claude/rules/control-plan.md).
 */
function inferResponsible(opName) {
    const u = (opName || '').toUpperCase();
    if (u.includes('CONTROL FINAL') || u.includes('INSPECCION FINAL') || u.includes('CONTROL DE CALIDAD')) return 'Inspector de Calidad';
    if (u.includes('RECEPCION')) return 'Inspector de Calidad';
    if (u.includes('EMBALAJE') || u.includes('ALMACENAMIENTO')) return 'Operador de produccion';
    if (u.includes('REPROCESO') || u.includes('CORRECCION')) return 'Operador de produccion';
    return 'Operador de produccion';
}

/**
 * Infiere productLocation a partir del nombre de la operacion.
 */
function inferLocation(opName) {
    const u = (opName || '').toUpperCase();
    if (u.includes('RECEPCION')) return 'Sector de recepcion';
    if (u.includes('EMBALAJE')) return 'Sector de embalaje';
    if (u.includes('ALMACENAMIENTO')) return 'Almacen de producto terminado';
    if (u.includes('CONTROL FINAL') || u.includes('INSPECCION FINAL')) return 'Sector de control final';
    return 'Linea de produccion';
}

/**
 * Infiere machineDeviceTool a partir de los WEs de la operacion.
 * Busca el primer WE tipo Machine. Si no hay, usa texto generico.
 */
function inferMachine(op) {
    const wes = op.workElements || [];
    const machineWe = wes.find(we => String(we.type || '').toLowerCase() === 'machine');
    if (machineWe) return machineWe.name;
    // Fallback: nombre generico segun operacion
    const u = (op.name || op.operationName || '').toUpperCase();
    if (u.includes('RECEPCION')) return 'Area de recepcion';
    if (u.includes('EMBALAJE')) return 'Estacion de embalaje';
    if (u.includes('ALMACEN')) return 'Estanteria / rack';
    if (u.includes('CONTROL')) return 'Mesa de control con iluminacion';
    if (u.includes('PREPARACION')) return 'Mesa de preparacion';
    if (u.includes('PEGADO') || u.includes('APLICACION')) return 'Estacion de trabajo manual';
    if (u.includes('REPROCESO') || u.includes('CORRECCION')) return 'Mesa de retrabajo';
    return 'Estacion de trabajo';
}

const plan = [];

for (const t of TARGETS) {
    const { doc, amfe_number, row } = await readAmfe(sb, t.id);
    const before = JSON.parse(JSON.stringify(doc));
    const after = JSON.parse(JSON.stringify(doc));

    let changes = 0;
    const changeLog = [];

    // 1) header.applicableParts
    if (after.header && (after.header.applicableParts === '' || after.header.applicableParts == null)) {
        if (after.header.partNumber) {
            after.header.applicableParts = after.header.partNumber;
            changeLog.push(`header.applicableParts = "${after.header.partNumber}"`);
            changes++;
        }
    }

    // 2) Para cada op: machineDeviceTool, responsible, productLocation
    for (const op of (after.operations || [])) {
        const opN = op.opNumber || op.operationNumber;
        const opName = op.name || op.operationName || '';

        if (op.machineDeviceTool === undefined || op.machineDeviceTool === null || op.machineDeviceTool === '') {
            const inferred = inferMachine(op);
            op.machineDeviceTool = inferred;
            changeLog.push(`OP${opN} machineDeviceTool = "${inferred}"`);
            changes++;
        }
        if (op.responsible === undefined || op.responsible === null || op.responsible === '') {
            const inferred = inferResponsible(opName);
            op.responsible = inferred;
            changeLog.push(`OP${opN} responsible = "${inferred}"`);
            changes++;
        }
        if (op.productLocation === undefined || op.productLocation === null || op.productLocation === '') {
            const inferred = inferLocation(opName);
            op.productLocation = inferred;
            changeLog.push(`OP${opN} productLocation = "${inferred}"`);
            changes++;
        }
    }

    console.log(`\n=== ${t.label} (${amfe_number}) — ${changes} cambios propuestos ===`);
    for (const line of changeLog.slice(0, 60)) console.log(`  + ${line}`);
    if (changeLog.length > 60) console.log(`  ... ${changeLog.length - 60} mas`);

    if (changes > 0) {
        plan.push({
            id: t.id,
            amfeNumber: amfe_number,
            productName: row.project_name,
            before,
            after,
        });
    }
}

// Pasar por el gate
await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
        await saveAmfe(sb, change.id, change.after, { expectedAmfeNumber: change.amfeNumber });
        console.log(`  ✓ ${change.amfeNumber} saved`);
    }
});

finish(apply);
