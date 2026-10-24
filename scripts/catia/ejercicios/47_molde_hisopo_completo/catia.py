# -*- coding: utf-8 -*-
"""Ejercicio 47 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): el molde de dos mitades del hisopo de PP con lo que
pide la solucion (a) del MIT 2.008 (examen practico 1 de 2022, problema 2; banco E13): BEBEDERO desde la cara de arriba,
CANAL en el plano de particion, COMPUERTA en el medio del hisopo (el plastico fluye parejo a los dos lados) y PINES
EXPULSORES en la mitad de abajo; despues el bloque menos la colada y los expulsores, partido por el plano de particion.

Geometria: ej72_molde_hisopo_completo.py de la practica del 19/10 con UN cambio anotado (CAMBIO 1: la carpeta de la skill
para uniones.py sale del repo y no de una ruta escrita a mano). Su control (build123d sobre el STEP de CATIA de la colada
y los expulsores) corre adentro del ej72 como paso: si no cierra, el paso falla.

Respuesta conocida. Del PAPEL (la solucion (a), pags. 3-5): la pieza simplificada (cabeza O8,6 x 15,4 + cuerpo O3 x 33,3
-> pi 4,3^2 15,4 + pi 1,5^2 33,3 = 1 129,94 mm3), canal y bebedero que llevan el plastico a la cavidad, la compuerta en el
MEDIO del hisopo (x = 24,35), la particion por el eje y pines expulsores. Valores de DISENO del ej72, NO del papel (revisor
del 47): la posicion del bebedero (y = 10), los radios del canal y del bebedero, y los pines: el papel muestra 4 (3 finos
y 1 grande, sin cotas; la grilla pide «all 3/4 ejector pins») y el ej72 pone 2 (uno bajo la cabeza, uno bajo el cuerpo).
El juez exige los 2 del ej72; la cantidad del papel no se juzga. Fuera del alcance: el corredizo del mango hueco (la
pieza modelada es maciza) y la mitad de arriba (se guarda la de abajo).
Lo que se mide sobre lo que hizo CATIA:
- la pieza a 0,5 mm3 de la cuenta; la COLADA (pieza + canal + bebedero) es UN solido, y el gemelo de build123d con el canal
  corto da DOS (es una constante: prueba el contador de solidos, no la pieza de CATIA);
- la boca del bebedero en la cara de arriba (z = 15), el bebedero en (24,35; 10), el canal EN la particion (centro en z = 0)
  y la compuerta al medio del largo (x = 24,35), a 0,01 mm;
- cada expulsor TOCA la pieza (contacto > 1 mm2, solape < 1e-3 mm3) y vive en la mitad de abajo (z <= 0);
- la MITAD DE ABAJO del molde con el volumen y el centro del gemelo de build123d (gemelo_molde.py: bloque menos pieza,
  canal y pines con las cotas del ej72: 30 159,282 mm3, z -7,608) a 0,5 mm3 y 0,01 mm (revisor del 47: con solo el signo
  del centro, un bloque sin cavidad (30 915), con solo los pines (30 755,1) o sin los pines (30 319,2) daban verde).
ok = los pasos sin falla y sin error del juez Y todo lo de arriba.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de la colada y los expulsores, una captura.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "47_molde_hisopo_completo"
RC, LC, RB, LB, BZ = 4.3, 15.4, 1.5, 33.3, 15.0     # los del ej72 (y de la solucion del MIT)
XG, YS = (LC + LB) / 2, 10.0
N_EXPULSORES = 2
TOL_MM = 0.01


def volumen_pieza():
    return math.pi * RC ** 2 * LC + math.pi * RB ** 2 * LB


def gemelo_molde():
    """La mitad de abajo del molde armada con build123d (gemelo_molde.py, en .venv-cad): {"vol", "cdg"}."""
    import subprocess
    r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_molde.py")], capture_output=True, text=True,
                       timeout=600)
    lineas = [x for x in (r.stdout or "").splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"gemelo_molde.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    return json.loads(lineas[-1])


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej72_molde_hisopo_completo as ej   # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    if (ej.RC, ej.LC, ej.RB, ej.LB, ej.BZ, len(ej.EXP)) != (RC, LC, RB, LB, BZ, N_EXPULSORES):
        raise RuntimeError("el ej72 copiado no trae la pieza de la solucion")
    ej.captura = lambda c_, reg_, nombre, vistas=None, **k: jc.captura_bmp(c_, reg_.carpeta, nombre)
    ej.cuerpo(c, reg)
    for k in ("colada", "expulsores", "control", "molde"):
        salida[k] = reg.datos.get(k)
    st = (reg.datos.get("step") or {}).get("step")
    if st and os.path.isfile(st):
        salida["archivos"].append(os.path.relpath(st, salida["_carpeta"]))
    bmp = os.path.join(reg.carpeta, "ej72_mitad_abajo_iso.bmp")
    if os.path.isfile(bmp):
        salida["archivos"].append(os.path.relpath(bmp, salida["_carpeta"]))


def comparar(s):
    malos = []

    def cerca(a, b, tol):
        try:
            return abs(float(a) - float(b)) <= tol
        except (TypeError, ValueError):
            return False
    co = s.get("colada") or {}
    if not cerca(co.get("pieza"), volumen_pieza(), 0.5):
        malos.append(f"pieza de {co.get('pieza')} mm3 y la de la solucion es {volumen_pieza():.3f}")
    cc, cbb = co.get("canal_cdg") or [None] * 3, co.get("bebedero_cdg") or [None] * 3
    if not (cerca(cc[0], XG, TOL_MM) and cerca(cc[2], 0.0, TOL_MM)):
        malos.append(f"canal con centro en {cc}: tiene que estar en x {XG} (compuerta al medio) y en z 0 (particion)")
    if not (cerca(cbb[0], XG, TOL_MM) and cerca(cbb[1], YS, TOL_MM) and cerca(cbb[2], BZ / 2, TOL_MM)):
        malos.append(f"bebedero con centro en {cbb}: tiene que ir de la particion a la cara de arriba en ({XG}, {YS})")
    ct = s.get("control") or {}
    if ct.get("solidos_en_el_archivo") != 1 + N_EXPULSORES:
        malos.append(f"{ct.get('solidos_en_el_archivo')} solidos en el STEP: la colada tiene que ser UNO mas los expulsores")
    if ct.get("gemelo_canal_corto_solidos") != 2:
        malos.append(f"el gemelo del canal corto da {ct.get('gemelo_canal_corto_solidos')} solidos y no 2: control ciego")
    if not cerca(ct.get("boca_z"), BZ, 1e-3):
        malos.append(f"la boca del bebedero en z {ct.get('boca_z')} y no en la cara de arriba ({BZ})")
    ex = ct.get("expulsores") or []
    if len(ex) != N_EXPULSORES:
        malos.append(f"{len(ex)} expulsores medidos")
    for k, e in enumerate(ex):
        try:
            bien = (float(e["solape_mm3"]) < 1e-3 and float(e["contacto_mm2"]) > 1.0 and float(e["z_max"]) <= 1e-3)
        except (KeyError, TypeError, ValueError):
            bien = False
        if not bien:
            malos.append(f"expulsor {k}: {e} (tiene que tocar la pieza sin meterse y quedar en z <= 0)")
    mo = s.get("molde") or {}
    g = s.get("gemelo_molde") or {}
    if not (cerca(mo.get("vol_mitad_abajo"), g.get("vol"), 0.5) and cerca(mo.get("cdg_z"), (g.get("cdg") or [0, 0, None])[2], TOL_MM)):
        malos.append(f"la mitad de abajo del molde: {mo} y el gemelo da {g} (bloque menos pieza, canal y pines)")
    return malos


def cerrar_con_papel(carpeta, gemelo=None):
    """Idempotente: el error del juez queda aparte (error_juez) y el de este cierre se rearma cada vez. `gemelo` (la mitad
    del molde de build123d) se cambia en la prueba sin CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    try:
        s["gemelo_molde"] = gemelo if gemelo is not None else gemelo_molde()
    except Exception as e:  # noqa: BLE001
        s["gemelo_molde"] = {"error": repr(e)[:200]}
    malos = comparar(s)
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MOLDE", json.dumps({"ok": s["ok"], "malos": malos}, ensure_ascii=False))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_papel(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con el papel:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
