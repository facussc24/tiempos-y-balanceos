---
name: Sistema de automatizacion centralizado
description: Arquitectura de automatizacion del proyecto - agentes, hooks, roles, protocolo de sesion. Referencia obligatoria.
type: feedback
---

El proyecto tiene un sistema de automatizacion de 3 capas:

1. **Hooks** (`.claude/settings.json`): PreToolUse bloquea edicion de archivos protegidos. Stop verifica build pendiente.
2. **Agente auditor** (`.claude/agents/auditor.md`): Auditor reutilizable que verifica TS, build, git, CI, dependencias.
3. **Reglas contextuales** (`.claude/rules/`): 12 archivos que se cargan automaticamente segun los archivos tocados.

**Why:** Incidentes repetidos (2026-03-30 acciones inventadas, 2026-04-06 datos perdidos, 2026-04-13 builds rotos) demuestran que sin automatizacion los errores se repiten. Fak pidio explicitamente que Claude sepa CUANDO lanzar auditorias y commits sin que se lo pidan.

**How to apply:**
- AL TERMINAR cada tarea de codigo: lanzar agente auditor automaticamente
- Si el auditor reporta CRITICOS: arreglar ANTES de responder a Fak
- Si hay archivos editados: `npm run build` + `git add` + `git commit` + `git push` SIEMPRE
- NUNCA decir "termine" sin haber corrido el auditor y pusheado
- El agente auditor esta en `.claude/agents/auditor.md` — usarlo con `Agent tool, subagent_type=general-purpose`
- AL TERMINAR la sesion (o la ultima tarea): actualizar `docs/LECCIONES_APRENDIDAS.md` AUTOMATICAMENTE sin que Fak lo pida. Esto es parte del protocolo de CLAUDE.md y NO es opcional. Fak tuvo que recordarlo el 2026-04-13 — no debe volver a pasar.
