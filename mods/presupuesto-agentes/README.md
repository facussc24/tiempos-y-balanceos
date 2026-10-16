# presupuesto-agentes (P33)

Mod de Claude Code (probado con la 2.1.293, Windows 11) que hace en `agent.spawn` lo mismo que `~/.claude/hooks/agentes-guard.sh` (regla `.claude/rules/techo-agentes.md`) y una cosa más: mira el **cupo real** del plan.

- Pesa cada subagente por costo (haiku 1, sonnet 4, opus 8, fable 20) y suma la ventana de 10 min (40 puntos).
- **Cupo real**: con la ventana de 5 h por encima de 85 % no sale ningún subagente nuevo (sigue frenando: 13 agentes cortados por el límite de sesión en el informe de costos). La **semanal, desde el 16/10/2026, AVISA al 60 y al 85 % y no frena** (decisión de Fak del 15/10: sin evidencia no hay freno por cupo semanal; el freno del 74 % del 13/10 no ahorró nada): el agente sale, queda una línea tenue y el registro lleva `· AVISO …`.
- La auditoría final (`auditor`, `auditor-cliente`) no descuenta y pasa también si su definición no se encuentra o no se puede leer. Se niega, igual que en el guardián bash, en tres casos: si la llamada pide un `model` que no es opus, si la definición encontrada dice otro modelo o esfuerzo, y si es un `fork`.
- **Falla abierto** (`FALLA_CERRADA = false` en `hooks/register.js`): si el hook falla o tarda más de 10 s, la llamada pasa, decide el guardián bash (que sigue puesto) y queda un renglón `agent.spawn ERROR` en el registro. Si las definiciones no se pudieron leer (`def=error`) tampoco se niega por «sin definición».
- En `turn.step`, un subagente que pida `effort: max` se rebaja a `xhigh`.

## Archivos

- Política pura: `hooks/presupuesto.mjs` (sin `$`). Test con vitest: `__tests__/mods/presupuesto-agentes.test.mjs`.
- Cáscara: `hooks/register.js` (`session.start`, `agent.spawn`, `session.measure`, `turn.step`). Test con el motor de Claude Code: `tests/presupuesto-agentes.test.ts` (`claude plugin test mods/presupuesto-agentes`; no corre en el CI, lo corre el instalador).
- Libro: `$.store`, clave `lanzamientos`. Se lee, se decide y se escribe de a uno dentro de la sesión (varias llamadas a Agent en un mismo mensaje no se pisan). Entre dos sesiones a la vez todavía puede pisarse: ahí cubre el bash.
- Registro: `~/.claude/mods-log/presupuesto-agentes.log` (1000 líneas). Cada decisión dice el cupo leído y `def=<carpeta>` donde encontró la definición (`def=sin` = no está; `def=error` = no se pudo leer). Cada arranque de sesión dice `raiz=` (la carpeta del proyecto que resolvió) y `mod=` (la carpeta desde la que cargó). Lo lee el tablero; el formato lo cruza `__tests__/mods/registroDelMod.test.mjs`.
- Las definiciones se buscan en `<raíz del proyecto de la sesión>/.claude/agents` y en `~/.claude/agents`.

## Escapes (los escribe la sesión solo con el pedido textual de Fak; valen 12 h)

| Archivo | Qué hace |
|---|---|
| `~/.claude/.agent-limit` | cambia el techo de la ventana (N Sonnet); `0` apaga el conteo, no el cupo real |
| `~/.claude/.agent-opus-ok` | Opus y Fable descuentan como Sonnet |
| `~/.claude/.agent-cupo-ok` | saltea el freno de la ventana de 5 h y apaga el aviso semanal |
| `~/.claude/.agent-builtin-ok` | con el id de la sesión adentro: deja pasar un built-in con `model: sonnet` |

Vencidos se ignoran, no se borran. `.workflow-ok` no aplica: Workflow no pasa por `agent.spawn`. Desde el 16/10/2026 Workflow está habilitada (ultracode, pedido de Fak): sus agentes pasan por `agent.spawn` como cualquier subagente.

## Instalar, ver el estado y volver atrás

```bash
node scripts/_modsInstalar.mjs --aplicar          # valida, prueba, copia a ~/.claude/mods-casa, instala y verifica
node scripts/_modsInstalar.mjs --estado           # instalado o no, las dos copias al día o no, últimas líneas del registro
node scripts/_modsInstalar.mjs --quitar --aplicar # desinstala los mods (lo verifica en la lista) y saca el marketplace (eso todavía no lo verifica: mirar con `claude plugin marketplace list`)
```

Las sesiones nuevas lo toman solas; una ya abierta, con `/reload-plugins`. Apagar uno solo: `claude plugin disable presupuesto-agentes@mods-casa` y mirar con `claude plugin list`.

Hay **dos copias** fuera del repo y el instalador mantiene las dos iguales a `mods/`: la del marketplace (`~/.claude/mods-casa/<mod>/`) y la que `claude plugin install` deja en `~/.claude/plugins/cache/mods-casa/<mod>/<versión>/` (la que nombra `claude plugin list`). Medido el 11/10/2026 con el `mod=` del registro: una sesión de la app de escritorio cargó la de la caché; el `claude` de la terminal, la del marketplace.

## Convivencia con el guardián bash

Los dos deciden: bash corta primero (PreToolUse) y el mod ve lo que bash dejó pasar. Dos cosas que eso trae:
- Lo que el mod niega, el bash ya lo anotó en su ventana: varios intentos negados por cupo dejan al bash en su techo por 10 minutos.
- El bash se retira recién con dos días de registro coherente (las líneas `agent.spawn` del registro coinciden con `~/.claude/.agent-spawns.log`). El día que se retire hay que volver a mirar dos decisiones que hoy descansan en él: `FALLA_CERRADA` y que el auditor pase sin definición.

## Medido en una sesión real (11/10/2026, `.sgc-cache/auditorias/MODS_primera_sesion_2026-10-11.md`)

- El mod cargó en una sesión nueva de la app de escritorio y decidió dos lanzamientos: `buscador` (peso 1, definición en `~/.claude/agents`) y `auditor` (peso 0, definición en `.claude/agents` del repo). El registro coincidió con el del bash.
- `rateLimits` trae `five_hour` y `seven_day`, nada más (una lectura).
- `e.surface` de `session.start` llegó vacío (el registro dice `surface=null`).

## Sin verificar

- Que `agent.spawn` traiga `effort`: los tipos no lo declaran; por eso la rebaja de `max` está en `turn.step`.
- Un lanzamiento negado por cupo real en una sesión de verdad (la semana estaba en 58 %): está probado con el motor de pruebas, no en vivo.
