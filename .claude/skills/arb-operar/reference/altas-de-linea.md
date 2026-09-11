# Dar de alta una linea en la BOM

La secuencia de teclas, el lote, y por que el scroll de la grilla no saca ninguna linea del
trabajo. El alta **no se deshace con el export**: va de a una, con foto antes del ENTER y
verificada contra el export. Gates y seguridad: `../SKILL.md`.

### 📋 DAR DE ALTA UNA LÍNEA — la secuencia `dictada por Fak 2026-08-07 · 31/31 el mismo día`

Fak la explicó así (textual, resumida): *"cuando llegás a la última línea cargada le das TAB
nuevamente y ahí primero se va a la última línea en blanco, que debés colocar rubro `1` y luego
TAB y cargás el código del insumo, luego TAB — automáticamente saltea la descripción y se va al
consumo directamente —, lo cargás y luego cargás los rubros, siempre con TAB. Y finalmente le
das TAB y aceptar"*.

```
tabular hasta la ULTIMA fila cargada, y un TAB mas  -> cae en la fila en blanco
rubro   = 1                        TAB
codigo del insumo                  TAB     <- saltea Descripcion y U.M.
consumo                            TAB
modulo                             TAB
proceso                            TAB
                                   ENTER sobre &Acepta
```

Lo hace `scripts/_arbAlta.py` (una línea por invocación) con sus gates: verifica cada celda
contra lo esperado antes de escribir la siguiente, saca una **foto** y lee las 5 celdas del
renglón nuevo antes del ENTER, y sin `--apply` no aprieta ENTER (el renglón queda escrito en
pantalla y se descarta con CANCELA).

**El alta NO es reversible con el export** (a diferencia de un consumo, que se deshace tipeando el
valor viejo). Por eso se prueba con UNA sola línea y se verifica contra el export antes de seguir
con el resto.

### 🟢 ALTAS EN LOTE — `_arbAltaLote.py` `CONFIRMADO 2026-08-28`

```bash
python scripts/_arbAltaLote.py --tabla .arb-cache/<tabla>.csv --apply [--reset-primero]
```

CSV con encabezado `producto,insumo,cantidad,modulo,proceso`, una fila por producto terminado.
Envuelve a `_arbAlta.py` (que hace UNA línea por invocación) y agrega lo que había que repetir
a mano: abre la ventana si no está, **resetea después de cada fallo** (una celda sucia
envenena la alta siguiente), sigue con el resto del lote y lista lo que quedó pendiente.
Sin `--apply` es dry-run — y ahí el reset es obligatorio igual, porque el renglón queda
escrito en pantalla.

**Estrenado el 28/08**: mismo insumo en 12 BOM de headrest, 12/12 en 116 seg.

### 🔴 DOS COSAS QUE FRENABAN EL ARRANQUE, LAS DOS DE NUESTRO LADO `2026-08-28`

1. **`abrir()` mandaba el KeyTip `Y3` y el real es `Y03`.** La skill tenía corregido el `Y03`
   desde el 25/08 pero `_arbCargar.abrir()` seguía con el viejo, así que **abortaba con
   "no encuentro la ventana — abrí el arb"** y el mensaje mandaba a buscar el problema
   afuera: el arb estaba abierto y logueado. Corregido en el código, no sólo en la prosa.
   *Arreglar la prosa no arregla el script, y arreglar el script no arregla la prosa: hay
   que tocar los dos.*
2. **Después de exportar, la ventana queda en la solapa `Listado`** y `traer()` aborta con
   "andá a Altas de Insumos de Un Producto". El export es justo lo que se hace antes de
   cargar, así que este tropiezo cae siempre. Se destraba con un click real en la solapa
   `Altas` (≈ x=120, y=68 de la ventana `rel`) — es lo mismo que ya hace
   `reset_relaciones()` en su último paso.

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
