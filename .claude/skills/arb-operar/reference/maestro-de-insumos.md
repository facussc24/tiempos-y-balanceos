# ABM de Insumos — el maestro de codigos

Dar de alta un codigo, modificar un campo o la descripcion, y verificar sin tocar nada. Es otra
ventana que la de Relaciones de Consumo (la de las BOM), con sus propias trampas. El flujo de
consumos esta en `../SKILL.md`.

## ABM de Insumos — dar de alta un CÓDIGO en el maestro `APRENDIDO 2026-08-28`

Hasta hoy esto lo hacía Fak a mano. Se grabó una sesión suya completa con
`scripts/_arbAprender.py` (teclas + foco + fotos) y quedó todo medido. Fak, ese día:
*"hoy es la última vez que lo hago yo"*. Herramienta: **`scripts/_arbInsumo.py`**.

### Cómo se llega

```
ventana Producción  ->  ribbon solapa `Menú de Insumos`  (click en ~869,47)
                    ->  botón `ABM de Insumos`           (click en ~36,84)
```
Abre la ventana **`Maestro de Insumos - BA`**, clase `TabCtrl`, 810x730.
Por teclado el KeyTip es `V` (Menú de Insumos) y después `Y01` (ABM de Insumos) —
ojo con el **cero adelante**, es `Y01`, no `Y1`.

Ocho solapas, todas a **y=67**:

| solapa | x | para qué |
|---|---|---|
| `Altas` | 52 | **crear** un código nuevo |
| `Bajas` | 96 | |
| `Modificaciones` | 160 | **corregir** uno existente — y **leerlo sin tocarlo** |
| `Recupera` | 231 | |
| `Precios` | 287 | |
| `Listado` | 331 | exportar el maestro |
| `Control de Calidad` | 403 | |
| `Escape` | 477 | |

### Mapa de campos (Altas y Modificaciones son la misma pantalla)

Coordenadas del **centro de la caja**, relativas a la ventana:

| campo | x,y | qué va |
|---|---|---|
| `Rubro` | 215,152 | `1` = materia prima |
| **`Medida`** | 355,152 | **es el CÓDIGO del insumo** (mismo nombre engañoso que en Relaciones) |
| `Descripción` | 370,181 | caja de 2 renglones — **tope 60 caracteres** |
| `C. Costo Ingreso` · `Imputación Ingreso` | 215,266 · 477,266 | se dejan vacíos |
| `C. Costo Descarga` · `Imputación Descarga` | 215,295 · 477,295 | se dejan vacíos |
| **`Unidad`** | 217,323 | `MTS`, `MT2`, `KG`, `UN`… |
| `Doble Medida S/N` | 466,323 | `N` |
| `Stock Mínimo` · `Lote Óptimo de Compra` | 245,352 · 507,352 | vacíos |
| `Unidad Mínima de Compra` · `Tiempo de Entrega` | 245,380 · 471,380 | vacíos |
| `Proveedor` · `Código Original` (x2) | 215/514, 409 y 437 | vacíos |
| `Es Sub-Producto S/N` · `Etiquetas` | 204,466 · 477,466 | `N` |
| `Tiene Vencimiento S/N` | 204,494 | `N` |
| `Tipo de Descarga O/G/I` | 466,494 | `I` |
| `Origen Descarga M/L` | 650,494 | `M` |
| **`Posee PAPP/PSW S/N`** | 204,523 | `S` — **es el flag de PPAP** |
| `&Acepta` · `&Cancela` | 411,580 · 512,580 | |

El pie de la ventana **dice qué espera el campo donde estás parado** (ej. *"Indique si el
Insumo Tiene Documentación de Calidad Aprobada S/N/X"*). Es la ayuda en vivo: leerla en la
foto antes de tipear algo dudoso.

### La secuencia del alta (medida sobre Fak, 27 segundos)

```
click en `Altas`
click en Rubro   -> 1 -> TAB
click en Medida  -> <código> -> TAB
click en Descripción -> <descripción> -> TAB
TAB TAB          (saltea los centros de costo/imputación)
Unidad -> MTS -> TAB
... TAB hasta los flags ...
Tipo de Descarga -> I -> TAB
Origen Descarga  -> M -> TAB
Posee PAPP/PSW   -> S -> TAB   <- el TAB desde acá cae en el botón &Acepta
ENTER            (sobre &Acepta)
```
Después del alta la pantalla **se limpia sola y queda lista para el siguiente código**. Los
campos que se dejan en blanco quedan en blanco: el arb no los exige.

### 🔴 Tres cosas que rompen el método de siempre

1. **Los campos son `RichEdit20A` y NO devuelven texto por `WM_GETTEXT`.** `txt(hwnd)` da
   `''` siempre. Todo el control de "leo la celda antes de escribir" que sí funciona en
   Relaciones (`Edit` común) **acá no sirve**. La única forma de saber qué dice un campo es
   **`PrintWindow` y mirar la foto**. Ningún alta se da por buena sin foto.
2. **El campo `Descripción` scrollea.** Con el cursor al final muestra el FINAL del texto y
   se come las primeras letras: `PUNZONADO…` se ve `UNZONADO…`. **Eso no es un error de
   carga**, es el render. Para leer la descripción real: solapa `Modificaciones`, traer el
   código, y ahí se ve desde el principio.
3. **El arb puede tirar `Microsoft Visual C++ Runtime Library` justo al apretar `&Acepta`**
   (cartel `#32770`, botones `&Anular` / `&Reintentar` / `Om&itir`). Pasó en el alta del
   28/08 y **el registro se grabó igual y correcto** — verificado después contra el maestro.
   Aun así: la salida documentada es **`Anular` y reabrir el programa**, nunca `Omitir`
   (sigue con la memoria corrupta). Si se apretó `Omitir`: **verificar el registro y cerrar
   y reabrir el arb antes de escribir nada más.**

### Verificar un alta sin tocar nada — solapa `Modificaciones`

```bash
python scripts/_arbInsumo.py solapa modificaciones
python scripts/_arbInsumo.py click rubro
python scripts/_arbInsumo.py escribir 1
python scripts/_arbInsumo.py teclas TAB
python scripts/_arbInsumo.py escribir <CODIGO>
python scripts/_arbInsumo.py teclas TAB      # trae el registro
# mirar la foto
python scripts/_arbInsumo.py click cancela   # salir SIN grabar
```
~~**Se sale con `&Cancela`, no con `ESC`**~~ — **FALSO, corregido 31/08/2026 por Fak**:
*"se sale con ESC y te movés con TAB, ¿ya te olvidaste de todo?"*. Medido el mismo día:
**`&Cancela` está DESHABILITADO** mientras no hay edición pendiente, así que clickearlo no
hace nada. La salida real es **`ESC` → modal `Desea Finalizar ??` → `&Sí`**.

### 🟢🟢 MODIFICAR UN CAMPO DEL MAESTRO — todo por TECLADO `CONFIRMADO 2026-08-31`

Primera modificación real grabada por robot: `TRO-TEL0001-V1`, campo `Es Sub-Producto` de
`N` a `S`. Export antes/después: **2 altas, 0 bajas, 0 cambios** — nada fuera de lo pedido.

**Dentro del formulario NO se clickea por coordenada: se TABULA.** Ese fue el error del día:
click en `(204, 466)` para pararme en `Es Sub-Producto`, el foco **no se movió** (siguió en
`Descripción`), y el `BACKSPACE` que le mandé después fue a parar a la descripción del insumo.
El click no falló ruidosamente: falló *en silencio*, que es peor.

**El tab order, medido control por control** (los `RichEdit20A` en el orden del
`EnumChildWindows`, que es el mismo del TAB):

| # | campo | pos (x,y) |
|---|---|---|
| 1-3 | Rubro · Medida · **Descripción** | (194,140) · (297,140) · (194,169) |
| 4-7 | C. Costo Ingreso · Imputación Ingreso · C. Costo Descarga · Imputación Descarga | (194,254) · (459,254) · (194,283) · (459,283) |
| 8-9 | Unidad · Doble Medida | (194,311) · (459,311) |
| 10-13 | Stock Mínimo · Lote Óptimo · Unidad Mín. Compra · Tiempo Entrega | (194,340) · (459,340) · (194,368) · (459,368) |
| 14-17 | Proveedor · Cód. Original · Proveedor · Cód. Original | (194,397) · (459,397) · (194,425) · (459,425) |
| 18 | **Es Sub-Producto** | (194,454) |
| 19-23 | Etiquetas · Tiene Vencimiento · Tipo Descarga · Origen Descarga · Posee PAPP/PSW | (459,454) · (194,482) · (459,482) · (640,482) · (194,511) |
| — | **`&Acepta`** (Button) | (385,568) |

Después del TAB que trae el registro **el foco queda en `Descripción` (#3)**. Desde ahí:

```
14 TAB  -> Es Sub-Producto        (verificar el handle ANTES de tocar nada)
FIN, BACKSPACE, <valor>           reemplaza el contenido de un campo de 1 caracter
 6 TAB  -> boton &Acepta
ENTER                             graba; la pantalla se limpia sola
```

### 🟢🟢 MODIFICAR LA `Descripción` DEL MAESTRO — ANDA `CONFIRMADO 3/3 el 2026-09-01`

Los 3 hilos que Producción reportó como "ERROR BOM". Export antes/después de la base entera:
**0 altas, 0 bajas, 0 consumos cambiados**, 27 descripciones nuevas y **27 filas partidas → 0**.

**El campo son DOS RENGLONES DE 40 caracteres.** Medido sobre `INSUMOS.TXT`: 470 descripciones
llegan justo a 40, **ninguna pasa de 40**. Cuando el nombre no entra, se usa el segundo renglón
— **144 insumos del maestro están así**, es la convención, no un error. El que no sabe manejar
el segundo renglón es el **reporte de RELACIONES** (lo escupe en la columna A y corre
unidad/consumo/módulo/proceso 3 columnas a la izquierda).

⚠️ **El export TRUNCA el segundo renglón: no lo uses para saber qué dice.** Del export salía
`GR`; el texto real era `GRAY VIOLET - TGA AT2`. Reescribir con lo que muestra el export
**borraba 19 caracteres reales**. La descripción de verdad se lee con `WM_GETTEXT` sobre el
RichEdit **con foco**, en `Modificaciones`.

Y por eso el arreglo **no es "sacar el salto"**: el texto no entra en 40. Hay que acortarlo, y
**poniendo primero lo distintivo** — RELACIONES corta a 40 y dos hilos que comparten los
primeros 36 caracteres quedan indistinguibles ([[reference_arb_insumos_maestro]]).

### 🟢🟢 LOS `RichEdit20A` SÍ DEVUELVEN TEXTO — cuando tienen el FOCO `CORRIGE lo de arriba`

La sección del 28/08 dice *"los campos son `RichEdit20A` y NO devuelven texto por
`WM_GETTEXT`… la única forma de saber qué dice un campo es `PrintWindow` y mirar la foto"*.
**Es verdad a medias.** Sin foco devuelven `''`; **con el foco puesto, `WM_GETTEXT` devuelve
el contenido** — leídos en vivo el 31/08 mientras tabulaba: `'N'`, `'I'`, `'M'`, `'S'`.

Eso habilita el gate barato que faltaba: **tabular y leer el valor de cada campo al pasar**,
igual que hace `recorrer()` en la grilla de Relaciones, sin gastar una foto por paso. La foto
queda para el control final, no para navegar.

### El gate de handle, que es lo que hace segura la escritura

```python
TARGET = [h for h,x,y in ctrls if abs(x-194)<6 and abs(y-454)<6][0]   # el campo buscado
...
if GetGUIThreadInfo(tid).hwndFocus != TARGET:
    raise SystemExit("ABORTO: el foco no esta donde creo")
```
Comparar **handles**, no coordenadas ni "cuántos TAB conté". Si el foco no es el control
esperado, se aborta **antes** de la primera tecla que modifica.

### Si algo salió mal: `WM_CLOSE` descarta la edición `CONFIRMADO 2026-08-31`

Con la descripción ya pisada en pantalla y `&Cancela` deshabilitado, **`WM_CLOSE` sobre
`Maestro de Insumos` cerró sin grabar**: al reabrir y traer el mismo código, la descripción
estaba intacta. Mismo comportamiento que ya estaba documentado para `Maestro de Relaciones`.

⚠ **El campo `Descripción` engaña al mirarlo.** Después del BACKSPACE mostraba `RO` y parecía
que había borrado casi todo; era el render con el cursor al final (la propia skill ya lo
avisa). **No diagnosticar un campo por lo que muestra: cerrar, reabrir y releer.**

### Abrir `ABM de Insumos` — el árbol de la izquierda NO abre con ENTER

Probado el 31/08: click en `ABM de Insumos` del árbol de `Producción` **sólo lo selecciona**
(queda resaltado en azul) y `ENTER` no lo abre. Lo que sí abre es el **botón del ribbon**:

```
click (849, 43)   solapa `Menú de Insumos`
click ( 37, 95)   botón `ABM de Insumos`
```
(o la vía por teclado ya documentada: `Alt` → `V` → `Y01`).

### Exportar el maestro — solapa `Listado`

`Desde Insumo` / `Hasta Insumo` (vacíos = todos) y el combo **`Salida`**, que tiene 8
opciones **owner-drawn**: `CB_GETLBTEXT` devuelve vacío, **pero `CB_GETCURSEL` (0x0147) y
`CB_SETCURSEL` (0x014E) sí funcionan cross-process**. Por eso el índice se fija por mensaje
y se verifica, en vez de contar flechas a ciegas:

| idx | opción | archivo que deja en `C:\tmp` |
|---|---|---|
| 0 | Pantalla | — |
| **1** | **Impresora** | ⚠️ **manda el listado entero a la impresora de la oficina** |
| 2 | Disco C | `INSUMOS.TXT` en **formato reporte** (con recuadros, `Hoja 1`, descripción cortada a 40) |
| **3** | **Tabla EXcel** | `INSUMOS.TXT` **tab-separated** — es el que parsean los scripts |
| 4 | Formato PDF | `INSUMOS.PDF` |
| 5 | HTML | `INSUMOS.HTM` |
| 6 | Word/RTF | |
| 7 | Electronico | |

⚠️ **`Disco C` y `Tabla EXcel` escriben el MISMO archivo `INSUMOS.TXT` con formatos
distintos.** Exportar con `Disco C` te pisa el tab-separated. Antes de exportar, copiar el
que haya a `.arb-cache/`.

**Gate obligatorio:** leer `CB_GETCURSEL` y abortar si no es el índice buscado. El 28/08 ese
gate frenó una corrida donde el combo había quedado en 2 en vez de 3. Un índice de más cae
en `Impresora`.
