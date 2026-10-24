# -*- coding: utf-8 -*-
"""ej31b — Light Cap (Too Tall Toby 01-10) en CATIA por la SECCION DE PARED: el Shell 8 no abre la base cuando quedo partida
en 3 caras (medio + dos puntas; dbg_shell.py, 19/10: con una cara anda, con las tres falla en cualquier orden).
Pared = afuera (arco R40 centro z 6 + lados tangentes desde +-42) menos adentro (lo mismo corrido 8: arco R32 y rectas
paralelas a 8) cortado por el techo z 30 con R8; extruida simetrica 100 y la media seccion revolucionada 180 en y +-50.
Respuesta 211,30 g; gemelo 207 159,364 mm3. Croquis ZX: H -> Z, V -> X."""
import math
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref

DENS = 1.02e-3
C = (6.0, 0.0)            # centro de los arcos en (H = z, V = x)


def geometria():
    px, pz = 42.0, 0.0
    dx, dz = 0.0 - px, 6.0 - pz
    d = math.hypot(dx, dz)
    ang = math.atan2(dz, dx) - math.asin(40.0 / d)
    L = math.sqrt(d * d - 1600.0)
    T = (pz + L * math.sin(ang), px + L * math.cos(ang))              # (z, x) contacto de afuera
    Tin = (6.0 + 0.8 * (T[0] - 6.0), 0.8 * T[1])                    # mismo radio, R32
    u = ((T[0] - 0.0) / L, (T[1] - 42.0) / L)                        # direccion de la recta de afuera (z, x), hacia arriba
    Bin = (0.0, Tin[1] - Tin[0] / u[0] * u[1])                       # recta de adentro (paralela) en z = 0
    xf = math.sqrt(24.0 ** 2 - 16.0 ** 2)                            # centro del R8: a 8 del techo y a 24 del centro
    F1 = (30.0, xf)
    F2 = (6.0 + 16.0 * 32.0 / 24.0, xf * 32.0 / 24.0)
    CF = (22.0, xf)
    return T, Tin, Bin, F1, F2, CF


def dibujar(f, segs, ptos):
    P = {}

    def pt(q):
        k = (round(q[0], 9), round(q[1], 9))
        if k not in P:
            P[k] = f.CreatePoint(*q)
        return P[k]
    obj = []
    for s in segs:
        if s[0] == "L":
            _, a, b = s
            ln = f.CreateLine(a[0], a[1], b[0], b[1])
            ln.StartPoint, ln.EndPoint = pt(a), pt(b)
            obj.append(ln)
        else:
            _, cc, r, a, b = s
            ta = math.atan2(a[1] - cc[1], a[0] - cc[0])
            tb = math.atan2(b[1] - cc[1], b[0] - cc[0])
            if (tb - ta) % (2 * math.pi) < math.pi:
                ini, fin, pa, pb = ta, tb, a, b
            else:
                ini, fin, pa, pb = tb, ta, b, a
            if fin < ini:
                fin += 2 * math.pi
            ar = f.CreateCircle(cc[0], cc[1], r, ini, fin)
            ar.CenterPoint = f.CreatePoint(*cc)
            ar.StartPoint, ar.EndPoint = pt(pa), pt(pb)
            obj.append(ar)
    return obj


def espejo(q):
    return (q[0], -q[1])


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej31b_light_cap")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass
    T, Tin, Bin, F1, F2, CF = geometria()
    reg.datos["puntos"] = {"T": T, "Tin": Tin, "Bin": Bin, "F1": F1, "F2": F2}
    A0, BASE = (46.0, 0.0), (0.0, 42.0)

    def vol():
        return medir(doc, part, body)["volume"]

    def lado(m):
        """Tramos del lado derecho (m = identidad) o izquierdo (m = espejo), de la cima de afuera al techo de adentro."""
        return [("L", m(T), m(BASE)), ("L", m(BASE), m(Bin)), ("L", m(Bin), m(Tin)),
                ("A", C, 32.0, m(Tin), m(F2)), ("A", m(CF), 8.0, m(F2), m(F1))]

    def medio():
        sk = body.Sketches.Add(ref(part, o.PlaneZX))
        f = sk.OpenEdition()
        segs = [("A", C, 40.0, espejo(T), T)] + lado(lambda q: q) + [("L", F1, espejo(F1))]
        segs += [s if s[0] == "L" else s for s in reversed(lado(espejo))]
        dibujar(f, segs, None)
        sk.CloseEdition()
        part.Update()
        pd = sf.AddNewPad(sk, 50.0)
        pd.IsSymmetric = True
        part.Update()
        return {"vol": vol(), "area_seccion": round(vol() / 100, 3)}
    reg.paso("pared del medio: seccion extruida simetrica 100", medio)

    def puntas():
        out = []
        for y in (50.0, -50.0):
            pl = hsf.AddNewPlaneOffset(ref(part, o.PlaneZX), y, False)
            body.InsertHybridShape(pl)
            part.Update()
            sk = body.Sketches.Add(ref(part, pl))
            f = sk.OpenEdition()
            ob = dibujar(f, [("A", C, 40.0, A0, T)] + lado(lambda q: q) + [("L", F1, (30.0, 0.0)), ("L", (30.0, 0.0), A0)], None)
            sk.CenterLine = ob[-1]
            sk.CloseEdition()
            part.Update()
            va = vol()
            sh = sf.AddNewShaft(sk)
            sh.FirstAngle.Value, sh.SecondAngle.Value = 180.0, 0.0
            part.Update()
            # hacia adentro TAMBIEN suma algo (lo que la revolucion no comparte con la extrusion): se prueban los dos
            # sentidos y queda el que agrega mas (19/10: el control «< 1000» dejo pasar el sentido equivocado)
            a1 = vol() - va
            sh.FirstAngle.Value, sh.SecondAngle.Value = 0.0, 180.0
            part.Update()
            if vol() - va < a1:
                sh.FirstAngle.Value, sh.SecondAngle.Value = 180.0, 0.0
                part.Update()
            out.append(round(vol() - va, 3))
        return {"puntas": out, "vol": vol()}
    reg.paso("puntas: media seccion revolucionada 180 hacia afuera", puntas)

    def final():
        v = vol()
        return {"vol": v, "masa_g": round(v * DENS, 2), "oficial": 211.30, "gemelo": 207159.364}
    reg.datos["resultado"] = reg.paso("volumen y masa", final)
    reg.paso("captura", lambda: captura(c, reg, "ej31b", vistas=("iso", "abajo")))
    reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej31b_light_cap"))


if __name__ == "__main__":
    correr("ej31b_light_cap", cuerpo, visible=os.environ.get("CATIA_MIRAR") == "1")
