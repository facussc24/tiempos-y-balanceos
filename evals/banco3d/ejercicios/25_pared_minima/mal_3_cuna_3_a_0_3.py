"""25 pared minima - MAL 3: cuna de 100 x 60 mm que va de 3 mm a 0,3 mm de espesor (las caras convergen 1,55 grados). Es la
pared fina que augura no ve (mira el centro de cada cara y una grilla de 3 x 3): el control denso la ve y la avisa (AVISO,
nunca rojo: caras que convergen)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pared import armar_cuna  # noqa: E402

armar_cuna('cuna_3_a_0_3')
