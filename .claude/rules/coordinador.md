---
description: Rol COORDINADOR — lo que sale hacia otra sesion pasa por _encargo.mjs, no por prosa libre
paths:
  - "scripts/_encargo.mjs"
  - "scripts/_lib/coordinadorGuard.mjs"
  - "scripts/_lib/coordinadorCanon.data.json"
  - ".claude/hooks/coordinador-guard.sh"
  - "__tests__/scripts/coordinadorGuard.test.mjs"
---

# Rol coordinador — regla corta

Cuando esta sesion reparte trabajo a otras sesiones, **de ella no sale prosa libre: sale un
formulario validado**. Mismo patron que ya funciona dos veces en esta casa: `_mailEnviar.py`
+ `mail-guard.sh` para mails, `_escritorio.mjs` + `escritorio-guard.sh` para la cola.

```bash
node scripts/_encargo.mjs --a "<sesion>" --entregable "<UNO>" --origen fak \
     --cuerpo "<texto>" [--fuente <ruta>] [--supuesto "<...>" | --sin-supuestos] \
     [--etapa proyecto|serie] [--ok-fak "<cita>" --hora HH:MM] \
     [--carpeta "<carpeta de la tarea en el Escritorio>"] [--skill <nombre>]... [--sin-arranque] [--lanzada]
```
Se pega la salida **tal cual**. Al final de todo encargo va el bloque **ARRANQUE** (desde el
05/09/2026, canon `plantillaArranque`): modo plan, la carpeta de la tarea, leer los archivos
ENTEROS, cargar los skills, y el cierre (`_cierreSesion.mjs`, auditor a un ARCHIVO, una
sintesis con la ruta primero). Es lo que Fak tipeaba a mano en cada sesion ("modo plan" 47 veces
en dos semanas). `--skill` se valida contra `.claude/skills/` y `--carpeta` contra el disco; una
linea nueva de la plantilla se prueba en `encargo.test.mjs` (pasa por los mismos candados). Un mensaje que no es encargo (un gracias, un aviso):
`touch ~/.claude/.encargo-libre` — vale una vez, mientras el archivo este vacio.

**`--lanzada` (10/10/2026, cola HOY-8 con el si de Fak):** el encargo va a una sesion que LANZA otra
sesion y Fak no esta en su ventana. La linea 1 del ARRANQUE pasa de «entra en modo plan» a «NO entres
en modo plan»: el modo plan espera un clic que nadie va a dar (la hija de la madrugada del 10/10 quedo
parada asi a la 01:33). Como se lanza la hija (tarea manual + `run_scheduled_task`; arranca con el modo
guardado en la tarea o, si no hay, con el del settings, NUNCA con el de la que la lanza; el cambio de modo
desde afuera es lo que muestra el cartel) y como se mide que arranco bien (`node scripts/_hijaEstado.mjs
<id>`): skill **`lanzar-sesion-hija`**. Un mensaje por `send_message` SI entra a una sesion lanzada asi
(medido el 10/10: «delivered» con la hija en turno; «queued» o «undelivered» si esta parada: se lee el resultado).

**La hija hereda la hora de la que la lanza (10/10/2026, cola P41b):** con `--lanzada`, si la sesión que arma el
encargo tiene una hora de trabajo vigente (`trabajar-hasta-la-hora.md`; la sesión sale de `CLAUDE_CODE_SESSION_ID` y sin ese id no se adivina otra),
el ARRANQUE suma como punto 2 el comando `node scripts/_lib/permisoGuard.mjs --heredar <id de la madre>`, y el JSON
del encargo guarda `hereda` (`madre`, `hasta`, `lista`). La hija se anota y el hook `permiso-guard` le aplica la hora
de la madre: un cartel de permiso con nadie en la ventana se contesta solo y queda en la lista de la madre. **No se le
fija una hora propia**: con una, `hora-guard` no la dejaría cerrar el turno antes de la hora de la madre, y su trabajo
es un entregable. Sin hora vigente en la que lanza, el renglón no sale. Qué hijas se anotaron:
`node scripts/_lib/permisoGuard.mjs --heredadas`. Tests: `encargo.test.mjs` y `permisoGuard.test.mjs`.

## Los 7 candados, uno por error real

| # | Regla | Nace de |
|---|---|---|
| G1 | Lo que sale hacia otra sesion pasa por el script | habilita los otros seis |
| G2 | Toda fuente nombrada se verifica, o se escribe **condicional**. Y el encargo separa DATO / SUPUESTO / A VERIFICAR | el "creo" de Fak convertido en dato · el mail de Federico que no existia (habia preguntado por WhatsApp) |
| G3 | **Un encargo, un entregable.** Dos son dos encargos, y el segundo sale cuando vuelve el primero | se le dieron dos tareas a una sesion: agarro la segunda y dejo parada la que importaba |
| G4 | Nada cuya vuelta atras **no este en manos de la sesion**: cerrar el arb, enviar un mail, borrar, archivar, pushear, escribir en el arb o en `Y:` | *"cerra el arb al terminar"* — Fak: **"fue gravisimo eso"** |
| G5 | El **origen** se declara (`fak` · `lista-oficial` · `continuidad`). Un **hallazgo NO es un encargo**: se anota. Y si toca consumos, se declara la **etapa** | el rastreo del thinsulate: hallazgo lateral + criterio de serie sobre pieza en proyecto |
| G6 | El tablero se arma **desde la fuente**, no de lo que las sesiones cuentan, y cada fila lleva la hora de su foto | una hora repitiendo un estado viejo, con `lastActivityAt` a una llamada de distancia · 21 carpetas sin abrir |
| G7 | El destino va por **nombre completo**, no por apodo. Y una autorizacion de Fak **no se reenvia**: solo `--ok-fak "<cita>"`, rotulado como OK REENVIADO que no habilita nada | se le hablo a la sesion equivocada · se reenvio el OK de Fak para mandar un mail |

**En etapa PROYECTO un consumo aproximado NO es un error**, es lo esperable: `--etapa proyecto`
rechaza los encargos que mandan a auditar o rastrear un consumo.

**G6 en concreto:** `node scripts/_tablero.mjs` arma el estado leyendo la cola del Escritorio,
los transcripts en disco (la ultima actividad REAL de cada sesion, no lo que la sesion diga de
si misma) y los encargos abiertos. Cada fila lleva la hora de su foto, y una de mas de 60 min
sale marcada **VIEJO — volver a mirar** en vez de reportarse como presente. `--check` sale con
codigo 1 si hay carpetas de las que no se sabe nada, una sesion con dos encargos a la vez, o el
tablero pasado de hora. `--solo-encargos` es la version acotada para correr seguido: deja
afuera el conteo de carpetas mudas, porque esa lista cambia de a poco y gritarla en cada turno
es como se gasta un control hasta que alguien lo desactiva.

## Enforcement (ejecutable, no prosa)

- `.claude/hooks/coordinador-guard.sh` → `scripts/_lib/coordinadorGuard.mjs`, **PreToolUse**, con matcher sobre
  TODOS los canales que entregan trabajo a otra sesion (`SendMessage`, `Agent`, `Task`, el
  `send_message` del MCP, `spawn_task` y las tareas agendadas). En `SendMessage` exige el marcador `[ENCARGO <id>]` con
  registro y texto coincidente; en `Agent` corre solo los dos checks baratos (G3 y G4), porque
  lanzar subagentes lo hacen todas las sesiones todo el dia y un gate pesado ahi es el candado
  que en un mes se saltea.
- Un `SendMessage` a un **subagente que lanzo esta misma sesion** (su `name` o su agentId, leidos
  del `transcript_path` del hook) no va a otra sesion: pasa con los checks de un `Agent` (G3 y G4).
  Lo que va a otra sesion (`uds:`, un nombre que la sesion no lanzo, el `send_message` del MCP)
  exige el encargo. G4 frena la ORDEN, no la mencion: una negacion la gobierna en su oracion, y en
  un prompt que se declara de SOLO LECTURA un flag o comando citado (`--apply`, `git push`) sin
  verbo de ejecutar al lado es una mencion.
- Listas canonicas en `scripts/_lib/coordinadorCanon.data.json`, **nunca un regex escrito a
  ojo** (`feedback_heuristicas_lista_canonica_no_regex_parcial`). Una frase nueva de Fak se
  agrega ahi, con su fuente, en la misma sesion.
- La logica va en **node, no en bash**: el cuerpo trae comillas, saltos y backslashes de
  Windows, y parsearlo con `sed` es donde esta casa ya se comio verdes falsos.
- Tests: `__tests__/scripts/coordinadorGuard.test.mjs` — **31 casos, las dos direcciones**.
  Los rojos usan el texto **real** de los incidentes del 31/08 y 01/09; los verdes son trabajo
  diario que TIENE que pasar (`feedback_un_control_se_audita_en_las_dos_direcciones`).
- Verificado **en vivo** el 02/09/2026, no solo en test: el mensaje textual del incidente
  quedo bloqueado por el hook real, y un encargo bien armado paso.

## Lo que una auditoria independiente le encontro a la primera version (02/09/2026)

Recien escrito, el cerrojo dejaba pasar **92 de 111 evasiones** y frenaba **21 de 37 mensajes
legitimos**: no frenaba lo que tenia que frenar Y molestaba en el trabajo normal. Los 7 agujeros
estan tapados y clavados en la suite; el detalle, en la memoria
`coordinador_auditoria_independiente_2026-09-02`. Lo que queda como criterio:

- **No distinguir ordenar de mencionar es tan grave como no frenar**: un candado que molesta se
  termina desactivando entero.
- **Los checks de contenido corren sobre el mensaje COMPLETO**, no sobre lo que quedo fuera del
  bloque validado: alcanzaba con pegarle *"y de paso cerra el arb"* al final.
- **Lo que la lista de patrones NO va a resolver nunca:** el auditor probo 31 formas de pedir una
  accion irreversible y **pasaron las 31**. Agregar patrones es una carrera perdida contra el
  castellano. La defensa real de G4 es el gate que vive **donde la accion se ejecuta**
  (`arb-cerrar-guard.sh`, `mail-guard.sh`). Esto es una capa mas.

## Lo que NO se hace

- No escribir esta regla y dejar los checks "para despues". Es 3 de 3 en el historial de la
  casa y el motivo por el que existe `rule-enforcement-gate`.
- No agregar un juez LLM que "revise si el encargo esta bien": lo decide el script o no se
  decide. *La maquina puede MATAR un hallazgo, nunca APROBAR un dato.*
- No tocar el techo de subagentes (10, Sonnet 5.5 en xhigh, auditores en Opus: `techo-agentes.md`) ni resucitar `Workflow`.

Investigacion completa y las fuentes externas: Escritorio → `Mejorar el rol de coordinador`.
