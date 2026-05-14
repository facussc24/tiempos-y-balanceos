# Regla — Leer contenido WE-por-WE ANTES de renumerar OPs en un AMFE

Auto-cargada al editar: `scripts/_*renumber*.mjs`, `scripts/_*align*.mjs`, `scripts/_*reassign*.mjs`, `scripts/_fixHfPat*.mjs`, `scripts/_fixHeadrest*.mjs`, `modules/amfe/**`.

## Contexto

Incidente 2026-05-14 (AMFE-HF-PAT Front Headrest Patagonia): renumeré 14 OPs (cambio masivo `opNumber`) y los auditores existentes pasaron OK, pero Fak abrió el AMFE en la UI y encontró:

- `WE.name = "Proceso Op 10"` en OP 10 RECEPCION (placeholder pobre)
- `WE.name = "Proceso Op 20"` en OP 20 CORTE con failure `"Costura descosida o débil"` (modo de COSTURA en OP CORTE)
- `WE.name = "Maquina"` en OP 40 COSTURA VISTA (etiqueta 6M genérica pura — bug pre-2026-05-08 que la regla `amfe-funciones-3-niveles.md` documenta pero el auditor nunca implementó)
- Números de OP "viejos" dentro de `WE.name` tras renumeración (ej. OP 50 ENFUNDADO tenía WE "Proceso Op 60" = número anterior)

Mi error de fondo fue **conteo en vez de lectura**: dije "OP X tiene N WEs" en el reconocimiento inicial, sin leer `WE.name` ni `failures.description`. La regla `amfe.md` líneas 420-428 ya prohíbe esto explícitamente.

## La regla

**ANTES de cualquier renumeración, agrupación o reasignación de OPs en un AMFE:**

1. **Leer el contenido completo de cada OP afectada**: para cada OP origen, listar todos los `WE.type`, `WE.name`, `function.description`, `failure.description` (al menos los primeros 80 caracteres de cada uno).
2. **Verificar coherencia semántica**: para cada `failure.description`, identificar las keywords de proceso (costura/corte/inyeccion/etc.) y confirmar que coincidan con el tipo de OP donde está alocada. Si NO coinciden → marcar como `MISALLOCATED` y **bloquear renumeración hasta resolver**.
3. **Reportar a Fak la tabla diff antes de aplicar**: contenido actual de cada OP vs. cambio propuesto. Sin tabla, no avanzar.
4. **NUNCA dar por bueno** un AMFE basándose solo en conteo (cuántos WEs, cuántas causas, cuántos modos). El conteo solo dice si HAY estructura; no dice si la estructura es COHERENTE.

## Cómo detectar gap conceptual (heurística canónica)

Tabla `KEYWORD → OP_TYPE_VALIDA` (lista canónica, normalize NFD + lowercase + trim, NO regex parcial):

| Keyword en `failure.description` | OPs válidas (nombre contiene) |
|---|---|
| costura / costurar / costurado / puntada / atraque / hilo | `COSTURA*` |
| corte / cortar / cortado / dimension corte / cuchilla / vinilo corte | `CORTE*` |
| inyeccion / inyectar / PUR / PU / isocianato / poliol / dosificacion / ratio A:B | `INYECCION*`, `PU*`, `ESPUMADO*` |
| embalaje / etiqueta producto terminado / rotulo final | `EMBALAJE*` |
| recepcion / materia prima / proveedor MP / albaran | `RECEPCION*` |
| varilla / asta funda / vinilo reten | `VARILLA*`, `INSERCION*` |
| funda / enfundar / asta enfundada / pliegue funda | `ENFUNDADO*`, `TAPIZADO*` |
| mylar / plantilla forma / control forma | `MYLAR*`, `CONTROL FORMA*` |
| troquelado / espuma troquelada | `TROQUELADO*` |
| reproceso / retrabajo / re-trabajo | `REPROCESO*` |

Si un failure matchea una keyword pero su OP actual NO está en la columna válida → CRITICAL gap.

## Cómo verificar WE.name (placeholders pobres)

`WE.name` es CRITICAL placeholder si matchea cualquiera de:

1. **`/^proceso\s+op\s+\d*$/i`** — patrón "Proceso Op X" (literal, sin recurso real)
2. **GENERIC_LABELS** (regla `amfe-funciones-3-niveles.md`, normalize NFD+lowercase+trim):
   `machine` / `maquina` / `man` / `mano de obra` / `material` / `materiales` / `material (indirectos)` / `method` / `metodo` / `medicion` / `measurement` / `environment` / `medio ambiente` / `ambiente`
3. **`normalize(WE.name) === normalize(translate(WE.type))`** — copy-paste del type traducido
4. **`WE.name` contiene `\bOp\s*\d+\b`** donde el N ≠ `op.opNumber` actual — residuo de renumeración

Tras renumerar siempre limpiar este patrón 4.

## Cómo aplicar (workflow obligatorio)

```bash
# 1. ANTES de tocar nada, correr el auditor nuevo
node scripts/_auditWePlaceholdersAndAllocation.mjs > /tmp/audit-pre.json

# 2. Si hay CRITICAL → resolver los gaps semánticos PRIMERO (reasignar failures)
node scripts/_reassign*.mjs --dry-run
# review + --apply

# 3. RECIÉN ENTONCES renumerar
node scripts/_renumber*.mjs --dry-run
# review + --apply

# 4. POST-renumeración, re-correr el auditor
node scripts/_auditWePlaceholdersAndAllocation.mjs > /tmp/audit-post.json

# 5. Verificar que CRITICAL no aumentó
diff <(jq '.summary.critical' /tmp/audit-pre.json) <(jq '.summary.critical' /tmp/audit-post.json)
```

## Anti-patrones prohibidos

- ❌ "OP X tiene N WEs" como única auditoría → siempre listar `WE.name` y `failure.description`
- ❌ Renumerar y después limpiar — siempre limpiar primero
- ❌ Confiar en `runWithValidation()` por sí solo — solo valida estructura, no contenido
- ❌ Asumir que dos OPs con mismo `WE.type` son intercambiables (ej. WE "Machine" en COSTURA y en INYECCION son recursos completamente distintos)
- ❌ Hacer "find & replace" en `WE.name` sin leer las causas — perdés la oportunidad de inferir el recurso real

## Vectores de test (5 mínimos, regla `crear-auditor-nuevo.md`)

| Input | Esperado |
|---|---|
| `WE.name = "Proceso Op 10"` en OP 10 | CRITICAL (placeholder pobre) |
| `WE.name = "Maquina"` con type=Machine | CRITICAL (type traducido) |
| `WE.name = "Máquina de coser"` con type=Machine | OK (recurso específico) |
| `WE.name = "Proceso Op 60"` en OP 50 (post-renumeración) | CRITICAL (foreign opNumber) |
| `failure.description = "Costura desviada"` en OP CORTE | CRITICAL MISALLOCATED |
| `failure.description = "Rebaba de inyección"` en OP COSTURA | CRITICAL MISALLOCATED |
| `failure.description = "Vinilo cortado fuera dimensión"` en OP CORTE | OK (coherente) |

## Referencias cruzadas

- `amfe-funciones-3-niveles.md` — heurística `isGeneric6MLabel()` que esta regla extiende y formaliza
- `amfe.md` líneas 420-428 — "Verificar contenido antes de clasificar"
- `amfe-no-inventar-controles.md` — NO inventar nombres de máquinas reales; si falta info → placeholder válido
- `amfe-aph-pending.md` — placeholder autorizado: `"Pendiente definición equipo APQP"`
- `crear-auditor-nuevo.md` — receta para nuevos auditores
- `precedencia-fuentes.md` — Supabase live > dumps tmp

## Incidente fuente

2026-05-14 (AMFE-HF-PAT). Detectado por Fak abriendo el AMFE en la UI tras commit `2315375` (renumeración) + `03e064a` (primera reasignación insuficiente). Resuelto con creación de esta regla + auditor `_auditWePlaceholdersAndAllocation.mjs` + script `_fixHfPatPlaceholdersWithCriterion.mjs`.
