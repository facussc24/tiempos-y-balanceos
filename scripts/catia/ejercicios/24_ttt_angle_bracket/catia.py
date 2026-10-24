# -*- coding: utf-8 -*-
"""Ejercicio 24 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): Too Tall Toby PPP01-04 «Angle Bracket» (guia de
build123d, https://build123d.readthedocs.io/en/stable/tttt.html, libre para uso educativo) en CATIA, con la masa contra
la de la guia: 310,00 g en acero de 7 800 kg/m3. Es tambien el MOLDE de los ejercicios 26, 28, 30 y 31 (Tie Plate, Bearing
Bracket, Corner Tie, SM Hanger): cada uno define su CFG y llama a correr(CFG) de este archivo. La CFG puede traer
tol_masa_g (si la guia da otra tolerancia: el 31, +-10 g) y volumen_referencia (un numero con su fuente cuando no hay
gemelo propio: el 31; salida.json lo dice en fuente_gemelo).

Molde (las piezas de afuera ya resueltas en la practica del 19/10, sin bien.py en el banco 3D): la pieza la arma
pieza_ejNN.py (el ejNN de la practica, que dio la respuesta de la guia, copiado POR SCRIPT con cambios minimos anotados
en su encabezado: devuelve el contexto en vez de capturar y guardar). Este archivo le agrega:
  - el material del catalogo (el preferido de la CFG; si no esta, Steel) con su parametro Density en la densidad de la
    guia, para que la masa salga de CATIA (material_con_densidad del 22);
  - la masa contra la guia (1 g, la tolerancia de masa del banco: control masa_esperada) y su coherencia con el volumen;
  - el volumen contra el gemelo de build123d de la practica (gemelo_b123d.py, la pieza entera: 0,5 mm3);
  - el STEP medido con build123d contra el volumen de CATIA.
correr_ejercicio va con con_bien=False (no hay bien.py) y el veredicto lo da cerrar_con_respuesta().

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP y la captura.
"""
import importlib.util
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


e22 = cargar("ej22_catia", os.path.join(EJERCICIOS, "22_ttt_post_cap", "catia.py"))   # material_con_densidad

TOL_MASA_G = 1.0                    # la tolerancia de masa del banco (control masa_esperada)
TOL_VOL = 0.5                       # mm3, la de juez_comun
TOL_COHERENCIA = 1e-3
ACERO, ALUMINIO = ("steel", "acero"), ("aluminium", "aluminum", "aluminio")

CFG = {"ej": "24_ttt_angle_bracket", "parte": "angle_bracket", "carpeta": AQUI, "pieza": "pieza_ej34",
       "nombre": "Too Tall Toby PPP01-04 Angle Bracket", "masa_g": 310.00, "densidad": 7800.0, "preferidos": ACERO}


def construir_con(cfg):
    def construir(cb, c, reg, salida):
        if AQUI not in sys.path:                   # croquis.py (de la practica) vive en la carpeta del molde
            sys.path.insert(0, AQUI)
        pieza = cargar(cfg["pieza"], os.path.join(cfg["carpeta"], cfg["pieza"] + ".py"))
        ctx = pieza.cuerpo(c, reg)                 # arma la pieza con sus pasos en reg (la del ejNN de la practica)
        doc, part, body = ctx["doc"], ctx["part"], ctx["body"]
        m = e22.material_con_densidad(cb, c, doc, part, cfg["preferidos"], cfg["densidad"])
        salida["material_catia"] = {k: v for k, v in m.items() if k != "traza"}
        if m["ok"]:
            salida["masa_catia_g"] = round(m["masa_inercia_kg"] * 1000.0, 3)
        jc.cerrar_parte(cb, c, reg, salida, doc, part, body, cfg["parte"], cfg["parte"],
                        ocultos=ctx.get("construccion", []))
        try:
            doc.Close()
        except Exception as e:  # noqa: BLE001
            salida["documento_sin_cerrar"] = repr(e)[:200]
    return construir


def gemelo(cfg, correr=subprocess.run):
    """Volumen del gemelo de build123d de la practica (la pieza entera), con .venv-cad. Si la CFG trae volumen_referencia
    (el 31: la referencia de la guia, codigo de terceros que no entra al repo), se usa ese numero con su fuente."""
    if cfg.get("volumen_referencia") is not None:
        return {"volumen": cfg["volumen_referencia"], "fuente": cfg.get("fuente_referencia")}
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(cfg["carpeta"], "gemelo_b123d.py")], capture_output=True, text=True,
                   timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"el gemelo no midio: {ex!r}"[:300]}


def cerrar_con_respuesta(carpeta, cfg, medir_gemelo=None):
    """Despues de correr_ejercicio (con_bien=False): la masa contra la guia, el volumen contra el gemelo y el STEP contra
    el volumen de CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)                      # lo deja correr_ejercicio con con_bien=False (revisor del 18)
    parte, problemas, juez = cfg["parte"], [], {"masa_guia_g": cfg["masa_g"]}
    vc, masa = (s.get("volumen_catia") or {}).get(parte), s.get("masa_catia_g")
    if vc is None:
        problemas.append("la pieza no se midio en CATIA")
    if masa is None:
        problemas.append(f"sin masa de CATIA: {(s.get('material_catia') or {}).get('error')}")
    elif vc is not None:                          # revisor: con «elif vc» un 0,0 se salteaba en silencio
        juez.update({"masa_catia_g": masa, "dif_guia_g": round(masa - cfg["masa_g"], 3),
                     "densidad_implicita_kg_m3": round(masa / vc * 1e6, 3)})
        if abs(juez["dif_guia_g"]) > cfg.get("tol_masa_g", TOL_MASA_G):     # la guia del 31 dice +-10 g
            problemas.append(f"{masa} g contra {cfg['masa_g']} de la guia")
        if abs(juez["densidad_implicita_kg_m3"] - cfg["densidad"]) > TOL_COHERENCIA * cfg["densidad"]:
            problemas.append(f"masa sin coherencia con el volumen ({juez['densidad_implicita_kg_m3']})")
    g = (medir_gemelo or (lambda: gemelo(cfg)))()
    if "error" in g:
        problemas.append(g["error"])
    elif vc is not None:
        juez.update({"volumen_gemelo": g["volumen"], "dif_gemelo_mm3": round(vc - g["volumen"], 3),
                     "fuente_gemelo": g.get("fuente") or "gemelo_b123d.py corrido en esta corrida"})   # revisor del 31
        if abs(juez["dif_gemelo_mm3"]) > TOL_VOL:
            problemas.append(f"CATIA {vc} contra el gemelo {g['volumen']} mm3")
    vs = s.get("volumen_step_catia_en_build123d")      # si build123d no midio, juez_comun deja un texto
    v_step = vs.get(parte) if isinstance(vs, dict) else None
    if not isinstance(v_step, (int, float)) or vc is None or abs(v_step - vc) > TOL_VOL:
        problemas.append(f"el STEP ({v_step}) no da el volumen de CATIA ({vc})")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_RESPUESTA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


def correr(cfg):
    codigo = jc.correr_ejercicio(cfg["ej"], construir_con(cfg), con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_respuesta(os.path.abspath(sys.argv[1]), cfg)
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar la respuesta en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    return codigo


if __name__ == "__main__":
    sys.exit(correr(CFG))
