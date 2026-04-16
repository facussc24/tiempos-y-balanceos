---
name: Backup obligatorio fin de sesion
description: SIEMPRE correr backup de Supabase al terminar cada sesion — regla de Fak tras perder 6 AMFEs
type: feedback
---

SIEMPRE correr `node scripts/_backup.mjs` al final de cada sesion.

**Why:** El 2026-04-06 se descubrio que 6 AMFEs VWA habian sido borrados sin backup. No habia revisiones, ni drafts, ni forma de recuperarlos. Se tuvieron que recrear desde el seed + PDFs de referencia.

**How to apply:** Paso 4 del protocolo de fin de sesion en CLAUDE.md. El script guarda 12 tablas como JSON en `backups/YYYY-MM-DDTHH-MM-SS/`.
