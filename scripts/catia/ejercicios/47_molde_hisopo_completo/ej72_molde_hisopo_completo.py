# -*- coding: utf-8 -*-
"""ej72 — el molde del ej71 con lo que pide la solucion (a) del MIT 2.008 (banco E13): BEBEDERO desde la cara de
arriba, CANAL en el plano de particion, COMPUERTA en el medio del hisopo (el plastico fluye parejo a los dos lados) y
PINES EXPULSORES en la mitad de abajo. (El corredizo del mango hueco queda para el ej73.)
Controles con build123d sobre el STEP de CATIA (otra herramienta):
  1. la COLADA (pieza + canal + bebedero) es UN solo solido: el plastico llega de la boca a la cavidad;
  2. la boca del bebedero llega a la cara de arriba del molde (z = 15);
  3. cada expulsor TOCA la pieza (area de contacto > 0, con uniones.contacto) y vive solo en la mitad de abajo (z <= 0);
  4. gemelo: un canal corto que no llega a la pieza tiene que dar DOS solidos (rojo)."""
import json
import math
import os
import subprocess

from catia_base import correr, nueva_pieza, ref, medir, poligono, captura, guardar_pieza, VENV_CAD

RC, LC, RB, LB = 4.3, 15.4, 1.5, 33.3
BX0, BX1, BY, BZ = -10.0, 58.7, 15.0, 15.0
XG = (LC + LB) / 2            # compuerta al medio del largo total: 24,35 (sobre el cuerpo O3)
YS, RR, RS = 10.0, 1.5, 2.0   # bebedero en y = 10; canal O3; bebedero O4
EXP = ((LC / 2, 2.0), (LC + LB * 0.7, 0.75))   # (x, radio): uno bajo la cabeza, uno bajo el cuerpo

CONTROL = r"""
import sys, json
sys.path.insert(0, sys.argv[2])
from build123d import import_step, Pos, Box, Cylinder, Rot
import uniones
sol = import_step(sys.argv[1]).solids()
sol = sorted(sol, key=lambda s: -s.volume)
colada, exps = sol[0], sol[1:]
bb = colada.bounding_box()
out = {"solidos_en_el_archivo": len(sol), "boca_z": round(bb.max.Z, 3), "expulsores": []}
for e in exps:
    eb = e.bounding_box()
    out["expulsores"].append({"solape_mm3": round(uniones.volumen(e, colada), 4),
                              "contacto_mm2": round(uniones.contacto(e, colada), 2), "z_max": round(eb.max.Z, 3)})
# gemelo: el canal corto (termina en y = 3, no llega a la pieza en y = 1,5)
pieza = Pos(0, 0, 0) * Rot(0, 90, 0) * Cylinder(4.3, 15.4, align=None)
corto = Pos(24.35, 3 + 7 / 2 , 0) * Rot(90, 0, 0) * Cylinder(1.5, 7)
cuerpo = Pos(15.4 + 33.3 / 2, 0, 0) * Rot(0, 90, 0) * Cylinder(1.5, 33.3)
g = (Pos(7.7, 0, 0) * Rot(0, 90, 0) * Cylinder(4.3, 15.4)) + cuerpo + corto
out["gemelo_canal_corto_solidos"] = len(g.solids())
print(json.dumps(out))
"""


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej72_molde_hisopo")
    o = part.OriginElements
    hsf = part.HybridShapeFactory
    est = {}

    def body(nombre):
        b = part.Bodies.Add()
        b.Name = nombre
        part.InWorkObject = b
        return b

    def pad_circulo(b, plano, h, v, r, largo, quiero, eje):
        """Pad de un circulo y se elige el sentido MIDIENDO: quiero = +1 / -1 en el eje (0 x, 1 y, 2 z)."""
        sk = b.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        f.CreateClosedCircle(float(h), float(v), float(r))
        sk.CloseEdition()
        part.Update()
        p = sf.AddNewPad(sk, float(largo))
        part.Update()
        if medir(doc, part, b)["cdg_mm"][eje] * quiero < 0:
            p.DirectionOrientation = 1 - p.DirectionOrientation
            part.Update()
        return medir(doc, part, b)

    def hisopo(b):
        sk = b.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        sk.CenterLine = f.CreateLine(-5.0, 0.0, 60.0, 0.0)
        poligono(f, [(0, 0), (LC + LB, 0), (LC + LB, RB), (LC, RB), (LC, RC), (0, RC)])
        sk.CloseEdition()
        part.Update()
        sf.AddNewShaft(sk).FirstAngle.Value = 360.0
        part.Update()

    def colada():
        b = body("colada")
        hisopo(b)
        v_pieza = medir(doc, part, b)["volume"]
        # canal: circulo en el plano ZX (H = Z, V = X) en x = XG, hacia +Y hasta el bebedero
        cn = body("canal")
        mc = pad_circulo(cn, o.PlaneZX, 0.0, XG, RR, YS, +1, 1)
        # bebedero: circulo en XY en (XG, YS), hacia +Z hasta la cara de arriba
        bb = body("bebedero")
        mb = pad_circulo(bb, o.PlaneXY, XG, YS, RS, BZ, +1, 2)
        part.InWorkObject = b
        sf.AddNewAdd(cn)
        sf.AddNewAdd(bb)
        part.Update()
        est["colada"] = b
        return {"pieza": round(v_pieza, 3), "canal_cdg": [round(x, 2) for x in mc["cdg_mm"]],
                "bebedero_cdg": [round(x, 2) for x in mb["cdg_mm"]], "colada": round(medir(doc, part, b)["volume"], 3)}
    reg.datos["colada"] = reg.paso("colada = hisopo + canal + bebedero (compuerta al medio)", colada)

    def expulsores():
        est["exp"] = []
        out = []
        for k, (x, r) in enumerate(EXP):
            e = body(f"expulsor_{k}")
            pad_circulo(e, o.PlaneXY, x, 0.0, r, BZ, -1, 2)
            # la punta COPIA la forma de la pieza: se le resta un hisopo (cuerpo aparte, Remove lo consume)
            h = body(f"forma_{k}")
            hisopo(h)
            part.InWorkObject = e
            sf.AddNewRemove(h)
            part.Update()
            m = medir(doc, part, e)
            est["exp"].append(e)
            out.append({"x": x, "r": r, "cdg_z": round(m["cdg_mm"][2], 2)})
        return out
    reg.datos["expulsores"] = reg.paso("pines expulsores en la mitad de abajo", expulsores)
    reg.datos["step"] = reg.paso("STEP de colada + expulsores (antes del molde)",
                                 lambda: guardar_pieza(doc, reg, "ej72_colada", step=True))

    def control():
        # CAMBIO 1 (banco de CATIA, 24/10/2026): la carpeta de la skill sale del repo, no de una ruta escrita a mano
        # (con BARACK_REPO como el juez comun: el paquete del obrero no trae .claude/skills)
        skill = os.path.join(os.environ.get("BARACK_REPO") or os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))), ".claude", "skills", "cad-design", "scripts")
        r = subprocess.run([VENV_CAD, "-I", "-c", CONTROL, reg.datos["step"]["step"], skill], capture_output=True, text=True)
        j = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
        ok = (j["solidos_en_el_archivo"] == 1 + len(EXP) and abs(j["boca_z"] - BZ) < 1e-3
              and all(e["solape_mm3"] < 1e-3 and e["contacto_mm2"] > 1.0 and e["z_max"] <= 1e-3 for e in j["expulsores"])
              and j["gemelo_canal_corto_solidos"] == 2)
        j["veredicto"] = "OK" if ok else "NO CIERRA"
        if not ok:
            raise RuntimeError(json.dumps(j))
        return j
    reg.datos["control"] = reg.paso("el plastico llega y los expulsores tocan (build123d)", control)

    def molde():
        part.InWorkObject = main
        sk = main.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, [(BX0, -BY), (BX1, -BY), (BX1, BY), (BX0, BY)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, BZ)
        pad.SecondLimit.Dimension.Value = BZ
        part.Update()
        sf.AddNewRemove(est["colada"])
        for e in est["exp"]:
            sf.AddNewRemove(e)
        part.Update()
        sp = sf.AddNewSplit(ref(part, o.PlaneXY), 1)
        part.Update()
        m = medir(doc, part, main)
        if m["cdg_mm"][2] > 0:                       # quiero la mitad de ABAJO (la de los expulsores)
            sp.SplitSide = 0 if sp.SplitSide else 1
            part.Update()
            m = medir(doc, part, main)
        captura(c, reg, "ej72_mitad_abajo", vistas=("arriba", "iso"))
        return {"vol_mitad_abajo": round(m["volume"], 3), "cdg_z": round(m["cdg_mm"][2], 2)}
    reg.datos["molde"] = reg.paso("molde: bloque - colada - expulsores, mitad de abajo", molde)


if __name__ == "__main__":
    correr("ej72_molde_hisopo_completo", cuerpo, visible=os.environ.get("CATIA_MIRAR") in ("1", "lento"))
