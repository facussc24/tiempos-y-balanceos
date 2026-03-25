# Verificacion Final - Eliminacion de QCs Duplicados en HOs

**Fecha**: 2026-03-25
**Ejecutado por**: Script automatizado `dedup-qc.cjs`

## Resumen

| Metrica | Valor |
|---------|-------|
| QCs totales antes | 874 |
| Duplicados eliminados | 38 |
| QCs totales despues | 836 |
| Duplicados restantes | 0 |
| Desalineaciones HO-CP corregidas | 0 |

---

## TAPIZADO INSERT (21 duplicados eliminados)

| Sheet | QCs antes | Dupes eliminados | QCs despues |
|-------|-----------|------------------|-------------|
| Sheet 10 | 28 | 7 | 21 |
| Sheet 40 | 6 | 1 | 5 |
| Sheet 50 | 23 | 4 | 19 |
| Sheet 70 | 14 | 3 | 11 |
| Sheet 90 | 5 | 1 | 4 |
| Sheet 91 | 5 | 1 | 4 |
| Sheet 100 | 13 | 3 | 10 |
| Sheet 111 | 12 | 1 | 11 |

## ARMREST DOOR PANEL (8 duplicados eliminados)

| Sheet | QCs antes | Dupes eliminados | QCs despues |
|-------|-----------|------------------|-------------|
| Sheet 10 | 15 | 1 | 14 |
| Sheet 60 | 14 | 3 | 11 |
| Sheet 70 | 12 | 1 | 11 |
| Sheet 72 | 6 | 1 | 5 |
| Sheet 80 | 5 | 1 | 4 |
| Sheet 81 | 5 | 1 | 4 |

## TOP ROLL FRONT DI - DD TAOS (7 duplicados eliminados)

| Sheet | QCs antes | Dupes eliminados | QCs despues |
|-------|-----------|------------------|-------------|
| Sheet 5 | 22 | 3 | 19 |
| Sheet 10 | 18 | 4 | 14 |

## TELA ASSENTO DIANTEIRO / Telas Planas (2 duplicados eliminados)

| Sheet | QCs antes | Dupes eliminados | QCs despues |
|-------|-----------|------------------|-------------|
| Sheet 20b | 4 | 1 | 3 |
| Sheet 80 | 4 | 1 | 3 |

## Productos sin duplicados (0 cambios)

Los siguientes 13 HOs no tenian duplicados:
- PATAGONIA - FRONT HEADREST L0 (pvc)
- PATAGONIA - FRONT HEADREST L1, L2, L3
- PATAGONIA - REAR HEADREST CENTER L0 (pvc)
- PATAGONIA - REAR HEADREST CENTER L1, L2, L3
- PATAGONIA - REAR HEADREST OUTER L0 (pvc)
- PATAGONIA - REAR HEADREST OUTER L1, L2, L3
- TELAS TERMOFORMADAS

---

## Verificacion de 0 duplicados restantes

Despues de guardar los cambios, se recargaron los 17 HOs desde Supabase y se verifico que no existen duplicados (misma characteristic normalizada dentro del mismo sheet).

**Resultado: PASS - 0 duplicados restantes en 836 QCs totales.**

## Verificacion de alineacion HO-CP

Se verifico que el campo `reactionContact` de cada QC con `cpItemId` coincide con el `reactionPlanOwner` del item correspondiente en el Plan de Control.

**Resultado: PASS - 100% alineacion HO reactionContact vs CP reactionPlanOwner.**

## Nota sobre near-dupes

- **TELAS PLANAS Sheet 60**: Los controles "Realizar mas de 5 puntos..." y "Realizar menos de 5 puntos..." son condiciones opuestas ("mas" vs "menos") y se mantuvieron ambos correctamente. No son duplicados.
- **TAPIZADO INSERT Sheet 40**: El near-dupe existente fue evaluado por el algoritmo de normalizacion y solo se elimino la copia exacta.

## Algoritmo utilizado

Para cada sheet de cada HO:
1. Normalizar characteristic: trim, lowercase, colapsar espacios multiples
2. Agrupar por characteristic normalizada
3. Si hay duplicados, conservar el QC con mas campos completos
4. Eliminar los demas

Criterio de "mas campos completos": se cuentan los campos no vacios entre characteristic, specification, evaluationTechnique, frequency, controlMethod, reactionAction, reactionContact, specialCharSymbol, registro, cpItemId.
