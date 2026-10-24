# -*- coding: utf-8 -*-
"""Ejercicio 56 del banco de CATIA (COLA_CATIA.md, «mas piezas con respuesta exacta», pedido 15 de la principal,
24/10/2026, CATA): chaflan 5 x 5 en las 12 aristas de una caja 250 x 80 x 60 de una vez, y como cierra CATIA la esquina
donde se juntan tres chaflanes. La pieza la arma pieza_ej84.py (el ej84 de la practica con tres cambios anotados).

La fila pide «build123d haciendo lo mismo (chamfer de todas las aristas): volumen y centro a 0,5 mm3 y 0,01 mm». El ej84
de la practica ya midio que no da: CATIA 1 181 250 contra 1 181 166,67 de chamfer() (83,3 mm3). Las dos cierran la esquina
distinto, y eso es lo que el ejercicio pregunta:
  - con los tres planos de chaflan que se cortan en un punto, en cada cubo de esquina K x K x K queda K^3 / 4 de material:
    V = A B C - 4 (A + B + C) K^2 / 2 + 8 (3 K^3 / 2 - K^3 + K^3 / 4) = 1 181 250 mm3 (cuenta; la esquina K^3 / 4 la
    integra la prueba rebanada por rebanada, y build123d cortando por planos da 1 181 250,0);
  - chamfer() de build123d (OpenCASCADE) le pone un triangulo a cada esquina: queda K^3 / 6 y V = 1 181 166,667 (26 caras
    contra 18).

El juez (cerrar_con_referencia): el volumen y el centro de CATIA contra la cuenta; el STEP de CATIA contra el de
gemelo_chaflan.py «planos» con compara.py del 32 (revisar_comparacion y las dos distancias exactas, PEDIDO PARA CATA 14), un
solido sin caras sueltas y el centro; las caras del STEP de CATIA contra las del gemelo; y la diferencia con chamfer()
UBICADA: (CATIA - chamfer) son 8 piezas de K^3 / 12, una en cada esquina, y (chamfer - CATIA) no tiene nada. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de CATIA, el del gemelo y la comparacion.
"""
import importlib.util
import json
import math
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "56_chaflan_12"
PARTE = "chaflan_12"
A, B, C, K = 250.0, 80.0, 60.0, 5.0
CDG = [0.0, 0.0, C / 2]
ESQUINAS = [(sx * A / 2, sy * B / 2, z) for sx in (-1, 1) for sy in (-1, 1) for z in (0.0, C)]
TOL_PIEZA_MM3 = 0.01
CARAS_PLANOS = 6 + 12                                           # las 6 de la caja recortadas y una por chaflan


def cuenta(material_esquina):
    """Volumen de la caja con chaflan K en las 12 aristas si en cada cubo de esquina K^3 queda `material_esquina`."""
    return A * B * C - 4 * (A + B + C) * K ** 2 / 2 + 8 * (3 * K ** 3 / 2 - K ** 3 + material_esquina)


V_PLANOS, V_CHAMFER = cuenta(K ** 3 / 4), cuenta(K ** 3 / 6)     # 1 181 250 y 1 181 166,667


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_ej84", os.path.join(AQUI, "pieza_ej84.py"))
    ctx = pieza.cuerpo(c, reg)
    salida["chaflan"] = ctx.get("chaflan")
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE)
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def gemelo(carpeta, paso, correr=subprocess.run):
    """gemelo_chaflan.py con .venv-cad: el STEP «planos» y la diferencia de CATIA con chamfer() ubicada."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_chaflan.py"), carpeta, paso], capture_output=True,
                   text=True, timeout=900)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"gemelo_chaflan.py no corrio: {ex!r}"[:300]}


def _num(x):
    return isinstance(x, (int, float)) and math.isfinite(x)


def _centro_cerca(c, e, tol):
    """Eje por eje (un max() deja pasar un NaN al final)."""
    return (isinstance(c, (list, tuple)) and len(c) == 3 and isinstance(e, (list, tuple)) and len(e) == 3
            and all(_num(a) and _num(b) and abs(a - b) <= tol for a, b in zip(c, e)))


def revisar_esquinas(sobra, falta):
    """(CATIA - chamfer): 8 piezas de K^3 / 12, cada una a menos de K de una esquina distinta; (chamfer - CATIA): nada."""
    malos = []
    if not isinstance(sobra, list) or not isinstance(falta, list):
        return [f"la diferencia con chamfer() no se ubico ({sobra!r} / {falta!r})"[:300]]
    if len(sobra) != 8:
        malos.append(f"CATIA - chamfer da {len(sobra)} piezas, no 8 (una por esquina)")
    tocadas = set()
    for p in sobra:
        v, c = p.get("volumen"), p.get("cdg_mm")
        if not (_num(v) and abs(v - K ** 3 / 12) <= TOL_PIEZA_MM3):
            malos.append(f"una pieza de CATIA - chamfer tiene {v} mm3, no K^3/12 = {K ** 3 / 12:.4f}")
        cerca = [i for i, e in enumerate(ESQUINAS) if _centro_cerca(c, e, K)]
        if len(cerca) != 1:
            malos.append(f"una pieza de CATIA - chamfer en {c} no esta junto a una esquina")
        tocadas.update(cerca)
    if len(tocadas) != 8 and len(sobra) == 8:
        malos.append(f"las 8 piezas de CATIA - chamfer no son una por esquina ({sorted(tocadas)})")
    # revisor del 56: con «or 0» una pieza sin volumen contaba como nada; es el unico control de «CATIA saca de mas»
    vols = [p.get("volumen") if isinstance(p, dict) else None for p in falta]
    if not all(_num(v) for v in vols):
        malos.append(f"chamfer - CATIA trae piezas sin volumen medido ({vols})"[:300])
    elif not sum(vols) <= jc.TOL_VOL:
        malos.append(f"chamfer - CATIA deja {sum(vols)} mm3: CATIA saca algo que chamfer() no")
    return malos


def cerrar_con_referencia(carpeta, gemelo_con=None, comparar_con=None):
    """Despues de correr_ejercicio (con_bien=False): cuenta, gemelo por planos y la diferencia con chamfer() ubicada."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas = []
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    cc = (s.get("cdg_catia_mm") or {}).get(PARTE)
    st = s.get("step_catia_en_build123d")      # sin .venv-cad juez_comun deja un texto (revisor del 59): rojo, no excepcion
    st = st.get(PARTE) if isinstance(st, dict) else {}
    st = st if isinstance(st, dict) else {}
    juez = {"cuenta_planos_mm3": round(V_PLANOS, 3), "cuenta_chamfer_mm3": round(V_CHAMFER, 3), "catia_mm3": vc,
            "catia_cdg_mm": cc}
    if not (_num(vc) and abs(vc - V_PLANOS) <= jc.TOL_VOL):
        problemas.append(f"volumen de CATIA {vc} contra la cuenta {V_PLANOS:.3f} mm3 (esquinas con los planos que se cortan)")
    if not _centro_cerca(cc, CDG, jc.TOL_CDG):
        problemas.append(f"centro de CATIA {cc} contra {CDG}")
    if (st.get("solidos"), st.get("cascaras"), st.get("caras_sueltas")) != (1, 1, 0):      # auditor: tambien las cascaras
        problemas.append(f"el STEP de CATIA tiene {st.get('solidos')} solidos, {st.get('cascaras')} cascaras y {st.get('caras_sueltas')} caras sueltas")
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    g = (gemelo_con or gemelo)(os.path.join(carpeta, "gemelo"), paso)
    s["gemelo"] = g
    if "error" in g:
        problemas.append(g["error"])
    else:
        pl, chm = g.get("planos") or {}, g.get("chamfer") or {}
        caras_catia = (g.get("catia") or {}).get("caras")
        juez.update({"gemelo_planos_mm3": pl.get("volumen"), "gemelo_chamfer_mm3": chm.get("volumen"),
                     "caras_catia": caras_catia, "caras_del_chaflan_catia": (s.get("chaflan") or {}).get("caras_del_chaflan"),
                     "caras_planos": pl.get("caras"), "caras_chamfer": chm.get("caras")})
        if g.get("n_planos") != 12 or pl.get("solidos") != 1:
            problemas.append(f"el gemelo por planos no se armo bien ({g.get('n_planos')} planos, {pl.get('solidos')} solidos)")
        if not (_num(pl.get("volumen")) and abs(pl["volumen"] - V_PLANOS) <= jc.TOL_VOL):
            problemas.append(f"el gemelo por planos da {pl.get('volumen')} y la cuenta {V_PLANOS:.3f}")
        if not (_num(chm.get("volumen")) and abs(chm["volumen"] - V_CHAMFER) <= jc.TOL_VOL):
            problemas.append(f"chamfer() da {chm.get('volumen')} y la cuenta con K^3/6 {V_CHAMFER:.3f}")
        if not _centro_cerca(st.get("cdg_mm"), pl.get("cdg_mm"), jc.TOL_CDG):
            problemas.append(f"el centro del STEP de CATIA {st.get('cdg_mm')} no es el del gemelo {pl.get('cdg_mm')}")
        if not (caras_catia == pl.get("caras") == CARAS_PLANOS):
            problemas.append(f"el STEP de CATIA tiene {caras_catia} caras y el gemelo por planos {pl.get('caras')} "
                             f"(con las esquinas en un punto son {CARAS_PLANOS})")
        problemas += revisar_esquinas(g.get("catia_menos_chamfer"), g.get("chamfer_menos_catia"))
        e48 = cargar("ej48_catia_56", os.path.join(EJERCICIOS, "48_gancho_mochila", "catia.py"))
        e32 = cargar("ej32_catia_56", os.path.join(EJERCICIOS, "32_virolador_v16", "catia.py"))
        try:
            d = (comparar_con or e48.comparar)(paso, pl.get("step"))
        except Exception as e:  # noqa: BLE001
            d = None
            problemas.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_el_gemelo"] = d
            problemas += e32.revisar_comparacion(d)
            ex = [d.get(k) for k in ("dist_max_exacta_A_a_B", "dist_max_exacta_B_a_A")]
            if not all(_num(x) and x <= e32.TOL_DIST_MM for x in ex):
                problemas.append(f"distancia exacta {ex[0]} / {ex[1]} mm (tiene que ser <= {e32.TOL_DIST_MM})")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_REFERENCIA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez,
                                        "contra_el_gemelo": s.get("contra_el_gemelo")}))
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
