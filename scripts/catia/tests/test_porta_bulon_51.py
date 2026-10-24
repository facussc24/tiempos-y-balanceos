# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 51 del banco de CATIA (el porta-bulon M6 rehecho en CATIA, CATA 24/10/2026).

1. Las cotas de pieza_porta_bulon.py: el hexagono tiene 10,4 entre caras con las puntas sobre X, y lo que midio CATIA en
   cada paso (51_r6) es la cuenta de esa operacion (la ranura de 14,0089 se recorta en el teton de 13,6).
2. vaciado_mal(): acepta los vaciados bien hechos con los centros que dio CATIA y rechaza los dos al reves de 51_r4 (la
   ranura y el agujero), el que saca casi nada con el centro arriba y el que deja el centro en su plano; y el criterio
   viejo dejaba pasar la ranura al reves. chaflan_saca_bien() rechaza el chaflan de 0,5 grados de 51_r2.
3. generar_referencia() y medir_gemelos() con el generador y los gemelos de mentira: ROJO si el generador cambio, si su
   STL no es el del bien.py o si no esta; las rutas de los gemelos van con el prefijo de rutas largas.
4. cerrar_con_referencia(): VERDE con lo medido en la R21 de CATA (24/10 14:45); ROJO si sobra material, si el centro se
   corrio, si la referencia no se genero, si el bien.py queda lejos o un mal_*.py cerca, si un gemelo no se midio, con
   una excepcion fuera de un paso y si un paso fallo."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ51 = os.path.join(CATIA_DIR, "ejercicios", "51_porta_bulon")
sys.path.insert(0, CATIA_DIR)

COMPARA = {"vol_A": 1612.483, "vol_B": 1612.483, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "comun": 1612.483,
           "booleana_cierra": True, "tolerancia_booleana": 0.0001, "dist_max_A_a_B": 0.0003, "p99_A_a_B": 0.0,
           "dist_max_B_a_A": 0.0004, "p99_B_a_A": 0.0, "caja_A": [22.0, 22.0, 7.7], "caja_B": [22.0, 22.0, 7.7],
           "solidos": [1, 1], "dist_max_exacta_A_a_B": 0.0, "dist_max_exacta_B_a_A": 0.0}
# 51_r7, R21 de CATA, 24/10/2026 15:02 (las exactas, del compara.py del 32 de d6fecd19, 15:06)
CDG = [0.0, 0.0, 3.2075]
VOL_CATIA = 1612.483
GEMELOS = {"bien.py": 1611.928, "mal_1_techo_con_agujero.py": 1630.868, "mal_2_tapita.py": 1644.546}   # 51_r6
PASOS = {"cuerpo": 2165.848, "hexagono": 412.145, "ranura": 17.952, "cuadrado": 8.712, "agujero": 99.2146,
         "chaflan": 9.356, "boca": 5.986}                         # lo que midio CATIA en cada paso (51_r6)


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def pieza():
    import catia_base  # noqa: F401  (la pieza lo importa)
    return cargar("pieza_porta_bulon_t", os.path.join(EJ51, "pieza_porta_bulon.py"))


def malla(v):
    """Lo que devuelve medir_b123d stl de un gemelo sano (51_r6)."""
    return {"volumen_stl": v, "cerrado": True, "orientacion_consistente": True, "partes": 1, "partes_negativas": 0}


def hex_area(entre_caras):
    return 2 * math.sqrt(3) * (entre_caras / 2) ** 2


class Cotas(unittest.TestCase):
    def test_hexagono_entre_caras_con_las_puntas_sobre_x(self):
        pb = pieza()
        pts = pb.hexagono(pb.HEX_S)
        self.assertAlmostEqual(pts[0][0], 6.0044, places=3)          # medido en build123d: (+-6,004; 0)
        self.assertAlmostEqual(pts[0][1], 0.0, places=9)
        self.assertAlmostEqual(pts[1][1] * 2, pb.HEX_S, places=5)    # la cara de arriba esta en y = 5,2

    def test_cada_paso_es_la_cuenta_de_su_operacion(self):
        pb = pieza()
        alto = pb.CUERPO_H + pb.TETON_H
        self.assertAlmostEqual(alto, COMPARA["caja_A"][2], places=9)   # la caja del STEP: 22 x 22 x 7,7
        self.assertEqual(pb.CUERPO_D, COMPARA["caja_A"][0])
        self.assertAlmostEqual(PASOS["cuerpo"], math.pi * (pb.CUERPO_D / 2) ** 2 * pb.CUERPO_H + pb.TETON ** 2 * pb.TETON_H,
                               places=2)
        self.assertAlmostEqual(PASOS["hexagono"], hex_area(pb.HEX_S) * pb.HEX_H, places=2)
        self.assertGreater(pb.HEX_S / pb.COS30 + 2, pb.TETON)         # la ranura pasa del teton: se recorta en 13,6
        self.assertAlmostEqual(PASOS["ranura"], pb.TETON * pb.D_PASO * pb.CAPA, places=3)
        self.assertAlmostEqual(PASOS["cuadrado"], pb.D_PASO ** 2 * pb.CAPA, places=3)
        self.assertAlmostEqual(PASOS["agujero"], math.pi * (pb.D_PASO / 2) ** 2 * (alto - pb.HEX_H - 2 * pb.CAPA), places=3)
        self.assertAlmostEqual(PASOS["boca"], (hex_area(pb.HEX_S + 2 * pb.HEX_CHAF) - hex_area(pb.HEX_S)) * pb.HEX_CHAF,
                               places=2)
        self.assertAlmostEqual(PASOS["cuerpo"] - sum(v for k, v in PASOS.items() if k != "cuerpo"), VOL_CATIA, places=2)

    def test_chaflan_por_lo_que_saca(self):
        pb = pieza()
        largos = [pb.TETON] * 4 + [math.pi * pb.D_PASO]
        self.assertTrue(pb.chaflan_saca_bien(PASOS["chaflan"], largos))      # 9,356 con los dos grupos (51_r6)
        self.assertFalse(pb.chaflan_saca_bien(0.082, largos))                # 51_r2: 0,5 con 0,5 grados
        self.assertFalse(pb.chaflan_saca_bien(PASOS["chaflan"] * 4, largos))  # un chaflan de 1 x 1


class Vaciado(unittest.TestCase):
    def antes_despues(self, v0, c0, dv, zs):
        """Mediciones de antes y despues de sacar dv mm3 con su centro en z = zs."""
        v1 = v0 - dv
        return {"volume": v0, "cdg_mm": [0.0, 0.0, c0]}, {"volume": v1, "cdg_mm": [0.0, 0.0, (v0 * c0 - dv * zs) / v1]}

    def test_bien_hechos_con_los_centros_de_51_r6(self):
        pb = pieza()
        for v0, dv, z0, zs in ((1753.703, 17.952, 4.4, 4.5), (1735.751, 8.712, 4.6, 4.7), (1727.039, 99.2146, 4.8, 6.25),
                               (1618.469, 5.986, 0.0, 0.2)):
            m0, m1 = self.antes_despues(v0, 3.2, dv, zs)
            self.assertFalse(pb.vaciado_mal(m0, m1, z0), (dv, zs))

    def test_rojo_si_no_saca_o_saca_abajo(self):
        pb = pieza()
        m0, m1 = self.antes_despues(1753.703, 3.2, 4.615, 4.3)        # 51_r4: la ranura al reves (las puntas del hex)
        self.assertTrue(pb.vaciado_mal(m0, m1, 4.4))
        m0, m1 = self.antes_despues(1727.039, 3.2, 6.842, 4.5)        # 51_r4: el agujero al reves (la capa que quedo)
        self.assertTrue(pb.vaciado_mal(m0, m1, 4.8))
        m0, m1 = self.antes_despues(1727.039, 3.2, 0.0004, 5.0)       # casi nada con el centro arriba: el piso
        self.assertTrue(pb.vaciado_mal(m0, m1, 4.8))
        self.assertTrue(pb.vaciado_mal(m0, dict(m0), 4.8))             # no saco nada
        m0, m1 = self.antes_despues(1753.703, 3.2, 17.952, 4.4)       # centro EN el plano: tampoco
        self.assertTrue(pb.vaciado_mal(m0, m1, 4.4))

    def test_el_margen_viejo_dejaba_pasar_la_ranura_al_reves(self):
        """El criterio de 51_r4 (centro a 0,001 y margen 0,0011 V0 / dV) con la ranura al reves: pasaba."""
        m0, m1 = self.antes_despues(1753.703, 3.2, 4.615, 4.3)
        m0["cdg_mm"] = [round(x, 3) for x in m0["cdg_mm"]]
        m1["cdg_mm"] = [round(x, 3) for x in m1["cdg_mm"]]
        cs = pieza().sacado(m0, m1)
        self.assertGreaterEqual(cs[2], 4.4 - 0.0011 * m0["volume"] / 4.615)


class Referencia(unittest.TestCase):
    def setUp(self):
        self.ej = cargar("ej51_catia_r", os.path.join(EJ51, "catia.py"))
        self.tmp = tempfile.mkdtemp(prefix="ej51-ref-")
        self.gen = os.path.join(self.tmp, "porta_bulon.py")
        with open(self.gen, "w", encoding="utf-8") as f:
            f.write("# generador de mentira\n")
        self.ej.GENERADOR = self.gen
        self.ej.SHA_GENERADOR = self.ej.sha256(self.gen)
        # juez_comun es el mismo modulo para toda la suite: lo que se cambia aca se devuelve en tearDown
        self._jc = (self.ej.jc.VENV_CAD, self.ej.jc.medir_b123d)
        self.ej.jc.VENV_CAD = self.gen                                 # cualquier archivo que exista

    def tearDown(self):
        self.ej.jc.VENV_CAD, self.ej.jc.medir_b123d = self._jc

    def correr(self, stl=b"stl del banco"):
        def f(args, **kw):
            carpeta = args[-1]
            for ext, datos in ((".step", b"step"), (".stl", stl)):
                with open(os.path.join(carpeta, self.ej.NOMBRE_REF + ext), "wb") as g:
                    g.write(datos)
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        return f

    def test_verde_y_rojos(self):
        import hashlib
        self.ej.SHA_STL_BIEN = hashlib.sha256(b"stl del banco").hexdigest()
        r = self.ej.generar_referencia(os.path.join(self.tmp, "a"), correr=self.correr())
        self.assertIn("step", r, r)
        r = self.ej.generar_referencia(os.path.join(self.tmp, "b"), correr=self.correr(stl=b"otro"))
        self.assertIn("no es el del bien.py", r["error"])
        self.ej.SHA_GENERADOR = "0" * 64
        self.assertIn("el generador cambio", self.ej.generar_referencia(os.path.join(self.tmp, "c"),
                                                                      correr=self.correr())["error"])
        self.ej.GENERADOR = os.path.join(self.tmp, "no_esta.py")
        self.assertIn("no esta el generador", self.ej.generar_referencia(os.path.join(self.tmp, "d"),
                                                                       correr=self.correr())["error"])

    def test_gemelos_con_el_prefijo_de_rutas_largas(self):
        vistos = []

        def f(args, **kw):
            vistos.append(kw["env"]["BANCO3D_NUBE_3D"])
            with open(os.path.join(args[-1], "pieza.stl"), "wb") as g:
                g.write(b"x")
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        self.ej.jc.medir_b123d = lambda args: {"partes": {"p": {"volumen_stl": 1.0}}}
        g = self.ej.medir_gemelos(os.path.join(self.tmp, "g"), correr=f)
        self.assertEqual(set(g), set(self.ej.GEMELOS))
        self.assertTrue(all(v.startswith("\\\\?\\") and not v.startswith("\\\\?\\\\\\?\\") for v in vistos), vistos)


class Juez(unittest.TestCase):
    def juez(self, comparado=None, ref=None, cdg_catia=None, ok_pasos=True, error=None, gemelos=None, medir_ref=None):
        ej = cargar("ej51_catia_j", os.path.join(EJ51, "catia.py"))
        tmp = tempfile.mkdtemp(prefix="ej51-")
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "volumen_catia": {"porta_bulon_M6": VOL_CATIA},
             "step_catia_en_build123d": {"porta_bulon_M6": {"cdg_mm": cdg_catia or list(CDG), "solidos": 1}}}
        if error:
            s["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        g = gemelos or {k: malla(v) for k, v in GEMELOS.items()}
        return ej.cerrar_con_referencia(tmp, referencia=lambda carpeta: ref or {"step": "ref.step"},
                                        comparar_con=lambda a, b: dict(comparado or COMPARA),
                                        medir=lambda args: medir_ref or {"partes": {"r": {"cdg_mm": list(CDG)}}},
                                        gemelos=lambda carpeta: g)

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)
        self.assertEqual(s["juez"]["gemelos_dif_mm3"], {"bien.py": 0.555, "mal_1_techo_con_agujero.py": 18.385,
                                                        "mal_2_tapita.py": 32.063})

    def test_rojo(self):
        self.assertIn("sobra", self.juez(comparado=dict(COMPARA, sobra_A_menos_B=5.0))["error"])
        self.assertIn("distancia exacta", self.juez(comparado=dict(COMPARA, dist_max_exacta_B_a_A=0.05))["error"])
        sin_exacta = {k: v for k, v in COMPARA.items() if k != "dist_max_exacta_A_a_B"}   # un compara.py viejo
        self.assertIn("distancia exacta", self.juez(comparado=sin_exacta)["error"])
        self.assertIn("distancia exacta", self.juez(comparado=dict(COMPARA, dist_max_exacta_A_a_B=float("nan")))
                      ["error"])
        self.assertIn("centro", self.juez(cdg_catia=[0.0, 0.0, 3.25])["error"])
        self.assertIn("no esta el generador", self.juez(ref={"error": "no esta el generador: x"})["error"])
        g = {k: malla(v) for k, v in GEMELOS.items()}
        self.assertIn("la pieza bien del banco", self.juez(gemelos=dict(g, **{"bien.py": malla(1610.0)}))["error"])
        self.assertIn("otro solido del banco", self.juez(gemelos=dict(g, **{"mal_2_tapita.py": malla(1614.0)}))["error"])
        self.assertIn("no se midio", self.juez(gemelos=dict(g, **{"bien.py": {"error": "salio con 1"}}))["error"])
        self.assertIn("no se midio", self.juez(gemelos=dict(g, **{"bien.py": malla(float("nan"))}))["error"])
        self.assertIn("no se midio", self.juez(gemelos=dict(g, **{"mal_1_techo_con_agujero.py": malla(float("inf"))}))
                      ["error"])
        abierta = dict(malla(0.0), cerrado=False)                     # una malla rota queda «lejos» de todo
        self.assertIn("no es un solido", self.juez(gemelos=dict(g, **{"mal_1_techo_con_agujero.py": abierta}))["error"])
        s = self.juez(medir_ref={"error": "no abrio el STEP"})
        self.assertIn("no se pudo medir el centro de la referencia", s["error"])
        self.assertNotIn("no es el de la referencia", s["error"])
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])


if __name__ == "__main__":
    unittest.main()
