"""Una impresora Bambu de JUGUETE para los tests: TLS + MQTT minimo en 127.0.0.x, sin librerias de terceros.

Hace lo que bambu_red.py necesita ver de una A2L:
- presenta un certificado cuyo CN es su numero de serie (hecho con el openssl de Git, en la carpeta temporal);
- MQTT 3.1.1: CONNECT/CONNACK (con el codigo que se le pida: 5 = codigo de acceso rechazado), SUBSCRIBE/SUBACK,
  PUBLISH en los dos sentidos, PINGREQ/PINGRESP, DISCONNECT;
- contesta el pedido de informe completo (pushall) y las ordenes project_file, stop, pause, resume;
- manda el estado cuando cambia (poner()), entero o solo lo que cambio (como las Bambu de verdad);
- escenarios: muda (acepta y no manda nada), partida (manda un informe en dos mitades con una pausa).
No simula la subida por FTPS (puerto 990) ni la camara (6000): los tests reemplazan subir() y la camara no contesta.
"""
import json
import socket
import ssl
import struct
import subprocess
import threading
import time
from pathlib import Path

OPENSSL = (r"C:\Program Files\Git\usr\bin\openssl.exe", r"C:\Program Files\Git\mingw64\bin\openssl.exe", "openssl")


def certificado(carpeta, serie):
    """(cert, clave) autofirmados con CN = serie, hechos una vez por carpeta; None si no hay openssl en la PC."""
    carpeta = Path(carpeta)
    cert, clave = carpeta / f"juguete_{serie}.crt", carpeta / f"juguete_{serie}.key"
    if cert.exists() and clave.exists():
        return cert, clave
    for exe in OPENSSL:
        try:
            r = subprocess.run([exe, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(clave),
                                "-out", str(cert), "-days", "2", "-subj", f"/CN={serie}"],
                               capture_output=True, timeout=120)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if r.returncode == 0 and cert.exists():
            return cert, clave
    return None


def _largo(n):
    out = b""
    while True:
        b = n % 128
        n //= 128
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out


def _txt(s):
    b = s.encode("utf-8")
    return struct.pack(">H", len(b)) + b


def estado_base(**cambios):
    """Un informe completo de A2L (forma de MOCK-A2L.json), imprimiendo."""
    e = {"command": "push_status", "gcode_state": "RUNNING", "stg_cur": 0, "layer_num": 10, "total_layer_num": 77,
         "mc_percent": 13, "mc_remaining_time": 400, "mc_print_line_number": "1234", "print_error": 0, "hms": [],
         "subtask_name": "pieza_prueba", "task_id": "555", "bed_temper": 55.0, "bed_target_temper": 55.0,
         "nozzle_temper": 220.0, "spd_lvl": 2, "lights_report": [{"node": "chamber_light", "mode": "on"}],
         "ams": {"tray_now": "1", "ams": [{"id": "16", "tray": [
             {"id": "0", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "PLA Lite",
              "tray_color": "EFE255FF", "tag_uid": "1C6E4ADF00000100"},
             {"id": "1", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "PLA Lite",
              "tray_color": "000000FF", "tag_uid": "6EACADA000000100"},
             {"id": "2", "tray_info_idx": "GFA18", "tray_type": "PLA", "tray_sub_brands": "PLA Lite",
              "tray_color": "FFFFFFFF", "tag_uid": "BCEB1CDC00000100"},
             {"id": "3"}]}]}}
    e.update(cambios)
    return e


class Juguete:
    def __init__(self, carpeta, serie, codigo, ip="127.0.0.1", puerto=0, connack=0):
        par = certificado(carpeta, serie)
        if par is None:
            raise RuntimeError("no hay openssl para hacer el certificado de juguete")
        self.ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.ctx.load_cert_chain(str(par[0]), str(par[1]))
        self.serie, self.codigo, self.ip, self.connack = serie, codigo, ip, connack
        self.estado = estado_base()
        self.mudo = False                 # acepta la conexion y no manda ningun informe (ni PINGRESP)
        self.no_publica = False           # contesta el aviso de vida (PINGRESP) pero no publica ningun informe
        self.partir = False               # el proximo informe va en dos mitades, con 1,5 s entre una y otra
        self.al_recibir = None            # funcion(orden) que se llama ANTES de contestar una orden
        self.al_imprimir = ("PREPARE", "RUNNING")   # estados por los que pasa al recibir project_file
        self.recibidos = []               # ordenes que mando el cliente
        self.conexiones = 0
        self._clientes = []
        self._lock = threading.Lock()
        self.srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind((ip, puerto))
        self.srv.listen(8)
        self.puerto = self.srv.getsockname()[1]
        self._vivo = True
        threading.Thread(target=self._aceptar, daemon=True).start()

    # ---------------- control desde el test ----------------
    def poner(self, solo_cambios=True, **campos):
        """Cambia el estado y se lo manda a los clientes conectados (solo lo que cambio, como las Bambu)."""
        with self._lock:
            self.estado.update(campos)
        self.empujar(campos if solo_cambios else self.estado)

    def empujar(self, campos=None):
        msg = {"print": dict(campos if campos is not None else self.estado)}
        for c in list(self._clientes):
            self._publicar(c, msg)

    def parar(self):
        self._vivo = False
        try:
            self.srv.close()
        except OSError:
            pass
        for c in list(self._clientes):
            try:
                c.close()
            except OSError:
                pass
        self._clientes.clear()

    # ---------------- adentro ----------------
    def _aceptar(self):
        while self._vivo:
            try:
                raw, _ = self.srv.accept()
            except OSError:
                return
            threading.Thread(target=self._atender, args=(raw,), daemon=True).start()

    def _publicar(self, c, obj):
        if self.no_publica:
            return
        cuerpo = _txt(f"device/{self.serie}/report") + json.dumps(obj).encode("utf-8")
        paquete = bytes([0x30]) + _largo(len(cuerpo)) + cuerpo
        try:
            if self.partir:
                self.partir = False
                mitad = len(paquete) // 2
                c.sendall(paquete[:mitad])
                time.sleep(1.5)
                c.sendall(paquete[mitad:])
            else:
                c.sendall(paquete)
        except OSError:
            pass

    def _atender(self, raw):
        try:
            c = self.ctx.wrap_socket(raw, server_side=True)
        except (ssl.SSLError, OSError):
            raw.close()
            return
        self.conexiones += 1
        buf = b""
        c.settimeout(0.5)
        try:
            while self._vivo:
                try:
                    trozo = c.recv(65536)
                except (socket.timeout, TimeoutError):
                    continue
                if not trozo:
                    break
                buf += trozo
                while len(buf) >= 2:
                    mult, largo, i = 1, 0, 1
                    while i < len(buf):
                        b = buf[i]
                        largo += (b & 127) * mult
                        mult *= 128
                        i += 1
                        if not b & 128:
                            break
                    if len(buf) < i + largo:
                        break
                    cab, dat = buf[0], buf[i:i + largo]
                    buf = buf[i + largo:]
                    if not self._paquete(c, cab, dat):
                        return
        except OSError:
            pass
        finally:
            if c in self._clientes:
                self._clientes.remove(c)
            try:
                c.close()
            except OSError:
                pass

    def _paquete(self, c, cab, dat):
        tipo = cab >> 4
        if tipo == 1:                                  # CONNECT
            rc = self.connack
            try:
                p = 2 + struct.unpack(">H", dat[:2])[0] + 4      # nombre del protocolo + nivel + flags + keepalive
                for _ in range(3):                             # id del cliente, usuario, clave
                    n = struct.unpack(">H", dat[p:p + 2])[0]
                    campo = dat[p + 2:p + 2 + n].decode()
                    p += 2 + n
                if not rc and campo != self.codigo:
                    rc = 5
            except (struct.error, UnicodeDecodeError):
                rc = 5
            c.sendall(bytes([0x20, 2, 0, rc]))
            if rc:
                return False
            self._clientes.append(c)
        elif tipo == 8:                                # SUBSCRIBE
            c.sendall(bytes([0x90, 3]) + dat[:2] + b"\x00")
        elif tipo == 12:                               # PINGREQ
            if not self.mudo:
                c.sendall(b"\xd0\x00")
        elif tipo == 14:                               # DISCONNECT
            return False
        elif tipo == 3:                                # PUBLISH del cliente
            n = struct.unpack(">H", dat[:2])[0]
            try:
                orden = json.loads(dat[2 + n:].decode("utf-8"))
            except ValueError:
                return True
            self.recibidos.append(orden)
            if self.al_recibir:
                self.al_recibir(orden)
            if self.mudo:
                return True
            if (orden.get("pushing") or {}).get("command") == "pushall":
                self._publicar(c, {"print": dict(self.estado)})
            p = orden.get("print") or {}
            comando = p.get("command")
            if comando == "project_file":
                self._publicar(c, {"print": {"command": "project_file", "result": "success",
                                             "sequence_id": p.get("sequence_id")}})
                for est in self.al_imprimir:
                    with self._lock:
                        self.estado.update(gcode_state=est, subtask_name=p.get("subtask_name"),
                                           task_id=p.get("task_id"), layer_num=0, mc_percent=0)
                    self.empujar({"gcode_state": est, "subtask_name": p.get("subtask_name"),
                                  "task_id": p.get("task_id"), "layer_num": 0, "mc_percent": 0})
            elif comando in ("stop", "pause", "resume"):
                nuevo = {"stop": "FAILED", "pause": "PAUSE", "resume": "RUNNING"}[comando]
                self._publicar(c, {"print": {"command": comando, "result": "success"}})
                with self._lock:
                    self.estado["gcode_state"] = nuevo
                self.empujar({"gcode_state": nuevo})
        return True
