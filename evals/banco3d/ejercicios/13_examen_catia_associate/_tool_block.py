"""Comun del ejercicio 13: el Tool Block del examen de muestra «CATIA V5 Associate - Part Design (PDG) Sample Exam»
(Dassault Systemes, V2-2015/03/30; copia de SlideShare, laminas en la nube, ruta y sha256 en tarea.yaml). Es UNA pieza
parametrica en cuatro estados, uno por pregunta:
  q3 (lamina 05): el perfil de la lamina 04 extruido C, con el agujero pasante de 14.          A=81 B=57 C=43
  q4 (lamina 06): la misma pieza con otras A, B, C.                                            A=84 B=59 C=45
  q5 (laminas 07-09): se saca material: rebaje de 19 por delante en la orejeta (x < A-52) y en el diente (y < 19),
     ranura de 24 (oreja de atras 12, la de adelante queda de C-36) con fondo R41, agujero pasante de 11.   A=86 B=58 C=44
  q6 (laminas 10-11): vaciado desde la cara de adelante del bloque derecho con paredes de 1 («1 TYP»), pared de atras
     de 12 (seccion U-U) y pared de 1 alrededor de la ranura (R41 -> R42 y delante de la ranura).  Cotas de la q5.
Ejes: x a lo largo de A (borde izquierdo en x=0), y a lo largo de B (base del diente en y=0), z a lo largo de C (cara de
atras en z=0, cara de adelante en z=C: la del rebaje de 19). Todas las cotas son de las laminas; lo que el plano dibuja
sin acotar (centro del R19, del R29 y del R41, las tangencias del R5) se dedujo del dibujo y esta en notas de tarea.yaml.

Uso desde bien.py / mal_*.py:
  armar(nombre, cambios)  ->  <carpeta>/<nombre>.step (las cuatro piezas como solidos con nombre q3, q4, q5, q6, una al
  lado de la otra en x), <nombre>.stl, y un STEP por pregunta (<nombre>__q3.step ...: el banco no los juzga, son para
  abrirlos). cambios = {'q3': {'agujero_14'}} arma esa pregunta SIN ese paso (para los mutantes).
Pasos que se pueden sacar: agujero_14, corte_r41, paredes_ranura."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

PREGUNTAS = {
    'q3': {'paso': 3, 'A': 81.0, 'B': 57.0, 'C': 43.0},   # lamina 05
    'q4': {'paso': 4, 'A': 84.0, 'B': 59.0, 'C': 45.0},   # lamina 06
    'q5': {'paso': 5, 'A': 86.0, 'B': 58.0, 'C': 44.0},   # lamina 09
    'q6': {'paso': 6, 'A': 86.0, 'B': 58.0, 'C': 44.0},   # lamina 11: «unshown dimensions are the same as in #5»
}
SEPARACION = 150.0     # mm entre una pieza y la siguiente en el STEP (en x), para que no se toquen

# Lamina 04 (perfil)
ORE_X_AGUJERO, ORE_Y_BAJO, ORE_ALTO, ORE_CHAFLAN = 14.0, 19.0, 32.0, 7.0    # cotas 14, 19, 32, 7 x 45
ORE_Y_AGUJERO = ORE_Y_BAJO + 14.0                                              # cota 14 desde abajo de la orejeta
D_AGUJERO_14 = 14.0
ANGULO_10 = 10.0                 # la recta de 10 grados arranca en x=14 (cota 14 de arriba) y es tangente al R19
R19, R29, R5 = 19.0, 29.0, 5.0
COTA_29 = 29.0                   # arriba: el plano superior arranca a 29 del borde derecho; abajo: la diagonal tambien
CHAFLAN_DER = 5.0                # 5 x 45 arriba a la derecha
COTA_24 = 24.0                   # el borde derecho vertical baja hasta 24 debajo de arriba; despues va la diagonal
Y_CENTRO_R29 = 19.0              # cota 19 de la derecha: altura del centro del R29 (el centro esta sobre la diagonal)
# Lamina 07 (pregunta 5)
REBAJE = 19.0                    # cota 19 de la planta y de la vista lateral
ANCHO_DER = 52.0                 # cota 52: el bloque derecho (sin rebaje) va de x=A-52 a x=A
OREJA_ATRAS, RANURA = 12.0, 24.0  # cotas 12 y 24 de la planta (la oreja de adelante queda de C-36)
R41, COTA_36 = 41.0, 36.0        # seccion M-M: el R41 termina sobre la diagonal a 36 debajo de arriba
D_AGUJERO_11, COTA_14_11 = 11.0, 14.0   # agujero de 11 a 14 del borde derecho y 14 debajo de arriba
# Lamina 10 (pregunta 6)
PARED = 1.0                      # «1 TYP»
PARED_ATRAS = 12.0               # seccion U-U: la pared de atras del vaciado mide 12


def _medio(centro, r, p, q, antihorario):
    """Punto medio del arco de centro y radio dados que va de p a q en el sentido pedido."""
    a1 = math.atan2(p.Y - centro.Y, p.X - centro.X)
    a2 = math.atan2(q.Y - centro.Y, q.X - centro.X)
    if antihorario:
        while a2 <= a1:
            a2 += 2 * math.pi
    else:
        while a2 >= a1:
            a2 -= 2 * math.pi
    am = (a1 + a2) / 2
    return (centro.X + r * math.cos(am), centro.Y + r * math.sin(am))


def puntos(A, B):
    """Puntos y centros del perfil de la lamina 04 para A y B dados."""
    from build123d import Vector
    s, c = math.sin(math.radians(ANGULO_10)), math.cos(math.radians(ANGULO_10))
    p_10 = Vector(ORE_X_AGUJERO, ORE_Y_BAJO + ORE_ALTO)       # arranque de la recta de 10 grados (x=14, y=51)
    p_r19 = Vector(A - COTA_29, B)                            # fin del R19: empieza el plano superior
    d, n = Vector(c, -s), Vector(s, c)                        # direccion de la recta y su normal hacia el centro
    # centro del R19 = p_10 + 19 n + t d, a 19 de p_r19; se toma la raiz chica (la del dibujo: centro a la izquierda)
    w = p_10 + n * R19 - p_r19
    b, cc = w.dot(d), w.dot(w) - R19 ** 2
    t = -b - math.sqrt(b * b - cc)
    c19 = p_10 + n * R19 + d * t
    t1 = p_10 + d * t                                         # tangencia recta de 10 grados - R19
    c29 = Vector(A - COTA_29 + Y_CENTRO_R29 * COTA_29 / (B - COTA_24), Y_CENTRO_R29)   # sobre la diagonal, a 19
    f5 = Vector(c29.X - math.sqrt((R29 + R5) ** 2 - R5 ** 2), ORE_Y_BAJO - R5)        # centro del R5 (tangente a los dos)
    t2 = Vector(f5.X, ORE_Y_BAJO)                             # tangencia R5 - fondo de la orejeta
    t3 = c29 + (f5 - c29) * (R29 / (R29 + R5))                # tangencia R5 - R29
    p_abajo = Vector(c29.X - math.sqrt(R29 ** 2 - Y_CENTRO_R29 ** 2), 0)   # el R29 corta la base
    return {'c19': c19, 't1': t1, 'p_r19': p_r19, 'c29': c29, 'f5': f5, 't2': t2, 't3': t3, 'p_abajo': p_abajo}


def perfil(A, B):
    """Cara del perfil de la lamina 04 en el plano XY."""
    from build123d import BuildLine, BuildSketch, Polyline, ThreePointArc, make_face
    k = puntos(A, B)
    ch, y0, y1 = ORE_CHAFLAN, ORE_Y_BAJO, ORE_Y_BAJO + ORE_ALTO
    with BuildSketch() as sk:
        with BuildLine():
            Polyline((0, y0 + ch), (0, y1 - ch), (ch, y1), (ORE_X_AGUJERO, y1), k['t1'])
            ThreePointArc(k['t1'], _medio(k['c19'], R19, k['t1'], k['p_r19'], True), k['p_r19'])
            Polyline(k['p_r19'], (A - CHAFLAN_DER, B), (A, B - CHAFLAN_DER), (A, B - COTA_24), (A - COTA_29, 0),
                     k['p_abajo'])
            ThreePointArc(k['p_abajo'], _medio(k['c29'], R29, k['p_abajo'], k['t3'], False), k['t3'])
            ThreePointArc(k['t3'], _medio(k['f5'], R5, k['t3'], k['t2'], True), k['t2'])
            Polyline(k['t2'], (ch, y0), (0, y0 + ch))
        make_face()
    return sk.sketch.faces()[0]


def centro_r41(A, B):
    """Centro del R41: sobre la vertical del borde derecho (x=A) y a 41 del punto de la diagonal que esta 36 debajo de
    arriba (seccion M-M)."""
    from build123d import Vector
    y_fin = B - COTA_36
    x_fin = A - COTA_29 + y_fin * COTA_29 / (B - COTA_24)
    return Vector(A, y_fin + math.sqrt(R41 ** 2 - (A - x_fin) ** 2))


def pieza(paso, A, B, C, sin=frozenset()):
    """La pieza de la pregunta `paso` (3 a 6). `sin` = pasos que NO se hacen (mutantes)."""
    from build123d import Align, Box, Cylinder, Kind, Location, Rectangle, extrude, offset
    pie = (Align.CENTER, Align.CENTER, Align.MIN)
    cara = perfil(A, B)
    p = extrude(cara, C)
    if 'agujero_14' not in sin:
        p = p - Cylinder(D_AGUJERO_14 / 2, C + 2, align=pie).moved(Location((ORE_X_AGUJERO, ORE_Y_AGUJERO, -1)))
    if paso >= 5:
        z_reb = C - REBAJE
        orejeta = Box(A - ANCHO_DER + 10, B + 20, REBAJE + 1, align=(Align.MAX, Align.MIN, Align.MIN))
        diente = Box(A + 20, ORE_Y_BAJO + 10, REBAJE + 1, align=(Align.MIN, Align.MAX, Align.MIN))
        p = p - orejeta.moved(Location((A - ANCHO_DER, -10, z_reb))) - diente.moved(Location((-10, ORE_Y_BAJO, z_reb)))
        c41 = centro_r41(A, B)
        if 'corte_r41' not in sin:
            p = p - Cylinder(R41, RANURA, align=pie).moved(Location((c41.X, c41.Y, OREJA_ATRAS)))
        p = p - Cylinder(D_AGUJERO_11 / 2, C + 2, align=pie).moved(Location((A - COTA_14_11, B - COTA_14_11, -1)))
    if paso >= 6:
        caja = Rectangle(ANCHO_DER + 10, B + 10, align=(Align.MIN, Align.MIN)).moved(Location((A - ANCHO_DER, ORE_Y_BAJO)))
        bloque = (cara & caja).faces()
        if len(bloque) != 1:
            salir_error(f'el bloque derecho del perfil salio en {len(bloque)} caras')
        hueco = offset(bloque[0], -PARED, kind=Kind.INTERSECTION)
        vacio = extrude(hueco, C - PARED_ATRAS + 1).moved(Location((0, 0, PARED_ATRAS)))
        if 'paredes_ranura' not in sin:
            vacio = vacio - Cylinder(R41 + PARED, OREJA_ATRAS + RANURA + PARED + 1, align=pie).moved(
                Location((c41.X, c41.Y, -1)))
        p = p - vacio
    solidos = p.solids()
    if len(solidos) != 1:
        salir_error(f'la pieza del paso {paso} salio en {len(solidos)} solidos')
    return solidos[0]


def armar(nombre, cambios=None):
    """Arma las cuatro preguntas (con los cambios de un mutante, si hay) y exporta el STEP con nombres, el STL y un
    STEP por pregunta."""
    from build123d import Compound, Location, export_step, export_stl
    out = carpeta_salida()
    cambios = cambios or {}
    hijos, vol = [], {}
    for i, (q, d) in enumerate(PREGUNTAS.items()):
        s = pieza(d['paso'], d['A'], d['B'], d['C'], frozenset(cambios.get(q, ())))
        if not s.is_valid:
            salir_error(f'la pieza {q} no es valida')
        s = s.moved(Location((i * SEPARACION, 0, 0)))
        s.label = q
        vol[q] = round(s.volume, 3)
        export_step(s, os.path.join(out, f'{nombre}__{q}.step'))
        hijos.append(s)
    conjunto = Compound(children=hijos)
    export_step(conjunto, os.path.join(out, nombre + '.step'))
    export_stl(conjunto, os.path.join(out, nombre + '.stl'))
    print('ok volumenes mm3', vol)
