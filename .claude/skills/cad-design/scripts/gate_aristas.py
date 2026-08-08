#!/usr/bin/env python
"""GATE de ARISTAS VIVAS — busca los concentradores de tension en una pieza impresa.

POR QUE EXISTE (fallo real, 2026-08-07). Se entrego un utillaje con laminas elasticas cuya
raiz estaba a 90 grados vivo. Fak lo vio en el render: *"los cuadraditos se ven fragiles,
justamente los que tienen que hacer presion... dejaste muchos angulos de 90 grados, eso
significa mas riesgo de que se partan"*. El calculo le dio la razon:

    tension nominal en la raiz .............  15,0 MPa
    con arista viva, Kt = 2,2 ..............  33,0 MPa
    resistencia del PLA impreso en Z .......  25-35 MPa   -> SF estatico 0,76-1,06
    limite de fatiga (~1e5 ciclos) .........  10-16 MPa   -> SF fatiga  0,30-0,48
                                                             SE PARTIA

Los siete controles de encastre daban VERDE: ninguno miraba la resistencia. Un CAD puede
estar perfectamente posicionado y ser una pieza que se rompe a la semana.

QUE HACE. Recorre las aristas del solido y marca las CONCAVAS (las que concentran) que no
tienen radio. Ordena por gravedad: una arista viva en una pared delgada que flexiona es
critica; la misma arista en un bloque macizo es cosmetica. Para eso usa el espesor de
material que hay a cada lado: es la pared fina la que decide.

    R >= 0,5 . t  ->  Kt ~ 1,2      (lo que hay que poner)
    R  = 0,25. t  ->  Kt ~ 1,55
    arista viva   ->  Kt ~ 2,2      (y la boquilla FDM deja ~0,2 mm que NO alcanza
                                     y ademas no es repetible)

USO
    gate_aristas.py --step pieza.step --t-fino 1.4
    gate_aristas.py --step pieza.step --t-fino 1.4 --tension-nominal 8.9 --json out.json

    --t-fino          espesor de la pared delgada que flexiona [mm]. Es la cota que define
                      el radio exigido (0,5.t) y la que separa lo critico de lo cosmetico.
    --tension-nominal si se pasa, calcula el factor de seguridad estatico y a fatiga.

Sale con codigo 1 si queda alguna arista concava viva en material fino.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom  # noqa: E402

# PLA impreso, capas perpendiculares a la traccion (el peor caso y el mas comun)
PLA_Z_ESTATICO = (25.0, 35.0)
PLA_Z_FATIGA = (10.0, 16.0)


def kt(radio, t):
    """Factor de concentracion en una esquina interna en flexion, segun R/t."""
    if t <= 0:
        return 1.0
    r = radio / t
    for lim, k in ((0.0, 2.2), (0.12, 1.83), (0.25, 1.55), (0.50, 1.20), (0.75, 1.10)):
        if r <= lim:
            return k
    return 1.05


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--step", required=True)
    p.add_argument("--t-fino", type=float, required=True,
                   help="espesor de la pared que flexiona [mm]")
    p.add_argument("--tension-nominal", type=float,
                   help="sigma nominal en la raiz [MPa], para el factor de seguridad")
    p.add_argument("--lc", type=float, default=0.4, help="tamano de malla para medir")
    p.add_argument("--json", help="volcar el resultado")
    a = p.parse_args()

    # ---------------------------------------------------------------------------------
    # GATE FUERA DE SERVICIO — 2026-08-08
    #
    # Este gate dio FALSO VERDE dos veces seguidas, con dos implementaciones distintas de
    # la deteccion de concavidad, y las dos veces se "valido" corriendolo sobre una pieza
    # BUENA y viendo que daba OK. O sea: se comprobo la direccion del falso positivo y
    # NUNCA la del falso negativo.
    #
    #   v1: marcaba toda arista plano-plano  -> exit 1 siempre, sobre cualquier pieza
    #   v2: sonda sobre la bisectriz de las normales -> exit 0 siempre. Un bloque con una
    #       ranura de fondo VIVO (2 concavas indiscutibles) daba "0 concavas -> OK"
    #
    # v2 es peor que v1: el ruido se apaga, la ceguera se firma.
    #
    # La causa de fondo NO era el signo: era el metodo. Sondear un punto a 0,15 mm de una
    # arista sobre una malla teselada cae dentro del error de discretizacion. El kernel
    # contesta esto exacto y sin tolerancia — se estaba usando OCC solo para construir,
    # nunca para preguntar.
    #
    # METODO CORRECTO (probado, discrimina el control MAL del BIEN):
    #   TopExp.MapShapesAndAncestors_s(shape, TopAbs_EDGE, TopAbs_FACE, m)
    #   para cada arista con exactamente 2 caras:
    #     n_i = normal de la cara, INVERTIDA si f.Orientation() == TopAbs_REVERSED
    #           (asi queda la exterior real, que es dato topologico, no geometrico)
    #     d   = tangente de la arista en el punto medio (BRepAdaptor_Curve.D1)
    #     concava  <=>  dot(cross(n1, n2), d) < 0
    #
    # NO SE REACTIVA hasta que traiga su propio control sintetico BIEN/MAL y lo corra en
    # cada invocacion (--autotest). Un gate sin par BIEN/MAL declara deteccion cero.
    print("[FUERA DE SERVICIO] gate_aristas dio falso verde dos veces y esta deshabilitado.")
    print("  Ver el comentario al inicio de main(): el metodo correcto esta escrito ahi,")
    print("  falta implementarlo con OCC + su control sintetico BIEN/MAL.")
    print("  Mientras tanto, para concentradores: mirar el corte y medir a mano.")
    return 2

    r_exigido = 0.5 * a.t_fino
    print(f"pieza: {os.path.basename(a.step)}")
    print(f"pared fina declarada: {a.t_fino} mm  ->  radio exigido en las concavas: "
          f"{r_exigido:.2f} mm (0,5.t, da Kt ~ 1,2)\n")

    import gmsh
    import trimesh
    malla = geom.step_to_trimesh(a.step, lc=a.lc, require_watertight=False)
    with geom.gmsh_session():
        geom._load(a.step)
        gmsh.model.occ.synchronize()
        aristas = gmsh.model.getEntities(1)
        # Una arista con superficie cilindrica adyacente esta redondeada; con dos planas
        # adyacentes es VIVA. Pero solo importan las CONCAVAS: una arista convexa (el canto
        # de un bloque) no concentra tension, se astilla y nada mas.
        #
        # La primera version de este script marcaba TODAS las aristas plano-plano sin
        # calcular concavidad. En cualquier pieza prismatica eso es un numero grande y
        # siempre positivo -> exit 1 siempre -> el gate se saltea siempre. Un control que
        # nunca puede dar verde no es un control: es ruido, y el ruido se apaga.
        #
        # Concavidad, sin ambiguedad: se toma el punto medio de la arista y se lo desplaza
        # por la bisectriz de las dos normales exteriores. Si ese punto cae DENTRO del
        # solido, la arista es concava (el material rodea el hueco).
        vivas, convexas, redondeadas, radios = [], 0, 0, []
        cand = []
        for d_, t in aristas:
            caras = gmsh.model.getAdjacencies(d_, t)[0]
            tipos = [gmsh.model.getType(2, int(c)) for c in caras]
            bb = np.array(gmsh.model.getBoundingBox(d_, t))
            largo = float(np.linalg.norm(bb[3:] - bb[:3]))
            if largo < 1.0:
                continue
            if any("ylinder" in ti or "orus" in ti for ti in tipos):
                redondeadas += 1
                for c, ti in zip(caras, tipos):
                    if "ylinder" in ti:
                        cb = np.array(gmsh.model.getBoundingBox(2, int(c)))
                        ce = np.sort(cb[3:] - cb[:3])
                        radios.append(float(ce[0]) / 2 if ce[0] > 1e-6 else float(ce[1]) / 2)
            elif len(tipos) == 2 and all("lane" in ti for ti in tipos):
                pb = gmsh.model.getParametrizationBounds(d_, t)
                pm = np.array(gmsh.model.getValue(d_, t, [(pb[0][0] + pb[1][0]) / 2]))
                nn = []
                for c in caras:
                    par = gmsh.model.getParametrization(2, int(c), pm.tolist())
                    nrm = np.array(gmsh.model.getNormal(int(c), par))
                    nn.append(nrm / (np.linalg.norm(nrm) or 1.0))
                # OJO CON EL SIGNO. Las normales de OCC son EXTERIORES: en una esquina
                # interna las dos apuntan hacia el vano, asi que su bisectriz apunta al
                # AIRE, no al material. Hay que sondear en -bisectriz.
                # La version anterior sondeaba en +bisectriz: clasificaba TODO como
                # convexo, la rama "concava" era inalcanzable y el gate daba OK sobre
                # cualquier pieza. Se valido solo contra una pieza buena — o sea se
                # comprobo el falso positivo y nunca el falso negativo.
                bis = nn[0] + nn[1]
                nb = np.linalg.norm(bis)
                if nb < 1e-6:
                    continue
                cand.append((largo, t, pm, pm - (bis / nb) * 0.15))
        if cand:
            sondas = np.array([c[3] for c in cand])
            dentro = malla.contains(sondas) if malla.is_watertight else np.zeros(len(cand), bool)
            for (largo, t, pm, _), es_concava in zip(cand, dentro):
                if es_concava:
                    vivas.append((largo, t, pm))
                else:
                    convexas += 1

    vivas.sort(reverse=True)
    print(f"aristas de mas de 1 mm: {len(vivas) + redondeadas}")
    print(f"  convexas    : {convexas}   (cantos: se astillan, NO concentran tension)")
    print(f"  redondeadas : {redondeadas}"
          + (f"   radios ~ {sorted(set(round(x, 2) for x in radios))[:6]}" if radios else ""))
    print(f"  CONCAVAS SIN RADIO: {len(vivas)}   <- las unicas que concentran")

    if a.tension_nominal:
        print(f"\nCON LA TENSION NOMINAL DECLARADA ({a.tension_nominal} MPa):")
        print(f"{'situacion':<34} {'Kt':>5} {'sigma':>8} {'SF estatico':>14} {'SF fatiga':>14}")
        for R, nom in ((0.0, "arista viva (Kt de esquina)"),
                       (0.25 * a.t_fino, f"R = 0,25.t = {0.25*a.t_fino:.2f}"),
                       (r_exigido, f"R = 0,50.t = {r_exigido:.2f}  <- exigido")):
            K = kt(R, a.t_fino)
            s = a.tension_nominal * K
            print(f"{nom:<34} {K:5.2f} {s:7.1f} MPa "
                  f"{f'{PLA_Z_ESTATICO[0]/s:.2f}-{PLA_Z_ESTATICO[1]/s:.2f}':>14} "
                  f"{f'{PLA_Z_FATIGA[0]/s:.2f}-{PLA_Z_FATIGA[1]/s:.2f}':>14}")
        s_ok = a.tension_nominal * kt(r_exigido, a.t_fino)
        if PLA_Z_FATIGA[0] / s_ok < 1.0:
            print(f"\n  [AVISO] aun con el radio exigido el SF a fatiga arranca en "
                  f"{PLA_Z_FATIGA[0]/s_ok:.2f}. Bajar la tension nominal (menos precarga, "
                  f"brazo mas largo) o imprimir la pieza con las capas A LO LARGO de la viga.")

    print()
    if vivas:
        print("las 8 aristas CONCAVAS sin radio mas largas (revisar si flexionan ahi):")
        for largo, t, c in vivas[:8]:
            print(f"   arista {t:<5} {largo:6.1f} mm  en ({c[0]:8.1f},{c[1]:7.1f},{c[2]:7.1f})")
        print(f"\n[FALLA] quedan {len(vivas)} aristas vivas. Las que esten donde hay flexion")
        print("        hay que redondearlas: construir la ranura con el fondo redondeado")
        print("        (caja + cilindro) en vez de addBox sola, o fillet en lote.")
    else:
        print("[OK] no quedan aristas concavas sin radio.")

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"vivas": len(vivas), "redondeadas": redondeadas,
                       "radio_exigido": r_exigido, "t_fino": a.t_fino}, f, indent=1)
    return 1 if vivas else 0


if __name__ == "__main__":
    sys.exit(main())
