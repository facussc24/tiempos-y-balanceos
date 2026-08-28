"""EL DISEÑO DE LEO — collar sobre el tope del caño + una cuna de cada lado.

Croquis a mano de Leonardo Lattanzi, 24/08/2026.

COMO SE SOSTIENE, y por que este SI lleva dos mochilas:
la barra de arriba APOYA sobre la cara superior del caño. El peso baja por compresion contra
ese tope; no hay friccion en juego ni nada que apretar, asi que le da lo mismo una mochila que
dos. Las paredes largas que bajan por los cantos son las que impiden el ladeo cuando cuelga
una sola — y son largas justamente por eso: es el defecto de la pieza que ya esta puesta.

EL ERROR QUE ESTA VERSION CORRIGE (auditoria independiente, Fable 5):
la version anterior abrazaba el ESPESOR del caño (27,2) y tiraba las cunas hacia adelante y
atras — las mochilas quedaban en el hueco de las piernas. Estaba girada 90 grados y, por
haber aplicado las proporciones del croquis sobre 27,8 en vez de sobre el ancho, a un tercio
de escala. Aca el collar abraza el ANCHO (69,23) y las cunas salen a los COSTADOS, a lo largo
del travesaño: la version simetrica del brazo que ya tiene la pieza montada.

Frame (el mismo para uso y para impresion — no hay que girar nada en el laminador):
    X = a lo largo del travesaño. El caño ocupa el centro; las cunas salen a los costados.
    Y = vertical. Y=0 es la cara de abajo de las cunas.
    Z = profundidad, en la direccion del espesor del caño. Es la altura de impresion.

Uso:
    .venv-cad\\Scripts\\python.exe build_gancho_leo.py --out <workdir>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build123d import Axis, Box, Pos, export_step, export_stl, fillet

AQUI = Path(__file__).parent


def caja(x0, x1, y0, y1, z0, z1):
    """Box por extremos, no por centro+tamaño: menos errores de signo."""
    return Pos((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) * Box(x1 - x0, y1 - y0, z1 - z0)


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
    tol = cerca.pop("tol", 0.8)
    return [
        e for e in solido.edges().filter_by(eje)
        if all(abs(getattr(e.center(), k.upper()) - v) < tol for k, v in cerca.items())
    ]


def derivadas(p):
    """Todo lo que depende de otra cota se calcula. Ninguna se escribe en el json."""
    ca, co, cu = p["cano"], p["collar"], p["cuna"]
    hueco = ca["ancho"] + ca["juego"]          # el ANCHO del caño, no el espesor
    ui = hueco / 2.0                            # cara interna de la pared
    U = ui + co["pared"]                        # cara externa de la pared
    return {
        "hueco": hueco,
        "ui": ui,
        "U": U,
        "u_punta": U + cu["vuelo"],
        "v_hombro": co["alto_pared"],           # donde apoya el tope del caño
        "v_top": co["alto_pared"] + co["barra_arriba"],
        "span": 2 * (U + cu["vuelo"]),
        "a_carga": U + cu["vuelo"] / 2.0,       # la correa duerme en el medio de la bocha
    }


def cuentas(p):
    d = derivadas(p)
    ca, co, cu = p["cano"], p["collar"], p["cuna"]
    P, w, A = p["carga"]["P_N"], co["profundidad"], ca["ancho"]

    # la cuna es un voladizo desde la pared
    M = P * (d["a_carga"] - d["U"])
    W = w * cu["fondo"] ** 2 / 6.0
    sigma_cuna = M / W

    # vuelco con UNA sola mochila: lo toman las paredes contra los cantos del caño
    N = P * d["a_carga"] / co["alto_pared"]
    presion = N / (w * co["alto_pared"])

    # con las DOS puestas se contrapesan y solo queda compresion sobre el tope del caño
    compresion = 2 * P / (w * ca["espesor"])

    return {
        "ancho_del_cano_A": A,
        "span_punta_a_punta_mm": round(d["span"], 1),
        "alto_total_mm": round(d["v_top"], 1),
        "abraza_del_cano_mm": round(co["alto_pared"], 1),
        "garganta_de_la_bocha_mm": round(cu["alto"] - cu["fondo"], 1),
        "ancho_de_la_bocha_mm": round(cu["vuelo"] - cu["labio_espesor"], 1),
        "brazo_de_carga_mm": round(d["a_carga"], 1),
        "sigma_cuna_MPa": round(sigma_cuna, 2),
        "SF_cuna_vs_PLA_60MPa": round(60.0 / sigma_cuna, 1),
        "N_vuelco_1_mochila_N": round(N, 1),
        "presion_sobre_el_cano_MPa": round(presion, 3),
        "compresion_en_el_tope_MPa": round(compresion, 3),
        "carga_2_mochilas_kg": round(2 * p["carga"]["P_kg_por_mochila"], 1),
        "_proporciones_sobre_A": {
            "pared/A": round(co["pared"] / A, 2),
            "alto_pared/A": round(co["alto_pared"] / A, 2),
            "vuelo/A": round(cu["vuelo"] / A, 2),
            "span/A": round(d["span"] / A, 2),
        },
    }


def construir(p):
    avisos = []
    d = derivadas(p)
    co, cu = p["collar"], p["cuna"]
    ui, U, up = d["ui"], d["U"], d["u_punta"]
    v_h, v_t, w = d["v_hombro"], d["v_top"], co["profundidad"]

    # --- collar: caja exterior menos el hueco donde entra el caño (abierto abajo)
    pieza = caja(-U, U, 0.0, v_t, 0.0, w)
    pieza -= caja(-ui, ui, 0.0, v_h, -1.0, w + 1.0)

    # --- una cuna a cada lado, al pie de la pared
    for s in (+1, -1):
        pieza += caja(min(s * U, s * up), max(s * U, s * up), 0.0, cu["alto"], 0.0, w)
        # la bocha: se vacia desde el fondo para arriba, y se abre por el techo
        u_a, u_b = s * U, s * (up - cu["labio_espesor"])
        pieza -= caja(min(u_a, u_b), max(u_a, u_b), cu["fondo"], cu["alto"] + 5.0, -1.0, w + 1.0)

    # --- radios. El fondo de la bocha es el que toca la correa; la raiz es la que flexiona.
    for s in (+1, -1):
        lado = "der" if s > 0 else "izq"
        pieza = redondear(pieza, aristas_en(pieza, Axis.Z, x=s * U, y=cu["fondo"]),
                          cu["r_fondo"], f"fondo de la bocha, lado pared {lado}", avisos)
        pieza = redondear(pieza,
                          aristas_en(pieza, Axis.Z, x=s * (up - cu["labio_espesor"]), y=cu["fondo"]),
                          cu["r_fondo"], f"fondo de la bocha, lado labio {lado}", avisos)
        # (no va fillet en x=U, y=alto: ahi la pared del collar sigue de largo hacia arriba,
        #  no hay arista concava — la que trabaja es la del fondo de la bocha, ya redondeada)
        pieza = redondear(pieza, aristas_en(pieza, Axis.Z, x=s * ui, y=v_h),
                          4.0, f"esquina interna del hueco {lado}", avisos)
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
        print(f"  {k:28s} {v}")

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
    # el hueco tiene que ser el ANCHO del caño, no el espesor: es el error que se corrigio
    if abs((2 * derivadas(p)["ui"]) - (p["cano"]["ancho"] + p["cano"]["juego"])) > 0.01:
        raise SystemExit("ABORTA: el hueco no es el ANCHO del caño.")
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
