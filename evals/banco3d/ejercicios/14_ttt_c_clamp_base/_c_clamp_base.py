"""Comun del ejercicio 14: PPP01-03 C Clamp Base de Too Tall Toby (guia de build123d, tttt.html#ttt-ppp0103; plano en
la nube, ruta y sha256 en tarea.yaml). Es el pieza.py de la practica del 23/10/2026 (practica/ttt/01_c_clamp_base/,
sha256 en tarea.yaml) con la misma geometria, paso por paso; lo unico que cambia es la salida (el contrato del banco:
<carpeta>/<nombre>.step con UN solido con nombre ppp0103, y <nombre>.stl) y que se puede saltear un paso (mutantes).
Es una lectura propia del plano, no el codigo de referencia de la pagina.
Ejes: X a lo ancho (cara exterior izquierda del brazo en x=0), Z arriba (fondo en z=0), Y espesor (-8..8).

Uso desde bien.py / mal_*.py:
  armar(nombre, sin)  ->  <carpeta>/<nombre>.step y .stl; sin = pasos que NO se hacen.
Pasos que se pueden sacar: agujero (el pasante de 5,5 con su avellanado de 11,2 x 90), r18 (los dos R18 de abajo)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

NOMBRE_SOLIDO = 'ppp0103'   # el de preguntas en tarea.yaml
DENSIDAD = 2.7e-3           # g/mm3 (2700 kg/m3, rotulo del plano segun lectura.md)

ANCHO, ESP = 95.0, 16.0
BRAZO_IZQ, BRAZO_DER = 14.0, 18.0
BASE = 16.0
EJE_Z = 34.0
R_EXT, R_INT = 18.0, 7.0
D_TOPE, L_TOPE_IZQ = 16.0, 23.0
D_AGUJ, D_AVELL = 5.5, 11.2


def modelo(sin=frozenset()):
    from build123d import Axis, Box, Cone, Cylinder, Location, fillet
    cuerpo = Box(ANCHO, ESP, EJE_Z).move(Location((ANCHO / 2, 0, EJE_Z / 2)))
    hueco_l = ANCHO - BRAZO_IZQ - BRAZO_DER
    hueco = Box(hueco_l, ESP + 2, EJE_Z).move(Location((BRAZO_IZQ + hueco_l / 2, 0, BASE + EJE_Z / 2)))
    u = cuerpo - hueco
    if 'r18' not in sin:
        aristas_y = u.edges().filter_by(Axis.Y)
        ext = [e for e in aristas_y if abs(e.center().Z) < 1e-6
               and (abs(e.center().X) < 1e-6 or abs(e.center().X - ANCHO) < 1e-6)]
        if len(ext) != 2:
            salir_error(f'aristas de los R18: {len(ext)} (se esperaban 2)')
        u = fillet(ext, R_EXT)
    aristas_y = u.edges().filter_by(Axis.Y)
    inte = [e for e in aristas_y if abs(e.center().Z - BASE) < 1e-6
            and (abs(e.center().X - BRAZO_IZQ) < 1e-6 or abs(e.center().X - (ANCHO - BRAZO_DER)) < 1e-6)]
    if len(inte) != 2:
        salir_error(f'aristas de los R7: {len(inte)} (se esperaban 2)')
    u = fillet(inte, R_INT)
    # topes cilindricos con eje X a z=34
    x0_izq = BRAZO_IZQ - L_TOPE_IZQ  # -9
    tope_izq = Cylinder(D_TOPE / 2, L_TOPE_IZQ, rotation=(0, 90, 0)).move(Location((x0_izq + L_TOPE_IZQ / 2, 0, EJE_Z)))
    tope_der = Cylinder(D_TOPE / 2, BRAZO_DER, rotation=(0, 90, 0)).move(Location((ANCHO - BRAZO_DER / 2, 0, EJE_Z)))
    p = u + tope_izq + tope_der
    if 'agujero' not in sin:
        # agujero pasante y avellanado en la cara izquierda (x = -9)
        largo = ANCHO - x0_izq
        aguj = Cylinder(D_AGUJ / 2, largo + 2, rotation=(0, 90, 0)).move(Location((x0_izq + largo / 2, 0, EJE_Z)))
        prof = (D_AVELL - D_AGUJ) / 2  # 90 grados incluidos
        avell = Cone(D_AVELL / 2, D_AGUJ / 2, prof, rotation=(0, 90, 0)).move(Location((x0_izq + prof / 2, 0, EJE_Z)))
        p = p - aguj - avell
    solidos = p.solids()
    if len(solidos) != 1:
        salir_error(f'la pieza salio en {len(solidos)} solidos')
    return solidos[0]


def armar(nombre, sin=frozenset()):
    from build123d import Compound, export_step, export_stl
    out = carpeta_salida()
    s = modelo(frozenset(sin))
    if not s.is_valid:
        salir_error('la pieza no es valida')
    s.label = NOMBRE_SOLIDO
    conjunto = Compound(children=[s])
    export_step(conjunto, os.path.join(out, nombre + '.step'))
    export_stl(conjunto, os.path.join(out, nombre + '.stl'))
    v = s.volume
    bb = s.bounding_box()
    print(f'ok {NOMBRE_SOLIDO} volumen={v:.1f} mm3 masa={v * DENSIDAD:.3f} g bbox=({bb.min.X:.2f},{bb.min.Y:.2f},'
          f'{bb.min.Z:.2f})..({bb.max.X:.2f},{bb.max.Y:.2f},{bb.max.Z:.2f})')
