# -*- coding: utf-8 -*-
"""Ejercicio 51 del banco de CATIA (24/10/2026, CATA): el porta-bulon M6 de la plantilla de perforado del Insert (ejercicio 01
del banco 3D) rehecho EN CATIA con las mismas operaciones, en el mismo orden y con las mismas cotas que porta_bulon() del
generador de la nube (generador/porta_bulon.py de la v3 de la plantilla, 22/10/2026):

  1. cuerpo D22 x 3,8 (pad en +Z desde XY);  2. teton cuadrado 13,6 x 13,6 x 3,9 encima (plano en z 3,8);
  3. alojamiento hexagonal de 10,4 entre caras, 4,4 de alto desde abajo (vertices sobre el eje X, como RegularPolygon de
     build123d con major_radius: medido, (+-6,004; 0));
  4. puente 1: ranura (10,4 / 0,866 + 2) x 6,6 x 0,2 en z 4,4;  5. puente 2: cuadrado 6,6 x 6,6 x 0,2 en z 4,6;
  6. agujero D6,6 de z 4,8 hasta arriba (7,7);
  7. chaflan 0,5 en las aristas de arriba de largo > 5: las cuatro del teton Y el borde del agujero (medido en build123d);
  8. boca del hexagono: 10,4 + 2 x 0,4 entre caras, 0,4 de alto desde abajo."""
import math

from catia_base import MACRO_COG, evaluar, medir, nueva_pieza, ref, poligono, topologia

CUERPO_D, CUERPO_H = 22.0, 3.8
HEX_S, HEX_H, HEX_CHAF = 10.4, 4.4, 0.4
CAPA = 0.2
TETON, TETON_H = 13.6, 3.9
D_PASO = 6.6
CHAFLAN = 0.5
COS30 = 0.8660254                                   # el del generador
MIN_SACA = 1.0                                      # mm3: el vaciado mas chico (la boca) saca ~6


def hexagono(entre_caras):
    r = entre_caras / 2 / COS30                       # radio a las puntas (major_radius)
    return [(r * math.cos(math.radians(60 * i)), r * math.sin(math.radians(60 * i))) for i in range(6)]


def sacado(m0, m1):
    """Centro de lo que saco una operacion, de las dos mediciones (volumen y centro) antes y despues."""
    dv = m0["volume"] - m1["volume"]
    return None if dv <= 1e-6 else [(m0["volume"] * a - m1["volume"] * b) / dv for a, b in zip(m0["cdg_mm"], m1["cdg_mm"])]


def medir_fino(doc, part, body):
    """Volumen y centro SIN redondear (medir() de catia_base los redondea a 0,001): para el centro de lo que saca un
    vaciado chico. 51_r3: con el centro a 0,001 mm, la boca (6 mm3 de 1 612) dio z -0,04 en vez de +0,2 (el error se
    multiplica por V0 / dV ~ 270) y un margen para ese ruido dejo pasar el agujero al reves en 51_r4."""
    m = doc.GetWorkbench("SPAWorkbench").GetMeasurable(ref(part, body))
    return {"volume": m.Volume * 1e9,
            "cdg_mm": [float(x.replace(",", ".")) for x in evaluar(doc.Application, MACRO_COG, m).split(";")]}


def vaciado_mal(m0, m1, z0):
    """Un vaciado que tenia que sacar hacia +Z desde z0 y no lo hizo: el centro de lo sacado quedo en z0 o abajo (al reves
    queda en z0 - prof / 2) o no saco nada. 51_r4, con el centro redondeado y un margen para su ruido: la ranura salio al
    reves (saco 4,615 en vez de 17,952; su centro, 0,1 abajo del plano, cayo dentro del margen de ~0,4) y el agujero
    tambien (saco 6,842, la capa que la ranura dejo). Con la ranura bien, el agujero al reves no sacaria nada (cuenta: el
    circulo de 6,6 entra en el hueco del cuadrado, de la ranura y del hexagono): por eso el piso MIN_SACA."""
    cs, dv = sacado(m0, m1), m0["volume"] - m1["volume"]
    return cs is None or dv < MIN_SACA or cs[2] < z0 + 1e-3


def chaflan_saca_bien(saca, largos):
    """Un chaflan de CHAFLAN x CHAFLAN saca ~CHAFLAN^2 / 2 por mm de arista (las esquinas y el radio del agujero lo corren
    unos pocos por ciento): fuera de +-20 % es otro chaflan (51_r2: el de 0,5 con 0,5 GRADOS saco 0,082 mm3 y dio ok)."""
    esperado = CHAFLAN ** 2 / 2 * sum(largos)
    return 0.8 * esperado <= saca <= 1.2 * esperado


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "porta_bulon_M6")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": [], "z_sacado": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def plano_z(z):
        if z == 0:
            return o.PlaneXY
        pl = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), float(z), False)
        body.InsertHybridShape(pl)
        ctx["construccion"].append(pl)
        part.Update()
        return pl

    def croq(z, poligonos=(), circulos=()):
        sk = body.Sketches.Add(ref(part, plano_z(z)))
        f = sk.OpenEdition()
        for pts in poligonos:
            poligono(f, pts)
        for (x, y, r) in circulos:
            ci = f.CreateClosedCircle(x, y, r)
            ci.CenterPoint = f.CreatePoint(x, y)
        sk.CloseEdition()
        part.Update()
        return sk

    def vaciar(sk, prof, z0):
        """Vaciado que tiene que sacar hacia +Z desde z0 (el centro de lo sacado arriba de z0: leccion del 48)."""
        m0 = medir_fino(doc, part, body)
        pk = sf.AddNewPocket(sk, float(prof))
        part.Update()
        m1 = medir_fino(doc, part, body)
        if vaciado_mal(m0, m1, z0):
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
            m1 = medir_fino(doc, part, body)
        cs = sacado(m0, m1)
        if vaciado_mal(m0, m1, z0):
            raise RuntimeError(f"el vaciado desde z {z0} no saca hacia +Z ({cs})")
        ctx["z_sacado"].append(round(cs[2], 4))
        return round(m0["volume"] - m1["volume"], 4)

    def sumar(sk, alto, z0):
        m0 = medir(doc, part, body)
        pad = sf.AddNewPad(sk, float(alto))
        part.Update()
        m1 = medir(doc, part, body)
        if m1["cdg_mm"][2] < m0["cdg_mm"][2] - 1e-6 if m0["volume"] > 0 else m1["cdg_mm"][2] < z0:
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        return round(vol() - m0["volume"], 4)

    def base():
        sk = croq(0.0, circulos=[(0.0, 0.0, CUERPO_D / 2)])
        pad = sf.AddNewPad(sk, CUERPO_H)
        part.Update()
        if medir(doc, part, body)["cdg_mm"][2] < 0:
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        a = TETON / 2
        suma = sumar(croq(CUERPO_H, poligonos=[[(-a, -a), (a, -a), (a, a), (-a, a)]]), TETON_H, CUERPO_H)
        return {"vol": vol(), "teton": suma, "cuenta": round(math.pi * (CUERPO_D / 2) ** 2 * CUERPO_H + TETON ** 2 * TETON_H, 3)}
    reg.paso("cuerpo D22 x 3,8 + teton 13,6 x 3,9", base)

    def alojamiento():
        return {"hexagono": vaciar(croq(0.0, poligonos=[hexagono(HEX_S)]), HEX_H, 0.0),
                "cuenta": round(2 * math.sqrt(3) * (HEX_S / 2) ** 2 * HEX_H, 3)}
    reg.paso("alojamiento hexagonal 10,4 x 4,4 desde abajo", alojamiento)

    def puentes():
        lx = HEX_S / COS30 + 2
        p1 = vaciar(croq(HEX_H, poligonos=[[(-lx / 2, -D_PASO / 2), (lx / 2, -D_PASO / 2), (lx / 2, D_PASO / 2),
                                            (-lx / 2, D_PASO / 2)]]), CAPA, HEX_H)
        d = D_PASO / 2
        p2 = vaciar(croq(HEX_H + CAPA, poligonos=[[(-d, -d), (d, -d), (d, d), (-d, d)]]), CAPA, HEX_H + CAPA)
        z = HEX_H + 2 * CAPA
        p3 = vaciar(croq(z, circulos=[(0.0, 0.0, D_PASO / 2)]), CUERPO_H + TETON_H - z, z)
        return {"ranura": p1, "cuadrado": p2, "agujero": p3}
    reg.paso("puentes escalonados (ranura, cuadrado) y agujero D6,6", puentes)

    def chaflan():
        z = CUERPO_H + TETON_H
        ar = [d for d in topologia(doc, body, "Edge") if "cdg" in d and d.get("medida", 0) > 5]
        # una arista recta del teton tiene su punto medio en z 7,7; el borde del agujero es un circulo en z 7,7 (su
        # punto medio de curva tambien esta en z 7,7)
        arriba = [d for d in ar if abs(d["cdg"][2] - z) < 1e-3]
        if len(arriba) != 5:
            raise RuntimeError(f"arriba tiene que haber 5 aristas de mas de 5 mm (4 del teton y el agujero): hay "
                               f"{len(arriba)} {[d.get('medida') for d in arriba]}")
        v0 = vol()
        # 51_r1: las cinco en un solo chaflan dieron «Update failed»; en dos (las rectas del teton y el borde del agujero)
        # salieron (51_r3). Cada grupo prueba propagacion y modo, y un intento que falla o que saca otra cosa se BORRA
        # antes del siguiente (no se probo que pasa si queda: se borra para no arrastrarlo)
        rectas = [d for d in arriba if abs(d.get("medida", 0) - TETON) < 0.01]
        circulo = [d for d in arriba if d not in rectas]
        intentos = []
        for nombre, grupo in (("teton", rectas), ("agujero", circulo)):
            # modo 0 = largo + largo (K, K), el de la practica (ej84) y del 18; modo 1 = largo + ANGULO (ej28 del 19):
            # 51_r2 probo (1, 1, 0,5) = un chaflan de 0,5 con 0,5 grados y saco 0,082 mm3 en vez de ~9,4
            for prop, modo, l2 in ((0, 0, CHAFLAN), (1, 0, CHAFLAN), (0, 1, 45.0), (1, 1, 45.0)):
                ch = None
                va = vol()
                try:
                    ch = sf.AddNewChamfer(grupo[0]["ref"], prop, modo, 0, CHAFLAN, l2)
                    for d in grupo[1:]:
                        ch.AddElementToChamfer(d["ref"])
                    part.Update()
                    saca = round(va - vol(), 4)
                    if not chaflan_saca_bien(saca, [d["medida"] for d in grupo]):
                        raise RuntimeError(f"saca {saca} mm3, no es un chaflan de {CHAFLAN} x {CHAFLAN}")
                    intentos.append(f"{nombre}: prop {prop} modo {modo} ok, saca {saca}")
                    break
                except Exception as e:  # noqa: BLE001
                    intentos.append(f"{nombre}: prop {prop} modo {modo} {repr(e)[:60]}")
                    if ch is not None:
                        s = doc.Selection
                        s.Clear()
                        s.Add(ch)
                        s.Delete()
                        part.Update()
            else:
                raise RuntimeError(f"el chaflan del {nombre} no salio: {intentos}")
        return {"aristas": [d.get("medida") for d in arriba], "intentos": intentos, "saca": round(v0 - vol(), 4)}
    reg.paso("chaflan 0,5 en las aristas de arriba (teton y agujero)", chaflan)

    def boca():
        v = vaciar(croq(0.0, poligonos=[hexagono(HEX_S + 2 * HEX_CHAF)]), HEX_CHAF, 0.0)
        return {"saca": v, "z_de_lo_sacado_en_cada_vaciado": ctx["z_sacado"]}
    reg.paso("boca del hexagono 11,2 x 0,4 (chaflan contra el aplastado de la primera capa)", boca)

    ctx.update(doc=doc, part=part, body=body, sf=sf)
    return ctx
