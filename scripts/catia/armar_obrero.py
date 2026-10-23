# -*- coding: utf-8 -*-
"""armar_obrero.py: arma el paquete del obrero de CATIA en la carpeta de la nube que ve la notebook.

Uso: python scripts/catia/armar_obrero.py --destino "<...>/COLA 3D/obrero"
Copia obrero.py, catia_base.py, requisitos.txt, LEEME.txt, Arrancar-obrero.cmd (con fin de linea de Windows) y
ejercicios/ (sin __pycache__ ni tests). Nunca borra nada en el destino; un archivo que ya esta igual no se vuelve a
escribir (asi no se toca el .cmd mientras corre). Al final compara cada archivo copiado con el original (sha256).
"""
import argparse
import hashlib
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SUELTOS = ["obrero.py", "catia_base.py", "requisitos.txt", "LEEME.txt", "Arrancar-obrero.cmd"]
CON_FIN_DE_LINEA_WINDOWS = {".cmd", ".txt"}
NO_COPIAR = {"__pycache__", "tests"}


def contenido(origen):
    with open(origen, "rb") as f:
        datos = f.read()
    if os.path.splitext(origen)[1].lower() in CON_FIN_DE_LINEA_WINDOWS:
        datos = datos.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    return datos


def lista():
    out = [(os.path.join(AQUI, n), n) for n in SUELTOS]
    base = os.path.join(AQUI, "ejercicios")
    for raiz, dirs, archivos in os.walk(base):
        dirs[:] = sorted(d for d in dirs if d not in NO_COPIAR)
        for a in sorted(archivos):
            if a.endswith((".pyc", ".pyo")):
                continue
            origen = os.path.join(raiz, a)
            out.append((origen, os.path.relpath(origen, AQUI)))
    return out


def armar(destino):
    destino = os.path.abspath(destino)
    os.makedirs(destino, exist_ok=True)
    filas, errores = [], []
    for origen, rel in lista():
        if not os.path.isfile(origen):
            errores.append(f"falta el original {origen}")
            continue
        datos = contenido(origen)
        dst = os.path.join(destino, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        igual = os.path.isfile(dst) and open(dst, "rb").read() == datos
        if not igual:
            with open(dst, "wb") as f:
                f.write(datos)
        with open(dst, "rb") as f:
            copiado = hashlib.sha256(f.read()).hexdigest()
        ok = copiado == hashlib.sha256(datos).hexdigest()
        if not ok:
            errores.append(f"{rel}: lo copiado no coincide con el original")
        filas.append((rel, len(datos), "igual, no se toco" if igual else "copiado", "ok" if ok else "DISTINTO"))
    return filas, errores


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--destino", required=True, help='carpeta "COLA 3D/obrero" de la nube')
    a = p.parse_args()
    filas, errores = armar(a.destino)
    for rel, tam, que, ok in filas:
        print(f"{ok:8} {que:18} {tam:8d}  {rel}")
    print(f"{len(filas)} archivos en {os.path.abspath(a.destino)}")
    for e in errores:
        print("ERROR", e)
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
