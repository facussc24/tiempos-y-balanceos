---
name: Referencia Maestro de Inyeccion Plastica
description: IDs y rutas del maestro de inyeccion, CP maestro, maestro logistica, knowledge base, y propagacion cross-family
type: reference
---

# Referencia: Maestros de Inyección y Logística

## Maestro de Inyección Plástica (family 15)

- **Familia**: `product_families.id = 15`, name = "Proceso de Inyeccion Plastica"
- **AMFE Maestro**: `amfe_documents.id = 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c`, amfe_number = `AMFE-MAESTRO-INY-001`
- **CP Maestro**: `cp_documents.id = 81b60cdd-1296-4821-a348-a8e3c2433b0d`, cp_number = `CP-MAESTRO-INY-001`

### Estructura (2 operaciones, OP 10 fue movida a Logística el 2026-04-13)
- OP 20 INYECCION DE TERMOPLASTICO (10 WEs)
- OP 30 CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA (8 WEs)

## Maestro de Logística y Recepción (family 16)

Creado 2026-04-13 per AIAG CP 2024 "Procesos Interdependientes".

- **Familia**: `product_families.id = 16`, name = "Proceso de Logistica y Recepcion"
- **AMFE Maestro**: `amfe_documents.id = ef327ae0-c147-4716-ba22-601cedf5b3d1`, amfe_number = `AMFE-MAESTRO-LOG-REC-001`
- **CP Maestro**: `cp_documents.id = 34943c75-b9ad-4284-8dd6-d491d1dccf95`, cp_number = `CP-MAESTRO-LOG-REC-001`

### Estructura (1 operación)
- OP 10 RECEPCION Y PREPARACION DE MATERIA PRIMA (7 WEs, 14 causas)
- componentMaterial consolidado en 2 categorías: Pellet higroscópico + Pellet termoplástico estándar

## Knowledge base

- `.claude/rules/injection.md` — regla contextual con ambos maestros, 6M, defectos
- `docs/GUIA_INYECCION.md` — guia con conocimiento del gerente experto

## 7 AMFEs de producto con inyección sincronizada (solo OP 20 del maestro)

| AMFE | OP | Nombre |
|---|---|---|
| VWA-PAT-IPPADS-001 | 20 | INYECCION |
| AMFE-INS-PAT | 70 | INYECCION DE PIEZAS PLASTICAS |
| AMFE-TR-PAT | 10 | INYECCION DE PIEZA PLASTICA |
| AMFE-ARM-PAT | 60 | INYECCION DE PIEZAS PLASTICAS |
| AMFE-HF-PAT | 40 | INYECCION DE SUSTRATO |
| AMFE-HRC-PAT | 40 | INYECCION DE SUSTRATO |
| AMFE-HRO-PAT | 40 | INYECCION DE SUSTRATO |

**Exclusión intencional**: `AMFE-ARM-PAT OP 70 INYECCION PU` (poliuretano/espumado).

## Propagación cross-family

`core/inheritance/changePropagation.ts`:
- `propagateMasterAcrossFamilies()` — escanea AMFEs cuando se guarda un master con familyName "Proceso de..."
- Blocklist: PU, POLIURETANO, POLYURETHANE, PUR, ESPUMADO
- Alertas en `cross_doc_checks`
