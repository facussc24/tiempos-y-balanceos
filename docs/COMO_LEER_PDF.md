# Como leer archivos PDF en este proyecto

Referencia rapida para Claude Code al trabajar con PDFs de referencia.

## Metodo 1 — pdftotext (preserva layout, PREFERIDO)

```bash
pdftotext -layout archivo.pdf output.txt
cat output.txt
```

Mejor para: documentos con texto plano, tablas simples, AMFEs impresos.

## Metodo 2 — pypdf (texto simple)

```python
from pypdf import PdfReader
reader = PdfReader("archivo.pdf")
for page in reader.pages:
    print(page.extract_text())
```

Mejor para: PDFs con texto embebido sin layout complejo.

## Metodo 3 — pdfplumber (tablas)

```python
import pdfplumber
with pdfplumber.open("archivo.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

Mejor para: PDFs con tablas estructuradas (CPs, AMFEs tabulares).

## Metodo 4 — Rasterizar pagina como imagen

```bash
pdftoppm -jpeg -r 150 -f 1 -l 1 archivo.pdf /tmp/pagina
```

Mejor para: diagramas visuales (PFDs), PDFs escaneados, layout complejo.

## Regla: NO perder tiempo probando metodos

1. Si es texto/tabla simple → pdftotext primero
2. Si pdftotext sale vacio → pypdf
3. Si necesitas tablas estructuradas → pdfplumber
4. Si es diagrama visual o escaneado → rasterizar

NO probar los 4 metodos secuencialmente. Elegir el correcto segun el tipo de PDF.

## Ubicaciones conocidas de PDFs

| Tipo | Ruta |
|------|------|
| Archivos de referencia (AMFEs, CPs, HOs) | `C:\Users\FacundoS-PC\Documents\AMFES PC HO` |
| Archivos nuevos (marzo 2026) | `C:\Users\FacundoS-PC\Documents\26.3.26` |
| BOM Telas PWA | `\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\PWA\1- TOYOTA_TELAS_ PLANAS_581D\APQP\7-Lista de materiales` |
