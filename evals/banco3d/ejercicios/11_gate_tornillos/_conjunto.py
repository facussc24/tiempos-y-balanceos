"""Comun del ejercicio 11: conjunto de prueba con un tornillo (cilindro con cabeza 8 x 3, eje Z, apoyo de la cabeza en
z=0), una pila brida 4 + placa 15 + arandela 1 + tuerca 4 = 24 mm debajo de la cabeza, y el json de tornillos al lado
del STEP (<nombre>.tornillos.json, el que lee correctores/gate_tornillos.py). Es la pila del hallazgo 4 de la auditoria
del virolador del 20/10 (M4 de 25, 22 bajo la cabeza). Las medidas son de ejemplo, del banco: no es un diseno de Barack.
Uso desde bien.py / mal_*.py: armar(largo_bajo_cabeza, nombre) -> exporta <carpeta>/<nombre>.step y .tornillos.json"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

D = 4.0
PILA = (('brida', 4.0, 2.25, 40), ('placa', 15.0, 2.25, 40), ('arandela', 1.0, 2.2, 9), ('tuerca', 4.0, 1.5, 8))


def armar(largo, nombre):
    from build123d import Align, Box, Compound, Cylinder, Location, export_step
    out = carpeta_salida()
    A = (Align.CENTER, Align.CENTER, Align.MIN)
    tornillo = (Cylinder(D / 2, largo, align=A) + Cylinder(4.0, 3.0, align=A).moved(Location((0, 0, -3.0)))).solids()[0]
    tornillo.label = 'T1'
    hijos, z = [tornillo], 0.0
    for nom, esp, r_agujero, ancho in PILA:
        s = (Box(ancho, ancho, esp, align=A) - Cylinder(r_agujero, esp, align=A)).moved(Location((0, 0, z))).solids()[0]
        s.label = nom
        hijos.append(s)
        z += esp
    for h in hijos:
        if not h.is_valid:
            salir_error('una pieza del conjunto no es valida')
    export_step(Compound(children=hijos), os.path.join(out, nombre + '.step'))
    decl = {'tornillos': [{'id': 'T1', 'diametro_mm': D, 'paso_mm': 0.7, 'largo_bajo_cabeza_mm': largo,
                           'eje': {'punto': [0, 0, 0], 'direccion': [0, 0, 1]},
                           'pila': [p[0] for p in PILA], 'carga_N': 0,
                           'motivo_sin_carga': 'conjunto de ensayo del banco, sin carga declarada',
                           'inserto': 'tuerca_acero'}]}
    with open(os.path.join(out, nombre + '.tornillos.json'), 'w', encoding='utf-8') as f:
        json.dump(decl, f, indent=1, ensure_ascii=False)
    print('ok', largo, 'pila', sum(p[1] for p in PILA))
