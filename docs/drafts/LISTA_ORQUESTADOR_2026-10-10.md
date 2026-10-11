# Lista del orquestador — 10/10/2026 11:00 → 12/10/2026 11:00 (48 h, pedido de Fak a las 02:10)

Pedido textual: *"te dejo modo full auto 48 hs seguidas, lo que tarde en completar todo"*. Prompt: `docs/drafts/PROMPT_ORQUESTADOR_2026-10-10_v5.md`.
Reglas de la tanda: las 21 de la v3 §2, más la del 10/10 ~11:10 (*"todo lo que digo son sugerencias sin evidencia... si creés que hay una mejor forma, decímelo: mirá, creo que lo que querés es esto"*). Nada que necesite un clic de Fak mientras no está; pasado el 85 % del cupo de 5 h no se lanzan hijas ni agentes; el cupo se mira cada hora; cada hora un renglón en el chat.

## Lo pedido, en orden

1. [~] **Los carteles (HOY-8 + HOY-7)**: hecho el cambio (encargo `--lanzada`, settings sin plan, `_hijaEstado.mjs`, skill `lanzar-sesion-hija`, memoria, regla, CLAUDE.md), tests en verde (66), hija real lanzada a las 11:26 (`local_e4632689`). Falta: auditor Opus (corriendo), aplicar hallazgos, commit con rutas, CI, tachar en la cola.
2. [ ] **La cola** (`docs/COLA_CAMBIOS_CODIGO.md`) por su orden de trabajo, con hijas que lanzo (una o dos a la vez), cada una con encargo por `_encargo.mjs --lanzada`.
3. [ ] Vigilar el contexto de cada hija (`get_usage`); al 85 % cierre prolijo y la siguiente.
4. [ ] Cada fase se tacha solo con `git log` + CI + `_cierreSesion.mjs --sin-build`.
5. [ ] Modelos: hijas en Opus 5.5 para medianos; Fable 5.1 para grandes (P6, P9+P10, P33, P55, P56).
6. [ ] Lo que necesita a Fak va a la sección de abajo.
7. [ ] Cada hora un renglón en el chat. Al final, una página en `exports/explicaciones/`.

## Hijas (estado)

| Sesión | Encargo | Modelo / modo | Qué hace | Estado |
|---|---|---|---|---|
| `local_8e259e7a` (madrugada) | E261010-72c7 (H14 `b2f56ae1`, P26 `7e1caa35`) → E261010-f52a (paso 11, H20+H21, `14adcfc9`, 13:07) → E261010-03ba (paso 12, H23+H24, `69ee710a`, 13:38) → E261010-e2eb (paso 13, H25-H27, `aa64eaf7`, 14:05) → E261010-9f13 (paso 14, H30+H31, `f89bd397`, 14:37) | Opus 5.5 / bypass | **terminó: contexto 82 % a las 14:40, no recibe más pasos** | 4 pasos de la cola en un día (11 a 14), cada uno con auditor Opus |
| `local_e4632689` (hija 1) | E261010-8c59 | Opus 5.5 desde el 2.º turno / bypass heredado | paso 11: H20+H21 novedades | lanzada 11:26, abortada 11:28 (arrancó en default) |

Próximas (de a una o dos, sin pisar archivos): paso 12 H23+H24 (skills) · 13 H25-H27 (consumos) · 14 H30+H31 · 15 H5+H6 · después H17, H19, H22, H28… · grandes en Fable: P6, P9+P10, P33, P55, P56 (con su sí ya dado el 09/10 16:55; el plan en `docs/` igual se le muestra).

- 11:44 · prueba por reloj (`prueba-modo-reloj-20261010`, sesión `local_3225f44a`): sin `defaultMode` en el settings, la corrida disparada por el reloj arranca en **default** (y tomó el modelo Fable del selector). Confirma: el modo sale de la tarea o del settings; sin ninguno, `default`.
- 11:45 · la hija de la madrugada subió H14 (`b2f56ae1`, CI verde); P26 (`_imprimir.py` + test) sigue sin commitear.
- 11:48 · auditor Opus del cambio: 3 errores reales (el modo no se hereda; el control juzgaba con el modo del primer mensaje y mandaba frenar un vitest largo de la madrugada; «0 llamadas» a start_session era falso: busqué `ccd_session_mgmt__start_session` y el nombre real es `ccd_session__start_session`, hubo 6 el 08/10) y 8 de robustez. Aplicados; tests 25/25.
- 11:52 · fijado el momento: `start_session` estaba en las herramientas de todas las sesiones hasta la del 09/10 17:21 y falta desde la primera posterior a la actualización de la app 2.31226.1 (instalada 17:04-17:05; primera sin ella 17:26). El bundle viejo (2.31226.0) también la tenía: es el interruptor remoto, no el código.
- 11:56 · commit `2d8f8d53` (12 archivos, solo mi alcance + la cola) y push. Cola: HOY-7 cerrado, HOY-8 hecho en parte, P84 (la decisión de Fak), HOY-16 (falso positivo del guardián de firma; era HOY-14 y la hija usó ese número para «X contesta 404»).
- 11:58-12:08 · con las hijas frenadas por el modo (P84), trabajo de orquestador: plan P55 (`docs/PLAN_P55_AMFE_EN_LA_NUBE_2026-10-10.md`, commit `733890a2`) y nota P6 (`docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`; el servidor no se ve desde esta red: `server` no resuelve, IP 192.168.1.40 de otra red).
- 12:15 · plan P9+P10 (`docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md`): cierre incremental con estado por sesión y test de igualdad contra la pasada completa; un node por mensaje y uno por cierre; despliegue en un commit con vuelta atrás. Listo para una hija Fable cuando P84 se resuelva.
- 12:20 · el auditor Opus de la hija de la madrugada quedó colgado desde las 11:54 en un Bash (sin python vivo en la PC): le mandé un aviso (pase `.encargo-libre`, «delivered», su turno arrancó) para que lo frene con TaskStop y cierre P26 con lo que tenga o con un auditor acotado (120 s por comando).
- 14:40-18:40 · **error mío**: me quedé esperando la respuesta de Fak a P84 sin avanzar lo que no dependía de ella (la etapa 1 de P55). Fak 18:40: *"¿te quedaste esperándome? es gravísimo"*. Lección anotada en LECCIONES (bullet 09-10/10 del «no puedo»).
- 18:40 · Fak: *"pensá la mejor manera"* → decidí (a): `permissions.defaultMode: bypassPermissions` en su settings general (respaldo `settings.json.antes-bypass-20261010-1840`).
- 18:45 · hija 2 (`local_218252c2`, paso 15 H5+H6) **arrancó en bypass sin cartel**: el camino sin clic queda probado de punta a punta.
- 18:47 · hija 3 (`hija-amfe-nube-etapa1-20261010`, P55 etapa 1: Supabase → nube + escritura doble; la vuelta nube → Supabase queda apagada hasta su sí).
- 18:48 · las hijas 2 y 3 arrancaron su primer turno en Fable (el selector de la app quedó en Fable por mi sesión) y una hija hace todo en un turno: las frené (sin cartel) y les reenvié el mismo encargo por mensaje → el turno nuevo sale en Opus. Anotado en la skill.
- 18:50 · Fak: *"usás principalmente los créditos de la API para todo esto"* (regla 17 de la v3; hoy no la había usado: error). Primer uso: revisión del plan P55 por la API (Opus, US$0,30, 88 s): 9 huecos reales (la base del sync no puede ser el manifest, lápidas, hash de los dos lados, copias de conflicto de OneDrive…) y las 3 pruebas obligatorias → sección 7 del plan y aviso a la hija 3 (frenada y relanzada para que lo lea antes de escribir código).
- 18:55 · Fak: *"te pongo reglas y te las olvidás... ¿cómo te vas a asegurar?"* → HOY-17 en la cola: cada regla de la tanda con control ejecutable (API, no esperar a Fak, modelo de las hijas, chequeo de la hora). Es la próxima hija.
- 18:58 · Fak contestó P55: no usa la app (la etapa 3 se cae); "todos" = el Excel editable de cada AMFE siempre en la carpeta de Ingeniería del server (etapa 1b, necesita el server); AMFE y plan de control tienen que tener los mismos controles (gate 8 de P6).
- 19:30 · hija 2 cerró el paso 15 (H5+H6, `82edf1c1`): **los 15 pasos del orden de trabajo están hechos** (9 a 15 hoy, 1 a 8 anoche). Dejó HOY-21 (el test de idioma que corre el detector real). Hija 3 sigue con P55 etapa 1.
- 19:05 · Fak pegó tres investigaciones nuevas → HOY-18 (GitHub, segunda pasada), HOY-19 (funciones nuevas en las skills, Outlook), HOY-20 (CATIA por código: instalada en esta PC y con automatización COM, medido). Y preguntó en qué fase va lo de investigar: en la 2 (ya pasó una vez el 08/10).
- 20:16 · hija 3 cerró **P55 etapa 1** (`979fdcf8`: la copia de Supabase en la nube se mantiene sola; auditor: 295 tests, 3 errores reales corregidos; informe `.sgc-cache/sesion-2026-10-10/P55_etapa1_auditor.md`). Encargo E261010-73da cerrado. Recibe **HOY-20** (CATIA por código, encargo E261010-36a1), contexto 49 %.
- 20:30 · renglón de la hora. Cupo 5 h: 7 % (reinicia 00:39), semanal 31 %, Fable 45 %. CI verde en 19581cd2, 979fdcf8 y 0a49d7f6. Hija 2 (HOY-17, contexto 49 %): código y tests escritos, espera su auditor Opus desde las 20:03. Hija 3 (HOY-20, contexto 54 %): CATIA V5 R21 arrancó por COM sin ventana (54 s), la pieza de prueba dio el volumen esperado; sigue con sondas y análisis. Nada colgado. API: 1 pedido mío en 2 h; ledger de la PC US$1,85.
- 20:35 · **medido: una corrida disparada por el RELOJ arranca en bypass** con el `defaultMode` del settings general (re-armé `prueba-modo-reloj-20261010` con fireAt 20:35; sesión `local_3320e192`: primer mensaje en `bypassPermissions`, modelo Fable del selector). Importa porque `seguimiento-reunion-amfe` dispara por reloj el lunes 12/10 08:43: ya no va a pedir carteles. Queda anotarlo en la skill `lanzar-sesion-hija` cuando la hija 2 la commitee (la está editando).
- 20:35 · **hija 4** lanzada (`hija-skills-funciones-nuevas-20261010`, sesión `local_34ba1fc9`, encargo E261010-dd4e, HOY-19: funciones nuevas en las skills, Outlook por COM en seco, pedidos reales de Fak clasificados por la API). Arrancó en bypass; frenada y reenviada → Opus desde el segundo turno, medido. RAM libre antes de lanzarla: 5,6 GB.
- 20:38 · revisión del plan P6 (planes de control) por la API (Opus, US$0,33, 149 s): 11 huecos (gate 3 asignaba siglas por operación: la sigla es de la característica y sale del AMFE que asigna Fak; falta gate 0 AMFE↔flujograma; gate 4 no veía texto inventado ni conflictos entre papeles; 5 errores del 06/10 sin gate; mapeo material→familia inexistente; P-10 no cubre proceso) + diseño del gate 8 (vínculo por id → instrumento+frecuencia → texto; cinco estados; quién manda) + modelo de datos (JSON intermedio, no Supabase) + 3 etapas con respuesta conocida (APB) + 3 pruebas. Va a la sección 7 del plan.
- 20:42 · revisión del plan P9+P10 (cierre incremental) por la API (Opus, US$0,3): el plan decía «cientos de MB» y un registro mide 3-8 MB; sin tiempos por fase del Stop no se sabe si P9 ataca el 90 % o el 10 % del costo → el orden pasa a C0 (medición, 5 días) → H6 (semántica principal/subagentes en la pasada completa, commit aparte) → C1 estado → C2 sombra (~200 Stops reales, 0 diferencias) → C3 decide. 7 huecos reales (estado incompleto que dejaba ciego el chequeo 9, identidad de las miradas, offset en caracteres y línea a medio escribir, versión manual, reescritura más larga, orden de subagentes, fallo a mitad de lectura), fail-safe que bloquea UNA vez en vez de leer vacío como limpio, apagado por flag en 10 s. Sección 6 del plan.
- 20:45 · hija 3 cerró **HOY-20** (`4e4a3f0f` + `b8b08a83`; informe `.sgc-cache/investigacion-2026-10-11/CATIA_por_codigo.md`): CATIA V5 R21 se maneja por programa desde esta PC (arranque sin ventana 54 s, pieza con pad/agujero/vaciado a CATPart/STEP/IGES/STL, volumen igual al de cadlib, cambiar una cota y recalcular, ensamble, 12 cuadros de un movimiento). La aprobación queda en suspenso por la LICENCIA (sección 5 del informe). Encargo E261010-36a1 cerrado; contexto 63 %. Recibe HOY-16 (el guardián de firma IA con dos falsos positivos).
- 20:50 · hija 2 cerró **HOY-17** (`bc34621b` + `24b04722`; módulo `scripts/_lib/tandaReglas.mjs`, 67 tests nuevos, 194 en verde; revisión por la API US$0,46 con 4 errores reales + auditor Opus con 3, los 7 arreglados): dos reglas de la tanda medidas del registro (2 h sin pedido a la API; 3 despertares seguidos sin avance con una pregunta abierta), avisos sin freno nuevo por el código 5 del latido y por `_orquestador.mjs --hora`; la skill de hijas mide siempre con el modelo pedido. Sobre mi registro de hoy habría avisado desde las 15:16. Lo que dejó: la regla `trabajar-hasta-la-hora.md` no nombraba el código 5 (lo agregué yo a las 21:00, commit propio: es la descripción de un mecanismo ya probado, no un criterio de Fak; las sesiones abiertas lo toman al reabrirse) y «Lo que necesita a Fak» de esta lista tiene notas fijas que el contador lee como preguntas abiertas (las tacho a medida que se contestan).
- 20:49 · hija 3 **midió HOY-16 y no cambió el guardián** (`c335b314`): aflojar `firma-ia-guard` pide el sí de Fak con el cambio exacto (memoria `reference_no_puedo_aflojar_mis_propios_hooks`). Diagnóstico: la lectura sobre «Claude Fak» solo pasa si el comando EMPIEZA con find/ls/grep (con `cd … &&` adelante ya no), y la escritura del id del modelo tiene la forma de escribir una celda y el guardián no mira a qué archivo va. Va a «Lo que necesita a Fak». Su commit de la cola arrastró las filas HOY-19a-n de la hija 4 (sin commitear en ese momento): nada se perdió. Contexto 65 %: cerró.
- 20:56 · hija 4 commiteó el plan **HOY-19** (`654719fb`: medido contra 1.004 mensajes de Fak y Outlook en solo lectura; 14 funciones nuevas como filas HOY-19a-n; la revisión por la API le corrigió errores reales: las 24 reuniones eran 4 series repetidas). Corre su auditor; contexto 50 %. Después recibe HOY-19a-d (las cuatro de lectura de `_mails.py`).
- 21:00 · hija 2 recibe **HOY-18** (GitHub, segunda pasada, encargo E261010-6b8e; contexto 52 %). CI: `24b04722` verde; `654719fb` en cola; los intermedios «cancelled» porque cada push nuevo cancela el anterior.
- 21:08 · **P38 hecho** (sí de Fak 09/10 16:55): `autoContinueAtUsageLimit: true` en su `~/.claude/settings.json` (respaldo `settings.json.antes-p38-20261010-2110`); la clave existe en el bundle de la app («when a claude.ai usage limit stops your session…»). `askUserQuestionTimeout` NO se tocó: el contrato marca «preguntar siempre». Toma efecto en las sesiones nuevas.
- 21:09 · **hija 5** lanzada (`hija-p41-permission-request-20261010`, sesión `local_c138efc5`, encargo E261011-2968, **P41**: hook PermissionRequest que con hora fijada contesta «no hay nadie: queda anotado en la lista»; el evento existe en el bundle de la app junto a PermissionDenied/Setup/TeammateIdle; la hija lo verifica en la doc antes de escribir). Arrancó en bypass; frenada y reenviada → Opus. RAM antes de lanzarla: 6,0 GB. Encargo HOY-19a-d (E261011-b566) listo para la hija 4 cuando cierre su auditor.
- Tareas que quedan para limpiar en Programadas cuando Fak esté (borrar una tarea archiva sus sesiones y eso pide cartel): `prueba-modo-reloj-20261010`, `hija-novedades-h20-h21-20261010` (su corrida abortada), `sesion-sistema-claude-fase2-20261009`.

## Trabajo que puedo hacer solo (cuando se acabe lo pedido)

- HACER YA de la cola en su orden (lo de arriba).
- Las propuestas con el SÍ de Fak del 09/10 16:55 (tanda P12-P22 probada por otro a ciegas, P30-P32, P6, P9+P10, P33, P55, P56, P25, P38, P39, P41).
- Medir qué modo toma una corrida disparada por el RELOJ ahora que el settings no tiene `defaultMode: plan` (una tarea con `fireAt` a los 2 minutos y un prompt de un renglón; leer el primer mensaje con `_hijaEstado.mjs`).

## Decidí distinto de lo pedido

- **Hora fijada a 36 h, no 48**: `horaGuard --fijar` rechaza más de 36 h («revisar la fecha»). Fijé el 11/10 23:00 y la renuevo ese día hasta el 12/10 11:00 (el latido avisa). No toqué el tope: es un freno contra una fecha mal tipeada.
- **La hija no es la anidada «debajo del chat» (Fak ~11:14: "no una rutina, ojo")**: `start_session` existe en la app pero está apagada por gate remoto (0 llamadas en todos los registros; lo que vio fueron 24 fichas que él clickeó). El único camino sin clic es la tarea manual + `run_scheduled_task`, que hereda el modo. Se lo dije como «mirá, creo que lo que querés es esto». La skill prueba primero si `start_session` apareció.
- **Acoté el encargo de la madrugada a H14+P26** (era «la cola desde el paso 9»): un encargo, un entregable (G3 y el propio prompt v5); los pasos siguientes van a hijas nuevas, una por paso.

## Avisos del control de cierre (11:50)

- Disco C: 9,8 GB libres (el control quiere 10). Se libera deshidratando OneDrive, nunca borrando material de Fak (memoria `reference_onedrive_files_on_demand_liberar_espacio`); lo hago si baja de 8.
- LECCIONES estaba 79 bytes arriba del aviso de 26 KiB: fundí el bullet del 08/10 con el del 09-10/10 (misma memoria).

## No pude verificar

- El aviso `notifyOnCompletion` de una tarea nunca se vio llegar: no lo uso; vigilo con `get_usage` + `list_events` + `_hijaEstado.mjs`.

## Lo que necesita a Fak (para cuando vuelva)

- ~~P84~~ contestada 18:40 (*"pensá la mejor manera"*): resuelta con (a), el settings general.
- ~~P55~~ contestada 18:58: no usa la app; "todos" = el Excel editable de cada AMFE en la carpeta de Ingeniería del server (etapa 1b, cuando haya server); AMFE y plan de control con los mismos controles (gate 8 de P6).

- **CATIA (HOY-20)**: el servidor de licencias de esta PC (localhost:4085) no corre y el archivo de licencia es de 2016 con el nombre de otro equipo; CATIA arranca igual. Antes de apoyar trabajo de la empresa en CATIA por código, confirmar la licencia con quien la instaló en la notebook (informe, sección 5).
- **HOY-16, aflojar `firma-ia-guard` (hija 3, 20:49)**: hoy frena (1) una lectura (`find`/`ls`/`grep`) sobre la carpeta «Claude Fak» si el comando no empieza por el verbo de lectura, y (2) escribir el id de un modelo de Claude en el registro interno de la app (`AppData\Roaming\Claude\`). Cambio exacto propuesto: (a) reconocer la lectura por cada comando simple de la línea (todos de solo lectura, sin redirección) y sumar `cat`; (b) exceptuar la regla «IA escrita adentro de un documento» SOLO cuando la única ruta que el comando escribe está en `AppData\Roaming\Claude\` o `~/.claude/`; (c) gemelos rojos que siguen frenando: celda de xlsx con «Claude», CREADO POR, el id del modelo en una celda, un archivo con «claude» en el nombre copiado a la nube. ¿Va así? Mientras tanto, el rodeo de la fila (un script por ruta).
- Lo que el contrato marca preguntar: Supabase, servidor, arb, mails, listados maestros, la primera vez.
- Si quiere que una tarea por reloj arranque en bypass: la crea él desde Programadas con el selector de modo (la creada por MCP no guarda modo).
- P83 contestada el 10/10 (queda aviso, `--logo-bloquea` no se prende). Las 49 firmas de `exports/HO_CORREGIDAS_20261007` e `IMPRESION_0710_FINAL`: limpiadas el 10/10 por la hija de la madrugada.

## Registro (hora · qué pasó)

- 11:00 · arranqué. Fable 5.1, omitir permisos. Cupo 5 h: 8 %. Semanal 19 %, Fable 28 %. CI en curso para 87d8f9c1. La noche de las 06:30 corrió ($1,51). Hija de la madrugada quieta, última actividad 11:01.
- 11:05 · Fak: *"testeá si podés abrir una sesión hija y fijate cómo memorizás eso, si con una skill propia"*. ~11:10: *"todo lo que digo son sugerencias sin evidencia"*. ~11:14: *"no una rutina, ojo con eso"*.
- 11:08 · hora fijada (36 h) y latido lanzado.
- 11:08-11:17 · investigación: `start_session` gated (bundle de la app), 24 fichas spawn_task, el cartel del 09/10 = `set_session_permission_mode`, la madrugada arrancó en plan por el reloj + settings + ARRANQUE.
- 11:18 · encargo E261010-72c7 a la madrugada: «delivered», su turno arrancó.
- 11:19-11:25 · cambio escrito; tests 66/66; `_hijaEstado.mjs` sobre registros reales: madrugada 2 OJOs, 09/10 bien.
- 11:26 · hija 1 lanzada (`local_e4632689`, H20+H21), modelo Opus y título puestos sin cartel. Auditor Opus lanzado.
- 11:28 · **la hija arrancó en modo `default`, no en bypass**: la hipótesis «hereda el modo de la que la lanza» era falsa (la del 09/10 estaba en bypass porque la madre le cambió el modo 5 s después de lanzarla, antes del primer mensaje: ese fue el cartel). La frené (stop_session, sin cartel) y la renombré «abortada».
- 11:33 · en el código de la app: la tarea tiene campos `permissionMode` y `model` (los escribe el selector de Programadas); la app carga el archivo al arrancar y lo tiene en memoria (editarlo a mano no sirve). Caminos que quedan: (a) `permissions.defaultMode: bypassPermissions` en `~/.claude/settings.json` de Fak (doc oficial: el del usuario sí vale; toda sesión nueva de la PC arrancaría en bypass); (b) una tarea «hija del orquestador» que Fak configura UNA vez en Programadas con omitir permisos y yo reutilizo cambiándole el texto. Es su configuración: se lo pregunté por el chat. Textos corregidos (skill, memoria, regla, CLAUDE.md, `_hijaEstado`).
