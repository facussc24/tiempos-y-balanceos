# Auditoría final de la tanda 6 (vista del chat y programita) — 17/10/2026

Rama `claude/vista-tanda6-1017`, worktree `.claude/worktrees/vista-tanda6-1017`, 3 commits sobre `main` 4322d932
(7b58b603, 675a7b67, c9982d46). **Lo auditado es c9982d46.** A mitad de la auditoría la sesión madre editó cinco archivos
sin commitear (`programita.mjs`, `_programita.mjs`, `programita.test.mjs`, `mockups.mjs`, `mockups_chat/index.html`):
sacan el nombre de la tarea de Windows de la página, cambian «anda» por «disponible», importan `RAIZ_APP` y aclaran
de dónde salen los colores. **Ese diff no toca `leerSeguimiento`, `leerResultado`, `armarTarea` ni `leerWindows`**: los
hallazgos 1 a 4 valen igual para el árbol de ahora. Las líneas citadas son las de c9982d46.

## Resultado: FALLO · 5 Importante, 7 Nit, 1 Preexistente

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `tsc --noEmit`: 0 errores |
| Build | OK | `npm run build` en el worktree: `built in 34.60s`, salida 0 (la rama no toca la app) |
| Tests | OK | `programita.test.mjs` 14/14 (2 de punta a punta, 64 s) + `convencionesScripts.test.mjs` 3/3 |
| ESLint (sonda) | Nit | la config del repo no le pone reglas a `.mjs`; con `js.configs.recommended`: 1 variable sin usar (`programita.mjs:130`, `ahora`) |
| Git local | aviso | árbol con 5 archivos modificados por la sesión madre durante la auditoría (no míos) |
| GitHub sync | aviso | los 3 commits no están en GitHub: lo esperado para una rama de hija (la mergea la coordinadora) |
| CI | OK en main | `candado.yml` completed success 4322d932 · `deploy.yml` completed success 411f200f; la rama no corrió en CI |
| Convenciones | OK | salida 2 ante `--foo`, `--repo` sin valor y `--una-vez=1`; sin `as any`; comentarios en castellano |
| Logo | OK | `tools/flowchart/assets/barack_logo.png` sha1 `5d9207e12856c1a7ef4c6185380fe0dacb814b70` |

Las pruebas que armé quedaron en el scratchpad de la sesión (se pueden volver a correr con `node <archivo>`):
`seg_real.mjs`, `replay_resultado.mjs`, `sesion_madre.mjs`, `esperas_largas.mjs`, `categorias.mjs`,
`titulos_claude.mjs`, `contrastes.mjs`, `eslint.sonda.config.mjs`.

---

## Hallazgos Importantes (TRUE BUG)

### 1. [Importante] La impresora nunca sale «imprimiendo» ni «el detector avisa» con el `bambu_red.py` de hoy

`scripts/_lib/programita.mjs:153` (y el comentario de la `:145`) leen renglones `HH:MM:SS ESTADO etapa …`. Desde
b47e890d (16/10 14:31, «--seguir … sobrevive a las relanzadas») `linea_de()` escribe la fecha completa con la zona:
`bambu_red.py:2247` → `f"{_iso()} {gcode_state} etapa …"`, con `_iso()` = `2026-10-16T13:20:05-03:00`. El test de la skill lo
exige (`tests/test_bambu_red.py:362`: `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d FINISH`). Los cuatro
`seguimiento.log` que hay en esta PC son de antes del cambio, y de ahí salieron los ejemplos del test
(`programita.test.mjs:3` dice «la forma REAL de los registros»; `:79` es formato viejo).

**Caso medido** (`seg_real.mjs`): los 4 registros reales cortados renglón por renglón, a 30 s de cada lectura.

| Registro | Formato viejo (como están) | El mismo, con la fecha como la escribe hoy |
|---|---|---|
| virolador_v14 (67) | 66 verde «imprimiendo», 1 gris «no imprime» | 67 gris «sin datos de capa» |
| prueba_3_fichas (22) | 21 verde, 1 gris | 22 gris «sin datos de capa» |
| molde_probeta (473) | 472 verde, 1 gris | 473 gris «sin datos de capa» |
| placa_v2 (33) | 32 verde, 1 gris | 33 gris «sin datos de capa» |

Un renglón con `| ALARMA DEL DETECTOR` en el formato de hoy da `{"color":"gris","palabra":"sin datos de capa"}`; el
mismo con la hora sola da rojo «imprimiendo: el detector avisa». Es la alarma que la página promete mostrar.

**Después del arreglo de la regex, dos casos más** (no son hallazgos aparte):
- `SIN CONEXION desde las …` (`bambu_red.py:2336`) se escribe en cada vuelta: el archivo queda fresco y el último estado
  leído es RUNNING → la página diría verde «imprimiendo» con la vigilancia sin conexión.
- Con `--en-pausa` la vigilancia escribe cada `EN_PAUSA_CADA = 300` s (`bambu_red.py:1687`), igual al umbral de
  «reciente» (5 min, `programita.data.json:7`): una pausa va a saltar entre «en pausa» y «no imprime».

Patrón de arreglo sugerido: aceptar las dos formas al principio del renglón (ISO con zona y `HH:MM:SS`), tomar la hora
del renglón en vez del `mtime`, leer `SIN CONEXION` como su propio estado, y un test con un renglón armado como
`linea_de()` de hoy. · respuesta: ____

### 2. [Importante] «El arb queda abierto» sale verde por Windows y su propio registro dice que el arb está cerrado hace 15 horas

`scripts/_lib/programita.data.json:44-50` le pone `"registro": null, "lector": "windows"` y `programita.mjs:105` dice
«según Windows (no deja registro propio)». Sí deja: `_arbLanzar.py:31` → `~/arb_fotos/lanzador.log`, `:80` →
`vigilante_estado.txt` (ACTIVO / PAUSADO) y `:127` → `vigilante_latido.txt` (su último paso, reescrito en cada vuelta).
Es la regla de fondo del propio programita (`programita.mjs:10`: «el verde o el rojo de una tarea sale de SU registro»).

**Caso medido, hoy:** `lanzador.log` desde el 16/10 20:02:44 tiene 300 vueltas seguidas de «el arb esta cerrado; lo abro
/ servidor no responde (\\server\sistema\arb\prod\produc.exe) / sin red al servidor»; el último «login OK» es del 16/10
09:02:42. A la misma hora, Windows: `Barack - ARB siempre abierto | Ready | res 0` y la página que generé
(`--una-vez --sin-abrir --sin-medir`) dice **verde «corriendo — según Windows»**: «El arb queda abierto» en verde,
con el servidor sin contestar desde el 16/10 20:02:44.

Patrón sugerido: un lector para el arb con `vigilante_latido.txt` (hora + paso de la última vuelta; ahora dice
`17/10 11:20:21 pid 12232 abriendo el arb`) y `vigilante_estado.txt`, más el último renglón del log para el motivo. El
latido es mejor fuente que el log porque `log_sin_repetir()` (`_arbLanzar.py:150`) no repite renglones iguales: con
todo andando el log se queda callado. · respuesta: ____

### 3. [Importante] Una corrida que se murió sin anotar RESULTADO sale verde con el resultado de la corrida anterior

`scripts/_lib/programita.mjs:57-63`: si después del último `RESULTADO` hay renglones de hace menos de 20 min, «corriendo»;
si son más viejos, cae al `RESULTADO` anterior y pinta «terminó bien». Una corrida que arrancó y se cortó queda tapada
por la buena de antes, hasta que salta el atraso. Es un control que falla abierto (REVIEW.md, punto 9).

**Caso medido** (`replay_resultado.mjs`, el registro real repetido cada 5 min, cortado a lo escrito a esa hora), con la
PC prendida (hay renglones después):
- `.mail-cache/sync-diario.log`, 25/09: arranca a las 12:56 («Outlook expone 3025 items; arranco el sync») y no anota
  resultado; la siguiente corrida arranca a las 16:33. La página habría dicho verde «terminó bien» (la de la mañana) de
  13:18 a 16:28: **195 min**.
- Mismo registro, 30/09: arranques a las 14:54, 15:48 (Outlook reabierto) y 16:05 sin resultado, hasta el ERROR de las
  18:26: verde 15:18-15:43 y 16:28-18:18.
- En total, 5 tramos en `sync-diario.log` (hasta 265 min, el 15/09 desde las 16:31) y 1 en `nube-sync.log` (12/10
  17:39, «inicio» solo; ese probablemente con la PC apagada).

Patrón sugerido: con renglones después del último `RESULTADO` y el último de hace más de 20 min, decir «la última
corrida no terminó (empezó a las HH:MM)» en rojo o ámbar, nunca el resultado anterior; test con el caso del 25/09.
· respuesta: ____

### 4. [Importante] El atraso «doble del intervalo + 15 min» no tiene fuente y no calza con los disparadores reales

`scripts/_lib/programita.mjs:118` con los `cada_minutos` de `programita.data.json:28, 35, 42`. Es un número sin fuente
(REVIEW.md, punto 2) y falla en las dos direcciones:

- **Rojo falso todas las noches** en «Los mails se copian a la PC»: el canon dice 240 min, pero el disparador real
  (`Get-ScheduledTask`, solo lectura) es diario a las 08:30, cada 4 h durante 10 h → 08:30, 12:30 y 16:30. Después de
  la de las 16:3x el límite (495 min) vence a las ~00:50 y la página pinta **rojo «atrasada» hasta las 08:32** sin
  ninguna corrida perdida. Medido sobre `sync-diario.log`: **60 tramos de 460-465 min**, uno por noche (el último: sáb
  17/10 00:53 → 08:28). Que la PC está prendida de noche lo prueba `mails.log` (17/10: 00:37, 02:37, 04:38 y 06:37, todas
  con código 0): el rojo falso está en la página de ~00:50 a 08:32 con la PC prendida.
- **Rojo tarde en la copia semanal**: 2 × 10080 + 15 = 14 días. Un lunes sin copia sigue verde «terminó bien» hasta el
  día 14, y el propio `scripts/_backupSemanal.ps1:4-8` dice que el plan gratis de Supabase pausa el proyecto a los 7 días
  sin actividad y que esta tarea es la que lo mantiene despierto. La noche tiene lo mismo: una noche que no corrió
  sigue verde 48 h.

Patrón sugerido: comparar contra lo que Windows ya devuelve de cada tarea (`LastRunTime` / `NextRunTime`): atrasada si
Windows la corrió y el registro no anotó nada después, o si la próxima corrida quedó en el pasado. · respuesta: ____

### 5. [Importante] La página dice «Claude» (c9982d46); el arreglo en curso tapa el nombre de la tarea y no los títulos de las sesiones

En c9982d46, `programita.mjs:208` escribe `t.nombre` debajo de cada tarea: la página que generé tiene
`<div class="cu">Barack - Noche de Claude (API)</div>` y `py -3 scripts/_sinFirmaIA.py <tareas.html>` da
**`[BLOQUEANTE] … contenido: nombra a Claude`**. El diff sin commitear de la sesión madre saca `t.nombre` (bien).

Lo que queda: `programita.mjs:209` escribe el título de cada sesión (`s.titulo`) y el id de la tarea que la lanzó
(`s.tarea`) tal cual. Medido en los registros de la app (`titulos_claude.mjs`): **4 sesiones de los últimos 7 días tienen
«claude» en el título**, por ejemplo «Tanda 10: cola limpia, lección, viernes, novedades-claude» (última actividad 16/10
15:29 hora de acá: con la ventana de 12 h habría salido en la página hasta las ~03:29 de hoy), y hay ids como
`sesion-sistema-claude-fase2-20261010`. El test (`programita.test.mjs:109`, `not.toMatch(/claude/i)`) arma la página con
`sesiones: []`: no puede ver esto. Si la página cuenta como documento de Barack lo decide Fak; la sesión madre ya la trató
así al sacar el nombre de la tarea. Sugerido: un test con un título real de sesión y correr `_sinFirmaIA.py` sobre la
página generada. · respuesta: ____

---

## Nits (ROBUSTNESS; 3 de 7)

- **[Nit] `docs/MOD_AGENTES_PENDIENTE_2026-10-17.md:53`** — dice que `$.ui.view({ agentId })` está en «el programa
  instalado (2.1.301)». Es cierto para el `claude` de la terminal (`~/.local/bin/claude.exe`, `VERSION:"2.1.301"`, el
  binario trae `ui.view({ agentId })` y `ui.view({})`), pero el mod es para la app y el motor de la app es el 2.1.299
  (`CLAUDE_CODE_EXECPATH = …\claude-code\2.1.299\f0584be0fbaf\claude.exe`): ese binario **no tiene ninguna** `ui.view(`
  (grep sobre los dos). El documento ya pide «verificar ahí antes de usarlo»; falta decir que hoy la app no lo trae.
  Lo mismo en `TANDA6_MODS_VALIDATE_TEST_2026-10-17.md:3`: `validate` y `test` corrieron solo con el 2.1.301. · respuesta: ____
- **[Nit] `tools/vista_chat/mockups.mjs:53, 65, 77`** — las paletas de los skins están bien (comparadas campo por campo
  contra los cinco `hooks/themes/<skin>.ts` que bajó la madre a `%TEMP%\skins_src`), pero hay colores sin decir de dónde
  salen o atribuidos a quien no los propuso: en «Azul noche» el gris secundario `#9fb3c8` es del informe y la tarjeta lo
  da como «skin nord (texto…)» (el `muted` de nord es `#7b88a1`: 4,51 de contraste sobre ese fondo, no 7,5); en «Plano de
  planta» «los grises claros son la propuesta del informe» y el informe (§4, renglón 59) solo trae `#ECEFF1` y `#111827`
  (los otros seis grises son de la maqueta). Y el ámbar «ojo» no está en la tabla de contraste: en «Plano de planta» da
  4,21. · respuesta: ____
- **[Nit] `scripts/_backupSemanal.ps1:36-43` + `programita.mjs:59`** — la copia escribe «backups/ ocupa N MB» DESPUÉS
  del `RESULTADO`, recorriendo 800-1.850 MB. Si eso cruza el minuto, `leerResultado` ve un renglón más nuevo que el
  resultado y dice verde «corriendo» 20 min, también después de un `RESULTADO: ERROR`. Hoy, 4 de 4 corridas cayeron en
  el mismo minuto. · respuesta: ____

Y 4 nits más (`leerMails` pinta rojo «roto» resultados con código 0 como `parcial`, `apagado` o `pausado`; `--cada 0`
deja una vuelta de 1 s con PowerShell; el logo se copia solo si falta y no se refresca; `ahora` sin usar en
`estadoSesion`).

## Preexistente

- **[Preexistente] `hojalib_selftest.py:25` y `patronlib_selftest.py:49`** — `mkdtemp` sin borrar: cada corrida deja
  ~1,1 MB en `%TEMP%` (hoy hay 10 carpetas). El programita los corre cada 6 h mientras la página está abierta; no es
  del cambio. · respuesta: ____

## Pregunta abierta (no es hallazgo)

- La nube da rojo «falta subir 46 archivo(s) (52,1 MB)» en las dos mediciones de hoy (11:01 y 11:04). Los ejemplos que
  muestra son los más viejos por fecha de creación: `._0.jpg` de 0 MB dentro de `__MACOSX`. No medí si esos 46 suben
  alguna vez; si nunca suben, la página va a tener un rojo fijo.

---

## Lo que se miró y está bien (FALSE POSITIVE descartados, para no volver a investigarlos)

- **Sesión esperando un subagente en primer plano → rojo «cartel de permiso»**: en 56 conversaciones de los últimos 3 días
  hubo 0 llamadas a `Agent` en primer plano de más de 10 min (acá los agentes van de fondo; solo 7 `Bash`). La sesión que
  me lanzó lo hizo de fondo: `estadoDe` da `termino` y la página «terminó: para revisar» ahora y dentro de 15 y 40 min.
- **`estadoSesion`**: en los 617 registros de la app, `status_category` vale solo `completed` (156), `blocked` (39),
  `review_ready` (13) o no está (409); los cuatro casos tienen su rama. `isArchived` es `false` en todos.
- **BOM** al principio de `nube-sync.log`, `sync-diario.log` y `mails.log`: `trim()` lo saca; el primer renglón se lee bien.
- **La noche real** (`nocturno.json` de hoy, `noArranco` por presupuesto) sale ámbar «no corrió: API gastada», que es lo
  correcto; `_nocturno.mjs` escribe el archivo solo al final, así que no hay «terminó bien» de una noche en curso. La
  `pausa` de la tanda 5 entra por `leerNoche` del tablero (`enPausa`).
- **`mails.log`**: 99 renglones; 88 `ok`, 8 `outlook_cerrado`, 3 `outlook_no_responde`; el de las 10:37 sale rojo con su
  motivo y los de código 0 + `ok`, verdes. Los `sin nube: …` sueltos salen rojos.
- **Código 267009** de Windows = tarea corriendo (`SCHED_S_TASK_RUNNING`): bien leído.
- **Paletas**: los 5 skins, todos los campos copiados, iguales al código bajado. **Contraste**: recalculado con una fórmula
  propia, igual (texto de «Papel» 14,37; el informe dice 14,4). La «Hoy» sale de colores medidos en la sesión madre
  (`chat fondo #151515`, `barra lateral #111111`).
- **Logo** oficial (sha1 de arriba). **Nombres de archivo** de la página (`tareas.html`, `logo.png`, `medido.json`,
  `impresora.jpg`, `Abrir tareas en segundo plano.cmd`): ninguno dice «Claude».
- **Escrituras**: el programita escribe solo en `--salida` (logo, `medido.json` si mide, `impresora.jpg`, `tareas.html`);
  `_nubeSubio.ps1` solo lee; `bambu_red.py --selftest` es «sin red». Los tests de punta a punta usan `--repo`, `--salida`,
  `USERPROFILE`, `HOME`, `APPDATA` y `LOCALAPPDATA` en una carpeta temporal, con `--sin-abrir --sin-windows
  --sin-sesiones --sin-medir`: no abren ventana ni leen lo de Fak.
- **Documento del mod**: los números de estrellas y licencias coinciden con el informe del 15/10; los tipos de agente con
  `techo-agentes.md` y `.claude/agents/`.

## Acciones requeridas (las decide la sesión madre con OK de Fak; no apliqué nada)

1. Hallazgo 1: aceptar el formato de fecha de hoy en `leerSeguimiento` y test con un renglón de `linea_de()`.
2. Hallazgo 2: lector propio para el arb (latido + estado del vigilante).
3. Hallazgo 3: «la última corrida no terminó» en vez del resultado anterior.
4. Hallazgo 4: atraso contra el horario que da Windows, no contra un intervalo fijo.
5. Hallazgo 5: commitear el arreglo en curso y decidir (Fak) qué hacer con los títulos de sesión.
