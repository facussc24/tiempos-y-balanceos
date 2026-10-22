"""
_pcIpPadForm.py — escribe un plan de control sobre el formulario NUEVO de Calidad (I-AC-005.1 - Jun.26 - C, columnas B a O),
el del plan de inyeccion plastica del IP PAD Patagonia (`PC INYECCION PLASTICA IP PAD.xlsx`, legajo 12-, Rev A del
14/06/2026). Se copia el formulario y se trabaja sobre la copia por Excel COM (openpyxl pierde las casillas dibujadas).

Lo que hace: cambia los dos logos del formulario por el oficial (ninguno de los 7 dibujos del archivo es el oficial,
hash 5d9207e12856), llena el encabezado, borra las filas del plan de inyeccion (de "Recepción" al pie) y escribe las
filas nuevas con la letra, el borde y el color de seccion del formulario. Las casillas de fase (prelanzamiento) y de
S/R (SI) ya vienen marcadas asi en el formulario y no se tocan.
"""
import os
import re

import win32com.client as win32

ROJO_FUENTE = 255
COLS = 'BCDEFGHIJKLMNO'
CAMPOS = ['op', 'nom', 'maq', 'n', 'prod', 'proc', 'clas', 'esp', 'inst', 'tam', 'frec', 'reg', 'resp', 'reac']
HOJA_FORM = 'INY PLAS. IP PATAGONIA'
LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    'tools', 'flowchart', 'assets', 'barack_logo.png')


def fila(fuente='', **k):
    d = {c: '' for c in CAMPOS}
    d.update(k)
    d['_fuente'] = fuente
    return d


def seccion(texto):
    return {'_seccion': texto}


def chequeo_sin_remision_a_la_ho(filas):
    """Fak, 19/10/2026: ninguna celda del plan remite a la hoja de operaciones. Frena antes de escribir."""
    patron = re.compile(r'\bHO\b|\bHO-\d|\bpestañas? \d|hoja de operaci|ver hoja de set', re.IGNORECASE)
    return [(campo, f[campo]) for f in filas if '_seccion' not in f for campo in CAMPOS if patron.search(str(f.get(campo, '')))]


def celda_superior(ws, direccion):
    return ws.Range(direccion).MergeArea.Cells(1, 1)


def poner(ws, direccion, valor):
    c = celda_superior(ws, direccion)
    c.NumberFormat = '@'
    c.Value = valor


def logo_oficial(ws, esperados=2):
    """Cambia los logos (las imagenes de mas de 50 pt de ancho; las casillas tildables son de ~20 pt) por el oficial, en
    el mismo lugar y alto. Frena si no encuentra los que espera: un formulario sin logo tambien esta mal."""
    viejos = [s for s in ws.Shapes if s.Type == 13 and s.Width > 50]
    if len(viejos) != esperados:
        raise RuntimeError(f'esperaba {esperados} logos en la hoja {ws.Name} y hay {len(viejos)}')
    for s in viejos:
        izq, arr, ancho, alto = s.Left, s.Top, s.Width, s.Height
        s.Delete()
        p = ws.Shapes.AddPicture(LOGO, False, True, izq, arr, -1, -1)
        p.LockAspectRatio = True
        p.Height = alto
        if p.Width > ancho:
            p.Width = ancho
        p.Top = arr + (alto - p.Height) / 2
        p.Left = izq + (ancho - p.Width) / 2
    return len(viejos)


def logo_en_celda(ws, direccion):
    """La hoja de revisiones del formulario (Rev.) trae el logo viejo como imagen ADENTRO de la celda (Excel 365, valor
    enriquecido: openpyxl y Shapes no la ven). Se borra la celda y se pone el logo oficial flotando en su lugar."""
    area = ws.Range(direccion).MergeArea
    area.ClearContents()
    izq, arr, ancho, alto = area.Left, area.Top, area.Width, area.Height
    p = ws.Shapes.AddPicture(LOGO, False, True, izq, arr, -1, -1)
    p.LockAspectRatio = True
    p.Height = alto * 0.85
    if p.Width > ancho * 0.9:
        p.Width = ancho * 0.9
    p.Top = arr + (alto - p.Height) / 2
    p.Left = izq + (ancho - p.Width) / 2
    return 1


def nivel_actualizacion(ws, texto):
    """El recuadro rojo NIVEL DE ACTUALIZACION es un grupo de formas; se cambia la letra del cuadro que la tiene."""
    g = ws.Shapes('Grupo 21')
    for it in g.GroupItems:
        try:
            t = it.TextFrame2.TextRange.Text.strip()
        except Exception:
            continue
        if t and 'NIVEL' not in t.upper():
            it.TextFrame2.TextRange.Text = texto
            return t
    raise RuntimeError('no encuentro la letra del nivel de actualizacion')


def escribir(ws, filas, salto_antes_de=()):
    """Borra del formulario las filas de 'Recepción' al ultimo renglon antes del pie (I-AC-005.1 ...) y escribe las
    nuevas. Las celdas B, C y D de cada operacion se combinan como en los planes de Calidad."""
    xl_up = -4162
    primera = pie = None
    for r in range(25, 120):
        v = str(ws.Cells(r, 2).Value or '').strip()
        if primera is None and v.lower().startswith('recep'):
            primera = r
        if v.startswith('I-AC-005.1'):
            pie = r
            break
    if primera is None or pie is None:
        raise RuntimeError('no encuentro la fila "Recepción" o el pie del formulario')
    fuente_letra = ws.Cells(primera + 1, 6).Font.Name
    tam_letra = ws.Cells(primera + 1, 6).Font.Size
    sec = ws.Cells(primera, 2)
    sec_fmt = dict(color=sec.Interior.Color, size=sec.Font.Size, italic=sec.Font.Italic, bold=sec.Font.Bold,
                   name=sec.Font.Name)
    ws.Range(ws.Cells(primera, 2), ws.Cells(pie - 1, 15)).UnMerge()
    ws.Range(ws.Rows(primera), ws.Rows(pie - 1)).Delete()
    n_filas = len(filas)
    ws.Range(ws.Rows(primera), ws.Rows(primera + n_filas - 1)).Insert()

    r = primera
    grupos, grupo_ini, saltos = [], None, []
    for f in filas:
        if '_seccion' in f:
            if grupo_ini is not None:
                grupos.append((grupo_ini, r - 1))
                grupo_ini = None
            rng = ws.Range(ws.Cells(r, 2), ws.Cells(r, 15))
            rng.UnMerge()
            rng.Merge()
            rng.Value = f['_seccion']
            rng.Font.Name = sec_fmt['name']
            rng.Font.Size = sec_fmt['size']
            rng.Font.Bold = sec_fmt['bold']
            rng.Font.Italic = sec_fmt['italic']
            rng.Font.Color = 0
            rng.Interior.Color = sec_fmt['color']
            rng.HorizontalAlignment = -4131
            rng.VerticalAlignment = -4108
            rng.Borders.LineStyle = 1
            ws.Rows(r).RowHeight = 30
            if f['_seccion'] in salto_antes_de:
                saltos.append(r)
            r += 1
            continue
        if f['op'] and grupo_ini is not None:
            grupos.append((grupo_ini, r - 1))
            grupo_ini = None
        if f['op']:
            grupo_ini = r
            if f['op'] in salto_antes_de:
                saltos.append(r)
        rng = ws.Range(ws.Cells(r, 2), ws.Cells(r, 15))
        rng.UnMerge()
        rng.Font.Name = fuente_letra
        rng.Font.Size = tam_letra
        rng.Font.Bold = False
        rng.Font.Italic = False
        rng.Font.Color = 0
        rng.Interior.ColorIndex = -4142
        rng.WrapText = True
        rng.VerticalAlignment = -4108
        rng.HorizontalAlignment = -4108
        rng.Borders.LineStyle = 1
        for i, campo in enumerate(CAMPOS):
            cel = ws.Cells(r, i + 2)
            cel.NumberFormat = '@'
            valor = f[campo]
            cel.Value = valor
            if 'TBD' in str(valor) or 'CONFLICTO' in str(valor):
                cel.Font.Color = ROJO_FUENTE
            if campo == 'clas' and str(valor).strip() in ('D', 'CC'):
                cel.Font.Color = ROJO_FUENTE   # la casa marca la critica en rojo (planes de Calidad, VDA 6.3 de VW 6.2.3)
                cel.Font.Bold = True
        if f.get('_une'):
            # segunda fila de primera/ultima pieza: la caracteristica se combina con la de arriba (columnas E a J)
            for c in range(5, 11):
                rr = ws.Range(ws.Cells(r - 1, c), ws.Cells(r, c))
                rr.Merge()
                rr.VerticalAlignment = -4108
        r += 1
    if grupo_ini is not None:
        grupos.append((grupo_ini, r - 1))
    for a, b in grupos:
        if b > a:
            for c in (2, 3, 4):
                rr = ws.Range(ws.Cells(a, c), ws.Cells(b, c))
                rr.Merge()
                # un grupo largo cruza hojas: el nombre arriba, para que se lea en la primera hoja del grupo
                rr.VerticalAlignment = -4160 if b - a > 12 else -4108
                rr.HorizontalAlignment = -4108
    ws.Range(ws.Rows(primera), ws.Rows(r - 1)).AutoFit()
    # un minimo de alto para que el texto no quede pegado al borde al imprimir
    for rr in range(primera, r):
        if ws.Rows(rr).RowHeight < 30:
            ws.Rows(rr).RowHeight = 30
        else:
            ws.Rows(rr).RowHeight = ws.Rows(rr).RowHeight + 8
    ws.ResetAllPageBreaks()
    for s in saltos:
        ws.HPageBreaks.Add(ws.Cells(s, 2))
    return len([f for f in filas if '_seccion' not in f])


def abrir_excel():
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    # el "ultimo autor" del archivo sale de aca al guardar: en un plan de control no figura Fak ni una IA
    xl.UserName = 'Barack Mercosul'
    return xl


def autor_limpio_xlsx(xlsx):
    """Excel 365 escribe la cuenta de Office en docProps/core.xml (lastModifiedBy) al guardar. En un plan de control no
    figura Fak: se reescribe y se relee. Frena si queda el nombre."""
    import shutil
    import tempfile
    import zipfile
    viejo, nuevo = 'Facundo Santoro', 'Barack Mercosul'
    fd, tmp = tempfile.mkstemp(suffix='.xlsx')
    os.close(fd)
    with zipfile.ZipFile(xlsx) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            datos = zin.read(item.filename)
            if item.filename in ('docProps/core.xml', 'docProps/app.xml'):
                texto = datos.decode('utf-8')
                texto = re.sub(r'<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', f'<cp:lastModifiedBy>{nuevo}</cp:lastModifiedBy>', texto)
                texto = re.sub(r'<dc:creator>[^<]*</dc:creator>', f'<dc:creator>{nuevo}</dc:creator>', texto)
                texto = texto.replace(viejo, nuevo)
                datos = texto.encode('utf-8')
            zout.writestr(item, datos)
    shutil.move(tmp, xlsx)
    with zipfile.ZipFile(xlsx) as z:
        for nombre in ('docProps/core.xml', 'docProps/app.xml'):
            if nombre in z.namelist() and viejo in z.read(nombre).decode('utf-8'):
                raise RuntimeError(f'el archivo sigue con "{viejo}" en {nombre}')
