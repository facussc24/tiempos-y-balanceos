---
description: Supabase live es la unica fuente de verdad para documentos APQP — nunca afirmar estado desde dumps
paths:
  - "scripts/**"
  - "utils/repositories/**"
  - "tmp/**"
  - "backups/**"
---

# Supabase live = unica fuente de verdad (Iron Law)

Antes de afirmar el estado actual de cualquier doc APQP (AMFE, CP, HO, PFD, family, product): **query Supabase live**. Todo lo demas es foto historica y puede estar pre-correcciones:

`tmp/` (dumps de inspeccion) · `backups/` · `docs/AUDITORIA_*` / `docs/PROPUESTA_*` · datos hardcodeados en scripts viejos.

**En que SI confiar (orden):** 1) Supabase live; 2) docs generados desde la app en este turno (la UI lee live); 3) LECCIONES_APRENDIDAS solo si la ultima sesion lo actualizo.

## Protocolo
- Pregunta sobre estado actual → query primero, responder despues. Script temporal `scripts/_tmp_query_*.mjs` (borrar despues, no commitear) con `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, login con `VITE_AUTO_LOGIN_*`), o MCP Supabase.
- Columnas confirmadas: `amfe_documents(id, amfe_number, data, updated_at)` con `data.operations[]`; `cp_documents(data.items[])`; `ho_documents(data.sheets[])`; `pfd_documents(data.steps[])`.
- Comparar dos versiones → query AMBAS live. Verificar que un patch se aplico → leer script + query live (no confiar en logs, pueden ser de dry-run).
- Dumps tmp/ SI sirven para: ver estructura JSON, historia, inspirarse en queries. NO para afirmar estado ni reportar errores a Fak.
- Si me encuentro citando un dump para afirmar estado: PARAR y querar live. Excepciones: Supabase caido (decirlo explicitamente + fecha del dump) o pregunta explicitamente historica.

**Como citar:** `[Supabase: tabla.id=X | updated_at=fecha]` · `[Historico: tmp/X.json (stale, no verificado contra live)]`.
