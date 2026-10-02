# -*- coding: utf-8 -*-
"""generar_hojas_v3.py — arma las hojas HOTMELT en el formato de una foto por paso (A3).

    py -3 scripts/hotmelt/generar_hojas_v3.py                # los dos juegos, con PDF
    py -3 scripts/hotmelt/generar_hojas_v3.py maquina        # solo la hoja de maquina
    py -3 scripts/hotmelt/generar_hojas_v3.py --sin-pdf
    py -3 scripts/hotmelt/generar_hojas_v3.py --sin-pdf --out <carpeta>   # probar sin pisar lo entregado

Contenido: `hojas_v3_spec.py`. Fotos: `fotos_v3.py` + `fotos_v3_lista.py`. Dibujo: `hoja_a3_fotos.py`.
Antes de dibujar cada hoja corren los controles de redaccion del skill hojas-de-proceso
(vocabulario de planta, infinitivo, sin TBD, denominacion) y el de fuente por paso.
"""
import os
import re
import sys
import unicodedata

from pptx import Presentation
from pptx.util import Cm

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts"))
sys.stdout.reconfigure(encoding="utf-8")

import generar_hojas_hotmelt_a3 as base      # noqa: E402
import hoja_a3_fotos as H                     # noqa: E402
import hojas_v3_spec as spec                  # noqa: E402
from redaccion import gate_redaccion          # noqa: E402
import hoja_proceso_check as CHK              # noqa: E402
from fotos_v3 import ruta as ruta_foto, BIB   # noqa: E402
from fotos_v3_lista import FOTOS              # noqa: E402

# exports/hojas-hotmelt-01-10 es la copia de lo que se subio al servidor el 01/10 (no se pisa);
# la revision del 02/10 sale en su propia carpeta hasta que Fak apruebe reemplazar lo del servidor.
SALIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "exports", "hojas-hotmelt-02-10"))
if "--out" in sys.argv:                       # para probar sin pisar lo ya entregado
    _i = sys.argv.index("--out")
    SALIDA = os.path.abspath(sys.argv[_i + 1])
    del sys.argv[_i:_i + 2]
FECHA = "02/10/2026"

MAQUINA_TXT = "Laminadora hot melt KINGPOWER con fusor de adhesivo"

JUEGOS = {
    "maquina": dict(hojas=spec.MAQUINA, archivo="HO-993 - LAMINADORA HOT MELT - HOJA DE MAQUINA",
                    cajetin=dict(ho="HO-993", sector="LAMINADO", pieza="LAMINADORA HOT MELT",
                                 modelo="PATAGONIA / VW427", cliente="VW / NOVAX"),
                    portada=dict(
                        titulo="HOJAS DE PROCESO — LAMINADORA HOT MELT",
                        subtitulo="Hoja de la máquina: encendido, fusor de adhesivo, calentamiento de rodillos, "
                                  "limpieza, alarmas y enhebrado con la máquina sin material",
                        ficha=[("Documento", "HO-993 · Form. I-IN-002.4-R01"),
                               ("Máquina", MAQUINA_TXT),
                               ("Sector", "LAMINADO"),
                               ("Proyecto en curso", "PATAGONIA / VW427 · TOP ROLL (HO-992, operación 20)"),
                               ("Elaboró", "F. Santoro · Ingeniería"),
                               ("Fecha / Revisión", f"{FECHA} · Rev. A")])),
    "produccion": dict(hojas=spec.PRODUCCION, archivo="HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL",
                       cajetin=dict(ho="HO-992", sector="LAMINADO",
                                    pieza="TOP ROLL — N 216 / N 256 / N 285 / N 315",
                                    modelo="PATAGONIA / VW427", cliente="VW / NOVAX"),
                       portada=dict(
                           titulo="HOJAS DE PROCESO — TOP ROLL PATAGONIA",
                           subtitulo="Operación 20 del flujograma 155: ADHESIVADO HOT MELT",
                           ficha=[("Documento", "HO-992 · Form. I-IN-002.4-R01"),
                                  ("Cliente / Proyecto", "VW / NOVAX · PATAGONIA / VW427"),
                                  ("Pieza", "TOP ROLL — N 216 / N 256 / N 285 / N 315"),
                                  ("Operación", "20 — ADHESIVADO HOT MELT"),
                                  ("Máquina", MAQUINA_TXT + " (encendido y limpieza: HO-993)"),
                                  ("Elaboró", "F. Santoro · Ingeniería"),
                                  ("Fecha / Revisión", f"{FECHA} · Rev. A")])),
}


def gate_fuente_por_paso(d):
    sin = [i for i, p in enumerate(d["pasos"], 1) if not p.get("fuentes")]
    if sin:
        raise SystemExit(f"OP {d['op']} {d['denominacion']}: los pasos {sin} no dicen de donde salen. "
                         "Sin fuente el paso no va (hojas-proceso.md punto 11).")


CUANDO = ("cada arranque", "cada rollo", "durante la marcha", "cada parada", "sin confirmar", "excepcion")


def gate_lo_normal_en_produccion(hojas):
    """El juego de PRODUCCION cuenta lo que se hace todos los dias; la excepcion va a la hoja de la
    maquina. Cada hoja declara `cuando=` y eso obliga a contestar la pregunta antes de numerarla.
    El 02/10 la operacion 20 salio con el ENHEBRADO completo como 20.3, en fila con el trabajo normal
    (Fak: "lo unico que hay que hacer es un empalme con el rollo viejo y listo... lo complejizaste
    al pedo"): el enhebrado estaba filmado en la puesta en marcha y nadie pregunto cada cuanto se hace."""
    for h in hojas:
        c = h.get("cuando")
        if c not in CUANDO:
            raise SystemExit(f"OP {h['op']} {h['denominacion']}: falta decir CUANDO se hace "
                             f"(cuando= uno de {', '.join(CUANDO)}).")
        if c == "excepcion":
            raise SystemExit(f"OP {h['op']} {h['denominacion']}: es una excepcion y esta en el juego de "
                             "produccion. Lo que no se hace todos los dias va a la hoja de la maquina.")


# Las piezas y aparatos de esta maquina que un operario nuevo no conoce por su nombre.
PIEZAS = ("volante", "guiador", "controlador", "contador", "detector", "torre", "acumulador", "bandeja",
          "boquilla", "llave", "manometro", "barra amarilla", "mesa superior", "eje", "tubo",
          "rodillo cromado", "mesa de enfriamiento", "enrollador", "interruptor", "parafina", "cuter",
          "film", "fusor", "desbobinador")


def _plano(texto):
    """minusculas y sin acentos, para comparar nombres de piezas"""
    return "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower()) if unicodedata.category(c) != "Mn")


def gate_pieza_nombrada_se_ve(d, fotos=None):
    """Un paso que nombra una pieza la MUESTRA: alguna foto de ese paso tiene que decir, en su pie, en
    su ficha o en sus marcas, que esa pieza esta ahi. Fak, 02/10/2026, con la hoja en la mano: "Girar
    el volante cromado... que es el volante cromado? es como que te diga gira esta nave espacial, cual
    es? pone una foto del volante" (el paso llevaba la foto del tubo vacio, y la del volante estaba
    tapada por dos manos). Un paso que nombra una pieza y va sin foto lo declara con
    `sin_foto="por que"`, y eso lo deja a la vista en vez de pasar callado."""
    fotos = FOTOS if fotos is None else fotos
    # lo que dicen TODAS las fotos de la hoja: una pieza mostrada en un paso vale para los demas
    vistas = []
    for p in d["pasos"]:
        for f in p.get("fotos") or ([p] if p.get("foto") else []):
            ficha = fotos.get(os.path.splitext(os.path.basename(f["foto"]))[0]) or {}
            marcas = " ".join(str(m[4]) for m in ficha.get("marcas", []) if len(m) > 4)
            vistas.append(" ".join([f.get("pie", ""), ficha.get("nota", ""), marcas]))
    vistas = _plano(" ".join(vistas))
    for i, p in enumerate(d["pasos"], 1):
        nombradas = [x for x in PIEZAS if re.search(r"\b" + x + r"\b", _plano(p["texto"]))]
        if not nombradas or p.get("sin_foto"):
            continue
        faltan = [x for x in nombradas if not re.search(r"\b" + x, vistas)]
        if faltan:
            raise SystemExit(f"OP {d['op']} paso {i}: nombra {', '.join(faltan)} y ninguna foto de la hoja dice "
                             "que lo muestra. Poner la foto donde se ve (marcada), o declarar "
                             'sin_foto="por que" y sumarlo a lo que falta filmar.')


PALABRAS_DE_FALLA = ("MODO DE FALLA", "DEFECTO", "MAL PASAD")


def titulo_del_video(video):
    """El titulo que lleva la transcripcion del video en su primera linea ('' si no hay)."""
    p = os.path.join(BIB, ".claude", "transcripciones", f"IMG_{video}.txt")
    if not os.path.exists(p):
        return ""
    with open(p, encoding="utf-8") as f:
        return f.readline().strip()


def gate_foto_no_es_de_falla(d, fotos=None, titulo=titulo_del_video):
    """Una foto sacada de un video que muestra una FALLA no ilustra un paso como si fuera lo
    correcto. El 01/10 la 20.3 salio con el cuadro 0360_0008 ("MODO DE FALLA - vinilo mal pasado",
    audio: "esta esta mal pasada") al lado del paso que manda pasar bien el material; el control
    de la hoja impresa, la revision ciega y la auditoria dieron verde: ninguno abre la fuente de
    la foto. Para mostrar una falla a proposito, el paso lo declara con `contraejemplo=True`."""
    fotos = FOTOS if fotos is None else fotos
    for i, p in enumerate(d["pasos"], 1):
        if p.get("contraejemplo"):
            continue
        for f in p.get("fotos") or ([p] if p.get("foto") else []):
            nombre = os.path.splitext(os.path.basename(f["foto"]))[0]
            fuente = (fotos.get(nombre) or {}).get("fuente")
            if not isinstance(fuente, str):
                continue                      # pagina del manual, o foto sin ficha
            video = os.path.basename(fuente).split("_")[0]
            t = titulo(video)
            if any(w in t.upper() for w in PALABRAS_DE_FALLA):
                raise SystemExit(f"OP {d['op']} paso {i}: la foto '{nombre}' sale del video {video}, que "
                                 f"muestra una FALLA ({t.lstrip('# ')}). No puede ilustrar el paso como "
                                 "si fuera lo correcto: sacarla, o declarar contraejemplo=True.")


def para_redaccion(d):
    """El dict de la hoja, en la forma que lee gate_redaccion (pasos y pies como textos)."""
    pies = []
    for p in d["pasos"]:
        for f in p.get("fotos") or ([p] if p.get("foto") else []):
            pies.append(f.get("pie", ""))
    return dict(op=d["op"], denominacion=d["denominacion"], nota=d.get("aviso"),
                pasos=[p["texto"].replace("⚠", "").replace("“", '"').replace("”", '"') for p in d["pasos"]],
                pies=pies)


def generar(nombre, pdf=True):
    j = JUEGOS[nombre]
    if not j["hojas"]:
        print(f"[{nombre}] todavia no tiene hojas en el spec.")
        return None
    if nombre == "produccion":
        gate_lo_normal_en_produccion(j["hojas"])
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(base.W), Cm(base.H)
    # lamina 1: portada con el indice (criterios, seccion 5)
    indice = [(h["op"], h["denominacion"] + (f" (hoja {h['hoja_de'][0]} de {h['hoja_de'][1]})" if h.get("hoja_de") else ""))
              for h in j["hojas"]]
    foto_portada = ruta_foto("p_maquina")
    # --sin-portada: el juego sale sin la lamina de portada, para el PDF por pieza que se le pasa a
    # Calidad (Fak, 02/10/2026: "sin la hoja esa primera que haces de intro... no la elimines, me
    # gusto, pero por ahora no se la pasamos"). La portada sigue siendo la forma por defecto.
    if "--sin-portada" not in sys.argv:
        H.portada(prs, j["portada"]["titulo"], j["portada"]["subtitulo"], j["portada"]["ficha"], indice,
                  logo=base.LOGO_BARACK, foto=foto_portada if os.path.exists(foto_portada) else None,
                  pie_foto="Laminadora hot melt, vista desde el desbobinador")
    for h in j["hojas"]:
        d = dict(fecha=FECHA, rev="A", **j["cajetin"])
        d.update(h)
        gate_fuente_por_paso(d)
        gate_foto_no_es_de_falla(d)
        gate_pieza_nombrada_se_ve(d)
        gate_redaccion(para_redaccion(d))
        _, avisos = H.hoja(prs, d, logo=base.LOGO_BARACK)
        etiqueta = f"OP {d['op']} {d['denominacion']}" + (f" ({d['hoja_de'][0]}/{d['hoja_de'][1]})" if d.get("hoja_de") else "")
        print(f"  ok  {etiqueta}")
        for a in avisos:
            print(f"      aviso: {a}")
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, j["archivo"] + ".pptx")
    prs.save(ruta)
    print(f"[{nombre}] {len(j['hojas'])} hojas -> {ruta}")
    # el control duro del skill, sobre el ARCHIVO que quedo: fotos de menos de 25 cm2, mas de
    # 12 por hoja, una foto sin su cartel REF., un texto que no entra en su caja, vocabulario
    fallas = CHK.revisar(ruta, {"*": {"secuencia": True}})
    if fallas:
        print(CHK.informe(fallas))
        raise SystemExit(1)
    print(f"[{nombre}] control de la hoja impresa: pasa")
    if pdf:
        base.exportar_pdf_com(ruta)
    return ruta


if __name__ == "__main__":
    pedidos = [a for a in sys.argv[1:] if not a.startswith("--")] or list(JUEGOS)
    for n in pedidos:
        generar(n, pdf="--sin-pdf" not in sys.argv)
    if spec.FALTA:
        # la lista de lo que ninguna fuente contesta, agrupada por tema, al lado de las hojas
        temas = {}
        for tema, que in spec.FALTA:
            temas.setdefault(tema, []).append(que)
        lineas = ["HOJAS HOT MELT - LO QUE FALTA PREGUNTAR O FILMAR EN LA MAQUINA", f"Al {FECHA}", ""]
        for tema, items in temas.items():
            lineas.append(tema)
            lineas += [f"  - {q}" for q in items]
            lineas.append("")
        destino = os.path.join(SALIDA, "PENDIENTES - lo que falta preguntar o filmar.txt")
        with open(destino, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas))
        print(f"\nPendientes de preguntar o filmar: {len(spec.FALTA)} -> {destino}")
