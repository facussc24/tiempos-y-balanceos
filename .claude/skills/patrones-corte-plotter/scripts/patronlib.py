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
    P = sorted(set((round(p[0], 6), round(p[1], 6)) for p in C))

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
def escribir_plt(path, C, marcas):
    """HPGL. SP1 = contorno (lo unico que corta), SP2 = marcas.

    Traslada TODO junto (contorno + marcas) al origen usando el minimo comun:
    si se trasladan por separado, las marcas se desalinean.
    Devuelve (min_x, min_y) aplicados.
    """
    allp = list(C) + [p for m in marcas for p in m]
    mx = min(p[0] for p in allp); my = min(p[1] for p in allp)

    def plu(p):
        return f"{round((p[0]-mx)*PLU_POR_MM)},{round((p[1]-my)*PLU_POR_MM)}"

    o = ["IN;", "SP1;", f"PU{plu(C[0])};",
         "PD" + ",".join(plu(p) for p in list(C[1:]) + [C[0]]) + ";", "PU;", "SP2;"]
    for a, b in marcas:
        o.append(f"PU{plu(a)};PD{plu(b)};PU;")
    o.append("PU;SP0;")
    with open(path, "w", newline="") as f:      # newline="" + \r\n = CRLF real
        f.write("\r\n".join(o) + "\r\n")
    return mx, my


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

    # GATE 3a — el contorno NO se toco
    dev = desviacion_max(C_nuevo, C_original)
    if dev > 1e-6:
        fallas.append(f"CONTORNO: se movio {dev:.6f} mm (tiene que dar 0.000000). "
                      f"Mover puntos NO toca el contorno.")
    if len(C_nuevo) != len(C_original):
        fallas.append(f"CONTORNO: cambio la cantidad de vertices "
                      f"({len(C_original)} -> {len(C_nuevo)}).")

    # GATE 3b — las cruces no se deformaron
    for i, cr in enumerate(cruces_nuevas):
        for _, a, b in cr['arms']:
            L = dist(a, b)
            if abs(L - LARGO_BRAZO) > 1e-4:
                fallas.append(f"CRUZ {i}: un brazo mide {L:.4f} mm en vez de {LARGO_BRAZO}. "
                              f"Se reconstruyo la cruz en vez de trasladar los brazos.")
        if len(cr['arms']) != 2:
            fallas.append(f"CRUZ {i}: tiene {len(cr['arms'])} brazos, deberia tener 2.")

    # GATE 2 — ningun punto quedo pegado al filo (sintoma de direccion mal leida)
    for i, cr in enumerate(cruces_nuevas):
        d_filo = dist_contorno(cr['c'], C_nuevo)
        if not dentro(cr['c'], C_nuevo):
            fallas.append(f"CRUZ {i} en {cr['c']}: quedo FUERA del contorno.")
        elif d_filo < FILO_PELIGRO:
            fallas.append(f"CRUZ {i} en {cr['c']}: quedo a {d_filo:.3f} mm del filo "
                          f"(< {FILO_PELIGRO}). Casi seguro se leyo mal una direccion: "
                          f"mostrar tabla_4_combinaciones() y FRENAR.")

    # los piquetes no se tocan al mover un punto
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
def comparar_par(C_der, X_der, C_izq, X_izq):
    """Compara las cruces de la mano izquierda contra las de la derecha, espejando.

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
    XA = sorted([(c[0] - x0a, c[1] - y0a) for c in X_der], key=lambda p: p[1])
    XB = sorted([(WB - (c[0] - x0b), c[1] - y0b) for c in X_izq], key=lambda p: p[1])
    res = [(XB[i][0] - XA[i][0], XB[i][1] - XA[i][1]) for i in range(min(len(XA), len(XB)))]
    disp = abs(res[0][0] - res[1][0]) if len(res) > 1 else 0.0
    return {'espejo_exacto': dev < 0.05, 'desviacion_contorno': dev,
            'residuos': res, 'dispersion_dX': disp, 'uniforme': disp < 1.5,
            'corrimiento_optimo': sum(r[0] for r in res) / len(res) if res else 0.0}
