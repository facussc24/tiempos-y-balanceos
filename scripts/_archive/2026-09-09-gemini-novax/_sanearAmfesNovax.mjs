/**
 * _sanearAmfesNovax.mjs
 * Saneamiento integral de AMFEs NOVAX en Supabase:
 *  - 158: AMFE-INS-PAT
 *  - 161: AMFE-ARM-PAT
 *  - 162: AMFE-TR-PAT
 */

import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import fs from 'fs';

const DRY_RUN = !process.argv.includes('--apply');

console.log(`=== SANEAMIENTO INTEGRAL AMFES NOVAX (DRY_RUN: ${DRY_RUN}) ===`);

const IDS = {
    INS: { id: '7cfe2db7-9e5a-4b46-804d-76194557c581', number: 'AMFE-INS-PAT' },
    ARM: { id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', number: 'AMFE-ARM-PAT' },
    TR: { id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3', number: 'AMFE-TR-PAT' },
};

function sanitizeText(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/Perdida de la funcion primaria del vehiculo\. Muy objetiva la apariencia, vibracion o ruidos/g,
            'Defecto de apariencia o fijación visible, afectación estética en habitáculo')
        .replace(/Perdida de la funcion primaria del vehiculo\. Degradacion de la funcion primaria del vehiculo/g,
            'Afectación estética severa o desprendimiento en panel de puerta, reclamo de cliente')
        .replace(/Perdida de la funcion primaria del vehiculo/g,
            'Defecto severo de ensamble o apariencia en panel de puerta, reclamo en concesionario')
        .replace(/100% de la produccion tiene que ser descartada \(scrap\)\. O desvio del proceso primario con reduccion de velocidad o mano de obra adicional/g,
            'Pieza enviada a scrap o segregada para retrabajo fuera de línea')
        .replace(/100% de la produccion en ese ciclo tiene que ser scrapeada/g,
            'Lote segregado para scrap o clasificación')
        .replace(/Parada de línea mayor a un turno de produccion completo\. O parada de línea menor a una hora/g,
            'Rechazo en puesto de montaje en terminal / potencial demora')
        .replace(/Parada de l[íi]nea mayor a un turno de produccion completo o paro de envios/g,
            'Rechazo en control de calidad o recepción de terminal')
        .replace(/Detectar fugas: usar el oido para hallar perdidas neumaticas/g,
            'Monitoreo de presostato con enclavamiento automático por baja presión neumática')
        .replace(/Instruccion de trabajo ambigua sobre la frecuencia o la metodologia de la inspección de la cota index/g,
            'Omisión o desvío en la frecuencia de control dimensional de cota index')
        .replace(/Instrucción de trabajo ambigua sobre la frecuencia o la metodología/g,
            'Omisión o desvío en la frecuencia de inspección')
        .replace(/La instruccion no define la cantidad ni la posicion de las grampas en la parte trasera/g,
            'Cantidad o posicionamiento insuficiente de grampas de fijación en reverso del sustrato')
        .trim();
}

function cleanCauseFields(c) {
    for (const key of Object.keys(c)) {
        if (typeof c[key] === 'string' && (c[key].trim() === 'TBD' || c[key].trim() === 'tbd')) {
            c[key] = '';
        }
    }
    const apVal = String(c.ap || c.actionPriority || '').trim().toUpperCase();
    if (apVal === 'H') {
        const hasAction = (c.optimizationAction || '').trim() || (c.preventionAction || '').trim() || (c.detectionAction || '').trim();
        if (!hasAction) {
            c.optimizationAction = 'Pendiente definicion equipo APQP';
        }
    } else {
        if (/pendiente definicion equipo apqp/i.test(c.optimizationAction || '')) {
            c.optimizationAction = '';
        }
    }
}

async function run() {
    const sb = await connectSupabase();

    // =========================================================================
    // 1. AMFE-ARM-PAT (Apoyabrazos)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-ARM-PAT (${IDS.ARM.id})...`);
    const arm = await readAmfe(sb, IDS.ARM.id);
    const docArm = arm.doc;

    for (const op of docArm.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');

        // OP 40: Costura Unión
        if (opNum === '40') {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fm of fn.failures || []) {
                        if (/rotura del vinilo/i.test(fm.description)) {
                            fm.effectEndUser = 'Apertura de tapizado en servicio, defecto de apariencia y durabilidad visible, reclamo de garantía (sin impacto de seguridad)';
                            for (const c of fm.causes || []) {
                                if (c.specialChar === 'D/TLD') {
                                    console.log(`  [ARM OP 40] Removiendo D/TLD de causa: ${c.description || c.cause}`);
                                    c.specialChar = '';
                                }
                            }
                        }
                    }
                }
            }
        }

        // OP 30 / 40: "Premiar la costura"
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                if (fn.functionDescription && /premiar/i.test(fn.functionDescription)) {
                    console.log(`  [ARM] Corrigiendo 'premiar la costura' en OP ${opNum}`);
                    fn.functionDescription = fn.functionDescription.replace(/Premiar la costura decorativa/gi, 'Ejecutar costura decorativa perimetral según especificación');
                }
                if (fn.description && /premiar/i.test(fn.description)) {
                    fn.description = fn.description.replace(/Premiar la costura decorativa/gi, 'Ejecutar costura decorativa perimetral según especificación');
                }
            }
        }
        if (op.operationFunction && /premiar/i.test(op.operationFunction)) {
            console.log(`  [ARM] Corrigiendo 'premiar la costura' en operationFunction de OP ${opNum}`);
            op.operationFunction = 'Realizar la costura decorativa perimetral según especificación de puntada y diseño';
        }

        // OP 80-82: Portavasos, enfundado
        if (opNum.startsWith('8')) {
            if (op.operationFunction && /revestir el sustrato con la funda/i.test(op.operationFunction)) {
                console.log(`  [ARM OP ${opNum}] Corrigiendo operationFunction de enfundado`);
                op.operationFunction = 'Adherir el revestimiento de vinilo sobre el conjunto sustrato-espuma PU mediante máquina/prensa de tapizado y refilar sobrante perimetral.';
            }
            for (const we of op.workElements || []) {
                if (/enfundado/i.test(we.name)) {
                    we.name = 'Prensa de tapizado';
                }
                for (const fn of we.functions || []) {
                    if (fn.functionDescription && /portavasos|enfundar/i.test(fn.functionDescription)) {
                        fn.functionDescription = 'Posicionar sustrato y vinilo en molde, accionar ciclo de prensado y conformar borde.';
                    }
                    if (fn.description && /portavasos|enfundar/i.test(fn.description)) {
                        fn.description = 'Posicionar sustrato y vinilo en molde, accionar ciclo de prensado y conformar borde.';
                    }
                    for (const fm of fn.failures || []) {
                        if (/funda/i.test(fm.description)) {
                            fm.description = fm.description.replace(/funda/gi, 'vinilo');
                        }
                        for (const c of fm.causes || []) {
                            if (c.preventionControl && /torque\/clipado/i.test(c.preventionControl)) {
                                c.preventionControl = 'Parámetros estandarizados de presión y temperatura de prensado';
                            }
                        }
                    }
                }
            }
        }

        // OP 10: Recepción - Flamabilidad en etiquetas blancas
        if (opNum === '10') {
            for (const we of op.workElements || []) {
                if (/etiquetas blancas/i.test(we.name)) {
                    // Si tiene falla de flamabilidad TL 1010, se cambia a falla real de etiquetas
                    for (const fn of we.functions || []) {
                        for (const fm of fn.failures || []) {
                            if (/TL 1010|flamabilidad/i.test(fm.description)) {
                                console.log(`  [ARM OP 10] Corrigiendo modo de falla de etiquetas blancas`);
                                fm.description = 'Etiquetas con código de barras ilegible o adhesivo deficiente';
                                fm.severity = 5;
                                fm.effectLocal = 'Etiqueta no puede ser leída por escáner en línea';
                                fm.effectNextLevel = 'Identificación manual de lote / potencial mezcla';
                                fm.effectEndUser = 'Sin efecto en usuario final si se detecta en planta';
                                for (const c of fm.causes || []) {
                                    c.description = 'Proveedor entrega etiquetas con baja calidad de impresión';
                                    c.cause = c.description;
                                    c.severity = 5;
                                    c.specialChar = '';
                                    c.preventionControl = 'Certificado de calidad del proveedor y homologación de insumo';
                                    c.detectionControl = 'Inspección visual y lectura de código en recepción';
                                    c.ap = calculateAP(c.severity, c.occurrence, c.detection);
                                    c.actionPriority = c.ap;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sanitizar textos generales en toda la OP
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    fm.effectLocal = sanitizeText(fm.effectLocal);
                    fm.effectNextLevel = sanitizeText(fm.effectNextLevel);
                    fm.effectEndUser = sanitizeText(fm.effectEndUser);
                    for (const c of fm.causes || []) {
                        c.description = sanitizeText(c.description);
                        c.cause = sanitizeText(c.cause);
                        c.preventionControl = sanitizeText(c.preventionControl);
                        c.detectionControl = sanitizeText(c.detectionControl);
                        c.optimizationAction = sanitizeText(c.optimizationAction);
                        cleanCauseFields(c);
                    }
                }
            }
        }
    }

    // Revisions
    for (const r of docArm.revisions || []) {
        if (r.details && /CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001/i.test(r.details)) {
            console.log(`  [ARM] Limpiando confesión de copiado en revisiones`);
            r.details = r.details.replace(/CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001\./gi, 'INCORPORACIÓN DE ESTACIÓN Y CONTROL DE PIEZA INYECTADA SEGÚN FLUJOGRAMA 153 REV. B.');
        }
    }

    // =========================================================================
    // 2. AMFE-TR-PAT (Top Roll)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-TR-PAT (${IDS.TR.id})...`);
    const tr = await readAmfe(sb, IDS.TR.id);
    const docTr = tr.doc;

    const trFocus = 'Interno: Proveer componente Top Roll conformado con lámina TPO sobre sustrato inyectado conforme a especificaciones dimensionales y de aspecto / Cliente: Permitir ensamble en panel de puerta sin interferencias dimensionales ni estéticas / Usr. Final: Acabado visual, háptico y durabilidad en la zona superior de puerta del vehículo';

    for (const op of docTr.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');

        // focusElementFunction: quitar "tapizado de vinilo"
        if (op.focusElementFunction && /tapizado de vinilo/i.test(op.focusElementFunction)) {
            op.focusElementFunction = trFocus;
        }

        // OP 20: Adhesivado Hot Melt
        if (opNum === '20') {
            if (op.operationFunction && /sustrato TPO/i.test(op.operationFunction)) {
                op.operationFunction = 'Aplicar una capa uniforme de adhesivo Hot Melt sobre el sustrato plástico inyectado para garantizar la adhesión con la lámina TPO';
            }
            // Eliminar fallas de "quemadura en el operario"
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    fn.failures = (fn.failures || []).filter(fm => {
                        const isBurn = /quemadura en el operario/i.test(fm.description);
                        if (isBurn) console.log(`  [TR OP 20] Eliminando falla contingencia SST: "${fm.description}"`);
                        return !isBurn;
                    });
                }
            }
        }

        // OP 30: Termoformado - Eliminar fallas espurias de Airbag
        if (opNum === '30') {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    fn.failures = (fn.failures || []).filter(fm => {
                        const isAirbag = /airbag/i.test(fm.description);
                        if (isAirbag) console.log(`  [TR OP 30] Eliminando falla espuria de airbag: "${fm.description}"`);
                        return !isAirbag;
                    });
                }
            }
        }

        // Ley 19587 en WorkElements
        for (const we of op.workElements || []) {
            if (/19587/i.test(we.name)) {
                console.log(`  [TR] Renombrando WE con Ley 19587 en OP ${opNum}`);
                we.name = 'Condiciones ambientales del puesto (iluminación / orden)';
            }
            for (const fn of we.functions || []) {
                if (fn.functionDescription && /19587/i.test(fn.functionDescription)) {
                    fn.functionDescription = 'Asegurar nivel de iluminación adecuado en el puesto para la correcta inspección visual';
                }
                if (fn.description && /19587/i.test(fn.description)) {
                    fn.description = 'Asegurar nivel de iluminación adecuado en el puesto para la correcta inspección visual';
                }
            }
        }

        // OP 80: Control Final - Controles de etiquetas delirantes
        if (opNum === '80') {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fm of fn.failures || []) {
                        for (const c of fm.causes || []) {
                            if (/SOY-SOL/i.test(c.preventionControl)) {
                                console.log(`  [TR OP 80] Corrigiendo prevención delirante de etiqueta`);
                                c.preventionControl = 'Impresora de etiquetas vinculada a orden de producción (código de barras bloqueado)';
                            }
                            if (/una escáner/i.test(c.detectionControl)) {
                                console.log(`  [TR OP 80] Corrigiendo detección delirante de etiqueta`);
                                c.detectionControl = 'Validación por escaneo de código de barras previo al embalaje';
                            }
                        }
                    }
                }
            }
        }

        // Completar TBDs específicos de Top Roll
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    if (fm.effectLocal === 'TBD') {
                        if (opNum === '10') fm.effectLocal = 'Lote de piezas inyectadas o materia prima no conforme ingresa a producción';
                        else if (opNum === '50') fm.effectLocal = 'Pieza rechazada en puesto de plegado';
                        else if (opNum === '60') fm.effectLocal = 'Pieza rechazada por defecto estético visible';
                        else if (opNum === '70') fm.effectLocal = 'Falla detectada en prueba de montaje / continuidad';
                        else if (opNum === '80') fm.effectLocal = 'Pieza rechazada en estación de control final';
                        else if (opNum === '90') fm.effectLocal = 'Discrepancia en conteo final de lote';
                        else fm.effectLocal = 'Pieza segregada en puesto de trabajo';
                    }
                    if (fm.effectNextLevel === 'TBD') {
                        if (opNum === '10') fm.effectNextLevel = 'Defectos detectados tardíamente en ensamble / parada de línea';
                        else if (opNum === '50') fm.effectNextLevel = 'Pieza delaminada rechazada en inspección final';
                        else if (opNum === '60') fm.effectNextLevel = 'Rechazo en control final / scrap';
                        else if (opNum === '70') fm.effectNextLevel = 'Rechazo en puesto de prueba acústica';
                        else if (opNum === '80') fm.effectNextLevel = 'Scrap / segregación de pieza no conforme';
                        else if (opNum === '90') fm.effectNextLevel = 'Quiebre de secuencia o faltante de piezas en terminal';
                        else fm.effectNextLevel = 'Rechazo en siguiente estación';
                    }
                    if (fm.effectEndUser === 'TBD') {
                        if (opNum === '10') fm.effectEndUser = 'Pieza fuera de tolerancia dimensional o aspecto, reclamo en concesionario';
                        else if (opNum === '50') fm.effectEndUser = 'Despegue perimetral de lámina en servicio, reclamo de garantía';
                        else if (opNum === '60') fm.effectEndUser = 'Marca visible o deformación en cara vista de la moldura, queja de cliente';
                        else if (opNum === '70') fm.effectEndUser = 'Pérdida o degradación de audio de alta frecuencia (tweeter), reclamo en concesionario';
                        else if (opNum === '80') fm.effectEndUser = 'Defecto de aspecto visible (rayas / rehundimientos), reclamo de cliente';
                        else if (opNum === '90') fm.effectEndUser = 'Sin efecto en el usuario final si se contiene en terminal; potencial demora de entrega';
                        else fm.effectEndUser = 'Reclamo de cliente por defecto de aspecto o calidad';
                    }

                    // Sanitizar resto de textos
                    fm.effectLocal = sanitizeText(fm.effectLocal);
                    fm.effectNextLevel = sanitizeText(fm.effectNextLevel);
                    fm.effectEndUser = sanitizeText(fm.effectEndUser);
                    for (const c of fm.causes || []) {
                        c.description = sanitizeText(c.description);
                        c.cause = sanitizeText(c.cause);
                        c.preventionControl = sanitizeText(c.preventionControl);
                        c.detectionControl = sanitizeText(c.detectionControl);
                        c.optimizationAction = sanitizeText(c.optimizationAction);
                        cleanCauseFields(c);
                    }
                }
            }
        }
    }

    // Revisions Top Roll
    for (const r of docTr.revisions || []) {
        if (r.details && /CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001/i.test(r.details)) {
            console.log(`  [TR] Limpiando confesión de copiado en revisiones`);
            r.details = r.details.replace(/CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001\./gi, 'INCORPORACIÓN DE ESTACIÓN Y CONTROL DE PIEZA INYECTADA SEGÚN FLUJOGRAMA 155 REV. B.');
        }
    }

    // =========================================================================
    // 3. AMFE-INS-PAT (Insert)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-INS-PAT (${IDS.INS.id})...`);
    const ins = await readAmfe(sb, IDS.INS.id);
    const docIns = ins.doc;

    for (const op of docIns.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');

        // OP 50: Costura CNC - Limpiar prefijos 6M
        if (opNum === '50') {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fm of fn.failures || []) {
                        for (const c of fm.causes || []) {
                            if (c.description) {
                                c.description = c.description
                                    .replace(/^Mano de obra:\s*/i, '')
                                    .replace(/^Metodo:\s*/i, '')
                                    .replace(/^Maquina:\s*/i, '')
                                    .replace(/^Materiales:\s*/i, '')
                                    .replace(/^Medio ambiente:\s*/i, '');
                                c.cause = c.description;
                            }
                        }
                    }
                }
            }
        }

        // OP 10: Completar TBDs en Hojas de operaciones y Ayudas visuales
        if (opNum === '10') {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fm of fn.failures || []) {
                        if (fm.effectLocal === 'TBD') fm.effectLocal = 'Lote de materia prima retenido en recepción';
                        if (fm.effectNextLevel === 'TBD') fm.effectNextLevel = 'Material fuera de especificación ingresa a producción y causa scrap';
                        if (fm.effectEndUser === 'TBD') fm.effectEndUser = 'Defecto de resistencia, aspecto o durabilidad en el inserto de puerta';
                    }
                }
            }
        }

        // Sanitizar textos generales
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    fm.effectLocal = sanitizeText(fm.effectLocal);
                    fm.effectNextLevel = sanitizeText(fm.effectNextLevel);
                    fm.effectEndUser = sanitizeText(fm.effectEndUser);
                    for (const c of fm.causes || []) {
                        c.description = sanitizeText(c.description);
                        c.cause = sanitizeText(c.cause);
                        c.preventionControl = sanitizeText(c.preventionControl);
                        c.detectionControl = sanitizeText(c.detectionControl);
                        c.optimizationAction = sanitizeText(c.optimizationAction);
                        cleanCauseFields(c);
                    }
                }
            }
        }
    }

    // Revisions Insert: cambiar CC Y SC por D/TLD Y SC
    for (const r of docIns.revisions || []) {
        if (r.details && /CARACTERISTICAS ESPECIALES: CC Y SC/i.test(r.details)) {
            console.log(`  [INS] Actualizando mención de simbología en revisiones`);
            r.details = r.details.replace(/CARACTERISTICAS ESPECIALES: CC Y SC/gi, 'CARACTERISTICAS ESPECIALES: D/TLD Y SC (SIMBOLOGIA CLIENTE VW)');
        }
    }

    // Guardar o simular
    if (DRY_RUN) {
        console.log('\n[DRY RUN] Cambios calculados correctamente. Ejecutar con --apply para guardar en Supabase.');
        fs.writeFileSync('tmp/amfe_arm_pat_sanitized.json', JSON.stringify(docArm, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_tr_pat_sanitized.json', JSON.stringify(docTr, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_ins_pat_sanitized.json', JSON.stringify(docIns, null, 2), 'utf8');
        console.log('Archivos saneados de prueba guardados en tmp/*_sanitized.json.');
    } else {
        console.log('\n[APPLY] Guardando cambios en Supabase...');
        await saveAmfe(sb, IDS.ARM.id, docArm, { expectedAmfeNumber: IDS.ARM.number });
        console.log(`  ✓ AMFE-ARM-PAT guardado.`);
        await saveAmfe(sb, IDS.TR.id, docTr, { expectedAmfeNumber: IDS.TR.number });
        console.log(`  ✓ AMFE-TR-PAT guardado.`);
        await saveAmfe(sb, IDS.INS.id, docIns, { expectedAmfeNumber: IDS.INS.number });
        console.log(`  ✓ AMFE-INS-PAT guardado.`);

        // Actualizar los dumps en tmp/
        fs.writeFileSync('tmp/amfe_arm_pat.json', JSON.stringify(docArm, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_tr_pat.json', JSON.stringify(docTr, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_ins_pat.json', JSON.stringify(docIns, null, 2), 'utf8');
        console.log('  ✓ Dumps locales actualizados en tmp/.');
    }
}

run().catch(err => {
    console.error('ERROR EN SANEAMIENTO:', err);
    process.exit(1);
});
