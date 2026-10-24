# -*- coding: utf-8 -*-
"""Prueba del detector de caras dadas vuelta de medir_b123d.medir_stl y de juez_comun.veredicto_stl, con mallas de
verdad (trimesh, .venv-cad), 24/10/2026.

Por que con mallas y no con CATIA: el caso real (la v16 de la practica del 19/10, el STL resto -3,84 %) no se pudo
reproducir: el 09 sin Invert dio el mismo STL (24/10 09:48). Y el porcentaje solo no separa ese caso del facetado de una
pieza chica curva (-1,2 % medido en el 13): por eso el control mira la orientacion de los triangulos y el signo del
volumen de cada cuerpo.
- caja bien: verde;
- la misma caja con TODOS los triangulos dados vuelta: volumen negativo, rojo;
- una caja bien mas una cascara chica dada vuelta adentro (lo que hace la v16: resta esa parte): rojo por el cuerpo
  negativo, aunque el volumen total quede a -3,84 % (dentro de cualquier tolerancia de facetado);
- una caja con la mitad de sus triangulos dados vuelta: orientacion inconsistente, rojo;
- una caja abierta (le falta una cara): rojo;
- el facetado (-1,23 %, malla bien): verde."""
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, CATIA_DIR)
import juez_comun as jc  # noqa: E402

try:
    import trimesh
    import medir_b123d as mb
    HAY = True
except Exception:  # noqa: BLE001
    HAY = False


@unittest.skipUnless(HAY, "sin trimesh (correr con .venv-cad)")
class DetectorSTL(unittest.TestCase):
    def medir(self, malla):
        ruta = os.path.join(tempfile.mkdtemp(prefix="stl-"), "pieza.stl")
        malla.export(ruta)
        return mb.medir_stl(ruta)

    def caja(self, lado=10.0, centro=(0.0, 0.0, 0.0)):
        return trimesh.creation.box(extents=(lado, lado, lado)).apply_translation(centro)

    def test_caja_bien_verde(self):
        d = self.medir(self.caja())
        self.assertEqual((d["cerrado"], d["orientacion_consistente"], d["partes"], d["partes_negativas"]),
                         (True, True, 1, 0))
        self.assertAlmostEqual(d["volumen_stl"], 1000.0, places=3)
        self.assertIsNone(jc.veredicto_stl(d, 1000.0))

    def test_caja_dada_vuelta_rojo(self):
        m = self.caja()
        m.invert()
        d = self.medir(m)
        self.assertLess(d["volumen_stl"], 0)
        self.assertIn("volumen negativo", jc.veredicto_stl(d, 1000.0))

    def test_cascara_dada_vuelta_adentro_rojo_aunque_el_porcentaje_de_bien(self):
        """Como la v16: el STL resta una parte. Cubo de 10 (1 000) con una cascara invertida de 3,384 de lado adentro:
        resta 38,4 mm3 = -3,84 %, que con 5 % pasaria; el cuerpo negativo lo caza."""
        hueco = self.caja(lado=38.4 ** (1 / 3))
        hueco.invert()
        d = self.medir(trimesh.util.concatenate([self.caja(), hueco]))
        self.assertAlmostEqual(d["volumen_stl"], 1000.0 - 38.4, places=2)
        self.assertEqual(d["partes_negativas"], 1)
        v = jc.veredicto_stl(d, 1000.0, 0.05)
        self.assertIsNotNone(v)
        self.assertIn("volumen negativo", v)
        self.assertNotIn("mas de 5 %", v)                # el porcentaje solo no lo veia

    def test_mitad_de_triangulos_dados_vuelta_rojo(self):
        m = self.caja()
        caras = m.faces.copy()
        caras[: len(caras) // 2] = caras[: len(caras) // 2, ::-1]
        d = self.medir(trimesh.Trimesh(vertices=m.vertices, faces=caras, process=False))
        self.assertFalse(d["orientacion_consistente"])
        self.assertIn("orientacion", jc.veredicto_stl(d, 1000.0))

    def test_caja_abierta_rojo(self):
        m = self.caja()
        d = self.medir(trimesh.Trimesh(vertices=m.vertices, faces=m.faces[:-2], process=False))
        self.assertFalse(d["cerrado"])
        self.assertIn("abierta", jc.veredicto_stl(d, 1000.0))

    def test_facetado_verde(self):
        d = self.medir(self.caja())
        d["volumen_stl"] = 1000.0 * (1 - 0.0123)          # el -1,23 % del tronco del 13 (malla cerrada y orientada)
        self.assertIsNone(jc.veredicto_stl(d, 1000.0, 0.05))


if __name__ == "__main__":
    unittest.main()
