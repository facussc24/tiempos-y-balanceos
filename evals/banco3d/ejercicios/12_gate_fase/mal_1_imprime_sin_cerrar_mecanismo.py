# -*- coding: utf-8 -*-
"""12 gate de fases - MAL 1: la secuencia del 20/10: contrato y concepto cerrados y se pasa a la entrega (fase 4:
renders, PDF, imprimir) con el mecanismo sin cerrar (nunca se corrio el barrido sobre el conjunto). Piezas de ensayo
del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _escenario import escenario  # noqa: E402

escenario([["iniciar", None],
           ["cerrar", 0, {"ok-fak": "banco: contrato y zona confirmados por Fak"}],
           ["cerrar", 1, {"nota": "palanca con eje fijo; descartada la corredera"}],
           ["pasar", 4, {"step": "$STEP"}]])
