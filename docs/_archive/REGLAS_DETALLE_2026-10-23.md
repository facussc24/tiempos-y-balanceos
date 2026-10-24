# Detalle e historia de reglas always-on, mudado el 23/10/2026 (poda del contexto fijo, ítem 6d del viernes 23/10)

Las reglas de `.claude/rules/` entran enteras al contexto de cada sesión. Lo que sigue es la HISTORIA y lo MEDIDO que las
justifica; se mudó acá sin cambiar ni una regla, un número ni un enforcement (los que siguen en la regla). Cada sección
dice de qué regla salió y la regla dice que esto está acá.

---

# § trabajar-hasta-la-hora.md

## Qué falló (medido)

Mi último commit fue a las 17:03 y mi último mensaje a las 17:10. Dos causas, las dos mías:

1. **Una sesión no sigue sola.** Cuando termino de contestar quedo parado hasta que llega un mensaje de Fak, el
   aviso de algo que dejé corriendo (un agente, un programa en segundo plano) o un aviso programado. A las 17:10 no
   había nada corriendo: nadie me despertó.
2. **Traté un pedido por TIEMPO como una lista.** Cuando se me acabó la lista que tenía en la cabeza, cerré con un
   resumen. Y trabajo había (lo que la auditoría dejó sin arreglar, más pruebas).


## 09/10/2026: el latido por CronCreate nunca disparó; el que despierta es un programa en segundo plano (medido)

En los transcripts de esta carpeta: **0 mensajes LATIDO en 16 sesiones** (las 15 del 08/10 y la de la noche, con
35 menciones de CronCreate); un one-shot `* * * * *` seguía sin disparar 8 minutos después con la sesión quieta.
Por eso el 03/10 y el 08/10 la sesión se quedó quieta horas mientras el hook `hora-guard` daba el latido por vivo:
**miraba que el cron existiera (`session_crons`), no que latiera**.

La tarea programada de la app (`mcp__scheduled-tasks__create_scheduled_task`, con aviso al terminar) arrancó sola el
09/10 a las 06:39, pero **su aviso de «terminó» a la sesión que la creó no aparece en ningún registro**: la corrida se
trabó en modo plan y la tarea ya no existe. Escrito como «ese aviso es el latido», nunca se vio funcionar.

Lo que sí se vio (medido el 09/10 a la noche sobre los registros desde el 03/10): el aviso de «terminó» de un **programa
en segundo plano**. De 163 que llegaron con la sesión recién callada, 88 la despertaron y el resto entró al turno que
seguía abierto (`absorbed_mid_turn`): ninguno se perdió. El de un subagente: 97 de 102. Por eso el latido es
`scripts/_latido.mjs` en segundo plano, y el control mira que su proceso esté vivo (`latidoVivo` en `horaGuard.mjs`),
no que exista un aviso. Espera 9 minutos y no 10: el tope de un comando de Bash es 10. La sesión sale de
`CLAUDE_CODE_SESSION_ID`, que Claude Code le da a cada comando (antes se adivinaba por el registro más nuevo y, con dos
sesiones abiertas, podía ser la de otra).

⚠ **No pude verificar** una noche entera con este latido: la prueba de punta a punta es la primera noche que Fak deje
una hora. Lo que sí está probado: el script, la señal, el control en las dos direcciones y que su aviso despierta.


---

# § techo-agentes.md

**Que tiene fuente y que no (Fak lo pregunto el 08/10 a la noche):** los PESOS salen de la tabla oficial
de precios. La ventana de 10 minutos y el 40 NO tienen fuente externa: la ventana la puso una sesion el
06/08 tras el incidente y el 40 son los 10 Sonnet de Fak en puntos. Nadie publico pesa por precio ni usa
ventana (investigacion R8, 08/10). Lo respaldado es medir contra el CUPO REAL: Claude Code expone a los
mods (`session.measure`) el % usado de las ventanas de 5 h y semanal, y `agent.spawn` deja aceptar,
cambiar o negar el modelo de cada subagente. **Fase 3: reemplazar la ventana por un mod que pese por
precio y frene por cupo real**; hasta entonces el presupuesto por puntos es la red de seguridad.

**Fase 3, instalada el 11/10/2026 (mod `presupuesto-agentes`, P33; convive con este guardian):** el mod vive en
`mods/presupuesto-agentes/` y carga en todas las sesiones NUEVAS desde una copia fuera del repo (marketplace `mods-casa`,
`~/.claude/mods-casa/`). La politica (`mods/presupuesto-agentes/hooks/presupuesto.mjs`, pura; test `__tests__/mods/presupuesto-agentes.test.mjs`)
replica este guardian y, desde el 16/10/2026, por el cupo real AVISA y no frena (Fak, 15/10: *«no me convence si no tiene evidencia; prefiero dejar un estandar que siempre pueda desplegar subagentes… si no encontraste datos, propone eliminarlo»*; lo medido en `casa_subagentes_costo.md`: el freno del 74 % del 13/10 no ahorro nada y se salteo con pases en 54 de 62 lanzamientos; es una estimacion del informe, no un conteo): al 60 y al 85 % de la SEMANA deja una linea tenue con el modelo y el peso del agente, y el agente sale igual; se mide una semana y, si hay daño, se propone un freno con el numero. **La ventana de 5 h por encima del 85 % SIGUE FRENANDO** (13 agentes cortados por el limite de sesion en el informe de costos; `trabajar-hasta-la-hora.md`, punto 5). Lo que SI frena, ademas: la ventana de 10 min por puntos y `maxTurns` en cada definicion, medido contra los turnos reales desde el 01/10 (el auditor del 16/10 encontro que 60 y 80 cortaban trabajo real): buscador 30 (p95 64, no se toca), explorador 300 (p95 247, max 580), investigador 400 (p95 311, max 870), amfe-healer 300, **auditor sin tope** (la auditoria final pasa siempre y escribe su informe pasados los 100 turnos; p95 232). El tope nativo `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=10` esta en el settings global, pero el auditor leyo en el binario 2.1.299 que **no corre en modo ultracode** (probable, no medido): con ultracode el que cuenta es el presupuesto del mod. La profundidad de lanzamiento queda en su default 3 por el ritual del viernes (ahi los Sonnet del equipo lanzan Haiku con una definicion propia; el `investigador` diario no lanza subagentes y el `explorador` no tiene `Agent`). `~/.claude/.agent-cupo-ok` saltea el freno de 5 h y apaga el aviso semanal. Falla abierto: si el mod falla,
la llamada pasa y decide el bash. Mientras conviven, bash corta primero (PreToolUse) y el mod ve lo que bash dejo pasar;
el bash se apaga ULTIMO, con dos dias de registro coherente en `~/.claude/mods-log/presupuesto-agentes.log` (cada
decision dice el cupo leido y de que carpeta salio la definicion). Instalar, ver el estado y volver atras:
`node scripts/_modsInstalar.mjs [--aplicar | --estado | --quitar --aplicar]`; detalle en `mods/presupuesto-agentes/README.md`.
El otro mod instalado, `tablero-casa` (HOY-25), solo muestra: cupo, agentes, hora de corte, API y noche, arriba del
cuadro donde se escribe.


Historia: techo de 5 (06/08/2026, dos incidentes de 21 y 40 agentes); 10 solo en Sonnet (Fak, 30/09);
**08/10/2026, Fak: "ese techo de 10 lo puse yo, ni siquiera se si es correcto... es absurdo que solo se
pueda usar Sonnet... eficiencia no significa siempre ahorrar tokens, significa trabajar de la mejor
forma posible: algunas tareas van a requerir Fable o muchos Opus"**. De ahi el presupuesto por costo:
Haiku para lo barato y muchos a la vez; Opus y Fable cuando el trabajo lo pide, descontando lo que valen.


## Lanzar o no, con los numeros de la casa (1, 2 y 4 medidos en `casa_subagentes_costo.md`, 15/10/2026, `.jsonl` desde el 06/10; 3 es la regla de Lydia Hallie; 5 es lo hecho el 16/10)

1. **El hilo principal es el 71 % del gasto** (≈ US$ 2.197 contra ≈ US$ 888 de 247 subagentes): un turno del principal cuesta ≈ US$ 0,20 porque relee ~469.000 tokens; un `buscador` Haiku entero, ≈ US$ 0,14. **Lanzar ahorra casi siempre cuando el que trabajaria es el principal** (leer mucho y devolver poco; varios frentes en paralelo).
2. **Lanzar cuesta mas cuando el agente es largo, repetido o se pierde**: 22 agentes de mas de US$ 10 sumaron US$ 292 (el 33 % del gasto de subagentes); 30 de 247 no terminaron bien (13 cortados por error de API, 11 parados por el principal o por Fak). De ahi `maxTurns` por definicion.
3. **Un subagente hace UNA tarea y devuelve** (Lydia Hallie, 10/10: el cache de un subagente vence a los 5 min; «in most cases you want your subagents to just run one task and hand back the result»); no se lo deja esperando mas trabajo.
4. **No se relanza lo ya contestado**: los incidentes de agosto (21 y 40 agentes) fueron preguntas que ya tenian respuesta.
5. **`explorador`, `investigador`, `auditor` y `amfe-healer` arrancan con `omitClaudeMd: true`** (16/10/2026): no cargan CLAUDE.md ni las reglas; medido ese dia: un `investigador` cargaba 98.000 a 118.000 tokens en su primer turno y un `buscador` (que ya lo tenia) 55.000; las 5 o 6 reglas que les valen van en su prompt y los hooks siguen corriendo. `buscador` y `auditor-cliente` ya lo tenian.
