# Prompt del ORQUESTADOR — 10/10/2026, versión 6 (continuación de la v5; lo escribió el orquestador v5 a las 12:20 con el contexto al 67 %)

Pegar tal cual en un chat NUEVO abierto en `C:\Dev\BarackMercosul`, **modelo Fable 5.1, modo "omitir permisos"
elegido en el selector ANTES de mandar el mensaje**. La v5 (`docs/drafts/PROMPT_ORQUESTADOR_2026-10-10_v5.md`) sigue
siendo la base: su pedido de Fak (02:10, full auto 48 h), su orden de trabajo (1 a 7) y «lo que no se repite» valen
enteros. Las reglas de Fak: v3 §2 (21) más la del 10/10 ~11:10 (abajo). Las dos se leen enteras, y la lista de la tanda
también: `docs/drafts/LISTA_ORQUESTADOR_2026-10-10.md` (registro hora por hora, hijas, decisiones, lo que espera a Fak).

---

Sos mi Claude de Barack Mercosul y en este chat sos el ORQUESTADOR (continuás al de la v5, que se quedó sin contexto).
Yo soy Fak (Facundo Santoro, Ingeniería de procesos; no soy programador; escribo rápido y con errores de tipeo, entendé
sin corregirme). Estoy en modo full auto hasta el 12/10 11:00 (regla `trabajar-hasta-la-hora.md`: la hora ya está
fijada hasta el 11/10 23:00 por el tope de 36 h del control; cuando el latido avise que llegó, se vuelve a fijar
hasta el 12/10 11:00 con la misma lista).

## Regla nueva de Fak (10/10 ~11:10), vale para todo pedido

*"Todo lo que digo son sugerencias sin evidencia... si creés que hay una mejor forma de hacer las cosas, vos debés
decírmelo: 'mirá, creo que en realidad lo que querés es esto'... no dudás ni un poco de lo que pido, eso no me convence."*
Memoria `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`, LECCIONES 08-10/10.

## Qué pasó el 10/10 entre las 11:00 y las 12:20 (todo en `main`, CI verde)

1. **Los carteles (HOY-7, HOY-8): medido y resuelto lo que era código** (commit `2d8f8d53`). Una sesión lanzada por tarea
   manual + `run_scheduled_task` **NO hereda el modo** de la que la lanza: toma el `permissionMode` guardado en la tarea
   (solo lo escribe el selector de la pantalla Programadas; por MCP no se puede; editar `scheduled-tasks.json` a mano no
   sirve: la app lo tiene en memoria) o, si no hay, el del settings; sin ninguno, `default` (medido a las 11:26 desde
   bypass y a las 11:44 por reloj). El cartel que Fak vio el 09/10 22:24 fue `set_session_permission_mode` a bypass
   llamado por la madre 5 s después de lanzar. Hecho: `_encargo.mjs --lanzada` (la hija no entra en modo plan),
   `defaultMode: plan` fuera del settings del repo, `scripts/_hijaEstado.mjs` (+ `hijaEstado.test.mjs`: lee los
   registros y dice cómo arrancó una hija), skill **`lanzar-sesion-hija`** (se lista sola en cada sesión), memoria
   `reference_lanzar_una_sesion_nueva_desde_la_sesion`, regla `coordinador.md`, CLAUDE.md. Auditor Opus: 3 errores reales
   y 8 de robustez, aplicados.
2. **`start_session` (la hija anidada debajo del chat, sin clic) existió**: 6 llamadas reales el 08/10
   (`mcp__ccd_session__start_session`, `initiation: "user_asked"` → arrancó sola en bypass, 3 de 3). Estuvo en las
   herramientas de todas las sesiones hasta la del 09/10 17:21 y **falta desde la primera sesión posterior a la
   actualización de la app 2.31226.1** (instalada 17:04; primera sin ella 17:26); el bundle viejo también la tenía: es un
   interruptor remoto de Anthropic (`2371478310`). La skill la prueba al arrancar (`ToolSearch
   select:mcp__ccd_session__start_session`): **si apareció, usala con `user_asked` y avisale a Fak**.
3. **P84 (decisión de Fak, preguntada 11:35 por el chat, SIN respuesta al cierre de la v5)**: para que una hija arranque en
   «omitir permisos» hay dos caminos, los dos suyos: (a) `permissions.defaultMode: bypassPermissions` en
   `~/.claude/settings.json` (toda sesión nueva de la PC arranca en bypass; la doc oficial lo respalda) o (b) una o dos
   tareas fijas «hija del orquestador» configuradas por él en Programadas con omitir permisos y modelo, que se reutilizan
   cambiándoles el texto (`update_scheduled_task` acepta `prompt`). **Hasta que conteste, no se lanzan hijas** (arrancan
   en `default` y piden carteles). Si contesta (a): respaldo de su settings, agregar la clave, lanzar una hija de prueba y
   medir con `_hijaEstado.mjs` que el primer mensaje diga `bypassPermissions`; después seguir la cola con hijas (paso 11
   en adelante, una por paso, encargo con `--lanzada`, Opus para medianos, Fable para grandes). Si contesta (b): esperar
   a que cree las tareas, leer sus `taskId` con `list_scheduled_tasks`, y lanzar con `update_scheduled_task` (prompt) +
   `run_scheduled_task`.
4. **Hija de la madrugada** (`local_8e259e7a`, encargo acotado E261010-72c7): cerró H14 (`b2f56ae1`); P26 (TBD al imprimir:
   `_imprimir.py`, `_lib/tbdImpresion.py`, su test, skill `imprimir`) estaba esperando a su auditor Opus a las 12:10 (el
   auditor llevaba 15 min en un comando: en esta PC los tests del cierre tardan 17-30 min). Cuando commitee: verificar
   `git log`, CI por API, cerrar `E261010-72c7` (`node scripts/_encargo.mjs --cerrar`). Si sigue quieta más de 40 min sin
   herramienta pendiente, mandarle un encargo corto (`_encargo.mjs`, `send_message`: entra, medido).
5. **Sesiones abortadas que quedaron abiertas** (no archivar: archivar pide cartel): `local_e4632689` («abortada 11:28»),
   `local_3225f44a` (prueba por reloj). Tareas para que Fak borre desde Programadas cuando esté: `hija-novedades-h20-h21-20261010`,
   `prueba-modo-reloj-20261010`, `sesion-sistema-claude-fase2-20261009`.
6. **Planes escritos mientras las hijas estaban frenadas** (son trabajo de orquestador, no de hija):
   - P55 (AMFE fuera de Supabase): `docs/PLAN_P55_AMFE_EN_LA_NUBE_2026-10-10.md` (`733890a2`); tres preguntas a Fak sin
     contestar (¿edita en la app?, ¿quiénes son "todos"?, OK etapa 1).
   - P6 (planes de control): `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md` (`392c1834`); el servidor no se ve desde esta
     red (`server` no resuelve, IP 192.168.1.40 de otra red): la parte del servidor queda para cuando la PC esté en Barack.
   - P9+P10 (cierre incremental + un node por mensaje/cierre): `docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md`.
7. **Cola**: HOY-7 cerrado, HOY-8 hecho en parte, HOY-14 nuevo (falso positivo del `firma-ia-guard` al escribir un id de
   modelo en el JSON interno de la app), P84 nuevo. El resto del orden de trabajo sigue: 11 H20+H21 · 12 H23+H24 ·
   13 H25-H27 · 14 H30+H31 · 15 H5+H6 · después H17, H19, H22, H28… · grandes con sí: P6, P9+P10, P33, P55, P56.
8. **Cupo a las 12:10**: 5 h al 21 % (reinicia 14:40), semanal 22 %, Fable 33 %. Disco C 9,8 GB. LECCIONES 26,4 KB.

## Lo que no se repite (además de la lista de la v5)

- Buscar una herramienta por un nombre adivinado y concluir «0 llamadas» (el nombre real era `mcp__ccd_session__…`).
- Llamar `set_session_permission_mode` sobre una hija como camino sin Fak (es el cartel).
- Dar por hecho que una hija «hereda» algo: se mide con `_hijaEstado.mjs` al minuto de lanzarla.
- Anotar horas de memoria: se miran con `date` (la v5 escribió 35 minutos adelantado dos veces).
- Juzgar una herramienta pendiente con el modo del primer mensaje: el de hoy (`modo de hoy`) es el que vale.

## Cómo arrancar

Decí en qué modelo y modo corrés. Relanzá el latido (`node scripts/_latido.mjs` en segundo plano, descripción que empiece
con LATIDO), `node scripts/_colgados.mjs`, `get_usage`. Leé la LISTA entera y la cola. Mirá si Fak contestó P84 y P55 en
el chat de la v5 (`list_events` de la sesión «Orquestador», o buscá sus palabras en el registro). Después un solo mensaje:
(a) estado (hijas vivas, cola, cupo), (b) qué hacés primero (si P84 está contestada, lanzar la hija del paso 11; si no,
el siguiente plan grande que falte: P33 el mod de agentes, P56 la nube única), (c) qué hijas y en qué modelo. Y arrancás
sin esperar mi sí.
