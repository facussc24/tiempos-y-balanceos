# Como leer archivos PDF en este proyecto

Referencia rapida para Claude Code. Reescrita el 22/09/2026: la version de abril recomendaba
`pdftotext -layout` como metodo preferido y `pdftoppm` para rasterizar, y las dos cosas fallaban.

## Primero: lo que NO anda en esta PC

- **La tool Read con `pages` sobre un PDF falla**: necesita `pdftoppm` (Poppler), que no esta
  instalado (en `/mingw64/bin` solo esta `pdftotext`). Paso en 25 sesiones distintas del ultimo
  mes. Usar el Metodo 1 en su lugar.
- **`pdftotext -layout` puede correr las filas de una tabla**: cada valor queda al lado de la
  etiqueta de arriba y la salida se lee perfecta (memoria `reference_pdftotext_layout_corre_las_filas`,
  dos casos el 13/09/2026). Nunca es la fuente final de un numero sacado de una tabla.

## Metodo 1 — Mirar la pagina (el juez final, y el unico para escaneados)

```bash
python scripts/_pdfPaginas.py "<archivo.pdf>" 3-5          # imprime la ruta de un PNG por pagina
python scripts/_pdfPaginas.py "<archivo.pdf>" 1,7 --dpi 200 # mas resolucion para letra chica
```

Despues, Read sobre cada PNG. El script avisa si la pagina **no tiene capa de texto**
(escaneada: manuales AIAG-VDA, normas, planos): esas solo se leen mirandolas. Los PNG van al
TEMP del sistema, nunca al lado del PDF. Receta de fondo: memoria `reference_leer_pdfs_escaneados`.

## Metodo 2 — Texto corrido (PyMuPDF o pypdf)

```python
import fitz                      # PyMuPDF, instalado
doc = fitz.open("archivo.pdf")
print(doc[0].get_text("text"))   # pagina 1
```

Para texto con capa (instructivos, mails impresos, fichas). Si da vacio o casi vacio, es
escaneado: Metodo 1.

## Metodo 3 — Tablas (pdfplumber)

```python
import pdfplumber
with pdfplumber.open("archivo.pdf") as pdf:
    for table in pdf.pages[0].extract_tables():
        for row in table:
            print(row)
```

Para tablas con capa de texto (CPs, AMFEs tabulares, fichas tecnicas). **Un numero de una tabla
se confirma mirando la pagina (Metodo 1)** o contra un valor que ya se conozca por otra fuente.

## Regla: NO probar los metodos en fila

1. Escaneado, diagrama, plano, o un numero de tabla que va a un entregable → Metodo 1.
2. Texto corrido con capa → Metodo 2.
3. Tabla con capa → Metodo 3, y el numero que importa se mira en la pagina.
