# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Se lee COMPLETO al inicio de cada sesion, por eso
contiene SOLO lo accionable que NO esta ya codificado como regla o gate ejecutable.

- **Historico completo** (2026-03-30 a 2026-07-02): `docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md`
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Los incidentes pre-junio ya codificados NO se repiten aca: acciones/controles inventados
  (`amfe-actions.md`, `amfe-no-inventar-controles.md` + candado FORBIDDEN_VOCABULARY),
  double-serialization JSONB y tabla AP oficial (`database.md`), renumeracion sin leer contenido
  (`amfe-leer-contenido-antes-de-renumerar.md`), placeholders (`amfe-aph-pending.md`,
  `amfe-placeholder-last-resort.md`), aliases de schema y fm legacy (gates FIELD_ALIAS_DESYNC /
  FM_LEGACY_EMPTY en `amfeValidator.mjs`), CC/SC segun manual oficial, corte=scrap, roles Man
  canonicos, pistola etiquetadora, 3 niveles de funcion (`amfe.md`, `amfe-funciones-3-niveles.md`),
  dumps stale (`verify-supabase-live.md`), PFD/HO deshabilitados (`no-flujogramas-proceso.md`,
  `no-ho-barack.md`).

## Lecciones operativas vigentes

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
