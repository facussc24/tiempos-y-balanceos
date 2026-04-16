---
name: NotebookLM Integration Setup
description: Config NotebookLM MCP + Skill + 2 notebooks activos + patrones de consulta
type: reference
---

## NotebookLM MCP Server
- Instalado via: `claude mcp add notebooklm -- npx notebooklm-mcp@latest`
- Auth: cuenta Google facundowadee@gmail.com (2FA Galaxy S24 Ultra)
- MCP data: `~/AppData/Local/notebooklm-mcp/Data/` (browser profile + cookies)

## Skill
- Path: `~/.claude/skills/notebooklm/`
- Scripts custom en `scripts/`: create_notebook.py, delete_notebooks.py
- Usa Patchright con fallback no-persistente cuando Chrome esta abierto

## Notebooks activos (2026-04-16)

### 1. APQP Guias y Conocimiento (id: apqp-guias-y-conocimiento)
- URL: https://notebooklm.google.com/notebook/fd0098cb-5e9a-4568-a164-a8e41baddfd1
- 13 fuentes: guias AMFE/CP/HO/PFD/Inyeccion, errores, lecciones, severidades, responsables, variantes, CPs originales
- Usar: metodologia, reglas, errores comunes

### 2. Auditorias e Historial (id: auditorias-e-historial)
- URL: https://notebooklm.google.com/notebook/7ec68301-e964-4c7e-841e-4a939fb050ed
- 14 fuentes: todas las AUDITORIA_*.md + HALLAZGOS_PWA + COMPARACION_TELAS_*
- Usar: hallazgos historicos, correcciones, items pendientes

## Patrones de consulta
- "Preguntale a NotebookLM sobre [tema]"
- Guias: `--notebook-id apqp-guias-y-conocimiento`
- Auditorias: `--notebook-id auditorias-e-historial`

## Limites free tier
- 50 queries/dia, 50 fuentes/notebook, 500K palabras/fuente, 100 notebooks max
