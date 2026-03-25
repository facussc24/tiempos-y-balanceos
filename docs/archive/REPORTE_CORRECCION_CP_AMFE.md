# Reporte de Correcciones CP/AMFE — 2026-03-23

## Resumen Ejecutivo

Auditoría profunda de Planes de Control y AMFEs contra PDFs de referencia.
Se corrigió la lógica de clasificación CC/SC que estaba gravemente inflada.

## 1. Clasificación CC/SC — Antes vs Después

### Lógica Anterior (INCORRECTA)
```
S >= 9 → CC
S >= 5 → SC (sin considerar Ocurrencia)
```

### Lógica Nueva (AIAG-VDA 2019 + IATF 16949)
```
S >= 9           → CC (Característica Crítica)
S = 5-8 AND O>=4 → SC (Característica Significativa)
Resto            → Sin clasificación
```

### Distribución — 18 CPs, 1609 items totales

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| CC | 68 (4.2%) | 110 (6.8%) | +42 |
| SC | 812 (50.5%) | 467 (29.0%) | -345 |
| Sin clasificación | 729 (45.3%) | 1032 (64.1%) | +303 |

### Distribución por Producto

| Producto | CC antes→después | SC antes→después | Vacío antes→después |
|----------|------------------|-------------------|---------------------|
| Insert | 25→32 | 289→251 | 0→31 |
| Insert [L0] | 22→22 | 187→7 | 0→180 |
| Armrest | 4→9 | 173→125 | 0→43 |
| Top Roll | 13→19 | 78→60 | 5→17 |
| Headrest Front (x4) | 0→2 | 2→0 | 61→61 |
| Headrest Rear Cen (x4) | 0→2 | 2→0 | 59→59 |
| Headrest Rear Out (x4) | 0→2 | 2→0 | 61→61 |
| Telas Planas | 4→4 | 39→24 | 0→15 |
| Telas Termoformadas | 0→0 | 22→0 | 0→22 |

## 2. Archivos de Código Modificados

| Archivo | Cambio |
|---------|--------|
| `modules/controlPlan/controlPlanGenerator.ts` | Agregado check de occurrence para SC |
| `modules/controlPlan/cpCrossValidation.ts` | V1 y V2 actualizados con nueva lógica |
| `modules/pfd/pfdGenerator.ts` | Clasificación PFD alineada |
| `scripts/run-seed.mjs` | Lógica actualizada |
| `scripts/run-seed-complete-inserto.mjs` | Lógica actualizada |
| `scripts/seed-armrest.mjs` | Lógica actualizada |
| `scripts/seed-pwa-telas.mjs` | Lógica actualizada |
| `scripts/seed-top-roll.mjs` | Lógica actualizada |
| `scripts/fix-insert-master-cp.mjs` | Lógica actualizada |

## 3. Guías Creadas

| Archivo | Contenido |
|---------|-----------|
| `docs/GUIA_PLAN_DE_CONTROL.md` | Reglas CC/SC, numeración, máquinas, especificaciones, técnicas medición, frecuencias, plan reacción, idioma, ejemplos |
| `docs/GUIA_AMFE.md` | Idioma, roles empresa, nomenclatura, modos de falla, controles, AP, tabla traducción inglés→español |

## 4. Textos en Inglés entre Paréntesis

### Hallazgos en AMFEs (420 detecciones por audit script)
La mayoría son falsos positivos (palabras españolas como (Calidad), (OP), (HO)).
Textos inglés reales encontrados: (Scrap), (Set-up), (Setup), (Checklist), (CoC), (FAI), (SOS), (First Piece Approval), (Sponge layer).

Estos fueron corregidos por los agentes de fondo ejecutando `fix-english-parentheses.mjs`.

### Hallazgos en CPs
- Armrest: (Verificacion del Set Up), (Checklist), (Mala gestion de Materiales)
- Headrests: (Poka Yoke) — término estándar industria, se conserva

## 5. Roles en AMFEs
- "Ingeniería de Calidad" no encontrado (ya estaba correcto o corregido previamente)
- Roles válidos confirmados: Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)

## 6. Scripts de Auditoría Creados
| Script | Propósito |
|--------|-----------|
| `scripts/audit-cp-errors.mjs` | Auditar todos los CPs |
| `scripts/audit-amfe-errors.mjs` | Auditar todos los AMFEs |
| `scripts/audit-cc-sc-classification.mjs` | Clasificación CC/SC cruzada |
| `scripts/fix-cc-sc-classification.mjs` | Reclasificar items |
| `scripts/fix-english-parentheses.mjs` | Eliminar textos inglés |
| `scripts/fix-amfe-roles.mjs` | Corregir roles |

## 7. Pendientes para Validación Manual
- [ ] Verificar que "Autoelevador" en CP Armrest OP 10 sea correcto para recepción
- [ ] Revisar si frecuencias genéricas ("Cada pieza", "100%") deben ajustarse al estilo de referencia
- [ ] Confirmar que planes de reacción sin refs SGC (Insert, Armrest, Telas) necesitan actualización
- [ ] Verificar items sin link AMFE que no pudieron reclasificarse automáticamente

## 8. Verificación
- TypeScript: `npx tsc --noEmit` ✅ sin errores
- Tests: 252 tests pasaron ✅ (controlPlanGenerator, cpCrossValidation, pfdGenerator, controlPlanDefaults)
- Datos Supabase: Distribución verificada con script ✅
