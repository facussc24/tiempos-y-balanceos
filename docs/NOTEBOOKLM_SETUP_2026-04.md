# Setup NotebookLM 2026-04 — 5 Notebooks Oficiales

Creado: 2026-04-20 despues de incidente de errores graves en AMFEs
(Headrest mal rotulado como inyeccion plastica, OP 40 propagada
incorrectamente, etc.). El objetivo es tener fuentes verificadas
en NotebookLM para consultar cuando Claude tenga dudas, evitando
inventos y decisiones equivocadas.

## Balance de informacion: que va donde

### Yo (Claude, en memoria y reglas del repo)
Concepto base, NO cambia seguido. Si lo olvido, gasto tokens releyendo.

- Reglas criticas Barack (archivos `.claude/rules/*.md`)
- Severidades calibradas (S=9-10 flamabilidad, S=7-8 encastre, etc.)
- CC/SC reglas (S>=9 -> CC, cliente designo -> SC)
- Prohibido: "capacitacion" como causa, ingles, inventar acciones
- Estructura Supabase (amfe_documents, cp_documents, etc.)
- 8 familias canonicas, rutas server
- Incidentes y lecciones aprendidas
- Memory files (`~/.claude/projects/.../memory/*.md`)

### NotebookLM (fuentes verificadas)
Info profunda, muchas paginas, ejemplos especificos, normas oficiales.

- Manuales AIAG/VDA completos (PFD, AMFE, CP)
- Normas IATF 16949 detalladas
- TWI completo
- MTM/MOST procedimientos
- Standards embalaje automotriz
- Casos de estudio largos
- **Documentacion Claude Code** (para mejorar como manejarme)

### Cuando preguntarle a NotebookLM en vez de procesar yo solo
- Fak pregunta algo especifico que no esta en mis reglas
- Hay duda sobre norma / metodo tecnico
- Necesito ejemplo concreto de industria
- El tema es extenso (60+ paginas de referencia)
- Yo inventaria datos numericos si respondo sin consultar

### Cuando NO preguntar a NotebookLM
- Regla ya esta en `.claude/rules/` o memory
- Es decision operativa simple
- Ya me corrigio Fak antes (feedback guardado)
- Es codigo que puedo leer del repo directamente

---

## Los 5 notebooks

### 1 - Manejo de Claude Code (meta-notebook)
**Objetivo**: fuentes oficiales sobre como manejar Claude Code eficientemente
para que yo gaste menos tokens y Fak no tenga que explicarme lo mismo cada vez.

**Prompt Discover Sources principal:**
```
Claude Code best practices by Anthropic: CLAUDE.md files, agent skills system,
memory management, custom slash commands, MCP (Model Context Protocol) servers,
subagents, hooks, context window optimization, token efficiency, how to avoid
repeated work, settings.json configuration, rules files. Official Anthropic
documentation and community best practices.
```

**Prompts secundarios (ejecutar uno a uno, agrega mas fuentes):**
```
Claude Code memory system, auto-memory, persistent context across sessions,
project-level instructions, user preferences
```

```
Anthropic Claude Code slash commands, custom skills creation, skill-creator,
agent orchestration, parallel subagents, deep research with agents
```

```
Prompt engineering Claude, system prompts, effective instructions, reducing
hallucinations, citation and source grounding
```

**URLs oficiales para subir como fuentes directas:**
- https://docs.claude.com/en/docs/claude-code/overview
- https://docs.claude.com/en/docs/claude-code/memory
- https://docs.claude.com/en/docs/claude-code/skills
- https://docs.claude.com/en/docs/claude-code/mcp
- https://docs.claude.com/en/docs/claude-code/settings
- https://docs.claude.com/en/docs/claude-code/hooks-guide
- https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview
- https://www.anthropic.com/engineering/claude-code-best-practices

---

### 2 - Flujogramas de Proceso (PFD) - automotriz
**Objetivo**: como hacer PFD bien, simbolos ASME correctos, reglas AIAG APQP,
ejemplos reales.

**Prompt Discover Sources principal:**
```
Process Flow Diagram (PFD) automotive industry, AIAG APQP 3rd edition
chapter on PFD, ASME Y15.3 flow chart symbols, IATF 16949 requirements
for process flow, VDA standards for process flow, how to build a flow
diagram for automotive manufacturing, examples of PFD for interior
trim parts, injection molding, sewing, assembly, common mistakes,
rework flow, parallel flow diagrams.
```

**Prompts secundarios:**
```
ASME symbols operation inspection transport storage delay decision,
flowchart conventions automotive APQP, department indication, cycle
time annotation
```

```
Process flow diagram examples automotive interior trim, seat cover,
headrest, armrest, door panel, insert, instrument panel; linkage
between PFD, AMFE and Control Plan AIAG
```

```
AIAG reference manual PFD part of APQP PPAP Production Part Approval
Process, flow chart templates, review criteria
```

**URLs oficiales para subir como fuentes directas:**
- https://www.aiag.org (buscar APQP 3rd ed, PPAP)
- https://www.asme.org/codes-standards (Y15.3 Process Flow)
- https://vda-qmc.de/en/publications (VDA 6.3, VDA FMEA)
- https://www.iatfglobaloversight.org (IATF 16949 clause 8.3)
- https://quality-one.com/pfd/ (Process Flow Diagram guide)
- https://asq.org/quality-resources/process-flow-chart

---

### 3 - Hojas de Operaciones / Hojas de Proceso
**Objetivo**: como escribir HO/HP bien, metodos de trabajo estandar,
pictogramas EPP, ergonomia, TWI.

**Prompt Discover Sources principal:**
```
Standard Work Instructions automotive manufacturing, Job Breakdown Sheet
TWI Training Within Industry, operation sheet examples, work element
breakdown, standardized work, Toyota Production System work instructions,
ergonomic considerations, PPE pictograms ISO 7010, cycle time annotation,
quality check points QC, safety rules in operation sheets, IATF 16949
Clause 8.5 control of production.
```

**Prompts secundarios:**
```
TWI Job Instruction 4 step method, key points, reasons why, important
steps, teaching the worker a job, Training Within Industry manual
```

```
ISO 7010 safety signs pictograms PPE personal protective equipment
goggles gloves hearing protection helmet; EN 12464 workplace lighting;
ergonomics RULA REBA OWAS
```

```
Standard Operating Procedure SOP format automotive, element
description, skills required, tools required, tact time, quality
criteria; Toyota work element sheet template
```

**URLs oficiales:**
- https://www.twi-institute.com (TWI Institute, Job Instruction/Methods)
- https://www.lean.org (Lean Enterprise Institute, standard work)
- https://www.iso.org/standard/72424.html (ISO 7010)
- https://osha.europa.eu (European PPE pictograms)
- https://www.cdc.gov/niosh (ergonomics references)
- https://www.iatfglobaloversight.org (IATF 16949)

---

### 4 - Tiempos y Balanceos
**Objetivo**: cronometraje, MTM, MOST, balanceo linea, takt time,
heijunka, kanban, cycle time analysis.

**Prompt Discover Sources principal:**
```
Time study industrial engineering, MTM Methods Time Measurement, MOST
Maynard Operation Sequence Technique, REFA time standards, standard
time calculation, allowances and rating, line balancing Simple Assembly
Line Balancing Problem SALBP-1 SALBP-2, takt time cycle time, Yamazumi
chart, Heijunka leveling, Kanban systems, mixed model assembly line
balancing, automotive industry examples.
```

**Prompts secundarios:**
```
Work sampling, predetermined motion time systems PMTS, stopwatch time
study procedure, allowances rest fatigue personal contingency
```

```
Line balancing algorithms heuristic COMSOAL RPW ranked positional
weight, precedence diagram, cycle time efficiency balance loss
```

```
Takt time calculation automotive, operator utilization, bottleneck
analysis, mixed-model sequencing, Toyota production leveling
```

**URLs oficiales:**
- https://mtm.org (MTM Association)
- https://mostis.com (MOST reference)
- https://refa.de (REFA German time study)
- https://www.iise.org (Institute of Industrial Engineers)
- https://www.lean.org (heijunka, takt time, yamazumi)
- https://www.toyota-global.com/innovation/production_system/

---

### 5 - Medios de Embalaje automotriz
**Objetivo**: como calcular medios (containers) de embalaje retornable,
cubicaje, ergonomia, normas VDA 4500, etiquetado.

**Prompt Discover Sources principal:**
```
Automotive returnable packaging design, reusable container sizing,
packaging calculation methodology, pieces per container, pallet pattern,
VDA 4500 labeling GTL Global Transport Label, Odette standards European
automotive packaging, container selection KLT VDA bins, ergonomic weight
limits ISO 11228, cubing analysis, pack density, dunnage foam design,
packaging approval PPAP element 17.
```

**Prompts secundarios:**
```
VDA 4500 Global Transport Label GTL specifications, Odette label
standards, barcode 128 label automotive
```

```
Returnable packaging KLT small load carrier, VDA universal system,
GLT large load carrier, container specifications automotive OEM
```

```
Ergonomic limits lifting packaging containers, ISO 11228-1 weight
limits, NIOSH lifting equation; dunnage foam polyethylene EPP
foam design
```

**URLs oficiales:**
- https://vda-qmc.de (VDA 4500, VDA 6.3, VDA KLT)
- https://www.odette.org (Odette Global Material Management Odette OFTP2)
- https://www.aiag.org (AIAG PPAP element 17 packaging)
- https://www.iso.org/standard/26329.html (ISO 11228-1 manual handling)
- https://www.niosh.cdc.gov/topics/ergonomics/lifteq.html (NIOSH lifting eq)
- https://www.volkswagenag.com/en/suppliers.html (VW packaging specs if public)

---

## Paso a paso: como crear cada notebook

1. Ir a https://notebooklm.google.com
2. "Nuevo notebook" -> nombre con prefijo numerico:
   - `1- Manejo de Claude Code`
   - `2- Flujogramas de Proceso`
   - `3- Hojas de Operaciones`
   - `4- Tiempos y Balanceos`
   - `5- Medios de Embalaje`
3. Dentro del notebook -> "Discover sources" (boton de descubrir fuentes)
4. Pegar el prompt principal del tema. NotebookLM buscara y agregara 10-20
   fuentes relevantes.
5. Ejecutar los prompts secundarios (uno por vez) para agregar mas fuentes.
6. Subir los URLs oficiales directos (boton "Add sources" -> "Website" o bajarlos
   a PDF primero y subir).
7. Revisar listado de fuentes y eliminar las que no sean oficiales / confiables.
8. Apuntar a mi (Claude) para registrarlo en la library MCP:
   ```
   mcp: agregar notebook "1- Manejo de Claude Code" URL https://...
   ```

## Como yo voy a consultarlos

Una vez creados y registrados con `mcp__notebooklm__add_notebook`, yo podre
consultarlos on-demand con `mcp__notebooklm__ask_question`. El routing que
seguire:

| Pregunta sobre | Notebook |
|---|---|
| Como ejecutar algo en Claude Code, skills, MCP | 1 |
| Como rotular OPs del PFD, simbolos ASME, transportes | 2 |
| HO: que poner en cada columna, TWI, ergonomia | 3 |
| Balanceo, takt time, cronometraje, MTM/MOST | 4 |
| Calcular cajas/medios de embalaje, VDA 4500, cubicaje | 5 |

El resto lo respondo con mi contexto local (reglas + memoria + repo).

## Automejora futura

Cuando Fak me diga "pregunta a notebooklm sobre X", yo decido:
1. ¿Ya tengo esta info en reglas/memory? -> uso eso (0 tokens extra)
2. ¿Es especifico y profundo? -> consulto notebook correspondiente
3. ¿Combina temas? -> consulto 2 notebooks con session_id compartido
4. Guardo la respuesta en memory si es reutilizable

Objetivo: bajar "consultas por sesion" a <5 notebook calls, con 80% de
preguntas respondidas por contexto local.
