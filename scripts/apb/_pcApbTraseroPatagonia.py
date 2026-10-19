"""
_pcApbTraseroPatagonia.py — propuesta de Ingenieria del plan de control del apoyabrazos trasero central
Patagonia (2HC.885.081 RL1), armada entera y limpia sobre el formulario de Calidad.

Pedido: Manuel Meszaros a Fak, 19/10/2026 09:36 ("Plan de control APB Asiento Trasero Patagonia": el
siguiente paso para someter BeOn, para que Luca lo suba). Camino: skill `planes-de-control` §5 punto 3,
rearmado entero = archivo limpio (sin amarillo ni notas) y los cambios en la lista aparte; una
caracteristica por fila; la D sola en rojo. Ninguna celda remite a la hoja de operaciones (Fak, 19/10/2026,
sobre el de los APC: "pusiste segun HO de corte, eso sacalo"): cada celda dice el dato.

Formulario: el de Calidad del APB central de Amarok (`PC 2H6863761B - APB CENTRAL VW AMAROK rev1.xls`, hoja
'PC v02', M. Nieve), la pieza hermana: mismo proceso y mismo programa de inyeccion (N° 9 APBCAMAROK). Del
Amarok se toma SOLO el formulario: ningun valor de esa pieza pasa a esta.

Fuentes (leidas el 19/10/2026; cada fila dice la suya en `_fuente`):
  flujograma 151 Rev.B (tools/flowchart/data/151-APB-TRASERO-CENTRAL.json) - manda la numeracion
  AMFE 150 (Supabase live, updated_at 2026-10-01) - siglas asignadas y controles
  HO-986 Rev.A (SGC, HOJAS DE OPERACIONES\\...\\APB TRASERO CENTRAL) - ciclo de control de cada operacion
  BOM arb ultimo nivel 22/09/2026 (legajo 7-) - materiales que se reciben
  Apoyabrazos trasero central Patagonia - costura y cinta - 05-10-2026 (legajo 13-; LAH.000.881.N v6)
  Validacion_Espumado_APB_Patagonia.pptx (legajo 26-, aprobo L. Lattanzi, marzo 2026) - parametros PU
  GE-102 ARMREST REAR Rev.C (C. Baptista 07/10/2026) - embalaje
  planes de recepcion de Calidad y cronograma de calibracion 2026 (ver RECEPCION y MC abajo)

Uso:  python scripts/apb/_pcApbTraseroPatagonia.py <formulario_amarok.xls> <carpeta_salida> [nombre.xls]
No escribe en el servidor ni en Supabase: copia el formulario y trabaja sobre la copia.
"""
import os
import shutil
import sys

import win32com.client as win32

ROJO_FUENTE = 255
HOJA_FORM = 'PC v02'
FECHA = '19/10/2026'
CODIGO = '2HC.885.081 RL1'
DESCRIPCION = 'APB TRASERO CENTRAL VW PATAGONIA (ARMREST, REAR, L3 TITAN BLACK)'
FLUJO = 'Flujograma 151 Rev.B'
HO = 'HO-986 Rev.A'
COSTURA = 'Especificacion de costura y cinta del 05/10/2026 (LAH.000.881.N v6 y corte A-A del plano)'
PU = 'Validacion de espumado APB Patagonia (marzo 2026, aprobo L. Lattanzi)'
GE = 'GE-102 ARMREST REAR Rev.C (07/10/2026)'

COLS = 'ABCDEFGHIJKLMN'
CAMPOS = ['op', 'nom', 'maq', 'n', 'prod', 'proc', 'clas', 'esp', 'inst', 'tam', 'frec', 'reg', 'resp', 'reac']

# responsable de recepcion: como los 4 planes de Calidad de Patagonia (Rev 0 de Nicolas y Rev 1 de esta pieza)
REC = dict(tam='1 Muestra', frec='Por entrega', reg='P-10/I. / ARB', resp='Recepción de materiales.', reac='P-14.')
CUATRO = 'Inicio de turno / Falla mantenimiento / Corte de energía / Problema de calidad'
SETUP = dict(tam='1 control', frec=CUATRO, reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.')
# set up de costura, inyeccion y tapizado: la HO-986 (hojas 40, 50 y 60) dice "inicio de turno"; el plan Rev 1 de Calidad
# y el AMFE 150 op 40 agregan "despues de cada intervencion mecanica o parada de mas de 1 h" (la formula de 18 de 22 planes de Calidad)
SETUP_TURNO = dict(tam='1 control', frec='Inicio de turno / después de cada intervención mecánica o parada de más de 1 h', reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.')
# kits y retrabajos: la HO-986 (hojas 30, 80 y 82) tiene el ciclo de control en TBD y el plan Rev 1 no los trae
SINPAPEL = dict(tam='TBD', frec='TBD', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.')
# primera y ultima pieza de costura: plan Rev 1 de Calidad (op 30 costura, "1 pieza - Inicio y fin de turno - Registro de control")
PRIMERA = dict(tam='1 Pieza', frec='Inicio y fin de turno', reg='Registro de control', resp='Operador de producción', reac='Según P-09/I.')
REV1 = 'plan Rev 1 de Calidad de esta pieza (M. Nieve, 31/07/2026)'
LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    'tools', 'flowchart', 'assets', 'barack_logo.png')
# frecuencia de los controles de proceso: 100 % por lote, autocontrol del operador, como la HO-986 (OP / 100%)
# y el plan Rev 1 de Calidad de esta pieza (M. Nieve, 31/07/2026)
AUTO = dict(tam='100%', frec='Por lote', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.')
# control final: "Operador de calidad", como 20 de 27 planes de Calidad (equipo A, 19/10)
FINAL = dict(tam='100%', frec='Por lote', reg='Registro de control', resp='Operador de calidad', reac='Según P-09/I.')


def fila(fuente='', **k):
    d = {c: '' for c in CAMPOS}
    d.update(k)
    d['_fuente'] = fuente
    return d


def seccion(texto):
    return {'_seccion': texto}


def doble(fuente, base, n, prod='', proc='', clas='', esp='', inst='', primera=False):
    """Caracteristica de proceso: 100 % autocontrol del operador (HO-986 y plan Rev 1 de Calidad). Con `primera`, antes
    va la fila de primera y ultima pieza con registro (plan Rev 1 en costura; skill §3.2, patron Toyota/TBA)."""
    filas = []
    if primera:
        # como los planes de Calidad (Top Roll Rev 0, op 10): la segunda fila lleva solo muestra, registro y responsable
        filas.append(fila(fuente, **base, n=n, prod=prod, proc=proc, clas=clas, esp=esp, inst=inst, **PRIMERA))
        filas.append(fila(fuente, _une=True, **AUTO))
        return filas
    filas.append(fila(fuente, **base, n=n, prod=prod, proc=proc, clas=clas, esp=esp, inst=inst, **AUTO))
    return filas


# ---------------------------------------------------------------- recepcion (op 10)
def filas_recepcion():
    from _pcApbRecepcion import RECEPCION  # tabla aparte: cada material con su plan de recepcion
    R = [seccion('Recepción')]
    op10 = dict(op='Operación 10.', nom='Recepción y control de materia prima')
    n = 0
    for i, mat in enumerate(RECEPCION):
        n += 1
        for j, (car, clas, esp, inst, extra) in enumerate(mat['filas']):
            k = dict(REC)
            k.update(extra or {})
            R.append(fila(mat['fuente'], **(op10 if (i == 0 and j == 0) else {}),
                          n=f'{n}.0' if j == 0 else '', prod=mat['prod'] if j == 0 else '', proc=car, clas=clas,
                          esp=esp, inst=inst, **k))
    return R


# ---------------------------------------------------------------- proceso
def filas_proceso():
    R = [seccion('Proceso')]

    # --- 20 corte: una sola operacion en el flujograma; los controles salen del ciclo de control de la HO
    f20 = f'{FLUJO} op 20 + {HO} (ciclo de control de las hojas 20 a 28) + AMFE 150 op 20'
    # mesa: plan Rev 1 de Calidad (M. Nieve, 31/07/2026), op 20 "Mesa de corte automatica BM 149"
    b20 = dict(op='Operación 20.', nom='Corte de componentes', maq='Mesa de corte automática N° BM 149')
    vez = AUTO   # la HO-986 (hojas 20, 22 y 24): OP, 100 %
    corte = dict(tam='1 control', frec='Antes de cada corte', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.')
    R += [
        fila(f20, **b20, n='1.0', proc='Código de material del rollo', esp='Según planilla de mesa de corte (código y descripción de la orden de producción)',
             inst='Visual contra planilla de corte', **vez),
        fila(f20, n='2.0', proc='Posición del lado vista del vinilo', esp='Según planilla de mesa de corte', inst='Visual contra planilla de corte', **vez),
        fila(f20, n='3.0', proc='Alineación del vinilo detrás de los rodillos', esp='Vinilo alineado detrás de los rodillos', inst='Visual', **vez),
        fila(f20, n='4.0', proc='Velocidad de la máquina', esp='TBD (el operador no la modifica)', inst='Visual en el panel de la máquina', **SETUP),
        fila(f20, proc='Tensión del vinilo', esp='TBD', inst='Visual en el panel de la máquina', **SETUP),
        fila(f20, n='5.0', prod='Largo de la capa (largo de tizada + demasía)', esp='Según planilla de mesa de corte', inst='Regla (código TBD)',
             tam='1 control', frec='Primera capa de cada tizada', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
        fila(f20, n='6.0', proc='Alineación de las capas en la mesa', esp='Vinilo recto y coincidente con las líneas rojas de la mesa', inst='Visual', **AUTO),
        fila(f20, n='7.0', proc='Ancho de cuchilla', esp='4 mm mínimo, igual al ancho cargado en el programa de corte', inst='Calibre MC167',
             tam='1 control', frec='Antes de cada corte', reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.'),
        fila(f20, n='8.0', proc='Margen entre el cabezal y el borde del vinilo', esp='Máximo 2,5 cm por lado', inst='Visual y láser de la máquina', **corte),
        fila(f20, n='9.0', proc='Posición del cabezal y del plato al iniciar el corte', esp='Plato elevado antes de iniciar el corte', inst='Visual', **corte),
        fila(f20, n='10.0', proc='Plantilla Mylar correcta', esp='La de la referencia y el material de la planilla de corte', inst='Visual contra planilla de corte',
             tam='1 control', frec=CUATRO, reg='Registro de set up', resp='Operador de producción / Operador de calidad', reac='Según P-09/I.'),
        fila(f20, n='11.0', prod='Contorno de la pieza cortada', esp='Dentro del área OK de la plantilla, ± 1 mm (ni más grande ni más chica)',
             inst='Plantilla Mylar REAR ARMREST (código MC TBD)', tam='1 Pieza', frec=CUATRO, reg='Registro de set up',
             resp='Operador de producción / Operador de calidad', reac='Según P-09/I.'),
        # HO-986 hoja 23 paso 3 ("ingresar la cantidad de capas revisando la planilla"); el plan Rev 1 dice 20 capas: a la lista
        fila(f20, n='12.0', proc='Cantidad de capas', esp='Según planilla de mesa de corte', inst='Visual contra planilla de corte',
             tam='1 control', frec='Inicio de turno', reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.'),
    ]

    # --- 30 kits
    f30 = f'{FLUJO} op 30 + {HO} hoja 30 (pasos) + AMFE 150 op 30 (controles de detección)'
    b30 = dict(op='Operación 30.', nom='Preparación de kits de componentes', maq='Medio WIP / caja de kit')
    R += [
        fila(f30, **b30, n='1.0', prod='Cantidad de componentes del kit', esp='Completo según lista de materiales del kit y la orden de producción',
             inst='Conteo visual', **SINPAPEL),
        fila(f30, n='2.0', prod='Componente correcto (variante y color)', esp='Según orden de producción', inst='Visual contra orden de producción', **SINPAPEL),
        fila(f30, n='3.0', prod='Aspecto de los componentes', esp='Sin rasgaduras, manchas ni defectos de corte', inst='Visual', **SINPAPEL),
    ]

    # --- 40 costura union
    f40 = f'{FLUJO} op 40 + {COSTURA} + {HO} hoja 40 + AMFE 150 op 40'
    b40 = dict(op='Operación 40.', nom='Costura unión', maq='Máquina de coser recta (N° TBD)')
    R.append(fila(f40, **b40, n='1.0', proc='Set up: aguja e hilo en aguja y bobina', esp='Aguja N° 18 · hilo Nm 30/3 negro FX284-E0PTO en aguja y bobina',
                  inst='Visual', **SETUP_TURNO))
    # primera y ultima pieza con registro en lo que el plan Rev 1 controla asi (costura completa, sin arrugas, largo de puntada)
    # y en el margen, que es un valor medible (VW, VDA 6.3: "deben ser registrados los valores... en costura")
    for n, (prod, esp, inst, prim) in enumerate([
        ('Margen (toma) de costura', '8 ± 1 mm', 'Regla (código MC TBD)', True),
        ('Densidad de puntada', '4 puntadas en 16 mm ± 1 mm', 'Regla (código MC TBD)', True),
        ('Atraque', '3 a 4 puntadas, una vez atrás y una adelante', 'Visual', False),
        ('Cinta de manipulación: costura', 'Se cose solo la parte de adentro (25 mm); los 75 mm de afuera no llevan costura', 'Regla (código MC TBD)', False),
        ('Cierre cosido en la abertura de la funda', 'Cierre completo y alineado con la abertura', 'Visual / muestra patrón', False),
        ('Costura completa', 'Sin costura floja, salteada ni faltante', 'Visual / muestra patrón', True),
        ('Funda sin arrugas ni pliegues', 'Según muestra patrón', 'Visual / muestra patrón', True),
        # AMFE 150 op 40, "rotura del vinilo en la zona de la costura" (S10 O3, detección visual)
        ('Vinilo sin roturas en la zona de costura', 'Sin roturas ni perforaciones', 'Visual', False),
    ], start=2):
        R += doble(f40 + (f' + {REV1}' if prim else ''), {}, f'{n}.0', prod=prod, esp=esp, inst=inst, primera=prim)

    # --- 50 inyeccion PUR in situ: los valores del set up son los de la validacion de espumado (programa N° 9)
    f50 = f'{FLUJO} op 50 + {PU} + {HO} hoja 50 + AMFE 150 op 50'
    b50 = dict(op='Operación 50.', nom='Inyección de PUR in situ', maq='Inyectora PU con dosificadora A:B Purmatic (N° TBD)')
    R.append(fila(f50, **b50, n='1.0', proc='Programa de inyección', esp='Programa N° 9 (APBCAMAROK)', inst='Visual en la pantalla de la dosificadora', **SETUP_TURNO))
    for proc, esp in [('Tiempo de colada', '7,00 s (tolerancia TBD)'),
                      ('Caudal total', '4,00 kg/min (tolerancia TBD)'),
                      ('Relación poliol / isocianato', '200 / 40'),
                      ('Presión de poliol', '0,8 bar (tolerancia TBD)'),
                      ('Presión de isocianato', '1,3 bar (tolerancia TBD)'),
                      ('Coeficiente de corrección de poliol', '100 %'),
                      ('Coeficiente de corrección de isocianato', '65 %'),
                      ('Temperatura de poliol', 'TBD'),
                      ('Temperatura de isocianato', 'TBD'),
                      ('Temperatura del molde', 'TBD')]:
        R.append(fila(f50, proc=proc, esp=esp, inst='Visual en la pantalla de la dosificadora' if 'Temperatura' not in proc else 'Termómetro (código TBD)', **SETUP_TURNO))
    R.append(fila(f50, n='2.0', proc='Colocación de la estructura, el hard felt con Aplix y la pieza postiza en el molde',
                  esp='En posición, contra la guía del molde, antes de cerrar', inst='Visual', **AUTO))
    for n, (prod, esp, inst) in enumerate([
        ('Adherencia estructura - espuma', 'Sin despegues', 'Visual / muestra patrón'),
        ('Adherencia espuma - hard felt', 'Sin despegues', 'Visual / muestra patrón'),
        ('Aplix', 'Presente y en posición', 'Visual / muestra patrón'),
        ('Aspecto de la pieza espumada', 'Sin burbujas, cortes ni marcas', 'Visual / muestra patrón'),
        ('Orificio inferior', 'Sellado completo', 'Visual'),
    ], start=3):
        R += doble(f50, {}, f'{n}.0', prod=prod, esp=esp, inst=inst)
    # el AMFE 150 op 50 pide el peso "con hoja de registro" (valor medible); la tolerancia va a la lista
    R.append(fila(f50, n='8.0', prod='Peso de la pieza espumada', esp='TBD', inst='Balanza (código TBD)',
                  tam='100%', frec='Por lote', reg='Hoja de registro', resp='Operador de producción', reac='Según P-09/I.'))

    # --- 60 tapizado
    f60 = f'{FLUJO} op 60 + {HO} hoja 60 + AMFE 150 op 60'
    b60 = dict(op='Operación 60.', nom='Tapizado', maq='Mesa de tapizado semiautomática / horno')
    # el set up del horno lo nombran la HO-986 hoja 60, el AMFE 150 op 60 y el plan Rev 1 de Calidad (op 41): ninguno da valores
    R.append(fila(f60 + ' + plan Rev 1 de Calidad (op 41 "Set up de Horno")', **b60, n='1.0', proc='Set up del horno',
                  esp='TBD (temperatura y tiempo)', inst='Visual', **SETUP_TURNO))
    b60 = {}
    first = True
    for n, (prod, esp, inst) in enumerate([
        ('Funda sin arrugas, pliegues ni marcas', 'Según muestra patrón', 'Visual / muestra patrón'),
        ('Posición del felt respecto del vinilo', 'Según muestra patrón', 'Visual / muestra patrón'),
        ('Costura alineada', 'Según calibre', 'Calibre de tapizado (código MC TBD)'),
        ('Funda sin desgarros ni perforaciones', 'Sin roturas', 'Visual'),
        ('Cierre de la funda', 'Cerrado completo, sin separación', 'Visual y táctil'),
        ('Rebaba de espuma visible', 'Sin rebaba visible', 'Visual / muestra límite'),
    ], start=2):
        R += doble(f60, b60 if first else {}, f'{n}.0', prod=prod, esp=esp, inst=inst)
        first = False

    # --- 61 portavasos y marco
    f61 = f'{FLUJO} op 61 + {HO} hoja 61 + AMFE 150 op 61'
    b61 = dict(op='Operación 61.', nom='Montaje de portavasos y marco', maq='Manual')
    R += [
        fila(f61, **b61, n='1.0', prod='Encastre del portavasos 2HC.885.119 y del marco 2HC.885.725', esp='Encastrado y trabado',
             inst='Visual / muestra patrón', **AUTO),
        fila(f61, n='2.0', prod='Apertura y cierre del portavasos', esp='Abre y cierra', inst='Prueba funcional manual', **AUTO),
        # HO-986 hoja 61: OP / OC
        fila(f61, n='3.0', prod='Aspecto del portavasos y del marco', esp='Sin cortes, manchas ni marcas', inst='Visual / muestra patrón',
             **dict(AUTO, resp='Operador de producción / Operador de calidad')),
    ]

    # --- 70 control final
    f70 = f'{FLUJO} op 70 + {HO} hoja 70 (lo que verifica el inspector) + AMFE 150 op 70'
    b70 = dict(op='Operación 70.', nom='Control final de calidad y pruebas funcionales', maq='Manual / calibre de control')
    first = True
    for n, (prod, esp, inst) in enumerate([
        ('Deformaciones', 'Sin deformaciones', 'Visual / muestra patrón'),
        ('Marcas en el vinilo', 'Sin marcas', 'Visual / muestra patrón'),
        ('Costuras', 'Sin costuras abiertas', 'Visual'),
        ('Cierre', 'Bien colocado, sin aberturas', 'Visual'),
        ('Cinta de manipulación', 'Presente; 75 mm afuera de la pieza', 'Visual'),
        ('Portavasos y marco', 'Bien colocados', 'Visual'),
        ('Funcionamiento del portavasos', 'Abre y cierra', 'Prueba funcional manual'),
    ], start=1):
        R.append(fila(f70, **(b70 if first else {}), n=f'{n}.0', prod=prod, esp=esp, inst=inst, **FINAL))
        first = False
    R.append(fila(f70, n='8.0', prod='Dimensional', esp='Según calibre de forma', inst='Calibre de forma APB TAPA PATAGONIA MC505',
                  tam='1 Pieza', frec='Primera pieza', reg='Registro de control', resp='Operador de calidad', reac='Según P-09/I.'))
    R.append(fila(f70, n='9.0', prod='Identificación de la pieza', esp=f'Etiqueta ET-SATO-50X20 con código {CODIGO}', inst='Visual', **FINAL))
    R.append(fila(f70, n='10.0', prod='Embolsado', esp='Pieza en bolsa PP 600 x 500 mm (427VAR002TAP01)', inst='Visual', **FINAL))
    # AMFE 150 op 70, "pieza con rebaba visible": iluminación dirigida y muestra límite
    R.append(fila(f70, n='11.0', prod='Rebaba de espuma visible', esp='Sin rebaba visible', inst='Visual con iluminación dirigida / muestra límite', **FINAL))
    # plan Rev 1 de Calidad, "Inspección final + Sistema ARB"
    R.append(fila(f70 + f' + {REV1}', n='12.0', proc='Carga en el sistema ARB', esp='Cantidad OK / cantidad NOK', inst='Sistema ARB',
                  tam='100%', frec='Por lote', reg='Sistema ARB', resp='Operador de calidad', reac='Según P-09/I.'))

    # --- 80 y 82 retrabajos (estan en el flujograma, el AMFE y la HO)
    f80 = f'{FLUJO} op 80 + {HO} hoja 80 + AMFE 150 op 80'
    b80 = dict(op='Operación 80.', nom='Reproceso: corrección de defectos generales', maq='Herramientas de retrabajo (tijera / piquete)')
    R += [
        fila(f80, **b80, n='1.0', prod='Hilo sobrante', esp='Cortado al ras o atado; largo residual máximo TBD', inst='Visual', **SINPAPEL),
        fila(f80, n='2.0', prod='Nudo o atado', esp='Firme, no se deshace', inst='Visual y táctil', **SINPAPEL),
        fila(f80, n='3.0', prod='Encastres plásticos', esp='Sin roturas ni fisuras', inst='Visual', **SINPAPEL),
        fila(f80, n='4.0', prod='Pieza retrabajada', esp='Vuelve a la operación 70 y se controla completa; si no se puede corregir, va a scrap',
             inst='Control final completo', tam='100%', frec='Cada pieza retrabajada', reg='Registro de control', resp='Operador de calidad', reac='Según P-09/I.'),
    ]
    f82 = f'{FLUJO} op 82 + {HO} hoja 82 + AMFE 150 op 82'
    b82 = dict(op='Operación 82.', nom='Reproceso: re-tapizado de funda', maq='Mesa de re-tapizado')
    R += [
        fila(f82, **b82, n='1.0', prod='Estado de la pieza espumada al retirar la funda', esp='Sin daños; si está dañada, va a scrap', inst='Visual', **SINPAPEL),
        fila(f82, n='2.0', prod='Encastres plásticos', esp='Sin roturas ni fisuras', inst='Visual', **SINPAPEL),
        fila(f82, n='3.0', prod='Funda re-tapizada', esp='Sin arrugas ni pliegues, con el tensado de la operación 60', inst='Visual / muestra patrón', **SINPAPEL),
        fila(f82, n='4.0', prod='Pieza retrabajada', esp='Vuelve a la operación 70 y se controla completa',
             inst='Control final completo', tam='100%', frec='Cada pieza retrabajada', reg='Registro de control', resp='Operador de calidad', reac='Según P-09/I.'),
    ]

    # --- 90 embalaje: la ficha vigente (la HO-986 todavia dice 126 piezas por medio 111970)
    f90 = f'{FLUJO} op 90 + {GE}'
    b90 = dict(op='Operación 90.', nom='Embalaje y etiquetado de producto terminado', maq='Cajón metálico CKD pequeño CKV3755')
    # frecuencia: HO-986 hoja 90 ("Por turno") y plan Rev 1 (op 60, "100 % · Por turno", operador de logística)
    emb = dict(tam='100%', frec='Por turno', reg='Autocontrol', resp='Operador de logística', reac='Según P-09/I.')
    R += [
        fila(f90, **b90, n='1.0', prod='Identificación del medio', esp=f'Etiqueta de ilustración ET-SATO-100X60 con código {CODIGO}', inst='Visual', **emb),
        fila(f90, n='2.0', prod='Cantidad por medio', esp='30 piezas por cajón (5 pisos de 6 piezas acostadas)', inst='Conteo visual', **emb),
        fila(f90, n='3.0', prod='Protección de cada pieza', esp='1 envoltorio de pluribol o espuma por pieza', inst='Visual', **emb),
        fila(f90, n='4.0', prod='Separadores', esp='6 láminas de cartón CARTSEP03 (fondo, 4 entre pisos y tapa)', inst='Visual', **emb),
    ]

    # --- test de lay out
    R.append(seccion('TEST DE LAY OUT'))
    # muestra, frecuencia, registro y responsable: plan Rev 1 de Calidad (op "Test de lay out": 30 muestras, auditoría de
    # producto, informe de medición, metrólogo; flamabilidad horizontal con cámara, 1 muestra, operador de calidad).
    # Los ensayos de VW salen del plan de validación (DV&PV preliminar, 07/04/2025): cuáles entran, lo define Calidad
    flo = f'CSR VW: layout inspection and functional testing (la VDA 6.3 de VW de 2025 lo marcó incompleto) + {REV1}'
    R += [
        fila(flo, op='1.0', nom='Test de lay out', n='1.0', prod='Dimensional completo según plano', esp='Cotas del plano del cliente (TBD)',
             inst='Calibre dimensional / laboratorio', tam='30 muestras', frec='Auditoría de producto', reg='Informe de medición',
             resp='Metrólogo', reac='Según P-09/I.'),
        fila(flo, n='2.0', prod='Flamabilidad horizontal (TL 1010)', esp='< 100 mm/min', inst='Cámara de flamabilidad MC184',
             tam='1 Muestra', frec='Auditoría de producto', reg='Registro de auditoría', resp='Operador de calidad', reac='Según P-09/I.'),
        fila(flo, n='3.0', prod='Ensayos del cliente sobre la pieza completa', esp='TBD (los del plan de validación que defina Calidad)',
             inst='Laboratorio', tam='TBD', frec='Anual', reg='Informe de laboratorio', resp='Calidad', reac='Según P-09/I.'),
    ]
    return R


# ---------------------------------------------------------------- Excel
def celda_superior(ws, direccion):
    """La celda que manda en una combinada (escribir en otra no muestra nada)."""
    return ws.Range(direccion).MergeArea.Cells(1, 1)


def poner(ws, direccion, valor):
    c = celda_superior(ws, direccion)
    c.NumberFormat = '@'
    c.Value = valor


def encabezado(ws):
    poner(ws, 'A4', f'DESCRIPCION:  {CODIGO} - {DESCRIPCION}')
    poner(ws, 'C5', CODIGO)
    poner(ws, 'A67', CODIGO)
    poner(ws, 'A69', DESCRIPCION)
    poner(ws, 'G65', 'TBD (Calidad)')
    poner(ws, 'H64', '')
    # sin revision nueva (Fak, 19/10/2026): fecha original la del plan Rev 1 de Calidad (encabezado: 10/04/2025) y la de
    # revision vacia; la revision la abre Calidad al emitir
    poner(ws, 'K65', '10/04/2025')
    poner(ws, 'M65', '')
    poner(ws, 'L67', '')
    poner(ws, 'G67', 'TBD (equipo de Calidad)')
    poner(ws, 'H69', 'VOLKSWAGEN (VW427 Patagonia)')
    poner(ws, 'G71', CODIGO)
    # fase: prelanzamiento (Patagonia no esta en serie), una sola marcada. En el formulario son tres casillas
    # dibujadas (Rectangle 8 = prototipo, 14 = prelanzamiento, 15 = produccion); el Amarok tenia rellena la de produccion.
    poner(ws, 'A64', '      PROTOTIPO                   PRELANZAMIENTO                   PRODUCCION     ')
    for nombre, rellena in (('Rectangle 8', False), ('Rectangle 14', True), ('Rectangle 15', False)):
        s = ws.Shapes(nombre)
        s.Fill.Visible = rellena
        if rellena:
            s.Fill.ForeColor.RGB = 0
    # nivel de actualizacion (recuadro rojo): el del plan vigente de Calidad (Rev 1); la proxima la abre Calidad
    ws.Shapes('Text Box 19').TextFrame2.TextRange.Text = '1'
    # S/R: SI (hay una D asignada en el AMFE 150, op 10)
    poner(ws, 'L69', 'X')
    poner(ws, 'N69', '')
    # revisiones: se borran las del Amarok; la letra y la fecha de emision las pone Calidad
    for r in range(11, 30):
        for c in range(1, 15):
            try:
                ws.Cells(r, c).MergeArea.Cells(1, 1).Value = ''
            except Exception:
                pass
    # la letra de revision del Amarok (una "D" en M5 y en M71) no es de esta pieza: se borra
    poner(ws, 'M5', '')
    poner(ws, 'M71', '')
    # tabla de revisiones: solo la Rev 1 de Calidad de esta pieza (M. Nieve, 31/07/2026). Sin fila nueva y sin el nombre
    # de Fak (Fak, 19/10/2026: "no puede figurar mi nombre en los planes de control, no pongas una nueva revision")
    poner(ws, 'A11', '1')
    poner(ws, 'B11', '31/07/2026')
    poner(ws, 'C11', 'N/A.')
    poner(ws, 'E11', 'EMISION INICIAL.')
    poner(ws, 'N11', 'MN')
    # la descripcion de la primera hoja salia cortada a la izquierda en el PDF
    celda_superior(ws, 'A4').HorizontalAlignment = -4131


def logo_oficial(ws):
    """El formulario de Amarok trae el logo viejo (fondo gris): se cambia por el oficial en el mismo lugar y alto
    (core-prohibiciones §9; Fak 19/10/2026). Frena si no encuentra ninguno: un formulario sin logo tambien esta mal."""
    viejos = [s for s in ws.Shapes if s.Type == 13]   # msoPicture
    if not viejos:
        raise RuntimeError('el formulario no tiene logo para cambiar')
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


def escribir(ws, filas):
    xl_up = -4162
    primera = None
    for r in range(70, 90):
        if str(ws.Cells(r, 1).Value or '').strip().lower().startswith('recep'):
            primera = r
            break
    if primera is None:
        raise RuntimeError('no encuentro la fila "Recepción" del formulario')
    ultima = primera
    for c in range(1, 15):
        ultima = max(ultima, ws.Cells(ws.Rows.Count, c).End(xl_up).Row)
    fuente_letra = ws.Cells(primera + 1, 5).Font.Name
    tam_letra = ws.Cells(primera + 1, 5).Font.Size
    sec_color = ws.Cells(primera, 1).Interior.Color
    ws.Range(ws.Cells(primera, 1), ws.Cells(ultima + 5, 14)).UnMerge()
    ws.Range(ws.Rows(primera), ws.Rows(ultima + 5)).Delete()

    r = primera
    grupos, grupo_ini = [], None
    salto_90 = None
    for f in filas:
        if '_seccion' in f:
            if grupo_ini is not None:
                grupos.append((grupo_ini, r - 1))
                grupo_ini = None
            rng = ws.Range(ws.Cells(r, 1), ws.Cells(r, 14))
            rng.Merge()
            rng.Value = f['_seccion']
            rng.Font.Bold = True
            rng.Font.Name = fuente_letra
            rng.Font.Size = tam_letra
            rng.Interior.Color = sec_color
            rng.HorizontalAlignment = -4108
            rng.Borders.LineStyle = 1
            r += 1
            continue
        if f['op'] and grupo_ini is not None:
            grupos.append((grupo_ini, r - 1))
            grupo_ini = None
        if f['op']:
            grupo_ini = r
        rng = ws.Range(ws.Cells(r, 1), ws.Cells(r, 14))
        rng.Font.Name = fuente_letra
        rng.Font.Size = tam_letra
        rng.Font.Bold = False
        rng.Interior.ColorIndex = -4142
        rng.WrapText = True
        rng.VerticalAlignment = -4108
        rng.Borders.LineStyle = 1
        for i, campo in enumerate(CAMPOS):
            cel = ws.Cells(r, i + 1)
            cel.NumberFormat = '@'
            valor = f[campo]
            cel.Value = valor
            if 'TBD' in str(valor):
                cel.Font.Color = ROJO_FUENTE
            if campo == 'clas' and valor.strip() == 'D':
                cel.Font.Color = ROJO_FUENTE   # la casa marca la D en rojo (planes de Calidad, VDA 6.3 de VW 6.2.3)
                cel.Font.Bold = True
        for c in (4, 7, 10, 11):
            ws.Cells(r, c).HorizontalAlignment = -4108
        if f.get('_une'):
            # segunda fila de primera/ultima pieza: la caracteristica se combina con la de arriba, como el plan Rev 1
            # (sino en el PDF se ven las columnas D a I vacias)
            for c in range(4, 10):
                rr = ws.Range(ws.Cells(r - 1, c), ws.Cells(r, c))
                rr.Merge()
                rr.VerticalAlignment = -4108
        if f['op'] == 'Operación 90.':
            salto_90 = r
        r += 1
    if grupo_ini is not None:
        grupos.append((grupo_ini, r - 1))
    for a, b in grupos:
        if b > a:
            for c in (1, 2, 3):
                rr = ws.Range(ws.Cells(a, c), ws.Cells(b, c))
                rr.Merge()
                rr.VerticalAlignment = -4108
                rr.HorizontalAlignment = -4108
    ws.Range(ws.Rows(primera), ws.Rows(r)).AutoFit()
    try:
        ws.PageSetup.PrintArea = f'$A$1:$N${r - 1}'
    except Exception:
        pass
    # el embalaje (op 90) quedaba partido entre dos hojas con el medio cortado: empieza en hoja nueva
    if salto_90:
        ws.HPageBreaks.Add(ws.Cells(salto_90, 1))
    return len([f for f in filas if '_seccion' not in f])


def todas_las_filas():
    return filas_recepcion() + filas_proceso()


def chequeo_sin_remision_a_la_ho(filas):
    """Fak, 19/10/2026: ninguna celda del plan remite a la hoja de operaciones. Frena antes de escribir."""
    import re
    patron = re.compile(r'\bHO\b|\bHO-\d|\bpestañas? \d|hoja de operaci|ver hoja de set', re.IGNORECASE)
    malas = []
    for f in filas:
        for campo in CAMPOS:
            v = str(f.get(campo, ''))
            if patron.search(v):
                malas.append((campo, v))
    return malas


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    origen, salida = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    filas = todas_las_filas()
    malas = chequeo_sin_remision_a_la_ho(filas)
    if malas:
        for m in malas:
            print('REMITE A LA HO:', m)
        sys.exit(1)
    os.makedirs(salida, exist_ok=True)
    nombre = sys.argv[3] if len(sys.argv) > 3 else 'PC APB TRASERO CENTRAL Patagonia - propuesta de Ingenieria 19-10-2026.xls'
    destino = os.path.join(salida, nombre)
    shutil.copyfile(origen, destino)
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    # el "ultimo autor" del archivo sale de aca al guardar. En un plan de control no figura Fak (19/10/2026), ni en las
    # propiedades: va la empresa (nunca una IA, core-prohibiciones §9)
    xl.UserName = 'Barack Mercosul'
    try:
        wb = xl.Workbooks.Open(destino)
        for ws in list(wb.Worksheets):
            if ws.Name != HOJA_FORM:
                ws.Delete()
        ws = wb.Worksheets(HOJA_FORM)
        ws.Name = 'PC APB TRASERO'
        encabezado(ws)
        logos = logo_oficial(ws)
        n = escribir(ws, filas)
        wb.BuiltinDocumentProperties('Author').Value = 'Barack Mercosul'
        wb.BuiltinDocumentProperties('Last Author').Value = 'Barack Mercosul'
        wb.BuiltinDocumentProperties('Title').Value = f'Plan de control {CODIGO}'
        wb.Save()
        wb.ExportAsFixedFormat(0, os.path.splitext(destino)[0] + '.pdf')
        wb.Close(False)
        print(f'{n} filas, {logos} logo(s) cambiados por el oficial')
    finally:
        xl.Quit()
    autor_sin_fak(destino)
    print(destino)


def autor_sin_fak(xls):
    """Excel 365 pisa "Guardado por" con la cuenta de Office al guardar, aunque arriba se ponga otro nombre (auditor,
    19/10/2026). En un plan de control no figura Fak: se reescribe en las propiedades del .xls, a mismo largo (los dos
    nombres miden 15 letras), y se relee. Frena si queda el nombre."""
    import olefile
    viejo, nuevo = 'Facundo Santoro', 'Barack Mercosul'
    assert len(viejo) == len(nuevo)
    with olefile.OleFileIO(xls, write_mode=True) as ole:
        for flujo in ('\x05SummaryInformation', '\x05DocumentSummaryInformation'):
            if not ole.exists(flujo):
                continue
            datos = ole.openstream(flujo).read()
            cambiado = datos
            for cod in ('cp1252', 'utf-16-le'):
                cambiado = cambiado.replace(viejo.encode(cod), nuevo.encode(cod))
            if cambiado != datos:
                ole.write_stream(flujo, cambiado)
    with olefile.OleFileIO(xls) as ole:
        for flujo in ('\x05SummaryInformation', '\x05DocumentSummaryInformation'):
            if ole.exists(flujo):
                datos = ole.openstream(flujo).read()
                if viejo.encode('cp1252') in datos or viejo.encode('utf-16-le') in datos:
                    raise RuntimeError(f'el archivo sigue con "{viejo}" en {flujo!r}')


if __name__ == '__main__':
    main()
