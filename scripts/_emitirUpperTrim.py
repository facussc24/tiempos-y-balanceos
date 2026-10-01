# -*- coding: utf-8 -*-
"""_emitirUpperTrim.py — deja el flujograma 160 y el AMFE 174 (Upper Trim Panel, Rev. A) en su
lugar del servidor: el maestro en Gestion Ingenieria y la copia en el legajo APQP de la pieza.

Emitir un documento controlado lleva el OK de Fak (autonomy-contract §F): lo dio el 01/10/2026.

Solo COPIA. No borra ni pisa: si el destino ya existe y es identico lo dice, y si es distinto
frena (una Rev. A ya emitida no se reemplaza en silencio; para eso esta --reemplazar, que
manda el archivo anterior a la carpeta Obsoleto de al lado).

Uso:  py -3 scripts/_emitirUpperTrim.py flujograma            (muestra que haria)
      py -3 scripts/_emitirUpperTrim.py flujograma --apply
      py -3 scripts/_emitirUpperTrim.py amfe [--apply]
"""
import hashlib
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
REEMPLAZAR = "--reemplazar" in sys.argv
if len(args) != 1 or args[0] not in ("flujograma", "amfe"):
    sys.exit("Uso: py -3 scripts/_emitirUpperTrim.py <flujograma|amfe> [--apply] [--reemplazar]")
QUE = args[0]

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(REPO, "exports", "UPPER_TRIMMING_20261001")
GI = r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
# El legajo sigue adentro de la carpeta de respaldo hasta que se pueda mover (hay archivos
# abiertos por otra persona). Si APQP ya esta en su lugar, se usa ese.
PIEZA = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\COZZUOL"
         r"\00_VW427-1LA_K-PATAGONIA\00- Upper Trimming")
LEGAJO = os.path.join(PIEZA, "APQP")
if not os.path.isdir(LEGAJO):
    LEGAJO = os.path.join(PIEZA, "_BACKUP_UpperTrim_2026-07-01", "APQP")

if QUE == "flujograma":
    NOMBRE = "FLUJOGRAMA 160 - UPPER TRIM PANEL - Rev.A"
    PNG_GENERADOR = os.path.join(REPO, "tools", "flowchart", ".build", "FLUJOGRAMA_160-UPPER-TRIM-PANEL.png")
    MAESTRO = os.path.join(GI, "8. Flujograma Sinóptico (I-IN-002III)", "CLIENTES", "COZZUOL", "160 - UPPER TRIM PANEL")
    CASILLERO = os.path.join(LEGAJO, "20- Flujograma de proceso")
    EXTENSIONES = (".pdf", ".png")
else:
    NOMBRE = "AMFE 174 - UPPER TRIM PANEL - Rev.A"
    MAESTRO = os.path.join(GI, "13. Analisis del modo de falla y sus efectos ( I-AC-005.3)",
                           "2. AMFES DE PROCESO", "COZZUOL", "174 - UPPER TRIM PANEL")
    CASILLERO = os.path.join(LEGAJO, "22- FMEA de proceso")
    EXTENSIONES = (".xlsx", ".pdf")


def sha(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


# --- 1. las fuentes, en la carpeta de salida del repo ---
os.makedirs(SALIDA, exist_ok=True)
if QUE == "flujograma":
    if not os.path.isfile(PNG_GENERADOR):
        sys.exit(f"ERROR: falta el PNG del generador: {PNG_GENERADOR}\n  node scripts/_flujograma.mjs 160-UPPER-TRIM-PANEL")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    png = os.path.join(SALIDA, NOMBRE + ".png")
    pdf = os.path.join(SALIDA, NOMBRE + ".pdf")
    shutil.copyfile(PNG_GENERADOR, png)
    # 150 DPI: la convencion de los flujogramas hermanos del legajo.
    with Image.open(png) as img:
        img.convert("RGB").save(pdf, "PDF", resolution=150)

fuentes = [os.path.join(SALIDA, NOMBRE + ext) for ext in EXTENSIONES]
for f in fuentes:
    if not os.path.isfile(f) or os.path.getsize(f) < 10_000:
        sys.exit(f"ERROR: falta la fuente o pesa demasiado poco: {f}")

# --- 2. el plan ---
if not os.path.isdir(LEGAJO):
    sys.exit(f"ERROR: no encuentro el legajo APQP de la pieza: {LEGAJO}")
if not os.path.isdir(CASILLERO):
    sys.exit(f"ERROR: el legajo no tiene el casillero: {CASILLERO}")

plan = []
problemas = []
for destino_dir in (MAESTRO, CASILLERO):
    for f in fuentes:
        destino = os.path.join(destino_dir, os.path.basename(f))
        if len(destino) > 259:
            problemas.append(f"ruta de {len(destino)} caracteres, no abre en Windows: {destino}")
        if os.path.isfile(destino):
            estado = "igual" if sha(destino) == sha(f) else "DISTINTO"
        else:
            estado = "nuevo"
        plan.append((f, destino, estado))

print(f"{QUE.upper()} — {NOMBRE}\n")
for f, destino, estado in plan:
    print(f"  [{estado:<8}] {destino}")
if not os.path.isdir(MAESTRO):
    print(f"\n  (se crea la carpeta {MAESTRO})")
distintos = [p for p in plan if p[2] == "DISTINTO"]
if distintos and not REEMPLAZAR:
    problemas.append(f"{len(distintos)} destino(s) ya existen con otro contenido; con --reemplazar el anterior va a Obsoleto")
if problemas:
    print("\nFRENO:\n  " + "\n  ".join(problemas))
    sys.exit(1)
if not APPLY:
    print("\nDRY-RUN. Corre con --apply para copiar.")
    sys.exit(0)

# --- 3. copiar y verificar ---
os.makedirs(MAESTRO, exist_ok=True)
for f, destino, estado in plan:
    if estado == "igual":
        continue
    if estado == "DISTINTO":
        obsoleto = os.path.join(os.path.dirname(destino), "Obsoleto")
        os.makedirs(obsoleto, exist_ok=True)
        base, ext = os.path.splitext(os.path.basename(destino))
        n, anterior = 1, os.path.join(obsoleto, base + ext)
        while os.path.exists(anterior):
            n += 1
            anterior = os.path.join(obsoleto, f"{base} ({n}){ext}")
        shutil.move(destino, anterior)
        print(f"  anterior -> {anterior}")
    shutil.copyfile(f, destino)
    if sha(destino) != sha(f):
        sys.exit(f"ERROR: la copia no coincide con la fuente: {destino}")
    print(f"  copiado y verificado: {destino}")
print("\nListo.")
