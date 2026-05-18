# Lecciones Aprendidas — Barack Mercosul APQP

Archivo mantenido por Claude Code. Se actualiza despues de cada sesion donde algo salio mal o se aprendio algo nuevo.
Leer al inicio de cada sesion para no repetir errores.


## 2026-05-14 (PARTE 2) — Automejora: nuevo auditor detecta 76 placeholders pobres + failures mal alocados en 9/12 AMFEs

**Contexto:** Tras la PARTE 1 (renumeracion), Fak abrio el AMFE-HF-PAT en la UI y encontro contenido absurdo que _auditAll.mjs NO detectaba:
- WE.name = "Proceso Op X" (placeholder pobre literal de OPs renumeradas)
- WE.name = "Maquina"/"Material"/"Metodo" (etiquetas 6M genericas puras — la regla `amfe-funciones-3-niveles.md` linea 223 ya marcaba "TODO: agregar check WE_GENERIC_PLACEHOLDER" pero nunca se implemento)
- failures con keywords incompatibles con la OP (ej. "Costura descosida" en OP CORTE)

**4 agents Explore en paralelo investigaron**:
- A1: confirmo 14 issues criticos solo en HF-PAT
- A2: brecha documentacion <-> implementacion (regla existe, auditor no implementa)
- A3: tecnicas Anthropic 2026 (hooks PostToolUse, audit-trail JSONL, subagent auditor independiente)
- A4: criterio AIAG-VDA canonico para WE.name = `[Recurso especifico] (Categoria M)`

**Solucion aplicada (defensa en profundidad)**:
1. **Regla nueva** `.claude/rules/amfe-leer-contenido-antes-de-renumerar.md`: lectura obligatoria pre-renumeracion, tabla diff, keyword->OP canonica, vectores de test.
2. **Auditor nuevo** `scripts/_auditWePlaceholdersAndAllocation.mjs`: 6 checks (WE_PROCESS_OP_PLACEHOLDER, WE_GENERIC_LABEL, WE_NAME_EQUALS_TYPE, WE_NAME_FOREIGN_OPNUMBER, FN_GENERIC_LABEL, FAILURE_MISALLOCATED). Heuristica ambiguity-aware: si 2+ keywords incompatibles, NO marcar (review humana).
3. **Auditor integrado** a `_auditAll.mjs` (sub-auditor invocado al final).
4. **Fix universal** `scripts/_fixAmfePlaceholdersAndAllocation.mjs`: reemplaza placeholders por "Pendiente definicion equipo APQP" (regla `amfe-aph-pending.md`), elimina WEs sin failures, mueve failures mal alocados a OP destino por keyword canonica.
5. **Memoria nueva** `~/.claude/projects/.../memory/feedback_renumerar_sin_leer_contenido.md` + index MEMORY.md.

**Resultado audit**:
- Antes: 76 CRITICAL en 9/12 AMFEs (HF-PAT=22, HRC-PAT=20, HRO-PAT=12, 150=6, IPPADS=5, AMFE-1=4, AMFE-2=3, ARM-PAT=2, TR-PAT=2)
- Despues: **0 CRITICAL** en 12/12 AMFEs
- Cambios aplicados: 50+ WEs renombrados, 15+ failures movidos, 0 orphans, 9 warnings nuevos (FN_NO_FAILURES en OPs cuyas failures se movieron)

**Lecciones**:
- **Conteo NO es lectura**: nunca afirmar "OP X tiene N WEs" sin listar `WE.name` y `failure.description`
- **Renumerar antes de auditar contenido es error sistemico**: el incidente 2026-04-20 (sync injection master a Headrest) introdujo los placeholders; mi renumeracion 2026-05-14 los expuso pero no los corrigio
- **Heuristicas keyword->OP requieren ambiguity awareness**: si 2 reglas incompatibles matchean (ej. "fuga PUR por costura abierta") no mover automaticamente

**Auditor que ahora atrapa esto**: `scripts/_auditWePlaceholdersAndAllocation.mjs` (integrado a `_auditAll.mjs`).


## 2026-05-14 — Renumeracion AMFE puede dejar contenido legacy mal alocado conceptualmente

**Contexto:** Fak armo PFD preliminar nuevo del Front Headrest Patagonia (P-APO-001/PRE rev 04/05/2026) cambiando completamente el orden de las OPs respecto al AMFE legacy. Aplique renumeracion masiva (scripts/_renumberHfPatToNewPfd.mjs): 14 OPs cambiaron de numero y orden.

**Problema:** despues de renumerar `op.opNumber`, el CONTENIDO de causas/modos de falla quedo pegado a la fila original. Resultado:
- OP 50 ENFUNDADO (era OP 60): contenido legacy de inyeccion PU (fuga, peso, rebaba) — NO pertenece a enfundado
- OP 51 INSERCION VARILLA (era OP 70): contenido legacy de costura vista (desviacion, tensiones de hilo) — NO pertenece a varilla
- OP 63 INYECCION PU (era OP 50): contenido legacy mezclado (varilla desalineada, tiempo presion, sellado orificio)

**Causa raiz del problema legacy:** el AMFE original ya tenia causas mal alocadas (probablemente copy-paste de otros AMFEs). La renumeracion *expuso* el problema porque al renombrar, el desajuste se hizo visible.

**Lo que SI hice (sin tocar contenido):** renumeracion + reordenamiento + creacion OPs placeholder + fill operationFunctions + fix focusElementFunction (incidente 2026-04-20 reincidente: 5 OPs con texto generico de inyeccion plastica) + sync metadata cache.

**Lo que NO hice (correctamente):** reasignar causas a las OPs que conceptualmente corresponden. Eso es DECISION DEL EQUIPO APQP — implica decidir si una causa "puntada floja" se queda donde esta legacy o se mueve a OP 40 costura vista; si "fuga PU" se mueve a OP 63 o se queda en OP 50.

**How to apply en proximas sesiones:**
1. ANTES de renumerar un AMFE, leer el contenido (causas, modos) de cada OP y verificar que conceptualmente pertenece a esa OP.
2. Si el contenido esta mal alocado, REPORTAR a Fak ANTES de renumerar — no asumir que el mapeo `opNumber` es suficiente.
3. Renumeracion mecanica = OK autonomo. Reasignacion semantica de contenido = requiere equipo APQP.

**Estado tras esta sesion (AMFE-HF-PAT 10eaebce):**
- Renumeracion estructural completa ✓
- focusElementFunction Headrest correcto en 16 OPs ✓
- 7 OPs vacias placeholder (28 mylar, 60-62 pre-PU, 80-82 reprocesos) — equipo APQP debe completar
- Contenido legacy mal alocado en OPs 50/51/63 — pendiente decision Fak/equipo APQP


## 2026-05-04 — FALSO POSITIVO en auditoria PFD por leer dump tmp/ stale (incidente "OP 72 Armrest")

**Problema:** Fak hizo el PFD del Armrest Door Panel (P-ARM-001/PRE) y pidio auditoria antes de subirlo al SGC. Reporte como "error critico" que faltaba **OP 72 ENSAMBLE CON SUSTRATO** entre OP 70 (INYECCION PU) y OP 80 (ADHESIVADO).

**Realidad:** la OP 72 NO debia estar. Fue eliminada el mismo dia 2026-05-04 por el script `scripts/_applyAudit2026May04.mjs` PATCH 1, motivo: **"copy-paste roto: nombre vs contenido"** — el nombre era "ENSAMBLE CON SUSTRATO" pero los workElements/failures eran de otra operacion (probable copy-paste mal hecho del Insert o similar). En vez de reparar el contenido roto, se decidio eliminar la OP porque no aplicaba al proceso real del Armrest.

**Causa raiz del error de Claude:** lei `tmp/amfe_audit/AMFE-ARM-PAT.json` (snapshot pre-patch) y lo trate como fuente de verdad. NO query Supabase live para verificar el estado actual. Los skills `verify-before-claim` + `cross-check` me forzaron a citar fuente — cite el dump y "cumpli formalmente" la regla, pero el dump era stale.

**Otro hueco:** este patch del 2026-05-04 (que tocaba 6 AMFEs: Armrest, APB-150, 3 Headrests, IP PAD) NO se documento en este archivo cuando se aplico. Por eso no me protegio el "leer LECCIONES_APRENDIDAS al inicio de sesion".

**Patches aplicados el 2026-05-04 (6 documentos APQP):**

| Patch | AMFE | id | Cambio | Motivo |
|---|---|---|---|---|
| 1 | AMFE-ARM-PAT (Armrest) | 5268704d-30ae-48f3-ad05-8402a6ded7fe | Eliminar OP 72 | Copy-paste roto: nombre vs contenido |
| 2 | 150 (APB_TRA_CEN) | 37cab669-0543-43c0-bb78-d00638114530 | (ver script) | (ver script) |
| 3 | AMFE-HF-PAT (Headrest Front) | 10eaebce-ad87-4035-9343-3e20e4ee0fc9 | (ver script) | (ver script) |
| 4 | AMFE-HRC-PAT (HR Rear Cen) | e9320798-ceaa-4623-97e9-92200b5234b6 | (ver script) | (ver script) |
| 5 | AMFE-HRO-PAT (HR Rear Out) | beda6d47-30ae-4d5f-81e0-468be8950014 | (ver script) | (ver script) |
| 6 | VWA-PAT-IPPADS-001 (IP PAD) | c9b93b84-f804-4cd0-91c1-c4878db41b97 | (ver script) | (ver script) |

Detalle completo en `scripts/_applyAudit2026May04.mjs` y `scripts/_verifyAudit2026May04.mjs`.

**Correcciones implementadas este dia (para que no se repita):**

1. **Nueva regla auto-load** `BarackMercosul/.claude/rules/verify-supabase-live.md` — auto-carga en cualquier interaccion sobre AMFE/CP/HO/PFD. Define que Supabase live es la unica fuente de verdad y `tmp/`, `backups/`, `_all_amfes_dump.json` son fotografias historicas que NO sirven para reportar estado.

2. **Skill mejorado** `~/.claude/skills/verify-before-claim/SKILL.md` — fila nueva en tabla de verificacion + caso especial Barack: "estado actual AMFE/CP/HO/PFD/family/product → Query Supabase live, NO leer dumps tmp/backups".

3. **Memoria cross-project** `feedback_supabase_is_truth.md` indexada en MEMORY.md.

4. **Esta entrada** documentando los 6 patches y la regla nueva.

**Aplicacion futura:**
- Antes de afirmar el estado de un AMFE/CP/HO/PFD: query Supabase con .mjs (snippet en regla `verify-supabase-live.md`).
- Si voy a citar `tmp/amfe_audit/X.json` o similar: PARAR. Solo es valido si la pregunta es explicitamente historica.
- Cualquier patch que toque Supabase debe documentarse aqui el mismo dia (regla CLAUDE.md: "Protocolo de fin de sesion").


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

### Segundo barrido (mismo dia, despues del primer fix)

Auditor amplio detecto mas patrones invento:

| Tipo | Texto | Productos | # |
|------|-------|-----------|---|
| Equipo inexistente | "**CMM 3D**" (Maquina de Medicion por Coordenadas) | Telas Termo OP 80 + Telas Planas OP 80 | 8 |
| Lenguaje rebuscado | "Guía física en la máquina de coser y ajuste validado del pie y avance, junto con puesta a punto estandarizada / setup estandarizado para asegurar..." | Headrest F/RC/RO, Armrest, AMFE-150 | 19 |
| Lenguaje rebuscado | "Procedimiento de limpieza y purga estandarizado para la cavidad y línea de partición del molde" | Armrest, Insert, Top Roll | 7 |
| Lenguaje rebuscado | "Instrucción de Puesta a punto Estandarizada (Plan de Control / Hoja de Proceso) que detalla valores nominales y rangos de tolerancia" | Armrest, Top Roll, Insert | 7 |
| Lenguaje rebuscado | "Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores" | Armrest | 6 |
| Lenguaje rebuscado | "Estandarización y diferenciación física de contenedores OK/NC" | AMFE-150 | 1 |

**Total segundo barrido: 48 reemplazos (8 CMM + 40 frases rebuscadas)**.

**Total combinado del incidente 2026-04-27: 70 correcciones en 14+ documentos**.

Reemplazos validos cargados (calcados de patrones reales de Barack):
- CMM 3D PREV → "Plantilla dimensional validada al setup + plan de calibracion de calibre"
- CMM 3D DET → "Verificacion dimensional con calibre + plantilla, inicio y fin de turno"
- "guia coser..." → "Guía física en máquina + setup validado del pie y avance"
- "limpieza y purga..." → "Limpieza y purga del molde según instructivo"
- "puesta a punto estandarizada..." → "Setup según Plan de Control + Hoja de Proceso" / "Setup con valores nominales + rangos de tolerancia"
- "monitoreo presion + calibracion periodica..." → "Sensor de presión con alarma + plan de calibración"
- "estandarizacion contenedores..." → "Contenedores OK/NC identificados con cartelería"

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

---

## 2026-05-17 — Plan soft-snacking-elephant: juego multi-agente cazar errores boludos AMFEs

**Contexto**: Sesion interactiva multi-agente para detectar y arreglar errores sistemicos en los 12 AMFEs Supabase. 4 subagents Explore corrieron en paralelo con 7 detectores (D-MACHINE, D-CAUSE, D-CONTROL, D-CAPACITACION, D-SOD, D-EFFECTS, D-APH). Total: 228 findings (48 critical + 180 warning).

**Fixes aplicados (2 commits granulares)**:
1. `d627596` — AMFE 150 (Armrest Rear Center): 9 causas AP=H sin accion -> placeholder "Pendiente definicion equipo APQP" (autorizado por regla `amfe-aph-pending.md`). 7 en OP10 RECEPCION + 2 en OP20 CORTE.
2. `58f4d75` — 3 Headrest (HF-PAT, HRC-PAT, HRO-PAT): severidad de "Pais de origen ausente o incorrecto" subio de 5 a 7. effectEndUser dice "Incumplimiento legal declaracion origen" -> retencion aduanera = compliance legal -> S>=7 obligatorio.

**Reglas durables nacidas de esta sesion**:
- `amfe-aph-pending.md` (existente) — seccion "Enforcement" agregada con check nuevo
- `amfe-severity-legal-compliance.md` (nuevo) — severidad minima 7 para fallas con efecto legal/aduanero

**Checks enforcement agregados a `scripts/_lib/amfeValidator.mjs` (CRITICAL, bloqueante)**:
- `CAUSE_APH_EMPTY_NO_PLACEHOLDER` — AP=H sin accion ni placeholder = bloqueo IATF
- `CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED` — failure con efecto legal pero S<7

**Leccion: regex de keywords criticos no alcanza para calibrar severidad**

El detector D-SOD marco 28 causas como "S-subcalibrada" usando regex de keywords ("legal", "seguridad", "trazabilidad", "no conformidad"). De las 28, **25 fueron falsos positivos**: el keyword aparecia pero el contexto NO era critico (ej. "Puntadas irregulares" con S=3-5 esta bien — defecto cosmetico; el regex disparaba por "no conformidad" generica).

Solo 3 fueron legitimas (las del pais de origen).

**Prevencion**:
- Regex de keyword amplio NO ES SUFICIENTE para flag severidad. Necesita matchear contexto (effect text + failure desc + causa).
- Cuando un detector marca un patron en muchos AMFEs, **leer el contexto real** antes de proponer fix masivo.
- El "fix global automatico" prometido para "calibracion AIAG-VDA" requiere reglas mas granulares (por tipo de defecto / por keyword en effectEndUser especificamente, no en cualquier efecto).

**Bug detector D-SOD anotado para proxima recalibracion**:
- 3 failures con `EndUser: "TBD"` fueron marcados como "S-subcalibrada" cuando deberian haber sido "effects-faltantes" (D-EFFECTS subcheck). El detector C necesita verificar primero que los 3 niveles esten LLENOS antes de evaluar S.

**Estado de hallazgos pendientes (no abordados en esta sesion)**:
- 59 controles vagos ("Inspeccion visual" sin instrumento) - requieren criterio Fak/equipo APQP, uno por uno
- 58 placeholders AP=H sin responsable/dueDate - el equipo APQP debe asignar
- 11 effects-copia (3 niveles VDA identicos) - en AMFE-INS-PAT mayormente, requiere texto distinto por nivel
- 37 D<=3 sin poka-yoke - revisar caso por caso
- 25 falsos positivos S-subcalibrada del detector - descartados aca, ignorar en proximas corridas hasta recalibrar

**Backup pre-sesion**: `backups/2026-05-17T18-27-21/` (713 rows / 12 tablas)
**Findings detallados**: `tmp/team-findings/` (4 detectores + consolidated.md)
**Plan completo**: `~/.claude/plans/soft-snacking-elephant.md`

### Continuacion sesion (Grupos 3 + decision Fak)

**Grupo 3 — efectos VDA "TBD" reusados de AMFEs hermanos** (commit 1163990):
4 fallas tenian effectLocal/NextLevel/EndUser = "TBD". Busqueda de similaridad
cross-AMFE encontro matches en 4/11. Las otras 7 quedan TBD para el equipo APQP.
- AMFE-1 OP40 "Costura corrida" <- AMFE-2 OP80 (sim 1.0)
- AMFE-1 OP40 "Hilo roto" <- AMFE-2 OP80 (sim 0.85)
- AMFE-INS-PAT OP5 "Omision verificacion insumos" <- AMFE-2 OP10 (sim 0.5)
- AMFE-TR-PAT OP80 "Contaminacion soldadura" <- VWA-PAT-IPPADS OP110 (sim 0.5)

Leccion del Grupo 3: el detector D-EFFECTS clasifico estos como "effects-copia"
(3 niveles identicos), pero en realidad eran "effects-faltantes-TBD". Detector
necesita check previo de TBD/vacio antes de marcar copia. Anotado en bug fix
queue para proxima recalibracion.

### Decisiones Barack confirmadas en esta sesion

**Placeholder AP=H NO requiere responsable ni dueDate** (decision Fak, chat
2026-05-17): la causa con `optimizationAction = "Pendiente definicion equipo
APQP"` pero `responsible=""` y `dueDate=""` es estado VALIDO. El placeholder
existe para señalizar al equipo humano que debe completarlo. Detectores NO
deben flaggear esto como issue. Documentado en `amfe-aph-pending.md` seccion
"Aclaracion 2026-05-17".

Esto invalida el Grupo 4 del plan (58 placeholders sin responsable) que NO
es un problema real.

### Pendientes para proxima sesion

Fak menciono al cerrar: **"lo que me gustaria revisar son las M a veces hay
cosas raras ahi"** (chat 2026-05-17). Proxima sesion debe revisar los
Work Elements 6M (Machine, Man, Material, Method, Measurement, Environment)
en busca de:
- WE.type asignada incorrectamente (ej. Machine donde deberia ser Material)
- M faltantes en operaciones que las requieren (caso inyeccion plastica = 6M
  completo segun injection.md)
- WE.name no coherente con WE.type
- Funciones de WE que no describen contribucion real al paso

El detector D-MACHINE original solo encontro 2 findings — muy permisivo.
Hay que armar detector mas estricto: cross-check WE.type vs WE.name vs
function.description vs failures cause.category.

Otros pendientes (volumen alto, requieren criterio Fak caso por caso):
- 59 controles vagos ("Inspeccion visual" sin instrumento)
- 37 D<=3 sin poka-yoke (verificar FP del detector primero)
- 7 fallas con effects=TBD restantes (sin match en AMFEs hermanos)

### Sesion M parte 2 — 5 commits adicionales (e24a2b6 ... 6c95dff)

Fak pidio "seguir investigando las M". Detector M raras (subcheck por keywords)
encontro 5 findings, 4 FP. Recorrido humano con criterio detallado a continuacion:

**Fixes aplicados (acumulado sesion M completa = 96 fixes en Supabase):**
- Telas Planas OP70: "clips" -> "APLIX" (regla pfd.md violada)
- HRC + HRO OP25 Mylar: reusar 3 WEs de AMFE-2 OP25 (operador renombrado a "Operador de produccion")
- 3 agrupaciones "/" violando 1M (Aspirador rename, Pistola sacar /Rodillo, Cinta/Calibre split)
- HRC/HRO OP70 INSERCION VARILLA: falla "colocacion mayor/menor cantidad piezas" (copia de embalaje) reemplazada con "Varilla desalineada" de HF-PAT OP51
- 5 funciones tautologicas reescritas (IP-PADS OP10 "Se recepciona...", HF-PAT OP20 "CORTE DE PANELES", AMFE 150 OP10 Operador+Lider mismo texto, IP-PADS OP30 "BMA090/BMA089")
- 54 effects audiencia ("Cliente Interno/Externo") -> textos descriptivos reusando AMFEs hermanos
- 11 effects audiencia restantes -> 5 patrones validados con Fak (corte=scrap, varilla=fuga PU, inyeccion=scrap, peso=scrap, etc)
- 15 causas "estiba/embalaje/manipulacion en transito" en WE Autoelevador -> reescritas para reflejar rol del operador del autoelevador en Barack

**Reglas durables nuevas en `.claude/rules/`:**
- amfe.md seccion "Roles canonicos en WE.name type=Man" — Operador de produccion estandar
- amfe.md seccion "Calibracion de efectos: corte = SCRAP, no retrabajo" + tabla por OP type
- amfe.md seccion "Categorizacion pragmatica Barack: cuando una causa cruza M" (Caso A y B)
- amfe-severity-legal-compliance.md (nueva) — S>=7 con efecto legal/aduanero

**Checks nuevos en `amfeValidator.mjs`:**
- CAUSE_APH_EMPTY_NO_PLACEHOLDER (CRITICAL)
- CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED (CRITICAL)
- CUTTING_EFFECT_REWORK_SUSPECT (WARNING) — detecto 3 fixes auto durante esta sesion

### Hallazgos pendientes en 3 Headrest (comparativo subagent 2026-05-17)

Comparativo HF-PAT / HRC-PAT / HRO-PAT post-fixes encontro 26 inconsistencias:

**Crítico:**
- **HF-PAT OP50 = ENFUNDADO** (operador manual) vs **HRC-PAT/HRO-PAT OP50 = INYECCION DE PU** (maquina quimica) — son operaciones COMPLETAMENTE DISTINTAS con el mismo numero. Indica merge de maestros distintos. Validar con equipo APQP.

**Severidades inconsistentes entre los 3 (misma falla, valores distintos):**
- "Puntadas irregulares o arrugas": HF S=6 | HRC S=3 | HRO S=8 (span 2-8 sin justificacion)
- "Costura descosida o debil": HF S=8 | HRC S=8 | HRO S=4 (HRO claramente subcalibrada)
- "Pieza con rebaba visible": HF S=3 | HRC S=3 | HRO S=8 (HRO sobrecalibrada)

**Estructurales:**
- HF tiene 16 OPs (granular con sub-ops 28/51/61-63/81-82) vs HRC/HRO 14 OPs (compacta) — maestros distintos
- HF OP70 Control: "Mesa de control final" + "Inspector de calidad" | HRC/HRO OP70: solo "Operador de produccion" — sin documentar por que difiere
- HRO OP40 tiene 2 WEs con placeholders ("Metodo: Configuracion...") cuando HF/HRC tienen 5 WEs especificos

**Detalle completo:** `tmp/team-findings/headrest-comparativo.md` (no commiteado, perderse cuando se limpie tmp).

Si la proxima sesion retoma esto, atacar primero el caso critico (OP50 ENFUNDADO vs INYECCION PU) — eso afecta CP/HO derivados.

---

## 2026-05-17 (parte C) — Observaciones Fak post-HO + investigacion AIAG-VDA

Fak reviso una HO impresa de HF-PAT OP60 (que la HO marcaba OP52, ya corregida)
y trajo 6 observaciones sobre AMFE/HO de Barack.

### Hallazgos verificados y fixes aplicados (3 commits)

**Commit f16000b — 5 fixes en 3 AMFEs:**

1. "Pistola etiquetadora" en embalaje (invento). Lo correcto en embalaje
   es "Etiquetadora impresora" (con tinta). La pistola etiquetadora SI
   existe en OP60 PRECINTO (PU). Renombrados 2 WEs:
   - AMFE-HF-PAT OP90 EMBALAJE
   - AMFE-HRC-PAT OP100 EMBALAJE

2. Funciones vacias en HF-PAT WE Operador de produccion:
   - OP50 ENFUNDADO + OP51 INSERCION DE VARILLA

3. Method en AMFE-INS-PAT OP120 EMBALAJE (solo tenia Man).

**Commit 24bf0f5 — 85 WE Man renombrados a 4 roles canonicos**

Decision Fak: solo 4 roles Man canonicos. Mapeo aplicado en 12 AMFEs:
- Operador de [actividad] (corte/costura/inyectora/etc.) -> Operador de Produccion
- Costurera -> Operador de Produccion
- Embalaje manual -> Operador de Produccion
- Lider de equipo -> Lider de Produccion
- Operario de control de calidad -> Inspector de Calidad
- Operador de control en CONTROL DIMENSIONAL/FINAL -> Inspector de Calidad
- Operador de control en autocontrol -> Operador de Produccion

85 cambios totales, 0 duplicados generados (algoritmo de skip si conflicto).

### Lecciones nuevas — DEBIA actualizar mi conocimiento

**LECCION 1: AIAG-VDA confirma mesas/fixtures como Machine**

Inicialmente sospeche que "Mesa de control" tipo Machine estaba mal. Fak pidio
"investiga los manuales, tu base de conocimiento no puede ser...". Investigue
y encontre cita textual AIAG-VDA FMEA Handbook 2019:

> "Machine/Equipment includes Robot, hopper reservoir tank, injection molding
> machine, spiral conveyor, **inspection devices, fixtures**, etc."

Las mesas de inspeccion/armado/tendido/control son **fixtures** → Machine correcto.
Environment es solo condiciones ambientales (temp, humedad, polvo, iluminacion),
NO mobiliario del puesto.

Persistido como regla en `amfe.md` seccion "Mesa / Fixtures = Machine
(AIAG-VDA FMEA Handbook 2019)". Anti-patron a evitar: sugerir mover mesas a
Environment o eliminarlas como WE.

**LECCION 2: 4 roles Man canonicos — refinado**

La regla existente "Roles canonicos" (sesion soft-snacking-elephant) decia
4 roles pero permitia variantes. Sesion 2026-05-17 parte C la refino:
**EXACTAMENTE 4 roles, NO inventar variantes**. Tabla de mapping completa
documentada en `amfe.md`.

**LECCION 3: Pistola etiquetadora SOLO en OP PRECINTO (PU)**

2 dispositivos confundidos:
- **Pistola etiquetadora**: aplica precinto en molde antes de inyectar PU
- **Etiquetadora impresora**: imprime con tinta etiquetas para embalaje

NO usar "Pistola etiquetadora" como WE Machine en operaciones de embalaje.
Anti-patron documentado en `amfe.md`.

### Pendientes para equipo APQP humano (no podemos automatizar)

- 7-9 OPs vacias Headrest (HF OP60/61/62 + HRC/HRO OP11+OP60) — necesitan PPAP
- WE BMA089 en IP-PADS OP30 — falta separar y definir failures
- 9 causas "Instruccion incompleta" — decision Method vs Man documentada
- HF-PAT OP70 Control responsable distinto a HRC/HRO — documentar por que

### Observacion HO sin verificar (mencionada por Fak)

Fak dijo: "no entiendo porque el sector es tapizado pero vos en la columna
mezclaste las columnas creo y no te diste cuenta". No identifique cual fue
la columna que mezcle (probablemente en una sesion anterior al generar la
HO Excel). Anotado como riesgo para revisar si vuelve a aparecer.

**Backup final:** `backups/2026-05-17T22-35-40` (713 rows / 12 tablas)

---

## 2026-05-17 (parte D) — Codigos canonicos APC + deshabilitar PFD

Fak estaba modificando un flujograma con un colega y noto que los AMFE/tabla
products tenian codigos viejos sin formato canonico. Pidio actualizar todo +
deshabilitar el modulo PFD porque no se hacen flujogramas aca.

### Cambios aplicados

**1. AMFEs Headrest — `data.header.applicableParts` (3 docs):**
   - AMFE-HF-PAT (APC DELANTERO)
   - AMFE-HRC-PAT (APC TRASERO CENTRAL)
   - AMFE-HRO-PAT (APC TRASERO LATERAL)
   Formato canonico con codigos VW con puntos + codigo color + material.
   Script: `scripts/_fix-apc-applicable-parts-canonico.mjs`.

**2. Tabla `products` — 12 entradas APC Patagonia:**
   - 3 productos x 4 variantes (L0/L1/L2/L3) = 12 filas actualizadas
   - `codigo`: de `2HC881901 RL1` -> `2HC.881.901 RL1` (con puntos)
   - `descripcion`: de "FRONT HEADREST TITAN BLACK" -> "APC DELANTERO L0 - PVC Titan Black" (castellano + variante)
   Script: `scripts/_fix-apc-products-codigo-canonico.mjs`.

### Reglas durables nuevas

**`.claude/rules/amfe.md`** seccion "Formato canonico de `applicableParts`":
- Patron: `L<n>  <PN.con.puntos>  <COLOR3letras>  | <Material>`
- Anti-patrones documentados (texto viejo en una linea sin codigos VW por variante)
- Ejemplos canonicos de los 3 APC (HF/HRC/HRO) verbatim

**`.claude/rules/no-flujogramas-proceso.md`** (regla nueva):
- Decision Fak: Barack NO hace PFDs en este proyecto
- NO crear/regenerar/sugerir/preguntar sobre PFDs
- Codigo `modules/pfd/**` queda en repo (no se borra) por compat con worktrees
- UI queda accesible — Fak no pidio sacarla, sacarla rompe tests visuales

**`~/.claude/projects/.../memory/feedback_no_flujogramas_barack.md`** (memoria
cross-proyecto): misma directiva persistida para sesiones fuera de Barack.

### Pendientes (Fak puede pedir despues)

- Sacar PFD del LandingPage (card + shortcut tecla 1 + botones secundarios)
- Posiblemente revisar otros productos con codigos sin puntos en `products` table
  (40+ filas AMAROK/viejas con codigos sin formato canonico)

**Backup final:** `backups/2026-05-18T19-04-32` (713 rows / 12 tablas)
