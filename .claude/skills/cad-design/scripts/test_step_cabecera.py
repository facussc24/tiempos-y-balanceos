#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   python test_step_cabecera.py
"""La cabecera STEP (ISO 10303-21) en las dos direcciones, con un archivo como los que escribe OpenCASCADE 7.8.

MAL: la cabecera de OpenCASCADE 7.8 (FILE_NAME primero) se detecta al revés y se arregla; el resto del archivo queda
byte a byte igual, con sus finales de línea, y la fecha de modificación no cambia (G-E2 compara fechas). BIEN: una ya
en orden no se toca. Un archivo que no es STEP da «sin cabecera» y no se inventa un orden. `revisar` sale 1 con uno al
revés y 0 con todos en orden.
"""
import os
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from cadlib import step_cabecera as sc  # noqa: E402
import cabecera_step  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


OCC = ("ISO-10303-21;\r\nHEADER;\r\nFILE_NAME('Open CASCADE Shape Model','2026-10-13T09:04:11',('Author'),(\r\n"
       "    'Open CASCADE'),'Open CASCADE STEP processor 7.8','Open CASCADE 7.8'\r\n  ,'Unknown');\r\n"
       "FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');\r\n"
       "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\r\nENDSEC;\r\nDATA;\r\n"
       "#1 = PRODUCT('pi\xe9za','',(#2));\r\nENDSEC;\r\nEND-ISO-10303-21;\r\n")

with tempfile.TemporaryDirectory() as td:
    p = os.path.join(td, "occ.step")
    with open(p, "wb") as f:
        f.write(OCC.encode("latin-1"))
    os.utime(p, (1000000000, 1000000000))
    chequear(sc.orden_de_archivo(p) == ("FILE_NAME", "FILE_DESCRIPTION", "FILE_SCHEMA"),
             "la cabecera de OpenCASCADE 7.8 se lee al reves")
    chequear(cabecera_step.revisar([td]) == 1, "revisar sale 1 con un STEP al reves")
    cambio, orden = sc.arreglar_archivo(p)
    chequear(cambio and sc.orden_de_archivo(p) == sc.CLAVES, "arreglar la deja en orden ISO 10303-21")
    nuevo = open(p, "rb").read()
    chequear(nuevo.split(b"ENDSEC;", 1)[1] == OCC.encode("latin-1").split(b"ENDSEC;", 1)[1],
             "el resto del archivo queda byte a byte igual (incluido el \\xe9 y los \\r\\n)")
    chequear(int(os.path.getmtime(p)) == 1000000000, "la fecha de modificacion no cambia")
    chequear(sc.arreglar_archivo(p) == (False, sc.CLAVES), "una cabecera ya en orden no se toca (idempotente)")
    chequear(cabecera_step.revisar([td]) == 0, "revisar sale 0 con todos en orden")
    # 18/10: en OneDrive la fecha tiene que cambiar (con la misma fecha, OneDrive deja el de la nube y crea una copia
    # de conflicto con el arreglo)
    r = os.path.join(td, "occ_nube.step")
    with open(r, "wb") as f:
        f.write(OCC.encode("latin-1"))
    os.utime(r, (1000000000, 1000000000))
    cambio, _ = sc.arreglar_archivo(r, conservar_fecha=False)
    chequear(cambio and sc.orden_de_archivo(r) == sc.CLAVES and int(os.path.getmtime(r)) != 1000000000,
             "con conservar_fecha=False (OneDrive) queda en orden y con fecha nueva")
    q = os.path.join(td, "no_es.step")
    open(q, "w").write("hola")
    chequear(sc.orden_de_archivo(q) is None, "un archivo que no es STEP: sin cabecera (no inventa un orden)")
    # ronda 1 del auditor (N2): lo demas de la cabecera queda como estaba, y un «);» adentro de un texto no la corta
    raro = ("ISO-10303-21;\r\nHEADER;\r\n/* comentario */\r\nFILE_NAME('pieza);v2','2026',('A'),('B'),'OC 7.8','OC','U');\r\n"
            "FILE_DESCRIPTION(('Model'),'2;1');\r\nFILE_SCHEMA(('AP214'));\r\nFILE_POPULATION('x','y',());\r\nENDSEC;\r\n"
            "DATA;\r\nENDSEC;\r\nEND-ISO-10303-21;\r\n")
    nuevo, orden = sc.cabecera_en_orden(raro)
    cab = nuevo.split("ENDSEC;")[0]
    chequear("/* comentario */" in cab and "FILE_POPULATION('x','y',());" in cab and "\n" not in cab.replace("\r\n", ""),
             "el comentario, FILE_POPULATION y los \\r\\n de la cabecera quedan como estaban")
    chequear("FILE_NAME('pieza);v2','2026',('A'),('B'),'OC 7.8','OC','U');" in cab
             and cab.index("FILE_DESCRIPTION") < cab.index("FILE_NAME") < cab.index("FILE_SCHEMA"),
             "un «);» adentro de un texto no corta la entidad y el orden queda ISO")
    # revisor por API del 18/10: cabecera larga, carpeta de la nube y cabecera rota
    larga = os.path.join(td, "larga.step")
    with open(larga, "wb") as f:
        f.write(OCC.replace("FILE_DESCRIPTION(('Open CASCADE Model')", "FILE_DESCRIPTION(('" + "x" * 30000 + "')")
                .encode("latin-1"))
    chequear(sc.orden_de_archivo(larga) == ("FILE_NAME", "FILE_DESCRIPTION", "FILE_SCHEMA"),
             "una cabecera de mas de 20.000 bytes se lee entera (antes daba None)")
    nube = os.path.join(td, "OneDrive - prueba")
    os.makedirs(nube)
    pn = os.path.join(nube, "entregado.step")
    open(pn, "wb").write(OCC.encode("latin-1"))
    chequear(cabecera_step.arreglar([pn]) == 1 and sc.orden_de_archivo(pn)[0] == "FILE_NAME",
             "arreglar no reemplaza un STEP de una carpeta de OneDrive sin --ok-fak")
    chequear(cabecera_step.arreglar([pn], ok_fak="Fak 18/10: dale") == 0 and sc.orden_de_archivo(pn) == sc.CLAVES,
             "con la frase de Fak, si")
    rota = os.path.join(td, "rota.step")
    open(rota, "w").write("ISO-10303-21;\nHEADER;\nFILE_NAME('x');\nENDSEC;\n")
    chequear(cabecera_step.arreglar([rota]) == 1, "una cabecera rota da ERROR en el renglon, sin reventar")
    try:
        sc.cabecera_en_orden(OCC.replace("FILE_SCHEMA", "FILE_XXX"))
        chequear(False, "una cabecera sin FILE_SCHEMA tiene que frenar")
    except ValueError:
        chequear(True, "una cabecera sin FILE_SCHEMA frena")

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
sys.exit(1 if fallos else 0)
