**Veredicto: rechazado.** Lo que se rechaza es la regla 4 del guardián tal como quedó: está prendida ahora en la PC principal, con 7,4 a 8,6 GB libres. Falla para los dos lados: frena 21 de 28 comandos reales que no son material pesado y deja pasar `yt-dlp <url>` y la copia de una carpeta de máquina entera. La ficha de CATA y `pcNueva.mjs` se aprueban con cambios (H4, H6 a H10).

# Auditoría de la tanda 1.6: CATA sabe que es CATA, lo pesado se baja desde CATA y la PC nueva avisa qué le falta (16/10/2026)

- Auditado: commit `10a9adf7`, en `main` y ya pusheado (está en `origin/main` = `9e6c36d9`).
- Entre `10a9adf7` y `HEAD` no cambió ninguno de los 11 archivos de la tanda.
- Solo leí y probé con un HOME de prueba. No toqué código, datos, Supabase, arb, Y:, Outlook, el settings global ni la nube.

## Estado técnico

| Control | Resultado |
|---|---|
| `node --check scripts/_lib/guardianes.mjs` | OK |
| Despachador con `echo hola` | sale 0 y no dice nada |
| vitest de los 5 archivos pedidos (videoMaquinaGuard, guardianes, pcNueva, hooksVarios, nubeSincronizar) | 246 de 246 |
| firmaIAGuard y nubePersonalGuard (también mandan comandos con `.mov`/`.zip` a los guardianes) | 172 de 172 |
| `npx tsc --noEmit` | 0 errores |
| `npm run build` | OK; no tocó nada versionado (`git status` igual que al arrancar) |
| CI de `14c57ee6` (incluye `10a9adf7`) | `test` en rojo, pero por `carpetaGuard.test.mjs` (tanda 1.7, 4 tests); ningún archivo de la 1.6 falló en Linux. `typecheck`, `lint` y `repo-publico` en verde |
| CI de `9e6c36d9` (el arreglo de la 1.7, contiene `10a9adf7`) | `completed success` |
| Git al cerrar | 1 commit local sin pushear (`96360349`, docs de otra sesión, ajeno a esta tanda). Los 5 ` M` del arranque (`.env.example`, LECCIONES, dos `auto-mejora`, `_crearAmfeUpperTrimming.mjs`) son de otras sesiones |

## Hallazgos

### H1 · TRUE_BUG · Importante — el pase `.espacio-ok` se gasta antes de saber si el comando va a correr

`scripts/_lib/guardianes.mjs:2058-2066`. El guardián marca el pase «consumido» adentro de la regla 4. Todavía no corrieron las reglas 1, 2 y 3 del mismo guardián, ni los otros guardianes del despachador. Probado con un HOME de prueba y 6 GB inyectados:

| Caso | Qué pasa | Pase después |
|---|---|---|
| Copia del teléfono con `CopyHere` sin cruce fresco | la regla 2 la frena igual | «consumido» |
| `cp IMG_0645.MOV` a una carpeta del Escritorio | la regla 1 la frena igual | «consumido» |
| El agente por API consulta con `escapes:false, marcar:false` | el pase de Fak se gasta en una consulta | «consumido» |
| Fak deja el pase para copiar del teléfono, y antes la sesión expulsa el pendrive (`Shell.Application.Namespace(17).ParseName('D:').InvokeVerb('Eject')`) | la expulsión pasa y se lleva el pase; la copia del teléfono queda frenada | «consumido» |

La otra dirección anda: con 50 GB, en CATA, sin medición, o con un `ls` a 6 GB, el pase queda `""` (sin gastar).

El contrato de la casa es otro:
- Los otros tres pases miran `escapes !== false`: `arb-cerrar` en `:2250`, `apqp-cliente` en `:2356` y `nube-personal` en `:2427`.
- Los recordatorios se marcan en `resolver` (`:2790`) «solo si nada bloqueó: si la llamada no va a correr… quedaría consumido».
- El pase tampoco es de una sesión: lo gasta la primera sesión de la PC que matchee.

### H2 · TRUE_BUG · Importante — la regla frena el paso que la regla pide

En `:2056`, `VID_MUEVE` (`:1965`) cuenta como «copia pesada» también `mv`, `move`, `Move-Item`, `os.rename` y `shutil.move`. Mover un video de `C:\Dev\_telefono` a la biblioteca es un renombre adentro de C:: no ocupa ni un byte más. Es el paso 6 de `video-maquina.md` («subir y deshidratar») y lo que después libera el disco. Hoy queda frenado:
- Real del 14/10: `tel_copiar` a las 18:33 y dos `Move-Item ... .MOV` a `MAQUINA MOLDEADORA IMG` / `TELA TERMOFORMADA` a las 18:42 (sesión `0be7a687`). Con la regla nueva ese flujo pide tres pases: los dos `Move-Item` quedan frenados aunque la copia haya pasado con el pase. Probado (caso 5b).
- Real del 07/10: `shutil.move` de los `.MOV` de ductos a la biblioteca (sesión `5af511d9`).
- También quedan frenados `git mv docs/viejo.zip docs/nuevo.zip` y el `os.rename` de un `.zip` adentro de la biblioteca (07/10).

El comentario de `vidDestino` en el mismo archivo (`:2008`) ya lo dice: «Un candado que frena la corrección no protege nada (LECCIONES 07/09)».

### H3 · TRUE_BUG · Importante — lo pesado de verdad pasa

En `:2055-2057`, una descarga solo frena si el comando nombra una extensión pesada (`VID_PESADO_EXT`, `:1991`). Y una copia solo frena si nombra un `.mov`/`.mp4`/`.zip`. Probado con 6 GB y destino en C:. **Todo esto pasa**:
- `yt-dlp https://www.youtube.com/watch?v=abc`, que es el uso por defecto de la herramienta (el test solo prueba `yt-dlp -o referencia.mp4`, `videoMaquinaGuard.test.mjs:185`).
- `yt-dlp -f best <url>`.
- `curl -L -o instalador <url>`.
- `robocopy "<...5- VIDEOS Y FOTOS\...\MAQUINA HOT PRESS BMA101>" C:\Dev\copia /E`.
- `cp -r "<carpeta de máquina>" /c/Dev/copia` y `cp "<carpeta>"/* ...`.
- `Copy-Item -Recurse` de la carpeta, por la herramienta Bash y por la herramienta PowerShell.
- `tar -cf` de la carpeta.

O sea: frena un `.zip` de 55 KB y deja pasar la copia de una carpeta de máquina entera. No medí cuánto pesa una carpeta. Los datos de la fuente (`casa_cata_estado.md` C.3) son: unos 430 MB por video, 3,09 GB el video más grande de la biblioteca y unos 17 GB para un lote de 40 videos (una cuenta, no una medición).

Bajar programas (`npm ci`, `pip install`, `winget install`) tampoco frena. Eso queda afuera del alcance escrito («un video o un comprimido»): lo anoto, no lo cuento como falla.

### H4 · TRUE_BUG · Importante — pcNueva busca un Ghostscript que ningún script usa

`scripts/_lib/pcNueva.mjs:41-42` mide `where gswin64c` o la carpeta `C:\Program Files\gs`. El único que lo usa es `scripts/_imprimir.py`, con otra ruta fija: `C:\Program Files\PDFCreator\Ghostscript\Bin\gswin32c.exe` (`:32`, y en `:91` «viene con PDFCreator»). Esa ruta existe en esta PC. Resultado:
- En la principal, cada sincronización escribe `[PC NUEVA] … le falta 1 cosa: Ghostscript (PDF a imagen) -> instalar Ghostscript desde ghostscript.com`. Lo corrí. El mensaje del commit lo da por real («el aviso real de esta PC (le falta Ghostscript)»).
- En CATA, instalar «desde ghostscript.com» apaga el aviso (crea `Program Files\gs`), pero `_imprimir.py` sigue fallando, porque necesita el de PDFCreator.
- «PDF a imagen» está mal: lo usa para pasar el PDF a PCL e imprimir (skill `imprimir`).

### H5 · ROBUSTNESS · Importante — 21 de 28 comandos reales frenados no eran material pesado

Pasé por la regla 4 los 17.790 comandos Bash/PowerShell únicos de los últimos 10 días (`~/.claude/projects/C--Dev-BarackMercosul*`, subagentes incluidos), con la principal, 8 GB contra 50 GB y cruce fresco. Frenarían 29. Uno (`echo cp prueba.zip`) es una prueba mía de esta auditoría, así que quedan 28:

| Clase | Casos | Cuáles |
|---|---|---|
| Pesado de verdad | 3 | `tel_copiar` del 07/10 y del 14/10; `cp "$D"/*.mp4` de la biblioteca al scratchpad (16/10) |
| Discutible | 2 | `cp` de un `.mp4` editado (el tiempo neto del defroster) a `TIEMPOS Y BALANCEOS` (08/10, dos comandos) |
| Pesado, pero agarrado por casualidad | 2 | `ffmpeg ... -c:v copy ... .mp4`: matchea la palabra `copy` del códec (07/10) |
| **No es pesado** | **21** | 6 + 1 + 1 + 1 + 5 + 7, abajo |

Por qué dispara en los 21:
- **6 · `VID_MTP` dispara solo** (`:2055`), sin un verbo de copia. Pasa siempre que el comando nombra `Namespace(17)`, que es «Este equipo» y sirve para expulsar el pendrive `D:` o listar sus opciones, no para leer el teléfono. Son 5 comandos de 3 sesiones (08, 09 y 14/10), más el `cp` de un `.py` que escribe esa misma línea en el SKILL de plotter-aol (15/10). También frenó un `node -e` de esta auditoría que solo tenía el literal `tel_copiar` en una expresión regular. La regla 2 pide las dos cosas (`:2137`).
- **1 · La extensión se busca en todo el comando** (`todo`, `:2056`) y no en la sentencia que copia, aunque `vidSentencias` ya existe: un heredoc que escribe un `.py` con `cp = dict(...)` y `'.zip'` en una lista de extensiones (08/10).
- **1 · `shutil\.(copy|move)` también agarra `shutil.copyfileobj`**: leer `IP PAD.xlsx` de adentro de `IP PAD.zip` en `Y:` (13/10).
- **1 · La copia a `D:` se mide contra `C:`** (`vidGbLibres`, `:1992-1999`): el `cp` del paquete «Instalar mi PC» al pendrive (08/10).
- **5 · Renombres y movimientos adentro de C:**, que no ocupan disco:
  - los dos `Move-Item` y el `shutil.move` de H2;
  - el `os.rename` del `.zip` en la biblioteca (07/10);
  - el `mv` de la carpeta y el zip de Leo adentro de la nube (15/10).
- **7 · No mira el tamaño.** Las copias de zips chicos pesan:
  - 55 KB: los mails de Leo, dos `cp` (15/10);
  - 89 KB: la skill 3D, `cp -n` (16/10);
  - 0,6 MB: el zip de WhatsApp (14/10);
  - 11 MB: `base_mount.3mf.zip`, dos veces (14/10);
  - 58 MB: `repo.zip` de Pedro (09/10).

Esta auditoría quedó frenada dos veces con comandos de solo lectura: el `echo` y el `node -e` con el literal.

### H6 · ROBUSTNESS · Importante — el aviso «PC nueva» no lo lee nadie

`scripts/_nube.mjs:380-388` lo agrega a `avisos`, que se imprimen en `:414`. La tarea de cada 2 h (`_nubeSync.ps1:13` y `:47`) los manda a `.claude/state/nube-sync.log`.
- Busqué `nube-sync.log` y `[PC NUEVA]` en `scripts/`, `.claude/hooks/`, `tools/`, `mods/`, `~/.claude/hooks/` y `~/.claude/mods-casa`: no hay ningún lector (`MARCA_PC_NUEVA` no la usa nadie).
- La fuente ya lo decía de ese log (`casa_cata_estado.md`, fila «Código del repo»): «lo único que avisa es una línea del nube-sync.log que nadie lee».
- En la práctica, CATA se entera de lo que le falta por la lista fija de la ficha («Qué NO tiene (15/10)»). Esa lista se queda vieja el día que Fak instale algo: va a seguir diciendo «sin node_modules».

Una salida posible: que `session-start-context.sh` lea con `grep` el último `[PC NUEVA]` del log. Conviene que sea con bash: el mismo hook evita arrancar node de lunes a jueves (de 0,5 a 0,9 s por arranque).

### H7 · ROBUSTNESS · Importante — a `requirements.txt` le faltan paquetes que usan scripts vivos

`requirements.txt` y `IMPORTS_PYTHON` (`pcNueva.mjs:24`) tienen 8 paquetes. El Python base de la principal (3.13, `AppData\Local\Programs\Python\Python313`) tiene además estos, y los importan scripts vivos (sin contar `_archive`, `scratch` ni `.venv-cad`):

| Módulo | Script vivo que lo importa |
|---|---|
| `cv2` + `segno` | `scripts/_qrVerificacion.py:50-51`, arriba de todo: sin ellos el sellado de QR no arranca |
| `cv2` | `scripts/lamina_proceso/mejorar_foto.py`, `scripts/_arbAprender.py` |
| `scipy` | `scripts/_mixPlotter.py`, `scripts/video/musica.py` |
| `shapely` | `.claude/skills/plotter-aol/scripts/acomodar_columnas.py` |
| `lib3mf` | `.claude/skills/impresion-3d-bambu/scripts/vista_previa.py` |
| `pillow_heif` | `scripts/hotmelt/fotos_v3.py` (las HEIC del iPhone) |
| `xlrd`, `olefile` | `scripts/_vocabularioPlanta.py` |
| `pytesseract`, `rapidocr_onnxruntime` | `scripts/_lib/respaldoCarga.py` |
| `pypdf` | `tools/flowchart/propuestas/A_paginado/ajustar_a3.py` |
| `faster_whisper` | `scripts/hotmelt/transcribir.py` |

Con `pip install -r requirements.txt` en CATA, pcNueva dice «ok» y esos scripts fallan. Solo miré dónde está el import en `_qrVerificacion.py` (arriba de todo) y en `firmaIA.py`. `extract_msg` (`scripts/_lib/firmaIA.py:474`) también falta, pero se importa adentro de una función y el programa sigue con un aviso: no frena.

Lo que no debía estar no está: `requirements.txt` no trae nada que viva solo en `.venv-cad` (gmsh, build123d, trimesh, cadquery ni matplotlib).

### H8 · ROBUSTNESS · Nit — la ficha no vuelve después de compactar

`.claude/hooks/session-start-context.sh:32-54`: en modo `compact` el hook reinyecta el núcleo y sale antes del bloque de la ficha (`:63-66`). Probado: con `COMPUTERNAME=CATA` en modo compact salen 1.429 bytes y ninguna línea «[PC]». Una sesión de CATA que compacta puede perder el «estoy en CATA». En la casa, 9 de las 11 compactaciones medidas desde el 06/10 fueron por contexto lleno (plan del sistema, punto 4 del diagnóstico). Sumarla en compact cuesta 2,4 KB.

### H9 · ROBUSTNESS · Nit — un python que se cuelga se informa como «falta Python»

`pcNueva.mjs:82-83`: un error de arranque o un timeout de 30 s deja `r.error` puesto, y eso cae en `sin-python`. El aviso dice «instalar Python 3.12» aunque Python esté instalado.

Otra cosa, no verificada en CATA: el `-I` ignora los paquetes del usuario (`site-packages` del usuario). Si en CATA `pip` instala «por usuario» (pasa cuando Python está instalado para todos los usuarios), el aviso sigue diciendo «faltan» después de instalar. En esta PC da lo mismo con `-I` que sin `-I`.

Detalle menor: la principal usa Python 3.13 en el Python base. El 3.12 lo pide `.venv-cad`.

### H10 · DOC · Nit — tres frases de `.claude/pcs/CATA.md` sin fuente o más firmes que la fuente

- `CATA.md:5` pone «Supabase» entre lo que CATA le pide a la principal, y no tiene fuente:
  - La memoria del canal (`reference_canal_entre_pcs_pedidos_facundo.md:27`) solo dice mails y BeOn.
  - La misma ficha (`:4`) dice que el AMFE (Supabase) falla en CATA solo por `node_modules`. El `.env.local` llegó por la nube (fila de `.env.local` de la fuente).
  - O es una decisión que falta escribir, o sobra.
  - «El arb» tiene apoyo parcial: en la lista de tareas de la fuente, el arb corre solo en la principal y CATA no lo tiene. Es inferido.
- `CATA.md:3`:
  - Dice «los 78 GB de `5- VIDEOS Y FOTOS` incluidos». La fuente revisó 20 de 299 videos y aclara que la muestra «no prueba que los 299 estén bajados».
  - Las cuentas de Outlook (`impo@` por defecto, `calidad@` adicional) salen de la memoria del 08/10. La fuente dice que no las volvió a verificar.
- `CATA.md:2` («si la sesión abrió en otra… decírselo a Fak») solo se lee cuando la sesión ya está en el repo, porque el que imprime la ficha es un hook del repo. No sirve, aunque tampoco molesta: el caso real lo cubre `carpeta-guard` (tanda 1.7).

El resto se verificó contra las fuentes y está bien:
- `casa_cata_estado.md`: usuario `catav`, 476/239 GB, 7,7/1,4 GB de RAM, Office/Chrome/OneDrive/Git/Node 24/Python 3.12, lo que no tiene, las dos tareas programadas.
- Plan §1.6: «cuenta personal», Alt+1.
- `reference_dos_cuentas_claude_cata_personal_pc_empresa.md`.
- `_ESTADO.json`, `por_pc.CATA`: la clave es `CATA`, la misma que arma `_nube.mjs:308` con `COMPUTERNAME`.

### H11 · FALSE_POSITIVE — «la ficha no viaja por git»

Al arrancar, la tanda estaba solo en el índice: `git check-ignore` decía que `.claude/pcs/CATA.md` lo ignoraba la línea `.claude/*` (`.gitignore:41`) y `git ls-files` no lo listaba. Con eso, la ficha no llegaba a CATA y el test de `hooksVarios` iba a dar rojo en el CI. El commit `10a9adf7` trajo la excepción `!.claude/pcs/` y el archivo. Verificado en `HEAD`: `CATA.md` está en `git ls-tree` y una ficha nueva (`.claude/pcs/OTRA.md`) no queda ignorada. No es hallazgo.

### P1 · ROBUSTNESS · Preexistente — la regla 2 nunca ve el script de copia de la casa

En `:2137`, la regla 2 pide `VID_MTP` y además `VID_MUEVE`. `powershell -File scripts/video/tel_copiar.ps1 ...` no tiene ningún verbo de copia, y el script no mira `.cruce-video` (`grep -c cruce-video` da 0). Copiar del teléfono sin cruce, con el script de la casa y 50 GB, **pasa**. Los tests nuevos lo tapan con `horasDelCruce: 0` (`videoMaquinaGuard.test.mjs:176-186`).

## Lo que no es hallazgo (para que la próxima ronda no lo levante)

- **`env.COMPUTERNAME` llega en vivo.** `despachar` llama a `evaluar(raw)` sin `env` (`:2839`) y `correr()` usa `deps.env ?? process.env` (`:2762`). El despachador real frenó mi `echo cp prueba.zip` con «7.6 GB libres», así que la regla 4 corre de verdad.
- **`${COMPUTERNAME^^}` anda.** Con `CATA` y `cata` la ficha sale entera (3.643 − 1.266 = 2.377 bytes, el tamaño del archivo); con `DESKTOP-14JG95B` o vacío, no sale. Sale 0 en los cuatro casos.
- **Tamaño de la salida.** Hoy entra:
  - En las 257 sesiones de 10 días, el arranque real sumó 2.287 bytes como máximo. Con la ficha queda en unos 4,7 KB.
  - El peor caso no está medido. El hook dice que los seguimientos llegan a unos 5 KB; con la ficha, la salida rondaría los 9 KB, cerca del tope de 10 KB.
- **Tiempos de pcNueva.** Midió 0,53 s. El peor caso es 10 + 10 + 30 s, con `windowsHide`: no cuelga la sincronización de cada 2 h.
- **Lo que pcNueva mide bien:**
  - Bambu Studio en `C:\Program Files\Bambu Studio` (lo usa `laminar_bambu.py:26`);
  - `ffmpeg` por `where` (`_video.py` usa el del PATH o el de winget);
  - `~/.claude/mods-casa`, `.venv-cad` y `@supabase/supabase-js`.
- **CI.** El rojo del CI de `14c57ee6` es de la tanda 1.7 (`carpetaGuard`), no de esta.
- **Lo que la tanda dice que no hizo** (lo de CATA misma, que los chats bajen a la otra PC) y que la ficha no cargue si CATA abre en `C:\Dev` (plan §1.6, opción 3: «no cumple a») están escritos en el commit y en el plan.

## Qué haría falta para aprobar

Lo decide la sesión principal con Fak; yo no toqué nada.

1. **H1:** el pase respeta `escapes` y se consume solo si nada bloqueó.
2. **H2, H3 y H5, la regla 4:**
   - mirar la sentencia que copia (no el comando entero);
   - `VID_MTP` solo cuando además copia;
   - sacar los renombres y lo que va a otra unidad;
   - frenar `yt-dlp` siempre y la copia recursiva de carpetas de `5- VIDEOS Y FOTOS`;
   - mirar el tamaño de origen cuando es un archivo local.
   - Tests con los 28 comandos reales, en las dos direcciones. El detalle está fuera del repo, porque son comandos de las charlas.
3. **H4:** medir el Ghostscript de PDFCreator, o lo que diga `_imprimir.py`.
4. **H6:** el aviso le tiene que llegar a una sesión.
5. **H7:** completar `requirements.txt` con lo que importan los scripts vivos, o decir en el archivo que es solo el mínimo.

Hasta que se arregle la regla 4, sigue prendida con menos de 10 GB libres. Para hacer lo de H2 en la PC principal hace falta un pase por cada paso.

## Ronda 2 (22:30)

**Veredicto: aprobado con cambios.** La regla 4 pasó de frenar 28 comandos reales a frenar 4: los 3 pesados y 1 que no lo es. Quedan dos cosas para arreglar: el `Move-Item` real del 14/10 sigue frenado (H2) y cada arranque de esta PC muestra un aviso «PC nueva» viejo y falso (N1).

- Auditado: commit `2b56de42`, en `main`. **No está pusheado**: hay 2 commits locales, `2b56de42` y `96360349`. El CI de HEAD no corrió (sin verificar); el último run es el de `9e6c36d9`, en verde.
- Probé todo con un HOME de prueba. No toqué código, datos, Supabase, arb, Y:, Outlook, el settings global ni la nube.
- El pase real `~/.claude/.espacio-ok` no existe y no lo creé. Hoy esta PC tiene 6,9 GB libres, así que la regla está prendida.

| Control | Resultado |
|---|---|
| `node --check scripts/_lib/guardianes.mjs` | OK |
| vitest: videoMaquinaGuard, guardianes, pcNueva, hooksVarios | 237 de 237 |
| vitest: firmaIAGuard, nubePersonalGuard | 172 de 172 |
| Despachador real con `echo hola` y con `echo cp prueba.zip` | sale 0 y no dice nada, en los dos (la v1 frenaba el segundo) |
| Replay sobre 17.384 comandos únicos ajenos de 10 días (sin las sondas de los auditores, que están en `subagents/` de esta sesión) | v1 frena 28, v2 frena 4. Ninguno que la v1 dejaba pasar frena ahora |

### Los 28 comandos reales, con la principal, 8 GB contra 50 GB y cruce fresco

| Clase de la ronda 1 | Qué pasa con la v2 |
|---|---|
| 3 pesados | **los 3 frenan**: `tel_copiar.ps1` del 07/10 y del 14/10, y el `cp "$D"/*.mp4` de la biblioteca del 16/10 |
| 21 no pesados | **20 pasan y 1 sigue frenado**: el `Move-Item` del 14/10 18:42 a `MAQUINA MOLDEADORA IMG`, sesión `0be7a687` (ver H2) |
| 2 discutibles (`cp` del `.mp4` del defroster a `TIEMPOS Y BALANCEOS`) | pasan. Ojo: no es porque se midió que es chico. El archivo de origen ya no existe, y como no viene de la biblioteca, la regla no lo cuenta |
| 2 `ffmpeg ... -c:v copy` | pasan. La regla escrita trata a `ffmpeg` como código |

Por qué pasan los 20:
- 4 porque se midió el archivo hoy y pesa menos de 100 MB: el zip de Pedro (58,6 MB), los dos `base_mount.3mf.zip` (11,5 MB) y uno de los mails de Leo (0,06 MB).
- 13 porque no copian: expulsan el pendrive, mueven o renombran, o son código (heredoc, `python -c`).
- 3 porque hoy el archivo de origen ya no existe: la skill 3D, el otro zip de Leo y la copia al pendrive. En la ronda 1 esos dos zips medían 89 KB y 55 KB, y la copia va a `D:`, que hoy no está conectado.

### Cada hallazgo de la ronda 1

| | Estado | Caso que probé |
|---|---|---|
| H1 | **parcial** | Lo pasé por `evaluar`, el despachador entero, con un HOME de prueba y 6 GB. Estos casos ni usan ni gastan el pase: el agente por API (`escapes:false`, `marcar:false`), un video al Escritorio (lo frena la regla 1), `CopyHere` sin cruce (lo frena la regla 2), expulsar el pendrive con `Namespace(17)` y un `ls`. Con el pase, `tel_copiar.ps1` pasa con aviso y el pase queda «consumido». Sigue abierto el caso entre guardianes: un `cp` de un video de 120 MB a la nube personal. El de video gasta el pase y avisa; después `nube-personal-guard` frena (exit 2) y el pase queda «consumido» sin que el comando corra. Pasa porque `video-maquina-guard` corre antes en la matriz. Los pases de arb-cerrar, apqp-cliente y nube-personal también se gastan adentro del guardián: es de la casa y no frena la aprobación |
| H2 | **parcial** | Con 6 GB pasan `mv` de 120 MB, `Move-Item` de un zip, `git mv` de un zip, `shutil.move` en heredoc y `os.rename` en `python -c`. **El caso real del 14/10 18:42 sigue frenado** («copia videos de la biblioteca»). Son dos `Move-Item` de `.MOV` más un `Copy-Item` de una foto `.jpg`, cada uno en su renglón, adentro de un `powershell -Command "..."`. El test no usa ese comando tal cual: lo reescribió en un renglón y sin el `Copy-Item`. La causa está abajo |
| H3 | **resuelto** | Frenan: `yt-dlp <url>` sin `-o`, `yt-dlp -f best`, `robocopy <carpeta de máquina> C:\Dev\copia /E`, `cp -r` de esa carpeta, `Copy-Item -Recurse` (por Bash y por PowerShell) y `cp`/`Copy-Item` de un archivo de 120 MB. Encontré huecos sin ningún caso real en 10 días, y no los cuento como hallazgo: pasan `robocopy <carpeta> <destino> *.MOV` (sin `/E`), un comando de varios renglones que arranca con un renglón `echo` o `git`, y una variable de PowerShell (`$src = ...; Copy-Item $src ...`). Frena un `cp -r` de la `.claude` de una máquina, o hacia la biblioteca. Medido: ningún comando de 10 días arranca con un renglón de comentario; de 918 donde el primer renglón «de código» tapa a los demás, 2 tenían una copia y ninguna era pesada |
| H4 | **resuelto** | `medirPc` en esta PC: `(nada falta)`. Mide `C:\Program Files\PDFCreator\Ghostscript\Bin\gswin32c.exe`, la misma ruta de `scripts/_imprimir.py:32`, que existe. El texto ya no dice «PDF a imagen» |
| H5 | **parcial** | De los 21, pasan 20; el que falta es el de H2. Ninguno de los 17.384 frena por primera vez con la v2. También sigue frenado el `node -e` de solo lectura de la ronda 1, el que tenía `CopyHere` en una expresión regular después de un `;`. La excepción de «código» solo llega hasta el primer `;`: `node -e "const a=1; const re=/tel_copiar.ps1/; ..."` frena. El test pone el literal antes del `;` y por eso pasa |
| H6 | **parcial** | El aviso ahora llega a la sesión, en inicio y en compact, una sola vez. Pero llega viejo: ver N1 |
| H7 | **resuelto** | Los 21 de `requirements.txt` coinciden con `IMPORTS_PYTHON` (nombres de pip contra nombres de import). Quedó afuera `xlsxwriter`, que importa `scripts/hotmelt/cuadro_estructura.py:15` arriba de todo; tampoco lo listé yo en la ronda 1 |
| H8 | **resuelto** | Con CATA, en compact salen 4.274 bytes con la ficha; con DESKTOP-14JG95B no sale la ficha. Medí con un HOME de prueba, sin correr el modo inicio con el HOME real porque hoy es viernes y ese hook escribe en `~/.claude`. Cuenta para el caso real: 2.287 bytes (el máximo de 10 días) + 2.518 (la ficha) + hasta 1.204 (el aviso de CATA con todo faltando), unos 6 KB. Queda bajo 10 KB |
| H9 | **resuelto** | Probé tres casos con PATH falsos. Sin python da «sin-python» y avisa el programa. Con un python que sale con error y con un `.exe` roto da «no-medido» y no avisa nada. El timeout cae en «no-medido»; eso lo vi leyendo `pcNueva.mjs:89`, no lo corrí. Lo de `-I` y los paquetes por usuario sigue sin verificar en CATA |
| H10 | **resuelto** | Comparé contra `casa_cata_estado.md`. «299 videos; una muestra de 20 dio 17 bajados» coincide con la fila «Biblioteca de Ingeniería» y con §D. Lo de Outlook ahora dice «según la memoria del 08/10, sin volver a verificar», igual que el punto 2 de B. Supabase salió. «El arb y la noche de la API corren solo en la principal» sale de la fila «Tareas programadas». `CATA.md:2` sigue igual; no molesta |
| P1 | sigue (es de antes) | `tel_copiar.ps1` sin cruce y con 50 GB pasa la regla 2. Con 6 GB lo frena la regla 4 |

**Por qué sigue frenado el `Move-Item` de H2.**
- `scripts/_lib/guardianes.mjs:2114` hace `cmd = ctx.cmd6`. Ese `cmd6` lo arma `armarCtx` (`:160`) con `limpiar` (`:59`), que cambia los saltos de línea por espacios.
- Entonces el corte por renglón de `vidSentencias` (`:2097`) nunca corta. Un `powershell -Command "..."` de varios renglones queda como una sola sentencia y un solo token entre comillas.
- En esa sentencia, el `Copy-Item` de la foto prende `VID_COPIA`. Como el mismo token tiene el `.MOV` y la biblioteca, la regla lo toma como «video de la biblioteca sin medir» (`:2056-2064`).
- Lo probé con el comando real: con `cmd6` como viene, frena; con los saltos conservados (`cmd6 = ctx.cmd`), pasa. La misma causa funciona al revés: un `cp` de 120 MB detrás de un renglón `echo` pasa con `cmd6` y frena con los saltos.

### Hallazgo nuevo

**N1 · TRUE_BUG · Importante — el arranque muestra un aviso «PC nueva» viejo, y en esta PC es el falso de H4.**
- `.claude/hooks/session-start-context.sh:38-40` imprime el último renglón `[PC NUEVA]` del registro, sin mirar si es de la última sincronización. Y `scripts/_nube.mjs:383-385` solo escribe ese renglón cuando falta algo. Cuando ya no falta nada, nada lo reemplaza.
- Caso real, hoy en esta PC: `.claude/state/nube-sync.log` tiene un solo `[PC NUEVA]`, el de las 21:40 (antes del arreglo de H4), que dice «le falta 1 cosa ... Ghostscript (PDF a imagen) -> instalar Ghostscript desde ghostscript.com».
- Corrí el hook con `COMPUTERNAME=DESKTOP-14JG95B`: ese renglón sale una vez en inicio y una vez en compact, aunque `pcNueva` ahora dice que no falta nada. O sea, el aviso falso de H4 llega a cada arranque y a cada compactación.
- El registro recién se recorta al pasar 1 MB (`scripts/_nubeSync.ps1:21-24`), y hoy tiene 459 KB desde el 08/10.
- En CATA va a pasar lo mismo el día que Fak instale todo: el renglón de las 7 cosas queda. Es lo que la ronda 1 temía de la lista fija de la ficha, ahora por otro lado.
- El test nuevo de H6 (`hooksVarios.test.mjs`, «el ultimo aviso PC nueva…») lee el registro real, que no está versionado. En el CI sale antes y no prueba nada; en esta PC da verde con el renglón viejo.
- `.claude/state/` no viaja ni por la nube ni por git: cada PC lee el suyo.

### Qué falta para aprobar sin cambios

Lo decide la sesión principal con Fak; yo no toqué nada.

1. **N1:** que el arranque muestre el aviso solo si es de la última sincronización, o que la sincronización deje un renglón «no falta nada» que lo reemplace.
2. **H2:** que la regla 4 mire el comando con sus saltos de línea (`ctx.cmd`), y que el test use el comando real del 14/10 tal cual.

Lo demás queda anotado y no frena: H1 entre guardianes, H5 con el `;` adentro de `node -e`, los huecos de H3, `xlsxwriter` y P1. Esta fue la última ronda.
