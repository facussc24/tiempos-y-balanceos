# -*- coding: utf-8 -*-
"""Ejercicio 08 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): Too Tall Toby PPP01-03 «C Clamp Base» (guia de
build123d, tttt.html#ttt-ppp0103) hecho en CATIA Part Design por COM, con la masa contra la que publica la guia.

Geometria: la del ejercicio 14 del banco 3D (evals/banco3d/ejercicios/14_ttt_c_clamp_base/_c_clamp_base.py: lectura del
plano de la practica del 23/10, sha256 en su tarea.yaml), con las MISMAS cotas y en las MISMAS coordenadas que el STEP
de su bien.py: X a lo ancho (cara exterior del brazo izquierdo en x 0), Z arriba (fondo en z 0), Y el espesor (-8..8).

Operaciones, cada una medida contra su cuenta (geometria(), Python puro; la prueba la cruza con _c_clamp_base):
  1. U de perfil en un croquis del plano ZX (H -> Z, V -> X) con los R18 de afuera y los R7 de adentro dibujados como
     arcos (no redondeos por COM), pad simetrico de 8 por lado desde y 0.
  2. Tope izquierdo R8 de x -9 a 14 (eje en z 34): circulo en un plano paralelo a YZ en x 2,5, pad de 11,5 por lado.
  3. Tope derecho R8 de x 77 a 95: plano en x 86, pad de 9 por lado. La posicion de cada plano se lee de CATIA
     (Measurable.GetPlane) antes de dibujar: el sentido del desplazamiento desde YZ no estaba medido.
  4. Agujero de 5,5 pasante con avellanado de 11,2 x 90 en la cara izquierda (x -9): Hole con Type 3 (avellanado),
     modo profundidad + angulo (el del ej33 de la practica del 19/10), hasta el ultimo; si no saca lo de la cuenta
     (ni dado vuelta), el paso falla.
Material: aluminio del catalogo de CATIA con la densidad del rotulo del plano (aleacion 1060, 2 700 kg/m3): si el
catalogo trae otra, se cambia el parametro Density del material y se relee. Masa: SPAWorkbench.Inertias, en kg. Si la
densidad no queda en 2 700, CATIA no da la masa del ejercicio: salida.json lo dice en «error» y no hay verde.

ok = cruce con build123d (0,5 mm3 y 0,01 mm de centro de gravedad, juez_comun) Y masa de CATIA a 1 g o menos de 96,13 g.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, c_clamp_base.stp y la captura BMP.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

EJ = "14_ttt_c_clamp_base"          # id del ejercicio del BANCO 3D: de ahi sale el bien.py del cruce
PARTE = "c_clamp_base"              # el .step que escribe bien.py (medir_b123d nombra la parte asi)
MASA_GUIA_G = 96.13                 # «Object Mass 96.13 g» de la guia (tarea.yaml del 14)
TOL_MASA_G = 1.0                    # rotulo del plano segun la lectura (tarea.yaml del 14)
DENSIDAD_PLANO = 2700.0             # kg/m3, aleacion 1060 (rotulo del plano, tarea.yaml del 14)
DENSIDAD_SIN_MATERIAL = 1000.0      # lo que da CATIA sin material (catia.md)
TOL_COHERENCIA = 1e-3               # masa / volumen contra la densidad (0,1 %)

# cotas: las de _c_clamp_base.py del banco (la prueba exige que sean las mismas)
ANCHO, ESP = 95.0, 16.0
BRAZO_IZQ, BRAZO_DER = 14.0, 18.0
BASE = 16.0
EJE_Z = 34.0
R_EXT, R_INT = 18.0, 7.0
D_TOPE, L_TOPE_IZQ = 16.0, 23.0
D_AGUJ, D_AVELL = 5.5, 11.2

TAU = 2.0 * math.pi
S2 = math.sqrt(0.5)


# ------------------------------------------------------------------ la cuenta, en Python puro (sin CATIA)
def perfil():
    """Contorno de la U en el mundo (x, z), cerrado, como tramos ("L", a, b) y ("A", centro, r, a, b, medio): el arco va
    de a a b pasando por medio (asi el sentido no depende de la mano del croquis)."""
    x1, x2 = BRAZO_IZQ, ANCHO - BRAZO_DER
    return [
        ("L", (R_EXT, 0.0), (ANCHO - R_EXT, 0.0)),
        ("A", (ANCHO - R_EXT, R_EXT), R_EXT, (ANCHO - R_EXT, 0.0), (ANCHO, R_EXT),
         (ANCHO - R_EXT + R_EXT * S2, R_EXT - R_EXT * S2)),
        ("L", (ANCHO, R_EXT), (ANCHO, EJE_Z)),
        ("L", (ANCHO, EJE_Z), (x2, EJE_Z)),
        ("L", (x2, EJE_Z), (x2, BASE + R_INT)),
        ("A", (x2 - R_INT, BASE + R_INT), R_INT, (x2, BASE + R_INT), (x2 - R_INT, BASE),
         (x2 - R_INT + R_INT * S2, BASE + R_INT - R_INT * S2)),
        ("L", (x2 - R_INT, BASE), (x1 + R_INT, BASE)),
        ("A", (x1 + R_INT, BASE + R_INT), R_INT, (x1 + R_INT, BASE), (x1, BASE + R_INT),
         (x1 + R_INT - R_INT * S2, BASE + R_INT - R_INT * S2)),
        ("L", (x1, BASE + R_INT), (x1, EJE_Z)),
        ("L", (x1, EJE_Z), (0.0, EJE_Z)),
        ("L", (0.0, EJE_Z), (0.0, R_EXT)),
        ("A", (R_EXT, R_EXT), R_EXT, (0.0, R_EXT), (R_EXT, 0.0), (R_EXT - R_EXT * S2, R_EXT - R_EXT * S2)),
    ]


def angulo(c, p):
    return math.atan2(p[1] - c[1], p[0] - c[0]) % TAU


def barrido(c, a, b, m):
    """Angulos (ini, fin) con fin > ini del arco que va antihorario y contiene a m: (a -> b) o, si no, (b -> a)."""
    ta, tb, tm = angulo(c, a), angulo(c, b), angulo(c, m)
    d_ab, d_am = (tb - ta) % TAU, (tm - ta) % TAU
    if d_am < d_ab:
        return ta, ta + d_ab, a, b
    return tb, tb + (ta - tb) % TAU, b, a


def area_green(tramos):
    """Area con signo del contorno (teorema de Green), recorriendo cada arco de a a b por su punto medio."""
    s = 0.0
    for t in tramos:
        if t[0] == "L":
            (ax, ay), (bx, by) = t[1], t[2]
            s += ax * by - bx * ay
        else:
            _, c, r, a, b, m = t
            ini, fin, p0, _p1 = barrido(c, a, b, m)
            t0, t1 = (ini, fin) if p0 == a else (fin, ini)
            s += r * r * (t1 - t0) + r * (c[0] * (math.sin(t1) - math.sin(t0)) - c[1] * (math.cos(t1) - math.cos(t0)))
    return s / 2.0


def geometria():
    """Volumen que suma o saca cada operacion, y el total (mm3)."""
    area = abs(area_green(perfil()))
    r, a, R = D_TOPE / 2, D_AGUJ / 2, D_AVELL / 2
    x0 = BRAZO_IZQ - L_TOPE_IZQ                      # -9: cara izquierda del tope
    h_av = R - a                                     # 90 grados incluidos: profundidad = diferencia de radios
    frustum = math.pi * h_av / 3 * (R * R + R * a + a * a)
    largo_material = L_TOPE_IZQ + BRAZO_DER          # el eje pasa por aire entre los brazos (x 14 a 77)
    ops = [
        ("perfil", area * ESP),
        ("tope_izq", math.pi * r * r / 2 * (L_TOPE_IZQ + (0.0 - x0))),   # mitad de arriba entera + la de abajo afuera del brazo
        ("tope_der", math.pi * r * r / 2 * BRAZO_DER),                   # mitad de arriba (la de abajo cae en el brazo)
        ("agujero", -(math.pi * a * a * largo_material + frustum - math.pi * a * a * h_av)),
    ]
    return {"area_perfil": area, "ops": ops, "volumen": sum(v for _, v in ops), "x_cara_izq": x0,
            "plano_tope_izq": (x0 + BRAZO_IZQ) / 2, "mitad_tope_izq": (BRAZO_IZQ - x0) / 2,
            "plano_tope_der": ANCHO - BRAZO_DER / 2, "mitad_tope_der": BRAZO_DER / 2}


# ------------------------------------------------------------------ CATIA
MACRO_PLANO = """Function CATMain(m)
    Dim p(8)
    m.GetPlane p
    CATMain = p(0) & ";" & p(1) & ";" & p(2) & ";" & p(3) & ";" & p(4) & ";" & p(5) & ";" & p(6) & ";" & p(7) & ";" & p(8)
End Function"""


def a_croquis_zx(p):
    x, z = p
    return jc.EJES["zx"](x, 0.0, z)


def dibujar(f, tramos, mapa):
    """Tramos del mundo pasados al croquis con `mapa`; un punto que se repite se crea una vez y lo comparten los dos
    tramos (si no, CATIA no lo toma como cerrado). Cada arco se dibuja antihorario EN EL CROQUIS, eligiendo el sentido
    que pasa por su punto medio (el croquis ZX tiene la otra mano que el mundo XZ)."""
    puntos = {}

    def pt(q):
        k = (round(q[0], 9), round(q[1], 9))
        if k not in puntos:
            puntos[k] = f.CreatePoint(float(q[0]), float(q[1]))
        return puntos[k]
    for t in tramos:
        if t[0] == "L":
            a, b = mapa(t[1]), mapa(t[2])
            ln = f.CreateLine(float(a[0]), float(a[1]), float(b[0]), float(b[1]))
            ln.StartPoint, ln.EndPoint = pt(a), pt(b)
        else:
            _, c, r, a, b, m = t
            c, a, b, m = mapa(c), mapa(a), mapa(b), mapa(m)
            ini, fin, p0, p1 = barrido(c, a, b, m)
            ar = f.CreateCircle(float(c[0]), float(c[1]), float(r), ini, fin)
            ar.CenterPoint = f.CreatePoint(float(c[0]), float(c[1]))
            ar.StartPoint, ar.EndPoint = pt(p0), pt(p1)
    return len(puntos)


def plano_yz_en(cb, doc, part, body, x):
    """Plano paralelo a YZ en x (offset desde PlaneYZ). Lee su origen de CATIA; si quedo en -x, invierte el offset."""
    hsf = part.HybridShapeFactory
    p = hsf.AddNewPlaneOffset(part.CreateReferenceFromObject(part.OriginElements.PlaneYZ), float(x), False)
    body.InsertHybridShape(p)
    part.Update()
    info = {"pedido_x": x}
    try:
        m = doc.GetWorkbench("SPAWorkbench").GetMeasurable(part.CreateReferenceFromObject(p))
        v = [float(s.replace(",", ".")) for s in cb.evaluar(doc.Application, MACRO_PLANO, m).split(";")]
        info["origen"], info["dir1"], info["dir2"] = v[:3], v[3:6], v[6:9]
        if abs(v[0] + x) < 1e-3 and abs(x) > 1e-3:
            p.Offset.Value = -float(x)
            part.Update()
            v = [float(s.replace(",", ".")) for s in cb.evaluar(doc.Application, MACRO_PLANO, m).split(";")]
            info["invertido"], info["origen"] = True, v[:3]
        if abs(v[0] - x) > 1e-3:
            raise RuntimeError(f"el plano no quedo en x {x}: {info}")
    except RuntimeError:
        raise
    except Exception as e:  # noqa: BLE001  (si GetPlane no anda, decide el control de volumen de la extrusion)
        info["sin_leer_origen"] = repr(e)[:200]
    return p, info


def croquis_circulo(cb, part, body, plano, h, v, r):
    sk = body.Sketches.Add(cb.ref(part, plano))
    f = sk.OpenEdition()
    f.CreateClosedCircle(float(h), float(v), float(r))
    sk.CloseEdition()
    part.Update()
    return sk


def agujero_hole(cb, doc, part, body, sf, cara, esperado, antes):
    """Hole avellanado desde el punto (x -9, y 0, z 34) de la cara izquierda del tope, hasta el ultimo. Los modos son
    los del ej33 de la practica del 19/10 (96,13 = 96,13): profundidad + angulo; el modo angulo + diametro fallo (ej02)."""
    x0 = BRAZO_IZQ - L_TOPE_IZQ
    h = sf.AddNewHoleFromPoint(float(x0), 0.0, float(EJE_Z), cara, 10.0)
    h.Type = 3                                  # catCountersunkHole (PartTypeLib: CatHoleType)
    h.Diameter.Value = D_AGUJ
    h.CounterSunkMode = 0                       # catCSModeDepthAngle (CatCSHoleMode)
    h.HeadDepth.Value = (D_AVELL - D_AGUJ) / 2  # 90 grados incluidos
    h.HeadAngle.Value = 90.0
    h.BottomType = 0                            # catFlatHoleBottom
    h.BottomLimit.LimitMode = 2                 # catUpToLastLimit (CatLimitMode): cruza los dos topes
    part.Update()
    m = cb.medir(doc, part, body)
    dv, cen = jc._agregado(antes, m)
    info = {"metodo": "hole", "dv": round(dv, 3), "dv_esperado": round(esperado, 3)}
    if abs(dv - esperado) > 1.0:
        h.Reverse()
        part.Update()
        m = cb.medir(doc, part, body)
        dv, cen = jc._agregado(antes, m)
        info.update({"invertido": True, "dv": round(dv, 3)})
    info["centro"] = cen and [round(x, 3) for x in cen]
    if abs(dv - esperado) > 1.0:
        raise RuntimeError(f"el Hole no saca lo de la cuenta (tampoco dado vuelta): {info}")
    try:
        info["leido"] = {"diametro": h.Diameter.Value, "prof_cabeza": h.HeadDepth.Value, "angulo": h.HeadAngle.Value}
    except Exception:  # noqa: BLE001
        pass
    return h, m, info


def catalogo(cb, c):
    """Catalogo de materiales de la instalacion (como el 07)."""
    cand = []
    if os.environ.get("CATIA_CATALOGO_MATERIALES"):
        cand.append(os.environ["CATIA_CATALOGO_MATERIALES"])
    cand.append(os.path.join(cb.CATIA_INSTALADA, "intel_a", "startup", "materials", "Catalog.CATMaterial"))
    for r in cand:
        if os.path.isfile(r):
            return r
    raise FileNotFoundError(f"no esta el catalogo de materiales de CATIA (probado: {cand})")


def buscar_aluminio(mdoc):
    """Un material del catalogo cuyo nombre diga aluminio (por indice: Item("nombre") volvia vacio, catia.md)."""
    fs = mdoc.Families
    hallados = []
    for i in range(1, fs.Count + 1):
        fam = fs.Item(i)
        ms = fam.Materials
        for j in range(1, ms.Count + 1):
            m = ms.Item(j)
            n = m.Name.strip().lower()
            if n.startswith("alumin"):
                hallados.append((0 if n in ("aluminium", "aluminum", "aluminio") else 1, fam.Name, m))
    if not hallados:
        raise KeyError("el catalogo no trae aluminio")
    hallados.sort(key=lambda x: x[0])
    return hallados[0][2], hallados[0][1]


def inercia(doc):
    ine = doc.GetWorkbench("SPAWorkbench").Inertias.Add(doc.Product)
    return float(ine.Density), float(ine.Mass)


def poner_densidad(part, nombre_material, densidad):
    """Cambia el parametro Density del material aplicado (buscado por palabra en el nombre completo, como
    fem.material_propio de la practica). Devuelve el nombre del parametro tocado."""
    ps = part.Parameters
    candidatos = []
    for i in range(1, ps.Count + 1):
        p = ps.Item(i)
        n = str(p.Name)
        if "densit" in n.lower() and nombre_material.lower() in n.lower():
            candidatos.append(p)
    if len(candidatos) != 1:
        raise RuntimeError(f"parametro Density de {nombre_material}: {len(candidatos)} candidatos")
    candidatos[0].Value = float(densidad)
    part.Update()
    return str(candidatos[0].Name)


def material_y_masa(cb, c, doc, part, mat):
    """Aluminio del catalogo con 2 700 kg/m3. Fuera del registro de pasos: si no se puede, el ok sale del cruce."""
    out = {"ok": False}
    try:
        if "doc" not in mat:
            mat["ruta"] = catalogo(cb, c)
            mat["doc"] = c.Documents.Read(mat["ruta"])
        m, familia = buscar_aluminio(mat["doc"])
        out["material"], out["catalogo"] = f"{familia}/{m.Name}", mat["ruta"]
        part.GetItem("CATMatManagerVBExt").ApplyMaterialOnPart(part, m, 0)
        part.Update()
        try:
            doc.Activate()
        except Exception:  # noqa: BLE001
            pass
        dens, _ = inercia(doc)
        out["densidad_catalogo_kg_m3"] = round(dens, 3)
        if abs(dens - DENSIDAD_SIN_MATERIAL) < 1e-6:
            raise RuntimeError("el material no quedo: la densidad sigue en 1000")
        if abs(dens - DENSIDAD_PLANO) > 1e-6:
            out["parametro_densidad"] = poner_densidad(part, m.Name, DENSIDAD_PLANO)
        dens, masa = inercia(doc)
        out["densidad_kg_m3"] = round(dens, 3)
        if abs(dens - DENSIDAD_PLANO) > 1e-3:
            raise RuntimeError(f"la densidad quedo en {dens}, no en {DENSIDAD_PLANO} (la del rotulo)")
        out["masa_inercia_kg"] = masa
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = repr(e)[:300]
        out["traza"] = traceback.format_exc()[-500:]
    return out


def construir(cb, c, reg, salida):
    g = geometria()
    ops = dict(g["ops"])
    salida.update({"volumen_cuenta_mm3": round(g["volumen"], 3), "ops_cuenta_mm3": {k: round(v, 3) for k, v in ops.items()},
                   "masa_guia_g": MASA_GUIA_G, "planos": {}})
    doc, part, body, sf = cb.nueva_pieza(c, PARTE)
    est = {"m": None, "ocultos": []}

    def perfil_u():
        sk = body.Sketches.Add(cb.ref(part, jc.plano_origen(part, "zx")))
        f = sk.OpenEdition()
        dibujar(f, perfil(), a_croquis_zx)
        sk.CloseEdition()
        part.Update()
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, ESP / 2, ops["perfil"], simetrico=True)
        return info

    def tope(cual, x, mitad):
        def hacer():
            p, info_p = plano_yz_en(cb, doc, part, body, x)
            est["ocultos"].append(p)
            salida["planos"][cual] = info_p
            h, v = jc.EJES["yz"](x, 0.0, EJE_Z)
            sk = croquis_circulo(cb, part, body, p, h, v, D_TOPE / 2)
            feat, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, mitad, ops[cual], antes=est["m"],
                                              simetrico=True)
            est[cual] = feat
            return info
        return hacer

    def agujero():
        x0 = g["x_cara_izq"]
        caras = [d for d in cb.topologia(doc, est["tope_izq"], "Face")
                 if "cdg" in d and abs(d["cdg"][0] - x0) < 0.01 and abs(d["cdg"][2] - EJE_Z) < 0.01]
        if len(caras) != 1:
            raise RuntimeError(f"cara izquierda del tope en x {x0:g}: {len(caras)} candidatas")
        _, est["m"], info = agujero_hole(cb, doc, part, body, sf, caras[0]["ref"], ops["agujero"], est["m"])
        return info

    seguir = reg.paso(f"U de perfil en ZX (R{R_EXT:g} afuera, R{R_INT:g} adentro), pad de {ESP / 2:g} por lado",
                      perfil_u) is not None
    if seguir:
        seguir = reg.paso(f"tope izquierdo R{D_TOPE / 2:g} de x {g['x_cara_izq']:g} a {BRAZO_IZQ:g}: plano en x "
                          f"{g['plano_tope_izq']:g}, pad de {g['mitad_tope_izq']:g} por lado",
                          tope("tope_izq", g["plano_tope_izq"], g["mitad_tope_izq"])) is not None
    if seguir:
        seguir = reg.paso(f"tope derecho R{D_TOPE / 2:g} de x {ANCHO - BRAZO_DER:g} a {ANCHO:g}: plano en x "
                          f"{g['plano_tope_der']:g}, pad de {g['mitad_tope_der']:g} por lado",
                          tope("tope_der", g["plano_tope_der"], g["mitad_tope_der"])) is not None
    if seguir:
        reg.paso(f"agujero de {D_AGUJ:g} pasante con avellanado de {D_AVELL:g} x 90 en la cara x {g['x_cara_izq']:g}",
                 agujero)
    if est["m"] is None:                    # cuerpo vacio: medirlo (tambien la inercia) rompe la sesion (catia.md)
        salida["material_catia"] = {"ok": False, "error": "no se aplico: el perfil no se pudo hacer"}
    else:
        m = material_y_masa(cb, c, doc, part, {})
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
