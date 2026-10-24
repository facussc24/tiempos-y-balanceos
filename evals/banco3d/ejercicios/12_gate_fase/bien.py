# -*- coding: utf-8 -*-
"""12 gate de fases - BIEN: las fases cerradas en orden con su evidencia: contrato (zona y pliego + OK de Fak), concepto
(nota), mecanismo (el barrido de la palanca del 06 corre y da verde sobre el conjunto vigente + OK de Fak) y despues
pasar a la fase 3 (detalle). Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _escenario import escenario  # noqa: E402

escenario([["iniciar", None],
           ["cerrar", 0, {"ok-fak": "banco: contrato y zona confirmados por Fak"}],
           ["cerrar", 1, {"nota": "palanca con eje fijo; descartada la corredera"}],
           ["cerrar", 2, {"step": "$STEP", "movimiento": "$MOV", "ok-fak": "banco: la palanca gira sin tocar nada"}],
           ["pasar", 3, {}]])
