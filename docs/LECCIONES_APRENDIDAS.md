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

### 2026-07-28 — Le arme a Fak un formato propio teniendo el formulario oficial del SGC al lado
- Fak pidio armar un estudio para demostrar que el punzon de la mesa de corte ubica mal el
  agujero de alineacion del Insert. Investigue bien el SGC, **le nombre los formularios oficiales
  con codigo y ruta… y despues le arme una planilla propia en openpyxl igual.**
- **Fak dixit: "memoriza que vos no inventas formatos a menos que te lo pida… la idea es usar
  los formatos oficiales de mi empresa no te parece?"** Tuvo que pedir que la borrara.
- **Verificar que un formulario existe NO es haberlo leido.** Cuando finalmente abri
  `I-AC-020.1 Aptitud del Proceso PpPpk A.xls` aparecieron requisitos que yo no habia previsto:
  **estabilidad, normalidad, sesgo (-1,1 a 1,1) y curtosis (2 a 4)**, determinacion del tamano de
  muestra y de la frecuencia, y grilla de carga fija (`B12:L32` en ESTUDIO PRELIMINAR, los mismos
  valores otra vez en `B13:L33` de SESGO Y KURTOSIS). Ningun formato inventado por mi iba a pedir eso.
- Barack esta certificado IATF: una planilla propia no tiene codigo, no esta en el `Catalogo SGC.xlsx`,
  no tiene control de revision y **no es registro auditable**. No se puede presentar como evidencia.
- **Regla:** antes de armar cualquier planilla/informe/formato, buscar el anexo oficial en
  `...\SISTEMA SGC\Instructivos\<AREA>\Anexos\` o `...\Procedimientos\Anexos\`, ABRIRLO (copia a
  scratchpad + Excel COM) y usar ese. Si de verdad no existe, decirlo con el listado del folder y
  el catalogo antes de inventar nada. Los .xlsx existentes de la empresa no los edito yo:
  instructivo celda por celda.
- Segundo error de la misma sesion: Fak estaba parado con el calibre y las piezas en la mano y yo
  seguia generando archivos. **"porque carajo estas haciendo un excel… ya tengo el calibre y los
  vinilos".** Cuando tiene la herramienta en la mano, primero la secuencia fisica de medicion.
- Memorias: `feedback_usar_formatos_oficiales_no_inventar`, `feedback_guiar_la_accion_fisica_primero`,
  `project_estudio_agujero_insert_patagonia`, `reference_openpyxl_excel2016_funciones`.

### 2026-07-28 — Arme un analisis entero sobre una premisa que nunca confirme, y era falsa
- Detecte que en los patrones del Insert las marcas de alineacion no estaban espejadas entre mano
  derecha e izquierda (6 a 10 mm de diferencia, con el contorno espejado al 0,000000000 mm). Lo
  di por hallazgo mayor, arme la imagen comparativa y dos diapositivas.
- **Fak: "no importa que las marcas esten distintas, si lo espejas es a proposito... estamos
  acusando a la mesa de corte no al archivo que NO ES ESPEJADO".** Todo ese tramo fue al tacho.
- **La premisa "si el contorno es espejo, las marcas tambien deberian serlo" era MIA, no del
  dominio.** Nunca la puse sobre la mesa como supuesto. Cuando una conclusion depende de una
  regla de negocio que yo inferi, hay que **enunciarla explicitamente y pedir confirmacion antes
  de construir encima**, no despues de armar el entregable.
- Segundo error del mismo tramo: reporte "la mesa de corte dispersa ~2 mm entre piezas"
  comparando lo medido contra la distancia marca→contorno del DXF. Dos de las cuatro marcas caen
  contra **bordes curvos** (radio ~600 mm y ~300 mm, sin tramo plano). En un borde curvo el valor
  cambia segun donde se apoya el calibre: esa dispersion era del metodo, no de la maquina.
  **Antes de comparar una medida contra un nominal de plano: verificar que el borde de referencia
  tenga tramo recto suficiente para apoyar el instrumento.**
- La causa raiz real la dio el historial del archivo, no la estadistica: el punto de anclaje se
  habia movido 8 mm el 23/7. **Regla de diagnostico: defecto IDENTICO en todas las piezas =
  archivo o setup; defecto DISTINTO en cada pieza = maquina.** Una mesa con juego no repite el
  mismo error nueve veces.

### 2026-07-28 — El formulario oficial I-AC-020.1 devuelve un Ppk FALSO si falta la especificacion
- Al cargar el estudio de aptitud del Insert en `I-AC-020.1 Aptitud del Proceso PpPpk A.xls`, con el
  campo Especificacion vacio el formulario devolvio **Pp = 0,00 y Ppk = 8,86**. No da error y no
  avisa: se lee como si el proceso fuera excelente.
- **Causa verificada en el propio libro:** `ISTEXT(I7)` da VERDADERO pero `I7+0` da **0** y
  `ABS("TBD"-0)` da **0** — el libro evalua el texto como cero en vez de tirar `#¡VALOR!`. Por eso
  poner "TBD" en la especificacion **tampoco** protege. Cadena: `INFORME!H5/I5` →
  `ESTUDIO PRELIMINAR!H7/I7` → `I42/I40` → `J44` (Pp) y `G47/G52/J50` (Ppk).
- Contramedida aplicada: aviso en texto rojo al lado de Pp y Ppk (`INFORME!G18` y `G19`).
  **Pendiente para Calidad: revisar los estudios ya cargados con este formulario.**
- La leccion general: un formulario oficial tampoco es confiable por ser oficial. Antes de reportar
  un indice, verificar que el numero se mueva cuando se mueve la entrada. Un valor que no cambia
  al cambiar la especificacion no esta calculando nada.

### 2026-07-28 — El Escritorio esta en OneDrive y descarta guardados por COM sin avisar
- Escribi el .xls con Excel COM en `C:\Users\facun\OneDrive\Escritorio\...`, `Save()` y `Close($true)`
  no dieron error, y la lectura en memoria devolvia los valores correctos. Al reabrir el archivo,
  **estaba vacio**: OneDrive habia pisado el guardado.
- Trabajar los archivos de Office en local (scratchpad) y **copiarlos al Escritorio recien al final**,
  verificando siempre reabriendo el archivo de DESTINO, no el de trabajo.

### 2026-07-28 — Las PCs de planta tienen Excel 2016: openpyxl escribe formulas que fallan MUDAS
- `STDEV.S`, `MAXIFS` y `MINIFS` escritas por openpyxl **sin el prefijo `_xlfn.`** dan `#NAME?`.
  Si estan envueltas en `IFERROR(...,"")` —lo natural para que la planilla se vea limpia vacia—
  **la celda queda en blanco y no avisa nada.** La planilla parece andar y no anda.
- Detectado solo porque abri el archivo con Excel COM y compare contra un calculo hecho aparte en
  Python. Abrirlo y mirarlo a ojo no lo detecta.
- Usar funciones clasicas (`STDEV`, `MAX`/`MIN` sobre bloques fijos de filas) y verificar con:
  copia + datos de prueba deterministas + `$xl.CalculateFullRebuild()` + barrido
  `UsedRange.SpecialCells(-4123, 16)`.

### 2026-07-27 — Descarte un hallazgo CORRECTO por mirar el encabezado en vez de los datos
- Un auditor independiente reporto que el offset del arbol de `RELACIONES.TXT` era +7 y que yo
  estaba parseando con +9. Lo **descarte** mostrando el encabezado del export, que efectivamente
  pone los titulos en las columnas 0/9/18/27. **Me equivoque: el encabezado y los datos tienen
  layouts DISTINTOS.** Las filas reales ponen el sub-articulo en la columna 7 (nivel 1) y 14
  (nivel 2) — offset **+7**, como decia el README.
- **Costo medido:** con +9 el parseo devuelve 5387 lineas; con +7, 6245. Se pierden **858
  sub-ensambles** (niveles 1 y 2 completos). El nivel 0 sale identico con los dos, asi que un
  chequeo que solo mire el nivel 0 NO detecta el error — por eso la verificacion de los vinilos
  dio bien igual (los 11 codigos estaban todos en nivel 0; reverificado con ambos offsets).
- **La leccion no es sobre el arb: es sobre como se refuta.** Cuando un verificador independiente
  contradice algo mio, la contra-evidencia tiene que ser del MISMO tipo de dato que el reclamo.
  El reclamo era sobre filas de datos; yo respondi con la fila de titulos. Sirvio para confirmar
  lo que ya creia, no para probarlo.
- Codificado en `scripts/_refreshArb.mjs` (parser unico, con los chequeos) y en el README de
  `.arb-cache/`. Memorias: `reference_arb_local_cache`, `feedback_leer_el_dato_completo_antes_de_afirmar`.

### 2026-07-27 — El codigo del cliente se carga TAL CUAL; el formato solo manda si no entra
- **Cierre de Fak: "hay que respetar lo que diga el cliente y punto."** Sansuy (Perticaro)
  mando los 10 definitivos pelados (`1246030198`…) y solo el naranja completo
  (`124.505.0372-7`). Se cargan pelados, tal cual. Frene la carga pidiendo el digito
  verificador —error—: Logistica estaba esperando esa carga para ingresar material.
- Antes habia hecho el camino largo: dije "falta el digito", encontre 3 insumos pelados en el
  maestro y me auto-corregi a "no es bloqueante", Fak me corrigio a mirar la distribucion
  (de 24 codigos `124*`, **21 tienen 14 car.** y 3 tienen 10 — uno de esos 3, `1246030228`,
  duplicado de `124.602.0228-1`), y el cierre real fue que el formato del maestro **no le
  gana al cliente**.
- **La sintesis que queda:** la distribucion de largos sirve para DEDUCIR como escribir un
  codigo cuando el sistema OBLIGA a adaptarlo, no para corregirle el codigo al cliente.
  Regla operativa: ¿entra en el campo? se carga tal cual. ¿No entra? recien ahi se aplica la
  convencion del maestro y se avisa. ARTICULO tope 15 car. — por eso el PN SMRC
  `00238887-04-V209` (16) se carga `0238887-04-V209`, con un cero menos, y los
  `00238887-04-V20` viejos son ese mismo PN con el `9` cortado.
- **Meta-leccion (2da vez): la regla canonica le gana al dato puntual** — un puñado de filas
  mal cargadas no redefine una convencion. Pero ojo: la convencion interna tampoco le gana a
  la autoridad del cliente. Memorias: `feedback_codigo_del_cliente_se_carga_tal_cual`,
  `feedback_ancho_campo_arb_es_identidad`.

### 2026-07-24 — Flujograma/HO NO viven en Supabase → van al legajo del server
- Pregunta de Fak por el flujograma del APB de Novax (Patagonia) y arranque buscando en Supabase.
  Correccion fuerte de Fak: "la decision correcta era el APQP; en Supabase NO tengo cargados los
  flujogramas; es un error de inteligencia". Barack no hace PFD/HO en la app (regla `no-pfd-no-ho`):
  los flujogramas y HOs reales son archivos del legajo/SGC en `Y:`. Routing correcto:
  HOs en `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\<cliente>\<prog>\<pieza>\`
  (+ `2- SECTORES\` por proceso); flujogramas en el legajo de Ingenieria (`20- Flujograma`,
  `6-Diagramas de flujo`) o PPAP. Supabase solo para AMFE/CP, y aun asi el legajo manda para proceso.
  Detalle + memoria: `feedback_flujograma_ho_viven_en_legajo_no_supabase`. Caso: HO 971 APB Puerta
  ya tiene la inyeccion en op 50 (plasticas) y op 60 (PU) — `project_apb_puerta_novax_ho971`.

### 2026-07-24 — Monitores en background mueren con la sesion
- Un watcher de CI en background NO sobrevive al cierre de sesion/PC: prometi "te aviso
  cuando termine el deploy" y el aviso nunca llego — Fak creyo que el deploy llevaba 16 hs
  cuando habia terminado en 3 min (el run "cancelled" intermedio era el auto-cancel normal
  de GitHub al pushear un commit nuevo). Regla: para CI, chequear el estado DIRECTO y
  reportarlo en el momento; no prometer avisos diferidos salvo que la sesion siga activa.

### 2026-07-23 — NotebookLM RETIRADO → .sgc-cache propio (decision Fak)
- NotebookLM retirado por completo (ya estaba roto; Fak prefiere acceso directo a fuentes).
  Reemplazo: skill `docs-empresa` (mapa tema→documento real, rutas verificadas) + cache
  `.sgc-cache/` gitignoreado con extractos que citan `fuente:`+`rev:`+`extraido:`.
  Primera extraccion: Manual SGC completo + 19 procedimientos P-xx (rev mayor).
- Extraccion Word COM: copiar el archivo LOCALMENTE antes de abrir (.doc desde UNC cuelga
  Word — Vista Protegida) y usar `$doc.Content.Text` (SaveAs2-txt sale con encoding roto).
  Script: `scripts/_extraerSgc.ps1`.
- Los 8 notebooks viejos quedan en la nube de Google: no tocar, no citar.

### 2026-07-23 — Mantenimiento integral (auditoria de deuda + refactor CAD)
- Skill cad-design refactorizado: libreria `cadlib` + CLIs parametrizados con `--help`,
  UN interprete (`.venv-cad`, con rtree agregado), caso posicionador congelado en
  `examples/`. Gate DURO de entrega en `export_deliverables.py` (el hook solo recuerda).
- Candado CC/SC ejecutable en `runWithValidation` (bloquea `--apply` que AGREGA CC/SC;
  override `--allow-specialchar` solo con OK de Fak) + test en `__tests__/scripts/`.
- **SEGURIDAD: password de admin@barack.com estaba hardcodeada en `scripts/_archive/`
  (repo publico)** — archivos borrados; cambio de password + fixes RLS pendientes de Fak.
- **NotebookLM: los scripts globales y la registracion MCP NO EXISTEN mas** (verificado
  2026-07-23) — skills lo documentaban como vivo. RESUELTO el mismo dia: retirado (ver arriba).
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
- **NPR esta deprecado — hoy es AP (AIAG-VDA).** Manual interno I-AC-005 con "NPR>100" =
  info vieja; gana la practica de Fak. CC/SC sigue siendo solo de Fak.

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
