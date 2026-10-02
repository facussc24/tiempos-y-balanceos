---
description: Una mejora del sistema (hook, skill, regla, guardian) no esta implementada hasta que se la probo con un mensaje real de Fak por el camino real y se la vio llegar; al cerrarla se le dice a Fak si las sesiones abiertas la toman solas
paths:
  - ".claude/hooks/**"
  - ".claude/skills/**"
  - ".claude/rules/**"
  - ".claude/settings.json"
  - "scripts/_lib/*Guard*.mjs"
  - "scripts/_lib/*Canon*.json"
  - "scripts/_lib/guardianes.mjs"
  - "scripts/_probarMejora.mjs"
  - "scripts/_lib/probarMejora.mjs"
  - "scripts/_lib/mejorasEnPrueba.data.json"
---

# Una mejora no esta implementada hasta que se la vio funcionar con un mensaje real de Fak

Fak, 02/10/2026: *"te pedi antes que me lo des facil de entender y no aplicaste la mejora que
habiamos implementado... me respondiste normal como si no recordaras esa conversacion... pensa
como evitar que cuando te digo que implementes algo realmente lo implementes"*.

## Que paso

El skill `explicar-mejor` y su hook se dieron de alta el 02/10 a la mañana, con 41 tests en verde.
Cinco horas despues Fak pidio el estado de una tarea *"faicl de entender"* y recibio una tabla.
Tres cosas fallaron, y los tests no veian ninguna:

| Lo que fallo | Por que no se vio |
|---|---|
| Su frase caia en la señal de "responder corto", no en la de explicar | Se probo con las frases que yo elegi, no con la que el uso |
| El mensaje llego con un aviso de la app adelante y el hook lo tomo por automatico: no aviso nada | Ningun test tenia un mensaje con esa forma. Les pasaba a todos los hooks de mensajes |
| El skill estaba en la lista y no se cargo | Nada lo exigia |

## La regla

Una pieza del sistema es un hook, un skill, una regla, un agente, un comando, `settings.json`,
`CLAUDE.md`, o un guardian de `scripts/_lib` con su canon. Quien la crea o la cambia:

1. **La prueba con un mensaje REAL de Fak, textual, antes de cerrar.** El mensaje sale de sus
   transcripts (`~/.claude/projects/C--Dev-BarackMercosul*/*.jsonl`), con sus errores de tipeo.
   No sirve uno escrito por mi.

   ```bash
   node scripts/_probarMejora.mjs --mensaje "<el mensaje, textual>" --espera "<lo que tiene que llegar>"
   ```

   Lo corre por los hooks de `.claude/settings.json` (bash → node, como Claude Code), en las dos
   formas en que llega un mensaje: pelado y con el aviso de la app adelante. Despues corre el cierre
   del turno sobre una respuesta comun. Si un hook contesta distinto en una forma y en la otra, falla.
2. **Le dice a Fak si las sesiones abiertas la toman solas o hay que reabrirlas.** El renglon lo
   imprime el mismo script (`SESIONES ABIERTAS`); solo eso: `--sesiones`.
3. **La da por implementada cuando la vio llegar.** El aviso se anota en
   `scripts/_lib/mejorasEnPrueba.data.json` y de ahi en mas se mide solo: en los transcripts, cuantos
   mensajes debian recibirlo y a cuantos les llego (`node scripts/_probarMejora.mjs --llego`).
   "Debia 0" no es un verde: todavia no se vio funcionar.

## Que toma sola una sesion abierta (medido el 02/10/2026)

| Pieza | Una sesion que ya esta abierta |
|---|---|
| Hook nuevo en `settings.json`, o un cambio en un hook, un guardian o su canon | Lo toma sola, en segundos. Un hook agregado a las 14:54:59 corrio a las 14:55:07 en una sesion abierta hacia 5 horas, y en otras cuatro antes de las 14:55:36 |
| Skill nuevo | El listado se actualiza solo (a una sesion abierta el 01/10 le llego 21 minutos despues de creado). El texto se lee al cargarlo |
| `CLAUDE.md`, LECCIONES y reglas sin `paths:` | Entran al arrancar y al compactar. La sesion abierta sigue con la version vieja: **hay que reabrirla** |
| Regla con `paths:` | Entra cuando la sesion toca un archivo de esas rutas. La que ya la cargo sigue con la vieja |

**Los hooks corren desde el checkout principal** (`C:\Dev\BarackMercosul`), tambien para una sesion
que trabaja en un worktree: su log de instrucciones se escribe ahi. Un cambio hecho en un worktree
no existe para ninguna sesion, abierta o nueva, hasta que llega a ese checkout. El script lo avisa
con un `OJO`.

Lo que se creia y no era: *"la sesion estaba abierta desde antes, por eso no le llego el aviso"*. La
sesion `c66e2969`, abierta el 01/10, recibio los dos hooks nuevos el 02/10 sin reabrirse. Antes de
escribir una causa asi, se mide (`--llego`).

## Enforcement

- **Hook Stop `cierre-guard.sh`, chequeo 7** (`scripts/_lib/cierreGuard.mjs`): si el ultimo mensaje
  de Fak pedia explicar y en el turno no se cargo el skill `explicar-mejor`, ni se mostro un dibujo
  o una pagina, ni se entrego un archivo, el turno no termina. Salida: un renglon
  `No aplica explicar-mejor: <motivo>`. Es el control de "lo vi en la lista y no lo use".
- **Mismo hook, chequeo 3**: si la sesion escribio una pieza del sistema y declara un cierre sin
  haber corrido despues `_probarMejora.mjs --mensaje`, o sin decirle a Fak lo de las sesiones
  abiertas, bloquea (`pendientesDeMejora`, lista de piezas en `cierreCanon.data.json`, `mejora`).
- **`node scripts/_cierreSesion.mjs`**, paso "Mejoras del sistema": un aviso que debia llegar en
  los ultimos 3 dias y no llego es una falta; uno mas viejo, un aviso.
- **Un mensaje de Fak con un aviso de la app adelante es de Fak**: `sinAvisosAdelante()` en
  `scripts/_lib/correccionGuard.mjs`, que usan los hooks de mensajes y el cierre-guard.
- Tests, en las dos direcciones y con los mensajes reales: `__tests__/scripts/probarMejora.test.mjs`,
  `cierreGuardExplicar.test.mjs`, `explicarGuard.test.mjs`.

Limite conocido: una sesion nueva de punta a punta (que el modelo cargue el skill al leer el mensaje)
no se puede lanzar sola desde esta PC: la linea de comandos `claude -p` no tiene la sesion iniciada
(02/10/2026: *"OAuth session expired"*). Por eso el paso 3 mide lo que paso en las sesiones reales, y
el chequeo 7 exige el skill en el momento.
