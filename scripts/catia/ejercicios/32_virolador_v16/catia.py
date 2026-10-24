# -*- coding: utf-8 -*-
"""Ejercicio 32 del banco de CATIA (fase 3, disenos reales de Barack, 24/10/2026): el virolador v16 del Upper Trim (el
dispositivo entregado, dos ranuras) rehecho EN CATIA desde sus datos: placa, cuatro apoyos con tope R1,5, los dos machos
(anillo por extrusion + seccion vertice a vertice + hueco), agarraderas y R3 en los cantos verticales del borde.

Geometria: ej13_v16.py de la practica del 19/10 con DOS cambios anotados en el archivo (la etapa fija en 5 y los
poligonos junto al script) y v16_ref/poligonos.json (los mismos JSON y el mismo metodo de build_v10.py).

Respuesta conocida: el STEP del dispositivo ENTREGADO (virolador_v10_two.step, C:\\Dev\\_catia_practica\\v16_ref\\ en la
PC principal, sha256 5b6cff1a4911f569...; no se sube: 4,4 MB) medido con OpenCASCADE contra lo que exporta CATIA
(compara.py de la practica, copiado: volumen comun y lo que sobra y falta con booleanas, distancia maxima en los dos
sentidos). El 19/10 dio sobra 0, falta 0 y distancia maxima 0,0016 mm.

ok = los pasos sin falla Y lo que sobra y lo que falta <= 1 mm3 Y la distancia maxima en los dos sentidos <= 0,01 mm Y
el volumen de CATIA a 0,5 mm3 (o 1e-5) del entregado. Corre solo en la PC principal (la referencia vive ahi).
La comparacion tarda unos 16 minutos (medido el 24/10/2026).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de CATIA y la comparacion.
"""
import hashlib
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "32_virolador_v16"
REFERENCIA = os.environ.get("V16_ENTREGADO", r"C:\Dev\_catia_practica\v16_ref\virolador_v10_two.step")
SHA_REFERENCIA = "5b6cff1a4911f5690dae27b90e434033333beb741dd3146852720e2da25865e3"
TOL_SOBRA_FALTA_MM3, TOL_DIST_MM = 1.0, 0.01
# compara.py corrido solo el 24/10/2026 (11:47:58 a 12:04:20) tardo 16 min 22 s: las booleanas sobre el STEP de 4,4 MB.
# El tope es tiempo de espera, no tolerancia: 40 min (2,5 veces lo medido).
TOPE_COMPARA_S = 2400


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej13_v16 as ej13                     # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    ej13.captura = lambda c_, reg_, nombre, vistas=None, **k: jc.captura_bmp(c_, reg_.carpeta, nombre)
    ej13.cuerpo(c, reg)
    paso = os.path.join(reg.carpeta, "out_etapa5.stp")
    if os.path.isfile(paso):
        salida["_steps"]["v16"] = paso
        salida["archivos"].append(os.path.relpath(paso, salida["_carpeta"]))
    m = reg.datos.get("resultado") or {}
    salida["resultado"] = m


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def revisar_comparacion(d):
    """Lo que no cierra en la salida de compara.py. Revisor del 32: un NaN o una clave que falta tienen que dar ROJO
    («> tol» dejaba pasar un NaN y «if d:» se salteaba todo con {}), y se exige lo que el docstring promete: la booleana
    que cierra y un solido de cada lado."""
    def num(k):
        try:
            x = float(d[k])
        except (KeyError, TypeError, ValueError):
            return None
        return x if x == x else None                   # NaN != NaN
    v = {k: num(k) for k in ("vol_A", "vol_B", "sobra_A_menos_B", "falta_B_menos_A", "dist_max_A_a_B", "dist_max_B_a_A")}
    faltan = [k for k, x in v.items() if x is None]
    if faltan:
        return [f"compara.py no dio un numero en {faltan}"]
    malos = []
    if not (v["sobra_A_menos_B"] <= TOL_SOBRA_FALTA_MM3 and v["falta_B_menos_A"] <= TOL_SOBRA_FALTA_MM3):
        malos.append(f"sobra {v['sobra_A_menos_B']} y falta {v['falta_B_menos_A']} mm3 contra el entregado")
    if not max(v["dist_max_A_a_B"], v["dist_max_B_a_A"]) <= TOL_DIST_MM:
        malos.append(f"distancia maxima {v['dist_max_A_a_B']} / {v['dist_max_B_a_A']} mm")
    if not abs(v["vol_A"] - v["vol_B"]) <= pj.tol_volumen(v["vol_B"]):
        malos.append(f"volumen {v['vol_A']} contra el entregado {v['vol_B']}")
    if d.get("booleana_cierra") is not True:
        malos.append(f"la booleana de compara.py no cierra ({d.get('booleana_cierra')})")
    if list(d.get("solidos") or []) != [1, 1]:
        malos.append(f"solidos {d.get('solidos')}: tiene que ser uno de cada lado")
    return malos


def cerrar_con_entregado(carpeta, comparar=None):
    """`comparar(paso_catia, referencia)` devuelve lo que imprime compara.py (se cambia en la prueba sin CATIA)."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    malos = []
    paso = next((os.path.join(carpeta, a) for a in s.get("archivos") or [] if a.lower().endswith("out_etapa5.stp")), "")
    if not os.path.isfile(paso):
        malos.append("CATIA no dejo el STEP")
    elif not os.path.isfile(REFERENCIA) or sha256(REFERENCIA) != SHA_REFERENCIA:
        malos.append(f"no esta el STEP entregado con su sha256: {REFERENCIA}")
    else:
        if comparar is None:
            def comparar(a, b):
                r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "compara.py"), a, b], capture_output=True,
                                   text=True, timeout=TOPE_COMPARA_S)
                lineas = [x for x in (r.stdout or "").strip().splitlines() if x.startswith("{")]
                if not lineas:                         # revisor del 32: si compara.py se cae, que se vea por que
                    raise RuntimeError(f"compara.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
                return json.loads(lineas[-1])
        try:
            d = comparar(paso, REFERENCIA)
        except Exception as e:  # noqa: BLE001
            d = None
            malos.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_el_entregado"] = d
            malos += revisar_comparacion(d)
    s["ok_entregado"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_V16", json.dumps({"ok": s["ok"], "contra_el_entregado": s.get("contra_el_entregado"), "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_entregado(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con el entregado:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
