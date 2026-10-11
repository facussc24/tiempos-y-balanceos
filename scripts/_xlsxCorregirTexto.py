# -*- coding: utf-8 -*-
"""Corrige textos de celdas de un .xlsx editando el XML por dentro, sobre una COPIA.

    python scripts/_xlsxCorregirTexto.py <cambios.json>            # dry-run: dice que cambiaria
    python scripts/_xlsxCorregirTexto.py <cambios.json> --apply    # escribe las copias y las verifica

Para que: las hojas de proceso de Barack llevan imagenes "en celda" (el logo de B2 se lee #VALUE!).
Guardarlas con Excel (COM) u openpyxl se las lleva puestas (memoria
reference_hojas_de_operaciones_carpeta_estado). Este script toca SOLO los bytes del texto que cambia.

cambios.json:
  [{"origen": "Y:/.../HO.xlsx", "destino": "exports/.../HO.xlsx",
    "cambios": [{"hoja": "40", "celda": "J11", "viejo": "Cololar", "nuevo": "Colocar"},
                {"hoja": "60", "celda": "I16", "viejo": 3, "nuevo": "3."}]}]
  - "viejo" texto: tiene que estar ADENTRO de la celda (se reemplaza esa parte, una vez por aparicion).
  - "viejo" numero o "*celda*": la celda entera pasa a valer "nuevo" (texto).
  Si "viejo" no esta, el cambio se SALTA y se dice (la celda ya no dice lo que esperabamos).

Verificacion con --apply: relee la copia con openpyxl y exige que (1) cada celda cambiada diga lo
esperado y (2) TODAS las demas celdas de TODAS las hojas sigan iguales al origen. El origen no se toca.
"""
import json
import os
import re
import shutil
import sys
import zipfile
from xml.sax.saxutils import escape, unescape

NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def _leer_zip(ruta):
    with zipfile.ZipFile(ruta) as z:
        return {n: z.read(n) for n in z.namelist()}, [i for i in z.infolist()]


def _hojas(partes):
    """nombre de hoja -> parte xml (xl/worksheets/sheetN.xml)."""
    wb = partes['xl/workbook.xml'].decode('utf-8')
    rels = partes['xl/_rels/workbook.xml.rels'].decode('utf-8')
    destino = {}
    for m in re.finditer(r'<Relationship\b[^>]*>', rels):
        tag = m.group(0)
        rid = re.search(r'\bId="([^"]+)"', tag).group(1)
        tgt = re.search(r'\bTarget="([^"]+)"', tag).group(1)
        tgt = tgt.lstrip('/')
        if not tgt.startswith('xl/'):
            tgt = 'xl/' + tgt
        destino[rid] = tgt
    out = {}
    for m in re.finditer(r'<sheet\b[^>]*/>', wb):
        tag = m.group(0)
        nombre = unescape(re.search(r'\bname="([^"]*)"', tag).group(1), {'&quot;': '"', '&apos;': "'"})
        rid = re.search(r'\br:id="([^"]+)"', tag).group(1)
        out[nombre] = destino[rid]
    return out


class Compartidos:
    def __init__(self, xml):
        self.xml = xml
        m = re.search(r'<sst\b[^>]*>', xml)
        self.inicio = m.end()
        self.fin = xml.rindex('</sst>')
        self.items = re.findall(r'<si>.*?</si>|<si/>', xml[self.inicio:self.fin], flags=re.S)
        self.nuevos = []

    @staticmethod
    def texto(si):
        return ''.join(unescape(t) for t in re.findall(r'<t(?:\s[^>]*)?>(.*?)</t>', si, flags=re.S))

    def agregar(self, texto):
        self.nuevos.append('<si><t xml:space="preserve">%s</t></si>' % escape(texto))
        return len(self.items) + len(self.nuevos) - 1

    def armar(self):
        todos = self.items + self.nuevos
        cab = self.xml[:self.inicio]
        n = len(todos)
        cab = re.sub(r'\buniqueCount="\d+"', 'uniqueCount="%d"' % n, cab)
        return cab + ''.join(todos) + self.xml[self.fin:]


def _reemplazar_en_si(si, viejo, nuevo):
    """Reemplaza 'viejo' dentro de UN <t> del <si>. None si no esta entero en un solo <t>."""
    for m in re.finditer(r'(<t(?:\s[^>]*)?>)(.*?)(</t>)', si, flags=re.S):
        txt = unescape(m.group(2))
        if viejo in txt:
            nuevo_txt = txt.replace(viejo, nuevo)
            abre = m.group(1)
            if 'xml:space' not in abre:
                abre = abre[:-1] + ' xml:space="preserve">'
            return si[:m.start()] + abre + escape(nuevo_txt) + m.group(3) + si[m.end():]
    return None


def _usos(partes, hojas_xml, idx):
    n = 0
    for parte in set(hojas_xml.values()):
        n += len(re.findall(r'<c\b[^>]*\bt="s"[^>]*><v>%d</v>' % idx, partes[parte].decode('utf-8')))
    return n


def corregir(origen, destino, cambios, apply):
    partes, infos = _leer_zip(origen)
    hojas = _hojas(partes)
    sst = Compartidos(partes['xl/sharedStrings.xml'].decode('utf-8'))
    editadas = {}
    hechos, saltados = [], []
    esperado = {}
    for c in cambios:
        hoja, celda, viejo, nuevo = c['hoja'], c['celda'], c['viejo'], c['nuevo']
        if hoja not in hojas:
            saltados.append((hoja, celda, 'no existe la hoja')); continue
        parte = hojas[hoja]
        xml = editadas.get(parte) or partes[parte].decode('utf-8')
        m = re.search(r'<c r="%s"(?=[\s>/])[^>]*?(?:/>|>.*?</c>)' % celda, xml, flags=re.S)
        if not m:
            saltados.append((hoja, celda, 'celda vacia o inexistente')); continue
        tag = m.group(0)
        if '<f>' in tag or '<f ' in tag:
            saltados.append((hoja, celda, 'tiene formula')); continue
        es_s = re.search(r'\bt="s"', tag) is not None
        v = re.search(r'<v>(.*?)</v>', tag)
        actual = sst.texto(sst.items[int(v.group(1))]) if (es_s and v) else (v.group(1) if v else None)
        celda_entera = not isinstance(viejo, str) or viejo == '*celda*'
        if celda_entera:
            if not isinstance(viejo, str) and (actual is None or float(actual) != float(viejo)):
                saltados.append((hoja, celda, 'esperaba %r y dice %r' % (viejo, actual))); continue
            final = nuevo
            nuevo_idx = sst.agregar(final)
            abre = re.match(r'<c\b[^>]*?(?=/?>)', tag).group(0)
            abre = re.sub(r'\s+t="[^"]*"', '', abre) + ' t="s"'
            tag_nuevo = '%s><v>%d</v></c>' % (abre, nuevo_idx)
        else:
            if not es_s or actual is None or viejo not in actual:
                saltados.append((hoja, celda, 'no dice %r (dice %r)' % (viejo, actual))); continue
            idx = int(v.group(1))
            si_nuevo = _reemplazar_en_si(sst.items[idx], viejo, nuevo)
            if si_nuevo is None:
                saltados.append((hoja, celda, 'el texto esta partido en varios formatos')); continue
            final = sst.texto(si_nuevo)
            if _usos(partes if not editadas else {**partes, **{k: v2.encode('utf-8') for k, v2 in editadas.items()}}, hojas, idx) == 1:
                sst.items[idx] = si_nuevo
                tag_nuevo = tag
            else:
                nuevo_idx = len(sst.items) + len(sst.nuevos)
                sst.nuevos.append(si_nuevo)
                tag_nuevo = tag.replace(v.group(0), '<v>%d</v>' % nuevo_idx, 1)
        xml = xml[:m.start()] + tag_nuevo + xml[m.end():]
        editadas[parte] = xml
        esperado[(hoja, celda)] = final
        hechos.append((hoja, celda, actual, final))

    for h in hechos:
        print('  OK   %s!%s\n       antes:   %r\n       despues: %r' % h)
    for s in saltados:
        print('  SALTA %s!%s: %s' % s)
    if not apply:
        return len(saltados)

    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)
    if os.path.abspath(destino) == os.path.abspath(origen):
        raise SystemExit('El destino no puede ser el origen.')
    nuevas = {k: v.encode('utf-8') for k, v in editadas.items()}
    nuevas['xl/sharedStrings.xml'] = sst.armar().encode('utf-8')
    tmp = destino + '.tmp'
    with zipfile.ZipFile(tmp, 'w') as z:
        for info in infos:
            z.writestr(info, nuevas.get(info.filename, partes[info.filename]), compress_type=info.compress_type)
    shutil.move(tmp, destino)
    shutil.copystat(origen, destino)
    return len(saltados) + verificar(origen, destino, esperado)


def verificar(origen, destino, esperado):
    # La lectura de los dos libros es la de `_xlsxComparar.py` (una sola, cola HOY-18a): {hoja: {celda: valor}}
    # con el valor calculado. Las celdas vacias no vienen, por eso se suman las celdas ESPERADAS de cada hoja.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _xlsxComparar import leer_libro, _norm
    a = leer_libro(origen, data_only=True)
    b = leer_libro(destino, data_only=True)
    errores = 0
    for hoja, va in a.items():
        vb = b[hoja]
        for k in set(va) | set(vb) | {c for (h, c) in esperado if h == hoja}:
            key = (hoja, k)
            if key in esperado:
                # el XML guarda "\r\n" literal y el lector lo normaliza a "\n": se comparan normalizados
                if _norm(vb.get(k)) != _norm(esperado[key]):
                    print('  ERROR %s!%s quedo %r y se esperaba %r' % (hoja, k, vb.get(k), esperado[key])); errores += 1
            elif va.get(k) != vb.get(k):
                print('  ERROR %s!%s cambio sin pedirlo: %r -> %r' % (hoja, k, va.get(k), vb.get(k))); errores += 1
    print('  verificacion: %s' % ('OK, solo cambiaron las %d celdas pedidas' % len(esperado) if not errores else '%d ERRORES' % errores))
    return errores


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    apply = '--apply' in sys.argv
    with open(sys.argv[1], encoding='utf-8') as f:
        lote = json.load(f)
    problemas = 0
    for libro in lote:
        print('\n%s\n  -> %s' % (libro['origen'], libro['destino']))
        problemas += corregir(libro['origen'], libro['destino'], libro['cambios'], apply)
    print('\n%s. Saltados o errores: %d' % ('APLICADO' if apply else 'DRY-RUN (nada escrito)', problemas))
    sys.exit(1 if problemas else 0)


if __name__ == '__main__':
    main()
