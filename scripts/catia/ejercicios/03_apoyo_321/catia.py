# -*- coding: utf-8 -*-
"""Ejercicio 03 del banco 3D (apoyo 3-2-1) rehecho en CATIA Part Design por COM, para el juez (23/10/2026): la placa y
los 6 pernos de apoyo del bien.py, en las MISMAS coordenadas que build123d. Placa en un CATPart y los pernos en otro (un
cuerpo con 6 cilindros sueltos, como el Compound de build123d).

Medidas: evals/banco3d/ejercicios/03_apoyo_321/_conjunto.py y bien.py (pieza de ENSAYO del banco, sin fuente de Barack):
placa 200 x 120 x 10 desde el origen; pernos R5 x 20: primario bajo z 0 en (15,15), (185,15), (100,105); secundario
contra y 0 en x 30 y 170 (a media altura, z 5); terciario contra x 0 en y 60 (z 5).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json (volumen y cdg de CATIA y de build123d por parte), un STEP y
una captura BMP por parte.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import juez_comun as jc  # noqa: E402

EJ = "03_apoyo_321"
L, A, E = 200.0, 120.0, 10.0
R, H = 5.0, 20.0
PRIMARIO = [(15.0, 15.0), (185.0, 15.0), (100.0, 105.0)]
SECUNDARIO = [30.0, 170.0]
TERCIARIO = [60.0]
V_PERNO = math.pi * R ** 2 * H


def _medio(pts):
    return tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))


def construir(cb, c, reg, salida):
    # placa
    doc, part, body, sf = cb.nueva_pieza(c, "apoyo_321_placa")

    def placa():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(0.0, 0.0, L, A)])
        return jc.extruir(cb, doc, part, body, sf, sk, E, L * A * E, (L / 2, A / 2, E / 2))[2]
    reg.paso(f"placa: {L:g} x {A:g} x {E:g} desde el origen", placa)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "apoyo_321_placa", "placa")

    # pernos: tres extrusiones en el mismo cuerpo, cada una hacia AFUERA de la placa (lado negativo de su plano)
    doc, part, body, sf = cb.nueva_pieza(c, "apoyo_321_apoyos")
    est = {"m": None}
    grupos = [
        ("primario", "xy", [(x, y, -H / 2) for x, y in PRIMARIO]),
        ("secundario", "zx", [(x, -H / 2, E / 2) for x in SECUNDARIO]),
        ("terciario", "yz", [(-H / 2, y, E / 2) for y in TERCIARIO]),
    ]
    for nombre, plano, centros in grupos:
        def grupo(plano=plano, centros=centros):
            a = jc.EJES[plano]
            circ = [(*a(*cen), R) for cen in centros]
            sk = jc.croquis(cb, part, body, jc.plano_origen(part, plano), circulos=circ)
            _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, H, len(centros) * V_PERNO, _medio(centros),
                                           antes=est["m"])
            return info
        reg.paso(f"apoyos: {len(centros)} perno(s) R{R:g} x {H:g} del plano {nombre} (centros {centros})", grupo)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "apoyo_321_apoyos", "apoyos")


if __name__ == "__main__":
    sys.exit(jc.correr_ejercicio(EJ, construir))
