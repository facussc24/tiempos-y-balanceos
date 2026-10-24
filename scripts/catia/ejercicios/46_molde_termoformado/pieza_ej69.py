# -*- coding: utf-8 -*-
# Origen: ej69_molde_termoformado.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a
# CATA por el PEDIDO 27 a «para CATA - practica 19-10»; sha256 c87d4649...4939). Cambios para el ejercicio 46 del banco de
# CATIA (24/10/2026), nada mas: 1) no importa correr, captura ni os; 2) sin la captura del molde con desmoldeo (la captura
# y el STEP de cada molde los hace el catia.py con cerrar_parte); 3) cuerpo(c, reg) junta en «docs» el doc, la parte y el
# cuerpo de cada molde y devuelve {"res", "docs"} en vez de terminar sin nada; 4) sin el bloque __main__.
"""ej69 — MOLDE MACHO DE TERMOFORMADO y relacion de estirado (banco E18, RapidMade 17/11/2025). Caja de 10 x 12 pulg de
planta y 2 de profundidad, espesor promedio terminado 0,100 pulg. Publicado (sin desmoldeo): area formada 208 pulg2,
huella 120 pulg2, relacion 1,733, chapa de partida 0,173 pulg (distribucion ideal).
En CATIA: el molde macho como bloque (254 x 304,8 x 50,8 mm), se miden las caras formadas (techo + 4 lados) y la huella.
Despues el MISMO molde con el desmoldeo de macho de las dos fuentes (4 grados, RapidMade 4-6 / Formlabs 4-5) y la
cuenta exacta del tronco de piramide: cuanto cambia el estirado y la chapa de partida."""
import math

from catia_base import nueva_pieza, ref, topologia
from croquis import dibujar

PULG = 25.4
A, B, H, T_FIN = 10 * PULG, 12 * PULG, 2 * PULG, 0.100
ANG = 4.0


def cuenta(ang):
    t = math.tan(math.radians(ang))
    at, bt = A - 2 * H * t, B - 2 * H * t
    s = H / math.cos(math.radians(ang))
    formada = at * bt + 2 * (A + at) / 2 * s + 2 * (B + bt) / 2 * s
    return formada, formada / (A * B)


def cuerpo(c, reg):
    res, docs = {}, {}
    for ang in (0.0, ANG):
        doc, part, body, sf = nueva_pieza(c, f"molde_{int(ang)}")
        docs[ang] = (doc, part, body)
        sk = body.Sketches.Add(ref(part, part.OriginElements.PlaneXY))
        f = sk.OpenEdition()
        q = [(0.0, 0.0), (A, 0.0), (A, B), (0.0, B)]
        dibujar(f, [("L", q[i], q[(i + 1) % 4]) for i in range(4)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, H)
        part.Update()

        def caras():
            cs = [d for d in topologia(doc, body, "Face") if "cdg" in d]
            return ([d for d in cs if abs(d["cdg"][2]) < 1e-3], [d for d in cs if abs(d["cdg"][2] - H) < 1e-3],
                    [d for d in cs if 1e-3 < d["cdg"][2] < H - 1e-3])

        if ang:
            def desmoldear():
                abajo, arriba, lados = caras()
                dr = sf.AddNewDraft(lados[0]["ref"], abajo[0]["ref"], 0, abajo[0]["ref"], 0.0, 0.0, 1.0, 0, ang, 0)
                for d in lados[1:]:
                    dr.DraftDomains.Item(1).AddFaceToDraft(d["ref"])
                part.Update()
                ab, ar, _ = caras()
                if ar[0]["medida"] > ab[0]["medida"]:          # el techo tiene que quedar MAS CHICO que la huella
                    dr.DraftDomains.Item(1).SetPullingDirection(0.0, 0.0, -1.0)
                    part.Update()
                return {"lados": len(lados)}
            reg.paso(f"desmoldeo {ang:g} grados en los 4 lados (neutro: la base)", desmoldear)

        def medir_caras():
            abajo, arriba, lados = caras()
            huella = abajo[0]["medida"]
            formada = arriba[0]["medida"] + sum(d["medida"] for d in lados)
            fc, rc = cuenta(ang)
            r = formada / huella
            return {"huella_pulg2": round(huella / PULG ** 2, 3), "formada_pulg2": round(formada / PULG ** 2, 3),
                    "cuenta_formada_pulg2": round(fc / PULG ** 2, 3), "relacion": round(r, 4), "cuenta_relacion": round(rc, 4),
                    "chapa_partida_pulg": round(r * T_FIN, 4), "chapa_partida_mm": round(r * T_FIN * PULG, 2),
                    "techo_mm": [round(x, 2) for x in arriba[0]["cdg"]], "n_lados": len(lados)}
        res[ang] = reg.paso(f"caras formadas contra la huella, {ang:g} grados", medir_caras)
    reg.datos["resultado"] = {f"{k:g}_grados": v for k, v in res.items()}
    if 0.0 in res and ANG in res and isinstance(res[0.0], dict) and isinstance(res[ANG], dict):
        reg.datos["publicado_sin_desmoldeo"] = {"formada": 208, "relacion": 1.733, "chapa": 0.173}
        reg.datos["efecto_desmoldeo_%"] = round(100 * (res[ANG]["relacion"] - res[0.0]["relacion"]) / res[0.0]["relacion"], 2)
    return {"res": res, "docs": docs}
