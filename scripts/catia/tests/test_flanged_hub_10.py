# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 10 del banco de CATIA (Too Tall Toby PPP01-07 Flanged Hub, CATA 24/10/2026).

1. Las cotas del catia.py son las de _flanged_hub.py del ejercicio 16 del banco 3D.
2. La cuenta en el orden de CATIA contra lo que midio build123d (CATA, 24/10/2026): total 138 144,669 mm3 (= el bien.py
   del 16), exterior por Pappus 225 829,051, rebaje 74 902,151, agujeros y masa contra la guia (372,99 g).
   Con build123d (.venv-cad): el exterior, el nervio del banco (nervio(0)) agregado al exterior = 587,781 y su centro, y
   las cuatro esquinas del trapecio iguales a las del banco.
3. construir() con una CATIA FALSA: los perfiles de revolucion cierran y llevan CenterLine, el trapecio se proyecta
   sobre las direcciones del plano que devuelve CATIA (las de la corrida real), los patrones van x3 / 120 y x6 / 60 con
   el eje Z, el Hole es Type 2 con 6 / 13 x 4, el aluminio pasa a 2 700 y la masa llega. ROJO: un plano con direcciones
   que no son ortonormales al filo y un nervio con el centro corrido frenan el paso.
4. cerrar_con_masa(): VERDE con la masa a 0,001 g; ROJO con los dos mutantes del 16 (sin el agujero de 20 +28,84 g, R3 de
   mas -2,11 g, tarea.yaml); sin material no hay verde."""
import importlib.util
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ10 = os.path.join(CATIA_DIR, "ejercicios", "10_flanged_hub")
BANCO16 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios",
                       "16_ttt_flanged_hub")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Croquis, Obj  # noqa: E402  (la CATIA falsa de croquis del 08)

VOL_BIEN = 138144.669               # medir_b123d.py bien sobre el bien.py del 16 (CATA, 24/10/2026)
VOL_EXTERIOR = 225829.0507          # build123d: los tres cilindros con los cuatro R3 de afuera (CATA, 24/10/2026)
VOL_REBAJE = 74902.1508             # build123d: lo que saca el rebaje con su R3 (CATA, 24/10/2026)
PLANO_REAL = ([-3.75, 0.0, 3.75], [0.707106781186548, 0.0, 0.707106781186548], [0.0, 1.0, 0.0])   # corrida 10_r2


def cargar_ej10():
    spec = importlib.util.spec_from_file_location("ej10_catia", os.path.join(EJ10, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_banco16():
    sys.path.insert(0, BANCO16)
    import _flanged_hub as fh
    return fh


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_cotas_iguales_a_las_del_banco(self):
        ej, fh = cargar_ej10(), cargar_banco16()
        for n in ("R_BRIDA", "E_BRIDA", "R_ESC", "Z_ESC", "R_CUBO", "Z_CUBO", "R_AGUJ", "R_REB", "Z_REB", "R_FIL", "R_BC",
                  "D_PAS", "D_CAJA", "PROF_CAJA", "NERV_R0", "NERV_FILO", "NERV_ANG"):
            self.assertEqual(getattr(ej, n), getattr(fh, n), n)
        self.assertAlmostEqual(ej.DENSIDAD_PLANO * 1e-6, fh.DENSIDAD, places=12)
        with open(os.path.join(BANCO16, "bien.py"), encoding="utf-8") as f:     # la parte = el .step de bien.py
            self.assertIn(f"armar('{ej.PARTE}')", f.read())

    def test_volumen_y_masa(self):
        ej = cargar_ej10()
        g = ej.geometria()
        ops = dict(g["ops"])
        self.assertLess(abs(ops["exterior"] - VOL_EXTERIOR), 0.001)
        self.assertLess(abs(-ops["rebaje"] - VOL_REBAJE), 0.001)
        self.assertLess(abs(g["volumen"] - VOL_BIEN), 0.01)
        self.assertLess(abs(g["volumen"] * ej.DENSIDAD_PLANO * 1e-6 - ej.MASA_GUIA_G), ej.TOL_MASA_G)
        # el agujero de 20 es lo que el mutante mal_1 del 16 pesa de mas (tarea.yaml: +10 681,4 mm3)
        self.assertLess(abs(-ops["agujero_20"] - 10681.4), 0.05)

    def test_pappus_contra_cilindros(self):
        """El Pappus por Green de un rectangulo de revolucion da el cilindro hueco (control del integrador)."""
        ej = cargar_ej10()
        rect = [("L", (2.0, 0.0), (5.0, 0.0)), ("L", (5.0, 0.0), (5.0, 7.0)), ("L", (5.0, 7.0), (2.0, 7.0)),
                ("L", (2.0, 7.0), (2.0, 0.0))]
        self.assertAlmostEqual(ej.volumen_revolucion(rect), math.pi * (25 - 4) * 7, places=9)
        cuarto = [("L", (0.0, 0.0), (3.0, 0.0)), ("A", (0.0, 0.0), 3.0, (3.0, 0.0), (0.0, 3.0), (3 * ej.S2, 3 * ej.S2)),
                  ("L", (0.0, 3.0), (0.0, 0.0))]
        self.assertAlmostEqual(ej.volumen_revolucion(cuarto), 2 / 3 * math.pi * 27, places=9)      # media esfera

    def test_proyeccion_con_el_plano_real(self):
        ej = cargar_ej10()
        n = ej.nervio_3d()
        pts = [ej.proyectar(p, *PLANO_REAL) for p in n["esquinas"]]
        esperado = [(41.7193, -1.5), (41.7193, 1.5), (21.7193, 5.0265), (21.7193, -5.0265)]     # croquis de 10_r2
        for p, q in zip(pts, esperado):
            self.assertLess(math.dist(p, q), 1e-4)
        self.assertAlmostEqual(sum(a * b for a, b in zip(n["normal"], PLANO_REAL[0])), n["d"], places=9)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_exterior_nervio_y_trapecio(self):
        ej, fh = cargar_ej10(), cargar_banco16()
        from build123d import CenterOf, fillet
        ext = fh.cil(fh.R_BRIDA, 0, fh.E_BRIDA) + fh.cil(fh.R_ESC, 0, fh.Z_ESC) + fh.cil(fh.R_CUBO, 0, fh.Z_CUBO)
        for r, z in ((fh.R_CUBO, fh.Z_ESC), (fh.R_ESC, fh.Z_ESC), (fh.R_ESC, fh.E_BRIDA), (fh.R_BRIDA, fh.E_BRIDA)):
            ext = fillet(fh.arista_circular(ext, r, z), fh.R_FIL)
        self.assertLess(abs(ext.volume - dict(ej.geometria()["ops"])["exterior"]), 0.01)
        agregado = fh.nervio(0) - ext
        self.assertLess(abs(agregado.volume - ej.NERVIO_DV_B123D), 0.001)
        c = agregado.center(CenterOf.MASS)
        self.assertLess(math.dist((c.X, c.Y, c.Z), ej.NERVIO_CENTRO_B123D), 1e-3)
        # las cuatro esquinas del trapecio = las del Plane(origin=medio, x_dir=Y, z_dir=u) de _flanged_hub.nervio()
        from build123d import Plane, Vector
        n = ej.nervio_3d()
        a = Vector(fh.NERV_R0, 0, fh.Z_ESC)
        b = Vector(fh.R_CUBO, 0, fh.Z_ESC + (fh.NERV_R0 - fh.R_CUBO))
        pl = Plane(origin=(a + b) * 0.5, x_dir=(0, 1, 0), z_dir=(b - a).normalized())
        k, w, t = math.tan(math.radians(fh.NERV_ANG / 2)), fh.NERV_FILO / 2, 20.0
        for (x, y), p in zip(((-w, 0), (w, 0), (w + t * k, t), (-w - t * k, t)), n["esquinas"]):
            q = pl.from_local_coords((x, y, 0))
            self.assertLess(math.dist((q.X, q.Y, q.Z), p), 1e-9)


# ---------------------------------------------------------------- CATIA falsa
class Rasgo:
    def __init__(self, doc, nombre, dv, centro=(0.0, 0.0, 0.0), **kw):
        self.doc, self.nombre, self.dv, self.centro = doc, nombre, dv, centro
        self.__dict__.update(kw)


class DocFalso:
    def __init__(self, ej, plano=PLANO_REAL, centro_nervio=None, groove_de_mas=0.0, hole="bien"):
        g = ej.geometria()
        self.esperado = dict(g["ops"])
        self.plano, self.centro_nervio = plano, centro_nervio or ej.NERVIO_CENTRO_B123D
        self.rasgos, self.croquis, self.patrones, self.cerrado, self.material, self.ocultos = [], [], [], False, None, []
        doc = self
        self.Product = Obj(PartNumber=None)
        self.Application = Obj()
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: doc.ocultos.append(o),
                             VisProperties=Obj(SetShow=lambda k: None), Delete=lambda: None)

        class CroquisRev(Croquis):
            CenterLine = None

        class Cuerpo:
            Sketches = Obj(Add=lambda plano: CroquisRev(doc, plano))

            @staticmethod
            def InsertHybridShape(p):
                pass

        def agregar(nombre, dv, **kw):
            r = Rasgo(doc, nombre, dv, **kw)
            doc.rasgos.append(r)
            return r

        class Fabrica:
            @staticmethod
            def AddNewShaft(sk):
                return agregar("shaft", doc.esperado["exterior"], sk=sk, FirstAngle=Obj(Value=0.0))

            @staticmethod
            def AddNewGroove(sk):
                return agregar("groove", doc.esperado["rebaje"] + groove_de_mas, sk=sk, FirstAngle=Obj(Value=0.0))

            @staticmethod
            def AddNewPad(sk, largo):
                return agregar("pad", doc.esperado["nervio"], centro=doc.centro_nervio, sk=sk, IsSymmetric=False,
                               DirectionOrientation=0, FirstLimit=Obj(Dimension=Obj(Value=largo)))

            @staticmethod
            def AddNewPocket(sk, largo):
                return agregar("pocket", doc.esperado["agujero_20"], sk=sk, IsSymmetric=False, DirectionOrientation=0,
                               FirstLimit=Obj(Dimension=Obj(Value=largo)))

            @staticmethod
            def AddNewCircPattern(feat, n1, n2, p1, paso, a, b, centro, eje, inv, ang, alin):
                dv = feat.dv * (n2 - 1)
                doc.patrones.append((feat.nombre, n1, n2, paso, centro, eje))
                return agregar("patron", dv)

            @staticmethod
            def AddNewHoleFromPoint(x, y, z, cara, prof):
                bueno = doc.esperado["agujero_caja"]
                # "bien": saca lo de la cuenta; "al_reves": 0 (al aire) y dado vuelta la cuenta; "nunca": 0 los dos
                dvs = {"bien": [bueno, 0.0], "al_reves": [0.0, bueno], "nunca": [0.0, 0.0]}[hole]
                h = agregar("hole", dvs[0], punto=(x, y, z), cara=cara, Type=None, BottomType=None,
                            Diameter=Obj(Value=0.0), HeadDiameter=Obj(Value=0.0), HeadDepth=Obj(Value=0.0),
                            BottomLimit=Obj(LimitMode=None), dado_vuelta=False)

                def reverse():
                    h.dado_vuelta = not h.dado_vuelta
                    h.dv = dvs[1] if h.dado_vuelta else dvs[0]
                h.Reverse = reverse
                return h

        self.body, self.sf = Cuerpo(), Fabrica()
        self.densidad = Obj(Name="flanged_hub\\Aluminium\\Aluminium.1\\Density", Value=2710.0)

        def gi(nombre_):
            def aplicar(part, mat, modo):
                doc.material = mat.Name
            return Obj(ApplyMaterialOnPart=aplicar)

        class PartFalsa(Obj):
            @property
            def Parameters(self):
                lista = [doc.densidad] if doc.material else []
                return Obj(Count=len(lista), Item=lambda i: lista[i - 1])
        hsf = Obj(AddNewPointCoord=lambda x, y, z: Obj(punto=(x, y, z)),
                  AddNewDirectionByCoord=lambda x, y, z: Obj(dir=(x, y, z)),
                  AddNewLinePtDir=lambda p, d, a, b, o: Obj(linea=(p, d)),
                  AddNewPlaneEquation=lambda a, b, c, d: Obj(ecuacion=(a, b, c, d)))
        self.part = PartFalsa(OriginElements=Obj(PlaneXY="XY", PlaneYZ="YZ", PlaneZX="ZX"), MainBody=self.body,
                              Update=lambda: None, CreateReferenceFromObject=lambda o: o, GetItem=gi,
                              HybridShapeFactory=hsf)

    def volumen(self):
        return sum(r.dv for r in self.rasgos)

    def cdg(self):
        v = self.volumen()
        return [sum(r.dv * r.centro[i] for r in self.rasgos) / v for i in range(3)] if v else [0.0, 0.0, 0.0]

    def GetWorkbench(self, nombre):
        doc = self

        class Inercias:
            @staticmethod
            def Add(prod):
                dens = doc.densidad.Value if doc.material else 1000.0
                return Obj(Density=dens, Mass=doc.volumen() * 1e-9 * dens)
        return Obj(Inertias=Inercias(), GetMeasurable=lambda ref: Obj(objeto=ref, Volume=doc.volumen() * 1e-9))

    def Activate(self):
        pass

    def Close(self):
        self.cerrado = True


class Cuenta10(unittest.TestCase):
    def correr_falso(self, aplicar_material=True, **kw):
        ej = cargar_ej10()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej10-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        doc = DocFalso(ej, **kw)

        def nueva_pieza(c, nombre):
            doc.Product.PartNumber = nombre
            return doc, doc.part, doc.body, doc.sf

        def medir(d, part, obj):
            return {"volume": round(d.volumen(), 3), "cdg_mm": [round(x, 3) for x in d.cdg()]}

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}

        def topologia(d, feat, tipo):
            return [{"ref": "cara z 8", "cdg": [0.0, 0.0, 8.0]}, {"ref": "cara z 25", "cdg": [0.0, 0.0, 25.0]}]

        def evaluar(c, macro, m):
            if macro == ej.e08.MACRO_PLANO:
                return ";".join(str(x) for x in doc.plano[0] + doc.plano[1] + doc.plano[2]).replace(".", ",")
            return ";".join(repr(x) for x in doc.cdg()).replace(".", ",")
        alu = Obj(Name="Aluminium")
        familia = Obj(Name="Metal", Materials=Obj(Count=1, Item=lambda j: alu))
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: familia))
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc if aplicar_material else (_ for _ in ()).throw(OSError("no"))))
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar, ref=lambda p, o: o,
                                   topologia=topologia, evaluar=evaluar, MACRO_COG=catia_base.MACRO_COG,
                                   poligono=catia_base.poligono, Registro=catia_base.Registro, CATIA_INSTALADA=tmp)
        self.addCleanup(setattr, jc, "captura_bmp", jc.captura_bmp)       # auditor de la tanda: se devuelve
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {ej.PARTE: VOL_BIEN}, "cdg_build123d_mm": {ej.PARTE: [0.0, 0.0, 0.0]},
                  "volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        ej.construir(cb, c, reg, salida)
        return ej, jc, reg, salida, doc, tmp

    def test_operaciones(self):
        ej, jc, reg, salida, doc, _ = self.correr_falso()
        fallas = [p for p in reg.pasos if not p["ok"]]
        self.assertEqual(fallas, [], fallas)
        self.assertEqual([r.nombre for r in doc.rasgos], ["shaft", "pad", "patron", "groove", "hole", "patron", "pocket"])
        self.assertAlmostEqual(doc.volumen(), VOL_BIEN, delta=0.01)
        self.assertTrue(doc.cerrado)
        # revolucion: perfiles cerrados con su CenterLine en v 0 (el eje Z en el croquis ZX)
        revs = [r for r in doc.rasgos if r.nombre in ("shaft", "groove")]
        for r, arcos in zip(revs, (4, 1)):
            self.assertEqual(r.FirstAngle.Value, 360.0)
            f = r.sk.f
            self.assertEqual(r.sk.plano, "ZX")
            self.assertIsNotNone(r.sk.CenterLine)
            eje = r.sk.CenterLine
            self.assertEqual((eje.a[1], eje.b[1]), (0.0, 0.0))
            perfil = [ln for ln in f.lineas if ln is not eje]
            self.assertEqual(len(f.arcos), arcos)
            usos = {}
            for ln in perfil:
                for p in (ln.StartPoint, ln.EndPoint):
                    usos[id(p)] = usos.get(id(p), 0) + 1
            for ar in f.arcos:
                self.assertTrue(0 < ar.fin - ar.ini < math.pi)
                for p in (ar.StartPoint, ar.EndPoint):
                    usos[id(p)] = usos.get(id(p), 0) + 1
            self.assertEqual(set(usos.values()), {2}, "el perfil no cierra")
        # en ZX la H es Z y la V es r: el R3 del canto de la brida (r 62, z 5) tiene el centro en (h 5, v 62) y el del pie
        # del cubo (r 20,5, z 28) en (h 28, v 20,5); el del techo del rebaje (r 33,5, z 15) en (h 15, v 33,5)
        self.assertIn((5.0, 62.0), [ar.c for ar in revs[0].sk.f.arcos])
        self.assertIn((28.0, 20.5), [ar.c for ar in revs[0].sk.f.arcos])
        self.assertEqual([ar.c for ar in revs[1].sk.f.arcos], [(15.0, 33.5)])
        # nervio: el trapecio proyectado sobre el plano real y el pad simetrico de 20
        pad = doc.rasgos[1]
        self.assertTrue(pad.IsSymmetric)
        self.assertEqual(pad.FirstLimit.Dimension.Value, 20.0)
        self.assertEqual(pad.sk.plano.ecuacion[:3], tuple(ej.nervio_3d()["normal"]))
        pts = [(p.x, p.y) for p in pad.sk.f.puntos]
        for p, q in zip(pts, [(41.7193, -1.5), (41.7193, 1.5), (21.7193, 5.0265), (21.7193, -5.0265)]):
            self.assertLess(math.dist(p, q), 1e-4)
        # patrones alrededor de Z: nervio x3 / 120 y agujero x6 / 60
        self.assertEqual([(n, a, b, paso) for n, a, b, paso, _c, _e in doc.patrones],
                         [("pad", 1, 3, 120.0), ("hole", 1, 6, 60.0)])
        for _n, _a, _b, _p, centro, eje in doc.patrones:
            self.assertEqual(centro.punto, (0.0, 0.0, 0.0))
            self.assertEqual(eje.linea[1].dir, (0.0, 0.0, 1.0))
        # el Hole: Type 2, 6 / 13 x 4, desde z 8 en x 53,975, hasta el ultimo
        h = doc.rasgos[4]
        self.assertEqual((h.cara, h.punto), ("cara z 8", (ej.R_BC, 0.0, 8.0)))
        self.assertEqual((h.Type, h.BottomType, h.BottomLimit.LimitMode), (2, 0, 2))
        self.assertEqual((h.Diameter.Value, h.HeadDiameter.Value, h.HeadDepth.Value), (6.0, 13.0, 4.0))
        # el agujero de 20: circulo R10 en XY, pocket simetrico
        pk = doc.rasgos[-1]
        self.assertEqual((pk.sk.plano, pk.sk.f.circulos, pk.IsSymmetric), ("XY", [(0.0, 0.0, 10.0)], True))
        self.assertEqual(salida["material_catia"]["densidad_kg_m3"], 2700.0)
        self.assertAlmostEqual(salida["masa_catia_g"], VOL_BIEN * 2.7e-3, delta=0.01)

    def test_rojo_una_operacion_que_no_da_la_cuenta(self):
        """El control de cada operacion: el groove que saca 5 mm3 de menos frena el paso, y los que siguen no se hacen."""
        _ej, _jc, reg, salida, doc, _ = self.correr_falso(groove_de_mas=5.0)
        malos = [p for p in reg.pasos if not p["ok"]]
        self.assertTrue(malos and "rebaje" in malos[0]["paso"] and "no da lo de la cuenta" in malos[0]["error"])
        self.assertNotIn("hole", [r.nombre for r in doc.rasgos])

    def test_hole_al_reves_se_da_vuelta_y_si_no_frena(self):
        _ej, _jc, reg, salida, doc, _ = self.correr_falso(hole="al_reves")
        paso = [p for p in reg.pasos if "Hole" in p["paso"]][0]
        self.assertTrue(paso["ok"] and paso["dato"]["invertido"])
        _ej, _jc, reg, salida, doc, _ = self.correr_falso(hole="nunca")
        paso = [p for p in reg.pasos if "Hole" in p["paso"]][0]
        self.assertFalse(paso["ok"])
        self.assertIn("no saca lo de la cuenta", paso["error"])

    def test_rojo_plano_torcido_y_nervio_corrido(self):
        ej = cargar_ej10()
        torcido = (PLANO_REAL[0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0])          # d1 no es normal al filo
        _ej, _jc, reg, salida, doc, _ = self.correr_falso(plano=torcido)
        self.assertIn("nervio", [p["paso"] for p in reg.pasos if not p["ok"]][0])
        corrido = tuple(x + d for x, d in zip(ej.NERVIO_CENTRO_B123D, (0.0, 0.0, 0.05)))
        _ej, _jc, reg, salida, doc, _ = self.correr_falso(centro_nervio=corrido)
        malos = [p for p in reg.pasos if not p["ok"]]
        self.assertTrue(malos and "nervio" in malos[0]["paso"] and "no quedo donde build123d" in malos[0]["error"])

    def test_masa_verde_y_rojo_con_los_mutantes(self):
        ej, jc, reg, salida, doc, tmp = self.correr_falso()
        salida["ok"] = True
        salida["volumen_catia"] = {ej.PARTE: VOL_BIEN}
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertTrue(s["ok"] and s["ok_masa"] and s["ok_cruce_build123d"])
        for dif_g, dif_mm3 in ((28.84, 10681.4), (-2.108, -780.7)):          # mal_1 y mal_2 del 16 (tarea.yaml)
            salida["masa_catia_g"] = round(VOL_BIEN * 2.7e-3 + dif_g, 3)
            salida["volumen_catia"] = {ej.PARTE: VOL_BIEN + dif_mm3}
            jc.escribir(tmp, salida)
            s = ej.cerrar_con_masa(tmp)
            self.assertFalse(s["ok"])
            self.assertFalse(s["ok_masa"])
        salida["masa_catia_g"] = ej.MASA_GUIA_G                               # masa justa, otra densidad: rojo
        salida["volumen_catia"] = {ej.PARTE: VOL_BIEN * 0.98}
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertFalse(s["masa_sobre_volumen"]["coherente"])

    def test_sin_material_no_hay_verde(self):
        ej, jc, reg, salida, doc, tmp = self.correr_falso(aplicar_material=False)
        self.assertNotIn("masa_catia_g", salida)
        salida["ok"] = True
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertIsNone(s["ok_masa"])
        self.assertIn("sin masa de CATIA", s["error"])


if __name__ == "__main__":
    unittest.main()
