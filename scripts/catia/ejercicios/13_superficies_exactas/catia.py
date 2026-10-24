# -*- coding: utf-8 -*-
"""Ejercicio 13 del banco de CATIA (cola del 24/10/2026): SUPERFICIES (Generative Shape Design) contra formulas de
geometria con respuesta EXACTA. No tiene bien.py en el banco 3D: la respuesta conocida es la formula (con su nombre) y el
tercer cruce es el STEP que exporta CATIA leido con build123d (los dos solidos).

Pieza 1, «superficies_tronco» (lo del ej51 de la practica del 19/10, mas dos nuevas):
  - tronco de cono r1 20, r2 10, h 30 por REVOLUCION de una recta: area lateral pi (r1 + r2) s, s = raiz((r1-r2)^2 + h^2);
  - el mismo tronco por MULTI-SECCION entre los dos circulos (macro VBScript: el Nothing no pasa desde Python, ej51);
  - tapas con FILL: pi r1^2 y pi r2^2;
  - JOIN de lateral + tapas y CLOSESURFACE al cuerpo: volumen del tronco de cono pi h (r1^2 + r1 r2 + r2^2) / 3;
  - tubo BARRIDO de r 5 sobre un arco R 50 de 90 grados: area 2 pi r (R pi / 2) (teorema de Pappus);
  - NUEVO: media esfera R 25 por revolucion de un cuarto de circunferencia: 2 pi R^2 (Arquimedes: zona esferica 2 pi R h);
  - NUEVO: toro R 30, r 5 por revolucion de una circunferencia entera: 4 pi^2 R r (Pappus).
Pieza 2, «superficies_cilindro» (lo del ej52):
  - cilindro r 20 h 30 por EXTRUSION de un circulo: 2 pi r h;
  - OFFSET 3 hacia afuera: 2 pi 23 30 (hacia adentro daria 2 pi 17 30: el lado se elige por la medida y el otro queda
    anotado como gemelo);
  - SPLIT del cilindro con el plano z 10, lo de arriba: 2 pi 20 20 (lo de abajo, 2 pi 20 10);
  - THICKSURFACE 2 hacia afuera al cuerpo: pi (22^2 - 20^2) 30 (hacia adentro, pi (20^2 - 18^2) 30);
  - EMPALME bitangente R 5 entre dos placas 40 x 50 a 90 grados, con recorte: 2 (40 - 5) 50 + (pi 5 / 2) 50.

Donde el lado de una operacion se elige por la medida (offset, split, thick, empalme), la eleccion no prueba nada por si
sola: por eso se prueban TODOS los lados, cada uno se mide en CATIA y se borra, y se rehace el que da la formula; lo que
dio cada lado queda en salida.json («intentos», y los numeros de los otros lados en «gemelos»). El empalme no tiene
gemelo medido: sus otras tres orientaciones dan error en CATIA; su gemelo es de cuenta (sin recorte, +12,8 %).

ok = todos los pasos sin falla Y cada medida a 0,01 % o menos de su formula Y el STEP de cada pieza, leido con build123d,
con 1 solido, 1 cascara, 0 caras sueltas y el volumen de su formula (0,01 %) Y el STL de cada pieza cerrado y con el
volumen de CATIA a 5 % (las caras hacia adentro no las ve el volumen de CATIA: el STL resta, NOTAS 19/10).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, dos STEP y dos capturas BMP.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

EJ = "13_superficies_exactas"              # sin bien.py en el banco 3D (con_bien=False)
PI = math.pi
R1, R2, H = 20.0, 10.0, 30.0               # tronco de cono
R_TUBO, R_GUIA = 5.0, 50.0                 # tubo barrido
R_ESF = 25.0                               # media esfera
R_TORO, r_TORO = 30.0, 5.0                 # toro
R_CIL, H_CIL, OFF, ESP, Z_SPLIT = 20.0, 30.0, 3.0, 2.0, 10.0
PLACA, ANCHO_PLACA, R_EMP = 40.0, 50.0, 5.0
X_ESF, X_TORO, X_TUBO, X_EMP = 120.0, 220.0, 100.0, 200.0     # cada cosa lejos de las otras (no se tocan)
TOL_REL = 1e-4                             # 0,01 %, escrito antes de correr
TOL_STL_REL = 5e-2                         # 5 %: solo un error GRUESO de la malla. El facetado de CATIA dio -1,23 % (tronco)
                                           # y -1,14 % (tubo de pared 2: el 24-gono inscripto, revisor) el 24/10 09:31. Las
                                           # caras hacia adentro NO se cazan con este numero (la v16 resto -3,84 %): las
                                           # cazan la orientacion de los triangulos y los cuerpos negativos
                                           # (jc.veredicto_stl)

CUENTA = {
    "lateral_revolucion": PI * (R1 + R2) * math.hypot(R1 - R2, H),
    "lateral_multiseccion": PI * (R1 + R2) * math.hypot(R1 - R2, H),
    "tapa_r1": PI * R1 ** 2,
    "tapa_r2": PI * R2 ** 2,
    "volumen_tronco": PI * H * (R1 ** 2 + R1 * R2 + R2 ** 2) / 3,
    "tubo_barrido": 2 * PI * R_TUBO * (R_GUIA * PI / 2),
    "media_esfera": 2 * PI * R_ESF ** 2,
    "toro": 4 * PI ** 2 * R_TORO * r_TORO,
    "cilindro": 2 * PI * R_CIL * H_CIL,
    "offset_afuera": 2 * PI * (R_CIL + OFF) * H_CIL,
    "split_arriba": 2 * PI * R_CIL * (H_CIL - Z_SPLIT),
    "volumen_thick": PI * ((R_CIL + ESP) ** 2 - R_CIL ** 2) * H_CIL,
    "empalme": 2 * (PLACA - R_EMP) * ANCHO_PLACA + (PI * R_EMP / 2) * ANCHO_PLACA,
}
GEMELO = {                                 # lo que daria el lado equivocado
    "offset_afuera": 2 * PI * (R_CIL - OFF) * H_CIL,
    "split_arriba": 2 * PI * R_CIL * Z_SPLIT,
    "volumen_thick": PI * (R_CIL ** 2 - (R_CIL - ESP) ** 2) * H_CIL,
    # el empalme: 3 de sus 4 orientaciones dan error en CATIA (no hay gemelo medido); el de cuenta es sin recorte
    "empalme": 2 * PLACA * ANCHO_PLACA + (PI * R_EMP / 2) * ANCHO_PLACA,
}
VOLUMEN_PIEZA = {"superficies_tronco": "volumen_tronco", "superficies_cilindro": "volumen_thick"}
MACRO_LOFT = """Function CATMain(part, hsf, s1, s2, gs)
    Set lf = hsf.AddNewLoft()
    lf.AddSectionToLoft s1, 1, Nothing
    lf.AddSectionToLoft s2, 1, Nothing
    gs.AppendHybridShape lf
    part.Update
    CATMain = lf.Name
End Function"""


def construir(cb, c, reg, salida):
    salida.update({"cuenta": {k: round(v, 3) for k, v in CUENTA.items()}, "medidas_catia": {}, "gemelos": {},
                   "gemelos_cuenta": {k: round(v, 3) for k, v in GEMELO.items()}, "intentos": {}})
    med = salida["medidas_catia"]
    for nombre, armar in (("superficies_tronco", _tronco), ("superficies_cilindro", _cilindro)):
        try:
            doc, part, body, sf = cb.nueva_pieza(c, nombre)
            gs = part.HybridBodies.Add()
            gs.Name = "Superficies"
            armar(cb, c, reg, salida, med, doc, part, body, sf, gs)
            if body.Shapes.Count == 0:          # medir un cuerpo vacio rompe la sesion de CATIA (catia.md)
                reg.pasos.append({"paso": f"{nombre}: el cuerpo quedo vacio", "ok": False, "error": "sin solido"})
                continue
            jc.cerrar_parte(cb, c, reg, salida, doc, part, body, nombre, nombre, ocultos=[gs])

            def stl(nombre=nombre, doc=doc):
                ruta = os.path.join(reg.carpeta, nombre + ".stl")
                if os.path.exists(ruta):
                    os.remove(ruta)
                doc.ExportData(ruta, "stl")
                cb.exigir_archivo(ruta, f"exportar {nombre}.stl")
                salida["archivos"].append(os.path.relpath(ruta, salida["_carpeta"]))
                return ruta
            reg.paso(f"{nombre}: exportar STL (sentido de las caras del solido: el volumen de CATIA no lo ve)", stl)
            try:
                doc.Close()
            except Exception:  # noqa: BLE001
                pass
        except Exception:  # noqa: BLE001
            reg.pasos.append({"paso": f"{nombre}: armar", "ok": False, "error": traceback.format_exc()[-600:]})


def _comun(cb, part, gs, doc):
    hsf = part.HybridShapeFactory

    def poner(x, nombre=None):
        gs.AppendHybridShape(x)
        part.Update()
        if nombre:
            x.Name = nombre
        return x

    def borrar(x):
        sel = doc.Selection
        sel.Clear()
        sel.Add(x)
        sel.Delete()
        part.Update()

    def medida(x, que="area"):
        return cb.medir(doc, part, x)[que]

    def punto(x, y, z):
        return poner(hsf.AddNewPointCoord(float(x), float(y), float(z)))

    def eje_z(x):
        return poner(hsf.AddNewLinePtPt(cb.ref(part, punto(x, 0, 0)), cb.ref(part, punto(x, 0, 100))))
    return hsf, poner, borrar, medida, punto, eje_z


def _tronco(cb, c, reg, salida, med, doc, part, body, sf, gs):
    hsf, poner, borrar, medida, punto, eje_z = _comun(cb, part, gs, doc)
    o = part.OriginElements
    est = {}

    def revolucion():
        eje = eje_z(0.0)
        gen = poner(hsf.AddNewLinePtPt(cb.ref(part, punto(R1, 0, 0)), cb.ref(part, punto(R2, 0, H))), "Generatriz")
        est["rv"] = poner(hsf.AddNewRevol(cb.ref(part, gen), 360.0, 0.0, cb.ref(part, eje)), "Lateral_revolucion")
        med["lateral_revolucion"] = medida(est["rv"])
        return med["lateral_revolucion"]
    reg.paso("tronco de cono por revolucion de una recta (area lateral)", revolucion)

    def multiseccion():
        ph = poner(hsf.AddNewPlaneOffset(cb.ref(part, o.PlaneXY), H, False))
        k1 = poner(hsf.AddNewCircleCtrRad(cb.ref(part, punto(0, 0, 0)), cb.ref(part, o.PlaneXY), False, R1), "Circulo_r1")
        k2 = poner(hsf.AddNewCircleCtrRad(cb.ref(part, punto(0, 0, H)), cb.ref(part, ph), False, R2), "Circulo_r2")
        k1.SetLimitation(1)                            # circulo completo
        k2.SetLimitation(1)
        part.Update()
        nombre = cb.evaluar(c, MACRO_LOFT, part, hsf, cb.ref(part, k1), cb.ref(part, k2), gs)
        lf = gs.HybridShapes.Item(nombre)
        est.update(k1=k1, k2=k2)
        med["lateral_multiseccion"] = medida(lf)
        return med["lateral_multiseccion"]
    reg.paso("el mismo tronco por multi-seccion entre los dos circulos (area lateral)", multiseccion)

    def tapas():
        for clave, k in (("tapa_r1", est["k1"]), ("tapa_r2", est["k2"])):
            f = hsf.AddNewFill()
            f.AddBound(cb.ref(part, k))
            est[clave] = poner(f, "Fill_" + clave)
            med[clave] = medida(est[clave])
        return {k: med[k] for k in ("tapa_r1", "tapa_r2")}
    reg.paso("tapas con Fill", tapas)

    def cerrar():
        j = hsf.AddNewJoin(cb.ref(part, est["rv"]), cb.ref(part, est["tapa_r1"]))
        j.AddElement(cb.ref(part, est["tapa_r2"]))
        poner(j, "Join_tronco")
        part.InWorkObject = body
        sf.AddNewCloseSurface(cb.ref(part, j))
        part.Update()
        med["volumen_tronco"] = medida(body, "volume")
        return med["volumen_tronco"]
    reg.paso("Join + CloseSurface al cuerpo (volumen del tronco)", cerrar)

    def tubo():
        arco = hsf.AddNewCircleCtrRadWithAngles(cb.ref(part, punto(X_TUBO, 0, 0)), cb.ref(part, o.PlaneXY), False,
                                                R_GUIA, 0.0, 90.0)
        poner(arco, "Guia_R50_90")
        ini = punto(X_TUBO + R_GUIA, 0, 0)
        pn = poner(hsf.AddNewPlaneNormal(cb.ref(part, arco), cb.ref(part, ini)))
        perfil = hsf.AddNewCircleCtrRad(cb.ref(part, ini), cb.ref(part, pn), False, R_TUBO)
        perfil.SetLimitation(1)
        poner(perfil, "Perfil_r5")
        sw = poner(hsf.AddNewSweepExplicit(cb.ref(part, perfil), cb.ref(part, arco)), "Tubo_barrido")
        med["tubo_barrido"] = medida(sw)
        return med["tubo_barrido"]
    reg.paso("tubo barrido r 5 sobre un arco R 50 de 90 grados (Pappus)", tubo)

    def media_esfera():
        """Cuarto de circunferencia en el plano ZX (contiene el eje Z que pasa por su centro) girado 360 grados: entre
        dos ejes del plano, sea cual sea el sentido de los angulos, el cuarto va del ecuador al polo."""
        eje = eje_z(X_ESF)
        arco = hsf.AddNewCircleCtrRadWithAngles(cb.ref(part, punto(X_ESF, 0, 0)), cb.ref(part, o.PlaneZX), False,
                                                R_ESF, 0.0, 90.0)
        poner(arco, "Cuarto_R25")
        sup = poner(hsf.AddNewRevol(cb.ref(part, arco), 360.0, 0.0, cb.ref(part, eje)), "Media_esfera")
        med["media_esfera"] = medida(sup)
        return med["media_esfera"]
    reg.paso(f"media esfera R {R_ESF:g} por revolucion de un cuarto de circunferencia (2 pi R^2)", media_esfera)

    def toro():
        eje = eje_z(X_TORO)
        k = hsf.AddNewCircleCtrRad(cb.ref(part, punto(X_TORO + R_TORO, 0, 0)), cb.ref(part, o.PlaneZX), False, r_TORO)
        k.SetLimitation(1)
        poner(k, "Circulo_r5_toro")
        sup = poner(hsf.AddNewRevol(cb.ref(part, k), 360.0, 0.0, cb.ref(part, eje)), "Toro")
        med["toro"] = medida(sup)
        return med["toro"]
    reg.paso(f"toro R {R_TORO:g} r {r_TORO:g} por revolucion de una circunferencia (4 pi^2 R r)", toro)


def _cilindro(cb, c, reg, salida, med, doc, part, body, sf, gs):
    hsf, poner, borrar, medida, punto, eje_z = _comun(cb, part, gs, doc)
    o = part.OriginElements
    est = {}

    def cilindro():
        k = hsf.AddNewCircleCtrRad(cb.ref(part, punto(0, 0, 0)), cb.ref(part, o.PlaneXY), False, R_CIL)
        k.SetLimitation(1)
        poner(k, "Circulo_r20")
        ex = hsf.AddNewExtrude(cb.ref(part, k), H_CIL, 0.0, hsf.AddNewDirectionByCoord(0, 0, 1))
        est["cil"] = poner(ex, "Cilindro")
        m = cb.medir(doc, part, ex)
        med["cilindro"] = m["area"]
        if abs(m["cdg_mm"][2] - H_CIL / 2) > 0.01:
            raise RuntimeError(f"el cilindro crecio para abajo: cdg z {m['cdg_mm'][2]}")
        return {"area": m["area"], "cdg_z": m["cdg_mm"][2]}
    reg.paso(f"cilindro r {R_CIL:g} h {H_CIL:g} por extrusion de un circulo (+Z medido)", cilindro)

    def elegir(clave, crear, que="area", sobre=None):
        """Prueba TODOS los lados (cada uno se mide y se borra), anota lo que dio cada uno y rehace el que da la formula:
        el numero del otro lado, medido en CATIA, es el gemelo que muestra que el control separa."""
        intentos = {}

        def probar(hacer):
            x = hacer()
            if sobre is None:
                poner(x)
            else:
                part.Update()
            return x, medida(sobre if sobre is not None else x, que)
        for lado, hacer in crear:
            x = hacer()                                # se crea afuera del try: si falla, igual se borra
            try:
                if sobre is None:
                    poner(x)
                else:
                    part.Update()
                intentos[str(lado)] = round(medida(sobre if sobre is not None else x, que), 3)
            except Exception as e:  # noqa: BLE001
                intentos[str(lado)] = repr(e)[:60]
            try:                                       # un elemento roto en el arbol hace fallar todo Update siguiente
                borrar(x)
            except Exception as e:  # noqa: BLE001
                intentos[f"{lado} (no se pudo borrar)"] = repr(e)[:60]
        salida["intentos"][clave] = intentos
        buenos = [(lado, h) for lado, h in crear if isinstance(intentos.get(str(lado)), float)
                  and abs(intentos[str(lado)] - CUENTA[clave]) <= TOL_REL * CUENTA[clave]]
        if not buenos:
            raise RuntimeError(f"{clave}: ningun lado da la formula {CUENTA[clave]:.3f}: {intentos}")
        lado, hacer = buenos[0]
        x = None
        try:
            x, v = probar(hacer)
        except Exception:
            if x is not None:                          # que no quede roto en el arbol (rompe cada Update siguiente)
                borrar(x)
            raise
        med[clave] = v
        salida["gemelos"][clave] = [w for k_, w in intentos.items() if k_ != str(lado) and isinstance(w, float)]
        return x, {"elegido": lado, "intentos": intentos}

    def offset():
        x, info = elegir("offset_afuera", [(o_, lambda o_=o_: hsf.AddNewOffset(cb.ref(part, est["cil"]), OFF, o_, 0.01))
                                           for o_ in (False, True)])
        x.Name = "Offset_3_afuera"
        return info
    reg.paso(f"offset de {OFF:g} hacia afuera (el lado por la formula; el otro es el gemelo)", offset)

    def split():
        pl = poner(hsf.AddNewPlaneOffset(cb.ref(part, o.PlaneXY), Z_SPLIT, False), "Plano_z10")
        x, info = elegir("split_arriba", [(l_, lambda l_=l_: hsf.AddNewHybridSplit(cb.ref(part, est["cil"]),
                                                                                  cb.ref(part, pl), l_))
                                          for l_ in (1, -1)])
        z = cb.medir(doc, part, x)["cdg_mm"][2]
        if z <= Z_SPLIT:
            raise RuntimeError(f"el split se quedo con lo de abajo: cdg z {z}")
        x.Name = "Split_arriba"
        return {**info, "cdg_z": z}
    reg.paso(f"split del cilindro con el plano z {Z_SPLIT:g}: lo de arriba", split)

    def thick():
        part.InWorkObject = body
        x, info = elegir("volumen_thick", [(l_, lambda l_=l_: sf.AddNewThickSurface(cb.ref(part, est["cil"]), l_, ESP,
                                                                                    0.0)) for l_ in (0, 1)],
                         que="volume", sobre=body)
        x.Name = "Thick_2_afuera"
        return info
    reg.paso(f"thicksurface de {ESP:g} hacia afuera al cuerpo (volumen)", thick)

    def empalme():
        pa, pb = punto(X_EMP, 0, 0), punto(X_EMP, ANCHO_PLACA, 0)
        arista = poner(hsf.AddNewLinePtPt(cb.ref(part, pa), cb.ref(part, pb)), "Arista_comun")
        piso = poner(hsf.AddNewExtrude(cb.ref(part, arista), PLACA, 0.0, hsf.AddNewDirectionByCoord(1, 0, 0)),
                     "Placa_piso")
        pared = poner(hsf.AddNewExtrude(cb.ref(part, arista), PLACA, 0.0, hsf.AddNewDirectionByCoord(0, 0, 1)),
                      "Placa_pared")
        x, info = elegir("empalme", [((o1, o2), lambda o1=o1, o2=o2: hsf.AddNewFilletBiTangent(
            cb.ref(part, piso), cb.ref(part, pared), R_EMP, o1, o2, 1, 0)) for o1 in (1, -1) for o2 in (1, -1)])
        x.Name = "Empalme_R5"
        return info
    reg.paso(f"empalme bitangente R {R_EMP:g} entre dos placas a 90 grados, con recorte", empalme)


def _archivo(s, carpeta, nombre):
    return next((os.path.join(carpeta, a) for a in s.get("archivos") or [] if os.path.basename(a).lower() == nombre), "")


def cerrar_con_cuentas(carpeta, medir=None):
    """Despues de correr_ejercicio (con_bien=False: el ok es solo de los pasos): cada medida contra su formula; el STEP de
    cada pieza, leido con build123d, con 1 solido, 1 cascara, 0 caras sueltas y el volumen de su formula; y su STL
    cerrado con el volumen de CATIA a 5 % (las caras hacia adentro no las ve el volumen de CATIA). `medir` es
    jc.medir_b123d (se cambia en la prueba sin CATIA)."""
    medir = medir or jc.medir_b123d
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))     # el juez sin bien.py deja ok en falso hasta aca
    s.pop("pendiente", None)
    med = s.get("medidas_catia") or {}
    s["dif_rel"] = {}
    malos = []
    for k, v in CUENTA.items():
        if med.get(k) is None:
            malos.append(f"{k}: sin medir")
            continue
        s["dif_rel"][k] = round((med[k] - v) / v, 9)
        if abs(s["dif_rel"][k]) > TOL_REL:
            malos.append(f"{k}: {med[k]} contra la formula {v:.3f}")
    s["step_catia_en_build123d"], s["stl_catia"] = {}, {}
    for pieza, clave in VOLUMEN_PIEZA.items():
        p_step = _archivo(s, carpeta, pieza + ".stp")
        r = medir(["step", p_step]) if os.path.isfile(p_step) else {"error": "no esta el archivo"}
        d = (r.get("partes") or {}).get(pieza) or {"error": r.get("error")}
        s["step_catia_en_build123d"][pieza] = d
        if "solidos" not in d:
            malos.append(f"STEP de {pieza} sin medir en build123d ({d.get('error') or 'no esta el archivo'})")
        else:
            if (d.get("solidos"), d.get("cascaras"), d.get("caras_sueltas")) != (1, 1, 0):
                malos.append(f"STEP de {pieza}: {d.get('solidos')} solidos, {d.get('cascaras')} cascaras, "
                             f"{d.get('caras_sueltas')} caras sueltas (se esperaba 1, 1, 0: se exporta lo visible)")
            if abs(d["volumen"] - CUENTA[clave]) > TOL_REL * CUENTA[clave]:
                malos.append(f"STEP de {pieza}: {d['volumen']} mm3 contra {CUENTA[clave]:.3f}")
        p_stl = _archivo(s, carpeta, pieza + ".stl")
        vc = (s.get("volumen_catia") or {}).get(pieza)
        r = medir(["stl", p_stl]) if os.path.isfile(p_stl) else {"error": "no esta el archivo"}
        e = (r.get("partes") or {}).get(pieza) or {"error": r.get("error")}
        s["stl_catia"][pieza] = e
        vs = e.get("volumen_stl")
        if vs is None or vc is None:
            malos.append(f"STL de {pieza} sin medir ({e.get('error') or 'no esta el archivo o falta el volumen de CATIA'})")
        elif jc.veredicto_stl(e, vc, TOL_STL_REL):
            malos.append(f"STL de {pieza}: {jc.veredicto_stl(e, vc, TOL_STL_REL)}")
    s["tolerancia_rel"], s["tolerancia_stl_rel"] = TOL_REL, TOL_STL_REL
    s["ok_formulas"] = not malos
    s["ok"] = s["ok_pasos"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_FORMULAS", json.dumps({"ok": s["ok"], "dif_rel": s["dif_rel"], "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_cuentas(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con las formulas:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
