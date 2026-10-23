"""07 tornillo 7 mm - MAL 1: el mismo tornillo VIGENTE pero SIN el radio de 0,9 bajo la cabeza (canto vivo entre el
piso del rebaje de la cabeza y el vastago). Armado con build123d a partir del STEP real: se le saca al acuerdo un anillo
de radio 2,725 a 3,75 entre x 2,8 y 3,75 (dentro del rebaje de 3,8) y se le devuelve el vastago de 5,45 en ese tramo.
No hay STL real de un tornillo de 7 mm sin radio: es mutante armado para el banco a partir del BIEN."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tornillo import (tornillo_vigente, exportar, carpeta_salida, PISO_REBAJE_X, R_REBAJE, R_VASTAGO,  # noqa: E402
                       R_ACUERDO)
from build123d import Cylinder, Location, Rot  # noqa: E402

out = carpeta_salida()
pieza, cy, cz = tornillo_vigente(out)
largo = R_ACUERDO + 0.05
eje_x = Rot(0, 90, 0)
anillo = Cylinder(R_REBAJE - 0.05, largo) - Cylinder(R_VASTAGO, largo)
anillo = anillo.moved(Location((PISO_REBAJE_X + largo / 2, cy, cz)) * eje_x)
vastago = Cylinder(R_VASTAGO, largo + 0.1).moved(Location((PISO_REBAJE_X + largo / 2, cy, cz)) * eje_x)
mutante = (pieza - anillo) + vastago
exportar(mutante, out, 'tornillo_7mm_largo_30_sin_radio')
