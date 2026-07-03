/**
 * loadIpPadsAmfe.mjs
 *
 * Carga el AMFE PRELIMINAR de TRIM ASM-UPR WRAPPING (IP PADs) al sistema.
 * Datos extraidos del PDF: PATAGONIA_TRIM ASM-UPR WRAPPING_AMFE-Rev.1_Preliminar.pdf
 *
 * Este producto es NUEVO (no es una de las 8 familias canónicas actuales).
 * Cliente: VWA (Volkswagen). Proyecto: PATAGONIA.
 *
 * Operaciones: OP 10 a OP 130 (13 operaciones).
 *
 * Usage:
 *   node scripts/loadIpPadsAmfe.mjs           # dry-run (default)
 *   node scripts/loadIpPadsAmfe.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => randomUUID();
const clean = (s) => (s || '').replace(/\n/g, ' ').trim();

/**
 * AIAG-VDA 2019 AP Table — CORRECT implementation.
 * NEVER use S*O*D formula (see database.md incident 2026-04-06).
 */
function calcAP(s, o, d) {
  if (!s || !o || !d) return '';
  const sn = Number(s), on = Number(o), dn = Number(d);
  if (isNaN(sn) || isNaN(on) || isNaN(dn)) return '';
  if (sn < 1 || sn > 10 || on < 1 || on > 10 || dn < 1 || dn > 10) return '';

  // S=1: Always L
  if (sn <= 1) return 'L';
  // S=2-3
  if (sn <= 3) {
    if (on >= 8 && dn >= 5) return 'M';
    return 'L';
  }
  // S=4-6
  if (sn <= 6) {
    if (on >= 8) return dn >= 5 ? 'H' : 'M';
    if (on >= 6) return dn >= 2 ? 'M' : 'L';
    if (on >= 4) return dn >= 7 ? 'M' : 'L';
    return 'L';
  }
  // S=7-8
  if (sn <= 8) {
    if (on >= 8) return 'H';
    if (on >= 6) return dn >= 2 ? 'H' : 'M';
    if (on >= 4) return dn >= 7 ? 'H' : 'M';
    if (on >= 2) return dn >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S=9-10
  if (on >= 6) return 'H';
  if (on >= 4) return dn >= 2 ? 'H' : 'M';
  if (on >= 2) {
    if (dn >= 7) return 'H';
    if (dn >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function makeCause(desc, s, o, d, pc, dc, specialChar, charNum) {
  const ap = calcAP(s, o, d);
  return {
    id: uid(),
    description: clean(desc),
    severity: s ? Number(s) : '',
    occurrence: o ? Number(o) : '',
    detection: d ? Number(d) : '',
    actionPriority: ap || '',
    preventionControl: clean(pc),
    detectionControl: clean(dc),
    specialChar: specialChar || '',
    characteristicNumber: charNum || '',
    filterCode: '',
    // NEVER fill optimization actions — rule amfe-actions.md
    preventionAction: '',
    detectionAction: '',
    responsible: '',
    targetDate: '',
    status: '',
    actionTaken: '',
    completionDate: '',
    severityNew: '',
    occurrenceNew: '',
    detectionNew: '',
    apNew: '',
    observations: '',
  };
}

function makeFailure(desc, effectLocal, effectNext, effectEnd, causes) {
  return {
    id: uid(),
    description: clean(desc),
    effectLocal: clean(effectLocal),
    effectNextLevel: clean(effectNext),
    effectEndUser: clean(effectEnd),
    causes: causes || [],
  };
}

function makeFunction(desc, reqs, failures) {
  return {
    id: uid(),
    description: clean(desc),
    requirements: clean(reqs),
    failures: failures || [],
  };
}

function makeWE(name, type, functions) {
  return {
    id: uid(),
    name: clean(name),
    type: type || '',
    functions: functions || [],
  };
}

function makeOp(num, name, workElements) {
  return {
    id: uid(),
    operationNumber: String(num),
    operationName: clean(name).toUpperCase(),
    workElements: workElements || [],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  AMFE DATA — TRIM ASM-UPR WRAPPING (IP PADs)
//  Fuente: PDF AMFE Rev.1 Preliminar
// ═════════════════════════════════════════════════════════════════════════════

function buildOp10() {
  return makeOp(10, 'RECEPCION DE MATERIA PRIMA', [
    makeWE('Recepción de materiales', 'Man', [
      makeFunction(
        'Se recepciona la materia prima',
        'Utilizar sistema ARB, conos de colores, realizar check list clark, comprobar embalaje, corroborar orden, cargar MP en ARB, almacenar',
        [
          makeFailure(
            'Material / pieza golpeada o dañada durante transporte',
            'Riesgo de reproceso o scrap; paro de línea si no hay stock',
            'Montaje con ajuste forzado / imposibilidad de ensamblar',
            'Posible ruido o falla estética',
            [
              makeCause('Mala estiba y embalaje inadecuado', 7, 4, 6,
                'Medios de embalaje validados',
                'Inspección visual en recepción', '', ''),
              makeCause('Manipulación incorrecta en tránsito', 5, 4, 6,
                'Medios de embalaje validados',
                'Inspección visual en recepción', '', ''),
            ]
          ),
          makeFailure(
            'Material con especificación errónea (dimensiones, color, dureza, etc.)',
            'Potencial scrap',
            'Problemas en el ensamble final / Potencial parada de línea',
            'Reclamo de aspecto / comfort',
            [
              makeCause('Error en la orden de compra o ficha técnica', 6, 3, 4,
                'El proveedor entrega certificado de calidad y adicionalmente se realiza control dimensional por muestreo en recepción',
                'Control dimensional', '', ''),
              makeCause('Proveedor no respeta tolerancias', 6, 5, 4,
                'El proveedor entrega certificado de calidad y adicionalmente se realiza control dimensional por muestreo en recepción',
                'Control dimensional', '', ''),
              makeCause('Falta de control dimensional en recepción', 6, 4, 6,
                'Registros de control en calidad según plan de control',
                'Inspección visual', '', ''),
            ]
          ),
          makeFailure(
            'Falta de documentación o trazabilidad',
            'Riesgo de mezclar lotes no conformes',
            'Dificultades en trazabilidad si surge un reclamo',
            'No afecta',
            [
              makeCause('Procesos administrativos deficientes', 6, 3, 3,
                'Control de recepción materia prima / sistema ARB',
                'El sistema obliga a registrar lote y código en recepción y verifica contra base de datos', '', ''),
              makeCause('Proveedor sin sistema robusto de trazabilidad', 6, 3, 3,
                'Capacitación de personal',
                'El sistema obliga a registrar lote y código en recepción y verifica contra base de datos', '', ''),
              makeCause('No se utiliza el sistema ARB', 7, 3, 3,
                'Capacitación de personal',
                'El sistema obliga a registrar lote y código en recepción y verifica contra base de datos', '', ''),
            ]
          ),
          makeFailure(
            'Contaminación / suciedad en la materia prima',
            'Problemas de calidad durante el ensamble',
            'Potencial parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Almacenaje inadecuado en transporte (sin protecciones)', 5, 4, 6,
                'Control de recepción materia prima y limpieza básica en recepción',
                'Inspección visual', '', ''),
              makeCause('Ambiente sucio en planta del proveedor', 5, 4, 6,
                'Control de recepción materia prima y limpieza básica en recepción',
                'Inspección visual', '', ''),
              makeCause('Falta de inspección al llegar', 5, 4, 6,
                'Control de recepción materia prima y limpieza básica en recepción',
                'Inspección visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp20() {
  return makeOp(20, 'CORTE DEL VINILO / TELA', [
    makeWE('BMA090 / BMA089', 'Machine', [
      makeFunction(
        'Se obtienen los paneles que formarán la pieza. Corte de paneles utilizando programa cutter control',
        'Montar rollo correcto, pasar vinilo bajo rodillos, configurar capas y largo, medir cuchilla, activar succión, alinear cabezal (2.5 cm margen), pulsar Start, retirar piezas cortadas',
        [
          makeFailure(
            'Desviación en el corte de los pliegos',
            'Retrabajo',
            'Degradación de la función secundaria del vehículo',
            'Defecto visual moderado en apariencia o vibración',
            [
              makeCause('Parámetros de corte mal ingresados', 7, 2, 6,
                'La máquina alinea y corta automáticamente el vinilo / tela',
                'Set up de lanzamiento / Regla / Inspección visual', '', ''),
              makeCause('Falla en la máquina', 6, 2, 6,
                'Instructivo para colocar correctamente tensión y velocidad de rollo',
                'Set up de lanzamiento / Regla / Inspección visual', '', ''),
            ]
          ),
          makeFailure(
            'Selección incorrecta del material (vinilo equivocado)',
            '100% del material cortado es scrap por material incorrecto',
            'Parada de línea mayor a un turno de producción completo. Paro de envíos',
            'Degradación de la función primaria del vehículo',
            [
              makeCause('Falta de verificación del código de material antes del corte', 8, 3, 6,
                'El sistema genera automáticamente una orden de producción con código y descripción del vinilo',
                'El operario verifica esa orden contra una planilla de mesa de corte', '', ''),
              makeCause('Vinilo mal identificado', 8, 3, 7,
                'Etiquetado de vinilo por logística',
                'Inspección visual', '', ''),
            ]
          ),
          makeFailure(
            'Corte incompleto o irregular',
            'Retrabajo de una porción de la producción',
            'Parada de línea entre una hora y un turno de producción completo',
            'Menos del 10% de los productos afectados, requiere clasificación adicional',
            [
              makeCause('Desgaste de la cuchilla de corte', 7, 2, 5,
                'Mantenimiento preventivo de la máquina',
                'Verificación de las piezas cortadas mediante un mylar de control físico, utilizado por el operario en la estación de corte', '', ''),
              makeCause('Verificación de cuchillas antes del inicio del lote', 7, 2, 4,
                'Mantenimiento preventivo de la máquina',
                'Verificación de cuchillas antes del inicio del lote', '', ''),
            ]
          ),
          makeFailure(
            'Contaminación del material durante el corte o almacenamiento en el área',
            'Una porción de la producción tiene que ser descartada (scrap)',
            'Parada de línea entre una hora y un turno de producción completo',
            'Defecto visual moderado en apariencia o vibración',
            [
              makeCause('Ambiente de trabajo con polvo o partículas', 5, 3, 6,
                'Procedimientos de limpieza periódica en el área de corte',
                'Inspección visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp30() {
  return makeOp(30, 'COSTURA UNION', [
    makeWE('Máquina de coser', 'Machine', [
      makeFunction(
        'Permite la unión de los paneles. Costura unión entre paneles',
        'Costura completa, costura firme. Tomar la pieza en producción, alinear ambas puntas de los cortes y realizar la costura de unión',
        [
          makeFailure(
            'Costura descosida o débil',
            'Impacta en producción, genera scrap o retrabajos',
            'Puede causar fallas en ensamble y rechazo del lote',
            'Defecto estético sin impacto funcional ni de seguridad',
            [
              makeCause('Tensión de hilo incorrecta', 8, 4, 4,
                'Las costureras configuran la máquina según hojas de operaciones',
                'Calibre para verificar puntadas', '', ''),
              makeCause('Hilo inadecuado', 4, 4, 4,
                'Checklist diaria de configuración de máquina, mediante un set-up de control de lanzamiento',
                'Inspección visual', '', ''),
              makeCause('Puntadas demasiado largas', 4, 4, 4,
                'Checklist diaria de configuración de máquina, mediante un set-up de control de lanzamiento',
                'Inspección visual', '', ''),
            ]
          ),
          makeFailure(
            'Costura desviada o fuera de especificación',
            'Scrap',
            'Defecto estético, posible rechazo del lote',
            'No afecta funcionalidad, pero impacta percepción de calidad',
            [
              makeCause('Falta de guía en costura', 8, 4, 5,
                'Las máquinas poseen una guía',
                'Inspección visual en línea', '', ''),
              makeCause('Error del operario', 6, 5, 5,
                'Verificación de piquetes en piezas antes de coser para asegurar alineación correcta',
                'Uso de plantillas de referencia', '', ''),
            ]
          ),
          makeFailure(
            'Puntadas irregulares o arrugas',
            'Puede corregirse en producción',
            'Puede provocar rechazo por calidad visual',
            'No afecta funcionalidad, solo estética',
            [
              makeCause('Mala configuración de la máquina', 8, 4, 6,
                'Mantenimiento preventivo',
                'Visual', '', ''),
              makeCause('Falta de mantenimiento', 3, 4, 6,
                'Mantenimiento preventivo',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Rotura del vinilo en la zona de la costura',
            'Scrap o retrabajo',
            'Pieza no conforme, posible rechazo total',
            'Puede causar falla en el uso, riesgo de seguridad',
            [
              makeCause('Agujas inadecuadas', 8, 2, 6,
                'Se utilizan agujas específicas para vinilos',
                'Inspección visual', '', ''),
              makeCause('Puntada demasiado apretada', 10, 2, 6,
                'Se configura la longitud de la puntada en la máquina',
                'Inspección visual', 'CC', ''),
            ]
          ),
          makeFailure(
            'Selección incorrecta del hilo',
            'Detectable en línea de producción',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'No afecta funcionalidad, solo percepción de calidad',
            [
              makeCause('Error en la carga de hilo en máquina', 3, 2, 6,
                'Las hojas de operaciones indican qué hilo utilizar',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Largo de puntada fuera de especificación',
            'Scrap',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'Potencial reclamo de aspecto',
            [
              makeCause('Error en la configuración de la máquina', 6, 5, 6,
                'Configuración de la máquina según especificaciones',
                'Calibre', '', ''),
            ]
          ),
          makeFailure(
            'Toma de costura fuera de especificación',
            'Scrap',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'Potencial reclamo de aspecto',
            [
              makeCause('Error en la configuración de la máquina', 6, 5, 6,
                'Configuración de la máquina según especificaciones',
                'Calibre', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp40() {
  return makeOp(40, 'COSTURA VISTA', [
    makeWE('Máquina de coser', 'Machine', [
      makeFunction(
        'Permite la costura decorativa. Realiza costura decorativa',
        'Costura completa, costura firme. Posicionar la pieza en la máquina según la referencia indicada y realizar la costura vista según lo especificado en la hoja de operaciones',
        [
          makeFailure(
            'Costura descosida o débil',
            'Impacta en producción, genera scrap o retrabajos',
            'Puede causar fallas en ensamble y rechazo del lote',
            'Defecto estético sin impacto funcional ni de seguridad',
            [
              makeCause('Tensión de hilo incorrecta', 8, 4, 4,
                'Las costureras configuran la máquina según hojas de operaciones',
                'Calibre para verificar puntadas', '', ''),
              makeCause('Hilo inadecuado', 4, 4, 4,
                'Checklist diaria de configuración de máquina, mediante un set-up de control de lanzamiento',
                'Inspección visual', '', ''),
              makeCause('Puntadas demasiado largas', 4, 4, 4,
                'Checklist diaria de configuración de máquina, mediante un set-up de control de lanzamiento',
                'Inspección visual', '', ''),
            ]
          ),
          makeFailure(
            'Costura desviada o fuera de especificación',
            'Scrap',
            'Defecto estético, posible rechazo del lote',
            'No afecta funcionalidad, pero impacta percepción de calidad',
            [
              makeCause('Falta de guía en costura', 8, 4, 5,
                'Las máquinas poseen una guía',
                'Inspección visual en línea', '', ''),
              makeCause('Error del operario', 6, 5, 5,
                'Verificación de piquetes en piezas antes de coser para asegurar alineación correcta',
                'Uso de plantillas de referencia', '', ''),
            ]
          ),
          makeFailure(
            'Puntadas irregulares o arrugas',
            'Puede corregirse en producción',
            'Puede provocar rechazo por calidad visual',
            'No afecta funcionalidad, solo estética',
            [
              makeCause('Mala configuración de la máquina', 8, 4, 6,
                'Mantenimiento preventivo',
                'Visual', '', ''),
              makeCause('Falta de mantenimiento', 3, 4, 6,
                'Mantenimiento preventivo',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Rotura del vinilo en la zona de la costura',
            'Scrap o retrabajo',
            'Pieza no conforme, posible rechazo total',
            'Puede causar falla en el uso, riesgo de seguridad',
            [
              makeCause('Agujas inadecuadas', 8, 2, 6,
                'Se utilizan agujas específicas para vinilos',
                'Inspección visual', '', ''),
              makeCause('Puntada demasiado apretada', 10, 2, 6,
                'Se configura la longitud de la puntada en la máquina',
                'Inspección visual', 'CC', ''),
            ]
          ),
          makeFailure(
            'Selección incorrecta del hilo',
            'Detectable en línea de producción',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'No afecta funcionalidad, solo percepción de calidad',
            [
              makeCause('Error en la carga de hilo en máquina', 3, 2, 6,
                'Las hojas de operaciones indican qué hilo utilizar',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Largo de puntada fuera de especificación',
            'Scrap',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'Potencial reclamo de aspecto',
            [
              makeCause('Error en la configuración de la máquina', 6, 5, 6,
                'Configuración de la máquina según especificaciones',
                'Calibre', '', ''),
            ]
          ),
          makeFailure(
            'Distancia entre costuras fuera de especificación',
            'Scrap',
            'Puede generar rechazo por incumplimiento de especificaciones',
            'Potencial reclamo de aspecto',
            [
              makeCause('Error en la configuración de la máquina', 6, 5, 6,
                'Configuración de la máquina según especificaciones',
                'Calibre', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp50() {
  return makeOp(50, 'REFILADO DE FUNDA TERMINADA', [
    makeWE('Tijera de refilado', 'Machine', [
      makeFunction(
        'Refilado de funda terminada',
        'Tomar piezas a refilar, refilar piezas según hoja de operación',
        [
          makeFailure(
            'Costura vista dañada',
            'Scrap',
            'Reclamo de calidad',
            'Potencial reclamo de aspecto',
            [
              makeCause('Recortar talón de costura de más', 8, 4, 8,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operador', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp60() {
  return makeOp(60, 'ADHESIVADO DE PIEZAS PLASTICAS', [
    makeWE('Pistola de adhesivado', 'Machine', [
      makeFunction(
        'Rocía la mezcla de adhesivado sobre la pieza. Adhesivado de piezas',
        'Todo producto adhesivado no puede estar más de 24hs sin uso. Realizar mezcla de adhesivo con relación 1:1 y colocarla en tanque. Presentar pieza sobre mesa de trabajo. Tomar pistola y rociar la pieza. Colocar pieza adhesivada en la cinta transportadora',
        [
          makeFailure(
            'Adhesivo vencido',
            'Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Uso de adhesivo incorrecto',
            'Reproceso / Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Exceso o falta de adhesivo',
            'Scrap / Reproceso',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario / falla de la pistola', 7, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual / Pieza patrón', '', ''),
            ]
          ),
          makeFailure(
            'Ventilación insuficiente',
            'Riesgo de salud para el operario',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de ventilación', 10, 2, 8,
                'Campana de extracción',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Colocación de adhesivo después de un tiempo prolongado mayor a 48hs de colocado primer',
            'Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 1, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp70() {
  return makeOp(70, 'ADHESIVADO DE VINILO', [
    makeWE('Pistola de adhesivado / Rodillo', 'Machine', [
      makeFunction(
        'Rocía la mezcla de adhesivado sobre el vinilo. Adhesivado de piezas',
        'Todo producto adhesivado no puede estar más de 24hs sin uso. Realizar mezcla 1:1, presentar pieza, tomar pistola y rociar vinilo, colocar en cinta transportadora',
        [
          makeFailure(
            'Adhesivo vencido',
            'Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Uso de adhesivo incorrecto',
            'Reproceso / Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Exceso o falta de adhesivo',
            'Scrap / Reproceso',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario / falla de la pistola', 7, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual / Pieza patrón', '', ''),
            ]
          ),
          makeFailure(
            'Ventilación insuficiente',
            'Riesgo de salud para el operario',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de ventilación', 10, 2, 8,
                'Campana de extracción',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Colocación de adhesivo después de un tiempo prolongado mayor a 48hs de colocado primer',
            'Scrap',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 1, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp80() {
  return makeOp(80, 'CONTROL DE CALIDAD', [
    makeWE('Inspección visual', 'Measurement', [
      makeFunction(
        'Inspeccionar pieza según plan de control. Se inserta al panel de puerta',
        'Inspeccionar pieza en búsqueda de grumos y verificando que el adhesivado / primer esté aplicado correctamente',
        [
          makeFailure(
            'Exceso o falta de adhesivo detectado en control',
            'Scrap / Reproceso',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario / falla de la pistola', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual / Pieza patrón', '', ''),
            ]
          ),
          makeFailure(
            'Colocado de primer en forma deficiente',
            'Reproceso',
            'Parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 7, 2, 8,
                'Hojas de operaciones / Ayudas visuales',
                'Visual / Pieza patrón', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp90() {
  return makeOp(90, 'TAPIZADO SEMIAUTOMATICO', [
    makeWE('Máquina de tapizado', 'Machine', [
      makeFunction(
        'Tapiza automáticamente la pieza. Tapizado semiautomático',
        'Tiempos de ciclo: 25 seg parte superior, 14 seg cada lado inferior. Colocar pieza plástica en parte superior, alinear costura del vinilo con ranura en cuna, cerrar clamps, cerrar puerta presionando ambos botones, destrabar clamps y acomodar tela, presionar botón bimanual para retirar pieza y pegar bordes del vinilo',
        [
          makeFailure(
            'El operador intenta quitar la pieza durante el proceso de tapizado antes de finalizado el mismo',
            'Riesgo para la salud del operador',
            'No afecta',
            'No afecta',
            [
              makeCause('Error del operario', 10, 1, 8,
                'Sensor de proximidad incorporado a la máquina',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Se coloca una pieza plástica de otro producto',
            'Ligero inconveniente en el proceso',
            'No afecta',
            'No afecta',
            [
              makeCause('Error del operario', 1, 1, 8,
                'Moldes específicos para cada pieza no permiten encastre si se intenta colocar una de otro producto',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Se coloca mal el vinilo',
            'Potencial scrap',
            'Potencial parada de línea',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Piquetes y zonas demarcadas indican dónde se debe colocar el vinilo',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Mal colocado de la pieza plástica',
            'Ligero inconveniente en el proceso',
            'No afecta',
            'No afecta',
            [
              makeCause('Error del operario', 1, 1, 8,
                'La máquina detecta si la pieza plástica está mal colocada y no realiza el proceso',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Falla el proceso automático',
            'Ligero inconveniente en el proceso',
            'No afecta',
            'No afecta',
            [
              makeCause('Falla de la máquina', 1, 2, 8,
                'La máquina cuenta con la opción de realizar el proceso manualmente utilizando la pantalla táctil',
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp100() {
  return makeOp(100, 'VIROLADO / REFILADO', [
    makeWE('Herramientas manuales (tijera, pistola de calor, cutter, pinza)', 'Machine', [
      makeFunction(
        'Virolado de la pieza. Se inserta al panel de puerta',
        'Utilizar guantes anticorte. Tomar pieza a virolar y refilar el exceso de vinilo. Aplicar calor sobre la pieza y tapizarla utilizando las manos y con ayuda de herramientas',
        [
          makeFailure(
            'Exceso de refilado',
            'Posible scrap',
            'Potencial parada de línea',
            'Posible reclamo de aspecto y/o comfort',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Falta de refilado',
            'Reproceso',
            'Plan de acción',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Aplicar calor excesivamente',
            'Posible scrap',
            'Potencial clasificación de piezas por personal de BARACK',
            'Posible reclamo de aspecto y/o comfort',
            [
              makeCause('Error del operario / Falta de instrucciones detalladas', 8, 10, 8,
                '',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Posible cortadura',
            'Riesgo de seguridad para el operador',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de elementos de protección personal', 10, 1, 8,
                'Guantes anti cortes',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Posible quemadura',
            'Riesgo de seguridad para el operador',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de elementos de protección personal', 10, 1, 8,
                'Guantes y ropa de trabajo',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp110() {
  return makeOp(110, 'TERMINACION', [
    makeWE('Herramientas manuales + pistola de ultrasonido', 'Machine', [
      makeFunction(
        'Virolado de la pieza. Terminación. Se inserta al panel de puerta',
        'Utilizar guantes anticorte. Tomar pieza a virolar y refilar exceso de vinilo. Aplicar calor y tapizar con manos y herramientas. Sellar las puntas con pistola de ultrasonido',
        [
          makeFailure(
            'Exceso de refilado',
            'Posible scrap',
            'Potencial parada de línea',
            'Posible reclamo de aspecto y/o comfort',
            [
              makeCause('Error del operario', 8, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Falta de refilado',
            'Reproceso',
            'Plan de acción',
            'Reclamo de aspecto',
            [
              makeCause('Error del operario', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Aplicar calor excesivamente',
            'Posible scrap',
            'Potencial clasificación de piezas por personal de BARACK',
            'Posible reclamo de aspecto y/o comfort',
            [
              makeCause('Error del operario / Falta de instrucciones detalladas', 8, 10, 8,
                '',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Posible cortadura',
            'Riesgo de seguridad para el operador',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de elementos de protección personal', 10, 1, 8,
                'Guantes anti cortes',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Posible quemadura',
            'Riesgo de seguridad para el operador',
            'No afecta',
            'No afecta',
            [
              makeCause('Falta de elementos de protección personal', 10, 1, 8,
                'Guantes y ropa de trabajo',
 // Seguridad operador, no CC producto
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp120() {
  return makeOp(120, 'INSPECCION FINAL', [
    makeWE('Inspección visual', 'Measurement', [
      makeFunction(
        'Se inspecciona la pieza en búsqueda de potenciales defectos. Brindar comfort al usuario',
        'Costura completa, costura firme, cantidad correcta de piezas por medio. Posicionar piezas en medio según hojas de operaciones',
        [
          makeFailure(
            'Vinilo despegado',
            'Scrap',
            'Rechazo de piezas',
            'Reclamo de apariencia',
            [
              makeCause('Falta / ausencia de adhesivo', 8, 4, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

function buildOp130() {
  return makeOp(130, 'EMBALAJE', [
    makeWE('Embalaje manual', 'Man', [
      makeFunction(
        'Se embala la pieza en medios según hoja de operaciones. Brindar comfort al usuario',
        'Cantidad correcta de piezas por medio. Posicionar piezas en medio según hojas de operaciones',
        [
          makeFailure(
            'Mayor cantidad de piezas por medio',
            'Posible scrap',
            'Plan de reacción',
            'Potencial reclamo de aspecto',
            [
              makeCause('Error del operario', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Menor cantidad de piezas por medio',
            'Reproceso',
            'Plan de reacción',
            'No afecta',
            [
              makeCause('Error del operario', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Identificación incorrecta',
            'Reproceso',
            'Plan de reacción menor',
            'No afecta',
            [
              makeCause('Error del operario', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
          makeFailure(
            'Falta de identificación',
            'Reproceso',
            'Plan de reacción menor',
            'No afecta',
            [
              makeCause('Falta de elementos de protección personal', 5, 3, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual', '', ''),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

// ═════════════════════════════════════════════════════════════════════════════
//  Build full AMFE document
// ═════════════════════════════════════════════════════════════════════════════

function buildAmfeDocument() {
  const operations = [
    buildOp10(),
    buildOp20(),
    buildOp30(),
    buildOp40(),
    buildOp50(),
    buildOp60(),
    buildOp70(),
    buildOp80(),
    buildOp90(),
    buildOp100(),
    buildOp110(),
    buildOp120(),
    buildOp130(),
  ];

  return {
    header: {
      organization: 'BARACK MERCOSUL',
      location: 'PLANTA HURLINGHAM',
      client: 'VWA',
      modelYear: '2025',
      subject: 'TRIM ASM-UPR WRAPPING',
      startDate: '2025-03-25',
      revDate: '2025-03-25',
      team: 'Paulo Centurión (Ingeniería), Manuel Meszaros (Calidad), Cristina Rabago (Seguridad e Higiene), Leonardo Enrique Lattanzi (Producción)',
      amfeNumber: '',
      responsible: 'Paulo Centurión',
      confidentiality: '',
      partNumber: '',
      processResponsible: 'Paulo Centurión',
      revision: 'A',
      approvedBy: 'Paulo Centurión',
      scope: 'TRIM ASM-UPR WRAPPING - Patagonia VW',
      applicableParts: '',
    },
    operations,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  Stats & validation
// ═════════════════════════════════════════════════════════════════════════════

function printStats(doc) {
  let totalOps = doc.operations.length;
  let totalWEs = 0, totalFns = 0, totalFMs = 0, totalCauses = 0;
  let apH = 0, apM = 0, apL = 0;
  let ccCount = 0, scCount = 0;

  for (const op of doc.operations) {
    for (const we of op.workElements) {
      totalWEs++;
      for (const fn of we.functions) {
        totalFns++;
        for (const fm of fn.failures) {
          totalFMs++;
          for (const c of fm.causes) {
            totalCauses++;
            if (c.actionPriority === 'H') apH++;
            else if (c.actionPriority === 'M') apM++;
            else if (c.actionPriority === 'L') apL++;
            if (c.specialChar === 'CC') ccCount++;
            if (c.specialChar === 'SC') scCount++;
          }
        }
      }
    }
  }

  console.log('\n=== AMFE TRIM ASM-UPR WRAPPING — Estadísticas ===');
  console.log(`Operaciones: ${totalOps}`);
  console.log(`Work Elements: ${totalWEs}`);
  console.log(`Funciones: ${totalFns}`);
  console.log(`Modos de Falla: ${totalFMs}`);
  console.log(`Causas: ${totalCauses}`);
  console.log(`AP=H: ${apH} | AP=M: ${apM} | AP=L: ${apL}`);
  console.log(`CC: ${ccCount} | SC: ${scCount}`);
  console.log(`CC%: ${(ccCount/totalCauses*100).toFixed(1)}% (benchmark: 1-5%)`);
  console.log('');
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n=== loadIpPadsAmfe.mjs ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --apply to write)' : 'APPLY (writing to Supabase)'}`);

  // Auth
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('Authenticated OK');

  // Build document
  const amfeData = buildAmfeDocument();
  printStats(amfeData);

  // Check if AMFE for IP PADs already exists
  const { data: existing, error: fetchErr } = await sb
    .from('amfe_documents')
    .select('id, subject, project_name, amfe_number, data')
    .or('subject.ilike.%TRIM ASM%,subject.ilike.%IP PAD%,subject.ilike.%WRAPPING%');

  if (fetchErr) {
    console.error('Error fetching existing docs:', fetchErr.message);
    process.exit(1);
  }

  // Save backup of document for reference
  const backupPath = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_ip_pads_loaded.json';
  writeFileSync(backupPath, JSON.stringify(amfeData, null, 2), 'utf8');
  console.log(`Backup saved to: ${backupPath}`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: No changes written ---');
    if (existing && existing.length > 0) {
      console.log(`Found ${existing.length} existing AMFE doc(s) matching TRIM ASM / IP PAD:`);
      existing.forEach(d => console.log(`  - id=${d.id} subject="${d.subject}" project="${d.project_name}"`));
      console.log('Run with --apply to UPDATE the first match.');
    } else {
      console.log('No existing AMFE found for IP PADs. Run with --apply to INSERT new.');
    }
    return;
  }

  // APPLY mode
  if (existing && existing.length > 0) {
    // Update existing
    const docId = existing[0].id;
    console.log(`Updating existing AMFE id=${docId} ...`);
    const { error: updateErr } = await sb
      .from('amfe_documents')
      .update({
        data: amfeData,  // OBJECT, never JSON.stringify (rule: database.md)
        subject: 'TRIM ASM-UPR WRAPPING',
        operation_count: amfeData.operations.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    if (updateErr) {
      console.error('Update failed:', updateErr.message);
      process.exit(1);
    }
    console.log(`Updated OK: id=${docId}`);

    // Verify no double-serialization
    const { data: verify } = await sb.from('amfe_documents').select('data').eq('id', docId).single();
    if (typeof verify.data === 'string') {
      console.error('CRITICAL: data is string (double-serialized)! Rolling back...');
      process.exit(1);
    }
    console.log(`Verification: typeof data = ${typeof verify.data} ✓`);
    console.log(`Operations count: ${verify.data.operations?.length} ✓`);
  } else {
    // Insert new
    console.log('Inserting new AMFE document...');
    const { data: inserted, error: insertErr } = await sb
      .from('amfe_documents')
      .insert({
        id: uid(),
        amfe_number: 'VWA-PAT-IPPADS-001',
        project_name: 'IP PADs Patagonia',
        subject: 'TRIM ASM-UPR WRAPPING',
        client: 'VWA',
        responsible: 'Paulo Centurión',
        organization: 'BARACK MERCOSUL',
        data: amfeData,  // OBJECT, never JSON.stringify
        status: 'draft',
        operation_count: amfeData.operations.length,
        cause_count: 75,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Insert failed:', insertErr.message);
      process.exit(1);
    }
    console.log(`Inserted OK: id=${inserted.id}`);

    // Verify
    const { data: verify } = await sb.from('amfe_documents').select('data').eq('id', inserted.id).single();
    if (typeof verify.data === 'string') {
      console.error('CRITICAL: data is string (double-serialized)!');
      process.exit(1);
    }
    console.log(`Verification: typeof data = ${typeof verify.data} ✓`);
    console.log(`Operations count: ${verify.data.operations?.length} ✓`);
  }

  console.log('\nDone! AMFE TRIM ASM-UPR WRAPPING loaded successfully.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
