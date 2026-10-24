from gemelo import perfil

def e1():
    return perfil(81, 57, agujero=False)[0]

def e2():
    return perfil(84, 59, agujero=False)[0]


def _zona_in():
    from build123d import offset, Rectangle, Pos
    sk = perfil(86, 58, agujero=False)[0]
    zona = sk & (Pos(86 - 52 + 100, 19 + 100) * Rectangle(200, 200))
    return offset(zona, -1)


def e3():
    return perfil(86, 58, agujero=False)[0]


def e4_zona():
    """Bolsillo de la etapa 4, z 0..7: la zona x > 34, y > 19 con 1 mm de pared."""
    return _zona_in()


def e4_sin_ranura():
    """Bolsillo de la etapa 4, z 7..32: la misma zona menos el R42 (1 mm de piel alrededor de la ranura R41)."""
    from build123d import Circle, Pos
    from gemelo34 import centro_r41
    c = centro_r41(86, 58)[0]
    return _zona_in() - Pos(c[0], c[1]) * Circle(42)
