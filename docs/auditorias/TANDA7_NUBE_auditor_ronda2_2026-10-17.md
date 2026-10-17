# Auditoría final, ronda 2 (la última) — tanda 7 «la nube»

Fecha: 17/10/2026 · Rama `claude/nube-tanda7-1017` · **Commit auditado: df312500** (solo su diff, contra 2ede013d).
Auditor: agente `auditor` (Opus), solo lectura. No se editó código. No se escribió, movió ni abrió nada solo-nube.

**El HEAD se movió durante la auditoría.** 3b1879af («ronda 2 del revisor-pedido») entró a las 11:58:45; los `.md` de
`exports/explicaciones/` se regeneraron a las 11:57 y 11:58. No lo audité entero:
- Toca las etiquetas de `pcs`, dos textos del simulado y del mapa, y el renglón de Pedro y Federico.
- No toca `reTramo`, `buscarReferencias`, `lineaDeRuta`, `quienEscribe`/`quienPorNombre` ni el canon de búsqueda.
- Por eso lo de abajo vale también para HEAD; lo revisé en los `.md` regenerados (11:58).
- Arregla dos cosas que yo iba a marcar: el renglón «Copiados en otras PC… Corren en las PC de Carlos, de Calidad, de
  Pedro o de Federico», y la fila «La PC de Calidad», que era la misma notebook CATA de la fila de arriba (confirmado:
  `2- Mails de Calidad\LEEME.txt` dice «para la notebook de Calidad que le dieron a Facundo Santoro»).

## Resultado: FALLO en el mapa (el simulado queda bien para la mudanza)  ·  2 Importante, 3 Nit (y 3 nits más), 0 Preexistente

| Check | Estado | Detalle |
|---|---|---|
| Tests del módulo | OK | `npx vitest run __tests__/scripts/nubeOrden.test.mjs`: 34/34 a las 11:48:59 (df312500) y 34/34 en 3b1879af |
| ESLint de los 4 archivos | sin valor | `npx eslint …`: salida 0, pero `--print-config` da **0 reglas** para los `.mjs`. Con `js.configs.recommended` (config en el scratchpad): 2 errores en renglones que df312500 no tocó, y los dos son a propósito (el BOM de `nubeOrden.mjs:393`, el `\x00` de `nubeOrden.test.mjs:60`). Ningún `no-undef` ni `no-unused-vars` en lo nuevo |
| Regla 1: nada escribe, mueve ni borra en la nube | OK | Escrituras: solo `writeFileSync(salida)` de los dos CLI y el temporal de `medirPorAtributos`. El `.ps1` tiene solo `WriteAllText($Salida)` y el `Get-Content` de su entrada; no tiene Move, Remove, Copy, Rename ni New-Item. Lo nuevo que toca la nube es `readdirSync` + `statSync` de `mails\_entrada` (nombres) |
| Regla 2: no se abre nada solo-nube | OK | Lo nuevo que se lee: `%LOCALAPPDATA%\BarackMailsFak`, `BarackMailsPC` y `BarackEquipo`. Medido con `Get-Item`: carpetas comunes (0x10, sin LinkType) y 0 enlaces adentro. Lo mío: solo atributos, más dos LEEME con 0x420. C: libre 6,16 GB antes y 6,15 GB después de mi recorrida |
| `.ps1` sin no-ASCII | OK | `nubeMedir.ps1`: 6.311 bytes, 0 mayores que 127 |
| LEEME de 5 renglones sin Claude ni IA | OK | 14 de 14 (7 por nombre) tienen 5 renglones y tildes. `firmaIaEnTexto` da `[]` y el guardián real `firmaIaEnEscritura(texto, <biblioteca>\<carpeta>\LEEME.txt)` da `null` |
| Un argumento desconocido frena | OK | `--xyz`, `--aplicar` y `--nombre=X` dan salida 2 en los dos CLI, antes de `buscarBiblioteca` |
| TypeScript, build y CI | no corridos | El diff no toca TypeScript y la rama no está en GitHub. Esta ronda es solo el diff |

## La ronda 1 contra la respuesta

| # | La respuesta dice | Medido |
|---|---|---|
| A1 | entra `%LOCALAPPDATA%`, y el LEEME 4 y el paso 4 ya no dicen «Carlos y Calidad» | **Resuelto.** `BarackMailsFak/subir.ps1` y `programas/mails_area.mjs` figuran. El paso 4 lista `calidad`, `cbaptista`, `f.santoro` y `lucca.tuccio`, que son las 4 carpetas de `_entrada` medidas con `Get-ChildItem`. |
| A2 | alias, y «test con el renglón real» | **Resuelto en el resultado, no en el renglón** (Nit 1). `mails_area.mjs` sale por nombre, pero por los renglones 70 y 512. El 437, el que rechaza, sigue sin salir. El test (`nubeOrden.test.mjs:98`) usa un renglón inventado. |
| A3 | `fraseEspacio()`, y los CLI ya no dicen «nada se bajó» | **A medias** (Nit 2). La frase de arriba está bien. Queda `_nubeMapa.mjs:99` («el espacio libre de C: de arriba es la prueba»), el renglón que cité en la ronda 1. |
| N1 | `reTramo` acepta `\|`, `[` y `]` | **No resuelto** (Nit 1). Antes del nombre se agregaron `\|` y `[`, pero no `]`. `guardianes.mjs:535` sigue sin contar para «Claude Fak», que era el caso del hallazgo. |
| N2 | los `_fuente` de un canon no cuentan | **Resuelto.** El `_fuente` de `temasCanon.data.json:3` ya no sale. |
| N3 | LEEME 1: «su propio LEEME dice qué archivo se abre» | **Resuelto.** |

## Hallazgos Importante

### [Importante · TRUE BUG] 1. En el mapa, `lineaDeRuta` esconde programas que sí arman la ruta a una carpeta de la biblioteca
- **Dónde:** `scripts/_lib/nubeOrden.mjs:150-153`, que pide una barra pegada al nombre o la carpeta de arriba en el mismo renglón. Lo llaman `scripts/_nubeMapa.mjs:138` (primer nivel con nombre común) y `:143` (todo el segundo nivel).
- **Caso medido:** corrí la búsqueda vieja (`git show 2ede013d:scripts/_lib/nubeOrden.mjs`) y la nueva sobre los mismos 1.766 archivos locales: repo, `~/.claude` y `%LOCALAPPDATA%`, sin las copias de la nube. Archivos de código que **salen del todo**:
  - En `INGENIERIA BARACK (NUNCA BORRAR)` se pasa de 27 a 23:
    - `scripts/_lib/nubeRutas.mjs:53`: `cand.find((p) => esCarpeta(join(p, 'INGENIERIA BARACK (NUNCA BORRAR)')))`. Es la función que elige cuál es la biblioteca.
    - `scripts/_datosExportar.mjs:64`: `CARPETA_EN_LA_BIBLIOTECA = ['INGENIERIA BARACK (NUNCA BORRAR)', '1- GENERAL', 'AMFE', 'DATOS']`.
    - `.claude/skills/impresion-3d-bambu/scripts/bambu_red.py:41` y `instalar_detector.py:17`: `/ "INGENIERIA BARACK (NUNCA BORRAR)" /`.
  - En el segundo nivel:
    - `Base Claude Ingenieria\contenido` queda en «—»: se pierden los 8 renglones de `scripts/_paquete.mjs`, del tipo `path.join(nube, 'contenido', …)`.
    - `INSTALAR EN UNA PC NUEVA\1- Mi asistente completo` queda en «—»: se pierde `tools/instalar_mi_pc/publicar.mjs:23`, `SUBCARPETA = '1- Mi asistente completo'`.
    - `Claude Fak\viernes-17-plan-sistema` pierde `scripts/_frenosMedir.mjs:32`: `path.join(buscarNube(), 'viernes-17-plan-sistema', …)`.
    - `Claude Fak\claude-memoria` pierde `scripts/_lib/nubeRutas.mjs:67`.
  - Lo confirma el `.md` regenerado a las 11:58: `contenido` y `1- Mi asistente completo` tienen «—» en Programas, y `viernes-17-plan-sistema` tiene 1.
- **La forma que se pierde:** el nombre como texto entre comillas, dentro de un `join`, de un `Path / … /` o de una lista. Pasa cuando no hay barra pegada y la carpeta de arriba sale de una variable (`nube`, `buscarNube()`) o de otro renglón. En el primer nivel no hay carpeta de arriba que lo rescate.
- **Lo que el arreglo hace bien, medido en la otra dirección:** saca lo que tenía que sacar:
  - el `OBSOLETO` de `serverPaths.mjs:22`, que es el servidor;
  - las rutas `HO:` de `vocabularioPlanta.data.json`;
  - la lista `podar` de `dispositivosRaices.data.json:60`;
  - `PROYECTOS[proyecto]` de `_paquete.mjs:2635`;
  - TAOS y MIRGOR de `_pdfSemielaboradosArb.py:70`;
  - la «politica» de `_mails.py:467`.
- **Alcance:** el simulado no usa `lineaDeRuta`, así que la lista de lo que hay que cambiar antes de mover no cambia y **no frena la mudanza**. El que cuenta de menos es el mapa, que es de donde sale el plan por carpeta. El test (`nubeOrden.test.mjs:108`) prueba un solo caso que tiene que quedar, y es con la carpeta de arriba en el mismo renglón.
- **Patrón de arreglo sugerido** (lo decide la sesión principal): aceptar también el nombre entero entre comillas como argumento de una ruta (`join(`, `Path(`, `/ "…" /`, o una lista que tenga otro tramo conocido). Agregar un test por cada forma de arriba, que tenga que quedar, al lado de los cuatro que tienen que salir.
- respuesta: ____

### [Importante · ROBUSTNESS, exactitud] 2. «Quién escribe» le pone dueño a la carpeta entera por un solo archivo, y en `6- ARCHIVO DE CORREO` nombra a quien no la escribe
- **Dónde:** `scripts/_lib/nubeOrden.mjs:259` (`quienEscribe`) decide solo con `ultimo_nombre` y `ultimo_carpeta`. La regla de mails está en `scripts/_lib/nubeOrden.data.json:120`: `6- ARCHIVO DE CORREO` o `.eml`/`.msg` dan «la copia de mails (la escriben los programas de mails de cada PC)». Esa regla está fijada en `nubeOrden.test.mjs:250`.
- **Caso medido** (`Get-ChildItem`, solo atributos):
  - **`1- GENERAL`**, que el encargo pidió verificar, sale «un programa de la casa (deja un archivo por PC)».
    - De los 466 archivos cambiados en 30 días, solo 2 tienen nombre de PC.
    - El resto se reparte así: 125 en `5. 3D\VWA`, 112 en `AMFE\DATOS`, 66 en `TAREAS CERRADAS\2026`, 32 en `BOMS`, 31 en `MEJORAS DE PROCESO`, y siguen.
    - El más nuevo sí lo escribe un programa: `registro\DESKTOP-90DOEFV.jsonl` sale de `registro.py:115`, `CARPETA / f"{socket.gethostname()}.jsonl"`.
    - El mismo rótulo le toca a `INGENIERIA BARACK (NUNCA BORRAR)`, con 9.724 archivos recientes.
  - **`6- ARCHIVO DE CORREO`**:
    - Los 5 más nuevos son `.eml` en `CALIDAD - QUALITY PROJECTS\<año>\AAAA-MM-DD_HHMM_asunto.eml`, del 14/10 10:49 y del 08/10 15:06-15:07.
    - Esa forma (`<ROL>/<AAAA>/…eml`, más `ADJUNTOS/` y `_indice.jsonl`) es la que dice `scripts/_archivoCorreo.py:12-16`. Ese programa archiva un buzón de Outlook (`.ost`) y recibe el destino por argumento (`--destino`).
    - Los programas de mails de cada PC escriben en `_CUARENTENA_Claude Barack\mails\_entrada`.
    - Ningún programa del alcance nombra `6- ARCHIVO DE CORREO`: el propio mapa le pone «—» en Programas, y en `tools/` hay 0 coincidencias.
    - **Quién lo corrió el 14/10 no lo medí.**
- **Qué pasa:** la columna se lee como «quién escribe esta carpeta» y para dos de las carpetas grandes dice algo que sus propios números no sostienen. En el archivo de correo, además, el programa que nombra no es el que escribe ahí.
- **Patrón sugerido:** escribir «el más nuevo lo dejó X» en vez de ponerle dueño a la carpeta, o contar por regla todos los recientes (`nubeMedir.ps1` ya los recorre). Para `6- ARCHIVO DE CORREO`, nombrar `_archivoCorreo.py` (archivo de un buzón, se corre a mano) o dejar «no se sabe».
- respuesta: ____

## Hallazgos Nit (tope 3)

- **[Nit] El borde del tramo sigue sin ver los dos renglones reales de la ronda 1** (`scripts/_lib/nubeOrden.mjs:74-79`).
  - Probado con `reTramo` y `buscarReferencias` sobre los archivos reales:
    - `tools/claude-area/mails_area.mjs:437`, `/^(?:_cuarentena_)?claude barack$/`, da `false`, porque antes del nombre hay un `?`;
    - `scripts/_lib/guardianes.mjs:535`, `[\\/]Claude Fak(?=…)`, no da ningún renglón para «Claude Fak», porque `]` se agregó solo después del nombre.
  - Los dos tests nuevos (`nubeOrden.test.mjs:98` y `:104`) usan renglones inventados, que sí pasan.
  - No cambia la lista: `mails_area.mjs` sale por el 70, y el paso 3 nombra `FIRMA_EXENTOS_RE`.
  - respuesta: ____
- **[Nit] Queda la «prueba» por el libre de C:, que era el Importante 3 de la ronda 1.**
  - `scripts/_nubeMapa.mjs:99` (`:102` en HEAD) sigue diciendo «Ningún archivo se abrió, y el espacio libre de C: de arriba es la prueba». Está en el renglón 258 del `.md` de las 11:58.
  - Si la frase nueva sale por la rama de la baja, el mismo documento dice las dos cosas.
  - Esa rama, además, da una causa que no se midió: «lo usó otro programa de la PC en ese rato» (`nubeOrden.mjs:296`). En la ronda 1 la causa quedó sin determinar.
  - respuesta: ____
- **[Nit] El alias «Claude Barack» mete un falso positivo por el filtro de la carpeta de arriba**, que mira el archivo entero (`nubeOrden.mjs:137`) y no aplica `excluir_linea_si`.
  - `scripts/_paquete.mjs` nombra «Claude Barack» una sola vez, en el renglón 585: `path.join(env.ProgramFiles, 'Claude Barack', …)`. Ese renglón está excluido, pero el archivo entero igual pasa el filtro.
  - Con eso, en el mapa, `_CUARENTENA_Claude Barack\marketplace` suma los renglones 139, 142, 2365 y 2367 de `_paquete.mjs`. Son el `marketplace/` del paquete por área (`RAICES_POR_PROYECTO.area`).
  - La fila muestra 3 programas y los 3 hablan de `CLAUDE POR AREA\…\marketplace`.
  - El `_paquete.mjs` del repo entró por el alias: lo medí, la sonda lo da como NUEVO.
  - Su copia en la nube tiene la misma forma, pero no la medí: mi sonda no corre `sumarCopiasDeLaNube`, así que no la leyó.
  - Lo que la exclusión sí tapa está bien: `_paquete.mjs:585` y `manual/contenido.json:18`.
  - respuesta: ____
- Y 3 nits más:
  - **`porPc` deja 4 programas sin fila, y la tabla no lo avisa.** Son `tools/claude-area/mejoras/publicar.mjs`, `antes_de_la_reunion.py`, `ensayo_pc_nueva.sh` y `vigia.mjs`: los cuatro están en la lista de lo que hay que cambiar, y en ninguna PC. Los dos `publicar.mjs` aparecen en las filas de la PC que recibe lo que publican, no en «Esta PC». No viajan en el paquete: `2- Mails de Calidad\programa` y `1- Mi asistente completo\programa` no los tienen.
  - **`BarackMailsPC` y `BarackEquipo` no tienen tarea de Windows**: la única tarea que nombra una de las tres carpetas es `\Barack - mis mails a la nube`, que usa `BarackMailsFak`. Igual entran como programas de «Esta PC» que dejan de andar, y la lista de cambios suma 2 archivos que hoy no corren.
  - **«Cómo se midió» del simulado** (`_nubeSimular.mjs:226`) no nombra `%LOCALAPPDATA%` entre los lugares de la búsqueda.

## Afirmaciones verificadas contra la fuente (correctas)

- **`_CUARENTENA_CLAUDE POR AREA\4- BUZON` recibió hasta el 13/10.** Hay 99 archivos posteriores al 06/10:
  - 51 avisos de `DESKTOP-OV373UE` (el último, el 13/10 14:14), más `salud` e `inventario` de esa misma PC (13/10 13:07);
  - 20 avisos de `PABLO-LAPTOP` (hasta el 06/10 16:07) y 19 de `CARLOS` (hasta el 07/10 11:37);
  - 3 aportes de Federico, del 06/10.
  - Del 08/10 en adelante escribió una sola PC. Los 5 más nuevos son solo-nube (0x401620): no se abrieron.
- **«Quién escribe» de `4- BUZON`** («los programas de las PC del equipo (avisos, salud y aportes)»): coincide con las carpetas `avisos\<pc>`, `salud\<pc>.json` e `inventario\<pc>.json`. Es lo que dice `sync_area.ps1:9-10`.
- **Tabla «Qué deja de andar en cada PC»:**
  - las dobles asignaciones son correctas: `_nube.mjs`, `nubeRutas.mjs` y `cerebro-guard` en esta PC y en CATA, y `_paquete.mjs` en esta PC y en el paquete viejo;
  - Pedro y Federico: ninguno de lo leído busca estas carpetas;
  - la fila de Carlos coincide con `mails_solo`.
- **Modo `m` de `reTramo`:** no trae falsos positivos nuevos.
  - Renglón por renglón, lo nuevo que toma son `guardianes.mjs:535` (correcto) y renglones de expresiones en canon `.json`, que no pasan el filtro de la carpeta de arriba.
  - El `^` no agrega nada, porque el `\s` ya tomaba el salto de renglón.
- **Alias en primer nivel:** lo que entra solo por el alias es `guardianes.mjs:535` y `mails_area.mjs:70` (correctos), más mensajes para mostrar (`mails_area.mjs:512`, `instalar_mails_solo.ps1:59`, el docstring de `_mails.py:177`). Son de la clase que la respuesta ya aceptó.

## Acciones (las decide y ejecuta la sesión principal; es la última ronda, lo abierto va al cierre para Fak)

1. Importante 1: que el mapa acepte el nombre entero entre comillas como argumento de una ruta, con un test por forma en las dos direcciones. Después, regenerar el mapa.
2. Importante 2: «el más nuevo lo dejó X» en vez de ponerle dueño a la carpeta, y corregir la regla de `6- ARCHIVO DE CORREO` (y su test).
3. Los Nit, si se tocan esos renglones: `]` y `?` en el borde, el renglón 99 del mapa, y que el filtro de la carpeta de arriba respete `excluir_linea_si`.

Limpieza: lo mío quedó solo en el scratchpad de la sesión (las sondas `probe*.mjs` y `r2_*.ps1` con sus salidas). No toqué
Supabase, el arb, Y:, Outlook ni la nube.

Estado al cerrar este informe: `git log -1` = 3b1879af. `git status -s` = solo este archivo, sin commitear (como pidió el encargo).
