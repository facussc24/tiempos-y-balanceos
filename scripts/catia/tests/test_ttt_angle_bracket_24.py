# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 24 del banco de CATIA (Too Tall Toby PPP01-04 Angle Bracket, CATA 24/10/2026), que es
tambien el MOLDE de los 26, 28, 30 y 31 (sus pruebas usan las ayudas de aca; la tolerancia de masa es la de cada CFG).

1. Lo que midio CATIA en la R21 de CATA (24/10 10:30, corrida 24_r3) por 7 800 kg/m3 cae a 1 g de la guia (310,00 g) y a
   0,5 mm3 del gemelo; con build123d, el gemelo de la practica da ese volumen.
2. La copia del ej34: los cambios anotados (sin captura ni STEP propios, devuelve ctx) y el CAMBIO 4 del doblez (prueba
   cada arista candidata y controla el volumen); croquis.py de la practica esta en la carpeta del molde.
3. construir_con() con una pieza FALSA: material con la densidad de la guia, la masa llega y lo de construccion se oculta.
4. cerrar_con_respuesta(): VERDE con lo medido; ROJO con la masa a 2 g, sin masa, con el gemelo que no corre o que da
   otro volumen, y con el STEP que no da el volumen de CATIA."""
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
EJERCICIOS = os.path.join(CATIA_DIR, "ejercicios")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Obj  # noqa: E402

MEDIDO = {"24_ttt_angle_bracket": (39743.209, 39743.338), "26_ttt_tie_plate": (434238.267, 434238.267),   # (CATIA,
          "28_ttt_bearing_bracket": (102198.223, 102198.244), "30_ttt_corner_tie": (113789.264, 113789.264),  # STEP)
          "31_ttt_sm_hanger": (131756.352, 131756.352)}            # 31: R21 de CATA, 24/10 11:13 (31_r1)
GEMELO = {"24_ttt_angle_bracket": 39743.211, "26_ttt_tie_plate": 434238.267, "28_ttt_bearing_bracket": 102198.25,
          "30_ttt_corner_tie": 113789.264,                        # gemelo_b123d.py de cada carpeta (= la practica)
          "31_ttt_sm_hanger": 131756.349}                         # 31: la referencia de la guia (no hay gemelo propio)
# el centro (pedido 10 de la principal): el de CATIA en las corridas final3 (24/10 11:28) y el de cada gemelo; el 31 no
# tiene centro de referencia (la de la guia es solo un volumen)
CDG_CATIA = {"24_ttt_angle_bracket": [20.054, 0.0, 5.612], "26_ttt_tie_plate": [0.0, 0.0, 6.609],
             "28_ttt_bearing_bracket": [-13.674, 0.0, 21.163], "30_ttt_corner_tie": [-16.082, 0.0, 8.127],
             "31_ttt_sm_hanger": [0.0, 0.0, 41.14]}
CDG_GEMELO = {"24_ttt_angle_bracket": [20.0543, 0.0, 5.6124], "26_ttt_tie_plate": [0.0, 0.0, 6.6095],
              "28_ttt_bearing_bracket": [-13.6736, 0.0, 21.1625], "30_ttt_corner_tie": [-16.0823, 0.0, 8.1274],
              "31_ttt_sm_hanger": None}


def gemelo_medido(carpeta):
    g = {"volumen": GEMELO[carpeta]}
    if CDG_GEMELO[carpeta] is not None:
        g["cdg"] = list(CDG_GEMELO[carpeta])
    return g


def cargar(carpeta, archivo="catia.py", nombre=None):
    spec = importlib.util.spec_from_file_location(nombre or f"ej_{carpeta}_{archivo[:-3]}",
                                                  os.path.join(EJERCICIOS, carpeta, archivo))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


def comprobar_cuenta(t, carpeta):
    ej = cargar(carpeta)
    vc, vstep = MEDIDO[carpeta]
    t.assertLess(abs(vc * ej.CFG["densidad"] * 1e-6 - ej.CFG["masa_g"]), ej.CFG.get("tol_masa_g", 1.0))
    t.assertLess(abs(vc - GEMELO[carpeta]), 0.5)
    t.assertLess(abs(vstep - vc), 0.5)
    t.assertEqual(ej.CFG["ej"], carpeta)
    texto = open(os.path.join(EJERCICIOS, carpeta, ej.CFG["pieza"] + ".py"), encoding="utf-8").read()
    t.assertIn("Origen: ej", texto)
    for prohibido in ("captura(", "guardar_pieza(", "correr(", '__name__ == "__main__"'):
        t.assertNotIn(prohibido, texto)
    t.assertIn("ctx.update(doc=doc, part=part, body=", texto)
    return ej, texto


def comprobar_gemelo(t, carpeta):
    g = cargar(carpeta, "gemelo_b123d.py", f"gemelo_{carpeta}")
    r = g.pieza()
    s = r[0] if isinstance(r, tuple) else r
    t.assertLess(abs(s.volume - MEDIDO[carpeta][0]), 0.5)
    c = s.center()
    t.assertLess(max(abs(a - b) for a, b in zip((c.X, c.Y, c.Z), CDG_CATIA[carpeta])), 0.01)


def juez(ej, cfg, salida, tmp, gemelo=None, step=True, ok_pasos=True, step_info=None):
    salida["ok_pasos"], salida["ok"] = ok_pasos, False
    vc, vstep = MEDIDO[cfg["ej"]]
    salida["volumen_step_catia_en_build123d"] = {cfg["parte"]: vstep} if step else {}
    info = {"volumen": vstep, "cdg_mm": list(CDG_CATIA[cfg["ej"]]), "solidos": 1, "cascaras": 1, "caras_sueltas": 0}
    salida["step_catia_en_build123d"] = {cfg["parte"]: dict(info, **(step_info or {}))} if step else {}
    m = ej.e24 if hasattr(ej, "e24") else ej              # el 26, 28 y 30 usan el juez del molde
    m.jc.escribir(tmp, salida)
    return m.cerrar_con_respuesta(tmp, cfg, medir_gemelo=gemelo or (lambda: gemelo_medido(cfg["ej"])))


def salida_medida(cfg):
    vc = MEDIDO[cfg["ej"]][0]
    return {"volumen_catia": {cfg["parte"]: vc}, "masa_catia_g": round(vc * cfg["densidad"] * 1e-6, 3),
            "cdg_catia_mm": {cfg["parte"]: list(CDG_CATIA[cfg["ej"]])}, "archivos": [], "_steps": {}}


def comprobar_juez(t, carpeta):
    ej = cargar(carpeta)
    tmp = tempfile.mkdtemp(prefix="ej-ttt-")
    cfg = ej.CFG
    t.assertTrue(juez(ej, cfg, salida_medida(cfg), tmp)["ok"])
    mala = salida_medida(cfg)
    mala["masa_catia_g"] += cfg.get("tol_masa_g", 1.0) + 1.0
    t.assertFalse(juez(ej, cfg, mala, tmp)["ok"])
    sin = salida_medida(cfg)
    sin.pop("masa_catia_g")
    t.assertIn("sin masa de CATIA", juez(ej, cfg, sin, tmp)["error"])
    t.assertFalse(juez(ej, cfg, salida_medida(cfg), tmp, gemelo=lambda: {"error": "sin entorno"})["ok"])
    t.assertIn("contra el gemelo", juez(ej, cfg, salida_medida(cfg), tmp,
                                        gemelo=lambda: {"volumen": GEMELO[carpeta] + 5})["error"])
    t.assertIn("el STEP", juez(ej, cfg, salida_medida(cfg), tmp, step=False)["error"])
    pasos = salida_medida(cfg)                                 # un paso de CATIA fallo: nunca verde (revisor 24/10)
    pasos["ok_pasos_forzado"] = False
    t.assertFalse(juez(ej, cfg, pasos, tmp, ok_pasos=False)["ok"])
    coh = salida_medida(cfg)                                   # masa de la guia pero otra densidad (volumen 2 % menos)
    coh["masa_catia_g"] = cfg["masa_g"]
    coh["volumen_catia"][cfg["parte"]] *= 0.98
    s = juez(ej, cfg, coh, tmp, gemelo=lambda: dict(gemelo_medido(carpeta), volumen=coh["volumen_catia"][cfg["parte"]]))
    t.assertIn("sin coherencia", s["error"])
    t.assertNotIn("de la guia", s["error"])
    # pedido 10 de la principal: el centro (misma masa, otro centro), el STEP de 2 solidos y la excepcion fuera de un paso
    corrida = salida_medida(cfg)
    corrida["cdg_catia_mm"][cfg["parte"]][0] += 0.02
    s = juez(ej, cfg, corrida, tmp, step_info={"cdg_mm": list(corrida["cdg_catia_mm"][cfg["parte"]])})
    if CDG_GEMELO[carpeta] is not None:
        t.assertFalse(s["ok"])
        t.assertIn("no es el del gemelo", s["error"])
    else:                                       # el 31: sin centro de referencia un centro corrido no se ve, y se dice
        t.assertTrue(s["ok"], s.get("error"))
        t.assertEqual(s["juez"]["centro_gemelo"], "sin centro: la referencia es solo un volumen")
    t.assertIn("no es el de CATIA", juez(ej, cfg, salida_medida(cfg), tmp, step_info={"cdg_mm": [9.0, 9.0, 9.0]})["error"])
    t.assertIn("1 solido cerrado", juez(ej, cfg, salida_medida(cfg), tmp, step_info={"solidos": 2})["error"])
    nan = salida_medida(cfg)
    nan["cdg_catia_mm"][cfg["parte"]][2] = float("nan")
    t.assertFalse(juez(ej, cfg, nan, tmp)["ok"])
    exc = salida_medida(cfg)
    exc["error"] = "excepcion fuera de un paso: Traceback ..."
    s = juez(ej, cfg, exc, tmp)
    t.assertFalse(s["ok"])
    t.assertIn("excepcion fuera de un paso", s["error"])
    with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:   # idempotente: cerrar otra vez da lo mismo
        otra = json.load(f)
    m = ej.e24 if hasattr(ej, "e24") else ej
    m.jc.escribir(tmp, otra)
    s2 = m.cerrar_con_respuesta(tmp, cfg, medir_gemelo=lambda: gemelo_medido(carpeta))
    t.assertEqual((s2["ok"], s2["error"]), (s["ok"], s["error"]))
    # la cara suelta (la del 31_p10: 1 solido y 1 cara suelta) da rojo aunque el solido sea uno (revisor del pedido 10)
    t.assertIn("1 solido cerrado", juez(ej, cfg, salida_medida(cfg), tmp,
                                        step_info={"caras_sueltas": 1, "cascaras": 2})["error"])
    # idempotente de verdad: un cierre que dio ROJO por su cuenta (no por correr_ejercicio) y se vuelve a cerrar bien
    # queda VERDE y sin error (sin la guarda de error_juez, su propio texto lo dejaba rojo para siempre)
    rojo = juez(ej, cfg, salida_medida(cfg), tmp, gemelo=lambda: dict(gemelo_medido(carpeta), volumen=GEMELO[carpeta] + 5))
    t.assertFalse(rojo["ok"])
    with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
        otra = json.load(f)
    m.jc.escribir(tmp, otra)
    verde = m.cerrar_con_respuesta(tmp, cfg, medir_gemelo=lambda: gemelo_medido(carpeta))
    t.assertTrue(verde["ok"], verde.get("error"))
    t.assertNotIn("error", verde)


class Cuenta(unittest.TestCase):
    def test_cuenta_y_copia(self):
        ej, texto = comprobar_cuenta(self, "24_ttt_angle_bracket")
        self.assertIn("CAMBIO 4", texto)
        self.assertIn("redondeo_con_candidatas(sf, part, vol, ar, r, signo * redondeo_90(r, 38.0), nombre)", texto)
        self.assertTrue(os.path.isfile(os.path.join(EJERCICIOS, "24_ttt_angle_bracket", "croquis.py")))
        self.assertEqual((ej.CFG["masa_g"], ej.CFG["densidad"], ej.CFG["preferidos"]), (310.0, 7800.0, ej.ACERO))

    def test_juez(self):
        comprobar_juez(self, "24_ttt_angle_bracket")


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_gemelo(self):
        comprobar_gemelo(self, "24_ttt_angle_bracket")


class Cambio4(unittest.TestCase):
    """El CAMBIO 4 de pieza_ej34 (la unica logica escrita a mano en las copias): prueba cada candidata y controla el
    volumen contra la cuenta del redondeo de 90 grados."""

    def setUp(self):
        sys.path.insert(0, os.path.join(EJERCICIOS, "24_ttt_angle_bracket"))     # croquis.py vive ahi
        self.p = cargar("24_ttt_angle_bracket", "pieza_ej34.py", "pieza_ej34_prueba")

    def correr(self, fallan, suma):
        v = {"x": 1000.0, "creados": 0}

        def nuevo(ref, modo, r):
            if ref in fallan:
                raise RuntimeError("The method AddNewSolidEdgeFilletWithConstantRadius failed")
            v["creados"] += 1
            v["x"] += suma
        sf = types.SimpleNamespace(AddNewSolidEdgeFilletWithConstantRadius=nuevo)
        part = types.SimpleNamespace(Update=lambda: None)
        cands = [{"ref": "c0"}, {"ref": "c1"}]
        esperado = self.p.redondeo_90(5.0, 38.0)
        return self.p.redondeo_con_candidatas(sf, part, lambda: v["x"], cands, 5.0, esperado, "R5"), v

    def test_cuenta(self):
        self.assertAlmostEqual(self.p.redondeo_90(5.0, 38.0), 203.872, places=3)
        self.assertAlmostEqual(self.p.redondeo_90(10.0, 38.0), 815.487, places=3)

    def test_la_primera_falla_y_la_segunda_anda(self):
        out, v = self.correr({"c0"}, self.p.redondeo_90(5.0, 38.0))
        self.assertEqual(v["creados"], 1)
        self.assertTrue(out["intentos"][0].startswith("candidata 0: RuntimeError") and out["intentos"][1] == "candidata 1: ok")

    def test_rojo_si_ninguna_anda_o_no_da_la_cuenta(self):
        with self.assertRaises(RuntimeError):
            self.correr({"c0", "c1"}, 0.0)
        with self.assertRaises(RuntimeError):
            self.correr(set(), 150.0)                            # se creo, pero no suma lo del R5


class Construir(unittest.TestCase):
    def test_material_masa_y_construccion(self):
        ej = cargar("24_ttt_angle_bracket")
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej24-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        vc = MEDIDO["24_ttt_angle_bracket"][0]
        est = {"material": None}
        densidad = Obj(Name="angle_bracket\\Steel\\Steel.1\\Density", Value=7860.0)
        part = Obj(Update=lambda: None, Parameters=Obj(Count=1, Item=lambda i: densidad),
                   GetItem=lambda n: Obj(ApplyMaterialOnPart=lambda p, m, k: est.update(material=m.Name)))
        ocultos = []
        doc = Obj(Selection=Obj(Clear=lambda: None, Add=lambda o: ocultos.append(o),
                                VisProperties=Obj(SetShow=lambda k: None)), Product=Obj(), Close=lambda: None)
        doc.GetWorkbench = lambda n: Obj(Inertias=Obj(Add=lambda prod: Obj(
            Density=densidad.Value if est["material"] else 1000.0,
            Mass=vc * 1e-9 * (densidad.Value if est["material"] else 1000.0))))
        ctx = {"doc": doc, "part": part, "body": "cuerpo", "construccion": ["plano 1", "plano 2"]}
        original = ej.cargar
        ej.cargar = lambda nombre, ruta: types.SimpleNamespace(cuerpo=lambda c, reg: ctx)
        steel = Obj(Name="Steel")
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: Obj(Name="Metal", Materials=Obj(Count=1, Item=lambda j: steel))))

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        cb = types.SimpleNamespace(medir=lambda d, p, b: {"volume": vc, "cdg_mm": [0, 0, 0]}, guardar_pieza=guardar,
                                   CATIA_INSTALADA=tmp, Registro=catia_base.Registro)
        self.addCleanup(setattr, jc, "captura_bmp", jc.captura_bmp)       # auditor de la tanda: se devuelve
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        salida = {"volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        try:
            ej.construir_con(ej.CFG)(cb, Obj(Documents=Obj(Read=lambda r: mdoc)), catia_base.Registro(ej.CFG["ej"]),
                                     salida)
        finally:
            ej.cargar = original
        self.assertEqual(salida["material_catia"]["densidad_kg_m3"], 7800.0)
        self.assertAlmostEqual(salida["masa_catia_g"], vc * 7.8e-3, places=3)
        self.assertEqual(ocultos, ["plano 1", "plano 2"])
        self.assertEqual(salida["volumen_catia"]["angle_bracket"], vc)


if __name__ == "__main__":
    unittest.main()
