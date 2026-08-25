"""Gancho DOBLE — el diseño del gerente: mismo clip sobre la pata, un gancho de cada lado.

Croquis del gerente de Fak, 24/08/2026. Su dibujo es la vista EN PLANTA: el rectangulo de
adentro es la boca con la pata metida, y los dos brazos salen a los costados.

EL PROBLEMA QUE HABIA QUE RESOLVER, Y COMO SE RESUELVE:
el v2 agarra por el momento DESEQUILIBRADO del peso — bascula dentro del juego y muerde la
pata. Con dos mochilas iguales ese momento se anula, la normal va a cero y la friccion
tambien: poniendole dos brazos y nada mas, la pieza se cae.

La salida no es cambiar de lugar, es cambiar de MECANISMO: la boca va **CONICA**, mas
angosta abajo. El peso empuja la pieza hacia abajo, la boca se cierra sobre la pata y
aprieta. Mas peso = mas apriete, venga de un lado o de los dos. Y se saca levantandola.

    traba sola  <=>  semiangulo del cono < arctan(mu)
    2,05 grados  <  16,7 grados        (2 mm de conicidad en 28 mm de alto, mu = 0,30)

De yapa, el cono ABSORBE la incertidumbre de la cota: agarra en cualquier espesor entre
26,6 y 28,6, asi que ya no hacen falta testigos de boca. Y absorbe que la pata sea conica
—el calibre dio 30,68 mas abajo y arriba mide ~27,2—, que es justamente lo que hizo que al
v1 le sobraran 3-4 mm.

Frame (el mismo para uso y para impresion — no hay que girar nada en el laminador):
    X = profundidad, a lo largo del ancho de la pata. Lomo en X<0, alas hacia +X.
    Y = espesor de la pata. Un brazo sale a +Y y el otro a -Y.
    Z = vertical. Z=0 es la cama, y es tambien donde la boca es MAS ANGOSTA.

Uso:
    .venv-cad\\Scripts\\python.exe build_gancho_doble.py --out <workdir>
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from build123d import (
    Axis,
    Box,
    Cylinder,
    Plane,
    Polygon,
    Pos,
    export_step,
    export_stl,
    extrude,
    fillet,
    mirror,
)

AQUI = Path(__file__).parent


def caja(x0, x1, y0, y1, z0, z1):
    return Pos((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) * Box(x1 - x0, y1 - y0, z1 - z0)


def aristas_en(solido, eje, **cerca):
    tol = cerca.pop("tol", 0.7)
    fuera = []
    for e in solido.edges().filter_by(eje):
        c = e.center()
        if all(abs(getattr(c, k.upper()) - val) < tol for k, val in cerca.items()):
            fuera.append(e)
    return fuera


def redondear(solido, aristas, radio, etiqueta, avisos):
    if not aristas:
        avisos.append(f"NO SE ENCONTRARON aristas para '{etiqueta}' (R{radio})")
        return solido
    try:
        return fillet(aristas, radius=radio)
    except Exception as exc:  # noqa: BLE001
        avisos.append(f"FALLO el radio '{etiqueta}' R{radio}: {exc}")
        return solido


def derivadas(p):
    """Cotas que dependen de otras y por eso NO se escriben.

    El 24/08, en el v2, `y_raiz` habia quedado como literal de una boca anterior: el brazo
    salio 1,75 mm separado del ala y la pieza se partio en dos solidos. No se repite.
    """
    c = p["clip"]
    return {
        # el brazo nace de la cara externa del ala, y la interna es CONICA: se toma el punto
        # mas ancho (arriba) para que el brazo pegue contra el ala en toda su altura
        "y_raiz": c["boca_arriba"] / 2.0 + c["e_ala"],
        "x0": -c["e_lomo"],
        "ancho_X": c["e_lomo"] + c["p_ala"],
        "a_centro_carga": p["brazo"]["y_fondo"] - p["nariz"]["r_fondo_gancho"],
        "semiangulo_cono_deg": math.degrees(
            math.atan((c["boca_arriba"] - c["boca_abajo"]) / 2.0 / c["h_clip"])
        ),
    }


def cuentas(p):
    d = derivadas(p)
    c = p["clip"]
    P = p["carga"]["P_N"]
    mu = p["carga"]["mu"]

    alpha = d["semiangulo_cono_deg"]
    autobloqueo = math.degrees(math.atan(mu))

    # Para sostener el peso por friccion en las dos caras hace falta esta normal. La cuña la
    # genera bajando; lo que importa es que el cono TRABE (alpha < arctan mu), no cuanto baja.
    N_para_2_mochilas = 2 * P / (2 * mu)
    area = c["p_ala"] * c["h_clip"] * 0.6  # apoya ~60% de la cara al asentar el cono
    presion = N_para_2_mochilas / area

    # flexion del brazo en la raiz
    M = P * (d["a_centro_carga"] - d["y_raiz"])
    W = d["ancho_X"] * p["brazo"]["z_raiz"] ** 2 / 6.0
    sigma = M / W

    # el lomo toma el par de las dos alas cuando la cuña aprieta: torsion de seccion delgada
    largo_lomo = c["boca_arriba"] + 2 * c["e_ala"]
    J = largo_lomo * c["e_lomo"] ** 3 / 3.0
    tau = N_para_2_mochilas * c["h_clip"] * c["e_lomo"] / J

    return {
        "semiangulo_del_cono_deg": round(alpha, 2),
        "autobloqueo_arctan_mu_deg": round(autobloqueo, 2),
        "traba_sola": alpha < autobloqueo,
        "rango_de_espesor_que_agarra": f"{c['boca_abajo']} a {c['boca_arriba']} mm",
        "y_raiz_derivada": round(d["y_raiz"], 2),
        "a_derivado": round(d["a_centro_carga"], 2),
        "carga_total_2_mochilas_kg": round(2 * p["carga"]["P_kg_por_gancho"], 1),
        "N_necesaria_2_mochilas_N": round(N_para_2_mochilas, 1),
        "presion_sobre_la_pata_MPa": round(presion, 3),
        "sigma_brazo_MPa": round(sigma, 2),
        "SF_brazo_vs_PLA_60MPa": round(60.0 / sigma, 1),
        "tau_lomo_MPa": round(tau, 2),
        "SF_lomo_vs_corte_35MPa": round(35.0 / tau, 1),
        "garganta_del_gancho_mm": round(p["nariz"]["z_punta"] - p["brazo"]["z_fondo"], 1),
    }


def construir(p):
    avisos = []
    c, b, n, r = p["clip"], p["brazo"], p["nariz"], p["radios"]
    d = derivadas(p)
    h = c["h_clip"]
    ia, ib = c["boca_abajo"] / 2.0, c["boca_arriba"] / 2.0   # cara interna: abajo y arriba
    ye = ib + c["e_ala"]                                      # cara externa del ala

    # --- clip: lomo + dos alas con la cara interna INCLINADA (esa inclinacion ES el mecanismo)
    pieza = caja(-c["e_lomo"], 0.0, -ye, ye, 0.0, h)
    ala = extrude(
        Plane.YZ * Polygon((ia, 0.0), (ye, 0.0), (ye, h), (ib, h), align=None),
        amount=c["p_ala"],
    )
    pieza += ala
    pieza += mirror(ala, about=Plane.XZ)

    # --- los dos brazos. Se construye UNO y se espeja: extruir el perfil espejado a mano
    # invierte el sentido del contorno y el solido sale para el otro lado en X (el bbox se iba
    # a -42 en vez de -8). El espejo no tiene ese problema.
    pts = [
        (d["y_raiz"], 0.0),
        (n["y_punta_ext"], 0.0),
        (n["y_punta_ext"], n["z_punta"]),
        (b["y_fondo"], n["z_punta"]),
        (b["y_fondo"], b["z_fondo"]),
        (d["y_raiz"], b["z_raiz"]),
    ]
    brazo = Pos(d["x0"], 0, 0) * extrude(Plane.YZ * Polygon(*pts, align=None), amount=d["ancho_X"])
    pieza += brazo
    pieza += mirror(brazo, about=Plane.XZ)

    # --- radios
    for signo in (+1, -1):
        lado = "der" if signo > 0 else "izq"
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.X, y=signo * b["y_fondo"], z=b["z_fondo"]),
            n["r_fondo_gancho"], f"fondo del gancho {lado}", avisos,
        )
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.X, y=signo * d["y_raiz"], z=b["z_raiz"]),
            r["r_brazo_clip"], f"union brazo-clip {lado}", avisos,
        )
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.X, y=signo * n["y_punta_ext"], z=n["z_punta"])
            + aristas_en(pieza, Axis.X, y=signo * b["y_fondo"], z=n["z_punta"]),
            n["r_canto_externo"], f"punta de la nariz {lado}", avisos,
        )
        # alivio ala-lomo excavado, no fillet: un fillet ahi mete material DENTRO del canal
        # y choca contra el canto de la pata (pasó el 24/08 en el v1).
        pieza -= Pos(0.0, signo * ib, h / 2.0) * Cylinder(radius=r["r_ala_lomo"], height=h + 2)

    # --- entrada guiada por el canto, del lado por donde entra la pata
    ent = c["chaflan_entrada"]
    for signo in (+1, -1):
        tri = Plane.XY * Polygon(
            (c["p_ala"], signo * ib),
            (c["p_ala"] - ent, signo * ib),
            (c["p_ala"], signo * (ib + ent)),
            align=None,
        )
        pieza -= extrude(tri, amount=h)

    return pieza, avisos


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    ap.add_argument("--params", default=str(AQUI / "params_doble.json"))
    ap.add_argument(
        "--tal-cual",
        action="store_true",
        help="El dibujo de Leo TAL CUAL: boca RECTA, sin el cono. Es lo que el dibujo "
        "muestra; el cono es agregado mio. Con una sola mochila anda igual; con dos "
        "parejas el momento se anula y se suelta. Se entrega igual porque Fak lo pidio "
        "asi, a ver si funciona en la practica.",
    )
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    if args.tal_cual:
        recta = p["clip"]["boca_recta_tal_cual"]
        p["clip"]["boca_abajo"] = p["clip"]["boca_arriba"] = recta
        print("=" * 78)
        print("  MODO TAL CUAL: boca RECTA de %.2f, como el dibujo de Leo." % recta)
        print("  Con UNA mochila anda. Con DOS parejas el momento se anula y se suelta.")
        print("=" * 78)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("=== cuentas (recalculadas desde params) ===")
    num = cuentas(p)
    for k, v in num.items():
        print(f"  {k:32s} {v}")
    if not args.tal_cual and not num["traba_sola"]:
        raise SystemExit(
            f"ABORTA: el cono es de {num['semiangulo_del_cono_deg']}° y traba recien por debajo "
            f"de {num['autobloqueo_arctan_mu_deg']}°. Asi no agarra: achicar la conicidad."
        )
    c = p["clip"]
    if not args.tal_cual and c["boca_abajo"] >= c["boca_arriba"]:
        raise SystemExit("ABORTA: la boca tiene que ser MAS ANGOSTA ABAJO, si no el peso la afloja.")

    print("\n=== construyendo ===")
    pieza, avisos = construir(p)
    for a in avisos:
        print("  AVISO:", a)

    n_sol = len(pieza.solids())
    if n_sol != 1:
        raise SystemExit(f"ABORTA: la pieza salio en {n_sol} solidos sueltos.")

    bb = pieza.bounding_box()
    print(f"  bbox X[{bb.min.X:.2f},{bb.max.X:.2f}] Y[{bb.min.Y:.2f},{bb.max.Y:.2f}] "
          f"Z[{bb.min.Z:.2f},{bb.max.Z:.2f}]")
    print(f"  volumen {pieza.volume/1000:.2f} cm3")

    nombre = "gancho_doble_LEO_tal_cual" if args.tal_cual else "gancho_doble_v1"
    export_step(pieza, str(out / f"{nombre}.step"))
    export_stl(pieza, str(out / f"{nombre}.stl"), tolerance=0.01, angular_tolerance=0.1)
    num["volumen_cm3"] = round(pieza.volume / 1000, 3)
    (out / f"cuentas_{nombre}.json").write_text(json.dumps(num, indent=2), encoding="utf-8")
    print(f"\nlisto -> {out}")
    if avisos:
        raise SystemExit(f"HUBO {len(avisos)} AVISO(S) DE RADIO — revisar antes de imprimir")


if __name__ == "__main__":
    main()
