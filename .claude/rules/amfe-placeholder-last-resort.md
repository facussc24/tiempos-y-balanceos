# Regla — Placeholder es ULTIMO recurso, no primero

Auto-cargada al editar: `modules/amfe/**`, `scripts/_fix*.mjs`, `scripts/_audit*.mjs`, `scripts/_renumber*.mjs`, `scripts/_align*.mjs`.

## Contexto

Incidente 2026-05-14 (parte 3): tras un fix masivo de WE.name pobres, Claude reemplazo TODOS los placeholders con "Pendiente definicion equipo APQP" — incluso casos obvios donde otros AMFEs Barack ya tenian el nombre real ("Autoelevador" en recepcion, "Maquina de coser industrial" en costura, "Inyectora de poliuretano" en inyeccion PU). Fak: *"tenes que tener criterio, busca info en otros AMFEs antes de inventar placeholder"*.

La regla `amfe-aph-pending.md` autoriza el placeholder `"Pendiente definicion equipo APQP"` SOLO para `optimizationAction` en causas AP=H. NO para `WE.name` ni otros campos. Esta regla acota el alcance y define la jerarquia correcta.

## La regla

**Antes de poner cualquier placeholder en un campo de AMFE, agotar las fuentes en este orden:**

### Jerarquia obligatoria de fuentes (paro en la primera que da resultado)

1. **Cross-reference Supabase live (mismo OP type)** — buscar el campo equivalente en otros AMFEs con la misma OP type:
   - Costura → mirar OP costura en ARM-PAT, INS-PAT, AMFE-1, AMFE-2
   - Inyeccion PU → mirar AMFE-ARM-PAT OP 70 (que tiene "Inyectora de PUR")
   - Recepcion → mirar AMFE-ARM-PAT OP 10 (que tiene "Autoelevador")
   - Si match: copiar el nombre canonico (un solo item, regla `amfe.md` "1M por linea")

2. **Cross-reference Supabase live (mismo producto)** — si misma familia tiene maestro o variante hermana con el WE lleno, copiar

3. **AMFEs canonicos Barack como referencia** (los "gold standard"):
   - AMFE-ARM-PAT (Armrest Door Panel) — referencia para recepcion, costura, inyeccion plastica + PU, tapizado
   - AMFE-INS-PAT (Insert) — referencia para corte, troquelado, embalaje
   - AMFE-1 (Telas Planas PWA) — referencia para mylar, APLIX, embalaje PWA
   - Lista canonica de nombres en `scripts/_lib/genericLabels.mjs` (cuando se implemente C3)

4. **NotebookLM `operaciones-procesos-planta`** — las hojas de operacion de cada sector tienen los nombres reales de maquinas/equipos (1-3 queries, free tier 50/dia)

5. **HOs preliminares en `docs-local/projects/`** — Fak suele documentar equipos reales en xlsx de HO preliminar antes de cargar a Supabase

6. **Preguntar a Fak** — tablita con 1 sola pregunta concreta por celda. Solo si 1-5 fallan.

7. **Placeholder `TBD`** (corto, no la frase larga) — SOLO si 1-6 fallaron y no aplica omitir. Fak prefirio TBD a "Pendiente definicion equipo APQP" porque es mas honesto y mas corto.

8. **OMITIR el WE entero** — si la categoria M no aplica al paso (regla AIAG-VDA: si una M no aplica, omitir el WE, no inventar). Ejemplos:
   - OP de enfundado manual sin maquina → omitir WE Machine
   - OP de reproceso sin condicion ambiental especifica → omitir WE Environment
   - Si el WE eliminado tiene failures dentro, MOVERLOS al primer WE valido de la misma OP (no perder S/O/D ni controles)

## Alcance del placeholder por campo (importante)

| Campo | Placeholder valido | Regla source |
|---|---|---|
| `optimizationAction` (AP=H) | "Pendiente definicion equipo APQP" | `amfe-aph-pending.md` |
| `WE.name` | jerarquia 1-8 (esta regla); ultimo recurso: `TBD` u omitir | esta regla |
| `function.description` | jerarquia 1-8; debe describir CONTRIBUCION del recurso al paso | `amfe-funciones-3-niveles.md` |
| `operationFunction` | nunca placeholder generico; debe describir QUE HACE EL PASO | `amfe-funciones-3-niveles.md` |
| `focusElementFunction` | nunca placeholder; 3 perspectivas Interno/Cliente/Usuario | `amfe.md` "Funcion del Item" |
| `preventionControl` / `detectionControl` | nunca inventar; placeholder OK si AP=H; vacio si AP=M/L | `amfe-no-inventar-controles.md` |

## Anti-patrones prohibidos

- ❌ "Pendiente definicion equipo APQP" como reemplazo automatico de WE.name sin cross-reference previo
- ❌ Asumir que un placeholder es seguro porque "no inventa" — perder el dato existente en otros AMFEs SI es un costo
- ❌ Saltar pasos 1-3 (cross-reference) por considerarlos "defensivos en exceso" — es lo CONTRARIO de defensivo, es PEREZA
- ❌ Usar `TBD` antes de intentar cross-reference; `TBD` es el step 7, no el step 1
- ❌ Omitir el WE (step 8) sin mover sus failures al primer WE valido — se pierden S/O/D y controles validados

## Vectores de test (5 minimos, regla `crear-auditor-nuevo.md`)

| Caso | Input | Esperado |
|---|---|---|
| 1 | OP RECEPCION, WE.type=Machine, otros AMFEs tienen "Autoelevador" | step 1 hit → "Autoelevador" |
| 2 | OP COSTURA, WE.type=Man, ARM-PAT tiene "Costurera" | step 1 hit → "Costurera" |
| 3 | OP ENFUNDADO, WE.type=Machine, no hay match en ningun AMFE, operacion manual | step 8 → omitir WE |
| 4 | OP MYLAR, WE.type=Machine, sin info en biblioteca | step 7 → TBD |
| 5 | OP X (nueva), WE.type=Material, info en HO preliminar xlsx Fak | step 5 hit → copiar de HO |

## Referencias cruzadas

- `amfe.md` "1M por linea" — el nombre debe ser 1 solo recurso, no agrupar con "/"
- `amfe-aph-pending.md` — placeholder valido SOLO para optimizationAction
- `amfe-no-inventar-controles.md` — NO inventar controles tecnicos
- `amfe-funciones-3-niveles.md` — 3 niveles de funcion VDA distintos
- `amfe-leer-contenido-antes-de-renumerar.md` — leer contenido WE-por-WE primero
- `scripts/_lib/genericLabels.mjs` (a crear, Action C3) — fuente canonica de labels genericas a evitar

## Incidente fuente

2026-05-14 (parte 3). Tras corregir 9 AMFEs Supabase, Claude puso "Pendiente definicion equipo APQP" en 30 WEs. Fak detecto que muchos eran obvios. Tras desplegar 6 agents Explore para investigar biblioteca cross-AMFE, se recupero info real en 23 de los 30 casos (autoelevador, maquina de coser, inyectora PU, etc.). Solo 7 quedaron TBD reales. Esta regla evita repetir el patron.
