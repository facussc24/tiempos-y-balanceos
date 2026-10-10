"""
numerosMail.py — un numero con unidad en un mail lleva su papel (cola H12, 09/10/2026).

Origen: 09/10/2026 11:28, mail a Carlos «Espuma Mentvil en rollo de 2 m»: «Hoy viene de 1,55 m... el Tesa 52110 viene
de 1,50 m, asi que con 2 m quedan 50 cm». Sin adjunto y sin decir de donde salian. Fak, 11:29, con el mail ya enviado:
*"¿de donde sacaste eso?"*. Regla de Fak (prompt v3, 14): "un numero en un mail lleva su papel".

Que hace: busca en el cuerpo cada NUMERO CON UNIDAD (m, cm, mm, m2, kg, g, g/m2, %, pz, min, h, °C, $...) y lo da por
"con papel" si (a) el mismo numero esta en el texto de algun adjunto, o (b) la oracion donde esta nombra de donde sale
(segun, me aviso/dijo/paso, el mail de, la planilla, el arb, la BOM, el plano, la ficha, la OC, INCA, el calculo de,
medido/pese...). Lo demas sale como AVISO antes de mandar: la decision es de Fak, que ve el borrador. No frena.

Lo que no cuenta como numero con unidad: fechas, horas (10:00), telefonos, codigos (Tesa 52110, 21-9463), y lo que
esta despues de la firma («Saludos»). Casos: `python scripts/_lib/numerosMail.py --selftest` (tambien corren con
`_mailEnviar.py --selftest`).
"""
from __future__ import annotations

import os
import re
import sys
import zipfile

UNIDADES = (r'mm|cm|m2|m²|m3|m³|m|kg|g/m2|g/m²|g|gr|%|pz|pzas|pzs|piezas|unidades|u|ml|lt|l|°c|º c|°|min|seg|s|hs|h|horas|hora|'
            r'usd|u\$s|ars|kg/m2|kg/m²|mm2|mm²|rpm|bar|n|nm|v|w|kw|ton|tn|mts|mt')
_NUMERO_UNIDAD = re.compile(
    r'(?<![\w/.,:-])(\$\s?\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)*)\s?(' + UNIDADES + r')(?![\w/²³])',
    re.IGNORECASE)
_FUENTE = re.compile(
    r'\bseg[uú]n\b|\bme\s+(avis[oó]|dijo|pas[oó]|mand[oó]|confirm[oó]|contest[oó])\b|\bnos\s+(avis[oó]|dijo|pas[oó]|mand[oó])\b|'
    r'\bel\s+mail\b|\bla\s+planilla\b|\bel\s+arb\b|\bla\s+bom\b|\bel\s+plano\b|\bla\s+ficha\b|\bla\s+oc\b|orden\s+de\s+compra|'
    r'\binca\b|mesa\s+de\s+corte|c[aá]lculo\s+de|\badjunt|\bfigura\s+en\b|\blo\s+dice\b|\bdice\s+(el|la)\b|'
    r'\bmed[ií]\b|\bmedido|\bpes[eé]\b|\bpesado|\bcontamos\b|\bcont[eé]\b|\bcotiz|\bpresupuesto\b|\bhoja\s+de\s+datos|'
    r'\bcertificado|\bensayo|\binforme\s+de|\bremito|\bfactura|\bextracto|\bdifundo|\bla\s+tizada|\bel\s+marker',
    re.IGNORECASE)
_FIRMA = re.compile(r'\n\s*(saludos|gracias|atentamente|cordialmente)\b', re.IGNORECASE)
_CITADO = re.compile(r'\n\s*(de:|from:|-----\s*mensaje original|el .{5,60} escribi[oó]:)', re.IGNORECASE)
_HORA = re.compile(r'\b\d{1,2}:\d{2}\b')


def cuerpo_propio(texto: str) -> str:
    """Lo que escribio Fak en ESTE mail: antes de la firma y antes de lo citado."""
    t = str(texto or '').replace('\r\n', '\n')
    for rx in (_FIRMA, _CITADO):
        m = rx.search(t)
        if m:
            t = t[:m.start()]
    return t


def _oraciones(texto: str) -> list[str]:
    # no se corta en ':' ni en ';': «con el cálculo de Pablo Gamboa: 0,0992 m²» es UNA oración y la fuente va antes del numero
    return [o.strip() for o in re.split(r'(?<=[.!?])\s+|\n{2,}', texto) if o.strip()]


def numeros_con_unidad(texto: str) -> list[tuple[str, str, str]]:
    """[(numero, unidad, oracion)] del cuerpo propio. Un '10:00' o un '09/10' no entran."""
    out = []
    for o in _oraciones(cuerpo_propio(texto)):
        sin_horas = _HORA.sub(' ', o)
        for m in _NUMERO_UNIDAD.finditer(sin_horas):
            num, uni = m.group(1).replace(' ', ''), m.group(2)
            # 'm' / 'u' / 's' / 'l' / 'n' / 'v' / 'w' / 'h' pegados a una palabra ya los corta el (?![\w...]); un '2 m' queda
            out.append((num, uni, o))
    return out


def _formas(num: str) -> set[str]:
    n = num.lstrip('$').strip()
    return {n, n.replace(',', '.'), n.replace('.', ','), n.replace('.', '').replace(',', '.')}


def tiene_fuente(oracion: str) -> bool:
    return bool(_FUENTE.search(oracion or ''))


def numeros_sin_papel(cuerpo: str, textos_adjuntos: list[str] | None = None) -> list[dict]:
    """Los numeros con unidad del cuerpo que no estan en ningun adjunto ni tienen la fuente en su oracion."""
    adj = '\n'.join(textos_adjuntos or [])
    out = []
    vistos = set()
    for num, uni, o in numeros_con_unidad(cuerpo):
        clave = f'{num} {uni}'.lower()
        if clave in vistos:
            continue
        vistos.add(clave)
        if adj and any(re.search(r'(?<![\d.,])' + re.escape(f) + r'(?![\d])', adj) for f in _formas(num)):
            continue
        if tiene_fuente(o):
            continue
        out.append({'numero': f'{num} {uni}', 'oracion': re.sub(r'\s+', ' ', o)[:140]})
    return out


def texto_de_adjunto(ruta: str, max_mb: float = 25) -> str:
    """El texto de un adjunto, lo mejor que se pueda sin frenar: Excel (celdas), PDF, Word/PowerPoint (XML), texto."""
    ext = os.path.splitext(ruta)[1].lower()
    try:
        if os.path.getsize(ruta) > max_mb * 1024 * 1024:
            return ''
        if ext in ('.xlsx', '.xlsm'):
            import openpyxl
            wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
            partes = []
            for ws in wb.worksheets:
                for fila in ws.iter_rows(values_only=True):
                    partes.extend(str(v) for v in fila if v is not None)
            return '\n'.join(partes)
        if ext == '.pdf':
            import fitz
            with fitz.open(ruta) as doc:
                return '\n'.join(p.get_text() or '' for p in doc)
        if ext in ('.docx', '.pptx', '.xlsx'):
            with zipfile.ZipFile(ruta) as z:
                xml = '\n'.join(z.read(n).decode('utf-8', 'replace') for n in z.namelist() if n.lower().endswith('.xml'))
            return re.sub(r'<[^>]+>', ' ', xml)
        if ext in ('.txt', '.csv', '.md', '.htm', '.html'):
            return open(ruta, 'rb').read().decode('utf-8', 'replace')
    except Exception:
        return ''
    return ''


def renglones_aviso(sin_papel: list[dict]) -> list[str]:
    return [f'  OJO número sin papel: {x["numero"]} — «{x["oracion"]}» (no está en ningún adjunto ni la oración dice de dónde sale)' for x in sin_papel]


# ── selftest ──────────────────────────────────────────────────────────────────

MENTVIL = ('Carlos, buen día. Federico me avisó que Mentvil quiere mandar la espuma del Insert y del IP Pad en rollo de 2 m. '
           'Hoy viene de 1,55 m. El problema es el adhesivado en Conversión de Cinta: el Tesa 52110 viene de 1,50 m, así que con '
           '2 m quedan 50 cm de espuma sin cinta, que van a scrap o necesitan una segunda pasada. Saludos. Facundo Santoro '
           'Ingeniería Barack Mercosul Los Árboles 842 B1686 - Hurlingham Cel. +54 9 11-5992-2948')
BOM = ('Estimados, Difundo actualización a último nivel de BOM vigente en ARB para los semielaborados de los insertos de puerta. '
       'Actualicé el consumo de espuma y de Tesa con el cálculo de troquelado en prensa de Pablo Gamboa: 0,0992 m² por pieza, '
       'igual para delantero y trasero. Adjunto el extracto. Saludos, Facundo Santoro')


def selftest() -> int:
    fallas = 0

    def caso(nombre, ok):
        nonlocal fallas
        print(f'  {"OK  " if ok else "MAL "} {nombre}')
        fallas += 0 if ok else 1

    r = numeros_sin_papel(MENTVIL)
    caso('09/10 Mentvil (real, sin adjunto): avisa 1,55 m y 1,50 m / 50 cm; el 2 m tiene fuente («Federico me avisó»)',
         [x['numero'] for x in r] == ['1,55 m', '1,50 m', '50 cm'])
    caso('la firma no cuenta (Los Árboles 842, B1686, el celular)', not any('842' in x['numero'] or '1686' in x['numero'] or '5992' in x['numero'] for x in r))
    caso('el código Tesa 52110 no es un número con unidad', not any('52110' in x['numero'] for x in r))
    caso('12:47 BOM (real): 0,0992 m² con «el cálculo de troquelado de Pablo Gamboa»: con papel', numeros_sin_papel(BOM) == [])
    caso('un número que está en el adjunto tiene papel', numeros_sin_papel('El consumo queda en 0,023 kg por pieza.', ['Sika 923852 KG 0.023']) == [])
    caso('el mismo número sin adjunto y sin fuente avisa', [x['numero'] for x in numeros_sin_papel('El consumo queda en 0,023 kg por pieza.')] == ['0,023 kg'])
    caso('«según la planilla de Mesa de Corte» es fuente', numeros_sin_papel('Según la planilla de Mesa de Corte son 0,45 m por pieza.') == [])
    caso('una hora (10:00) y una fecha no son números con unidad', numeros_sin_papel('La reunión es a las 10:00 del 09/10. Va a durar como máximo una hora.') == [])
    caso('lo citado debajo (De: ...) no se mira', numeros_sin_papel('Dale, lo miro.\n\nDe: Pablo Gamboa\nEnviado: ayer\nEl consumo es 0,45 m por pieza.') == [])
    caso('porcentaje sin fuente avisa; con «medido» no', [x['numero'] for x in numeros_sin_papel('La merma es 5 %.')] == ['5 %'] and numeros_sin_papel('Medido en planta: la merma es 5 %.') == [])
    print(f'\nselftest numerosMail: {"todo verde" if not fallas else f"{fallas} MAL"}')
    return 1 if fallas else 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.exit(selftest() if '--selftest' in sys.argv else 0)
