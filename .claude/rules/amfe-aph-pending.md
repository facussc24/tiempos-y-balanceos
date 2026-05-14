# Regla: AP=H sin accion => auto "Pendiente definicion equipo APQP"

## Alcance (IMPORTANTE — acotado tras incidente 2026-05-14)

Esta regla aplica **SOLO** al campo `optimizationAction` (o `preventionAction` / `detectionAction`) de causas con `ap=H`.

**NO aplica a:**
- `WE.name` — usar regla `amfe-placeholder-last-resort.md` (jerarquia: cross-reference Supabase → AMFEs canonicos → NotebookLM → HOs preliminares → Fak → TBD → omitir)
- `function.description` — debe describir contribucion REAL del recurso al paso (regla `amfe-funciones-3-niveles.md`)
- `operationFunction` — describe QUE HACE el paso, no es placeholder
- `focusElementFunction` — 3 perspectivas Interno/Cliente/Usuario (regla `amfe.md`)
- `preventionControl` / `detectionControl` — placeholder solo si AP=H (`amfe-no-inventar-controles.md`); vacio si AP=M/L

**Incidente que motivo la aclaracion:** 2026-05-14 (parte 3). Claude aplico el placeholder "Pendiente definicion equipo APQP" indiscriminadamente a `WE.name` en 30 WEs de 9 AMFEs Supabase, perdiendo la oportunidad de hacer cross-reference con nombres reales que ya existian en otros AMFEs Barack ("Autoelevador", "Maquina de coser industrial", "Inyectora de poliuretano").

## Contexto original

Cuando una causa del AMFE tiene `ap=H` (Action Priority High) y no tiene accion correctiva/preventiva definida, autocompletar el campo de accion con texto placeholder reconocible.

## Texto a usar (literal, en espanol)
```
Pendiente definicion equipo APQP
```

## Campo destino
- `AmfeCause.optimizationAction` (o el campo que corresponda segun schema actual)
- Si el campo no existe en ese schema, crear/usar `preventionAction` y `detectionAction` con el mismo texto placeholder

## Cuando aplica
- Al importar/generar AMFE desde un maestro o template
- Al correr scripts de sync/propagation que detectan causas AP=H
- Al detectar en auditoria que hay causas AP=H sin accion
- NUNCA sobrescribir una accion ya definida por el equipo (chequear: texto contiene "pendiente definicion" antes de reemplazar)

## Cuando NO aplica
- Causas con AP=M o AP=L: dejar vacio, no requieren accion obligatoria
- Causas que ya tengan accion distinta al placeholder (ya fue definida por el equipo)

## Por que
- La regla `.claude/rules/amfe-actions.md` PROHIBE inventar acciones.
- Un auditor IATF requiere que AP=H tenga accion.
- "Pendiente definicion equipo APQP" es placeholder valido que NO es invento, senala al equipo humano la tarea pendiente.
- Fak autorizo 2026-04-20 este comportamiento como default, para no preguntar mas.

## Automatizacion sugerida
- Agregar hook/validacion en `modules/amfe/useAmfeProjects.ts` doSaveHierarchical antes del save que rellene causas AP=H sin accion con el placeholder.
- Opcion B: agregarlo al `controlPlanGenerator.ts` Fase 1 cuando copie causas calificadas.
- Opcion C: script one-shot en scripts/ que recorra amfe_documents y llene todos los AP=H sin accion.

## Incidente asociado
- 2026-04-20: auditoria read-only detecto 49 causas AP=H sin accion en 11 AMFEs (bloqueo IATF). Fak autorizo default placeholder en lugar de preguntar caso por caso.
