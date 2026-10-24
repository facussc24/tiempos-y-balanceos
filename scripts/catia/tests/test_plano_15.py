# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 15 del banco de CATIA (plano del Tool Block: preguntas 1 y 2 del examen, 24/10/2026).

1. Las respuestas de la lamina 12 y el metodo de CATIA que corresponde a cada una (los nombres de la ayuda de
   automatizacion: DefinePolygonalClippingView y DefineBreakout).
2. Las cotas que GenerateDimensions tiene que traer del croquis del 11 en la q3: los cuatro radios, el angulo de 10 grados
   EN RADIANES y el largo C = lo que trajo la corrida real del 24/10 10:05 (0,175 / 5 / 7 / 19 / 29 / 43).
3. faltan() cuenta repetidas (multiconjunto) y cerrar_con_plano da VERDE con todo y ROJO sin una cota, con una pregunta
   que fallo, sin PDF o con el cruce de volumen en falso."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ15 = os.path.join(CATIA_DIR, "ejercicios", "15_plano_tool_block")
sys.path.insert(0, CATIA_DIR)
GENERADAS_10_05 = [0.175, 5.0, 7.0, 19.0, 29.0, 43.0]       # salida.json de la corrida del 24/10 10:05 (R21)
ESPERADAS = [5.0, 7.0, 19.0, 29.0, 43.0]
# lo que midio medir_plano.py en el PDF de las 10:10 (sin borrar el angulo: la linea del angulo caia en el Costado)
PDF_10_10 = {"trazos": {"Frente": 24, "Recorte": 13, "Costado": 14, "Arranque": 31},
             "ancho_mm": {"Frente": 97.69, "Recorte": 45.0, "Costado": 43.0, "Arranque": 43.0},
             "palabras": ["Frente", "19", "R", "29", "R", "5", "R", "7", "R", "Costado", "43", "Recorte", "Arranque"]}


def cargar():
    spec = importlib.util.spec_from_file_location("ej15_catia", os.path.join(EJ15, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Plano(unittest.TestCase):
    def test_respuestas_de_la_lamina_12(self):
        ej = cargar()
        self.assertEqual(ej.RESPUESTAS["pregunta_1"], ("b) Clipping View Profile", "DefinePolygonalClippingView"))
        self.assertEqual(ej.RESPUESTAS["pregunta_2"], ("c) Breakout View", "DefineBreakout"))

    def test_cotas_esperadas_son_las_de_la_corrida(self):
        ej = cargar()
        esperadas = ej.cotas_que_se_generan(ej._cargar("11_tool_block_parametrico", "ej11_desde_15"))
        self.assertEqual(esperadas, ESPERADAS)              # los radios y C; el angulo se borra (cruza la hoja)
        self.assertEqual(ej.faltan(esperadas, GENERADAS_10_05), [])

    def test_faltan_cuenta_repetidas(self):
        ej = cargar()
        self.assertEqual(ej.faltan([7.0, 7.0], [7.0]), [7.0])
        self.assertEqual(ej.faltan([7.0], [7.0004]), [])
        self.assertEqual(ej.faltan([7.0], [7.01]), [7.0])

    def cerrar(self, generadas=GENERADAS_10_05, examen=None, pdf=True, ok=True, medido=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej15-")
        ex = {k: {"ok": True} for k in ej.RESPUESTAS}
        ex.update(examen or {})
        s = {"ok": ok, "examen": ex, "cotas_esperadas": ESPERADAS, "cotas_generadas": generadas,
             "archivos": [os.path.join("x", ej.NOMBRE + ".pdf")] if pdf else []}
        if pdf:
            os.makedirs(os.path.join(tmp, "x"))
            open(os.path.join(tmp, "x", ej.NOMBRE + ".pdf"), "w").close()
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        m = json.loads(json.dumps(PDF_10_10))
        for k, v in (medido or {}).items():
            m[k].update(v) if isinstance(v, dict) else m.__setitem__(k, v)
        return ej.cerrar_con_plano(tmp, medir_pdf=lambda *_: m)

    def test_verde(self):
        s = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertEqual(s["cotas_lamina_04"]["R19"], "en el plano")
        self.assertIn("coordenadas", s["cotas_lamina_04"]["32"])

    def test_rojos(self):
        self.assertFalse(self.cerrar(generadas=[0.175, 5.0, 7.0, 19.0, 43.0])["ok"])          # sin el R29
        self.assertFalse(self.cerrar(examen={"pregunta_2": {"ok": False, "error": "E_FAIL"}})["ok"])
        self.assertFalse(self.cerrar(pdf=False)["ok"])
        self.assertFalse(self.cerrar(ok=False)["ok"])

    def test_el_pdf_caza_vistas_que_no_hacen_nada(self):
        """Gemelos (revisor del 15): un recorte que no recorta deja el frente entero (81 mm de ancho); un arranque que no
        arranca deja los mismos trazos que el costado; una cota que no se ve no tiene su texto en el PDF."""
        s = self.cerrar(medido={"ancho_mm": {"Recorte": 81.0}})
        self.assertFalse(s["ok"])
        self.assertIn("pregunta 1", s["error"])
        s = self.cerrar(medido={"trazos": {"Arranque": 14}})
        self.assertFalse(s["ok"])
        self.assertIn("pregunta 2", s["error"])
        s = self.cerrar(medido={"palabras": ["19", "5", "7", "43"]})
        self.assertFalse(s["ok"])
        self.assertIn("no se leen", s["error"])


if __name__ == "__main__":
    unittest.main()
