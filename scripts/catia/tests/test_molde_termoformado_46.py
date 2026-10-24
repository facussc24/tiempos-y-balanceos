# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 46 del banco de CATIA (molde macho de termoformado, RapidMade; CATA 24/10/2026).

1. La cuenta: sin desmoldeo, area formada 208 pulg2, huella 120, relacion 208 / 120 = 1,7333 (papel 1,73) y chapa 0,1733
   (papel 0,173); con 4 grados, el tronco: 201,018 pulg2, relacion 1,67515, y el volumen del prismatoide.
2. pieza_ej69.py es la copia del ej69 con los cambios anotados (no corre suelto ni captura; devuelve res y docs).
3. cerrar_con_papel(): VERDE con lo medido en la R21 de CATA (24/10 13:14); ROJO si el desmoldeo no se aplico (el de 4
   grados mide lo mismo que el de 0), si falta un lado, si la huella no es 120, si el volumen o el STEP no cierran, si la
   chapa con desmoldeo no queda mas fina y si un paso fallo."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ46 = os.path.join(CATIA_DIR, "ejercicios", "46_molde_termoformado")
sys.path.insert(0, CATIA_DIR)

MOLDE = {"0": {"huella_pulg2": 120.0, "formada_pulg2": 208.0, "relacion": 1.7333, "chapa_partida_pulg": 0.1733,
               "n_lados": 4},
         "4": {"huella_pulg2": 120.0, "formada_pulg2": 201.018, "relacion": 1.6752, "chapa_partida_pulg": 0.1675,
               "n_lados": 4}}                                      # 46_r1, R21 de CATA, 24/10/2026 13:14
VOL = {"molde_0": 3932895.36, "molde_4": 3832911.295}


def cargar_ej46():
    spec = importlib.util.spec_from_file_location("ej46_catia", os.path.join(EJ46, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_papel_y_tronco(self):
        ej = cargar_ej46()
        f0, r0, v0 = ej.cuenta(0.0)
        self.assertAlmostEqual(f0 / ej.PULG ** 2, 208.0, places=6)
        self.assertAlmostEqual(r0, 208 / 120, places=9)
        self.assertEqual(round(r0, 2), ej.PAPEL["relacion"])
        self.assertEqual(round(r0 * ej.T_FIN, 3), ej.PAPEL["chapa_pulg"])
        self.assertAlmostEqual(v0, 254 * 304.8 * 50.8, places=3)
        f4, r4, v4 = ej.cuenta(4.0)
        self.assertAlmostEqual(f4 / ej.PULG ** 2, 201.018, places=3)
        self.assertAlmostEqual(v4, VOL["molde_4"], places=2)

    def test_la_copia_del_ej69(self):
        with open(os.path.join(EJ46, "pieza_ej69.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej69_molde_termoformado.py", texto)
        self.assertIn("from catia_base import nueva_pieza, ref, topologia", texto)
        for prohibido in ("captura(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn('return {"res": res, "docs": docs}', texto)


class Construir(unittest.TestCase):
    def test_las_claves_de_la_pieza_son_las_del_juez(self):
        """construir() con la pieza falsa (devuelve lo medido con claves float, como pieza_ej69) y el juez sobre eso."""
        ej = cargar_ej46()
        cerradas = []
        res = {0.0: dict(MOLDE["0"]), 4.0: dict(MOLDE["4"])}
        docs = {a: (type("D", (), {"Close": lambda self: None})(), f"part{a:g}", f"body{a:g}") for a in res}
        ej.cargar = lambda nombre, ruta: type("P", (), {"cuerpo": staticmethod(lambda c, reg: {"res": res, "docs": docs})})
        original = ej.jc.cerrar_parte                       # juez_comun es UNO para toda la suite: se devuelve
        ej.jc.cerrar_parte = lambda cb, c, reg, salida, doc, part, body, nombre, parte, ocultos=(): cerradas.append(parte)
        salida = {}
        try:
            ej.construir(None, None, None, salida)
        finally:
            ej.jc.cerrar_parte = original
        self.assertEqual(sorted(salida["molde"]), ["0", "4"])
        self.assertEqual(cerradas, ["molde_0", "molde_4"])
        tmp = tempfile.mkdtemp(prefix="ej46-c-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(dict(salida, ok=False, ok_pasos=True, pendiente=True, volumen_catia=dict(VOL),
                           volumen_step_catia_en_build123d=dict(VOL)), f)
        self.assertTrue(ej.cerrar_con_papel(tmp)["ok"])


class Juez(unittest.TestCase):
    def salida(self):
        return {"ok": False, "ok_pasos": True, "pendiente": True, "molde": json.loads(json.dumps(MOLDE)),
                "volumen_catia": dict(VOL), "volumen_step_catia_en_build123d": dict(VOL)}

    def juez(self, s):
        ej = cargar_ej46()
        tmp = tempfile.mkdtemp(prefix="ej46-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_papel(tmp)

    def test_verde(self):
        r = self.juez(self.salida())
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("pendiente", r)

    def test_rojo(self):
        s = self.salida()
        s["molde"]["4"] = dict(MOLDE["0"])                        # el desmoldeo no se aplico
        s["volumen_catia"]["molde_4"] = s["volumen_step_catia_en_build123d"]["molde_4"] = VOL["molde_0"]
        r = self.juez(s)
        self.assertIn("4 grados: area formada", r["error"])
        self.assertIn("no queda mas fina", r["error"])
        s = self.salida()
        s["molde"]["4"]["n_lados"] = 3
        self.assertIn("3 lados", self.juez(s)["error"])
        s = self.salida()
        s["molde"]["0"]["huella_pulg2"] = 119.9
        self.assertIn("huella", self.juez(s)["error"])
        s = self.salida()
        s["volumen_catia"]["molde_0"] += 1.0
        self.assertIn("volumen de CATIA", self.juez(s)["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"] = "build123d no midio"
        self.assertIn("el STEP", self.juez(s)["error"])
        s = self.salida()
        s["molde"]["0"]["chapa_partida_pulg"] = 0.18
        self.assertIn("chapa 0.18", self.juez(s)["error"])
        s = self.salida()
        s["molde"]["4"]["chapa_partida_pulg"] = 0.05                     # mas fina, pero no la de la cuenta (revisor)
        self.assertIn("4 grados: chapa 0.05", self.juez(s)["error"])
        s = self.salida()
        s["ok_pasos"] = False
        self.assertFalse(self.juez(s)["ok"])


if __name__ == "__main__":
    unittest.main()
