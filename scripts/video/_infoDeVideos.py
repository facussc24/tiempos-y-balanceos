# -*- coding: utf-8 -*-
"""
_infoDeVideos.py — convierte una carpeta de videos de maquina en material LEIBLE
y lo deja archivado al lado de los videos, en la biblioteca de Ingenieria.

Por que existe: un video de 3 minutos filmando un HMI son ~700 cuadros y ~20 pantallas
distintas. Lo que sirve son esas 20. Y el audio de planta con los tecnicos chinos no
sirve como fuente de un numero, pero si sirve cuando narra Facundo.

Deja, dentro de la carpeta de los videos:
  _INFO SACADA DE LOS VIDEOS/
      fotogramas de cada video/<IMG_xxxx>/   el mas nitido de cada pantalla distinta
      transcripciones/<IMG_xxxx>.txt         audio con marca de tiempo
      LEEME - que hay en cada carpeta.txt

NO BORRA NADA (la biblioteca esta bajo control documental y lleva "NUNCA BORRAR" en el
nombre): si una carpeta ya tiene cuadros, la saltea.

Uso:
  python scripts/video/_infoDeVideos.py cuadros  "<carpeta de videos>" [--desde 2026-09-09] [--tope 24]
  python scripts/video/_infoDeVideos.py audio    "<carpeta de videos>" [--desde 2026-09-09] [--solo 0813,0820]
  python scripts/video/_infoDeVideos.py todo     "<carpeta de videos>" [--desde 2026-09-09]

--desde filtra por la fecha que llevan los nombres de la casa
(AAAA-MM-DD - que se ve (IMG_xxxx).MOV). El audio necesita el entorno .venv-audio
(faster-whisper); los cuadros solo ffmpeg + Pillow.
"""
from __future__ import annotations
import argparse, os, re, shutil, subprocess, sys


def tag_de(nombre: str) -> str:
    m = re.search(r"\(IMG_(\d+)\)", nombre)
    return m.group(1) if m else os.path.splitext(nombre)[0][:12]


def fecha_de(nombre: str) -> str:
    m = re.match(r"(\d{4}-\d{2}-\d{2})", nombre)
    return m.group(1) if m else ""


def videos_de(carpeta: str, desde: str | None) -> list[str]:
    vs = [f for f in os.listdir(carpeta) if f.lower().endswith((".mov", ".mp4", ".m4v"))]
    if desde:
        vs = [f for f in vs if fecha_de(f) >= desde]
    return sorted(vs)


def carpeta_info(carpeta: str) -> str:
    d = os.path.join(carpeta, "_INFO SACADA DE LOS VIDEOS")
    os.makedirs(d, exist_ok=True)
    return d


# ------------------------------------------------------------------ cuadros
def cuadros(carpeta: str, desde: str | None, tope: int, trabajo: str,
            solo: set[str] | None = None) -> None:
    import numpy as np
    from PIL import Image

    def dhash(im, s=16):
        g = np.asarray(im.convert("L").resize((s + 1, s)), dtype=np.int16)
        return (g[:, 1:] > g[:, :-1]).flatten()

    def nitidez(p):
        g = np.asarray(Image.open(p).convert("L").resize((320, 240)), dtype=np.float32)
        lap = g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4 * g[1:-1, 1:-1]
        return float(lap.var())

    destino = os.path.join(carpeta_info(carpeta), "fotogramas de cada video")
    vs = videos_de(carpeta, desde)
    if solo:  # el orden de la lista es el orden de prioridad
        vs = [v for t in solo for v in vs if tag_de(v) == t]
    for v in vs:
        t = tag_de(v)
        dst = os.path.join(destino, t)
        if os.path.isdir(dst) and os.listdir(dst):
            print(f"skip {t} (ya tiene {len(os.listdir(dst))})", flush=True)
            continue
        crudo = os.path.join(trabajo, t)
        os.makedirs(crudo, exist_ok=True)
        if not os.listdir(crudo):
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", os.path.join(carpeta, v),
                 "-vf", "fps=1/2,scale=1600:-1", "-q:v", "3",
                 os.path.join(crudo, f"{t}_%04d.jpg")], check=False)
        fs = sorted(os.path.join(crudo, f) for f in os.listdir(crudo) if f.lower().endswith(".jpg"))
        if not fs:
            print(f"{t}: SIN CUADROS", flush=True)
            continue
        grupos, actual, href = [], [], None
        for p in fs:
            try:
                h = dhash(Image.open(p))
            except Exception:
                continue
            if href is None or int((h != href).sum()) > 28:
                if actual:
                    grupos.append(actual)
                actual, href = [p], h
            else:
                actual.append(p)
        if actual:
            grupos.append(actual)
        total = len(grupos)
        if total > tope:
            paso = total / tope
            grupos = [grupos[int(i * paso)] for i in range(tope)]
        os.makedirs(dst, exist_ok=True)
        for i, g in enumerate(grupos, 1):
            shutil.copy2(max(g, key=nitidez), os.path.join(dst, f"{t}_{i:02d}.jpg"))
        print(f"{t}: {len(grupos)} cuadros (escenas {total}, crudos {len(fs)})", flush=True)


# ------------------------------------------------------------------ audio
def audio(carpeta: str, desde: str | None, solo: set[str] | None, trabajo: str) -> None:
    from faster_whisper import WhisperModel

    destino = os.path.join(carpeta_info(carpeta), "transcripciones")
    os.makedirs(destino, exist_ok=True)
    print("cargando modelo...", flush=True)
    modelo = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    for v in videos_de(carpeta, desde):
        t = tag_de(v)
        if solo and t not in solo:
            continue
        dst = os.path.join(destino, f"{t}.txt")
        if os.path.exists(dst):
            print(f"skip {t}", flush=True)
            continue
        wav = os.path.join(trabajo, f"{t}.wav")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(carpeta, v),
             "-ac", "1", "-ar", "16000", wav], check=False)
        segs, info = modelo.transcribe(wav, language="es", vad_filter=True, beam_size=1)
        lineas = [
            f"# {v}",
            f"# idioma={info.language} prob={info.language_probability:.2f}",
            "# OJO: el audio de planta con los tecnicos NO es fuente de un numero. Los numeros",
            "# salen de la pantalla del HMI. Lo que si sirve es lo que narra Facundo.",
            "",
        ]
        for s in segs:
            lineas.append(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {s.text.strip()}")
        open(dst, "w", encoding="utf-8").write("\n".join(lineas))
        try:
            os.remove(wav)
        except OSError:
            pass
        print(f"{t}: {len(lineas) - 5} segmentos", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("accion", choices=["cuadros", "audio", "todo"])
    ap.add_argument("carpeta")
    ap.add_argument("--desde", help="fecha AAAA-MM-DD; filtra por el nombre del archivo")
    ap.add_argument("--tope", type=int, default=24, help="maximo de cuadros por video (default 24)")
    ap.add_argument("--solo", help="lista de IMG_xxxx separados por coma; en 'cuadros' fija ademas el orden")
    ap.add_argument("--trabajo", default=os.path.join(os.environ.get("TEMP", "/tmp"), "_infoDeVideos"))
    a = ap.parse_args()
    if not os.path.isdir(a.carpeta):
        print(f"No existe la carpeta: {a.carpeta}", file=sys.stderr)
        return 1
    os.makedirs(a.trabajo, exist_ok=True)
    solo = [x.strip() for x in a.solo.split(",")] if a.solo else None
    if a.accion in ("cuadros", "todo"):
        cuadros(a.carpeta, a.desde, a.tope, a.trabajo, solo)
    if a.accion in ("audio", "todo"):
        audio(a.carpeta, a.desde, solo, a.trabajo)
    print("LISTO", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
