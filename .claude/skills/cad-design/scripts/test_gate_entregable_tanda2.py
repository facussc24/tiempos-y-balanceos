#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_gate_entregable_tanda2.py
"""G-E5 (asiento), G-E6 (cabecera STEP) y G-E7 (criterio de aceptacion) de gate_entregable.py, en las dos direcciones.

Modo AVISO (el de la primera semana): con la pieza sobre blando y sin gate_asiento, con un STEP de cabecera al revés y
sin criterio de aceptacion, el gate sigue en VERDE y deja los tres avisos; con todo en regla, ninguno. Modo FRENO (el
que Fak puede encender despues): los mismos tres faltantes dan ROJO. Una pieza sobre rigido no pide gate_asiento.
"""
import io
import json
import os
import sys
import tempfile
from contextlib import redirect_stdout

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import gate_entregable as ge  # noqa: E402
from cadlib import workdir as wd  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


OCC = ("ISO-10303-21;\nHEADER;\nFILE_NAME('x','2026',('A'),('B'),'Open CASCADE STEP processor 7.8','OC','U');\n"
       "FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\nENDSEC;\n"
       "END-ISO-10303-21;\n")
ISO = OCC.replace("FILE_NAME('x','2026',('A'),('B'),'Open CASCADE STEP processor 7.8','OC','U');\n", "") \
         .replace("FILE_SCHEMA", "FILE_NAME('x','2026',('A'),('B'),'OC','OC','U');\nFILE_SCHEMA", 1)


def armar(td, cabecera, tags, asiento=None, criterio=None):
    ent = os.path.join(td, "entrega")
    os.makedirs(ent, exist_ok=True)
    open(os.path.join(ent, "pieza.pdf"), "w").write("pdf")
    open(os.path.join(ent, "simulacion.mp4"), "w").write("mp4")
    open(os.path.join(ent, "pieza.step"), "w").write(cabecera)
    os.utime(os.path.join(ent, "pieza.pdf"), None)
    w = wd.ensure_workdir(os.path.join(td, "w"))
    if tags is not None:
        wd.record_evidence(w, "proceso_declarado", tags=tags)
    if asiento:
        stl = os.path.join(td, "pieza.stl")
        open(stl, "w").write("solid x\nendsolid x\n")
        wd.record_evidence(w, "asiento", corre=True, veredicto=asiento, filas={"apoyos": asiento},
                           pieza_archivo=stl, pieza_firma=wd.file_signature(stl))
    if criterio is not None:
        json.dump(criterio, open(os.path.join(w, "criterio_aceptacion.json"), "w", encoding="utf-8"))
    return ent, w


def correr(ent, w):
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = ge.verificar(ent, "foto3d", [], w, sin_render=True, motivo_sin_render="test")
    return rc, buf.getvalue()


CRIT = [{"que": "punta a punta de los anillos", "con": "calibre", "acepta": "142,9 a 143,3 mm"}]
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, OCC, ["apoya-sobre-blando"])
    rc, out = correr(ent, w)
    chequear(rc == 0 and "G-E5" in out and "G-E6" in out and "G-E7" in out,
             "modo aviso: sobre blando sin gate_asiento, STEP al reves y sin criterio -> VERDE con los tres avisos")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, ["apoya-sobre-blando"], asiento="VERDE", criterio=CRIT)
    rc, out = correr(ent, w)
    chequear(rc == 0 and "G-E5" not in out and "G-E6" not in out and "G-E7" not in out,
             "todo en regla (asiento VERDE, cabecera ISO, criterio escrito): ningun aviso")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, ["apoya-sobre-blando"], asiento="ROJO", criterio=[{"que": "x", "con": "", "acepta": "1"}])
    rc, out = correr(ent, w)
    chequear("gate_asiento.py dio ROJO" in out and "sin 'que', 'con' y 'acepta'" in out,
             "asiento ROJO y un criterio con un campo vacio: los dos avisan")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, ["apoya-sobre-rigido"], criterio=CRIT)
    rc, out = correr(ent, w)
    chequear(rc == 0 and "G-E5" not in out, "una pieza sobre rigido no pide gate_asiento")

print("ronda 1 del auditor (I3, I4, N1)")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, ["apoya-sobre-blando"], asiento="VERDE", criterio=CRIT)
    open(os.path.join(td, "pieza.stl"), "a").write("retocada\n")
    rc, out = correr(ent, w)
    chequear("no habla de la pieza de hoy" in out, "asiento VERDE pero la pieza se retoco despues: G-E5 avisa (I4)")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, ["hay-apriete"], criterio=CRIT)
    rc, out = correr(ent, w)
    chequear("no dice si el utillaje apoya sobre blando o sobre rigido" in out, "un pliego sin etiqueta de apoyo: G-E5 avisa (I3)")
with tempfile.TemporaryDirectory() as td:
    ent, w = armar(td, ISO, None, criterio=CRIT)
    rc, out = correr(ent, w)
    chequear("no hay pliego de gate_proceso" in out, "sin pliego en el workdir: G-E5 avisa")
for relleno in ({"que": "?", "con": "?", "acepta": "?"}, {"que": "x", "con": "x", "acepta": 0},
                {"que": "-", "con": "a definir", "acepta": "pendiente"}):
    with tempfile.TemporaryDirectory() as td:
        ent, w = armar(td, ISO, ["apoya-sobre-rigido"], criterio=[relleno])
        rc, out = correr(ent, w)
        chequear("G-E7" in out, "criterio de relleno %s: G-E7 avisa (N1)" % json.dumps(relleno, ensure_ascii=False))

viejo = ge.canon
try:
    def canon_freno():
        c = viejo()
        c["gateAsiento"]["modo"] = "freno"
        c["criterioAceptacion"]["modo"] = "freno"
        return c
    ge.canon = canon_freno
    with tempfile.TemporaryDirectory() as td:
        ent, w = armar(td, ISO, ["apoya-sobre-blando"])
        rc, out = correr(ent, w)
        chequear(rc == 1 and "[G-E5]" in out and "[G-E7]" in out, "modo freno: los mismos faltantes dan ROJO")
finally:
    ge.canon = viejo

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
sys.exit(1 if fallos else 0)
