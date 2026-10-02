# -*- coding: utf-8 -*-
"""
_reemplazarHotmeltServidor.py — reemplaza en el servidor del SGC las hojas hot melt del 01/10 por
las corregidas del 02/10 (HO 992 operacion 20 y HO 993 hoja de maquina, pptx + pdf).

Escribir en Y:\\ pide el OK de Fak (autonomy-contract.md §D y §F). Sin `--apply` no toca nada:
dice que moveria y que copiaria.

Que hace con `--apply`, por cada uno de los 4 archivos:
  1. mueve el que esta hoy a OBSOLETO\\ de su misma carpeta, con "(01-10-2026)" en el nombre;
  2. copia el nuevo con el mismo nombre que tenia el viejo (el listado apunta a ese nombre);
  3. compara tamano y hash de la copia contra el origen.
Frena antes de tocar nada si falta un origen, si lo que hay en el servidor NO es la version del
01/10 (alguien lo cambio a mano), si el destino en OBSOLETO ya existe, o si una ruta pasa de 259
caracteres. No crea carpetas: si OBSOLETO\\ no existe en una carpeta, frena y lo dice.

    py -3 scripts/novax/_reemplazarHotmeltServidor.py            # prueba en seco
    py -3 scripts/novax/_reemplazarHotmeltServidor.py --apply
"""
import hashlib
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")
APLICAR = "--apply" in sys.argv

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
VIEJA = os.path.join(REPO, "exports", "hojas-hotmelt-01-10")      # copia de lo que se subio el 01/10
NUEVA = os.path.join(REPO, "exports", "hojas-hotmelt-02-10")
SGC = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"
D992 = os.path.join(SGC, r"1- CLIENTES\NOVAX\Tapizadas puerta\HO 992 - TOP ROLL")
D993 = os.path.join(SGC, r"2- SECTORES\LAMINADO")
SELLO = " (01-10-2026)"

# (nombre en exports, carpeta del servidor, nombre en el servidor sin extension)
JUEGOS = [("HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL", D992,
           "HO-992 - HOJAS DE PROCESO - TOP ROLL - OP 20 ADHESIVADO HOT MELT - Rev.A"),
          ("HO-993 - LAMINADORA HOT MELT - HOJA DE MAQUINA", D993,
           "HO-993 - HOJAS DE PROCESO - LAMINADORA HOT MELT - Rev.A")]


def md5(ruta):
    h = hashlib.md5()
    with open(ruta, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


plan, problemas = [], []
for local, carpeta, remoto in JUEGOS:
    for ext in (".pptx", ".pdf"):
        nuevo = os.path.join(NUEVA, local + ext)
        viejo_local = os.path.join(VIEJA, local + ext)
        actual = os.path.join(carpeta, remoto + ext)
        obsoleto = os.path.join(carpeta, "OBSOLETO", remoto + SELLO + ext)
        if not os.path.isfile(nuevo):
            problemas.append(f"FALTA el archivo nuevo: {nuevo}")
            continue
        if not os.path.isfile(actual):
            problemas.append(f"NO ESTA en el servidor lo que se iba a reemplazar: {actual}")
            continue
        if not os.path.isdir(os.path.dirname(obsoleto)):
            problemas.append(f"NO EXISTE la carpeta OBSOLETO en {carpeta} (este programa no crea carpetas)")
        if os.path.exists(obsoleto):
            problemas.append(f"YA EXISTE en OBSOLETO: {obsoleto}")
        if max(len(actual), len(obsoleto)) > 259:
            problemas.append(f"RUTA de mas de 259 caracteres: {obsoleto}")
        if os.path.isfile(viejo_local) and md5(viejo_local) != md5(actual):
            problemas.append(f"LO DEL SERVIDOR NO ES la version del 01/10 (alguien lo cambio): {actual}")
        if md5(nuevo) == md5(actual):
            problemas.append(f"EL SERVIDOR YA TIENE la version nueva: {actual}")
        plan.append((nuevo, actual, obsoleto))

print("REEMPLAZO DE LAS HOJAS HOT MELT EN EL SERVIDOR" + ("" if APLICAR else "  (prueba en seco: no toca nada)"))
for nuevo, actual, obsoleto in plan:
    print(f"\n  hoy en el servidor : {actual}")
    print(f"  pasa a             : {obsoleto}")
    print(f"  entra              : {nuevo}  ({os.path.getsize(nuevo) / 1e6:.1f} MB)")
if problemas:
    print("\nNO SE PUEDE HACER ASI:")
    for p in problemas:
        print("  - " + p)
    sys.exit(1)
if not APLICAR:
    print(f"\n{len(plan)} archivos listos para reemplazar. Con el OK de Fak: --apply")
    sys.exit(0)

for nuevo, actual, obsoleto in plan:
    shutil.move(actual, obsoleto)
    shutil.copy2(nuevo, actual)
    if os.path.getsize(actual) != os.path.getsize(nuevo) or md5(actual) != md5(nuevo):
        print(f"ERROR: la copia no coincide con el origen: {actual}")
        sys.exit(1)
    print(f"  ok  {os.path.basename(actual)}")
print(f"\n{len(plan)} archivos reemplazados y verificados por hash. Falta: fecha de las filas 992 y 993 del listado.")
