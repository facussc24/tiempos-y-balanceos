# -*- coding: utf-8 -*-
"""
_subirHojasTopRollHotmelt.py — lleva al servidor del SGC las hojas de la HO 992 (Top Roll
Patagonia) y de la HO 993 (laminadora hot melt, hoja de maquina).

Destinos (OK de Fak, 01/10/2026: "si a las 3, dale"):
  Y:\\...\\HOJAS DE OPERACIONES\\1- CLIENTES\\NOVAX\\Tapizadas puerta\\HO 992 - TOP ROLL\\
  Y:\\...\\HOJAS DE OPERACIONES\\2- SECTORES\\LAMINADO\\

No pisa nada: si el archivo ya existe en destino con otro contenido, frena. Despues de copiar
compara el tamano y el hash de cada archivo contra el origen.

    py -3 scripts/novax/_subirHojasTopRollHotmelt.py            # prueba en seco
    py -3 scripts/novax/_subirHojasTopRollHotmelt.py --apply
"""
import hashlib
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")
APLICAR = "--apply" in sys.argv

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
HOTMELT = os.path.join(REPO, "exports", "hojas-hotmelt-01-10")
GRAMPAS = os.path.join(REPO, "exports", "hojas-grampas-patagonia-01-10")
SGC = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"
D992 = os.path.join(SGC, r"1- CLIENTES\NOVAX\Tapizadas puerta\HO 992 - TOP ROLL")
D993 = os.path.join(SGC, r"2- SECTORES\LAMINADO")

# (origen, carpeta destino, nombre en destino)
PLAN = []
for ext in (".pptx", ".pdf"):
    PLAN.append((os.path.join(HOTMELT, "HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL" + ext), D992,
                 "HO-992 - HOJAS DE PROCESO - TOP ROLL - OP 20 ADHESIVADO HOT MELT - Rev.A" + ext))
    PLAN.append((os.path.join(HOTMELT, "HO-993 - LAMINADORA HOT MELT - HOJA DE MAQUINA" + ext), D993,
                 "HO-993 - HOJAS DE PROCESO - LAMINADORA HOT MELT - Rev.A" + ext))
    for n in ("HO-992 - OP 50 TAPIZADO Y ENGRAMPADO DE PANEL - TOP ROLL TRASERO",
              "CAMINO DE INSPECCION DE GRAMPAS - TOP ROLL DELANTERO - 27",
              "CAMINO DE INSPECCION DE GRAMPAS - TOP ROLL TRASERO - 34"):
        PLAN.append((os.path.join(GRAMPAS, n + ext), D992, n + ext))
PLAN.append((os.path.join(GRAMPAS, "HO-992 - SOLDADURA POR ULTRASONIDO DE SOPORTE - TOP ROLL TRASERO "
                                   "(sin N de operacion).pdf"), D992,
             "HO-992 - SOLDADURA POR ULTRASONIDO DE SOPORTE - TOP ROLL TRASERO.pdf"))


def md5(ruta):
    h = hashlib.md5()
    with open(ruta, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


problemas = []
for src, carpeta, nombre in PLAN:
    if not os.path.isfile(src):
        problemas.append(f"FALTA el origen: {src}")
    dst = os.path.join(carpeta, nombre)
    if len(dst) > 259:
        problemas.append(f"ruta de {len(dst)} caracteres (no abre): {dst}")
    if os.path.exists(dst) and os.path.isfile(src) and md5(dst) != md5(src):
        problemas.append(f"YA EXISTE con otro contenido (no se pisa): {dst}")
if not os.path.isdir(SGC):
    problemas.append(f"no veo el servidor: {SGC}")

print(f'{"APLICANDO" if APLICAR else "PRUEBA EN SECO"} — {len(PLAN)} archivos')
for carpeta in (D992, D993):
    print(f"\n{carpeta}" + ("" if os.path.isdir(carpeta) else "   (carpeta NUEVA)"))
    for src, c, nombre in PLAN:
        if c == carpeta:
            print(f"   {nombre}   ({os.path.getsize(src) / 1e6:.1f} MB)" if os.path.isfile(src) else f"   {nombre}   (SIN ORIGEN)")
if problemas:
    print("\nPROBLEMAS:")
    for p in problemas:
        print("  -", p)
    sys.exit(1)
if not APLICAR:
    print("\n(prueba en seco: no se copio nada)")
    sys.exit(0)

ok = 0
for src, carpeta, nombre in PLAN:
    os.makedirs(carpeta, exist_ok=True)
    dst = os.path.join(carpeta, nombre)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    if os.path.getsize(dst) != os.path.getsize(src) or md5(dst) != md5(src):
        print(f"  DISTINTO al origen: {dst}")
        continue
    ok += 1
print(f"\nCOPIADOS Y VERIFICADOS POR HASH: {ok}/{len(PLAN)}")
sys.exit(0 if ok == len(PLAN) else 1)
