# -*- coding: utf-8 -*-
"""
hilos_documentos.py - lo que dicen los DOCUMENTOS (no el arb) sobre el hilo de cada pieza.

La matriz muestra lo que esta cargado en el arb; esto es contra lo que se lo compara.

DOCUMENTOS: (piezas, codigo del hilo como lo escribe el arb, uso, fuente). Entra solo lo que un documento de
ESA pieza dice con el codigo, o con un color y un titulo que un papel del proveedor traduce a codigo (la tabla
de Linhanyl del 30/01/2026, citada en el mail de M. Nieve del 16/03/2026 "RE: Productos Linhanyl Proyecto
Patagonia"). Lo que ningun papel nombra no se completa por parecido: la pieza queda sin cruzar.

NOTAS: lo que un documento dice DISTINTO del arb, con su fecha y quien lo dice. `conflicto=True` pinta la celda
(o las Observaciones, si la nota no es de un codigo) para que se revise con Produccion.

NOTAS_HILO: lo que hay que saber de un hilo (compras, stock), para la hoja Resumen.

Leido el 05/10/2026 (la hoja, la celda o la pagina de cada dato va en el comentario del bloque):
  HO      = Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\1- CLIENTES\\...
  BOM     = biblioteca de Ingenieria, 1- GENERAL\\2. CONSUMO DE MATERIAL BOM\\BOMS\\... (la revision de numero mayor)
  planos  = Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\<cliente>\\<pieza>\\APQP\\1. Imput o 6-Planos de la pieza
  listado = "Codigos y colores Patagonia_AAAAMMDD.xlsx", hoja Ayuda Visual (se lee de la copia, no se transcribe)
  mails   = .mail-cache (la fecha y el remitente van en el texto de la nota)
"""
import collections
import re

import openpyxl

UNION = 'Unión'
VISTA = 'Vista'
BOBINA = 'Bobina de la vista'
OVER = 'Overlock'
RECTA = 'Recta'

RX_CODIGO = re.compile(r'^[A-Z0-9][A-Z0-9\-\.]{4,}$')


def _codigo(celda):
    """De 'Jet Black 30/3\\nFX284-E0PTO' devuelve 'FX284-E0PTO'; de '— (no aplica)', None."""
    if not celda:
        return None
    ult = str(celda).strip().split('\n')[-1].strip()
    return ult if RX_CODIGO.match(ult) and '—' not in str(celda).split('\n')[0] else None


def leer_ayuda_visual(ruta, fuente):
    """[(pieza, codigo, uso, fuente)] de la hoja Ayuda Visual del listado de codigos y colores de Patagonia.
    Columnas: E prefijo (o 'N 231 / (Codigo Novax)'), F grupo, G numero, H indice, I clave de color,
    J nombre de la pieza, K hilo de union, L hilo de vista. Devuelve tambien las piezas que el listado
    da sin costura (K y L en '—')."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    out, sin = [], []
    for r in wb['Ayuda Visual'].iter_rows(min_row=7, values_only=True):
        e, f, g, h, i, nombre, k, l = (r[4:12] + (None,) * 8)[:8]
        if not e or not nombre:
            continue
        e = str(e).strip()
        if e.upper().startswith('N '):
            pieza = e.split('\n')[0].strip()
        else:
            ind = '' if h in (None, '—', '-') else str(h).strip()
            pieza = '%s%s%s%s %s' % (e, f, g, ind, str(i).strip())
        cu, cv = _codigo(k), _codigo(l)
        if cu:
            out.append((pieza, cu, UNION, fuente))
        if cv:
            out.append((pieza, cv, VISTA, fuente))
        if not cu and not cv:
            sin.append(pieza)
    return out, sin


# ---------------------------------------------------------------------------- piezas
APC_L0 = ['2HC881901 RL1', '2HC885900 RL1', '2HC885901 RL1']
APC_L1 = ['2HC881901A GFV', '2HC885900A EIF', '2HC885901A GFU']
APC_L23 = ['2HC881901B GEV', '2HC881901C EFG', '2HC885900B SIY', '2HC885900C SIY', '2HC885901B GEQ', '2HC885901C DZS']
INS_L0 = ['N 227', 'N 392', 'N 396', 'N 400']
INS_L1 = ['N 389', 'N 393', 'N 397', 'N 401']
INS_L23 = ['N 390', 'N 394', 'N 398', 'N 402', 'N 391', 'N 395', 'N 399', 'N 403']
APB_PUERTA = ['N 231', 'N 267', 'N 297', 'N 328']
IP_PAD_L1 = ['2HC858417B FAM']
IP_PAD_L23 = ['2HC858417C GKK', '2HC858417C GKN']
APB_TRAS = ['2HC885081 RL1']

APC_AMK_CENTRAL = ['2HT885900B YZM', '2HT885900A OHE']
APC_AMK_VISTA = APC_AMK_CENTRAL + ['2HT885901E YZM', '2HT885901D OHE', '2HT881901D YZM', '2HT881901E OHE']
APC_AMK_TELA = ['2HT885900 9NY', '2HT885901C 9NY']
IP_AMK = ['2HT857115 DEC', '2HT857115 YZM', '2HT857116 DEC', '2HT857116 YZM']
IP_AMK_HOA = ['2HT857115 HOA', '2HT857116 HOA']
TAPA_AMK_GRIS = ['2H6863761B OIO', '2HT863761 SMC']
TAPA_AMK_IYO = ['2H6863761B IYO']

P703_SIN_VISTA = ['0247607-04-FZHE', '0247608-04-FZHE', '0247611-04-FZHE', '0247612-04-FZHE']
P703_CON_VISTA = ['0247609-04-FZHE', '0247610-04-FZHE', '0247613-04-FZHE', '0247614-04-FZHE']
P21_VERDE = ['0252631-03-NHZD', '0252632-03-NHZD']        # el indice que se fabrica hoy
P21_VERDE_02 = ['0252631-02-NHZD', '0252632-02-NHZD']     # el indice que nombran la BOM 127 Rev.7 y la HO 927
P21_NARANJA = ['0257327-01-NHZD', '0257328-01-NHZD']
P21_CUERO = ['0238889-07-NHZD', '0238890-07-NHZD']        # el indice que se fabrica hoy
P21_CUERO_06 = ['0238889-06-NHZD', '0238890-06-NHZD']     # el indice que nombran la BOM 127 Rev.7 y la HO 927
CAPOTAJE = ['0235799-01-0000']

DOCUMENTOS = [
    # ---- Patagonia (se suman al listado de codigos y colores)
    # Apoyacabezas: HO 968 / 969 / 970 Rev.A (preliminar), pestañas 30 a 34 J14 (union FX284TK-E0PTO en aguja y bobina)
    # y pestaña 31 J16 (vista L1 FX483TK-11930E, L2 y L3 FX483TK-11703E; "L0 NO lleva costura vista").
    # Plano VW 2HC.881.901 / 885.900 / 885.901 (18/09/2025): union Jet Black 19-0303 30/3 en las cuatro versiones,
    # que Linhanyl traduce a FX284 cor E0PTO; vista Gray Violet 14-4103 20/3 en B y C (FX483TK cor 11703E).
    (APC_L0 + APC_L1 + APC_L23, 'FX284-E0PTO', UNION, 'HO 968 a 970 / plano VW (18/09/2025)'),
    (APC_L1, 'FX483TK-11930E', VISTA, 'HO 968 a 970'),
    (APC_L23, 'FX483TK-11703E', VISTA, 'HO 968 a 970 / plano VW (18/09/2025)'),
    # Insert: FAKOM VW RZ00350 (25/11/2025) pag. 23: doble decorativa 20/3 Jet Black TGA 041 (L0), Alpe Gray TGA IP3
    # (L1), Gray Violet TGA AT2 (L2 y L3) -> Linhanyl FX483TK cor E0PTO / 11930E / 11703E. Bobina: norma VW
    # LAH.000.881.N §3.1 pag. 8 ("Decorative seam bobbin thread ... Nm 30/3 PET") y HO 118 pestaña 40 ("ambos hilos negros").
    (INS_L0, 'FX483TK-E0PTO', VISTA, 'FAKOM VW (25/11/2025)'),
    (INS_L1, 'FX483TK-11930E', VISTA, 'FAKOM VW (25/11/2025)'),
    (INS_L23, 'FX483TK-11703E', VISTA, 'FAKOM VW (25/11/2025)'),
    (INS_L0 + INS_L1 + INS_L23, 'FX284-E0PTO', BOBINA, 'Norma VW LAH.000.881.N (30/3) / HO 118 (negro)'),
    # Apoyabrazos de puerta: HO 971 pestaña 40 J13 (union FX284TK-E0PTO en aguja y bobina) y 41 J13 (vista aguja
    # FX483TK-E0PTO, bobina FX284TK-E0PTO). Lo que pide VW va en NOTAS.
    (APB_PUERTA, 'FX284-E0PTO', UNION, 'HO 971 hojas 40 y 41'),
    (APB_PUERTA, 'FX284-E0PTO', BOBINA, 'HO 971 hojas 40 y 41'),
    (APB_PUERTA, 'FX483TK-E0PTO', VISTA, 'HO 971 hoja 41'),
    # IP Pad: HO-985 Rev.A pestañas 40 J18, 41 J17 y 42 J15/J19; CMF VW v5 pag. 17 (L1 Alpe Gray TGA IP3, L2-L3 Gray Violet TGA AT2)
    (IP_PAD_L1 + IP_PAD_L23, 'FX284-E0PTO', UNION, 'HO 985 hojas 40 a 42'),
    (IP_PAD_L1 + IP_PAD_L23, 'FX284-E0PTO', BOBINA, 'HO 985 hojas 40 a 42'),
    (IP_PAD_L1, 'FX483TK-11930E', VISTA, 'HO 985 hoja 42 / CMF VW'),
    (IP_PAD_L23, 'FX483TK-11703E', VISTA, 'HO 985 hoja 42 / CMF VW'),

    # ---- Amarok: BOM oficiales (BOM 128 Rev.26 IP corto, 129 Rev.29 IP largo, 130 Rev.15 tapa, 131 Rev.16 APC central,
    # 132 Rev.17 APC lateral, 144 Rev.17 APC delantero) y HO 106/107/109/110/111/112 (color y titulo)
    (APC_AMK_VISTA + APC_AMK_TELA, 'FX284-E0PTO', UNION, 'BOM 131 / 132 / 144'),
    (APC_AMK_VISTA, 'FX483TK-12088E', VISTA, 'BOM 131 / 132 / 144'),
    (APC_AMK_CENTRAL, 'FX284-E0PTO', BOBINA, 'HO 110 hoja 32'),
    (IP_AMK + IP_AMK_HOA, 'FX663TK-12088E', VISTA, 'BOM 128 / 129 y HO 106 / 107 hoja 30'),
    (IP_AMK + IP_AMK_HOA, 'FX284-12088E', BOBINA, 'BOM 128 / 129 y HO 106 / 107 hoja 30'),
    (IP_AMK, 'FX284-E0PTO', UNION, 'BOM 128 / 129 y HO 106 / 107 hoja 31'),
    (IP_AMK_HOA, 'FX284-12088E', UNION, 'BOM 128 / 129 y HO 106 / 107 hoja 31'),
    # Tapa: BOM 130 Rev.15 (hojas OIO, SMC e IYO, celdas F28 y F31); plano 2HT.863.761 pos. 100 "Garn 30/3" y 101
    # "Garn 15/3"; RZ00039 de VW (27/09/2022) pag. 4: "VW50106-M (30/3) VW50106-L (15/3)", Jet Black en Trendline (IYO)
    # La BOM da el CODIGO y el titulo (en IYO llama "Hilo Vista" a los dos; en OIO y SMC no dice el uso). Que el 30/3
    # es el de union lo dice el listado de hilos de Ingenieria del 09/05/2024 ("Hilos archivo general.xlsx", hoja
    # APB AMAROK PA2: HILO VISTA 15/3 y HILO UNION 30/3 en las tres versiones).
    (TAPA_AMK_GRIS, 'FX663TK-12088E', VISTA, 'BOM 130 Rev.15 / plano 2HT.863.761'),
    (TAPA_AMK_GRIS, 'FX284-12088E', UNION, 'BOM 130 Rev.15 (código) / listado de hilos de Ingeniería del 09/05/2024 (uso)'),
    (TAPA_AMK_IYO, 'FX663TK-E0PTO', VISTA, 'BOM 130 Rev.15 / plano 2HT.863.761 / RZ00039 VW'),
    (TAPA_AMK_IYO, 'FX284-E0PTO', UNION, 'BOM 130 Rev.15 (código) / listado de hilos de Ingeniería del 09/05/2024 (uso)'),

    # ---- SMRC: BOM 105 / 106 Rev.17 (P703), HO 116 / 117 Rev.7 pestañas 31 y 32; BOM 127 Rev.7 (P21, hoja HILO VERDE);
    # HO 927 Rev.6 pestaña 50 (vista FX284 1212E [sic]); HO 991 Rev.A diap. 3 (union BX69 11527E); BOM CAPOTAGE Rev.1
    # Las HO 116 / 117 escriben "BX69-0PTO" y "BX138-1530E"; la BOM, BX69-11527E y BX138-1530E (va en NOTAS).
    (P703_SIN_VISTA + P703_CON_VISTA, 'BX69-11527E', UNION, 'BOM 105 / 106 Rev.17'),
    (P703_CON_VISTA, 'BX138A-1530E', VISTA, 'HO 116 / 117 hoja 32 y BOM 105 / 106 Rev.17 (como BX138-1530E)'),
    # La BOM 127 Rev.7 (hoja HILO VERDE) y la HO 927 nombran el indice -02; el que se fabrica es el -03.
    (P21_VERDE_02, 'FX284-12125E', VISTA, 'BOM 127 Rev.7'),
    (P21_VERDE_02, 'GM30W-49990', UNION, 'BOM 127 Rev.7'),
    (P21_VERDE, 'FX284-12125E', VISTA, 'BOM 127 Rev.7 (escrita para el índice -02)'),
    (P21_VERDE, 'GM30W-49990', UNION, 'BOM 127 Rev.7 (escrita para el índice -02)'),
    (P21_NARANJA, 'BX69-11527E', UNION, 'HO 991 hoja 40'),
    (P21_NARANJA, 'BX92EX-12124E', VISTA, 'HO 991 hoja 41'),
    (CAPOTAJE, 'GM30W-49990', UNION, 'BOM Capotaje Rev.1'),
]

# ---- PWA Costura Blanco: las hojas (HO 913 y HO 972 a 983) dicen el TIPO de costura de cada tela, no que
# hilo va en cada posicion de la maquina. Los dos hilos de la BOM llevan el tipo de costura como uso.
PWA_COSTURAS = [
    (['21-6034', '21-6567', '21-6699', '21-6767', '21-6807', '21-6923', '21-9467', '21-9468', '21-9474', '21-9475'],
     'Overlock y recta'),
    (['21-6621', '21-6756', '21-6757', '21-6758', '21-7467', '21-7763'], OVER),
    (['21-9463', '21-9464', '21-9465', '21-9466', '21-9469', '21-9470', '21-9471', '21-9472'], RECTA),
]
PWA_HILOS = ['HILO CAIMAN 120', 'HILO POLI TEXT']
PWA_FUENTE = 'HO 913 / HO 972 a 983 (tipo de costura)'
for _piezas, _uso in PWA_COSTURAS:
    for _h in PWA_HILOS:
        DOCUMENTOS.append((_piezas, _h, _uso, PWA_FUENTE))


def _nota(piezas, codigo, documento, dice, arb, conflicto=True):
    return dict(piezas=piezas, codigo=codigo, documento=documento, dice=dice, arb=arb, conflicto=conflicto)


NOTAS = [
    # ---- Patagonia
    _nota(APC_L0, 'FX483TK-E0PTO', 'Plano VW de los tres apoyacabezas (18/09/2025) y HO 968 a 970',
          'la versión base no lleva costura vista (en el plano la columna de la vista dice "--"; la HO: "L0 NO lleva costura vista")',
          'tiene FX483TK-E0PTO (Jet Black 20/3), que se agregó por el pedido de L. Lattanzi del 05/08/2026 de incorporar '
          'hilo decorativo negro en todos los APC L0'),
    _nota(APC_L1, 'FX483TK-11930E', 'Plano VW de los tres apoyacabezas (18/09/2025)',
          'la vista de la versión A es "Steel Gray - Pantone 18-4005 TPG", que para Linhanyl es FX483TK color 11577E '
          '(tabla de Linhanyl del 30/01/2026)',
          'tiene FX483TK-11930E (Alpe Gray TGA IP3), el color que pasó VW por mail (O. Tanzi, reenviado el 19/11/2025) '
          'con la aclaración "tiene que terminar oficializándose o Aeko". FX483TK-11577E no está en el arb'),
    _nota(APB_TRAS, None, 'Plano VW 2HC.885.081 (15/08/2025)',
          'costuras I, III y IV con hilo 30/3 y costura II (dobladillo, ítem 54) con hilo 15/3; no dice color',
          'solo FX284-E0PTO (30/3). El 27/07/2026 se sacó de la BOM el hilo de vista porque la pieza no lleva costura vista; '
          'en planta la cinta se cose con el 30/3 (dato de palabra de L. Lattanzi, 05/10/2026)'),
    _nota(APB_PUERTA, 'FX483TK-E0PTO', 'FAKOM VW RZ00350 (25/11/2025) pág. 24 y mail de D. Pandolfi (VW) del 26/11/2025',
          'vista "Single Stitching 135 TEX Carbon Black" (AMANN #0115G)',
          'tiene FX483TK-E0PTO (Jet Black 20/3). El código 427-HIL-005-COS-01 del mail del 27/11/2025 no está en el '
          'maestro de insumos (listado del 28/08/2026)'),

    # ---- Amarok
    _nota(TAPA_AMK_GRIS + TAPA_AMK_IYO, None, 'HO 109 Rev.4 hojas 30,1 y 30,2',
          'unión negro 30/3 arriba y abajo; vista gris 20/3 arriba (negro 20/3 en IYO) y negro 30/3 abajo',
          'vista 15/3 (FX663TK) y, en OIO y SMC, unión gris 30/3 (FX284-12088E), igual que la BOM 130 Rev.15 y el plano '
          '2HT.863.761. La que no coincide es la HO', conflicto=False),
    _nota(IP_AMK + IP_AMK_HOA, 'FX663TK-12088E',
          'Mail "Desvío hilo 20/3 en lugar de 15/3 para los 6 productos de IP AMAROK" (M. Meszaros, 17/02/2025, reenviado el 11/11/2025)',
          'en planta el hilo vista de arriba es 20/3 y pide pasar el consumo del arb al 20/3; el plano y la BOM piden 15/3. '
          'C. Rodriguez (Calidad) contestó el 11/11/2025: "¡NO existen DT internas o desvíos! Generar PPAP para validación"',
          'tiene FX663TK-12088E (15/3), como la BOM 128 / 129'),
    _nota(APC_AMK_VISTA + APC_AMK_TELA, None, 'Mail de C. Baptista del 21/05/2026, en el hilo de la alerta de hilos P703 de Linhanyl',
          'en el APC Amarok se estaría usando un hilo distinto del que indica el arb; no dice cuál',
          'coincide con las BOM 131, 132 y 144', conflicto=False),

    # ---- SMRC
    _nota(P703_CON_VISTA, 'BX138A-1530E', 'BOM 105 / 106 Rev.17 y HO 116 / 117 hoja 32',
          'vista BX138-1530E, Urben Grey Tex 135, 20/3',
          'tiene BX138A-1530E, con descripción Tex 181'),
    _nota(P703_CON_VISTA, None, 'BOM 105 / 106 Rev.17', 'consumo de unión 0,005 kg y de vista 0,006 kg',
          'unión 0,006 kg y vista 0,005 kg (los dos valores cruzados)', conflicto=False),
    _nota(P703_SIN_VISTA, None, 'BOM 105 / 106 Rev.17', 'consumo de unión 0,005 kg', 'unión 0,006 kg', conflicto=False),
    _nota(P703_SIN_VISTA + P703_CON_VISTA, None, 'HO 116 / 117 Rev.7 hojas 31 y 32',
          'escriben el hilo de unión "BX69-0PTO - NEGRO - 40/3"',
          'tiene BX69-11527E, igual que la BOM 105 / 106 Rev.17. La que no coincide es la HO', conflicto=False),
    _nota(P21_VERDE, 'GM30W-49990', 'HO 927 hoja 40 (escrita para el índice -02)',
          'unión "BX69 11527E"',
          'tiene GM30W-49990 (Bilevich), como la BOM 127 Rev.7. Compras compró FX284-E0PTO como reemplazo del GM30W-49990 '
          '(mail de P. Cejas del 22/10/2025) y los movimientos de depósito (desde el 19/06/2025) no registran ingresos ni '
          'pases de ese hilo'),
    _nota(P21_VERDE + P21_VERDE_02, 'FX284-12125E', 'BOM 127 Rev.7 (hoja HILO VERDE) y HO 927 hoja 50',
          'la BOM lo describe como hilo Coats Neophil Tex 92 de nylon y la HO lo escribe "HILO UNIÓN 030 / FX284 1212E" en el '
          'campo del hilo de vista',
          'FX284-12125E figura como "HILO 30/3 POLIESTER"; la ficha de Linhanyl del artículo FX284 dice poliéster'),
    _nota(P21_NARANJA, 'BX92EX-12124E', 'Lista de características del cliente (LSC v1, SC 2.5)',
          'vista Linhanyl artículo BX138, color 12124E, 1600 a 1980 dtex',
          'tiene BX92EX-12124E, mismo color (la BOM 127 lo describe Tex 92)'),
    _nota(P21_CUERO_06 + P21_CUERO, None, 'HO 927 (carátula y hojas 40 y 50; nombra el índice -06)',
          'incluye el P21 cuero con costura de unión y vista, sin distinguir versión',
          'no tiene hilo, igual que la BOM 127 Rev.7 (hoja CUERO)', conflicto=False),

    # ---- PWA
    _nota(['21-6619'], None, 'HO 913 21-6619 Rev.1 hoja 30',
          '"Realizar una costura alrededor de toda la placa" (aguja N° 16); no dice el hilo',
          'no tiene hilo'),
]

NOTAS_HILO = {
    'GM30W-49990': 'Compras compró FX284-E0PTO como reemplazo (mail de P. Cejas, 22/10/2025).',
    'FX284-12088E': 'No aparece en ninguna orden de compra (2019 a 2026) ni tiene ingresos al depósito; el sistema lo '
                    'descuenta por la lista de materiales.',
    'FX284-12125E': 'No aparece en ninguna orden de compra (2019 a 2026) ni tiene ingresos al depósito.',
    '427HIL001COS01': 'Código de Patagonia de nov-2025; C. Baptista pidió no borrarlo hasta tener el del proveedor (mail del 25/11/2025).',
    '427HIL002COS01': 'Código de Patagonia de nov-2025; C. Baptista pidió no borrarlo hasta tener el del proveedor (mail del 25/11/2025).',
    '427HIL003COS01': 'Código de Patagonia de nov-2025; C. Baptista pidió no borrarlo hasta tener el del proveedor (mail del 25/11/2025).',
    '427HIL004COS01': 'Código de Patagonia de nov-2025; C. Baptista pidió no borrarlo hasta tener el del proveedor (mail del 25/11/2025).',
    'BX138A-1530E': 'La BOM 105 / 106 y la HO 116 / 117 del P703 lo escriben BX138-1530E (Tex 135).',
    'BX92EX-12124E': 'El cliente pide el artículo BX138 en el mismo color (LSC v1 del P21 naranja).',
}


def armar(ayuda_visual=None, fuente_ayuda=''):
    """{pieza: OrderedDict{codigo: {'usos': [...], 'fuentes': [...]}}} y la lista de piezas que el listado
    de Patagonia da sin costura."""
    docs = collections.OrderedDict()
    sin = []

    def poner(pieza, cod, uso, fuente):
        d = docs.setdefault(pieza, collections.OrderedDict()).setdefault(cod, {'usos': [], 'fuentes': []})
        if uso not in d['usos']:
            d['usos'].append(uso)
        if fuente not in d['fuentes']:
            d['fuentes'].append(fuente)
    if ayuda_visual:
        filas, sin = leer_ayuda_visual(ayuda_visual, fuente_ayuda)
        for pieza, cod, uso, fuente in filas:
            poner(pieza, cod, uso, fuente)
    for piezas, cod, uso, fuente in DOCUMENTOS:
        for p in piezas:
            poner(p, cod, uso, fuente)
    return docs, sin


def texto_uso(usos):
    """['Unión', 'Bobina de la vista'] -> 'Unión y bobina de la vista'."""
    if not usos:
        return ''
    return usos[0] + ''.join(' y ' + u[0].lower() + u[1:] for u in usos[1:])
