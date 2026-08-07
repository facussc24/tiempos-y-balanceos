#!/usr/bin/env python
"""GATE de rosca: ¿la tuerca ENTRA en el tornillo, o se pisan?

Mide sobre los STL que se van a imprimir (el artefacto, no el diseño). Enrosca la tuerca
de verdad: la baja por el eje en pasos finos y, en cada altura, la gira al angulo que le
corresponde por la helice (z avanza un paso = 360 grados). En la posicion enroscada el
volumen de interferencia tiene que ser ~0.

Control gemelo OBLIGATORIO (--gemelo): repite todo contra un par SIN holgura. Si el par
bueno y el gemelo dan parecido, este control es ciego y no sirve — el CLI lo dice y sale 1.

Uso:
    python gate_rosca.py --tornillo t.stl --tuerca n.stl --pitch 1.0 \
        --z-desde 6 --z-hasta 20 [--gemelo t0.stl n0.stl] [--render dir]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import trimesh


def _load(p: Path) -> trimesh.Trimesh:
    m = trimesh.load_mesh(str(p), process=True)
    if isinstance(m, trimesh.Scene):
        m = trimesh.util.concatenate(tuple(m.geometry.values()))
    if not m.is_watertight:
        m.fill_holes()
    return m


def _interferencia(tornillo, tuerca, z, ang):
    T = trimesh.transformations.rotation_matrix(ang, [0, 0, 1])
    T[2, 3] = z
    n = tuerca.copy()
    n.apply_transform(T)
    try:
        inter = trimesh.boolean.intersection([tornillo, n], engine="manifold")
        v = float(inter.volume) if inter is not None and len(inter.faces) else 0.0
    except Exception:
        v = float("nan")
    return max(v, 0.0)


def barrido(tornillo, tuerca, pitch, z0, z1, paso_z, fase0=0.0, signo=+1):
    """Enrosca la tuerca a lo largo del eje.

    Helice a derechas: un punto de la rosca cumple z = paso*theta/(2*pi), asi que al
    bajar/subir dz la tuerca DEBE girar dtheta = signo*2*pi*dz/paso. El signo correcto es
    uno solo: probar los dos es el control sintetico BIEN/MAL de este gate.
    """
    out = []
    for z in np.arange(z0, z1 + 1e-9, paso_z):
        ang = signo * 2 * np.pi * (z / pitch) + fase0
        out.append((float(z), float(np.degrees(ang) % 360),
                    _interferencia(tornillo, tuerca, z, ang)))
    return out


def afinar_fase(tornillo, tuerca, pitch, z, signo, n=36):
    """En una altura fija, busca la fase angular que minimiza la interferencia."""
    mejor = (0.0, float("inf"))
    for k in range(n):
        f = 2 * np.pi * k / n
        v = _interferencia(tornillo, tuerca, z, signo * 2 * np.pi * (z / pitch) + f)
        if v < mejor[1]:
            mejor = (f, v)
    return mejor


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--tornillo", type=Path, required=True)
    p.add_argument("--tuerca", type=Path, required=True)
    p.add_argument("--pitch", type=float, required=True)
    p.add_argument("--z-desde", type=float, required=True)
    p.add_argument("--z-hasta", type=float, required=True)
    # OJO: el paso de muestreo NO puede ser una fraccion simple del paso de rosca.
    # Con paso-z = pitch/2 los dos sentidos de giro caen exactamente en las mismas poses
    # (en z entero coinciden en fase, y en z+0,5 difieren en +pi vs -pi, que es lo mismo):
    # el control da 0 en los dos y queda CIEGO. Paso por defecto = pitch*0,137 (no aliasea).
    p.add_argument("--paso-z", type=float, default=None)
    p.add_argument("--gemelo", nargs=2, type=Path, metavar=("TORNILLO0", "TUERCA0"),
                   help="par SIN holgura, para probar que el control sabe dar rojo")
    p.add_argument("--tol-mm3", type=float, default=1.0,
                   help="interferencia maxima aceptable en la posicion enroscada")
    p.add_argument("--json", type=Path)
    a = p.parse_args(argv)

    if a.paso_z is None:
        a.paso_z = a.pitch * 0.137
    from fractions import Fraction
    den = Fraction(a.paso_z / a.pitch).limit_denominator(24).denominator
    if den <= 8:
        print(f"AVISO: paso-z/pitch = 1/{den} aliasea con la helice; el control puede quedar ciego",
              file=sys.stderr)

    t, n = _load(a.tornillo), _load(a.tuerca)
    rep = {"malla": {
        "tornillo": {"watertight": bool(t.is_watertight), "volumen_mm3": round(float(t.volume), 1),
                     "caras": int(len(t.faces))},
        "tuerca": {"watertight": bool(n.is_watertight), "volumen_mm3": round(float(n.volume), 1),
                   "caras": int(len(n.faces))}}}

    def evaluar(tt, nn, etiqueta):
        res = {}
        for signo, nom in ((+1, "sentido_correcto"), (-1, "sentido_invertido")):
            fase, _ = afinar_fase(tt, nn, a.pitch, a.z_desde, signo)
            br = barrido(tt, nn, a.pitch, a.z_desde, a.z_hasta, a.paso_z, fase0=fase, signo=signo)
            v = [x[2] for x in br]
            res[nom] = {
                "fase_deg": round(float(np.degrees(fase)), 2),
                "n_posiciones": len(br),
                "interferencia_max_mm3": round(float(np.nanmax(v)), 4),
                "interferencia_media_mm3": round(float(np.nanmean(v)), 4),
                "peor_z_mm": round(float(br[int(np.nanargmax(v))][0]), 2),
            }
        # el sentido bueno es el de menor interferencia; se reporta cual gano
        res["gana"] = min(("sentido_correcto", "sentido_invertido"),
                          key=lambda k: res[k]["interferencia_max_mm3"])
        rep[etiqueta] = res
        return res

    par = evaluar(t, n, "enroscado")
    bueno = par[par["gana"]]["interferencia_max_mm3"]
    malo = par["sentido_invertido" if par["gana"] == "sentido_correcto"
               else "sentido_correcto"]["interferencia_max_mm3"]

    ok = bueno <= a.tol_mm3
    # si girar al reves interfiere IGUAL que girar bien, la tuerca no esta engranando:
    # el control no distingue nada y no sirve como evidencia
    ciego_sentido = not (malo > max(5 * max(bueno, 1e-6), a.tol_mm3))

    ciego_gemelo = False
    if a.gemelo:
        t0, n0 = _load(a.gemelo[0]), _load(a.gemelo[1])
        g = evaluar(t0, n0, "gemelo_sin_holgura")
        gv = g[g["gana"]]["interferencia_max_mm3"]
        ciego_gemelo = not (gv > max(5 * max(bueno, 1e-6), a.tol_mm3))

    rep["control_ciego"] = {"por_sentido": bool(ciego_sentido), "por_gemelo": bool(ciego_gemelo)}
    ciego = ciego_sentido or ciego_gemelo
    rep["veredicto"] = "VERDE" if (ok and not ciego) else ("CONTROL CIEGO" if ciego else "ROJO")
    txt = json.dumps(rep, indent=2, ensure_ascii=False)
    print(txt)
    if a.json:
        a.json.write_text(txt, encoding="utf-8")
    return 0 if rep["veredicto"] == "VERDE" else 1


if __name__ == "__main__":
    sys.exit(main())
