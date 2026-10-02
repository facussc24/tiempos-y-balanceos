# -*- coding: utf-8 -*-
"""_emitirUpperTrim.py — atajo: emite el flujograma 160 o el AMFE 174 del Upper Trim Panel.

Desde el 02/10/2026 la logica vive en `scripts/_emitirApqp.py` (el emisor comun a todas las
piezas, con sus rutas en `scripts/_lib/emisionesApqp.data.json`). Este archivo queda solo para
que la linea de comandos de siempre siga andando; no tiene logica propia.

Uso:  python scripts/_emitirUpperTrim.py <flujograma|amfe> [--apply] [--pisar | --reemplazar]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _emitirApqp import main  # noqa: E402

CLAVES = {"flujograma": "160-flujograma", "amfe": "174-amfe"}

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1 or args[0] not in CLAVES:
        sys.exit("Uso: python scripts/_emitirUpperTrim.py <flujograma|amfe> [--apply] [--pisar | --reemplazar]")
    sys.exit(main([CLAVES[args[0]]] + [a for a in sys.argv[1:] if a.startswith("--")]))
