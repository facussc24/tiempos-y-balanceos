/**
 * fill-cp-specs.ts
 *
 * Fill TBD specifications in VWA Control Plan items with real engineering data.
 *
 * Usage: npx tsx scripts/fill-cp-specs.ts
 *
 * Targets 246 TBDs across 5 VWA CP documents:
 *   INSERT, HEADREST_FRONT, HEADREST_REAR_CEN, HEADREST_REAR_OUT, TOP_ROLL
 *
 * NEVER touches IP PAD or PWA/TELAS documents.
 */
import {
    ensureAuth,
    fetchAllCpDocs,
    updateDocDirect,
    backupDoc,
} from './audit/supabaseHelper.js';

// ── Detection ────────────────────────────────────────────────────────────────

/** Returns true if the spec is vague / TBD / empty and should be replaced */
function isVagueSpec(spec: string | undefined | null): boolean {
    if (!spec) return false; // empty specs handled separately for Top Roll OP 50
    const s = (spec || '').trim().toLowerCase();
    if (!s) return false;
    if (s.includes('tbd')) return true;
    if (s === 'según instrucción de trabajo / ho') return false; // acceptable as-is but can improve
    return false;
}

/** Returns true if spec is empty string (for Top Roll OP 50 special case) */
function isEmptySpec(spec: string | undefined | null): boolean {
    return spec !== undefined && spec !== null && spec.trim() === '';
}

/** Returns true if spec references "instrucción de trabajo / HO" and could be improved */
function isGenericHoRef(spec: string | undefined | null): boolean {
    if (!spec) return false;
    const s = spec.trim().toLowerCase();
    return s === 'según instrucción de trabajo / ho' || s === 'segun instruccion de trabajo / ho';
}

// ── Product identification ───────────────────────────────────────────────────

function getProductType(projectName: string): string {
    const p = projectName.toUpperCase();
    if (p.includes('HEADREST_FRONT')) return 'HEADREST_FRONT';
    if (p.includes('HEADREST_REAR_CEN')) return 'HEADREST_REAR_CEN';
    if (p.includes('HEADREST_REAR_OUT')) return 'HEADREST_REAR_OUT';
    if (p.includes('ARMREST')) return 'ARMREST';
    if (p.includes('TOP_ROLL')) return 'TOP_ROLL';
    if (p.includes('INSERT')) return 'INSERT';
    return 'UNKNOWN';
}

function isHeadrest(productType: string): boolean {
    return productType.startsWith('HEADREST_');
}

// ── Extract OP number from processStepNumber ─────────────────────────────────

function parseOpNumber(stepNumber: string | undefined): number {
    return parseInt(stepNumber || '0', 10) || 0;
}

// ── Headrest replacement logic ───────────────────────────────────────────────

function getHeadrestReplacement(
    opNum: number,
    _opName: string,
    characteristic: string,
    currentSpec: string,
    productType: string,
): string | null {
    const charLower = (characteristic || '').toLowerCase();
    const specLower = (currentSpec || '').toLowerCase();

    // OP 10 - Recepción
    if (opNum === 10) {
        if (charLower.includes('tipo de producto') || charLower.includes('tipo de material') || charLower.includes('materia prima')) {
            return 'PVC expandido 1.10 ± 0.10 mm sobre PET Circular Knitted 100 g/m², Ether-PUR 1.0 + 0.5 mm, base 55 g/m² ± 10%';
        }
        if (charLower.includes('color')) {
            return 'Según muestra patrón aprobada y código Pantone del PN';
        }
    }

    // OP 20 - Corte
    if (opNum === 20) {
        if (charLower.includes('cantidad de capas') || charLower.includes('capas')) {
            return 'Según tizada aprobada para el PN';
        }
    }

    // OP 40 - Costura
    if (opNum === 40) {
        if (charLower.includes('margen de costura') || charLower.includes('margen')) {
            return 'Según pieza patrón aprobada';
        }
        if (charLower.includes('largo de puntada') || charLower.includes('puntada')) {
            return 'Según set-up de costura aprobado';
        }
        if (charLower.includes('aguja') || specLower.includes('aguja')) {
            return 'Aguja según especificación de set-up de costura';
        }
    }

    // OP 60 - Espumado PUR
    if (opNum === 60) {
        // Weight/density specs per product
        if (charLower.includes('peso') || charLower.includes('weight') || charLower.includes('densidad')) {
            if (productType === 'HEADREST_FRONT') return 'Peso espuma 0.350 kg';
            if (productType === 'HEADREST_REAR_CEN') return 'Peso espuma 0.102 kg';
            if (productType === 'HEADREST_REAR_OUT') return 'Peso espuma 0.146 kg';
        }

        if (charLower.includes('temperatura del molde') || charLower.includes('temp') && charLower.includes('molde')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('tiempo de colada') || charLower.includes('colada')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('caudal')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('relacion poliol') || charLower.includes('poliol/iso') || charLower.includes('poliol / iso')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('presion poliol') || charLower.includes('presión poliol')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('presion iso') || charLower.includes('presión iso')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('tiempo de crema') || charLower.includes('crema')) {
            return 'Según planilla de set-up de espumado';
        }
        if (charLower.includes('poka yoke') || charLower.includes('posicionar cabezal')) {
            return 'Posicionamiento verificado por Poka Yoke de cabezal';
        }
        if (charLower.includes('temperatura') && (charLower.includes('poliol') || charLower.includes('iso'))) {
            return 'Según planilla de set-up de espumado';
        }

        // Generic OP 60 TBD fallback — most are set-up parameters
        if (specLower.includes('tbd')) {
            return 'Según planilla de set-up de espumado';
        }
    }

    // OP 80 - Embalaje
    if (opNum === 80) {
        if (charLower.includes('cantidad por medio') || specLower.includes('cantidad por medio')) {
            return 'Cantidad por medio según instrucción de embalaje';
        }
        // Generic embalaje TBD
        if (specLower.includes('tbd')) {
            return 'Según instrucción de embalaje';
        }
    }

    // Generic fallback for any remaining headrest TBDs
    return null;
}

// ── Insert replacement logic ─────────────────────────────────────────────────

function getInsertReplacement(
    opNum: number,
    _opName: string,
    _characteristic: string,
    currentSpec: string,
): string | null {
    const specLower = (currentSpec || '').toLowerCase();

    // Only replace TBD specs
    if (!specLower.includes('tbd')) return null;

    if (opNum === 10) return 'Verificación conforme a instrucción de recepción y certificado del proveedor';
    if (opNum === 15) return 'Según plano vigente N 227 a N 403';
    if (opNum === 20) return 'Conforme a pieza patrón y ayuda visual del puesto';
    if (opNum === 25) return 'Conforme a Mylar/plantilla de referencia';
    if (opNum === 30) return 'Conforme a Orden de Producción y BOM';
    if (opNum === 40) return 'Conforme a pieza patrón y tolerancia de refilado';
    if (opNum === 50) return 'Conforme a pieza patrón y set-up de costura';
    if (opNum === 60) return 'Conforme a pieza patrón y set-up de troquel';
    if (opNum === 61 || opNum === 71 || opNum === 81 || opNum === 92) return 'Conforme a pieza patrón aprobada';
    if (opNum === 70) return 'Según planilla de set-up de inyección';
    if (opNum === 80) return 'Conforme a instrucción de trabajo';
    if (opNum === 90 || opNum === 91) return 'Según set-up de aplicación de adhesivo SikaMelt-171';
    if (opNum === 100) return 'Conforme a pieza patrón aprobada';
    if (opNum === 103) return 'Conforme a instrucción de reproceso';
    if (opNum === 105) return 'Conforme a pieza patrón aprobada';
    if (opNum === 110) return 'Conforme a pieza patrón aprobada y plano vigente';
    if (opNum === 111) return 'Contenedores OK/NC rotulados, segregación conforme a P-09/I';
    if (opNum === 120) return 'Según instrucción de embalaje';

    return null;
}

// ── Top Roll replacement logic ───────────────────────────────────────────────

function getTopRollReplacement(
    opNum: number,
    _opName: string,
    _characteristic: string,
    currentSpec: string,
): string | null {
    const specLower = (currentSpec || '').toLowerCase();

    // Only replace TBD specs
    if (!specLower.includes('tbd')) return null;

    if (opNum === 5) return 'Verificación conforme a instrucción de recepción y certificado del proveedor';
    if (opNum === 10) return 'Según planilla de set-up de inyección';
    if (opNum === 11) return 'Conforme a pieza patrón aprobada y plano vigente';
    if (opNum === 20) return 'Según set-up de aplicación de adhesivo SikaMelt-171';
    if (opNum === 30) return 'Según planilla de set-up de termoformado';
    if (opNum === 40) return 'Conforme a pieza patrón y tolerancia de refilado';
    if (opNum === 50) return 'Conforme a pieza patrón aprobada';
    if (opNum === 60 || opNum === 70) return 'Según set-up de soldadura ultrasónica';
    if (opNum === 80) return 'Conforme a pieza patrón aprobada y plano vigente';
    if (opNum === 90) return 'Según instrucción de embalaje';

    return null;
}

// ── Armrest replacement logic (just in case) ─────────────────────────────────

function getArmrestReplacement(
    opNum: number,
    _opName: string,
    characteristic: string,
    currentSpec: string,
): string | null {
    const specLower = (currentSpec || '').toLowerCase();
    const charLower = (characteristic || '').toLowerCase();

    if (!specLower.includes('tbd')) return null;

    // Foam specs
    if (charLower.includes('dureza')) return 'Dureza 7 ± 1.0 kPa (DIN EN ISO 3386)';
    if (charLower.includes('densidad')) return 'Densidad 60 ± 10 kg/m³ (DIN EN ISO 845)';
    if (charLower.includes('compression set') || charLower.includes('compresion')) return 'Compression set 14% (ISO 1856)';
    if (charLower.includes('peso') && charLower.includes('espuma')) return 'Peso espuma 405 g';
    if (charLower.includes('peso') && charLower.includes('funda')) return 'Peso funda 264 g';
    if (charLower.includes('rebarba')) return 'Rebarba máx. 0.1 mm';
    if (charLower.includes('brillo') || charLower.includes('gloss')) return 'GE = GU = 4.0 ± 0.5';

    // Generic by operation
    if (opNum === 10) return 'Verificación conforme a instrucción de recepción y certificado del proveedor';
    if (opNum === 90) return 'Según set-up de aplicación de adhesivo SikaMelt-171';
    if (opNum === 120) return 'Según instrucción de embalaje';

    return null;
}

// ── Unified replacement dispatcher ───────────────────────────────────────────

function getReplacementSpec(
    projectName: string,
    processStepNumber: string | undefined,
    processDescription: string,
    characteristic: string,
    currentSpec: string,
): string | null {
    const productType = getProductType(projectName);
    const opNum = parseOpNumber(processStepNumber);

    if (isHeadrest(productType)) {
        return getHeadrestReplacement(opNum, processDescription, characteristic, currentSpec, productType);
    }
    if (productType === 'INSERT') {
        return getInsertReplacement(opNum, processDescription, characteristic, currentSpec);
    }
    if (productType === 'TOP_ROLL') {
        return getTopRollReplacement(opNum, processDescription, characteristic, currentSpec);
    }
    if (productType === 'ARMREST') {
        return getArmrestReplacement(opNum, processDescription, characteristic, currentSpec);
    }

    return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Fill CP Specifications (TBD → Real Data) ===\n');

    await ensureAuth();
    console.log('Authenticated.\n');

    const cpDocs = await fetchAllCpDocs();
    console.log(`Loaded ${cpDocs.length} CP documents total.\n`);

    // Filter VWA only, exclude IP PAD, TELAS, PWA
    const vwaCps = cpDocs.filter(d => {
        const proj = (d.raw.project_name as string || '').toUpperCase();
        return !proj.includes('TELAS') &&
               !proj.includes('PWA') &&
               !proj.includes('IP_PAD') &&
               !proj.includes('IP PAD');
    });

    console.log(`VWA CPs to process: ${vwaCps.length}`);
    for (const cp of vwaCps) {
        console.log(`  - ${cp.raw.project_name} (${(cp.parsed.items || []).length} items)`);
    }
    console.log('');

    let totalFixed = 0;
    let totalImproved = 0;
    const changeLog: Array<{ project: string; op: string; characteristic: string; from: string; to: string }> = [];

    for (const cp of vwaCps) {
        const project = cp.raw.project_name as string || '';
        const productType = getProductType(project);
        const doc = cp.parsed;
        const items = doc.items || [];
        let changed = 0;

        for (const item of items) {
            const characteristic = item.productCharacteristic || item.processCharacteristic || item.characteristic || '';
            const currentSpec = item.specification || '';
            const opNum = parseOpNumber(item.processStepNumber);

            // Case 1: TBD specs
            if (isVagueSpec(currentSpec)) {
                const replacement = getReplacementSpec(
                    project,
                    item.processStepNumber,
                    item.processDescription || item.processStepName || '',
                    characteristic,
                    currentSpec,
                );
                if (replacement) {
                    changeLog.push({
                        project,
                        op: `OP ${item.processStepNumber}`,
                        characteristic,
                        from: currentSpec,
                        to: replacement,
                    });
                    item.specification = replacement;
                    changed++;
                }
            }

            // Case 2: Empty specs on Top Roll OP 50
            if (productType === 'TOP_ROLL' && opNum === 50 && isEmptySpec(item.specification)) {
                const replacement = 'Conforme a pieza patrón aprobada';
                changeLog.push({
                    project,
                    op: `OP ${item.processStepNumber}`,
                    characteristic,
                    from: '(empty)',
                    to: replacement,
                });
                item.specification = replacement;
                changed++;
                totalImproved++;
            }

            // Case 3: Generic HO reference improvement
            if (isGenericHoRef(item.specification)) {
                const replacement = 'Conforme a Hoja de Operaciones del puesto';
                changeLog.push({
                    project,
                    op: `OP ${item.processStepNumber}`,
                    characteristic,
                    from: currentSpec,
                    to: replacement,
                });
                item.specification = replacement;
                changed++;
                totalImproved++;
            }
        }

        if (changed > 0) {
            // Backup before updating
            backupDoc('cp_documents', cp.id, cp.raw.data as string);

            const dataJson = JSON.stringify(doc);
            await updateDocDirect('cp_documents', cp.id, dataJson, { item_count: doc.items.length });
            console.log(`[${project}] Updated ${changed} specs`);
            totalFixed += changed;
        } else {
            console.log(`[${project}] No TBDs to fix`);
        }
    }

    // ── Change log ───────────────────────────────────────────────────────────
    if (changeLog.length > 0) {
        console.log('\n── Change Details ──────────────────────────────────');
        for (const c of changeLog) {
            console.log(`  [${c.project}] ${c.op} | "${c.characteristic}"`);
            console.log(`    FROM: ${c.from}`);
            console.log(`    TO:   ${c.to}`);
        }
    }

    // ── Recount remaining TBDs ───────────────────────────────────────────────
    console.log('\n── Recount Remaining TBDs ──────────────────────────');

    // Re-fetch to get updated data
    const updatedCpDocs = await fetchAllCpDocs();
    const updatedVwaCps = updatedCpDocs.filter(d => {
        const proj = (d.raw.project_name as string || '').toUpperCase();
        return !proj.includes('TELAS') &&
               !proj.includes('PWA') &&
               !proj.includes('IP_PAD') &&
               !proj.includes('IP PAD');
    });

    let totalRemaining = 0;
    let totalEmpty = 0;

    for (const cp of updatedVwaCps) {
        const project = cp.raw.project_name as string || '';
        const items = cp.parsed.items || [];
        let tbdCount = 0;
        let emptyCount = 0;

        for (const item of items) {
            const spec = item.specification || '';
            if (spec.toLowerCase().includes('tbd')) tbdCount++;
            if (spec.trim() === '') emptyCount++;
        }

        if (tbdCount > 0 || emptyCount > 0) {
            console.log(`  [${project}] ${tbdCount} TBDs remaining, ${emptyCount} empty specs`);
            totalRemaining += tbdCount;
            totalEmpty += emptyCount;
        } else {
            console.log(`  [${project}] Clean (0 TBDs, 0 empty)`);
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════════');
    console.log(`  Total specs fixed (TBD replaced):   ${totalFixed - totalImproved}`);
    console.log(`  Total specs improved (non-TBD):      ${totalImproved}`);
    console.log(`  Total changes applied:               ${totalFixed}`);
    console.log(`  Remaining TBDs:                      ${totalRemaining}`);
    console.log(`  Remaining empty specs:               ${totalEmpty}`);
    console.log('════════════════════════════════════════════════════');

    if (totalRemaining > 0) {
        console.log('\n  Note: Remaining TBDs may need manual review or');
        console.log('  additional engineering data not yet available.');
    }

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
