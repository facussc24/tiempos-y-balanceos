# -*- coding: utf-8 -*-
"""Ejercicio 05 del banco 3D (canto vivo, mango R1,5) rehecho en CATIA Part Design por COM, para el juez (23/10/2026):
barra con dos agujeros pasantes y R1,5 en TODAS las aristas, en las MISMAS coordenadas que build123d (centrada).

Medidas: evals/banco3d/ejercicios/05_canto_vivo/_mango.py y bien.py (pieza de ENSAYO del banco, sin fuente de Barack):
barra 100 x 30 x 20 centrada, agujeros de diametro 8 pasantes en Z en x -38 y 38, radio 1,5 en las 12 aristas de la barra
y en los 4 bordes de los agujeros.

Redondeo en DOS pasos (catia.md, ej80 del 19/10): las 12 aristas de una vez dejan cada esquina como interseccion de 3
cilindros (+0,15 % de volumen); primero las 4 verticales y despues las de arriba y abajo con propagacion por tangencia
(da la esquina esferica, la de build123d). Los bordes de los agujeros no son tangentes al contorno: van en el segundo
paso como aristas aparte.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, STEP y captura BMP.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import juez_comun as jc  # noqa: E402

EJ = "05_canto_vivo"
BL, BA, BE = 100.0, 30.0, 20.0
X_AG, R_AG = 38.0, 4.0
RAD = 1.5
NOMBRE = "mango_R1_5"            # el mismo nombre que le da bien.py (la parte de build123d se llama asi)
TOL = 1e-3


def construir(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, NOMBRE)
    est = {}

    def barra():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(-BL / 2, -BA / 2, BL / 2, BA / 2)])
        est["pad"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, BE / 2, BL * BA * BE, simetrico=True)
        return info
    reg.paso(f"barra {BL:g} x {BA:g} x {BE:g} centrada (extrusion simetrica desde XY)", barra)

    def agujeros():
        est["plano"] = jc.plano_a(part, body, BE / 2)
        sk = jc.croquis(cb, part, body, est["plano"], circulos=[(-X_AG, 0.0, R_AG), (X_AG, 0.0, R_AG)])
        est["pk"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, BE + 5, -2 * math.pi * R_AG ** 2 * BE,
                                               (0.0, 0.0, 0.0), antes=est["m"], vaciado=True)
        return info
    reg.paso(f"2 agujeros pasantes de {2 * R_AG:g} en x -{X_AG:g} y {X_AG:g} (vaciado desde z {BE / 2:g})", agujeros)

    def verticales():
        # las aristas se buscan en la operacion que las creo (catia.md): las de la barra en el pad (la topologia del
        # vaciado trae solo los 4 bordes de los agujeros, medido el 23/10)
        ar = [d for d in cb.topologia(doc, est["pad"], "Edge") if "cdg" in d]
        vert = [d["ref"] for d in ar if abs(abs(d["cdg"][0]) - BL / 2) < TOL and abs(abs(d["cdg"][1]) - BA / 2) < TOL
                and abs(d["cdg"][2]) < TOL]
        if len(vert) != 4:
            raise RuntimeError(f"aristas verticales de las esquinas: {len(vert)} (de {len(ar)} aristas)")
        fl = sf.AddNewSolidEdgeFilletWithConstantRadius(vert[0], 0, RAD)
        for r_ in vert[1:]:
            fl.AddObjectToFillet(r_)
        part.Update()
        est["f1"] = fl
        return {"aristas": len(ar), "verticales": len(vert)}
    reg.paso(f"redondeo R{RAD:g} paso 1: las 4 aristas verticales de las esquinas", verticales)

    def arriba_abajo():
        def en_z(feat):
            return [d for d in cb.topologia(doc, feat, "Edge") if "cdg" in d and abs(abs(d["cdg"][2]) - BE / 2) < TOL]

        def al_agujero(d):
            return min(math.dist(d["cdg"][:2], (x, 0.0)) for x in (-X_AG, X_AG))
        # contorno: lo que dejo el paso 1 (como en ej80); con una arista de arriba y una de abajo la propagacion toma
        # toda la cadena tangente. Bordes de los agujeros: los que creo el vaciado.
        contorno = [d["ref"] for d in en_z(est["f1"]) if al_agujero(d) > R_AG + RAD]
        if not contorno:
            contorno = [d["ref"] for d in en_z(est["pad"]) if al_agujero(d) > R_AG + RAD]
        bordes = [d["ref"] for d in en_z(est["pk"]) if abs(al_agujero(d) - R_AG) < TOL]
        if not contorno or not bordes:
            raise RuntimeError(f"aristas en z +-{BE / 2:g}: contorno {len(contorno)}, bordes de agujero {len(bordes)}")
        f2 = sf.AddNewSolidEdgeFilletWithConstantRadius(contorno[0], 1, RAD)     # 1: propaga por tangencia
        tomadas, ya = 1, 0
        for r_ in contorno[1:] + bordes:
            try:
                f2.AddObjectToFillet(r_)
                tomadas += 1
            except Exception:  # noqa: BLE001  (ya tomada por la propagacion)
                ya += 1
        part.Update()
        return {"contorno": len(contorno), "bordes_agujero": len(bordes), "agregadas": tomadas, "rechazadas": ya}
    reg.paso(f"redondeo R{RAD:g} paso 2: contorno de arriba y de abajo (propagacion) y los 4 bordes de los agujeros",
             arriba_abajo)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, NOMBRE, NOMBRE,
                    ocultos=[est["plano"]] if "plano" in est else [])


if __name__ == "__main__":
    sys.exit(jc.correr_ejercicio(EJ, construir))
