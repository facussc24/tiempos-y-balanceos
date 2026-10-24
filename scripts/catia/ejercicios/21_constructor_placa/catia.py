# -*- coding: utf-8 -*-
"""Ejercicio 21 (24/10/2026): la placa del banco 3D 21_constructor_placa rehecha en CATIA con el constructor de la casa
(scripts/catia/constructores_casa.py placa: R1,5 en verticales y arriba, Chamfer de dos largos iguales en el contorno de
la cama), para el juez: mismo volumen que la BIEN de build123d y los MISMOS correctores del banco (chaflan_cama y
cantos_convexos) sobre el STEP que exporta CATIA. Reemplaza al chaflan en escalones de pulir.py del 20/10.

Medidas: evals/banco3d/ejercicios/21_constructor_placa/_placa.py (la brida del macho del 20/10, 64 x 24 x 4, chaflan 0,6).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, STEP y captura BMP.
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
CATIA_DIR = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, CATIA_DIR)
import juez_comun as jc  # noqa: E402

EJ = "21_constructor_placa"
NOMBRE = "placa_biblioteca"
LARGO, ANCHO, ESP, CH = 64.0, 24.0, 4.0, 0.6
CORRECTORES = [("chaflan_cama", ["--tol-grados", "2"]),
               ("cantos_convexos", ["--umbral", "1.5", "--zona=-33,-13,0.65,33,13,4.1"])]


def correctores(step, salida, lista):
    import constructores_casa as cc
    res = cc.verificar_con_banco(step, lista, venv=jc.VENV_CAD, repo=jc.REPO)
    salida["correctores_step_catia"] = res
    malos = {k: v for k, v in res.items() if v["veredicto"] != "verde"}
    if malos:
        raise RuntimeError(f"correctores del banco sobre el STEP de CATIA que no dan verde: {malos}")
    return res


def construir(cb, c, reg, salida):
    import constructores_casa as cc
    ctx = cc.nueva(cb, c, NOMBRE)
    est = {}

    def hacer():
        est["r"] = cc.placa(ctx, LARGO, ANCHO, ESP, chaflan_cama=CH)
        return {"volumen": est["r"]["volumen"], "procedencia": est["r"]["procedencia"],
                "chaflan_como": est["r"].get("chaflan_como"),
                "aristas_rechazadas_por_catia": est["r"].get("aristas_rechazadas_por_catia")}
    reg.paso(f"placa {LARGO:g} x {ANCHO:g} x {ESP:g} con chaflan de cama {CH:g} y R de la casa", hacer)
    body = est["r"]["cuerpo"] if "r" in est else ctx.part.MainBody
    jc.cerrar_parte(cb, c, reg, salida, ctx.doc, ctx.part, body, NOMBRE, NOMBRE)
    step = salida["_steps"].get(NOMBRE)
    if step:
        reg.paso("correctores del banco sobre el STEP que exporto CATIA", lambda: correctores(step, salida, CORRECTORES))


if __name__ == "__main__":
    sys.exit(jc.correr_ejercicio(EJ, construir))
