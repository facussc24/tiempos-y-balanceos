# -*- coding: utf-8 -*-
"""
_pdfPorPieza.py — arma UN PDF por pieza con las hojas de proceso de puertas Patagonia que ya estan,
ordenadas por operacion y sin portada.

Pedido de Fak, 02/10/2026: "deberian estar unidas las de Top Roll en una hoja sola... sin la hoja
esa primera que haces de intro... la idea es que sea un PDF por pieza, y organizadas".

    py -3 scripts/novax/_pdfPorPieza.py            # arma los PDF en exports/hojas-para-nicolas-02-10/

Antes hay que generar las hojas hot melt sin portada:
    py -3 scripts/hotmelt/generar_hojas_v3.py --sin-portada --out exports/hojas-para-nicolas-02-10/_partes

No escribe en el servidor ni manda nada. Al final lista, por PDF, cada hoja en el orden en que quedo
(numero de operacion y denominacion leidos de la pagina) y frena si alguna parte falta o no es A3.
"""
import os
import re
import sys

import fitz

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SALIDA = os.path.join(REPO, "exports", "hojas-para-nicolas-02-10")
PARTES = os.path.join(SALIDA, "_partes")                                   # hot melt sin portada
GRAMPAS = os.path.join(REPO, "exports", "hojas-grampas-patagonia-01-10")   # las hojas de P. Gamboa

# pieza -> partes en el ORDEN del flujograma (operacion 20, 50, soldadura, y al final los caminos)
PIEZAS = {
    "HO 992 - TOP ROLL PATAGONIA - HOJAS DE PROCESO.pdf": [
        (PARTES, "HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL.pdf"),
        (GRAMPAS, "HO-992 - OP 50 TAPIZADO Y ENGRAMPADO DE PANEL - TOP ROLL TRASERO.pdf"),
        (GRAMPAS, "HO-992 - SOLDADURA POR ULTRASONIDO DE SOPORTE - TOP ROLL TRASERO (sin N de operacion).pdf"),
        (GRAMPAS, "CAMINO DE INSPECCION DE GRAMPAS - TOP ROLL DELANTERO - 27.pdf"),
        (GRAMPAS, "CAMINO DE INSPECCION DE GRAMPAS - TOP ROLL TRASERO - 34.pdf"),
    ],
    "HO 971 - APB DE PUERTA PATAGONIA - ENGRAMPADO.pdf": [
        (GRAMPAS, "HO-971 - OP 83 ENGRAMPADO - APB DE PUERTA DELANTERO.pdf"),
        (GRAMPAS, "HO-971 - OP 83 ENGRAMPADO - APB DE PUERTA TRASERO.pdf"),
        (GRAMPAS, "CAMINO DE INSPECCION DE GRAMPAS - APB DE PUERTA DELANTERO - 27.pdf"),
        (GRAMPAS, "CAMINO DE INSPECCION DE GRAMPAS - APB DE PUERTA TRASERO - 21.pdf"),
    ],
    "HO 993 - LAMINADORA HOT MELT - HOJA DE MAQUINA.pdf": [
        (PARTES, "HO-993 - LAMINADORA HOT MELT - HOJA DE MAQUINA.pdf"),
    ],
}


def que_es(pagina):
    """Lo que identifica a la hoja: N° de operacion y denominacion del cajetin, o su primer renglon."""
    texto = [t.strip() for t in pagina.get_text().splitlines() if t.strip()]
    for i, t in enumerate(texto):
        if t.upper().startswith("DENOMINACI") and i + 2 < len(texto):
            return " · ".join(x for x in texto[i - 1:i + 6] if not re.match(r"(?i)^(n°|denominaci|modelo|realiz)", x))[:110]
    return " ".join(texto[:2])[:110]


faltan = [os.path.join(c, n) for partes in PIEZAS.values() for c, n in partes if not os.path.isfile(os.path.join(c, n))]
if faltan:
    print("FALTAN PARTES (no se arma nada):")
    for f in faltan:
        print("  -", f)
    sys.exit(1)

os.makedirs(SALIDA, exist_ok=True)
for nombre, partes in PIEZAS.items():
    doc = fitz.open()
    for carpeta, archivo in partes:
        parte = fitz.open(os.path.join(carpeta, archivo))
        for p in parte:
            ancho, alto = p.rect.width / 72 * 2.54, p.rect.height / 72 * 2.54
            if abs(ancho - 42.0) > 0.3 or abs(alto - 29.7) > 0.3:
                print(f"NO ES A3 APAISADA ({ancho:.1f} x {alto:.1f} cm): {archivo}")
                sys.exit(1)
        doc.insert_pdf(parte)
    destino = os.path.join(SALIDA, nombre)
    doc.save(destino, garbage=3, deflate=True)
    print(f"\n{nombre}  —  {len(doc)} hojas, {os.path.getsize(destino) / 1e6:.1f} MB")
    for i, p in enumerate(doc, 1):
        print(f"  {i:2d}. {que_es(p)}")
print(f"\nListo en {SALIDA}")
