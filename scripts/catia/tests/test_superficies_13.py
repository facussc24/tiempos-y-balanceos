# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 13 del banco de CATIA (superficies contra formulas, 24/10/2026).

1. Las formulas de CUENTA contra lo que midio CATIA en la practica del 19/10 (registro.json del ej51 y del ej52, otra
   corrida, otra fuente de los numeros) y las dos nuevas contra la cuenta a mano: media esfera 2 pi 25^2 = 3 926,991 y
   toro 4 pi^2 30 5 = 5 921,763.
2. Cada gemelo (el lado equivocado de offset, split y thick) cae lejos de la tolerancia: el control separa.
3. cerrar_con_cuentas(): VERDE con todo en la formula; ROJO con una medida corrida 0,1 %, con una que falta, con el STEP
   de una pieza sin medir, con su volumen corrido, con cascaras sueltas, con el STL restando (caras hacia adentro) y con
   los pasos en falla."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ13 = os.path.join(CATIA_DIR, "ejercicios", "13_superficies_exactas")
sys.path.insert(0, CATIA_DIR)

# CATIA R21 de la PC principal, 19/10/2026: C:\Dev\_catia_practica\ej51_superficies_exactas\registro.json y ej52
PRACTICA_19_10 = {"lateral_revolucion": 2980.376, "lateral_multiseccion": 2980.376, "tapa_r1": 1256.637,
                  "tapa_r2": 314.159, "volumen_tronco": 21991.149, "tubo_barrido": 2467.401, "cilindro": 3769.911,
                  "offset_afuera": 4335.398, "volumen_thick": 7916.813, "split_arriba": 2513.274,
                  "empalme": 3892.699}
A_MANO = {"media_esfera": 3926.991, "toro": 5921.763}
PIEZAS = ("superficies_tronco", "superficies_cilindro")


def cargar():
    spec = importlib.util.spec_from_file_location("ej13_catia", os.path.join(EJ13, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Formulas(unittest.TestCase):
    def test_contra_la_practica_y_a_mano(self):
        ej = cargar()
        self.assertEqual(set(ej.CUENTA), set(PRACTICA_19_10) | set(A_MANO))
        for k, v in {**PRACTICA_19_10, **A_MANO}.items():
            self.assertLess(abs(ej.CUENTA[k] - v), 0.001, k)

    def test_gemelos_separan(self):
        ej = cargar()
        for k, g in ej.GEMELO.items():
            self.assertGreater(abs(g - ej.CUENTA[k]), 100 * ej.TOL_REL * ej.CUENTA[k], k)
        # los del 19/10: offset hacia adentro 3 204,425 (ej52, registro)
        self.assertLess(abs(ej.GEMELO["offset_afuera"] - 3204.425), 0.001)


class Cierre(unittest.TestCase):
    def preparar(self, cambio=None, quitar=None, step=None, stl=None, ok=True):
        """step / stl: {pieza: dict que reemplaza lo que mide build123d / trimesh, o «falta» si no esta el archivo}."""
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej13-")
        med = dict(ej.CUENTA)
        if cambio:
            med[cambio] *= 1.001
        if quitar:
            med.pop(quitar)
        vol = {p: ej.CUENTA[ej.VOLUMEN_PIEZA[p]] for p in PIEZAS}
        archivos = []
        os.makedirs(os.path.join(tmp, ej.EJ))
        for p in PIEZAS:
            for ext in ("stp", "stl"):
                if ((step if ext == "stp" else stl) or {}).get(p) == "falta":
                    continue
                rel = os.path.join(ej.EJ, f"{p}.{ext}")
                open(os.path.join(tmp, rel), "w").close()
                archivos.append(rel)
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump({"ok": ok, "medidas_catia": med, "volumen_catia": vol, "archivos": archivos}, f)

        def medir(args):
            modo, ruta = args
            p = os.path.splitext(os.path.basename(ruta))[0]
            if modo == "step":
                d = {"volumen": vol[p], "solidos": 1, "cascaras": 1, "caras_sueltas": 0}
                d.update((step or {}).get(p) or {})
            else:
                d = {"volumen_stl": vol[p] * 0.998, "cerrado": True, "orientacion_consistente": True,
                     "partes_negativas": 0}
                d.update((stl or {}).get(p) or {})
            return {"partes": {p: d}}
        return ej.cerrar_con_cuentas(tmp, medir=medir)

    def test_verde(self):
        s = self.preparar()
        self.assertTrue(s["ok"], s.get("error"))

    def test_rojo_medida_corrida(self):
        s = self.preparar(cambio="toro")
        self.assertFalse(s["ok"])
        self.assertIn("toro", s["error"])

    def test_rojo_medida_que_falta(self):
        s = self.preparar(quitar="empalme")
        self.assertFalse(s["ok"])
        self.assertIn("empalme: sin medir", s["error"])

    def test_rojo_step_sin_archivo_corrido_o_sucio(self):
        s = self.preparar(step={"superficies_cilindro": "falta"})
        self.assertFalse(s["ok"])
        self.assertIn("STEP de superficies_cilindro sin medir", s["error"])
        s = self.preparar(step={"superficies_tronco": {"volumen": 21000.0}})
        self.assertFalse(s["ok"])
        self.assertIn("superficies_tronco", s["error"])
        s = self.preparar(step={"superficies_tronco": {"cascaras": 9, "caras_sueltas": 968}})     # NOTAS 19/10
        self.assertFalse(s["ok"])
        self.assertIn("se exporta lo visible", s["error"])

    def test_rojo_stl_que_resta_o_abierto(self):
        s = self.preparar(stl={"superficies_tronco": {"volumen_stl": -21991.1}})
        self.assertFalse(s["ok"])
        self.assertIn("STL de superficies_tronco", s["error"])
        s = self.preparar(stl={"superficies_cilindro": {"cerrado": False}})
        self.assertFalse(s["ok"])
        s = self.preparar(stl={"superficies_cilindro": "falta"})
        self.assertFalse(s["ok"])
        self.assertIn("no esta el archivo", s["error"])
        # como la v16 (-3,84 %): lo caza el cuerpo negativo, no el porcentaje
        s = self.preparar(stl={"superficies_tronco": {"volumen_stl": 21991.149 * (1 - 0.0384), "partes_negativas": 1}})
        self.assertFalse(s["ok"])
        self.assertIn("volumen negativo", s["error"])
        # el facetado real del tronco (-1,23 %, 24/10 09:31) es verde
        self.assertTrue(self.preparar(stl={"superficies_tronco": {"volumen_stl": 21720.127}})["ok"])

    def test_pasos_con_falla_es_rojo(self):
        self.assertFalse(self.preparar(ok=False)["ok"])


if __name__ == "__main__":
    unittest.main()
