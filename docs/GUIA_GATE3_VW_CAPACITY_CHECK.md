# Guía Gate 3 VW Capacity Check — metodología de cálculo de capacidad

**Versión**: 1.0 — 2026-04-17
**Autor**: Barack Mercosul (proceso de industrialización APQP)
**Contexto**: documento generado tras incidente en export de proyecto 16 (VWA PATAGONIA). Sirve de referencia para futuros exports y para verificación cruzada entre el módulo "Tiempos y Balanceos" y el Excel oficial VW Gate 3.

---

## 1. Qué es el Gate 3 Capacity Check

Formato oficial de VW (Volkswagen) usado en fase de industrialización para verificar que la línea del proveedor tiene capacidad suficiente para cubrir la demanda del programa. Barack lo usa como entregable de Gate 3 en proyectos con VWA (Volkswagen Argentina, planta Pacheco).

Archivo template: `src/assets/templates/gate3_template.xlsx`. 8 hojas, 3 visibles al proveedor: `CapacitySFN` (hoja principal), `OEE CalculatorSFN` (cálculo de eficiencia), `DiagramSFN` (gráfico comparativo).

---

## 2. Fórmula maestra

La hoja `CapacitySFN` calcula la capacidad semanal por estación con esta fórmula:

```
pcs/semana = shifts_per_week × hours_per_shift × 3600
             ÷ cycleTime
             × cavities
             × OEE
             × reservation_pct
             × machines_in_parallel
```

Donde:
- **shifts_per_week**: turnos semanales (ej. 15 = 3 turnos × 5 días)
- **hours_per_shift**: horas netas por turno (sin descansos)
- **cycleTime** (seg): **tiempo de UN CICLO COMPLETO DE MÁQUINA**. Para inyección: tiempo desde que se cierra el molde hasta que se abre y salen TODAS las cavidades juntas.
- **cavities**: piezas que salen en cada ciclo (multiplicador).
- **OEE**: eficiencia global (0..1).
- **reservation_pct**: porcentaje del tiempo dedicado a este proyecto (0..1).
- **machines_in_parallel**: inyectoras / estaciones en paralelo que hacen lo mismo.

---

## 3. Interpretación crítica de `cycleTime`

**Esta es la pregunta que más confusión genera**:

> En inyección con molde multicavidad, ¿el "cycleTime" del Gate 3 es el tiempo por pieza o el tiempo del molde?

**Respuesta**: el tiempo del **molde completo**.

Ejemplo: un molde de 9 cavidades que tarda 283 s en hacer un ciclo (inyección + curado + expulsión).
- Tiempo por pieza individual: 283 / 9 = 31.44 s
- **Tiempo que va al Gate 3 `cycleTime`: 283 s**
- Cavidades: 9
- Piezas/hora: 3600 / 283 × 9 = 114.5

Si se ingresa `cycleTime = 31.44` y `cavities = 9`, el Gate 3 calcula 3600/31.44 × 9 = **1031 pzs/hora**, lo cual es imposible (el molde no produce 9 piezas cada 31 s, produce 9 piezas cada 283 s). Doble conteo de cavidades.

### Regla mnemotécnica

> `3600 / cycleTime` = ciclos de máquina por hora
> × cavidades = piezas por hora
> Entonces `cycleTime` TIENE que ser el tiempo del ciclo, no el tiempo por pieza.

---

## 4. Qué campo usar según el tipo de proceso

| Tipo de proceso | `cycleTime` | `cavities` |
|---|---|---|
| **Inyección batch** (molde multicavidad) | Tiempo completo del ciclo de molde (p. ej. `injectionParams.realCycle × optimalCavities`) | Cavidades del molde |
| **Inyección serial** (1 cavidad) | Tiempo del ciclo | 1 |
| **Costura** | Tiempo total de la operación en 1 puesto | 1 (no hay cavidades) |
| **Tapizado** | Tiempo total | 1 |
| **Corte** | Tiempo por tendido | Capas por corte |
| **Troquelado** | Tiempo por golpe | Cavidades del troquel |
| **Pintura** | Tiempo por jig | Piezas por jig |
| **Mecanizado** | Tiempo por pallet | Piezas por pallet |
| **Embalaje** | Tiempo por operación | Piezas por bulto |
| **Soldadura / ensamble / inspección** | Tiempo total operación | 1 |

En procesos donde "cavidades no aplica" (costura, soldadura, etc.), se fuerza `cavities = 1` y el label en el Excel se cambia adaptativamente (ej. "Puestos de costura" en vez de "Cavidades del molde").

---

## 5. Tareas manuales en estaciones de inyección

**¿Las tareas manuales (aplicar desmoldante, retirar piezas, traslado, refilado, sellado, embalaje) se suman al `cycleTime`?**

**NO** — en inyección batch, el operador ejecuta esas tareas **mientras el molde está curando** (el `pCuringTime` es típicamente 190-200 s de 283 s totales). El tiempo de máquina es el cuello de botella, las tareas manuales se solapan.

### Excepción

Si `sum(tareas manuales) > pCuringTime`, el operador pasa a ser cuello de botella. En ese caso:
```
cycleTime_efectivo = max(ciclo_de_máquina, tiempo_manual_total)
```

Pero es raro — en un proyecto típico las tareas manuales son ~25-35 s mientras el curado es 190+ s.

---

## 6. Ejemplo numérico — Proyecto 16 (Inyección PU Armrest Rear + APB Puerta)

### Datos de entrada (desde `projects.data` del proyecto 16)

```
meta.activeShifts = 3
meta.dailyDemand = 1770 piezas
meta.manualOEE = 0.45
meta.date = "2026-03-20"

shifts[0].length = 480 min | breaks = 45 min → neto 435 min
shifts[1].length = 480 min | breaks = 45 min → neto 435 min
shifts[2].length = 480 min | breaks = 60 min → neto 420 min
(total neto = 1290 min/día = 21.5 h/día)

tasks[20] (Inyección de PU):
  executionMode = "injection"
  times = [283, 283, 283, 283, 283]  ← ciclo completo del molde
  injectionParams:
    realCycle = 31.44  ← tiempo por pieza (283/9)
    optimalCavities = 9
    pInyectionTime = 10
    pCuringTime = 193
    manualInteractionTime = 25.06
    injectionMode = "batch"
```

### Cálculo Gate 3

```
cycleTime   = realCycle × cavidades = 31.44 × 9 = 283 s (molde)
cavidades   = 9
turnos/sem  = 3 × 5 = 15
horas/turno = (1290 / 3) / 60 = 7.17 h
OEE         = 0.45
reserva     = 1.0
máquinas    = 1

pcs/semana  = 15 × 7.17 × 3600 ÷ 283 × 9 × 0.45 × 1 × 1
            = 387.180 ÷ 283 × 9 × 0.45
            = 1368 × 9 × 0.45
            = 12.313 × 0.45
            = 5.541 pzs/semana
```

### Demanda y cobertura

```
Demanda semanal = 1770 × 5 = 8850 pzs/sem
Capacidad semanal = 5541 pzs/sem
Cobertura = 5541 / 8850 = 0.63× → SOBRECARGA
Faltante = 3309 pzs/sem (37%)
```

### Escenarios para cubrir la demanda

1. **Mejorar OEE** de 0.45 a 0.72 → 5541 × (0.72/0.45) = 8866 pzs/sem → cubierto (ajustado).
2. **Agregar una segunda máquina en paralelo** → 5541 × 2 = 11.082 pzs/sem (sobrado).
3. **Agregar un turno sábado** → 5541 × (6/5) = 6649 pzs/sem (aún sobrecarga).
4. **Reducir ciclo de máquina** (típicamente optimizando curado) → si baja de 283 a 177 s → 5541 × (283/177) = 8858 pzs/sem (cubierto justo).

---

## 7. Relación con el módulo "Tiempos y Balanceos" de la app Barack

El módulo de balanceo de línea usa **la misma fórmula** internamente para calcular takt, utilización y señalar sobrecarga. Los dos deben dar resultados coherentes.

### Si el Excel Gate 3 y el módulo balanceo NO coinciden

Es un bug del **adapter que exporta** (`modules/gate3/gate3FromBalancing.ts` en la UI, o el script `scripts/_exportProjectGate3VW.mjs`). El módulo balanceo es la fuente de verdad — si ahí aparece sobrecarga, **aparece sobrecarga**.

### Campos del `Project.data` que alimentan el Gate 3

| Campo Gate 3 | Campo en `Project.data` | Notas |
|---|---|---|
| partNumber / partDesignation | `meta.name` | Nombre de la pieza |
| project | `meta.project` (o `project_code`) | Código del programa (ej. PATAGONIA) |
| supplier | "Barack Mercosul" | Fijo |
| location | "Hurlingham, Buenos Aires, Argentina" | Fijo (sede única) |
| date | `meta.date` | Fecha de revisión |
| shifts_per_week | `meta.activeShifts × 5` | Asume 5 días laborales |
| hours_per_shift | `totalAvailMin / activeShifts / 60` | Promedio de horas netas |
| cycleTime | `realCycle × optimalCavities` | **¡No el realCycle solo!** |
| cavities | `injectionParams.optimalCavities` | Para inyección |
| OEE | `meta.manualOEE` (si `useManualOEE=true`) | Override manual |
| machines_in_parallel | `stationConfigs[].replicas` | |
| reservation | 1.0 por defecto | Se edita manualmente si compartido con otro proyecto |

---

## 8. Checklist de validación antes de entregar un Gate 3

Antes de mandar el Excel al cliente VW:

- [ ] Verificar que el ciclo que aparece en el Excel coincide con `times[0]` de la task de inyección en el proyecto de balanceo.
- [ ] Verificar que la capacidad semanal del Excel coincide con lo que calcula el módulo balanceo (idealmente con el reporte interno de capacidad).
- [ ] Si el módulo balanceo señala sobrecarga, el Excel también debe señalarla (comparando capacidad vs demanda × 1.15 de flexibilidad que pide VW).
- [ ] Confirmar OEE usado (¿es el del proyecto? ¿es el global validado con gerencia?).
- [ ] Fecha correcta (no la de hoy, la de revisión del proyecto).
- [ ] Proveedor: "Barack Mercosul", ubicación: Hurlingham.
- [ ] Logo Barack (no VW), textos en español.
- [ ] Sin `#¡DIV/0!` visibles (formulas envueltas con IFERROR en estaciones vacías).

---

## 9. Referencias

- Template: `src/assets/templates/gate3_template.xlsx`
- Export script: `scripts/_exportProjectGate3VW.mjs`
- Validator: `scripts/_validateGate3Export.mjs`
- Adapter app: `modules/gate3/gate3FromBalancing.ts` (tiene el mismo bug preexistente — TODO)
- Fórmulas internas: `core/balancing/simulation.ts` (`calculateEffectiveStationTime`, `calculateTaktTime`)
- Backlog de fixes: `docs/TODO_GATE3_INVESTIGAR.md`
- Memoria Claude: `.claude/projects/.../memory/reference_gate3_export.md`
