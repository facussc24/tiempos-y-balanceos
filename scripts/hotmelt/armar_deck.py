# -*- coding: utf-8 -*-
"""Arma el PPTX completo de las hojas de proceso de la maquina HOTMELT.
   armar_deck.py [--salida <ruta.pptx>] [--render]
Lee la especificacion de hojas_spec.py (HOJAS y PORTADA)."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hoja_pptx as HP
import datos_comunes as D
from hojas_spec import HOJAS, PORTADA

SAL = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo"
       r"\HOJAS DE PROCESO - MAQUINA HOTMELT.pptx")
for i, a in enumerate(sys.argv):
    if a == "--salida":
        SAL = sys.argv[i + 1]

faltan = []
prs = HP.nueva_presentacion()

def titulo_indice(t):
    """MAYUSCULAS del cajetin -> tipo oracion para el indice, sin romper las siglas."""
    pal = [w if w in D.SIGLAS else w.lower() for w in t.split(" ")]
    for i, w in enumerate(pal):
        if w and w not in D.SIGLAS and w[0].isalpha():
            pal[i] = w[0].upper() + w[1:]
            break
    return " ".join(pal)


# El indice va agrupado por etapa; el spec dice a cual pertenece cada hoja.
indice = []
for tit, sub in D.ETAPAS:
    hs = [(h["op"], titulo_indice(h["denominacion"])) for h in HOJAS if h.get("etapa") == tit]
    if hs:
        indice.append((tit, sub, hs))
sueltas = [h for h in HOJAS if h.get("etapa") not in dict(D.ETAPAS)]
if sueltas:
    print("!! hojas sin etapa declarada: %s" % ", ".join(h["op"] for h in sueltas))
    indice.append((None, None, [(h["op"], titulo_indice(h["denominacion"])) for h in sueltas]))
HP.portada(prs, PORTADA, logo=D.LOGO, foto=PORTADA.get("foto"), indice=indice)

for h in HOJAS:
    d = dict(D.CAJETIN)
    d.update(h)
    d.setdefault("disparador", D.DISPARADOR)
    d.setdefault("acciones", D.ACCIONES)
    d.setdefault("epp", D.EPP_BASE)
    for f in d.get("imagenes", []):
        if not os.path.exists(f):
            faltan.append((d["op"], f))
    HP.hoja(prs, d, D.LOGO)

os.makedirs(os.path.dirname(SAL), exist_ok=True)
prs.save(SAL)
print(f"{len(HOJAS)} hojas + portada -> {SAL}")
if faltan:
    print("!! FOTOS QUE NO EXISTEN:")
    for op, f in faltan:
        print(f"   {op}: {f}")

if "--render" in sys.argv:
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "render_deck")
    subprocess.run([sys.executable,
                    os.path.join(os.path.dirname(os.path.abspath(__file__)), "pptx2png.py"),
                    SAL, dst], check=True)
    print("render en", dst)
