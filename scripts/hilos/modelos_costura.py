# -*- coding: utf-8 -*-
"""
modelos_costura.py - que costuras tiene cada pieza que hoy se cose, y con que hilo.

Un MODELO junta las piezas que se cosen igual (izquierda y derecha, y los colores). Cada costura
dice que hilo va ARRIBA (aguja) y cual ABAJO (bobina), tal como lo escribe la hoja de operaciones
vigente. Donde la hoja no lo dice, queda "confirmar en la maquina": no se completa por parecido.

Fuentes (leidas el 02/10/2026; la hoja y la celda van en el comentario de cada modelo):
  HO = Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\1- CLIENTES\\...
  programa = Y:\\PRODUCCION\\PCP\\Barack Argentina\\2- 26W40 / 26W41 Programa de Produccion.xlsx (hoja Difusion)
  arb = export RELACIONES del 02/10/2026 12:26
"""

A_CONFIRMAR = 'confirmar en la máquina'

# (operaciones, nombre de la costura, hilo arriba, hilo abajo, maquina segun el documento)
# Las hojas de Patagonia escriben este hilo FX284TK-E0PTO; en el arb y en las ordenes de compra es FX284-E0PTO
# (mismo hilo: memoria project_patagonia_arb_alineacion). La planilla usa el codigo del arb.
UNION_PAT = 'FX284-E0PTO (negro 30/3)'


def _union(ops, hilo=UNION_PAT, maquina=''):
    return (ops, 'Unión', hilo, hilo, maquina)


MODELOS = [
    # ------------------------------------------------------------------ PATAGONIA
    # Insert: HO-990 diap. 6 + HO 118 (maquina CNC) hojas 10 y 20: 2 conos arriba, 2 bobinas abajo. No tiene union.
    dict(sector='Patagonia', cliente='Novax', familia='Insert de puerta', modelo='Insert delantero',
         piezas=['N 227', 'N 392', 'N 389', 'N 393', 'N 390', 'N 394', 'N 391', 'N 395'],
         costuras=[('50', 'Doble pespunte en CNC', 'FX483TK 20/3, color según nivel (2 conos)',
                    'FX284-E0PTO (negro 30/3, 2 bobinas)', 'CNC de costura')],
         rol=[('FX483TK', 'Doble pespunte (arriba)'), ('FX284', 'Doble pespunte (abajo)')]),
    dict(sector='Patagonia', cliente='Novax', familia='Insert de puerta', modelo='Insert trasero',
         piezas=['N 396', 'N 400', 'N 397', 'N 401', 'N 398', 'N 402', 'N 399', 'N 403'],
         costuras=[('50', 'Doble pespunte en CNC', 'FX483TK 20/3, color según nivel (2 conos)',
                    'FX284-E0PTO (negro 30/3, 2 bobinas)', 'CNC de costura')],
         rol=[('FX483TK', 'Doble pespunte (arriba)'), ('FX284', 'Doble pespunte (abajo)')]),
    # Apoyabrazo de puerta: HO 971 hojas 40 y 41 (aguja 20/3 FX483TK-E0PTO, bobina 30/3 FX284TK-E0PTO)
    dict(sector='Patagonia', cliente='Novax', familia='Apoyabrazo de puerta', modelo='Apoyabrazo de puerta delantero',
         piezas=['N 231', 'N 267'],
         costuras=[_union('40'), ('41', 'Vista (1 línea)', 'FX483TK-E0PTO (negro 20/3)', UNION_PAT, '')]),
    dict(sector='Patagonia', cliente='Novax', familia='Apoyabrazo de puerta', modelo='Apoyabrazo de puerta trasero',
         piezas=['N 297', 'N 328'],
         costuras=[_union('40'), ('41', 'Vista (1 línea)', 'FX483TK-E0PTO (negro 20/3)', UNION_PAT, '')]),
    # IP Pad: HO-985 hojas 40, 41 y 42 (bobina Jet Black abajo en la vista)
    dict(sector='Patagonia', cliente='VW', familia='IP Pad', modelo='IP Pad Low (L1)',
         piezas=['2HC858417B FAM'],
         costuras=[_union('40'), ('42', 'Vista (1 línea)', 'FX483TK-11930E (Alpe Gray 20/3)', UNION_PAT, '')]),
    dict(sector='Patagonia', cliente='VW', familia='IP Pad', modelo='IP Pad High (L2 y L3)',
         piezas=['2HC858417C GKK', '2HC858417C GKN'],
         costuras=[_union('40 y 41'), ('42', 'Vista (1 línea)', 'FX483TK-11703E (Gray Violet 20/3)', UNION_PAT, '')]),
    # Apoyacabezas: HO-968 / 969 / 970 hojas 30 a 34. La vista (hoja 31) dice bobina 30/3 sin codigo; L0 no lleva vista.
    dict(sector='Patagonia', cliente='VW', familia='Apoyacabezas', modelo='Apoyacabezas delantero',
         piezas=['2HC881901 RL1', '2HC881901A GFV', '2HC881901B GEV', '2HC881901C EFG'],
         costuras=[_union('30, 32, 33 y 34'),
                   ('31', 'Vista (2 líneas, L1 a L3)', 'FX483TK 20/3, color según nivel', '30/3 (' + A_CONFIRMAR + ')', '')],
         no_aplica={'Vista (2 líneas, L1 a L3)': ['2HC881901 RL1']}),
    dict(sector='Patagonia', cliente='VW', familia='Apoyacabezas', modelo='Apoyacabezas trasero central',
         piezas=['2HC885900 RL1', '2HC885900A EIF', '2HC885900B SIY', '2HC885900C SIY'],
         costuras=[_union('30, 32 y 33'),
                   ('31', 'Vista (2 líneas, L1 a L3)', 'FX483TK 20/3, color según nivel', '30/3 (' + A_CONFIRMAR + ')', '')],
         no_aplica={'Vista (2 líneas, L1 a L3)': ['2HC885900 RL1']}),
    dict(sector='Patagonia', cliente='VW', familia='Apoyacabezas', modelo='Apoyacabezas trasero lateral',
         piezas=['2HC885901 RL1', '2HC885901A GFU', '2HC885901B GEQ', '2HC885901C DZS'],
         costuras=[_union('30, 32 y 33'),
                   ('31', 'Vista (2 líneas, L1 a L3)', 'FX483TK 20/3, color según nivel', '30/3 (' + A_CONFIRMAR + ')', '')],
         no_aplica={'Vista (2 líneas, L1 a L3)': ['2HC885901 RL1']}),
    # Apoyabrazo trasero central: HO-986 hoja 40 (no nombra hilo); el arb tiene solo FX284-E0PTO
    dict(sector='Patagonia', cliente='VW', familia='Apoyabrazo trasero central', modelo='Apoyabrazo trasero central',
         piezas=['2HC885081 RL1'],
         costuras=[_union('40')]),

    # ------------------------------------------------------------------ AMAROK
    # Apoyacabezas central: HO 110 Rev.5 hojas 30 a 33 (hoja 32: superior gris 20/3, inferior negro 30/3)
    dict(sector='Amarok', cliente='VW', familia='Apoyacabezas Amarok', modelo='Apoyacabezas central con vista',
         piezas=['2HT885900B YZM', '2HT885900A OHE'],
         costuras=[_union('30, 31 y 33'),
                   ('32', 'Vista', 'FX483TK-12088E (gris 20/3)', UNION_PAT, '')]),
    dict(sector='Amarok', cliente='VW', familia='Apoyacabezas Amarok', modelo='Apoyacabezas central de tela',
         piezas=['2HT885900 9NY'],
         costuras=[_union('30, 31 y 33')]),
    # Lateral: HO 111 Rev.6 hojas 30 a 33
    dict(sector='Amarok', cliente='VW', familia='Apoyacabezas Amarok', modelo='Apoyacabezas lateral con vista',
         piezas=['2HT885901E YZM', '2HT885901D OHE'],
         costuras=[_union('30, 31 y 33'),
                   ('32', 'Vista', 'FX483TK-12088E (gris 20/3)', UNION_PAT, '')]),
    dict(sector='Amarok', cliente='VW', familia='Apoyacabezas Amarok', modelo='Apoyacabezas lateral de tela',
         piezas=['2HT885901C 9NY'],
         costuras=[_union('30, 31 y 33')]),
    # Delantero: HO 112 Rev.10 hojas 30 a 35
    dict(sector='Amarok', cliente='VW', familia='Apoyacabezas Amarok', modelo='Apoyacabezas delantero',
         piezas=['2HT881901D YZM', '2HT881901E OHE'],
         costuras=[_union('30 a 34'),
                   ('35', 'Vista', 'FX483TK-12088E (gris 20/3)', UNION_PAT, '')]),
    # IP: HO 106 Rev.6 y HO 107 Rev.7 hojas 30 (pespunte) y 31 (union). La bobina del pespunte es gris 30/3.
    dict(sector='Amarok', cliente='VW', familia='IP Amarok', modelo='IP corto',
         piezas=['2HT857115 DEC', '2HT857115 YZM', '2HT857115 HOA'],
         costuras=[('30', 'Vista (pespunte)', 'FX663TK-12088E (gris 15/3)', 'FX284-12088E (gris 30/3)', ''),
                   _union('31', 'FX284-E0PTO (negro 30/3); en HOA, FX284-12088E (gris 30/3)')],
         rol=[('FX284-12088E', 'Vista (abajo); unión en HOA')]),
    dict(sector='Amarok', cliente='VW', familia='IP Amarok', modelo='IP largo',
         piezas=['2HT857116 DEC', '2HT857116 YZM', '2HT857116 HOA'],
         costuras=[('30', 'Vista (pespunte)', 'FX663TK-12088E (gris 15/3)', 'FX284-12088E (gris 30/3)', ''),
                   _union('31', 'FX284-E0PTO (negro 30/3); en HOA, FX284-12088E (gris 30/3)')],
         rol=[('FX284-12088E', 'Vista (abajo); unión en HOA')]),
    # Tapa de consola: HO 109 Rev.4 hojas 30,1 y 30,2 (vista en recta de doble aguja; inferior negro 30/3)
    dict(sector='Amarok', cliente='VW', familia='Tapa de consola Amarok', modelo='Tapa de consola',
         piezas=['2H6863761B OIO', '2HT863761 SMC', '2H6863761B IYO'],
         costuras=[_union('30.1', 'Negro 30/3 según la hoja; FX284-12088E (gris) en el arb'),
                   ('30.2', 'Vista doble', 'FX663TK gris (negro en IYO), 2 agujas', 'Negro 30/3', 'Recta doble aguja')]),

    # ------------------------------------------------------------------ SMRC
    # P703: HO 116 Rev.7 y HO 117 Rev.7 hojas 31 y 32. La hoja 32 no dice cual va arriba y cual abajo.
    dict(sector='Ford P703', cliente='SMRC', familia='Apoyabrazo P703', modelo='Apoyabrazo delantero sin vista',
         piezas=['0247607-04-FZHE', '0247608-04-FZHE'],
         costuras=[_union('31', 'BX69-11527E (negro 40/3)', 'Recta simple aguja')]),
    dict(sector='Ford P703', cliente='SMRC', familia='Apoyabrazo P703', modelo='Apoyabrazo delantero con vista',
         piezas=['0247609-04-FZHE', '0247610-04-FZHE'],
         costuras=[_union('31', 'BX69-11527E (negro 40/3)', 'Recta simple aguja'),
                   ('32', 'Vista doble', 'BX138A-1530E y BX69-11527E (' + A_CONFIRMAR + ')',
                    'BX138A-1530E y BX69-11527E (' + A_CONFIRMAR + ')', 'Recta doble aguja 6 mm')]),
    dict(sector='Ford P703', cliente='SMRC', familia='Apoyabrazo P703', modelo='Apoyabrazo trasero sin vista',
         piezas=['0247611-04-FZHE', '0247612-04-FZHE'],
         costuras=[_union('31', 'BX69-11527E (negro 40/3)', 'Recta simple aguja')]),
    dict(sector='Ford P703', cliente='SMRC', familia='Apoyabrazo P703', modelo='Apoyabrazo trasero con vista',
         piezas=['0247613-04-FZHE', '0247614-04-FZHE'],
         costuras=[_union('31', 'BX69-11527E (negro 40/3)', 'Recta simple aguja'),
                   ('32', 'Vista doble', 'BX138A-1530E y BX69-11527E (' + A_CONFIRMAR + ')',
                    'BX138A-1530E y BX69-11527E (' + A_CONFIRMAR + ')', 'Recta doble aguja 6 mm')]),
    # P21 hilo verde: HO 927 hojas 40 y 50. La hoja dice union BX69 11527E; el arb tiene GM30W-49990.
    dict(sector='P21', cliente='SMRC', familia='Apoyabrazo P21', modelo='Apoyabrazo P21 hilo verde',
         piezas=['0252631-03-NHZD', '0252632-03-NHZD'],
         costuras=[_union('40', 'BX69-11527E según la hoja; GM30W-49990 en el arb', 'Recta simple aguja'),
                   ('50', 'Vista', 'FX284-12125E (verde)', A_CONFIRMAR.capitalize(), 'Recta simple aguja')]),
]

# ---------------------------------------------------------------------- COSTURA BLANCO (telas PWA)
# Las hojas (HO 913, una por tela; HO 972 a 983 para las 581D) dicen que zona va con overlock y cual con
# recta, pero NINGUNA dice que hilo va en cada posicion de la maquina. Los dos hilos de la BOM son
# HILO CAIMAN 120 (poliester fibra cortada 120) e HILO POLI TEXT (poliester texturizado 150/1).
# Donde la hoja no dice el tipo de costura, se toma de la planilla de Produccion
# (Y:\PRODUCCION\PCP\ROMINA\procesos blanco serie y proyecto.xlsx, columnas OVER y RECTA).
OVER = ('Overlock', 'Caimán 120: todos sus conos', 'Texturizado: todos sus conos', 'Overlock')
RECTA = ('Recta', A_CONFIRMAR.capitalize(), A_CONFIRMAR.capitalize(), 'Recta')


def _tela(piezas, ops, costuras, familia='Telas de serie'):
    # el nombre del modelo lo arma el generador con las telas que tienen programa (nombre_tela)
    return dict(sector='Costura Blanco', cliente='PWA', familia=familia, modelo=None, piezas=piezas,
                costuras=[(ops,) + c for c in costuras])


def nombre_tela(activas, todas=None):
    if len(activas) == 1:
        return 'Tela ' + activas[0]
    if len(activas) > 2 and todas is not None and list(activas) == list(todas):
        return 'Telas %s a %s' % (activas[0], activas[-1])   # el grupo entero, que es corrido
    return 'Telas ' + ', '.join(activas[:-1]) + ' y ' + activas[-1]


MODELOS += [
    _tela(['21-6034'], '30', [OVER, RECTA]),            # HO: costura zonas 1 a 4 y fijar el alambre; tipo segun Produccion
    _tela(['21-6567'], '40-50', [OVER, RECTA]),         # HO: overlock zonas 1 a 3 + refuerzos con union
    _tela(['21-6621'], '40', [OVER]),                   # HO: overlock zonas 1 y 2
    _tela(['21-6699'], '40-50', [OVER, RECTA]),         # HO: overlock zonas 1 y 2 + refuerzos con union
    _tela(['21-6756'], '30-35', [OVER]),                # HO no dice el tipo; Produccion: over
    _tela(['21-6757'], '30', [OVER]),                   # HO: overlock zonas 1 a 4
    _tela(['21-6758'], '30', [OVER]),                   # HO: overlock pieza 2 sobre pieza 1
    _tela(['21-6767'], '30', [OVER, RECTA]),            # HO no dice el tipo; Produccion: over + recta
    _tela(['21-6807', '21-6923'], '30', [OVER, RECTA]),  # HO: overlock zonas 1 a 4 + dos refuerzos con recta
    _tela(['21-7467'], '30', [OVER]),                   # HO no dice el tipo; Produccion: over
    _tela(['21-7763'], '30', [OVER]),                   # HO no dice el tipo; Produccion: over
    # 21-6619: la hoja manda "una costura alrededor de toda la placa" (HO 913 21-6619 Rev.1, hoja 30) y el arb no tiene hilo
    _tela(['21-6619'], '30', [('Costura de la placa', A_CONFIRMAR.capitalize(), A_CONFIRMAR.capitalize(), '')]),
    # 581D: HO 972 a 983 Rev.A, hoja 40
    _tela(['21-9463', '21-9464', '21-9465', '21-9466'], '40', [RECTA], familia='Telas 581D'),
    _tela(['21-9467', '21-9468'], '40', [OVER, RECTA], familia='Telas 581D'),
    # 9469 a 9472: la hoja (HO 978 a 981, hoja 40, I38) nombra solo costura recta. La ayuda visual de dic-2025
    # dice overlock + recta: si en planta pasan por el overlock, se agrega la fila.
    _tela(['21-9469', '21-9470'], '40', [RECTA], familia='Telas 581D'),
    _tela(['21-9471', '21-9472'], '40', [RECTA], familia='Telas 581D'),
    _tela(['21-9474', '21-9475'], '40', [OVER, RECTA], familia='Telas 581D'),
]

# Piezas que estan en el programa de Costura y NO llevan costura (la hoja de operaciones no tiene ninguna):
#   0247615-03-FZHE y 0247616-03-FZHE = Top Roll P703, pasa por Costura solo para refilar (HO 907 Rev.15, hoja 35).
#   21-6766 solo engrampado; 21-7339 / 7340 / 7341 solo aplix; 21-8908 / 8909 termoformadas; 21-6416 felpa.
SIN_COSTURA = ['0247615-03-FZHE', '0247616-03-FZHE', '21-6766', '21-7339', '21-7340', '21-7341',
               '21-8908', '21-8909', '21-6416']

# Costura de cada hilo (para la tabla de piezas)
ROL_HILO = [
    ('FX483TK', 'Vista'), ('FX663TK', 'Vista'), ('BX138', 'Vista'), ('BX92', 'Vista'), ('FX284-12125E', 'Vista'),
    ('FX284', 'Unión'), ('BX69', 'Unión'), ('GM30W', 'Unión'), ('583650', 'Unión'),
    ('HILO CAIMAN', 'Overlock / recta'), ('HILO POLI TEXT', 'Overlock / recta'),
]


def rol_del_hilo(codigo):
    for prefijo, rol in ROL_HILO:
        if codigo.upper().startswith(prefijo):
            return rol
    return ''
