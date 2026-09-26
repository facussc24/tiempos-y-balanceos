# Prompt-audit A — reglas con `paths:`, agentes y texto de hooks (26/09/2026)

**Supuestos (Paso 0 de la guia).** Alcance: lo que cambio desde `1695d553` (11/09/2026 16:12) en las
13 reglas con `paths:` pedidas, los 3 agentes completos, y el texto que llega al modelo desde los
hooks (`.claude/hooks/*.sh`, `scripts/_lib/guardianes.mjs`, `cierreGuard.mjs`, `cierreCanon.data.json`,
y dos fuentes de texto que esos hooks y reglas usan: `core/amfe/caracteristicasEspeciales.data.json`
y `scripts/_lib/coordinadorCanon.data.json → plantillaArranque`). Modelos destino: **Claude Opus 5.5**
(sesion principal) y **Claude Fable 5.1** (mejoras de codigo). `auditor` y `amfe-healer` corren con
`model: sonnet`: las derivas propias de Sonnet no se evaluaron. Trabajo de solo lectura: no toque
ningun archivo del repo.

## Resumen

| Confianza | Hallazgos |
|---|---|
| Alta | 11 |
| Media | 21 |
| Baja / flag | 15 |

Por grupo de la guia: **duplicados que discrepan** (regla↔hook, regla↔regla, regla↔codigo) 13 · 1d
fosiles y frases relativas 9 · Grupo 2 historia/estado en la regla 7 · 1f topes numericos de salida 3
· datos volatiles rotos 4 · Grupo 4 superficies que se pisan 2 · verificacion (tension Opus/Fable) y
reinsercion de instrucciones, solo flag.

**Los tres de mas impacto:**

1. **Los dos hooks que dicen "la respuesta es SI" no conocen el contrato de autonomia.**
   `pregunta-guard.sh` (corre en CADA AskUserQuestion) dice que un pedido de OK "NO se pregunta", y el
   chequeo 1 de `cierre-guard` responde a "¿Lo corro con --apply?" con "la respuesta es SI. Hacelo
   ahora". Pero `autonomy-contract.md` (always-on) exige confirmar escribir en Supabase, un listado
   maestro, lo que se hace por PRIMERA VEZ (§F, 21/09) y manda AskUserQuestion ante 2-3 caminos. Los
   hooks son del 04/09 y nadie los barrio cuando nacio §F. Con Opus 5.5 / Fable 5.1, que siguen el
   texto al pie de la letra, el hook empuja a hacer sin OK justo lo que el contrato frena. La guia de
   Fable 5.1 lo dice: si el producto necesita paradas de confirmacion, se listan.
2. **El bloqueo del arb recomienda lo que crashea el arb.** El mensaje de `arb-cerrar-guard` ofrece
   como "NO BLOQUEADO" cerrar `Maestro de Relaciones` con WM_CLOSE y `_arbVer.py reset` "que cierra y
   REABRE la de Relaciones". Desde el 25/09 la regla dice que eso crashea el arb (dos veces ese dia).
   La logica del hook y su test tambien lo dejan pasar.
3. **Hojas de proceso: tres textos mandan lo contrario de la regla vigente.** El recordatorio
   `HO-GUARD` dice "Sin documento fuente van TBD" y "Donde no hay dato va TBD" (Fak 24/09: *"no puede
   haber ni 1 TBD"* en las descripciones) y manda actualizar el listado maestro "al cerrar", editado
   por mi con Excel COM — mientras el guardian `apqp-cliente`, en el MISMO modulo, bloquea escribir
   ese listado sin OK. Y la plantilla ARRANQUE que va en cada encargo dice "Todo lo que produzcas queda
   ahi [en el Escritorio]", contra `escritorio-tareas.md` §1b y el bloqueo 4 de `escritorio-guard`.

Lo que NO encontre (superficie limpia para esos patrones): instrucciones de reproducir el
razonamiento (riesgo `reasoning_extraction` en Opus 5.5), supresores de narracion ("no narres",
"guarda todo para el final"), prefill/`tool_choice`/`budget_tokens` en texto, y presion en mayusculas
sin porque: en las reglas cambiadas la densidad es baja y casi toda mayuscula trae la cita de Fak al
lado. `dxf-entregable.md`, `patrones-corte.md`, `documentacion-oficial.md`, `lecciones-consolidacion.md`
y `control-plan.md` no cambiaron desde el 11/09 y no tienen patrones nuevos de Opus 5.5.

---

## (a) Inventario

| Archivo | Bytes | Cuando llega al modelo |
|---|---|---|
| `.claude/rules/amfe.md` | 37.958 | Al leer `modules/amfe/**`, `core/amfe/**`, `utils/seed/**`, `scripts/**/*mfe*.mjs`, `scripts/_lib/**` y 13 scripts mas |
| `.claude/rules/mail-envio.md` | 19.285 | `scripts/_mail*`, `**/*mail*.py`, `**/*outlook*`, `mail-guard*` |
| `.claude/rules/hojas-proceso.md` | 8.140 | skill `hojas-de-proceso`, `**/hoja*proceso*`, `**/hoja*operaciones*`, **cualquier `**/*.pptx`** |
| `.claude/rules/video-maquina.md` | 7.229 | `_videoBiblioteca.mjs`, `*telefono*`, `*.MOV`, `*.MP4` |
| `.claude/rules/coordinador.md` | 7.846 | `_encargo.mjs`, `coordinadorGuard*`, su canon, hook y test |
| `.claude/rules/escritorio-tareas.md` | 12.051 | `_escritorio.mjs`, `serverPaths.mjs`, `escritorio-guard.sh`, tests |
| `.claude/rules/arb-no-cerrar.md` | 5.360 | `scripts/_arb*.py`, `arb-cerrar-guard.sh`, skill `arb-operar` |
| `.claude/rules/cad-3d.md` | 28.301 | archivos 3D, `.venv-cad`, skill `cad-design` |
| `.claude/rules/documentacion-oficial.md` | 5.133 | `4- MANUALES`, `0-Documentacion cliente`, `1. Imput`, `normas-vw`, `.sgc-cache` |
| `.claude/rules/dxf-entregable.md` | 3.401 | `*.dxf`, `*.plt`, `_validarDxf*`, dos skills |
| `.claude/rules/patrones-corte.md` | 3.353 | `*.dxf`, `*.plt`, `*.hpgl`, skill `patrones-corte-plotter` |
| `.claude/rules/lecciones-consolidacion.md` | 3.431 | LECCIONES, sus snapshots, hooks de cierre |
| `.claude/rules/control-plan.md` | 4.500 | `modules/controlPlan/**` |
| `.claude/agents/auditor.md` | 9.014 | Subagente (`model: sonnet`, `memory: project`); se lanza al cerrar cada tarea de codigo y en el ARRANQUE de cada encargo |
| `.claude/agents/amfe-healer.md` | 7.885 | Subagente (`model: sonnet`, `memory: project`); lo lanza `/fix-amfe-gaps` |
| `.claude/agents/auditor-cliente.md` | 1.727 | Subagente (hereda modelo, `omitClaudeMd: true`); lo lanza `/auditoria-cliente` |
| `_dispatcher.sh` → `guardianes.mjs` (116.519 b, 20 guardianes) | — | **Cada** Bash/PowerShell/Write/Edit. Texto solo si un guardian dispara: 14 guardianes que pueden bloquear (exit 2, stderr) y 8 recordatorios 1x/h (additionalContext: consumos 923 c, CAD 2.391, patrones 1.714, escritorio 1.386, doc-oficial 1.139, HO 2.519, rule-gate, CE 1.447) |
| `pregunta-guard.sh` | 1.424 | **Cada** AskUserQuestion (additionalContext) |
| `caracteristicas-especiales-prompt.sh` + `caracteristicasEspeciales.data.json` | 19.398 | **Cada** mensaje de Fak que nombra el tema, sin cooldown (1.447 c) |
| `coordinador-guard.sh` → `coordinadorGuard.mjs` | 16.671 | Cada Agent/SendMessage/spawn_task/tarea agendada (texto solo si bloquea) |
| `plantillaArranque` en `coordinadorCanon.data.json` | 10.840 | Al final de cada encargo a otra sesion (`_encargo.mjs`) |
| Stop: `dev-server-guard.sh` + `cierre-guard.sh` → `cierreGuard.mjs` (40.613) + `cierreCanon.data.json` (14.786) | — | **Cada** fin de turno; texto solo si bloquea (6 chequeos) |
| `timeout-guard.sh` → `cierreCanon.timeout.mensaje` | — | PostToolUse Bash, solo si hubo timeout |
| `session-start-context.sh` | 2.929 | SessionStart: `compact` → nucleo de 7 puntos; `inicio` → `cerebro-guard.sh` (texto solo en PC nueva) |
| `mcp-write-gate.sh`, `supabase-write-flag.sh` | — | `execute_sql` / `apply_migration` |

No registrados en ningun settings (no llegan al modelo): `session-close-guard.sh` (reemplazado por
`cierreGuard`), y el `agentes-guard.sh` del repo (el registrado es el de `~/.claude/hooks`).

---

## (b) Tabla de hallazgos (por confianza)

| # | Ubicacion | Evidencia | Patron | Por que esta roto u obsoleto para Opus 5.5 / Fable 5.1 | Conf. | Accion |
|---|---|---|---|---|---|---|
| 1 | `scripts/_lib/guardianes.mjs:1599-1601` (bloqueo de `arb-cerrar-guard`) | "NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' o 'Maestro de Relaciones' con WM_CLOSE (...) y 'python scripts/_arbVer.py reset', que cierra y REABRE la de Relaciones." | Duplicado que discrepa (hook↔regla) | `arb-no-cerrar.md:39-40` (25/09): cerrar Relaciones abierta **crashea el arb**; `reset` solo sirve con Relaciones cerrada; `--forzar` con OK de Fak. El modelo lee el mensaje justo cuando busca una alternativa, y lo sigue literal | Alta | rewrite (hunk 1). Seguimiento de codigo, ver #44 |
| 2 | `.claude/hooks/pregunta-guard.sh:15` | "Si la pregunta arranca con '¿cual de estas...' o pide un OK para hacer mi trabajo, NO se pregunta: la respuesta es SI" | Duplicado que discrepa (hook↔regla always-on) | `autonomy-contract.md:3` "ante 2-3 caminos validos, AskUserQuestion"; `:10` escribir 1 documento: confirmar; `:50` §F la PRIMERA VEZ se pregunta; `:75` listado maestro: preguntar. El hook es del 04/09, §F del 21/09. Guia Fable 5.1 (long-horizon): "si el producto necesita paradas de confirmacion, agregar una frase que las liste" | Alta | rewrite (hunk 2) |
| 3 | `scripts/_lib/cierreGuard.mjs:719-722` (chequeo 1, hook Stop) | "Regla de la casa (CLAUDE.md): la respuesta es SI. Hacelo ahora y reporta el resultado con la ruta." | Duplicado que discrepa (hook↔regla) | Bloquea colas como "¿Lo corro con --apply?" (regex `lo corro` en `cierreCanon.permiso`); la unica excepcion cargada es la de mails. Un turno que pide el OK que el contrato exige recibe "Hacelo ahora" | Alta | rewrite (hunk 3) |
| 4 | `guardianes.mjs:1221` y `:1231` (recordatorio `HO-GUARD`) | "Sin documento fuente van TBD." · "Donde no hay dato va TBD y nada mas" | Duplicado que discrepa (hook↔regla) | `hojas-proceso.md:89-92` (Fak 24/09: *"no puede haber ni 1 TBD... en las descripciones"*; el TBD va solo en el cajetin) y `:55-58` (sin fuente el paso no va). Lo mismo dicen, desactualizados y fuera de mi alcance: `no-pfd-no-ho.md:37` (always-on) y el canon `docs/CRITERIOS_HOJAS_DE_PROCESO.md:321` | Alta | rewrite (hunk 4); avisar a la sesion que audita las reglas always-on |
| 5 | `guardianes.mjs:1237-1244` (recordatorio `HO-GUARD`, items 6-7) | "AL CERRAR: actualizar el listado maestro (...) El .xlsx del SGC lo edito YO con Excel COM" | Duplicado que discrepa (hook↔hook↔regla) | `autonomy-contract.md:75`: escribir en un listado maestro = **Preguntar**. El guardian `apqp-cliente` del mismo archivo (`APQP_LISTADO`, `:1619`) bloquea escribir `Listado hojas de proceso.xlsx` sin OK. Dos guardianes del mismo modulo dan ordenes opuestas. (`no-pfd-no-ho.md:40` "se actualiza en la misma tanda" tiene el mismo problema) | Alta | rewrite (hunk 5) |
| 6 | `coordinadorCanon.data.json:240` (`plantillaArranque.conCarpeta`) | "La tarea vive en el Escritorio: {carpeta}. Todo lo que produzcas queda ahí hasta que se archive" | Duplicado que discrepa (prompt↔regla↔hook) | `escritorio-tareas.md:91-94` (§1b): el entregable se escribe DIRECTO en su carpeta por tipo; el Escritorio guarda el rastro. `escritorio-guard` bloque 4 bloquea generar entregables adentro del Escritorio. Este texto va al final de CADA encargo a otra sesion | Alta | rewrite (hunk 6) |
| 7 | `amfe.md:244-252` contra `:271` y `:284-286`; validador `amfeValidator.mjs:410` y `:846-859` | Nota: "El 'D=7 humana en estacion' de abajo NO existe en la oficial: una inspeccion visual va en 8". Tabla: "7 \| Lo mismo en la propia estacion". Regla practica: "es D=7 (en estacion) u 8 (aguas abajo)" | Duplicado que discrepa dentro de la misma seccion + fosil | La misma regla le da dos numeros al modelo. Fak 23/09: *"vamos a usar la tabla oficial ni mas ni menos"*, y LECCIONES 23/09: lo que dice la norma publicada no se presenta como pendiente. El validador sigue con piso 7 | Alta | rewrite minimo (hunk 7); flag del validador y de la transcripcion completa de la P3 (pendiente en la memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017`) |
| 8 | `amfe.md:177` | "Correccion de un invento detectado: NO corregir solo — confirmar con Fak (opciones: placeholder / vaciar / Fak dicta)" | Duplicado que discrepa (misma regla); barrido incompleto | `amfe.md:167` (misma seccion, cambiada el 21/09): "Falta dato (cualquier AP) → Dejar vacio — el placeholder esta prohibido (§4)". El cambio del 21/09 se barrio en §4, §5, §6 y §14, no aca | Alta | rewrite (hunk 8) |
| 9 | `auditor.md:155-165` (puntos 3, 4 y 5 del protocolo AMFE) | "S=9-10 solo para: flamabilidad, VOC, airbag..." · "S=9-10 por seguridad del operador NO lleva CC (se gestiona con EPP)" · "CC/SC — NO auditar" · "`.claude/rules/amfe.md` §4 cubre el placeholder." | Duplicado que discrepa (agente↔regla always-on↔codigo) | `caracteristicas-especiales.md`: critica = S 9-10 sin excepcion; `CAUSE_S9_SIN_CC` (validador `:880`) no exime al operador; `CAUSE_CC_LOW_SEVERITY` / `CAUSE_SC_FUERA_DE_REGLA` / `SIGLA_DESCONOCIDA` son CRITICAL y frenan `--apply` y export (y la regla dice que el §2bis lo caza "el agente `auditor`"). §4 ya no "cubre el placeholder": lo prohibe | Alta | rewrite (hunk 9) |
| 10 | `amfe.md:336` (§15, A2) contra `modules/amfe/amfeValidation.ts:836-840` y `:404-440` | Regla: "A2 AP=H con el placeholder prohibido (§4) (...) Todas warning en draft, bloqueo en approved." Codigo: `getDocumentCompletionErrors` marca todo AP=H sin accion / responsable / fecha, "Per AIAG-VDA: all AP=H causes MUST have optimization actions" | Contrato regla↔codigo roto | La regla describe un check que la app no tiene; la app hace lo contrario de §4 (Fak 21/09: AP=H vacio es estado valido) y **bloquea aprobar** un AMFE asi | Alta | flag (el arreglo es de codigo: A2 tiene que mirar el placeholder, no la accion vacia) |
| 11 | `video-maquina.md:66` | "**Indexar el telefono** (...): `tel_indice.ps1` → `INDICE_TELEFONO.tsv`." | Dato volatil roto | `tel_indice.ps1` no existe: busque en el repo, `git ls-files`, `C:\Dev` hasta 4 niveles, `C:\Dev\_telefono` (esta el `.tsv`, no el script), `~/.claude` y el TEMP de Claude. Solo lo nombra un comentario de `_videoBiblioteca.mjs:68`. Es el paso 1 del procedimiento que el candado `video-maquina-guard` exige | Alta | rewrite (hunk 11) + recuperar el script |
| 12 | `cierreGuard.mjs:788` · `coordinadorCanon.data.json:238` · `coordinador.md:26` | "una tarea se cierra en cinco lineas" · "una síntesis de 12 líneas o menos" · gate real: 3.000 caracteres / 35 lineas / 1 tabla (`cierreCanon.cierre_largo`) | 1f topes numericos + duplicados que discrepan | Tres numeros para el mismo cierre. Ninguno es de Fak: su frase es *"podes sintetizar que recomendas"* (memoria `no_hacer_informes`; el "cinco" es mi redaccion). La propia medicion del canon (`_medicion_22_09`) dice que el largo no separa los cierres objetados. Opus 5.5 reporta mas claro (guia: "Communication and writing") | Media | rewrite sin numero (hunk 12); el gate 3000/35 queda como flag #42 |
| 13 | `auditor.md:112` contra `:22-27` y `plantillaArranque` | "DETECT-ONLY (...): NUNCA editar archivos ni datos." · "AL TERMINAR: (...) agregalo en 1-2 lineas" · ARRANQUE: "agente auditor con el informe a un ARCHIVO" | Contrato del agente contradictorio | El agente tiene Write/Edit por `memory: project` y su memoria se escribio el 24-25/09; la regla dura dice lo contrario. El modelo tiene que reconciliar | Media | rewrite (hunk 13) |
| 14 | `auditor.md:118-186` contra `.claude/commands/audit-amfe.md` | Seccion "Checks detallados AMFE" dentro del agente de cierre de codigo, y el comando `/audit-amfe` con su propio checklist | Grupo 4 (dos superficies para la misma tarea, que ya divergen) | Divergen en CC/SC (#9) y en la tabla AP. El auditor se lanza en cada cierre de codigo, donde esta seccion no aplica; "Cuando Fak pida 'auditoria'" no le llega a un subagente | Media | move (hunk 14) |
| 15 | `auditor.md:120-139` | "Los agentes lanzados en paralelo deben recibir el prompt con la lista EXPLICITA de checks" · "INCIDENTE 2026-04-09" · "INCIDENTE 2026-04-12" | 1d instruccion que nadie puede cumplir + Grupo 2 historia | El auditor no tiene la tool Agent: no lanza co-auditores. Los checks C-* sirven; el marco no | Media | rewrite (hunk 15; si se toma el 14, viaja con la seccion) |
| 16 | `amfe-healer.md:140` | "Mantener reporte <400 palabras." | 1f tope numerico | Tope escrito contra modelos que se extendian; la guia pide decir para quien es y que tiene que poder hacer | Media | rewrite (hunk 16) |
| 17 | `amfe-healer.md:147` | "NO commitear ni pushear — Fak hace git al cerrar sesion." | Dato falso | CLAUDE.md, fin de sesion: "commit/push/archivar los hago yo"; `techo-agentes.md`: "Fak no corre comandos" | Media | rewrite (hunk 17) |
| 18 | `amfe.md:102` | "Estuvo autorizado como default entre el 20/04 y el 21/09/2026, y el importador lo escribia solo: las dos cosas se sacaron." | 1d frase relativa | Diff contra una version que el modelo no ve; la regla vigente y la cita de Fak ya estan en la misma linea | Media | remove (hunk 18) |
| 19 | `amfe.md:222-223` | "(Hasta el 23/09 esta linea pedia citar el documento: es lo que Fak corrigio.)" · "Sobre el valor: La frecuencia de muestreo y los codigos de norma/procedimiento SI van." | 1d frase relativa + ambiguedad con el check | `CONTROL_CITA_RE` (`amfeValidator.mjs:228`) marca cualquier parentesis con `P-\d`, `HO`, `plano`...: "(P-10/I)" da WARNING aunque la linea siguiente diga que el codigo "SI va". Falta decir "sin parentesis" | Media | rewrite (hunk 19) |
| 20 | `mail-envio.md:112-115` | "Hasta el 12/09/2026 eso era solo texto (...) Desde hoy la voz se mide contra su propio corpus." | 1d fosil ("desde hoy" escrito el 12/09) | Frase relativa sin ancla | Media | rewrite (hunk 20) |
| 21 | `mail-envio.md:54-64` | "**21/09/2026:** el gate de voz me rebote el mail dos veces (...)" · "**Desde el 22/09/2026 `_prepararMail.py` no los apila.**" | 1d + Grupo 2 historia | La regla es el comportamiento del script; la historia ocupa el lugar | Media | rewrite (hunk 21) |
| 22 | `mail-envio.md:133` | "(recontado el 22/09/2026: sus viñetas son listas de codigos; el "0" de antes estaba mal)" | 1d frase relativa | "El 0 de antes" es un diff contra una tabla que no existe mas | Media | rewrite (hunk 22) |
| 23 | `mail-envio.md:172-208` | "### Aclarar de mas — la correccion que mas repite (medido el 22/09/2026)" + tabla de candidatos a ROJO + "El gate de antes dejaba pasar 7 de los 12" | Grupo 2 historia (calibracion del gate) | Es la bitacora de diseño de `ACLARA_DE_MAS`. Al redactar un mail al modelo le sirven 5 renglones: que frase frena y con que umbral. La memoria `mail_corto_como_los_de_fak` tiene el perfil medido pero NO esta tabla: hay que copiarla antes de cortar | Media | move (hunk 23) |
| 24 | `mail-envio.md:294-298` | "El 12/09/2026 `vozMail.py` calculaba mal su raiz (...) Lo encontro el auditor." | Grupo 2 historia | El caso ya vive completo en la memoria `reference_fail_open_esconde_su_propia_rotura` (lineas 18-26): es duplicado | Media | rewrite (hunk 24) |
| 25 | `hojas-proceso.md:89` | "**Y desde el 24/09/2026 tampoco va `TBD` en la descripcion**" | 1d frase relativa | "desde el" implica una regla anterior que el modelo no ve | Media | rewrite (hunk 25) |
| 26 | `hojas-proceso.md:61-64` (regla 13) | "Existe desde el 08/09/2026 y el skill no lo nombraba: por eso el 21/09 entregue 26 de 27 pasos..." | Grupo 2 historia | La regla es "se abre antes de escribir el primer paso"; la cronologia sobra | Media | rewrite (hunk 26) |
| 27 | `hojas-proceso.md:42-45, 55-58, 79-85` y seccion Enforcement `:106-115` | "Lo frena `_gate_texto_para_el_operario()`" · "Lo frenan `_gate_cada_paso_con_fuente()` y `_gate_transcripcion_leida()`" · "(`gate_materiales_del_deck()`)" | 1d enforcement que no cubre lo que dice | Esas funciones viven en `scripts/img/generar_hojas_img.py`. El generador P21 (HO-991) toma 3 (texto_para_el_operario, cada_paso_con_fuente, gate_redaccion) y NO `_gate_transcripcion_leida` ni `gate_materiales_del_deck`. El gate "Duro" que corre sobre cualquier deck (`hoja_proceso_check.py`) no corre ninguno: solo vocabulario y cocina | Media | rewrite del Enforcement (hunk 27) |
| 28 | `hojas-proceso.md:59` (regla 12) | "**El sector de esta maquina es `IMG`**, no 'MOLDEO IMG'" | Referencia sin ancla | La regla carga con cualquier `*.pptx` o hoja: "esta maquina" no dice cual | Media | rewrite (hunk 28) |
| 29 | `coordinador.md:63-70` | "**22/09/2026:** (...) 6 de los 9 bloqueos (...) Y G4 ya no frena la MENCION" | 1d frase relativa + Grupo 2 | El comportamiento vigente queda enterrado en la cronologia | Media | rewrite (hunk 29) |
| 30 | `auditor-cliente.md:21-24` | "Por que corres sin el CLAUDE.md del repo (`omitClaudeMd`, Claude Code 2.1.277): hasta el 22/09/2026 este auditor se lanzaba como agente general..." | Grupo 2 historia dicha al propio subagente | Al auditor no le cambia nada saberlo: la restriccion ya esta en `:17-19`. Verifique que `omitClaudeMd` existe en el binario 2.1.281 ("Run this agent without the user, project and local CLAUDE.md instruction files...") | Media | remove (hunk 30) |
| 31 | `video-maquina.md:119-126` | "## Lo que quedo abierto (21/09/2026)" — IMG_9527 sin archivar; "24 videos (...) no tienen fotogramas, y 51 no tienen audio sacado" | Grupo 2 estado que rota + duplicado que diverge | Es estado de proyecto en una regla que carga con cualquier `.MOV`. Ya vive en la memoria `project_videos_maquinas_hotmelt_moldeadora:42`, que dice **50** sin transcripcion (la regla, 51). Hoy sigue siendo cierto (IMG_9527 no esta en `MAQUINA HOTMELT`, 34 entradas) | Media | move (hunk 31) |
| 32 | `core/amfe/caracteristicasEspeciales.data.json → recordatorio` (lo inyectan `caracteristicas-especiales-prompt.sh` y el guard PreToolUse) | "Si el efecto dice 'seguridad' con S7, lo incoherente es el par texto/S." — y no dice nada del §2bis | Re-baseline: add (keep list 11) | La falla del 21/09 (S=9 en 11 modos de falla para sostener la sigla del cliente) ocurrio con modelos actuales y con la regla cargada. El recordatorio deja abierta la direccion, que es justo por donde fallo | Media | add (hunk 32) |
| 33 | `video-maquina.md:40-48` | "Las tres maquinas de la linea Top Roll..." seguido de "Es la biblioteca **compartida de SharePoint** (...) Ejemplos reales: ..." | Estructura | El parrafo nuevo quedo entre §"Adentro de una carpeta de MAQUINA" y la frase que describe la RUTA de §"La ruta" | Baja | flag: devolver `:45-48` bajo "La ruta" |
| 34 | `coordinador.md:76` · `hojas-proceso.md:112-113` | "31 casos, las dos direcciones" · "`hojalib_selftest.py` — 25 casos" | Dato volatil | `vitest list`: 45 casos en `coordinadorGuard.test.mjs`; `hojalib_selftest.py` corrido hoy: "31 casos, 0 fallan" | Baja | flag: sacar el numero o actualizarlo |
| 35 | `guardianes.mjs:729` (`ESC_ZONA` con `/i`) | El recordatorio del Escritorio me salto con un `git diff -- .claude/rules/escritorio-tareas.md` de solo lectura | Disparo de mas | "/escritorio-" matchea la zona sin distinguir mayusculas; tambien `escritorio-guard.sh` y `__tests__/scripts/escritorio*.test.mjs` | Baja | flag (matcher, no texto) |
| 36 | `dev-server-guard.sh:66-67` | "Si el cambio se ve en el navegador (ver <when_to_verify>), corre preview_start y segui <verification_workflow>." | Referencia a secciones del system prompt | En el system prompt de este subagente esas etiquetas no existen; no pude verificar el de la sesion principal (Claude Desktop) | Baja | flag: confirmar que la sesion principal las tiene |
| 37 | `auditor-cliente.md` (tools: Bash) + `guardianes.mjs:591-612` | El auditor externo corre Bash; cada Bash pasa por el dispatcher, y el guard de caracteristicas especiales dispara con `specialChar`, `D/TLD`, `CC/SC`, `I-AC-005` | Contaminacion del auditor independiente | `omitClaudeMd` no cubre hooks: un `grep specialChar dump.json` por Bash le inyecta el criterio de la casa. No lo vi pasar | Baja | flag: pedirle que busque en los dumps con Grep/Read |
| 38 | `auditor-cliente.md:26-28` | "`python scripts/_pdfPaginas.py "<pdf>" <paginas>` y despues Read sobre cada PNG" | 1d andamiaje visual | Read abre PDF por paginas y Opus 5.5 lee mejor lo escaneado; la guia pide re-probar el paso previo. Para planos densos se queda | Baja | flag: re-probar |
| 39 | Instrucciones de verificacion: `cierreGuard.mjs:773-780` (chequeo 4), `TEXTO_CONSUMOS` item 4 ("+ UN AGENTE INDEPENDIENTE ademas del script propio"), `TEXTO_CAD` item 5, `TEXTO_PATRONES` gate 3, ARRANQUE (auditor al cerrar), `amfe.md` §18 | "Abrilo antes de decir listo" · "Renderice y MIRE yo el resultado" · "Y MIRAR la imagen de comparacion, con un zoom por CADA punto movido" | Tension documentada (Opus 5: borrar; Fable 5.1: mantener) | Son decisiones de Fak con fallas demostradas (el auditor independiente con Opus 5.5 encontro el borrador 2017 el 22/09). Los mecanicos (chequeo 4) no son andamiaje | Baja | flag, sin cambios |
| 40 | Recordatorios 1x/h (8) + `caracteristicas-especiales-prompt.sh` | El recordatorio de CE (1.447 c) repite la regla always-on `caracteristicas-especiales.md`, que ya esta en el system prompt; sin cooldown | 1d reinsercion de instrucciones | Lo pidio Fak (11/09) y la falla del 21/09 paso con la regla cargada: se queda. El mecanismo (additionalContext del turno) ya es la forma que recomienda la guia | Baja | flag: medir con `.instrucciones-cargadas.log` cuantas veces dispara con la regla ya cargada |
| 41 | `cierreCanon.data.json:117-125` (`cierre_largo`: 3000 / 35 / 1) | "`_medicion_22_09`: (...) ningun corte separa: los umbrales NO se bajan" | 1f + re-test Opus 5 → 5.5 | El gate bloquea por largo y su propia medicion dice que el largo no explica las objeciones; los cierres de Opus 5.5 son otros | Baja | flag: re-medir sobre transcripts de Opus 5.5 y decidir si queda |
| 42 | `escritorio-tareas.md:169-174` | "ese día dos pedidos de Federico no aparecían, y medido sobre la Bandeja de 30 días, 32 de 33 hilos..." | Grupo 2 | La heuristica explica la salida del script (se queda); el caso no | Baja | flag |
| 43 | `mail-envio.md:268-271` | "**Lo que NO es la causa** (verificado el 15/09/2026, no supuesto): Windows Defender estaba activo..." | Grupo 2 diagnostico | No esta en ninguna memoria: si se mueve, primero se crea. "No se apaga, lo aprieta Fak" se queda (configuracion de seguridad) | Baja | flag |
| 44 | `guardianes.mjs:1573-1576` y `arb-cerrar-guard.test.sh:90-91` | `!/Maestro/i.test(cmd)` · `probar guard "WM_CLOSE a Maestro de Relaciones" (...) 0` | Enforcement que contradice la regla | Ademas del mensaje (#1), la logica y su test dejan pasar el WM_CLOSE a Relaciones; lo unico que frena es `reset_relaciones()` dentro de `_arbVer.py` | Baja (es codigo) | flag |
| 45 | Fosiles previos al 11/09 en archivos del alcance: `amfe.md:56`, `:336`, `:340`; `lecciones-consolidacion.md:15`; `escritorio-tareas.md:49` | "hasta el 11/09/2026 esta linea decia eso" · "desde el 11/09/2026 si frena" · "(desde el 04/09/2026)" · "**Ahora:** si se cumplen las TRES patas" | 1d | Mismo patron que #18-#29, fuera del diff | Baja | flag |
| 46 | `guardianes.mjs:553-563` (`TEXTO_CONSUMOS`) | Checklist de 5 puntos sin el §5 de `consumos-entregables.md` (25/09: cada numero con su papel, `respaldoCarga.py` frena el `--apply`) | Duplicado incompleto | No contradice; le falta lo nuevo | Baja | flag |
| 47 | `hojas-proceso.md:6` | `paths: - "**/*.pptx"` | Alcance de carga | Las 20 reglas de hoja entran en cualquier deck (informe de TryOut, Gate 3) | Baja | flag |

---

## (c) Hunks propuestos (alta y media)

Una fila por hunk, en el orden de la tabla. **Ninguno esta aplicado.** Los que tocan texto que un
test clava lo dicen.

### Hunk 1 — `scripts/_lib/guardianes.mjs:1599-1601`

Antes:
```
NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' o 'Maestro de
Relaciones' con WM_CLOSE (es el modo documentado de descartar una edicion sin grabar),
y 'python scripts/_arbVer.py reset', que cierra y REABRE la de Relaciones.`);
```
Despues:
```
NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' con WM_CLOSE (es el
modo documentado de descartar una edicion sin grabar) y 'python scripts/_arbVer.py reset'
con Relaciones CERRADA (solo la abre). 'Maestro de Relaciones' ABIERTA no se cierra: crashea
el arb (25/09/2026, regla arb-no-cerrar.md); 'reset --forzar' solo con OK de Fak.`);
```
Ningun test clava ese texto. La logica y el test que dejan pasar el WM_CLOSE a Relaciones: #44.

### Hunk 2 — `.claude/hooks/pregunta-guard.sh:15` (dentro del JSON; sin comillas dobles)

Antes:
```
Si la pregunta arranca con '¿cual de estas...' o pide un OK para hacer mi trabajo, NO se pregunta: la respuesta es SI, se hace y se reporta. Solo se pregunta lo que SOLO Fak puede contestar (una decision suya, un dato de planta que no esta escrito).
```
Despues:
```
Un OK para hacer mi propio trabajo no se pide: la respuesta es SI, se hace y se reporta. SI se pregunta, con la ruta y el archivo concretos, lo que el contrato de autonomia manda confirmar: escribir en Supabase, un listado maestro, emitir o dejar algo en el SGC o el legajo, lo que hago por PRIMERA VEZ, mandar un mail, cerrar el arb. Y lo que SOLO Fak puede contestar (una decision suya, un dato de planta que no esta escrito). Un '¿cual de estas...?' va solo si los caminos llevan a trabajo distinto y ningun documento decide; si no, elegi con la mejor practica y deci por que.
```
`hooksVarios.test.mjs:343-352` pide `PREGUNTA-GUARD` y `Lo que ya tengo`: siguen estando.

### Hunk 3 — `scripts/_lib/cierreGuard.mjs:721-722`

Antes:
```
        + 'Regla de la casa (CLAUDE.md): la respuesta es SI. Hacelo ahora y reporta el resultado con la ruta. '
        + 'Si de verdad falta un dato que SOLO Fak tiene, preguntalo con AskUserQuestion y un renglon "Lo que ya tengo:".',
```
Despues:
```
        + 'Regla de la casa (CLAUDE.md): para tu propio trabajo la respuesta es SI. Hacelo ahora y reporta el resultado con la ruta. '
        + 'Si lo que falta es un OK que el contrato de autonomia exige (escribir en Supabase, un listado maestro, emitir en el SGC '
        + 'o el legajo, la primera vez de algo, mandar un mail, cerrar el arb) o un dato que SOLO Fak tiene, pedilo con '
        + 'AskUserQuestion y un renglon "Lo que ya tengo:".',
```
Ningun test clava ese texto (`la respuesta es SI` solo aparece en un fixture de comandos).

### Hunk 4 — `scripts/_lib/guardianes.mjs:1221-1223` y `:1229-1231` (`TEXTO_HO`)

Antes:
```
3. Los PASOS de una HO son instruccion de planta. Sin documento fuente van TBD.
   PROHIBIDO redactarlos por analogia con otra pieza "parecida" o copiar los de
   otro producto: el proceso puede ser otro (core-prohibiciones §1).
```
Despues:
```
3. Los PASOS de una HO son instruccion de planta: cada uno sale de una fuente (video con
   minuto, documento, o quien lo dijo y cuando); sin fuente el paso no va. PROHIBIDO
   redactarlos por analogia con otra pieza "parecida" o copiar los de otro producto: el
   proceso puede ser otro (core-prohibiciones §1). En la DESCRIPCION no va ni un TBD
   (Fak, 24/09/2026): lo que no se sabe se escribe generico, sin inventar valores, y el
   hueco va a la lista de preguntas. El TBD queda solo en el cajetin (hojas-proceso.md 11 y 18).
```
Antes:
```
   validacion", sin "el Plan de Control dice X pero Y". Donde no hay dato va TBD y nada
   mas; el analisis va en el informe aparte. Estilo de la casa en el ciclo de control:
```
Despues:
```
   validacion", sin "el Plan de Control dice X pero Y": el analisis va en el informe
   aparte. Estilo de la casa en el ciclo de control:
```
Mismo cambio pendiente en `no-pfd-no-ho.md:37` (always-on, lo audita otra sesion) y en el canon
`docs/CRITERIOS_HOJAS_DE_PROCESO.md:321`.

### Hunk 5 — `scripts/_lib/guardianes.mjs:1237-1244` (`TEXTO_HO`, items 6-7)

Antes:
```
6. AL CERRAR: actualizar el listado maestro
   (3- LISTADO\\Listado hojas de proceso.xlsx) con la fila nueva en el bloque de
   su sector + la hoja oculta _CONTEXTO_CLAUDE con el proximo numero libre.
   El numero es de la HOJA, no del codigo, y no se pasa de 999 (Fak 25/09/2026): antes de
   dar uno y al cerrar, python scripts/_hoNumeros.py (sale 1 si hay un numero repetido).
7. El .xlsx del SGC lo edito YO con Excel COM (regla modificada por Fak el 19/08/2026:
   "automaticemos eso asi podes hacerlo vos"). Trampas COM en la memoria
   excel_com_argumentos_posicionales; verificar lock ~$ antes y releer despues de guardar.`;
```
Despues:
```
6. AL CERRAR: la fila nueva del listado maestro (3- LISTADO\\Listado hojas de proceso.xlsx,
   en el bloque de su sector, + la hoja oculta _CONTEXTO_CLAUDE con el proximo numero
   libre) se le muestra a Fak y se carga con su OK: es registro compartido
   (autonomy-contract.md §F).
   El numero es de la HOJA, no del codigo, y no se pasa de 999 (Fak 25/09/2026): antes de
   dar uno y al cerrar, python scripts/_hoNumeros.py (sale 1 si hay un numero repetido).
7. Con ese OK, el .xlsx lo edito YO con Excel COM (Fak, 19/08/2026: "automaticemos eso
   asi podes hacerlo vos"). Trampas COM en la memoria excel_com_argumentos_posicionales;
   verificar lock ~$ antes y releer despues de guardar.`;
```
Nota: `apqp-cliente-guard` frena la copia, el Write y el `_registrar* --apply`; una edicion por COM
desde un script no la ve. Por eso el hunk no promete que el guardian la frene.

### Hunk 6 — `scripts/_lib/coordinadorCanon.data.json:240`

Antes:
```
    "conCarpeta": "La tarea vive en el Escritorio: {carpeta}. Todo lo que produzcas queda ahí hasta que se archive; nada tuyo queda suelto en el Escritorio.",
```
Despues:
```
    "conCarpeta": "La tarea vive en el Escritorio: {carpeta}. Ahí va el rastro (el mail, capturas, borradores); el entregable se escribe directo en su carpeta por tipo de la biblioteca de Ingeniería, y nada tuyo queda suelto en el Escritorio.",
```
`encargo.test.mjs:44` clava solo "La tarea vive en el Escritorio: <carpeta>": no se rompe. La linea
pasa por los candados G3/G4: correr `encargo.test.mjs`.

### Hunk 7 — `.claude/rules/amfe.md:270-271` y `:284-286` (minimo: saca la contradiccion, no transcribe la P3)

Antes:
```
| **8** | Deteccion **aguas abajo** por medios **visuales, tactiles o audibles**. *"The method relies on a human"* |
| **7** | Lo mismo **en la propia estacion**. *"The method relies on a human"* |
```
Despues:
```
| **8** | *(borrador 2017)* Deteccion aguas abajo por medios visuales, tactiles o audibles. **Oficial (SETEC pag. 109-111): inspeccion humana con metodo no probado** |
| **7** | *(borrador 2017; para lo humano no existe en la oficial)* Lo mismo en la propia estacion. **Oficial: deteccion por maquina con metodo no probado** |
```
Antes:
```
2. **Recien si es al 100%:** mirar, tocar, escuchar, contar o revisar un papel es **D=7** (en
   estacion) u **8** (aguas abajo). Para bajar de 7 hace falta INSTRUMENTO; de 6, R&R
   confirmado; para 4 o menos, ademas verificacion de poka-yoke.
```
Despues:
```
2. **Recien si es al 100%:** mirar, tocar, escuchar, contar o revisar un papel es inspeccion
   HUMANA: **D=8** con el metodo no probado, 6 probado; por maquina, 7 y 5 (P3 oficial, SETEC
   pag. 109-111, nota de arriba). Debajo de eso, lo que diga la P3 oficial al transcribirla.
```
Los valores salen de la nota de la propia seccion y de la memoria
`project_tabla_ap_de_la_casa_es_el_borrador_2017` (leidos en el SETEC el 22-23/09); no abri el PDF.
Queda pendiente, y es codigo: `DETECTION_HUMANA_OPTIMISTA` (`amfeValidator.mjs:410` y `:859`, piso
7) y sus casos en `_verificarAprendizajeAmfe.mjs`.

### Hunk 8 — `.claude/rules/amfe.md:177`

Antes:
```
**Correccion de un invento detectado:** NO corregir solo — confirmar con Fak (opciones: placeholder / vaciar / Fak dicta). Sincronizar AMFE→CP→HO. Backup antes.
```
Despues:
```
**Correccion de un invento detectado:** NO corregir solo — confirmar con Fak (opciones: vaciar / dejar lo que se sabe con "TBD" en lo que falta, como en la tabla de arriba / Fak dicta). Sincronizar AMFE→CP→HO. Backup antes.
```
(Aparte, fuera del diff: el "→HO" choca con `no-pfd-no-ho.md`, que deja `ho_documents` de solo
lectura.)

### Hunk 9 — `.claude/agents/auditor.md:155-165`

Antes:
```
3. **Calibracion severidades** (ver rules/amfe.md)
   - S=9-10 solo para: flamabilidad, VOC, airbag, bordes filosos, seguridad usuario.
   - S=9-10 por seguridad del **operador** NO lleva CC (se gestiona con EPP).

4. **CC/SC — NO auditar** (Fak decide personalmente)
   - NO reportar CC% ni SC% como problema.
   - NO sugerir que items deberian tener CC/SC.

5. **Acciones de optimizacion — NO auditar**
   - NO reportar AP=H sin acciones como problema (Fak decide).
   - `.claude/rules/amfe.md` §4 cubre el placeholder.
```
Despues:
```
3. **Calibracion severidades**: la S sale del EFECTO por la Tabla P1 (rules/amfe.md §1 y §13).
   Reportar la S que el texto del efecto no sostiene, para arriba o para abajo — el §2bis de
   caracteristicas-especiales.md (S inflada para sostener una sigla) no tiene check automatico
   y lo tiene que ver este auditor.

4. **CC/SC — asignar es de Fak**
   - No sugerir que items deberian tener o perder una CC/SC, ni reportar CC% / SC%.
   - SI reportar lo que el validador marca CRITICAL, porque frena el --apply y el export:
     `CAUSE_CC_LOW_SEVERITY`, `CAUSE_SC_FUERA_DE_REGLA`, `SIGLA_DESCONOCIDA`.

5. **Acciones de optimizacion — NO auditar**
   - Un AP=H con la accion vacia es estado valido (rules/amfe.md §4): no se reporta.
   - SI se reporta el texto `Pendiente definicion equipo APQP` en cualquier campo: esta
     prohibido (`CAUSE_APH_PLACEHOLDER_PROHIBIDO`).
```
Si se toma el hunk 14, este texto va al comando `/audit-amfe` en vez de al agente.

### Hunk 12 — `cierreGuard.mjs:788`, `coordinadorCanon.data.json:238`, `coordinador.md:26`

Antes (`cierreGuard.mjs:788`):
```
      titulo: 'CIERRE-GUARD: el cierre es un informe, y una tarea se cierra en cinco lineas',
```
Despues:
```
      titulo: 'CIERRE-GUARD: el cierre es un informe; una tarea se cierra con lo que Fak necesita para decidir',
```
Antes (`coordinadorCanon.data.json:238`, final de la linea):
```
y a Fak una síntesis de 12 líneas o menos, con la RUTA del entregable en la primera."
```
Despues:
```
y a Fak una síntesis con lo que recomendás, el comando o la ruta y lo que le cambia una decisión, con la RUTA del entregable en la primera línea."
```
Antes (`coordinador.md:26`): `12 lineas con la ruta primero)` → Despues: `una sintesis con la ruta primero)`.
Tests: `encargo.test.mjs:49` clava "síntesis de 12 líneas o menos, con la RUTA del entregable en la
primera" (actualizar la regex); `cierreGuard.test.mjs:189` es solo un comentario. El comentario de
`_encargo.mjs:28` tambien dice "12 lineas".

### Hunk 13 — `.claude/agents/auditor.md:112` (y `:179`)

Antes:
```
- **DETECT-ONLY (decision Fak 2026-07-14):** NUNCA editar archivos ni datos. Solo leer y reportar. Las correcciones las decide y ejecuta la sesion principal con OK de Fak.
```
Despues:
```
- **DETECT-ONLY (decision Fak 2026-07-14):** no editas codigo, datos ni documentos: lees y reportas. Lo unico que escribis es tu `MEMORY.md` y, si el prompt te lo pide, el archivo del informe. Las correcciones las decide y ejecuta la sesion principal con OK de Fak.
```
Y `:179` "NO edites este archivo ni ningun otro" → "NO edites este archivo".

### Hunk 14 — `.claude/agents/auditor.md:118-186` → `.claude/commands/audit-amfe.md`

Mover la seccion "Checks detallados AMFE" entera al comando `/audit-amfe` (reconciliada con el hunk 9
y con la tabla AP: el comando todavia dice "the table's own source is under review", y la memoria
dice que la oficial se aplico el 23/09). En el agente queda:
```
## Datos AMFE/CP

Si el prompt te pide auditar DATOS de un AMFE o un CP, el protocolo es el del comando
`.claude/commands/audit-amfe.md` (una sola fuente): leelo entero antes de empezar.
```

### Hunk 15 — `.claude/agents/auditor.md:120-139` (si no se toma el 14)

Antes:
```
Cuando Fak pida "auditoria" o "auditar" de un AMFE/CP, ejecutar este protocolo. (PFD/HO no se hacen mas aca — regla `no-pfd-no-ho.md`; sus docs en Supabase son referencia historica y NO se auditan proactivamente.) Los agentes lanzados en paralelo deben recibir el prompt con la lista EXPLICITA de checks — asumir que el agente "ya sabe" es error recurrente.

### Reglas criticas para prompts de co-auditores

**INCIDENTE 2026-04-09:** agentes no detectaron `operationFunction` vacio en 17 OPs porque el prompt no listaba ese check. Regla: el prompt DEBE listar TODOS los checks explicitamente:
```
Despues:
```
Si el prompt te pide auditar datos de un AMFE/CP, este es el protocolo. Los PFD y HO de Supabase son referencia historica: no se auditan.

### Checks obligatorios (el reporte dice el resultado de cada uno)
```
Y `:139` ("**INCIDENTE 2026-04-12:** tres agentes contaron 0 causas...") → "C-AUTH y C-FIELD son
obligatorios: sin autenticar, RLS devuelve 0 filas; y el camino es `failures`, no `failureModes`."

### Hunk 16 — `.claude/agents/amfe-healer.md:140`

Antes: `Mantener reporte <400 palabras. Usar tabla cuando los items son >3.`
Despues: `El reporte lo lee Fak de un vistazo: lo aplicado, lo pendiente y lo que decide el. Tabla cuando los items son mas de 3.`

### Hunk 17 — `.claude/agents/amfe-healer.md:147`

Antes: `- NO commitear ni pushear — Fak hace git al cerrar sesion.`
Despues: `- NO commitear ni pushear: el git lo hace la sesion principal al cerrar.`

### Hunk 18 — `.claude/rules/amfe.md:102`

Quitar la oracion: `Estuvo autorizado como default entre el 20/04 y el 21/09/2026, y el importador lo escribia solo: las dos cosas se sacaron.`

### Hunk 19 — `.claude/rules/amfe.md:222-223`

Quitar al final de `:222`: `(Hasta el 23/09 esta linea pedia citar el documento: es lo que Fak corrigio.)`
Antes (inicio de `:223`):
```
- Sobre el valor: La frecuencia de muestreo y los codigos de norma/procedimiento SI van.
```
Despues:
```
- Sobre el valor: la frecuencia de muestreo y el codigo de norma o procedimiento SI van, como parte del control y sin parentesis (`Verificacion segun P-14`, `Autocontrol segun P-09/I`); entre parentesis cuentan como cita (`CONTROL_CON_CITA`).
```

### Hunk 20 — `.claude/rules/mail-envio.md:112-115`

Antes:
```
Hasta el 12/09/2026 eso era **solo texto**: una regla escrita, sin nadie que la mida. Y el error
volvio igual — el plural de apertura **salio enviado** dos veces (01/09 a Carlos y Leo,
*"Actualizamos en INCA..."*; 07/09 a Pablo, *"Corregimos en el arb..."*). Es el rule enforcement
gap del skill `rule-enforcement-gate`. Desde hoy la voz se mide contra su propio corpus.
```
Despues:
```
Escrita sola, la regla no alcanzo: el plural de apertura salio enviado dos veces (01/09 y 07/09).
Por eso la voz se mide contra su propio corpus, con el gate de abajo.
```

### Hunk 21 — `.claude/rules/mail-envio.md:54-64`

Antes: desde `**21/09/2026:** el gate de voz me rebote...` hasta `...Selftest: \`python scripts/_prepararMail.py --selftest\`.`
Despues:
```
`_prepararMail.py` no apila borradores: anota cada uno que arma en
`.mail-cache/borradores_claude.json` y, al rehacer uno con el mismo asunto (sin contar RE:/RV:),
manda el anterior a Elementos eliminados — **solo si lo armo el script, sigue en Borradores y
nadie lo edito despues** (margen de 2 min). Con varios borradores del mismo asunto
`_mailEnviar.py --buscar` aborta y no deja mandar ninguno. Fak lo pidio tres veces (31/08, 07/09
y 21/09: *"borra vos los dos borradores duplicados y todos los que esten viejos tambien"*).
`Delete()` de COM mueve, no borra definitivo. Selftest: `python scripts/_prepararMail.py --selftest`.
```

### Hunk 22 — `.claude/rules/mail-envio.md:133`

Antes: `(recontado el 22/09/2026: sus viñetas son listas de codigos; el "0" de antes estaba mal)`
Despues: `(sus viñetas son listas de codigos)`

### Hunk 23 — `.claude/rules/mail-envio.md:172-208` → memoria `feedback_mail_corto_como_los_de_fak`

Primero copiar a la memoria la tabla de candidatos y los numeros (hoy no estan ahi). En la regla queda:
```
### Aclarar de mas — la correccion que mas repite

Lo que separa mis borradores rechazados de los mails de Fak no es el largo sino la **frase que
aclara**: describe el adjunto (*"Tiene cuatro hojas"*), respalda lo que dice (*"Lo confirma el
INCA..."*) o aclara lo que NO cambio (*"sigue en m2"*, *"el consumo no cambia"*). `ACLARA_DE_MAS`
da ROJO con 2 aclaraciones, o 1 en un mail mas largo que su p90; una sola en un mail corto avisa.
El gate se calibra en las dos direcciones (`__tests__/scripts/vozGate.test.mjs`): los borradores
rechazados (`fixtures/vozRechazados.json`) dan rojo, y el falso rojo contra los 935 mails de Fak no
puede pasar del 1 % por ROJO (lo frena el selftest). Si sube, el gate no se cablea. La medicion de
cada candidato: memoria `mail_corto_como_los_de_fak`. En un worktree el cache se apunta con
`VOZ_MAILS_JSONL`.
```

### Hunk 24 — `.claude/rules/mail-envio.md:294-298`

Antes: desde `- **El fail-open necesita su propio caso...` hasta `...Lo encontro el auditor.`
Despues:
```
- **El fail-open necesita su propio caso: `python scripts/_lib/vozMail.py --selftest`** (rojo y
  verde por la cadena real, clavado en el test 26). Un chequeo que falla abierto deja de correr sin
  que ningun test del gate lo note (caso del 12/09: memoria `reference_fail_open_esconde_su_propia_rotura`).
```

### Hunk 25 — `.claude/rules/hojas-proceso.md:89`

Antes: `**Y desde el 24/09/2026 tampoco va \`TBD\` en la descripcion**: Fak, *"no puede haber ni 1`
Despues: `**Tampoco va \`TBD\` en la descripcion** (Fak, 24/09/2026: *"no puede haber ni 1`
(cerrar el parentesis despues de la cita, en `:90`).

### Hunk 26 — `.claude/rules/hojas-proceso.md:61-64`

Antes:
```
13. **El canon de estas hojas es `docs/CRITERIOS_HOJAS_DE_PROCESO.md`** y se abre ANTES de
    escribir el primer paso. Existe desde el 08/09/2026 y el skill no lo nombraba: por eso
    el 21/09 entregue 26 de 27 pasos escritos como narracion y una hoja que decia "SETA",
    las dos cosas que el canon ya prohibia (3.2 y 4.4). Un canon huerfano no gobierna nada.
```
Despues:
```
13. **El canon de estas hojas es `docs/CRITERIOS_HOJAS_DE_PROCESO.md`** y se abre ANTES de
    escribir el primer paso: sin abrirlo sali con pasos narrados y una "SETA", dos cosas que
    ya prohibia (3.2 y 4.4).
```

### Hunk 27 — `.claude/rules/hojas-proceso.md`, seccion Enforcement (agregar despues de `:109`)

```
- **Los gates de redaccion viven en los generadores, no en el check duro.**
  `scripts/img/generar_hojas_img.py` tiene `_gate_texto_para_el_operario`, `_gate_cada_paso_con_fuente`,
  `_gate_transcripcion_leida`, `gate_materiales_del_deck`, `_gate_corregido_por_fak` y llama a
  `gate_redaccion` (TBD y denominacion). `scripts/p21/generar_hojas_p21.py` toma los dos primeros y
  `gate_redaccion`, no la transcripcion ni los materiales. `hoja_proceso_check.py` mide la hoja impresa
  y corre solo vocabulario y cocina. Un generador nuevo importa esos gates; si no, los criterios 8, 11,
  17, 18 y 20 se revisan a mano.
```
Y en `:45`, `:58`, `:85`, `:92`, `:104` cambiar "Lo frena X" por "En el generador de la IMG lo frena X".

### Hunk 28 — `.claude/rules/hojas-proceso.md:59`

Antes: `12. **El sector de esta maquina es \`IMG\`**, no "MOLDEO IMG": ese sector no existe.`
Despues: `12. **El sector de la moldeadora IMG es \`IMG\`**, no "MOLDEO IMG": ese sector no existe.`

### Hunk 29 — `.claude/rules/coordinador.md:63-70`

Antes: el bullet que empieza `- **22/09/2026:** un \`SendMessage\` a un **subagente...` y termina `...es una mencion.`
Despues:
```
- Un `SendMessage` a un **subagente que lanzo esta misma sesion** (su `name` o su agentId, leidos
  del `transcript_path` del hook) no va a otra sesion: pasa con los checks de un `Agent` (G3 y G4).
  Lo que va a otra sesion (`uds:`, un nombre que la sesion no lanzo, el `send_message` del MCP)
  exige el encargo. G4 frena la ORDEN, no la mencion: una negacion la gobierna en su oracion, y en
  un prompt que se declara de SOLO LECTURA un flag o comando citado (`--apply`, `git push`) sin
  verbo de ejecutar al lado es una mencion.
```

### Hunk 30 — `.claude/agents/auditor-cliente.md:21-24`

Quitar el parrafo `Por que corres sin el CLAUDE.md del repo (...) ya venian cargadas.` Si se quiere
conservar el porque, va en una linea de `.claude/commands/auditoria-cliente.md`, que es donde lo lee
quien lanza al agente.

### Hunk 31 — `.claude/rules/video-maquina.md:119-126` → memoria `project_videos_maquinas_hotmelt_moldeadora`

Quitar la seccion "## Lo que quedo abierto (21/09/2026)". En la memoria (`:42`) corregir 50/51 contra
el disco antes, y dejar en la regla, si hace falta, una linea: `Pendientes de la biblioteca: memoria
project_videos_maquinas_hotmelt_moldeadora.`

### Hunk 32 — `core/amfe/caracteristicasEspeciales.data.json → recordatorio` (agregar despues de la linea "La sigla se justifica SOLO con S y O...")

```
"Y al reves tampoco: la S sale del EFECTO por la Tabla P1, nunca de la sigla. Si el cliente designo una critica y la S por efecto no llega a 9, se informa como diferencia; no se sube la S (caracteristicas-especiales.md §2bis).",
```
`hooksVarios.test.mjs` solo mide exit y `hookEventName` de ese hook: agregar la linea no lo rompe.

### Hunk 11 — `.claude/rules/video-maquina.md:66-67`

Antes:
```
1. **Indexar el telefono** (barato, no copia nada): `tel_indice.ps1` → `INDICE_TELEFONO.tsv`.
   La carpeta `_b` del iPhone duplica la `_a`: se descarta.
```
Despues:
```
1. **Indexar el telefono** (barato, no copia nada) → `INDICE_TELEFONO.tsv` (carpeta, archivo,
   creado, bytes; con BOM: es lo que lee `--cruzar`). El script que lo generaba, `tel_indice.ps1`,
   no esta en el repo ni en `C:\Dev\_telefono`: TBD, rehacerlo en `scripts/video/` antes de la
   proxima bajada. La carpeta `_b` del iPhone duplica la `_a`: se descarta.
```

---

## (d) Verificado contra el disco (26/09/2026)

**Memorias citadas: 27 de 27 existen** (con prefijo): `ap_alto_sin_accion_no_se_toca`,
`cuando_sube_la_revision_de_un_amfe`, `project_tabla_ap_de_la_casa_es_el_borrador_2017`,
`sin_ingles_random_en_entregables`, `apoyacabezas_funda_es_bolsa`, `apoyacabezas_varilla_epp_proceso_real`,
`muestreo_no_es_control_al_100`, `dejar_el_mail_listo_para_enviar`, `mail_corto_como_los_de_fak`,
`un_control_se_audita_en_las_dos_direcciones`, `mail_ya_enviado_verificar_justo_antes`,
`material_de_fak_no_se_borra_va_a_la_nube`, `videos_y_fotos_de_maquina_donde_van`,
`coordinador_auditoria_independiente_2026-09-02`, `heuristicas_lista_canonica_no_regex_parcial`,
`no_cerrar_arb_sin_consultar`, `arb_cerrar_guard_los_8_bypasses`, `gh_cli_sin_login_ci_por_api`,
`excel_com_argumentos_posicionales`, `bash_tool_colapsa_barras_invertidas`, `supabase_no_rotar_decidido`,
`no_inventar_causas_de_errores_ajenos`, `no_hacer_informes`, `cad_gates_casos_fuente_2026-08`,
`verificar_contra_la_fuente_no_el_codigo`, `caracteristicas_especiales_notacion_barack`,
`project_hojas_proceso_img`.

**Archivos y scripts: 57 revisados, 56 existen.** Falta solo `tel_indice.ps1` (#11). Existen, entre
otros: `_crearAmfe172Ductos.mjs`, `_verificarAprendizajeAmfe.mjs`, `controlConValor.test.mjs`,
`ordenProceso.test.mjs`, `_mailEnviar.py`, `_prepararMail.py`, `_vozFak.mjs`, `vozFak.data.json`,
`vozMail.py`, `outlookUi.py` (`asegurar_outlook`, `vigilando`), `vozRechazados.json`, `vozGate.test.mjs`,
`mail-guard.test.sh`, `hoja_proceso_check.py`, `hojalib.py`, `hojalib_selftest.py`, `redaccion.py`
(`revisar_tbd`, `revisar_denominacion`), `redaccion_selftest.py`, `vocabulario.data.json`,
`fotodevideo.py`, `medir_marca.py`, `rotular.py` (`chequear_marcas`), `CRITERIOS_HOJAS_DE_PROCESO.md`,
`_xlsxAPdf.py`, `_gateRepoPublico.mjs`, `_videoBiblioteca.mjs` (`--cruzar`, `--auditar`, `NO_SE_PROCESA`),
`video/_infoDeVideos.py` (`todo`), sus dos tests, `_encargo.mjs`, `_tablero.mjs` (`--check`,
`--solo-encargos`), `encargo.test.mjs`, `coordinadorGuard.test.mjs`, `mailCache.mjs`
(`PALABRAS_GENERICAS`), `_escritorio.mjs` (los 8 flags), `_leerMsg.mjs --dir`, `_arbVer.py`
(`reset_relaciones`, `reset --forzar`), `arb-cerrar-guard.test.sh`,
`cad-design/reference/utillajes-de-apriete.md`, `indice_dispositivos.py`, `gate_proceso.py`,
`gate_entregable.py`, `export_deliverables.py`, `foto3d.py`, `patronlib.py` (`gate_aplomo`,
`a_marco_pieza`, `punta_fina`, `tabla_4_combinaciones`, `entregar`), `patronlib_selftest.py`,
`_validarDxf.py` (`--normalizar`, `--entregar`, `entregar_dxf`, `EntregaRechazada`),
`_validarDxfSelftest.py`, `_pdfPaginas.py`, `_auditAmfeIntegrity.mjs`, `_readiness.mjs`,
`_restore.mjs --list`, `_backup.mjs`, `_fixAmfePlaceholdersAndAllocation.mjs` (renombra a "TBD",
`--filter`, `--allow-new-critical`), `_auditWePlaceholdersAndAllocation.mjs` (`--json`, escribe
`tmp/we_placeholders_audit.json`), `countAmfeStats` / `extraFields` en `amfeIo.mjs`,
`commands/fix-amfe-gaps.md`, `_hoNumeros.py`, `AppRouter.tsx`, `components/layout/AppSidebar.tsx`,
`respaldoCarga.py`, `supabase-guard.sh` (corre `_backup.mjs`).

**Flags de scripts:** `_mailEnviar.py` tiene `--buscar --enviar --forzar --id --selftest
--sin-chequeo-voz` (los 6 que cita la regla); `_prepararMail.py --selftest`; `_vozFak.mjs --revisar
--medir --selftest --diff`; `vozMail.py --selftest`; `VOZ_MAILS_JSONL` existe.

**Checks del validador (23):** existen `CAUSE_APH_PLACEHOLDER_PROHIBIDO`, `HEADER_REVISION_NUMERICA`,
`REVISION_SIN_ITEM`, `REVISION_VAGA`, `CONTROL_CON_CITA`, `CONTROL_CON_VALOR`,
`DETECTION_HUMANA_OPTIMISTA`, `DETECCION_MUESTREO_OPTIMISTA`, `DETECCION_SIN_CONTROL_DECLARADO`,
`esMuestreoParcial`, `CAUSE_S9_SIN_CC`, `PU_ANTES_DE_ENFUNDADO`, `CAUSE_AP_MISMATCH`,
`CAUSE_CAPACITACION`, `CUTTING_EFFECT_REWORK_SUSPECT`, `CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED`,
`CAUSE_CC_LOW_SEVERITY`, `CAUSE_SC_FUERA_DE_REGLA`, `SIGLA_DESCONOCIDA`, `FIELD_ALIAS_DESYNC`,
`FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE`; `ENGLISH_RANDOM_TERMS` vive en `forbiddenContent.mjs` +
`core/amfe/forbiddenContent.data.json` (como dice la regla); `CAUSE_APH_EMPTY_NO_PLACEHOLDER` solo
queda en comentarios. `consolidateRevisions` y `scanRevisionMeta` existen.

**Conteos:** `vozGate.test.mjs` 50 (ok) · `ordenProceso.test.mjs` 9 (ok) · `redaccion_selftest.py` 71
(ok, corrido) · `coordinadorGuard.test.mjs` 45 (la regla dice 31) · `hojalib_selftest.py` 31 (la
regla dice 25) · limites de LECCIONES 600 c / 2 lineas / 26.624 / 28.672 (ok contra `cierreCanon`).

**Otros:** `omitClaudeMd` existe en Claude Code 2.1.281 (grep del binario) · las tres carpetas de
maquina de Top Roll existen y `IMG_9527` no esta en `MAQUINA HOTMELT` · `npx tsc --noEmit` dio 0
lineas `error TS` (corrida con tope de 280 s; la afirmacion del auditor sigue en pie) · el guardian
del Escritorio disparo en vivo con un comando de solo lectura (#35).
