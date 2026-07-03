---
name: notebooklm-routing
description: Routing de consultas a NotebookLM — que notebook usar segun el tema (APQP, SGC, auditorias, 8D, informes tecnicos, specs de cliente, operaciones de planta, Claude Code), cuando consultar vs cuando no, y como preguntar. Usar ANTES de consultar NotebookLM (mcp__notebooklm__ask_question o el skill python) para elegir notebook y formular la pregunta.
---

# notebooklm-routing — a que notebook preguntar

## Cuando consultar NLM

SI: conocimiento propietario Barack (no publico), respuesta que vive en un PDF/Excel/doc historico (no en el repo), pregunta semantica/comparativa.
NO: respuesta en `.claude/rules/` o skills locales, duda de codigo (leer el repo), schema Supabase (skill `apqp-schema`), estandar publico AIAG/VDA/IATF (WebFetch a fuente oficial).
Free tier: **50 queries/dia** — cada consulta debe resolver una pregunta concreta; nada de health checks.

## Notebooks vivos (8)

| ID | Usar cuando trata de |
|---|---|
| `apqp-guias-y-conocimiento` | Severidad, S/O/D, AP, CC/SC, VDA 2019, AIAG 2024, 6M, lecciones APQP, filtrado AMFE→CP/HO |
| `sgc-manual-y-procedimientos` | P-01..P-22, MC-00..MC-10, manual calidad, organigrama, politica, IATF aplicado a Barack |
| `auditorias-e-historial` | Auditorias pasadas, hallazgos historicos, comparaciones entre versiones |
| `problemas-alertas-8d` | 8D, alertas de calidad, NC, acciones correctivas pasadas, QSB, quejas de cliente |
| `informes-tecnicos-investigacio` | Causa raiz, investigaciones, informes SMRC/Cozzuol/PWA/UNE/Testori/Hernic, cinta, embalaje |
| `materiales-especificaciones-cl` | Specs de cliente (VW/PWA/Faurecia/SMRC/TBA/Irauto/Magna), CPK VW, espumas, biblia de defectos visuales, TL 1010 |
| `operaciones-procesos-planta` | Hojas de operacion por area, ayudas visuales, auditorias de proceso/producto, matriz polivalencia |
| `1-manejo-de-claude-code` | Claude Code config, MCP, skills, hooks, agents (opcional; docs oficiales suelen bastar) |

## Match rapido por keyword

severidad/S=/O=/AP/CC/SC/6M/VDA → apqp-guias · P-09/P-14/procedimiento/manual/organigrama → sgc-manual · auditoria anterior/hallazgo/historico → auditorias · 8D/alerta/NC/queja → problemas-8d · causa raiz/informe tecnico → informes-tecnicos · cliente+spec/norma/CPK/defecto → materiales-clientes · hoja operacion/area de planta/polivalencia → operaciones-planta.

Por contexto de archivo: `modules/amfe|controlPlan/**` → apqp-guias (+sgc-manual para P-09/P-10) · `scripts/_audit*.mjs` → auditorias-historial.

## Auto-consulta para agentes

- Agente `auditor`: si un hallazgo se parece a un defecto de cliente → consultar `problemas-8d` + `informes-tecnicos` (puede haber 8D previo con solucion); si es gap conceptual APQP → `apqp-guias`.
- Agente `amfe-healer`: antes de proponer accion para AP=H → `problemas-8d` (si hay 8D con accion del cliente, copiar de ahi, NO inventar).

## Como preguntar

1. Pregunta corta y concreta ("Que severidad asigna VW TL 1010 para flamabilidad en cabina?" > "contame de flamabilidad").
2. Sin cadenas de follow-ups automaticas (responder NO al "is that all?" solo si falta info genuina).
3. Si NLM no encuentra: NO insistir; registrar el gap y reportar a Fak si importa.
4. Sintetizar la respuesta citando notebook y concepto — no pegar la respuesta cruda.

## Operaciones (MCP vs skill python)

| Operacion | Con MCP cargado | Sin MCP (fuera de Barack) |
|---|---|---|
| Consultar | `mcp__notebooklm__ask_question` | `cd ~/.claude/skills/notebooklm && PYTHONIOENCODING=utf-8 python scripts/run.py ask_question.py --question "..." [--notebook-id ID]` |
| Listar | `mcp__notebooklm__list_notebooks` | `python scripts/run.py notebook_manager.py list` |
| Subir fuente | skill `notebooklm-manager` — confirmar con Fak + verificar con ask_question despues | idem |
| Crear/borrar notebook | crear = preguntar a Fak; borrar = **prohibido** | idem |

Si falla con timeout/auth: chequear `tasklist | grep -i notebooklm` — si hay procesos `notebooklm-mcp` y chrome con `user-data-dir=notebooklm-mcp`, el MCP esta vivo y el problema es otro (red/rate limit). Ver memoria `feedback_notebooklm_auth`.

Cuenta: facundowadee@gmail.com. Overhead esperado sin MCP: 10-30 seg/consulta (Chrome headless). Registro de notebooks eliminados 2026-04-22 (flujogramas/HO/tiempos/embalaje, 0 usos): recuperables via WebFetch a fuentes publicas.
