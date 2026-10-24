# -*- coding: utf-8 -*-
r"""Ejercicio 51 del banco de CATIA (COLA_CATIA.md, pedido 13 de la principal, 24/10/2026, CATA): el porta-bulon M6 de la
plantilla de perforado del Insert (ejercicio 01 del banco 3D) rehecho EN CATIA desde su generador (pieza_porta_bulon.py).

Respuesta conocida: el STEP que escribe el generador de la nube, `generador/porta_bulon.py` de la v3 de la plantilla
(«5. 3D\VWA\PATAGONIA - PLANTILLA PERFORADO INSERT\v3 - 2026-10-21 - alineada a la costura (concepto)\generador»; sha256
7b76456a...fe8d), corrido en el post-proceso con .venv-cad. Por que ese y no el bien.py del banco con con_bien=True como
dice la fila: el bien.py copia SOLO el STL, la malla da 1 611,928 mm3 contra 1 612,483 del solido exacto (0,555, mas que
los 0,5 de TOL_VOL: un CATIA perfecto daria rojo) y el modo «bien» de medir_b123d mide solo STEP. El generador escribe
ese mismo STL byte por byte (sha256 220da179...ab812 = el del bien.py, se verifica en cada corrida) y ademas el STEP.

El juez (cerrar_con_referencia): compara.py del 32 contra ese STEP con revisar_comparacion (sobra y falta <= 1 mm3,
distancia <= 0,01 mm, volumen, booleana que cierra, un solido de cada lado) y el centro a TOL_CDG; y los gemelos del banco
3D medidos como malla (cerrada y orientada): el bien.py tiene que quedar a menos de 1 mm3 del volumen de CATIA (lo que
separa la malla del solido exacto) y cada mal_*.py a mas de 5 mm3 (un puente de 0,2 mm de los que faltan ya son ~9 mm3).
El mal_2 (tapita) el banco no lo cuenta (sin_respuesta en tarea.yaml): es otro solido y el 51 le exige separarse igual.
con_bien=False. Acordado con la principal en el PEDIDO 30 (24/10/2026); la fila la asigno el pedido 13.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de CATIA, la referencia y la comparacion.
"""
import hashlib
import importlib.util
import json
import math
import os
import shutil
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "51_porta_bulon"
PARTE = "porta_bulon_M6"
NUBE_3D = os.environ.get("BANCO3D_NUBE_3D") or os.path.join(
    os.path.expanduser("~"), "BARACK ARGENTINA SRL", "Ingeniería y Proyecto - General", "INGENIERIA BARACK (NUNCA BORRAR)",
    "1- GENERAL", "5. 3D")
GENERADOR = os.path.join(NUBE_3D, "VWA", "PATAGONIA - PLANTILLA PERFORADO INSERT",
                         "v3 - 2026-10-21 - alineada a la costura (concepto)", "generador", "porta_bulon.py")
SHA_GENERADOR = "7b76456aa2f2627a192a9d8df32f52e9a03b87c46a01b3530e879463a1f9fe8d"
SHA_STL_BIEN = "220da17910697ca8c8cadb36034672fa3f511d49e5c5989f881b3dac9f5ab812"      # el de bien.py del banco
NOMBRE_REF = "PORTA-BULON M6 hexagonal (puentes escalonados)"
BANCO = os.path.join(jc.REPO, "evals", "banco3d", "ejercicios", "01_porta_bulon")
GEMELOS = {"bien.py": "cerca", "mal_1_techo_con_agujero.py": "lejos", "mal_2_tapita.py": "lejos"}
TOL_MALLA_MM3, LEJOS_MM3 = 1.0, 5.0


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_porta_bulon51", os.path.join(AQUI, "pieza_porta_bulon.py"))
    ctx = pieza.cuerpo(c, reg)
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE,
                    ocultos=ctx.get("construccion", []))
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def generar_referencia(carpeta, correr=subprocess.run):
    """Copia el generador (sha256 verificado), lo corre con .venv-cad y verifica que su STL sea el del bien.py."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    if not os.path.isfile(GENERADOR):
        return {"error": f"no esta el generador: {GENERADOR}"}
    if sha256(GENERADOR) != SHA_GENERADOR:
        return {"error": f"el generador cambio (sha256 {sha256(GENERADOR)})"}
    os.makedirs(carpeta, exist_ok=True)
    copia = os.path.join(carpeta, "porta_bulon_generador.py")
    shutil.copyfile(GENERADOR, copia)
    try:
        r = correr([jc.VENV_CAD, "-I", copia, carpeta], capture_output=True, text=True, timeout=600)
    except Exception as ex:  # noqa: BLE001
        return {"error": f"el generador no corrio: {ex!r}"[:300]}
    step, stl = os.path.join(carpeta, NOMBRE_REF + ".step"), os.path.join(carpeta, NOMBRE_REF + ".stl")
    if r.returncode != 0 or not os.path.isfile(step):
        return {"error": f"el generador salio con {r.returncode}: {(r.stderr or r.stdout or '')[-300:]}"}
    if not os.path.isfile(stl) or sha256(stl) != SHA_STL_BIEN:
        return {"error": "el STL del generador no es el del bien.py del banco (otro sha256)"}
    return {"step": step}


def medir_gemelos(carpeta, correr=subprocess.run):
    """Corre el bien.py y los mal_*.py del banco 3D (con la carpeta 3D de esta PC) y mide cada STL como malla."""
    # con el prefijo de rutas largas: en CATA la carpeta 3D + la ruta del STL del bien pasan de 260 caracteres (287) y
    # Windows dice que el archivo no existe (memoria reference_max_path_260_ruta_no_abre)
    env = dict(os.environ, BANCO3D_NUBE_3D=NUBE_3D if NUBE_3D.startswith("\\\\?\\") else "\\\\?\\" + NUBE_3D)
    out = {}
    for archivo in GEMELOS:
        dest = os.path.join(carpeta, os.path.splitext(archivo)[0])
        os.makedirs(dest, exist_ok=True)
        try:
            r = correr([jc.VENV_CAD, "-I", os.path.join(BANCO, archivo), dest], capture_output=True, text=True,
                       timeout=600, env=env)
            stls = [os.path.join(dest, n) for n in os.listdir(dest) if n.lower().endswith(".stl")]
            if r.returncode != 0 or len(stls) != 1:
                out[archivo] = {"error": f"salio con {r.returncode}, {len(stls)} STL: {(r.stderr or r.stdout or '')[-200:]}"}
                continue
            m = jc.medir_b123d(["stl", stls[0]])
            out[archivo] = next(iter((m.get("partes") or {}).values()), {"error": m.get("error")})
        except Exception as ex:  # noqa: BLE001
            out[archivo] = {"error": repr(ex)[:200]}
    return out


def cerrar_con_referencia(carpeta, referencia=None, comparar_con=None, medir=None, gemelos=None):
    """Despues de correr_ejercicio (con_bien=False): el STEP de CATIA contra el del generador, y los gemelos del banco."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {}
    e48 = cargar("ej48_catia_51", os.path.join(EJERCICIOS, "48_gancho_mochila", "catia.py"))    # comparar, _max_eje
    ref = (referencia or generar_referencia)(os.path.join(carpeta, "referencia"))
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    if "error" in ref:
        problemas.append(ref["error"])
    elif not os.path.isfile(paso) and comparar_con is None:
        problemas.append("CATIA no dejo el STEP")
    else:
        e32 = cargar("ej32_catia_51", os.path.join(EJERCICIOS, "32_virolador_v16", "catia.py"))
        try:
            d = (comparar_con or e48.comparar)(paso, ref["step"])
        except Exception as e:  # noqa: BLE001
            d = None
            problemas.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_la_referencia"] = d
            problemas += e32.revisar_comparacion(d)
        b = (medir or jc.medir_b123d)(["step", ref["step"]])
        rb = next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}
        st = s.get("step_catia_en_build123d")
        st = st.get(PARTE) if isinstance(st, dict) else {}
        juez["dif_cdg_mm"] = e48._max_eje((st or {}).get("cdg_mm"), rb.get("cdg_mm"))
        if not rb.get("cdg_mm"):
            problemas.append(f"no se pudo medir el centro de la referencia ({b.get('error') if isinstance(b, dict) else b})"
                             [:300])
        elif not juez["dif_cdg_mm"] <= jc.TOL_CDG:
            problemas.append(f"el centro del STEP de CATIA {(st or {}).get('cdg_mm')} no es el de la referencia")
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    g = (gemelos or medir_gemelos)(os.path.join(carpeta, "gemelos"))
    s["gemelos"], juez["gemelos_dif_mm3"] = g, {}
    for archivo, esperado in GEMELOS.items():
        m = g.get(archivo) or {}
        v = m.get("volumen_stl", m.get("volumen"))                     # medir_stl da volumen_stl
        if not isinstance(v, (int, float)) or not isinstance(vc, (int, float)) or not math.isfinite(v):
            problemas.append(f"el gemelo {archivo} no se midio ({m.get('error')})")
            continue
        if m.get("cerrado") is not True or m.get("orientacion_consistente") is not True or m.get("partes_negativas"):
            problemas.append(f"la malla del gemelo {archivo} no es un solido (cerrado {m.get('cerrado')}, orientada "
                             f"{m.get('orientacion_consistente')}, partes negativas {m.get('partes_negativas')})")
            continue
        dif = round(abs(v - vc), 3)
        juez["gemelos_dif_mm3"][archivo] = dif
        if esperado == "cerca" and not dif <= TOL_MALLA_MM3:
            problemas.append(f"{archivo} (la pieza bien del banco) queda a {dif} mm3 de CATIA")
        if esperado == "lejos" and not dif > LEJOS_MM3:
            problemas.append(f"{archivo} (otro solido del banco) queda a {dif} mm3 de CATIA: el control no lo separa")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_REFERENCIA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez,
                                        "contra_la_referencia": s.get("contra_la_referencia")}))
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
