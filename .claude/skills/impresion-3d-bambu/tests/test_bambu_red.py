"""Tests de bambu_red.py contra la impresora de juguete y lecturas guardadas (T1 a T18 del plan del 16/10/2026).
Ninguno habla con la impresora real ni escribe en el registro o en el archivo de datos reales."""
import json
import os
import socket
import ssl
import subprocess
import sys
import unittest

import _base
from _base import registro, SERIE, OTRA_SERIE, CODIGO
import bambu_red as br
from impresora_juguete import Juguete, certificado

HAY_OPENSSL = certificado(_base.RAIZ_TMP, SERIE) is not None and certificado(_base.RAIZ_TMP, OTRA_SERIE) is not None


def puerto_libre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class ConJuguete(unittest.TestCase):
    """Base: carpeta temporal, archivo de datos apuntando a 127.0.0.1 y una impresora de juguete."""
    serie_juguete = SERIE
    connack = 0

    def setUp(self):
        if not HAY_OPENSSL:
            self.skipTest("no hay openssl en esta PC para el certificado de juguete")
        self.tmp = _base.carpeta_nueva(type(self).__name__)
        self.reg = _base.apuntar(self.tmp)
        self.jug = Juguete(_base.RAIZ_TMP, self.serie_juguete, CODIGO, connack=self.connack)
        self._puerto = br.PUERTO_MQTT
        br.PUERTO_MQTT = self.jug.puerto
        self.datos = _base.escribir_datos(self.tmp, "127.0.0.1")

    def tearDown(self):
        if hasattr(self, "jug"):
            self.jug.parar()
            br.PUERTO_MQTT = self._puerto

    def correr(self, *args):
        return _base.correr(br.main, ["bambu_red.py", *args])


class T21Estado(ConJuguete):
    def test_lee_el_estado(self):
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 0, out)
        self.assertIn("gcode_state: RUNNING", out)
        self.assertIn("lugar 2: PLA Lite", out)
        guardado = json.loads((self.tmp / "claude" / "bambu-a2l-ultimo-estado.json").read_text(encoding="utf-8"))
        self.assertEqual(guardado["gcode_state"], "RUNNING")

    def test_tls_con_tope_1_2(self):
        self.assertEqual(br._contexto_tls().maximum_version, ssl.TLSVersion.TLSv1_2)
        t = br.tls("127.0.0.1", serie=SERIE)
        self.assertEqual(t.version(), "TLSv1.2")
        t.close()

    def test_informe_partido_en_dos_no_se_pierde(self):
        self.jug.partir = True                  # el informe completo llega en dos mitades con 1,5 s de pausa
        v = br.leer_estado(br.cargar_datos(), 6)
        self.assertEqual(v.get("gcode_state"), "RUNNING")
        self.assertEqual(len(br.lugares_del_cargador(v)), 3)

    def test_informe_parcial_no_borra_el_cargador(self):
        visto = br.fusionar({}, _base_estado())
        br.fusionar(visto, {"ams": {"tray_now": "2", "ams": [{"id": "16", "tray": [{"id": "1", "remain": -1}]}]}})
        self.assertEqual(len(br.lugares_del_cargador(visto)), 3)
        self.assertEqual(visto["ams"]["tray_now"], "2")


def _base_estado():
    from impresora_juguete import estado_base
    return estado_base()


class T6AccesoRechazado(ConJuguete):
    connack = 5

    def test_estado_sale_con_13(self):
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 13, out)
        self.assertIn("cambió el código de acceso o se apagó el modo desarrollador", out)
        self.assertNotIn("Traceback", out + err)


class CertificadoDeOtraSerie(ConJuguete):
    serie_juguete = OTRA_SERIE

    def test_no_le_manda_el_codigo_a_otra_impresora(self):
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 12, out)
        self.assertIn("hay otra impresora", out)
        # el codigo de acceso nunca llego: el certificado se mira antes del CONNECT
        self.assertEqual(self.jug.recibidos, [])


class T14NuncaUnTraceback(unittest.TestCase):
    """T14: con la impresora apagada, cada comando sale distinto de 0 con un renglon en castellano y sin Traceback."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("t14")
        self.reg = _base.apuntar(self.tmp)
        self._puerto = br.PUERTO_MQTT
        br.PUERTO_MQTT = puerto_libre()          # nadie escucha ahi: la impresora «apagada»
        _base.escribir_datos(self.tmp, "127.0.0.1")
        self.gcode = _base.gcode_3mf(self.tmp / "pieza.gcode.3mf")

    def tearDown(self):
        br.PUERTO_MQTT = self._puerto

    COMANDOS = (["--estado"], ["--imprimir", "{gcode}"], ["--imprimir", "{gcode}", "--apply"], ["--foto", "{tmp}/f.jpg"],
                ["--cancelar"], ["--pausar"], ["--velocidad"], ["--velocidad", "3"], ["--luz"], ["--luz", "on"],
                ["--ambiente"], ["--avisar-retiro"])

    def test_cada_comando(self):
        for cmd in self.COMANDOS:
            args = [x.format(gcode=self.gcode, tmp=self.tmp) for x in cmd]
            with self.subTest(cmd=" ".join(cmd)):
                r, out, err = _base.correr(br.main, ["bambu_red.py", *args])
                self.assertNotEqual(r, 0, out)
                self.assertNotIn("Traceback", out + err)
                ultima = [x for x in out.splitlines() if x.strip()][-1]
                self.assertRegex(ultima, r"[a-záéíóúñ]{3,} ", out)

    def test_por_la_linea_de_comandos(self):
        # el camino real: python bambu_red.py --estado, con las rutas en la carpeta temporal (variables de entorno)
        env = dict(os.environ, BAMBU_DATOS=str(self.tmp / "claude" / "bambu-a2l.json"),
                   BAMBU_DATOS_NUBE=str(self.tmp / "nube" / "bambu-a2l.json"), BAMBU_REGISTRO=str(self.reg),
                   PYTHONIOENCODING="cp1252")
        r = subprocess.run([sys.executable, str(_base.SCRIPTS / "bambu_red.py"), "--estado"],
                           capture_output=True, text=True, env=env, timeout=120, encoding="cp1252", errors="replace")
        self.assertEqual(r.returncode, 12, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stdout + r.stderr)
        self.assertIn("No encuentro la impresora", r.stdout)

    def test_ctrl_c_sale_limpio(self):
        anterior = br.estado
        try:
            def corta():
                raise KeyboardInterrupt
            br.estado = corta
            r, out, err = _base.correr(br.main, ["bambu_red.py", "--estado"])
        finally:
            br.estado = anterior
        self.assertEqual(r, 130)
        self.assertIn("cortado a mano", out)


class Aislamiento(unittest.TestCase):
    def test_no_escribe_el_archivo_de_datos_real(self):
        anterior = br.DATOS
        try:
            br.DATOS = br.Path(os.environ["USERPROFILE"]) / ".claude" / "bambu-a2l.json"
            with self.assertRaises(br.FallaImpresora):
                br._escribir_json(br.DATOS, {"ip": "x"})
        finally:
            br.DATOS = anterior

    def test_escribe_en_la_temporal(self):
        tmp = _base.carpeta_nueva("aisl_br")
        br._escribir_json(tmp / "x.json", {"ip": "1", "_origen": "no va"})
        self.assertEqual(json.loads((tmp / "x.json").read_text(encoding="utf-8")), {"ip": "1"})


class Version(unittest.TestCase):
    def test_version_igual_al_skill(self):
        r, out, _ = _base.correr(br.main, ["bambu_red.py", "--version"])
        self.assertEqual(r, 0)
        self.assertIn(br.VERSION, out)


if __name__ == "__main__":
    unittest.main()
