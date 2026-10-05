# -*- coding: utf-8 -*-
"""
criterio_hilo.py - que linea del arb es un HILO de costura. Un solo criterio para todo scripts/hilos/.

No hay rubro propio de hilos en el arb (todos los hilos estan en el rubro 1, junto con el resto de la
materia prima), asi que se reconoce por la descripcion o por la forma del codigo. Lo que el criterio
agarra sin ser hilo va en NO_ES_HILO, con el motivo al lado: se agrega ahi, no se afloja el patron.
"""
import re

RX_DESC = re.compile(r'\bHILO|STCH|STITCH|\bTHREAD|\bLINHA\b', re.I)
RX_COD = re.compile(r'^(FX\d|BX\d|GM\d\dW|NEO|B737|COATS|H-(AB|TN)|58\d{4}\.X|83010\d\d$|HILO )', re.I)
# semielaborados y piezas que nombran al hilo en su descripcion
RX_NO = re.compile(r'^(COR-|MOI-|MC-)|CORTE|PIEZA COSTURADA', re.I)

# Codigos que el patron agarra y NO son hilo de costura (leidos en el maestro y en el export, 05/10/2026)
NO_ES_HILO = {
    '8301085': 'Tep Anthrazit 1 mm, rollo de 1,60 m: entra por la forma del codigo',
    'MP-COS-00002': 'lubricante de siliconas para hilos',
    'RM-COS-00003': 'juego de tiras (repuesto), rubro 2',
    'PASA HILOS DE D': 'pasa hilos de doble aguja (repuesto de maquina)',
    'PH DA DER': 'pasa hilo de doble aguja (repuesto de maquina)',
    'PH DA IZQ': 'pasa hilo de doble aguja (repuesto de maquina)',
    'STCH 50 150': 'rollo de film stretch',
}
RX_NO_COD = re.compile(r'^FUN-', re.I)   # fundas cosidas: la descripcion dice "hilo verde", "hilo gris"


def es_hilo(codigo, desc=''):
    codigo = (codigo or '').strip()
    desc = desc or ''
    if codigo.upper() in NO_ES_HILO or RX_NO_COD.match(codigo):
        return False
    if RX_NO.search(codigo + ' ' + desc):
        return False
    return bool(RX_DESC.search(desc) or RX_COD.match(codigo))


# Casos leidos del maestro y del export del 05/10/2026, en las dos direcciones
CASOS = [
    ('FX284-E0PTO', 'Hilo union Negro Titan Pantone 19-4205 T', True),
    ('HILO CAIMAN 120', 'HILO CAIMAN POLIESTER 120 BLANCO', True),
    ('8301094', 'Hilo Schwarz 9224 100Tex=30/3Nm (RPU)', True),
    ('427HIL001COS01', 'UNION BOBINE THREAD/ UNION NEEDLE  THREA', True),
    ('FX483TK-11930E', 'ALPE GRAY TGA IP3 DECOR DBL STCH 20/3', True),
    ('BY138GMLE372', 'LINHA DE POLIESTER 372', True),
    ('8301085', 'Tep Anthrazit 1mm 1,60m (RPU)', False),
    ('FUN-4111', 'FUNDA 4111 TAPA CONSOLA NEGRO HILO GRIS', False),
    ('PASA HILOS DE D', 'PASA HILOS DE DOBLE AGUJA', False),
    ('MP-COS-00002', 'LUBRICANTE SILICONAS P/HILOS DE COSER', False),
    ('COR-0247609', 'CORTE VINILO HILO VISTA', False),
    ('124.544.0066-0', 'SANLEATHER IV IS LE CL68 TITANSCHWARZ', False),
]


if __name__ == '__main__':
    import sys
    malos = [(c, d, e) for c, d, e in CASOS if es_hilo(c, d) != e]
    for c, d, e in malos:
        print('FALLA: %s (%s) tendria que dar %s' % (c, d, e))
    print('%d de %d casos OK' % (len(CASOS) - len(malos), len(CASOS)))
    sys.exit(1 if malos else 0)
