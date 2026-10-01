# -*- coding: utf-8 -*-
"""Lo que el gate del skill necesita saber de cada hoja de HOTMELT, sacado del generador.

Una sola fuente: si mañana una hoja pasa de secuencia a jerarquía o cambia de foto principal,
no hay que tocar dos archivos.

    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \
          "C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop\\Hojas de proceso maquina HOTMELT - desde los videos\\_trabajo\\HOJAS DE PROCESO - MAQUINA HOTMELT.pptx" \
          --spec scripts/hotmelt/spec_gate_hotmelt.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_hojas_hotmelt import HOJAS_HOTMELT  # noqa: E402

HOJAS = []
for h in HOJAS_HOTMELT:
    pr = h.get("principal")
    sec = (pr is None)
    # En el PPTX, tras ordenar por (top, left), la foto principal siempre queda en índice 0
    HOJAS.append({
        "op": h["op"],
        "principal": 0 if not sec else None,
        "secuencia": sec,
        "leer": [0] if h["op"] in ("20.2", "20.9") else [],
    })
