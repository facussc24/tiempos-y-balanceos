# Lecciones Aprendidas — Barack Mercosul APQP

Archivo mantenido por Claude Code. Se actualiza despues de cada sesion donde algo salio mal o se aprendio algo nuevo.
Leer al inicio de cada sesion para no repetir errores.

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
