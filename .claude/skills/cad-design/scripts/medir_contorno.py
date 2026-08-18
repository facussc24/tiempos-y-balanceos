"""Contorno REAL de una abertura, con la NORMAL de pared en cada punto — para que un
postizo la siga ENTERA.

POR QUE EXISTE (virolador Upper Trim, 2026-08-18)
-------------------------------------------------
El macho eran dos nervios RECTOS de 40 mm dentro de una ranura que medía 53,67 con las
puntas redondeadas: quedaban 6,5 mm por punta SIN NADA que apretara. Fak lo vio abriendo
el ensamble: "¿por qué en esos bordes no se pone nada? ¿ahí cómo planeás que se virole?".

Y no alcanzaba con estirar los nervios: **el eje de la abertura no era recto** (el centro
se corría 3 mm a lo largo, porque la cara del panel estaba a 25,6°). Un postizo se
dimensiona contra el CONTORNO MEDIDO completo, no contra "ancho × largo".

QUE DEVUELVE Y POR QUE ASI
--------------------------
JSON con, por cada centro pedido:
  - `pts`  : el contorno a la altura dada, remuestreado POR LONGITUD DE ARCO — no por
             ángulo: las puntas de una ranura alargada subtienden muy poco ángulo y
             quedarían con 3 puntos justo donde más definición hace falta.
  - `nrm`  : la normal de la PARED en cada punto, apuntando hacia afuera. El postizo se
             construye restando el retiro A LO LARGO DE ESA NORMAL (luz constante
             perpendicular a la pared). Retirar radialmente deja el postizo torcido donde
             el rayo llega oblicuo, y el apriete sale distinto en cada punto.
  - descarta rayos que llegan rasantes (|cos| < 0,25): ahí la normal no es confiable y el
    punto lo cubren los vecinos. Aborta si impacta < 50 % de los rayos (medición inválida,
    p. ej. el origen no está dentro de la abertura).

El sólido con el contorno se levanta con `addThruSections(..., makeRuled=True)` —
**el default (spline) SE ABOMBA entre secciones** y el postizo queda metido en la pared
(medido: 0,05 mm adentro donde se pedían 0,09 de luz).

USO
    medir_contorno.py <pieza.step> --z <altura_del_corte> --centro x,y [--centro x,y ...]
                      [--frame frame.json] [--rayos 3600] [--n-salida 240] [--json out.json]

Con --frame, la pieza se lleva primero al marco local (origen+ex/ey/ez del json, formato
gate_frame.py) y las alturas/centros se dan en ese marco.
"""
import argparse
import json
import sys

import numpy as np

from cadlib import envcheck, geom

envcheck.require(("trimesh", "numpy"))
import trimesh  # noqa: E402


def contorno(m, cx, cy, z, n_rayos, n_salida):
    ang = np.linspace(0, 2 * np.pi, n_rayos, endpoint=False)
    org = np.tile([cx, cy, z], (n_rayos, 1))
    dirs = np.column_stack([np.cos(ang), np.sin(ang), np.zeros_like(ang)])
    pos, idx_ray, idx_tri = m.ray.intersects_location(org, dirs, multiple_hits=False)
    pct = 100.0 * len(pos) / n_rayos
    if pct < 50.0:
        raise SystemExit("[ABORTA] solo %.0f%% de los rayos impacto en (%.2f, %.2f, z=%.2f): "
                         "medicion invalida — ¿el centro esta dentro de la abertura?"
                         % (pct, cx, cy, z))
    nrm = m.face_normals[idx_tri]
    n2 = nrm[:, :2].copy()
    ln = np.linalg.norm(n2, axis=1)
    ok = ln > 1e-9
    pos, n2, ln, ang_ok = pos[ok], n2[ok], ln[ok], ang[idx_ray[ok]]
    n2 = n2 / ln[:, None]
    hacia = pos[:, :2] - np.array([cx, cy])
    hacia = hacia / np.maximum(np.linalg.norm(hacia, axis=1), 1e-9)[:, None]
    cos = np.sum(n2 * hacia, axis=1)
    n2[cos < 0] *= -1
    rasante = np.abs(cos) < 0.25
    pos, n2, ang_ok = pos[~rasante], n2[~rasante], ang_ok[~rasante]
    o = np.argsort(ang_ok)
    pts, nn = pos[o][:, :2], n2[o]
    d = np.linalg.norm(np.diff(np.vstack([pts, pts[:1]]), axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(d)])
    total = s[-1]
    su = np.linspace(0, total, n_salida, endpoint=False)
    ptsc, nnc = np.vstack([pts, pts[:1]]), np.vstack([nn, nn[:1]])
    out_p = np.column_stack([np.interp(su, s, ptsc[:, 0]), np.interp(su, s, ptsc[:, 1])])
    out_n = np.column_stack([np.interp(su, s, nnc[:, 0]), np.interp(su, s, nnc[:, 1])])
    out_n = out_n / np.maximum(np.linalg.norm(out_n, axis=1), 1e-9)[:, None]
    return out_p, out_n, float(total), pct


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step")
    ap.add_argument("--z", type=float, required=True, help="altura del plano de corte")
    ap.add_argument("--centro", action="append", required=True,
                    help="x,y de un punto INTERIOR de la abertura (repetible)")
    ap.add_argument("--frame", default=None,
                    help="frame.json (gate_frame.py) para medir en el marco local")
    ap.add_argument("--rayos", type=int, default=3600)
    ap.add_argument("--n-salida", type=int, default=240)
    ap.add_argument("--lc", type=float, default=0.3)
    ap.add_argument("--caras-libres", action="store_true",
                    help="incluir caras sueltas (OJO: pueden ser una CAPA, no la pared — "
                         "regla A0b del virolador; medir de las dos formas ante la duda)")
    ap.add_argument("--json", default=None)
    a = ap.parse_args()

    m = geom.step_to_trimesh(a.step, lc=a.lc, require_watertight=False,
                             caras_libres=a.caras_libres)
    if a.frame:
        F = json.load(open(a.frame, encoding="utf-8"))
        MR = np.column_stack([np.array(F[k]) for k in ("ex", "ey", "ez")])
        ORI = np.array(F["origen"])
        m = trimesh.Trimesh(vertices=(MR.T @ (m.vertices - ORI).T).T, faces=m.faces,
                            process=False)

    salida = {}
    for c in a.centro:
        cx, cy = (float(v) for v in c.split(","))
        pts, nn, per, pct = contorno(m, cx, cy, a.z, a.rayos, a.n_salida)
        print("centro (%.2f, %.2f): perimetro %.2f mm | largo %.2f x ancho %.2f | "
              "%d pts | %.0f%% de rayos utiles"
              % (cx, cy, per, pts[:, 0].max() - pts[:, 0].min(),
                 pts[:, 1].max() - pts[:, 1].min(), len(pts), pct))
        salida["%.3f,%.3f" % (cx, cy)] = {
            "centro": [cx, cy], "z": a.z, "perimetro": round(per, 3),
            "pts": pts.round(4).tolist(), "nrm": nn.round(5).tolist()}

    if a.json:
        json.dump({"step": a.step, "z": a.z, "rayos": a.rayos,
                   "_": "contorno de la pared de una abertura + normal hacia AFUERA por "
                        "punto. El postizo se construye restando el retiro a lo largo de "
                        "la normal, con addThruSections(..., makeRuled=True).",
                   "aberturas": salida},
                  open(a.json, "w", encoding="utf-8"), indent=1)
        print("-> %s" % a.json)


if __name__ == "__main__":
    main()
