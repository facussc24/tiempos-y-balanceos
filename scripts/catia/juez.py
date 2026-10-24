# -*- coding: utf-8 -*-
"""CATIA como segundo juez del banco 3D (23/10/2026): corre, UNO POR VEZ, el catia.py de los ejercicios 04, 03, 05 y 06
(cada uno rehace la pieza BIEN del banco en CATIA Part Design por COM, con su CATIA propia que arranca y apaga) y deja
<carpeta>/juez.json con el cuadro ejercicio | volumen build123d | volumen CATIA | diferencia | segundos | ok.

    C:\\Dev\\_catia_env\\Scripts\\python.exe juez.py <carpeta de trabajo, fuera del repo>

Reglas: antes de cada ejercicio no puede haber ninguna CATIA abierta (si la hay, espera hasta 5 min y, si sigue, frena
sin tocarla: puede ser la de Fak). Tope de 10 min por ejercicio; si se pasa, corta el ejercicio y cierra SOLO la CATIA de
esa corrida (pid y hora de arranque escritos por el ejercicio; nunca por nombre). Al terminar cada ejercicio espera que
no quede ninguna CATIA. Un ejercicio que no sale en CATIA queda con su error completo y se sigue con el siguiente.
ok = todos los pasos en CATIA sin falla y, en cada parte, |volumen CATIA - volumen build123d| <= 0,5 mm3 y centros de
gravedad a <= 0,01 mm (tolerancias del juez, del banco, sin fuente de Barack).
"""
import json
import os
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = ["04_nido_holgura", "03_apoyo_321", "05_canto_vivo", "06_palanca_0_60"]
TOPE_SEG = 600
ESPERA_ANTES_SEG = 300
ESPERA_DESPUES_SEG = 120


def _leer(ruta):
    try:
        return json.load(open(ruta, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _esperar_sin_catia(cb, seg):
    t = time.time()
    while True:
        pids = cb.cnext_abiertos()
        if pids == [] or time.time() - t >= seg:
            return pids
        time.sleep(5)


def _cerrar_la_de_esta_corrida(cb, sub, desde):
    """Cierra la CATIA que arranco ESTE ejercicio (pid + hora de arranque de mi_catia.json o salida.json) si es la
    unica abierta. Devuelve que hizo."""
    pids = cb.cnext_abiertos()
    if not pids:
        return "no habia CATIA"
    d = _leer(os.path.join(sub, "mi_catia.json")) or {}
    s = _leer(os.path.join(sub, "salida.json"))
    pid = d.get("pid") or s.get("catia_pid")
    hora = d.get("hora") or s.get("catia_hora")
    if pid is None or pids != [pid]:
        return f"NO cierro: CATIA abiertas {pids}, la de esta corrida {pid}"
    h = cb.hora_de_arranque(pid)
    if hora is not None and h != hora:
        return f"NO cierro el pid {pid}: otra hora de arranque (puede ser otra CATIA con el pid reciclado)"
    if hora is None and (h is None or h / 1e6 < desde - 5):
        return f"NO cierro el pid {pid}: sin hora guardada y no arranco durante esta corrida"
    subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
    return f"cerrada la CATIA de esta corrida (pid {pid})"


def correr_uno(cb, jc, ej, carpeta):
    sub = os.path.join(carpeta, ej)
    os.makedirs(sub, exist_ok=True)
    fila = {"ejercicio": ej, "carpeta": sub}
    pids = cb.cnext_abiertos()
    fila["cnext_antes"] = None if pids is None else len(pids)
    if pids:
        print(f"  hay CATIA abierta {pids}: espero hasta {ESPERA_ANTES_SEG} s sin tocarla")
        pids = _esperar_sin_catia(cb, ESPERA_ANTES_SEG)
        fila["cnext_antes_despues_de_esperar"] = None if pids is None else len(pids)
    if pids != []:
        fila["ok"] = False
        fila["error"] = ("no corrido: no pude mirar si hay CATIA abierta" if pids is None else
                         f"no corrido: hay una CATIA abierta que no es de esta corrida (pids {pids}); no se toco")
        return fila, True                       # frena el juez
    script = os.path.join(AQUI, "ejercicios", ej, "catia.py")
    t0 = time.time()
    with open(os.path.join(sub, "consola.txt"), "w", encoding="utf-8") as log:
        p = subprocess.Popen([sys.executable, "-u", "-B", script, sub], stdout=log, stderr=subprocess.STDOUT)
        try:
            fila["codigo_salida"] = p.wait(timeout=TOPE_SEG)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
            fila["codigo_salida"] = None
            fila["tope"] = f"se paso de {TOPE_SEG} s: cortado"
            fila["cierre"] = _cerrar_la_de_esta_corrida(cb, sub, t0)
    fila["segundos"] = round(time.time() - t0, 1)
    pids = _esperar_sin_catia(cb, ESPERA_DESPUES_SEG)
    if pids:
        fila["cierre"] = _cerrar_la_de_esta_corrida(cb, sub, t0)
        pids = _esperar_sin_catia(cb, 30)
    fila["cnext_despues"] = None if pids is None else len(pids)
    s = _leer(os.path.join(sub, "salida.json"))
    if not s:
        fila["ok"] = False
        fila["error"] = "no escribio salida.json; consola: " + open(os.path.join(sub, "consola.txt"), encoding="utf-8",
                                                                     errors="replace").read()[-1500:]
        return fila, pids != []
    desplaz = s.get("desplazamiento_respecto_de_build123d_mm") or [0.0, 0.0, s.get(
        "desplazamiento_z_respecto_de_build123d_mm", 0.0)]
    if not s.get("volumen_build123d"):          # el 04 (anterior al juez) no mide con build123d: lo mide el juez
        b = jc.medir_b123d(["bien", os.path.join(jc.REPO, "evals", "banco3d", "ejercicios", ej, "bien.py"),
                            os.path.join(sub, "_build123d")])
        s["volumen_build123d"] = {k: d.get("volumen") for k, d in (b.get("partes") or {}).items()}
        s["cdg_build123d_mm"] = {k: d.get("cdg_mm") for k, d in (b.get("partes") or {}).items()}
        if "error" in b:
            s["error_build123d"] = b["error"]
        fila["build123d_medido_por_el_juez"] = True
    iguales = jc.comparar(s, desplaz)
    fallas = s.get("pasos_con_falla", ["sin registro"])
    vb = s["volumen_build123d"]
    vc = s.get("volumen_catia", {})
    fila.update({
        "volumen_build123d": round(sum(v for v in vb.values() if v is not None), 3) if vb else None,
        "volumen_catia": round(sum(v for v in vc.values() if v is not None), 3) if vc else None,
        "por_parte": {k: {"build123d": vb.get(k), "catia": vc.get(k), "diferencia_mm3": s["diferencia_mm3"].get(k),
                          "dif_cdg_mm": s["dif_cdg_mm"].get(k),
                          "step_catia_en_build123d": (s.get("volumen_step_catia_en_build123d") or {}).get(k)
                          if isinstance(s.get("volumen_step_catia_en_build123d"), dict) else None}
                      for k in sorted(set(vb) | set(vc))},
        "pasos_con_falla": fallas,
        "cuadros_de_catia": s.get("cuadros_de_catia"),
        "archivos": [os.path.join(sub, a) for a in s.get("archivos", [])],
    })
    if fila["volumen_build123d"] is not None and fila["volumen_catia"] is not None:
        fila["diferencia_mm3"] = round(fila["volumen_catia"] - fila["volumen_build123d"], 3)
    fila["ok"] = bool(not fallas and iguales and set(vb) == set(vc))
    if not fila["ok"]:
        fila["error"] = s.get("error") or f"diferencias {s['diferencia_mm3']} / cdg {s['dif_cdg_mm']}"
    return fila, pids != []


def cuadro_md(filas):
    def n(x):
        return "-" if x is None else f"{x:,.3f}".replace(",", "_").replace(".", ",").replace("_", ".")
    out = ["| ejercicio | volumen build123d (mm3) | volumen CATIA (mm3) | diferencia (mm3) | segundos | ok |",
           "|---|---:|---:|---:|---:|---|"]
    for f in filas:
        out.append(f"| {f['ejercicio']} | {n(f.get('volumen_build123d'))} | {n(f.get('volumen_catia'))} | "
                   f"{n(f.get('diferencia_mm3'))} | {f.get('segundos', '-')} | {'si' if f.get('ok') else 'NO'} |")
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    carpeta = os.path.abspath(sys.argv[1])
    os.makedirs(carpeta, exist_ok=True)
    os.environ["CATIA_TRABAJO"] = carpeta
    sys.path.insert(0, AQUI)
    import catia_base as cb
    import juez_comun as jc
    t0 = time.time()
    res = {"fecha": time.strftime("%Y-%m-%d %H:%M:%S"), "carpeta": carpeta, "tope_seg_por_ejercicio": TOPE_SEG,
           "tolerancia_volumen_mm3": jc.TOL_VOL, "tolerancia_cdg_mm": jc.TOL_CDG, "filas": []}
    for ej in EJERCICIOS:
        print(f"== {ej}  ({time.strftime('%H:%M:%S')})", flush=True)
        fila, frenar = correr_uno(cb, jc, ej, carpeta)
        res["filas"].append(fila)
        print(f"   ok={fila.get('ok')} build123d={fila.get('volumen_build123d')} CATIA={fila.get('volumen_catia')} "
              f"dif={fila.get('diferencia_mm3')} seg={fila.get('segundos')} CNEXT antes/despues="
              f"{fila.get('cnext_antes')}/{fila.get('cnext_despues')}" + (f"  ERROR {fila['error'][:300]}"
                                                                         if fila.get("error") else ""), flush=True)
        json.dump(res, open(os.path.join(carpeta, "juez.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if frenar:
            res["frenado"] = f"despues de {ej}: queda una CATIA abierta o no se pudo mirar; no sigo"
            print("FRENO:", res["frenado"])
            break
    res["segundos_total"] = round(time.time() - t0, 1)
    res["cnext_al_final"] = (lambda p: None if p is None else len(p))(cb.cnext_abiertos())
    res["cuadro"] = [{k: f.get(k) for k in ("ejercicio", "volumen_build123d", "volumen_catia", "diferencia_mm3",
                                            "segundos", "ok")} for f in res["filas"]]
    res["cuadro_md"] = cuadro_md(res["filas"])
    json.dump(res, open(os.path.join(carpeta, "juez.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(res["cuadro_md"])
    print(f"CNEXT al final: {res['cnext_al_final']}  total {res['segundos_total']} s")
    return 0 if all(f.get("ok") for f in res["filas"]) and len(res["filas"]) == len(EJERCICIOS) else 1


if __name__ == "__main__":
    sys.exit(main())
