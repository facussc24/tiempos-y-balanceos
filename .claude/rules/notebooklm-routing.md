# Regla: Routing automatico de consultas NotebookLM

Cuando tengas una pregunta que podria resolverse con conocimiento ya indexado en NotebookLM, aplicar estas reglas antes de responder desde memoria o WebFetch.

## Principio general

Consultar NLM es util cuando:
- El conocimiento es **propietario Barack** (no en docs publicos)
- La respuesta vive en un PDF/Excel/doc historico (no en el repo)
- La pregunta es **semantica/comparativa** (Gemini encuentra lo que grep no encuentra)

NO consultar NLM cuando:
- La respuesta esta en `.claude/rules/` local (auto-cargadas por glob)
- Es una duda de codigo TypeScript/React (leer el repo)
- Es un dato del schema Supabase (usar skill `apqp-schema`)
- Es un estandar publico AIAG/VDA/IATF generico (usar WebFetch si hace falta)

## Notebooks vivos (8)

| ID | Usar cuando la pregunta menciona/trata de |
|---|---|
| `apqp-guias-y-conocimiento` | Severidad, S/O/D, AP=H/M/L, CC/SC, VDA 2019, AIAG 2024, 6M, Work Element, lecciones aprendidas, errores conceptuales APQP, reglas de filtrado AMFE→CP/HO, formulas AP, calibracion escalas |
| `sgc-manual-y-procedimientos` | P-01...P-22, procedimiento SGC, MC-00...MC-10, manual calidad, organigrama Barack, rol/funcion en organizacion, politica calidad, IATF 16949 aplicado a Barack |
| `auditorias-e-historial` | Auditoria pasada, hallazgo historico, correccion aplicada, comparacion entre versiones, PWA vs produccion actual, cambios vs Supabase |
| `problemas-alertas-8d` | 8D (cualquiera), alerta de calidad, no conformidad NC, accion correctiva pasada, QSB, leccion de cliente especifico, queja o rechazo del cliente |
| `informes-tecnicos-investigacio` | Causa raiz de un defecto, investigacion tecnica, informe SMRC/Cozzuol/PWA/UNE/Testori/Hernic/APB BSUV, cinta, embalaje SMRC, desvio producto-proceso |
| `materiales-especificaciones-cl` | Especificacion de cliente (VW/PWA/Faurecia/SMRC/TBA/Irauto/Magna/Cozzuol/Testori), CPK VW, dossier de materiales, espumas, biblia de defectos visuales, factibilidad, norma cliente (TL 1010, etc) |
| `operaciones-procesos-planta` | Hoja operacion de area (VWA, PWA, Cozzuol, SMRC, Mirgor, Vuteq, mesa corte), ayuda visual, auditoria proceso 2025, auditoria producto, matriz polivalencia, evaluacion tecnica del personal |
| `1-manejo-de-claude-code` | Claude Code config, MCP, skills, hooks, subagents, CLAUDE.md, memory, Agent SDK, prompt engineering, token optimization (consulta opcional — mayoria de respuestas estan en docs oficiales) |

## Reglas de match por keyword

Antes de responder, escanear el prompt/contexto. Si matchea:

1. **"severidad", "S=", "O=", "D=", "AP=", "CC", "SC", "6M", "Work Element", "VDA 2019"** → `apqp-guias`
2. **"P-09", "P-10", "P-14", "procedimiento SGC", "manual", "MC-0", "politica calidad", "organigrama"** → `sgc-manual`
3. **"auditoria anterior", "hallazgo", "ya reportado", "historico", "comparar con"** → `auditorias-historial`
4. **"8D", "alerta", "no conformidad", "QSB", "queja cliente", "rechazo", "accion correctiva pasada"** → `problemas-8d`
5. **"causa raiz", "investigacion", "informe tecnico", nombre de informe (SMRC, Cozzuol, UNE...)** → `informes-tecnicos`
6. **nombre de cliente (VW, PWA, Faurecia, SMRC, TBA, Magna, Cozzuol, Testori, Hernic, Irauto, Mirgor, Vuteq) + spec/CPK/norma/defecto** → `materiales-clientes`
7. **"hoja operacion", area de planta, "ayuda visual", "polivalencia"** → `operaciones-planta`
8. **"Claude Code", "MCP", "skill", "hook", "subagent", "agent SDK"** → `1-manejo-claude-code`

## Reglas de match por contexto del archivo (glob)

| Archivo que estoy editando | Notebook por defecto ante duda conceptual |
|---|---|
| `modules/amfe/**` | `apqp-guias` |
| `modules/controlPlan/**` | `apqp-guias` + `sgc-manual` (para P-09/I, P-10/I) |
| `modules/hojaOperaciones/**` | `operaciones-planta` + `apqp-guias` |
| `modules/pfd/**` | `apqp-guias` (primero probar con regla `.claude/rules/pfd.md`) |
| `scripts/_audit*.mjs` | `auditorias-historial` (comparar hallazgo actual vs historico) |
| `docs/INFORMES_*` | `informes-tecnicos` |

## Auto-consulta obligatoria para agentes

### Agent `auditor`
Antes de cerrar reporte de hallazgo en AMFE/CP/HO/PFD:
1. Si el hallazgo se parece a un defecto de cliente → consultar `problemas-8d` y `informes-tecnicos` para ver si hay 8D previo con solucion.
2. Si es un gap conceptual APQP → consultar `apqp-guias` para verificar que la regla que voy a aplicar es la vigente.

### Agent `amfe-healer`
Antes de proponer "healing" de causa AP=H sin accion:
1. Consultar `problemas-8d` con descripcion del modo de falla — si hay 8D con accion del cliente, NO inventar; copiar de ahi.

## Estrategia de consulta (como preguntar)

1. **Pregunta corta y concreta.** Gemini responde mejor a "Que severidad asigna VW TL 1010 para flamabilidad en piezas de cabina?" que a "Contame de flamabilidad".
2. **NO cadenas de follow-ups automaticas.** El skill pide "is that ALL you need to know?". Responder NO solo si genuinamente falta info para la tarea — no por rutina.
3. **Si NLM no tiene la respuesta** (Gemini dice "no encuentro en las fuentes"): NO insistir. Registrar el gap mentalmente, seguir con la tarea y reportar a Fak si el gap es importante para llenar.
4. **Sintetizar antes de responder.** No pegar la respuesta cruda de Gemini — extraer lo util, citar el notebook y el concepto.

## Skill vs MCP — cuando usar cual

| Operacion | Desde Barack (MCP cargado) | Desde fuera de Barack (MCP NO cargado) |
|---|---|---|
| Consultar notebook | `mcp__notebooklm__ask_question` | `python ~/.claude/skills/notebooklm/scripts/run.py ask_question.py --question "..." --notebook-id ID` |
| Listar notebooks | `mcp__notebooklm__list_notebooks` | `python ~/.claude/skills/notebooklm/scripts/run.py notebook_manager.py list` |
| Subir fuente | skill `create_notebook.py --files` (confirmar con Fak primero) | igual |
| Crear notebook | Siempre preguntar a Fak primero | igual |
| Borrar notebook | **Prohibido** sin autorizacion explicita | **Prohibido** |

Ver tambien `~/.claude/rules/notebooklm-cross-project.md` para reglas que aplican cuando estoy fuera de Barack.

## Notebooks eliminados 2026-04-22 (registro)

Se eliminaron por 0 usos historicos. Contenido publico recuperable con WebFetch + docs oficiales AIAG/VDA/TWI/ASME:

- `2-flujogramas-de-proceso` (53 fuentes: AIAG, ASME Y15.3, ISO 5807, VDA 6.3)
- `3-hojas-de-operaciones` (TWI, SOS/JES Toyota, Ford CSR, IATF 8.5)
- `4-tiempos-y-balanceos` (MTM, MOST, REFA, SALBP, Heijunka, Yamazumi)
- `5-medios-de-embalaje` (VDA 4500 KLT, Odette, VDA 4994 GTL, ISO 11228, NIOSH)

Si alguna vez necesito reglas PFD/HO/tiempos/embalaje: las rules Barack (`.claude/rules/pfd.md`, `hoja-operaciones.md`) ya destilan lo esencial + WebFetch a fuente oficial cuando no alcanza.

## Cuando re-evaluar este routing

Si despues de 30 dias un notebook sigue con `use_count = 0`, considerar eliminarlo o fusionar sus fuentes con otro. Revisar `~/AppData/Local/notebooklm-mcp/Data/library.json` (campos `use_count` y `last_used`).
