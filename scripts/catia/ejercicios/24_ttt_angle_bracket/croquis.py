# -*- coding: utf-8 -*-
# Origen: croquis.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA por el
# PEDIDO 23), sin cambios: lo importan las piezas pieza_ej34/35/37/40 de los ejercicios 24, 26, 28 y 30 del banco de CATIA.
"""Croquis de CATIA por programa: perfiles de rectas y arcos atados a sus puntos, acotados contra los ejes con FORMULAS
sobre parametros (pieza parametrica), y los controles de sentido que hacen falta porque CATIA no avisa cuando una
operacion crece para el lado equivocado. Salio de la practica del 19/10 (ej27-ej31: examen CSWP de SolidWorks y piezas
de Too Tall Toby, todas contra la respuesta publicada). Uso: ver reference/catia.md, «Pieza parametrica».

Ejes de cada plano del croquis (sonda del ej03): XY -> H = X, V = Y;  YZ -> H = Y, V = Z;  ZX -> H = Z, V = X."""
import math

HORIZ, VERT, DIST, LARGO, RADIO, SOBRE = 10, 13, 1, 5, 14, 2      # CatConstraintType (enums.py CatConstraintType)


def angulos_arco(cc, a, b):
    """Arco < 180 grados de centro cc entre los puntos a y b (en coordenadas del croquis). CATIA dibuja de ini a fin en
    sentido antihorario: devuelve (ini, fin, punto_inicio, punto_fin) por el camino CORTO. Un arco de 180 justos no tiene
    camino corto: se pasa con angulos explicitos (ranura(), ej29)."""
    ta = math.atan2(a[1] - cc[1], a[0] - cc[0])
    tb = math.atan2(b[1] - cc[1], b[0] - cc[0])
    if abs(((tb - ta) % (2 * math.pi)) - math.pi) < 1e-9:
        raise ValueError("arco de 180 grados: el sentido es ambiguo, pasar los angulos a mano")
    if (tb - ta) % (2 * math.pi) < math.pi:
        ini, fin, pa, pb = ta, tb, a, b
    else:
        ini, fin, pa, pb = tb, ta, b, a
    if fin < ini:
        fin += 2 * math.pi
    return ini, fin, pa, pb


def dibujar(f, tramos):
    """tramos: ('L', a, b) recta, ('A', centro, radio, a, b) arco corto. Los puntos repetidos se comparten (perfil
    cerrado = los tramos atados por sus puntos; si no, CATIA no lo toma como cerrado). Devuelve los objetos en orden."""
    P = {}

    def pt(q):
        k = (round(q[0], 9), round(q[1], 9))
        if k not in P:
            P[k] = f.CreatePoint(q[0], q[1])
        return P[k]
    obj = []
    for t in tramos:
        if t[0] == "L":
            _, a, b = t
            ln = f.CreateLine(a[0], a[1], b[0], b[1])
            ln.StartPoint, ln.EndPoint = pt(a), pt(b)
            obj.append(ln)
        else:
            _, cc, r, a, b = t
            ini, fin, pa, pb = angulos_arco(cc, a, b)
            ar = f.CreateCircle(cc[0], cc[1], r, ini, fin)
            ar.CenterPoint = f.CreatePoint(cc[0], cc[1])
            ar.StartPoint, ar.EndPoint = pt(pa), pt(pb)
            obj.append(ar)
    return obj


def ranura(f, largo, ancho):
    """Ranura (estadio) centrada en el origen del croquis, largo y ancho TOTALES, puntas de radio ancho/2 (arcos de 180
    con angulos explicitos)."""
    r = ancho / 2
    L = largo / 2 - r
    p = [f.CreatePoint(-L, -r), f.CreatePoint(L, -r), f.CreatePoint(L, r), f.CreatePoint(-L, r)]
    l1 = f.CreateLine(-L, -r, L, -r)
    l1.StartPoint, l1.EndPoint = p[0], p[1]
    a1 = f.CreateCircle(L, 0.0, r, -math.pi / 2, math.pi / 2)
    a1.CenterPoint = f.CreatePoint(L, 0.0)
    a1.StartPoint, a1.EndPoint = p[1], p[2]
    l2 = f.CreateLine(L, r, -L, r)
    l2.StartPoint, l2.EndPoint = p[2], p[3]
    a2 = f.CreateCircle(-L, 0.0, r, math.pi / 2, 3 * math.pi / 2)
    a2.CenterPoint = f.CreatePoint(-L, 0.0)
    a2.StartPoint, a2.EndPoint = p[3], p[0]


def centro_agregado(m0, m1):
    """Centro de gravedad de lo que una operacion agrego (o saco) entre dos mediciones {'volume', 'cdg_mm'} del cuerpo.
    Sirve para saber HACIA DONDE crecio: un pad desde un plano corrido crecio para afuera en los dos cilindros del ej26
    sin dar error."""
    v0, v1 = m0["volume"], m1["volume"]
    if abs(v1 - v0) < 1e-9:
        return None
    return [(m1["cdg_mm"][i] * v1 - m0["cdg_mm"][i] * v0) / (v1 - v0) for i in range(3)]


def elegir_sentido(part, medir_vol, aplicar_a, aplicar_b, quiero="mas"):
    """Prueba las DOS orientaciones de una operacion y deja la que suma mas (o saca mas) volumen.
    SOLO SIRVE cuando el lado equivocado se mete en MATERIAL que ya existe (la revolucion de 180 hacia adentro del Light
    Cap suma 18 998 contra 41 620 hacia afuera, ej31b; un umbral fijo no la separaba). Cuando el lado equivocado da al
    AIRE suma MAS que el bueno (los cilindros del CSWP, ej26: al aire suman el cilindro entero, 514 695 contra 460 829
    hacia adentro del muro): ahi el control es centro_agregado() contra el plano del croquis (auditor Opus, 19/10).
    aplicar_a / aplicar_b ponen cada orientacion; medir_vol() mide el cuerpo. Devuelve (cual, volumen)."""
    if quiero not in ("mas", "menos"):
        raise ValueError(f"quiero = 'mas' o 'menos' (sin tilde), no {quiero!r}")
    aplicar_a()
    part.Update()
    va = medir_vol()
    aplicar_b()
    part.Update()
    vb = medir_vol()
    gana_b = vb > va if quiero == "mas" else vb < va
    if not gana_b:
        aplicar_a()
        part.Update()
        return "a", va
    return "b", vb


class Croquis:
    """Croquis acotado contra sus ejes con formulas sobre los parametros de la pieza (part.Parameters). Patron de la pieza
    parametrica del CSWP (ej27/ej28): cambiar SOLO los parametros dio las respuestas del examen a 0,02 g o menos (dos modelos: ej27 con 3, ej28 con 2).
    Las constantes de una formula llevan unidad («69mm»)."""

    def __init__(self, part, body, plano, nombre):
        self.part, self.nombre, self.n = part, nombre, 0
        self.sk = body.Sketches.Add(part.CreateReferenceFromObject(plano))
        self.f = self.sk.OpenEdition()
        ax = self.sk.AbsoluteAxis
        self.H, self.V, self.O = ax.HorizontalReference, ax.VerticalReference, ax.Origin
        self.ps, self.tramos, self.tipos, self.centros = [], [], [], {}

    def _r(self, o):
        return self.part.CreateReferenceFromObject(o)

    def perfil(self, pts, arcos):
        """pts en orden; arcos = {i: (cx, cy, r)} si el tramo i -> i+1 es un arco corto."""
        f = self.f
        self.ps = [f.CreatePoint(x, y) for x, y in pts]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            if i in arcos:
                cx, cy, rr = arcos[i]
                ini, fin, pa, pb = angulos_arco((cx, cy), pts[i], pts[j])
                t = f.CreateCircle(cx, cy, rr, ini, fin)
                key = (round(cx, 6), round(cy, 6))
                if key not in self.centros:
                    self.centros[key] = f.CreatePoint(cx, cy)
                t.CenterPoint = self.centros[key]
                t.StartPoint, t.EndPoint = (self.ps[i], self.ps[j]) if pa == pts[i] else (self.ps[j], self.ps[i])
                self.tipos.append("arco")
            else:
                (x1, y1), (x2, y2) = pts[i], pts[j]
                t = f.CreateLine(x1, y1, x2, y2)
                t.StartPoint, t.EndPoint = self.ps[i], self.ps[j]
                self.tipos.append("H" if abs(y1 - y2) < 1e-9 else "V" if abs(x1 - x2) < 1e-9 else "L")
            self.tramos.append(t)
        return self

    def circulo(self, cx, cy, r):
        self.circ = self.f.CreateClosedCircle(cx, cy, r)
        self.cp = self.f.CreatePoint(cx, cy)
        self.circ.CenterPoint = self.cp
        return self

    def cst(self, tipo, *objs):
        cs = self.sk.Constraints
        if len(objs) == 1:
            return cs.AddMonoEltCst(tipo, self._r(objs[0]))
        return cs.AddBiEltCst(tipo, self._r(objs[0]), self._r(objs[1]))

    def formula(self, cst, expr):
        self.n += 1
        self.part.Relations.CreateFormula(f"{self.nombre}_{self.n}", "", cst.Dimension, expr)

    def hv(self):
        """Horizontal / vertical en cada recta que lo es."""
        for t, tipo in zip(self.tramos, self.tipos):
            if tipo == "H":
                self.cst(HORIZ, t)
            elif tipo == "V":
                self.cst(VERT, t)

    def a_eje_V(self, obj, expr):
        """Distancia al eje vertical del croquis = coordenada H."""
        self.formula(self.cst(DIST, obj, self.V), expr)

    def a_eje_H(self, obj, expr):
        """Distancia al eje horizontal = coordenada V."""
        self.formula(self.cst(DIST, obj, self.H), expr)

    def sobre_H(self, punto):
        self.cst(SOBRE, punto, self.H)

    def en_origen(self, punto):
        self.cst(SOBRE, punto, self.O)

    def largo(self, recta, expr):
        self.formula(self.cst(LARGO, recta), expr)

    def radio(self, obj, expr):
        self.formula(self.cst(RADIO, obj), expr)

    def cerrar(self):
        self.sk.CloseEdition()
        self.part.Update()
        return self.sk
