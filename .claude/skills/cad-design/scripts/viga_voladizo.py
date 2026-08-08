#!/usr/bin/env python
"""Dimensiona una LAMINA/FALDA elastica impresa — y muestra la FAMILIA, no una solucion.

POR QUE EXISTE (fallo real, 2026-08-07). Un utillaje quedo de 36 mm de alto y 166 cm3 de
PLA para una pieza que aprieta 6 N. El cliente lo vio de un vistazo: "tiene demasiada base,
muy alta, se ve obvio que se puede".

La causa no fue una cota: fue el METODO.

 1. Copie el brazo (L = 26 mm) de un informe SIN verificarlo con su propia formula. Con
    t=1,8 y L=26 la rigidez da 2,49 N/mm; el mismo informe decia 7,5 (que corresponde a
    L=18). El numero era inconsistente consigo mismo y nunca hice la cuenta.
 2. De ese parametro salio TODO el tamano, en cadena, y cada eslabon tomaba el anterior
    como dado:
        brazo 26  ->  alto 36  ->  "huella >= alto"  ->  110 x 100  ->  166 cm3
    Ningun paso era absurdo por separado. El resultado si.
 3. Trate una solucion como LA solucion. Las dos condiciones que importan son
        F   = E.b.t^3.d / (4.L^3)      (fuerza que aprieta)
        eps = 3.t.d / (2.L^2)          (que no quede tomada la pieza)
    Dos ecuaciones, TRES incognitas (t, L, d): hay una FAMILIA de disenos con la MISMA
    fuerza y la MISMA deformacion. Recalculando, t=1,8 L=15 d=0,50 da los mismos 6,4 N y
    el mismo 0,6 %, con 22 mm de alto y 55 cm3. Un 66 % menos de material, gratis.

Este CLI hace las tres cosas: verifica un juego de cotas contra la formula, imprime la
familia completa, y marca la de menor altura que respeta los minimos de impresion.

USO
    viga_voladizo.py --fuerza 6.4 --b 12 --eps-max 0.006
    viga_voladizo.py --verificar --t 1.8 --brazo 26 --precarga 0.85 --b 12
    viga_voladizo.py --fuerza 6.4 --b 12 --eps-max 0.006 --t-min 1.2 --json cotas.json
"""
import argparse
import json
import sys

import numpy as np

E_PLA = 2500.0      # MPa, PLA impreso (rango real 2000-3500)
EPS_PLA = 0.006     # limite para que no quede set permanente en un ciclo de ~60 s


def rigidez(E, b, t, L):
    return E * b * t ** 3 / (4.0 * L ** 3)


def deformacion(t, d, L):
    return 3.0 * t * d / (2.0 * L ** 2)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--E", type=float, default=E_PLA, help="modulo [MPa] (default PLA 2500)")
    p.add_argument("--b", type=float, required=True, help="ancho de la lamina [mm]")
    p.add_argument("--eps-max", type=float, default=EPS_PLA,
                   help="deformacion maxima admisible (default 0,006 para PLA)")
    p.add_argument("--fuerza", type=float, help="fuerza objetivo por lamina [N]")
    p.add_argument("--t-min", type=float, default=1.2,
                   help="espesor minimo imprimible [mm] (3 perimetros de 0,4)")
    p.add_argument("--d-min", type=float, default=0.35,
                   help="precarga minima util [mm]: tiene que cubrir el stack de tolerancias")
    p.add_argument("--verificar", action="store_true",
                   help="chequear un juego de cotas concreto en vez de proponer")
    p.add_argument("--t", type=float, help="espesor [mm] (con --verificar)")
    p.add_argument("--brazo", type=float, help="largo libre L [mm] (con --verificar)")
    p.add_argument("--precarga", type=float, help="deflexion d [mm] (con --verificar)")
    p.add_argument("--k-declarada", type=float,
                   help="la rigidez que DICE el informe: se compara contra la formula")
    p.add_argument("--alto-extra", type=float, default=7.0,
                   help="mm que se suman al brazo para el alto total (macho + piso)")
    p.add_argument("--json", help="volcar las cotas elegidas")
    a = p.parse_args()

    if a.verificar:
        if None in (a.t, a.brazo, a.precarga):
            raise SystemExit("--verificar necesita --t, --brazo y --precarga")
        k = rigidez(a.E, a.b, a.t, a.brazo)
        eps = deformacion(a.t, a.precarga, a.brazo)
        print(f"COTAS DADAS: t={a.t} mm · brazo={a.brazo} mm · precarga={a.precarga} mm · "
              f"b={a.b} mm · E={a.E:.0f} MPa\n")
        print(f"  rigidez k = E.b.t^3/(4L^3) = {k:8.3f} N/mm")
        print(f"  fuerza  F = k.d           = {k * a.precarga:8.3f} N")
        print(f"  deformacion eps           = {eps * 100:8.3f} %   "
              f"({'OK' if eps <= a.eps_max else 'PASADA: va a quedar tomada'})")
        print(f"  alto total estimado       = {a.brazo + a.alto_extra:8.1f} mm")
        cod = 0 if eps <= a.eps_max else 1
        if a.k_declarada:
            dif = abs(k - a.k_declarada) / a.k_declarada * 100
            print(f"\n  el informe declara k = {a.k_declarada} N/mm  ->  la formula da {k:.3f}"
                  f"  ({dif:.0f} % de diferencia)")
            if dif > 10:
                print("  [FALLA] el numero NO cierra con su propia formula. No lo uses.")
                # el brazo que si daria esa k
                Lb = (a.E * a.b * a.t ** 3 / (4 * a.k_declarada)) ** (1 / 3)
                print(f"          con t={a.t} la k declarada corresponde a brazo = {Lb:.1f} mm")
                cod = 1
            else:
                print("  [OK] cierra con la formula.")
        return cod

    if a.fuerza is None:
        raise SystemExit("hace falta --fuerza (o usar --verificar)")

    # De F y eps simultaneas:  t^2 = L.C1/C2  con C1 = 4F/(E.b), C2 = 2.eps/3
    C1, C2 = 4.0 * a.fuerza / (a.E * a.b), 2.0 * a.eps_max / 3.0
    print(f"FAMILIA de laminas que dan F = {a.fuerza} N con eps = {a.eps_max*100:.2f} % exacto")
    print(f"(b = {a.b} mm · E = {a.E:.0f} MPa · minimos: t >= {a.t_min}, precarga >= {a.d_min})\n")
    print(f"{'brazo L':>9} {'espesor t':>10} {'precarga d':>11} {'k':>9} {'ALTO TOTAL':>11}  ")
    elegida = None
    for L in np.arange(6.0, 40.1, 1.0):
        t = float(np.sqrt(L * C1 / C2))
        d = float(C2 * L ** 2 / t)
        k = rigidez(a.E, a.b, t, L)
        alto = L + a.alto_extra
        ok = t >= a.t_min and d >= a.d_min
        if L % 3 == 0 or ok and elegida is None:
            print(f"{L:9.0f} {t:10.2f} {d:11.3f} {k:9.2f} {alto:10.0f}   "
                  + ("" if ok else "t o precarga por debajo del minimo"))
        if ok and elegida is None:
            elegida = {"brazo": round(L, 1), "t": round(t, 2), "precarga": round(d, 3),
                       "k": round(k, 2), "fuerza": a.fuerza, "alto_total": round(alto, 1),
                       "eps": a.eps_max, "b": a.b, "E": a.E}
    if elegida is None:
        print("\n[FALLA] ninguna solucion respeta los minimos. Revisar F, b o eps.")
        return 1
    print(f"\n-> LA MAS BAJA que cumple todo: brazo {elegida['brazo']:.0f} · "
          f"t {elegida['t']:.2f} · precarga {elegida['precarga']:.2f}  ->  "
          f"ALTO TOTAL {elegida['alto_total']:.0f} mm")
    print(f"   con el stack tipico de +-0,16 mm, la fuerza iria de "
          f"{(elegida['precarga']-0.16)*elegida['k']:.1f} a "
          f"{(elegida['precarga']+0.16)*elegida['k']:.1f} N "
          f"({(elegida['precarga']+0.16)/(elegida['precarga']-0.16):.1f}x de variacion — "
          f"si te parece mucho, subi el brazo un par de mm y la precarga sube con el)")
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(elegida, f, indent=1)
        print(f"   escrito {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
