# -*- coding: utf-8 -*-
"""Prueba sin CATIA y sin la pieza del cliente del ejercicio 33 del banco de CATIA (panel del Upper Trim, CATA 24/10/2026).

1. Lo medido el 24/10 (R21 de CATA, `33_r1`) cierra con las tolerancias del juez: CATIA contra la integracion fina del
   mismo STEP y el STEP que exporto CATIA contra el original.
2. construir() con un STEP FALSO: con el sha256 que espera abre una copia (nunca el original) y la mide; con otro sha256
   frena antes de abrir nada en CATIA.
3. cerrar_con_medicion(): VERDE con lo medido; ROJO con el STEP de CATIA con una cara suelta o dos solidos, con su volumen
   o su centro corridos, con CATIA corrida, sin la medicion fina y con un paso que fallo.
4. Con OpenCASCADE de verdad (.venv-cad): una caja de STEP contra si misma da VERDE y contra la misma caja SIN UNA CARA da
   ROJO por la topologia (0 solidos, 5 caras sueltas), aunque BRepCheck la da valida (revisor Fable del 33)."""
import hashlib
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ33 = os.path.join(CATIA_DIR, "ejercicios", "33_panel_upper_trim")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Obj  # noqa: E402

SHA_PANEL = "fb74d9772b21fb48a915819a54968a863d9d6a35cd7cd78655c55b02955e4a1e"   # v14_choque/panel_marco_local.step
CATIA = {"volume": 91770.06, "area": 96035.359, "cdg_mm": [44.865, -61.217, -7.647]}           # 33_r1, 24/10 11:49
FINO = {"panel_copia.step": {"vol": 91766.75, "area": 96034.395, "cdg": [44.8686, -61.2152, -7.6461], "valido": True},
        "panel_upper_trim.stp": {"vol": 91763.081, "area": 96033.918, "cdg": [44.8644, -61.216, -7.6489], "valido": True}}
DEFECTO = {"panel_copia.step": {"volumen": 91767.169, "area": 96034.52, "solidos": 1, "cascaras": 1, "caras_sueltas": 0},
           "panel_upper_trim.stp": {"volumen": 91719.392, "area": 96032.088, "solidos": 1, "cascaras": 1,
                                    "caras_sueltas": 0}}


def cargar_ej33():
    spec = importlib.util.spec_from_file_location("ej33_catia", os.path.join(EJ33, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def medir_falso(defecto):
    return lambda args: {"partes": {"p": dict(defecto[os.path.basename(args[1])])}}


class Medido(unittest.TestCase):
    def test_constantes(self):
        ej = cargar_ej33()
        self.assertEqual(ej.SHA256, SHA_PANEL)
        self.assertEqual(ej.EJ, "33_panel_upper_trim")
        self.assertTrue(ej.NUBE.endswith(os.path.join("para CATA - practica 19-10", "v14_choque", "panel_marco_local.step")))

    def test_lo_medido_cierra(self):
        ej = cargar_ej33()
        c, e = FINO["panel_copia.step"], FINO["panel_upper_trim.stp"]
        self.assertLess(abs(CATIA["volume"] - c["vol"]) / c["vol"], ej.TOL_REL)
        self.assertLess(abs(e["vol"] - c["vol"]) / c["vol"], ej.TOL_REL)
        # la integracion por defecto, sobre el STEP de CATIA, corre el centro mas que TOL_CDG: por eso decide la fina
        self.assertGreater(abs(44.81 - c["cdg"][0]), ej.jc.TOL_CDG)


class Construir(unittest.TestCase):
    def correr(self, sha_bueno=True):
        ej = cargar_ej33()
        import catia_base
        tmp = tempfile.mkdtemp(prefix="ej33-")
        origen = os.path.join(tmp, "panel_falso.step")
        with open(origen, "w") as f:
            f.write("ISO-10303-21;\n")
        os.environ["CATIA_PANEL_UPPER_TRIM"] = origen
        with open(origen, "rb") as f:
            ej.SHA256 = hashlib.sha256(f.read()).hexdigest() if sha_bueno else SHA_PANEL
        abiertos = []
        part = Obj(MainBody="cuerpo", Bodies=Obj(Count=1))
        doc = Obj(Part=part, Close=lambda: None)
        c = Obj(Documents=Obj(Open=lambda r: abiertos.append(r)), ActiveDocument=doc)

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        cb = types.SimpleNamespace(medir=lambda d, p, b: dict(CATIA), guardar_pieza=guardar)
        ej.jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": reg.carpeta, "_steps": {}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            os.environ.pop("CATIA_PANEL_UPPER_TRIM", None)
        return ej, salida, abiertos, origen, reg

    def test_abre_una_copia_y_mide(self):
        ej, salida, abiertos, origen, reg = self.correr()
        self.assertEqual(len(abiertos), 1)
        self.assertNotEqual(os.path.abspath(abiertos[0]), os.path.abspath(origen))      # nunca el original
        self.assertEqual(os.path.dirname(abiertos[0]), reg.carpeta)
        self.assertEqual(salida["volumen_catia"][ej.PARTE], CATIA["volume"])
        self.assertEqual(salida["area_catia_mm2"], CATIA["area"])

    def test_otro_sha256_frena(self):
        ej, salida, abiertos, origen, reg = self.correr(sha_bueno=False)
        self.assertEqual(abiertos, [])
        self.assertNotEqual(salida["panel"]["sha256"], SHA_PANEL)
        self.assertEqual(salida["volumen_catia"], {})


class Juez(unittest.TestCase):
    def juez(self, catia=None, fino=None, defecto=None, ok_pasos=True, error=None):
        ej = cargar_ej33()
        tmp = tempfile.mkdtemp(prefix="ej33-juez-")
        m = dict(catia or CATIA)
        salida = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "volumen_catia": {ej.PARTE: m["volume"]},
                  "cdg_catia_mm": {ej.PARTE: m["cdg_mm"]}, "area_catia_mm2": m["area"]}
        if error:
            salida["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(salida, f)
        return ej.cerrar_con_medicion(tmp, medir=medir_falso(defecto or DEFECTO),
                                      medir_fino=lambda rutas: json.loads(json.dumps(fino or FINO)))

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)
        self.assertEqual(s["juez"]["export_caras_sueltas"], 0)

    def test_rojo_el_step_de_catia(self):
        for clave, valor, texto in (("caras_sueltas", 1, "caras sueltas"), ("solidos", 2, "2 solidos")):
            d = json.loads(json.dumps(DEFECTO))
            d["panel_upper_trim.stp"][clave] = valor
            s = self.juez(defecto=d)
            self.assertFalse(s["ok"])
            self.assertIn(texto, s["error"])
        f = json.loads(json.dumps(FINO))
        f["panel_upper_trim.stp"]["vol"] *= 1.002
        self.assertIn("volumen del STEP de CATIA", self.juez(fino=f)["error"])
        f = json.loads(json.dumps(FINO))
        f["panel_upper_trim.stp"]["cdg"][0] += 0.02
        self.assertIn("centro del STEP de CATIA", self.juez(fino=f)["error"])
        f = json.loads(json.dumps(FINO))
        f["panel_upper_trim.stp"]["valido"] = False
        self.assertIn("valido", self.juez(fino=f)["error"])

    def test_rojo_catia_y_medicion(self):
        m = dict(CATIA, volume=CATIA["volume"] * 1.002)
        self.assertIn("volumen CATIA", self.juez(catia=m)["error"])
        m = dict(CATIA, cdg_mm=[44.885, -61.217, -7.647])
        self.assertIn("centro de CATIA", self.juez(catia=m)["error"])
        self.assertIn("medicion fina", self.juez(fino={"error": "sin entorno"})["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])
    def test_excepcion_fuera_de_un_paso(self):
        """Pedido 10 de la principal: el error de correr_ejercicio nunca da verde, aunque todo lo demas cierre."""
        E = "excepcion fuera de un paso: Traceback ..."
        r = self.juez(error=E)
        self.assertFalse(r["ok"])
        self.assertIn("excepcion fuera de un paso", r["error"])



try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraOpenCascade(unittest.TestCase):
    """El juez entero con medir_b123d.py y medir_fino.py de verdad, sobre STEP de una caja 10 x 20 x 30."""

    def correr(self, export_abierto):
        from build123d import Box, Shape, export_step
        from OCP.BRep import BRep_Builder
        from OCP.TopoDS import TopoDS_Shell, TopoDS_Solid
        ej = cargar_ej33()
        tmp = tempfile.mkdtemp(prefix="ej33-occ-")
        sub = os.path.join(tmp, ej.EJ)
        os.makedirs(sub)
        caja = Box(10, 20, 30)
        export_step(caja, os.path.join(sub, "panel_copia.step"))
        if export_abierto:
            b = BRep_Builder()
            sh, so = TopoDS_Shell(), TopoDS_Solid()
            b.MakeShell(sh)
            for f in caja.faces()[:-1]:                 # una cara menos
                b.Add(sh, f.wrapped)
            b.MakeSolid(so)
            b.Add(so, sh)
            export_step(Shape(so), os.path.join(sub, ej.PARTE + ".stp"))
        else:
            export_step(caja, os.path.join(sub, ej.PARTE + ".stp"))
        salida = {"ok": False, "ok_pasos": True, "pendiente": True, "volumen_catia": {ej.PARTE: 6000.0},
                  "cdg_catia_mm": {ej.PARTE: [0.0, 0.0, 0.0]}, "area_catia_mm2": 2200.0}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(salida, f)
        return ej.cerrar_con_medicion(tmp)

    def test_caja_sana_verde(self):
        s = self.correr(export_abierto=False)
        self.assertTrue(s["ok"], s.get("error"))

    def test_caja_sin_una_cara_rojo(self):
        s = self.correr(export_abierto=True)
        self.assertFalse(s["ok"])
        self.assertIn("1 solido cerrado", s["error"])
        self.assertEqual(s["juez"]["export_caras_sueltas"], 5)
        self.assertTrue(s["medicion_fina"]["panel_upper_trim.stp"]["valido"])      # BRepCheck no lo ve


if __name__ == "__main__":
    unittest.main()
