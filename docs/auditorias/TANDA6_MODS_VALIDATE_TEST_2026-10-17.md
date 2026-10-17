# Tanda 6: salida de `claude plugin validate` y `claude plugin test` sobre los dos mods propios (17/10/2026)

Corrido el 17/10/2026 ~11:10 con el programa de la terminal (Claude Code 2.1.301; la app de escritorio corre el motor 2.1.299), desde la rama `claude/vista-tanda6-1017` (los mods sin cambios respecto de `main` 4322d932). No se arregló nada: es la salida tal cual. La carpeta del tablero es `mods/tablero` y su nombre de plugin es `tablero-casa`.

**Resultado:** los dos validan (`✔ Validation passed`, salida 0) y sus pruebas pasan: `tablero-casa` 5 de 5, `presupuesto-agentes` 20 de 20. Único consejo del validador (no cambia el veredicto): al README de `presupuesto-agentes` le falta el renglón de instalación desde un marketplace; no aplica mientras el mod se instale con `scripts/_modsInstalar.mjs`.

## validate_tablero

```
Validating plugin manifest: C:\Dev\BarackMercosul\.claude\worktrees\vista-tanda6-1017\mods\tablero\.claude-plugin\plugin.json

Validating hooks: C:\Dev\BarackMercosul\.claude\worktrees\vista-tanda6-1017\mods\tablero\hooks\hooks.json

  ❯ ./register.mjs hooks: session.start, session.measure, command.run{command=tablero}, ui.render{component=AbovePrompt}, ui.render{component=Pane}
  ❯ ./register.mjs answers its own command: command.run{command=tablero}
  ❯ ./register.mjs calls: $.agent.list (via refrescar), $.clock.every, $.clock.now (via anotar, armarReloj), $.command.register, $.env.get (via carpetaCasa), $.fs.list (via armarFs), $.fs.read (via anotar, armarFs), $.fs.stat (via armarFs), $.fs.write (via anotar), $.session.cwd (via refrescar), $.session.id (via refrescar), $.session.usage, $.ui.invalidate, $.ui.log (via refrescar), $.ui.open, $.ui.resolve
  ❯ ./register.mjs env writes: nothing
  ❯ ./register.mjs env reads: HOME, USERPROFILE

✔ Validation passed
exit=0
```

## validate_presupuesto-agentes

```
Validating plugin manifest: C:\Dev\BarackMercosul\.claude\worktrees\vista-tanda6-1017\mods\presupuesto-agentes\.claude-plugin\plugin.json

Validating hooks: C:\Dev\BarackMercosul\.claude\worktrees\vista-tanda6-1017\mods\presupuesto-agentes\hooks\hooks.json

  ❯ ./register.js hooks: session.start, agent.spawn, session.measure, turn.step
  ❯ ./register.js gating hook with .catch: agent.spawn
  ❯ ./register.js calls: $.clock.now, $.env.get (via home), $.fs.exists (via buscarDefinicion), $.fs.list (via buscarDefinicion), $.fs.read (via buscarDefinicion, leerSiExiste), $.fs.stat (via leerEscape), $.fs.write (via anotar), $.session.cwd (via raizSesion), $.session.id (via sesionId), $.session.root (via raizSesion), $.session.usage, $.store.get (via asentar), $.store.set (via asentar), $.ui.log
  ❯ ./register.js env writes: nothing
  ❯ ./register.js env reads: HOME, USERPROFILE

ℹ Advice (does not change the verdict):

  ❯ C:\Dev\BarackMercosul\.claude\worktrees\vista-tanda6-1017\mods\presupuesto-agentes\README.md: This README has no line that installs "presupuesto-agentes" from a marketplace. Add the install line, which works in one step on Claude Code 2.1.275 or later. Validate the folder that holds its marketplace.json to have <owner>/<repo> filled in, and the name its marketplace lists it under.
      /plugin install presupuesto-agentes --marketplace <owner>/<repo>

✔ Validation passed
exit=0
```

## test_tablero

```

tests\tablero-cascara.test.ts:
(pass) la banda se dibuja en la terminal y en la app de escritorio con el cupo y los agentes [292.16ms]
(pass) sin archivos y sin lectura de cupo la banda igual se dibuja («sin datos») y no tapa lo de otros [159.61ms]
(pass) la plata de la API por clave y la tarea de la madrugada salen de sus dos archivos, dichas en claro [203.80ms]
(pass) antes de la primera lectura (sin session.start) la banda no rompe [141.43ms]
(pass) deja en su registro que cargo y la primera vez que la app le pide dibujar la banda (una sola vez por sesion) [176.03ms]

 5 pass
 0 fail
Ran 5 tests across 1 file. [1.54s]
exit=0
```

## test_presupuesto-agentes

```

tests\presupuesto-agentes.test.ts:
(pass) el auditor del proyecto pasa aunque la carpeta de trabajo sea otra y el cupo este lleno [233.36ms]
(pass) si root() no responde, las definiciones del proyecto se buscan en la carpeta de trabajo [132.62ms]
(pass) el auditor pasa aunque su definicion no se encuentre (root() da otra carpeta), y queda dicho con def=sin [188.64ms]
(pass) la carpeta de agentes del proyecto existe y no se deja listar: el auditor pasa y queda def=error [152.54ms]
(pass) un .md de definicion no se deja abrir: no se niega a nadie por «sin definicion»; siguen el cupo y la ventana [122.77ms]
(pass) con la definicion sin leer el cupo lleno (5 h) frena igual [105.83ms]
(pass) un buscador (haiku) pasa y descuenta 1; el registro dice de que carpeta salio la definicion [119.03ms]
(pass) un built-in que de verdad no tiene definicion se niega con el motivo, y queda anotado con def=sin [125.46ms]
(pass) cupo lleno (5 h al 91 %): un investigador se niega [100.34ms]
(pass) semana al 61 %: una busqueda en haiku SALE con el aviso del 60 % en el registro (16/10/2026, Fak 15/10: sin evidencia no hay freno por cupo semanal) [116.81ms]
(pass) con ~/.claude/.agent-cupo-ok vigente el mismo lanzamiento pasa, y sin aviso [148.58ms]
(pass) ~/.claude/.agent-cupo-ok de hace 13 horas ya no vale [142.33ms]
(pass) ventana llena (40 puntos): un Sonnet mas no entra [134.42ms]
(pass) con ~/.claude/.agent-limit en 15 la misma ventana tiene 60 puntos y el Sonnet entra [128.82ms]
(pass) un Opus pesa 8; con ~/.claude/.agent-opus-ok pesa como un Sonnet [110.31ms]
(pass) ~/.claude/.agent-opus-ok: el mismo Opus descuenta 4 [136.57ms]
(pass) doce Sonnet lanzados a la vez: entran diez (40 puntos), el libro tiene diez y el registro las doce decisiones [753.90ms]
(pass) el libro no contesta: el lanzamiento PASA (decide el guardian bash) y el registro dice que el hook fallo [124.57ms]
(pass) al arrancar la sesion deja un renglon con la raiz que resolvio [121.87ms]
(pass) un subagente que pide effort max se rebaja a xhigh; la sesion principal y los demas esfuerzos no se tocan [89.46ms]

 20 pass
 0 fail
Ran 20 tests across 1 file. [3.99s]
exit=0
```
