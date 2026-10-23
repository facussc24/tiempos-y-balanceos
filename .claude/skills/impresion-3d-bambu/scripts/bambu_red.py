"""Hablarle a la Bambu Lab A2L por la red local (modo desarrollador), sin librerias de terceros.

Uso (python del sistema):
  bambu_red.py --preparar 192.168.1.198     arma el archivo de datos (IP y numero de serie; el codigo
                                            de acceso lo escribe Fak a mano, este script NUNCA lo muestra)
  bambu_red.py --estado                     SOLO LEE: estado, temperaturas y filamentos cargados
  bambu_red.py --imprimir <x.gcode.3mf> [--mapa 0,1] [--apply] [--sin-margen] [--en-seco]
               [--sin-detector --acepto "<frase de Fak>"]
                                            plan; con --apply sube, manda y LANZA SOLA la vigilancia con el detector
                                            (proceso aparte); --en-seco arma todo y no habla con la impresora
  bambu_red.py --seguir <carpeta> [--fotos-en 3,10] [--despertar 5] [--cada 30] [--buscar] [--en-pausa]
               [--solo-medir | --sin-detector --acepto "<frase de Fak>"]   el detector va prendido por defecto
  bambu_red.py --foto x.jpg | --pausar | --reanudar | --cancelar | --velocidad [1-4] | --luz [on|off]
  bambu_red.py --saltear <x.gcode.3mf> [12,15] [--apply] | --ambiente [min] | --avisar-retiro
  bambu_red.py --ficha <carpeta> | --selftest | --version | --pedir-codigo

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
from datetime import timedelta
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
    """Escribe entero o nada: primero a un archivo de al lado y despues lo reemplaza (un corte a mitad de la escritura
    dejaba el archivo de datos cortado y la PC sin datos: revision 16/10)."""
    ruta_de_prueba_ok(ruta)
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tmp = ruta.with_name(ruta.name + ".escribiendo")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({k: v for k, v in d.items() if not k.startswith("_")}, f, indent=1)
    os.replace(tmp, ruta)


def cargar_datos():
    """Datos de la impresora: primero los de esta PC; si no estan, los de la nube de Ingenieria.
    La IP es una PISTA (ubicar() la comprueba con el numero de serie); la serie y el codigo, no."""
    malos = []
    for ruta in (DATOS, DATOS_NUBE):
        if ruta.exists():
            try:
                d = json.loads(ruta.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                # uno roto no deja a la PC sin datos si la otra copia esta sana (revision 16/10)
                malos.append(f"{ruta} ({type(e).__name__})")
                continue
            if isinstance(d, dict) and d.get("serie"):
                d["serie"] = str(d["serie"]).strip().upper()     # escrita a mano en minuscula o con un espacio
                d["_origen"] = str(ruta)
                if malos:
                    print(f"  (no pude leer {malos[0]}; uso la otra copia: {ruta})", flush=True)
                if ruta != DATOS:              # datos de la nube: la direccion que encontro esta PC le gana
                    try:
                        p = json.loads(_pista_ip().read_text(encoding="utf-8"))
                        if p.get("serie") == d["serie"] and p.get("ip"):
                            d["ip"] = p["ip"]
                    except (OSError, ValueError):
                        pass
                return d
    if malos:
        raise FallaImpresora(f"No puedo leer el archivo de datos {' ni '.join(malos)}: si OneDrive lo esta bajando, "
                             "esperar un minuto; si esta roto, avisar a Fak")
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
        if vista.strip().upper() != str(serie).strip().upper():      # escrita a mano en minuscula o con un espacio
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
    if not serie:
        # sin serie el archivo no sirve y la proxima vez --preparar se niega a pisarlo: un circulo sin salida (revision 16/10)
        raise SinConexion(f"En {ip} contestó un equipo cuyo certificado no trae un número de serie de Bambu: no es la "
                          "impresora (o no es su dirección). No escribí nada; mirá la dirección en su pantalla, Ajustes > WLAN.")
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
        except OSError as e:
            avisos.append(f"no pude abrir el puerto {puerto}: {e.strerror or e}")
            continue
        try:
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
            s.close()                                   # el que no se pudo usar se cierra
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

    def probar(ip, timeout, forzar=False):
        """`forzar`: el anuncio y la MAC son pistas fuertes; una direccion que fallo una vez (un corte de 3 s) se
        vuelve a probar si una de ellas la nombra (revision 16/10)."""
        if not isinstance(ip, str) or not ip or (ip in probadas and not forzar):
            return False
        probadas.add(ip)
        try:
            tls(ip, serie=serie, timeout=timeout).close()
            return True
        except OtraImpresora as e:
            print(f"  {e.texto} Sigo buscando.", flush=True)
        except (SinConexion, TypeError, ValueError):
            pass                                     # una direccion mal escrita en el registro no corta la busqueda
        return False

    prueba = [x.strip() for x in os.environ.get("BAMBU_BUSCAR_EN", "").split(",") if x.strip()]
    pasos = [("la direccion del archivo", lambda: [vieja], 3, False),
             ("las que anotaron las otras PC", _ips_del_registro, 2, False)]
    if prueba:
        pasos.append(("las direcciones de prueba", lambda: prueba, 2, False))
    else:
        pasos += [("el anuncio de la impresora en la red", lambda: _ips_por_anuncio(serie), 3, True),
                  ("la placa de red (MAC)", lambda: _ips_por_mac(d.get("mac")), 3, True),
                  ("el recorrido de la red", lambda: _ips_de_la_red(probadas), 2, False)]
    encontrada, por = None, None
    for nombre, fuente, t, forzar in pasos:
        try:
            cand = [x for x in (fuente() or []) if x]
        except Exception as e:
            print(f"  {nombre}: no se pudo ({type(e).__name__}: {e})", flush=True)
            cand = []
        encontrada = next((ip for ip in cand if probar(ip, t, forzar)), None)
        if encontrada:
            por = nombre
            break
    if not encontrada:
        texto = ("No encuentro la impresora en la red (probé " + ", ".join(p[0] for p in pasos) + "): "
                 "¿está prendida y en la wifi barack_Oficinas_PA? Mirá en su pantalla Ajustes > WLAN.")
        if not prueba and _pc_sin_red():
            texto = ("Puede ser esta PC: no le contesta el router (o el router no contesta ping). Revisá el wifi de esta "
                     "PC y mirá la pantalla de la impresora: si sigue con luz, imprime sola (el archivo está en su tarjeta).")
        raise SinConexion(texto)
    if encontrada != vieja:
        d["ip"] = encontrada
        if guardar:
            try:
                donde = _guardar_ip(d, vieja, encontrada)
            except (OSError, ValueError, FallaImpresora) as e:
                donde = f"NO se pudo corregir el archivo ({type(e).__name__}: {e}); esta vez se usa la direccion nueva igual"
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
        self.ult_informe = None              # el ultimo INFORME ('print'); un PINGRESP no cuenta como informe
        self.ult_pushall = 0.0
        self.tema = f"device/{d['serie']}/request"
        try:
            suscribir(self.s, f"device/{d['serie']}/report")
            self.pushall()
        except (OSError, SinConexion):
            self.cerrar()
            raise SinConexion("La impresora cortó la conexión al suscribirse.") from None

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
            listo = False
            # se procesan TODOS los paquetes ya recibidos antes de volver: si se volviera en el que cumple `hasta`, los
            # que vienen detras (ya sacados del buffer) se perderian (revision 16/10)
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
                    self.ult_informe = time.time()
                    fusionar(self.visto, p)
                    nuevos.append(p)
                    if hasta and hasta(self.visto, p):
                        listo = True
            if listo:
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
        print("conecto (el certificado trae su numero de serie) pero no llego ningun informe en 8 s: probá de nuevo; "
              "si se repite, mirá la pantalla de la impresora")
        return 1
    conciliar(visto)
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

    asegurar_ip(d)                     # el codigo de acceso viaja en el login: solo a la impresora comprobada
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    total, subido, ult_aviso = Path(archivo).stat().st_size, 0, time.time()
    try:
        f = FTPSImplicito(context=ctx)
        f.connect(d["ip"], PUERTO_FTP)
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
                subido += len(blo)
                if time.time() - ult_aviso > 15:       # que se vea que avanza (una subida de 20 MB tarda ~2 min)
                    print(f"  subidos {subido / 1e6:.0f} de {total / 1e6:.0f} MB", flush=True)
                    ult_aviso = time.time()
    except ftplib.error_perm as e:
        raise FallaImpresora(f"La impresora no aceptó el archivo ({str(e)[:80]}): ¿tiene la tarjeta MicroSD puesta?") from None
    except (OSError, EOFError, ftplib.Error) as e:
        raise SinConexion(f"Se cortó la subida del archivo a la impresora ({type(e).__name__}): no se mandó "
                          "ninguna orden de imprimir.") from None
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


def chips_del_cargador(estado_):
    """{lugar 0-3: numero de chip (tag_uid) del rollo} de lo que informa la impresora."""
    out = {}
    for unidad in (estado_.get("ams") or {}).get("ams", []):
        for t in unidad.get("tray", []):
            uid = t.get("tag_uid")
            if uid and set(uid) != {"0"}:
                out[int(t["id"])] = uid
    return out


def rollos_del_cargador(estado_):
    """{lugar 0-3: con que nombre se le lleva la cuenta al rollo}: su chip o, si la impresora no leyo ningun chip
    (rollo cargado a mano en la pantalla), SIN-CHIP-L<n> por el lugar. Fak, 16/10/2026: «si llega a fallar el chip
    deberiamos usarlo igual»; el 16/10 el lugar 4 tenia un PLA Lite negro cargado a mano, sin chip."""
    import registro
    chips = chips_del_cargador(estado_)
    return {n: chips.get(n) or registro.sin_chip(n + 1) for n in lugares_del_cargador(estado_)}


def _dist_color(c1, c2):
    try:
        a_, b_ = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (c1, c2))
        return sum((x - y) ** 2 for x, y in zip(a_, b_)) ** 0.5
    except (TypeError, ValueError, IndexError):
        return 999.0


def _restantes_del_registro(chip):
    import registro
    return registro.gramos_restantes(chip) if chip else None


def mapa_automatico(archivo, estado_, restantes=None):
    """Elige el lugar del cargador para cada filamento del archivo: MISMO material (perfil GFAxx) y el color mas
    parecido. Entre dos rollos iguales (mismo material y color) elige EL MAS GASTADO segun el registro (idea de
    bambuddy): asi el viejo se termina primero y el respaldo automatico pasa al nuevo. Devuelve (mapa, renglones
    para mostrar, fallas)."""
    restantes = restantes or _restantes_del_registro
    lug, chips = lugares_del_cargador(estado_), rollos_del_cargador(estado_)
    mapa, ren, fallas, usados = [], [], [], set()
    for fid, perfil, tipo, color, gramos in filamentos_del_archivo(archivo):
        cand = sorted((_dist_color(color, c), n) for n, (pf, _, c) in lug.items() if pf == perfil and n not in usados)
        if not cand:
            hay = sorted({f"{nom} ({pf})" for pf, nom, _ in lug.values()})
            fallas.append(f"filamento {fid} del archivo es {tipo} perfil {perfil} y en el cargador hay {hay}: "
                          f"hay que laminarlo de nuevo con el material cargado")
            mapa.append(-1)
            continue
        dmin, n = cand[0]
        iguales = [x for dd, x in cand if dd <= dmin + 30 and lug[x][2] == lug[n][2]]
        if len(iguales) > 1:
            quedan = {x: restantes(chips.get(x)) for x in iguales}
            n = min(iguales, key=lambda x: (quedan[x] is None, quedan[x] if quedan[x] is not None else 0, x))
            cuanto = {x: (f"~{quedan[x]:.0f} g" if quedan[x] is not None else "sin chip") for x in iguales}
            ren.append(f"   (lugares {', '.join(str(x + 1) for x in sorted(iguales))} con el mismo rollo: elijo el {n + 1}, "
                       f"el mas gastado ({', '.join(f'lugar {x + 1} {cuanto[x]}' for x in sorted(iguales))}); "
                       "asi el viejo se termina primero)")
        usados.add(n)
        mapa.append(n)
        ren.append(f"filamento {fid} ({color}, {gramos} g) -> lugar {n + 1}: {lug[n][1]} {lug[n][2]}")
        if dmin > 120:
            fallas.append(f"filamento {fid}: el color del archivo {color} no se parece al del lugar {n + 1} "
                          f"{lug[n][2]} (distancia {dmin:.0f}): revisar que rollo hay puesto")
    return mapa, ren, fallas


# ---------------- frenos antes de mandar (16/10/2026) ----------------
# La skill decia «antes de mandar se miran los gramos» y el codigo no los miraba: el 15/10 se mandaron 78 g de noche
# con «quedan unos 98 g» y sin respaldo. Estos numeros son PROPUESTA SIN FUENTE (informe H2 §2.5): se ajustan con
# las primeras pesadas.
MARGEN_G, MARGEN_PCT = 30.0, 0.15      # margen por envio: las purgas y la linea de arranque no se cuentan
ROLLO_AVISO_G = 100.0                  # con menos: «pesalo» en cada envio
# Con menos y una pieza que termina de noche sin un rollo de respaldo igual: frena. Caso T8c del plan (80 g a las
# 23:00 frena); el §2.4 del plan decia 50 g: se tomo el mas estricto (contrato de autonomia, «la fila mas restrictiva»).
ROLLO_NOCHE_G = 100.0
NOCHE_DESDE = (20, 45)                 # desde ~20:45 se apagan las luces de la planta y la camara no ve (13 y 15/10)
NOCHE_HASTA = (8, 15)                  # la camara volvio a ver a las 08:18 del 14/10 (informe H2, fila 6)
OK_FAK_MINUTOS = 180                   # mas de 3 h (o que termine de noche): no se manda sin <archivo>.ok
FACTOR_TIEMPO = 1.02                   # en 11 impresiones el real quedo entre -10,9 % y +2,3 % del estimado (registro, 16/10)


def _ahora():
    import registro
    return registro.ahora()


def ajustes_del_archivo(archivo):
    """Del plate_1.gcode: minutos estimados, capas, gramos por filamento y los ajustes con que se lamino."""
    import zipfile
    with zipfile.ZipFile(archivo) as z:
        with z.open("Metadata/plate_1.gcode") as fh:
            txt = b""
            for blo in iter(lambda: fh.read(65536), b""):
                txt += blo
                if b"CONFIG_BLOCK_END" in txt or len(txt) > 4_000_000:
                    break
        try:
            info = z.read("Metadata/slice_info.config").decode("utf-8", "replace")
        except KeyError:
            info = ""
    txt = txt.decode("utf-8", "replace")
    m = re.search(r"total estimated time: (?:(\d+)d )?(?:(\d+)h )?(\d+)m", txt)
    minutos = (int(m.group(1) or 0) * 1440 + int(m.group(2) or 0) * 60 + int(m.group(3))) if m else None
    if minutos is None:
        # sin la cabecera de tiempo, la prediccion (en segundos) de slice_info.config; si tampoco esta, None (revision 16/10:
        # antes quedaba en 0 y la pieza no pedia el .ok ni contaba como de noche)
        p = re.search(r'key="prediction" value="(\d+)"', info)
        minutos = round(int(p.group(1)) / 60) if p else None
    capas = re.search(r"total layer number: (\d+)", txt)

    def clave(k):
        x = re.search(rf"^; {k} = (.*)$", txt, re.M)
        return x.group(1).strip() if x else None
    soportes = clave("enable_support")
    return {"minutos": minutos, "capas": int(capas.group(1)) if capas else None,
            "paredes": clave("wall_loops"), "relleno": clave("sparse_infill_density"),
            "capas_arriba": clave("top_shell_layers"), "capas_abajo": clave("bottom_shell_layers"),
            "borde": clave("brim_type"), "borde_mm": clave("brim_width"),
            "soportes": ("no" if soportes in ("0", None) else f"si ({clave('support_type')})")}


def _de_noche(inicio, fin):
    """Termina con la planta a oscuras: despues de las 20:45 o antes de las 08:15, o al dia siguiente. Las dos horas son
    las medidas: el 13/10 se apagaron las luces ~20:45 y la camara volvio a ver a las 08:18 del 14/10 (informe H2).
    Antes solo se miraba «despues de las 20:45 del dia de envio» y lo mandado de madrugada contaba como de dia."""
    hora = (fin.hour, fin.minute)
    return fin.date() > inicio.date() or hora >= NOCHE_DESDE or hora < NOCHE_HASTA


def freno_gramos(archivo, mapa, est, minutos, inicio, restantes=None):
    """(fallas, avisos) por lugar del cargador: los gramos del archivo contra lo que queda segun el registro, con
    margen max(30 g, 15 %). Los rollos IGUALES cargados en otros lugares que el trabajo no usa suman (el respaldo
    automatico pasa a ellos), con un aviso de que tiene que estar prendido."""
    import registro
    restantes = restantes or _restantes_del_registro
    lug, chips = lugares_del_cargador(est), rollos_del_cargador(est)
    fin = inicio + timedelta(minutes=(minutos or 0) * FACTOR_TIEMPO)
    noche = _de_noche(inicio, fin)
    usados = {m for m in mapa if m >= 0}
    pedidos = {}
    for (fid, perfil, tipo, color, g), m in zip(filamentos_del_archivo(archivo), mapa):
        if m >= 0:
            pedidos[m] = pedidos.get(m, 0.0) + float(g or 0)
    fallas, avisos = [], []
    for m, pide in sorted(pedidos.items()):
        nombre = registro.nombre_color(lug.get(m, ("", "", ""))[2])
        chip = chips.get(m)
        if not chip:
            fallas.append(f"el lugar {m + 1} no tiene ningún rollo según la impresora")
            continue
        if chip.startswith("SIN-CHIP"):
            # una vez que Fak dijo «el del lugar N es nuevo» (o se peso) no se lo vuelve a pedir
            anotado = registro.rollo(chip)["pesado"]
            avisos.append(f"el rollo del lugar {m + 1} no tiene chip: la cuenta va por el lugar (si lo cambian de lugar "
                          "se confunde)" + ("" if anotado else f"; si es nuevo, registro.py --rollo-nuevo {m + 1}"))
        quedan = restantes(chip)
        # un rollo IGUAL (mismo perfil y color) en otro lugar que el trabajo no usa es respaldo, tenga chip o no: la
        # impresora lo toma si esta configurado en la pantalla (wiki a2l/manual/screen-operation, AMS Filament Backup)
        iguales = [n for n, (pf, _, c) in lug.items()
                   if n != m and n not in usados and (pf, c) == (lug[m][0], lug[m][2]) and chips.get(n)]
        extra = sum(max(0.0, restantes(chips[n]) or 0) for n in iguales)
        margen = max(MARGEN_G, MARGEN_PCT * pide)
        if quedan - pide < margen:
            if iguales and quedan + extra - pide >= margen:
                avisos.append(f"el {nombre} del lugar {m + 1} no alcanza solo (pide {pide:.0f} g, quedan ~{quedan:.0f} g): "
                              f"cuenta con el rollo igual del lugar {iguales[0] + 1}. Tiene que estar prendido «AMS "
                              "Filament Backup» en la pantalla (Ajustes > Opciones AMS); si no, se pausa al terminarse")
            else:
                fallas.append(f"no alcanza el {nombre} (pide {pide:.0f} g, quedan ~{quedan:.0f} g, margen {margen:.0f} g)")
                continue
        if quedan < ROLLO_NOCHE_G and noche and not iguales:
            fallas.append(f"de noche con menos de {ROLLO_NOCHE_G:.0f} g y sin rollo de respaldo igual: el {nombre} del "
                          f"lugar {m + 1} tiene ~{quedan:.0f} g y la pieza termina a las {fin:%H:%M}")
        elif quedan < ROLLO_AVISO_G:
            avisos.append(f"al {nombre} del lugar {m + 1} le quedan ~{quedan:.0f} g según la cuenta: pesalo "
                          f"(registro.py --pesar {m + 1} <gramos de la balanza>)")
        if nombre == "negro" and not iguales:
            avisos.append("no hay un segundo negro igual cargado: el negro va siempre con respaldo (Fak, 16/10). "
                          "Solo avisa: no frena")
    return fallas, avisos


def placa_ocupada(est):
    """FINISH o FAILED = la placa tiene piezas hasta que alguien anote «placa_libre» despues de ese fin. Tambien la
    ocupa un trabajo que sigue ABIERTO en el registro (confirmado o de los viejos): uno que se perdio en un corte de
    luz deja la impresora en IDLE con restos en la placa, y uno que termino sin que nadie lo cierre todavia no tiene
    cierre (revision 16/10). Con IDLE y nada abierto pasa: alguien toco la pantalla."""
    import registro
    estado_ = est.get("gcode_state")
    if estado_ not in ("FINISH", "FAILED", "IDLE"):
        return None
    ev = registro.leer()
    libre = registro.placa_libre(ev)
    confirmadas = {e.get("trabajo_id") for e in ev if e.get("tipo") == "confirmada"}
    abiertos = [e for e in registro.abiertas(ev=ev)
                if e.get("estado") != "sin confirmar" or e.get("trabajo_id") in confirmadas]
    # con IDLE o FAILED la impresora no lo termino: corto en cualquier momento (corte de luz, falla), asi que vale un
    # «placa libre» anotado despues del ENVIO; el 85 % de su estimado es solo para lo que termino (FINISH: re-auditoria R2)
    desde = [registro.fin_mas_temprano(e) if estado_ == "FINISH" else registro._clave_tiempo(e) for e in abiertos]
    if estado_ != "IDLE":
        fin = registro.ultimo_fin(ev)
        desde += [fin] if fin else []
    if not desde or (libre and libre > max(desde)):
        return None
    if estado_ == "IDLE":
        return ("placa posiblemente ocupada: el registro tiene un trabajo sin cerrar ("
                + ", ".join(e.get("pieza") or e["trabajo_id"] for e in abiertos[:2])
                + ") y la impresora está libre: si se perdió (corte de luz), sacá lo que quedó y confirmalo con "
                  "registro.py --placa-libre")
    return ("placa ocupada: confirmá que la sacaste con registro.py --placa-libre (la impresora dice "
            f"{estado_} y no hay un «placa libre» anotado después de ese fin)")


def falta_ok_de_fak(archivo, minutos, inicio):
    """None si no hace falta o esta; si falta, el texto. El <archivo>.ok lo escribe la sesion con la frase textual de
    Fak y la fecha (el 13/10 la decision «esperar a Fak» vivia solo en el chat, se compacto y se mando igual)."""
    fin = inicio + timedelta(minutes=(minutos or 0) * FACTOR_TIEMPO)
    largo, noche = minutos is None or minutos > OK_FAK_MINUTOS, _de_noche(inicio, fin)
    if not (largo or noche):
        return None
    ok = Path(archivo).with_name(Path(archivo).name + ".ok")
    motivo = ("el archivo no dice cuánto tarda" if minutos is None else "pieza de más de 3 h" if largo
              else f"termina a las {fin:%H:%M}, con la planta a oscuras")
    try:
        hay = ok.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        hay = ""
    if not hay:
        return f"falta el OK de Fak en {ok} ({motivo}): la sesión lo escribe con la frase textual de Fak y la fecha"
    if ok.stat().st_mtime < Path(archivo).stat().st_mtime:
        return f"el OK de Fak ({ok.name}) es anterior al laminado: se relaminó después; hay que pedírselo de nuevo"
    return None


def ficha(archivo):
    """La ficha de la pieza (ficha.json en la carpeta del .gcode.3mf) o {}."""
    try:
        return json.loads((Path(archivo).parent / "ficha.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def anotar_envio_en_ficha(archivo, ajustes, gramos, trabajo_id, chips, lugares, frase=None):
    """La ficha de la pieza: nombre (las palabras de Fak = el nombre del archivo), archivo vigente, ajustes, gramos y
    minutos estimados y cada envio. --seguir la completa al cerrar. «descartado» lo escribe la sesion a mano."""
    import registro
    archivo = Path(archivo)
    f = ficha(archivo) or {"pieza": archivo.name.replace(".gcode.3mf", ""), "descartado": ""}
    f.update({"archivo_vigente": archivo.name, "ajustes": ajustes, "gramos": gramos,
              "minutos_estimados": ajustes.get("minutos"), "actualizada": registro.ahora_iso()})
    f.setdefault("envios", []).append({"trabajo_id": trabajo_id, "fecha": registro.ahora_iso(), "archivo": archivo.name,
                                       "chips": chips, "lugares": lugares, "resultado": None, "minutos_reales": None,
                                       "foto_final": None, "vigilancia_pedida": "sin detector" if frase else "detector",
                                       **({"sin_detector": {"frase": frase, "fecha": registro.ahora_iso()}}
                                          if frase else {})})
    _escribir_json(archivo.parent / "ficha.json", f)


def completar_ficha(enviada, cierre, foto_final=None):
    """Al cerrar un trabajo: resultado, minutos reales y la foto final en la ficha de la pieza (si esta en esta PC)."""
    if not enviada or not cierre or not enviada.get("carpeta"):
        return
    ruta = Path(enviada["carpeta"]) / "ficha.json"
    try:
        f = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    for e in f.get("envios", []):
        if e.get("trabajo_id") == enviada.get("trabajo_id"):
            e.update(resultado=cierre.get("tipo"), minutos_reales=cierre.get("minutos_reales"),
                     foto_final=str(foto_final) if foto_final else e.get("foto_final"))
    try:
        _escribir_json(ruta, f)
    except (OSError, FallaImpresora):
        pass


def mostrar_ficha(carpeta):
    ruta = Path(carpeta) / "ficha.json" if Path(carpeta).is_dir() else Path(carpeta).parent / "ficha.json"
    try:
        f = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise FallaImpresora(f"no hay una ficha en {ruta.parent} (se crea al mandar la pieza con --imprimir --apply)") from None
    print(f"PIEZA: {f.get('pieza')} | archivo vigente: {f.get('archivo_vigente')}")
    print("  ajustes:", ", ".join(f"{k} {v}" for k, v in (f.get("ajustes") or {}).items() if v is not None))
    print("  gramos:", f.get("gramos"), "| minutos estimados:", f.get("minutos_estimados"))
    if f.get("descartado"):
        print("  DESCARTADO:", f["descartado"])
    for e in f.get("envios", []):
        print(f"  envio {e.get('fecha', '')[:16]} {e.get('trabajo_id')}: {e.get('resultado') or 'sin cierre'}"
              + (f", {e['minutos_reales']} min reales" if e.get("minutos_reales") is not None else "")
              + (f", foto {e['foto_final']}" if e.get("foto_final") else ""))
    return 0


ORDEN_ESPERA_S, TRAMPA_ESPERA_S = 150, 120     # vuelve apenas arranca; a los 2 min mira la trampa de la etapa 77
TRAMPA_77 = ("la impresora sigue en PREPARE, etapa 77 («Preparando AMS»), renglon 0: es la trampa de la unidad 16 "
             "(falta ams_mapping2). Cancelala (--cancelar o el cuadrado rojo) y avisá a Fak")


# ---- La vigilancia la lanza --imprimir, con el detector (gate 3b, 23/10/2026) ----
# Falla real (Fak, 20/10/2026 18:36: «olvido tuyo? imperdonable... evitar que suceda en el futuro»): la vigilancia se
# lanzo a mano y sin --detector, porque --imprimir solo IMPRIMIA el comando y --seguir lo dejaba apagado por defecto.
# Una mejora que depende de que alguien se acuerde de un flag esta apagada (LECCIONES 20/10): ahora --imprimir --apply
# la lanza sola, como proceso aparte, con el detector; apagarlo pide la frase de Fak y queda escrito.
CANON_DETECTOR = Path(__file__).with_name("detectorCanon.data.json")
FRASE_MINIMA = 10                       # la misma que --acepto-voladizos (voladizosCanon.data.json, frase_minima)
VIGILANCIA_ESPERA_S = 20.0              # se mira el proceso aparte este tiempo: uno que no arranca sale antes (5 s no alcanzaba con la PC cargada: el hijo tarda en escribir vigilancia.pid; medido 23/10 19:25)
CONSOLA_VIGILANCIA = "vigilancia_consola.log"
# Lo que IMPRIME el proceso aparte va a vigilancia_consola.log y no a seguimiento.log: ese lo escribe el mismo
# --seguir (anotar_log imprime Y escribe cada renglon), y con la consola ahi cada renglon quedaria dos veces; al
# relanzar, el historial del detector (que se relee del log) contaria cada lectura dos veces.
LANZADOR = None                         # los tests ponen una funcion(argv, ruta_consola) -> objeto con .pid y .poll()


def canon_detector():
    """detectorCanon.data.json (la decision de noche, la frase minima, hasta cuando avisa); {} si no esta."""
    try:
        return json.loads(CANON_DETECTOR.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def error_de_frase(sin_detector, acepto):
    """None si --sin-detector / --acepto estan bien; si no, el texto de por que no."""
    minimo = int(canon_detector().get("frase_minima") or FRASE_MINIMA)
    if acepto is not None and not sin_detector:
        return "--acepto va solo con --sin-detector (sin --sin-detector no hay nada que aceptar)"
    if sin_detector and (not isinstance(acepto, str) or len(acepto.strip()) < minimo):
        return (f"--sin-detector necesita la frase de Fak (--acepto \"<su frase textual, {minimo} caracteres o más>\"); "
                "sin ella la vigilancia va con el detector")
    return None


def de_noche_ahora(cuando=None):
    """La camara no ve: de las 20:45 a las 08:15 (NOCHE_DESDE y NOCHE_HASTA, medidas el 13 y el 14/10)."""
    t = cuando or _ahora()
    hora = (t.hour, t.minute)
    return hora >= NOCHE_DESDE or hora < NOCHE_HASTA


def argv_vigilancia(carpeta, modo, frase=None):
    """El comando de la vigilancia. El MISMO se imprime y se lanza. Sin --despertar: un proceso aparte que sale con 10
    a los N minutos no lo relanza nadie (SKILL.md, «Vigilar hasta que termine»)."""
    argv = [sys.executable, str(Path(__file__).resolve()), "--seguir", str(carpeta), "--fotos-en", "3,10", "--cada", "30"]
    if modo == "sin detector":
        return argv + ["--sin-detector", "--acepto", str(frase)]
    return argv + (["--solo-medir"] if modo == "solo-medir" else ["--detector"])


def texto_de_comando(argv):
    """El argv en un renglon que una consola bash (y shlex) leen igual: comillas dobles en todo lo que no es una
    palabra simple; adentro, solo se escapan la comilla y la barra que va antes de otra barra, de una comilla o del final."""
    def q(a):
        a = str(a)
        if re.fullmatch(r"[A-Za-z0-9_.,:=+/@-]+", a):
            return a
        return '"' + re.sub(r'\\(?=\\|"|$)', r'\\\\', a).replace('"', '\\"') + '"'
    return " ".join(q(a) for a in argv)


def _popen_aparte(argv, consola):
    """Un proceso aparte, que no muere con la consola ni con la llamada que lanzo --imprimir (medido el 23/10/2026:
    sigue vivo despues de terminar la llamada que lo lanzo; al cerrar la sesion entera, sin medir)."""
    import subprocess
    kw = ({"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt"
          else {"start_new_session": True})
    with open(consola, "ab") as salida:
        return subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=salida, stderr=subprocess.STDOUT,
                                cwd=str(Path(consola).parent), env=dict(os.environ, PYTHONIOENCODING="utf-8"),
                                close_fds=True, **kw)


def lanzar_vigilancia(argv, carpeta):
    """Lanza la vigilancia y dice la verdad sobre ella: «VIGILANDO» solo si el proceso vive y su vigilancia.pid (lo
    escribe el Candado del propio --seguir) lo nombra. Un 15 («ya hay otra vigilancia») cuenta como vigilada. Nunca
    frena la impresion: la orden ya salio. Devuelve {"resultado", "pid", "salida"}."""
    carpeta = Path(carpeta)
    texto = texto_de_comando(argv)
    print("  LANZO LA VIGILANCIA APARTE:", texto, flush=True)
    a_mano = f"lanzala a mano, en segundo plano: {texto}"
    lanzador = LANZADOR
    if lanzador is None and os.environ.get("BAMBU_PRUEBA") == "1":
        print("  (prueba, BAMBU_PRUEBA=1: no se lanza ningún proceso aparte)")
        return {"resultado": "no lanzada (prueba)", "pid": None, "salida": None}
    try:
        p = (lanzador or _popen_aparte)(argv, carpeta / CONSOLA_VIGILANCIA)
    except (OSError, ValueError) as e:
        print(f"  LA VIGILANCIA NO ARRANCÓ ({type(e).__name__}: {e}). La impresión sigue: {a_mano}")
        return {"resultado": "no arranco", "pid": None, "salida": None}
    fin = time.time() + VIGILANCIA_ESPERA_S
    rc = p.poll()
    while rc is None and time.time() < fin:
        time.sleep(0.2)
        rc = p.poll()
    if rc == SALIDA_YA_VIGILADA:
        print(f"  ya había otra vigilancia sobre {carpeta} (salida 15): esa sigue vigilando")
        return {"resultado": "ya vigilada", "pid": p.pid, "salida": rc}
    if rc is not None:
        print(f"  LA VIGILANCIA NO ARRANCÓ: el proceso aparte salió con {rc} (mirá {carpeta / CONSOLA_VIGILANCIA}). "
              f"La impresión sigue: {a_mano}")
        return {"resultado": "no arranco", "pid": p.pid, "salida": rc}
    try:
        dueno = json.loads((carpeta / "vigilancia.pid").read_text(encoding="utf-8")).get("pid")
    except (OSError, ValueError, AttributeError):
        dueno = None
    if dueno == p.pid and _pid_vivo(p.pid):
        print(f"  VIGILANDO: proceso aparte PID {p.pid}; deja {carpeta / 'seguimiento.log'} y las fotos en esa carpeta. "
              "No lances otra vigilancia sobre esa carpeta (saldría 15)")
        return {"resultado": "vigilando", "pid": p.pid, "salida": None}
    print(f"  AVISO: el proceso aparte (PID {p.pid}) no dejó su vigilancia.pid en {VIGILANCIA_ESPERA_S:.0f} s: no lo doy "
          f"por vigilando. Mirá {carpeta / CONSOLA_VIGILANCIA}; si no aparece, {a_mano}")
    return {"resultado": "sin confirmar", "pid": p.pid, "salida": None}


def probar_camara(carpeta, d):
    """(True, "") si la camara manda una foto; (False, motivo) si no. Tarda hasta ~30 s (foto(): 10 + 20 s)."""
    import contextlib
    try:
        with open(os.devnull, "w") as nada, contextlib.redirect_stdout(nada):
            ok = foto(str(Path(carpeta) / "camara_al_mandar.jpg"), d) == 0
        return ok, "" if ok else "no llegó ninguna foto en 20 s"
    except FallaImpresora as e:
        return False, e.texto
    except (Exception, SystemExit) as e:
        return False, f"{type(e).__name__}: {e}"


def modo_de_vigilancia(frase, camara_ok):
    """(modo, motivo). 'sin detector' solo con la frase de Fak; sin camara, 'solo-medir' (el detector no tiene que
    mirar y la impresion no se frena por eso); si no, 'detector'. De noche lo resuelve el propio --seguir por hora
    (detectorCanon.data.json, de_noche): anota y no da alarma."""
    if frase:
        return "sin detector", f"--sin-detector con la frase de Fak «{frase}»"
    if camara_ok is False:
        return "solo-medir", "sin cámara accesible: la vigilancia va con --solo-medir (solo estado)"
    return "detector", ""


def anotar_vigilancia_en_ficha(archivo, trabajo_id, dato):
    ruta = Path(archivo).parent / "ficha.json"
    f = ficha(archivo)
    for e in f.get("envios", []):
        if e.get("trabajo_id") == trabajo_id:
            e["vigilancia"] = dato
    if f:
        _escribir_json(ruta, f)


def vigilar_lo_mandado(archivo, trabajo_id, d, frase=None):
    """Despues de mandar la orden: prueba la camara, elige el modo, lanza la vigilancia aparte y lo anota (registro y
    ficha). Cualquier falla aca se dice y no cambia la salida de --imprimir: la orden ya salio."""
    import registro
    carpeta = Path(archivo).parent / ("seguimiento_" + trabajo_id)
    try:
        ruta_de_prueba_ok(carpeta)
        carpeta.mkdir(parents=True, exist_ok=True)
        camara_ok, motivo_cam = (None, "") if frase else probar_camara(carpeta, d)
        modo, motivo = modo_de_vigilancia(frase, camara_ok)
        if modo == "solo-medir":
            print(f"  AVISO: {motivo} ({motivo_cam})")
        elif modo == "sin detector":
            print(f"  AVISO: VIGILANCIA SIN DETECTOR ({motivo}); la vigilancia del estado sigue")
        if modo != "sin detector" and not PY_DETECTOR.exists():
            print(f"  AVISO: en esta PC no está el detector ({PY_DETECTOR}): la vigilancia va igual y su log va a decir "
                  "«DETECTOR SIN MEDIR» (instalar_detector.py --probar)")
        argv = argv_vigilancia(carpeta, modo, frase)
        res = lanzar_vigilancia(argv, carpeta)
    except (Exception, SystemExit) as e:
        print(f"  LA VIGILANCIA NO ARRANCÓ ({type(e).__name__}: {e}). La impresión sigue: lanzá a mano --seguir "
              f"\"{carpeta}\" --fotos-en 3,10 --cada 30 en segundo plano")
        return None
    dato = {"modo": modo, "motivo": motivo or None, "comando": texto_de_comando(argv), "carpeta": str(carpeta),
            "resultado": res["resultado"], "pid": res["pid"], "salida": res["salida"], "fecha": registro.ahora_iso()}
    if frase:
        dato["frase"] = frase
    try:
        registro.anotar({"tipo": "vigilancia", "trabajo_id": trabajo_id, **dato})
    except (Exception, SystemExit) as e:
        print("  (no se pudo anotar la vigilancia en el registro:", type(e).__name__, e, ")")
    try:
        anotar_vigilancia_en_ficha(archivo, trabajo_id, dato)
    except (Exception, SystemExit) as e:
        print("  (no se pudo anotar la vigilancia en la ficha:", type(e).__name__, e, ")")
    return dato


def _en_seco(archivo, mapa, frase):
    """--en-seco: arma todo lo que se puede sin la impresora y no habla con ella. No lee su estado (leer_estado() usa
    la red y concilia el registro), no prueba la camara, no sube, no manda, no escribe el registro, la ficha ni
    seguimiento_*, no dibuja la primera capa y no lanza ningun proceso."""
    import registro
    ajustes = ajustes_del_archivo(archivo)
    minutos_archivo, inicio = ajustes.get("minutos"), _ahora()
    minutos = minutos_archivo or 0
    fin = inicio + timedelta(minutes=minutos * FACTOR_TIEMPO)
    nombre = registro.nombre_en_impresora(archivo)
    trabajo_id = inicio.strftime("%Y%m%d-%H%M%S-") + nombre.split(".")[0]
    print("EN SECO: no se consultó la impresora (ni su estado ni la cámara); no se sube nada, no se manda la orden, no "
          "se escribe el registro ni la ficha y no se lanza ningún proceso")
    print("PLAN: subir", archivo.name, f"({archivo.stat().st_size/1e6:.1f} MB) como", nombre)
    if mapa:
        print("      filamento del archivo -> lugar del cargador:", {i + 1: m + 1 for i, m in enumerate(mapa)})
    print(f"      {minutos // 60} h {minutos % 60} min estimados: terminaría a las {fin:%H:%M}"
          + (f" del {fin:%d/%m}" if fin.date() != inicio.date() else ""))
    falta_ok = falta_ok_de_fak(archivo, minutos_archivo, inicio)
    if falta_ok:
        print("      CON --apply NO SE MANDARÍA:", falta_ok)
    print("      frenos SIN EVALUAR (necesitan la impresora): impresora ocupada, placa libre, rollos y colores cargados "
          "(y el --mapa automático), gramos por rollo, ambiente y la cámara")
    print("      evaluados en seco: una sola placa, la frase de --sin-detector y el OK de Fak (pieza larga o de noche)")
    modo, motivo = modo_de_vigilancia(frase, None)
    if motivo:
        print("      AVISO:", motivo)
    if _de_noche(inicio, fin):
        print("      DE NOCHE: de 20:45 a 08:15 la cámara no ve; la vigilancia anota el detector y no da alarma "
              "(detectorCanon.data.json)")
    carpeta = archivo.parent / ("seguimiento_" + trabajo_id)
    print("  LANZARÍA LA VIGILANCIA APARTE:", texto_de_comando(argv_vigilancia(carpeta, modo, frase)))
    print("      (la carpeta y el número de trabajo salen de la hora real del envío)")
    return 0


def imprimir(archivo, mapa, aplicar, sin_margen=False, en_seco=False, sin_detector=False, acepto=None):
    """Sube un .gcode.3mf, le pide a la impresora que lo imprima y LANZA SOLA la vigilancia aparte con el detector
    (con --solo-medir si no hay camara; sin detector solo con --sin-detector y la frase de Fak). Sin --apply solo
    muestra el plan; con --en-seco no habla con la impresora. Los parametros nuevos tienen valor por defecto:
    imprimir_pieza.py llama imprimir(archivo, None, apply)."""
    envio = {}
    try:
        return _imprimir(archivo, mapa, aplicar, sin_margen, en_seco, sin_detector, acepto, envio)
    finally:
        # tambien si la conexion se corta DESPUES de mandar la orden: la impresion puede estar andando
        if envio.get("mandada") and not envio.get("rechazada"):
            vigilar_lo_mandado(envio["archivo"], envio["trabajo_id"], envio["d"], envio.get("frase"))


def _imprimir(archivo, mapa, aplicar, sin_margen, en_seco, sin_detector, acepto, envio):
    """Sube un .gcode.3mf y le pide a la impresora que lo imprima. Sin --apply solo muestra el plan.
    Frena (antes de subir nada) si: el archivo trae varias placas, el material o el color no son los cargados, la
    impresora esta ocupada, no alcanzan los gramos (o es de noche con poco rollo y sin respaldo), la placa tiene
    piezas sin «placa libre» anotado, o es una pieza larga o de noche sin el <archivo>.ok de Fak."""
    import hashlib
    import zipfile
    import registro
    archivo = Path(archivo)
    if not archivo.is_file():
        raise FallaImpresora(f"no encuentro el archivo {archivo}")
    try:
        with zipfile.ZipFile(archivo) as _z:
            nombres = _z.namelist()
    except zipfile.BadZipFile:
        raise FallaImpresora(f"{archivo.name} no es un laminado de Bambu Studio (.gcode.3mf)") from None
    # antes que el freno de color: con varias placas solo se mandaria la 1 y el resto se perderia sin aviso (14/10)
    placas = [n for n in nombres if re.fullmatch(r"Metadata/plate_\d+\.gcode", n)]
    if len(placas) > 1:
        print(f"   NO SE MANDA: el archivo trae {len(placas)} placas; va un archivo por placa")
        return 1
    if not placas:
        raise FallaImpresora(f"{archivo.name} no trae el codigo de la placa 1 (Metadata/plate_1.gcode)")
    # la frase de --sin-detector se controla ANTES de leer la impresora y de subir (tambien sin --apply y en seco)
    error = error_de_frase(sin_detector, acepto)
    if error:
        print("   NO SE MANDA:", error)
        return 1
    frase = acepto.strip() if sin_detector else None
    if en_seco:
        if aplicar:
            print("   --en-seco manda sobre --apply: no se manda nada")
        return _en_seco(archivo, mapa, frase)
    d = cargar_datos()
    est0 = leer_estado(d)
    if not est0.get("gcode_state") or not isinstance(est0.get("ams"), dict):
        # sin el estado completo no se sabe si esta ocupada, si la placa esta libre ni que rollo hay: no se manda a
        # ciegas (revision 16/10: con --mapa y una impresora que no informaba, salia la orden sin ningun freno)
        raise SinConexion("La impresora no mandó su estado completo en 6 s: no se manda nada a ciegas. Probá de nuevo "
                          "en un minuto; si se repite, mirá su pantalla.")
    fallas = []
    if mapa is None:                      # sin --mapa: se elige solo, por material, color y el rollo mas gastado
        mapa, ren, fallas = mapa_automatico(archivo, est0)
        for r in ren:
            print("  ", r)
    elif not mapa or any(not isinstance(m, int) or m < -1 or m > 3 for m in mapa):
        fallas.append(f"--mapa {mapa}: cada lugar del cargador va de 0 a 3 (-1 = no se usa)")
    else:
        # un lugar vacio frena siempre, tambien con --sin-margen (que solo saltea la cuenta de gramos: re-auditoria R5)
        chips0 = rollos_del_cargador(est0)
        fallas += [f"el lugar {m + 1} no tiene ningún rollo según la impresora" for m in mapa if m >= 0 and not chips0.get(m)]
    ajustes = ajustes_del_archivo(archivo)
    minutos_archivo, inicio = ajustes.get("minutos"), _ahora()
    minutos = minutos_archivo or 0
    fin = inicio + timedelta(minutes=minutos * FACTOR_TIEMPO)
    if not fallas:
        f_g, avisos_g = freno_gramos(archivo, mapa, est0, minutos, inicio)
        for a in avisos_g:
            print("   AVISO DE ROLLO:", a)
        if f_g and sin_margen:
            print("   --sin-margen: se manda igual con poco rollo (solo con la frase de Fak en el chat):", "; ".join(f_g))
        elif f_g:
            fallas += f_g
    estado_ = est0.get("gcode_state")
    al_mandar = []                         # lo que frena solo con --apply (sin --apply se muestra como aviso)
    if estado_ in ("RUNNING", "PREPARE", "PAUSE"):
        al_mandar.append(f"la impresora esta ocupada ({estado_})")
    ocupada = placa_ocupada(est0)
    if ocupada:
        al_mandar.append(ocupada)
    elif estado_ == "IDLE":
        print("   la impresora esta libre (IDLE): si antes termino algo, alguien toco la pantalla; mirá igual que la "
              "placa este vacia y limpia")
    falta_ok = falta_ok_de_fak(archivo, minutos_archivo, inicio)
    if falta_ok:
        al_mandar.append(falta_ok)
    if aplicar:
        fallas += al_mandar
    if fallas:
        for f in fallas:
            print("   NO SE MANDA:", f)
        return 1
    nombre = registro.nombre_en_impresora(archivo)
    subtask = registro.subtask_de(nombre)
    with zipfile.ZipFile(archivo) as z:
        md5 = hashlib.md5(z.read("Metadata/plate_1.gcode")).hexdigest().upper()
    placa = "Metadata/plate_1.gcode"
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
        "subtask_name": subtask,
        "profile_id": "0", "project_id": uid, "subtask_id": uid, "task_id": uid,
        "ams_mapping": list(mapa),
        "ams_mapping2": [{"ams_id": UNIDAD_CARGADOR_A2L, "slot_id": m} for m in mapa]}}
    print("PLAN: subir", archivo.name, f"({archivo.stat().st_size/1e6:.1f} MB) como", nombre)
    print("      imprimir", placa, "| filamento del archivo -> lugar del cargador:",
          {i + 1: m + 1 for i, m in enumerate(mapa)})
    print(f"      ajustes: paredes {ajustes['paredes']}, relleno {ajustes['relleno']}, capas arriba/abajo "
          f"{ajustes['capas_arriba']}/{ajustes['capas_abajo']}, borde {ajustes['borde']} ({ajustes['borde_mm']} mm), "
          f"soportes {ajustes['soportes']}; orientacion: la del laminado (se ve en el dibujo de la primera capa)")
    print(f"      {minutos // 60} h {minutos % 60} min estimados: la primera capa empieza en 6-16 min (arranque de la "
          f"A2L) y termina a las {fin:%H:%M}" + (f" del {fin:%d/%m}" if fin.date() != inicio.date() else ""))
    if _de_noche(inicio, fin):
        print("      DE NOCHE: después de las 20:45 la cámara no ve (planta a oscuras): la vigilancia anota el detector "
              "y no da alarma de 20:45 a 08:15 (detectorCanon.data.json); el estado se vigila igual")
    for a in al_mandar:
        print("      CON --apply NO SE MANDA:", a)
    # temperatura del lugar contra lo que pide Bambu (avisa; la decision de imprimir igual es de Fak)
    try:
        lin_a, av_a = ambiente(minutos)
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
    # la conexion se abre DESPUES de subir: una subida de ~2 min no deja mandar el aviso de vida
    tam = subir(d, archivo, nombre)
    print("  subido; tamano en la impresora:", tam, "| local:", archivo.stat().st_size)
    if tam is not None and tam != archivo.stat().st_size:
        print("  EL ARCHIVO NO LLEGO ENTERO: no se manda a imprimir")
        return 1
    with Conexion(d) as c:
        c.leer(8, hasta=_informe_completo)
        est1 = c.visto
        # otra PC pudo mandar durante la subida: se relee justo antes de dar la orden; «no se sabe» no es «libre»
        if not est1.get("gcode_state"):
            print("   NO SE MANDA: la impresora no contestó su estado justo antes de la orden (el archivo quedó subido; "
                  "volvé a correr --imprimir --apply en un minuto)")
            return SALIDA_SIN_CONEXION
        if est1.get("gcode_state") in ("RUNNING", "PREPARE", "PAUSE"):
            print(f"   NO SE MANDA: mientras se subia el archivo la impresora paso a {est1.get('gcode_state')} "
                  f"({est1.get('subtask_name')}): otra PC u otra persona la mando")
            return 1
        # el rollo y el material se anotan del estado que valido el freno (est0); la relectura solo los completa
        chips = {**rollos_del_cargador(est1), **rollos_del_cargador(est0)}
        lug1 = {**lugares_del_cargador(est1), **lugares_del_cargador(est0)}
        fil = filamentos_del_archivo(archivo)
        trabajo_id = time.strftime("%Y%m%d-%H%M%S-") + nombre.split(".")[0]
        # el renglon va ANTES de la orden: si el programa se corta entre las dos, la impresion igual queda anotada
        registro.anotar({
            "tipo": "enviada", "trabajo_id": trabajo_id, "estado": "sin confirmar",
            "pieza": archivo.name.replace(".gcode.3mf", ""), "archivo": archivo.name, "carpeta": str(archivo.parent.resolve()),
            "subtask_name": subtask, "task_id": uid, "minutos_estimados": minutos or None,
            "fin_estimado": fin.isoformat(timespec="minutes"), "capas": ajustes.get("capas"),
            "ajustes": {k: v for k, v in ajustes.items() if k not in ("minutos", "capas")},
            "filamentos": [{"lugar": mapa[i] + 1, "material": lug1.get(mapa[i], ("", "", ""))[1],
                            "color": col, "gramos": float(g or 0), "rollo": chips.get(mapa[i])}
                           for i, (_, _, _, col, g) in enumerate(fil)],
            "vigilancia_pedida": "sin detector" if frase else "detector",
            **({"sin_detector": {"frase": frase, "fecha": registro.ahora_iso()}} if frase else {})})
        try:
            anotar_envio_en_ficha(archivo, {k: v for k, v in ajustes.items()}, {i + 1: float(g or 0) for i, (*_, g) in enumerate(fil)},
                                  trabajo_id, [chips.get(m) for m in mapa], [m + 1 for m in mapa], frase=frase)
        except (OSError, FallaImpresora) as e:
            print("  (no se pudo escribir la ficha de la pieza:", e, ")")
        try:
            c.publicar(orden)
        except SinConexion:
            registro.cerrar(trabajo_id, "cancelada", avance_pct=0, minutos_reales=None,
                            nota="la orden no salio: se corto la conexion al mandarla")
            raise
        envio.update(mandada=True, archivo=archivo, trabajo_id=trabajo_id, d=d, frase=frase)
        print("  ORDEN DE IMPRIMIR MANDADA", time.strftime("%H:%M:%S"))
        # 15/10/2026: se mando y nadie vigilo (la falla la vio Fak al 27 %); 20/10: se vigilo sin el detector. Desde el
        # 23/10 la vigilancia la lanza imprimir() al salir (proceso aparte, con el detector), aunque la conexion se
        # corte en la espera de abajo; una carpeta por envio: una reimpresion no hereda el estado, las fotos ni la
        # base del detector de la anterior
        print(f"  la vigilancia se lanza sola al terminar este comando, en {archivo.parent / ('seguimiento_' + trabajo_id)}")
        t_orden, confirmada, ultimo = time.time(), False, None
        while time.time() - t_orden < ORDEN_ESPERA_S:
            nuevos = c.leer(5, hasta=lambda v, p: v.get("gcode_state") == "RUNNING" or p.get("command") == "project_file")
            v = c.visto
            resp = next((p for p in nuevos if p.get("command") == "project_file" and p.get("result")), None)
            if resp and str(resp.get("result")).lower() != "success":
                print("  LA IMPRESORA RECHAZO LA ORDEN:", resp.get("result"), resp.get("reason") or "")
                envio["rechazada"] = True
                registro.cerrar(trabajo_id, "cancelada", avance_pct=0, minutos_reales=None,
                                nota=f"la impresora rechazo la orden: {resp.get('result')} {resp.get('reason') or ''}".strip())
                return 1
            nuestro = v.get("subtask_name") == subtask
            if not confirmada and (resp or (nuestro and v.get("gcode_state") in ("PREPARE", "RUNNING"))):
                registro.confirmar(trabajo_id, task_id=uid, subtask_name=subtask,
                                   respuesta=(resp or {}).get("result") or v.get("gcode_state"))
                confirmada = True
            estado_v = (v.get("gcode_state"), v.get("print_error"), v.get("stg_cur"))
            if estado_v != ultimo:
                print("  impresora:", {"estado": estado_v[0], "error": estado_v[1], "etapa": estado_v[2]}, flush=True)
                ultimo = estado_v
            if nuestro and v.get("gcode_state") == "RUNNING":
                print(f"  ARRANCÓ {time.strftime('%H:%M:%S')}: termina a las {fin:%H:%M} aprox.")
                return 0
            if (time.time() - t_orden > TRAMPA_ESPERA_S and v.get("gcode_state") == "PREPARE" and v.get("stg_cur") == 77
                    and str(v.get("mc_print_line_number")) in ("0", "None")):
                print("  OJO:", TRAMPA_77)
                return 1
    if confirmada and c.visto.get("gcode_state") in ("PREPARE", "SLICING"):
        print("  todavia preparando (arranque de la A2L): la vigilancia lo sigue")
        return 0
    print("  la impresora no confirmo la orden en 2,5 minutos: mirá la pantalla antes de mandar otra")
    return 1


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
        visto = c.visto
    conciliar(visto)
    return visto


def orden_simple(comando):
    """pause / resume / stop. Con stop (--cancelar), cierra en el registro EL trabajo que la impresora informa (por
    task_id y nombre) como «cancelada» con su avance y su capa; si no esta en el registro, lo anota como «visto»."""
    d = cargar_datos()
    with Conexion(d) as c:
        c.leer(6, hasta=_informe_completo)
        antes = dict(c.visto)
        c.publicar({"print": {"sequence_id": "20010", "command": comando, "param": ""}})
        res = None
        for p in c.leer(12, hasta=lambda v, p: p.get("command") == comando):
            if p.get("command") == comando:
                res = p.get("result")
    print(f"orden '{comando}' mandada {time.strftime('%H:%M:%S')} | respuesta: {res}")
    if comando == "stop" and res == "success" and antes.get("gcode_state") in ("RUNNING", "PREPARE", "PAUSE"):
        try:
            r, e = cerrar_trabajo(antes, "cancelada",
                                  {"subtask_name": antes.get("subtask_name"), "task_id": antes.get("task_id"),
                                   "ult_pct": antes.get("mc_percent"), "ult_capa": antes.get("layer_num")},
                                  visto_terminar=True, nota="cancelada con bambu_red.py --cancelar")
            if r:
                completar_ficha(e, r)
                print(f"  registro: {e['trabajo_id']} cancelada en la capa {antes.get('layer_num')} "
                      f"({antes.get('mc_percent')} %)")
            elif e is None:
                print(f"  registro: {antes.get('subtask_name')} no estaba anotado: quedo como «visto», no se cerro nada ajeno")
        except (Exception, SystemExit) as ex:
            print("  (no se pudo anotar la cancelacion en el registro:", type(ex).__name__, ex, ")")
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


# ---------------- el registro contra lo que informa la impresora ----------------
def anotar_visto(v):
    """Un trabajo que la impresora informa y que no esta en el registro (lo mandaron desde Bambu Studio, la
    pantalla u otra skill) queda como «visto», una sola vez. Nunca se cierra un trabajo ajeno por descarte."""
    import registro
    est, nombre, tid = v.get("gcode_state"), v.get("subtask_name"), v.get("task_id")
    if not nombre or est not in ("RUNNING", "PREPARE", "PAUSE", "FINISH", "FAILED"):
        return None
    ev = registro.leer()
    e = registro.trabajo_de(nombre, tid, solo_abiertas=False, ev=ev)
    if e is not None:
        con_num, e_num = tid not in (None, "", "0"), e.get("task_id") not in (None, "", "0")
        # Es un trabajo anotado, salvo que lo unico que coincida sea el NOMBRE de un envio viejo, sin numero y ya cerrado,
        # mientras la impresora informa un numero: eso es otra impresion del mismo archivo (desde la pantalla o Bambu
        # Studio) y tiene que quedar «visto» (revision 16/10: nunca quedaba y no ocupaba la placa). Solo si esta
        # IMPRIMIENDO: el original no puede estar imprimiendo despues de su cierre, pero su FINISH si puede seguir en la
        # pantalla (los envios viejos no tienen numero: anotarlo volvia a ocupar la placa, re-auditoria R1).
        if not con_num or e_num or e["trabajo_id"] not in registro.cerrados(ev):
            return None
        if est not in ("RUNNING", "PREPARE", "PAUSE") and not registro.visto_ya(nombre, tid, ev):
            return None                     # su fin, sin haberla visto imprimir, puede ser el original en la pantalla
    if registro.visto_ya(nombre, tid, ev, fin=est in ("FINISH", "FAILED")):
        return None
    return registro.anotar({"tipo": "visto", "subtask_name": nombre, "task_id": tid, "estado": est,
                            "capa": v.get("layer_num"), "capas": v.get("total_layer_num"),
                            "avance_pct": v.get("mc_percent"),
                            "nota": "la impresora lo informa y no tiene renglon «enviada»: se mando desde Bambu Studio, "
                                    "la pantalla u otra skill (sus gramos no se descuentan)"})


def cerrar_trabajo(v, tipo, trabajo=None, visto_terminar=False, nota=""):
    """Cierra en el registro EL trabajo que informa la impresora (por task_id y nombre), no «el ultimo abierto».
    Si no lo encuentra, no cierra nada: lo anota como «visto». Devuelve (renglon de cierre, renglon enviada)."""
    import registro
    nombre = (trabajo or {}).get("subtask_name") or v.get("subtask_name")
    tid = (trabajo or {}).get("task_id") or v.get("task_id")
    e = registro.trabajo_de(nombre, tid)
    if e is None:
        anotar_visto(dict(v, subtask_name=nombre, task_id=tid))
        return None, None
    campos = {"avance_pct": 100 if tipo == "terminada" else (trabajo or {}).get("ult_pct", v.get("mc_percent")),
              "capa": (trabajo or {}).get("ult_capa", v.get("layer_num")), "capas": v.get("total_layer_num"),
              "error": v.get("print_error")}
    if visto_terminar:
        t0 = registro.fecha(e.get("cuando"))
        campos["minutos_reales"] = round((registro.ahora() - t0).total_seconds() / 60, 1) if t0 else None
    else:
        campos.update(minutos_reales=None, fin_visto=registro.ahora_iso())
    if nota:
        campos["nota"] = nota
    return registro.cerrar(e["trabajo_id"], tipo, **campos), e


def conciliar(v):
    """En cada conexion de cualquier comando (idea de bambuddy, solo la idea): un trabajo del registro que la
    impresora informa terminado o fallado sin que nadie lo viera se cierra por ESE trabajo, con la hora real de
    fin desconocida; uno que imprime y no figura queda «visto». Idempotente; no corre si en esta PC hay una
    vigilancia viva (ella lo cierra con los minutos reales)."""
    est = v.get("gcode_state")
    if not v.get("subtask_name") or _vigilancia_viva():
        return None
    try:
        import registro
        if est in ("FINISH", "FAILED") and registro.trabajo_de(v.get("subtask_name"), v.get("task_id")):
            r, e = cerrar_trabajo(v, "terminada" if est == "FINISH" else "fallida",
                                  nota="lo vio terminado una PC al conectarse, sin vigilancia: hora real de fin desconocida")
            if r:
                print(f"  registro: cerré {e['trabajo_id']} como {r['tipo']} (la impresora lo informa {est}; "
                      "la hora real de fin no se sabe)")
            return r
        return anotar_visto(v)
    except (Exception, SystemExit) as ex:
        print("  (no se pudo comparar con el registro:", type(ex).__name__, ex, ")")
        return None


# ---------------- vigilar: separar «sin conexion» de «quieta» (16/10/2026) ----------------
# Anoche (15/10) la vigilancia leyo «sin conexion» como «quieta»: el reloj de 15 minutos no distinguia una lectura
# vacia de una impresora frenada, y salio con 3. Ahora:
#   sin conexion = un error de la conexion o 60 s sin ningun paquete de la impresora  -> 12 (una vez)
#   quieta       = llegan informes y en 15 min no cambian estado, capa, etapa ni %     -> 3
#   acceso       = la impresora rechaza el codigo DOS veces seguidas                     -> 13
#   al volver    = FINISH del mismo trabajo -> 14; PAUSE -> 2 (posible corte); IDLE u otro trabajo -> 1
SALIDA_TERMINO_SIN_VER, SALIDA_YA_VIGILADA = 14, 15
QUIETA_S = 900
SIN_MENSAJES_S = float(os.environ.get("BAMBU_SIN_MENSAJES_S") or 60)   # 60 s: ha-bambulab y bambuddy; las pruebas lo achican
# sin ningun INFORME (aunque conteste el aviso de vida): el pedido de informe completo va cada 5 min, mas un minuto
SIN_INFORMES_S = PUSHALL_CADA + 60
BUSCAR_CADA, EN_PAUSA_CADA, CANDADO_VENCE_S = 120, 300, 180
SALIDA_ERROR_PROGRAMA = 16           # --seguir: un error del programa, no de la impresora (no se confunde con el 1)
ESPERA_ARRANQUE_S = 600              # --seguir lanzado con el envio: cuanto espera a que arranque la pieza nueva
ENVIO_RECIENTE_S = 900               # un envio abierto de hace menos que esto es el que se esta por vigilar


def fin_de_otro_trabajo(v):
    """True si la impresora muestra el FIN (FINISH/FAILED) de un trabajo que NO esta abierto en el registro (el de la
    pieza anterior: cerrada, o mandada desde Bambu Studio o la pantalla) mientras hay un envio ABIERTO que todavia no
    arranco: el que se esta por vigilar. Sin un envio abierto no hay nada que esperar (una vigilancia lanzada sola
    sobre una impresora que ya termino dice «terminó», como antes)."""
    try:
        import registro
        nombre, tid = v.get("subtask_name"), v.get("task_id")
        if not (v.get("gcode_state") in ("FINISH", "FAILED") and nombre and registro.trabajo_de(nombre, tid) is None):
            return False
        # un envio abierto RECIENTE: uno viejo que quedo abierto (otra PC, otro dia) no es el que se esta por vigilar
        # (re-auditoria del bloque 4, R-B4-2: Rueda_graduada, abierta en el registro real, hacia esperar 10 min)
        limite = registro.ahora().timestamp() - ENVIO_RECIENTE_S
        return any((registro.fecha(e.get("cuando")) or registro._MUY_VIEJO).timestamp() >= limite
                   for e in registro.abiertas())
    except (Exception, SystemExit):
        return False


def _hora(t):
    return time.strftime("%H:%M", time.localtime(t)) if t else "?"


def _iso(t=None):
    import registro
    return registro.ahora_iso() if t is None else registro.datetime.fromtimestamp(t).astimezone().isoformat(timespec="seconds")


def fin_de_rollo(v):
    """El codigo de la alarma si la pausa la pidio el cargador (fin de rollo o enredo): un HMS que empieza por 0700 o
    1200, o un print_error 0700xxxx / 1200xxxx. El codigo exacto de fin de rollo de la A2L falta saberlo: se anota
    tal cual la primera vez que pase, con la foto de la pantalla."""
    for h in v.get("hms") or []:
        try:
            attr, code = int(h.get("attr", 0)), int(h.get("code", 0))
        except (TypeError, ValueError, AttributeError):
            continue
        txt = f"{attr >> 16:04X}-{attr & 0xFFFF:04X}-{code >> 16:04X}-{code & 0xFFFF:04X}"
        if txt[:4] in ("0700", "1200"):
            return txt
    try:
        pe = int(v.get("print_error") or 0)
    except (TypeError, ValueError):
        pe = 0
    txt = f"{pe:08X}"
    return f"{txt[:4]}-{txt[4:]}" if pe and txt[:4] in ("0700", "1200") else None


def _lugar_activo(v):
    try:
        n = int((v.get("ams") or {}).get("tray_now"))
    except (TypeError, ValueError):
        return None
    return n if 0 <= n <= 3 else None


class Vigia:
    """Decide que pasa con la impresion a partir de lo que llega (o no llega) de la impresora. No toca la red: se le
    pasan los informes (mensaje), las señales de vida (vida) y las fallas (falla), y evaluar() devuelve (salida, texto)
    o None. Asi se prueba con lecturas guardadas (clasificar). `previo` es lo que guardo la corrida anterior en
    estado_seguimiento.json. `trabajo_cerrado`: el trabajo de `previo` ya esta cerrado en el registro (una reimpresion
    en la misma carpeta, o lo cerro otro comando): si al volver la impresora informa OTRO trabajo, se lo toma."""

    def __init__(self, ahora_, previo=None, buscar=False, en_pausa=False, trabajo_cerrado=False):
        p = previo or {}
        self.inicio, self.buscar, self.en_pausa = ahora_, buscar, en_pausa
        self.trabajo = p.get("trabajo")
        self.trabajo_cerrado = bool(trabajo_cerrado and self.trabajo)
        self.ult_mensaje = p.get("ult_mensaje")          # el ultimo INFORME de la impresora (no un aviso de vida)
        self.ult_vida = None                             # el ultimo paquete de cualquier tipo (PINGRESP incluido)
        self.ult_corriendo = p.get("ult_corriendo")
        self.desconectado_desde = p.get("desconectado_desde")
        self.ult_clave = tuple(p["ult_clave"]) if p.get("ult_clave") else None
        self.ult_avance = p.get("ult_avance")
        # El reloj de «quieta» viene de la corrida anterior SOLO si esa corrida estaba viendo la impresora hace poco.
        # Despues de una PC dormida o de un hueco sin conexion arranca de cero: no se sabe que paso mientras no se veia.
        if not (self.ult_mensaje and ahora_ - self.ult_mensaje < 300) or self.desconectado_desde:
            self.ult_avance = None
        self.volvio = bool(self.desconectado_desde)
        self.v, self.rechazos, self.motivo = {}, 0, p.get("motivo") or ""
        # la alarma (hms / print_error) que ya se aviso con un 2: relanzada con --en-pausa no se vuelve a avisar si
        # queda prendida despues de reanudar (revision 16/10); una distinta si
        self.alarma = p.get("alarma")

    def estado(self):
        return {"trabajo": self.trabajo, "ult_mensaje": self.ult_mensaje, "ult_corriendo": self.ult_corriendo,
                "desconectado_desde": self.desconectado_desde, "ult_clave": list(self.ult_clave) if self.ult_clave else None,
                "ult_avance": self.ult_avance, "motivo": self.motivo, "alarma": self.alarma}

    def vida(self, t):
        """Llego algo de la impresora (un aviso de vida, una respuesta): la conexion anda, aunque no sea un informe."""
        self.ult_vida = t if self.ult_vida is None else max(self.ult_vida, t)

    def mensaje(self, t, v):
        """Llego un INFORME de la impresora (un 'print'): `v` es el estado completo conocido."""
        self.v, self.rechazos = v, 0
        self.vida(t)
        if self.desconectado_desde is not None:          # volvio despues de un hueco
            self.volvio, self.desconectado_desde, self.ult_avance = True, None, None
        self.ult_mensaje = t
        est = v.get("gcode_state")
        clave = (est, v.get("layer_num"), v.get("stg_cur"), v.get("mc_percent"))
        if clave != self.ult_clave or self.ult_avance is None:
            self.ult_clave, self.ult_avance = clave, t
        if est in ("RUNNING", "PREPARE", "PAUSE") and v.get("subtask_name"):
            if not self.trabajo or (not self.volvio and self.mismo_trabajo(v) is False):
                self.trabajo = {"subtask_name": v.get("subtask_name"), "task_id": v.get("task_id")}
                self.trabajo_cerrado = False
            # el avance que se guarda es el de ESTE trabajo: al volver con otro trabajo no se pisa el del viejo
            if self.mismo_trabajo(v) and (est != "PAUSE" or self.trabajo.get("ult_pct") is None):
                self.trabajo["ult_pct"], self.trabajo["ult_capa"] = v.get("mc_percent"), v.get("layer_num")
        if est in ("RUNNING", "PREPARE"):
            self.ult_corriendo = t

    def falla(self, t, tipo, motivo=""):
        if tipo == "acceso":
            self.rechazos += 1
        self.motivo = motivo or self.motivo
        if self.desconectado_desde is None:
            self.desconectado_desde = self.ult_mensaje or t

    def mismo_trabajo(self, v):
        """True / False, o None si el informe no dice de que trabajo es (un informe parcial, sin nombre ni numero)."""
        if not self.trabajo:
            return False
        tid, vtid = self.trabajo.get("task_id"), v.get("task_id")
        if tid not in (None, "", "0") and vtid not in (None, "", "0"):
            return str(vtid) == str(tid)
        if not v.get("subtask_name"):
            return None
        return v.get("subtask_name") == self.trabajo.get("subtask_name")

    def evaluar(self, t):
        if self.rechazos >= 2:                   # no al primer rechazo: ha-bambulab lo vio con la impresora apagada
            return SALIDA_ACCESO, TEXTO_ACCESO
        ult = self.ult_mensaje or self.inicio
        vida = max(self.ult_vida or 0, ult)
        # Sin conexion: 60 s sin NINGUN paquete, o sin ningun INFORME: una impresora que solo contesta el aviso de vida
        # no esta «quieta», no se la esta viendo (revision 16/10: el PINGRESP contaba como informe y salia 3, no 12).
        # Sin ningun informe en esta corrida alcanzan 60 s (el pedido de informe completo al conectar se contesta
        # enseguida); despues de uno, el tiempo entre dos pedidos de informe completo (5 min) mas un minuto.
        if self.ult_mensaje is None or self.ult_mensaje < self.inicio:
            sin_informes = t - self.inicio >= SIN_MENSAJES_S
        else:
            sin_informes = t - self.ult_mensaje >= SIN_INFORMES_S
        sin = t - vida >= SIN_MENSAJES_S or sin_informes
        if self.desconectado_desde is not None or sin:
            if sin:
                if self.desconectado_desde is None:
                    self.desconectado_desde = ult
                if not self.buscar:
                    return SALIDA_SIN_CONEXION, (f"sin conexión con la impresora desde las {_hora(ult)}"
                                                 + (f" ({self.motivo})" if self.motivo else "")
                                                 + ". Si la impresora sigue con luz, imprime sola (el archivo está en "
                                                   "su tarjeta); si se cortó la luz, no se sabe: mirá la pantalla")
            return None
        v = self.v
        est = v.get("gcode_state")
        if self.volvio:
            mismo = self.mismo_trabajo(v)
            if mismo is None and est != "IDLE":
                # el informe no dice de que trabajo es: se espera al siguiente. Con IDLE no: una A2L libre informa el
                # nombre vacio y el numero "0" para siempre, y la vigilancia no despertaria nunca (re-auditoria, TB-R2-1)
                return None
            self.volvio = False
            if not mismo and self.trabajo_cerrado:
                # el trabajo viejo ya estaba cerrado: la impresora esta con otro (una reimpresion); se vigila ese
                if est in ("RUNNING", "PREPARE", "PAUSE"):
                    self.trabajo = {"subtask_name": v.get("subtask_name"), "task_id": v.get("task_id"),
                                    "ult_pct": v.get("mc_percent"), "ult_capa": v.get("layer_num")}
                    self.trabajo_cerrado = False
                    return None
            elif est == "FINISH" and mismo:
                return SALIDA_TERMINO_SIN_VER, "terminó; no la vi terminar: revisá que no se haya despegado nada"
            elif est == "PAUSE" and mismo and not fin_de_rollo(v):
                return 2, ("volvió en pausa con el mismo trabajo, posible corte de luz: mirá la pantalla; "
                           "si ofrece reanudar, mirá la pieza antes")
            elif est == "PAUSE" and mismo:
                pass                                 # pausa del cargador: la dice la regla de abajo
            elif self.trabajo and (est in ("IDLE", "FAILED") or not mismo):
                return 1, "el trabajo ya no está: probable corte sin reanudar, o alguien lo canceló"
        if est == "FINISH":
            return 0, "terminó"
        if est == "FAILED":
            return 1, "falló o la cancelaron"
        if est == "PAUSE":
            if self.en_pausa:
                return None
            if v.get("hms") or v.get("print_error"):
                self.alarma = _clave_alarma(v)      # la alarma de esta pausa ya quedo avisada (re-auditoria, R3)
            cod = fin_de_rollo(v)
            if cod:
                lug = _lugar_activo(v)
                return 2, (f"pausa del cargador (código {cod}): si la pantalla dice que se terminó el filamento, "
                           f"cargá un rollo igual en el lugar {lug + 1 if lug is not None else '?'} y tocá reanudar; "
                           "si dice enredo, destrabalo antes")
            return 2, "en pausa: mirá la pantalla"
        if v.get("hms") or v.get("print_error"):
            clave = _clave_alarma(v)
            if not (self.en_pausa and clave == self.alarma):
                self.alarma = clave
                return 2, f"alarma de la impresora (error {v.get('print_error')}, hms {v.get('hms')})"
        if est == "IDLE" and self.ult_corriendo:
            return 1, "el trabajo ya no está (la impresora quedó libre sin terminar): alguien lo canceló en la pantalla"
        if self.ult_avance is not None and t - self.ult_avance > QUIETA_S:
            return 3, (f"15 minutos sin avanzar con la impresora contestando ({est}, etapa {v.get('stg_cur')}, "
                       f"capa {v.get('layer_num')})")
        return None


def _clave_alarma(v):
    return f"{v.get('print_error')}|{json.dumps(v.get('hms'), sort_keys=True)}"


def clasificar(lecturas, buscar=False, previo=None, en_pausa=False, trabajo_cerrado=False):
    """Lecturas guardadas [(t, informe | None | 'acceso' | 'vida')] -> (salida, texto) de la primera decision, o
    (None, texto) si la impresion sigue. None = esa vuelta no llego nada (sin conexion); 'acceso' = la impresora
    rechazo el codigo; 'vida' = llego solo un aviso de vida (PINGRESP), ningun informe. Es la misma regla que usa
    --seguir."""
    if not lecturas:
        return None, "sin lecturas"
    vig = Vigia(lecturas[0][0], previo, buscar=buscar, en_pausa=en_pausa, trabajo_cerrado=trabajo_cerrado)
    visto = {}
    for t, x in lecturas:
        if x is None:
            vig.falla(t, "red")
        elif x == "acceso":
            vig.falla(t, "acceso")
        elif x == "vida":
            vig.vida(t)
        else:
            vig.mensaje(t, fusionar(visto, x))
        r = vig.evaluar(t)
        if r:
            return r
    return None, "imprime y avanza"


def _pid_vivo(pid):
    """Sin os.kill(pid, 0): en Windows esa llamada TERMINA el proceso."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return False
    if os.name == "nt":
        import ctypes
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x1000, False, pid)            # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        try:
            codigo = ctypes.c_ulong()
            return bool(k.GetExitCodeProcess(h, ctypes.byref(codigo))) and codigo.value == 259   # STILL_ACTIVE
        finally:
            k.CloseHandle(h)
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


class YaVigilada(FallaImpresora):
    salida = SALIDA_YA_VIGILADA


def _candado_vivo(ruta):
    try:
        c = json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    # vence a los `vence_s` que declaro su duenio (la espera mas larga de su vuelta + margen), nunca antes de 3 min:
    # con --en-pausa la vuelta espera 5 min y un vencimiento fijo de 3 dejaba entrar una segunda vigilancia (auditoria 16/10)
    vence = max(CANDADO_VENCE_S, float(c.get("vence_s") or 0))
    if (c.get("pid") != os.getpid() and _pid_vivo(c.get("pid"))
            and time.time() - float(c.get("refrescado") or 0) < vence):
        return c
    return None


def _vigilancia_viva():
    """Otra vigilancia viva en esta PC (ella cierra el registro: los demas comandos no concilian)."""
    return _candado_vivo(DATOS.with_name("bambu-a2l-vigilancia.json")) is not None


class Candado:
    """<carpeta>/vigilancia.pid: una sola vigilancia por carpeta. Se refresca en cada vuelta; el de un proceso
    muerto, o sin refrescar hace mas de 3 minutos (numero de proceso reusado), no cuenta."""

    def __init__(self, carpeta):
        self.ruta = Path(carpeta) / "vigilancia.pid"
        self.global_ = DATOS.with_name("bambu-a2l-vigilancia.json")
        otro = _candado_vivo(self.ruta)
        if otro:
            raise YaVigilada(f"ya hay una vigilancia (PID {otro.get('pid')}) sobre esta carpeta: {carpeta}. "
                             "No se lanza otra.")
        self.refrescar()

    def refrescar(self, vence_s=CANDADO_VENCE_S):
        dato = {"pid": os.getpid(), "refrescado": time.time(), "vence_s": float(vence_s), "carpeta": str(self.ruta.parent)}
        for r in (self.ruta, self.global_):
            try:
                _escribir_json(r, dato)
            except (OSError, FallaImpresora):
                pass

    def soltar(self):
        for r in (self.ruta, self.global_):
            try:
                if json.loads(r.read_text(encoding="utf-8")).get("pid") == os.getpid():
                    r.unlink()
            except (OSError, ValueError):
                pass


PY_DETECTOR = Path(r"C:\Dev\_printguard\.venv\Scripts\python.exe")
RECORTE_PLACA = "200,0,1300,460"      # zona de la placa en la foto de la A2L (1536 x 1080)
# Cuantas lecturas altas SEGUIDAS hacen falta para avisar. Medido el 13/10/2026 en dos impresiones:
# en un cambio de color la cama se va atras y la pieza sale del cuadro; eso da 1 o 2 lecturas altas
# seguidas (0,72 y 0,82; 0,64 y 0,66) y nunca 3. Con 3 no hubo ninguna falsa alarma en 60 lecturas
# de un solo color ni en 20 con 12 cambios de color. Costo: una falla real se avisa ~4 min despues.
SEGUIDAS = 3
UMBRAL_DETECTOR = 0.45                # distancia a "pieza sana"; sana medida el 13/10/2026: 0,23 a 0,27
VUELTAS_SIN_MEDIR = 3                 # vueltas imprimiendo sin una lectura del detector -> «DETECTOR SIN MEDIR» en el log


def medir_foto(ruta, d=None):
    """Saca una foto y devuelve las distancias del detector ({'success':..,'failure':..}) o None."""
    import subprocess
    if not PY_DETECTOR.exists():            # sin el detector no se le saca una foto por vuelta a la camara
        return None
    try:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        foto(str(ruta), d)
        r = subprocess.run([str(PY_DETECTOR), str(Path(__file__).with_name("detector_fallas.py")),
                            str(ruta), "--recorte", RECORTE_PLACA], capture_output=True, text=True, timeout=60)
        m = re.search(r"\{.*\}", r.stdout.splitlines()[-1]) if r.stdout.strip() else None
        return json.loads(m.group(0)) if m else None
    except (Exception, SystemExit):          # la camara o el detector no tiran abajo la vigilancia; Ctrl+C si
        return None


def seguir(carpeta, cada=60, fotos_en=(), despertar_min=0, detector=True, solo_medir=False, buscar=False,
           en_pausa=False, frase_sin_detector=None):
    """Vigila la impresion hasta que termina. SOLO LEE (estado + camara), con UNA conexion que queda abierta.

    Salidas: 0 termino bien · 1 fallo, se cancelo o el trabajo ya no esta · 2 pausa o alarma (con su texto: posible
    corte de luz, fin de rollo) · 3 quince minutos sin avanzar CON la impresora contestando · 10 «mira esta foto y
    relanzame» (--despertar) · 11 alarma del detector · 12 sin conexion (antes de salir la busca; si esta en otra
    direccion corrige y sigue) · 13 rechazo el codigo dos veces seguidas · 14 termino mientras no la veia ·
    15 ya hay otra vigilancia sobre esa carpeta · 16 error del programa (no de la impresora). 4 y 5 no se usan
    (son del latido de la casa).
    --buscar: despues de un 12, prueba ubicar() cada 2 min y solo sale cuando la encuentra (y sigue vigilando) o a la
    hora estimada de fin + 1 h. --en-pausa: con la impresora en pausa no sale; mira cada 5 min hasta que vuelva.
    Deja en <carpeta> seguimiento.log (fecha y hora con zona), estado_seguimiento.json (el reloj de «quieta» y el
    trabajo, para la proxima relanzada) y fotos: capa 1, las capas pedidas, una cada 15 minutos y la final.
    El detector va prendido por defecto (23/10/2026); --solo-medir lo deja anotando sin alarma; sin detector solo con
    --sin-detector y la frase de Fak, y entonces el primer renglon del log dice «VIGILANCIA SIN DETECTOR». De noche
    (de 20:45 a 08:15, detectorCanon.data.json) el detector anota y no da alarma: una foto negra no es «se ve bien».
    """
    d = cargar_datos()
    carpeta = Path(carpeta)
    ruta_de_prueba_ok(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    candado = Candado(carpeta)
    try:
        return _seguir(d, carpeta, candado, cada, fotos_en, despertar_min, detector, solo_medir, buscar, en_pausa,
                       frase_sin_detector)
    finally:
        candado.soltar()


def _seguir(d, carpeta, candado, cada, fotos_en, despertar_min, detector, solo_medir, buscar, en_pausa,
            frase_sin_detector=None):
    import registro
    ruta_estado = carpeta / "estado_seguimiento.json"
    try:
        previo = json.loads(ruta_estado.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previo = {}
    t_prev = previo.get("trabajo") or {}
    cerrado = False
    try:
        # ¿El trabajo que vigilaba la corrida anterior en esta carpeta ya esta CERRADO en el registro? (una reimpresion
        # en la misma carpeta, o lo cerro otro comando). Si al volver la impresora informa otro trabajo, se toma ese y
        # no se cierra como fallida la impresion nueva (auditoria 16/10, TB3); si informa el mismo terminado, sigue
        # siendo 14 (re-auditoria). Un registro que no se puede leer no impide vigilar (revision 16/10).
        cerrado = bool(t_prev.get("subtask_name")
                       and registro.trabajo_de(t_prev.get("subtask_name"), t_prev.get("task_id")) is None
                       and registro.trabajo_de(t_prev.get("subtask_name"), t_prev.get("task_id"), solo_abiertas=False))
    except (Exception, SystemExit) as e:
        print(f"  (no se pudo leer el registro al arrancar: {type(e).__name__}: {e}; se vigila igual)", flush=True)
    vig = Vigia(time.time(), previo, buscar=buscar, en_pausa=en_pausa, trabajo_cerrado=cerrado)
    noche_solo_mide = canon_detector().get("de_noche", "solo-medir") == "solo-medir"
    extra = {k: previo.get(k) for k in ("sin_camara_desde", "tray_now", "fin_estimado", "rollo_anotado", "chip_activo",
                                        "esperando_desde")}
    log = open(carpeta / "seguimiento.log", "a", encoding="utf-8")
    hechas, ult_foto = set(), 0.0
    t0 = time.time()
    historial = []
    con, ult_busqueda, enviada = None, 0.0, {}

    def anotar_log(linea):
        print(linea, flush=True)
        log.write(linea + "\n")
        log.flush()

    def guardar():
        try:
            _escribir_json(ruta_estado, {**vig.estado(), **extra, "guardado": _iso()})
        except (OSError, FallaImpresora) as e:
            print("  (no se pudo guardar el estado de la vigilancia:", e, ")")

    def sacar(nombre):
        """Una foto; devuelve la ruta o None. La camara que no contesta se anota UNA vez, no en cada vuelta."""
        if con is None:
            return None
        ruta = carpeta / f"{time.strftime('%H%M')}_{nombre}.jpg"
        try:
            with open(os.devnull, "w") as nada:
                import contextlib
                with contextlib.redirect_stdout(nada):
                    ok = foto(str(ruta), d) == 0
        except (Exception, SystemExit):
            ok = False
        if ok:
            if extra.get("sin_camara_desde"):
                anotar_log(f"{_iso()} la cámara volvió a contestar")
                extra["sin_camara_desde"] = None
            return ruta
        if not extra.get("sin_camara_desde"):
            extra["sin_camara_desde"] = time.time()
            anotar_log(f"{_iso()} sin cámara desde las {_hora(time.time())} (la vigilancia sigue con el estado)")
        return None

    def trabajo_del_registro():
        """El renglon «enviada» del trabajo que se vigila (para el reparto de gramos), o {}."""
        if not enviada and vig.trabajo:
            e = registro.trabajo_de(vig.trabajo.get("subtask_name"), vig.trabajo.get("task_id"))
            enviada.update(e or {"_no_esta": True})
        return {} if enviada.get("_no_esta") else enviada
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

    def cambio_de_rollo(v):
        """Si a mitad de la impresion la impresora paso a un lugar que el trabajo no usa con el mismo material y
        color (el respaldo automatico), se anota con la capa: al cerrar, los gramos se reparten entre los dos chips."""
        nuevo, viejo = _lugar_activo(v), extra.get("tray_now")
        extra["tray_now"] = nuevo if nuevo is not None else viejo
        chip_viejo = extra.get("chip_activo")
        chip_nuevo = rollos_del_cargador(v).get(nuevo) if nuevo is not None else None
        if chip_nuevo:
            extra["chip_activo"] = chip_nuevo
        if (nuevo is not None and nuevo == viejo and chip_viejo and chip_nuevo and chip_nuevo != chip_viejo
                and v.get("gcode_state") == "RUNNING"):
            # rollo nuevo cargado en el MISMO lugar (lo que dice el aviso de fin de rollo): cambia el chip, no el lugar
            e = trabajo_del_registro()
            if e:
                registro.anotar({"tipo": "cambio de rollo", "trabajo_id": e["trabajo_id"], "de_lugar": nuevo + 1,
                                 "a_lugar": nuevo + 1, "de_chip": chip_viejo, "a_chip": chip_nuevo,
                                 "capa": v.get("layer_num"), "capas": v.get("total_layer_num"),
                                 "nota": "rollo nuevo en el mismo lugar; reparto estimado por capas"})
                anotar_log(f"{_iso()} rollo nuevo en el lugar {nuevo + 1} en la capa {v.get('layer_num')}")
            return
        if nuevo is None or viejo is None or nuevo == viejo or v.get("gcode_state") != "RUNNING":
            return
        e = trabajo_del_registro()
        usados = {int(f.get("lugar")) - 1 for f in e.get("filamentos", []) if f.get("lugar")}
        lug = lugares_del_cargador(v)
        if not e or nuevo in usados or viejo not in usados or lug.get(nuevo, ("", "", ""))[::2] != lug.get(viejo, ("", "", ""))[::2]:
            return                                  # un cambio de color normal del trabajo, o algo que no se entiende
        chips = rollos_del_cargador(v)
        registro.anotar({"tipo": "cambio de rollo", "trabajo_id": e["trabajo_id"], "de_lugar": viejo + 1,
                         "a_lugar": nuevo + 1, "de_chip": chips.get(viejo), "a_chip": chips.get(nuevo),
                         "capa": v.get("layer_num"), "capas": v.get("total_layer_num"),
                         "nota": "el respaldo automatico paso al rollo igual; reparto estimado por capas"})
        anotar_log(f"{_iso()} cambio de rollo: del lugar {viejo + 1} al {nuevo + 1} en la capa {v.get('layer_num')}")

    sin_medir = {"vueltas": 0, "avisado": False}

    def detector_linea(v):
        """El filtro barato (sin tokens): una foto por vuelta pasada por el modelo de PrintGuard. Devuelve
        (texto para la linea, True si hay alarma)."""
        dd = medir_foto(carpeta / "por_minuto" / f"{time.strftime('%H%M%S')}.jpg", d)
        if not dd:
            # «bandera puesta» no es «detector midiendo» (B6, 23/10): tras N vueltas sin lectura queda escrito
            sin_medir["vueltas"] += 1
            if sin_medir["vueltas"] >= VUELTAS_SIN_MEDIR and not sin_medir["avisado"]:
                sin_medir["avisado"] = True
                motivo = (f"no está el Python del detector ({PY_DETECTOR}; instalar_detector.py --probar)"
                          if not PY_DETECTOR.exists() else "la cámara o el detector no devolvieron una lectura")
                anotar_log(f"{_iso()} DETECTOR SIN MEDIR hace {sin_medir['vueltas']} vueltas: {motivo}. "
                           "La vigilancia del estado sigue")
            return "", False
        if sin_medir["avisado"]:
            anotar_log(f"{_iso()} el detector volvió a medir")
        sin_medir.update(vueltas=0, avisado=False)
        # Una foto sacada durante un cambio de filamento NO cuenta: la cama se va para atras y la escena cambia
        # (13/10/2026: notas de 23, 32 y 54 sobre 100 con la pieza sana, las tres en cambios de color). Se relee el
        # estado justo despues de la foto: si antes o despues la impresora no estaba imprimiendo (etapa distinta de
        # 0), la lectura se anota y se descarta. Solo la etapa: sumar ams_status y tray_tar no separa (263 aparece con
        # la pieza sana a la vista y 768 con la cama corrida); queda en la linea para seguir juntando datos.
        try:
            con.leer(3)
            v2 = dict(con.visto)
        except SinConexion:
            v2 = {"stg_cur": None}
        despues = v2.get("stg_cur")
        txt = (f" [ams {v.get('ams_status')}/{v2.get('ams_status')} "
               f"obj {(v.get('ams') or {}).get('tray_tar')}/{(v2.get('ams') or {}).get('tray_tar')}]")
        if dd and (v.get("stg_cur") != 0 or despues != 0):
            return txt + (f" | detector exito {dd['success']:.3f} falla {dd['failure']:.3f} "
                          f"(NO CUENTA: etapa {v.get('stg_cur')}->{despues})"), False
        if noche_solo_mide and de_noche_ahora():
            # de 20:45 a 08:15 la foto sale negra: se anota y no cuenta (no entra en la base ni en las 3 seguidas,
            # y el renglon no lo relee la proxima relanzada)
            return txt + (f" | detector exito {dd['success']:.3f} falla {dd['failure']:.3f} "
                          "(DE NOCHE: anota, no cuenta)"), False
        historial.append(dd["success"])
        base = sorted(historial[:8])[len(historial[:8]) // 2]       # mediana de las primeras 8
        alarma = (not solo_medir and len(historial) >= 9
                  and all(x > max(UMBRAL_DETECTOR, base * 1.8) for x in historial[-SEGUIDAS:]))
        return txt + f" | detector exito {dd['success']:.3f} falla {dd['failure']:.3f}", alarma

    def al_registro(fn):
        """Lo que se escribe en el registro no cambia la salida de la vigilancia (OneDrive puede tener el archivo
        tomado): si falla, queda en el log y la salida sigue siendo la que es (auditoria 16/10)."""
        try:
            return fn()
        except (Exception, SystemExit) as e:
            anotar_log(f"{_iso()} no se pudo escribir en el registro ({type(e).__name__}: {e}); la salida no cambia")
            return None

    def terminar(salida, texto):
        """Lo que se hace al salir: foto, registro y el renglon final del log."""
        v = vig.v
        visto = bool(vig.ult_corriendo) and time.time() - vig.ult_corriendo < max(180, 3 * cada)
        if salida in (0, SALIDA_TERMINO_SIN_VER):
            final = sacar("FINAL")
            visto = visto and salida == 0
            res = al_registro(lambda: cerrar_trabajo(
                v, "terminada", vig.trabajo, visto_terminar=visto,
                nota="" if visto else "terminó mientras no se veía: hora real de fin desconocida"))
            if res:
                al_registro(lambda: completar_ficha(res[1], res[0], final))
        elif salida == 1:
            final = sacar("FALLO")
            if vig.trabajo:
                res = al_registro(lambda: cerrar_trabajo(v, "fallida", vig.trabajo, visto_terminar=visto, nota=texto))
                if res:
                    al_registro(lambda: completar_ficha(res[1], res[0], final))
        elif salida == 2:
            sacar("ALARMA")
            cod = fin_de_rollo(v)
            lug = _lugar_activo(v)
            if cod and extra.get("rollo_anotado") != cod:
                extra["rollo_anotado"] = cod
                al_registro(lambda: registro.anotar({
                    "tipo": "rollo terminado", "rollo": rollos_del_cargador(v).get(lug),
                    "lugar": None if lug is None else lug + 1, "codigo": cod, "confirmado": False,
                    "trabajo_id": (trabajo_del_registro() or {}).get("trabajo_id"),
                    "nota": "pausa del cargador: fin de rollo o enredo; confirmarlo en la pantalla "
                            "(el codigo de la A2L se anota tal cual la primera vez)"}))
        elif salida == 3:
            sacar("QUIETA")
        anotar_log(f"{_iso()} SALIDA {salida}: {texto}")
        return salida

    def linea_de(v):
        return (f"{_iso()} {v.get('gcode_state')} etapa {v.get('stg_cur')} capa {v.get('layer_num')}/"
                f"{v.get('total_layer_num')} {v.get('mc_percent')} % faltan {v.get('mc_remaining_time')} min "
                f"filamento {(v.get('ams') or {}).get('tray_now')} error {v.get('print_error')} hms {v.get('hms')}")

    def _vuelta():
        nonlocal con, ult_busqueda, ult_foto
        espera = EN_PAUSA_CADA if (en_pausa and vig.v.get("gcode_state") == "PAUSE") else cada
        candado.refrescar(2 * espera + 180)          # la vuelta mas larga (espera + foto + detector) con margen
        ahora_ = time.time()
        if con is None:
            try:
                if buscar and ahora_ - ult_busqueda >= BUSCAR_CADA and vig.desconectado_desde is not None:
                    ult_busqueda = ahora_
                    ubicar(d)
                con = Conexion(d, buscar=False)
            except AccesoRechazado as e:
                vig.falla(ahora_, "acceso", "rechazó el código")
            except SinConexion as e:
                vig.falla(ahora_, "red", e.texto.rstrip("."))
        if con is not None:
            try:
                # vuelve antes si llega el primer informe completo o si cambia el estado (termino, pausa, fallo)
                con.leer(espera, hasta=lambda v_, p: (vig.ult_mensaje is None and _informe_completo(v_, p)) or (
                    "gcode_state" in p and bool(vig.v) and p["gcode_state"] != vig.v.get("gcode_state")))
                vig.vida(con.ult_paquete)                     # un aviso de vida dice que la conexion anda...
                if con.ult_informe and (vig.ult_mensaje is None or con.ult_informe > vig.ult_mensaje):
                    vig.mensaje(con.ult_informe, dict(con.visto))   # ...pero solo un INFORME cuenta como informe
            except SinConexion as e:
                con.cerrar()
                con = None
                vig.falla(time.time(), "red", e.texto.rstrip("."))
        if con is None:
            # sin conexion se espera antes de reintentar, tambien si la conexion abrio y murio en esta misma vuelta
            # (una impresora que acepta y corta: 47 conexiones por segundo sin esta espera, revision 16/10)
            time.sleep(min(cada, 10))
        t = time.time()
        v = vig.v
        r = vig.evaluar(t)
        if r and r[0] == SALIDA_SIN_CONEXION:
            # Antes de salir con 12 se la busca. La vigilancia sigue solo si, donde la encuentra, vuelve a mandar
            # informes: una impresora que conecta y queda muda (o solo contesta el aviso de vida) en la misma direccion
            # hacia girar la vigilancia para siempre sin despertar nunca a la sesion (auditoria 16/10, TB1).
            try:
                ubicar(d)
                if con is not None:
                    con.cerrar()
                    con = None
                prueba = Conexion(d, buscar=False)
                try:
                    prueba.leer(15, hasta=_informe_completo)
                except SinConexion:
                    prueba.visto = {}
                if prueba.visto:
                    con = prueba
                    anotar_log(f"{_iso()} la encontré en {d['ip']}: sigo vigilando")
                    vig.mensaje(con.ult_informe or time.time(), dict(con.visto))
                    r = vig.evaluar(time.time())     # lo que trae al volver se juzga YA (terminó sin verla, pausa...)
                    v = vig.v
                else:
                    prueba.cerrar()
                    r = (r[0], r[1] + f". En {d['ip']} la impresora acepta la conexión pero no manda informes: "
                                      "mirá su pantalla (si está colgada, apagarla y prenderla lo decide quien está ahí)")
            except AccesoRechazado:
                vig.falla(time.time(), "acceso", "rechazó el código")
                r = vig.evaluar(time.time()) or r     # el segundo rechazo es 13, no un 12 (revision 16/10)
            except SinConexion as e:
                r = (r[0], r[1] + ". " + e.texto)
        if vig.trabajo:
            extra["esperando_desde"] = None          # ya arranco: la espera termino
        if r and r[0] in (0, 1) and not vig.trabajo and fin_de_otro_trabajo(v):
            # La vigilancia se lanza en el mismo mensaje que el envio, que tarda ~2 min en subir: la impresora todavia
            # muestra el fin de la pieza ANTERIOR (cerrada, o mandada desde Bambu Studio o la pantalla). No es
            # «terminó»: se espera a que arranque la nueva (revision 16/10). Desde cuando se espera queda en el estado
            # guardado, asi las relanzadas de --despertar no vuelven el reloj a cero; y vale tambien para lo que se
            # recalcula al volver la conexion (re-auditoria R4).
            if not extra.get("esperando_desde"):
                extra["esperando_desde"] = time.time()
                anotar_log(f"{_iso()} la impresora muestra el fin de {v.get('subtask_name')}, que no es el trabajo "
                           "nuevo: espero que arranque la impresión nueva")
            if time.time() - extra["esperando_desde"] < ESPERA_ARRANQUE_S:
                r = None
            else:
                r = (1, f"no arrancó ninguna impresión nueva en {ESPERA_ARRANQUE_S // 60:.0f} min: la impresora sigue "
                        f"mostrando el fin de {v.get('subtask_name')}")
        if buscar and con is not None and vig.desconectado_desde is not None:
            # --buscar: una conexion abierta que no trae informes se suelta, asi la proxima vuelta la vuelve a buscar
            con.cerrar()
            con = None
        if con is None or vig.desconectado_desde is not None:
            anotar_log(f"{_iso()} SIN CONEXION desde las {_hora(vig.desconectado_desde or vig.inicio)}"
                       + (f" ({vig.motivo})" if vig.motivo else ""))
            guardar()
            if r:
                return terminar(*r)
            if buscar:
                fin = extra.get("fin_estimado")
                limite = (fin + 3600) if fin else (vig.inicio + 12 * 3600)
                if t > limite:
                    return terminar(SALIDA_SIN_CONEXION, "sigue sin aparecer y ya pasó la hora estimada de fin + 1 h: "
                                                         "mirá la pantalla de la impresora")
            return None
        if v.get("gcode_state") == "RUNNING" and v.get("mc_remaining_time") is not None:
            try:
                extra["fin_estimado"] = t + float(v["mc_remaining_time"]) * 60
            except (TypeError, ValueError):
                pass
        linea = linea_de(v)
        alarma = False
        if detector and v.get("gcode_state") == "RUNNING":
            txt, alarma = detector_linea(v)
            linea += txt
        anotar_log(linea + (" | ALARMA DEL DETECTOR" if alarma else ""))
        if alarma:
            sacar("DETECTOR")
            guardar()
            return 11
        if not vig.trabajo or not vig.trabajo.get("_visto"):
            al_registro(lambda: anotar_visto(v))
            if vig.trabajo:
                vig.trabajo["_visto"] = True
        al_registro(lambda: cambio_de_rollo(v))
        capa = v.get("layer_num")
        if isinstance(capa, int):
            for c in (1,) + tuple(fotos_en):
                if capa >= c and c not in hechas:
                    hechas.add(c)
                    sacar(f"capa{c:03d}")
                    ult_foto = time.time()
        if time.time() - ult_foto > 900 and v.get("gcode_state") == "RUNNING":
            sacar("avance")
            ult_foto = time.time()
        guardar()
        if r:
            return terminar(*r)
        if despertar_min and time.time() - t0 > despertar_min * 60:
            ruta = sacar("REVISION")              # salida 10 = "mirá esta foto y relanzame"
            anotar_log(f"{_iso()} SALIDA 10: " + (f"foto para revisar {ruta.name}" if ruta
                                                  else "sin foto nueva: la cámara no contestó"))
            return 10
        return None

    if not detector:
        anotar_log(f"{_iso()} VIGILANCIA SIN DETECTOR: frase de Fak «{frase_sin_detector}» (--sin-detector); "
                   "la vigilancia del estado sigue")
        al_registro(lambda: registro.anotar({"tipo": "vigilancia", "modo": "sin detector", "frase": frase_sin_detector,
                                             "carpeta": str(carpeta), "pid": os.getpid(), "lanzada_por": "--seguir"}))
    elif solo_medir:
        anotar_log(f"{_iso()} VIGILANCIA SOLO MIDE (--solo-medir: el detector anota y no da alarma)")
    try:
        while True:
            r = _vuelta()
            if r is not None:
                guardar()
                return r
    finally:
        if con is not None:
            con.cerrar()
        log.close()


def selftest():
    """Lo que hace falta en esta PC para usar la skill, sin red y sin mostrar el codigo de acceso. Un renglon por
    chequeo: OK, FALTA (no anda) o AVISO (anda, con un limite). Sale con 1 si algo FALTA."""
    import importlib.util
    import registro
    filas = []

    def fila(nivel, que, detalle=""):
        filas.append(nivel)
        print(f"  {nivel:6} {que}" + (f": {detalle}" if detalle else ""))

    print(f"skill impresion-3d-bambu, version {VERSION}")
    fila("OK" if sys.version_info >= (3, 10) else "FALTA", "Python", sys.version.split()[0])
    exe = Path(r"C:\Program Files\Bambu Studio\bambu-studio.exe")
    fila("OK" if exe.exists() else "FALTA", "Bambu Studio (para laminar)", str(exe))
    maquinas = Path(os.environ.get("APPDATA", "")) / "BambuStudio" / "system" / "BBL" / "machine"
    a2l = list(maquinas.glob("*A2L*")) if maquinas.exists() else []
    fila("OK" if a2l else "FALTA", "perfiles de la A2L", f"{len(a2l)} en {maquinas}" if a2l else
         "abrir Bambu Studio una vez y elegir la A2L para que baje los perfiles")
    fila("OK" if importlib.util.find_spec("PIL") else "AVISO", "Pillow (dibujo de la primera capa)",
         "" if importlib.util.find_spec("PIL") else "sin Pillow el envio sigue, sin el dibujo: pip install pillow")
    venv = Path(__file__).resolve().parents[4] / ".venv-cad" / "Scripts" / "python.exe"
    fila("OK" if venv.exists() else "AVISO", ".venv-cad (para vista_previa.py)",
         str(venv) if venv.exists() else "sin el entorno CAD no hay vista previa en colores; lo demas anda")
    try:
        registro.ruta_de_prueba_ok(registro.CARPETA)
        registro.CARPETA.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryFile(dir=registro.CARPETA):
            pass
        fila("OK", "registro compartido (nube de Ingenieria) escribible", str(registro.CARPETA))
    except (OSError, SystemExit) as e:
        fila("FALTA", "registro compartido", f"{registro.CARPETA}: {e} (¿esta sincronizada la carpeta de Ingenieria?)")
    try:
        d = cargar_datos()
        fila("OK" if d.get("codigo_acceso") else "FALTA", "archivo de datos de la impresora",
             f"{d['_origen']} | serie {_serie_corta(d['serie'])} | codigo de acceso "
             + ("cargado" if d.get("codigo_acceso") else "FALTA: bambu_red.py --pedir-codigo"))
    except FallaImpresora as e:
        fila("FALTA", "archivo de datos de la impresora", e.texto.splitlines()[0])
    fila("OK" if PY_DETECTOR.exists() else "AVISO", "detector de fallas (PrintGuard)",
         str(PY_DETECTOR) if PY_DETECTOR.exists() else "sin el, --detector no anda: instalar_detector.py --probar")
    skill = Path(__file__).resolve().parents[1] / "SKILL.md"
    try:
        cab = re.search(r"[Vv]ersi[oó]n:?\**:? *(\d{4}-\d\d-\d\d)", skill.read_text(encoding="utf-8")[:1500])
    except OSError:
        cab = None
    fila("OK" if cab and cab.group(1) == VERSION else "AVISO", "SKILL.md y el programa son la misma version",
         f"SKILL.md {cab.group(1) if cab else 'sin version'} | programa {VERSION}")
    print("  AVISO  copia de la skill en la nube para comparar: no hay una publicada (la skill se pasa por mail en un zip)")
    print("RESULTADO:", "falta algo" if "FALTA" in filas else "listo para usar")
    return 1 if "FALTA" in filas else 0


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
        #                    [--buscar] [--en-pausa]
        #                    [--sin-detector --acepto "<frase de Fak>"]   (el detector va por defecto desde el 23/10)
        capas = tuple(_numeros(_valor(argv, "--fotos-en"), "--fotos-en")) if "--fotos-en" in argv else ()
        sin_detector, acepto = "--sin-detector" in argv, _valor(argv, "--acepto")
        error = error_de_frase(sin_detector, acepto)
        if not error and sin_detector and ("--detector" in argv or "--solo-medir" in argv):
            error = "--sin-detector no va junto con --detector ni con --solo-medir"
        if error:
            print("NO SE LANZA LA VIGILANCIA:", error)
            return SALIDA_ERROR_PROGRAMA
        return seguir(argv[2], cada=_valor(argv, "--cada", int, 60), fotos_en=capas,
                      despertar_min=_valor(argv, "--despertar", int, 0),
                      detector=not sin_detector, solo_medir="--solo-medir" in argv, buscar="--buscar" in argv,
                      en_pausa="--en-pausa" in argv, frase_sin_detector=acepto.strip() if sin_detector else None)
    if a in ("--pausar", "--reanudar", "--cancelar"):
        return orden_simple({"--pausar": "pause", "--reanudar": "resume", "--cancelar": "stop"}[a])
    if a == "--imprimir" and len(argv) >= 3:
        # --mapa 0,1 : filamento 1 del archivo -> lugar 1 del cargador, filamento 2 -> lugar 2
        # --sin-margen: manda aunque la cuenta de gramos no alcance (SOLO con la frase de Fak en el chat)
        # --en-seco: arma todo sin hablar con la impresora; --sin-detector: SOLO con --acepto "<frase de Fak>"
        mapa = _numeros(_valor(argv, "--mapa"), "--mapa") if "--mapa" in argv else None
        return imprimir(argv[2], mapa, "--apply" in argv, sin_margen="--sin-margen" in argv,
                        en_seco="--en-seco" in argv, sin_detector="--sin-detector" in argv,
                        acepto=_valor(argv, "--acepto"))
    if a == "--ficha" and len(argv) >= 3:
        return mostrar_ficha(argv[2])
    if a == "--selftest":
        return selftest()
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
        # en --seguir el 1 quiere decir «falló o la cancelaron»: un error del programa tiene su propia salida
        return SALIDA_ERROR_PROGRAMA if (argv or sys.argv)[1:2] == ["--seguir"] else 1


if __name__ == "__main__":
    sys.exit(main())
