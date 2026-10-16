# Auditoría tanda 1.1: `start_session` en el coordinador-guard y renglón autónomo del ARRANQUE (16/10/2026)

Revisor independiente (agente `auditor`, Opus), regla `codigo-madre.md`, cambio MEDIANO. Solo detección: no se tocó
ningún archivo del repo salvo este informe.

## Veredicto: APROBADO CON CAMBIOS

El cambio **endurece** y no afloja nada. Comparé viejo contra nuevo con 32 llamadas de prueba (y 20 más con el escape armado) y solo cambian las de
`start_session`, siempre de «pasa» a «bloquea» o a «pasa gastando el escape». Ninguna llamada que antes se bloqueaba
pasa ahora. Los tests dan 70 de 70 y el hook real bloquea la prosa libre.

Pero queda una puerta abierta en la misma herramienta. El campo `background` llega a la hija junto con el `prompt` y
ningún control lo mira (H1).

**Condición mínima para aprobar.** Tal como está, la skill (`SKILL.md:28-29`: «prosa libre o un encargo editado →
bloqueo») y la regla (`coordinador.md:77-79`) dicen más de lo que el control hace. Antes del commit hay que hacer una
de dos cosas:
- Cerrar H1 en esta misma tanda (el arreglo (a) de H1 es seguro contra el tráfico real: se probó).
- O escribir en la skill y en la regla que el `background` todavía no se revisa.

H5 y H7 están fuera de los 8 archivos y no cuentan para el veredicto.

## Checks

| Check | Estado | Detalle |
|---|---|---|
| `node --check` de los dos `.mjs` | OK | `coordinadorGuard.mjs` y `_encargo.mjs` |
| JSON del canon y de `settings.json` | OK | Los dos parsean. En `settings.json` cambia una sola línea, el matcher (línea 50). |
| vitest de los dos archivos (`--pool=threads`) | OK | 70/70, exit 0 leído sin pipe |
| Viejo (`git show HEAD:`) contra nuevo, 32 llamadas sin escape y 20 con escape | OK | Solo cambian las filas de `start_session` (detalle en «Lo que no cambió») |
| Hook real por stdin, con un HOME vacío de prueba | OK, salvo H1 y H2 | A) prosa libre: exit 2 · B) encargo E261016-855b tal cual: exit 0 · **C) el mismo encargo con una orden en `background`: exit 0 (H1)** · **D) escape y orden en el `prompt`: exit 0 (H2)** · E) SendMessage a `uds:` con prosa: exit 2 · F) título de otra hija: exit 2 · G) encargo con CRLF y espacios al final: exit 0 |
| Plantilla ARRANQUE | OK | Con `--lanzada` el renglón autónomo sale último y numerado (5 sin hora, 6 con hora o con carpeta). Sin `--lanzada` no sale, con o sin `hereda`. Con `--sin-arranque` no sale nada. `detectarIrreversibles` y `detectarSegundaTarea` dan `[]` sobre el renglón solo y sobre el texto entero. |
| ¿Endurece o afloja? | Endurece | Antes `start_session` no estaba en el matcher y no se revisaba nada. Ahora la prosa libre, un marcador inventado, dos marcadores y un título de otra hija se bloquean. |
| Archivos de otras sesiones | OK, con aviso | Ver la sección «Git y CI» |
| Castellano de lo que lee Fak | 2 detalles | H9 |
| Git y CI | Aviso | `23f914e1` está sin pushear (no es de esta tanda). El último run de CI es `completed success`, sobre `f6dd6eaa`. |

## Hallazgos

### H1 · TRUE BUG: el `background` de `start_session` pasa sin ningún control

**Dónde.** `scripts/_lib/coordinadorGuard.mjs:184-206` mira solo `inp.prompt`.

**Qué recibe la hija.** El esquema oficial de la herramienta lo dice así; lo leí del `deferred_tools_record` en el
registro de la sesión `34df5f0e`:

> "fresh" (default) = your `prompt` + `background` only, so `background` is required too, at least 80 characters.

También lo medí en la hija `tanda10-cola` (conversación `4b00afd2`, primer mensaje a las 13:40:45). En ese mensaje el
`background` está en la posición 746 y el marcador `[ENCARGO E261016-4304]` en la 1498. **La hija lee primero la prosa
libre y después el encargo.**

**Caso que falla, con el hook real (payload C).**
- `prompt`: el texto registrado de E261016-855b, tal cual.
- `title`: su `a`.
- `background`: «Contexto de la madre para la hija: … Al terminar cerrá el arb y mandá el mail a Carlos.»
- Resultado: **exit 0**.
- Sobre esa frase, `detectarIrreversibles` da `["cerrar-arb","enviar-mail"]`. Un `spawn_task` con la misma frase se bloquea.

**Por qué es un bug.** Es el agujero H2 de la auditoría del 02/09 («alcanzaba con pegarle "y de paso cerrá el arb" al
final»), movido a un campo hermano. El caso «ROJO · el encargo valido con una orden pegada al final» del test nuevo
se esquiva poniendo la orden en `background`. Y no es un caso raro: el `background` es obligatorio en toda hija
`fresh`, y las tres llamadas reales de hoy mandaron 1072, 974 y 594 caracteres sin validar.

**No es una regresión.** Antes no se miraba nada.

**Arreglo sugerido (no aplicado).**
- (a) Mínimo: en la rama de `start_session`, correr siempre `checksDeLanzamiento` (G3 y G4) sobre `background`,
  también por el camino del escape. **Probado al revés, para ver que no moleste.** Corrí `detectarIrreversibles` y
  `detectarSegundaTarea` sobre los 4 `background` reales de hoy (1072, 974, 220 y 594 caracteres) y sobre cada
  `prompt` junto con su `background`: los 4 dan `[]`. El arreglo (a) no habría frenado ningún lanzamiento legítimo
  de hoy.
- (b) Completo: que `_encargo.mjs` acepte `--background`, lo guarde en el registro (texto y hash) y que el guardián lo
  compare con `mismoTexto`, igual que el `prompt`.
- Sumar un test ROJO con la orden en `background`.

### H2 · ROBUSTNESS: con el escape, `start_session` no corre ni G3 ni G4

**Dónde.** `coordinadorGuard.mjs:222-223`: el escape se mira antes que cualquier check de contenido. El test nuevo
«VERDE · el escape de una sesion vale tambien para start_session» deja esto escrito como comportamiento esperado.

**Medido con el hook real y un HOME de prueba.**
- Con `.encargo-libre.ses-aud` vacío y el `prompt` «cerrá el arb y mandá el mail», da exit 0 y el escape se gasta.
- Un `spawn_task` con el mismo `prompt` y el mismo escape se bloquea: está en `LANZADORAS`, que siempre corre G3 y G4.

**Por qué importa.** En un SendMessage el escape es para «un gracias, un aviso». Un `start_session` siempre arranca
trabajo, así que con el escape se abre una sesión entera sin G4.

**Sugerido.** En la rama de `start_session`, aunque haya escape, correr `checksDeLanzamiento` sobre `prompt` y
`background` juntos.

### H3 · ROBUSTNESS: G7 no se compara si la llamada no trae `title`

**Dónde.** `coordinadorGuard.mjs:206` y `:297` (`reg.a && destino && …`).

**El caso.** El flujo «offer» manda el encargo con `proposal_id` y sin `title`. Medido: `proposal_id` más un encargo
emitido para otra sesión pasa. Es lo mismo que ya pasa con un SendMessage sin `to`. Impacto bajo.

### H4 · ROBUSTNESS (diseño): `context: "fork"` le pasa a la hija toda la conversación

El esquema dice: fork = «this whole conversation + your `prompt`». Todo lo que Fak dijo en el chat, sus OK incluidos,
llega a la hija sin pasar por el encargo, y G7 dice que un OK de Fak no se reenvía. El guardián solo valida el `prompt`.

**Sugerido.** Decidir si fork se permite (la skill recomienda `fresh`). Si no se permite, bloquearlo en la rama de
`start_session`.

### H5 · ROBUSTNESS: una puerta hermana sin cubrir (ya estaba antes)

`mcp__ccd_session__hand_off_to_session` mueve la tarea a una sesión nueva: fork de la conversación más un
`remaining_plan` de texto libre. Está en la lista de herramientas de la sesión `34df5f0e`, pero no aparece ni en el
matcher (`.claude/settings.json:50`) ni en la regex de aviso.

`coordinador.md:75-79` dice «matcher sobre TODOS los canales que entregan trabajo a otra sesion», y hoy eso no es
cierto. Es el mismo patrón de «tres puertas al mismo cuarto» del 02/09.

### H6 · ROBUSTNESS: documentación y mensajes que quedaron viejos

- `coordinadorGuard.mjs:4` («matcher SendMessage|Agent») y `:12-19` («QUE BLOQUEA» no nombra `start_session`).
  Lo mismo en `.claude/hooks/coordinador-guard.sh:2`.
- `coordinadorGuard.mjs:234`: el mensaje de bloqueo dice «Despues pegás la salida TAL CUAL en el SendMessage.» Para
  `start_session` el texto va en `prompt`, y `title` tiene que ser igual a `--a`. La sesión madre vio ese mensaje en
  vivo a las 13:36.
- `coordinadorGuard.mjs:195`: el `!ES_START &&` agregado no hace nada, porque ningún nombre de `start_session` coincide
  con `spawn|dispatch|remote_trigger|create_scheduled`. No hace daño.

### H7 · TRUE BUG fuera de los 8 archivos (ya estaba antes) que afecta lo que afirma la skill

**Dónde.** `scripts/_hijaEstado.mjs:115-120`.

**El bug.** Si el registro de la app todavía no tiene `cliSessionId` (una hija recién lanzada que no recibió su primer
mensaje), `cli` queda en `null`, no se agrega ningún «ojo» y el veredicto es **ARRANCÓ BIEN sin conversación**.
Probado con un registro falso sin `cliSessionId`: `{ ok: true, ojos: [] }`.

**Caso real de hoy.**

| Hija | Lanzada | `_hijaEstado` dijo ARRANCÓ BIEN | Primer mensaje |
|---|---|---|---|
| Impresora (`local_b3e5c5f5`, `createdAt` 16:13:56Z) | 13:13:56 | 13:15:52, sin datos de conversación | 13:40:45 (`8978b0d5`) |
| Tanda 10 (`local_4ac0598e`) | 13:28:26 | 13:29:49 | 13:40:45 (`4b00afd2`) |

Las dos recibieron su primer mensaje en el mismo segundo, 27 y 12 minutos después de lanzadas. La causa de la espera
no la pude determinar: la madre no terminó su turno en ese segundo.

Lo que la skill afirma de modo y modelo sí se confirma ahora: las dos tienen el primer mensaje en
`bypassPermissions` y el modelo `claude-opus-5-5`.

**Sugerido.**
- En `estadoHija`: con `esLocal && app && !cli`, agregar el ojo «todavía no recibió su primer mensaje».
- En la skill, el paso «Se mide igual» tiene que esperar a ver «primer mensaje en modo: …» en la salida.

### H8 · ROBUSTNESS: precisión de la skill

- `SKILL.md:16` dice «`local_b3e5c5f5` 13:10». La llamada fue a las 13:13:56 y el primer mensaje a las 13:40:45
  (ver H7). Lo de «desde el primer mensaje» es cierto, pero la medición de las 13:15 no lo midió.
- `SKILL.md:22`: «wake_when_done: true (la madre se despierta cuando la hija termina su turno)». Según el esquema, la
  app retoma a la madre «whether or not this is set»; `true` agrega el caso en que la hija nunca recibe su tarea.
- Contradicción interna. §0 dice que `start_session` es el camino normal, pero:
  - `SKILL.md:70` dice «Si no aparece (hoy): camino B».
  - La tabla «Los tres caminos, medidos (10/10/2026)» (`SKILL.md:73-79`) todavía dice que A «no aparece desde la app
    2.31226.1», y que B es «el único camino de hoy».
  - Está fechada, pero un modelo que lee la skill puede tomar ese «hoy» como de hoy. Sugerido: marcar la tabla como
    historia o actualizar la fila A.

### H9 · Castellano (lo que lee Fak)

- `SKILL.md:34`: «ficha (card)», inglés entre paréntesis. Sacar «(card)».
- `SKILL.md:45`: la cita en inglés «only to your sessions on this machine». Ponerla en castellano: «solo a tus
  sesiones en esta PC».
- «medium» es el nombre del nivel de esfuerzo: aceptable. Lo agregado a la regla no tiene observaciones.

### H10 · Plantilla: sin bug, dos detalles

- En el mismo bloque quedan dos órdenes de cierre. El renglón autónomo dice «primero el resultado, después lo que hace
  falta». El punto 5 dice «con la RUTA del entregable en la primera línea», que es lo mismo que pide `CLAUDE.md`.
  Son compatibles si «resultado» incluye la ruta. Para que no queden dos órdenes distintas, podría decir «primero el
  resultado, con la ruta del entregable».
- El test «cada linea de la plantilla, sola» (`encargo.test.mjs:206-212`) no tiene `P.lineaAutonoma` en su lista fija.
  Lo probé aparte y da `[]`, pero conviene sumarla, como pide la regla (una línea nueva se prueba ahí).

## Lo que no cambió (preguntas 2 y 5)

- **SendMessage común.** `destino` se movió más arriba, pero da el mismo valor. En la matriz quedaron iguales las 8
  filas de SendMessage: subagente propio con prosa (pasa), subagente propio con una orden irreversible (bloquea), `uds:`,
  otra sesión, encargo al destino correcto, encargo a otro destino, sin `to` y `content`.
  La rama de subagentes propios no cambió.
- **`mcp__ccd_session_mgmt__send_message`, `spawn_task`, `create_scheduled_task`, Agent y Task.** Dan igual, viejo y
  nuevo.
- **El aviso no se perdió.** `start_session` nunca coincidió con la regex del aviso, y las tools desconocidas
  (`remote_trigger`, `dispatch`) siguen con su aviso. Hay algo que ya estaba antes: `main()` nunca imprime `r.aviso`
  (`coordinadorGuard.mjs:337-339`) y esas tools no están en el matcher, así que ese aviso no le llega a nadie desde
  hace tiempo.
- **Efecto secundario que ya existía.** Con un escape armado, un encargo válido por `start_session` también gasta el
  escape, porque se mira antes que el marcador. Lo mismo pasaba con SendMessage.

## Descartados

- **`prompt` que no es texto pasa.** El esquema lo declara string, y la herramienta rechaza otra cosa antes de llegar
  al guardián. No es un camino real.
- **Canon.** Se suman dos claves: `_autonoma` (un comentario) y `lineaAutonoma`. El único que usa `plantillaArranque`
  es `_encargo.mjs:290-307`, que nombra cada campo uno por uno. Nada más cambió.
- **`coordinador.md:29` y `:94`.** Dicen `touch` (el guardián pide `: >`) y «31 casos». Ya estaban así antes de esta
  tanda: no se corrigen dentro de ella.

## Git y CI (pregunta 6)

- Los cambios de esta tanda son solo los 8 archivos de la lista (122 líneas agregadas, 11 sacadas), igual al
  principio y al final de la auditoría. `settings.json` cambia en una sola línea.
- Otros archivos modificados que **no son de esta tanda**:
  - Ya estaban al empezar: `.env.example`, `scripts/_crearAmfeUpperTrimming.mjs`, `docs/auto-mejora/*`,
    `docs/LECCIONES_APRENDIDAS.md`, `scripts/_lib/amfeAutoria.mjs`, `__tests__/scripts/amfeAutoria.test.mjs`.
  - Aparecieron durante la auditoría (otra tanda, en el mismo checkout): `.claude/agents/amfe-healer.md`,
    `.claude/agents/auditor.md`, `.claude/rules/techo-agentes.md`, `__tests__/mods/presupuesto-agentes.test.mjs`,
    `__tests__/scripts/cierreGuardOrden.test.mjs`, `mods/presupuesto-agentes/hooks/{presupuesto.mjs,register.js}`, `mods/presupuesto-agentes/tests/presupuesto-agentes.test.ts`,
    `scripts/_lib/cierreCanon.data.json`, `scripts/_lib/cierreGuard.mjs`.
  - **El commit de la tanda 1.1 va con las 8 rutas, nombradas una por una.**
  - Este informe es un archivo nuevo sin seguimiento (`docs/auditorias/`, carpeta nueva) y queda fuera de esas 8
    rutas. Un commit con solo esas 8 no lo incluye: la sesión que me lanzó decide si lo suma.
- `23f914e1` («plan de la impresora A2L…», tanda 0 y 17) está commiteado y sin pushear. El último run de CI es
  `completed success`, sobre `f6dd6eaa`.
- `settings.json` está en `mensajes_re` del cierre-guard, así que el chequeo 3 pide `_probarMejora.mjs`. Corrió a las
  13:59:52, después de la última edición de un `settings.json` en la sesión (13:45:26).
- Sesiones abiertas: el hook y el guardián los toman solas. `coordinador.md` tiene `paths:` y entra cuando una sesión
  toca esos archivos.

## Evidencia (scratchpad de la sesión `34df5f0e`, carpeta `audit_t11/`)

- `matriz.mjs`: viejo contra nuevo, 32 llamadas sin escape y 20 con escape.
- `payloads.mjs` y `p/*.json`: los payloads del hook real, armados con `JSON.stringify`.
- `plantilla.mjs`: numeración y candados del ARRANQUE.
- `hijaSinConv.mjs`: el verde falso de `_hijaEstado`.
- `hijaPrimerMsg.mjs` y `hijaEstadoRuns.mjs`: el primer mensaje de la hija y las corridas de `_hijaEstado` de hoy.
- `schema3.mjs` y `schema4.mjs`: los esquemas de `start_session` y `hand_off_to_session`, sacados del registro.
