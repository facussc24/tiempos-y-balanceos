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


class SeguirContraLaJuguete(ConJuguete):
    """--seguir de verdad, contra la impresora de juguete (T3 con el registro, T12, T13, T15, y lo de 2.3)."""

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


class ConciliarAlConectar(ConJuguete):
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
