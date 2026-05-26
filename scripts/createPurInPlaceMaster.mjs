/**
 * createPurInPlaceMaster.mjs
 *
 * Crea el "Maestro AMFE Inyeccion PUR in place" como documento nuevo DESDE CERO:
 *  1. Nueva familia en product_families (Proceso de Inyeccion PUR in place)
 *  2. Nuevo AMFE master (AMFE-MAESTRO-PU-001) con 1 OP + 11 WEs + 11 FMs + N causas
 *  3. Link en family_documents (module=amfe, is_master=1)
 *
 * Replicacion futura: HF-PAT / HRC-PAT / HRO-PAT (NO en este script).
 * Plan de Control: NO en este script (se hace despues, cuando Leo defina O/D).
 * PFD / HO: Barack NO los hace (reglas no-flujogramas-barack.md + no-ho-barack.md).
 *
 * TBD-Leo sentinels:
 *  - occurrence = 0  (sin asignar hasta Leo defina)
 *  - detection  = 0  (idem)
 *  - ap = ''         (no calculable hasta tener O y D)
 *
 * Uso:
 *   node scripts/createPurInPlaceMaster.mjs            # dry-run
 *   node scripts/createPurInPlaceMaster.mjs --apply    # ejecutar contra Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ─────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Construye una causa con todos los aliases sincronizados.
 * O y D = 0 (sentinel TBD-Leo). AP = '' (no calculable).
 */
function buildCause({ text, severity, specialChar, characteristicNumber }) {
  return {
    id: randomUUID(),
    cause: text,                    // alias 1
    description: text,              // alias 2 (sincronizado)
    severity: severity,
    occurrence: 0,                  // TBD-Leo
    detection: 0,                   // TBD-Leo
    ap: '',                         // TBD-Leo (alias 1)
    actionPriority: '',             // TBD-Leo (alias 2)
    preventionControl: '',          // controles a nivel fm (no cause)
    detectionControl: '',
    preventionAction: '',
    detectionAction: '',
    optimizationAction: '',         // NO inventar (regla amfe-actions.md)
    specialChar: specialChar,
    characteristicNumber: characteristicNumber,
    responsible: 'Carlos Baptista (Ingenieria)',
    targetDate: '',
    status: 'Pendiente',
    filterCode: ''
  };
}

/**
 * Construye un Failure Mode con sus causas. Los campos legacy a nivel
 * failure se llenan con los valores del fm (S, specialChar, controls).
 */
function buildFailure({
  description,
  effectLocal,
  effectNextLevel,
  effectEndUser,
  severity,
  specialChar,
  preventionControl,
  detectionControl,
  causes
}) {
  return {
    id: randomUUID(),
    description,
    effectLocal,
    effectNextLevel,
    effectEndUser,
    // Campos legacy a nivel failure (sincronizados con cause[])
    severity: severity,
    occurrence: 0,                  // TBD-Leo
    detection: 0,                   // TBD-Leo
    ap: '',                         // TBD-Leo
    specialChar: specialChar,
    preventionControl: preventionControl,
    detectionControl: detectionControl,
    causes: causes
  };
}

/**
 * Construye un Work Element con UNA funcion principal cuyo array de failures
 * contiene los FMs que pertenecen a este WE.
 */
function buildWorkElement({ name, type, functionText, failures }) {
  return {
    id: randomUUID(),
    name,
    type,
    functions: [
      {
        id: randomUUID(),
        description: functionText,           // alias 1
        functionDescription: functionText,   // alias 2 (sincronizado)
        requirements: '',
        failures: failures
      }
    ]
  };
}

/** Cuenta total de causas iterando la estructura completa. */
function countCauses(operations) {
  let total = 0;
  for (const op of operations) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fail of fn.failures || []) {
          for (const _ of fail.causes || []) total++;
        }
      }
    }
  }
  return total;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART A: CONSTRUIR FAILURE MODES (11 totales)
// ══════════════════════════════════════════════════════════════════════════════

// FM-LEG — Pieza PU no cumple norma legal VW (S=9 CC)
const FM_LEG = buildFailure({
  description: 'Pieza no cumple flamabilidad TL 1010 o emisiones VW 50180 o ELV',
  effectLocal: 'Lote rechazado en ensayo de laboratorio. SCRAP.',
  effectNextLevel: 'Rechazo PPAP, parada de lanzamiento, no conformidad mayor',
  effectEndUser: 'Riesgo de incendio o inhalacion de gases. Incumplimiento legal.',
  severity: 9,
  specialChar: 'CC',
  preventionControl: 'Calibracion periodica de flujometros POLY/ISO (POL1=1, ISO1=1) + verificacion setpoint HMI (densidad/proporcion) + sincronizacion variadores SINAMICS G120 + agitadores POLY/ISO funcionando (KM65/KM66)',
  detectionControl: 'Alarma HMI desviacion de caudal con parada automatica + sensores RTD PT100 mixhead + presion mixhead AI4/AI5 + corriente bombas E21/E22 + variadores fault E27/E30',
  causes: [
    buildCause({ text: 'Lote PU del proveedor fuera de espec', severity: 9, specialChar: 'CC', characteristicNumber: '1' }),
    buildCause({ text: 'Mezcla iso/poliol mal hecha en planta', severity: 9, specialChar: 'CC', characteristicNumber: '2' }),
    buildCause({ text: 'Contaminacion con sustancias prohibidas REACH/ELV', severity: 9, specialChar: 'CC', characteristicNumber: '3' }),
    buildCause({ text: 'Agitador del tanque POLY o ISO parado durante produccion (componente decantado)', severity: 9, specialChar: 'CC', characteristicNumber: '4' }),
    buildCause({ text: 'Variador POLY o ISO desincronizado respecto a la referencia (AQW0/AQW1)', severity: 9, specialChar: 'CC', characteristicNumber: '5' })
  ]
});

// FM-1 — Delaminacion (S=6, SC if O>=4 → TBD-Leo)
const FM_1 = buildFailure({
  description: 'Las capas funda/espuma/sustrato se despegan entre si',
  effectLocal: 'Se nota una bolsa entre capas. La tela se mueve sola al apretar',
  effectNextLevel: 'SCRAP. No se puede retrabajar.',
  effectEndUser: 'Apoyacabezas con defecto visible y estructura comprometida',
  severity: 6,
  specialChar: '',
  preventionControl: 'Setpoints HMI temperatura POLY/ISO/agua tanques (PLC bloquea inyeccion hasta alcanzar setpoint) + sincronizacion variadores POLY/ISO via AQW0/AQW1',
  detectionControl: 'Sensores RTD PT100 mixhead (IW96, IW100) — lectura continua de temperatura mezcla',
  causes: [
    buildCause({ text: 'Superficie de funda contaminada antes del espumado', severity: 6, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Temperatura de molde fuera de rango', severity: 6, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Ratio iso/poliol fuera de especificacion', severity: 6, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Arranque de produccion sin alcanzar setpoint de temperatura HMI (arranque prematuro en frio)', severity: 6, specialChar: '', characteristicNumber: '4' })
  ]
});

// FM-2 — Huecos en espuma (S=6, SC if O>=4 → TBD-Leo)
const FM_2 = buildFailure({
  description: 'La espuma queda con cavidades vacias por dentro',
  effectLocal: 'Pieza con burbujas visibles o zonas que se hunden al palpar',
  effectNextLevel: 'SCRAP',
  effectEndUser: 'Confort comprometido y pieza estructuralmente debil',
  severity: 6,
  specialChar: '',
  preventionControl: 'Sensor presion bombas POLY/ISO (AI6/AI7) + presion aire bajo en linea (E64/E65) + nivel aceite hidraulico (E35) + verificacion posicion cilindro mixhead E50/E51 antes del shot',
  detectionControl: 'Alarma HMI desviacion de presion con parada automatica de pulverizacion + nivel tanque analogico AI 2/AI 3 (corte recarga si baja)',
  causes: [
    buildCause({ text: 'Peso de inyeccion insuficiente', severity: 6, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Mezcla A:B incompleta', severity: 6, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Venteo del molde obstruido', severity: 6, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Aire aspirado en linea por nivel bajo en tanque POLY o ISO', severity: 6, specialChar: '', characteristicNumber: '4' })
  ]
});

// FM-3 — Contaminacion (S=7, SC if O>=4 → TBD-Leo)
const FM_3 = buildFailure({
  description: 'Particulas extranas o suciedad dentro de la espuma',
  effectLocal: 'Manchas oscuras o pintas visibles en la espuma',
  effectNextLevel: 'SCRAP. Posible rechazo de lote por riesgo VOC',
  effectEndUser: 'Defecto estetico + riesgo VW 50180 emisiones',
  severity: 7,
  specialChar: '',
  preventionControl: 'Agitadores POLY/ISO funcionando (KM65/KM66) + purga automatizada del mixhead entre ciclos (sensores E1.4/E52/E53 + cilindro de cleaning shot E14/E15)',
  detectionControl: 'Sensor confirmacion purga ejecutada (E1.4 + cylinder ejected/retracted E52/E53) — sistema confirma automaticamente que la purga se realizo',
  causes: [
    buildCause({ text: 'Molde sucio (restos de PU de ciclos anteriores)', severity: 7, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Bidones de poliol/isocianato contaminados', severity: 7, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Boquilla con residuos sin purgar entre ciclos', severity: 7, specialChar: '', characteristicNumber: '3' })
  ]
});

// FM-4 — Zonas duras (S=5, SC if O>=4 → TBD-Leo)
const FM_4 = buildFailure({
  description: 'Zonas localizadas mas rigidas que el resto de la espuma',
  effectLocal: 'Dureza dispareja al apretar la pieza con la mano',
  effectNextLevel: 'SCRAP',
  effectEndUser: 'Confort comprometido, sensacion dispareja al apoyar la cabeza',
  severity: 5,
  specialChar: '',
  preventionControl: 'Setpoints temperatura HMI (POLY/ISO/agua tanques) con bloqueo PLC + sincronizacion variadores POLY/ISO + chiller running flag (E34) verificado al arranque',
  detectionControl: 'PT100 mixhead (IW96, IW100) + PT100 agua tanques (IW104, IW108) + Tank Temperature AI 0/AI 1 + corriente calefaccion E25/E26',
  causes: [
    buildCause({ text: 'Mezclador desgastado o mantenimiento vencido', severity: 5, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Ratio iso/poliol incorrecto', severity: 5, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Temperatura de los componentes fuera de rango', severity: 5, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Falla del chiller de refrigeracion (componentes fuera de rango termico)', severity: 5, specialChar: '', characteristicNumber: '4' }),
    buildCause({ text: 'Agitador POLY o ISO parado (componente decantado y dosificacion irregular)', severity: 5, specialChar: '', characteristicNumber: '5' })
  ]
});

// FM-5 — Fuga PU (S=4, no califica)
const FM_5 = buildFailure({
  description: 'La mezcla PU se escapa del molde durante la inyeccion',
  effectLocal: 'Pieza descartada + molde contaminado + parada para limpiar',
  effectNextLevel: 'Productivo (no llega al cliente)',
  effectEndUser: 'N/A',
  severity: 4,
  specialChar: '',
  preventionControl: 'Verificacion posicion cilindro mixhead E50/E51 antes del shot + sensor OverPressure bombas E66/E67 (corta ciclo) + nivelacion plataforma giratoria con pernos quimicos + 15 placas base fijadas',
  detectionControl: 'Monitoreo presion mixhead durante shot (AI4/AI5) — caida brusca = fuga + visual del operario al desmoldeo',
  causes: [
    buildCause({ text: 'El vinilo no abraza la varilla — sello deficiente', severity: 4, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Funda con apertura mal cosida (origen costura)', severity: 4, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Bolsa atrapada al cerrar el molde', severity: 4, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Boquilla queda fuera de la bolsa', severity: 4, specialChar: '', characteristicNumber: '4' }),
    buildCause({ text: 'Clamps de fijacion mal cerrados', severity: 4, specialChar: '', characteristicNumber: '5' }),
    buildCause({ text: 'Sobrepresion en bomba dosificadora POLY o ISO', severity: 4, specialChar: '', characteristicNumber: '6' }),
    buildCause({ text: 'Sistema hidraulico de la inyectora degradado (aceite fuera de spec, enfriador desconectado)', severity: 4, specialChar: '', characteristicNumber: '7' })
  ]
});

// FM-6 — Pieza fuera de posicion (S=6, SC if O>=4 → TBD-Leo)
const FM_6 = buildFailure({
  description: 'Apoyacabezas queda descentrado o con geometria incorrecta tras el espumado',
  effectLocal: 'Pieza fuera de tolerancia dimensional',
  effectNextLevel: 'SCRAP. No se monta en el respaldo del asiento',
  effectEndUser: 'Apoyacabezas desviado visible o no funcional',
  severity: 6,
  specialChar: '',
  preventionControl: 'Sensores posicion plato rotativo E56/E57 (FASE 6 secuencia) + verificacion chiller corriendo (E34) + anclaje 15 placas base verificado + RFID identification del molde (manual 5.4.1)',
  detectionControl: 'Pendiente definicion equipo APQP',
  causes: [
    buildCause({ text: 'Bolsita no colocada o mal orientada', severity: 6, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Astas mal calzadas en las guias del molde', severity: 6, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Marcas de las astas no coinciden con las del molde', severity: 6, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Vinilo o funda sobresale y queda atrapado al cerrar', severity: 6, specialChar: '', characteristicNumber: '4' }),
    buildCause({ text: 'Plato del carrusel sin indexar correctamente al arranque (sensores E56/E57)', severity: 6, specialChar: '', characteristicNumber: '5' }),
    buildCause({ text: 'Plataforma giratoria desnivelada o pernos quimicos sueltos', severity: 6, specialChar: '', characteristicNumber: '6' })
  ]
});

// FM-7 — Ciclo incompleto (S=6, SC if O>=4 → TBD-Leo)
const FM_7 = buildFailure({
  description: 'El ciclo de inyeccion/curado se interrumpe o se completa fuera de condiciones',
  effectLocal: 'Pieza no consolidada o deformada al sacar del molde',
  effectNextLevel: 'SCRAP',
  effectEndUser: 'Pieza con dureza, recuperacion o durabilidad alteradas',
  severity: 6,
  specialChar: '',
  preventionControl: 'Doble via de cierre de ciclo (E0.7 Shot STOP por tiempo + E1.5 Sensor Shot por deteccion fisica) + wire-break detection 4-20 mA + modulo seguridad ES-FA-9AA + cambio aceite hidraulico L-HM 46 (frecuencia TBD-Leo) + enfriador verificado al arranque',
  detectionControl: 'Alarma HMI temperatura aceite hidraulico + alarma HMI tiempo max presurizacion + pantalla historica de registros de inyeccion + zumbador audible + marca parpadeante HMI',
  causes: [
    buildCause({ text: 'Maquina sale del modo automatico sin que el operario lo detecte', severity: 6, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Operario interviene durante el curado', severity: 6, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Falla del PLC o temporizador del ciclo', severity: 6, specialChar: '', characteristicNumber: '3' }),
    buildCause({ text: 'Corte de energia durante el ciclo', severity: 6, specialChar: '', characteristicNumber: '4' }),
    buildCause({ text: 'Aceite hidraulico degradado o fuera de rango termico', severity: 6, specialChar: '', characteristicNumber: '5' }),
    buildCause({ text: 'Enfriador desconectado o no operativo', severity: 6, specialChar: '', characteristicNumber: '6' }),
    buildCause({ text: 'Una de las 3 preselecciones (auto + wet shot + cabezal mezclador) no activa al disparar', severity: 6, specialChar: '', characteristicNumber: '7' })
  ]
});

// FM-8 — Riesgo operario por STOP (S=8 OS, OS if O>=4 → TBD-Leo)
const FM_8 = buildFailure({
  description: 'Ante emergencia, el operario no acciona el STOP correcto o no rearma la maquina correctamente',
  effectLocal: 'Dano al equipo + riesgo de lesion al operario',
  effectNextLevel: 'N/A (incidente interno de seguridad)',
  effectEndUser: 'N/A',
  severity: 8,
  specialChar: 'OS',
  preventionControl: 'Modulo de seguridad ES-FA-9AA con 3 E-STOPs en serie + 2 puertas + barrera de luz fotoelectrica + procedimiento rearme con Button Reset E32 + 2 niveles de usuario HMI con contrasena (manager/gong) + valla de proteccion perimetral',
  detectionControl: 'Pendiente definicion equipo APQP',
  causes: [
    buildCause({ text: 'Operario no sabe cual de los 5 ESTOPs usar segun la situacion (armario electrico, mezcla, consola, caja botones, prensa)', severity: 8, specialChar: 'OS', characteristicNumber: '1' }),
    buildCause({ text: 'Operario no sabe que el reset post-emergencia requiere accion manual (rearme + Button Reset E32)', severity: 8, specialChar: 'OS', characteristicNumber: '2' }),
    buildCause({ text: 'Valla de proteccion o interlock de seguridad inoperativo (puerta o barrera de luz fotoelectrica)', severity: 8, specialChar: 'OS', characteristicNumber: '3' }),
    buildCause({ text: 'Atmosfera con vapores ISO/POLY sin ventilacion forzada adecuada en zona del operario (conecta con FM-11 ATEX)', severity: 8, specialChar: 'OS', characteristicNumber: '4' })
  ]
});

// FM-10 — Flujometro desviado (S=9 CC)
const FM_10 = buildFailure({
  description: 'El flujometro POLY o ISO mide caudal incorrecto y entrega ratio A:B fuera de spec en la mezcla',
  effectLocal: 'Pieza con propiedades fuera de norma — SCRAP del lote del shot',
  effectNextLevel: 'Si la alarma HMI detecta a tiempo: SCRAP local. Si falla la alarma y el lote llega al cliente: rechazo en ensayo de laboratorio cliente',
  effectEndUser: 'Riesgo de incendio o inhalacion. Incumplimiento legal TL 1010 / VW 50180.',
  severity: 9,
  specialChar: 'CC',
  preventionControl: 'Calibracion periodica de flujometros POLY/ISO (POL1=1, ISO1=1 en HMI) — frecuencia TBD-Leo',
  detectionControl: 'Alarma HMI por desviacion de caudal con parada automatica de pulverizacion (manual TP900 5.4.1)',
  causes: [
    buildCause({ text: 'Flujometro POLY desviado (calibracion perdida o atascamiento)', severity: 9, specialChar: 'CC', characteristicNumber: '1' }),
    buildCause({ text: 'Flujometro ISO desviado (calibracion perdida o atascamiento)', severity: 9, specialChar: 'CC', characteristicNumber: '2' }),
    buildCause({ text: 'Calibracion del flujometro fuera de spec (POL1/ISO1 != 1 en HMI)', severity: 9, specialChar: 'CC', characteristicNumber: '3' })
  ]
});

// FM-11 — ATEX TBD-Leo (S=9 TBD, specialChar='' hasta confirmar)
const FM_11 = buildFailure({
  description: 'Concentracion de vapores POLY/ISO en zona del operario potencialmente inflamable o toxica por inhalacion',
  effectLocal: 'Riesgo de inhalacion quimica + ignicion si concentracion entra rango LEL',
  effectNextLevel: 'N/A (incidente seguridad)',
  effectEndUser: 'N/A',
  severity: 9,
  specialChar: '',  // TBD-Leo hasta confirmar
  preventionControl: 'Pendiente definicion equipo APQP',
  detectionControl: 'Pendiente definicion equipo APQP',
  causes: [
    buildCause({ text: 'Ventilacion de gases insuficiente en zona de inyeccion', severity: 9, specialChar: '', characteristicNumber: '1' }),
    buildCause({ text: 'Acumulacion de vapores por fuga no detectada (causa comun con FM-5)', severity: 9, specialChar: '', characteristicNumber: '2' }),
    buildCause({ text: 'Mantenimiento del sistema de extraccion vencido', severity: 9, specialChar: '', characteristicNumber: '3' })
  ]
});

// ══════════════════════════════════════════════════════════════════════════════
// PART B: CONSTRUIR LOS 11 WORK ELEMENTS Y MAPEAR FMs
// ══════════════════════════════════════════════════════════════════════════════
// Mapeo FM → WE (segun spec):
//   FM-LEG → WE-1 (Poliol, causa raiz lote PU proveedor)
//   FM-1   → WE-5 (Dossier de parametros)
//   FM-2   → WE-3 (Inyectora TP900)
//   FM-3   → WE-4 (Molde)
//   FM-4   → WE-7 (Flujometros, ratio)
//   FM-5   → WE-4 (Molde — fuga)
//   FM-6   → WE-6 (Operador)
//   FM-7   → WE-3 (Inyectora — ciclo)
//   FM-8   → WE-6 (Operador — STOP)
//   FM-10  → WE-7 (Flujometros — desviado)
//   FM-11  → WE-10 (Ventilacion ATEX)

const WE_1 = buildWorkElement({
  name: 'Poliol (componente A)',
  type: 'Material',
  functionText: 'Aportar el componente A para la reaccion PU',
  failures: [FM_LEG]
});

const WE_2 = buildWorkElement({
  name: 'Isocianato (componente B)',
  type: 'Material',
  functionText: 'Aportar el componente B para la reaccion PU',
  failures: []
});

const WE_3 = buildWorkElement({
  name: 'Inyectora PU TP900 con dosificadora A:B',
  type: 'Machine',
  functionText: 'Mezclar y dosificar los componentes',
  failures: [FM_2, FM_7]
});

const WE_4 = buildWorkElement({
  name: 'Molde de espumado climatizado en carrusel automatico',
  type: 'Machine',
  functionText: 'Dar forma a la pieza durante el espumado y curado',
  failures: [FM_3, FM_5]
});

const WE_5 = buildWorkElement({
  name: 'Dossier de parametros del proceso',
  type: 'Method',
  functionText: 'Documentar los parametros del ciclo',
  failures: [FM_1]
});

const WE_6 = buildWorkElement({
  name: 'Operador de Produccion',
  type: 'Man',
  functionText: 'Cargar moldes, retirar piezas, accionar STOP en emergencia',
  failures: [FM_6, FM_8]
});

const WE_7 = buildWorkElement({
  name: 'Flujometros caudal POLY/ISO (E0.0-E0.3)',
  type: 'Measurement',
  functionText: 'Medir el caudal real de cada componente y validar ratio A:B',
  failures: [FM_4, FM_10]
});

const WE_8 = buildWorkElement({
  name: 'Sensores RTD PT100 temperatura',
  type: 'Measurement',
  functionText: 'Medir temperatura de mezcla en mixhead y tanques',
  failures: []
});

const WE_9 = buildWorkElement({
  name: 'Sensores 4-20 mA presion',
  type: 'Measurement',
  functionText: 'Medir presion en mixhead y bombas durante el shot',
  failures: []
});

const WE_10 = buildWorkElement({
  name: 'Ventilacion de gases POLY/ISO (zona ATEX)',
  type: 'Environment',
  functionText: 'Controlar atmosfera en zona del operario',
  failures: [FM_11]
});

const WE_11 = buildWorkElement({
  name: 'Temperatura ambiente planta',
  type: 'Environment',
  functionText: 'Mantener condiciones estables para el ciclo',
  failures: []
});

const ALL_WES = [WE_1, WE_2, WE_3, WE_4, WE_5, WE_6, WE_7, WE_8, WE_9, WE_10, WE_11];

// ══════════════════════════════════════════════════════════════════════════════
// PART C: CONSTRUIR OPERACION UNICA + AMFE DATA
// ══════════════════════════════════════════════════════════════════════════════

const today = new Date().toISOString().slice(0, 10);

const operation = {
  id: randomUUID(),
  opNumber: '10',                          // alias 1
  operationNumber: '10',                   // alias 2 (sincronizado)
  name: 'INYECCION PUR IN PLACE',          // alias 1
  operationName: 'INYECCION PUR IN PLACE', // alias 2 (sincronizado)
  focusElementFunction: 'Interno: Proveer apoyacabezas con espuma PU consolidada, geometria conforme y funda sellada sin defectos visibles / Cliente: Permitir montaje en el respaldo del asiento VW sin interferencia ni desviacion dimensional / Usuario Final: Brindar confort y soporte ergonomico al pasajero, con apariencia estetica y vida util prolongada',
  operationFunction: 'Espumar el conjunto funda+varilla en molde mediante inyeccion de mezcla Poliol/Isocianato',
  linkedPfdStepId: null,
  workElements: ALL_WES
};

const newAmfeData = {
  header: {
    companyName: 'BARACK MERCOSUL',
    scope: 'Proceso de Inyeccion PUR in place — aplica a apoyacabezas Patagonia VW427/1LA_K (HF-PAT OP 63 / HRC-PAT OP 50 / HRO-PAT OP 50)',
    partNumber: '',
    applicableParts: '',
    responsibleEngineer: 'Carlos Baptista',
    coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
    preparedBy: 'Facundo Santoro',
    approvedBy: 'Carlos Baptista',
    plantApproval: 'Gonzalo Cal',
    customerName: 'VWA',
    customerApproval: '',
    amfeDate: today,
    revisionLevel: 'A',
    revisionDate: today
  },
  operations: [operation]
};

const totalCauses = countCauses(newAmfeData.operations);

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICACION DE ALIASES SINCRONIZADOS (pre-write)
// ══════════════════════════════════════════════════════════════════════════════
function verifyAliases() {
  const issues = [];
  for (const op of newAmfeData.operations) {
    if (op.opNumber !== op.operationNumber) issues.push(`OP alias desync: ${op.opNumber} vs ${op.operationNumber}`);
    if (op.name !== op.operationName) issues.push(`OP name alias desync: ${op.name} vs ${op.operationName}`);
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        if (fn.description !== fn.functionDescription) {
          issues.push(`Function alias desync en WE ${we.name}: "${fn.description}" vs "${fn.functionDescription}"`);
        }
        for (const fail of fn.failures || []) {
          for (const c of fail.causes || []) {
            if (c.cause !== c.description) {
              issues.push(`Cause alias desync: "${c.cause}" vs "${c.description}"`);
            }
            if (c.ap !== c.actionPriority) {
              issues.push(`AP alias desync: "${c.ap}" vs "${c.actionPriority}"`);
            }
          }
        }
      }
    }
  }
  return issues;
}

const aliasIssues = verifyAliases();
if (aliasIssues.length > 0) {
  console.error('ERROR: Aliases desincronizados detectados:');
  for (const issue of aliasIssues) console.error('  -', issue);
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════════
// RESUMEN DRY-RUN
// ══════════════════════════════════════════════════════════════════════════════

console.log('=== MAESTRO AMFE INYECCION PUR IN PLACE — DRY RUN ===\n');
console.log('  Familia a crear:');
console.log('    name: "Proceso de Inyeccion PUR in place"');
console.log('    description: AMFE de Fundacion - foam-in-place apoyacabezas Patagonia');
console.log('');
console.log('  AMFE a crear:');
console.log('    amfe_number: AMFE-MAESTRO-PU-001');
console.log('    project_name: MAESTRO/INYECCION_PUR_IN_PLACE');
console.log('    subject: Proceso de Inyeccion PUR in place');
console.log('    client: VWA');
console.log('    responsible: Carlos Baptista');
console.log('    organization: BARACK MERCOSUL');
console.log('    status: draft');
console.log('    revision_level: A');
console.log('');
console.log('  Estructura:');
console.log(`    Operaciones: 1 (OP 10 INYECCION PUR IN PLACE)`);
console.log(`    Work Elements: ${ALL_WES.length} (debe ser 11)`);
console.log(`    Failure Modes totales: 11 (LEG + 1-8 + 10 + 11)`);
console.log(`    Causas totales: ${totalCauses}`);
console.log('');
console.log('  WE breakdown:');
for (const we of ALL_WES) {
  const fms = we.functions[0]?.failures || [];
  const causeCount = fms.reduce((a, f) => a + (f.causes?.length || 0), 0);
  console.log(`    ${we.type.padEnd(13)} | ${we.name.padEnd(58)} | FMs=${fms.length} causas=${causeCount}`);
}
console.log('');
console.log('  FM breakdown:');
const allFms = ALL_WES.flatMap(we => we.functions[0]?.failures || []);
for (const fm of allFms) {
  console.log(`    S=${fm.severity} ${(fm.specialChar || '--').padEnd(3)} | ${fm.description.slice(0, 70)}... | causas=${fm.causes.length}`);
}
console.log('');
console.log('  Verificacion aliases: OK (0 desync)');
console.log('');
console.log('  Ejemplo FM-LEG serializado (preview):');
const fmLegPreview = {
  id: FM_LEG.id,
  description: FM_LEG.description,
  severity: FM_LEG.severity,
  specialChar: FM_LEG.specialChar,
  occurrence: FM_LEG.occurrence,
  detection: FM_LEG.detection,
  ap: FM_LEG.ap,
  causes_count: FM_LEG.causes.length,
  first_cause: {
    cause: FM_LEG.causes[0].cause,
    description: FM_LEG.causes[0].description,
    severity: FM_LEG.causes[0].severity,
    occurrence: FM_LEG.causes[0].occurrence,
    detection: FM_LEG.causes[0].detection,
    ap: FM_LEG.causes[0].ap,
    actionPriority: FM_LEG.causes[0].actionPriority,
    specialChar: FM_LEG.causes[0].specialChar
  }
};
console.log(JSON.stringify(fmLegPreview, null, 2));

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para ejecutar contra Supabase ***');
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// APPLY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== APLICANDO CAMBIOS A SUPABASE ===\n');

// Backup directory
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/pu-master-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe-data-prepared.json`, JSON.stringify(newAmfeData, null, 2));
console.log(`  Backup dir: ${backupDir}`);
console.log(`  Saved: amfe-data-prepared.json`);

// Detect TEXT vs JSONB by reading any existing AMFE
const { data: sampleAmfe, error: sampleErr } = await sb
  .from('amfe_documents').select('data').limit(1).single();
if (sampleErr) {
  console.error('ERROR reading sample AMFE for typeof detection:', sampleErr.message);
  process.exit(1);
}
const isText = typeof sampleAmfe.data === 'string';
console.log(`  Detected data column format: ${isText ? 'TEXT' : 'JSONB'}`);

// 1. Create family (no setear id — autoincremento)
const { data: familyRow, error: famErr } = await sb
  .from('product_families')
  .insert({
    name: 'Proceso de Inyeccion PUR in place',
    description: 'AMFE de Fundacion: proceso de espumado foam-in-place para apoyacabezas Patagonia (HF/HRC/HRO-PAT). Inyectora TP900 Zhangjiagang Liqin (AIAG-VDA 2019)',
    linea_code: '',
    linea_name: '',
    active: 1
  })
  .select('id, name')
  .single();
if (famErr) { console.error('ERROR creating family:', famErr.message); process.exit(1); }
console.log(`  1. Familia creada: id=${familyRow.id} name="${familyRow.name}"`);

// 2. Create AMFE master
const newAmfeId = randomUUID();
const amfePayload = {
  id: newAmfeId,
  amfe_number: 'AMFE-MAESTRO-PU-001',
  project_name: 'MAESTRO/INYECCION_PUR_IN_PLACE',
  subject: 'Proceso de Inyeccion PUR in place',
  client: 'VWA',
  part_number: '',
  responsible: 'Carlos Baptista',
  organization: 'BARACK MERCOSUL',
  status: 'draft',
  operation_count: 1,
  cause_count: totalCauses,
  ap_h_count: 0,                   // todas TBD-Leo
  ap_m_count: 0,                   // todas TBD-Leo
  coverage_percent: 100,
  start_date: today,
  last_revision_date: today,
  revision_level: 'A',
  data: isText ? JSON.stringify(newAmfeData) : newAmfeData
};

const { error: amfeErr } = await sb.from('amfe_documents').insert(amfePayload);
if (amfeErr) {
  console.error('ERROR creating AMFE:', amfeErr.message);
  console.log('  Rolling back family...');
  await sb.from('product_families').delete().eq('id', familyRow.id);
  process.exit(1);
}
console.log(`  2. AMFE creado: ${newAmfeId} (AMFE-MAESTRO-PU-001)`);

// 3. Link AMFE to family
const { error: linkErr } = await sb.from('family_documents').insert({
  family_id: familyRow.id,
  module: 'amfe',
  document_id: newAmfeId,
  is_master: 1,
  source_master_id: null,
  product_id: null
});
if (linkErr) {
  console.error('ERROR linking AMFE to family:', linkErr.message);
  process.exit(1);
}
console.log(`  3. AMFE vinculado a familia (is_master=1)`);

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== VERIFICACION POST-APPLY ===\n');

const { data: vAmfe, error: vErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, operation_count, cause_count, data')
  .eq('id', newAmfeId)
  .single();
if (vErr) {
  console.error('ERROR verifying AMFE:', vErr.message);
  process.exit(1);
}
const vAmfeData = typeof vAmfe.data === 'string' ? JSON.parse(vAmfe.data) : vAmfe.data;

console.log(`  AMFE: ${vAmfe.amfe_number}`);
console.log(`  operation_count column: ${vAmfe.operation_count} (expected 1)`);
console.log(`  cause_count column: ${vAmfe.cause_count} (expected ${totalCauses})`);
console.log(`  typeof data: ${typeof vAmfe.data} (after parse: object)`);
console.log(`  data.operations.length: ${vAmfeData.operations.length} (expected 1)`);
console.log(`  data.operations[0].workElements.length: ${vAmfeData.operations[0].workElements.length} (expected 11)`);

const verifiedCauses = countCauses(vAmfeData.operations);
console.log(`  data total causes (recount): ${verifiedCauses} (expected ${totalCauses})`);

// Verify family link
const { data: famLinks } = await sb
  .from('family_documents')
  .select('*')
  .eq('family_id', familyRow.id);
console.log(`  Family links: ${famLinks.length} (expected 1: amfe)`);

const allOk =
  vAmfeData.operations.length === 1 &&
  vAmfeData.operations[0].workElements.length === 11 &&
  verifiedCauses === totalCauses &&
  famLinks.length === 1 &&
  typeof vAmfeData === 'object';

console.log(`\n  ${allOk ? 'VERIFICACION OK' : 'ATENCION — revisar manualmente'}`);

// Save final state
writeFileSync(`${backupDir}/amfe-data-applied.json`, JSON.stringify(vAmfeData, null, 2));
writeFileSync(`${backupDir}/metadata.json`, JSON.stringify({
  family_id: familyRow.id,
  amfe_id: newAmfeId,
  amfe_number: 'AMFE-MAESTRO-PU-001',
  totalCauses,
  workElements: 11,
  failureModes: 11,
  appliedAt: new Date().toISOString()
}, null, 2));
console.log(`  Estado final guardado en: ${backupDir}`);
