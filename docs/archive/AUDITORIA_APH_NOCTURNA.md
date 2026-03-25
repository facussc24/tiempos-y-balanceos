# Auditoria AP=H Nocturna — 2026-03-22

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Documentos AMFE analizados | 18 |
| Total causas en sistema | 1,112 |
| Total causas AP=H | 304 |
| AP=H correctas (segun AIAG-VDA 2019) | 157 (51.6%) |
| AP=H infladas (deberian ser M) | 147 (48.4%) |
| AP=H sin accion correctiva | 0 (100% tienen acciones) |
| AP=H con S<=4 (severidad baja) | 2 |
| AP=H con S/O/D incompleto | 0 |
| Consistencia DB (ap_h_count) | 100% coincide |

## Hallazgo Principal

**147 de 304 causas AP=H (48.4%) estan clasificadas como H pero segun la tabla AIAG-VDA 2019 deberian ser M (Medium).** Esto indica una sobre-clasificacion sistematica del riesgo.

**Nota importante**: Todas las 304 causas AP=H tienen acciones correctivas asignadas (preventionAction y/o detectionAction), lo cual es positivo desde el punto de vista de compliance.

## Analisis de Causas con Severidad Baja (S<=4) marcadas AP=H

Solo 2 causas tienen S<=4 con AP=H — ambas del Inserto (master y variante L0):

| AMFE | Operacion | Causa | S | O | D | AP esperado |
|------|-----------|-------|---|---|---|-------------|
| AMFE-00001 | 103 REPROCESO: FALTA DE ADHESIVO | No existe plantilla o mascara de proteccion... | 4 | 7 | 8 | M |
| AMFE-00001 [L0] | 103 REPROCESO: FALTA DE ADHESIVO | No existe plantilla o mascara de proteccion... | 4 | 7 | 8 | M |

**Veredicto**: Con S=4, O=7, D=8 la tabla AIAG-VDA da AP=M, no H. La clasificacion es incorrecta pero el impacto es menor (solo 2 causas, no son safety-critical).

## Desglose por Documento

| AMFE | Proyecto | AP=H Total | Correctas | Infladas | Sin Accion | DB Count |
|------|----------|-----------|-----------|----------|------------|----------|
| AMFE-00001 | VWA/PATAGONIA/INSERTO | 69 | 52 | 17 | 0 | 69 |
| AMFE-00001 [L0] | VWA/PATAGONIA/INSERT [L0] | 75 | 52 | 23 | 0 | 75 |
| AMFE-151 | VWA/PATAGONIA/HEADREST_FRONT | 6 | 1 | 5 | 0 | 6 |
| AMFE-153 | VWA/PATAGONIA/HEADREST_REAR_CEN | 6 | 1 | 5 | 0 | 6 |
| AMFE-155 | VWA/PATAGONIA/HEADREST_REAR_OUT | 6 | 1 | 5 | 0 | 6 |
| AMFE-ARMREST-001 | VWA/PATAGONIA/ARMREST_DOOR_PANEL | 41 | 26 | 15 | 0 | 41 |
| AMFE-HR-FRONT-L1 | VWA/PATAGONIA/HEADREST_FRONT [L1] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-FRONT-L2 | VWA/PATAGONIA/HEADREST_FRONT [L2] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-FRONT-L3 | VWA/PATAGONIA/HEADREST_FRONT [L3] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_CEN-L1 | VWA/PATAGONIA/HEADREST_REAR_CEN [L1] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_CEN-L2 | VWA/PATAGONIA/HEADREST_REAR_CEN [L2] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_CEN-L3 | VWA/PATAGONIA/HEADREST_REAR_CEN [L3] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_OUT-L1 | VWA/PATAGONIA/HEADREST_REAR_OUT [L1] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_OUT-L2 | VWA/PATAGONIA/HEADREST_REAR_OUT [L2] | 6 | 1 | 5 | 0 | 6 |
| AMFE-HR-REAR_OUT-L3 | VWA/PATAGONIA/HEADREST_REAR_OUT [L3] | 6 | 1 | 5 | 0 | 6 |
| AMFE-PWA-112 | PWA/TELAS_PLANAS | 16 | 2 | 14 | 0 | 16 |
| AMFE-PWA-113 | PWA/TELAS_TERMOFORMADAS | 1 | 0 | 1 | 0 | 1 |
| AMFE-TOPROLL-001 | VWA/PATAGONIA/TOP_ROLL | 30 | 13 | 17 | 0 | 30 |

## Patrones de Inflacion Identificados

### Patron 1: S=6-7 con O=4-7 y D=4-7 (zona gris)
La mayoria de causas infladas caen en combinaciones donde la tabla AIAG-VDA da M pero fueron marcadas H. Ejemplo tipico: S=7, O=5, D=5 → tabla da M, marcado H.

### Patron 2: Headrests (variantes heredan clasificacion del master)
Todos los AMFE de headrest tienen exactamente el mismo patron: 6 AP=H, 1 correcta, 5 infladas. Esto se propaga por herencia maestro→variante.

### Patron 3: Causas raiz en Recepcion MP
Las causas "Proveedor sin sistema robusto de trazabilidad" (S=8, O=6, D=4) y "No se utiliza el sistema ARB" (S=8, O=6, D=4) aparecen en todos los headrests. S=8, O=6, D=4: la tabla da M (O<=3 && D<=4 → M, pero O=6 no califica), verificacion: O=6 >= 7? No. D=4 >= 7? No. Cae en else → M.

### Patron 4: S=9 con O/D bajos
AMFE-TOPROLL-001, Op 80: S=9, O=2, D=2 → tabla da M (O<=2 && D<=3 → M). Clasificada como H, pero es correctamente M segun la tabla.

## Combinaciones S/O/D mas frecuentes en causas infladas

| S | O | D | AP esperado | Cantidad | % del total infladas |
|---|---|---|-------------|----------|---------------------|
| 6 | 6 | 6 | M | 38 | 25.9% |
| 8 | 6 | 4 | M | 20 | 13.6% |
| 6 | 7 | 6 | M | 15 | 10.2% |
| 7 | 5 | 5 | M | 10 | 6.8% |
| 7 | 5 | 7 | M | 8 | 5.4% |
| 7 | 4 | 6 | M | 7 | 4.8% |
| 7 | 5 | 6 | M | 5 | 3.4% |
| Otras | - | - | M | 44 | 29.9% |

## Conclusiones

1. **Acciones correctivas: COMPLETO** — 100% de las causas AP=H tienen al menos una accion (preventiva o detectiva)
2. **Clasificacion AP: 48.4% infladas** — es un problema sistematico, no puntual. El calculo de AP en la app (apTable.ts) es correcto segun AIAG-VDA 2019, pero los datos cargados manualmente o por seed scripts no recalcularon el AP con la tabla correcta
3. **Severidad baja con AP=H: 2 casos** — impacto minimo, ambos en Inserto (S=4)
4. **Herencia amplifica el problema** — cada AP inflada en un AMFE master se propaga a 3 variantes

## Recomendacion

**NO corregir automaticamente los AP en los datos** — esto cambiaria el contenido de documentos APQP que pueden estar bajo revision formal. Se recomienda:
1. Informar al responsable de calidad sobre las 147 causas infladas
2. Recalcular AP en la proxima revision formal de cada AMFE
3. Verificar que la UI usa `calculateAP()` de `apTable.ts` para nuevas causas (ya lo hace)
