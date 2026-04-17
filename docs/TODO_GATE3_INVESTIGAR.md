# TODO — Investigar a fondo el adapter Gate 3

Detectado durante export del proyecto 16 (VWA PATAGONIA, Inyeccion PU Armrest+APB) el 2026-04-17.

## Bugs preexistentes en el adapter de la app

Vive en `modules/gate3/gate3FromBalancing.ts` (funcion `buildGate3FromProjectData`).

### Bug 1 — Ciclo incluye tareas manuales en estaciones de inyeccion

**Codigo actual** (simplificado):
```ts
let effective = calculateEffectiveStationTime(stationTasks);  // SUMA todas las tasks
const cycleTime = effective / replicas;
```

**Problema**: para estaciones de inyeccion batch (ej. OP 20), el ciclo efectivo del
Gate 3 VW es el **ciclo de maquina** (`injectionParams.realCycle`), no la suma de
tiempos de todas las tasks de la estacion. Las tareas manuales (desmoldante,
retirar, traslado, refilado, sellado, embalaje) se solapan con el curado del
molde (`pCuringTime`) y no son cuello de botella — la maquina sigue inyectando.

**Impacto verificado en proyecto 16**:
- cycleTime mal calculado: 60.08 s (suma de 7 tasks)
- cycleTime correcto: 31.44 s (injectionParams.realCycle, 283s/9cav)
- Capacidad reportada: 26.100 pzs/sem (OEE 45%)
- Capacidad real: 49.875 pzs/sem (OEE 45%) — casi el doble

**Fix temporal aplicado en `scripts/_exportProjectGate3VW.mjs`**:
si la estacion tiene una task con `executionMode === 'injection'`, usar
`injectionParams.realCycle` como `cycleTime` unico, ignorando el resto de
tasks de la estacion.

### Bug 2 — Offset de 1 dia en fecha

**Codigo actual** (simplificado):
```ts
const d = new Date(meta.date);
return `${DD}/${MM}/${YYYY}`;  // local
```

**Problema**: `new Date("2026-03-20")` parsea como UTC medianoche; en timezone
Argentina (UTC-3) queda `2026-03-19 21:00` local → DD=19. El Excel mostraba
19/03 cuando `meta.date = 2026-03-20`.

**Fix temporal aplicado en script**: parsear `YYYY-MM-DD` con regex
directamente, sin construir `Date`.

## Que investigar a fondo

1. **Validar con gerente**: en procesos NO-batch (injectionMode!=='batch') ¿el
   ciclo es el tiempo de maquina o el total del operador? El fix del script
   asume que TODA inyeccion es batch.

2. **Revisar `calculateEffectiveStationTime`** en `core/balancing/simulation.ts` —
   puede que otros modulos (flow-simulator, balancingAdapter) tengan el mismo bug.

3. **Revisar que `gate3FromBalancing.ts` tenga el mismo fix** cuando se exporta
   desde la UI — de lo contrario Fak obtendra numeros distintos segun donde
   haga click (CavityCalculator vs script Node).

4. **Tiempos manuales paralelos vs. seriales**: en inyeccion batch, `manualInteractionTime`
   dentro de `injectionParams` ya representa el tiempo de operador solapado al
   curado. Investigar si hay casos donde el operador supera el `pCuringTime`
   (entonces el operador se vuelve cuello de botella y el ciclo = max(maquina, manual),
   no solo maquina).

5. **Zonas horarias en toda la app**: buscar otros `new Date(iso)` sobre strings
   YYYY-MM-DD que puedan tener el mismo offset. Posibles candidatos:
   - `modules/gate3/gate3ExcelExport.ts`
   - `utils/dateHelpers.ts` (si existe)
   - Cualquier export a Excel/PDF con fecha.

6. **Confirmar con un proyecto de NO-inyeccion** (ej. costura, tapizado) que
   el fix no rompa nada — esas estaciones siguen usando suma de tasks.

## Referencias

- Backup pre-OEE: `backups/projects/project_16_2026-04-17T13-44-13_pre_oee_update.json`
- Export afectado: `~/Documents/CapacityCheck_Inyeccion_PU_Armrest_Rear_y_APB_Puerta_Rev_A_OEE45pct.xlsx`
- Auditor report: conversacion Claude sesion 2026-04-17 ("lanza un agente independiente").
