# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 32 del banco de CATIA (el virolador v16 entregado, rehecho en CATIA; 24/10/2026).
1. La copia del ej13_v16 trae solo los dos cambios anotados (etapa 5 fija, poligonos junto al script) y los poligonos.
2. cerrar_con_entregado: VERDE con sobra 0, falta 0 y 0,0016 mm (lo del 19/10); ROJO si sobra o falta mas de 1 mm3, si la
   distancia pasa de 0,01 mm, si el STEP entregado no esta o cambio (sha256), si CATIA no dejo el STEP, y el error del
   juez no queda pegado con «ok» verdadero (cierre idempotente)."""
import hashlib
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ32 = os.path.join(CATIA_DIR, "ejercicios", "32_virolador_v16")
sys.path.insert(0, CATIA_DIR)
BIEN = {"vol_A": 89278.48, "vol_B": 89278.48, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "dist_max_A_a_B": 0.0016,
        "dist_max_B_a_A": 0.0016, "booleana_cierra": True, "solidos": [1, 1]}


def cargar():
    spec = importlib.util.spec_from_file_location("ej32_catia", os.path.join(EJ32, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Copia(unittest.TestCase):
    def test_solo_los_dos_cambios(self):
        texto = open(os.path.join(EJ32, "ej13_v16.py"), encoding="utf-8").read()
        self.assertEqual(texto.count("CAMBIO "), 2)
        self.assertIn("ETAPA = 5", texto)
        self.assertTrue(os.path.isfile(os.path.join(EJ32, "v16_ref", "poligonos.json")))


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, con_ref=True, con_step=True, error_juez=None, ok_pasos=True, otra_ref=False):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej32-")
        ref = os.path.join(tmp, "entregado.step")
        with open(ref, "wb") as f:
            f.write(b"STEP de prueba")
        ej.REFERENCIA = ref if con_ref else os.path.join(tmp, "no_esta.step")
        ej.SHA_REFERENCIA = hashlib.sha256(b"otro STEP" if otra_ref else b"STEP de prueba").hexdigest()
        os.makedirs(os.path.join(tmp, "x"))
        if con_step:
            open(os.path.join(tmp, "x", "out_etapa5.stp"), "w").close()
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": "x", "archivos": [os.path.join("x", "out_etapa5.stp")]}
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        d = dict(BIEN, **(cambio or {}))
        r = ej.cerrar_con_entregado(tmp, comparar=lambda a, b: d)
        return r, tmp, ej, d

    def test_verde(self):
        r, *_ = self.cerrar()
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("error", r)

    def test_rojos(self):
        self.assertFalse(self.cerrar({"sobra_A_menos_B": 2.0})[0]["ok"])
        self.assertFalse(self.cerrar({"falta_B_menos_A": 1.5})[0]["ok"])
        self.assertFalse(self.cerrar({"dist_max_B_a_A": 0.05})[0]["ok"])
        self.assertFalse(self.cerrar(con_ref=False)[0]["ok"])
        self.assertFalse(self.cerrar(con_step=False)[0]["ok"])

    def test_rojos_del_revisor(self):
        nan = float("nan")
        rojos = {
            "el STEP entregado cambio (sha256)": dict(otra_ref=True),
            "un paso fallo": dict(ok_pasos=False),
            "error del juez con los pasos ok": dict(error_juez="excepcion fuera de un paso"),
            "booleana que no cierra": dict(cambio={"booleana_cierra": False}),
            "dos solidos en CATIA": dict(cambio={"solidos": [2, 1]}),
            "NaN en la distancia": dict(cambio={"dist_max_A_a_B": nan}),
            "NaN en lo que sobra": dict(cambio={"sobra_A_menos_B": nan}),
            "NaN en el volumen": dict(cambio={"vol_A": nan}),
            "volumen corrido": dict(cambio={"vol_A": 89270.0}),
            "distancia de A a B": dict(cambio={"dist_max_A_a_B": 0.05}),
        }
        for que, k in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(**k)[0]["ok"])

    def test_comparacion_vacia_es_rojo(self):
        ej = cargar()
        self.assertTrue(ej.revisar_comparacion({}))
        r, tmp, ej, _ = self.cerrar()
        r2 = ej.cerrar_con_entregado(tmp, comparar=lambda a, b: {})
        self.assertFalse(r2["ok"])

    def test_idempotente(self):
        r, tmp, ej, d = self.cerrar({"sobra_A_menos_B": 2.0})
        self.assertFalse(r["ok"])
        r2 = ej.cerrar_con_entregado(tmp, comparar=lambda a, b: BIEN)       # segundo cierre, ahora bien
        self.assertTrue(r2["ok"], r2.get("error"))
        self.assertNotIn("error", r2)


if __name__ == "__main__":
    unittest.main()
