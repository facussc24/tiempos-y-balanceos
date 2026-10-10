# Plan P9 + P10 — El cierre lee el registro de a tramos, y los hooks de cada mensaje y de cada cierre corren en un solo node

Escrito el 10/10/2026 por el orquestador (Fable 5.1). Fak dijo SÍ a los dos el 09/10 16:55 (cola P9 y P10, con revisor
independiente: `codigo-madre.md`, cambio grande). Este es el plan para que una hija (Fable, por ser arquitectura del
sistema Claude) lo implemente; nada de esto está hecho.

## 0. Qué duele hoy (medido en R6, `.sgc-cache/investigacion-2026-10-08/R6_hooks_frenos_y_costo.md`)

| Hook | Cuándo corre | Costo medido (1.689 turnos del mes) |
|---|---|---|
| `cierre-guard` (Stop) | cada vez que termino un turno | p50 3,0 s · p90 18,2 s · **máximo 234 s** · **3,9 h en el mes esperando** |
| `dev-server-guard` (Stop) | idem | p50 1,4 s · p90 10,9 s · 4 de 4 falsos en septiembre (P11: Fak dijo sacarlo) |
| `hora-guard` (Stop) | idem | p50 0,9 s · p90 3,4 s |
| 4 hooks de UserPromptSubmit (`caracteristicas-especiales-prompt`, `correccion-guard`, `explicar-prompt`, `hora-prompt`) | cada mensaje de Fak | 2.800 a 3.786 ms cada uno; **8 procesos** (4 bash + 4 node) por mensaje; 62 cancelados tras 31-38 s |

Por qué el cierre tarda: `relevarTranscript()` (`scripts/_lib/cierreGuard.mjs` 1089) **recorre el registro ENTERO de la
sesión y los de sus subagentes en cada Stop** (`pasada()`, 982: `createReadStream` + `readline` línea por línea). Una
sesión larga tiene cientos de MB; el mismo trabajo se repite en cada turno.

## 1. P9 — cierre incremental (el de mayor retorno)

**Idea** (la misma que ya usa `correccionGuard.mjs`, `leerEntregas()` 237: lee desde un byte, solo líneas completas,
tramos de 4 MB, guarda `leido`): el cierre guarda por sesión, en TEMP (`<tmp>/claude-cierre-guard/<session_id>.json`),
**hasta qué byte leyó y el estado acumulado** (`st` de `pasada`), y en el Stop siguiente lee solo lo nuevo.

**Qué hay que serializar** (lo que `pasada()` acumula): `tocados` (Set), `ventanas`, `abiertas` (Map de tool_use sin
resultado: tiene que sobrevivir entre Stops, porque el resultado llega después), `ent` (Map de entregables), `miradas`
+ `miradasPorId`, `bg` (segundo plano sin aviso de fin), `explicar`, `mails`, `sis` (archivos del sistema, pruebas,
`escrito`/`probado`), `ultimoMensajeFak`, `turnoTs`, `inicio`, `seq`, `huboComando`, `huboOpaco`, `encargo`. Sets → listas,
Maps → listas de pares; una función `aEstadoGuardable(st)` y su inversa, con test de ida y vuelta.

**Subagentes**: los registros `<sesión>/subagents/*.jsonl` también de a tramos: `leido` por archivo, en el mismo estado.

**Invalidación** (sin esto el caché miente): si el archivo es más chico que `leido` (compactación, otra sesión con el
mismo id) → se vuelve de cero; si cambia `VERSION_ESTADO` del módulo → de cero; si el JSON del estado no parsea → de
cero. Y un `--completo` que ignora el caché, para comparar.

**La prueba que decide** (lo que construyo lo prueba algo que no sea yo): un test que toma **registros reales** de
`~/.claude/projects/C--Dev-BarackMercosul/` (los más largos: la madrugada del 10/10 con 1.077 mensajes, la del 09/10
noche con 1.880), los corta en 10 puntos al azar, corre el incremental tramo a tramo y compara el resultado de
`relevarTranscript` contra la pasada completa: **tienen que ser iguales campo por campo**. Más `cierreGuard.test.mjs`
(155 hoy) sin cambios. Y `node scripts/_cierreSesion.mjs` corre una vez por día el `--completo` contra el caché y avisa si
difieren (red por si un caso real se escapa del test).

**Ganancia esperada**: el Stop pasa de leer todo a leer lo del último turno; p50 bajo el segundo, el máximo acotado por
lo que escribió ese turno. Se mide antes y después con `durationMs` de los transcripts (R6 lo hizo así).

## 2. P10 — un solo node por mensaje y un solo node por cierre

**UserPromptSubmit**: un hook `prompt-hooks.sh` → `node scripts/_lib/promptHooks.mjs`, que lee el payload UNA vez y llama
a las cuatro funciones puras en orden (las de `caracteristicasEspecialesPrompt` —hoy inline en el `.sh`, pasa a módulo—,
`correccionGuard.atender`, `explicarGuard`, `horaGuard --hook`), junta los `additionalContext` (cada uno con su marca
`[CORRECCION-GUARD]`, `[TRABAJAR-HASTA]`, …) y escribe un solo JSON. De 8 procesos a 2.

**Stop**: `stop-hooks.sh` → `node scripts/_lib/stopHooks.mjs`: corre `cierreGuard.decidir` y después `horaGuard --stop`;
el código de salida es el más alto de los dos y los mensajes se concatenan. `dev-server-guard` **se saca en el mismo
cambio** (P11, con el sí de Fak).

**Lo que NO cambia**: `_dispatcher.sh` (PreToolUse) queda como está (P31 es otro cambio); cada módulo conserva sus
tests; `_probarMejora.mjs` sigue corriendo lo que está en `settings.json`, así que mide el hook fusionado (sus
`--espera` buscan el texto, y el texto es el mismo). Un test nuevo: sobre 20 mensajes reales de Fak, la salida del hook
fusionado = la concatenación de las cuatro salidas separadas. `hooksTienenTest`: los dos hooks nuevos con su fila; los
seis viejos se **borran** (borrar archivos pide el sí de Fak: va en la síntesis).

## 3. Cómo se despliega sin romper las sesiones abiertas

Los hooks corren desde el checkout principal y **una sesión abierta toma un hook nuevo en segundos**
(`mejora-implementada.md`): un error acá rompe TODAS las sesiones a la vez. Por eso:

1. Los módulos nuevos (`promptHooks.mjs`, `stopHooks.mjs`, el caché del cierre) se escriben y prueban **sin cablear**.
2. El cableado de `settings.json` cambia en UN commit, en un momento sin otras sesiones trabajando, y en el minuto
   siguiente corre `node scripts/_probarMejora.mjs --mensaje "<mensaje real>"` y un cierre de prueba. Vuelta atrás: `git
   revert` de ese commit.
3. Auditor Opus sobre los módulos antes del cableado; **revisor independiente (Fable)** sobre el conjunto.

## 4. Lo que necesita a Fak

- OK a borrar los seis `.sh` viejos cuando el cableado nuevo esté probado (si no, quedan huérfanos listados).
- Nada más: los dos SÍ ya están.

## 5. Orden y tamaño

P9 primero (es independiente y es el 90 % del tiempo perdido); P10 después, sobre el P9 ya probado. Una hija Fable por
cambio, en sesión aparte, cada una con auditor Opus; el revisor Fable al final de los dos. Tiempo: 1 día cada uno.
