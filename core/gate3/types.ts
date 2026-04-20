/**
 * Tipos del modulo VW Gate 3 Capacity Check.
 * Mapeo directo a las hojas del workbook estandar Volkswagen.
 */

/** Una estacion del proceso (max 12 por proyecto). */
export interface Gate3Station {
    id: string;
    name: string; // ej: "Mesa de corte"
    /**
     * Tipo de proceso. Determina el label adaptativo del Excel
     * (Cavidades vs Maquinas paralelas) y si cavidades > 1 tiene sentido.
     * Default 'general'.
     */
    processType?: import('./processType').Gate3ProcessType;
    // OEE Calculator inputs (puede dejarse en 0 si no se hace estudio OEE real;
    // en ese caso, el OEE viene del campo `oeeOverride` de abajo o del proyecto)
    observationTimeMin: number;
    cycleTimeSec: number;
    cavities: number;
    downtimeMin: number;
    okParts: number;
    nokParts: number;
    // CapacitySFN inputs
    shiftsPerWeek: number;
    hoursPerShift: number;
    reservationPct: number; // 0..1
    machines: number;
    /**
     * OEE manual (0..1). Si esta seteado, sobreescribe la formula vinculada
     * a OEE Calculator. Util cuando el usuario no completa observation/OK/NOK.
     */
    oeeOverride?: number;
}

/** Outputs derivados de OEE (no se persisten, se recalculan). */
export interface OeeMetrics {
    targetUnits: number;
    availability: number; // 0..1
    performance: number; // 0..1
    quality: number; // 0..1
    oee: number; // 0..1
}

/** Inputs/outputs del Protocolo SFN1 (filas 34-72 del template VW). */
export interface ProtocolSFN1 {
    nominatedWeekly: number; // D37
    acceptanceParts: number; // D38
    capacityVwGroupPct: number; // D48 (default 1.0)
    capacityFamilyPct: number; // F48 (0..1)
    parallelLines: number; // D49
    minPerShift: number; // F49
    cycleTimeMinPiece: number; // D50
    rejectRate: number; // F50 (0..1)
    shiftsPerWeek: number; // D51
    maxShiftsPerWeek: number; // F51
    plannedOEE: number; // H48 (0..1)
    // Capacidad comprobada
    linesInAcceptance: number; // D58
    acceptanceDurationMin: number; // F58
    totalPartsProduced: number; // H58
    reworkParts: number; // F59
    rejectParts: number; // H59
    /** true = metodo 1 (con OEE, prueba <1 turno); false = metodo 2 (sin OEE, prueba >=1 turno). */
    includeAvailability: boolean;
}

/** Certificado de aceptacion (PCA1, PCA2, PCA3). Misma estructura que ProtocolSFN1. */
export type AcceptanceCertificate = ProtocolSFN1;

/** Proyecto Gate 3 completo. */
export interface Gate3Project {
    // Datos generales (CapacitySFN C5-C9, J5-J8)
    partNumber: string;
    partDesignation: string;
    project: string;
    supplier: string;
    location: string;
    creator: string;
    date: string; // ISO o dd/MM/yyyy
    department: string;
    gsisNr: string;
    // DiagramSFN
    normalDemandWeek: number; // F7
    // Estaciones (1..12)
    stations: Gate3Station[];
    // Protocolos (opcionales — se completan en pestanias dedicadas)
    protocol?: ProtocolSFN1;
    pca1?: AcceptanceCertificate;
    pca2?: AcceptanceCertificate;
    pca3?: AcceptanceCertificate;
}

/** Resultado completo del calculo de una estacion. */
export interface StationResult {
    station: Gate3Station;
    oee: OeeMetrics;
    weeklyCapacity: number;
    /** GREEN = >= max demand, AMBER = >= normal demand, RED = < normal demand. */
    status: 'green' | 'amber' | 'red';
}

/** Resultado de Acceptance/Protocol calculation. */
export interface ProtocolResult {
    plannedNormal: number; // D52
    plannedMax: number; // F52
    actualNormal: number; // F66 o F70
    actualMax: number; // H66 o H70
    okPartsDirect: number; // D59
    okPartsTotal: number; // D60
    firstPassRate: number; // F60
    rejectRate: number; // H60
    nominatedAnnual: number; // D36
    flexAnnual: number; // F36
    flexWeekly: number; // F37
}
