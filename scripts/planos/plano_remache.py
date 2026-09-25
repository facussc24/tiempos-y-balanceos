#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Plano generico de un remache POP (cuerpo + mandril) en DXF y PDF, con las cotas que se le pasan.

Nace del pedido de Paulo (WhatsApp, 25/09/2026): plano del "REMACHE DE ALUMDW4.0X7.4" con
d1=2,26 · dk=8 · L=8 · d=4 · L1=30 (datos de Fak). El plano del fabricante que ya existe
(Stanley ES-1997, serie 5, en el PPAP de 1-427VAR001MON01) es de la serie entera con tabla;
este es el de UNA pieza, con sus medidas.

Convencion de cotas (la de la hoja que mando Fak):
    d   diametro del cuerpo          L   largo del cuerpo, bajo cabeza hasta la punta
    dk  diametro de la cabeza        L1  mandril, desde la cara de arriba de la cabeza a la punta
    d1  diametro del mandril

Solo se acota lo que viene como dato. La altura de la cabeza, la punta del mandril y la cabeza
del mandril se DIBUJAN (hace falta una forma) pero no se acotan: no hay dato, y el plano va
S/E para que nadie las mida del dibujo.

La geometria va a escala 1:1 en el espacio modelo (mm); el marco y el rotulo estan dibujados
a 1/ESC para que el PDF salga en A4 apaisada a escala ESC:1.

Uso:
    .venv-cad/Scripts/python.exe scripts/planos/plano_remache.py --out <carpeta> [--nombre <base>]
        [--d 4 --dk 8 --L 8 --d1 2.26 --L1 30]
        [--denominacion "..."] [--codigo "..."] [--ean "..."] [--material "..."]
El DXF sale normalizado (extents) por scripts/_validarDxf.py. Para dejarlo en su carpeta:
    .venv-cad/Scripts/python.exe scripts/_validarDxf.py <out>/<nombre>.dxf --entregar <destino>
(copia solo si AutoCAD lo abre limpio). El PDF lo dibuja ezdxf desde el mismo documento.
"""
from __future__ import annotations

import argparse
import math
import os
import sys
import tempfile
from datetime import date

import ezdxf
from ezdxf import units
from ezdxf.addons.drawing import Frontend, RenderContext, layout, pymupdf
from ezdxf.addons.drawing.config import BackgroundPolicy, ColorPolicy, Configuration

ESC = 5.0                      # PDF en A4 a 5:1
HOJA_W, HOJA_H = 297.0, 210.0  # A4 apaisada, mm de papel
TXT = "ARIAL"


def num(v: float) -> str:
    """4 -> '4', 2.26 -> '2,26' (coma decimal, sin ceros de mas)."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def p(x: float) -> float:
    """mm de papel -> unidades de modelo."""
    return x / ESC


def construir(a: argparse.Namespace) -> ezdxf.document.Drawing:
    d, dk, L, d1, L1 = a.d, a.dk, a.L, a.d1, a.L1
    for nombre, v in (("d", d), ("dk", dk), ("L", L), ("d1", d1), ("L1", L1)):
        if v <= 0:
            sys.exit(f"cota {nombre} = {v}: tiene que ser positiva")
    if not d1 < d < dk:
        sys.exit(f"no cierra d1 < d < dk ({d1} / {d} / {dk}): revisar los datos")

    doc = ezdxf.new("R2013", setup=True)
    doc.units = units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    doc.styles.new(TXT, dxfattribs={"font": "arial.ttf"})

    for nombre, color, lt, lw in (
        ("CONTORNO", 7, "CONTINUOUS", 50),
        ("EJE", 1, "CENTER", 18),
        ("COTAS", 5, "CONTINUOUS", 18),
        ("ROTULO", 7, "CONTINUOUS", 25),
        ("TEXTO", 7, "CONTINUOUS", 18),
    ):
        doc.layers.add(nombre, color=color, linetype=lt, lineweight=lw)
    doc.header["$LTSCALE"] = 0.25

    ds = doc.dimstyles.new("PLANO")
    ds.dxf.dimtxsty = TXT
    ds.dxf.dimtxt = p(3.2)
    ds.dxf.dimasz = p(2.6)
    ds.dxf.dimexe = p(1.5)
    ds.dxf.dimexo = p(1.0)
    ds.dxf.dimgap = p(0.8)
    ds.dxf.dimtad = 1
    ds.dxf.dimdec = 2
    ds.dxf.dimdsep = ord(",")
    ds.dxf.dimclrd = 5
    ds.dxf.dimclre = 5
    ds.dxf.dimclrt = 7
    ds.dxf.dimblk = ""        # flecha cerrada rellena (la de AutoCAD por defecto)

    msp = doc.modelspace()
    cont = {"layer": "CONTORNO"}

    # ---- Geometria (x = eje del remache; x=0 es la cara de apoyo de la cabeza) ----
    r, rk, r1 = d / 2, dk / 2, d1 / 2
    k = 0.15 * dk              # altura de cabeza DIBUJADA (sin dato: no se acota)
    borde = 0.25 * k           # tramo recto del borde de la cabeza
    sag = k - borde
    R = ((rk ** 2) + sag ** 2) / (2 * sag)          # radio de la cupula
    cx = -k + R                                      # centro de la cupula sobre el eje
    xc = cx - math.sqrt(R ** 2 - r1 ** 2)            # donde el mandril sale de la cupula
    ang_borde = math.degrees(math.atan2(rk, -borde - cx))
    ang_mandril = math.degrees(math.atan2(r1, xc - cx))

    # cabeza: cara de apoyo, bordes y cupula (cortada por el mandril)
    msp.add_line((0, -rk), (0, -r), dxfattribs=cont)
    msp.add_line((0, r), (0, rk), dxfattribs=cont)
    msp.add_line((0, rk), (-borde, rk), dxfattribs=cont)
    msp.add_line((0, -rk), (-borde, -rk), dxfattribs=cont)
    # los arcos van en sentido antihorario: arriba del borde al mandril, abajo al reves
    msp.add_arc((cx, 0), R, ang_borde, ang_mandril, dxfattribs=cont)
    msp.add_arc((cx, 0), R, -ang_mandril, -ang_borde, dxfattribs=cont)

    # cuerpo
    msp.add_lwpolyline([(0, r), (L, r), (L, -r), (0, -r)], dxfattribs=cont)

    # mandril: desde la cupula hasta la punta. L1 se mide desde donde el mandril sale de la
    # cabeza (lo que se VE; la punta teorica de la cupula queda tapada por el mandril)
    x_punta = xc - L1
    largo_punta = 1.1 * d1
    msp.add_line((xc, r1), (x_punta + largo_punta, r1), dxfattribs=cont)
    msp.add_line((xc, -r1), (x_punta + largo_punta, -r1), dxfattribs=cont)
    msp.add_lwpolyline(
        [(x_punta + largo_punta, r1), (x_punta, 0), (x_punta + largo_punta, -r1)],
        dxfattribs=cont,
    )
    msp.add_line((x_punta + largo_punta, r1), (x_punta + largo_punta, -r1), dxfattribs=cont)

    # cabeza del mandril, del lado ciego (forma sin acotar)
    cuello, r_cuello, r_bola = 0.12 * d, 0.62 * r1 + 0.1, 0.92 * r
    xb = L + cuello
    sag_b = 0.85 * r_bola
    Rb = (r_bola ** 2 + sag_b ** 2) / (2 * sag_b)
    cbx = xb + sag_b - Rb
    ab = math.degrees(math.atan2(r_bola, xb - cbx))
    msp.add_line((L, r_cuello), (xb, r_cuello), dxfattribs=cont)
    msp.add_line((L, -r_cuello), (xb, -r_cuello), dxfattribs=cont)
    msp.add_line((xb, r_bola), (xb, -r_bola), dxfattribs=cont)
    msp.add_arc((cbx, 0), Rb, -ab, ab, dxfattribs=cont)
    x_fin = xb + sag_b

    # eje
    msp.add_line((x_punta - p(4), 0), (x_fin + p(4), 0), dxfattribs={"layer": "EJE"})

    # ---- Cotas ----
    dim = {"layer": "COTAS"}
    y_bajo = -rk - p(12)
    msp.add_linear_dim(base=(0, y_bajo), p1=(x_punta, 0), p2=(xc, -r1), angle=0,
                       text=f"L1 = {num(L1)}", dimstyle="PLANO", dxfattribs=dim).render()
    msp.add_linear_dim(base=(0, y_bajo), p1=(0, -r), p2=(L, -r), angle=0,
                       text=f"L = {num(L)}", dimstyle="PLANO", dxfattribs=dim).render()

    horiz = {"dimtih": 1, "dimtoh": 1, "dimtad": 0, "dimtmove": 2}
    x_dk = -k - p(10)
    msp.add_linear_dim(base=(x_dk, 0), p1=(-borde, rk), p2=(-borde, -rk), angle=90,
                       text=f"dk = Ø{num(dk)}", dimstyle="PLANO", dxfattribs=dim,
                       location=(x_dk, rk + p(6)), override=horiz).render()
    x_d1 = x_punta + 0.45 * L1
    msp.add_linear_dim(base=(x_d1, 0), p1=(x_d1, r1), p2=(x_d1, -r1), angle=90,
                       text=f"d1 = Ø{num(d1)}", dimstyle="PLANO", dxfattribs=dim,
                       location=(x_d1, r1 + p(9)), override=horiz).render()
    x_d = x_fin + p(10)
    msp.add_linear_dim(base=(x_d, 0), p1=(L, r), p2=(L, -r), angle=90,
                       text=f"d = Ø{num(d)}", dimstyle="PLANO", dxfattribs=dim,
                       location=(x_d, r + p(6)), override=horiz).render()

    # ---- Marco y rotulo (a 1/ESC) ----
    ancho, alto = p(HOJA_W), p(HOJA_H)
    x_centro = (x_punta + x_d) / 2
    ox = x_centro - ancho / 2
    oy = -alto / 2 - p(18)
    rot = {"layer": "ROTULO"}
    m = p(8)
    msp.add_lwpolyline([(ox, oy), (ox + ancho, oy), (ox + ancho, oy + alto), (ox, oy + alto)],
                       close=True, dxfattribs=rot)
    msp.add_lwpolyline([(ox + m, oy + m), (ox + ancho - m, oy + m),
                        (ox + ancho - m, oy + alto - m), (ox + m, oy + alto - m)],
                       close=True, dxfattribs=rot)

    rw, filas = p(150), [p(12), p(9), p(9), p(9)]
    rx1, ry0 = ox + ancho - m, oy + m
    rx0 = rx1 - rw
    ry1 = ry0 + sum(filas)
    msp.add_lwpolyline([(rx0, ry0), (rx1, ry0), (rx1, ry1), (rx0, ry1)], close=True, dxfattribs=rot)
    y = ry1
    for h in filas[:-1]:
        y -= h
        msp.add_line((rx0, y), (rx1, y), dxfattribs=rot)
    col = rx0 + rw * 0.5
    msp.add_line((col, ry0), (col, ry1 - filas[0]), dxfattribs=rot)

    def texto(t, x, y, h, bold=False):
        e = msp.add_text(t, height=h, dxfattribs={"layer": "TEXTO", "style": TXT})
        e.set_placement((x, y))
        return e

    def celda(etq, valor, x, y_top, h_fila, h_val=p(3.2)):
        texto(etq, x + p(1.5), y_top - p(2.6), p(1.9))
        texto(valor, x + p(1.5), y_top - h_fila + p(1.6), h_val)

    y = ry1
    celda("DENOMINACIÓN", a.denominacion, rx0, y, filas[0], p(4.2))
    y -= filas[0]
    celda("CÓDIGO", a.codigo, rx0, y, filas[1])
    celda("EAN", a.ean, col, y, filas[1])
    y -= filas[1]
    celda("MATERIAL DEL CUERPO", a.material, rx0, y, filas[2])
    celda("COTAS EN", "mm", col, y, filas[2])
    y -= filas[2]
    celda("ESCALA", "S/E", rx0, y, filas[3])
    celda("FECHA", a.fecha, col, y, filas[3])

    # vista: medidas en tabla, al costado del rotulo (el que lee con las letras de su hoja)
    tx, ty = ox + m + p(6), ry1 - p(2)
    texto("MEDIDAS", tx, ty, p(3.0))
    for i, (etq, v, qu) in enumerate((
        ("d", f"Ø{num(d)}", "diámetro del cuerpo"),
        ("dk", f"Ø{num(dk)}", "diámetro de la cabeza"),
        ("L", num(L), "largo del cuerpo"),
        ("d1", f"Ø{num(d1)}", "diámetro del mandril"),
        ("L1", num(L1), "largo del mandril desde la cabeza"),
    )):
        yy = ty - p(6) - i * p(5.2)
        texto(etq, tx, yy, p(2.8))
        texto(v, tx + p(12), yy, p(2.8))
        texto(qu, tx + p(30), yy, p(2.4))

    doc.header["$EXTMIN"] = (ox, oy, 0)
    doc.header["$EXTMAX"] = (ox + ancho, oy + alto, 0)
    doc.set_modelspace_vport(height=alto * 1.05, center=(ox + ancho / 2, oy + alto / 2))
    return doc, (ox, oy, ancho, alto)


def a_pdf(doc, marco, ruta_pdf: str) -> None:
    ox, oy, ancho, alto = marco
    ctx = RenderContext(doc)
    cfg = Configuration(background_policy=BackgroundPolicy.WHITE,
                        color_policy=ColorPolicy.BLACK, lineweight_scaling=1.0)
    be = pymupdf.PyMuPdfBackend()
    Frontend(ctx, be, config=cfg).draw_layout(doc.modelspace())
    pagina = layout.Page(HOJA_W, HOJA_H, layout.Units.mm, margins=layout.Margins.all(0))
    ajustes = layout.Settings(scale=ESC, fit_page=False)
    from ezdxf.math import BoundingBox2d
    limites = BoundingBox2d([(ox, oy), (ox + ancho, oy + alto)])
    datos = be.get_pdf_bytes(pagina, settings=ajustes, render_box=limites)
    with open(ruta_pdf, "wb") as f:
        f.write(datos)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True)
    ap.add_argument("--nombre", default="Plano remache")
    ap.add_argument("--d", type=float, default=4.0)
    ap.add_argument("--dk", type=float, default=8.0)
    ap.add_argument("--L", type=float, default=8.0)
    ap.add_argument("--d1", type=float, default=2.26)
    ap.add_argument("--L1", type=float, default=30.0)
    ap.add_argument("--denominacion", default="REMACHE DE ALUMDW4.0X7.4")
    ap.add_argument("--codigo", default="04.0900780")
    ap.add_argument("--ean", default="7790001001122")
    ap.add_argument("--material", default="ALUMINIO")
    ap.add_argument("--fecha", default=date.today().strftime("%d/%m/%Y"))
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    doc, marco = construir(a)
    dxf = os.path.join(a.out, a.nombre + ".dxf")
    pdf = os.path.join(a.out, a.nombre + ".pdf")
    # ezdxf deja los extents sin calcular: el DXF sale por normalizar(), que los escribe sin
    # tocar la geometria y lo pasa por el AUDIT de AutoCAD (regla dxf-entregable.md).
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    from _validarDxf import normalizar
    with tempfile.TemporaryDirectory() as tmp:
        crudo = os.path.join(tmp, "crudo.dxf")
        doc.saveas(crudo)
        for linea in normalizar(crudo, dxf):
            print("  normalizar:", linea)
    a_pdf(doc, marco, pdf)
    print(dxf)
    print(pdf)


if __name__ == "__main__":
    main()
