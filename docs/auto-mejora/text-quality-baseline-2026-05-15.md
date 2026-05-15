# Baseline AMFE — Calidad textual 6M (auditor L2 primera corrida)

**Fecha:** 2026-05-15
**Plan ejecutado:** `~/.claude/plans/warm-plotting-snowflake.md` (Fase 2)
**Auditor:** `scripts/_auditTextQuality.mjs` (nuevo)
**Fuente:** Supabase live (regla `verify-supabase-live.md`)
**Detalle completo:** `docs/auto-mejora/text-quality-findings.md` + `tmp/text_quality_audit.json`

## Resumen global

| Métrica | Valor |
|---|---|
| AMFEs auditados | 12 |
| AMFEs con findings | 12 / 12 (100%) |
| CRITICAL | 0 |
| WARNING | 121 |
| Exit code | 0 (warnings solo, no bloqueo) |

## Por tipo de check

| Tipo | Count | Acción sugerida |
|---|---|---|
| FN_NO_VERB | 95 | Mayormente ruido — frases tipo "Material resiste intemperie" o "Pieza identificada segun VW 10500" son descriptores válidos en Barack. Revisar caso por caso. |
| OP_FUNCTION_SEMANTIC_MISMATCH | 11 | Revisar manualmente. Caso emblemático Fak: COSTURA VISTA con operationFunction tipo "Unir partes". |
| FN_TOO_SHORT | 9 | Confirma baseline 2026-05-15 — fixes propuestos cross-ref ya identificados (ESPUMADO, COSTURA UNION, CORTE DE PANELES). |
| WE_NAME_FOREIGN_TYPE | 5 | Confirma baseline — Cuchilla en Material (HF-PAT, INS-PAT), procedimientos en Machine, etc. |
| FN_ALL_CAPS_SHORT | 1 | "CORTE DE PANELES" en HF-PAT (ya identificado en baseline). |

## Top AMFEs con más issues

| AMFE | Producto | Findings | Comentario |
|---|---|---|---|
| AMFE-HF-PAT | Headrest Front | 19 | Confirmado por baseline 2026-05-15. PROPOSE_APPLY pendientes de Fak. |
| AMFE-HRC-PAT | Headrest Rear Center | 18 | Bug propagado HF-PAT → HRC-PAT (familia hermana). |
| AMFE-HRO-PAT | Headrest Rear Outer | 18 | Bug propagado familia hermana. |
| VWA-PAT-IPPADS-001 | IP PADS | 16 | Ruido FN_NO_VERB mayormente (descriptores tipo VW). |
| AMFE-MAESTRO-INY-001 | Inyección plástica | 10 | **Inesperado** — es canónico. Revisar si son falsos positivos FN_NO_VERB o requiere corrección del canónico. |
| AMFE-TR-PAT | Top Roll | 8 | |
| 150 (Armrest Rear Center) | Armrest Rear Center | 7 | |
| AMFE-1 | Telas Planas PWA | 7 | |
| AMFE-2 | Telas Termoformadas PWA | 6 | |
| AMFE-INS-PAT | Insert | 6 | |
| AMFE-ARM-PAT | Armrest Door Panel | (no en top 10) | Canónico — pocos issues confirma calidad referencia. |
| AMFE-MAESTRO-LOG-REC-001 | Recepción | 2 | Canónico — limpio. |

## Issues confirmados del baseline 2026-05-15 (Headrest Front)

El auditor L2 detecta automáticamente los siguientes issues que el baseline manual ya había identificado:

| # | OP | Issue | Tipo detectado |
|---|---|---|---|
| 3 | 20 CORTE | "CORTE DE PANELES" | FN_TOO_SHORT + FN_NO_VERB + FN_ALL_CAPS_SHORT |
| 4 | 20 CORTE | Cuchilla en WE.type=Material | WE_NAME_FOREIGN_TYPE |
| 5 | 30 COSTURA UNION | "COSTURA UNION" como fn.description | FN_NO_VERB + (esperado FN_TOO_SHORT si quedó tras fix manual previo) |
| 9 | 63 INYECCION DE PU | "ESPUMADO" como fn.description | FN_TOO_SHORT + FN_NO_VERB + FN_ALL_CAPS_SHORT |

**Validación:** los issues que requirieron lectura manual el 2026-05-14 ahora son detectados automáticamente. La detección sistémica está activa.

## Lo que NO detecta (esperado, fuera de scope)

- **Texto vacío en fn.description**: cubierto por A3 (failure sin causas) y otros checks pre-existentes.
- **CC/SC clasificación**: regla absoluta no tocar (ver `amfe.md`).
- **Acciones de optimización**: regla absoluta no inventar (ver `amfe-actions.md`).
- **Calidad de controles inventados**: cubierto por auditor `_auditInventos.mjs` separado.

## Falsos positivos esperados (FN_NO_VERB)

El detector marca cualquier `fn.description` que no comience con verbo activo. En AMFEs Barack hay 2 patrones legítimos donde NO hay verbo inicial:

1. **Descriptores de propiedad del material** (típico OP 10 RECEPCION):
   - "Material resiste intemperie"
   - "Material mantiene color lote a lote"
   - Estos son válidos: describen propiedades que el material DEBE cumplir (función pasiva).

2. **Identificadores de pieza terminada** (típico OP 90 EMBALAJE):
   - "Pieza identificada segun VW 10500"
   - "Numero de pieza con tipografia DIN 1451-4-3"
   - Válidos: especifican propiedades obligatorias del producto final.

**Recomendación**: en futuras iteraciones, considerar agregar un campo `validNonVerbStarts` al JSON shared con prefijos exentos ("Material ", "Pieza ", "Numero ", "Ancho ", etc.) para reducir el ruido sin perder detección de bugs reales.

## Próximos pasos sugeridos para Fak

1. **Aplicar PROPOSE_APPLY del baseline 2026-05-15 a HF-PAT** — los 5 fixes ya identificados con cross-ref unívoco. El auditor confirma que siguen presentes.
2. **Replicar fixes a HRC-PAT y HRO-PAT** — bugs propagados, mismo texto literal.
3. **Revisar AMFE-MAESTRO-INY-001 (10 warnings)** — si son ruido FN_NO_VERB OK, si son issues reales del canónico, requiere corrección.
4. **Decidir sobre OP_FUNCTION_SEMANTIC_MISMATCH (11)** — los detecta el sistema, pero requieren confirmar 1 a 1 con el equipo APQP antes de modificar.
5. **NO actuar sobre los 95 FN_NO_VERB sin filtrado adicional** — riesgo alto de modificar texto válido.

## Verificación end-to-end (2026-05-15)

- ✅ `npm run build` → exit 0
- ✅ `npx vitest run __tests__/core/amfe` → 45 tests verde
- ✅ `npx vitest run __tests__/modules/amfe/amfeValidation.test.ts` → 65 tests verde (60 pre-existentes + 5 A8-A12)
- ✅ `npx vitest run __tests__/scripts/auditTextQuality.test.mjs` → 8 tests verde (nuevo)
- ✅ `node scripts/_auditTextQuality.mjs` (live Supabase) → exit 0, 121 warnings detectados
- ✅ `node scripts/_auditAll.mjs` → integración con sub-auditor verificada
