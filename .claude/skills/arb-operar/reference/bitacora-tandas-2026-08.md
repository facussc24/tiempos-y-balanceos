# Cronica de las tandas de agosto de 2026

Por que cada gate del skill esta donde esta. Se lee para entender el origen de una regla, no para
operar: lo operativo vive en `../SKILL.md` y en los otros archivos de `reference/`.

La leccion que atraviesa las tres tandas: **una limitacion escrita por mi no es un hecho
verificado**. Dos de las que este skill dio por imposibles (el scroll de la grilla, dar de alta)
eran falsas, y costaron 13 lineas sin cargar y un "terminado" que no lo era.

## Tanda del 2026-08-06 — 16 de 16, y lo que costó llegar

Segunda tanda real (16 piezas de una familia, 11 insumos cada una). Cerró en **16 de 16
verificadas contra el export**, y el diff del arb entero dio **0 altas, 0 bajas, 16 cambios**:
nada fuera de lo pedido. Pero salieron cuatro cosas nuevas.

### Pararse en `Parte Superior` es con CLICK, no tabulando `2026-08-06`

Tabular no llega nunca. Si el foco quedó en la solapa —que es donde queda **siempre después
de exportar**— el TAB no entra al campo: la navegación la maneja la grilla, no el diálogo.
Un click real del mouse sí. Adentro de la grilla se sigue tabulando: ahí un click puede caer
en la celda de al lado y escribir sobre el código de un insumo.

### `activar()` no alcanzaba con `SetForegroundWindow` `2026-08-06`

Windows lo bloquea cuando el foreground lo tiene otro proceso — y eso pasa **en cada comando**,
porque la consola desde la que se corre le saca el frente al arb. Hay que `AttachThreadInput`
con el thread que hoy tiene el foreground, y recién ahí Windows deja pasar el cambio. Sin
esto, `--diagnostico` cortaba con "no pude poner el foco" aunque la ventana estuviera visible.

### Dos bugs del parser del export, los dos silenciosos `2026-08-06`

Ninguno tira error: devuelven una BOM incompleta y el recorrido se desfasa.

- El filtro era `re.match('^[0-9]', articulo)`: **solo dejaba pasar productos con código
  numérico**. Familias enteras cuyo código arranca con letra quedaban afuera, y el cargador
  se quedaba sin BOM contra la cual verificar.
- Pedir `len(columnas) >= 8` **descarta las filas partidas**. Y acá eso no es un detalle de
  auditoría: el cargador **cuenta los insumos para saber cuántos TAB dar** (`3 + 5*i`), así
  que un insumo de menos desfasa todo el recorrido y se termina escribiendo sobre otro
  material. Justo las piezas con descripción larga son las que se parten.

**Regla que sale de acá:** cualquier parser del export se valida contra un conteo crudo
independiente, pieza por pieza, antes de usarlo para navegar.

## Tanda del 2026-08-07 — 0 de 12, y la red de seguridad que faltaba conocer

Lote de 36 líneas sobre 12 piezas (8 a 11 insumos cada una). **Grabó 0.** Tres fallas distintas,
**ninguna llegó a escribir en la base** — pero por tres mecanismos diferentes, y uno no era mío.

### 🟢🟢 MIRAR LA PANTALLA: se puede, y cambia todo `CONFIRMADO 2026-08-07`

**El error de método de toda la mañana fue operar a ciegas.** Se puede capturar la ventana con
`PrintWindow` + PIL y **verla**. Con eso se ubican los botones y se hace click real donde
corresponde, en vez de adivinar coordenadas o pelearse con teclas que no llegan.

Helper: `scripts/_arbVer.py` — `foto rel|prod`, `click X Y`, `estado`. Las coordenadas del
click son **relativas a la ventana**, las mismas que se ven en la captura, y `click()` relee el
rect en cada llamada: **la ventana se mueve sola entre corridas**, así que nunca guardar
coordenadas de pantalla.

**Regla nueva: antes de apretar cualquier botón que dispare algo, sacar una foto y mirarla.**
Costó descubrirlo pero evita, por ejemplo, mandar el listado entero a la impresora (ver export).

### 🔴🔴 FOREGROUND NO ES FOCO — por eso se perdían las teclas `CONFIRMADO 2026-08-07`

`SetForegroundWindow` puede devolver éxito y `GetForegroundWindow()` confirmar la ventana, y aun
así **`GetGUIThreadInfo(tid).hwndFocus` da `None`: el arb no tiene el foco de teclado.** Medido:
antes del click `hwndActive=None hwndFocus=None`; después de **un click real del mouse**,
`hwndActive=662340 hwndFocus=662340`.

**Un click real del mouse es lo único que le da foco de teclado.** Sin eso, `keybd_event` se
pierde y parece que "las teclas sintéticas no funcionan". Funcionan — pero hay que darle foco
primero. Chequear `hwndFocus is not None` antes de mandar teclas.

Con foco: `V` **sí** selecciona la solapa `Menú de Insumos` del ribbon. Lo que no anda es el
~~`Y3` del KeyTip~~ - el KeyTip real es **`Y03`** y SI abre (25/08). Tambien anda con **click real**
ubicado en la captura (≈ x=298, y=95 de la ventana principal).

### ~~🔴 LAS TECLAS SINTÉTICAS NO ABREN EL MENÚ~~ — **ERA FALSO. La tecla estaba mal.**

Decía: *"`keybd_event` con la secuencia documentada `Alt Alt → V → Y3` no abre Relación de
Consumo, con Producción al frente y confirmado"*. El experimento estaba bien hecho; **la
conclusión estaba mal sacada**. No era que las teclas sintéticas no llegaran: era que
**`Y3` no existe** — el KeyTip real es `Y03`, de tres caracteres. Se mandaba una tecla que no
correspondía a nada y se concluyó que el canal no funcionaba.

**CORREGIDO 25/08/2026**, con la secuencia leída (no adivinada) de los `KbxLabelClass`:
`Alt → V → Y 0 3` abre la ventana. Ver la sección de navegación por teclado.

**La lección de método, que es lo que vale:** el experimento decía *"mandé estas teclas y no
pasó nada"*, y de ahí salió *"las teclas sintéticas no funcionan"* — un enunciado mucho más
grande que la evidencia. **Antes de concluir que un canal no funciona, verificar que lo que
se mandó por ese canal era correcto.** El dato que faltaba estaba a una lectura de distancia:
los KeyTips son ventanas y se pueden enumerar.

Lo mismo pasó, en chiquito, con *"reabrir la ventana requiere una persona"* (corregido el
20/08 con un click real) — dos veces el mismo patrón en la misma skill.

`_arbVer.py reset` abre Relaciones por click (solapa + botón): funciona y está probado, y solo
con Relaciones CERRADA (regla `arb-no-cerrar.md`, 25/09). La vía por teclado (KeyTips) ya no es
alternativa: el 23/09 apretó `Selección de Empresa` con el ribbon en otra solapa.

### La lección de método

Las fallas del lote **fueron todas detectables antes de correr**, y ninguna lo estaba: el scroll
se calcula del export; el separador se ve con `--leer`; el modal se detecta enumerando ventanas.
**Cada tanda tiene que dejar su gate escrito acá, si no se paga dos veces** — y de hecho se pagó:
escribí el gate del modal a media mañana y aun así lancé dos tandas más sin correrlo.

El orden de arranque que salió de acá vive en `../SKILL.md`, §Orden de arranque de una tanda.

## Tanda del 2026-08-20 — 31 de 31, y dos "esto lo tiene que hacer una persona" que eran falsos

Aplix de m² a metros lineales: 34 líneas objetivo, **31 productos terminados grabados y
verificados**, 3 fuera de alcance por una validación del arb que no estaba documentada.

## Tandas de septiembre — el bloque de estado que abría `../SKILL.md` hasta el 26/09/2026

Movido entero el 26/09/2026, cuando el SKILL pasó a abrir con una tabla de capacidades. Dos
retoques al moverlo: los punteros a "la sección del 31/08 / del 01/09" ahora nombran
`maestro-de-insumos.md`, donde viven, y la viñeta del export dice lo que manda la regla
`arb-no-cerrar.md` (25/09) en vez de "`reset` después de exportar".

> **Cambiar consumos: ANDA** — 14/14 el 05/08 · 16/16 el 06/08 · 36/36 el 07/08 ·
> **31/31 el 20/08** (y ahí el robot aprendió a **recuperarse solo**: cierra el modal y
> reabre la ventana sin pedirle nada a nadie — ver la tanda del 20/08).
> **Dar de alta líneas: ANDA** (`scripts/_arbAlta.py`) — **31/31 el 07/08**, verificadas contra
> el export y con 0 bajas en el diff de la base entera. Borrar líneas sigue fuera de alcance.
> **Modificar un campo del MAESTRO DE INSUMOS: ANDA** — **31/08/2026**, `Es Sub-Producto`
> de `TRO-TEL0001-V1`, diff del export entero 2 altas / 0 bajas / 0 cambios. Todo por
> teclado: se TABULA, no se clickea por coordenada (`maestro-de-insumos.md`, sección del 31/08).
> **Dar de ALTA un CODIGO en el maestro: ANDA** — **15/09/2026**, `427VAR002TAP01`, primera
> corrida del robot (hasta ese dia era "APRENDIDO", grabado de Fak pero nunca ejecutado).
> En `Altas` el click por coordenada **tambien** falla en silencio: un solo click en `Rubro`
> y de ahi TAB (ver `maestro-de-insumos.md`).
> **Sustituir el codigo de una linea: 5/5 el 15/09** — la bolsa de embalaje Patagonia en sus
> 5 BOM, con una linea en la fila 7; diff de la base entera 6257 -> 6257, 0 fuera de lo pedido.
> **Y la `Unidad` tambien: 11/11 el 22/09/2026** (`scripts/_arbUnidad.py`, vinilos Sansuy
> MT2 -> MTL): diff de la base entera 7348 -> 7348, 32 lineas cambiadas y 0 fuera de los 11
> codigos. Va SIEMPRE en la misma tanda que la conversion de consumos (`_arbCargar.py`): la
> unidad es una sola para OC y BOM, y cambiarla sola deja los numeros viejos con la etiqueta nueva.
> **Y la `Descripción` tambien: 3/3 el 01/09/2026** — 27 filas partidas del export → 0, con
> 0 altas / 0 bajas / **0 consumos cambiados**. Ojo con los dos gates que la trababan:
> `&Acepta` esta deshabilitado hasta que `Posee PAPP/PSW` tenga valor, y una tecla mandada
> muy rapido **no llega y no da error** (`maestro-de-insumos.md`, sección del 01/09).
> **Altas EN LOTE: ANDA** (`scripts/_arbAltaLote.py`) — **12/12 el 28/08 en 116 seg**, mismo
> insumo en 12 BOM, diff de la base entera 12 altas / 0 bajas / 0 cambios.
>
> **23/09/2026 — semiterminados de inyección de Patagonia, todo por robot** (diff de la base
> entera 5503 → 5531: 59 altas, 31 bajas, 31 cambios, 0 fuera de la tabla):
> - **Alta de CÓDIGOS en lote + leer la ficha entera + `Es Sub-Producto`**: `scripts/_arbInsumoCampos.py`
>   (`--leer`, `--alta tabla.csv --como <HERMANO>`, `--subproducto`). 12/12 altas y 2/2 flags, releídos.
>   El cartel de Visual C++ salió en CADA alta y el registro grabó igual: el script aprieta `Omitir`.
> - **Alta en un producto SIN BOM**: `_arbAlta.traer_vacio()`. `ac.traer` manda TAB por mensaje, que
>   avanza de a dos, se pasa el `Rubro` vacío y el arb tira `No Ingreso Insumos`. Con TAB real, anda.
> - **Reemplazar una línea ENTERA en el lugar** (código + cantidad + módulo + proceso): columnas
>   opcionales de `_arbSustituir.py`. Resina `KG INY` → semiterminado `1 UNID TAP`, 31/31, sin bajas.
> - 🔴 **`_arbCargar.abrir()` tecleaba KeyTips A CIEGAS** (Alt V Y 0 3) si no veía Relaciones: con el
>   ribbon en otra solapa apretó `Selección de Empresa` (pidió la contraseña) y `About`. Ahora abre por
>   click (`reset_relaciones`). **Una tecla a ciegas aprieta lo que esté abajo; un click fallido no abre nada.**
> - Al reabrir el arb el ribbon puede quedar **minimizado** (solo nombres de solapa): el click al botón no
>   abre nada. Se despliega con la flechita de la derecha, `click (1474, 42)` de `Producción`.
> - El export deja Relaciones en la solapa `Listado`: se vuelve a `Altas` con `_arbVer.py click 118 68`.
>   **No con `reset`**: con Relaciones abierta se niega, y cerrarla crashea el arb (`arb-no-cerrar.md`).
