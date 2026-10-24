"""La FOTO DE LA PLACA laminada (lo que Bambu Studio muestra despues de laminar) se le manda a Fak ANTES de mandar a
imprimir: gate 3g del viernes 23/10/2026.

Fak, 23/10/2026 14:00, textual (con sus typos): «mandame una foto de comos e ve la palca digmaos de imrpesiona tnes d
eirmoprmri soea madname una foto de lsoa rhcivos laminados eso ennciesot ok? anota par ael vinre sque iempre deben
amdnarle una foto de lsoc arhivos la[minados]»; 14:41: «no me madnas teuna foto de comoq uedaria digmaos en la palca
laminada?». Hasta hoy --imprimir dibujaba la primera capa y avisaba, pero nada exigia la foto de la PLACA ni que se la
hubieran mandado: dos veces en una tarde la pidio el.

Uso (Python del sistema, biblioteca estandar):
  placa_foto.py <archivo.gcode.3mf>        deja <pieza>_PLACA.png y <pieza>_PLACA.json (sha del laminado, hora, origen)
                                           sale con 0; con 2 si el archivo no trae ninguna miniatura (NO MEDIDO)
Lo llama bambu_red.py --imprimir:
  - sin --apply: saca la foto y dice el comando para mandar (--apply --foto-mandada <png>);
  - con --apply: exige --foto-mandada <png> de ESTE laminado (mismo sha, no mas vieja que el archivo). Hasta
    placaCanon.aviso_hasta AVISA y se manda igual; desde freno_desde NO SE MANDA. Salida: --sin-foto --acepto "<frase
    textual de Fak, frase_minima caracteres o mas>", que queda anotada en el .json.
  - BAMBU_HOY=AAAA-MM-DD cambia «hoy» (los tests), igual que en voladizos_3mf.py.
Nunca da verde sin la foto: un laminado sin miniatura es NO MEDIDO (aviso hoy, freno desde el 31/10).
"""
import hashlib
import json
import os
import sys
import zipfile
from datetime import date, datetime
from pathlib import Path

CANON = Path(__file__).with_name("placaCanon.data.json")
MINIATURAS = ("Metadata/plate_1.png", "Metadata/top_1.png", "Metadata/pick_1.png", "Metadata/plate_1_small.png")
SALIDA_SIN_MINIATURA = 2


class SinMiniatura(Exception):
    """El .gcode.3mf no trae ninguna imagen de la placa: la foto no se puede sacar (NO MEDIDO)."""


def canon():
    return json.loads(CANON.read_text(encoding="utf-8"))


def hoy():
    """La fecha de hoy: BAMBU_HOY=AAAA-MM-DD si esta (los tests), si no el reloj de la PC."""
    h = os.environ.get("BAMBU_HOY", "").strip()
    return date.fromisoformat(h) if h else date.today()


def modo(can=None, dia=None):
    """'aviso' hasta aviso_hasta inclusive, 'freno' desde el dia siguiente."""
    can = can or canon()
    dia = dia or hoy()
    return "aviso" if dia <= date.fromisoformat(can["aviso_hasta"]) else "freno"


def frase_valida(frase, can=None):
    can = can or canon()
    return frase is not None and len(frase.strip()) >= int(can.get("frase_minima", 10))


def sha(archivo):
    h = hashlib.sha256()
    with open(archivo, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def base(archivo):
    archivo = Path(archivo)
    nombre = archivo.name
    for suf in (".gcode.3mf", ".3mf"):
        if nombre.lower().endswith(suf):
            nombre = nombre[: -len(suf)]
            break
    return archivo.with_name(nombre)


def ruta_png(archivo):
    return Path(str(base(archivo)) + "_PLACA.png")


def ruta_json(archivo):
    return Path(str(base(archivo)) + "_PLACA.json")


def _ahora():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _leer_json(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _escribir_json(ruta, datos):
    tmp = Path(str(ruta) + ".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, ruta)


def extraer(archivo, salida=None):
    """Saca la miniatura de la placa del .gcode.3mf. Devuelve {png, json, origen, sha, bytes}."""
    archivo = Path(archivo)
    if not archivo.is_file():
        raise FileNotFoundError(f"no encuentro el archivo {archivo}")
    try:
        with zipfile.ZipFile(archivo) as z:
            nombres = set(z.namelist())
            origen = next((m for m in MINIATURAS if m in nombres), None)
            if origen is None:
                raise SinMiniatura(f"{archivo.name} no trae ninguna imagen de la placa ({', '.join(MINIATURAS)}): "
                                   "la foto no se puede sacar de este archivo")
            datos = z.read(origen)
    except zipfile.BadZipFile:
        raise SinMiniatura(f"{archivo.name} no es un laminado de Bambu Studio (.gcode.3mf)") from None
    if not datos:
        raise SinMiniatura(f"{archivo.name}: la imagen {origen} esta vacia")
    png = Path(salida) if salida else ruta_png(archivo)
    png.write_bytes(datos)
    ficha = {"archivo": archivo.name, "sha256": sha(archivo), "png": str(png), "origen": origen, "bytes": len(datos),
             "sacada": _ahora(), "gate": "3g foto de la placa (23/10/2026)"}
    _escribir_json(ruta_json(archivo), ficha)
    return {"png": png, "json": ruta_json(archivo), "origen": origen, "sha": ficha["sha256"], "bytes": len(datos)}


def validar(archivo, foto_mandada):
    """(ok, motivo): la foto es la de ESTE laminado (misma placa: sha igual) y no es mas vieja que el archivo."""
    archivo = Path(archivo)
    if not foto_mandada:
        return False, "falta --foto-mandada <png>: la foto de la placa se le manda a Fak antes (sacala con --imprimir sin --apply)"
    foto = Path(foto_mandada)
    if not foto.is_file():
        return False, f"la foto {foto} no existe"
    if foto.resolve() != ruta_png(archivo).resolve():
        return False, f"{foto.name} no es la foto de ESTE laminado (tendria que ser {ruta_png(archivo).name})"
    ficha = _leer_json(ruta_json(archivo))
    if not ficha.get("sha256"):
        return False, f"falta la ficha {ruta_json(archivo).name} al lado de la foto: sacala de nuevo con --imprimir sin --apply"
    if ficha["sha256"] != sha(archivo):
        return False, "la foto es de OTRA version del laminado (el archivo cambio despues de la foto): sacala de nuevo y mandala"
    if foto.stat().st_mtime + 1 < archivo.stat().st_mtime:
        return False, "la foto es mas vieja que el laminado: sacala de nuevo y mandala"
    return True, ""


def anotar(archivo, **campos):
    ficha = _leer_json(ruta_json(archivo))
    ficha.update(campos)
    _escribir_json(ruta_json(archivo), ficha)


def gate(archivo, aplicar, foto_mandada=None, sin_foto=False, acepto=None, dia=None, can=None):
    """Lo que --imprimir dice y si frena: {'lineas': [...], 'frena': bool, 'estado': ...}."""
    can = can or canon()
    archivo = Path(archivo)
    salida = f'--sin-foto --acepto "<frase textual de Fak, {can.get("frase_minima", 10)} caracteres o mas>"'
    if sin_foto:
        if not frase_valida(acepto, can):
            return {"frena": True, "estado": "sin-frase",
                    "lineas": [f"NO SE MANDA: --sin-foto necesita la frase de Fak ({salida})"]}
        frase = acepto.strip()
        if aplicar:
            anotar(archivo, sin_foto=frase, mandada_sin_foto=_ahora())
        return {"frena": False, "estado": "sin-foto",
                "lineas": [f"FOTO DE LA PLACA: sin foto por pedido de Fak «{frase}» (queda anotado en {ruta_json(archivo).name})"]}
    if not aplicar:
        try:
            r = extraer(archivo)
        except SinMiniatura as e:
            return {"frena": False, "estado": "no-medido",
                    "lineas": [f"NO PUDE sacar la foto de la placa: {e}. Con --apply hoy AVISA; desde el {can['freno_desde']} "
                               f"NO SE MANDA sin la foto (salida: {salida})"]}
        return {"frena": False, "estado": "foto-sacada",
                "lineas": [f"FOTO DE LA PLACA (mandársela a Fak ANTES de --apply): {r['png']}",
                           f"      despues: bambu_red.py --imprimir {archivo} --apply --foto-mandada {r['png']}"]}
    ok, motivo = validar(archivo, foto_mandada)
    if ok:
        anotar(archivo, mandada_con_apply=_ahora())
        return {"frena": False, "estado": "ok", "lineas": [f"FOTO DE LA PLACA: mandada ({Path(foto_mandada).name}, misma placa)"]}
    if modo(can, dia) == "aviso":
        return {"frena": False, "estado": "aviso",
                "lineas": [f"AVISO [GATE foto de la placa]: {motivo}. Hasta el {can['aviso_hasta']} se manda igual; desde el "
                           f"{can['freno_desde']} NO SE MANDA sin --foto-mandada <png> (o {salida})"]}
    return {"frena": True, "estado": "freno",
            "lineas": [f"NO SE MANDA [GATE foto de la placa]: {motivo}. Salida: {salida}"]}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    try:
        r = extraer(argv[0], argv[1] if len(argv) > 1 else None)
    except SinMiniatura as e:
        print("NO MEDIDO:", e)
        return SALIDA_SIN_MINIATURA
    except FileNotFoundError as e:
        print("ERROR:", e)
        return SALIDA_SIN_MINIATURA
    print(f"FOTO DE LA PLACA: {r['png']} ({r['bytes']} bytes, de {r['origen']}); ficha {r['json']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
