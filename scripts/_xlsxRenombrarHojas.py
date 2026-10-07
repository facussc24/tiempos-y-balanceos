# -*- coding: utf-8 -*-
"""Renombra y reordena pestañas de un .xlsx editando el XML por dentro, sobre una COPIA (o la misma copia).

    python scripts/_xlsxRenombrarHojas.py <libro.xlsx> <mapa.json> [--apply]

mapa.json: {"renombrar": {"21": "20.1", "100": "82"}, "orden": ["10", "20", "20.1", ...]}
  - "orden" (opcional) es la lista COMPLETA de nombres finales en el orden de las pestañas.

Toca: el nombre en xl/workbook.xml, las referencias 'hoja'! de los nombres definidos (areas de
impresion) y de las formulas de las hojas, los localSheetId cuando cambia el orden, y la lista de
titulos de docProps/app.xml. No toca nada mas (el libro lleva imagenes en celda: ni openpyxl ni COM).
No sirve para el ORIGEN del servidor: se corre sobre la copia de trabajo.
"""
import json
import os
import re
import shutil
import sys
import zipfile
from xml.sax.saxutils import escape


def ref(nombre):
    """Como escribe Excel una referencia a la hoja en una formula: 'nombre'! (las comillas siempre sirven)."""
    return "'%s'!" % nombre.replace("'", "''")


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    libro, mapa_f = sys.argv[1], sys.argv[2]
    apply = '--apply' in sys.argv
    if libro.upper().startswith('Y:'):
        raise SystemExit('Esto se corre sobre la copia de trabajo, no sobre el servidor.')
    mapa = json.load(open(mapa_f, encoding='utf-8'))
    ren = mapa.get('renombrar', {})
    with zipfile.ZipFile(libro) as z:
        partes = {n: z.read(n) for n in z.namelist()}
        infos = z.infolist()
    wb = partes['xl/workbook.xml'].decode('utf-8')
    hojas = re.findall(r'<sheet\b[^>]*/>', wb)
    nombres = [re.search(r'\bname="([^"]*)"', h).group(1) for h in hojas]
    faltan = [k for k in ren if k not in nombres]
    if faltan:
        raise SystemExit('No existen estas pestañas: %s' % faltan)
    finales = [ren.get(n, n) for n in nombres]
    if len(set(finales)) != len(finales):
        raise SystemExit('Quedarian dos pestañas con el mismo nombre: %s' % finales)
    orden = mapa.get('orden') or finales
    if sorted(orden) != sorted(finales):
        raise SystemExit('"orden" no tiene las mismas pestañas que quedan:\n  %s\n  %s' % (sorted(orden), sorted(finales)))
    viejo_idx = {f: i for i, f in enumerate(finales)}        # nombre final -> indice viejo
    nuevo_idx = {viejo_idx[f]: j for j, f in enumerate(orden)}  # indice viejo -> indice nuevo

    # 1. <sheets>: renombrar y reordenar
    tag_de = {}
    for h, n in zip(hojas, nombres):
        tag_de[ren.get(n, n)] = re.sub(r'\bname="[^"]*"', 'name="%s"' % escape(ren.get(n, n), {'"': '&quot;'}), h, 1)
    bloque = re.search(r'<sheets>.*?</sheets>', wb, flags=re.S)
    wb = wb[:bloque.start()] + '<sheets>' + ''.join(tag_de[f] for f in orden) + '</sheets>' + wb[bloque.end():]
    # 2. localSheetId de los nombres definidos
    wb = re.sub(r'localSheetId="(\d+)"', lambda m: 'localSheetId="%d"' % nuevo_idx[int(m.group(1))], wb)
    # pestaña activa / primera visible
    wb = re.sub(r'\b(activeTab|firstSheet)="(\d+)"', lambda m: '%s="%d"' % (m.group(1), nuevo_idx.get(int(m.group(2)), 0)), wb)

    def cambiar_refs(txt):
        for viejo, nuevo in ren.items():
            for forma in ("'%s'!" % viejo.replace("'", "''"), '%s!' % viejo):
                txt = re.sub(r"(?<![\w'.])" + re.escape(forma), ref(nuevo).replace('\\', r'\\'), txt)
        return txt

    wb = re.sub(r'(<definedName\b[^>]*>)(.*?)(</definedName>)', lambda m: m.group(1) + cambiar_refs(m.group(2)) + m.group(3), wb, flags=re.S)
    nuevas = {'xl/workbook.xml': wb.encode('utf-8')}
    # 3. formulas que nombran otra hoja
    for n, data in partes.items():
        if n.startswith('xl/worksheets/sheet') and n.endswith('.xml'):
            s = data.decode('utf-8')
            s2 = re.sub(r'(<f\b[^>]*>)(.*?)(</f>)', lambda m: m.group(1) + cambiar_refs(m.group(2)) + m.group(3), s, flags=re.S)
            if s2 != s:
                nuevas[n] = s2.encode('utf-8')
    # 4. titulos en docProps/app.xml
    if 'docProps/app.xml' in partes:
        app = partes['docProps/app.xml'].decode('utf-8')
        m = re.search(r'(<TitlesOfParts>\s*<vt:vector[^>]*>)(.*?)(</vt:vector>)', app, flags=re.S)
        if m:
            lps = re.findall(r'<vt:lpstr>(.*?)</vt:lpstr>', m.group(2))
            hojas_app = [x for x in lps if x in nombres]
            otros = [x for x in lps if x not in nombres]
            if len(hojas_app) == len(nombres):
                cuerpo = ''.join('<vt:lpstr>%s</vt:lpstr>' % escape(x) for x in orden + otros)
                app = app[:m.start(2)] + cuerpo + app[m.end(2):]
                nuevas['docProps/app.xml'] = app.encode('utf-8')

    for n, f in zip(nombres, finales):
        if n != f:
            print('  %s -> %s' % (n, f))
    print('  orden: %s' % ' '.join(orden))
    if not apply:
        print('DRY-RUN: nada escrito.')
        return
    tmp = libro + '.tmp'
    with zipfile.ZipFile(tmp, 'w') as z:
        for info in infos:
            z.writestr(info, nuevas.get(info.filename, partes[info.filename]), compress_type=info.compress_type)
    st = os.stat(libro)
    shutil.move(tmp, libro)
    os.utime(libro, (st.st_atime, st.st_mtime))
    import openpyxl
    leido = openpyxl.load_workbook(libro, read_only=True).sheetnames
    if leido != orden:
        raise SystemExit('ERROR: al releer las pestañas quedaron %s' % leido)
    print('  verificado: las pestañas quedaron en ese orden y con esos nombres.')


if __name__ == '__main__':
    main()
