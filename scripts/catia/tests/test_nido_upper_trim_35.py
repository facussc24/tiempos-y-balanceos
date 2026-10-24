# -*- coding: utf-8 -*-
"""Prueba sin CATIA y sin la pieza del cliente del ejercicio 35 del banco de CATIA (nido que copia el panel del Upper Trim,
CATA 24/10/2026).

1. Constantes: el bloque del ej24 de la practica (170 x 58 x 19 = 187 340 mm3), el control es choque_exacto.py del repo y
   el panel es el del ejercicio 33 (mismo sha256).
2. construir() con CATIA FALSA: con el sha256 que espera abre una COPIA, arma el bloque, le resta el panel pegado y oculta
   el cuerpo del panel y el plano antes de exportar; con otro sha256 frena antes de abrir nada.
3. cerrar_con_choque(): VERDE con lo medido; ROJO si choque_exacto.py da CHOCA, SIN MEDIR o no corre, si el nido de
   CATIA no da el volumen del STEP, si el bloque no es la cuenta, si el nido no es el de la practica (bloque corrido) y si
   un paso fallo.
4. correr_choque(): el nido primero y el panel despues, con el tope SEG_CHOQUE; sin entorno CAD, sin choque_exacto.py,
   con salida que no es JSON o pasado de tiempo, devuelve error (revisor Sonnet del 35)."""
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
EJ35 = os.path.join(CATIA_DIR, "ejercicios", "35_nido_upper_trim")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Obj  # noqa: E402

SHA_PANEL = "fb74d9772b21fb48a915819a54968a863d9d6a35cd7cd78655c55b02955e4a1e"
BLOQUE, NIDO = 187340.0, 171459.136                    # ej24 de la practica, 19/10 = CATA 24/10 12:00 (35_r1)
CHOQUE = {"solidos_utillaje": 5, "solidos_panel": 1, "vol_utillaje": 171457.147, "vol_panel": 91767.169,
          "interseccion_fuzz_0.0001": 0.0, "interseccion_fuzz_0.001": 0.0, "interseccion_fuzz_0.01": 0.0,
          "distancia_min": 0.0, "gemelo_subido_1.0_interseccion": 7478.2023, "veredicto": "toca (luz 0)"}


def cargar_ej35():
    spec = importlib.util.spec_from_file_location("ej35_catia", os.path.join(EJ35, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Constantes(unittest.TestCase):
    def test_bloque_control_y_panel(self):
        ej = cargar_ej35()
        self.assertEqual(ej.BLOQUE, BLOQUE)
        self.assertEqual((ej.X0, ej.X1, ej.Y0, ej.Y1, ej.Z0, ej.ALTO), (-40.0, 130.0, -29.0, 29.0, -25.0, 19.0))   # ej24
        self.assertEqual(ej.NIDO_PRACTICA, NIDO)
        self.assertTrue(os.path.isfile(ej.CHOQUE), ej.CHOQUE)
        self.assertTrue(ej.CHOQUE.startswith(ej.jc.REPO))       # el paquete del obrero no trae la skill (revisor del 35)
        self.assertEqual(ej.P33.SHA256, SHA_PANEL)
        self.assertLess(abs(NIDO - CHOQUE["vol_utillaje"]), ej.TOL_REL * NIDO)
        self.assertLess(ej.SEG_CHOQUE, 1200)                    # obrero.py --timeout-seg


class Construir(unittest.TestCase):
    def correr(self, sha_bueno=True):
        ej = cargar_ej35()
        import catia_base
        tmp = tempfile.mkdtemp(prefix="ej35-")
        origen = os.path.join(tmp, "panel_falso.step")
        with open(origen, "w") as f:
            f.write("ISO-10303-21;\n")
        os.environ["CATIA_PANEL_UPPER_TRIM"] = origen
        with open(origen, "rb") as f:
            ej.P33.SHA256 = hashlib.sha256(f.read()).hexdigest() if sha_bueno else SHA_PANEL
        ev = {"abiertos": [], "copiado": [], "pegado": [], "restado": [], "ocultos": [], "cerrados": 0}

        def seleccion():
            return Obj(Clear=lambda: None, Add=lambda o: ev["copiado"].append(o), Copy=lambda: None,
                       PasteSpecial=lambda formato: ev["pegado"].append(formato))
        dp = Obj(Part=Obj(MainBody="cuerpo del panel"), Selection=seleccion(),
                 Close=lambda: ev.__setitem__("cerrados", ev["cerrados"] + 1))
        c = Obj(Documents=Obj(Open=lambda r: ev["abiertos"].append(r)), ActiveDocument=dp)
        vols = {"v": BLOQUE}
        pad = Obj(DirectionOrientation=0)
        cuerpo = Obj(InsertHybridShape=lambda o: None,
                     Sketches=Obj(Add=lambda r: Obj(OpenEdition=lambda: "fabrica", CloseEdition=lambda: None)))
        part = Obj(Update=lambda: None, OriginElements=Obj(PlaneXY="xy"), Bodies=Obj(Count=2, Item=lambda i: "panel pegado"),
                   HybridShapeFactory=Obj(AddNewPlaneOffset=lambda r, z, inv: "plano z-25"))

        def restar(o):
            ev["restado"].append(o)
            vols["v"] = NIDO
        sf = Obj(AddNewPad=lambda sk, alto: pad, AddNewRemove=restar)
        elegidos, orden = [], []                                # lo seleccionado y la secuencia ocultar / exportar
        doc = Obj(Selection=Obj(Clear=lambda: elegidos.clear(), Add=lambda o: elegidos.append(o),
                                PasteSpecial=lambda f: ev["pegado"].append(f),
                                VisProperties=Obj(SetShow=lambda k: orden.extend(("oculta" if k == 1 else "muestra", o)
                                                                                 for o in elegidos))),
                  Close=lambda: ev.__setitem__("cerrados", ev["cerrados"] + 1))
        ev["orden"] = orden

        def guardar(d, reg, nombre):
            orden.append(("exporta", nombre))
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        cb = types.SimpleNamespace(medir=lambda d, p, b: {"volume": vols["v"], "cdg_mm": [45.0, 0.0, -15.5]},
                                   guardar_pieza=guardar, nueva_pieza=lambda c_, n: (doc, part, cuerpo, sf),
                                   ref=lambda p, o: o, poligono=lambda f, pts: None)
        self.addCleanup(setattr, ej.jc, "captura_bmp", ej.jc.captura_bmp)   # auditor de la tanda: se devuelve
        ej.jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": reg.carpeta, "_steps": {}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            os.environ.pop("CATIA_PANEL_UPPER_TRIM", None)
        return ej, salida, ev, origen, reg

    def test_copia_bloque_resta_y_oculta(self):
        ej, salida, ev, origen, reg = self.correr()
        self.assertEqual(len(ev["abiertos"]), 1)
        self.assertNotEqual(os.path.abspath(ev["abiertos"][0]), os.path.abspath(origen))     # nunca el original
        self.assertEqual(os.path.dirname(ev["abiertos"][0]), reg.carpeta)
        self.assertEqual(ev["copiado"], ["cuerpo del panel"])
        self.assertEqual(ev["pegado"], ["CATPrtResultWithOutLink"])
        self.assertEqual(ev["restado"], ["panel pegado"])
        # CATIA exporta lo visible: el panel pegado y el plano, OCULTOS (SetShow 1) y ANTES de exportar
        exporta = ev["orden"].index(("exporta", ej.PARTE))
        self.assertLess(ev["orden"].index(("oculta", "panel pegado")), exporta)
        self.assertLess(ev["orden"].index(("oculta", "plano z-25")), exporta)
        self.assertEqual(salida["bloque_catia"], BLOQUE)
        self.assertEqual(salida["volumen_catia"][ej.PARTE], NIDO)
        self.assertEqual(ev["cerrados"], 2)

    def test_otro_sha256_frena(self):
        ej, salida, ev, origen, reg = self.correr(sha_bueno=False)
        self.assertEqual(ev["abiertos"], [])
        self.assertEqual(salida["volumen_catia"], {})


class Juez(unittest.TestCase):
    def juez(self, choque=None, nido=NIDO, bloque=BLOQUE, ok_pasos=True, error=None):
        ej = cargar_ej35()
        tmp = tempfile.mkdtemp(prefix="ej35-juez-")
        salida = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "volumen_catia": {ej.PARTE: nido},
                  "bloque_catia": bloque}
        if error:
            salida["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(salida, f)
        vistos = []

        def falso(nido_step, panel_step):
            vistos.append((os.path.basename(nido_step), os.path.basename(panel_step)))
            return dict(choque or CHOQUE)
        s = ej.cerrar_con_choque(tmp, choque=falso)
        self.assertEqual(vistos, [(ej.PARTE + ".stp", "panel_copia.step")])     # contra la COPIA verificada
        return s

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)
        self.assertEqual(s["juez"]["huella_catia"], round(BLOQUE - NIDO, 3))

    def test_rojo(self):
        for veredicto in ("CHOCA", "SIN MEDIR (una operacion de OpenCASCADE fallo)", "no choca"):
            s = self.juez(choque=dict(CHOQUE, veredicto=veredicto))
            self.assertFalse(s["ok"])
            self.assertIn("toca (luz 0)", s["error"])
        self.assertFalse(self.juez(choque={"error": "sin entorno"})["ok"])
        self.assertIn("volumen del STEP", self.juez(nido=NIDO * 1.002)["error"])
        self.assertIn("170 x 58 x 19", self.juez(bloque=BLOQUE + 1)["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])
        # un bloque corrido (mismo volumen, toca otra parte del panel): el volumen contra OpenCASCADE pasa, la practica no
        s = self.juez(nido=NIDO + 1.0, choque=dict(CHOQUE, vol_utillaje=NIDO + 1.0 - 1.989))
        self.assertIn("de la practica", s["error"])
        self.assertNotIn("volumen del STEP", s["error"])
    def test_excepcion_fuera_de_un_paso(self):
        """Pedido 10 de la principal: el error de correr_ejercicio nunca da verde, aunque todo lo demas cierre."""
        E = "excepcion fuera de un paso: Traceback ..."
        r = self.juez(error=E)
        self.assertFalse(r["ok"])
        self.assertIn("excepcion fuera de un paso", r["error"])



class CorrerChoque(unittest.TestCase):
    """correr_choque() con el subprocess falso: el orden de los argumentos y los cuatro caminos que no miden."""

    def test_argumentos_y_salida(self):
        ej = cargar_ej35()
        vistos = []

        def correr(args, **kw):
            vistos.append((args, kw.get("timeout")))
            return Obj(stdout="aviso de OCC\n" + json.dumps(CHOQUE) + "\n")
        self.assertEqual(ej.correr_choque("n.stp", "p.step", correr=correr)["veredicto"], "toca (luz 0)")
        args, tope = vistos[0]
        self.assertEqual(args[1:], ["-I", ej.CHOQUE, "n.stp", "p.step", "1.0"])        # utillaje primero, panel despues
        self.assertEqual(tope, ej.SEG_CHOQUE)

    def test_no_mide(self):
        ej = cargar_ej35()
        import subprocess

        def tarda(args, **kw):
            raise subprocess.TimeoutExpired(args, kw.get("timeout"))
        self.assertIn("error", ej.correr_choque("n", "p", correr=tarda))
        self.assertIn("error", ej.correr_choque("n", "p", correr=lambda a, **k: Obj(stdout="Traceback ...\n")))
        ej.jc.VENV_CAD, venv = os.path.join(tempfile.gettempdir(), "no_existe_python.exe"), ej.jc.VENV_CAD
        try:
            self.assertIn("entorno CAD", ej.correr_choque("n", "p", correr=lambda a, **k: None)["error"])
        finally:
            ej.jc.VENV_CAD = venv
        ej.CHOQUE = os.path.join(tempfile.gettempdir(), "no_existe_choque.py")
        if os.path.isfile(ej.jc.VENV_CAD):
            self.assertIn("choque_exacto.py", ej.correr_choque("n", "p", correr=lambda a, **k: None)["error"])


if __name__ == "__main__":
    unittest.main()
