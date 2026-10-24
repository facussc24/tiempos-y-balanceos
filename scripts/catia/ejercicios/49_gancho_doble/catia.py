# -*- coding: utf-8 -*-
"""Ejercicio 49 del banco de CATIA (fase 3, segunda tanda: dispositivos de la casa, 24/10/2026): el gancho DOBLE para
colgar dos mochilas de la pata del escritorio (diseno del gerente de Fak, 24/08/2026) rehecho EN CATIA desde sus datos:
build_gancho_doble.py + params_doble.json de .claude/skills/cad-design/examples/gancho_mochila/ (el diseno entregado).

Lo que se construye, en el orden y con las cotas de build_gancho_doble.py (las derivadas se derivan, no se escriben):
1. lomo: x -10..0, y -22,3..22,3, z 0..28 (y = boca_arriba/2 + e_ala);
2. las dos alas: el trapecio de la cara interna INCLINADA (boca 26,6 abajo y 28,6 arriba: ese cono ES el mecanismo) en el
   plano YZ, extruido 26 en +X;
3. los dos brazos: el perfil que baja hacia afuera, de y_raiz 22,3 a la punta 74, en un plano paralelo a YZ en x -10,
   extruido 36;
4. redondeos: R8 en el fondo del gancho (y +-66, z 5), R6 en la union brazo-clip (y +-22,3, z 13), R3 en la punta de la
   nariz (y +-74 y +-66, z 28);
5. el alivio ala-lomo EXCAVADO (cilindro R4 en (0, +-14,3) a todo el alto) y la entrada guiada (triangulo 2 x 2 en el canto
   de la boca, x 24..26) SOLO del lado -Y: lo ENTREGADO no tiene la del +Y. Medido el 24/10 (corrida 13:49, que cortaba
   los dos lados y dio ROJO: le faltaban 56 mm3, un solo pedazo en x 24..26, y 14,3..16,3, ubicado con las booleanas
   referencia - CATIA): en build_gancho_doble.py el triangulo de signo +1 queda en sentido horario y extrude() lo lleva a
   z -28..0, donde no hay material; el de signo -1 va a z 0..28. No se toca el script (es el registro del diseno
   entregado): la pregunta esta en PREGUNTAS_FAK.md de la tanda. Si se corrige, el script y este ejercicio cambian juntos.
Cada extrusion se controla midiendo: lo que agrega o saca y su centro contra la cuenta (juez_comun.extruir).

Respuesta conocida: el STEP que genera build_gancho_doble.py --out <carpeta> con el params_doble.json del repo (build123d,
68 604,251 mm3), generado en la corrida. compara.py del 32 (OpenCASCADE): sobra y falta <= 1 mm3, booleana que cierra y un
solido de cada lado; el volumen y el centro del STEP de CATIA contra la referencia (tol_volumen y 0,01 mm), STEP 1/1/0.
DISTANCIAS: el mismo 0,01 mm del 32 en los DOS sentidos, pero con la distancia EXACTA de compara.py (cada uno de los
puntos de malla a mas de 0,005 se lleva a la cascara propia y se mide a la cascara del otro, BRepExtrema) y no la de malla
a malla. Por que (24/10, medido y revisado): OpenCASCADE malla el STEP de CATIA con puntos a 0,029 mm de su PROPIO B-Rep
donde el alivio R4 corta la cara inclinada del ala (el STEP es AP203 sin pcurves; con malla fina da 0,0001); la geometria
de CATIA es exacta: por dentro 68 604,251 mm3 = la referencia, y abierto en CATIA su STEP da lo mismo. Exactas en la corrida
13:57: 0,0016 y 0,0. Ademas el volumen y el centro de CATIA POR DENTRO contra la referencia (0,01 mm3 y 0,01 mm).
  Un primer intento (14:12) media la exacta contra el SOLIDO y dejaba pasar un resalto de 0,05 mm (un punto adentro del
  otro solido da 0): lo cazo el revisor Sonnet. Gemelos con la medida corregida (sus STEP, 14:55): resaltos de 1 x 1 x
  0,03 y 1 x 1 x 0,05, de 2 x 2 x 0,015, una lamina de 0,03 x 4 x 5 y una muesca de 1 x 1 x 0,05 dan exactas de 0,015 a
  0,05: rojos; la nariz R2,95 y la entrada de los dos lados (13:49) dan rojo por volumen y por falta.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, la CATPart, el STEP, la captura y la referencia.
"""
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "49_gancho_doble"
NOMBRE = "gancho_doble"
EJEMPLO = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "examples", "gancho_mochila")
COMPARA = os.path.join(os.path.dirname(AQUI), "32_virolador_v16", "compara.py")
TOL_SOBRA_FALTA_MM3, TOL_DIST_MM, TOL_CDG_MM = 1.0, 0.01, 0.01
TOL_VOL_INTERNO_MM3 = 0.01                 # CATIA por dentro contra la referencia: hoy 0,000 (revisor: 0,05 sobraba)
TOPE_S = 900


def parametros():
    with open(os.path.join(EJEMPLO, "params_doble.json"), encoding="utf-8") as f:
        p = json.load(f)
    c, b, n, r = p["clip"], p["brazo"], p["nariz"], p["radios"]
    ia, ib = c["boca_abajo"] / 2.0, c["boca_arriba"] / 2.0
    d = {"h": c["h_clip"], "e_lomo": c["e_lomo"], "p_ala": c["p_ala"], "ia": ia, "ib": ib, "ye": ib + c["e_ala"],
         "y_raiz": ib + c["e_ala"], "x0": -c["e_lomo"], "ancho_X": c["e_lomo"] + c["p_ala"], "z_raiz": b["z_raiz"],
         "y_fondo": b["y_fondo"], "z_fondo": b["z_fondo"], "y_punta": n["y_punta_ext"], "z_punta": n["z_punta"],
         "r_fondo": n["r_fondo_gancho"], "r_canto": n["r_canto_externo"], "r_ala_lomo": r["r_ala_lomo"],
         "r_brazo_clip": r["r_brazo_clip"], "chaflan": c["chaflan_entrada"]}
    return d


def area_centro(pts):
    """Area y centro de un poligono (formula del agrimensor)."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        k = x0 * y1 - x1 * y0
        a += k
        cx += (x0 + x1) * k
        cy += (y0 + y1) * k
    a /= 2.0
    return abs(a), (cx / (6 * a), cy / (6 * a))


def perfiles(d):
    ala = [(d["ia"], 0.0), (d["ye"], 0.0), (d["ye"], d["h"]), (d["ib"], d["h"])]
    brazo = [(d["y_raiz"], 0.0), (d["y_punta"], 0.0), (d["y_punta"], d["z_punta"]), (d["y_fondo"], d["z_punta"]),
             (d["y_fondo"], d["z_fondo"]), (d["y_raiz"], d["z_raiz"])]
    espejo = lambda pts: [(-y, z) for (y, z) in reversed(pts)]   # noqa: E731
    return ala, espejo(ala), brazo, espejo(brazo)


def construir(cb, c, reg, salida):
    d = parametros()
    salida["parametros"] = d
    doc, part, body, sf = cb.nueva_pieza(c, NOMBRE)
    est = {}
    ala, ala_m, brazo, brazo_m = perfiles(d)

    def croquis_poligonos(plano, polis):
        sk = body.Sketches.Add(cb.ref(part, plano))
        f = sk.OpenEdition()
        for pts in polis:
            cb.poligono(f, pts)
        sk.CloseEdition()
        part.Update()
        return sk

    def lomo():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(-d["e_lomo"], -d["ye"], 0.0, d["ye"])])
        v = d["e_lomo"] * 2 * d["ye"] * d["h"]
        est["lomo"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, d["h"], v, (-d["e_lomo"] / 2, 0.0, d["h"] / 2))
        return info
    reg.paso("lomo x -10..0, y -22,3..22,3, z 0..28", lomo)

    def alas():
        a, (yc, zc) = area_centro(ala)
        sk = croquis_poligonos(jc.plano_origen(part, "yz"), [ala, ala_m])
        est["alas"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, d["p_ala"], 2 * a * d["p_ala"],
                                                 (d["p_ala"] / 2, 0.0, zc), antes=est["m"])
        return info
    reg.paso("las dos alas con la cara interna inclinada (boca 26,6 abajo, 28,6 arriba), 26 en +X", alas)

    def brazos():
        a, (yc, zc) = area_centro(brazo)
        pl = part.HybridShapeFactory.AddNewPlaneOffset(cb.ref(part, jc.plano_origen(part, "yz")), float(d["x0"]), False)
        body.InsertHybridShape(pl)
        part.Update()
        est["plano_x0"] = pl
        sk = croquis_poligonos(pl, [brazo, brazo_m])
        est["brazos"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, d["ancho_X"], 2 * a * d["ancho_X"],
                                                   (d["x0"] + d["ancho_X"] / 2, 0.0, zc), antes=est["m"])
        return info
    reg.paso("los dos brazos que bajan hacia afuera, desde x -10, 36 en +X", brazos)

    def aristas(y_abs, z, feats):
        for feat in [f for f in feats if f is not None]:
            ar = [e for e in cb.topologia(doc, feat, "Edge") if "cdg" in e]
            sel = [e for e in ar if abs(abs(e["cdg"][1]) - y_abs) < 0.05 and abs(e["cdg"][2] - z) < 0.05 and e["medida"] > 1]
            if sel:
                return sel
        return []

    def redondeo(nombre, radio, puntos, feats):
        sel = []
        for (y_abs, z) in puntos:
            sel += aristas(y_abs, z, feats)
        if len(sel) < 2 * len(puntos):
            raise RuntimeError(f"{nombre}: {len(sel)} aristas para {puntos} (se esperan las de los dos lados)")
        antes = cb.medir(doc, part, body)["volume"]
        fl = sf.AddNewSolidEdgeFilletWithConstantRadius(sel[0]["ref"], 0, float(radio))
        for e in sel[1:]:
            fl.AddObjectToFillet(e["ref"])
        part.Update()
        est[nombre] = fl
        despues = cb.medir(doc, part, body)
        est["m"] = despues
        return {"aristas": len(sel), "largos": [e["medida"] for e in sel], "dv": round(despues["volume"] - antes, 3)}

    reg.paso("R8 en el fondo del gancho (y +-66, z 5)",
             lambda: redondeo("r_fondo", d["r_fondo"], [(d["y_fondo"], d["z_fondo"])], [est["brazos"]]))
    reg.paso("R6 en la union brazo-clip (y +-22,3, z 13)",
             lambda: redondeo("r_union", d["r_brazo_clip"], [(d["y_raiz"], d["z_raiz"])],
                              [est.get("r_fondo"), est["brazos"]]))
    reg.paso("R3 en la punta de la nariz (y +-74 y +-66, z 28)",
             lambda: redondeo("r_punta", d["r_canto"], [(d["y_punta"], d["z_punta"]), (d["y_fondo"], d["z_punta"])],
                              [est.get("r_union"), est.get("r_fondo"), est["brazos"]]))

    def alivios():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"),
                        circulos=[(0.0, d["ib"], d["r_ala_lomo"]), (0.0, -d["ib"], d["r_ala_lomo"])])
        antes = est["m"]
        pk = sf.AddNewPocket(sk, float(d["h"] + 2))
        part.Update()
        m = cb.medir(doc, part, body)
        dv, cen = jc._agregado(antes, m)
        if dv >= 0 or cen is None or abs(cen[2] - d["h"] / 2) > 0.5:     # el sentido por el centro de lo sacado
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
            m = cb.medir(doc, part, body)
            dv, cen = jc._agregado(antes, m)
        if dv >= 0 or cen is None or abs(cen[2] - d["h"] / 2) > 0.5 or abs(cen[1]) > 0.01:
            raise RuntimeError(f"el alivio no saca lo esperado: dv {dv}, centro {cen}")
        est["m"] = m
        return {"dv": round(dv, 3), "centro": [round(x, 3) for x in cen]}
    reg.paso("alivio ala-lomo excavado: cilindro R4 en (0, +-14,3) a todo el alto", alivios)

    def entradas():
        # SOLO el lado -Y: lo ENTREGADO (lo que genera build_gancho_doble.py) no tiene la del +Y (ver el docstring)
        ch, pa, ib = d["chaflan"], d["p_ala"], d["ib"]
        tri_m = [(pa, -ib), (pa - ch, -ib), (pa, -ib - ch)]
        sk = croquis_poligonos(jc.plano_origen(part, "xy"), [tri_m])
        v = (ch * ch / 2) * d["h"]
        est["entradas"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, d["h"], -v,
                                                     ((3 * pa - ch) / 3, -(3 * ib + ch) / 3, d["h"] / 2), antes=est["m"],
                                                     vaciado=True)
        return info
    reg.paso("entrada guiada: triangulo 2 x 2 en el canto de la boca (x 24..26), solo del lado -Y, a todo el alto",
             entradas)

    ocultos = [est["plano_x0"]] if "plano_x0" in est else []
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, NOMBRE, NOMBRE, ocultos=ocultos)


def generar_referencia(carpeta):
    """Corre build_gancho_doble.py (build123d) con el params_doble.json del repo: el diseno entregado."""
    out = os.path.join(carpeta, "referencia")
    r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(EJEMPLO, "build_gancho_doble.py"), "--out", out],
                       capture_output=True, text=True, timeout=TOPE_S)
    paso = os.path.join(out, "gancho_doble_v1.step")
    if not os.path.isfile(paso):
        raise RuntimeError(f"build_gancho_doble.py no dejo el STEP: {(r.stderr or r.stdout)[-300:]}")
    return paso


def medir_step(paso):
    s = jc.medir_b123d(["step", paso])
    return next(iter((s.get("partes") or {}).values()), {"error": s.get("error")})


def comparar_step(a, b):
    r = subprocess.run([jc.VENV_CAD, "-I", COMPARA, a, b], capture_output=True, text=True, timeout=TOPE_S)
    lineas = [x for x in (r.stdout or "").strip().splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"compara.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    return json.loads(lineas[-1])


def cerca(a, b, tol):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def juzgar(s, ref, comp):
    """ref: lo que mide build123d en la referencia; comp: la salida de compara.py (CATIA contra la referencia)."""
    malos = []
    sp = (s.get("step_catia_en_build123d") or {})
    sp = sp.get(NOMBRE) if isinstance(sp, dict) else None
    sp = sp or {}
    if tuple(sp.get(k) for k in ("solidos", "cascaras", "caras_sueltas")) != (1, 1, 0):
        malos.append(f"el STEP de CATIA trae solidos/cascaras/caras sueltas "
                     f"{tuple(sp.get(k) for k in ('solidos', 'cascaras', 'caras_sueltas'))}: tiene que ser 1/1/0")
    if not cerca(sp.get("volumen"), ref.get("volumen"), pj.tol_volumen(ref.get("volumen") or 0)):
        malos.append(f"volumen del STEP de CATIA {sp.get('volumen')} contra {ref.get('volumen')} de la referencia")
    try:
        dist = sum((float(a) - float(b)) ** 2 for a, b in zip(sp.get("cdg_mm"), ref.get("cdg_mm"))) ** 0.5
    except (TypeError, ValueError):
        dist = None
    s["dif_cdg_referencia_mm"] = None if dist is None or dist != dist else round(dist, 4)
    if dist is None or not dist <= TOL_CDG_MM:
        malos.append(f"centro del STEP de CATIA {sp.get('cdg_mm')} contra {ref.get('cdg_mm')} de la referencia")
    if not isinstance(comp, dict):
        return malos + [f"sin comparacion contra la referencia: {comp}"]
    for k in ("sobra_A_menos_B", "falta_B_menos_A"):
        if not cerca(comp.get(k), 0.0, TOL_SOBRA_FALTA_MM3):
            malos.append(f"{k} {comp.get(k)} mm3 contra la referencia")
    # Distancias: las EXACTAS de compara.py en los DOS sentidos, al mismo 0,01 del 32 (ver el docstring: la de malla
    # mezcla el facetado de OpenCASCADE, 0,029 mm en el corte del alivio con la cara inclinada)
    for k, que in (("dist_max_exacta_A_a_B", "CATIA -> referencia"), ("dist_max_exacta_B_a_A", "referencia -> CATIA")):
        if not cerca(comp.get(k), 0.0, TOL_DIST_MM):
            malos.append(f"distancia exacta {que} {comp.get(k)} mm")
    # y CATIA por dentro contra la referencia (no pasa por el STEP)
    vc = (s.get("volumen_catia") or {}).get(NOMBRE)
    cc = (s.get("cdg_catia_mm") or {}).get(NOMBRE)
    if not cerca(vc, ref.get("volumen"), TOL_VOL_INTERNO_MM3):
        malos.append(f"volumen de CATIA por dentro {vc} contra {ref.get('volumen')} de la referencia")
    try:
        dc = sum((float(a) - float(b)) ** 2 for a, b in zip(cc, ref.get("cdg_mm"))) ** 0.5
    except (TypeError, ValueError):
        dc = None
    if dc is None or dc != dc or not dc <= TOL_CDG_MM:
        malos.append(f"centro de CATIA por dentro {cc} contra {ref.get('cdg_mm')} de la referencia")
    if comp.get("booleana_cierra") is not True or list(comp.get("solidos") or []) != [1, 1]:
        malos.append(f"booleana {comp.get('booleana_cierra')} y solidos {comp.get('solidos')}")
    return malos


def cerrar_con_referencia(carpeta, referencia=None, medir=None, comparar=None):
    """Idempotente. referencia/medir/comparar se cambian en la prueba sin CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    malos = []
    paso = os.path.join(carpeta, EJ, NOMBRE + ".stp")
    if not os.path.isfile(paso):
        malos.append("CATIA no dejo el STEP")
    else:
        try:
            ref_paso = referencia or generar_referencia(carpeta)
            ref = (medir or medir_step)(ref_paso)
            comp = (comparar or comparar_step)(paso, ref_paso)
            s["referencia"], s["contra_la_referencia"] = ref, comp
            malos += juzgar(s, ref, comp)
        except Exception as e:  # noqa: BLE001
            malos.append(f"no se pudo comparar contra la referencia: {e!r}"[:400])
    s["ok_referencia"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_GANCHO", json.dumps({"ok": s["ok"], "contra_la_referencia": s.get("contra_la_referencia"), "malos": malos},
                                   ensure_ascii=False))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_referencia(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar contra la referencia:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
