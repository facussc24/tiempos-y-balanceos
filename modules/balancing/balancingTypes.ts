/**
 * @module balancingTypes
 *
 * Tipos compartidos del modulo Tiempos y Balanceos. Evita `any` en props
 * de componentes y retornos de hooks.
 */

import type { ManualOperation } from '../../types/sectors';

/**
 * Punto del dataset de saturacion consumido por BalancingChart (Recharts)
 * y construido por `useLineBalancing`. Cada entry representa una estacion
 * visible en el grafico de barras apiladas.
 */
export interface SaturationDataPoint {
  /** Label visible en eje X (ej: "Est. 3") */
  name: string;
  /** ID numerico de la estacion (para ordenamiento estable) */
  stationId: number;

  // Segmentos del stacked bar (segundos)
  /** Porcion de ciclo dentro del limite OEE/Takt */
  withinLimit: number;
  /** Exceso sobre limite (pinta rojo) */
  overload: number;
  /** Tiempo concurrente absorbido por tareas ghost (isMachineInternal) */
  absorbed: number;
  /** Capacidad ociosa residual hasta el limite */
  idle: number;

  // Referencias
  /** Tiempo total efectivo crudo (antes de division por replicas) */
  totalTime: number;
  /** Limite OEE/Takt de la estacion */
  limit: number;
  /** Takt nominal del proyecto (linea de referencia global) */
  nominal: number;
  /** Replicas / multi-manning */
  replicas: number;
  /** Tiempo efectivo crudo sin dividir por replicas */
  rawEffective: number;

  // Estilo
  /** Fill hex del segmento withinLimit — color del sector */
  barColor: string;
  /** Nombre del sector (para tooltip y agrupacion de barras) */
  sectorName: string;
  /** ID del sector — vacio si la estacion esta en "General" */
  sectorId: string;

  // Phase 3 (inyeccion)
  curingTime: number;
  injectionTime: number;
  curingOperations: { name: string; type: 'internal' | 'external'; time: number }[];

  /** Takt per-sector cuando hay shiftOverride — undefined si se usa el global */
  sectorTakt: number | undefined;
}

// Re-export por comodidad para consumidores del modulo
export type { ManualOperation };
