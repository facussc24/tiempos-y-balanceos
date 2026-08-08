#!/usr/bin/env python
"""REVISION CIEGA — arma el expediente para que otro juzgue la pieza SIN ver como se hizo.

POR QUE EXISTE. En la sesion del 2026-08-07 se cometieron seis errores graves de diseno y
**el sistema de verificacion detecto cero**. Los seis los encontro una persona. Dos de ellos
los vio de un vistazo, mirando un render, mientras siete controles automaticos daban verde:

    "tiene demasiada base, muy alta, se ve obvio que se puede"   -> 3x sobredimensionado
    "los cuadraditos se ven fragiles, justamente los que
     tienen que hacer presion"                                    -> SF a fatiga 0,24

La operacion que hizo esa persona y que ningun control hacia es esta: **juzgo el ARTEFACTO
sin la derivacion**. No vio la cadena `brazo 26 -> alto 36 -> huella >= alto -> 110x100`.
Vio el objeto terminado. Y la cadena es justamente lo que hace parecer razonable cada paso:
sin ella, el objeto no tiene defensa.

Este CLI mecaniza eso. Junta:
  - renders del artefacto FINAL (varias vistas, con escala en mm)
  - las magnitudes fisicas y los RATIOS adimensionales (masa contra la fuerza que aplica,
    volumen del utillaje contra el volumen de la zona que toca, etc.)
  - la ficha de funcion, si existe
  ... y escribe un PROMPT listo para pasarle a un revisor que NO vio el log de diseno.

Lo que NO incluye, a proposito: como se llego a esas cotas, que decisiones se tomaron, que
gates dieron verde. El revisor tiene que poder contradecir sin estar contaminado.

USO
    revision_ciega.py --step out/pieza.step --workdir W \\
        --funcion "prensa tela contra la pared de una ranura, 60 s por ciclo" \\
        --fuerza-total 6.5 --zona 53x12x9 --ciclos 100000

Sale con codigo 0 siempre: no juzga, prepara el juicio.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render  # noqa: E402

DENS = {"PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "ASA": 1.07, "NYLON": 1.14}


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--step", required=True, help="el artefacto TERMINADO")
    p.add_argument("--workdir", required=True)
    p.add_argument("--funcion", required=True,
                   help="que hace la pieza, en UNA linea, sin decir como se construyo")
    p.add_argument("--fuerza-total", type=float,
                   help="N que la pieza aplica en total (para el ratio de sensatez)")
    p.add_argument("--zona", help="zona de trabajo LxAxP en mm, ej: 53x12x9")
    p.add_argument("--ciclos", type=int, help="ciclos de vida esperados")
    p.add_argument("--material", default="PLA", choices=list(DENS))
    p.add_argument("--relleno", type=float, default=0.30, help="fraccion de relleno (0-1)")
    p.add_argument("--lc", type=float, default=0.6)
    a = p.parse_args()

    m = geom.step_to_trimesh(a.step, lc=a.lc, require_watertight=False)
    ext = np.ptp(m.vertices, axis=0)
    vol = float(m.volume) / 1000.0                      # cm3
    masa = vol * DENS[a.material] * a.relleno           # g, aprox con relleno
    base = os.path.splitext(os.path.basename(a.step))[0]

    print("EXPEDIENTE DE REVISION CIEGA")
    print("=" * 72)
    print(f"pieza      : {os.path.basename(a.step)}")
    print(f"funcion    : {a.funcion}")
    print(f"medidas    : {ext[0]:.0f} x {ext[1]:.0f} x {ext[2]:.0f} mm")
    print(f"volumen    : {vol:.1f} cm3  ->  ~{masa:.0f} g de {a.material} al "
          f"{a.relleno*100:.0f} % de relleno")
    if a.ciclos:
        print(f"vida       : {a.ciclos:,} ciclos".replace(",", "."))

    print("\nRATIOS DE SENSATEZ (registro, no umbral — la banda se construye con casos)")
    ratios = {}
    if a.fuerza_total:
        r = a.fuerza_total / (masa / 1000.0 * 9.81)
        ratios["fuerza_sobre_peso"] = round(r, 2)
        print(f"  fuerza que aplica / peso propio ......... {r:6.2f}")
        print(f"     (aplica {a.fuerza_total:.1f} N y pesa {masa:.0f} g = "
              f"{masa/1000*9.81:.2f} N)")
        if r < 5:
            print("     ^ el utillaje pesa mas que una fraccion apreciable de lo que aprieta.")
            print("       No es un defecto por si mismo, pero es la comparacion que hace un")
            print("       ojo entrenado en 3 segundos. Justificarlo o revisarlo.")
    if a.zona:
        d = [float(x) for x in a.zona.lower().split("x")]
        vz = np.prod(d) / 1000.0
        ratios["volumen_sobre_zona"] = round(vol / vz, 1)
        print(f"  volumen del utillaje / volumen de la zona  {vol/vz:6.1f} x")
        print(f"     (utillaje {vol:.1f} cm3 · zona de trabajo {vz:.2f} cm3)")
    ratios["esbeltez"] = round(float(max(ext) / min(ext)), 1)
    print(f"  lado mayor / lado menor ................. {ratios['esbeltez']:6.1f}")

    # renders del artefacto terminado, varias vistas
    tris = geom.step_to_tris(a.step, lc=a.lc)
    outp = os.path.join(a.workdir, "renders", "revision_%s" % base)
    os.makedirs(os.path.dirname(outp), exist_ok=True)
    files = render.render_views(
        [(tris, "#e8a33d", 1.0)], outp,
        views={"iso": (26, -62), "abajo": (-28, -62), "canto": (2, -90), "planta": (86, -90)},
        title="%s — %.0f x %.0f x %.0f mm · %.0f g" % (base, ext[0], ext[1], ext[2], masa))
    print("\nRENDERS (mirarlos, son la mitad del expediente):")
    for f in files:
        print("   %s" % f)

    prompt = f"""Sos un ingeniero senior de utillajes. Te paso una pieza TERMINADA para que la
juzgues. NO vas a ver como se llego a estas cotas, y es a proposito: la derivacion es
justamente lo que hace parecer razonable cada paso.

QUE HACE: {a.funcion}

MEDIDAS: {ext[0]:.0f} x {ext[1]:.0f} x {ext[2]:.0f} mm · {vol:.1f} cm3 · ~{masa:.0f} g de {a.material}
{f'FUERZA QUE APLICA: {a.fuerza_total} N en total' if a.fuerza_total else ''}
{f'ZONA DE TRABAJO: {a.zona} mm' if a.zona else ''}
{f'VIDA ESPERADA: {a.ciclos} ciclos' if a.ciclos else ''}

RENDERS: {', '.join(os.path.basename(f) for f in files)}

Contestame estas cinco, en este orden:

1. ¿El TAMANO tiene sentido para lo que hace? Compará la magnitud de la pieza contra la
   magnitud del trabajo. Si algo esta sobredimensionado, decilo aunque no puedas probarlo.
2. Mirando los renders: ¿que feature te parece FRAGIL, y por que? Identificá primero cual
   trabaja y despues juzgala.
3. ¿Como se rompe esta pieza? Dame el modo de falla mas probable, no el mas grave.
4. ¿Hay UNA sola forma de montarla? Si entra girada o balancea, es un defecto.
5. ¿Que le falta que un utillaje de banco siempre tiene?

Sé duro. El valor de tu respuesta esta en lo que encuentres, no en confirmar que esta bien.
Si algo te parece raro y no podes justificarlo con numeros, decilo igual: "se ve mal" de un
ojo entrenado vale mas que siete controles que miran otra cosa."""

    pf = os.path.join(a.workdir, "revision_ciega_%s.txt" % base)
    with open(pf, "w", encoding="utf-8") as f:
        f.write(prompt)
    json.dump({"pieza": base, "ext": ext.tolist(), "vol_cm3": vol, "masa_g": masa,
               "ratios": ratios, "renders": files, "funcion": a.funcion},
              open(os.path.join(a.workdir, "revision_ciega_%s.json" % base), "w"), indent=1)
    print("\nPROMPT listo -> %s" % pf)
    print("Pasaselo a un revisor JUNTO CON LOS RENDERS. No le cuentes como se diseno.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
