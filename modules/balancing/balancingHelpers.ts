/**
 * @module balancingHelpers
 *
 * Helpers visuales/semanticos que se usaban copy-paste en varios componentes
 * del modulo balanceo. Los centraliza para que un cambio de criterio (ej:
 * umbral de saturacion "alta" de 90 a 85) no requiera actualizar 3+ archivos.
 */

import { formatNumber } from '../../utils';

// -----------------------------------------------------------------------------
// #9 Overload detection
// -----------------------------------------------------------------------------

/**
 * Una estacion esta sobrecargada si su tiempo efectivo supera el limite
 * (OEE o Takt, segun capacityLimitMode). Trivial pero centralizado para
 * que la regla sea 1 sola si cambia.
 */
export function isStationOverloaded(station: { time: number; limit: number }): boolean {
    return station.time > station.limit;
}

// -----------------------------------------------------------------------------
// #10 Replicas display (multi-manning)
// -----------------------------------------------------------------------------

/**
 * String descriptivo para tooltip/chart cuando una estacion tiene
 * multi-manning (replicas > 1). Devuelve null si replicas <= 1 para que
 * el caller no renderice nada en ese caso.
 *
 * @example
 * formatReplicasInfo(90, 3) -> "(Total: 90s ÷ 3 ops)"
 */
export function formatReplicasInfo(rawTime: number, replicas: number): string | null {
    if (replicas <= 1) return null;
    return `(Total: ${formatNumber(rawTime)}s ÷ ${replicas} ops)`;
}

// -----------------------------------------------------------------------------
// #11 Saturation color classification
// -----------------------------------------------------------------------------

export type SaturationZone = 'overload' | 'oee-risk' | 'high' | 'normal';

/**
 * Umbral (porcentaje 0-100) a partir del cual una estacion se pinta amarilla
 * aunque NO este sobrecargada. Representa riesgo por variabilidad.
 */
export const SATURATION_HIGH_PCT = 90;

/**
 * Clasifica la estacion en una de 4 zonas. El caller decide el estilo
 * (bg-status-crit / bg-status-warn / bg-accent) segun la zona. Desacopla
 * la logica de umbral del arbol de ternarios que vivia inline.
 */
export function getSaturationZone(args: {
    isOverload: boolean;
    isInOeeRiskZone: boolean;
    saturationPercent: number;
}): SaturationZone {
    if (args.isOverload) return 'overload';
    if (args.isInOeeRiskZone) return 'oee-risk';
    if (args.saturationPercent > SATURATION_HIGH_PCT) return 'high';
    return 'normal';
}
