# -*- coding: utf-8 -*-
"""Ejercicio 15 del banco de CATIA (cola del 24/10/2026): las preguntas 1 y 2 del examen de muestra «CATIA V5 Associate -
Part Design (PDG) Sample Exam» (Dassault Systemes), que son de PLANOS (Drafting), sobre el Tool Block de la pregunta 3.

Lamina 03 (preguntas) y lamina 12 (respuestas): para crear la vista B dibujando un perfil sobre la vista A hace falta
  1. «b) Clipping View Profile»  -> en CATIA por programa: DrawingViewGenerativeBehavior.DefinePolygonalClippingView
  2. «c) Breakout View»          -> DrawingViewGenerativeBehavior.DefineBreakout
(nombres de los metodos: la ayuda de automatizacion de CATIA V5, interface DrawingViewGenerativeBehavior).

Pieza: la q3 parametrica del ejercicio 11 (mismo croquis restringido: croquis() y dibujar_y_restringir() del 11 se
reusan), cruzada con build123d (bien.py del 13, parte q3). Plano A3 apaisado: frente (el perfil de la lamina 04, mirando
desde +Z), costado (proyeccion a la derecha), isometrica, «Recorte» (una copia del FRENTE con un recorte poligonal alrededor
de la orejeta: en la lamina 03 el perfil se dibuja sobre la ISOMETRICA; por programa va en coordenadas de la vista, que
en el frente son las de la pieza) y «Arranque» (la proyeccion a la derecha del Recorte, o sea un costado, con un
arranque hasta el plano x 14, el eje del agujero de 14);
GenerateDimensions saca las cotas de las restricciones del croquis; PDF y PNG.

ok = cruce de la q3 con build123d (juez_comun) Y las dos vistas del examen creadas Y MEDIDAS en el PDF (el recorte no pasa de 46 mm de ancho
contra los 81 del frente; el arranque tiene 8 trazos o mas que el costado: el rayado) Y entre las cotas generadas
estan las que GenerateDimensions puede traer de ese croquis: los cuatro radios (19, 29, 5 y el 7 del agujero de 14), el
angulo de 10 grados (CATIA lo devuelve en RADIANES: 0,175) y el largo C del pad Y el PDF existe.
Medido el 24/10 10:05: las DISTANCIAS a los ejes del croquis no las genera (se apoyan en el eje propio del croquis, que no
tiene geometria en la vista); para tener la acotacion de la lamina 04 (14, 7 x 45, 32, 29, 24, 5, 19, A, B) el croquis
tendria que acotarse contra la geometria, como en el examen: queda anotado en salida.json («cotas_lamina_04»). Que el
recorte y el arranque se vean como en el examen se mira en el PNG (24/10 10:05: recorte con la orejeta y el agujero;
arranque por el eje del agujero, con el hueco entre dos franjas rayadas).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, STEP, BMP, PDF y PNG del plano.
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
sys.path.insert(0, os.path.dirname(EJERCICIOS))                    # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "13_examen_catia_associate"
NOMBRE = "tool_block_q3_plano"
A, B, C = 81.0, 57.0, 43.0                    # lamina 05 (pregunta 3)
A3, APAISADO = 5, 1                           # CatPaperSize, CatPaperOrientation (ej44 de la practica)
X_AGUJERO = 14.0                              # el eje del agujero de 14 (lamina 04): el plano del arranque
RESPUESTAS = {"pregunta_1": ("b) Clipping View Profile", "DefinePolygonalClippingView"),
              "pregunta_2": ("c) Breakout View", "DefineBreakout")}           # lamina 12
# las cotas de la lamina 04 (q3) y la que las representa en el plano generado; None = la genera solo un croquis acotado
# contra la geometria (el del 11 acota por coordenadas)
COTAS_LAMINA_04 = {"R19": 19.0, "R29": 29.0, "R5": 5.0, "diametro 14 (sale como R7)": 7.0, "10 grados": None,
                   "C (lamina 05: 43)": 43.0, "14": None, "7 x 45": None, "32": None, "29": None, "24": None,
                   "5 x 45": None, "19": None, "A (81)": None, "B (57)": None}
TOL_COTA = 1e-3
p2_ANGULO = 10.0                              # la recta de 10 grados de la lamina 04 (perfil_2d.ANGULO_10)
REGIONES = {"Frente": [20, 125, 140, 215], "Recorte": [20, 15, 140, 105], "Costado": [140, 125, 260, 215],
            "Arranque": [140, 15, 260, 105]}         # mm de la hoja alrededor de cada vista (cada una centrada en su X, Y)


def _cargar(carpeta, nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(EJERCICIOS, carpeta, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cotas_que_se_generan(ej11):
    """Lo que tiene que quedar en el plano del croquis del 11 en la q3: los radios y el largo C del pad. Las distancias a
    los ejes del croquis GenerateDimensions no las trae, y el angulo de 10 grados se borra (cruza la hoja): medido el
    24/10 10:05, una sola corrida (la expectativa sale de esa medicion; lo independiente es el texto en el PDF)."""
    cr = ej11.croquis(A, B)["restricciones"]
    return sorted([round(r_[2], 3) for r_ in cr if r_[0] == "radio"] + [C])


def faltan(esperadas, generadas):
    """Las esperadas que no estan entre las generadas (multiconjunto: si el croquis tiene dos 51, el plano trae dos)."""
    resto = list(generadas)
    out = []
    for v in esperadas:
        i = next((k for k, g in enumerate(resto) if abs(g - v) <= TOL_COTA), None)
        if i is None:
            out.append(v)
        else:
            resto.pop(i)
    return out


def construir(cb, c, reg, salida, ej11=None):
    ej11 = ej11 or _cargar("11_tool_block_parametrico", "ej11_catia")
    ej11._cargar_07().renombrar_build123d(salida)
    for q in ("q4", "q5", "q6"):
        if q in salida["volumen_build123d"]:
            salida.setdefault("build123d_aparte", {})[q] = {"volumen": salida["volumen_build123d"].pop(q),
                                                             "cdg_mm": salida["cdg_build123d_mm"].pop(q, None)}
    salida.update({"examen": {}, "vistas": {}, "cotas_generadas": [], "cotas_esperadas": cotas_que_se_generan(ej11)})
    cr = ej11.croquis(A, B)
    doc, part, body, sf = cb.nueva_pieza(c, NOMBRE)
    est = {}

    def pieza():
        pm = part.Parameters
        for k, v in zip("ABC", (A, B, C)):
            pm.CreateDimension(k, "LENGTH", v)
        sk = body.Sketches.Add(cb.ref(part, part.OriginElements.PlaneXY))
        _obj, creadas, relectura = ej11.dibujar_y_restringir(cb, part, sk, cr)
        if [r_ for r_ in relectura if not r_["ok"]]:
            raise RuntimeError(f"cotas que CATIA mide distinto del plano: {relectura}")
        for i, (r_, c_) in enumerate(creadas):
            if r_[0] in ("x", "y") and r_[3]:
                part.Relations.CreateFormula(f"perfil_{i}", "", c_.Dimension, r_[3])
        pd = sf.AddNewPad(sk, C)
        part.Relations.CreateFormula("largo_C", "", pd.FirstLimit.Dimension, "C")
        part.Update()
        m = cb.medir(doc, part, body)
        if m["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
            m = cb.medir(doc, part, body)
        st = ej11.estados_restricciones(creadas)
        if any(s != 0 for s in st):
            raise RuntimeError(f"restricciones sin resolver: {st}")
        return {"vol": m["volume"], "cdg_z": m["cdg_mm"][2], "restricciones": len(creadas)}
    if reg.paso("la q3 parametrica del ejercicio 11 (croquis restringido + pad C)", pieza) is None:
        return
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, NOMBRE, "q3")

    def plano():
        drw = c.Documents.Add("Drawing")
        est["drw"] = drw
        hoja = drw.Sheets.ActiveSheet
        hoja.PaperSize, hoja.Orientation, hoja.Scale = A3, APAISADO, 1.0
        vs = hoja.Views

        def vista(nombre, x, y, esc=1.0):
            v = vs.Add(nombre)
            v.X, v.Y, v.Scale = x, y, esc
            g = v.GenerativeBehavior
            g.Document = doc.Product
            return v, g
        fre, gf = vista("Frente", 80.0, 170.0)
        gf.DefineFrontView(1.0, 0.0, 0.0, 0.0, 1.0, 0.0)          # mirando desde +Z: X a la derecha, Y arriba
        gf.Update()
        cos, gc = vista("Costado", 200.0, 170.0)
        gc.DefineProjectionView(gf, 0)                             # a la derecha (CatProjViewType 0)
        gc.Update()
        iso, gi = vista("Isometrica", 330.0, 200.0, 0.8)
        gi.DefineIsometricView(-0.707, 0.707, 0.0, -0.408, -0.408, 0.816)
        gi.Update()
        rec, gr = vista("Recorte", 80.0, 60.0)
        gr.DefineFrontView(1.0, 0.0, 0.0, 0.0, 1.0, 0.0)
        ark, ga = vista("Arranque", 200.0, 60.0)
        ga.DefineProjectionView(gr, 0)
        for nombre, que, hacer, g in (
                ("pregunta_1", "Recorte", lambda: gr.DefinePolygonalClippingView([-5.0, 12.0, 40.0, 12.0, 40.0, 58.0,
                                                                                   -5.0, 58.0]), gr),
                ("pregunta_2", "Arranque", lambda: ga.DefineBreakout([-200.0, 22.0, 200.0, 22.0, 200.0, 44.0, -200.0, 44.0],
                                                                     [X_AGUJERO, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
                                                                     [X_AGUJERO, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]),
                 ga)):
            respuesta, metodo = RESPUESTAS[nombre]
            try:
                hacer()
                g.Update()
                salida["examen"][nombre] = {"respuesta_lamina_12": respuesta, "metodo": metodo, "vista": que, "ok": True}
            except Exception as e:  # noqa: BLE001
                salida["examen"][nombre] = {"respuesta_lamina_12": respuesta, "metodo": metodo, "vista": que,
                                            "ok": False, "error": repr(e)[:200]}
        try:
            hoja.GenerateDimensions()
        except Exception as e:  # noqa: BLE001
            salida["cotas_error"] = repr(e)[:200]
        # la cota de 10 grados se apoya en el eje propio del croquis: sale con su linea cruzando toda la hoja y su texto
        # no aparece en el PDF (revisor del 15, 24/10): se borra y queda anotada
        salida["cotas_borradas"] = []
        for i in range(1, vs.Count + 1):
            v = vs.Item(i)
            for k in range(v.Dimensions.Count, 0, -1):
                try:
                    val = float(v.Dimensions.Item(k).GetValue().Value)
                except Exception:  # noqa: BLE001
                    continue
                if abs(val - math.radians(p2_ANGULO)) < 1e-3:
                    sel = drw.Selection
                    sel.Clear()
                    sel.Add(v.Dimensions.Item(k))
                    sel.Delete()
                    salida["cotas_borradas"].append({"vista": v.Name, "valor_rad": round(val, 4),
                                                     "por": "angulo de 10 grados contra el eje del croquis: cruza la hoja"})
        valores = []
        for i in range(1, vs.Count + 1):
            v = vs.Item(i)
            vals = []
            for k in range(1, v.Dimensions.Count + 1):
                try:
                    vals.append(round(float(v.Dimensions.Item(k).GetValue().Value), 3))
                except Exception:  # noqa: BLE001
                    pass
            salida["vistas"][v.Name] = {"cotas": vals}
            valores += vals
        salida["cotas_generadas"] = sorted(valores)
        ruta = os.path.join(reg.carpeta, NOMBRE + ".pdf")
        if os.path.exists(ruta):
            os.remove(ruta)
        drw.ExportData(ruta, "pdf")
        cb.exigir_archivo(ruta, f"exportar {NOMBRE}.pdf")
        salida["archivos"].append(os.path.relpath(ruta, salida["_carpeta"]))
        png = os.path.join(reg.carpeta, NOMBRE + ".png")
        r = subprocess.run([jc.VENV_CAD, "-I", "-c", f"import pymupdf; d=pymupdf.open(r'{ruta}'); "
                            f"d[0].get_pixmap(dpi=110).save(r'{png}')"], capture_output=True, text=True)
        if os.path.isfile(png):
            salida["archivos"].append(os.path.relpath(png, salida["_carpeta"]))
        else:
            salida["png_error"] = (r.stderr or r.stdout)[-200:]
        return {"vistas": vs.Count, "cotas": len(valores), "examen": {k: v["ok"] for k, v in salida["examen"].items()}}
    reg.paso("plano A3: frente, costado, isometrica, recorte (pregunta 1), arranque (pregunta 2), cotas y PDF", plano)


def cerrar_con_plano(carpeta, medir_pdf=None):
    """`medir_pdf(pdf, regiones_json)` devuelve lo que imprime medir_plano.py (se cambia en la prueba sin CATIA)."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    malos = [f"{k}: {v.get('error', 'sin hacer')}" for k, v in (s.get("examen") or {}).items() if not v.get("ok")]
    if set(s.get("examen") or {}) != set(RESPUESTAS):
        malos.append(f"preguntas sin hacer: {sorted(set(RESPUESTAS) - set(s.get('examen') or {}))}")
    falta = faltan(s.get("cotas_esperadas") or [], s.get("cotas_generadas") or [])
    s["cotas_esperadas_que_faltan_en_el_plano"] = falta
    if not s.get("cotas_esperadas") or falta:
        malos.append(f"cotas que GenerateDimensions tenia que traer y no estan: {falta}")
    s["cotas_lamina_04"] = {k: ("en el plano" if v is not None and not faltan([v], s.get("cotas_generadas") or [])
                                else "no: el croquis acota por coordenadas (el angulo: se borra, cruza la hoja)")
                          for k, v in COTAS_LAMINA_04.items()}
    pdf = next((os.path.join(carpeta, a) for a in s.get("archivos") or [] if os.path.basename(a).lower() == NOMBRE + ".pdf"),
               "")
    if not os.path.isfile(pdf):
        malos.append("no hay PDF del plano")
    else:
        # lo que se VE en el PDF (revisor del 15: «CATIA no tiro error» no prueba que la vista haga algo)
        reg_json = os.path.join(carpeta, "regiones_plano.json")
        with open(reg_json, "w", encoding="utf-8") as f:
            json.dump(REGIONES, f)
        if medir_pdf is None:
            r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "medir_plano.py"), pdf, reg_json],
                               capture_output=True, text=True, timeout=300)
            medir_pdf = (lambda *_: json.loads(r.stdout.strip().splitlines()[-1]))
        try:
            m = medir_pdf(pdf, reg_json)
        except Exception:  # noqa: BLE001
            m = None
            malos.append("no se pudo medir el PDF (medir_plano.py con .venv-cad)")
        if m:
            s["pdf_medido"] = {k: m[k] for k in ("trazos", "ancho_mm")}
            t, a = m["trazos"], m["ancho_mm"]
            if not (a["Recorte"] <= 46.0 and a["Frente"] >= A):            # el recorte de 45 de ancho, el frente entero
                malos.append(f"pregunta 1: el recorte no recorta (ancho {a['Recorte']} mm; frente {a['Frente']} mm)")
            if t["Arranque"] < t["Costado"] + 8:                            # el rayado y las lineas de rotura
                malos.append(f"pregunta 2: el arranque no muestra el corte ({t['Arranque']} trazos; costado {t['Costado']})")
            palabras = set(m["palabras"])
            sin_texto = [v for v in (s.get("cotas_esperadas") or []) if f"{v:g}" not in palabras]
            s["cotas_sin_texto_en_el_pdf"] = sin_texto
            if sin_texto:
                malos.append(f"cotas que no se leen en el PDF: {sin_texto}")
    s["ok_plano"] = not malos
    s["ok"] = s["ok_cruce_build123d"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PLANO", json.dumps({"ok": s["ok"], "examen": {k: v.get("ok") for k, v in (s.get("examen") or {}).items()},
                                   "faltan": falta, "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_plano(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar el plano:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
