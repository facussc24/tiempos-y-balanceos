# -*- coding: utf-8 -*-
# Origen: ej54_sm_hanger.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 8). Cambios para el ejercicio 31 del banco de CATIA (24/10/2026), nada mas: 1) no importa
# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y lo de construccion: 1
# llamada a InsertHybridShape que corre dos veces, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el
# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script, sin tocar nada mas).
"""ej54 — Too Tall Toby 23-02-02 «SM Hanger» (chapa de 4) en CATIA como SOLIDO: esta R21 no tiene la biblioteca de chapa
por COM (medido 19/10: ninguna typelib de Sheet Metal; la SMT es DMU Optimizer). Un cuarto (x >= 0, y >= 0) y dos simetrias:
1. costado: perfil grueso (R7 afuera, R3 adentro) pad 40 en +Y; 2. doblez de abajo + pie: pad 40..56,26;
3. ensanche de la pata: triangulo plano (Fill) + ThickSurface 4 hacia el espesor; 4. R7 en la esquina del pie;
5. ala: perfil grueso en YZ pad 55 en +X + R7 en su punta; 6. ventana 30 x 30 con R7 y ranura R10 (desde z 65, 40 hacia
abajo) y ranura R10 desde abajo (40 hacia arriba); 7. oreja: perfil grueso en ZX pad 8 + R5 + Ø10; 8. simetrias YZ y XZ.
Respuesta publicada 1028 g +/- 10; la referencia de la guia (corrida aca) da 131 756,349 mm3 = 1027,70 g."""
import json
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia
from croquis import centro_agregado, dibujar

DENS = 7.8e-3
AQUI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ej54_sm_hanger")
REF_VOL = 131756.349


def tramos(n):
    return [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:])
            for t in json.load(open(os.path.join(AQUI, n + ".json")))]


def ventana_y_ranura():
    return [("L", (20, -15), (43, -15)), ("A", (43, -8), 7.0, (43, -15), (50, -8)), ("L", (50, -8), (50, 8)),
            ("A", (43, 8), 7.0, (50, 8), (43, 15)), ("L", (43, 15), (20, 15)), ("L", (20, 15), (20, -15))]


def ranura(c0, c1, r=10.0):
    return [("L", (c0, -r), (c1, -r)), ("A", (c1, 0), r, (c1, -r), (c1 + r, 0)), ("A", (c1, 0), r, (c1 + r, 0), (c1, r)),
            ("L", (c1, r), (c0, r)), ("A", (c0, 0), r, (c0, r), (c0 - r, 0)), ("A", (c0, 0), r, (c0 - r, 0), (c0, -r))]


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej54_sm_hanger")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass
    sel = doc.Selection

    def m():
        return medir(doc, part, main)

    def plano(base, d):
        if d == 0:
            return base
        p = hsf.AddNewPlaneOffset(ref(part, base), float(d), False)
        main.InsertHybridShape(p)
        ctx["construccion"].append(p)
        part.Update()
        return p

    def croq(pl, dib):
        sk = main.Sketches.Add(ref(part, pl))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def operar(nombre, crear, eje, signo, base):
        """Crea pad/pocket; si el centro de lo agregado (o sacado) no queda del lado pedido del plano, lo da vuelta."""
        m0 = m() if main.Shapes.Count else {"volume": 0.0, "cdg_mm": [0, 0, 0]}
        op = crear()
        part.Update()
        ca = centro_agregado(m0, m()) if m0["volume"] else m()["cdg_mm"]
        if ca is None or (ca[eje] - base) * signo < 0:
            op.DirectionOrientation = 1 - op.DirectionOrientation
            part.Update()
            ca = centro_agregado(m0, m()) if m0["volume"] else m()["cdg_mm"]
        op.Name = nombre
        return {"vol": round(m()["volume"], 3), "centro_cambio": [round(x, 2) for x in ca] if ca else None}

    def redondear(nombre, cdg, largo, r):
        cand = [d for d in topologia(doc, main, "Edge") if "cdg" in d
                and all(abs(d["cdg"][i] - cdg[i]) < 0.05 for i in range(3)) and abs(d.get("medida", 0) - largo) < 0.05]
        v0 = m()["volume"]
        for d in cand:
            fi = None
            try:
                fi = sf.AddNewSolidEdgeFilletWithConstantRadius(d["ref"], 0, r)
                part.Update()
                fi.Name = nombre
                return {"aristas": len(cand), "saca": round(v0 - m()["volume"], 3)}
            except Exception:  # noqa: BLE001
                if fi is not None:
                    sel.Clear()
                    sel.Add(fi)
                    sel.Delete()
                    part.Update()
        raise RuntimeError(f"{nombre}: ninguna arista sirvio ({len(cand)} candidatas en {cdg}, largo {largo})")

    reg.datos["costado"] = reg.paso("costado: perfil grueso pad 40 en +Y", lambda: operar(
        "Costado", lambda: sf.AddNewPad(croq(o.PlaneZX, lambda f: dibujar(f, tramos("lado"))), 40.0), 1, +1, 0.0))
    reg.datos["pie"] = reg.paso("doblez de abajo + pie: pad y 40..56,26", lambda: operar(
        "Pie_ancho", lambda: sf.AddNewPad(croq(plano(o.PlaneZX, 40), lambda f: dibujar(f, tramos("pie"))), 16.26), 1, +1, 40.0))

    def triangulo():
        t = json.load(open(os.path.join(AQUI, "triangulo.json")))
        gs = part.HybridBodies.Add()
        gs.Name = "Ensanche_pata"
        pts = [hsf.AddNewPointCoord(*p) for p in t["p"]]
        for p in pts:
            gs.AppendHybridShape(p)
        lineas = []
        for i in range(3):
            ln = hsf.AddNewLinePtPt(ref(part, pts[i]), ref(part, pts[(i + 1) % 3]))
            gs.AppendHybridShape(ln)
            lineas.append(ln)
        part.Update()
        fl = hsf.AddNewFill()
        for ln in lineas:
            fl.AddBound(ref(part, ln))
        gs.AppendHybridShape(fl)
        part.Update()
        area = medir(doc, part, fl)["area"]
        part.InWorkObject = main
        n = t["normal_espesor"]
        m0 = m()
        th = sf.AddNewThickSurface(ref(part, fl), 0, 4.0, 0.0)
        part.Update()
        ca = centro_agregado(m0, m())
        cf = medir(doc, part, fl)["cdg_mm"]
        lado = sum((ca[i] - cf[i]) * n[i] for i in range(3)) if ca else -1
        if lado < 0:                                  # tiene que crecer hacia el espesor (la derecha de la linea): se borra
            sel.Clear()                               # y se rehace del otro lado (sus propiedades no se cambian por COM)
            sel.Add(th)
            sel.Delete()
            part.Update()
            th = sf.AddNewThickSurface(ref(part, fl), 1, 4.0, 0.0)
            part.Update()
            ca = centro_agregado(m0, m())
            lado = sum((ca[i] - cf[i]) * n[i] for i in range(3))
        th.Name = "Ensanche_pata"
        return {"area_triangulo": area, "suma": round(m()["volume"] - m0["volume"], 3), "cuenta_area_x4": round(area * 4, 3),
                "lado_bien": lado > 0}
    reg.datos["triangulo"] = reg.paso("ensanche de la pata: triangulo + ThickSurface 4", triangulo)
    reg.datos["r7_pie"] = reg.paso("R7 en la esquina del pie", lambda: redondear("R7_pie", (85.0, 56.26, 2.0), 4.0, 7.0))

    reg.datos["ala"] = reg.paso("ala: perfil grueso en YZ pad 55 en +X", lambda: operar(
        "Ala", lambda: sf.AddNewPad(croq(o.PlaneYZ, lambda f: dibujar(f, tramos("ala"))), 55.0), 0, +1, 0.0))

    def r7_ala():
        aristas = [d for d in topologia(doc, main, "Edge") if "cdg" in d and abs(d["cdg"][0] - 55) < 0.05
                   and abs(d.get("medida", 0) - 4) < 0.05]
        baja = min(aristas, key=lambda d: d["cdg"][2])
        return redondear("R7_ala", tuple(baja["cdg"]), 4.0, 7.0)
    reg.datos["r7_ala"] = reg.paso("R7 en la punta del ala (arista de abajo)", r7_ala)

    reg.datos["ventana"] = reg.paso("ventana 30 x 30 R7 + ranura R10 (z 65, 40 hacia abajo)", lambda: operar(
        "Ventana_y_ranura", lambda: sf.AddNewPocket(croq(plano(o.PlaneXY, 65), lambda f: (
            dibujar(f, ventana_y_ranura()), dibujar(f, ranura(77, 231)))), 40.0), 2, -1, 65.0))
    reg.datos["ranura_abajo"] = reg.paso("ranura R10 desde abajo (40 hacia arriba)", lambda: operar(
        "Ranura_abajo", lambda: sf.AddNewPocket(croq(o.PlaneXY, lambda f: dibujar(f, ranura(103, 309))), 40.0), 2, +1, 0.0))

    reg.datos["oreja"] = reg.paso("oreja: perfil grueso en ZX pad 8 en +Y", lambda: operar(
        "Oreja", lambda: sf.AddNewPad(croq(o.PlaneZX, lambda f: dibujar(f, tramos("oreja"))), 8.0), 1, +1, 0.0))
    reg.datos["r5"] = reg.paso("R5 en la punta de la oreja", lambda: redondear("R5_oreja", (26.0, 8.0, 88.0), 4.0, 5.0))

    def agujero():
        v0 = m()["volume"]

        def dib(f):
            k = f.CreateClosedCircle(0.0, 80.0, 5.0)
            k.CenterPoint = f.CreatePoint(0.0, 80.0)
        pk = sf.AddNewPocket(croq(o.PlaneYZ, dib), 60.0)
        pk.IsSymmetric = True
        part.Update()
        pk.Name = "D10"
        return {"saca": round(v0 - m()["volume"], 3), "cuenta_media_oreja": round(math.pi * 25 * 4 / 2, 3)}
    reg.datos["d10"] = reg.paso("Ø10 de la oreja (simetrico, eje X)", agujero)

    def simetrias():
        out = {"cuarto": round(m()["volume"], 3)}
        sf.AddNewMirror(ref(part, o.PlaneYZ))
        part.Update()
        out["medio"] = round(m()["volume"], 3)
        sf.AddNewMirror(ref(part, o.PlaneZX))
        part.Update()
        v = m()["volume"]
        out.update(vol=round(v, 3), masa_g=round(v * DENS, 2), referencia=REF_VOL, publicada="1028 +/- 10",
                   dif_ref=round(v - REF_VOL, 3))
        return out
    reg.datos["resultado"] = reg.paso("simetrias YZ y XZ + masa", simetrias)
    ctx.update(doc=doc, part=part, body=main, sf=sf)
    return ctx
