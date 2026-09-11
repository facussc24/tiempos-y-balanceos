/**
 * _sanearMetodologiaY4MNovax.mjs
 *
 * Saneamiento Metodológico Integral de las 4M, Cruces Inter-Piezas, Glitches y Recálculo de AP:
 * 1. Alineación estricta de las 4M (AIAG-VDA Pasos 2, 3 y 4):
 *    - Instrumentos (Measurement): solo fallas metrológicas (descalibración/desgaste), no contaminación ni omisión de insumos.
 *    - Métodos (Method): solo fallas documentales (desactualización/ilegibilidad), no materia prima fuera de cota.
 *    - Máquinas (Machine): solo fallas de equipo, no selección de vinilo ni causas humanas.
 *    - Operador Control Final (Man): aprobación indebida de pieza defectuosa por omisión de control.
 * 2. Erradicación de cruces espurios de piezas:
 *    - Insert: purgar Sika Melt-171 y resina Cycoloy LG9000.
 *    - Armrest: purgar "asiento", "tela", "funda en asiento" y "apoyacabezas".
 *    - Top Roll: purgar menciones a "costura" en lámina TPO.
 * 3. Erradicación de glitches de texto:
 *    - Purgar `Sika MG®171 IMG` y limpiar prefijos duros `1- `, `2- `, `3- `.
 *    - Corregir "aspirinas" por "aspiración de polvo" en Top Roll OP 80.
 * 4. Recálculo Universal de Action Priority (AP):
 *    - Recalcular matemáticamente cada causa contra la Figura 3.5-3 oficial AIAG-VDA 2019.
 *
 * Uso:
 *   node scripts/_sanearMetodologiaY4MNovax.mjs          (dry-run)
 *   node scripts/_sanearMetodologiaY4MNovax.mjs --apply  (aplica cambios a Supabase)
 */
import { randomUUID } from 'crypto';
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { calculateAP } from './_lib/apTable.mjs';
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

    // Helper para limpiar prefijos numéricos duros tipo "1- ", "2. ", etc.
    function limpiarPrefijos(txt) {
        if (!txt || typeof txt !== 'string') return txt;
        return txt.replace(/^\s*\d+[\-\.\)]\s*/, '').trim();
    }

    // ========================================================================
    // 1. AMFE-INS-PAT (INSERT)
    // ========================================================================
    if (num === 'AMFE-INS-PAT') {
        const op10 = doc.operations?.find(o => String(o.operationNumber) === '10');
        if (op10) {
            for (const we of op10.workElements || []) {
                const n = (we.name || '').toLowerCase();

                // A. Calibres y Micrómetros (Measurement)
                if (n.includes('calibres') || n.includes('micrómetro') || we.type === 'Measurement') {
                    const antesLen = we.functions?.length || 0;
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Proveer capacidad de medición y ensayo calibrada para verificación de materias primas',
                        functionDescription: 'Proveer capacidad de medición y ensayo calibrada para verificación de materias primas',
                        requirements: 'Calibración vigente y patrones según procedimiento P-10/I',
                        failures: [{
                            id: randomUUID(),
                            description: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            failureMode: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            effectLocal: 'Lectura dimensional o de espesor errónea en recepción',
                            effectNextLevel: 'Riesgo de ingreso de materia prima fuera de tolerancia',
                            effectEndUser: 'Desviación dimensional en ensamble o defecto estético',
                            severity: 5,
                            occurrence: 2,
                            detection: 3,
                            ap: calculateAP(5, 2, 3),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Uso continuo sin calibración periódica o golpe accidental en manipulación',
                                description: 'Uso continuo sin calibración periódica o golpe accidental en manipulación',
                                severity: 5,
                                occurrence: 2,
                                detection: 3,
                                ap: calculateAP(5, 2, 3),
                                actionPriority: calculateAP(5, 2, 3),
                                specialChar: '',
                                preventionControl: 'Programa de calibración metrológica anual y almacenamiento en estuche rígido (P-10/I)',
                                detectionControl: 'Verificación de cero y calibración con patrón patrón antes de cada turno',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 10: Reemplazado contenido espurio de Calibres/Micrómetros por función y falla metrológica AIAG-VDA');
                    modificado = true;
                }

                // B. Hojas de operaciones (Method)
                if (n.includes('hojas de operaciones') || (we.type === 'Method' && n.includes('hoja'))) {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Disponer de estándar de operación y pauta visual vigente en el puesto de recepción',
                        functionDescription: 'Disponer de estándar de operación y pauta visual vigente en el puesto de recepción',
                        requirements: 'Documentación oficial aprobada según SGC',
                        failures: [{
                            id: randomUUID(),
                            description: 'Hoja de operaciones desactualizada o ilegible',
                            failureMode: 'Hoja de operaciones desactualizada o ilegible',
                            effectLocal: 'Confusión en parámetros o tolerancias de control al recibir',
                            effectNextLevel: 'Criterio de aceptación no conforme con la última revisión de ingeniería',
                            effectEndUser: 'Reclamo de calidad de cliente',
                            severity: 5,
                            occurrence: 2,
                            detection: 4,
                            ap: calculateAP(5, 2, 4),
                            causes: [{
                                id: randomUUID(),
                                cause: 'No retiro de versión obsoleta ante actualización de ingeniería o deterioro por uso',
                                description: 'No retiro de versión obsoleta ante actualización de ingeniería o deterioro por uso',
                                severity: 5,
                                occurrence: 2,
                                detection: 4,
                                ap: calculateAP(5, 2, 4),
                                actionPriority: calculateAP(5, 2, 4),
                                specialChar: '',
                                preventionControl: 'Control de documentación vigente en puesto según procedimiento del SGC',
                                detectionControl: 'Auditoría de puesto 5S y verificación de carátula al inicio de turno (P-10/I)',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 10: Purgados Sika Melt y Cycoloy de Hojas de operaciones; asignada falla documental');
                    modificado = true;
                }

                // C. Ayudas visuales (Method)
                if (n.includes('ayudas visuales')) {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Exhibir patrones visuales de defectos y límites de aceptación en puesto',
                        functionDescription: 'Exhibir patrones visuales de defectos y límites de aceptación en puesto',
                        requirements: 'Muestrario patrón limpio y representativo',
                        failures: [{
                            id: randomUUID(),
                            description: 'Ayuda visual deteriorada o no representativa del patrón vigente',
                            failureMode: 'Ayuda visual deteriorada o no representativa del patrón vigente',
                            effectLocal: 'Dificultad de comparación visual para el operador',
                            effectNextLevel: 'Aprobación de insumo con defecto de apariencia leve',
                            effectEndUser: 'Defecto visual visible en pieza terminada',
                            severity: 4,
                            occurrence: 2,
                            detection: 4,
                            ap: calculateAP(4, 2, 4),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Falta de reemplazo de muestra patrón degradada por exposición ambiental',
                                description: 'Falta de reemplazo de muestra patrón degradada por exposición ambiental',
                                severity: 4,
                                occurrence: 2,
                                detection: 4,
                                ap: calculateAP(4, 2, 4),
                                actionPriority: calculateAP(4, 2, 4),
                                specialChar: '',
                                preventionControl: 'Muestrario patrón sellado y protegido contra luz UV y polvo',
                                detectionControl: 'Inspección periódica de estado del muestrario patrón por Calidad (P-10/I)',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 10: Purgados Sika Melt y Cycoloy de Ayudas visuales; asignada falla documental');
                    modificado = true;
                }
            }
        }

        // OP 22: Mylar de control
        const op22 = doc.operations?.find(o => String(o.operationNumber) === '22');
        if (op22) {
            for (const we of op22.workElements || []) {
                if (we.name?.toLowerCase().includes('mylar')) {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Suministrar plantilla patrón dimensional para verificación de contorno de corte',
                        functionDescription: 'Suministrar plantilla patrón dimensional para verificación de contorno de corte',
                        requirements: 'Líneas guía nítidas y geometría estable',
                        failures: [{
                            id: randomUUID(),
                            description: 'Mylar de control con desgaste, rayaduras o deformación en líneas guía',
                            failureMode: 'Mylar de control con desgaste, rayaduras o deformación en líneas guía',
                            effectLocal: 'Alineación imprecisa sobre la pieza cortada',
                            effectNextLevel: 'Dificultad para detectar piezas fuera de contorno',
                            effectEndUser: 'Interferencia o defecto estético en tapizado posterior',
                            severity: 5,
                            occurrence: 2,
                            detection: 7,
                            ap: calculateAP(5, 2, 7),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Caída accidental o almacenamiento sin soporte rígido de protección',
                                description: 'Caída accidental o almacenamiento sin soporte rígido de protección',
                                severity: 5,
                                occurrence: 2,
                                detection: 7,
                                ap: calculateAP(5, 2, 7),
                                actionPriority: calculateAP(5, 2, 7),
                                specialChar: '',
                                preventionControl: 'Soporte exclusivo en puesto de control y manipulación según instrucción IT-04',
                                detectionControl: 'Inspección visual del estado del mylar al inicio de turno',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 22: Reemplazada omisión humana por falla física de desgaste en Mylar de control');
                    modificado = true;
                }
            }
        }

        // OP 110: Control Final (Operador de Calidad)
        const op110 = doc.operations?.find(o => String(o.operationNumber) === '110');
        if (op110) {
            for (const we of op110.workElements || []) {
                if (we.type === 'Man' || we.name?.toLowerCase().includes('calidad')) {
                    for (const fn of we.functions || []) {
                        for (const fl of fn.failures || []) {
                            if (fl.description?.toLowerCase().includes('vinilo despegado') || fl.failureMode?.toLowerCase().includes('vinilo despegado')) {
                                fl.description = 'Aprobación indebida de pieza con falta de adhesión perimetral o vinilo desalineado';
                                fl.failureMode = 'Aprobación indebida de pieza con falta de adhesión perimetral o vinilo desalineado';
                                for (const c of fl.causes || []) {
                                    c.cause = 'Omisión de inspección perimetral táctil y visual del 100% de la pieza';
                                    c.description = 'Omisión de inspección perimetral táctil y visual del 100% de la pieza';
                                    c.occurrence = 2;
                                    c.detection = 9;
                                    c.ap = calculateAP(6, 2, 9);
                                    c.actionPriority = calculateAP(6, 2, 9);
                                    c.preventionControl = 'Pauta de inspección perimetral estandarizada y límite de piezas por lote';
                                    c.detectionControl = 'Auditoría de producto terminado por muestreo antes de embalaje';
                                }
                                cambios.push('OP 110: Corregida falla de Operador Calidad a "Aprobación indebida por omisión de control"');
                                modificado = true;
                            }
                        }
                    }
                }
            }
        }
    }

    // ========================================================================
    // 2. AMFE-ARM-PAT (ARMREST DOOR PANEL)
    // ========================================================================
    if (num === 'AMFE-ARM-PAT') {
        const op10 = doc.operations?.find(o => String(o.operationNumber) === '10');
        if (op10) {
            for (const we of op10.workElements || []) {
                const n = (we.name || '').toLowerCase();
                // Calibres y Micrómetros
                if (n.includes('calibres') || n.includes('micrómetro') || we.type === 'Measurement') {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Proveer capacidad de medición y ensayo calibrada para verificación de materias primas',
                        functionDescription: 'Proveer capacidad de medición y ensayo calibrada para verificación de materias primas',
                        requirements: 'Calibración vigente y patrones según procedimiento P-10/I',
                        failures: [{
                            id: randomUUID(),
                            description: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            failureMode: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            effectLocal: 'Lectura dimensional o de espesor errónea en recepción',
                            effectNextLevel: 'Riesgo de ingreso de materia prima fuera de tolerancia',
                            effectEndUser: 'Desviación dimensional en ensamble de apoyabrazos',
                            severity: 5,
                            occurrence: 2,
                            detection: 3,
                            ap: calculateAP(5, 2, 3),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Uso continuo sin calibración periódica o golpe accidental en manipulación',
                                description: 'Uso continuo sin calibración periódica o golpe accidental en manipulación',
                                severity: 5,
                                occurrence: 2,
                                detection: 3,
                                ap: calculateAP(5, 2, 3),
                                actionPriority: calculateAP(5, 2, 3),
                                specialChar: '',
                                preventionControl: 'Programa de calibración metrológica anual y almacenamiento en estuche rígido (P-10/I)',
                                detectionControl: 'Verificación de cero y calibración con patrón patrón antes de cada turno',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 10 Armrest: Reemplazado contenido espurio de Calibres/Micrómetros por función metrológica');
                    modificado = true;
                }

                // Autoelevador: causas de máquina, no de chofer
                if (n.includes('autoelevador')) {
                    for (const fn of we.functions || []) {
                        for (const fl of fn.failures || []) {
                            for (const c of fl.causes || []) {
                                if (c.cause?.toLowerCase().includes('maniobra brusco') || c.cause?.toLowerCase().includes('no detecta')) {
                                    c.cause = 'Falla en sistema hidráulico de descenso de uñas o frenos desajustados';
                                    c.description = 'Falla en sistema hidráulico de descenso de uñas o frenos desajustados';
                                    c.preventionControl = 'Checklist diario de autoelevador y mantenimiento preventivo periódico';
                                    c.detectionControl = 'Inspección previa al uso en cada turno';
                                    cambios.push('OP 10 Armrest: Ajustadas causas de Autoelevador a fallas mecánicas de equipo');
                                    modificado = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        // OP 20 / 22
        const op20 = doc.operations?.find(o => String(o.operationNumber) === '20');
        if (op20) {
            for (const we of op20.workElements || []) {
                if (we.name?.toLowerCase().includes('cuchilla')) {
                    we.functions = (we.functions || []).filter(fn => {
                        const d = (fn.description || '').toLowerCase();
                        return !d.includes('selección') && !d.includes('seleccion');
                    });
                    for (const fn of we.functions || []) {
                        fn.failures = (fn.failures || []).filter(fl => {
                            const d = (fl.description || '').toLowerCase();
                            return !d.includes('selección') && !d.includes('seleccion');
                        });
                    }
                    we.functions = (we.functions || []).filter(fn => fn.failures && fn.failures.length > 0);
                    modificado = true;
                }
            }
        }

        const op22Arm = doc.operations?.find(o => String(o.operationNumber) === '22');
        if (op22Arm) {
            for (const we of op22Arm.workElements || []) {
                if (we.name?.toLowerCase().includes('mylar')) {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Suministrar plantilla patrón dimensional para verificación de corte de vinilo',
                        functionDescription: 'Suministrar plantilla patrón dimensional para verificación de corte de vinilo',
                        requirements: 'Líneas nítidas y estabilidad geométrica',
                        failures: [{
                            id: randomUUID(),
                            description: 'Mylar de control con rayaduras, deformación o pérdida de líneas de referencia',
                            failureMode: 'Mylar de control con rayaduras, deformación o pérdida de líneas de referencia',
                            effectLocal: 'Alineación imprecisa sobre la pieza cortada',
                            effectNextLevel: 'Dificultad para detectar piezas fuera de contorno',
                            effectEndUser: 'Desviación en costura o tapizado',
                            severity: 5,
                            occurrence: 2,
                            detection: 7,
                            ap: calculateAP(5, 2, 7),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Almacenamiento inadecuado o flexión forzada',
                                description: 'Almacenamiento inadecuado o flexión forzada',
                                severity: 5,
                                occurrence: 2,
                                detection: 7,
                                ap: calculateAP(5, 2, 7),
                                actionPriority: calculateAP(5, 2, 7),
                                specialChar: '',
                                preventionControl: 'Soporte rígido de almacenamiento en puesto de control',
                                detectionControl: 'Verificación visual del estado del mylar al inicio de turno',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 22 Armrest: Ajustada falla de Mylar a desgaste físico');
                    modificado = true;
                }
            }
        }

        // OP 70: Pistola adhesivado
        const op70 = doc.operations?.find(o => String(o.operationNumber) === '70');
        if (op70) {
            for (const we of op70.workElements || []) {
                if (we.name?.toLowerCase().includes('pistola')) {
                    for (const fn of we.functions || []) {
                        for (const fl of fn.failures || []) {
                            for (const c of fl.causes || []) {
                                if (c.cause?.toLowerCase().includes('adhesivo') && c.cause?.toLowerCase().includes('vencido')) {
                                    c.cause = 'Boquilla de pistola obstruida o presión de atomización descalibrada';
                                    c.description = 'Boquilla de pistola obstruida o presión de atomización descalibrada';
                                    c.preventionControl = 'Limpieza diaria de boquilla con solvente y manómetro calibrado';
                                    c.detectionControl = 'Verificación de patrón de abanico de pulverización al inicio de turno';
                                    cambios.push('OP 70 Armrest: Ajustada causa de pistola a falla de boquilla/presión');
                                    modificado = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        // OP 80-82: Prensa de tapizado type = 'Machine'
        const op80 = doc.operations?.find(o => String(o.operationNumber) === '80-82');
        if (op80) {
            for (const we of op80.workElements || []) {
                if (we.name?.toLowerCase().includes('prensa') && we.type !== 'Machine') {
                    we.type = 'Machine';
                    cambios.push('OP 80-82 Armrest: Corregido type de "Prensa de tapizado" de Method a Machine');
                    modificado = true;
                }
            }
        }

        // Reemplazo recursivo de términos de asiento, tela y apoyacabezas en todo el documento Armrest
        function purgarCrucesArmrest(obj) {
            if (!obj) return;
            if (typeof obj === 'string') return;
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                if (typeof v === 'string') {
                    let s = v;
                    if (s.includes('apoyacabezas')) {
                        s = s.replace(/apoyacabezas/gi, 'apoyabrazos');
                        cambios.push(`Armrest: Purgado "apoyacabezas" en ${k}`);
                        modificado = true;
                    }
                    if (s.includes('asiento')) {
                        s = s.replace(/en asiento|al asiento/gi, 'en panel de puerta');
                        s = s.replace(/del asiento/gi, 'del apoyabrazos');
                        s = s.replace(/asiento/gi, 'panel de puerta');
                        cambios.push(`Armrest: Purgado "asiento" en ${k}`);
                        modificado = true;
                    }
                    if (s.includes('tela en molde')) {
                        s = s.replace(/tela en molde/gi, 'vinilo en nido');
                        cambios.push(`Armrest: Purgado "tela en molde" en ${k}`);
                        modificado = true;
                    }
                    if (s.includes('funda no encaja')) {
                        s = s.replace(/funda no encaja/gi, 'revestimiento de vinilo desalineado');
                        cambios.push(`Armrest: Purgado "funda no encaja" en ${k}`);
                        modificado = true;
                    }
                    if (s.includes('bulto o deformacion visible')) {
                        s = s.replace(/bulto o deformacion visible.*$/gi, 'bulto o deformación visible en apoyabrazos');
                        cambios.push(`Armrest: Purgado "bulto en asiento" en ${k}`);
                        modificado = true;
                    }
                    if (s.includes('vinilo / tela')) {
                        s = s.replace(/vinilo \/ tela/gi, 'vinilo');
                        cambios.push(`Armrest: Purgado "vinilo / tela" en ${k}`);
                        modificado = true;
                    }
                    obj[k] = s;
                } else if (typeof v === 'object') {
                    purgarCrucesArmrest(v);
                }
            }
        }
        purgarCrucesArmrest(doc);
    }

    // ========================================================================
    // 3. AMFE-TR-PAT (TOP ROLL)
    // ========================================================================
    if (num === 'AMFE-TR-PAT') {
        const op5 = doc.operations?.find(o => String(o.operationNumber) === '5');
        if (op5) {
            for (const we of op5.workElements || []) {
                const n = (we.name || '').toLowerCase();
                // Instrumentos de medición
                if (n.includes('instrumentos de medición') || we.type === 'Measurement') {
                    we.functions = [{
                        id: randomUUID(),
                        description: 'Suministrar instrumentos calibrados para control dimensional y de espesor de materias primas',
                        functionDescription: 'Suministrar instrumentos calibrados para control dimensional y de espesor de materias primas',
                        requirements: 'Calibración vigente y patrones según procedimiento P-10/I',
                        failures: [{
                            id: randomUUID(),
                            description: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            failureMode: 'Instrumento de medición fuera de calibración o con desgaste en palpadores',
                            effectLocal: 'Lectura errónea de espesores en recepción',
                            effectNextLevel: 'Riesgo de ingreso de lámina TPO fuera de tolerancia',
                            effectEndUser: 'Desviación en espesor de pared de pieza termoformada',
                            severity: 5,
                            occurrence: 2,
                            detection: 3,
                            ap: calculateAP(5, 2, 3),
                            causes: [{
                                id: randomUUID(),
                                cause: 'Uso continuo sin calibración metrológica o desajuste de cero',
                                description: 'Uso continuo sin calibración metrológica o desajuste de cero',
                                severity: 5,
                                occurrence: 2,
                                detection: 3,
                                ap: calculateAP(5, 2, 3),
                                actionPriority: calculateAP(5, 2, 3),
                                specialChar: '',
                                preventionControl: 'Programa de calibración metrológica anual y almacenamiento en estuche rígido (P-10/I)',
                                detectionControl: 'Verificación de cero y calibración con patrón patrón antes de cada turno',
                                _autoFilled: true,
                            }],
                        }],
                    }];
                    cambios.push('OP 5 Top Roll: Reemplazada contaminación en Instrumentos de medición por falla metrológica');
                    modificado = true;
                }

                // Autoelevador
                if (n.includes('autoelevador')) {
                    for (const fn of we.functions || []) {
                        for (const fl of fn.failures || []) {
                            for (const c of fl.causes || []) {
                                if (c.cause?.toLowerCase().includes('maniobra brusco') || c.cause?.toLowerCase().includes('no detecta')) {
                                    c.cause = 'Falla mecánica en sistema de elevación o frenos desajustados';
                                    c.description = 'Falla mecánica en sistema de elevación o frenos desajustados';
                                    c.preventionControl = 'Checklist diario de autoelevador y mantenimiento preventivo periódico';
                                    c.detectionControl = 'Inspección previa al uso en cada turno';
                                    cambios.push('OP 5 Top Roll: Ajustadas causas de Autoelevador a fallas mecánicas de equipo');
                                    modificado = true;
                                }
                            }
                        }
                    }
                }

                // TPO Bilaminate: quitar "y en la costura"
                if (n.includes('tpo bilaminate')) {
                    for (const fn of we.functions || []) {
                        for (const fl of fn.failures || []) {
                            if (fl.effectNextLevel?.toLowerCase().includes('costura')) {
                                fl.effectNextLevel = 'Variación en espesor de pared durante el proceso de termoformado IMG';
                                cambios.push('OP 5 Top Roll: Purgada mención espuria a "costura" en efecto de TPO');
                                modificado = true;
                            }
                        }
                    }
                }
            }
        }

        // OP 10 (Inyección)
        const op10TR = doc.operations?.find(o => String(o.operationNumber) === '10');
        if (op10TR) {
            for (const we of op10TR.workElements || []) {
                const n = (we.name || '').toLowerCase();
                if (n.includes('inyectora')) {
                    for (const fn of we.functions || []) {
                        fn.failures = (fn.failures || []).filter(fl => {
                            const d = (fl.description || '').toLowerCase();
                            return !d.includes('omitir inspección') && !d.includes('omitir inspeccion');
                        });
                    }
                }
                if (we.type === 'Man' || n.includes('operador')) {
                    for (const fn of we.functions || []) {
                        fn.failures = (fn.failures || []).filter(fl => {
                            const d = (fl.description || '').toLowerCase();
                            return !d.includes('contaminación / suciedad') && !d.includes('contaminacion / suciedad');
                        });
                    }
                }
                if (we.type === 'Method' || n.includes('hoja de parametros')) {
                    for (const fn of we.functions || []) {
                        fn.failures = (fn.failures || []).filter(fl => {
                            const d = (fl.description || '').toLowerCase();
                            return !d.includes('falta de inspección al llegar') && !d.includes('falta de inspeccion al llegar');
                        });
                    }
                }
                we.functions = (we.functions || []).filter(fn => fn.failures && fn.failures.length > 0);
            }
            op10TR.workElements = (op10TR.workElements || []).filter(we => we.functions && we.functions.length > 0);
        }

        // OP 80 (Control Final)
        const op80TR = doc.operations?.find(o => String(o.operationNumber) === '80');
        if (op80TR) {
            for (const we of op80TR.workElements || []) {
                if (we.type === 'Environment' || we.name?.toLowerCase().includes('iluminación')) {
                    for (const fn of we.functions || []) {
                        fn.failures = (fn.failures || []).filter(fl => {
                            const d = (fl.description || '').toLowerCase();
                            return !d.includes('abrasiones') && !d.includes('transporte');
                        });
                        for (const fl of fn.failures || []) {
                            for (const c of fl.causes || []) {
                                if (c.preventionControl?.toLowerCase().includes('aspirinas')) {
                                    c.preventionControl = 'Contenedores de piezas limpios y sistema de aspiración de polvo continuo';
                                    cambios.push('OP 80 Top Roll: Corregido glitch de texto "aspirinas" -> "aspiración de polvo"');
                                    modificado = true;
                                }
                            }
                        }
                    }
                    we.functions = (we.functions || []).filter(fn => fn.failures && fn.failures.length > 0);
                }
            }
            op80TR.workElements = (op80TR.workElements || []).filter(we => we.functions && we.functions.length > 0);
        }
    }


    // ========================================================================
    // 4. LIMPIEZA UNIVERSAL DE PREFIJOS NUMÉRICOS DUROS ("1- ", "2- ", "3- ")
    // ========================================================================
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                fn.description = limpiarPrefijos(fn.description);
                fn.functionDescription = limpiarPrefijos(fn.functionDescription);
                for (const fl of fn.failures || []) {
                    fl.description = limpiarPrefijos(fl.description);
                    fl.failureMode = limpiarPrefijos(fl.failureMode);
                    for (const c of fl.causes || []) {
                        c.cause = limpiarPrefijos(c.cause);
                        c.description = limpiarPrefijos(c.description);
                    }
                }
            }
        }
    }

    // ========================================================================
    // 5. RECÁLCULO UNIVERSAL DE AP (ACTION PRIORITY) SEGÚN TABLA AIAG-VDA 2019
    // ========================================================================
    let recalculados = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fl of fn.failures || []) {
                    const s = Number(fl.severity) || 7;
                    const apCauses = [];
                    for (const c of fl.causes || []) {
                        const o = Number(c.occurrence) || 2;
                        const d = Number(c.detection) || 4;
                        const nuevoAp = calculateAP(s, o, d) || 'L';
                        if (c.ap !== nuevoAp || c.actionPriority !== nuevoAp) {
                            c.ap = nuevoAp;
                            c.actionPriority = nuevoAp;
                            recalculados++;
                        }
                        apCauses.push(nuevoAp);
                    }
                    // Falla toma el máximo AP de sus causas (H > M > L)
                    const order = { H: 3, M: 2, L: 1, '': 0 };
                    let maxAp = 'L', maxVal = 1;
                    for (const a of apCauses) {
                        const score = order[a] || 0;
                        if (score > maxVal) { maxVal = score; maxAp = a; }
                    }
                    if (fl.ap !== maxAp) {
                        fl.ap = maxAp;
                        recalculados++;
                    }
                }
            }
        }
    }
    if (recalculados > 0) {
        cambios.push(`Recalculados ${recalculados} campos de Action Priority (AP) según Figura 3.5-3 oficial AIAG-VDA`);
        modificado = true;
    }

    if (modificado) {
        logChange(apply, `${num}: Saneamiento Metodológico 4M, Cruces Inter-Piezas y Recálculo AP`, cambios.join('\n     '));
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
