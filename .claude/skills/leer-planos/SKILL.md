---
name: leer-planos
description: >
  Como sacar datos de un plano de cliente (TIF/JPEG de 100-250 Mpx): peso calculado de
  cada componente, cantidad por conjunto, part number, material, norma y recubrimiento.
  Todo eso vive en la LISTA DE MATERIALES embebida en el plano. Usar cuando pidan el
  peso/medida/cantidad/material de una pieza o de un componente de un conjunto, o
  cuando haya que abrir cualquier plano .tif de la carpeta "6-Planos de la pieza".
---

# leer-planos — el dato esta en el plano, en la lista de materiales

Un plano de conjunto es UNA imagen de 100-250 megapixeles. No se puede mirar entero:
en pantalla es una mancha, y PIL lo rechaza por "decompression bomb". Recorrerlo a ojo
crop por crop es perder media hora y no encontrarlo.

**Lo que casi siempre se busca esta en la lista de materiales embebida en el plano**
(Stuckliste). No esta siempre en el mismo lugar — cambia de plano a plano — asi que hay
que BUSCARLA, no ir a coordenadas.

## Flujo (2 comandos)

```bash
python scripts/_leerPlano.py "<plano.tif>" --mapa      # detecta las tablas del plano
python scripts/_leerPlano.py "<plano.tif>" --tabla 1   # recorta una, legible
```

`--mapa` lista las tablas ordenadas por tamaño, con su posicion en zonas del marco.
La lista de materiales suele ser de las mas grandes y estar en la banda inferior. Si la
Nº1 no es, mirar la 2 y la 3 — son 10 segundos cada una. Despues abrir el PNG con `Read`.

Otras formas de entrar, cuando ya se sabe donde mirar:

```bash
python scripts/_leerPlano.py "<plano.tif>" --zona 19-25 --banda inferior
python scripts/_leerPlano.py "<plano.tif>" --box x0,y0,x1,y1
```

Los PNG salen a `tmp/planos/` (gitignoreado — **el repo es publico y estos son planos
del cliente**, nunca commitearlos ni copiarlos a `docs/`).

## Que trae la lista de materiales

Una fila por componente del conjunto. Las columnas varian de plano a plano (cambia el
orden y a veces el idioma), pero siempre estan estas:

| Columna (DE / EN) | Que es |
|---|---|
| `Pos./Item` | numero de globo en el despiece |
| `Feld/Field` | **zona del marco donde esta dibujada** esa pieza (ej. `J48` = fila J, zona 48) |
| `Teil-Nr./Part-No.` | part number del cliente |
| `Benennung/Title` | denominacion (aleman/ingles) |
| `Werkstoff/Material` | material, o la designacion corta si es normalizado |
| `Norm/Standard` | norma del componente |
| `Oberflachenschutz` | recubrimiento (define la VARIANTE en piezas normalizadas) |
| `Stck./Qty.` | **cuantas van por conjunto** |
| `Gewicht errechnet/calculated` | **peso calculado, en gramos** |
| `Dichte/Density` | densidad, cuando aplica |

`Feld/Field` es el atajo para encontrar la pieza dibujada: si dice `J48`, ir con
`--zona 48`. Evita recorrer el plano buscando el globo.

## Mapa del plano (orientativo)

- **Extremo derecho:** cajetin (part number del conjunto, denominacion, escala, peso del
  conjunto, responsable) + registro de cambios + despiece 3D con los globos.
- **Banda inferior, centro-izquierda:** lista de materiales, y arriba de ella la tabla de
  RPS con sus coordenadas.
- **Izquierda:** notas generales (ensayos, normas de superficie, tolerancias, marcado).
- **Borde:** los numeros de zona (1..N) y las letras de fila — el sistema de coordenadas
  al que apunta `Feld/Field`.

## Piezas normalizadas (tornillos, clips, grampas)

El plano del componente que viene aparte suele ser un **dibujo simplificado** (VDA 4953):
trae las cotas pero abajo aclara *"Gilt nur mit fuehrender Stammdatenliste"* — solo vale
junto con la lista de datos maestros. Ahi esta la designacion corta (ej. `TP5.0x22.0-Q` =
Ø5,0 x 22 mm), el material y el recubrimiento. **El sufijo del numero de norma suele ser
la variante de recubrimiento, no otra medida** — dos variantes pueden ser el mismo
tornillo con distinto acabado. Confirmar cual va, en la lista de materiales del plano.

## Que NO esta en el plano

El **torque de apriete** no figura ni en el plano del conjunto ni en el del tornillo:
buscarlo en la instruccion de proceso o en la hoja de operaciones.

## Contraste obligatorio

Si el dato se va a usar para cargar o entregar algo, contrastarlo con la BOM interna
(carpeta `7-Lista de materiales preliminares`, revision de numero MAYOR). Si el plano y
la BOM no coinciden, **reportar la diferencia** — no elegir uno por cuenta propia.
