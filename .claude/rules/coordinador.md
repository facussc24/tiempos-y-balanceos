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
     [--etapa proyecto|serie] [--ok-fak "<cita>" --hora HH:MM]
```
Se pega la salida **tal cual**. Un mensaje que no es encargo (un gracias, un aviso):
`touch ~/.claude/.encargo-libre` — vale una vez, mientras el archivo este vacio.

## Los 7 candados, uno por error real

| # | Regla | Nace de |
|---|---|---|
| G1 | Lo que sale hacia otra sesion pasa por el script | habilita los otros seis |
| G2 | Toda fuente nombrada se verifica, o se escribe **condicional**. Y el encargo separa DATO / SUPUESTO / A VERIFICAR | el "creo" de Fak convertido en dato · el mail de Federico que no existia (habia preguntado por WhatsApp) |
| G3 | **Un encargo, un entregable.** Dos son dos encargos, y el segundo sale cuando vuelve el primero | se le dieron dos tareas a una sesion: agarro la segunda y dejo parada la que importaba |
| G4 | Nada cuya vuelta atras **no este en manos de la sesion**: cerrar el arb, enviar un mail, borrar, archivar, pushear, escribir en el arb o en `Y:` | *"cerra el arb al terminar"* — Fak: **"fue gravisimo eso"** |
| G5 | El **origen** se declara (`fak` · `lista-oficial` · `continuidad`). Un **hallazgo NO es un encargo**: se anota. Y si toca consumos, se declara la **etapa** | el rastreo del thinsulate: hallazgo lateral + criterio de serie sobre pieza en proyecto |
| G6 | El tablero se arma **desde la fuente**, no de lo que las sesiones cuentan, y cada fila lleva la hora de su foto | una hora repitiendo un estado viejo, con `lastActivityAt` a una llamada de distancia · 21 carpetas sin abrir |

**G6 en concreto:** `node scripts/_tablero.mjs` arma el estado leyendo la cola del Escritorio, los transcripts en disco (la ultima actividad real de cada sesion, no lo que la sesion diga de si misma) y los encargos abiertos. Cada fila lleva la hora de su foto y una de mas de 60 min sale marcada **VIEJO — volver a mirar**. `--check` sale con codigo 1 si hay carpetas de las que no se sabe nada, una sesion con dos encargos a la vez, o el tablero pasado de hora. `--solo-encargos` es la version acotada: deja afuera el conteo de carpetas mudas porque esa lista cambia de a poco y gritarla en cada turno es como se gasta un control hasta que alguien lo desactiva.
| G7 | El destino va por **nombre completo**, no por apodo. Y una autorizacion de Fak **no se reenvia**: solo `--ok-fak "<cita>"`, rotulado como OK REENVIADO que no habilita nada | se le hablo a la sesion equivocada · se reenvio el OK de Fak para mandar un mail |

**En etapa PROYECTO un consumo aproximado NO es un error**, es lo esperable: `--etapa proyecto`
rechaza los encargos que mandan a auditar o rastrear un consumo.

## Enforcement (ejecutable, no prosa)

- `.claude/hooks/coordinador-guard.sh` → `scripts/_lib/coordinadorGuard.mjs`, **PreToolUse,
  matcher `SendMessage|Agent`**. En `SendMessage` exige el marcador `[ENCARGO <id>]` con
  registro y texto coincidente; en `Agent` corre solo los dos checks baratos (G3 y G4), porque
  lanzar subagentes lo hacen todas las sesiones todo el dia y un gate pesado ahi es el candado
  que en un mes se saltea.
- Listas canonicas en `scripts/_lib/coordinadorCanon.data.json`, **nunca un regex escrito a
  ojo** (`feedback_heuristicas_lista_canonica_no_regex_parcial`). Una frase nueva de Fak se
  agrega ahi, con su fuente, en la misma sesion.
- La logica va en **node, no en bash**: el cuerpo trae comillas, saltos y backslashes de
  Windows, y parsearlo con `sed` es donde esta casa ya se comio verdes falsos.
- Tests: `__tests__/scripts/coordinadorGuard.test.mjs` — **17 casos, las dos direcciones**.
  Los rojos usan el texto **real** de los incidentes del 31/08 y 01/09; los verdes son trabajo
  diario que TIENE que pasar (`feedback_un_control_se_audita_en_las_dos_direcciones`).
- Verificado **en vivo** el 02/09/2026, no solo en test: el mensaje textual del incidente
  quedo bloqueado por el hook real, y un encargo bien armado paso.

**Bypass que encontro el propio test rojo (02/09/2026):** con el bloque validado entero,
alcanzaba con pegarle *"y de paso cerra el arb"* al final. Contener el texto no basta: los
checks de contenido corren sobre el **mensaje completo**.

## Lo que NO se hace

- No escribir esta regla y dejar los checks "para despues". Es 3 de 3 en el historial de la
  casa y el motivo por el que existe `rule-enforcement-gate`.
- No agregar un juez LLM que "revise si el encargo esta bien": lo decide el script o no se
  decide. *La maquina puede MATAR un hallazgo, nunca APROBAR un dato.*
- No tocar el techo de 5 subagentes ni resucitar `Workflow`.

Investigacion completa y las fuentes externas: Escritorio → `Mejorar el rol de coordinador`.
