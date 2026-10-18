# -*- coding: utf-8 -*-
"""plantillasCasa.py — las plantillas del formato de la casa, armadas desde el tema (tanda 16, piezas 5, 6 y 7).

Todo sale de scripts/_lib/tema.json (logo oficial verificado por sha256, Calibri, colores, tamaños, pie): si el tema
cambia (por ejemplo cuando Fak elija el azul), se vuelven a generar con este mismo comando. Ninguna lleva nada que diga
que la hizo una IA: autor «Facundo Santoro» en las propiedades.

  python scripts/plantillasCasa.py [--salida templates]

Deja:
  CASA_PRESENTACION_PROYECTAR.pptx  para proyectar en una reunion: titulo que afirma (28-32 pt), UNA evidencia por
                                    lamina, cuerpo de 18 pt o mas (Garner et al. 2013)
  CASA_PRESENTACION_LEER.pptx       para mandar y leer: lo mismo con cuerpo de 10 pt o mas (sale de un solo caso)
  CASA_HOJA_A3.pptx                 hoja de una pagina en A3: lo importante en la primera linea y los 6 bloques del A3
  CASA_EXCEL_B2.xltx                Excel de datos: fila 1 y columna A vacias, titulo en B2, cabecera del tema
Las funciones (lamina, excel_b2) las pueden usar los generadores para no armar cada uno su propio formato.
"""
import argparse
import datetime
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "_lib"))
import temaCasa  # noqa: E402

AUTOR = None  # se carga del tema


def _tema():
    return temaCasa.cargar()


# ---------------------------------------------------------------- PowerPoint
def _pptx_base(ancho_cm, alto_cm):
    from pptx import Presentation
    from pptx.util import Cm
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(ancho_cm), Cm(alto_cm)
    return prs


def _texto(sl, x, y, w, h, texto, pt, color, negrita=False):
    from pptx.dml.color import RGBColor
    from pptx.util import Cm, Pt
    t = _tema()
    tb = sl.shapes.add_textbox(Cm(x), Cm(y), Cm(w), Cm(h))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, renglon in enumerate(texto.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run()
        r.text = renglon
        r.font.name = t["letra"]["nombre"]
        r.font.size = Pt(pt)
        r.font.bold = negrita
        r.font.color.rgb = RGBColor.from_string(color)
    return tb


def _caja(sl, x, y, w, h, relleno, linea=None):
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.util import Cm, Pt
    s = sl.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    s.fill.solid()
    s.fill.fore_color.rgb = RGBColor.from_string(relleno)
    if linea:
        s.line.color.rgb = RGBColor.from_string(linea)
        s.line.width = Pt(0.75)
    else:
        s.line.fill.background()
    s.shadow.inherit = False
    return s


def _logo(sl, x, y, alto_cm):
    from pptx.util import Cm
    sl.shapes.add_picture(temaCasa.logo(), Cm(x), Cm(y), height=Cm(alto_cm))


def _pie(sl, ancho, alto, titulo, n, pt=9, fecha="[fecha]", rev="[rev.]"):
    """Pie: titulo · fecha · autor · revision · pagina. En una plantilla la fecha y la revision quedan para llenar."""
    t = _tema()
    gris = t["colores"]["gris"]["valor"]
    _caja(sl, 1.2, alto - 1.25, ancho - 2.4, 0.03, gris)
    _texto(sl, 1.2, alto - 1.15, ancho - 6, 0.8, f"{titulo} · {fecha} · {t['pie']['autor']} · Rev. {rev}", pt, gris)
    _texto(sl, ancho - 3.2, alto - 1.15, 2.0, 0.8, str(n), pt, gris)


def lamina(prs, tipo, titulo, evidencia=None, fuente=None, n=1, titulo_doc="[Título del documento]", fecha=None, rev="A"):
    """Una lamina «afirmacion + evidencia»: titulo que afirma, UNA evidencia (imagen o caja vacia) y la fuente al pie.
    Con evidencia es una lamina real: el pie lleva la fecha de hoy (o la que se pase) y la revision."""
    from pptx.util import Cm
    t = _tema()
    tam = t["tamanos"]["pptx_proyectar" if tipo == "proyectar" else "pptx_leer"]
    pt_titulo = tam.get("titulo_max", 22) if tipo == "proyectar" else 22
    pt_cuerpo = tam["cuerpo_min"] if tipo == "proyectar" else max(tam["cuerpo_min"], 11)
    W, H = prs.slide_width / 360000, prs.slide_height / 360000
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    _logo(sl, 1.2, 0.8, 1.4)
    _texto(sl, 1.2, 2.6, W - 2.4, 2.4, titulo, pt_titulo, t["colores"]["acento"]["valor"], negrita=True)
    y0, alto_ev = 5.4, H - 5.4 - 2.6
    if evidencia:
        pic = sl.shapes.add_picture(evidencia, Cm(1.2), Cm(y0), height=Cm(alto_ev))
        if pic.width > Cm(W - 2.4):  # se achica entera, sin deformarla
            esc = Cm(W - 2.4) / pic.width
            pic.width, pic.height = int(pic.width * esc), int(pic.height * esc)
    else:
        _caja(sl, 1.2, y0, W - 2.4, alto_ev, t["colores"]["relleno"]["valor"], t["colores"]["gris"]["valor"])
        _texto(sl, 1.8, y0 + 0.6, W - 3.6, 3,
               "[UNA evidencia: la captura del papel con el renglón marcado en rojo, una foto real, una tabla o un gráfico]",
               pt_cuerpo, t["colores"]["texto"]["valor"])
    if fuente:
        _texto(sl, 1.2, H - 2.3, W - 2.4, 0.9, fuente, tam["cuerpo_min"], t["colores"]["gris"]["valor"])
    if evidencia:
        _pie(sl, W, H, titulo_doc, n, fecha=fecha or datetime.date.today().strftime("%d/%m/%Y"), rev=rev)
    else:
        _pie(sl, W, H, titulo_doc, n)
    return sl


def presentacion(ruta, tipo):
    prs = _pptx_base(33.867, 19.05)  # 16:9
    if tipo == "proyectar":
        lamina(prs, tipo, "[Título que AFIRMA, en una oración: «La OP 30 pasa de 2 a 1 operario»]")
    else:
        lamina(prs, tipo, "[Título que afirma, en una oración]", fuente="[Archivo de donde sale y su fecha]")
    _propiedades_pptx(prs, f"Presentación para {'proyectar' if tipo == 'proyectar' else 'mandar y leer'}")
    prs.save(ruta)
    return ruta


def hoja_a3(ruta):
    """Hoja de una pagina A3 (horizontal): la primera linea dice que pasa y que se necesita; abajo los 6 bloques del A3."""
    t = _tema()
    tam = t["tamanos"]["a3"]
    prs = _pptx_base(42.0, 29.7)
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    W, H = 42.0, 29.7
    _logo(sl, 1.2, 0.9, 1.6)
    _texto(sl, 6.0, 0.9, W - 7.2, 1.8, "[Título del tema]", 20, t["colores"]["acento"]["valor"], negrita=True)
    _caja(sl, 1.2, 3.2, W - 2.4, 2.4, t["colores"]["relleno"]["valor"])
    _texto(sl, 1.6, 3.5, W - 3.2, 1.8, "[Lo importante, en UNA línea: qué pasa y qué se necesita, de quién y para cuándo]",
           18, t["colores"]["texto"]["valor"], negrita=True)
    bloques = ["1. Situación (qué pasa hoy, con el dato)", "2. Objetivo (a dónde se quiere llegar, medible)",
               "3. Causa (la que se probó, con su evidencia)", "4. Contramedida (qué se hace)",
               "5. Plan (qué, quién y para cuándo)", "6. Seguimiento (cómo se sabe que funcionó)"]
    cab = t["colores"]["cabecera"]["valor"]
    bw, bh, gx, gy, y0 = (W - 2.4 - 2 * 0.6) / 3, (H - 6.4 - 2.2 - 0.6) / 2, 0.6, 0.6, 6.4
    for i, b in enumerate(bloques):
        x = 1.2 + (i % 3) * (bw + gx)
        y = y0 + (i // 3) * (bh + gy)
        _caja(sl, x, y, bw, bh, "FFFFFF", t["colores"]["gris"]["valor"])
        _caja(sl, x, y, bw, 1.2, cab)
        _texto(sl, x + 0.3, y + 0.12, bw - 0.6, 1.0, b, tam["texto_min"], "FFFFFF", negrita=True)
        _texto(sl, x + 0.3, y + 1.6, bw - 0.6, bh - 2, "[con su captura o su número; sin notas ni recomendaciones que nadie pidió]",
               tam["texto_min"], t["colores"]["gris"]["valor"])
    _pie(sl, W, H, "[Título del tema]", 1, pt=max(tam["tabla_min"], 9))
    _propiedades_pptx(prs, "Hoja de una página A3")
    prs.save(ruta)
    return ruta


def _propiedades_pptx(prs, titulo):
    cp = prs.core_properties
    autor = _tema()["pie"]["autor_propiedades"]
    cp.author, cp.last_modified_by, cp.title, cp.comments, cp.subject, cp.keywords = autor, autor, titulo, "", "", ""


# ---------------------------------------------------------------- Excel
def excel_b2(ruta, titulo, columnas, filas=(), anchos=None, plantilla=False):
    """Excel de datos de la casa: fila 1 y columna A vacias, titulo en B2, tabla desde B4 con la cabecera del tema,
    bordes finos, paneles inmovilizados debajo de la cabecera. Sin notas, sin gris, sin columnas derivadas."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    t = _tema()
    letra = t["letra"]["nombre"]
    cab = t["colores"]["cabecera"]["valor"]
    fino = Side(style="thin", color=t["colores"]["gris"]["valor"])
    borde = Border(left=fino, right=fino, top=fino, bottom=fino)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = (re.sub(r"[\[\]:*?/\\]", "", titulo)[:31].strip() or "Datos") if not plantilla else "Datos"
    ws.column_dimensions["A"].width = 3.7          # columna A vacia y angosta (PLAN DE TRABAJO Formato Rev. 1)
    ws.row_dimensions[1].height = 8                 # fila 1 vacia
    ws["B2"] = titulo
    ws["B2"].font = Font(name=letra, size=t["tamanos"]["excel"]["titulo"], bold=True, color=t["colores"]["acento"]["valor"])
    for j, nombre in enumerate(columnas, 2):
        c = ws.cell(row=4, column=j, value=nombre)
        c.font = Font(name=letra, size=t["tamanos"]["excel"]["cuerpo"], bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=cab)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = borde
        ws.column_dimensions[get_column_letter(j)].width = (anchos or {}).get(nombre, max(12, len(str(nombre)) + 4))
    for i, fila in enumerate(filas, 5):
        for j, valor in enumerate(fila, 2):
            c = ws.cell(row=i, column=j, value=valor)
            c.font = Font(name=letra, size=t["tamanos"]["excel"]["cuerpo"])
            c.border = borde
    ws.freeze_panes = "B5"
    autor = t["pie"]["autor_propiedades"]
    wb.properties.creator, wb.properties.lastModifiedBy, wb.properties.title = autor, autor, titulo
    if plantilla:
        wb.template = True
    wb.save(ruta)
    return ruta


def generar(salida):
    os.makedirs(salida, exist_ok=True)
    hechos = [
        presentacion(os.path.join(salida, "CASA_PRESENTACION_PROYECTAR.pptx"), "proyectar"),
        presentacion(os.path.join(salida, "CASA_PRESENTACION_LEER.pptx"), "leer"),
        hoja_a3(os.path.join(salida, "CASA_HOJA_A3.pptx")),
        excel_b2(os.path.join(salida, "CASA_EXCEL_B2.xltx"), "[Título: qué es y de qué fecha]",
                 ["[Columna 1]", "[Columna 2]", "[Columna 3]"], plantilla=True),
    ]
    return hechos


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Plantillas del formato de la casa, desde scripts/_lib/tema.json")
    ap.add_argument("--salida", default=os.path.join(os.path.dirname(AQUI), "templates"))
    a = ap.parse_args()
    try:
        for p in generar(a.salida):
            print("OK", p)
    except temaCasa.TemaError as e:
        print(f"ROJO: {e}")
        sys.exit(1)
