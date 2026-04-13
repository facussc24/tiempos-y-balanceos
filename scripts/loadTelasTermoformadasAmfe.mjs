/**
 * Load Telas Termoformadas AMFE — Full replacement of all operations
 *
 * AMFE ID: c5201ba9-1225-4663-b7a1-5430f9ee8912
 * Project: PWA / HILUX 582D / Telas Termoformadas
 *
 * Strategy: REPLACE ALL existing operations (full replacement, not merge)
 *
 * Product: PWA Telas Termoformadas 582D (Toyota Hilux)
 * Part Numbers: 21-9640 LH, 21-9641 RH (Asiento), 21-9642 LH, 21-9643 RH (Respaldo)
 *
 * Operations (18 total):
 *   OP 10:  RECEPCION DE MATERIA PRIMA
 *   OP 15:  PREPARACION DE CORTE
 *   OP 20:  CORTE DE COMPONENTES
 *   OP 25:  CONTROL CON MYLAR
 *   OP 30:  PREPARACION DE KITS DE COMPONENTES
 *   OP 40:  TERMOFORMADO DE TELAS
 *   OP 50:  CORTE LASER DE TELAS TERMOFORMADAS
 *   OP 60:  TROQUELADO DE REFUERZOS
 *   OP 70:  TROQUELADO DE APLIX
 *   OP 80:  COSTURA DE REFUERZOS
 *   OP 90:  APLICACION DE APLIX
 *   OP 100: CONTROL FINAL DE CALIDAD
 *   OP 101: REPROCESO: ELIMINACION DE HILO SOBRANTE
 *   OP 102: REPROCESO: REUBICACION DE APLIX
 *   OP 103: REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA
 *   OP 105: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
 *   OP 110: EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
 *   OP 120: ALMACENAMIENTO PRODUCTO TERMINADO
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read .env.local manually ────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── AP calculation (copied from apTable.ts) ─────────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';
    if (o >= 6) return d >= 2 ? 'M' : 'L';
    if (o >= 4) return d >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (s <= 8) {
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 2 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : 'M';
    if (o >= 2) return d >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S = 9-10
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) {
    if (d >= 7) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function calculateAP(s, o, d) {
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Helper: Create a cause ──────────────────────────────────────────
function mkCause(desc, s, o, d, prevCtrl, detCtrl, specialChar = '') {
  const ap = calculateAP(s, o, d);
  return {
    id: randomUUID(),
    description: desc,
    cause: desc,
    severity: s,
    occurrence: o,
    detection: d,
    preventionControl: prevCtrl,
    detectionControl: detCtrl,
    ap: ap,
    actionPriority: ap,
    specialChar: specialChar,
    characteristicNumber: '',
    filterCode: '',
    recommendedAction: '',
  };
}

// ── Helper: Create a failure ────────────────────────────────────────
function mkFailure(desc, severity, effectLocal, effectNextLevel, effectEndUser, causes) {
  return {
    id: randomUUID(),
    description: desc,
    severity: severity,
    effectLocal: effectLocal,
    effectNextLevel: effectNextLevel,
    effectEndUser: effectEndUser,
    causes: causes,
  };
}

// ── Helper: Create a function ───────────────────────────────────────
function mkFunction(desc, requirements, failures) {
  return {
    id: randomUUID(),
    description: desc,
    functionDescription: desc,
    requirements: requirements || '',
    failures: failures,
  };
}

// ── Helper: Create a WE ────────────────────────────────────────────
function mkWE(name, type, functions) {
  return {
    id: randomUUID(),
    name: name,
    type: type,
    functions: functions,
  };
}

// ── Helper: Create an operation ─────────────────────────────────────
function mkOp(opNum, opName, focusElemFunc, opFunc, workElements) {
  return {
    id: randomUUID(),
    opNumber: String(opNum),
    operationNumber: String(opNum),
    name: opName,
    operationName: opName,
    focusElementFunction: focusElemFunc,
    operationFunction: opFunc,
    workElements: workElements,
  };
}

// ── Common focusElementFunction (same for all Telas Termoformadas ops) ──
const FOCUS_ELEM_FUNC =
  'Interno: Proveer telas termoformadas y ensambladas conformes a dimensiones, aspecto y resistencia / ' +
  'Cliente: Permitir montaje en asiento Toyota Hilux sin interferencias ni rechazos en linea / ' +
  'Usr. Final: Garantizar confort, apariencia estetica y seguridad contra flamabilidad del asiento';

// ── Header updates ──────────────────────────────────────────────────
const headerFixes = {
  companyName: 'BARACK MERCOSUL',
  scope: 'PWA',
  partNumber: '21-9640 / 21-9641 / 21-9642 / 21-9643',
  applicableParts: '21-9640 LH, 21-9641 RH (Asiento), 21-9642 LH, 21-9643 RH (Respaldo)',
  responsibleEngineer: 'Carlos Baptista',
  coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
  preparedBy: 'Facundo Santoro',
  approvedBy: 'Carlos Baptista',
  amfeDate: '2026-01-29',
  revisionLevel: 'A',
  revisionDate: '2026-04-10',
};


// ═══════════════════════════════════════════════════════════════════════
// OPERATION DEFINITIONS — 18 operations for Telas Termoformadas PWA
// ═══════════════════════════════════════════════════════════════════════

// ── OP 10: RECEPCION DE MATERIA PRIMA ───────────────────────────────
const op10 = mkOp(10, 'RECEPCION DE MATERIA PRIMA', FOCUS_ELEM_FUNC,
  'Verificar, identificar y registrar materiales entrantes segun plan de control de recepcion y fichas tecnicas',
  [
    // WE1: Material — Tela Monofelt
    mkWE('Tela Monofelt Bicomponente 3160_1700_BCM', 'Material', [
      mkFunction(
        'Recibir tela base termoformable conforme a ficha tecnica (gramaje 170+/-10 g/m2)',
        '',
        [
          mkFailure(
            'Gramaje fuera de especificacion',
            7,
            'Material no conforme ingresa al proceso',
            'Termoformado deficiente, pieza sin rigidez adecuada',
            'Funda de asiento con deformacion prematura',
            [
              mkCause(
                'Proveedor no respeta tolerancias de gramaje',
                7, 3, 5,
                'Certificado de calidad del proveedor con valores de gramaje',
                'Verificacion de gramaje por muestreo en recepcion',
              ),
              mkCause(
                'Error en orden de compra (codigo de material incorrecto)',
                7, 2, 3,
                'Sistema de compras con codigos validados',
                'Verificacion de remito contra orden de compra',
              ),
            ]
          ),
          mkFailure(
            'Flamabilidad fuera de norma BSDM0500 (max 100 mm/min)',
            10,
            'Rechazo del lote completo',
            'Detencion de produccion por falta de material aprobado',
            'Riesgo de seguridad del pasajero en caso de incendio',
            [
              mkCause(
                'Proveedor con proceso de fabricacion fuera de control',
                10, 2, 3,
                'Certificado de ensayo de flamabilidad por lote del proveedor',
                'Ensayo de flamabilidad en laboratorio segun BSDM0500',
                'CC'
              ),
            ]
          ),
          mkFailure(
            'Material con defectos visibles (manchas, arrugas, decoloracion)',
            5,
            'Material segregado, potencial descarte',
            'Pieza terminada con defecto estetico',
            'Rechazo estetico del usuario',
            [
              mkCause(
                'Defecto de fabricacion del proveedor (proceso textil fuera de control)',
                5, 3, 5,
                'Acuerdo de calidad con proveedor (especificacion de aspecto)',
                'Inspeccion visual al 100% en recepcion',
              ),
            ]
          ),
          mkFailure(
            'Permeabilidad fuera de norma BSDL7530 (max 155 cm2/s)',
            6,
            'Material no conforme segregado',
            'Pieza terminada no cumple requisito de ventilacion',
            'Incomodidad del pasajero por exceso de calor en asiento',
            [
              mkCause(
                'Proveedor fuera de especificacion de permeabilidad',
                6, 2, 4,
                'Certificado del proveedor con valores de permeabilidad',
                'Ensayo de permeabilidad en laboratorio segun BSDL7530',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Material — Fieltro Prensado
    mkWE('Fieltro Prensado BSDL2603-3N (1500 g/m2)', 'Material', [
      mkFunction(
        'Recibir refuerzos de fieltro conforme a ficha tecnica FT154 (espesor 5mm)',
        '',
        [
          mkFailure(
            'Espesor o gramaje fuera de especificacion',
            6,
            'Material rechazado en recepcion',
            'Refuerzo no provee rigidez requerida al conjunto',
            'Deformacion prematura del asiento',
            [
              mkCause(
                'Proveedor no cumple tolerancias dimensionales',
                6, 3, 5,
                'Certificado de calidad del proveedor con valores dimensionales',
                'Control dimensional por muestreo en recepcion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Material — Refuerzo Tricapa
    mkWE('Refuerzo Tricapa FT153 (600+/-60 kg/m3, 2.5mm)', 'Material', [
      mkFunction(
        'Recibir refuerzo multicapa conforme a ficha tecnica FT153',
        '',
        [
          mkFailure(
            'Densidad o espesor fuera de especificacion',
            6,
            'Material rechazado',
            'Refuerzo lateral no cumple funcion estructural',
            'Soporte lateral del asiento insuficiente',
            [
              mkCause(
                'Variacion en proceso de fabricacion del proveedor',
                6, 3, 5,
                'Certificado de calidad del proveedor',
                'Control dimensional y de densidad en recepcion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Material — APLIX
    mkWE('APLIX (cinta de fijacion hook and loop)', 'Material', [
      mkFunction(
        'Recibir cintas de fijacion conformes a especificacion de agarre y dimensiones',
        '',
        [
          mkFailure(
            'Capacidad de agarre insuficiente',
            7,
            'Material rechazado en recepcion',
            'APLIX se despega de la funda durante montaje en linea cliente',
            'Funda de asiento se desplaza durante uso del vehiculo',
            [
              mkCause(
                'Proveedor con proceso fuera de control (densidad de ganchos insuficiente)',
                7, 2, 5,
                'Especificacion de agarre pactada con proveedor',
                'Ensayo de fuerza de agarre por muestreo',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE5: Measurement — Instrumentos de control
    mkWE('Instrumentos de control de recepcion', 'Measurement', [
      mkFunction(
        'Verificar conformidad de materiales entrantes con instrumentos calibrados',
        '',
        [
          mkFailure(
            'Medicion incorrecta libera material no conforme',
            6,
            'Material defectuoso ingresa a produccion',
            'Piezas terminadas fuera de especificacion',
            'Producto final con defecto no detectado',
            [
              mkCause(
                'Instrumento de medicion descalibrado',
                6, 2, 3,
                'Plan de calibracion vigente',
                'Certificado de calibracion verificado antes de uso',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE6: Method — Procedimiento de recepcion
    mkWE('Procedimiento de recepcion P-14', 'Method', [
      mkFunction(
        'Ejecutar procedimiento de inspeccion de recepcion documentado',
        '',
        [
          mkFailure(
            'Omision de controles de recepcion establecidos',
            7,
            'Material no verificado ingresa al proceso',
            'Deteccion tardia de material no conforme en proceso',
            'Producto final con material fuera de especificacion',
            [
              mkCause(
                'Procedimiento incompleto o desactualizado',
                7, 3, 4,
                'Revision periodica del procedimiento P-14',
                'Auditoria interna de proceso de recepcion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE7: Man — Operador de recepcion
    mkWE('Operador de recepcion', 'Man', [
      mkFunction(
        'Identificar, registrar y almacenar materiales correctamente segun FIFO',
        '',
        [
          mkFailure(
            'Material mal identificado o almacenado fuera de zona correspondiente',
            5,
            'Perdida de trazabilidad del lote',
            'Material equivocado utilizado en produccion',
            'Producto final con material incorrecto',
            [
              mkCause(
                'Instruccion de trabajo incompleta para identificacion y almacenamiento',
                5, 3, 5,
                'Instruccion de trabajo de recepcion con fotos de referencia',
                'Verificacion de identificacion al retirar material de almacen',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 15: PREPARACION DE CORTE ─────────────────────────────────────
const op15 = mkOp(15, 'PREPARACION DE CORTE', FOCUS_ELEM_FUNC,
  'Tender material y plotear patron correctamente para optimizar aprovechamiento y garantizar trazabilidad',
  [
    // WE1: Machine — Mesa de tendido
    mkWE('Mesa de tendido', 'Machine', [
      mkFunction(
        'Tender material sin arrugas ni tension desigual',
        '',
        [
          mkFailure(
            'Material con arrugas o tension desigual al tender',
            5,
            'Corte deformado, piezas fuera de medida',
            'Piezas no conforman al termoformar',
            'Arrugas visibles en funda de asiento',
            [
              mkCause(
                'Mesa de tendido con superficie danada o sucia',
                5, 4, 5,
                'Limpieza e inspeccion de mesa al inicio de turno',
                'Inspeccion visual del tendido antes de corte',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Programa de corte / ploteo
    mkWE('Programa de corte / ploteo', 'Method', [
      mkFunction(
        'Definir patron de corte optimizado segun modelo y part number',
        '',
        [
          mkFailure(
            'Patron de corte incorrecto o desactualizado',
            7,
            'Desperdicio de material, piezas incorrectas',
            'Piezas no encajan en proceso de termoformado',
            'No aplica (pieza no llega al vehiculo)',
            [
              mkCause(
                'Programa no actualizado con ultima revision de ingenieria',
                7, 2, 3,
                'Control de versiones de programas de corte',
                'Verificacion de part number en programa vs orden de produccion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de corte
    mkWE('Operador de corte', 'Man', [
      mkFunction(
        'Ejecutar tendido conforme a instruccion de trabajo',
        '',
        [
          mkFailure(
            'Capas de material mal alineadas durante tendido',
            5,
            'Piezas cortadas con desviacion dimensional',
            'Rechazo en control con Mylar',
            'No aplica (pieza rechazada antes de montaje)',
            [
              mkCause(
                'Instruccion de trabajo incompleta para alineacion de capas',
                5, 3, 5,
                'Instruccion de trabajo con fotos de referencia de alineacion',
                'Autocontrol visual de alineacion por operador',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 20: CORTE DE COMPONENTES ─────────────────────────────────────
const op20 = mkOp(20, 'CORTE DE COMPONENTES', FOCUS_ELEM_FUNC,
  'Cortar componentes de tela segun programa, obteniendo piezas con forma y dimensiones conformes al plano',
  [
    // WE1: Machine — Cortadora automatica
    mkWE('Cortadora automatica', 'Machine', [
      mkFunction(
        'Ejecutar corte de material con precision dimensional conforme al programa',
        '',
        [
          mkFailure(
            'Corte fuera de medida (piezas mas grandes o mas chicas que especificacion)',
            7,
            'Pieza rechazada, retrabajo o descarte',
            'Pieza no encaja en molde de termoformado',
            'No aplica (pieza rechazada antes de llegar al vehiculo)',
            [
              mkCause(
                'Parametros de corte mal configurados en maquina',
                7, 3, 5,
                'Set-up documentado con parametros validados',
                'Control dimensional de primera pieza con Mylar',
              ),
            ]
          ),
          mkFailure(
            'Corte con bordes deshilachados',
            5,
            'Pieza con defecto estetico',
            'Hilos sueltos visibles despues de termoformado',
            'Defecto estetico visible en funda de asiento',
            [
              mkCause(
                'Cuchilla de corte desgastada',
                5, 4, 5,
                'Plan de cambio preventivo de cuchilla',
                'Inspeccion visual de bordes en primera pieza',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Programa de corte
    mkWE('Programa de corte', 'Method', [
      mkFunction(
        'Definir trayectoria de corte conforme al plano de cada variante',
        '',
        [
          mkFailure(
            'Programa de corte erroneo seleccionado (otro part number)',
            7,
            'Lote completo de piezas incorrectas',
            'Detencion de produccion por falta de piezas correctas',
            'No aplica (pieza no llega al vehiculo)',
            [
              mkCause(
                'Error de seleccion de programa por operador',
                7, 2, 3,
                'Verificacion de part number contra orden de produccion',
                'Control dimensional de primera pieza vs Mylar',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de corte
    mkWE('Operador de corte', 'Man', [
      mkFunction(
        'Operar cortadora, verificar primera pieza y mantener condiciones de corte',
        '',
        [
          mkFailure(
            'Contaminacion del material durante manipuleo',
            4,
            'Manchas o marcas en pieza cortada',
            'Defecto estetico visible post-termoformado',
            'Rechazo estetico del usuario',
            [
              mkCause(
                'Manos sucias o superficie de trabajo contaminada',
                4, 3, 5,
                'Instruccion de limpieza de manos y superficie',
                'Inspeccion visual de pieza cortada',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Material — Cuchilla de corte
    mkWE('Cuchilla de corte', 'Material', [
      mkFunction(
        'Proveer filo adecuado para corte limpio del material',
        '',
        [
          mkFailure(
            'Cuchilla desgastada produce corte irregular',
            5,
            'Bordes deshilachados en piezas',
            'Hilos sueltos visibles post-termoformado',
            'Defecto estetico en funda',
            [
              mkCause(
                'Falta de cumplimiento del plan de cambio preventivo de cuchilla',
                5, 3, 5,
                'Registro de horas de uso de cuchilla',
                'Inspeccion visual de calidad de corte cada 50 piezas',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 25: CONTROL CON MYLAR ────────────────────────────────────────
const op25 = mkOp(25, 'CONTROL CON MYLAR', FOCUS_ELEM_FUNC,
  'Verificar conformidad dimensional de componentes cortados contra patron Mylar de referencia',
  [
    // WE1: Measurement — Mylar de control
    mkWE('Mylar de control', 'Measurement', [
      mkFunction(
        'Verificar conformidad dimensional de piezas cortadas contra patron de referencia',
        '',
        [
          mkFailure(
            'Mylar danado o desactualizado (no corresponde a revision vigente)',
            7,
            'Control dimensional contra referencia incorrecta',
            'Piezas fuera de tolerancia pasan a termoformado',
            'Funda con dimensiones incorrectas en vehiculo',
            [
              mkCause(
                'Falta de control de revision del Mylar',
                7, 2, 3,
                'Registro de revision vigente del Mylar en puesto de trabajo',
                'Verificacion de marca de revision en Mylar antes de uso',
              ),
            ]
          ),
          mkFailure(
            'Medicion fuera de tolerancia no detectada',
            6,
            'Pieza no conforme liberada a proceso',
            'Pieza no encaja en molde de termoformado',
            'Funda fuera de dimension en asiento',
            [
              mkCause(
                'Error de interpretacion de tolerancias por operador',
                6, 3, 5,
                'Instruccion de control con limites go/no-go claramente marcados',
                'Supervision periodica de controles por lider de equipo',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Procedimiento de control dimensional
    mkWE('Procedimiento de control dimensional', 'Method', [
      mkFunction(
        'Definir frecuencia, metodo y criterios de aceptacion del control con Mylar',
        '',
        [
          mkFailure(
            'Frecuencia de control insuficiente',
            6,
            'Piezas fuera de tolerancia no detectadas a tiempo',
            'Lote completo fuera de especificacion',
            'No aplica (lote rechazado internamente)',
            [
              mkCause(
                'Procedimiento no define frecuencia minima de control',
                6, 3, 4,
                'Procedimiento documentado con frecuencia definida',
                'Auditoria de cumplimiento de frecuencia de control',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de control
    mkWE('Operador de control', 'Man', [
      mkFunction(
        'Ejecutar control dimensional correctamente segun procedimiento',
        '',
        [
          mkFailure(
            'Control mal ejecutado (Mylar mal posicionado sobre pieza)',
            5,
            'Resultado de control no confiable',
            'Pieza fuera de tolerancia pasa a siguiente proceso',
            'Funda con desviacion dimensional',
            [
              mkCause(
                'Instruccion de posicionamiento del Mylar incompleta',
                5, 3, 5,
                'Instruccion de trabajo con fotos de posicionamiento correcto',
                'Verificacion cruzada por segundo operador cada inicio de turno',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 30: PREPARACION DE KITS DE COMPONENTES ───────────────────────
const op30 = mkOp(30, 'PREPARACION DE KITS DE COMPONENTES', FOCUS_ELEM_FUNC,
  'Armar, verificar y registrar kits de componentes cortados y refuerzos para produccion',
  [
    // WE1: Method — Listado de componentes por kit
    mkWE('Listado de componentes por kit', 'Method', [
      mkFunction(
        'Definir composicion correcta del kit segun part number y modelo',
        '',
        [
          mkFailure(
            'Kit incompleto (falta componente)',
            5,
            'Proceso detenido por falta de pieza',
            'Retraso en produccion',
            'No aplica (detectado antes de montaje)',
            [
              mkCause(
                'Listado de componentes desactualizado',
                5, 3, 4,
                'Listado actualizado con ultima revision de ingenieria',
                'Verificacion de cantidad de componentes contra listado',
              ),
            ]
          ),
          mkFailure(
            'Componente equivocado en kit (pieza de otro part number)',
            7,
            'Pieza incorrecta procesada',
            'Producto terminado con componente erroneo',
            'Funda con pieza incorrecta en vehiculo',
            [
              mkCause(
                'Identificacion de componentes insuficiente',
                7, 2, 4,
                'Identificacion por color y codigo de cada componente',
                'Verificacion visual de componentes al armar kit',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Man — Operador de preparacion
    mkWE('Operador de preparacion', 'Man', [
      mkFunction(
        'Armar kits correctamente segun listado y orden de produccion',
        '',
        [
          mkFailure(
            'Error de identificacion del part number al armar kit',
            7,
            'Kit armado con piezas de otro modelo',
            'Producto terminado no corresponde al pedido',
            'Funda incorrecta montada en vehiculo',
            [
              mkCause(
                'Similitud visual entre piezas de distintos part numbers',
                7, 2, 4,
                'Separacion fisica de componentes por part number en estanteria',
                'Verificacion de etiqueta de part number contra orden de produccion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Measurement — Verificacion de composicion del kit
    mkWE('Verificacion de composicion del kit', 'Measurement', [
      mkFunction(
        'Confirmar que cada kit tiene todos los componentes requeridos antes de liberar a produccion',
        '',
        [
          mkFailure(
            'Kit liberado sin verificacion completa',
            4,
            'Kit incompleto ingresa al proceso',
            'Proceso detenido por faltante de pieza en estacion',
            'No aplica (detectado en proceso)',
            [
              mkCause(
                'Falta de registro de verificacion de kit',
                4, 3, 5,
                'Registro obligatorio de checkeo de kit',
                'Auditoria de registros por lider de equipo',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 40: TERMOFORMADO DE TELAS ────────────────────────────────────
const op40 = mkOp(40, 'TERMOFORMADO DE TELAS', FOCUS_ELEM_FUNC,
  'Conformar tela Monofelt mediante calor y presion en molde, obteniendo geometria tridimensional conforme al plano',
  [
    // WE1: Machine — Termoformadora
    mkWE('Termoformadora', 'Machine', [
      mkFunction(
        'Calentar y conformar tela en molde obteniendo forma tridimensional requerida',
        '',
        [
          mkFailure(
            'Termoformado incompleto (tela no adopta forma del molde)',
            6,
            'Pieza rechazada, retrabajo o descarte',
            'Pieza no encaja en asiento durante montaje en linea cliente',
            'Funda con arrugas o deformacion visible en asiento',
            [
              mkCause(
                'Temperatura de horno fuera de rango especificado',
                6, 4, 5,
                'Set-up documentado con parametros de temperatura y tiempo',
                'Inspeccion visual de primera pieza despues de conformado',
              ),
              mkCause(
                'Tiempo de ciclo insuficiente para conformado completo',
                6, 3, 5,
                'Temporizador de ciclo con alarma',
                'Inspeccion visual de conformado completo',
              ),
            ]
          ),
          mkFailure(
            'Rotura de material durante termoformado',
            5,
            'Descarte de pieza, perdida de material',
            'Faltante de piezas para produccion',
            'No aplica (pieza descartada, no llega al vehiculo)',
            [
              mkCause(
                'Temperatura excesiva (material sobrecalentado)',
                5, 3, 4,
                'Control de temperatura con termocupla y alarma de rango',
                'Inspeccion visual de integridad de pieza post-conformado',
              ),
              mkCause(
                'Material con gramaje fuera de tolerancia (mas delgado)',
                5, 2, 4,
                'Control de gramaje en recepcion (OP 10)',
                'Inspeccion visual de integridad de pieza',
              ),
            ]
          ),
          mkFailure(
            'Calentamiento no uniforme de la tela',
            5,
            'Zonas sin conformar correctamente',
            'Pieza con variacion dimensional en zonas no conformadas',
            'Arrugas localizadas visibles en funda de asiento',
            [
              mkCause(
                'Resistencias de horno danadas o descalibradas',
                5, 3, 5,
                'Plan de mantenimiento preventivo de resistencias',
                'Control de uniformidad termica con termografia o inspeccion visual de primera pieza',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Parametros de termoformado
    mkWE('Parametros de termoformado', 'Method', [
      mkFunction(
        'Definir parametros de temperatura, tiempo y presion para conformado correcto',
        '',
        [
          mkFailure(
            'Parametros incorrectos en set-up de maquina',
            6,
            'Piezas fuera de especificacion dimensional o con defectos',
            'Lote completo no conforme',
            'No aplica (lote rechazado internamente)',
            [
              mkCause(
                'Set-up no actualizado con ultima validacion de proceso',
                6, 3, 4,
                'Hoja de set-up controlada con fecha de ultima validacion',
                'Verificacion de parametros vs hoja de set-up al inicio de turno',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de termoformado
    mkWE('Operador de termoformado', 'Man', [
      mkFunction(
        'Posicionar tela en molde correctamente y operar termoformadora segun instruccion',
        '',
        [
          mkFailure(
            'Posicionamiento incorrecto de tela en molde',
            5,
            'Pieza conformada descentrada o con forma incorrecta',
            'Pieza no encaja correctamente en asiento',
            'Funda desalineada visible en asiento',
            [
              mkCause(
                'Instruccion de trabajo incompleta para posicionamiento en molde',
                5, 4, 5,
                'Instruccion de trabajo con fotos de posicionamiento correcto en molde',
                'Autocontrol visual por operador de centrado de pieza',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Environment — Condiciones ambientales
    mkWE('Condiciones ambientales del sector de termoformado', 'Environment', [
      mkFunction(
        'Mantener condiciones ambientales estables para proceso termico',
        '',
        [
          mkFailure(
            'Variacion de temperatura ambiente afecta parametros de proceso',
            3,
            'Variacion en calidad de conformado entre piezas',
            'Incremento de tasa de rechazo',
            'No aplica (variacion detectada en control interno)',
            [
              mkCause(
                'Falta de control climatico en sector de termoformado',
                3, 3, 6,
                'Monitoreo de temperatura ambiente en sector',
                'Registro de temperatura ambiente al inicio de turno',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 50: CORTE LASER DE TELAS TERMOFORMADAS ───────────────────────
const op50 = mkOp(50, 'CORTE LASER DE TELAS TERMOFORMADAS', FOCUS_ELEM_FUNC,
  'Cortar contorno perimetral de pieza termoformada mediante laser, obteniendo bordes conformes al plano',
  [
    // WE1: Machine — Cortadora laser
    mkWE('Cortadora laser', 'Machine', [
      mkFunction(
        'Cortar contorno perimetral de pieza con precision dimensional',
        '',
        [
          mkFailure(
            'Corte perimetral incompleto o desviado',
            6,
            'Pieza fuera de dimension, retrabajo manual necesario',
            'Pieza no encaja en asiento durante montaje',
            'Bordes visibles o desalineados en funda de asiento',
            [
              mkCause(
                'Programa de corte laser desalineado respecto a pieza',
                6, 3, 5,
                'Calibracion de alineacion laser periodica',
                'Control dimensional de primera pieza post-corte',
              ),
              mkCause(
                'Pieza termoformada mal posicionada en dispositivo de corte',
                5, 4, 5,
                'Dispositivo de posicionamiento con topes de referencia',
                'Verificacion visual de posicionamiento antes de corte',
              ),
            ]
          ),
          mkFailure(
            'Quemadura excesiva en bordes de corte',
            5,
            'Borde danado esteticamente con marca de quemadura',
            'Olor desagradable durante montaje en linea cliente',
            'Defecto estetico visible en borde de funda, olor residual',
            [
              mkCause(
                'Potencia de laser excesiva para el material',
                5, 3, 5,
                'Set-up documentado con potencia validada por material',
                'Inspeccion visual y olfativa de bordes en primera pieza',
              ),
              mkCause(
                'Velocidad de corte insuficiente (laser permanece demasiado tiempo)',
                5, 3, 5,
                'Parametro de velocidad controlado por programa',
                'Inspeccion visual de bordes de corte',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Programa de corte laser
    mkWE('Programa de corte laser', 'Method', [
      mkFunction(
        'Definir trayectoria y parametros de corte laser conforme al plano',
        '',
        [
          mkFailure(
            'Programa incorrecto seleccionado (otro part number)',
            7,
            'Lote completo de piezas con contorno incorrecto',
            'Piezas no encajan en asiento',
            'No aplica (lote rechazado)',
            [
              mkCause(
                'Error de seleccion de programa por operador',
                7, 2, 3,
                'Verificacion de part number contra orden de produccion',
                'Control dimensional de primera pieza vs plano',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de corte laser
    mkWE('Operador de corte laser', 'Man', [
      mkFunction(
        'Posicionar pieza termoformada en dispositivo y operar cortadora laser segun instruccion',
        '',
        [
          mkFailure(
            'Posicionamiento incorrecto de pieza termoformada en dispositivo',
            5,
            'Corte descentrado, pieza fuera de medida',
            'Pieza no conforme en control final',
            'No aplica (pieza rechazada internamente)',
            [
              mkCause(
                'Dispositivo de posicionamiento sin topes claros',
                5, 3, 5,
                'Dispositivo con topes de referencia y marcas de posicionamiento',
                'Verificacion visual de posicionamiento antes de activar corte',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Measurement — Galga de control dimensional post-corte
    mkWE('Galga de control dimensional post-corte', 'Measurement', [
      mkFunction(
        'Verificar conformidad dimensional de pieza cortada con laser',
        '',
        [
          mkFailure(
            'Control post-corte no detecta desviacion dimensional',
            6,
            'Pieza fuera de tolerancia pasa a siguiente operacion',
            'Pieza no conforme detectada en control final',
            'Funda fuera de dimension en asiento',
            [
              mkCause(
                'Instrumento de control descalibrado o inadecuado',
                6, 2, 3,
                'Plan de calibracion de instrumentos de control',
                'Verificacion de calibracion antes de uso',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 60: TROQUELADO DE REFUERZOS ──────────────────────────────────
const op60 = mkOp(60, 'TROQUELADO DE REFUERZOS', FOCUS_ELEM_FUNC,
  'Troquelar refuerzos de fieltro prensado y tricapa segun dimensiones especificadas en plano',
  [
    // WE1: Machine — Troqueladora
    mkWE('Troqueladora', 'Machine', [
      mkFunction(
        'Cortar refuerzos con precision dimensional segun matriz',
        '',
        [
          mkFailure(
            'Corte desprolijo (bordes irregulares)',
            5,
            'Refuerzo con bordes no uniformes',
            'Interferencia en costura o montaje posterior',
            'Bultos o irregularidades en funda de asiento',
            [
              mkCause(
                'Matriz de troquelado desgastada',
                5, 4, 5,
                'Plan de mantenimiento preventivo de matrices',
                'Inspeccion visual de bordes de refuerzo troquelado',
              ),
            ]
          ),
          mkFailure(
            'Dimension de refuerzo fuera de tolerancia',
            5,
            'Refuerzo rechazado o retrabajado',
            'Refuerzo no encaja en posicion de costura',
            'Funda con refuerzo mal posicionado',
            [
              mkCause(
                'Presion de troquelado insuficiente',
                5, 3, 5,
                'Set-up documentado con presion validada',
                'Control dimensional de primera pieza troquelada',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Programa/set-up de troquelado
    mkWE('Programa/set-up de troquelado', 'Method', [
      mkFunction(
        'Definir parametros de troquelado y seleccion de matriz correcta',
        '',
        [
          mkFailure(
            'Matriz incorrecta seleccionada para el modelo',
            6,
            'Refuerzos con forma o dimension incorrecta',
            'Refuerzos no encajan en proceso de costura',
            'No aplica (detectado antes de montaje)',
            [
              mkCause(
                'Matrices similares entre modelos sin identificacion clara',
                6, 2, 3,
                'Identificacion de matrices con codigo de part number',
                'Verificacion de codigo de matriz contra orden de produccion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de troquelado
    mkWE('Operador de troquelado', 'Man', [
      mkFunction(
        'Posicionar material y operar troqueladora segun instruccion de trabajo',
        '',
        [
          mkFailure(
            'Material posicionado incorrectamente en matriz',
            5,
            'Refuerzo con forma desviada',
            'Refuerzo no encaja en posicion de costura',
            'No aplica (detectado en control interno)',
            [
              mkCause(
                'Instruccion de posicionamiento incompleta',
                5, 3, 5,
                'Instruccion de trabajo con fotos de posicionamiento',
                'Autocontrol visual por operador',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 70: TROQUELADO DE APLIX ──────────────────────────────────────
const op70 = mkOp(70, 'TROQUELADO DE APLIX', FOCUS_ELEM_FUNC,
  'Troquelar cintas APLIX a dimension especificada conforme al plano de cada variante',
  [
    // WE1: Machine — Troqueladora
    mkWE('Troqueladora', 'Machine', [
      mkFunction(
        'Cortar cintas APLIX a dimension especificada',
        '',
        [
          mkFailure(
            'Corte desprolijo de APLIX',
            5,
            'Cinta con bordes irregulares',
            'APLIX no adhiere correctamente a funda',
            'APLIX se despega durante uso del vehiculo',
            [
              mkCause(
                'Cuchilla de troquelado desgastada',
                5, 3, 5,
                'Plan de cambio preventivo de cuchilla',
                'Inspeccion visual de bordes de APLIX troquelado',
              ),
            ]
          ),
          mkFailure(
            'Dimension de APLIX fuera de especificacion',
            6,
            'APLIX rechazado',
            'APLIX no cubre area requerida de fijacion',
            'Funda se desplaza en asiento durante uso',
            [
              mkCause(
                'Matriz de corte desgastada o inadecuada',
                6, 3, 5,
                'Control dimensional periodico de APLIX troquelado',
                'Control dimensional cada 50 piezas',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Instruccion de troquelado de APLIX
    mkWE('Instruccion de troquelado de APLIX', 'Method', [
      mkFunction(
        'Definir parametros y dimension de corte de APLIX por variante',
        '',
        [
          mkFailure(
            'Instruccion no actualizada con ultima revision',
            5,
            'APLIX cortado a dimension incorrecta',
            'APLIX no encaja en posicion requerida',
            'No aplica (detectado en control)',
            [
              mkCause(
                'Falta de control de revision de instruccion de trabajo',
                5, 2, 4,
                'Control de versiones de instrucciones de trabajo',
                'Verificacion de revision de instruccion al inicio de turno',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de troquelado
    mkWE('Operador de troquelado', 'Man', [
      mkFunction(
        'Operar troqueladora y verificar dimension de APLIX cortado',
        '',
        [
          mkFailure(
            'APLIX posicionado al reves en troqueladora (hook vs loop)',
            4,
            'APLIX inutilizable, descarte',
            'Retrabajo de aplicacion de APLIX',
            'No aplica (detectado en proceso)',
            [
              mkCause(
                'Falta de identificacion clara de orientacion de APLIX en instruccion',
                4, 3, 5,
                'Instruccion de trabajo con marca de orientacion',
                'Autocontrol visual de orientacion por operador',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 80: COSTURA DE REFUERZOS ─────────────────────────────────────
const op80 = mkOp(80, 'COSTURA DE REFUERZOS', FOCUS_ELEM_FUNC,
  'Coser refuerzos en posicion correcta segun plano, garantizando resistencia y alineacion de costura',
  [
    // WE1: Machine — Maquina de coser industrial
    mkWE('Maquina de coser industrial', 'Machine', [
      mkFunction(
        'Ejecutar costura de union de refuerzos con resistencia y alineacion requeridas',
        '',
        [
          mkFailure(
            'Costura corrida o fuera de posicion',
            5,
            'Pieza rechazada, retrabajo necesario',
            'Refuerzo mal posicionado, funda no encaja en asiento',
            'Bulto o deformacion visible en funda de asiento',
            [
              mkCause(
                'Aguja desgastada o inadecuada para el material',
                5, 4, 5,
                'Plan de cambio preventivo de aguja',
                'Inspeccion visual de costura en primera pieza',
              ),
            ]
          ),
          mkFailure(
            'Costura floja (falta de tension de hilo)',
            6,
            'Costura no cumple resistencia requerida',
            'Refuerzo se desprende durante montaje en linea cliente',
            'Refuerzo suelto, deformacion del asiento',
            [
              mkCause(
                'Tension de hilo incorrecta en maquina',
                6, 4, 5,
                'Set-up documentado con tension de hilo validada',
                'Ensayo de resistencia de costura por muestreo',
              ),
            ]
          ),
          mkFailure(
            'Hilo roto durante costura',
            5,
            'Costura incompleta, pieza rechazada',
            'Refuerzo no fijado, retrabajo obligatorio',
            'No aplica (detectado en proceso)',
            [
              mkCause(
                'Hilo inadecuado o con defecto de fabricacion',
                5, 3, 4,
                'Especificacion de hilo por tipo de costura',
                'Deteccion automatica de rotura de hilo en maquina',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Material — Hilo de costura
    mkWE('Hilo de costura', 'Material', [
      mkFunction(
        'Proveer resistencia y acabado de costura conforme a especificacion',
        '',
        [
          mkFailure(
            'Hilo inadecuado (tipo o color incorrecto para el modelo)',
            5,
            'Costura con hilo incorrecto, pieza rechazada',
            'Defecto estetico visible o falta de resistencia',
            'Costura visible con color no conforme o resistencia insuficiente',
            [
              mkCause(
                'Error de seleccion de hilo por operador',
                5, 3, 4,
                'Identificacion de hilos por color y referencia en puesto de trabajo',
                'Verificacion visual de color de hilo antes de inicio de lote',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Man — Operador de costura
    mkWE('Operador de costura', 'Man', [
      mkFunction(
        'Posicionar refuerzos y ejecutar costura conforme a instruccion de trabajo',
        '',
        [
          mkFailure(
            'Posicionamiento incorrecto del refuerzo antes de costura',
            5,
            'Refuerzo cosido fuera de posicion',
            'Funda no encaja correctamente en asiento',
            'Bulto o deformacion visible en asiento',
            [
              mkCause(
                'Instruccion de posicionamiento de refuerzo incompleta',
                5, 3, 5,
                'Instruccion de trabajo con fotos de posicionamiento de refuerzo',
                'Autocontrol visual de posicion por operador',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Method — Instruccion de costura
    mkWE('Instruccion de costura', 'Method', [
      mkFunction(
        'Definir tipo de costura, posicion de refuerzo y parametros de maquina',
        '',
        [
          mkFailure(
            'Instruccion de costura no actualizada con ultima revision',
            5,
            'Costura ejecutada con parametros incorrectos',
            'Pieza no conforme en control final',
            'No aplica (detectado antes de montaje)',
            [
              mkCause(
                'Falta de control de revision de instruccion de trabajo',
                5, 2, 4,
                'Control de versiones de instrucciones de trabajo',
                'Verificacion de revision al inicio de turno',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 90: APLICACION DE APLIX ──────────────────────────────────────
const op90 = mkOp(90, 'APLICACION DE APLIX', FOCUS_ELEM_FUNC,
  'Posicionar y adherir APLIX en cantidad, posicion y orientacion correcta segun plano',
  [
    // WE1: Man — Operador de aplicacion
    mkWE('Operador de aplicacion', 'Man', [
      mkFunction(
        'Posicionar y adherir APLIX manualmente en posicion correcta segun plano',
        '',
        [
          mkFailure(
            'APLIX en posicion incorrecta',
            6,
            'Pieza rechazada, retrabajo de reposicionamiento',
            'Funda no se fija correctamente al asiento',
            'Funda de asiento se desplaza durante uso',
            [
              mkCause(
                'Instruccion de trabajo incompleta con posiciones de APLIX',
                6, 3, 5,
                'Instruccion de trabajo con plantilla de posiciones de APLIX',
                'Autocontrol visual de posicion contra plantilla',
              ),
            ]
          ),
          mkFailure(
            'Falta de unidades de APLIX (cantidad menor a la requerida)',
            6,
            'Pieza con fijacion insuficiente',
            'Funda no se sostiene en posicion durante montaje',
            'Funda se desplaza en asiento durante uso del vehiculo',
            [
              mkCause(
                'Error de conteo de unidades de APLIX por operador',
                6, 3, 5,
                'Kit de APLIX pre-contado por pieza',
                'Verificacion de cantidad de APLIX en control final',
              ),
            ]
          ),
          mkFailure(
            'APLIX con orientacion invertida (hook donde va loop o viceversa)',
            6,
            'APLIX no cumple funcion de fijacion',
            'Funda no se fija al asiento',
            'Funda suelta en asiento',
            [
              mkCause(
                'Falta de marca de orientacion en APLIX e instruccion',
                6, 2, 5,
                'Marcado de orientacion en instruccion de trabajo',
                'Verificacion visual de tipo de APLIX antes de adhesion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Instruccion de aplicacion de APLIX
    mkWE('Instruccion de aplicacion de APLIX', 'Method', [
      mkFunction(
        'Definir posiciones, cantidades y orientacion de APLIX por variante',
        '',
        [
          mkFailure(
            'Referencia de posicion incorrecta en instruccion',
            6,
            'APLIX posicionado en lugar equivocado',
            'Funda no se fija correctamente',
            'Funda se desplaza en asiento',
            [
              mkCause(
                'Instruccion de trabajo no actualizada con revision de plano',
                6, 2, 4,
                'Control de revisiones de instruccion vs plano vigente',
                'Verificacion de posiciones contra plano en primera pieza',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Material — Adhesivo para APLIX
    mkWE('Adhesivo para APLIX', 'Material', [
      mkFunction(
        'Proveer adhesion permanente del APLIX a la tela termoformada',
        '',
        [
          mkFailure(
            'Adhesion insuficiente (APLIX se despega despues de aplicacion)',
            6,
            'APLIX suelto, retrabajo de re-adhesion',
            'APLIX se despega durante montaje en linea cliente',
            'Funda se desplaza en asiento por falta de fijacion',
            [
              mkCause(
                'Adhesivo fuera de fecha de vencimiento o mal almacenado',
                6, 2, 5,
                'Control FIFO de adhesivos con fecha de vencimiento',
                'Ensayo de fuerza de despegue por muestreo',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 100: CONTROL FINAL DE CALIDAD ────────────────────────────────
const op100 = mkOp(100, 'CONTROL FINAL DE CALIDAD', FOCUS_ELEM_FUNC,
  'Verificar conformidad visual, dimensional y de componentes del producto terminado contra criterios de aceptacion',
  [
    // WE1: Measurement — Patron visual de referencia
    mkWE('Patron visual de referencia', 'Measurement', [
      mkFunction(
        'Proveer referencia visual para evaluacion de defectos esteticos',
        '',
        [
          mkFailure(
            'Defecto estetico no detectado en control final',
            7,
            'Pieza no conforme liberada a embalaje',
            'Rechazo en linea de montaje del cliente',
            'Defecto estetico visible en asiento del vehiculo',
            [
              mkCause(
                'Patron visual desactualizado o danado',
                7, 2, 3,
                'Revision periodica de patron visual',
                'Comparacion de pieza contra patron actualizado',
              ),
            ]
          ),
          mkFailure(
            'Pieza no conforme liberada por criterio ambiguo',
            6,
            'Producto defectuoso pasa a embalaje',
            'Reclamo del cliente por producto no conforme',
            'Defecto visible en asiento del vehiculo',
            [
              mkCause(
                'Criterio de aceptacion/rechazo no definido claramente',
                6, 3, 5,
                'Catalogo de defectos con fotos de aceptacion y rechazo',
                'Verificacion cruzada entre inspectores cada turno',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Measurement — Instrumentos de control dimensional
    mkWE('Instrumentos de control dimensional', 'Measurement', [
      mkFunction(
        'Verificar dimensiones criticas del producto terminado',
        '',
        [
          mkFailure(
            'Medicion dimensional erronea libera pieza fuera de tolerancia',
            6,
            'Pieza fuera de dimension liberada',
            'Pieza no encaja en asiento durante montaje',
            'Funda con desviacion dimensional en vehiculo',
            [
              mkCause(
                'Instrumento de control descalibrado',
                6, 2, 3,
                'Plan de calibracion de instrumentos',
                'Verificacion de certificado de calibracion antes de uso',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Method — Procedimiento de control final
    mkWE('Procedimiento de control final', 'Method', [
      mkFunction(
        'Definir secuencia, criterios y frecuencia de verificacion de producto terminado',
        '',
        [
          mkFailure(
            'Frecuencia de muestreo insuficiente para detectar defectos',
            5,
            'Defectos no detectados a tiempo',
            'Lote con alta tasa de defectos',
            'No aplica (lote rechazado internamente)',
            [
              mkCause(
                'Procedimiento no define frecuencia acorde al riesgo',
                5, 3, 4,
                'Procedimiento con frecuencia basada en historial de defectos',
                'Auditoria de cumplimiento de frecuencia',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE4: Man — Inspector de calidad
    mkWE('Inspector de calidad', 'Man', [
      mkFunction(
        'Ejecutar control final con criterio uniforme y conforme a procedimiento',
        '',
        [
          mkFailure(
            'Error humano en evaluacion visual (fatiga, distraccion)',
            5,
            'Pieza defectuosa liberada',
            'Reclamo del cliente',
            'Defecto estetico en asiento del vehiculo',
            [
              mkCause(
                'Fatiga visual por jornada prolongada sin rotacion',
                5, 3, 5,
                'Rotacion de inspectores cada 2 horas',
                'Auditoria cruzada de piezas liberadas por supervisor',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 101: REPROCESO: ELIMINACION DE HILO SOBRANTE ─────────────────
const op101 = mkOp(101, 'REPROCESO: ELIMINACION DE HILO SOBRANTE', FOCUS_ELEM_FUNC,
  'Eliminar excedente de hilo visible en pieza terminada sin danar material base',
  [
    // WE1: Man — Operador de reproceso
    mkWE('Operador de reproceso', 'Man', [
      mkFunction(
        'Cortar hilo sobrante sin danar tela ni costura',
        '',
        [
          mkFailure(
            'Dano al material base al cortar hilo',
            5,
            'Pieza danada, descarte',
            'Faltante de piezas',
            'No aplica (pieza descartada)',
            [
              mkCause(
                'Herramienta de corte inadecuada o falta de cuidado',
                5, 3, 4,
                'Instruccion de reproceso con herramienta especificada',
                'Inspeccion visual post-reproceso',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Instruccion de reproceso de hilo
    mkWE('Instruccion de reproceso de hilo', 'Method', [
      mkFunction(
        'Definir metodo de eliminacion de hilo sin comprometer integridad',
        '',
        [
          mkFailure(
            'Instruccion de reproceso incompleta',
            4,
            'Operador improvisa, riesgo de dano',
            'Pieza danada en reproceso',
            'No aplica',
            [
              mkCause(
                'Falta de instruccion documentada para reproceso',
                4, 2, 5,
                'Instruccion de reproceso documentada con fotos',
                'Verificacion visual post-reproceso',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 102: REPROCESO: REUBICACION DE APLIX ─────────────────────────
const op102 = mkOp(102, 'REPROCESO: REUBICACION DE APLIX', FOCUS_ELEM_FUNC,
  'Remover y reposicionar APLIX en ubicacion correcta segun plano',
  [
    // WE1: Man — Operador de reproceso
    mkWE('Operador de reproceso', 'Man', [
      mkFunction(
        'Remover APLIX mal posicionado y re-adherir en posicion correcta',
        '',
        [
          mkFailure(
            'APLIX reubicado queda con adhesion insuficiente',
            6,
            'APLIX no adhiere correctamente despues de reubicacion',
            'APLIX se despega en linea de montaje',
            'Funda se desplaza en asiento',
            [
              mkCause(
                'Adhesivo deteriorado por remocion/re-aplicacion',
                6, 3, 5,
                'Instruccion de uso de adhesivo nuevo en re-aplicacion',
                'Ensayo de fuerza de despegue post-reproceso',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Method — Instruccion de reubicacion de APLIX
    mkWE('Instruccion de reubicacion de APLIX', 'Method', [
      mkFunction(
        'Definir metodo de remocion y re-adhesion de APLIX',
        '',
        [
          mkFailure(
            'Instruccion incompleta para reubicacion',
            4,
            'Operador improvisa metodo',
            'Re-adhesion incorrecta',
            'No aplica',
            [
              mkCause(
                'Falta de instruccion especifica de reubicacion',
                4, 2, 5,
                'Instruccion de reproceso documentada',
                'Verificacion visual post-reproceso',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Material — Adhesivo nuevo para re-aplicacion
    mkWE('Adhesivo nuevo para re-aplicacion', 'Material', [
      mkFunction(
        'Proveer adhesion adecuada en re-aplicacion',
        '',
        [
          mkFailure(
            'Adhesivo insuficiente o inadecuado en re-aplicacion',
            5,
            'APLIX no adhiere',
            'APLIX se despega',
            'Funda se desplaza en asiento',
            [
              mkCause(
                'Uso de adhesivo original residual en vez de adhesivo nuevo',
                5, 3, 5,
                'Instruccion de uso obligatorio de adhesivo nuevo',
                'Verificacion de uso de adhesivo nuevo por supervisor',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 103: REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA ─────────
const op103 = mkOp(103, 'REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA', FOCUS_ELEM_FUNC,
  'Corregir costura defectuosa mediante retrabajo sin comprometer integridad del material',
  [
    // WE1: Machine — Maquina de coser industrial
    mkWE('Maquina de coser industrial', 'Machine', [
      mkFunction(
        'Re-ejecutar costura correctiva con parametros validados',
        '',
        [
          mkFailure(
            'Costura correctiva no resuelve defecto original',
            5,
            'Pieza sigue no conforme, potencial descarte',
            'Faltante de piezas',
            'No aplica (pieza rechazada)',
            [
              mkCause(
                'Parametros de maquina no ajustados para retrabajo',
                5, 3, 5,
                'Set-up especifico de retrabajo documentado',
                'Inspeccion de costura post-retrabajo',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Man — Operador de costura
    mkWE('Operador de costura', 'Man', [
      mkFunction(
        'Ejecutar costura correctiva conforme a instruccion de reproceso',
        '',
        [
          mkFailure(
            'Dano al material durante costura correctiva',
            5,
            'Pieza danada, descarte',
            'Faltante de piezas',
            'No aplica',
            [
              mkCause(
                'Exceso de penetraciones de aguja en zona retrabajada',
                5, 3, 4,
                'Instruccion de limite de intentos de retrabajo (max 1)',
                'Inspeccion visual de integridad post-retrabajo',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Method — Instruccion de correccion de costura
    mkWE('Instruccion de correccion de costura', 'Method', [
      mkFunction(
        'Definir metodo de correccion y criterios de aceptacion post-retrabajo',
        '',
        [
          mkFailure(
            'Instruccion no define criterio de aceptacion post-retrabajo',
            4,
            'Operador no puede determinar si retrabajo fue exitoso',
            'Pieza dudosa liberada o descartada innecesariamente',
            'No aplica',
            [
              mkCause(
                'Falta de criterio go/no-go en instruccion de retrabajo',
                4, 2, 5,
                'Criterio de aceptacion con foto de pieza OK vs NOK',
                'Verificacion post-retrabajo por inspector',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 105: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME ─────
const op105 = mkOp(105, 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', FOCUS_ELEM_FUNC,
  'Clasificar, identificar y segregar producto no conforme segun procedimiento de control de no conformidades',
  [
    // WE1: Method — Procedimiento de producto no conforme P-13
    mkWE('Procedimiento de producto no conforme P-13', 'Method', [
      mkFunction(
        'Definir criterios de clasificacion y destino del producto no conforme',
        '',
        [
          mkFailure(
            'Producto no conforme no segregado correctamente',
            7,
            'Producto defectuoso mezclado con producto conforme',
            'Envio de producto no conforme al cliente',
            'Funda defectuosa montada en vehiculo',
            [
              mkCause(
                'Procedimiento de segregacion no respetado',
                7, 2, 4,
                'Zona de segregacion identificada y delimitada',
                'Auditoria de zona de segregacion por supervisor',
              ),
            ]
          ),
          mkFailure(
            'Clasificacion incorrecta del tipo de no conformidad',
            5,
            'Producto reparable descartado o producto irrecuperable reprocesado',
            'Desperdicio de material o retrabajo innecesario',
            'No aplica (error interno de clasificacion)',
            [
              mkCause(
                'Criterios de clasificacion ambiguos en procedimiento',
                5, 3, 4,
                'Catalogo de defectos con clasificacion clara',
                'Verificacion de clasificacion por inspector de calidad',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Man — Inspector de calidad / Operador
    mkWE('Inspector de calidad / Operador', 'Man', [
      mkFunction(
        'Identificar, etiquetar y trasladar producto no conforme a zona de segregacion',
        '',
        [
          mkFailure(
            'Producto no conforme no identificado con etiqueta de rechazo',
            6,
            'Producto sin identificacion de estado',
            'Riesgo de uso involuntario de producto no conforme',
            'Funda defectuosa en vehiculo',
            [
              mkCause(
                'Falta de etiquetas de rechazo disponibles en puesto',
                6, 2, 4,
                'Stock de etiquetas de rechazo en puesto de control',
                'Verificacion de etiquetado en zona de segregacion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Measurement — Registro de no conformidades
    mkWE('Registro de no conformidades', 'Measurement', [
      mkFunction(
        'Registrar y trazar producto no conforme para analisis y mejora',
        '',
        [
          mkFailure(
            'Registro incompleto de no conformidad',
            3,
            'Perdida de trazabilidad',
            'Imposibilidad de analizar causa raiz',
            'No aplica (impacto interno en mejora continua)',
            [
              mkCause(
                'Formato de registro incompleto o dificil de usar',
                3, 3, 5,
                'Formato estandarizado de registro de NC',
                'Revision de registros por calidad semanalmente',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 110: EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO ─────────────
const op110 = mkOp(110, 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', FOCUS_ELEM_FUNC,
  'Proteger, identificar y embalar producto terminado conforme a instrucciones del cliente PWA',
  [
    // WE1: Method — Instruccion de embalaje
    mkWE('Instruccion de embalaje', 'Method', [
      mkFunction(
        'Definir cantidad por caja, disposicion de piezas y requisitos de etiquetado',
        '',
        [
          mkFailure(
            'Cantidad incorrecta por caja (mayor o menor a la especificada)',
            4,
            'Caja con conteo incorrecto',
            'Reclamo del cliente por diferencia de cantidad',
            'No aplica (error logistico)',
            [
              mkCause(
                'Instruccion de embalaje no actualizada con cantidad vigente',
                4, 3, 4,
                'Instruccion de embalaje con cantidad por caja actualizada',
                'Verificacion de cantidad antes de cerrar caja',
              ),
            ]
          ),
          mkFailure(
            'Error de etiquetado (part number incorrecto en etiqueta)',
            5,
            'Caja con identificacion erronea',
            'Rechazo en recepcion del cliente',
            'No aplica (detectado en recepcion del cliente)',
            [
              mkCause(
                'Etiqueta pre-impresa no verificada contra contenido',
                5, 2, 4,
                'Verificacion de etiqueta contra contenido antes de cerrar',
                'Lectura de codigo de barras para validacion',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Man — Operador de embalaje
    mkWE('Operador de embalaje', 'Man', [
      mkFunction(
        'Embalar piezas sin danarlas y etiquetar correctamente',
        '',
        [
          mkFailure(
            'Dano al producto durante embalaje (arrugas, manchas por manipuleo)',
            4,
            'Pieza danada requiere reproceso o descarte',
            'Pieza no conforme entregada al cliente',
            'Defecto estetico en funda de asiento',
            [
              mkCause(
                'Manipulacion incorrecta de piezas terminadas',
                4, 3, 5,
                'Instruccion de manipuleo con uso de guantes',
                'Inspeccion visual de pieza antes de colocar en caja',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Material — Material de embalaje (cajas, separadores)
    mkWE('Material de embalaje (cajas, separadores)', 'Material', [
      mkFunction(
        'Proteger producto terminado durante almacenamiento y transporte',
        '',
        [
          mkFailure(
            'Embalaje inadecuado no protege las piezas',
            4,
            'Piezas danadas en almacenamiento o transporte',
            'Rechazo del cliente por producto danado',
            'Funda con defecto estetico por dano en transporte',
            [
              mkCause(
                'Material de embalaje incorrecto o insuficiente',
                4, 2, 5,
                'Especificacion de embalaje aprobada por cliente',
                'Verificacion de tipo de embalaje contra especificacion',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);

// ── OP 120: ALMACENAMIENTO PRODUCTO TERMINADO ───────────────────────
const op120 = mkOp(120, 'ALMACENAMIENTO PRODUCTO TERMINADO', FOCUS_ELEM_FUNC,
  'Almacenar producto terminado bajo condiciones de preservacion y gestion FIFO',
  [
    // WE1: Method — Procedimiento FIFO
    mkWE('Procedimiento FIFO', 'Method', [
      mkFunction(
        'Garantizar envio de producto en orden cronologico de fabricacion',
        '',
        [
          mkFailure(
            'Producto enviado fuera de secuencia FIFO',
            4,
            'Producto antiguo queda en stock',
            'Riesgo de envio de producto deteriorado por almacenamiento prolongado',
            'No aplica (control logistico interno)',
            [
              mkCause(
                'Falta de senalizacion FIFO en almacen',
                4, 3, 5,
                'Senalizacion de pasillos FIFO con flechas y fechas',
                'Auditoria semanal de cumplimiento FIFO',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE2: Man — Operador de almacen
    mkWE('Operador de almacen', 'Man', [
      mkFunction(
        'Almacenar y despachar producto respetando FIFO y condiciones de preservacion',
        '',
        [
          mkFailure(
            'Producto almacenado en zona incorrecta',
            3,
            'Perdida de trazabilidad de ubicacion',
            'Demora en localizacion de producto para despacho',
            'No aplica (impacto logistico interno)',
            [
              mkCause(
                'Falta de ubicaciones designadas en almacen',
                3, 3, 5,
                'Mapa de ubicaciones de almacen',
                'Verificacion de ubicacion al almacenar',
              ),
            ]
          ),
        ]
      ),
    ]),

    // WE3: Environment — Condiciones de almacenamiento
    mkWE('Condiciones de almacenamiento', 'Environment', [
      mkFunction(
        'Mantener condiciones de temperatura y humedad adecuadas para preservacion',
        '',
        [
          mkFailure(
            'Producto danado por condiciones ambientales (humedad, temperatura)',
            4,
            'Piezas con manchas de humedad o deformacion',
            'Lote completo no conforme',
            'No aplica (detectado antes de despacho)',
            [
              mkCause(
                'Humedad excesiva o temperatura inadecuada en almacen',
                4, 2, 5,
                'Monitoreo de temperatura y humedad en almacen',
                'Inspeccion visual de producto almacenado periodicamente',
              ),
            ]
          ),
        ]
      ),
    ]),
  ]
);


// ═══════════════════════════════════════════════════════════════════════
// MAIN — Fetch, backup, REPLACE ALL operations, save, verify
// ═══════════════════════════════════════════════════════════════════════

const AMFE_ID = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';

console.log('=== Loading Telas Termoformadas AMFE operations (FULL REPLACEMENT) ===');

// ── Fetch current AMFE ──────────────────────────────────────────────
const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('*')
  .eq('id', AMFE_ID)
  .single();

if (fetchErr) {
  console.error('ERROR fetching AMFE:', fetchErr.message);
  process.exit(1);
}

// Parse if double-serialized
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  amfeData = JSON.parse(amfeData);
  console.log('WARNING: data was double-serialized string, parsed it.');
}

console.log(`Current state: ${amfeData.operations ? amfeData.operations.length : 0} operations`);
if (amfeData.operations) {
  for (const op of amfeData.operations) {
    const opNum = op.operationNumber || op.opNumber;
    const opName = op.operationName || op.name;
    console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  }
}

// ── Backup before changes ───────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/telas-termoformadas-load-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`\nBackup saved to: ${backupDir}/amfe_before.json`);

// ── Deep clone for modification ─────────────────────────────────────
const data = JSON.parse(JSON.stringify(amfeData));

// ── Apply header fixes ──────────────────────────────────────────────
if (!data.header) data.header = {};
Object.assign(data.header, headerFixes);
console.log('\nHeader updated with fixes.');

// ── REPLACE ALL operations (full replacement strategy) ──────────────
const allOps = [op10, op15, op20, op25, op30, op40, op50, op60, op70, op80, op90, op100, op101, op102, op103, op105, op110, op120];
data.operations = allOps;
console.log(`\nReplaced all operations with ${allOps.length} new operations.`);

// ── Sort operations by number ───────────────────────────────────────
data.operations.sort((a, b) => {
  const numA = parseInt(a.operationNumber || a.opNumber, 10);
  const numB = parseInt(b.operationNumber || b.opNumber, 10);
  return numA - numB;
});

// ── Summary before save ─────────────────────────────────────────────
console.log(`\n=== Operations after replacement (${data.operations.length} total) ===`);
let totalCauses = 0;
for (const op of data.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  let opCauses = 0;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const f of (fn.failures || [])) {
        opCauses += (f.causes || []).length;
      }
    }
  }
  totalCauses += opCauses;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs, ${opCauses} causes)`);
}
console.log(`Total causes across all operations: ${totalCauses}`);

// ── Save to Supabase — pass object directly, NEVER JSON.stringify ───
console.log('\n=== Saving to Supabase ===');

const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({ data: data })
  .eq('id', AMFE_ID);

if (updateErr) {
  console.error('ERROR saving:', updateErr.message);
  process.exit(1);
}
console.log('Saved to Supabase successfully.');

// ── Verify typeof data ──────────────────────────────────────────────
const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verifying:', verifyErr.message);
  process.exit(1);
}

if (typeof verifyDoc.data === 'object') {
  console.log('VERIFIED: typeof data === "object"');
} else {
  console.error(`ERROR: typeof data === "${typeof verifyDoc.data}" — DOUBLE SERIALIZED!`);
  process.exit(1);
}

// Check operations array
if (Array.isArray(verifyDoc.data.operations)) {
  console.log(`VERIFIED: data.operations is array with ${verifyDoc.data.operations.length} operations`);
} else {
  console.error('ERROR: data.operations is not an array!');
  process.exit(1);
}

// Verify all ops exist
for (const newOp of allOps) {
  const found = verifyDoc.data.operations.find(op =>
    String(op.operationNumber || op.opNumber) === newOp.opNumber
  );
  if (found) {
    console.log(`  VERIFIED: OP ${newOp.opNumber} exists`);
  } else {
    console.error(`  ERROR: OP ${newOp.opNumber} NOT FOUND after save!`);
  }
}

// Verify header
console.log('\n=== Header verification ===');
const hdr = verifyDoc.data.header || {};
for (const [key, val] of Object.entries(headerFixes)) {
  if (hdr[key] === val) {
    console.log(`  VERIFIED: header.${key} = "${val}"`);
  } else {
    console.error(`  ERROR: header.${key} expected "${val}" but got "${hdr[key]}"`);
  }
}

// Save after state
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log(`\nAfter-state saved to: ${backupDir}/amfe_after.json`);

// Final summary
console.log('\n=== FINAL SUMMARY ===');
console.log(`AMFE ID: ${AMFE_ID}`);
console.log(`Operations before: ${amfeData.operations ? amfeData.operations.length : 0}`);
console.log(`Operations after: ${data.operations.length}`);
console.log(`Strategy: FULL REPLACEMENT`);
console.log(`Total operations: ${data.operations.length}`);
console.log(`Total causes: ${totalCauses}`);
console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);
