# -*- coding: utf-8 -*-
"""Prueba con OpenCASCADE de verdad de lo que leen los jueces arreglados por el auditor de la tanda de CATA (24/10/2026,
b12fc4d1): medir_b123d (el de juez_comun) sobre un STEP con un solido y una cara suelta encima, el caso real de 54_r1 (la
superficie R600 visible al exportar: 1 solido, 2 cascaras, 1 cara suelta). Los jueces exigen (solidos, cascaras,
caras_sueltas) == (1, 1, 0); sus pruebas usan esos tres numeros escritos a mano: esta prueba muestra que la medicion real
los da asi.

1. Una caja sola: 1 solido, 1 cascara, 0 caras sueltas.
2. La caja con una cara suelta pegada a una de sus caras (lo de 54_r1): 1 solido, 2 cascaras, 1 cara suelta.
Se corre con .venv-cad (build123d arma los STEP; medir_b123d corre con el VENV_CAD de juez_comun)."""
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, CATIA_DIR)
import juez_comun as jc  # noqa: E402

try:
    from build123d import Box, Compound, export_step
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


@unittest.skipUnless(HAY_B123D and os.path.isfile(jc.VENV_CAD), "sin build123d o sin .venv-cad (correr con .venv-cad)")
class TopologiaDelStep(unittest.TestCase):
    def medir(self, forma, nombre):
        ruta = os.path.join(tempfile.mkdtemp(prefix="topo-"), nombre + ".step")
        export_step(forma, ruta)
        r = jc.medir_b123d(["step", ruta])
        partes = r.get("partes") or {}
        self.assertEqual(len(partes), 1, r)
        d = next(iter(partes.values()))
        return d.get("solidos"), d.get("cascaras"), d.get("caras_sueltas")

    def test_caja_sola(self):
        self.assertEqual(self.medir(Box(20, 10, 5), "caja"), (1, 1, 0))

    def test_caja_con_una_cara_suelta(self):
        caja = Box(20, 10, 5)
        cara = caja.faces().sort_by().last                     # la de arriba, como la superficie de 54_r1
        self.assertEqual(self.medir(Compound([caja, cara.translate((0, 0, 0))]), "caja_y_cara"), (1, 2, 1))


if __name__ == "__main__":
    unittest.main()
