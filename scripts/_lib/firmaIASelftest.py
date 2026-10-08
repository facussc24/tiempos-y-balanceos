"""
Selftest de firmaIA.py — cada forma de "lo hizo Claude" en ROJO, y el trabajo normal en VERDE.

Arma documentos de prueba en una carpeta temporal (Excel, PowerPoint, Word, PDF, CSV) con las
formas que encontramos el 08/10/2026 en el listado de hojas de proceso — la celda CREADO POR, la
pestaña oculta, la marca del complemento "Claude para Excel" — y las que puede dejar un generador
(propiedades del archivo, notas del orador, texto partido en dos "runs"). Un detector que no puede
dar verde esta tan roto como uno que no puede dar rojo.

    python scripts/_sinFirmaIA.py --selftest
"""
import os
import sys
import tempfile
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import firmaIA  # noqa: E402

WEBEXT = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<we:webextension '
          'xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" '
          'id="{63D3F5EF-0625-4C39-A49D-EEB3A4D217E1}"><we:reference id="WA200009404" version="1.0.0.8" '
          'store="Omex" storeType="OMEX"/><we:properties><we:property name="claude.fileId" '
          'value="&quot;e1c6&quot;"/></we:properties><we:bindings/></we:webextension>')
TASKPANES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<wetp:taskpanes '
             'xmlns:wetp="http://schemas.microsoft.com/office/webextensions/taskpanes/2010/11">'
             '<wetp:taskpane dockstate="right" visibility="0" width="525" row="1"><wetp:webextensionref '
             'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>'
             '</wetp:taskpane></wetp:taskpanes>')
TP_RELS = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships '
           'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" '
           'Type="http://schemas.microsoft.com/office/2011/relationships/webextension" Target="webextension1.xml"/></Relationships>')


def _xlsx(p, celdas=None, oculta=None, autor='Facundo Santoro'):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'INDICE HOJAS DE PROCESO'
    ws['J6'] = 'CREADO POR'
    for k, v in (celdas or {}).items():
        ws[k] = v
    if oculta:
        o = wb.create_sheet(oculta)
        o['A1'] = 'notas'
        o.sheet_state = 'hidden'
    wb.properties.creator = autor
    wb.properties.lastModifiedBy = autor
    wb.save(p)
    return p


def _con_complemento(p):
    """Le agrega a un xlsx la marca del complemento, igual que la del listado real."""
    with zipfile.ZipFile(p) as z:
        datos = {n: z.read(n) for n in z.namelist()}
    rels = datos['_rels/.rels'].decode()
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdWE" Type="http://schemas.microsoft.com/office/2011/relationships/webextensiontaskpanes" Target="xl/webextensions/taskpanes.xml"/></Relationships>')
    ct = datos['[Content_Types].xml'].decode().replace('</Types>',
        '<Override PartName="/xl/webextensions/taskpanes.xml" ContentType="application/vnd.ms-office.webextensiontaskpanes+xml"/>'
        '<Override PartName="/xl/webextensions/webextension1.xml" ContentType="application/vnd.ms-office.webextension+xml"/></Types>')
    datos['_rels/.rels'], datos['[Content_Types].xml'] = rels.encode(), ct.encode()
    datos['xl/webextensions/taskpanes.xml'] = TASKPANES.encode()
    datos['xl/webextensions/_rels/taskpanes.xml.rels'] = TP_RELS.encode()
    datos['xl/webextensions/webextension1.xml'] = WEBEXT.encode()
    with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, d in datos.items():
            z.writestr(n, d)
    return p


def _pptx(p, texto='Colocar la pieza en el nido.', notas=None, partido=False, props_por_defecto=False):
    from pptx import Presentation
    from pptx.util import Inches
    prs = Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[6])
    tf = s.shapes.add_textbox(Inches(1), Inches(1), Inches(6), Inches(1)).text_frame
    if partido:
        para = tf.paragraphs[0]
        for trozo in ('Revisado por Cla', 'ude el 08/10'):
            r = para.add_run()
            r.text = trozo
    else:
        tf.text = texto
    if notas:
        s.notes_slide.notes_text_frame.text = notas
    if not props_por_defecto:
        prs.core_properties.author = 'Facundo Santoro'
        prs.core_properties.last_modified_by = 'Facundo Santoro'
        prs.core_properties.comments = ''
        prs.core_properties.title = 'HO-990'
    prs.save(p)
    return p


def _docx(p, texto):
    from docx import Document
    d = Document()
    d.add_paragraph(texto)
    d.core_properties.author = 'Facundo Santoro'
    d.core_properties.last_modified_by = 'Facundo Santoro'
    d.core_properties.comments = ''
    d.save(p)
    return p


def _pdf(p, texto='HO-990 Rev.A', autor='Facundo Santoro'):
    import fitz
    doc = fitz.open()
    pag = doc.new_page()
    pag.insert_text((72, 72), texto)
    doc.set_metadata({'author': autor, 'creator': 'Microsoft Excel', 'producer': 'Microsoft Excel', 'title': 'HO'})
    doc.save(p)
    return p


def correr() -> int:
    fallas = 0
    n = 0

    def caso(nombre, ruta, debe_frenar, debe_decir=None, debe_avisar=None):
        nonlocal fallas, n
        n += 1
        hs = firmaIA.revisar_archivo(ruta, raiz=os.path.dirname(ruta))
        bloq = [h for h in hs if h.nivel == 'BLOQUEANTE']
        ok = bool(bloq) == debe_frenar
        if ok and debe_decir:
            ok = any(debe_decir in (h.lugar + ' ' + h.texto + ' ' + h.regla) for h in bloq)
        if ok and debe_avisar:
            ok = any(debe_avisar == h.regla for h in hs if h.nivel == 'AVISO')
        print(f'  {"ok  " if ok else "MAL "}  {nombre}')
        if not ok:
            fallas += 1
            for h in hs:
                print('        ', h.renglon())

    with tempfile.TemporaryDirectory() as td:
        j = lambda x: os.path.join(td, x)
        print('ROJOS — tiene que frenar')
        caso('08/10: CREADO POR = Claude en la celda J74', _xlsx(j('a.xlsx'), {'J74': 'Claude'}), True, 'celda J74')
        caso('08/10: pestaña oculta _CONTEXTO_CLAUDE', _xlsx(j('b.xlsx'), oculta='_CONTEXTO_CLAUDE'), True, '_CONTEXTO_CLAUDE')
        caso('08/10: texto "para el proximo Claude"', _xlsx(j('c.xlsx'), {'A1': 'CONTEXTO PARA EL PRÓXIMO CLAUDE'}), True, 'celda A1')
        caso('08/10: texto "segun el usuario"', _xlsx(j('c2.xlsx'), {'A3': 'REGLA NUEVA (segun el usuario): todas juntas'}), True, 'proximo-claude')
        caso('08/10: marca del complemento Claude para Excel', _con_complemento(_xlsx(j('d.xlsx'))), True, 'claude.fileId')
        caso('propiedades: autor Claude', _xlsx(j('e.xlsx'), autor='Claude'), True, 'propiedades')
        caso('PowerPoint: notas del orador "hecho con Claude"', _pptx(j('f.pptx'), notas='Hoja hecha con Claude'), True, 'notas')
        caso('PowerPoint: Claude partido en dos runs', _pptx(j('g.pptx'), partido=True), True, 'claude-pegado')
        caso('PowerPoint: propiedades por defecto de python-pptx', _pptx(j('h.pptx'), props_por_defecto=True), True, 'generado-por-libreria')
        caso('Word: "generado por IA"', _docx(j('i.docx'), 'Este informe fue generado por IA.'), True, 'hecho-con-ia')
        caso('Word: inteligencia artificial', _docx(j('i2.docx'), 'Preparado con inteligencia artificial'), True, 'inteligencia-artificial')
        caso('PDF: autor Claude en la metadata', _pdf(j('k.pdf'), autor='Claude'), True, 'propiedades del PDF')
        caso('PDF: "Generado con ChatGPT" en la pagina', _pdf(j('l.pdf'), texto='Generado con ChatGPT'), True, 'pagina 1')
        with open(j('m.csv'), 'w', encoding='utf-8') as f:
            f.write('HO;CREADO POR\n972;Claude\n')
        caso('CSV: Claude en una columna', j('m.csv'), True, 'Claude')
        with open(j('_CONTEXTO_CLAUDE.txt'), 'w', encoding='utf-8') as f:
            f.write('nada\n')
        caso('nombre de archivo con Claude', j('_CONTEXTO_CLAUDE.txt'), True, 'nombre del archivo')
        caso('Excel: Gemini en una celda', _xlsx(j('n.xlsx'), {'B2': 'Revisado con Gemini'}), True, 'gemini')

        print('VERDES — no tiene que frenar')
        caso('CREADO POR = F.Santoro', _xlsx(j('v1.xlsx'), {'J74': 'F.Santoro'}), False)
        caso('Jean-Claude es una persona', _xlsx(j('v2.xlsx'), {'B2': 'Contacto: Jean-Claude Dupont'}), False)
        caso('Claudio y Claudia no son Claude', _xlsx(j('v3.xlsx'), {'B2': 'Claudio Pérez', 'B3': 'Claudia Gómez'}), False)
        caso('autoría, geminis y copiloto no son IA', _docx(j('v4.docx'), 'La autoría del plano es del cliente; signo Géminis; copiloto del auto.'), False)
        caso('HO en PowerPoint con propiedades puestas', _pptx(j('v5.pptx')), False)
        caso('PDF de una HO', _pdf(j('v6.pdf')), False)
        caso('IA como codigo: aviso, no freno', _xlsx(j('v7.xlsx'), {'E9': '2HC.858.417 IA'}), False, debe_avisar='ia-suelta')

        print('ARREGLO — quitar_complemento_claude')
        p = _con_complemento(_xlsx(j('x.xlsx'), {'J74': 'F.Santoro'}))
        sacadas = firmaIA.quitar_complemento_claude(p)
        n += 1
        import openpyxl
        wb = openpyxl.load_workbook(p)
        limpio = not [h for h in firmaIA.revisar_archivo(p) if h.nivel == 'BLOQUEANTE']
        ok = len(sacadas) == 3 and limpio and wb.active['J74'].value == 'F.Santoro'
        print(f'  {"ok  " if ok else "MAL "}  saca las 3 partes, el libro abre y queda limpio ({sacadas})')
        fallas += 0 if ok else 1
        n += 1
        ok = firmaIA.quitar_complemento_claude(_xlsx(j('y.xlsx'))) == []
        print(f'  {"ok  " if ok else "MAL "}  un libro sin la marca no se toca')
        fallas += 0 if ok else 1

        print('ARREGLO — limpiar_propiedades')
        p = _pptx(j('z.pptx'), props_por_defecto=True)
        cambios = firmaIA.limpiar_propiedades(p)
        n += 1
        from pptx import Presentation
        cp = Presentation(p).core_properties
        ok = (not [h for h in firmaIA.revisar_archivo(p) if h.nivel == 'BLOQUEANTE'] and cp.comments == ''
              and cp.last_modified_by == firmaIA.AUTOR and len(Presentation(p).slides) == 1)
        print(f'  {"ok  " if ok else "MAL "}  saca "generated using python-pptx" y "Steve Canny"; el deck abre ({cambios})')
        fallas += 0 if ok else 1
        n += 1
        ok = firmaIA.limpiar_propiedades(_pptx(j('z2.pptx'))) == []
        print(f'  {"ok  " if ok else "MAL "}  propiedades de una persona no se tocan')
        fallas += 0 if ok else 1

    print(f'\nselftest firmaIA: {"todo verde" if not fallas else f"{fallas} MAL"} ({n} casos)')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(correr())
