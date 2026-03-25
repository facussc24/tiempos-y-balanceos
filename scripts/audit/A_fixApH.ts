/**
 * A_fixApH.ts
 *
 * Assign corrective actions to 52 AMFE causes with AP=H that lack
 * prevention/detection actions.
 *
 * For each cause: set preventionAction, detectionAction, responsible,
 * targetDate, status based on operation type and cause context.
 */
import {
    ensureAuth,
    fetchAllAmfeDocs,
    backupDoc,
    writeResults,
    normOp,
    updateDocDirect,
} from './supabaseHelper.js';

// ── Action mapping by operation category ───────────────────────────────────────

interface ActionPair {
    prevention: string;
    detection: string;
}

function deduceActions(opName: string, causeName: string): ActionPair {
    const op = normOp(opName);
    const cause = normOp(causeName);

    // Recepción de MP
    if (op.includes('recep') || op.includes('recepcion')) {
        if (cause.includes('danada') || cause.includes('golpea') || cause.includes('transporte') || cause.includes('transito')) {
            return {
                prevention: 'Definir protocolo de inspeccion en recepcion con check-list de estado visual y dimensional',
                detection: 'Inspeccion visual 100% en recepcion contra muestra patron',
            };
        }
        if (cause.includes('proteccion') || cause.includes('deterioro') || cause.includes('embalaje') || cause.includes('estiba')) {
            return {
                prevention: 'Establecer requisitos de embalaje al proveedor (especificacion de packaging)',
                detection: 'Verificacion de integridad del embalaje en cada recepcion',
            };
        }
        if (cause.includes('desgaste') || cause.includes('material')) {
            return {
                prevention: 'Auditar proveedor: validar certificados de calidad y muestras iniciales',
                detection: 'Inspeccion visual y dimensional contra especificacion en recepcion',
            };
        }
        // Default recepción
        return {
            prevention: 'Definir criterios de aceptacion de MP y comunicar al proveedor',
            detection: 'Inspeccion visual 100% en recepcion contra muestra patron',
        };
    }

    // Corte
    if (op.includes('corte') || op.includes('cortar')) {
        if (cause.includes('cuchilla') || cause.includes('desgaste') || cause.includes('desafilada')) {
            return {
                prevention: 'Implementar plan de mantenimiento preventivo de cuchillas con frecuencia definida',
                detection: 'Autocontrol dimensional de primeras 3 piezas por turno',
            };
        }
        if (cause.includes('parametro') || cause.includes('tension') || cause.includes('velocidad') || cause.includes('ingresado')) {
            return {
                prevention: 'Implementar Poka-Yoke de parametros de corte (receta bloqueada por modelo)',
                detection: 'Verificacion de parametros en set-up contra hoja de proceso',
            };
        }
        if (cause.includes('operario') || cause.includes('operador') || cause.includes('posicion')) {
            return {
                prevention: 'Capacitacion en instruccion de trabajo + ayuda visual en puesto',
                detection: 'Autocontrol con plantilla/galga de verificacion',
            };
        }
        return {
            prevention: 'Estandarizar parametros de corte y capacitar al operador',
            detection: 'Autocontrol dimensional de primeras piezas por set-up',
        };
    }

    // Costura / Refilado
    if (op.includes('costura') || op.includes('refilado') || op.includes('refila')) {
        if (cause.includes('cuchilla') || cause.includes('desgaste') || cause.includes('desafilada')) {
            return {
                prevention: 'Plan de cambio preventivo de cuchilla cada N piezas segun historico de desgaste',
                detection: 'Inspeccion visual de borde de refilado cada 50 piezas',
            };
        }
        if (cause.includes('posicion') || cause.includes('tolerancia') || cause.includes('operador')) {
            return {
                prevention: 'Implementar guia mecanica de posicionamiento (fixture)',
                detection: 'Verificacion dimensional con calibre pasa/no-pasa',
            };
        }
        return {
            prevention: 'Estandarizar procedimiento de costura/refilado con ayuda visual',
            detection: 'Autocontrol visual por operador + inspeccion por muestreo',
        };
    }

    // Termoformado
    if (op.includes('termoform') || op.includes('termo')) {
        if (cause.includes('posicion') || cause.includes('material')) {
            return {
                prevention: 'Implementar sistema de centraje automatico + validar certificado de MP',
                detection: 'Control de primeras 5 piezas por lote con plantilla',
            };
        }
        if (cause.includes('presion') || cause.includes('temperatura')) {
            return {
                prevention: 'Estandarizar parametros de termoformado con receta por modelo',
                detection: 'Monitoreo automatico de parametros con alarma por desviacion',
            };
        }
        return {
            prevention: 'Capacitar operador en procedimiento de termoformado y centraje',
            detection: 'Control de primeras 5 piezas por lote con plantilla de verificacion',
        };
    }

    // Inyección
    if (op.includes('inyeccion') || op.includes('inyectar')) {
        if (cause.includes('molde') || cause.includes('contaminad') || cause.includes('residual')) {
            return {
                prevention: 'Protocolo de limpieza de molde por turno y registro',
                detection: 'Inspeccion visual de las primeras 3 piezas por set-up',
            };
        }
        if (cause.includes('sensor') || cause.includes('calibra') || cause.includes('mantenimiento')) {
            return {
                prevention: 'Plan de calibracion de sensores con frecuencia segun especificacion del fabricante',
                detection: 'Monitoreo automatico de parametros con alarma por desviacion',
            };
        }
        return {
            prevention: 'Estandarizar parametros de inyeccion y protocolo de set-up',
            detection: 'Control dimensional y visual de primeras piezas por set-up',
        };
    }

    // Ensamble / Soldadura / Sujeción térmica
    if (op.includes('ensambl') || op.includes('soldad') || op.includes('sujecion') || op.includes('termic')) {
        if (cause.includes('temperatura') || cause.includes('insuficiente')) {
            return {
                prevention: 'Calibracion periodica del equipo de soldadura + validacion de parametros en set-up',
                detection: 'Ensayo destructivo de muestra por turno',
            };
        }
        if (cause.includes('adhesivo') || cause.includes('falta')) {
            return {
                prevention: 'Implementar dispensador con sensor de presencia de adhesivo (Poka-Yoke)',
                detection: 'Autocontrol visual + ensayo de adherencia por turno',
            };
        }
        if (cause.includes('operario') || cause.includes('error')) {
            return {
                prevention: 'Capacitacion en procedimiento de ensamble + ayuda visual',
                detection: 'Autocontrol visual del operador + verificacion por supervisor',
            };
        }
        return {
            prevention: 'Estandarizar procedimiento de ensamble con parametros controlados',
            detection: 'Control visual y funcional de primeras piezas por set-up',
        };
    }

    // Tapizado
    if (op.includes('tapiza')) {
        if (cause.includes('temperatura')) {
            return {
                prevention: 'Definir y controlar rango de temperatura de proceso con alarma automatica',
                detection: 'Medicion de temperatura con pirometro antes de cada ciclo',
            };
        }
        return {
            prevention: 'Estandarizar parametros de tapizado y capacitar al operador',
            detection: 'Autocontrol visual del operador + inspeccion de primeras piezas',
        };
    }

    // Inspección Final
    if (op.includes('inspeccion') || op.includes('control final')) {
        if (cause.includes('omision') || cause.includes('error en') || cause.includes('verificacion')) {
            return {
                prevention: 'Implementar check-list obligatorio digitalizado con campos requeridos',
                detection: 'Auditoria de producto terminado por Calidad (2 pcs/turno)',
            };
        }
        if (cause.includes('conforme') || cause.includes('aprobacion')) {
            return {
                prevention: 'Capacitacion en criterios de aceptacion con muestras limite actualizadas',
                detection: 'Re-inspeccion aleatoria por supervisor (5% del lote)',
            };
        }
        return {
            prevention: 'Actualizar criterios de inspeccion final con muestras limite',
            detection: 'Auditoria de producto terminado por Calidad (muestreo por turno)',
        };
    }

    // Empaque / Embalaje
    if (op.includes('empaque') || op.includes('embalaje')) {
        if (cause.includes('etiqueta') || cause.includes('codigo') || cause.includes('legible')) {
            return {
                prevention: 'Mantenimiento preventivo de impresora + validacion de legibilidad por turno',
                detection: 'Verificacion visual de etiqueta antes de cerrar caja',
            };
        }
        if (cause.includes('suelta') || cause.includes('amortiguam') || cause.includes('distribucion')) {
            return {
                prevention: 'Definir instruccion de embalaje con esquema de acomodamiento por modelo',
                detection: 'Verificacion de peso por caja vs estandar antes de cerrar',
            };
        }
        return {
            prevention: 'Estandarizar instruccion de embalaje por producto',
            detection: 'Verificacion visual del empaque antes de despacho',
        };
    }

    // Despacho / Envío
    if (op.includes('despacho') || op.includes('envio')) {
        return {
            prevention: 'Implementar protocolo de carga con puntos de amarre y proteccion definidos',
            detection: 'Inspeccion visual post-carga antes de despachar',
        };
    }

    // Adhesivado
    if (op.includes('adhesiv')) {
        return {
            prevention: 'Controlar dosificacion de adhesivo y tiempo de aplicacion segun ficha tecnica',
            detection: 'Ensayo de adherencia por turno + autocontrol visual del operador',
        };
    }

    // Default fallback
    return {
        prevention: 'Revisar procedimiento de operacion y capacitar al operador en controles criticos',
        detection: 'Autocontrol del operador + inspeccion por muestreo segun plan de control',
    };
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface CauseLog {
    product: string;
    docId: string;
    operation: string;
    opNumber: string;
    failureMode: string;
    cause: string;
    severity: number | string;
    occurrence: number | string;
    detection: number | string;
    preventionAction: string;
    detectionAction: string;
}

async function main() {
    console.log('=== Script A: Fix 52 AP=H causes without corrective actions ===\n');
    await ensureAuth();

    console.log('Loading AMFE documents...');
    const amfeDocs = await fetchAllAmfeDocs();
    console.log(`  Loaded ${amfeDocs.length} AMFE docs\n`);

    const logs: CauseLog[] = [];
    let totalFixed = 0;
    const docsModified = new Set<string>();

    for (const amfe of amfeDocs) {
        const doc = amfe.parsed;
        const projectName = String(amfe.raw.project_name || '');
        let docFixed = 0;

        for (const op of doc.operations || []) {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fail of fn.failures || []) {
                        for (const cause of fail.causes || []) {
                            // Check: AP=H AND no prevention/detection actions
                            if (
                                cause.ap === 'H' &&
                                (!cause.preventionAction || cause.preventionAction.trim() === '') &&
                                (!cause.detectionAction || cause.detectionAction.trim() === '')
                            ) {
                                const actions = deduceActions(op.name || '', cause.cause || '');

                                cause.preventionAction = actions.prevention;
                                cause.detectionAction = actions.detection;
                                cause.responsible = 'Carlos Baptista (Ingenieria)';
                                cause.targetDate = '2026-07-01';
                                cause.status = 'Pendiente';

                                logs.push({
                                    product: projectName,
                                    docId: amfe.id,
                                    operation: op.name || '',
                                    opNumber: op.opNumber || '',
                                    failureMode: fail.description || '',
                                    cause: cause.cause || '',
                                    severity: fail.severity ?? '',
                                    occurrence: cause.occurrence ?? '',
                                    detection: cause.detection ?? '',
                                    preventionAction: actions.prevention,
                                    detectionAction: actions.detection,
                                });

                                docFixed++;
                                totalFixed++;
                            }
                        }
                    }
                }
            }
        }

        if (docFixed > 0) {
            docsModified.add(amfe.id);
            console.log(`  [${projectName}] Fixed ${docFixed} causes`);

            // Backup and save
            backupDoc('amfe_documents', amfe.id, amfe.raw.data as string);
            await updateDocDirect('amfe_documents', amfe.id, JSON.stringify(doc));
        }
    }

    console.log(`\n════════════════════════════════════════════════════`);
    console.log(`  TOTAL: ${totalFixed} AP=H causes fixed across ${docsModified.size} AMFE docs`);
    console.log(`════════════════════════════════════════════════════\n`);

    // Group by product for summary
    const byProduct: Record<string, number> = {};
    for (const l of logs) {
        byProduct[l.product] = (byProduct[l.product] || 0) + 1;
    }
    for (const [p, c] of Object.entries(byProduct).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${p}: ${c}`);
    }

    writeResults('A_fixApH.json', {
        timestamp: new Date().toISOString(),
        summary: {
            totalFixed,
            docsModified: docsModified.size,
            byProduct,
        },
        corrections: logs,
    });

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
