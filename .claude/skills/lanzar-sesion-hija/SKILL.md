---
name: lanzar-sesion-hija
description: Lanzar una sesión nueva o hija de Claude Code desde esta sesión, sin que Fak pegue un prompt ni apruebe un cartel — encargo con `_encargo.mjs --lanzada`, tarea manual + `run_scheduled_task` (arranca con el modo guardado en la tarea o el del settings, nunca con el de la que la lanza), modelo y título desde acá, y el control `_hijaEstado.mjs` que mide que arrancó bien. Usar cuando haya que abrir otra sesión, pasarle trabajo a una sesión nueva, continuar en un chat nuevo al llegar al límite de contexto, repartir la cola entre sesiones, orquestar varias sesiones, o cuando Fak pregunte si puedo abrir una sesión («¿no podés vos mismo desplegar una sesión?», 09/10; «testeá si podés abrir una sesión hija», 10/10/2026). Lo primero que hace es probar si `start_session` (la hija anidada debajo del chat) ya está habilitada.
---

# Lanzar una sesión hija desde esta sesión

Fak, 09/10/2026 20:25: *"¿y no podés vos mismo desplegar una nueva sesión en vez de mandarme el prompt a mí?"*.
10/10/2026 11:05: *"testeá si podés abrir una sesión hija y fijate cómo memorizás eso, si con una skill propia…
pareciera que te olvidás de tus propias habilidades"*. Esta skill es esa memoria: se lista en cada sesión.

## 0. Primero, ¿volvió la hija anidada (la que aparece debajo de este chat)?

`start_session` (`mcp__ccd_session__start_session`, con `list_start_targets` y `hand_off_to_session`) **existió
y se usó**: el 08/10/2026 hubo 6 llamadas reales desde sesiones de esta carpeta. Con `initiation: "user_asked"`
la hija arrancó sola, anidada bajo el chat y **en bypass, sin clic** (3 de 3: `local_b1058f97`, `local_7042679f`,
`local_01ee9ee7`); con `"own_initiative"` deja una ficha que Fak tiene que tocar; `"offer"` es una oferta que se
cierra si Fak escribe otra cosa. Parámetros usados: `initiation`, `context: "fresh"`, `model`, `effort`,
`use_worktree: false`, `name`, `title`, `background`, `prompt`. Estuvo en la lista de herramientas de todas las
sesiones hasta la del 09/10 17:21. **Desde la primera sesión posterior a la actualización de la app (2.31226.0 →
2.31226.1, instalada el 09/10 17:04; primera sesión sin ella: 17:26) no aparece más**; en el bundle nuevo sigue,
detrás de un interruptor remoto (`2371478310`). Antes de usar el camino B, probar:

```
ToolSearch  query: "select:mcp__ccd_session__start_session,mcp__ccd_session__list_start_targets"
```

Si aparece: usarla con `initiation: "user_asked"` (abre la hija anidada, sin clic; su `session_id` sirve para
`set_session_*`, `send_message`, `stop_session`, `detach_session`). Avisarle a Fak en un renglón que volvió y
anotar acá la fecha.

Si no aparece (hoy): camino B, con el modo resuelto en §B.0. **No** le decir a Fak «no se puede»: se le dice qué
falta y las dos formas de resolverlo.

## Los tres caminos, medidos (10/10/2026)

| Camino | Clic de Fak | Dónde se ve | Modo con el que arranca | Estado |
|---|---|---|---|---|
| **A** `start_session` con `initiation: user_asked` | no | anidada debajo del chat que la lanzó | el que se pida (bypass el 08/10) | funcionó el 08/10 (3 de 3); no aparece desde la app 2.31226.1 (09/10 17:26); probar en §0 |
| **B** tarea manual + `run_scheduled_task` | no, **pero hoy arranca en `default` y pide carteles** hasta que Fak fije el modo (§B.0) | **Programadas** → la tarea → sus corridas (no tiene fila propia en la barra) | **el guardado en la tarea** (`permissionMode` de `scheduled-tasks.json`, lo escribe el selector de Programadas) **o, si no hay, el del settings**; NUNCA el de la sesión que la lanza (medido 10/10 11:26: desde bypass arrancó en `default`; la del 01:33 tomó `plan` del repo; la del 11:44 por reloj, `default`) | el único camino de hoy, **solo con el modo resuelto en §B.0** |
| **C** ficha `spawn_task` | **sí, uno** | anidada debajo del chat, con su worktree propio | el de la sesión madre (22 de 24 en bypass, 2 en auto) | para cuando Fak está y quiere verla abajo |

Lo que Fak vio «abrirse debajo de un chat» (01 al 06/10/2026) fueron **24 fichas C** que él clickeó.

## Camino B, paso a paso (sin clic SOLO con el modo resuelto en §B.0; el 09/10 22:23 «funcionó» por el cartel, el 10/10 11:26 llegó en `default`)

B.0. **El modo con el que va a arrancar, ANTES de lanzar.** Una corrida de tarea no hereda nada: toma el
   `permissionMode` guardado en la tarea (solo lo escribe el selector de la pantalla Programadas: la creada por
   MCP no lo trae, `update_scheduled_task` no lo acepta y editar `scheduled-tasks.json` a mano no sirve, la app
   lo tiene en memoria) o, si no hay, el que resuelve el settings de Claude Code (`permissions.defaultMode` de
   `~/.claude/settings.json`; el del repo no vale para bypass). **Resuelto el 10/10/2026 18:40** (Fak: *"pensá la
   mejor manera"*): `permissions.defaultMode: "bypassPermissions"` en `~/.claude/settings.json` (respaldo al lado:
   `settings.json.antes-bypass-20261010-1840`). Medido a las 18:45 con la hija `local_218252c2`: primer mensaje en
   `bypassPermissions`, sin cartel. Si en otra PC de Fak falta esa línea, una hija arranca en `default`: se mira con
   `_hijaEstado.mjs` al minuto.

1. **El encargo** (regla `coordinador.md`; el guardián bloquea cualquier otra prosa hacia otra sesión):
   ```bash
   node scripts/_encargo.mjs --a "<nombre completo de la hija>" --entregable "<UNO>" --origen fak|continuidad \
        --cuerpo "<qué hacer; mandar a leer ENTERO el prompt largo si lo hay>" --fuente <ruta>... \
        --sin-supuestos [--ok-fak "<cita>" --hora HH:MM] --lanzada
   ```
   `--lanzada` cambia la línea 1 del ARRANQUE: **NO entrar en modo plan** (nadie aprobaría el plan: la hija de la
   madrugada del 10/10 quedó parada con dos `ExitPlanMode`). El QUÉ lo aprueba el encargo. El modelo pedido se
   escribe en el cuerpo («Modelo: Opus 5.5») para que la hija sepa en qué corre.
2. **La tarea**, manual: `mcp__scheduled-tasks__create_scheduled_task` con `taskId` kebab con fecha
   (`hija-<tema>-<AAAAMMDD>`), `prompt` = el texto del encargo **TAL CUAL**, `title` legible, sin `cronExpression`
   ni `fireAt`, `notifyOnCompletion: false` (ese aviso nunca se vio llegar: `trabajar-hasta-la-hora.md`).
3. **Lanzar**: `mcp__scheduled-tasks__run_scheduled_task` con ese `taskId` → devuelve el `session_id` (`local_…`).
   La hija arranca en esta carpeta, con hooks, reglas y memoria, **con el modo guardado en la tarea o, si no hay,
   el del settings** (§B.0). **No llamar `set_session_permission_mode` como camino sin Fak**: la herramienta dice
   que subir el modo desde afuera muestra un cartel, y Fak lo vio el 09/10 22:24 (*"me apareció un cartel para
   aprobar"*: la sesión madre lo llamó 5 s después de lanzar, antes del primer mensaje de la hija, y por eso
   aquella «arrancó en bypass»). El 10/10 10:53 un cambio a bypass sobre una sesión andando volvió en 38 ms sin
   que se sepa si hubo cartel: no está medido en las dos direcciones, no se cuenta como camino.
4. **Modelo y título** (en la misma tanda): `set_session_model` (desde una sesión en bypass no pide cartel; **aplica
   desde el segundo turno de la hija**: el primero sale en el modelo por defecto del settings, hoy Opus) y
   `set_session_title`. Para una hija en Fable: que el primer turno sea corto (leer y contestar «listo») y recién
   después el trabajo, o aceptar que el primer turno vaya en Opus.
5. **Medir que arrancó bien**, al minuto y a los cinco:
   ```bash
   node scripts/_hijaEstado.mjs <session_id> [--espera-modelo claude-opus-5-5]
   ```
   Lee los registros (no lo que la hija dice): modo del PRIMER mensaje, si entró en modo plan, turnos, última
   escritura y herramientas sin resultado (un cartel). Sale 1 con OJOs. Con una hija parada: `stop_session` y
   relanzar por otro camino; **nunca esperar «a que termine»** (04/10: 55 minutos).
6. **Hablarle**: `mcp__ccd_session_mgmt__send_message` con un encargo nuevo (`_encargo.mjs`; un aviso suelto va con
   `~/.claude/.encargo-libre`). Medido 10/10: a la hija de la madrugada **entró** («delivered», 11:18, con ella en
   turno) aunque la doc diga que no; a la misma hija parada en modo plan dio «undelivered» (01:50) y mientras
   trabajaba «queued» (04:50). Se lee el resultado, no se da por entregado. Vigilar contexto con
   `get_usage(session_id)`; al 85 % pedirle cierre prolijo y lanzar la siguiente.
7. **Cerrar**: `node scripts/_encargo.mjs --cerrar <id>` cuando vuelve el entregable, verificado en `git log` y CI.

## Lo que no se repite

- Un encargo sin `--lanzada` a una sesión sin Fak (modo plan = parada).
- `set_session_permission_mode` sobre la hija (el cartel).
- Dar por lanzada una hija sin correr `_hijaEstado.mjs`; dar por hecho su trabajo sin `git log`.
- Dos encargos a la misma hija a la vez (G3); una autorización de Fak reenviada en el cuerpo (G7).
- Decirle a Fak «no puedo abrir una sesión»: B existe; lo que puede faltar es el modo (§B.0), y eso se le dice con
  las dos formas de resolverlo, no como un «no se puede».
- Buscar una herramienta por un nombre adivinado (`ccd_session_mgmt__start_session`) y concluir «0 llamadas»: el
  nombre real es `mcp__ccd_session__start_session` y hubo 6 (auditor 10/10).

## Límites conocidos

- La tarea creada por MCP no guarda modo ni modelo propios (`scheduled-tasks.json` no los tiene;
  `update_scheduled_task` no los acepta): una corrida **disparada por el reloj** (cron/fireAt) no hereda de nadie y
  toma el settings; por eso el `defaultMode: plan` del repo se sacó el 10/10 (HOY-8). Para una tarea por reloj que
  tenga que arrancar en bypass, la crea Fak desde la pantalla Programadas con el selector de modo.
- `open_session_in` no acepta una sesión lanzada por B (solo las de `start_session`): Fak la abre desde Programadas.
- Fuentes: doc oficial `desktop-scheduled-tasks` («Each task has its own permission mode… the run stalls until you
  approve»), `permission-modes` («bypassPermissions en el settings del proyecto no toma efecto»), descripciones de
  las herramientas `ccd_session_mgmt` (10/10/2026), registros de `~/.claude/projects` y de
  `%APPDATA%\Claude\claude-code-sessions`.
