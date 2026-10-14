"""Lamina un .3mf con Bambu Studio por comando, con los perfiles COMPLETOS.

Uso (python del sistema o .venv-cad):
  laminar_bambu.py <entrada.3mf> <carpeta de salida NUEVA> --filamento "Bambu PLA Basic" [--filamento ...]
                   [--proceso "0.20mm Standard"] [--impresora "Bambu Lab A2L"]
                   [--boquilla 0.4] [--color "#000000" ...] [--parte-filamento "1=2" --parte-filamento "2=1"]

Por que existe: pasarle a bambu-studio.exe los perfiles del sistema tal cual NO resuelve la
herencia (`inherits`): el 13/10/2026 salio boquilla 200 C, flujo 1, densidad 0 y un solo
filamento. Aca se APLANA cada perfil (padre primero, hijo encima) y se le pasa el resultado.

No manda nada a la impresora y no pisa una corrida anterior: la carpeta de salida tiene que
estar vacia o no existir. Deja <salida>/<nombre>.gcode.3mf + resumen.json, y sale con 1 si el
resultado no pasa los controles (temperatura, densidad, cambios de filamento).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

EXE = Path(r"C:\Program Files\Bambu Studio\bambu-studio.exe")
SIS = Path(os.environ["APPDATA"]) / "BambuStudio" / "system" / "BBL"


def indice(tipo):
    out = {}
    for f in (SIS / tipo).glob("*.json"):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        out[d.get("name", f.stem)] = d
    return out


def aplanar(nombre, idx, pila=()):
    if nombre not in idx:
        raise SystemExit(f"no existe el perfil '{nombre}'. Parecidos: "
                         f"{[n for n in idx if nombre.split(' @')[0] in n][:8]}")
    if nombre in pila:
        raise SystemExit(f"herencia circular en {nombre}")
    d = idx[nombre]
    base = aplanar(d["inherits"], idx, pila + (nombre,)) if d.get("inherits") else {}
    # "include": plantillas aparte (el arranque, el cambio de filamento y el final PROPIOS de la
    # maquina). Sin esto el codigo sale con el arranque generico del perfil comun: lamina "bien"
    # y no sirve para esa impresora (13/10/2026, A2L).
    for inc in d.get("include", []) or []:
        if inc not in idx:
            raise SystemExit(f"falta la plantilla '{inc}' que pide '{nombre}'")
        base.update({k: v for k, v in idx[inc].items()
                     if k not in ("name", "type", "instantiation", "from", "setting_id")})
    base.update({k: v for k, v in d.items() if k not in ("inherits", "include")})
    return base


def escribir(d, ruta):
    d = dict(d)
    d["inherits"] = ""
    d["from"] = "system"
    # el *_settings_id del padre viene vacio y lo pisa: sin el nombre, Bambu Studio rechaza la
    # combinacion ("printer is not compatible with the process preset")
    clave = {"machine": "printer_settings_id", "process": "print_settings_id",
             "filament": "filament_settings_id"}[d["type"]]
    d[clave] = [d["name"]] if d["type"] == "filament" else d["name"]
    json.dump(d, open(ruta, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return str(ruta)


def asignar_partes(entrada, salida, reglas):
    """Copia el .3mf cambiando en Metadata/model_settings.config: parte cuyo nombre contiene X -> filamento N."""
    with zipfile.ZipFile(entrada) as zi, zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as zo:
        nombres = zi.namelist()
        if "Metadata/model_settings.config" not in nombres:
            raise SystemExit("el .3mf no trae model_settings.config: abrirlo y guardarlo una vez "
                             "con Bambu Studio, o laminarlo sin --parte-filamento")
        for n in nombres:
            if n.endswith((".gcode", ".gcode.md5", "slice_info.config")):
                continue
            data = zi.read(n)
            if n == "Metadata/model_settings.config":
                s = data.decode("utf-8")
                hechos, claves_ok = [], []

                def parte(m):
                    blo = m.group(0)
                    nom = re.search(r'key="name" value="([^"]*)"', blo).group(1)
                    pid = re.search(r'<part id="(\d+)"', blo).group(1)
                    for clave, num in reglas:
                        # clave numerica = numero de parte (Bambu Studio renombra las partes al
                        # importar: "<objeto>", "<objeto>_2"); si no, texto contenido en el nombre
                        if clave.startswith("obj:"):
                            continue
                        if (clave == pid) if clave.isdigit() else (clave.lower() in nom.lower()):
                            blo = re.sub(r'\s*<metadata key="extruder" value="[^"]*"/>', "", blo)
                            blo = re.sub(r'(<metadata key="name" value="[^"]*"/>)',
                                         r'\1\n      <metadata key="extruder" value="%d"/>' % num, blo, 1)
                            hechos.append((nom, num))
                            claves_ok.append(clave)
                    return blo
                s = re.sub(r"<part .*?</part>", parte, s, flags=re.S)
                # el filamento del OBJETO = el de la parte 1 (el cuerpo): la miniatura del archivo
                # se pinta con ese, y con el 1 por defecto salia toda del color del grabado
                # reglas "obj:<nombre>" = un OBJETO entero (placa con varias piezas, una por color)
                for clave, num in [r for r in reglas if r[0].startswith("obj:")]:
                    patron = (r'(<object id="\d+">\s*<metadata key="name" value="%s"/>\s*)'
                              r'<metadata key="extruder" value="\d+"/>' % re.escape(clave[4:]))
                    s, n_sub = re.subn(patron, lambda m, k=num: m.group(1) +
                                       '<metadata key="extruder" value="%d"/>' % k, s, count=1)
                    if n_sub:
                        hechos.append((clave, num))
                        claves_ok.append(clave)
                cuerpo = next((num for nom, num in hechos if nom == hechos[0][0]), None) \
                    if hechos and not any(r[0].startswith("obj:") for r in reglas) else None
                # con reglas "obj:" cada objeto ya tiene su filamento: el del cuerpo no se le pisa a ninguno
                if cuerpo:
                    s = re.sub(r'(<object id="\d+">\s*<metadata key="name" value="[^"]*"/>\s*)'
                               r'<metadata key="extruder" value="\d+"/>',
                               lambda m: m.group(1) + '<metadata key="extruder" value="%d"/>' % cuerpo,
                               s, count=1)
                if len(hechos) != len(reglas) or sorted(claves_ok) != sorted(r[0] for r in reglas):
                    raise SystemExit(f"no encontre todas las partes pedidas: {hechos} de {reglas}")
                data = s.encode("utf-8")
            zo.writestr(n, data)
    return salida


ap = argparse.ArgumentParser()
ap.add_argument("entrada")
ap.add_argument("salida")
ap.add_argument("--impresora", default="Bambu Lab A2L")
ap.add_argument("--boquilla", default="0.4")
ap.add_argument("--proceso", default="0.20mm Standard")
ap.add_argument("--filamento", action="append", required=True)
ap.add_argument("--parte-filamento", action="append", default=[])
ap.add_argument("--ajuste", action="append", default=[],
                help='ajuste del proceso sobre el perfil, clave=valor (nombres de Bambu Studio): '
                     'wall_loops=5, sparse_infill_density=30%%, top_shell_layers=6 ...')
ap.add_argument("--cama", default=None, help="por defecto, la default_bed_type del modelo de impresora")
ap.add_argument("--color", action="append", default=[], help="un color por filamento, #RRGGBB")
ap.add_argument("--acomodar", action="store_true",
                help="reacomoda las piezas en la cama (un .3mf armado para otra impresora mas grande)")
a = ap.parse_args()

out = Path(a.salida).resolve()      # absoluta: bambu-studio corre con otra carpeta de trabajo
if out.exists() and any(out.iterdir()):
    raise SystemExit(f"la carpeta de salida ya tiene archivos y no se pisa: {out}")
out.mkdir(parents=True, exist_ok=True)
tmp = out / "_perfiles"
tmp.mkdir()

im, ip, ifi = indice("machine"), indice("process"), indice("filament")
# la cama: la que el json del MODELO da por defecto, salvo que se pida otra; nunca una que ese
# modelo no admite (13/10/2026: por comando salia "Cool Plate", que la A2L no soporta)
_mod = next((d for d in im.values() if d.get("name") == a.impresora and d.get("default_bed_type")), {})
CAMA = a.cama or _mod.get("default_bed_type")
if CAMA and CAMA in str(_mod.get("not_support_bed_type", "")).split(";"):
    raise SystemExit(f"la {a.impresora} no admite la cama '{CAMA}'")
modelo = a.impresora.replace("Bambu Lab ", "")
n_maq = f"{a.impresora} {a.boquilla} nozzle"
n_pro = f"{a.proceso} @BBL {modelo}"
if n_pro not in ip:
    n_pro = f"{a.proceso} @BBL {modelo} {a.boquilla} nozzle"
f_maq = escribir(aplanar(n_maq, im), tmp / "maquina.json")
_pro = aplanar(n_pro, ip)
# objetos identificados uno por uno en el codigo: es lo que despues permite SALTEAR una pieza que
# se despego y seguir con las demas (bambu_red.py --saltear). No cambia como se imprime.
_pro["exclude_object"] = "1"
# ajustes pedidos sobre el perfil (pieza resistente, mas paredes, etc.). Solo claves que el perfil
# ya trae: un nombre mal escrito frena, no se ignora en silencio.
for _aj in a.ajuste:
    _k, _v = _aj.split("=", 1)
    if _k not in _pro:
        raise SystemExit(f"el perfil de proceso no tiene el ajuste '{_k}'. Parecidos: "
                         f"{[k for k in _pro if _k.split('_')[0] in k][:10]}")
    print(f"  ajuste: {_k} = {_pro[_k]} -> {_v}")
    _pro[_k] = _v
f_pro = escribir(_pro, tmp / "proceso.json")
f_fil, perfiles_fil = [], []
for i, f in enumerate(a.filamento):
    cand = [f"{f} @BBL {modelo} {a.boquilla} nozzle", f"{f} @BBL {modelo}", f]
    nom = next((c for c in cand if c in ifi), None)
    if nom is None:
        raise SystemExit(f"no hay perfil de '{f}' para la {modelo}. Hay: "
                         f"{sorted(n for n in ifi if modelo in n and f.split()[-1] in n)[:10]}")
    d = aplanar(nom, ifi)
    if i < len(a.color):
        d["default_filament_colour"] = [a.color[i]]
        d["filament_colour"] = [a.color[i]]
    perfiles_fil.append(d)
    f_fil.append(escribir(d, tmp / f"filamento_{i+1}.json"))

def correr(entrada, carpeta, nombre, con_perfiles):
    carpeta.mkdir(parents=True, exist_ok=True)
    cmd = [str(EXE), "--debug", "2"]
    if con_perfiles:
        cmd += ["--load-settings", f"{f_maq};{f_pro}", "--load-filaments", ";".join(f_fil)]
    if CAMA:
        cmd += ["--curr-bed-type", CAMA]
    if con_perfiles and a.acomodar:
        cmd += ["--arrange", "1"]
    cmd += ["--slice", "0", "--export-3mf", nombre, "--outputdir", str(carpeta), str(entrada)]
    import time
    t0 = time.time()
    rj = carpeta / "result.json"
    try:
        r = subprocess.run(cmd, cwd=str(carpeta), capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        # 13/10/2026: Bambu Studio lamino bien y se quedo sin cerrar 15 min. Si dejo un resultado
        # de ESTA corrida se sigue con el; si no, es una falla de verdad.
        r = subprocess.CompletedProcess(cmd, 1, "", "Bambu Studio no cerro en 15 minutos")
        if not (rj.exists() and rj.stat().st_mtime >= t0):
            print("NO LAMINO:", r.stderr)
            sys.exit(1)
        print("AVISO: Bambu Studio lamino pero no cerro solo; se sigue con su resultado")
    res = json.load(open(rj, encoding="utf-8")) if rj.exists() and rj.stat().st_mtime >= t0 else {}
    if res.get("return_code") != 0 or not (carpeta / "plate_1.gcode").exists():
        print("NO LAMINO:", res.get("error_string"), r.stdout[-400:], r.stderr[-400:])
        sys.exit(1)
    return res


# DOS PASADAS cuando hay partes de distinto color. La 1ra lamina con los perfiles aplanados y
# deja un .3mf de Bambu con esos ajustes COMPLETOS adentro; la 2da toma ese archivo, le asigna
# el filamento a cada parte y lamina sin cargar perfiles (cargarlos sobre un .3mf que ya trae
# los suyos da "printer is not compatible with the process preset in the 3mf").
nombre = Path(a.entrada).stem + ".gcode.3mf"
if a.parte_filamento:
    reglas = [(r.split("=")[0], int(r.split("=")[1])) for r in a.parte_filamento]
    correr(Path(a.entrada).resolve(), out / "_paso1", "paso1.gcode.3mf", True)
    con_partes = asignar_partes(out / "_paso1" / "paso1.gcode.3mf", out / "_entrada_con_partes.3mf", reglas)
    res = correr(Path(con_partes).resolve(), out, "_crudo.gcode.3mf", False)
else:
    res = correr(Path(a.entrada).resolve(), out, "_crudo.gcode.3mf", True)
destino = out / nombre
# Por comando el archivo sale con printer_model_id vacio (ese dato vive en el json del MODELO, no
# en la cadena de perfiles) y Bambu Studio puede avisar "impresora equivocada". Se completa con el
# model_id que trae el propio Bambu Studio para esa maquina; el codigo no se toca.
mid = next((d.get("model_id") for d in im.values()
            if d.get("name") == a.impresora and d.get("model_id")), None)
if mid is None:
    for f in (SIS / "machine").glob("*.json"):
        dd = json.load(open(f, encoding="utf-8"))
        if dd.get("name") == a.impresora and dd.get("model_id"):
            mid = dd["model_id"]
with zipfile.ZipFile(out / "_crudo.gcode.3mf") as zi, zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zo:
    for n in zi.namelist():
        data = zi.read(n)
        if n == "Metadata/slice_info.config" and mid:
            data = data.replace(b'key="printer_model_id" value=""',
                                ('key="printer_model_id" value="%s"' % mid).encode())
        zo.writestr(n, data)

g = open(out / "plate_1.gcode", encoding="utf-8", errors="replace").read()


def dato(clave):
    m = re.search(r"^; %s = (.*)$" % re.escape(clave), g, re.M)
    return m.group(1).strip() if m else None


def busca(patron):
    m = re.search(patron, g)
    return m.group(1).strip() if m else None


esperada = [str(p.get("nozzle_temperature", ["?"])[0]) for p in perfiles_fil]
placa = res["sliced_plates"][0]
resumen = {
    "impresora": dato("printer_model"), "proceso": dato("print_settings_id"),
    "filamentos": dato("filament_settings_id"), "temperatura_boquilla": dato("nozzle_temperature"),
    "temperatura_esperada_del_perfil": esperada, "densidad": dato("filament_density"),
    "cama": dato("curr_bed_type"), "temp_cama": [dato("textured_plate_temp"), dato("hot_plate_temp"), dato("cool_plate_temp")], "colores": dato("filament_colour"),
    "tiempo": busca(r"total estimated time: ([^\n;]*)"), "capas": busca(r"total layer number: (\d+)"),
    "alto_mm": busca(r"max_z_height: ([\d.]+)"), "peso_g": busca(r"total filament weight \[g\] : ([\d.,]+)"),
    "cambios_de_filamento": placa.get("filament_change_times"),
    "avisos": placa.get("warning_message", ""), "salida": str(destino), "modelo_id": mid,
}
fallas = []
if CAMA and resumen["cama"] != CAMA:
    fallas.append(f"la cama del codigo es {resumen['cama']} y se pidio {CAMA}")
# el arranque del codigo tiene que ser el de la plantilla de ESA maquina
plant = [im[i]["machine_start_gcode"] for i in (im[n_maq].get("include") or [])
         if "machine_start_gcode" in im.get(i, {})]
arr = (dato("machine_start_gcode") or "")
# se comparan los 3 primeros renglones no vacios de la plantilla (sin escribir barras invertidas aca)
_ren = [x for x in (plant[0].split(chr(10)) if plant else []) if x.strip()][:3]
resumen["arranque_de_la_maquina"] = ("el propio" if _ren and all(x in arr for x in _ren)
                                     else "NO es el de la plantilla")
if plant and resumen["arranque_de_la_maquina"] != "el propio":
    fallas.append("el arranque del codigo no es el de la plantilla de la impresora")
temps = (resumen["temperatura_boquilla"] or "").split(",")
if temps[:len(esperada)] != esperada:
    fallas.append(f"la temperatura del codigo {temps} no es la del perfil {esperada}")
if not resumen["densidad"] or set(resumen["densidad"].split(",")) <= {"0"}:
    fallas.append("densidad 0: el perfil de material no se cargo")
if len(a.filamento) > 1 and not resumen["cambios_de_filamento"]:
    fallas.append("se pidieron varios filamentos y el codigo no cambia de filamento")
resumen["fallas"] = fallas
json.dump(resumen, open(out / "resumen.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for k, v in resumen.items():
    print(f"  {k}: {v}")
sys.exit(1 if fallas else 0)
