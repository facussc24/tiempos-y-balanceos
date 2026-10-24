# -*- coding: utf-8 -*-
"""Ejercicio 17 del banco de CATIA (cola del 24/10/2026): la palanca del ejercicio 06 del banco 3D con DMU Kinematics.

Piezas (las del _conjunto.py del 06, en las MISMAS coordenadas): una pieza FIJA por variante (placa 260 x 140 x 10 +
soporte del eje 30 x 18 x 85, y en los mutantes el brazo fijo: columna + travesano en polares alrededor del eje) y la
PALANCA (cubo R15 x 20 con eje en (0, y, 80) + barra 150 x 20 x 20 hacia +X, pose de 0 grados). Cada pieza lleva su «Eje»
(la recta del eje del giro) y su «Plano» (y = 0) para la articulacion. CATProduct con la palanca, la fija buena y las
tres fijas de los mutantes (sin articulacion: quedan donde se modelaron); mecanismo con UNA articulacion de revolucion
(fija buena - palanca) y un comando de angulo, por macro VBScript como el ej49 de la practica del 19/10.

En 0, 35, 50 y 60 grados: (1) CINEMATICA: la punta de la palanca (150, 0, 80) tiene que ir a (150 cos t, 0, 80 + 150 sen t)
(el giro positivo la levanta, _conjunto.py); el signo del comando de CATIA se mide en la primera pose; (2) CHOQUES: con la
posicion que da CATIA, la palanca (su STEP exportado por CATIA) se mueve en OpenCASCADE (medir_choques.py, .venv-cad) y se
mide el choque (volumen de la interseccion) y la luz contra cada fija. «Clashes» de CATIA no se usa: no distingue choques
de hasta 0,3 mm de un contacto (catia.md); GetMinimumDistance entre piezas de un ensamble falla por programa (NOTAS 19/10).

Respuesta conocida: los chequeos del tarea.yaml del 06 (y del _conjunto.py, que los verifica al armar): la buena libre
en 0, 35 y 60; mal_1 choca a 35 y esta libre en 0 y 60; mal_2 pasa a 15 mm (+-0,5) a 50 y esta libre en 0 y 60; mal_3
choca a 60 y esta libre en 0 y 35. Sin bien.py comparable (las partes son otras): correr_ejercicio(con_bien=False).

ok = todos los pasos sin falla Y la punta a <= 0,001 mm de la cuenta en las cuatro poses Y cada chequeo del tarea.yaml.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, un STEP y una captura por pieza, el CATProduct.
"""
import json
import math
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "17_palanca_dmu"                    # sin bien.py comparable: con_bien=False
BX0, BY0, BL, BA, BE = -60.0, -70.0, 260.0, 140.0, 10.0          # placa (_conjunto.py del 06)
SX0, SY0, SZ0, SL, SA, SH = -15.0, -30.0, 10.0, 30.0, 18.0, 85.0  # soporte del eje
EJE_Z, R_CUBO, LARGO, MEDIO, LADO = 80.0, 15.0, 150.0, 10.0, 15.0
BRAZOS = {"fija_bien": None,                                      # los brazos de los mal_*.py del 06
          "fija_mal1": {"grados": 35, "r": 110, "y0": -20},
          "fija_mal2": {"grados": 50, "r": 100, "y0": 25},
          "fija_mal3": {"grados": 68, "r": 110, "y0": -20}}
ANGULOS = (0, 35, 50, 60)
ESPERADO = {"fija_bien": {0: "libre", 35: "libre", 60: "libre"},
            "fija_mal1": {0: "libre", 35: "choca", 60: "libre"},
            "fija_mal2": {0: "libre", 50: ("luz", 15.0, 0.5), 60: "libre"},
            "fija_mal3": {0: "libre", 35: "libre", 60: "choca"}}
TOL_PUNTA = 1e-3
PUNTA = (LARGO, 0.0, EJE_Z)
V_CUBO = math.pi * R_CUBO ** 2 * 2 * MEDIO
_A = 2 * (MEDIO / 2 * math.sqrt(R_CUBO ** 2 - MEDIO ** 2) + R_CUBO ** 2 / 2 * math.asin(MEDIO / R_CUBO))
V_BARRA_SUMA = LARGO * (2 * MEDIO) ** 2 - _A * 2 * MEDIO          # la del 06

MACRO_MEC = """Function CATMain(mec, fija, ejeF, planoF, ejeP, planoP)
    Dim a(3)
    Set a(0) = ejeF: Set a(1) = ejeP: Set a(2) = planoF: Set a(3) = planoP
    Set j1 = mec.AddJoint("CATKinRevoluteJoint", a)
    mec.FixedPart = fija
    mec.AddCommand "CATKinAngleCmd", j1
    CATMain = mec.NbDof & ";" & mec.NbJoints & ";" & mec.NbCommands
End Function"""
MACRO_ANG = """Function CATMain(mec, ang)
    Dim v(0)
    v(0) = ang
    mec.PutCommandValues v
    mec.Update
    CATMain = "ok"
End Function"""
MACRO_POS = """Function CATMain(p)
    Dim a(11)
    p.Position.GetComponents a
    s = a(0)
    For i = 1 To 11
        s = s & ";" & a(i)
    Next
    CATMain = s
End Function"""


def punta_esperada(t):
    r = math.radians(t)
    return (LARGO * math.cos(r), 0.0, EJE_Z + LARGO * math.sin(r))


def aplicar(a, p):
    """Position de CATIA (ejes X, Y, Z y origen) aplicada a un punto de la pieza."""
    return tuple(a[9 + i] + p[0] * a[i] + p[1] * a[3 + i] + p[2] * a[6 + i] for i in range(3))


def polar(grados, r):
    t = math.radians(grados)
    return r * math.cos(t), EJE_Z + r * math.sin(t)


def volumen_fija(brazo):
    v = BL * BA * BE + SL * SA * SH
    if brazo:
        _, zc = polar(brazo["grados"], brazo["r"])
        v += LADO * LADO * (zc + LADO / 2 - SZ0) + LADO * (60.0 - brazo["y0"]) * LADO - LADO ** 3
    return v


def num(t):
    return [float(x.replace(",", ".")) for x in str(t).split(";")]


def ejes_y_plano(cb, part, doc):
    """El «Eje» del giro (0, -40..40, 80) y el «Plano» y = 0, en un set de superficies (se oculta antes de exportar)."""
    hsf = part.HybridShapeFactory
    gs = part.HybridBodies.Add()
    gs.Name = "Articulacion"
    a, b = hsf.AddNewPointCoord(0.0, -40.0, EJE_Z), hsf.AddNewPointCoord(0.0, 40.0, EJE_Z)
    gs.AppendHybridShape(a)
    gs.AppendHybridShape(b)
    ln = hsf.AddNewLinePtPt(cb.ref(part, a), cb.ref(part, b))
    gs.AppendHybridShape(ln)
    ln.Name = "Eje"
    pl = hsf.AddNewPlaneOffset(cb.ref(part, part.OriginElements.PlaneZX), 0.0, False)
    gs.AppendHybridShape(pl)
    pl.Name = "Plano"
    part.Update()
    return gs


def armar_fija(cb, c, reg, salida, nombre, brazo):
    doc, part, body, sf = cb.nueva_pieza(c, nombre)
    ocultos = []

    def pad(plano_z, rect, alto, dv, centro, antes):
        pl = jc.plano_origen(part, "xy") if plano_z == 0 else jc.plano_a(part, body, plano_z)
        if plano_z:
            ocultos.append(pl)
        sk = jc.croquis(cb, part, body, pl, rects=[rect])
        return jc.extruir(cb, doc, part, body, sf, sk, alto, dv, centro, antes=antes)[1]

    def fija():
        m = pad(0, (BX0, BY0, BX0 + BL, BY0 + BA), BE, BL * BA * BE, (BX0 + BL / 2, BY0 + BA / 2, BE / 2), None)
        m = pad(SZ0, (SX0, SY0, SX0 + SL, SY0 + SA), SH, SL * SA * SH, (SX0 + SL / 2, SY0 + SA / 2, SZ0 + SH / 2), m)
        if brazo:
            xc, zc = polar(brazo["grados"], brazo["r"])
            h_col = zc + LADO / 2 - SZ0
            m = pad(SZ0, (xc - LADO / 2, 45.0, xc + LADO / 2, 60.0), h_col, LADO * LADO * h_col,
                    (xc, 52.5, SZ0 + h_col / 2), m)
            y0 = brazo["y0"]
            v_tr, v_ov = LADO * (60.0 - y0) * LADO, LADO ** 3
            cy = ((60.0 + y0) / 2 * v_tr - 52.5 * v_ov) / (v_tr - v_ov)
            m = pad(zc - LADO / 2, (xc - LADO / 2, y0, xc + LADO / 2, 60.0), LADO, v_tr - v_ov, (xc, cy, zc), m)
        if abs(m["volume"] - volumen_fija(brazo)) > 1.0:
            raise RuntimeError(f"{nombre}: {m['volume']} mm3 contra la cuenta {volumen_fija(brazo):.3f}")
        return {"vol": m["volume"], "cuenta": round(volumen_fija(brazo), 3)}
    reg.paso(f"{nombre}: placa + soporte" + (f" + brazo a {brazo['grados']} grados, r {brazo['r']}" if brazo else ""),
             fija)
    ocultos.append(reg.paso(f"{nombre}: eje y plano de la articulacion", lambda: ejes_y_plano(cb, part, doc)))
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, nombre, nombre, ocultos=[o for o in ocultos if o is not None])
    doc.Close()
    return os.path.join(reg.carpeta, nombre + ".CATPart")


def armar_palanca(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, "palanca")
    zx, a_zx = jc.plano_origen(part, "zx"), jc.EJES["zx"]

    def palanca():
        h, v = a_zx(0.0, 0.0, EJE_Z)
        sk = jc.croquis(cb, part, body, zx, circulos=[(h, v, R_CUBO)])
        _, m, _ = jc.extruir(cb, doc, part, body, sf, sk, MEDIO, V_CUBO, simetrico=True)
        h0, v0 = a_zx(0.0, 0.0, EJE_Z - MEDIO)
        h1, v1 = a_zx(LARGO, 0.0, EJE_Z + MEDIO)
        sk = jc.croquis(cb, part, body, zx, rects=[(h0, v0, h1, v1)])
        _, m, _ = jc.extruir(cb, doc, part, body, sf, sk, MEDIO, V_BARRA_SUMA, antes=m, simetrico=True)
        return {"vol": m["volume"], "cuenta": round(V_CUBO + V_BARRA_SUMA, 3)}
    reg.paso("palanca: cubo R15 x 20 + barra 150 x 20 x 20 (pose de 0 grados)", palanca)
    gs = reg.paso("palanca: eje y plano de la articulacion", lambda: ejes_y_plano(cb, part, doc))
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "palanca", "palanca", ocultos=[gs] if gs is not None else [])
    doc.Close()
    return os.path.join(reg.carpeta, "palanca.CATPart")


def construir(cb, c, reg, salida):
    salida.update({"poses": {}, "cinematica": {}, "steps": {}})
    rutas = {k: armar_fija(cb, c, reg, salida, k, b) for k, b in BRAZOS.items()}
    rutas["palanca"] = armar_palanca(cb, c, reg, salida)
    if any(not os.path.isfile(r) for r in rutas.values()):
        raise RuntimeError(f"faltan CATPart: {[k for k, r in rutas.items() if not os.path.isfile(r)]}")
    salida["steps"] = {k: v for k, v in salida["_steps"].items()}
    ev = c.SystemService.Evaluate

    def mecanismo():
        doc = c.Documents.Add("Product")
        prod = doc.Product
        prod.PartNumber = "Palanca_DMU"
        orden = ["fija_bien", "palanca", "fija_mal1", "fija_mal2", "fija_mal3"]
        prod.Products.AddComponentsFromFiles([rutas[k] for k in orden], "All")
        inst = {k: prod.Products.Item(i + 1) for i, k in enumerate(orden)}
        raiz = prod.PartNumber

        def rf(k, nom):
            return prod.CreateReferenceFromName(f"{raiz}/{inst[k].Name}/!{nom}")
        mec = prod.GetTechnologicalObject("Mechanisms").Add()
        r = ev(MACRO_MEC, 0, "CATMain", [mec, inst["fija_bien"], rf("fija_bien", "Eje"), rf("fija_bien", "Plano"),
                                         rf("palanca", "Eje"), rf("palanca", "Plano")])
        dof = num(r)
        # NbDof cuenta el grado libre que mueve el comando (la biela del ej49, que anduvo, dio «1;4;1»): 1 grado, 1
        # articulacion, 1 comando = mecanismo que se puede simular
        if dof != [1.0, 1.0, 1.0]:                     # se anota y no frena: decide la punta (revisor del 17: la
            salida["nbdof_aviso"] = f"esperaba 1;1;1, dio {r}"   # lectura de NbDof sale de dos corridas, sin doc)
        signo = 1.0
        for t in ANGULOS:
            ev(MACRO_ANG, 0, "CATMain", [mec, signo * t])
            prod.Update()
            a = num(ev(MACRO_POS, 0, "CATMain", [inst["palanca"]]))
            p = aplicar(a, PUNTA)
            if t and signo == 1.0 and p[2] < EJE_Z:      # el comando positivo bajo la palanca: se da vuelta el signo
                signo = -1.0
                ev(MACRO_ANG, 0, "CATMain", [mec, -t])
                prod.Update()
                a = num(ev(MACRO_POS, 0, "CATMain", [inst["palanca"]]))
                p = aplicar(a, PUNTA)
            q = punta_esperada(t)
            salida["poses"][str(t)] = a
            salida["cinematica"][str(t)] = {"punta_catia": [round(x, 4) for x in p], "punta_cuenta": [round(x, 4) for x in q],
                                            "dif_mm": round(math.dist(p, q), 6)}
        salida["signo_del_comando"] = signo
        ruta = os.path.join(reg.carpeta, "Palanca_DMU.CATProduct")
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.SaveAs(ruta)
        return {"mecanismo": r, "signo": signo, "dif_max_mm": max(v["dif_mm"] for v in salida["cinematica"].values())}
    reg.paso("mecanismo: revolucion fija-palanca + comando de angulo; poses 0, 35, 50 y 60", mecanismo)


def cerrar_con_choques(carpeta, medir=None):
    """`medir(entrada_json)` devuelve las poses de medir_choques.py (se cambia en la prueba sin CATIA)."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    malos = []
    cin = s.get("cinematica") or {}
    for t in ANGULOS:
        d = cin.get(str(t))
        if d is None or d["dif_mm"] > TOL_PUNTA:
            malos.append(f"punta a {t} grados: {d}")
    steps = s.get("steps") or {}
    if set(steps) >= set(BRAZOS) | {"palanca"} and s.get("poses"):
        entrada = os.path.join(carpeta, "choques_entrada.json")
        with open(entrada, "w", encoding="utf-8") as f:
            json.dump({"palanca": steps["palanca"], "fijas": {k: steps[k] for k in BRAZOS}, "poses": s["poses"],
                       "caja_soporte": [SX0, SY0, SZ0, SX0 + SL, SY0 + SA, SZ0 + SH]}, f)
        if medir is None:
            def medir(e):
                r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "medir_choques.py"), e], capture_output=True,
                                   text=True, timeout=900)
                try:
                    d = json.loads(r.stdout.strip().splitlines()[-1])
                except (ValueError, IndexError):
                    raise RuntimeError((r.stderr or r.stdout)[-300:])
                if not d.get("resta_soporte_ok", True):
                    raise RuntimeError(f"restar la caja del soporte saco otra cosa: {d.get('resta_soporte')}")
                return d["poses"]
        try:
            ch = medir(entrada)
        except Exception as e:  # noqa: BLE001
            ch = None
            malos.append(f"no se pudieron medir los choques (medir_choques.py con .venv-cad): {e!r}"[:400])
        if ch:
            s["choques"] = ch
            s["chequeos"] = {}
            for fija, esp in ESPERADO.items():
                for t, que in esp.items():
                    d = (ch.get(str(t)) or {}).get(fija)
                    if d is None:
                        malos.append(f"{fija} a {t} grados: sin medir")
                        continue
                    if que == "libre":
                        bien = d["choque_mm3"] < 1e-3
                    elif que == "choca":
                        bien = d["choque_mm3"] > 1.0
                    else:
                        bien = d["choque_mm3"] < 1e-3 and abs(d.get("luz_sin_soporte_mm", -1) - que[1]) <= que[2]
                    s["chequeos"][f"{fija} a {t}"] = {"esperado": que, "medido": d, "ok": bien}
                    if not bien:
                        malos.append(f"{fija} a {t} grados: se esperaba {que}, dio {d}")
    else:
        malos.append("faltan los STEP de las piezas o las poses: no se midieron los choques")
    # el Eje de las piezas va hacia +Y y el banco gira alrededor de -Y (regla de la mano derecha): el comando que levanta
    # la palanca es el negativo (revisor del 17); otro signo con la punta bien seria otro mecanismo
    if s.get("signo_del_comando") != -1.0:
        malos.append(f"el signo del comando dio {s.get('signo_del_comando')}: con el eje hacia +Y tiene que ser -1")
    s["ok_cinematica_y_choques"] = not malos
    s["ok"] = s["ok_pasos"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_DMU", json.dumps({"ok": s["ok"], "signo": s.get("signo_del_comando"),
                                 "dif_punta_mm": {t: v["dif_mm"] for t, v in cin.items()}, "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_choques(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudieron medir los choques:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
