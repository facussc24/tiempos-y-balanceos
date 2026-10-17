# Auditoría final — tanda 7 «la nube» (camino mediano, codigo-madre.md)

Fecha: 17/10/2026 · Rama `claude/nube-tanda7-1017` (d650b0f4, 9d8afa02, 2ede013d sobre main 4322d932) · Ronda 1.
Auditor: agente `auditor` (Opus), solo lectura. No se editó código ni se tocó la nube.

## Resultado: FALLO en la regla 5 (exactitud)  ·  3 Importante, 3 Nit (y 5 nits más), 0 Preexistente

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: «built in 30.41s», salida 0 |
| Tests del módulo | OK | `npx vitest run __tests__/scripts/nubeOrden.test.mjs`: 28/28 |
| Git local | OK | árbol limpio (también después del build) |
| GitHub sync | OK (esperado) | `git log origin/main..HEAD` = los 3 commits de la rama; el encargo prohíbe push y no están en main, así que no es crítico |
| CI | OK | `candado.yml` completed success 4322d932 (el HEAD de main) · `deploy.yml` completed success 411f200f |
| Dependencias | sin cambios | el diff no toca `package.json` |

## Veredicto por regla dura del encargo

| Regla | Veredicto | Cómo se verificó |
|---|---|---|
| 1. Nada se mueve ni se borra | **OK** | En los dos CLI la única escritura es `writeFileSync(salida, …)` (`_nubeSimular.mjs:251`, `_nubeMapa.mjs:151`); el lib escribe y borra solo `entrada.json`/`salida.json` de su `mkdtempSync(os.tmpdir())` (`nubeOrden.mjs:315-323`); el `.ps1` solo escribe `WriteAllText($Salida…)` (`nubeMedir.ps1:97`) y no tiene Move/Remove/Copy/Rename/New-Item. Después de la corrida real quedaron 0 carpetas `nubeMedir-*` en `os.tmpdir()`. No hay `--aplicar` (sale con 2). |
| 2. No hidratar | **OK en los hechos, con prueba débil** (Importante 3) | `sumarCopiasDeLaNube` abre solo `local = true` (`nubeOrden.mjs:297`); el `.ps1` no lee contenido (solo `Get-Content` de su JSON de entrada). `~/.claude/{hooks,scheduled-tasks,agents,projects/…/memory}` son carpetas comunes, no enlaces a la nube (medido con `Get-Item`: sin LinkType). `listarArchivos` no sigue enlaces (un Dirent de junction no es ni carpeta ni archivo). La corrida del mapa no dejó nada bajado: «En esta PC» por carpeta es idéntico entre la corrida de las 11:16 y la mía de las 11:26. |
| 3. Ninguna ruta por la línea de comandos | **OK** | Corridos: `--aplicar` [2], `--nombre "CLAUDE BARACK"` [2], `--archivo ..\x.md` [1, frena con la excepción de `rutaSalida`], `--archivo` sin valor [2], `--nombre=X` [2], mapa `--archivo C:\x.md` [1], `--tope abc` [2], `--tope 5` [2], `--raiz C:\Users` [2]. Ninguno llega a `buscarBiblioteca`; no se creó `C:\x.md`. |
| 4. LEEME sin Claude ni IA | **OK** | Leídos los 7 en el simulado: ninguno nombra a Claude ni a una IA (dicen «asistente»). El test lo prueba con `firmaIaEnTexto` y con `/IA/`. Además los pasé por el guardián real de escritura, `firmaIaEnEscritura(contenido, <biblioteca>\<carpeta>\LEEME.txt)`: los 14 (7 LEEME por cada uno de los 2 nombres) pasan. |
| 5. Exactitud del informe | **FALLA** | Importante 1 y 2 (abajo). Lo que sí coincide con la fuente está en «Afirmaciones verificadas». |
| 6. Calidad | **OK** | `.ps1`: 0 bytes no ASCII; sin `as any`/`@ts-ignore` en el diff; sin inglés suelto; castellano simple. |

## Hallazgos Importante

### [Importante · TRUE BUG] 1. La tarea de mails de ESTA PC no aparece en el simulado, y deja de subir si se mueven los mails
- **Dónde:** `scripts/_lib/nubeOrden.data.json:110-111` (`alcance_busqueda`: repo y cuatro carpetas de `~/.claude`; no entra `%LOCALAPPDATA%`); `scripts/_nubeSimular.mjs:58` y `:180` («los mails de Carlos y de Calidad»); LEEME 4, `nubeOrden.data.json:40` («la copia de los mails que suben las PC de Carlos y de Calidad»).
- **Caso medido:**
  - `schtasks` de esta PC (DESKTOP-14JG95B): tarea `\Barack - mis mails a la nube`, disparadores al iniciar sesión y cada 2 h (`PT2H`), corre `C:\Users\FacundoS-PC\AppData\Local\BarackMailsFak\subir.ps1`. Su `mails.log` muestra corridas a las 06:37, 08:37 y 10:37 de hoy para `f.santoro@barackmercosul.com`.
  - Ese `subir.ps1:56-58` busca, en las carpetas de PRIMER nivel de la biblioteca, la que tiene `mails\_entrada`; y su `programas\mails_area.mjs:437` rechaza una carpeta de mails cuyo padre no se llame `claude barack` o `_cuarentena_claude barack` (ver el 2).
  - `_CUARENTENA_Claude Barack\mails\_entrada\` tiene hoy `calidad`, `cbaptista`, `f.santoro`, `lucca.tuccio`. El plan del 08/10 (`docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md:115`) dice «4- MAILS DEL EQUIPO … (Carlos, Calidad, Fak)».
- **Qué pasa:** con el simulado tal cual, la mudanza (P56) se prepara pensando en Carlos y Calidad. La lista de «lo que hay que cambiar» trae la fuente del repo (`tools/claude-area/mails_pc/subir.ps1`, marcada «se instala en otras PC»), pero no dice que también está instalada en esta PC con su tarea. Además, el paso 4 («los mails de Carlos y de Calidad siguen subiendo») no prueba los de Fak. Y el LEEME 4 que iría a la nube describe mal quién sube.
- **Patrón de arreglo sugerido (lo decide la sesión principal):** sumar al alcance las copias instaladas en `%LOCALAPPDATA%\Barack*` (las que tienen tarea de Windows: hoy `BarackMailsFak`; `BarackMailsPC` y `BarackEquipo` no tienen tarea), o al menos cruzar cada acción de `schtasks` con el `.ps1`/`.mjs` que ejecuta y buscar adentro de ese archivo. Y corregir los dos textos para que digan quiénes suben según lo que hay en `_entrada`. Hoy son cuatro carpetas: `calidad`, `cbaptista`, `f.santoro` y `lucca.tuccio`. El plan del 08/10 nombra tres (Carlos, Calidad, Fak), y no averigüé desde qué PC sube `lucca.tuccio`.
- respuesta: ____

### [Importante · TRUE BUG en el detector] 2. La búsqueda distingue mayúsculas y no ve los programas que comparan el nombre en minúsculas
- **Dónde:** `scripts/_lib/nubeOrden.mjs:74-76` (`reTramo`, sin bandera `i`) y el filtro previo `a.texto.includes(nombre)` de `:126`.
- **Caso medido:** `buscarReferencias([{ruta:'tools/claude-area/mails_area.mjs', texto:<el archivo>}], '_CUARENTENA_Claude Barack', {canon})` devuelve `[]`. Pero `tools/claude-area/mails_area.mjs:432-438` (`carpetaDeMailsIndicada`) hace `if (!/^(?:_cuarentena_)?claude barack$/.test(normalizar(path.basename(path.dirname(r))))) return null;`. `subir.ps1:92` le pasa `--carpeta-mails "$destino"`, y si devuelve null, `mails_area.mjs:688-689` sale con `sin_nube`: «no veo la biblioteca de Ingenieria (se reintenta)». Ese aviso además confunde.
- **Qué pasa:** el simulado pone a `mails_area.mjs` entre los que «solo usan la FORMA… algunos la usan adentro de una carpeta que ya encontraron» (`_nubeSimular.mjs:173`). En realidad rompe POR NOMBRE: aunque se arregle `subir.ps1` para buscar en el lugar nuevo, `mails_area.mjs` rechaza `…\4- MAILS DEL EQUIPO\mails`. Hay cuatro copias afectadas: la del repo, `INSTALAR EN UNA PC NUEVA\2- Mails de Calidad\programa\mails_area.mjs` (corre en la PC de Calidad), `_CUARENTENA_CLAUDE POR AREA\1- PUBLICADO\contenido\programas\mails_area.mjs` y `%LOCALAPPDATA%\BarackMailsFak\programas\mails_area.mjs` (esta PC). `scripts/_mails.py:80` (`re.compile(r'claude barack', re.I)`) apareció en la lista solo porque su renglón tiene un comentario al final con el nombre exacto.
- **Patrón sugerido:** buscar también sin distinguir mayúsculas (con el mismo borde de tramo) y marcar esos aciertos aparte («compara el nombre en minúsculas o con una expresión»), o agregar al canon un patrón por carpeta (`claude barack` para la de mails). Test en las dos direcciones: el renglón de `mails_area.mjs:437` tiene que aparecer, y `Facundo Santoro` sigue sin contar para `FACUNDO`.
- respuesta: ____

### [Importante · ROBUSTNESS, REVIEW §9] 3. «Nada se bajó» se afirma siempre, aunque el propio número diga otra cosa
- **Dónde:** `scripts/_nubeMapa.mjs:45` («así que un archivo que vive solo en la nube sigue solo en la nube»), `:98` («el espacio libre de C: de arriba es la prueba»), `:155` («Nada se movio ni se bajo»); `scripts/_nubeSimular.mjs:54` y `:254`. Además, `nubeMedir.ps1:93` mide `libre_despues` antes de que Node lea las copias de la nube (`_nubeMapa.mjs:125`, `_nubeSimular.mjs:226`): la «prueba» no cubre esa parte.
- **Caso medido** (la corrida pedida, `node scripts/_nubeMapa.mjs --archivo auditoria_mapa_prueba.md`, 11:25:23 a 11:26:23):
  - Libre en C: medido afuera con `DriveInfo`: 6.190.936.064 bytes antes y 5.093.965.824 después, o sea 1.096.970.240 bytes menos.
  - El programa imprimió en el mismo renglón «Libre en C: 5,8 GB antes, 5,3 GB despues. Nada se movio ni se bajo.» y el `.md` generado decía «5,8 GB antes y 5,3 GB después … sigue solo en la nube».
  - Después de terminar, el libre volvió: 5.481.803.776 bytes a las 11:26:41, 6.223.413.248 a las 11:26:51 y estable en 6,226 GB durante el minuto siguiente.
  - «En esta PC» por carpeta de primer nivel salió idéntico a la corrida de las 11:16 (13,3 GB en total). No hay evidencia de archivos que hayan quedado bajados.
  - **La causa de la baja temporal no la determiné** (no medí el archivo de paginación ni lo que corrían las otras sesiones en ese minuto).
- **Qué pasa:** el número que se presenta como prueba lo mueve cualquier cosa de la PC, se redondea a 0,1 GB (una bajada de 90 MB no se vería) y no se evalúa: la frase de «no se bajó nada» sale igual. Es un control que da verde sin haber medido bien.
- **Patrón sugerido:** basar la prueba en lo que miden los atributos: `archivos_disco` y `bytes_disco` totales, contra los de la corrida anterior o con una segunda pasada barata solo de atributos. Escribir la frase según el resultado: si sube «en esta PC», decir cuánto y dónde. Dejar el libre de C: como dato de contexto, en MB con decimales, y si baja más de un umbral, decirlo en vez de afirmar «no se bajó».
- respuesta: ____

## Hallazgos Nit (tope 3)

- **[Nit] `scripts/_lib/nubeOrden.mjs:75`.** El borde de `reTramo` no acepta `]` antes del nombre, así que `scripts/_lib/guardianes.mjs:535` (`FIRMA_EXENTOS_RE`, `…[\\/]Claude Fak(?=…)`) no entra en «Claude Fak · Código y tareas (8)» ni en los «20 archivos». Probado: `buscarReferencias` sobre guardianes.mjs da `[]` para «Claude Fak». No es grave: el paso 3 y la sección del guardián sí lo nombran. · respuesta: ____
- **[Nit] `scripts/_lib/nubeOrden.mjs:85-87`.** Hay falsos positivos contados como «código que se rompe si la carpeta cambia de lugar»: dos campos `"_fuente"` de texto (`tools/claude-area/persona/carlos.json:2`, `scripts/_lib/temasCanon.data.json:3`) y mensajes para mostrar (`scripts/_nube.mjs:295`, el aviso de `scripts/_lib/viernesPlanificacion.mjs:122`). Inflan los «20 archivos» con algunos que no arman ninguna ruta. · respuesta: ____
- **[Nit] LEEME 1, `scripts/_lib/nubeOrden.data.json:17`.** Dice «Cada subcarpeta tiene un solo archivo para hacer doble clic». Medido (solo nombres): `2- Mails de Calidad` tiene dos (`Mails-PC-Calidad.cmd` e `instalar.cmd`) y `5- Mails para el asistente de Leo Lattanzi` tiene solo un `.zip`. · respuesta: ____
- Y 5 nits más:
  - en el mapa, `FACUNDO` sale como tipo «nuestro» («Carpetas del asistente») aunque el simulado dice que adentro hay entregables de Barack y que su lugar lo decide Fak (`nubeOrden.data.json:121`);
  - las copias de la nube que pasan `copias_en_la_nube.tope_bytes` se saltean sin sumarse a «sin leer» (`nubeOrden.mjs:298`);
  - «frena guardar en la nube cualquier ruta con la palabra Claude» vale para comandos (probado con New-Item en bash y en PowerShell, y con `cp`). Un Write en `…\5- FACUNDO (…)\claude-memoria\nota.md` con contenido neutro pasa, porque mira solo el nombre del archivo. La conclusión del simulado no cambia;
  - `rutaSalida` frena con una excepción sin atrapar (salida 1 con el código impreso) en vez del mensaje y el 2 de los otros casos;
  - la nota fija de `Claude Fak` (`_nubeMapa.mjs:145`) afirma dos subcarpetas sin mirarlas (hoy existen las dos).

## Afirmaciones verificadas contra la fuente (correctas)

- `tools/claude-area/mails_pc/subir.ps1:55-63`: recorre las carpetas de PRIMER nivel buscando `mails\_entrada` y prefiere la que no es `_CUARENTENA_*`. La copia instalada en esta PC hace lo mismo (`subir.ps1:58`, `:62`).
- El guardián, corrido con su propia función sobre la biblioteca real: con «ASISTENTE INGENIERIA», un `New-Item` en `…\5- FACUNDO (memoria y configuracion)\claude-memoria` **frena** (bash y PowerShell), y `…\ASISTENTE INGENIERIA` y `…\SISTEMA INGENIERIA` pasan. `…\CLAUDE BARACK` y `…\CLAUDE BARACK\5- …\claude-memoria` **pasan**, por `|Claude Barack|` de `FIRMA_EXENTOS_RE` (`guardianes.mjs:535`, bandera `/i`). Hoy `…\Claude Fak\claude-memoria` pasa.
- Plan del 16/10 (`Claude Fak\viernes-17-plan-sistema\10-PLAN_SISTEMA_2026-10-16.md`, leído después de confirmar el atributo: 0x420, sin RECALL): renglón 470, «ASISTENTE INGENIERIA … Contestado: sí, "lo que haga falta"»; renglón 204, «8 de los 11 frenos»; renglón 201, `ACTUALIZACION_CLAUDE_LIMPIO` «ya a la Papelera el 12/10».
- Plan del 08/10 §1.4 (`docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md:111-117`): el árbol 1-/2-/3-/4-/5-/9- y a dónde va cada carpeta coinciden con `destinos` y `carpetas` del canon.
- LEEME 5: «cada 2 horas» (la tarea `\Barack - mi asistente al dia` tiene `PT2H`), «gana el archivo más nuevo» (`_nube.mjs:305`) y «los registros suben y no se borran» (`nubeRegistros.mjs:17`).
- «Respaldo Mail Marcelo Nieve» como archivo viejo de alguien que se fue: lo respaldan las memorias `project_imds_barack.md:80` y `feedback_la_info_ya_la_tengo_no_preguntar.md:59-62`.

## Acciones requeridas (las decide y ejecuta la sesión principal)

1. Importante 1: sumar al simulado las copias instaladas en esta PC con tarea (`%LOCALAPPDATA%\BarackMailsFak`) y corregir «Carlos y Calidad» en `_nubeSimular.mjs:58`, `:180` y en el LEEME 4.
2. Importante 2: búsqueda sin distinguir mayúsculas (o patrón por carpeta en el canon), con su test en las dos direcciones; `mails_area.mjs` pasa de «revisar uno por uno» a «rompe por nombre».
3. Importante 3: que la frase «no se bajó nada» dependa de `bytes_disco` antes y después, y no del libre de C: redondeado.
4. Regenerar los dos `.md` después de arreglar. Mientras tanto, el simulado de hoy no sirve como lista completa para P56.

Limpieza hecha: borré solo `C:\Dev\BarackMercosul\exports\explicaciones\auditoria_mapa_prueba.md` (el de prueba) y mis temporales de `%TEMP%`.
