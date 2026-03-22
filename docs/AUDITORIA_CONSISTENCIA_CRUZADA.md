# Auditoria de Consistencia Cruzada PFD - AMFE - CP

**Fecha**: 2026-03-22
**Fuente**: Supabase produccion — 9 PFDs, 18 AMFEs, 18 CPs
**Productos**: 8 familias + 1 variante (Insert [L0])

---

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Familias analizadas | 9 |
| Issues PFD→AMFE (pasos PFD sin AMFE) | 40 |
| Issues AMFE→PFD (ops AMFE sin PFD) | 8 |
| Issues AMFE→CP (CC/SC sin cobertura CP) | 90 |
| Issues CP→PFD (ops CP sin PFD) | 14 |
| **Total issues cross-consistency** | **152** |

### Hallazgo principal

**90 causas SC del AMFE Insert master (AMFE-00001) no tienen cobertura en su Plan de Control.** Esto representa el 60% de todas las issues. El Insert [L0] (variante) SI tiene cobertura completa (0 AMFE_CC_NO_CP). Esto sugiere que el CP del master no fue actualizado cuando se agregaron nuevas causas SC al AMFE.

---

## Detalle por Producto

### Insert Patagonia (master — VWA/PATAGONIA/INSERTO)

**Docs**: AMFE=1, CP=1, PFD=1, HO=0
**Issues**: 95 (90 AMFE_CC_NO_CP + 4 PFD_NO_AMFE + 1 AMFE_NO_PFD)

#### PFD sin AMFE (4)
- OP 51 "ALMACENAMIENTO EN MEDIOS WIP" (x2, duplicado en PFD) — almacenamiento no requiere AMFE necesariamente
- OP 104 "REPROCESO: PUNTADA FLOJA" (x2, duplicado en PFD) — reprocesos: baja prioridad para AMFE

#### AMFE sin PFD (1)
- OP 105 "REFILADO POST-TAPIZADO" — operacion en AMFE sin paso equivalente en el PFD

#### AMFE CC/SC sin CP (90)
**CRITICO**: 90 causas con clasificacion SC en el AMFE master no tienen items correspondientes en el Plan de Control. Esto viola el principio AIAG de que toda caracteristica critica/significativa del AMFE debe estar controlada en el CP.

### Insert Patagonia [L0] (variante)

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 6 (4 PFD_NO_AMFE + 1 AMFE_NO_PFD + 1 CP_NO_PFD)
**AMFE CC/SC sin CP**: 0 — cobertura completa

### Armrest Door Panel

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 0 cross-consistency
**Estado**: Consistencia perfecta entre PFD, AMFE y CP

### Top Roll

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 4 (2 AMFE_NO_PFD + 2 CP_NO_PFD)

- OP 11 "ALMACENAMIENTO EN MEDIOS WIP" — en AMFE y CP pero no en PFD
- OP 80 "INSPECCION FINAL Y EMPAQUE" — en AMFE y CP pero no en PFD

Impacto bajo: las operaciones existen en AMFE+CP, solo falta agregarlas al PFD.

### Headrest Front

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 8 (5 PFD_NO_AMFE + 3 CP_NO_PFD)

PFD steps sin AMFE (operaciones de soporte/reproceso):
- OP 100 "CLASIFICACION Y SEGREGACION DE PNC"
- OP 110 "REPROCESO: ELIMINACION DE HILO SOBRANTE"
- OP 111 "REPROCESO: PUNTADA FLOJA"
- OP 112 "REPROCESO: ELIMINACION DE ARRUGAS EN HORNO"
- OP 120 "EMBALAJE Y ETIQUETADO"

CP sin PFD (3): operaciones de costura (30, 31) y embalaje

### Headrest Rear Center / Rear Outer

**Issues**: 9 c/u (6 PFD_NO_AMFE + 3 CP_NO_PFD)
Mismo patron que Headrest Front con la adicion de:
- OP 80 "CURADO Y ESTABILIZACION DE ESPUMA" — en PFD pero no en AMFE

### Telas Planas PWA

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 12 (6 PFD_NO_AMFE + 4 AMFE_NO_PFD + 2 CP_NO_PFD)

Inconsistencias significativas en numeracion:
- PFD tiene OP 15 "PREPARACION DE CORTE", OP 25 "CONTROL CON MYLAR" que no estan en AMFE
- AMFE tiene OP 10b, 10c, 20b (sub-operaciones con letras) que no estan en PFD
- Operaciones de control final/reproceso del PFD no estan en AMFE

### Telas Termoformadas PWA

**Docs**: AMFE=1, CP=1, PFD=1, HO=1
**Issues**: 9 (todos PFD_NO_AMFE)

El PFD tiene 9 pasos que no estan en el AMFE:
- OP 25, 80, 90, 110, 111, 112, 113, 120, 130

**NOTA**: Este AMFE es el mas compacto de todos (8 operaciones). El PFD tiene 21 pasos. Muchas operaciones de soporte del PFD no tienen analisis de riesgo en el AMFE.

---

## Patrones Sistematicos

### 1. Operaciones de almacenamiento WIP (PFD sin AMFE)
Las operaciones de "ALMACENAMIENTO EN MEDIOS WIP" aparecen en los PFDs pero generalmente no tienen operaciones AMFE dedicadas. Esto es aceptable si los riesgos de almacenamiento estan cubiertos en la operacion previa.

### 2. Operaciones de reproceso (PFD sin AMFE)
Los pasos de reproceso (eliminacion de hilo, puntada floja, arrugas) aparecen en PFDs pero no todos estan en AMFE. Idealmente deberian tener analisis de riesgo AMFE si involucran manipulacion que puede generar nuevos defectos.

### 3. Sub-operaciones con letras (AMFE sin PFD)
Operaciones como 10b, 10c, 20b en el AMFE usan sub-numeracion que no existe en el PFD. Esto es un problema de granularidad — el AMFE es mas detallado que el PFD.

### 4. Insert master vs [L0] variante
El master tiene 90 causas SC sin CP pero la variante [L0] tiene cobertura completa. Esto sugiere que el CP del master se quedo desactualizado cuando se enriquecio el AMFE con mas causas.

---

## Mapa de Consistencia

| Producto | PFD→AMFE | AMFE→PFD | AMFE→CP | CP→PFD |
|----------|----------|----------|---------|--------|
| Insert (master) | 4 gaps | 1 gap | **90 gaps** | 0 |
| Insert [L0] | 4 gaps | 1 gap | **0** | 1 gap |
| Armrest | **0** | **0** | **0** | **0** |
| Top Roll | 0 | 2 gaps | 0 | 2 gaps |
| HR Front | 5 gaps | 0 | 0 | 3 gaps |
| HR Rear Center | 6 gaps | 0 | 0 | 3 gaps |
| HR Rear Outer | 6 gaps | 0 | 0 | 3 gaps |
| Telas Planas | 6 gaps | 4 gaps | 0 | 2 gaps |
| Telas Termo | 9 gaps | 0 | 0 | 0 |

**Mejor**: Armrest — consistencia perfecta
**Peor**: Insert master — 90 causas SC sin CP

---

## Recomendaciones

1. **URGENTE**: Regenerar el CP del Insert master desde el AMFE actualizado (90 causas SC sin cobertura)
2. **IMPORTANTE**: Agregar al PFD de Top Roll las operaciones 11 (almacenamiento WIP) y 80 (inspeccion final)
3. **DESEABLE**: Agregar operaciones de reproceso al AMFE de headrests si involucran riesgos de calidad
4. **INFORMATIVO**: Las discrepancias PFD↔AMFE en operaciones de soporte (almacenamiento, clasificacion PNC) son de bajo riesgo pero deberian documentarse formalmente

---

## Datos completos

`docs/audit_cross_consistency_data.json` — datos estructurados con todas las issues
