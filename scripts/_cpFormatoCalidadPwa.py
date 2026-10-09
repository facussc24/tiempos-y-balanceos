"""
_cpFormatoCalidadPwa.py — arma los planes de control de las telas Hilux de PWA (planas 21-9463 y
termoformadas 582D) en el FORMATO DE CALIDAD: la hoja de `PC PWA.xlsx` (Calidad, PPAP CLIENTES\\PWA),
con su encabezado, la tabla de REVISIONES, las firmas y las columnas de siempre.

Fak, 09/10/2026: *"deberiamos usar el formato que tiene actualmente Calidad, porque el que tenes
tiene como un formato inventado"*. El export de la app no es el formulario de la casa.

Uso:
    node scripts/_cpFormatoCalidadPwa.mjs <carpeta_json>        (baja los datos de la base)
    python scripts/_cpFormatoCalidadPwa.py <carpeta_json> <carpeta_salida>

Copia la hoja 21-6621 de la plantilla con Excel (abre el original en SOLO LECTURA y no lo guarda),
borra lo que es de esa pieza y escribe el encabezado, las revisiones y las filas del plan de la base.
Lo que no esta en ninguna fuente queda en blanco (codigo del cliente, plano ECN).
Las filas del control de agujas (reclamo PWA 20/08/2026) van en amarillo.
"""
import json
import os
import re
import sys

import win32com.client as win32

PLANTILLA = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\PWA\PC PWA.xlsx'
HOJA = '21-6621'
PRIMERA = 46          # primera fila de datos de la plantilla
AMARILLO = 65535      # RGB(255,255,0) en BGR de Excel
ROJO = 255

PLANES = {
    'planas': {
        'pieza': '21-9463', 'hoja': '21-9463',
        'descripcion': 'TELAS PLANAS HILUX 581D',
        'archivo': 'PC 21-9463 TELAS PLANAS HILUX - Rev.A.xlsx',
        'troquelado': 'OP 50',
    },
    'termo': {
        'pieza': '21-9640 / 21-9641 / 21-9642 / 21-9643', 'hoja': '582D',
        'descripcion': 'TELAS TERMOFORMADAS HILUX 582D',
        'archivo': 'PC 582D TELAS TERMOFORMADAS HILUX - Rev.A.xlsx',
        'troquelado': 'OP 60',
    },
}


def es_agujas(it):
    return bool(re.search(r'(?i)agujas', it.get('productCharacteristic', '')))


def armar(xl, plantilla_wb, clave, cfg, carpeta_json, salida):
    doc = json.load(open(os.path.join(carpeta_json, f'cp_{clave}.json'), encoding='utf-8'))
    h, items = doc['header'], doc['items']

    plantilla_wb.Sheets(HOJA).Copy()
    nb = xl.ActiveWorkbook
    ws = nb.Sheets(1)
    ws.Name = cfg['hoja']
    links = nb.LinkSources(1)
    if links:
        for l in links:
            nb.BreakLink(l, 1)

    # ── Encabezado ─────────────────────────────────────────────────────────
    ws.Range('D33').Value = cfg['pieza']
    ws.Range('B36').Value = cfg['descripcion']
    ws.Range('H36').Value = 'PWA'
    ws.Range('H38').Value = ''            # codigo del cliente: no esta en la base
    ws.Range('N38').Value = ''            # plano ECN: idem
    ws.Range('H32').Value = ''            # contacto: la base no lo tiene
    ws.Range('L32').Value = "'" + (h.get('date') or '')
    ws.Range('N32').Value = "'09/10/2026"
    ws.Range('L34').Value = "'09/10/2026"
    equipo = h.get('coreTeam') or []
    ws.Range('H34').Value = ' / '.join(re.sub(r'\s*\(.*?\)', '', e).upper() for e in equipo)
    # nivel de actualizacion (recuadro de la derecha)
    for it in ws.Shapes('Grupo 21').GroupItems:
        try:
            if it.TextFrame2.TextRange.Text.strip() == 'G':
                it.TextFrame2.TextRange.Text = h.get('rev') or 'A'
        except Exception:
            pass
    # fase: la tilde de PRODUCCION pasa a PRELANZAMIENTO (la base dice preLaunch)
    if h.get('phase') == 'preLaunch':
        tilde, vacio = ws.Shapes('Picture 18'), ws.Shapes('Picture 19')
        tl, vl = tilde.Left, vacio.Left
        tilde.Left, vacio.Left = vl, tl

    # ── Revisiones ─────────────────────────────────────────────────────────
    rev = ws.Range('B9:O21')
    rev.UnMerge()
    rev.ClearContents()
    for r in range(9, 22):
        ws.Range(f'D{r}:E{r}').Merge()
        ws.Range(f'F{r}:M{r}').Merge()
    filas_rev = [
        ('A', h.get('date') or '', 'N/A', 'EMISION INICIAL.', ''),
        ('A', '09/10/2026', f"OP10 / {cfg['troquelado'].replace(' ', '')}",
         'Se agrega control tactil de presencia de agujas en el fieltro en recepcion y en troquelado (reclamo PWA 20/08/2026).', 'FS'),
    ]
    for i, (r_, f_, item, det, mod) in enumerate(filas_rev):
        fila = 9 + i
        ws.Range(f'B{fila}').Value = r_
        ws.Range(f'C{fila}').Value = "'" + f_
        ws.Range(f'D{fila}').Value = item
        ws.Range(f'F{fila}').Value = det
        ws.Range(f'O{fila}').Value = mod
    ws.Range('F10').Interior.Color = AMARILLO

    # ── Filas del plan ─────────────────────────────────────────────────────
    zona = ws.Range(f'B{PRIMERA}:O200')
    zona.UnMerge()
    zona.ClearContents()
    ultima = PRIMERA + len(items) - 1
    ws.Range('G48').Copy()
    ws.Range(f'B{PRIMERA}:O{ultima}').PasteSpecial(-4122)       # solo formato
    ws.Range(f'B{ultima + 1}:O200').Clear()
    ws.Range(f'B{PRIMERA}:O{ultima}').Interior.ColorIndex = -4142
    ws.Range(f'B{PRIMERA}:O{ultima}').Font.Bold = False
    ws.Range(f'B{PRIMERA}:O{ultima}').Font.Color = 0
    for b in (7, 8, 9, 10, 11, 12):                              # bordes finos en toda la grilla
        ws.Range(f'B{PRIMERA}:O{ultima}').Borders(b).LineStyle = 1
        ws.Range(f'B{PRIMERA}:O{ultima}').Borders(b).Weight = 2

    grupos = []
    for i, it in enumerate(items):
        fila = PRIMERA + i
        op = it['processStepNumber']
        if not grupos or grupos[-1][0] != op:
            grupos.append([op, fila, fila, 0])
        g = grupos[-1]
        g[2] = fila
        g[3] += 1
        if g[1] == fila:
            n = re.sub(r'^OP\s*', '', op)
            ws.Range(f'B{fila}').Value = f'Operación {n}.'
            ws.Range(f'C{fila}').Value = it.get('processDescription', '')
            ws.Range(f'D{fila}').Value = it.get('machineDeviceTool', '') or '--'
        ws.Range(f'E{fila}').Value = g[3]
        ws.Range(f'F{fila}').Value = it.get('productCharacteristic', '')
        ws.Range(f'G{fila}').Value = it.get('processCharacteristic', '') or '--'
        sigla = it.get('specialCharClass', '') or '--'
        ws.Range(f'H{fila}').Value = sigla
        if sigla in ('CC', 'SC'):
            ws.Range(f'H{fila}').Font.Color = ROJO
            ws.Range(f'H{fila}').Font.Bold = True
        ws.Range(f'I{fila}').Value = it.get('specification', '')
        ws.Range(f'J{fila}').Value = it.get('evaluationTechnique', '')
        ws.Range(f'K{fila}').Value = it.get('sampleSize', '')
        ws.Range(f'L{fila}').Value = it.get('sampleFrequency', '')
        ws.Range(f'M{fila}').Value = it.get('controlMethod', '')
        ws.Range(f'N{fila}').Value = it.get('reactionPlanOwner', '')
        ws.Range(f'O{fila}').Value = it.get('reactionPlan', '')
        if es_agujas(it):
            ws.Range(f'E{fila}:O{fila}').Interior.Color = AMARILLO
    for op, f1, f2, _ in grupos:
        if f2 > f1:
            for col in 'BCD':
                ws.Range(f'{col}{f1}:{col}{f2}').Merge()
    ws.Range(f'B{PRIMERA}:O{ultima}').WrapText = True
    ws.Range(f'B{PRIMERA}:O{ultima}').HorizontalAlignment = -4108
    ws.Range(f'B{PRIMERA}:O{ultima}').VerticalAlignment = -4108
    ws.Range(f'{PRIMERA}:{ultima}').EntireRow.AutoFit()
    for r in range(PRIMERA, ultima + 1):
        if ws.Rows(r).RowHeight < 30:
            ws.Rows(r).RowHeight = 30

    ws.PageSetup.PrintArea = f'$B$2:$O${ultima}'
    ws.ResetAllPageBreaks()
    ws.HPageBreaks.Add(ws.Range('B24'))     # hoja 1: revisiones y firmas; hoja 2: encabezado y filas
    nb.BuiltinDocumentProperties('Author').Value = 'Facundo Santoro'
    nb.BuiltinDocumentProperties('Last Author').Value = 'Facundo Santoro'
    destino = os.path.abspath(os.path.join(salida, cfg['archivo']))
    if os.path.exists(destino):
        os.remove(destino)
    nb.SaveAs(destino, 51)
    nb.Close(False)
    print('OK', destino, len(items), 'filas')


def main():
    carpeta_json, salida = sys.argv[1], sys.argv[2]
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    xl.AskToUpdateLinks = False
    try:
        pw = xl.Workbooks.Open(PLANTILLA, 0, True)
        try:
            for clave, cfg in PLANES.items():
                armar(xl, pw, clave, cfg, carpeta_json, salida)
        finally:
            pw.Close(False)
    finally:
        xl.Quit()


if __name__ == '__main__':
    main()
