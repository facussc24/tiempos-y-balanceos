/**
 * Mapeo declarativo de celdas del template oficial VW Gate 3 Capacity Check.
 *
 * Las posiciones SOLO incluyen celdas de INPUT (las que el usuario edita).
 * Las celdas de output (formulas) ya estan en el template y se preservan al clonar.
 *
 * Referencia: `Documents/FORMATO VW.../INYECCIÓN PLASTICA CALCULO VW FORMATO.txt`
 */

/** Letra de columna en OEE CalculatorSFN para la estacion N (1..12 → E..P). */
export const oeeStationCol = (n: number): string =>
    String.fromCharCode('E'.charCodeAt(0) + (n - 1));

/** Mapeo de estacion (1..12) a celdas en CapacitySFN — 3 bloques de 4 estaciones. */
export interface CapacityCellMap {
    /** Columna del NOMBRE del proceso (B / I / P) */
    nameCol: string;
    /** Columna del VALOR/RESULTADO (G / N / U) */
    valueCol: string;
    /** Fila superior del bloque (11 / 20 / 29 / 38) */
    topRow: number;
}

export function capStationMap(n: number): CapacityCellMap {
    const block = Math.ceil(n / 4); // 1..3
    const inBlock = ((n - 1) % 4) + 1; // 1..4
    const topRow = 11 + (inBlock - 1) * 9; // 11, 20, 29, 38
    if (block === 1) return { nameCol: 'B', valueCol: 'G', topRow };
    if (block === 2) return { nameCol: 'I', valueCol: 'N', topRow };
    return { nameCol: 'P', valueCol: 'U', topRow };
}

/**
 * Filas relativas dentro del bloque CapacitySFN (offsets desde topRow).
 * topRow corresponde a la fila de "Shifts/week".
 *
 * - INPUT: el codigo escribe valores aqui.
 * - FORMULA: el template tiene formulas; NO sobreescribir salvo override explicito.
 * - LINKED: viene como =OEE!... en el template; sobreescribir con valor literal solo
 *           si querES romper el link (caso oeeOverride o cavidades adaptativas).
 */
export const CAP_ROW_OFFSETS = {
    shiftsPerWeek: 0, // INPUT
    pcsWeek: 1, // FORMULA (resultado piezas/semana)
    /**
     * Fila +2: en columna nameCol = el nombre del proceso (input — "Mesa de corte").
     *          en columna valueCol = cycle time (LINKED a OEE Calculator).
     */
    processName: 2,
    cycleTime: 2,
    hoursPerShift: 3, // INPUT
    oee: 4, // LINKED (override permitido para usar OEE global del proyecto)
    cavities: 5, // LINKED (override permitido para forzar 1 en procesos no-inyeccion)
    reservation: 6, // INPUT (0..1)
    machines: 7, // INPUT
} as const;

/**
 * Filas absolutas en OEE CalculatorSFN para inputs (todas en columna E..P por estacion).
 * Las filas D(16), H-K(20-23) son formulas y NO se tocan.
 */
export const OEE_INPUT_ROWS = {
    observationTime: 13, // A — observation time (min)
    cycleTime: 14, // B — cycle time (sec)
    cavities: 15, // C — cavities
    downtime: 17, // E — recorded downtime (min)
    okParts: 18, // F — total OK parts
    nokParts: 19, // G — total NOT OK parts
} as const;

/**
 * Celdas del header de CapacitySFN (datos del proyecto y metadata).
 */
export const CAP_HEADER_CELLS = {
    partNumber: 'C5',
    partDesignation: 'C6',
    project: 'C7',
    supplier: 'C8',
    location: 'C9',
    creator: 'J5',
    date: 'J6',
    department: 'J7',
    gsisNr: 'J8',
} as const;

/** Celda de demanda normal en DiagramSFN (F5 = F7*1.15 es formula, NO tocar). */
export const DIAGRAM_NORMAL_DEMAND_CELL = 'F7';

/**
 * Para cada estacion (1..12), las celdas que contienen los LABELS adaptativos
 * en CapacitySFN ("Cavities" → "Maq. paralelas" para procesos no-inyeccion).
 *
 * El template oficial VW tiene los labels DUPLICADOS en cada bloque, en columnas
 * F (bloque 1), M (bloque 2), T (bloque 3), filas relativas +5 (cavities) y +7 (machines).
 */
export interface StationLabelCells {
    /** Celda del label "Cavities" (fila topRow+5, columna labelCol). */
    cavitiesLabel: string;
    /** Celda del label "Machines" (fila topRow+7, columna labelCol). */
    machinesLabel: string;
}

export function stationLabelCells(n: number): StationLabelCells {
    const m = capStationMap(n);
    // Label column es la columna ANTERIOR a la value column (G→F, N→M, U→T)
    const labelCol = String.fromCharCode(m.valueCol.charCodeAt(0) - 1);
    return {
        cavitiesLabel: `${labelCol}${m.topRow + CAP_ROW_OFFSETS.cavities}`,
        machinesLabel: `${labelCol}${m.topRow + CAP_ROW_OFFSETS.machines}`,
    };
}

/** Celdas de input del Protocolo SFN1 (filas 34-72). Outputs son formulas. */
export const PROTOCOL_INPUT_CELLS = {
    nominatedWeekly: 'D37',
    acceptanceParts: 'D38',
    capacityVwGroupPct: 'D48',
    capacityFamilyPct: 'F48',
    plannedOEE: 'H48',
    parallelLines: 'D49',
    minPerShift: 'F49',
    cycleTimeMinPiece: 'D50',
    rejectRate: 'F50',
    shiftsPerWeek: 'D51',
    maxShiftsPerWeek: 'F51',
    linesInAcceptance: 'D58',
    acceptanceDurationMin: 'F58',
    totalPartsProduced: 'H58',
    reworkParts: 'F59',
    rejectParts: 'H59',
    methodOneActive: 'H64', // "x" = metodo 1 activado (con OEE)
    methodTwoActive: 'H68', // "x" = metodo 2 activado (sin OEE)
} as const;

/** Celdas de input del PCA1 pre-check. */
export const PCA1_INPUT_CELLS = {
    nominatedWeekly: 'D36',
    capacityVwGroupPct: 'D47',
    capacityFamilyPct: 'F47',
    plannedOEE: 'H47',
    parallelLines: 'D48',
    minPerShift: 'F48',
    cycleTimeMinPiece: 'D49',
    rejectRate: 'F49',
    shiftsPerWeek: 'D50',
    maxShiftsPerWeek: 'F50',
    linesInAcceptance: 'D57',
    acceptanceDurationMin: 'F57',
    totalPartsProduced: 'H57',
    reworkParts: 'F58',
    rejectParts: 'H58',
    methodActive: 'H63',
} as const;
