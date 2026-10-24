# -*- coding: utf-8 -*-
"""Comun de los ejercicios de «CATIA como segundo juez» (23/10/2026): esqueleto de un catia.py del banco 3D y ayudas de
Part Design por COM que no estan en catia_base (croquis con rectangulos y circulos, plano desplazado, extrusion con el
sentido MEDIDO, ocultar, captura BMP, medicion con build123d).

Cada catia.py define construir(cb, c, reg, salida) y llama correr_ejercicio(...). Mismo patron que el 04 (CATIA propia,
vigia, registro por paso, apagar al final), mas: build123d mide el STEP de cada parte del mismo bien.py del banco, y la
salida trae volumen_build123d y diferencia_mm3 por parte. El pid y la hora de arranque de la CATIA propia se escriben en
salida.json apenas conecta (el juez los usa si tiene que cerrar una CATIA colgada: solo esa, nunca por nombre).

Ejes de los planos de origen (catia.md, medidos el 19/10): XY: H->X, V->Y; YZ: H->Y, V->Z; ZX: H->Z, V->X. Igual el
sentido de cada extrusion se controla midiendo el centro de lo agregado (o lo sacado) contra la cuenta.
"""
import json
import math
import os
import subprocess
import sys
import time
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
if not os.path.isdir(os.path.join(REPO, "evals", "banco3d")):
    # el paquete del obrero vive en la nube (COLA 3D\obrero): ahi no hay banco; el repo clonado de esa PC si lo tiene
    # (CATA 24/10: los 006/007/008 midieron bien en CATIA pero "bien.py salio con 2: can't open file ..." por esta ruta)
    REPO = os.environ.get("BARACK_REPO") or r"C:\Dev\BarackMercosul"
VENV_CAD = os.environ.get("VENV_CAD", r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe")
TOL_VOL = 0.5          # mm3 por parte (el mismo del 04); tolerancia del juez, del banco, sin fuente de Barack
TOL_CDG = 0.01         # mm
TOL_SENTIDO = 1.0      # mm: el lado bueno y el malo de una extrusion quedan a decenas de mm

# coordenadas de un punto del mundo en el croquis de cada plano de origen: (H, V)
EJES = {"xy": lambda x, y, z: (x, y), "yz": lambda x, y, z: (y, z), "zx": lambda x, y, z: (z, x)}
PLANOS = {"xy": "PlaneXY", "yz": "PlaneYZ", "zx": "PlaneZX"}


def escribir(carpeta, salida):
    with open(os.path.join(carpeta, "salida.json"), "w", encoding="utf-8") as f:
        json.dump({k: v for k, v in salida.items() if not k.startswith("_")}, f, ensure_ascii=False, indent=1,
                  default=str)


def plano_origen(part, cual):
    return getattr(part.OriginElements, PLANOS[cual])


def plano_a(part, body, z):
    """Plano paralelo a XY a la altura z (como en el 04)."""
    p = part.HybridShapeFactory.AddNewPlaneOffset(part.CreateReferenceFromObject(part.OriginElements.PlaneXY),
                                                  float(z), False)
    body.InsertHybridShape(p)
    part.Update()
    return p


def croquis(cb, part, body, plano, rects=(), circulos=()):
    """rects: [(h0, v0, h1, v1)] y circulos: [(h, v, r)] en coordenadas del croquis."""
    sk = body.Sketches.Add(cb.ref(part, plano))
    f = sk.OpenEdition()
    for h0, v0, h1, v1 in rects:
        cb.poligono(f, [(h0, v0), (h1, v0), (h1, v1), (h0, v1)])
    for h, v, r in circulos:
        f.CreateClosedCircle(float(h), float(v), float(r))
    sk.CloseEdition()
    part.Update()
    return sk


def _agregado(antes, despues):
    """Volumen y centro de lo que sumo (o saco) una operacion, desde dos mediciones del cuerpo."""
    v0, c0 = (antes or {}).get("volume", 0.0), (antes or {}).get("cdg_mm", [0.0, 0.0, 0.0])
    v1, c1 = despues["volume"], despues["cdg_mm"]
    dv = v1 - v0
    if abs(dv) < 1e-6:
        return dv, None
    return dv, [(v1 * c1[i] - v0 * c0[i]) / dv for i in range(3)]


def extruir(cb, doc, part, body, sf, sk, largo, dv_esperado, centro_esperado=None, antes=None, vaciado=False,
            simetrico=False):
    """Pad (o pocket con vaciado=True) de `largo` desde el croquis, con el sentido controlado midiendo: lo agregado
    tiene que dar dv_esperado (negativo en un vaciado) y su centro centro_esperado; si no, se invierte y se mide otra
    vez. Simetrico: se controla solo el volumen (y si CATIA tomo el largo como total, se duplica)."""
    feat = sf.AddNewPocket(sk, float(largo)) if vaciado else sf.AddNewPad(sk, float(largo))
    if simetrico:
        feat.IsSymmetric = True
    part.Update()
    m = cb.medir(doc, part, body)
    dv, cen = _agregado(antes, m)
    info = {"dv": round(dv, 3), "dv_esperado": round(dv_esperado, 3), "centro": cen and [round(x, 3) for x in cen]}

    def bien(dv_, cen_):
        if abs(dv_ - dv_esperado) > 1.0:
            return False
        if centro_esperado is None or simetrico:
            return True
        return cen_ is not None and max(abs(a - b) for a, b in zip(cen_, centro_esperado)) <= TOL_SENTIDO

    if not bien(dv, cen):
        if simetrico and abs(2 * dv - dv_esperado) <= 1.0:          # tomo el largo como total: se duplica
            feat.FirstLimit.Dimension.Value = 2 * float(largo)
            info["largo_simetrico_es_total"] = True
        elif not simetrico:
            feat.DirectionOrientation = 1 - feat.DirectionOrientation
            info["invertido"] = True
        part.Update()
        m = cb.medir(doc, part, body)
        dv, cen = _agregado(antes, m)
        info.update({"dv": round(dv, 3), "centro": cen and [round(x, 3) for x in cen]})
        if not bien(dv, cen):
            raise RuntimeError(f"la extrusion no da lo esperado ni invertida: {info}, esperado centro {centro_esperado}")
    return feat, m, info


def ocultar(doc, obj):
    sel = doc.Selection
    sel.Clear()
    sel.Add(obj)
    sel.VisProperties.SetShow(1)        # 1 = oculto (CATIA exporta lo visible, NOTAS 19/10)
    sel.Clear()


def captura_bmp(c, carpeta, nombre):
    """Captura isometrica del visor en BMP (como el 04: el obrero no tiene Pillow para pasarla a PNG)."""
    try:
        c.ActiveWindow.Layout = 1           # solo la geometria, sin el arbol
    except Exception:  # noqa: BLE001
        pass
    v = c.ActiveWindow.ActiveViewer
    v.PutBackgroundColor((1.0, 1.0, 1.0))
    v.Viewpoint3D.PutSightDirection((-0.577, -0.577, -0.577))
    v.Viewpoint3D.PutUpDirection((0.0, 0.0, 1.0))
    v.Reframe()
    v.Update()
    ruta = os.path.join(carpeta, nombre + "_iso.bmp")
    if os.path.exists(ruta):
        os.remove(ruta)
    v.CaptureToFile(4, ruta)
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass
    return ruta


def cerrar_parte(cb, c, reg, salida, doc, part, body, nombre, parte, ocultos=()):
    """Mide la parte terminada, oculta lo de construccion, guarda CATPart + STEP y saca la captura."""
    m = reg.paso(f"{parte}: medir en CATIA", lambda: cb.medir(doc, part, body))
    if m:
        salida["volumen_catia"][parte] = m.get("volume")
        salida["cdg_catia_mm"][parte] = m.get("cdg_mm")
    for o in ocultos:
        reg.paso(f"{parte}: ocultar el plano antes de exportar", lambda o=o: ocultar(doc, o))
    rutas = reg.paso(f"{parte}: guardar CATPart + STEP", lambda: cb.guardar_pieza(doc, reg, nombre))
    if rutas:
        salida["_steps"][parte] = rutas["step"]
        salida["archivos"].append(os.path.relpath(rutas["step"], salida["_carpeta"]))
    bmp = reg.paso(f"{parte}: captura BMP", lambda: captura_bmp(c, reg.carpeta, nombre))
    if bmp:
        salida["archivos"].append(os.path.relpath(bmp, salida["_carpeta"]))


def medir_b123d(args, timeout=900):
    """Corre medir_b123d.py con .venv-cad. Devuelve el dict de su ultima linea, o {"error": ...}."""
    if not os.path.isfile(VENV_CAD):
        return {"error": f"no esta el entorno CAD ({VENV_CAD}): sin build123d no hay comparacion"}
    try:
        r = subprocess.run([VENV_CAD, "-I", os.path.join(AQUI, "medir_b123d.py")] + list(args), capture_output=True,
                           text=True, timeout=timeout)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:  # noqa: BLE001
        return {"error": f"build123d no midio: {e!r}"[:400]}


def comparar(salida, desplazamiento=(0.0, 0.0, 0.0)):
    """Llena diferencia_mm3 y dif_cdg_mm por parte (CATIA - build123d; el cdg de CATIA corrido por desplazamiento)."""
    salida["diferencia_mm3"], salida["dif_cdg_mm"] = {}, {}
    for k, vb in salida["volumen_build123d"].items():
        vc = salida["volumen_catia"].get(k)
        if vc is None or vb is None:
            salida["diferencia_mm3"][k] = None
            continue
        salida["diferencia_mm3"][k] = round(vc - vb, 3)
        cc, cbd = salida["cdg_catia_mm"].get(k), salida["cdg_build123d_mm"].get(k)
        if cc and cbd:
            salida["dif_cdg_mm"][k] = round(math.dist([a - d for a, d in zip(cc, desplazamiento)], cbd), 4)
    partes = list(salida["volumen_build123d"])
    return bool(partes) and all(
        salida["diferencia_mm3"].get(k) is not None and abs(salida["diferencia_mm3"][k]) <= TOL_VOL
        and salida["dif_cdg_mm"].get(k) is not None and salida["dif_cdg_mm"][k] <= TOL_CDG for k in partes)


def veredicto_stl(d, vc, tol_rel=0.05):
    """Veredicto del STL que exporto CATIA (lo que devuelve medir_b123d.py stl) contra el volumen de CATIA `vc`: None si
    esta bien, o el motivo. Las caras hacia adentro se cazan por la ORIENTACION de los triangulos y por cuerpos de volumen
    negativo, no por el porcentaje: el caso real conocido (v16, NOTAS 19/10) resto -3,84 %, del orden del facetado de una
    pieza chica curva (-1,2 % medido en el 13). `tol_rel` es solo para un error grueso (otra pieza, la mitad que falta)."""
    if d.get("volumen_stl") is None:
        return f"STL sin medir: {d.get('error') or 'no esta el archivo'}"
    mal = []
    if not d.get("cerrado"):
        mal.append("malla abierta")
    if d.get("orientacion_consistente") is not True:
        mal.append("orientacion de los triangulos inconsistente o sin medir (una zona dada vuelta)")
    if d.get("partes_negativas", 1):
        mal.append(f"{d.get('partes_negativas', 'sin medir')} cuerpo(s) con volumen negativo (una cascara dada vuelta)")
    if vc and abs(d["volumen_stl"] - vc) > tol_rel * vc:
        mal.append(f"volumen {d['volumen_stl']} contra {vc} del solido: mas de {100 * tol_rel:g} %")
    return "; ".join(mal) or None


def mover_a_la_segunda_pantalla(pid):
    """La ventana de ESA CATIA a la pantalla que no es la principal (pantalla.py de la skill cad-design: solo mueve la
    ventana, no teclea ni hace clic). En el paquete del obrero no esta: lo dice y sigue."""
    try:
        sys.path.append(os.path.join(REPO, ".claude", "skills", "cad-design", "scripts", "catia"))
        import pantalla
        return pantalla.mover(pid)
    except Exception as e:  # noqa: BLE001
        return f"no pude mover CATIA a la segunda pantalla: {e!r}"[:200]


def correr_ejercicio(ejercicio, construir, desplazamiento=(0.0, 0.0, 0.0), con_bien=True):
    """main() de un catia.py del juez. Uso: python catia.py <carpeta de trabajo>. Sale con 0 si corrio (aunque algo
    fallara: eso queda en salida.json), 3 si CATIA no arranca o no conecta, 4 si hay una CATIA que no es la propia.
    con_bien=False (24/10/2026, ejercicio 13 del banco de CATIA): el ejercicio no tiene bien.py en el banco 3D porque su
    respuesta es una formula de un papel; no se mide build123d ni se compara, el ok sale solo de los pasos y lo completa
    el post-proceso del ejercicio. El STEP que exporta CATIA se mide con build123d igual (tercer cruce)."""
    if len(sys.argv) < 2:
        print("uso: python catia.py <carpeta de trabajo>", file=sys.stderr)
        return 2
    carpeta = os.path.abspath(sys.argv[1])
    os.makedirs(carpeta, exist_ok=True)
    os.environ["CATIA_TRABAJO"] = carpeta          # antes de importar la base: ahi quedan mi_catia.json y los archivos
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import catia_base as cb

    t0 = time.time()
    bien = os.path.join(REPO, "evals", "banco3d", "ejercicios", ejercicio, "bien.py")
    salida = {"ok": False, "ejercicio": ejercicio, "bien_py": os.path.relpath(bien, REPO) if con_bien else None,
              "volumen_catia": {}, "cdg_catia_mm": {}, "volumen_build123d": {}, "cdg_build123d_mm": {},
              "desplazamiento_respecto_de_build123d_mm": list(desplazamiento), "archivos": [],
              "_carpeta": carpeta, "_steps": {}}
    # 1) build123d sobre el mismo bien.py (no necesita CATIA)
    b = medir_b123d(["bien", bien, os.path.join(carpeta, "_build123d")]) if con_bien else {}
    salida["seg_build123d"] = b.get("seg")
    if "error" in b:
        salida["error_build123d"] = b["error"]
    for k, d in (b.get("partes") or {}).items():
        salida["volumen_build123d"][k] = d.get("volumen")
        salida["cdg_build123d_mm"][k] = d.get("cdg_mm")
    # 2) CATIA
    try:
        import pythoncom
        pythoncom.CoInitialize()
    except Exception as e:  # noqa: BLE001
        salida["error"] = f"pywin32 no esta instalado: {e!r}"
        escribir(carpeta, salida)
        return 3
    # CATIA_MIRAR=1 o lento (Fak 24/10: «cuando vuelva... te quiero ver en tiempo real diseñándolo en CATIA»): CATIA
    # visible, en la segunda pantalla, una pausa por paso con «lento» (catia_base.Registro.mostrar) y, al terminar,
    # CATIA_PAUSA_FINAL segundos (30 por defecto) para mirar la pieza antes de apagarla. No queda abierta: la corrida
    # siguiente usa otra carpeta, no la reconoceria como propia y frenaria (codigo 4). Sin la variable, como siempre.
    mirar = os.environ.get("CATIA_MIRAR") in ("1", "lento")
    try:
        c, pid = cb.conectar(visible=mirar) if mirar else cb.conectar()
    except SystemExit as e:
        salida["error"] = str(e)
        escribir(carpeta, salida)
        return 4 if "no es la mia" in str(e) else 3
    except Exception as e:  # noqa: BLE001
        salida["error"] = f"CATIA no arranco: {e!r}"[:500]
        escribir(carpeta, salida)
        return 3
    salida["catia_pid"], salida["catia_hora"] = pid, cb.hora_de_arranque(pid) if pid else None
    salida["seg_hasta_conectar"] = round(time.time() - t0, 1)
    if mirar and pid:
        salida["pantalla"] = mover_a_la_segunda_pantalla(pid)
    escribir(carpeta, salida)                       # parcial: el juez ya sabe cual es la CATIA de esta corrida
    vig = cb.Vigia(pid) if pid else None
    if vig:
        vig.start()
    reg = cb.Registro(ejercicio)
    reg.catia = c
    fallas = ["no llego a correr"]
    try:
        construir(cb, c, reg, salida)
    except Exception:  # noqa: BLE001
        salida["error"] = "excepcion fuera de un paso: " + traceback.format_exc()[-800:]
    finally:
        try:                                        # el vigia sigue mientras CATIA se cierra (un OK abierto frena Quit)
            if mirar:
                try:
                    pausa = float(os.environ.get("CATIA_PAUSA_FINAL", "30").replace(",", "."))
                except ValueError:
                    pausa = 30.0
                salida["pausa_final_seg"] = pausa
                time.sleep(pausa)
            cb.apagar(c)
            salida["catia_apagada"] = True
        except Exception as e:  # noqa: BLE001
            salida["catia_apagada"] = f"no se pudo apagar: {e!r}"[:200]
        if vig:
            vig.parar()
            reg.datos["cuadros"] = vig.vistos
        try:
            fallas = reg.guardar()
        except Exception as e:  # noqa: BLE001
            salida["error_registro"] = repr(e)[:200]
    salida["seg_catia"] = round(time.time() - t0 - (salida.get("seg_build123d") or 0), 1)
    salida["archivos"].append(os.path.join(ejercicio, "registro.json"))
    salida["pasos_con_falla"] = fallas
    salida["cuadros_de_catia"] = getattr(vig, "vistos", [])
    # 3) el STEP que exporto CATIA, medido con build123d (tercer cruce: lo que CATIA escribe es lo que midio)
    if salida["_steps"]:
        s = medir_b123d(["step"] + list(salida["_steps"].values()))
        nombre_a_parte = {os.path.splitext(os.path.basename(v))[0]: k for k, v in salida["_steps"].items()}
        salida["volumen_step_catia_en_build123d"] = {nombre_a_parte.get(k, k): d.get("volumen", d.get("error"))
                                                     for k, d in (s.get("partes") or {}).items()} or s.get("error")
        # 24/10 (revisor del 37): el centro de gravedad y la topologia del STEP ya se median y se tiraban; el volumen no
        # ve una ranura corrida en altura (no se cruza con nada) y el centro si. Solo se agrega: nadie decide por esto aca.
        salida["step_catia_en_build123d"] = {nombre_a_parte.get(k, k): d for k, d in (s.get("partes") or {}).items()} \
            or s.get("error")
    if con_bien:
        iguales = comparar(salida, desplazamiento)
    else:                                           # sin bien.py no hay cruce: las claves quedan vacias (FIN las imprime)
        salida["diferencia_mm3"], salida["dif_cdg_mm"] = {}, {}
        iguales = True
    salida["ok"] = not fallas and iguales and not salida.get("error")     # CATA, 24/10: una excepcion fuera de un paso no queda verde
    if not con_bien:
        # sin bien.py no se comparo nada: salida.json no queda en verde hasta que el post-proceso del ejercicio compare
        # contra su respuesta (revisor del 13, 24/10: si el post-proceso revienta, quedaba «ok: true» sin comparar)
        salida["ok_pasos"], salida["ok"] = salida["ok"], False
        salida["pendiente"] = "sin bien.py: el ok lo decide el post-proceso del ejercicio contra su respuesta"
        if fallas and not salida.get("error"):
            salida["error"] = f"pasos con falla: {fallas}"
    elif not salida["ok"] and not salida.get("error"):
        # revisor del 23/10: si build123d no pudo medir (CATA sin .venv-cad), el motivo va primero en el error principal,
        # que es lo que el obrero publica en resultado-<item>.txt; si no, parecia una falla de comparacion
        salida["error"] = ((f"{salida['error_build123d']}; " if salida.get("error_build123d") else "")
                           + f"pasos con falla: {fallas}; diferencia_mm3 {salida['diferencia_mm3']}; "
                           f"dif_cdg_mm {salida['dif_cdg_mm']}")
    salida["segundos"] = round(time.time() - t0, 1)
    escribir(carpeta, salida)
    print("FIN", json.dumps({"ok": salida["ok"], "volumen_catia": salida["volumen_catia"],
                             "volumen_build123d": salida["volumen_build123d"],
                             "diferencia_mm3": salida["diferencia_mm3"]}))
    return 0
