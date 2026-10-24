# -*- coding: utf-8 -*-
"""Ejercicio 20 (24/10/2026): la caja del banco 3D 20_constructor_caja rehecha en CATIA con el constructor de la casa
(scripts/catia/constructores_casa.py caja), para el juez: mismo volumen y centro de gravedad que la BIEN de build123d
(cadlib.constructores.caja, el mismo bien.py del banco) y los MISMOS correctores del banco sobre el STEP que exporta
CATIA (cantos_convexos con la zona del tarea.yaml). Si una version pasa y la otra no, la biblioteca no se adopta
(propuesta 2, «Como se prueba»).

Medidas: evals/banco3d/ejercicios/20_constructor_caja/_caja.py (el pedestal de la palanca del 20/10, 52 x 30 x 53,11).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, STEP y captura BMP.
"""
import os
import sys

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, CATIA_DIR)
import juez_comun as jc  # noqa: E402

EJ = "20_constructor_caja"
NOMBRE = "caja_biblioteca"                 # el mismo nombre que le da bien.py
LARGO, ANCHO = 52.0, 30.0
ALTO = round((42.66 - 9.83) - (-20.28), 2)
CORRECTORES = [("cantos_convexos", ["--umbral", "1.5", "--zona=-27,-16,0.05,27,16,54"])]


def correctores(step, salida, lista):
    """Los correctores del banco sobre el STEP de CATIA (constructores_casa.verificar_con_banco); falla el paso si alguno
    no da verde."""
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
        est["r"] = cc.caja(ctx, LARGO, ANCHO, ALTO)
        return {"volumen": est["r"]["volumen"], "procedencia": est["r"]["procedencia"],
                "aristas_rechazadas_por_catia": est["r"].get("aristas_rechazadas_por_catia")}
    reg.paso(f"caja {LARGO:g} x {ANCHO:g} x {ALTO:g} con el constructor de la casa (R de lenguaje_diseno.json)", hacer)
    body = est["r"]["cuerpo"] if "r" in est else ctx.part.MainBody
    jc.cerrar_parte(cb, c, reg, salida, ctx.doc, ctx.part, body, NOMBRE, NOMBRE)
    step = salida["_steps"].get(NOMBRE)
    if step:
        reg.paso("correctores del banco sobre el STEP que exporto CATIA", lambda: correctores(step, salida, CORRECTORES))


if __name__ == "__main__":
    sys.exit(jc.correr_ejercicio(EJ, construir))
