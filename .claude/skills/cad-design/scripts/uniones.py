# -*- coding: utf-8 -*-
"""uniones.py — cada pieza de un conjunto APOYA en otra, con el area medida (corre en .venv-cad).

Por que existe (19/10/2026): el carro de tubo de practica daba «0 de solape» y su despiece cerraba exacto, pero las 4 patas
tocaban el marco por una ARISTA (corridas 30 mm en diagonal): no habia donde soldar. Lo vio Fak en el plano. «Sin solape»
no dice «unido»: lo que carga peso se controla por el AREA de contacto (cad-3d.md GATE 3, el caballete de 7,45 mm en el
aire). Este control mide, para cada par de solidos, el area de contacto (se corre uno 0,01 mm en +-X, +-Y, +-Z contra el
otro y se divide el volumen comun por 0,01), arma el grafo de uniones y da ROJO si:
  - una pieza no apoya en ninguna otra con al menos --min-area mm2;
  - el conjunto queda partido en mas de un grupo;
  - dos piezas se solapan (volumen comun sin correr > --tol-solape mm3).
Uso: python uniones.py <conjunto.step> [--min-area 20] [--tol-solape 0.001]
Sale 0 si todo une, 1 si hay ROJO, 2 si el archivo no trae dos solidos o mas. Imprime un JSON.
Limite: mide contacto cara contra cara; un tornillo que atraviesa dos piezas con juego no cuenta como union."""
import argparse
import itertools
import json
import sys

EPS = 0.01


def volumen(a, b):
    i = a & b
    return sum(s.volume for s in i.solids()) if i else 0.0


def cerca(a, b, margen=0.05):
    p, q = a.bounding_box(), b.bounding_box()
    return not (p.max.X + margen < q.min.X or q.max.X + margen < p.min.X or p.max.Y + margen < q.min.Y
                or q.max.Y + margen < p.min.Y or p.max.Z + margen < q.min.Z or q.max.Z + margen < p.min.Z)


def contacto(a, b):
    from build123d import Pos
    mejor = 0.0
    for d in ((EPS, 0, 0), (-EPS, 0, 0), (0, EPS, 0), (0, -EPS, 0), (0, 0, EPS), (0, 0, -EPS)):
        mejor = max(mejor, volumen(Pos(*d) * a, b) / EPS)
    return mejor


def revisar(solidos, min_area=20.0, tol_solape=1e-3):
    n = len(solidos)
    uniones, solapes = [], []
    for i, j in itertools.combinations(range(n), 2):
        a, b = solidos[i], solidos[j]
        if not cerca(a, b):
            continue
        s = volumen(a, b)
        if s > tol_solape:
            solapes.append({"a": i, "b": j, "mm3": round(s, 3)})
            continue
        area = contacto(a, b)
        if area >= min_area:
            uniones.append({"a": i, "b": j, "mm2": round(area, 1)})
    grupo = list(range(n))

    def raiz(k):
        while grupo[k] != k:
            grupo[k] = grupo[grupo[k]]
            k = grupo[k]
        return k
    for u in uniones:
        grupo[raiz(u["a"])] = raiz(u["b"])
    grupos = len({raiz(k) for k in range(n)})
    con_union = {u["a"] for u in uniones} | {u["b"] for u in uniones}
    sueltas = [k for k in range(n) if k not in con_union]
    rojo = bool(sueltas or solapes or grupos > 1)
    return {"solidos": n, "uniones": uniones, "piezas_sin_apoyo": sueltas, "solapes": solapes, "grupos": grupos,
            "veredicto": "ROJO" if rojo else "VERDE"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step")
    ap.add_argument("--min-area", type=float, default=20.0)
    ap.add_argument("--tol-solape", type=float, default=1e-3)
    a = ap.parse_args()
    from build123d import import_step
    try:
        sol = import_step(a.step).solids()
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)[:200]}))
        sys.exit(2)
    if len(sol) < 2:
        print(json.dumps({"error": f"el archivo trae {len(sol)} solido(s): hacen falta dos o mas"}))
        sys.exit(2)
    r = revisar(list(sol), a.min_area, a.tol_solape)
    print(json.dumps(r))
    sys.exit(1 if r["veredicto"] == "ROJO" else 0)


if __name__ == "__main__":
    main()
