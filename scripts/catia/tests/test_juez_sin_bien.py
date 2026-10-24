# -*- coding: utf-8 -*-
"""Prueba sin CATIA de juez_comun.correr_ejercicio con y sin bien.py (24/10/2026, ejercicio 13 del banco de CATIA).

Se reemplazan pythoncom y catia_base por modulos falsos (sys.modules) para que correr_ejercicio corra entero sin CATIA:
- con_bien=False: no llama a build123d por el bien.py, el ok sale de los pasos (verde si construir no falla, rojo si un
  paso falla), FIN se imprime (diferencia_mm3 existe aunque vacia) y el STEP de CATIA se mide igual (tercer cruce).
- con_bien=True (lo de siempre): con un bien.py que no existe build123d da error y el ok es ROJO.
- CATIA_MIRAR (Fak quiere verlo en vivo): CATIA visible, la ventana a la segunda pantalla y una pausa al final; sin la
  variable, invisible y se apaga."""
import io
import json
import os
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, CATIA_DIR)
import juez_comun as jc  # noqa: E402


class Registro:
    def __init__(self, nombre):
        self.nombre, self.pasos, self.datos = nombre, [], {}
        self.carpeta = os.path.join(os.environ["CATIA_TRABAJO"], nombre)
        os.makedirs(self.carpeta, exist_ok=True)

    def paso(self, que, fn):
        try:
            r = fn()
            self.pasos.append({"paso": que, "ok": True})
            return r
        except Exception as e:  # noqa: BLE001
            self.pasos.append({"paso": que, "ok": False, "error": repr(e)})
            return None

    def guardar(self):
        return [p["paso"] for p in self.pasos if not p["ok"]]


def falsos():
    cb = types.ModuleType("catia_base")
    cb.conectar = lambda visible=False: (object(), None)
    cb.apagar = lambda c: None
    cb.hora_de_arranque = lambda pid: None
    cb.Vigia = None
    cb.Registro = Registro
    pc = types.ModuleType("pythoncom")
    pc.CoInitialize = lambda: None
    return {"catia_base": cb, "pythoncom": pc}


class SinBien(unittest.TestCase):
    def correr(self, construir, con_bien, falsos_=None):
        tmp = tempfile.mkdtemp(prefix="juez-sin-bien-")
        llamadas = []

        def medir(args, timeout=900):
            llamadas.append(args[0])
            if args[0] == "bien":
                return {"error": "bien.py salio con 2: no existe"}
            return {"partes": {"pieza": {"volumen": 10.0}}}
        viejos = {k: sys.modules.get(k) for k in ("catia_base", "pythoncom")}
        sys.modules.update(falsos_ or falsos())
        argv, med = sys.argv, jc.medir_b123d
        sys.argv, jc.medir_b123d = ["catia.py", tmp], medir
        try:
            with redirect_stdout(io.StringIO()) as out:
                codigo = jc.correr_ejercicio("99_no_existe", construir, con_bien=con_bien)
        finally:
            sys.argv, jc.medir_b123d = argv, med
            for k, v in viejos.items():
                if v is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = v
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            return codigo, json.load(f), llamadas, out.getvalue()

    @staticmethod
    def construir_bien(cb, c, reg, salida):
        reg.paso("algo", lambda: 1)
        salida["_steps"]["pieza"] = os.path.join(reg.carpeta, "pieza.stp")

    def test_sin_bien_ok_provisorio_y_tercer_cruce(self):
        codigo, s, llamadas, out = self.correr(self.construir_bien, con_bien=False)
        self.assertEqual(codigo, 0)
        self.assertFalse(s["ok"])                          # provisorio: lo decide el post-proceso del ejercicio
        self.assertTrue(s["ok_pasos"], s.get("error"))
        self.assertIn("post-proceso", s["pendiente"])
        self.assertIsNone(s["bien_py"])
        self.assertNotIn("bien", llamadas)
        self.assertIn("step", llamadas)                     # el tercer cruce se hace igual
        self.assertEqual(s["volumen_step_catia_en_build123d"], {"pieza": 10.0})
        self.assertEqual(s["diferencia_mm3"], {})
        self.assertIn("FIN", out)

    def test_sin_bien_un_paso_que_falla_es_rojo(self):
        def construir(cb, c, reg, salida):
            reg.paso("falla", lambda: 1 / 0)
        codigo, s, _, _ = self.correr(construir, con_bien=False)
        self.assertEqual(codigo, 0)
        self.assertFalse(s["ok"])
        self.assertIn("falla", s["error"])

    def test_mirar_catia_visible_movida_y_pausa_final(self):
        """CATIA_MIRAR=lento: conectar con visible=True, la ventana a la segunda pantalla y la pausa final antes de apagarla.
        Sin la variable: invisible y se apaga (lo de siempre)."""
        llamadas = {"visible": [], "apagar": 0, "mover": []}

        def conectar(visible=False):
            llamadas["visible"].append(visible)
            return object(), 4242

        class Vigia:
            vistos = []

            def __init__(self, pid):
                pass

            def start(self):
                pass

            def parar(self):
                pass
        fal = falsos()
        fal["catia_base"].conectar = conectar
        fal["catia_base"].Vigia = Vigia
        fal["catia_base"].apagar = lambda c: llamadas.__setitem__("apagar", llamadas["apagar"] + 1)
        mover = jc.mover_a_la_segunda_pantalla
        jc.mover_a_la_segunda_pantalla = lambda pid: llamadas["mover"].append(pid) or "movida"
        try:
            for valor in ("lento", None):
                if valor:
                    os.environ["CATIA_MIRAR"], os.environ["CATIA_PAUSA_FINAL"] = valor, "0"
                else:
                    os.environ.pop("CATIA_MIRAR", None)
                _, s, _, _ = self.correr(self.construir_bien, con_bien=False, falsos_=fal)
                if valor:
                    self.assertEqual(llamadas, {"visible": [True], "apagar": 1, "mover": [4242]})
                    self.assertEqual(s["pausa_final_seg"], 0.0)
                    self.assertEqual(s["pantalla"], "movida")
                else:
                    self.assertEqual(llamadas["visible"], [True, False])
                    self.assertEqual((llamadas["apagar"], llamadas["mover"]), (2, [4242]))
                    self.assertIs(s["catia_apagada"], True)
        finally:
            jc.mover_a_la_segunda_pantalla = mover
            os.environ.pop("CATIA_MIRAR", None)
            os.environ.pop("CATIA_PAUSA_FINAL", None)

    def test_con_bien_que_no_existe_es_rojo(self):
        codigo, s, llamadas, _ = self.correr(self.construir_bien, con_bien=True)
        self.assertIn("bien", llamadas)
        self.assertFalse(s["ok"])
        self.assertIn("bien.py salio con 2", s["error"])


if __name__ == "__main__":
    unittest.main()
