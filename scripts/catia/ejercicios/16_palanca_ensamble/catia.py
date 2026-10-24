# -*- coding: utf-8 -*-
"""Ejercicio 16 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): el 06 (palanca 0-60) como ENSAMBLE (CATProduct):
base, soporte y palanca cada una en su CATPart, y las RESTRICCIONES de Assembly Design las llevan a la pose de 0 grados.

Metodo del ej42 de la practica del 19/10 (ensamble bracket + eje, cdg al milesimo): puntos y planos con NOMBRE adentro de
cada pieza (en un set geometrico, ocultos), y restricciones de CATIA entre ellos por CreateReferenceFromName
(«raiz/instancia/!Nombre»). Coincidencias PUNTO-PUNTO (una de rectas puede salir invertida, catia.md).

Medidas: las del 06 del juez (scripts/catia/ejercicios/06_palanca_0_60/catia.py = _conjunto.py del banco 3D). Para que
las restricciones MUEVAN algo, el soporte y la palanca se dibujan en su propio sistema y entran al ensamble en el origen:
  base: en coordenadas del banco (260 x 140 x 10 desde (-60, -70, 0)), FIJA; puntos B_abajo (0, -21, 10) y B_arriba
    (0, -21, 95) donde va el soporte, y planos Base_XY y Base_ZX.
  soporte: 30 x 18 x 85 con el centro de abajo en su origen; puntos S_abajo (0, 0, 0) y S_arriba (0, 0, 85), el eje de la
    palanca como dos puntos E_mas (0, 31, 70) y E_menos (0, 11, 70) (en el banco: (0, +-10, 80)), plano Sop_ZX.
    Restricciones: S_abajo sobre B_abajo, S_arriba sobre B_arriba, Sop_ZX paralelo a Base_ZX (misma orientacion).
  palanca: el eje del cubo es su Z (cubo R15 de z -10 a 10) y la barra va por su +X (150 x 20 x 20); puntos PA (0, 0, -10)
    y PB (0, 0, 10) en las caras del cubo, plano Pal_ZX. Restricciones: PA sobre E_mas y PB sobre E_menos (el eje de la
    palanca COAXIAL con el del soporte) y Pal_ZX paralelo a Base_XY, misma orientacion (la barra horizontal hacia +X:
    pose 0 grados). Con las dos coincidencias la Z de la palanca queda en -Y del banco; con el paralelo, su Y en +Z; su X
    sale +X, sin ambiguedad.
El contacto del pedido no se puso: en el banco la palanca NO toca el soporte (cubo de y -10 a 10, soporte de y -30 a -12:
2 mm de luz); la posicion a lo largo del eje la fijan las coincidencias.

Se mide: la posicion de cada componente (Position.GetComponents por VBScript) contra la que tiene que dar, el volumen y el
centro de gravedad del CONJUNTO (Analyze.GetGravityCenter por VBScript; sin material, pesado por volumen) contra el de
build123d sobre el bien.py del 06, y el STEP del producto medido con build123d (tercer cruce).
ok = cada componente en su lugar (0,001 mm y 1e-6 en la rotacion) Y el conjunto como build123d (0,5 mm3, 0,01 mm).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el CATProduct, el STEP del conjunto y la captura BMP.
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

_spec = importlib.util.spec_from_file_location("ej06_catia", os.path.join(os.path.dirname(AQUI), "06_palanca_0_60",
                                                                          "catia.py"))
e06 = importlib.util.module_from_spec(_spec)                      # medidas de la palanca: las del 06 del juez
_spec.loader.exec_module(e06)

EJ = "06_palanca_0_60"
FIX, ON, PARALELO = 0, 2, 8                 # CatConstraintType (Reference, On, Parallelism): MecModTypeLib.tlb
MISMA, OPUESTA = 0, 1                       # CatConstraintOrientation (catCstOrientSame, catCstOrientOpposite)
TOL_POS, TOL_ROT = 1e-3, 1e-6

SOP_CENTRO = (e06.SX0 + e06.SL / 2, e06.SY0 + e06.SA / 2, e06.SZ0)        # (0, -21, 10): centro de abajo del soporte
PUNTOS_BASE = {"B_abajo": SOP_CENTRO, "B_arriba": (SOP_CENTRO[0], SOP_CENTRO[1], e06.SZ0 + e06.SH)}
EJE_BANCO = {"E_mas": (0.0, e06.MEDIO, e06.EJE_Z), "E_menos": (0.0, -e06.MEDIO, e06.EJE_Z)}
PUNTOS_SOP = {"S_abajo": (0.0, 0.0, 0.0), "S_arriba": (0.0, 0.0, e06.SH),
              **{k: tuple(p[i] - SOP_CENTRO[i] for i in range(3)) for k, p in EJE_BANCO.items()}}
PUNTOS_PAL = {"PA": (0.0, 0.0, -e06.MEDIO), "PB": (0.0, 0.0, e06.MEDIO)}
PLANOS = {"base": {"Base_XY": "xy", "Base_ZX": "zx"}, "soporte": {"Sop_ZX": "zx"}, "palanca": {"Pal_ZX": "zx"}}
NORMAL = {"xy": (0.0, 0.0, 1.0), "yz": (1.0, 0.0, 0.0), "zx": (0.0, 1.0, 0.0)}
PARALELOS = (("soporte", "Sop_ZX", "Base_ZX"), ("palanca", "Pal_ZX", "Base_XY"))     # orientacion «misma»
# donde tiene que quedar cada componente: (eje X, eje Y, eje Z de la pieza en el ensamble, origen)
POSE = {"soporte": ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), SOP_CENTRO),
        "palanca": ((1.0, 0.0, 0.0), (0.0, 0.0, 1.0), (0.0, -1.0, 0.0), (0.0, 0.0, e06.EJE_Z))}

MACRO_POS = """Function CATMain(p)
    Dim a(11)
    p.Position.GetComponents a
    CATMain = a(0) & ";" & a(1) & ";" & a(2) & ";" & a(3) & ";" & a(4) & ";" & a(5) & ";" & a(6) & ";" & a(7) & ";" & a(8) & ";" & a(9) & ";" & a(10) & ";" & a(11)
End Function"""
MACRO_CDG = """Function CATMain(p)
    Dim g(2)
    p.Analyze.GetGravityCenter g
    CATMain = g(0) & ";" & g(1) & ";" & g(2)
End Function"""


def num(t):
    return [float(x.replace(",", ".")) for x in str(t).split(";")]


# ------------------------------------------------------------------ la cuenta, en Python puro (sin CATIA)
def transformar(pose, p):
    ex, ey, ez, o = pose
    return tuple(o[i] + p[0] * ex[i] + p[1] * ey[i] + p[2] * ez[i] for i in range(3))


def girar(pose, v):
    ex, ey, ez, _o = pose
    return tuple(v[0] * ex[i] + v[1] * ey[i] + v[2] * ez[i] for i in range(3))


def coherencia():
    """Cada coincidencia de puntos y cada paralelo (normal rotada = normal del plano de la base, MISMO signo) tienen que
    cerrar con las poses esperadas (si no, el ensamble pedido es imposible). Devuelve el peor desvio."""
    pares = [("soporte", PUNTOS_SOP["S_abajo"], PUNTOS_BASE["B_abajo"]),
             ("soporte", PUNTOS_SOP["S_arriba"], PUNTOS_BASE["B_arriba"]),
             ("palanca", PUNTOS_PAL["PA"], transformar(POSE["soporte"], PUNTOS_SOP["E_mas"])),
             ("palanca", PUNTOS_PAL["PB"], transformar(POSE["soporte"], PUNTOS_SOP["E_menos"]))]
    peor = max(math.dist(transformar(POSE[c], p), q) for c, p, q in pares)
    for cual, plano, de_base in PARALELOS:            # revisor 24/10: la prueba no miraba los paralelos
        n = girar(POSE[cual], NORMAL[PLANOS[cual][plano]])
        peor = max(peor, math.dist(n, NORMAL[PLANOS["base"][de_base]]))
    return peor


def volumenes():
    return {"base": e06.BL * e06.BA * e06.BE, "soporte": e06.SL * e06.SA * e06.SH,
            "palanca": e06.V_CUBO + e06.V_BARRA_SUMA}


# ------------------------------------------------------------------ CATIA
def referencias(part, puntos, planos):
    """Set geometrico con puntos y planos (desplazados 0 de los de origen) con NOMBRE, para las restricciones."""
    hsf = part.HybridShapeFactory
    gs = part.HybridBodies.Add()
    gs.Name = "Referencias_ensamble"
    for nombre, (x, y, z) in puntos.items():
        p = hsf.AddNewPointCoord(float(x), float(y), float(z))
        gs.AppendHybridShape(p)
        p.Name = nombre
    for nombre, cual in planos.items():
        pl = hsf.AddNewPlaneOffset(part.CreateReferenceFromObject(jc.plano_origen(part, cual)), 0.0, False)
        gs.AppendHybridShape(pl)
        pl.Name = nombre
    part.Update()
    return gs


def guardar_cerrar(cb, reg, salida, doc, part, body, nombre, gs, otros=()):
    m = cb.medir(doc, part, body)
    salida["volumen_pieza_catia"][nombre] = m.get("volume")
    jc.ocultar(doc, gs)                     # CATIA exporta lo visible (catia.md); el set no tiene que ir al STEP
    for o in otros:
        jc.ocultar(doc, o)
    ruta = os.path.join(reg.carpeta, f"ensamble_{nombre}.CATPart")
    if os.path.exists(ruta):
        os.remove(ruta)
    doc.SaveAs(ruta)
    cb.exigir_archivo(ruta, f"guardar {nombre}")
    doc.Close()
    return {"ruta": ruta, "volumen": m.get("volume")}


def piezas(cb, c, reg, salida):
    rutas = {}

    def base():
        doc, part, body, sf = cb.nueva_pieza(c, "ensamble_base")
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"),
                        rects=[(e06.BX0, e06.BY0, e06.BX0 + e06.BL, e06.BY0 + e06.BA)])
        jc.extruir(cb, doc, part, body, sf, sk, e06.BE, volumenes()["base"],
                   (e06.BX0 + e06.BL / 2, e06.BY0 + e06.BA / 2, e06.BE / 2))
        gs = referencias(part, PUNTOS_BASE, PLANOS["base"])
        rutas["base"] = guardar_cerrar(cb, reg, salida, doc, part, body, "base", gs)
        return rutas["base"]

    def soporte():
        doc, part, body, sf = cb.nueva_pieza(c, "ensamble_soporte")
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"),
                        rects=[(-e06.SL / 2, -e06.SA / 2, e06.SL / 2, e06.SA / 2)])
        jc.extruir(cb, doc, part, body, sf, sk, e06.SH, volumenes()["soporte"], (0.0, 0.0, e06.SH / 2))
        gs = referencias(part, PUNTOS_SOP, PLANOS["soporte"])
        rutas["soporte"] = guardar_cerrar(cb, reg, salida, doc, part, body, "soporte", gs)
        return rutas["soporte"]

    def palanca():
        doc, part, body, sf = cb.nueva_pieza(c, "ensamble_palanca")
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), circulos=[(0.0, 0.0, e06.R_CUBO)])
        _, m, _i = jc.extruir(cb, doc, part, body, sf, sk, e06.MEDIO, e06.V_CUBO, simetrico=True)
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(0.0, -e06.MEDIO, e06.LARGO, e06.MEDIO)])
        jc.extruir(cb, doc, part, body, sf, sk, e06.MEDIO, e06.V_BARRA_SUMA, antes=m, simetrico=True)
        gs = referencias(part, PUNTOS_PAL, PLANOS["palanca"])
        rutas["palanca"] = guardar_cerrar(cb, reg, salida, doc, part, body, "palanca", gs)
        return rutas["palanca"]

    for que, fn in (("base 260 x 140 x 10 en coordenadas del banco, con B_abajo, B_arriba, Base_XY y Base_ZX", base),
                    ("soporte 30 x 18 x 85 en su origen, con S_abajo, S_arriba, el eje (E_mas, E_menos) y Sop_ZX",
                     soporte),
                    ("palanca con el eje del cubo en su Z y la barra en su +X, con PA, PB y Pal_ZX", palanca)):
        if reg.paso(que, fn) is None:
            return None
    return rutas


def ensamble(cb, c, reg, salida, rutas):
    doc = c.Documents.Add("Product")
    prod = doc.Product
    prod.PartNumber = "Ensamble_palanca_0_60"
    prods = prod.Products
    prods.AddComponentsFromFiles([rutas["base"]["ruta"], rutas["soporte"]["ruta"], rutas["palanca"]["ruta"]], "All")
    comp = {"base": prods.Item(1), "soporte": prods.Item(2), "palanca": prods.Item(3)}
    raiz = prod.PartNumber
    cons = prod.Connections("CATIAConstraints")
    est = {}

    def r(cual, nombre=None):
        n = comp[cual].Name
        return prod.CreateReferenceFromName(f"{raiz}/{n}/!{nombre}" if nombre else f"{raiz}/{n}/!{raiz}/{n}/")

    def pose(cual):
        a = num(cb.evaluar(c, MACRO_POS, comp[cual]))
        return {"ejes": [a[0:3], a[3:6], a[6:9]], "origen": a[9:12]}

    def restricciones():
        # revisor 24/10: dejar escrito DONDE estaban antes de resolver (si no, «las movieron» es una suposicion)
        salida["posiciones_antes"] = {k: pose(k) for k in ("soporte", "palanca")}
        cons.AddMonoEltCst(FIX, r("base"))
        cons.AddBiEltCst(ON, r("soporte", "S_abajo"), r("base", "B_abajo"))
        cons.AddBiEltCst(ON, r("soporte", "S_arriba"), r("base", "B_arriba"))
        p1 = cons.AddBiEltCst(PARALELO, r("soporte", "Sop_ZX"), r("base", "Base_ZX"))
        p1.Orientation = MISMA
        cons.AddBiEltCst(ON, r("palanca", "PA"), r("soporte", "E_mas"))
        cons.AddBiEltCst(ON, r("palanca", "PB"), r("soporte", "E_menos"))
        p2 = cons.AddBiEltCst(PARALELO, r("palanca", "Pal_ZX"), r("base", "Base_XY"))
        p2.Orientation = MISMA
        prod.Update()
        est["cons"], est["p2"] = cons, p2
        estados = []
        for i in range(1, cons.Count + 1):
            try:
                estados.append(int(cons.Item(i).Status))
            except Exception as e:  # noqa: BLE001
                estados.append(repr(e)[:60])
        return {"restricciones": cons.Count, "estados": estados}

    def posiciones():
        out = {cual: pose(cual) for cual in ("base", "soporte", "palanca")}
        salida["posiciones"] = out
        return {k: {"origen": [round(x, 4) for x in v["origen"]]} for k, v in out.items()}

    def conjunto():
        cdg = num(cb.evaluar(c, MACRO_CDG, prod))
        vol = float(prod.Analyze.Volume)
        salida["volumen_catia"]["conjunto"] = round(vol, 3)
        salida["cdg_catia_mm"]["conjunto"] = [round(x, 4) for x in cdg]
        return {"volumen": round(vol, 3), "cdg": [round(x, 4) for x in cdg]}

    def guardar():
        ruta = os.path.join(reg.carpeta, "Ensamble_palanca_0_60.CATProduct")
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.SaveAs(ruta)
        cb.exigir_archivo(ruta, "guardar el CATProduct")
        step = os.path.join(reg.carpeta, "Ensamble_palanca_0_60.stp")
        if os.path.exists(step):
            os.remove(step)
        doc.ExportData(step, "stp")
        cb.exigir_archivo(step, "exportar el STEP del conjunto")
        salida["_steps"]["conjunto"] = step
        for archivo in [ruta, step] + [rutas[k]["ruta"] for k in ("base", "soporte", "palanca")]:
            salida["archivos"].append(os.path.relpath(archivo, salida["_carpeta"]))   # el obrero copia solo lo declarado
        return {"catproduct": ruta, "step": step}

    def gemelo():
        """Revisor 24/10: que la orientacion «misma» decide la pose se MIDE: con la del paralelo de la palanca dada vuelta
        la barra tiene que quedar hacia -X; despues se vuelve a «misma» y la pose tiene que volver a la esperada."""
        est["p2"].Orientation = OPUESTA
        prod.Update()
        salida["gemelo_orientacion_opuesta"] = pose("palanca")
        est["p2"].Orientation = MISMA
        prod.Update()
        salida["posicion_restaurada"] = pose("palanca")
        return {"opuesta_eje_x": [round(x, 6) for x in salida["gemelo_orientacion_opuesta"]["ejes"][0]],
                "restaurada_eje_x": [round(x, 6) for x in salida["posicion_restaurada"]["ejes"][0]]}

    for que, fn in (("restricciones: base fija; soporte por S_abajo, S_arriba y Sop_ZX // Base_ZX; palanca por PA, PB "
                     "(coaxial con el eje del soporte) y Pal_ZX // Base_XY", restricciones),
                    ("posicion de cada componente (Position.GetComponents)", posiciones),
                    ("volumen y centro de gravedad del conjunto (Analyze)", conjunto),
                    ("guardar el CATProduct y el STEP del conjunto", guardar),
                    ("gemelo: el paralelo de la palanca con orientacion OPUESTA (la barra hacia -X) y de vuelta", gemelo)):
        if reg.paso(que, fn) is None:
            break
    bmp = reg.paso("captura BMP del conjunto", lambda: jc.captura_bmp(c, reg.carpeta, "Ensamble_palanca_0_60"))
    if bmp:
        salida["archivos"].append(os.path.relpath(bmp, salida["_carpeta"]))
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def construir(cb, c, reg, salida):
    vb, cdg = dict(salida.get("volumen_build123d") or {}), dict(salida.get("cdg_build123d_mm") or {})
    salida["build123d_partes"] = {"volumen": vb, "cdg_mm": cdg}
    partes = [k for k in ("base", "soporte", "palanca") if vb.get(k) is not None and cdg.get(k)]
    if len(partes) == 3:                    # el conjunto de build123d: suma de volumenes, cdg pesado por volumen
        v = sum(vb[k] for k in partes)
        salida["volumen_build123d"] = {"conjunto": round(v, 3)}
        salida["cdg_build123d_mm"] = {"conjunto": [round(sum(vb[k] * cdg[k][i] for k in partes) / v, 4)
                                                   for i in range(3)]}
    else:
        salida["volumen_build123d"], salida["cdg_build123d_mm"] = {}, {}
        salida["error_build123d"] = f"build123d no dio las tres partes: {sorted(vb)}"
    salida.update({"volumen_pieza_catia": {}, "volumen_pieza_cuenta": {k: round(v, 3) for k, v in volumenes().items()},
                   "coherencia_mm": coherencia(), "pose_esperada": POSE})
    rutas = piezas(cb, c, reg, salida)
    if rutas:
        ensamble(cb, c, reg, salida, rutas)


def cerrar_con_posiciones(carpeta):
    """Despues de correr_ejercicio (ok = el conjunto como build123d): cada componente en la pose esperada."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    pos = s.get("posiciones") or {}
    problemas, dif = [], {}
    esperado = {"base": ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, 0.0)), **POSE}
    for cual, (ex, ey, ez, o) in esperado.items():
        p = pos.get(cual)
        if not p:
            problemas.append(f"{cual}: sin posicion leida")
            continue
        d_rot = max(abs(a - b) for eje, esp in zip(p["ejes"], (ex, ey, ez)) for a, b in zip(eje, esp))
        d_pos = math.dist(p["origen"], o)
        dif[cual] = {"rotacion": d_rot, "origen_mm": round(d_pos, 6)}
        if d_rot > TOL_ROT or d_pos > TOL_POS:
            problemas.append(f"{cual} fuera de lugar: rotacion {d_rot:.2e}, origen a {d_pos:.4f} mm de {list(o)}")
    # gemelo: con la orientacion opuesta la barra va hacia -X (la orientacion decide); de vuelta, la pose esperada
    op, rest = s.get("gemelo_orientacion_opuesta"), s.get("posicion_restaurada")
    if not op or not rest:
        problemas.append("sin el gemelo de la orientacion (no se puede saber si «misma» decidio la pose)")
    else:
        if math.dist(op["ejes"][0], (-1.0, 0.0, 0.0)) > TOL_ROT * 10:
            problemas.append(f"con la orientacion opuesta la barra no fue a -X: eje X {op['ejes'][0]}")
        ex, ey, ez, o = POSE["palanca"]
        if max(abs(a - b) for eje, esp in zip(rest["ejes"], (ex, ey, ez)) for a, b in zip(eje, esp)) > TOL_ROT or \
                math.dist(rest["origen"], o) > TOL_POS:
            problemas.append(f"de vuelta a «misma» la palanca no volvio a su pose: {rest}")
    s["dif_posiciones"] = dif
    s["ok_posiciones"] = not problemas
    s["ok"] = s["ok_cruce_build123d"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_POSICIONES", json.dumps({"ok": s["ok"], "ok_cruce_build123d": s["ok_cruce_build123d"],
                                        "ok_posiciones": s["ok_posiciones"], "dif": dif}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_posiciones(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar las posiciones en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
