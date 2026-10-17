"""Tests de bambu_red.py contra la impresora de juguete y lecturas guardadas (T1 a T18 del plan del 16/10/2026).
Ninguno habla con la impresora real ni escribe en el registro o en el archivo de datos reales."""
import json
import os
import re
import socket
import ssl
import subprocess
import sys
import threading
import time
import unittest
from pathlib import Path

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


class T7CambioDeDireccion(ConJuguete):
    """T7: el archivo dice 127.0.0.2 (nadie escucha) y la impresora esta en 127.0.0.1."""

    def setUp(self):
        super().setUp()
        self.datos = _base.escribir_datos(self.tmp, "127.0.0.2")
        self.nube = _base.escribir_datos(self.tmp, "127.0.0.2", donde="nube")
        self.nube_antes = self.nube.read_bytes()

    def test_la_encuentra_y_corrige_solo_la_copia_local(self):
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 0, out)
        self.assertIn("la impresora cambió a 127.0.0.1", out)
        self.assertIn("archivo corregido", out)
        self.assertEqual(json.loads(self.datos.read_text(encoding="utf-8"))["ip"], "127.0.0.1")
        respaldos = list(self.datos.parent.glob("bambu-a2l.json.antes-*"))
        self.assertEqual(len(respaldos), 1)
        self.assertEqual(json.loads(respaldos[0].read_text(encoding="utf-8"))["ip"], "127.0.0.2")
        self.assertEqual(self.nube.read_bytes(), self.nube_antes)          # la de la nube no se toca
        ips = [e for e in registro.leer() if e.get("tipo") == "ip"]
        self.assertEqual((ips[-1]["ip"], ips[-1]["antes"], ips[-1]["serie_ok"]), ("127.0.0.1", "127.0.0.2", True))

    def test_pc_sin_archivo_propio_no_copia_el_codigo(self):
        self.datos.unlink()                                               # PC de Leo o Paulo: solo la nube
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 0, out)
        self.assertFalse(self.datos.exists())                             # no se crea una copia con el codigo
        pista = json.loads((self.tmp / "claude" / "bambu-a2l-ip.json").read_text(encoding="utf-8"))
        self.assertEqual(pista["ip"], "127.0.0.1")
        self.assertNotIn("codigo_acceso", pista)
        self.assertEqual(self.nube.read_bytes(), self.nube_antes)
        self.assertEqual(br.cargar_datos()["ip"], "127.0.0.1")           # la proxima vez arranca por la pista

    def test_por_la_direccion_que_anoto_otra_pc(self):
        os.environ["BAMBU_BUSCAR_EN"] = "127.0.0.3"                       # la lista de prueba no la trae
        try:
            registro.anotar({"tipo": "ip", "ip": "127.0.0.1", "serie_ok": True, "pc": "OTRA-PC"})
            r, out, err = self.correr("--estado")
        finally:
            os.environ["BAMBU_BUSCAR_EN"] = "127.0.0.1"
        self.assertEqual(r, 0, out)
        self.assertIn("las que anotaron las otras PC", out)


class T7bOtraImpresora(ConJuguete):
    """T7b: en la direccion hay OTRA impresora: no la da por encontrada y termina «no la encuentro» con 12."""
    serie_juguete = OTRA_SERIE

    def test_no_la_confunde(self):
        r, out, err = self.correr("--estado")
        self.assertEqual(r, 12, out)
        self.assertIn("En 127.0.0.1 hay otra impresora (serie", out)
        self.assertIn("No encuentro la impresora en la red", out)
        self.assertEqual(json.loads(self.datos.read_text(encoding="utf-8"))["ip"], "127.0.0.1")   # nada corregido
        self.assertEqual(self.jug.recibidos, [])


def lecturas_del_log(ruta, dia="2026-10-15"):
    """El seguimiento.log viejo (solo la hora) como lecturas [(t, informe | None)]."""
    from datetime import datetime
    out = []
    for ren in ruta.read_text(encoding="utf-8").splitlines():
        m = re.match(r"(\d\d:\d\d:\d\d) (\S+) etapa (\S+) capa (\S+)/(\S+) (\S+) % faltan (\S+) min filamento (\S+)", ren)
        if not m:
            continue
        t = datetime.fromisoformat(f"{dia} {m.group(1)}").timestamp()
        if m.group(2) == "None":
            out.append((t, None))
            continue
        num = lambda x: int(x) if x.isdigit() else x
        out.append((t, {"gcode_state": m.group(2), "stg_cur": num(m.group(3)), "layer_num": num(m.group(4)),
                        "total_layer_num": num(m.group(5)), "mc_percent": num(m.group(6)),
                        "mc_remaining_time": num(m.group(7)), "subtask_name": "juegos20",
                        "ams": {"tray_now": m.group(8)}}))
    return out


def mock_a2l():
    return json.loads((_base.FIXTURES / "MOCK-A2L.json").read_text(encoding="utf-8"))["pushall"]["print"]


class ClasificarLecturasGuardadas(unittest.TestCase):
    """T1 a T5 con lecturas guardadas: la misma regla que usa --seguir, sin red."""

    def test_T1_el_log_de_anoche_es_sin_conexion_no_quieta(self):
        lect = lecturas_del_log(_base.FIXTURES / "seguimiento_2026-10-15_noche.log")
        salida, texto = br.clasificar(lect)
        self.assertEqual(salida, 12, texto)
        self.assertIn("desde las 23:30", texto)

    def test_T2_lectura_real_de_una_A2L(self):
        m = mock_a2l()
        self.assertEqual(br.clasificar([(1000.0, m)]), (None, "imprime y avanza"))      # libre, tal cual
        self.assertEqual(br.lugares_del_cargador(m), {1: ("GFG01", "PETG", "#0ACC38")})  # el cargador es la unidad 16
        lect = []
        for i in range(20):                                  # la misma lectura, imprimiendo y avanzando 20 min
            x = dict(m, gcode_state="RUNNING", layer_num=i + 1, mc_percent=5 * i, subtask_name="p")
            lect.append((1000.0 + 60 * i, x))
        self.assertEqual(br.clasificar(lect), (None, "imprime y avanza"))

    def _vuelve(self, estado, mismo=True):
        lect = [(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "layer_num": 30,
                       "mc_percent": 40})]
        lect += [(30.0 * i, None) for i in range(1, 41)]                     # 20 min sin conexion
        lect.append((1230.0, {"gcode_state": estado, "subtask_name": "X" if mismo else "Y",
                              "task_id": "77" if mismo else "88"}))
        return br.clasificar(lect, buscar=True)

    def test_T3_vuelve_en_FINISH(self):
        self.assertEqual(self._vuelve("FINISH")[0], 14)

    def test_T4_vuelve_en_PAUSE(self):
        salida, texto = self._vuelve("PAUSE")
        self.assertEqual(salida, 2)
        self.assertIn("posible corte de luz: mirá la pantalla", texto)

    def test_T5_vuelve_en_IDLE_o_con_otro_trabajo(self):
        for estado, mismo in (("IDLE", True), ("RUNNING", False)):
            salida, texto = self._vuelve(estado, mismo)
            self.assertEqual(salida, 1, (estado, mismo))
            self.assertIn("el trabajo ya no está", texto)

    def test_T5_vuelve_en_el_IDLE_real_sin_nombre_ni_numero(self):
        """Una A2L libre informa el nombre vacio y el numero "0" (MOCK-A2L.json). Antes de la re-auditoria (TB-R2-1)
        la vigilancia esperaba «el informe siguiente» para siempre y no despertaba nunca."""
        lect = [(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "layer_num": 30})]
        lect += [(30.0 * i, None) for i in range(1, 41)]
        lect += [(1230.0 + 30 * i, {"gcode_state": "IDLE", "subtask_name": "", "task_id": "0"}) for i in range(5)]
        salida, texto = br.clasificar(lect, buscar=True)
        self.assertEqual(salida, 1, texto)
        self.assertIn("el trabajo ya no está", texto)

    def test_quieta_solo_con_la_impresora_contestando(self):
        quieta = [(60.0 * i, {"gcode_state": "RUNNING", "layer_num": 5, "mc_percent": 9, "stg_cur": 0})
                  for i in range(17)]
        self.assertEqual(br.clasificar(quieta)[0], 3)

    def test_acceso_rechazado_dos_veces_seguidas(self):
        self.assertIsNone(br.clasificar([(0.0, "acceso")])[0])
        self.assertEqual(br.clasificar([(0.0, "acceso"), (5.0, "acceso")])[0], 13)

    def test_el_reloj_de_quieta_no_viene_de_una_corrida_vieja(self):
        # la corrida anterior dejo el reloj hace 16 min, pero no veia la impresora hace 2 h (PC dormida): no es quieta
        previo = {"ult_avance": 1000.0 - 960, "ult_clave": ["RUNNING", 10, 0, 13], "ult_mensaje": 1000.0 - 7200}
        v = {"gcode_state": "RUNNING", "layer_num": 10, "stg_cur": 0, "mc_percent": 13}
        self.assertIsNone(br.clasificar([(1000.0, v)], previo=previo)[0])
        previo["ult_mensaje"] = 1000.0 - 20
        self.assertEqual(br.clasificar([(1000.0, v)], previo=previo)[0], 3)

    def test_fin_de_rollo(self):
        v = {"gcode_state": "PAUSE", "hms": [{"attr": 0x07000100, "code": 0x00020001}], "ams": {"tray_now": "1"}}
        salida, texto = br.clasificar([(0.0, v)])
        self.assertEqual(salida, 2)
        self.assertIn("0700-0100-0002-0001", texto)
        self.assertIn("lugar 2", texto)
        self.assertIsNone(br.clasificar([(0.0, v)], en_pausa=True)[0])          # --en-pausa: no sale


class _SeguirBase(ConJuguete):
    """Lo comun para correr --seguir de verdad contra la impresora de juguete (sin tests propios)."""

    def setUp(self):
        super().setUp()
        self.carpeta = self.tmp / "seg"
        self.carpeta.mkdir()
        self._sin = br.SIN_MENSAJES_S
        br.SIN_MENSAJES_S = 4

    def tearDown(self):
        br.SIN_MENSAJES_S = self._sin
        super().tearDown()

    def seguir(self, *extra):
        return self.correr("--seguir", str(self.carpeta), "--cada", "1", *extra)

    def enviada(self, nombre, task_id="777", lugar=2, chip="6EACADA000000100", gramos=20.0):
        return registro.anotar({"tipo": "enviada", "trabajo_id": f"20261016-100000-{nombre}", "pieza": nombre,
                                "archivo": f"{nombre}.gcode.3mf", "subtask_name": nombre, "task_id": task_id,
                                "estado": "sin confirmar", "minutos_estimados": 60,
                                "filamentos": [{"lugar": lugar, "rollo": chip, "gramos": gramos}]})

    def previo(self, **campos):
        (self.carpeta / "estado_seguimiento.json").write_text(json.dumps(campos), encoding="utf-8")


class SeguirContraLaJuguete(_SeguirBase):
    """--seguir de verdad, contra la impresora de juguete (T3 con el registro, T12, T13, T15, y lo de 2.3)."""

    def test_T3_vuelve_terminada_y_cierra_ese_trabajo(self):
        e = self.enviada("pieza_t3")
        self.enviada("otra_pieza", task_id="999")                         # otra abierta: no se toca
        ahora = time.time()
        self.previo(trabajo={"subtask_name": "pieza_t3", "task_id": "777"}, desconectado_desde=ahora - 1200,
                    ult_mensaje=ahora - 1200)
        self.jug.estado.update(gcode_state="FINISH", subtask_name="pieza_t3", task_id="777", layer_num=77)
        r, out, err = self.seguir("--buscar")
        self.assertEqual(r, 14, out)
        self.assertIn("no la vi terminar", out)
        cierre = registro.cerrados()[e["trabajo_id"]]
        self.assertEqual(cierre["tipo"], "terminada")
        self.assertIsNone(cierre["minutos_reales"])
        self.assertTrue(cierre.get("fin_visto"))
        self.assertNotIn("20261016-100000-otra_pieza", registro.cerrados())

    def test_T12_el_reloj_de_quieta_sobrevive_a_la_relanzada(self):
        ahora = time.time()
        self.previo(ult_avance=ahora - 16 * 60, ult_clave=["RUNNING", 10, 0, 13], ult_mensaje=ahora - 20,
                    trabajo={"subtask_name": "pieza_prueba", "task_id": "555"})
        r, out, err = self.seguir("--despertar", "1")
        self.assertEqual(r, 3, out)

    def test_T13_rechazo_dos_veces_seguidas(self):
        self.jug.connack = 5
        r, out, err = self.seguir()
        self.assertEqual(r, 13, out)
        self.assertIn("cambió el código de acceso", out)

    def test_T15_dos_vigilancias_sobre_la_misma_carpeta(self):
        otro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            (self.carpeta / "vigilancia.pid").write_text(json.dumps({"pid": otro.pid, "refrescado": time.time()}),
                                                         encoding="utf-8")
            r, out, err = self.seguir()
            self.assertEqual(r, 15, out)
            self.assertIn(f"ya hay una vigilancia (PID {otro.pid}) sobre esta carpeta", out)
        finally:
            otro.kill()
            otro.wait()
        # el de un proceso muerto no cuenta: arranca y, con la impresora terminada, sale con 0
        self.jug.estado.update(gcode_state="FINISH")
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertFalse((self.carpeta / "vigilancia.pid").exists())       # lo suelta al salir

    def test_sin_conexion_la_busca_y_sigue(self):
        _base.escribir_datos(self.tmp, "127.0.0.2")                       # el archivo quedo viejo
        threading.Timer(9, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertIn("la encontré en 127.0.0.1: sigo vigilando", out)

    def test_sin_conexion_y_no_aparece_sale_con_12(self):
        self.jug.parar()
        r, out, err = self.seguir()
        self.assertEqual(r, 12, out)
        self.assertIn("sin conexión con la impresora desde las", out)
        self.assertIn("No encuentro la impresora en la red", out)
        self.assertNotIn("Traceback", out + err)

    def test_log_con_fecha_y_zona_y_estado_guardado(self):
        self.jug.estado.update(gcode_state="FINISH")
        self.seguir()
        primera = (self.carpeta / "seguimiento.log").read_text(encoding="utf-8").splitlines()[0]
        self.assertRegex(primera, r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d FINISH")
        estado = json.loads((self.carpeta / "estado_seguimiento.json").read_text(encoding="utf-8"))
        self.assertIn("ult_mensaje", estado)

    def test_fin_de_rollo_lo_anota_sin_poner_el_rollo_en_cero(self):
        self.enviada("pieza_prueba", task_id="555")
        self.jug.estado.update(gcode_state="PAUSE", hms=[{"attr": 0x07000100, "code": 0x00020001}])
        r, out, err = self.seguir()
        self.assertEqual(r, 2, out)
        ren = [e for e in registro.leer() if e["tipo"] == "rollo terminado"]
        self.assertEqual((len(ren), ren[0]["rollo"], ren[0]["lugar"], ren[0]["confirmado"]),
                         (1, "6EACADA000000100", 2, False))
        self.assertAlmostEqual(registro.gramos_restantes("6EACADA000000100"), 1000.0)   # sin confirmar ni contado

    def test_en_pausa_no_sale_hasta_que_vuelve(self):
        self.jug.estado.update(gcode_state="PAUSE")
        br_pausa = br.EN_PAUSA_CADA
        br.EN_PAUSA_CADA = 2
        try:
            threading.Timer(3, self.jug.poner, kwargs={"gcode_state": "RUNNING"}).start()
            threading.Timer(6, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
            r, out, err = self.seguir("--en-pausa")
        finally:
            br.EN_PAUSA_CADA = br_pausa
        self.assertEqual(r, 0, out)

    def test_cambio_al_rollo_de_respaldo_reparte_los_gramos(self):
        e = self.enviada("pieza_prueba", task_id="555", gramos=40.0)
        respaldo = {"id": "3", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "PLA Lite",
                    "tray_color": "000000FF", "tag_uid": "AAAAAAAA00000100"}
        tray = [dict(t) for t in self.jug.estado["ams"]["ams"][0]["tray"][:3]] + [respaldo]
        self.jug.estado["ams"] = {"tray_now": "1", "ams": [{"id": "16", "tray": tray}]}
        self.jug.estado.update(layer_num=25, total_layer_num=100)
        threading.Timer(3, self.jug.poner, kwargs={"ams": {"tray_now": "3"}}).start()
        threading.Timer(6, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out)
        cambio = [x for x in registro.leer() if x["tipo"] == "cambio de rollo"]
        self.assertEqual((cambio[0]["de_chip"], cambio[0]["a_chip"], cambio[0]["capa"]),
                         ("6EACADA000000100", "AAAAAAAA00000100", 25))
        self.assertAlmostEqual(registro.gramos_restantes("6EACADA000000100"), 990.0)    # 40 g x 25/100
        self.assertAlmostEqual(registro.gramos_restantes("AAAAAAAA00000100"), 970.0)

    def test_lo_que_no_esta_en_el_registro_queda_visto_una_vez(self):
        self.jug.estado.update(gcode_state="FINISH", subtask_name="desde_bambu_studio")
        self.seguir()
        self.seguir()
        vistos = [x for x in registro.leer() if x["tipo"] == "visto"]
        self.assertEqual([x["subtask_name"] for x in vistos], ["desde_bambu_studio"])


class ArreglosDeLaAuditoriaSeguir(_SeguirBase):
    """TB1, TB3 y TB4 de la auditoria del 16/10/2026, contra la impresora de juguete, en las dos direcciones."""

    def _con_guardia(self, *extra):
        # si la vigilancia volviera a girar para siempre, a los 60 s se apaga la juguete: el test termina igual (y falla)
        guardia = threading.Timer(60, self.jug.parar)
        guardia.start()
        try:
            return self.seguir(*extra)
        finally:
            guardia.cancel()

    def test_TB1_impresora_muda_sale_con_12(self):
        self.jug.mudo = True
        r, out, err = self._con_guardia("--despertar", "1")
        self.assertEqual(r, 12, out)
        self.assertIn("acepta la conexión pero no manda informes", out)

    def test_TB1_contesta_el_aviso_de_vida_pero_no_publica(self):
        self.jug.no_publica = True
        ping = br.PING_CADA
        br.PING_CADA = 1
        try:
            r, out, err = self._con_guardia()
        finally:
            br.PING_CADA = ping
        self.assertEqual(r, 12, out)
        self.assertIn("no manda informes", out)

    def test_TB3_reimpresion_en_la_misma_carpeta(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "A", "archivo": "pieza.gcode.3mf", "subtask_name": "pieza",
                         "task_id": "111", "filamentos": []})
        registro.cerrar("A", "terminada", avance_pct=100)
        registro.anotar({"tipo": "enviada", "trabajo_id": "B", "archivo": "pieza.gcode.3mf", "subtask_name": "pieza",
                         "task_id": "222", "filamentos": []})
        registro.confirmar("B", task_id="222")
        self.previo(trabajo={"subtask_name": "pieza", "task_id": "111"}, desconectado_desde=time.time() - 7200,
                    ult_mensaje=time.time() - 7200)
        self.jug.estado.update(gcode_state="RUNNING", subtask_name="pieza", task_id="222")
        threading.Timer(4, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
        r, out, err = self.seguir("--despertar", "5")
        self.assertEqual(r, 0, out)
        self.assertEqual(registro.cerrados()["B"]["tipo"], "terminada")

    def test_TB4_el_candado_de_una_vigilancia_en_pausa_no_vence(self):
        otro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            # refrescado hace 200 s (mas que el minimo de 180) pero su duenio declaro 700 s: sigue valiendo
            (self.carpeta / "vigilancia.pid").write_text(json.dumps(
                {"pid": otro.pid, "refrescado": time.time() - 200, "vence_s": 700}), encoding="utf-8")
            r, out, err = self.seguir()
            self.assertEqual(r, 15, out)
            # pasado lo que declaro, ya no cuenta
            (self.carpeta / "vigilancia.pid").write_text(json.dumps(
                {"pid": otro.pid, "refrescado": time.time() - 800, "vence_s": 700}), encoding="utf-8")
            self.jug.estado.update(gcode_state="FINISH")
            r, out, err = self.seguir()
            self.assertEqual(r, 0, out)
        finally:
            otro.kill()
            otro.wait()

    def test_el_candado_declara_la_espera_de_en_pausa(self):
        self.jug.estado.update(gcode_state="PAUSE")
        visto = []
        refrescar = br.Candado.refrescar

        def espia(cand, vence_s=br.CANDADO_VENCE_S):
            visto.append(vence_s)
            return refrescar(cand, vence_s)
        br.Candado.refrescar = espia
        pausa = br.EN_PAUSA_CADA
        br.EN_PAUSA_CADA = 2
        try:
            threading.Timer(3, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
            r, out, err = self.seguir("--en-pausa")
        finally:
            br.Candado.refrescar, br.EN_PAUSA_CADA = refrescar, pausa
        self.assertEqual(r, 0, out)
        self.assertIn(2 * 2 + 180, visto)                       # en pausa: 2 x la espera de 5 min (aca, 2 s) + margen

    def test_registro_que_no_se_puede_escribir_no_cambia_la_salida(self):
        self.jug.estado.update(gcode_state="FINISH")
        self.enviada("pieza_prueba", task_id="555")
        anotar = registro.anotar

        def falla(_):
            raise PermissionError("OneDrive tiene el archivo tomado")
        registro.anotar = falla
        try:
            r, out, err = self.seguir()
        finally:
            registro.anotar = anotar
        self.assertEqual(r, 0, out)
        self.assertIn("no se pudo escribir en el registro", out)


class RevisionConfirmados(_SeguirBase):
    """Los 3 confirmados de la revision adversarial del 16/10/2026, en las dos direcciones."""

    def test_C1_registro_ilegible_no_tumba_la_relanzada(self):
        (self.reg / "OTRA-PC.jsonl").write_bytes(
            b'{"tipo": "placa_libre", "cuando": "2026-10-16 09:00:00"}\n{"tipo": "visto", "nota": "corta\xe2\x82')
        (self.reg / "TOMADO.jsonl").mkdir()                  # un archivo que no se puede leer como texto
        self.enviada("pieza_prueba", task_id="555")
        self.previo(trabajo={"subtask_name": "pieza_prueba", "task_id": "555"}, ult_mensaje=time.time() - 20)
        self.jug.estado.update(gcode_state="FINISH")
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out + err)
        self.assertEqual(registro.cerrados()["20261016-100000-pieza_prueba"]["tipo"], "terminada")

    def test_C1_un_error_del_programa_en_seguir_no_es_un_1(self):
        anterior = br._seguir

        def roto(*a, **k):
            raise RuntimeError("algo interno")
        br._seguir = roto
        try:
            r, out, err = self.seguir()
        finally:
            br._seguir = anterior
        self.assertEqual(r, br.SALIDA_ERROR_PROGRAMA, out)

    def test_C2_codigo_rechazado_en_una_relanzada_tardia_es_13(self):
        self.jug.connack = 5
        self.previo(ult_mensaje=time.time() - 600, trabajo={"subtask_name": "pieza_prueba", "task_id": "555"})
        r, out, err = self.seguir()
        self.assertEqual(r, 13, out)

    def test_C3_solo_el_aviso_de_vida_no_es_un_informe(self):
        self.jug.calla_despues_del_primero = True
        valores = br.PING_CADA, br.SIN_INFORMES_S, br.QUIETA_S
        br.PING_CADA, br.SIN_INFORMES_S, br.QUIETA_S = 1, 5, 30
        guardia = threading.Timer(60, self.jug.parar)
        guardia.start()
        try:
            r, out, err = self.seguir()
        finally:
            guardia.cancel()
            br.PING_CADA, br.SIN_INFORMES_S, br.QUIETA_S = valores
        self.assertEqual(r, 12, out)                         # antes salia 3 «quieta»: el PINGRESP contaba como informe
        self.assertIn("no manda informes", out)


class ReAuditoriaRonda2(_SeguirBase):
    """Lo que encontro la auditoria Opus de la ronda 2 (TB-R2-1), corrido de verdad contra la juguete."""

    def _vuelve_libre(self, *extra):
        self.enviada("pieza_prueba", task_id="555")
        hace = time.time() - 600
        self.previo(trabajo={"subtask_name": "pieza_prueba", "task_id": "555"}, ult_mensaje=hace,
                    desconectado_desde=hace)
        self.jug.estado.update(gcode_state="IDLE", subtask_name="", task_id="0")
        guardia = threading.Timer(60, self.jug.parar)       # si no sale, la juguete se apaga y el test no se cuelga
        guardia.start()
        try:
            r, out, err = self.seguir(*extra)
        finally:
            guardia.cancel()
        self.assertEqual(r, 1, out)
        self.assertIn("el trabajo ya no está", out)
        self.assertEqual(registro.cerrados()["20261016-100000-pieza_prueba"]["tipo"], "fallida")

    def test_TB_R2_1_vuelve_libre_despues_de_un_corte_y_despierta(self):
        self._vuelve_libre()

    def test_TB_R2_1_tambien_con_buscar(self):
        self._vuelve_libre("--buscar")


class ClasificarVidaEInformes(unittest.TestCase):
    def test_avisos_de_vida_sin_informes_es_sin_conexion(self):
        lect = [(0.0, {"gcode_state": "RUNNING", "layer_num": 5, "mc_percent": 9, "stg_cur": 0})]
        lect += [(30.0 * i, "vida") for i in range(1, 14)]         # 6,5 min solo contestando el aviso de vida
        self.assertEqual(br.clasificar(lect)[0], 12)

    def test_informes_que_no_cambian_siguen_siendo_quieta(self):
        quieta = [(30.0 * i, {"gcode_state": "RUNNING", "layer_num": 5, "mc_percent": 9, "stg_cur": 0}) for i in range(32)]
        self.assertEqual(br.clasificar(quieta)[0], 3)

    def test_al_volver_un_informe_sin_nombre_no_es_otro_trabajo(self):
        lect = [(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "mc_percent": 83, "layer_num": 64})]
        lect += [(30.0 * i, None) for i in range(1, 5)]
        lect.append((150.0, {"gcode_state": "RUNNING", "mc_percent": 84}))     # informe parcial, sin nombre ni numero
        self.assertEqual(br.clasificar(lect, buscar=True), (None, "imprime y avanza"))

    def test_al_volver_en_pausa_del_cargador_dice_el_rollo(self):
        lect = [(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "ams": {"tray_now": "1"}})]
        lect += [(30.0 * i, None) for i in range(1, 5)]
        lect.append((150.0, {"gcode_state": "PAUSE", "subtask_name": "X", "task_id": "77",
                             "hms": [{"attr": 0x07000100, "code": 0x00020001}]}))
        salida, texto = br.clasificar(lect, buscar=True)
        self.assertEqual(salida, 2)
        self.assertIn("cargá un rollo igual en el lugar 2", texto)

    def test_volver_con_otro_trabajo_no_pisa_el_avance_del_viejo(self):
        vig = br.Vigia(0.0)
        vig.mensaje(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "mc_percent": 83, "layer_num": 64})
        vig.falla(30.0, "red")
        vig.mensaje(200.0, {"gcode_state": "RUNNING", "subtask_name": "Y", "task_id": "88", "mc_percent": 4, "layer_num": 3})
        self.assertEqual((vig.trabajo["ult_pct"], vig.trabajo["ult_capa"]), (83, 64))
        self.assertEqual(vig.evaluar(200.0)[0], 1)

    def test_volver_con_otro_trabajo_si_el_viejo_estaba_cerrado_lo_toma(self):
        lect = [(0.0, {"gcode_state": "RUNNING", "subtask_name": "Y", "task_id": "88"})]
        previo = {"trabajo": {"subtask_name": "X", "task_id": "77"}, "desconectado_desde": -100.0, "ult_mensaje": -100.0}
        self.assertEqual(br.clasificar(lect, previo=previo, trabajo_cerrado=True), (None, "imprime y avanza"))
        self.assertEqual(br.clasificar(lect, previo=previo)[0], 1)           # sin cerrar: el trabajo ya no está

    def test_en_pausa_la_misma_alarma_no_se_avisa_dos_veces_y_una_nueva_si(self):
        hms = [{"attr": 0x0C000300, "code": 0x00010004}]
        vig = br.Vigia(0.0)
        vig.mensaje(0.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "hms": hms})
        self.assertEqual(vig.evaluar(0.0)[0], 2)
        previo = vig.estado()                                               # lo que guarda la vigilancia al salir
        sigue = [(10.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "hms": hms})]
        self.assertEqual(br.clasificar(sigue, previo=previo, en_pausa=True)[0], None)
        self.assertEqual(br.clasificar(sigue, previo=previo)[0], 2)          # sin --en-pausa avisa
        otra = [(10.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77",
                        "hms": [{"attr": 0x07000100, "code": 0x00020001}]})]
        self.assertEqual(br.clasificar(otra, previo=previo, en_pausa=True)[0], 2)

    def test_la_alarma_de_una_pausa_del_cargador_tampoco_se_repite(self):
        """Re-auditoria R3: la pausa avisaba, y al reanudar con el mismo hms prendido volvia a salir 2."""
        hms = [{"attr": 0x07000100, "code": 0x00020001}]
        vig = br.Vigia(0.0)
        vig.mensaje(0.0, {"gcode_state": "PAUSE", "subtask_name": "X", "task_id": "77", "hms": hms,
                          "ams": {"tray_now": "1"}})
        self.assertEqual(vig.evaluar(0.0)[0], 2)
        sigue = [(10.0, {"gcode_state": "RUNNING", "subtask_name": "X", "task_id": "77", "hms": hms})]
        self.assertEqual(br.clasificar(sigue, previo=vig.estado(), en_pausa=True)[0], None)


class ConciliarAlConectar(ConJuguete):

    def test_TB2_el_fin_de_la_vieja_no_cierra_la_reimpresion(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "A", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "111", "filamentos": []})
        registro.cerrar("A", "terminada", avance_pct=100)
        registro.anotar({"tipo": "enviada", "trabajo_id": "B", "archivo": "p.gcode.3mf", "subtask_name": "p",
                         "task_id": "222", "estado": "sin confirmar", "filamentos": []})
        self.jug.estado.update(gcode_state="FINISH", subtask_name="p", task_id="111")
        self.correr("--estado")
        self.assertNotIn("B", registro.cerrados())
    """Cualquier comando que se conecta cierra el trabajo que termino sin que nadie lo viera (una sola vez)."""

    def test_estado_cierra_lo_que_termino(self):
        e = registro.anotar({"tipo": "enviada", "trabajo_id": "t-conc", "archivo": "pieza_c.gcode.3mf",
                             "filamentos": []})
        self.jug.estado.update(gcode_state="FINISH", subtask_name="pieza_c", task_id="0")
        self.correr("--estado")
        self.correr("--estado")
        cierres = [x for x in registro.leer() if x.get("trabajo_id") == "t-conc" and x["tipo"] in registro.CIERRES]
        self.assertEqual(len(cierres), 1)
        self.assertIsNone(cierres[0]["minutos_reales"])
        self.assertIn("hora real de fin desconocida", cierres[0]["nota"])

    def test_no_concilia_si_hay_una_vigilancia_viva(self):
        otro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            br._escribir_json(br.DATOS.with_name("bambu-a2l-vigilancia.json"),
                              {"pid": otro.pid, "refrescado": time.time()})
            registro.anotar({"tipo": "enviada", "trabajo_id": "t-viva", "archivo": "pieza_v.gcode.3mf",
                             "filamentos": []})
            self.jug.estado.update(gcode_state="FINISH", subtask_name="pieza_v")
            self.correr("--estado")
        finally:
            otro.kill()
            otro.wait()
        self.assertNotIn("t-viva", registro.cerrados())


NEGRO, AMARILLO = "6EACADA000000100", "1C6E4ADF00000100"


class _ImprimirBase(ConJuguete):
    """--imprimir: los frenos antes de mandar (T8, T8b, T8c, T10, T11, T17, T18). La subida por FTPS se reemplaza:
    la impresora de juguete no la simula; todo lo demas (estado, orden, respuesta) va por la red de prueba."""

    def setUp(self):
        super().setUp()
        self.jug.estado.update(gcode_state="IDLE", subtask_name="", task_id="0")
        self.subidas = []
        self._subir, self._ahora = br.subir, br._ahora
        br.subir = lambda d, archivo, nombre: self.subidas.append(nombre) or Path(archivo).stat().st_size
        self.a_las(10, 0)
        self.pieza = self.tmp / "pieza"
        self.pieza.mkdir()

    def tearDown(self):
        br.subir, br._ahora = self._subir, self._ahora
        super().tearDown()

    def a_las(self, h, m):
        from datetime import datetime
        br._ahora = lambda: datetime(2026, 10, 16, h, m).astimezone()

    def quedan(self, chip, gramos):
        registro.anotar({"tipo": "pesado", "rollo": chip, "gramos": float(gramos), "bruto": gramos + 250.0,
                         "tara": 250.0, "tara_medida": False})

    def respaldo_en_4(self, chip="AAAAAAAA00000100"):
        tray = [dict(t) for t in self.jug.estado["ams"]["ams"][0]["tray"][:3]]
        tray.append({"id": "3", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "PLA Lite",
                     "tray_color": "000000FF", "tag_uid": chip})
        self.jug.estado["ams"] = {"tray_now": "255", "ams": [{"id": "16", "tray": tray}]}

    def archivo(self, nombre="pieza", **kw):
        return _base.gcode_3mf(self.pieza / f"{nombre}.gcode.3mf", **kw)


class Imprimir(_ImprimirBase):
    def test_T8_no_alcanza_el_rollo(self):
        self.quedan(NEGRO, 19)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(78.0,))))
        self.assertEqual(r, 1, out)
        self.assertIn("NO SE MANDA: no alcanza el negro (pide 78 g, quedan ~19 g, margen 30 g)", out)
        self.assertEqual(self.subidas, [])

    def test_T8b_alcanza(self):
        self.quedan(NEGRO, 200)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(78.0,))))
        self.assertEqual(r, 0, out)
        self.assertNotIn("no alcanza", out)
        self.assertIn("termina a las 11:01", out)                      # 60 min x 1,02 desde las 10:00

    def test_T8c_de_noche_sin_respaldo_frena_y_con_respaldo_pasa(self):
        self.a_las(19, 0)
        self.quedan(NEGRO, 80)
        archivo = self.archivo(minutos=240, gramos=(10.0,))
        r, out, _ = self.correr("--imprimir", str(archivo))
        self.assertEqual(r, 1, out)
        self.assertIn("de noche con menos de 100 g y sin rollo de respaldo igual", out)
        self.respaldo_en_4()
        r, out, _ = self.correr("--imprimir", str(archivo))
        self.assertEqual(r, 0, out)

    def test_sin_margen_lo_saltea(self):
        self.quedan(NEGRO, 19)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(78.0,))), "--sin-margen")
        self.assertEqual(r, 0, out)
        self.assertIn("--sin-margen", out)

    def test_T18_elige_el_rollo_mas_gastado(self):
        self.respaldo_en_4()
        self.quedan(NEGRO, 47)
        self.quedan("AAAAAAAA00000100", 980)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(3.0,))))
        self.assertEqual(r, 0, out)
        self.assertIn("elijo el 2, el mas gastado", out)
        self.assertIn("-> lugar 2", out)

    def test_T18_ninguno_alcanza_solo_pero_la_suma_si(self):
        self.respaldo_en_4()
        self.quedan(NEGRO, 47)
        self.quedan("AAAAAAAA00000100", 980)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(78.0,))))
        self.assertEqual(r, 0, out)
        self.assertIn("-> lugar 2", out)
        self.assertIn("AMS Filament Backup", out)

    def test_T10_pieza_larga_sin_el_ok_frena_antes_de_subir(self):
        archivo = self.archivo(minutos=240, gramos=(10.0,))
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn(f"falta el OK de Fak en {archivo}.ok (pieza de más de 3 h)", out)
        self.assertEqual(self.subidas, [])
        ok = archivo.with_name(archivo.name + ".ok")
        ok.write_text('16/10/2026 09:41 Fak: "dale, mandala"', encoding="utf-8")
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 0, out)
        self.assertEqual(len(self.subidas), 1)

    def test_el_ok_viejo_no_sirve_si_se_relamino(self):
        archivo = self.archivo(minutos=240, gramos=(10.0,))
        ok = archivo.with_name(archivo.name + ".ok")
        ok.write_text("Fak: dale", encoding="utf-8")
        os.utime(ok, (time.time() - 3600, time.time() - 3600))
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("es anterior al laminado", out)

    def test_T11_placa_ocupada_hasta_placa_libre(self):
        self.jug.estado.update(gcode_state="FINISH", subtask_name="lo_anterior")
        archivo = self.archivo(gramos=(5.0,))
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("placa ocupada: confirmá que la sacaste con registro.py --placa-libre", out)
        self.assertEqual(self.subidas, [])
        time.sleep(1.1)
        _base.correr(registro._main, ["registro.py", "--placa-libre", "saque las piezas"])
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 0, out)

    def test_ocupada_no_se_manda(self):
        self.jug.estado.update(gcode_state="RUNNING", subtask_name="de_otro")
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("la impresora esta ocupada (RUNNING)", out)

    def test_T17_enviada_antes_de_la_orden_y_confirmada_despues(self):
        visto_al_recibir = []

        def al_recibir(orden):
            if (orden.get("print") or {}).get("command") == "project_file":
                visto_al_recibir.extend(e for e in registro.leer() if e["tipo"] == "enviada")
        self.jug.al_recibir = al_recibir
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 0, out)
        self.assertEqual(len(visto_al_recibir), 1)
        env = visto_al_recibir[0]
        self.assertEqual((env["estado"], env["subtask_name"]), ("sin confirmar", "pieza"))
        conf = [e for e in registro.leer() if e["tipo"] == "confirmada"]
        self.assertEqual(len(conf), 1)
        self.assertEqual((conf[0]["trabajo_id"], conf[0]["task_id"], conf[0]["subtask_name"]),
                         (env["trabajo_id"], env["task_id"], "pieza"))
        self.assertIn("ARRANCÓ", out)

    def test_otra_pc_mando_mientras_subia(self):
        def subir_y_otro(d, archivo, nombre):
            self.jug.estado.update(gcode_state="RUNNING", subtask_name="de_otra_pc")
            return Path(archivo).stat().st_size
        br.subir = subir_y_otro
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("mientras se subia el archivo la impresora paso a RUNNING", out)
        self.assertFalse(any((o.get("print") or {}).get("command") == "project_file" for o in self.jug.recibidos))
        self.assertFalse([e for e in registro.leer() if e["tipo"] == "enviada"])

    def test_trampa_de_la_etapa_77(self):
        self.jug.al_imprimir = ("PREPARE",)
        self.jug.estado.update(stg_cur=77, mc_print_line_number="0")
        esperas = br.ORDEN_ESPERA_S, br.TRAMPA_ESPERA_S
        br.ORDEN_ESPERA_S, br.TRAMPA_ESPERA_S = 12, 2
        try:
            r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        finally:
            br.ORDEN_ESPERA_S, br.TRAMPA_ESPERA_S = esperas
        self.assertEqual(r, 1, out)
        self.assertIn("trampa de la unidad 16", out)

    def test_la_ficha_se_arma_al_mandar_y_se_completa_al_cancelar(self):
        archivo = self.archivo(gramos=(5.0,))
        r, out, _ = self.correr("--imprimir", str(archivo), "--apply")
        self.assertEqual(r, 0, out)
        f = json.loads((self.pieza / "ficha.json").read_text(encoding="utf-8"))
        self.assertEqual((f["pieza"], f["archivo_vigente"], f["ajustes"]["paredes"]), ("pieza", archivo.name, "2"))
        self.assertIsNone(f["envios"][0]["resultado"])
        r, out, _ = self.correr("--cancelar")
        self.assertEqual(r, 0, out)
        f = json.loads((self.pieza / "ficha.json").read_text(encoding="utf-8"))
        self.assertEqual(f["envios"][0]["resultado"], "cancelada")
        r, out, _ = self.correr("--ficha", str(self.pieza))
        self.assertEqual(r, 0, out)
        self.assertIn("cancelada", out)

    def respaldo_sin_chip_en_4(self):
        """Como la impresora real el 16/10: un PLA Lite negro cargado a mano en el lugar 4, sin chip ni marca."""
        tray = [dict(t) for t in self.jug.estado["ams"]["ams"][0]["tray"][:3]]
        tray.append({"id": "3", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "",
                     "tray_color": "000000FF", "tag_uid": "0000000000000000"})
        self.jug.estado["ams"] = {"tray_now": "255", "ams": [{"id": "16", "tray": tray}]}

    def test_rollo_sin_chip_cuenta_como_respaldo_de_noche(self):
        self.a_las(19, 0)
        self.quedan(NEGRO, 80)
        archivo = self.archivo(minutos=240, gramos=(10.0,))
        self.respaldo_sin_chip_en_4()
        r, out, _ = self.correr("--imprimir", str(archivo))
        self.assertEqual(r, 0, out)
        self.assertIn("-> lugar 2", out)                       # el negro con chip (el mas gastado) va primero

    def test_rollo_sin_chip_se_anota_por_su_lugar(self):
        self.respaldo_sin_chip_en_4()
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--mapa", "3", "--apply")
        self.assertEqual(r, 0, out)
        self.assertIn("no tiene chip: la cuenta va por el lugar", out)
        env = [e for e in registro.leer() if e["tipo"] == "enviada"][0]
        self.assertEqual(env["filamentos"][0]["rollo"], "SIN-CHIP-L4")

    def test_el_del_lugar_4_es_nuevo(self):
        """Fak, 16/10: «te aclaro que es nuevo y listo». Lo gastado antes en ese lugar no cuenta para el rollo nuevo,
        y una vez anotado no se vuelve a pedir."""
        self.respaldo_sin_chip_en_4()
        registro.anotar({"tipo": "enviada", "trabajo_id": "viejo", "archivo": "viejo.gcode.3mf",
                         "filamentos": [{"rollo": "SIN-CHIP-L4", "gramos": 900.0}]})
        registro.anotar({"tipo": "confirmada", "trabajo_id": "viejo"})
        registro.cerrar("viejo", "terminada", avance_pct=100)
        archivo = self.archivo(gramos=(250.0,))
        r, out, _ = self.correr("--imprimir", str(archivo), "--mapa", "3")
        self.assertIn("no alcanza solo (pide 250 g, quedan ~100 g)", out)  # lo gastado antes en el lugar 4
        self.assertIn("si es nuevo, registro.py --rollo-nuevo 4", out)
        r, out, _ = self.correr("--estado")                                 # la sesion relee antes de anotarlo
        r, out, _ = _base.correr(registro._main, ["registro.py", "--rollo-nuevo", "4", "el del lugar 4 es nuevo"])
        self.assertIn("rollo nuevo SIN-CHIP-L4 con 1000 g", out)
        r, out, _ = self.correr("--imprimir", str(archivo), "--mapa", "3")
        self.assertEqual(r, 0, out)
        self.assertNotIn("--rollo-nuevo", out)
        self.assertNotIn("no alcanza solo", out)
        self.assertAlmostEqual(registro.gramos_restantes("SIN-CHIP-L4"), 1000.0)

    def test_varias_placas_no_se_manda(self):
        r, out, _ = self.correr("--imprimir", str(self.archivo(placas=2)))
        self.assertEqual(r, 1, out)
        self.assertIn("trae 2 placas", out)


class RevisionImprimir(_ImprimirBase):
    """Lo real de la lista «sin verificar» de la revision del 16/10 en --imprimir, en las dos direcciones."""

    def test_1122_sin_estado_no_se_manda_a_ciegas(self):
        self.jug.mudo = True
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--mapa", "1", "--apply")
        self.assertEqual(r, 12, out)
        self.assertIn("no se manda nada a ciegas", out)
        self.assertEqual(self.subidas, [])

    def test_1210_sin_estado_justo_antes_de_la_orden_no_sale(self):
        def subir_y_mudo(d, archivo, nombre):
            self.jug.mudo = True
            return Path(archivo).stat().st_size
        br.subir = subir_y_mudo
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 12, out)
        self.assertFalse(any((o.get("print") or {}).get("command") == "project_file" for o in self.jug.recibidos))

    def test_1225_el_rollo_se_anota_del_estado_que_valido_el_freno(self):
        def subir_y_sin_ams(d, archivo, nombre):
            self.jug.estado.pop("ams")
            return Path(archivo).stat().st_size
        br.subir = subir_y_sin_ams
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 0, out)
        env = [e for e in registro.leer() if e["tipo"] == "enviada"][0]
        self.assertEqual(env["filamentos"][0]["rollo"], NEGRO)

    def test_mapa_a_un_lugar_vacio_frena(self):
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--mapa", "3")
        self.assertEqual(r, 1, out)
        self.assertIn("el lugar 4 no tiene ningún rollo", out)
        # --sin-margen saltea la cuenta de gramos, no el lugar vacio (re-auditoria R5)
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--mapa", "3", "--sin-margen", "--apply")
        self.assertEqual(r, 1, out)
        self.assertEqual(self.subidas, [])

    def test_sin_cabecera_de_tiempo_usa_la_prediccion_y_si_no_hay_pide_el_ok(self):
        archivo = self.archivo(minutos=240, gramos=(5.0,))
        import zipfile
        sin_tiempo = self.pieza / "sin_tiempo.gcode.3mf"
        with zipfile.ZipFile(archivo) as zi, zipfile.ZipFile(sin_tiempo, "w") as zo:
            for n in zi.namelist():
                datos = zi.read(n)
                if n.endswith("plate_1.gcode"):
                    datos = datos.replace(b"total estimated time", b"tiempo borrado")
                zo.writestr(n, datos)
        self.assertEqual(br.ajustes_del_archivo(sin_tiempo)["minutos"], 240)      # de slice_info (prediction)
        self.assertIn("pieza de más de 3 h", br.falta_ok_de_fak(sin_tiempo, 240, br._ahora()))
        self.assertIn("no dice cuánto tarda", br.falta_ok_de_fak(sin_tiempo, None, br._ahora()))

    def test_de_noche_tambien_de_madrugada(self):
        from datetime import datetime, timedelta
        dia = datetime(2026, 10, 16, 0, 0).astimezone()
        self.assertTrue(br._de_noche(dia.replace(hour=1), dia.replace(hour=3)))          # de madrugada
        self.assertTrue(br._de_noche(dia.replace(hour=20), dia.replace(hour=21)))
        self.assertTrue(br._de_noche(dia.replace(hour=19), dia.replace(hour=19) + timedelta(hours=14)))  # al dia siguiente
        self.assertFalse(br._de_noche(dia.replace(hour=10), dia.replace(hour=11)))
        self.assertFalse(br._de_noche(dia.replace(hour=8, minute=20), dia.replace(hour=20, minute=40)))

    def test_idle_con_un_trabajo_abierto_es_placa_ocupada(self):
        self.jug.estado.update(gcode_state="IDLE")
        registro.anotar({"tipo": "enviada", "trabajo_id": "perdido", "archivo": "perdido.gcode.3mf",
                         "pieza": "perdido", "minutos_estimados": 60, "filamentos": []})
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("placa posiblemente ocupada", out)
        time.sleep(1.1)
        _base.correr(registro._main, ["registro.py", "--placa-libre", "saque lo que quedo"])
        r, out, _ = self.correr("--imprimir", str(self.archivo(gramos=(5.0,))), "--apply")
        self.assertEqual(r, 0, out)

    def test_idle_sin_nada_abierto_pasa(self):
        self.jug.estado.update(gcode_state="IDLE")
        self.assertIsNone(br.placa_ocupada({"gcode_state": "IDLE"}))


class RevisionPlacaYRegistro(unittest.TestCase):
    """placa_ocupada y el registro: un placa libre de durante la impresion no libera la placa; una reimpresion desde la
    pantalla queda «visto»; una cancelacion en 0 % con capas impresas cuenta sus gramos."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("rev_placa")
        self.reg = _base.apuntar(self.tmp)

    def _renglones(self, *rs):
        with open(self.reg / "PC-A.jsonl", "a", encoding="utf-8") as f:
            for r in rs:
                f.write(json.dumps(r) + "\n")

    def test_placa_libre_mientras_imprimia_no_libera(self):
        self._renglones({"tipo": "enviada", "trabajo_id": "x1", "archivo": "x1.gcode.3mf", "minutos_estimados": 120,
                         "cuando": "2026-10-16T10:00:00-03:00"},
                        {"tipo": "placa_libre", "cuando": "2026-10-16T10:30:00-03:00"},
                        {"tipo": "terminada", "trabajo_id": "x1", "minutos_reales": None,
                         "fin_visto": "2026-10-16T12:40:00-03:00", "cuando": "2026-10-16T12:40:00-03:00"})
        self.assertIsNotNone(br.placa_ocupada({"gcode_state": "FINISH"}))
        self._renglones({"tipo": "placa_libre", "cuando": "2026-10-16T12:50:00-03:00"})
        self.assertIsNone(br.placa_ocupada({"gcode_state": "FINISH"}))

    def test_la_que_fallo_cuenta_desde_el_envio(self):
        """Re-auditoria R2: el 85 % del estimado es para lo que termino; una que fallo pudo cortar en cualquier momento."""
        self._renglones({"tipo": "enviada", "trabajo_id": "b1", "archivo": "b1.gcode.3mf", "minutos_estimados": 240,
                         "cuando": "2026-10-16T10:00:00-03:00"},
                        {"tipo": "placa_libre", "cuando": "2026-10-16T10:40:00-03:00"})
        self.assertIsNone(br.placa_ocupada({"gcode_state": "FAILED"}))            # todavia abierta
        self.assertIsNotNone(br.placa_ocupada({"gcode_state": "FINISH"}))         # si hubiera terminado: no pudo a las 10:40
        self._renglones({"tipo": "fallida", "trabajo_id": "b1", "avance_pct": 8, "capa": 6, "minutos_reales": None,
                         "fin_visto": "2026-10-16T10:50:00-03:00", "cuando": "2026-10-16T10:50:00-03:00"})
        self.assertIsNone(br.placa_ocupada({"gcode_state": "FAILED"}))            # conciliada como fallida

    def test_finish_de_un_trabajo_todavia_abierto_ocupa_la_placa(self):
        self._renglones({"tipo": "placa_libre", "cuando": "2026-10-16T09:00:00-03:00"},
                        {"tipo": "enviada", "trabajo_id": "p1", "archivo": "p1.gcode.3mf", "task_id": "4242",
                         "cuando": "2026-10-16T11:00:00-03:00"})
        self.assertIsNotNone(br.placa_ocupada({"gcode_state": "FINISH"}))

    def test_reimpresion_desde_la_pantalla_queda_vista(self):
        self._renglones({"tipo": "enviada", "trabajo_id": "pv", "archivo": "placa_v2.gcode.3mf",
                         "cuando": "2026-10-16 12:49:42"},
                        {"tipo": "terminada", "trabajo_id": "pv", "minutos_reales": 40.2, "cuando": "2026-10-16 13:29:54"})
        # el FINISH del mismo envio viejo (sin numero) que sigue en la pantalla no es una reimpresion (re-auditoria R1:
        # la A2L informa el numero que se le mando, 1164396105 para placa_v2, y el renglon viejo no lo tiene)
        self.assertIsNone(br.anotar_visto({"gcode_state": "FINISH", "subtask_name": "placa_v2", "task_id": "1164396105"}))
        v = {"gcode_state": "RUNNING", "subtask_name": "placa_v2", "task_id": "1999999999"}
        self.assertEqual(br.anotar_visto(v)["tipo"], "visto")                  # imprimiendo despues del cierre: si
        self.assertIsNone(br.anotar_visto(v))                                   # una sola vez
        # al reves: si el trabajo anotado tiene ESE numero, no es una reimpresion
        self._renglones({"tipo": "enviada", "trabajo_id": "q", "archivo": "q.gcode.3mf", "task_id": "77",
                         "cuando": "2026-10-16 14:00:00"})
        self.assertIsNone(br.anotar_visto({"gcode_state": "RUNNING", "subtask_name": "q", "task_id": "77"}))

    def test_cancelada_en_cero_por_ciento_con_capas_cuenta_sus_gramos(self):
        self._renglones({"tipo": "enviada", "trabajo_id": "c", "archivo": "c.gcode.3mf", "cuando": "2026-10-16 11:00:00",
                         "filamentos": [{"rollo": "R", "gramos": 300.0}]},
                        {"tipo": "cancelada", "trabajo_id": "c", "avance_pct": 0, "capa": 30, "capas": 300,
                         "cuando": "2026-10-16 11:20:00"})
        self.assertAlmostEqual(registro.gramos_restantes("R"), 970.0)

    def test_ips_anotadas_solo_las_bien_escritas_y_las_5_mas_nuevas(self):
        for i in range(8):
            registro.anotar_ip(f"192.168.1.{100 + i}")
        registro.anotar({"tipo": "ip", "ip": 12345, "serie_ok": True})
        ips = registro.ips_anotadas()
        self.assertEqual(ips, [f"192.168.1.{100 + i}" for i in (7, 6, 5, 4, 3)])


class RevisionDatosYRed(unittest.TestCase):
    def setUp(self):
        self.tmp = _base.carpeta_nueva("rev_datos")
        _base.apuntar(self.tmp)

    def test_archivo_local_roto_usa_la_copia_de_la_nube(self):
        (self.tmp / "claude" / "bambu-a2l.json").write_text("{", encoding="utf-8")
        _base.escribir_datos(self.tmp, "127.0.0.1", donde="nube")
        r, out, _ = _base.correr(br.cargar_datos)
        self.assertEqual(r["serie"], SERIE)
        self.assertIn("uso la otra copia", out)

    def test_serie_en_minuscula_se_normaliza(self):
        _base.escribir_datos(self.tmp, "127.0.0.1", serie=" " + SERIE.lower())
        self.assertEqual(br.cargar_datos()["serie"], SERIE)

    def test_escritura_entera_o_nada(self):
        br._escribir_json(self.tmp / "x.json", {"a": 1})
        self.assertEqual(json.loads((self.tmp / "x.json").read_text(encoding="utf-8")), {"a": 1})
        self.assertFalse(list(self.tmp.glob("*.escribiendo")))
        # una escritura que se corta a la mitad (aca, un valor que no se puede escribir despues de "a") no toca el
        # archivo que estaba: con la escritura directa quedaba cortado (re-auditoria R7)
        with self.assertRaises(TypeError):
            br._escribir_json(self.tmp / "x.json", {"a": 2, "b": object()})
        self.assertEqual(json.loads((self.tmp / "x.json").read_text(encoding="utf-8")), {"a": 1})

    def test_la_direccion_que_confirma_el_anuncio_se_reintenta(self):
        intentos = []
        tls_real = br.tls

        def tls_que_falla_una_vez(ip, puerto=None, timeout=8, serie=None):
            intentos.append(ip)
            if len(intentos) == 1:
                raise br.SinConexion("no contesta (un corte de 3 s)")
            return type("T", (), {"close": lambda self: None})()
        anteriores = (br.tls, br._ips_por_anuncio, br._ips_por_mac, br._ips_de_la_red, br._pc_sin_red,
                      os.environ.pop("BAMBU_BUSCAR_EN"))
        br.tls, br._ips_por_anuncio = tls_que_falla_una_vez, lambda serie, segundos=None: ["10.9.9.9"]
        br._ips_por_mac, br._ips_de_la_red, br._pc_sin_red = (lambda mac: []), (lambda probadas: []), (lambda: False)
        try:
            d = {"ip": "10.9.9.9", "serie": SERIE, "_origen": "prueba"}
            self.assertEqual(br.ubicar(d, guardar=False), "10.9.9.9")
        finally:
            br.tls, br._ips_por_anuncio, br._ips_por_mac, br._ips_de_la_red, br._pc_sin_red = anteriores[:5]
            os.environ["BAMBU_BUSCAR_EN"] = anteriores[5]
        self.assertEqual(intentos, ["10.9.9.9", "10.9.9.9"])


class RevisionPreparar(ConJuguete):
    serie_juguete = "router"                       # un equipo cuyo certificado no trae una serie de Bambu

    def test_preparar_sin_serie_no_escribe(self):
        (self.tmp / "claude" / "bambu-a2l.json").unlink()
        r, out, _ = self.correr("--preparar", "127.0.0.1")
        self.assertEqual(r, 12, out)
        self.assertIn("no trae un número de serie", out)
        self.assertFalse((self.tmp / "claude" / "bambu-a2l.json").exists())


class RevisionSeguirArranque(_SeguirBase):
    """--seguir lanzado en el mismo mensaje que el envio, con la impresora todavia en el FINISH de la pieza anterior."""

    def _anterior_cerrada(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "vieja", "archivo": "vieja.gcode.3mf", "subtask_name": "vieja",
                         "task_id": "1", "filamentos": []})
        registro.cerrar("vieja", "terminada", avance_pct=100)
        self.jug.estado.update(gcode_state="FINISH", subtask_name="vieja", task_id="1")
        self._nueva_abierta()

    def _nueva_abierta(self):
        """--imprimir anota el envio ANTES de la orden: la pieza nueva esta abierta y todavia no arranco."""
        registro.anotar({"tipo": "enviada", "trabajo_id": "nueva", "archivo": "nueva.gcode.3mf", "subtask_name": "nueva",
                         "task_id": "2", "estado": "sin confirmar", "filamentos": []})

    def test_espera_que_arranque_la_nueva(self):
        self._anterior_cerrada()
        threading.Timer(3, self.jug.poner, kwargs={"gcode_state": "RUNNING", "subtask_name": "nueva",
                                                   "task_id": "2"}).start()
        threading.Timer(6, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertIn("espero que arranque la impresión nueva", out)

    def test_si_no_arranca_ninguna_sale_con_1(self):
        self._anterior_cerrada()
        espera = br.ESPERA_ARRANQUE_S
        br.ESPERA_ARRANQUE_S = 3
        try:
            r, out, err = self.seguir()
        finally:
            br.ESPERA_ARRANQUE_S = espera
        self.assertEqual(r, 1, out)
        self.assertIn("no arrancó ninguna impresión nueva", out)

    def test_la_anterior_mandada_desde_la_pantalla_tambien_espera(self):
        """Re-auditoria R4.1: la pieza anterior no es de la skill (no esta en el registro): igual no es «terminó»."""
        self.jug.estado.update(gcode_state="FINISH", subtask_name="de_bambu_studio", task_id="9")
        self._nueva_abierta()
        espera = br.ESPERA_ARRANQUE_S
        br.ESPERA_ARRANQUE_S = 3
        try:
            r, out, err = self.seguir()
        finally:
            br.ESPERA_ARRANQUE_S = espera
        self.assertEqual(r, 1, out)
        self.assertIn("no arrancó ninguna impresión nueva", out)

    def test_la_espera_no_vuelve_a_cero_en_cada_relanzada(self):
        """Re-auditoria R4.2: con --despertar cada relanzada empezaba la espera de nuevo y nunca salia el 1."""
        self._anterior_cerrada()
        self.previo(esperando_desde=time.time() - br.ESPERA_ARRANQUE_S - 60)
        r, out, err = self.seguir("--despertar", "5")
        self.assertEqual(r, 1, out)
        self.assertIn("no arrancó ninguna impresión nueva", out)

    def test_rollo_nuevo_en_el_mismo_lugar_reparte_los_gramos(self):
        self.enviada("pieza_prueba", task_id="555", gramos=40.0)
        self.jug.estado.update(layer_num=25, total_layer_num=100)
        tray = [dict(t) for t in self.jug.estado["ams"]["ams"][0]["tray"]]
        tray[1] = dict(tray[1], tag_uid="BBBBBBBB00000100")
        threading.Timer(3, self.jug.poner, kwargs={"ams": {"tray_now": "1", "ams": [{"id": "16", "tray": tray}]}}).start()
        threading.Timer(6, self.jug.poner, kwargs={"gcode_state": "FINISH"}).start()
        r, out, err = self.seguir()
        self.assertEqual(r, 0, out)
        cambio = [x for x in registro.leer() if x["tipo"] == "cambio de rollo"]
        self.assertEqual((cambio[0]["de_chip"], cambio[0]["a_chip"]), (NEGRO, "BBBBBBBB00000100"))


class T9Cancelar(ConJuguete):
    def test_cierra_el_trabajo_que_informa_la_impresora(self):
        reg = registro.CARPETA
        with open(reg / "PC-A.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"tipo": "enviada", "trabajo_id": "20261016-090000-pieza_a", "archivo": "pieza_a.gcode.3mf",
                                "cuando": "2026-10-16 09:00:00", "pc": "PC-A", "filamentos": []}) + "\n")
        with open(reg / "PC-B.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"tipo": "enviada", "trabajo_id": "20261016-095000-pieza_b", "archivo": "pieza_b.gcode.3mf",
                                "cuando": "2026-10-16 09:50:00", "pc": "PC-B", "filamentos": []}) + "\n")
        self.jug.estado.update(gcode_state="RUNNING", subtask_name="pieza_a", task_id="0", layer_num=12, mc_percent=31)
        r, out, _ = self.correr("--cancelar")
        self.assertEqual(r, 0, out)
        cerr = registro.cerrados()
        self.assertEqual(cerr["20261016-090000-pieza_a"]["tipo"], "cancelada")
        self.assertEqual((cerr["20261016-090000-pieza_a"]["avance_pct"], cerr["20261016-090000-pieza_a"]["capa"]), (31, 12))
        self.assertNotIn("20261016-095000-pieza_b", cerr)          # la ultima abierta (de otra PC) no se toca

    def test_trabajo_ajeno_no_se_cierra(self):
        registro.anotar({"tipo": "enviada", "trabajo_id": "mio", "archivo": "mio.gcode.3mf", "filamentos": []})
        self.jug.estado.update(gcode_state="RUNNING", subtask_name="desde_bambu_studio")
        r, out, _ = self.correr("--cancelar")
        self.assertEqual(r, 0, out)
        self.assertNotIn("mio", registro.cerrados())
        self.assertTrue([e for e in registro.leer() if e["tipo"] == "visto"])


class Selftest(ConJuguete):
    def test_no_muestra_el_codigo(self):
        r, out, err = self.correr("--selftest")
        self.assertIn(r, (0, 1))
        self.assertIn("archivo de datos de la impresora", out)
        self.assertNotIn(CODIGO, out + err)
        self.assertIn("registro compartido (nube de Ingenieria) escribible", out)


class LecturasDeLaRed(unittest.TestCase):
    """Lo que ubicar() lee de Windows y del anuncio, con textos guardados (sin red)."""
    IPCONFIG = ("Configuración IP de Windows\r\n\r\n"
                "Adaptador de LAN inalámbrica Wi-Fi:\r\n\r\n"
                "   Sufijo DNS específico para la conexión. . : \r\n"
                "   Vínculo: dirección IPv6 local. . . : fe80::1c2b:3d4e:5f60:7182%12\r\n"
                "   Dirección IPv4. . . . . . . . . . . . . . : 192.168.1.38\r\n"
                "   Máscara de subred . . . . . . . . . . . . : 255.255.255.0\r\n"
                "   Puerta de enlace predeterminada . . . . . : fe80::1%12\r\n"
                "                                       192.168.1.1\r\n\r\n"
                "Adaptador de Ethernet vEthernet (WSL):\r\n\r\n"
                "   Dirección IPv4. . . . . . . . . . . . . . : 172.20.0.1\r\n"
                "   Máscara de subred . . . . . . . . . . . . : 255.255.240.0\r\n")
    ARP = ("\r\nInterfaz: 192.168.1.38 --- 0xc\r\n  Dirección de Internet          Dirección física      Tipo\r\n"
           "  192.168.1.1           a4-2b-b0-11-22-33     dinámico\r\n"
           "  192.168.1.111         90-e5-b1-d9-6d-f0     dinámico\r\n")
    ANUNCIO = ("NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1990\r\nServer: UPnP/1.0\r\nLocation: 192.168.1.111\r\n"
               f"NT: urn:bambulab-com:device:3dprinter:1\r\nUSN: {SERIE}\r\nDevModel.bambu.com: N9\r\n\r\n")

    def test_puerta_de_enlace_en_castellano(self):
        self.assertEqual(br.puerta_de_enlace(self.IPCONFIG, "192.168.1.38"), "192.168.1.1")
        self.assertIsNone(br.puerta_de_enlace(self.IPCONFIG, "172.20.0.1"))

    def test_ip_de_la_mac(self):
        self.assertEqual(br.ip_de_mac(self.ARP, "90:E5:B1:D9:6D:F0"), "192.168.1.111")
        self.assertIsNone(br.ip_de_mac(self.ARP, "00:11:22:33:44:55"))

    def test_anuncio_de_la_serie_y_de_otra(self):
        self.assertEqual(br.ip_del_anuncio(self.ANUNCIO, "192.168.1.50", SERIE), "192.168.1.111")
        self.assertIsNone(br.ip_del_anuncio(self.ANUNCIO, "192.168.1.50", OTRA_SERIE))

    def test_subred_tope_24(self):
        red = br._subred("10.0.5.7")
        self.assertEqual((len(red), red[0], red[-1]), (253, "10.0.5.1", "10.0.5.254"))


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
                ["--ambiente"], ["--avisar-retiro"], ["--seguir", "{tmp}/seg", "--cada", "1"],
                ["--seguir", "{tmp}/seg2", "--cada", "1", "--despertar", "1"])

    def test_cada_comando(self):
        sin, br.SIN_MENSAJES_S = br.SIN_MENSAJES_S, 3
        try:
            self._cada_comando()
        finally:
            br.SIN_MENSAJES_S = sin

    def _cada_comando(self):
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

    def test_imprimir_pieza_sin_error_de_python(self):
        # imprimir_pieza.py no pasa por main(): una falla de la impresora igual sale en un renglon (auditoria 16/10)
        vacio = _base.carpeta_nueva("sin_datos")
        env = dict(os.environ, BAMBU_DATOS=str(vacio / "no.json"), BAMBU_DATOS_NUBE=str(vacio / "tampoco.json"),
                   BAMBU_REGISTRO=str(vacio / "registro"))
        r = subprocess.run([sys.executable, str(_base.SCRIPTS / "imprimir_pieza.py"), "x.3mf", str(vacio / "c"),
                            "--color-parte", "1=negro"], capture_output=True, text=True, env=env, timeout=60,
                           encoding="utf-8", errors="replace")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("No encuentro los datos de la impresora", r.stdout)
        self.assertNotIn("Traceback", r.stdout + r.stderr)

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
            br.DATOS = _base.FUERA_DE_LA_TEMPORAL / "bambu-a2l.json"         # fuera de la temporal, pero no la real
            with self.assertRaises(br.FallaImpresora):
                br._escribir_json(br.DATOS, {"ip": "x"})
            self.assertFalse(br.DATOS.exists())
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
