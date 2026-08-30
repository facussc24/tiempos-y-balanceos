/**
 * _revisarAmfe150Patagonia.mjs — Revision del AMFE 150 (APB TRASERO CENTRAL, 2HC.885.081 RL1)
 *
 * Pedido: Carlos Baptista — "Revisar AMFE de Patagonia y pasar a Calidad, hacer foco
 * en Recepcion de materiales" (Asaichi 10-11/08/2026).
 * Renumeracion del Plan de Control autorizada por Marcelo Nieve el 13/08/2026.
 *
 * TODO lo que se agrega sale de un documento real. Fuente por bloque:
 *
 *   [PdC]  Plan de Control preliminar "PdC APB 2HC.885.081 RL1 Patagonia.pdf",
 *          Rev 1 del 31/07/2026, M. Nieve — adjunto al mail del 12/08/2026 10:15.
 *   [FLU]  Flujograma I-IN-002/III Rev A, 04/05/2026, revisado por Carlos Baptista.
 *   [ING]  Definiciones dictadas por Ingenieria el 13/08/2026 (op 61 va despues del
 *          tapizado; la funda NO lleva costura vista).
 *   [MAE]  AMFE-MAESTRO-LOG-REC-001 (LOGISTICA_RECEPCION) — solo la parte generica
 *          (certificado / trazabilidad); el resto del maestro es recepcion de pellet
 *          higroscopico para inyeccion plastica y NO aplica a esta pieza.
 *
 * NO se inventan acciones de optimizacion (regla amfe.md §5). Las causas nuevas
 * llevan S/O/D marcados con `_autoFilled: true` (autonomy-contract B).
 * NO se asigna ninguna CC/SC (core-prohibiciones §2) — va como hallazgo para Fak.
 *
 * Uso:  node scripts/_revisarAmfe150Patagonia.mjs           (dry-run)
 *       node scripts/_revisarAmfe150Patagonia.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, findOperation,
    syncLegacyFmFields, syncFieldAliases, calculateAP, countAmfeStats,
} from './_lib/amfeIo.mjs';

const AMFE_NUMBER = '150';
const PLACEHOLDER_APH = 'Pendiente definicion equipo APQP';

// ─── Constructores ──────────────────────────────────────────────────────────

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc,
        description: desc,
        severity: s,
        occurrence: o,
        detection: d,
        ap,
        actionPriority: ap,
        specialChar: '',
        preventionControl: prev,
        detectionControl: det,
        // amfe.md §4: AP=H sin accion definida lleva el placeholder literal.
        // AP=M/L se dejan vacias (NUNCA inventar acciones — §5).
        preventionAction: ap === 'H' ? PLACEHOLDER_APH : '',
        detectionAction: '',
        optimizationAction: '',
        responsible: '',
        targetDate: '',
        status: '',
        _autoFilled: true,
    };
}

function mkFailure({ desc, local, next, end, causes }) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: local,
        effectNextLevel: next,
        effectEndUser: end,
        causes,
    };
}

function mkWorkElement({ name, type, fnDesc, failures }) {
    return {
        id: randomUUID(),
        name,
        type,
        description: '',
        _autoFilled: true,
        functions: [{
            id: randomUUID(),
            description: fnDesc,
            functionDescription: fnDesc,
            requirements: '',
            failures,
        }],
    };
}

// ─── Bloque 1 — OP 10 RECEPCION: los 13 componentes del Plan de Control ─────
//
// Hoy la op 10 tiene 6 modos de falla genericos (golpe en transporte, contaminacion,
// especificacion erronea, trazabilidad) + flamabilidad/VOC sobre "Tela tapizado".
// El Plan de Control controla 13 componentes con ~40 caracteristicas. Lo que sigue
// baja al AMFE las caracteristicas del PdC cuya falla tiene consecuencia propia y
// que hoy no estan analizadas. Las verificaciones de "Tipo de producto" y "Color"
// no se duplican por componente: ya estan cubiertas por el FM 3 existente
// ("Material con especificacion erronea (dimensiones, color, dureza, etc.)").

const NUEVOS_WE_OP10 = [
    mkWorkElement({
        name: 'Vinilo Titan Black PVC 197.025.0425-6',
        type: 'Material',
        fnDesc: 'Aportar vinilo de tapizado con el espesor y el gramaje especificados',
        failures: [
            mkFailure({
                desc: 'Espesor del vinilo fuera de 1,8 - 2,5 mm',
                local: 'Lote segregado en recepcion; falta de material para el corte',
                next: 'Variacion en el tapizado y en el ajuste de la funda sobre el sustrato espumado',
                end: 'Aspecto y tacto del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'Lote del proveedor fuera de la tolerancia de espesor declarada',
                    s: 5, o: 3, d: 4,
                    prev: 'Certificado del proveedor por lote (P-14)',
                    det: 'Medicion con medidor de espesor, 1 muestra por entrega (P-10/I)',
                })],
            }),
            mkFailure({
                desc: 'Gramaje del vinilo fuera de 800 - 1000 g/m2',
                local: 'Lote segregado en recepcion',
                next: 'Variacion de rigidez de la funda en la costura y el tapizado',
                end: 'Tacto del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'Variacion del proceso de laminado en el proveedor',
                    s: 5, o: 3, d: 4,
                    prev: 'Certificado del proveedor por lote (P-14)',
                    det: 'Pesaje en balanza, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Cinta sarga negra 25 mm (codigo 5826)',
        type: 'Material',
        fnDesc: 'Aportar la cinta sarga con el espesor especificado',
        failures: [
            mkFailure({
                desc: 'Espesor de la cinta sarga fuera de 1,2 +/- 0,1 mm',
                local: 'Lote segregado en recepcion',
                next: 'Variacion en el cosido de la cinta a la funda',
                end: 'Aspecto de la cinta fuera de estandar',
                causes: [mkCause({
                    desc: 'Lote del proveedor fuera de la tolerancia de espesor declarada',
                    s: 4, o: 3, d: 4,
                    prev: 'Certificado del proveedor por lote (P-14)',
                    det: 'Medicion con medidor de espesor, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Isocianato ISO-PLUS 1394',
        type: 'Material',
        fnDesc: 'Aportar isocianato dentro de su vida util y con certificado de calidad de la entrega',
        failures: [
            mkFailure({
                desc: 'Isocianato recibido con vencimiento menor a 6 meses desde la fecha de recepcion',
                local: 'Lote segregado; la inyeccion de PUR se queda sin material',
                next: 'Espuma con curado incompleto o densidad fuera de especificacion; piezas a scrap',
                end: 'Firmeza y confort del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'El proveedor despacha un lote proximo a vencer',
                    s: 6, o: 3, d: 4,
                    prev: 'Vida util remanente mayor a 6 meses exigida en el Plan de Control de recepcion',
                    det: 'Verificacion de la fecha de vencimiento en la etiqueta de producto, 1 muestra por entrega (P-10/I)',
                })],
            }),
            mkFailure({
                desc: 'Lote de isocianato sin certificado de calidad de la entrega',
                local: 'Lote sin liberar en recepcion',
                next: 'No se puede acotar el alcance ante un desvio de espumado',
                end: 'Sin efecto directo sobre el usuario',
                causes: [mkCause({
                    desc: 'El proveedor omite el certificado de calidad en la entrega',
                    s: 6, o: 3, d: 3,
                    prev: 'P-14: no aceptar el lote sin certificado valido',
                    det: 'Revision del certificado del proveedor en recepcion (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Poliol POLIPLUS FF629',
        type: 'Material',
        fnDesc: 'Aportar poliol dentro de su vida util y con certificado de calidad de la entrega',
        failures: [
            mkFailure({
                desc: 'Poliol recibido con vencimiento menor a 6 meses desde la fecha de recepcion',
                local: 'Lote segregado; la inyeccion de PUR se queda sin material',
                next: 'Espuma con curado incompleto o densidad fuera de especificacion; piezas a scrap',
                end: 'Firmeza y confort del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'El proveedor despacha un lote proximo a vencer',
                    s: 6, o: 3, d: 4,
                    prev: 'Vida util remanente mayor a 6 meses exigida en el Plan de Control de recepcion',
                    det: 'Verificacion de la fecha de vencimiento en la etiqueta de producto, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Posavasos 2HC.885.119 (consignado VWA)',
        type: 'Material',
        fnDesc: 'Aportar el posavasos con las pestanas de retencion funcionales',
        failures: [
            mkFailure({
                desc: 'Las pestanas de retencion del posavasos no sujetan el vaso (rotura, deformacion o interferencia)',
                local: 'Componente segregado en recepcion',
                next: 'Montaje en la operacion 61 con el posavasos no funcional',
                end: 'El vaso no queda sujeto y se cae durante la marcha',
                causes: [mkCause({
                    desc: 'Pieza inyectada por el proveedor fuera de tolerancia en las pestanas de retencion',
                    s: 7, o: 3, d: 4,
                    prev: 'Plan de control acordado con el proveedor del componente consignado por VWA',
                    det: 'Ensayo funcional colocando un vaso patron, por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Estructura del apoyabrazos 2HC.885.925 (consignado VWA)',
        type: 'Material',
        fnDesc: 'Aportar la estructura con la pintura de proteccion completa',
        failures: [
            mkFailure({
                desc: 'Estructura con faltante de pintura',
                local: 'Componente segregado en recepcion',
                next: 'Estructura espumada con zona sin proteccion, no accesible despues del espumado',
                end: 'Corrosion en la zona no protegida a lo largo de la vida del vehiculo',
                causes: [mkCause({
                    desc: 'Cobertura incompleta en el proceso de pintura del proveedor',
                    s: 6, o: 3, d: 4,
                    prev: 'Plan de control acordado con el proveedor del componente consignado por VWA',
                    det: 'Verificacion contra patron de aspecto, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Cierre FT156 CIF C 056 (codigo 427VAR001COS01)',
        type: 'Material',
        fnDesc: 'Aportar el cierre con el largo especificado y la cremallera completa',
        failures: [
            mkFailure({
                desc: 'Largo del cierre fuera de 360 +/- 1 mm',
                local: 'Cierre segregado; falta de componente para la costura',
                next: 'La funda no cierra o queda con tension en la operacion 60',
                end: 'Abertura que permite ver el interior del apoyabrazos',
                causes: [mkCause({
                    desc: 'Corte del cierre fuera de tolerancia en el proveedor',
                    s: 6, o: 3, d: 4,
                    prev: 'Informe de control del proveedor por lote',
                    det: 'Medicion manual del largo, 1 muestra por entrega (P-10/I)',
                })],
            }),
            mkFailure({
                desc: 'Cierre con dientes faltantes o danados',
                local: 'Cierre segregado en recepcion',
                next: 'El cierre no corre o se abre en la operacion 60',
                end: 'Abertura que permite ver el interior del apoyabrazos',
                causes: [mkCause({
                    desc: 'Dano del cierre durante el transporte o el almacenamiento',
                    s: 6, o: 3, d: 3,
                    prev: 'Criterio de aspecto del cierre definido en el Plan de Control de recepcion',
                    det: 'Inspeccion visual contra patron de aspecto, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Fieltro duro agujado 480 g/m2 blanco (codigo PA3840)',
        type: 'Material',
        fnDesc: 'Aportar el fieltro duro con el gramaje y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Gramaje del fieltro duro fuera de 480 g/m2',
                local: 'Lote segregado en recepcion',
                next: 'Variacion del espesor y la rigidez del conjunto espumado',
                end: 'Firmeza del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'Variacion del proceso de agujado en el proveedor',
                    s: 5, o: 3, d: 4,
                    prev: 'Certificado del proveedor por lote (P-14)',
                    det: 'Pesaje en balanza, 1 muestra por entrega (P-10/I)',
                })],
            }),
            mkFailure({
                desc: 'Flamabilidad del fieltro duro mayor a 100 mm/min',
                local: 'Lote no conforme, material a segregar',
                next: 'Rechazo del ensayo de flamabilidad en auditoria del cliente',
                end: 'Riesgo para la seguridad del usuario del vehiculo',
                causes: [mkCause({
                    desc: 'Proveedor sin informe de control de flamabilidad vigente del lote',
                    s: 9, o: 3, d: 3,
                    prev: 'Informe de control de flamabilidad del proveedor por lote',
                    det: 'Verificacion documental P-14',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Fieltro punzonado Resilin 300/20 Titan Black (codigo 427VIN026COR01)',
        type: 'Material',
        fnDesc: 'Aportar el fieltro punzonado con el gramaje y la flamabilidad especificados',
        failures: [
            mkFailure({
                desc: 'Gramaje del fieltro punzonado fuera de 270 - 320 g/m2',
                local: 'Lote segregado en recepcion',
                next: 'Variacion del espesor del conjunto espumado',
                end: 'Firmeza del apoyabrazos fuera de estandar',
                causes: [mkCause({
                    desc: 'Variacion del proceso de punzonado en el proveedor',
                    s: 5, o: 3, d: 4,
                    prev: 'Certificado del proveedor por lote (P-14)',
                    det: 'Pesaje en balanza, 1 muestra por entrega (P-10/I)',
                })],
            }),
            mkFailure({
                desc: 'Flamabilidad del fieltro punzonado mayor a 100 mm/min',
                local: 'Lote no conforme, material a segregar',
                next: 'Rechazo del ensayo de flamabilidad en auditoria del cliente',
                end: 'Riesgo para la seguridad del usuario del vehiculo',
                causes: [mkCause({
                    desc: 'Proveedor sin informe de control de flamabilidad vigente del lote',
                    s: 9, o: 3, d: 3,
                    prev: 'Informe de control de flamabilidad del proveedor por lote',
                    det: 'Verificacion documental P-14',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Cinta de gancho Aplix Long Loop 10 x 60 mm (codigo APLIX_225LLB)',
        type: 'Material',
        fnDesc: 'Aportar la cinta de gancho con la flamabilidad y el dimensional especificados',
        failures: [
            mkFailure({
                desc: 'Flamabilidad de la cinta de gancho mayor a 100 mm/min',
                local: 'Lote no conforme, material a segregar',
                next: 'Rechazo del ensayo de flamabilidad en auditoria del cliente',
                end: 'Riesgo para la seguridad del usuario del vehiculo',
                causes: [mkCause({
                    desc: 'Proveedor sin informe de control de flamabilidad vigente del lote',
                    s: 9, o: 3, d: 3,
                    prev: 'Informe de control de flamabilidad del proveedor por lote',
                    det: 'Verificacion documental P-14',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Tornillo fijador 2HC.075.701.GS (consignado VWA)',
        type: 'Material',
        fnDesc: 'Aportar el tornillo fijador con el largo especificado',
        failures: [
            mkFailure({
                desc: 'Largo del tornillo fijador fuera de 12,2 +/- 0,5 mm',
                local: 'Componente segregado en recepcion',
                next: 'El tornillo no fija el apoyabrazos o sobresale del alojamiento en el montaje del cliente',
                end: 'Apoyabrazos flojo o tornillo visible',
                causes: [mkCause({
                    desc: 'Lote del proveedor fuera de la tolerancia dimensional',
                    s: 7, o: 2, d: 4,
                    prev: 'Plan de control acordado con el proveedor del componente consignado por VWA',
                    det: 'Revision del informe de control del proveedor, por entrega (P-10/I)',
                })],
            }),
        ],
    }),

    mkWorkElement({
        name: 'Hilo de union 30/3 Jet Black (codigo FX284TK-E0PTO)',
        type: 'Material',
        fnDesc: 'Aportar el hilo de union con la cantidad de cabos especificada',
        failures: [
            mkFailure({
                desc: 'Hilo recibido con cantidad de cabos distinta de 30/3',
                local: 'Lote segregado en recepcion',
                next: 'Costura de la operacion 40 con resistencia menor a la especificada',
                end: 'Costura abierta en uso',
                causes: [mkCause({
                    desc: 'Error de identificacion del articulo en el proveedor',
                    s: 7, o: 2, d: 4,
                    prev: 'Etiqueta de producto verificada contra el codigo del articulo en recepcion',
                    det: 'Verificacion visual manual de la cantidad de cabos, 1 muestra por entrega (P-10/I)',
                })],
            }),
        ],
    }),
];

// ─── Bloque 2 — OP 50 INYECCION DE PUR: lo que el PdC controla y el AMFE no ──
// PdC operacion 40 (= 50 del flujograma), items 2, 3 y 4: adherencia
// estructura-espuma, adherencia espuma-hard felt + Aplix, y apariencia sin
// burbujas de aire. Los tres se controlan al 100% por lote y ninguno tenia
// modo de falla en el AMFE. Inyeccion PU fuera de spec = SCRAP (amfe.md §1).

const NUEVAS_FALLAS_OP50 = [
    mkFailure({
        desc: 'Adherencia insuficiente entre la estructura y la espuma',
        local: 'Pieza a scrap (la inyeccion de PU fuera de especificacion no se retrabaja)',
        next: 'Deteccion en el control final; parada del puesto de tapizado por falta de sustrato',
        end: 'La espuma se despega de la estructura en uso',
        causes: [mkCause({
            desc: 'Estructura con contaminacion o resto de desmoldante en la zona de adherencia',
            s: 7, o: 4, d: 4,
            prev: 'Hoja de set-up de la maquina Purmatic verificada al inicio de turno',
            det: 'Control visual contra muestra patron, por lote (100%), autocontrol',
        })],
    }),
    mkFailure({
        desc: 'Adherencia insuficiente entre la espuma y el hard felt con Aplix',
        local: 'Pieza a scrap (la inyeccion de PU fuera de especificacion no se retrabaja)',
        next: 'Deteccion en el control final; el Aplix no sujeta en el montaje del cliente',
        end: 'El apoyabrazos no queda retenido en su posicion',
        causes: [mkCause({
            desc: 'Hard felt o Aplix mal posicionado en el molde antes de la colada',
            s: 7, o: 4, d: 4,
            prev: 'Hoja de set-up de la maquina Purmatic verificada al inicio de turno',
            det: 'Control visual contra muestra patron, por lote (100%), autocontrol',
        })],
    }),
    mkFailure({
        desc: 'Espuma con burbujas de aire o marcas en la superficie',
        local: 'Pieza a scrap (la inyeccion de PU fuera de especificacion no se retrabaja)',
        next: 'Deteccion en el control final',
        end: 'Superficie irregular perceptible al tacto a traves de la funda',
        causes: [mkCause({
            desc: 'Aire atrapado en la cavidad por el punto de colada o el tiempo de colada',
            s: 5, o: 4, d: 4,
            prev: 'Hoja de set-up de la maquina Purmatic verificada al inicio de turno',
            det: 'Control visual de apariencia, por lote, autocontrol',
        })],
    }),
];

// ─── Bloque 3 — OP 60 TAPIZADO: posicion del felt (PdC op 41 item 4) ────────

const NUEVA_FALLA_OP60 = mkFailure({
    desc: 'Felt fuera de posicion respecto del vinilo',
    local: 'Retrabajo del tapizado en el puesto',
    next: 'Deteccion en el control final; pieza al reproceso de re-tapizado (operacion 82)',
    end: 'Relieve o escalon perceptible en la superficie del apoyabrazos',
    causes: [mkCause({
        desc: 'Colocacion del felt sin referencia respecto del vinilo durante el pre-montaje',
        s: 5, o: 4, d: 4,
        prev: 'Hoja de set-up del horno verificada al inicio de turno',
        det: 'Control visual contra muestra patron, por lote (100%), autocontrol',
    })],
});

// ─── Bloque 4 — OP 61 MONTAJE DE PORTAVASOS Y MARCO (operacion nueva) ───────
// PdC operacion 42 "Porta vasos + Soporte porta-vasos" + [ING] 13/08/2026: va
// despues del tapizado. Ya esta en la HO-986 como pestana 61. El flujograma
// todavia no la muestra (queda para la Rev B del flujograma).
// El modo de falla "Cup holder no encastra o no traba" se MUEVE desde la op 60
// (donde estaba mal alojado) con sus 3 causas y sus S/O/D intactos.

const OP61_FOCUS =
    'Funcion Interna: Proveer armrest trasero central conforme dimensional, costuras y tapizado sin defectos' +
    ' / Funcion del Cliente: Permitir el montaje final del respaldo trasero del asiento sin interferencia ni Gap & Flush fuera de spec' +
    ' / Funcion del Usuario Final: Brindar comodidad ergonomica al pasajero trasero, estetica coherente con interior y ausencia de S&R';

// ─── Main ───────────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, data, revisions')
    .eq('amfe_number', AMFE_NUMBER);
if (error) throw error;
if (!rows || rows.length !== 1) throw new Error(`Esperaba 1 fila para AMFE ${AMFE_NUMBER}, hay ${rows?.length}`);

const row = rows[0];
const before = parseData(row.data);
const after = JSON.parse(JSON.stringify(before));

const statsBefore = countAmfeStats(before);

// ── 1. OP 10 — nuevos work elements de recepcion
const op10 = findOperation(after, '10');
if (!op10) throw new Error('No se encontro la operacion 10');
const nombresPrevios10 = new Set(op10.workElements.map(w => (w.name || '').toLowerCase()));
for (const we of NUEVOS_WE_OP10) {
    if (nombresPrevios10.has(we.name.toLowerCase())) {
        console.log(`  (ya existe, se omite) OP10 WE "${we.name}"`);
        continue;
    }
    op10.workElements.push(we);
    const nFallas = we.functions[0].failures.length;
    logChange(apply, `OP10 + WE [Material] "${we.name}"`, {
        fallas: nFallas,
        detalle: we.functions[0].failures.map(f => f.description).join(' | '),
    });
}

// ── 2. OP 50 — modos de falla de adherencia y burbujas (WE6 Machine)
const op50 = findOperation(after, '50');
const we50Machine = op50.workElements.find(w => w.type === 'Machine');
if (!we50Machine) throw new Error('OP50 sin work element Machine');
const fn50 = we50Machine.functions[0];
fn50.failures = fn50.failures || [];
const desc50 = new Set(fn50.failures.map(f => (f.description || '').toLowerCase()));
for (const fa of NUEVAS_FALLAS_OP50) {
    if (desc50.has(fa.description.toLowerCase())) { console.log(`  (ya existe) OP50 "${fa.description}"`); continue; }
    fn50.failures.push(fa);
    logChange(apply, `OP50 WE "${we50Machine.name}" + FM "${fa.description}"`, {
        SOD: fa.causes.map(c => `S${c.severity}/O${c.occurrence}/D${c.detection}/AP${c.ap}`).join(','),
    });
}

// ── 3. OP 60 — posicion del felt, y baja del cup holder (se mueve a la 61)
const op60 = findOperation(after, '60');
const we60Material = op60.workElements.find(w => w.type === 'Material');
if (!we60Material) throw new Error('OP60 sin work element Material');
const fn60 = we60Material.functions[0];

// Extraer el failure del cup holder para moverlo a la op 61 (conserva S/O/D e ids de causa)
let fmCupHolder = null;
fn60.failures = (fn60.failures || []).filter(f => {
    if (/cup\s*holder/i.test(f.description || '')) { fmCupHolder = f; return false; }
    return true;
});
if (fmCupHolder) {
    logChange(apply, `OP60 -> OP61: se MUEVE el FM "${fmCupHolder.description}"`, {
        causas: fmCupHolder.causes.length,
        SOD: fmCupHolder.causes.map(c => `S${c.severity}/O${c.occurrence}/D${c.detection}`).join(','),
    });
}
if (!fn60.failures.some(f => /felt fuera de posicion/i.test(f.description || ''))) {
    fn60.failures.push(NUEVA_FALLA_OP60);
    logChange(apply, `OP60 WE "${we60Material.name}" + FM "${NUEVA_FALLA_OP60.description}"`);
}

// ── 4. OP 61 nueva
if (findOperation(after, '61')) {
    console.log('  (ya existe) operacion 61 — no se crea de nuevo');
} else {
    const weMontaje = mkWorkElement({
        name: 'Operador de Produccion',
        type: 'Man',
        fnDesc: 'Montar el posavasos y su marco sobre el apoyabrazos tapizado y verificar el encastre',
        failures: [],
    });
    // El FM movido de la op 60 va aca; si no se encontro, se crea el equivalente
    // del Plan de Control (op 42 item 1) para no dejar el WE sin analisis.
    weMontaje.functions[0].failures = fmCupHolder ? [fmCupHolder] : [mkFailure({
        desc: 'Adherencia incorrecta del posavasos con el soporte del posavasos',
        local: 'Retrabajo del montaje en el puesto',
        next: 'Deteccion en el control final',
        end: 'El posavasos se suelta en uso',
        causes: [mkCause({
            desc: 'Encastre incompleto del posavasos sobre el soporte',
            s: 6, o: 4, d: 5,
            prev: 'Muestra patron del conjunto montado en el puesto',
            det: 'Control visual contra muestra patron, por lote (100%), autocontrol',
        })],
    })];

    const weComponentes = mkWorkElement({
        name: 'Posavasos y marco consignados por VWA',
        type: 'Material',
        fnDesc: 'Aportar el posavasos y el marco en condiciones aptas para el montaje',
        failures: [mkFailure({
            desc: 'Posavasos o marco con cortes, manchas o marcas despues del montaje',
            // Un plastico cortado o marcado no se retrabaja: se cambia el componente.
            local: 'Cambio del componente en el puesto; el posavasos danado va a scrap',
            next: 'Deteccion en el control final',
            end: 'Defecto de aspecto visible en la zona del posavasos',
            causes: [mkCause({
                desc: 'Manipulacion del componente sin proteccion durante el montaje',
                s: 4, o: 4, d: 4,
                prev: 'Muestra patron de aspecto disponible en el puesto',
                det: 'Control visual de apariencia, por lote (100%), autocontrol',
            })],
        })],
    });

    const op61 = {
        id: randomUUID(),
        name: 'MONTAJE DE PORTAVASOS Y MARCO',
        opNumber: '61',
        operationName: 'MONTAJE DE PORTAVASOS Y MARCO',
        operationNumber: '61',
        operationFunction: 'Montar el posavasos y el marco del posavasos sobre el apoyabrazos ya tapizado y verificar el encastre y la apertura',
        focusElementFunction: OP61_FOCUS,
        workElements: [weMontaje, weComponentes],
    };
    // Insertar despues de la 60 para que el orden del export siga el flujograma
    const idx60 = after.operations.findIndex(o => String(o.operationNumber) === '60');
    after.operations.splice(idx60 + 1, 0, op61);
    logChange(apply, 'ALTA operacion 61 "MONTAJE DE PORTAVASOS Y MARCO"', {
        fuente: 'Plan de Control op 42 + Ingenieria 13/08/2026',
        workElements: 2,
    });
}

// ── 5. Fila de revision (documento vivo: NO sube la letra, regla revision-no-sube)
// OJO: `revisions` es una COLUMNA propia de amfe_documents, no vive dentro de `data`
// (la caratula del export lee la columna). Se escriben las dos, y la base es la columna.
const revisionsColBefore = (() => {
    const raw = row.revisions;
    if (Array.isArray(raw)) return raw;
    try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
})();
const revisions = revisionsColBefore.slice();
const FILA_REV = {
    rev: 'A',
    date: '14/08/2026',
    item: '10, 50, 60, 61',
    description: 'REVISION CONTRA EL FLUJOGRAMA I-IN-002/III REV A Y EL PLAN DE CONTROL PRELIMINAR DEL 31/07/2026. '
        + 'SE AMPLIA LA RECEPCION DE MATERIA PRIMA A LOS 13 COMPONENTES DEL PLAN DE CONTROL, SE AGREGAN LOS MODOS DE FALLA '
        + 'DE ADHERENCIA Y BURBUJAS DE LA INYECCION DE PUR, LA POSICION DEL FELT EN EL TAPIZADO, Y SE ABRE LA OPERACION 61 '
        + 'MONTAJE DE PORTAVASOS Y MARCO.',
    pswDate: '',
    modifiedBy: 'FS',
};
if (!revisions.some(r => r.date === FILA_REV.date)) {
    revisions.push(FILA_REV);
    after.revisions = revisions;
    logChange(apply, 'Fila de revision 14/08/2026 (rev A — el producto no entro en serie)');
}

// ── 6. Sincronizar campos legacy y alias que leen los exports
syncLegacyFmFields(after);
syncFieldAliases(after);

const statsAfter = countAmfeStats(after);
console.log('\n--- CONTEO before -> after ---');
for (const k of Object.keys(statsAfter)) {
    const b = statsBefore[k], a = statsAfter[k];
    console.log(`  ${k.padEnd(16)} ${String(b).padStart(4)} -> ${String(a).padStart(4)}  ${a !== b ? `(${a - b > 0 ? '+' : ''}${a - b})` : ''}`);
}

await runWithValidation(
    [{ id: row.id, amfeNumber: AMFE_NUMBER, productName: 'ARMREST_REAR_CEN', before, after }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, after, {
            expectedAmfeNumber: AMFE_NUMBER,
            extraFields: { revisions: JSON.stringify(after.revisions) },
        });
        // Verificacion post-escritura obligatoria (database.md §4)
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const relido = parseData(chk.data);
        if (typeof relido !== 'object' || !Array.isArray(relido.operations)) {
            throw new Error('POST-CHECK FALLO: data no es objeto con operations[]');
        }
        const s = countAmfeStats(relido);
        console.log(`\nPOST-CHECK live: ops=${relido.operations.length} ${JSON.stringify(s)}`);
        if (relido.operations.length !== after.operations.length) {
            throw new Error(`POST-CHECK FALLO: ops live=${relido.operations.length} esperado=${after.operations.length}`);
        }
    },
);

finish(apply);
