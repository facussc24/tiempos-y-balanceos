# -*- coding: utf-8 -*-
"""Ejercicio 43 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): el gancho de encastre (snap-fit) del manual de
Bayer, ejemplo I: brazo de seccion rectangular con el espesor que baja de h = 3,28 mm en la raiz a h/2 en la punta, largo
l = 19 mm, ancho b = 9,5 mm, PC con modulo secante 1 815 N/mm2. Se hace en Part Design (trapecio en el plano ZX, pad b en
Y) y se simula en CATIA (Generative Structural Analysis, fem.py de la skill cad-design): empotrado en la raiz, 32,5 N en
la cara de la punta, malla parabolica de 0,5 mm; flecha = promedio de C3 de los nodos de la punta.
Metodo y numeros de la practica del 19/10 (ej68_gancho_bayer.py, banco E7): 2,3967 mm con 0,5 mm de malla.

Respuesta conocida:
- el PAPEL: Bayer, «Snap-Fit Joints for Plastics», ejemplo de calculo I, pag. 16 de 26 (PDF en fab.cba.mit.edu, banco E7
  de la practica): con el socavado y = 2,4 mm sale h = 1,09 e l^2 / y = 3,28 mm (e = 2 %) y P = (b h^2 / 6)(Es e / l) =
  32,5 N; el ejercicio lo invierte: con h y P, la punta tiene que bajar 2,4 mm;
- la cuenta de la viga de espesor variable por Castigliano (Euler-Bernoulli, SIN el corte: con Timoshenko daria
  2,4429, +1,9 %; que el 3D coincida con Euler-Bernoulli a 0,007 % no se explico): y = integral P (l - x)^2 /
  (E b h(x)^3 / 12) dx = 2,3969 mm. Gemelo: el mismo brazo de espesor h constante daria 1,4655 mm (-39 %).
Supuestos que el papel no da: nu 0,266 (queda el del acero; el PC anda por 0,37) y rho 1 200 (la estatica no la usa).
Tolerancia 1,5 %, como el 41 (la pieza 3D empotrada en una cara no es la viga de la teoria; lo que se caza da 10 % o mas:
espesor constante -39 %, el trapecio dado vuelta +183 %). Ademas la geometria: volumen (h0 + h1)/2 l b = 444,03 mm3 y el
centro de gravedad en x = l (h0 + 2 h1) / (3 (h0 + h1)) = 8,444 mm (dado vuelta daria 10,556: el volumen no lo ve), en y
= b/2 = 4,75 y en z = (h0^2 + h0 h1 + h1^2) / (3 (h0 + h1)) = 1,2756; el material de la pieza con E 1 815 N/mm2; y la punta
que baja pareja (max - min de C3 <= 0,05 mm: el efecto anticlastico da 0,021 entre el centro y los bordes, revisor del 43).

ok = los pasos sin falla y sin error del juez Y volumen y centro a 0,5 mm3 y 0,01 mm Y E de la pieza 1,815e9 N/m2 Y una
cara de raiz y una de punta Y la punta pareja Y la flecha a 1,5 % de la cuenta Y a 1,5 % del papel.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, la CATPart y el txt de desplazamientos.
"""
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "43_gancho_bayer"
L, B, H0, E_MPA, P = 19.0, 9.5, 3.28, 1815.0, 32.5
H1 = H0 / 2
PAPEL_MM = 2.4                                   # Bayer, ejemplo I, pag. 16
TOL_REL = 0.015
TOL_CDG_MM = 0.01
TOL_PUNTA_MM = 0.05                      # anticlastico medido: 0,021 mm entre el centro y los bordes (revisor del 43)
MALLA = ("Parabolic", "0.5mm")


def fem_de_la_skill():
    d = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "scripts", "catia")
    if d not in sys.path:
        sys.path.append(d)                         # al final: catia_base es el del juez (scripts/catia)
    import fem
    return fem


def flecha_exacta(n=20000):
    """Castigliano sobre la viga de espesor lineal (punto medio, 20 000 tramos: la integral converge a 1e-8)."""
    s = 0.0
    for i in range(n):
        x = (i + 0.5) * L / n
        h = H0 + (H1 - H0) * x / L
        s += P * (L - x) ** 2 / (E_MPA * B * h ** 3 / 12) * (L / n)
    return s


def flecha_espesor_constante():
    return P * L ** 3 / (3 * E_MPA * B * H0 ** 3 / 12)


def volumen_cuenta():
    return (H0 + H1) / 2 * L * B


def x_centro_cuenta():
    return L * (H0 + 2 * H1) / (3 * (H0 + H1))


def z_centro_cuenta():
    """Centro del trapecio en el espesor: (1/2) integral h^2 / integral h = (h0^2 + h0 h1 + h1^2) / (3 (h0 + h1))."""
    return (H0 ** 2 + H0 * H1 + H1 ** 2) / (3 * (H0 + H1))


def construir(cb, c, reg, salida):
    fem = fem_de_la_skill()
    c.DisplayFileAlerts = False
    ruta = os.path.join(reg.carpeta, "gancho_bayer.CATPart")
    est = {}

    def pieza():
        doc, part, body, sf = cb.nueva_pieza(c, "gancho_bayer")
        sk = body.Sketches.Add(cb.ref(part, part.OriginElements.PlaneZX))   # H = Z, V = X (ej68)
        f = sk.OpenEdition()
        q = [(0.0, 0.0), (0.0, L), (H1, L), (H0, 0.0)]
        for i in range(4):
            a, b = q[i], q[(i + 1) % 4]
            f.CreateLine(a[0], a[1], b[0], b[1])
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, B)
        part.Update()
        m = cb.medir(doc, part, body)
        caras = [d for d in cb.topologia(doc, body, "Face") if "cdg" in d]
        est["raiz"] = [d["nombre"] for d in caras if abs(d["cdg"][0]) < 1e-3]
        est["punta"] = [d["nombre"] for d in caras if abs(d["cdg"][0] - L) < 1e-3]
        fem.poner_acero(c, doc)
        leido = fem.material_propio(part, E_MPA * 1e6, 1200)
        try:
            cap = jc.captura_bmp(c, reg.carpeta, "gancho")
            salida["archivos"].append(os.path.relpath(cap, salida["_carpeta"]))
        except Exception:  # noqa: BLE001
            pass
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.SaveAs(ruta)                            # a un archivo NUEVO: «Guardar» no conservaba el material (ej58)
        doc.Close()
        d2 = c.Documents.Open(ruta)
        e_reabierta = fem.propiedades(d2.Part)
        d2.Close()
        return {"volumen": m.get("volume"), "cdg_mm": m.get("cdg_mm"), "caras_raiz": len(est["raiz"]),
                "caras_punta": len(est["punta"]), "material": leido, "material_reabierta": e_reabierta}
    salida["pieza"] = reg.paso("gancho de espesor variable en Part Design, E 1 815 N/mm2", pieza)

    def simular():
        if len(est.get("raiz", [])) != 1 or len(est.get("punta", [])) != 1:
            raise RuntimeError(f"caras raiz/punta: {est.get('raiz')} / {est.get('punta')}")
        e = fem.importar(c, ruta)
        e.empotrar(est["raiz"])
        cargada = e.fuerza(est["punta"], (0.0, 0.0, -P))
        e.malla(*MALLA)
        e.calcular()
        filas = e.exportar(fem.IMG_DESPLAZAMIENTO, reg.carpeta, "desp_gancho")
        punta = [r[5] for r in filas if abs(r[0] - L) < 1e-3]
        e.ad.Close()
        if not punta:
            raise RuntimeError("ningun nodo en la punta en el txt de desplazamientos")
        return {"fuerza_cargada": cargada, "malla": list(MALLA), "nodos": len(filas), "nodos_punta": len(punta),
                "flecha_mm": round(-sum(punta) / len(punta), 5), "c3_punta_min": round(min(punta), 6),
                "c3_punta_max": round(max(punta), 6)}
    salida["simulacion"] = reg.paso("32,5 N en la punta, empotrado en la raiz, malla parabolica 0,5 mm", simular)


def numero(texto):
    t = str(texto).replace(",", ".")
    k = 0
    while k < len(t) and (t[k].isdigit() or t[k] in ".eE+-"):
        k += 1
    return float(t[:k])


def comparar(s):
    malos = []
    p = s.get("pieza") or {}
    v, cdg = p.get("volumen"), p.get("cdg_mm") or []
    try:
        ok_vol = abs(float(v) - volumen_cuenta()) <= 0.5
    except (TypeError, ValueError):
        ok_vol = False
    if not ok_vol:
        malos.append(f"volumen {v} mm3 y la cuenta da {volumen_cuenta():.3f}")
    try:
        ok_x = len(cdg) == 3 and abs(float(cdg[0]) - x_centro_cuenta()) <= TOL_CDG_MM
        ok_yz = len(cdg) == 3 and abs(float(cdg[1]) - B / 2) <= TOL_CDG_MM and abs(float(cdg[2]) - z_centro_cuenta()) <= TOL_CDG_MM
    except (TypeError, ValueError):
        ok_x = ok_yz = False
    if not ok_x:
        malos.append(f"centro en x {cdg[:1]} y la cuenta da {x_centro_cuenta():.4f} (el trapecio dado vuelta da "
                     f"{L - x_centro_cuenta():.4f})")
    if not ok_yz:
        malos.append(f"centro en y, z {cdg[1:]} y la cuenta da {B / 2}, {z_centro_cuenta():.4f}")
    if (p.get("caras_raiz"), p.get("caras_punta")) != (1, 1):
        malos.append(f"caras de raiz y de punta: {p.get('caras_raiz')} / {p.get('caras_punta')}")
    try:
        e_leido = numero(next(x for k, x in (p.get("material_reabierta") or {}).items() if "Young" in k))
    except (StopIteration, ValueError):
        e_leido = None
    if e_leido is None or not abs(e_leido - E_MPA * 1e6) <= 1e-6 * E_MPA * 1e6:
        malos.append(f"E de la pieza reabierta {e_leido} y no {E_MPA * 1e6:.4g} N/m2")
    sim = s.get("simulacion") or {}
    try:
        pareja = abs(float(sim.get("c3_punta_max")) - float(sim.get("c3_punta_min"))) <= TOL_PUNTA_MM
    except (TypeError, ValueError):
        pareja = False
    if not pareja:
        malos.append(f"la punta no baja pareja: C3 de {sim.get('c3_punta_min')} a {sim.get('c3_punta_max')} mm")
    y = sim.get("flecha_mm")
    ye = flecha_exacta()
    s["cuenta"] = {"exacta_mm": round(ye, 4), "papel_mm": PAPEL_MM, "espesor_constante_mm": round(flecha_espesor_constante(), 4)}
    try:
        y = float(y)
    except (TypeError, ValueError):
        y = float("nan")
    s["dif_flecha_%"] = {"exacta": round(100 * (y - ye) / ye, 3) if y == y else None,
                         "papel": round(100 * (y - PAPEL_MM) / PAPEL_MM, 3) if y == y else None}
    if not abs(y - ye) <= TOL_REL * ye:
        malos.append(f"flecha {y} mm y la cuenta exacta da {ye:.4f}")
    if not abs(y - PAPEL_MM) <= TOL_REL * PAPEL_MM:
        malos.append(f"flecha {y} mm y el papel dice {PAPEL_MM}")
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
    print("FIN_BAYER", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "dif_flecha_%": s.get("dif_flecha_%"),
                                   "malos": malos}))
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
