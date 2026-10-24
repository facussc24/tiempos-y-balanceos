# -*- coding: utf-8 -*-
"""Ejercicio 09 del banco de CATIA (cola del 24/10/2026): Too Tall Toby PPP01-05 «Paste Sleeve» hecho por SUPERFICIES
(Generative Shape Design) en CATIA, con la masa de la guia y el area de la piel cruzadas.

Pieza: la del ejercicio 15 del banco 3D (evals/banco3d/ejercicios/15_ttt_paste_sleeve/_paste_sleeve.py y tarea.yaml),
mismas cotas y mismos ejes: Z arriba, boca grande abajo en z 0, boca chica arriba en z 133, X el lado largo de las bocas.
Seccion oblonga (dos rectas y dos semicirculos). Afuera: 51 x 44 recto de z 0 a 30 y transicion reglada hasta 66 x 10 en
z 133. Adentro (pared 3 medida en el plano horizontal, lectura (a) del tarea.yaml): 45 x 38 -> 60 x 4.

Respuesta conocida: la guia de build123d (tttt.html#ttt-ppp0105) publica 57,08 g en ABS, 1 020 kg/m3, +-1 g. La masa sale
del volumen de CATIA por la densidad del rotulo del plano (no del catalogo de CATIA: no trae ABS de 1 020). Esta lectura
del plano da 56,73 g (la duda de la pared queda abierta en el tarea.yaml del 15).

Metodo (practica del 19/10, ej29, y reference/catia.md de la skill cad-design): la multi-seccion SOLIDA de Part Design
fallo siempre en R21; la transicion va por superficies: loft vertice a vertice (SectionCoupling 4) de dos croquis
oblongos, tapas con Fill, Join con SetDeviation 0,01 e Invert (sin Invert el solido sale con las caras hacia adentro y el
STL resta), CloseSurface al cuerpo. El hueco se arma en un SEGUNDO cuerpo (recto + transicion + tapa) y se resta con
Remove. Cada operacion se mide contra la cuenta de abajo (1 mm3).

La cuenta: una transicion reglada vertice a vertice entre dos oblongas lleva cada punto de una al punto de la otra con el
mismo parametro, asi que la seccion a media altura es otra oblonga con largo y ancho promedio; el area de la seccion es
cuadratica en la altura y Simpson da el volumen exacto: V = h/6 (A0 + 4 Am + A1).

ok = cruce con build123d (0,5 mm3 y 0,01 mm de centro de gravedad: juez_comun) Y masa a 1 g o menos de 57,08 Y area
total de la piel de CATIA a 0,01 % o menos de la de build123d sobre el mismo bien.py Y el STEP que exporta CATIA con 1
solido, 1 cascara y 0 caras sueltas (superficies de construccion a la vista) y la misma area Y el STL que exporta CATIA
cerrado y con el volumen del solido a 5 % (las caras hacia adentro no las ve el volumen de CATIA: el STL resta).
Lo que el cruce con build123d prueba es que CATIA reproduce la lectura (a) de la pared del bien.py del 15; la lectura (b)
(57,06 g) daria rojo aca aunque este mas cerca de la guia (tarea.yaml del 15, duda abierta).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, STEP y captura BMP.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

EJ = "15_ttt_paste_sleeve"                 # id del ejercicio del BANCO 3D: correr_ejercicio arma con el la ruta de bien.py
NOMBRE = "paste_sleeve"                    # bien.py del 15 escribe paste_sleeve.step: medir_b123d nombra la parte asi
ALTO, ALTO_RECTO, PARED = 133.0, 30.0, 3.0
INT_ABAJO, INT_ARRIBA = (45.0, 38.0), (60.0, 4.0)
EXT_ABAJO = (INT_ABAJO[0] + 2 * PARED, INT_ABAJO[1] + 2 * PARED)        # 51 x 44
EXT_ARRIBA = (INT_ARRIBA[0] + 2 * PARED, INT_ARRIBA[1] + 2 * PARED)     # 66 x 10
DENSIDAD_G_MM3 = 1.02e-3                   # ABS, 1 020 kg/m3 (rotulo del plano, tarea.yaml del 15)
MASA_GUIA_G, TOL_MASA_G = 57.08, 1.0       # guia de build123d, tolerancia del rotulo (tarea.yaml del 15)
TOL_AREA_REL = 1e-4                        # 0,01 %: CATIA y build123d sobre la misma pieza (escrito ANTES de correr)
TOL_OP = 1.0                               # mm3: lo que suma o saca cada operacion contra la cuenta
TOL_STL_REL = 5e-2                         # 5 %: solo un error GRUESO de la malla (aca el facetado da -0,24 %; en el 13,
                                           # -1,2 %). Las caras hacia adentro las cazan la orientacion de los triangulos y
                                           # los cuerpos negativos (jc.veredicto_stl), no este numero: la v16 resto -3,84 %.
                                           # Sin Invert este STL sale igual (24/10 09:48): CloseSurface lo orienta bien aca
PI = math.pi


# ---------------------------------------------------------------- la cuenta (Python puro: tambien corre en la notebook)
def area_oblonga(largo, ancho):
    """Oblonga de largo y ancho TOTALES (puntas de radio ancho/2): rectangulo (largo - ancho) x ancho + circulo."""
    r = ancho / 2
    return (largo - ancho) * ancho + PI * r * r


def vol_reglado(abajo, arriba, h):
    medio = ((abajo[0] + arriba[0]) / 2, (abajo[1] + arriba[1]) / 2)
    return h / 6 * (area_oblonga(*abajo) + 4 * area_oblonga(*medio) + area_oblonga(*arriba))


def cuenta(pared=PARED):
    """Lo que tiene que sumar o sacar cada operacion, en orden, y el volumen final. `pared` en mm (3 = el plano; 4 es el
    mal_3 del 15, para probar la cuenta contra build123d)."""
    h = ALTO - ALTO_RECTO
    ext_ab = (INT_ABAJO[0] + 2 * pared, INT_ABAJO[1] + 2 * pared)
    ext_ar = (INT_ARRIBA[0] + 2 * pared, INT_ARRIBA[1] + 2 * pared)
    ops = {
        "recto_afuera": area_oblonga(*ext_ab) * ALTO_RECTO,
        "transicion_afuera": vol_reglado(ext_ab, ext_ar, h),
        "hueco_recto": area_oblonga(*INT_ABAJO) * (ALTO_RECTO + 1),        # de z -1 a 30: pasa la boca de abajo
        "hueco_transicion": vol_reglado(INT_ABAJO, INT_ARRIBA, h),
        "hueco_tapa": area_oblonga(*INT_ARRIBA) * 1.0,                     # de z 133 a 134: pasa la boca de arriba
    }
    saca = area_oblonga(*INT_ABAJO) * ALTO_RECTO + ops["hueco_transicion"]  # lo del hueco que cae adentro de la pieza
    ops["restar_hueco"] = -saca
    vol = ops["recto_afuera"] + ops["transicion_afuera"] - saca
    return ops, vol


# ---------------------------------------------------------------- CATIA
def oblonga(f, largo, ancho):
    """Croquis de la oblonga centrada (como ranura() del ej29): 4 puntos compartidos, 2 rectas, 2 arcos de 180 con sus
    angulos explicitos; arranca en (-L, -r) y va antihorario, igual en todas las secciones (el loft acopla vertice con
    vertice en el mismo orden)."""
    r = ancho / 2
    L = largo / 2 - r
    p = [f.CreatePoint(-L, -r), f.CreatePoint(L, -r), f.CreatePoint(L, r), f.CreatePoint(-L, r)]
    l1 = f.CreateLine(-L, -r, L, -r)
    l1.StartPoint, l1.EndPoint = p[0], p[1]
    a1 = f.CreateCircle(L, 0.0, r, -PI / 2, PI / 2)
    a1.CenterPoint = f.CreatePoint(L, 0.0)
    a1.StartPoint, a1.EndPoint = p[1], p[2]
    l2 = f.CreateLine(L, r, -L, r)
    l2.StartPoint, l2.EndPoint = p[2], p[3]
    a2 = f.CreateCircle(-L, 0.0, r, PI / 2, 3 * PI / 2)
    a2.CenterPoint = f.CreatePoint(-L, 0.0)
    a2.StartPoint, a2.EndPoint = p[3], p[0]


MACRO_LOFT = """Function CATMain(part, hsf, s1, s2, gs)
    Set lf = hsf.AddNewLoft()
    lf.SectionCoupling = 4
    lf.AddSectionToLoft s1, 1, Nothing
    lf.AddSectionToLoft s2, 1, Nothing
    gs.AppendHybridShape lf
    part.Update
    CATMain = lf.Name
End Function"""


def construir(cb, c, reg, salida):
    ops, vol_final = cuenta()
    salida.update({"cuenta_mm3": {k: round(v, 3) for k, v in ops.items()}, "volumen_cuenta_mm3": round(vol_final, 3),
                   "area_catia": {}, "masa_guia_g": MASA_GUIA_G})
    doc, part, main, sf = cb.nueva_pieza(c, NOMBRE)
    hsf = part.HybridShapeFactory
    xy = part.OriginElements.PlaneXY
    est = {"ocultar": [], "m_main": None, "m_hueco": None}

    def plano(contenedor, z, en_cuerpo):
        p = hsf.AddNewPlaneOffset(cb.ref(part, xy), float(z), False)
        if en_cuerpo:
            contenedor.InsertHybridShape(p)
        else:
            contenedor.AppendHybridShape(p)
        part.Update()
        est["ocultar"].append(p)
        return p

    def croquis_cuerpo(cuerpo, pl, largo, ancho):
        sk = cuerpo.Sketches.Add(cb.ref(part, pl))
        f = sk.OpenEdition()
        oblonga(f, largo, ancho)
        sk.CloseEdition()
        part.Update()
        return sk

    def solido_por_superficies(nombre_gs, cuerpo, abajo, arriba, clave):
        """Loft vertice a vertice + 2 Fill + Join (0,01, Invert) + CloseSurface en `cuerpo`. Controla lo que suma."""
        gs = part.HybridBodies.Add()
        gs.Name = nombre_gs
        est["ocultar"].append(gs)
        sks = []
        for z, (lg, an) in ((ALTO_RECTO, abajo), (ALTO, arriba)):
            pz = plano(gs, z, en_cuerpo=False)
            sk = gs.HybridSketches.Add(cb.ref(part, pz))
            f = sk.OpenEdition()
            oblonga(f, lg, an)
            sk.CloseEdition()
            part.Update()
            sks.append(sk)
        lo, agregado = None, False
        try:                                           # ej29: anduvo con None desde Python
            lo = hsf.AddNewLoft()
            lo.SectionCoupling = 4
            for sk in sks:
                lo.AddSectionToLoft(cb.ref(part, sk), 1, None)
            gs.AppendHybridShape(lo)
            agregado = True
            part.Update()
            via = "python"
        except Exception:  # noqa: BLE001  (ej51: con circulos el Nothing no paso desde Python: macro VBScript)
            if agregado:                               # un loft roto en el arbol hace fallar todo Update siguiente
                sel = doc.Selection
                sel.Clear()
                sel.Add(lo)
                sel.Delete()
                part.Update()
            nombre = cb.evaluar(c, MACRO_LOFT, part, hsf, cb.ref(part, sks[0]), cb.ref(part, sks[1]), gs)
            lo = gs.HybridShapes.Item(nombre)
            via = "macro"
        tapas = []
        for sk in sks:
            fi = hsf.AddNewFill()
            fi.AddBound(cb.ref(part, sk))
            gs.AppendHybridShape(fi)
            part.Update()
            tapas.append(fi)
        jn = hsf.AddNewJoin(cb.ref(part, lo), cb.ref(part, tapas[0]))
        jn.AddElement(cb.ref(part, tapas[1]))
        jn.SetDeviation(0.01)
        jn.Invert = True                               # sin esto el solido sale con las caras hacia adentro (NOTAS 19/10)
        gs.AppendHybridShape(jn)
        part.Update()
        antes = est["m_main"] if cuerpo is main else est["m_hueco"]
        part.InWorkObject = cuerpo
        sf.AddNewCloseSurface(cb.ref(part, jn))
        part.Update()
        m = cb.medir(doc, part, cuerpo)
        dv = m["volume"] - (antes or {}).get("volume", 0.0)
        if abs(dv - ops[clave]) > TOL_OP:
            raise RuntimeError(f"la transicion suma {dv:.3f} mm3 y la cuenta dice {ops[clave]:.3f}")
        if cuerpo is main:
            est["m_main"] = m
        else:
            est["m_hueco"] = m
        return {"loft": via, "suma": round(dv, 3), "cuenta": round(ops[clave], 3)}

    def recto_afuera():
        part.InWorkObject = main
        sk = croquis_cuerpo(main, xy, *EXT_ABAJO)
        _, est["m_main"], info = jc.extruir(cb, doc, part, main, sf, sk, ALTO_RECTO, ops["recto_afuera"],
                                            (0.0, 0.0, ALTO_RECTO / 2))
        return info
    seguir = reg.paso(f"tramo recto de afuera: oblonga {EXT_ABAJO[0]:g} x {EXT_ABAJO[1]:g}, pad de {ALTO_RECTO:g} desde XY",
                      recto_afuera) is not None
    if seguir:
        seguir = reg.paso(f"transicion de afuera por superficies: {EXT_ABAJO[0]:g} x {EXT_ABAJO[1]:g} en z {ALTO_RECTO:g} "
                          f"-> {EXT_ARRIBA[0]:g} x {EXT_ARRIBA[1]:g} en z {ALTO:g} (loft, Fill, Join, CloseSurface)",
                          lambda: solido_por_superficies("Superficies afuera", main, EXT_ABAJO, EXT_ARRIBA,
                                                         "transicion_afuera")) is not None
    if seguir:
        def hueco_recto():
            b2 = part.Bodies.Add()
            b2.Name = "Hueco"
            est["hueco"] = b2
            part.InWorkObject = b2
            p_abajo = plano(b2, -1.0, en_cuerpo=True)
            sk = croquis_cuerpo(b2, p_abajo, *INT_ABAJO)
            _, est["m_hueco"], info = jc.extruir(cb, doc, part, b2, sf, sk, ALTO_RECTO + 1, ops["hueco_recto"],
                                                 (0.0, 0.0, (ALTO_RECTO - 1) / 2))
            return info
        seguir = reg.paso(f"hueco, segundo cuerpo: oblonga {INT_ABAJO[0]:g} x {INT_ABAJO[1]:g} de z -1 a {ALTO_RECTO:g}",
                          hueco_recto) is not None
    if seguir:
        seguir = reg.paso(f"hueco: transicion {INT_ABAJO[0]:g} x {INT_ABAJO[1]:g} -> {INT_ARRIBA[0]:g} x "
                          f"{INT_ARRIBA[1]:g} por superficies",
                          lambda: solido_por_superficies("Superficies adentro", est["hueco"], INT_ABAJO, INT_ARRIBA,
                                                         "hueco_transicion")) is not None
    if seguir:
        def hueco_tapa():
            b2 = est["hueco"]
            part.InWorkObject = b2
            p_arriba = plano(b2, ALTO, en_cuerpo=True)
            sk = croquis_cuerpo(b2, p_arriba, *INT_ARRIBA)
            _, est["m_hueco"], info = jc.extruir(cb, doc, part, b2, sf, sk, 1.0, ops["hueco_tapa"],
                                                 (0.0, 0.0, ALTO + 0.5), antes=est["m_hueco"])
            return info
        seguir = reg.paso(f"hueco: oblonga {INT_ARRIBA[0]:g} x {INT_ARRIBA[1]:g} de z {ALTO:g} a {ALTO + 1:g} "
                          "(pasa la boca de arriba)", hueco_tapa) is not None
    if seguir:
        def restar():
            part.InWorkObject = main
            sf.AddNewRemove(est["hueco"])
            part.Update()
            m = cb.medir(doc, part, main)
            dv = m["volume"] - est["m_main"]["volume"]
            if abs(dv - ops["restar_hueco"]) > TOL_OP:
                raise RuntimeError(f"restar el hueco saca {-dv:.3f} mm3 y la cuenta dice {-ops['restar_hueco']:.3f}")
            est["m_main"] = m
            return {"saca": round(-dv, 3), "cuenta": round(-ops["restar_hueco"], 3)}
        seguir = reg.paso("restar el hueco del cuerpo principal (Remove)", restar) is not None
    if est["m_main"] is None:                  # cuerpo vacio: medirlo rompe la sesion de CATIA (catia.md)
        return
    m = reg.paso("area de la piel en CATIA (SPA, m2 -> mm2)", lambda: cb.medir(doc, part, main))
    if m and m.get("area") is not None:
        salida["area_catia"][NOMBRE] = m["area"]
    jc.cerrar_parte(cb, c, reg, salida, doc, part, main, NOMBRE, NOMBRE, ocultos=est["ocultar"])

    def stl():
        ruta = os.path.join(reg.carpeta, NOMBRE + ".stl")
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.ExportData(ruta, "stl")
        cb.exigir_archivo(ruta, f"exportar {NOMBRE}.stl")
        salida["archivos"].append(os.path.relpath(ruta, salida["_carpeta"]))
        return ruta
    reg.paso(f"{NOMBRE}: exportar STL (el control del sentido de las caras: sin Invert el STL resta, NOTAS 19/10)", stl)


# ---------------------------------------------------------------- despues de correr_ejercicio: masa, area y STEP
def cerrar_con_masa_y_area(carpeta, medir=None):
    """Agrega al salida.json la masa contra la guia, el area contra build123d (mismo bien.py) y el control del STEP de
    CATIA (un solido), y recalcula el ok. `medir` es jc.medir_b123d (se cambia en la prueba sin CATIA)."""
    medir = medir or jc.medir_b123d
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    malos = []
    vc = (s.get("volumen_catia") or {}).get(NOMBRE)
    if vc is None:
        malos.append("sin volumen de CATIA")
    else:
        s["masa_catia_g"] = round(vc * DENSIDAD_G_MM3, 3)
        s["dif_masa_g"] = round(s["masa_catia_g"] - MASA_GUIA_G, 3)
        s["tolerancia_masa_g"] = TOL_MASA_G
        if abs(s["dif_masa_g"]) > TOL_MASA_G:
            malos.append(f"masa {s['masa_catia_g']} g a mas de {TOL_MASA_G:g} g de la guia ({MASA_GUIA_G} g)")
    b_step = os.path.join(carpeta, "_build123d", NOMBRE + ".step")
    r = medir(["step", b_step]) if os.path.isfile(b_step) else {"error": f"no esta {b_step}"}
    ab = ((r.get("partes") or {}).get(NOMBRE) or {}).get("area")
    s["area_build123d"] = {NOMBRE: ab}
    ac = (s.get("area_catia") or {}).get(NOMBRE)
    if ab is None or ac is None:
        malos.append(f"area sin medir (CATIA {ac}, build123d {ab}; {r.get('error', '')})")
    else:
        s["dif_area_rel"] = round((ac - ab) / ab, 8)
        s["tolerancia_area_rel"] = TOL_AREA_REL
        if abs(s["dif_area_rel"]) > TOL_AREA_REL:
            malos.append(f"area de CATIA {ac} contra build123d {ab}: {100 * s['dif_area_rel']:.4f} %")
    paso_step = next((os.path.join(carpeta, a) for a in s.get("archivos") or []
                      if os.path.basename(a).lower() == NOMBRE + ".stp"), "")
    if os.path.isfile(paso_step):
        rs = medir(["step", paso_step])
        d = (rs.get("partes") or {}).get(NOMBRE) or {}
        s["step_catia_en_build123d"] = {k: d.get(k) for k in ("volumen", "area", "solidos", "cascaras", "caras_sueltas",
                                                              "error") if k in d}
        if "solidos" not in d:
            malos.append(f"no se pudo medir el STEP de CATIA con build123d: {d.get('error') or rs.get('error')}")
        else:
            # CATIA exporta lo visible: superficies de construccion a la vista salen como cascaras o caras sueltas y
            # solids() sigue dando 1 (revisor del 24/10); el STEP bueno trae 1 solido, 1 cascara y 0 caras sueltas
            if (d.get("solidos"), d.get("cascaras"), d.get("caras_sueltas")) != (1, 1, 0):
                malos.append(f"el STEP de CATIA trae {d.get('solidos')} solidos, {d.get('cascaras')} cascaras y "
                             f"{d.get('caras_sueltas')} caras sueltas (se esperaba 1, 1, 0: se exporta lo visible)")
            if ac is not None and d.get("area") is not None and abs(d["area"] - ac) > TOL_AREA_REL * ac:
                malos.append(f"el area del STEP de CATIA ({d['area']}) no es la que midio CATIA ({ac})")
    else:
        malos.append("CATIA no dejo el STEP")
    paso_stl = next((os.path.join(carpeta, a) for a in s.get("archivos") or []
                     if os.path.basename(a).lower() == NOMBRE + ".stl"), "")
    if os.path.isfile(paso_stl) and vc is not None:
        rl = medir(["stl", paso_stl])
        d = (rl.get("partes") or {}).get(NOMBRE) or {}
        s["stl_catia"] = d
        vs = d.get("volumen_stl")
        if vs is None:
            malos.append(f"no se pudo medir el STL de CATIA: {d.get('error') or rl.get('error')}")
        elif jc.veredicto_stl(d, vc, TOL_STL_REL):
            malos.append(f"el STL de CATIA: {jc.veredicto_stl(d, vc, TOL_STL_REL)}")
    else:
        malos.append("CATIA no dejo el STL" if vc is not None else "sin volumen de CATIA para comparar el STL")
    s["ok_masa_area_step"] = not malos
    s["ok"] = s["ok_cruce_build123d"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MASA_AREA", json.dumps({"ok": s["ok"], "masa_catia_g": s.get("masa_catia_g"),
                                       "dif_area_rel": s.get("dif_area_rel"), "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_masa_y_area(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo agregar masa y area a salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
