# -*- coding: utf-8 -*-
"""Lo que el gate del skill necesita saber de cada hoja, SACADO DEL GENERADOR.

Una sola fuente: si manana una hoja pasa de rotulada a secuencia, o cambia de foto
principal, no hay que acordarse de tocar dos archivos. Un spec escrito a mano al lado del
generador es un segundo original, y el segundo original siempre se queda viejo.

    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \
          "scripts/img/HOJAS DE PROCESO - MAQUINA IMG.pptx" --spec scripts/img/spec_gate_img.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_hojas_img import HOJAS_IMG  # noqa: E402

HOJAS = []
for h in HOJAS_IMG:
    secuencia = h.get("modo", "secuencia") == "secuencia"
    HOJAS.append({
        "op": h["op"],
        # en una hoja de secuencia no hay principal: las fotos son pares, una por paso
        "principal": None if secuencia else 0,
        "secuencia": secuencia,
        # en las rotuladas la foto ES lo que hay que leer (una pantalla o un panel)
        "leer": [] if secuencia else [0],
    })
