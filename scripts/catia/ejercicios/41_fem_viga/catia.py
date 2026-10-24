# -*- coding: utf-8 -*-
"""Ejercicio 41 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): elementos finitos en CATIA (Generative Structural
Analysis) contra la cuenta EXACTA de una viga. Viga de acero 200 (X) x 20 (Y) x 10 (Z) hecha en Part Design, acero del
catalogo de CATIA, empotrada en la cara x = 0:
- ESTATICA: 100 N hacia -Z repartidos en la cara x = 200; flecha de la punta = promedio de C3 de los nodos de x = 200;
- FRECUENCIAS: sin cargas, los dos primeros modos.
Metodo: fem.py de la skill cad-design (importar, empotrar, fuerza, malla, exportar, frecuencias), el de los ej57/ej60b de
la practica del 19/10 (ej57: 0,797 mm con malla parabolica de 2,5 mm; ej60b: 204,19 y 405,47 Hz con 5 mm).

Respuesta conocida (resistencia de materiales, con E, nu y rho del acero del catalogo de CATIA, que el juez lee y exige):
- flecha de Timoshenko d = F L^3 / (3 E I) + F L / (k G A), I = b h^3 / 12, k = 5/6, G = E / (2 (1 + nu)):
  0,8000 + 0,0015 = 0,8015 mm (E 200 000 N/mm2, nu 0,266);
- frecuencias de Euler-Bernoulli en voladizo f = (beta^2 / 2 pi) raiz(E I / (rho A L^4)), beta1 = 1,8751:
  flexion en el alto de 10 (I = 20 x 10^3 / 12) 203,7 Hz y en el ancho de 20 (I = 10 x 20^3 / 12) 407,4 Hz.

Tolerancia 1,5 %: la pieza 3D con la cara entera empotrada no es la viga de la teoria y la malla todavia converge (el
ej57 dio -0,90, -0,64 y -0,55 % con 10, 5 y 2,5 mm: la diferencia baja con la malla; la causa no se midio); lo que este
control tiene que cazar da 10 % o mas: la malla LINEAL por defecto -66 %, el alto 10 -> 11 mm -25 % de flecha y +10 % de
frecuencia, la fuerza en otra cara (-62 % en una lateral), el material mal. OJO: la frecuencia sola NO ve acero contra
aluminio (E/rho casi igual: f x 1,007), y nu casi no mueve la flecha (0,266 -> 0,30: +0,005 %); por eso E, nu y rho se
leen de la pieza REABIERTA y se exigen los del acero.

ok = los pasos sin falla y sin error del juez Y el acero en la pieza reabierta (E 2e11 N/m2, nu 0,266, rho 7 860) Y la viga
de 40 000 mm3 con las caras extremas en x 0 y 200, de 200 mm2 cada una Y la punta con 100 nodos o mas que bajan parejo
(max - min de C3 <= 0,001 mm: la carga en media cara gira la punta y el promedio no lo ve, revisor del 41) Y la flecha a
1,5 % de Timoshenko Y los dos primeros modos a 1,5 % de Euler-Bernoulli. Toda comparacion es «bien si <= tol»: un NaN es
rojo.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, la CATPart con el acero, el txt de desplazamientos y el
informe de frecuencias.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "41_fem_viga"
F, L, B, H = 100.0, 200.0, 20.0, 10.0          # N y mm
ACERO = {"E_pa": 2e11, "nu": 0.266, "rho": 7860.0}
BETA1 = 1.8751                                 # primer modo de la viga en voladizo
TOL_REL = 0.015
MALLA = ("Parabolic", "2.5mm")


def fem_de_la_skill():
    d = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "scripts", "catia")
    if d not in sys.path:
        sys.path.append(d)                         # al final: catia_base es el del juez (scripts/catia)
    import fem
    return fem


def flecha_timoshenko(E_mpa, nu):
    i = B * H ** 3 / 12.0
    g = E_mpa / (2.0 * (1.0 + nu))
    return F * L ** 3 / (3.0 * E_mpa * i) + F * L / ((5.0 / 6.0) * g * B * H)


def frecuencias_euler(E_pa, rho):
    a, l4 = (B / 1000) * (H / 1000), (L / 1000) ** 4
    i_z, i_y = (B / 1000) * (H / 1000) ** 3 / 12.0, (H / 1000) * (B / 1000) ** 3 / 12.0
    return [BETA1 ** 2 / (2 * math.pi) * math.sqrt(E_pa * i / (rho * a * l4)) for i in (i_z, i_y)]


def numero(texto):
    """«2e+011N_m2» / «0,266» / «7860kg_m3» -> float."""
    t = texto.replace(",", ".")
    k = 0
    while k < len(t) and (t[k].isdigit() or t[k] in ".eE+-"):
        k += 1
    return float(t[:k])


def construir(cb, c, reg, salida):
    fem = fem_de_la_skill()
    c.DisplayFileAlerts = False
    pieza = os.path.join(reg.carpeta, "viga_acero.CATPart")
    est = {}

    def viga():
        doc, part, body, sf = cb.nueva_pieza(c, "viga_acero")
        sk = body.Sketches.Add(cb.ref(part, part.OriginElements.PlaneYZ))
        f = sk.OpenEdition()
        for (a, b) in (((0, 0), (B, 0)), ((B, 0), (B, H)), ((B, H), (0, H)), ((0, H), (0, 0))):
            f.CreateLine(a[0], a[1], b[0], b[1])
        sk.CloseEdition()
        part.Update()
        pd = sf.AddNewPad(sk, L)
        part.Update()
        if cb.medir(doc, part, body)["cdg_mm"][0] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        m = cb.medir(doc, part, body)
        dens = fem.poner_acero(c, doc)
        prop = fem.propiedades(part)
        caras = [d for d in cb.topologia(doc, body, "Face") if "cdg" in d]
        x0 = min(caras, key=lambda d: d["cdg"][0])
        xl = max(caras, key=lambda d: d["cdg"][0])
        if os.path.exists(pieza):
            os.remove(pieza)
        doc.SaveAs(pieza)                           # a un archivo NUEVO: «Guardar» no conservaba el material (ej58)
        doc.Close()
        d2 = c.Documents.Open(pieza)                # el control: reabierta conserva el acero (densidad, E y nu)
        dens2 = d2.GetWorkbench("SPAWorkbench").Inertias.Add(d2.Product).Density
        prop2 = fem.propiedades(d2.Part)
        d2.Close()
        est.update(x0=x0["nombre"], xl=xl["nombre"])
        return {"volumen": m.get("volume"), "cdg_mm": m.get("cdg_mm"), "densidad": dens, "densidad_reabierta": dens2,
                "propiedades": prop, "propiedades_reabierta": prop2, "cara_empotrada_x": x0["cdg"][0],
                "cara_carga_x": xl["cdg"][0], "cara_empotrada_area": x0["medida"], "cara_carga_area": xl["medida"]}
    salida["viga"] = reg.paso("viga 200 x 20 x 10 de acero y sus dos caras extremas", viga)

    def estatica():
        e = fem.importar(c, pieza)
        e.empotrar([est["x0"]])
        cargada = e.fuerza([est["xl"]], (0.0, 0.0, -F))
        e.malla(*MALLA)
        e.calcular()
        filas = e.exportar(fem.IMG_DESPLAZAMIENTO, reg.carpeta, "desp_estatica")
        punta = [r[5] for r in filas if abs(r[0] - L) < 1e-3]
        e.ad.Close()
        if not punta:
            raise RuntimeError("ningun nodo en x = 200 en el txt de desplazamientos")
        return {"fuerza_cargada": cargada, "malla": list(MALLA), "nodos": len(filas), "nodos_punta": len(punta),
                "flecha_mm": round(-sum(punta) / len(punta), 5), "c3_punta_min": round(min(punta), 6),
                "c3_punta_max": round(max(punta), 6)}
    salida["estatica"] = reg.paso("estatica: empotrada en x 0, 100 N en -Z en x 200, malla parabolica 2,5 mm", estatica)

    def frecuencias():
        e = fem.importar(c, pieza, "FrequencySet")
        e.empotrar([est["x0"]])
        e.malla(*MALLA)
        e.calcular()
        modos = e.frecuencias(os.path.join(reg.carpeta, "informe_frecuencias"))
        e.ad.Close()
        return {"malla": list(MALLA), "modos_Hz": modos[:4]}
    salida["frecuencias"] = reg.paso("frecuencias: empotrada en x 0, sin cargas", frecuencias)


def comparar(s):
    """Lo que no cierra contra la cuenta. Lista vacia = bien."""
    malos = []

    def cerca(a, b, tol):
        """«bien si |a - b| <= tol»: un NaN, un None o un texto dan False (revisor del 41)."""
        try:
            return abs(float(a) - float(b)) <= tol
        except (TypeError, ValueError):
            return False
    v = s.get("viga") or {}
    p = v.get("propiedades_reabierta") or {}
    try:
        leido = {"E_pa": numero(next(x for k, x in p.items() if "Young" in k)),
                 "nu": numero(next(x for k, x in p.items() if "Poisson" in k)),
                 "rho": numero(next(x for k, x in p.items() if "Density" in k))}
    except (StopIteration, ValueError):
        leido = {}
        malos.append(f"sin las propiedades del material de la pieza reabierta: {p}")
    s["material_leido"] = leido
    for k, val in ACERO.items():
        if leido and not cerca(leido[k], val, 1e-6 * abs(val)):
            malos.append(f"material: {k} {leido[k]} y el acero es {val}")
    if not cerca(v.get("densidad_reabierta"), ACERO["rho"], 1e-3):
        malos.append(f"la pieza reabierta no conserva el acero (densidad {v.get('densidad_reabierta')})")
    if not cerca(v.get("volumen"), B * H * L, 0.5):
        malos.append(f"viga de {v.get('volumen')} mm3 y no {B * H * L:.0f}")
    if not (cerca(v.get("cara_empotrada_x"), 0.0, 1e-3) and cerca(v.get("cara_carga_x"), L, 1e-3)):
        malos.append(f"caras extremas en x {v.get('cara_empotrada_x')} y {v.get('cara_carga_x')}")
    if not (cerca(v.get("cara_empotrada_area"), B * H, 1e-3) and cerca(v.get("cara_carga_area"), B * H, 1e-3)):
        malos.append(f"caras extremas de {v.get('cara_empotrada_area')} y {v.get('cara_carga_area')} mm2 y no {B * H:g}"
                     " (una cara partida)")
    # la cuenta con el acero del ejercicio (no con lo leido: un material mal tambien da la flecha mal)
    d_cuenta = flecha_timoshenko(ACERO["E_pa"] / 1e6, ACERO["nu"])
    f_cuenta = frecuencias_euler(ACERO["E_pa"], ACERO["rho"])
    s["cuenta"] = {"flecha_timoshenko_mm": round(d_cuenta, 5), "f1_Hz": round(f_cuenta[0], 2), "f2_Hz": round(f_cuenta[1], 2)}
    st = s.get("estatica") or {}
    d = st.get("flecha_mm")
    if cerca(d, d_cuenta, TOL_REL * d_cuenta):
        s["dif_flecha_%"] = round(100 * (d - d_cuenta) / d_cuenta, 3)
    else:
        malos.append(f"flecha {d} mm y la cuenta da {d_cuenta:.5f}")
    try:
        n_punta = int(st.get("nodos_punta"))
    except (TypeError, ValueError):
        n_punta = 0
    if n_punta < 100:
        malos.append(f"{n_punta} nodos en la punta: la malla parabolica de 2,5 mm da 153 (10 mm daba 25)")
    if not cerca(st.get("c3_punta_max"), st.get("c3_punta_min"), 1e-3):
        malos.append(f"la punta no baja pareja: C3 de {st.get('c3_punta_min')} a {st.get('c3_punta_max')} mm (carga en "
                     "media cara)")
    modos = (s.get("frecuencias") or {}).get("modos_Hz") or []
    if len(modos) < 2:
        malos.append(f"modos: {modos}")
    else:
        s["dif_frecuencias_%"] = []
        for (n, hz), fc in zip(modos[:2], f_cuenta):
            if cerca(hz, fc, TOL_REL * fc):
                s["dif_frecuencias_%"].append(round(100 * (hz - fc) / fc, 3))
            else:
                malos.append(f"modo {n}: {hz} Hz y la cuenta da {fc:.2f}")
    return malos


def cerrar_con_cuenta(carpeta):
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
    s["ok_cuenta"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_FEM", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "dif_flecha_%": s.get("dif_flecha_%"),
                                 "dif_frecuencias_%": s.get("dif_frecuencias_%"), "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_cuenta(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con la cuenta:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
