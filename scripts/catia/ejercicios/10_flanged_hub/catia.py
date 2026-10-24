# -*- coding: utf-8 -*-
"""Ejercicio 10 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): Too Tall Toby PPP01-07 «Flanged Hub» (guia de
build123d, tttt.html#ttt-ppp0107) hecho en CATIA Part Design por COM, con la masa contra la que publica la guia.

Geometria: la del ejercicio 16 del banco 3D (evals/banco3d/ejercicios/16_ttt_flanged_hub/_flanged_hub.py: lectura del
plano de la practica del 23/10, sha256 en su tarea.yaml), con las MISMAS cotas y en las MISMAS coordenadas que el STEP
de su bien.py: Z = eje del cubo, cara de abajo de la brida en z 0, un nervio sobre +X. La practica del 19/10 (ej32) hizo
el nervio con Stiffener de espesor parejo y le dio 373,51 g: el nervio del banco es una CUNA (3 en el filo, 20 grados
incluidos), y un Stiffener no la hace. Aca la cuna es un prisma de seccion trapecial, como en _flanged_hub.nervio().

Orden en CATIA (con build123d se midio que da el mismo solido que el orden del banco: 138 144,669 mm3 los dos):
  1. Shaft del exterior SIN el rebaje: perfil (r, z) en el croquis ZX (H -> Z, V -> X) con los cuatro R3 de afuera
     dibujados como arcos (pie del cubo, canto de 84, pie del escalon, canto de la brida), eje = CenterLine sobre Z.
  2. Nervio en +X: trapecio en un plano normal al filo (AddNewPlaneEquation) por el medio del filo, pad simetrico de 20
     por lado. Sus puntos se proyectan sobre las direcciones del plano que devuelve CATIA (Measurable.GetPlane): no se
     adivina la H y la V de un plano por ecuacion. Patron circular x3 alrededor de Z.
  3. Groove del rebaje de 73 x 18 con su R3 del techo (arco del croquis): saca tambien las partes del prisma que caen
     en el hueco (por eso el banco recorta el nervio con una caja: aca no hace falta).
  4. Agujero con caja (Hole Type 2: 6 pasante, caja 13 x 4) desde la cara de z 8 en x 53,975, patron circular x6.
  5. Agujero de 20 pasante: pocket simetrico desde XY.
Cada operacion se mide contra lo que tiene que sumar o sacar: lo de revolucion por Pappus (Green sobre el perfil, en
Python puro), los agujeros por cuenta cerrada, y el nervio por build123d (587,781 mm3 y su centro, medido el 24/10 en
CATA con el mismo prisma: la prueba lo reproduce cuando hay build123d).
Material: aluminio del catalogo con la densidad del rotulo (aleacion 1060, 2 700 kg/m3), como el 08.

ok = cruce con build123d (0,5 mm3 y 0,01 mm de centro de gravedad, juez_comun) Y masa de CATIA a 1 g o menos de 372,99 g.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, flanged_hub.stp y la captura BMP.
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

_spec = importlib.util.spec_from_file_location("ej08_catia", os.path.join(os.path.dirname(AQUI), "08_c_clamp_base",
                                                                          "catia.py"))
e08 = importlib.util.module_from_spec(_spec)                      # dibujar, barrido, plano, material: los del 08
_spec.loader.exec_module(e08)

EJ = "16_ttt_flanged_hub"           # id del ejercicio del BANCO 3D: de ahi sale el bien.py del cruce
PARTE = "flanged_hub"               # el .step que escribe bien.py (medir_b123d nombra la parte asi)
MASA_GUIA_G = 372.99                # «Object Mass 372.99 g» de la guia (tarea.yaml del 16)
TOL_MASA_G = 1.0                    # lectura.md de la practica (tarea.yaml del 16)
DENSIDAD_PLANO = 2700.0             # kg/m3, aleacion 1060 (rotulo del plano, tarea.yaml del 16)
TOL_COHERENCIA = 1e-3

# cotas: las de _flanged_hub.py del banco (la prueba exige que sean las mismas)
R_BRIDA, E_BRIDA = 65.0, 8.0
R_ESC, Z_ESC = 42.0, 25.0
R_CUBO, Z_CUBO = 17.5, 52.0
R_AGUJ = 10.0
R_REB, Z_REB = 36.5, 18.0
R_FIL = 3.0
R_BC = 107.95 / 2
D_PAS, D_CAJA, PROF_CAJA = 6.0, 13.0, 4.0
NERV_R0 = R_ESC - 8.0
NERV_FILO, NERV_ANG = 3.0, 20.0
NERV_PROF, NERV_MITAD = 20.0, 20.0  # profundidad del trapecio (T) y extrusion por lado de _flanged_hub.nervio()

# lo que build123d midio del nervio en +X agregado al exterior (prisma entero menos el exterior con sus R3), CATA 24/10
NERVIO_DV_B123D = 587.781
NERVIO_CENTRO_B123D = (22.6181, 0.0, 30.1705)
TOL_CENTRO_NERVIO = 0.01            # mm

S2 = math.sqrt(0.5)


# ------------------------------------------------------------------ la cuenta, en Python puro (sin CATIA)
def perfil_exterior():
    """Media seccion (r, z) del exterior sin el rebaje, cerrada por el eje, con los cuatro R3 como arcos ("A", centro,
    r, a, b, medio)."""
    f = R_FIL
    return [
        ("L", (0.0, 0.0), (R_BRIDA, 0.0)),
        ("L", (R_BRIDA, 0.0), (R_BRIDA, E_BRIDA - f)),
        ("A", (R_BRIDA - f, E_BRIDA - f), f, (R_BRIDA, E_BRIDA - f), (R_BRIDA - f, E_BRIDA),
         (R_BRIDA - f + f * S2, E_BRIDA - f + f * S2)),                                    # canto de la brida (convexo)
        ("L", (R_BRIDA - f, E_BRIDA), (R_ESC + f, E_BRIDA)),
        ("A", (R_ESC + f, E_BRIDA + f), f, (R_ESC + f, E_BRIDA), (R_ESC, E_BRIDA + f),
         (R_ESC + f - f * S2, E_BRIDA + f - f * S2)),                                      # pie del escalon (concavo)
        ("L", (R_ESC, E_BRIDA + f), (R_ESC, Z_ESC - f)),
        ("A", (R_ESC - f, Z_ESC - f), f, (R_ESC, Z_ESC - f), (R_ESC - f, Z_ESC),
         (R_ESC - f + f * S2, Z_ESC - f + f * S2)),                                        # canto de 84 (convexo)
        ("L", (R_ESC - f, Z_ESC), (R_CUBO + f, Z_ESC)),
        ("A", (R_CUBO + f, Z_ESC + f), f, (R_CUBO + f, Z_ESC), (R_CUBO, Z_ESC + f),
         (R_CUBO + f - f * S2, Z_ESC + f - f * S2)),                                       # pie del cubo (concavo)
        ("L", (R_CUBO, Z_ESC + f), (R_CUBO, Z_CUBO)),
        ("L", (R_CUBO, Z_CUBO), (0.0, Z_CUBO)),
        ("L", (0.0, Z_CUBO), (0.0, 0.0)),
    ]


def perfil_rebaje():
    """Media seccion (r, z) de lo que saca el rebaje: r < 36,5 y z < 18 menos el R3 concavo del techo (desde z -1)."""
    f = R_FIL
    return [
        ("L", (0.0, -1.0), (R_REB, -1.0)),
        ("L", (R_REB, -1.0), (R_REB, Z_REB - f)),
        ("A", (R_REB - f, Z_REB - f), f, (R_REB, Z_REB - f), (R_REB - f, Z_REB),
         (R_REB - f + f * S2, Z_REB - f + f * S2)),
        ("L", (R_REB - f, Z_REB), (0.0, Z_REB)),
        ("L", (0.0, Z_REB), (0.0, -1.0)),
    ]


def volumen_revolucion(tramos):
    """Volumen de revolucion alrededor de r = 0 (Pappus por Green: V = 2 pi | integral de r^2/2 dz |)."""
    s = 0.0
    for t in tramos:
        if t[0] == "L":
            (r0, z0), (r1, z1) = t[1], t[2]
            dr, dz = r1 - r0, z1 - z0
            s += dz / 2 * (r0 * r0 + r0 * dr + dr * dr / 3)
        else:
            _, c, R, a, b, m = t
            ini, fin, p0, _p1 = e08.barrido(c, a, b, m)
            t0, t1 = (ini, fin) if p0 == a else (fin, ini)

            def prim(x):
                return (R / 2) * (c[0] ** 2 * math.sin(x) + 2 * c[0] * R * (x / 2 + math.sin(2 * x) / 4)
                                  + R * R * (math.sin(x) - math.sin(x) ** 3 / 3))
            s += prim(t1) - prim(t0)
    return abs(2 * math.pi * s)


def geometria():
    """Volumen que suma o saca cada operacion en el orden de CATIA, y el total (mm3)."""
    ext = volumen_revolucion(perfil_exterior())
    reb = volumen_revolucion(perfil_rebaje()) - math.pi * R_REB ** 2 * 1.0     # la franja z -1..0 esta debajo de la pieza
    uno_agujero = math.pi * (D_PAS / 2) ** 2 * (E_BRIDA - PROF_CAJA) + math.pi * (D_CAJA / 2) ** 2 * PROF_CAJA
    ops = [
        ("exterior", ext),
        ("nervio", NERVIO_DV_B123D),
        ("nervios_patron", 2 * NERVIO_DV_B123D),
        ("rebaje", -reb),
        ("agujero_caja", -uno_agujero),
        ("agujeros_patron", -5 * uno_agujero),
        ("agujero_20", -math.pi * R_AGUJ ** 2 * (Z_CUBO - Z_REB)),     # el cubo entre el techo del rebaje y la cara de arriba
    ]
    return {"ops": ops, "volumen": sum(v for _, v in ops)}


def nervio_3d():
    """El filo del nervio en +X, la normal del plano (a lo largo del filo, como z_dir de _flanged_hub) y las cuatro
    esquinas del trapecio en el mundo."""
    a = (NERV_R0, 0.0, Z_ESC)
    b = (R_CUBO, 0.0, Z_ESC + (NERV_R0 - R_CUBO))
    medio = tuple((p + q) / 2 for p, q in zip(a, b))
    largo = math.dist(a, b)
    u = tuple((q - p) / largo for p, q in zip(a, b))
    y = (0.0, 1.0, 0.0)
    adentro = (u[1] * y[2] - u[2] * y[1], u[2] * y[0] - u[0] * y[2], u[0] * y[1] - u[1] * y[0])   # z_dir x x_dir
    k = math.tan(math.radians(NERV_ANG / 2))
    w = NERV_FILO / 2
    loc = [(-w, 0.0), (w, 0.0), (w + NERV_PROF * k, NERV_PROF), (-w - NERV_PROF * k, NERV_PROF)]
    esquinas = [tuple(medio[i] + s * y[i] + t * adentro[i] for i in range(3)) for s, t in loc]
    return {"medio": medio, "normal": u, "adentro": adentro, "esquinas": esquinas,
            "d": sum(n * p for n, p in zip(u, medio))}


def proyectar(p, origen, d1, d2):
    q = [p[i] - origen[i] for i in range(3)]
    return (sum(q[i] * d1[i] for i in range(3)), sum(q[i] * d2[i] for i in range(3)))


# ------------------------------------------------------------------ CATIA
def a_croquis_zx(p):
    r, z = p
    return jc.EJES["zx"](r, 0.0, z)


def croquis_revolucion(cb, part, body, tramos):
    """Croquis en ZX con la media seccion y la CenterLine sobre el eje Z (como el ej32: una recta del croquis de h -5 a
    60 en v 0)."""
    sk = body.Sketches.Add(cb.ref(part, jc.plano_origen(part, "zx")))
    f = sk.OpenEdition()
    e08.dibujar(f, tramos, a_croquis_zx)
    eje = f.CreateLine(-5.0, 0.0, Z_CUBO + 8.0, 0.0)
    sk.CenterLine = eje
    sk.CloseEdition()
    part.Update()
    return sk


def leer_plano(cb, doc, part, plano):
    m = doc.GetWorkbench("SPAWorkbench").GetMeasurable(part.CreateReferenceFromObject(plano))
    v = [float(s.replace(",", ".")) for s in cb.evaluar(doc.Application, e08.MACRO_PLANO, m).split(";")]
    return v[:3], v[3:6], v[6:9]


def medir_fino(cb, doc, part, body):
    """Volumen y centro de gravedad SIN redondear (cb.medir redondea el centro a 0,001 mm: para el centro de algo chico
    agregado a algo grande, la resta de dos centros redondeados erra hasta (v0 + v1) x 0,0005 / dv = 0,38 mm con el
    nervio de 588 mm3 sobre 226 000; corrida 1 del 24/10: 0,32 mm en z)."""
    m = doc.GetWorkbench("SPAWorkbench").GetMeasurable(cb.ref(part, body))
    cog = [float(x.replace(",", ".")) for x in cb.evaluar(doc.Application, cb.MACRO_COG, m).split(";")]
    return {"volume": float(m.Volume) * 1e9, "cdg_mm": cog}


def medir_cambio(cb, doc, part, body, antes, esperado, que):
    m = cb.medir(doc, part, body)
    dv, cen = jc._agregado(antes, m)
    info = {"dv": round(dv, 3), "dv_esperado": round(esperado, 3), "centro": cen and [round(x, 3) for x in cen]}
    if abs(dv - esperado) > 1.0:
        raise RuntimeError(f"{que}: no da lo de la cuenta: {info}")
    return m, info


def material_y_masa(cb, c, doc, part):
    viejo = e08.DENSIDAD_PLANO
    e08.DENSIDAD_PLANO = DENSIDAD_PLANO              # el 08 lee su constante: es la misma aleacion, igual se fija
    try:
        return e08.material_y_masa(cb, c, doc, part, {})
    finally:
        e08.DENSIDAD_PLANO = viejo


def construir(cb, c, reg, salida):
    g = geometria()
    ops = dict(g["ops"])
    salida.update({"volumen_cuenta_mm3": round(g["volumen"], 3), "ops_cuenta_mm3": {k: round(v, 3) for k, v in ops.items()},
                   "masa_guia_g": MASA_GUIA_G})
    doc, part, body, sf = cb.nueva_pieza(c, PARTE)
    hsf = part.HybridShapeFactory
    est = {"m": None, "ocultos": []}

    def exterior():
        sk = croquis_revolucion(cb, part, body, perfil_exterior())
        sh = sf.AddNewShaft(sk)
        sh.FirstAngle.Value = 360.0
        part.Update()
        est["m"], info = medir_cambio(cb, doc, part, body, None, ops["exterior"], "shaft del exterior")
        return info

    def eje_z():
        if "eje" not in est:
            centro = hsf.AddNewPointCoord(0.0, 0.0, 0.0)
            body.InsertHybridShape(centro)
            eje = hsf.AddNewLinePtDir(centro, hsf.AddNewDirectionByCoord(0.0, 0.0, 1.0), 0.0, Z_CUBO + 8.0, False)
            body.InsertHybridShape(eje)
            part.Update()
            est.update(centro=centro, eje=eje)
            est["ocultos"] += [centro, eje]
        return est["centro"], est["eje"]

    def nervio():
        n = nervio_3d()
        pl = hsf.AddNewPlaneEquation(n["normal"][0], n["normal"][1], n["normal"][2], n["d"])
        body.InsertHybridShape(pl)
        part.Update()
        est["ocultos"].append(pl)
        origen, d1, d2 = leer_plano(cb, doc, part, pl)
        orto = max(abs(sum(d1[i] * d2[i] for i in range(3))), abs(sum(x * x for x in d1) - 1),
                   abs(sum(x * x for x in d2) - 1), abs(sum(d1[i] * n["normal"][i] for i in range(3))),
                   abs(sum(d2[i] * n["normal"][i] for i in range(3))))
        if orto > 1e-6:
            raise RuntimeError(f"las direcciones del plano no son ortonormales al filo: {d1} {d2} (desvio {orto})")
        pts = [proyectar(p, origen, d1, d2) for p in n["esquinas"]]
        sk = body.Sketches.Add(cb.ref(part, pl))
        f = sk.OpenEdition()
        cb.poligono(f, pts)
        sk.CloseEdition()
        part.Update()
        fino0 = medir_fino(cb, doc, part, body)
        feat, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, NERV_MITAD, ops["nervio"], antes=est["m"],
                                          simetrico=True)
        _dv, cen = jc._agregado(fino0, medir_fino(cb, doc, part, body))
        lejos = cen is None or math.dist(cen, NERVIO_CENTRO_B123D) > TOL_CENTRO_NERVIO
        info.update({"plano": {"origen": origen, "d1": d1, "d2": d2}, "croquis": [[round(x, 4) for x in p] for p in pts],
                     "centro_fino": cen and [round(x, 4) for x in cen], "centro_b123d": list(NERVIO_CENTRO_B123D)})
        if lejos:
            raise RuntimeError(f"el nervio no quedo donde build123d: {info}")
        est["nervio"] = feat
        return info

    def patron_nervios():
        centro, eje = eje_z()
        sf.AddNewCircPattern(est["nervio"], 1, 3, 0.0, 120.0, 1, 1, cb.ref(part, centro), cb.ref(part, eje), False, 0.0,
                             True)
        part.Update()
        est["m"], info = medir_cambio(cb, doc, part, body, est["m"], ops["nervios_patron"], "patron de los nervios")
        return info

    def rebaje():
        sk = croquis_revolucion(cb, part, body, perfil_rebaje())
        gr = sf.AddNewGroove(sk)
        gr.FirstAngle.Value = 360.0
        part.Update()
        est["m"], info = medir_cambio(cb, doc, part, body, est["m"], ops["rebaje"], "groove del rebaje")
        return info

    def agujero_caja():
        caras = [d for d in cb.topologia(doc, body, "Face")
                 if "cdg" in d and abs(d["cdg"][2] - E_BRIDA) < 0.01 and math.hypot(d["cdg"][0], d["cdg"][1]) < 0.01]
        if len(caras) != 1:
            raise RuntimeError(f"cara de arriba de la brida (z {E_BRIDA:g}, centrada): {len(caras)} candidatas")
        h = sf.AddNewHoleFromPoint(float(R_BC), 0.0, float(E_BRIDA), caras[0]["ref"], 10.0)
        # el boceto del punto del Hole quedaba visible: el STEP salia con un vertice suelto en (53,975; 0; 8) (medido el
        # 24/10 en 10_r3, PEDIDO 32); se oculta con lo demas antes de exportar
        try:
            est["ocultos"].append(h.Sketch)
        except Exception as e:  # noqa: BLE001
            salida["boceto_del_hole"] = repr(e)[:120]
        h.Type = 2                                  # catCounterboredHole (CatHoleType), como el ej32
        h.Diameter.Value = D_PAS
        h.HeadDiameter.Value = D_CAJA
        h.HeadDepth.Value = PROF_CAJA
        h.BottomType = 0                            # catFlatHoleBottom
        h.BottomLimit.LimitMode = 2                 # catUpToLastLimit
        part.Update()
        m = cb.medir(doc, part, body)
        dv, _ = jc._agregado(est["m"], m)
        info = {"dv": round(dv, 3), "dv_esperado": round(ops["agujero_caja"], 3)}
        if abs(dv - ops["agujero_caja"]) > 1.0:
            h.Reverse()
            part.Update()
            m = cb.medir(doc, part, body)
            dv, _ = jc._agregado(est["m"], m)
            info.update({"invertido": True, "dv": round(dv, 3)})
            if abs(dv - ops["agujero_caja"]) > 1.0:
                raise RuntimeError(f"el agujero con caja no saca lo de la cuenta: {info}")
        est["m"], est["agujero"] = m, h
        return info

    def patron_agujeros():
        centro, eje = eje_z()
        sf.AddNewCircPattern(est["agujero"], 1, 6, 0.0, 60.0, 1, 1, cb.ref(part, centro), cb.ref(part, eje), False, 0.0,
                             True)
        part.Update()
        est["m"], info = medir_cambio(cb, doc, part, body, est["m"], ops["agujeros_patron"], "patron de los agujeros")
        return info

    def agujero_20():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), circulos=[(0.0, 0.0, R_AGUJ)])
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, Z_CUBO + 8.0, ops["agujero_20"], antes=est["m"],
                                       vaciado=True, simetrico=True)
        return info

    pasos = [
        ("exterior por Shaft (brida 130 x 8, escalon 84 x 25, cubo 35 x 52, cuatro R3 como arcos), eje Z", exterior),
        (f"nervio en +X: trapecio {NERV_FILO:g} en el filo y {NERV_ANG:g} grados en un plano normal al filo, pad de "
         f"{NERV_MITAD:g} por lado", nervio),
        ("patron circular de los nervios x3 alrededor de Z", patron_nervios),
        (f"rebaje {2 * R_REB:g} x {Z_REB:g} con el R3 del techo, por Groove", rebaje),
        (f"agujero con caja {D_PAS:g} / {D_CAJA:g} x {PROF_CAJA:g} desde z {E_BRIDA:g} en x {R_BC:g} (Hole Type 2)",
         agujero_caja),
        ("patron circular de los agujeros x6 alrededor de Z", patron_agujeros),
        (f"agujero de {2 * R_AGUJ:g} pasante (pocket simetrico desde XY)", agujero_20),
    ]
    for que, fn in pasos:
        if reg.paso(que, fn) is None:
            break
    if est["m"] is None:                    # cuerpo vacio: medirlo (tambien la inercia) rompe la sesion (catia.md)
        salida["material_catia"] = {"ok": False, "error": "no se aplico: el exterior no se pudo hacer"}
    else:
        m = material_y_masa(cb, c, doc, part)
        salida["material_catia"] = {k: v for k, v in m.items() if k != "traza"}
        if m.get("traza"):
            reg.datos["material_traza"] = m["traza"]
        if m["ok"]:
            salida["masa_catia_g"] = round(m["masa_inercia_kg"] * 1000.0, 3)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE, ocultos=est["ocultos"])
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def cerrar_con_masa(carpeta):
    """Despues de correr_ejercicio (que decide el ok con el cruce de volumen): la masa de CATIA contra la de la guia."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    masa = s.get("masa_catia_g")
    mat = s.get("material_catia") or {}
    s["masa_guia_g"], s["tolerancia_masa_g"] = MASA_GUIA_G, TOL_MASA_G
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    if masa is None:
        s["dif_masa_g"], s["ok_masa"] = None, None
        s["masa_no_leida"] = mat.get("error", "no se llego a aplicar el material")
        texto = f"sin masa de CATIA: {s['masa_no_leida']}"        # revisor 24/10: el obrero publica «error»
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    else:
        s["dif_masa_g"] = round(masa - MASA_GUIA_G, 3)
        coherente = False
        if vc:
            implicita = masa / vc * 1e6
            coherente = abs(implicita - DENSIDAD_PLANO) <= TOL_COHERENCIA * DENSIDAD_PLANO
            s["masa_sobre_volumen"] = {"densidad_implicita_kg_m3": round(implicita, 3), "coherente": coherente}
        s["ok_masa"] = abs(s["dif_masa_g"]) <= TOL_MASA_G and coherente
        if not s["ok_masa"]:
            texto = (f"masa de CATIA {masa} g a {s['dif_masa_g']} g de la guia ({MASA_GUIA_G} +- {TOL_MASA_G:g}) o sin "
                     "coherencia con el volumen")
            s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    s["ok"] = s["ok_cruce_build123d"] and s["ok_masa"] is True          # sin la masa de CATIA no hay verde
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MASA", json.dumps({"ok": s["ok"], "ok_cruce_build123d": s["ok_cruce_build123d"], "ok_masa": s["ok_masa"],
                                  "masa_catia_g": masa, "dif_masa_g": s["dif_masa_g"]}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_masa(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo agregar la masa a salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
