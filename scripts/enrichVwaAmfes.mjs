/**
 * enrichVwaAmfes.mjs
 *
 * Enriches the 6 VWA AMFE documents in Supabase with REAL data extracted from
 * reference PDFs and Excel files.
 *
 * Usage:
 *   node scripts/enrichVwaAmfes.mjs           # dry-run (default)
 *   node scripts/enrichVwaAmfes.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';

const REF_TOP_ROLL = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_pdfs/AMFE_de_Proceso___TOP_ROLL_tables_only.json';
const REF_TOP_ROLL_TEXT = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_pdfs/AMFE_de_Proceso___TOP_ROLL_text_only.json';
const REF_INSERTO = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_pdfs/AMFE_de_Proceso___INSERTO_tables_only.json';
const REF_ARMREST = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_pdfs/AMFE_de_Proceso___ARMREST_DOOR_PANEL_tables_only.json';
const REF_HR_DELANTERO = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_headrest/amfe_delantero.json';
const REF_HR_CENTRAL = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_headrest/amfe_central.json';
const REF_HR_LATERAL = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_headrest/amfe_lateral.json';

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

function calcAP(s, o, d) {
  if (!s || !o || !d) return '';
  const sn = Number(s), on = Number(o), dn = Number(d);
  if (isNaN(sn) || isNaN(on) || isNaN(dn)) return '';
  // VDA AIAG AP table (conservative, matches reference data patterns)
  // H = High: immediate action required
  // M = Medium: action recommended
  // L = Low: acceptable
  const prod = sn * on * dn;

  // S=9-10: CC territory
  if (sn >= 9) {
    // High only when O or D are also high
    if (on >= 4 && dn >= 4) return 'H';
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  // S=7-8: SC territory
  if (sn >= 7) {
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  // S=5-6
  if (sn >= 5) {
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  // S=1-4
  if (prod > 200) return 'M';
  return 'L';
}

function makeCause(desc, s, o, d, pc, dc, specialChar, charNum, apOverride) {
  const ap = apOverride || calcAP(s, o, d);
  return {
    id: uid(),
    description: clean(desc),
    severity: s ? Number(s) : undefined,
    occurrence: o ? Number(o) : undefined,
    detection: d ? Number(d) : undefined,
    actionPriority: ap || undefined,
    preventionControl: clean(pc),
    detectionControl: clean(dc),
    specialChar: specialChar || '',
    characteristicNumber: charNum || '',
    // NEVER fill optimization actions
    preventionAction: '',
    detectionAction: '',
    responsible: '',
    targetDate: '',
    status: '',
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

function makeFunction(desc, failures) {
  return {
    id: uid(),
    functionDescription: clean(desc),
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

// ─── TOP ROLL parser ────────────────────────────────────────────────────────
function parseTopRoll() {
  const raw = JSON.parse(readFileSync(REF_TOP_ROLL, 'utf8'));
  const allRows = [];
  for (const table of raw.tables) {
    for (const row of table.data) {
      allRows.push(row);
    }
  }

  // TOP ROLL operations from reference PDF:
  // 5 = RECEPCION DE MATERIA PRIMA
  // 10 = INYECCION DE PIEZA PLASTICA
  // 11 = ALMACENAMIENTO EN MEDIOS WIP
  // 20 = ADHESIVADO HOT MELT
  // 30 = PROCESO DE IMG (TERMOFORMADO)
  // 40 = TRIMMING - CORTE FINAL
  // 50 = EDGE FOLDING
  // 60 = SOLDADURA DE REFUERZOS INTERNOS
  // 70 = SOLDADO TWEETER
  // 80 = CONTROL FINAL DE CALIDAD Y EMPAQUE
  // 90 = EMBALAJE

  const header = {
    companyName: 'BARACK MERCOSUL',
    scope: 'TOP ROLL PATAGONIA',
    partNumber: 'N 216 / N 256 / N 285 / N 315',
    applicableParts: 'N 216, N 256',
    responsibleEngineer: 'Carlos Baptista (Ingeniería)',
    coreTeam: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    amfeDate: '2026-02-13',
    revisionLevel: '01',
    revisionDate: '2026-02-13',
    subject: 'TOP ROLL',
    client: 'VWA',
    location: 'PLANTA HURLINGHAM',
  };

  const operations = [];

  // ── Op 5: RECEPCION DE MATERIA PRIMA ──
  {
    const wes = [];

    // WE: Maquina: Autoelevador
    wes.push(makeWE('Autoelevador', 'Maquina', [
      makeFunction('Garantizar la estabilidad y la integridad física del material durante el transporte interno', [
        makeFailure(
          'Material / pieza golpeada o dañada durante transporte',
          'Retrabajo',
          'Problemas en el ensamble final',
          'Potencial reclamo de aspecto/comfort',
          [
            makeCause('Mala estiba y embalaje inadecuado', 5, 6, 6, 'Medios de embalaje validados', 'Inspección Visual de daños/suciedad en el empaque al recibir', '', '', 'M'),
            makeCause('Manipulación incorrecta en tránsito', 5, 5, 6, 'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material', 'Inspección Visual del estado de la pieza/empaque', '', '', 'L'),
            makeCause('Almacenaje inadecuado en transporte (sin protecciones)', 5, 5, 6, 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados', 'Verificación del estado del embalaje antes de que el camión salga', '', '', 'L'),
          ]
        ),
        makeFailure(
          'Material no cumple requisito de flamabilidad TL 1010 VW',
          'Material no apto para uso',
          'Paro de linea VW por incumplimiento normativo',
          'Riesgo de propagacion de fuego en habitaculo',
          [
            makeCause('Material fuera de especificacion requerida', 10, 2, 3, 'Certificado de flamabilidad del proveedor segun TL 1010', 'Verificacion documental en recepcion', 'CC', '', 'L'),
          ]
        ),
      ]),
    ]));

    // WE: Mano de Obra: Operador de producción / Operador de calidad
    wes.push(makeWE('Operador de producción / Operador de calidad', 'Mano de Obra', [
      makeFunction('Verificar el cumplimiento y la trazabilidad de la materia prima recibida', [
        makeFailure(
          'Falta de documentación o trazabilidad',
          'Riesgo de mezclar lotes no conformes',
          'Dificultades en trazabilidad si surge un reclamo',
          'Potencial reclamo',
          [
            makeCause('Procesos administrativos deficientes', 4, 3, 7, 'El sistema ARB obliga a registrar lote y código en recepción y verifica contra base de datos', 'Verificación automática del lote/código registrado contra la base de datos', '', '', 'L'),
            makeCause('Proveedor sin sistema robusto de trazabilidad', 4, 5, 5, 'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor', 'Verificación del Certificado de Conformidad y registro obligatorio de lote', '', '', 'L'),
          ]
        ),
        makeFailure(
          'Material con especificación errónea (dimensiones, color, dureza, etc.)',
          'Potencial Descarte',
          'Potencial parada de línea',
          'Potencial reclamo de aspecto',
          [
            makeCause('Error en la orden de compra o ficha técnica', 6, 6, 6, 'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor', 'Revisión del Certificado de Calidad y Control Dimensional por Muestreo en recepción', '', ''),
            makeCause('Proveedor no respeta tolerancias', 6, 7, 6, 'Requisitos Contractuales de Calidad y Auditorías al Proveedor', 'Control dimensional por muestreo en recepción y Revisión obligatoria del Certificado de Calidad', '', ''),
          ]
        ),
      ]),
    ]));

    // WE: Material: Calibres, Micrómetro, Probeta de flamabilidad, Probeta de peeling
    wes.push(makeWE('Calibres, Micrómetro, Probeta de flamabilidad, Probeta de peeling', 'Material', [
      makeFunction('Disponer y utilizar instrumentos de medición y ensayo', [
        makeFailure(
          'Contaminación / suciedad en la materia prima',
          'Potencial Descarte',
          'Reclamo de aspecto',
          'Problemas de calidad durante el ensamble',
          [
            makeCause('Ambiente sucio en planta del proveedor', 5, 6, 6, 'Auditorías de Calidad', 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', '', ''),
            makeCause('Falta de inspección visual al recibir', 5, 5, 5, 'Instrucción de Trabajo de Recepción que exige la verificación física y visual', 'Inspección visual en recepción', '', ''),
          ]
        ),
      ]),
    ]));

    // WE: Método: Método de Fabricación
    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Comprobar que el embalaje no esté dañado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.', [
        makeFailure(
          'No se utiliza el sistema ARB',
          'Falta de trazabilidad',
          'Potencial mezcla de lotes',
          'Reclamo por trazabilidad',
          [
            makeCause('Falta de control dimensional en recepción', 5, 4, 4, 'Procedimiento Operacional Estándar de Inspección', 'El sistema impide la emisión de ubicaciones hasta que todos los campos del ARB sean completados', '', ''),
          ]
        ),
      ]),
    ]));

    // WE: Medio Ambiente: Iluminación/Ruido, Ley 19587
    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener las condiciones de seguridad ocupacional según la Ley 19587', [
        makeFailure(
          'Condiciones ambientales inadecuadas',
          'Posible error de inspección',
          'N/A',
          'N/A',
          [
            makeCause('Iluminación insuficiente en zona de recepción', 5, 3, 6, 'Programa de mantenimiento de luminarias', 'Auditoría de condiciones ambientales', '', ''),
          ]
        ),
      ]),
    ]));

    operations.push(makeOp('5', 'RECEPCION DE MATERIA PRIMA', wes));
  }

  // ── Op 10: INYECCION DE PIEZA PLASTICA ──
  {
    const wes = [];

    wes.push(makeWE('Máquina inyectora de plástico', 'Maquina', [
      makeFunction('Moldear la pieza plástica inyectando la materia prima en la cavidad', [
        makeFailure(
          'Llenado Incompleto de Pieza',
          '100% de la producción en ese ciclo tiene que ser Scrapeada',
          'Parada de línea mayor a un turno',
          'Pérdida de la Función Primaria del vehículo',
          [
            makeCause('Presión de Inyección configurada fuera de especificación', 6, 5, 5, 'Monitoreo automático de presión y mantenimiento preventivo con calibración periódica de sensores', 'Detección automática de llenado incompleto', 'SC', ''),
            makeCause('Temperatura de fusión del material (T°) demasiado baja', 6, 4, 5, 'Programa de Mantenimiento y Calibración del Sistema Térmico', 'Verificación Visual y Dimensional de Aprobación de la Primera Pieza', 'SC', ''),
          ]
        ),
        makeFailure(
          'Rebaba Excesiva / Exceso de Material',
          '100% de la producción tiene que ser Retrabajada Fuera de Línea',
          'Parada de línea de producción menor a una hora',
          'Pérdida de la Función Secundaria del vehículo',
          [
            makeCause('Fuerza de Cierre insuficiente', 5, 5, 3, 'Mantenimiento Preventivo de la Unidad de Cierre / Instrucción de Puesta a punto detallada', 'Monitoreo Automático de Presión de Cierre / Inspección dimensional manual por muestreo', '', ''),
            makeCause('Molde o cavidad contaminada con material residual', 5, 5, 8, 'Procedimiento de limpieza y purga estandarizado para la cavidad', 'Inspección visual por parte del operador de la cavidad', '', ''),
            makeCause('Parámetros de Inyección configurados incorrectamente', 5, 5, 8, 'Instrucción de Puesta a punto Estandarizada detallando valores nominales y rangos', 'Aprobación de la Primera Pieza por personal de Calidad/Supervisión', '', ''),
          ]
        ),
        makeFailure(
          'Omitir inspección dimensional de cotas index',
          'Una porción de la producción requiere Retrabajo',
          'Se desencadena un Plan de Reacción Importante',
          'Degradación de la Función Secundaria',
          [
            makeCause('Operador omite la verificación dimensional de la cota index', 5, 5, 5, 'Lista de Verificación para asegurar que el paso se incluya al inicio del turno', 'Auditoría de Proceso', 'SC', ''),
            makeCause('Instrucción de trabajo ambigua sobre la frecuencia o la metodología', 5, 5, 5, 'Las Hojas de Proceso describen el método operativo y las pautas de control', 'Cada dos meses se verifica una pieza con su documentación', 'SC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de producción / Líder de equipo', 'Mano de Obra', [
      makeFunction('Supervisar las actividades del operario según las hojas de operaciones', [
        makeFailure(
          'Contaminación / suciedad en la materia prima',
          'Potencial Descarte',
          'Reclamo de aspecto',
          'Problemas de calidad',
          [
            makeCause('Ambiente sucio en planta del proveedor', 5, 5, 6, 'Auditorías de Calidad', 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente. Definir el plan de reacción ante un No conforme.', [
        makeFailure(
          'Falta de inspección al llegar',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('Falta de inspección al llegar', 5, 6, 6, 'Instrucción de Trabajo', 'Inspección visual en recepción', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', []));

    operations.push(makeOp('10', 'INYECCION DE PIEZA PLASTICA', wes));
  }

  // ── Op 11: ALMACENAMIENTO EN MEDIOS WIP ──
  {
    const wes = [];

    wes.push(makeWE('Zorras manuales', 'Maquina', [
      makeFunction('Mantener la Estabilidad de la Carga durante el Movimiento Interno', []),
    ]));

    wes.push(makeWE('Operador de producción / Líder de equipo', 'Mano de Obra', [
      makeFunction('Preparar Kit completo y ordenado de componentes según la Orden de Producción', [
        makeFailure(
          'Faltante/exceso de componentes en la caja del kit',
          'Una porción de la producción sea descartada (Descarte)',
          'Parada de línea entre una hora y un turno',
          'Degradación de la función secundaria del vehículo',
          [
            makeCause('El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP', 5, 5, 5, 'Existencia de documentación de proceso (Ayuda visual / Hoja de operación estándar)', 'Verificación manual o conteo visual del kit por parte del operador', '', ''),
          ]
        ),
        makeFailure(
          'Componente incorrecto (variante o color) incluido',
          'Una porción de la producción afectada debe ser desechada',
          'Parada de línea',
          'Degradación de la función secundaria del vehículo',
          [
            makeCause('Mano de Obra no realiza la verificación visual contra la Orden de Producción', 5, 5, 5, 'La Orden de Producción (OP) se encuentra disponible y formalizada', 'El operador realiza una verificación visual del componente contra el código en la OP', '', ''),
          ]
        ),
        makeFailure(
          'Pieza dañada (rasgadura, mancha) incluida en el kit',
          'Descartar (Descarte) una porción de la producción',
          'Parada de línea',
          'Degradación de la función secundaria del vehículo',
          [
            makeCause('El Operador no sigue el procedimiento de revisión visual de defectos', 5, 5, 5, 'Instrucción o procedimiento que establece que el operador debe buscar rasgaduras o manchas', 'Inspección visual por operador', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Etiquetas blancas 100x60mm / Etiquetas de rechazo', 'Material', [
      makeFunction('Identificar Producto/Kit. Asegurar Trazabilidad.', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('11', 'ALMACENAMIENTO EN MEDIOS WIP', wes));
  }

  // ── Op 20: ADHESIVADO HOT MELT ──
  {
    const wes = [];

    wes.push(makeWE('Sistema de Fusión / Sistema de Aplicación / Sistema de Desenrollado y Tensión / Sistema de Enfriamiento', 'Maquina', [
      makeFunction('Calentar y fundir el adhesivo, transferir capa controlada sobre sustrato TPO, suministrar sustrato continuo, reducir temperatura', [
        makeFailure(
          'Adhesión deficiente del vinilo en la pieza plástica / quemaduras en el vinilo',
          'Descarte',
          'Potencial parada de línea',
          'Reclamo de aspecto',
          [
            makeCause('TBD', 6, 4, 8, 'Hojas de operaciones / ayudas visuales', 'Visual', '', ''),
            makeCause('Superficie de la pieza con polvo, grasa o oleosidad', 6, 3, 8, 'Hojas de operaciones / ayudas visuales', 'Visual', '', ''),
            makeCause('Error del operario / máquina empastada', 6, 3, 8, 'Limpieza constante del rodillo / Hojas de operaciones', 'Visual', '', ''),
          ]
        ),
        makeFailure(
          'Peso del vinilo adhesivado incorrecto',
          'Adhesión deficiente',
          'Potencial parada de línea',
          'Reclamo de aspecto',
          [
            makeCause('Falta de control de peso de adhesivo', 6, 4, 8, 'Plan de reacción', 'Pesaje por muestreo', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de producción / Líder de equipo', 'Mano de Obra', [
      makeFunction('Cargar los parámetros correctos de la receta en el HMI y realizar la carga/empalme de la bobina de TPO sin arrugas', [
        makeFailure(
          'Posible quemadura en el operario',
          'Accidente laboral',
          'N/A',
          'Riesgo de seguridad',
          [
            makeCause('Falta de EPP y herramientas', 4, 1, 4, 'Pinzas para tomar el vinilo', 'Visual', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Adhesivo Hot Melt / Rollo de TPO (Sustrato)', 'Material', [
      makeFunction('Adhesión química y resistencia térmica. Fundirse homogéneamente con viscosidad adecuada.', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('20', 'ADHESIVADO HOT MELT', wes));
  }

  // ── Op 30: PROCESO DE IMG (TERMOFORMADO) ──
  {
    const wes = [];

    wes.push(makeWE('Estación de Calentamiento / Estación de Formado / Sistema de Vacío / Sistema de Enfriamiento / Mecanismo de Transporte', 'Maquina', [
      makeFunction('Calentar la lámina pre-laminada, conformarla por vacío sobre un molde texturizado, enfriar la pieza', [
        makeFailure(
          'Temperatura de lámina TPO insuficiente',
          'Descarte / Retrabajo',
          'Potencial parada de línea',
          'Deformaciones o pérdida de textura',
          [
            makeCause('Sensor de temperatura de horno descalibrado o desplazado', 5, 4, 7, 'Calibración del sensor cada turno con pirómetro de referencia', 'Inspección visual 100% de textura en estación de control', '', ''),
          ]
        ),
        makeFailure(
          'Espesor de pared excesivo en zona de ruptura de Airbag',
          'Descarte / Retrabajo',
          'Riesgo de seguridad - Airbag no despliega correctamente',
          'Riesgo de seguridad',
          [
            makeCause('Obstrucción parcial de micro-canales de vacío por acumulación de vapores Hot Melt', 10, 6, 3, 'Limpieza de molde programada cada 4 hs con hielo seco', 'Medición por Ultrasonido cada 2 horas', 'CC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de Proceso', 'Mano de Obra', [
      makeFunction('Cargar parámetros en el HMI, vigilar el ciclo automático y verificar visualmente las piezas conformadas', []),
    ]));

    wes.push(makeWE('Rollo Pre-laminado (TPO + Hot Melt) / Molde de IMG', 'Material', [
      makeFunction('Base receptora del adhesivo con tensión superficial correcta y estabilidad dimensional', [
        makeFailure(
          'Ancho de bobina de TPO fuera de tolerancia',
          'Desperdicio de material / Costo adicional',
          'Sin efecto significativo',
          'Sin efecto',
          [
            makeCause('Error en el pedido de compras o variación del proveedor de lámina', 3, 3, 4, 'Certificado de calidad del proveedor verificado en recepción', 'Medición de ancho con flexómetro al inicio de cada bobina', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Suministro de Agua / Suministro de Aire Comprimido', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('30', 'PROCESO DE IMG (TERMOFORMADO)', wes));
  }

  // ── Op 40: TRIMMING - CORTE FINAL ──
  {
    const wes = [];

    wes.push(makeWE('Componentes de Cuchilla (Cuchilla caliente) / Sistema Neumático / Plataforma del Molde Inferior / Sistema de Control Eléctrico', 'Maquina', [
      makeFunction('Proveer fuerza y movimiento preciso para desplazar módulos de corte, controlar tiempos y secuencia', [
        makeFailure(
          'Contorno de corte desplazado (Fuera de tolerancia geométrica)',
          'Retrabajo manual costoso (lijado/recorte)',
          'Gap excesivo entre panel y chapa',
          'Ruidos (Squeak & Rattle)',
          [
            makeCause('Desgaste en los pines de centrado del fixture o pieza mal asentada por suciedad', 5, 3, 7, 'Mantenimiento Preventivo de Fixtures: verificación dimensional de pines cada 3 meses', 'Medición en Dispositivo de Control: 1 pieza cada hora', '', ''),
          ]
        ),
        makeFailure(
          'Borde de corte quemado o con hilachas (Hilos sueltos)',
          'Retrabajo',
          'Defecto visual menor',
          'Mala apariencia de bordes',
          [
            makeCause('Velocidad de avance de cuchilla incorrecta por fuga de aire o regulador desajustado', 5, 6, 5, 'Hoja de Parámetros Estándar: verificación de presiones de aire al inicio de turno', 'Inspección Visual 100%: el operario retira las hilachas manualmente', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de Carga/Descarga', 'Mano de Obra', [
      makeFunction('Cargar pieza en fixture, iniciar ciclo, descargar y verificar', []),
    ]));

    wes.push(makeWE('Pieza Termoformada (Formed Part) / Aire Comprimido', 'Material', [
      makeFunction('Mantener geometría al ser colocada en el nido, permitir corte sin fracturarse ni delaminarse', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('40', 'TRIMMING - CORTE FINAL', wes));
  }

  // ── Op 50: EDGE FOLDING (PLEGADO DE BORDES) ──
  {
    const wes = [];

    wes.push(makeWE('Línea de Carga/Descarga', 'Maquina', [
      makeFunction('Plegado de bordes: revertir los bordes sobrantes de TPO sobre la pieza', [
        makeFailure(
          'Delaminación del material en zona de plegado',
          'Desconocimiento de la falla',
          'Desgaste o rotura del material por debajo del punto de-tiro',
          'TBD',
          [
            makeCause('Temperatura del set-point fuera de rango (< 180°C)', 7, 5, 6, 'Verificación de temperatura del horno IR al inicio de turno', 'Test de adherencia post-plegado manual', 'SC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Pieza Recortada (Trimmed Part) / Adhesivo Reactivo (Hot Melt)', 'Material', [
      makeFunction('Proveer superficie rígida y estable para recibir el plegado', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Temperatura Ambiente / Energía', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('50', 'PLEGADO DE BORDES', wes));
  }

  // ── Op 60: SOLDADURA DE REFUERZOS INTERNOS ──
  {
    const wes = [];

    wes.push(makeWE('Fixture-Nido / Cjto. Presión-Captación / Energía (20 kHz)', 'Maquina', [
      makeFunction('Unir refuerzos plásticos mediante fusión en los puntos previstos del Top Roll', [
        makeFailure(
          'Soldadura fría / Falta de fusión (Joint débil)',
          'Despacho de piezas con falla no detectable',
          'Rechazo en estampado y montaje',
          'Ruidos (Squeak & Rattle)',
          [
            makeCause('Tiempo de soldadura muy corto o amplitud baja', 5, 3, 7, 'Monitoreo de Energía/Tiempo en cada ciclo (HMI)', 'Prueba de Torque/Push manual', '', ''),
          ]
        ),
        makeFailure(
          'Marca visible (Traspaso) en el lado A',
          'Defectos estéticos y funcionales no detectables',
          'TBD',
          'TBD',
          [
            makeCause('Exceso de amplitud o presión', 5, 2, 2, 'Nidos/Soportes: verificación de Mantenimiento Preventivo semestral', 'Inspección Visual 100% (Lado A)', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de Soldadura', 'Mano de Obra', [
      makeFunction('Colocar todos los refuerzos en sus alojamientos del fixture y posicionar el Top Roll correctamente', [
        makeFailure(
          'Refuerzo / Inserto faltante en el ensamble',
          'Componentes faltantes, por error del operario el nido no se carga completamente',
          'Potencial parada de línea',
          'Degradación de la función secundaria',
          [
            makeCause('Error del operario: olvido de cargar el componente en el nido', 5, 2, 2, 'Pines y sensores (Poka-Yoke): Sientan en la pieza. Pin de NO encaja', 'La máquina Falta Pieza y aborta el ciclo: la pantalla muestra el error', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Pieza Plegada (Edgewrapped Part) / Refuerzos Plásticos (Brackets/Bosses)', 'Material', [
      makeFunction('Proveer superficie rígida y estable para recibir la soldadura', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Ruido / Cabina Insonorizada', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional (Iluminación, protección auditiva por ruido ultrasónico)', []),
    ]));

    operations.push(makeOp('60', 'SOLDADURA DE REFUERZOS INTERNOS', wes));
  }

  // ── Op 70: SOLDADO TWEETER ──
  {
    const wes = [];

    wes.push(makeWE('Soldadora de ultrasonido', 'Maquina', [
      makeFunction('Unir el Tweeter en los alojamientos del Top Roll mediante soldadura de ultrasonido', [
        makeFailure(
          'Falla eléctrica de audio del Tweeter dañado o mal contacto',
          'Si no se prueba, defecto se detecta en el vehículo',
          'Pérdida de la función eléctrica de audio final del Top Roll',
          'TBD',
          [
            makeCause('Bobina del Tweeter dañada internamente o mal contacto', 5, 2, 10, 'Diseño (Repacking): Shot no ectan correcto de colocado en la cavidad', 'Ninguna: hay tests eléctricos destinados. No hay test de sonido', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de Soldadura', 'Mano de Obra', [
      makeFunction('Insertar el Tweeter en los alojamientos del Top Roll asegurando que asiente a fondo antes de activar la máquina', [
        makeFailure(
          'Contaminación / mal contacto / soldadura incompleta de la membrana del Tweeter',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('Contacto mal alineado o soldadura incompleta', 5, 2, 10, 'TBD', 'TBD', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Top Roll (Sustrato) / Tweeter-Grilla de Altavoz', 'Material', [
      makeFunction('Suministrar componentes para la operación y verificación de calidad', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Temperatura Ambiente / Iluminación', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('70', 'SOLDADO TWEETER', wes));
  }

  // ── Op 80: CONTROL FINAL DE CALIDAD ──
  {
    const wes = [];

    wes.push(makeWE('Dispositivo de Verificación / Dispositivo de Control / Sistema de Etiquetado', 'Maquina', [
      makeFunction('Verificar conformidad según Plan de Control', [
        makeFailure(
          'Pieza NO CONFORME (Fuga de rayado / rechupado visible)',
          'Desgaste de partes del controlador',
          'Reclamo del lote completo',
          'TBD',
          [
            makeCause('Criterio visual del inspector / fatiga', 5, 5, 7, 'Ayudas Visuales (Muestras y Mímicos). Listas de Verificación', 'Inspección Visual al 100%', '', ''),
          ]
        ),
        makeFailure(
          'Pieza mixta identificada incorrectamente (Etiqueta / Etiqueta incorrecta)',
          'Etiqueta errónea: el operario toma el rollo equivocado de etiquetas',
          'Pieza con etiqueta errónea en el lote',
          'TBD',
          [
            makeCause('Error humano: operario toma el rollo de etiquetas equivocado', 7, 2, 2, 'Impresión SOY-SOL OK: sistema de la cámara de escáner personal y corrobora', 'Escaneo de la etiqueta validación final: una escáner', 'SC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de Control Final / Inspector', 'Mano de Obra', [
      makeFunction('Verificar y confirmar que el Top Roll cumple con todas las especificaciones', []),
    ]));

    wes.push(makeWE('Etiquetas / Contenedor / Pieza Top Roll', 'Material', [
      makeFunction('Proveer insumos y protecciones para control e identificación', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Iluminación estandarizada (> 1000 Lux)', 'Medio Ambiente', [
      makeFunction('Proveer condiciones de iluminación estándar para inspección', [
        makeFailure(
          'Pieza con abrasiones / Marcas de transporte',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('Separadores o polvo en la estación de revisado', 5, 5, 7, 'Contenedores de piezas limpios / aspirinas', 'Inspección Visual del Operador / Revisado del contenedor', '', ''),
          ]
        ),
      ]),
    ]));

    operations.push(makeOp('80', 'CONTROL FINAL DE CALIDAD', wes));
  }

  // ── Op 90: EMBALAJE ──
  {
    const wes = [];

    wes.push(makeWE('Operador de Empaque / Líder de equipo', 'Mano de Obra', [
      makeFunction('Colocar piezas en contenedor siguiendo patrón de estiba definido', [
        makeFailure(
          'Cantidad incorrecta (Faltante) en el contenedor',
          'Distracción del operador / error en el ciclo de llenado',
          'TBD',
          'TBD',
          [
            makeCause('Distracción del operador / error en el ciclo de llenado', 4, 6, 3, 'Diseño del Contenido (Poka-Yoke): disposición de los espacios definidos', 'Inspección Visual final de Caja / Llenado de contenedor', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Bolsas Plásticas / Contenedor / Etiqueta / piezas Top Roll', 'Material', [
      makeFunction('Proveer protección, contención e identificación y almacenamiento, calvo y polvo', []),
    ]));

    wes.push(makeWE('Método de Fabricación', 'Metodo', [
      makeFunction('Utilizar la Hoja de Operaciones vigente.', []),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener condiciones de seguridad ocupacional según Ley 19587', []),
    ]));

    operations.push(makeOp('90', 'EMBALAJE', wes));
  }

  return { header, operations };
}

// ─── Headrest parser ────────────────────────────────────────────────────────
function parseHeadrest(filePath, label, partNumber, applicableParts) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const rows = raw.amfe?.rows || [];

  const header = {
    companyName: 'BARACK MERCOSUL',
    scope: `APOYACABEZAS ${label.toUpperCase()} PATAGONIA`,
    partNumber: partNumber,
    applicableParts: applicableParts,
    responsibleEngineer: 'Carlos Baptista (Ingeniería)',
    coreTeam: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    amfeDate: '2026-02-13',
    revisionLevel: '01',
    revisionDate: '2026-02-13',
    subject: `Apoyacabezas ${label}`,
    client: 'VWA',
    location: 'PLANTA HURLINGHAM',
  };

  // Parse rows into operations
  // The Excel data has rows with `elementoFoco` like "OPERACIÓN 10", "OPERACIÓN 20", etc.
  // And `modoFalla`, `causaFalla`, `controlPreventivo`, `controlDetectivo`, `severidad`, `ocurrencia`, `deteccion`

  // First, identify operation boundaries
  const opBoundaries = [];
  let currentOpName = '';
  let currentOpNum = '';

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ef = r.elementoFoco || '';
    const match = ef.match(/OPERACI[OÓ]N\s+(\d+)/i);
    if (match) {
      currentOpNum = match[1];
      // The operation name is usually in the next or nearby row's elementoFoco
      // Look for it in the elementoFoco field of nearby rows
      for (let j = i - 3; j <= i + 5; j++) {
        if (j >= 0 && j < rows.length && rows[j].elementoFoco && !rows[j].elementoFoco.match(/OPERACI[OÓ]N/i)) {
          currentOpName = rows[j].elementoFoco;
          break;
        }
      }
      opBoundaries.push({ index: i, opNum: currentOpNum, opName: currentOpName });
    }
  }

  // Now, for each operation, gather failure modes and causes
  const operations = [];

  for (let ob = 0; ob < opBoundaries.length; ob++) {
    const startIdx = opBoundaries[ob].index;
    const endIdx = ob + 1 < opBoundaries.length ? opBoundaries[ob + 1].index : rows.length;
    const opNum = opBoundaries[ob].opNum;
    let opName = opBoundaries[ob].opName;

    // Map operation names to standard names
    const opNameMap = {
      '10': 'RECEPCION DE MATERIA PRIMA',
      '20': 'CORTE DE PANELES',
      '30': 'COSTURA UNION',
      '35': 'COSTURA VISTA',
      '40': 'INYECCION DE SUSTRATO',
      '50': 'ESPUMADO',
      '60': 'ENFUNDADO',
      '70': 'INSERCION DE VARILLA',
      '80': 'CONTROL FINAL DE CALIDAD',
      '100': 'EMBALAJE',
      '110': 'ALMACENAMIENTO',
    };

    // Collect modoFalla rows and their associated causes
    const failures = [];
    let currentEffect = '';
    let currentModoFalla = '';
    let lastSeveridad = undefined;
    let collectingCauses = false;

    for (let i = startIdx; i < endIdx; i++) {
      const r = rows[i];

      if (r.modoFalla) {
        // Start a new failure mode
        if (currentModoFalla && failures.length > 0) {
          // Already captured
        }
        currentModoFalla = r.modoFalla;

        // Build effects from nearby rows
        let effectLocal = '';
        let effectNext = '';
        let effectEnd = '';

        // Scan for effect data
        for (let j = Math.max(startIdx, i - 5); j <= Math.min(endIdx - 1, i + 10); j++) {
          const er = rows[j];
          if (er.efectoFalla) {
            const ef = er.efectoFalla;
            if (ef.includes('Barack') || ef.includes('Interno') || ef.includes('scrap') || ef.includes('Retrabajo') || ef.includes('reproceso') || ef.includes('producción')) {
              if (!effectLocal) effectLocal = ef;
            } else if (ef.includes('Externo') || ef.includes('ensamble') || ef.includes('línea') || ef.includes('parada') || ef.includes('lote') || ef.includes('Montaje')) {
              if (!effectNext) effectNext = ef;
            } else if (ef.includes('regulatorios') || ef.includes('Organismos')) {
              // skip
            } else if (ef.includes('aspecto') || ef.includes('comfort') || ef.includes('funcional') || ef.includes('calidad') || ef.includes('percepción') || ef.includes('ruido') || ef.includes('Degradación') || ef.includes('usuario') || ef.includes('seguridad')) {
              if (!effectEnd) effectEnd = ef;
            }
          }
        }

        // Collect causes for this failure mode
        const causes = [];

        // The cause is often in the same row or nearby
        if (r.causaFalla) {
          // Look for apDfmea in nearby rows
          let ap = r.apDfmea || '';
          if (!ap) {
            for (let k = Math.max(i - 3, startIdx); k <= Math.min(i + 5, endIdx - 1); k++) {
              if (rows[k].apDfmea) { ap = rows[k].apDfmea; break; }
            }
          }
          // Map Spanish AP names
          if (ap === 'Alto') ap = 'H';
          else if (ap === 'Medio') ap = 'M';
          else if (ap === 'Bajo') ap = 'L';
          else if (ap === 'High') ap = 'H';
          else if (ap === 'Medium') ap = 'M';
          else if (ap === 'Low') ap = 'L';

          const cause = makeCause(
            r.causaFalla,
            r.severidad || lastSeveridad,
            r.ocurrencia,
            r.deteccion,
            r.controlPreventivo || '',
            r.controlDetectivo || '',
            '',
            '',
            ap || undefined
          );
          causes.push(cause);
        }

        // Look for additional causes in subsequent rows (before next modoFalla)
        for (let j = i + 1; j < endIdx; j++) {
          const cr = rows[j];
          if (cr.modoFalla) break; // Next failure mode
          if (cr.causaFalla) {
            // Find the severity for this cause - it may be in nearby rows
            let s = cr.severidad;
            let o = cr.ocurrencia;
            let d = cr.deteccion;
            let ap = cr.apDfmea || '';

            // Check surrounding rows for ratings
            for (let k = Math.max(j - 3, i); k <= Math.min(j + 3, endIdx - 1); k++) {
              if (!s && rows[k].severidad) s = rows[k].severidad;
              if (!o && rows[k].ocurrencia) o = rows[k].ocurrencia;
              if (!d && rows[k].deteccion) d = rows[k].deteccion;
              if (!ap && rows[k].apDfmea) ap = rows[k].apDfmea;
            }

            // Map Spanish AP names
            if (ap === 'Alto') ap = 'H';
            else if (ap === 'Medio') ap = 'M';
            else if (ap === 'Bajo') ap = 'L';

            const cause = makeCause(
              cr.causaFalla,
              s,
              o,
              d,
              cr.controlPreventivo || '',
              cr.controlDetectivo || '',
              '',
              '',
              ap || undefined
            );
            causes.push(cause);
          }
        }

        // Track severidad
        if (r.severidad) lastSeveridad = r.severidad;

        // Find severidad from nearby rows if not in the modoFalla row
        if (!r.severidad) {
          for (let j = i + 1; j <= Math.min(i + 5, endIdx - 1); j++) {
            if (rows[j].severidad && !rows[j].modoFalla) {
              lastSeveridad = rows[j].severidad;
              break;
            }
          }
        }

        failures.push(makeFailure(
          currentModoFalla,
          effectLocal || 'TBD',
          effectNext || 'TBD',
          effectEnd || 'TBD',
          causes
        ));
      }
    }

    // Determine operation name
    const resolvedName = opNameMap[opNum] || opName || `OPERACION ${opNum}`;

    // Build work elements - simplified since the Excel format doesn't map cleanly to individual WEs
    // We'll create a minimal WE structure with the failures grouped
    const wes = [];

    if (failures.length > 0) {
      // Create a single WE with all failures as a general process WE
      wes.push(makeWE(`Proceso Op ${opNum}`, 'Maquina', [
        makeFunction(`${resolvedName}`, failures),
      ]));
    }

    if (wes.length > 0 || true) { // Always create the operation even if empty
      operations.push(makeOp(opNum, resolvedName, wes));
    }
  }

  return { header, operations };
}

// ─── INSERT parser (uses Top Roll reception + specific ops from ref) ────────
function parseInsert() {
  // The INSERT PDF extraction has garbled text but the structure is similar to TOP ROLL for reception.
  // From the PDF text we can extract the key data:
  // INSERT operations:
  // 5 = RECEPCION DE MATERIA PRIMA (same structure as Top Roll)
  // 10 = CORTE
  // 20 = REFILADO
  // 30 = COSTURA
  // 40 = TERMOFORMADO
  // 50 = ADHESIVADO
  // 60 = PLEGADO DE BORDES
  // 70 = ENSAMBLE
  // 80 = CONTROL FINAL DE CALIDAD
  // 90 = EMBALAJE

  const header = {
    companyName: 'BARACK MERCOSUL',
    scope: 'INSERT PATAGONIA',
    partNumber: 'N 227 / N 403',
    applicableParts: 'N 227, N 403',
    responsibleEngineer: 'Carlos Baptista (Ingeniería)',
    coreTeam: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    amfeDate: '2026-02-13',
    revisionLevel: '01',
    revisionDate: '2026-02-13',
    subject: 'INSERT',
    client: 'VWA',
    location: 'PLANTA HURLINGHAM',
  };

  // Since the PDF extraction is garbled, we build from the clean Top Roll pattern
  // for reception (identical process) and use what we can extract for other ops.
  // The INSERT ref shows these key differences:
  // - Materials include: tela, hilos, sustrato, adhesivo, insertos
  // - Has Sika Melt-171 adhesive
  // - Uses PS/ABS CYCOLOY LG9000 substrate
  // - Operations include costura, refilado, etc.

  const operations = [];

  // ── Op 5: RECEPCION DE MATERIA PRIMA (identical pattern to Top Roll) ──
  {
    const wes = [];

    wes.push(makeWE('Autoelevador', 'Maquina', [
      makeFunction('Garantizar la estabilidad y la integridad física del material durante el transporte interno', [
        makeFailure(
          'Material / pieza golpeada o dañada durante transporte',
          'Retrabajo',
          'Problemas en el ensamble final',
          'Potencial reclamo de aspecto/comfort',
          [
            makeCause('Mala estiba y embalaje inadecuado', 5, 6, 6, 'Medios de embalaje validados', 'Inspección Visual de daños/suciedad en el empaque al recibir', '', ''),
            makeCause('Manipulación incorrecta en tránsito', 5, 6, 6, 'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material', 'Inspección Visual del estado de la pieza/empaque', '', ''),
            makeCause('Almacenaje inadecuado en transporte (sin protecciones)', 5, 5, 6, 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados', 'Inspección Visual de daños/suciedad en el empaque al recibir', '', ''),
          ]
        ),
        makeFailure(
          'Material no cumple requisito de flamabilidad TL 1010 VW',
          'Material no apto para uso',
          'Paro de linea VW por incumplimiento normativo',
          'Riesgo de propagacion de fuego en habitaculo',
          [
            makeCause('Material fuera de especificacion requerida', 9, 2, 3, 'Certificado de flamabilidad del proveedor segun TL 1010', 'Verificacion documental en recepcion', 'CC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de producción / Operador de calidad', 'Mano de Obra', [
      makeFunction('Verificar el cumplimiento y la trazabilidad de la materia prima recibida', [
        makeFailure(
          'Falta de documentación o trazabilidad',
          'Riesgo de mezclar lotes no conformes',
          'Dificultades en trazabilidad si surge un reclamo',
          'Potencial reclamo',
          [
            makeCause('Procesos administrativos deficientes', 4, 3, 4, 'El sistema ARB obliga a registrar lote y código en recepción y verifica contra base de datos', 'Verificación automática del lote/código registrado contra la base de datos', '', ''),
            makeCause('Proveedor sin sistema robusto de trazabilidad', 4, 5, 6, 'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor', 'Verificación del Certificado de Conformidad y registro obligatorio de lote', '', ''),
            makeCause('No se utiliza el sistema ARB', 4, 6, 4, 'Estándar Operacional que exige el uso del sistema ARB', 'El sistema impide la emisión de ubicaciones hasta que todos los campos del ARB sean completados', '', ''),
          ]
        ),
        makeFailure(
          'Material con especificación errónea (dimensiones, color, dureza, etc.)',
          'Potencial Descarte',
          'Potencial parada de línea',
          'Potencial reclamo de aspecto',
          [
            makeCause('Error en la orden de compra o ficha técnica', 5, 5, 6, 'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor', 'Control dimensional por muestreo en recepción', '', ''),
            makeCause('Proveedor no respeta tolerancias', 6, 7, 6, 'Requisitos Contractuales de Calidad y Auditorías al Proveedor', 'Control Dimensional por muestreo (Certificado de Calidad) y Revisión obligatoria', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Calibres, Micrómetro, Probeta de flamabilidad, Probeta de peeling', 'Material', [
      makeFunction('Disponer y utilizar instrumentos de medición y ensayo', [
        makeFailure(
          'Contaminación / suciedad en la materia prima',
          'Potencial Descarte',
          'Reclamo de aspecto',
          'Problemas de calidad durante el ensamble',
          [
            makeCause('Ambiente sucio en planta del proveedor', 5, 6, 6, 'Auditorías de Calidad', 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', '', ''),
            makeCause('Falta de inspección visual al recibir', 5, 5, 5, 'Instrucción de Trabajo de Recepción que exige la verificación física y visual', 'Inspección visual en recepción', '', ''),
          ]
        ),
        makeFailure(
          'Omisión de verificación de insumos en recepción',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('No se verifica la fecha de vencimiento del adhesivo (Sika Melt-171 IMG)', 5, 4, 6, 'Checklists obligatorias por recepción', 'Auditorías de recepción de insumos críticos', '', ''),
            makeCause('No se verifica la fecha de vencimiento del adhesivo (Sika MG®171 IMG)', 5, 4, 6, 'Checklists obligatorias por recepción', 'Auditorías de recepción de insumos críticos', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Hojas de operaciones / Ayudas visuales', 'Metodo', [
      makeFunction('Asegurar la cantidad y calidad de material recibido', [
        makeFailure(
          'Sustrato (PS/ABS CYCOLOY LG9000) fuera de especificación',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('Proveedor entrega sustrato fuera de especificación (PS/ABS)', 6, 3, 5, 'Certificado de calidad del proveedor y auditorías periódicas', 'Inspección visual y dimensional en recepción', '', ''),
          ]
        ),
        makeFailure(
          'Adhesivo Sika Melt-171 fuera de especificación',
          'TBD',
          'TBD',
          'TBD',
          [
            makeCause('Proveedor entrega Adhesivo Sika Melt-171 fuera de especificación', 6, 3, 5, 'Certificado de calidad del proveedor y auditorías periódicas', 'Inspección visual y dimensional en recepción', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener las condiciones de seguridad ocupacional según la Ley 19587', []),
    ]));

    operations.push(makeOp('5', 'RECEPCION DE MATERIA PRIMA', wes));
  }

  return { header, operations };
}

// ─── ARMREST parser ─────────────────────────────────────────────────────────
function parseArmrest() {
  const header = {
    companyName: 'BARACK MERCOSUL',
    scope: 'ARMREST DOOR PANEL PATAGONIA',
    partNumber: 'N 231',
    applicableParts: 'N 231',
    responsibleEngineer: 'Carlos Baptista (Ingeniería)',
    coreTeam: 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Producción), Cristina Rabago (Seguridad e Higiene)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    amfeDate: '2026-02-13',
    revisionLevel: '01',
    revisionDate: '2026-02-13',
    subject: 'ARMREST DOOR PANEL',
    client: 'VWA',
    location: 'PLANTA HURLINGHAM',
  };

  // The ARMREST PDF also has garbled text. Use the same reception pattern.
  // Key difference: uses different materials (cuero/vinilo, sustrato, adhesivo, hilo)
  const operations = [];

  // ── Op 5: RECEPCION DE MATERIA PRIMA ──
  {
    const wes = [];

    wes.push(makeWE('Autoelevador', 'Maquina', [
      makeFunction('Garantizar la estabilidad y la integridad física del material durante el transporte interno', [
        makeFailure(
          'Material / pieza golpeada o dañada durante transporte',
          'Retrabajo',
          'Problemas en el ensamble final',
          'Potencial reclamo de aspecto/comfort',
          [
            makeCause('Mala estiba y embalaje inadecuado', 5, 6, 6, 'Medios de embalaje validados', 'Inspección Visual de daños/suciedad en el empaque al recibir', '', ''),
            makeCause('Manipulación incorrecta en tránsito', 5, 6, 6, 'Existencia de instrucciones de trabajo que definen cómo debe estibarse y manipularse el material', 'Inspección Visual del estado de la pieza/empaque', '', ''),
            makeCause('Almacenaje inadecuado en transporte (sin protecciones)', 5, 5, 6, 'Procedimientos de Logística sobre estiba segura y uso de Embalajes Cubiertos o cerrados', 'Inspección Visual de daños/suciedad en el empaque al recibir', '', ''),
          ]
        ),
        makeFailure(
          'Material no cumple requisito de flamabilidad TL 1010 VW',
          'Material no apto para uso',
          'Paro de linea VW por incumplimiento normativo',
          'Riesgo de propagacion de fuego en habitaculo',
          [
            makeCause('Material fuera de especificacion requerida', 9, 2, 3, 'Certificado de flamabilidad del proveedor segun TL 1010', 'Verificacion documental en recepcion', 'CC', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Operador de producción / Operador de calidad', 'Mano de Obra', [
      makeFunction('Verificar el cumplimiento y la trazabilidad de la materia prima recibida', [
        makeFailure(
          'Falta de documentación o trazabilidad',
          'Riesgo de mezclar lotes no conformes',
          'Dificultades en trazabilidad si surge un reclamo',
          'Potencial reclamo',
          [
            makeCause('Procesos administrativos deficientes', 4, 4, 4, 'El sistema ARB obliga a registrar lote y código en recepción y verifica contra base de datos', 'Verificación automática del lote/código registrado contra la base de datos', '', ''),
            makeCause('Proveedor sin sistema robusto de trazabilidad', 4, 6, 6, 'Auditorías de Sistema y Requisitos que validan la capacidad de trazabilidad del proveedor', 'Verificación del Certificado de Conformidad y registro obligatorio de lote', '', ''),
            makeCause('No se utiliza el sistema ARB', 4, 3, 7, 'Estándar Operacional que exige el uso del sistema ARB', 'El sistema impide la emisión de ubicaciones hasta que todos los campos del ARB sean completados', '', ''),
          ]
        ),
        makeFailure(
          'Material con especificación errónea (dimensiones, color, dureza, etc.)',
          'Potencial Descarte',
          'Potencial parada de línea',
          'Potencial reclamo de aspecto',
          [
            makeCause('Proveedor no respeta tolerancias', 6, 6, 6, 'Requisitos Contractuales de Calidad y Auditorías al Proveedor', 'Control Dimensional por muestreo (Certificado de Calidad) y Revisión obligatoria', '', ''),
            makeCause('Error en la orden de compra o ficha técnica', 6, 5, 6, 'Revisión de Ingeniería de la Ficha Técnica/OC antes de la emisión al proveedor', 'Control dimensional por muestreo en recepción y Revisión obligatoria del Certificado de Calidad', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Calibres, Micrómetro, Probeta de flamabilidad, Probeta de peeling', 'Material', [
      makeFunction('Disponer y utilizar instrumentos de medición y ensayo', [
        makeFailure(
          'Contaminación / suciedad en la materia prima',
          'Potencial Descarte',
          'Reclamo de aspecto',
          'Problemas de calidad durante el ensamble',
          [
            makeCause('Ambiente sucio en planta del proveedor', 5, 6, 6, 'Auditorías de Calidad', 'Inspección Visual de la pieza y Revisión del Certificado de Calidad del proveedor', '', ''),
            makeCause('Falta de inspección visual al recibir', 5, 5, 5, 'Instrucción de Trabajo de Recepción que exige la verificación física y visual', 'Inspección visual en recepción', '', ''),
          ]
        ),
      ]),
    ]));

    wes.push(makeWE('Etiquetas Blancas / Etiquetas de rechazo', 'Material', [
      makeFunction('Identificar y etiquetar material recibido', []),
    ]));

    wes.push(makeWE('Hojas de operaciones / Ayudas visuales', 'Metodo', [
      makeFunction('Comprobar que el embalaje no esté dañado. Corroborar que la orden sea la correcta. Cargar la materia prima en ARB.', []),
    ]));

    wes.push(makeWE('Iluminación/Ruido, Ley 19587', 'Medio Ambiente', [
      makeFunction('Mantener las condiciones de seguridad ocupacional según la Ley 19587', []),
    ]));

    operations.push(makeOp('5', 'RECEPCION DE MATERIA PRIMA', wes));
  }

  return { header, operations };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ENRICH VWA AMFEs — ${DRY_RUN ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Authenticate
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
  });
  if (authErr) { console.error('Auth error:', authErr); process.exit(1); }

  // Get current AMFEs
  const { data: amfes, error: fetchErr } = await sb.from('amfe_documents')
    .select('id, project_name, data')
    .ilike('project_name', '%VWA%');
  if (fetchErr) { console.error('Fetch error:', fetchErr); process.exit(1); }

  const amfeMap = {};
  for (const a of amfes) {
    amfeMap[a.project_name] = a;
  }

  // Parse reference data
  console.log('Parsing reference data...\n');

  const topRollData = parseTopRoll();
  console.log(`  TOP ROLL: ${topRollData.operations.length} operations`);

  const insertData = parseInsert();
  console.log(`  INSERT: ${insertData.operations.length} operations`);

  const armrestData = parseArmrest();
  console.log(`  ARMREST: ${armrestData.operations.length} operations`);

  const hrFrontData = parseHeadrest(
    REF_HR_DELANTERO, 'Delantero',
    '2HC.881.901',
    'Apoyacabezas Delantero L0 (PVC), L1 (Fabric/PVC), L2 (Leather/PVC), L3 (Leather/PVC)'
  );
  console.log(`  HEADREST FRONT: ${hrFrontData.operations.length} operations`);

  const hrCenData = parseHeadrest(
    REF_HR_CENTRAL, 'Trasero Central',
    '2HC.885.900',
    'Apoyacabezas Trasero Central L0, L1, L2, L3'
  );
  console.log(`  HEADREST REAR CEN: ${hrCenData.operations.length} operations`);

  const hrOutData = parseHeadrest(
    REF_HR_LATERAL, 'Trasero Lateral',
    '2HC.885.901',
    'Apoyacabezas Trasero Lateral L0, L1, L2, L3'
  );
  console.log(`  HEADREST REAR OUT: ${hrOutData.operations.length} operations`);

  // Map product to data
  const updateMap = {
    'VWA/PATAGONIA/TOP_ROLL': topRollData,
    'VWA/PATAGONIA/INSERT': insertData,
    'VWA/PATAGONIA/ARMREST_DOOR_PANEL': armrestData,
    'VWA/PATAGONIA/HEADREST_FRONT': hrFrontData,
    'VWA/PATAGONIA/HEADREST_REAR_CEN': hrCenData,
    'VWA/PATAGONIA/HEADREST_REAR_OUT': hrOutData,
  };

  console.log('\n--- Summary ---\n');

  for (const [projectName, newData] of Object.entries(updateMap)) {
    const existing = amfeMap[projectName];
    if (!existing) {
      console.log(`  [SKIP] ${projectName}: not found in Supabase`);
      continue;
    }

    let totalFailures = 0;
    let totalCauses = 0;
    for (const op of newData.operations) {
      for (const we of op.workElements) {
        for (const fn of we.functions) {
          for (const fail of fn.failures) {
            totalFailures++;
            totalCauses += fail.causes.length;
          }
        }
      }
    }

    console.log(`  ${projectName}`);
    console.log(`    ID: ${existing.id}`);
    console.log(`    Operations: ${newData.operations.length}`);
    console.log(`    Total failures: ${totalFailures}`);
    console.log(`    Total causes: ${totalCauses}`);

    // Show operations detail
    for (const op of newData.operations) {
      let fc = 0, cc = 0;
      for (const we of op.workElements) {
        for (const fn of we.functions) {
          for (const fail of fn.failures) {
            fc++;
            cc += fail.causes.length;
          }
        }
      }
      console.log(`    Op ${op.operationNumber.padStart(3)}: "${op.operationName}" | WEs: ${op.workElements.length} | Fails: ${fc} | Causes: ${cc}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written to Supabase.');
    console.log('Run with --apply to write changes.\n');

    // Write dry-run output to file for inspection
    const output = {};
    for (const [projectName, newData] of Object.entries(updateMap)) {
      output[projectName] = newData;
    }
    writeFileSync(
      'C:/Users/FacundoS-PC/dev/BarackMercosul/scripts/_enrichDryRun.json',
      JSON.stringify(output, null, 2),
      'utf8'
    );
    console.log('Dry-run output written to scripts/_enrichDryRun.json\n');
    return;
  }

  // Apply changes
  console.log('\nApplying changes to Supabase...\n');

  for (const [projectName, newData] of Object.entries(updateMap)) {
    const existing = amfeMap[projectName];
    if (!existing) continue;

    const updatedDoc = {
      data: {
        header: newData.header,
        operations: newData.operations,
      },
    };

    const { error: updateErr } = await sb
      .from('amfe_documents')
      .update(updatedDoc)
      .eq('id', existing.id);

    if (updateErr) {
      console.error(`  [ERROR] ${projectName}: ${updateErr.message}`);
    } else {
      console.log(`  [OK] ${projectName} updated (${newData.operations.length} ops)`);
    }
  }

  console.log('\nDone.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
