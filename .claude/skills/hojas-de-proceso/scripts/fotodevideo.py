# -*- coding: utf-8 -*-
"""fotodevideo.py — la foto de una hoja de proceso sale del VIDEO, no del fotograma de la biblioteca.

Por que existe (21/09/2026). Los fotogramas de `_INFO SACADA DE LOS VIDEOS` se sacan a
`fps=1/2` y escalados a 1600: sirven para ENCONTRAR el momento, no para ilustrar un paso.
Dos motivos, los dos medidos:

  1. **Un cuadro cada 2 segundos no es el mejor cuadro.** Filmando a mano, entre dos
     muestras hay 59 cuadros que nadie miro, y el foco entre vecinos se mueve un orden de
     magnitud. Aca se extrae la VENTANA entera a resolucion completa y se elige por foco.
  2. **El metadato de rotacion del telefono puede estar mal.** El IMG_0585 declara
     `rotation=90`, ffmpeg la aplica, y el tablero igual sale acostado. La rotacion se
     MIRA y se pasa a mano con --rot.

Y la tercera, que no es del video: **una foto de maquina sin recortar no explica un paso.**
Una toma general del portico se parece a la del paso anterior y a la del siguiente. El
recorte es lo que convierte una foto en una instruccion, asi que --crop no es opcional
cuando la accion pasa en una parte de la maquina.

De donde salio cada foto queda ESCRITO ADENTRO del archivo (EXIF/`ImageDescription` y, en
PNG, chunk de texto): video, segundo, rotacion y recorte. Un JPG suelto en una carpeta de
assets sin eso es un huerfano: nadie puede rehacerlo ni verificarlo.

    fotodevideo.py ubicar   --video V --cuadro <frame de la biblioteca>   -> el segundo
    fotodevideo.py ventana  --video V --seg 123 [--radio 1.5] [--rot 90] --plancha P.jpg
    fotodevideo.py sacar    --video V --seg 123.4 [--rot 90] [--crop x,y,w,h] --out F.jpg
                            [--nota "que se ve"] [--radio 0.5 para elegir el mejor vecino]
    fotodevideo.py leer     --foto F.jpg          -> de donde salio

Los tres primeros dejan archivos en --trabajo (por defecto el TEMP), nunca en la biblioteca.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

CLAVE = "hoja-de-proceso:origen"       # donde se escribe la procedencia
FPS_BIBLIOTECA = 0.5                    # el muestreo con el que se armo la biblioteca


# ----------------------------------------------------------------- utilidades
def _correr(cmd: list[str]) -> None:
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def foco(im: Image.Image) -> float:
    """Varianza del laplaciano sobre el gris: cuanto borde nitido tiene. Ordena, no decide."""
    g = im.convert("L")
    g.thumbnail((900, 900))
    a = np.asarray(g, dtype=np.float32)
    h, w = a.shape
    if h < 5 or w < 5:
        return 0.0
    lap = (a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:] - 4 * a[1:-1, 1:-1])
    return float(lap.var())


def dhash(im: Image.Image, s: int = 16) -> np.ndarray:
    g = np.asarray(im.convert("L").resize((s + 1, s)), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


def _trabajo_de(ruta: str | None, sufijo: str) -> str:
    base = ruta or os.path.join(tempfile.gettempdir(), "fotodevideo")
    d = os.path.join(base, sufijo)
    os.makedirs(d, exist_ok=True)
    return d


def _tag(video: str) -> str:
    import re
    m = re.search(r"IMG_E?(\d+)", os.path.basename(video), re.IGNORECASE)
    return m.group(1) if m else os.path.splitext(os.path.basename(video))[0][:12]


def girar(im: Image.Image, rot: int) -> Image.Image:
    """rot en grados horarios: 90 = la escena esta acostada a la izquierda y se endereza."""
    if rot % 360 == 0:
        return im
    return im.rotate(-rot, expand=True)


def recortar(im: Image.Image, crop: str | None) -> Image.Image:
    """--crop x,y,w,h en PORCENTAJE de la imagen ya girada (0-100). En % para que el
    recorte no dependa de la resolucion con la que se lo probo."""
    if not crop:
        return im
    p = [float(v) for v in crop.replace(" ", "").split(",")]
    if len(p) != 4:
        raise SystemExit("--crop va x,y,w,h en % (ej 20,10,55,60)")
    W, H = im.size
    x, y, w, h = int(p[0] * W / 100), int(p[1] * H / 100), int(p[2] * W / 100), int(p[3] * H / 100)
    x, y = max(0, x), max(0, y)
    return im.crop((x, y, min(W, x + w), min(H, y + h)))


# ----------------------------------------------------------------- extraccion
def cuadros_en(video: str, t0: float, t1: float, destino: str, alto: int | None = None) -> list[str]:
    """Todos los cuadros del video entre t0 y t1, a resolucion completa."""
    for f in os.listdir(destino):
        os.remove(os.path.join(destino, f))
    vf = [] if alto is None else ["-vf", f"scale=-2:{alto}"]
    _correr(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{max(0.0, t0):.3f}",
             "-to", f"{t1:.3f}", "-i", video, *vf, "-q:v", "2",
             os.path.join(destino, "c_%05d.jpg")])
    return sorted(os.path.join(destino, f) for f in os.listdir(destino) if f.endswith(".jpg"))


def mejor_cuadro(video: str, seg: float, radio: float, trabajo: str, rot: int) -> tuple[str, float, float]:
    """Devuelve (ruta, segundo, foco) del cuadro mas nitido de la ventana."""
    d = _trabajo_de(trabajo, "ventana_" + _tag(video))
    fs = cuadros_en(video, seg - radio, seg + radio, d)
    if not fs:
        raise SystemExit(f"sin cuadros en {seg - radio:.2f}..{seg + radio:.2f} s")
    fps = sonda_fps(video)
    filas = []
    for i, p in enumerate(fs):
        im = girar(Image.open(p), rot)
        filas.append((foco(im), p, max(0.0, seg - radio) + i / fps))
    filas.sort(reverse=True)
    v, p, t = filas[0]
    return p, t, v


def sonda_fps(video: str) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", video],
                         capture_output=True, text=True).stdout
    # ffprobe puede devolver "30000/1001," (coma de sobra) o varias lineas: se toma el primero
    out = out.replace(",", " ").split()[0] if out.strip() else ""
    try:
        if "/" in out:
            a, b = out.split("/")
            return float(a) / float(b) if float(b) else 30.0
        return float(out)
    except ValueError:
        return 30.0


# ----------------------------------------------------------------- procedencia
def _texto_origen(video: str, seg: float, rot: int, crop: str | None,
                  nota: str | None, foc: float) -> str:
    return json.dumps({
        "video": os.path.basename(video),
        "segundo": round(seg, 3),
        "rot": rot,
        "crop": crop or "",
        "foco": round(foc, 1),
        "nota": nota or "",
    }, ensure_ascii=False)


def guardar(im: Image.Image, destino: str, origen: str, calidad: int = 92) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(destino)) or ".", exist_ok=True)
    if destino.lower().endswith(".png"):
        from PIL.PngImagePlugin import PngInfo
        meta = PngInfo()
        meta.add_text(CLAVE, origen)
        im.save(destino, "PNG", pnginfo=meta)
        return
    ex = Image.Exif()
    ex[270] = CLAVE + " " + origen          # 270 = ImageDescription
    im.convert("RGB").save(destino, "JPEG", quality=calidad, subsampling=1, exif=ex)


def leer_origen(ruta: str) -> str | None:
    im = Image.open(ruta)
    if ruta.lower().endswith(".png"):
        return (im.text or {}).get(CLAVE)
    ex = im.getexif()
    d = ex.get(270)  # ImageDescription
    if isinstance(d, bytes):
        d = d.decode("utf-8", "replace")
    if d and d.startswith(CLAVE):
        return d[len(CLAVE):].strip()
    return None


# ----------------------------------------------------------------- acciones
def acc_ubicar(a) -> int:
    """Encuentra en que segundo del video esta el fotograma de la biblioteca."""
    ref = dhash(Image.open(a.cuadro))
    d = _trabajo_de(a.trabajo, "ubicar_" + _tag(a.video))
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    _correr(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", a.video,
             "-vf", f"fps={FPS_BIBLIOTECA},scale=640:-2", "-q:v", "4",
             os.path.join(d, "m_%05d.jpg")])
    fs = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".jpg"))
    if not fs:
        print("no se pudo muestrear el video", file=sys.stderr)
        return 1
    mejor, dist = None, 10 ** 9
    for i, p in enumerate(fs):
        x = int((dhash(Image.open(p)) != ref).sum())
        if x < dist:
            mejor, dist = i, x
    seg = mejor / FPS_BIBLIOTECA
    print(f"{os.path.basename(a.cuadro)} -> segundo {seg:.1f}  (distancia {dist} de 256)")
    if dist > 40:
        print("  OJO: distancia alta, puede no ser el mismo cuadro. Mirar la ventana.")
    return 0


def acc_ventana(a) -> int:
    """Plancha con todos los cuadros de la ventana, con su segundo y su foco escritos."""
    d = _trabajo_de(a.trabajo, "ventana_" + _tag(a.video))
    fs = cuadros_en(a.video, a.seg - a.radio, a.seg + a.radio, d)
    if not fs:
        print("sin cuadros en esa ventana", file=sys.stderr)
        return 1
    fps = sonda_fps(a.video)
    t0 = max(0.0, a.seg - a.radio)
    filas = []
    for i, p in enumerate(fs):
        im = girar(Image.open(p), a.rot)
        filas.append((t0 + i / fps, p, foco(im)))
    if a.solo_mejores:
        filas = sorted(filas, key=lambda r: -r[2])[:a.solo_mejores]
        filas.sort()
    cols = 5
    celda = 520
    alto = celda * 3 // 4
    fil = (len(filas) + cols - 1) // cols
    hoja = Image.new("RGB", (cols * celda, fil * (alto + 24)), (20, 20, 24))
    dr = ImageDraw.Draw(hoja)
    for i, (t, p, v) in enumerate(filas):
        im = girar(Image.open(p), a.rot)
        im = recortar(im, a.crop)
        im.thumbnail((celda - 8, alto - 8))
        x = (i % cols) * celda + (celda - im.size[0]) // 2
        y = (i // cols) * (alto + 24) + (alto - im.size[1]) // 2
        hoja.paste(im, (x, y))
        dr.text(((i % cols) * celda + 8, (i // cols) * (alto + 24) + alto + 5),
                f"s={t:.2f}   foco {v:.0f}", fill=(235, 235, 240))
    hoja.save(a.plancha, quality=88)
    mejor = max(filas, key=lambda r: r[2])
    print(f"{len(filas)} cuadros  ·  mejor foco {mejor[2]:.0f} en s={mejor[0]:.2f}")
    print(f"plancha -> {a.plancha}")
    return 0


def acc_sacar(a) -> int:
    if a.radio > 0:
        p, seg, foc = mejor_cuadro(a.video, a.seg, a.radio, a.trabajo, a.rot)
    else:
        d = _trabajo_de(a.trabajo, "uno_" + _tag(a.video))
        fs = cuadros_en(a.video, a.seg, a.seg + 0.05, d)
        if not fs:
            print("sin cuadro en ese segundo", file=sys.stderr)
            return 1
        p, seg = fs[0], a.seg
        foc = foco(girar(Image.open(p), a.rot))
    im = recortar(girar(Image.open(p), a.rot), a.crop)
    if a.ancho and im.size[0] > a.ancho:
        im = im.resize((a.ancho, round(im.size[1] * a.ancho / im.size[0])), Image.LANCZOS)
    guardar(im, a.out, _texto_origen(a.video, seg, a.rot, a.crop, a.nota, foc))
    print(f"{a.out}  {im.size[0]}x{im.size[1]}  s={seg:.2f}  foco {foc:.0f}")
    return 0


def acc_leer(a) -> int:
    faltan = []
    for f in a.foto:
        o = leer_origen(f)
        if o:
            print(f"{os.path.basename(f)}: {o}")
        else:
            faltan.append(os.path.basename(f))
    if faltan:
        print(f"\nSIN PROCEDENCIA ({len(faltan)}): " + ", ".join(faltan))
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="accion", required=True)

    def comunes(p, con_video=True):
        if con_video:
            p.add_argument("--video", required=True)
        p.add_argument("--trabajo", default=None)

    p = sub.add_parser("ubicar", help="fotograma de la biblioteca -> segundo del video")
    comunes(p)
    p.add_argument("--cuadro", required=True)
    p.set_defaults(fn=acc_ubicar)

    p = sub.add_parser("ventana", help="plancha de la ventana, para elegir mirando")
    comunes(p)
    p.add_argument("--seg", type=float, required=True)
    p.add_argument("--radio", type=float, default=1.5)
    p.add_argument("--rot", type=int, default=0)
    p.add_argument("--crop")
    p.add_argument("--plancha", required=True)
    p.add_argument("--solo-mejores", dest="solo_mejores", type=int, default=0,
                   help="quedarse con los N mas nitidos de la ventana")
    p.set_defaults(fn=acc_ventana)

    p = sub.add_parser("sacar", help="la foto final, a resolucion completa y con procedencia")
    comunes(p)
    p.add_argument("--seg", type=float, required=True)
    p.add_argument("--radio", type=float, default=0.0,
                   help="si >0, elige el cuadro mas nitido en +/- radio segundos")
    p.add_argument("--rot", type=int, default=0)
    p.add_argument("--crop")
    p.add_argument("--ancho", type=int, default=0, help="ancho maximo en px del archivo final")
    p.add_argument("--nota")
    p.add_argument("--out", required=True)
    p.set_defaults(fn=acc_sacar)

    p = sub.add_parser("leer", help="de donde salio cada foto (sale 1 si alguna no lo dice)")
    p.add_argument("foto", nargs="+")
    p.set_defaults(fn=acc_leer)

    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    raise SystemExit(main())
