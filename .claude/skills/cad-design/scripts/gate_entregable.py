# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_entregable.py --help
"""GATE DE ENTREGABLE — que Fak pueda ENTENDERLO, no que este documentado.

Por que existe. De las tres entregas rechazadas del dispositivo de adhesivado, dos no
fallaron por el diseno: fallaron por como llegaron.

  * Se entregaron un .txt y un .html explicativos. Fak, textual: "los txt son al pedo...
    lo unico que debes hacer con los 3D es un PDF facil de entender a prueba de boludos".
    -> G-E1, formato.
  * Se entregaron renders hechos con matplotlib: algoritmo del pintor, sin oclusion ni
    sombra, todo del mismo gris. Fak miro 4 capturas y saco 6 preguntas; **5 de las 6 se
    contestaban con una imagen legible**. Textual: "no veo el insert, veo esa cosa
    extrana". -> G-E3, imagen.

Los cuatro checks:

  G-E1  Estan los tres formatos obligatorios: PDF visual + STEP + simulacion grabada.
        Un .txt o un .html NO reemplazan al PDF (pueden ir de anexo).
  G-E2  El PDF y el STEP son de la MISMA corrida: si el STEP se toco despues del PDF, el
        PDF describe un modelo que ya no existe.
  G-E3a El motor de imagen esta DECLARADO y es uno de los aceptados. matplotlib esta en
        la lista de rechazados con su motivo. **Es el unico de los dos que BLOQUEA.**
  G-E3b Sobre los pixeles de los renders declarados: que fraccion del objeto tiene color
        de verdad. Se MIDE y se informa; no bloquea.

SOBRE G-E3b, Y POR QUE NO BLOQUEA. Dos hipotesis mias, las dos caidas contra datos reales
el mismo dia. Queda escrito con los numeros para que nadie las reinvente:

  1. Primero medi el histograma de LUMINANCIA — sin sombras la imagen colapsaria a pocos
     tonos. Al calibrarlo **dio al reves**: el render malo daba 70 tonos para cubrir el
     90 % de los pixeles y los buenos 26-28, porque el malo eran lineas finas con antialias
     y los buenos superficies grandes de color plano. Tirada.
  2. Despues la SATURACION, que con dos muestras malas (0,293 y 0,29) contra cuatro buenas
     (0,42-0,76) parecia separar limpio, y nacio bloqueante con umbral 0,35. Una auditoria
     independiente trajo la tercera muestra mala —`caballete_TODAS.png`, matplotlib, la
     misma masa ilegible— y da **0,353: pasa por 0,003**. Y del otro lado el falso positivo
     que la mata: un render legitimo de foto3d de un dispositivo de **un solo material** (un
     caballete de tubo pintado de un color, que es lo que Barack fabrica) da **0,000** y
     quedaba rechazado.

O sea que como control binario no sirve: dejaba pasar el malo Y frenaba el bueno, y un
control que frena el trabajo bueno se termina desactivando entero. Se queda como MEDICION
informada al lado del render — un numero bajo es una razon para mirar la imagen, no un
veredicto. El que bloquea es G-E3a. Y no se presenta como "detecta matplotlib": no lo hace.

Uso:
    gate_entregable.py --entrega <carpeta> --motor foto3d --render a.png b.png --workdir W

Codigos de salida: 0 OK · 1 falla dura · 2 uso incorrecto.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import workdir  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(AQUI, "procesoCanon.data.json")

OK, FALLA, USO = 0, 1, 2


def canon():
    with open(CANON, "r", encoding="utf-8") as f:
        return json.load(f)


def _archivos(carpeta):
    out = []
    for dirpath, _, filenames in os.walk(carpeta):
        for fn in filenames:
            out.append(os.path.join(dirpath, fn))
    return out


def _por_extension(archivos, exts):
    e = tuple(x.lower() for x in exts)
    return [a for a in archivos if a.lower().endswith(e)]


# =====================================================================================
# G-E3b — cuanto color tiene de verdad la imagen
# =====================================================================================
def croma_del_objeto(path, umbral_pixel):
    """(fraccion con color, pixeles de objeto). Fondo = el tono mediano del BORDE.

    El fondo se estima del borde de la imagen y no de un color fijo a proposito: el motor
    de este skill entrega fondo BLANCO (Fak, 02/09/2026: "necesito verlos bien los modelos
    3D, con fondo blanco"), pero una captura de CAD puede venir con cualquier fondo y el
    check tiene que seguir midiendo el OBJETO.
    """
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(path).convert("RGB"), dtype=float) / 255.0
    L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    borde = np.concatenate([L[0, :], L[-1, :], L[:, 0], L[:, -1]])
    fondo = float(np.median(borde))
    msk = np.abs(L - fondo) > 0.02
    n = int(msk.sum())
    if n < 1000:
        return None, n
    obj = a[msk]
    croma = obj.max(axis=1) - obj.min(axis=1)
    return float((croma > umbral_pixel).mean()), n


# =====================================================================================
# verificacion
# =====================================================================================
def verificar(entrega, motor, renders, workdir_path=None, sin_render=False, motivo_sin_render=None):
    c = canon()
    rojos, avisos = [], []

    def rojo(gate, msg, det=None):
        rojos.append((gate, msg, det))

    if not os.path.isdir(entrega):
        print("[gate_entregable] la carpeta de entrega no existe: %s" % entrega)
        return FALLA

    archivos = _archivos(entrega)
    fmt = c["formatosEntregable"]

    # ---- G-E1: los tres formatos obligatorios ----
    encontrados = {}
    for o in fmt["obligatorios"]:
        hits = _por_extension(archivos, o["extensiones"])
        encontrados[o["id"]] = hits
        if not hits:
            rojo("G-E1", "falta el entregable obligatorio '%s' (%s)"
                 % (o["id"], ", ".join(o["extensiones"])),
                 "%s\n  Fuente: %s" % (o["que"], o["fuente"]))

    # el .txt/.html no reemplaza al PDF — y si no hay PDF, decirlo con el nombre del archivo
    no_explican = _por_extension(archivos, fmt["noExplican"]["extensiones"])
    if no_explican and not encontrados.get("pdf-visual"):
        rojo("G-E1", "no hay PDF y si hay %d archivo(s) de texto haciendo de documento"
             % len(no_explican),
             "\n".join("  - %s" % os.path.basename(x) for x in no_explican) +
             "\n  %s" % fmt["noExplican"]["fuente"])
    elif no_explican:
        avisos.append("hay %d archivo(s) .txt/.html en la entrega — de anexo esta bien, "
                      "de documento no (%s)" % (len(no_explican),
                                                ", ".join(os.path.basename(x) for x in no_explican)))

    # ---- G-E2: PDF y STEP de la misma corrida ----
    pdfs, steps = encontrados.get("pdf-visual") or [], encontrados.get("modelo-3d") or []
    if pdfs and steps:
        # Contra el PDF mas VIEJO, no el mas nuevo (ROB-11 de la auditoria del 02/09). Con
        # max() un segundo PDF fresco —un plano, una caratula— tapaba a un informe viejo, y
        # en una entrega real siempre hay 2 o mas PDFs: era el caso normal, no el raro.
        pdf_old = min(os.path.getmtime(p) for p in pdfs)
        viejo = min(pdfs, key=os.path.getmtime)
        step_new = max(os.path.getmtime(p) for p in steps)
        if step_new > pdf_old + 1.0:
            rojo("G-E2", "el STEP es %.0f min mas nuevo que '%s'"
                 % ((step_new - pdf_old) / 60.0, os.path.basename(viejo)),
                 "Ese PDF describe un modelo que ya cambio. Se regenera, no se entrega asi.")

    # ---- G-E3a: el motor declarado ----
    aceptados = {m["id"] for m in c["motoresDeImagen"]["aceptados"]}
    if sin_render:
        if not motivo_sin_render:
            rojo("G-E3a", "--sin-render exige --reason")
        else:
            avisos.append("sin renders declarados: %s" % motivo_sin_render)
    else:
        m = (motor or "").strip()
        rech = [x for x in c["motoresDeImagen"]["rechazados"]
                if m.lower() in [a.lower() for a in x["alias"]] or m.lower() == x["id"].lower()]
        if rech:
            x = rech[0]
            rojo("G-E3a", "el motor de imagen '%s' esta rechazado" % m,
                 "%s\n  Fuente: %s\n  Motores aceptados: %s" % (x["motivo"], x["fuente"], ", ".join(sorted(aceptados))))
        elif m not in aceptados:
            rojo("G-E3a", "motor de imagen no declarado o desconocido: '%s'" % (m or "(vacio)"),
                 "Aceptados: %s\n  Se agrega uno nuevo a procesoCanon.data.json, con lo que lo hace aceptable."
                 % ", ".join(sorted(aceptados)))

        if not renders:
            rojo("G-E3a", "no se declaro ningun render",
                 "Un PDF 'visual' sin renders no es visual. Si genuinamente no hay, "
                 "--sin-render --reason '...'")

        # el motor propio trae su autotest: que ande se PRUEBA, no se asume
        if m == "foto3d":
            try:
                import foto3d
                rampa, escalon = foto3d.autotest_contornos()
                if rampa > 0.02 or escalon < 0.005:
                    rojo("G-E3a", "el autotest de foto3d no separa (rampa %.4f, escalon %.4f)"
                         % (rampa, escalon),
                         "Una rampa pura no puede tener contorno y un escalon si. Si esto no "
                         "separa, el motor no esta dibujando los bordes.")
                else:
                    avisos.append("autotest de foto3d OK (rampa %.4f sin contorno, escalon %.4f con contorno)"
                                  % (rampa, escalon))
            except Exception as e:                      # noqa: BLE001
                rojo("G-E3a", "no se pudo correr el autotest de foto3d: %s" % e)

    # ---- G-E3b: cuanto color tiene cada render ----
    cm = c["umbrales"]["cromaMinima"]
    umbral, bloquea = cm["valor"], bool(cm.get("bloqueante", False))
    upx = c["umbrales"]["cromaUmbralPixel"]["valor"]
    raiz_entrega = os.path.normcase(os.path.abspath(entrega))
    medidos = []
    for r in renders or []:
        if not os.path.isfile(r):
            rojo("G-E3b", "el render declarado no existe: %s" % r)
            continue
        # ROB-9: --render aceptaba cualquier ruta. Se podia declarar el render bueno de otra
        # carpeta mientras la entrega llevaba adentro el malo — el gate juzgaba una imagen
        # que Fak no iba a recibir. Es "medir la orden y no el resultado" otra vez.
        if not os.path.normcase(os.path.abspath(r)).startswith(raiz_entrega + os.sep):
            rojo("G-E3b", "el render '%s' no esta dentro de la entrega" % os.path.basename(r),
                 "Se juzga lo que Fak va a recibir, no una copia que quedo en otra carpeta.\n"
                 "  Entrega: %s" % entrega)
            continue
        try:
            frac, n = croma_del_objeto(r, upx)
        except Exception as e:                          # noqa: BLE001
            rojo("G-E3b", "no se pudo medir %s: %s" % (os.path.basename(r), e))
            continue
        if frac is None:
            rojo("G-E3b", "en %s casi no hay objeto (%d pixeles distintos del fondo)"
                 % (os.path.basename(r), n),
                 "Una imagen casi vacia no es un render del dispositivo.")
            continue
        medidos.append((os.path.basename(r), frac, n))
        if frac < umbral:
            msg = ("el render %s tiene %.2f de color (referencia %.2f) — si las piezas no se "
                   "distinguen por color, MIRALO antes de mandarlo"
                   % (os.path.basename(r), frac, umbral))
            if bloquea:
                rojo("G-E3b", msg, cm["calibracion"])
            else:
                avisos.append("G-E3b · %s" % msg)

    # ---- salida ----
    print("GATE DE ENTREGABLE — %s" % entrega)
    for o in fmt["obligatorios"]:
        hits = encontrados.get(o["id"]) or []
        print("  %-20s %s" % (o["id"], ", ".join(os.path.basename(h) for h in hits) or "FALTA"))
    for nombre, frac, n in medidos:
        print("  color %-24s %.2f  (%d px de objeto)" % (nombre, frac, n))
    print("")
    for a in avisos:
        print("  AVISO  %s" % a)
    if avisos:
        print("")

    if not rojos:
        print("VERDE — el entregable esta en el formato que Fak puede leer.")
        if workdir_path:
            w = workdir.ensure_workdir(workdir_path)
            workdir.record_evidence(
                w, "entregable_ok", entrega=os.path.abspath(entrega), motor=motor,
                renders=[os.path.basename(r) for r in (renders or [])],
                croma=[{"render": n, "color": round(f, 3)} for n, f, _ in medidos],
                formatos={k: [os.path.basename(x) for x in v] for k, v in encontrados.items()},
                sin_render=bool(sin_render), motivo_sin_render=motivo_sin_render)
            print("Evidencia 'entregable_ok' registrada en %s/manifest.json" % w)
        return OK

    print("ROJO — %d problema(s). Asi no se entrega.\n" % len(rojos))
    for gate, msg, det in rojos:
        print("  [%s] %s" % (gate, msg))
        if det:
            for linea in det.split("\n"):
                print("      %s" % linea.lstrip())
        print("")
    return FALLA


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrega", required=True, help="carpeta que se le pasa a Fak")
    ap.add_argument("--motor", default="", help="motor de imagen usado en los renders (ver procesoCanon)")
    ap.add_argument("--render", nargs="*", default=[], help="los PNG/JPG que muestran el 3D")
    ap.add_argument("--workdir", help="si pasa, registra la evidencia 'entregable_ok'")
    ap.add_argument("--sin-render", action="store_true", help="la entrega no lleva renders (exige --reason)")
    ap.add_argument("--reason", default=None)
    args = ap.parse_args()
    return verificar(args.entrega, args.motor, args.render, args.workdir,
                     args.sin_render, args.reason)


if __name__ == "__main__":
    sys.exit(main())
