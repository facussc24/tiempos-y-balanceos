# -*- coding: utf-8 -*-
"""Lo que el gate del skill necesita saber de cada hoja del CAMBIO DE MOLDE, sacado del
generador (misma idea que spec_gate_img.py: una sola fuente).

    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \
          "scripts/img/HOJAS DE PROCESO - CAMBIO DE MOLDE - MAQUINA IMG.pptx" \
          --spec scripts/img/spec_gate_cambio_molde.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_cambio_molde_img import HOJAS_CM  # noqa: E402

HOJAS = []
for h in HOJAS_CM:
    secuencia = h.get("modo", "secuencia") == "secuencia"
    HOJAS.append({
        "op": h["op"],
        "principal": None if secuencia else 0,
        "secuencia": secuencia,
        "leer": [] if secuencia else [0],
    })
