# Auditoría — tanda 5 (la API con créditos), rama `claude/api-tanda5-1017` — 17/10/2026

Auditor automático, solo lectura. **Punta auditada: `886d0850`**: los 7 commits `1fe54110..886d0850`
(`git diff main...HEAD`, base `6fadd6a5`). Volví a mirarla antes de cerrar y sigue igual.

No hice ninguna llamada paga. Todo se probó con clientes falsos, desde el worktree (que no tiene `.env.local`), con el
ledger de los experimentos en una carpeta temporal (`BARACK_API_DIR` fijado antes del `import()`).

## Veredicto: FALLO · 3 Importante, 3 Nit (y 2 nits más), 2 Preexistente

Cada hallazgo lleva dos rótulos: la etiqueta de `REVIEW.md` (Importante / Nit / Preexistente) y la clase que pidió la
sesión madre (TRUE BUG > ROBUSTNESS > FALSE POSITIVE).

Lo de adentro está bien hecho:
- el lote no pierde ni duplica nada en el camino normal;
- Fable no tiene ningún camino sin la frase;
- la pausa y el marcador hacen lo que dicen.

Lo que frena:
- **Un TRUE BUG.** Una noche con un paso en pausa sale con código 1 (el envoltorio escribe
  `RESULTADO: ERROR (codigo 1)`), pero el tablero de Fak la pinta **«corrió bien»**, en verde. El arreglo es chico y va
  en `mods/tablero`, que la rama no tocó.
- **Dos contradicciones entre lo que dicen los commits y lo que es cierto.** El pedido dice «contradicciones = rojo», así
  que van como Importante aunque no cambien cómo anda nada. Una ya está arreglada en el árbol sin commitear; la otra, a
  medias.

**Ojo, el árbol se movió durante la auditoría.** Alrededor de las 10:00 aparecieron 4 archivos modificados y sin
commitear: `docs/pedidos-api/investigacion.md`, `docs/pedidos-api/medir_esfuerzo.md`, `scripts/_apiLotes.mjs` y
`scripts/_lib/claudeApi.mjs`. No son míos. Este informe juzga los 7 commits. Lo que arreglan los cambios sin commitear se
nombra donde corresponde.

## Los chequeos del protocolo

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `vite build` a una carpeta del scratchpad (para no dejar `dist/` en el worktree): 42,7 s |
| Tests | OK | 13 archivos, **344/344 verde** (los 12 de `__tests__/scripts` pedidos y `mods/tablero/tests/tablero.test.mjs`). `tablero-cascara.test.ts` **no corrió**: vitest lo excluye (`mods/**/*.test.ts`), corre con `claude plugin test`, y la rama no toca `mods/` |
| Lint | OK | `npx eslint .` (el del CI): 0 errores, 735 avisos viejos de TS. `npx eslint <los 13 archivos>`: 0, pero no prueba nada (ver Preexistente 1). Con `js.configs.recommended` + globals de Node: 0 problemas en los 13 |
| Git local | AVISO | 4 archivos modificados sin commitear, del autor (ver arriba) |
| GitHub sync | OK | La rama es de revisión y no tiene upstream: los 7 commits sin subir son lo esperado. Base `6fadd6a5` = `main` = `origin/main` |
| CI | OK | `candado.yml` completed success en `6fadd6a5` (la base); `deploy.yml` completed success en `411f200f` |
| Dependencias | OK | `npm ls --depth=0`: nada faltante |

## Hallazgos Importantes

### [Importante · TRUE BUG] El tablero pinta «corrió bien» una noche con un paso en pausa

La precondición es común: pasa en cualquier noche que tenga una pausa.

- **Dónde:** `mods/tablero/hooks/estado.mjs:175` cuenta solo los pasos `ok` y `error`, y `:187` mira solo `corte`. Después,
  `mods/tablero/hooks/dibujo.mjs:136-147` cae en `'corrió bien'` (verde). La pausa que agrega la rama
  (`scripts/_lib/nocturno.mjs`, `pausa: 'budget_reached'`, fila `saltado`) no es `error` ni `corte`.
- **Cómo lo probé** (`scratchpad/exp/noche.mjs`): `correrPasos` con tope 8 (datos ok, pre-auditoría gasta 7,90 y mails
  pausa por una cota de 0,20) → `armarEstado` → `leerNoche`.
  - `lineaTablero`: `… EN PAUSA por el tope de la corrida: mails · $7,90`, que está bien.
  - Código de salida: 1 (`scripts/_nocturno.mjs:457`), y `_nocturno.ps1:59` escribe `RESULTADO: ERROR (codigo 1)`.
  - `leerNoche` → `{"corrio":true,"cortada":false,"pasos":2,"conError":0}`. Con eso el tablero dice «corrió bien», en
    verde, y cuenta 2 pasos cuando corrieron 3.
- **Por qué es Importante y no Preexistente.** Antes de la rama, un paso que se pasaba del tope corría igual y los que
  seguían quedaban con `corte`: el tablero mostraba «se cortó» en ámbar. Con la rama, ese caso queda en pausa, y el único
  visor que mira Fak lo muestra limpio. Es REVIEW #9: algo quedó sin hacer y se ve verde. El hueco nace con `pausa`.
- **Qué arreglaría:** que `leerNoche` devuelva los pausados (`pasos.filter((p) => p.pausa)`), que `dibujo.mjs` los pinte
  en ámbar («quedó en pausa por el tope: mails»), y un test en `tablero.test.mjs` en las dos direcciones: con pausa no es
  «corrió bien», y sin pausa sigue siéndolo. `lineaTablero`, `_claude.mjs --check` (`:258`) y `_tablero.mjs` (`:124`) ya
  lo dicen bien.
- Respuesta: ____ (arreglado / rechazado / a propósito / no importa)

### [Importante · contradicción del commit] El commit ba3ea2d3 le atribuye el 2.814 al 09-11/10, y es del 17/10

Es rojo por la regla del pedido. No cambia cómo anda nada: es un número mal fechado.

- **Dónde:** el comentario de `scripts/_lib/claudeApi.mjs` (en HEAD, línea 280) y el mensaje del commit ba3ea2d3 dicen
  «en el ledger del 09-11/10 la salida máxima de la noche fue 2.814 tokens (disparo, Haiku)».
- **Medido** en `.sgc-cache/api/ledger_2026-10.jsonl` (391 líneas):
  - Entre el 09 y el 11/10, la salida máxima de la noche fue **2.394**, de `preauditoria:refutador` con Opus, el 10/10 a
    las 06:30 (93 pedidos).
  - El 2.814 existe, pero es `disparo-skills:haiku` del **17/10 a las 06:18**.
  - La conclusión del commit no cambia: los dos números quedan lejos de los topes de 4.000 a 16.000.
- **Estado:**
  - El comentario ya está corregido en el árbol, sin commitear («del 09 al 17/10 … 17/10»).
  - El mensaje del commit sigue con el error. Si la rama no se reescribe, que lo diga el commit que suba el arreglo.
- Respuesta: ____

### [Importante · contradicción del commit] El caché del agente: lo commiteado dice «1 h en el último mensaje»

Es rojo por la regla del pedido. No cambia cómo anda nada: el código está bien y lo que estaba mal es la descripción.

- **Dónde:**
  - En HEAD, `docs/pedidos-api/investigacion.md:11` dice «caché de 1 h en el último mensaje».
  - El comentario de `scripts/_lib/claudeApi.mjs` (en HEAD, línea 278) dice que el agente «lo mueve al último mensaje».
  - El mensaje del commit 240a8f37 dice «cache de 1 h».
- **El código hace otra cosa:**
  - `agenteApi.mjs:536` pasa `cacheTtl: '1h'`, y `armarParametros` pone esa marca en el último bloque del **system**.
  - `marcarCache` (`agenteApi.mjs:485-489`) pone `{ type: 'ephemeral' }` (5 min) en el último mensaje del **usuario**.
  - O sea: dos marcas, 1 h en el system y 5 min en el mensaje.
- **Estado:** los dos textos ya están corregidos en el árbol, sin commitear. El mensaje de 240a8f37 queda como está.
- Respuesta: ____

## Nits (los 3 que más pesan; los tres son ROBUSTNESS con precondición rara)

### [Nit · ROBUSTNESS] Lote: dos casos raros en que el ledger no queda igual a lo que se pagó

Van en direcciones opuestas.

1. **Una recogida que se corta a mitad, si después se fuerza, cuenta el gasto dos veces.** Cada respuesta se anota en
   el ledger mientras se lee (`claudeApi.mjs:898`, adentro de `recogerLote`). Las salidas, en cambio, se escriben recién
   al final (`apiLotesBatch.mjs:145-170`).
   - **Medido** (`scratchpad/exp/lotes.mjs`, caso 2): un cliente falso que se corta después del primer resultado deja
     1 línea en el ledger, 0 salidas y el estado `recogiendo`.
   - Sin `--forzar` se rechaza, que está bien. La única forma de sacar las salidas es `--forzar`, y deja **3 líneas para
     2 pedidos** (`sesion:audit-01@high` dos veces).
   - Está avisado en el mensaje y cuenta de más (el semáforo queda del lado seguro).
2. **Si `_lote.json` no se puede escribir después de crear el lote, el id se pierde.** En `apiLotesBatch.mjs:106` se
   crea el lote; recién en `:119` se guarda.
   - **Medido** (caso 4): con `_lote.json` convertido en carpeta en el medio, sale `EPERM … rename`, se creó 1 lote, y
     el id `msgbatch_X` no aparece en el error ni se imprimió antes.
   - Ese lote se cobra igual del lado de Anthropic, nadie lo recoge y el ledger no lo anota nunca: el semáforo del ciclo
     cuenta de menos. Es el peor de los dos, aunque cuesta que pase (la carpeta se validó y se creó un momento antes).
- **Qué arreglaría:**
  - Imprimir o poner en el error el `loteId` antes de `guardarEstado`.
  - Para el primer caso, anotar en `_lote.json` los ids ya anotados (o que `recogerLote` acepte un `yaAnotados`) y
    escribir cada salida a medida que llega.
- Respuesta: ____

### [Nit · ROBUSTNESS] El marcador del resumen largo se traba si quedan más de 60 listados quietos arriba de él

- **Dónde:** `scripts/_nocturno.mjs:243` toma los 60 más viejos de después del marcador. Si todos están «sin cambios», el
  paso sale por `saltar` (`:272`) antes de escribir el marcador (`:282`), y el marcador no se mueve.
- **Medido** (`scratchpad/exp/marcador_trabado.mjs`, réplica del paso con `juntarDesdeMarcador` real): 61 días quietos
  arriba del marcador y después 7 listados con novedades por semana. Las cuatro semanas siguientes dan
  `60 elegidos · 0 con novedades · saltar · marcador NO se movió`. No se recupera solo, y cada lunes dice «sin cambios»
  aunque haya novedades.
- Hacen falta 60 noches seguidas sin un solo posteo ni versión, así que es improbable. Pero cuando pasa es silencioso.
- **Qué arreglaría:** con `plan.accion === 'saltar'` y `junta.hastaMs != null`, avanzar igual el marcador. Todo lo leído
  estaba quieto: es «leído», no «perdido».
- Respuesta: ____

### [Nit · ROBUSTNESS] Agente: un `pause_turn` hecho solo de texto saca una excepción del bucle

- **Dónde:** `agenteApi.mjs:536` llama a `armarParametros` fuera del `try` del `create` (`:540`). Cuando el último
  mensaje es un turno del asistente hecho solo de texto, `esPrefill` tira.
- **Medido** (`scratchpad/exp/agente_fable.mjs`, caso 1, con `clienteGuion`): sale `ErrorApi api … prefill` por fuera de
  `correrAgente`, con 1 línea en el registro y sin `registro.cerrar`.
  - Antes de la rama, ese turno habría ido a la API y vuelto como corte prolijo (`api: … 400`).
  - El `pause_turn` normal (thinking + `server_tool_use` + texto) **no** se frena: caso 1b, termina en 2 pasos.
- No es una forma documentada de `pause_turn`, así que es improbable.
- **Qué arreglaría:** armar los parámetros adentro del `try`, o convertir el `ErrorApi` en `estado.corte`.
- Respuesta: ____

**Y 2 nits más** (contados, una línea cada uno):

- **`--lote` con todo ya en disco:** `--lote` con `saltarExistentes` y todo en disco sale con 1 («un lote sin pedidos no
  se manda», `claudeApi.mjs:847` en HEAD) y no corre la síntesis `todosEnDisco`, que el modo viejo sí corre. No se gasta
  nada.
- **`medir_esfuerzo.md` y la síntesis:** no avisaba que una `sintesis` en el jobs.json corre al recoger, a precio entero,
  y escribe en su `salida`, que `--salida-dir` no redirige. Con los 3 jobs.json reales se frena sola (son Fable sin frase:
  sale 2). **Ya arreglado en el árbol sin commitear.**

## Preexistente

- **[Preexistente] `eslint` no aplica ninguna regla a los `.mjs` de `scripts/`.** `eslint.config.mjs:34` pone reglas
  solo a `**/*.{ts,tsx}`.
  - Sonda: un `.mjs` en `scripts/` con `const x = 1; x = 2; undefinedFn();` dio exit 0 (la borré enseguida).
  - Por eso «`npx eslint` sobre los archivos tocados» en verde no dice nada. `eslint .` solo frena errores de sintaxis.
  - Lo reemplacé por una config del scratchpad con `js.configs.recommended` (61 reglas, entre ellas `no-undef` y
    `no-unused-vars`) y los globals de Node: 0 problemas.
  - Respuesta: ____
- **[Preexistente] `_apiLotes.mjs:23` tiene `RAIZ = 'C:/Dev/BarackMercosul'` fijo, y la rama lo sigue usando** en el modo
  lote (`:79`, `raiz: RAIZ`).
  - Corrido desde un worktree, el modo lote lee el pedido y los adjuntos del checkout principal, pero crea el cliente en
    el proceso (con la clave del worktree).
  - El modo viejo, en cambio, lanza el `_apiTarea.mjs` del principal, con su `.env.local`.
  - Lo viejo no se le carga a la rama.
  - Respuesta: ____

## Descartados (FALSE POSITIVE: lo miré y no se sostuvo)

- **«Propuestas se pausa siempre con el tope de $8»:** no. Su cota es el probable × 1,3, unos US$ 1,5 si se mira lo que
  costó en serio (US$ 1,15 el 09/10), y a esa altura de la noche le quedan unos US$ 6,4.
- **«El tablero se rompe con el campo `pausa`»:** no se rompe, lo ignora. Eso es el Importante, no un error de lectura.
- **Fable por el fallback del servidor:** en las 391 líneas del ledger de octubre no hay ni un `fallback`. No hay caso,
  así que va a «no pude verificar».
- **Una pausa que dispara otra corrida el mismo día:** `comandoAgendar` no tiene `RestartCount`.
- **El empate de `mtime` en el marcador:** dos listados con el mismo milisegundo. Lo medí con datos inventados: el
  segundo se perdería, pero con listados diarios `HHMM` no pasa.
- **Los 2 «bloqueantes» de `_sinFirmaIA.py` sobre `medir_esfuerzo.md`:** es un documento interno del repo sobre la API,
  no un entregable de Barack (REVIEW #3).

## Lo que se pidió mirar, una línea por pregunta

**Batch**
- **¿Puede duplicarse el gasto en el ledger?** Solo con `--forzar`:
  - Sobre un lote ya recogido: +4 líneas para 2 pedidos (medido, caso 3).
  - Después de una recogida cortada: nit de arriba.
  - Dos `--recoger` a la vez: no hay candado entre procesos (leído, no medido).
- **¿Puede perderse un lote pagado?** Solo si `_lote.json` no se escribe después del create (nit de arriba). Si el
  proceso se cae mientras espera, el id ya está en disco, y `--recoger` lo levanta.
- **¿Puede guardarse una salida incorrecta?** No encontré camino:
  - Cada salida va por su `custom_id` a la ruta que quedó en `_lote.json`, validada antes de pagar.
  - No se escribe nada vencido, con error, cancelado, rechazado ni cortado sin `guardarCortada` (test «terminado» y
    caso 2c).
- **¿`recogerGuardado` con `forzar` y el estado posterior?** Conserva el `recogiendo` original y pone un `recogido`
  nuevo. Un `--lote` nuevo en esa carpeta se permite y pisa `_lote.json` (caso 3b).
- **¿`esperarLote` con objeto o con id?** Las dos formas devuelven el lote terminado (caso 1).
- **¿`lote()` sigue igual por fuera?** Sí: `claudeApi.test.mjs` no cambió en la rama y da 42/42. El caso 5 devuelve
  `{ loteId, resultados }` con las mismas claves.

**`esPrefill` en el agente**
- El `pause_turn` normal (thinking + `server_tool_use` + texto) no se frena: test de la rama y caso 1b
  (`scratchpad/exp/agente_fable.mjs`), que termina en 2 pasos.
- Un `pause_turn` solo con texto **sí rompe el bucle** (el nit del agente, arriba).

**La pausa de la noche**
- **¿Algún paso que antes corría ahora se pausa siempre con $8?** No.
  - Propuestas usa su probable × 1,3. En el ledger, propuestas costó US$ 1,15 el 09/10 y la pre-auditoría US$ 0,96 y
    1,49 (09 y 10/10). Le quedan unos US$ 6,4.
  - Mails (Haiku, 8.000), prioridades (Sonnet, 8.000) y novedades (`plan.*`): cada cota usa el mismo modelo y el mismo
    `max_tokens` que su llamada (leído). No hay test de integración por paso, solo de `pausaPorPresupuesto`.
- **¿`semanal()` anda con el ctx nuevo?** Sí: `nocturnoSemanal` 4/4 (lo llama sin argumentos) y el test nuevo con
  `{ restanteUsd }`.
- **¿Son coherentes `armarEstado`, `lineaTablero` y el código de salida?** Sí entre ellos (caso 1 de `noche.mjs`). El que
  no coincide es el mod tablero (el Importante).
- **¿Quién más lee `nocturno.json`?**
  - `mods/tablero` no se rompe con el campo `pausa`, pero lo ignora (Importante).
  - `_claude.mjs --check` y `_tablero.mjs` muestran `lineaTablero`, que sí lo dice.
- **¿Una pausa (exit 1) dispara otra corrida el mismo día?** No: `comandoAgendar` (`nocturno.mjs:816-832`) no tiene
  `RestartCount`.

**El marcador**
- **¿Se puede perder un listado?**
  - Solo en el caso trabado de más de 60 quietos (nit).
  - El empate de `mtime` al milisegundo, medido con datos inventados, no pasa con listados diarios: no lo reporto.
  - Los nombres son `novedades_AAAA-MM-DD_HHMM.md` y nadie los borra.
- **¿Se puede resumir dos veces?**
  - Solo si falla la escritura del marcador después del resumen: el próximo largo repite esos listados, que es el lado
    seguro.
  - El resumen no puede fallar después del marcador, porque el marcador se escribe último (`_nocturno.mjs:276-283`).
- **¿`listadosParaElLargo` toma los más viejos?** Sí: la réplica con 70 listados toma los 60 de 10 a 69 días.

**Fable**
- **¿Queda algún camino sin la frase?** No. Medido (`agente_fable.mjs`, casos 2a-2f), todos se frenan con
  `ErrorApi 'fable'` antes de llamar:
  - el agente;
  - `mapaReduce` (worker y reductor);
  - `contarTokens` con el id completo `claude-fable-5-1`;
  - `crearLote`;
  - una frase de 5 letras.

  `_propuestasSkills`, `_preauditarAmfe` y `_pruebaDisparoSkills` tienen el modelo fijo (sonnet, opus o haiku);
  `vigilarPrecios` no llama a ningún modelo; y en `mods/` nadie importa la puerta (el tablero solo la nombra en un
  comentario). `ROLES.deliberador` no lo usa nadie.
- **¿El fallback del servidor sigue anotando la frase?** Sí: si contesta Opus a un pedido a Fable, la línea del ledger
  lleva `pedidoFable` (caso 3). Con Opus pedido y la frase de más, no se anota (caso 3b).

**¿Lo que dicen los commits coincide con el código?**
- No coinciden el 2.814 ni el caché del agente: los dos son Importante, arriba. Los textos ya están arreglados en el
  árbol sin commitear; los mensajes de los commits, no.
- Verificados contra el ledger o el código:
  - 63.200 de entrada y 36.700 de salida por lote (`auditoria-tanda`, 26 pedidos: 63.233 y 36.742);
  - US$ 144,78 de Fable sobre 262,93 entre el 09 y el 11/10;
  - 283 llamadas con `lote:false`;
  - «el tope de propuestas pasa los $8» (20 skills × 16.000 tokens en Sonnet y en Opus = US$ 9,6);
  - `lote()` igual por fuera;
  - custom_id validado;
  - tope de 64.000 en lote;
  - la síntesis con Opus por defecto;
  - `--fable-pedido` en los tres comandos;
  - nada de `thinking`, `temperature`, `top_p`, `top_k` ni `tool_choice` en `scripts/` (grep, sin contar `_archive`);
  - la carpeta de Gemini (`_indice.md`, `1-prompts/_plantilla.md` con «datos de Barack que lleva: ninguno», y
    `2-respuestas/` y `3-verificado/` vacías), mirada en la copia local de la nube, sin tocarla.

## Acciones

1. **El TRUE BUG:** el tablero con la pausa en ámbar y su test, antes del merge o como primer arreglo. La rama no tocó
   `mods/`.
2. **Las dos contradicciones:**
   - Commitear los arreglos que ya están en el árbol (el comentario del 2.814, y `investigacion.md` con el comentario de
     la puerta para el caché).
   - Decir en ese commit que los mensajes de ba3ea2d3 y 240a8f37 quedan corregidos ahí.
3. Los 3 nits detallados: que la sesión decida cuáles arregla.
4. Commitear (o descartar) el resto de lo modificado durante la auditoría (`medir_esfuerzo.md`, `_apiLotes.mjs`).
5. **Al merge, REVIEW #10:** la rama toca `.claude/rules/api-claude.md`, una regla con `paths:` (`mejora-implementada.md`
   §2). El cierre tiene que decirle a Fak si las sesiones abiertas la toman solas (`node scripts/_probarMejora.mjs
   --sesiones`).

## Lo que no pude verificar

- `mods/tablero/tests/tablero-cascara.test.ts`: corre con `claude plugin test`, no con vitest. No lo corrí, y la rama no
  toca `mods/`.
- El comportamiento real de Message Batches y de `pause_turn` (cuánto tarda, qué forma trae el contenido): todo fue con
  clientes falsos y sin llamadas pagas.
- Fable por el otro lado: un pedido a Opus o Sonnet con `fallbacks: 'default'` que el servidor contestara con Fable no
  lo frena la puerta, porque mira el modelo pedido. En las 391 líneas del ledger de octubre no hubo **ni un** fallback,
  así que no hay caso.
- `_nocturno.mjs` de punta a punta: el paso `datos` lee Supabase y no lo corrí, ni con `--simular`. La pausa en cada
  paso real (`pasoMails`, `pasoNovedades`…) la leí; no hay test que la ejercite.
- Que la carpeta de Gemini haya subido a la nube («0 pendientes»): vi la copia local, no la nube.
