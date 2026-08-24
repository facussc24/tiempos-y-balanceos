"""GATE 3 del gancho: verificar el ARTEFACTO que se entrega, no el diseno.

Mide sobre el STL EXPORTADO (no sobre el modelo en memoria: eso seria medir la orden y
no el resultado) y contra un modelo del sustrato construido con la unica cota dura que
hay, t_pata = 30,68 mm.

Cada control trae su VALOR GEMELO: cuanto daria ese mismo numero si la falla estuviera
presente. Si el valor bueno y el gemelo se parecen, el control es ciego.

Uso:
    .venv-cad\\Scripts\\python.exe verificar_gancho.py --workdir <W>
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import trimesh

AQUI = Path(__file__).parent
OK, MAL = "OK  ", "MAL "


class Reporte:
    def __init__(self):
        self.filas = []
        self.rojo = False

    def add(self, nombre, valor, esperado, gemelo, ok):
        ok = bool(ok)
        self.filas.append((nombre, str(valor), str(esperado), str(gemelo), ok))
        if not ok:
            self.rojo = True

    def imprimir(self):
        print(f"\n{'control':38s} {'medido':>12s} {'esperado':>16s} {'si fallara':>16s}")
        print("-" * 88)
        for n, v, e, g, ok in self.filas:
            print(f"{OK if ok else MAL}{n:34s} {v:>12s} {e:>16s} {g:>16s}")
        print("-" * 88)


def caras_de_almohadilla(mesh, p):
    """Distancia entre las dos caras internas de las almohadillas, medida en la malla.

    Se mide donde SI hay almohadilla (no en la zona rebajada): X dentro del ala,
    Z en la mitad de cada almohadilla.
    """
    c = p["clip"]
    ha = c["h_almohadilla"]
    x = c["p_ala"] * 0.5
    z_inf = ha * 0.5              # almohadilla del ala +Y (abajo)
    z_sup = c["h_clip"] - ha * 0.5  # almohadilla del ala -Y (arriba)

    # rayo horizontal en +Y a la altura de la almohadilla de abajo -> primera cara que toca
    def primer_impacto(origen, direccion):
        loc, _, _ = mesh.ray.intersects_location(
            ray_origins=np.array([origen]), ray_directions=np.array([direccion])
        )
        if len(loc) == 0:
            return None
        d = np.linalg.norm(loc - np.array(origen), axis=1)
        return loc[np.argmin(d)]

    # desde el eje de la boca hacia +Y a la altura de la almohadilla de ABAJO
    a = primer_impacto([x, 0.0, z_inf], [0, 1, 0])
    # desde el eje hacia -Y a la altura de la almohadilla de ARRIBA
    b = primer_impacto([x, 0.0, z_sup], [0, -1, 0])
    return (a[1] if a is not None else None), (b[1] if b is not None else None)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--params", default=str(AQUI / "params.json"))
    ap.add_argument(
        "--stl",
        default=None,
        help="STL a verificar. Por defecto out/gancho_mochila_v1.stl del workdir, pero el "
        "que se ENTREGA lo re-tesela export_deliverables, asi que no es byte a byte el "
        "mismo archivo: apuntar aca a la copia entregada y correrlo de nuevo. Verificar el "
        "del workdir y entregar otro es medir la orden y no el resultado (cad-3d.md GATE 3).",
    )
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    W = Path(args.workdir)
    stl = Path(args.stl) if args.stl else W / "out" / "gancho_mochila_v2.stl"
    print(f"verificando: {stl}")
    mesh = trimesh.load(str(stl))
    rep = Reporte()

    t_pata = p["sustrato"]["t_pata"]
    boca_nom = p["clip"]["boca"]
    luz_nom = (boca_nom - t_pata) / 2.0

    # ---------------------------------------------------------------- C1 malla valida
    rep.add(
        "malla cerrada (watertight)",
        str(mesh.is_watertight),
        "True",
        "False si hay agujeros",
        bool(mesh.is_watertight),
    )
    # el esperado NO es un numero magico: sale del STEP que acaba de construir el build
    v_step = json.loads((W / "out" / "cuentas.json").read_text(encoding="utf-8"))[
        "volumen_gancho_cm3"
    ]
    rep.add(
        "STL coincide con el STEP (volumen)",
        f"{mesh.volume/1000:.2f} cm3",
        f"{v_step:.2f} +-1%",
        "0 o negativo si normales mal",
        abs(mesh.volume / 1000 - v_step) / v_step < 0.01,
    )

    # ------------------------------------------- C2 la boca llego al archivo exportado
    y_mas, y_menos = caras_de_almohadilla(mesh, p)
    if y_mas is None or y_menos is None:
        rep.add("boca medida en el STL", "sin impacto", f"{boca_nom}", "-", False)
        boca_real = float("nan")
    else:
        boca_real = y_mas - y_menos
        rep.add(
            "boca medida en el STL",
            f"{boca_real:.3f} mm",
            f"{boca_nom:.2f} +-0.10",
            f"{t_pata:.2f} si no se aplico el juego",
            abs(boca_real - boca_nom) < 0.10,
        )

    # ------------------------------------------------- C3 encaje contra el sustrato
    # La pata: prisma de t_pata de espesor. El lomo del clip topa contra su canto (X=0).
    Wp = p["sustrato"]["W_supuesto_para_verificar"]
    pata = trimesh.creation.box(
        extents=[Wp, t_pata, 300.0],
        transform=trimesh.transformations.translation_matrix([Wp / 2.0, 0.0, 0.0]),
    )

    # penetracion: puntos del gancho que caen DENTRO de la pata
    pts = mesh.sample(60000)
    dentro = pata.contains(pts)
    frac = dentro.sum() / len(pts)
    rep.add(
        "penetracion gancho/pata",
        f"{dentro.sum()} de {len(pts)}",
        "0",
        "~2% si la boca fuera 30.00",
        dentro.sum() == 0,
    )

    # ...pero "0 dentro" tambien lo da un gancho flotando a 60 mm. Hace falta el contacto.
    # OJO: la luz que importa es la de la BOCA (en Y). En X el lomo topa contra el canto de
    # la pata A PROPOSITO — ahi la distancia es 0 y eso es el tope, no un defecto. Por eso
    # se miden solo los puntos que estan dentro del canal (X > 0.5).
    prox = trimesh.proximity.ProximityQuery(pata)
    en_canal = pts[:, 0] > 0.5
    d = np.abs(prox.signed_distance(pts[en_canal]))
    d_min = float(d.min())
    rep.add(
        "luz de la boca (asienta, no aprieta)",
        f"{d_min:.3f} mm",
        f"{luz_nom:.2f} +-0.05",
        "2.16 si la boca fuera 35",
        abs(d_min - luz_nom) < 0.05,
    )
    rep.add(
        "el lomo topa contra el canto",
        f"{float(np.abs(prox.signed_distance(pts[~en_canal])).min()):.3f} mm",
        "0.000 (es el tope)",
        ">0 si no hubiera tope",
        float(np.abs(prox.signed_distance(pts[~en_canal])).min()) < 0.05,
    )

    # ------------------------------------- C4 el mecanismo: al bascular, MUERDE
    # Se rota el gancho alrededor de X el angulo que permite el juego y se comprueba que
    # el contacto aparece en las DOS almohadillas (arriba en -Y, abajo en +Y) y no antes
    # en otro lado. Si el mecanismo no existiera, al rotar no tocaria nada nuevo.
    # El SIGNO importa, y es la clase de error que ya costo cuatro veces (cad-3d.md GATE 2):
    # el peso cuelga en +Y, asi que hace BAJAR el lado +Y. Bajar el lado +Y es una rotacion
    # NEGATIVA alrededor de +X (la positiva lleva +Y hacia +Z). Se corre en los DOS sentidos:
    # el bueno tiene que morder y el espejado NO. Si los dos muerden, el control es ciego.
    c = p["clip"]
    theta = math.atan(c["juego_total"] / c["h_clip"])

    d_quieto = prox.signed_distance(pts[en_canal])  # >0 = adentro de la pata
    quietos = int((d_quieto > -0.02).sum())
    rep.add(
        "quieto NO muerde (hay juego)",
        f"{quietos} pts",
        "0",
        f">0 si la boca fuera {t_pata:.1f}",
        quietos == 0,
    )

    def contacto(signo):
        """Devuelve los puntos del canal que tocan la pata tras bascular `signo`*theta."""
        Rx = trimesh.transformations.rotation_matrix(
            signo * theta, [1, 0, 0], [0, 0, c["h_clip"] / 2.0]
        )
        g = mesh.copy()
        g.apply_transform(Rx)
        q = g.sample(200000)
        q = q[q[:, 0] > 0.5]  # solo lo que esta dentro del canal, no el lomo
        return q[prox.signed_distance(q) > -0.02]

    def morder(signo):
        Rx = trimesh.transformations.rotation_matrix(
            signo * theta, [1, 0, 0], [0, 0, c["h_clip"] / 2.0]
        )
        g = mesh.copy()
        g.apply_transform(Rx)
        q = g.sample(60000)
        q = q[q[:, 0] > 0.5]  # solo lo que esta dentro del canal, no el lomo
        toca = q[prox.signed_distance(q) > -0.02]
        if len(toca) == 0:
            return 0, 0
        z, y = toca[:, 2], toca[:, 1]
        return (
            int(((z > c["h_clip"] * 0.6) & (y < 0)).sum()),
            int(((z < c["h_clip"] * 0.4) & (y > 0)).sum()),
        )

    # EL control que faltaba, y el que hubiera cazado el error del 24/08: medir L sobre la
    # GEOMETRIA. Yo habia declarado L = distancia entre centros de almohadillas (26 mm) y la
    # geometria daba 40,7 -> a/L real 1,40 contra 1,67 exigido, o sea que RESBALABA. Los
    # controles de "muerde arriba / muerde abajo" daban verde igual: eran ciegos a esto.
    toca = contacto(-1)
    mu_r = p["carga"]["mu"]
    # a se DERIVA igual que en el build: no se lee de params (ahi ya no esta, justamente
    # porque estaba escrito 57 cuando el real era 54).
    a_carga = p["brazo"]["y_fondo"] - p["nariz"]["r_fondo_gancho"]
    exigido = 1.0 / (2.0 * mu_r)
    if len(toca) == 0:
        rep.add("L medido sobre la geometria", "sin contacto", "-", "-", False)
    else:
        z_mas = float(toca[toca[:, 1] > 0][:, 2].min())  # ala +Y apoya en su punto MAS BAJO
        z_men = float(toca[toca[:, 1] < 0][:, 2].max())  # ala -Y en el MAS ALTO
        L_real = z_men - z_mas
        rep.add("L medido sobre la geometria", f"{L_real:.1f} mm",
                f"{c['h_clip']:.1f} +-1.5", "40.7 con el clip de 40", 
                abs(L_real - c["h_clip"]) < 1.5)
        rep.add("a/L con el L REAL: no resbala", f"{a_carga / L_real:.2f}",
                f">= {exigido:.2f}", f"{a_carga / 40.7:.2f} con el clip de 40",
                a_carga / L_real >= exigido)

    am_ok, bm_ok = morder(-1)    # el sentido en que lo gira el peso
    am_esp, bm_esp = morder(+1)  # el espejado: gemelo

    rep.add("muerde arriba en el ala -Y", f"{am_ok} pts", ">50",
            f"{am_esp} al reves", am_ok > 50)
    rep.add("muerde abajo en el ala +Y", f"{bm_ok} pts", ">50",
            f"{bm_esp} al reves", bm_ok > 50)
    rep.add("el par tiene UN solo sentido", f"bueno {am_ok+bm_ok} / espejo {am_esp+bm_esp}",
            "espejo = 0", "iguales => ciego", (am_esp + bm_esp) == 0)

    # --------------------------------------- C5 imprimible: nada en voladizo, apoya en Z=0
    zmin = mesh.bounds[0][2]
    area_base = float(
        mesh.area_faces[
            (np.abs(mesh.triangles_center[:, 2] - zmin) < 0.15)
            & (mesh.face_normals[:, 2] < -0.9)
        ].sum()
    )
    rep.add(
        "apoya en la cama (Z=0)",
        f"{zmin:.3f} mm",
        "0.000",
        "!=0 si quedo flotando",
        abs(zmin) < 0.01,
    )
    rep.add(
        "huella de primera capa",
        f"{area_base:.0f} mm2",
        ">700",
        "<200 se despega",
        area_base > 700,
    )

    rep.imprimir()
    (W / "verificacion.json").write_text(
        json.dumps(
            {n: {"medido": v, "esperado": e, "gemelo": g, "ok": ok} for n, v, e, g, ok in rep.filas},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    if rep.rojo:
        raise SystemExit("HAY CONTROLES EN ROJO — no se entrega")
    print("todos los controles en verde")


if __name__ == "__main__":
    main()
