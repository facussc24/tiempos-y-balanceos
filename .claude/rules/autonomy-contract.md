# Contrato de Autonomia — Claude Code en BarackMercosul

Define que puedo hacer solo vs que requiere tu OK explicito. Si dudo entre dos filas, aplico la mas restrictiva.

## Principios generales

- **Hacer, no preguntar si el camino es claro.** Regla CLAUDE.md del proyecto: "NUNCA preguntar '¿queres que...?' — HACERLO y reportar". Si tengo info suficiente y el camino tecnico esta claro, ejecuto.
- **Preguntar solo cuando falta info de dominio real.** Y solo despues de intentar obtenerla con tools (MCP, skills, Glob/Grep, scripts read-only).
- **Ante opciones validas, mostrar con AskUserQuestion.** No me quedo colgado esperando ni asumo cualquiera.
- **Ante ambiguedad de datos (nombres mal rotulados, etc.), leer contenido real antes de actuar.**

## A. Datos en Supabase

| Operacion | Autonomia |
|---|---|
| Leer (query) | Libre |
| Escribir 1 documento (via app o script) | Confirmar antes — mostrar diff |
| Escribir batch (.mjs sobre varios docs) | Confirmar antes + dry-run primero |
| Borrar documento | Siempre preguntar |
| Crear familia nueva | Siempre preguntar |
| Migracion / cambio de schema | Siempre preguntar |
| Backup (`_backup.mjs`) | Libre (y obligatorio al final de sesion) |

## B. Documentos APQP (contenido tecnico)

| Accion | Autonomia |
|---|---|
| Asignar o cambiar CC / SC | **Prohibido** sin autorizacion explicita (regla historica Fak) |
| Crear acciones de optimizacion | **Prohibido inventar**. Placeholder "Pendiente definicion equipo APQP" OK en AP=H sin accion (ver `amfe-aph-pending.md`) |
| Asignar S/O/D en causas nuevas | Libre con guia de `amfe.md`. Marcar `_autoFilled` para trazabilidad |
| Regenerar CP desde AMFE | Confirmar antes (CP/HO se regeneran manual por regla historica) |
| Regenerar HO desde CP | Confirmar antes |
| Generar PFD desde AMFE | Libre (skill `pfd-generator` + verificacion visual) |
| Crear nuevo AMFE desde scratch | Siempre preguntar — necesito PPAP / datos de referencia |
| Propagar maestro → variantes | Confirmar antes + verificar contenido real de origen y destino (leer fallas, no confiar en nombres) |
| Clasificar proceso por nombre de OP | **Prohibido** sin leer contenido (ver `amfe.md` — "Verificar contenido antes de clasificar") |

## C. Codigo del app (React / TypeScript)

| Accion | Autonomia |
|---|---|
| Fix de typo / bug obvio + test + push | Libre (regla `git-deploy.md` cubre build+push) |
| Feature nueva no trivial | Plan primero, vos aprobas, ejecuto |
| Refactor | Plan primero |
| Remover feature existente | Siempre preguntar |
| Cambiar dependencias (`package.json`) | Confirmar antes |
| Borrar archivos | Siempre preguntar |
| Modificar export PDF PFD (`modules/pfd/flow/*`, `pfdHtmlExport.ts`, etc.) | **Test local OBLIGATORIO antes de push** (ver `exports.md`) |
| Tocar botón dev-login | **Prohibido** (ver `dev-login.md`) |

## D. Auditoria y checks

| Accion | Autonomia |
|---|---|
| Correr `_auditIntegral.mjs` u otros scripts read-only | Libre |
| Lanzar agente `auditor` al cerrar tarea | Obligatorio (regla `feedback_automation_system.md`) |
| Reportar hallazgos | Libre, PERO no flaggear como problema: CC/SC faltantes, AP=H sin accion |
| Aplicar correcciones detectadas que tocan datos | Confirmar antes |
| Aplicar correcciones detectadas que son solo codigo y son obvias | Libre (bug fix) |

## E. Integraciones externas

| Accion | Autonomia |
|---|---|
| NotebookLM: `ask_question` | Libre |
| NotebookLM: subir fuente | Confirmar antes + verificar con `ask_question` despues (`feedback_verify_nlm_uploads.md`) |
| NotebookLM: crear notebook nuevo | Siempre preguntar |
| NotebookLM: borrar notebook | **Prohibido** sin autorizacion explicita |
| `git commit` + `push` del proyecto | Libre al cerrar tareas de codigo (regla `git-deploy.md`) |
| Deploy a GitHub Pages | Libre (sale del push automaticamente) |

## F. Comunicacion contigo

| Situacion | Comportamiento |
|---|---|
| Tengo info suficiente y el camino esta claro | **Hago y reporto** (no preguntar) |
| Falta info de dominio real que no obtengo con tools | Pregunto corto |
| Ambiguedad entre 2-3 caminos validos | Muestro opciones con `AskUserQuestion` |
| Detecto error en multiples docs del mismo tipo | Reporto afectados primero, aplico con OK |
| Vos no sos programador y me pedis que decida yo | Decido con mejor practica y te explico por que |

## Cuando fallar al lado seguro

Si una operacion no esta listada aca o tengo duda:
- Si es **reversible** (local, sin push, sin Supabase) → hago.
- Si es **irreversible o afecta datos/produccion** → pregunto.
- Si tengo que inventar datos tecnicos (numeros, tolerancias, acciones) → TBD y te aviso.

## Revision del contrato

Este archivo evoluciona con la experiencia. Si detecto que una fila genera fricción (te corrijo seguido un mismo tipo de decision, o me paro a preguntar algo obvio), actualizo este archivo y lo commiteo.
