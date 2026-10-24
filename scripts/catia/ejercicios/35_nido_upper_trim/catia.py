# -*- coding: utf-8 -*-
"""Ejercicio 35 del banco de CATIA (COLA_CATIA.md, fase 3: disenos reales de Barack, pedido 9 de la principal, 24/10/2026,
CATA): nido que copia el panel del CLIENTE del Upper Trim, un bloque menos el panel, con interseccion 0 y distancia ~0
medidas por OpenCASCADE (otro motor) sobre el STEP que exporta CATIA y el del panel.

Origen: ej24_nido_cliente.py de la practica del 19/10/2026 (C:\\Dev\\_catia_practica de la PC principal, copiado a CATA por
el PEDIDO 26 a «para CATA - practica 19-10»). Cambios, nada mas: 1) el panel es la copia verificada del ejercicio 33
(misma ruta, mismo sha256, abierta desde la carpeta de trabajo: la pieza del cliente no entra al repo); 2) el STEP del nido,
la captura y el CATPart los hace cerrar_parte del juez comun (oculta el cuerpo del panel antes de exportar, como el ej24);
3) el control es `choque_exacto.py` de la skill cad-design (el mismo de la practica, versionado en el repo) y corre en el
post-proceso, no como paso; 4) sin correr() ni __main__ de la practica (lo arma correr_ejercicio).

El juez (cerrar_con_choque): veredicto «toca (luz 0)» de choque_exacto.py (las tres intersecciones con fuzz 1e-4, 1e-3 y
1e-2 a 1e-4 mm3 o menos y la distancia exacta a 1e-4 mm o menos, que es su propio TOL), el volumen del nido de CATIA contra
el de OpenCASCADE sobre el STEP a 0,1 % (tolerancia del ejercicio 33), el bloque de CATIA igual a la cuenta 170 x 58 x 19
y el nido igual al de la practica a TOL_VOL (lo que fija donde esta el bloque).
El gemelo (nido subido 1 mm) y la cantidad de solidos del nido quedan informados: no deciden (LECCIONES.md). con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP del nido y la captura.
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "35_nido_upper_trim"
PARTE = "nido_upper_trim"
# jc.REPO y no la carpeta de este archivo: el paquete del obrero (COLA 3D\obrero) copia ejercicios/ pero no la skill
# (revisor del 35; es el arreglo del juez comun para los 006/007/008 de CATA)
CHOQUE = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "scripts", "catia", "choque_exacto.py")
X0, X1, Y0, Y1, Z0, ALTO = -40.0, 130.0, -29.0, 29.0, -25.0, 19.0     # el bloque del ej24: de z -25 a -6
BLOQUE = (X1 - X0) * (Y1 - Y0) * ALTO                                   # 187 340 mm3
NIDO_PRACTICA = 171459.136      # el mismo nido en la CATIA de la principal, 19/10 (ej24_nido_cliente_registro.json)
TOL_REL = 1e-3                                                          # 0,1 %, la del ejercicio 33
SEG_CHOQUE = 900                # el obrero corta a 1 200 s (obrero.py --timeout-seg); el choque tardo 205 y 521 s


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


P33 = cargar("ej33_panel_catia", os.path.join(os.path.dirname(AQUI), "33_panel_upper_trim", "catia.py"))


def construir(cb, c, reg, salida):
    origen = P33.ruta_panel()
    salida["panel"] = {"origen": origen, "sha256_esperado": P33.SHA256}
    est = {}

    def abrir_y_copiar():
        copia = os.path.join(reg.carpeta, "panel_copia.step")
        shutil.copyfile(origen, copia)
        h = P33.sha256(copia)                       # se verifica la COPIA, que es lo que abre CATIA y mide el juez
        salida["panel"]["sha256"] = h
        if h != P33.SHA256:
            raise RuntimeError(f"el STEP del panel no es el esperado (sha256 {h})")
        c.Documents.Open(copia)
        dp = c.ActiveDocument                       # Documents.Open no expone Part a pywin32 (catia.md)
        sel = dp.Selection
        sel.Clear()
        sel.Add(dp.Part.MainBody)
        sel.Copy()
        sel.Clear()
        est["dp"] = dp
        return {"copia": copia}

    if reg.paso("abrir la copia del panel (sha256 verificado) y copiar su cuerpo", abrir_y_copiar) is None:
        return
    doc, part, body, sf = cb.nueva_pieza(c, "nido_cliente")

    def bloque():
        pl = part.HybridShapeFactory.AddNewPlaneOffset(cb.ref(part, part.OriginElements.PlaneXY), Z0, False)
        body.InsertHybridShape(pl)
        est["plano"] = pl
        part.Update()
        sk = body.Sketches.Add(cb.ref(part, pl))
        f = sk.OpenEdition()
        cb.poligono(f, [(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, ALTO)                # de z -25 a -6: se mete en la zona del panel
        part.Update()
        if cb.medir(doc, part, body).get("cdg_mm", [0, 0, 0])[2] < Z0:
            pad.DirectionOrientation = 1
            part.Update()
        m = cb.medir(doc, part, body)
        salida["bloque_catia"] = m["volume"]
        return m

    if reg.paso("bloque 170 x 58 x 19 debajo del panel", bloque) is None:
        return

    def restar():
        s2 = doc.Selection
        s2.Clear()
        s2.Add(part)
        s2.PasteSpecial("CATPrtResultWithOutLink")
        s2.Clear()
        panel = part.Bodies.Item(part.Bodies.Count)
        part.Update()
        part.InWorkObject = body
        sf.AddNewRemove(panel)
        part.Update()
        est["panel"] = panel
        v = cb.medir(doc, part, body)["volume"]
        return {"bloque": salida["bloque_catia"], "nido": v, "saco_la_huella": round(salida["bloque_catia"] - v, 3)}

    if reg.paso("restarle el panel pegado sin vinculo", restar) is None:
        return
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE, ocultos=(est["panel"], est["plano"]))
    for d in (est["dp"], doc):
        try:
            d.Close()
        except Exception as e:  # noqa: BLE001
            salida.setdefault("documentos_sin_cerrar", []).append(repr(e)[:200])


def correr_choque(nido, panel, correr=subprocess.run):
    """choque_exacto.py de la skill con .venv-cad (en la practica tardo 521 s: tres booleanos y la distancia)."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    if not os.path.isfile(CHOQUE):
        return {"error": f"no esta choque_exacto.py ({CHOQUE})"}
    try:
        r = correr([jc.VENV_CAD, "-I", CHOQUE, nido, panel, "1.0"], capture_output=True, text=True, timeout=SEG_CHOQUE)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"choque_exacto.py no corrio: {ex!r}"[:300]}


def cerrar_con_choque(carpeta, choque=None):
    """Despues de correr_ejercicio (con_bien=False): el nido de CATIA contra la copia del panel, con OpenCASCADE."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    problemas, juez = [], {}
    sub = os.path.join(carpeta, EJ)
    ch = (choque or correr_choque)(os.path.join(sub, PARTE + ".stp"), os.path.join(sub, "panel_copia.step"))
    s["choque_exacto"] = ch
    juez["veredicto"] = ch.get("veredicto")
    if juez["veredicto"] != "toca (luz 0)":
        problemas.append(f"choque_exacto.py no da «toca (luz 0)»: {ch.get('veredicto') or ch.get('error') or ch}")
    vc, vo = (s.get("volumen_catia") or {}).get(PARTE), ch.get("vol_utillaje")
    juez.update({"nido_catia": vc, "nido_opencascade": vo, "bloque_catia": s.get("bloque_catia"), "bloque_cuenta": BLOQUE,
                 "solidos_nido": ch.get("solidos_utillaje"), "gemelo_subido_1mm": ch.get("gemelo_subido_1.0_interseccion")})
    if not isinstance(vc, (int, float)) or not isinstance(vo, (int, float)) or abs(vc - vo) > TOL_REL * abs(vo):
        problemas.append(f"el nido de CATIA ({vc}) no da el volumen del STEP en OpenCASCADE ({vo})")
    b = s.get("bloque_catia")
    if not isinstance(b, (int, float)) or abs(b - BLOQUE) > jc.TOL_VOL:
        problemas.append(f"el bloque de CATIA ({b}) no es 170 x 58 x 19 = {BLOQUE}")
    elif isinstance(vc, (int, float)):
        juez["huella_catia"] = round(b - vc, 3)
    # el volumen del bloque no fija DONDE esta: el nido de la practica si (un bloque corrido toca otra parte del panel)
    juez["nido_practica"] = NIDO_PRACTICA
    if not isinstance(vc, (int, float)) or abs(vc - NIDO_PRACTICA) > jc.TOL_VOL:
        problemas.append(f"el nido de CATIA ({vc}) no es el de la practica ({NIDO_PRACTICA})")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CHOQUE", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_choque(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar el choque en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
