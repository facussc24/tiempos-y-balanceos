/**
 * AMFE 158 (INSERT) — carga las tres operaciones del sector TAPIZADO que el AMFE no tenia:
 * 100 TAPIZADO SEMIAUTOMATICO, 101 VIROLADO MANUAL y 102 REFILADO POST-TAPIZADO.
 *
 * POR QUE FALTABAN
 * El flujograma 154 Rev.A dibujaba el 100 TAPIZADO y el AMFE nunca lo tuvo. El virolado y el
 * refilado no los dibujaba ningun flujograma: aparecieron al abrir la HO-215 el 08/09/2026 y
 * entraron en el flujograma 154 Rev.B. Orden APQP: manda el flujograma.
 *
 * DE DONDE SALE CADA DATO — todo de la HO-215 `HO215_INSERT PATAGONIA_REV.pdf`, casillero 26
 * del legajo, leida el 08/09/2026. No hay ningun dato inventado:
 *   - OP 100 <- HO-215 OP 30 TAPIZADO SEMIAUTOMATICO (sector TAPIZADO, aprobo G. Cal,
 *     10/03/2026): los 6 pasos, la guia/canaleta donde se apoya el borde de la costura, y su
 *     ciclo de control (parametros de maquina con timer/display al inicio de turno;
 *     temperatura de vinilo y sustrato con termometro infrarrojo, Calidad, cada 2 horas).
 *   - OP 101 <- HO-215 OP 31 VIROLADO MANUAL, 3 paginas (aprobo C. Baptista, 06/07/2026): los
 *     7 pasos, las tres advertencias escritas en la hoja (no presionar la zona vista, empezar
 *     el cierre por el extremo con radio, activar el adhesivo con pistola de calor si la pieza
 *     perdio temperatura) y la verificacion final visual y tactil del paso 7.
 *   - OP 102 <- HO-215 OP 40 REFILADO DE PIEZA (sector TAPIZADO, aprobo G. Cal, 10/03/2026):
 *     cutter, imagen de referencia, y verificacion contra la pieza patron del puesto al inicio
 *     de turno y en cada cambio de lote.
 *
 * LO QUE NO SE ESCRIBE PORQUE NO LO DICE NINGUNA FUENTE
 *   - El ciclo de control de la OP 31 esta en TBD en las tres paginas de la HO. Por eso la
 *     deteccion del virolado sale de la verificacion del paso 7, que si esta escrita, y no de
 *     una frecuencia que habria que inventar.
 *   - Las caracteristicas especiales quedan VACIAS: las asigna Fak o el cliente
 *     (core-prohibiciones.md §2). Las causas nuevas que cumplen el criterio del I-AC-005 se
 *     reportan al final para que las mire.
 *   - Las acciones de optimizacion de las causas AP=H van con el placeholder autorizado.
 *
 * CALIFICACION
 *   - S sale del EFECTO (amfe.md §13) y viaja con el; el AP lo calcula `calculateAP`.
 *   - D por la Tabla P3: verificacion humana en la propia estacion = 7, aguas abajo = 8,
 *     control que no cubre el 100% del producto = 9. El refilado se verifica contra la pieza
 *     patron al inicio de turno y por lote: es muestreo, va 9.
 *   - O por la Tabla P2: el INSERT esta en PPAP, no en serie, asi que ninguna causa puede ir a
 *     O=3. Las tres causas que la propia HO advierte por escrito van a 6 (proceso conocido con
 *     no conformidades); el resto a 5.
 *
 * La revision NO sube de letra: el INSERT no entro en serie (Fak, 03/08/2026). Las filas
 * nuevas del log van como Rev. A.
 *
 * Uso:  node scripts/_agregarOpsTapizadoInsert.mjs            (dry-run)
 *       node scripts/_agregarOpsTapizadoInsert.mjs --apply
 */
import { randomUUID } from 'crypto';
import { connectSupabase, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const id = () => randomUUID();

// ─── Efectos: la S vive en el efecto, no en el modo de falla ────────────────
// Tabla P1: 7 = "A portion of the production run may have to be scrapped";
//           6 = "Loss of convenience function" / retrabajo fuera de linea.
const EF_ASPECTO = {
    s: 6,
    local: 'Pieza con defecto de aspecto que debe retrabajarse fuera de linea',
    next: 'Retrabajo o rechazo de la pieza antes del despacho',
    end: 'Defecto de aspecto visible en el panel de puerta del vehiculo',
};
const EF_DESPRENDE = {
    s: 6,
    local: 'Pieza con el vinilo despegado del sustrato, retrabajo fuera de linea',
    next: 'Retrabajo o rechazo de la pieza antes del despacho',
    end: 'Vinilo levantado a la vista en el panel de puerta del vehiculo',
};
// amfe.md §1: en una operacion de CORTE el material mal cortado no tiene vuelta atras.
const EF_SCRAP_CORTE = {
    s: 7,
    local: 'Scrap de la pieza tapizada: el material recortado no se repone',
    next: 'Reposicion de la pieza y atraso en la entrega del lote',
    end: 'Sin efecto en el vehiculo: la pieza no sale de planta',
};

const causa = (descripcion, prevControl, O, detControl, D) => ({
    id: id(),
    cause: descripcion,
    description: descripcion,
    preventionControl: prevControl,
    detectionControl: detControl,
    occurrence: O,
    detection: D,
    specialChar: '',
    characteristicNumber: '',
    filterCode: '',
    recommendedAction: '',
    optimizationAction: '',
});

function falla(descripcion, ef, causas) {
    for (const c of causas) {
        c.severity = ef.s;
        const ap = calculateAP(ef.s, c.occurrence, c.detection);
        c.ap = ap;
        c.actionPriority = ap;
        // amfe.md §4: AP=H sin accion es bloqueo IATF; la accion la define el equipo APQP.
        if (ap === 'H' && !c.optimizationAction) c.optimizationAction = 'Pendiente definicion equipo APQP';
    }
    return {
        id: id(),
        description: descripcion,
        severity: ef.s,
        effectLocal: ef.local,
        effectNextLevel: ef.next,
        effectEndUser: ef.end,
        causes: causas,
    };
}

const funcion = (descripcion, requisitos, fallas) => ({
    id: id(),
    description: descripcion,
    functionDescription: descripcion,
    requirements: requisitos,
    failures: fallas,
});

const we = (type, name, funciones) => ({ id: id(), name, type, functions: funciones });

const operacion = (numero, nombre, funcionOperacion, funcionFoco, workElements) => ({
    id: id(),
    opNumber: numero,
    operationNumber: numero,
    name: nombre,
    operationName: nombre,
    operationFunction: funcionOperacion,
    focusElementFunction: funcionFoco,
    workElements,
});

// ───────────────────────────────────────────────────────────────────────────
const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-INS-PAT');
if (error) throw error;
if (rows.length !== 1) throw new Error(`Esperaba 1 AMFE-INS-PAT, encontre ${rows.length}`);

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

const existentes = (doc.operations || []).map((o) => String(o.opNumber));
const yaEstan = ['100', '101', '102'].filter((n) => existentes.includes(n));
if (yaEstan.length) throw new Error(`El AMFE ya tiene las operaciones ${yaEstan.join(', ')}: no se duplica`);
if (!existentes.includes('93')) throw new Error('Corre primero _renumerarAmfeInsert.mjs: falta la OP 93');

// La funcion de nivel 1 es la misma en todas las operaciones del documento (amfe.md §8):
// se toma del propio AMFE en vez de reescribirla.
const FOCO = String((doc.operations || []).find((o) => o.focusElementFunction)?.focusElementFunction || '');
if (!FOCO) throw new Error('No pude leer focusElementFunction de ninguna operacion');

// ─── OP 100 TAPIZADO SEMIAUTOMATICO ────────────────────────────────────────
const OP100 = operacion(
    '100',
    'TAPIZADO SEMIAUTOMATICO',
    'Unir el vinilo cosido al sustrato plastico por vacio y temperatura, con el borde de la costura asentado en la guia de la maquina y sin defectos de aspecto en la cara vista',
    FOCO,
    [
        we('Machine', 'Maquina de tapizado semiautomatico', [
            funcion(
                'Generar el vacio sobre la pieza plastica y ejecutar el ciclo de tapizado con los tiempos parametrizados',
                'Parametros de maquina segun el set-up de la pieza',
                [
                    falla('Ciclo de tapizado ejecutado con tiempos fuera del set-up', EF_DESPRENDE, [
                        causa(
                            'Tiempos de ciclo cargados en la maquina distintos a los del set-up de la pieza',
                            'Verificacion de los parametros de maquina en el timer / display al inicio de turno (HO-215 OP 30)',
                            5,
                            'Verificacion visual y tactil del pegado del borde en el virolado (OP 101)',
                            8,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Man', 'Operador de Produccion', [
            funcion(
                'Colocar las piezas plasticas en la parte superior de la maquina y ubicar el vinilo abajo haciendo coincidir el borde de la costura con la guia / canaleta',
                'Borde de la costura asentado en la guia / canaleta antes de iniciar el ciclo',
                [
                    falla('Vinilo tapizado corrido respecto del sustrato', EF_ASPECTO, [
                        causa(
                            'El borde de la costura no queda asentado en la guia / canaleta al cargar el vinilo',
                            'Guia / canaleta de posicionamiento del vinilo en la maquina (HO-215 OP 30 paso 4)',
                            5,
                            'Verificacion visual y tactil de la pieza en el virolado (OP 101)',
                            8,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Measurement', 'Termometro infrarrojo', [
            funcion(
                'Verificar la temperatura del vinilo y del sustrato en el control frecuencial del puesto',
                'Control frecuencial cada 2 horas a cargo de Calidad (HO-215 OP 30)',
                [
                    falla('Pieza tapizada con el vinilo o el sustrato fuera de temperatura', EF_DESPRENDE, [
                        causa(
                            'Deriva de la temperatura del vinilo o del sustrato entre dos controles frecuenciales',
                            'Verificacion de temperatura de vinilo y sustrato con termometro infrarrojo a cargo de Calidad, con la frecuencia del ciclo de control de la HO-215 OP 30',
                            5,
                            'Control frecuencial de temperatura a cargo de Calidad segun la HO-215 OP 30: no cubre el 100% de las piezas',
                            9,
                        ),
                    ]),
                ],
            ),
        ]),
    ],
);

// ─── OP 101 VIROLADO MANUAL ────────────────────────────────────────────────
// Las tres causas de esta operacion son las tres advertencias que la HO-215 OP 31 escribe en
// negrita: por eso van O=6 (Tabla P2, "proceso conocido con no conformidades") y no O=5.
const OP101 = operacion(
    '101',
    'VIROLADO MANUAL',
    'Cerrar la pieza pegando el vinilo sobrante sobre la parte trasera del sustrato y fijarlo con grampas, con los bordes lisos y sin arrugas y la cara vista sin hundimientos',
    FOCO,
    [
        we('Man', 'Operador de Produccion', [
            funcion(
                'Pegar el borde del vinilo sobre el sustrato de punta a punta, cerrar la pieza empezando por el extremo con radio y fijar la posicion final con grampas',
                'Bordes lisos y sin arrugas; cara vista sin hundimientos (HO-215 OP 31 paso 7)',
                [
                    falla('Hundimientos en la cara vista de la pieza', EF_ASPECTO, [
                        causa(
                            'El pegado del borde se hace apoyando los dedos sobre la zona vista en lugar del sustrato',
                            'Instruccion de la HO-215 OP 31: nunca presionar con los dedos la zona vista de la pieza',
                            6,
                            'Verificacion visual y tactil de la cara vista al terminar el virolado (HO-215 OP 31 paso 7)',
                            7,
                        ),
                    ]),
                    falla('Arrugas en el centro del borde cerrado', EF_ASPECTO, [
                        causa(
                            'El cierre de la pieza se inicia fuera del extremo con radio',
                            'Instruccion de la HO-215 OP 31: comenzar siempre el pegado por el extremo con radio y avanzar hacia los bordes',
                            6,
                            'Verificacion visual y tactil de los bordes al terminar el virolado (HO-215 OP 31 paso 7)',
                            7,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Machine', 'Pistola de calor', [
            funcion(
                'Reactivar el adhesivo del borde cuando la pieza ya perdio temperatura antes del pegado',
                'Adhesivo del borde activado antes de virolar una pieza que no viene recien salida de la OP 100',
                [
                    falla('Borde del vinilo sin pegar de punta a punta', EF_DESPRENDE, [
                        causa(
                            'La pieza llega al puesto con el adhesivo del borde frio porque no viene recien salida del tapizado',
                            'Instruccion de la HO-215 OP 31: activar el adhesivo de los bordes con la pistola de calor antes del pegado si la pieza perdio temperatura',
                            6,
                            'Verificacion visual y tactil de los bordes al terminar el virolado (HO-215 OP 31 paso 7)',
                            7,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Machine', 'Engrampadora neumatica', [
            funcion(
                'Fijar la posicion final del vinilo con grampas en la parte trasera del sustrato',
                'Grampas colocadas en la parte trasera del sustrato segun la HO-215 OP 31 pasos 4 y 6',
                [
                    falla('Vinilo sin fijar en la parte trasera del sustrato', EF_DESPRENDE, [
                        causa(
                            'La instruccion no define la cantidad ni la posicion de las grampas en la parte trasera',
                            'Instruccion de la HO-215 OP 31 pasos 4 y 6',
                            6,
                            'Verificacion visual de la parte trasera de la pieza en el control final (OP 110)',
                            8,
                        ),
                    ]),
                ],
            ),
        ]),
    ],
);

// ─── OP 102 REFILADO POST-TAPIZADO ─────────────────────────────────────────
const OP102 = operacion(
    '102',
    'REFILADO POST-TAPIZADO',
    'Recortar con cutter el vinilo sobrante de la pieza tapizada segun la imagen de referencia y verificar el contorno contra la pieza patron del puesto',
    FOCO,
    [
        we('Man', 'Operador de Produccion', [
            funcion(
                'Refilar el contorno completo de la pieza con el cutter y verificarlo contra la pieza patron del puesto',
                'Refilado conforme a la pieza patron (HO-215 OP 40 paso 3)',
                [
                    falla('Refilado fuera del contorno: se recorta material que la pieza necesita', EF_SCRAP_CORTE, [
                        causa(
                            'El limite del refilado se define por una imagen de referencia y no por una cota',
                            'Imagen de referencia y pieza patron de refilado junto al puesto (HO-215 OP 40)',
                            5,
                            'Verificacion del refilado contra la pieza patron al inicio de turno y en cada cambio de lote: no cubre el 100% de las piezas (HO-215 OP 40)',
                            9,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Machine', 'Cutter', [
            funcion(
                'Cortar el vinilo sobrante de la pieza tapizada',
                'Hoja en condiciones de corte',
                [
                    // amfe.md §1: el vinilo desgarrado de una pieza ya tapizada no se retrabaja.
                    falla('Corte irregular o desgarro del vinilo en el borde refilado', EF_SCRAP_CORTE, [
                        causa(
                            'Desgaste de la hoja del cutter',
                            'Cambio de hojas por calendario u horas de uso',
                            5,
                            'Verificacion visual del borde refilado en el control final (OP 110)',
                            8,
                        ),
                    ]),
                ],
            ),
        ]),
        we('Measurement', 'Pieza patron de refilado', [
            funcion(
                'Servir de referencia del contorno refilado en el puesto',
                'Pieza patron disponible junto al puesto (HO-215 OP 40 paso 3)',
                [
                    falla('Pieza patron ausente o no representativa del contorno vigente', EF_SCRAP_CORTE, [
                        causa(
                            'La pieza patron del puesto no tiene control de vigencia',
                            'Pieza patron de refilado junto al puesto (HO-215 OP 40 paso 3)',
                            5,
                            'Verificacion del refilado contra la pieza patron al inicio de turno y en cada cambio de lote: no cubre el 100% de las piezas (HO-215 OP 40)',
                            9,
                        ),
                    ]),
                ],
            ),
        ]),
    ],
);

const NUEVAS = [OP100, OP101, OP102];
for (const op of NUEVAS) {
    const we_ = op.workElements.length;
    const fm = op.workElements.reduce((a, w) => a + w.functions.reduce((b, f) => b + f.failures.length, 0), 0);
    const cs = op.workElements.reduce(
        (a, w) => a + w.functions.reduce((b, f) => b + f.failures.reduce((c, x) => c + x.causes.length, 0), 0),
        0,
    );
    logChange(apply, `OP ${op.opNumber} ${op.name}`, `${we_} elementos de trabajo · ${fm} modos de falla · ${cs} causas`);
}

doc.operations.push(...NUEVAS);
doc.operations.sort((a, b) => Number(a.opNumber) - Number(b.opNumber));

// ─── Log de revisiones: el INSERT no entro en serie, la letra sigue en A ────
const FECHA = '08/09/2026';
doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
const nuevasRevs = [
    ['20 / 21 / 22', 'SE AGRUPAN LAS OPERACIONES DE LA MESA DE CORTE EN LA MISMA DECENA: PREPARACION DE CORTE PASA A 20, CORTE DE COMPONENTES A 21 Y CONTROL CON MYLAR A 22.'],
    ['93', 'EL REPROCESO POR FALTA DE ADHESIVO PASA A 93, LA DECENA DE SU SECTOR.'],
    ['100', 'SE AGREGA LA OPERACION TAPIZADO SEMIAUTOMATICO.'],
    ['101', 'SE AGREGA LA OPERACION VIROLADO MANUAL.'],
    ['102', 'SE AGREGA LA OPERACION REFILADO POST-TAPIZADO.'],
];
for (const [item, details] of nuevasRevs) {
    doc.revisions.push({ rev: 'A', date: FECHA, item, details, pswDate: '', modifiedBy: 'FS' });
}
doc.header = doc.header || {};
doc.header.revDate = FECHA; // amfe.md §17.6: la caratula sigue a la ultima fila del log

console.log(`\nsecuencia final: ${doc.operations.map((o) => o.opNumber).join(' ')}`);

// Las caracteristicas especiales las asigna Fak. Se listan las causas nuevas que cumplen el
// criterio del I-AC-005 para que las mire, pero el script no marca ninguna.
const paraFak = [];
for (const op of NUEVAS) {
    for (const w of op.workElements) {
        for (const f of w.functions) {
            for (const fl of f.failures) {
                for (const c of fl.causes) {
                    if (fl.severity >= 9 || (fl.severity >= 5 && fl.severity <= 8 && c.occurrence >= 4)) {
                        paraFak.push(`OP${op.opNumber} S=${fl.severity} O=${c.occurrence} — ${c.cause}`);
                    }
                }
            }
        }
    }
}
if (paraFak.length) {
    console.log(`\nCausas nuevas que cumplen el criterio del I-AC-005 (las marca Fak, no el script): ${paraFak.length}`);
    paraFak.forEach((x) => console.log(`   ${x}`));
}

await runWithValidation(
    [{ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: row.amfe_number });
        console.log('   escrito AMFE-INS-PAT');
    },
);

finish(apply);
