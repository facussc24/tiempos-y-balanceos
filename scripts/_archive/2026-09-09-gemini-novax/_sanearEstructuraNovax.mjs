/**
 * _sanearEstructuraNovax.mjs
 * Unificación estructural de máquinas y deduplicación de modos de falla para NOVAX:
 *  - AMFE-TR-PAT (Top Roll)
 *  - AMFE-ARM-PAT (Armrest)
 *  - AMFE-INS-PAT (Insert)
 */

import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import crypto from 'crypto';
import fs from 'fs';

const DRY_RUN = !process.argv.includes('--apply');
console.log(`=== UNIFICACIÓN ESTRUCTURAL Y DEDUPLICACIÓN NOVAX (DRY_RUN: ${DRY_RUN}) ===`);

const IDS = {
    INS: { id: '7cfe2db7-9e5a-4b46-804d-76194557c581', number: 'AMFE-INS-PAT' },
    ARM: { id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', number: 'AMFE-ARM-PAT' },
    TR: { id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3', number: 'AMFE-TR-PAT' },
};

function cleanCause(c) {
    c.severity = Number(c.severity) || 5;
    c.occurrence = Number(c.occurrence) || 3;
    c.detection = Number(c.detection) || 4;
    c.ap = calculateAP(c.severity, c.occurrence, c.detection);
    c.actionPriority = c.ap;
    if (c.ap === 'H') {
        const hasAct = (c.optimizationAction || '').trim() || (c.preventionAction || '').trim() || (c.detectionAction || '').trim();
        if (!hasAct) c.optimizationAction = 'Pendiente definicion equipo APQP';
    } else {
        if (/pendiente definicion equipo apqp/i.test(c.optimizationAction || '')) {
            c.optimizationAction = '';
        }
    }
}

async function run() {
    const sb = await connectSupabase();

    // =========================================================================
    // 1. TOP ROLL (AMFE-TR-PAT)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-TR-PAT (${IDS.TR.id})...`);
    const trData = await readAmfe(sb, IDS.TR.id);
    const docTr = trData.doc;

    for (const op of docTr.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');

        // --- OP 5: RECEPCION DE MATERIA PRIMA ---
        if (opNum === '5') {
            console.log('  [TR OP 5] Deduplicando adhesivo Hot Melt');
            const adh1 = op.workElements.find(w => w.name && w.name.includes('427-ADH-001-ADH-01'));
            const adh2 = op.workElements.find(w => w.name && w.name.includes('SikaMelt-171'));
            if (adh1 && adh2) {
                adh1.name = 'Adhesivo hot melt SikaMelt-171 IMG (codigo 427-ADH-001-ADH-01)';
                op.workElements = op.workElements.filter(w => w !== adh2);
            }
            const calibres = op.workElements.filter(w => ['Micrómetro', 'Probeta de flamabilidad', 'Probeta de peeling'].includes(w.name));
            if (calibres.length > 0) {
                const primerCalibre = op.workElements.find(w => w.name === 'Calibres');
                if (primerCalibre) {
                    primerCalibre.name = 'Instrumentos de medición y probetas de recepción (Calibre, Micrómetro, Probeta)';
                    op.workElements = op.workElements.filter(w => !['Micrómetro', 'Probeta de flamabilidad', 'Probeta de peeling'].includes(w.name));
                }
            }
        }

        // --- OP 10: INYECCION DE PIEZA PLASTICA ---
        if (opNum === '10') {
            console.log('  [TR OP 10] Limpiando Líder de Producción duplicado');
            op.workElements = op.workElements.filter(w => w.name !== 'Líder de Producción');
        }

        // --- OP 20: ADHESIVADO HOT MELT ---
        if (opNum === '20') {
            console.log('  [TR OP 20] Unificando 4 subsistemas en Línea de Adhesivado Hot Melt');
            const weOperador = {
                id: crypto.randomUUID(),
                name: 'Operador de Producción',
                type: 'Man',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Cargar la receta de proceso en HMI y posicionar bobina de TPO en desbobinador',
                    description: 'Cargar la receta de proceso en HMI y posicionar bobina de TPO en desbobinador',
                    failures: [{
                        id: crypto.randomUUID(),
                        description: 'Selección de receta incorrecta en HMI o bobina montada desalineada',
                        effectLocal: 'Lámina mal procesada / scrap',
                        effectNextLevel: 'Parada en termoformado',
                        effectEndUser: 'Sin impacto si se contiene en línea',
                        severity: 5,
                        causes: [{
                            id: crypto.randomUUID(),
                            description: 'Distracción del operador al ingresar código de programa en panel',
                            cause: 'Distracción del operador al ingresar código de programa en panel',
                            severity: 5, occurrence: 2, detection: 4, specialChar: '', characteristicNumber: '',
                            preventionControl: 'HMI con selección bloqueada por código de barras de orden de producción',
                            detectionControl: 'Verificación de pantalla antes de iniciar ciclo continuo'
                        }]
                    }]
                }]
            };
            weOperador.functions[0].failures[0].causes.forEach(cleanCause);
            
            const maquinaAdhesivado = {
                id: crypto.randomUUID(),
                name: 'Línea de Adhesivado Hot Melt',
                type: 'Machine',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Fundir y transferir una película uniforme y continua de adhesivo Hot Melt sobre la lámina de TPO según gramaje y temperatura especificados',
                    description: 'Fundir y transferir una película uniforme y continua de adhesivo Hot Melt sobre la lámina de TPO según gramaje y temperatura especificados',
                    failures: [
                        {
                            id: crypto.randomUUID(),
                            description: 'Adhesión deficiente del adhesivo Hot Melt sobre lámina TPO / quemaduras en lámina',
                            effectLocal: 'Lámina rechazada en control de adhesivado',
                            effectNextLevel: 'Despegue de lámina en termoformado posterior',
                            effectEndUser: 'Despegue perimetral de lámina en servicio, reclamo de cliente',
                            severity: 6,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Superficie de la lámina con polvo, grasa o temperatura de rodillo fuera de rango',
                                cause: 'Superficie de la lámina con polvo, grasa o temperatura de rodillo fuera de rango',
                                severity: 6, occurrence: 3, detection: 7, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Limpieza periódica de rodillos aplicadores y control de temperatura de fusión',
                                detectionControl: 'Ensayo de adherencia / peeling por lote + control visual en estación'
                            }]
                        },
                        {
                            id: crypto.randomUUID(),
                            description: 'Gramaje / peso de adhesivo aplicado fuera de especificación',
                            effectLocal: 'Bobina de material rechazada en control',
                            effectNextLevel: 'Variación en espesor de adhesivo / despegue en conformado',
                            effectEndUser: 'Riesgo de falla de durabilidad en zona superior',
                            severity: 6,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Desajuste en velocidad de rodillo dosificador o viscosidad de batea',
                                cause: 'Desajuste en velocidad de rodillo dosificador o viscosidad de batea',
                                severity: 6, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Ajuste estandarizado de velocidad de avance y dosificación de adhesivo',
                                detectionControl: 'Control gravimétrico de peso de adhesivo por metro cuadrado según frecuencia'
                            }]
                        }
                    ]
                }]
            };
            maquinaAdhesivado.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));

            op.workElements = [maquinaAdhesivado, weOperador];
        }

        // --- OP 30: TERMOFORMADO (PEDIDO CENTRAL DE FAK) ---
        if (opNum === '30') {
            console.log('  [TR OP 30] Unificando 5 subsistemas en Máquina Termoformadora IMG');
            const materialBobina = op.workElements.find(w => w.name && w.name.includes('Rollo Pre-laminado'));
            if (materialBobina) {
                materialBobina.functions = [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Aportar sustrato bilaminado TPO con adhesivo hot melt activable, dentro de tolerancias dimensionales y térmicas',
                    description: 'Aportar sustrato bilaminado TPO con adhesivo hot melt activable, dentro de tolerancias dimensionales y térmicas',
                    failures: [{
                        id: crypto.randomUUID(),
                        description: 'Ancho o espesor de bobina de TPO fuera de tolerancia',
                        effectLocal: 'Dificultad de centrado en marco de fijación / scrap',
                        effectNextLevel: 'Interrupción en alimentación de bobina',
                        effectEndUser: 'Sin impacto en cliente final si se detecta en carga; potencial demora',
                        severity: 3,
                        causes: [{
                            id: crypto.randomUUID(),
                            description: 'Variación dimensional del lote entregado por el proveedor de lámina',
                            cause: 'Variación dimensional del lote entregado por el proveedor de lámina',
                            severity: 3, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                            preventionControl: 'Recepción y certificación de calidad por lote de proveedor con protocolo dimensional',
                            detectionControl: 'Verificación de ancho y espesor al montar la bobina en máquina'
                        }]
                    }]
                }];
                materialBobina.functions[0].failures[0].causes.forEach(cleanCause);
            }

            const maquinaTermoformado = {
                id: crypto.randomUUID(),
                name: 'Máquina Termoformadora IMG',
                type: 'Machine',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Calentar la lámina pre-laminada, conformarla por vacío sobre molde texturizado y enfriar la pieza según ciclo establecido',
                    description: 'Calentar la lámina pre-laminada, conformarla por vacío sobre molde texturizado y enfriar la pieza según ciclo establecido',
                    failures: [
                        {
                            id: crypto.randomUUID(),
                            description: 'Temperatura de lámina TPO insuficiente o fuera de rango',
                            effectLocal: 'Scrap de lámina no conformada / pérdida de textura',
                            effectNextLevel: 'Parada de puesto de corte',
                            effectEndUser: 'Deformación o textura deficiente en zona vista de puerta',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Sensor de temperatura de horno descalibrado o resistencia calefactora degradada',
                                cause: 'Sensor de temperatura de horno descalibrado o resistencia calefactora degradada',
                                severity: 5, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Calibración periódica de pirómetros y verificación al inicio de turno',
                                detectionControl: 'Alarma de temperatura en pirómetro / PLC con interlock de ciclo + Inspección visual 100%'
                            }]
                        },
                        {
                            id: crypto.randomUUID(),
                            description: 'Formado incompleto de lámina / burbujas o pérdida de definición de grano',
                            effectLocal: 'Scrap de pieza termoformada',
                            effectNextLevel: 'Rechazo en inspección intermedia',
                            effectEndUser: 'Defecto estético visible en textura, queja en concesionario',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Nivel de vacío insuficiente o microperforaciones del molde obstruidas',
                                cause: 'Nivel de vacío insuficiente o microperforaciones del molde obstruidas',
                                severity: 5, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Mantenimiento preventivo de bomba de vacío y purga/limpieza periódica de orificios del molde',
                                detectionControl: 'Presostato de vacío con alarma interlock en ciclo + Inspección visual 100%'
                            }]
                        }
                    ]
                }]
            };
            maquinaTermoformado.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));

            op.workElements = [maquinaTermoformado, materialBobina].filter(Boolean);
        }

        // --- OP 40: CORTE FINAL ---
        if (opNum === '40') {
            console.log('  [TR OP 40] Unificando 4 subsistemas en Prensa de corte perimetral');
            const maquinaCorte = {
                id: crypto.randomUUID(),
                name: 'Prensa de corte perimetral',
                type: 'Machine',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Posicionar la pieza conformada y realizar el corte perimetral mediante cuchilla caliente accionada neumáticamente',
                    description: 'Posicionar la pieza conformada y realizar el corte perimetral mediante cuchilla caliente accionada neumáticamente',
                    failures: [
                        {
                            id: crypto.randomUUID(),
                            description: 'Contorno de corte desplazado (Fuera de tolerancia geométrica)',
                            effectLocal: 'Scrap del componente mal cortado',
                            effectNextLevel: 'Interferencia en ensamble posterior',
                            effectEndUser: 'Desalineación estética visible en puerta',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Desgaste o holgura en los pines de centrado del nido o suciedad en apoyos',
                                cause: 'Desgaste o holgura en los pines de centrado del nido o suciedad en apoyos',
                                severity: 5, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Plan de mantenimiento preventivo de fixture y limpieza de apoyos al inicio de turno',
                                detectionControl: 'Control dimensional con calibre pasa/no-pasa de primera pieza del lote'
                            }]
                        },
                        {
                            id: crypto.randomUUID(),
                            description: 'Borde de corte quemado, derretido o con rebarba perimetral',
                            effectLocal: 'Pieza rechazada para refilado manual o scrap',
                            effectNextLevel: 'Dificultad de encastre perimetral',
                            effectEndUser: 'Rebabas o bordes desprolijos al tacto en línea de cintura',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Temperatura de cuchilla excesiva o velocidad de avance de corte descalibrada',
                                cause: 'Temperatura de cuchilla excesiva o velocidad de avance de corte descalibrada',
                                severity: 5, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Control de temperatura de cuchilla por pirómetro e inspección de filo',
                                detectionControl: 'Inspección visual 100% del borde cortado por el operador'
                            }]
                        }
                    ]
                }]
            };
            maquinaCorte.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));
            op.workElements = [maquinaCorte];
        }

        // --- OP 60: SOLDADURA DE REFUERZOS INTERNOS ---
        if (opNum === '60') {
            console.log('  [TR OP 60] Unificando subsistemas en Equipo de Soldadura por Ultrasonido');
            const weOperador = op.workElements.find(w => w.name && w.name.includes('Operador'));
            const maquinaSoldadura = {
                id: crypto.randomUUID(),
                name: 'Equipo de Soldadura por Ultrasonido',
                type: 'Machine',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Efectuar la soldadura por ultrasonido a 20 kHz de los refuerzos plásticos en los puntos previstos del sustrato del Top Roll',
                    description: 'Efectuar la soldadura por ultrasonido a 20 kHz de los refuerzos plásticos en los puntos previstos del sustrato del Top Roll',
                    failures: [
                        {
                            id: crypto.randomUUID(),
                            description: 'Soldadura fría / Falta de fusión (Unión débil de refuerzo)',
                            effectLocal: 'Pieza rechazada en puesto de soldadura',
                            effectNextLevel: 'Desprendimiento de refuerzo en línea de ensamble',
                            effectEndUser: 'Ruidos, vibraciones o desprendimiento interno en panel de puerta',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Tiempo de soldadura insuficiente, baja amplitud o caída de presión de aire neumático',
                                cause: 'Tiempo de soldadura insuficiente, baja amplitud o caída de presión de aire neumático',
                                severity: 5, occurrence: 3, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Parámetros de energía, amplitud y tiempo bloqueados en generador de ultrasonido',
                                detectionControl: 'Ensayo no destructivo de torque/tracción manual cada inicio de turno'
                            }]
                        },
                        {
                            id: crypto.randomUUID(),
                            description: 'Marca visible (Traspaso o brillo) en cara vista (Lado A)',
                            effectLocal: 'Scrap de pieza terminada',
                            effectNextLevel: 'Rechazo en inspección final de calidad',
                            effectEndUser: 'Defecto estético visible en zona superior de puerta, queja de cliente',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Exceso de energía/amplitud de soldadura o nido de apoyo desgastado/contaminado',
                                cause: 'Exceso de energía/amplitud de soldadura o nido de apoyo desgastado/contaminado',
                                severity: 5, occurrence: 2, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Ventana de parámetros controlada por contraseña y mantenimiento preventivo de sonotrodo',
                                detectionControl: 'Inspección visual 100% de la cara vista (lado A) al retirar del nido'
                            }]
                        }
                    ]
                }]
            };
            maquinaSoldadura.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));
            op.workElements = [maquinaSoldadura, weOperador].filter(Boolean);
        }

        // --- OP 80: CONTROL FINAL DE CALIDAD ---
        if (opNum === '80') {
            console.log('  [TR OP 80] Unificando en Dispositivo de Control y Verificación + Inspector de Calidad');
            const weLuz = op.workElements.find(w => w.name && w.name.includes('Iluminación'));
            
            const maquinaControl = {
                id: crypto.randomUUID(),
                name: 'Dispositivo de Control y Verificación',
                type: 'Machine',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Verificar la conformidad geométrica del Top Roll mediante fixture con apoyos y pines de verificación dimensional',
                    description: 'Verificar la conformidad geométrica del Top Roll mediante fixture con apoyos y pines de verificación dimensional',
                    failures: [{
                        id: crypto.randomUUID(),
                        description: 'Fuga de pieza fuera de tolerancia dimensional / deformación no detectada por el medio',
                        effectLocal: 'Pieza no conforme liberada a embalaje',
                        effectNextLevel: 'Interferencia en montaje en terminal',
                        effectEndUser: 'Desalineación estética en vehículo',
                        severity: 5,
                        causes: [{
                            id: crypto.randomUUID(),
                            description: 'Desgaste de apoyos o pines de centrado del calibre patrón',
                            cause: 'Desgaste de apoyos o pines de centrado del calibre patrón',
                            severity: 5, occurrence: 2, detection: 4, specialChar: '', characteristicNumber: '',
                            preventionControl: 'Plan de calibración y verificación periódica del dispositivo de control',
                            detectionControl: 'Control de desgaste con pieza master al inicio de turno'
                        }]
                    }]
                }]
            };
            maquinaControl.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));

            const inspectorCalidad = {
                id: crypto.randomUUID(),
                name: 'Inspector de Calidad',
                type: 'Man',
                functions: [{
                    id: crypto.randomUUID(),
                    functionDescription: 'Inspeccionar el 100% de la cara vista bajo cabina de luz e identificar la pieza con etiqueta de código de barras conforme',
                    description: 'Inspeccionar el 100% de la cara vista bajo cabina de luz e identificar la pieza con etiqueta de código de barras conforme',
                    failures: [
                        {
                            id: crypto.randomUUID(),
                            description: 'Fuga de defecto de aspecto (rayado, rehundimiento, marca o brillo visible)',
                            effectLocal: 'Pieza no conforme enviada a cliente',
                            effectNextLevel: 'Rechazo en inspección de recepción de cliente / reclamo',
                            effectEndUser: 'Defecto estético visible en puerta, reclamo en concesionario',
                            severity: 5,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Fatiga o distracción visual del inspector al realizar el control',
                                cause: 'Fatiga o distracción visual del inspector al realizar el control',
                                severity: 5, occurrence: 4, detection: 4, specialChar: '', characteristicNumber: '',
                                preventionControl: 'Rotación periódica de inspectores y pausas activas estandarizadas',
                                detectionControl: 'Auditoría de producto terminado por calidad de planta'
                            }]
                        },
                        {
                            id: crypto.randomUUID(),
                            description: 'Pieza identificada con etiqueta incorrecta (mezcla de modelo / lado)',
                            effectLocal: 'Pieza etiquetada erróneamente en contenedor',
                            effectNextLevel: 'Mezcla de variantes en línea de montaje de terminal',
                            effectEndUser: 'Reclamo de terminal por quiebre de secuencia o entrega incorrecta',
                            severity: 7,
                            causes: [{
                                id: crypto.randomUUID(),
                                description: 'Operador escanea orden equivocada en terminal',
                                cause: 'Operador escanea orden equivocada en terminal',
                                severity: 7, occurrence: 2, detection: 2, specialChar: 'SC', characteristicNumber: '',
                                preventionControl: 'Sistema de impresión bloqueado vinculado a orden de producción en sistema',
                                detectionControl: 'Validación por escaneo de código de barras previo a liberación'
                            }]
                        }
                    ]
                }]
            };
            inspectorCalidad.functions[0].failures.forEach(f => f.causes.forEach(cleanCause));

            op.workElements = [maquinaControl, inspectorCalidad, weLuz].filter(Boolean);
        }

        // --- OP 90: EMBALAJE ---
        if (opNum === '90') {
            console.log('  [TR OP 90] Limpiando Líder de Producción duplicado');
            op.workElements = op.workElements.filter(w => w.name !== 'Líder de Producción');
        }
    }

    // =========================================================================
    // 2. ARMREST (AMFE-ARM-PAT)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-ARM-PAT (${IDS.ARM.id})...`);
    const armData = await readAmfe(sb, IDS.ARM.id);
    const docArm = armData.doc;

    for (const op of docArm.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');
        if (opNum === '10') {
            console.log('  [ARM OP 10] Deduplicando vinilos repetidos en recepción');
            const vin1 = op.workElements.find(w => w.name && w.name.includes('427-VIN-009-COR-01'));
            const vin2 = op.workElements.find(w => w.name && w.name.includes('Vinilo PVC Texture PR022 Carbon Black'));
            if (vin1 && vin2) {
                vin1.name = 'Vinilo de tapizado PVC Texture PR022 Carbon Black (codigo 427-VIN-009-COR-01)';
                op.workElements = op.workElements.filter(w => w !== vin2);
            }
        }
    }

    // =========================================================================
    // 3. INSERT (AMFE-INS-PAT)
    // =========================================================================
    console.log(`\n>>> Procesando AMFE-INS-PAT (${IDS.INS.id})...`);
    const insData = await readAmfe(sb, IDS.INS.id);
    const docIns = insData.doc;

    for (const op of docIns.operations || []) {
        const opNum = String(op.operationNumber || op.opNumber || '');
        if (opNum === '10') {
            console.log('  [INS OP 10] Deduplicando vinilos por color en recepción');
            const vinilosSansuy = op.workElements.filter(w => w.name && w.name.includes('Sansuy'));
            if (vinilosSansuy.length > 1) {
                const primerVinilo = vinilosSansuy[0];
                primerVinilo.name = 'Vinilo bondeado Sansuy - 4 variantes de color (Titan Black, Platinium Gray, Andino Gray, Dark Slate ML14)';
                op.workElements = op.workElements.filter(w => !vinilosSansuy.slice(1).includes(w));
            }
        }
    }

    // Guardar
    if (DRY_RUN) {
        console.log('\n[DRY RUN] Estructuras calculadas. Ejecutar con --apply para persistir en Supabase.');
        fs.writeFileSync('tmp/amfe_tr_pat_sanitized.json', JSON.stringify(docTr, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_arm_pat_sanitized.json', JSON.stringify(docArm, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_ins_pat_sanitized.json', JSON.stringify(docIns, null, 2), 'utf8');
        console.log('Guardados en tmp/*_sanitized.json.');
    } else {
        console.log('\n[APPLY] Guardando cambios estructurales en Supabase...');
        await saveAmfe(sb, IDS.TR.id, docTr, { expectedAmfeNumber: IDS.TR.number });
        console.log(`  ✓ AMFE-TR-PAT guardado en Supabase.`);
        await saveAmfe(sb, IDS.ARM.id, docArm, { expectedAmfeNumber: IDS.ARM.number });
        console.log(`  ✓ AMFE-ARM-PAT guardado en Supabase.`);
        await saveAmfe(sb, IDS.INS.id, docIns, { expectedAmfeNumber: IDS.INS.number });
        console.log(`  ✓ AMFE-INS-PAT guardado en Supabase.`);

        // Actualizar dumps
        fs.writeFileSync('tmp/amfe_tr_pat.json', JSON.stringify(docTr, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_arm_pat.json', JSON.stringify(docArm, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_ins_pat.json', JSON.stringify(docIns, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_tr_pat_sanitized.json', JSON.stringify(docTr, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_arm_pat_sanitized.json', JSON.stringify(docArm, null, 2), 'utf8');
        fs.writeFileSync('tmp/amfe_ins_pat_sanitized.json', JSON.stringify(docIns, null, 2), 'utf8');
        console.log('  ✓ Dumps locales actualizados en tmp/.');
    }
}

run().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
