# -*- coding: utf-8 -*-
"""Ejercicio 06 del banco 3D (palanca 0-60) rehecho en CATIA Part Design por COM, para el juez (23/10/2026): base,
soporte del eje y palanca del bien.py, cada una en su CATPart, en las MISMAS coordenadas que build123d (pose de 0 grados).

Medidas: evals/banco3d/ejercicios/06_palanca_0_60/_conjunto.py (bien.py no agrega brazo; piezas de ENSAYO del banco, sin
fuente de Barack): base Pos(-60,-70,0) 260 x 140 x 10; soporte Pos(-15,-30,10) 30 x 18 x 85; palanca = cilindro R15 de
largo 20 (eje Y, centro (0,0,80)) + barra 150 x 20 x 20 desde x 0 (y -10..10, z 70..90).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json (volumen y cdg de CATIA y de build123d por parte), un STEP y
una captura BMP por parte.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import juez_comun as jc  # noqa: E402

EJ = "06_palanca_0_60"
BX0, BY0, BL, BA, BE = -60.0, -70.0, 260.0, 140.0, 10.0          # base
SX0, SY0, SZ0, SL, SA, SH = -15.0, -30.0, 10.0, 30.0, 18.0, 85.0  # soporte
EJE_Z, R_CUBO, LARGO, MEDIO = 80.0, 15.0, 150.0, 10.0              # palanca
V_CUBO = math.pi * R_CUBO ** 2 * 2 * MEDIO
# la barra arranca en el centro del cubo: lo que suma es la barra menos la parte que ya esta adentro del cilindro
# (x >= 0, |z - 80| <= 10 dentro del circulo R15), por el ancho 20
_A = 2 * (MEDIO / 2 * math.sqrt(R_CUBO ** 2 - MEDIO ** 2) + R_CUBO ** 2 / 2 * math.asin(MEDIO / R_CUBO))
V_BARRA_SUMA = LARGO * (2 * MEDIO) ** 2 - _A * 2 * MEDIO


def construir(cb, c, reg, salida):
    # base
    doc, part, body, sf = cb.nueva_pieza(c, "palanca_0_60_base")

    def base():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(BX0, BY0, BX0 + BL, BY0 + BA)])
        _, m, info = jc.extruir(cb, doc, part, body, sf, sk, BE, BL * BA * BE,
                                (BX0 + BL / 2, BY0 + BA / 2, BE / 2))
        return info
    reg.paso(f"base: {BL:g} x {BA:g} x {BE:g} desde ({BX0:g}, {BY0:g}, 0)", base)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "palanca_0_60_base", "base")

    # soporte del eje
    doc, part, body, sf = cb.nueva_pieza(c, "palanca_0_60_soporte")
    est = {}

    def soporte():
        est["plano"] = jc.plano_a(part, body, SZ0)
        sk = jc.croquis(cb, part, body, est["plano"], rects=[(SX0, SY0, SX0 + SL, SY0 + SA)])
        _, m, info = jc.extruir(cb, doc, part, body, sf, sk, SH, SL * SA * SH,
                                (SX0 + SL / 2, SY0 + SA / 2, SZ0 + SH / 2))
        return info
    reg.paso(f"soporte: {SL:g} x {SA:g} x {SH:g} desde ({SX0:g}, {SY0:g}, {SZ0:g})", soporte)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "palanca_0_60_soporte", "soporte",
                    ocultos=[est["plano"]] if "plano" in est else [])

    # palanca: croquis en ZX (H -> Z, V -> X) y extrusion simetrica en Y (y -10..10)
    doc, part, body, sf = cb.nueva_pieza(c, "palanca_0_60_palanca")
    zx = jc.plano_origen(part, "zx")
    a_zx = jc.EJES["zx"]
    est = {}

    def cubo():
        h, v = a_zx(0.0, 0.0, EJE_Z)
        sk = jc.croquis(cb, part, body, zx, circulos=[(h, v, R_CUBO)])
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, MEDIO, V_CUBO, simetrico=True)
        return info
    reg.paso(f"palanca: cubo R{R_CUBO:g} x {2 * MEDIO:g} con eje en z {EJE_Z:g} (simetrico en Y)", cubo)

    def barra():
        h0, v0 = a_zx(0.0, 0.0, EJE_Z - MEDIO)
        h1, v1 = a_zx(LARGO, 0.0, EJE_Z + MEDIO)
        sk = jc.croquis(cb, part, body, zx, rects=[(h0, v0, h1, v1)])
        _, m, info = jc.extruir(cb, doc, part, body, sf, sk, MEDIO, V_BARRA_SUMA, antes=est.get("m"), simetrico=True)
        return info
    reg.paso(f"palanca: barra {LARGO:g} x {2 * MEDIO:g} x {2 * MEDIO:g} desde el eje hacia +X", barra)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "palanca_0_60_palanca", "palanca")


if __name__ == "__main__":
    sys.exit(jc.correr_ejercicio(EJ, construir))
