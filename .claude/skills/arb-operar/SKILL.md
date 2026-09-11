---
name: arb-operar
description: Operar el ERP arb (ARB Sistemas "Producción") por teclado desde Claude — navegación, pantallas, y carga/modificación de consumos en Relaciones de Consumo. Usar cuando haya que cargar o corregir consumos en el arb, verificar una carga, o automatizar cualquier tarea repetitiva dentro del ERP. Complementa `carga-arb` (que arma QUÉ cargar) y `verificacion-consumos` (que valida los números); esta cubre CÓMO se opera el programa.
---

# Operar el arb desde Claude

> **Cambiar consumos: ANDA** — 14/14 el 05/08 · 16/16 el 06/08 · 36/36 el 07/08 ·
> **31/31 el 20/08** (y ahí el robot aprendió a **recuperarse solo**: cierra el modal y
> reabre la ventana sin pedirle nada a nadie — ver la tanda del 20/08).
> **Dar de alta líneas: ANDA** (`scripts/_arbAlta.py`) — **31/31 el 07/08**, verificadas contra
> el export y con 0 bajas en el diff de la base entera. Borrar líneas sigue fuera de alcance.
> **Modificar un campo del MAESTRO DE INSUMOS: ANDA** — **31/08/2026**, `Es Sub-Producto`
> de `TRO-TEL0001-V1`, diff del export entero 2 altas / 0 bajas / 0 cambios. Todo por
> teclado: se TABULA, no se clickea por coordenada (ver la seccion nueva del 31/08).
> **Y la `Descripción` tambien: 3/3 el 01/09/2026** — 27 filas partidas del export → 0, con
> 0 altas / 0 bajas / **0 consumos cambiados**. Ojo con los dos gates que la trababan:
> `&Acepta` esta deshabilitado hasta que `Posee PAPP/PSW` tenga valor, y una tecla mandada
> muy rapido **no llega y no da error** (ver la seccion del 01/09).
> **Altas EN LOTE: ANDA** (`scripts/_arbAltaLote.py`) — **12/12 el 28/08 en 116 seg**, mismo
> insumo en 12 BOM, diff de la base entera 12 altas / 0 bajas / 0 cambios.
>
> **Una limitación escrita por mí no es un hecho verificado.** Antes de anotar que algo "no se
> puede", probarlo y fecharlo: las dos veces que esta skill lo dio por imposible (el scroll de la
> grilla, las altas) costaron 13 líneas sin cargar y un "terminado" que no lo era.
>
> Sale con reintentos, y reintentar es seguro. Lo marcado `CONFIRMADO`/`medido` se probó; lo
> demás es hipótesis y **no se ejecuta sin verificar antes**.

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

## El arb no se cierra sin consultarle a Fak

Regla dura (31/08/2026). **El estado por defecto es abierto**: cerrarlo lo puedo hacer yo,
reabrirlo no. Lo que sí está permitido es `WM_CLOSE` sobre `Maestro de Insumos` / `Maestro de
Relaciones` y `_arbVer.py reset`. El incidente, la tabla de lo prohibido y lo permitido, el escape
y el hook: regla `arb-no-cerrar.md`, que carga sola al abrir este skill.

## Regla de oro

**El robot hace exactamente lo que haría Fak, tecla por tecla.** Así el arb aplica sus
validaciones igual — no se entera de que no es una persona. Nunca escribir en los archivos
de datos por fuera del programa: el daño no se ve el día que pasa, se ve semanas después en
el stock.

## Cuándo leer qué

| Si voy a... | Leer antes |
|---|---|
| dar de alta una línea o un lote en una BOM | `reference/altas-de-linea.md` |
| tocar un código del maestro (alta, descripción, un flag) | `reference/maestro-de-insumos.md` |
| una tanda falló, o apareció un cartel que no reconozco | `reference/fallas-modales-y-export.md` |
| entender por qué un gate está donde está | `reference/bitacora-tandas-2026-08.md` |

## Antes de decir "no se puede" (graduado de LECCIONES, 25/08/2026)

**En una interfaz, el límite y la causa casi siempre están de MI lado: MIRAR LA PANTALLA antes
de rediagnosticar.** Tres cosas que no viven en la crónica de las tandas
(`reference/bitacora-tandas-2026-08.md`) y que cuestan caro:

- **"Es un límite del programa" casi siempre es un límite de lo que probé.** Dos frases de esta
  misma skill decían que hacía falta una persona: las dos falsas, las dos resueltas con un click
  (tanda del 20/08). Una limitación que escribí yo se vuelve la verdad del sistema y **nadie la
  vuelve a probar**.
- **Arreglar el código no cierra el incidente si la prosa que lo describía sigue diciendo que es
  imposible.** Cuando se destrabe algo, corregir el texto de esta skill en la misma sesión.
- **Antes de decir "no puedo":** `grep "^def "` sobre los scripts del dominio y listar qué NO probé.
  Y **cuando el segundo intento falla DISTINTO al primero, la hipótesis 1 es que el primero ensució
  el estado** — cerrar y reabrir la pantalla antes de teorizar.

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

**No es `Shift`+`↑`** (probado dos veces, no hace nada). ~~ni `Alt` (el ribbon no tiene
KeyTips) ni las flechas para cambiar de solapa. La navegación del ribbon es con mouse~~ —
**las tres afirmaciones eran falsas, corregido el 25/08/2026**: el ribbon SÍ tiene KeyTips
(son ventanas `KbxLabelClass` y se leen), las flechas SÍ cambian de solapa una vez que `Alt`
lo activó, y la navegación entera se hace por teclado. Ver "Navegación 100% por teclado".

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

Cuántos TAB hasta `Cantidad` y cómo se graba están medidos abajo (`3 + 5*i` y `ENTER` sobre
`&Acepta`). Lo que no está medido no se prueba dentro de una fila con datos reales sin OK de Fak:
un tabulador de más y se pisa un renglón.

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

### 🟢🟢 LOS KEYTIPS SE LEEN, NO SE ADIVINAN `CONFIRMADO 2026-08-25`

**Los KeyTips son ventanas top-level propias, de clase `KbxLabelClass`, y su TEXTO es la
tecla.** O sea que no hay que fotografiarlos ni acordarse: se enumeran y se leen.

```bash
python scripts/_arbKeytips.py --esperar    # una persona aprieta Alt sostenido; el script los lee
```

⚠️ **No salen en la captura.** `PrintWindow` sobre la ventana principal NO los dibuja, porque
son ventanas aparte. Perdí varias fotos buscándolos ahí. Y se dibujan **de a poco**: una sola
lectura agarra 2 de 25, por eso el script poletea y acumula durante 12 s.

El Alt lo tiene que apretar **una persona**: `keybd_event` activa el ribbon (se ve la solapa
seleccionarse) pero **no dibuja los KeyTips**. Una vez leídos, la tecla sí se manda sintética.

### 🔴🔴 EL KEYTIP DEL PANEL ES DE TRES CARACTERES — `Y03`, NO `Y3`

**Ese era el error que hacía "imposible" la navegación por teclado.** Leídos en vivo el
25/08/2026, los 25 KeyTips de la ventana `Producción`:

| solapas (y=57) | | panel de botones (y=131) |
|---|---|---|
| `F` Archivo · `M1` Movimientos de Insumos · `P1` Producción · `L` Listados de Stock PT · `S` Consulta por Sector · `P2` Productos Terminados · **`V` Menú de Insumos** · `M2` Maestros · `U` Utilitarios | | **`Y01` … `Y11`** — con **cero adelante** |

Dentro de `V`: `Y01` ABM de Insumos · `Y02` Rubros · **`Y03` Relación de Consumo** ·
`Y04` Depósitos.

La secuencia que **funciona** (probada de punta a punta el 25/08, abrió `Maestro de
Relaciones - BA` sin un solo click sobre un control):

```
click en la BARRA DE TITULO     <- da foco de teclado sin tocar nada; ver abajo
Alt                             <- activa el ribbon
V                               <- solapa Menu de Insumos
Y  0  3                         <- Relacion de Consumo  (TRES teclas, no dos)
```

**El click en la barra de título es la forma segura de dar foco.** Ya estaba anotado que sólo
un click real da foco de teclado; lo que faltaba es que **no hace falta clickear un control**
para conseguirlo — la barra de título alcanza y no puede pisar ningún dato.

**Y si el ribbon ya está activado, las flechas cambian de solapa** (`→` avanza una). Sirve de
respaldo si el KeyTip falla, pero es frágil: bajar al panel con `↓` + flechas me abrió
`Selección de Empresa` en vez de `Relación de Consumo`. Con el KeyTip no hay que contar nada.

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
Alt -> V -> Y 0 3                  abrir (el KeyTip es Y03, no Y3 - ver arriba)
gate: ¿estoy en la solapa Altas?   si no hay grilla, ABORTAR — no escribir a ciegas
CLICK en Parte Superior            <- click, NO tabular (por que: reference/bitacora-tandas-2026-08.md)
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

**El scroll no saca ninguna línea del lote.** La grilla muestra 6 filas pero **scrollea sola al
tabular** (dato de Fak, 07/08: *"llegás a la última línea de la sexta y le das TAB: automáticamente
baja a la número 7"*), y `cargar_producto()` lo implementa: si la primera celda a cambiar cae fuera
de vista, se ancla en la última fila visible y sigue tabulando. Lo único que no se puede hacer con
una fila fuera de vista es **leer** su valor viejo — el control no existe todavía —, así que la
verificación por contenido pasa de ser previa a ser *al llegar*. Detalle en
`reference/altas-de-linea.md`.

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

### El orden que salió bien, de punta a punta

```
_arbVer.py estado            0 modales, ventana Relaciones abierta
cp RELACIONES.TXT -> .arb-cache/pre-cambio/
_arbVer.py export            (reintentar: el combo falla ~1 de cada 2)
generar tabla del export PRE-CAMBIO, 7 decimales, PUNTO
_arbVer.py click 118 68      volver a la solapa Altas
_arbCargar.py --solo <1 pieza> --apply    prueba
_arbVer.py export  +  verificar
_arbCargar.py --tabla ... --apply         el resto
_arbVer.py reset             si algo falló, ANTES de reintentar
_arbVer.py export  +  verificar + invariantes + diff del archivo entero
```

⚠️ **La tabla se genera del export PRE-CAMBIO, no del actual.** Si se regenera a mitad de
lote, las líneas ya convertidas se vuelven a dividir por el ancho. El `valor_esperado` sí
sale del actual: es contra lo que el cargador compara la celda antes de escribir.

#### 🔴 `&Acepta` está DESHABILITADO hasta que `Posee PAPP/PSW` tenga valor

Con ese campo vacío **el TAB se clava ahí** (probado: del TAB 17 al 26, mismo handle) y el
botón nunca recibe foco — se ve como "no llego al botón en 30 TAB". No es un problema de
teclas: es la validación del arb, y el pie de la ventana lo dice (*"Indique si el Insumo Tiene
Documentación de Calidad Aprobada S/N/X"*).

🟢 **VA SIEMPRE `S`. No se pregunta y no frena una carga** — decisión de Fak, 01/09/2026:
*"siempre va la S así cargamos rápido, luego Calidad revisa"*. Yo lo leí como dato técnico y
paré a preguntar; la casa ya tenía la respuesta y el control está aguas abajo, no en el
maestro. Ya viene por defecto en `scripts/_arbDescripcion.py`.
Memoria: [[feedback_arb_papp_siempre_s]].

#### 🔴 `FIN` va al fin del RENGLÓN, no del texto — y las teclas rápidas se PIERDEN

Dos errores del mismo intento, los dos silenciosos:

- `FIN` deja el cursor en la posición 28 de un texto de 44: es fin de **renglón**. Para vaciar
  el campo entero: **`EM_SETSEL(0, -1)` por mensaje** (sólo mueve la selección, no escribe) **+
  UN `BACKSPACE` real**. Medido: deja el campo en `''`.
- **`ai.tecla(..., pausa=0.012)` no llega**: 90 BACKSPACE a 12 ms no borraron **una sola letra**,
  y el gate lo cazó comparando el contenido. Con 0,15-0,25 s anda siempre. **Una tecla que no
  llega no da error: devuelve el campo intacto**, así que sin gate se graba lo viejo creyendo
  que se grabó lo nuevo.

#### La receta que funcionó

```
solapa Modificaciones -> click Rubro -> 1 -> TAB -> codigo -> TAB   (trae; foco en Descripcion)
GATE: el foco es RichEdit20A Y su texto == el viejo esperado, exacto   <- si no, WM_CLOSE
EM_SETSEL(0,-1) + BACKSPACE real          vaciar; verificar que quedo ''
escribir el texto nuevo (<= 40, sin saltos)
GATE: el campo dice EXACTAMENTE el texto nuevo                        <- si no, WM_CLOSE
TAB hasta `Posee PAPP/PSW`, IDENTIFICANDOLO POR POSICION (194,511)    <- 17 o 19 TAB, varia
EM_SETSEL(0,-1) + BACKSPACE + escribir el valor; verificar
TAB -> GATE: el foco es el Button 'Acepta' Y IsWindowEnabled          <- si no, WM_CLOSE
ENTER
```

**El conteo de TABs varía entre registros (17 y 19 en la misma tanda): identificar el control
por posición o handle, nunca por cuántos TAB conté.** Ante cualquier gate en rojo, `WM_CLOSE`
descarta sin grabar — verificado releyendo el registro después.

## Orden de arranque de una tanda

Las fallas de una tanda **son detectables antes de correrla**: el separador se ve con `--leer`, el
modal se detecta enumerando ventanas, y el export pre-cambio se guarda o no se guarda. Por eso
estos seis pasos van **antes de cualquier `--apply`**, siempre, sin decidir cada vez.

```
1. ¿hay un #32770 abierto?            -> abortar, pedir el click real
2. ¿el CSV tiene valor_nuevo con PUNTO? -> si tiene coma, abortar
3. ¿el export que genero la tabla es el PRE-CAMBIO? -> si se regenero a mitad, rehacerla
4. export fresco guardado en .arb-cache/pre-cambio/
5. recien ahi --apply
6. re-exportar y diffear el archivo ENTERO contra la foto previa
```

Los seis son mecánicos y baratos. **Cada tanda que falla deja su gate escrito acá**: si no, se
paga dos veces (pasó el 07/08 — escribí el gate del modal a media mañana y lancé dos tandas más
sin correrlo). La crónica de dónde salió cada uno: `reference/bitacora-tandas-2026-08.md`.

## Seguridad — antes de que el robot escriba

1. ⚠️ **NO HAY BACKUP DE DATOS DEL ARB.** `Z:\arb\prod\BAK` tiene sólo archivos `.DTF`
   (definiciones de tabla, 1996-2019) — **no datos**; los datos viven en el servidor
   Pervasive, fuera de alcance por red. La versión vieja de esta skill lo daba por backup.
   **El único respaldo es el export**: guarda el valor anterior de cada celda, así que un
   consumo mal cargado se deshace tipeando el viejo. **Un alta no se deshace así**, por eso va de
   a una, con foto antes del ENTER y verificada contra el export (`_arbAlta.py`, `_arbAltaLote.py`).
   **Borrar una línea sigue fuera de alcance.** Antes de una tanda: exportar y guardar ese export.
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
