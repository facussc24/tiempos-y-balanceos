# -*- coding: utf-8 -*-
# Origen: ej67_perno_diamante.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO 27 a «para CATA - practica 19-10»; sha256 88fdd9af...da1b). Cambios para el ejercicio 44 del banco de
# CATIA (24/10/2026), nada mas: 1) no importa correr, captura, guardar_pieza, VENV_CAD, json, os ni subprocess; 2) sin la
# captura, el CATPart + STEP ni el paso «control»: la captura y el STEP los hace el catia.py con cerrar_parte, y el control
# de build123d (la cadena CONTROL, sin cambios) vive en choque_perno.py y lo corre el juez del catia.py; 3) cuerpo(c, reg)
# devuelve ctx (doc, part, el cuerpo del perno y la placa) en vez de terminar sin nada; 4) sin el bloque __main__.
"""ej67 — PERNO DIAMANTE (posicionar una pieza por dos agujeros: un perno redondo ubica y el diamante solo frena el giro).
Enunciado (Joshi, Jigs and Fixtures, ej. 2.1, en frente1_dispositivos.md Ub10): agujero de 55,55 (minimo), distancia
entre centros 45 +/- 0,15, franja de contacto W = 2. Respuesta publicada: d = 2*sqrt(D^2/4 - V*W - V^2) = 55,538.
El perno es el circulo d cortado por la franja |x| <= W/2: queda libre a lo largo de x (la linea entre centros), donde
varia la distancia, y frena en y.
Control con OTRA herramienta (build123d, booleano exacto sobre el STEP de CATIA): el agujero corrido V = 0,15 en x da
choque 0 (la esquina de la franja apenas toca); corrido 0,20 choca; y el gemelo, un perno REDONDO del mismo d corrido
0,15, choca (por eso existe el diamante)."""
import math

from catia_base import nueva_pieza, ref, medir
from croquis import dibujar

D, V, W, ESP = 55.55, 0.15, 2.0, 10.0
d = 2 * math.sqrt(D ** 2 / 4 - V * W - V ** 2)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej67_perno_diamante")
    o = part.OriginElements
    reg.datos["cuenta"] = {"d_mm": round(d, 4), "publicado": 55.538}
    est = {}

    def perno():
        yc = math.sqrt((d / 2) ** 2 - (W / 2) ** 2)
        sk = main.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        a, b, cc, e = (W / 2, -yc), (W / 2, yc), (-W / 2, yc), (-W / 2, -yc)
        dibujar(f, [("L", a, b), ("A", (0, 0), d / 2, b, cc), ("L", cc, e), ("A", (0, 0), d / 2, e, a)])
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, ESP)
        part.Update()
        m = medir(doc, part, main)
        # area exacta del circulo cortado por la franja: 2*(W/2*yc + r^2*asin(W/2/r)), r = d/2
        r = d / 2
        area = 2 * (W / 2 * yc + r ** 2 * math.asin(W / 2 / r))
        return {"vol": round(m["volume"], 3), "cuenta": round(area * ESP, 3)}
    reg.datos["perno"] = reg.paso("perno diamante d con franja W", perno)

    def placa():
        b = part.Bodies.Add()
        b.Name = "placa"
        part.InWorkObject = b
        sk = b.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        q = [(-50, -50), (50, -50), (50, 50), (-50, 50)]
        dibujar(f, [("L", q[i], q[(i + 1) % 4]) for i in range(4)])
        f.CreateClosedCircle(0.0, 0.0, D / 2)
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, ESP)
        part.Update()
        est["placa"] = b
        m = medir(doc, part, b)
        return {"vol": round(m["volume"], 3), "cuenta": round((100 * 100 - math.pi * D ** 2 / 4) * ESP, 3)}
    reg.datos["placa"] = reg.paso("placa 100 x 100 con el agujero D", placa)
    return {"doc": doc, "part": part, "body": main, "placa": est.get("placa")}
