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
sesión larga mide 3-8 MB (medido 10/10: 3,2 · 4,6 · 8,5 MB; el «cientos de MB» que decía este renglón no tenía medición); el mismo trabajo se repite en cada turno, pero cuánto pesa frente a las otras fases del Stop no está medido (§6).

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

## 6. Revisión por la API (Opus, 10/10/2026 20:42, US$0,3; informe completo en `.sgc-cache/sesion-2026-10-10/API_P9P10_revision_opus.md`)

Lo que cambia del plan de arriba. **Lo primero es un hueco de evidencia**: el §1 dice «cientos de MB» y un
registro real mide 3-8 MB (medido 10/10: 3,2 MB la hija 2, 4,6 MB la hija 3, 8,5 MB el orquestador). Leer 8 MB con
el prefiltro de `pasada()` debería tardar del orden de un segundo, no 18 s de p90 ni 234 s de máximo: en el mismo
Stop corren el detector de firma (python, tope 90 s), `git status`, el barrido de `exports/`, `avisoParaCierre`
(puede releer el registro) y el arranque bash→node. **Sin tiempos por fase no se sabe si P9 ataca el 90 % del
costo o el 10 %: la medición (§6.4) va ANTES que el código.**

### 6.1 Huecos reales del cierre incremental (cada uno con su entrada y su arreglo)

- **H1 estado incompleto**: la lista del §1 omite `ultimoMensajeFakTs`, `ejemplo` y `sinVentana`;
  `documentosDelTurno` hace `if (!ts) return []`, así que el chequeo 9 (firma IA) quedaría ciego SIEMPRE. Arreglo:
  serializar `st` entero con un serializador genérico y un test que falle si `Object.keys` del `st` inicial
  (anidados incluidos) tiene una clave sin tratamiento.
- **H2 identidad `miradasPorId` ↔ `miradas`**: `cerrarMiradas` usa `indexOf(m)` y muta el mismo objeto; tras JSON
  son copias. Entrada: un Read de un subagente que vuelve con error después del Stop → la pasada completa borra
  la mirada, la incremental no la encuentra (−1) y el chequeo 4 da verde con un archivo nunca abierto. Arreglo:
  ids estables y rehidratar referencias; el test de ida y vuelta sigue pasando líneas, no hace `deepEqual`.
- **H3 offset en caracteres y línea a medio escribir**: tildes con `linea.length`; el Stop lee mientras Claude
  Code escribe la última línea, `JSON.parse` falla, el `catch` la saltea y el offset avanza: el tool_use se pierde
  para siempre. Arreglo: leer como Buffer, cortar en el último `0x0A`, `leido` en BYTES; una línea sin `\n` no se
  procesa.
- **H4 `VERSION_ESTADO` manual**: la pasada depende de cuatro canones; un verbo nuevo en `escrituras` y el estado
  viejo conserva la interpretación vieja. Arreglo: la versión es un hash del fuente del módulo, sus imports y los
  `.data.json`.
- **H5 reescritura que no achica**: «más chico que `leido`» no ve un fork, un `--resume` ni una compactación
  regenerada más larga. Arreglo: huella con el hash de los primeros 4 KB y de los 4 KB que terminan en `leido`;
  si no coincide, pasada completa. Clave del estado: `transcript_path` + `session_id`.
- **H6 el orden principal/subagentes cambia la semántica**: la completa procesa el principal entero y después los
  subagentes; la incremental los intercala (`seq`, `escritoEn`, `orden` sin timestamp, y las miradas de los
  subagentes, que hoy nunca se resetean, se resetearían). El test de igualdad va a fallar en el primer corte y la
  tentación va a ser una lista blanca. Arreglo: **primero se decide la semántica correcta (seq por archivo) y se
  cambia en la pasada completa, en un commit aparte con su evidencia; recién después, igualdad estricta.**
- **H7 subagente que falla a mitad de lectura**: el `try/catch` deja `st` mutado (doble o pérdida). Arreglo:
  avanzar `leido` línea por línea y persistir una sola vez al final.
- **H8 (robustez)**: `relevarTranscript` agrega `[ini, Infinity]` a `st.ventanas`; guardado después, ventanas
  eternas duplicadas en cada Stop → guardar antes del post-proceso o sobre una copia.
- **H9 (robustez)**: en Windows, matar bash por tope no mata al node hijo; el huérfano escribe tarde → `.tmp` +
  `rename` con reintento por EPERM y compare-and-set (no pisar un `leido` mayor).
- **H10 (robustez)**: 600 miradas × 8.000 caracteres ≈ 5 MB de JSON, más que el registro: medir antes de dar la
  ganancia por hecha.
- **Está bien**: invalidar por bytes y huella (no por mtime); un tool_use sin resultado queda en `abiertas`.

### 6.2 El test de igualdad: cómo no es «el mismo código dos veces»

- **Oráculo**: `relevarTranscript` del commit base fijado por SHA (`git show SHA:scripts/_lib/cierreGuard.mjs` a
  un temporal), NO el `--completo` del módulo nuevo (comparte `pasada()`). **El test lo escribe el auditor, no la
  hija que implementa** (LECCIONES: lo que afloja un control lo prueba OTRO).
- **Corpus**: todos los registros del mes, más los seleccionados por contenido (subagentes, `<task-notification>`,
  `isCompactSummary`, `queued_command`, Read con `is_error`, `exports/` y documentos).
- **Cortes**: los Stops reales de cada sesión (la distribución de producción) y forzados: a mitad de línea en un
  byte cualquiera; entre un tool_use y su tool_result de un subagente; justo después de una compactación; un
  subagente nuevo entre dos cortes; un cambio de canon entre cortes (tiene que invalidar).
- **Qué se compara**: `relevarTranscript` campo por campo y `decidir` con el `last_assistant_message` real de ese
  corte: mismo `ok` y mismo `titulo`. Sin tolerancias; lo que difiera a propósito se arregla en el oráculo con
  commit y evidencia propios.
- **Que no esté ciego**: mutaciones obligatorias (no serializar `ultimoMensajeFakTs`, `leido` en caracteres,
  saltear la última línea, perder la identidad de las miradas): cada una tiene que hacer fallar el test. Por
  chequeo (2, 3, 4, 6, 7, 8, 9) contar en cuántos cortes el oráculo bloquea; 0 = falta caso. **En CI los
  registros no existen: el test dice SALTEADO en voz alta, no «pasó»**; el gate es la corrida local con su salida
  pegada.

### 6.3 Fail-safe (hoy hay dos agujeros: `.catch(() => process.exit(0))` y el `{fuera:false}` sin registro)

Estado ausente, corrupto o con huella/versión distinta → pasada completa con presupuesto propio (~60 % del tope
del hook); el corrupto se renombra `.corrupto`. Si la completa no termina en el presupuesto: guarda el progreso
(atómico, alineado a líneas), corre igual los chequeos sin registro (inglés, permiso, informe) y, si ninguno
bloquea, sale con exit 2 UNA vez: «CIERRE-GUARD: no pude leer el registro entero (X MB en Y s); el próximo cierre
sigue desde el byte Z» (`stop_hook_active` evita el loop). «Más viejo que el registro» es el caso normal. Todo
deja una línea en el log y el chequeo diario la reporta. **Bloquear una vez cuesta un turno; quedar ciego cuesta lo
que ya costó.**

### 6.4 Tiempo: el número que decide

- **C0, antes de cambiar lógica**: el `.sh` escribe inicio y fin en `<tmp>/claude-hooks-tiempos.jsonl` (un inicio
  sin fin = hook matado por el tope); dentro de node, `performance.now()` por fase (arranque, relevar con bytes
  del registro y bytes leídos, firma, git, exports, tanda). Mínimo 5 días hábiles. **Si «relevar» no es la fase
  dominante, P9 no va como está escrito.**
- **Después**: misma instrumentación, mismo hook, mismo período, sin mezclar con P10 ni P11.
- **Decide**: hooks matados **0** (es lo que produce la ceguera); fase relevar p90 < 300 ms; cierre-guard total
  máximo < 10 s.

### 6.5 Despliegue con vuelta atrás

| Commit | Qué hace |
|---|---|
| C0 | solo medición (wrapper que registra tiempos) |
| C1 | módulo de estado y test; la pasada completa intacta (es el oráculo y la red) |
| C2 | **modo sombra**: decide la completa; el incremental corre al lado y registra si difiere |
| C3 | el incremental decide, después de ~200 Stops reales con subagentes y 0 diferencias |

Apagado en 10 s: `touch "$TEMP/claude-cierre-guard/OFF"` (el hook lee el flag en cada corrida; mientras exista,
cada Stop lo registra y el chequeo diario lo reporta). Vuelta lenta: `git revert` de C3. P9 no toca `settings.json`.
Prueba real: tras C3, el primer Stop real deja `modo=incremental` en el log con la misma decisión que dio la
sombra; sin esa línea, no está implementado (`mejora-implementada.md`).

### 6.6 Lo que cambia en el §5

El orden pasa a ser **C0 (medición, chico, hoy) → H6 (semántica de la pasada completa, mediano, commit aparte) →
C1/C2/C3**. P9 ya no es «1 día»: C2 necesita ~200 Stops reales, que son varios días de uso. La hija Fable arranca
por C0 y H6; C1-C3 se escriben recién con los tiempos por fase en la mano.
