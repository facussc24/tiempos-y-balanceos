"""07 tornillo 7 mm - MAL 3: el mismo tornillo VIGENTE con la cabeza mas ancha en la base (la cara que apoya en la
cama al imprimirlo acostado). Armado con build123d a partir del STEP real: se le suma debajo de la cabeza (x 0 a 2,8)
una pestana de 0,4 de alto que sobresale 0,3 por lado del ancho de la cabeza en la base.
OJO: el 0,3 y el 0,4 son VALORES DE PRUEBA del banco, no medidos: la forma real del ensanche que marco Fak no esta en
un papel (TBD contra su foto). No hay STL real de esta falla."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tornillo import tornillo_vigente, exportar, carpeta_salida, PISO_REBAJE_X  # noqa: E402
from build123d import Box, Location  # noqa: E402

SOBRA_POR_LADO, ALTO = 0.3, 0.4          # valores de prueba (ver arriba)
out = carpeta_salida()
pieza, cy, cz = tornillo_vigente(out)
bb = pieza.bounding_box()
base = pieza & Box(PISO_REBAJE_X, 40, 0.2).moved(Location((PISO_REBAJE_X / 2, cy, bb.min.Z + 0.1)))
bbb = base.bounding_box()
ancho = (bbb.max.Y - bbb.min.Y) + 2 * SOBRA_POR_LADO
pestana = Box(PISO_REBAJE_X, ancho, ALTO).moved(Location((PISO_REBAJE_X / 2, cy, bb.min.Z + ALTO / 2)))
exportar(pieza + pestana, out, 'tornillo_7mm_largo_30_cabeza_ancha')
