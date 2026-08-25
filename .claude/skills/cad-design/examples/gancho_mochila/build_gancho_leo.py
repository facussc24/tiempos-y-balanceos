"""EL DISEÑO DE LEO, tal cual su croquis — Pi sobre el tope del caño + una cuna de cada lado.

Croquis a mano de Leonardo Lattanzi, 24/08/2026.

COMO SE SOSTIENE (y por que este SI lleva dos mochilas):
la barra de arriba APOYA sobre la cara superior del caño. El peso baja por compresion
contra ese tope — no hay friccion en juego, no hay nada que apretar. Por eso le da lo
mismo una mochila que dos.
Las dos paredes laterales solo tienen que impedir que la pieza vuelque cuando cuelga UNA
sola: N = P*a / alto_pared. Y con las dos mochilas puestas, ni eso — se contrapesan.

Es exactamente lo contrario del v2, que agarra por el momento DESEQUILIBRADO del peso y
por eso no admite version simetrica.

La pieza es una EXTRUSION pura del perfil de frente: cero soportes, y se calza deslizandola
sobre el extremo del caño.

    u = horizontal, transversal al caño (el espesor de 27,2 va aca)
    v = vertical. v=0 es la cama de la impresora y la cara de abajo de las cunas
    w = profundidad, a lo largo de la cara ancha del caño = ancho de la pieza

Uso:
    .venv-cad\\Scripts\\python.exe build_gancho_leo.py --out <workdir>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build123d import (
    Axis,
    Plane,
    Pos,
    Polygon,
    export_step,
    export_stl,
    extrude,
    fillet,
)

AQUI = Path(__file__).parent


def redondear(solido, aristas, radio, etiqueta, avisos):
    if not aristas:
        avisos.append(f"NO SE ENCONTRARON aristas para '{etiqueta}' (R{radio})")
        return solido
    try:
        return fillet(aristas, radius=radio)
    except Exception as exc:  # noqa: BLE001
        avisos.append(f"FALLO el radio '{etiqueta}' R{radio}: {exc}")
        return solido


def aristas_en(solido, eje, **cerca):
    tol = cerca.pop("tol", 0.7)
    return [
        e for e in solido.edges().filter_by(eje)
        if all(abs(getattr(e.center(), k.upper()) - v) < tol for k, v in cerca.items())
    ]


def derivadas(p):
    """Todo lo que depende de otra cota se calcula. Nada de literales sueltos."""
    boca, pared = p["cano"]["boca"], p["pi"]["pared"]
    U = boca / 2.0 + pared                        # cara exterior de la pared
    return {
        "U": U,
        "v_hombro": p["pi"]["alto_pared"],        # cara de abajo de la barra = tope del caño
        "v_top": p["pi"]["alto_pared"] + p["pi"]["barra_arriba"],
        "u_punta": U + p["cuna"]["vuelo"],
        "ancho_exterior": 2 * U,
        "span": 2 * (U + p["cuna"]["vuelo"]),
    }


def cuentas(p):
    d = derivadas(p)
    P = p["carga"]["P_N"]
    w = p["pi"]["ancho_Z"]
    c = p["cuna"]

    # centro de carga de una mochila: en el medio del piso de la cuna
    a = d["U"] + c["vuelo"] / 2.0

    # la cuna es un voladizo desde la pared: se la lleva el piso
    M = P * (a - d["U"])
    W = w * c["piso"] ** 2 / 6.0
    sigma_cuna = M / W

    # vuelco con UNA sola mochila: lo toman las dos paredes contra las caras del caño
    N = P * a / p["pi"]["alto_pared"]
    presion = N / (w * p["pi"]["alto_pared"])

    # la barra de arriba apoya sobre el tope del caño: compresion pura con las dos puestas
    compresion = 2 * P / (w * p["cano"]["espesor"])

    return {
        "ancho_exterior_mm": round(d["ancho_exterior"], 1),
        "span_punta_a_punta_mm": round(d["span"], 1),
        "alto_total_mm": round(d["v_top"], 1),
        "vuelo_de_cada_cuna_mm": round(c["vuelo"], 1),
        "brazo_de_carga_a_mm": round(a, 1),
        "sigma_cuna_MPa": round(sigma_cuna, 2),
        "SF_cuna_vs_PLA_60MPa": round(60.0 / sigma_cuna, 1),
        "N_vuelco_1_mochila_N": round(N, 1),
        "presion_sobre_el_cano_MPa": round(presion, 3),
        "compresion_en_la_barra_MPa": round(compresion, 3),
        "carga_2_mochilas_kg": round(2 * p["carga"]["P_kg_por_mochila"], 1),
        "_proporciones_vs_croquis": {
            "ancho_ext/hueco": round(d["ancho_exterior"] / p["cano"]["boca"], 2),
            "pared/hueco": round(p["pi"]["pared"] / p["cano"]["boca"], 2),
            "vuelo/hueco": round(c["vuelo"] / p["cano"]["boca"], 2),
            "span/hueco": round(d["span"] / p["cano"]["boca"], 2),
        },
    }


def construir(p):
    """El perfil de frente, de una sola pasada, y se extruye. Nada mas."""
    avisos = []
    d = derivadas(p)
    c, pi = p["cuna"], p["pi"]
    ui = p["cano"]["boca"] / 2.0     # cara interna de la pared (el hueco donde entra el caño)
    U, up = d["U"], d["u_punta"]
    v_h, v_t = d["v_hombro"], d["v_top"]
    piso = c["piso"]
    v_labio = v_h                    # el labio llega al ras de las paredes, no sobresale

    # El contorno, de una sola pasada y en un solo sentido: barra de arriba -> pared y
    # cuna derecha -> vuelta por abajo -> hueco del caño (abierto abajo) -> espejo izquierdo.
    pts = [
        (0.0, v_t),
        (U, v_t),
        (U, v_labio),
        (up, v_labio),
        (up, 0.0),
        (up - c["labio_espesor"], 0.0),
        (up - c["labio_espesor"], piso),          # cara interna del labio derecho
        (U, piso),                                 # piso de la cuna derecha
        (U, 0.0),                                  # baja por fuera de la pared
        (ui, 0.0),
        (ui, v_h),                                 # sube por dentro: ESTE es el hueco del caño
        (-ui, v_h),
        (-ui, 0.0),
        (-U, 0.0),
        (-U, piso),
        (-(up - c["labio_espesor"]), piso),
        (-(up - c["labio_espesor"]), 0.0),
        (-up, 0.0),
        (-up, v_labio),
        (-U, v_labio),
        (-U, v_t),
    ]
    pieza = extrude(Plane.XY * Polygon(*pts, align=None), amount=pi["ancho_Z"])
    # segun el sentido del contorno, extrude puede salir hacia -Z: se lo sube para que la
    # pieza apoye en la cama y salga lista para el laminador sin girar nada.
    if pieza.bounding_box().min.Z < -0.01:
        pieza = Pos(0, 0, pi["ancho_Z"]) * pieza

    # radios: el concavo de la raiz de cada cuna es el que trabaja (ahi flexiona)
    for signo in (+1, -1):
        lado = "der" if signo > 0 else "izq"
        pieza = redondear(pieza, aristas_en(pieza, Axis.Z, x=signo * U, y=piso),
                          c["r_concavo_raiz"], f"concavo de la raiz {lado}", avisos)
        pieza = redondear(pieza, aristas_en(pieza, Axis.Z, x=signo * (up - c["labio_espesor"]), y=piso),
                          c["r_canto"], f"pie del labio {lado}", avisos)
        pieza = redondear(pieza, aristas_en(pieza, Axis.Z, x=signo * ui, y=v_h),
                          3.0, f"esquina interna del hueco {lado}", avisos)
    return pieza, avisos


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    ap.add_argument("--params", default=str(AQUI / "params_leo.json"))
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("=== cuentas ===")
    num = cuentas(p)
    for k, v in num.items():
        print(f"  {k:30s} {v}")

    print("\n=== construyendo ===")
    pieza, avisos = construir(p)
    for a in avisos:
        print("  AVISO:", a)

    n = len(pieza.solids())
    if n != 1:
        raise SystemExit(f"ABORTA: salio en {n} solidos sueltos.")
    bb = pieza.bounding_box()
    if abs(bb.min.Z) > 0.01:
        raise SystemExit(f"ABORTA: no apoya en la cama (Zmin = {bb.min.Z:.2f}).")
    print(f"  bbox X[{bb.min.X:.1f},{bb.max.X:.1f}] Y[{bb.min.Y:.1f},{bb.max.Y:.1f}] "
          f"Z[{bb.min.Z:.1f},{bb.max.Z:.1f}]")
    print(f"  volumen {pieza.volume/1000:.2f} cm3")

    export_step(pieza, str(out / "gancho_LEO.step"))
    export_stl(pieza, str(out / "gancho_LEO.stl"), tolerance=0.01, angular_tolerance=0.1)
    num["volumen_cm3"] = round(pieza.volume / 1000, 3)
    (out / "cuentas_leo.json").write_text(json.dumps(num, indent=2), encoding="utf-8")
    print(f"\nlisto -> {out}")
    if avisos:
        raise SystemExit(f"HUBO {len(avisos)} AVISO(S) DE RADIO")


if __name__ == "__main__":
    main()
