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

## El incidente

31/08/2026, tarea del remache de ductos. Terminé de leer el maestro de insumos y cerré el
arb, porque una instrucción que me llegó decía "cuando termines, cerralo". Veinte minutos
después había que cargar el reemplazo en la BOM. Lo relancé yo (`Z:\arb\prod\produc.exe`) y
quedó en la pantalla de login: la tarea se frenó **dos veces** esperando a Fak, por algo que
yo mismo había roto. Fak: *"no vuelvas a cerrar arb sin consultarme, nueva regla dura...
fue gravísimo eso"*.

Detalle que agrava el asunto: el campo `Usuario` se autocompleta con `FACUNDOS-PC`, y el
usuario real del arb es `FACUNDO`. Ni siquiera alcanzaría con la contraseña.

## Qué está prohibido y qué no

| | |
|---|---|
| ❌ `taskkill` / `Stop-Process` / `pkill` sobre `produc.exe` | matar el proceso |
| ❌ `WM_CLOSE` / `DestroyWindow` sobre la clase `ProdWindow` o el título `Producción` | cerrar la ventana principal |
| ✅ `WM_CLOSE` sobre `Maestro de Insumos` / `Maestro de Relaciones` | es el modo **documentado** de descartar una edición sin grabar (skill `arb-operar`) |
| ✅ `python scripts/_arbVer.py reset` | cierra y **reabre** la de Relaciones |

Si de verdad hay que cerrarlo: **preguntarle a Fak, con el motivo**. Si ya dijo que sí:

```bash
touch ~/.claude/.arb-cerrar-ok
```

Vale para **un** comando: el guardián lo consume y vuelve a quedar armado.

## Enforcement

`.claude/hooks/arb-cerrar-guard.sh` (PreToolUse, `Bash|PowerShell`, dentro de
`_dispatcher.sh`). Devuelve exit 2 y explica el porqué.

Probado en las **dos** direcciones — `bash .claude/hooks/arb-cerrar-guard.test.sh`, 15 casos:
6 que tienen que bloquear (incluido el comando exacto del incidente), 7 del trabajo diario
que tienen que pasar, y 2 del escape de un solo uso. Un gate probado sólo en rojo no está
probado: lo caro es que frene el trabajo de todos los días
(memoria `feedback_un_control_se_audita_en_las_dos_direcciones`).

## La forma general, por si aparece otra igual

**Antes de dejar un sistema en un estado del que no puedo sacarlo solo, se pregunta.** No
importa que cerrarlo parezca prolijo: lo que decide es si la vuelta atrás está en mis manos.
El mismo criterio vale para cualquier cosa que se reabra con credenciales, con una llamada a
otra persona, o con un permiso que no tengo.
