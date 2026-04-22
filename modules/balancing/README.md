# Tiempos y Balanceos (UI)

UI del modulo de balanceo de linea. La logica pesada vive en
[`core/balancing/`](../../core/balancing/) — este modulo compone componentes,
maneja drag-drop, y renderiza metricas + grafico.

## Estructura

```
modules/balancing/
├── LineBalancing.tsx           Contenedor principal (DnD context + modals + board)
├── BalancingChart.tsx          Grafico Recharts de saturacion por estacion
├── balancingConstants.ts       Umbrales de negocio (saturacion, feasibility, canvas)
├── balancingTheme.ts           Hex literals para canvas export
├── balancingTypes.ts           SaturationDataPoint + shared types
├── balancingMetricsCalc.ts     Calculos puros (Smoothness Index, Feasibility)
├── balancingExcelFormulas.ts   Formulas Excel para export Gate3
├── balancingExcelStyles.ts     Estilos Excel
├── capacityBarChart.ts         Canvas renderer (base64 PNG → ExcelJS)
└── components/
    ├── BalancingMetrics.tsx    KPI bar + Crystal Box (formulas) + Resumen
    ├── StationCard.tsx         Tarjeta de estacion (drop zone + replicas + tasks)
    ├── UnassignedTaskList.tsx  Pool de tareas sin asignar (draggables)
    ├── OptimizationDrawer.tsx  Drawer de resultados GA
    ├── OptimizationResultsModal.tsx
    └── ZoningConstraintsModal.tsx
```

## Glosario de terminos

| Termino | Definicion |
|---|---|
| **Takt Time** | Ritmo de produccion. `tiempoDisponible / demandaDiaria` — cada cuantos segundos debe salir 1 pieza para cumplir demanda. |
| **TCR (Tiempo Ciclo Real)** | Tiempo de la estacion mas lenta. Dicta el ritmo real de la linea. Ver [`calculateEffectiveStationTime`](../../core/balancing/simulation.ts). |
| **OEE** | Overall Equipment Effectiveness. Factor 0-1 que reduce el tiempo disponible (paradas, scrap, velocidad). |
| **Takt Nominal** | Takt sin descontar OEE (100% eficiencia teorica). |
| **Takt Efectivo / Limite OEE** | Takt * OEE. Limite realista por estacion. |
| **Saturacion / Utilizacion** | `trabajoManual / (operarios × takt) × 100`. Rango ideal: 85-100% (ver `SATURATION_MIN_PCT`). |
| **Smoothness Index (SI)** | `sqrt(sum((Tmax - Ti)^2))`. 0 = carga perfectamente pareja. Umbrales: `SMOOTHNESS_OK=10`, `SMOOTHNESS_WARN=30`. |
| **Factibilidad** | `cycleRatio > CYCLE_RISK_THRESHOLD (1.05)` → No Factible. `1 < ratio <= 1.05` → Riesgo. |
| **Replicas / Multi-Manning** | N operarios en una misma estacion dividiendo carga manual (ajuste a TCR de maquina). |
| **Ghost Task** | `isMachineInternal=true`. Corre DENTRO del ciclo de maquina (ej: cooling). Contribuye 0s al TCR. |
| **Concurrent Task** | `task.concurrentWith = machineTaskId`. Tarea manual que corre en paralelo con la maquina. Dominant element: `max(tMaquina, sum(tManuales))`. |
| **Sector Affinity** | Hard constraint: tareas de un sector solo pueden asignarse a estaciones del mismo sector. |
| **SALBP-1** | Minimizar N de estaciones dado un Takt fijo. |
| **SALBP-2** | Minimizar Takt dado N de estaciones fijo (binary search). |
| **RC-ALBP** | Resource-Constrained ALBP: respeta inventario de maquinas. |

## Flujo de datos

```
useLineBalancing (hook)
  ├── calculateTaktTime → nominalSeconds, effectiveSeconds
  ├── stationData       → array de estaciones con time/limit/replicas/tasks
  ├── saturationData    → SaturationDataPoint[] (input del grafico)
  ├── metricasDerivadas → realCycleTime, efficiency, saturationVsTakt, etc.
  └── machineValidation → RC-ALBP (deficit de maquinas + conflictos)

LineBalancing (UI)
  ├── DndContext (drag-drop handlers del hook)
  ├── AlertCenter       → overload / machine deficit / OEE zone warnings
  ├── BalancingMetrics  → KPIs + Crystal Box
  ├── BalancingChart    → stacked bar Recharts
  ├── UnassignedTaskList + StationCard[]
  └── modals: Config, Zoning, ClearBalance, OptimizationResults
```

## Reglas de negocio (validadas)

- El TCR es el **maximo** entre estaciones, no la suma. Si una estacion dura 60s y el resto 30s, el ciclo es 60s.
- **Takt = ritmo objetivo**; TCR = ritmo real. TCR > Takt = no cumplis demanda.
- **Saturacion 85-100%** es saludable. <85% = exceso de operarios. >100% = deficit.
- **Smoothness Index 0-10** ideal. 10-30 tolerable. >30 requiere rebalanceo.
- **Tareas concurrentes maquina+manual** usan regla Dominant Element, no suma. Ver JSDoc en `calculateEffectiveStationTime`.
- **Replicas > 1** dividen el tiempo MANUAL (no maquina). La maquina sigue igual porque es 1 sola.

## Donde tocar que

| Que cambiar | Donde |
|---|---|
| Umbrales de saturacion / smoothness / feasibility | `balancingConstants.ts` |
| Calculo de metricas (SI, feasibility, min HC) | `balancingMetricsCalc.ts` |
| Formula de TCR con concurrencia | `core/balancing/simulation.ts:calculateEffectiveStationTime` |
| Colores del canvas Excel | `balancingTheme.ts` |
| Tipos compartidos (shape de saturationData) | `balancingTypes.ts` |
| Algoritmos GA / SALBP / RC-ALBP | `core/balancing/` (no tocar desde UI) |

## Tests

```bash
npx vitest run balanc
```

Ubicacion: `__tests__/balancing_integration.test.ts`, `validated_line_balancing.test.ts`, `cycleQuantity_balancing.test.ts`, `mix_balancing.test.ts`.

144 tests al 2026-04-22. Core coverage bueno; `BalancingChart`, `StationCard`, `UnassignedTaskList` todavia sin unit tests (pending Fase 3 de cleanup).
