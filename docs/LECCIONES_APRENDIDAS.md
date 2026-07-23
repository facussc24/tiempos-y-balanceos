# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Se lee COMPLETO al inicio de cada sesion, por eso
contiene SOLO lo accionable que NO esta ya codificado como regla o gate ejecutable.

- **Historico completo** (2026-03-30 a 2026-07-02): `docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md`
- **Snapshot pre-poda 2026-07-23** (detalle integro de las secciones condensadas abajo):
  `docs/_archive/LECCIONES_APRENDIDAS_snapshot_2026-07-23.md`
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Los incidentes pre-junio ya codificados NO se repiten aca: todo consolidado en
  `.claude/rules/amfe.md` + gates de `amfeValidator.mjs`. Double-serialization JSONB y
  tabla AP oficial: `database.md`. Dumps stale: `verify-supabase-live.md`. PFD/HO: `no-pfd-no-ho.md`.

## Lecciones operativas vigentes

### 2026-07-23 — Mantenimiento integral (auditoria de deuda + refactor CAD)
- Skill cad-design refactorizado: libreria `cadlib` + CLIs parametrizados con `--help`,
  UN interprete (`.venv-cad`, con rtree agregado), caso posicionador congelado en
  `examples/`. Gate DURO de entrega en `export_deliverables.py` (el hook solo recuerda).
- Candado CC/SC ejecutable en `runWithValidation` (bloquea `--apply` que AGREGA CC/SC;
  override `--allow-specialchar` solo con OK de Fak) + test en `__tests__/scripts/`.
- **SEGURIDAD: password de admin@barack.com estaba hardcodeada en `scripts/_archive/`
  (repo publico)** — archivos borrados; cambio de password + fixes RLS pendientes de Fak.
- **NotebookLM: los scripts globales y la registracion MCP NO EXISTEN mas** (verificado
  2026-07-23) — skills lo documentaban como vivo; decision restaurar/retirar pendiente.
- Practica 2026 para codigo generado con IA: auditoria de deuda cada ~2 semanas
  (agentes por area + verificacion manual de hallazgos; ~mitad de fixes fueron de docs
  que prometian enforcement inexistente).

### 2026-07-16 — Enforcement + meta-leccion
- Sistema de enforcement operativo (hooks SessionStart/consumos/push/validator/file-guard +
  `node scripts/_validarConsumos.mjs` + canon `scripts/_lib/consumosCanon.data.json`).
  Leccion nueva critica → candado ejecutable en la misma sesion, no prosa (skill `rule-enforcement-gate`).
- **Meta (incidente GKK/GKX):** al corregir una correccion, grep y actualizar TODAS las copias
  escritas de la version vieja (LECCIONES + memorias + docs), no solo la fuente principal.

### 2026-07-14/16 — Consumos y entregables (ya codificado)
- Todo el paquete esta codificado: regla `consumos-entregables.md` + skill `verificacion-consumos`
  + validador + canon JSON. Regla nueva de Fak → al canon EN LA MISMA SESION, con `fuente:`.
- Datos duros de planta no reglables viven en memorias: `project_p21_consumos`,
  `project_patagonia_carga_arb`, `reference_p703_consumos_verificacion`,
  `reference_tabla_consumo_mesa_corte`, `reference_arb_export_estructura`.

### 2026-07-14 — BOMs telas planas MHV (arb)
- "Aplix" = fijacion MAGNETICA al molde (= carga magnetica / iron load / MCA — NO distinguirlos,
  molesta a Fak); solo importa la CANTIDAD; cada aplix = 0,000256 m². Telas planas van DIRECTO
  a PT (sin semiterminado COR; los COR huerfanos → BAJA). BOM de terceros: verificar TODO contra
  planos (copy-paste real detectado). Detalle: memoria `project_boms_pwa_mhv_arb`.

### 2026-07-08 — Ciclo de vida AMFEs
- Sistema entregado (registro maestro, caratula, change-log, `_oficializarRevision.ts`) —
  detalle: memoria `project_amfe_lifecycle_system`. Nombres de archivo AMFE migran a LETRAS
  (decision Fak); no churnear nombres ya buenos.
- Tabla Supabase nueva = MCP `apply_migration` + replica DDL en `database.ts` (`CONFLICT_MAP`;
  si BIGSERIAL, `BIGSERIAL_TABLES`; el test de database cuenta CREATE TABLE — subir el numero).
- **NPR esta deprecado — hoy es AP (AIAG-VDA).** Manual interno I-AC-005 o NotebookLM SGC con
  "NPR>100" = info vieja; gana la practica de Fak. CC/SC sigue siendo solo de Fak.

### 2026-07-07 — Exports a cliente (Gate3 VW)
- Template externo: revisar TODAS las hojas (visibles y ocultas) buscando datos de ejemplo antes
  del primer envio (el gate3 salio a VW con el ejemplo aleman visible).
- xlsx-populate NO calcula caches → abrir y guardar con Excel (COM) antes de enviar. Si conviven
  2 metricas de carga, el LEEME explicita ambas. Detalle: memoria `reference_gate3_shared_machines`.

### 2026-07-06 — Inyeccion / capacidad de planta
- Tabla `projects`: `data` es STRING JSON (columna TEXT) — stringify SI aca, al reves que
  `amfe_documents`. Carga de tiempos: skill `apqp-schema` + memoria `project_registro_tiempos_inyeccion`.
- horas_maquina = golpes (TIROS reales) × ciclo — SIN cavidades; piezas = golpes × cavidades.
  Un numero que a Fak "le parece raro" puede ser real: verificar aritmetica Y supuestos antes de
  defenderlo (su intuicion es buen detector de errores de modelado). No re-preguntar datos ya dados.

### 2026-07-02/03 — IP PAD + calibracion AMFE
- L2 IP PAD = **GKK** (no GKX; confirmado arb+BOM006+revisor). Detalle: memoria `project_ippad_amfe`.
- Severidad = efecto en el USUARIO (el scrap sube ocurrencia/costo, no S). AIAG-VDA S9-10 SI cubre
  seguridad del OPERARIO (no "corregir" a la baja). O=10 con controles declarados es indefendible
  (error humano con instruccion+autocontrol ≈ O6). Calibraciones dudosas → multiples agentes contra
  el manual AIAG-VDA, no rebotarle la pregunta a Fak.

### 2026-07-02 — Editar Supabase desde esta PC (sin .env.local)
- `C:\Dev\BarackMercosul` NO tiene `.env.local` → no corren `_backup.mjs` ni `runWithValidation`.
  Se edita via MCP Supabase `execute_sql` (rol postgres, bypassa RLS). Backup previo = tabla
  `_backup_<doc>_<fecha>` via `CREATE TABLE AS`. Cirugia jsonb por lotes chicos + verificacion SQL pre/post.
- Recalcular AP con PL/pgSQL que replique `calculateAP` (apTable.ts). NUNCA S*O*D.
- SQL generado: strings con comilla SIMPLE (`"..."` en Postgres es identificador).
- Export Excel oficial por script node (`scripts/_exportOficial.ts`, usa `buildAmfeCompletoWorkbook`),
  NUNCA desde la app — Fak no exporta desde la app.

### 2026-06-26 — Candados + repos "estilo SQLite" que escriben en la NUBE
- Regla-en-prosa critica → check ejecutable en el gate existente (skill `rule-enforcement-gate`).
  Verificar el workflow real de Fak antes de elegir solucion. Deferido a proposito:
  `CONTROL_NOT_AUTHORIZED` (necesita whitelist con input de Fak); 16 warnings CLAUDE_PHRASE
  legacy (limpiar solo con OK de Fak).
- `settingsRepository`/`projectRepository`/`draftRepository` escriben en la NUBE: `getDatabase()`
  devuelve `SupabaseAdapter` (utils/database.ts) → RPC `exec_sql_read`/`exec_sql_write`.
  `exec_sql_write` falla SILENCIOSAMENTE con INSERTs complejos → despues de cada seed/insert,
  verificar con SELECT directo. `usePlantAssets` persiste en `settings` clave `plant_assets`.
- Podados 2026-06-26 con OK de Fak: kanban/heijunka/mizusumashi/logistics-backlog (no resucitar).

### 2026-06-26 — Scorecard "AMFE listo" (readiness ≠ validez)
- "Datos validos" (gate de `--apply`) ≠ "entregable". `node scripts/_readiness.mjs --summary`
  da el verdict por AMFE en el momento — NO afirmar entregabilidad desde este archivo.

### 2026-06-25 — Import Excel a mano + export oficial
- El Excel de Fak ES el estandar AIAG-VDA 2019; los merges NO son confiables → asignar cada FM a
  su operacion POR CONTENIDO, no por posicion. Rev AMFE >= rev del PC (en letras). JSON >10KB a
  Supabase: SERVICE_ROLE por variable de entorno a `_insertAmfeService.mjs` (nunca a archivo);
  verificar md5 + que `data` es objeto. Scripts reusables: `_parseAmfeXlsxAmarok.mjs` y familia.
- Export oficial: checklist completo en skill `amfe-export-oficial` (campos EXACTOS de caratula;
  Responsable = Carlos Baptista, Aprobado por = Gonzalo Cal). SIEMPRE abrir el .xlsx generado
  antes de entregar (regla `verify-before-close.md`).

### Gotchas tecnicos vigentes (no codificados en reglas)
- **Keyword-regex amplio para calibrar severidad genera ~90% falsos positivos** (25/28 en 2026-05-17).
  Antes de un fix masivo por heuristica: leer contexto real caso por caso. Listas canonicas +
  normalize, no regex parcial.
- **Severidades de fallas comunes entre los 3 Headrest siguen inconsistentes** (ej. "Puntadas
  irregulares": HF S=6 / HRC S=3 / HRO S=8). Pendiente alinear con equipo APQP.
- Pendientes historicos de datos (FM flamabilidad Telas Planas, part numbers PWA, gramajes) viven
  en el historico — verificar contra Supabase live antes de retomarlos.
- Antes de crear un script: mirar tambien `scripts/_archive/` por si existe uno reutilizable.

## Como agregar lecciones nuevas
- Agregar la entrada ARRIBA (mas nueva primero) dentro de "Lecciones operativas vigentes",
  formato `### fecha — titulo` + 2-4 lineas maximo: leccion accionable + como aplicarla.
- Si la leccion amerita regla durable → crearla en `.claude/rules/` CON enforcement ejecutable
  (skill `rule-enforcement-gate`) y dejar aca solo 1 linea de referencia, sin duplicar.
- Cuando este archivo supere ~15 KB: mover lo ya codificado al historico en `docs/_archive/`.
