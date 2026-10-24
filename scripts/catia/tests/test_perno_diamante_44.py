# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 44 del banco de CATIA (perno diamante, Joshi ej. 2.1; CATA 24/10/2026).

1. La cuenta: d = 2 raiz(D^2/4 - V W - V^2) = 55,5384, que redondea al 55,538 publicado; volumen del perno y de la placa.
2. pieza_ej67.py es la copia del ej67 con los cambios anotados (no corre suelto, no captura ni guarda; devuelve ctx) y
   choque_perno.py trae la cadena CONTROL de la practica.
3. Con build123d: choque_perno.py sobre un STEP armado aca (el perno y la placa con las mismas cuentas) da 0 en su lugar y
   corrido 0,15, choca corrido 0,20 y el redondo corrido 0,15 choca.
4. cerrar_con_papel(): VERDE con lo medido en la R21 de CATA (24/10 13:11); ROJO si el diamante choca corrido 0,15, si
   corrido 0,20 no choca (control ciego), si el redondo no choca (gemelo que no separa), si el STEP no trae la placa, si
   el perno no es la cuenta, si choque_perno.py no corre y si un paso fallo."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ44 = os.path.join(CATIA_DIR, "ejercicios", "44_perno_diamante")
sys.path.insert(0, CATIA_DIR)

PERNO = {"cuenta": {"d_mm": 55.5384, "publicado": 55.538}, "perno": {"vol": 1110.528, "cuenta": 1110.528},
         "placa": {"vol": 75764.164, "cuenta": 75764.164}}
CHOQUE = {"vol_perno": 1110.528, "vol_placa": 75764.164, "diamante_corrido_0": 0.0, "diamante_corrido_0.15": 0.0,
          "diamante_corrido_0.20": 0.006218, "redondo_corrido_0.15": 78.312796}          # 44_r1, 24/10 13:11
STEP = {"volumen": 76874.691, "solidos": 2, "cascaras": 2, "caras_sueltas": 0}                 # el perno y la placa


def cargar_ej44():
    spec = importlib.util.spec_from_file_location("ej44_catia", os.path.join(EJ44, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_d_y_volumenes(self):
        ej = cargar_ej44()
        self.assertAlmostEqual(ej.d, 55.5384, places=4)
        self.assertEqual(round(ej.d, 3), ej.D_FICHA)
        self.assertAlmostEqual(ej.V_PERNO, 1110.528, places=3)
        self.assertAlmostEqual(ej.V_PLACA, (100 * 100 - math.pi * 55.55 ** 2 / 4) * 10, places=6)

    def test_la_copia_del_ej67(self):
        with open(os.path.join(EJ44, "pieza_ej67.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej67_perno_diamante.py", texto)
        self.assertIn("from catia_base import nueva_pieza, ref, medir", texto)
        for prohibido in ("captura(", "guardar_pieza(", "correr(", "import subprocess", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        with open(os.path.join(EJ44, "choque_perno.py"), encoding="utf-8") as fh:
            control = fh.read()
        self.assertIn('"redondo_corrido_0.15": choque(redondo, 0.15)', control)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_el_control_separa(self):
        from build123d import BuildLine, BuildSketch, Circle, Line, Mode, Pos, Rectangle, ThreePointArc, export_step, \
            extrude, make_face, Compound
        ej = cargar_ej44()
        r, yc, w = ej.R, ej.YC, ej.W / 2
        with BuildSketch() as s:
            with BuildLine():
                Line((w, -yc), (w, yc))
                ThreePointArc((w, yc), (0, r), (-w, yc))
                Line((-w, yc), (-w, -yc))
                ThreePointArc((-w, -yc), (0, -r), (w, -yc))
            make_face()
        perno = extrude(s.sketch, ej.ESP)
        with BuildSketch() as p:
            Rectangle(100, 100)
            Circle(ej.D / 2, mode=Mode.SUBTRACT)
        placa = extrude(p.sketch, ej.ESP)
        tmp = tempfile.mkdtemp(prefix="ej44-occ-")
        step = os.path.join(tmp, "perno_y_placa.step")
        export_step(Compound([perno, placa]), step)
        ch = ej.correr_choque(step)
        self.assertNotIn("error", ch)
        self.assertEqual(ch["diamante_corrido_0"], 0.0)
        self.assertLess(ch["diamante_corrido_0.15"], ej.SIN_CHOQUE)
        self.assertGreater(ch["diamante_corrido_0.20"], ej.SIN_CHOQUE)
        self.assertGreater(ch["redondo_corrido_0.15"], ej.SIN_CHOQUE)
        self.assertAlmostEqual(ch["vol_perno"], ej.V_PERNO, delta=0.5)


class CorrerChoque(unittest.TestCase):
    def test_ramas(self):
        ej = cargar_ej44()
        import subprocess

        def tarda(args, **kw):
            raise subprocess.TimeoutExpired(args, kw.get("timeout"))
        self.assertIn("no corrio", ej.correr_choque("s.stp", correr=tarda)["error"])
        r = ej.correr_choque("s.stp", correr=lambda a, **k: types.SimpleNamespace(stdout="", stderr="ImportError: build123d"))
        self.assertIn("ImportError: build123d", r["error"])                 # el porque no se pierde (revisor)
        r = ej.correr_choque("s.stp", correr=lambda a, **k: types.SimpleNamespace(stdout="{roto", stderr=""))
        self.assertIn("JSON roto", r["error"])
        r = ej.correr_choque("s.stp", correr=lambda a, **k: types.SimpleNamespace(stdout=json.dumps(CHOQUE), stderr=""))
        self.assertEqual(r["redondo_corrido_0.15"], CHOQUE["redondo_corrido_0.15"])


class Juez(unittest.TestCase):
    def juez(self, perno=None, choque=None, ok_pasos=True, step=None):
        ej = cargar_ej44()
        tmp = tempfile.mkdtemp(prefix="ej44-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump({"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "perno": perno or PERNO}, f)
        vistos = []

        def falso(ruta):
            vistos.append(os.path.relpath(ruta, tmp))
            return dict(choque or CHOQUE)

        def medir(args):
            vistos.append(os.path.relpath(args[1], tmp))
            return {"partes": {"perno_diamante": dict(step or STEP)}}
        s = ej.cerrar_con_papel(tmp, choque=falso, medir=medir)
        self.assertEqual(vistos, [os.path.join(ej.EJ, ej.PARTE + ".stp")] * 2)
        return s

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)

    def test_rojo(self):
        self.assertIn("corrido 0,15", self.juez(choque=dict(CHOQUE, **{"diamante_corrido_0.15": 0.5}))["error"])
        self.assertIn("control no ve", self.juez(choque=dict(CHOQUE, **{"diamante_corrido_0.20": 0.0}))["error"])
        self.assertIn("gemelo no separa", self.juez(choque=dict(CHOQUE, **{"redondo_corrido_0.15": 0.0}))["error"])
        sin_placa = dict(CHOQUE)
        sin_placa.pop("vol_placa")
        self.assertIn("la placa", self.juez(choque=sin_placa)["error"])
        for parte, clave, delta in (("perno", "vol_perno", -0.481), ("placa", "vol_placa", 1.0)):
            # la pieza de CATIA y su STEP cambian JUNTOS: solo la cuenta lo puede ver (revisor del 44). El perno de
            # puntas planas (un rectangulo de 2 x 2 yc) pesa 0,481 mm3 menos: pasaba con TOL_VOL
            otro = json.loads(json.dumps(PERNO))
            otro[parte]["vol"] += delta
            ch = dict(CHOQUE, **{clave: CHOQUE[clave] + delta})
            r = self.juez(perno=otro, choque=ch)
            self.assertIn("contra la cuenta", r["error"])
            self.assertNotIn("el STEP no trae", r["error"])
        self.assertIn("en su lugar", self.juez(choque=dict(CHOQUE, **{"diamante_corrido_0": 1e-4}))["error"])
        self.assertIn("2 solidos", self.juez(step=dict(STEP, solidos=3))["error"])
        self.assertFalse(self.juez(choque={"error": "sin entorno"})["ok"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])
        self.assertFalse(self.juez(choque=dict(CHOQUE, **{"diamante_corrido_0.15": float("nan")}))["ok"])


if __name__ == "__main__":
    unittest.main()
