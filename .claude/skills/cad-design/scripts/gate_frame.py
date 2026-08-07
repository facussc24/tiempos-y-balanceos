#!/usr/bin/env python
"""GATE de FRAME — un solo sistema de ejes, derivado de la pieza, y verificado.

POR QUE EXISTE (fallo real, 2026-08-07). Se entrego un ensamble con el dispositivo fuera de
la ranura. Parecian tres errores independientes:
    - el macho 1,88 mm corrido sobre un eje,
    - 6,8 mm sobre el otro,
    - el largo del macho girado 90 grados,
    - y "las dos ranuras del two estan escalonadas 2,5 mm".
Era UNO SOLO. Habia tres marcos guardados en el workdir de sesiones distintas (uno con los
ejes ex/ey invertidos) y se copio un offset de un informe SIN re-medirlo. Ese marco estaba
1,637 grados girado respecto de los ejes propios de la pieza. Con eso:
    54,43 x sen(1,98 deg) = 1,88   <- el "offset" era derrame, no una medida
    89,79 x sen(1,637 deg) = 2,56  <- el escalonamiento NO EXISTE, las ranuras estan alineadas

Un marco girado 1,6 grados no se ve en ningun render y no lo detecta ninguna verificacion de
tamano: todas miden contra el mismo marco torcido.

LAS TRES REGLAS QUE APLICA ESTE CLI
 1. Los ejes los define la PIEZA: una direccion global limpia + la normal medida, y el
    triedro sale de productos vectoriales. No se eligen a ojo.
 2. Un frame por trabajo. Se guarda UNO y todo lo demas cuelga de ahi. Ninguna cota cruza de
    un informe a otro sin re-medirse en el frame de destino.
 3. El frame se verifica con un INVARIANTE QUE SABE FALLAR: dos features que la pieza tiene
    alineados tienen que dar diferencia 0,000 sobre el eje transversal. Si dan 2,5, el frame
    esta girado. El CLI imprime, al lado del valor bueno, el valor que daria con el frame
    torcido — si los dos se parecen, el control no sirve y lo dice.

USO
    gate_frame.py --normal 0.433031,0,-0.901379 --eje-global Y \\
                  --alineados 2637.995,-44.877,484.868 2637.995,44.909,484.868 \\
                  --origen 2637.995,-44.877,484.868 --salida W/frame.json

    --normal      normal de la cara de trabajo (de geom.fit_plane sobre la cara MEDIDA)
    --eje-global  X | Y | Z: la direccion global limpia que define el primer eje del plano
    --alineados   dos puntos que en la PIEZA estan alineados sobre ese eje (2+ features
                  iguales, dos centros de agujero de la misma fila, dos extremos de una
                  ranura). Es el invariante. Sin esto el gate no aprueba.
    --tol         tolerancia del invariante en mm (default 0,05)

Sale con codigo 1 si el invariante no cierra, y 2 si faltan argumentos para verificarlo.
"""
import argparse
import json
import sys

import numpy as np


def triedro(n, cual):
    """Triedro ortonormal derecho: e1 = eje global limpio, e3 = normal, e2 = e3 x e1."""
    g = {"X": [1.0, 0, 0], "Y": [0, 1.0, 0], "Z": [0, 0, 1.0]}[cual.upper()]
    e1 = np.array(g)
    n = np.asarray(n, float) / np.linalg.norm(n)
    if abs(n @ e1) > 0.98:
        raise SystemExit(f"--eje-global {cual} es casi paralelo a la normal "
                         f"(|cos| = {abs(n @ e1):.3f}): elegi otro eje")
    # e1 se re-ortogonaliza contra n para que el triedro sea exacto
    e1 = e1 - (e1 @ n) * n
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(n, e1)
    e2 /= np.linalg.norm(e2)
    e3 = np.cross(e1, e2)
    return e1, e2, e3


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--normal", required=True, help="nx,ny,nz de la cara de trabajo")
    p.add_argument("--eje-global", default="Y", choices=list("XYZxyz"),
                   help="direccion global que define el eje 1 del plano (default Y)")
    p.add_argument("--alineados", nargs=2, metavar="x,y,z",
                   help="dos puntos que la PIEZA tiene alineados: el invariante")
    p.add_argument("--origen", help="x,y,z del origen (default: el 1er punto de --alineados)")
    p.add_argument("--tol", type=float, default=0.05, help="tolerancia del invariante [mm]")
    p.add_argument("--comparar-con", metavar="ux,uy,uz",
                   help="un eje de OTRO frame, para saber cuanto estaba girado")
    p.add_argument("--salida", required=True, help="ruta del frame.json")
    a = p.parse_args()

    def pt(s):
        return np.array([float(x) for x in s.split(",")])

    e1, e2, e3 = triedro(pt(a.normal), a.eje_global)
    R = np.column_stack([e1, e2, e3])
    orto = np.abs(R.T @ R - np.eye(3)).max()
    det = float(np.linalg.det(R))
    print("EJES PROPIOS DE LA PIEZA")
    for nom, e in (("e1 (eje global limpio)", e1), ("e2 (transversal)", e2), ("e3 (normal)", e3)):
        print(f"  {nom:<24} = ({e[0]:+.6f}, {e[1]:+.6f}, {e[2]:+.6f})")
    print(f"  ortonormal: max|R'R-I| = {orto:.1e}   det = {det:+.9f}")
    if orto > 1e-9 or abs(det - 1) > 1e-9:
        print("[FALLA] el triedro no es ortonormal derecho")
        return 1

    if a.comparar_con:
        u = pt(a.comparar_con); u /= np.linalg.norm(u)
        gir = np.degrees(np.arccos(min(1.0, max(abs(u @ e1), abs(u @ e2)))))
        print(f"\n  el frame que se venia usando estaba {gir:.3f} grados girado respecto de este")

    if not a.alineados:
        print("\n[GATE] falta --alineados: sin invariante no se puede saber si el frame esta")
        print("       girado, y un giro de 1,6 grados no se ve en ningun render.")
        print("       Pasar dos puntos que la PIEZA tenga alineados (dos features iguales).")
        return 2

    P = [pt(s) for s in a.alineados]
    O = pt(a.origen) if a.origen else P[0]
    L = [R.T @ (q - O) for q in P]
    d = L[1] - L[0]
    sep = float(np.linalg.norm(d))
    print(f"\nINVARIANTE — dos features que la pieza tiene alineados")
    for i, q in enumerate(L):
        print(f"  punto {i + 1} en el frame: ({q[0]:+9.3f}, {q[1]:+9.3f}, {q[2]:+9.3f})")
    print(f"  separacion {sep:.3f} mm  ->  sobre e1 {d[0]:+.3f}   "
          f"sobre e2 {d[1]:+.3f}   fuera de plano {d[2]:+.3f}")

    # el valor gemelo: cuanto daria la componente transversal con el frame apenas girado
    for g in (0.5, 1.0, 1.637, 3.0):
        print(f"     con el frame girado {g:5.3f} deg, 'sobre e2' daria "
              f"{sep * np.sin(np.radians(g)):+.3f} mm")
    bien = abs(d[1]) <= a.tol
    print(f"  [{'OK' if bien else 'FALLA'}] sobre e2 da {d[1]:+.3f} mm (tol {a.tol}). " +
          ("El frame esta alineado con la pieza."
           if bien else
           f"El frame esta ~{np.degrees(np.arcsin(min(1, abs(d[1]) / max(sep, 1e-9)))):.3f} deg "
           "girado. NO seguir: toda cota que salga de aca va a estar torcida."))
    if not bien:
        return 1

    out = {"e1": e1.tolist(), "e2": e2.tolist(), "e3": e3.tolist(), "origen": O.tolist(),
           "invariante": {"puntos": [q.tolist() for q in P], "separacion": sep,
                          "transversal": float(d[1]), "tol": a.tol}}
    with open(a.salida, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"\nescrito {a.salida}  <- UNICO frame. Nada mas puede definir ejes,")
    print("   y ninguna cota entra sin re-medirse en el.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
