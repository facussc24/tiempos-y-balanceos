# -*- coding: utf-8 -*-
"""Ejercicio 34 del banco de CATIA (fase 3, disenos reales de Barack, 24/10/2026): choque EXACTO adentro de CATIA del
virolador v16 entregado contra el panel del cliente del Upper Trim, y del gemelo (el mismo v16 subido 1 mm hacia el
panel), que tiene que chocar en la MISMA corrida.

Base: ej16_choque_catia_real.py de la practica del 19/10. Cada utillaje se pega como cuerpo en una copia del panel
(Selection.Copy + PasteSpecial «CATPrtResultWithOutLink»), se mide la distancia minima de CATIA (SPA GetMinimumDistance,
si la da) y despues AddNewIntersect contra el cuerpo del panel. Primero el v16 y despues el gemelo: el gemelo con choque
prueba que la sesion seguia sana (una CATIA danada da «Update failed» hasta en un pad y se leeria «no choca»).

Entradas fijas, elegidas por sha256 y no por nombre (hay dos «virolador_v10_two.step» distintos en la practica: el de
v16_ref es el v16, 89 278 mm3; el de v14_choque es otro, 116 527 mm3). Ninguna se sube al repo (pieza del cliente y
dispositivos de 4 a 11 MB); cada ruta se puede cambiar con su variable de entorno. CATIA abre una COPIA de cada una con
la cabecera en el orden de ISO 10303-21 (el v16 entregado la trae al reves y CATIA lo leia VACIO); desde el fin de la
cabecera la copia es identica al original, byte a byte.

Respuesta conocida: OpenCASCADE (choque_exacto.py de la skill cad-design) sobre los MISMOS tres archivos, corrido una
vez el 24/10/2026 y guardado en referencia_occ.json con los sha256, la fecha y el comando (como la referencia del 31).
El juez no vuelve a correr las booleanas de OpenCASCADE (tardan minutos sobre el panel de 11 MB).

GetMinimumDistance de CATIA falla entre dos cuerpos de la misma pieza (24/10, los dos casos): la luz la mide solo
OpenCASCADE, y el veredicto lo dice.

ok = los pasos sin falla y sin error del juez
     Y el v16 y el gemelo medidos en ese orden
     Y el panel, medido en CATIA en CADA apertura antes de pegar, con el volumen que le dio la otra CATIA en el ejercicio
       33 (91 770,060 mm3, mismo archivo por sha256): una apertura que lo lea vacio o a medias no llega al Intersect
     Y cada utillaje, en CATIA, con el volumen de OpenCASCADE (pj.tol_volumen) y pegado sin perder volumen
     Y la interseccion de cada uno como la de OpenCASCADE: vacia (<= 1e-4 mm3) si OpenCASCADE dice vacia, y si no a
       pj.tol_volumen (0,5 mm3 o 1e-5) de la suya
     Y la distancia minima de CATIA, si la da, a <= 0,005 mm de la de OpenCASCADE (un noveno de la luz de 0,0455 del
       19/10: una lectura dentro de eso no cambia «no choca» por «toca»).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, una captura por caso y el registro.
"""
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "34_choque_v16_panel"
PRACTICA = r"C:\Dev\_catia_practica"
ENTRADAS = {   # nombre: (variable de entorno, ruta por defecto, sha256)
    "panel": ("PANEL_UPPER_TRIM", os.path.join(PRACTICA, "v14_choque", "panel_marco_local.step"),
              "fb74d9772b21fb48a915819a54968a863d9d6a35cd7cd78655c55b02955e4a1e"),
    "v16": ("V16_ENTREGADO", os.path.join(PRACTICA, "v16_ref", "virolador_v10_two.step"),
            "5b6cff1a4911f5690dae27b90e434033333beb741dd3146852720e2da25865e3"),
    "gemelo_1mm": ("V16_GEMELO", os.path.join(PRACTICA, "v14_choque", "v16_subida_1mm.step"),
                   "d732ec7e7e3133e3e009e429dd7dc727cb2b4dd411ff1c4bb943eecd5842829b"),
}
CASOS = ("v16", "gemelo_1mm")            # en este orden: el gemelo despues
REFERENCIA = os.path.join(AQUI, "referencia_occ.json")
TOL_VACIA_MM3, TOL_DIST_MM = 1e-4, 0.005
# El panel (sha fb74...) medido en CATIA R21 por la otra PC (ejercicio 33, CATA, 24/10 12:10): 91 770,060 mm3 (OpenCASCADE
# fino 91 766,750: CATIA da +0,0036 %). Se compara CATIA con CATIA: una apertura que lo lea vacio o a medias no llega.
PANEL_CATIA_MM3 = 91770.060


def ruta(nombre):
    var, defecto, _ = ENTRADAS[nombre]
    return os.environ.get(var, defecto)


def sha256(r):
    h = hashlib.sha256()
    with open(r, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def entradas_malas():
    malas = []
    for n, (_, _, sha) in ENTRADAS.items():
        r = ruta(n)
        if not os.path.isfile(r):
            malas.append(f"{n}: no esta {r}")
        elif sha256(r) != sha:
            malas.append(f"{n}: {r} no tiene el sha256 esperado")
    return malas


def _step_cabecera():
    """cadlib/step_cabecera.py de la skill cad-design, cargado por su ruta (solo usa os y re)."""
    r = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "scripts", "cadlib", "step_cabecera.py")
    spec = importlib.util.spec_from_file_location("step_cabecera", r)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def copia_para_catia(nombre, carpeta, sc=None):
    """CATIA V5 R21 lee VACIO, sin avisar, un STEP con la cabecera al reves (OpenCASCADE 7.8; skill cad-design,
    step_cabecera.py). El v16 entregado la trae asi: la corrida del 24/10 12:19 lo abrio con el PartBody sin nada. Se abre
    una COPIA con la cabecera en orden, y desde el fin de la cabecera la copia tiene que ser IDENTICA byte a byte al
    original (la geometria que mide OpenCASCADE en la referencia es la misma que abre CATIA)."""
    sc = sc or _step_cabecera()
    with open(ruta(nombre), "rb") as f:
        a = f.read()
    medido = hashlib.sha256(a).hexdigest()          # sobre los MISMOS bytes que se copian (revisor del 34)
    if medido != ENTRADAS[nombre][2]:
        raise ValueError(f"{nombre}: {ruta(nombre)} no tiene el sha256 esperado")
    copia = os.path.join(carpeta, f"entrada_{nombre}.step")
    with open(copia, "wb") as f:
        f.write(a)
    cambio, orden = sc.arreglar_archivo(copia)
    with open(copia, "rb") as f:
        b = f.read()
    if a[a.index(b"ENDSEC;"):] != b[b.index(b"ENDSEC;"):]:
        raise ValueError(f"{nombre}: la copia para CATIA cambio algo fuera de la cabecera")
    return copia, {"sha256_medido": medido, "cabecera_arreglada": cambio, "orden_original": list(orden)}


def construir(cb, c, reg, salida):
    malas = entradas_malas()
    salida["entradas"] = {n: {"ruta": ruta(n), "sha256": ENTRADAS[n][2]} for n in ENTRADAS}
    if malas:
        raise ValueError("entradas: " + "; ".join(malas))
    abrir = {}
    for n in ENTRADAS:
        abrir[n], info = copia_para_catia(n, reg.carpeta)
        salida["entradas"][n].update(info)
    salida["casos"], salida["orden_casos"] = {}, []
    for nombre in CASOS:
        def hacer(nombre=nombre):
            c.Documents.Open(abrir[nombre])
            dv = c.ActiveDocument
            try:
                parte = dv.Part
            except Exception:  # noqa: BLE001
                # un STEP de build123d entra como ENSAMBLE (19/10): la pieza es la del primer componente
                dv = dv.Product.Products.Item(1).ReferenceProduct.Parent
                parte = dv.Part
            vb = parte.MainBody
            v_util = cb.medir(dv, parte, vb)["volume"]
            sel = dv.Selection
            sel.Clear()
            sel.Add(vb)
            sel.Copy()
            sel.Clear()
            c.Documents.Open(abrir["panel"])
            dp = c.ActiveDocument
            pp = dp.Part
            panel_body = pp.MainBody
            # revisor del 34: el panel se abre en cada caso y una apertura que lo lea vacio dejaria el Intersect sin
            # volumen, igual que «no choca». Se mide ANTES de pegar (medir() se niega con un cuerpo vacio).
            v_panel = cb.medir(dp, pp, panel_body)["volume"]
            sp = dp.Selection
            sp.Clear()
            sp.Add(pp)
            sp.PasteSpecial("CATPrtResultWithOutLink")     # pegar como solido, sin vinculo con el otro documento
            sp.Clear()
            pegado = pp.Bodies.Item(pp.Bodies.Count)
            pp.Update()
            r = {"utillaje": v_util, "panel": v_panel, "pegado": cb.medir(dp, pp, pegado)["volume"]}
            try:                                            # la distancia ANTES de intersectar (despues cambia el cuerpo)
                spa = dp.GetWorkbench("SPAWorkbench")
                r["dist_min_catia"] = round(spa.GetMeasurable(cb.ref(pp, pegado)).GetMinimumDistance(
                    cb.ref(pp, panel_body)), 5)
            except Exception as e:  # noqa: BLE001
                r["dist_error"] = repr(e)[:200]
            try:
                cap = jc.captura_bmp(c, reg.carpeta, nombre + "_en_el_panel")
                salida["archivos"].append(os.path.relpath(cap, salida["_carpeta"]))
            except Exception as e:  # noqa: BLE001
                r["captura_error"] = repr(e)[:120]
            pp.InWorkObject = pegado
            pp.ShapeFactory.AddNewIntersect(panel_body)
            try:
                pp.Update()
                actualizo = True
            except Exception as e:  # noqa: BLE001
                # CATIA no deja un cuerpo vacio: la interseccion sin volumen sale «Update failed». Lo decide el gemelo.
                actualizo, r["interseccion"] = False, 0.0
                r["estado"] = f"interseccion vacia (Update fallo) {repr(e)[:300]}"
            if actualizo:                                    # fuera del try: un volumen que no se lee NO es «vacia»
                mi = cb.medir(dp, pp, pegado)
                if "volume" not in mi:
                    raise RuntimeError(f"la interseccion actualizo y su volumen no se pudo leer: {mi}")
                r["interseccion"], r["estado"] = mi["volume"], "interseccion con volumen"
            for d in (dp, dv):
                try:
                    d.Close()
                except Exception:  # noqa: BLE001
                    pass
            salida["casos"][nombre] = r
            salida["orden_casos"].append(nombre)
            return r
        reg.paso(nombre, hacer)


def comparar_con_referencia(s, ref):
    """Lo que no cierra entre lo que midio CATIA (s["casos"]) y OpenCASCADE (referencia_occ.json). Lista vacia = bien."""
    malos = []
    for n in ENTRADAS:
        if (ref.get("sha256") or {}).get(n) != ENTRADAS[n][2]:
            malos.append(f"la referencia no es de estos archivos ({n})")
    if malos:
        return malos
    casos = s.get("casos") or {}
    if list(s.get("orden_casos") or []) != list(CASOS):
        malos.append(f"casos medidos {s.get('orden_casos')}: tienen que ser {list(CASOS)}, el gemelo despues")
    def cerca(a, b, tol):
        """a y b numeros a tol o menos; un NaN o un texto da False (revisor del 34: «> tol» dejaba pasar un NaN)."""
        try:
            return abs(float(a) - float(b)) <= tol
        except (TypeError, ValueError):
            return False

    for n in CASOS:
        r, o = casos.get(n), (ref.get("casos") or {}).get(n)
        if not r or not o:
            malos.append(f"{n}: sin medir")
            continue
        if not cerca(r.get("panel"), PANEL_CATIA_MM3, pj.tol_volumen(PANEL_CATIA_MM3)):
            malos.append(f"{n}: el panel en CATIA da {r.get('panel')} mm3 y no {PANEL_CATIA_MM3} (el del 33)")
        if not cerca(r.get("utillaje"), o["vol_utillaje"], pj.tol_volumen(o["vol_utillaje"])):
            malos.append(f"{n}: CATIA leyo {r.get('utillaje')} mm3 y OpenCASCADE {o['vol_utillaje']}")
        if not cerca(r.get("pegado"), r.get("utillaje"), pj.tol_volumen(o["vol_utillaje"])):
            malos.append(f"{n}: pegado {r.get('pegado')} mm3 contra {r.get('utillaje')} del utillaje")
        oi = o["interseccion"]
        if oi <= TOL_VACIA_MM3:
            if not cerca(r.get("interseccion"), 0.0, TOL_VACIA_MM3):
                malos.append(f"{n}: CATIA da choque de {r.get('interseccion')} mm3 y OpenCASCADE nada")
        elif not cerca(r.get("interseccion"), oi, pj.tol_volumen(oi)):
            malos.append(f"{n}: interseccion {r.get('interseccion')} mm3 contra {oi} de OpenCASCADE")
        if "dist_min_catia" in r and not cerca(r["dist_min_catia"], o["distancia_min"], TOL_DIST_MM):
            malos.append(f"{n}: distancia {r['dist_min_catia']} mm contra {o['distancia_min']} de OpenCASCADE")
    g = casos.get("gemelo_1mm") or {}
    try:
        gemelo_choca = float(g.get("interseccion", 0)) > TOL_VACIA_MM3
    except (TypeError, ValueError):
        gemelo_choca = False
    if not gemelo_choca:
        malos.append("el gemelo no dio choque en esta corrida: «no choca» del v16 queda sin medir")
    return malos


def cerrar_con_referencia(carpeta, referencia=None):
    """Idempotente: se puede volver a cerrar la misma corrida (el error del juez queda aparte, en error_juez)."""
    ruta_s = os.path.join(carpeta, "salida.json")
    with open(ruta_s, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    try:
        with open(referencia or REFERENCIA, encoding="utf-8") as f:
            ref = json.load(f)
        malos = comparar_con_referencia(s, ref)
    except Exception as e:  # noqa: BLE001
        malos = [f"no se pudo leer la referencia: {e!r}"[:300]]
    # el veredicto es el de OpenCASCADE (distancia exacta y booleana), confirmado por CATIA en esta corrida
    s["veredicto_v16"] = "sin decidir" if malos else ref["casos"]["v16"]["veredicto"] + " (CATIA coincide en la interseccion; la luz la mide OpenCASCADE)"
    s["ok_referencia"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta_s, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CHOQUE", json.dumps({"ok": s["ok"], "veredicto_v16": s["veredicto_v16"], "casos": s.get("casos"),
                                    "malos": malos}, ensure_ascii=False))
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
