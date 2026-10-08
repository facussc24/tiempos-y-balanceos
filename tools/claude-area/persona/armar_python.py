"""Arma un Python liviano y portable (un .zip) para otra PC, copiando el de esta: la base sin las pruebas y, de
site-packages, solo los paquetes de oficina que usan los programas del repo y lo que cada uno necesita.

    python tools/claude-area/persona/armar_python.py --out <archivo.zip> [--paquetes python-pptx Pillow ...]

Por que copiar y no bajar: en la PC de destino no hace falta internet, ni administrador, ni aceptar nada; el
Python de python.org instalado por usuario se puede mover de carpeta (busca su Lib al lado del python.exe).
Se lo usa con `python -m pip` (los .exe de Scripts\\ traen la ruta de esta PC adentro).
"""
import argparse
import importlib.metadata as md
import os
import sys
import zipfile
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement

# Los de oficina: PowerPoint, Excel, PDF, imagenes, planos DXF, graficos, Outlook/Office por COM.
PAQUETES = [
    'pip', 'python-pptx', 'Pillow', 'numpy', 'openpyxl', 'XlsxWriter', 'pywin32', 'PyMuPDF',
    'ezdxf', 'opencv-python', 'scipy', 'lxml', 'packaging',
]
SALTEAR_BASE = {'Lib/site-packages', 'Lib/test', 'Lib/idlelib/idle_test', 'Doc', 'Scripts'}


def resolver(nombres):
    """Distribuciones pedidas + sus dependencias (sin extras), con los marcadores de esta PC (Windows)."""
    env = default_environment()
    vistas, pila, faltan = {}, list(nombres), []
    while pila:
        n = pila.pop()
        clave = n.lower().replace('_', '-')
        if clave in vistas:
            continue
        try:
            d = md.distribution(n)
        except md.PackageNotFoundError:
            faltan.append(n)
            continue
        vistas[clave] = d
        for r in d.requires or []:
            req = Requirement(r)
            if req.marker and not req.marker.evaluate({**env, 'extra': ''}):
                continue
            pila.append(req.name)
    return vistas, faltan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--paquetes', nargs='*', default=PAQUETES)
    a = ap.parse_args()
    base = Path(sys.base_prefix)
    sp = base / 'Lib' / 'site-packages'
    dists, faltan = resolver(a.paquetes)
    if faltan:
        print('NO estan en este Python:', ', '.join(faltan))
        sys.exit(1)
    archivos = set()
    for d in dists.values():
        for f in d.files or []:
            p = (sp / f).resolve()
            if p.is_file() and sp.resolve() in p.parents and '__pycache__' not in p.parts:
                archivos.add(p)
    # pywin32 se carga por su .pth (win32, win32\lib, Pythonwin) y necesita sus DLL de pywin32_system32
    # (distutils-precedence.pth NO: es de setuptools, que no va, y sin el da un error al arrancar)
    for extra in ['pywin32.pth']:
        if (sp / extra).is_file():
            archivos.add((sp / extra).resolve())
    n, bytes_ = 0, 0
    with zipfile.ZipFile(a.out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for raiz, dirs, files in os.walk(base):
            rel = Path(raiz).relative_to(base).as_posix()
            if any(rel == s or rel.startswith(s + '/') for s in SALTEAR_BASE):
                dirs[:] = []
                continue
            dirs[:] = [x for x in dirs if x != '__pycache__']
            for f in files:
                p = Path(raiz) / f
                z.write(p, (Path(rel) / f).as_posix() if rel != '.' else f)
                n += 1
                bytes_ += p.stat().st_size
        for p in sorted(archivos):
            z.write(p, ('Lib/site-packages/' + p.relative_to(sp.resolve()).as_posix()))
            n += 1
            bytes_ += p.stat().st_size
    print(f'OK: {a.out} -> {n} archivos, {bytes_ / 1e6:.0f} MB sin comprimir, {os.path.getsize(a.out) / 1e6:.0f} MB el zip')
    print('paquetes:', ', '.join(sorted(f"{d.metadata['Name']} {d.version}" for d in dists.values())))


if __name__ == '__main__':
    main()
