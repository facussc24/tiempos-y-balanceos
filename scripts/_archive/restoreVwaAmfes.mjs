/**
 * Restore 6 missing VWA AMFE documents in Supabase.
 *
 * Products:
 *   1. Insert Patagonia           — VWA/PATAGONIA/INSERT
 *   2. Armrest Door Panel         — VWA/PATAGONIA/ARMREST_DOOR_PANEL
 *   3. Top Roll                   — VWA/PATAGONIA/TOP_ROLL
 *   4. Headrest Front             — VWA/PATAGONIA/HEADREST_FRONT
 *   5. Headrest Rear Center       — VWA/PATAGONIA/HEADREST_REAR_CEN
 *   6. Headrest Rear Outer        — VWA/PATAGONIA/HEADREST_REAR_OUT
 *
 * SAFETY:
 *   - NEVER deletes any existing document
 *   - Checks for duplicates before inserting
 *   - Uses the same AMFE data structure as the seed script
 *
 * USAGE:
 *   node scripts/restoreVwaAmfes.mjs              # dry-run (default)
 *   node scripts/restoreVwaAmfes.mjs --apply      # insert into Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) console.log('DRY RUN — no changes will be saved. Use --apply to save.\n');

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('Authenticated\n');

// ─── Helpers ───────────────────────────────────────────────────────────
const uid = () => randomUUID();

const TEAM = 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)';

function mkCause(cause, pc, dc) {
    return {
        id: uid(), cause,
        preventionControl: pc, detectionControl: dc,
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
    };
}

function mkFail(desc, eL, eN, eE, causes) {
    return { id: uid(), description: desc, effectLocal: eL, effectNextLevel: eN, effectEndUser: eE, severity: '', causes };
}

function mkFn(desc, fails) {
    return { id: uid(), description: desc, requirements: '', failures: fails };
}

function mkWe(type, name, fns) {
    return { id: uid(), type, name, functions: fns };
}

function mkOp(num, name, wes, funcItem = '', funcPaso = '') {
    return { id: uid(), opNumber: num, name, workElements: wes, focusElementFunction: funcItem, operationFunction: funcPaso };
}

function mkAmfeHeader(partName, client, pn, amfeNum) {
    return {
        organization: 'Barack Mercosul', location: 'Hurlingham, Buenos Aires',
        client, modelYear: '2026',
        subject: `Proceso de fabricación - ${partName}`,
        startDate: '2026-03-14', revDate: '2026-03-14',
        team: TEAM, amfeNumber: amfeNum,
        responsible: 'F. Santoro', confidentiality: 'Confidencial',
        partNumber: pn, processResponsible: 'F. Santoro',
        revision: 'A', approvedBy: '',
        scope: 'Proceso de producción completo', applicableParts: '',
    };
}

// ─── AMFE Operations for each product ──────────────────────────────────

function buildInsertOps() {
    return [
        mkOp('OP 10', 'Recepción de materia prima', [
            mkWe('Material', 'Vinilo, sustrato, adhesivo, insertos, hilo', [
                mkFn('Recibir materiales conforme a especificación VWA', [
                    mkFail('Material fuera de especificación', 'Retraso producción', 'Defecto en producto final', 'Reclamo de garantía',
                        [mkCause('Proveedor entrega material no conforme', 'Certificado de calidad por lote', 'Inspección de recepción')]),
                ]),
            ]),
            mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
            ]),
            mkWe('Man', 'Operador de recepción / Calidad', [
                mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
            ]),
            mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                mkFn('Medir gramaje, espesor y verificar color contra muestra aprobada.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
            ]),
        ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
        mkOp('OP 20', 'Corte de vinilo', [
            mkWe('Machine', 'Cortadora CNC', [
                mkFn('Cortar vinilo a medida según programa', [
                    mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'No tapiza correctamente', 'Producto defectuoso',
                        [mkCause('Error de programa o setup', 'Verificación de programa', 'Control dimensional')]),
                ]),
            ]),
            mkWe('Man', 'Operador de corte', [
                mkFn('Operar la cortadora CNC según instrucción de trabajo. Verificar primera pieza.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de corte', [
                mkFn('Definir programa de corte, secuencia y criterios de verificación dimensional.', []),
            ]),
            mkWe('Material', 'Cuchillas / Regla / Plantillas', [
                mkFn('Proveer herramientas de corte en buen estado para operación conforme.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de corte.', []),
            ]),
        ], 'Proveer material cortado conforme a requerimientos dimensionales y de trazabilidad', 'Lograr el contorno/forma geométrica del patrón conforme al modelo/plano'),
        mkOp('OP 30', 'Refilado', [
            mkWe('Machine', 'Refiladora', [
                mkFn('Eliminar exceso de material', [
                    mkFail('Bordes irregulares', 'Pieza no conforme', 'Interferencia en montaje', 'Producto defectuoso',
                        [mkCause('Cuchilla desgastada', 'MP de cuchillas', 'Inspección visual de bordes')]),
                ]),
            ]),
            mkWe('Man', 'Operador de refilado', [
                mkFn('Operar la refiladora según instrucción de trabajo. Verificar bordes.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de refilado', [
                mkFn('Definir técnica de refilado y criterios de aceptación de bordes.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes.', []),
            ]),
        ], 'Proveer piezas refiladas conformes a especificación dimensional', 'Eliminar material excedente manteniendo la geometría de la pieza'),
        mkOp('OP 40', 'Costura CNC', [
            mkWe('Machine', 'Máquina de costura CNC', [
                mkFn('Realizar costura automatizada de precisión', [
                    mkFail('Patrón de costura incorrecto', 'Defecto visual crítico', 'Rechazo por VWA', 'Aspecto inaceptable',
                        [mkCause('Programa de costura erróneo o desactualizado', 'Verificación de programa vs plano', 'Inspección visual 100% + comparación con muestra')]),
                    mkFail('Rotura de hilo durante costura', 'Pieza con costura incompleta', 'Costura débil', 'Falla funcional',
                        [mkCause('Hilo defectuoso o tensión excesiva', 'Control de calidad de hilo, parámetros documentados', 'Detector automático de rotura + inspección visual')]),
                ]),
            ]),
            mkWe('Method', 'Programa y parámetros CNC', [
                mkFn('Gestionar programa CNC y parámetros de costura', [
                    mkFail('Programa desactualizado cargado en máquina', 'Patrón de costura no corresponde a la revisión vigente', 'Rechazo por VWA', 'Producto no conforme',
                        [mkCause('Falta de control de versiones de programas', 'Procedimiento de gestión de programas CNC, backup', 'Verificación de versión vs plano antes de inicio')]),
                ]),
            ]),
            mkWe('Man', 'Operador de costura CNC', [
                mkFn('Operar la máquina de costura CNC. Cargar piezas y verificar patrón.', []),
            ]),
            mkWe('Material', 'Hilo / Aguja / Bobina', [
                mkFn('Proveer insumos de costura conformes a especificación (tipo, color, calibre).', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de costura.', []),
            ]),
        ], 'Unir componentes mediante costura conforme a patrón y especificación', 'Realizar costura CNC según programa validado'),
        mkOp('OP 50', 'Troquelado', [
            mkWe('Machine', 'Troquel / Prensa', [
                mkFn('Troquelar forma de inserto', [
                    mkFail('Forma fuera de especificación', 'Inserto no encaja', 'No ensambla', 'Producto defectuoso',
                        [mkCause('Troquel desgastado', 'MP de troquel', 'Control con gauge')]),
                ]),
            ]),
            mkWe('Man', 'Operador de troquelado', [
                mkFn('Operar la prensa según instrucción de trabajo. Verificar con gauge.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de troquelado', [
                mkFn('Definir parámetros de prensa, posicionamiento y criterios dimensionales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de troquelado.', []),
            ]),
        ], 'Proveer pieza con forma final troquelada conforme a plano', 'Troquelar forma definitiva según especificación'),
        mkOp('OP 60', 'Inyección', [
            mkWe('Machine', 'Inyectora', [
                mkFn('Inyectar sustrato plástico', [
                    mkFail('Pieza incompleta (short shot)', 'Scrap', 'Falta de rigidez', 'No funcional',
                        [mkCause('Presión o temperatura insuficiente', 'Receta documentada, SPC', 'Control de peso + visual')]),
                    mkFail('Rebabas', 'Retrabajo', 'Interferencia', 'Posible corte',
                        [mkCause('Desgaste de molde', 'MP de molde', 'Inspección visual')]),
                ]),
            ]),
            mkWe('Man', 'Operador de inyección', [
                mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de inyección', [
                mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
            ]),
            mkWe('Material', 'Resina / Materia prima plástica', [
                mkFn('Proveer material plástico conforme a especificación (grado, humedad, MFI).', []),
            ]),
            mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
            ]),
        ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato según parámetros de proceso validados'),
        mkOp('OP 70', 'Prearmado', [
            mkWe('Method', 'Proceso de preensamble', [
                mkFn('Ensamblar componentes previo al tapizado', [
                    mkFail('Componentes mal posicionados', 'Pieza no conforme', 'Ensamble deficiente en cliente', 'Funcionalidad comprometida',
                        [mkCause('Fixture de prearmado desalineado', 'Verificación de fixture periódica', 'Inspección visual + funcional')]),
                ]),
            ]),
            mkWe('Man', 'Operador de prearmado', [
                mkFn('Ensamblar subcomponentes según secuencia definida. Verificar posición.', []),
            ]),
            mkWe('Machine', 'Fixture de prearmado', [
                mkFn('Proveer fixture calibrado para posicionamiento correcto de componentes.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para verificación de ensamble.', []),
            ]),
        ], 'Ensamblar subcomponentes preparando la pieza para tapizado', 'Colocar y posicionar componentes según secuencia definida'),
        mkOp('OP 80', 'Adhesivado', [
            mkWe('Method', 'Proceso de adhesivado', [
                mkFn('Aplicar adhesivo para unión recubrimiento-sustrato', [
                    mkFail('Adherencia insuficiente', 'Desprendimiento', 'Desprendimiento en uso', 'Reclamo garantía',
                        [mkCause('Gramaje insuficiente o superficie contaminada', 'Control de gramaje, limpieza de superficies', 'Ensayo de pelado')]),
                ]),
            ]),
            mkWe('Man', 'Operador de adhesivado', [
                mkFn('Aplicar adhesivo según instrucción de trabajo. Verificar dosificación.', []),
            ]),
            mkWe('Material', 'Adhesivo / Solvente de limpieza', [
                mkFn('Proveer adhesivo dentro de vida útil y condiciones de almacenamiento correctas.', []),
            ]),
            mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                mkFn('Mantener condiciones ambientales adecuadas para aplicación y curado de adhesivo.', []),
            ]),
        ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo en cantidades y zonas especificadas'),
        mkOp('OP 90', 'Tapizado', [
            mkWe('Man', 'Operador de tapizado', [
                mkFn('Recubrir sustrato con vinilo', [
                    mkFail('Arrugas en recubrimiento', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                        [mkCause('Tensión insuficiente', 'IT con técnica de tensión', 'Inspección visual 100%')]),
                ]),
            ]),
            mkWe('Method', 'Hoja de operaciones de tapizado', [
                mkFn('Definir técnica de tensado, secuencia de fijación y criterios visuales.', []),
            ]),
            mkWe('Material', 'Vinilo cortado y cosido', [
                mkFn('Proveer recubrimiento conforme a especificación dimensional y visual.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de tapizado.', []),
            ]),
        ], 'Cubrir sustrato con material de terminación conforme a patrón', 'Tapizar manteniendo tensión uniforme y sin arrugas'),
        mkOp('OP 100', 'Control final e inspección', [
            mkWe('Measurement', 'Instrumentos, patrón VWA', [
                mkFn('Verificar conformidad total', [
                    mkFail('Liberación de producto no conforme', 'Costo interno', 'Reclamo VWA', 'Riesgo de imagen',
                        [mkCause('Error de inspección', 'Capacitación, patrón actualizado', 'Auditoría de producto')]),
                ]),
            ]),
            mkWe('Man', 'Inspector de calidad', [
                mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
            ]),
            mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
            ]),
        ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
        mkOp('OP 110', 'Embalaje y despacho', [
            mkWe('Method', 'Procedimiento de embalaje VDA', [
                mkFn('Embalar según requerimientos VWA', [
                    mkFail('Daño en transporte', 'Scrap de PT', 'Rechazo VWA', 'Línea VWA detenida',
                        [mkCause('Embalaje inadecuado', 'Instrucción de embalaje VDA', 'Verificación antes de despacho')]),
                ]),
            ]),
            mkWe('Man', 'Operador de embalaje', [
                mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
            ]),
            mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
            ]),
        ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
    ];
}

function buildArmrestOps() {
    return [
        mkOp('OP 10', 'Recepción de materia prima', [
            mkWe('Material', 'Cuero/Vinilo, sustrato, adhesivo, hilo', [
                mkFn('Recibir materiales conforme a especificación', [
                    mkFail('Material fuera de especificación (color, gramaje, espesor)', 'Producción detenida', 'Diferencia de color vs muestra', 'Aspecto visual inaceptable',
                        [mkCause('Proveedor envía lote fuera de tolerancia', 'Acuerdo de calidad con proveedor, certificado por lote', 'Inspección de recepción: color, gramaje, espesor')]),
                ]),
            ]),
            mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
            ]),
            mkWe('Man', 'Operador de recepción / Calidad', [
                mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
            ]),
            mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                mkFn('Medir gramaje, espesor y verificar color contra muestra aprobada.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
            ]),
        ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
        mkOp('OP 20', 'Corte de cuero/vinilo', [
            mkWe('Machine', 'Cortadora CNC / Mesa de corte', [
                mkFn('Cortar material de recubrimiento a medida', [
                    mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'No tapiza correctamente', 'Aspecto deficiente',
                        [mkCause('Programa de corte desactualizado o error de setup', 'Verificación de programa antes de inicio', 'Control dimensional con plantilla')]),
                    mkFail('Daño en superficie del material', 'Scrap de materia prima costosa', 'Defecto visual', 'Cliente insatisfecho',
                        [mkCause('Superficie de mesa contaminada o herramienta dañada', 'Limpieza de mesa, MP de herramientas', 'Inspección visual 100%')]),
                ]),
            ]),
            mkWe('Man', 'Operador de corte', [
                mkFn('Operar la cortadora según instrucción de trabajo. Verificar primera pieza.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de corte', [
                mkFn('Definir programa de corte, secuencia y criterios de verificación dimensional.', []),
            ]),
            mkWe('Material', 'Cuchillas / Regla / Plantillas', [
                mkFn('Proveer herramientas de corte en buen estado para operación conforme.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de corte.', []),
            ]),
        ], 'Proveer material cortado conforme a requerimientos dimensionales y de trazabilidad', 'Lograr el contorno/forma geométrica del patrón conforme al modelo/plano'),
        mkOp('OP 30', 'Refilado', [
            mkWe('Machine', 'Refiladora / Herramienta de corte', [
                mkFn('Eliminar exceso de material en bordes', [
                    mkFail('Exceso de material remanente', 'No ensambla correctamente', 'Interferencia en montaje', 'Producto defectuoso',
                        [mkCause('Desgaste de cuchilla de refilado', 'MP de cuchillas, control de filo', 'Inspección visual de bordes')]),
                ]),
            ]),
            mkWe('Man', 'Operador de refilado', [
                mkFn('Operar la refiladora según instrucción de trabajo. Verificar bordes.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de refilado', [
                mkFn('Definir técnica de refilado y criterios de aceptación de bordes.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes.', []),
            ]),
        ], 'Proveer piezas refiladas conformes a especificación dimensional', 'Eliminar material excedente manteniendo la geometría de la pieza'),
        mkOp('OP 40', 'Costura', [
            mkWe('Machine', 'Máquina de coser industrial', [
                mkFn('Unir piezas de recubrimiento mediante costura decorativa y estructural', [
                    mkFail('Costura desalineada o irregular', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable para cliente final',
                        [mkCause('Guía de costura incorrecta o desgastada', 'Verificación de guía en setup, IT documentada', 'Inspección visual en proceso')]),
                    mkFail('Puntadas saltadas o rotas', 'Costura débil', 'Desprendimiento en uso', 'Falla funcional',
                        [mkCause('Aguja desgastada o tensión incorrecta', 'Cambio de aguja programado, control de tensión', 'Inspección visual + ensayo de tracción')]),
                ]),
            ]),
            mkWe('Man', 'Operador de costura decorativa', [
                mkFn('Mantener calidad de costura decorativa visible al cliente', [
                    mkFail('Costura irregular por manipulación incorrecta', 'Defecto visual en costura decorativa', 'Rechazo por apariencia', 'Aspecto no premium',
                        [mkCause('Operador inexperto en costura decorativa VWA', 'Capacitación en costura decorativa, matriz de habilidades', 'Inspección visual 100%')]),
                ]),
            ]),
            mkWe('Method', 'Hoja de operaciones de costura', [
                mkFn('Definir patrón de costura, tensión de hilo y secuencia de trabajo.', []),
            ]),
            mkWe('Material', 'Hilo / Aguja / Bobina', [
                mkFn('Proveer insumos de costura conformes a especificación (tipo, color, calibre).', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para costura decorativa.', []),
            ]),
        ], 'Unir componentes mediante costura conforme a patrón y especificación', 'Realizar costura según patrón validado'),
        mkOp('OP 50', 'Inyección de sustrato', [
            mkWe('Machine', 'Inyectora', [
                mkFn('Inyectar sustrato plástico para estructura del armrest', [
                    mkFail('Pieza incompleta (short shot)', 'Pieza descartada', 'Falta de rigidez', 'Producto no funcional',
                        [mkCause('Presión de inyección insuficiente o material frío', 'Parámetros de inyección documentados, control SPC', 'Inspección visual + control de peso')]),
                    mkFail('Rebabas excesivas', 'Retrabajo de desbarbado', 'Dificultad de ensamble', 'Posible corte al usuario',
                        [mkCause('Desgaste de molde o fuerza de cierre insuficiente', 'MP de molde, control de fuerza de cierre', 'Inspección visual 100%')]),
                    mkFail('Alabeo/deformación', 'Pieza no ensambla', 'Rechazo dimensional', 'Gap visible en vehículo',
                        [mkCause('Enfriamiento desigual o tiempo de ciclo inadecuado', 'Receta de proceso optimizada', 'Control dimensional con gauge')]),
                ]),
            ]),
            mkWe('Man', 'Operador de inyección', [
                mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de inyección', [
                mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
            ]),
            mkWe('Material', 'Resina / Materia prima plástica', [
                mkFn('Proveer material plástico conforme a especificación (grado, humedad, MFI).', []),
            ]),
            mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
            ]),
        ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato según parámetros de proceso validados'),
        mkOp('OP 60', 'Adhesivado', [
            mkWe('Method', 'Proceso de aplicación de adhesivo', [
                mkFn('Aplicar adhesivo para unión recubrimiento-sustrato', [
                    mkFail('Adherencia insuficiente', 'Desprendimiento del recubrimiento', 'Desprendimiento en uso del vehículo', 'Reclamo de garantía',
                        [mkCause('Cantidad de adhesivo insuficiente o superficie contaminada', 'Dosificación controlada, limpieza de superficies', 'Ensayo de pelado periódico')]),
                    mkFail('Exceso de adhesivo visible', 'Defecto visual', 'Manchas visibles', 'Aspecto no aceptable',
                        [mkCause('Dosificación excesiva', 'Control de gramaje de adhesivo', 'Inspección visual')]),
                ]),
            ]),
            mkWe('Man', 'Operador de adhesivado', [
                mkFn('Aplicar adhesivo según instrucción de trabajo. Verificar dosificación.', []),
            ]),
            mkWe('Material', 'Adhesivo / Solvente de limpieza', [
                mkFn('Proveer adhesivo dentro de vida útil y condiciones de almacenamiento correctas.', []),
            ]),
            mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                mkFn('Mantener condiciones ambientales adecuadas para aplicación y curado de adhesivo.', []),
            ]),
        ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo en cantidades y zonas especificadas'),
        mkOp('OP 70', 'Tapizado', [
            mkWe('Man', 'Operador de tapizado', [
                mkFn('Recubrir sustrato con material de cuero/vinilo', [
                    mkFail('Arrugas en recubrimiento', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable',
                        [mkCause('Tensión insuficiente del material durante tapizado', 'Instrucción de trabajo con técnica de tensión', 'Inspección visual 100%')]),
                    mkFail('Desalineación del recubrimiento', 'Pieza no conforme', 'Costuras descentradas visible', 'Aspecto no profesional',
                        [mkCause('Posicionamiento incorrecto del recubrimiento', 'Marcas de referencia en sustrato', 'Inspección visual vs patrón')]),
                ]),
            ]),
            mkWe('Method', 'Hoja de operaciones de tapizado', [
                mkFn('Definir técnica de tensado, secuencia de fijación y criterios visuales.', []),
            ]),
            mkWe('Material', 'Cuero/Vinilo cortado y cosido', [
                mkFn('Proveer recubrimiento conforme a especificación dimensional y visual.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de tapizado.', []),
            ]),
        ], 'Cubrir sustrato con material de terminación conforme a patrón', 'Tapizar manteniendo tensión uniforme y sin arrugas'),
        mkOp('OP 80', 'Control final e inspección', [
            mkWe('Measurement', 'Instrumentos de inspección, patrón', [
                mkFn('Verificar conformidad visual, dimensional y funcional', [
                    mkFail('Liberación de producto no conforme', 'Costo de retrabajo/scrap', 'Reclamo de VWA', 'Riesgo de imagen de marca',
                        [mkCause('Error de inspección, criterio ambiguo', 'Patrón visual actualizado, capacitación', 'Auditoría de producto terminado')]),
                ]),
            ]),
            mkWe('Man', 'Inspector de calidad', [
                mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
            ]),
            mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
            ]),
        ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
        mkOp('OP 90', 'Embalaje y despacho', [
            mkWe('Method', 'Procedimiento de embalaje VDA', [
                mkFn('Embalar según requerimientos VWA', [
                    mkFail('Daño en transporte por embalaje inadecuado', 'Scrap de producto terminado', 'Rechazo en recepción VWA', 'Línea de VWA detenida',
                        [mkCause('No cumplimiento de instrucción de embalaje', 'Instrucción de embalaje VDA, capacitación', 'Verificación de embalaje antes de despacho')]),
                ]),
            ]),
            mkWe('Man', 'Operador de embalaje', [
                mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
            ]),
            mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
            ]),
        ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
    ];
}

function buildTopRollOps() {
    return [
        mkOp('OP 5', 'Recepción de materia prima', [
            mkWe('Material', 'PP, adhesivo HotMelt, film IMG', [
                mkFn('Recibir materiales conforme a especificación', [
                    mkFail('Material fuera de especificación', 'Retraso producción', 'Defecto en producto', 'Reclamo',
                        [mkCause('Material no conforme del proveedor', 'Certificado de calidad, auditoría', 'Inspección de recepción')]),
                ]),
            ]),
            mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
            ]),
            mkWe('Man', 'Operador de recepción / Calidad', [
                mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
            ]),
            mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                mkFn('Medir propiedades del material (MFI, espesor) y verificar contra certificado.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
            ]),
        ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
        mkOp('OP 10', 'Inyección de sustrato PP', [
            mkWe('Machine', 'Inyectora', [
                mkFn('Inyectar sustrato de polipropileno', [
                    mkFail('Pieza incompleta (short shot)', 'Scrap', 'Falta de rigidez', 'No funcional',
                        [mkCause('Parámetros de inyección fuera de rango', 'Receta documentada, monitoreo automático', 'Control de peso + inspección visual')]),
                    mkFail('Marcas de flujo visibles', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                        [mkCause('Velocidad de inyección incorrecta o temp. baja', 'Optimización de parámetros, SPC', 'Inspección visual 100%')]),
                    mkFail('Deformación/alabeo', 'No ensambla', 'Rechazo dimensional', 'Gap visible',
                        [mkCause('Enfriamiento desigual', 'Control de temp. de molde', 'Gauge dimensional')]),
                ]),
            ]),
            mkWe('Man', 'Operador de inyección', [
                mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos SPC.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de inyección', [
                mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
            ]),
            mkWe('Material', 'Resina PP / Materia prima', [
                mkFn('Proveer polipropileno conforme a especificación (grado, humedad, MFI).', []),
            ]),
            mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
            ]),
        ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato PP según parámetros de proceso validados'),
        mkOp('OP 20', 'Adhesivado HotMelt', [
            mkWe('Machine', 'Aplicadora de HotMelt', [
                mkFn('Aplicar adhesivo HotMelt en sustrato para unión con film', [
                    mkFail('Distribución desigual de adhesivo', 'Zonas sin adherencia', 'Desprendimiento de film', 'Defecto funcional',
                        [mkCause('Boquilla obstruida o temperatura incorrecta', 'Limpieza periódica, control de temperatura', 'Inspección visual de patrón de adhesivo')]),
                    mkFail('Temperatura de HotMelt fuera de rango', 'Adherencia deficiente', 'Desprendimiento', 'Reclamo garantía',
                        [mkCause('Falla de control de temperatura', 'Termopar calibrado, alarma automática', 'Monitoreo de temperatura continuo')]),
                ]),
            ]),
            mkWe('Man', 'Operador de adhesivado HotMelt', [
                mkFn('Operar aplicadora HotMelt según instrucción. Verificar cobertura uniforme.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de adhesivado', [
                mkFn('Definir temperatura, patrón de aplicación y criterios de verificación de cobertura.', []),
            ]),
            mkWe('Material', 'Adhesivo HotMelt', [
                mkFn('Proveer adhesivo HotMelt dentro de vida útil y almacenamiento correcto.', []),
            ]),
            mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                mkFn('Mantener condiciones ambientales adecuadas para aplicación de HotMelt.', []),
            ]),
        ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo HotMelt en cantidades y zonas especificadas'),
        mkOp('OP 30', 'IMG (In-Mold Graining)', [
            mkWe('Machine', 'Prensa IMG', [
                mkFn('Aplicar textura y film decorativo mediante IMG', [
                    mkFail('Textura defectuosa o incompleta', 'Defecto visual crítico', 'Rechazo por VWA', 'Aspecto no premium',
                        [mkCause('Temperatura o presión de IMG incorrecta', 'Receta de proceso documentada, control automático', 'Inspección visual 100% vs muestra aprobada')]),
                    mkFail('Adherencia del film insuficiente', 'Film se despega', 'Desprendimiento en uso', 'Reclamo garantía',
                        [mkCause('Preparación inadecuada de sustrato o film', 'Procedimiento de preparación, control de HotMelt', 'Ensayo de pelado periódico')]),
                ]),
            ]),
            mkWe('Method', 'Preparación de materiales IMG', [
                mkFn('Preparar sustrato y film para proceso IMG', [
                    mkFail('Film mal posicionado o con arrugas pre-proceso', 'Textura despareja o marcas', 'Defecto visual', 'Aspecto inaceptable',
                        [mkCause('Manipulación incorrecta del film o falta de procedimiento', 'Instrucción de manipulación de film, condiciones de almacenamiento', 'Verificación visual pre-carga en prensa')]),
                ]),
            ]),
            mkWe('Man', 'Operador de prensa IMG', [
                mkFn('Operar prensa IMG según receta. Cargar sustrato y film correctamente.', []),
            ]),
            mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso IMG.', []),
            ]),
        ], 'Aplicar textura superficial conforme a especificación de diseño', 'Gravar textura en molde según parámetros validados'),
        mkOp('OP 40', 'Trimming', [
            mkWe('Machine', 'Router CNC / Cortadora', [
                mkFn('Recortar exceso de material post-IMG', [
                    mkFail('Corte irregular o incompleto', 'Pieza no conforme', 'No ensambla', 'Producto defectuoso',
                        [mkCause('Desgaste de herramienta o programa incorrecto', 'MP de herramientas, verificación programa', 'Inspección visual + dimensional')]),
                ]),
            ]),
            mkWe('Man', 'Operador de trimming CNC', [
                mkFn('Operar router CNC según programa. Verificar contorno y bordes.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de trimming', [
                mkFn('Definir programa CNC de recorte, secuencia y criterios dimensionales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de contorno.', []),
            ]),
        ], 'Proveer pieza con contorno final conforme a plano', 'Recortar material excedente según programa CNC'),
        mkOp('OP 50', 'Edge Folding (doblado de bordes)', [
            mkWe('Machine', 'Equipo de edge folding', [
                mkFn('Doblar bordes del film sobre el sustrato', [
                    mkFail('Plegado incompleto', 'Borde expuesto', 'Borde visible, rechazo', 'Aspecto no terminado',
                        [mkCause('Temperatura o presión insuficiente', 'Parámetros documentados', 'Inspección visual de bordes')]),
                    mkFail('Arrugas en el doblez', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto no premium',
                        [mkCause('Exceso de material en esquinas', 'Técnica de doblado optimizada', 'Inspección visual 100%')]),
                ]),
            ]),
            mkWe('Man', 'Operador de edge folding', [
                mkFn('Operar equipo de doblado de bordes. Verificar plegado completo.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de edge folding', [
                mkFn('Definir parámetros de temperatura, presión y técnica de doblado.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes plegados.', []),
            ]),
        ], 'Doblar bordes de la pieza conforme a especificación', 'Plegar bordes manteniendo adhesión y geometría'),
        mkOp('OP 60', 'Soldado (welding)', [
            mkWe('Machine', 'Soldadora ultrasónica / térmica', [
                mkFn('Soldar componentes al conjunto', [
                    mkFail('Soldadura insuficiente', 'Unión débil', 'Desprendimiento en uso', 'Falla de seguridad',
                        [mkCause('Energía de soldadura insuficiente o superficie contaminada', 'Parámetros documentados, limpieza pre-soldadura', 'Ensayo de resistencia de soldadura')]),
                    mkFail('Quemaduras o marcas de soldadura', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                        [mkCause('Energía excesiva o tiempo excesivo', 'Control de parámetros', 'Inspección visual')]),
                ]),
            ]),
            mkWe('Man', 'Operador de soldadura', [
                mkFn('Operar soldadora según parámetros validados. Verificar unión y aspecto.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de soldado', [
                mkFn('Definir parámetros de soldadura (energía, amplitud, tiempo) y controles.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de soldadura.', []),
            ]),
        ], 'Unir componentes mediante soldadura conforme a especificación', 'Soldar según parámetros validados de tiempo y temperatura'),
        mkOp('OP 70', 'Control final e inspección', [
            mkWe('Measurement', 'Instrumentos de inspección, patrón VWA', [
                mkFn('Verificar conformidad visual, dimensional y funcional', [
                    mkFail('Liberación de producto no conforme', 'Costo interno', 'Reclamo VWA', 'Riesgo imagen marca',
                        [mkCause('Error de inspección', 'Capacitación, patrón actualizado', 'Auditoría de producto')]),
                ]),
            ]),
            mkWe('Man', 'Inspector de calidad', [
                mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
            ]),
            mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
            ]),
        ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
        mkOp('OP 80', 'Embalaje y despacho', [
            mkWe('Method', 'Procedimiento de embalaje VDA', [
                mkFn('Embalar según requerimientos VWA', [
                    mkFail('Daño en transporte', 'Scrap PT', 'Rechazo VWA', 'Línea detenida',
                        [mkCause('Embalaje inadecuado', 'Instrucción de embalaje VDA', 'Verificación antes de despacho')]),
                ]),
            ]),
            mkWe('Man', 'Operador de embalaje', [
                mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
            ]),
            mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
            ]),
        ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
    ];
}

/** Headrest manufacturing process: reception, injection, foam, costura, tapizado, ensamble, control, embalaje */
function buildHeadrestOps(headrestType) {
    return [
        mkOp('OP 10', 'Recepción de materia prima', [
            mkWe('Material', 'Sustrato plástico, espuma PU, recubrimiento (cuero/vinilo/tela), hilo, varilla metálica', [
                mkFn('Recibir materiales conforme a especificación VWA', [
                    mkFail('Material fuera de especificación', 'Retraso producción', 'Defecto en producto final', 'Reclamo de garantía',
                        [mkCause('Proveedor entrega material no conforme', 'Certificado de calidad por lote, auditoría proveedor', 'Inspección de recepción: dimensional, visual, certificado')]),
                ]),
            ]),
            mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
            ]),
            mkWe('Man', 'Operador de recepción / Calidad', [
                mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
            ]),
            mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                mkFn('Medir propiedades del material y verificar contra certificado.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
            ]),
        ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
        mkOp('OP 20', 'Inyección de sustrato plástico', [
            mkWe('Machine', 'Inyectora', [
                mkFn('Inyectar sustrato plástico para estructura del apoyacabezas', [
                    mkFail('Pieza incompleta (short shot)', 'Scrap', 'Falta de rigidez estructural', 'No funcional',
                        [mkCause('Parámetros de inyección fuera de rango', 'Receta documentada, monitoreo automático, SPC', 'Control de peso + inspección visual')]),
                    mkFail('Rebabas excesivas', 'Retrabajo de desbarbado', 'Dificultad de ensamble', 'Posible filo cortante',
                        [mkCause('Desgaste de molde o fuerza de cierre insuficiente', 'MP de molde, control de fuerza de cierre', 'Inspección visual 100%')]),
                    mkFail('Deformación/alabeo', 'Pieza no ensambla', 'Rechazo dimensional', 'Gap visible en vehículo',
                        [mkCause('Enfriamiento desigual o tiempo de ciclo inadecuado', 'Control de temperatura de molde', 'Control dimensional con gauge')]),
                ]),
            ]),
            mkWe('Man', 'Operador de inyección', [
                mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de inyección', [
                mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
            ]),
            mkWe('Material', 'Resina / Materia prima plástica', [
                mkFn('Proveer material plástico conforme a especificación (grado, humedad, MFI).', []),
            ]),
            mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
            ]),
        ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato según parámetros de proceso validados'),
        mkOp('OP 30', 'Espumado (inyección de PU)', [
            mkWe('Machine', 'Espumadora / Molde de espumado', [
                mkFn('Inyectar espuma de poliuretano para relleno del apoyacabezas', [
                    mkFail('Espumado incompleto (vacíos internos)', 'Pieza no conforme', 'Dureza no uniforme', 'Confort insuficiente',
                        [mkCause('Dosificación incorrecta o temperatura de molde fuera de rango', 'Receta de espumado documentada, control automático de dosificación', 'Control de peso + ensayo de dureza')]),
                    mkFail('Rebosamiento de espuma', 'Retrabajo de limpieza', 'Defecto visual', 'Aspecto no aceptable',
                        [mkCause('Exceso de dosificación o cierre de molde deficiente', 'Control de dosificación, mantenimiento de molde', 'Inspección visual 100%')]),
                ]),
            ]),
            mkWe('Man', 'Operador de espumado', [
                mkFn('Operar espumadora según receta. Verificar peso y aspecto de espumado.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de espumado', [
                mkFn('Definir parámetros de espumado (dosificación, temperatura, tiempo de curado).', []),
            ]),
            mkWe('Material', 'Poliol / Isocianato (componentes PU)', [
                mkFn('Proveer componentes de PU dentro de especificación y vida útil.', []),
            ]),
            mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                mkFn('Mantener condiciones ambientales controladas para curado uniforme de PU.', []),
            ]),
        ], 'Proveer relleno de espuma con densidad y dureza conformes', 'Inyectar PU según parámetros de dosificación y curado validados'),
        mkOp('OP 40', 'Corte de recubrimiento', [
            mkWe('Machine', 'Cortadora CNC / Mesa de corte', [
                mkFn('Cortar material de recubrimiento a medida', [
                    mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'No tapiza correctamente', 'Aspecto deficiente',
                        [mkCause('Programa de corte desactualizado o error de setup', 'Verificación de programa antes de inicio', 'Control dimensional con plantilla')]),
                ]),
            ]),
            mkWe('Man', 'Operador de corte', [
                mkFn('Operar la cortadora según instrucción de trabajo. Verificar primera pieza.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de corte', [
                mkFn('Definir programa de corte, secuencia y criterios de verificación dimensional.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de corte.', []),
            ]),
        ], 'Proveer material cortado conforme a requerimientos dimensionales', 'Lograr el contorno/forma del patrón conforme al modelo/plano'),
        mkOp('OP 50', 'Costura', [
            mkWe('Machine', 'Máquina de coser industrial', [
                mkFn('Unir piezas de recubrimiento mediante costura', [
                    mkFail('Costura desalineada o irregular', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable',
                        [mkCause('Guía de costura incorrecta o desgastada', 'Verificación de guía en setup, IT documentada', 'Inspección visual en proceso')]),
                    mkFail('Puntadas saltadas o rotas', 'Costura débil', 'Desprendimiento en uso', 'Falla funcional',
                        [mkCause('Aguja desgastada o tensión incorrecta', 'Cambio de aguja programado, control de tensión', 'Inspección visual + ensayo de tracción')]),
                ]),
            ]),
            mkWe('Man', 'Operador de costura', [
                mkFn('Operar máquina de coser según instrucción. Verificar costura.', []),
            ]),
            mkWe('Method', 'Hoja de operaciones de costura', [
                mkFn('Definir patrón de costura, tensión de hilo y secuencia de trabajo.', []),
            ]),
            mkWe('Material', 'Hilo / Aguja / Bobina', [
                mkFn('Proveer insumos de costura conformes a especificación.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para costura.', []),
            ]),
        ], 'Unir componentes mediante costura conforme a patrón y especificación', 'Realizar costura según patrón validado'),
        mkOp('OP 60', 'Tapizado y ensamble', [
            mkWe('Man', 'Operador de tapizado/ensamble', [
                mkFn('Recubrir conjunto espumado con material de recubrimiento cosido y ensamblar varilla', [
                    mkFail('Arrugas en recubrimiento', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable',
                        [mkCause('Tensión insuficiente del material durante tapizado', 'Instrucción de trabajo con técnica de tensión', 'Inspección visual 100%')]),
                    mkFail('Varilla mal posicionada o sin traba', 'Apoyacabezas no fija en asiento', 'Apoyacabezas se mueve o sale', 'Riesgo de seguridad',
                        [mkCause('Error de ensamble o fixture desalineado', 'Verificación de fixture, instrucción de ensamble', 'Control funcional de inserción/extracción')]),
                ]),
            ]),
            mkWe('Method', 'Hoja de operaciones de tapizado/ensamble', [
                mkFn('Definir técnica de tensado, secuencia de fijación y ensamble de varilla.', []),
            ]),
            mkWe('Machine', 'Fixture de ensamble', [
                mkFn('Proveer fixture calibrado para posicionamiento de varilla y tapizado.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para inspección de tapizado y ensamble.', []),
            ]),
        ], 'Cubrir conjunto con recubrimiento y ensamblar componentes mecánicos', 'Tapizar y ensamblar varilla según especificación'),
        mkOp('OP 70', 'Control final e inspección', [
            mkWe('Measurement', 'Instrumentos de inspección, patrón VWA, gauge funcional', [
                mkFn('Verificar conformidad visual, dimensional y funcional', [
                    mkFail('Liberación de producto no conforme', 'Costo de retrabajo/scrap', 'Reclamo de VWA', 'Riesgo de imagen de marca',
                        [mkCause('Error de inspección, criterio ambiguo', 'Patrón visual actualizado, capacitación', 'Auditoría de producto terminado')]),
                ]),
            ]),
            mkWe('Man', 'Inspector de calidad', [
                mkFn('Ejecutar inspección visual, dimensional y funcional según plan de control.', []),
            ]),
            mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
            ]),
        ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
        mkOp('OP 80', 'Embalaje y despacho', [
            mkWe('Method', 'Procedimiento de embalaje VDA', [
                mkFn('Embalar según requerimientos VWA', [
                    mkFail('Daño en transporte por embalaje inadecuado', 'Scrap de producto terminado', 'Rechazo en recepción VWA', 'Línea de VWA detenida',
                        [mkCause('No cumplimiento de instrucción de embalaje', 'Instrucción de embalaje VDA, capacitación', 'Verificación de embalaje antes de despacho')]),
                ]),
            ]),
            mkWe('Man', 'Operador de embalaje', [
                mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
            ]),
            mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
            ]),
            mkWe('Environment', 'Iluminación - Ley 19587', [
                mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
            ]),
        ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
    ];
}

// ─── Product Definitions ───────────────────────────────────────────────

const PRODUCTS = [
    {
        projectName: 'VWA/PATAGONIA/INSERT',
        partName: 'Insert',
        partNumber: 'N 227 a N 403',
        amfeNumber: 'AMFE-INS-PAT',
        familyId: 2,
        buildOps: buildInsertOps,
    },
    {
        projectName: 'VWA/PATAGONIA/ARMREST_DOOR_PANEL',
        partName: 'Armrest Door Panel',
        partNumber: 'N 231',
        amfeNumber: 'AMFE-ARM-PAT',
        familyId: 8,
        buildOps: buildArmrestOps,
    },
    {
        projectName: 'VWA/PATAGONIA/TOP_ROLL',
        partName: 'Top Roll',
        partNumber: '2GJ.868.087 / 2GJ.868.088',
        amfeNumber: 'AMFE-TR-PAT',
        familyId: 5,
        buildOps: buildTopRollOps,
    },
    {
        projectName: 'VWA/PATAGONIA/HEADREST_FRONT',
        partName: 'Headrest Front',
        partNumber: '2HC881901 RL1',
        amfeNumber: 'AMFE-HF-PAT',
        familyId: 9,
        buildOps: () => buildHeadrestOps('Front'),
    },
    {
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
        partName: 'Headrest Rear Center',
        partNumber: '2HC885900 RL1',
        amfeNumber: 'AMFE-HRC-PAT',
        familyId: 10,
        buildOps: () => buildHeadrestOps('Rear Center'),
    },
    {
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
        partName: 'Headrest Rear Outer',
        partNumber: '2HC885901 RL1',
        amfeNumber: 'AMFE-HRO-PAT',
        familyId: 11,
        buildOps: () => buildHeadrestOps('Rear Outer'),
    },
];

// ─── Count causes in operations ────────────────────────────────────────
function countCauses(ops) {
    let count = 0;
    for (const op of ops) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    count += fail.causes.length;
                }
            }
        }
    }
    return count;
}

// ─── Main Execution ────────────────────────────────────────────────────

console.log('=== Restore 6 VWA AMFEs ===\n');

let inserted = 0;
let skipped = 0;
let errors = 0;

for (const product of PRODUCTS) {
    const { projectName, partName, partNumber, amfeNumber, familyId, buildOps } = product;

    // 1. Check if AMFE already exists for this project_name
    const { data: existing, error: checkErr } = await supabase
        .from('amfe_documents')
        .select('id, project_name')
        .eq('project_name', projectName);

    if (checkErr) {
        console.error(`  ERROR checking ${projectName}: ${checkErr.message}`);
        errors++;
        continue;
    }

    if (existing && existing.length > 0) {
        console.log(`  SKIP ${projectName} — already exists (id: ${existing[0].id})`);
        skipped++;
        continue;
    }

    // 2. Build operations and AMFE document
    const ops = buildOps();
    const amfeDoc = {
        header: mkAmfeHeader(partName, 'VWA', partNumber, amfeNumber),
        operations: ops,
    };

    const docId = uid();
    const causeCount = countCauses(ops);

    console.log(`  INSERT ${projectName}`);
    console.log(`    id:          ${docId}`);
    console.log(`    amfe_number: ${amfeNumber}`);
    console.log(`    part_number: ${partNumber}`);
    console.log(`    operations:  ${ops.length}`);
    console.log(`    causes:      ${causeCount}`);
    console.log(`    family_id:   ${familyId}`);

    if (DRY_RUN) {
        console.log(`    [DRY RUN — not saved]\n`);
        inserted++;
        continue;
    }

    // 3. Insert AMFE document
    const { error: insertErr } = await supabase
        .from('amfe_documents')
        .insert({
            id: docId,
            amfe_number: amfeNumber,
            project_name: projectName,
            subject: `Proceso de fabricación - ${partName}`,
            client: 'VWA',
            part_number: partNumber,
            responsible: 'F. Santoro',
            organization: 'Barack Mercosul',
            status: 'draft',
            operation_count: ops.length,
            cause_count: causeCount,
            ap_h_count: 0,
            ap_m_count: 0,
            coverage_percent: 0,
            start_date: '2026-03-14',
            last_revision_date: '2026-03-14',
            revision_level: 'A',
            data: amfeDoc,
        });

    if (insertErr) {
        console.error(`    ERROR inserting AMFE: ${insertErr.message}\n`);
        errors++;
        continue;
    }
    console.log(`    AMFE inserted OK`);

    // 4. Link to family_documents (check if already linked first)
    const { data: existingLink, error: linkCheckErr } = await supabase
        .from('family_documents')
        .select('id')
        .eq('family_id', familyId)
        .eq('module', 'amfe')
        .eq('document_id', docId);

    if (linkCheckErr) {
        console.error(`    WARNING: Could not check family_documents link: ${linkCheckErr.message}`);
    } else if (existingLink && existingLink.length > 0) {
        console.log(`    family_documents link already exists (id: ${existingLink[0].id})`);
    } else {
        // Also check if there's an existing master AMFE link for this family
        const { data: existingMasterLink } = await supabase
            .from('family_documents')
            .select('id, document_id')
            .eq('family_id', familyId)
            .eq('module', 'amfe')
            .eq('is_master', 1);

        if (existingMasterLink && existingMasterLink.length > 0) {
            // Update existing master link to point to new doc
            const { error: updateErr } = await supabase
                .from('family_documents')
                .update({ document_id: docId })
                .eq('id', existingMasterLink[0].id);

            if (updateErr) {
                console.error(`    WARNING: Could not update family_documents link: ${updateErr.message}`);
            } else {
                console.log(`    Updated family_documents link (id: ${existingMasterLink[0].id}) -> ${docId}`);
            }
        } else {
            // Create new master link
            const { error: linkErr } = await supabase
                .from('family_documents')
                .insert({
                    family_id: familyId,
                    module: 'amfe',
                    document_id: docId,
                    is_master: 1,
                });

            if (linkErr) {
                console.error(`    WARNING: Could not create family_documents link: ${linkErr.message}`);
            } else {
                console.log(`    Created family_documents link (family_id=${familyId}, master)`);
            }
        }
    }

    console.log('');
    inserted++;
}

console.log('=== Summary ===');
console.log(`  Inserted: ${inserted}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Errors:   ${errors}`);

if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Use --apply to save changes to Supabase.');
}

process.exit(errors > 0 ? 1 : 0);
