# -*- coding: utf-8 -*-
"""
patronlib — utilidades para patrones de corte 2D (DXF + PLT/HPGL).

Metodo probado en produccion. Las funciones de aca son las que sostienen la
"verificacion ritual": todo cambio se demuestra con numeros antes de entregarse.

Interprete: C:\\Dev\\BarackMercosul\\.venv-cad\\Scripts\\python.exe  (ezdxf + matplotlib)

Convencion del DXF de salida:
    R2018, $INSUNITS=4 (mm), $MEASUREMENT=1
    capa CORTE  (color 7): UNA LWPOLYLINE cerrada = contorno de corte
    capa MARCAS (color 1): LINEs sueltas
        - cruz X  = 2 LINEs de 6.0 mm a +-45 grados, cruzadas en el centro = 1 punto de anclaje
        - piquete = 1 LINE de 5.0 mm perpendicular al borde, hacia adentro
"""
from __future__ import annotations
import math
import os

TOL_BRAZO = 0.15      # tolerancia para reconocer un brazo de cruz (6.0 mm) o un piquete (5.0 mm)
LARGO_BRAZO = 6.0
LARGO_PIQUETE = 5.0
PLU_POR_MM = 40       # unidades de plotter por milimetro (HPGL)

# rango sano de distancia punto->filo observado en produccion. Fuera de esto,
# lo mas probable es que se haya interpretado mal una direccion.
FILO_MIN_SANO = 5.0
FILO_MAX_SANO = 17.0
FILO_PELIGRO = 3.0


# ------------------------------------------------------------------ geometria basica
def dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def seg_dist(q, a, b) -> float:
    """Distancia de un punto al SEGMENTO a-b (no al vertice: medir contra vertices
    da falsos 'fuera del contorno')."""
    ax, ay = a; bx, by = b; qx, qy = q
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return dist(q, a)
    t = max(0.0, min(1.0, ((qx - ax) * dx + (qy - ay) * dy) / L2))
    return math.hypot(qx - (ax + t * dx), qy - (ay + t * dy))


def dist_contorno(q, C) -> float:
    """Distancia real del punto q al filo de corte."""
    return min(seg_dist(q, C[i], C[(i + 1) % len(C)]) for i in range(len(C)))


def dentro(q, C) -> bool:
    """Point-in-polygon por ray casting."""
    x, y = q; ins = False; n = len(C)
    for i in range(n):
        x1, y1 = C[i]; x2, y2 = C[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                ins = not ins
    return ins


def bbox(P):
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    return min(xs), min(ys), max(xs), max(ys)


def desviacion_max(A, B) -> float:
    """Maxima distancia de cada punto de A al contorno B. Sirve para demostrar
    que un contorno NO se movio: tiene que dar 0.000000."""
    return max(dist_contorno(p, B) for p in A)


def rayos(C):
    """Devuelve lr(y) -> (x_izq, x_der): interseccion horizontal del contorno a la
    altura y. Necesario porque en una pieza curva el 'borde' depende de la altura;
    la caja envolvente miente."""
    def lr(y):
        xs = []
        n = len(C)
        for i in range(n):
            x1, y1 = C[i]; x2, y2 = C[(i + 1) % n]
            if (y1 > y) != (y2 > y):
                xs.append((x2 - x1) * (y - y1) / (y2 - y1) + x1)
        return (min(xs), max(xs)) if xs else (float('nan'), float('nan'))
    return lr


def linea_de_apoyo(C):
    """POSICION 0 DE LA PIEZA. La pieza apoyada sobre una mesa toca en 2 puntos:
    los del envolvente convexo INFERIOR. La recta entre esos dos puntos es el datum
    desde el que se miden y se mueven los puntos.

    OJO: NO ajustar una recta por minimos cuadrados al borde inferior. El borde
    inferior de estas piezas es curvo, y el ajuste devuelve la curvatura, no el giro.

    Devuelve {'a','b','angulo','span','pct'} del tramo de apoyo dominante
    (el de mayor span en X del envolvente inferior).
    """
    if not C or len(C) < 3:
        raise ValueError(f"linea_de_apoyo: el contorno tiene {len(C or [])} puntos, "
                         f"hacen falta al menos 3. Contorno degenerado o mal leido.")
    P = sorted(set((round(p[0], 6), round(p[1], 6)) for p in C))
    if len(P) < 2 or max(p[0] for p in P) - min(p[0] for p in P) < 1e-9:
        raise ValueError("linea_de_apoyo: el contorno colapsa a un punto o a una vertical; "
                         "no hay recta de apoyo que medir.")

    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])

    h = []
    for p in P:
        while len(h) >= 2 and cross(h[-2], h[-1], p) <= 0:
            h.pop()
        h.append(p)

    W = max(p[0] for p in C) - min(p[0] for p in C)
    mejor = max(((h[i+1][0]-h[i][0], h[i], h[i+1]) for i in range(len(h)-1)),
                key=lambda t: t[0])
    span, a, b = mejor
    return {'a': a, 'b': b, 'span': span, 'pct': 100.0*span/W,
            'angulo': math.degrees(math.atan2(b[1]-a[1], b[0]-a[0]))}


# umbral: por debajo de esto, la inclinacion mete menos de ~0.01 mm en un
# movimiento tipico de 5 mm, o sea es irrelevante frente a la mesa de corte.
APLOMO_OK = 0.10          # grados
APLOMO_REHACER = 0.60     # grados: por encima, hay que trabajar en el marco de la pieza


def gate_aplomo(C, mov_tipico=5.0):
    """GATE OBLIGATORIO antes de mover cualquier punto.

    Si el patron esta chueco en el archivo, un movimiento "1 mm para abajo" en
    coordenadas del archivo NO es 1 mm para abajo respecto de la pieza: se va en
    diagonal. Hay que resolverlo ANTES, no despues.

    Devuelve dict con veredicto y el error que introduce la inclinacion.
    """
    L = linea_de_apoyo(C)
    ang = L['angulo']
    err = abs(math.sin(math.radians(ang))) * mov_tipico
    if abs(ang) < APLOMO_OK:
        v = 'OK'
    elif abs(ang) < APLOMO_REHACER:
        v = 'TOLERABLE'          # documentar el numero y seguir
    else:
        v = 'CHUECO'             # rotar los deltas al marco de la pieza (o enderezar)
    return {**L, 'error_mm': err, 'veredicto': v, 'mov_tipico': mov_tipico}


def a_marco_pieza(dx, dy, angulo):
    """Convierte un delta expresado en el marco de la PIEZA APOYADA (posicion 0)
    al marco del ARCHIVO, cuando el patron esta girado `angulo` grados.
    Usar cuando gate_aplomo devuelve CHUECO y no se quiere rotar el patron."""
    a = math.radians(angulo)
    ca, sa = math.cos(a), math.sin(a)
    return (dx*ca - dy*sa, dx*sa + dy*ca)


def punta_fina(C, ventana=25.0) -> str:
    """Ancla anatomica: de que lado esta el extremo que se afina.
    Devuelve 'DERECHA' o 'IZQUIERDA'. Usar SIEMPRE esto en vez de razonar con
    izquierda/derecha a secas."""
    x0, _, x1, _ = bbox(C)
    izq = [p[1] for p in C if p[0] < x0 + ventana]
    der = [p[1] for p in C if p[0] > x1 - ventana]
    alto_i = max(izq) - min(izq)
    alto_d = max(der) - min(der)
    return 'DERECHA' if alto_d < alto_i else 'IZQUIERDA'


# ------------------------------------------------------------------ lectura
class ContornoAbierto(Exception):
    """El contorno de CORTE no cierra. Casi siempre el pedazo que falta esta dibujado en
    otra capa. Generar el PLT asi corta material de menos."""


def leer(path):
    """Lee un DXF ya normalizado del proyecto.

    Devuelve (doc, C, cruces, piquetes):
        C        : lista de (x,y) del contorno de corte (capa CORTE, la mas larga)
        cruces   : lista ordenada por Y ascendente -> [0]=BAJA, [1]=ALTA.
                   cada una: {'c': centro, 'arms': [(entidad, a, b), ...]}
        piquetes : [(entidad, a, b), ...]
    El `doc` viene vivo: editar las entidades y hacer doc.saveas(...) conserva
    intacto TODO lo demas del archivo.
    """
    import ezdxf
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    mejor = None
    for e in msp.query('LWPOLYLINE'):
        if e.dxf.layer.upper() != 'CORTE':
            continue
        pts = [(p[0], p[1]) for p in e.get_points('xy')]
        per = sum(dist(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts)))
        if mejor is None or per > mejor[0]:
            mejor = (per, pts)
    if mejor is None:
        raise ValueError(f"{path}: no hay LWPOLYLINE en capa CORTE")
    C = mejor[1]

    # GATE: el contorno TIENE que cerrar, y no puede haber geometria de corte tirada en
    # otras capas. El 30/07/2026 un patron tenia el contorno ABIERTO 81,9 mm y el pedazo
    # que faltaba dibujado en la capa 0 (1 LINE + 3 ARCs). leer() lo ignoraba, escribir_plt()
    # cerraba el hueco con una recta, y el PLT cortaba 4,5 cm2 de menos sin que nada avisara.
    gap = dist(C[0], C[-1])
    cerrado = bool(getattr(mejor[2], 'closed', False)) if len(mejor) > 2 else False

    # el detector fuerte no es el hueco en si (un cierre corto es normal), sino que haya
    # geometria de corte en OTRA capa cuyos extremos peguen justo en los extremos del contorno
    sueltas = [e for e in msp
               if e.dxf.layer.upper() not in ('CORTE', 'MARCAS')
               and e.dxftype() in ('LINE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'SPLINE')]
    pega = 0
    if sueltas:
        import ezdxf.path as _ezp
        for e in sueltas:
            try:
                pts = [(v.x, v.y) for v in _ezp.make_path(e).flattening(0.5)]
            except Exception:
                continue
            for q in (pts[0], pts[-1]):
                if min(dist(q, C[0]), dist(q, C[-1])) < 0.05:
                    pega += 1
    if pega >= 2 or (gap > 0.5 and not cerrado and sueltas):
        raise ContornoAbierto(
            f"{os.path.basename(path)}: el contorno de CORTE esta ABIERTO {gap:.3f} mm y hay "
            f"{len(sueltas)} entidades de geometria en otras capas "
            f"({sorted({e.dxf.layer for e in sueltas})}), de las cuales {pega} extremos pegan "
            f"EXACTO con los extremos del contorno.\n"
            f"  Ese pedazo ES parte del contorno. NO generar el PLT asi: lo cerraria con una "
            f"recta y cortaria material de menos.\n"
            f"  Incorporarlo al contorno (aplanar con ezdxf.path y encadenar por extremos) "
            f"antes de seguir.")

    brazos, piquetes = [], []
    for e in msp.query('LINE'):
        a = (e.dxf.start.x, e.dxf.start.y); b = (e.dxf.end.x, e.dxf.end.y)
        L = dist(a, b)
        if abs(L - LARGO_BRAZO) < TOL_BRAZO:
            brazos.append((e, a, b))
        elif abs(L - LARGO_PIQUETE) < TOL_BRAZO:
            piquetes.append((e, a, b))

    cruces = []
    for e, a, b in brazos:
        c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        for cc in cruces:
            if dist(cc['c'], c) < 1.0:
                cc['arms'].append((e, a, b)); break
        else:
            cruces.append({'c': c, 'arms': [(e, a, b)]})
    cruces.sort(key=lambda z: z['c'][1])
    return doc, C, cruces, piquetes


# ------------------------------------------------------------------ mover un punto
def mover_cruz(cruz, dx, dy):
    """Traslada los DOS brazos existentes de la cruz. NUNCA reconstruir la cruz
    desde el centro nuevo: trasladando los brazos, el largo de 6.000 se conserva
    exacto por construccion."""
    for e, a, b in cruz['arms']:
        e.dxf.start = (a[0] + dx, a[1] + dy, 0)
        e.dxf.end = (b[0] + dx, b[1] + dy, 0)


def tabla_4_combinaciones(cruz, C, dx, dy):
    """El sanity check que evita el error caro de marco de referencia.

    Devuelve las 4 combinaciones de signo con la distancia al filo resultante.
    Si la combinacion elegida deja el punto a menos de FILO_PELIGRO del filo,
    casi seguro se leyo mal una direccion: FRENAR y mostrarle esto al usuario.
    """
    c = cruz['c']
    out = []
    for hs, hn in ((+dx, "+X (derecha del archivo)"), (-dx, "-X (izquierda del archivo)")):
        for vs, vn in (((-dy, "abajo"), (+dy, "arriba")) if dy else ((0.0, "sin Y"),)):
            p = (c[0] + hs, c[1] + vs)
            d = dist_contorno(p, C)
            out.append({'dx': hs, 'dy': vs, 'dir': f"{hn} {vn}", 'p': p,
                        'filo': d, 'dentro': dentro(p, C),
                        'peligro': d < FILO_PELIGRO,
                        'sano': FILO_MIN_SANO <= d <= FILO_MAX_SANO})
    return out


# ------------------------------------------------------------------ escritura PLT
def escribir_plt(path, C, marcas, cortes_previos=None, origen=None):
    """HPGL. SP1 = todo lo que corta, SP2 = marcas.

    cortes_previos: lista de contornos cerrados (agujeros) que se cortan ANTES del
    contorno exterior. El orden importa: mientras la pieza sigue unida al resto del
    material no se mueve, asi que el agujero sale en posicion. Si se cortan despues,
    la pieza ya esta suelta y el agujero se va.

    origen: (min_x, min_y) a restar. **OBLIGATORIO cuando se parte el trabajo en varios
    PLT** (por ejemplo agujeros en un archivo y contorno en otro): si cada archivo se
    traslada a su propio minimo, quedan con origenes distintos y al cortarlos uno tras
    otro los agujeros salen corridos respecto del contorno.

    Traslada TODO junto (contorno + agujeros + marcas) al origen usando el minimo comun:
    si se trasladan por separado, se desalinean.
    Devuelve (min_x, min_y) aplicados.
    """
    cortes_previos = cortes_previos or []
    allp = list(C) + [p for m in marcas for p in m] + [p for a in cortes_previos for p in a]
    if origen is not None:
        mx, my = origen
    else:
        mx = min(p[0] for p in allp); my = min(p[1] for p in allp)

    def plu(p):
        return f"{round((p[0]-mx)*PLU_POR_MM)},{round((p[1]-my)*PLU_POR_MM)}"

    o = ["IN;", "SP1;"]
    for a in cortes_previos:                     # agujeros primero
        o.append(f"PU{plu(a[0])};")
        o.append("PD" + ",".join(plu(p) for p in a[1:]) + ";")
        o.append("PU;")
    o += [f"PU{plu(C[0])};",
          "PD" + ",".join(plu(p) for p in list(C[1:]) + [C[0]]) + ";", "PU;", "SP2;"]
    for a, b in marcas:
        o.append(f"PU{plu(a)};PD{plu(b)};PU;")
    o.append("PU;SP0;")
    with open(path, "w", newline="") as f:      # newline="" + \r\n = CRLF real
        f.write("\r\n".join(o) + "\r\n")
    return mx, my


# ------------------------------------------------------------------ rotacion
def rotar90(pts, horario=False):
    """Gira 90 grados. Antihorario: (x,y) -> (-y, x). Horario: (x,y) -> (y, -x).
    NO deforma: verificar despues que las distancias cruz->contorno den identicas."""
    if horario:
        return [(p[1], -p[0]) for p in pts]
    return [(-p[1], p[0]) for p in pts]


def trasladar_al_origen(*grupos):
    """Traslada TODOS los grupos con el MISMO minimo comun (si se trasladan por
    separado se desalinean). Devuelve (grupos_trasladados, (mx, my))."""
    todos = [p for g in grupos for p in g]
    mx = min(p[0] for p in todos); my = min(p[1] for p in todos)
    return [[(p[0] - mx, p[1] - my) for p in g] for g in grupos], (mx, my)


# ------------------------------------------------------------------ texto vectorial
# Fuente de un solo trazo, mayusculas, en una grilla de 4 x 7. Se dibuja con los
# MISMOS primitivos que el resto (PU/PD), asi que no depende de que el plotter
# soporte el comando LB de HPGL ni de que tenga fuente cargada.
_FUENTE = {
    ' ': [],
    'A': [[(0, 0), (2, 7), (4, 0)], [(0.85, 3), (3.15, 3)]],
    'B': [[(0, 0), (0, 7), (3, 7), (4, 6), (4, 4.5), (3, 3.5), (0, 3.5)],
          [(3, 3.5), (4, 2.5), (4, 1), (3, 0), (0, 0)]],
    'C': [[(4, 5.5), (3, 7), (1, 7), (0, 5.5), (0, 1.5), (1, 0), (3, 0), (4, 1.5)]],
    'D': [[(0, 0), (0, 7), (2.5, 7), (4, 5.5), (4, 1.5), (2.5, 0), (0, 0)]],
    'E': [[(4, 7), (0, 7), (0, 0), (4, 0)], [(0, 3.5), (3, 3.5)]],
    'F': [[(4, 7), (0, 7), (0, 0)], [(0, 3.5), (3, 3.5)]],
    'G': [[(4, 5.5), (3, 7), (1, 7), (0, 5.5), (0, 1.5), (1, 0), (3, 0), (4, 1.5), (4, 3), (2.2, 3)]],
    'H': [[(0, 7), (0, 0)], [(4, 7), (4, 0)], [(0, 3.5), (4, 3.5)]],
    'I': [[(2, 7), (2, 0)], [(0.8, 7), (3.2, 7)], [(0.8, 0), (3.2, 0)]],
    'J': [[(3.5, 7), (3.5, 1.5), (2.5, 0), (1, 0), (0, 1.5)]],
    'K': [[(0, 7), (0, 0)], [(4, 7), (0, 3.2)], [(1.4, 4.4), (4, 0)]],
    'L': [[(0, 7), (0, 0), (4, 0)]],
    'M': [[(0, 0), (0, 7), (2, 4), (4, 7), (4, 0)]],
    'N': [[(0, 0), (0, 7), (4, 0), (4, 7)]],
    'O': [[(1, 7), (3, 7), (4, 5.5), (4, 1.5), (3, 0), (1, 0), (0, 1.5), (0, 5.5), (1, 7)]],
    'P': [[(0, 0), (0, 7), (3, 7), (4, 6), (4, 4.5), (3, 3.5), (0, 3.5)]],
    'Q': [[(1, 7), (3, 7), (4, 5.5), (4, 1.5), (3, 0), (1, 0), (0, 1.5), (0, 5.5), (1, 7)],
          [(2.5, 1.8), (4.3, -0.3)]],
    'R': [[(0, 0), (0, 7), (3, 7), (4, 6), (4, 4.5), (3, 3.5), (0, 3.5)], [(2, 3.5), (4, 0)]],
    'S': [[(4, 5.8), (3, 7), (1, 7), (0, 5.8), (0, 4.4), (1, 3.5), (3, 3.5),
           (4, 2.5), (4, 1.2), (3, 0), (1, 0), (0, 1.2)]],
    'T': [[(0, 7), (4, 7)], [(2, 7), (2, 0)]],
    'U': [[(0, 7), (0, 1.5), (1, 0), (3, 0), (4, 1.5), (4, 7)]],
    'V': [[(0, 7), (2, 0), (4, 7)]],
    'W': [[(0, 7), (1, 0), (2, 3.5), (3, 0), (4, 7)]],
    'X': [[(0, 7), (4, 0)], [(0, 0), (4, 7)]],
    'Y': [[(0, 7), (2, 3.5), (4, 7)], [(2, 3.5), (2, 0)]],
    'Z': [[(0, 7), (4, 7), (0, 0), (4, 0)]],
    '0': [[(1, 7), (3, 7), (4, 5.5), (4, 1.5), (3, 0), (1, 0), (0, 1.5), (0, 5.5), (1, 7)],
          [(0.6, 1.2), (3.4, 5.8)]],
    '1': [[(1, 5.6), (2, 7), (2, 0)], [(0.8, 0), (3.2, 0)]],
    '2': [[(0, 5.6), (1, 7), (3, 7), (4, 5.8), (4, 4.5), (0, 0), (4, 0)]],
    '3': [[(0, 6), (1, 7), (3, 7), (4, 6), (4, 4.4), (3, 3.5), (1.6, 3.5)],
          [(3, 3.5), (4, 2.6), (4, 1), (3, 0), (1, 0), (0, 1)]],
    '4': [[(3, 0), (3, 7), (0, 2.2), (4, 2.2)]],
    '5': [[(4, 7), (0, 7), (0, 4), (3, 4), (4, 3), (4, 1), (3, 0), (1, 0), (0, 1)]],
    '6': [[(3.6, 6.2), (2.6, 7), (1, 7), (0, 5.6), (0, 1.4), (1, 0), (3, 0),
           (4, 1.2), (4, 2.6), (3, 3.6), (1, 3.6), (0, 2.6)]],
    '7': [[(0, 7), (4, 7), (1.4, 0)]],
    '8': [[(1, 3.5), (0, 4.6), (0, 5.9), (1, 7), (3, 7), (4, 5.9), (4, 4.6), (3, 3.5),
           (1, 3.5), (0, 2.4), (0, 1.1), (1, 0), (3, 0), (4, 1.1), (4, 2.4), (3, 3.5)]],
    '9': [[(0.4, 0.8), (1.4, 0), (3, 0), (4, 1.4), (4, 5.6), (3, 7), (1, 7),
           (0, 5.8), (0, 4.4), (1, 3.4), (3, 3.4), (4, 4.4)]],
    '-': [[(0.5, 3.5), (3.5, 3.5)]],
    '/': [[(0, 0), (4, 7)]],
    '.': [[(1.8, 0), (2.4, 0)]],
    ':': [[(2, 2), (2.5, 2)], [(2, 5), (2.5, 5)]],
}
_AVANCE = 5.4      # ancho de celda en unidades de la grilla (4 de glifo + 1.4 de espacio)


def texto_vectorial(texto, x, y, altura=8.0):
    """Convierte texto a polilineas dibujables. (x,y) = esquina inferior izquierda.
    Devuelve lista de polilineas [(x,y), ...]. Los caracteres que no estan en la
    fuente se saltean (no se inventa un glifo)."""
    k = altura / 7.0
    out = []
    cx = 0.0
    for ch in texto.upper():
        for tramo in _FUENTE.get(ch, []):
            out.append([(x + (cx + px) * k, y + py * k) for px, py in tramo])
        cx += _AVANCE
    return out


def medir_texto(texto, altura=8.0):
    """(ancho, alto) que va a ocupar el texto."""
    k = altura / 7.0
    return (max(0, len(texto) * _AVANCE - (_AVANCE - 4.0)) * k, altura)


def _campo_holgura(C, marcas, x0, y0, x1, y1, paso):
    """Campo de holgura sobre una grilla: para cada celda, distancia al contorno
    (negativa si esta afuera) y distancia a la marca mas cercana.

    Se precalcula UNA vez con numpy en vez de recorrer el contorno por cada candidato:
    la version por fuerza bruta no termina nunca sobre un contorno de 350 vertices.
    """
    import numpy as np
    gx = np.arange(x0, x1 + paso, paso)
    gy = np.arange(y0, y1 + paso, paso)
    GX, GY = np.meshgrid(gx, gy)
    pts = np.stack([GX.ravel(), GY.ravel()], axis=1)

    def dist_a_segmentos(segs):
        best = np.full(len(pts), np.inf)
        for a, b in segs:
            ax, ay = a; bx_, by_ = b
            dx, dy = bx_ - ax, by_ - ay
            L2 = dx * dx + dy * dy
            if L2 == 0:
                d = np.hypot(pts[:, 0] - ax, pts[:, 1] - ay)
            else:
                t = ((pts[:, 0] - ax) * dx + (pts[:, 1] - ay) * dy) / L2
                t = np.clip(t, 0.0, 1.0)
                d = np.hypot(pts[:, 0] - (ax + t * dx), pts[:, 1] - (ay + t * dy))
            np.minimum(best, d, out=best)
        return best

    segs_C = [(C[i], C[(i + 1) % len(C)]) for i in range(len(C))]
    dC = dist_a_segmentos(segs_C)

    # dentro/fuera por ray casting vectorizado
    inside = np.zeros(len(pts), dtype=bool)
    px, py = pts[:, 0], pts[:, 1]
    for i in range(len(C)):
        x1s, y1s = C[i]; x2s, y2s = C[(i + 1) % len(C)]
        cond = (y1s > py) != (y2s > py)
        with np.errstate(divide='ignore', invalid='ignore'):
            xin = (x2s - x1s) * (py - y1s) / (y2s - y1s) + x1s
        inside ^= cond & (px < xin)

    dC = np.where(inside, dC, -1.0)
    dM = dist_a_segmentos(marcas) if marcas else np.full(len(pts), np.inf)
    return gx, gy, dC.reshape(GY.shape), dM.reshape(GY.shape)


def ubicar_texto(lineas, C, marcas, altura=8.0, interlinea=1.6,
                 margen_contorno=8.0, margen_marcas=8.0, paso=3.0):
    """Busca un lugar DENTRO de la pieza para un bloque de texto, que no interfiera
    con el contorno ni con ninguna marca existente.

    Devuelve (x, y) de la esquina inferior izquierda del bloque, o None si no entra.
    Elige el candidato valido mas cercano al centro de la pieza.

    La busqueda es aproximada (grilla); el llamador DEBE verificar despues los trazos
    reales del texto con dentro()/dist_contorno()/seg_dist() exactos.
    """
    import numpy as np
    if not lineas:
        return None
    W = max(medir_texto(t, altura)[0] for t in lineas)
    H = len(lineas) * altura + (len(lineas) - 1) * (altura * interlinea - altura)
    if W <= 0:
        return None

    x0, y0, x1, y1 = bbox(C)
    if x1 - x0 < W or y1 - y0 < H:
        return None
    gx, gy, dC, dM = _campo_holgura(C, marcas, x0, y0, x1, y1, paso)

    okgrid = (dC >= margen_contorno) & (dM >= margen_marcas)
    nx = max(1, int(round(W / paso)))
    ny = max(1, int(round(H / paso)))

    # ventana deslizante: el bloque entra si TODAS las celdas que cubre estan ok.
    # minimo por ventana via reduccion acumulada en los dos ejes.
    v = okgrid.astype(np.int8)
    for k in range(1, nx + 1):
        v[:, :v.shape[1] - k] &= okgrid[:, k:].astype(np.int8)
    for k in range(1, ny + 1):
        v[:v.shape[0] - k, :] &= v[k:, :]

    cxp, cyp = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    idx = np.argwhere(v[:v.shape[0] - ny, :v.shape[1] - nx] == 1)
    if len(idx) == 0:
        return None
    bx = gx[idx[:, 1]]
    by = gy[idx[:, 0]]
    d = np.hypot(bx + W / 2 - cxp, by + H / 2 - cyp)
    j = int(np.argmin(d))
    return (float(bx[j]), float(by[j]))


def bloque_texto(lineas, x, y, altura=8.0, interlinea=1.6):
    """Genera las polilineas de un bloque multilinea. La primera linea va ARRIBA."""
    out = []
    paso = altura * interlinea
    for i, t in enumerate(lineas):
        yy = y + (len(lineas) - 1 - i) * paso
        out.extend(texto_vectorial(t, x, yy, altura))
    return out


class EntregaRechazada(Exception):
    """Los gates no se cumplieron. NO se escribe el entregable."""


def entregar(path_plt, C_nuevo, C_original, cruces_nuevas, piquetes_nuevos,
             piquetes_originales=None, aplomo=None, forzar=False):
    """ENFORCEMENT DURO: escribe el PLT solo si los gates pasan. Si no, levanta
    EntregaRechazada y NO deja archivo.

    Es el equivalente de export_deliverables.py en el skill cad-design: el gate no
    vive en la buena voluntad del que lo usa, vive en el unico camino que produce
    el entregable.

    `forzar=True` solo con decision explicita de Fak, y deja el motivo en el reporte.
    """
    fallas = []

    # GATE 1 — aplomo declarado y resuelto
    if aplomo is None:
        aplomo = gate_aplomo(C_nuevo)
    if aplomo['veredicto'] == 'CHUECO':
        fallas.append(
            f"APLOMO: el patron esta a {aplomo['angulo']:+.4f} grados de la recta de apoyo "
            f"(span {aplomo['pct']:.0f}% del ancho). Los deltas tienen que convertirse con "
            f"a_marco_pieza() o hay que enderezar el patron. Error que mete: "
            f"{aplomo['error_mm']:.4f} mm en un movimiento de {aplomo['mov_tipico']} mm.")

    # GATE 3a — el contorno NO se toco.
    #
    # OJO con la metrica: la distancia punto-a-contorno (Hausdorff, en cualquiera de las
    # dos direcciones) es CIEGA a un vertice que se desliza A LO LARGO de un tramo recto:
    # el vertice sigue cayendo exacto sobre el borde viejo y da 0.000000 en ambos sentidos
    # aunque se haya movido milimetros. Por eso, cuando la cantidad de vertices coincide,
    # el chequeo que manda es VERTICE CONTRA VERTICE.
    if len(C_nuevo) != len(C_original):
        fallas.append(f"CONTORNO: cambio la cantidad de vertices "
                      f"({len(C_original)} -> {len(C_nuevo)}).")
        dev = max(desviacion_max(C_nuevo, C_original), desviacion_max(C_original, C_nuevo))
        if dev > 1e-6:
            fallas.append(f"CONTORNO: se movio {dev:.6f} mm (tiene que dar 0.000000). "
                          f"Mover puntos NO toca el contorno.")
    else:
        dev = max((dist(a, b) for a, b in zip(C_original, C_nuevo)), default=0.0)
        if dev > 1e-6:
            fallas.append(f"CONTORNO: un vertice se movio {dev:.6f} mm "
                          f"(tiene que dar 0.000000). Mover puntos NO toca el contorno.")

    # GATE 3b — las cruces no se deformaron
    for i, cr in enumerate(cruces_nuevas):
        for _, a, b in cr['arms']:
            L = dist(a, b)
            if abs(L - LARGO_BRAZO) > 1e-4:
                fallas.append(f"CRUZ {i}: un brazo mide {L:.4f} mm en vez de {LARGO_BRAZO}. "
                              f"Se reconstruyo la cruz en vez de trasladar los brazos.")
        if len(cr['arms']) != 2:
            fallas.append(f"CRUZ {i}: tiene {len(cr['arms'])} brazos, deberia tener 2.")

    # GATE 2 — un punto pegado al filo. OJO: esto NO diagnostica "direccion mal leida".
    # Puede ser exactamente lo pedido (para que la costura vaya a la izquierda el punto va a
    # la derecha). Se reporta el HECHO MEDIDO y decide el usuario; nunca invertir por cuenta
    # propia. Si el usuario ya lo decidio, pasar forzar=True.
    for i, cr in enumerate(cruces_nuevas):
        d_filo = dist_contorno(cr['c'], C_nuevo)
        if not dentro(cr['c'], C_nuevo):
            fallas.append(f"CRUZ {i} en {cr['c']}: quedo FUERA del contorno.")
        elif d_filo < FILO_PELIGRO:
            fuera = sum(1 for _, a, b in cr['arms'] for p in (a, b)
                        if not dentro(p, C_nuevo))
            fallas.append(
                f"CRUZ {i} en ({cr['c'][0]:.3f},{cr['c'][1]:.3f}): quedo a {d_filo:.3f} mm "
                f"del filo (rango habitual {FILO_MIN_SANO}-{FILO_MAX_SANO}) y {fuera} de sus 4 "
                f"extremos caen fuera del contorno -> la X impresa se corta contra el borde. "
                f"Esto es un HECHO MEDIDO, no un diagnostico: puede ser lo pedido. Mostrarselo "
                f"al usuario y que decida; con su OK, forzar=True.")

    # los piquetes no se tocan al mover un punto.
    # Si el llamador no pasa los originales, el sub-check NO corre — y eso se DECLARA en
    # el retorno (`piquetes_verificados`), para que no parezca verificado algo que no lo esta.
    piquetes_verificados = piquetes_originales is not None
    if piquetes_originales is not None:
        if len(piquetes_nuevos) != len(piquetes_originales):
            fallas.append(f"PIQUETES: cambio la cantidad "
                          f"({len(piquetes_originales)} -> {len(piquetes_nuevos)}).")
        else:
            # los piquetes vienen de leer() como (entidad, a, b)
            mv = max((max(dist(p0[1], p1[1]), dist(p0[2], p1[2]))
                      for p0, p1 in zip(piquetes_originales, piquetes_nuevos)), default=0.0)
            if mv > 1e-6:
                fallas.append(f"PIQUETES: se movieron {mv:.6f} mm (tienen que dar 0.000000).")

    if fallas and not forzar:
        raise EntregaRechazada(
            "NO se escribio el entregable. Gates que fallaron:\n  - " + "\n  - ".join(fallas))

    marcas = [(a, b) for cr in cruces_nuevas for _, a, b in cr['arms']] + \
             [(a, b) for _, a, b in piquetes_nuevos]
    mx, my = escribir_plt(path_plt, C_nuevo, marcas)
    return {'ok': not fallas, 'forzado': bool(fallas and forzar), 'fallas': fallas,
            'aplomo': aplomo, 'desviacion_contorno': dev,
            'piquetes_verificados': piquetes_verificados,
            'traslacion': (mx, my), 'n_marcas': len(marcas)}


def leer_plt(path):
    """Parsea un PLT de vuelta a mm. Para verificar lo que realmente se escribio.
    Devuelve [(pluma, [(x,y), ...]), ...]"""
    txt = open(path).read()
    pluma, actual, out = 0, [], []
    for cmd in txt.replace("\r", "").replace("\n", "").split(";"):
        cmd = cmd.strip()
        if not cmd:
            continue
        if cmd.startswith("SP"):
            if actual: out.append((pluma, actual)); actual = []
            pluma = int(cmd[2:] or 0)
        elif cmd.startswith(("PU", "PD")):
            nums = cmd[2:].split(",")
            if len(nums) >= 2 and nums[0]:
                pts = [(float(nums[i]) / PLU_POR_MM, float(nums[i+1]) / PLU_POR_MM)
                       for i in range(0, len(nums) - 1, 2)]
                if cmd.startswith("PD"):
                    actual.extend(pts)
                else:
                    if actual: out.append((pluma, actual))
                    actual = list(pts)
    if actual: out.append((pluma, actual))
    return out


# ------------------------------------------------------------------ simetria del par
def _centros(X):
    """Acepta indistintamente la estructura `cruces` que devuelve leer()
    ([{'c':(x,y), 'arms':[...]}, ...]) o una lista de (x,y) crudos."""
    out = []
    for c in X:
        out.append(tuple(c['c']) if isinstance(c, dict) else tuple(c))
    return out


def comparar_par(C_der, X_der, C_izq, X_izq):
    """Compara las cruces de la mano izquierda contra las de la derecha, espejando.

    X_der / X_izq: la estructura `cruces` de leer(), o una lista de (x,y). Las dos andan.

    El patron de corte del IZQUIERDO es el espejo del patron de corte del DERECHO
    (el espejo de mano y el espejo de corte se cancelan: UN solo mirror).

    Devuelve dict con:
        espejo_exacto : si los contornos son espejo exacto (desviacion < 0.05 mm)
        residuos      : [(dX, dY), ...] por cruz, en el marco de la DERECHA
        uniforme      : si un corrimiento unico de las 2 cruces corrige el par
    """
    def norm(P):
        x0, y0, _, _ = bbox(P)
        return [(p[0] - x0, p[1] - y0) for p in P]

    A = norm(C_der); B = norm(C_izq)
    WB = bbox(B)[2]
    Bm = [(WB - p[0], p[1]) for p in B]
    x0b, y0b, _, _ = bbox(C_izq)
    Bmn = norm(Bm)
    dev = max(desviacion_max(A, Bmn), desviacion_max(Bmn, A))

    x0a, y0a, _, _ = bbox(C_der)
    XA = sorted([(c[0] - x0a, c[1] - y0a) for c in _centros(X_der)], key=lambda p: p[1])
    XB = sorted([(WB - (c[0] - x0b), c[1] - y0b) for c in _centros(X_izq)], key=lambda p: p[1])
    res = [(XB[i][0] - XA[i][0], XB[i][1] - XA[i][1]) for i in range(min(len(XA), len(XB)))]
    disp = abs(res[0][0] - res[1][0]) if len(res) > 1 else 0.0
    return {'espejo_exacto': dev < 0.05, 'desviacion_contorno': dev,
            'residuos': res, 'dispersion_dX': disp, 'uniforme': disp < 1.5,
            'corrimiento_optimo': sum(r[0] for r in res) / len(res) if res else 0.0}
