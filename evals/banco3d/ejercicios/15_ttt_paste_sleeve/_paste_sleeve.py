"""Comun del ejercicio 15: PPP01-05 Paste Sleeve de Too Tall Toby (guia de build123d, tttt.html#ttt-ppp0105; plano en
la nube, ruta y sha256 en tarea.yaml). Es el pieza.py de la practica del 23/10/2026 (practica/ttt/02_paste_sleeve/,
sha256 en tarea.yaml) con la misma geometria, paso por paso; lo unico que cambia es la salida (el contrato del banco:
<carpeta>/<nombre>.step con UN solido con nombre ppp0105, y <nombre>.stl) y que se puede saltear un paso o cambiar la
pared (mutantes). Es una lectura propia del plano, no el codigo de referencia de la pagina.
Ejes: Z arriba (boca grande abajo en z=0, boca chica arriba en z=133), X = lado largo de las dos bocas.
Pared: loft exterior menos loft interior (las aberturas 45 x 38 y 60 x 4 acotadas en el plano horizontal), como el
intento 1 de la practica.

Uso desde bien.py / mal_*.py:
  armar(nombre, sin, pared)  ->  <carpeta>/<nombre>.step y .stl; sin = pasos que NO se hacen; pared en mm (3 = plano).
Pasos que se pueden sacar: tramo_recto (el tramo de 30 de abajo), boca_abajo (la boca de abajo queda cerrada con un
fondo del espesor de la pared)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

NOMBRE_SOLIDO = 'ppp0105'   # el de preguntas en tarea.yaml
DENSIDAD = 1.02e-3          # g/mm3 (1020 kg/m3, rotulo del plano segun lectura.md)

ALTO, ALTO_RECTO, PARED = 133.0, 30.0, 3.0
INT_ABAJO = (45.0, 38.0)  # abertura interior abajo (largo, ancho)
INT_ARRIBA = (60.0, 4.0)  # abertura interior arriba


def oblonga(largo, ancho, z):
    from build123d import Plane, SlotOverall
    return Plane.XY.offset(z) * SlotOverall(largo, ancho)


def modelo(sin=frozenset(), pared=PARED):
    from build123d import extrude, loft
    ext_ab = (INT_ABAJO[0] + 2 * pared, INT_ABAJO[1] + 2 * pared)
    ext_ar = (INT_ARRIBA[0] + 2 * pared, INT_ARRIBA[1] + 2 * pared)
    # tramo conico reglado
    ext_cono = loft([oblonga(*ext_ab, ALTO_RECTO), oblonga(*ext_ar, ALTO)], ruled=True)
    int_cono = loft([oblonga(*INT_ABAJO, ALTO_RECTO), oblonga(*INT_ARRIBA, ALTO)], ruled=True)
    int_tapa = extrude(oblonga(*INT_ARRIBA, ALTO), 1)
    if 'tramo_recto' in sin:
        exterior = ext_cono
        interior = int_cono + int_tapa + extrude(oblonga(*INT_ABAJO, ALTO_RECTO - 1), 1)
    else:
        # tramo recto
        ext_recto = extrude(oblonga(*ext_ab, 0), ALTO_RECTO)
        if 'boca_abajo' in sin:
            int_recto = extrude(oblonga(*INT_ABAJO, pared), ALTO_RECTO - pared)
        else:
            int_recto = extrude(oblonga(*INT_ABAJO, -1), ALTO_RECTO + 1)
        exterior = ext_recto + ext_cono
        interior = int_recto + int_cono + int_tapa
    p = exterior - interior
    solidos = p.solids()
    if len(solidos) != 1:
        salir_error(f'la pieza salio en {len(solidos)} solidos')
    return solidos[0]


def armar(nombre, sin=frozenset(), pared=PARED):
    from build123d import Compound, export_step, export_stl
    out = carpeta_salida()
    s = modelo(frozenset(sin), pared)
    if not s.is_valid:
        salir_error('la pieza no es valida')
    s.label = NOMBRE_SOLIDO
    conjunto = Compound(children=[s])
    export_step(conjunto, os.path.join(out, nombre + '.step'))
    export_stl(conjunto, os.path.join(out, nombre + '.stl'))
    v = s.volume
    bb = s.bounding_box()
    print(f'ok {NOMBRE_SOLIDO} volumen={v:.1f} mm3 masa={v * DENSIDAD:.3f} g caras={len(s.faces())} bbox=('
          f'{bb.min.X:.2f},{bb.min.Y:.2f},{bb.min.Z:.2f})..({bb.max.X:.2f},{bb.max.Y:.2f},{bb.max.Z:.2f})')
