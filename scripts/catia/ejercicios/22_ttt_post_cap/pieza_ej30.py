# -*- coding: utf-8 -*-
# Origen: ej30_post_cap.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 22 del banco de CATIA (24/10/2026), nada mas: 1) importa solo
# medir, nueva_pieza, ref y topologia de catia_base (el del repo); 2) cuerpo(c, reg) devuelve ctx (doc, part, body,
# el plano del asa para ocultarlo y el volumen ANTES del R1 del asa, que es lo que mide el gemelo); la masa, la
# captura y el STEP los hace el catia.py; 3) sin el bloque __main__.
"""ej30 — Too Tall Toby Party Pack 01-02 «Post Cap» en CATIA (plano libre para uso educativo, @tootalltoby).
Shaft del perfil de afuera (D49 x 48, borde de arriba en cuarto de elipse 20 x 8), Rib del asa (elipse 4 x 10 por un
arco R17 con centro a 15 del eje y 20 de abajo), Groove del hueco (D42, alto 37, 4 grados) y R3 arriba del hueco.
ABS 1020 kg/m3. Respuesta: 43,09 g. Gemelo build123d sin los R1 del asa: 42 225,726 mm3 = 43,07 g.
Plano ZX del croquis: H -> Z, V -> X (sonda del ej03). CATIA_MIRAR=lento para que Fak lo vea."""
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia

PI = math.pi
DENS = 1.02e-3
T4 = math.tan(math.radians(4))


def linea(f, p, a, b):
    ln = f.CreateLine(a[0], a[1], b[0], b[1])
    ln.StartPoint, ln.EndPoint = p[a], p[b]
    return ln


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej30_post_cap")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"planos": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def tapa():
        sk = body.Sketches.Add(ref(part, o.PlaneZX))
        f = sk.OpenEdition()
        pts = [(0, 0), (0, 24.5), (40, 24.5), (48, 4.5), (48, 0)]
        p = {q: f.CreatePoint(*q) for q in pts}
        linea(f, p, (0, 0), (0, 24.5))
        linea(f, p, (0, 24.5), (40, 24.5))
        # cuarto de elipse: centro (z 40, x 4,5), eje mayor 20 sobre X (V), menor 8 sobre Z (H);
        # parametro 0 = (40, 24.5), -pi/2 = (48, 4.5)
        el = f.CreateEllipse(40.0, 4.5, 0.0, 1.0, 20.0, 8.0, -PI / 2, 0.0)
        el.CenterPoint = f.CreatePoint(40.0, 4.5)
        el.StartPoint, el.EndPoint = p[(48, 4.5)], p[(40, 24.5)]
        linea(f, p, (48, 4.5), (48, 0))
        eje = linea(f, p, (48, 0), (0, 0))
        sk.CenterLine = eje
        sk.CloseEdition()
        part.Update()
        sh = sf.AddNewShaft(sk)
        sh.FirstAngle.Value = 360.0
        part.Update()
        cuenta = PI * 24.5 ** 2 * 40 + PI * 4.5 ** 2 * 8 + 2 * PI * (4.5 * 20 * 8 * PI / 4 + 20 * 8 * 8 / 6 * 20 / 8 * 0)
        return {"vol": vol()}
    reg.paso("tapa por revolucion (borde de arriba eliptico 20 x 8)", tapa)

    def asa():
        v0 = vol()
        camino = body.Sketches.Add(ref(part, o.PlaneZX))
        f = camino.OpenEdition()
        a = f.CreateCircle(20.0, -15.0, 17.0, -PI, 0.0)          # de abajo (z 3) por afuera (x -32) a arriba (z 37)
        a.CenterPoint = f.CreatePoint(20.0, -15.0)
        a.StartPoint, a.EndPoint = f.CreatePoint(3.0, -15.0), f.CreatePoint(37.0, -15.0)
        camino.CloseEdition()
        part.Update()
        pl = hsf.AddNewPlaneOffset(ref(part, o.PlaneYZ), -15.0, False)    # normal al arco en su arranque (x = -15)
        body.InsertHybridShape(pl)
        ctx["planos"].append(pl)
        part.Update()
        perfil = body.Sketches.Add(ref(part, pl))
        f = perfil.OpenEdition()
        e = f.CreateClosedEllipse(0.0, 3.0, 1.0, 0.0, 5.0, 2.0)      # YZ: H -> Y (10), V -> Z (4, radial al arco)
        e.CenterPoint = f.CreatePoint(0.0, 3.0)
        perfil.CloseEdition()
        part.Update()
        sf.AddNewRib(perfil, camino)
        part.Update()
        return {"suma": round(vol() - v0, 3)}
    reg.paso("asa: Rib de una elipse 4 x 10 por el arco R17", asa)

    def hueco():
        v0 = vol()
        sk = body.Sketches.Add(ref(part, o.PlaneZX))
        f = sk.OpenEdition()
        pts = [(-1, 0), (-1, 21 + T4), (37, 21 - 37 * T4), (37, 0)]
        p = {q: f.CreatePoint(*q) for q in pts}
        for i in range(3):
            linea(f, p, pts[i], pts[i + 1])
        eje = linea(f, p, pts[3], pts[0])
        sk.CenterLine = eje
        sk.CloseEdition()
        part.Update()
        g = sf.AddNewGroove(sk)
        g.FirstAngle.Value = 360.0
        part.Update()
        v1 = vol()
        ar = [d for d in topologia(doc, g, "Edge") if "cdg" in d and abs(d["cdg"][2] - 37) < 0.01 and d.get("medida", 0) > 60]
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(ar[0]["ref"], 0, 3.0)
        part.Update()
        return {"saca_hueco": round(v0 - v1, 3), "aristas_r3": len(ar), "saca_r3_negativo": round(v1 - vol(), 3)}
    reg.paso("hueco: Groove D42 con 4 grados + R3 arriba", hueco)

    def r1_asa():
        # aristas donde el asa toca la pared de afuera (radio 24,5 en el plano XY) y a la altura del asa
        v0 = vol()
        ctx["vol_sin_r1"] = v0
        ar = topologia(doc, body, "Edge")
        cand = [d for d in ar if "cdg" in d and abs(math.hypot(d["cdg"][0], d["cdg"][1]) - 24.5) < 1.0
                and d["cdg"][0] < -15 and 1 < d["cdg"][2] < 40]
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(cand[0]["ref"], 0, 1.0)
        for d in cand[1:]:
            fi.AddObjectToFillet(d["ref"])
        part.Update()
        return {"aristas": len(cand), "suma": round(vol() - v0, 3),
                "donde": [[round(x, 1) for x in d["cdg"]] for d in cand]}
    reg.paso("R1 donde el asa se junta con la tapa", r1_asa)

    ctx.update(doc=doc, part=part, body=body, sf=sf, vol=vol)
    return ctx


