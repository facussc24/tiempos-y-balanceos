# -*- coding: utf-8 -*-
"""Ejercicio 40 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
bloque en V de 90 grados como ENSAMBLE. El V son dos planos (y - z = 0 y -y - z = 0, vertice en el eje X); el eje de un
cilindro queda a distancia R de cada plano por dos restricciones de distancia del solucionador de CATIA, y se lee su
altura para D 160 y D 159,86 (la tolerancia del eje, -0,14 / 0).

Papel: Shuping Lv, «Discussion on Calculation Method of Positioning Error», ICMMCT 2018, Advances in Engineering Research
vol. 152 (Atlantis Press), https://www.atlantis-press.com/article/25900049.pdf, Example 1 (pags. 265-266): eje D 160
(-0,14 / 0) en un V de 90 grados, error de desplazamiento del eje dY = dD / (2 sen(a / 2)) = 0,707 x 0,14 = 0,099 mm. La
altura del eje sobre el vertice es z = R raiz(2): 113,137 y 113,038 (cuenta de geometria; la diferencia es la del papel).

La pieza la arma pieza_ej74.py (el ej74 de la practica con cambios minimos anotados). El juez (cerrar_con_papel): por cada
D, las dos restricciones resueltas (estado 0) con el valor R, y = 0 (el eje en el plano de simetria) y z = R raiz(2) a
TOL_Z; la diferencia de alturas contra la cuenta dD / (2 sen 45) a TOL_Z y contra el 0,099 del papel a medio digito
(0,0005). El 0,099 es el error de DESPLAZAMIENTO del eje (dY, «reference displacement error» del papel), no el error de
posicionamiento de la cota H, que en la misma pagina le suma el desalineado: 0,09 + 0,099 = 0,189. No hay volumen ni
STEP: lo que se juzga es la pose que da el solucionador. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json y los CATPart del V y de los dos ejes.
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "40_bloque_en_v"
DIAMETROS = (160.0, 159.86)
PUBLICADO_MM = 0.099                                # Atlantis Press, Example 1: 0,707 x 0,14
CUENTA_MM = (DIAMETROS[0] - DIAMETROS[1]) / (2 * math.sin(math.radians(45)))       # 0,098995
TOL_Z = 1e-3                                        # mm; el solucionador dio la cuenta a 1e-4 en la practica
TOL_PAPEL = 5e-4                                    # medio digito del 0,099 publicado


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_ej74", os.path.join(AQUI, "pieza_ej74.py"))
    res = pieza.cuerpo(c, reg)
    salida["asiento"] = {str(d): v for d, v in res.items()}


def cerrar_con_papel(carpeta):
    """Despues de correr_ejercicio (con_bien=False): la pose del eje para cada D y la diferencia contra el papel."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    problemas, juez = [], {"publicado_mm": PUBLICADO_MM, "cuenta_mm": round(CUENTA_MM, 6)}
    asiento = s.get("asiento") or {}
    z = {}
    for d in DIAMETROS:
        a = asiento.get(str(d))
        if not isinstance(a, dict):
            problemas.append(f"D {d}: el solucionador no asento el eje")
            continue
        esperado = d / 2 * math.sqrt(2)
        diag = a.get("diag") or {}
        j = {"z": a.get("z"), "y": a.get("y"), "z_cuenta": round(esperado, 4), "estados": diag.get("estados"),
             "valores": diag.get("valores")}
        if diag.get("estados") != [0, 0]:
            problemas.append(f"D {d}: las restricciones no quedaron resueltas ({diag.get('estados')})")
        if not diag.get("valores") or any(not abs(v - d / 2) <= 1e-9 for v in diag["valores"]):
            problemas.append(f"D {d}: las restricciones no valen R = {d / 2} ({diag.get('valores')})")
        if not isinstance(a.get("y"), (int, float)) or not abs(a["y"]) <= TOL_Z:   # «not <=»: un NaN da rojo
            problemas.append(f"D {d}: el eje no quedo en el plano de simetria (y = {a.get('y')})")
        if not isinstance(a.get("z"), (int, float)) or not abs(a["z"] - esperado) <= TOL_Z:
            problemas.append(f"D {d}: z = {a.get('z')} contra R raiz(2) = {esperado:.4f}")
        else:
            z[d] = a["z"]
        juez[str(d)] = j
    if len(z) == 2:
        dz = z[DIAMETROS[0]] - z[DIAMETROS[1]]
        juez.update({"desplazamiento_mm": round(dz, 4), "dif_cuenta_mm": round(dz - CUENTA_MM, 5),
                     "dif_papel_mm": round(dz - PUBLICADO_MM, 5)})
        if not abs(dz - CUENTA_MM) <= TOL_Z:
            problemas.append(f"desplazamiento {dz:.4f} contra la cuenta {CUENTA_MM:.4f}")
        if not abs(dz - PUBLICADO_MM) <= TOL_PAPEL:
            problemas.append(f"desplazamiento {dz:.4f} contra el papel {PUBLICADO_MM}")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PAPEL", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_papel(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar el papel en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
