/**
 * _buildAmfe3Grampas.mjs — Construye el AMFE-3 (Grupo Grampas PWA) SIN tocar Supabase.
 *
 * Genera tmp/amfe3.data.min.json (payload data, TEXT) + tmp/amfe3.insert.sql (INSERT
 * dollar-quoted) + tmp/amfe3.meta.json (counts + sha256 para verificar transporte).
 *
 * Reglas respetadas (ver .claude/rules/amfe*.md, skills/amfe-cookbook, supabase-safety):
 *  - calculateAP(s,o,d) oficial AIAG-VDA (nunca S*O*D).
 *  - Doble alias en todos los campos (opNumber/operationNumber, name/operationName,
 *    description/functionDescription, cause/description, ap/actionPriority).
 *  - 3 efectos VDA siempre. 1 item por Work Element (6M). Roles canonicos.
 *  - NO inventar controles/equipos/frecuencias. Sin parametros numericos (van al CP).
 *  - CC solo flamabilidad (S=10). Resto specialChar="". AP=H -> preventionAction placeholder.
 *  - Corte -> effectLocal = SCRAP. No "capacitacion" como causa.
 *
 * Fuente de datos: HANDOFF_PWA_2026-06-24.md (data de los 5 PCs) + AMFE-1 (plantilla).
 * Piezas: 21-6756, 21-6758, 21-6766, 21-7467, 21-7763 (overlock + engrampado manual).
 */
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { calculateAP, countAmfeStats, syncFieldAliases, syncLegacyFmFields } from './_lib/amfeIo.mjs';

const uid = () => randomUUID();

const FEF = 'Interno (Barack): Proveer funda textil plana conforme para asiento, con corte, costura y sujecion por grampas dentro de especificacion. / Cliente (PWA): Ensamble en linea sin retrabajos ni grampas faltantes, con cumplimiento dimensional y de materiales. / Usuario final: Confort y durabilidad del asiento, sujecion firme de la tela y cumplimiento de flamabilidad del cliente.';

// ─── builders ────────────────────────────────────────────────────────────────
function cause(text, s, o, d, { prev = '', det = '', sc = '' } = {}) {
    const ap = calculateAP(s, o, d);
    return {
        id: uid(), ap, actionPriority: ap,
        cause: text, description: text,
        severity: s, occurrence: o, detection: d,
        specialChar: sc, classification: '',
        preventionControl: prev, detectionControl: det,
        // AP=H exige accion: placeholder oficial (no se inventan acciones reales)
        preventionAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
        detectionAction: '', actionTaken: '', responsible: '', targetDate: '',
        status: '', completionDate: '', observations: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        filterCode: '', characteristicNumber: '',
    };
}
const fail = (description, [efl, efn, efu], causes) => ({
    id: uid(), description,
    effectLocal: efl, effectNextLevel: efn, effectEndUser: efu,
    causes,
});
const fn = (description, failures) => ({ id: uid(), description, functionDescription: description, requirements: '', failures });
const we = (name, type, functions) => ({ id: uid(), name, type, functions });
const op = (num, name, responsible, machineDeviceTool, productLocation, workElements) => ({
    id: uid(), name, operationName: name, opNumber: num, operationNumber: num,
    responsible, productLocation, machineDeviceTool,
    operationFunction: '', focusElementFunction: FEF, workElements,
});

// ─── operaciones ───────────────────────────────────────────────────────────--
const operations = [
    // OP10 RECEPCION
    op('10', 'RECEPCION DE MATERIA PRIMA', 'Inspector de Calidad', 'Area de recepcion', 'Sector de recepcion', [
        we('Tela Punzonado Blanco', 'Material', [
            fn('Proveer tela base conforme a especificacion', [
                fail('Identificacion incorrecta del material',
                    ['Material mal identificado en stock', 'Material incorrecto ingresa al proceso', 'Producto con material equivocado'],
                    [cause('Etiqueta del proveedor no coincide con OC', 7, 3, 4, { prev: 'Procedimiento de recepcion P-14', det: 'Inspeccion de recepcion vs remito y OC' })]),
                fail('Flamabilidad fuera de norma del cliente PWA',
                    ['Rechazo del lote completo', 'Detencion de produccion por falta de material', 'Riesgo de seguridad del pasajero ante incendio'],
                    [cause('Proveedor con proceso de fabricacion fuera de control', 10, 2, 3, { sc: 'CC', prev: 'Certificado de flamabilidad del proveedor (norma PWA)', det: 'Ensayo de flamabilidad en camara MC184 (norma PWA) segun P-14' })]),
                fail('Gramaje fuera de especificacion',
                    ['Lote observado en recepcion', 'Variacion en corte y costura', 'Producto fuera de especificacion'],
                    [cause('Proveedor entrega lote fuera de tolerancia', 7, 3, 4, { prev: 'Especificacion de tela en orden de compra', det: 'Control de peso con balanza electronica en recepcion' })]),
                fail('Ancho fuera de especificacion',
                    ['Lote observado en recepcion', 'Aprovechamiento de corte deficiente', 'Producto fuera de especificacion'],
                    [cause('Proveedor entrega lote fuera de tolerancia', 6, 3, 4, { prev: 'Especificacion de tela en orden de compra', det: 'Medicion de ancho segun instrumento MC406 en recepcion' })]),
                fail('Color no conforme',
                    ['Lote observado en recepcion', 'Variacion de color entre piezas', 'Usuario percibe diferencia de color'],
                    [cause('Proveedor entrega lote fuera de tono', 5, 3, 4, { prev: 'Patron de color acordado con proveedor', det: 'Comparacion visual contra patron en recepcion' })]),
            ]),
        ]),
        we('Hilo Poliester 120 (40/2)', 'Material', [
            fn('Aportar hilo de costura de union', [
                fail('Hilo fuera de especificacion (titulo o color)',
                    ['Reproceso de costura o scrap', 'Defecto de costura en proceso', 'Usuario percibe defecto'],
                    [cause('Proveedor entrega lote fuera de tolerancia', 6, 2, 4, { prev: 'Especificacion de hilo en orden de compra', det: 'Inspeccion visual de etiqueta y color en recepcion' })]),
            ]),
        ]),
        we('Hilo Poliester Texturizado 150/1', 'Material', [
            fn('Aportar hilo de costura de acabado', [
                fail('Hilo con defecto de fabricacion',
                    ['Rotura de hilo en costura', 'Reproceso de costura', 'Usuario percibe costura defectuosa'],
                    [cause('Proveedor con proceso fuera de control', 5, 3, 4, { prev: 'Especificacion de hilo acordada con proveedor', det: 'Inspeccion visual de bobina en recepcion' })]),
            ]),
        ]),
        we('Grampas metalicas', 'Material', [
            fn('Proveer elementos de sujecion conformes', [
                fail('Grampas fuera de especificacion dimensional',
                    ['Grampas rechazadas, lote segregado', 'Sujecion deficiente en engrampado', 'Tela se afloja en el asiento'],
                    [cause('Proveedor entrega grampas fuera de tolerancia', 7, 3, 4, { prev: 'Especificacion de grampa en orden de compra', det: 'Control dimensional con vernier MC413 segun P-14' })]),
                fail('Grampas con defecto superficial (corrosion o rebaba)',
                    ['Grampas rechazadas', 'Grampa daña la tela al colocar', 'Tela dañada o sujecion deficiente'],
                    [cause('Proveedor entrega grampas con defecto', 6, 3, 4, { prev: 'Especificacion de grampa en orden de compra', det: 'Inspeccion visual de grampas en recepcion' })]),
            ]),
        ]),
        we('Declaracion IMDS', 'Material', [
            fn('Material conforme EU 2000/53/CE', [
                fail('Material contiene sustancias prohibidas',
                    ['Lote rechazado', 'Incumplimiento regulatorio del cliente', 'Producto no homologable'],
                    [cause('Proveedor sin declaracion IMDS actualizada', 9, 3, 3, { prev: 'Declaracion IMDS y certificado del proveedor', det: 'Verificacion documental P-14' })]),
            ]),
        ]),
    ]),

    // OP15 PREPARACION DE CORTE
    op('15', 'PREPARACION DE CORTE', 'Operador de Produccion', 'Mesa de tendido BMA 089', 'Sector de corte', [
        we('Procedimiento de tendido y medicion', 'Method', [
            fn('Tender y medir el material conforme a procedimiento', [
                fail('Tela mal tendida (arrugas o tension desigual)',
                    ['Corte impreciso, variacion dimensional', 'Piezas fuera de dimension', 'Producto defectuoso'],
                    [cause('Operador no sigue procedimiento de tendido', 5, 5, 5, { prev: 'Instruccion de tendido en hoja de operacion', det: 'Verificacion visual del tendido antes de corte' })]),
                fail('Largo de tendido fuera de especificacion',
                    ['Desperdicio de material', 'Piezas con largo incorrecto', 'Reproceso o scrap'],
                    [cause('Error de medicion de largo', 6, 4, 4, { prev: 'Instruccion de medicion en hoja de operacion', det: 'Control de largo segun instrumento MC334' })]),
                fail('Apilado desalineado de pilones',
                    ['Corte desplazado entre capas', 'Piezas fuera de contorno', 'Reproceso o scrap'],
                    [cause('Operador no alinea los pilones al apilar', 5, 4, 4, { prev: 'Instruccion de apilado en hoja de operacion', det: 'Control visual de alineacion antes de corte' })]),
            ]),
        ]),
    ]),

    // OP20 CORTE (manual) -> effectLocal SCRAP
    op('20', 'CORTE', 'Operador de Produccion', 'Mesa de corte BMA 089', 'Sector de corte', [
        we('Cuchilla de corte', 'Machine', [
            fn('Cortar el material conforme a contorno y orificios', [
                fail('Contorno de corte fuera de forma',
                    ['Scrap del material mal cortado', 'Pieza no ensambla en proceso posterior', 'Producto no funcional'],
                    [cause('Operario no centra el material antes de cortar', 8, 3, 4, { prev: 'Set up de corte y control de primera pieza', det: 'Control de forma con pieza patron' })]),
                fail('Falta de orificios',
                    ['Scrap del material mal cortado', 'Imposibilidad de colocar grampas', 'Producto no funcional'],
                    [cause('Herramienta de punzonado mal posicionada', 8, 3, 4, { prev: 'Set up de orificios y control de primera pieza', det: 'Control de orificios con pieza patron' })]),
                fail('Orificios fuera de posicion o diametro',
                    ['Scrap del material mal cortado', 'Grampas no encajan en los orificios', 'Producto no funcional'],
                    [cause('Cuchilla o punzon desgastado', 8, 3, 4, { prev: 'Plan de cambio preventivo de cuchilla y punzon', det: 'Control de orificios con pieza patron' })]),
            ]),
        ]),
    ]),

    // OP25 CONTROL CON MYLAR (condicional: 21-6756 no tiene mylar)
    op('25', 'CONTROL CON MYLAR (Aplica solo a PN 21-6758, 21-6766, 21-7467, 21-7763)', 'Operador de Produccion', 'Plantilla Mylar', 'Sector de corte', [
        we('Plantilla Mylar', 'Measurement', [
            fn('Verificar forma y posicion contra plantilla', [
                fail('Pieza fuera de tolerancia no detectada',
                    ['Pieza no conforme pasa a costura', 'Producto fuera de especificacion en cliente', 'Producto defectuoso'],
                    [cause('Mylar desgastado o desactualizado', 6, 4, 4, { prev: 'Registro de revision vigente de la plantilla', det: 'Verificacion de marca de revision antes de uso' })]),
                fail('Medicion fuera de tolerancia no detectada',
                    ['Pieza no conforme liberada a costura', 'Pieza no encaja en costura', 'Funda fuera de dimension en asiento'],
                    [cause('Error de interpretacion de tolerancias', 6, 3, 5, { prev: 'Instruccion de control con limites go/no-go', det: 'Supervision periodica de controles' })]),
            ]),
        ]),
    ]),

    // OP40 COSTURA (overlock ZOJE)
    op('40', 'COSTURA', 'Operador de Produccion', 'Maquina de costura overlock ZOJE', 'Linea de produccion', [
        we('Maquina de costura overlock', 'Machine', [
            fn('Costura fuerte sin arrugas con hilo segun especificacion', [
                fail('Falta de costura',
                    ['Scrap', 'Producto defectuoso', 'Producto no conforme en cliente'],
                    [
                        cause('Carreteles mal ubicados', 7, 5, 4, { prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron' }),
                        cause('Aguja mal ubicada', 7, 5, 4, { prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron' }),
                    ]),
                fail('Costura floja o deficiente',
                    ['Retrabajo (descoser y rehacer)', 'Falla funcional del producto', 'Desprendimiento en uso'],
                    [cause('Falla en la tension del hilo', 7, 5, 4, { prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron' })]),
                fail('Costura salteada',
                    ['Retrabajo (descoser y rehacer)', 'Producto defectuoso', 'Producto no conforme en cliente'],
                    [cause('Aguja despuntada', 7, 5, 4, { prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron' })]),
                fail('Arrugas o pliegues en la costura',
                    ['Retrabajo (descoser y rehacer)', 'Aspecto no aceptable', 'Rechazo visual en cliente'],
                    [cause('Hilo enredado', 5, 5, 5, { prev: 'Mantenimiento primer nivel', det: 'Control visual / Muestra patron' })]),
                fail('Hilo roto',
                    ['Costura incompleta, retrabajo', 'Reproceso obligatorio', 'No aplica (detectado en proceso)'],
                    [cause('Hilo inadecuado o con defecto', 5, 3, 4, { prev: 'Especificacion de hilo por tipo de costura', det: 'Inspeccion visual de costura en primera pieza' })]),
            ]),
        ]),
    ]),

    // OP50 COLOCADO DE GRAMPAS (manual) — operacion nueva
    op('50', 'COLOCADO DE GRAMPAS', 'Operador de Produccion', 'Puesto de engrampado manual', 'Linea de produccion', [
        we('Operador de Produccion', 'Man', [
            fn('Colocar grampas de sujecion segun ayuda visual', [
                fail('Grampas en cantidad incorrecta',
                    ['Retrabajo de engrampado', 'Sujecion insuficiente de la tela', 'Tela se afloja o desprende en el asiento'],
                    [cause('Operario coloca cantidad distinta a la definida', 7, 6, 4, { prev: 'Ayuda visual y pieza patron en el puesto', det: 'Autocontrol 100% por lote mas 1 pieza por inspector; inicio de turno y tras parada mayor a 1H' })]),
                fail('Grampas mal posicionadas (orificio incorrecto)',
                    ['Retrabajo de engrampado', 'Sujecion deficiente de la tela', 'Tela mal sujeta en el asiento'],
                    [cause('Operario coloca la grampa en un orificio equivocado', 6, 5, 4, { prev: 'Ayuda visual con posicion de grampas', det: 'Autocontrol 100% por lote mas 1 pieza por inspector; inicio de turno y tras parada mayor a 1H' })]),
                fail('Grampa floja o mal cerrada',
                    ['Retrabajo de engrampado', 'Sujecion deficiente de la tela', 'Tela se afloja en el asiento'],
                    [cause('Grampa no cierra correctamente al colocar', 7, 4, 4, { prev: 'Ayuda visual de colocado correcto', det: 'Autocontrol visual de cierre de grampa' })]),
            ]),
        ]),
    ]),

    // OP80 CONTROL FINAL DE CALIDAD
    op('80', 'CONTROL FINAL DE CALIDAD', 'Inspector de Calidad', 'Mesa de control final', 'Sector de control final', [
        we('Control dimensional con plantilla', 'Measurement', [
            fn('Verificar dimensiones de la pieza terminada', [
                fail('Pieza fuera de dimension no detectada',
                    ['Pieza no conforme liberada', 'Rechazo en linea de cliente', 'Usuario percibe desajuste'],
                    [cause('Instrumento descalibrado', 6, 2, 3, { prev: 'Plan de calibracion periodica de instrumentos', det: 'Verificacion de calibracion vigente al usar' })]),
            ]),
        ]),
        we('Inspector de Calidad', 'Man', [
            fn('Verificar aspecto, posicion y cantidad de grampas', [
                fail('No deteccion de grampas faltantes o mal colocadas',
                    ['Pieza no conforme liberada', 'Cliente recibe pieza con sujecion deficiente', 'Tela se afloja en el asiento'],
                    [cause('Inspeccion final no detecta el defecto de grampas', 7, 3, 4, { prev: 'Ayuda visual con cantidad y posicion de grampas', det: 'Inspeccion final de aspecto, posicion y cantidad de grampas' })]),
            ]),
        ]),
    ]),

    // OP100 REPROCESO: ELIMINACION DE HILO SOBRANTE
    op('100', 'REPROCESO: ELIMINACION DE HILO SOBRANTE', 'Operador de Produccion', 'Puesto de reproceso', 'Sector de reproceso', [
        we('Instruccion de reproceso de hilo', 'Method', [
            fn('Eliminar hilo sobrante sin dañar la pieza', [
                fail('Instruccion de reproceso incompleta',
                    ['Operador improvisa, riesgo de daño', 'Pieza dañada en reproceso', 'No aplica'],
                    [cause('Falta de instruccion documentada para reproceso', 4, 2, 5, { prev: 'Instruccion de reproceso documentada con fotos', det: 'Verificacion visual post-reproceso' })]),
            ]),
        ]),
    ]),

    // OP101 REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA
    op('101', 'REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA', 'Operador de Produccion', 'Maquina de costura overlock', 'Sector de reproceso', [
        we('Maquina de costura overlock', 'Machine', [
            fn('Corregir costura desviada o floja', [
                fail('Costura correctiva no resuelve el defecto',
                    ['Pieza sigue no conforme, potencial descarte', 'Faltante de piezas', 'No aplica (pieza rechazada)'],
                    [cause('Parametros de maquina no ajustados para retrabajo', 5, 3, 5, { prev: 'Set-up especifico de retrabajo documentado', det: 'Inspeccion de costura post-retrabajo' })]),
            ]),
        ]),
        we('Operador de Produccion', 'Man', [
            fn('Ejecutar la correccion sin dañar el material', [
                fail('Daño al material durante costura correctiva',
                    ['Pieza dañada, descarte', 'Faltante de piezas', 'No aplica'],
                    [cause('Exceso de penetraciones de aguja en zona retrabajada', 5, 3, 4, { prev: 'Instruccion de limite de intentos de retrabajo (max 1)', det: 'Inspeccion visual de integridad post-retrabajo' })]),
            ]),
        ]),
    ]),

    // OP102 REPROCESO: CORRECCION DE GRAMPAS FALTANTES / MAL COLOCADAS — nueva
    op('102', 'REPROCESO: CORRECCION DE GRAMPAS FALTANTES / MAL COLOCADAS', 'Operador de Produccion', 'Puesto de engrampado manual', 'Sector de reproceso', [
        we('Instruccion de correccion de grampas', 'Method', [
            fn('Definir criterio de correccion de grampas', [
                fail('Instruccion no define criterio de aceptacion',
                    ['Operador no determina si el retrabajo fue exitoso', 'Pieza dudosa liberada o descartada', 'No aplica'],
                    [cause('Falta de criterio go/no-go en instruccion de retrabajo', 4, 2, 5, { prev: 'Criterio de aceptacion con foto OK vs NOK', det: 'Verificacion post-retrabajo por inspector' })]),
            ]),
        ]),
        we('Operador de Produccion', 'Man', [
            fn('Recolocar grampas sin dañar la tela', [
                fail('Daño a la tela al recolocar grampas',
                    ['Pieza dañada, descarte', 'Faltante de piezas', 'No aplica'],
                    [cause('Exceso de perforaciones en la zona retrabajada', 5, 3, 4, { prev: 'Instruccion de limite de intentos de retrabajo (max 1)', det: 'Inspeccion visual de integridad post-retrabajo' })]),
                fail('Recolocado no resuelve la sujecion',
                    ['Pieza sigue no conforme', 'Faltante de piezas', 'No aplica (pieza rechazada)'],
                    [cause('Grampa recolocada queda floja', 6, 3, 4, { prev: 'Instruccion de recolocado con grampa nueva', det: 'Autocontrol de cierre de grampa post-retrabajo' })]),
            ]),
        ]),
    ]),

    // OP110 EMBALAJE
    op('110', 'EMBALAJE', 'Operador de Produccion', 'Puesto de embalaje', 'Sector de embalaje', [
        we('Procedimiento de embalaje', 'Method', [
            fn('Embalar e identificar el producto terminado', [
                fail('Error de identificacion',
                    ['Perdida de trazabilidad / Reclamo del cliente', 'Entrega equivocada', 'Cliente recibe pieza incorrecta'],
                    [cause('Error de identificacion por parte del operador', 7, 3, 4, { prev: 'Organizacion de etiquetas en el puesto', det: 'Autocontrol y auditoria de producto terminado' })]),
                fail('Falta de identificacion',
                    ['Perdida de trazabilidad / Reclamo del cliente', 'Entrega sin trazabilidad', 'Cliente no puede rastrear producto'],
                    [cause('Operario omite la identificacion', 7, 3, 4, { prev: 'Instruccion de embalaje visual en el puesto', det: 'Autocontrol y auditoria de producto terminado' })]),
                fail('Cantidad por medio incorrecta',
                    ['Reclamo de cliente por diferencia de cantidad', 'Cliente recibe cantidad incorrecta', 'Diferencia de inventario'],
                    [cause('Error de conteo al embalar', 6, 3, 5, { prev: '', det: 'Autocontrol de cantidad por medio al final de turno' })]),
            ]),
        ]),
    ]),
];

// ─── header ────────────────────────────────────────────────────────────────--
const header = {
    rev: 'A', scope: 'Proceso de produccion completo', client: 'PWA',
    revDate: '24/06/2026', subject: 'Proceso de fabricacion - Telas Planas con sujecion por Grampas',
    coreTeam: ['Carlos Baptista (Ingenieria)', 'Manuel Meszaros (Calidad)', 'Marianna Vera (Produccion)'],
    location: 'PLANTA HURLINGHAM', modelYear: '2026', startDate: '24/06/2026',
    amfeNumber: 'AMFE-3', approvedBy: 'Gonzalo Cal',
    partNumber: '21-6756 / 21-6758 / 21-6766 / 21-7467 / 21-7763',
    preparedBy: 'Facundo Santoro', reviewedBy: 'Carlos Baptista',
    companyName: 'BARACK MERCOSUL', responsible: 'Carlos Baptista', customerName: 'PWA',
    elaboratedBy: 'Carlos Baptista', organization: 'BARACK MERCOSUL', plantApproval: 'Gonzalo Cal',
    revisionLevel: 'A', applicableParts: '21-6756, 21-6758, 21-6766, 21-7467, 21-7763',
    confidentiality: 'Confidencial', processResponsible: 'Carlos Baptista', responsibleEngineer: 'Carlos Baptista',
};

const doc = { header, operations };

// sync aliases + legacy fm fields (igual que saveAmfe antes de escribir)
syncLegacyFmFields(doc);
syncFieldAliases(doc);

// ─── stats ───────────────────────────────────────────────────────────────────
const stats = countAmfeStats(doc);
let apH = 0, apM = 0, apL = 0, ccCount = 0;
const apHList = [];
for (const o of doc.operations)
    for (const w of o.workElements)
        for (const f of w.functions)
            for (const fm of f.failures)
                for (const c of fm.causes) {
                    if (c.ap === 'H') { apH++; apHList.push(`OP${o.opNumber} ${w.name}: ${c.cause} (S${c.severity} O${c.occurrence} D${c.detection})`); }
                    else if (c.ap === 'M') apM++;
                    else if (c.ap === 'L') apL++;
                    if (c.specialChar === 'CC' || c.specialChar === 'SC') ccCount++;
                }

const dataStr = JSON.stringify(doc);
const sha = createHash('sha256').update(dataStr).digest('hex');
const newId = uid();

const cols = {
    id: newId, amfe_number: 'AMFE-3', project_name: 'PWA/HILUX/TELAS_PLANAS_GRAMPAS',
    subject: '', client: 'PWA', part_number: '21-6756', responsible: 'Carlos Baptista',
    organization: 'BARACK MERCOSUL', status: 'draft',
    operation_count: stats.opCount, cause_count: stats.causeCount, ap_h_count: apH, ap_m_count: apM,
    start_date: '24/06/2026', last_revision_date: '24/06/2026', revision_level: 'A',
};

const sql = `INSERT INTO amfe_documents (id, amfe_number, project_name, subject, client, part_number, responsible, organization, status, operation_count, cause_count, ap_h_count, ap_m_count, start_date, last_revision_date, revision_level, created_at, updated_at, data, revisions, checksum) VALUES ('${cols.id}','${cols.amfe_number}','${cols.project_name}','${cols.subject}','${cols.client}','${cols.part_number}','${cols.responsible}','${cols.organization}','${cols.status}',${cols.operation_count},${cols.cause_count},${cols.ap_h_count},${cols.ap_m_count},'${cols.start_date}','${cols.last_revision_date}','${cols.revision_level}', now(), now(), $AMFE3DATA$${dataStr}$AMFE3DATA$, '[]', '');`;

mkdirSync(new URL('../tmp', import.meta.url), { recursive: true });
const out = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(out('../tmp/amfe3.data.min.json'), dataStr);
writeFileSync(out('../tmp/amfe3.insert.sql'), sql);
writeFileSync(out('../tmp/amfe3.meta.json'), JSON.stringify({ ...cols, ...stats, apH, apM, apL, ccCount, bytes: Buffer.byteLength(dataStr), sha256: sha, apHList }, null, 2));

console.log('=== AMFE-3 GRAMPAS build ===');
console.log('id:', newId);
console.log('operations:', stats.opCount, '| WE:', stats.weCount, '| functions:', stats.fnCount, '| failures:', stats.fmCount, '| causes:', stats.causeCount);
console.log('AP  H:', apH, ' M:', apM, ' L:', apL, ' | CC/SC:', ccCount);
console.log('data bytes:', Buffer.byteLength(dataStr), '| sha256:', sha.slice(0, 16));
console.log('--- AP=H (requieren accion, placeholder APQP) ---');
apHList.forEach(x => console.log('  H:', x));
console.log('archivos: tmp/amfe3.data.min.json, tmp/amfe3.insert.sql, tmp/amfe3.meta.json');
