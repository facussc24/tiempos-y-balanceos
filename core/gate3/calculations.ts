/**
 * Funciones puras de calculo Gate 3 VW.
 * Replica las formulas del workbook Gate_3_Capacity Check.xlsx (template oficial VW Group).
 *
 * Todas las funciones son puras y devuelven 0 ante divisiones por cero
 * (mismo comportamiento que las formulas IF(...=0,0,...) del Excel).
 */

import { VW_FLEXIBILITY, VW_WEEKS_PER_YEAR } from './constants';
import type {
    AcceptanceCertificate,
    Gate3Station,
    OeeMetrics,
    ProtocolResult,
    ProtocolSFN1,
    StationResult,
} from './types';

const safeDiv = (num: number, den: number): number => (den === 0 ? 0 : num / den);

/**
 * OEE = Disponibilidad x Rendimiento x Calidad (hoja OEE CalculatorSFN, filas 16/20/21/22/23).
 */
export function calcOEE(s: Pick<
    Gate3Station,
    'observationTimeMin' | 'cycleTimeSec' | 'cavities' | 'downtimeMin' | 'okParts' | 'nokParts'
>): OeeMetrics {
    const { observationTimeMin, cycleTimeSec, cavities, downtimeMin, okParts, nokParts } = s;

    const targetUnits = safeDiv(observationTimeMin * 60, cycleTimeSec) * cavities;

    const availability = safeDiv(observationTimeMin - downtimeMin, observationTimeMin);

    const operatingTimeSec = (observationTimeMin - downtimeMin) * 60;
    const theoreticalUnits = safeDiv(operatingTimeSec, cycleTimeSec) * cavities;
    const performance = safeDiv(okParts + nokParts, theoreticalUnits);

    const totalParts = okParts + nokParts;
    const quality = safeDiv(okParts, totalParts);

    const oee = availability * performance * quality;

    return { targetUnits, availability, performance, quality, oee };
}

/**
 * Capacidad semanal por estacion (hoja CapacitySFN, formula G12 maestra).
 *
 *   weekly = shifts * hours * 3600 / cycle_sec * OEE * cavities * machines * reservation
 *
 * Devuelve 0 si cualquier denominador o factor critico es 0.
 */
export function calcWeeklyCapacity(s: Gate3Station, oee: number): number {
    const { cycleTimeSec, cavities, machines, shiftsPerWeek, hoursPerShift, reservationPct } = s;

    if (cycleTimeSec === 0 || oee === 0 || cavities === 0 || machines === 0) return 0;

    const totalSecondsWeek = shiftsPerWeek * hoursPerShift * 3600;
    const cyclesWeek = totalSecondsWeek / cycleTimeSec;
    const effectiveCycles = cyclesWeek * oee;
    const grossPieces = effectiveCycles * cavities * machines;
    return grossPieces * reservationPct;
}

/**
 * Calcula OEE + capacidad + status para una estacion contra una demanda nominal.
 */
export function calcStationResult(station: Gate3Station, normalDemand: number): StationResult {
    const oee = calcOEE(station);
    const weeklyCapacity = calcWeeklyCapacity(station, oee.oee);
    const maxDemand = normalDemand * (1 + VW_FLEXIBILITY);

    let status: 'green' | 'amber' | 'red' = 'red';
    if (weeklyCapacity >= maxDemand) status = 'green';
    else if (weeklyCapacity >= normalDemand) status = 'amber';

    return { station, oee, weeklyCapacity, status };
}

/**
 * Bottleneck = estacion de menor capacidad semanal (entre las que tienen capacidad > 0).
 */
export function getBottleneck(results: StationResult[]): StationResult | null {
    const valid = results.filter((r) => r.weeklyCapacity > 0);
    if (valid.length === 0) return null;
    return valid.reduce((min, r) => (r.weeklyCapacity < min.weeklyCapacity ? r : min));
}

/**
 * Cantidades nominadas + flexibilidad (hoja Protocolo_SFN1, filas 34-37).
 *
 *   anual          = nominated_weekly * 48
 *   anual+15%      = anual * 1.15
 *   semanal+15%    = anual+15% / 48  (= nominated_weekly * 1.15)
 */
export function calcNominatedQuantities(nominatedWeekly: number) {
    const nominatedAnnual = nominatedWeekly * VW_WEEKS_PER_YEAR;
    const flexAnnual = nominatedAnnual * (1 + VW_FLEXIBILITY);
    const flexWeekly = flexAnnual / VW_WEEKS_PER_YEAR;
    return { nominatedAnnual, flexAnnual, flexWeekly };
}

/**
 * Capacidad planificada (Protocolo_SFN1 D52/F52).
 *
 *   planned = parallel_lines * (min_per_shift / cycle_min_piece)
 *           * shifts * OEE * pct_family * pct_VW * (1 - reject_rate)
 *
 * shifts = D51 (normal) o F51 (max) — pasar el que corresponda.
 */
export function calcPlannedCapacity(p: ProtocolSFN1, shifts: number): number {
    const { parallelLines, minPerShift, cycleTimeMinPiece, plannedOEE, capacityFamilyPct, capacityVwGroupPct, rejectRate } = p;

    if (cycleTimeMinPiece === 0 || parallelLines === 0) return 0;

    return (
        parallelLines *
        (minPerShift / cycleTimeMinPiece) *
        shifts *
        plannedOEE *
        capacityFamilyPct *
        capacityVwGroupPct *
        (1 - rejectRate)
    );
}

/**
 * Capacidad real comprobada en la prueba de aceptacion (Protocolo_SFN1 F66/F70).
 *
 *   actual = (ok_parts / lines_acc * lines_series) / duration_min * min_per_shift
 *          * shifts * pct_VW * pct_family * [OEE if includeAvailability]
 *
 * Con includeAvailability=true (metodo 1, prueba <1 turno) -> multiplica por plannedOEE
 * Con includeAvailability=false (metodo 2, prueba >=1 turno) -> NO multiplica por OEE
 */
export function calcAcceptanceCapacity(p: AcceptanceCertificate, shifts: number): number {
    const {
        parallelLines, minPerShift, capacityFamilyPct, capacityVwGroupPct, plannedOEE,
        linesInAcceptance, acceptanceDurationMin, totalPartsProduced, reworkParts, rejectParts,
        includeAvailability,
    } = p;

    if (acceptanceDurationMin === 0 || linesInAcceptance === 0) return 0;

    const okPartsDirect = totalPartsProduced - reworkParts - rejectParts;

    let result =
        (okPartsDirect / linesInAcceptance) *
        parallelLines /
        acceptanceDurationMin *
        minPerShift *
        shifts *
        capacityVwGroupPct *
        capacityFamilyPct;

    if (includeAvailability) result *= plannedOEE;

    return result;
}

/**
 * Resultado completo del Protocolo/PCA.
 */
export function calcProtocolResult(p: ProtocolSFN1): ProtocolResult {
    const { nominatedWeekly, totalPartsProduced, reworkParts, rejectParts, shiftsPerWeek, maxShiftsPerWeek } = p;

    const nominated = calcNominatedQuantities(nominatedWeekly);

    const okPartsDirect = totalPartsProduced - reworkParts - rejectParts;
    const okPartsTotal = okPartsDirect + reworkParts;
    const firstPassRate = safeDiv(okPartsDirect, totalPartsProduced);
    const rejectRate = safeDiv(rejectParts, totalPartsProduced);

    return {
        plannedNormal: calcPlannedCapacity(p, shiftsPerWeek),
        plannedMax: calcPlannedCapacity(p, maxShiftsPerWeek),
        actualNormal: calcAcceptanceCapacity(p, shiftsPerWeek),
        actualMax: calcAcceptanceCapacity(p, maxShiftsPerWeek),
        okPartsDirect,
        okPartsTotal,
        firstPassRate,
        rejectRate,
        nominatedAnnual: nominated.nominatedAnnual,
        flexAnnual: nominated.flexAnnual,
        flexWeekly: nominated.flexWeekly,
    };
}
