# -*- coding: utf-8 -*-
"""
_ordenarHojasPuertas.py — dos movimientos en HOJAS DE OPERACIONES del SGC, con el OK de Fak del
01/10/2026 ("si a las 2, dale"):

  1. Las hojas hot melt viejas (28 y 29/09) y `TOP ROLL.xlsx` salen de
     `...\\Tapizadas puerta\\TOP ROLL\\` y van a `...\\Tapizadas puerta\\HO 992 - TOP ROLL\\OBSOLETO\\`.
     La hoja de la moldeadora IMG NO se mueve: es de otra tarea y sigue vigente.
  2. Las hojas de engrampado del APB de puerta que hizo P. Gamboa (operacion 83, delantero y
     trasero) y sus dos caminos de inspeccion de grampas van a `...\\HO 971 - APB DE PUERTA\\`.

Nada se borra y nada se pisa: un movimiento es `shutil.move` a un nombre que no existe, y se
comprueba el tamano antes y despues. La lista de lo que se mueve va escrita archivo por archivo.

    py -3 scripts/novax/_ordenarHojasPuertas.py            # prueba en seco
    py -3 scripts/novax/_ordenarHojasPuertas.py --apply
"""
import hashlib
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")
APLICAR = "--apply" in sys.argv

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GRAMPAS = os.path.join(REPO, "exports", "hojas-grampas-patagonia-01-10")
PUERTAS = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\NOVAX\Tapizadas puerta"
VIEJA = os.path.join(PUERTAS, "TOP ROLL")
OBSOLETO = os.path.join(PUERTAS, "HO 992 - TOP ROLL", "OBSOLETO")
D971 = os.path.join(PUERTAS, "HO 971 - APB DE PUERTA")

A_OBSOLETO = [n + ext for n in (
    "HOJAS DE PROCESO - HOTMELT - 1. OPERACION ESTANDAR",
    "HOJAS DE PROCESO - HOTMELT - 2. CONTINGENCIAS",
    "HOJAS DE PROCESO - HOTMELT - 3. LIMPIEZA Y MANTENIMIENTO",
    "HOJAS DE PROCESO - HOTMELT - A3 - 1. OPERACION ESTANDAR",
    "HOJAS DE PROCESO - HOTMELT - A3 - 2. CONTINGENCIAS",
    "HOJAS DE PROCESO - HOTMELT - A3 - 3. LIMPIEZA Y MANTENIMIENTO",
    "HOJAS DE PROCESO - MAQUINA HOTMELT - A3 COMPLETO",
    "HOJAS DE PROCESO - MAQUINA HOTMELT - Rev.A",
    "HOJAS DE PROCESO - MAQUINA HOTMELT",
) for ext in (".pdf", ".pptx")] + ["TOP ROLL.xlsx"]
SE_QUEDA = {"HOJAS DE PROCESO - MAQUINA MOLDEADORA IMG - Rev.A (PRELIMINAR).pptx"}

A_971 = [n + ext for n in (
    "HO-971 - OP 83 ENGRAMPADO - APB DE PUERTA DELANTERO",
    "HO-971 - OP 83 ENGRAMPADO - APB DE PUERTA TRASERO",
    "CAMINO DE INSPECCION DE GRAMPAS - APB DE PUERTA DELANTERO - 27",
    "CAMINO DE INSPECCION DE GRAMPAS - APB DE PUERTA TRASERO - 21",
) for ext in (".pptx", ".pdf")]


def md5(ruta):
    h = hashlib.md5()
    with open(ruta, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


problemas = []
if not os.path.isdir(VIEJA):
    problemas.append(f"no veo la carpeta {VIEJA}")
else:
    hay = set(os.listdir(VIEJA))
    for n in A_OBSOLETO:
        if n not in hay:
            problemas.append(f"no esta en la carpeta vieja: {n}")
        if os.path.exists(os.path.join(OBSOLETO, n)):
            problemas.append(f"ya existe en OBSOLETO (no se pisa): {n}")
    ajenos = hay - set(A_OBSOLETO) - SE_QUEDA
    if ajenos:
        problemas.append(f"en la carpeta vieja hay archivos que no conozco, no los toco: {sorted(ajenos)}")
    if any(x.startswith("~$") for x in hay):
        problemas.append("alguien tiene abierto un archivo de la carpeta vieja (~$)")
for n in A_971:
    src, dst = os.path.join(GRAMPAS, n), os.path.join(D971, n)
    if not os.path.isfile(src):
        problemas.append(f"FALTA el origen: {src}")
    elif os.path.exists(dst) and md5(dst) != md5(src):
        problemas.append(f"ya existe en HO 971 con otro contenido (no se pisa): {n}")
if not os.path.isdir(D971):
    problemas.append(f"no veo la carpeta {D971}")

print(f'{"APLICANDO" if APLICAR else "PRUEBA EN SECO"}')
print(f"\n1) MOVER {len(A_OBSOLETO)} archivos\n   de  {VIEJA}\n   a   {OBSOLETO}")
for n in A_OBSOLETO:
    print("     ", n)
print("   se quedan en la carpeta vieja:", ", ".join(sorted(SE_QUEDA)))
print(f"\n2) COPIAR {len(A_971)} archivos a {D971}")
for n in A_971:
    print("     ", n)
if problemas:
    print("\nPROBLEMAS:")
    for p in problemas:
        print("  -", p)
    sys.exit(1)
if not APLICAR:
    print("\n(prueba en seco: no se toco nada)")
    sys.exit(0)

os.makedirs(OBSOLETO, exist_ok=True)
movidos = 0
for n in A_OBSOLETO:
    src, dst = os.path.join(VIEJA, n), os.path.join(OBSOLETO, n)
    tam = os.path.getsize(src)
    shutil.move(src, dst)
    if os.path.exists(src) or not os.path.exists(dst) or os.path.getsize(dst) != tam:
        print("  NO QUEDO BIEN:", n)
        continue
    movidos += 1
copiados = 0
for n in A_971:
    src, dst = os.path.join(GRAMPAS, n), os.path.join(D971, n)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    if md5(dst) == md5(src):
        copiados += 1
    else:
        print("  DISTINTO al origen:", n)
print(f"\nMOVIDOS A OBSOLETO: {movidos}/{len(A_OBSOLETO)}   ·   COPIADOS A HO 971 (verificados por hash): {copiados}/{len(A_971)}")
print("queda en la carpeta vieja:", sorted(os.listdir(VIEJA)))
sys.exit(0 if movidos == len(A_OBSOLETO) and copiados == len(A_971) else 1)
