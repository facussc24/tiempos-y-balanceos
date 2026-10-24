# -*- coding: utf-8 -*-
"""Ejercicio 54 del banco de CATIA (COLA_CATIA.md, «mas piezas con respuesta exacta», pedido 15 de la principal,
24/10/2026, CATA): espesor de 3 sobre una superficie CURVA, como un tapizado sobre su sustrato. Arco de R600 y 310 de
largo extruido 95, AddNewThickSurface hacia adentro (R 597-600) y hacia afuera (R 600-603), cada uno en su pieza. La pieza
la arma pieza_ej83.py (el ej83 de la practica con dos cambios anotados).

Respuesta conocida: la cuenta del sector de anillo, t = 310 / 600:
  volumen   V = t / 2 (R2^2 - R1^2) h  ->  adentro 88 129,125 mm3, afuera 88 570,875 mm3
  centro    sobre +Y a  2/3 (R2^3 - R1^3) / (R2^2 - R1^2) sen(t/2) / (t/2), en x 0 y z 47,5
La fila de la COLA dice 88 127,7 y 88 569,4 con esa misma formula; la formula da 88 129,1 y 88 570,9 (y el ej83 de la
practica midio 88 129,12): se juzga contra la formula, que el pedido 15 dice que es la respuesta.

El juez (cerrar_con_cuenta), por lado: el largo del arco medido (310 a 1e-3), el volumen de CATIA contra la cuenta a
TOL_VOL, el centro de CATIA contra el de la cuenta a TOL_CDG por eje, y el STEP de CATIA (build123d): el volumen y el centro
de la cuenta y la topologia entera del sector de anillo (topologia_step.py: 1 solido, 1 cascara, 6 caras, 12 aristas, 8
vertices, nada suelto). Los dos lados tienen que quedar en su lado (el centro adentro o afuera del arco). con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, los dos STEP y las capturas.
"""
import importlib.util
import json
import math
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "54_espesor_curvo"
R, LARGO, ANCHO, ESP = 600.0, 310.0, 95.0, 3.0
TH = LARGO / R
RADIOS = {"adentro": (R - ESP, R), "afuera": (R, R + ESP)}
FILA_COLA = {"adentro": 88127.7, "afuera": 88569.4}              # lo que dice la fila 54 (no cierra con su formula)
TOL_LARGO = 1e-3


def cuenta(lado):
    """Volumen (mm3) y centro (mm) del sector de anillo de ese lado."""
    r1, r2 = RADIOS[lado]
    v = TH / 2 * (r2 ** 2 - r1 ** 2) * ANCHO
    y = 2 / 3 * (r2 ** 3 - r1 ** 3) / (r2 ** 2 - r1 ** 2) * math.sin(TH / 2) / (TH / 2)
    return v, [0.0, y, ANCHO / 2]


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_ej83", os.path.join(AQUI, "pieza_ej83.py"))
    salida["espesor"] = {}
    # cada pieza se cierra (ocultar, STEP, captura) MIENTRAS es el documento activo: en 54_r1 y r2 se armaron las dos y
    # despues se cerraron; ocultar en la de adentro (ya no activa) no hizo nada (GetShow 0 en el CATPart guardado; la
    # captura la muestra con la superficie a la vista) y su STEP salio con la superficie R600 suelta
    for lado in ("adentro", "afuera"):
        x = pieza.una(c, reg, lado)
        salida["espesor"][lado] = {"superficie": x.get("superficie"), "espesor": x.get("espesor")}
        parte = f"espesor_{lado}"
        jc.cerrar_parte(cb, c, reg, salida, x["doc"], x["part"], x["body"], parte, parte, ocultos=x["construccion"])
        try:
            x["doc"].Close()
        except Exception as e:  # noqa: BLE001
            salida.setdefault("documentos_sin_cerrar", []).append(repr(e)[:200])


TOPOLOGIA = {"solidos": 1, "cascaras": 1, "faces": 6, "edges": 12, "vertices": 8, "faces_sueltas": 0, "edges_sueltas": 0,
             "vertices_sueltas": 0}                         # el sector de anillo extruido: 6 caras, 12 aristas, 8 vertices


def topologia(paso, correr=subprocess.run):
    """topologia_step.py con .venv-cad: solidos, cascaras, caras, aristas y vertices del STEP, y los sueltos."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "topologia_step.py"), paso], capture_output=True, text=True,
                   timeout=300)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"topologia_step.py no corrio: {ex!r}"[:300]}


def _num(x):
    return isinstance(x, (int, float)) and math.isfinite(x)


def _cerca(a, b, tol):
    return _num(a) and _num(b) and abs(a - b) <= tol


def _centro_cerca(c, e, tol):
    """Eje por eje (un max() deja pasar un NaN al final)."""
    return isinstance(c, (list, tuple)) and len(c) == 3 and all(_cerca(a, b, tol) for a, b in zip(c, e))


def cerrar_con_cuenta(carpeta, topo=None):
    """Despues de correr_ejercicio (con_bien=False): largo, volumen, centro y STEP de cada lado contra la cuenta."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {}
    esp = s.get("espesor") or {}
    st_todo = s.get("step_catia_en_build123d") or {}
    for lado in RADIOS:
        parte = f"espesor_{lado}"
        vcu, ccu = cuenta(lado)
        sup = (esp.get(lado) or {}).get("superficie") or {}
        vc = (s.get("volumen_catia") or {}).get(parte)
        cc = (s.get("cdg_catia_mm") or {}).get(parte)
        st = st_todo.get(parte) if isinstance(st_todo, dict) else None
        st = st if isinstance(st, dict) else {}
        juez[lado] = {"cuenta_mm3": round(vcu, 3), "cuenta_cdg_mm": [round(x, 4) for x in ccu], "catia_mm3": vc,
                      "catia_cdg_mm": cc, "step_mm3": st.get("volumen"), "step_cdg_mm": st.get("cdg_mm"),
                      "largo_arco": sup.get("largo_arco"), "fila_cola_mm3": FILA_COLA[lado]}
        if not _cerca(sup.get("largo_arco"), LARGO, TOL_LARGO):
            problemas.append(f"{lado}: el arco mide {sup.get('largo_arco')}, no {LARGO}")
        if not _cerca(vc, vcu, jc.TOL_VOL):
            problemas.append(f"{lado}: volumen de CATIA {vc} contra la cuenta {vcu:.3f} mm3")
        if not _centro_cerca(cc, ccu, jc.TOL_CDG):
            problemas.append(f"{lado}: centro de CATIA {cc} contra la cuenta {[round(x, 4) for x in ccu]}")
        if st.get("solidos") != 1 or st.get("caras_sueltas") != 0:
            problemas.append(f"{lado}: el STEP de CATIA tiene {st.get('solidos')} solidos y {st.get('caras_sueltas')} "
                             "caras sueltas (tiene que ser 1 y 0)")
        if not _cerca(st.get("volumen"), vcu, jc.TOL_VOL):
            problemas.append(f"{lado}: el STEP de CATIA da {st.get('volumen')} contra la cuenta {vcu:.3f} mm3")
        if not _centro_cerca(st.get("cdg_mm"), ccu, jc.TOL_CDG):
            problemas.append(f"{lado}: el centro del STEP {st.get('cdg_mm')} contra la cuenta")
        # revisor del 54: la cara suelta de 54_r1 venia con la curva del arco (17 aristas, 5 sueltas) y las cascaras no se
        # miraban; la topologia entera del STEP contra la del sector de anillo
        tp = (topo or topologia)(os.path.join(carpeta, EJ, parte + ".stp"))
        juez[lado]["topologia_step"] = tp
        distinto = {k: tp.get(k) for k, v in TOPOLOGIA.items() if tp.get(k) != v}
        if distinto:
            problemas.append(f"{lado}: la topologia del STEP no es la del sector de anillo ({distinto}; {tp.get('error')})"
                             [:300])
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CUENTA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_cuenta(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar la cuenta en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
