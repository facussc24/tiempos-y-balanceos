# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 09 del banco de CATIA (Paste Sleeve por superficies, 24/10/2026).

1. La cuenta en Python puro (Simpson sobre la seccion oblonga) contra lo que ya midieron build123d (bien.py del 15:
   55 617,528 mm3, tarea.yaml) y CATIA en la practica del 19/10 (ej29, registro.json: transicion de afuera 140 067,832,
   hueco entero 140 942,914, lo que saca 139 306,233, volumen final 55 617,524). Gemelo: sin el tramo recto de 30 la
   cuenta cae 12 852,5 mm3 (mal_1 del 15). Con build123d (.venv-cad): la cuenta con pared 3 y 4 contra _paste_sleeve.modelo.
2. construir() con una CATIA FALSA: los croquis cierran (cada punto lo comparten dos tramos, arcos de 180 grados), el
   loft acopla vertice a vertice con dos secciones, el Join lleva 0,01 e Invert, cada CloseSurface va al cuerpo que tiene
   que ir, el hueco se resta del principal, se ocultan 8 objetos (6 planos y 2 sets) antes de exportar, y el centro de
   gravedad que sale (con los momentos de cada operacion) es el que midio build123d (z 65,7124, un numero que el codigo
   no calcula). Si una transicion suma otro volumen que la cuenta, el paso frena y no se sigue.
3. cerrar_con_masa_y_area(): VERDE con masa, area, STEP limpio y STL; ROJO con el area a 0,1 %, con dos solidos o una
   cascara suelta en el STEP, con el STEP sin medir (lo dice), con el STL restando (caras hacia adentro) y con la masa
   a mas de 1 g."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ09 = os.path.join(CATIA_DIR, "ejercicios", "09_paste_sleeve_gsd")
BANCO15 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios",
                       "15_ttt_paste_sleeve")
sys.path.insert(0, CATIA_DIR)

VOL_BIEN = 55617.528            # bien.py del 15 (tarea.yaml, resultado.md de la practica del 23/10)
CDG_Z_BIEN = 65.7124            # medir_b123d sobre bien.py del 15 (salida.json de la corrida del 24/10 08:58)
EJ29 = {"transicion_afuera": 140067.832, "hueco": 140942.914, "saca": 139306.233, "final": 55617.524}


def cargar():
    spec = importlib.util.spec_from_file_location("ej09_catia", os.path.join(EJ09, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_contra_build123d_y_la_practica(self):
        ej = cargar()
        ops, vol = ej.cuenta()
        self.assertLess(abs(vol - VOL_BIEN), 0.05)
        self.assertLess(abs(vol - EJ29["final"]), 0.05)
        self.assertLess(abs(ops["transicion_afuera"] - EJ29["transicion_afuera"]), 0.05)
        hueco = ops["hueco_recto"] + ops["hueco_transicion"] + ops["hueco_tapa"]
        self.assertLess(abs(hueco - EJ29["hueco"]), 0.05)
        self.assertLess(abs(-ops["restar_hueco"] - EJ29["saca"]), 0.05)
        self.assertLess(abs(vol * ej.DENSIDAD_G_MM3 - ej.MASA_GUIA_G), ej.TOL_MASA_G)

    def test_gemelo_sin_tramo_recto(self):
        ej = cargar()
        ops, vol = ej.cuenta()
        sin_recto = vol - ops["recto_afuera"] + ej.area_oblonga(*ej.INT_ABAJO) * ej.ALTO_RECTO
        self.assertLess(abs((vol - sin_recto) - 12852.5), 0.5)      # tarea.yaml del 15, mal_1


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_cuenta_con_pared_3_y_4(self):
        """La cuenta es independiente de build123d (Simpson); la pared de 4 es el mal_3 del 15 (77,35 g)."""
        sys.path.insert(0, BANCO15)
        import _paste_sleeve as ps
        ej = cargar()
        for pared in (3.0, 4.0):
            self.assertLess(abs(ej.cuenta(pared)[1] - ps.modelo(pared=pared).volume), 0.05, pared)


# ---------------------------------------------------------------- CATIA falsa
class Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Fabrica2D:
    def __init__(self):
        self.puntos, self.lineas, self.arcos = [], [], []

    def CreatePoint(self, x, y):
        p = Obj(x=x, y=y)
        self.puntos.append(p)
        return p

    def CreateLine(self, x1, y1, x2, y2):
        ln = Obj(a=(x1, y1), b=(x2, y2), StartPoint=None, EndPoint=None)
        self.lineas.append(ln)
        return ln

    def CreateCircle(self, cx, cy, r, ini, fin):
        ar = Obj(c=(cx, cy), r=r, ini=ini, fin=fin, StartPoint=None, EndPoint=None, CenterPoint=None)
        self.arcos.append(ar)
        return ar

    def medidas(self):
        """largo y ancho totales de la oblonga dibujada"""
        r = self.arcos[0].r
        L = max(abs(ln.a[0]) for ln in self.lineas)
        return 2 * (L + r), 2 * r


class Croquis:
    def __init__(self, plano, todos):
        self.plano, self.f = plano, Fabrica2D()
        todos.append(self)

    def OpenEdition(self):
        return self.f

    def CloseEdition(self):
        pass


class Cuerpo:
    def __init__(self, part, nombre):
        self.part, self.Name, self.vol, self.mz = part, nombre, 0.0, 0.0
        self.Sketches = Obj(Add=lambda pl: Croquis(pl, part.croquis))
        self.Shapes = Obj(Count=0)

    def InsertHybridShape(self, x):
        pass

    def sumar(self, dv, momento_z):
        self.vol += dv
        self.mz += momento_z
        self.Shapes.Count += 1


class Conjunto:
    def __init__(self, part):
        self.Name, self.formas = "", []
        self.HybridSketches = Obj(Add=lambda pl: Croquis(pl, part.croquis))
        self.HybridShapes = Obj(Item=lambda n: next(x for x in self.formas if getattr(x, "Name", None) == n))

    def AppendHybridShape(self, x):
        self.formas.append(x)


class Pad:
    def __init__(self, part, sk, largo):
        self.part, self.sk = part, sk
        self.IsSymmetric, self.DirectionOrientation = False, 0
        self.FirstLimit = Obj(Dimension=Obj(Value=largo))
        part.ops.append(("pad", part.InWorkObject.Name))

    def aplicar(self, ej):
        """suma al cuerpo en trabajo lo que da el croquis (el sentido: +Z con orientacion 0)"""
        lg, an = self.sk.f.medidas()
        largo = self.FirstLimit.Dimension.Value
        z0 = self.sk.plano.z
        s = 1 if self.DirectionOrientation == 0 else -1
        v = ej.area_oblonga(lg, an) * largo
        self.cuerpo.sumar(v, v * (z0 + s * largo / 2))


class PartFalso:
    def __init__(self, ej):
        self.ej = ej
        self.croquis, self.ops, self.lofts, self.joins, self.cuerpos, self.pendientes = [], [], [], [], [], []
        part = self
        self.MainBody = Cuerpo(self, "PartBody")
        self.cuerpos.append(self.MainBody)
        self.InWorkObject = self.MainBody
        self.OriginElements = Obj(PlaneXY=Obj(z=0.0))
        self.Bodies = Obj(Add=lambda: part._cuerpo())
        self.HybridBodies = Obj(Add=lambda: Conjunto(part))
        self.HybridShapeFactory = Obj(
            AddNewPlaneOffset=lambda ref, z, inv: Obj(z=ref.z + z),
            AddNewLoft=lambda: part._loft(),
            AddNewFill=lambda: part._fill(),
            AddNewJoin=lambda a, b: part._join(a, b))
        self.ShapeFactory = Obj(AddNewPad=lambda sk, largo: part._pad(sk, largo),
                                AddNewCloseSurface=lambda j: part._cerrar(j),
                                AddNewRemove=lambda b: part._restar(b))

    def _cuerpo(self):
        b = Cuerpo(self, f"Body.{len(self.cuerpos) + 1}")
        self.cuerpos.append(b)
        return b

    def _loft(self):
        lo = Obj(secciones=[], SectionCoupling=None, Name=f"Loft.{len(self.lofts) + 1}")
        lo.AddSectionToLoft = lambda ref, o, x: lo.secciones.append(ref)
        self.lofts.append(lo)
        return lo

    def _fill(self):
        fi = Obj(bordes=[])
        fi.AddBound = lambda ref: fi.bordes.append(ref)
        return fi

    def _join(self, a, b):
        j = Obj(elems=[a, b], dev=None, Invert=False)
        j.AddElement = lambda x: j.elems.append(x)
        j.SetDeviation = lambda d: setattr(j, "dev", d)
        self.joins.append(j)
        return j

    def _pad(self, sk, largo):
        p = Pad(self, sk, largo)
        p.cuerpo = self.InWorkObject
        self.pendientes.append(p)
        return p

    def _cerrar(self, j):
        """Volumen y momento de una transicion reglada: Simpson es exacto para los dos (el area es cuadratica en z, z por
        el area es cubica)."""
        lo = j.elems[0]
        (l0, a0), (l1, a1) = (s.f.medidas() for s in lo.secciones)
        z0, z1 = lo.secciones[0].plano.z, lo.secciones[1].plano.z
        h, ej = z1 - z0, self.ej
        A0, Am, A1 = ej.area_oblonga(l0, a0), ej.area_oblonga((l0 + l1) / 2, (a0 + a1) / 2), ej.area_oblonga(l1, a1)
        v = h / 6 * (A0 + 4 * Am + A1)
        mz = h / 6 * (z0 * A0 + 4 * (z0 + z1) / 2 * Am + z1 * A1)
        self.ops.append(("cerrar", self.InWorkObject.Name, j.dev, j.Invert, lo.SectionCoupling, len(lo.secciones)))
        self.InWorkObject.sumar(v, mz)

    def _restar(self, b):
        """Saca del cuerpo en trabajo lo del hueco que cae adentro: el hueco menos sus dos rebanadas de 1 mm afuera (z -1 a
        0 y z 133 a 134)."""
        ej = self.ej
        a0, a1 = ej.area_oblonga(*ej.INT_ABAJO), ej.area_oblonga(*ej.INT_ARRIBA)
        saca = b.vol - a0 - a1
        m_saca = b.mz - a0 * (-0.5) - a1 * (ej.ALTO + 0.5)
        self.ops.append(("restar", self.InWorkObject.Name, b.Name))
        self.InWorkObject.sumar(-saca, -m_saca)

    def Update(self):
        while self.pendientes:
            self.pendientes.pop(0).aplicar(self.ej)

    def CreateReferenceFromObject(self, o):
        return o


def correr_falso(cuenta=None):
    ej = cargar()
    if cuenta is not None:
        ej.cuenta = cuenta
    jc = ej.jc
    tmp = tempfile.mkdtemp(prefix="ej09-")
    os.environ["CATIA_TRABAJO"] = tmp
    import catia_base
    partes, ocultos = [], []

    def nueva_pieza(c, nombre):
        part = PartFalso(ej)
        partes.append(part)
        sel = Obj(Clear=lambda: None, Add=lambda o: ocultos.append(o), VisProperties=Obj(SetShow=lambda k: None),
                  Delete=lambda: None)
        def exportar(ruta, tipo):
            with open(ruta, "w") as f:
                f.write("solid falso\n")                  # exigir_archivo pide que pese mas de 0
        doc = Obj(part=part, Selection=sel, ExportData=exportar)
        return doc, part, part.MainBody, part.ShapeFactory

    def medir(doc, part, obj):
        part.Update()
        if obj.vol == 0:
            raise ValueError("cuerpo vacio")
        return {"volume": round(obj.vol, 3), "area": 15000.0, "cdg_mm": [0.0, 0.0, round(obj.mz / obj.vol, 4)]}

    def guardar(doc, reg, nombre):
        ruta = os.path.join(reg.carpeta, nombre + ".stp")
        open(ruta, "w").close()
        return {"step": ruta}

    cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar,
                               ref=lambda p, o: p.CreateReferenceFromObject(o), Registro=catia_base.Registro,
                               exigir_archivo=catia_base.exigir_archivo,
                               evaluar=lambda *a: (_ for _ in ()).throw(RuntimeError("la prueba no usa la macro")))
    jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
    reg = catia_base.Registro(ej.EJ)
    salida = {"volumen_build123d": {"paste_sleeve": VOL_BIEN},
              "cdg_build123d_mm": {"paste_sleeve": [0.0, 0.0, CDG_Z_BIEN]},
              "volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
    ej.construir(cb, Obj(), reg, salida)
    return ej, jc, reg, salida, partes[0], tmp, ocultos


class Construir(unittest.TestCase):
    def test_operaciones_croquis_y_cdg(self):
        ej, jc, reg, salida, part, _, ocultos = correr_falso()
        fallas = [p for p in reg.pasos if not p["ok"]]
        self.assertEqual(fallas, [], fallas)
        hueco = part.cuerpos[1].Name
        self.assertEqual([o[0] for o in part.ops], ["pad", "cerrar", "pad", "cerrar", "pad", "restar"])
        self.assertEqual(part.ops[0][1], "PartBody")
        self.assertEqual(part.ops[1][1:], ("PartBody", 0.01, True, 4, 2))
        self.assertEqual(part.ops[2][1], hueco)
        self.assertEqual(part.ops[3][1:], (hueco, 0.01, True, 4, 2))
        self.assertEqual(part.ops[4][1], hueco)
        self.assertEqual(part.ops[5], ("restar", "PartBody", hueco))
        self.assertLess(abs(part.MainBody.vol - VOL_BIEN), 0.05)
        self.assertTrue(jc.comparar(salida), (salida.get("diferencia_mm3"), salida.get("dif_cdg_mm")))
        self.assertEqual(salida["area_catia"], {"paste_sleeve": 15000.0})
        self.assertEqual(len(ocultos), 8)                     # 6 planos + 2 sets de superficies
        self.assertTrue(any(a.endswith("paste_sleeve.stl") for a in salida["archivos"]))
        # 7 croquis (recto de afuera, recto del hueco, tapa del hueco y 2 secciones por loft), cada uno una oblonga cerrada
        self.assertEqual(len(part.croquis), 7)
        for sk in part.croquis:
            f = sk.f
            self.assertEqual((len(f.lineas), len(f.arcos)), (2, 2))
            usos = {}
            for ln in f.lineas:
                self.assertEqual((ln.StartPoint.x, ln.StartPoint.y), ln.a)
                self.assertEqual((ln.EndPoint.x, ln.EndPoint.y), ln.b)
                for p in (ln.StartPoint, ln.EndPoint):
                    usos[id(p)] = usos.get(id(p), 0) + 1
            for ar in f.arcos:
                self.assertAlmostEqual(ar.fin - ar.ini, math.pi)
                for p, a in ((ar.StartPoint, ar.ini), (ar.EndPoint, ar.fin)):
                    self.assertLess(math.dist((p.x, p.y), (ar.c[0] + ar.r * math.cos(a), ar.c[1] + ar.r * math.sin(a))),
                                    1e-9)
                    usos[id(p)] = usos.get(id(p), 0) + 1
            self.assertEqual(set(usos.values()), {2}, "un punto que no lo comparten dos tramos: no cierra")
        for lo in part.lofts:
            self.assertEqual([s.plano.z for s in lo.secciones], [30.0, 133.0])
        dims = [tuple(round(x, 6) for x in s.f.medidas()) for lo in part.lofts for s in lo.secciones]
        self.assertEqual(dims, [(51.0, 44.0), (66.0, 10.0), (45.0, 38.0), (60.0, 4.0)])

    def test_transicion_que_no_da_la_cuenta_frena(self):
        """Gemelo: si la transicion de afuera suma otro volumen que la cuenta (un loft acoplado por proporcion y no por
        vertices: unos -35 000 mm3 segun el revisor del 24/10), el paso falla y no se sigue con el hueco."""
        ops, vol = cargar().cuenta()
        ej, jc, reg, salida, part, _, _ = correr_falso(
            cuenta=lambda: ({**ops, "transicion_afuera": ops["transicion_afuera"] - 35000.0}, vol))
        self.assertFalse(reg.pasos[1]["ok"])
        self.assertIn("la transicion suma", reg.pasos[1]["error"])
        self.assertFalse(any("hueco" in p["paso"] for p in reg.pasos), [p["paso"] for p in reg.pasos])


class MasaArea(unittest.TestCase):
    def preparar(self, area_catia=38127.239, area_b=38127.24, step=None, stl=None, volumen=VOL_BIEN):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej09-masa-")
        os.makedirs(os.path.join(tmp, "_build123d"))
        open(os.path.join(tmp, "_build123d", "paste_sleeve.step"), "w").close()
        os.makedirs(os.path.join(tmp, ej.EJ))
        for ext in ("stp", "stl"):
            open(os.path.join(tmp, ej.EJ, "paste_sleeve." + ext), "w").close()
        s = {"ok": True, "volumen_catia": {"paste_sleeve": volumen}, "area_catia": {"paste_sleeve": area_catia},
             "archivos": [os.path.join(ej.EJ, "paste_sleeve.stp"), os.path.join(ej.EJ, "paste_sleeve.stl")]}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        d_step = {"volumen": volumen, "area": area_catia, "solidos": 1, "cascaras": 1, "caras_sueltas": 0}
        if isinstance(step, dict):
            d_step.update(step)
        d_stl = {"volumen_stl": volumen - 3.0, "cerrado": True}
        d_stl.update(stl or {})

        def medir(args):
            modo, ruta = args[0], args[1]
            if modo == "stl":
                return {"partes": {"paste_sleeve": d_stl}}
            if ruta.endswith(".step"):
                return {"partes": {"paste_sleeve": {"volumen": VOL_BIEN, "area": area_b, "solidos": 1}}}
            if step == "sin_medir":
                return {"error": "no esta el entorno CAD"}
            return {"partes": {"paste_sleeve": d_step}}
        if step == "sin_medir":
            d_step = {}
        return ej.cerrar_con_masa_y_area(tmp, medir=medir)

    def test_verde(self):
        s = self.preparar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertAlmostEqual(s["masa_catia_g"], round(VOL_BIEN * 1.02e-3, 3))

    def test_rojo_area(self):
        s = self.preparar(area_catia=38165.4)                 # 0,1 %
        self.assertFalse(s["ok"])
        self.assertIn("area", s["error"])

    def test_rojo_step_sucio(self):
        for cambio in ({"solidos": 2}, {"cascaras": 9, "caras_sueltas": 968}):    # NOTAS 19/10: 8 cascaras sueltas
            s = self.preparar(step=cambio)
            self.assertFalse(s["ok"], cambio)
            self.assertIn("se exporta lo visible", s["error"])

    def test_rojo_step_sin_medir_lo_dice(self):
        s = self.preparar(step="sin_medir")
        self.assertFalse(s["ok"])
        self.assertIn("no se pudo medir el STEP", s["error"])
        self.assertNotIn("None solidos", s["error"])

    def test_rojo_stl_que_resta(self):
        """Caras hacia adentro: el volumen de CATIA da bien y el STL resta la transicion dos veces (NOTAS 19/10)."""
        s = self.preparar(stl={"volumen_stl": VOL_BIEN - 2 * 140067.8})
        self.assertFalse(s["ok"])
        self.assertIn("STL", s["error"])
        s = self.preparar(stl={"cerrado": False})
        self.assertFalse(s["ok"])

    def test_rojo_masa(self):
        s = self.preparar(volumen=VOL_BIEN + 1500.0)          # +1,53 g
        self.assertFalse(s["ok"])
        self.assertIn("masa", s["error"])


if __name__ == "__main__":
    unittest.main()
