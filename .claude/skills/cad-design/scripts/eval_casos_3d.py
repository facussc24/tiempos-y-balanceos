#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Interprete: cualquiera con Python 3.10+ (solo lee JSON).
#   python eval_casos_3d.py --casos ../data/casos_3d.json [--sim-normal N.json] [--sim-punta P.json] [--salida out.json]
"""eval_casos_3d.py — las preguntas de las fichas aplicadas a los casos de respuesta conocida (tanda 11, 17/10/2026).

Lo que NO es: el gate de asiento de la tanda 2 (`docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md`, espera el sí de Fak). Esto no
mide geometría: aplica las preguntas de `reference/ingenieria-de-producto.md` §2 sobre un inventario DECLARADO de apoyos
(`data/casos_3d.json`, cada dato con su fuente) y sobre los JSON que deja la simulación de asiento de la carpeta de
trabajo (`C:\\Dev\\_utrim\\sim_asiento.py` sin tocar, y `sim_asiento_v16.py` para la v16).

  A1 apoyos   — ROJO si más de `apoyos_z_max` elementos rígidos controlan la altura (Z y los dos giros) o más de
                `ubicadores_xy_max` ubican en el plano. Un tope antivuelco con luz no cuenta (no apoya en reposo).
  A2 ventana  — ROJO si la banda recta aprieta menos de `ventana_banda_min_mm` pasado el labio o la punta queda a menos
                de `ventana_punta_min_mm` de los pines.
  A3 asiento  — para una versión con número PUBLICADO, el eval exige que la simulación de hoy lo REPRODUZCA (si no, la
                simulación no sirve y sale con código 1); para la que no tiene número publicado (la v16), aplica los
                umbrales: % de casos que se hamacan > 0,3 mm, hamaca máxima y mediana apretando en la punta.

Sale 0 si cada caso da lo esperado en `esperado` (o si no hay `esperado`), 1 si un caso conocido no da lo que tiene que
dar o la simulación no reproduce lo publicado, 2 si faltan datos.
"""
import argparse
import json
import sys


def a1_apoyos(elementos, u):
    rig = [e for e in elementos if e.get("rigido")]
    z = [e["nombre"] for e in rig if e["tipo"] == "apoyo_z"]
    xy = [e["nombre"] for e in rig if e["tipo"] == "ubicador_xy"]
    rojo = len(z) > u["apoyos_z_max"] or len(xy) > u["ubicadores_xy_max"]
    motivo = []
    if len(z) > u["apoyos_z_max"]:
        motivo.append(f"{len(z)} apoyos rigidos controlan Z y los dos giros (maximo {u['apoyos_z_max']})")
    if len(xy) > u["ubicadores_xy_max"]:
        motivo.append(f"{len(xy)} ubicadores precisos en el plano (maximo {u['ubicadores_xy_max']})")
    return {"veredicto": "ROJO" if rojo else "VERDE", "apoyos_z": len(z), "ubicadores_xy": len(xy),
            "motivo": "; ".join(motivo) or f"{len(z)} apoyos en Z, {len(xy)} ubicador en el plano"}


def a1b_cuatro_coplanares(elementos, sup, u):
    """Renglon APARTE de A1 (no lo afloja): si son cuatro apoyos, ¿estan sobre UNA misma superficie medida? (4-2-1,
    Applied Engineering; la redundancia del cuarto se paga con coplanaridad). Informativo: lo valida la prueba fisica."""
    n = sum(1 for e in elementos if e.get("rigido") and e["tipo"] == "apoyo_z")
    if n <= u["apoyos_z_max"]:
        return {"veredicto": "NO APLICA", "motivo": f"{n} apoyos: alcanza con A1"}
    if not sup:
        return {"veredicto": "SIN DATO", "motivo": "falta 'apoyos_superficie' (cuantas superficies y dispersion)"}
    ok = n == 4 and sup["superficies"] == 1 and sup["dispersion_mm"] <= u["coplanar_dispersion_max_mm"]
    return {"veredicto": "VERDE" if ok else "ROJO", "apoyos": n, **sup,
            "motivo": "cuatro sobre una misma superficie (informativo: lo valida la prueba fisica)" if ok
            else "mas de cuatro, o repartidos en superficies distintas, o desnivel de mas"}


def a2_ventana(v, u):
    if not v:
        return {"veredicto": "SIN DATO"}
    rojo = v["banda"] < u["ventana_banda_min_mm"] or v["punta"] < u["ventana_punta_min_mm"]
    return {"veredicto": "ROJO" if rojo else "VERDE", "banda_mm": v["banda"], "punta_mm": v["punta"],
            "umbral": f"banda >= {u['ventana_banda_min_mm']}, punta >= {u['ventana_punta_min_mm']}"}


def fila(sim, pieza, tapados=True):
    for r in sim or []:
        if r.get("pieza") == pieza and r.get("listones_tapados", True) == tapados:
            return r
    return None


def a3_asiento(nombre, ver, normal, punta, u):
    pub = ver.get("sim_publicada")
    n = fila(normal, nombre, True)
    p = fila(punta, nombre, True)
    if n is None:
        return {"veredicto": "SIN DATO", "motivo": "no hay corrida de la simulacion para esta pieza"}
    out = {"hamaca_pct_hoy": n["pct_hamaca_mas_de_0_3"], "hamaca_max_mm_hoy": n["hamaca_max_mm"],
           "anillo_toca_plastico_pct": n["pct_anillo_toca_plastico"],
           "punta_mediana_mm_hoy": p["hamaca_mediana_mm"] if p else None}
    if pub:   # caso conocido: se exige reproducir
        dif, sin_comparar = [], []
        if "normal_tapados_pct" in pub and abs(n["pct_hamaca_mas_de_0_3"] - pub["normal_tapados_pct"]) > u["reproduccion_tol_pct"]:
            dif.append(f"normal {n['pct_hamaca_mas_de_0_3']} % contra {pub['normal_tapados_pct']} % publicado")
        ab = fila(normal, nombre, False)
        if "normal_abiertos_pct" in pub:
            if ab is None:
                sin_comparar.append("listones abiertos")
            elif abs(ab["pct_hamaca_mas_de_0_3"] - pub["normal_abiertos_pct"]) > u["reproduccion_tol_pct"]:
                dif.append(f"listones abiertos {ab['pct_hamaca_mas_de_0_3']} % contra {pub['normal_abiertos_pct']} %")
        if "punta_mediana_mm" in pub:
            if p is None:
                sin_comparar.append("punta")
            elif abs(p["hamaca_mediana_mm"] - pub["punta_mediana_mm"]) > u["reproduccion_tol_mm"]:
                dif.append(f"punta {p['hamaca_mediana_mm']} mm contra {pub['punta_mediana_mm']} mm")
        # 17/10 (auditor, I3): «reproduce» es true solo si se comparo CADA numero publicado; si falta una corrida, null
        out["reproduce_lo_publicado"] = False if dif else (None if sin_comparar else True)
        out["diferencias"] = dif
        out["sin_comparar"] = sin_comparar
        malo = n["pct_hamaca_mas_de_0_3"] > u["hamaca_pct_max"] or (p and p["hamaca_mediana_mm"] > u["punta_mediana_max_mm"])
        out["veredicto"] = "ROJO" if malo else "VERDE"
        return out
    malo = []
    if n["pct_hamaca_mas_de_0_3"] > u["hamaca_pct_max"]:
        malo.append(f"se hamaca > 0,3 mm en {n['pct_hamaca_mas_de_0_3']} % (max {u['hamaca_pct_max']} %)")
    if n["hamaca_max_mm"] > u["hamaca_max_mm"]:
        malo.append(f"hamaca maxima {n['hamaca_max_mm']} mm (max {u['hamaca_max_mm']})")
    if n["pct_anillo_toca_plastico"] > 0:
        malo.append(f"el anillo toca plastico en {n['pct_anillo_toca_plastico']} % de los casos")
    if p is None:
        malo.append("falta la corrida apretando en la punta")
    elif p["hamaca_mediana_mm"] > u["punta_mediana_max_mm"]:
        malo.append(f"apretando en la punta {p['hamaca_mediana_mm']} mm (max {u['punta_mediana_max_mm']})")
    out["veredicto"] = "ROJO" if malo else "VERDE"
    out["motivo"] = "; ".join(malo) or "dentro de los umbrales"
    return out


def evaluar(casos, normal=None, punta=None, solo=None):
    """solo: lista de versiones a evaluar (las demas se excluyen A PROPOSITO y se dice). Sin --solo, una version sin
    corrida es una FALLA: un control que no pudo medir no da OK (auditor del 17/10, I3)."""
    u = casos["umbrales"]
    res, fallas = {}, []
    for nombre, ver in casos["versiones"].items():
        if solo and nombre not in solo:
            continue
        r = {"A1_apoyos": a1_apoyos(ver.get("elementos", []), u),
             "A1b_4_2_1": a1b_cuatro_coplanares(ver.get("elementos", []), ver.get("apoyos_superficie"), u),
             "A2_ventana": a2_ventana(ver.get("ventana_mm"), u)}
        if normal is not None:
            r["A3_asiento"] = a3_asiento(nombre, ver, normal, punta, u)
            if r["A3_asiento"].get("reproduce_lo_publicado") is False:
                fallas.append(f"{nombre}: la simulacion de hoy NO reproduce lo publicado: {r['A3_asiento']['diferencias']}")
            elif "sim_publicada" in ver and r["A3_asiento"].get("reproduce_lo_publicado") is None:
                fallas.append(f"{nombre}: no se pudo comparar todo lo publicado (falta: "
                              f"{r['A3_asiento'].get('sin_comparar') or 'la corrida de esta pieza'})")
        for clave, esperado in (ver.get("esperado") or {}).items():
            got = r.get(clave, {}).get("veredicto")
            if got == "SIN DATO":
                fallas.append(f"{nombre} {clave}: SIN DATO (sin corrida o sin datos; para excluirla a proposito: --solo)")
            elif got is not None and got != esperado:
                fallas.append(f"{nombre} {clave}: dio {got}, se esperaba {esperado}")
        res[nombre] = r
    return res, fallas


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--casos", required=True)
    ap.add_argument("--sim-normal")
    ap.add_argument("--sim-punta")
    ap.add_argument("--salida")
    ap.add_argument("--solo", help="versiones a evaluar, separadas por coma (las demas quedan afuera a proposito)")
    a = ap.parse_args(argv)
    casos = json.load(open(a.casos, encoding="utf-8"))
    normal = json.load(open(a.sim_normal, encoding="utf-8")) if a.sim_normal else None
    punta = json.load(open(a.sim_punta, encoding="utf-8")) if a.sim_punta else None
    solo = [s.strip() for s in a.solo.split(",")] if a.solo else None
    if solo:
        print("evaluadas solo:", ", ".join(solo), "(las demas quedan afuera a proposito)")
    res, fallas = evaluar(casos, normal, punta, solo)
    for nombre, r in res.items():
        print(f"== {nombre}")
        for k, v in r.items():
            print(f"   {k:11s} {v.get('veredicto'):8s} {json.dumps({x: y for x, y in v.items() if x != 'veredicto'}, ensure_ascii=False)}")
    if a.salida:
        json.dump({"resultado": res, "fallas": fallas}, open(a.salida, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    for f in fallas:
        print("FALLA:", f)
    print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} falla(s)")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
