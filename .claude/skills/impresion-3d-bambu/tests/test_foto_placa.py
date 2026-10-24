"""Gate 3g (viernes 23/10/2026): la FOTO DE LA PLACA laminada se le manda a Fak ANTES de --apply. Casos G1 a G8, TODO EN
SECO (--en-seco: no se habla con la impresora; el laminado es el de juguete de _base.gcode_3mf con la miniatura agregada).

Falla real (Fak, 23/10/2026 11:00 (hora argentina): «mandame una foto de comos e ve la palca... de lsoa rhcivos laminados... anota par ael
vinre sque iempre deben amdnarle una foto»; 11:41: «no me madnas teuna foto de comoq uedaria digmaos en la palca laminada?»):
--imprimir dibujaba la primera capa y avisaba, pero nada exigia la foto de la placa ni que se la hubieran mandado."""
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import _base  # noqa: F401  (pone scripts/ en sys.path; va primero)
import bambu_red as br
import placa_foto as pf
import test_bambu_red as tbr

PNG = bytes.fromhex("89504e470d0a1a0a") + b"placa de juguete"      # cabecera PNG + relleno: alcanza para copiarla
FRASE = "Fak 23/10: mandalo sin foto, ya la vi en Studio"
AVISO = "AVISO [GATE foto de la placa]"
FRENO = "NO SE MANDA [GATE foto de la placa]"


class _Gate3g(tbr._ImprimirBase):
    """--imprimir --en-seco: la puerta de la foto corre antes de hablar con la impresora."""

    def setUp(self):
        super().setUp()
        self._hoy = os.environ.get("BAMBU_HOY")
        self.hoy("2026-10-25")                       # semana de AVISO (aviso_hasta 2026-10-30)

    def tearDown(self):
        if self._hoy is None:
            os.environ.pop("BAMBU_HOY", None)
        else:
            os.environ["BAMBU_HOY"] = self._hoy
        super().tearDown()

    def hoy(self, dia):
        os.environ["BAMBU_HOY"] = dia

    def laminado(self, nombre="pieza", con_foto=True, **kw):
        a = self.archivo(nombre, **kw)
        if con_foto:
            with zipfile.ZipFile(a, "a") as z:
                z.writestr("Metadata/plate_1.png", PNG)
        return a

    def imprimir(self, archivo, *extra):
        return self.correr("--imprimir", str(archivo), "--en-seco", *extra)


class FotoDeLaPlaca(_Gate3g):
    def test_G1_sin_apply_saca_la_foto_y_dice_el_comando(self):
        a = self.laminado()
        r, out, _ = self.imprimir(a)
        self.assertEqual(r, 0, out)
        png, ficha = pf.ruta_png(a), pf.ruta_json(a)
        self.assertIn("FOTO DE LA PLACA (mandársela a Fak ANTES de --apply):", out)
        self.assertIn(str(png), out)
        self.assertIn(f"--apply --foto-mandada {png}", out)
        self.assertEqual(png.read_bytes(), PNG)
        f = json.loads(ficha.read_text(encoding="utf-8"))
        self.assertEqual(f["sha256"], pf.sha(a))
        self.assertEqual(f["origen"], "Metadata/plate_1.png")
        self.assertEqual(png.name, "pieza_PLACA.png")
        self.assertNotIn(AVISO, out)

    def test_G2_apply_sin_foto_en_la_semana_de_aviso_avisa_y_sigue(self):
        a = self.laminado()
        r, out, _ = self.imprimir(a, "--apply")
        self.assertEqual(r, 0, out)
        self.assertIn(AVISO, out)
        self.assertIn("falta --foto-mandada", out)
        self.assertIn("desde el 2026-10-31 NO SE MANDA", out)
        self.assertNotIn(FRENO, out)

    def test_G3_apply_sin_foto_desde_el_31_10_no_se_manda(self):
        self.hoy("2026-10-31")
        a = self.laminado()
        r, out, _ = self.imprimir(a, "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn(FRENO, out)
        self.assertIn("--sin-foto --acepto", out)
        self.assertNotIn("EN SECO: no se consultó la impresora", out)     # freno ANTES de armar el plan
        self.hoy("2026-10-30")                                          # el ultimo dia de aviso todavia pasa
        r, out, _ = self.imprimir(a, "--apply")
        self.assertEqual(r, 0, out)
        self.assertIn(AVISO, out)

    def test_G4_apply_con_la_foto_mandada_pasa_sin_aviso_y_lo_anota(self):
        a = self.laminado()
        self.imprimir(a)                                                # saca la foto
        png = pf.ruta_png(a)
        for dia in ("2026-10-25", "2026-10-31"):
            self.hoy(dia)
            r, out, _ = self.imprimir(a, "--apply", "--foto-mandada", str(png))
            self.assertEqual(r, 0, (dia, out))
            self.assertIn(f"FOTO DE LA PLACA: mandada ({png.name}, misma placa)", out)
            self.assertNotIn(AVISO, out)
            self.assertNotIn(FRENO, out)
        f = json.loads(pf.ruta_json(a).read_text(encoding="utf-8"))
        self.assertIn("mandada_con_apply", f)

    def test_G5_la_foto_de_otra_version_del_laminado_no_vale(self):
        a = self.laminado()
        self.imprimir(a)
        png = pf.ruta_png(a)
        with zipfile.ZipFile(a, "a") as z:                              # se volvio a laminar: el archivo cambio
            z.writestr("Metadata/otra_cosa.txt", "relaminado")
        os.utime(png, (png.stat().st_atime, a.stat().st_mtime + 5))     # aunque la foto sea «nueva», el sha manda
        self.hoy("2026-10-31")
        r, out, _ = self.imprimir(a, "--apply", "--foto-mandada", str(png))
        self.assertEqual(r, 1, out)
        self.assertIn(FRENO, out)
        self.assertIn("OTRA version del laminado", out)
        self.hoy("2026-10-25")
        r, out, _ = self.imprimir(a, "--apply", "--foto-mandada", str(png))
        self.assertEqual(r, 0, out)
        self.assertIn(AVISO, out)
        # la foto de OTRO laminado tampoco
        b = self.laminado("otra")
        self.imprimir(b)
        self.hoy("2026-10-31")
        r, out, _ = self.imprimir(a, "--apply", "--foto-mandada", str(pf.ruta_png(b)))
        self.assertEqual(r, 1, out)
        self.assertIn("no es la foto de ESTE laminado", out)

    def test_G6_sin_foto_solo_con_la_frase_de_fak(self):
        a = self.laminado()
        self.hoy("2026-10-31")
        r, out, _ = self.imprimir(a, "--apply", "--sin-foto")
        self.assertEqual(r, 1, out)
        self.assertIn("NO SE MANDA: --sin-foto necesita la frase de Fak", out)
        r, out, _ = self.imprimir(a, "--apply", "--sin-foto", "--acepto", "corta")
        self.assertEqual(r, 1, out)
        r, out, _ = self.imprimir(a, "--apply", "--sin-foto", "--acepto", FRASE)   # sin --sin-detector: la frase es de la foto
        self.assertEqual(r, 0, out)
        self.assertIn(f"sin foto por pedido de Fak «{FRASE}»", out)
        self.assertNotIn(FRENO, out)
        f = json.loads(pf.ruta_json(a).read_text(encoding="utf-8"))
        self.assertEqual(f["sin_foto"], FRASE)
        # --acepto suelto (sin --sin-foto ni --sin-detector) sigue sin valer
        r, out, _ = self.imprimir(a, "--apply", "--acepto", FRASE)
        self.assertEqual(r, 1, out)
        self.assertIn("--acepto va solo con --sin-detector, --sin-foto o --sin-pesar", out)

    def test_G7_laminado_sin_miniatura_es_no_medido_nunca_verde(self):
        a = self.laminado(con_foto=False)
        r, out, _ = self.imprimir(a)
        self.assertEqual(r, 0, out)
        self.assertIn("NO PUDE sacar la foto de la placa", out)
        self.assertFalse(pf.ruta_png(a).exists())
        r, out, _ = self.imprimir(a, "--apply")
        self.assertEqual(r, 0, out)
        self.assertIn(AVISO, out)
        self.hoy("2026-10-31")
        r, out, _ = self.imprimir(a, "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn(FRENO, out)

    def test_G8_placa_foto_por_consola(self):
        a = self.laminado()
        r = subprocess.run([sys.executable, "-I", str(Path(pf.__file__)), str(a)], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("FOTO DE LA PLACA:", r.stdout)
        self.assertTrue(pf.ruta_png(a).exists())
        b = self.laminado("sin", con_foto=False)
        r = subprocess.run([sys.executable, "-I", str(Path(pf.__file__)), str(b)], capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, pf.SALIDA_SIN_MINIATURA, r.stdout + r.stderr)
        self.assertIn("NO MEDIDO", r.stdout)

    def test_canon_y_modo(self):
        can = pf.canon()
        self.assertEqual(can["aviso_hasta"], "2026-10-30")
        self.assertEqual(can["freno_desde"], "2026-10-31")
        from datetime import date
        self.assertEqual(pf.modo(can, date(2026, 10, 30)), "aviso")
        self.assertEqual(pf.modo(can, date(2026, 10, 31)), "freno")
        self.assertTrue(pf.frase_valida(FRASE, can))
        self.assertFalse(pf.frase_valida("corta", can))
        self.assertFalse(pf.frase_valida(None, can))


if __name__ == "__main__":
    import unittest
    unittest.main()
