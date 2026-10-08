# Traspaso — capa API de Claude (créditos del plan Max) — 08/10/2026

Para la sesión que continúa este trabajo (no es un informe para Fak). Lo escribió la sesión Fable 5.1
del 08/10 después de leer `C:\Users\FacundoS-PC\Desktop\INFORME_MAESTRO_API_CLAUDE_BARACK.txt`,
`docs/PLAN_MAESTRO_IMPLEMENTACION_API_CLAUDE.md` y de barrer el repo con 6 exploradores. Fak pidió
frenar esa sesión por costo y seguir con Opus 5.5. **Todo lo de abajo ya está verificado: no volver a
investigarlo.** Fak autorizó (08/10, textual): hacer todo sin preguntarle, agendar la tarea de Windows,
saltear los guardianes si hace falta. Lo único que él tiene que hacer es crear y pegar la clave (ver §5).

## 1. Veredicto sobre el informe (verificado contra fuentes oficiales el 08/10/2026)

- **Los créditos existen** (anuncio 07/10/2026): Max 5x $100/mes, Max 20x $200/mes, vencen cada ciclo,
  no se acumulan. **NO cubren Claude Code** ni el uso extra de las apps. Cubren: Claude API (Messages y
  Batches), Managed Agents, Agent SDK (solo con una API key de la org vinculada, no con el login del
  plan) y Playground. Fuente: `platform.claude.com/docs/en/about-claude/api-credits-for-subscribers`.
  ⇒ **La tesis central del informe está mal**: poner Opus por defecto en Claude Code no gasta un centavo
  de los créditos (Claude Code sale del plan). Opus 5.5 ya es el default de Fak (decisión 04/09, en
  CLAUDE.md) y queda igual. Lo único que consume los créditos es código del repo que llame a la API con
  `ANTHROPIC_API_KEY`. Eso es lo que se construye.
- **Precios oficiales** (`platform.claude.com/docs/en/about-claude/pricing`): Opus 5.5 $4/$20, cache
  read $0.20, write 5m $5 / 1h $8 · Sonnet 5.5 $2/$10, read $0.10, write $2.5/$4 · Haiku 5.5 $0.10/$0.50
  hasta 100K tokens (después $0.50/$2.50), read $0.01 · Fable 5.1 $10/$50, read $0.25, write $12.5/$20.
  Batches: 50 %. El informe tenía mal Sonnet ($3/$15) y los cache reads de Opus y Sonnet ($0.40/$0.30).
  Ya están bien en `scripts/_lib/claudeApi.mjs` (`PRECIOS`).
- **Settings de Claude Code**: `promptCacheTtl` / `CLAUDE_CODE_PROMPT_CACHE_TTL` existen (v2.1.242+,
  esta PC tiene 2.1.293); `CLAUDE_CODE_SUBAGENT_MODEL` existe y ya está en `~/.claude/settings.json`
  (= claude-sonnet-5-5); los suscriptores ya reciben el TTL de 1 h en la conversación principal sin
  configurar nada. ⇒ **No hay nada que tocar en settings**. `ENABLE_PROMPT_CACHING_1H` es para usuarios
  con API key. Output styles: Fak no tiene ninguno; su sistema es de hooks (regla `mejora-implementada.md`);
  no inventar uno.
- **Telemetría**: `scripts/_tokens.mjs` cuenta cada turno ~2,15 veces (una línea por bloque de contenido
  con el mismo `message.id`). Las cifras absolutas del informe (123.029 turnos) están infladas; los
  porcentajes por modelo probablemente parecidos. No corregir el script ahora: anotarlo.
- "92 de 111 falsos positivos" del 02/09 NO fue de una IA: fue la auditoría al cerrojo del coordinador
  (evasiones que pasaron). La tasa real medida de falsos positivos de subagentes es 40-50 %
  (`.claude/commands/auditoria-cliente.md`). Por eso la pre-auditoría tiene refutador.
- **La auto-mejora nocturna anterior se APAGÓ el 04/08/2026** (memoria `project_automejora_reparacion.md`:
  0 auditorías exitosas en 280.370 líneas de log, 47.522 timeouts, fork bomb de `claude -p`; "no
  re-proponer"). ⇒ El nocturno nuevo es un `node` suelto que llama a la API por SDK. Nunca `claude -p`,
  nunca un hook SessionStart que lance procesos. Loguear stdout y stderr; "resultado vacío" es error.
- Decisiones del proyecto que se respetan a la letra: ningún LLM propone S/O/D ni acciones
  (`docs/auto-mejora/2026-09-30-automejora-10-frentes.md:120`); "la máquina puede MATAR un hallazgo,
  nunca APROBAR un dato" (`.claude/rules/coordinador.md`); AP=H con acción vacía es estado válido
  (`.claude/rules/amfe.md` §4); "un hallazgo sin cita no es hallazgo" (`auditoria-cliente.md`); nada de
  informes para Fak (memoria `no_hacer_informes`): el entregable de la noche es un archivo de TRABAJO
  para la sesión de la mañana, que verifica y le lleva a Fak 4 renglones.
- Lo que NO se construye (y por qué): filtro "Ingeniería vs Calidad/Logística" de mails — no existe en
  código, "Logística" no está definida en ninguna regla, y taparía la respuesta de Calidad que espera el
  seguimiento de la reunión de AMFE (`~/.claude/scheduled-tasks/seguimiento-reunion-amfe`). Se ETIQUETA
  el área, no se filtra. Auto-mejora de CAD 3D y worktrees nocturnos de código: afuera (el nocturno no
  toca el repo). Circuit breaker de $1,50 por llamada: afuera; va un tope MENSUAL pasivo.

## 2. Lo que ya está hecho (sin commitear; `node --check` y smoke import OK)

- `npm install @anthropic-ai/sdk@^0.132.1` → `package.json` + `package-lock.json` modificados. Es la
  única dependencia nueva; es solo para scripts, no entra al bundle de Vite. `zod` 4.1.13 ya existe como
  transitiva pero NO se usa (esquemas JSON crudos con `output_config.format`).
- **`scripts/_lib/claudeApi.mjs`** — la única puerta a la API. Exporta: `MODELOS`, `ROLES`, `PRECIOS`,
  `ErrorApi`, `resolverModelo`, `costoUsd`, `estimarUsd`, `leerEnv`, `leerClave`, `MENSAJE_SIN_CLAVE`,
  `crearCliente`, `armarParametros` (puro), `interpretarRespuesta` (puro), `exigirRespuestaUtil`,
  `mesLocal`, `selloLocal`, `rutaLedger`, `registrarGasto`, `leerLedger`, `resumenLedger`,
  `presupuestoMensualUsd` (env `BARACK_API_PRESUPUESTO_USD`, default 100), `estadoPresupuesto`,
  `presupuestoDelMes`, `usd`, `llamar`, `contarTokens`, `verificarAcceso`, `enParalelo`, `lote`,
  `recogerLote`, `mapaReduce`. Ledger en `.sgc-cache/api/ledger_AAAA-MM.jsonl` (`BARACK_API_DIR` lo
  pisa). Siempre usa `cliente.beta.messages.create` (acepta `fallbacks: 'default'` + beta
  `server-side-fallback-2026-07-01`; Haiku sin fallbacks). `thinking` se omite (adaptativo); `effort`
  explícito. Un rechazo / truncado / JSON inválido tira `ErrorApi` salvo `tolerar: true`.
- **`scripts/_lib/supabaseSoloLectura.mjs`** — `soloLectura(sb)`, `conectarSoloLectura()`,
  `leerAmfesVivos(sb, { minimo })`. Candado 2 en código: solo `from(t).select()`; insert/update/upsert/
  delete/rpc tiran. (Dato: el usuario de `.env.local` PUEDE escribir; RLS es `FOR ALL TO authenticated`.)
- **`scripts/_lib/preauditoriaAmfe.mjs`** — puro: `TIPOS`, `proyectarAmfe` (una línea por causa con ref
  `O1.W2.F1.X3.C2`), `conocidosDelValidador` (usa `validateAmfeDoc` de `amfeValidator.mjs`),
  `SYSTEM_REVISOR` + `SCHEMA_HALLAZGOS` + `armarPedidoRevisor`, `SYSTEM_REFUTADOR` + `SCHEMA_REFUTACION`
  + `armarPedidoRefutador`, `filtrarHallazgos` (ref existe, cita textual, AP sin acción nunca es
  hallazgo, sin duplicados, tope 8), `aplicarVeredictos`, `claveHallazgo`, `estadoInicial`,
  `normalizarEstado`, `amfesACorrer` (diff por `updated_at`), `estadoNuevo`, `marcarNuevos`,
  `tokensAprox`, `armarReporte`, `lineaResumen`.
  Ajuste pendiente visto en el smoke test: `filtrarHallazgos` exige cita ≥ 6 caracteres y descartó
  "HO 12" (5). Bajar el mínimo a 4 o exigir ≥ 2 palabras; cubrirlo con test.

En el árbol hay cambios de OTRA sesión (`scripts/_lib/amfeAutoria.mjs`, `firmaIA.*`,
`__tests__/scripts/amfeAutoria.test.mjs`, `docs/auto-mejora/*`, `tools/flowchart/...`): **no tocarlos
ni commitearlos**. Commit siempre con rutas (`git commit -m "..." -- ruta1 ruta2`, regla `git-deploy.md`).

## 3. Lo que falta, en orden

1. **`scripts/_preauditarAmfe.mjs`** (CLI). Flags: `--simular` (sin gastar: proyecta, `contarTokens`
   si hay clave, estima costo con `estimarUsd`), `--todos`, `--amfe <numero>`, `--json`. Exit 0 ok /
   1 falló / 2 argumento / 3 sin clave. Flujo: `crearCliente` → `conectarSoloLectura` → `leerAmfesVivos`
   (minimo 1; hoy hay 21) → `amfesACorrer` con estado en `.sgc-cache/api/preauditoria/estado.json`
   (`BARACK_PREAUDITORIA_DIR` lo pisa) → por AMFE (`enParalelo`, 3 a la vez): `parseData` →
   `proyectarAmfe` → `conocidosDelValidador` → `llamar` revisor (modelo `sonnet`, `effort: 'medium'`,
   `cacheTtl: '5m'` en el system, `maxTokens` 8000, tarea `preauditoria:revisor`) → `filtrarHallazgos` →
   si quedan, `llamar` refutador (modelo `opus`, `effort: 'high'`, tarea `preauditoria:refutador`) →
   `aplicarVeredictos` → `marcarNuevos`. Reporte en `reports/staging/PREAUDITORIA_AMFE_AAAAMMDD.md`
   (escribir a `.tmp` y renombrar; la carpeta `reports/` está ignorada por git). Exportar
   `async function correr(opciones)` que devuelve `{ revisados, saltados, hallazgos, nuevos, errores,
   costoUsd, reporte }` para que lo use el nocturno; guarda de entrada
   `if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))`.
   Volumen: 21 AMFE, ~300K tokens compactos en total, el más grande ~25K. Costo estimado de la pasada
   completa: ~$1,5 (Sonnet por AMFE + Opus solo donde quedan hallazgos). Las noches siguientes solo los
   que cambiaron.
2. **`scripts/_lib/nocturno.mjs`** (puro) + **`scripts/_nocturno.mjs`** (CLI). Pasos, cada uno
   independiente y con try/catch (un paso que falla no tumba el resto; ningún paso deja archivo a medias):
   (a) clave presente, si no exit 3 con `MENSAJE_SIN_CLAVE`; (b) `presupuestoDelMes()`: si está en rojo
   NO arranca (salvo `--sin-tope`); (c) pre-auditoría (`correr`); (d) **mails**: correr
   `python scripts/_mails.py --sin-respuesta --json --dias 5 --ventana 45` (así lo hace
   `_escritorio.mjs:408-446`, con `BARACK_MAIL_CACHE` y `PYTHONIOENCODING=utf-8`), tomar hasta 12
   pedidos, para cada uno el último mail del hilo desde `.mail-cache/mails.jsonl` (campos `asunto`,
   `de`, `fecha`, `carpeta`, `cuerpo`; agrupar con `claveHilo` de `_lib/mailCache.mjs`), recortar el
   cuerpo con `cuerpoPropio()` de `_lib/vozGate.mjs` a 1500 caracteres, y UNA llamada a Haiku
   (`effort: 'low'`) con esquema `{ lineas: [{ asunto, linea (≤120 car.: qué piden), area:
   'ingenieria'|'calidad'|'logistica'|'otra' }] }`. Se etiqueta el área, no se filtra; (e) **novedades**:
   solo si es lunes o si `avisoHook` de `_lib/novedadesClaude.mjs` dice que pasaron 7 días: spawn
   `node scripts/_novedadesClaude.mjs`, leer el `novedades_*.md` más nuevo de `.sgc-cache/x-seguimiento/`
   y pedirle a Sonnet ≤ 8 renglones "nos sirve / nos puede romper" con URL, guardado en
   `.sgc-cache/x-seguimiento/resumen_<sello>.md`. Agregar la cuenta `bcherny` (Boris Cherny, creador de
   Claude Code) a `scripts/_lib/novedadesClaude.data.json`; (f) escribir
   `.claude/state/nocturno.json` = `{ fecha, inicio, fin, pasos: [{ nombre, estado: 'ok'|'error'|
   'saltado', detalle, costoUsd }], costoUsd, presupuesto, lineaTablero, mails: [...], hallazgos }`
   (`.claude/state/` está ignorado) y una línea en `.sgc-cache/api/nocturno.log`. Flags: `--simular`,
   `--solo <paso>`, `--sin-tope`, `--agendar`, `--desagendar`, `--estado`. `lineaTablero` ejemplo:
   `Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 2 hallazgos para verificar (1 nuevo) · 4 mails resumidos · novedades: sin cambios · $0,41 (mes $12,30 de $100, verde)`.
3. **`scripts/_nocturno.ps1`** — copia de `scripts/_syncMailsDiario.ps1` (función `Escribir`, log en
   `.sgc-cache\api\nocturno-diario.log`, `Start-Process node` con `WaitForExit(55 min)`, `$null =
   $p.Handle`, RESULTADO OK/ERROR, exit con el código). **Solo ASCII** en el .ps1.
4. **`--agendar`** en `_nocturno.mjs`: `psRun()` de `_lib/powershell.mjs` con el patrón EXACTO de
   `scripts/_arbVigilante.ps1:45-55`: acción `conhost.exe --headless powershell.exe -NoProfile
   -ExecutionPolicy Bypass -File "<repo>\scripts\_nocturno.ps1"`, `-WorkingDirectory <repo>`, trigger
   `-Daily -At 06:30`, settings `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
   -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -Priority 6`, principal
   `-UserId $env:USERNAME -LogonType Interactive -RunLevel Limited`, `Register-ScheduledTask -TaskName
   'Barack - Noche de Claude (API)' -Force`. Es una notebook Lenovo: si estaba apagada,
   `StartWhenAvailable` la corre al prenderla (por eso 06:30 y no 03:00). Ya existen con ese patrón
   "Barack - Sync mails a cache local" (08:30/12:30/16:30), "Barack - Backup Supabase semanal" y
   "Barack - ARB siempre abierto". No requiere administrador. **Agendarla recién cuando exista la
   clave** (si no, falla cada mañana); mientras, `_claude.mjs --check` lo dice.
5. **`scripts/_claude.mjs`** (CLI de control): `--check` (hay clave sí/no SIN mostrarla ·
   `verificarAcceso` · `presupuestoDelMes` · ¿tarea agendada? vía `Get-ScheduledTask` · edad del último
   `nocturno.json`), `--probar` (una llamada a Haiku "Respondé solo OK", imprime costo), `--ledger
   [--mes AAAA-MM]` (tabla por modelo y tarea con `resumenLedger`), `--preguntar "<texto>" [--modelo
   opus|sonnet|haiku]`, y **`--pegar-clave`**: abre un cuadro de Windows (PowerShell
   `[Microsoft.VisualBasic.Interaction]::InputBox` o `Read-Host -AsSecureString` convertido) donde Fak
   pega la clave, y el .ps1 la escribe él mismo como línea `ANTHROPIC_API_KEY=...` al final de
   `.env.local` (crea una copia `.env.local.bak-<fecha>` antes; si ya hay una línea la reemplaza). La
   clave NUNCA pasa por el chat ni por stdout. Esto respeta el `secretos-guard` (el comando no nombra el
   archivo con un lector) y el `file-guard` (Claude no edita `.env*`; lo hace PowerShell).
6. **Tablero**: en `scripts/_tablero.mjs` agregar `filasNocturno(ruta = .claude/state/nocturno.json,
   { ahora })` y una sección `## Noche (fuente: nocturno · foto HH:MM)` en `armarMarkdown` con la
   `lineaTablero`, los mails resumidos (una línea cada uno, con área) y "⚠ VIEJO" si pasaron más de 26 h
   (G6: cada fila dice su fuente y la hora). `chequear` no cambia. Ojo: `_tablero.mjs` no está cableado a
   ningún hook y tarda 28 s en frío; no cablearlo al arranque.
7. **Tests** (vitest, en `__tests__/scripts/`, con `// @vitest-environment node` en la línea 1, sin
   mocks: pasar clientes falsos y rutas temporales; tienen que pasar en el CI de GitHub en ubuntu/Node 20,
   sin `C:\`, sin `.env.local`, sin `~/.claude`):
   - `claudeApi.test.mjs`: `costoUsd` (Opus con cache 5m/1h, Haiku <100K y >100K, lote 50 %),
     `armarParametros` (cache en el último bloque del system, `output_config` con effort y format,
     Haiku sin fallbacks, Opus con `fallbacks: 'default'` + beta), `interpretarRespuesta` (texto, JSON,
     refusal → `rechazo`, max_tokens → `truncado`, JSON roto → `jsonInvalido`), `exigirRespuestaUtil`
     (ROJO tira / VERDE pasa), ledger en tmp (`registrarGasto` → `leerLedger` → `resumenLedger`),
     `estadoPresupuesto` (verde/amarillo/rojo), `leerClave` con un `.env` temporal, `llamar` con un
     cliente falso `{ beta: { messages: { create: async () => respuestaFalsa } } }`, `enParalelo`
     respeta el tope, `lote` con un cliente falso que termina al segundo `retrieve`.
   - `supabaseSoloLectura.test.mjs`: `select` pasa; `update/insert/delete/rpc` tiran; `leerAmfesVivos`
     tira con 0 filas (ROJO) y devuelve con 21 (VERDE).
   - `preauditoriaAmfe.test.mjs`: proyección con alias (`opNumber`/`operationNumber`, `cause`/
     `description`), refs únicas, `filtrarHallazgos` (sin ref, sin cita, AP=H con acción vacía
     mencionada → se descarta aunque el modelo lo diga, duplicado, tope 8), `aplicarVeredictos` (sin
     veredicto → descartado), `amfesACorrer` (cambiado / no cambiado / `--todos` / `--amfe`),
     `estadoNuevo`, `marcarNuevos`, `armarReporte` (dice "no para Fak" y "AP=H sin acción nunca es
     hallazgo"), `lineaResumen`.
   - `nocturno.test.mjs`: presupuesto en rojo frena, un paso con error no tumba a los demás, el JSON de
     estado, `lineaTablero`, el texto del comando de agendar contiene `StartWhenAvailable` y la hora.
   - `tablero.test.mjs`: agregar `filasNocturno` ausente / fresco / viejo.
   - **`candadosNocturno.test.mjs`** (el candado 3 en código): lee el texto de `_nocturno.mjs`,
     `_preauditarAmfe.mjs`, `_lib/nocturno.mjs`, `_lib/preauditoriaAmfe.mjs`, `_lib/claudeApi.mjs`,
     `_lib/supabaseSoloLectura.mjs` y falla si aparece `saveAmfe|saveCp|saveHo|savePfd|\.update\(|
     \.insert\(|\.upsert\(|\.delete\(|runWithValidation|taskkill|produc\.exe|Stop-Process|_mailEnviar|
     SendAndReceive` (el `.Send(` de Outlook tampoco; escribirlo en el test con una regex, no literal,
     para no disparar el `mail-guard` al guardar el archivo).
   Correr SOLO estos archivos: `npx vitest run __tests__/scripts/claudeApi.test.mjs ...`. La suite
   completa tarda 16 min y en esta notebook tira "Failed to start threads worker" por contención (8
   archivos "fallidos" en la línea base del 08/10 09:09 eran eso, no tests rotos).
8. **Reglas y docs** (cortos, sin informe):
   - Nueva `.claude/rules/api-claude.md` con frontmatter `paths:` (`scripts/_lib/claudeApi.mjs`,
     `scripts/_lib/preauditoriaAmfe.mjs`, `scripts/_lib/nocturno.mjs`, `scripts/_lib/supabaseSoloLectura.mjs`,
     `scripts/_preauditarAmfe.mjs`, `scripts/_nocturno.*`, `scripts/_claude.mjs`). Contenido: qué gasta
     los créditos y qué no; roles de los modelos (Opus orquesta/refuta, Sonnet revisa, Haiku volumen,
     Fable solo a pedido de Fak); los 5 candados tal como quedaron en código (nocturno no toca el repo ni
     escribe en Supabase/arb/Outlook; solo lectura por `supabaseSoloLectura`; el test `candadosNocturno`;
     tope mensual pasivo; un paso que falla no deja nada a medias); dónde está la clave y que nunca se
     imprime; que el reporte de la noche es para la sesión, no para Fak. Al tocar una regla, el file-guard
     recuerda el RULE-GATE: el enforcement es `candadosNocturno.test.mjs` + el envoltorio.
   - `CLAUDE.md`: una fila en la tabla de reglas con `paths:` y una línea en "Protocolo de inicio de
     sesión": "si existe `.claude/state/nocturno.json` de hoy, leerlo; los hallazgos de
     `reports/staging/PREAUDITORIA_AMFE_*.md` se verifican contra Supabase antes de nombrarlos; si hay
     clave y la tarea nocturna no está agendada, `node scripts/_nocturno.mjs --agendar` y avisar en una
     línea". Decir al cerrar que CLAUDE.md cambió (las sesiones abiertas hay que reabrirlas, regla
     `mejora-implementada.md`).
   - `docs/LECCIONES_APRENDIDAS.md`: UN bullet (≤ 600 caracteres, formato `- **08/10 — ...**`) en la
     sección de verificación: los créditos del Max no cubren Claude Code; el default de modelo no los
     gasta; solo la API con clave; precios se leen de la tabla oficial, no de un informe.
   - `docs/PLAN_MAESTRO_IMPLEMENTACION_API_CLAUDE.md` (está sin trackear): agregar arriba un bloque
     corto "CORRECCIÓN 08/10/2026" con los tres puntos (créditos no cubren Claude Code; precios; settings)
     y corregir la tabla de precios. No reescribir el resto.
   - `.env.example`: agregar `ANTHROPIC_API_KEY=` con un comentario de dónde sale. El file-guard
     bloquea Edit/Write sobre `.env*`: hacerlo con `printf '...' >> .env.example` desde Bash (el
     secretos-guard exime a `.env.example`).
9. **Cierre**: `npm run build` (debe pasar; los scripts no entran al bundle) → `git add` de las rutas
   nuevas/modificadas de ESTE trabajo → `git commit -m "feat(api-claude): ..." -- <rutas>` →
   `git push origin main` → CI por API (`curl -s "https://api.github.com/repos/facussc24/tiempos-y-balanceos/actions/runs?per_page=1"`).
   Después `node scripts/_claude.mjs --check` y decirle a Fak, en 4 renglones: qué quedó, que tiene que
   pegar la clave con `node scripts/_claude.mjs --pegar-clave` (antes: en claude.ai Configuración >
   Facturación > API credits > Vincular organización; en platform.claude.com > API Keys > crear), y que
   con la clave puesta la noche se agenda sola la próxima vez que una sesión arranque (o con `--agendar`).

## 4. Convenciones y trampas (medidas en el repo)

- Sin shebang y sin bytes NUL en ningún `.mjs` (`convencionesScripts.test.mjs`). Imports con `node:`.
  Lógica pura en `_lib/`, CLI aparte. Argumentos a mano con `CON_VALOR`/`SIN_VALOR` y exit 2 ante
  desconocido ("no conozco el argumento X. No hago nada."), como `_novedadesClaude.mjs:30-40`.
  `console.log` resultados / `console.error` errores; exit 0 ok, 1 problema, 2 argumento, 3 sin clave.
  Fechas LOCALES (`fechaLocal`/`fechaCorte` de `_lib/mailCache.mjs`, `mesLocal`/`selloLocal` de
  `claudeApi.mjs`): después de las 21:00 el día UTC ya es el siguiente.
- Hooks que muerden al escribir archivos (Write/Edit): `file-guard` bloquea `.env*`, `package-lock.json`;
  `mail-guard` bloquea si el contenido tiene olor a Outlook (`Outlook.Application|olMailItem|
  GetDefaultFolder|MailItem|CreateItem(`) junto con `.To =` o `.Send(`. En Bash: `secretos-guard`
  bloquea comandos que nombren `.env.local` con `cat/node/python/...`; `supabase-guard` mira
  `node *.mjs --apply`. Los hooks NO corren para el `node` del Programador de tareas: por eso los
  candados del nocturno son código (envoltorio + test), no hooks.
- `_auditAll.mjs --summary` sale siempre 0 y sin `--summary` ESCRIBE en `tmp/` y `docs/auto-mejora/`:
  no usarlo como gate ni correrlo pelado. Hoy: 21 AMFE, 75 críticos, 1465 avisos (eso es lo "conocido").
- `connectSupabase()` tira si faltan las 4 `VITE_*` de `.env.local`; `loadEnv({ requeridas: [...] })`
  permite otra lista. Para la clave de Anthropic usar `leerClave()` de `claudeApi.mjs` (lee
  `ANTHROPIC_API_KEY` del entorno o de `.env.local` sin imprimirla).
- Repo PÚBLICO: salidas con datos de la empresa solo en `reports/`, `.sgc-cache/`, `.mail-cache/`,
  `.claude/state/`, `tmp/` (todas ignoradas). Cuerpos de mails nunca a un archivo del repo. Un hallazgo
  de la pre-auditoría cita texto de AMFE: va a `reports/staging/` (ignorado), nunca a `docs/`.
- `~/.claude/scheduled-tasks/` no tiene ninguna tarea activa (son `SKILL.md` sueltos); el scheduler que
  manda es el Programador de Windows.
- Techo de agentes: 10 en 10 min, Sonnet 5.5 xhigh (`techo-agentes.md`). Para esta implementación no
  hacen falta agentes: todo está decidido acá.

## 5. Lo único que hace Fak (y cómo dejárselo en dos clics)

1. claude.ai → Configuración → Facturación → **API credits** → "Vincular organización" (elegir la
   organización de platform.claude.com donde va a vivir la clave; no se puede cambiar después sin
   soporte). Requiere 7 días de plan activo.
2. platform.claude.com → esa organización → **API Keys** → crear una clave.
3. En la terminal del repo: `node scripts/_claude.mjs --pegar-clave` y pegarla en el cuadro. Listo.
   Después `node scripts/_claude.mjs --probar` gasta una fracción de centavo y confirma que anda.

## 6. Hallazgos laterales (no son parte de esta tarea; proponérselos a Fak como tarea aparte)

- Bug en dos guardianes: `nube-personal-guard` (`guardianes.mjs:1772`) y `apqp-cliente-guard` (`:1682`)
  comparan `tool === 'write'|'edit'` en minúscula y `parsear()` deja `toolL = 'Write'`: son ciegos a
  Write/Edit (por Bash sí bloquean). Sus tests arman el ctx en minúscula y por eso dan verde.
- `scripts/_tokens.mjs` cuenta cada turno ~2x (ver §1). Corregir por `message.id` antes de volver a medir.
- `_auditInventos.mjs` está muerto (lee un snapshot de abril que no existe).
- `docs/GUIA_AMFE.md` contradice a `amfe.md` sobre AP=H ("acción obligatoria"); está viejo.
- 11 worktrees en `.claude/worktrees/` y la rama `auto-mejora/2026-05-08T2233Z` con 213 commits fuera de
  main.
