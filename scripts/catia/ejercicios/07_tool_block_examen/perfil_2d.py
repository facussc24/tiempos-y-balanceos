# -*- coding: utf-8 -*-
"""Geometria 2D del Tool Block del examen de muestra CATIA V5 Associate (ejercicio 13 del banco 3D) en Python puro, para
dibujar los croquis de CATIA en la notebook (alli el Python de CATIA no tiene build123d) y para la cuenta de lo que cada
operacion tiene que sumar o sacar.

Las cotas y los supuestos de lectura del plano son los de evals/banco3d/ejercicios/13_examen_catia_associate/_tool_block.py
y su tarea.yaml (laminas 04 a 11 del examen); aca se repiten las mismas cuentas sin build123d. La prueba sin CATIA
(scripts/catia/tests/test_tool_block_07.py, con .venv-cad) compara puntos, areas y volumenes contra _tool_block.

Un contorno es una lista de tramos: ("L", p, q) recta de p a q, o ("A", centro, radio, p, q, antihorario) arco de p a q.
Los puntos son tuplas (x, y) en mm; los contornos que se devuelven van en sentido antihorario (area positiva)."""
import math

TAU = 2 * math.pi

# Lamina 04 (perfil), los mismos nombres que _tool_block.py
ORE_X_AGUJERO, ORE_Y_BAJO, ORE_ALTO, ORE_CHAFLAN = 14.0, 19.0, 32.0, 7.0
ORE_Y_AGUJERO = ORE_Y_BAJO + 14.0
D_AGUJERO_14 = 14.0
ANGULO_10 = 10.0
R19, R29, R5 = 19.0, 29.0, 5.0
COTA_29 = 29.0
CHAFLAN_DER = 5.0
COTA_24 = 24.0
Y_CENTRO_R29 = 19.0
# Lamina 07 (pregunta 5)
REBAJE = 19.0
ANCHO_DER = 52.0
OREJA_ATRAS, RANURA = 12.0, 24.0
R41, COTA_36 = 41.0, 36.0
D_AGUJERO_11, COTA_14_11 = 11.0, 14.0
# Lamina 10 (pregunta 6)
PARED = 1.0
PARED_ATRAS = 12.0


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(a, k):
    return (a[0] * k, a[1] * k)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def _cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def angulo(c, p):
    return math.atan2(p[1] - c[1], p[0] - c[0])


def barrido(t):
    """Angulo inicial y barrido CON SIGNO de un arco (positivo = antihorario)."""
    _, c, r, p, q, anti = t
    a1, a2 = angulo(c, p), angulo(c, q)
    if anti:
        d = (a2 - a1) % TAU
    else:
        d = -((a1 - a2) % TAU)
    return a1, d


def puntos(A, B):
    """Puntos y centros del perfil de la lamina 04 (la misma cuenta que _tool_block.puntos)."""
    s, c = math.sin(math.radians(ANGULO_10)), math.cos(math.radians(ANGULO_10))
    p_10 = (ORE_X_AGUJERO, ORE_Y_BAJO + ORE_ALTO)
    p_r19 = (A - COTA_29, B)
    d, n = (c, -s), (s, c)
    w = _sub(_add(p_10, _mul(n, R19)), p_r19)
    b, cc = _dot(w, d), _dot(w, w) - R19 ** 2
    t = -b - math.sqrt(b * b - cc)
    c19 = _add(_add(p_10, _mul(n, R19)), _mul(d, t))
    t1 = _add(p_10, _mul(d, t))
    c29 = (A - COTA_29 + Y_CENTRO_R29 * COTA_29 / (B - COTA_24), Y_CENTRO_R29)
    f5 = (c29[0] - math.sqrt((R29 + R5) ** 2 - R5 ** 2), ORE_Y_BAJO - R5)
    t2 = (f5[0], ORE_Y_BAJO)
    t3 = _add(c29, _mul(_sub(f5, c29), R29 / (R29 + R5)))
    p_abajo = (c29[0] - math.sqrt(R29 ** 2 - Y_CENTRO_R29 ** 2), 0.0)
    return {"p_10": p_10, "dir_10": d, "c19": c19, "t1": t1, "p_r19": p_r19, "c29": c29, "f5": f5, "t2": t2, "t3": t3,
            "p_abajo": p_abajo}


def invertir(contorno):
    out = []
    for t in reversed(contorno):
        if t[0] == "L":
            out.append(("L", t[2], t[1]))
        else:
            out.append(("A", t[1], t[2], t[4], t[3], not t[5]))
    return out


def _green(t):
    """1/2 de la integral de (x dy - y dx) sobre el tramo."""
    if t[0] == "L":
        return 0.5 * _cross(t[1], t[2])
    _, c, r, p, q, _anti = t
    a1, d = barrido(t)
    a2 = a1 + d
    return 0.5 * (c[0] * r * (math.sin(a2) - math.sin(a1)) - c[1] * r * (math.cos(a2) - math.cos(a1)) + r * r * d)


def area(tramos):
    return sum(_green(t) for t in tramos)


def antihorario(contorno):
    return contorno if area(contorno) > 0 else invertir(contorno)


def perfil(A, B):
    """Contorno del perfil de la lamina 04 (el mismo recorrido que _tool_block.perfil), devuelto antihorario."""
    k = puntos(A, B)
    ch, y0, y1 = ORE_CHAFLAN, ORE_Y_BAJO, ORE_Y_BAJO + ORE_ALTO
    pts1 = [(0.0, y0 + ch), (0.0, y1 - ch), (ch, y1), (ORE_X_AGUJERO, y1), k["t1"]]
    pts2 = [k["p_r19"], (A - CHAFLAN_DER, B), (A, B - CHAFLAN_DER), (A, B - COTA_24), (A - COTA_29, 0.0), k["p_abajo"]]
    pts3 = [k["t2"], (ch, y0), (0.0, y0 + ch)]
    c = [("L", pts1[i], pts1[i + 1]) for i in range(len(pts1) - 1)]
    c.append(("A", k["c19"], R19, k["t1"], k["p_r19"], True))
    c += [("L", pts2[i], pts2[i + 1]) for i in range(len(pts2) - 1)]
    c.append(("A", k["c29"], R29, k["p_abajo"], k["t3"], False))
    c.append(("A", k["f5"], R5, k["t3"], k["t2"], True))
    c += [("L", pts3[i], pts3[i + 1]) for i in range(len(pts3) - 1)]
    c[-1] = ("L", c[-1][1], c[0][1])            # cierra en el MISMO punto (tupla) del arranque
    return antihorario(c)


def bloque(A, B):
    """El bloque derecho del perfil (x >= A-52, y >= 19), antihorario. Se arma con el recorrido del dibujo y se
    controla que valga para estas A y B (la recta de 10 grados entra al bloque, el arco R19 queda entero adentro)."""
    k = puntos(A, B)
    x0, y0 = A - ANCHO_DER, ORE_Y_BAJO
    if not (ORE_X_AGUJERO < x0 < k["t1"][0]):
        raise ValueError(f"el corte x={x0:g} no cae sobre la recta de 10 grados (t1 en x {k['t1'][0]:.3f})")
    if not (B - COTA_24 > y0):
        raise ValueError("la diagonal no cruza y=19")
    d = k["dir_10"]
    p10 = _add(k["p_10"], _mul(d, (x0 - k["p_10"][0]) / d[0]))     # la recta de 10 grados en x = x0
    p0 = (x0, y0)
    pd = (A - COTA_29 + y0 * COTA_29 / (B - COTA_24), y0)            # la diagonal en y = 19
    pts = [p0, pd, (A, B - COTA_24), (A, B - CHAFLAN_DER), (A - CHAFLAN_DER, B), k["p_r19"]]
    c = [("L", pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    c.append(("A", k["c19"], R19, k["p_r19"], k["t1"], False))
    c.append(("L", k["t1"], p10))
    c.append(("L", p10, p0))
    if area(c) <= 0:
        raise ValueError("el bloque no salio antihorario")
    return c


def _desplazar(t, dist):
    """Tramo corrido `dist` hacia la izquierda de su recorrido (adentro de un contorno antihorario): recta como (punto,
    direccion); arco como (centro, radio nuevo)."""
    if t[0] == "L":
        p, q = t[1], t[2]
        v = _sub(q, p)
        lv = math.hypot(*v)
        u = (v[0] / lv, v[1] / lv)
        n = (-u[1], u[0])
        return ("L", _add(p, _mul(n, dist)), u)
    _, c, r, p, q, anti = t
    return ("C", c, r - dist if anti else r + dist)


def _cortes(a, b, cerca):
    """Interseccion de dos tramos corridos (recta-recta o recta-circulo); de dos raices, la mas cercana a `cerca`.
    Si la recta queda tangente al circulo (como la de 10 grados y el R19), el pie de la perpendicular."""
    if a[0] == "C":
        a, b = b, a
    if a[0] == "C":
        raise ValueError("dos arcos seguidos: no hace falta en esta pieza")
    if b[0] == "L":
        p, u = a[1], a[2]
        q, v = b[1], b[2]
        den = _cross(u, v)
        if abs(den) < 1e-12:
            raise ValueError("dos rectas paralelas seguidas")
        s = _cross(_sub(q, p), v) / den
        return _add(p, _mul(u, s))
    p, u = a[1], a[2]
    c, r = b[1], b[2]
    s0 = _dot(_sub(c, p), u)
    pie = _add(p, _mul(u, s0))
    h = math.dist(pie, c)
    if abs(h - r) < 1e-7:
        return pie
    if h > r:
        raise ValueError("la recta corrida no corta el arco corrido")
    m = math.sqrt(r * r - h * h)
    cand = [_add(pie, _mul(u, m)), _add(pie, _mul(u, -m))]
    return min(cand, key=lambda x: math.dist(x, cerca))


def desplazar_adentro(contorno, dist):
    """Contorno antihorario corrido `dist` hacia adentro con las esquinas vivas (como offset(..., kind=INTERSECTION) de
    build123d). Falla si un tramo desaparece."""
    n = len(contorno)
    off = [_desplazar(t, dist) for t in contorno]
    v = [_cortes(off[i - 1], off[i], contorno[i][1] if contorno[i][0] == "L" else contorno[i][3]) for i in range(n)]
    out = []
    for i, t in enumerate(contorno):
        a, b = v[i], v[(i + 1) % n]
        if t[0] == "L":
            if _dot(_sub(b, a), _sub(t[2], t[1])) <= 0:
                raise ValueError(f"el tramo {i} desaparece al correrlo {dist:g}")
            out.append(("L", a, b))
        else:
            out.append(("A", t[1], off[i][2], a, b, t[5]))
    return out


def punto_en(t, f):
    """Punto a la fraccion f del tramo."""
    if t[0] == "L":
        return _add(t[1], _mul(_sub(t[2], t[1]), f))
    a1, d = barrido(t)
    a = a1 + d * f
    return (t[1][0] + t[2] * math.cos(a), t[1][1] + t[2] * math.sin(a))


def _fracciones_corte(t, c0, R):
    """Fracciones (0..1, sin los extremos) donde el tramo cruza el circulo (c0, R)."""
    eps = 1e-9
    if t[0] == "L":
        p, q = t[1], t[2]
        dlt = _sub(q, p)
        f = _sub(p, c0)
        a, b, cc = _dot(dlt, dlt), 2 * _dot(f, dlt), _dot(f, f) - R * R
        disc = b * b - 4 * a * cc
        if disc <= 0:
            return []
        rq = math.sqrt(disc)
        return sorted(x for x in ((-b - rq) / (2 * a), (-b + rq) / (2 * a)) if eps < x < 1 - eps)
    _, c, r, p, q, _anti = t
    dd = math.dist(c, c0)
    if dd < 1e-12 or dd > r + R or dd < abs(r - R):
        return []
    a = (r * r - R * R + dd * dd) / (2 * dd)
    h = math.sqrt(max(r * r - a * a, 0.0))
    base = _add(c, _mul(_sub(c0, c), a / dd))
    perp = ((c0[1] - c[1]) / dd, -(c0[0] - c[0]) / dd)
    a1, d = barrido(t)
    out = []
    for s in ((1, -1) if h > 0 else (1,)):
        x = _add(base, _mul(perp, s * h))
        da = angulo(c, x) - a1
        fr = ((da % TAU) / d) if d > 0 else (((-da) % TAU) / -d)
        if eps < fr < 1 - eps:
            out.append(fr)
    return sorted(out)


def _partir(t, puntos_corte):
    """Parte el tramo en los puntos dados (ya ordenados a lo largo del tramo)."""
    pts = [t[1] if t[0] == "L" else t[3]] + puntos_corte + [t[2] if t[0] == "L" else t[4]]
    if t[0] == "L":
        return [("L", pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    return [("A", t[1], t[2], pts[i], pts[i + 1], t[5]) for i in range(len(pts) - 1)]


def _poligono(contorno, paso_grados=1.0):
    pts = []
    for t in contorno:
        if t[0] == "L":
            pts.append(t[1])
        else:
            _a1, d = barrido(t)
            n = max(4, int(math.ceil(abs(math.degrees(d)) / paso_grados)))
            pts += [punto_en(t, i / n) for i in range(n)]
    return pts


def adentro(punto, contorno):
    """Punto adentro del contorno (rayo horizontal sobre el contorno hecho poligono fino)."""
    pts = _poligono(contorno)
    x, y = punto
    dentro = False
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            dentro = not dentro
    return dentro


def cortar_con_disco(contorno, c0, R):
    """Divide un contorno antihorario por el circulo (c0, R). Devuelve {"dentro": tramos del contorno adentro del disco,
    "fuera": los de afuera, "arcos": arcos del circulo adentro del contorno (antihorarios respecto de c0), "cortes": n}.
    Region y disco = dentro + arcos; region menos disco = fuera + arcos invertidos."""
    dentro, fuera, cortes = [], [], []
    for t in contorno:
        fr = _fracciones_corte(t, c0, R)
        pc = [punto_en(t, f) for f in fr]
        cortes += pc
        for pz in _partir(t, pc):
            (dentro if math.dist(punto_en(pz, 0.5), c0) < R else fuera).append(pz)
    arcos = []
    if cortes:
        ang = sorted(cortes, key=lambda x: angulo(c0, x) % TAU)
        for i in range(len(ang)):
            p, q = ang[i], ang[(i + 1) % len(ang)]
            arc = ("A", c0, R, p, q, True)
            if adentro(punto_en(arc, 0.5), contorno):
                arcos.append(arc)
    return {"dentro": dentro, "fuera": fuera, "arcos": arcos, "cortes": len(cortes)}


def region_menos_disco(contorno, c0, R):
    d = cortar_con_disco(contorno, c0, R)
    if d["cortes"] != 2:
        raise ValueError(f"el circulo R{R:g} corta el contorno en {d['cortes']} puntos (se esperaban 2)")
    return d["fuera"] + invertir(d["arcos"])


def area_con_disco(contorno, c0, R):
    """Area de la region del contorno adentro del disco (c0, R). Sin cortes: la region entera, el disco entero o nada."""
    d = cortar_con_disco(contorno, c0, R)
    if d["cortes"] == 0:
        if math.dist(punto_en(contorno[0], 0.5), c0) < R:
            return area(contorno)
        return math.pi * R * R if adentro(c0, contorno) else 0.0
    return area(d["dentro"] + d["arcos"])


def centro_r41(A, B):
    """Centro del R41 (la misma cuenta que _tool_block.centro_r41)."""
    y_fin = B - COTA_36
    x_fin = A - COTA_29 + y_fin * COTA_29 / (B - COTA_24)
    return (A, y_fin + math.sqrt(R41 ** 2 - (A - x_fin) ** 2))


def rebaje_L(A, B):
    """Lo que saca el rebaje de 19 en planta: orejeta (x < A-52) y diente (y < 19), con 10 de sobra afuera, como las dos
    cajas de _tool_block.pieza."""
    x0, y0 = A - ANCHO_DER, ORE_Y_BAJO
    pts = [(-10.0, -10.0), (A + 10.0, -10.0), (A + 10.0, y0), (x0, y0), (x0, B + 10.0), (-10.0, B + 10.0)]
    return [("L", pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def mover(contorno, dx):
    def m(p):
        return (p[0] + dx, p[1])
    out = []
    for t in contorno:
        out.append(("L", m(t[1]), m(t[2])) if t[0] == "L" else ("A", m(t[1]), t[2], m(t[3]), m(t[4]), t[5]))
    return out


def geometria(paso, A, B, C):
    """Todo lo que CATIA dibuja para la pregunta `paso` (3 a 6) y lo que cada operacion tiene que sumar (+) o sacar
    (-), en mm3, en el orden de CATIA: base, rebaje, ranura, agujero de 11, vaciado (dos zonas)."""
    g = {"A": A, "B": B, "C": C, "paso": paso}
    per = perfil(A, B)
    a14 = math.pi * (D_AGUJERO_14 / 2) ** 2
    c14 = (ORE_X_AGUJERO, ORE_Y_AGUJERO)
    g["perfil"], g["agujero_14"] = per, (c14[0], c14[1], D_AGUJERO_14 / 2)
    g["area_perfil"] = area(per)
    ops = [("base", g["area_perfil"] * C - a14 * C)]
    if paso >= 5:
        blq = bloque(A, B)
        g["bloque"], g["area_bloque"] = blq, area(blq)
        if c14[0] + D_AGUJERO_14 / 2 >= A - ANCHO_DER:
            raise ValueError("el agujero de 14 no queda entero en la orejeta")
        z_reb = C - REBAJE
        g["rebaje"], g["z_rebaje"] = rebaje_L(A, B), z_reb
        ops.append(("rebaje", -(g["area_perfil"] - g["area_bloque"] - a14) * REBAJE))
        c41 = centro_r41(A, B)
        g["c41"] = c41
        if math.dist(c14, c41) <= R41 + D_AGUJERO_14 / 2:
            raise ValueError("el R41 toca el agujero de 14: la cuenta de la ranura no vale")
        z0, z1 = OREJA_ATRAS, OREJA_ATRAS + RANURA
        abajo = max(0.0, min(z1, z_reb) - z0)          # tramo de la ranura con el perfil entero
        arriba = max(0.0, z1 - max(z0, z_reb))         # tramo con solo el bloque (arriba del rebaje)
        a_per41, a_blq41 = area_con_disco(per, c41, R41), area_con_disco(blq, c41, R41)
        g["area_perfil_y_R41"], g["area_bloque_y_R41"] = a_per41, a_blq41
        ops.append(("ranura", -(a_per41 * abajo + a_blq41 * arriba)))
        c11 = (A - COTA_14_11, B - COTA_14_11)
        r11 = D_AGUJERO_11 / 2
        g["agujero_11"] = (c11[0], c11[1], r11)
        if math.dist(c11, c41) + r11 >= R41:
            raise ValueError("el agujero de 11 no queda entero adentro del R41: la cuenta no vale")
        ops.append(("agujero_11", -math.pi * r11 ** 2 * (C - RANURA)))
    if paso >= 6:
        hueco = desplazar_adentro(g["bloque"], PARED)
        sin_ranura = region_menos_disco(hueco, g["c41"], R41 + PARED)
        g["hueco"], g["hueco_sin_ranura"] = hueco, sin_ranura
        g["area_hueco"], g["area_hueco_sin_ranura"] = area(hueco), area(sin_ranura)
        c11, r11 = g["agujero_11"][:2], g["agujero_11"][2]
        if math.dist(c11, g["c41"]) + r11 >= R41 + PARED or not adentro(c11, hueco):
            raise ValueError("el agujero de 11 no queda adentro del hueco y del R42: la cuenta no vale")
        z_tapa = OREJA_ATRAS + RANURA + PARED                     # 37: delante de la ranura queda 1
        g["z_tapa_ranura"] = z_tapa
        ops.append(("vaciado_sin_ranura", -g["area_hueco_sin_ranura"] * (C - PARED_ATRAS)))
        ops.append(("vaciado_delante", -(g["area_hueco"] - g["area_hueco_sin_ranura"] - math.pi * r11 ** 2)
                    * (C - z_tapa)))
    g["ops"] = ops
    g["volumen"] = sum(v for _, v in ops)
    return g
