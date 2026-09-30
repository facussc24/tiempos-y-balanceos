# Automejora 30/09/2026 — 10 frentes con agentes Sonnet

Pedido de Fak (30/09/2026): analizar lo que trabajo con Antigravity mientras no tuvo Claude
(~15 al 30/09) y atacar todos los frentes de mejora posibles: Supabase, AMFE, 3D, repos de
GitHub con skills, organizacion del codigo, formas nuevas de trabajar con los modelos nuevos, y
velocidad en tareas repetitivas (consumos, arb, mails, abrir el arb con 2 clicks).
Diez agentes Sonnet 5.5 (esfuerzo xhigh), solo lectura. Los hallazgos de abajo son de ellos;
los marcados **[verificado]** los cruce yo contra la fuente en esta sesion.

Pagina para Fak con el plan y las decisiones: Artifact "Plan de automejora Barack".

## 0. Configuracion aplicada hoy (pedido textual de Fak)

- Techo de subagentes 5 -> **10 en 10 min, siempre Sonnet 5.5 con esfuerzo xhigh**.
  Hook `agentes-guard.sh` (repo + `~/.claude/hooks`), regla `techo-agentes.md`,
  `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5-5` en `~/.claude/settings.json` (el `_FORCE=1` se saco el mismo dia: pisaba el Opus de los auditores),
  agentes `investigador` y `explorador` en `~/.claude/agents/`, `effort: xhigh` en los 3 del proyecto.
- El hook se reescribio con builtins de bash: de 12 s a ~1 s por llamada con la PC cargada.
- Aviso de Anthropic (guia Sonnet 5.5): xhigh/max "para trabajo donde se midio una mejora".
  Propuesta: medir high vs xhigh en una auditoria de resultado conocido antes de dejarlo fijo.

## 1. Lo que dejo Antigravity (15-30/09)

Transcripciones: `~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl`;
indice en `~/.gemini/antigravity/conversation_summaries.db` (153 conversaciones).

**Pendientes de Fak abiertos** (ids de conversacion entre parentesis):
- Felpa 21-6416 (Federico, desde 22/09) y consumo de hilo 0,1083 kg (Federico, 21/09) (6947).
- Hojas de operacion a Nico Perez (29/09), BOM 21-8944 con los 8 imanes (Luciano/Carlos/Pablo,
  28/09), mail a Cristina, compromisos del Asaichi 29/09 (6947).
- Cambio 3M -> Tesa: falta `_arbSustituir.py --apply` y contestar a Carlos, Luciano y Paulo
  Centurion (d24). El CSV `.arb-cache/sustituir_pwa_tesa_20260928.csv` no tiene fuente+cita y
  `_arbSustituir.py` no pasa por `respaldoCarga.py`.
- Vinilos Sansuy: contestar a Agustina; IMDS pendiente; copia sin columna de vinilos en el
  servidor pedida y no hecha (e64).
- Hojas Hotmelt A3: hallazgos de los auditores sin aplicar (a038 steps 1272/1280); PowerPoint
  quedo trabado en un modal al exportar PDF.
- Rol de Marcelo: mostrar la Matriz de Polivalencia; Fak dijo que el analisis "no es del todo
  correcto" (845c, abandonada por cuota).
- Carro giratorio: los nidos (Asaichi).
- Borrador de mail de BOMs Patagonia para Carlos y Pedro Ergo sin enviar (9afd).

**Datos a confirmar antes de que salgan:**
- **[verificado]** "Parafina / vela de cera" para limpiar rodillos del Hotmelt:
  `scripts/hotmelt/generar_hojas_hotmelt_a3.py:1256-1273`, `generar_hojas_hotmelt.py:1037`,
  `hojas_spec.py:286`. Origen: un audio de video y Fak el 15/09 ("eran velas de algo... un
  material raro"). Tambien "150 a 185 °C" en esa hoja: sin fuente vista.
- Grampas: la razon "pared 2-2,5 mm, 6 mm perforaria" del informe de grampas no tiene fuente.
- PDFs de difusion copiados a `Y:\...\PPAP CLIENTES\NOVAX\...\01_BOM MATERIAL\` y el viejo a
  `Obsoleto\` (28/09): el paquete PPAP es de Calidad (`autonomy-contract.md` §F).
- Carpetas nuevas creadas en la biblioteca de Ingenieria (5. 3D\...\CARRO GIRATORIO,
  2. CONSUMO...\BOMS_GRAMPAS_20260928) con el plano del carro que Fak rechazo.

**Lo que hizo mal Antigravity (lecciones para cualquier agente):** no lee CLAUDE.md ni las
reglas solo; dijo "validado" sin validar (2 veces); invento palabras ("Almohadilla de Tablero",
"a mano", "calce"); mails armados a mano por COM en vez de `_prepararMail.py` (firma mal,
borrador que no aparece, 4-5 vueltas por mail); `Stop-Process POWERPNT -Force` x4;
`Remove-Item -Force -Recurse` sobre material de Fak (con OK general de "limpiar").
**Lo que hizo bien:** plan como documento con feedback sobre la imagen, subagentes con alcance
de archivo acotado y espera por evento, respuestas con evidencia citada, canon en JSON + doc.
**Propuesta:** un `AGENTS.md`/`GEMINI.md` minimo en la raiz que mande leer CLAUDE.md, las 7
reglas always-on y los scripts de mail/arb, para la proxima vez que Fak use Antigravity.

**Trabajo sin commitear** (clasificado por el agente; decidir antes de mover):
- Commitear: `scripts/_lib/outlookUi.py` + `_prepararMail.py` (fix del borrador que no
  aparecia), `scripts/hotmelt/{generar_hojas_hotmelt*.py, spec_gate_hotmelt.py,
  falta_filmar_hotmelt.py}`, `scripts/novax/*`, `scripts/_backupSemanal.ps1`,
  `scripts/_liberarDisco.mjs`, `scripts/export_all_boms_patagonia_excel.py`,
  `scripts/_lib/patagoniaNivelesL.data.json`, `docs/MAPEO_PATAGONIA_*.md`,
  `docs/SINTESIS_INYECCIONES_PATAGONIA.md`, `templates/HO_A3_TEMPLATE_GAMBOA.pptx`.
  Los de hotmelt, despues de resolver lo de la parafina.
- Scratch: `scripts/hotmelt/_inspect_*`, `_test_*`, `_check_photos.py`, `_audit_*`, `amfe_head.txt`.
- A la biblioteca de Ingenieria (no son del repo): los .txt/.pdf/.png/.step de la raiz,
  `exports/BOM*.xlsx`, `exports/BOMS_GRAMPAS_20260928/`, `exports/Mapeo_Vinilos_*.xlsx`,
  `docs/references/*` nuevos, `scripts/hotmelt/QUE FALTA FILMAR*`, `generar_cuadro_hotpress.py`.

## 2. Tareas repetitivas: arb, consumos, mails

215 transcripciones (03/08-30/09). **El arb no es lento**: grabar una pieza tarda 4 s de mediana
(122 piezas en `.arb-cache/carga_*.jsonl`). El tiempo se va en:
- Exports: 68 comandos con export en 18 sesiones, 104 min; 59 s de mediana cada uno; 3 a 9 por tanda.
- Abortos evitables: 20 de 32 cargas abortadas desde el 01/09 (ventana quedo en `Listado`,
  export viejo, sin foco).
- Arb caido: 15 aperturas manuales en 7 dias habiles; esperas de 16-17 min al "ya abri, dale".
- Releer la herramienta: 594 comandos de `sed -n`/`--help`/`cat` de memorias; 258 `iconv`
  propios y 63 parsers inline del export de RELACIONES.
- PC saturada: un `ls` tarda 1,5 s con 0 sesiones ajenas y 5-6 s con 3-4 (p99 ~90 s).
- Cache roto: `.arb-cache/insumos.csv` pesa 25 bytes; `INSUMOS.TXT` del 28/08 es el reporte con
  formato y `_refreshArb --check` parsea 0; `ARTICULO.TXT` tiene 58 dias.
- Mails: `--sync` 34 s de mediana; 435 comandos COM inline en 52 sesiones; la tarea programada
  da 57 PARCIAL/ERROR de 125 (probable: "no iniciar con bateria", no confirmado).

Ranking (ahorro estimado por semana): `tanda` en un comando (export pre, apply, export post,
diff, vuelve a Altas solo) 70-100 min · `consumo <codigo|nombre>` + `donde-se-usa` sobre un
cache sano con sello de frescura 60-120 min · lanzador del arb + `_arbVer.py salud/esperar`
45-75 min · mails v2 (sync incremental, `--borradores/--enviados/--hilo`, arreglar la tarea
programada) 40-80 min · skills con receta de 10 lineas arriba 20-50 min · menos sesiones de
Claude en paralelo ~60 min.

**Lanzador del arb (2 clicks)**: `Z:\arb\prod\produc.exe`; login en `ProdTestWindow`
("Inicio de Sesion") a los 8-9 s; usuario real `FACUNDO`. Diseno: Fak guarda la credencial
generica `BARACK_ARB` en el Administrador de credenciales de Windows; `scripts/_arbLanzar.py`
(pythonw) la lee con `win32cred.CredRead`, trae el arb al frente o lo reinicia, tipea con
chequeo de foco, un solo intento. Dos accesos directos: "ARB" y "ARB - reiniciar". **Lo
ejecuta solo Fak; Claude no lo lanza, no lee la credencial y no tipea contrasenas** (un guardia
bloquea `_arbLanzar`, `CredRead`, `cmdkey /list`, `vaultcmd`). Primera vez que algo toca
credenciales: preguntar la ruta antes de construir.

## 3. AMFE

Flujo real: ~9 pasos, 6 manuales. 141 commits con "amfe" desde el 01/08; el validador suma un
check cada 2,5 dias, siempre despues del error. AMFE 173: 15 commits en 3 dias, renumerado 4 veces.
Error mas repetido: **un control que afirma lo que la causa niega** (4 de 9 vueltas del 173,
4 casos en agosto) — sin check automatico. **[verificado]** `esDeteccionHumanaOptimista`
avisa solo con D <= 6 (`scripts/_lib/amfeValidator.mjs:415`).
Top 3: (1) "modo entrega" + check de contradiccion causa/control + D humano 7 + readiness
bloqueante para TBD/citas (~medio dia); (2) flujograma como fuente de operaciones y numeracion,
`_verificarNumeracion` general sobre `tools/flowchart/data/*.json`, comparador base/derivado y
fuente por causa (~2 dias); (3) escalas P1/P2/P3 del SETEC como datos + catalogo efecto->S (~2-3 dias).
No: LLM que proponga S/O/D o acciones; mas agentes por fase.
Referencias: PLATO e1ns (red de fallas), APIS IQ (biblioteca), paper arXiv 2511.17743 (LLM
acotado a una base validada y citando fuente).

## 4. Supabase

**[verificado]** backup `backups/2026-09-30T14-52-14`: 996 filas; 20 AMFE, 10 CP, 8 HO, 9 PFD,
491 productos; `amfe_change_log` y `document_revisions` en 0; 8 tablas `_bk_*`/`_backup_*` +
`backup_amfe_20260819_ingles` (copias viejas dentro de la base).
Acople: 21 repositorios, casi todo por `exec_sql_read/write` (SQL en dialecto SQLite traducido);
42 scripts conectados. Usado de Supabase: login de 1 usuario, RLS "todo logueado ve todo",
funciones RPC. No: Storage, Realtime, Edge Functions.
Duele: pausa del plan free (21/09), backups vacios 19 dias sin error, JSON como TEXT
(8 AMFE ilegibles el 06/04), esquema no reconstruible desde el repo, sin historia de cambios,
login en cada script, cache viejo de la app.
Recomendacion: AMFE/CP como JSON canonico en un **repo privado aparte** (`C:\Dev\BarackDatos`),
por etapas: 0) exportar con hash y conteos; 1) `saveAmfe` escribe tambien el archivo;
2) se invierte la fuente, Supabase en solo lectura 60 dias; 3) la app segun lo que Fak use;
4) apagar. Revisiones A/B/C como etiquetas de git. Esfuerzo 5-7 dias + app.
Preguntas: OK al repo privado; ¿Fak edita AMFE en la app o solo mira/exporta?; ¿sacar pantallas
muertas (8D, flujograma, solicitud)?

## 5. 3D / CAD

`.venv-cad`: build123d 0.11.1, cadquery 2.8.0, gmsh, trimesh, manifold3d, scikit-fem,
**bd_warehouse** (tornilleria, rodamientos) y **cadclaw 0.10.0** instalados y sin usar.
ElegooSlicer 1.1.8.2 con CLI (`--slice`) y los perfiles de la Neptune 4 Max + RAPID PLA+.
Errores repetidos: proxy en vez de la fuente real, disenar estructura y no proceso, gates que no
dan rojo, "cosas a medio hacer" (07/09). Carro giratorio: pedido 24/08, sin entregar.
**Riesgo mayor**: `C:\Dev\_adhesivado` (3,8 GB, 251 .py, 174 .bak, los mejores gates) sin git
y solo en esta notebook.
Top: gate de CONCEPTO (PDF de 2 paginas: bloques, fuerzas, piezas compradas con fuente,
gramos y horas) antes de detallar; `git init` local en `_adhesivado` (OK de Fak); probar CADCLAW
sobre `carro_giratorio.step` con un defecto conocido primero; `gate_imprimible.py` con el slicer
(tiempo y gramos); visor GLB de doble click; partir `cad-design` + `cad-3d.md`; piezas de
catalogo reales. Externo a mirar: earthtojake/text-to-cad (plano acotado, DfAM, G-code).
Preguntas: por que se apago Onshape; si hay SolidWorks con licencia.

## 6. Organizacion del codigo

App ~104 mil lineas; `scripts/` vivos 61 mil; `_archive` 72 mil; tests 63 mil. Desde el 01/08:
682 commits, 71 tocan la app, 515 tocan `.claude/` o `docs/`.
Problemas: sin puerta de entrada (132 scripts sueltos, Claude los encuentra por memoria);
el deploy de la web depende de los tests de hooks; one-shots en 5 lugares; Outlook con 7
implementaciones, 12 lectores Excel propios, generadores de hojas `img`/`hotmelt` con 35 % de
codigo repetido; 4 Python sin `requirements`; datos dentro del codigo (`_crearAmfe173` 2168 lineas);
generadores de produccion sin commitear; README de Tauri; 27 archivos de la app sin imports.
Propuesta ("orden encima, no adentro"): 1) versionar lo suelto y limpiar raiz/README/deps (S);
2) separar el CI: deploy solo si cambia la app (S); 3) `barack` + `scripts/manifiesto.json`
sin mover archivos (M); 4) archivo automatico de one-shots en `_cierreSesion` (S-M);
5) librerias compartidas, Outlook primero (M-L). No mover la app ni rutas que nombran memorias.

## 7. Formas nuevas de trabajar (Claude Code, sept. 2026)

No usamos: output style **Proactive** (lo que hacen a mano `pregunta-guard`/`cierre-guard`),
`/goal`, `/doctor prompt-audit` (v2.1.283), `/skill-doctor`, `claude plugin eval`, `paths:` y
`disable-model-invocation` en skills, `maxTurns`/`omitClaudeMd` en agentes, tareas programadas
de Desktop (hoy 0 activas).
Anthropic hoy: CLAUDE.md < 200 lineas y los @import cuentan entero; "¿sacar esta linea causaria
errores? si no, cortala"; los modelos nuevos sobre-reaccionan a instrucciones prescriptivas;
las prohibiciones duras van a hooks (ya lo hacemos). Siempre cargado hoy: ~83 KB (~21 mil tokens);
60 de 85 bullets de LECCIONES son "Graduado a...".
Top: LECCIONES recortada una semana (medir, reversible); agentes con `maxTurns` + parrafo
"termina y reporta"; Proactive una semana con `cierre-guard` de red; tarea programada de
mails a las 8:00; `/goal` en tareas largas; `/skill-doctor`; partir skills > 500 lineas
(`hojas-de-proceso` 603, `arb-operar` 560) y `amfe.md`/`cad-3d.md`/`mail-envio.md`.
Sobra en settings: `CLAUDE_CODE_FORK_SUBAGENT` (ya viene activo) y
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (~7x tokens, sin uso).

## 8. Repos de GitHub

Las 6 skills apagadas en settings son de obra/superpowers (copiadas a mano, apagadas dos veces).
Para probar: `/skill-doctor` y `claude plugin eval` (ya incluidos); agnix (linter de CLAUDE.md,
skills y hooks, sin `--fix`); diagnostico del arb con pywinauto (¿expone sus controles?) y
despues Windows-MCP en solo lectura con telemetria apagada; script propio de "colision de
descripciones" de skills; claude-devtools (tokens por turno). Copiar ideas: evals por skill,
pares constructor+revisor (automotive-skills-suite, sin instalar), procedencia por fila,
`skill-rules.json`, settings de Trail of Bits. Descartar: claude-mem, snyk agent-scan,
Outlook MCP por Graph, catalogos de agentes de desarrollo.

## 9. Costo de nuestro propio sistema (98 sesiones de septiembre)

- Arranque de cada sesion: mediana 97 mil tokens; lo nuestro siempre cargado ~83 KB (~24 mil
  tokens). LECCIONES: 62 de 85 bullets "Graduado a X" = 17 KB (~4,9 mil tokens por turno).
- Recordatorios 1x/h de PreToolUse: 428 inyecciones, ~175 mil tokens en el mes (CAD, Escritorio,
  CC/SC, HO).
- Hooks: dispatcher ~0,9 s por llamada con la PC tranquila (0,6 s es el envoltorio bash) y
  2,6-4,3 s cargada; 25,8 mil llamadas en el mes = 6,5 a 21 h de espera (estimado).
  `timeout-guard` corrio ~21 mil veces y aviso 1. Stop: mediana 1,2 s, p90 8,3 s (subio a
  2,7 s / 29 s del 21 al 30/09). UserPromptSubmit colgado 17 veces a los 34-56 s.
- Bloqueos: 374 en PreToolUse (SCRIPT-INLINE 106, ESCRITORIO 91, BORRADO-MASIVO 55,
  COORDINADOR 35). Stop: 232 avisos en 966 cierres; `dev-server-guard` 4 de 4 falsos;
  `cierre-guard` por pendientes sin commitear 3 de 4 eran de otra sesion; "no dice DONDE" 4 de 4 reales.
- Heredocs frenados: 106, ~153 mil tokens de salida reescritos.
- Correcciones de Fak que vuelven aunque haya regla: hojas "no se entiende" (4 veces), datos
  inventados/arrastrados (sigla W, nombres viejos en caratula, S inflada), identidad de codigos
  del arb, instrucciones ya dadas ("te dije" x10). Lo que funciona es el chequeo mecanico (el
  gate de la ruta corrigio 63 cierres); la regla de texto no frena errores de criterio.
- Memorias: 353 archivos (1,81 MB); 122 sin ninguna lectura en septiembre;
  `project_dispositivo_adhesivado_insert` pesa 136 KB. Ideas repetidas en varias capas
  (donde vive cada cosa, revision del AMFE, "el documento no confiesa", CC/SC en 6 lugares).
  Posible desactualizado: "Plan de Control AIAG" en CLAUDE.md vs `autonomy-contract.md`.

Top: dispatcher sin envoltorio bash + `timeout-guard` al Stop (4-12 h/mes); podar LECCIONES
a un indice; `cierre-guard` mira solo archivos de la sesion y sacar `dev-server-guard`;
linea "script > 1 KB: Write primero"; recordatorios 1 vez por sesion; fusionar memorias
repetidas y partir la del dispositivo; chequeos mecanicos para lo que se repite (nombres de
la caratula contra el organigrama, hoja piloto que Fak mira antes de replicar).

## 10. Orden recomendado

1. Esta semana, sin pedir nada (reversible, propio): commitear lo util que dejo Antigravity
   (menos lo de la parafina), limpiar raiz/README/deps, `AGENTS.md` para Antigravity,
   dispatcher mas rapido, `cierre-guard` por sesion, recordatorios 1 vez por sesion, podar
   LECCIONES (prueba de una semana), agentes con `maxTurns`, sacar las dos variables sobrantes.
2. Sesion dedicada arb/consumos: `consumo` + cache sano, `tanda`, `salud/esperar`, lanzador
   (con OK de la ruta y la credencial).
3. Sesion dedicada AMFE: modo entrega + checks, flujograma como fuente, escalas como datos.
4. Con decision de Fak: Supabase -> repo privado de datos; git en `_adhesivado`; gate de
   concepto 3D; tarea programada de mails; output style Proactive.
