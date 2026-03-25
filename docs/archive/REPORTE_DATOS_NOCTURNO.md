# Reporte de Consistencia de Datos en Supabase — 2026-03-22

## Conteo de Entidades

| Entidad | Cantidad | Esperado | Estado |
|---------|----------|----------|--------|
| Product Families | 8 | 8 | OK |
| AMFE Documents | 18 | 18 | OK |
| CP Documents | 18 | 18 | OK |
| HO Documents | 17 | 17 | OK |
| PFD Documents | 9 | 9 | OK |
| Family Members | 33 | - | OK |
| Family Documents | 62 | 62 | OK |
| **Total Docs APQP** | **62** | **62** | **OK** |

## Verificacion de Integridad

| Check | Resultado |
|-------|-----------|
| Duplicados AMFE (por amfe_number) | 0 — OK |
| Duplicados CP (por control_plan_number) | 0 — OK |
| Huerfanos en family_members | 0 — OK |
| Huerfanos en family_documents (por familia) | 0 — OK |
| Huerfanos en family_documents (por documento) | 0 — OK |

## Frecuencias en Plan de Control

### Frecuencias time-based (NO deberian existir)

| Patron buscado | Resultado |
|----------------|-----------|
| "cada hora" | **1 match** — CP-TOPROLL-001 |
| "cada 2 horas" | **1 match** — CP-TOPROLL-001 |
| "cada 3 horas" | 0 — OK |
| "cada 10 piezas" | 0 — OK |

### Hallazgo: CP-TOPROLL-001 tiene frecuencias time-based

El documento CP-TOPROLL-001 (id: `69f6daf9-f2aa-49bd-a70a-ff1b02fcec0d`) todavia contiene strings de frecuencia basada en tiempo ("cada hora", "cada 2 horas") en su data JSON. Esto deberia haber sido limpiado en la migracion a frecuencias event-based.

**Nota**: NO se corrigio — solo lectura segun las reglas de la auditoria.

## Frecuencias en Hojas de Operaciones

| Patron buscado | Resultado |
|----------------|-----------|
| "cada hora" | 0 — OK |
| "cada 2 horas" | 0 — OK |
| "cada 3 horas" | 0 — OK |
| "cada 10 piezas" | 0 — OK |

Las HO estan limpias de frecuencias time-based.

## Resumen

- **Conteos**: 100% correctos, 8 familias, 62 documentos APQP
- **Integridad**: 0 duplicados, 0 huerfanos
- **Frecuencias CP**: 1 documento (CP-TOPROLL-001) con frecuencias time-based residuales
- **Frecuencias HO**: Limpias, 100% event-based

## Acciones Recomendadas

1. **Limpiar CP-TOPROLL-001**: Actualizar las frecuencias time-based a event-based en una sesion futura
