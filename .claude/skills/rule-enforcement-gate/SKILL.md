---
name: rule-enforcement-gate
description: Activar cada vez que se agrega/modifica un archivo en BarackMercosul/.claude/rules/ que defina una heuristica, validacion o check. Forzar que la regla tenga enforcement ejecutable EN LA MISMA SESION (gate pre-commit en amfeValidator.mjs, auditor en _auditAll.mjs, o gate pre-save en amfeValidation.ts). Tambien activar al detectar "TODO: agregar check" en una rule existente — implementar EN LA SESION ACTUAL o no aceptar la regla. Patron recurrente Barack 2026-04/05: 3 incidentes con regla + auditor read-only pero nunca gate.
---

# rule-enforcement-gate

## Iron Law

**Una regla sin enforcement no es una regla. Es un comentario decorativo que dura hasta el proximo incidente.**

Cada vez que escribo regla en `.claude/rules/` con heuristica/check/validacion, en la MISMA SESION agrego enforcement ejecutable. "TODO agregar check" no se acepta como cierre de tarea.

## Por que existe esta skill

Patron documentado en `feedback_rule_enforcement_gap.md` (memoria 2026-05-14):

| Incidente | Regla creada | Auditor read-only | Gate pre-commit |
|---|---|---|---|
| 2026-04-27 controles inventados | regla no-inventar-controles (hoy `amfe.md` §6) | `_auditInventos.mjs` | NO |
| 2026-05-08 funciones 3 niveles | regla funciones-3-niveles (hoy `amfe.md` §8) — "TODO check" | NO | NO |
| 2026-05-14 renumeracion ciega | regla leer-contenido (hoy `amfe.md` §10) | `_auditWePlaceholdersAndAllocation.mjs` | NO (solo subprocess) |

3/3 reglas quedaron decorativas. La de "funciones 3 niveles" tuvo TODO desde 2026-05-08 → 76 WEs con etiquetas genericas pasaron 7 dias sin detectarse hasta que Fak los abrio manualmente el 2026-05-14.

Esto se llama "rule enforcement gap" y es el patron mas costoso porque la regla genera **falsa sensacion de seguridad** (esta documentada → debe estar protegida → no la chequeo manual).

## Triggers (cuando se activa)

- Edit/Write en `BarackMercosul/.claude/rules/*.md`
- Encuentro string "TODO" o "Pendiente check" en una rule
- Diseno o propongo nueva regla en `~/.claude/rules/` (cross-proyecto)
- Subagent termina creando regla nueva
- Cierre de tarea donde se modifico una rule

## Capas de enforcement (Barack — usar en orden de preferencia)

1. **`scripts/_lib/amfeValidator.mjs`** — gate pre-commit para scripts `.mjs` via `runWithValidation()`. **Preferido** porque rompe la cadena antes de que llegue a Supabase.
2. **`modules/amfe/amfeValidation.ts`** — gate pre-save de la app React. Preferido para reglas que aplican a edits manuales en UI.
3. **`scripts/_auditAll.mjs`** — auditor proactivo nativo (no como subprocess; integrado en el dashboard). Segundo mejor: detecta despues del hecho pero garantiza visibilidad.
4. **`scripts/_audit*.mjs`** dedicado — auditor read-only standalone. **Ultima opcion** porque requiere correr manualmente.

Si la regla es semantica de dominio (AMFE/CP/HO/PFD/Inyeccion) → capa 1 o 2.
Si la regla es proceso (commits, testing, dev-login) → capa 3 o gate hook.

## Protocolo al detectar trigger

### Cuando agrego/modifico regla nueva

1. Identificar el check ejecutable concreto (funcion, query SQL, regex con lista canonica).
2. Decidir capa (1-4 segun tipo).
3. Implementar enforcement EN LA MISMA TAREA.
4. Agregar test unitario en `__tests__/` que ejerza el check.
5. Correr `node scripts/_auditAll.mjs --summary` o `npx vitest run` y confirmar que el check funciona.
6. Recien ahi cerrar la tarea de la regla.

### Cuando encuentro regla existente con "TODO" sin implementar

1. Pausar el trabajo actual.
2. Flaggear a Fak: "Regla X tiene TODO desde fecha Y, posible brecha activa."
3. Estimar costo de implementar AHORA vs riesgo de seguir sin enforcement.
4. Si bajo costo (<30 min) → implementar antes de continuar.
5. Si alto costo → crear issue/TODO con prioridad **bloqueante** para proxima sesion, no "algun dia".

### Cuando creo auditor read-only nuevo

Preguntarme: los mismos checks deberian ir tambien al validator gate?
- Si la respuesta es "si" → integrar ANTES de cerrar (capa 1 o 2).
- Si la respuesta es "no" (es un audit puntual de exploracion) → documentar **por que** no es gate.

## Que NO es enforcement

- Comentario en CLAUDE.md o MEMORY.md describiendo la regla
- Mensaje en consola del script ("WARNING: chequea que X")
- Doc en README
- Memoria en `feedback_*.md`
- Texto en la propia rule diciendo "Claude verifica esto"

Todas estas son **referencias** o **memorias**, no enforcement. Enforcement = codigo que falla/bloquea cuando la regla se viola.

## Anti-patron clasico

```
1. Incidente
2. Fak frustrado → "agrega regla para que no vuelva a pasar"
3. Claude escribe .claude/rules/foo.md
4. Claude escribe scripts/_auditFoo.mjs (read-only, requiere correr manual)
5. Claude marca tarea como completa
6. Pasan 7 dias
7. Incidente similar repite
8. Fak: "¿no estaba la regla?"
```

Lo correcto:

```
1. Incidente
2. Fak: "agrega regla"
3. Claude escribe rule + integra check en amfeValidator.mjs + test unitario
4. Claude corre tests + `node scripts/_auditAll.mjs --summary` y confirma deteccion
5. Tarea completa
6. Si incidente similar repite → es porque el check no cubre todos los casos, escalar el check, no abrir nueva regla decorativa
```

## Verificacion al cerrar tarea

Antes de decir "regla agregada":
```bash
# Verificar que el check corre
node scripts/_lib/amfeValidator.mjs <archivo-test>
# o
node scripts/_auditAll.mjs --summary
# o
npx vitest run amfeValidation
```

Si ninguno detecta el caso violador → la regla no esta enforced. Volver al paso 1.

## Cross-references

- `feedback_rule_enforcement_gap.md` — memoria fuente
- `feedback_heuristicas_lista_canonica_no_regex_parcial.md` — pattern de implementacion del check
- `feedback_renumerar_sin_leer_contenido.md` — el incidente 2026-05-14 que origino esta skill
- `BarackMercosul/.claude/rules/autonomy-contract.md` — contrato general de autonomia
