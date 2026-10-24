# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 18 del banco de CATIA (CSWP Sample Exam 2, etapa 1 parametrica, CATA 24/10/2026).

1. Las etapas son las del examen (A..E y masas, pag. 18-19 y 27) y los volumenes que midio CATIA en la R21 de CATA
   (24/10 10:15) por 0,0077 g/mm3 caen a 1 g del papel. Con build123d: el gemelo de la practica sobre los mismos A..E da
   esos volumenes a 0,5 mm3.
2. pieza_ej27.py es la copia del ej27 con los cambios anotados: no captura ni guarda ni corre suelto; devuelve ctx.
3. construir() con la pieza FALSA (la de CATIA la arma pieza_ej27, que necesita CATIA): Steel 7 860 pasado a 7 700, las
   tres etapas cambiando solo A..E con su masa, vuelta a la etapa 1, los cuatro planos de construccion ocultos.
4. cerrar_con_respuestas(): VERDE con lo medido; ROJO con una masa a 2 g del papel, con el gemelo que no corre o que da
   otro volumen, y con el STEP que no da el volumen de la etapa 1."""
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base
                                                     # (fija su carpeta al importarse: revisor del 18)

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ18 = os.path.join(CATIA_DIR, "ejercicios", "18_cswp_etapa1")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
sys.path.insert(0, EJ18)
from test_c_clamp_base_08 import Obj  # noqa: E402

VOL_CATIA = {1: 1845109.091, 2: 2141619.109, 3: 1961099.202}      # R21 de CATA, 24/10/2026 10:15 (= ej27 del 19/10)
EXAMEN = {1: (213, 200, 170, 130, 41, 14207.34), 2: (225, 210, 176, 137, 39, 16490.45), 3: (209, 218, 169, 125, 41, 15100.47)}


def cargar_ej18():
    spec = importlib.util.spec_from_file_location("ej18_catia", os.path.join(EJ18, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_gemelo():
    """Por ruta y con nombre propio: el 22 tambien tiene un gemelo_b123d.py y Python reusaria el primero que cargo."""
    spec = importlib.util.spec_from_file_location("gemelo_b123d_18", os.path.join(EJ18, "gemelo_b123d.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_etapas_del_examen(self):
        ej = cargar_ej18()
        for n, (a, b, c, d, e, m) in EXAMEN.items():
            et = ej.etapas()[n]
            self.assertEqual((et["A"], et["B"], et["C"], et["D"], et["E"], et["masa_examen_g"]), (a, b, c, d, e, m))
            self.assertLess(abs(VOL_CATIA[n] * 0.0077 - m), ej.TOL_MASA_G, n)
        self.assertAlmostEqual(ej.DENSIDAD_EXAMEN * 1e-6, 0.0077, places=12)

    def test_la_copia_del_ej27(self):
        texto = open(os.path.join(EJ18, "pieza_ej27.py"), encoding="utf-8").read()
        self.assertIn("from catia_base import medir, nueva_pieza, ref, topologia", texto)
        for prohibido in ("captura(", "guardar_pieza(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn('ctx.update(doc=doc, sf=sf, vol=vol)', texto)
        self.assertIn("Origen: ej27_parametrico.py", texto)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_gemelo_sobre_las_tres_etapas(self):
        g = cargar_gemelo()
        for n, (a, b, c, d, e, _m) in EXAMEN.items():
            s, *_r = g.pieza(a, b, c, d, e, a / 3, b / 3 + 10)
            self.assertLess(abs(s.volume - VOL_CATIA[n]), 0.5, n)
        r = cargar_ej18().gemelo(213, 200, 170, 130, 41)        # el camino real: subproceso + JSON de la ultima linea
        self.assertLess(abs(r["volumen"] - VOL_CATIA[1]), 0.5, r)


# ---------------------------------------------------------------- pieza FALSA
class PartFalsa:
    def __init__(self):
        self.vals = {k: float(v) for k, v in zip("ABCDE", EXAMEN[1][:5])}
        self.material = None
        self.densidad = Obj(Name="cswp\\Steel\\Steel.1\\Density", Value=7860.0)
        self.actualizaciones = 0
        part = self

        class Param:
            def __init__(self, k):
                self.k = k

            @property
            def Value(self):
                if self.k == "X":
                    return part.vals["A"] / 3
                if self.k == "Y":
                    return part.vals["B"] / 3 + 10
                return part.vals[self.k]

            @Value.setter
            def Value(self, v):
                part.vals[self.k] = v

        class Parametros:
            def Item(self, i):
                return Param(i) if isinstance(i, str) else ([part.densidad] if part.material else [])[i - 1]

            @property
            def Count(self):
                return 1 if part.material else 0
        self.Parameters = Parametros()

    def Update(self):
        self.actualizaciones += 1

    def GetItem(self, nombre):
        def aplicar(part, mat, modo):
            self.material = mat.Name
        return Obj(ApplyMaterialOnPart=aplicar)

    def volumen(self):
        etapa = next(n for n, e in EXAMEN.items() if tuple(float(x) for x in e[:5]) ==
                     tuple(self.vals[k] for k in "ABCDE"))
        return VOL_CATIA[etapa]


class Cuenta18(unittest.TestCase):
    def correr_falso(self):
        ej = cargar_ej18()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej18-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        import pieza_ej27
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        part, ocultos = PartFalsa(), []
        doc = Obj(Selection=Obj(Clear=lambda: None, Add=lambda o: ocultos.append(o),
                                VisProperties=Obj(SetShow=lambda k: None)), Product=Obj(), cerrado=False)

        def cerrar():
            doc.cerrado = True
        doc.Close = cerrar
        doc.GetWorkbench = lambda n: Obj(Inertias=Obj(Add=lambda prod: Obj(
            Density=part.densidad.Value if part.material else 1000.0,
            Mass=part.volumen() * 1e-9 * (part.densidad.Value if part.material else 1000.0))))
        ctx = {"doc": doc, "part": part, "body": "cuerpo", "pY": "plano y", "pX": "plano x", "p25": "plano 25",
               "p35": "plano 35"}
        original = pieza_ej27.hacer
        pieza_ej27.hacer = lambda: (lambda c, reg: ctx)
        steel = Obj(Name="Steel")
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: Obj(Name="Metal", Materials=Obj(Count=1, Item=lambda j: steel))))
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc))

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        cb = types.SimpleNamespace(medir=lambda d, p, b: {"volume": part.volumen(), "cdg_mm": [0, 0, 0]},
                                   guardar_pieza=guardar, CATIA_INSTALADA=tmp, Registro=catia_base.Registro)
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            pieza_ej27.hacer = original
        return ej, jc, reg, salida, part, doc, ocultos, tmp

    def test_etapas_material_y_planos(self):
        ej, jc, reg, salida, part, doc, ocultos, _ = self.correr_falso()
        self.assertEqual([p for p in reg.pasos if not p["ok"]], [])
        self.assertEqual(salida["material_catia"]["densidad_catalogo_kg_m3"], 7860.0)
        self.assertEqual(salida["material_catia"]["densidad_kg_m3"], 7700.0)
        for n in (1, 2, 3):
            d = salida["etapas"][str(n)]
            self.assertEqual(d["volumen_catia"], VOL_CATIA[n])
            self.assertAlmostEqual(d["masa_catia_g"], VOL_CATIA[n] * 0.0077, places=2)
            self.assertAlmostEqual(d["parametros"]["X"], EXAMEN[n][0] / 3, places=9)
        self.assertEqual([part.vals[k] for k in "ABCDE"], [float(x) for x in EXAMEN[1][:5]])   # de vuelta a la 1
        self.assertEqual(salida["volumen_catia"][ej.PARTE], VOL_CATIA[1])
        self.assertEqual(set(ocultos), {"plano y", "plano x", "plano 25", "plano 35"})
        self.assertTrue(doc.cerrado)

    def test_juez_rojo_cada_control_solo(self):
        """Revisor 24/10: cada control tiene que poder dar rojo SOLO (no tapado por otro)."""
        ej, jc, reg, salida, part, doc, ocultos, tmp = self.correr_falso()
        base = json.dumps(salida)
        masa = json.loads(base)                          # solo la masa (el volumen queda: el gemelo da bien)
        masa["etapas"]["3"]["masa_catia_g"] += 1.5
        self.assertIn("etapa 3: ", self.juez(masa, tmp, ej)["error"])
        self.assertIn("del examen", self.juez(json.loads(json.dumps(masa)), tmp, ej)["error"])
        coh = json.loads(base)                           # masa del examen justa pero otra densidad (volumen 2 % menos)
        coh["etapas"]["1"]["masa_catia_g"] = 14207.34
        coh["etapas"]["1"]["volumen_catia"] = VOL_CATIA[1] * 0.98
        s = self.juez(coh, tmp, ej, gemelo=lambda *a: {"volumen": VOL_CATIA[next(
            n for n, x in EXAMEN.items() if x[0] == a[0])] * (0.98 if a[0] == 213 else 1.0)})
        self.assertNotIn("del examen", s["error"])
        self.assertIn("sin coherencia", s["error"])
        sin = json.loads(base)
        sin["etapas"]["2"].pop("masa_catia_g")
        self.assertIn("etapa 2 sin masa de CATIA", self.juez(sin, tmp, ej)["error"])
        s = self.juez(json.loads(base), tmp, ej, ok_pasos=False)          # un paso de CATIA fallo: nunca verde
        self.assertFalse(s["ok"])

    def test_formulas_de_la_pieza(self):
        """Lo unico que protege la geometria de la copia sin CATIA: las formulas del ej27, textuales."""
        texto = open(os.path.join(EJ18, "pieza_ej27.py"), encoding="utf-8").read()
        for f in ('"A / 3"', '"B / 3 + 10mm"', '"B - C"', '"B - C + 15mm"', '"C - 15mm"', '"C - 65mm"', '"C - 80mm"',
                  '"X / 2"', '"Y / 2"', '"B + 10mm"', '"C - 56mm"', '"C - 24mm"', '"B - C + 24mm"', '"E / 2"',
                  '"B - C + 7.5mm"', '"C - 7.5mm"', '"B - 69mm"', '"B - 30mm"'):
            self.assertIn(f, texto, f)

    def juez(self, salida, tmp, ej, gemelo=None, step=True, ok_pasos=True, topo=None):
        salida["ok_pasos"], salida["ok"] = ok_pasos, False
        salida["volumen_step_catia_en_build123d"] = ({ej.PARTE: VOL_CATIA[1] + 0.05} if step is True else
                                                     step if isinstance(step, str) else {})
        salida["step_catia_en_build123d"] = {ej.PARTE: dict({"solidos": 1, "cascaras": 1, "caras_sueltas": 0},
                                                            **(topo or {}))}
        ej.jc.escribir(tmp, salida)
        g = gemelo or (lambda a, b, c, d, e: {"volumen": VOL_CATIA[next(n for n, x in EXAMEN.items() if x[0] == a)]})
        return ej.cerrar_con_respuestas(tmp, medir_gemelo=g)

    def test_juez_verde(self):
        ej, jc, reg, salida, part, doc, ocultos, tmp = self.correr_falso()
        s = self.juez(salida, tmp, ej)
        self.assertTrue(s["ok"], s.get("error"))

    def test_excepcion_fuera_de_un_paso(self):
        """Pedido 10 de la principal: el error de correr_ejercicio nunca da verde, aunque todo lo demas cierre."""
        ej, jc, reg, salida, part, doc, ocultos, tmp = self.correr_falso()
        salida["error"] = "excepcion fuera de un paso: Traceback ..."
        s = self.juez(salida, tmp, ej)
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])

    def test_juez_rojo(self):
        ej, jc, reg, salida, part, doc, ocultos, tmp = self.correr_falso()
        malo = json.loads(json.dumps(salida))
        malo["etapas"]["2"]["masa_catia_g"] += 2.0
        malo["etapas"]["2"]["volumen_catia"] += 2.0 / 0.0077
        s = self.juez(malo, tmp, ej)
        self.assertFalse(s["ok"])
        self.assertIn("etapa 2", s["error"])
        s = self.juez(json.loads(json.dumps(salida)), tmp, ej, gemelo=lambda *a: {"error": "no esta el entorno CAD"})
        self.assertFalse(s["ok"])
        s = self.juez(json.loads(json.dumps(salida)), tmp, ej, gemelo=lambda *a: {"volumen": 1.0})
        self.assertFalse(s["ok"])
        self.assertIn("contra el gemelo", s["error"])
        s = self.juez(json.loads(json.dumps(salida)), tmp, ej, step=False)
        self.assertFalse(s["ok"])
        self.assertIn("el STEP de la etapa 1", s["error"])
        s = self.juez(json.loads(json.dumps(salida)), tmp, ej, topo={"cascaras": 2, "caras_sueltas": 1})   # auditor
        self.assertFalse(s["ok"])
        self.assertIn("no es 1 solido cerrado", s["error"])
        # sin .venv-cad juez_comun deja un TEXTO en la clave: rojo con motivo, no una excepcion (barrido del 24/10)
        s = self.juez(json.loads(json.dumps(salida)), tmp, ej, step="medir_b123d no corrio: no esta .venv-cad")
        self.assertFalse(s["ok"])
        self.assertIn("el STEP de la etapa 1", s["error"])


if __name__ == "__main__":
    unittest.main()
