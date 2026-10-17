---
name: lanzar-sesion-hija
description: Lanzar una sesión nueva o hija de Claude Code desde esta sesión, sin que Fak pegue un prompt ni apruebe un cartel — desde el 16/10/2026 con `mcp__ccd_session__start_session` (la hija anidada debajo del chat, en Opus y en bypass, medido), encargo con `_encargo.mjs --lanzada` como prompt, y el control `_hijaEstado.mjs` que mide que arrancó bien; la tarea manual + `run_scheduled_task` queda como respaldo. Usar cuando haya que abrir otra sesión, pasarle trabajo a una sesión nueva, continuar en un chat nuevo al llegar al límite de contexto, repartir la cola entre sesiones, orquestar varias sesiones, proponer una tarea aparte como ficha (`own_initiative`), o cuando Fak pregunte si puedo abrir una sesión («¿no podés vos mismo desplegar una sesión?», 09/10; «testeá si podés abrir una sesión hija», 10/10/2026).
---

# Lanzar una sesión hija desde esta sesión

Fak, 09/10/2026 20:25: *"¿y no podés vos mismo desplegar una nueva sesión en vez de mandarme el prompt a mí?"*.
10/10/2026 11:05: *"testeá si podés abrir una sesión hija y fijate cómo memorizás eso, si con una skill propia…
pareciera que te olvidás de tus propias habilidades"*. Esta skill es esa memoria: se lista en cada sesión.

## 0. La hija anidada VOLVIÓ (16/10/2026): `start_session` es el camino normal; B queda de respaldo

**Medido el 16/10/2026** desde la sesión Fable 5.1 de la PC principal (`34df5f0e`): `mcp__ccd_session__start_session`
aparece en la lista de herramientas y lanzó dos hijas sin clic, anidadas bajo el chat, **en Opus 5.5 y en
`bypassPermissions` desde el primer mensaje** (`local_b3e5c5f5` 13:13 y `local_4ac0598e` 13:28; `_hijaEstado.mjs`
dijo ARRANCÓ BIEN en las dos). Lo que se usó y anda:

```
mcp__ccd_session__start_session  initiation: "user_asked" · context: "fresh" · use_worktree: true (si toca código que
  la madre también toca) · model: "claude-opus-5-5" (desde Fable se puede pedir igual o más barato; sin `model` la
  hija corre en el modelo de la madre) · wake_when_done: true (la madre se retoma cuando la hija termina; según el esquema de la herramienta la app la retoma igual, con o sin esta opción, salvo que la hija nunca reciba su encargo: ahí sí hace falta)
  · name (≤ 24, [a-z0-9-]) · title (≤ 60: es lo que `_encargo.mjs --a` registra como destino) · branch_name ·
  background (≥ 80 caracteres) · prompt = el texto de `_encargo.mjs --lanzada`, TAL CUAL
```

- **El encargo se sigue armando con `_encargo.mjs --lanzada`** (regla `coordinador.md`): el `prompt` es el primer
  mensaje de la hija, y desde el 16/10 el guardián `coordinador-guard` también mira `start_session` (prosa libre o un
  encargo editado → bloqueo; una oferta o un `proposal_id` sin `prompt` → pasa). Los comandos que son el objeto del
  trabajo van en un archivo adjunto al encargo (`docs/PLAN_*.md`), nunca literales en el texto: el guardián frena un
  comando de borrado o un grep escrito literal aunque sea el tema.
- **Se mide igual**: `node scripts/_hijaEstado.mjs <local_id> --espera-modelo claude-opus-5-5` al minuto. Y la hija
  no puede pasar del esfuerzo de la madre (con Fable en medium, Opus en medium).
- **`initiation: "own_initiative"`** deja una ficha que Fak toca para arrancarla: es «proponer trabajo aparte»
  sin pedir permiso en el chat (tanda 1.2). **`"offer"`** pregunta «Sesión nueva / Acá» antes de nada.
- **Cuándo la app lo NIEGA (medido 16/10/2026, dos veces):** `start_session` solo pasa en un turno que arrancó con un mensaje
  tipeado por Fak en la app y al que todavía no le entró nada más. En un turno disparado por un evento (una tarea que termina, el
  aviso de una hija, el latido) la app contesta «Start sessions only on the user's own words… this turn runs an automated event»;
  y **también lo niega en un turno que SÍ arrancó con palabras de Fak si en el medio llegaron avisos de tareas en segundo plano**
  (21:40: el turno de las 20:05 de Fak, con la suite y un auditor corriendo). Ahí va el camino B (tarea manual + `run_scheduled_task`),
  sin cartel porque el settings global fija bypass; `_hijaEstado.mjs` al minuto dice en qué modelo arrancó (el 16/10 arrancó
  directo en Opus, sin hacer falta el frenar-y-reenviar).
- **Máximo dos hijas activas a la vez** (con cuatro el cupo semanal subía ~4 puntos por hora el 10/10). Una hija, un
  entregable, un commit en su worktree, nunca un push: dice la rama y la madre la trae a `main` (`git merge --no-ff`,
  build, suite completa si agrega archivos o toca `settings.json`, push).
- **Settings que lo acompañan (16/10, esta PC):** `crossSessionInbound: "accept"` en `~/.claude/settings.json` (la app no
  puede mostrar el diálogo de aprobación de un mensaje entre sesiones y lo descartaba a los 5 minutos; con `accept`
  entra); `.worktreeinclude` con `.env.local` y `.qr-secret` (desde el 08/10) para que un worktree nuevo vea Supabase.
- **Retiros con vencimiento** (se revisan el **23/10/2026** con una semana de uso; tanda 9): el camino B entero
  (tarea manual + `run_scheduled_task`) queda escrito como respaldo y se saca si en una semana no hizo falta; la espera
  de `_hijaEstado.mjs` se reemplaza por `wake_when_done` + `SendMessage` con `notify_when_idle` si se mide que llega en
  la app (doc `cross-session-messaging`: solo a sesiones de esta misma máquina; no probado en la app todavía); la
  mensajería por archivos entre sesiones (`FACUNDO\PEDIDO N`) sigue: es entre PC, no entre sesiones.

Lo que sigue abajo es la historia (08/10 a 15/10) y el camino B, que se usa solo si `start_session` no aparece.

### 0 bis. Historia: cómo se perdió y cómo se midió (08/10 a 15/10/2026)

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

Si no aparece (pasó del 09 al 15/10/2026): camino B, con el modo resuelto en §B.0. **No** le decir a Fak «no se puede»: se le dice qué
falta y las dos formas de resolverlo.

## Los tres caminos, medidos (10/10/2026; el 16/10 el A volvió y es el normal: §0)

| Camino | Clic de Fak | Dónde se ve | Modo con el que arranca | Estado |
|---|---|---|---|---|
| **A** `start_session` con `initiation: user_asked` | no | anidada debajo del chat que la lanzó | el que se pida (bypass el 08/10) | funcionó el 08/10 (3 de 3); desapareció del 09 al 15/10; **volvió el 16/10 y es el camino normal (§0)** |
| **B** tarea manual + `run_scheduled_task` (respaldo desde el 16/10) | no, **pero arranca en `default` y pide carteles** si el settings no fija el modo (§B.0) | **Programadas** → la tarea → sus corridas (no tiene fila propia en la barra) | **el guardado en la tarea** (`permissionMode` de `scheduled-tasks.json`, lo escribe el selector de Programadas) **o, si no hay, el del settings**; NUNCA el de la sesión que la lanza (medido 10/10 11:26: desde bypass arrancó en `default`; la del 01:33 tomó `plan` del repo; la del 11:44 por reloj, `default`) | respaldo (hasta el 15/10 era el único), **solo con el modo resuelto en §B.0** |
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
   escribe en el cuerpo («Modelo: Opus 5.5») para que la hija sepa en qué corre. **Desde el 10/10 22:30 (cola
   P41b, commit `2574c13b`)**: si la sesión que arma el encargo tiene una hora vigente de `trabajar-hasta`, el
   ARRANQUE suma el punto 2 con `node scripts/_lib/permisoGuard.mjs --heredar <madre>`: la hija se anota como
   lanzada por esa sesión, hereda su hora (no fija una propia ni lanza latido: un entregable, un turno) y el hook
   `permiso-guard` le contesta «no» a un cartel de permiso y lo anota en la lista de la madre. Quiénes se
   anotaron: `node scripts/_lib/permisoGuard.mjs --heredadas`. Medido con las hijas 5 y 6 el 10/10.
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
   desde el segundo turno de la hija**: el primero sale en el modelo que tenga el selector de la app, que es el de la
   ÚLTIMA sesión que Fak abrió: el 10/10 18:45 las hijas 2 y 3 arrancaron en Fable porque el orquestador era Fable) y
   `set_session_title`. **Como una hija hace casi todo en un solo turno, el cambio de modelo no llegaría nunca**:
   apenas `_hijaEstado.mjs` dice ARRANCÓ BIEN, `stop_session` (desde bypass no pide cartel) y reenviar el MISMO
   encargo por `send_message`: ese turno nuevo sale en el modelo pedido. Medido el 10/10 18:50.
5. **Medir que arrancó bien**, al minuto y a los cinco, **siempre con el modelo pedido** (paso fijo desde el 10/10,
   cola HOY-17: sin `--espera-modelo` el control da «arrancó bien» a una hija que corre en Fable):
   ```bash
   node scripts/_hijaEstado.mjs <session_id> --espera-modelo claude-opus-5-5
   ```
   Se corre otra vez después del reenvío del paso 4: ahí tiene que salir sin el OJO del modelo. Después, en cada
   renglón de la hora, `node scripts/_orquestador.mjs --hora` lista todas las hijas con su modelo, su modo, cuándo
   escribieron y su último commit.
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
  toma el settings; por eso el `defaultMode: plan` del repo se sacó el 10/10 (HOY-8). **Medido el 10/10 20:35**
  (`prueba-modo-reloj-20261010` re-armada con `fireAt`, sesión `local_3320e192`): con el `defaultMode:
  bypassPermissions` del settings general, la corrida por reloj arrancó en `bypassPermissions` sin cartel (y en el
  modelo del selector, Fable). A las 11:44, sin esa línea, la misma tarea había arrancado en `default`. Vale para
  `seguimiento-reunion-amfe` (lunes y viernes 08:30). En una PC sin esa línea, la crea Fak desde Programadas con el
  selector de modo.
- `open_session_in` no acepta una sesión lanzada por B (solo las de `start_session`): Fak la abre desde Programadas.
- Fuentes: doc oficial `desktop-scheduled-tasks` («Each task has its own permission mode… the run stalls until you
  approve»), `permission-modes` («bypassPermissions en el settings del proyecto no toma efecto»), descripciones de
  las herramientas `ccd_session_mgmt` (10/10/2026), registros de `~/.claude/projects` y de
  `%APPDATA%\Claude\claude-code-sessions`.
