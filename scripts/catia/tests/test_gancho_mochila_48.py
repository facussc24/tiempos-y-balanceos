# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 48 del banco de CATIA (el gancho de mochila v2 rehecho en CATIA, CATA 24/10/2026).

1. Las cotas de pieza_gancho.cotas() son las de build_gancho.py (derivadas() y construir_clip()) con el params.json del
   repo: si alguien cambia una, la pieza de CATIA y la referencia ya no son la misma.
2. Con build123d: el chaflan de entrada del lado +Y no corta en build_gancho.py (el triangulo extruye hacia -Z): es
   lo que dice LADOS_CHAFLAN = (-1,). Si alguien arregla build_gancho.py, esta prueba da rojo y avisa que hay que
   cambiar LADOS_CHAFLAN.
3. cerrar_con_referencia(): VERDE con lo medido en la R21 de CATA (24/10 13:58); ROJO si sobra o falta material, si la
   distancia pasa de 0,01 mm, si el centro se corrio, si la referencia no se genero, si el diseno no cumple a/L, con una
   excepcion fuera de un paso y si un paso fallo."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ48 = os.path.join(CATIA_DIR, "ejercicios", "48_gancho_mochila")
sys.path.insert(0, CATIA_DIR)

COMPARA = {"vol_A": 40505.558, "vol_B": 40505.593, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "comun": 40505.558,
           "booleana_cierra": True, "tolerancia_booleana": 0.0001, "dist_max_A_a_B": 0.0002, "p99_A_a_B": 0.0,
           "dist_max_B_a_A": 0.0001, "p99_B_a_A": 0.0, "caja_A": [34.0, 95.9, 28.0], "caja_B": [34.0, 95.9, 28.0],
           "solidos": [1, 1]}                                    # 48_r3, R21 de CATA, 24/10/2026 13:58
CUENTAS = {"a_sobre_L": 2.071, "exigido_1_sobre_2mu": 1.667, "volumen_gancho_cm3": 40.506}
CDG = [7.389, 27.7034, 10.7755]                           # el STEP de CATIA en build123d, 48_r3


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cotas(unittest.TestCase):
    def test_params_del_repo(self):
        ej = cargar("ej48_catia", os.path.join(EJ48, "catia.py"))
        self.assertTrue(os.path.isfile(ej.PARAMS), ej.PARAMS)
        self.assertTrue(ej.PARAMS.startswith(ej.jc.REPO))           # el paquete del obrero no trae la skill
        sys.modules.setdefault("catia_base", importlib.import_module("catia_base"))
        pg = cargar("pieza_gancho48_t", os.path.join(EJ48, "pieza_gancho.py"))
        with open(ej.PARAMS, encoding="utf-8") as f:
            k = pg.cotas(json.load(f))
        self.assertEqual((k["yi"], k["ye"], k["y_raiz"], k["x0"], k["ancho_X"]), (13.9, 21.9, 21.9, -8.0, 34.0))
        self.assertEqual(pg.LADOS_CHAFLAN, (-1,))


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def setUp(self):
        self._path = list(sys.path)

    def tearDown(self):
        sys.path[:] = self._path
        sys.modules.pop("build_gancho", None)

    def test_cotas_son_las_de_build_gancho(self):
        ej = cargar("ej48_catia_b", os.path.join(EJ48, "catia.py"))
        sys.path.insert(0, os.path.dirname(ej.BUILD))
        import build_gancho as bg
        pg = cargar("pieza_gancho48_b", os.path.join(EJ48, "pieza_gancho.py"))
        with open(ej.PARAMS, encoding="utf-8") as f:
            p = json.load(f)
        k, d = pg.cotas(p), bg.derivadas(p)
        self.assertEqual((k["y_raiz"], k["x0"], k["ancho_X"]), (d["y_raiz"], d["x0"], d["ancho_X"]))
        _, yi, ye = bg.construir_clip(p, boca=p["clip"]["boca"])
        self.assertEqual((k["yi"], k["ye"]), (yi, ye))

    def test_el_chaflan_mas_y_no_corta_en_build_gancho(self):
        """Se sondea el SOLIDO que arma build_gancho.py (no una copia del bucle: revisor del 48): un punto adentro de cada
        chaflan es aire si ese lado se corta. Si alguien arregla el script, el lado +Y pasa a aire y esto da rojo."""
        from build123d import Vector
        ej = cargar("ej48_catia_c", os.path.join(EJ48, "catia.py"))
        sys.path.insert(0, os.path.dirname(ej.BUILD))
        import build_gancho as bg
        with open(ej.PARAMS, encoding="utf-8") as f:
            p = json.load(f)
        pieza, _ = bg.construir_gancho(p)
        c = p["clip"]
        x, dy = c["p_ala"] - 0.5, 0.4                # adentro del triangulo de 2 x 2 del chaflan, en z = 5
        cortados = tuple(s for s in (1, -1) if not pieza.is_inside(Vector(x, s * (c["boca"] / 2 + dy), 5.0)))
        pg = cargar("pieza_gancho48_c", os.path.join(EJ48, "pieza_gancho.py"))
        self.assertEqual(cortados, pg.LADOS_CHAFLAN)


class Juez(unittest.TestCase):
    def juez(self, comparado=None, ref=None, cdg_catia=None, ok_pasos=True, error=None, topo=None):
        ej = cargar("ej48_catia_j", os.path.join(EJ48, "catia.py"))
        tmp = tempfile.mkdtemp(prefix="ej48-")
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True,
             "step_catia_en_build123d": {"gancho_mochila_v2": {"cdg_mm": cdg_catia or list(CDG), "solidos": 1, "cascaras": 1, "caras_sueltas": 0}}}
        if topo:
            s["step_catia_en_build123d"]["gancho_mochila_v2"].update(topo)
        if error:
            s["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        r = ref or {"step": "ref.step", "cuentas": dict(CUENTAS)}
        return ej.cerrar_con_referencia(tmp, referencia=lambda carpeta: r,
                                        comparar_con=lambda a, b: dict(comparado or COMPARA),
                                        medir=lambda args: {"partes": {"r": {"cdg_mm": list(CDG)}}})

    def test_cara_suelta_en_el_step(self):
        """Auditor de la tanda (24/10): un STEP con una cara suelta pasaba."""
        s = self.juez(topo={"cascaras": 2, "caras_sueltas": 1})
        self.assertFalse(s["ok"])
        self.assertIn("no es 1 solido cerrado", s["error"])

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)

    def test_rojo(self):
        self.assertIn("sobra", self.juez(comparado=dict(COMPARA, falta_B_menos_A=56.0))["error"])   # el chaflan +Y
        self.assertIn("distancia", self.juez(comparado=dict(COMPARA, dist_max_A_a_B=0.05))["error"])
        self.assertIn("centro", self.juez(cdg_catia=[7.389, 27.7034, 10.8])["error"])
        self.assertIn("no corrio", self.juez(ref={"error": "build_gancho.py no corrio"})["error"])
        self.assertIn("a/L", self.juez(ref={"step": "r", "cuentas": dict(CUENTAS, a_sobre_L=1.4)})["error"])
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])
        self.assertFalse(self.juez(comparado=dict(COMPARA, sobra_A_menos_B=float("nan")))["ok"])


if __name__ == "__main__":
    unittest.main()
