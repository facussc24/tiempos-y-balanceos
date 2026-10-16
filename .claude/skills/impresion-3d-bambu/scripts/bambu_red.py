"""Hablarle a la Bambu Lab A2L por la red local (modo desarrollador), sin librerias de terceros.

Uso (python del sistema):
  bambu_red.py --preparar 192.168.1.198     arma el archivo de datos (IP y numero de serie; el codigo
                                            de acceso lo escribe Fak a mano, este script NUNCA lo muestra)
  bambu_red.py --estado                     SOLO LEE: estado, temperaturas y filamentos cargados

Datos en %USERPROFILE%\\.claude\\bambu-a2l.json (fuera del repo, que es publico); copia para las otras PC en la nube de Ingenieria.
MQTT 3.1.1 sobre TLS, puerto 8883, usuario "bblp", clave = codigo de acceso de la pantalla.

Nunca termina en un error de Python: cada falla sale en un renglon en castellano con su codigo de salida
(12 = no la encuentro / sin conexion, 13 = rechazo el codigo de acceso; los de --seguir, en seguir()).
"""
import json
import os
import re
import socket
import ssl
import struct
import sys
import tempfile
import time
from pathlib import Path

VERSION = "2026-10-16"        # la misma que el encabezado de SKILL.md (--version)
# Las pruebas (tests/) redirigen las rutas a una carpeta temporal con BAMBU_DATOS y BAMBU_DATOS_NUBE; con
# BAMBU_PRUEBA=1 este modulo se niega a escribir fuera de esa carpeta (nunca el archivo de datos real).
DATOS = (Path(os.environ["BAMBU_DATOS"]) if os.environ.get("BAMBU_DATOS")
         else Path(os.environ["USERPROFILE"]) / ".claude" / "bambu-a2l.json")
UNIDAD_CARGADOR_A2L = 16      # id fisico del cargador de 4 lugares de la A2L (lo informa la propia impresora)
# Copia compartida de los datos, en la nube de Ingenieria (OK de Fak 13/10/2026): asi la PC de un
# compañero se conecta sola. El repo es publico: el codigo de acceso NUNCA va en el repo.
DATOS_NUBE = (Path(os.environ["BAMBU_DATOS_NUBE"]) if os.environ.get("BAMBU_DATOS_NUBE")
              else Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
              / "INGENIERIA BARACK (NUNCA BORRAR)" / "1- GENERAL" / "5. 3D" / "IMPRESORA BAMBU A2L" / "bambu-a2l.json")
PUERTO_MQTT, PUERTO_FTP, PUERTO_CAMARA = 8883, 990, 6000     # wiki en/general/printer-network-ports
SALIDA_SIN_CONEXION, SALIDA_ACCESO = 12, 13     # 4 y 5 no: son las del latido de la casa (_latido.mjs)


class FallaImpresora(Exception):
    """Una falla que se le dice a la persona en un renglon, con su codigo de salida."""
    salida = 1

    def __init__(self, texto):
        super().__init__(texto)
        self.texto = texto


class SinConexion(FallaImpresora):
    salida = SALIDA_SIN_CONEXION


class AccesoRechazado(FallaImpresora):
    salida = SALIDA_ACCESO


class OtraImpresora(SinConexion):
    """En esa direccion contesta una Bambu, pero su certificado trae OTRA serie: no se le manda nada."""

    def __init__(self, ip, serie):
        self.ip, self.serie = ip, serie
        super().__init__(f"En {ip} hay otra impresora (serie {_serie_corta(serie)}), no la nuestra.")


def _serie_corta(serie):
    return (serie[:4] + "…" + serie[-3:]) if serie and len(serie) > 8 else (serie or "sin serie")


def ruta_de_prueba_ok(ruta):
    """Con BAMBU_PRUEBA=1 (los tests) nada se escribe fuera de la carpeta temporal del sistema."""
    if os.environ.get("BAMBU_PRUEBA") != "1":
        return
    tmp = Path(tempfile.gettempdir()).resolve()
    r = Path(ruta).resolve()
    if tmp != r and tmp not in r.parents:
        raise FallaImpresora(f"PRUEBA: {ruta} esta fuera de la carpeta temporal; no se escribe")


def _escribir_json(ruta, d):
    ruta_de_prueba_ok(ruta)
    Path(ruta).parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump({k: v for k, v in d.items() if not k.startswith("_")}, f, indent=1)


def cargar_datos():
    """Datos de la impresora: primero los de esta PC; si no estan, los de la nube de Ingenieria.
    La IP es una PISTA (ubicar() la comprueba con el numero de serie); la serie y el codigo, no."""
    for ruta in (DATOS, DATOS_NUBE):
        if ruta.exists():
            try:
                d = json.loads(ruta.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                raise FallaImpresora(f"No puedo leer el archivo de datos {ruta} ({type(e).__name__}): "
                                     "si OneDrive lo esta bajando, esperar un minuto; si esta roto, avisar a Fak")
            if d.get("serie"):
                d["_origen"] = str(ruta)
                if ruta != DATOS:              # datos de la nube: la direccion que encontro esta PC le gana
                    try:
                        p = json.loads(_pista_ip().read_text(encoding="utf-8"))
                        if p.get("serie") == d["serie"] and p.get("ip"):
                            d["ip"] = p["ip"]
                    except (OSError, ValueError):
                        pass
                return d
    raise FallaImpresora(
        "No encuentro los datos de la impresora.\n"
        f"  1. Mirar que este sincronizada la carpeta de Ingenieria: {DATOS_NUBE}\n"
        "  2. Si no esta: en la pantalla de la impresora, Ajustes > Solo LAN, leer la IP y correr\n"
        "     bambu_red.py --preparar <IP>   y despues   bambu_red.py --pedir-codigo\n"
        "  3. La PC tiene que estar en el mismo wifi que la impresora.")


def _contexto_tls():
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False          # la impresora firma con la CA propia de Bambu
    ctx.verify_mode = ssl.CERT_NONE
    # tope TLS 1.2, como ha-bambulab (bambu_client.py): el firmware 01.02.00.00 de la P2S no contesta un pedido 1.3
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    return ctx


def serie_del_certificado(der):
    """El numero de serie es el CN del certificado del equipo (OID 2.5.4.3 = 55 04 03); buscar «un texto largo en
    mayusculas» agarraba una FECHA de vigencia (13/10/2026)."""
    cns = [der[m.end():m.end() + m.group(1)[0]].decode("utf-8", "replace")
           for m in re.finditer(rb"\x55\x04\x03[\x0c\x13](.)", der, re.S)]
    cand = [c for c in cns if re.fullmatch(r"[0-9A-Z]{10,}", c)]
    return cand[-1] if cand else ""


def _motivo_red(e):
    n = getattr(e, "winerror", None) or getattr(e, "errno", None)
    return {10065: "la red no llega a esa direccion", 10051: "esta PC no tiene red",
            10060: "no contesta", 11001: "nombre desconocido"}.get(n, f"{type(e).__name__} {n or ''}".strip())


def tls(ip, puerto=None, timeout=8, serie=None):
    """Conexion cifrada con la impresora. Con `serie`, el certificado TIENE que traer ese numero de serie: a un
    equipo que no lo trae no se le manda nada (ni el codigo de acceso)."""
    puerto = PUERTO_MQTT if puerto is None else puerto
    if not ip:
        raise SinConexion("El archivo de datos no tiene la direccion de la impresora.")
    try:
        raw = socket.create_connection((ip, puerto), timeout=timeout)
    except ConnectionRefusedError:
        raise SinConexion(f"En {ip} hay un equipo, pero no es la impresora o tiene apagado el modo desarrollador "
                          f"(no escucha el puerto {puerto}).") from None
    except (TimeoutError, socket.timeout):
        raise SinConexion(f"No encuentro la impresora en {ip} (no contesta).") from None
    except OSError as e:
        raise SinConexion(f"No encuentro la impresora en {ip} ({_motivo_red(e)}).") from None
    try:
        t = _contexto_tls().wrap_socket(raw)
    except (ssl.SSLError, OSError):
        raw.close()
        raise SinConexion(f"En {ip} contesta otra cosa (el cifrado no es el de la impresora).") from None
    if serie:
        vista = serie_del_certificado(t.getpeercert(True))
        if vista != serie:
            t.close()
            raise OtraImpresora(ip, vista)
    return t


def preparar(ip):
    if DATOS.exists():
        d = json.load(open(DATOS, encoding="utf-8"))
        print("el archivo ya existe y no se pisa:", DATOS, "| tiene codigo cargado:", bool(d.get("codigo_acceso")),
              "| para cambiar la direccion no hace falta: el programa la busca sola por el numero de serie")
        return 0
    with tls(ip) as t:
        serie = serie_del_certificado(t.getpeercert(True))
    _escribir_json(DATOS, {"ip": ip, "serie": serie, "codigo_acceso": ""})
    print("escrito", DATOS, "| serie leida del certificado:", _serie_corta(serie) if serie else "NO ENCONTRADA")
    return 0


# ---------------- MQTT minimo ----------------
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


def _leer(sock, n):
    buf = b""
    while len(buf) < n:
        c = sock.recv(n - len(buf))
        if not c:
            raise ConnectionError("la impresora cerro la conexion")
        buf += c
    return buf


def _paquete(sock):
    cab = _leer(sock, 1)[0]
    mult, largo = 1, 0
    while True:
        b = _leer(sock, 1)[0]
        largo += (b & 127) * mult
        mult *= 128
        if not b & 128:
            break
    return cab, _leer(sock, largo) if largo else b""


# ---------------- buscar la impresora por su numero de serie (16/10/2026) ----------------
# El 15/10 a las 23:31 la impresora paso de .198 a .111 (el router le dio otra direccion) y el programa, con la IP
# fija en un archivo, no la volvio a ver; un bucle de ping pregunto por la .198 tres horas. Bambu Studio la
# encuentra sola porque la guarda por numero de serie (DevManager.cpp, «MachineObject IP changed»).
SSDP_GRUPO, SSDP_PUERTOS, SSDP_SEGUNDOS = "239.255.255.250", (1990, 2021), 15
_IPV4 = r"(?:\d{1,3}\.){3}\d{1,3}"


def _pista_ip():
    """La direccion que encontro ubicar() en una PC que lee los datos de la nube: la nube no se toca desde cada PC
    (dos PC escribiendo el mismo archivo de OneDrive = copias en conflicto) ni se copia el codigo a esta PC."""
    return DATOS.with_name("bambu-a2l-ip.json")


def _ips_del_registro():
    import registro
    return registro.ips_anotadas()


def ip_del_anuncio(txt, ip_origen, serie):
    """Del aviso SSDP de una Bambu (NOTIFY o respuesta a un M-SEARCH): su direccion si es la de esa serie."""
    campos = {k.strip().lower(): v.strip() for k, v in re.findall(r"^([A-Za-z0-9.\-]+):[ \t]*(.*?)\r?$", txt, re.M)}
    if campos.get("usn") != serie:
        return None
    loc = campos.get("location", "")
    return loc if re.fullmatch(_IPV4, loc) else ip_origen


def _ips_por_anuncio(serie, segundos=None):
    """Escucha el anuncio de la impresora (1990 y 2021) y le pregunta con un M-SEARCH. Si un puerto esta ocupado
    (Bambu Studio abierto) o el firewall no deja, lo dice en un renglon y sigue: no es fatal."""
    segundos = SSDP_SEGUNDOS if segundos is None else segundos
    socks, avisos, ips = [], [], []
    for puerto in SSDP_PUERTOS:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("", puerto))
            try:
                s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP,
                             struct.pack("4sl", socket.inet_aton(SSDP_GRUPO), socket.INADDR_ANY))
            except OSError:
                pass
            s.settimeout(0.3)
            socks.append(s)
        except OSError as e:
            avisos.append(f"no pude escuchar el puerto {puerto} (¿Bambu Studio abierto o el firewall?): {e.strerror or e}")
    try:
        q = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        q.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        q.settimeout(0.3)
        pedido = ("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1990\r\nMAN: \"ssdp:discover\"\r\nMX: 3\r\n"
                  "ST: urn:bambulab-com:device:3dprinter:1\r\n\r\n").encode()
        for destino in ((SSDP_GRUPO, 1990), (SSDP_GRUPO, 2021), ("255.255.255.255", 2021)):
            try:
                q.sendto(pedido, destino)
            except OSError:
                pass
        socks.append(q)
    except OSError as e:
        avisos.append(f"no pude preguntar en la red: {e.strerror or e}")
    fin = time.time() + segundos
    try:
        while time.time() < fin and socks and not ips:
            for s in socks:
                try:
                    data, addr = s.recvfrom(4096)
                except OSError:
                    continue
                ip = ip_del_anuncio(data.decode("utf-8", "replace"), addr[0], serie)
                if ip and ip not in ips:
                    ips.append(ip)
    finally:
        for s in socks:
            s.close()
    for a in avisos:
        print("  anuncio:", a)
    return ips


def _correr(cmd, timeout=30):
    """Un comando de Windows; su salida viene en la pagina de codigos de la consola (cp850), no en utf-8."""
    import subprocess
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return r.stdout.decode("cp850", "replace")


def puerta_de_enlace(ipconfig, ip):
    """Del texto de `ipconfig`, la puerta de enlace del adaptador que tiene la direccion `ip` (sin depender del
    idioma: es la primera IPv4 despues de la mascara en ese bloque)."""
    lineas = ipconfig.splitlines()
    for i, ren in enumerate(lineas):
        if ip and re.search(r"(?<![\d.])" + re.escape(ip) + r"(?![\d.])", ren):
            mascara = False
            for sig in lineas[i + 1:]:
                if sig.strip() and not sig[:1].isspace():
                    break                       # empieza otro adaptador
                for x in re.findall(_IPV4, sig):
                    if x.startswith("255."):
                        mascara = True
                    elif mascara:
                        return x
    return None


def _mi_red():
    """(direccion de esta PC, puerta de enlace) de la placa de red que sale a la red; sin red, (None, None)."""
    ip = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))                  # no manda nada: solo elige la placa de red que sale
        ip = s.getsockname()[0]
        s.close()
    except OSError:
        pass
    return ip, (puerta_de_enlace(_correr(["ipconfig"]), ip) if ip else None)


def ip_de_mac(arp, mac):
    """Del texto de `arp -a`, la direccion que tiene esa placa de red."""
    m = mac.lower().replace(":", "-")
    for ren in arp.splitlines():
        if m in ren.lower():
            x = re.findall(_IPV4, ren)
            if x:
                return x[0]
    return None


def _subred(ip):
    """Las 254 direcciones de la red de esta PC (se toma /24 aunque la mascara sea mas grande)."""
    base = ip.rsplit(".", 1)[0]
    return [f"{base}.{i}" for i in range(1, 255) if f"{base}.{i}" != ip]


def _ips_por_mac(mac):
    """Barrido de ping a la red de esta PC (llena la tabla ARP) y la direccion que tiene la MAC de la impresora."""
    if not mac:
        return []
    import concurrent.futures
    ip, _ = _mi_red()
    if not ip:
        return []
    with concurrent.futures.ThreadPoolExecutor(64) as ex:
        list(ex.map(lambda x: _correr(["ping", "-n", "1", "-w", "300", x], timeout=5), _subred(ip)))
    x = ip_de_mac(_correr(["arp", "-a"]), mac)
    return [x] if x else []


def _abre(ip, puerto, timeout):
    try:
        socket.create_connection((ip, puerto), timeout=timeout).close()
        return True
    except OSError:
        return False


def _ips_de_la_red(probadas):
    """Recorrido de la red de esta PC en el 8883, 0,5 s por equipo y varios a la vez: los que contestan."""
    import concurrent.futures
    ip, _ = _mi_red()
    if not ip:
        return []
    cand = [x for x in _subred(ip) if x not in probadas]
    with concurrent.futures.ThreadPoolExecutor(64) as ex:
        abiertos = [x for x, ok in zip(cand, ex.map(lambda x: _abre(x, PUERTO_MQTT, 0.5), cand)) if ok]
    return abiertos


def _pc_sin_red():
    """True si la que perdio la red es ESTA PC: no tiene direccion o no le contesta el router."""
    ip, gw = _mi_red()
    if not ip:
        return True
    if not gw:
        return False                                # sin saber cual es el router no se afirma nada
    return "ttl=" not in _correr(["ping", "-n", "2", "-w", "1000", gw], timeout=10).lower()


def _guardar_ip(d, vieja, nueva):
    """Corrige SOLO la copia de esta PC: el archivo local (con respaldo al lado) o, si los datos vienen de la nube,
    una pista local sin el codigo de acceso. El bambu-a2l.json de la nube no se toca desde aca."""
    import shutil
    if d.get("_origen") == str(DATOS) and DATOS.exists():
        respaldo = DATOS.with_name(f"{DATOS.name}.antes-{time.strftime('%Y-%m-%d-%H%M%S')}")
        ruta_de_prueba_ok(respaldo)
        shutil.copy2(DATOS, respaldo)
        datos = json.loads(DATOS.read_text(encoding="utf-8"))
        datos["ip"] = nueva
        _escribir_json(DATOS, datos)
        return f"{DATOS} (respaldo {respaldo.name})"
    import registro
    _escribir_json(_pista_ip(), {"ip": nueva, "serie": d["serie"], "cuando": registro.ahora_iso(), "antes": vieja})
    return f"{_pista_ip()} (pista de esta PC; la copia de la nube no se toca)"


def ubicar(d, guardar=True):
    """Encuentra la impresora por su NUMERO DE SERIE y deja en d["ip"] donde esta. Cada candidato se comprueba con el
    certificado (CN = serie) antes de mandarle nada. Orden: la direccion del archivo, las que anotaron las otras PC,
    el anuncio de la red (SSDP), la placa de red (MAC, si el archivo la trae) y el recorrido de la red en el 8883.
    Encontrada en otra direccion: corrige la copia de esta PC y lo anota en el registro. No encontrada: SinConexion.
    BAMBU_BUSCAR_EN (solo pruebas): en vez del anuncio, la MAC y el recorrido, prueba solo esas direcciones."""
    serie, vieja = d["serie"], d.get("ip")
    probadas = set()

    def probar(ip, timeout):
        if not ip or ip in probadas:
            return False
        probadas.add(ip)
        try:
            tls(ip, serie=serie, timeout=timeout).close()
            return True
        except OtraImpresora as e:
            print(f"  {e.texto} Sigo buscando.", flush=True)
        except SinConexion:
            pass
        return False

    prueba = [x.strip() for x in os.environ.get("BAMBU_BUSCAR_EN", "").split(",") if x.strip()]
    pasos = [("la direccion del archivo", lambda: [vieja], 3), ("las que anotaron las otras PC", _ips_del_registro, 2)]
    if prueba:
        pasos.append(("las direcciones de prueba", lambda: prueba, 2))
    else:
        pasos += [("el anuncio de la impresora en la red", lambda: _ips_por_anuncio(serie), 3),
                  ("la placa de red (MAC)", lambda: _ips_por_mac(d.get("mac")), 3),
                  ("el recorrido de la red", lambda: _ips_de_la_red(probadas), 2)]
    encontrada, por = None, None
    for nombre, fuente, t in pasos:
        try:
            cand = [x for x in (fuente() or []) if x]
        except Exception as e:
            print(f"  {nombre}: no se pudo ({type(e).__name__}: {e})", flush=True)
            cand = []
        encontrada = next((ip for ip in cand if probar(ip, t)), None)
        if encontrada:
            por = nombre
            break
    if not encontrada:
        texto = ("No encuentro la impresora en la red (probé " + ", ".join(n for n, _, _ in pasos) + "): "
                 "¿está prendida y en la wifi barack_Oficinas_PA? Mirá en su pantalla Ajustes > WLAN.")
        if not prueba and _pc_sin_red():
            texto = ("La que perdió la red es esta PC, no la impresora: no llega al router. Revisá el wifi de esta PC; "
                     "la impresión, si había una, sigue sola (el archivo está en la tarjeta de la impresora).")
        raise SinConexion(texto)
    if encontrada != vieja:
        d["ip"] = encontrada
        if guardar:
            donde = _guardar_ip(d, vieja, encontrada)
            try:
                import registro
                registro.anotar_ip(encontrada, antes=vieja)
            except (Exception, SystemExit) as e:
                print("  (no se pudo anotar la direccion en el registro:", e, ")")
        else:
            donde = "sin guardar (prueba)"
        print(f"la impresora cambió a {encontrada} (estaba en {vieja}; la encontré por {por}); "
              f"archivo corregido: {donde}", flush=True)
    d["_verificada"] = encontrada
    return encontrada


TEXTO_ACCESO = ("La impresora rechazó la conexión: cambió el código de acceso o se apagó el modo desarrollador. "
                 "Mirá en su pantalla Ajustes > Solo LAN; el código lo escribe Fak con bambu_red.py --pedir-codigo "
                 "(nunca en el chat).")


def conectar(d, buscar=True):
    """Conexion MQTT ya presentada. El certificado se comprueba ANTES de mandar el codigo de acceso. Si la
    direccion no contesta o es otro equipo, con buscar=True la busca en la red por su numero de serie (ubicar)."""
    if not d.get("codigo_acceso"):
        raise FallaImpresora(f"Falta el codigo de acceso en {d.get('_origen', DATOS)}: lo escribe Fak con "
                             "bambu_red.py --pedir-codigo (nunca en el chat).")
    try:
        s = tls(d.get("ip"), serie=d["serie"])
    except SinConexion as e:
        if not buscar:
            raise
        print(e.texto, "La busco en la red por su numero de serie...", flush=True)
        ubicar(d)                                    # corrige d["ip"] o levanta SinConexion «no la encuentro»
        s = tls(d["ip"], serie=d["serie"])
    var = _txt("MQTT") + bytes([4, 0xC2]) + struct.pack(">H", 60)      # usuario + clave + sesion limpia, keepalive 60 s
    cuerpo = var + _txt("barack-%d" % os.getpid()) + _txt("bblp") + _txt(d["codigo_acceso"])
    try:
        s.sendall(bytes([0x10]) + _largo(len(cuerpo)) + cuerpo)
        cab, dat = _paquete(s)
    except (OSError, ConnectionError):
        s.close()
        raise SinConexion(f"La impresora en {d['ip']} cortó la conexión al presentarse.") from None
    if cab >> 4 != 2 or len(dat) < 2:
        s.close()
        raise SinConexion(f"En {d['ip']} contestó algo que no es la impresora.")
    if dat[1] in (4, 5):
        s.close()
        raise AccesoRechazado(TEXTO_ACCESO)
    if dat[1]:
        s.close()
        raise SinConexion(f"La impresora rechazó la conexión (código {dat[1]}): probá de nuevo en un minuto.")
    return s


def suscribir(s, tema):
    cuerpo = struct.pack(">H", 1) + _txt(tema) + bytes([0])
    s.sendall(bytes([0x82]) + _largo(len(cuerpo)) + cuerpo)


def publicar(s, tema, obj):
    cuerpo = _txt(tema) + json.dumps(obj).encode("utf-8")
    s.sendall(bytes([0x30]) + _largo(len(cuerpo)) + cuerpo)


def _fusionar_por_id(viejos, nuevos, sub=None):
    """Listas de dicts con 'id' (unidades del cargador, lugares): se actualiza cada uno por su id."""
    por_id = {str(x.get("id")): dict(x) for x in viejos if isinstance(x, dict)}
    for x in nuevos:
        if not isinstance(x, dict):
            continue
        k = str(x.get("id"))
        if k in por_id:
            for kk, vv in x.items():
                if sub and kk == sub and isinstance(vv, list) and isinstance(por_id[k].get(kk), list):
                    por_id[k][kk] = _fusionar_por_id(por_id[k][kk], vv)
                else:
                    por_id[k][kk] = vv
        else:
            por_id[k] = dict(x)
    return list(por_id.values())


def fusionar(visto, p):
    """Suma un informe al estado conocido. Los informes parciales no borran lo demas: un 'ams' que trae un solo
    lugar actualiza ESE lugar, no deja el cargador vacio."""
    for k, v in p.items():
        if k == "ams" and isinstance(v, dict) and isinstance(visto.get("ams"), dict):
            a = visto["ams"]
            for k2, v2 in v.items():
                if k2 == "ams" and isinstance(v2, list) and isinstance(a.get("ams"), list):
                    a["ams"] = _fusionar_por_id(a["ams"], v2, sub="tray")
                else:
                    a[k2] = v2
        else:
            visto[k] = v
    return visto


PING_CADA, PUSHALL_CADA = 30, 300     # aviso de vida cada 30 s (keepalive 60); informe completo cada 5 min (OpenBambuAPI)


class Conexion:
    """Una conexion MQTT con la impresora que puede quedar abierta. Lee paquetes ENTEROS de un buffer propio: si un
    informe llega partido en dos, no se pierde ni se desordena lo que sigue. Manda el aviso de vida y pide el
    informe completo al conectar y cada 5 minutos; los informes llegan solos."""

    def __init__(self, d, buscar=True):
        self.d = d
        self.s = conectar(d, buscar)
        self.buf = b""
        self.visto = {}
        self.ult_paquete = self.ult_ping = time.time()
        self.ult_pushall = 0.0
        self.tema = f"device/{d['serie']}/request"
        try:
            suscribir(self.s, f"device/{d['serie']}/report")
        except OSError:
            self.cerrar()
            raise SinConexion("La impresora cortó la conexión al suscribirse.") from None
        self.pushall()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.cerrar()

    def publicar(self, obj):
        try:
            publicar(self.s, self.tema, obj)
        except OSError:
            raise SinConexion("Se cortó la conexión con la impresora al mandarle un pedido.") from None

    def pushall(self):
        self.publicar({"pushing": {"sequence_id": "0", "command": "pushall"}})
        self.ult_pushall = time.time()

    def _paquetes(self):
        out = []
        while len(self.buf) >= 2:
            mult, largo, i = 1, 0, 1
            while True:
                if i >= len(self.buf):
                    return out                      # el largo todavia no llego entero
                b = self.buf[i]
                largo += (b & 127) * mult
                mult *= 128
                i += 1
                if not b & 128:
                    break
                if i > 4:
                    raise SinConexion("La impresora mandó un paquete roto.")
            if len(self.buf) < i + largo:
                return out                          # el cuerpo todavia no llego entero
            out.append((self.buf[0], self.buf[i:i + largo]))
            self.buf = self.buf[i + largo:]
        return out

    def leer(self, segundos, hasta=None):
        """Lee lo que llegue durante `segundos`, o hasta que hasta(visto, mensaje) de True. Devuelve los mensajes
        'print' que llegaron. Levanta SinConexion si la conexion se corta."""
        fin = time.time() + segundos
        nuevos = []
        while True:
            for cab, dat in self._paquetes():
                self.ult_paquete = time.time()
                if cab >> 4 != 3 or len(dat) < 2:
                    continue                        # CONNACK, SUBACK, PINGRESP: solo cuentan como señal de vida
                n = struct.unpack(">H", dat[:2])[0]
                off = 2 + n + (2 if (cab >> 1) & 3 else 0)   # con QoS > 0 viene el numero de paquete
                try:
                    m = json.loads(dat[off:].decode("utf-8", "replace"))
                except ValueError:
                    continue
                p = m.get("print") if isinstance(m, dict) else None
                if isinstance(p, dict):
                    fusionar(self.visto, p)
                    nuevos.append(p)
                    if hasta and hasta(self.visto, p):
                        return nuevos
            ahora_ = time.time()
            if ahora_ >= fin:
                return nuevos
            try:
                if ahora_ - self.ult_ping >= PING_CADA:
                    self.s.sendall(b"\xc0\x00")            # PINGREQ
                    self.ult_ping = ahora_
            except OSError:
                raise SinConexion("Se cortó la conexión con la impresora.") from None
            if ahora_ - self.ult_pushall >= PUSHALL_CADA:
                self.pushall()
            self.s.settimeout(max(0.05, min(1.0, fin - ahora_)))
            try:
                c = self.s.recv(65536)
            except (socket.timeout, TimeoutError):
                continue
            except (OSError, ssl.SSLError):
                raise SinConexion("Se cortó la conexión con la impresora.") from None
            if not c:
                raise SinConexion("La impresora cerró la conexión.")
            self.buf += c

    def cerrar(self):
        try:
            self.s.sendall(b"\xe0\x00")                 # DISCONNECT
        except OSError:
            pass
        try:
            self.s.close()
        except OSError:
            pass


def _informe_completo(visto, p):
    """El informe que contesta un pushall: trae el estado y el cargador en el mismo mensaje."""
    return "gcode_state" in p and "ams" in p


def estado():
    d = cargar_datos()
    with Conexion(d) as c:
        print("conectado a la impresora en", d["ip"], "(el codigo de acceso es correcto)")
        c.leer(8, hasta=_informe_completo)
        visto = c.visto
    if not visto:
        print("no llego ningun informe: revisar el numero de serie del archivo de datos")
        return 1
    for k in ("gcode_state", "mc_percent", "mc_remaining_time", "nozzle_temper", "bed_temper",
              "gcode_file", "subtask_name", "print_error", "wifi_signal", "nozzle_diameter"):
        if k in visto:
            print(f"  {k}: {visto[k]}")
    for unidad in (visto.get("ams") or {}).get("ams", []):
        for t in unidad.get("tray", []):
            print(f"  lugar {int(t.get('id', 0)) + 1}: {t.get('tray_sub_brands') or t.get('tray_type') or 'vacio'}"
                  f" | color {('#' + t['tray_color'][:6]) if t.get('tray_color') else '-'}"
                  f" | perfil {t.get('tray_info_idx', '-')}")
    try:
        _escribir_json(DATOS.with_name("bambu-a2l-ultimo-estado.json"), visto)
    except (OSError, FallaImpresora) as e:
        print("  (no se pudo guardar el ultimo estado:", e, ")")
    return 0


def subir(d, archivo, nombre):
    """Sube el archivo a la impresora por FTPS implicito (puerto 990), reusando la sesion TLS."""
    import ftplib

    class FTPSImplicito(ftplib.FTP_TLS):
        def connect(self, host="", port=0, timeout=-999, source_address=None):
            self.host, self.port = host, port
            self.timeout = 30
            raw = socket.create_connection((host, port), timeout=30)
            self.af = raw.family
            self.sock = self.context.wrap_socket(raw, server_hostname=host)
            self.file = self.sock.makefile("r", encoding="utf-8")
            self.welcome = self.getresp()
            return self.welcome

        def ntransfercmd(self, cmd, rest=None):
            conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
            if self._prot_p:
                conn = self.context.wrap_socket(conn, server_hostname=self.host,
                                                session=self.sock.session)
            return conn, size

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    f = FTPSImplicito(context=ctx)
    f.connect(d["ip"], 990)
    f.login("bblp", d["codigo_acceso"])
    f.prot_p()
    f.voidcmd("TYPE I")
    conn = f.transfercmd("STOR " + nombre)
    with open(archivo, "rb") as fh:
        while True:
            blo = fh.read(65536)
            if not blo:
                break
            conn.sendall(blo)
    conn.close()                       # sin unwrap(): con la Bambu se queda colgado
    try:
        f.voidresp()
    except Exception as e:
        print("  aviso al cerrar la subida:", type(e).__name__, str(e)[:80])
    tam = None
    try:
        tam = f.size(nombre)
    except Exception:
        pass
    try:
        f.quit()
    except Exception:
        pass
    return tam


def filamentos_del_archivo(archivo):
    """[(id, perfil GFAxx, tipo, color #RRGGBB, gramos)] leido de Metadata/slice_info.config."""
    import zipfile
    txt = zipfile.ZipFile(archivo).read("Metadata/slice_info.config").decode("utf-8", "replace")
    out = []
    for m in re.finditer(r"<filament ([^>]*)/>", txt):
        at = dict(re.findall(r'([a-z_]+)="([^"]*)"', m.group(1)))
        out.append((int(at.get("id", 0)), at.get("tray_info_idx", ""), at.get("type", ""),
                    at.get("color", "").upper()[:7], at.get("used_g", "")))
    return sorted(out)


def lugares_del_cargador(estado_):
    """{lugar 0-3: (perfil GFAxx, nombre, color #RRGGBB)} de lo que informa la impresora."""
    out = {}
    for unidad in (estado_.get("ams") or {}).get("ams", []):
        for t in unidad.get("tray", []):
            if t.get("tray_info_idx") or t.get("tray_type"):
                out[int(t["id"])] = (t.get("tray_info_idx", ""),
                                     t.get("tray_sub_brands") or t.get("tray_type", ""),
                                     "#" + (t.get("tray_color") or "")[:6].upper())
    return out


def mapa_automatico(archivo, estado_):
    """Elige el lugar del cargador para cada filamento del archivo: MISMO material (perfil GFAxx)
    y el color mas parecido. Devuelve (mapa, renglones para mostrar, fallas)."""
    def dist(c1, c2):
        try:
            a_, b_ = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (c1, c2))
            return sum((x - y) ** 2 for x, y in zip(a_, b_)) ** 0.5
        except Exception:
            return 999.0
    lug = lugares_del_cargador(estado_)
    mapa, ren, fallas, usados = [], [], [], set()
    for fid, perfil, tipo, color, gramos in filamentos_del_archivo(archivo):
        cand = [(dist(color, c), n) for n, (pf, _, c) in lug.items() if pf == perfil and n not in usados]
        if not cand:
            hay = sorted({f"{nom} ({pf})" for pf, nom, _ in lug.values()})
            fallas.append(f"filamento {fid} del archivo es {tipo} perfil {perfil} y en el cargador hay {hay}: "
                          f"hay que laminarlo de nuevo con el material cargado")
            mapa.append(-1)
            continue
        dmin, n = min(cand)
        usados.add(n)
        mapa.append(n)
        ren.append(f"filamento {fid} ({color}, {gramos} g) -> lugar {n + 1}: {lug[n][1]} {lug[n][2]}")
        if dmin > 120:
            fallas.append(f"filamento {fid}: el color del archivo {color} no se parece al del lugar {n + 1} "
                          f"{lug[n][2]} (distancia {dmin:.0f}): revisar que rollo hay puesto")
    return mapa, ren, fallas


def imprimir(archivo, mapa, aplicar):
    """Sube un .gcode.3mf y le pide a la impresora que lo imprima. Sin --apply solo muestra el plan."""
    import hashlib
    import zipfile
    d = cargar_datos()
    archivo = Path(archivo)
    est0 = leer_estado(d)
    fallas = []
    # antes que el freno de color: con varias placas solo se mandaria la 1 y el resto se perderia
    # sin aviso (14/10/2026); el mensaje del color tapaba este
    with zipfile.ZipFile(archivo) as _z:
        placas = [n for n in _z.namelist() if re.fullmatch(r"Metadata/plate_\d+\.gcode", n)]
    if len(placas) > 1:
        print(f"   NO SE MANDA: el archivo trae {len(placas)} placas; va un archivo por placa")
        return 1
    if mapa is None:                      # sin --mapa: se elige solo, por material y color
        mapa, ren, fallas = mapa_automatico(archivo, est0)
        for r in ren:
            print("  ", r)
    elif not mapa or any(not isinstance(m, int) or m < -1 or m > 3 for m in mapa):
        fallas.append(f"--mapa {mapa}: cada lugar del cargador va de 0 a 3 (-1 = no se usa)")
    # con mapa a mano o automatico: a una impresora ocupada no se le manda nada
    if aplicar and est0.get("gcode_state") in ("RUNNING", "PREPARE", "PAUSE"):
        fallas.append(f"la impresora esta ocupada ({est0.get('gcode_state')})")
    if fallas:
        for f in fallas:
            print("   NO SE MANDA:", f)
        return 1
    nombre = "virolador_v14.gcode.3mf" if "VIROLADOR v14" in archivo.name else re.sub(r"[^A-Za-z0-9_.-]", "_", archivo.name)
    z = zipfile.ZipFile(archivo)
    placa = "Metadata/plate_1.gcode"
    md5 = hashlib.md5(z.read(placa)).hexdigest().upper()
    # Forma de la orden: la del programa abierto Bambuddy (maziggy/bambuddy, bambu_mqtt.py), que ya
    # soporta la A2L y la saco de capturas de Bambu Studio. LO QUE FALTABA el 13/10/2026: en la A2L
    # el cargador es la unidad fisica 16, y sin "ams_mapping2" con ams_id 16 la impresora acepta el
    # trabajo y se queda para siempre en la etapa 77 ("Preparando AMS"), sin error.
    uid = str(int(time.time() * 1000) % 2147483647 or 1)
    orden = {"print": {
        "sequence_id": "20000", "command": "project_file", "param": placa,
        "url": "ftp://" + nombre, "file": nombre, "md5": md5,
        "bed_type": "auto", "timelapse": False,
        "bed_leveling": False, "auto_bed_leveling": 2,
        "flow_cali": False, "extrude_cali_flag": 2, "extrude_cali_manual_mode": 0,
        "vibration_cali": True, "layer_inspect": False, "nozzle_offset_cali": 0,
        "use_ams": True,
        "subtask_name": nombre.replace(".3mf", "").replace(".gcode", ""),
        "profile_id": "0", "project_id": uid, "subtask_id": uid, "task_id": uid,
        "ams_mapping": list(mapa),
        "ams_mapping2": [{"ams_id": UNIDAD_CARGADOR_A2L, "slot_id": m} for m in mapa]}}
    print("PLAN: subir", archivo.name, f"({archivo.stat().st_size/1e6:.1f} MB) como", nombre)
    print("      imprimir", placa, "| filamento del archivo -> lugar del cargador:",
          {i + 1: m + 1 for i, m in enumerate(mapa)})
    # temperatura del lugar contra lo que pide Bambu (avisa; la decision de imprimir igual es de Fak)
    try:
        t_est = re.search(rb"total estimated time: (?:(\d+)h )?(\d+)m", z.read(placa)[:20000])
        lin_a, av_a = ambiente((int(t_est.group(1) or 0) * 60 + int(t_est.group(2))) if t_est else 0)
        for x in lin_a:
            print("     ", x)
        for x in av_a:
            print("      AVISO DE AMBIENTE:", x)
    except Exception as e:
        print("      (ambiente sin medir:", type(e).__name__, ")")
    # lo que pega en la cama, dibujado ANTES de mandar (15/10/2026: pines acostados con dos islitas
    # por pieza se despegaron; la miniatura del laminado no lo mostraba). Avisa, no frena.
    try:
        import primera_capa
        pc = primera_capa.dibujar(archivo)
        print("      PRIMERA CAPA (mostrarsela a Fak antes de mandar):", pc["png"])
        print("      apoyo de las piezas en la cama:", pc["apoyo_mm2"], "mm2 | borde de adherencia:",
              "si" if pc["borde"] else "NO")
        if not pc["borde"] and pc["chico"]:
            print("      AVISO: poco apoyo y sin borde de adherencia. Una pieza angosta o acostada se despega: "
                  "laminar con --ajuste brim_type=outer_only --ajuste brim_width=6")
    except (Exception, SystemExit) as e:     # un Ctrl+C frena el envio; lo demas solo avisa
        print("      (primera capa sin dibujar:", type(e).__name__, e, ")")
    if not aplicar:
        print("      (sin --apply no se manda nada)")
        return 0
    c = Conexion(d)
    tam = subir(d, archivo, nombre)
    print("  subido; tamano en la impresora:", tam, "| local:", archivo.stat().st_size)
    if tam is not None and tam != archivo.stat().st_size:
        print("  EL ARCHIVO NO LLEGO ENTERO: no se manda a imprimir")
        c.cerrar()
        return 1
    c.publicar(orden)
    print("  ORDEN DE IMPRIMIR MANDADA", time.strftime("%H:%M:%S"))
    # 15/10/2026: se mando y nadie vigilo; la falla la vio Fak al 27 %. La vigilancia la lanza la
    # sesion (en segundo plano, para que su salida la despierte): este renglon se lo recuerda.
    print("  AHORA, EN SEGUNDO PLANO: bambu_red.py --seguir <carpeta> --fotos-en 3,10 --despertar 5 --cada 30")
    # queda anotado en el registro compartido de la nube (horas, gramos por rollo)
    try:
        import registro
        est1 = leer_estado(d, 4)
        chips = {int(t["id"]): t.get("tag_uid") for u in (est1.get("ams") or {}).get("ams", [])
                 for t in u.get("tray", []) if t.get("tag_uid")}
        lug1 = lugares_del_cargador(est1)
        tiempo = re.search(rb"total estimated time: (?:(\d+)h )?(\d+)m", z.read(placa)[:20000] or b"")
        registro.anotar({
            "tipo": "enviada", "trabajo_id": time.strftime("%Y%m%d-%H%M%S-") + nombre.split(".")[0],
            "pieza": archivo.stem.replace(".gcode", ""), "archivo": archivo.name,
            "minutos_estimados": (int(tiempo.group(1) or 0) * 60 + int(tiempo.group(2))) if tiempo else None,
            "filamentos": [{"lugar": mapa[i] + 1, "material": lug1.get(mapa[i], ("", "", ""))[1],
                            "color": col, "gramos": float(g or 0), "rollo": chips.get(mapa[i])}
                           for i, (_, _, _, col, g) in enumerate(filamentos_del_archivo(archivo))]})
    except Exception as e:
        print("  (no se pudo anotar en el registro:", type(e).__name__, e, ")")
    ultimo = None
    for p in c.leer(150):
        visto = c.visto
        est = (visto.get("gcode_state"), visto.get("print_error"), visto.get("stg_cur"))
        if est != ultimo:
            print("  impresora:", {"estado": est[0], "error": est[1], "etapa": est[2],
                                   "respuesta": p.get("result"), "motivo": p.get("reason")})
            ultimo = est
    c.cerrar()
    return 0 if c.visto.get("gcode_state") in ("PREPARE", "RUNNING", "SLICING") else 1


def asegurar_ip(d):
    """La camara (6000) y la subida (990) tambien reciben el codigo de acceso: se abren solo en una direccion cuyo
    certificado del 8883 ya trajo la serie en este proceso. Si no contesta, la busca (ubicar)."""
    if d.get("_verificada") and d.get("_verificada") == d.get("ip"):
        return
    try:
        tls(d.get("ip"), serie=d["serie"], timeout=4).close()
    except SinConexion as e:
        print(e.texto, "La busco en la red por su numero de serie...", flush=True)
        ubicar(d)
    d["_verificada"] = d["ip"]


def foto(salida, d=None):
    """Saca UNA foto de la camara de la impresora (puerto 6000, el mismo flujo que usan A1/P1)."""
    d = d or cargar_datos()
    if not d.get("codigo_acceso"):
        raise FallaImpresora(f"Falta el codigo de acceso en {d.get('_origen', DATOS)}: lo escribe Fak con --pedir-codigo.")
    asegurar_ip(d)
    s = tls(d["ip"], PUERTO_CAMARA, timeout=10)
    try:
        auth = struct.pack("<IIII", 0x40, 0x3000, 0, 0)
        auth += "bblp".encode().ljust(32, b"\x00") + d["codigo_acceso"].encode().ljust(32, b"\x00")
        s.sendall(auth)
        s.settimeout(10)
        fin = time.time() + 20
        while time.time() < fin:
            cab = _leer(s, 16)
            largo = struct.unpack("<I", cab[:4])[0]
            if not 0 < largo < 5_000_000:
                raise FallaImpresora(f"la camara contesto algo que no es una foto (largo {largo})")
            img = _leer(s, largo)
            if img[:2] == b"\xff\xd8" and img[-2:] == b"\xff\xd9":
                with open(salida, "wb") as f:
                    f.write(img)
                print("foto guardada:", salida, f"({len(img)/1000:.0f} KB)")
                return 0
    except (OSError, ConnectionError):
        raise SinConexion("La camara de la impresora no contesto (se corto la conexion).") from None
    finally:
        s.close()
    print("no llego ninguna foto en 20 s")
    return 1


def leer_estado(d, segundos=6):
    """El estado completo de la impresora (sale apenas llega el informe completo, o a los `segundos`)."""
    with Conexion(d) as c:
        c.leer(segundos, hasta=_informe_completo)
        d["_verificada"] = d.get("ip")
        return c.visto


def orden_simple(comando):
    """pause / resume / stop."""
    d = cargar_datos()
    with Conexion(d) as c:
        c.publicar({"print": {"sequence_id": "20010", "command": comando, "param": ""}})
        res = None
        for p in c.leer(12, hasta=lambda v, p: p.get("command") == comando):
            if p.get("command") == comando:
                res = p.get("result")
    print(f"orden '{comando}' mandada {time.strftime('%H:%M:%S')} | respuesta: {res}")
    return 0 if res == "success" else 1


VELOCIDADES = {1: "silencioso", 2: "estandar", 3: "deportivo", 4: "ridiculo (el mas rapido)"}


def velocidad(nivel):
    """Cambia el modo de velocidad de la impresion en curso (1 a 4) y confirma leyendo el estado."""
    d = cargar_datos()
    antes = leer_estado(d, 4).get("spd_lvl")
    if nivel is None:
        print(f"velocidad actual: {antes} = {VELOCIDADES.get(antes, '?')}")
        return 0
    with Conexion(d) as c:
        c.publicar({"print": {"sequence_id": "20011", "command": "print_speed", "param": str(nivel)}})
    time.sleep(3)
    ahora = leer_estado(d, 5).get("spd_lvl")
    print(f"velocidad: {antes} ({VELOCIDADES.get(antes, '?')}) -> pedida {nivel} -> la impresora informa "
          f"{ahora} ({VELOCIDADES.get(ahora, '?')})")
    return 0 if ahora == nivel else 1


def objetos_del_archivo(archivo):
    """[(id, nombre)] de los objetos de un .gcode.3mf, y si el archivo permite saltearlos."""
    import zipfile
    txt = zipfile.ZipFile(archivo).read("Metadata/slice_info.config").decode("utf-8", "replace")
    permite = 'key="label_object_enabled" value="true"' in txt
    objs = [(int(i), n) for i, n in re.findall(r'<object identify_id="(\d+)" name="([^"]*)"', txt)]
    return permite, objs


def saltear(archivo, ids, aplicar):
    """Le dice a la impresora que deje de imprimir esos objetos y siga con los demas. No se deshace."""
    permite, objs = objetos_del_archivo(archivo)
    print("objetos del archivo:", {i: n for i, n in objs}, "| permite saltear:", permite)
    if ids is None:
        return 0
    if not permite:
        print("NO SE PUEDE: el archivo tiene un solo objeto o se lamino sin identificar los objetos")
        return 1
    malos = [i for i in ids if i not in dict(objs)]
    if malos:
        print("NO SE MANDA: esos numeros no son objetos de este archivo:", malos)
        return 1
    if len(ids) >= len(objs):
        print("NO SE MANDA: saltear todos los objetos es cancelar; para eso esta --cancelar")
        return 1
    print("PLAN: dejar de imprimir", {i: dict(objs)[i] for i in ids}, "y seguir con el resto")
    if not aplicar:
        print("      (sin --apply no se manda nada)")
        return 0
    d = cargar_datos()
    with Conexion(d) as c:
        c.publicar({"print": {"sequence_id": "20013", "command": "skip_objects", "obj_list": list(ids)}})
        res = None
        for p in c.leer(12, hasta=lambda v, p: p.get("command") == "skip_objects"):
            if p.get("command") == "skip_objects":
                res = p.get("result")
    print(f"orden de saltear mandada {time.strftime('%H:%M:%S')} | respuesta: {res}")
    return 0 if res == "success" else 1


def esperar_enfriar(tope=35.0, maximo_min=45):
    """Espera a que la placa baje de `tope` grados y sale (salida 0 = ya se puede retirar la pieza).

    Bambu: sacar la pieza con la placa fria (wiki de la A2L: "wait for the heatbed and model to cool
    to room temperature"; ficha de la placa texturada: 35 C o menos). Corre en segundo plano: su
    salida avisa. Sale con 1 si en `maximo_min` minutos no bajo, y con 12 si no encuentra la impresora
    (antes daba 45 minutos de «sin respuesta» y salia con 1, como si la placa no se hubiera enfriado).
    """
    d = cargar_datos()
    t0 = time.time()
    while time.time() - t0 < maximo_min * 60:
        v = leer_estado(d, 4)          # sin conexion: conectar() ya la busco; si no esta, SinConexion -> 12
        cama = float(v.get("bed_temper", 99))
        print(f"{time.strftime('%H:%M:%S')} placa {cama:.0f} C (objetivo {v.get('bed_target_temper')}) "
              f"estado {v.get('gcode_state')}", flush=True)
        if cama <= tope and v.get("gcode_state") in ("FINISH", "FAILED", "IDLE"):
            print(f"YA SE PUEDE RETIRAR: placa a {cama:.0f} C")
            return 0
        time.sleep(60)
    print(f"la placa no bajo de {tope:.0f} C en {maximo_min} minutos")
    return 1


AMBIENTE_MIN, AMBIENTE_MAX = 15.0, 30.0     # wiki oficial de la A2L (a2l-faq): 15 a 30 C, humedad < 85 %
PLANTA = (-34.59, -58.64)                   # Hurlingham; la impresora no esta en un lugar climatizado


def ambiente(minutos_de_impresion=0):
    """Temperatura del lugar y si conviene imprimir. Devuelve (lineas para mostrar, avisos).

    Dos fuentes, y se dice cual es cada una:
    - LA IMPRESORA FRIA: si esta libre, con la placa apagada y la boquilla y la placa a menos de 2 C
      una de otra, esas dos lecturas SON la temperatura del lugar (el 13/10/2026 a la manana: 16,5 y 17).
    - EL PRONOSTICO de afuera (open-meteo, sin clave) para las horas que dura la impresion: Fak dice
      que adentro y afuera varian poco porque de noche se apaga todo.
    """
    import urllib.request
    lin, avisos = [], []
    adentro_ok = False
    try:
        v = leer_estado(cargar_datos(), 4)
        adentro_ok = True
        cama, boq = float(v.get("bed_temper", 99)), float(v.get("nozzle_temper", 99))
        fria = (v.get("gcode_state") in ("IDLE", "FINISH", "FAILED") and not float(v.get("bed_target_temper", 0))
                and abs(cama - boq) < 2 and cama < 40)
        if fria:
            lin.append(f"adentro, medido por la impresora en frio: {min(cama, boq):.1f} C")
            if not AMBIENTE_MIN <= min(cama, boq) <= AMBIENTE_MAX:
                avisos.append(f"el lugar esta a {min(cama, boq):.1f} C, fuera de lo que pide Bambu "
                              f"({AMBIENTE_MIN:.0f} a {AMBIENTE_MAX:.0f} C)")
        else:
            lin.append(f"adentro: no se puede medir ahora (la impresora esta caliente o trabajando: "
                       f"placa {cama:.0f} C, boquilla {boq:.0f} C)")
    except FallaImpresora as e:
        lin.append(f"adentro: sin lectura ({e.texto})")
    except Exception as e:
        lin.append(f"adentro: sin lectura ({type(e).__name__})")
    try:
        if os.environ.get("BAMBU_SIN_INTERNET") == "1":
            raise OSError("pruebas: sin internet")
        horas = max(1, int(minutos_de_impresion // 60) + 2)
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={PLANTA[0]}&longitude={PLANTA[1]}"
               f"&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m&forecast_hours={horas}"
               "&timezone=America%2FArgentina%2FBuenos_Aires")
        d = json.loads(urllib.request.urlopen(url, timeout=15).read())
        t = d["hourly"]["temperature_2m"]
        lin.append(f"afuera ahora: {d['current']['temperature_2m']} C, humedad {d['current']['relative_humidity_2m']} % "
                   f"| proximas {horas} h: de {min(t)} a {max(t)} C")
        if min(t) < AMBIENTE_MIN or max(t) > AMBIENTE_MAX:
            avisos.append(f"mientras dure la impresion el pronostico de afuera va de {min(t)} a {max(t)} C; "
                          f"Bambu pide {AMBIENTE_MIN:.0f} a {AMBIENTE_MAX:.0f} C")
        if d["current"]["relative_humidity_2m"] >= 85:
            avisos.append(f"humedad {d['current']['relative_humidity_2m']} %: Bambu pide menos de 85 %")
    except Exception as e:
        lin.append(f"afuera: sin pronostico ({type(e).__name__})")
    ambiente.adentro_ok = adentro_ok
    return lin, avisos


def luz(modo):
    """Prende o apaga la luz de la impresora ('on' / 'off') y confirma leyendo el estado."""
    d = cargar_datos()

    def leer_luz():
        rep = leer_estado(d, 4).get("lights_report") or []
        return {x.get("node"): x.get("mode") for x in rep}
    antes = leer_luz()
    if modo is None:
        print("luces:", antes)
        return 0
    with Conexion(d) as c:
        c.publicar({"system": {"sequence_id": "20012", "command": "ledctrl", "led_node": "chamber_light",
                               "led_mode": modo, "led_on_time": 500, "led_off_time": 500,
                               "loop_times": 0, "interval_time": 0}})
    time.sleep(3)
    ahora = leer_luz()
    print(f"luz: {antes.get('chamber_light')} -> pedida {modo} -> la impresora informa {ahora.get('chamber_light')}")
    return 0 if ahora.get("chamber_light") == modo else 1


def cerrar_en_registro(est, v):
    """Anota el final de la ultima impresion enviada que no tenga cierre (tiempo real y avance)."""
    try:
        import datetime
        import registro
        ev = registro.leer()
        cerradas = {e["trabajo_id"] for e in ev if e.get("tipo") in ("terminada", "fallida", "cancelada")}
        abiertas = [e for e in ev if e.get("tipo") == "enviada" and e["trabajo_id"] not in cerradas]
        if not abiertas:
            return
        e = abiertas[-1]
        t0 = registro.fecha(e["cuando"])
        registro.anotar({"tipo": "terminada" if est == "FINISH" else "fallida", "trabajo_id": e["trabajo_id"],
                         "minutos_reales": round((registro.ahora() - t0).total_seconds() / 60, 1),
                         "avance_pct": v.get("mc_percent", 100 if est == "FINISH" else 0),
                         "capa": v.get("layer_num"), "error": v.get("print_error")})
    except (Exception, SystemExit) as ex:
        print("  (no se pudo cerrar en el registro:", type(ex).__name__, ex, ")")


PY_DETECTOR = Path(r"C:\Dev\_printguard\.venv\Scripts\python.exe")
RECORTE_PLACA = "200,0,1300,460"      # zona de la placa en la foto de la A2L (1536 x 1080)
# Cuantas lecturas altas SEGUIDAS hacen falta para avisar. Medido el 13/10/2026 en dos impresiones:
# en un cambio de color la cama se va atras y la pieza sale del cuadro; eso da 1 o 2 lecturas altas
# seguidas (0,72 y 0,82; 0,64 y 0,66) y nunca 3. Con 3 no hubo ninguna falsa alarma en 60 lecturas
# de un solo color ni en 20 con 12 cambios de color. Costo: una falla real se avisa ~4 min despues.
SEGUIDAS = 3
UMBRAL_DETECTOR = 0.45                # distancia a "pieza sana"; sana medida el 13/10/2026: 0,23 a 0,27


def medir_foto(ruta):
    """Saca una foto y devuelve las distancias del detector ({'success':..,'failure':..}) o None."""
    import subprocess
    try:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        foto(str(ruta))
        r = subprocess.run([str(PY_DETECTOR), str(Path(__file__).with_name("detector_fallas.py")),
                            str(ruta), "--recorte", RECORTE_PLACA], capture_output=True, text=True, timeout=60)
        m = re.search(r"\{.*\}", r.stdout.splitlines()[-1]) if r.stdout.strip() else None
        return json.loads(m.group(0)) if m else None
    except (Exception, SystemExit):          # la camara o el detector no tiran abajo la vigilancia; Ctrl+C si
        return None


def seguir(carpeta, cada=60, fotos_en=(), despertar_min=0, detector=False, solo_medir=False):
    """Vigila la impresion hasta que termina. SOLO LEE (estado + camara).

    Sale con 0 si termino bien (FINISH), 1 si fallo o se cancelo (FAILED), 2 si quedo en pausa
    o con una alarma (hms / print_error), 3 si dejo de avanzar 15 minutos. Deja en <carpeta>
    seguimiento.log y fotos: capa 1, las capas pedidas, una cada 15 minutos y la final.
    """
    d = cargar_datos()
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    log = open(carpeta / "seguimiento.log", "a", encoding="utf-8")
    hechas, ult_foto, ult_avance, ult_clave = set(), 0.0, time.time(), None
    t0 = time.time()
    historial = []
    # El seguimiento se relanza cada pocos minutos: las lecturas validas anteriores se recuperan del
    # log, o la base y la regla de "tres seguidas" arrancarian de cero en cada relanzada y la alarma
    # no podria saltar nunca (visto el 13/10/2026 en la prueba de las tres fichas).
    if (carpeta / "seguimiento.log").exists():
        for ren in (carpeta / "seguimiento.log").read_text(encoding="utf-8").splitlines():
            m_ = re.search(r"detector exito ([\d.]+) falla [\d.]+$", ren)
            if m_:
                historial.append(float(m_.group(1)))
    # las capas ya fotografiadas en una corrida anterior no se repiten (se relanza cada N minutos)
    for f in carpeta.glob("*_capa*.jpg"):
        try:
            hechas.add(int(f.stem.split("capa")[1]))
        except ValueError:
            pass

    def sacar(nombre):
        try:
            foto(str(carpeta / f"{time.strftime('%H%M')}_{nombre}.jpg"))
        except BaseException as e:               # la camara no puede tirar abajo el seguimiento
            print("  (sin foto:", type(e).__name__, ")")

    while True:
        try:
            v = leer_estado(d)
        except BaseException as e:
            v = {}
            print(time.strftime("%H:%M:%S"), "sin respuesta de la impresora:", type(e).__name__)
        est, capa, tot = v.get("gcode_state"), v.get("layer_num"), v.get("total_layer_num")
        linea = (f"{time.strftime('%H:%M:%S')} {est} etapa {v.get('stg_cur')} capa {capa}/{tot} "
                 f"{v.get('mc_percent')} % faltan {v.get('mc_remaining_time')} min "
                 f"filamento {(v.get('ams') or {}).get('tray_now')} error {v.get('print_error')} hms {v.get('hms')}")
        # filtro barato (sin tokens): una foto por vuelta pasada por el modelo de PrintGuard
        if detector and est == "RUNNING":
            dd = medir_foto(carpeta / "por_minuto" / f"{time.strftime('%H%M%S')}.jpg")
            # Una foto sacada durante un cambio de filamento NO cuenta: la cama se va para atras y la
            # escena cambia (13/10/2026: notas de 23, 32 y 54 sobre 100 con la pieza sana, las tres en
            # cambios de color). Se relee el estado justo despues de la foto: si antes o despues la
            # impresora no estaba imprimiendo (etapa distinta de 0), la lectura se anota y se descarta.
            def cambiando(e_):
                """True si la impresora esta en un cambio de filamento (aunque la etapa diga 0)."""
                a_ = e_.get("ams") or {}
                # Solo la etapa. Se probo sumar lo que informa el cargador (ams_status, tray_tar) y no
                # separa: 263 aparece con la pieza sana a la vista y 768 con la cama corrida. Queda
                # anotado en la linea para seguir juntando datos.
                return e_.get("stg_cur") != 0 or a_ is None
            try:
                v2 = leer_estado(d, 3)
                despues = v2.get("stg_cur")
            except BaseException:
                v2, despues = {"stg_cur": None}, None
            linea += (f" [ams {v.get('ams_status')}/{v2.get('ams_status')} "
                      f"obj {(v.get('ams') or {}).get('tray_tar')}/{(v2.get('ams') or {}).get('tray_tar')}]")
            if dd and (cambiando(v) or cambiando(v2)):
                linea += (f" | detector exito {dd['success']:.3f} falla {dd['failure']:.3f} "
                          f"(NO CUENTA: etapa {v.get('stg_cur')}->{despues})")
                dd = None
            if dd:
                linea += f" | detector exito {dd['success']:.3f} falla {dd['failure']:.3f}"
                historial.append(dd["success"])
                base = sorted(historial[:8])[len(historial[:8]) // 2]       # mediana de las primeras 8
                # alarma: dos fotos seguidas con la distancia a "pieza sana" bien por encima de la base
                if (not solo_medir and len(historial) >= 9
                        and all(x > max(UMBRAL_DETECTOR, base * 1.8) for x in historial[-SEGUIDAS:])):
                    print(linea, flush=True)
                    log.write(linea + " | ALARMA DEL DETECTOR\n")
                    log.flush()
                    sacar("DETECTOR")
                    return 11
        print(linea, flush=True)
        log.write(linea + "\n")
        log.flush()
        clave = (est, capa, v.get("stg_cur"), v.get("mc_percent"))
        if clave != ult_clave:
            ult_clave, ult_avance = clave, time.time()
        if isinstance(capa, int):
            for c in (1,) + tuple(fotos_en):
                if capa >= c and c not in hechas:
                    hechas.add(c)
                    sacar(f"capa{c:03d}")
                    ult_foto = time.time()
        if time.time() - ult_foto > 900 and est == "RUNNING":
            sacar("avance")
            ult_foto = time.time()
        if est in ("FINISH", "FAILED"):
            sacar("FINAL" if est == "FINISH" else "FALLO")
            cerrar_en_registro(est, v)
            return 0 if est == "FINISH" else 1
        if est == "PAUSE" or v.get("hms") or v.get("print_error"):
            sacar("ALARMA")
            return 2
        if time.time() - ult_avance > 900:
            sacar("QUIETA")
            return 3
        if despertar_min and time.time() - t0 > despertar_min * 60:
            sacar("REVISION")              # salida 10 = "mirá esta foto y relanzame"
            return 10
        time.sleep(cada)


def pedir_codigo():
    """Ventanita para que FAK escriba el codigo de acceso. Se guarda en el archivo de datos y no se imprime."""
    import tkinter as tk
    from tkinter import simpledialog
    d = cargar_datos()
    raiz = tk.Tk()
    raiz.withdraw()
    raiz.attributes("-topmost", True)
    cod = simpledialog.askstring("Impresora Bambu", "Escribi el CODIGO DE ACCESO que muestra la pantalla\n"
                                 "de la impresora (8 caracteres) y apreta Enter:", parent=raiz)
    raiz.destroy()
    if not cod or not cod.strip():
        print("no se escribio nada")
        return 1
    d["codigo_acceso"] = cod.strip()
    _escribir_json(DATOS, d)
    print("codigo guardado (largo %d)" % len(cod.strip()))
    return 0


def _valor(argv, opcion, tipo=str, defecto=None):
    """El valor que sigue a `opcion` en la linea de comandos (o `defecto`)."""
    if opcion not in argv:
        return defecto
    i = argv.index(opcion) + 1
    if i >= len(argv):
        raise FallaImpresora(f"a {opcion} le falta el valor")
    try:
        return tipo(argv[i])
    except ValueError:
        raise FallaImpresora(f"{opcion} {argv[i]}: no es un valor valido") from None


def _numeros(texto, opcion):
    try:
        return [int(x) for x in str(texto).split(",") if x.strip()]
    except ValueError:
        raise FallaImpresora(f"{opcion} {texto}: van numeros separados por coma") from None


def despachar(argv):
    a = argv[1] if len(argv) >= 2 else ""
    if a == "--pedir-codigo":
        return pedir_codigo()
    if a == "--preparar" and len(argv) >= 3:
        return preparar(argv[2])
    if a == "--estado":
        return estado()
    if a == "--saltear" and len(argv) >= 3:
        # --saltear <archivo.gcode.3mf>            lista los objetos
        # --saltear <archivo.gcode.3mf> 12[,15]    plan;  con --apply lo manda
        ids = _numeros(argv[3], "--saltear") if len(argv) >= 4 and argv[3][:1].isdigit() else None
        return saltear(argv[2], ids, "--apply" in argv)
    if a == "--ambiente":
        # --ambiente [minutos que dura la impresion]   -> 2 si hay un aviso, 12 si la impresora no contesto
        lin_, av_ = ambiente(float(argv[2]) if len(argv) >= 3 else 0)
        for x in lin_:
            print(" ", x)
        for x in av_:
            print("  AVISO:", x)
        return 2 if av_ else (0 if getattr(ambiente, "adentro_ok", False) else SALIDA_SIN_CONEXION)
    if a == "--avisar-retiro":
        return esperar_enfriar()
    if a == "--luz":
        return luz(argv[2] if len(argv) >= 3 else None)      # --luz | --luz on | --luz off
    if a == "--velocidad":
        # --velocidad        muestra la actual;   --velocidad 1|2|3|4   la cambia
        return velocidad(_valor(argv, "--velocidad", int) if len(argv) >= 3 else None)
    if a == "--foto" and len(argv) >= 3:
        return foto(argv[2])
    if a == "--seguir" and len(argv) >= 3:
        # --seguir <carpeta> [--fotos-en 41,44] [--despertar N] [--cada S] [--detector | --solo-medir]
        capas = tuple(_numeros(_valor(argv, "--fotos-en"), "--fotos-en")) if "--fotos-en" in argv else ()
        return seguir(argv[2], cada=_valor(argv, "--cada", int, 60), fotos_en=capas,
                      despertar_min=_valor(argv, "--despertar", int, 0),
                      detector="--detector" in argv or "--solo-medir" in argv,
                      solo_medir="--solo-medir" in argv)
    if a in ("--pausar", "--reanudar", "--cancelar"):
        return orden_simple({"--pausar": "pause", "--reanudar": "resume", "--cancelar": "stop"}[a])
    if a == "--imprimir" and len(argv) >= 3:
        # --mapa 0,1 : filamento 1 del archivo -> lugar 1 del cargador, filamento 2 -> lugar 2
        mapa = _numeros(_valor(argv, "--mapa"), "--mapa") if "--mapa" in argv else None
        return imprimir(argv[2], mapa, "--apply" in argv)
    if a == "--version":
        print("skill impresion-3d-bambu, version", VERSION)
        return 0
    print(__doc__)
    return 0 if a in ("", "-h", "--help", "--ayuda") else 1


def main(argv=None):
    """Toda falla termina en un renglon en castellano y su codigo de salida: nunca un error de Python."""
    for f in (sys.stdout, sys.stderr):
        try:
            f.reconfigure(errors="replace")      # en Windows, con la salida a un archivo, una flecha tumbaba el print
        except (AttributeError, ValueError):
            pass
    try:
        return despachar(list(sys.argv if argv is None else argv))
    except KeyboardInterrupt:
        print("cortado a mano (Ctrl+C)")
        return 130
    except FallaImpresora as e:
        print(e.texto, flush=True)
        return e.salida
    except SystemExit as e:
        if isinstance(e.code, str):
            print(e.code)
            return 1
        return e.code or 0
    except Exception as e:
        print(f"No se pudo: {type(e).__name__}: {e}. No es un problema de la impresora: avisar a Fak con este renglon.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
