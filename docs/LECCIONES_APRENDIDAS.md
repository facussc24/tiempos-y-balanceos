# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Se lee COMPLETO al inicio de cada sesion, por eso
contiene SOLO lo accionable que NO esta ya codificado como regla o gate ejecutable.

- **Historico completo** (2026-03-30 a 2026-07-02): `docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md`
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Los incidentes pre-junio ya codificados NO se repiten aca: acciones/controles inventados,
  placeholders, 3 niveles de funcion, corte=scrap, roles Man canonicos, renumeracion con lectura
  previa, aliases de schema y fm legacy → todo consolidado en `.claude/rules/amfe.md` (2026-07-03)
  + gates de `amfeValidator.mjs` (FORBIDDEN_VOCABULARY, FIELD_ALIAS_DESYNC, FM_LEGACY_EMPTY,
  CAUSE_APH_EMPTY, CAUSE_LEGAL_COMPLIANCE). Double-serialization JSONB y tabla AP oficial:
  `database.md`. Dumps stale: `verify-supabase-live.md`. PFD/HO deshabilitados: `no-pfd-no-ho.md`.

## Lecciones operativas vigentes

### 2026-07-06 — Inyección: estudio de tiempos + capacidad de planta (proyecto balanceo id 20)
- **Cargar tiempos de inyección en "Tiempos y Balanceos" = crear proyecto en tabla `projects`.**
  `data` es **STRING JSON** (columna TEXT), NO jsonb — al revés que `amfe_documents` (stringify SÍ acá).
  Sin `.env.local` NI MCP Supabase: se hace por la **sesión logueada del app en Chrome**
  (admin@barack.com) + PostgREST (anon key del bundle JS, token de `localStorage['sb-...-auth-token']`).
  Molde = injection task: `times=[ciclo]`, `cycleQuantity=cav`, `standardTime=ciclo/cav`,
  `injectionParams.optimalCavities=cav`, `pInyectionTime=0`/`pCuringTime=ciclo`, `injectionMode=batch`.
  Turnos estándar del módulo = **21,5 h netas/día** (T1 8h + T2 7,25h + T3 6,25h).
- **Capacidad de planta**: `horas_máquina = golpes × ciclo / 3600` — **NO depende de cavidades**
  (1 golpe saca todas juntas). `piezas = golpes × cavidades`. golpes/día = **TIROS reales** (Fak).
  Capacidad = Σ horas de moldes + cambios (60 min c/u) vs 21,5h. Resultado real: 1200T **100%**
  (al límite), 750T **161%** → necesita **2da prensa** (split Delantero/Trasero balancea perfecto).
- **Meta**: un resultado que a Fak "le parece raro" puede ser real — verificar aritmética Y
  supuestos (tiros vs piezas; señal delatora: mismo nº con distinta cavidad = quizá piezas mal
  cargadas) antes de defender el número. Su intuición es buen detector de errores de modelado.
- **No re-preguntar cuando ya dio los datos**: calcular y ENTREGAR; preguntar solo lo que cambia
  el resultado. Preguntar de más lo agota/frustra (lección fuerte de esta sesión).
- **Bug arreglado (commit 0aaf86e)**: export VW Gate3 contaba cavidades ×2 en los 3 caminos
  (per-pieza × cavidades). Fix: `cycleTimeSec` = ciclo de molde. Detalle: `docs/TODO_GATE3_INVESTIGAR.md`.

### 2026-07-03 — Instructivos SGC Barack desactualizados (NPR vs AP)
- El I-AC-005 interno habla de "NPR > 100" (AIAG 4ta ed, vieja). Fak confirma: hoy es AIAG-VDA
  con AP — **manual interno vs practica actual de Fak → gana la practica**. Del instructivo solo
  vale lo procedimental (revision semestral, registro de cambios en caratula, rev en letras/rojo).
- NotebookLM `sgc-manual-y-procedimientos` tiene esos manuales como fuente: respuestas con NPR
  o criterios automaticos CC/SC son info vieja — no aplicar (CC/SC sigue siendo solo de Fak).

### 2026-07-03 — Optimizacion de tokens y poda (sesion Fable 5)
- **Frontmatter de reglas condicionales = `paths:`, NO `globs:`.** Con la clave errada, Claude Code
  carga TODAS las reglas siempre (153KB/sesion durante meses). Regla nueva con alcance de modulo:
  siempre `paths:`. Verificado contra doc oficial (memoria `reference_claude_rules_paths_frontmatter`).
- **Config consolidada**: 8 reglas amfe-* → `amfe.md` unica; injection y notebooklm-routing son
  SKILLS (`injection-process`, `notebooklm-routing`); conocimiento profundo AMFE en skill `amfe-domain`.
  Al crear conocimiento nuevo: prohibicion corta → regla; procedimiento/detalle → skill.
- **modules/pfd y modules/hojaOperaciones podados** (commits 34e3975 + 768cf03): quedan solo los
  archivos de tipos + repositorios (leen historicos de Supabase). El export Paquete APQP sigue
  incluyendo la hoja Flujograma historica. NO recrear imports a los modulos borrados.
- **scripts/ one-shots viven en `scripts/_archive/`** (190 movidos). Antes de crear un script,
  mirar tambien el archive por si existe uno reutilizable.
- **backups/ viejos comprimidos en `backups/archive-2026H1.zip`** (los pre-junio estaban ademas
  trackeados en git por error y se destrackearon).

### 2026-07-02 — AMFE IP PAD alineado a flujograma/HO/BOM (VWA-PAT-IPPADS-001, id c9b93b84)
- **Codigo L2 IP PAD = GKX, no GKK.** El BOM006 quedo con GKK — aviso pendiente a Fak.
  Cuando Fak dice "el codigo esta mal", la fuente de verdad son sus docs nuevos (flujograma + HO),
  no el dato viejo del AMFE/BOM.
- **Severidad = efecto en el USUARIO, no el scrap.** Costura descosida/desviada con efecto
  estetico va S5-6, no S8. El scrap sube ocurrencia/costo, no severidad.
- **AIAG-VDA S9-10 SI cubre seguridad del OPERARIO (OS).** Cortadura/quemadura/ventilacion con
  S10 estan BIEN sin marcar CC — no "corregir" a la baja.
- **O=10 con controles declarados es indefendible** (O=10 = "sin control alguno"). Error humano
  ocasional con instruccion + autocontrol ≈ O6 (control conductual).
- Calibraciones dudosas: resolver con **multiples agentes contra el manual AIAG-VDA**, no
  rebotarle la pregunta a Fak ("es metodologia AIAG-VDA, no dato de mi planta").

### 2026-07-02 — Editar Supabase desde esta PC (sin .env.local)
- `C:\Dev\BarackMercosul` NO tiene `.env.local` → no corren `_backup.mjs` ni `runWithValidation`.
  Se edita via MCP Supabase `execute_sql` (rol postgres, bypassa el RLS authenticated-only).
- Backup previo = tabla `_backup_<doc>_<fecha>` via `CREATE TABLE AS`. Escritura segura:
  cirugia jsonb por lotes chicos + verificacion pre/post por SQL.
- Recalcular AP con funcion PL/pgSQL que replique `calculateAP` (apTable.ts). NUNCA formula S*O*D.
- **SQL generado: string literals con comilla SIMPLE.** `"..."` en Postgres es identificador,
  no string (bug propio 2026-07-02). Verificar antes de correr UPDATEs generados.
- Export Excel oficial se hace por script node (`scripts/_exportOficial.ts` / `_exportIpPad.ts`,
  usan `buildAmfeCompletoWorkbook`), NUNCA desde la app. Fak no exporta desde la app.

### 2026-06-26 — Candado anti-invento: meta-leccion y pendientes
- **No "esforzarse mas" — poner candados.** Toda regla-en-prosa critica se convierte en check
  ejecutable en el gate existente (`runWithValidation` + `amfeValidator.mjs`), no se confia en
  que Claude se acuerde. Ver skill `rule-enforcement-gate`.
- **Verificar el workflow real de Fak antes de elegir solucion.** Los agentes votaron arreglar
  el export de la app, pero Fak exporta por script node — chequear memorias/uso real primero.
- Deferido a proposito: check `CONTROL_NOT_AUTHORIZED` (necesita whitelist curada de equipos con
  input de Fak). Mejoras siguientes en `~/.claude/plans/wise-jumping-island.md`.
- Quedan 16 warnings CLAUDE_PHRASE legacy (AMFE 150: 8x "Inspeccion Humana"; AMFE-2: "cada 50
  piezas") — limpiar solo con OK de Fak (son WARNING, no bloquean).

### 2026-06-26 — Repos "estilo SQLite" escriben en la NUBE
- `settingsRepository` / `projectRepository` / `draftRepository` usan SQL estilo SQLite
  (`INSERT OR REPLACE`, `?`) pero `getDatabase()` devuelve un `SupabaseAdapter`
  (utils/database.ts:1819) que lo traduce a Postgres via RPC `exec_sql_read`/`exec_sql_write`.
  **Verificar en database.ts antes de asumir que algo es "local".**
- El RPC `exec_sql_write` falla SILENCIOSAMENTE con INSERTs complejos (COALESCE, subqueries).
  Despues de cualquier seed/insert: SIEMPRE verificar con SELECT directo (leccion 2026-04-01,
  sigue vigente).
- `usePlantAssets` (catalogo planta del modulo balanceo) persiste en Supabase `settings` clave
  `plant_assets`; localStorage es solo cache offline. La carga elige la fuente mas fresca.
- Podados 2026-06-26 con OK de Fak: modulos kanban/heijunka/mizusumashi/logistics-backlog
  (quedan en git history — no resucitar sin pedido explicito).

### 2026-06-26 — Scorecard "AMFE listo" (readiness ≠ validez)
- "Datos validos" (gate de `--apply`) ≠ "AMFE entregable". `scripts/_readiness.mjs` (usa
  `scripts/_lib/amfeReadiness.mjs`) promueve los efectos VDA 3-niveles a bloqueante para
  entrega. Correr antes de exportar a cliente; `--summary` da el verdict por AMFE.
- Hallazgo vigente: **AMFE 128 y 129 (Amarok IP115/IP116) NO LISTOS** — 55 y 61 failures con
  algun nivel de efecto VDA vacio. Los completa el equipo APQP, NO inventar.

### 2026-06-25 — Amarok PA2: importar Excel AIAG-VDA hecho a mano
- El formato Excel de Fak ES el estandar AIAG-VDA 2019 (7 etapas). NUNCA decir que "Barack
  invierte" el estandar — el software solo anida los mismos datos (Op→WE→Funcion→Falla→Causa).
- **Revisiones en letras**: la rev del AMFE debe ser >= la rev del Plan de Control (ambos PC en
  G → AMFE en G). El AMFE puede tener MAS revisiones que el PC, nunca menos.
- Parseo de Excel a mano: los **merges NO son confiables** y el layout viene descolocado.
  Asignar cada FM a su operacion POR CONTENIDO (funcion de operacion adyacente + texto del FM),
  no por posicion ni por marcador "OPERACION N". Scripts reusables: `_parseAmfeXlsxAmarok.mjs`,
  `_buildAmfeBarack.mjs`, `_prepareAmfeInsert.mjs`, `_insertAmfeService.mjs`.
- JSON grande (>~10KB) a Supabase: MCP `execute_sql` NO sirve (imposible reproducir byte a byte,
  md5 falla). Usar SERVICE_ROLE key pasada por variable de entorno a `_insertAmfeService.mjs`
  (Fak la copia del panel; no escribirla a archivo). Verificar md5 + `data::jsonb` es objeto.
- Pendiente equipo APQP: 4 (IP115) / 6 (IP116) causas sin O/D del Excel original.

### 2026-06-25 — Export Excel oficial: verificar ANTES de entregar
- Estandar completo + checklist en skill `.claude/skills/amfe-export-oficial/`: caratula con
  nombres de campo EXACTOS que lee `buildMetadataRows` (amfeExcelExport.ts) — `revision`/`revDate`/
  `team`, no `revisionLevel`/`revisionDate`/`coreTeam` —, FM renumerados 1..N por operacion,
  hoja "Revisiones" aparte con columna Responsable.
- Globales de caratula (decision Fak): Responsable = Carlos Baptista, Aprobado por = Gonzalo Cal.
- SIEMPRE abrir el .xlsx generado y verificar caratula/FM/Revisiones antes de entregar.
  Fak: "no quiero gastar tokens corrigiendo cosas que deberian estar autooptimizadas".

### Gotchas tecnicos vigentes (origenes varios, no codificados en reglas)
- **Keyword-regex amplio para calibrar severidad genera ~90% falsos positivos** (25/28 en la
  corrida 2026-05-17). Antes de proponer un fix masivo detectado por heuristica: leer el
  contexto real (effect + failure + causa) caso por caso. Listas canonicas + normalize, no
  regex parcial.
- **Severidades de fallas COMUNES entre los 3 Headrest siguen inconsistentes** (ej. "Puntadas
  irregulares": HF S=6 / HRC S=3 / HRO S=8). Pendiente alinear con equipo APQP — `amfe.md` lo
  referencia; detalle en el historico.
- Pendientes historicos de datos (FM flamabilidad en Telas Planas, part numbers y cantidades
  PWA, gramajes) viven en el archivo historico — verificar contra Supabase live antes de
  retomarlos (pueden haberse resuelto).

## Como agregar lecciones nuevas
- Agregar la entrada ARRIBA (mas nueva primero) dentro de "Lecciones operativas vigentes",
  formato `### fecha — titulo` + 2-4 lineas maximo: leccion accionable + como aplicarla.
- Si la leccion amerita regla durable → crearla en `.claude/rules/` CON enforcement ejecutable
  (skill `rule-enforcement-gate`) y dejar aca solo 1 linea de referencia, sin duplicar.
- Cuando este archivo supere ~15 KB: mover lo ya codificado al historico en `docs/_archive/`.
