# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 34 del banco de CATIA (choque exacto en CATIA del v16 entregado contra el panel del
cliente, y del gemelo subido 1 mm; 24/10/2026). cerrar_con_referencia contra una referencia de OpenCASCADE de prueba:
VERDE con el v16 sin interseccion y el gemelo con la de OpenCASCADE; ROJO si el v16 choca, si el gemelo no choca o se
aparta de OpenCASCADE, si la distancia de CATIA se aparta, si falta un caso o el gemelo va primero, si CATIA leyo otro
volumen, si la referencia es de otros archivos o no esta; y el cierre es idempotente."""
import copy
import hashlib
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ34 = os.path.join(CATIA_DIR, "ejercicios", "34_choque_v16_panel")
sys.path.insert(0, CATIA_DIR)


def cargar():
    spec = importlib.util.spec_from_file_location("ej34_catia", os.path.join(EJ34, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


EJ = cargar()
REF = {"sha256": {n: EJ.ENTRADAS[n][2] for n in EJ.ENTRADAS},
       "casos": {"v16": {"vol_utillaje": 89278.483, "interseccion": 0.0, "distancia_min": 0.0455, "veredicto": "no choca"},
                 "gemelo_1mm": {"vol_utillaje": 89278.287, "interseccion": 69.573, "distancia_min": 0.0,
                                "veredicto": "CHOCA"}}}
CASOS = {"v16": {"utillaje": 89278.482, "panel": 91770.06, "pegado": 89278.482, "interseccion": 0.0,
                 "dist_min_catia": 0.0455},
         "gemelo_1mm": {"utillaje": 89277.636, "panel": 91770.06, "pegado": 89277.636, "interseccion": 69.561,
                        "dist_min_catia": 0.0}}


class Cierre(unittest.TestCase):
    def cerrar(self, casos=None, orden=("v16", "gemelo_1mm"), ref=None, sin_ref=False, ej=None, ok_pasos=True,
               error_juez=None):
        ej = ej or cargar()
        tmp = tempfile.mkdtemp(prefix="ej34-")
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": "x", "casos": casos if casos is not None else CASOS,
             "orden_casos": list(orden)}
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        rr = os.path.join(tmp, "referencia_occ.json")
        if not sin_ref:
            with open(rr, "w", encoding="utf-8") as f:
                json.dump(ref or REF, f)
        return ej.cerrar_con_referencia(tmp, referencia=rr), tmp, ej

    def cambiado(self, caso, **k):
        c = copy.deepcopy(CASOS)
        c[caso].update(k)
        return c

    def test_verde(self):
        r, *_ = self.cerrar()
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("error", r)
        self.assertEqual(r["veredicto_v16"], "no choca (CATIA coincide en la interseccion; la luz la mide OpenCASCADE)")

    def test_sin_distancia_de_catia_igual_verde(self):
        c = copy.deepcopy(CASOS)
        for d in c.values():
            d.pop("dist_min_catia")
            d["dist_error"] = "com_error"
        self.assertTrue(self.cerrar(c)[0]["ok"])

    def test_rojos(self):
        rojos = {
            "v16 choca": self.cambiado("v16", interseccion=0.5),
            "gemelo sin choque": self.cambiado("gemelo_1mm", interseccion=0.0),
            "gemelo lejos de OpenCASCADE": self.cambiado("gemelo_1mm", interseccion=68.9),
            "distancia del v16": self.cambiado("v16", dist_min_catia=0.052),
            "otro volumen leido": self.cambiado("v16", utillaje=89270.0, pegado=89270.0),
            "pegado perdio volumen": self.cambiado("v16", pegado=89000.0),
            "panel leido a medias en el v16": self.cambiado("v16", panel=91000.0),
            "panel sin medir": self.cambiado("v16", panel=None),
            "NaN en la interseccion del v16": self.cambiado("v16", interseccion=float("nan")),
            "NaN en el gemelo": self.cambiado("gemelo_1mm", interseccion=float("nan")),
        }
        for que, casos in rojos.items():
            with self.subTest(que):
                r, *_ = self.cerrar(casos)
                self.assertFalse(r["ok"])
                self.assertEqual(r["veredicto_v16"], "sin decidir")
        sin_gemelo = {"v16": CASOS["v16"]}
        self.assertFalse(self.cerrar(sin_gemelo, orden=("v16",))[0]["ok"])
        self.assertFalse(self.cerrar(orden=("gemelo_1mm", "v16"))[0]["ok"])
        otra = copy.deepcopy(REF)
        otra["sha256"]["panel"] = "0" * 64
        self.assertFalse(self.cerrar(ref=otra)[0]["ok"])
        self.assertFalse(self.cerrar(sin_ref=True)[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_v16_que_choca_en_las_dos(self):
        # si OpenCASCADE dijera choque del v16, CATIA tiene que dar el mismo volumen (no se decide «no choca»)
        ref = copy.deepcopy(REF)
        ref["casos"]["v16"].update(interseccion=3.2, distancia_min=0.0, veredicto="CHOCA")
        r, *_ = self.cerrar(self.cambiado("v16", interseccion=3.2, dist_min_catia=0.0), ref=ref)
        self.assertTrue(r["ok"], r.get("error"))
        self.assertEqual(r["veredicto_v16"], "CHOCA (CATIA coincide en la interseccion; la luz la mide OpenCASCADE)")
        self.assertFalse(self.cerrar(self.cambiado("v16", dist_min_catia=0.0), ref=ref)[0]["ok"])

    def test_idempotente(self):
        r, tmp, ej = self.cerrar(self.cambiado("v16", interseccion=0.5))
        self.assertFalse(r["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            s = json.load(f)
        s["casos"] = CASOS
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        r2 = ej.cerrar_con_referencia(tmp, referencia=os.path.join(tmp, "referencia_occ.json"))
        self.assertTrue(r2["ok"], r2.get("error"))
        self.assertNotIn("error", r2)


class Entradas(unittest.TestCase):
    def test_por_sha_y_no_por_nombre(self):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej34-")
        falso = os.path.join(tmp, "virolador_v10_two.step")       # mismo nombre, otro contenido
        with open(falso, "wb") as f:
            f.write(b"otro virolador")
        os.environ["V16_ENTREGADO"] = falso
        try:
            self.assertTrue(any(x.startswith("v16:") and "sha256" in x for x in ej.entradas_malas()))
        finally:
            del os.environ["V16_ENTREGADO"]

    def test_el_gemelo_va_despues(self):
        self.assertEqual(cargar().CASOS, ("v16", "gemelo_1mm"))


AL_REVES = (b"ISO-10303-21;\r\nHEADER;\r\nFILE_NAME('v16','2026-10-24',(''),(''),'','','');\r\n"
            b"FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');\r\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\r\n"
            b"ENDSEC;\r\nDATA;\r\n#1=CARTESIAN_POINT('',(0.,0.,0.));\r\nENDSEC;\r\nEND-ISO-10303-21;\r\n")


class CopiaParaCatia(unittest.TestCase):
    """La cabecera al reves (OpenCASCADE 7.8) hace que CATIA lea el STEP VACIO: el juez abre una copia arreglada."""
    def preparar(self):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej34-")
        orig = os.path.join(tmp, "v16.step")
        with open(orig, "wb") as f:
            f.write(AL_REVES)
        os.environ["V16_ENTREGADO"] = orig
        self.addCleanup(os.environ.pop, "V16_ENTREGADO", None)
        var, defecto, _ = ej.ENTRADAS["v16"]                   # el sha del STEP de prueba
        ej.ENTRADAS = dict(ej.ENTRADAS, v16=(var, defecto, hashlib.sha256(AL_REVES).hexdigest()))
        os.makedirs(os.path.join(tmp, "trabajo"))
        return ej, tmp, orig

    def test_arregla_la_copia_y_no_el_original(self):
        ej, tmp, orig = self.preparar()
        copia, info = ej.copia_para_catia("v16", os.path.join(tmp, "trabajo"))
        self.assertTrue(info["cabecera_arreglada"])
        self.assertEqual(ej._step_cabecera().orden_de_archivo(copia), ("FILE_DESCRIPTION", "FILE_NAME", "FILE_SCHEMA"))
        with open(orig, "rb") as f:
            self.assertEqual(f.read(), AL_REVES)                  # el original no se toca

    def test_rojo_si_la_copia_cambia_la_geometria(self):
        ej, tmp, _ = self.preparar()

        class Rompe:
            def arreglar_archivo(self, p):
                with open(p, "ab") as f:
                    f.write(b"#2=CARTESIAN_POINT('',(1.,0.,0.));\r\n")
                return True, ("FILE_NAME", "FILE_DESCRIPTION", "FILE_SCHEMA")
        with self.assertRaises(ValueError):
            ej.copia_para_catia("v16", os.path.join(tmp, "trabajo"), sc=Rompe())

    def test_rojo_si_el_original_no_tiene_el_sha(self):
        ej, tmp, orig = self.preparar()
        with open(orig, "ab") as f:
            f.write(b"/* otro */\r\n")
        with self.assertRaises(ValueError):
            ej.copia_para_catia("v16", os.path.join(tmp, "trabajo"))


if __name__ == "__main__":
    unittest.main()
