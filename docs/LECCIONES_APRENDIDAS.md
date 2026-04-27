# Lecciones Aprendidas — Barack Mercosul APQP

Archivo mantenido por Claude Code. Se actualiza despues de cada sesion donde algo salio mal o se aprendio algo nuevo.
Leer al inicio de cada sesion para no repetir errores.


## 2026-04-27 — INVENTO de controles tecnicos (hielo seco, ultrasonido, flexometro, rotacion inspectores) — ERROR GRAVISIMO

**Problema**: Fak detecto en Top Roll AMFE/CP/HO controles tecnicos completamente inventados:
- "Limpieza de molde programada cada 4 hs con hielo seco" — Barack NO usa hielo seco. El equipo no lo tiene, no lo compra, no lo usa.
- "Medicion por Ultrasonido cada 2 horas" — frecuencia inventada, sin justificacion tecnica ni respaldo del equipo APQP.
- "Medicion de ancho con flexometro al inicio de cada bobina" — "flexometro" es termino espanol peninsular. En Argentina se dice "cinta metrica".
- "Rotacion de inspectores cada 2 horas" — control conductual con frecuencia inventada.

**Alcance confirmado en Supabase live (2026-04-27)**:

| Producto | Doc | OP | Campo | Texto inventado | # |
|----------|-----|----|----|------------------|---|
| Top Roll Patagonia | AMFE 78eaa89b | OP 40 TERMOFORMADO | preventionControl (5 WEs) | "Limpieza de molde programada cada 4 hs con hielo seco" | 5 |
| Top Roll Patagonia | AMFE 78eaa89b | OP 40 TERMOFORMADO | detectionControl (5 WEs) | "Medicion por Ultrasonido cada 2 horas" | 5 |
| Top Roll Patagonia | AMFE 78eaa89b | OP 40 TERMOFORMADO | detectionControl (2 WEs) | "Medicion de ancho con flexometro al inicio de cada bobina" | 2 |
| Top Roll Patagonia | CP 69f6daf9 | OP 30 | controlMethod | "Limpieza de molde programada cada 4 hs con hielo seco" | 1 |
| Top Roll Patagonia | CP 69f6daf9 | OP 30 | evaluationTechnique | "Medicion por Ultrasonido cada 2 horas" | 1 |
| Top Roll Patagonia | CP 69f6daf9 | OP 30 | controlMethod | "Medicion de ancho con flexometro al inicio de cada bobina" | 1 |
| Top Roll Patagonia | HO a7201817 | (qcItem) | controlMethod | "Limpieza de molde programada cada 4 hs con hielo seco" | 1 |
| Top Roll Patagonia | HO a7201817 | (qcItem) | controlMethod | "Medicion por Ultrasonido cada 2 horas" | 1 |
| Top Roll Patagonia | HO a7201817 | (qcItem) | controlMethod | "Medicion de ancho con flexometro al inicio de cada bobina" | 1 |
| IP PAD | AMFE c9b93b84 | OP 80 / OP 100 / OP 130 | preventionControl | "Rotacion de inspectores cada 2 horas" | 3 |
| Telas Termoformadas PWA | AMFE c5201ba9 | OP 100 CONTROL FINAL | preventionControl | "Rotacion de inspectores cada 2 horas" | 1 |

**Total: 22 ocurrencias en 6 documentos (3 productos)**.

**Causa raiz**: Claude (sesion anterior) generaba contenido para llenar campos `preventionControl`/`detectionControl`/`controlMethod` cuando faltaban. En lugar de usar **TBD** o "Pendiente definicion equipo APQP", invento:
- Equipos que Barack no tiene (hielo seco, ultrasonido con frecuencia)
- Frecuencias sin respaldo (cada 2h, cada 4h)
- Terminos en espanol peninsular (flexometro)

Esto es identico al incidente de 2026-03-30 donde se inventaron 408 acciones de optimizacion. La regla `.claude/rules/amfe-actions.md` cubria acciones, pero NO controles. **Gap de regla**.

**Fix aplicado**:
1. Nueva regla `.claude/rules/amfe-no-inventar-controles.md` — extiende prohibicion de inventar a TODO control (prevention/detection/sampling/frequency).
2. Memoria cross-proyecto `feedback_no_inventar_controles.md` (auto-load global).
3. Diccionario de espanolismos a evitar (criterio argentino).
4. Auditor `_auditInventos.mjs` script read-only que detecta patrones sospechosos.

**Correccion de datos**: PENDIENTE confirmacion Fak. Opciones:
- A) Reemplazar todo por placeholder "Pendiente definicion equipo APQP" (preserva auditabilidad)
- B) Vaciar y dejar TBD
- C) Fak dicta los controles reales y Claude copia textualmente

**Prevencion para sesiones futuras**:
- NUNCA inventar nombres de equipos. Si no se que equipo se usa: TBD + preguntar.
- NUNCA inventar frecuencias ("cada N horas", "cada N piezas"). Si no se sabe: TBD.
- NUNCA usar terminos espanoles peninsulares. Diccionario:
  - flexometro -> cinta metrica
  - ordenador -> computadora / PC
  - movil -> celular
  - fichero -> archivo
  - raton -> mouse
  - grifo -> canilla
  - coger -> agarrar / tomar
- Si Fak no menciono el equipo o tecnica, NO usarlo. Usar las palabras de Fak.

---

## 2026-04-08 — Agentes NO leen documentacion automaticamente — ERROR GRAVE

**Problema**: Los agentes auditor y de modificacion AMFE NO leian los archivos de referencia (feedback_auditor_role.md, GUIA_AMFE.md, .claude/rules/amfe.md). Claude les pasaba instrucciones en el prompt pero no les decia que leyeran los protocolos. Resultado: errores obvios no detectados.

**Causa raiz**: Claude asumia que el prompt era suficiente. Los archivos tienen checks que Claude puede olvidar.

**Prevencion OBLIGATORIA**:
- Agente AUDITOR: incluir en prompt "Leer feedback_auditor_role.md y ejecutar TODOS los checks"
- Agente que MODIFICA AMFE: incluir "Leer docs/GUIA_AMFE.md y .claude/rules/amfe.md"
- Agente que MODIFICA CP: incluir "Leer .claude/rules/control-plan.md"
- Agente que MODIFICA HO: incluir "Leer .claude/rules/hoja-operaciones.md"

---

## 2026-04-08 — Failures sin severity = celdas vacias en export

**Problema**: 9 failures tenian severity=undefined. Export mostraba celdas vacias. Auditor buscaba severity en causa (c.severity) en vez de failure (f.severity).

**Causa raiz**: severity vive en AmfeFailure, NO en AmfeCause. Scripts que crean ops nuevas no asignaban severity al failure.

**Prevencion**: Validacion A8 + checks 2a/2b en protocolo auditor.

---

## 2026-04-08 — Export Excel roto por campos AMFE con nombre equivocado

**Problema**: Scripts .mjs crearon WEs con campo `description` en vez de `name`+`type`, y no sincronizaron aliases `opNumber`/`operationNumber`. Export Excel lee `op.opNumber` y `we.name` — columnas vacias si faltan.

**Causa raiz**: Scripts no conocen el schema TypeScript. AMBOS aliases deben existir: opNumber+operationNumber, name+operationName, ap+actionPriority, cause+description.

**Fix**: fixIpPadWeFields.mjs + fixIpPadAliases.mjs. Regla agregada en .claude/rules/amfe.md seccion Schema.

**Prevencion**: SIEMPRE leer un WE existente como referencia antes de crear nuevos. SIEMPRE usar ambos aliases.

---

## 2026-04-07 — Inconsistencia de nombres de campos entre documentos VWA

**Problema**: Los AMFEs VWA usaban nombres de campos no estandarizados heredados de los PDFs de referencia de planta. Especificamente:
- `operationNumber` en vez de `opNumber` (el campo que usa el TypeScript)
- `operationName` en vez de `name`
- `actionPriority` en vez de `ap`
- `severity` en la causa en vez de en el failure (el estandar VDA lo pone en el failure)

Esto afectaba a los 6 AMFEs VWA (HEADREST_FRONT, HEADREST_REAR_CEN, HEADREST_REAR_OUT, ARMREST_DOOR_PANEL, TOP_ROLL, INSERT) y al IP PAD. Los PWA tambien tenian string "undefined" en campos ap/actionPriority.

**Correccion aplicada**:
- Se crearon aliases bidireccionales: cada operacion ahora tiene TANTO `opNumber` como `operationNumber`, TANTO `name` como `operationName`.
- Se movio `severity` de la causa al failure (max de las causas hijas).
- Se agrego `ap` como alias de `actionPriority` en todas las causas.
- Se limpiaron strings literales "undefined" en todos los documentos.
- La funcion `normalizeAmfeDoc()` en `amfeRepository.ts` ayuda en runtime pero solo rellena defaults vacios, NO renombra campos existentes.

**Regla**: Al cargar datos desde PDFs de referencia, verificar que los nombres de campos coincidan con los tipos TypeScript (`amfeTypes.ts`). Los campos canonicos son `opNumber`, `name`, `ap`, y severity en el failure (no en la causa).

## 2026-04-08 — Export Excel roto por campos AMFE con nombre equivocado

**Problema**: Scripts .mjs crearon WEs con campo `description` en vez de `name`+`type`, y no sincronizaron aliases `opNumber`/`operationNumber`. Export Excel lee `op.opNumber` y `we.name` — columnas vacias si faltan.

**Causa raiz**: Scripts no conocen el schema TypeScript. AMBOS aliases deben existir: opNumber+operationNumber, name+operationName, ap+actionPriority, cause+description.

**Fix**: fixIpPadWeFields.mjs + fixIpPadAliases.mjs. Regla agregada en .claude/rules/amfe.md seccion Schema.

**Prevencion**: SIEMPRE leer un WE existente como referencia antes de crear nuevos. SIEMPRE usar ambos aliases.

---

## 2026-04-07 — Auditoria de seguridad: protecciones contra eliminacion accidental

**Problema**: Fak reportó que todos los AMFEs se borraron de Supabase. Se investigó el código y se encontraron vulnerabilidades:
1. `DataManager.tsx` usaba `window.confirm()` nativo para restaurar backups — un click rápido podía destruir toda la data
2. Eliminaciones masivas (carpeta cliente/proyecto) solo pedían un click de confirmación
3. Las operaciones DELETE en repositorios no guardaban copia de seguridad — una vez borrado, irrecuperable
4. No existía tabla `deleted_documents` para recuperar documentos borrados

**Correcciones aplicadas**:
- Reemplazado `window.confirm()` por `ConfirmModal` con variant=danger en DataManager
- Agregado `requireTextConfirm` al ConfirmModal — para eliminaciones masivas hay que escribir el nombre del proyecto/cliente
- Implementado soft-delete en todos los repositorios APQP (amfe, cp, ho, pfd) — antes de DELETE, se guarda copia en `deleted_documents`
- Creada tabla `deleted_documents` en migración SQLite v15→v16
- Los names de tabla en queries SQL ahora usan allowlist hardcodeada (no interpolación de variables)

**Regla**: Toda operación destructiva debe tener al menos ConfirmModal con variant=danger. Eliminaciones masivas (>1 doc) requieren escribir el nombre para confirmar.


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

### Carga AMFE IP PADs / TRIM ASM-UPR WRAPPING (2026-04-06)
- **Producto nuevo** (no es una de las 8 familias canonicas). Equipo diferente: Paulo Centurion (no Carlos Baptista).
- La columna data en Supabase amfe_documents es TEXT. typeof data === 'string' es normal. Verificar con JSON.parse(data).
- La tabla amfe_documents NO tiene columna name. Usar subject y project_name.
- Al insertar, campos obligatorios: id, amfe_number (UNIQUE), project_name, subject, data.
- **Flamabilidad faltante:** El PDF fuente NO incluye flamabilidad. Es OBLIGATORIO para VWA interior. Equipo APQP debe agregarla.
- CC solo para producto/usuario final. Seguridad del operador (cortadura, quemadura, ventilacion) NO es CC.
- **Error copy-paste OP 130:** causa 'Falta de EPP' en FM 'Falta de identificacion' no tiene sentido. Revisar.
- OP 120 se llamo 'INSPECCION FINAL' pero el estandar es 'CONTROL FINAL DE CALIDAD'.

### componentMaterial en CP (2026-04-06)
- El generador de CP NUNCA llena componentMaterial automaticamente — siempre queda vacio.
- Los materiales en items de recepcion (OP 10) deben asignarse manualmente o via script post-generacion.
- Validacion B1 advierte pero no bloquea items de recepcion sin material.

## 2026-04-08 — Export Excel roto por campos AMFE con nombre equivocado

**Problema**: Scripts .mjs crearon WEs con campo `description` en vez de `name`+`type`, y no sincronizaron aliases `opNumber`/`operationNumber`. Export Excel lee `op.opNumber` y `we.name` — columnas vacias si faltan.

**Causa raiz**: Scripts no conocen el schema TypeScript. AMBOS aliases deben existir: opNumber+operationNumber, name+operationName, ap+actionPriority, cause+description.

**Fix**: fixIpPadWeFields.mjs + fixIpPadAliases.mjs. Regla agregada en .claude/rules/amfe.md seccion Schema.

**Prevencion**: SIEMPRE leer un WE existente como referencia antes de crear nuevos. SIEMPRE usar ambos aliases.

---

## 2026-04-07 — Reemplazo motor PFD: SVG → HTML/Tailwind

**Cambio**: Se reemplazo el motor SVG manual (pfdSvgExport.ts, 850 lineas) con un motor React+Tailwind basado en el generador de Fak (industrial-flowchart-generator.zip).

**Arquitectura nueva**:
- `flowTypes.ts` + `pfdToFlowData.ts` — tipos intermedios y mapper
- `modules/pfd/flow/` — 8 componentes React con inline styles
- `pfdHtmlExport.ts` — ReactDOMServer.renderToStaticMarkup() para HTML standalone
- `pfdSvgExport.ts` — facade de re-export (backward compat)
- API publica sin cambios: buildPfdSvg(), exportPfdSvg(), generatePfdSvgBuffer()

**Lecciones**:
- Usar inline styles (no Tailwind classes) en componentes para renderToStaticMarkup
- Decision nodes no repetir descripcion en columna derecha (ya esta como labelCondition)
- Virtual split nodes (branches sin stepId) no renderizar FlowNode, solo BranchSplit
- Deduplicar reference lines: applicableParts como fuente primaria

**Pendientes proxima sesion**: leyenda posicionar derecha, labels ramas paralelas, cargar datos IP PAD, auditor

### 2026-04-07 — Sesion 2: Motor PFD HTML/Tailwind

**Errores cometidos:**
- Verificar visualmente antes de reportar "listo" — varias veces reporté como terminado sin haber verificado realmente el output
- scale(0.6) en CSS transform no reduce el espacio reservado del elemento — usar SVGs inline de tamaño fijo
- tsx cachea módulos — usar --no-cache flag al regenerar test HTML
- "CLAVE" no existe como clasificación APQP — solo CC y SC son válidas
- Revisado por ≠ Aprobado por — son roles diferentes, nunca la misma persona

**Correcciones de Fak:**
- Header del flujograma era gigante — compactar con py-[3px], grid-cols-[1fr_2fr_1fr], juntar Elaborado+Revisado y Proyecto+Cliente
- Nota CC/SC y leyenda flotaban en espacio vacío gris — mover dentro del contenedor blanco <main>
- Leyenda REFERENCIAS va dentro de la caja de listado de piezas, no separada abajo
- Alineación de leyenda: usar CSS grid 2 columnas (30px | auto) centrado, NO flex con items-center
- Eliminar "CLAVE" de todo el código PFD — solo existen CC y SC

**Lo que funcionó bien:**
- Motor React+Tailwind con renderToStaticMarkup para export standalone HTML
- SVGs inline mini (24x16 viewBox) para leyenda compacta perfectamente alineada
- Script genTestPfd.ts para regenerar HTML sin depender del dev server
- flowStyles.ts con CSS utilities embebidas para export standalone

---

## 2026-04-12 — Auditoria Maestro de Inyeccion (AMFE + CP)

### Hallazgos y correcciones

1. **cause_count desincronizado**: metadata decia 28, real era 65. Fix: re-sync a 65.
2. **CP items incompletos**: items [5],[14],[15],[16] tenian controlMethod y processCharacteristic vacios. Llenados con metodos correctos de otros CPs.
3. **operationFunction no propagado**: HF/HRC/HRO OP40 tenian operationFunction vacio a pesar de que el maestro lo tenia. Propagado a los 3 AMFEs.
4. **approvedBy vacio en header AMFE maestro**: seteado a "Carlos Baptista".

### Causas raiz criticas

1. **Nombre de campo incorrecto para failure modes**: Los modos de falla estan en `fn.failures`, NO en `fn.failureModes`. Tres agentes auditores contaron 0 causas porque usaban el campo equivocado. REGLA: SIEMPRE usar `fn.failures` al recorrer funciones del AMFE.
2. **RLS bloquea queries sin autenticacion**: La anon key de Supabase devuelve 0 filas. TODOS los scripts DEBEN llamar `sb.auth.signInWithPassword()` antes de cualquier query. Un agente reporto "tablas vacias" por no autenticarse.
3. **Metadata nunca re-sincronizada**: cause_count no se actualizo despues de agregar causas al maestro. Todo script que agregue/elimine causas debe re-sincronizar metadata.
4. **Generador de CP incompleto**: El script de generacion no llenaba controlMethod para todos los items. Verificar campos requeridos post-generacion.
5. **Propagacion incompleta**: operationFunction no estaba incluido en la propagacion cross-family. El codigo de propagacion debe incluir este campo.

### Reglas nuevas

- **AUTENTICACION OBLIGATORIA**: Todo script .mjs que consulte Supabase DEBE autenticarse con `signInWithPassword()` ANTES de hacer queries. Sin esto, RLS devuelve 0 filas y el script reporta falsos resultados.
- **Campo de failure modes**: Es `fn.failures`, NO `fn.failureModes`. Verificar en cualquier script o agente que recorra la estructura del AMFE.

---

## 2026-04-13 — Inglés y vocabulario rebuscado en documentos APQP — ERROR GRAVE

**Problema**: Claude inventó textos técnicos complejos con términos en inglés (gauge, pattern board, runner, gate, setup, flashes, sink marks) y vocabulario rebuscado que Fak no entiende (husillo, dossier, "rebaba residual ni bebedero visible en el punto de inyección").

**Alcance**: 120+ términos en inglés en 11 documentos + 1756 textos simplificados + 286 "dossier" + 48 "husillo" + 54 "chupados". Total: ~2000+ correcciones.

**Causa raíz**: Claude completaba campos con texto inventado y vocabulario técnico que nadie pidió. Los documentos son preliminares y no necesitan ese nivel de detalle.

**Prevención OBLIGATORIA**:
- CERO inglés en documentos APQP. Ni parentéticos "(runner)" ni standalone.
- Textos CORTOS: máximo 8-10 palabras por campo.
- NO inventar contenido técnico. Si falta info → TBD.
- Usar las MISMAS palabras que usa Fak. Si Fak dice "tornillo", NO poner "husillo".
- Pieza inyectada con defecto = scrap. NO "retrabajo según gravedad" (no se retrabaja plástico inyectado excepto cortar rebabas).

---

## 2026-04-13 — Maestro de Logística y Recepción creado (family 16)

**Cambio**: OP 10 (Recepción de Materia Prima) sacada del Maestro de Inyección (family 15) y movida a nuevo Maestro de Logística y Recepción (family 16). Per AIAG CP 2024 "Procesos Interdependientes".

**Pellets consolidados**: 4 entradas redundantes → 2 categorías: "Pellet higroscópico (ABS/PC/PA/PET)" + "Pellet termoplástico estándar (PP/PE)". Per AIAG CP 2024 reducción de complejidad.
