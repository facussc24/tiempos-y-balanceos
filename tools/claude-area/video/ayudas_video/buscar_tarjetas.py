#!/usr/bin/env python
# Busca con OCR (Tesseract, ingles) las tarjetas de archivo editado y los carteles de permiso en un MP4 ya armado.
# Es un control EXTRA: no reemplaza mirar los cuadros. Tesseract lee mal el castellano con tildes, asi que se buscan solo
# las palabras que no las llevan: Deshacer, borrador.json, SKILL.md, +7 / +29, Confirmar, Permitir, permiso.
#
# Uso: python buscar_tarjetas.py <video.mp4> [--desde 0] [--hasta 999] [--cada 0.5] [--carpeta <donde dejar los cuadros>]
# Sale con 1 si encontro algo.
import argparse
import pathlib
import re
import subprocess
import sys

import pytesseract
from PIL import Image, ImageOps

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
BUSCAR = re.compile(r"deshacer|desha|borrador\.?json|mail_borrador|skill\.md|\+\s?29\b|\+\s?7\s*-\s?0|confirmar cambios|permitir|permiso", re.I)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--desde", type=float, default=0.0)
    ap.add_argument("--hasta", type=float, default=9999.0)
    ap.add_argument("--cada", type=float, default=0.5)
    ap.add_argument("--carpeta", required=True)
    a = ap.parse_args()
    carpeta = pathlib.Path(a.carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    fin = [] if a.hasta >= 9999 else ["-to", str(a.hasta)]
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(a.desde), *fin, "-i", a.video,
                    "-vf", f"fps=1/{a.cada}", "-q:v", "3", str(carpeta / "f_%05d.jpg")], check=True)
    cuadros = sorted(carpeta.glob("f_*.jpg"))
    hallazgos = 0
    for i, c in enumerate(cuadros):
        t = a.desde + i * a.cada
        im = ImageOps.autocontrast(Image.open(c).convert("L"))
        im = im.resize((im.size[0] * 2, im.size[1] * 2))
        # el video mezcla fondo claro (el marco) y oscuro (la grabacion de Claude): se lee en las dos polaridades
        txt = (pytesseract.image_to_string(im, lang="eng", config="--psm 11") + "\n"
               + pytesseract.image_to_string(ImageOps.invert(im), lang="eng", config="--psm 11"))
        m = BUSCAR.findall(txt)
        if m:
            hallazgos += 1
            print(f"{t:7.1f} s  {c.name}: {sorted(set(x.lower() for x in m))}")
    print(f"{len(cuadros)} cuadros mirados (uno cada {a.cada} s desde {a.desde} s), {hallazgos} con algo")
    return 1 if hallazgos else 0


if __name__ == "__main__":
    sys.exit(main())
