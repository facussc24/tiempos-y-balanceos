---
name: imprimir
description: Imprimir un PDF en las impresoras de Barack desde Claude, sin pasar por la cola de Windows — "impresora para ingenieria" (A4, blanco y negro) e "impresora de arriba" (A3 color, la RICOH MP C2004, donde van los FLUJOGRAMAS). Cargarlo cuando piden imprimir algo ("imprimilo", "mandalo a la impresora", "imprimí los flujogramas", "sacalo en A3", "en la de arriba"), y para saber si una impresión salió de verdad (contador de hojas).
---

# Imprimir

Dos impresoras, con el nombre que les puso Fak el 07/10/2026 (así figuran también en Windows):

| Nombre | Qué es | Dirección | Para qué |
|---|---|---|---|
| **impresora para ingenieria** | Ricoh SP 3710SF, blanco y negro, A4 | `192.168.1.105` | Todo lo que no es A3: BOMs, hojas de proceso A4, listados |
| **impresora de arriba** | Ricoh MP C2004, color, A4 y A3 | `192.168.1.104` | **Los flujogramas** (A3) y lo que va en A3 o en color |

Hay otra SP 3710SF idéntica en RRHH (`192.168.1.193`): no es la de Ingeniería. La dirección
`192.168.1.70` contesta como "MP C2004" pero es otra entrada de la **misma** impresora de arriba
(07/10/2026: una hoja a cada dirección y salieron las dos arriba).

## Cómo se imprime

```bash
python scripts/_imprimir.py <archivo.pdf>                 # A4 en la impresora para ingenieria
python scripts/_imprimir.py <archivo.pdf> --a3            # A3 color en la impresora de arriba
python scripts/_imprimir.py <archivo.pdf> --paginas 3-5   # solo esas hojas
python scripts/_imprimir.py <archivo.pdf> --a3 --seco     # no manda nada: vista previa de la 1.a hoja
```

Qué hace: Ghostscript (viene con PDFCreator, `C:\Program Files\PDFCreator\Ghostscript\Bin\gswin32c.exe`)
convierte el PDF al lenguaje de la impresora (PCL XL), **ajusta cada hoja al papel y la gira si
hace falta**, y manda los bytes directo a la impresora (puerto 9100). No usa la cola de Windows:
la impresora de arriba está instalada con un driver que traba la cola.

Si el script no está (otra PC), el mismo camino a mano:

```bash
gswin32c.exe -q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=pxlcolor -sPAPERSIZE=a3 -dFIXEDMEDIA -dPDFFitPage -r300 -sOutputFile=trabajo.pxl archivo.pdf
# y mandar trabajo.pxl a 192.168.1.104 puerto 9100 (en Python: socket.create_connection((ip, 9100)).sendall(datos))
```

Para la A4 en blanco y negro: `-sDEVICE=pxlmono -sPAPERSIZE=a4 -r600` y la dirección `192.168.1.105`.

## Antes de imprimir

- **Se imprime la última versión emitida**, no un borrador: el documento sale del servidor
  (`Y:`) o del lugar donde está emitido, nunca de una copia de trabajo, salvo que la persona diga
  que es esa.
- Muchas hojas (más de 20) o A3 en color: decir cuántas hojas van a salir antes de mandarlas.
- Un flujograma es un dibujo grande: en A3 la letra queda chica (unos 4 pt) pero se lee de cerca.

## Después de imprimir: se mira el contador

Que el trabajo salga de la PC no dice que la impresora lo imprimió. El script lee el **contador de
hojas** de la impresora antes y después (por la red, SNMP) y dice cuántas salieron. El contador
tarda unos segundos en moverse. Si no se puede leer, se pide mirar la bandeja.

```bash
python scripts/_impresoraEstado.py 192.168.1.104     # contador, texto del panel, errores
```

## Lo que no se hace

- No se cambia la impresora predeterminada ni los drivers de Windows. Renombrar o crear un puerto
  pide permiso de administrador: lo aprueba la persona en el cartel de Windows.
- No se imprime en la de RRHH.
