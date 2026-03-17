#!/usr/bin/env node
/**
 * COMPLETAR LAS 17 HO VACÍAS — INSERTO PATAGONIA (VW)
 *
 * Actualiza las hojas de operaciones placeholder con:
 * - Pasos reales derivados del AMFE
 * - Key Points TWI (seguridad, calidad, técnica)
 * - EPP (anteojos, guantes, zapatos, etc.)
 * - Quality Checks derivados del AMFE
 *
 * Imágenes disponibles:
 *   OP30: Imagen1.png, Imagen2.png
 *   OP40: Imagen3.png
 *   OP60: 1.png, 2.png, 3.png
 *
 * Usage: node scripts/seed-ho-complete.mjs
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomUUID } from 'crypto';

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const DB_PATH = join(
    process.env.APPDATA || join(process.env.USERPROFILE || 'C:\\Users\\FacundoS-PC', 'AppData', 'Roaming'),
    'com.barackmercosul.app',
    'barack_mercosul.db'
);

const DEFAULT_REACTION =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACIÓN\n' +
    'NOTIFIQUE DE INMEDIATO A SU LÍDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICIÓN DEL LÍDER O SUPERVISOR';

function mkStep(n, desc, isKeyPoint = false, reason = '') {
    return { id: uuid(), stepNumber: n, description: desc, isKeyPoint, keyPointReason: reason };
}

function mkQC(data) {
    return {
        id: uuid(),
        characteristic: data.char || '',
        specification: data.spec || '',
        evaluationTechnique: data.method || '',
        frequency: data.freq || '',
        controlMethod: data.control || '',
        reactionAction: data.reaction || DEFAULT_REACTION,
        reactionContact: data.contact || 'Líder / Supervisor',
        specialCharSymbol: data.sc || '',
        registro: data.reg || '',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATOS DE LAS 17 HOJAS DE OPERACIONES
// ═══════════════════════════════════════════════════════════════════════════

const sheetsData = {
    // ──────── OP 15: Preparación de corte ────────────────────────────────
    15: {
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        steps: [
            mkStep(1, 'Trasladar el rollo de material (vinilo/tela) desde almacén hasta la zona de corte con zorra manual.', true, 'Verificar que el material corresponda al código de la Orden de Producción'),
            mkStep(2, 'Colocar el rollo en el soporte de la cortadora de paños y asegurarlo firmemente.', true, 'El rollo debe estar estable para evitar desviaciones de corte'),
            mkStep(3, 'Medir la longitud del paño con la regla metálica fija como referencia. Alinear con la marca de corte.'),
            mkStep(4, 'Cortar el paño con la cortadora. Usar la primera capa cortada como plantilla para alinear las capas subsiguientes.', true, 'La primera capa define la referencia dimensional — SC'),
            mkStep(5, 'Apilar los paños cortados de forma ordenada, identificar con etiqueta (código, cantidad, turno).'),
        ],
        qualityChecks: [
            mkQC({ char: 'Largo del paño', spec: 'Según plan de control', method: 'Regla metálica fija', control: 'Medición de primera capa', freq: 'Inicio turno / cambio rollo', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Material correcto vs. OP', spec: 'Código coincide con Orden de Producción', method: 'Visual / Documentación', control: 'Verificar etiqueta rollo vs. OP', freq: 'Cada rollo', contact: 'OP', reg: 'Planilla' }),
        ],
    },

    // ──────── OP 20: Cortar componentes ─────────────────────────────────
    20: {
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        steps: [
            mkStep(1, 'Verificar el código de material en la etiqueta del rollo contra la planilla de mesa de corte.', true, 'Prevención de uso de material incorrecto — SC'),
            mkStep(2, 'Configurar los parámetros de corte en la máquina (velocidad, tensión de rollo, programa de corte).', true, 'Parámetros incorrectos generan scrap irrecuperable'),
            mkStep(3, 'Colocar el paño sobre la mesa de corte. Activar el vacío para fijar el material.'),
            mkStep(4, 'Iniciar el ciclo de corte automático. La máquina corta el contorno y las perforaciones.', true, 'Verificar visualmente que la cuchilla corte limpiamente'),
            mkStep(5, 'Verificar la primera pieza cortada contra el Mylar de control.', true, 'Verificación obligatoria de set-up — SC'),
            mkStep(6, 'Retirar las piezas cortadas de la mesa, separar residuos (scrap) y apilar piezas conformes.'),
            mkStep(7, 'Identificar las piezas con la etiqueta correspondiente (código, lote, turno, fecha).'),
        ],
        qualityChecks: [
            mkQC({ char: 'Contorno/forma de la pieza cortada', spec: 'Conforme a Mylar de control', method: 'Mylar de control', control: 'Comparación 1ra pieza vs Mylar', freq: 'Inicio turno / set-up', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Material correcto', spec: 'Etiqueta rollo = planilla mesa', method: 'Visual', control: 'Comparación visual etiqueta vs planilla', freq: 'Cada rollo', contact: 'OP', reg: 'Planilla', sc: 'SC' }),
            mkQC({ char: 'Estado de cuchilla', spec: 'Corte limpio, sin deshilachado', method: 'Visual', control: 'Verificación en set-up de lanzamiento', freq: 'Inicio turno', contact: 'OP', reg: 'Set up', sc: 'SC' }),
        ],
    },

    // ──────── OP 25: Control con mylar ───────────────────────────────────
    25: {
        safetyElements: ['anteojos'],
        steps: [
            mkStep(1, 'Tomar la pieza cortada y colocarla sobre el Mylar de control correspondiente.', true, 'Verificación dimensional obligatoria — SC'),
            mkStep(2, 'Verificar que el contorno de la pieza coincida completamente con el Mylar dentro de las tolerancias.'),
            mkStep(3, 'Verificar visualmente la pieza: sin deshilachados, contaminación ni roturas.'),
            mkStep(4, 'Si la pieza es conforme, aprobarla y devolverla al flujo. Caso contrario, seguir plan de reacción.', true, 'Decisión de aprobación/rechazo'),
        ],
        qualityChecks: [
            mkQC({ char: 'Conformidad dimensional del contorno', spec: 'Dentro de tolerancias del Mylar', method: 'Mylar de control', control: 'Superposición pieza/Mylar', freq: 'Según checklist de set-up', contact: 'OP', reg: 'Set up', sc: 'SC' }),
        ],
    },

    // ──────── OP 30: Almacenamiento WIP (corte → costura) ───────────────
    30: {
        safetyElements: ['zapatos'],
        steps: [
            mkStep(1, 'Verificar las piezas cortadas contra la Orden de Producción (OP): código, cantidad, variante de color.', true, 'Prevención de faltante/exceso en kit — SC'),
            mkStep(2, 'Inspeccionar visualmente cada componente: rechazar piezas con rasgaduras, manchas o defectos.', true, 'Última barrera de detección antes de costura'),
            mkStep(3, 'Armar el kit completo y ordenado según la OP en la caja/medio definido.'),
            mkStep(4, 'Etiquetar la caja con identificación mínima: N° de parte/modelo, OP, fecha/turno.', true, 'Trazabilidad obligatoria'),
            mkStep(5, 'Trasladar el kit a la zona de costura con zorra manual.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Kit completo según OP', spec: 'Cantidad y variantes correctas', method: 'Conteo visual', control: 'Verificación manual vs OP', freq: 'Cada kit', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Ausencia de defectos visuales', spec: 'Sin rasgaduras, manchas ni contaminación', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 40: Refilado ────────────────────────────────────────────
    40: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Tomar la pieza cosida y posicionarla en la máquina refiladora según la ayuda visual.', true, 'Posicionado correcto según tolerancia marcada en ayuda visual — SC'),
            mkStep(2, 'Accionar el ciclo de la máquina refiladora para generar la dimensión de refilado.'),
            mkStep(3, 'Verificar visualmente el refilado: sin rebaba, dimensión correcta. Comparar con pieza patrón de referencia.', true, 'Refilado fuera de especificación = retrabajo o scrap'),
            mkStep(4, 'Colocar la pieza refilada en el medio definido para la siguiente operación.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Dimensión de refilado', spec: 'Conforme a pieza patrón de referencia', method: 'Visual / pieza patrón', control: 'Control visual 100% + pieza patrón', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Estado de cuchilla refiladora', spec: 'Corte limpio, sin rebaba', method: 'Visual', control: 'Inspección de primera pieza', freq: 'Inicio turno / set-up', contact: 'Mant.', reg: 'Set up', sc: 'SC' }),
        ],
    },

    // ──────── OP 50: Costura CNC ─────────────────────────────────────────
    50: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Verificar la plantilla de la máquina CNC: confirmar que coincida con el código a producir (código en HMI vs plantilla física).', true, 'Patrón de costura incorrecto = scrap irrecuperable — SC'),
            mkStep(2, 'Colocar el material cortado en la plantilla de la máquina, alineando bordes con los topes físicos y guías.', true, 'Colocación sin pliegues ni tensión desigual es crítica'),
            mkStep(3, 'Verificar el enhebrado del hilo superior e inferior. Confirmar color de hilo según variante (Jet Black / Alpe Gray).', true, 'Hilo incorrecto = defecto de aspecto — SC'),
            mkStep(4, 'Iniciar el ciclo de costura CNC. Monitorear auditivamente: escuchar posibles pérdidas neumáticas.', true, 'Detección de fugas de presión de aire durante el ciclo'),
            mkStep(5, 'Al finalizar el ciclo, retirar la pieza y realizar autocontrol visual: costura completa, sin saltos, sin hilos sueltos.'),
            mkStep(6, 'Cortar hilos sobrantes con piquete (max 6 cm de hilo residual al inicio/final).'),
            mkStep(7, 'Colocar la pieza cosida en el medio de transporte.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Patrón de costura (programa)', spec: 'Código HMI = plantilla física', method: 'Visual', control: 'Verificación cruzada en set-up', freq: 'Inicio turno / cambio código', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Costura completa sin saltos', spec: 'Sin saltos, sin hilos sueltos', method: 'Visual', control: 'Autocontrol 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Tensión de hilo', spec: 'Según puesta a punto / plan de control', method: 'Prueba inicial', control: 'Set-up al inicio turno', freq: 'Inicio turno', contact: 'OP / Mant.', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Color de hilo correcto', spec: 'Según variante (Jet Black / Alpe Gray)', method: 'Visual', control: 'Verificación contra muestra', freq: 'Cada cambio de variante', contact: 'OP', reg: 'Planilla' }),
        ],
    },

    // ──────── OP 60: Troquelado de espuma ────────────────────────────────
    60: {
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        steps: [
            mkStep(1, 'Verificar que el troquel correcto esté instalado en la troqueladora puente (código del troquel según HO).', true, 'Troquel incorrecto = pieza con geometría errada — SC'),
            mkStep(2, 'Verificar que el material de espuma corresponda al indicado en la instrucción de proceso.', true, 'Material incorrecto = scrap o falla en ensamble — SC'),
            mkStep(3, 'Posicionar el material de espuma sobre la mesa de la troqueladora, alineando con las marcas visuales.'),
            mkStep(4, 'Accionar el ciclo de troquelado. Verificar que la pieza se haya cortado completamente.'),
            mkStep(5, 'Retirar la pieza troquelada e inspeccionar visualmente: contorno completo, sin deformaciones.', true, 'Inspección visual 100% de la pieza troquelada'),
            mkStep(6, 'Colocar la pieza troquelada en el medio definido para la siguiente operación.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Troquel correcto instalado', spec: 'Código troquel según HO', method: 'Visual', control: 'Verificación en set-up', freq: 'Inicio turno / cambio troquel', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Material de espuma correcto', spec: 'Según instrucción de proceso', method: 'Visual / etiqueta', control: 'Inspección visual + set-up', freq: 'Cada lote', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Geometría de la pieza troquelada', spec: 'Contorno completo, sin deformaciones', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A' }),
        ],
    },

    // ──────── OP 61: Almacenamiento WIP (troquelado) ────────────────────
    61: {
        safetyElements: ['zapatos'],
        steps: [
            mkStep(1, 'Verificar las piezas troqueladas contra la Orden de Producción: código, cantidad.', true, 'Prevención de faltante/exceso en kit'),
            mkStep(2, 'Inspeccionar visualmente cada pieza: rechazar piezas con rasgaduras, manchas o defectos.'),
            mkStep(3, 'Armar el kit completo y ordenado en la caja/medio definido.'),
            mkStep(4, 'Etiquetar la caja con identificación mínima: N° de parte/modelo, OP, fecha/turno.'),
            mkStep(5, 'Trasladar el kit a la zona de prearmado con zorra manual.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Kit completo según OP', spec: 'Cantidad y variantes correctas', method: 'Conteo visual', control: 'Verificación manual vs OP', freq: 'Cada kit', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 70: Inyección de piezas plásticas ──────────────────────
    70: {
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        steps: [
            mkStep(1, 'Verificar que el molde correcto esté instalado y limpio. Verificar parámetros de inyección en pantalla (presión, temperatura, tiempos).', true, 'Parámetros fuera de especificación = pieza defectuosa — SC'),
            mkStep(2, 'Verificar que el material plástico (PC/ABS CYCOLOY™) sea el correcto según la ficha técnica.', true, 'Material incorrecto = falla funcional — SC'),
            mkStep(3, 'Iniciar el ciclo de inyección. Monitorear los indicadores de la máquina.'),
            mkStep(4, 'Al finalizar el ciclo, descargar la pieza y realizar inspección visual al 100%: sin rebabas, quemaduras ni llenado incompleto.', true, 'Detección de defectos de inyección'),
            mkStep(5, 'Verificar la cota index de la pieza según plan de control (dimensional).', true, 'Cota index es crítica para ensamble en vehículo — SC'),
            mkStep(6, 'Aprobar la pieza conforme o segregar en contenedor de rechazo.'),
            mkStep(7, 'Colocar la pieza aprobada en el medio de embalaje intermedio.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Parámetros de inyección (P, T, t)', spec: 'Según set-up definido', method: 'Display de máquina', control: 'Monitoreo automático + set-up', freq: 'Inicio turno / continuo', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Llenado completo de la pieza', spec: 'Sin zonas incompletas ni rebabas', method: 'Visual', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Cota index dimensional', spec: 'Según plano / plan de control', method: 'Calibre', control: 'Medición por muestreo + 1ra pieza', freq: 'Inicio turno / cada 2h', contact: 'Calidad', reg: 'Planilla dimensional', sc: 'SC' }),
        ],
    },

    // ──────── OP 71: Almacenamiento WIP (inyección) ─────────────────────
    71: {
        safetyElements: ['zapatos'],
        steps: [
            mkStep(1, 'Verificar las piezas inyectadas contra la Orden de Producción: código, cantidad, variante de color.', true, 'Prevención de componente incorrecto — SC'),
            mkStep(2, 'Inspeccionar visualmente cada pieza: rechazar piezas con rasgaduras, manchas o defectos.'),
            mkStep(3, 'Armar el kit completo y ordenado en la caja/medio definido.'),
            mkStep(4, 'Etiquetar la caja con identificación mínima.'),
            mkStep(5, 'Trasladar el kit a la zona de prearmado con zorra manual.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Kit completo según OP', spec: 'Cantidad y variantes correctas', method: 'Conteo visual', control: 'Verificación manual vs OP', freq: 'Cada kit', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 80: Prearmado de espuma ─────────────────────────────────
    80: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Tomar la pieza plástica inyectada y el separador de espuma adhesivada del kit.'),
            mkStep(2, 'Retirar parcialmente el papel protector del adhesivo del separador de espuma.'),
            mkStep(3, 'Fijar un extremo del separador a la pieza plástica, alineando según la pieza patrón y ayuda visual.', true, 'Alineación correcta es crítica — SC'),
            mkStep(4, 'Adherir el resto del separador progresivamente, asegurando que no queden burbujas de aire.', true, 'Burbujas = pérdida de adherencia — SC'),
            mkStep(5, 'Verificar visualmente la adhesión: sin burbujas, alineación correcta.'),
            mkStep(6, 'Colocar la pieza prearmada en el medio definido para la siguiente operación.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Alineación del separador de espuma', spec: 'Conforme a pieza patrón', method: 'Visual / pieza patrón', control: 'Control visual 100% / autocontrol', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Ausencia de burbujas', spec: 'Sin burbujas de aire bajo el adhesivo', method: 'Visual / táctil', control: 'Inspección 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 81: Almacenamiento WIP (prearmado) ─────────────────────
    81: {
        safetyElements: ['zapatos'],
        steps: [
            mkStep(1, 'Verificar las piezas prearmadas contra la OP: código, cantidad.', true, 'Prevención de componente incorrecto'),
            mkStep(2, 'Inspeccionar visualmente: rechazar piezas con defectos.'),
            mkStep(3, 'Armar el kit completo y ordenado en la caja/medio definido.'),
            mkStep(4, 'Etiquetar la caja con identificación mínima.'),
            mkStep(5, 'Trasladar a la zona de adhesivado.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Kit completo según OP', spec: 'Cantidad correcta', method: 'Conteo visual', control: 'Verificación manual vs OP', freq: 'Cada kit', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 90: Adhesivar piezas ───────────────────────────────────
    90: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Verificar la fecha de caducidad del adhesivo/reticulante. Respetar FIFO.', true, 'Adhesivo vencido = falla de adherencia — SC'),
            mkStep(2, 'Preparar la mezcla de adhesivo según la proporción indicada en la hoja de proceso.', true, 'Proporción incorrecta = adhesión deficiente'),
            mkStep(3, 'Aplicar adhesivo con pistola de adhesivado sobre la pieza, siguiendo el patrón indicado en las instrucciones de proceso.', true, 'Exceso o falta de adhesivo son defecto'),
            mkStep(4, 'Verificar visualmente la cobertura del adhesivo: comparar contra muestra límite.'),
            mkStep(5, 'Colocar la pieza adhesivada en el medio definido para inspección.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Fecha de caducidad del adhesivo', spec: 'Dentro de vigencia', method: 'Visual / etiqueta', control: 'Verificación manual en set-up', freq: 'Cada lote', contact: 'OP', reg: 'Set up', sc: 'SC' }),
            mkQC({ char: 'Cobertura de adhesivo', spec: 'Según patrón en instrucción de proceso', method: 'Visual', control: 'Comparación vs muestra límite', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
            mkQC({ char: 'Proporción de mezcla', spec: 'Según hoja de proceso', method: 'Visual', control: 'Inspección visual de la mezcla', freq: 'Cada preparación', contact: 'OP', reg: 'Planilla' }),
        ],
    },

    // ──────── OP 91: Inspeccionar pieza adhesivada ──────────────────────
    91: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Tomar la pieza adhesivada del medio WIP.'),
            mkStep(2, 'Inspeccionar visualmente la cobertura del adhesivo: sin zonas sin adhesivo, sin excesos.', true, 'Adhesión insuficiente = despegue en uso — SC'),
            mkStep(3, 'Verificar la ausencia de contaminación, manchas o defectos de aspecto.'),
            mkStep(4, 'Si la pieza es conforme, colocar en medio OK. Caso contrario, colocar en scrap o retrabajo.', true, 'Decisión de aprobación/rechazo'),
        ],
        qualityChecks: [
            mkQC({ char: 'Adhesión completa', spec: 'Sin zonas descubiertas ni excesos', method: 'Visual / pieza patrón', control: 'Inspección visual 100%', freq: 'Cada pieza', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 92: Almacenamiento WIP (adhesivado) ────────────────────
    92: {
        safetyElements: ['zapatos'],
        steps: [
            mkStep(1, 'Verificar las piezas adhesivadas contra la OP: código, cantidad, variante de color.', true, 'Prevención de componente incorrecto'),
            mkStep(2, 'Inspeccionar visualmente: rechazar piezas con defectos.'),
            mkStep(3, 'Armar el kit completo y ordenado en la caja/medio definido.'),
            mkStep(4, 'Etiquetar la caja con identificación mínima.'),
            mkStep(5, 'Trasladar a la zona de tapizado.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Kit completo según OP', spec: 'Cantidad correcta', method: 'Conteo visual', control: 'Verificación manual vs OP', freq: 'Cada kit', contact: 'OP', reg: 'N/A', sc: 'SC' }),
        ],
    },

    // ──────── OP 103: Reproceso falta de adhesivo ───────────────────────
    103: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Tomar la pieza marcada como no conforme por falta de adhesivo.'),
            mkStep(2, 'Identificar las áreas donde falta adhesivo según la instrucción de proceso y ayuda visual.', true, 'Seguir el patrón de recorrido documentado'),
            mkStep(3, 'Aplicar adhesivo con brocha/pistola en las áreas faltantes, respetando la cantidad indicada (no aplicar doble capa).', true, 'No aplicar más de 1 vez — exceso interfiere con clips de fijación — SC'),
            mkStep(4, 'Verificar visualmente la cobertura: comparar contra la muestra límite.'),
            mkStep(5, 'Colocar la pieza reprocesada en el flujo para inspección de calidad.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Cobertura de adhesivo reprocesado', spec: 'Sin zonas descubiertas, sin exceso', method: 'Visual', control: 'Inspección de calidad post-reproceso', freq: 'Cada pieza reprocesada', contact: 'Calidad', reg: 'Planilla NC', sc: 'SC' }),
        ],
    },

    // ──────── OP 111: Clasificación y segregación de NC ──────────────────
    111: {
        safetyElements: ['anteojos', 'guantes'],
        steps: [
            mkStep(1, 'Tomar la pieza rechazada de la estación de inspección final.'),
            mkStep(2, 'Clasificar el defecto encontrado: identificar si es recuperable (retrabajo) o no (scrap).', true, 'Clasificación correcta evita mezcla de producto NC con OK — SC'),
            mkStep(3, 'Colocar la etiqueta/tarjeta de identificación de Scrap o Retrabajo en la pieza.', true, 'Etiqueta obligatoria antes de colocar en contenedor NC'),
            mkStep(4, 'Colocar la pieza en el contenedor correspondiente: OK, Retrabajo o Scrap. Los contenedores deben estar claramente separados e identificados.', true, 'Contenedores claramente diferenciados y separados físicamente — SC'),
            mkStep(5, 'Registrar el defecto en la planilla de no conformidades.'),
        ],
        qualityChecks: [
            mkQC({ char: 'Segregación correcta', spec: 'Pieza NC en contenedor NC, pieza OK en contenedor OK', method: 'Visual', control: 'Inspección visual de contenedores', freq: 'Continuo', contact: 'Calidad', reg: 'Planilla NC', sc: 'SC' }),
            mkQC({ char: 'Etiqueta de identificación NC', spec: 'Etiqueta/tarjeta colocada antes de segregar', method: 'Visual', control: 'Instrucción visual', freq: 'Cada pieza NC', contact: 'OP', reg: 'Planilla NC', sc: 'SC' }),
        ],
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: Actualizar la DB
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  COMPLETAR 17 HO VACÍAS — INSERTO PATAGONIA');
    console.log('══════════════════════════════════════════════════════════');

    if (!existsSync(DB_PATH)) {
        console.error(`❌ DB no encontrada: ${DB_PATH}`);
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const buffer = readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Load HO document
    const rows = db.exec(`
        SELECT id, data FROM ho_documents
        WHERE linked_amfe_project LIKE '%INSERTO%' OR linked_amfe_project LIKE '%PATAGONIA%'
        LIMIT 1
    `);

    if (!rows.length || !rows[0].values.length) {
        console.error('❌ HO Inserto Patagonia no encontrada en la DB.');
        db.close();
        process.exit(1);
    }

    const hoId = rows[0].values[0][0];
    const hoDoc = JSON.parse(rows[0].values[0][1]);

    console.log(`\n   HO ID: ${hoId}`);
    console.log(`   Sheets totales: ${hoDoc.sheets.length}`);

    let updated = 0;

    for (const sheet of hoDoc.sheets) {
        const opNum = Number(sheet.operationNumber);
        const data = sheetsData[opNum];

        if (!data) continue;

        // Only update empty sheets (no steps)
        if (sheet.steps && sheet.steps.length > 0) {
            console.log(`   OP ${String(opNum).padStart(3)}: Ya tiene ${sheet.steps.length} pasos — SALTEAR`);
            continue;
        }

        sheet.steps = data.steps;
        sheet.qualityChecks = data.qualityChecks;
        sheet.safetyElements = data.safetyElements;
        sheet.reactionPlanText = DEFAULT_REACTION;
        sheet.reactionContact = 'Líder / Supervisor';
        sheet.date = '2026-03-17';
        sheet.revision = '2';
        sheet.status = 'borrador';

        updated++;
        console.log(`   OP ${String(opNum).padStart(3)}: ✅ ${data.steps.length} pasos, ${data.qualityChecks.length} QC, EPP: [${data.safetyElements.join(', ')}]`);
    }

    if (updated === 0) {
        console.log('\n   Todas las HO ya tienen pasos. Nada que actualizar.');
        db.close();
        return;
    }

    // Save back to DB
    const jsonStr = JSON.stringify(hoDoc);
    const checksum = sha256(jsonStr);

    db.run(
        `UPDATE ho_documents SET data = ?, checksum = ?, sheet_count = ?, updated_at = datetime('now') WHERE id = ?`,
        [jsonStr, checksum, hoDoc.sheets.length, hoId]
    );

    // Write DB
    const outBuffer = Buffer.from(db.export());
    writeFileSync(DB_PATH, outBuffer);

    console.log(`\n   ✅ ${updated} hojas actualizadas en la DB.`);
    console.log('══════════════════════════════════════════════════════════\n');

    db.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
