# Lecciones Aprendidas — Barack Mercosul APQP

Archivo mantenido por Claude Code. Se actualiza despues de cada sesion donde algo salio mal o se aprendio algo nuevo.
Leer al inicio de cada sesion para no repetir errores.

## 2026-04-06 — Work Elements: UN solo item por fila (regla 1M por linea)

**Error**: Se agrupaban multiples materiales en un solo Work Element: "Material: Tela / Refuerzos / Hilos / Aplix". Esto destruye el hilo digital del AMFE porque cada material tiene funciones y causas de falla distintas.

**Correccion**: Un experto AIAG-VDA confirmo que el estandar exige UNA sola M por linea. Cada material/maquina/metodo debe tener su propia fila con su propia cadena funcion → falla → causa.

**Regla adicional**: En operaciones de proceso, "Material" en 4M/6M se refiere a materiales INDIRECTOS. Los directos se evaluan en Recepcion o DFMEA. Solo listar directos en una estacion si hay riesgo de interaccion (operador carga material equivocado, material se dana en manipuleo).

**Impacto**: Todos los 8 AMFEs deben ser revisados para separar WE agrupados.

## Errores de datos

- **2026-03-30:** Acciones de optimizacion inventadas en 8 AMFEs (408 acciones falsas eliminadas). REGLA: NUNCA inventar acciones de optimizacion. Solo el equipo APQP humano las define.
- **2026-03-30:** Pesos reemplazados parcialmente ("420 +/- TBD" en vez de "TBD"). REGLA: TBD significa reemplazar el valor COMPLETO, no mezclarlo con datos reales.
- **2026-03-31:** Modos de falla de Telas Planas copiados de Termoformadas (proceso equivocado). REGLA: SIEMPRE verificar que los FM describan el proceso REAL del producto.
- **2026-03-31:** Numeracion con letras (10a, 10b, 10c) en vez de numeros secuenciales. REGLA: cada operacion tiene su propio numero secuencial (10, 20, 30...).

## Errores de codigo

- **2026-03-30:** Regla SC = S>=5 AND O>=4 implementada en 4 ubicaciones del codigo. REGLA: CC si S>=9, SC solo si el AMFE ya lo marca explicitamente o el cliente lo designa.
- **2026-03-30:** Deploy a GitHub Pages sin secrets borraba dev-login. REGLA: CI necesita los 4 secrets de GitHub (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AUTO_LOGIN_EMAIL, VITE_AUTO_LOGIN_PASSWORD).

## Errores de proceso

- **2026-03-30:** HO QC items viejos no se sobreescribian al regenerar. REGLA: al regenerar, sobreescribir SIEMPRE los campos heredados, no verificar si ya hay items.
- **2026-03-31:** sampleSize con numeros inventados en vez de copiar del CP de referencia. REGLA: copiar de Plan de Control de referencia exactamente.
- **2026-03-31:** reactionPlan con texto inventado tipo "Capacitar al personal". REGLA: solo usar "P-14." o "Segun P-09/I." o texto exacto del CP de referencia.

## Errores de formato

- **2026-03-31:** Nombres de operaciones en ingles o inconsistentes entre documentos. REGLA: nombres estandarizados en espanol, IDENTICOS entre PFD, AMFE, CP y HO.
- **2026-03-31:** Header con "Software" o nombres de empresa incorrectos. REGLA: "BARACK MERCOSUL" (mayusculas), cliente "VWA" o "PWA", sin "Software".

## Errores tecnicos del seed (2026-04-01)

- SupabaseAdapter.execute() con exec_sql_write RPC falla SILENCIOSAMENTE para INSERTs complejos (COALESCE, subqueries). El seed reportaba "OK" pero no persistia nada. REGLA: despues de un seed, SIEMPRE verificar con SELECT directo en Supabase. NUNCA confiar en que "no tiro error" = "funciono".
- Columnas de Supabase NO son iguales al schema SQLite local. SQLite tiene created_by/updated_by/modified_by_type pero Supabase no. REGLA: verificar columnas reales antes de upsert directo.
- Para seeds masivos, usar supabase.from().upsert() directo. Los repositorios (saveAmfeDocument etc.) usan el SupabaseAdapter que falla silenciosamente con SQL complejo.
- Importar estaticamente el seed en App.tsx mete codigo de carga en el bundle de produccion. Usar import() dinamico desde consola.

## Errores de contenido APQP (2026-04-01)

- Seed viejo de Telas Planas tenia "Capacitacion del operario" como control preventivo en 3 causas. REGLA: NUNCA (ya documentada en feedback-amfe-capacitacion.md pero el seed no la respetaba).
- Seed mezclaba operaciones: OP 45 "Colocado de Aplix" usaba "Maquina de costura" como maquina. REGLA: cada operacion tiene la maquina REAL de esa operacion, no la de otra.
- Seed tenia solo 1 Work Element (6M) por operacion. En realidad costura tiene Machine + Man, corte tiene Machine + Man, preparacion tiene Method. REGLA: usar los 6M reales del proceso.
- Try out de piso (25/03/2026) detecto tela con lado liso/felpudo invertido — no cubierto en AMFE. REGLA: try outs y 8Ds del piso SIEMPRE deben alimentar el AMFE con modos de falla nuevos.
- PFD no tenia almacenamientos WIP entre corte y costura. Las piezas van en bolsa con etiqueta WIP. REGLA: documentar el flujo REAL incluyendo embalajes WIP y transportes intermedios.

## Errores de comportamiento de Claude (2026-04-01)

- Al terminar, pregunte "queres que registre las lecciones?" en vez de hacerlo directamente. Viola la regla "NUNCA preguntar queres que haga X". REGLA REFORZADA en CLAUDE.md: si te encontras a punto de escribir "queres que...?" — PARA. Hacelo y reporta.

## Auditoria PWA (2026-04-06)

### Hallazgos y correcciones aplicadas
- **Flamabilidad CC Termoformadas:** AMFE tenia FM con severity vacia y specialChar=CC. Se asigno S=10. CP tenia classification="undefined" — corregido a "CC".
- **Flamabilidad CC Planas:** AMFE NO tiene FM de flamabilidad explicito. CP flamabilidad sin CC — corregido. PENDIENTE: agregar FM flamabilidad al AMFE.
- **Planas AMFE ya limpio:** Los FM de Termoformadas ya habian sido limpiados previamente. La correccion #3 no fue necesaria.
- **Nombres estandarizados:** 12 nombres alineados (Recepcion, Control Final, Embalaje) en AMFE/CP/HO.
- **Ops retrabajos Termo:** OP 11 y OP 61 agregados con FM=TBD.
- **EPP:** 23 sheets con EPP asignado segun tipo de operacion.
- **QC items Planas:** 19 controles del CP vinculados a la HO.

### Lecciones tecnicas
- **opNumber tiene prefijo "OP ":** datos reales usan "OP 10" no "10".
- **HO matchea por linked_amfe_project**, no por part_number (vacio en PWA).
- **PFD NO tiene project_name** — matchear por part_number.
- **SIEMPRE diagnosticar estado actual antes de fix:** el doc de comparacion estaba desactualizado.
- **CP classification "undefined":** era string literal "undefined" no undefined JS.

### Pendientes para Fak
- A. Part number Planas: 21-8909/21-9463/21-6567
- B. Cantidades: agujeros 40vs17, aplix 35vs9, pzs/medio 50vs25
- C. Temperatura horno Termo: 100/150/200C
- D. Planas OP 15 y clips/dots vigentes?
- E. Gramajes Termo actuales
- F. Norma flamabilidad PWA (NO TL 1010)
- G. Planas no tiene FM flamabilidad en AMFE

### Regla nueva: Backup obligatorio al fin de sesion (2026-04-06)
- **SIEMPRE** correr `node scripts/_backup.mjs` al final de cada sesion. Esto genera un snapshot JSON de toda la base Supabase en `backups/`. Si se borran datos accidentalmente (como los 6 AMFEs VWA), se pueden restaurar desde el ultimo backup.
- Agregado al protocolo de fin de sesion en CLAUDE.md como paso 4.
- El script `_backup.mjs` guarda 12 tablas: amfe_documents, cp_documents, ho_documents, pfd_documents, product_families, product_family_members, family_documents, family_document_overrides, family_change_proposals, products, customer_lines, settings.

### Borrado masivo de 6 AMFEs VWA — incidente y recuperacion (2026-04-06)
- **Incidente**: 6 AMFEs VWA fueron borrados accidentalmente (Insert, Armrest, Top Roll, Headrest Front/Rear Center/Rear Outer). No habia backup reciente.
- **Recuperacion**: Se restauraron desde el seed original + se enriquecieron con datos reales extraidos de los PDFs/Excels de referencia del servidor (AMFEs oficiales de planta).
- **Enriquecimiento VWA**: 206 causas fueron pobladas con datos reales de los AMFEs de referencia (severidades, ocurrencias, detecciones, controles). Los AMFEs VWA pasaron de tener datos genericos del seed a tener datos calibrados con la documentacion oficial.
- **Proteccion implementada**: Se agrego codigo de proteccion contra borrado masivo en la app. Antes de eliminar multiples documentos, el sistema ahora pide confirmacion explicita y no permite borrar mas de un umbral sin validacion extra.
- **Leccion**: SIEMPRE tener un backup reciente antes de operar sobre documentos. El backup se agrego como paso obligatorio de fin de sesion (ver regla de backup).

### componentMaterial en CP (2026-04-06)
- El generador de CP NUNCA llena componentMaterial automaticamente — siempre queda vacio.
- Los materiales en items de recepcion (OP 10) deben asignarse manualmente o via script post-generacion.
- Validacion B1 advierte pero no bloquea items de recepcion sin material.
