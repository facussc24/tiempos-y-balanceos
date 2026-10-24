# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 22 del banco de CATIA (Too Tall Toby PPP01-02 Post Cap, CATA 24/10/2026).

1. El volumen que midio CATIA en la R21 de CATA (24/10 10:20) por 1 020 kg/m3 cae a 1 g de la guia (43,09 g). Con
   build123d: el gemelo de la practica (sin los R1 del asa) da el volumen de CATIA antes del R1 a 0,5 mm3.
2. pieza_ej30.py es la copia del ej30 con los cambios anotados: no captura ni guarda ni corre suelto; devuelve ctx con
   el volumen antes del R1 y el plano del asa.
3. construir() con la pieza FALSA: sin ABS en el catalogo usa Steel y lo dice, la densidad pasa a 1 020 y la masa llega;
   el plano del asa se oculta.
4. cerrar_con_respuesta(): VERDE con lo medido; ROJO con la masa a 2 g, con el gemelo que no corre o da otro volumen, sin
   el volumen antes del R1 y con el STEP que no da el volumen de CATIA."""
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base
                                                     # (fija su carpeta al importarse: revisor del 18)

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ22 = os.path.join(CATIA_DIR, "ejercicios", "22_ttt_post_cap")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
sys.path.insert(0, EJ22)
from test_c_clamp_base_08 import Obj  # noqa: E402

VOL_CATIA, VOL_SIN_R1 = 42248.444, 42225.749          # R21 de CATA, 24/10/2026 10:20 (= ej30 del 19/10)
VOL_GEMELO = 42225.726                                 # gemelo_b123d.py (sin los R1 del asa)
CDG_GEMELO = [-0.7344, 0.0, 28.451]                    # gemelo_b123d.py, 24/10 (pedido 10 de la principal)
CDG_SIN_R1 = [-0.734, 0.0, 28.451]                     # CATIA antes del R1 (22_final2)


def cargar_ej22():
    spec = importlib.util.spec_from_file_location("ej22_catia", os.path.join(EJ22, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_gemelo():
    """Por ruta y con nombre propio: el 18 tambien tiene un gemelo_b123d.py y Python reusaria el primero que cargo."""
    spec = importlib.util.spec_from_file_location("gemelo_b123d_22", os.path.join(EJ22, "gemelo_b123d.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_masa_de_la_guia(self):
        ej = cargar_ej22()
        self.assertLess(abs(VOL_CATIA * ej.DENSIDAD_GUIA * 1e-6 - ej.MASA_GUIA_G), ej.TOL_MASA_G)
        self.assertLess(abs(VOL_SIN_R1 - VOL_GEMELO), ej.TOL_VOL)

    def test_la_copia_del_ej30(self):
        texto = open(os.path.join(EJ22, "pieza_ej30.py"), encoding="utf-8").read()
        self.assertIn("from catia_base import medir, nueva_pieza, ref, topologia", texto)
        for prohibido in ("captura(", "guardar_pieza(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn('ctx["vol_sin_r1"] = v0', texto)
        self.assertIn('ctx["cdg_sin_r1"] = m0.get("cdg_mm")', texto)
        self.assertIn("Origen: ej30_post_cap.py", texto)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_gemelo(self):
        g = cargar_gemelo()
        s, _va = g.pieza()
        self.assertLess(abs(s.volume - VOL_SIN_R1), 0.5)


class Cuenta22(unittest.TestCase):
    def correr_falso(self, catalogo=("Steel",)):
        ej = cargar_ej22()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej22-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        import pieza_ej30
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        est = {"material": None}
        densidad = Obj(Name="post_cap\\Steel\\Steel.1\\Density", Value=7860.0)
        part = Obj(Update=lambda: None, GetItem=lambda n: Obj(ApplyMaterialOnPart=lambda p, m, k: est.update(
            material=m.Name)))
        part.Parameters = Obj(Count=1, Item=lambda i: densidad)
        ocultos = []
        doc = Obj(Selection=Obj(Clear=lambda: None, Add=lambda o: ocultos.append(o),
                                VisProperties=Obj(SetShow=lambda k: None)), Product=Obj(), Close=lambda: None)
        doc.GetWorkbench = lambda n: Obj(Inertias=Obj(Add=lambda prod: Obj(
            Density=densidad.Value if est["material"] else 1000.0,
            Mass=VOL_CATIA * 1e-9 * (densidad.Value if est["material"] else 1000.0))))
        ctx = {"doc": doc, "part": part, "body": "cuerpo", "planos": ["plano del asa"], "vol_sin_r1": VOL_SIN_R1,
               "cdg_sin_r1": list(CDG_SIN_R1)}
        original = pieza_ej30.cuerpo
        pieza_ej30.cuerpo = lambda c, reg: ctx
        mats = [Obj(Name=n) for n in catalogo]
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: Obj(Name="Metal", Materials=Obj(
            Count=len(mats), Item=lambda j: mats[j - 1]))))
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc))

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        cb = types.SimpleNamespace(medir=lambda d, p, b: {"volume": VOL_CATIA, "cdg_mm": [0, 0, 0]},
                                   guardar_pieza=guardar, CATIA_INSTALADA=tmp, Registro=catia_base.Registro)
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            pieza_ej30.cuerpo = original
        return ej, jc, salida, ocultos, est, tmp

    def test_material_masa_y_plano(self):
        ej, jc, salida, ocultos, est, _ = self.correr_falso()
        self.assertEqual(est["material"], "Steel")
        self.assertIn("sin_preferido", salida["material_catia"])
        self.assertEqual(salida["material_catia"]["densidad_kg_m3"], 1020.0)
        self.assertAlmostEqual(salida["masa_catia_g"], VOL_CATIA * 1.02e-3, places=3)
        self.assertEqual(salida["volumen_sin_r1_catia"], VOL_SIN_R1)
        self.assertEqual(ocultos, ["plano del asa"])
        ej2, *_r, est2, _t = self.correr_falso(catalogo=("Steel", "ABS"))      # si el catalogo trae ABS, va ABS
        self.assertEqual(est2["material"], "ABS")

    def juez(self, salida, tmp, ej, gemelo=None, step=True, ok_pasos=True):
        salida["ok_pasos"], salida["ok"] = ok_pasos, False
        salida["volumen_step_catia_en_build123d"] = {ej.PARTE: VOL_CATIA + 0.149} if step else {}
        salida["step_catia_en_build123d"] = ({ej.PARTE: {"cdg_mm": (salida.get("cdg_catia_mm") or {}).get(ej.PARTE),
                                                       "solidos": 1, "caras_sueltas": 0}} if step else {})
        ej.jc.escribir(tmp, salida)
        return ej.cerrar_con_respuesta(tmp, medir_gemelo=gemelo or (lambda: {"volumen": VOL_GEMELO, "cdg": list(CDG_GEMELO)}))

    def test_juez_verde(self):
        ej, jc, salida, ocultos, est, tmp = self.correr_falso()
        s = self.juez(salida, tmp, ej)
        self.assertTrue(s["ok"], s.get("error"))

    def test_juez_rojo(self):
        ej, jc, salida, ocultos, est, tmp = self.correr_falso()
        base = json.dumps(salida)
        malo = json.loads(base)
        malo["masa_catia_g"] += 2.0
        self.assertFalse(self.juez(malo, tmp, ej)["ok"])
        self.assertFalse(self.juez(json.loads(base), tmp, ej, gemelo=lambda: {"error": "sin entorno"})["ok"])
        s = self.juez(json.loads(base), tmp, ej, gemelo=lambda: {"volumen": VOL_GEMELO + 5, "cdg": list(CDG_GEMELO)})
        self.assertIn("contra el gemelo", s["error"])
        sin = json.loads(base)
        sin.pop("volumen_sin_r1_catia")
        self.assertIn("antes del R1", self.juez(sin, tmp, ej)["error"])
        self.assertIn("el STEP", self.juez(json.loads(base), tmp, ej, step=False)["error"])
        self.assertFalse(self.juez(json.loads(base), tmp, ej, ok_pasos=False)["ok"])   # el R1 fallo: nunca verde
        # pedido 10 de la principal: el centro sin R1 corrido (misma masa), el STEP de dos solidos y la excepcion
        corrido = json.loads(base)
        corrido["cdg_sin_r1_catia"][0] += 0.02
        self.assertIn("no es el del gemelo", self.juez(corrido, tmp, ej)["error"])
        nan = json.loads(base)
        nan["cdg_sin_r1_catia"][2] = float("nan")
        self.assertFalse(self.juez(nan, tmp, ej)["ok"])
        dos = json.loads(base)
        salida_dos = self.juez(dos, tmp, ej)                       # verde; despues el mismo con un STEP de dos solidos
        self.assertTrue(salida_dos["ok"], salida_dos.get("error"))
        dos = json.loads(base)
        dos["ok_pasos"], dos["ok"] = True, False
        dos["volumen_step_catia_en_build123d"] = {ej.PARTE: VOL_CATIA + 0.149}
        dos["step_catia_en_build123d"] = {ej.PARTE: {"cdg_mm": dos["cdg_catia_mm"][ej.PARTE], "solidos": 2,
                                                     "caras_sueltas": 0}}
        ej.jc.escribir(tmp, dos)
        r = ej.cerrar_con_respuesta(tmp, medir_gemelo=lambda: {"volumen": VOL_GEMELO, "cdg": list(CDG_GEMELO)})
        self.assertIn("1 solido cerrado", r["error"])
        exc = json.loads(base)
        exc["error"] = "excepcion fuera de un paso: Traceback ..."
        r = self.juez(exc, tmp, ej)
        self.assertFalse(r["ok"])
        self.assertIn("excepcion fuera de un paso", r["error"])
        # revisor del pedido 10: la cara suelta, el centro del STEP y la idempotencia con un rojo seguido de un verde
        for info, texto in (({"solidos": 1, "caras_sueltas": 1}, "1 solido cerrado"),
                            ({"solidos": 1, "caras_sueltas": 0, "cdg_mm": [9.0, 9.0, 9.0]}, "centro del STEP")):
            otro = json.loads(base)
            otro["ok_pasos"], otro["ok"] = True, False
            otro["volumen_step_catia_en_build123d"] = {ej.PARTE: VOL_CATIA + 0.149}
            otro["step_catia_en_build123d"] = {ej.PARTE: dict({"cdg_mm": otro["cdg_catia_mm"][ej.PARTE]}, **info)}
            ej.jc.escribir(tmp, otro)
            r = ej.cerrar_con_respuesta(tmp, medir_gemelo=lambda: {"volumen": VOL_GEMELO, "cdg": list(CDG_GEMELO)})
            self.assertIn(texto, r["error"])
        r = self.juez(json.loads(base), tmp, ej, gemelo=lambda: {"volumen": VOL_GEMELO + 5, "cdg": list(CDG_GEMELO)})
        self.assertFalse(r["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            otra = json.load(f)
        ej.jc.escribir(tmp, otra)
        r = ej.cerrar_con_respuesta(tmp, medir_gemelo=lambda: {"volumen": VOL_GEMELO, "cdg": list(CDG_GEMELO)})
        self.assertTrue(r["ok"], r.get("error"))


if __name__ == "__main__":
    unittest.main()
