---
name: arb-operar
description: Operar el ERP arb (ARB Sistemas "Producción") por teclado desde Claude — navegación, pantallas, y carga/modificación de consumos en Relaciones de Consumo. Usar cuando haya que cargar o corregir consumos en el arb, verificar una carga, o automatizar cualquier tarea repetitiva dentro del ERP. Complementa `carga-arb` (que arma QUÉ cargar) y `verificacion-consumos` (que valida los números); esta cubre CÓMO se opera el programa.
---

# Operar el arb desde Claude

> **Cambiar consumos: ANDA, pero sólo si la línea cae en las 6 filas visibles** (14/14 el
> 2026-08-05 · 16/16 el 2026-08-06 · **0/12 el 2026-08-07**, que falló por líneas en la fila 7+).
> Sale con reintentos. **Antes de una tanda nueva: calcular el índice de fila de cada línea
> objetivo y partir la tabla en robot / a mano** — ver "El scroll SÍ es un problema" y las
> tandas del 06 y del 07.
> Dar de alta y borrar líneas: fuera de alcance, necesita otra grabación y otra red.
> Lo marcado `CONFIRMADO`/`medido` se probó; lo demás es hipótesis y **no se ejecuta sin
> verificar antes**.

## Qué es

`Z:\arb\prod\produc.exe` — **"Producción y Almacenes", ARB Sistemas**, versión 14.05.26.
App Borland C++ de ~2000, sin soporte (el programador original falleció). Multiempresa:
la empresa activa se ve abajo a la derecha (`Empresa : BA` = Barack Argentina SRL).

Módulos hermanos, mismo estilo: `Z:\arb\compras\compras.exe` · `Z:\arb\oc\moc.exe` ·
`Z:\arb\ventas\ventas.exe`.

**Los datos NO son alcanzables por red.** No hay `.DBF` ni `.DDF` accesibles desde `Z:`; el
driver *Pervasive ODBC Interface* está instalado en la notebook pero sin diccionario ni DSN.
El `.exe` tampoco tiene importación masiva de BOMs (su "Importa Novedades de Central" es
sincronización entre empresas, otra cosa). **Por eso la única vía de automatización es la
interfaz.** Ver la sección de seguridad abajo antes de escribir nada.

## Regla de oro

**El robot hace exactamente lo que haría Fak, tecla por tecla.** Así el arb aplica sus
validaciones igual — no se entera de que no es una persona. Nunca escribir en los archivos
de datos por fuera del programa: el daño no se ve el día que pasa, se ve semanas después en
el stock.

## Pantalla principal `CONFIRMADO`

Ribbon estilo Office con estas solapas:

`Archivo` · `Movimientos de Insumos` · `Producción` · `Listados de Stock PT` ·
`Consulta de Producción Por Sector` · `Productos Terminados` · `Menú de Insumos` ·
`Maestros` · `Utilitarios`

Barra de estado (abajo): nombre de la pantalla · fecha · `Usuario : FACUNDO` · `Empresa : BA`.

### Cómo llegar a los consumos

`Menú de Insumos` → botón **`Relación de Consumo de Prod. Terminados`**
Abre la ventana modal **`Maestro de Relaciones - BA`**.

## Ventana `Maestro de Relaciones - BA` `CONFIRMADO`

Tres solapas: **`Altas de Insumos de Un Producto`** · `Listado de Insumos de Un Producto` ·
`Escape`.

### Solapa `Altas de Insumos de Un Producto` — acá se carga y se corrige

| campo | coords (pantalla 3840x1080, arb en el monitor izquierdo) |
|---|---|
| `Parte Superior` (el producto terminado) | (559, 368) |
| grilla `Detalle de Insumos`, 6 filas visibles | filas Y = 461, 485, 508, 532, 556, 580 |
| `F1 Consulta de Partes` | abajo a la izquierda |
| `ACEPTA` / `CANCELA` | (442, 798) y al lado |
| `ESC Finaliza` | pie de la ventana |

Columnas de la grilla y su X:

| # | columna | X | qué es |
|---|---|---|---|
| 1 | `Rubro` | 390 | |
| 2 | `Medida` | 493 | **es el código del insumo** (ojo con el nombre) |
| 3 | `Descripción` | 716 | |
| 4 | `U.M.` | 886 | unidad — sale del maestro, no se elige |
| 5 | **`Cantidad`** | **949** | **EL CONSUMO. Es la columna que se corrige.** |
| 6 | `Módulo` | 1041 | |
| 7 | `Proceso` | 1166 | |

> El export `RELACIONES.TXT` llama `Medida` a la columna del código y `Consumo` a `Cantidad`.
> Es el mismo dato con otro rótulo — no confundirse al cruzar.

### Solapa `Listado de Insumos de Un Producto` `CONFIRMADO`

Campos `Desde Artículo` · `Hasta Artículo` · combo `Salida`. Es el generador del reporte;
de acá salen los `.TXT` que después se leen. **Sirve para verificar, no para cargar.**

## Traer la BOM de un producto `CONFIRMADO 2026-08-04`

> ⚠️ **Este repo es PÚBLICO: acá no van códigos de producto, códigos de material ni
> consumos reales.** Los ejemplos son genéricos. El dato real vive en `.arb-cache/`
> (gitignoreado) y en el servidor.

```
1. Menú de Insumos  →  Relación de Consumo de Prod. Terminados
2. Escribir el código del producto en `Parte Superior`
3. >>> TAB <<<   ← ESTA es la tecla que trae los insumos a la grilla
```

Al tabular aparecen la **descripción del producto** al lado del código y **todas las filas de
la BOM**. Verificado en vivo contra el export `RELACIONES.TXT`: coincide fila por fila,
código, unidad y consumo.

**No es `Shift`+`↑`** (probado dos veces, no hace nada) ni `Alt` (el ribbon no tiene KeyTips)
ni las flechas para cambiar de solapa. La navegación del ribbon es con mouse; **adentro de la
ventana, el teclado sí manda**.

## Mapa de teclas del programa `CONFIRMADO` (extraído del binario)

El autor del arb lo manejaba todo por teclado y **dejó la ayuda escrita adentro del `.exe`**.
Textos literales encontrados:

| tecla | qué hace (texto del programa) |
|---|---|
| `Alt`+`A` | **`Próximo Campo`** |
| `Alt`+`R` | **`Campo Anterior`** |
| `ESC` | **`Avanza a Próximo Campo`** … y también `ESC Finaliza` según el contexto |
| `F1` | `Seleccione Insumo Utilizando F1` — consulta (Partes / Rubros / Medidas) |
| `F3` | `Consulta de Stock Disponible` · `F3 Muestra Stock` |
| `Enter` | `Presione Enter` (confirmar) |

> ⚠️ **`ESC` no cancela: avanza de campo.** En cualquier otro programa ESC es "salir sin
> guardar". Acá no. Un robot que asuma lo de siempre hace cualquier cosa.

`TAB` también funciona (es el estándar de Windows) y es lo que se usa para traer la BOM.

### Dónde está parado el cursor: mirar el botón F1

El botón de abajo a la izquierda **cambia de nombre según la columna** donde está el foco.
Es el indicador más confiable — evita adivinar:

| el botón dice | el foco está en |
|---|---|
| `F1 Consulta de Partes` | campo `Parte Superior` |
| `F1 Consulta de Rubros` | columna `Rubro` |
| `F1 Consulta de Medidas` | columna `Medida` (el código del insumo) |

`TAB` avanza de celda: `Parte Superior` → `Rubro` fila 1 → `Medida` fila 1 → … `ESC` finaliza.

**POR CONFIRMAR:** cuántos TAB hasta `Cantidad`, cómo bajar de fila, y cómo se graba
(¿`ACEPTA`, F-key?). No se prueba dentro de una fila con datos reales sin OK de Fak — un
tabulador de más y se pisa un renglón.

## Segundo plano: LEER sí, ESCRIBIR no `PROBADO 2026-08-04`

Los campos son controles Win32 reales (`RichEdit20A` / `Edit`), cada uno con su handle. Eso
permite **leerlos con `WM_GETTEXT` sin robar el foco** — Fak puede seguir usando la PC.
Herramienta: `scripts/_arbUI.py --leer`. Funciona perfecto.

**Escribir por mensajes NO funciona** (probado sobre una pieza real):

| lo que se envió | qué pasó |
|---|---|
| `WM_CHAR` letra por letra a la celda `Cantidad` | el número **aparece** en pantalla |
| `BM_CLICK` al botón `&Acepta` | **no graba**: el export mostró el valor viejo sin cambios |
| `TCM_SETCURSEL` al tab control | cambia el índice pero **la pantalla no cambia de solapa** |

**El patrón es siempre el mismo: los mensajes sintéticos cambian el estado visual, pero el
programa no ejecuta su lógica.** Nunca "toma" el valor tipeado (le falta el evento real que
confirma la celda), así que `ACEPTA` graba lo que había antes.

⚠️ **Trampa peligrosa:** después de escribir así, la pantalla muestra el valor nuevo y la base
tiene el viejo. **Leer la pantalla NO prueba que se grabó.** La única verificación válida es
exportar y mirar el archivo. Casi lo doy por bueno mirando la pantalla.

**Conclusión: para escribir hace falta foco real** (teclado de verdad sobre la ventana activa).
Si se quiere no interrumpir a Fak, la salida es correr el arb en **otra sesión** (otra PC o RDP):
el `.exe` vive en `Z:\arb\prod\` y lo puede abrir cualquier máquina de la red.

## Exportar para verificar `CONFIRMADO`

### La secuencia, en cuatro teclas `dato de Fak 2026-08-06`

Estando en la solapa `Listado de Insumos de Un Producto`:

```
TAB  TAB            ← Desde Artículo → Hasta Artículo → combo Salida
↓  ↓  ↓             ← baja 3 en el combo
ENTER  ENTER  ENTER ← genera el archivo
```

**Esto es lo primero que hay que probar. Nada de pelearse con el combo.** Perdí ~10 minutos
mandándole clicks y `WM_CHAR` al ComboBox: el click no le mueve el foco (el arb se lo queda
en `Desde Artículo`) y la letra que tipeé terminó **escrita en el campo de filtro**. Tabular
tampoco: el TAB desde ahí cae en un botón y se queda. Fak lo hace en cuatro teclas.

> Ojo: lo probé por teclado sintético (`keybd_event`) y **no disparó el export**. Con teclado
> real de Fak sí anda. Si hace falta automatizarlo, hay que medirlo — no darlo por hecho.

### El combo y sus opciones

`0 Pantalla` · `1 Impresora` · `2 Disco C` · **`3 Tabla EXcel`** · `4 Formato PDF` ·
`5 HTML` · `6 Word/RTF` · `7 Electronico`

⚠️ **La salida `Tabla EXcel` SOBRESCRIBE `C:\tmp\RELACIONES.TXT`** con un reporte formateado
(marcos de caracteres, "Hoja 1", encabezado con fecha) — **no** con el tabulado que parsea
`_refreshArb.mjs`. Los campos Desde/Hasta tampoco acotaron nada: salió el listado completo.
Antes de exportar así, tener el tabulado guardado.

En ese reporte, cada línea de insumo es:
`rubro · codigo · descripcion · unidad · consumo · costo · modulo · proceso`
y trae **`Costo Unitario`** al pie: **el consumo alimenta el costeo del producto**, no sólo
las compras. Sube el impacto de cualquier error de consumo.

## Navegación 100% por teclado `CONFIRMADO 2026-08-04`

**Doble `Alt` muestra los KeyTips del ribbon** (dato de Fak — sin esto no hay forma de abrir
las pantallas sin mouse). Si el ribbon está colapsado, `Ctrl`+`F1` lo expande primero.

```
Alt  →  V  →  Y3      abre Relación de Consumo de Prod. Terminados
```

KeyTips de las solapas: `F` Archivo · `M1` Movimientos de Insumos · `P1` Producción ·
`L` Listados de Stock PT · `S` Consulta por Sector · `P2` Productos Terminados ·
**`V` Menú de Insumos** · `M2` Maestros · `U` Utilitarios.
Dentro de `V`: `Y1` ABM de Insumos · `Y2` Rubros · **`Y3` Relación de Consumo** · `Y4` Depósitos.

Con eso, el flujo hasta escribir el valor funciona entero sin tocar el mouse:
abrir → escribir el producto → `TAB` (trae la BOM) → **2 `TAB` más para llegar a `Cantidad`
de la fila 0** → escribir.

**Confirmar el foco antes de escribir, siempre.** `GetGUIThreadInfo(tid)` devuelve el
`hwndFocus` de otro proceso; si no coincide con la celda buscada, **abortar sin escribir**.
Sin esto los clicks caen en la celda de al lado y se escribe basura en el código del insumo
(pasó: quedó `tar atA999R8395` en pantalla — no llegó a grabar, pero por suerte, no por diseño).

## RECETA QUE FUNCIONA `14 de 14 cargadas y verificadas 2026-08-05`

`scripts/_arbCargar.py`. Modos: `--diagnostico` (read-only), `--seco` (recorre sin grabar),
`--tabla x.csv` (dry-run) `--apply`, `--verificar`.

```
Alt -> V -> Y3                     abrir (teclado real)
gate: ¿estoy en la solapa Altas?   si no hay grilla, ABORTAR — no escribir a ciegas
CLICK en Parte Superior            <- click, NO tabular (ver abajo)
escribir el codigo CON FOCO        <- o se pierde el guion
TAB                                trae la BOM
ubicar la fila POR CODIGO          nunca por posicion
TAB real hasta Cantidad            (el de mensaje avanza de a DOS y saltea)
escribir el valor CON EL FOCO PUESTO
TAB real por todas las celdas, VERIFICANDO cada una contra la BOM del export
ENTER sobre &Acepta                <- graba. NO ESPACIO, NO Alt+A, NO BM_CLICK
```

**Cuántas celdas se recorre se calcula antes, del export** (idea de Fak). La fórmula, medida
de la grabación y confirmada en vivo — son **5 celdas tabulables por fila, no 7**:

| desde | hasta | TABs |
|---|---|---|
| `Parte Superior` | `Cantidad` de la fila `i` (base 0) | **`3 + 5*i`** |
| `Parte Superior` | botón `&Acepta`, con `N` insumos | **`5*N + 2`** |

`Descripción` y `U.M.` existen como controles (por eso `Cantidad` es el índice 4 al leer)
pero **no reciben el foco**. La versión vieja decía "insumos × 7 columnas": estaba mal.

**El conteo es la predicción, no la orden.** Después de cada TAB se lee el control con foco y
se compara su contenido contra la BOM del export. A la primera discrepancia se aborta **sin
ENTER** — que es el único punto de no retorno. Comparar por contenido y no por handle es lo
que hace que ande igual cuando la grilla scrollea (los controles se reciclan, el contenido no).

**El scroll SÍ es un problema, y la versión vieja de esta línea estaba mal.** Decía "el scroll
no es un problema: se grabaron piezas de 6 y 7 insumos sin drama" — y es cierto que una pieza
puede tener 7, 9 u 11 insumos sin drama, pero eso **no es lo que importa**. Lo que importa es
en qué fila cae **la línea que hay que escribir**: la grilla muestra **6 filas** y una línea en
la fila 7 o más abajo **no se alcanza**. El cargador aborta con *"está en la fila N y la grilla
muestra 6: hay que scrollear para escribirla, y eso no está resuelto"*.

**Gate obligatorio antes de correr una tanda** (2026-08-07: 7 de 36 líneas fallaron por esto,
todas en piezas de 11 insumos): calcular del export el **índice de fila de cada línea objetivo**
y partir la tabla en dos — las de índice 0-5 van al robot, las de 6 en adelante van a mano.

```python
idx = [f[2] for f in boms[pn]].index(codigo_insumo)   # 0-based; >=6 => a mano
```

El índice depende del **orden del arb**, no del orden de la tabla: los materiales de corte suelen
quedar arriba (índices 0-1) y los hilos abajo. En el lote del 07/08 dio 23 alcanzables y 13 fuera.

### Qué necesita foco y qué no `CORREGIDO 2026-08-05`

| operación | ¿foco? |
|---|---|
| **leer** (`WM_GETTEXT`) | **no** — anda en segundo plano mientras Fak usa la PC |
| **escribir** (`WM_CHAR` dirigido) | **SÍ, siempre** — ver abajo |
| **recorrer con TAB** | **SÍ** — `GetGUIThreadInfo` devuelve `None` si la ventana no está activa |

> ⚠️ **La versión vieja de esta tabla decía que escribir NO necesitaba foco. Estaba mal, y
> era la razón de fondo por la que las cargas "entraban" y no grababan.** Medido el
> 05/08 sobre el campo `Parte Superior`: sin foco, un código `NN-NNNN` queda **`NNNNNN`** —
> se pierde el guión; con foco entra entero. En una celda de la grilla es peor: el valor se ve en
> pantalla y **vuelve solo al viejo** en cuanto el recorrido pasa por ahí.

**Sólo leer anda en segundo plano.** Cualquier escritura o recorrido necesita la máquina
libre. Si Fak toca la PC durante la corrida se aborta el lote entero: la pieza queda escrita
SIN grabar (inofensivo, se descarta con CANCELA) pero no se sigue con la siguiente.

### El TAB por mensaje AVANZA DE A DOS `LA CLAVE — medido 2026-08-05`

`PostMessage(WM_KEYDOWN, VK_TAB)` mueve el foco **dos celdas**, no una. Traza real:

```
fila0.codigo -> fila0.modulo -> fila1.rubro -> fila1.cantidad -> fila1.proceso -> fila2.codigo ...
```

El arb traduce el `WM_KEYDOWN` a un `WM_CHAR` y procesa los dos. Con lo cual el recorrido
por mensaje **sólo alcanza la mitad de las posiciones, según la paridad** — y nunca cae en
las otras. Eso explica de una vez:

- por qué el 04/08 unas piezas cargaban y otras no (dependía de si la celda `Cantidad` caía
  en la paridad alcanzable, no de cuántos insumos tenía la pieza);
- por qué el recorrido "ciclaba sin llegar nunca al botón".

**El TAB de teclado real avanza de a una y pasa por todas.** Por eso el recorrido va con
teclado real, sin excepción.

### Dos botones `&Acepta` `medido 2026-08-05`

La ventana tiene **dos** botones con ese texto: el de la solapa **Altas** (graba la carga) y
el de la solapa **Listado** (dispara el export). Y **el arb destruye y recrea los controles
al cambiar de solapa**, así que los handles cambian solos.

Buscar "el `Button` que dice Acepta" devuelve el primero que aparezca en el `EnumChildWindows`
— una lotería. Hay que **desempatar por parentesco con la grilla y abortar si queda ambiguo**.

### Los controles no son tab stops `medido 2026-08-05`

`WS_TABSTOP` está en **cero** en toda la fila, y `GetNextDlgTabItem` no llega al botón: la
navegación **no la maneja el dialog manager**, la maneja la grilla. `WM_GETDLGCODE` devuelve
`0x008B` (incluye `DLGC_WANTTAB`: el control se queda el TAB) y `0x008F` en `Cantidad`, que
además pide `DLGC_WANTALLKEYS`. Por eso no sirve razonar sobre esta ventana como un diálogo
normal.

### Errores propios, para no repetirlos

- **No verificar entre pieza y pieza.** Releer el producto deja la ventana en un estado del que
  no vuelve y la siguiente escribe al vacío. Verificar todo junto al final.
- **No usar `SetFocus` entre procesos** — no funciona en Windows sin `AttachThreadInput`, y el
  texto termina en otro control.
- **Confirmar el foco antes de escribir** (`GetGUIThreadInfo`) y **abortar si no coincide**.
  Esa guarda es lo único que evitó corromper el código de un insumo de producción.

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

### El arb puede tirar `HEAP CORRUPTION DETECTED` `visto 2026-08-06`

Cartel `Microsoft Visual C++ Runtime Library` → *"Debug Error! … HEAP CORRUPTION DETECTED …
CRT detected that the application wrote to memory after end of heap buffer"*, con botones
**Anular / Reintentar / Omitir**.

Es un bug del propio arb: se pisó su memoria. Apareció después de ir y venir varias veces
entre solapas y exportar. **Mientras el cartel está, la ventana no responde a nada** — los
clicks en las solapas no hacen efecto y parece colgada. Ese es el síntoma que hay que
reconocer.

- **Anular** y reabrir el programa. Es lo correcto.
- **Omitir** deja al programa siguiendo con la memoria ya corrupta. Con consumos de
  producción de por medio, no.
- Después de reabrir: **re-exportar y diffear contra el respaldo previo**, para confirmar que
  no quedó nada raro. En este caso no quedó.

Detectarlo es una línea: enumerar las ventanas del proceso del arb y buscar clase `#32770`
con título `Microsoft Visual C++ Runtime Library`. Conviene chequearlo antes de decidir que
"la ventana está trabada".

### Reintentar es seguro, y hace falta `2026-08-06`

La tanda no sale de una: el TAB se pierde de vez en cuando y el recorrido se desfasa. Real:
8/15 → 3/7 → 3/4 → 1/1. Cuando falla, **falla sin escribir** (el gate compara el contenido de
cada celda y aborta antes del ENTER), así que no deja nada a medias.

**Reintentar no puede pisar dos veces**: el gate de `valor_esperado` compara contra lo que hay
antes de escribir, así que una pieza ya cargada se rechaza sola con *"tiene X y esperaba Y —
no lo piso"*. Eso es un éxito del reintento, no un error.

Cuando una pieza falla, la siguiente suele fallar con "la ventana no está activa" — efecto
dominó del estado que quedó. No significa nada: se reintenta y entra.

## Tanda del 2026-08-07 — 0 de 12, y la red de seguridad que faltaba conocer

Lote de 36 líneas sobre 12 piezas (8 a 11 insumos cada una). **Grabó 0.** Tres fallas distintas,
**ninguna llegó a escribir en la base** — pero por tres mecanismos diferentes, y uno no era mío.

### El tope del arb es 99,999999 y su cartel delata la coma perdida `CONFIRMADO`

Al escribir un consumo **se perdió la coma**: `0,29867000` entró como `029867000`. El arb lo
leyó como veintinueve millones y abrió un modal propio:

```
clase #32770 · título "Error" · [Static] "Valor Fuera de Rango (99.999999)" · [Button] Aceptar
```

Dos cosas que valen para siempre:

- **El campo `Cantidad` topea en 99,999999.** Cualquier valor ≥ 100 lo rechaza el programa. Eso
  convierte la coma perdida en una falla **ruidosa**, no silenciosa — es la tercera red, después
  del gate de foco y del gate de contenido, y es la única que no depende de mi código.
- **Detectarlo es una línea**, igual que el `HEAP CORRUPTION`: enumerar las ventanas visibles del
  proceso `produc.exe`, buscar clase `#32770`, y leer el `Static` de adentro. Leer no roba el
  foco, así que se puede diagnosticar sin tocar la sesión de Fak. Vale la pena chequearlo
  **antes** de concluir "la ventana no responde": puede haber un modal esperando `Aceptar`.

Secuencia para salir: **`Aceptar` en el modal → `CANCELA` en la solapa de Altas → recién ahí
exportar.** Nunca `ACEPTA` ni `ESC` con una celda escrita a medias.

### 🟢🟢 MIRAR LA PANTALLA: se puede, y cambia todo `CONFIRMADO 2026-08-07`

**El error de método de toda la mañana fue operar a ciegas.** Se puede capturar la ventana con
`PrintWindow` + PIL y **verla**. Con eso se ubican los botones y se hace click real donde
corresponde, en vez de adivinar coordenadas o pelearse con teclas que no llegan.

Helper: `arbver.py` (scratchpad) — `foto rel|prod`, `click X Y`, `estado`. Las coordenadas del
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
`Y3` del KeyTip; el botón `Relación de Consumo de Prod. Terminados` se abre con **click real**
ubicado en la captura (≈ x=298, y=95 de la ventana principal).

### 🔴🔴 EL EXPORT DEJA EL ARCHIVO TOMADO POR EXCEL `CONFIRMADO 2026-08-07`

**La salida `Tabla EXcel` abre `C:\tmp\RELACIONES.TXT` en Excel, y Excel se queda con el
archivo.** El export siguiente **falla en silencio**: el arb no avisa nada, el `mtime` no
cambia, y uno se queda mirando el botón `ACEPTA` creyendo que está roto. Perdí media hora acá.
Lo cazó Fak: *"es como que sale un error de que tenés otro Excel abierto con el mismo nombre"*.

Peor: Excel abre además un cartel **"De forma predeterminada, Excel realizará las siguientes
conversiones de datos: • Quitar ceros iniciales"** con botones `Convertir` / `No convertir`.
⚠ **Nunca `Convertir`**: sobre consumos como `0,00107250` sacar los ceros iniciales destruye
el dato. Se contesta **`No convertir`** y se cierra Excel.

**Gate antes de exportar:** que no haya proceso `EXCEL.EXE` con `RELACIONES.TXT`, y que el
archivo se pueda abrir en modo append. Si no:

```python
open(r'C:\tmp\RELACIONES.TXT', 'a').close()   # PermissionError = alguien lo tiene tomado
```

**Después de cada export, cerrar Excel.** Si no, el próximo export no sale.

### 🟢 EL SCROLL DE LA GRILLA NO EXISTE COMO PROBLEMA `dato de Fak 2026-08-07`

Pregunté cómo se llega a una línea que está debajo de las 6 visibles. Fak: *"llegás cuando
llegás a la última línea de la sexta, digamos, y le das TAB: automáticamente baja a la número
7"*. **La grilla scrollea sola al tabular.** El cargador abortaba con "hay que scrollear y eso
no está resuelto" y era una limitación inventada: 13 líneas quedaron sin cargar por eso.

Lo único que NO se puede hacer con una fila fuera de vista es **leer** su valor viejo — el
control todavía no existe. No importa: `recorrer()` compara el contenido de cada celda contra
el export antes de escribir, así que la verificación pasa de ser previa a ser *al llegar*.
Implementado en `cargar_producto()`: si la primera celda a cambiar cae fuera de vista, se ancla
en la última fila visible y se sigue tabulando.

### 🔴 EXPORTAR: el combo se RESETEA al cambiar de solapa `CONFIRMADO 2026-08-07`

El `Salida` vuelve a **vacío** cada vez que se entra a la solapa `Listado`. Con el combo vacío,
`ACEPTA` no hace nada — y ahí se pierden diez minutos creyendo que el botón está roto.

Y el click sobre el combo **no le da el foco** (ya estaba anotado): el arb se lo queda en
`Desde Artículo`. La receta que funciona, entera:

```
click en la solapa `Listado de Insumos de Un Producto`
click en el campo `Desde Artículo`      <- foco real
TAB TAB                                  <- ahora sí, foco en el combo Salida
↑ x8                                     <- pisar en la opcion 0, venga de donde venga
↓ x3                                     <- 3 = Tabla EXcel
>>> FOTO Y MIRARLA <<<                   <- GATE, ver abajo
ENTER ENTER ENTER                        <- 1 dispara ACEPTA, los otros cierran el ARB Editor
```

⚠️ **El GATE de la foto no es opcional.** Desde el combo vacío, `↓↓↓` cae en **`Impresora`**, no
en `Tabla EXcel`. Aceptar ahí manda **todo** el listado de relaciones a la impresora de la
oficina. Se verifica con la captura que dice `Tabla EXcel` **antes** de apretar ENTER.

El export abre una ventana `ARB Editor - Listado de Relaciones` y **tarda ~60 s en terminar de
escribir** `C:\tmp\RELACIONES.TXT`. Leer el archivo antes da un tabulado **cortado a la mitad**
que parsea sin error. **Esperar a que el tamaño se estabilice** (y que pasen unos segundos desde
el último cambio de mtime) antes de verificar.

### 🔴🔴 UNA CELDA SUCIA ENVENENA TODAS LAS CORRIDAS SIGUIENTES `CONFIRMADO 2026-08-07`

**Es el hallazgo más caro del día.** Una escritura fallida deja el valor podrido en la celda, y
ese valor **sobrevive a volver a entrar el producto**: el arb mantiene el buffer de edición del
registro abierto. `chequear_pantalla` no lo caza porque **compara códigos, no valores**.

Consecuencia: la primera falla real fue una coma en la tabla; las tres corridas siguientes
fallaron **por la basura que dejó la primera**, con mensajes que apuntaban a otro lado
("la ventana perdió el frente"). Se persiguió el síntoma durante una hora.

**Gate: después de CUALQUIER corrida fallida, resetear la ventana antes de reintentar.**
`&Cancela` suele estar deshabilitado; lo que sí funciona es **`WM_CLOSE` a la ventana
`Maestro de Relaciones`**: descarta la edición, no pide confirmación y no graba (probado). Después
hay que reabrirla — y eso lo tiene que hacer una persona (ver abajo).

**Y verificar los valores, no sólo los códigos**, antes de escribir: leer las celdas de
`Cantidad` y compararlas contra la BOM del export. Si alguna no coincide, la ventana está sucia.

### 🔴 EL SEPARADOR DECIMAL: la regla completa `CONFIRMADO 2026-08-07`

| qué se manda | resultado |
|---|---|
| coma, con o sin foco | **se strippea siempre** — `0,123` queda `0123` |
| punto, sin foco | **se strippea** — `0.0005070` quedó `00005070` |
| punto, con foco | entra bien |

O sea: **la tabla va en punto Y la celda tiene que tener el foco.** Cualquiera de las dos que
falte produce un número multiplicado por 10^n → `Valor Fuera de Rango` → modal → todo lo demás.

Ojo: escribir por mensaje **no es determinístico**. En la misma sesión, la misma secuencia
`EM_SETSEL` + `WM_CHAR` una vez reemplazó el valor y otra vez no hizo nada. **No improvisar
escrituras sueltas sobre la ventana viva**: se usa el cargador, que verifica cada celda.

### 🔴 LAS TECLAS SINTÉTICAS NO ABREN EL MENÚ `CONFIRMADO 2026-08-07`

`keybd_event` con la secuencia documentada `Alt Alt → V → Y3` **no abre** `Relación de Consumo`,
con `Producción` al frente y confirmado. Es el mismo límite que ya estaba anotado para el combo
del export. **Reabrir la ventana después de cerrarla requiere una persona.** Por eso cerrarla
para limpiar tiene un costo: hay que pedir que la reabran.

### 🔴 LA CAUSA RAÍZ DE LA COMA: la grilla usa PUNTO, el export usa COMA `CONFIRMADO 2026-08-07`

```
grilla en pantalla   0.0005070     ← PUNTO, 7 decimales
export RELACIONES    0,00050700    ← COMA,  8 decimales
```

**La tabla del cargador se arma con el valor en formato GRILLA (punto).** Si se genera desde el
export y se deja la coma, el arb se la come y el número entra multiplicado por 10^n → `Valor
Fuera de Rango`. Las tandas de 14/14 y 16/16 andaban porque sus CSV tenían punto; la del 07/08
falló porque generé el CSV desde el export. `valor_esperado` puede quedar con coma: se compara
con `num()`, que normaliza. **El que importa es `valor_nuevo`.**

Verificarlo cuesta un comando y no roba el foco: `python scripts/_arbUI.py --leer`.

### 🔴 LA GRILLA NO ARRANCA SIEMPRE EN LA FILA 1 DE LA BOM `CONFIRMADO 2026-08-07`

**La posición del scroll es un estado que cambia solo, y el cargador no la mira.** Medido dos
veces sobre la misma pieza, con minutos de diferencia: una vez las celdas visibles eran los
renglones 3-6 de la BOM, otra vez los renglones 2-6. La cuenta `3 + 5*i` da por sentado que
**fila visible 0 == renglón 0 de la BOM**, y cuando la grilla está corrida escribe en el renglón
equivocado. Ahí el arb rechaza el valor y abre el modal — que es el `Valor Fuera de Rango` que
apareció en las tres tandas del 07/08 y que se veía como "la ventana perdió el frente".

**Cómo detectarlo sin escribir nada:** enumerar los hijos de la ventana, quedarse con los
`RichEdit20A` cuyo texto matchea `\d+\.\d{7}` (ésas son las celdas de `Cantidad`) y comparar esa
secuencia contra la BOM del export. **Si la primera no es el renglón 0, la grilla está corrida.**

```python
celdas = [t for h, c, t in ctrls if re.fullmatch(r'\d+\.\d{7}', (t or '').strip())]
# comparar `celdas` contra [f[5] for f in bom] para sacar el offset real
```

Mientras el cargador no mida ese offset y lo sume al recorrido, **una tanda sólo es confiable si
se verifica que la grilla arranca en el renglón 0** — y si no, se re-entra la pieza hasta que
así sea. Este es el arreglo pendiente número uno del robot.

### 🔴 EL MODAL BLOQUEA TODO Y NO SE CIERRA POR MENSAJE `CONFIRMADO 2026-08-07`

Mientras el `#32770` está abierto, `Maestro de Relaciones` y `Producción` quedan
**`IsWindowEnabled == False`**. Todo intento de escribir falla con *"no pude poner el foco en el
control antes de escribir"* — **en las 12 piezas, sin excepción**. Ese error en masa no es un
problema de foreground: **es el síntoma de un modal olvidado**.

Y **`BM_CLICK` sobre su botón `Aceptar` NO lo cierra**, igual que no graba el `&Acepta` de la
grilla. El modal lo tiene que cerrar una persona con un click real.

**Gate obligatorio al arrancar CUALQUIER tanda** (y antes de cada reintento): enumerar las
ventanas visibles de `produc.exe`; si hay un `#32770`, **abortar de entrada** pidiendo el click,
en vez de gastar 12 productos descubriéndolo. El 07/08 corrí dos tandas contra un modal abierto
desde la primera.

### La lección de método

Las fallas del lote **fueron todas detectables antes de correr**, y ninguna lo estaba: el scroll
se calcula del export; el separador se ve con `--leer`; el modal se detecta enumerando ventanas.
**Cada tanda tiene que dejar su gate escrito acá, si no se paga dos veces** — y de hecho se pagó:
escribí el gate del modal a media mañana y aun así lancé dos tandas más sin correrlo.

**Por eso el orden de arranque no es negociable, y va antes de cualquier `--apply`:**

```
1. ¿hay un #32770 abierto?            -> abortar, pedir el click real
2. ¿el CSV tiene valor_nuevo con PUNTO? -> si tiene coma, abortar
3. ¿alguna linea cae en fila >= 6?    -> sacarla del lote, va a mano
4. export fresco guardado en .arb-cache/pre-cambio/
5. recien ahi --apply
6. re-exportar y diffear el archivo ENTERO contra la foto previa
```

Los seis son mecánicos y baratos. **Ninguno depende de acordarse: se corren siempre.**

## Seguridad — antes de que el robot escriba

1. ⚠️ **NO HAY BACKUP DE DATOS DEL ARB.** `Z:\arb\prod\BAK` tiene sólo archivos `.DTF`
   (definiciones de tabla, 1996-2019) — **no datos**; los datos viven en el servidor
   Pervasive, fuera de alcance por red. La versión vieja de esta skill lo daba por backup.
   **El único respaldo es el export**: guarda el valor anterior de cada celda, así que un
   consumo mal cargado se deshace tipeando el viejo. Alcanza para consumos porque son
   reversibles; **no alcanzaría para altas ni bajas de líneas** — por eso están fuera de
   alcance (decisión de Fak 05/08). Antes de una tanda: exportar y guardar ese export.
2. **Probar con UNA sola fila**, la de menor impacto, y **verificar contra el export**
   (`RELACIONES.TXT`, celda por celda, tolerancia 0,1%) antes de seguir con el resto.
3. **Nunca tantear teclas en la solapa de Altas.** Una tecla de más da de alta un insumo o
   pisa un renglón, y eso aparece semanas después en el stock. Si no se sabe qué hace una
   tecla, se pregunta — no se prueba.
4. Al terminar un lote: exportar `RELACIONES` de nuevo y control completo contra la tabla.

## Exports que genera el programa

A `C:\tmp\` (default del arb, latin-1): `ARTICULO.TXT` · `INSUMOS.TXT` · `RELACIONES.TXT` ·
`CONSUMOS.TXT` · `STOCK.TXT` · `KARDEX.TXT` · `PENDIENTES.TXT` · `COSTOS.TXT` y varios más.
Cómo parsearlos sin perder datos: memoria `reference_arb_export_estructura` y
`.arb-cache/README.md` (el árbol corre +7 columnas por nivel; hay filas partidas).

## Relacionado

`carga-arb` (el ciclo del cambio de BOM) · `verificacion-consumos` (validar los números) ·
memorias `reference_arb_erp_btrieve`, `reference_arb_insumos_maestro`,
`reference_arb_local_cache`, `reference_arb_export_estructura`.
