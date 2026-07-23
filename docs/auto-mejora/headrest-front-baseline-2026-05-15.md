# Baseline AMFE Headrest Front — Issues 6M (calidad textual)

**Fecha:** 2026-05-15
**Fuente:** Supabase live (regla `verify-supabase-live.md`)
**AMFE auditado:** `AMFE-HF-PAT` (id `10eaebce-ad87-4035-9343-3e20e4ee0fc9`, updated 2026-05-14T19:59:16Z)
**Cross-ref:** `AMFE-HRC-PAT`, `AMFE-HRO-PAT`, `AMFE-ARM-PAT`, `AMFE-INS-PAT`, `AMFE-MAESTRO-INY-001`, `AMFE-MAESTRO-LOG-REC-001` (también live)

## Resumen

| Métrica | Valor |
|---|---|
| Total WE-function rows en HF-PAT | 33 |
| Issues detectados | 9 |
| Issues con candidato cross-ref unívoco (PROPOSE_APPLY) | 5 |
| Issues con cross-ref ambiguo (TBD_AMBIGUOUS) | 1 |
| Issues sin cross-ref canónico (TBD_NO_MATCH — requieren input Fak) | 3 |

Importante: **2 de los 5 con candidato unívoco se aplican TAMBIÉN al AMFE-HRC-PAT** (Headrest Rear Center comparte el mismo bug propagado). Después de validar la corrección en HF-PAT, conviene replicar en HRC-PAT y HRO-PAT.

---

## Tabla de issues + propuestas

| # | OP | WE.type | WE.name actual | fn.desc actual | Issue type | Candidato cross-ref | Fuente | Acción propuesta |
|---|----|---------|----------------|----------------|------------|---------------------|--------|------------------|
| 1 | 10 RECEPCION | Machine | Autoelevador | "" (vacío) | FN_EMPTY | fn.desc = "Garantizar la estabilidad y la integridad física del material durante el transporte interno" | AMFE-INS-PAT OP5 WE Autoelevador | **PROPOSE_APPLY** — sólo llenar fn.desc, el name está OK |
| 2 | 10 RECEPCION | Method | "Procedimiento de recepcion P-14" | "" (vacío) | FN_EMPTY + WE.name corto | name canónico: "Procedimiento de recepcion y registro de lote (P-14)"; fn.desc canónica: "Asegurar trazabilidad del lote entrante y verificacion del certificado del proveedor antes de liberar a produccion" | AMFE-MAESTRO-LOG-REC-001 OP10 | **PROPOSE_APPLY** — actualizar WE.name y fn.desc |
| 3 | 20 CORTE | Machine | Mesa de corte | "CORTE DE PANELES" | FN_TOO_SHORT + FN_NO_VERB + FN_ALL_CAPS | A: "Cortar los paneles de vinilo segun programa Cutter Control" (ARM-PAT OP20 - "Cortadora automatica BMA090/BMA089") <br>B: "Fijar el material al area de trabajo mediante vacio. Cortar el material con cuchilla segun..." (INS-PAT OP20 - "Maquina de corte") | AMFE-ARM-PAT / AMFE-INS-PAT | **TBD_AMBIGUOUS** — Headrest Front probablemente usa mesa con cuchilla (más cercano a INS-PAT). **Sugerencia conservadora:** "Cortar paneles de vinilo segun programa de corte con tolerancia dimensional definida". Requiere confirmación Fak. |
| 4 | 20 CORTE | Material | Cuchilla de corte | "" (vacío) | WE_NAME_FOREIGN_TYPE (cuchilla es Machine, no Material) + FN_EMPTY | INS-PAT tiene el mismo bug ("Cuchilla de corte" como Material con fn vacía). Sin canónico válido en Barack. | — | **TBD_NO_MATCH — requiere Fak**: dos opciones: <br>a) cambiar WE.type=Machine (es lo que es) <br>b) renombrar a Material real (ej: "Vinilo de cabezal/respaldo" con fn que lo describa). Mismo bug en INS-PAT requiere fix paralelo. |
| 5 | 30 COSTURA UNION | Machine | "Maquina de coser industrial" | "COSTURA UNION" | FN_TOO_SHORT + FN_NO_VERB + FN_ALL_CAPS | "Realizar la union de paneles de vinilo mediante costura" | AMFE-ARM-PAT OP50 WE "Maquina de coser" | **PROPOSE_APPLY** — sólo llenar fn.desc |
| 6 | 40 COSTURA VISTA | Machine | "Maquina de coser industrial" | **"Unir partes mediante costura industrial segun especificacion"** | OP_FUNCTION_SEMANTIC_MISMATCH (es VISTA decorativa, no UNION) | "Ejecutar costura decorativa doble conforme a especificacion" | AMFE-ARM-PAT OP51 WE "Maquina de coser" | **PROPOSE_APPLY** — éste es el caso emblemático que mencionó Fak. AMFE-HRC-PAT tiene el MISMO bug → aplicar también ahí |
| 7 | 50 ENFUNDADO | Man | "Operador de produccion" | "" (vacío) | FN_EMPTY | Sin canónico claro (ARM-PAT OP90 tapizado: "Realizar el cierre final del conjunto" no aplica directamente a enfundado de varilla) | — | **TBD_NO_MATCH — requiere Fak o el cache de operaciones (`.sgc-cache/operaciones/`)**. Sugerencia conservadora: "Calzar funda sobre asta evitando pliegues y centrando costura" (deriva del operationFunction de la OP) |
| 8 | 51 INSERCION DE VARILLA | Man | "Operador de produccion" | "" (vacío) | FN_EMPTY | Sin canónico (HRC-PAT OP70 también vacío) | — | **TBD_NO_MATCH — requiere Fak**. Sugerencia conservadora: "Insertar varilla en funda asegurando vinilo como reten contra fuga de PU" (deriva del operationFunction) |
| 9 | 63 INYECCION DE PU | Machine | "Inyectora de poliuretano" | "ESPUMADO" | FN_TOO_SHORT + FN_NO_VERB + FN_ALL_CAPS | "Inyectar poliuretano sobre el sustrato plástico asegurando cobertura y espesor uniforme" | AMFE-ARM-PAT OP70 WE "Inyectora de PUR" | **PROPOSE_APPLY** — AMFE-HRC-PAT tiene el MISMO bug ("ESPUMADO") → aplicar también ahí |

**Nota OP 28 CONTROL CON PLANTILLA MYLAR:** está SIN workElements y SIN operationFunction. No es un issue de calidad textual, es un gap estructural. Fuera del scope de esta auditoría pero detectado. Cross-ref `AMFE-INS-PAT` OP25 tiene los WEs canónicos para mylar (Operador + Mylar de control). Se anota para sesión futura.

**Nota OPs con nombre raro:** "OP 20-26 CORTE DE VINILO", "OP 30-33 COSTURA UNION" tienen "OP X-Y" prefijado en el nombre. Probable residuo de renumeración pasada (regla `amfe-leer-contenido-antes-de-renumerar.md`). Fuera de scope.

---

## Bugs propagados que también afectan AMFEs hermanos (acción derivada)

| Bug | HF-PAT | HRC-PAT | HRO-PAT |
|---|---|---|---|
| OP40 COSTURA VISTA fn.desc = "Unir partes mediante costura industrial..." | ✗ presente | ✗ presente (mismo texto literal) | (sin verificar — bajo dump no incluyó datos de COSTURA VISTA en HRO) |
| OP63/OP50 INYECCION PU fn.desc = "ESPUMADO" | ✗ presente | ✗ presente (mismo texto literal) | (a verificar) |
| OP10 RECEPCION Method "Procedimiento de recepcion P-14" fn.desc vacía | ✗ presente | ✗ presente (mismo) | (a verificar) |

Recomendación: cuando se aplique cualquier PROPOSE_APPLY a HF-PAT, replicar el mismo fix a HRC-PAT (y verificar HRO-PAT). Los 3 Headrest son familia hermana, el operationFunction es idéntico a nivel paso de proceso.

---

## Próximos pasos (Fase 1+ del plan)

1. **Fak revisa este reporte y decide:**
   - Aplicar los 5 PROPOSE_APPLY directos (sin riesgo, cross-ref unívoco contra AMFEs canónicos Barack vivos).
   - Para el TBD_AMBIGUOUS (#3 Mesa de corte): elegir entre redacción tipo ARM-PAT o INS-PAT, o dictar texto.
   - Para los 3 TBD_NO_MATCH: dictar texto o autorizar consulta al cache de operaciones (`.sgc-cache/operaciones/`).

2. **Implementar Fases 1-4 del plan** (`witty-shimmying-mochi.md`):
   - L1 source of truth (`genericLabels`)
   - L3 pre-commit gates (`amfeValidator.mjs` extendido con `FN_TOO_SHORT`, `FN_ALL_CAPS`, `OP_FUNCTION_SEMANTIC_MISMATCH`, etc.)
   - L4 UI runtime (`amfeValidation.ts` con A8-A12)
   - L5 healer cross-ref (script que automatiza esta auditoría para los 11 AMFEs)
   - L6 cookbook expandido con tabla canónica 6M por OP type
   - L7 agente `amfe-6m-enricher`

3. **Aplicar la suite a HRC-PAT y HRO-PAT** (bugs propagados) usando el healer cross-ref de L5.

---

## Sin verificar — fuera del scope

- Operaciones de optimización (CC/SC) — regla absoluta no tocar.
- Acciones correctivas — regla absoluta no inventar.
- SOD ratings — regla absoluta no inventar.
- OPs sin workElements (OP 28 MYLAR) — gap estructural, no de calidad textual.
- Numeración rara "OP 20-26", "OP 30-33" — residuo renumeración, fuera de scope.
