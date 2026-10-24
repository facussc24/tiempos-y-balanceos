# -*- coding: utf-8 -*-
"""Lo que se VE en el PDF del plano del ejercicio 15 (pymupdf, .venv-cad), para que el ok no sea «CATIA no tiro error»
(revisor del 15, 24/10/2026: un DefineBreakout que no hace nada tambien da S_OK):

    python -I medir_plano.py <plano.pdf> <regiones.json>   -> ultima linea: JSON {"trazos": {vista: n}, "palabras": [...]}

regiones.json: {vista: [x0, y0, x1, y1]} en mm de la HOJA (origen abajo a la izquierda, como CATIA). Un trazo cuenta en
una vista si el centro de su caja cae adentro. «palabras»: el texto de la hoja (las cotas que se leen)."""
import json
import sys

MM = 72.0 / 25.4


def main():
    import pymupdf
    doc = pymupdf.open(sys.argv[1])
    with open(sys.argv[2], encoding="utf-8") as f:
        regiones = json.load(f)
    pag = doc[0]
    alto_mm = pag.rect.height / MM
    trazos = {k: 0 for k in regiones}
    caja = {k: None for k in regiones}                # x0, x1 en mm de lo dibujado en la vista (el ancho que se ve)
    for d in pag.get_drawings():
        r = d["rect"]
        x, y = (r.x0 + r.x1) / 2 / MM, alto_mm - (r.y0 + r.y1) / 2 / MM
        for k, (x0, y0, x1, y1) in regiones.items():
            if x0 <= x <= x1 and y0 <= y <= y1:
                trazos[k] += 1
                c = caja[k] or [r.x0 / MM, r.x1 / MM]
                caja[k] = [min(c[0], r.x0 / MM), max(c[1], r.x1 / MM)]
    ancho = {k: (round(c[1] - c[0], 2) if c else 0.0) for k, c in caja.items()}
    palabras = [w[4] for w in pag.get_text("words")]
    print(json.dumps({"trazos": trazos, "ancho_mm": ancho, "palabras": palabras,
                      "hoja_mm": [round(pag.rect.width / MM, 1), round(alto_mm, 1)]}))


if __name__ == "__main__":
    main()
