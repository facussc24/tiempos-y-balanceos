"""Hablarle a la Bambu Lab A2L por la red local (modo desarrollador), sin librerias de terceros.

Uso (python del sistema):
  bambu_red.py --preparar 192.168.1.198     arma el archivo de datos (IP y numero de serie; el codigo
                                            de acceso lo escribe Fak a mano, este script NUNCA lo muestra)
  bambu_red.py --estado                     SOLO LEE: estado, temperaturas y filamentos cargados

Datos en %USERPROFILE%\\.claude\\bambu-a2l.json (fuera del repo, que es publico); copia para las otras PC en la nube de Ingenieria.
MQTT 3.1.1 sobre TLS, puerto 8883, usuario "bblp", clave = codigo de acceso de la pantalla.
"""
import json
import os
import re
import socket
import ssl
import struct
import sys
import time
from pathlib import Path

DATOS = Path(os.environ["USERPROFILE"]) / ".claude" / "bambu-a2l.json"
UNIDAD_CARGADOR_A2L = 16      # id fisico del cargador de 4 lugares de la A2L (lo informa la propia impresora)
# Copia compartida de los datos, en la nube de Ingenieria (OK de Fak 13/10/2026): asi la PC de un
# compañero se conecta sola. El repo es publico: el codigo de acceso NUNCA va en el repo.
DATOS_NUBE = (Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
              / "INGENIERIA BARACK (NUNCA BORRAR)" / "1- GENERAL" / "5. 3D" / "IMPRESORA BAMBU A2L" / "bambu-a2l.json")


def cargar_datos():
    """Datos de la impresora: primero los de esta PC; si no estan, los de la nube de Ingenieria."""
    for ruta in (DATOS, DATOS_NUBE):
        if ruta.exists():
            d = json.load(open(ruta, encoding="utf-8"))
            if d.get("ip") and d.get("serie"):
                return d
    raise SystemExit(
        "No encuentro los datos de la impresora.\n"
        f"  1. Mirar que este sincronizada la carpeta de Ingenieria: {DATOS_NUBE}\n"
        "  2. Si no esta: en la pantalla de la impresora, Ajustes > Solo LAN, leer la IP y correr\n"
        "     bambu_red.py --preparar <IP>   y despues   bambu_red.py --pedir-codigo\n"
        "  3. La PC tiene que estar en el mismo wifi que la impresora.")


def tls(ip, puerto=8883, timeout=8):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False          # la impresora firma con la CA propia de Bambu
    ctx.verify_mode = ssl.CERT_NONE
    raw = socket.create_connection((ip, puerto), timeout=timeout)
    return ctx.wrap_socket(raw)


def preparar(ip):
    if DATOS.exists():
        d = json.load(open(DATOS, encoding="utf-8"))
        print("el archivo ya existe y no se pisa:", DATOS, "| tiene codigo cargado:", bool(d.get("codigo_acceso")))
        return
    with tls(ip) as t:
        der = t.getpeercert(True)
    # el numero de serie es el CN del certificado del equipo (OID 2.5.4.3 = 55 04 03); buscar
    # "un texto largo en mayusculas" agarraba una FECHA de vigencia (13/10/2026)
    cns = [der[m.end():m.end() + m.group(1)[0]].decode("utf-8", "replace")
           for m in re.finditer(rb"\x55\x04\x03[\x0c\x13](.)", der, re.S)]
    cand = [c for c in cns if re.fullmatch(r"[0-9A-Z]{10,}", c)]
    serie = cand[-1] if cand else ""
    json.dump({"ip": ip, "serie": serie, "codigo_acceso": ""}, open(DATOS, "w", encoding="utf-8"), indent=1)
    print("escrito", DATOS, "| serie leida del certificado:", (serie[:4] + "..." + serie[-4:]) if serie else "NO ENCONTRADA")


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


def conectar(d):
    if not d.get("codigo_acceso"):
        raise SystemExit(f"falta el codigo de acceso en {DATOS}")
    s = tls(d["ip"])
    var = _txt("MQTT") + bytes([4, 0xC2]) + struct.pack(">H", 60)      # usuario + clave + sesion limpia
    cuerpo = var + _txt("barack-%d" % os.getpid()) + _txt("bblp") + _txt(d["codigo_acceso"])
    s.sendall(bytes([0x10]) + _largo(len(cuerpo)) + cuerpo)
    cab, dat = _paquete(s)
    if cab >> 4 != 2 or dat[1] != 0:
        motivo = {4: "usuario o codigo de acceso mal", 5: "no autorizado (codigo de acceso mal)"}.get(dat[1], f"codigo {dat[1]}")
        raise SystemExit(f"la impresora rechazo la conexion: {motivo}")
    return s


def suscribir(s, tema):
    cuerpo = struct.pack(">H", 1) + _txt(tema) + bytes([0])
    s.sendall(bytes([0x82]) + _largo(len(cuerpo)) + cuerpo)


def publicar(s, tema, obj):
    cuerpo = _txt(tema) + json.dumps(obj).encode("utf-8")
    s.sendall(bytes([0x30]) + _largo(len(cuerpo)) + cuerpo)


def escuchar(s, segundos):
    fin = time.time() + segundos
    s.settimeout(1.0)
    while time.time() < fin:
        try:
            cab, dat = _paquete(s)
        except (socket.timeout, TimeoutError):
            continue
        if cab >> 4 == 3:
            n = struct.unpack(">H", dat[:2])[0]
            try:
                yield json.loads(dat[2 + n:].decode("utf-8", "replace"))
            except Exception:
                pass


def estado():
    d = cargar_datos()
    s = conectar(d)
    print("conectado a la impresora (el codigo de acceso es correcto)")
    suscribir(s, f"device/{d['serie']}/report")
    publicar(s, f"device/{d['serie']}/request", {"pushing": {"sequence_id": "0", "command": "pushall"}})
    visto = {}
    for m in escuchar(s, 8):
        p = m.get("print")
        if isinstance(p, dict):
            visto.update(p)
    s.close()
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
    json.dump(visto, open(DATOS.with_name("bambu-a2l-ultimo-estado.json"), "w", encoding="utf-8"), indent=1)
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
    except BaseException as e:
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
    s = conectar(d)
    suscribir(s, f"device/{d['serie']}/report")
    tam = subir(d, archivo, nombre)
    print("  subido; tamano en la impresora:", tam, "| local:", archivo.stat().st_size)
    if tam is not None and tam != archivo.stat().st_size:
        print("  EL ARCHIVO NO LLEGO ENTERO: no se manda a imprimir")
        return 1
    publicar(s, f"device/{d['serie']}/request", orden)
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
    except BaseException as e:
        print("  (no se pudo anotar en el registro:", type(e).__name__, e, ")")
    visto, ultimo = {}, None
    for m in escuchar(s, 150):
        p = m.get("print")
        if isinstance(p, dict):
            visto.update(p)
            est = (visto.get("gcode_state"), visto.get("print_error"), visto.get("stg_cur"))
            if est != ultimo:
                print("  impresora:", {"estado": est[0], "error": est[1], "etapa": est[2],
                                       "respuesta": p.get("result"), "motivo": p.get("reason")})
                ultimo = est
    s.close()
    return 0 if visto.get("gcode_state") in ("PREPARE", "RUNNING", "SLICING") else 1


def foto(salida):
    """Saca UNA foto de la camara de la impresora (puerto 6000, el mismo flujo que usan A1/P1)."""
    d = cargar_datos()
    if not d.get("codigo_acceso"):
        raise SystemExit(f"falta el codigo de acceso en {DATOS}")
    s = tls(d["ip"], 6000, timeout=10)
    auth = struct.pack("<IIII", 0x40, 0x3000, 0, 0)
    auth += "bblp".encode().ljust(32, b"\x00") + d["codigo_acceso"].encode().ljust(32, b"\x00")
    s.sendall(auth)
    s.settimeout(10)
    fin = time.time() + 20
    while time.time() < fin:
        cab = _leer(s, 16)
        largo = struct.unpack("<I", cab[:4])[0]
        if not 0 < largo < 5_000_000:
            raise SystemExit(f"la camara contesto algo que no es una foto (largo {largo})")
        img = _leer(s, largo)
        if img[:2] == b"\xff\xd8" and img[-2:] == b"\xff\xd9":
            open(salida, "wb").write(img)
            s.close()
            print("foto guardada:", salida, f"({len(img)/1000:.0f} KB)")
            return 0
    s.close()
    print("no llego ninguna foto en 20 s")
    return 1


def leer_estado(d, segundos=6):
    s = conectar(d)
    suscribir(s, f"device/{d['serie']}/report")
    publicar(s, f"device/{d['serie']}/request", {"pushing": {"sequence_id": "0", "command": "pushall"}})
    visto = {}
    for m in escuchar(s, segundos):
        p = m.get("print")
        if isinstance(p, dict):
            visto.update(p)
    s.close()
    return visto


def orden_simple(comando):
    """pause / resume / stop."""
    d = cargar_datos()
    s = conectar(d)
    suscribir(s, f"device/{d['serie']}/report")
    publicar(s, f"device/{d['serie']}/request",
             {"print": {"sequence_id": "20010", "command": comando, "param": ""}})
    res = None
    for m in escuchar(s, 12):
        p = m.get("print")
        if isinstance(p, dict) and p.get("command") == comando:
            res = p.get("result")
            break
    s.close()
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
    s = conectar(d)
    publicar(s, f"device/{d['serie']}/request",
             {"print": {"sequence_id": "20011", "command": "print_speed", "param": str(nivel)}})
    s.close()
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
    s = conectar(d)
    suscribir(s, f"device/{d['serie']}/report")
    publicar(s, f"device/{d['serie']}/request",
             {"print": {"sequence_id": "20013", "command": "skip_objects", "obj_list": list(ids)}})
    res = None
    for m in escuchar(s, 12):
        p = m.get("print")
        if isinstance(p, dict) and p.get("command") == "skip_objects":
            res = p.get("result")
            break
    s.close()
    print(f"orden de saltear mandada {time.strftime('%H:%M:%S')} | respuesta: {res}")
    return 0 if res == "success" else 1


def esperar_enfriar(tope=35.0, maximo_min=45):
    """Espera a que la placa baje de `tope` grados y sale (salida 0 = ya se puede retirar la pieza).

    Bambu: sacar la pieza con la placa fria (wiki de la A2L: "wait for the heatbed and model to cool
    to room temperature"; ficha de la placa texturada: 35 C o menos). Corre en segundo plano: su
    salida avisa. Sale con 1 si en `maximo_min` minutos no bajo.
    """
    d = cargar_datos()
    t0 = time.time()
    while time.time() - t0 < maximo_min * 60:
        try:
            v = leer_estado(d, 4)
            cama = float(v.get("bed_temper", 99))
            print(f"{time.strftime('%H:%M:%S')} placa {cama:.0f} C (objetivo {v.get('bed_target_temper')}) "
                  f"estado {v.get('gcode_state')}", flush=True)
            if cama <= tope and v.get("gcode_state") in ("FINISH", "FAILED", "IDLE"):
                print(f"YA SE PUEDE RETIRAR: placa a {cama:.0f} C")
                return 0
        except BaseException as e:
            print(time.strftime("%H:%M:%S"), "sin respuesta:", type(e).__name__, flush=True)
        time.sleep(60)
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
    try:
        v = leer_estado(cargar_datos(), 4)
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
    except BaseException as e:
        lin.append(f"adentro: sin lectura ({type(e).__name__})")
    try:
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
    except BaseException as e:
        lin.append(f"afuera: sin pronostico ({type(e).__name__})")
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
    s = conectar(d)
    publicar(s, f"device/{d['serie']}/request",
             {"system": {"sequence_id": "20012", "command": "ledctrl", "led_node": "chamber_light",
                         "led_mode": modo, "led_on_time": 500, "led_off_time": 500,
                         "loop_times": 0, "interval_time": 0}})
    s.close()
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
    except BaseException as ex:
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
    except BaseException:
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
    json.dump(d, open(DATOS, "w", encoding="utf-8"), indent=1)
    print("codigo guardado (largo %d)" % len(cod.strip()))
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--pedir-codigo":
        sys.exit(pedir_codigo())
    if len(sys.argv) >= 3 and sys.argv[1] == "--preparar":
        preparar(sys.argv[2])
    elif len(sys.argv) >= 2 and sys.argv[1] == "--estado":
        sys.exit(estado())
    elif len(sys.argv) >= 3 and sys.argv[1] == "--saltear":
        # --saltear <archivo.gcode.3mf>            lista los objetos
        # --saltear <archivo.gcode.3mf> 12[,15]    plan;  con --apply lo manda
        ids = [int(x) for x in sys.argv[3].split(",")] if len(sys.argv) >= 4 and sys.argv[3][0].isdigit() else None
        sys.exit(saltear(sys.argv[2], ids, "--apply" in sys.argv))
    elif len(sys.argv) >= 2 and sys.argv[1] == "--ambiente":
        # --ambiente [minutos que dura la impresion]   -> sale con 2 si hay un aviso
        lin_, av_ = ambiente(float(sys.argv[2]) if len(sys.argv) >= 3 else 0)
        for x in lin_:
            print(" ", x)
        for x in av_:
            print("  AVISO:", x)
        sys.exit(2 if av_ else 0)
    elif len(sys.argv) >= 2 and sys.argv[1] == "--avisar-retiro":
        sys.exit(esperar_enfriar())
    elif len(sys.argv) >= 2 and sys.argv[1] == "--luz":
        sys.exit(luz(sys.argv[2] if len(sys.argv) >= 3 else None))      # --luz | --luz on | --luz off
    elif len(sys.argv) >= 2 and sys.argv[1] == "--velocidad":
        # --velocidad        muestra la actual;   --velocidad 1|2|3|4   la cambia
        sys.exit(velocidad(int(sys.argv[2]) if len(sys.argv) >= 3 else None))
    elif len(sys.argv) >= 3 and sys.argv[1] == "--foto":
        sys.exit(foto(sys.argv[2]))
    elif len(sys.argv) >= 3 and sys.argv[1] == "--seguir":
        # --seguir <carpeta> [--fotos-en 41,44]
        capas = ()
        if "--fotos-en" in sys.argv:
            capas = tuple(int(x) for x in sys.argv[sys.argv.index("--fotos-en") + 1].split(","))
        desp = int(sys.argv[sys.argv.index("--despertar") + 1]) if "--despertar" in sys.argv else 0
        # --detector: filtro de PrintGuard cada vuelta; --solo-medir: lo registra pero no da alarma
        cada_s = int(sys.argv[sys.argv.index("--cada") + 1]) if "--cada" in sys.argv else 60
        sys.exit(seguir(sys.argv[2], cada=cada_s, fotos_en=capas, despertar_min=desp,
                        detector="--detector" in sys.argv or "--solo-medir" in sys.argv,
                        solo_medir="--solo-medir" in sys.argv))
    elif len(sys.argv) >= 2 and sys.argv[1] in ("--pausar", "--reanudar", "--cancelar"):
        sys.exit(orden_simple({"--pausar": "pause", "--reanudar": "resume", "--cancelar": "stop"}[sys.argv[1]]))
    elif len(sys.argv) >= 3 and sys.argv[1] == "--imprimir":
        # --mapa 0,1 : filamento 1 del archivo -> lugar 1 del cargador, filamento 2 -> lugar 2
        mapa = None
        if "--mapa" in sys.argv:
            mapa = [int(x) for x in sys.argv[sys.argv.index("--mapa") + 1].split(",")]
        sys.exit(imprimir(sys.argv[2], mapa, "--apply" in sys.argv))
    else:
        print(__doc__)
