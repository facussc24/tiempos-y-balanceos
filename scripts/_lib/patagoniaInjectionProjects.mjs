/**
 * Fuente única de los 10 moldes de inyección de Patagonia (planilla de piso de
 * Barack Hurlingham, 06/07/2026, confirmada por Fak). 2 prensas COMPARTIDAS.
 *
 * Se usa para:
 *   - Generar los 10 Gate 3 VW-original por pieza (scripts/_exportPatagoniaGate3All.mjs)
 *   - Sembrar los 10 proyectos por-pieza en Supabase (cuando haya acceso)
 *
 * reservationPct = fracción del TIEMPO DE MÁQUINA que consume cada molde dentro de
 * su prensa = (golpes × ciclo) / Σ(golpes × ciclo de la prensa). Las reservas de una
 * prensa suman 1.0 (100 % = máximo físico). Como cada prensa está sobrecargada, con
 * su parte justa ningún molde llega a su demanda → cada Gate 3 da ROJO (veredicto
 * honesto de capacidad con la prensa compartida). El OEE (85 %) absorbe las pérdidas;
 * el cambio de molde (60 min/día) es presión adicional que se documenta en el LEEME.
 */

// Datos confirmados por Fak (golpes/día reales, ciclo en seg, cavidades).
// Regla de cavidades: IP = 2 (pieza única); todo lo demás (puertas izq+der) = 4.
export const PATAGONIA_MOLDS = [
  { key: 'ip_high',       name: 'Inyección IP High',            machine: '1200T', golpes: 200, cycle: 90, cav: 2 },
  { key: 'ip_low',        name: 'Inyección IP Low',             machine: '1200T', golpes: 100, cycle: 90, cav: 2 },
  { key: 'top_roll_del',  name: 'Inyección Top Roll Delantero', machine: '1200T', golpes: 350, cycle: 70, cav: 4 },
  { key: 'top_roll_tras', name: 'Inyección Top Roll Trasero',   machine: '1200T', golpes: 350, cycle: 70, cav: 4 },
  { key: 'inserto_del',   name: 'Inyección Inserto Delantero',  machine: '750T',  golpes: 350, cycle: 60, cav: 4 },
  { key: 'inserto_tras',  name: 'Inyección Inserto Trasero',    machine: '750T',  golpes: 350, cycle: 60, cav: 4 },
  { key: 'apb_del',       name: 'Inyección APB Delantero',      machine: '750T',  golpes: 350, cycle: 42, cav: 4 },
  { key: 'apb_tras',      name: 'Inyección APB Trasero',        machine: '750T',  golpes: 350, cycle: 42, cav: 4 },
  { key: 'bracket_del',   name: 'Inyección Bracket Delantero',  machine: '750T',  golpes: 350, cycle: 45, cav: 4 },
  { key: 'bracket_tras',  name: 'Inyección Bracket Trasero',    machine: '750T',  golpes: 350, cycle: 45, cav: 4 },
];

export const OEE = 0.85;
const DATE = '2026-07-06';

/** reservationPct por molde = parte del tiempo de máquina de su prensa (suman 1.0/prensa). */
export function computeReservations(molds = PATAGONIA_MOLDS) {
  const totByMachine = {};
  for (const m of molds) {
    totByMachine[m.machine] = (totByMachine[m.machine] || 0) + m.golpes * m.cycle;
  }
  return molds.map((m) => ({
    ...m,
    reservationPct: (m.golpes * m.cycle) / totByMachine[m.machine],
  }));
}

// Turnos estándar del módulo Barack: 21,5 h netas/día (T1 8h + T2 7,25h + T3 6,25h).
// El adapter del export lee shifts[].length (min brutos) y le resta breaks[].duration.
function standardShifts() {
  return [
    { id: 1, name: 'Turno 1', startTime: '06:00', endTime: '15:00', length: 540, breaks: [{ id: 'b1', name: 'Descanso', startTime: '11:00', duration: 60 }] },
    { id: 2, name: 'Turno 2', startTime: '15:00', endTime: '23:00', length: 480, breaks: [{ id: 'b2', name: 'Descanso', startTime: '19:00', duration: 45 }] },
    { id: 3, name: 'Turno 3', startTime: '23:00', endTime: '06:00', length: 420, breaks: [{ id: 'b3', name: 'Descanso', startTime: '03:00', duration: 45 }] },
  ];
}

/** Construye el ProjectData (1 estación) de un molde. Mismo modelo de inyección que project 20. */
export function buildProjectData(m) {
  const pp = +(m.cycle / m.cav).toFixed(4); // tiempo por pieza (times[] se normaliza por cycleQuantity)
  const task = {
    id: '10',
    description: m.name,
    times: [m.cycle, m.cycle, m.cycle, m.cycle, m.cycle],
    averageTime: pp, standardTime: pp, ratingFactor: 100, fatigueCategory: 'none',
    predecessors: [], successors: [], positionalWeight: pp, calculatedSuccessorSum: 0, stdDev: 0,
    executionMode: 'injection', sectorId: m.machine, cycleQuantity: m.cav, requiredSamples: 0, concurrentWith: null,
    injectionParams: {
      productionVolume: m.golpes, investmentRatio: 0, optimalCavities: m.cav,
      pInyectionTime: 0, pCuringTime: m.cycle, manualInteractionTime: 0, manualOperations: [],
      cavityMode: 'manual', userSelectedN: m.cav, headcountMode: 'auto', injectionMode: 'batch', realCycle: pp,
    },
    ignoredTimeIndices: [],
  };
  return {
    meta: {
      name: m.name, date: DATE, client: 'VWA', version: 'Rev A',
      engineer: 'Facundo S.', creator: 'F.Santoro', project: 'PATAGONIA',
      partNumber: '', partDesignation: m.name,
      activeShifts: 3, manualOEE: OEE, useManualOEE: true, useSectorOEE: false,
      dailyDemand: m.golpes * m.cav, piecesPerVehicle: 1, configuredStations: 1,
      reservationPct: m.reservationPct,
      activeModels: [{ id: 'default', name: 'Modelo Estándar', percentage: 1, color: '#3b82f6' }],
      createdAt: `${DATE}T00:00:00.000Z`,
      modifiedBy: 'Claude: Gate3 VW por-pieza inyección Patagonia (planilla Fak 06/07/2026)',
    },
    shifts: standardShifts(),
    sectors: [{ id: m.machine, name: `Inyectora ${m.machine}`, color: m.machine === '1200T' ? '#F59E0B' : '#3B82F6', targetOee: OEE, sequence: 1 }],
    tasks: [task],
    assignments: [{ taskId: '10', stationId: 1 }],
    stationConfigs: [{ id: 1, replicas: 1, oeeTarget: OEE }],
    zoningConstraints: [], vsmExternalNodes: [], vsmInfoFlows: [],
  };
}

/** Devuelve los 10 moldes con su reservationPct + su ProjectData listo. */
export function buildAll() {
  return computeReservations().map((m) => ({ ...m, data: buildProjectData(m) }));
}
