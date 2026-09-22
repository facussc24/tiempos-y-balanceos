# -*- coding: utf-8 -*-
"""nube.py — antes de abrir un video de la biblioteca, asegurarse de que este en el disco.

22/09/2026. De los 91 videos de la moldeadora, 23 daban "Invalid argument" (errno 22) al
abrirlos con ffmpeg, ffprobe o Python, y los reporte como ROTOS. No lo estaban: estaban
solo en la nube. Pidiendole a OneDrive "conservar siempre en este dispositivo" (atributo
PINNED) bajaron los 23 en 4 minutos y los 23 abrieron con su duracion completa.

Por que abrirlos directo no los bajaba no lo se: a otros 68 videos, en el mismo estado,
leerles un byte si los bajo enteros (7,5 GB al disco sin querer). Lo que se vio es que
pedirlos con PINNED anda siempre, asi que eso es lo que hace esta funcion.

El bit que manda es RECALL_ON_DATA_ACCESS (0x400000), porque lo ve cualquier programa.
El mismo archivo dio 4199968 en PowerShell y 4194336 en Python: la diferencia es
REPARSE_POINT + SPARSE + OFFLINE, que Windows no le muestra a cualquiera (memoria
reference_onedrive_files_on_demand_liberar_espacio: el ReparsePoint solo lo ve
Get-ChildItem). Mirar el atributo NO baja el archivo; leerle un byte, si.

Solo libreria estandar, para que lo pueda importar tambien el entorno de audio.
"""
from __future__ import annotations

import os
import sys
import time

RECALL = 0x400000
PINNED = 0x80000
UNPINNED = 0x100000


def _k32():
    import ctypes
    import ctypes.wintypes as wt
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.GetFileAttributesW.argtypes = [wt.LPCWSTR]
    k.GetFileAttributesW.restype = wt.DWORD
    k.SetFileAttributesW.argtypes = [wt.LPCWSTR, wt.DWORD]
    k.SetFileAttributesW.restype = wt.BOOL
    return k


def en_la_nube(ruta: str) -> bool:
    """True si el archivo esta solo en la nube. No lo baja."""
    if os.name != "nt":
        return False
    a = _k32().GetFileAttributesW(ruta)
    return a != 0xFFFFFFFF and bool(a & RECALL)


def asegurar_local(ruta: str, espera: int = 600) -> bool:
    """Si el archivo esta solo en la nube, se lo pide a OneDrive y espera a que baje.

    Devuelve True si queda en el disco. Si no baja en `espera` segundos, avisa y devuelve
    False: el que llama decide si seguir, pero ya no falla sin decir por que.
    """
    if not en_la_nube(ruta):
        return True
    k = _k32()
    a = k.GetFileAttributesW(ruta)
    print(f"  {os.path.basename(ruta)} esta solo en la nube: pidiendolo a OneDrive...",
          file=sys.stderr, flush=True)
    k.SetFileAttributesW(ruta, (a | PINNED) & ~UNPINNED)
    t0 = time.time()
    while time.time() - t0 < espera:
        time.sleep(5)
        if not (k.GetFileAttributesW(ruta) & RECALL):
            print(f"  bajo en {time.time() - t0:.0f} s", file=sys.stderr, flush=True)
            return True
    print(f"  NO bajo en {espera} s. Abrilo una vez desde el Explorador y reintenta.",
          file=sys.stderr, flush=True)
    return False
