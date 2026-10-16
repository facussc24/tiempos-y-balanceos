# Subagentes: presupuesto por costo (40 puntos cada 10 min); el modelo se elige por tarea; la auditoria final en Opus

**El techo ya no es "10 agentes": es un PRESUPUESTO DE 40 PUNTOS cada 10 minutos, y cada modelo pesa
segun lo que cuesta** (tabla oficial de precios de Anthropic, 08/10/2026): **haiku 1 · sonnet 4 · opus 8 ·
fable 20**. Diez Sonnet siguen valiendo lo mismo que antes (40); con lo mismo entran 40 busquedas en
Haiku, 5 Opus o 2 Fable. El esfuerzo es `xhigh` (el anteultimo; `max` nunca se pide). La tool
`Workflow` estuvo deshabilitada del 06/08 al 16/10/2026; **Fak la prendio el 16/10** («Fable 5.1 ultracode de una… si o si») y queda prendida: sus agentes pasan por el mismo presupuesto.

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

Esto no vive solo aca: esta enforced en `~/.claude/settings.json` (hasta el 16/10 `disableWorkflows: true`; desde ese dia sacado y `workflowKeywordTriggerEnabled: true`,
`workflowKeywordTriggerEnabled: false`, `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5-5` como default,
sin `_FORCE`) y en el hook `~/.claude/hooks/agentes-guard.sh` (PreToolUse, matcher `Agent|Task|Workflow`;
copia identica en `.claude/hooks/`), que suma los puntos de la ventana de 10 min en
`~/.claude/.agent-spawns.log` (`<epoch> <tool> <peso>`), devuelve exit 2 cuando la llamada no entra,
exige una definicion propia, rechaza `effort: max` en la llamada y deja pasar la auditoria final sin
descontar. Aplica a todos los proyectos de esta PC, no solo Barack.

## Que modelo para que trabajo (la llamada lo elige con `model:`)

| Trabajo | Agente / modelo | Esfuerzo | Peso | Cuantos entran en 40 |
|---|---|---|---|---|
| Buscar, listar, leer, extraer un dato, contar, verificar un formato, traer una cita | **`buscador`** (haiku) | medium | 1 | 40 |
| Escribir, programar, ensayar, analizar UNA fuente, investigar un frente | `investigador` / `explorador` (sonnet) | xhigh | 4 | 10 |
| Criterio, cruzar fuentes, decidir, auditar contenido, sintetizar varios informes | `investigador` con `model: opus` | xhigh | 8 | 5 |
| Revisor independiente de un cambio grande | `investigador` con `model: fable` | xhigh | 20 | 2 |
| Auditoria final de una tarea de codigo (`auditor`, `auditor-cliente`) | opus (lo exige la definicion) | xhigh | 0 | siempre |

La llamada puede bajar el esfuerzo con `effort: low|medium|high`. **La auditoria final la hace Opus,
no Sonnet** (Fak, 30/09/2026) y no descuenta: es obligatoria.

**El advisor SI existe en Claude Code** (corregido el 08/10/2026 a la noche; hasta esa hora esta regla
decia que no): `/advisor <modelo>`, `advisorModel` en `~/.claude/settings.json` o `claude --advisor`.
Es experimental, anda en la app de escritorio desde la v2.1.260 (esta PC: 2.1.293), y **los subagentes
lo heredan**: un `investigador` en Sonnet consulta a Opus antes de decidir un camino, cuando un error se
repite y antes de dar algo por terminado (doc: https://code.claude.com/docs/en/advisor). Desde el
08/10/2026 `advisorModel: "opus"` queda puesto en el settings de Fak: es el "modelo barato ejecuta,
modelo caro asesora" que el pidio, adentro de Claude Code. Gasta cupo del plan (Fable de asesor iria a
creditos de uso y pide un consentimiento: no se activa). `/advisor off` lo apaga; el guardian no lo
cuenta porque no es una llamada a Agent. Cuando la sesion principal es Opus 5.5, el asesor Opus es una
segunda opinion; cuando es Fable, Claude Code no le aplica asesor Opus (solo Fable 5.1).

## Que agente se lanza

| subagent_type | Para que | Donde vive | Definicion |
|---|---|---|---|
| `buscador` | busqueda barata de solo lectura (08/10/2026) | `~/.claude/agents/` | haiku + medium |
| `investigador` | trabajo general con todas las herramientas (reemplaza a general-purpose) | `~/.claude/agents/` | sonnet + xhigh |
| `explorador` | barrido de solo lectura (reemplaza a Explore) | `~/.claude/agents/` | sonnet + xhigh |
| `amfe-healer` | del proyecto | `.claude/agents/` | sonnet + xhigh |
| `auditor`, `auditor-cliente` | **la auditoria final: en OPUS** | `.claude/agents/` | opus + xhigh |

Una definicion comun dice sonnet+xhigh o haiku+medium/high/xhigh; Opus y Fable no van en una
definicion: se piden en la llamada y descuentan su peso. Los built-in (`general-purpose`, `Explore`,
`Plan`, `claude`...) no dejan fijar el esfuerzo y `fork` corre en el modelo de la sesion: el hook los
rechaza. Un agente recien creado en `~/.claude/agents` puede tardar en aparecer en la sesion donde se
crea (el 30/09 aparecio a los ~40 min); mientras tanto existe el pase `~/.claude/.agent-builtin-ok` (el
session_id adentro: solo esa sesion, solo si corre en xhigh, y con `model: "sonnet"` explicito en la
llamada). Lo escribo yo, lo digo, y lo retiro al cerrar la sesion.

**Por que existe el techo:** dos incidentes en agosto de 2026, con tres dias de diferencia (21 y
despues 40 subagentes sobre preguntas que ya estaban respondidas; el segundo dejo a Fak 4 horas sin
poder trabajar). La historia, las citas de Fak y los tres errores que los explican: memoria
`techo_agentes_los_dos_incidentes_2026-08`. Lo que mide si el presupuesto esta bien calibrado:
`node scripts/_tokens.mjs` (turnos por modelo; desde el 08/10 cuenta cada mensaje una sola vez).

## Lanzar o no, con los numeros de la casa (1, 2 y 4 medidos en `casa_subagentes_costo.md`, 15/10/2026, `.jsonl` desde el 06/10; 3 es la regla de Lydia Hallie; 5 es lo hecho el 16/10)

1. **El hilo principal es el 71 % del gasto** (≈ US$ 2.197 contra ≈ US$ 888 de 247 subagentes): un turno del principal cuesta ≈ US$ 0,20 porque relee ~469.000 tokens; un `buscador` Haiku entero, ≈ US$ 0,14. **Lanzar ahorra casi siempre cuando el que trabajaria es el principal** (leer mucho y devolver poco; varios frentes en paralelo).
2. **Lanzar cuesta mas cuando el agente es largo, repetido o se pierde**: 22 agentes de mas de US$ 10 sumaron US$ 292 (el 33 % del gasto de subagentes); 30 de 247 no terminaron bien (13 cortados por error de API, 11 parados por el principal o por Fak). De ahi `maxTurns` por definicion.
3. **Un subagente hace UNA tarea y devuelve** (Lydia Hallie, 10/10: el cache de un subagente vence a los 5 min; «in most cases you want your subagents to just run one task and hand back the result»); no se lo deja esperando mas trabajo.
4. **No se relanza lo ya contestado**: los incidentes de agosto (21 y 40 agentes) fueron preguntas que ya tenian respuesta.
5. **`explorador`, `investigador`, `auditor` y `amfe-healer` arrancan con `omitClaudeMd: true`** (16/10/2026): no cargan CLAUDE.md ni las reglas; medido ese dia: un `investigador` cargaba 98.000 a 118.000 tokens en su primer turno y un `buscador` (que ya lo tenia) 55.000; las 5 o 6 reglas que les valen van en su prompt y los hooks siguen corriendo. `buscador` y `auditor-cliente` ya lo tenian.

## Como decidir, antes de pensar en un agente

1. **Se DONDE mirar?** -> leerlo yo. Grep/Read/query directa. Casi siempre gana.
2. **No se donde mirar, y son fuentes independientes?** -> `buscador` (haiku) para ubicar y extraer;
   `investigador` (sonnet) cuando hay que escribir o analizar; Opus solo para el que decide o cruza.
   Cada uno con su fuente, contados y explicitos. **Si le mando a un Sonnet un pedido de busqueda** (las
   palabras de la primera fila de la tabla y ninguna de la segunda), el guardian lo deja pasar y me avisa
   «¿esto es buscar o decidir?»: no relanzo esa llamada (ya desconto), pero la proxima igual va en `buscador`.
3. **Una tarea grande que pide Fable o varios Opus** (una investigacion, una auditoria de fondo): se
   hace, descontando lo que vale. Si el presupuesto no alcanza, se le dice a Fak el numero real
   (`puntos que hacen falta`) y para que; con su pedido textual se escribe el escape.
4. **Antes de lanzar, un renglon en el chat: cuales, con que modelo y por que** (Fak, 09/10/2026, 08:06 y 08:23:
   *"¿que agentes vas a usar para esta tarea? ¿podes decirme antes de hacerlo?"*). Es INFORMAR, no preguntar: no se
   espera un si. Medido el 09/10: desde el 03/10 se lanzaron 143 Sonnet, 156 Opus, 9 Haiku y 6 Fable; 89 de los
   Sonnet declaraban solo lectura; cuantos eran busquedas puras no se separo a mano. Desde P5 (10/10) el guardian
   anota cada Sonnet con pedido de busqueda en `~/.claude/.agent-busquedas.log` (`<epoch> <agente> <palabra>`):
   ese registro es el numero, se lee cuando haya una semana de uso.

**Nunca reintentar una llamada bloqueada por el guard.** Si el hook corta, el trabajo se hace a mano
y se le avisa a Fak que se llego al techo.

## Escapes (los escribo yo solo cuando Fak lo pide textual, y lo digo)

```bash
echo 15 > ~/.claude/.agent-limit    # 15 Sonnet = 60 puntos cada 10 min (vale 12 h, despues vuelve a 40 solo)
echo 0 > ~/.claude/.agent-limit     # apaga el CONTEO (idem, 12 h); la regla de esfuerzo sigue
touch ~/.claude/.workflow-ok        # habilitaba UN Workflow hasta el 16/10 (hoy Workflow esta prendida)
touch ~/.claude/.agent-opus-ok      # 12 h: Opus y Fable descuentan como Sonnet (4)
touch ~/.claude/.agent-cupo-ok      # 12 h: saltea el freno de la ventana de 5 h (> 85 %) y apaga el aviso semanal
```

Fak no corre comandos: cuando lo pide ("usa mas agentes", "no me importa gastar tokens", "usa mas
Opus", "lo que sea necesario") lo escribo yo y lo digo. Sin esa frase suya, no se toca (10/09/2026).
**Si Fak repite un pedido que le negue por una regla suya, la segunda vez no se le vuelve a explicar la
regla: se le nombra el cambio exacto y se hace** (el 01/10 tuvo que pedirlo cuatro veces). Ejemplo:
08/10/2026 a la noche, `echo 20 > ~/.claude/.agent-limit` (80 puntos) para la investigacion grande que
pidio ("desplegando agentes, equipos de agentes, lo que sea necesario").

Workflow se reactivo el 16/10/2026 sacando `disableWorkflows` de `~/.claude/settings.json` (respaldo `settings.json.antes-ultracode-2026-10-16`). Para apagarla de nuevo: volver a poner `"disableWorkflows": true`.
