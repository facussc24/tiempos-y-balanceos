# Auditoria HO vs CP — Sincronizacion de Controles y Frecuencias

**Fecha**: 2026-03-22
**Fuente**: Supabase produccion — 17 HOs, 18 CPs
**Productos**: 8 familias

---

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Productos con HO analizados | 8 (de 9, Insert master no tiene HO) |
| Total issues HO vs CP | 15 |
| HO sheets sin CP matching | 10 |
| Discrepancias de frecuencia | 5 |
| Productos sin issues | 5 de 8 |

**Estado general**: La sincronizacion HO↔CP es buena para la mayoria de productos. Los problemas se concentran en Armrest (frecuencias) y las Telas PWA (operaciones faltantes en CP).

---

## Detalle por Producto

### Armrest Door Panel — 5 discrepancias de frecuencia

| HO Op | QC Caracteristica | Frecuencia HO | Frecuencia CP | Diferencia |
|-------|-------------------|---------------|----------------|------------|
| 60 | Llenado Incompleto de Pieza | Inicio de turno | Inicio y fin de turno | CP mas frecuente |
| 80 | Adhesion insuficiente (x2) | Inicio y fin de turno | Inicio de turno | HO mas frecuente |
| 81 | Adhesion insuficiente (x2) | Inicio y fin de turno | Inicio de turno | HO mas frecuente |

**Analisis**: Las frecuencias estan invertidas — en OP 60 el CP es mas conservador (inicio Y fin), mientras que en OP 80/81 la HO es mas conservadora. Esto sugiere una actualizacion parcial donde no se sincronizaron todos los documentos.

**Impacto**: Medio. El operador podria seguir la HO (que tiene frecuencia diferente al CP), lo cual genera inconsistencia documental en auditorias externas.

### Insert Patagonia [L0] — 0 issues

Consistencia perfecta entre HO y CP.

### Insert Patagonia (master) — Sin HO

El AMFE master no tiene HO asociada. Las HOs estan solo en la variante [L0].

### Top Roll — 0 issues

Consistencia perfecta.

### Headrest Front/Rear Center/Rear Outer — 0 issues c/u

Consistencia perfecta en los 3 headrest masters y sus variantes.

### Telas Planas PWA — 4 HO sheets sin CP

| HO Op | Nombre HO | Estado CP |
|-------|-----------|-----------|
| 20 | Corte por maquina de pieza Central | No existe OP 20 en CP |
| 21 | Corte por maquina, Blank laterales | No existe OP 21 en CP |
| 10d | Colocado de Aplix | No existe OP 10d en CP |
| 80 | Embalaje | No existe OP 80 en CP |

**Analisis**: La HO usa sub-numeracion (10d) y operaciones especificas (20, 21) que no coinciden con la numeracion del CP. El CP agrupa estas operaciones bajo numeros diferentes. Es un problema de alineacion de numeracion, no de contenido faltante.

### Telas Termoformadas PWA — 6 HO sheets sin CP

| HO Op | Nombre HO | Estado CP |
|-------|-----------|-----------|
| 15 | Preparacion de corte | No existe en CP |
| 20 | Corte por maquina automatica | No existe en CP |
| 30 | Costura fuerte, sin arruga | No existe en CP |
| 40 | Colocado de clips | No existe en CP |
| 50 | Pegado de dots | No existe en CP |
| 60 | Inspeccion final de la pieza | No existe en CP |

**Analisis**: El CP de Telas Termoformadas usa una numeracion completamente diferente a la HO. La HO tiene 8 sheets (15, 20, 30, 40, 50, 60, 70, 80) pero el CP tiene operaciones con numeros distintos (10, 20b, 30, etc.). 6 de 8 sheets no matchean por numero de operacion.

**NOTA**: Esto NO significa que los controles no existan en el CP — significa que la numeracion entre HO y CP no esta alineada. Un analisis por contenido (no por numero) podria encontrar coincidencias.

---

## Resumen de Issues por Tipo

| Tipo | Descripcion | Cantidad | Riesgo |
|------|-------------|----------|--------|
| HO_CP_FREQ_MISMATCH | Frecuencias de QC diferentes entre HO y CP | 5 | Medio |
| HO_NO_CP | HO sheet sin operacion correspondiente en CP | 10 | Bajo-Medio |

---

## Recomendaciones

1. **Armrest**: Sincronizar frecuencias de QC entre HO y CP. Decidir si la frecuencia correcta es "Inicio de turno" o "Inicio y fin de turno" para adhesivado.
2. **Telas PWA**: Alinear la numeracion de operaciones entre HO y CP. Actualmente usan esquemas de numeracion incompatibles.
3. **General**: Cuando se actualicen frecuencias en CP, actualizar simultaneamente en HO (y viceversa).
4. **Verificacion futura**: Implementar validacion automatica de sincronizacion HO↔CP en la app (ya existe `hoCpLinkValidation.ts`).

---

## Datos completos

`docs/audit_cross_consistency_data.json` — datos de HO-CP en seccion `hoCpConsistency`
