# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 36 del banco de CATIA (CSWA 2013 «Tool Block» etapas 1 y 2, CATA 24/10/2026).

1. Lo medido en la R21 de CATA (24/10 12:41) por 0,0079 g/mm3 cae a 0,1 g de las respuestas del examen (939,54 y
   1 032,32 g); el gemelo de la practica da el mismo volumen a 0,5 mm3.
2. pieza_ej41.py es la copia del ej41 con los cambios anotados: no captura ni guarda ni corre suelto; devuelve ctx.
3. Con build123d: e1.json y e2.json son lo que de_build123d.py saca de gemelo.py (el perfil de CATIA = el del gemelo).
4. construir() con la pieza y el material FALSOS: las dos etapas, cada una con su masa y su cerrar_parte.
5. cerrar_con_respuesta(): VERDE con lo medido; ROJO con una masa a 0,2 g, sin coherencia, con el centro corrido (misma
   masa), con el STEP con otro volumen, con el gemelo que no corre o
   da otro volumen, sin STEP, sin masa de una etapa y con un paso fallado."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ36 = os.path.join(CATIA_DIR, "ejercicios", "36_cswa_tool_block_e12")
sys.path.insert(0, CATIA_DIR)

VOL = {1: 118929.059, 2: 130673.504}            # R21 de CATA, 24/10/2026 12:41 (36_r1) = registro del ej41 del 19/10
GEMELO = {"1": {"volumen": 118929.059, "cdg": [44.6224, 33.3076, 21.5]},
          "2": {"volumen": 130673.503, "cdg": [46.5534, 33.7907, 22.5]}}
CDG = {"tool_block_e1": [44.622, 33.308, 21.5], "tool_block_e2": [46.553, 33.791, 22.5]}     # CATIA, 36_r1
MASA = {1: 939.540, 2: 1032.321}


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_ej36():
    return cargar("ej36_catia", os.path.join(EJ36, "catia.py"))


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_respuestas_del_examen(self):
        ej = cargar_ej36()
        for n in (1, 2):
            self.assertLess(abs(VOL[n] * ej.DENSIDAD * 1e-6 - ej.RESPUESTA_G[n]), ej.TOL_MASA_G)
            self.assertLess(abs(VOL[n] - GEMELO[str(n)]["volumen"]), ej.TOL_VOL)
        self.assertEqual(ej.RESPUESTA_G, {1: 939.54, 2: 1032.32})

    def test_la_copia_del_ej41(self):
        with open(os.path.join(EJ36, "pieza_ej41.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej41_tool_block.py", texto)
        self.assertIn("from catia_base import medir, nueva_pieza, ref", texto)
        for prohibido in ("captura(", "guardar_pieza(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn('return {"doc": doc, "part": part, "body": body}', texto)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def setUp(self):                    # los contornos del 25, 27 y 29 importan OTRO «gemelo»: se deja como estaba
        self._path, self._gemelo = list(sys.path), sys.modules.get("gemelo")

    def tearDown(self):
        sys.path[:] = self._path
        if self._gemelo is None:
            sys.modules.pop("gemelo", None)
        else:
            sys.modules["gemelo"] = self._gemelo

    def test_gemelo_con_centro(self):
        g = cargar("gemelo_b123d_36", os.path.join(EJ36, "gemelo_b123d.py"))
        for n, abc in g.ETAPAS.items():
            m = g.medir(*abc)
            self.assertLess(abs(m["volumen"] - GEMELO[str(n)]["volumen"]), 0.001)
            self.assertLess(max(abs(a - b) for a, b in zip(m["cdg"], GEMELO[str(n)]["cdg"])), 1e-4)

    def test_perfiles_son_los_del_gemelo(self):
        sys.path.insert(0, os.path.join(EJ36, "ej41_tool_block"))
        de = cargar("de_build123d_36", os.path.join(EJ36, "de_build123d.py"))
        cont = cargar("contornos_36", os.path.join(EJ36, "ej41_tool_block", "contornos.py"))
        for n in ("e1", "e2"):
            cara = getattr(cont, n)().faces()[0]
            with open(os.path.join(EJ36, "ej41_tool_block", n + ".json"), encoding="utf-8") as f:
                self.assertEqual(de.tramos(cara), json.load(f))

    def test_gemelo(self):
        sys.path.insert(0, os.path.join(EJ36, "ej41_tool_block"))
        g = cargar("gemelo_ej41_36", os.path.join(EJ36, "ej41_tool_block", "gemelo.py"))
        from build123d import extrude
        for n, (A, B, C) in {1: (81, 57, 43), 2: (84, 59, 45)}.items():
            self.assertLess(abs(extrude(g.perfil(A, B)[0], C).volume - VOL[n]), 0.5)


class Construir(unittest.TestCase):
    def test_dos_etapas_con_su_masa(self):
        ej = cargar_ej36()
        armadas, cerradas, cerrados = [], [], []

        class Pieza:
            @staticmethod
            def cuerpo(c, reg, n):
                armadas.append(n)
                return {"doc": type("D", (), {"Close": lambda self: cerrados.append(n)})(), "part": f"part{n}",
                        "body": f"body{n}"}
        ej.cargar = lambda nombre, ruta: Pieza
        pedidos = []

        def material(cb, c, doc, part, pref, dens):
            pedidos.append((pref, dens))
            return {"ok": True, "masa_inercia_kg": VOL[int(part[-1])] * dens * 1e-9, "material": "Steel",
                    "densidad_kg_m3": dens}
        ej.e22.material_con_densidad = material
        original = ej.jc.cerrar_parte                      # juez_comun es UNO para toda la suite: se devuelve
        ej.jc.cerrar_parte = lambda cb, c, reg, salida, doc, part, body, nombre, parte, ocultos=(): cerradas.append(parte)
        salida = {}
        try:
            ej.construir(None, None, None, salida)
        finally:
            ej.jc.cerrar_parte = original
        self.assertEqual(armadas, [1, 2])
        self.assertEqual(cerradas, ["tool_block_e1", "tool_block_e2"])
        self.assertEqual(cerrados, [1, 2])
        self.assertEqual(pedidos, [(("steel", "acero"), 7900.0)] * 2)       # acero del catalogo con la densidad del examen
        self.assertAlmostEqual(salida["masa_catia_g"]["tool_block_e1"], MASA[1], places=2)
        self.assertAlmostEqual(salida["masa_catia_g"]["tool_block_e2"], MASA[2], places=2)


class Juez(unittest.TestCase):
    def salida(self):
        return {"ok": False, "ok_pasos": True, "pendiente": True,
                "volumen_catia": {"tool_block_e1": VOL[1], "tool_block_e2": VOL[2]},
                "masa_catia_g": {"tool_block_e1": MASA[1], "tool_block_e2": MASA[2]}, "cdg_catia_mm": json.loads(json.dumps(CDG)),
                "volumen_step_catia_en_build123d": {"tool_block_e1": VOL[1], "tool_block_e2": VOL[2] - 0.001},
                "step_catia_en_build123d": {p: {"solidos": 1, "cascaras": 1, "caras_sueltas": 0}
                                            for p in ("tool_block_e1", "tool_block_e2")}}

    def test_cara_suelta_en_el_step(self):
        """Auditor de la tanda (24/10): un STEP con una cara suelta pasaba."""
        s = self.salida()
        s["step_catia_en_build123d"]["tool_block_e2"].update(cascaras=2, caras_sueltas=1)
        r = self.juez(s)
        self.assertFalse(r["ok"])
        self.assertIn("no es 1 solido cerrado", r["error"])

    def juez(self, s, gemelo=None):
        ej = cargar_ej36()
        tmp = tempfile.mkdtemp(prefix="ej36-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_respuesta(tmp, medir_gemelo=gemelo or (lambda: json.loads(json.dumps(GEMELO))))

    def test_verde(self):
        r = self.juez(self.salida())
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("pendiente", r)

    def test_rojo(self):
        s = self.salida()
        s["masa_catia_g"]["tool_block_e2"] += 0.2
        self.assertIn("etapa 2", self.juez(s)["error"])
        s = self.salida()
        s["masa_catia_g"]["tool_block_e1"] *= 1.01                       # masa que no sale del volumen
        self.assertIn("coherencia", self.juez(s)["error"])
        self.assertFalse(self.juez(self.salida(), gemelo=lambda: {"error": "sin entorno"})["ok"])
        r = self.juez(self.salida(), gemelo=lambda: {"1": {"volumen": VOL[1] + 1.0}, "2": GEMELO["2"]})
        self.assertIn("contra el gemelo", r["error"])
        self.assertIn("no dio volumen", self.juez(self.salida(), gemelo=lambda: {"1": GEMELO["1"]})["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"] = "build123d no midio"
        self.assertIn("el STEP", self.juez(s)["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"]["tool_block_e2"] += 0.6          # un STEP con otro volumen (revisor)
        self.assertIn("etapa 2: el STEP", self.juez(s)["error"])
        s = self.salida()
        s["cdg_catia_mm"]["tool_block_e1"][1] += 0.17      # el agujero corrido 3 mm en y: misma masa, otro centro
        r = self.juez(s)
        self.assertIn("etapa 1: el centro", r["error"])
        self.assertNotIn("etapa 1: 939", r["error"])
        s = self.salida()
        s["masa_catia_g"].pop("tool_block_e1")
        self.assertIn("sin masa", self.juez(s)["error"])
        s = self.salida()
        s["ok_pasos"] = False
        self.assertFalse(self.juez(s)["ok"])

    def test_excepcion_fuera_de_un_paso(self):
        """Pedido 10 de la principal: el error de correr_ejercicio nunca da verde, aunque todo lo demas cierre."""
        s = self.salida()
        s["error"] = "excepcion fuera de un paso: Traceback ..."
        r = self.juez(s)
        self.assertFalse(r["ok"])
        self.assertIn("excepcion fuera de un paso", r["error"])


if __name__ == "__main__":
    unittest.main()
