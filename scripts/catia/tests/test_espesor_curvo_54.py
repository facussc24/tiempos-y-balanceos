# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 54 del banco de CATIA (espesor de 3 sobre un arco R600, CATA 24/10/2026).

1. cuenta(): el sector de anillo por la formula da lo mismo que un poligono de 20 000 lados (volumen y centro), que no
   comparte la formula; y los numeros de la fila de la COLA (88 127,7 y 88 569,4) NO cierran con ella.
2. lado_de(): el centro que midio CATIA de cada lado cae de su lado del arco; elegir_forma() con un CATIA de mentira borra
   la forma que cae del otro lado y sigue, y la que falla no la deja.
3. cerrar_con_cuenta(): VERDE con lo medido en la R21 de CATA (24/10 15:12, 54_r3); ROJO con los lados cambiados, con el
   circulo entero (3 769,9), con la cara suelta de 54_r1 y r2, con dos solidos, con un NaN, con una excepcion fuera de un
   paso y si un paso fallo."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ54 = os.path.join(CATIA_DIR, "ejercicios", "54_espesor_curvo")
sys.path.insert(0, CATIA_DIR)

MEDIDO = {   # 54_r3, R21 de CATA, 24/10/2026 15:12
    "adentro": {"vol": 88129.125, "cdg": [0.0, 591.866, 47.5], "step_cdg": [0.0, 591.8665, 47.5]},
    "afuera": {"vol": 88570.875, "cdg": [-0.0, 594.833, 47.5], "step_cdg": [-0.0, 594.8332, 47.5]},
}


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def ej():
    return cargar("ej54_catia", os.path.join(EJ54, "catia.py"))


def poligono(r1, r2, th, n=20000):
    """Area y centro del sector de anillo como poligono (formula del cordon), sin la formula del sector."""
    pts = [(r2 * math.sin(-th / 2 + th * i / n), r2 * math.cos(-th / 2 + th * i / n)) for i in range(n + 1)]
    pts += [(r1 * math.sin(th / 2 - th * i / n), r1 * math.cos(th / 2 - th * i / n)) for i in range(n + 1)]
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        k = x0 * y1 - x1 * y0
        a += k
        cx += (x0 + x1) * k
        cy += (y0 + y1) * k
    a /= 2
    return abs(a), [cx / (6 * a), cy / (6 * a)]


class Cuenta(unittest.TestCase):
    def test_formula_contra_poligono(self):
        e = ej()
        for lado, (r1, r2) in e.RADIOS.items():
            v, c = e.cuenta(lado)
            a, cp = poligono(r1, r2, e.TH)
            self.assertLess(abs(v - a * e.ANCHO), 0.05, lado)
            self.assertLess(abs(c[1] - cp[1]), 1e-3, lado)
            self.assertLess(abs(c[0] - cp[0]), 1e-6, lado)
            self.assertLess(abs(v - MEDIDO[lado]["vol"]), 1e-3, lado)          # CATIA dio la cuenta a 0,001

    def test_la_fila_de_la_cola_no_cierra_con_su_formula(self):
        e = ej()
        for lado in e.RADIOS:
            self.assertGreater(abs(e.cuenta(lado)[0] - e.FILA_COLA[lado]), 1.0)    # 1,4 y 1,5 mm3


class Lado(unittest.TestCase):
    def test_cada_centro_de_su_lado(self):
        import catia_base  # noqa: F401  (la pieza lo importa)
        pz = cargar("pieza_ej83_t", os.path.join(EJ54, "pieza_ej83.py"))
        self.assertEqual(pz.lado_de(MEDIDO["adentro"]["cdg"]), "adentro")
        self.assertEqual(pz.lado_de(MEDIDO["afuera"]["cdg"]), "afuera")
        self.assertLess(591.87, pz.R_ARCO)
        self.assertLess(pz.R_ARCO, 594.83)


class Forma(unittest.TestCase):
    """elegir_forma() con un CATIA de mentira: cada forma deja un centro; la del otro lado o la que falla se borra."""
    def correr(self, lado, centros):
        import catia_base  # noqa: F401
        pz = cargar("pieza_ej83_f", os.path.join(EJ54, "pieza_ej83.py"))
        hechos, borrados, actual = [], [], {}

        def crear(forma):
            c = centros[len(hechos)]
            hechos.append(forma)
            if c is None:
                raise RuntimeError("Update failed")
            actual["c"] = c
            return f"obj{len(hechos)}"
        return pz, (lambda: pz.elegir_forma(lado, crear, lambda: actual["c"], borrados.append)), hechos, borrados

    def test_adentro_a_la_primera(self):
        pz, f, hechos, borrados = self.correr("adentro", [MEDIDO["adentro"]["cdg"]])
        self.assertEqual(f()[0], pz.FORMAS[0])
        self.assertEqual(borrados, [])

    def test_afuera_borra_la_de_adentro(self):                # lo que paso en 54_r1 a r3
        pz, f, hechos, borrados = self.correr("afuera", [MEDIDO["adentro"]["cdg"], MEDIDO["afuera"]["cdg"]])
        forma, intentos = f()
        self.assertEqual(forma, (0, 0.0, 3.0))
        self.assertEqual(borrados, ["obj1"])
        self.assertEqual(len(intentos), 2)

    def test_la_que_falla_no_se_borra_y_se_sigue(self):
        pz, f, hechos, borrados = self.correr("afuera", [None, MEDIDO["afuera"]["cdg"]])
        self.assertEqual(f()[0], pz.FORMAS[1])
        self.assertEqual(borrados, [])

    def test_ninguna_da_el_lado(self):
        pz, f, hechos, borrados = self.correr("afuera", [MEDIDO["adentro"]["cdg"]] * 4)
        with self.assertRaises(RuntimeError):
            f()
        self.assertEqual(borrados, ["obj1", "obj2", "obj3", "obj4"])


TOPO_BIEN = {"solidos": 1, "cascaras": 1, "faces": 6, "faces_sueltas": 0, "edges": 12, "edges_sueltas": 0, "vertices": 8,
             "vertices_sueltas": 0}                                  # 54_r3, los dos lados
TOPO_R1 = {"solidos": 1, "cascaras": 2, "faces": 7, "faces_sueltas": 1, "edges": 17, "edges_sueltas": 5, "vertices": 17,
           "vertices_sueltas": 9}                                    # 54_r1, adentro


class Juez(unittest.TestCase):
    def juez(self, cambia=None, largo=310.0, step=None, ok_pasos=True, error=None, topo=None):
        e = ej()
        tmp = tempfile.mkdtemp(prefix="ej54-")
        m = json.loads(json.dumps(MEDIDO))
        if cambia:
            cambia(m)
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True,
             "volumen_catia": {f"espesor_{k}": v["vol"] for k, v in m.items()},
             "cdg_catia_mm": {f"espesor_{k}": v["cdg"] for k, v in m.items()},
             "espesor": {k: {"superficie": {"largo_arco": largo}} for k in m},
             "step_catia_en_build123d": {f"espesor_{k}": dict({"volumen": v["vol"], "cdg_mm": v["step_cdg"], "solidos": 1,
                                                               "caras_sueltas": 0}, **(step or {})) for k, v in m.items()}}
        if error:
            s["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return e.cerrar_con_cuenta(tmp, topo=topo or (lambda paso: dict(TOPO_BIEN)))

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)

    def test_rojo(self):
        def cambiados(m):
            m["adentro"], m["afuera"] = m["afuera"], m["adentro"]
        self.assertIn("volumen de CATIA", self.juez(cambia=cambiados)["error"])

        def corrido(m):
            m["afuera"]["cdg"] = [0.0, 594.86, 47.5]
        self.assertIn("centro de CATIA", self.juez(cambia=corrido)["error"])

        def nan(m):
            m["adentro"]["step_cdg"] = [0.0, 591.8665, float("nan")]
        self.assertIn("centro del STEP", self.juez(cambia=nan)["error"])
        self.assertIn("el arco mide", self.juez(largo=3769.911)["error"])
        self.assertIn("caras sueltas", self.juez(step={"caras_sueltas": 1})["error"])        # 54_r1 y r2
        self.assertIn("caras sueltas", self.juez(step={"solidos": 2})["error"])
        r1 = self.juez(topo=lambda paso: dict(TOPO_R1) if "adentro" in paso else dict(TOPO_BIEN))
        self.assertIn("adentro: la topologia del STEP", r1["error"])
        self.assertNotIn("afuera: la topologia", r1["error"])
        solo_cascara = self.juez(topo=lambda paso: dict(TOPO_BIEN, cascaras=2))       # lo que el revisor probo a mano
        self.assertIn("la topologia del STEP", solo_cascara["error"])
        self.assertIn("la topologia del STEP", self.juez(topo=lambda paso: {"error": "no corrio"})["error"])

        def vol_nan(m):
            m["afuera"]["vol"] = float("nan")
        self.assertIn("volumen de CATIA", self.juez(cambia=vol_nan)["error"])
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])


if __name__ == "__main__":
    unittest.main()
