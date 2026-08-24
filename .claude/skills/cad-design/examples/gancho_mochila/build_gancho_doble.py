"""Gancho DOBLE — el diseño del gerente: silla de montar sobre el travesaño, 2 ganchos.

Croquis del gerente de Fak, 24/08/2026 (cuaderno, foto por WhatsApp).

MECANISMO — y por que este SI puede llevar dos mochilas y el v1 no:
el v1 es una mordaza que agarra por el momento DESEQUILIBRADO del peso (bascula y muerde
la pata). Poniendole dos ganchos y dos mochilas iguales el momento se anula, N va a cero y
la friccion tambien: se resbala. Es una limitacion del mecanismo, no del dibujo.
Este no aprieta nada: el lomo APOYA sobre la cara de arriba del travesaño y el peso baja
por compresion. Con una mochila o con dos, se sostiene igual.

Lo unico que las alas tienen que tomar es el momento de UNA sola mochila, que tiende a
volcar la pieza:  N = P*a / A   (A = alto de las alas = alto del travesaño).

Frame (mismo para uso y para impresion, la pieza es una EXTRUSION pura -> cero soportes):
    u = horizontal, transversal al travesaño. u=0 es el eje de la pieza.
    v = vertical. v=0 es la cara de abajo de los brazos, todo lo demas va para arriba.
    w = a lo largo del travesaño = ancho de la pieza = altura de impresion.

Uso:
    .venv-cad\\Scripts\\python.exe build_gancho_doble.py --out <workdir>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build123d import (
    Axis,
    Plane,
    Polygon,
    Pos,
    export_step,
    export_stl,
    extrude,
    fillet,
)

AQUI = Path(__file__).parent


def aristas_en(solido, eje, **cerca):
    """Aristas paralelas a `eje` cuyo centro cae cerca de las coordenadas dadas."""
    tol = cerca.pop("tol", 0.6)
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


def cuentas(p):
    """Las cuentas que gobiernan, recalculadas desde los params en cada corrida.

    cad-3d.md GATE 4: ningun parametro se hereda sin recalcularlo, y el que gobierna la
    geometria se mide despues sobre el artefacto (lo hace verificar_gancho_doble.py).
    """
    s, g, sub = p["silla"], p["gancho"], p["sustrato"]
    P = p["carga"]["P_N"]
    A = sub["A_alto_travesano"]
    B = sub["B_espesor_travesano"]

    boca = B + s["juego_total"]
    U = boca / 2.0 + s["e_ala"]
    v_top = A + s["e_lomo"]

    # brazo de carga: del eje de la pieza al fondo del gancho (la correa se va al fondo)
    a = g["u_fondo"] - g["r_fondo_gancho"]

    # peor caso = UNA sola mochila: el momento tiende a volcar la pieza y lo toman las alas
    N = P * a / A
    area_ala = s["ancho_X"] * A / 2.0  # apoya media altura del ala al bascular
    presion = N / area_ala

    # flexion del brazo en su raiz (donde sale del ala)
    M_brazo = P * (a - U)
    W_brazo = s["ancho_X"] * g["v_brazo_raiz"] ** 2 / 6.0
    sigma_brazo = M_brazo / W_brazo

    # el ala a traccion: se la lleva entera el peso que cuelga de ella
    sigma_ala = P / (s["ancho_X"] * s["e_ala"])

    # el lomo apoya en toda su superficie sobre el travesaño; lo que trabaja es el voladizo
    # que sobresale del travesaño hacia cada lado (el espesor del ala)
    M_lomo = P * s["e_ala"]
    W_lomo = s["ancho_X"] * s["e_lomo"] ** 2 / 6.0
    sigma_lomo = M_lomo / W_lomo

    return {
        "boca_de_la_silla": round(boca, 2),
        "ancho_total_U2": round(2 * U, 1),
        "alto_total": round(v_top, 1),
        "brazo_de_carga_a": round(a, 1),
        "N_por_ala_1_mochila_N": round(N, 1),
        "presion_sobre_el_travesano_MPa": round(presion, 3),
        "sigma_brazo_MPa": round(sigma_brazo, 2),
        "SF_brazo_vs_PLA_60MPa": round(60.0 / sigma_brazo, 1),
        "sigma_ala_traccion_MPa": round(sigma_ala, 2),
        "sigma_lomo_MPa": round(sigma_lomo, 2),
        "SF_lomo_vs_PLA_60MPa": round(60.0 / sigma_lomo, 1),
        "garganta_del_gancho_mm": round(g["v_nariz"] - g["v_fondo"], 1),
        "carga_2_mochilas_kg": round(2 * p["carga"]["P_kg_por_gancho"], 1),
    }


def construir(p):
    avisos = []
    s, g, sub = p["silla"], p["gancho"], p["sustrato"]
    boca = sub["B_espesor_travesano"] + s["juego_total"]
    ui = boca / 2.0            # cara interna del ala (la que toca el travesaño)
    U = ui + s["e_ala"]        # cara externa del ala
    v_ala_top = sub["A_alto_travesano"]        # cara inferior del lomo
    v_top = v_ala_top + s["e_lomo"]

    # Contorno cerrado, recorrido de una: lomo -> ala derecha -> brazo -> nariz -> vuelta por
    # abajo -> boca (el hueco donde entra el travesaño) -> espejo del lado izquierdo.
    pts = [
        (0.0, v_top),
        (U, v_top),
        (U, g["v_brazo_raiz"]),
        (g["u_fondo"], g["v_fondo"]),
        (g["u_fondo"], g["v_nariz"]),
        (g["u_punta"], g["v_nariz"]),
        (g["u_punta"], 0.0),
        (ui, 0.0),
        (ui, v_ala_top),          # sube por dentro del ala derecha
        (-ui, v_ala_top),         # cruza por debajo del lomo: ESTA es la boca
        (-ui, 0.0),
        (-g["u_punta"], 0.0),
        (-g["u_punta"], g["v_nariz"]),
        (-g["u_fondo"], g["v_nariz"]),
        (-g["u_fondo"], g["v_fondo"]),
        (-U, g["v_brazo_raiz"]),
        (-U, v_top),
    ]
    perfil = Plane.XY * Polygon(*pts, align=None)
    # el contorno queda en sentido horario, asi que extrude sale hacia -Z: se lo sube para
    # que la pieza apoye en Z=0 y salga lista para el laminador sin girar nada.
    pieza = Pos(0, 0, s["ancho_X"]) * extrude(perfil, amount=s["ancho_X"])

    # Radios. cad-3d.md: ninguna esquina interna viva donde haya flexion.
    for signo in (+1, -1):
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.Z, x=signo * g["u_fondo"], y=g["v_fondo"]),
            g["r_fondo_gancho"],
            f"fondo del gancho {'derecho' if signo > 0 else 'izquierdo'}",
            avisos,
        )
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.Z, x=signo * U, y=g["v_brazo_raiz"]),
            g["r_brazo_ala"],
            f"union brazo-ala {'derecha' if signo > 0 else 'izquierda'}",
            avisos,
        )
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.Z, x=signo * ui, y=v_ala_top),
            3.0,
            f"esquina interna de la boca {'derecha' if signo > 0 else 'izquierda'}",
            avisos,
        )
        pieza = redondear(
            pieza,
            aristas_en(pieza, Axis.Z, x=signo * g["u_punta"], y=g["v_nariz"]),
            g["r_canto_externo"],
            f"punta de la nariz {'derecha' if signo > 0 else 'izquierda'}",
            avisos,
        )
    return pieza, avisos


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    ap.add_argument("--params", default=str(AQUI / "params_doble.json"))
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    sub = p["sustrato"]
    if not sub.get("confirmado_por_fak"):
        print("=" * 78)
        print("  ATENCION: A / B / C del travesaño son ESTIMACIONES, no medidas.")
        print("  Esta pieza NO se imprime hasta que Fak las mida con el calibre.")
        print(f"  A={sub['A_alto_travesano']}  B={sub['B_espesor_travesano']}  "
              f"C={sub['C_luz_sobre_el_travesano']}")
        print("=" * 78)

    # GATE duro: si el lomo no entra en la luz que hay sobre el travesaño, no hay diseño.
    if p["silla"]["e_lomo"] > sub["C_luz_sobre_el_travesano"]:
        raise SystemExit(
            f"ABORTA: el lomo mide {p['silla']['e_lomo']} mm y sobre el travesaño hay "
            f"{sub['C_luz_sobre_el_travesano']} mm. No entra. O se afina el lomo, o esta "
            "pieza no se puede colgar ahi y hay que buscar otro punto de apoyo."
        )

    print("\n=== cuentas (recalculadas desde params) ===")
    num = cuentas(p)
    for k, v in num.items():
        print(f"  {k:34s} {v}")

    print("\n=== construyendo ===")
    pieza, avisos = construir(p)
    for a in avisos:
        print("  AVISO:", a)

    bb = pieza.bounding_box()
    print(f"  bbox  X[{bb.min.X:.2f},{bb.max.X:.2f}] Y[{bb.min.Y:.2f},{bb.max.Y:.2f}] "
          f"Z[{bb.min.Z:.2f},{bb.max.Z:.2f}]")
    print(f"  volumen {pieza.volume/1000:.2f} cm3")

    export_step(pieza, str(out / "gancho_doble_v1.step"))
    export_stl(pieza, str(out / "gancho_doble_v1.stl"), tolerance=0.01, angular_tolerance=0.1)
    num["volumen_cm3"] = round(pieza.volume / 1000, 3)
    (out / "cuentas_doble.json").write_text(json.dumps(num, indent=2), encoding="utf-8")
    print(f"\nlisto -> {out}")
    if avisos:
        raise SystemExit(f"HUBO {len(avisos)} AVISO(S) DE RADIO — revisar antes de imprimir")


if __name__ == "__main__":
    main()
