#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Graba en video UNA ventana (no la pantalla) mientras trabaja, para las tomas "Claude funcionando".

Le pide el dibujo a la propia ventana (PrintWindow), igual que capturar.ps1: sale bien aunque tenga otra
ventana encima, no le roba el foco a nadie y no muestra nada del resto de la pantalla.
No hace clic ni escribe en la ventana: solo la mira.

Uso:
    python grabar_ventana.py --titulo "Ensayo" --segundos 40 --salida tomas/ensayo.mp4
    python grabar_ventana.py --titulo "Claude" --segundos 30 --recorte 300,40,1900,1000 --salida tomas/x.mp4

    --titulo    como EMPIEZA el titulo de la ventana
    --segundos  cuanto graba (se puede cortar antes con un archivo <salida>.parar al lado)
    --cps       cuadros por segundo que saca (por defecto 8; el video sale a 30 repitiendo cuadros)
    --recorte   izquierda,arriba,derecha,abajo en pixeles de la ventana (para dejar afuera lo que no va)

Sale con 0 si grabo, 1 si no encontro la ventana o el video quedo vacio.
"""
import argparse
import ctypes
import subprocess
import sys
import time
from pathlib import Path

import win32con
import win32gui
import win32ui


def buscar(empieza):
    halladas = []

    def cada(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetWindowText(h).lower().startswith(empieza.lower()):
            halladas.append(h)
        return True

    win32gui.EnumWindows(cada, None)
    return halladas[0] if halladas else None


def cuadro(h, ancho, alto):
    """El dibujo actual de la ventana, en bytes BGRA de arriba hacia abajo."""
    dc_v = win32gui.GetWindowDC(h)
    dc_o = win32ui.CreateDCFromHandle(dc_v)
    dc_m = dc_o.CreateCompatibleDC()
    bmp = win32ui.CreateBitmap()
    bmp.CreateCompatibleBitmap(dc_o, ancho, alto)
    dc_m.SelectObject(bmp)
    ok = ctypes.windll.user32.PrintWindow(h, dc_m.GetSafeHdc(), 2)
    datos = bmp.GetBitmapBits(True) if ok else None
    win32gui.DeleteObject(bmp.GetHandle())
    dc_m.DeleteDC()
    dc_o.DeleteDC()
    win32gui.ReleaseDC(h, dc_v)
    return datos


def main(argv=None):
    ap = argparse.ArgumentParser(description="Graba una ventana en video.")
    ap.add_argument("--titulo", required=True)
    ap.add_argument("--segundos", type=float, default=30)
    ap.add_argument("--cps", type=float, default=8)
    ap.add_argument("--recorte", default="")
    ap.add_argument("--salida", required=True)
    a = ap.parse_args(argv)

    # por monitor: con dos pantallas de distinta escala, la medida "del sistema" no coincide con lo que la ventana dibuja
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        ctypes.windll.user32.SetProcessDPIAware()
    h = buscar(a.titulo)
    if not h:
        print("no encuentro una ventana cuyo titulo empiece con: %s" % a.titulo)
        return 1
    izq, arr, der, aba = win32gui.GetWindowRect(h)
    ancho, alto = der - izq, aba - arr
    filtro = "fps=30,format=yuv420p"
    if a.recorte:
        x0, y0, x1, y1 = (int(v) for v in a.recorte.split(","))
        filtro = "crop=%d:%d:%d:%d,%s" % ((x1 - x0) // 2 * 2, (y1 - y0) // 2 * 2, x0, y0, filtro)
    else:
        filtro = "crop=%d:%d:0:0,%s" % (ancho // 2 * 2, alto // 2 * 2, filtro)
    salida = Path(a.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    parar = salida.with_suffix(salida.suffix + ".parar")
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", "%dx%d" % (ancho, alto),
         "-r", str(a.cps), "-i", "-", "-vf", filtro, "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", str(salida)],
        stdin=subprocess.PIPE)
    paso, n, fin = 1.0 / a.cps, 0, time.time() + a.segundos
    siguiente = time.time()
    try:
        while time.time() < fin and not parar.exists():
            if (win32gui.GetWindowRect(h)[2] - win32gui.GetWindowRect(h)[0], win32gui.GetWindowRect(h)[3] - win32gui.GetWindowRect(h)[1]) != (ancho, alto):
                print("la ventana cambio de tamano: corto aca")
                break
            datos = cuadro(h, ancho, alto)
            if datos:
                ff.stdin.write(datos)
                n += 1
            siguiente += paso
            time.sleep(max(0.0, siguiente - time.time()))
    finally:
        ff.stdin.close()
        ff.wait()
    print("grabados %d cuadros (%.1f s) de %dx%d en %s" % (n, n / a.cps, ancho, alto, salida))
    return 0 if n and salida.exists() and salida.stat().st_size > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
