"""Gancho para colgar mochilas de la pata del escritorio — mordaza auto-trabante.

Tarea del Escritorio "Imprimir gancho para colgar mochilas" (fotos de Fak, 19/08/2026).

MECANISMO — por que agarra sin tornillos y sin que el plastico haga de resorte:
el clip abraza el espesor de la pata (30,68 mm) con un juego chico. El brazo del gancho
sale PERPENDICULAR a la cara ancha, asi que el peso de la mochila genera un momento
alrededor del eje X que bascula el clip ~1,4 grados dentro del juego. Ese basculamiento
apoya el ala -Y contra la pata por ARRIBA y el ala +Y por ABAJO: un par de fuerzas
normales N = P*a/L. La friccion de esas dos normales es la que sostiene el peso.

    No resbala  <=>  2*mu*N >= P  <=>  a/L >= 1/(2*mu)

Por eso el brazo BAJA hacia afuera: la correa se va sola al extremo, donde 'a' es maximo.
Un brazo horizontal dejaria la correa cerca del clip, con 'a' chico, y ahi la mordaza suelta.

Frame (mismo para uso y para impresion, no hay que girar nada en el laminador):
    X = profundidad, a lo largo del ancho de la pata. Lomo en X<0, alas hacia +X.
    Y = espesor de la pata. El brazo sale hacia +Y.
    Z = vertical, Z=0 es la cama de la impresora.

Uso:
    .venv-cad\\Scripts\\python.exe build_gancho.py --out <workdir>
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
)

AQUI = Path(__file__).parent


# --------------------------------------------------------------------------- helpers


def caja(x0, x1, y0, y1, z0, z1):
    """Box definida por sus extremos, no por centro+tamano (menos errores de signo)."""
    return Pos((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) * Box(x1 - x0, y1 - y0, z1 - z0)


def aristas_en(solido, eje, **cerca):
    """Aristas paralelas a `eje` cuyo centro cae cerca de las coordenadas dadas.

    aristas_en(s, Axis.X, y=62, z=5) -> las aristas paralelas a X en ese vertice.
    """
    tol = cerca.pop("tol", 0.6)
    fuera = []
    for e in solido.edges().filter_by(eje):
        c = e.center()
        ok = all(abs(getattr(c, k.upper()) - v) < tol for k, v in cerca.items())
        if ok:
            fuera.append(e)
    return fuera


def redondear(solido, aristas, radio, etiqueta, avisos):
    """fillet que no tumba el build: si OCC no puede, lo anota y sigue."""
    if not aristas:
        avisos.append(f"NO SE ENCONTRARON aristas para '{etiqueta}' (R{radio})")
        return solido
    try:
        return fillet(aristas, radius=radio)
    except Exception as exc:  # noqa: BLE001
        avisos.append(f"FALLO el radio '{etiqueta}' R{radio}: {exc}")
        return solido


# ----------------------------------------------------------------------------- clip


def construir_clip(p, *, boca, con_rebajes=True, h=None, p_ala=None, e_ala=None, e_lomo=None):
    """Canal en U pasante en Z: dos alas + lomo. El lomo topa contra el canto de la pata."""
    c = p["clip"]
    h = c["h_clip"] if h is None else h
    p_ala = c["p_ala"] if p_ala is None else p_ala
    e_ala = c["e_ala"] if e_ala is None else e_ala
    e_lomo = c["e_lomo"] if e_lomo is None else e_lomo

    yi = boca / 2.0          # cara interna del ala (la que toca la pata)
    ye = yi + e_ala          # cara externa del ala

    lomo = caja(-e_lomo, 0.0, -ye, ye, 0.0, h)
    ala_mas = caja(0.0, p_ala, yi, ye, 0.0, h)
    ala_menos = caja(0.0, p_ala, -ye, -yi, 0.0, h)
    clip = lomo + ala_mas + ala_menos

    if con_rebajes:
        # El contacto tiene que darse SOLO en las almohadillas, si no el punto de apoyo
        # queda librado al azar y el par N*L deja de ser el que calcule.
        # Las almohadillas van en los EXTREMOS donde el basculamiento hace tocar: la del
        # ala +Y abajo, la del ala -Y arriba. No acortan L (eso lo hace h_clip), pero
        # reparten la presion en vez de dejarla en el filo del ala.
        # El rebaje entra con RAMPA, no con escalon: un escalon deja una esquina concava
        # viva en la cara que se ESTIRA cuando el ala flexiona, y ahi no entra un radio
        # decente porque el escalon mide 1 mm.
        ha = c["h_almohadilla"]
        r = c["rebaje_fuera_de_almohadilla"]
        ramp = c["rampa_rebaje"]
        sk_mas = Plane.YZ * Polygon(
            (yi, ha), (yi + r, ha + ramp), (yi + r, h + 1), (yi, h + 1), align=None
        )
        clip -= Pos(0, 0, 0) * extrude(sk_mas, amount=p_ala)
        sk_men = Plane.YZ * Polygon(
            (-yi, h - ha), (-yi - r, h - ha - ramp), (-yi - r, -1), (-yi, -1), align=None
        )
        clip -= Pos(0, 0, 0) * extrude(sk_men, amount=p_ala)

    return clip, yi, ye


# ------------------------------------------------------------------------- el gancho


def construir_gancho(p):
    avisos = []
    c, b, n, r = p["clip"], p["brazo"], p["nariz"], p["radios"]
    boca = c["boca"]

    pieza, yi, ye = construir_clip(p, boca=boca)

    # --- brazo + nariz: perfil 2D en el plano YZ, extruido a lo ancho (X).
    # Que sea una extrusion es lo que hace que no necesite soportes.
    perfil_pts = [
        (b["y_raiz"], 0.0),          # arranca en la cara externa del ala +Y
        (n["y_punta_ext"], 0.0),     # base, toda apoyada en la cama
        (n["y_punta_ext"], n["z_punta"]),
        (b["y_fondo"], n["z_punta"]),
        (b["y_fondo"], b["z_fondo"]),  # fondo del gancho: acá se apoya la correa
        (b["y_raiz"], b["z_raiz"]),    # cara superior del brazo, sube hacia el clip
    ]
    perfil = Plane.YZ * Polygon(*perfil_pts, align=None)
    brazo = Pos(b["x0"], 0, 0) * extrude(perfil, amount=b["ancho_X"])

    pieza = pieza + brazo

    # --- radios. cad-3d.md: ninguna esquina interna viva donde hay flexion.
    pieza = redondear(
        pieza,
        aristas_en(pieza, Axis.X, y=b["y_fondo"], z=b["z_fondo"]),
        n["r_fondo_gancho"],
        "fondo del gancho (que no corte la correa)",
        avisos,
    )
    pieza = redondear(
        pieza,
        aristas_en(pieza, Axis.X, y=b["y_raiz"], z=b["z_raiz"]),
        r["r_brazo_clip"],
        "union brazo-clip (la que se parte si va viva)",
        avisos,
    )
    # La union ala-lomo NO se resuelve con fillet: un fillet en esa esquina agrega material
    # HACIA ADENTRO del canal y choca contra el canto de la pata (lo cazo verificar_gancho.py
    # el 24/08: 509 puntos penetrando). Se resuelve como se hace en mecanizado, con un
    # ALIVIO: se excava un cilindro centrado en la arista. Queda el mismo arco concavo que
    # baja el Kt, pero el material sale del lado de afuera, no del canal.
    r_al = r["r_ala_lomo"]
    for signo in (+1, -1):
        alivio = Pos(0.0, signo * yi, c["h_clip"] / 2.0) * Cylinder(
            radius=r_al, height=c["h_clip"] + 2
        )
        pieza -= alivio
    # cosmeticos: punta de la nariz
    pieza = redondear(
        pieza,
        aristas_en(pieza, Axis.X, y=n["y_punta_ext"], z=n["z_punta"])
        + aristas_en(pieza, Axis.X, y=b["y_fondo"], z=n["z_punta"]),
        n["r_canto_externo"],
        "punta de la nariz",
        avisos,
    )

    # --- entrada guiada: chaflan en la boca, del lado por donde entra la pata (X = p_ala)
    # se resuelve como dos prismas triangulares a lo largo de Z
    ent = c["chaflan_entrada"]
    for signo in (+1, -1):
        y_int = signo * yi
        tri = Plane.XY * Polygon(
            (c["p_ala"], y_int),
            (c["p_ala"] - ent, y_int),
            (c["p_ala"], y_int + signo * ent),
            align=None,
        )
        pieza -= extrude(tri, amount=c["h_clip"])

    return pieza, avisos


# ------------------------------------------------------------------------- el testigo


def construir_testigo(p):
    """Paso 0: una probeta por boca, para saber cual calza antes de tirar la impresion larga.

    Van en archivos SEPARADOS y no pegadas en una regleta: un STEP con tres cuerpos sueltos
    es un diseno partido y export_deliverables lo rechaza — con razon. Cada probeta sale en
    su propio origen y se identifica por las MUESCAS del lomo (1, 2 o 3), no por texto: a
    este tamano el texto FDM no se lee y la muesca se cuenta con el dedo.
    """
    t = p["testigo"]
    fuera = []
    for i, boca in enumerate(t["bocas"], start=1):
        clip, yi, ye = construir_clip(
            p,
            boca=boca,
            con_rebajes=False,
            h=t["h"],
            p_ala=t["p_ala"],
            e_ala=t["e_ala"],
            e_lomo=t["e_lomo"],
        )
        for k in range(i):
            z0 = 2.5 + k * 4.0
            clip -= caja(-t["e_lomo"], -t["e_lomo"] + 1.5, -ye - 1, ye + 1, z0, z0 + 2.0)
        fuera.append((boca, i, clip))
    return fuera


# ------------------------------------------------------------------------------ main


def cuentas(p):
    """Las cuentas que gobiernan el diseno, recalculadas desde los params en cada corrida.

    cad-3d.md GATE 4: todo parametro heredado se recalcula contra su propia formula.
    """
    P = p["carga"]["P_N"]
    mu = p["carga"]["mu"]
    a = p["brazo"]["a_centro_carga"]
    c = p["clip"]

    # L = brazo del par de mordida. Al bascular, el ala +Y apoya en su punto MAS BAJO y el
    # ala -Y en el MAS ALTO: L es la ALTURA DEL CLIP, no la distancia entre centros de
    # almohadillas. Medido sobre el STL (24/08) daba 40,7 con h_clip=40. Creer que era 26
    # daba a/L=2,19 cuando el real era 1,40 — o sea, resbalaba.
    L_geom = c["h_clip"]

    exigido = 1.0 / (2.0 * mu)
    N = P * a / L_geom
    friccion = 2.0 * mu * N
    area_almo = c["p_ala"] * c["h_almohadilla"]

    # flexion del brazo en la raiz
    b_ancho = p["brazo"]["ancho_X"]
    h_brazo = p["brazo"]["z_raiz"]
    M = P * (a - p["brazo"]["y_raiz"])
    W = b_ancho * h_brazo**2 / 6.0
    sigma = M / W

    # El LOMO es el que transmite el par entre las dos alas: lo toma como TORSION.
    # Seccion rectangular delgada -> J ~ (1/3)*largo*espesor^3.
    T = N * L_geom
    largo_lomo = c["boca"] + 2 * c["e_ala"]
    J = largo_lomo * c["e_lomo"] ** 3 / 3.0
    tau_lomo = T * c["e_lomo"] / J

    # Cada ala es un voladizo desde el lomo: N aplicada en el centro de la almohadilla.
    M_ala = N * c["p_ala"] / 2.0
    b_efec = c["h_almohadilla"] + 2 * c["e_ala"]  # reparto a 45 grados hacia los lados
    W_ala = b_efec * c["e_ala"] ** 2 / 6.0
    sigma_ala = M_ala / W_ala

    # basculamiento disponible
    theta = math.degrees(math.atan(c["juego_total"] / L_geom))

    return {
        "L_altura_del_clip": round(L_geom, 2),
        "a_sobre_L": round(a / L_geom, 3),
        "exigido_1_sobre_2mu": round(exigido, 3),
        "margen_pct": round((a / L_geom / exigido - 1) * 100, 1),
        "N_por_almohadilla_N": round(N, 1),
        "friccion_disponible_N": round(friccion, 1),
        "peso_a_sostener_N": round(P, 1),
        "presion_almohadilla_MPa": round(N / area_almo, 3),
        "sigma_brazo_MPa": round(sigma, 2),
        "sigma_ala_MPa": round(sigma_ala, 2),
        "SF_ala_vs_PLA_60MPa": round(60.0 / sigma_ala, 1),
        "tau_lomo_MPa": round(tau_lomo, 2),
        "SF_lomo_vs_corte_35MPa": round(35.0 / tau_lomo, 1),
        "SF_brazo_vs_PLA_60MPa": round(60.0 / sigma, 1),
        "basculamiento_grados": round(theta, 2),
        "garganta_del_gancho_mm": round(p["nariz"]["z_punta"] - p["brazo"]["z_fondo"], 1),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, help="carpeta de salida")
    ap.add_argument("--params", default=str(AQUI / "params.json"))
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("=== cuentas (recalculadas desde params, no heredadas) ===")
    num = cuentas(p)
    for k, v in num.items():
        print(f"  {k:32s} {v}")
    if p["nariz"]["z_punta"] > p["clip"]["h_clip"] + 0.01:
        raise SystemExit(
            "ABORTA: la nariz sobresale por encima del clip -> chocaria contra la tapa "
            f"del escritorio (nariz {p['nariz']['z_punta']} > clip {p['clip']['h_clip']})"
        )
    if num["a_sobre_L"] < num["exigido_1_sobre_2mu"]:
        raise SystemExit("ABORTA: a/L por debajo de 1/(2*mu) -> la mordaza RESBALA")
    if num["friccion_disponible_N"] < num["peso_a_sostener_N"]:
        raise SystemExit("ABORTA: la friccion no llega a sostener el peso")

    print("\n=== construyendo ===")
    gancho, avisos = construir_gancho(p)
    for a in avisos:
        print("  AVISO:", a)

    bb = gancho.bounding_box()
    print(f"  gancho  bbox X[{bb.min.X:.2f},{bb.max.X:.2f}] "
          f"Y[{bb.min.Y:.2f},{bb.max.Y:.2f}] Z[{bb.min.Z:.2f},{bb.max.Z:.2f}]")
    print(f"  gancho  volumen {gancho.volume/1000:.2f} cm3")

    export_step(gancho, str(out / "gancho_mochila_v1.step"))
    export_stl(gancho, str(out / "gancho_mochila_v1.stl"), tolerance=0.01, angular_tolerance=0.1)

    for boca, muescas, pieza in construir_testigo(p):
        nombre = f"testigo_boca_{boca:.2f}".replace(".", "_")
        print(f"  {nombre}  {muescas} muesca(s)  {pieza.volume/1000:.2f} cm3")
        export_step(pieza, str(out / f"{nombre}.step"))
        export_stl(pieza, str(out / f"{nombre}.stl"), tolerance=0.01, angular_tolerance=0.1)

    num["volumen_gancho_cm3"] = round(gancho.volume / 1000, 3)
    (out / "cuentas.json").write_text(json.dumps(num, indent=2), encoding="utf-8")
    print(f"\nlisto -> {out}")
    if avisos:
        raise SystemExit(f"HUBO {len(avisos)} AVISO(S) DE RADIO — revisar antes de imprimir")


if __name__ == "__main__":
    main()
