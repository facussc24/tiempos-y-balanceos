# Mod propio para ver a los agentes: PENDIENTE (tanda 6, 17/10/2026)

**Estado: no se construye todavía.** Primero Fak prueba uno de la comunidad (su lista, punto 18): `pixel-agents`
(9.716 estrellas, MIT, anda en Windows) o `Claude-Code-Agent-Monitor` (1.078 estrellas, MIT, instalador de Windows).
**Si uno de los dos muestra lo que Fak quiere, este mod no se hace.** Instalar cualquiera de los dos cambia la PC
(los dos ponen hooks en `~/.claude/`, que valen para todas las sesiones) y lleva su sí. Este documento deja escrito
qué mostraría el mod propio si hace falta, para no volver a investigarlo.

Lo que pidió Fak (`Viernes 17.txt`): *"Pablo Gamboa me mostró una foto de cómo visualiza sus agentes… me imagino algo
mucho más 2D y más serio… capaz un mod en Claude Code, que se pueda minimizar"*. Y el 15/10: *"un panel donde vea en
tiempo real mis sesiones… cómo laburan los agentes, en qué, cuándo terminan"*. Las sesiones y las tareas de fondo ya
las muestra la página local del programita (`scripts/_programita.mjs`); este mod sería solo para los **subagentes de
una sesión**, dentro de la app.

## Qué mostraría

Un panel al costado del chat, en 2D y sobrio, con **un escritorio por tipo de agente de la casa** (los de
`techo-agentes.md`): `buscador`, `investigador`, `explorador`, `auditor` (y `auditor-cliente`, `amfe-healer` y
`revisor-pedido` solo cuando trabajan).

```
┌ Agentes de esta sesión ─────────────────────────── /agentes para cerrar ┐
│  ┌ buscador ───────────┐  ┌ investigador ───────┐  ┌ explorador ─────┐ │
│  │ ● En proceso        │  │ ○ Libre             │  │ ○ Libre         │ │
│  │ «ubicar el log …»   │  │                     │  │                 │ │
│  │ 12,4 mil tokens     │  │                     │  │                 │ │
│  │ 2 min 10 s          │  │                     │  │                 │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│  ┌ auditor ────────────┐                                                 │
│  │ ● En proceso · Opus │   clic en un escritorio = abrir su charla       │
│  │ «auditoría final …» │   «Volver» = vuelve a la charla principal       │
│  └─────────────────────┘                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Cartel por escritorio**: «Libre» cuando no hay un agente de ese tipo corriendo; «En proceso · <tarea corta>»
  cuando hay uno (con dos del mismo tipo, uno debajo del otro). La tarea corta es la `description` de la llamada.
- **Tokens y reloj** de cada agente corriendo (como las tarjetas de `claude-flightdeck`).
- **Se abre y se cierra** con un comando (`/agentes`), que funciona aunque Claude esté trabajando, y con Esc.
  Eso es el «que se pueda minimizar».
- **Abrir la charla del agente con un clic** en su escritorio, y volver a la principal con «Volver».
- En la terminal (sin dibujo) las mismas tarjetas en texto; el dibujo 2D va en la app.

## Con qué de la API (verificado en esta PC el 17/10/2026)

| Pieza | Llamada | Dónde se verificó |
|---|---|---|
| Panel que se abre / cierra | `$.ui.open({ id: 'agentes', title: 'Agentes', closeOnEscape: true })`, `$.ui.close({ id })`, dibujado por un hook `ui.render` sobre `{ component: 'Pane', requestId: 'agentes' }` | tipos de la 2.1.299 (skill `plugin-authoring`), `PaneOpenArgs.closeOnEscape` |
| Comando que corre a mitad de un turno | `$.command.register({ name: 'agentes', description, immediate: true })` y un hook `command.run` | mismos tipos (`immediate?: true`) |
| Grilla 2D | elemento `Svg` (solo en las superficies que lo dibujan: app de escritorio, VS Code, celular) y `Box` con color de fondo en la terminal | mismos tipos (`Svg: ElementConstructor<SvgProps>`) |
| Qué agentes hay y en qué estado | `$.agent.list()` → `{ id, description, type, status }`, con `status` = `running`, `completed`, `failed`, `killed`… | mismos tipos (`AgentInfo`) |
| La tarea, el tipo y el modelo al lanzarse | hook `agent.spawn` (solo mirar: `next(e)` sin cambiar nada) → `description`, `subagentType`, `model` | mismos tipos (`AgentSpawnInput`) |
| Abrir la charla de un agente | `$.ui.view({ agentId })`; `$.ui.view({})` vuelve | **No está en los tipos de la 2.1.299.** Está en la lista de cambios de la **2.1.300** que trae el programa de la terminal (2.1.301): *«Added `$.ui.view({ agentId })` for mods: shows an agent's transcript in the main view when you ask, and `$.ui.view({})` goes back»*. **La app de escritorio corre hoy con el motor 2.1.299, que no lo trae** (auditor 17/10): dentro de la app recién anda cuando la app actualice su motor. Los tipos se regeneran al cargar el mod: verificar ahí antes de usarlo |
| Refresco | `$.clock.every`, como el `tablero` | `mods/tablero/hooks/register.mjs` |

La vuelta a «Libre» sale de `$.agent.list()` (el `status` deja de ser `running`). El evento de fin de subagente
(`SubagentStop`) existe en los hooks de configuración; no se probó que llegue a un mod, y no hace falta.

## El molde y lo que se leyó antes

- **`claude-flightdeck`** (scasella, MIT, Claude Code 2.1.287 o más, README leído el 17/10): tarjetas por subagente con
  tarea, tipo, tokens, pasos y reloj; en la app, un eje de tiempo en SVG; `/flightdeck` y `/flightdeck close`. Usa
  `turn.step`, `tool.call`, `agent.spawn`, `session.measure` y `$.state`. **Solo observa**: según su README no hace red,
  no corre procesos, no lee ni escribe archivos y sus hooks nunca niegan ni cambian nada. No usa `$.agent.list` ni
  `$.ui.view`: eso es lo que el mod propio suma.
- **Mods oficiales de Anthropic** (`anthropics/claude-code`, carpeta `mods/`, leída el 17/10): `diff` (un panel al
  costado del chat, `/diff`: el patrón más parecido), `agents-md`, `sec-default`, `telemetry` y `types`. Cada mod es un
  plugin completo: `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.ts`, `types/` y `tests/`, probado
  con `claude plugin test`.
- **La skill `plugin-authoring`** de la sesión (2.1.299): dónde se escribe un mod de desarrollo, cómo se cargan los
  tipos y que escribir en su carpeta le abre a Fak la pregunta de recarga en caliente (en esta tanda no se escribió
  nada ahí).
- Los dos mods propios ya validan y pasan sus pruebas: `docs/auditorias/TANDA6_MODS_VALIDATE_TEST_2026-10-17.md`.

## Cómo se haría (si hace falta)

- **Tamaño mediano** (`codigo-madre.md`): plan corto, `mods/agentes/` con la forma de los oficiales, prueba con
  `claude-code/testing` (dos agentes de prueba: aparecen «En proceso» y vuelven a «Libre» al terminar; el clic llama a
  `$.ui.view` con el id correcto), `claude plugin validate`, auditor Opus, instalación con `scripts/_modsInstalar.mjs`.
- **Solo mira**: ningún hook niega ni cambia una llamada (un mod puede aprobar llamadas que los guardianes frenarían:
  este no toca `tool.call` ni `agent.spawn` más allá de leerlos). No escribe archivos ni usa red.
- **No choca con el tablero**: el tablero usa la banda de arriba del cuadro de escritura (`AbovePrompt`); este usa un
  panel (`Pane`) propio.
- **Límite que no cambia**: un mod ve solo los subagentes de la sesión donde está cargado. Las sesiones hijas se ven en
  la página del programita.

## Qué necesita de Fak

El sí para instalar y probar uno de los dos de la comunidad (punto 18 de su lista). La recomendación es
`Claude-Code-Agent-Monitor`: es lo más parecido a lo que describió («2D y serio», estados en columnas) y tiene
instalador de Windows; `pixel-agents` es el más popular pero es una oficina pixel-art, no «serio». Los dos ponen hooks
en `~/.claude/`; antes de instalarlos se lee qué escriben ahí.
