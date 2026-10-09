---
description: La API de Anthropic con los creditos del plan Max (vencen por ciclo de facturacion) — que los gasta y que no, que modelo hace que, los 5 candados de la noche de Claude (y sus topes por ciclo y por corrida), donde vive la clave y para quien es lo que deja la noche
paths:
  - "scripts/_lib/claudeApi.mjs"
  - "scripts/_lib/preauditoriaAmfe.mjs"
  - "scripts/_lib/nocturno.mjs"
  - "scripts/_lib/supabaseSoloLectura.mjs"
  - "scripts/_lib/escrituraSegura.mjs"
  - "scripts/_preauditarAmfe.mjs"
  - "scripts/_nocturno.*"
  - "scripts/_claude.mjs"
---

# Regla: la API de Claude (creditos del plan Max)

Verificado contra la documentacion oficial el 08/10/2026 (`platform.claude.com/docs/en/about-claude/api-credits-for-subscribers`
y `.../pricing`). Traspaso completo: `docs/drafts/HANDOFF_API_CLAUDE_2026-10-08.md`.

## 1. Que gasta los creditos y que no

- El plan Max trae creditos de API por ciclo ($100 el Max 5x, $200 el Max 20x). **Vencen al final de cada
  CICLO DE FACTURACION (no el dia 1 del mes) y no se acumulan.** El dia en que se renueva el ciclo es
  `BARACK_API_CICLO_DIA` (1 a 31; por defecto 1 = mes calendario, y en esta PC esta FIJADO EN 30 como variable de usuario de Windows: `setx BARACK_API_CICLO_DIA 30`, 09/10/2026, claude.ai > Facturacion dice «Proximo credito: 30 oct 2026», memoria `reference_api_claude_clave_y_ciclo`; en otra PC es una suposicion hasta que Fak diga
  su fecha de renovacion). Un dia que el mes no tiene (31 en febrero) cae en el ultimo dia del mes.
- **NO cubren Claude Code** ni el uso extra de las apps. El modelo que se elija en Claude Code (Opus,
  Fable) sale del plan, no de los creditos: cambiar el default **no gasta ni ahorra un centavo** de aca.
- Los gasta solo codigo que llama a la API con `ANTHROPIC_API_KEY` de la organizacion vinculada al plan.
  En este repo, **la unica puerta es `scripts/_lib/claudeApi.mjs`**: ningun script llama al SDK por su
  cuenta (asi el gasto queda en el ledger y el semaforo del mes es real).
- Los precios salen de la tabla oficial y viven en `PRECIOS` de `claudeApi.mjs`. Un informe o un post
  no es fuente de precios (el del 07/10 tenia mal Sonnet y los cache reads).

## 2. Que modelo hace que

| Rol | Modelo | Ejemplo |
|---|---|---|
| Orquesta, sintetiza y **refuta** | Opus 5.5 | refutador de la pre-auditoria (`effort: high`) |
| Revisa y escribe documentos | Sonnet 5.5 | revisor de AMFE, resumen de novedades |
| Volumen barato | Haiku 5.5 | una linea por mail sin respuesta (`effort: low`) |
| Deliberar | Fable 5.1 | **solo si Fak lo pide** (cuesta 2,5x Opus) |

El esfuerzo va siempre explicito (Opus y Haiku 5.5 arrancan en `medium`). Opus y Sonnet llevan el
fallback del servidor (`fallbacks: 'default'`); Haiku no lo tiene. Una respuesta rechazada, cortada por
`max_tokens` o con JSON roto es un **error** (`ErrorApi`), nunca un resultado a medias.

## 3. Los 5 candados de la noche (`scripts/_nocturno.mjs`, tarea de Windows 06:30)

La auto-mejora nocturna anterior se apago el 04/08/2026 (47.522 timeouts, fork bomb de `claude -p`).
La nueva es un `node` suelto que habla con la API por el SDK. Los hooks de Claude Code **no corren** para
el `node` del Programador de tareas: por eso los candados son codigo y test, no hooks.

1. **La noche no toca el repo ni escribe en Supabase, el arb u Outlook.** Lee y deja archivos solo en
   carpetas ignoradas (`.claude/state/`, `.sgc-cache/`, `reports/staging/`). **Todo lo que escribe el
   proceso `node` de la noche pasa por `scripts/_lib/escrituraSegura.mjs`** (`escribirSeguro` atomico a
   `.tmp` + renombrar, `agregarSeguro` para el log y el ledger): rechaza con un Error, antes de crear
   nada, cualquier ruta fuera de esas tres carpetas o de las que indiquen `BARACK_API_DIR`,
   `BARACK_PREAUDITORIA_DIR`, `BARACK_NOVEDADES_DIR` y `BARACK_PRECIOS_DIR` (un valor que abriria el repo entero se ignora; se
   compara la ruta real, sin enlaces que salgan). Los tests con carpetas temporales —tambien los que
   pasan `dirLedger`— fijan una de esas variables en `beforeEach`. **Limite**: los scripts que la noche
   lanza como procesos aparte escriben por su cuenta (`_novedadesClaude.mjs` en `.sgc-cache/x-seguimiento/`,
   `_hilosAbiertos.mjs` en `.claude/state/hilos-cache.json`): caen en carpetas ignoradas pero no pasan
   por la puerta.
2. **A Supabase se entra solo por `supabaseSoloLectura.mjs`**: expone `from().select()` y nada mas; un
   `update`/`insert`/`upsert`/`delete`/`rpc` tira (el usuario de `.env.local` SI puede escribir).
3. **`__tests__/scripts/candadosNocturno.test.mjs`** lee el texto de los archivos de la noche y falla si
   aparece algo que guarda APQP, escribe en una tabla, mata procesos, toca el arb, manda mails o lanza
   `claude`, **o si un archivo de la noche escribe con `fs` directo** (`writeFileSync`, `appendFileSync`,
   `mkdirSync`, `renameSync`... solo vale adentro de `escrituraSegura.mjs`). Cada patron tiene su gemelo
   rojo. **Es el enforcement de esta regla** (RULE-GATE).
4. **Topes de gasto, los dos pasivos (deciden ANTES de arrancar, no cortan una llamada a mitad):**
   - **Del ciclo**: `BARACK_API_PRESUPUESTO_USD` (default **170** = el credito del Max 20x con 15 % de
     colchon, porque las estimaciones tienen +/-30 %). Con el ciclo en rojo la noche no arranca (salvo
     `--sin-tope`). El semaforo suma el ledger del ciclo (`ciclo del 07/09 al 06/10`), que puede caer en
     dos archivos `ledger_AAAA-MM.jsonl`.
   - **Por corrida**: `BARACK_API_TOPE_CORRIDA_USD` (default **8**, 3 a 5 veces el costo normal de una
     noche, como recomienda Anthropic). `_nocturno.mjs` lo mira antes de cada paso: si lo gastado en ESTA
     corrida lo supera, los pasos que faltan quedan `saltado` ("tope por corrida ($X de $8)") y la noche
     sale con codigo 1. `--sin-tope` levanta los dos.
5. **Un paso que falla no deja nada a medias ni tumba a los demas**: cada paso con su try/catch, todo se
   escribe a `.tmp` y se renombra, y el envoltorio `_nocturno.ps1` marca ERROR si `node` sale bien pero
   no escribio `.claude/state/nocturno.json` (resultado vacio es error). **Con tres pasos seguidos en
   error la noche se frena sola** (algo de fondo anda mal: sin red, clave vencida) y lo anota en
   `nocturno.json` (`corte`) y en la linea del tablero.

**La pre-auditoria es incremental y con tope por noche**: `estado.json` y el reporte se guardan despues de
CADA AMFE (el envoltorio corta a los 55 minutos; una corrida cortada conserva lo ya revisado y pagado) y la
noche revisa como mucho 6 (`--max`, los de `updated_at` mas viejo primero; los demas quedan para la noche
siguiente sin tocar el estado). Una segunda corrida del mismo dia no pisa el reporte de la primera
(`PREAUDITORIA_AMFE_AAAAMMDD_HHMM.md`).

**Pasos de la noche, en orden**: `preauditoria` · `mails` · `prioridades` · `novedades`.
**Todavia NO son pasos de la noche** (08/10/2026, escritos y con test, falta cablearlos en `nocturno.mjs` y probar
su llamada a la API): el vigilante de precios (`_vigilarPrecios.mjs`, semanal: compara la tabla oficial con `PRECIOS`
y los creditos; el guardado de fixtures es un script aparte, `_guardarFixturesPrecios.mjs`, que escribe en el repo y por
eso no es de la noche), las propuestas de skills (`_propuestasSkills.mjs`, lee los transcripts de Fak) y la prueba de
disparo de skills (`_pruebaDisparoSkills.mjs`). Hasta que se cableen, corren a mano desde la sesion.
- `prioridades`: hasta 4 renglones `1. [fuente] que hacer · por que hoy` que ORDENAN cosas que ya existen
  (seguimientos con fecha, hilos de tareas del Escritorio con mails nuevos, los mails que acaba de resumir
  el paso anterior, carpetas del Escritorio con sus dias, lo que dejo la noche). Una llamada a Sonnet
  `medium`; la `fuente` sale de una lista cerrada que arma el codigo (`seguimiento:<id>`, `hilo:<tarea>`,
  `mail:<asunto>`, `escritorio:<carpeta>`, `noche:<paso>`) y **el codigo descarta todo renglon cuya
  fuente no estaba en la entrada**. Sin entradas no se llama al modelo. Va a `.claude/state/prioridades.md`
  y a `nocturno.json`: es una sugerencia para la sesion de la manana, que la contrasta antes de decirle
  algo a Fak (~$0,03 por noche).
- `novedades` corre **todos los dias**: si lo nuevo trae algo, Haiku `low` (hasta 4 renglones); los lunes,
  o pasada una semana, Sonnet con el resumen largo (hasta 8) sobre los listados de los ultimos 7 dias.
  Como la lectura corre a diario, `avisoHook` ya no avisa al arrancar la sesion.

**Variables de entorno** (todas opcionales): `BARACK_API_PRESUPUESTO_USD` (170) · `BARACK_API_CICLO_DIA` (1) ·
`BARACK_API_TOPE_CORRIDA_USD` (8) · `BARACK_TOKENS_POR_CARACTER` (3,5: es en realidad *caracteres* por token;
`--simular` muestra el rango x1,0 a x1,3 porque el tokenizador nuevo da hasta 30 % mas, y lo medido con
`count_tokens` no se infla) · `BARACK_API_DIR`, `BARACK_PREAUDITORIA_DIR`, `BARACK_NOVEDADES_DIR`, `BARACK_PRECIOS_DIR` (carpetas de trabajo).

## 4. Lo que la maquina NO hace (decisiones del proyecto, al pie de la letra)

- Ningun modelo propone S/O/D, controles, acciones ni texto de reemplazo: **senala**. "La maquina puede
  MATAR un hallazgo, nunca APROBAR un dato" (`coordinador.md`): por eso el segundo paso es un refutador.
- Un AP=H con la accion vacia es estado VALIDO (`amfe.md` §4): lo filtra el codigo aunque el modelo lo
  diga. Un hallazgo sin cita textual no es hallazgo.
- Los mails se **etiquetan** por area, no se filtran (la respuesta de Calidad que espera el seguimiento
  de la reunion de AMFE no se puede tapar).

## 5. La clave

- Vive en `.env.local` como `ANTHROPIC_API_KEY=...` (o en el entorno). **Nunca se imprime, nunca pasa
  por el chat.** La lee `leerClave()` por dentro.
- La pone Fak con `node scripts/_claude.mjs --pegar-clave`: un cuadro de Windows con el texto tapado; la
  escribe PowerShell (copia previa `.env.local.bak-<fecha>.local`, ignorada por git). Claude no edita
  `.env*` (file-guard).
- `node scripts/_claude.mjs --check` dice que falta (clave, acceso, presupuesto, tarea agendada, edad de
  la ultima noche). **La tarea nocturna se agenda recien con la clave** (`--pegar-clave` lo hace solo si
  la API responde; si no, `node scripts/_nocturno.mjs --agendar`).
- **Desde la app de Claude el cuadro de `--pegar-clave` NO se ve** (09/10/2026: el proceso y su ventana existen, pero no aparecen ni lanzado desde la consola interna de la sesion ni desde la terminal del panel). Lo que anduvo: pegarla en la terminal del panel con `Read-Host -AsSecureString` (asteriscos) y la misma escritura que `scriptPegarClave()`. En la cola: que `--pegar-clave` detecte la app y pida por terminal. Memoria `reference_api_claude_clave_y_ciclo`.

## 6. Para quien es lo que deja la noche

- `.claude/state/nocturno.json`, `.claude/state/prioridades.md` y `reports/staging/PREAUDITORIA_AMFE_AAAAMMDD*.md`
  son **archivos de trabajo para la sesion de la manana, no para Fak**. Cada hallazgo es una candidata: se abre el AMFE en
  Supabase, se verifica la cita contra la fuente, se descarta lo que sea convencion de la casa, y a Fak
  se le lleva solo lo confirmado, en pocas lineas, sin informe.
- El repo es publico: nada con texto de AMFE ni cuerpos de mails va a un archivo versionado.
