# -*- coding: utf-8 -*-
"""Ayuda comun de los scripts del ejercicio 02: copia un archivo real del virolador desde la nube de Ingenieria y
verifica su sha256. Si el archivo no esta o cambio, sale con codigo 2 (la pieza real no se reemplaza por otra)."""
import hashlib
import json
import os
import shutil
import sys

NUBE = os.path.join(r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General",
                    "INGENIERIA BARACK (NUNCA BORRAR)", "1- GENERAL", "5. 3D", "VWA",
                    "PATAGONIA - VIROLADOR UPPER TRIM")

ORIGEN = {
    "v14_stl": ("v14 - 2026-10-13", "VIROLADOR v14 - 2 ranuras - 1 CUERPO.stl",
                "e19246cae52fe1f0afb6a37671a686b4be3cf60dbea18e56647c1af20a6d0914"),
    "v14_step": ("v14 - 2026-10-13", "VIROLADOR v14 - 2 ranuras (sin grabado).step",
                 "aa60842ee022aeac2689fa1da75a3b71a1d4e309f50944473993658ec3a1a6be"),
    "v16_stl": ("v16 - 2026-10-17", "VIROLADOR v16 - 2 ranuras - 1 CUERPO.stl",
                "48aa8294ee934f51bae41de9c3183368fb881dbf63113d9ea30d4149f39acc82"),
    "v16_step": ("v16 - 2026-10-17", "VIROLADOR v16 - 2 ranuras (sin grabado).step",
                 "ed83ade9716bc5e0f573906ba0a91e5a209f4c49bda3b01ff0a3381a96a55f98"),
}


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def origen(clave):
    carpeta, nombre, esperado = ORIGEN[clave]
    p = os.path.join(NUBE, carpeta, nombre)
    if not os.path.exists(p):
        print("FALTA el archivo real: %s" % p, file=sys.stderr)
        sys.exit(2)
    s = sha(p)
    if s != esperado:
        print("el archivo real cambio (sha256 %s, se esperaba %s): %s" % (s, esperado, p), file=sys.stderr)
        sys.exit(2)
    return p, s


def copiar(clave, destino):
    p, s = origen(clave)
    shutil.copyfile(p, destino)
    return {"origen": p, "sha256": s}


def carpeta_salida():
    if len(sys.argv) < 2:
        print("uso: python %s <carpeta de salida>" % os.path.basename(sys.argv[0]), file=sys.stderr)
        sys.exit(2)
    d = sys.argv[1]
    os.makedirs(d, exist_ok=True)
    return d


def escribir_json(ruta, datos):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=1, ensure_ascii=False)
