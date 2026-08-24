# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_giro.py --help
"""GATE 5 — TRAYECTORIA: que el conjunto no choque DURANTE el giro, no solo al final.

Por que existe (auditoria del 2026-08-24): los seis gates que habia miran UNA pose. El
propio SKILL.md lo declaraba como clase abierta: "todos miran la posicion final, no el
recorrido". Un dispositivo giratorio no falla en la pose de carga: falla a 137 grados,
con la maquina ya armada y el perfil ya comprado.

    gate_giro.py --step conjunto.step --eje-punto 0,0,1050 --eje-dir 1,0,0 \
                 --moviles 12,13,14,28 --paso 5 --luz-min 40 --workdir W --render

Que hace: gira los solidos --moviles alrededor del eje, paso a paso, y mide la distancia
minima contra los --fijos (por defecto, todos los demas). Devuelve la CURVA d(angulo)
entera, no un numero: el angulo peor y la luz que queda ahi son el resultado.

Distingue tres cosas, porque no son lo mismo:
    CHOCA        el movil METE material en el fijo (puntos adentro) -> FALLA
    ROZA         d < --luz-min pero no penetra                      -> FALLA
    LIBRE        d >= --luz-min en las 360 vueltas                  -> OK

Par sintetico BIEN/MAL en CADA corrida (barra que gira libre vs barra con un poste en el
camino a 180 grados). Si no los separa, sale con codigo 3 y NO juzga la pieza real: un
control que no puede dar rojo no es un control.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import envcheck, geom, render, workdir  # noqa: E402

import numpy as np  # noqa: E402

try:                                   # sin esto una corrida larga no imprime NADA hasta
    sys.stdout.reconfigure(line_buffering=True)   # el final: la primera version se colgo
except AttributeError:                 # 11 min y no se supo en que paso estaba
    pass

OK, FALLA, AUTOTEST_ROTO = 0, 1, 3


# =====================================================================================
# nucleo
# =====================================================================================
def _puntos(tris):
    """Vertices + centroides de cada triangulo. Los centroides tapan el hueco que deja
    una malla gruesa: dos caras planas enfrentadas se tocan por el medio, no por los
    vertices, y una nube de solo vertices no lo ve."""
    v = tris.reshape(-1, 3)
    c = tris.mean(axis=1)
    return np.vstack([v, c])


def _decimar(pts, celda):
    """Un punto por celda de una grilla regular. Deterministico (no aleatorio) y conserva
    la cobertura: quedarse con N puntos al azar puede borrar justo el dedo que choca.

    Devuelve tambien la celda usada, porque ES la incertidumbre del resultado: la distancia
    medida entre dos nubes decimadas puede sobrestimar la real hasta ~celda.
    """
    k = np.floor(pts / celda).astype(np.int64)
    _, idx = np.unique(k, axis=0, return_index=True)
    return pts[np.sort(idx)]


def _frame(eje_dir):
    w = np.asarray(eje_dir, dtype=float)
    n = np.linalg.norm(w)
    if n < 1e-9:
        raise SystemExit("--eje-dir es un vector nulo")
    w = w / n
    a = np.array([1.0, 0.0, 0.0]) if abs(w[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = np.cross(w, a)
    u /= np.linalg.norm(u)
    v = np.cross(w, u)
    return u, v, w


def barrido(pts_movil, pts_fijo, eje_punto, eje_dir, paso_deg, luz_min):
    """Devuelve (angulos, d_min por angulo, indice del peor).

    Rota la nube movil alrededor del eje y mide contra un cKDTree de la fija. La
    rotacion se hace en el plano (u,v) del eje: z a lo largo del eje no cambia nunca,
    asi que no hace falta rehacer la matriz en cada paso.
    """
    from scipy.spatial import cKDTree
    p0 = np.asarray(eje_punto, dtype=float)
    u, v, w = _frame(eje_dir)

    rel = pts_movil - p0
    z = rel @ w                      # coordenada a lo largo del eje (invariante)
    a = rel @ u
    b = rel @ v                      # coordenadas en el plano de giro

    tree = cKDTree(pts_fijo)
    angs = np.arange(0.0, 360.0, paso_deg)
    dmin = np.empty(len(angs))
    for i, ang in enumerate(angs):
        t = np.radians(ang)
        ca, sa = np.cos(t), np.sin(t)
        ar, br = a * ca - b * sa, a * sa + b * ca
        pts = p0 + np.outer(ar, u) + np.outer(br, v) + np.outer(z, w)
        d, _ = tree.query(pts, k=1)
        dmin[i] = d.min()
    return angs, dmin, int(np.argmin(dmin))


def _rotar(pts, eje_punto, eje_dir, ang_deg):
    p0 = np.asarray(eje_punto, dtype=float)
    u, v, w = _frame(eje_dir)
    rel = pts - p0
    z, a, b = rel @ w, rel @ u, rel @ v
    t = np.radians(ang_deg)
    ca, sa = np.cos(t), np.sin(t)
    return p0 + np.outer(a * ca - b * sa, u) + np.outer(a * sa + b * ca, v) + np.outer(z, w)


def _clasificar(dmin, luz_min, resolucion=0.0):
    """(veredicto, d_peor, caida) — y separa lo ESTATICO de lo que causa el giro.

    Una luz que no cambia con el angulo (una brida a 1 mm de su rodamiento) no es un
    problema de trayectoria: es un problema de la pose de reposo, y lo mira
    check_collision. Si se la mete en la misma bolsa TAPA la señal del giro — paso en la
    primera corrida real: 0,00 mm en los 72 angulos, indistinguible de un choque.

    La firma de un problema de giro es una CAIDA de la curva: d_max - d_min > resolucion.
    """
    peor = float(dmin.min())
    caida = float(dmin.max() - dmin.min())
    if peor >= luz_min:
        return "LIBRE", peor, caida
    if caida <= max(resolucion, 1e-6):
        return "ESTATICO", peor, caida
    if peor < max(resolucion, 1e-6):
        return "CHOCA", peor, caida
    return "ROZA", peor, caida


# =====================================================================================
# autotest: par sintetico BIEN / MAL
# =====================================================================================
def _autotest(paso, _luz_min_usuario=None):
    """Barra que gira: libre en un caso, con un poste en el camino en el otro.

    Los dos postes estan al MISMO radio y en el MISMO angulo (90 grados). El del caso BIEN
    esta corrido a lo largo del EJE, donde la barra no llega nunca. Asi, **en la pose de
    carga los dos dan LIBRE**: solo mirar la vuelta entera los separa, que es exactamente
    la capacidad que este gate dice tener.

    Umbral propio (no el del usuario): un autotest que cambia de resultado segun con que
    --luz-min lo llamen no es un autotest.
    """
    luz_min = 20.0
    envcheck.require(("trimesh",))
    import cadquery as cq
    import tempfile

    d = tempfile.mkdtemp(prefix="gate_giro_autotest_")
    eje_punto, eje_dir = (0.0, 0.0, 0.0), (0.0, 0.0, 1.0)

    barra = cq.Workplane("XY").box(200, 20, 20).val()        # gira sobre Z, alcance r=100
    # mismo radio y mismo angulo; el de BIEN corrido 100 mm a lo largo del eje Z
    lejos = cq.Workplane("XY").box(20, 20, 20).translate((0, 90, 100)).val()
    cerca = cq.Workplane("XY").box(20, 20, 20).translate((0, 90, 0)).val()

    def corre(fijo, nombre):
        f = os.path.join(d, nombre + ".step")
        cq.exporters.export(cq.Compound.makeCompound([fijo]), f)
        fb = os.path.join(d, nombre + "_barra.step")
        cq.exporters.export(barra, fb)
        pm = _puntos(geom.step_to_tris(fb, lc=5.0))
        pf = _puntos(geom.step_to_tris(f, lc=5.0))
        _, dm, _ = barrido(pm, pf, eje_punto, eje_dir, paso, luz_min)
        v, p, _c = _clasificar(dm, luz_min)
        return (v, p), float(dm[0])

    (vb, db), d0b = corre(lejos, "BIEN")
    (vm, dm_), d0m = corre(cerca, "MAL")
    print("AUTOTEST del gate de giro (los dos postes a 90 grados; el de BIEN, corrido "
          "sobre el eje)")
    print("    BIEN (poste fuera del plano) -> %-8s d_min en todo el giro = %.2f mm"
          % (vb, db))
    print("    MAL  (poste en el camino)    -> %-8s d_min en todo el giro = %.2f mm"
          % (vm, dm_))
    print("    valor gemelo: en la POSE DE CARGA los dos estan libres (%.1f y %.1f mm "
          "contra %.0f exigidos)." % (d0b, d0m, luz_min))
    print("    Un gate que mire solo esa pose no puede separarlos. Este los separa.")
    if vb == "LIBRE" and vm in ("CHOCA", "ROZA"):
        print("  [AUTOTEST OK] separa un choque que solo existe a mitad del giro.\n")
        return True
    print("  [AUTOTEST ROTO] no separa el par. No juzgo la pieza real.\n")
    return False


# =====================================================================================
def _tags(txt):
    return [int(x) for x in txt.replace(" ", "").split(",") if x]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step", required=True, help="STEP del conjunto (movil + fijo)")
    ap.add_argument("--moviles", required=True, help="tags de los solidos que GIRAN, ej: 12,13,28")
    ap.add_argument("--fijos", default=None, help="tags fijos (default: todos los demas)")
    ap.add_argument("--eje-punto", required=True, help="x,y,z de un punto del eje de giro")
    ap.add_argument("--eje-dir", required=True, help="dx,dy,dz direccion del eje")
    ap.add_argument("--paso", type=float, default=5.0, help="paso angular en grados (%(default)s)")
    ap.add_argument("--luz-min", type=float, default=20.0,
                    help="luz minima exigida en TODO el giro, mm (%(default)s)")
    ap.add_argument("--lc", type=float, default=geom.LC_PREVIEW, help="malla (%(default)s)")
    ap.add_argument("--celda", type=float, default=None,
                    help="resolucion de la nube en mm (default: luz-min/6, acotado a 0,5-8). "
                         "ES la incertidumbre del resultado y ademas acota el costo: sin "
                         "decimar, una base de 620x480 con lc=3 da millones de puntos y el "
                         "barrido no termina (paso el 24/08: 11 min sin un solo numero).")
    ap.add_argument("--workdir", default=None)
    ap.add_argument("--render", action="store_true", help="curva d(angulo) en renders/")
    ap.add_argument("--saltear-autotest", action="store_true",
                    help="NO usar salvo para depurar el autotest mismo")
    args = ap.parse_args()

    if not args.saltear_autotest and not _autotest(max(args.paso, 10.0)):
        return AUTOTEST_ROTO

    por_solido = geom.step_to_tris(args.step, lc=args.lc, per_solid=True)
    disponibles = sorted(por_solido)
    mov = _tags(args.moviles)
    falta = [t for t in mov if t not in por_solido]
    if falta:
        raise SystemExit("--moviles: no existen los tags %s. Hay: %s" % (falta, disponibles))
    fij = _tags(args.fijos) if args.fijos else [t for t in disponibles if t not in mov]
    if not fij:
        raise SystemExit("No queda ningun solido fijo contra el cual medir.")

    celda = args.celda if args.celda else min(8.0, max(0.5, args.luz_min / 6.0))
    pm0 = _puntos(np.vstack([por_solido[t][0] for t in mov]))
    pf0 = _puntos(np.vstack([por_solido[t][0] for t in fij]))
    pm, pf = _decimar(pm0, celda), _decimar(pf0, celda)
    p0 = [float(x) for x in args.eje_punto.split(",")]
    dirv = [float(x) for x in args.eje_dir.split(",")]

    print("pieza: %s" % os.path.basename(args.step))
    print("  solidos: %d moviles %s | %d fijos %s" % (len(mov), mov, len(fij), fij))
    print("  nube: moviles %d -> %d pts | fijos %d -> %d pts  (malla lc=%.1f, decimada a "
          "celda %.2f mm)" % (len(pm0), len(pm), len(pf0), len(pf), args.lc, celda))
    print("  eje: punto %s direccion %s | paso %.1f grados | luz exigida %.1f mm"
          % (p0, dirv, args.paso, args.luz_min))

    if celda > args.luz_min / 4.0:
        print("  AVISO: la celda (%.2f) es mas de un cuarto de la luz exigida (%.2f). "
              "Bajar --celda." % (celda, args.luz_min))
    print("  barriendo %d poses..." % int(round(360.0 / args.paso)))
    angs, dmin, i_peor = barrido(pm, pf, p0, dirv, args.paso, args.luz_min)
    veredicto, peor, caida = _clasificar(dmin, args.luz_min, resolucion=celda)
    ang_peor = float(angs[i_peor])

    print("\nCURVA d(angulo) — luz minima a lo largo de la vuelta")
    for i in range(0, len(angs), max(1, len(angs) // 24)):
        marca = "  <== PEOR" if i == i_peor else ""
        print("   %6.1f deg   %8.2f mm%s" % (angs[i], dmin[i], marca))
    malos = angs[dmin < args.luz_min]
    print("\n  resolucion de la medicion: +/- %.2f mm (la celda de decimacion)" % celda)
    print("  en la pose de carga (0 grados) la luz es %.2f mm" % dmin[0])
    print("  PEOR: %.2f mm a %.1f grados" % (peor, ang_peor))
    print("  CAIDA por girar: %.2f mm (max %.2f - min %.2f). Esta es la cuenta del gate:"
          % (caida, dmin.max(), dmin.min()))
    print("  si la curva es PLANA, la luz chica ya estaba en reposo y el giro no la causa.")
    if len(malos):
        print("  angulos por debajo de la luz exigida (%d de %d): %s"
              % (len(malos), len(angs), ", ".join("%.0f" % a for a in malos[:20])
                 + (" ..." if len(malos) > 20 else "")))

    if args.render:
        envcheck.require(("matplotlib",))
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        w = workdir.ensure_workdir(args.workdir) if args.workdir else "."
        out = os.path.join(w, "renders", "giro_%s.png"
                           % os.path.splitext(os.path.basename(args.step))[0])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(angs, dmin, "-", lw=1.6, color="#2b6cb0")
        ax.axhline(args.luz_min, ls="--", color="#c53030",
                   label="luz exigida %.1f mm" % args.luz_min)
        ax.plot([ang_peor], [peor], "o", color="#c53030")
        ax.annotate("%.2f mm @ %.0f deg" % (peor, ang_peor), (ang_peor, peor),
                    textcoords="offset points", xytext=(8, 8), color="#c53030")
        ax.set_xlabel("angulo de giro [grados]")
        ax.set_ylabel("luz minima al conjunto fijo [mm]")
        ax.set_title("%s — %s" % (os.path.basename(args.step), veredicto))
        ax.set_xlim(0, 360)
        ax.grid(alpha=0.3)
        ax.legend(loc="best", fontsize=8)
        fig.tight_layout()
        fig.savefig(out, dpi=130)
        plt.close(fig)
        print("\n  curva -> %s   (MIRARLA, no alcanza con el numero)" % out)

    if args.workdir:
        w = workdir.ensure_workdir(args.workdir)
        workdir.record_evidence(
            w, "giro_check", step=os.path.basename(args.step),
            step_firma=workdir.file_signature(args.step),
            moviles=mov, fijos=fij, eje_punto=p0, eje_dir=dirv,
            paso=args.paso, luz_min=args.luz_min, celda=celda, lc=args.lc,
            caida=round(caida, 3),
            d_min=round(peor, 3), ang_peor=ang_peor, d_en_carga=round(float(dmin[0]), 3),
            n_angulos_malos=int(len(malos)), veredicto=veredicto, ok=(veredicto == "LIBRE"))

    print("\nVEREDICTO: %s" % veredicto)
    if veredicto == "LIBRE":
        return OK
    if veredicto == "ESTATICO":
        print("  La luz es de %.2f mm y NO cambia al girar (caida %.2f mm): el giro no es la"
              % (peor, caida))
        print("  causa. Esto es una interferencia de la pose de reposo -> check_collision.py.")
        print("  El gate de giro no lo juzga: no es su pregunta.")
        return FALLA
    print("  Un conjunto que roza o choca A MITAD del giro pasa TODOS los demas gates:")
    print("  check_collision y gate_ensamble miran UNA pose, y a 0 grados esto da %.2f mm."
          % dmin[0])
    print("  Corregir antes de comprar un solo perfil.")
    return FALLA


if __name__ == "__main__":
    sys.exit(main())
