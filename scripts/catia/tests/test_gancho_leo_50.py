# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 50 del banco de CATIA (el gancho de Leo rehecho en CATIA, CATA 24/10/2026).

1. El contorno de pieza_gancho_leo.py tiene el area de la union y las restas de build_gancho_leo.py: con el params del
   repo, area x profundidad = el volumen del pad que midio CATIA (95 172 mm3).
2. Con build123d: las cotas son las de derivadas() de build_gancho_leo.py, y el contorno extruido ES el solido que arma
   construir() antes de los redondeos (mismo volumen y misma caja).
3. cerrar_con_referencia(): VERDE con lo medido en la R21 de CATA (24/10 14:02); ROJO si sobra o falta material, si el
   centro se corrio, si la referencia no se genero, con una excepcion fuera de un paso y si un paso fallo."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ50 = os.path.join(CATIA_DIR, "ejercicios", "50_gancho_leo")
sys.path.insert(0, CATIA_DIR)

COMPARA = {"vol_A": 97335.187, "vol_B": 97335.187, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "comun": 97335.187,
           "booleana_cierra": True, "tolerancia_booleana": 0.0001, "dist_max_A_a_B": 0.0, "p99_A_a_B": 0.0,
           "dist_max_B_a_A": 0.0, "p99_B_a_A": 0.0, "caja_A": [130.6, 57.0, 35.0], "caja_B": [130.6, 57.0, 35.0],
           "solidos": [1, 1]}                                    # 50_r1, R21 de CATA, 24/10/2026 14:02
CDG = [0.0, 23.326, 17.5]


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def pieza():
    import catia_base  # noqa: F401  (la pieza lo importa)
    return cargar("pieza_gancho_leo_t", os.path.join(EJ50, "pieza_gancho_leo.py"))


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Contorno(unittest.TestCase):
    def test_area_por_profundidad_es_el_pad(self):
        ej = cargar("ej50_catia", os.path.join(EJ50, "catia.py"))
        self.assertTrue(ej.PARAMS.startswith(ej.jc.REPO))           # el paquete del obrero no trae la skill
        pg = pieza()
        with open(ej.PARAMS, encoding="utf-8") as f:
            k = pg.cotas(json.load(f))
        pts = pg.contorno(k)
        self.assertEqual(len(pts), 16)
        self.assertGreater(pg.area_contorno(pts), 0)                # antihorario
        self.assertAlmostEqual(pg.area_contorno(pts) * k["w"], 95172.0, places=3)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def setUp(self):
        self._path = list(sys.path)

    def tearDown(self):
        sys.path[:] = self._path
        sys.modules.pop("build_gancho_leo", None)

    def test_el_contorno_es_el_solido_de_build_gancho_leo(self):
        from build123d import Plane, Polygon, extrude
        ej = cargar("ej50_catia_b", os.path.join(EJ50, "catia.py"))
        sys.path.insert(0, os.path.dirname(ej.BUILD))
        import build_gancho_leo as bl
        pg = pieza()
        with open(ej.PARAMS, encoding="utf-8") as f:
            p = json.load(f)
        k, d = pg.cotas(p), bl.derivadas(p)
        self.assertEqual((k["ui"], k["U"], k["up"], k["v_h"], k["v_t"]), (d["ui"], d["U"], d["u_punta"], d["v_hombro"],
                                                                          d["v_top"]))
        mio = extrude(Plane.XY * Polygon(*pg.contorno(k), align=None), amount=k["w"])
        # construir() de build_gancho_leo.py DE VERDAD, sin los redondeos (revisor del 50: no una copia de sus cajas)
        original = bl.redondear
        bl.redondear = lambda solido, aristas, radio, etiqueta, avisos: solido
        try:
            suyo, _ = bl.construir(p)
        finally:
            bl.redondear = original
        self.assertLess(abs(mio.volume - suyo.volume), 1e-6)
        self.assertLess((mio - suyo).volume + (suyo - mio).volume, 1e-6)


class Juez(unittest.TestCase):
    def juez(self, comparado=None, ref=None, cdg_catia=None, ok_pasos=True, error=None, topo=None):
        ej = cargar("ej50_catia_j", os.path.join(EJ50, "catia.py"))
        tmp = tempfile.mkdtemp(prefix="ej50-")
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True,
             "step_catia_en_build123d": {"gancho_LEO": {"cdg_mm": cdg_catia or list(CDG), "solidos": 1, "cascaras": 1, "caras_sueltas": 0}}}
        if topo:
            s["step_catia_en_build123d"]["gancho_LEO"].update(topo)
        if error:
            s["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        r = ref or {"step": "ref.step", "cuentas": {"volumen_cm3": 97.335}}
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
        self.assertIn("sobra", self.juez(comparado=dict(COMPARA, sobra_A_menos_B=5.0))["error"])
        self.assertIn("centro", self.juez(cdg_catia=[0.0, 23.4, 17.5])["error"])
        self.assertIn("no corrio", self.juez(ref={"error": "build_gancho_leo.py no corrio"})["error"])
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])


if __name__ == "__main__":
    unittest.main()
