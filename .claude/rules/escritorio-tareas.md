---
description: El Escritorio es la cola de tareas — cuándo se cierra una y cómo se archiva
paths:
  - "scripts/_escritorio.mjs"
  - "scripts/_lib/serverPaths.mjs"
  - ".claude/hooks/escritorio-guard.sh"
  - "__tests__/scripts/escritorio*.test.mjs"
---

# Escritorio = cola de tareas — regla corta

Una carpeta por pendiente, con el mail del pedido adentro. **En el Escritorio queda solo lo
abierto.**

## 0. `_EN ESPERA` — la bandeja (decisión de Fak, 09/08/2026)

Cuando el Escritorio se llena, a Fak le molesta. Por eso existe **`_EN ESPERA`**: a la vista
quedan solo las tareas de la semana, y las trabadas o de baja prioridad van adentro.

**Lo de adentro sigue ABIERTO.** No es archivo, no es cierre, no es basura: es la misma cola,
corrida de la vista. El relevador **entra y las cuenta una por una**: abiertas = las de la raíz
+ las de `_EN ESPERA`. Contar la bandeja como *una* tarea pierde de vista todo lo que hay adentro.

Sacar una de la bandeja = mover la carpeta a la raíz. Cerrarla sigue siendo `--archivar`, una
por una. **Enforcement:** `clasificarEntrada` la devuelve como `'espera'` y `--archivar` la
rechaza — archivar la bandeja entera mandaría 27 pendientes abiertos al archivo de cerradas de
un saque (tests 13b-13e).

## 1. Cuándo se da por cerrada

**La última acción que era de Barack está hecha Y el entregable ya está en su carpeta por
tipo** de la biblioteca de Ingeniería (`FICHAS DE EMBALAJE`, `2. CONSUMO DE MATERIAL BOM`,
`5. 3D`, `ULM GATE 2`, `DESVIOS`…). Si el entregable no llegó a su carpeta, la tarea no está
cerrada, esté como esté el archivo.

- Esperando a un tercero → **abierta** (bloqueada, no cerrada).
- "El archivo está listo pero no lo mandé" → **abierta**.
- Se archiva lo que **Fak** dio por terminado, no lo que yo creo terminado. Ante la duda,
  se lista como candidata y decide él.

### 1a. Las CLARAS se cierran solas — decisión de Fak, 31/08/2026

Fak, textual: *"modifiquemos el criterio entonces, las que estés seguro que están cerradas
cerrémoslas, porque si no voy a tener que verificar todo cada vez y me canso"*.

Devolverle toda candidata lo convierte en el cuello de botella de su propia cola: revisar veinte
carpetas para archivar veinte obvias.

**Ahora: si se cumplen las TRES patas, se archiva sin consultar.** Si falta una sola, la
tarea NO se toca y va a la lista de dudosas, que sigue siendo de él. La duda no se resuelve
preguntando de a una: se deja abierta y se sigue.

| Pata | Qué la prueba | Qué NO la prueba |
|---|---|---|
| 1. El trabajo está hecho | El texto de la carpeta lo dice, o está el documento emitido | Que el nombre de la carpeta suene a terminado |
| 2. El entregable está en su carpeta por tipo | Se abrió esa carpeta y el archivo está ahí, con fecha posterior al pedido | Que el archivo exista en el Escritorio |
| 3. Nadie quedó esperando respuesta | Hay `.msg` de respuesta, o el pedido no venía de un tercero | Que el trabajo técnico esté hecho |

**Va a la lista de dudosas, nunca al archivo:** cualquier `D` del triage (sin notas
adentro), las bloqueadas por un tercero, las que dicen "listo pero no lo mandé", y toda
carpeta donde las tres patas no se puedan mostrar con una cita textual o una ruta.

Esto AFLOJA una restricción y por eso no lleva gate nuevo. Lo que sigue protegido ya tiene
el suyo: `--archivar` exige `--cerrada` / `--quien` / `--que` / `--donde` (`validarCierre`),
rechaza `_EN ESPERA` entera, y **nada se borra** — archivar es mover, y existe `--reabrir`.

**Los dos motivos por los que no cierra** (triage del 03/08: 30 carpetas, cero cerrables, y
las 30 caían en uno de estos dos). Buscar estos primero:

| Lo que se ve | Lo que falta | Cómo se comprueba |
|---|---|---|
| El trabajo técnico ESTÁ hecho | Nadie avisó al que lo pidió | No hay `.msg` de respuesta en la carpeta |
| El entregable ESTÁ hecho | Quedó suelto en el Escritorio | No está en su carpeta por tipo |

Que el archivo exista en su carpeta **no prueba que el trabajo se hizo**: puede ser el mismo
adjunto que ya estaba ahí, reenviado. Comparar fecha y contenido, no el nombre.

**La antigüedad sale del mail, no del archivo.** El `mtime` se pisa al copiar la carpeta o
cuando OneDrive resincroniza. El relevador ya lo resuelve (vía `_leerMsg.mjs`) y marca
"(fecha de archivo)" cuando tuvo que caer al filesystem: esas no se leen como firmes.

## 1b. El entregable NO se genera en el Escritorio — 2026-08-28

Fak, textual: *"no me dejes cosas en el escritorio, ese es el procedimiento, llenarme el
escritorio de cosas? me respondiste que me dejaste algo en el escritorio, eso absolutamente
molesto"*. Y: *"está mal la regla, hace falta actualizar el procedimiento, no es tan obvio"*.

Generar el entregable dentro de la carpeta de la tarea y reportarlo desde ahí produce solas las
dos copias que el §2 prohíbe: una suelta en la cola y otra que se va al archivo al cerrar.

**Un entregable se escribe DIRECTO en su carpeta por tipo de la biblioteca de Ingeniería.**
El Escritorio guarda el RASTRO — el mail del pedido, capturas, borradores —, nunca el
producto. Para elegir la carpeta se miran los hermanos que ya están ahí, no se inventa una
rama nueva sin evidencia de a qué cliente y proyecto pertenece la pieza.

**Enforcement (duro): `escritorio-guard.sh` bloque 4.** Bloquea escribir un archivo de
entregable (`.pdf .xlsx .xlsm .docx .pptx .dxf .plt .step .stl .glb .iges`) con destino
adentro del Escritorio, tanto por la tool `Write` como por un comando con `--salida` /
`--out` / redirección. Un `.md` o `.txt` de trabajo sigue pasando: lo que se corta es el
producto terminado.

### Y el reporte tampoco termina en el Escritorio

Una tarea no se reporta como hecha diciendo "te lo dejé en el Escritorio". Eso **no es
entregar**: es dejarle a Fak el trabajo de archivarlo, que es exactamente lo que le molesta.
El cierre se reporta con las tres cosas juntas: **qué se hizo · en qué carpeta por tipo quedó
el entregable · que la carpeta de la tarea ya está archivada.** Si alguna de las tres falta,
la tarea no está cerrada y se dice cuál falta.

**Cerrar la tarea es parte de terminarla, no un extra.** Cuando la última acción de Barack
está hecha y el entregable llegó a su casa, `--archivar` se corre en la misma sesión, sin
esperar a que Fak lo pida.

## 2. Se archiva el RASTRO, nunca el entregable

Una tarea cerrada tiene dos mitades y van a lugares distintos:

| Mitad | Dónde va |
|---|---|
| El entregable (ficha, BOM, 3D, ULM, PDF) | Su carpeta **por tipo**. Ya tiene casa: no se toca |
| El rastro (el mail que la originó, capturas, borradores) | `1- GENERAL\TAREAS CERRADAS\<año>\` |

**Nunca copiar el entregable al archivo.** Dos copias del mismo documento en dos lugares es
el problema, no la solución — es lo mismo que "un PN, una BOM vigente". El archivo guarda
únicamente lo que hoy no tiene casa en ningún lado.

La carpeta del rastro va con la fecha de cierre adelante y el nombre original atrás:
`2026-07-27 - <nombre original>`. Así ordena cronológicamente y sigue siendo reconocible.

## 3. El listado es el puente

`TAREAS CERRADAS\<año>\LISTADO DE TAREAS CERRADAS <año>.xlsx` — en Excel, como el
`LISTADO MAESTRO DE INGENIERIA` que ya se usa ahí. Una fila por tarea: **cuándo se cerró,
cuál era, quién la pidió, qué se hizo y en qué carpeta quedó el entregable.**

Ese "dónde quedó" es lo que hace encontrable la tarea dos años después. Sin eso, la carpeta
archivada es una caja sin etiqueta.

**Adentro de la carpeta archivada no se agrega nada**: ni README, ni LEEME, ni notas
(incidente 2026-07-24, marcado GRAVE). El porqué va a mi memoria y a la fila del listado.

## 4. Nada se borra, nunca

Sin plazo de retención: el contexto de un reclamo aparece dos años después con un ECN o un
PPAP viejo. Si una tarea archivada se reabre, **vuelve al Escritorio** y su fila queda
marcada `reabierta AAAA-MM-DD` — la fila no se borra.

### 4a. Reabrir MUEVE la carpeta — nunca queda en los dos lados

`--reabrir` saca la carpeta del archivo y la pone en la cola. La carpeta está **en un solo
lugar**: la fila del listado es la que cuenta la historia. Dos copias de la misma tarea en dos
lugares es el mismo problema del §2, y la peor versión: la copia vieja no se distingue de la
viva salvo abriéndolas.

**Una tarea archivada Y abierta al mismo tiempo es un ROJO del `--check`.** Puede ser una copia
que quedó atrás, o dos vueltas distintas del mismo tema con el mismo nombre — el chequeo dice
las dos lecturas y no decide: se abren las dos carpetas y se mira.

**El caso que originó esto (08 al 11/09/2026).** La tarea de las hojas de proceso del HOTMELT se
reabrió bien el 08/09 — el script dijo "Reabierta" y la carpeta salió del archivo. El 10/09 a las
23:58:35Z **volvió a aparecer en el archivo**, con el contenido viejo del 03/09, el mismo segundo
en que se tocaron las 72 carpetas del año: una pasada sobre el árbol entero, no un comando sobre
esa carpeta. Estuvo dos días en los dos lados y el único aviso que salía era *"está archivada
pero no tiene fila en el INDICE"* — falso: tenía dos filas, las dos `reabierta`. El mensaje
mandaba a buscar al Excel, que estaba bien.

De ahí salieron las tres cosas que ahora hace el script:

1. **`--reabrir` verifica el movimiento** (cantidad de archivos y bytes, igual que `--archivar`)
   y **corre el `--check` al final**. Mover sin verificar es como se perdió de vista la carpeta.
2. **El `--check` mira la cola, no solo el archivo**: cruza las carpetas archivadas contra las
   tareas abiertas (raíz **y** `_EN ESPERA`) y canta la que está en los dos lados.
3. **Una carpeta cuyas únicas filas son `reabierta` no se reporta como "sin fila"**: se reporta
   como lo que es — *no falta la fila, sobra la carpeta*, con la fecha de la última reapertura.

**`--reabrir ... --como "<otro nombre>"`** es para exactamente ese caso: la carpeta viva ya ocupa
el nombre bueno en la cola y hay que sacar del archivo la copia que quedó atrás sin pisarla. Es
un nombre, nunca una ruta. Igual que sin `--como`, la carpeta se mueve y la fila queda.

**Lo que el script NO puede hacer es impedir que la carpeta vuelva**: quien la trajo de vuelta
está afuera del script. Lo que sí puede es que no pase otra vez desapercibida.

**Ojo con el destino**: la biblioteca de Ingeniería es del departamento, no espacio personal
(lleva `(NUNCA BORRAR)` en el nombre y está bajo control documental). Lo que se deja ahí lo
ve el equipo. Es deliberado — sirve de trazabilidad si Fak no está.

## 5. Cómo se hace

```bash
node scripts/_escritorio.mjs                   # relevar + barrido de mails + verificar
node scripts/_escritorio.mjs --check           # invariantes del archivo
node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
     --quien "<quién lo pidió>" --que "<qué se hizo>" --donde "<dónde quedó el entregable>"
node scripts/_escritorio.mjs --reabrir "<carpeta archivada>" [--como "<otro nombre>"]
```

**El barrido de mails es parte del relevamiento** (automatizado 30/08/2026 — antes era un
paso manual que en 3 relevamientos destapó 7 pedidos invisibles). Cruza la Bandeja de
entrada de los últimos 10 días contra los nombres de tarea (abiertas + cerradas) y lista:
los hilos **sin carpeta** (candidatas a pedido invisible) y los **borradores/bandeja de
salida** recientes (la firma de "hecho pero no avisado"). Detect-only: no crea carpetas ni
manda mails. Lógica y tests: `scripts/_lib/mailCache.mjs` + `mailCache.test.mjs`.
Necesita el cache de `_mails.py` (sync programado 2×/día); si está viejo, lo canta.

Todos aceptan `--dry-run`. Las rutas viven en `scripts/_lib/serverPaths.mjs`.
**El DETALLE de las tareas (el listado Excel, los mails, los adjuntos) vive en la biblioteca
y en `.mail-cache/` (gitignoreado), nunca en el repo.** Nombrar una tarea, producto o persona
en código, tests o commits está cubierto por la decisión de Fak del 18/08/2026 (regla
`git-deploy.md`: el repo es público y eso no frena el push). Lo prohibido sigue siendo lo de `git-deploy.md`: credenciales, contenido
de mails/documentos del SGC, `.claude/memory/` versionado.

## Enforcement

- **DURO — `scripts/_escritorio.mjs`**: mover y registrar son la misma operación. **No mueve
  nada** si falta `--quien`/`--que`/`--donde`, si son demasiado cortos, si son relleno
  (`TBD`, `listo`, `-`), si tienen saltos de línea, si la fecha no existe o es futura, si la
  tarea ya figura en el listado, o si el origen no es una tarea. Después de mover **verifica
  que no se haya perdido ningún archivo** comparando cantidad y bytes (OneDrive con Files
  On-Demand puede morder); si no cierra, lo canta y no registra.
  **No tiene una sola llamada de borrado.** `--check` sale con código 1 si una carpeta
  archivada no tiene fila, si una fila apunta a una carpeta que no está, si hay duplicadas,
  si un nombre no arranca con la fecha, **si una carpeta volvió al archivo después de
  reabrirse** (fila `reabierta` + carpeta presente) o **si la misma tarea está archivada y
  abierta a la vez** en la cola (raíz o `_EN ESPERA`) — §4a. `--reabrir` verifica el
  movimiento y corre ese `--check` al terminar; `_cierreSesion.mjs` corre los mismos
  invariantes y **bloquea el cierre de sesión** si alguno rompe.
- **DURO — hook `escritorio-guard.sh`** (PreToolUse): bloquea borrar cualquier cosa del
  Escritorio o de la biblioteca de Ingeniería, mover a mano hacia/desde el archivo, tocar el
  listado a mano, y escribir un README/LEEME/NOTAS suelto en una carpeta de Fak. Recuerda el
  procedimiento 1×/hora al entrar en ese territorio.
- **Tests**: `__tests__/scripts/escritorio.test.mjs` y `escritorioGuard.test.mjs`.
  Dos trampas que costaron un test falso-verde y un commit bloqueado, y que están fijadas
  como vectores: los payloads del hook se arman con `JSON.stringify` (a mano en el shell los
  backslashes de Windows se colapsan y el hook cae en su rama de fallback), y la detección
  exige la **barra de ruta** adelante porque `del` es alias de borrado **y** preposición en
  español — "del Escritorio" en un mensaje de commit se leía como un borrado.
