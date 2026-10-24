# -*- coding: utf-8 -*-
# Origen: ej41_tool_block.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA por
# el PEDIDO 27 a «para CATA - practica 19-10»; sha256 3314a649...8ea2). Cambios para el ejercicio 36 del banco de CATIA
# (24/10/2026), nada mas: 1) no importa captura, correr, guardar_pieza, math ni sys; 2) hacer(n) pasa a cuerpo(c, reg, n),
# que arma la etapa n y devuelve ctx (doc, part, body) en vez de capturar, guardar y anotar reg.datos["resultado"]:
# material, masa, captura y STEP los hace el catia.py; 3) sin el bloque __main__ ni el «Uso:» del docstring; 4) el JSON
# del perfil se lee con «with open(..., encoding="utf-8")» en vez de json.load(open(...)); 5) la masa del paso es dato
# (volumen x 0,0079), la que juzga sale del material de CATIA. El perfil (e1.json / e2.json) y el gemelo vienen sin
# cambios en ej41_tool_block/.
"""ej41 — CSWA Sample Exam 2013 oficial de SolidWorks, «Tool Block» etapas 1 y 2, en CATIA.
Contorno calculado en el gemelo (R19 tangente a la recta de 10 grados por la esquina; R29 con centro sobre la recta de
abajo a y 19; R5 tangente) y pasado con de_build123d.py; pad de C y agujero D14. Acero 0,0079 g/mm3.
Respuestas oficiales: etapa 1 (81 57 43) 939,54 g; etapa 2 (84 59 45) 1 032,32 g."""
import json
import os

from catia_base import medir, nueva_pieza, ref
from croquis import dibujar

DENS = 0.0079
AQUI = os.path.dirname(os.path.abspath(__file__))
ETAPA = {1: ("e1", 43.0, 939.54), 2: ("e2", 45.0, 1032.32)}


def cuerpo(c, reg, n):
    nombre, C, oficial = ETAPA[n]
    with open(os.path.join(AQUI, "ej41_tool_block", f"{nombre}.json"), encoding="utf-8") as fj:
        tr = [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:]) for t in json.load(fj)]
    doc, part, body, sf = nueva_pieza(c, f"ej41_tool_block_e{n}")
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def dib(f):
        dibujar(f, tr)
        k = f.CreateClosedCircle(14.0, 33.0, 7.0)
        k.CenterPoint = f.CreatePoint(14.0, 33.0)

    def pieza():
        sk = body.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, C)
        part.Update()
        v = medir(doc, part, body)["volume"]
        return {"vol": v, "area": round(v / C, 3), "masa_g": round(v * DENS, 2), "oficial": oficial}
    reg.paso(f"perfil del Tool Block (etapa {n}) con D14, pad {C}", pieza)
    return {"doc": doc, "part": part, "body": body}
