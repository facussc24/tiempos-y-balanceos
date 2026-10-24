# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 11 del banco de CATIA (Tool Block parametrico, 24/10/2026).

1. El croquis declarado queda TOTALMENTE restringido (gdl = 0) y sacarle cualquier restriccion deja 1 grado libre
   (el conteo puede dar rojo).
2. Cada restriccion se cumple, con numeros, sobre la geometria de la q3 Y sobre la de la q4 (las formulas evaluadas con
   A y B de cada pregunta): si una tangencia, un punto sobre una recta o una formula estuviera mal, el croquis que CATIA
   regenera al cambiar los parametros no seria el del plano. Gemelo: el centro del R29 corrido 0,5 mm ya no esta sobre
   la diagonal.
3. Los puntos del croquis son los vertices del perfil de perfil_2d (el mismo recorrido que build123d).
4. construir() con una CATIA FALSA: parametros A, B, C; 34 restricciones; 8 formulas sobre A y B mas el largo C; el cambio
   de q3 a q4 toca SOLO los parametros; dos partes q3 y q4; el cdg de la q4 se corre 150 en x (bien.py) y el crudo queda;
   cerrar_con_masa da VERDE con las masas de la lamina 12 y ROJO con una a 2 g."""
import importlib.util
import json
import math
import os
import re
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ11 = os.path.join(CATIA_DIR, "ejercicios", "11_tool_block_parametrico")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, os.path.join(CATIA_DIR, "ejercicios", "07_tool_block_examen"))
import perfil_2d as p2  # noqa: E402

VOL_BIEN = {"q3": 118929.059, "q4": 130673.503}        # bien.py del 13 (test_tool_block_07.py)
TOL = 1e-6


def cargar():
    spec = importlib.util.spec_from_file_location("ej11_catia", os.path.join(EJ11, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def evaluar(expr, A, B):
    """«A - 29mm» -> A - 29 (las formulas de CATIA con la unidad pegada al numero)."""
    return eval(re.sub(r"(\d+(?:\.\d+)?)mm", r"\1", expr), {"__builtins__": {}}, {"A": A, "B": B})


def dist_recta(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    return abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / math.hypot(x2 - x1, y2 - y1)


def verificar(ej, A, B, cr=None):
    """Lista de (restriccion, error) con lo que NO se cumple sobre la geometria de A y B."""
    cr = cr or ej.croquis(A, B)
    P = cr["puntos"]
    rectas = {n: (P[a], P[b]) for n, a, b in cr["rectas"]}
    arcos = {n: (P[c], r) for n, c, r, *_ in cr["arcos"]}
    arcos.update({n: (P[c], r) for n, c, r in cr["circulos"]})
    malas = []
    for r_ in cr["restricciones"]:
        t = r_[0]
        if t in ("x", "y"):
            val = P[r_[1]][0 if t == "x" else 1]
            quiero = evaluar(r_[3], A, B) if r_[3] else r_[2]
            err = abs(val - quiero) + abs(r_[2] - quiero)
        elif t == "en_V":
            err = abs(P[r_[1]][0])
        elif t == "en_H":
            err = abs(P[r_[1]][1])
        elif t == "H":
            (a, b) = rectas[r_[1]]
            err = abs(a[1] - b[1])
        elif t == "angulo_H":
            (a, b) = rectas[r_[1]]
            ang = math.degrees(math.atan2(abs(b[1] - a[1]), abs(b[0] - a[0])))
            err = abs(ang - r_[2])
        elif t == "radio":
            err = abs(arcos[r_[1]][1] - r_[2])
        elif t == "tangente":
            a, b = r_[1], r_[2]
            if a in rectas or b in rectas:
                rec, arc = (rectas[a], arcos[b]) if a in rectas else (rectas[b], arcos[a])
                err = abs(dist_recta(arc[0], *rec) - arc[1])
            else:
                (c1, r1), (c2, r2) = arcos[a], arcos[b]
                d = math.dist(c1, c2)
                err = min(abs(d - (r1 + r2)), abs(d - abs(r1 - r2)))
        elif t == "sobre":
            err = dist_recta(P[r_[1]], *rectas[r_[2]])
        else:
            raise ValueError(t)
        if err > TOL:
            malas.append((r_, err))
    # las puntas de cada arco estan sobre su circunferencia (lo que gdl() descuenta)
    for n, c, r, a, b, _ in cr["arcos"]:
        for q in (a, b):
            if abs(math.dist(P[c], P[q]) - r) > TOL:
                malas.append((("punta", n, q), abs(math.dist(P[c], P[q]) - r)))
    return malas


class Croquis(unittest.TestCase):
    def test_totalmente_restringido_y_el_conteo_da_rojo(self):
        ej = cargar()
        cr = ej.croquis(81.0, 57.0)
        self.assertEqual(ej.gdl(cr), 0)
        self.assertEqual(len(cr["restricciones"]), 34)
        for i in range(len(cr["restricciones"])):
            menos = dict(cr, restricciones=cr["restricciones"][:i] + cr["restricciones"][i + 1:])
            self.assertEqual(ej.gdl(menos), 1)

    def test_cada_restriccion_se_cumple_en_q3_y_en_q4(self):
        ej = cargar()
        for _q, A, B, _C in ej.ESTADOS:
            self.assertEqual(verificar(ej, A, B), [], (A, B))

    def test_gemelo_centro_r29_corrido(self):
        ej = cargar()
        cr = ej.croquis(81.0, 57.0)
        x, y = cr["puntos"]["C29"]
        cr["puntos"]["C29"] = (x + 0.5, y)
        malas = [r_ for r_, _ in verificar(ej, 81.0, 57.0, cr)]
        self.assertIn(("sobre", "C29", "L8"), malas)

    def test_formulas_dependen_de_A_y_B(self):
        ej = cargar()
        cr = ej.croquis(81.0, 57.0)
        formulas = [r_ for r_ in cr["restricciones"] if r_[0] in ("x", "y") and r_[3]]
        self.assertEqual(len(formulas), 8)
        self.assertEqual({r_[1] for r_ in formulas}, {"P6", "P7", "P8", "P9", "P10"})

    def test_puntos_son_los_vertices_del_perfil(self):
        ej = cargar()
        for _q, A, B, _C in ej.ESTADOS:
            cr = ej.croquis(A, B)
            vert = {(round(t[1][0], 6), round(t[1][1], 6)) if t[0] == "L" else (round(t[3][0], 6), round(t[3][1], 6))
                    for t in p2.perfil(A, B)}
            nuestros = {(round(x, 6), round(y, 6)) for n, (x, y) in cr["puntos"].items() if not n.startswith("C")}
            self.assertEqual(vert, nuestros)

    def test_volumen_y_masa_por_pregunta(self):
        ej = cargar()
        for q, A, B, C in ej.ESTADOS:
            v = p2.geometria(3, A, B, C)["volumen"]
            self.assertLess(abs(v - VOL_BIEN[q]), 0.01)
            self.assertLess(abs(v * 7.86e-3 - ej.MASA_EXAMEN_G[q]), 0.01)


# ---------------------------------------------------------------- el solver, simulado (revisor Fable del 24/10)
# Lo que CATIA hace al cambiar A y B: parte de la q3 dibujada y resuelve las 34 restricciones + las 6 puntas de arco
# sobre su circunferencia (Newton). Si el croquis queda en la q4 de perfil_2d, las formulas y las restricciones alcanzan;
# esto no es circular: la q4 que sale del solver no se calcula con croquis(84, 59). Adaptado de
# scratchpad/rango_y_gemelos_11.py del revisor.
def _armar(cr):
    import numpy as np
    nombres = list(cr["puntos"])
    idx = {n: i for i, n in enumerate(nombres)}
    radios = [n for n, *_ in cr["arcos"]] + [n for n, *_ in cr["circulos"]]
    ridx = {n: 2 * len(nombres) + i for i, n in enumerate(radios)}
    x0 = np.zeros(2 * len(nombres) + len(radios))
    for n, (x, y) in cr["puntos"].items():
        x0[2 * idx[n]], x0[2 * idx[n] + 1] = x, y
    for n, c, r, *_ in cr["arcos"]:
        x0[ridx[n]] = r
    for n, c, r in cr["circulos"]:
        x0[ridx[n]] = r
    return idx, ridx, x0


def _ecuaciones(cr, valores):
    import numpy as np
    idx, ridx, x0 = _armar(cr)
    rectas = {n: (a, b) for n, a, b in cr["rectas"]}
    centro = {n: c for n, c, *_ in cr["arcos"]}
    centro.update({n: c for n, c, _ in cr["circulos"]})
    puntas = {n: (a, b) for n, c, r, a, b, _ in cr["arcos"]}

    def P(v, n):
        return v[2 * idx[n]], v[2 * idx[n] + 1]

    def F(v):
        out = []
        for i, r_ in enumerate(cr["restricciones"]):
            t = r_[0]
            if t in ("x", "y"):
                out.append(P(v, r_[1])[0 if t == "x" else 1] - valores[i])
            elif t == "en_V":
                out.append(P(v, r_[1])[0])
            elif t == "en_H":
                out.append(P(v, r_[1])[1])
            elif t == "H":
                a, b = rectas[r_[1]]
                out.append(P(v, a)[1] - P(v, b)[1])
            elif t == "angulo_H":
                a, b = rectas[r_[1]]
                (xa, ya), (xb, yb) = P(v, a), P(v, b)
                out.append((yb - ya) + (xb - xa) * math.tan(math.radians(valores[i])))     # baja hacia la derecha
            elif t == "radio":
                out.append(v[ridx[r_[1]]] - valores[i])
            elif t == "tangente":
                # en el vertice comun (la forma «distancia = radio» tiene raiz doble y le quita rango a la jacobiana)
                a, b = r_[1], r_[2]
                pts_a = set(rectas[a]) if a in rectas else set(puntas[a])
                pts_b = set(rectas[b]) if b in rectas else set(puntas[b])
                (comun,) = pts_a & pts_b
                xt, yt = P(v, comun)
                if a in rectas or b in rectas:
                    rec, arc = (a, b) if a in rectas else (b, a)
                    otro = [q for q in rectas[rec] if q != comun][0]
                    (xc, yc), (xo, yo) = P(v, centro[arc]), P(v, otro)
                    out.append((xt - xc) * (xo - xt) + (yt - yc) * (yo - yt))      # radio perpendicular a la recta
                else:
                    (x1, y1), (x2, y2) = P(v, centro[a]), P(v, centro[b])
                    out.append((xt - x1) * (yt - y2) - (yt - y1) * (xt - x2))      # centros alineados con el contacto
            elif t == "sobre":
                (xa, ya), (xb, yb) = P(v, rectas[r_[2]][0]), P(v, rectas[r_[2]][1])
                xp, yp = P(v, r_[1])
                out.append((xb - xa) * (yp - ya) - (yb - ya) * (xp - xa))
        for n, c, r, a, b, _ in cr["arcos"]:
            xc, yc = P(v, c)
            for q in (a, b):
                xq, yq = P(v, q)
                out.append(math.hypot(xq - xc, yq - yc) - v[ridx[n]])
        return np.array(out)
    return F, x0, idx


def _jac(F, x, h=1e-6):
    import numpy as np
    f0 = F(x)
    J = np.zeros((len(f0), len(x)))
    for j in range(len(x)):
        xp, xm = x.copy(), x.copy()
        xp[j] += h
        xm[j] -= h
        J[:, j] = (F(xp) - F(xm)) / (2 * h)
    return J


def _valores(cr_q3, A, B, sin_formula=()):
    vals = {}
    for i, r_ in enumerate(cr_q3["restricciones"]):
        if r_[0] in ("x", "y"):
            vals[i] = r_[2] if (not r_[3] or i in sin_formula) else evaluar(r_[3], A, B)
        elif r_[0] in ("radio", "angulo_H"):
            vals[i] = r_[2]
    return vals


def _resolver(ej, A, B, sin_formula=()):
    """El croquis de la q3 llevado a (A, B) por Newton, como el solver de CATIA. Devuelve {punto: (x, y)} y el residuo."""
    import numpy as np
    cr = ej.croquis(81.0, 57.0)
    F, x, idx = _ecuaciones(cr, _valores(cr, A, B, sin_formula))
    for _ in range(80):
        f = F(x)
        if np.max(np.abs(f)) < 1e-12:
            break
        x = x + np.linalg.lstsq(_jac(F, x), -f, rcond=None)[0]
    return {n: (x[2 * i], x[2 * i + 1]) for n, i in idx.items()}, float(np.max(np.abs(F(x))))


try:
    import numpy  # noqa: F401
    HAY_NUMPY = True
except Exception:  # noqa: BLE001
    HAY_NUMPY = False


@unittest.skipUnless(HAY_NUMPY, "sin numpy (correr con .venv-cad)")
class Solver(unittest.TestCase):
    def test_rango_completo_en_q3_y_q4(self):
        """34 restricciones + 6 puntas, 40 incognitas: rango 40 = ninguna sobra ni falta (el conteo de gdl() no lo ve:
        sacar una y repetir otra da gdl 0 con rango 39)."""
        import numpy as np
        ej = cargar()
        for _q, A, B, _C in ej.ESTADOS:
            cr = ej.croquis(A, B)
            F, x0, _ = _ecuaciones(cr, _valores(cr, A, B))
            self.assertEqual(np.linalg.matrix_rank(_jac(F, x0), tol=1e-7), 40, (A, B))
        cr = ej.croquis(81.0, 57.0)
        mal = dict(cr, restricciones=[r_ for r_ in cr["restricciones"] if r_ != ("sobre", "C29", "L8")]
                   + [("H", "L9")])
        self.assertEqual(ej.gdl(mal), 0)
        F, x0, _ = _ecuaciones(mal, _valores(mal, 81.0, 57.0))
        self.assertEqual(np.linalg.matrix_rank(_jac(F, x0), tol=1e-7), 39)

    def test_el_solver_lleva_la_q3_a_la_q4_de_perfil_2d(self):
        ej = cargar()
        sol, res = _resolver(ej, 84.0, 59.0)
        self.assertLess(res, 1e-9)
        q4 = ej.croquis(84.0, 59.0)["puntos"]
        for n, p in q4.items():
            self.assertLess(math.dist(sol[n], p), 1e-6, n)

    def test_gemelo_una_formula_que_falta(self):
        """P8.y sin formula (queda 52 en vez de 54): el gemelo mas chico del revisor, -1,77 g en la masa."""
        ej = cargar()
        cr = ej.croquis(81.0, 57.0)
        i = next(i for i, r_ in enumerate(cr["restricciones"]) if r_[:2] == ("y", "P8"))
        sol, _ = _resolver(ej, 84.0, 59.0, sin_formula={i})
        self.assertGreater(math.dist(sol["P8"], ej.croquis(84.0, 59.0)["puntos"]["P8"]), 1.0)

    def test_cotas_sin_formula_no_dependen_de_A_ni_B(self):
        ej = cargar()
        r3 = ej.croquis(81.0, 57.0)["restricciones"]
        r4 = ej.croquis(84.0, 59.0)["restricciones"]
        for a, b in zip(r3, r4):
            if a[0] in ("x", "y") and not a[3]:
                self.assertEqual(a, b)


# ---------------------------------------------------------------- CATIA falsa
class Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Fabrica2D:
    def __init__(self):
        self.puntos, self.lineas, self.arcos, self.circulos = [], [], [], []

    def CreatePoint(self, x, y):
        p = Obj(x=x, y=y, tipo="punto")
        self.puntos.append(p)
        return p

    def CreateLine(self, x1, y1, x2, y2):
        ln = Obj(a=(x1, y1), b=(x2, y2), tipo="recta")
        self.lineas.append(ln)
        return ln

    def CreateCircle(self, cx, cy, r, ini, fin):
        ar = Obj(c=(cx, cy), r=r, ini=ini, fin=fin, tipo="arco")
        self.arcos.append(ar)
        return ar

    def CreateClosedCircle(self, cx, cy, r):
        ci = Obj(c=(cx, cy), r=r, tipo="circulo")
        self.circulos.append(ci)
        return ci


class Restricciones:
    """Crea cada restriccion con el valor medido sobre lo dibujado (lo que hace CATIA)."""
    def __init__(self, ejes):
        self.lista, self.ejes = [], ejes

    def _valor(self, tipo, a, b=None):
        if tipo == 1:                                        # distancia de un punto a un eje
            return abs(a.x) if b is self.ejes["V"] else abs(a.y)
        if tipo == 14:
            return a.r
        if tipo == 6:
            return math.degrees(math.atan2(abs(a.b[1] - a.a[1]), abs(a.b[0] - a.a[0])))
        return None

    def AddBiEltCst(self, tipo, a, b):
        c = Obj(tipo=tipo, elems=(a, b), Status=0, Dimension=Obj(Value=self._valor(tipo, a, b)))
        self.lista.append(c)
        return c

    def AddMonoEltCst(self, tipo, a):
        c = Obj(tipo=tipo, elems=(a,), Status=0, Dimension=Obj(Value=self._valor(tipo, a)))
        self.lista.append(c)
        return c


class PartFalso:
    def __init__(self):
        part = self
        self.params, self.formulas, self.pads = {}, [], []
        ejes = {"H": Obj(eje="H"), "V": Obj(eje="V")}
        self.cst = Restricciones(ejes)
        self.f = Fabrica2D()
        sk = Obj(AbsoluteAxis=Obj(HorizontalReference=ejes["H"], VerticalReference=ejes["V"]),
                 Constraints=self.cst, OpenEdition=lambda: part.f, CloseEdition=lambda: None)
        self.sk = sk
        self.MainBody = Obj(Sketches=Obj(Add=lambda ref: sk), Shapes=Obj(Count=1))
        self.OriginElements = Obj(PlaneXY=Obj())

        def crear(nombre, tipo, valor):
            p = Obj(Value=valor, Name=nombre)
            part.params[nombre] = p
            return p
        self.Parameters = Obj(CreateDimension=crear, Item=lambda k: part.params[k])
        self.Relations = Obj(CreateFormula=lambda n, c, dim, expr: part.formulas.append((n, dim, expr)))
        self.ShapeFactory = Obj(AddNewPad=lambda sk_, largo: part._pad(largo))

    def _pad(self, largo):
        p = Obj(FirstLimit=Obj(Dimension=Obj(Value=largo)), DirectionOrientation=0)
        self.pads.append(p)
        return p

    def Update(self):
        pass

    def CreateReferenceFromObject(self, o):
        return o


def correr_falso():
    ej = cargar()
    jc = ej.jc
    tmp = tempfile.mkdtemp(prefix="ej11-")
    os.environ["CATIA_TRABAJO"] = tmp
    import catia_base
    part = PartFalso()
    sel = Obj(Clear=lambda: None, Add=lambda o: None, VisProperties=Obj(SetShow=lambda k: None))
    doc = Obj(Selection=sel)
    cambios = []

    def medir(doc_, part_, body):
        A, B, C = (part.params[k].Value for k in "ABC")
        return {"volume": round(p2.geometria(3, A, B, C)["volumen"], 3), "cdg_mm": [40.0, 30.0, C / 2]}

    def guardar(doc_, reg, nombre):
        ruta = os.path.join(reg.carpeta, nombre + ".stp")
        open(ruta, "w").close()
        return {"step": ruta}

    def material_y_masa(cb_, c_, doc_, part_, mat):
        v = medir(None, None, None)["volume"]
        return {"ok": True, "material": "Metal/Steel", "densidad_kg_m3": 7860.0, "masa_inercia_kg": v * 7.86e-6}
    ej07 = types.SimpleNamespace(material_y_masa=material_y_masa,
                                 renombrar_build123d=ej._cargar_07().renombrar_build123d)
    cb = types.SimpleNamespace(nueva_pieza=lambda c, n: (doc, part, part.MainBody, part.ShapeFactory), medir=medir,
                               guardar_pieza=guardar, ref=lambda p, o: o, Registro=catia_base.Registro)
    jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
    reg = catia_base.Registro(ej.EJ)
    salida = {"volumen_build123d": {}, "cdg_build123d_mm": {}, "volumen_catia": {}, "cdg_catia_mm": {},
              "archivos": [], "_carpeta": tmp, "_steps": {}}
    for i, q in enumerate(("q3", "q4", "q5", "q6")):
        salida["volumen_build123d"][f"tool_block_q3_a_q6__{q}"] = VOL_BIEN.get(q, 1.0)
        salida["cdg_build123d_mm"][f"tool_block_q3_a_q6__{q}"] = [40.0 + 150 * i, 30.0, (43.0 if q == "q3" else 45.0) / 2]
    salida["volumen_build123d"]["tool_block_q3_a_q6"] = 1.0
    salida["cdg_build123d_mm"]["tool_block_q3_a_q6"] = [0.0, 0.0, 0.0]
    ej.construir(cb, Obj(), reg, salida, ej07=ej07)
    return ej, jc, reg, salida, part, tmp, cambios


class Construir(unittest.TestCase):
    def test_parametrico_de_punta_a_punta(self):
        ej, jc, reg, salida, part, tmp, _ = correr_falso()
        self.assertEqual([p for p in reg.pasos if not p["ok"]], [])
        self.assertEqual({k: part.params[k].Value for k in "ABC"}, {"A": 84.0, "B": 59.0, "C": 45.0})
        self.assertEqual(len(part.cst.lista), 34)
        exprs = [e for _, _, e in part.formulas]
        self.assertEqual(sorted(exprs), sorted(["A - 29mm", "B", "A - 5mm", "A", "B - 5mm", "A", "B - 24mm", "A - 29mm",
                                                "C"]))
        self.assertEqual(len(part.pads), 1)                  # q4 sale de cambiar los parametros, no de otro pad
        self.assertEqual(sorted(salida["volumen_build123d"]), ["q3", "q4"])
        self.assertEqual(sorted(salida["build123d_aparte"]), ["q5", "q6", "tool_block_q3_a_q6"])
        self.assertEqual(salida["cdg_catia_crudo_mm"]["q4"][0], 40.0)
        self.assertEqual(salida["cdg_catia_mm"]["q4"][0], 190.0)
        self.assertTrue(jc.comparar(salida))
        self.assertEqual(salida["gdl_croquis"], 0)
        for q in ("q3", "q4"):
            self.assertEqual(salida["restricciones"][q], [0] * 34)
            self.assertAlmostEqual(salida["masa_catia_g"][q], VOL_BIEN[q] * 7.86e-3, delta=0.01)

    def test_masa_verde_y_rojo(self):
        ej, jc, reg, salida, part, tmp, _ = correr_falso()
        salida["ok"] = True
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertTrue(s["ok"], s.get("error"))
        salida["masa_catia_g"]["q4"] = round(ej.MASA_EXAMEN_G["q4"] + 2.0, 3)
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("q4", s["error"])

    def test_restriccion_sin_resolver_frena(self):
        """Gemelo: si CATIA deja una restriccion sin resolver (Status distinto de 0) el paso del croquis falla."""
        ej = cargar()
        orig = Restricciones.AddBiEltCst

        def mala(self, tipo, a, b):
            c = orig(self, tipo, a, b)
            if tipo == 4:                                   # las tangencias quedan sin resolver
                c.Status = 1
            return c
        Restricciones.AddBiEltCst = mala
        try:
            ej2, jc, reg, salida, part, tmp, _ = correr_falso()
        finally:
            Restricciones.AddBiEltCst = orig
        falla = [p for p in reg.pasos if not p["ok"]]
        self.assertEqual(len(falla), 1)
        self.assertIn("sin resolver", falla[0]["error"])
        self.assertEqual(part.pads, [])


if __name__ == "__main__":
    unittest.main()
