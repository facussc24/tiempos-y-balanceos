# -*- coding: utf-8 -*-
"""Ejercicio 04 del obrero: la pieza y el nido del ejercicio 04 del banco 3D (nido con holgura) rehechos en CATIA Part
Design por COM, en una CATIA PROPIA (conectar de catia_base; apagar al final). Escrito el 23/10/2026 sin correrlo;
VERIFICADO esa noche en la R21 de la PC principal (juez.py, 21:22): pieza 48 000 y nido 163 397,6 mm3 = build123d.

Medidas: C:/Dev/wt-banco3d-B/evals/banco3d/ejercicios/04_nido_holgura/_conjunto.py y bien.py (pieza de ENSAYO del
banco, sin fuente de Barack): pieza 60 x 40 x 20; nido 100 x 80 x 25 con bolsillo de 15 de profundidad y 0,2 mm de luz
por lado (bolsillo 60,4 x 40,4). En build123d el nido va de z -10 a 15 y la pieza de z 0 a 20; aca TODO sube 10 mm
(nido de z 0 a 25, pieza de z 10 a 30) para usar solo lo probado la noche del 19/10 (pad desde el plano XY, plano
desplazado + vaciado como en ej02). El volumen no cambia; la principal lo compara con el de build123d.

Uso: python catia.py <carpeta de trabajo>. Escribe salida.json con volumen_catia, el STEP de cada pieza y una captura
BMP de cada una. Sale con 3 si CATIA no arranca o no conecta, 4 si hay una CATIA abierta que no es la propia.
"""
import json
import os
import sys
import time
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
OBRERO_DIR = os.path.dirname(os.path.dirname(AQUI))     # .../obrero/ejercicios/04_nido_holgura -> .../obrero

LP, AP, HP = 60.0, 40.0, 20.0           # pieza
LN, AN, PROF, FONDO = 100.0, 80.0, 15.0, 10.0
LUZ = 0.2                               # por lado (bien.py)
DZ = FONDO                              # todo sube 10 mm respecto de build123d
BX, BY = LP + 2 * LUZ, AP + 2 * LUZ     # bolsillo 60,4 x 40,4

V_BLOQUE = LN * AN * (FONDO + PROF)                     # 200 000
V_BOLSILLO = BX * BY * PROF                             # 36 602,4
ESPERADO = {"pieza": LP * AP * HP, "nido": V_BLOQUE - V_BOLSILLO}
CDG_Z = {"pieza": DZ + HP / 2,
         "nido": (V_BLOQUE * (FONDO + PROF) / 2 - V_BOLSILLO * (FONDO + PROF / 2)) / (V_BLOQUE - V_BOLSILLO)}
TOL_VOL, TOL_CDG = 0.5, 0.01


def escribir(carpeta, salida):
    with open(os.path.join(carpeta, "salida.json"), "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1, default=str)


def rect(cb, f, x0, y0, x1, y1):
    cb.poligono(f, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def croquis(cb, part, body, plano, x0, y0, x1, y1):
    sk = body.Sketches.Add(cb.ref(part, plano))
    f = sk.OpenEdition()
    rect(cb, f, x0, y0, x1, y1)
    sk.CloseEdition()
    part.Update()
    return sk


def plano_a(part, body, z):
    p = part.HybridShapeFactory.AddNewPlaneOffset(part.CreateReferenceFromObject(part.OriginElements.PlaneXY), float(z), False)
    body.InsertHybridShape(p)
    part.Update()
    return p


def ocultar(doc, obj):
    sel = doc.Selection
    sel.Clear()
    sel.Add(obj)
    sel.VisProperties.SetShow(1)        # 1 = oculto (CATIA exporta lo visible, NOTAS 19/10)
    sel.Clear()


def pad_hacia_arriba(cb, doc, part, body, pad, cdg_z_esperado):
    """El sentido se mide, no se supone (NOTAS 19/10): si el centro de gravedad quedo abajo, se invierte el pad."""
    m = cb.medir(doc, part, body)
    if "cdg_mm" not in m:                     # sin centro de gravedad no se sabe el sentido: no se toca nada
        m["sentido"] = "sin controlar (no se pudo medir el centro de gravedad)"
        return m
    if abs(m["cdg_mm"][2] - cdg_z_esperado) > TOL_CDG:
        pad.DirectionOrientation = 1 - pad.DirectionOrientation
        part.Update()
        m = cb.medir(doc, part, body)
        m["invertido"] = True
    return m


def captura_bmp(c, carpeta, nombre):
    """Como catia_base.captura pero deja el BMP (la notebook no tiene Pillow para pasarlo a PNG)."""
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
    return ruta


def hacer_nido(cb, c, reg, out):
    doc, part, body, sf = cb.nueva_pieza(c, "nido_holgura_nido")
    xy = part.OriginElements.PlaneXY
    est = {}

    def bloque():
        sk = croquis(cb, part, body, xy, -LN / 2, -AN / 2, LN / 2, AN / 2)
        pad = sf.AddNewPad(sk, FONDO + PROF)
        part.Update()
        return pad_hacia_arriba(cb, doc, part, body, pad, (FONDO + PROF) / 2)

    est["bloque"] = reg.paso(f"nido: bloque {LN:g} x {AN:g} x {FONDO + PROF:g} (esperado {V_BLOQUE:g} mm3)", bloque)

    def bolsillo():
        p = plano_a(part, body, FONDO + PROF)
        est["plano"] = p
        sk = croquis(cb, part, body, p, -BX / 2, -BY / 2, BX / 2, BY / 2)
        antes = cb.medir(doc, part, body)["volume"]
        pk = sf.AddNewPocket(sk, PROF)
        part.Update()
        despues = cb.medir(doc, part, body)["volume"]
        if abs((antes - despues) - V_BOLSILLO) > 1 and despues >= antes - 1:   # corto para afuera: se invierte (ej02)
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
            despues = cb.medir(doc, part, body)["volume"]
        return {"saca": round(antes - despues, 3), "esperado": round(V_BOLSILLO, 3)}

    reg.paso(f"nido: bolsillo {BX:g} x {BY:g} x {PROF:g} (saca {V_BOLSILLO:g} mm3)", bolsillo)
    m = reg.paso("nido: medir", lambda: cb.medir(doc, part, body))
    if m:
        out["volumen_catia"]["nido"] = m.get("volume")
        out["cdg_catia_mm"]["nido"] = m.get("cdg_mm")
    if "plano" in est:
        reg.paso("nido: ocultar el plano antes de exportar", lambda: ocultar(doc, est["plano"]))
    rutas = reg.paso("nido: guardar CATPart + STEP", lambda: cb.guardar_pieza(doc, reg, "nido_holgura_nido"))
    if rutas:
        out["archivos"].append(os.path.relpath(rutas["step"], out["_carpeta"]))
    bmp = reg.paso("nido: captura BMP", lambda: captura_bmp(c, reg.carpeta, "nido_holgura_nido"))
    if bmp:
        out["archivos"].append(os.path.relpath(bmp, out["_carpeta"]))


def hacer_pieza(cb, c, reg, out):
    doc, part, body, sf = cb.nueva_pieza(c, "nido_holgura_pieza")
    est = {}

    def pieza():
        p = plano_a(part, body, DZ)
        est["plano"] = p
        sk = croquis(cb, part, body, p, -LP / 2, -AP / 2, LP / 2, AP / 2)
        pad = sf.AddNewPad(sk, HP)
        part.Update()
        return pad_hacia_arriba(cb, doc, part, body, pad, CDG_Z["pieza"])

    m = reg.paso(f"pieza: {LP:g} x {AP:g} x {HP:g} apoyada en el fondo del nido (z {DZ:g})", pieza)
    if m:
        out["volumen_catia"]["pieza"] = m.get("volume")
        out["cdg_catia_mm"]["pieza"] = m.get("cdg_mm")
    if "plano" in est:
        reg.paso("pieza: ocultar el plano antes de exportar", lambda: ocultar(doc, est["plano"]))
    rutas = reg.paso("pieza: guardar CATPart + STEP", lambda: cb.guardar_pieza(doc, reg, "nido_holgura_pieza"))
    if rutas:
        out["archivos"].append(os.path.relpath(rutas["step"], out["_carpeta"]))
    bmp = reg.paso("pieza: captura BMP", lambda: captura_bmp(c, reg.carpeta, "nido_holgura_pieza"))
    if bmp:
        out["archivos"].append(os.path.relpath(bmp, out["_carpeta"]))


def main():
    if len(sys.argv) < 2:
        print("uso: python catia.py <carpeta de trabajo>", file=sys.stderr)
        return 2
    carpeta = os.path.abspath(sys.argv[1])
    os.makedirs(carpeta, exist_ok=True)
    os.environ["CATIA_TRABAJO"] = carpeta          # antes de importar la base: ahi quedan mi_catia.json y los archivos
    if OBRERO_DIR not in sys.path:
        sys.path.insert(0, OBRERO_DIR)
    import catia_base as cb

    t0 = time.time()
    salida = {"ok": False, "ejercicio": "04_nido_holgura", "verificado_en_catia": False,
              "esperado_cuenta_mm3": {k: round(v, 3) for k, v in ESPERADO.items()},
              "cdg_z_esperado_mm": {k: round(v, 4) for k, v in CDG_Z.items()},
              "desplazamiento_z_respecto_de_build123d_mm": DZ,
              "volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": carpeta}
    try:
        import pythoncom
        pythoncom.CoInitialize()
    except Exception as e:  # noqa: BLE001
        salida["error"] = f"pywin32 no esta instalado: {e!r}"
        salida.pop("_carpeta")
        escribir(carpeta, salida)
        return 3
    try:
        c, pid = cb.conectar()
    except SystemExit as e:
        texto = str(e)
        salida.pop("_carpeta")
        salida["error"] = texto
        escribir(carpeta, salida)
        return 4 if "no es la mia" in texto else 3
    except Exception as e:  # noqa: BLE001
        salida.pop("_carpeta")
        salida["error"] = f"CATIA no arranco: {e!r}"[:500]
        escribir(carpeta, salida)
        return 3
    salida["catia_pid"] = pid
    vig = cb.Vigia(pid) if pid else None
    if vig:
        vig.start()
    reg = cb.Registro("04_nido_holgura")
    reg.catia = c
    fallas = ["no llego a correr"]
    try:
        hacer_nido(cb, c, reg, salida)
        hacer_pieza(cb, c, reg, salida)
    except Exception:  # noqa: BLE001
        salida["error"] = "excepcion fuera de un paso: " + traceback.format_exc()[-800:]
    finally:
        try:                                    # el vigia sigue andando mientras CATIA se cierra: un cuadro de un solo
            cb.apagar(c)                        # OK abierto frena el Quit (memoria 13/10) y el vigia lo acepta
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
    salida.pop("_carpeta")
    salida["archivos"].append(os.path.join("04_nido_holgura", "registro.json"))
    salida["pasos_con_falla"] = fallas
    salida["cuadros_de_catia"] = getattr(vig, "vistos", [])
    comp = {}
    for k, esperado in ESPERADO.items():
        v = salida["volumen_catia"].get(k)
        z = (salida["cdg_catia_mm"].get(k) or [None, None, None])[2]
        comp[k] = {"volumen_ok": v is not None and abs(v - esperado) <= TOL_VOL,
                   "cdg_z_ok": z is not None and abs(z - CDG_Z[k]) <= TOL_CDG}
    salida["comparacion_con_la_cuenta"] = comp
    salida["ok"] = not fallas and all(x["volumen_ok"] and x["cdg_z_ok"] for x in comp.values())
    if not salida["ok"] and not salida.get("error"):
        salida["error"] = f"pasos con falla: {fallas}; comparacion con la cuenta: {comp}"
    salida["segundos"] = round(time.time() - t0, 1)
    escribir(carpeta, salida)
    print("FIN", json.dumps({"ok": salida["ok"], "volumen_catia": salida["volumen_catia"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
