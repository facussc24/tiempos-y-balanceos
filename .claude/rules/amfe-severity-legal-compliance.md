---
description: Severidad minima para fallas con efecto legal/aduanero en el cliente
globs:
  - "modules/amfe/**"
  - "scripts/_fix*.mjs"
  - "scripts/_audit*.mjs"
---

# Regla: Severidad minima para fallas con efecto legal/aduanero

## Contexto

Sesion 2026-05-17 (plan soft-snacking-elephant): detector D-SOD encontro 3 causas (en HF-PAT, HRC-PAT, HRO-PAT) con failure `"Pais de origen ausente o incorrecto"` calibradas con S=5 mientras el `effectEndUser` decia `"Incumplimiento legal declaracion origen"`. Una etiqueta sin pais de origen causa **retencion aduanera** en el cliente VW — es un problema legal serio.

S=5 corresponde a zona "arrugas masivas, costura torcida, retrabajo offline" segun `amfe.md` lineas 7-12. Eso es claramente subcalibrado para un problema con consecuencia legal.

## La regla

Si el `effectEndUser` (o cualquiera de los 3 niveles de efecto) de un failure menciona keywords de implicancia **legal o aduanera**, la severidad de TODAS las causas de ese failure debe ser S>=7.

### Keywords disparadores (normalize NFD + lowercase + trim)

```
incumplimiento legal
violacion legal
retencion aduanera
retencion en aduana
detencion en aduana
multa aduanera
norma legal incumplida
declaracion de origen
declaracion falsa
sancion legal
no conformidad legal
```

**NO confundir** con menciones genericas de "legal" en otros contextos (ej: "marco legal de proveedor", "documentacion legal" sin implicar incumplimiento). El check debe buscar el **patron de incumplimiento legal con consecuencia** — no solo la palabra "legal".

### Calibracion sugerida

| Caso | S minima |
|---|---|
| Incumplimiento legal con multa o retencion en cliente | 7 |
| Incumplimiento que detiene linea del cliente + obligacion legal | 8 |
| Riesgo legal con potencial accion judicial / recall | 9 |
| Riesgo legal con dano a personas (TL 1010 flamabilidad, etc) | 9-10 |

Para el caso especifico de "pais de origen incorrecto / etiquetado aduanero": S=7 es el minimo. Si el cliente declara que la falla detiene su produccion, considerar S=8.

## Enforcement

Check `CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED` en `scripts/_lib/amfeValidator.mjs` (CRITICAL):
- Para cada failure con keyword legal-disparador en `effectEndUser` (o cualquiera de los 3 efectos)
- Verifica que TODAS las causas del failure tengan `severity >= 7`
- Si encuentra cause con S<7 → CRITICAL

Bloquea `--apply` de scripts que dejen este gap. Override con `{ allowNewCritical: true }` solo con justificacion documentada.

## Incidentes asociados

- 2026-05-17: detector D-SOD del plan soft-snacking-elephant marco esto en 3 Headrest (HF-PAT, HRC-PAT, HRO-PAT). Fix aplicado con `_fix-country-origin-severity.mjs` (S 5->7, AP recalculado sigue L). Regla + check enforcement nacieron de este incidente.

## Vinculos

- `amfe.md` — tabla de severidades calibradas (lineas 7-12)
- `amfe-aph-pending.md` — placeholder valido para AP=H sin accion
- `_fix-country-origin-severity.mjs` — script de fix one-shot del incidente
