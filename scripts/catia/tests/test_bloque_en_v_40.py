# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 40 del banco de CATIA (bloque en V de 90 grados como ensamble, CATA 24/10/2026).

1. La cuenta: z = R raiz(2) para D 160 y 159,86 (113,1371 y 113,0381) y la diferencia 0,14 / (2 sen 45) = 0,098995, que
   redondea al 0,099 del papel (Atlantis Press, Example 1).
2. pieza_ej74.py es la copia del ej74 con los cambios anotados (no corre suelto; devuelve res).
3. cerrar_con_papel(): VERDE con lo medido en la R21 de CATA (24/10 12:51); ROJO si el solucionador no movio el eje (z
   200), si lo dejo del otro lado del vertice, si una restriccion no quedo resuelta o no vale R, si el eje se corrio del
   plano de simetria, si falta un D, si un paso fallo, si la diferencia no es la del papel aunque cada z entre (rojo
   solo por el papel) y con un NaN.
4. construir() con la pieza falsa: las claves de lo que devuelve la pieza son las que lee el juez."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ40 = os.path.join(CATIA_DIR, "ejercicios", "40_bloque_en_v")
sys.path.insert(0, CATIA_DIR)

ASIENTO = {"160.0": {"y": 0.0, "z": 113.1371, "cuenta_z": 113.1371,
                     "diag": {"pos_tras_subir": "0;0;200", "estados": [0, 0], "valores": [80.0, 80.0]}},
           "159.86": {"y": 0.0, "z": 113.0381, "cuenta_z": 113.0381,
                      "diag": {"pos_tras_subir": "0;0;200", "estados": [0, 0], "valores": [79.93, 79.93]}}}


def cargar_ej40():
    spec = importlib.util.spec_from_file_location("ej40_catia", os.path.join(EJ40, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_alturas_y_papel(self):
        ej = cargar_ej40()
        self.assertAlmostEqual(80 * math.sqrt(2), 113.1371, places=4)
        self.assertAlmostEqual(79.93 * math.sqrt(2), 113.0381, places=4)
        self.assertAlmostEqual(ej.CUENTA_MM, 0.098995, places=6)
        self.assertEqual(round(ej.CUENTA_MM, 3), ej.PUBLICADO_MM)

    def test_la_copia_del_ej74(self):
        with open(os.path.join(EJ40, "pieza_ej74.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej74_bloque_en_v.py", texto)
        self.assertIn("from catia_base import nueva_pieza, ref", texto)
        for prohibido in ("correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn("    return res", texto)


class Juez(unittest.TestCase):
    def juez(self, asiento, ok_pasos=True):
        ej = cargar_ej40()
        tmp = tempfile.mkdtemp(prefix="ej40-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump({"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "asiento": asiento}, f)
        return ej.cerrar_con_papel(tmp)

    def otro(self, d, **cambios):
        a = json.loads(json.dumps(ASIENTO))
        for k, v in cambios.items():
            if k in ("estados", "valores"):
                a[d]["diag"][k] = v
            else:
                a[d][k] = v
        return a

    def test_verde(self):
        s = self.juez(ASIENTO)
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)
        self.assertEqual(s["juez"]["desplazamiento_mm"], 0.099)

    def test_rojo(self):
        self.assertIn("R raiz(2)", self.juez(self.otro("160.0", z=200.0))["error"])           # no se movio
        self.assertIn("R raiz(2)", self.juez(self.otro("159.86", z=-113.0381))["error"])      # del otro lado del V
        self.assertIn("no quedaron resueltas", self.juez(self.otro("160.0", estados=[0, 1]))["error"])
        self.assertIn("no valen R", self.juez(self.otro("160.0", valores=[80.0, 79.93]))["error"])
        self.assertIn("plano de simetria", self.juez(self.otro("159.86", y=0.5))["error"])
        sin = json.loads(json.dumps(ASIENTO))
        sin.pop("159.86")
        self.assertIn("no asento", self.juez(sin)["error"])
        self.assertFalse(self.juez(ASIENTO, ok_pasos=False)["ok"])
        # cada z dentro de TOL_Z y la diferencia a 0,0007 de la cuenta (pasa) pero a 0,0007 del 0,099 publicado (no):
        # rojo SOLO por el papel (revisor del 40: ningun caso lo exigia)
        a = self.otro("160.0", z=113.1371 + 0.00035)
        a["159.86"]["z"] = 113.0381 - 0.00035
        r = self.juez(a)
        self.assertIn("contra el papel", r["error"])
        self.assertNotIn("contra la cuenta", r["error"])
        self.assertNotIn("R raiz(2)", r["error"])
        self.assertFalse(self.juez(self.otro("160.0", y=float("nan")))["ok"])            # un NaN no pasa


class Construir(unittest.TestCase):
    def test_las_claves_de_la_pieza_son_las_del_juez(self):
        """construir() con la pieza falsa (devuelve lo de la corrida real con claves float) y el juez sobre eso."""
        ej = cargar_ej40()
        res = {float(k): v for k, v in json.loads(json.dumps(ASIENTO)).items()}
        ej.cargar = lambda nombre, ruta: type("P", (), {"cuerpo": staticmethod(lambda c, reg: res)})
        salida = {}
        ej.construir(None, None, None, salida)
        self.assertEqual(sorted(salida["asiento"]), ["159.86", "160.0"])
        tmp = tempfile.mkdtemp(prefix="ej40-c-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(dict(salida, ok=False, ok_pasos=True, pendiente=True), f)
        self.assertTrue(ej.cerrar_con_papel(tmp)["ok"])


if __name__ == "__main__":
    unittest.main()
