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

`_arbVer.py reset` sigue usando el click de (298, 95): funciona y está probado. La vía por
teclado es la alternativa cuando no se quiere mover el mouse.

### La lección de método

Las fallas del lote **fueron todas detectables antes de correr**, y ninguna lo estaba: el scroll
se calcula del export; el separador se ve con `--leer`; el modal se detecta enumerando ventanas.
**Cada tanda tiene que dejar su gate escrito acá, si no se paga dos veces** — y de hecho se pagó:
escribí el gate del modal a media mañana y aun así lancé dos tandas más sin correrlo.

El orden de arranque que salió de acá vive en `../SKILL.md`, §Orden de arranque de una tanda.

## Tanda del 2026-08-20 — 31 de 31, y dos "esto lo tiene que hacer una persona" que eran falsos

Aplix de m² a metros lineales: 34 líneas objetivo, **31 productos terminados grabados y
verificados**, 3 fuera de alcance por una validación del arb que no estaba documentada.
