# -*- coding: utf-8 -*-
"""Lo que el gate del skill necesita saber de cada hoja, SACADO DEL GENERADOR (una sola fuente).

    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \
          "scripts/embossing/HOJAS DE PROCESO - PRENSA EMBOSSING.pptx" \
          --spec scripts/embossing/spec_gate_embossing.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_hojas_embossing import HOJAS as _HOJAS  # noqa: E402

HOJAS = []
for h in _HOJAS:
    secuencia = h.get("modo", "secuencia") == "secuencia"
    HOJAS.append({
        "op": h["op"],
        "principal": None if secuencia else 0,
        "secuencia": secuencia,
        "leer": [] if secuencia else [0],
    })
