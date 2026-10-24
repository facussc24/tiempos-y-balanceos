# -*- coding: utf-8 -*-
"""Ejercicio 50 del banco de CATIA (24/10/2026, CATA): el gancho de Leo (collar sobre el tope del caño + una cuna de
cada lado) rehecho EN CATIA desde sus datos, leyendo el params_leo.json de .claude/skills/cad-design/examples/
gancho_mochila/. No hay ej de la practica: la respuesta es el STEP que genera build_gancho_leo.py con ese params.

build_gancho_leo.py::construir() arma todo con cajas a lo largo de Z (el collar menos el hueco, las dos cunas menos su
bocha): el resultado es UN perfil en XY extruido la profundidad del collar. Aca ese perfil es un solo croquis (16
vertices, el contorno de esa union y esas restas) y un pad en +Z; despues los mismos seis redondeos en aristas paralelas
a Z: el fondo de la bocha del lado de la pared (x = +-U, y = fondo) y del lado del labio (x = +-(u_punta - labio)), R
r_fondo, y la esquina interna del hueco (x = +-ui, y = v_hombro), R 4. Las cotas derivadas se calculan como derivadas()
de build_gancho_leo.py (la prueba lo compara con build123d)."""
import json
import os

from catia_base import medir, nueva_pieza, ref, poligono, topologia

R_ESQUINA_HUECO = 4.0                    # el literal de build_gancho_leo.py («esquina interna del hueco»)


def cotas(p):
    """Las de derivadas() y construir() de build_gancho_leo.py, con los mismos nombres."""
    ca, co, cu = p["cano"], p["collar"], p["cuna"]
    hueco = ca["espesor"] + ca["juego"]
    ui = hueco / 2.0
    U = ui + co["pared"]
    up = U + cu["vuelo"]
    return {"ui": ui, "U": U, "up": up, "v_h": co["alto_pared"], "v_t": co["alto_pared"] + co["barra_arriba"],
            "w": co["profundidad"], "alto": cu["alto"], "fondo": cu["fondo"], "labio": cu["labio_espesor"],
            "r_fondo": cu["r_fondo"], "ul": up - cu["labio_espesor"]}


def contorno(k):
    """El contorno en XY de: caja(-U, U, 0, v_t) - caja(-ui, ui, 0, v_h) + las dos cunas (U..up, 0..alto) menos su bocha
    (U..ul, fondo..alto+5), recorrido en sentido antihorario."""
    ui, U, up, ul, vh, vt, al, fo = k["ui"], k["U"], k["up"], k["ul"], k["v_h"], k["v_t"], k["alto"], k["fondo"]
    return [(-up, 0.0), (-ui, 0.0), (-ui, vh), (ui, vh), (ui, 0.0), (up, 0.0), (up, al), (ul, al), (ul, fo), (U, fo),
            (U, vt), (-U, vt), (-U, fo), (-ul, fo), (-ul, al), (-up, al)]


def area_contorno(pts):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))


def cuerpo(c, reg, params):
    with open(params, encoding="utf-8") as f:
        k = cotas(json.load(f))
    doc, part, body, sf = nueva_pieza(c, "gancho_LEO")
    o = part.OriginElements
    ctx = {"construccion": [], "cotas": k}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def perfil():
        pts = contorno(k)
        sk = body.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, pts)
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, k["w"])
        part.Update()
        if medir(doc, part, body)["cdg_mm"][2] < 0:      # tiene que crecer hacia +Z (de 0 a la profundidad)
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        return {"vol": vol(), "cuenta": round(area_contorno(pts) * k["w"], 3)}
    reg.paso("perfil del collar y las dos cunas, pad en +Z", perfil)

    def aristas_z(x, y, tol=0.8):
        return [d for d in topologia(doc, body, "Edge") if "cdg" in d and abs(d["cdg"][0] - x) < tol
                and abs(d["cdg"][1] - y) < tol and abs(d.get("medida", 0) - k["w"]) < 0.5]

    def redondeo(x, y, r, nombre):
        ar = aristas_z(x, y)
        if not ar:
            raise RuntimeError(f"no hay aristas para el {nombre}")
        v0 = vol()
        intentos = []
        for i, d in enumerate(ar):                      # el orden de la topologia cambia entre corridas (CAMBIO 4 del 24)
            try:
                sf.AddNewSolidEdgeFilletWithConstantRadius(d["ref"], 0, float(r))
                part.Update()
                intentos.append(f"candidata {i}: ok")
                break
            except Exception as e:  # noqa: BLE001
                intentos.append(f"candidata {i}: {repr(e)[:80]}")
        else:
            raise RuntimeError(f"el {nombre} no salio: {intentos}")
        return {"aristas": len(ar), "intentos": intentos, "cambio": round(vol() - v0, 3)}

    for s in (1, -1):                                   # el mismo orden de build_gancho_leo.py
        lado = "der" if s > 0 else "izq"
        reg.paso(f"R fondo de la bocha, lado pared {lado}",
                 lambda s=s: redondeo(s * k["U"], k["fondo"], k["r_fondo"], "fondo lado pared"))
        reg.paso(f"R fondo de la bocha, lado labio {lado}",
                 lambda s=s: redondeo(s * k["ul"], k["fondo"], k["r_fondo"], "fondo lado labio"))
        reg.paso(f"R esquina interna del hueco {lado}",
                 lambda s=s: redondeo(s * k["ui"], k["v_h"], R_ESQUINA_HUECO, "esquina del hueco"))
    ctx.update(doc=doc, part=part, body=body, sf=sf)
    return ctx
