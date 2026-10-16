"""Tests de registro.py (T13, T16 y lo que usa bambu_red.py). Todo en una carpeta temporal."""
import json
import os
import re
import time
import unittest
from datetime import datetime, timedelta

import _base
from _base import registro

HOY_14 = datetime(2026, 10, 16, 14, 0).astimezone()


def anotar_a_mano(reg, pc, renglones):
    with open(reg / f"{pc}.jsonl", "a", encoding="utf-8") as f:
        for r in renglones:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


class T13Validar(unittest.TestCase):
    """T13: con la copia del registro real de hoy, marca la «cancelada» de 3 min de un trabajo de ayer."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("t13")
        self.reg = _base.apuntar(self.tmp, "registro_2026-10-16")

    def test_marca_la_cancelada_de_tres_minutos(self):
        hall = registro.validar(ahora_=HOY_14)
        rojos = [(e.get("trabajo_id"), m) for n, e, m in hall if n == "ROJO"]
        self.assertTrue(any(t == "20261014-172354-abrazadera_simple_proto2" and "no cierran" in m for t, m in rojos), rojos)

    def test_no_marca_lo_que_cierra(self):
        hall = registro.validar(ahora_=HOY_14)
        marcados = {e.get("trabajo_id") for n, e, m in hall if n == "ROJO"}
        # 06:57 -> 07:06 con 9 min: cierra; los cierres a mano con minutos null y nota: tambien
        for tid in ("20261015-065717-Base_Microscopio_20261015", "20261015-165204-juegos20",
                    "20261014-131851-pines20", "20261015-153217-pines_v3_prueba", "20261013-134543-molde_probeta_50x50"):
            self.assertNotIn(tid, marcados)

    def test_marca_la_fila_sin_cierre(self):
        anotar_a_mano(self.reg, "PC-PRUEBA", [{"tipo": "enviada", "trabajo_id": "20261014-090000-abierta",
                                              "archivo": "abierta.gcode.3mf", "cuando": "2026-10-14 09:00:00",
                                              "filamentos": []}])
        hall = registro.validar(ahora_=HOY_14)
        self.assertTrue(any(n == "ROJO" and e.get("trabajo_id") == "20261014-090000-abierta" and "sin cierre" in m
                            for n, e, m in hall))

    def test_la_linea_de_comandos_sale_con_1(self):
        r, out, _ = _base.correr(registro._main, ["registro.py", "--validar"])
        self.assertEqual(r, 1)
        self.assertIn("abrazadera_simple_proto2", out)

    def test_un_registro_sano_sale_con_0(self):
        tmp = _base.carpeta_nueva("t13sano")
        _base.apuntar(tmp)
        registro.anotar({"tipo": "enviada", "trabajo_id": "x1", "archivo": "x.gcode.3mf", "filamentos": []})
        registro.cerrar("x1", "terminada", minutos_reales=0.0, avance_pct=100)
        r, out, _ = _base.correr(registro._main, ["registro.py", "--validar"])
        self.assertEqual(r, 0, out)


class T16Horas(unittest.TestCase):
    """T16: los renglones nuevos llevan fecha y hora con zona; los viejos se siguen leyendo y ordenando."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("t16")
        self.reg = _base.apuntar(self.tmp)

    def test_renglon_nuevo_con_zona(self):
        e = registro.anotar({"tipo": "placa_libre"})
        self.assertRegex(e["cuando"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$")

    def test_viejos_y_nuevos_se_ordenan_por_fecha_no_por_texto(self):
        anotar_a_mano(self.reg, "PC-A", [{"tipo": "placa_libre", "cuando": "2026-10-16 13:29:54"}])
        anotar_a_mano(self.reg, "PC-B", [{"tipo": "placa_libre", "cuando": "2026-10-16T10:00:00-03:00"}])
        ev = registro.leer()
        self.assertEqual([e["cuando"] for e in ev], ["2026-10-16T10:00:00-03:00", "2026-10-16 13:29:54"])

    def test_placa_libre_anterior_al_fin_aunque_el_texto_diga_lo_contrario(self):
        # como texto '2026-10-16T10:00' > '2026-10-16 13:29' (la T va despues del espacio): mal
        anotar_a_mano(self.reg, "PC-A", [
            {"tipo": "enviada", "trabajo_id": "t1", "archivo": "t1.gcode.3mf", "cuando": "2026-10-16 12:49:42"},
            {"tipo": "terminada", "trabajo_id": "t1", "cuando": "2026-10-16 13:29:54"}])
        anotar_a_mano(self.reg, "PC-B", [{"tipo": "placa_libre", "cuando": "2026-10-16T10:00:00-03:00"}])
        self.assertLess(registro.placa_libre(), registro.ultimo_fin())

    def test_el_resumen_lee_los_dos_formatos(self):
        _base.apuntar(self.tmp, "registro_2026-10-16")
        registro.anotar({"tipo": "placa_libre"})
        r, out, _ = _base.correr(registro.resumen)
        self.assertEqual(r, 0)
        self.assertIn("HORAS de impresion", out)


class Trabajos(unittest.TestCase):
    def setUp(self):
        self.tmp = _base.carpeta_nueva("trab")
        self.reg = _base.apuntar(self.tmp, "registro_2026-10-16")

    def test_renglon_viejo_sin_subtask_sale_del_archivo(self):
        e = registro.trabajo_de("juegos20", solo_abiertas=False)
        self.assertEqual(e["trabajo_id"], "20261015-165204-juegos20")
        v = registro.trabajo_de("virolador_v14", solo_abiertas=False)
        self.assertEqual(v["trabajo_id"], "20261013-100449-virolador_v14")

    def test_por_task_id_antes_que_por_nombre(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "a", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "111", "filamentos": []})
        registro.anotar({"tipo": "enviada", "trabajo_id": "b", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "222", "filamentos": []})
        self.assertEqual(registro.trabajo_de("p", "111")["trabajo_id"], "a")
        self.assertEqual(registro.trabajo_de("p")["trabajo_id"], "b")       # sin task_id: el mas nuevo
        self.assertIsNone(registro.trabajo_de("otro_nombre"))

    def test_cerrar_no_duplica(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "c", "archivo": "c.gcode.3mf", "filamentos": []})
        self.assertIsNotNone(registro.cerrar("c", "cancelada", avance_pct=10))
        self.assertIsNone(registro.cerrar("c", "terminada"))
        self.assertEqual(sum(1 for e in registro.leer() if e.get("trabajo_id") == "c" and e["tipo"] in registro.CIERRES), 1)

    def test_abiertas_por_pc_y_por_nombre(self):
        anotar_a_mano(self.reg, "PC-A", [{"tipo": "enviada", "trabajo_id": "pa", "archivo": "pieza_a.gcode.3mf",
                                          "cuando": "2026-10-16 10:00:00", "pc": "PC-A"}])
        anotar_a_mano(self.reg, "PC-B", [{"tipo": "enviada", "trabajo_id": "pb", "archivo": "pieza_b.gcode.3mf",
                                          "cuando": "2026-10-16 11:00:00", "pc": "PC-B"}])
        self.assertEqual([e["trabajo_id"] for e in registro.abiertas(pc="PC-A")], ["pa"])
        self.assertEqual([e["trabajo_id"] for e in registro.abiertas(nombre="pieza_b")], ["pb"])

    def test_ips_anotadas_la_mas_nueva_primero(self):
        registro.anotar_ip("192.168.1.198")
        registro.anotar_ip("192.168.1.111", antes="192.168.1.198")
        self.assertEqual(registro.ips_anotadas()[:2], ["192.168.1.111", "192.168.1.198"])


class Rollos(unittest.TestCase):
    NEGRO = "6EACADA000000100"

    def setUp(self):
        self.tmp = _base.carpeta_nueva("rollos")
        self.reg = _base.apuntar(self.tmp, "registro_2026-10-16")

    def test_negro_de_hoy(self):
        # 1000 - lo descontado del registro de hoy (canceladas y fallidas por su avance, o por sus capas si dicen mas:
        # pines20 se cancelo en la capa 8 de 79, que es mas que su 10 %): 46,71 g
        self.assertAlmostEqual(registro.gramos_restantes(self.NEGRO), 46.71, places=1)

    def test_pesar_cuenta_desde_la_pesada(self):
        registro.ULTIMO_ESTADO.write_text(json.dumps({"ams": {"ams": [{"id": "16", "tray": [
            {"id": "1", "tag_uid": self.NEGRO, "tray_type": "PLA"}]}]}}), encoding="utf-8")
        e = registro.pesar("2", 310)            # lugar 2 = id 1; tara sin medir 250 g
        self.assertEqual(e["rollo"], self.NEGRO)
        self.assertEqual(e["gramos"], 60.0)
        self.assertFalse(e["tara_medida"])
        self.assertAlmostEqual(registro.gramos_restantes(self.NEGRO), 60.0)
        registro.anotar({"tipo": "enviada", "trabajo_id": "desp", "archivo": "d.gcode.3mf",
                         "filamentos": [{"rollo": self.NEGRO, "gramos": 12.5}]})
        self.assertAlmostEqual(registro.gramos_restantes(self.NEGRO), 47.5)

    def test_tara_de_la_casa(self):
        _base.correr(registro._main, ["registro.py", "--tara", "212"])
        e = registro.pesar(self.NEGRO, 300)
        self.assertEqual((e["tara"], e["tara_medida"], e["gramos"]), (212.0, True, 88.0))

    def test_reparto_por_capas_al_cambiar_de_rollo(self):
        tmp = _base.carpeta_nueva("reparto")
        _base.apuntar(tmp)
        registro.anotar({"tipo": "enviada", "trabajo_id": "r", "archivo": "r.gcode.3mf",
                         "filamentos": [{"rollo": "AAAA", "gramos": 100.0}]})
        registro.anotar({"tipo": "cambio de rollo", "trabajo_id": "r", "de_chip": "AAAA", "a_chip": "BBBB",
                         "capa": 30, "capas": 100})
        registro.cerrar("r", "terminada", avance_pct=100)
        self.assertAlmostEqual(registro.gramos_restantes("AAAA"), 970.0)
        self.assertAlmostEqual(registro.gramos_restantes("BBBB"), 930.0)

    def test_enviada_sin_confirmar_no_se_cuenta_y_confirmada_si(self):
        tmp = _base.carpeta_nueva("conf")
        _base.apuntar(tmp)
        registro.anotar({"tipo": "enviada", "trabajo_id": "s", "estado": "sin confirmar", "archivo": "s.gcode.3mf",
                         "filamentos": [{"rollo": "CCCC", "gramos": 40.0}]})
        self.assertAlmostEqual(registro.gramos_restantes("CCCC"), 1000.0)
        registro.confirmar("s", task_id="9")
        registro.confirmar("s", task_id="9")       # dos confirmaciones no cuentan doble
        self.assertAlmostEqual(registro.gramos_restantes("CCCC"), 960.0)

    def test_nombre_color(self):
        self.assertEqual(registro.nombre_color("#000000"), "negro")
        self.assertEqual(registro.nombre_color("#EFE255"), "amarillo")


class ArreglosDeLaAuditoria(unittest.TestCase):
    """TB2 y la placa libre (auditoria del 16/10/2026), en las dos direcciones."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("audit")
        self.reg = _base.apuntar(self.tmp)

    def test_TB2_reimpresion_no_se_toma_por_el_nombre(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "A", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "111", "filamentos": [{"rollo": "R", "gramos": 40.0}]})
        registro.cerrar("A", "terminada", avance_pct=100)
        registro.anotar({"tipo": "enviada", "trabajo_id": "B", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "222", "estado": "sin confirmar", "filamentos": [{"rollo": "R", "gramos": 40.0}]})
        self.assertIsNone(registro.trabajo_de("p", "111"))                 # el FINISH de la vieja no agarra la nueva
        self.assertEqual(registro.trabajo_de("p", "222")["trabajo_id"], "B")
        self.assertEqual(registro.trabajo_de("p")["trabajo_id"], "B")        # sin numero, por el nombre

    def test_TB2_renglon_viejo_sin_numero_sigue_saliendo_por_el_nombre(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "C", "archivo": "q.gcode.3mf", "filamentos": []})
        self.assertEqual(registro.trabajo_de("q", "999")["trabajo_id"], "C")

    def _fin_sin_ver_y_placa_libre(self, libre_antes_del_envio):
        if libre_antes_del_envio:
            anotar_a_mano(self.reg, "PC-L", [{"tipo": "placa_libre", "cuando": "2026-10-16T09:00:00-03:00"}])
        anotar_a_mano(self.reg, "PC-A", [{"tipo": "enviada", "trabajo_id": "X", "archivo": "x.gcode.3mf",
                                          "cuando": "2026-10-16T10:00:00-03:00"}])
        if not libre_antes_del_envio:
            anotar_a_mano(self.reg, "PC-L", [{"tipo": "placa_libre", "cuando": "2026-10-16T18:00:00-03:00"}])
        # otra PC lo vio terminado DESPUES de que Leo anoto la placa libre: hora real de fin desconocida
        anotar_a_mano(self.reg, "PC-B", [{"tipo": "terminada", "trabajo_id": "X", "minutos_reales": None,
                                          "fin_visto": "2026-10-16T18:30:00-03:00", "cuando": "2026-10-16T18:30:00-03:00"}])
        return registro.placa_libre() > registro.ultimo_fin()

    def test_placa_libre_antes_de_que_alguien_vea_el_fin_cuenta(self):
        self.assertTrue(self._fin_sin_ver_y_placa_libre(libre_antes_del_envio=False))

    def test_placa_libre_de_antes_del_envio_no_cuenta(self):
        self.assertFalse(self._fin_sin_ver_y_placa_libre(libre_antes_del_envio=True))

    def test_un_cierre_sin_nada_impreso_no_ocupa_la_placa(self):
        anotar_a_mano(self.reg, "PC-A", [
            {"tipo": "enviada", "trabajo_id": "Y", "archivo": "y.gcode.3mf", "cuando": "2026-10-16T10:00:00-03:00"},
            {"tipo": "cancelada", "trabajo_id": "Y", "avance_pct": 0, "cuando": "2026-10-16T10:05:00-03:00"}])
        self.assertIsNone(registro.ultimo_fin())

    def test_TB5_lo_que_fallo_en_la_primera_capa_si_ocupa_la_placa(self):
        anotar_a_mano(self.reg, "PC-A", [
            {"tipo": "enviada", "trabajo_id": "W", "archivo": "w.gcode.3mf", "cuando": "2026-10-16T10:00:00-03:00"},
            {"tipo": "fallida", "trabajo_id": "W", "avance_pct": 0, "capa": 1, "cuando": "2026-10-16T10:12:00-03:00"}])
        self.assertIsNotNone(registro.ultimo_fin())


class RolloSinChip(unittest.TestCase):
    """Fak, 16/10/2026: «si llega a fallar el chip deberíamos usarlo igual» y «te aclaro que es nuevo y listo»."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("sinchip")
        _base.apuntar(self.tmp)
        registro.ULTIMO_ESTADO.write_text(json.dumps({"ams": {"ams": [{"id": "16", "tray": [
            {"id": "1", "tag_uid": "6EACADA000000100", "tray_type": "PLA", "tray_info_idx": "GFA18"},
            {"id": "3", "tag_uid": "0000000000000000", "tray_type": "PLA", "tray_info_idx": "GFA18"},
            {"id": "2"}]}]}}), encoding="utf-8")

    def test_el_lugar_sin_chip_tiene_nombre(self):
        self.assertEqual(registro.chip_del_lugar(4), "SIN-CHIP-L4")
        self.assertEqual(registro.chip_del_lugar(2), "6EACADA000000100")
        self.assertIsNone(registro.chip_del_lugar(3))                      # lugar vacio

    def test_rollo_nuevo_arranca_la_cuenta(self):
        r, out, _ = _base.correr(registro._main, ["registro.py", "--rollo-nuevo", "4", "lo dijo Fak"])
        self.assertEqual(r, 0, out)
        registro.anotar({"tipo": "enviada", "trabajo_id": "z", "archivo": "z.gcode.3mf",
                         "filamentos": [{"rollo": "SIN-CHIP-L4", "gramos": 25.0}]})
        self.assertAlmostEqual(registro.gramos_restantes("SIN-CHIP-L4"), 975.0)
        nuevo = [e for e in registro.leer() if e["tipo"] == "rollo cargado"][0]
        self.assertEqual((nuevo["lugar"], nuevo["gramos"], nuevo["nota"]), (4, 1000.0, "lo dijo Fak"))

    def test_por_lugar_con_un_estado_viejo_avisa_y_con_uno_nuevo_no(self):
        r, out, _ = _base.correr(registro._main, ["registro.py", "--pesar", "2", "800"])
        self.assertIn("según el --estado de las", out)
        self.assertNotIn("OJO", out)
        viejo = time.time() - 1800
        os.utime(registro.ULTIMO_ESTADO, (viejo, viejo))
        r, out, _ = _base.correr(registro._main, ["registro.py", "--rollo-nuevo", "4"])
        self.assertIn("corré bambu_red.py --estado y anotalo de nuevo", out)
        r, out, _ = _base.correr(registro._main, ["registro.py", "--pesar", "6EACADA000000100", "800"])
        self.assertNotIn("--estado", out)                                   # por chip no depende del estado


class LineaDeComandos(unittest.TestCase):
    def setUp(self):
        self.tmp = _base.carpeta_nueva("cli")
        self.reg = _base.apuntar(self.tmp)

    def test_validar_con_un_renglon_sin_fecha(self):
        anotar_a_mano(self.reg, "PC-A", [{"tipo": "placa_libre", "cuando": None}])
        r, out, _ = _base.correr(registro._main, ["registro.py", "--validar"])
        self.assertEqual(r, 1)
        self.assertIn("sin fecha legible", out)

    def test_ip_de_la_pantalla_entra_en_la_busqueda_y_una_mal_escrita_no(self):
        r, out, _ = _base.correr(registro._main, ["registro.py", "--ip-de-la-pantalla", "192.168.1.140", "la leyó Paulo"])
        self.assertEqual(r, 0, out)
        self.assertEqual(registro.ips_anotadas()[0], "192.168.1.140")
        with self.assertRaises(SystemExit) as cm:
            registro._main(["registro.py", "--ip-de-la-pantalla", "192.168.1"])
        self.assertIn("no es una dirección", str(cm.exception))
        self.assertEqual(registro.ips_anotadas(), ["192.168.1.140"])

    def test_tara_sin_valor(self):
        with self.assertRaises(SystemExit) as cm:
            registro._main(["registro.py", "--pesar", "ABCDEF0000000100", "300", "--tara"])
        self.assertIn("le falta el valor", str(cm.exception))


class Aislamiento(unittest.TestCase):
    """Con BAMBU_PRUEBA=1 no se escribe fuera de la carpeta temporal (las dos direcciones)."""

    def test_frena_fuera_de_la_temporal(self):
        anterior = registro.CARPETA
        try:
            registro.CARPETA = _base.FUERA_DE_LA_TEMPORAL / "registro"      # fuera de la temporal, pero no la real
            with self.assertRaises(SystemExit) as cm:
                registro.anotar({"tipo": "placa_libre"})
            self.assertIn("fuera de la carpeta temporal", str(cm.exception))
        finally:
            registro.CARPETA = anterior

    def test_deja_adentro_de_la_temporal(self):
        tmp = _base.carpeta_nueva("aisl")
        _base.apuntar(tmp)
        self.assertEqual(registro.anotar({"tipo": "placa_libre"})["tipo"], "placa_libre")


if __name__ == "__main__":
    unittest.main()
