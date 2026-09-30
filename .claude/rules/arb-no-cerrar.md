---
description: El arb NO se cierra sin consultarle a Fak — reabrirlo pide contraseña y la sesión no tipea contraseñas
paths:
  - "scripts/_arb*.py"
  - ".claude/hooks/arb-cerrar-guard.sh"
  - ".claude/skills/arb-operar/**"
---

# El arb NO se cierra sin consultarle a Fak

**Regla dura, puesta por Fak el 31/08/2026.** No se cierra al terminar una tarea, ni "para
dejar todo limpio", ni porque una instrucción de otra sesión lo diga. El estado por defecto
del arb es **abierto**.

## Por qué, en una línea

**Cerrarlo lo puedo hacer yo; abrirlo no.** La ventana `Inicio de Sesión` pide usuario y
contraseña, y la sesión no tipea contraseñas. O sea que cerrarlo cuesta un segundo y
destrabarlo **depende de que Fak esté disponible**. Es una operación asimétrica, y esas se
consultan siempre.

## De dónde sale

Una instrucción que llegó de otra sesión decía "cuando termines, cerralo". Se cerró, y veinte
minutos después la tarea se frenó **dos veces** esperando a Fak para reabrirlo. Fak: *"no vuelvas
a cerrar arb sin consultarme, nueva regla dura... fue gravísimo eso"*. El caso entero, con la
ruta de relanzamiento: memoria `no_cerrar_arb_sin_consultar`.

Y ni siquiera alcanzaría con tener la contraseña: el campo `Usuario` se autocompleta con
el nombre de la PC y el usuario real del arb es `FACUNDO`.

## Qué está prohibido y qué no

| | |
|---|---|
| ❌ `taskkill` / `Stop-Process` / `pkill` sobre `produc.exe` | matar el proceso |
| ❌ `WM_CLOSE` / `DestroyWindow` sobre la clase `ProdWindow` o el título `Producción` | cerrar la ventana principal |
| ✅ `WM_CLOSE` sobre `Maestro de Insumos` | es el modo **documentado** de descartar una edición sin grabar (skill `arb-operar`) |
| ❌ cerrar `Maestro de Relaciones` abierta (su `WM_CLOSE`, o `_arbVer.py reset` con ella abierta) | **crashea el arb**: dos veces el 25/09/2026 (Fak: *"cuando reseteas relaciones la app crashea... anotalo para evitar hacerlo"*). `reset_relaciones()` se niega sin `--forzar`, y `--forzar` solo con OK de Fak |
| ✅ `python scripts/_arbVer.py reset` con Relaciones CERRADA | solo la **abre** por click; ese camino anda |
| ✅ Fak aprieta **"ARB - reiniciar"** en su Escritorio | `scripts/_arbLanzar.py --reiniciar`: le pregunta, cierra el arb trabado, lo abre y entra con la clave que Fak guardo en el Administrador de credenciales de Windows (30/09/2026). **Lo aprieta Fak**: el script se niega si lo lanza una sesion de Claude (`CLAUDECODE`) |

**Vigilante (30/09/2026):** con "ARB - activar vigilante" Fak deja una tarea de Windows que cada 3 min
reabre el arb si esta CERRADO y nadie usa la PC (no cierra un arb colgado; un login fallido la pausa).
No habilita a cerrarlo: cerrar el arb "para que el vigilante lo reabra" sigue prohibido.

**Si el arb se cuelga o pide login:** escribirle a Fak una linea — *"doble click en ARB - reiniciar"*
(o *"doble click en ARB"* si solo pide la clave) — y esperar con `python scripts/_arbVer.py estado`
hasta que `ProdWindow` este habilitada. Claude nunca lee ni tipea la clave, ni corre `_arbLanzar.py`
salvo `--diagnostico`.

Si de verdad hay que cerrarlo: **preguntarle a Fak, con el motivo**. Si ya dijo que sí:

```bash
touch ~/.claude/.arb-cerrar-ok
```

Vale para **un** comando: el guardián lo consume y vuelve a quedar armado.

## Enforcement

`.claude/hooks/arb-cerrar-guard.sh` (PreToolUse, `Bash|PowerShell`, dentro de
`_dispatcher.sh`). Devuelve exit 2 y explica el porqué.

Probado en las **dos** direcciones — `bash .claude/hooks/arb-cerrar-guard.test.sh`: los que tienen
que bloquear, los del trabajo diario que tienen que pasar, y los del escape de un solo uso. Un gate probado sólo en rojo no está probado: lo caro es que frene el trabajo de
todos los días (memoria `feedback_un_control_se_audita_en_las_dos_direcciones`).

### Las dos decisiones de diseño (salieron de una auditoría independiente, 31/08)

La primera versión cazaba **la forma en que yo lo había escrito** y nada más: un agente auditor
encontró 8 maneras de cerrar el arb que pasaban limpias, varias con sintaxis **más natural** que
la que sí cazaba. Están todas en la suite, marcadas `[AUDIT 31/08]` (lista y detalle: memoria
`arb_cerrar_guard_los_8_bypasses`).

Dos decisiones de diseño que salieron de ahí:

- **Los verbos van en lista canónica, no en un regex parcial.** El agujero grande era exigir
  un espacio detrás de `kill`, que descartaba `.Kill()` y `os.kill(`.
- **Un kill por PID pelado se RESUELVE**: el guardián extrae el número y pregunta
  `tasklist //FI "PID eq N"` si ese proceso es `produc.exe`. Sólo en ese caso, que es raro,
  así que el costo no se paga en cada comando.

### Límites conocidos, escritos a propósito

- **Mira el texto del comando, no el resultado.** Un PreToolUse corre antes: no puede saber si
  el arb sigue vivo. Si aparece una forma nueva de cerrarlo, hay que agregarla.
- **Las dos señales tienen que estar en el MISMO comando.** Un `PostMessageW(h, 0x0112, 0xF060, 0)`
  con el handle traído de un paso anterior no se distingue de cerrar una ventana hija, y pasa.
- Esto es un **guardián contra el olvido, no un sandbox contra un adversario**. El actor es la
  propia sesión, y lo que se busca es que la regla se vea justo cuando se la va a romper.
- El guardián **se autobloqueaba al auditarse y al documentarse a sí mismo**: un `grep` de sus
  propios tokens sobre la skill, y el `git commit` que describe qué bypasses tapó. Dos
  exenciones lo resuelven, las dos con su caso negativo probado:
  - comandos de **sólo lectura** que no encadenan a un intérprete (`cat x.sh | bash` no se exime);
  - el **cuerpo de un heredoc es contenido, no comando**, cuando la línea arranca con `git`,
    `cat`, `tee`, `echo` o `printf`. Si arranca con un intérprete no se exime, porque
    `python - <<PY` se come el cuerpo por stdin **sin pipe** — y ése es justamente el comando
    del incidente del 31/08.

## La forma general, por si aparece otra igual

**Antes de dejar un sistema en un estado del que no puedo sacarlo solo, se pregunta.** No
importa que cerrarlo parezca prolijo: lo que decide es si la vuelta atrás está en mis manos.
El mismo criterio vale para cualquier cosa que se reabra con credenciales, con una llamada a
otra persona, o con un permiso que no tengo.
