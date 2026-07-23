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

### 2026-07-16 — Enforcement de lecciones (cierre del loop "guardar no alcanza")
- **Nace el sistema de enforcement** (los 6 fallos de la semana eran el mismo patron:
  leccion guardada pero pisada en el momento). Ya no depende de memoria:
  hook SessionStart inyecta este archivo solo al arrancar (+ nucleo post-compact);
  `consumos-entregable-guard` inyecta el checklist canonico al detectar trabajo de
  consumos/entregables; `push-guard` exige build fresco antes de `git push`;
  `validator-check` ahora BLOQUEA `--apply` sin runWithValidation; `file-guard`
  recuerda rule-enforcement-gate al editar reglas. Validador de tablas:
  `node scripts/_validarConsumos.mjs` + canon en `scripts/_lib/consumosCanon.data.json`
  + skill `verificacion-consumos` + regla corta `consumos-entregables.md`.
- **supabase-guard ya no bloquea `git commit`** (ahora exige ejecucion real
  `node ...mjs`, no mencion del script en el mensaje) — el workaround
  `git commit -F` ya no hace falta.
- **/fix-amfe-gaps recableado al pipeline vivo** (`_auditIntegral`/`_fixAmfeStats`/
  `_structuralFixes` no existen mas; `_autoHeal.mjs` archivado). Auditor =
  detect-only y sin NotebookLM (decision Fak 2026-07-14).
- **Leccion meta (incidente GKK/GKX):** este archivo tuvo el codigo del IP PAD
  INVERTIDO 2 semanas ("GKX correcto" cuando la 2da sesion confirmo GKK). Al
  corregir una correccion: grep y actualizar TODAS las copias escritas de la
  version vieja (LECCIONES + memorias + docs), no solo la fuente principal.

### 2026-07-14/16 — Consumos P703/P21 (SMRC) + carga ARB Patagonia (VW427)
- **REGLA DURA (Fak: "gravísimo"): nunca pasar un entregable ejecutable sin MIRARLO yo antes**
  ("faltaba que lo miraras nomás, confié que lo hacías"). Mostrar el dato crudo before→after
  (columna "actual en arb" al lado del correcto) y verificar el archivo generado abriéndolo.
- **Regla canónica de memoria > dato puntual de una fuente.** Caí 2 veces: etiqueta térmica
  100x60 = 1 por CAJA (1/pzas-caja, fichas GE), NUNCA por pieza aunque el arb/BOM sugiera otra
  cosa. Y químicos A+B con valor IGUAL en "LTS" = fracción-de-envase (adhesivo/reticulante,
  primer PPBL A/B): envases distintos ≠ 1:1 — va en gramos o unidades reales asimétricas.
- **Antes de concluir "consumo no documentado": buscar la rev MÁS NUEVA de la BOM en el folder
  de consumo ACTUAL** (`Documentacion Gestion Ingenieria\14...\2. CONSUMO DE MATERIAL BOM\BOMS\`).
  El gramaje de adhesivo/primer de P21 SÍ estaba (BOM 127 Rev7); yo miraba la Rev6 vieja.
- **Consumos de vinilo/tela de SERIE: la fuente autoritativa es la tabla de tizadas de Mesa de
  Corte** (`Librales Ingenieria\Mesa de Corte\TABLA DE CONSUMO\CONSUMOS TIZADAS <fecha>.xlsx`,
  hoja por cliente, col ML) — le gana al arb y a BOMs de ingeniería (Rev6 P21 tenía vinilo ×2).
- **Export RELACIONES del arb corta la fila cuando la descripción trae "*"** (hilos FX483TK):
  el consumo sale vacío aunque esté cargado — confirmar con Fak antes de flagear.
- Reglas de etiquetas Patagonia (Fak): 50x20 = 1/pieza, **2 si la pieza lleva inyección propia**
  (una al inyectar + una PT); 100x60 = 1/caja según ficha GE. Sin semiterminados por ahora
  (resina directa). Detalle vivo: memorias `project_patagonia_carga_arb`, `project_p21_consumos`,
  `reference_p703_consumos_verificacion`, `reference_tabla_consumo_mesa_corte`.
- **En auditorías de consumos: tolerancia 2% TAPA typos reales** (poliol 0,22806 vs 0,225806 =
  error 1%, pasó mi 40/40). Usar ~0,1% + chequear INVARIANTES que deben cerrar (ISO+POLI = 0,35
  exacto; vinilo RL1 = suma de variantes) + **siempre un agente independiente con ojos frescos
  además del script propio**: el script solo chequea lo que uno pensó chequear.

### 2026-07-14 — BOMs telas planas MHV (Toyota/PWA) en el ERP "arb": revisión y carga
- **"Aplix" = la fijación MAGNÉTICA al molde** — carga magnética / iron load / MCA son lo MISMO;
  NO distinguir "aplix vs imán" (Fak lo corrigió, lo molesta). Solo importa la CANTIDAD.
  **Cada aplix = 0,000256 m²** (Cant.Aplix × 0,000256 = consumo; verificado en los 12 art. 21-946x).
  La cantidad sale del plano: 21-9902 "a criterio del proveedor", 21-9689 = 26 posiciones, 21-8944 = ninguna.
- **Barack NO usa semiterminados de CORTE (COR-TEL) en telas planas**: la tela va DIRECTA al producto
  terminado; los COR huérfanos van a la BAJA, NO se enganchan (info de producción). Solo se generan
  códigos de CORTE, no de troquelado. (Casi hago lo contrario — verificar cómo se usa la estructura antes.)
- **BOM de un tercero (Paulo) con copy-paste**: repitió el aplix (0,008704 = 34 aplix de otra pieza) y
  descripciones genéricas. Verificar TODO contra los planos antes de cargar. Los 4 componentes del 21-9902
  son piezas DISTINTAS (2 fieltros press-felt + 2 placas PP), no duplicados; la tabla de proveedores los
  rotula mal ("clip plástico" a fieltros). Fieltro 79978: 900/3mm (dic-25) vs 1000/5mm (may-26) → rige el nuevo.
- Detalle vivo y pendientes en memoria `project_boms_pwa_mhv_arb`.

### 2026-07-08 — Sistema de ciclo de vida de AMFEs (6 fases)
- Feature grande entregada: registro maestro `amfe_registry`, carátula oficial en exports
  (`buildAmfeOficialWorkbook`), change-log automático (`amfe_change_log` + diff-on-save en
  `doSaveHierarchical`), `_oficializarRevision.ts`, reorganización del servidor. Detalle en la
  memoria `project_amfe_lifecycle_system`.
- **Nombres de archivo de AMFE migran a LETRAS** (decisión Fak): numérico→letra del registro,
  letra→la del archivo (marcar si va adelantado del listado). No churnear nombres ya buenos.
- ~~Hook `supabase-guard` bloquea `git commit`~~ → ARREGLADO 2026-07-16 (el guard ahora
  exige ejecucion real de un .mjs, no mencion en el mensaje del commit).
- Tablas Supabase nuevas: MCP `apply_migration` + réplica en DDL string de `database.ts` (migración
  runtime + `CONFLICT_MAP`; si BIGSERIAL, `BIGSERIAL_TABLES`). DDL desde la app = NO-OP contra
  Supabase (`database.ts:1698`). El test de database cuenta CREATE TABLE (subir el número esperado).
- **NPR está deprecado — hoy es AP (AIAG-VDA)**. El I-AC-005 interno menciona NPR>100 (4ta ed vieja);
  la app calcula AP. Manual interno vs práctica de Fak → gana la práctica. NotebookLM
  `sgc-manual-y-procedimientos` puede devolver NPR (info vieja): no aplicar.

### 2026-07-07 — Validación pre-envío del export Gate3 VW (Patagonia)
- **Los templates de cliente traen datos de ejemplo embebidos**: el gate3_template.xlsx tenía la
  hoja "Observaciones" VISIBLE con el ejemplo alemán ("KM 4000T / Rear spoiler", OEE 0,8) y se
  entregó así en los 10 CapacityCheck — VW habría visto datos de otro producto. Fix permanente en
  `_exportProjectGate3VW.mjs` (limpia B11:G18 en ambos modos). Al adoptar un template externo:
  revisar TODAS las hojas (visibles y ocultas) buscando contenido de ejemplo antes del primer envío.
- **xlsx-populate NO calcula caches**: los xlsx generados por script muestran celdas vacías en
  visores sin motor de cálculo (Drive, previews de mail). Antes de enviar a cliente: abrir y
  guardar con Excel (COM automatizable: `Workbooks.Open` → `Calculate()` → `Save()`).
- **Un paquete con 2 métricas de carga distintas confunde al cliente**: el resumen medía
  (producción+cambios)/21,5h sin OEE (117 %/161 %) y los Gate3 producción/OEE sin cambios
  (116 %/156 %). Ninguno era erróneo, pero el LEEME citaba solo una → parecía contradicción.
  Si conviven 2 criterios, el LEEME debe explicitar ambos. Convención canónica del modelo
  completo (2026-07-07): horas = producción ÷ OEE + cambios de molde FIJOS (el OEE no aplica a
  paradas planificadas) → relevado 1200T ≈ 134 %, 750T ≈ 184 %.
- **La duda de Fak "¿esta columna está bien?" se valida en 3 capas**: fuente de datos (¿golpes o
  piezas?), motor de cálculo (¿cavidades 1 sola vez?), y recálculo independiente del archivo final.
  Las 3 dieron OK — horas máquina = golpes×ciclo sin cavidades es correcto (ver 2026-07-06).

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
- **Gate3 VW por-pieza con prensa COMPARTIDA (commit ed7d1ed)**: N moldes en M prensas → 1 Gate3
  consolidado ENGAÑA (cada molde como si tuviera prensa propia vs demanda única). Solución: **1 Gate3
  POR PIEZA** con `meta.reservationPct` = parte del tiempo de máquina de la prensa (`golpes×ciclo`,
  suman 100 %/prensa) → **todo ROJO honesto** si la prensa está sobre-100 %. Flags nuevos en
  `_exportProjectGate3VW.mjs`: `--vw-original` (formato alemán/inglés + logo VW, sin traducir) y
  `--data-file` (genera OFFLINE sin Supabase). Fuente única: `_lib/patagoniaInjectionProjects.mjs`.
  Detalle: skill `apqp-schema` (tabla `projects`) + memoria `reference-gate3-shared-machines`.
- **Ciclos corregidos (leí mal la foto — Fak lo cazó)**: IP=90 (no 70), Top Roll=70 (no 60);
  Inserto=60, APB=42, Bracket=45; cavidades IP=2, resto (izq+der)=4. Con esto las 2 prensas quedan
  sobrecargadas en cualquier modelo (Gate3 c/OEE: 1200T 116 %, 750T 156 %). Leer manuscritos con lupa.

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
- **Codigo L2 IP PAD correcto = GKK (confirmado por arb + BOM006 + revisor), NO GKX.**
  El GKX era un error consistente en los 3 docs Barack; el AMFE ya se corrigio a GKK.
  (Este archivo tuvo el dato INVERTIDO hasta 2026-07-16 — ver leccion meta arriba.)
  Detalle y pendientes externos: memoria `project_ippad_amfe`.
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
- Estado de entregabilidad por AMFE: correr `node scripts/_readiness.mjs --summary` en el
  momento — NO afirmar desde este archivo (foto 2026-06-26: 128/129 no listos por efectos
  VDA vacios; los completa el equipo APQP, NO inventar).

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
