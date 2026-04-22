/**
 * @module balancingMetricsCalc
 *
 * Calculos puros de metricas de balanceo. Se extrajeron de BalancingMetrics.tsx
 * para:
 *   1. Poder testearlos sin mount del componente.
 *   2. Reusar desde otros lugares (ej: export Excel, reporteria).
 *   3. Separar logica de negocio del render.
 *
 * Las funciones aca son deterministicas y no tocan estado / DOM.
 */

import { SimStation } from '../../core/balancing/engine';
import { CYCLE_RISK_THRESHOLD } from './balancingConstants';

/**
 * Calcula el Smoothness Index (SI) de una linea de estaciones.
 *
 * SI = sqrt( sum_i (T_max - T_i)^2 )
 *
 * Donde T_max es el tiempo de ciclo de la estacion mas cargada y T_i el
 * tiempo efectivo de cada estacion. SI=0 significa carga perfectamente pareja.
 *
 * Filtra NaN / Infinity defensivamente (tipico cuando el input tiene data
 * corrupta o estaciones vacias).
 *
 * @param stations Estaciones del balanceo actual
 * @returns SI >= 0. Retorna 0 si no hay tiempos validos.
 */
export function calculateSmoothnessIndex(stations: SimStation[]): number {
  if (!stations || stations.length === 0) return 0;

  const validTimes = stations
    .map(st => st.effectiveTime)
    .filter(t => typeof t === 'number' && !isNaN(t) && isFinite(t));

  if (validTimes.length === 0) return 0;

  const maxCycle = Math.max(...validTimes);

  const sumSquares = stations.reduce((sum, st) => {
    const time = st.effectiveTime;
    if (typeof time !== 'number' || isNaN(time) || !isFinite(time)) return sum;
    const diff = maxCycle - time;
    return sum + diff * diff;
  }, 0);

  return Math.sqrt(sumSquares);
}

/** Estado de factibilidad derivado del ratio ciclo/Takt. */
export type FeasibilityStatus = 'Factible' | 'Riesgo' | 'No Factible';

/**
 * Clasifica el balance en base al ratio ciclo real / Takt nominal.
 *
 *   ratio <= 1.00           -> Factible (verde)
 *   1.00 < ratio <= 1.05    -> Riesgo (amarillo)
 *   ratio > 1.05            -> No Factible (rojo)
 *
 * Si el Takt nominal es 0 (proyecto sin demanda), devuelve 'Factible' por
 * convencion (no hay base para determinar exceso).
 */
export function calculateFeasibilityStatus(
  realCycleTime: number,
  nominalTaktTime: number,
): FeasibilityStatus {
  if (nominalTaktTime <= 0) return 'Factible';

  const ratio = realCycleTime / nominalTaktTime;
  if (ratio > CYCLE_RISK_THRESHOLD) return 'No Factible';
  if (ratio > 1) return 'Riesgo';
  return 'Factible';
}

/**
 * Minimo teorico de operarios para cubrir el trabajo total en un Takt dado.
 *
 *   minHC = ceil( totalWorkContent / taktTime )
 *
 * Es un piso absoluto — cualquier balance con menos operarios no puede
 * cumplir la demanda. Se compara contra `totalHeadcount` para sugerir
 * reduccion de dotacion si hay exceso.
 */
export function calculateTheoreticalMinHeadcount(
  totalWorkContent: number,
  nominalTaktTime: number,
): number {
  if (nominalTaktTime <= 0) return 0;
  return Math.ceil(totalWorkContent / nominalTaktTime);
}

/**
 * Min/max/count de tiempos efectivos validos. Helper para la UI del
 * Crystal Box (mostrar estacion mas cargada vs menos cargada).
 */
export function getStationTimeStats(stations: SimStation[]): {
  min: number;
  max: number;
  validCount: number;
} {
  const validTimes = stations
    .map(st => st.effectiveTime)
    .filter(t => typeof t === 'number' && isFinite(t));

  if (validTimes.length === 0) {
    return { min: 0, max: 0, validCount: 0 };
  }

  return {
    min: Math.min(...validTimes),
    max: Math.max(...validTimes),
    validCount: validTimes.length,
  };
}
