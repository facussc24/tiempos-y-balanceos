# Reestructura el legajo del APB P21 hilo naranja MY2026: deja el formato del paquete PPAP que
# mando Capuana (SMRC) en lugar de los 34 casilleros del APQP, mas "1. Imput" que no se manda.
# Fak, 23/09/2026: "en el mismo lugar donde esta el actual APQP elimina las carpetas del APQP para
# dejar el formato de Capuana... el nuestro estaba mal" · "le mandamos todo menos el input".
#
# Este script NO BORRA NADA: crea carpetas, mueve y copia. Al final escribe la lista de lo que
# sobra (copias identicas por hash a su maestro de Gestion Ingenieria, y casilleros que quedaron
# vacios) para mandarlo a la Papelera en un paso aparte.
# Uso:  python reestructurar_legajo.py            (dry-run)
#       python reestructurar_legajo.py --apply
import hashlib, os, shutil, sys

APPLY = '--apply' in sys.argv
BASE = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\REYDEL-SMRC\APB P21\P21 SSRT-MY2026 HILO NARANJA\APQP"
IMPUT = os.path.join(BASE, "1. Imput")
MAIL = os.path.join(IMPUT, "Mail Capuana 23-09-2026 - info ppap hilo naranja")
PLANTILLA = os.path.join(MAIL, "PPAP Standard Folder")
GI = r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
GI_FLUJO = GI + r"\8. Flujograma Sinóptico (I-IN-002III)\CLIENTES\SMRC\159 - APB P21 HILO NARANJA COSTURA SIMPLE"
GI_AMFE = GI + r"\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\2. AMFES DE PROCESO\SMRC\173 - APB P21 HILO NARANJA COSTURA SIMPLE"
GI_SLT = GI + r"\17. Fichas de embalaje\2- CLIENTES\SMRC\P21\HILO NARANJA MY2026"
PDFS = os.path.abspath(r"tmp\_rev173\pdf_capuana")
SOBRA = os.path.abspath(r"tmp\_rev173\sobra_legajo.txt")
NF = "FLUJOGRAMA 159 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A"
NA = "AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A"
SLT = ["BARACK_SMRC_SLT_Hilo_Naranja_00257327-01-NHZD", "BARACK_SMRC_SLT_Hilo_Naranja_00257328-01-NHZD"]

md5 = lambda p: hashlib.md5(open(p, 'rb').read()).hexdigest()
rel = lambda p: os.path.relpath(p, BASE) if os.path.splitdrive(p)[0].upper() == os.path.splitdrive(BASE)[0].upper() else "[local] " + os.path.basename(p)
acciones = []

carpetas = sorted(d for d in os.listdir(PLANTILLA) if os.path.isdir(os.path.join(PLANTILLA, d)))
for d in carpetas:
    acciones.append(("crear", None, os.path.join(BASE, d)))
C = {d.split(' - ')[0].split(' -')[0].strip(): d for d in carpetas}
en = lambda clave, nombre: os.path.join(BASE, C[clave], nombre)

# lo que vino de afuera vuelve a 1. Imput (de ahi lo habia repartido la sesion del 11/09)
for cas in ["3- Cotizacion", "5-Carta de nominacion", "8-Ficha tecnica",
            "13-Especificaciones de Ingenieria F", "30- Ensayos de validacion de produccion"]:
    for f in os.listdir(os.path.join(BASE, cas)):
        if f.lower() != 'thumbs.db':
            acciones.append(("mover", os.path.join(BASE, cas, f), os.path.join(IMPUT, f)))

# el paquete: lo que se manda
acciones += [
    ("mover", os.path.join(BASE, "6-Planos de la pieza", "RP-00238891_ACCOUDOIR AV D-G SUBSTRATE V06_OK.pdf"),
     en('01a', "RP-00238891_ACCOUDOIR AV D-G SUBSTRATE V06_OK.pdf")),
    ("copiar", os.path.join(IMPUT, "P21 ARMREST_SSRT MY2026_LSC_v1.xlsx"), en('01b', "P21 ARMREST_SSRT MY2026_LSC_v1.xlsx")),
    ("copiar", os.path.join(MAIL, "Functional check report_APB hilo naranjaP21.pdf"), en('03', "Functional check report_APB hilo naranjaP21.pdf")),
    ("mover", os.path.join(BASE, "20- Flujograma de proceso", NF + ".pdf"), en('05', NF + ".pdf")),
    ("copiar", os.path.join(PDFS, NA + ".pdf"), en('06', NA + ".pdf")),
    ("copiar", os.path.join(MAIL, "AAR  P21M-03125 - Panel trim door AV RH-LH ASM _ SS Road Trip.pdf"),
     en('13', "AAR  P21M-03125 - Panel trim door AV RH-LH ASM _ SS Road Trip.pdf")),
] + [("copiar", os.path.join(PDFS, s + ".pdf"), en('17b', s + ".pdf")) for s in SLT]

# copias de maestros que NO van al paquete: se listan para la Papelera solo si son identicas
copias = [(os.path.join(BASE, "20- Flujograma de proceso", NF + ".png"), os.path.join(GI_FLUJO, NF + ".png")),
          (os.path.join(BASE, "22- FMEA de proceso", NA + ".xlsx"), os.path.join(GI_AMFE, NA + ".xlsx"))] + \
         [(os.path.join(BASE, "19-Normas y Especificaciones de embalaje", s + ".xlsx"), os.path.join(GI_SLT, s + ".xlsx")) for s in SLT]
for copia, maestro in copias:
    if md5(copia) != md5(maestro):
        sys.exit(f"FRENO: la copia no es identica al maestro:\n  {copia}\n  {maestro}")

viejos = [d for d in os.listdir(BASE) if os.path.isdir(os.path.join(BASE, d)) and d != "1. Imput" and d not in carpetas]

print(f"{'APLICANDO' if APPLY else 'DRY-RUN'} — {BASE}\n")
for t, o, d in acciones:
    print(f"  crear    {os.path.basename(d)}" if t == "crear" else
          f"  {t:<8} {rel(o)}  ->  {rel(d)}")
for copia, _ in copias:
    print(f"  papelera {os.path.relpath(copia, BASE)}   (identica al maestro de Gestion Ingenieria)")
print(f"  papelera los {len(viejos)} casilleros viejos, si quedan vacios")
if not APPLY:
    sys.exit(0)

for t, o, d in acciones:
    if t == "crear":
        os.makedirs(d, exist_ok=True)
        continue
    if os.path.exists(d):
        sys.exit(f"FRENO: ya existe {d}")
    (shutil.move if t == "mover" else shutil.copy2)(o, d)
    if not os.path.exists(d):
        sys.exit(f"FRENO: no quedo {d}")

sobra, no_vacios = [c for c, _ in copias], []
for v in viejos:
    p = os.path.join(BASE, v)
    resto = [f for r, _, fs in os.walk(p) for f in fs if f.lower() != 'thumbs.db' and os.path.join(r, f) not in sobra]
    (no_vacios if resto else sobra).append((v, resto) if resto else p)
with open(SOBRA, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(sobra))
print(f"\nHECHO. Para la Papelera: {len(sobra)} entradas en {SOBRA}")
for v, r in no_vacios:
    print("  NO VACIO, se deja:", v, r)
