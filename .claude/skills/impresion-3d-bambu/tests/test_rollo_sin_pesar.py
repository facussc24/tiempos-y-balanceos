"""Gate 3h (viernes 23/10/2026): un rollo que nunca se peso ni se anoto como nuevo no vale 1000 g. Casos H1 a H6 contra la
impresora de juguete (tests/impresora_juguete.py), con la subida reemplazada (_ImprimirBase): nada habla con la impresora real.

Falla real (22/10/2026): la PLACA v5 pidio 51 g del negro del lugar 4; el registro no tenia pesada de ese rollo, la cuenta
arrancaba de 1000 g («quedan ~683 g») y el rollo se termino a las 15:32. Fak, 16:23 (hora argentina): «nunca deberia haberme quedado sin
filamento, en teoria vos calculabas cuanto habia... dejalo anotado para el viernes asi averiguamos el origen de esta falla»."""
from datetime import datetime

import _base  # noqa: F401  (pone scripts/ en sys.path; va primero)
from _base import registro
import bambu_red as br
import rollo_sin_pesar as rsp
import test_bambu_red as tbr

AVISO = "AVISO [GATE rollo sin pesar]"
FRENO = "[GATE rollo sin pesar]"
FRASE = "Fak 23/10: mandalo igual, el rollo lo pese yo a ojo"


class _Gate3h(tbr._ImprimirBase):
    """El reloj de la casa (_ahora) arranca en el 16/10/2026 (semana de AVISO); el_31() lo pasa al freno."""

    def el_31(self):
        br._ahora = lambda: datetime(2026, 10, 31, 10, 0).astimezone()

    def imprimir(self, archivo, *extra):
        return self.correr("--imprimir", str(archivo), *extra)


class RolloSinPesar(_Gate3h):
    def test_H1_sin_pesada_la_cuenta_desde_1000_g_avisa_en_la_semana_de_aviso(self):
        """Lo del 22/10 reproducido: tres envios registrados y ninguna pesada -> «quedan» alto por la cuenta, el chequeo de
        gramos pasa, y ANTES el programa no decia nada. Ahora avisa y nombra el lugar, el chip y el comando para pesar."""
        for g in (219.57, 51.61, 37.56):
            registro.anotar({"tipo": "enviada", "trabajo_id": f"20261022-prueba-{g}", "estado": "sin confirmar",
                             "filamentos": [{"lugar": 1, "material": "PLA Lite", "color": "#000000", "gramos": g, "rollo": tbr.NEGRO}]})
        self.assertFalse(registro.rollo(tbr.NEGRO)["pesado"])
        self.assertGreater(registro.rollo(tbr.NEGRO)["quedan"], 600)
        r, out, _ = self.imprimir(self.archivo(gramos=(51.0,)))
        self.assertEqual(r, 0, out)
        self.assertIn(AVISO, out)
        self.assertIn(tbr.NEGRO, out)
        self.assertIn("registro.py --pesar", out)
        self.assertIn("desde el 2026-10-31 NO SE MANDA", out)
        self.assertNotIn("NO SE MANDA:", out)

    def test_H2_desde_el_31_10_no_se_manda_y_no_sube_nada(self):
        self.el_31()
        # con --apply tambien va --sin-foto con la frase: el gate 3g (foto de la placa) corre antes y frenaria por lo suyo
        for extra in ((), ("--apply", "--sin-foto", "--acepto", FRASE)):
            r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)), *extra)
            self.assertEqual(r, 1, out)
            self.assertIn("NO SE MANDA: " + FRENO, out)
            self.assertIn("--sin-pesar --acepto", out)
        self.assertEqual(self.subidas, [])

    def test_H3_con_una_pesada_pasa_sin_aviso_tambien_el_31(self):
        self.quedan(tbr.NEGRO, 500)
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)))
        self.assertEqual(r, 0, out)
        self.assertNotIn("rollo sin pesar", out)
        self.el_31()
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)))
        self.assertEqual(r, 0, out)
        self.assertNotIn("rollo sin pesar", out)

    def test_H4_sin_pesar_solo_con_la_frase_de_fak(self):
        self.el_31()
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)), "--sin-pesar")
        self.assertEqual(r, 1, out)
        self.assertIn("NO SE MANDA: --sin-pesar necesita la frase de Fak", out)
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)), "--sin-pesar", "--acepto", "corta")
        self.assertEqual(r, 1, out)
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)), "--sin-pesar", "--acepto", FRASE)
        self.assertEqual(r, 0, out)
        self.assertIn(f"ROLLO SIN PESAR por pedido de Fak «{FRASE}»", out)
        self.assertNotIn("NO SE MANDA:", out)
        # con --apply queda anotado en el registro, con la frase
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)), "--apply", "--sin-pesar", "--sin-foto", "--acepto", FRASE)
        self.assertEqual(r, 0, out)
        eventos = [e for e in registro.leer() if e.get("tipo") == "sin pesar"]
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0]["frase"], FRASE)
        self.assertIn(tbr.NEGRO, eventos[0]["rollos"])

    def test_H5_un_rollo_anotado_como_nuevo_cuenta_como_pesado(self):
        registro.anotar({"tipo": "rollo cargado", "rollo": tbr.NEGRO, "lugar": 1, "gramos": 1000.0, "nota": "Fak: rollo nuevo"})
        self.assertTrue(registro.rollo(tbr.NEGRO)["pesado"])
        self.el_31()
        r, out, _ = self.imprimir(self.archivo(gramos=(10.0,)))
        self.assertEqual(r, 0, out)
        self.assertNotIn("rollo sin pesar", out)

    def test_H6_gate_puro_y_canon(self):
        from datetime import date
        can = rsp.canon()
        self.assertEqual((can["aviso_hasta"], can["freno_desde"], can["frase_minima"]), ("2026-10-30", "2026-10-31", 10))
        self.assertEqual(rsp.modo(can, date(2026, 10, 30)), "aviso")
        self.assertEqual(rsp.modo(can, date(2026, 10, 31)), "freno")
        rollos = [(1, "CHIP-A", "negro"), (2, None, "blanco"), (3, "CHIP-C", "rojo")]
        info = {"CHIP-A": {"pesado": False, "quedan": 683.4}, "CHIP-C": {"pesado": True, "quedan": 120.0}}
        g = rsp.gate(rollos, dia=date(2026, 10, 25), rollo=lambda c: info[c], can=can)
        self.assertFalse(g["frena"])
        self.assertEqual(g["sin_pesar"], ["CHIP-A"])
        self.assertEqual(len(g["lineas"]), 1)
        self.assertIn("683 g", g["lineas"][0])
        g = rsp.gate(rollos, dia=date(2026, 10, 31), rollo=lambda c: info[c], can=can)
        self.assertTrue(g["frena"])
        self.assertEqual(len(g["fallas"]), 1)
        g = rsp.gate(rollos, dia=date(2026, 10, 31), sin_pesar=True, acepto=FRASE, rollo=lambda c: info[c], can=can)
        self.assertFalse(g["frena"])
        self.assertEqual(g["frase"], FRASE)
        g = rsp.gate(rollos, dia=date(2026, 10, 31), sin_pesar=True, acepto="corta", rollo=lambda c: info[c], can=can)
        self.assertTrue(g["frena"])
        g = rsp.gate([(3, "CHIP-C", "rojo")], dia=date(2026, 10, 31), rollo=lambda c: info[c], can=can)
        self.assertEqual((g["frena"], g["lineas"], g["sin_pesar"]), (False, [], []))


if __name__ == "__main__":
    import unittest
    unittest.main()
