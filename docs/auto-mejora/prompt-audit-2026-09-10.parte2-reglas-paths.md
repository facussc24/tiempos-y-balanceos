# Prompt-audit 10/09/2026 — parte 2: las 18 reglas con `paths:`

Guia: `claude-api/shared/prompt-audit.md` (Claude Code 2.1.266), pasos 0-7. Modelo objetivo: **Claude Fable 5.1 / Opus 5**.
Continuacion de `prompt-audit-2026-09-10.parte1-nucleo.md` (nucleo siempre cargado, ya aplicado el 11/09).

## 1. Supuestos

- Alcance: las 18 reglas de `.claude/rules/` con `paths:` en el frontmatter — las que NO estan en el contexto
  de todas las sesiones: cargan solo cuando la sesion toca un archivo que matchea su glob. 133 KB en total
  (el 90% del peso de `.claude/rules/`).
- Costo: menor que el del nucleo (no se pagan siempre), pero `amfe.md` (34 KB) y `cad-3d.md` (30 KB) se pagan
  **enteras** cada vez que la sesion toca un `.step` o un script de AMFE. La regla de la guia sigue siendo
  "cada token se gana su lugar", no "achicar": lo que se busca son **instrucciones fechadas**, no volumen.
- Contexto que solo el autor sabe y NO se flaggea (keep list #1, #3, #4, #5): Fak es ingeniero de calidad, no
  programador; sus decisiones fechadas y sus correcciones textuales son constraints; los comandos exactos de
  operaciones fragiles (Supabase, DXF, arb, mails, CAD) se quedan tal cual.
- Procedencia: `git log` solo donde cambiaba la accion. **Todo "volatile specific" citado por una regla
  (script, hook, skill, memoria, test, ruta, conteo) se verifico contra el disco**: ~150 verificaciones,
  detalle en §6.
- NO se edito ningun archivo fuente. Este informe es el unico entregable.

## 2. Inventario

| Archivo | Bytes | Lineas | Carga cuando la sesion toca |
|---|---|---|---|
| `.claude/rules/amfe.md` | 34.087 | 329 | `modules/amfe/**`, `core/amfe/**`, `utils/seed/**`, `scripts/_lib/**`, scripts `*mfe*.mjs`, `_export*.ts` |
| `.claude/rules/cad-3d.md` | 30.418 | 389 | `.venv-cad/**`, skill `cad-design`, `*.step` `*.stp` `*.stl` `*.glb` `*.iges` |
| `.claude/rules/escritorio-tareas.md` | 12.036 | 201 | `_escritorio.mjs`, `serverPaths.mjs`, su hook, sus tests |
| `.claude/rules/coordinador.md` | 9.003 | 116 | `_encargo.mjs`, `coordinadorGuard.mjs`, su canon, su hook, su test |
| `.claude/rules/mail-envio.md` | 7.112 | 130 | `scripts/_mail*`, **cualquier `**/*.py`** |
| `.claude/rules/arb-no-cerrar.md` | 5.479 | 102 | `scripts/_arb*.py`, su hook, skill `arb-operar` |
| `.claude/rules/documentacion-oficial.md` | 5.133 | 88 | `4- MANUALES`, `0-Documentacion cliente`, `1. Imput`, `normas-vw`, `.sgc-cache` |
| `.claude/rules/control-plan.md` | 4.597 | 43 | `modules/controlPlan/**` |
| `.claude/rules/video-maquina.md` | 3.797 | 83 | `_videoBiblioteca.mjs`, `*telefono*`, `*.MOV`, `*.MP4` |
| `.claude/rules/lecciones-consolidacion.md` | 3.607 | 67 | `LECCIONES_APRENDIDAS.md`, `_archive/LECCIONES*`, 2 hooks, `cierreGuard.mjs` |
| `.claude/rules/dxf-entregable.md` | 3.401 | 63 | `*.dxf`, `*.plt`, `_validarDxf*.py`, 2 skills |
| `.claude/rules/patrones-corte.md` | 3.096 | 49 | `*.dxf`, `*.plt`, `*.hpgl`, skill `patrones-corte-plotter` |
| `.claude/rules/dev-login.md` | 2.245 | 45 | `components/auth/**` |
| `.claude/rules/hojas-proceso.md` | 2.023 | 38 | skill `hojas-de-proceso`, `hoja*proceso*`, `hoja*operaciones*`, `*.pptx` |
| `.claude/rules/database.md` | 1.876 | 28 | `utils/repositories/**`, `utils/database.ts`, hooks de persistencia, `scripts/**` |
| `.claude/rules/exports.md` | 1.850 | 34 | `modules/**/*Export*.ts`, `ExportModal*.tsx` |
| `.claude/rules/verify-supabase-live.md` | 1.829 | 25 | `scripts/**`, `utils/repositories/**`, `tmp/**`, `backups/**` |
| `.claude/rules/testing.md` | 1.275 | 32 | `__tests__/**` |

**Total: 132.864 B (~133 KB).** `amfe.md` + `cad-3d.md` = 48,5% del total.

Solapamientos que valen para el costo real de una sesion:

- `scripts/**` dispara `database.md` **+** `verify-supabase-live.md` **+** (por `scripts/_lib/**`) `amfe.md` → **~38 KB**.
- `*.dxf` / `*.plt` disparan `dxf-entregable.md` **+** `patrones-corte.md` → ~6,5 KB.
- `**/*.py` dispara `mail-envio.md` (7 KB) en **cualquier** script de Python: CAD, video, arb, hojas de proceso.

## 3. Resumen

Conteo por patron (alta / media / baja-flag):

| Patron de la guia | Alta | Media | Baja |
|---|---|---|---|
| **1d fosiles y frases relativas** ("antes esto decia", "ya no", "desde", "en esta misma sesion") | 7 | 4 | 3 |
| **volatile specifics rotos o vencidos** (script/ruta/conteo que ya no es) | 5 | 4 | 2 |
| **Grupo 2 narrativa historica dentro de la regla** | 1 | 9 | 2 |
| **1a presion / mayusculas / 🔴 sin porque** | 1 | 2 | 4 |
| **1e cluster de prohibiciones** | 1 | 0 | 0 |
| **1c sobre-especificacion / duplicado** | 0 | 3 | 3 |
| **contradiccion con una decision fechada de Fak** | 2 | 1 | 0 |
| **Grupo 4 estructural (routing / patch accretion)** | 0 | 2 | 0 |
| **TOTAL** | **17** | **25** | **14** |

**Los tres de mas impacto:**

1. **Cuatro gates de `cad-3d.md` apuntan a scripts que no existen en ningun lado** (`chequeo_apoyo_nido.py`,
   `validar_todo.py` con su `ADH_TOPE_MIN`, `verificar_nido.py`, `extraccion.py`, y el control `chequeo_marco`).
   Vivian en la carpeta de trabajo del dispositivo de adhesivado, fuera del repo. La regla los presenta como
   *"Enforcement"* y como *"el tope va en el codigo, no en mi memoria"* — pero no hay codigo: una sesion que
   quiera correrlos no puede, y el texto le dice que ya estan puestos. Es el peor tipo de volatile specific:
   **un gate que la regla declara vigente y que no existe** (grep confirmado sobre `.claude/` y `scripts/`;
   `verificar_nido` solo sobrevive como mencion en `SKILL.md`).

2. **`amfe.md` §12 lleva 5.742 B (17% del archivo) reconstruyendo el episodio del apoyacabezas 40/41 —
   y el detalle ya vive entero en dos memorias** (`reference_apoyacabezas_funda_es_bolsa`,
   `reference_apoyacabezas_varilla_epp_proceso_real`, verificadas). Adentro de esas 4 lineas hay ademas
   **tres frases 1d puras** que describen versiones anteriores de este mismo archivo: *"Hasta el 23/08 aca
   decia HF 50/51/61/63…"*, *"Hasta esa fecha esta regla decia que los traseros iban directo a PU: era falso"*,
   *"(cargado en esta misma sesion, 23/08)"*. El modelo nunca vio esas versiones; el diff contra un prompt
   que no existe solo sugiere alternativas fantasma. Lo mismo, mas chico, en §2.1 y §13.

3. **Dos reglas siguen diciendo que los datos de la empresa no van al repo**, que es exactamente lo que Fak
   levanto el 18/08/2026 (*"saca esa regla de cero datos de la empresa porque me bloquea siempre y es
   molesta"*, `git-deploy.md`, siempre cargada): `patrones-corte.md:37` (*"Datos de piezas reales… NO van al
   repo"* + mandarlos a `.sgc-cache/`, que es literalmente el "mover archivos a rutas gitignoreadas por esto"
   que `git-deploy.md` prohibe) y `hojas-proceso.md:37` (*"part numbers de cliente"*). `escritorio-tareas.md`
   ya se corrigio sola el 30/08 y dejo escrito el rastro; estas dos no. Una regla que contradice una decision
   fechada de Fak hace que la sesion pare a preguntar justo donde el dijo que no se para.

**Lo limpio, que no se toca:** `exports.md` y `testing.md` no tienen un solo hallazgo alta/media —
verificados contra el codigo, los tres "React 19 gotchas" y la exclusion de `controlProcedure` del export CP
son ciertos hoy. `documentacion-oficial.md` es la regla mejor formada del lote (6 reglas numeradas, el porque
en un parrafo, el enforcement con su tabla, las carpetas "verificado en disco, no supuesto"). `control-plan.md`
es datos de referencia, que la keep list #4 protege entera.

## 4. Hallazgos

Campos: Ubicacion · Evidencia · Patron · Por que obsoleto para Fable 5.1 · Confianza · Accion.

### cad-3d.md (30.418 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 1 | `cad-3d.md:158` | `Enforcement: chequeo_apoyo_nido.py, que nacio con su control sintetico y con codigo 1.` | volatile specific roto | No existe en `.claude/` ni en `scripts/` (grep verificado 11/09). El gate que la regla declara cargado no se puede correr | alta | rewrite → enunciar el criterio sin prometer el script, o traerlo al skill |
| 2 | `cad-3d.md:328-331` | `validar_todo.py corta cualquier paso a los 25 min (ADH_TOPE_MIN), lo marca CORTADO y sigue con los demas` | volatile specific roto | `validar_todo.py` y `ADH_TOPE_MIN` no existen en el repo (el unico hit de `ADH_TOPE_MIN` es esta linea). *"El tope va en el codigo, no en mi memoria"* es falso hoy | alta | rewrite: el tope es un requisito de toda cadena larga, se implementa en el script de la cadena |
| 3 | `cad-3d.md:316-318` | `la segunda pasada de verificar_nido.py agarro el archivo a medio editar` | volatile specific roto | `verificar_nido.py` no existe (solo lo nombra `SKILL.md`); `extraccion.py` tampoco | alta | rewrite sin nombres de script muertos (la regla —no editar un script mientras corre— es buena y se queda) |
| 4 | `cad-3d.md:247` | `*Enforcement ya cargado en esta sesión:* build_gancho.py::derivadas()` | 1d fosil | "en esta sesión" es una nota al yo de ese dia; dos semanas despues no informa nada | alta | rewrite: `*Enforcement:*` a secas |
| 5 | `cad-3d.md:60-66` | `Nació bloqueante con umbral 0,35 y una auditoría independiente lo tumbó el mismo día por los dos lados… Dos hipótesis mías caídas contra datos el mismo día` | Grupo 2 narrativa | 7 lineas para explicar un umbral que **ya no existe**; la regla vigente son 2 frases (se declara el motor; el color se mide y se informa). El detalle ya esta "escrito con los numeros en el skill", dice el propio texto | media | rewrite a 2 lineas + puntero al skill |
| 6 | `cad-3d.md:213,229,240,258,276,291,307,316,336` | `Y el mismo error otra vez, en la misma sesión` · `Mismo día` ×8 | 1d frase relativa | Encadena bullets escritos de un tiron el 24 y el 29/08. Un lector que entra por GATE 3.8 no sabe de que dia habla | media | rewrite: fecha explicita donde importa, o sacarla |
| 7 | `cad-3d.md:182-196` (3.072 B con GATE 4) · `198-217` | GATE 3.5 (15 lineas del croquis del gancho) y GATE 4 (20 lineas del utillaje de 166 cm³) | Grupo 2 narrativa | La prescripcion de cada uno son 2-3 lineas; el resto es el caso con sus numeros. El skill `cad-design` §6 ya tiene el detalle | media | move el caso → memoria; dejar la regla + el enforcement |
| 8 | `cad-3d.md:276-346` (5.901 B) | GATE 3.6 · 3.7 · 3.8 · 3.9, los cuatro del 29/08, encadenados con "Mismo día" | Grupo 2 + 1d patch accretion | Cuatro gates nacidos de una sesion, insertados con decimales entre el 3 y el 4. La secuencia de ejecucion real (P → E → 0 → 0.1 → 1 → 2 → 3…) no se lee en ningun lado | media | rewrite: una linea arriba con el ORDEN de los gates; los casos a memoria |
| 9 | `cad-3d.md:19-26` | `02/09/2026, después de **tres entregas rechazadas en tres días**… el cálculo estructural estaba bien las tres veces` | Grupo 2 | La cita de Fak (*"SE VA A VOLAR LA TELA"*) es keep #5 y se queda; las 4 lineas de contexto se comprimen a 1 | baja | flag |

### amfe.md (34.087 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 10 | `amfe.md:62-64` | `Antes de esta fecha esta regla decia que los valores validos eran solo "CC", "SC" y "", y que los simbolos del cliente se traducian hacia Barack. Las dos cosas quedaron desactualizadas.` | 1d migracion-relativa | Diff contra una version del prompt que el modelo nunca vio; sugiere una alternativa fantasma. La tabla de abajo ya dice lo vigente | alta | delete el parrafo (la tabla y la decision de Fak 08/09 se quedan) |
| 11 | `amfe.md:181` | `(Hasta el 23/08 aca decia HF 50/51/61/63 y HRC-HRO 50 varilla / 60 enfundado: numeros previos a la renumeracion del 18-20/08, y el fragmento de los traseros ademas se contradecia con la frase de arriba.)` | 1d migracion-relativa | Idem. Los numeros vigentes ya estan dos frases antes, verificados contra Supabase live | alta | delete el parentesis (dejar la frase de `_verificarNumeracion.mjs`) |
| 12 | `amfe.md:184` | `⚠️ Hasta esa fecha esta regla decia que los traseros iban "directo a PU": **era falso**` + `(cargado en esta misma sesion, 23/08)` | 1d migracion-relativa + fosil | Dos frases en la misma linea que describen el archivo anterior y el momento de escritura | alta | delete las dos; la leccion durable (*"una regla que solo describe lo que dice un documento no lo valida"*) se queda en una frase |
| 13 | `amfe.md:190-193` | `🔴 Corregidas el 24/08/2026… La tabla de D que estaba aca ponia "100% visual + dimensional" en 4-5 y "visual por lote" en 6-7. Es falso, y subdeclaraba riesgo en todos los AMFE.` | 1d migracion-relativa | La tabla correcta esta 10 lineas abajo. Contar que decia la version vieja invita a reconstruirla | alta | rewrite: queda el OK de Fak (keep #4) + el check `DETECTION_HUMANA_OPTIMISTA` + el dato del AMFE 172 como porque, sin la tabla vieja |
| 14 | `amfe.md:181-183` (5.742 B, 17% del archivo) | La reconstruccion completa del episodio 40/41 del apoyacabezas: 6 dias, 4 documentos, las HO-968/969/970, el EPP, las citas de Fak | Grupo 2 narrativa | **Verificado: el detalle vive entero en dos memorias** (`reference_apoyacabezas_funda_es_bolsa`, `reference_apoyacabezas_varilla_epp_proceso_real`). Se paga en cada sesion de AMFE para leer un caso cerrado | media | move → las dos memorias ya existentes; en la regla quedan ~10 lineas con lo vigente y lo abierto |
| 15 | `amfe.md:227-234` | `🔴 El 31/08/2026 esta regla tenia solo el punto 2 y por eso un script llevo 100 causas de muestreo a D=7…` | 1d migracion-relativa + Grupo 2 | Los 3 puntos de la regla practica estan arriba y los dos checks tienen nombre. La memoria `feedback_muestreo_no_es_control_al_100` (existe) tiene el caso | media | rewrite a 2 lineas: los dos checks + el puntero a la memoria |
| 16 | `amfe.md:100` · `amfe.md:107` | `## 5. Acciones de optimizacion — NUNCA INVENTAR` · `## 6. Controles — NUNCA inventar equipos…` | 1a + duplicado del nucleo | `core-prohibiciones.md` §1 ("NUNCA inventar datos tecnicos") entra en **todas** las sesiones; estos titulos lo repiten en mayusculas. El contenido de las dos secciones es especifico y se queda entero | baja | flag (bajar el titulo a frase normal; el cuerpo no se toca) |
| 17 | `amfe.md:170` | `Citas textuales: _DECISION donde van los valores en la carpeta de la tarea` | volatile specific no resoluble | No se encontro en el Escritorio (87 entradas + `_EN ESPERA`, busqueda a 3 niveles). El motivo de no subirlo (copyright de terceros) es valido y se queda | baja | flag: o se nombra la carpeta, o se saca el puntero |
| 18 | `amfe.md:265` | `## 14. Schema y scripts .mjs — OBLIGATORIO` | 1a | Lo hace cumplir `runWithValidation()` con exit != 0 | baja | flag |

### escritorio-tareas.md (12.036 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 19 | `escritorio-tareas.md:176-179` | `esta línea decía "datos reales NO van al repo" desde antes de esa decisión y quedaba en contradicción con ella (lo señaló el auditor el 30/08)` | 1d migracion-relativa | La correccion ya esta hecha: el texto vigente esta arriba. Contar que decia antes es el diff contra un prompt que el modelo no vio | alta | delete las 3 lineas |
| 20 | `escritorio-tareas.md:88-91` | `Tenía razón: la regla decía dónde va el entregable **al cerrar** y no decía dónde **se genera**. Yo generé el PDF de difusión… y se lo reporté como si eso fuera entregarlo.` | 1d + Grupo 2 | Idem: describe la version anterior de este archivo. La cita de Fak (linea 84-86) es keep #5 y se queda entera | media | rewrite: 1 linea de porque, sin el "antes decia" |
| 21 | `escritorio-tareas.md:17` · `:21-22` · `:46` | `El Escritorio llegó a **81 iconos**` · `(10 a la vista + 27 en _EN ESPERA = 37 abiertas)` · `Con 56 tareas abiertas` | volatile specific vencido | Medido hoy: **87 entradas a la vista y 27 en `_EN ESPERA`**. Tres numeros congelados en tres momentos distintos para ilustrar una regla que no depende de ellos | media | rewrite sin numeros: la bandeja NO es una tarea, el relevador suma las dos |
| 22 | `escritorio-tareas.md:169` · `:196` | `mailCache.test.mjs (21)` · `escritorio.test.mjs (36) y escritorioGuard.test.mjs (19)` | volatile specific vencido | Contados hoy: **22, 37 y 20**. Un numero que sube con cada test agregado y que nadie re-verifica | media | rewrite: sacar los conteos (el nombre del archivo es lo que sirve) |
| 23 | `escritorio-tareas.md:67-68` | `(triage del 03/08: 30 carpetas, cero cerrables, y las 30 caían en uno de estos dos)` | Grupo 2 corta | Una linea, es el porque de la tabla de abajo | baja | keep |

### mail-envio.md (7.112 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 24 | `mail-envio.md:10-12` | `> ENFORCEMENT YA CARGADO (misma sesion, 2026-08-14): hook mail-guard.sh registrado en _dispatcher.sh + scripts/_mailEnviar.py con gate y --selftest (9 casos, verde), probado contra el caso real del incidente: bloquea.` | 1d fosil + duplicado interno | Nota al yo del 14/08 ("YA CARGADO", "misma sesion"). La seccion `## Enforcement` del final dice lo mismo, mejor y actualizado. Es lo primero que lee la sesion, en un blockquote, y no prescribe nada | alta | delete el blockquote entero |
| 25 | `mail-envio.md` frontmatter | `paths: - "scripts/_mail*" - "**/*.py"` | Grupo 4 routing | 7 KB de reglas de Outlook cargan en **cualquier** `.py`: CAD, video, DXF, arb, hojas de proceso. La mitad de los `.py` de esta casa no manda mails | media | rewrite el glob (ver diff) |
| 26 | `mail-envio.md:124-130` | `## Incidente fuente — 2026-08-14` (7 lineas) | Grupo 2 narrativa | Las dos causas ya estan en la tabla del gate (`El 14/08 la entrada duplicada estaba a la vista y la llame "copia vieja"` · `Ese dia mire Enviados y mande 30 minutos despues`), y el propio parrafo cierra con *"Detalle en la memoria mail_ya_enviado_verificar_justo_antes"* (existe, verificada) | media | rewrite a 2 lineas con la cita de Fak + el puntero |
| 27 | `mail-envio.md:57` | `Incidente 08/09/2026: _prepararMail.py resolvia contra el namespace pero asignaba un string a mail.To` | volatile specific roto | `scripts/_prepararMail.py` **no existe** (solo quedan `_mailEnviar.py` y `_mails.py`). Nombrar un script muerto para explicar un bug | media | rewrite sin el nombre del script (el sintoma de Exchange y el codigo correcto se quedan) |

### arb-no-cerrar.md (5.479 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 28 | `arb-no-cerrar.md:56-57` | `26 casos: 14 que tienen que bloquear, 10 del trabajo diario que tienen que pasar, y 2 del escape de un solo uso` | volatile specific vencido | Contados hoy en `arb-cerrar-guard.test.sh`: **32 `probar`** — 14 bloquean (7+7), **15** pasan (8+7), 2 del escape. El "10" quedo viejo | media | rewrite sin numeros, o con los de hoy |
| 29 | `arb-no-cerrar.md:61-95` (35 lineas) | `### Lo que le agregó la auditoría del 31/08 (8 bypasses reales)` + la lista de 8 + `### Límites conocidos, escritos a propósito` | Grupo 2 narrativa | Los 8 bypasses viven en la suite marcados `[AUDIT 31/08]` (verificado). Las dos decisiones de diseño y los 4 limites SI son durables y se quedan; la arqueologia de como se encontraron, no | media | move la lista de 8 → memoria; dejar las 2 decisiones + los 4 limites |
| 30 | `arb-no-cerrar.md:22-32` | `## El incidente` (11 lineas) | Grupo 2 | La cita de Fak (*"no vuelvas a cerrar arb sin consultarme, nueva regla dura… fue gravísimo eso"*) es keep #5. El detalle del `FACUNDOS-PC` vs `FACUNDO` refuerza el "por que" de la linea 17 | media | rewrite a 4 lineas (cita + la asimetria) |

### coordinador.md (9.003 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 31 | `coordinador.md:74-106` (~2,9 KB, 33 lineas) | `## La auditoria independiente del 02/09/2026 — y por que la primera version no servia` + tabla de 7 agujeros ya tapados | Grupo 2 narrativa | Los 7 bugs estan arreglados y clavados en `coordinadorGuard.test.mjs` (31 casos, verificado). Lo durable son **dos** frases: *"No distinguir ordenar de mencionar es tan grave como no frenar"* y *"la defensa real de G4 no es esta lista: es el gate que vive donde la accion se ejecuta"* | media | move la tabla y los falsos positivos → memoria; dejar las 2 frases |
| 32 | `coordinador.md:23-24` | `Al final de todo encargo va el bloque **ARRANQUE** (desde el 05/09/2026, canon plantillaArranque)` | 1d "desde" | Escrito como cambio en vez de como regla | baja | flag |
| 33 | `coordinador.md:104-106` | `**Bypass que encontro el propio test rojo (02/09/2026):** con el bloque validado entero, alcanzaba con pegarle "y de paso cerra el arb" al final.` | Grupo 2 | La regla durable es la ultima frase (*"los checks de contenido corren sobre el mensaje completo"*) | baja | flag (entra en el move del #31) |

### lecciones-consolidacion.md (3.607 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 34 | `lecciones-consolidacion.md:18-21` | `Por que @import y no el hook: entre el 03/08 y el 04/09 lo inyectaba session-start-context.sh… **144 sesiones arrancaron sin leerlo** mientras se hacian 31 consolidaciones` | Grupo 2 + duplicado del nucleo | El mismo caso esta en `LECCIONES_APRENDIDAS.md` (*"144 sesiones arrancaron con LECCIONES recortado a 2 KB"*), que entra en **todas** las sesiones. Aca se paga dos veces | media | rewrite a 1 linea (el tope de ~10 KB del hook es el dato tecnico que se queda) |
| 35 | `lecciones-consolidacion.md:51-53` | `La causa del ciclo de agosto (17 commits de poda en 19 dias, el archivo oscilando entre 24 y 29 KB, 2,2 consolidaciones por dia) era exactamente esa` | Grupo 2 | Tres numeros de agosto para justificar una tabla de limites que ya se explica sola | media | rewrite a 1 linea |
| 36 | `lecciones-consolidacion.md:62` | `## 🔴 PROHIBIDO pelear bytes` | 1a | Titulo en mayusculas + 🔴 sin porque al lado; el porque esta bien escrito dos lineas abajo | baja | flag (bajar a frase normal) |

### video-maquina.md (3.797 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 37 | `video-maquina.md:70-83` (14 lineas) | `## El incidente (07/09/2026)` — los 39 videos, los 13 repetidos, las citas de Fak, el cruce de 50/153 | Grupo 2 narrativa duplicada | **Verificado: la memoria `reference_videos_y_fotos_de_maquina_donde_van` (5.080 B) trae ese incidente completo**, ademas de la ruta y el formato de nombre. La regla y la memoria son casi el mismo texto | media | rewrite a 2 lineas (la cita de Fak + el puntero a la memoria) |

### patrones-corte.md (3.096 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 38 | `patrones-corte.md:45-46` | `Verificable: python scripts/patronlib_selftest.py — 7 casos malos…` | volatile specific roto | **La ruta no existe.** El archivo esta en `.claude/skills/patrones-corte-plotter/scripts/patronlib_selftest.py` (verificado), y el interprete de esta casa para geometria es `.venv-cad\Scripts\python.exe`, no `python`. Los 7 casos SI son 7 | alta | rewrite con la ruta y el interprete reales |
| 39 | `patrones-corte.md:37-38` | `**Datos de piezas reales (medidas, coordenadas, historial) NO van al repo: es público.** Van a `.sgc-cache/patrones-corte/` (ignorado)` | contradiccion con decision fechada | `git-deploy.md` (siempre cargada, decision de Fak 18/08/2026): *"Commitear y pushear normalmente aunque el diff nombre productos… part numbers… No parar a preguntar, no ofrecer limpiar, **no mover archivos a rutas gitignoreadas por esto**"*. `escritorio-tareas.md` ya se corrigio el 30/08; esta no | alta | rewrite: queda prohibido lo de `git-deploy.md` (credenciales, documentos completos del SGC); las medidas de una pieza no |
| 40 | `patrones-corte.md:17` | `**DIRECCIÓN — EL CHEQUEO FRENA, NO DECIDE.**` | 1a | Mayusculas; pero lleva su porque pegado y su caso (30/07/2026) | baja | keep |

### dev-login.md (2.245 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 41 | `dev-login.md:7,10,12-19` | `# Regla: Botón de Dev-Login — NO TOCAR NUNCA` · `Este botón es CRÍTICO` · `## Reglas absolutas:` · 4 × `NUNCA` + `DEBE` + `NO es código muerto` | 1e cluster + 1a | Seis formulaciones de **una** restriccion. El fallo es real y documentado (el comentario del codigo dice *"has been accidentally deleted 3+ times"*), asi que la prohibicion **se queda** (keep #5) — lo que sobra es el volumen: con esta densidad de mayusculas los marcadores dejan de informar y el registro ansioso del prompt se traslada a la salida | alta | rewrite: una prohibicion con su razon (ver diff); la EXCEPCION DE PRODUCCION no se toca |
| 42 | `dev-login.md:32` | `Verificado bajando assets/index-C8NUY4aA.js` | volatile specific congelado | Hash de un bundle de julio; es evidencia de una verificacion pasada, no una instruccion | baja | flag |

### hojas-proceso.md (2.023 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 43 | `hojas-proceso.md:37-38` | `El **spec de cada maquina va fuera del repo** (contraseñas de HMI, part numbers de cliente). En el repo, solo lo generico.` | contradiccion parcial con decision fechada | Las contraseñas SI siguen prohibidas (`_gateRepoPublico.mjs` CHECK-3, nacido del near-miss del 08/09). Los **part numbers de cliente** los libero Fak el 18/08 (`git-deploy.md`) | media | rewrite: dejar las contraseñas, sacar los part numbers |
| 44 | `hojas-proceso.md:30-35` | `hoja_proceso_check.py` · `hojalib.py` · `hojalib_selftest.py — 25 casos` | — | Los tres existen y el selftest da **25** (20 casos registrados + 5 chequeos extra, `len(CASOS) + 5`). Correcto | — | keep |

### verify-supabase-live.md (1.829 B) · database.md (1.876 B)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 45 | `verify-supabase-live.md:14` | `docs/AUDITORIA_* / docs/PROPUESTA_*` | volatile specific vencido | Esos archivos se movieron a `docs/_archive/` (verificado: `AUDITORIA_AMFE_150_2026-05-08.md`, `AUDITORIA_CODIGO.md`, etc.; `docs/` ya no tiene ninguno) | media | rewrite la ruta |
| 46 | `verify-supabase-live.md:19` | `…o MCP Supabase` | volatile specific | No hay ningun servidor MCP de Supabase configurado (ni global ni de proyecto; no hay `.mcp.json`). Es una alternativa muerta que la sesion puede intentar | media | delete las 3 palabras |
| 47 | `verify-supabase-live.md:10` · `database.md:18` | `# Supabase live = unica fuente de verdad (Iron Law)` · `**Iron Law (regla verify-supabase-live.md):**` | 1a + ingles | `core-prohibiciones.md` §4 ("espanol argentino, cero jerga inventada", siempre cargada) y la memoria `sin_ingles_random`. "Iron Law" es branding de presion, no informacion | baja | flag |
| 48 | `verify-supabase-live.md:23` | `Si me encuentro citando un dump para afirmar estado: PARAR y **querar** live.` | 1c repeticion + typo | Repite en mayusculas lo que la linea 12 ya dice como regla, y "querar" no es una palabra | baja | flag |
| 49 | `database.md:18` vs `verify-supabase-live.md` entera | Las dos cargan juntas en `scripts/**` y dicen lo mismo | 1c duplicado | Coinciden, no se contradicen → keep list #8 (redundancia que funciona). Se anota, no se toca | baja | keep |

### control-plan.md (4.597 B) · dxf-entregable.md (3.401 B) · testing.md · exports.md

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 50 | `control-plan.md:9` | `las reglas de filtrado CP→HO quedan solo como conocimiento historico` | 1d fosil | Habla de reglas que **ya no estan en el archivo**: apunta a un hueco | media | delete la media frase |
| 51 | `control-plan.md:21` | `Core team… "Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)"` | 1c duplicado | El equipo APQP tambien vive en el skill `product-map` y en `amfe.md:102` (ahi son otros tres: Carlos, Manuel, Facundo). No se contradicen —son listas distintas para cosas distintas— pero es el tipo de dato que deriva | baja | flag |
| 52 | `dxf-entregable.md:15-16` | `AutoCAD 2026 esta instalado en la notebook y tiene motor headless — **no hay excusa** para no consultarlo.` | 1a | El hecho (esta instalado, hay motor headless) es el argumento entero; "no hay excusa" es volumen | baja | flag |
| 53 | `dxf-entregable.md:33-35` | `Cai en los dos lados el mismo dia: primero entregue R12 con ellas, despues las saque de un R2013 "para arreglarlo"` | Grupo 2 corta | Dos lineas, y son el porque de que la tabla sea asimetrica | baja | keep |
| 54 | `testing.md:7` | `# Testing Standards` | 1c cosmetico | Unico titulo en ingles del lote (core §4) | baja | flag |
| 55 | `exports.md` (entero) · `documentacion-oficial.md` (entero) | — | — | **Sin hallazgos.** Verificados contra el codigo: `controlProcedure` esta excluido del export CP (comentario en `controlPlanExcelExport.ts:32`), `_exportOficial.ts` existe, las 4 carpetas oficiales estan "verificadas en disco" como dice la regla | — | keep |

## 5. Diff propuesto

Un hunk por hallazgo. Se aplican sin releer las 18 reglas.

---

### #1 · `cad-3d.md:152-158` — gate que no existe

**Viejo** (final del primer bullet de GATE 3):
```
  **listar que PARES de cosas compara cada control** y ver cual interfaz no la mira nadie.
  Enforcement: `chequeo_apoyo_nido.py`, que nacio con su control sintetico y con codigo 1.
```
**Nuevo:**
```
  **listar que PARES de cosas compara cada control** y ver cual interfaz no la mira nadie.
  Toda interfaz que carga peso lleva su propio control, con su caso sintetico en rojo. (El
  chequeo de aquel caballete vivia en la carpeta del dispositivo de adhesivado, fuera del repo.)
```

---

### #2 · `cad-3d.md:327-331` — tope de tiempo sin codigo

**Viejo:**
```
- **Esperar no es supervisar.** El que espera no puede distinguir *"está trabajando"* de *"se
  colgó"* sin un límite declarado. El tope va **en el código**, no en mi memoria:
  `validar_todo.py` corta cualquier paso a los 25 min (`ADH_TOPE_MIN`), lo marca `CORTADO` y
  **sigue con los demás** — una corrida de 25 pasos no se pierde por uno. Y cada paso imprime
  sus minutos, así que algo que se fue de escala se ve en la primera corrida.
```
**Nuevo:**
```
- **Esperar no es supervisar.** El que espera no puede distinguir *"está trabajando"* de *"se
  colgó"* sin un límite declarado. **El tope va en el código de la cadena, no en mi memoria**:
  cada paso corta a los 25 min, se marca `CORTADO` y la cadena **sigue con los demás** — una
  corrida de 25 pasos no se pierde por uno. Y cada paso imprime sus minutos, así que algo que
  se fue de escala se ve en la primera corrida.
```

---

### #3 · `cad-3d.md:316-318` — scripts muertos

**Viejo:**
```
**Y no se edita un script mientras la cadena está corriendo.** Mismo día, corrida entera perdida: la
segunda pasada de `verificar_nido.py` agarró el archivo a medio editar y salió con `NameError`. Los
subprocesos leen el archivo cuando arrancan, no cuando arrancó la cadena.
```
**Nuevo:**
```
**Y no se edita un script mientras la cadena está corriendo.** Los subprocesos leen el archivo
cuando arrancan, no cuando arrancó la cadena: editar a mitad de corrida devuelve un `NameError`
en la segunda pasada y se pierde la corrida entera (29/08/2026).
```

---

### #4 · `cad-3d.md:247` — fosil "en esta sesión"

**Viejo:** `  *Enforcement ya cargado en esta sesión:* `build_gancho.py::derivadas()` las calcula en cada`
**Nuevo:** `  *Enforcement:* `build_gancho.py::derivadas()` las calcula en cada`

---

### #5 · `cad-3d.md:60-66` — el umbral de color que se tumbo

**Viejo:**
```
- **Se MIDE cuánto color tiene el render y se informa — no bloquea.** Nació bloqueante con umbral
  0,35 y una auditoría independiente lo tumbó el mismo día por los dos lados: un matplotlib real
  (`caballete_TODAS.png`) da **0,353 y pasaba**, y un render legítimo de foto3d de un dispositivo
  **de un solo material** —un caballete de tubo pintado de un color, que es lo que Barack fabrica—
  da **0,000 y quedaba rechazado**. Dejaba pasar lo malo y frenaba lo bueno. **Dos hipótesis mías
  caídas contra datos el mismo día** (antes había probado luminancia y dio al revés): están escritas
  con los números en el skill para que nadie las reinvente. El que bloquea es el motor declarado.
```
**Nuevo:**
```
- **El color del render se MIDE y se informa; el que bloquea es el motor declarado.** Un umbral de
  color no separa: un matplotlib malo da 0,353 y un render legítimo de un dispositivo de un solo
  material —lo que Barack fabrica— da 0,000. Las dos hipótesis probadas y caídas (color y
  luminancia) están con sus números en el skill `cad-design` para que nadie las reinvente.
```

---

### #6 · `cad-3d.md` — las 9 apariciones de "Mismo día"

Reemplazar cada `Mismo día` / `Y el mismo error otra vez, en la misma sesión` por la fecha, una sola vez
por bloque, y sacarla del resto:

| Linea | Viejo | Nuevo |
|---|---|---|
| 213 | `Y el mismo error otra vez, en la misma sesión: **heredé` | `Y el mismo error de nuevo: **heredé` |
| 229 | `no se declara.** 2026-08-24, gancho de mochila:` | *(ya tiene fecha — sin cambio)* |
| 240 | `se escribe como número.** Mismo día, misma pieza: Fak probó` | `se escribe como número.** 2026-08-24, misma pieza: Fak probó` |
| 258 | `con la pieza en su lugar de uso.** Mismo día: la nariz` | `con la pieza en su lugar de uso.** 2026-08-24: la nariz` |
| 277 | `dispositivo de adhesivado: para decidir` | *(ya tiene fecha — sin cambio)* |
| 292 | `DECLARA.** Mismo día: gmsh no puede mallar` | `DECLARA.** 2026-08-29: gmsh no puede mallar` |
| 308 | `no es evidencia.** Mismo día: barrí la sección` | `no es evidencia.** 2026-08-29: barrí la sección` |
| 316 | `corriendo.** Mismo día, corrida entera perdida:` | *(cubierto por el hunk #3)* |
| 336 | `- **Y cuando el paso es lento de verdad,` | *(sin cambio)* |

---

### #7 y #8 · `cad-3d.md` — mover los casos a memoria

**Mover a memoria nueva `reference_cad_gates_casos_fuente_2026-08.md`** el texto integro de:
`cad-3d.md:183-196` (GATE 3.5, del *"2026-08-25: de un croquis…"* hasta *"…no sabés si protege."*),
`cad-3d.md:199-217` (GATE 4, desde *"vistazo: "tiene demasiada base…"* hasta *"…antes que ningún cálculo mío."*)
y `cad-3d.md:277-283` + `292-302` + `308-314` (los cuerpos de GATE 3.6, 3.7 y 3.8).

En la regla queda, por gate, la prescripcion sin el caso:

```
**GATE 3.5 — un croquis a mano se escala contra una cota IDENTIFICADA.** Antes de multiplicar una
proporción por algo, decir QUÉ es el denominador en la pieza real y verificarlo contra una foto del
conjunto montado. Si la escala no está identificada con certeza, falta una cota, no falta
interpretación. *Enforcement:* `examples/gancho_mochila/build_gancho_leo.py` aborta si `cano.ancho`
no supera a `cano.espesor` y mide el hueco sobre el sólido construido. **Un assert se prueba con su
contraejemplo el mismo día que se escribe: si nunca lo viste dar ROJO, no sabés si protege.**
Los casos que lo originaron: memoria `cad_gates_casos_fuente_2026-08`.
```

```
**GATE 4 — el resultado tiene que tener SENTIDO, no solo cerrar paso a paso.** Un utillaje puede
pasar los siete controles del encastre y ser tres veces más grande de lo que la función pide. Tres
fallas de método que lo producen: copiar un parámetro sin verificarlo con su propia fórmula;
dimensionar en cadena sin mirar nunca el total (*cap por fase ≠ cap total*); y tratar una solución
como LA solución cuando el sistema tiene una **familia** de soluciones con la misma fuerza y la misma
deformación. Fak, 2026-08-07: *"tiene demasiada base, muy alta, se ve obvio que se puede"*.
Los números de ese caso: memoria `cad_gates_casos_fuente_2026-08`.
```

```
**GATE 3.6 — un control puede SEPARAR y estar mirando el número equivocado.**
- **Un volumen se integra sobre el B-Rep, no sobre la malla** — y si se mide sobre malla, primero
  `merge_vertices()` y `is_watertight`.
- **Que un criterio separe no prueba que esté mirando lo que cree.** Al lado de cada criterio va el
  número que lo sostiene, y si dos criterios independientes no coinciden, **ABORTA** en vez de
  quedarse con el más probable.
```

```
**GATE 3.7 — un mallador que no converge no es "lento": es el mallador equivocado, y el motor se DECLARA.**
- Antes de esperar, **medir**: si un mallado no cierra en un tiempo que se pueda explicar, probar el
  otro motor en vez de subir el límite (gmsh 2 h sin terminar contra 25 s de OpenCascade, en la misma pieza).
- **El motor va declarado por pieza y escrito en el JSON de salida**, nunca elegido en silencio.
- Se mide cuánto mueve el cambio **sobre la pieza donde se conoce la respuesta** antes de adoptarlo.
- **El nombre del caché sale de UN lugar y lleva firma + motor + el parámetro que gobierna la malla**
  (`lc` para gmsh, `tol` para OCC).
```

```
**GATE 3.8 — un barrido que no PUEDE refutar la conclusión no es evidencia.** Es el test del valor
gemelo aplicado al parámetro: si el gemelo no cambia cuando cambia la magnitud que barro, ese barrido
no está midiendo eso. Y una premisa de comparación **se cita o no se escribe**: si no tiene fuente,
se nombra el evento real o se deja fuera.
```

Y arriba de todo, despues de la linea 17, **agregar el orden** (que hoy hay que reconstruir):

```
**El orden en que corren:** P (proceso) → 0 y 0.1 (dónde y qué) → 1 (pre-modelado) → 2 (frame) →
3 a 3.9 (pre-entrega, los controles) → 4 (sentido del resultado) → 5 (¿el proceso repite?) → E (entregable).
```

---

### #10 · `amfe.md:62-64` — "antes de esta fecha esta regla decia"

**Viejo:**
```
🔴 **En Barack conviven TRES notaciones y no coinciden.** Antes de esta fecha esta regla decia
que los valores validos eran solo `"CC"`, `"SC"` y `""`, y que los simbolos del cliente se
traducian **hacia** Barack. Las dos cosas quedaron desactualizadas.
```
**Nuevo:**
```
**En Barack conviven TRES notaciones y no coinciden.** La sigla que se escribe depende de a quien
va el documento, no de una tabla unica.
```

---

### #11 · `amfe.md:181` — los numeros de la version anterior

**Viejo** (el parentesis, dentro del parrafo de §12):
```
 (Hasta el 23/08 aca decia `HF 50/51/61/63` y `HRC-HRO 50 varilla / 60 enfundado`: numeros previos a la renumeracion del 18-20/08, y el fragmento de los traseros ademas se contradecia con la frase de arriba. Los numeros salen de `node scripts/_verificarNumeracion.mjs`, que los compara contra el flujograma; esta regla solo los cita.)
```
**Nuevo:**
```
 (Los numeros salen de `node scripts/_verificarNumeracion.mjs`, que los compara contra el flujograma; esta regla solo los cita.)
```

---

### #12 · `amfe.md:184` — dos fosiles en una linea

**Viejo:**
```
  ⚠️ Enforcement del episodio (cargado en esta misma sesion, 23/08): el 18/08 12:40 se fijo VARILLA->FUNDA por lo que Fak dijo, y a las 16:47 `_alinearAmfesPatagonia.mjs` lo invirtio renumerando, sin registrarlo en el commit. Ahora lo frena `assertOrdenPreservado()` de `scripts/_lib/ordenProceso.mjs` (`ORDEN_PROCESO_ALTERADO`), cableado en ese script; tests en `__tests__/scripts/ordenProceso.test.mjs` (9, con el plan real de aquel dia como fixture) y 2 filas en `_verificarAprendizajeAmfe.mjs`. **No decide cual orden es correcto**: solo impide que una renumeracion lo de vuelta en silencio. Fak 18/08/2026: *"es imposible que se inyecte sin la funda, se saldria todo el material"*, *"lo tengo 100% claro"*. ⚠️ Hasta esa fecha esta regla decia que los traseros iban "directo a PU": **era falso**, y los AMFE 153/155 tenian el tramo invertido (corregido con `scripts/_corregirOrdenApoyacabezasTraseros.mjs`). La regla se habia redactado describiendo esos mismos AMFE, asi que heredo su error — **una regla que solo describe lo que dice un documento no lo valida**, y encima prohibia tocarlo, que es lo que lo mantuvo vivo. Enforcement: check `PU_ANTES_DE_ENFUNDADO` (CRITICAL) en `scripts/_lib/amfeValidator.mjs`. SI alinear severidades de fallas comunes mal calibradas.
```
**Nuevo:**
```
  **Una renumeracion no puede dar vuelta el orden del proceso en silencio**: lo frena `assertOrdenPreservado()` de `scripts/_lib/ordenProceso.mjs` (`ORDEN_PROCESO_ALTERADO`), con 9 tests en `__tests__/scripts/ordenProceso.test.mjs`. No decide cual orden es correcto: solo impide el cambio mudo. Fak 18/08/2026: *"es imposible que se inyecte sin la funda, se saldria todo el material"*, *"lo tengo 100% claro"*. **Una regla que solo describe lo que dice un documento no lo valida** — y si ademas prohibe tocarlo, lo mantiene vivo. Enforcement del orden: check `PU_ANTES_DE_ENFUNDADO` (CRITICAL) en `scripts/_lib/amfeValidator.mjs`. SI alinear severidades de fallas comunes mal calibradas.
```

---

### #13 · `amfe.md:190-194` — la tabla de D que ya no esta

**Viejo:**
```
🔴 **Corregidas el 24/08/2026 (OK de Fak: *"si no coincide con la oficial hay que corregirla"*).**
La tabla de D que estaba aca ponia *"100% visual + dimensional"* en **4-5** y *"visual por lote"*
en **6-7**. Es falso, y subdeclaraba riesgo en todos los AMFE. Lo destapo `/auditoria-cliente`
sobre el AMFE 172: al recalificar sus 47 causas el AP salto de `L=9/M=22/H=15` a `M=12/H=35`.
**Enforcement: check `DETECTION_HUMANA_OPTIMISTA` en `scripts/_lib/amfeValidator.mjs`.**
```
**Nuevo:**
```
**Transcritas del manual, no derivadas (OK de Fak 24/08/2026: *"si no coincide con la oficial hay
que corregirla"*).** Una escala de D generosa subdeclara riesgo en todos los AMFE a la vez: al
recalificar las 47 causas del AMFE 172 con la tabla oficial, el AP paso de `L=9/M=22/H=15` a
`M=12/H=35`. **Enforcement: check `DETECTION_HUMANA_OPTIMISTA` en `scripts/_lib/amfeValidator.mjs`.**
```

---

### #14 · `amfe.md:181-183` — mover el episodio del apoyacabezas

**Mover** todo el cuerpo narrativo de §12 (desde `**El par ENFUNDADO/VARILLA no esta invertido…` hasta el final
de la linea 183) a las **dos memorias que ya existen y ya lo contienen** —
`reference_apoyacabezas_funda_es_bolsa.md` y `reference_apoyacabezas_varilla_epp_proceso_real.md`:
antes de borrar, cotejar que las HO-968/969/970 y el estado abierto del EPP esten en la segunda (verificado:
su `description` ya dice *"la OP41 no inserta ninguna varilla… el EPP existe solo en el delantero"*).

**En la regla queda:**
```
- **Headrest Front vs Rear NO tienen el mismo proceso, pero LOS DOS ENFUNDAN ANTES DE ESPUMAR.** HF: inserto **EPP** + varilla, 16 OPs. HRC/HRO: **solo varilla**, 14 OPs. Lo que NO difiere es el orden: en los tres el PU se inyecta **adentro de la funda ya montada** y la pieza sale terminada del molde. Los tres van `40 ENFUNDADO / 41 INSERCION DE VARILLA` y el PU es `52 INYECCION DE PU`; HF suma en el medio `50 colocacion de bolsa y carga al molde / 51 cierre de molde y boquilla`. (Los numeros salen de `node scripts/_verificarNumeracion.mjs`; esta regla solo los cita.)
  **NO dar vuelta 40/41 en ningun documento.** La espuma **no existe todavia** cuando se enfunda: el PU se crea in-place, o sea que la funda es una **BOLSA** y "enfundar" es meter la estructura adentro. Por eso *"agarras la estructura, le metes la funda"* (Fak) y *"Correcta colocacion de Asta en Funda"* (Plan de Control) describen el mismo gesto desde los dos lados.
  **El defecto real de los traseros es la PARTICION, no el orden:** tienen un solo componente (`FRAME ASM`, ya armado), asi que 40 y 41 son el mismo acto partido en dos — por eso la OP40 ENFUNDADO del 153 y del 155 esta VACIA. Cuando se arregle, es **fusionar 40+41**, no intercambiarlas. Lo que queda en la 41 es sellar el vinilo alrededor de la varilla como reten contra fuga de PU: **el nombre de la operacion describe algo que no ocurre**. Antes de dar por buena una secuencia, leer que HACE cada paso — la HO es el unico documento que describe el gesto del operario.
  ⚠️ **Abierto, lo define Fak: cuando entra el EPP.** Es exclusivo del delantero, manual, y los tres documentos no cierran (el AMFE preliminar lo pone antes de enfundar con una prensa que no existe, el AMFE vivo dentro del enfundado, la HO-968 no lo menciona en 27 paginas). **No corregir el AMFE 151 contra la HO por cuenta propia.** Detalle, citas y rutas de las HO: memorias `apoyacabezas_funda_es_bolsa` y `apoyacabezas_varilla_epp_proceso_real`.
```

---

### #15 · `amfe.md:227-234` — "esta regla tenia solo el punto 2"

**Viejo:**
```
🔴 El 31/08/2026 esta regla tenia solo el punto 2 y por eso un script llevo **100 causas de
muestreo a D=7**, que es MEJOR de lo que la tabla admite. Lo destapo `/auditoria-cliente`:
eran 298 en el lote de Patagonia, y otras 36 con el control vacio calificadas 8.
Enforcement de los dos puntos nuevos: checks **`DETECCION_MUESTREO_OPTIMISTA`** y
**`DETECCION_SIN_CONTROL_DECLARADO`** (WARNING) en `scripts/_lib/amfeValidator.mjs`, con
`esMuestreoParcial()` exportado para que el validador y los scripts usen **una sola**
definicion de "muestreo"; 7 casos en `_verificarAprendizajeAmfe.mjs` (37/37) y test propio.
Memoria: `feedback_muestreo_no_es_control_al_100`.
```
**Nuevo:**
```
Enforcement de los puntos 1 y 3: checks **`DETECCION_MUESTREO_OPTIMISTA`** y
**`DETECCION_SIN_CONTROL_DECLARADO`** (WARNING) en `scripts/_lib/amfeValidator.mjs`, con
`esMuestreoParcial()` exportado para que el validador y los scripts usen **una sola** definicion
de "muestreo". Sin el punto 1, un solo script puede llevar cientos de causas de muestreo a D=7 de
una pasada. Memoria: `feedback_muestreo_no_es_control_al_100`.
```

---

### #19 · `escritorio-tareas.md:176-179` — el "antes decia"

**Viejo:**
```
Nombrar una tarea, producto o persona
en código, tests o commits está cubierto por la decisión de Fak del 18/08/2026 (regla
`git-deploy.md`: el repo es público y eso no frena el push) — esta línea decía "datos reales
NO van al repo" desde antes de esa decisión y quedaba en contradicción con ella (lo señaló el
auditor el 30/08). Lo prohibido sigue siendo lo de `git-deploy.md`: credenciales, contenido
de mails/documentos del SGC, `.claude/memory/` versionado.
```
**Nuevo:**
```
Nombrar una tarea, producto o persona
en código, tests o commits está cubierto por la decisión de Fak del 18/08/2026 (regla
`git-deploy.md`: el repo es público y eso no frena el push). Lo prohibido sigue siendo lo de
`git-deploy.md`: credenciales, contenido de mails/documentos del SGC, `.claude/memory/` versionado.
```

---

### #20 · `escritorio-tareas.md:88-91`

**Viejo:**
```
Tenía razón: la regla decía dónde va el entregable **al cerrar** y no decía dónde **se
genera**. Yo generé el PDF de difusión de un cambio de BOM dentro de la carpeta de la tarea,
en el Escritorio, y se lo reporté como si eso fuera entregarlo. De ahí salen solas las dos
copias que el §2 prohíbe: una suelta en la cola y otra que se va al archivo al cerrar.
```
**Nuevo:**
```
Generar el entregable dentro de la carpeta de la tarea y reportarlo desde ahí produce solas las
dos copias que el §2 prohíbe: una suelta en la cola y otra que se va al archivo al cerrar.
```

---

### #21 · `escritorio-tareas.md:17-22` y `:46-47` — los tres numeros congelados

**Viejo (17-22):**
```
El Escritorio llegó a **81 iconos** y a Fak le molestaba. Se creó **`_EN ESPERA`**: a la vista
quedan solo las tareas de la semana, y las trabadas o de baja prioridad van adentro.

**Lo de adentro sigue ABIERTO.** No es archivo, no es cierre, no es basura: es la misma cola,
corrida de la vista. El relevador entra y las cuenta (`10 a la vista + 27 en _EN ESPERA = 37
abiertas`); sin eso contaba la bandeja como *una* tarea y perdía 27 de vista.
```
**Nuevo:**
```
Cuando el Escritorio se llena, a Fak le molesta. Por eso existe **`_EN ESPERA`**: a la vista
quedan solo las tareas de la semana, y las trabadas o de baja prioridad van adentro.

**Lo de adentro sigue ABIERTO.** No es archivo, no es cierre, no es basura: es la misma cola,
corrida de la vista. El relevador **entra y las cuenta una por una**: abiertas = las de la raíz
+ las de `_EN ESPERA`. Contar la bandeja como *una* tarea pierde de vista todo lo que hay adentro.
```

**Viejo (46-47):**
```
Antes, toda candidata volvía a él. Con 56 tareas abiertas eso lo convertía en el cuello de
botella de su propia cola: revisar 20 carpetas para archivar 20 obvias.
```
**Nuevo:**
```
Devolverle toda candidata lo convierte en el cuello de botella de su propia cola: revisar veinte
carpetas para archivar veinte obvias.
```

---

### #22 · `escritorio-tareas.md:169` y `:196` — conteos de tests

| Linea | Viejo | Nuevo |
|---|---|---|
| 169 | `` `scripts/_lib/mailCache.mjs` + `mailCache.test.mjs` (21). `` | `` `scripts/_lib/mailCache.mjs` + `mailCache.test.mjs`. `` |
| 196 | `` - **Tests**: `__tests__/scripts/escritorio.test.mjs` (36) y `escritorioGuard.test.mjs` (19). `` | `` - **Tests**: `__tests__/scripts/escritorio.test.mjs` y `escritorioGuard.test.mjs`. `` |

---

### #24 · `mail-envio.md:10-12` — el blockquote fosil

**Borrar** (y la linea en blanco que le sigue):
```
> ENFORCEMENT YA CARGADO (misma sesion, 2026-08-14): hook `mail-guard.sh` registrado en
> `_dispatcher.sh` + `scripts/_mailEnviar.py` con gate y `--selftest` (9 casos, verde),
> probado contra el caso real del incidente: bloquea.
```

---

### #25 · `mail-envio.md` frontmatter — el glob `**/*.py`

**Viejo:**
```
paths:
  - "scripts/_mail*"
  - "**/*.py"
```
**Nuevo:**
```
paths:
  - "scripts/_mail*"
  - "**/*mail*.py"
  - "**/*outlook*"
  - ".claude/hooks/mail-guard*"
```

---

### #26 · `mail-envio.md:124-130` — el incidente fuente

**Viejo:**
```
## Incidente fuente — 2026-08-14

Fak mando el mail del AMFE 150 a Marcelo, Nicolas y Carlos. Quedo en la Bandeja de salida sin
transmitir (Outlook estaba corriendo sin ninguna ventana). Yo mire la cola, vi el item y le afirme
en negrita *"el mail no salio, no hay nada que recuperar"*. Lo saque de la cola, lo edite y lo
mande. Salieron **dos mails**. Fak: *"se terminó enviando 2 veces… es un error grave"*.
Detalle en la memoria `mail_ya_enviado_verificar_justo_antes`.
```
**Nuevo:**
```
## De donde sale el gate — 2026-08-14

Un mail que Fak ya habia mandado se reenvio porque lei la Bandeja de salida como prueba de que no
habia salido. Fak: *"se terminó enviando 2 veces… es un error grave"*.
Caso completo: memoria `mail_ya_enviado_verificar_justo_antes`.
```

---

### #27 · `mail-envio.md:56-59` — script que ya no existe

**Viejo:**
```
**Los destinatarios se agregan con `mail.Recipients.Add()`, NUNCA como string en `mail.To`.**
Incidente 08/09/2026: `_prepararMail.py` resolvia contra el namespace pero asignaba un string
a `mail.To`; los destinatarios quedaban con `Address: ""` vacia y Exchange rebotaba con
*"Ninguna de sus cuentas pudo enviar a este destinatario"*. El camino correcto:
```
**Nuevo:**
```
**Los destinatarios se agregan con `mail.Recipients.Add()`, NUNCA como string en `mail.To`.**
Resolver los nombres contra el namespace y despues asignar un string a `mail.To` deja a los
destinatarios con `Address: ""` vacia, y Exchange rebota con *"Ninguna de sus cuentas pudo enviar
a este destinatario"* (08/09/2026). El camino correcto:
```

---

### #28 · `arb-no-cerrar.md:56-59` — el conteo del test

**Viejo:**
```
Probado en las **dos** direcciones — `bash .claude/hooks/arb-cerrar-guard.test.sh`, 26 casos:
14 que tienen que bloquear, 10 del trabajo diario que tienen que pasar, y 2 del escape de un
solo uso.
```
**Nuevo:**
```
Probado en las **dos** direcciones — `bash .claude/hooks/arb-cerrar-guard.test.sh`: los que tienen
que bloquear, los del trabajo diario que tienen que pasar, y los del escape de un solo uso.
```

---

### #29 · `arb-no-cerrar.md:61-78` — mover los 8 bypasses

**Mover a memoria nueva `feedback_arb_cerrar_guard_los_8_bypasses.md`** el texto integro de las lineas
61-71 (desde `### Lo que le agregó la auditoría del 31/08 (8 bypasses reales)` hasta `· `shutdown /l`.`).

**En la regla queda, en lugar de esas 11 lineas:**
```
### Las dos decisiones de diseño (salieron de una auditoría independiente, 31/08)

La primera versión cazaba **la forma en que yo lo había escrito** y nada más: un agente auditor
encontró 8 maneras de cerrar el arb que pasaban limpias, varias con sintaxis **más natural** que
la que sí cazaba. Están todas en la suite, marcadas `[AUDIT 31/08]` (lista y detalle: memoria
`arb_cerrar_guard_los_8_bypasses`).

- **Los verbos van en lista canónica, no en un regex parcial.** El agujero grande era exigir un
  espacio detrás de `kill`, que descartaba `.Kill()` y `os.kill(`.
- **Un kill por PID pelado se RESUELVE**: el guardián extrae el número y pregunta
  `tasklist //FI "PID eq N"` si ese proceso es `produc.exe`. Sólo en ese caso, que es raro.
```

*(Las 4 lineas de `### Límites conocidos, escritos a propósito` y sus sub-bullets se quedan intactas:
son el contrato del guardian, keep list #4.)*

---

### #30 · `arb-no-cerrar.md:22-32` — el incidente

**Viejo:**
```
## El incidente

31/08/2026, tarea del remache de ductos. Terminé de leer el maestro de insumos y cerré el
arb, porque una instrucción que me llegó decía "cuando termines, cerralo". Veinte minutos
después había que cargar el reemplazo en la BOM. Lo relancé yo (`Z:\arb\prod\produc.exe`) y
quedó en la pantalla de login: la tarea se frenó **dos veces** esperando a Fak, por algo que
yo mismo había roto. Fak: *"no vuelvas a cerrar arb sin consultarme, nueva regla dura...
fue gravísimo eso"*.

Detalle que agrava el asunto: el campo `Usuario` se autocompleta con `FACUNDOS-PC`, y el
usuario real del arb es `FACUNDO`. Ni siquiera alcanzaría con la contraseña.
```
**Nuevo:**
```
## De dónde sale

Una instrucción que llegó de otra sesión decía "cuando termines, cerralo". Se cerró, y veinte
minutos después la tarea se frenó **dos veces** esperando a Fak para reabrirlo. Fak: *"no vuelvas
a cerrar arb sin consultarme, nueva regla dura... fue gravísimo eso"*.

Y ni siquiera alcanzaría con tener la contraseña: el campo `Usuario` se autocompleta con
`FACUNDOS-PC` y el usuario real del arb es `FACUNDO`.
```

---

### #31 · `coordinador.md:74-106` — mover la auditoria independiente

**Mover a memoria nueva `feedback_coordinador_auditoria_independiente_2026-09-02.md`** el texto integro de
las lineas 74-89 (titulo + parrafo de los 148 casos + la tabla de 7 agujeros) y 104-106 (el bypass del test rojo).

**En la regla queda:**
```
## Lo que una auditoría independiente le encontró a la primera versión (02/09/2026)

Recién escrito, el cerrojo dejaba pasar **92 de 111 evasiones** y frenaba **21 de 37 mensajes
legítimos**: no frenaba lo que tenía que frenar Y molestaba en el trabajo normal. Los 7 agujeros
están tapados y clavados en la suite; el detalle, en la memoria
`coordinador_auditoria_independiente_2026-09-02`. Lo que queda como criterio:

- **No distinguir ordenar de mencionar es tan grave como no frenar**: un candado que molesta se
  termina desactivando entero. Frenaba *"quedo pendiente mandar el mail — lo hace Fak"* y *"el hook
  existe para que nadie pueda cerrar el arb"*.
- **Los checks de contenido corren sobre el mensaje COMPLETO**, no sobre lo que quedó fuera del
  bloque validado: alcanzaba con pegarle *"y de paso cerra el arb"* al final.
- **Lo que la lista de patrones NO va a resolver nunca:** el auditor probó 31 formas de pedir una
  acción irreversible y **pasaron las 31** (*"deja cerrado el arb"*, *"close the arb"*). Agregar
  patrones es una carrera perdida contra el castellano. La defensa real de G4 es el gate que vive
  **donde la acción se ejecuta** (`arb-cerrar-guard.sh`, `mail-guard.sh`). Esto es una capa más.
```

---

### #34 y #35 · `lecciones-consolidacion.md:18-21` y `:51-53`

**Viejo (18-21):**
```
Por que @import y no el hook: entre el 03/08 y el 04/09 lo inyectaba `session-start-context.sh`,
y Claude Code guarda toda salida de hook mayor a ~10 KB en un archivo dejandole al modelo un
preview de 2 KB. **144 sesiones arrancaron sin leerlo** mientras se hacian 31 consolidaciones
para mantenerlo. El @import no tiene ese tope y sobrevive la compactacion.
```
**Nuevo:**
```
Por que @import y no un hook: Claude Code guarda toda salida de hook mayor a ~10 KB en un archivo
y le deja al modelo un preview de 2 KB — un archivo de este tamaño no llega entero por ahi. El
@import no tiene ese tope y sobrevive la compactacion.
```

**Viejo (51-53):**
```
La causa del ciclo de agosto (17 commits de poda en 19 dias, el archivo oscilando entre 24 y
29 KB, 2,2 consolidaciones por dia) era exactamente esa: los bullets "graduados a X"
conservaban su historia completa. Con el gate por bullet el techo de bytes no se toca.
```
**Nuevo:**
```
Un archivo que oscila contra su techo y se poda todos los dias tiene siempre la misma causa: los
bullets "graduados a X" conservan su historia completa. Con el gate por bullet el techo de bytes
no se toca.
```

---

### #37 · `video-maquina.md:70-83` — mover el incidente

**Borrar** las lineas 70-83 (`## El incidente (07/09/2026)` y todo su cuerpo) y **reemplazar** por:

```
## De dónde sale el candado (07/09/2026)

Se bajaron 39 videos del iPhone a carpetas del Escritorio; **13 ya estaban archivados en la
biblioteca**, con nombre descriptivo. La respuesta estaba escrita en los nombres de archivo.
Fak: *"ah nunca entendiste que tenias que cargarlos ahi? ... es gravisimo lo que paso"*,
*"no se pone algo que te obligue a recordar? un seguro"*. El cruce que este candado obliga a hacer
encontró, sobre el carrete completo, **50 de 153 videos ya archivados**.
Caso completo: memoria `videos_y_fotos_de_maquina_donde_van`.
```

---

### #38 · `patrones-corte.md:45-47` — la ruta rota del selftest

**Viejo:**
```
  `piquetes_verificados`. Verificable: `python scripts/patronlib_selftest.py` — 7 casos malos
```
**Nuevo:**
```
  `piquetes_verificados`. Verificable:
  `.venv-cad\Scripts\python.exe .claude\skills\patrones-corte-plotter\scripts\patronlib_selftest.py` — 7 casos malos
```

---

### #39 · `patrones-corte.md:37-38` — contradice la decision del repo publico

**Viejo:**
```
**Datos de piezas reales (medidas, coordenadas, historial) NO van al repo: es público.**
Van a `.sgc-cache/patrones-corte/` (ignorado) o a la carpeta de trabajo de Fak.
```
**Nuevo:**
```
Los patrones, sus bitácoras y los archivos de trabajo viven en la carpeta de la pieza o en
`.sgc-cache/patrones-corte/`, que es donde se los busca — no en el repo, porque ahí no los
encuentra nadie. Que el diff nombre una pieza, una medida o un part number **no frena el push**
(decisión de Fak 18/08/2026, regla `git-deploy.md`); lo que sigue prohibido es lo de ahí:
credenciales y documentos completos del SGC.
```

---

### #41 · `dev-login.md:7-19` — el cluster de prohibiciones

**Viejo:**
```
# Regla: Botón de Dev-Login — NO TOCAR NUNCA

El componente de login tiene un botón "Acceso rápido (dev)" con borde naranja.
Este botón es CRÍTICO para verificación visual del proyecto.

## Reglas absolutas:
- NUNCA eliminar este botón
- NUNCA mover su lógica a otro archivo
- NUNCA cambiar su comportamiento
- NUNCA remover las variables VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD
  **de `.env.local`** (desarrollo). En CI/producción ver la excepción de abajo.
- Si refactorizás LoginPage o el sistema de auth, el botón DEBE sobrevivir intacto
- Si hacés una auditoría de código, este botón NO es código muerto — es infraestructura de desarrollo
```
**Nuevo:**
```
# El botón de dev-login no se toca

`components/auth/LoginPage.tsx` tiene un botón "Acceso rápido (dev)" con borde naranja. **Ya se
borró tres veces en auditorías de código**, siempre por la misma razón: parece código muerto y no
lo es — es como se verifica visualmente la app sin tipear credenciales en cada arranque.

El botón, su lógica, su comportamiento y las variables `VITE_AUTO_LOGIN_EMAIL` /
`VITE_AUTO_LOGIN_PASSWORD` **de `.env.local`** se quedan como están, también al refactorizar
LoginPage o el sistema de auth. En CI/producción, ver la excepción de abajo.
```

---

### #43 · `hojas-proceso.md:37-38`

**Viejo:**
```
El **spec de cada maquina va fuera del repo** (contraseñas de HMI, part numbers de cliente).
En el repo, solo lo generico.
```
**Nuevo:**
```
**Las contraseñas de HMI no van al repo** (`_gateRepoPublico.mjs` CHECK-3 las busca por contenido).
El resto del spec de la maquina vive donde se lo busca —la carpeta de la maquina—, no en el repo.
```

---

### #45 y #46 · `verify-supabase-live.md:14` y `:19`

| Linea | Viejo | Nuevo |
|---|---|---|
| 14 | `` `tmp/` (dumps de inspeccion) · `backups/` · `docs/AUDITORIA_*` / `docs/PROPUESTA_*` · datos hardcodeados en scripts viejos. `` | `` `tmp/` (dumps de inspeccion) · `backups/` · `docs/_archive/AUDITORIA_*` y las auditorias viejas de `docs/_archive/` · datos hardcodeados en scripts viejos. `` |
| 19 | `` ...login con `VITE_AUTO_LOGIN_*`), o MCP Supabase. `` | `` ...login con `VITE_AUTO_LOGIN_*`). `` |

---

### #50 · `control-plan.md:9`

**Viejo:**
```
Criterios CC/SC, severidades y escalas: regla `amfe.md`. HOs no se hacen aca (regla `no-pfd-no-ho.md`); las reglas de filtrado CP→HO quedan solo como conocimiento historico.
```
**Nuevo:**
```
Criterios CC/SC, severidades y escalas: regla `amfe.md`. Las HOs no se arman desde este modulo (regla `no-pfd-no-ho.md`).
```

---

## 6. Volatile specifics verificados contra el disco

~150 en total. Lo que **no** dio verde:

| Citado en | Deberia existir | Estado real |
|---|---|---|
| `cad-3d.md:158` | `chequeo_apoyo_nido.py` | no existe en `.claude/` ni en `scripts/` |
| `cad-3d.md:329` | `validar_todo.py`, `ADH_TOPE_MIN` | no existen (unico hit de `ADH_TOPE_MIN`: la propia regla) |
| `cad-3d.md:317` | `verificar_nido.py` | no existe (solo lo nombra `cad-design/SKILL.md`) |
| `cad-3d.md:321` | `extraccion.py` | no existe |
| `cad-3d.md:155` | `chequeo_marco` | no existe |
| `patrones-corte.md:45` | `scripts/patronlib_selftest.py` | esta en `.claude/skills/patrones-corte-plotter/scripts/` |
| `mail-envio.md:57` | `_prepararMail.py` | no existe (quedan `_mailEnviar.py`, `_mails.py`) |
| `verify-supabase-live.md:14` | `docs/AUDITORIA_*`, `docs/PROPUESTA_*` | movidos a `docs/_archive/` |
| `verify-supabase-live.md:19` | MCP Supabase | ningun servidor MCP de Supabase configurado |
| `arb-no-cerrar.md:56` | 26 casos (14/10/2) | 32 `probar` (14 bloquean / 15 pasan / 2 escape) |
| `escritorio-tareas.md:196` | `escritorio.test.mjs` (36), `escritorioGuard.test.mjs` (19) | 37 y 20 |
| `escritorio-tareas.md:169` | `mailCache.test.mjs` (21) | 22 |
| `escritorio-tareas.md:17,21,46` | 81 iconos · 10 a la vista · 56 abiertas | 87 entradas · 27 en `_EN ESPERA` |
| `amfe.md:170` | `_DECISION donde van los valores` | no encontrado en el Escritorio (3 niveles) |

Lo que dio verde (muestra): los **29** archivos y **17** nombres de check de `amfe.md` (`amfeValidator.mjs`,
`forbiddenContent.data.json`, `genericLabels.ts/.mjs`, `specialChars.ts` + su test, `ordenProceso.mjs` + sus
**9** tests, `_verificarAprendizajeAmfe.mjs`, `_exportAmfeOficial.ts` con `scanRevisionMeta`,
`_verificarNumeracion.mjs`, los 3 globs de `paths:`); los **11** scripts de `cad-design` que sí existen
(`gate_proceso`, `gate_zona`, `gate_frame`, `gate_ensamble`, `gate_entregable`, `export_deliverables`,
`foto3d`, `indice_dispositivos`, `viga_voladizo`, `test_gates_proceso`, `procesoCanon.data.json`) + los 3 de
`examples/gancho_mochila` + `.venv-cad\Scripts\python.exe` + `cad-guard.sh`; los **35** hooks y los **19**
skills del disco contra los que nombran las reglas; `coordinadorGuard.test.mjs` = **31** casos exactos;
`_mailEnviar.py --selftest` = **9** casos exactos; `mail-guard.test.sh` = **15**; `patronlib_selftest.py` =
**7** casos malos; `hojalib_selftest.py` = **25** (20 + 5); `LoginPage.tsx:127` es exactamente la condición
que la regla cita; el job `repo-publico` y `_gateRepoPublico.mjs --selftest` están en `deploy.yml`;
`aria-haspopup="menu"` en `DropdownNav.tsx:142`; `vi.useFakeTimers()` en `ConfirmModal.test.tsx:8`;
`controlProcedure` excluido del export CP; `INITIAL_PROJECT`/`EXAMPLE_PROJECT` llegan por el barrel `types.ts`;
Escritorio → `Mejorar el rol de coordinador` existe; las **9** memorias citadas existen con su nombre exacto;
el commit `ccef7f09` existe.

## 7. Lo que NO se tocó, y por qué (keep list)

- **Las decisiones fechadas de Fak con su cita textual, enteras**: la regla dura del arb (31/08), la
  simbología `D/TLD` y `W` para VW (08/09), *"el manual es la ley"* (22/05), las CLARAS se cierran solas
  (31/08), el entregable no se genera en el Escritorio (28/08), el original manda (05/09), *"SE VA A VOLAR
  LA TELA"*, *"los txt son al pedo"*, *"¿te hubieses quedado así 48 horas?"*. Keep #4 y #5.
- **Los comandos exactos de operaciones frágiles**: `_mailEnviar.py`, `_escritorio.mjs --archivar`,
  `_encargo.mjs`, `_validarDxf.py`, `gate_zona.py`, `runWithValidation()`, el escape
  `touch ~/.claude/.arb-cerrar-ok`. Keep #3 — ahí lo prescriptivo es correcto.
- **Todo `control-plan.md`** (4,6 KB de datos de referencia: fases del generador, defaults inferidos,
  validaciones B1-B7, procedimientos SGC) y **`exports.md`** y **`testing.md`**: son contrato, no conducta.
  Keep #4. Verificados contra el código y correctos hoy.
- **`documentacion-oficial.md` entero**, incluido su párrafo *"Por qué — la cadena que se envenena"*: es la
  razón de la restricción, que es exactamente lo que la keep list #1 protege.
- **Las prohibiciones con gate detrás**: CC/SC solo Fak, no inventar controles, no cerrar el arb, no tocar el
  dev-login, no pelear bytes en LECCIONES. Keep #5 — el fallo está demostrado y reproduce. Lo que se propone
  bajar es el volumen de mayúsculas, nunca la prohibición.
- **`database.md` §18 duplicando `verify-supabase-live.md`**: coinciden a propósito y cargan juntas en
  `scripts/**`. Keep #8 — redundancia que funciona no es cruft.
- **Los `paths:` de 16 de las 18 reglas**: son routing y están bien calibrados. Solo se propone tocar el de
  `mail-envio.md` (`**/*.py` carga 7 KB de Outlook en cualquier script de Python).
- **Los incidentes de una o dos líneas que son el "por qué"**: `amfe.md` §5 (408 acciones inventadas), §17
  (54 causas fuera de tabla), `escritorio-tareas.md:67` (triage del 03/08), `dxf-entregable.md:33`
  (los dos lados del bug asimétrico). Se pagan una línea y explican la regla.
