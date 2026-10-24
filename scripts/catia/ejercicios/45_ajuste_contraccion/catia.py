# -*- coding: utf-8 -*-
"""Ejercicio 45 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): ajuste por contraccion de dos anillos de aluminio
en CATIA (Generative Structural Analysis, fem.py de la skill cad-design). Un cuarto de cada anillo en Part Design (adentro
40 a 45 mm, afuera 45 a 100 mm, profundidad 15), aluminio por parametro (E 70 GPa, nu 0,33, rho 2 700), simetria en los
dos cortes y en la base (SAMSurfaceSlider) y la presion de interfaz en la cara de contacto (SAMPressure); malla parabolica
de 2 mm; desplazamiento radial = promedio de (x C1 + y C2) / r en los nodos de r = 45. Metodo y numeros de la practica del
19/10 (ej75_ajuste_contraccion.py, banco E17): -0,14704 y +0,03296 mm, suma 0,18000.

Respuesta conocida:
- el PAPEL: MIT 2.008, examen practico 1 de 2023, problema 4 (banco E17 de la practica; https://ocw.mit.edu/courses/
  2-008-design-and-manufacturing-ii-spring-2025/mit2_008_s25_quiz1_prac23_sol.pdf, pag. 13 y 14): ri 40, R 45, ro 100 mm,
  profundidad 15, E 70 GPa, alfa 20e-6, el de afuera calentado 200 grados: interferencia d = alfa R dT = 0,18 mm,
  presion P = (E/R) d (ro^2 - R^2)(R^2 - ri^2) / (2 R^2 (ro^2 - ri^2)) = 2,80e7 Pa (rehecha: 2,7896e7);
- con esa P (la rehecha, en la cara de contacto de cada anillo) CADA anillo por Lame (cilindro grueso, tension plana):
  el de adentro se cierra P R / E ((R^2 + ri^2)/(R^2 - ri^2) - nu) = 0,14704 mm y el de afuera se abre
  P R / E ((ro^2 + R^2)/(ro^2 - R^2) + nu) = 0,03296 mm; la suma es d = 0,18 mm (la formula del papel es esta suma).
  La SUMA no depende de nu (con nu 0 da 0,15296 + 0,02704 = 0,18 igual): un nu mal puesto solo lo ve cada anillo por
  separado (+4 % el de adentro, -18 % el de afuera).
  OJO (revisor del 45): el FEM no simula el contacto, se le IMPONE la presion; la referencia que se contrasta es Lame, y
  la suma contra el 0,18 del papel sale sola si cada anillo cierra. nu 0,33 y rho 2 700 son supuestos (el papel no los da;
  la suma no depende de nu, cada anillo si). La fuerza para separarlos (mu 0,7) se informa contra los 83,1 kN del papel.
Tolerancia de Lame 0,1 % (el modelo es tension plana exacta: el 19/10 y el 24/10 dieron Lame a 1e-5; en deformacion plana
el de adentro daria -0,1284, -13 %). Ademas: la presion que quedo cargada = la calculada (1e-6), los nodos de r = 45
(500 o mas, la cara de contacto) que se mueven parejo (max - min <= 1e-4 mm), el volumen de cada cuarto
(pi/4 (r1^2 - r0^2) 15) a 0,5 mm3, una cara por corte y una de contacto, y el material de la pieza reabierta.

ok = los pasos sin falla y sin error del juez Y la geometria y el material Y la presion cargada Y los nodos de r = 45 Y
cada anillo a 0,1 % de Lame Y la suma a 0,1 % de la interferencia del papel.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, las dos CATPart y los txt de desplazamientos.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "45_ajuste_contraccion"
RI, R, RO, PROF = 40.0, 45.0, 100.0, 15.0
E_PA, NU, RHO, ALFA, DT = 70e9, 0.33, 2700.0, 20e-6, 200.0
DELTA_PAPEL_MM = 0.18
F_PAPEL_KN, MU_ESTATICO = 83.1, 0.7          # papel: fuerza para separarlos (se informa, no decide)
TOL_REL = 0.001
MALLA = ("Parabolic", "2mm")
ANILLOS = {"anillo_in": (RI, R), "anillo_out": (R, RO)}


def presion():
    d = ALFA * R * DT / 1000
    return (E_PA / (R / 1000)) * d * ((RO ** 2 - R ** 2) * (R ** 2 - RI ** 2) / (2 * R ** 2 * (RO ** 2 - RI ** 2)))


def lame_mm(p=None, nu=NU):
    """Desplazamiento radial en r = R: el de adentro (negativo, se cierra) y el de afuera (positivo, se abre)."""
    p = presion() if p is None else p
    k = p * (R / 1000) / E_PA * 1000                      # mm
    return (-k * ((R ** 2 + RI ** 2) / (R ** 2 - RI ** 2) - nu), k * ((RO ** 2 + R ** 2) / (RO ** 2 - R ** 2) + nu))


def volumen_cuarto(r0, r1):
    return math.pi / 4 * (r1 ** 2 - r0 ** 2) * PROF


def skill():
    d = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "scripts", "catia")
    if d not in sys.path:
        sys.path.append(d)                         # al final: catia_base es el del juez (scripts/catia)
    import fem
    from croquis import dibujar
    return fem, dibujar


def construir(cb, c, reg, salida):
    fem, dibujar = skill()
    c.DisplayFileAlerts = False
    rutas = {}
    salida["anillos"] = {}

    def anillo(nombre, r0, r1):
        doc, part, body, sf = cb.nueva_pieza(c, nombre)
        sk = body.Sketches.Add(cb.ref(part, part.OriginElements.PlaneXY))
        f = sk.OpenEdition()
        dibujar(f, [("L", (r0, 0.0), (r1, 0.0)), ("A", (0.0, 0.0), r1, (r1, 0.0), (0.0, r1)),
                    ("L", (0.0, r1), (0.0, r0)), ("A", (0.0, 0.0), r0, (0.0, r0), (r0, 0.0))])
        sk.CloseEdition()
        part.Update()
        pd = sf.AddNewPad(sk, PROF)
        part.Update()
        if cb.medir(doc, part, body)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        m = cb.medir(doc, part, body)
        caras = [d for d in cb.topologia(doc, body, "Face") if "cdg" in d]
        planas = {"y0": [d["nombre"] for d in caras if abs(d["cdg"][1]) < 1e-3],
                  "x0": [d["nombre"] for d in caras if abs(d["cdg"][0]) < 1e-3],
                  "z0": [d["nombre"] for d in caras if abs(d["cdg"][2]) < 1e-3]}
        k = 2 * math.sqrt(2) / math.pi                     # cdg de un cuarto de cilindro: r * 2 raiz2 / pi
        contacto = [d["nombre"] for d in caras if abs(math.hypot(d["cdg"][0], d["cdg"][1]) - k * R) < 0.05
                    and abs(d["cdg"][2] - PROF / 2) < 1e-3]
        fem.poner_acero(c, doc)
        fem.material_propio(doc.Part, E_PA, RHO, NU)
        ruta = os.path.join(reg.carpeta, nombre + ".CATPart")
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.SaveAs(ruta)                            # a un archivo NUEVO: «Guardar» no conservaba el material (ej58)
        doc.Close()
        d2 = c.Documents.Open(ruta)
        prop = fem.propiedades(d2.Part)
        d2.Close()
        rutas[nombre] = (ruta, planas, contacto)
        return {"volumen": m.get("volume"), "caras": {k: len(v) for k, v in planas.items()}, "contacto": len(contacto),
                "material_reabierta": prop}
    for n, (r0, r1) in ANILLOS.items():
        salida["anillos"][n] = reg.paso(f"cuarto de anillo {n} ({r0:g} a {r1:g})", lambda n=n, r0=r0, r1=r1: anillo(n, r0, r1))

    def simular(nombre):
        ruta, planas, contacto = rutas[nombre]
        if any(len(v) != 1 for v in planas.values()) or len(contacto) != 1:
            raise RuntimeError(f"caras: {[len(v) for v in planas.values()]} contacto {len(contacto)}")
        e = fem.importar(c, ruta)
        e.deslizar(planas["y0"] + planas["x0"] + planas["z0"])
        cargada = e.presion(contacto, presion())
        e.malla(*MALLA)
        e.calcular()
        filas = e.exportar(fem.IMG_DESPLAZAMIENTO, reg.carpeta, f"desp_{nombre}")
        e.ad.Close()
        ur = [(x[0] * x[3] + x[1] * x[4]) / math.hypot(x[0], x[1]) for x in filas
              if abs(math.hypot(x[0], x[1]) - R) < 1e-3]
        if not ur:
            raise RuntimeError("ningun nodo en r = 45")
        return {"presion_cargada": cargada, "nodos_r45": len(ur), "ur_medio_mm": round(sum(ur) / len(ur), 6),
                "ur_min": round(min(ur), 6), "ur_max": round(max(ur), 6)}
    salida["simulacion"] = {n: reg.paso(f"presion de interfaz en el contacto: {n}", lambda n=n: simular(n)) for n in ANILLOS}


def numero(texto):
    t = str(texto).replace(",", ".")
    k = 0
    while k < len(t) and (t[k].isdigit() or t[k] in ".eE+-"):
        k += 1
    return float(t[:k])


def comparar(s):
    malos = []

    def cerca(a, b, tol):
        try:
            return abs(float(a) - float(b)) <= tol
        except (TypeError, ValueError):
            return False
    an = s.get("anillos") or {}
    for n, (r0, r1) in ANILLOS.items():
        a = an.get(n) or {}
        if not cerca(a.get("volumen"), volumen_cuarto(r0, r1), 0.5):
            malos.append(f"{n}: volumen {a.get('volumen')} y la cuenta da {volumen_cuarto(r0, r1):.3f}")
        if a.get("caras") != {"y0": 1, "x0": 1, "z0": 1} or a.get("contacto") != 1:
            malos.append(f"{n}: caras {a.get('caras')} contacto {a.get('contacto')}")
        p = a.get("material_reabierta") or {}
        try:
            e = numero(next(x for k, x in p.items() if "Young" in k))
            nu = numero(next(x for k, x in p.items() if "Poisson" in k))
            rho = numero(next(x for k, x in p.items() if "Density" in k))
        except (StopIteration, ValueError):
            e = nu = rho = None
        if not (cerca(e, E_PA, 1e-6 * E_PA) and cerca(nu, NU, 1e-6) and cerca(rho, RHO, 1e-3)):
            malos.append(f"{n}: material {e} {nu} {rho} y no {E_PA:.3g} {NU} {RHO:g}")
    sim = s.get("simulacion") or {}
    li, lo = lame_mm()
    f_kn = MU_ESTATICO * presion() * 2 * math.pi * (R / 1000) * (PROF / 1000) / 1000
    s["cuenta"] = {"presion_Pa": round(presion(), 0), "lame_adentro_mm": round(li, 6), "lame_afuera_mm": round(lo, 6),
                   "interferencia_papel_mm": DELTA_PAPEL_MM, "fuerza_separar_kN": round(f_kn, 2),
                   "fuerza_papel_kN": F_PAPEL_KN}
    ui = (sim.get("anillo_in") or {}).get("ur_medio_mm")
    uo = (sim.get("anillo_out") or {}).get("ur_medio_mm")
    for n, u, ref in (("anillo_in", ui, li), ("anillo_out", uo, lo)):
        d = sim.get(n) or {}
        if not cerca(u, ref, TOL_REL * abs(ref)):
            malos.append(f"{n}: desplazamiento radial {u} mm y Lame da {ref:.5f}")
        if not cerca(d.get("presion_cargada"), presion(), 1e-6 * presion()):
            malos.append(f"{n}: presion cargada {d.get('presion_cargada')} y la calculada es {presion():.0f}")
        try:
            n_nodos = int(d.get("nodos_r45"))
        except (TypeError, ValueError):
            n_nodos = 0
        if n_nodos < 500:
            malos.append(f"{n}: {n_nodos} nodos en r = 45 (la cara de contacto da mas de 1 300 con 2 mm)")
        if not cerca(d.get("ur_max"), d.get("ur_min"), 1e-4):
            malos.append(f"{n}: los nodos de r = 45 no se mueven parejo ({d.get('ur_min')} a {d.get('ur_max')} mm)")
    try:
        suma = float(uo) - float(ui)
    except (TypeError, ValueError):
        suma = float("nan")
    s["suma_mm"] = round(suma, 6) if suma == suma else None
    if not abs(suma - DELTA_PAPEL_MM) <= TOL_REL * DELTA_PAPEL_MM:
        malos.append(f"lo que se cierra mas lo que se abre da {suma} mm y la interferencia del papel es {DELTA_PAPEL_MM}")
    return malos


def cerrar_con_papel(carpeta):
    """Idempotente: el error del juez queda aparte (error_juez) y el de este cierre se rearma cada vez."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    malos = comparar(s)
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_AJUSTE", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "suma_mm": s.get("suma_mm"), "malos": malos}))
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
