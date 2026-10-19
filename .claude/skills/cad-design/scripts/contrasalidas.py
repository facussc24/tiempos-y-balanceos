# -*- coding: utf-8 -*-
"""contrasalidas.py — ¿la pieza sale del molde? Area que TRABA (contrasalida) y area de pared SIN desmoldeo, para una
direccion de apertura y un plano de particion (corre en .venv-cad).

Para cada triangulo de la superficie (tessellate de OCC, normal hacia AFUERA de la pieza):
  - si esta del lado +d del plano de particion, la mitad que lo forma se va en +d: TRABA si n·d < -sen(tol);
  - del lado -d, la otra mitad se va en -d: TRABA si n·d > +sen(tol);
  - pared SIN DESMOLDEO si |n·d| < sen(angulo_min) (default 0,5 grados): sale, pero raspa.
Con --corredizo dx,dy,dz y --zona x0,y0,z0,x1,y1,z1 los triangulos de esa caja se juzgan contra el corredizo (sale en
esa direccion: traba si n·c < -sen(tol)), no contra la apertura.
Uso: python contrasalidas.py pieza.step --dir 0,0,1 --particion 0 [--angulo-min 0.5] [--corredizo 1,0,0 --zona ...]
Imprime un JSON: area total, area que traba, area sin desmoldeo, y la caja de lo que traba. Sale 1 si algo traba.
Limite: es una prueba LOCAL por normal (no simula el recorrido de un corredizo ni el choque de una pared que mira bien
pero queda detras de otra). La pieza se PARTE por el plano antes de juzgar (el lado lo decide el corte) y la normal es la
de la superficie real (sin ruido de teselado). Umbrales 0,5 grados (sin desmoldeo) y 0,1 grados (traba): eleccion mia."""
import argparse
import json
import math
import sys


def triangulos(forma, tol=0.01):
    """Por CARA: el area sale del triangulo y la NORMAL de la superficie real en el centro del triangulo (normal_at),
    no de la normal del triangulo: en redondeos la del triangulo se desvia hasta 0,9 grados (auditor 19/10: una caja con
    aristas R2 daba TRABA 0,03 mm2 de puro teselado)."""
    for cara in forma.faces():
        vs, tris = cara.tessellate(tol, 0.2)
        for a, b, c in tris:
            p, q, r = vs[a], vs[b], vs[c]
            u = (q.X - p.X, q.Y - p.Y, q.Z - p.Z)
            v = (r.X - p.X, r.Y - p.Y, r.Z - p.Z)
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            m = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
            if m < 1e-12:
                continue
            cen = ((p.X + q.X + r.X) / 3, (p.Y + q.Y + r.Y) / 3, (p.Z + q.Z + r.Z) / 3)
            nr = cara.normal_at(cara.project_to_surface(cen) if hasattr(cara, "project_to_surface") else cen)
            yield cen, unit((nr.X, nr.Y, nr.Z)), m / 2


def mitades(forma, d, particion):
    """La pieza partida por el plano de particion: (mitad que sale en +d, mitad que sale en -d). El lado lo decide el
    CORTE, no el centro de cada triangulo (auditor 19/10: con la particion fuera del medio, un prisma de 4 grados daba
    SALE con 239 mm2 que traban)."""
    from build123d import Keep, Plane
    pl = Plane(origin=tuple(particion * x for x in d), z_dir=d)
    arriba = forma.split(pl, keep=Keep.TOP)
    abajo = forma.split(pl, keep=Keep.BOTTOM)
    return arriba, abajo


def unit(v):
    m = math.sqrt(sum(x * x for x in v))
    return tuple(x / m for x in v)


def dentro(p, caja):
    return caja is not None and all(caja[i] <= p[i] <= caja[i + 3] for i in range(3))


def revisar(forma, d=(0, 0, 1), particion=0.0, angulo_min=0.5, tol_traba=0.1, corredizo=None, zona=None):
    d = unit(d)
    c = unit(corredizo) if corredizo else None
    s_min, s_tol = math.sin(math.radians(angulo_min)), math.sin(math.radians(tol_traba))
    total = traba = sin_ang = en_corredizo = 0.0
    caja = [math.inf] * 3 + [-math.inf] * 3
    for signo, mitad in zip((1, -1), mitades(forma, d, particion)):
        if mitad is None or not mitad.solids():
            continue
        for cen, n, a in triangulos(mitad):
            nd = n[0] * d[0] + n[1] * d[1] + n[2] * d[2]
            en_plano = abs(cen[0] * d[0] + cen[1] * d[1] + cen[2] * d[2] - particion) < 1e-6 and abs(abs(nd) - 1) < 1e-6
            if en_plano:                      # la cara de particion (la que dejo el corte o la que ya estaba ahi)
                continue
            total += a
            if c is not None and dentro(cen, zona):
                en_corredizo += a
                malo = (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) < -s_tol
            else:
                malo = signo * nd < -s_tol
                if abs(nd) < s_min:
                    sin_ang += a
            if malo:
                traba += a
                for i in range(3):
                    caja[i] = min(caja[i], cen[i])
                    caja[i + 3] = max(caja[i + 3], cen[i])
    return {"area_total_mm2": round(total, 2), "area_que_traba_mm2": round(traba, 2),
            "area_sin_desmoldeo_mm2": round(sin_ang, 2), "area_en_corredizo_mm2": round(en_corredizo, 2),
            "caja_de_lo_que_traba": [round(x, 2) for x in caja] if traba else None,
            "veredicto": "TRABA" if traba > 0.01 else "SALE"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step")
    ap.add_argument("--dir", default="0,0,1")
    ap.add_argument("--particion", type=float, default=0.0)
    ap.add_argument("--angulo-min", type=float, default=0.5)
    ap.add_argument("--corredizo")
    ap.add_argument("--zona")
    a = ap.parse_args()
    from build123d import import_step
    try:
        forma = import_step(a.step)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)[:200]}))
        sys.exit(2)
    if not forma.solids():
        print(json.dumps({"error": "el archivo no trae solidos"}))
        sys.exit(2)
    try:
        d = tuple(float(x) for x in a.dir.split(","))
        cz = tuple(float(x) for x in a.corredizo.split(",")) if a.corredizo else None
        zn = tuple(float(x) for x in a.zona.split(",")) if a.zona else None
        if len(d) != 3 or math.sqrt(sum(x * x for x in d)) < 1e-9:
            raise ValueError("--dir tiene que ser x,y,z no nulo")
        if (cz is None) != (zn is None) or (cz and len(cz) != 3) or (zn and len(zn) != 6):
            raise ValueError("--corredizo x,y,z y --zona x0,y0,z0,x1,y1,z1 van juntos")
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)
    r = revisar(forma, d, a.particion, a.angulo_min, corredizo=cz, zona=zn)
    print(json.dumps(r))
    sys.exit(1 if r["veredicto"] == "TRABA" else 0)


if __name__ == "__main__":
    main()
