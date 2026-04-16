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
- **13 fuentes** (verificado 2026-04-16):
  1. ANALISIS_CONSOLIDACION_VARIANTES.md
  2. APQP_MODULES_GOALS.md
  3. ERRORES_CONCEPTUALES_APQP.md
  4. GUIA_AMFE.md
  5. GUIA_HOJA_DE_OPERACIONES.md
  6. GUIA_INYECCION.md
  7. GUIA_PFD.md
  8. GUIA_PLAN_DE_CONTROL.md
  9. LECCIONES_APRENDIDAS.md
  10. PROPUESTA_RECLASIFICACION_SEVERIDADES.md
  11. REFERENCIA_CP_ORIGINALES.md
  12. REGLAS_RESPONSABLES_REFERENCIA.md
  13. USER_CONTEXT.md
- Usar: metodologia, reglas, errores comunes

### 2. Auditorias e Historial (id: auditorias-e-historial)
- URL: https://notebooklm.google.com/notebook/7ec68301-e964-4c7e-841e-4a939fb050ed
- **14 fuentes** (verificado 2026-04-16):
  1. AUDITORIA_CODIGO.md
  2. AUDITORIA_CP_INYECCION_2026-04-10.md
  3. AUDITORIA_FINAL_INYECCION_2026-04-11.md
  4. AUDITORIA_GENERAL_2026_03_30.md
  5. AUDITORIA_GENERAL_APP.md
  6. AUDITORIA_INYECCION_2026-04-10.md
  7. AUDITORIA_MATERIALES.md
  8. AUDITORIA_PFD_2026_03_31.md
  9. AUDITORIA_POST_CAMBIOS.md
  10. AUDITORIA_PROPAGATION_2026-04-10.md
  11. AUDITORIA_UI.md
  12. COMPARACION_TELAS_PLANAS_REF_VS_SUPABASE.md
  13. COMPARACION_TELAS_TERMO_REF_VS_SUPABASE.md
  14. HALLAZGOS_AUDITORIA_PWA_2026-04-06.md
- Usar: hallazgos historicos, correcciones, items pendientes

## Patrones de consulta
- "Preguntale a NotebookLM sobre [tema]"
- Guias: `--notebook-id apqp-guias-y-conocimiento`
- Auditorias: `--notebook-id auditorias-e-historial`

## Limites free tier
- 50 queries/dia, 50 fuentes/notebook, 500K palabras/fuente, 100 notebooks max
