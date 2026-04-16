# Regla: Routing automatico de consultas NotebookLM

Cuando se consulta NotebookLM sin notebook-id explicito, aplicar estas reglas.

## Notebooks disponibles

| ID | Usar cuando |
|---|---|
| `apqp-guias-y-conocimiento` | Metodologia, reglas AMFE/CP/HO/PFD, severidades, errores conceptuales, lecciones aprendidas |
| `auditorias-e-historial` | Auditorias pasadas, hallazgos historicos, correcciones aplicadas, comparaciones |

## Reglas de routing

1. Si la pregunta contiene "auditoria", "hallazgo", "correccion", "historial", "comparacion" -> `auditorias-e-historial`
2. Si la pregunta contiene "guia", "regla", "como", "procedimiento", "error", "leccion", "severidad", "AIAG", "VDA" -> `apqp-guias-y-conocimiento`
3. Si ambiguedad: preferir `apqp-guias-y-conocimiento` (es el principal)
4. Si el usuario especifica notebook-id: respetar sin override
5. NUNCA adivinar: si no esta claro, preguntar a Fak

## Skill vs MCP — cuando usar cual

| Operacion | Usar | Razon |
|-----------|------|-------|
| Consultar notebook (ask_question) | MCP (`mcp__notebooklm__ask_question`) | Mas rapido, maneja sesiones, library integrada |
| Crear notebook + subir fuentes | Skill (`create_notebook.py`) | MCP no tiene esta funcionalidad |
| Eliminar notebooks | Skill (`delete_notebooks.py`) o manual | MCP solo elimina de su library, no de Google |
| Auth setup/reauth | MCP (`setup_auth` / `re_auth`) | Integrado con el browser profile del MCP |
| Listar/buscar notebooks | MCP (`list_notebooks` / `search_notebooks`) | API directa |
| Gestionar library | MCP (`add_notebook` / `remove_notebook`) | API directa |

Regla general: usar MCP para todo excepto crear/eliminar notebooks (que requieren browser automation del skill).
