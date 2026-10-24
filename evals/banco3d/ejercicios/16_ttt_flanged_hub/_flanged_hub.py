"""Comun del ejercicio 16: PPP01-07 Flanged Hub de Too Tall Toby (guia de build123d, tttt.html#ttt-ppp0107; plano en
la nube, ruta y sha256 en tarea.yaml). Es el pieza.py de la practica del 23/10/2026 (practica/ttt/03_flanged_hub/,
sha256 en tarea.yaml) con la misma geometria, paso por paso; lo unico que cambia es la salida (el contrato del banco:
<carpeta>/<nombre>.step con UN solido con nombre ppp0107, y <nombre>.stl) y que se puede saltear o agregar un paso
(mutantes). Es una lectura propia del plano, no el codigo de referencia de la pagina.
Ejes: Z = eje del cubo, cara de abajo de la brida en z=0. Un nervio sobre +X (seccion A-A).

Uso desde bien.py / mal_*.py:
  armar(nombre, sin, con)  ->  <carpeta>/<nombre>.step y .stl; sin = pasos que NO se hacen; con = pasos de mas.
Paso que se puede sacar: agujero_20 (el pasante de 20 del cubo).
Paso que se puede agregar: r3_canto_abajo (un R3 convexo en el canto de abajo de la brida de 130, que el plano no
tiene: lectura.md lo da con canto vivo)."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

NOMBRE_SOLIDO = 'ppp0107'   # el de preguntas en tarea.yaml
DENSIDAD = 2.7e-3           # g/mm3 (2700 kg/m3, rotulo del plano segun lectura.md)

R_BRIDA, E_BRIDA = 65.0, 8.0
R_ESC, Z_ESC = 42.0, 25.0
R_CUBO, Z_CUBO = 17.5, 52.0
R_AGUJ = 10.0
R_REB, Z_REB = 36.5, 18.0
R_FIL = 3.0
R_BC = 107.95 / 2
D_PAS, D_CAJA, PROF_CAJA = 6.0, 13.0, 4.0
NERV_R0 = R_ESC - 8.0  # radio donde arranca el nervio sobre z=25
NERV_FILO, NERV_ANG = 3.0, 20.0  # ancho en el filo y angulo incluido


def cil(r, z0, z1):
    from build123d import Cylinder, Location
    return Cylinder(r, z1 - z0).move(Location((0, 0, (z0 + z1) / 2)))


def arista_circular(pieza, r, z, tol=1e-3):
    from build123d import GeomType
    sel = []
    for e in pieza.edges():
        if e.geom_type != GeomType.CIRCLE:
            continue
        bb = e.bounding_box()
        if abs(bb.max.X - r) < tol and abs(bb.min.Z - z) < tol and abs(bb.max.Z - z) < tol:
            sel.append(e)
    return sel


def nervio(angulo_deg):
    from build123d import Box, Location, Plane, Polygon, Rot, Vector, extrude
    # recta del filo: de (NERV_R0, Z_ESC) a (R_CUBO, Z_ESC + (NERV_R0 - R_CUBO)) a 45 grados
    a = Vector(NERV_R0, 0, Z_ESC)
    b = Vector(R_CUBO, 0, Z_ESC + (NERV_R0 - R_CUBO))
    medio = (a + b) * 0.5
    u = (b - a).normalized()
    pl = Plane(origin=medio, x_dir=(0, 1, 0), z_dir=u)  # y local = hacia adentro del triangulo
    T = 20.0
    k = math.tan(math.radians(NERV_ANG / 2))
    w = NERV_FILO / 2
    trap = Polygon((-w, 0), (w, 0), (w + T * k, T), (-w - T * k, T), align=None)
    prisma = extrude(pl * trap, 20.0, both=True)
    caja = Box(30, 20, 30).move(Location((10 + 15, 0, 22 + 15)))  # x 10..40, z 22..52
    n = prisma & caja
    return Rot(0, 0, angulo_deg) * n


def modelo(log, sin=frozenset(), con=frozenset()):
    from build123d import Cylinder, Location, fillet
    p = cil(R_BRIDA, 0, E_BRIDA) + cil(R_ESC, 0, Z_ESC) + cil(R_CUBO, 0, Z_CUBO)
    p = p - cil(R_REB, -1, Z_REB)
    log("revolucion sin fillets", p)
    filetes = [("pie del cubo (concavo)", R_CUBO, Z_ESC),
               ("canto 84 (convexo)", R_ESC, Z_ESC),
               ("pie del escalon (concavo)", R_ESC, E_BRIDA),
               ("canto brida 130 (convexo)", R_BRIDA, E_BRIDA),
               ("techo del rebaje (concavo)", R_REB, Z_REB)]
    if 'r3_canto_abajo' in con:
        filetes.append(("canto de abajo de la brida 130 (convexo, DE MAS)", R_BRIDA, 0.0))
    for nombre, r, z in filetes:
        e = arista_circular(p, r, z)
        if len(e) != 1:
            salir_error(f'fillet R3 {nombre}: {len(e)} aristas (se esperaba 1)')
        p = fillet(e, R_FIL)
        log(f"fillet R3 {nombre}", p)
    for ang in (0, 120, 240):
        p = p + nervio(ang)
    log("3 nervios", p)
    for i in range(6):
        ang = math.radians(60 * i)
        x, y = R_BC * math.cos(ang), R_BC * math.sin(ang)
        p = p - Cylinder(D_PAS / 2, 20).move(Location((x, y, 0)))
        p = p - Cylinder(D_CAJA / 2, PROF_CAJA + 1).move(Location((x, y, E_BRIDA - PROF_CAJA + (PROF_CAJA + 1) / 2)))
    log("6 agujeros con caja", p)
    if 'agujero_20' not in sin:
        p = p - cil(R_AGUJ, -1, Z_CUBO + 1)
        log("agujero 20", p)
    solidos = p.solids()
    if len(solidos) != 1:
        salir_error(f'la pieza salio en {len(solidos)} solidos')
    return solidos[0]


def armar(nombre, sin=frozenset(), con=frozenset()):
    from build123d import Compound, export_step, export_stl
    out = carpeta_salida()
    prev = [None]

    def log(paso, s):
        v = s.volume
        d = "" if prev[0] is None else f" ({v - prev[0]:+.1f})"
        print(f"  {paso}: vol={v:.1f}{d}")
        prev[0] = v

    s = modelo(log, frozenset(sin), frozenset(con))
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
