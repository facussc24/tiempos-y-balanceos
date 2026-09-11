/**
 * _sanearMaterialesNovax.mjs — Saneamiento y alineación de materiales en AMFEs NOVAX.
 *
 * Aplica la Ola 2 del Plan Integral aprobado:
 *   - AMFE 158 (Insert): elimina Hot Melt, Fuller, Cycolac y skeleton de OP 10;
 *     agrega Fenoclor bicomponente (ADFA15 + REGV0.6), sustrato MG47 y grampas;
 *     corrige falla de quemadura con pinzas en OP 90 reemplazándola por solvente frío.
 *   - AMFE 161 (Armrest): elimina Hot Melt, Cycolac, skeleton y espuma genérica de OP 10;
 *     agrega reactivos PU in-situ (Poli-Plus FF 636, Iso-Plus 1355, Dissacol HR),
 *     sustrato MG47, adhesivo HB Fuller CQ-7080-5, Tesa 52110 y grampas;
 *     elimina WE "Portavasos" en OP 80-82;
 *     ajusta controles y causas de inyección PU en OP 60 (ratio 1,818:1, disparo 120 g).
 *   - AMFE 162 (Top Roll): agrega en OP 5 el refuerzo interno MG47 (22020541);
 *     elimina skeletons residuales; ajusta soldadura ultrasonido en OP 60.
 *
 * Directiva crítica: SIN CONSUMOS CUANTITATIVOS (kg/L/m²), solo descripción técnica y código.
 *
 * Uso:  node scripts/_sanearMaterialesNovax.mjs            (dry-run)
 *       node scripts/_sanearMaterialesNovax.mjs --apply    (escribe)
 */
import { randomUUID } from 'crypto';
import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

function crearMaterialWE({ name, descFuncion, fallas }) {
    return {
        id: randomUUID(),
        name,
        type: 'Material',
        description: '',
        _autoFilled: true,
        functions: [
            {
                id: randomUUID(),
                description: descFuncion,
                functionDescription: descFuncion,
                requirements: '',
                failures: fallas.map(f => {
                    const s = f.severity || 7;
                    const oFm = f.occurrence || 2;
                    const dFm = f.detection || 4;
                    const apFm = calculateAP(s, oFm, dFm) || 'L';
                    return {
                        id: randomUUID(),
                        description: f.descFalla,
                        effectLocal: f.effectLocal || 'Lote segregado en recepcion',
                        effectNextLevel: f.effectNextLevel || 'Parada de linea o atraso en produccion',
                        effectEndUser: f.effectEndUser || 'Degradacion de calidad o reclamo de cliente',
                        severity: s,
                        occurrence: oFm,
                        detection: dFm,
                        ap: apFm,
                        causes: (f.causes || []).map(c => {
                            const o = c.occurrence || 2;
                            const d = c.detection || 4;
                            const ap = calculateAP(s, o, d) || 'L';
                            return {
                                id: randomUUID(),
                                cause: c.descCausa,
                                description: c.descCausa,
                                severity: s,
                                occurrence: o,
                                detection: d,
                                ap: ap,
                                actionPriority: ap,
                                specialChar: c.specialChar || '',
                                preventionControl: c.preventionControl || 'Certificado del proveedor por lote (P-14)',
                                detectionControl: c.detectionControl || 'Control de recepcion en sistema ARB y verificacion de remito (P-10/I)',
                                _autoFilled: true,
                            };
                        }),
                    };
                }),
            },
        ],
    };
}

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

    // ========================================================================
    // 1. AMFE-INS-PAT (INSERT)
    // ========================================================================
    if (num === 'AMFE-INS-PAT') {
        const op10 = doc.operations.find(o => String(o.operationNumber) === '10');
        if (op10) {
            // Nombres que no corresponden
            const basuras = [
                'adhesivo hot melt',
                'adhesivo hb fuller',
                'pc/abs cycolac',
                'embedded decorative panel skeleton',
            ];
            const antesCount = op10.workElements.length;
            op10.workElements = op10.workElements.filter(we => {
                const n = (we.name || '').toLowerCase();
                const quitar = basuras.some(b => n.includes(b));
                if (quitar) cambios.push(`OP 10: Eliminado WE ajeno "${we.name}"`);
                return !quitar;
            });

            // Verificar si ya tiene Fenoclor y Reticulante
            const tieneFenoclor = op10.workElements.some(we => we.name.toLowerCase().includes('fenoclor') && !we.name.toLowerCase().includes('reticulante'));
            if (!tieneFenoclor) {
                const weFenoclor = crearMaterialWE({
                    name: 'Adhesivo base solvente Fenoclor (codigo AD - ADFA15)',
                    descFuncion: 'Aportar adhesivo base solvente de contacto conforme a especificacion tecnica de pegado',
                    fallas: [
                        {
                            descFalla: 'Adhesivo fuera de viscosidad o degradado por almacenamiento',
                            effectLocal: 'Lote segregado en recepcion',
                            effectNextLevel: 'Falta de adherencia o aplicacion irregular en linea',
                            effectEndUser: 'Despegado de vinilo / reclamo de cliente',
                            severity: 8,
                            causes: [{
                                descCausa: 'Desviacion en proceso de fabricacion del proveedor o envase defectuoso',
                                occurrence: 2,
                                detection: 4,
                                ap: 'L',
                                preventionControl: 'Certificado del proveedor por lote (P-14)',
                                detectionControl: 'Control de viscosidad y fecha de vencimiento al ingreso (P-10/I)',
                            }],
                        },
                        {
                            descFalla: 'Lote de adhesivo vencido',
                            effectLocal: 'Lote segregado en recepcion',
                            effectNextLevel: 'Perdida de fuerza de pegado en la union',
                            effectEndUser: 'Despegado de piezas en uso',
                            severity: 8,
                            causes: [{
                                descCausa: 'Falta de rotacion FIFO o despacho de material proximo a vencer',
                                occurrence: 2,
                                detection: 3,
                                ap: 'L',
                                preventionControl: 'Rotacion FIFO de stock y ordenes de compra sincronizadas',
                                detectionControl: 'Verificacion de fecha de caducidad en etiqueta al recibir (P-10/I)',
                            }],
                        },
                    ],
                });
                op10.workElements.push(weFenoclor);
                cambios.push('OP 10: Agregado WE "Adhesivo base solvente Fenoclor (codigo AD - ADFA15)"');
            }

            const tieneReticulante = op10.workElements.some(we => we.name.toLowerCase().includes('reticulante'));
            if (!tieneReticulante) {
                const weReticulante = crearMaterialWE({
                    name: 'Reticulante para adhesivo Fenoclor (codigo AD - REGV0.6)',
                    descFuncion: 'Aportar agente de entrecruzamiento quimico para garantizar resistencia termica de la union',
                    fallas: [
                        {
                            descFalla: 'Reticulante cristalizado o contaminado por humedad',
                            effectLocal: 'Lote segregado en recepcion',
                            effectNextLevel: 'Mezcla no homogenea y falla de curado en adhesivado',
                            effectEndUser: 'Despegado con temperatura dentro del habitaculo',
                            severity: 8,
                            causes: [{
                                descCausa: 'Envase no hermetico o ingreso de humedad en transporte',
                                occurrence: 2,
                                detection: 7,
                                preventionControl: 'Envases sellados hermeticamente bajo nitrogeno por proveedor',
                                detectionControl: 'Inspeccion visual de sellado y ausencia de turbidez en envase (P-10/I)',
                            }],
                        },
                    ],
                });
                op10.workElements.push(weReticulante);
                cambios.push('OP 10: Agregado WE "Reticulante para adhesivo Fenoclor (codigo AD - REGV0.6)"');
            }

            const tieneSustrato = op10.workElements.some(we => we.name.includes('22020541') || we.name.toLowerCase().includes('mg47'));
            if (!tieneSustrato) {
                const weSustrato = crearMaterialWE({
                    name: 'Sustrato plastico MG47 (codigo 22020541)',
                    descFuncion: 'Suministrar cuerpo base rigido inyectado conforme a geometria y plano',
                    fallas: [
                        {
                            descFalla: 'Sustrato con deformacion geometrica o alabeo fuera de tolerancia',
                            effectLocal: 'Lote segregado en recepcion',
                            effectNextLevel: 'Interferencia en estacion de tapizado o falta de asentamiento',
                            effectEndUser: 'Luz y alineacion fuera de especificacion en panel de puerta',
                            severity: 7,
                            causes: [{
                                descCausa: 'Variacion en ciclo de inyeccion o enfriamiento libre sin nido',
                                occurrence: 2,
                                detection: 4,
                                preventionControl: 'Parametros de inyeccion y enfriamiento en fixture controlado',
                                detectionControl: 'Control dimensional en calibre gabarit de recepcion (P-10/I)',
                            }],
                        },
                    ],
                });
                op10.workElements.push(weSustrato);
                cambios.push('OP 10: Agregado WE "Sustrato plastico MG47 (codigo 22020541)"');
            }

            const tieneGrampas = op10.workElements.some(we => we.name.toLowerCase().includes('grampas') || we.name.includes('1840400'));
            if (!tieneGrampas) {
                const weGrampas = crearMaterialWE({
                    name: 'Grampas de fijacion metalicas (codigo DK/1840400)',
                    descFuncion: 'Aportar grampas de engrampado para sujecion perimetral de vinilo',
                    fallas: [
                        {
                            descFalla: 'Grampas deformadas, oxidadas o con rebabas',
                            effectLocal: 'Lote segregado en recepcion',
                            effectNextLevel: 'Traba en cargador de engrampadora neumatica',
                            effectEndUser: 'Sujecion deficiente o perforacion del vinilo',
                            severity: 6,
                            causes: [{
                                descCausa: 'Defecto de matriz de estampado o embalaje roto con humedad',
                                occurrence: 2,
                                detection: 4,
                                preventionControl: 'Certificado de lote y embalaje protegido contra corrosion',
                                detectionControl: 'Control de recepcion en ARB y prueba funcional de carga con engrampadora (P-10/I)',
                            }],
                        },
                    ],
                });
                op10.workElements.push(weGrampas);
                cambios.push('OP 10: Agregado WE "Grampas de fijacion metalicas (codigo DK/1840400)"');
            }
            if (op10.workElements.length !== antesCount || cambios.length > 0) modificado = true;
        }

        // OP 90 (Adhesivado): corregir falla de quemadura de hot melt en operador
        const op90 = doc.operations.find(o => String(o.operationNumber) === '90');
        if (op90) {
            const weOp = op90.workElements.find(we => we.type === 'Man' || we.name.toLowerCase().includes('operador'));
            if (weOp) {
                for (const fn of weOp.functions || []) {
                    for (const fl of fn.failures || []) {
                        if (fl.description?.toLowerCase().includes('quemadura') || fl.failureMode?.toLowerCase().includes('quemadura')) {
                            fl.description = 'Inhalacion de vapores organicos o contacto con solvente';
                            fl.failureMode = 'Inhalacion de vapores organicos o contacto con solvente';
                            fl.effectLocal = 'Malestar o afeccion en la salud del operador';
                            fl.effectEndUser = 'Riesgo laboral / condicion insegura';
                            fl.severity = 5;
                            for (const c of fl.causes || []) {
                                c.cause = 'Falta de uso de EPP especifico o extraccion localizada apagada';
                                c.description = 'Falta de uso de EPP especifico o extraccion localizada apagada';
                                c.severity = 5;
                                c.occurrence = 2;
                                c.detection = 7;
                                const apOp90 = calculateAP(5, 2, 7);
                                c.ap = apOp90;
                                c.actionPriority = apOp90;
                                c.preventionControl = 'Campana de extraccion localizada continua, mascara con filtro para vapores organicos y guantes de nitrilo segun Hoja de Seguridad';
                                c.detectionControl = 'Supervision visual de EPP al inicio de turno';
                            }
                            cambios.push('OP 90: Corregida falla de operador (quemadura hot melt -> vapores solvente Fenoclor)');
                            modificado = true;
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
        const op10 = doc.operations.find(o => String(o.operationNumber) === '10');
        if (op10) {
            const basuras = [
                'adhesivo hot melt',
                'pc/abs cycolac',
                'upper decorative plate skeleton',
                'espuma de poliuretano 50 kg/m3',
            ];
            op10.workElements = op10.workElements.filter(we => {
                const n = (we.name || '').toLowerCase();
                const quitar = basuras.some(b => n.includes(b));
                if (quitar) cambios.push(`OP 10: Eliminado WE ajeno/inadecuado "${we.name}"`);
                return !quitar;
            });

            // Agregar Poliol, Isocianato, Desmoldante
            const tienePoliol = op10.workElements.some(we => we.name.toLowerCase().includes('poli-plus'));
            if (!tienePoliol) {
                op10.workElements.push(crearMaterialWE({
                    name: 'Poliol para espuma semirrigida (codigo POLI-PLUSFF636)',
                    descFuncion: 'Aportar componente poliol para la reaccion de espumado in-situ de poliuretano',
                    fallas: [{
                        descFalla: 'Poliol descompuesto, estratificado o con humedad',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Reaccion incompleta, colapso o falta de curado de la espuma PUR',
                        effectEndUser: 'Dureza/tacto no conforme del apoyabrazos',
                        severity: 8,
                        causes: [{
                            descCausa: 'Almacenamiento inadecuado o ingreso de humedad en tambor',
                            occurrence: 2,
                            detection: 7,
                            preventionControl: 'Almacenamiento hermetico a temperatura controlada y agitacion previa',
                            detectionControl: 'Inspeccion visual de aspecto y verificacion de certificado de lote (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 10: Agregado WE "Poliol para espuma semirrigida (codigo POLI-PLUSFF636)"');
            }

            const tieneIso = op10.workElements.some(we => we.name.toLowerCase().includes('iso-plus'));
            if (!tieneIso) {
                op10.workElements.push(crearMaterialWE({
                    name: 'Isocianato MDI para espuma (codigo ISO-PLUS 1355)',
                    descFuncion: 'Aportar isocianato reactivo para la formacion de red de poliuretano in-situ',
                    fallas: [{
                        descFalla: 'Isocianato cristalizado o degradado',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Obstruccion de boquillas dosificadoras y densidad de espuma incorrecta',
                        effectEndUser: 'Apoyabrazos con cavidades o tacto duro',
                        severity: 8,
                        causes: [{
                            descCausa: 'Exposicion a temperatura inferior a 15 C o contacto con aire humedo',
                            occurrence: 2,
                            detection: 7,
                            preventionControl: 'Temperatura de almacenamiento 18-25 C con trampa de silica gel',
                            detectionControl: 'Inspeccion visual de ausencia de cristales en tambor (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 10: Agregado WE "Isocianato MDI para espuma (codigo ISO-PLUS 1355)"');
            }

            const tieneDesmoldante = op10.workElements.some(we => we.name.toLowerCase().includes('dissacol'));
            if (!tieneDesmoldante) {
                op10.workElements.push(crearMaterialWE({
                    name: 'Desmoldante concentrado (codigo DISSACOL HR)',
                    descFuncion: 'Aportar agente desmoldante para facilitar la extraccion de la pieza del molde de espumado',
                    fallas: [{
                        descFalla: 'Desmoldante contaminado o separado en fases',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Adherencia de espuma a las paredes del molde o manchas grasas',
                        effectEndUser: 'Rotura superficial de espuma o falta de pegado de la funda',
                        severity: 7,
                        causes: [{
                            descCausa: 'Falta de homogeneizacion o lote vencido',
                            occurrence: 2,
                            detection: 7,
                            preventionControl: 'Agitacion previa y control de caducidad',
                            detectionControl: 'Inspeccion visual de dispersion y homogeneidad antes de uso (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 10: Agregado WE "Desmoldante concentrado (codigo DISSACOL HR)"');
            }

            const tieneSustratoArm = op10.workElements.some(we => we.name.includes('22020541') || we.name.toLowerCase().includes('mg47'));
            if (!tieneSustratoArm) {
                op10.workElements.push(crearMaterialWE({
                    name: 'Sustrato plastico MG47 (codigo 22020541)',
                    descFuncion: 'Suministrar cuerpo base rigido inyectado para soporte del apoyabrazos',
                    fallas: [{
                        descFalla: 'Sustrato con alabeo o puntos de inyeccion altos',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Cierre deficiente del molde de espumado o fuga de PU',
                        effectEndUser: 'Rebabas o defecto dimensional en puerta',
                        severity: 7,
                        causes: [{
                            descCausa: 'Parametros de inyeccion descalibrados en proveedor',
                            occurrence: 2,
                            detection: 4,
                            preventionControl: 'Parametros validados en ficha de inyeccion',
                            detectionControl: 'Control dimensional en calibre gabarit (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 10: Agregado WE "Sustrato plastico MG47 (codigo 22020541)"');
            }

            const tieneGrampasArm = op10.workElements.some(we => we.name.toLowerCase().includes('grampas') || we.name.includes('1840400'));
            if (!tieneGrampasArm) {
                op10.workElements.push(crearMaterialWE({
                    name: 'Grampas de fijacion metalicas (codigo DK/1840400)',
                    descFuncion: 'Aportar grampas de engrampado para fijacion de funda de vinilo',
                    fallas: [{
                        descFalla: 'Grampas deformadas o quebradizas',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Traba en engrampadora y rotura de grapas',
                        effectEndUser: 'Sujecion insuficiente de la funda',
                        severity: 6,
                        causes: [{
                            descCausa: 'Defecto en proceso de curvado del alambre',
                            occurrence: 2,
                            detection: 4,
                            preventionControl: 'Certificado de lote de fabricante',
                            detectionControl: 'Control de recepcion en ARB y prueba funcional de engrampado (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 10: Agregado WE "Grampas de fijacion metalicas (codigo DK/1840400)"');
            }
            modificado = true;
        }

        // OP 80-82: Eliminar WE "Portavasos y componentes plasticos"
        const opTap = doc.operations.find(o => String(o.operationNumber) === '80-82');
        if (opTap) {
            const antesWEC = opTap.workElements.length;
            opTap.workElements = opTap.workElements.filter(we => !we.name.toLowerCase().includes('portavasos'));
            if (opTap.workElements.length !== antesWEC) {
                cambios.push('OP 80-82: Eliminado WE ajeno "Portavasos y componentes plasticos"');
                modificado = true;
            }
        }
    }

    // ========================================================================
    // 3. AMFE-TR-PAT (TOP ROLL)
    // ========================================================================
    if (num === 'AMFE-TR-PAT') {
        const op5 = doc.operations.find(o => String(o.operationNumber) === '5');
        if (op5) {
            const basuras = [
                'upper decorative plate skeleton',
                'bracket de fijacion water cut',
            ];
            op5.workElements = op5.workElements.filter(we => {
                const n = (we.name || '').toLowerCase();
                const quitar = basuras.some(b => n.includes(b));
                if (quitar) cambios.push(`OP 5: Eliminado WE ajeno "${we.name}"`);
                return !quitar;
            });

            // Agregar Refuerzo interno MG47 (22020541)
            const tieneRefuerzo = op5.workElements.some(we => we.name.toLowerCase().includes('refuerzo') || (we.name.includes('22020541') && we.name.toLowerCase().includes('mg47')));
            if (!tieneRefuerzo) {
                op5.workElements.push(crearMaterialWE({
                    name: 'Refuerzo interno termoplastico MG47 (codigo 22020541)',
                    descFuncion: 'Suministrar refuerzo plastico inyectado para union por ultrasonido al cuerpo principal',
                    fallas: [{
                        descFalla: 'Refuerzo con deformacion o zonas de contacto alabeada',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Contacto imperfecto en nido de soldadura por ultrasonido',
                        effectEndUser: 'Resistencia de union insuficiente / desprendimiento bajo carga',
                        severity: 7,
                        causes: [{
                            descCausa: 'Parametros de inyeccion o enfriamiento desigual en molde de proveedor',
                            occurrence: 2,
                            detection: 4,
                            ap: 'L',
                            preventionControl: 'Hoja de parametros de inyeccion y enfriamiento en nido plano',
                            detectionControl: 'Control de planitud en calibre gabarit (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 5: Agregado WE "Refuerzo interno termoplastico MG47 (codigo 22020541)"');
                modificado = true;
            }

            const tieneGrampasTR = op5.workElements.some(we => we.name.toLowerCase().includes('grampas') || we.name.includes('1840400'));
            if (!tieneGrampasTR) {
                op5.workElements.push(crearMaterialWE({
                    name: 'Grampas de fijacion metalicas (codigo DK/1840400)',
                    descFuncion: 'Aportar grampas de fijacion para el montaje perimetral en puerta',
                    fallas: [{
                        descFalla: 'Grampas fuera de medida o deformadas',
                        effectLocal: 'Lote segregado en recepcion',
                        effectNextLevel: 'Dificultad de insercion en alojamiento',
                        effectEndUser: 'Fijacion floja en panel de puerta',
                        severity: 6,
                        causes: [{
                            descCausa: 'Desviacion en matriz de conformado de alambre',
                            occurrence: 2,
                            detection: 4,
                            preventionControl: 'Certificado de lote de proveedor',
                            detectionControl: 'Control dimensional con calibre gabarit en recepcion (P-10/I)',
                        }],
                    }],
                }));
                cambios.push('OP 5: Agregado WE "Grampas de fijacion metalicas (codigo DK/1840400)"');
                modificado = true;
            }
        }
    }

    if (modificado) {
        logChange(apply, `${num}: Saneamiento de materiales y operaciones`, cambios.join('\n     '));
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
