"""
_pcIpPadPatagonia.py — propuesta de Ingenieria del plan de control de COSTURA Y TAPIZADO del IP PAD Patagonia
(2HC.858.417.B FAM L1 / 2HC.858.417.C GKK L2 / 2HC.858.417.C GKN L3), armada entera y limpia sobre el formulario de Calidad.

Pedido: Manuel Meszaros a Fak, 19/10/2026 09:36 (tercera prioridad: "el plan de control del IP PAD (3 referencias)");
PEDIDO 14 de la PC principal (22/10/2026); Fak, 22/10: "nico no hizo un carajo... es una tarea 100% tuya".
Camino: skill `planes-de-control` §5 punto 3, rearmado entero = archivo limpio (sin amarillo ni notas) y los cambios en
la lista aparte; una caracteristica por fila; la D sola en rojo; ninguna celda remite a la hoja de operaciones.

Formulario: el del plan de Calidad `PC INYECCION PLASTICA IP PAD.xlsx` (legajo 12-, Rev A del 14/06/2026, formulario
I-AC-005.1 - Jun.26 - C), de esta misma pieza. Ese plan cubre la recepcion de la resina y la inyeccion del sustrato (20 a
26 de la hoja vieja = 20 y 21 del flujograma): aca va una fila que lo nombra y nada mas.

Fuentes (leidas el 22/10/2026; cada fila dice la suya en `_fuente`):
  flujograma 157 Rev.B (tools/flowchart/data/157-IP-PAD.json, 06/10/2026) - manda la numeracion
  AMFE 149 VWA-PAT-IPPADS-001 (Supabase live, updated_at 15/10/2026) - siglas asignadas y controles de deteccion
  HO-985 Rev.A (SGC, HOJAS DE OPERACIONES\\...\\HO 985 - IP PAD, modificada 15/10/2026) y su hoja A3 de la op 120 (01/10/2026)
  valores de costura de Patagonia confirmados por Fak (14/10/2026: IP PAD union 4 en 16 ± 1 toma 6 mm; vista 4 en 16 ± 1 a 4 ± 0,5)
  plan de control preliminar de Calidad de esta pieza (Rev 0, M. Nieve, 05/04/2025) - frecuencias de costura, adhesivado,
    tapizado, virolado, logo, final, embalaje y lay out
  BOM arb ultimo nivel 06/10/2026 (legajo 7-) - materiales que se reciben y componentes del ensamble
  cronograma de calibracion 2026 Rev.7 - codigos MC
  planes de recepcion de Calidad (ver _pcIpPadRecepcion.py)

Uso:  python scripts/ippad/_pcIpPadPatagonia.py <formulario_PC_INYECCION.xlsx> <carpeta_salida> [nombre.xlsx]
No escribe en el servidor ni en Supabase: copia el formulario y trabaja sobre la copia.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pcIpPadForm import (HOJA_FORM, abrir_excel, autor_limpio_xlsx, celda_superior, chequeo_sin_remision_a_la_ho,  # noqa: E402
                          escribir, fila, logo_en_celda, logo_oficial, nivel_actualizacion, poner, seccion)
from _pcIpPadValores import ADHESIVO, CALOR_90, CALOR_91, ESPUMA, FLAMA_PIEZA, ULTRASONIDO, VIROLADO  # noqa: E402

FECHA = '22/10/2026'
CODIGOS = '2HC.858.417.B FAM (L1) / 2HC.858.417.C GKK (L2) / 2HC.858.417.C GKN (L3)'
DESCRIPCION = 'IP PAD PATAGONIA - COSTURA Y TAPIZADO (L1 LOW / L2 y L3 HIGH)'
FLUJO = 'Flujograma 157 Rev.B'
HO = 'HO-985 Rev.A'
AMFE = 'AMFE 149'
PRELIM = 'plan preliminar de Calidad de esta pieza (Rev 0, M. Nieve, 05/04/2025)'
COSTURA = 'valores de costura de Patagonia confirmados (14/10/2026)'

REAC = 'Según P-09/I.'
OP = 'Operador de producción.'
OC = 'Operador de calidad.'
# set up del corte y del control con Mylar: la frecuencia de la hoja de operaciones (hojas 33 y 38)
CUATRO = 'Inicio de turno / Mantenimiento / Corte de energía / Problema de calidad'
SETUP_CORTE = dict(tam='1 control', frec=CUATRO, reg='Registro de set up', resp=OP, reac=REAC)
# set up de costura y de proceso: plan preliminar de Calidad (Rev 0) de esta pieza
INTERV = 'Inicio de turno / después de cada intervención mecánica o parada de más de 1 h'
SETUP = dict(tam='1 control', frec=INTERV, reg='Registro de set up', resp=OP, reac=REAC)
# controles del operador: 100 % por lote, autocontrol (plan preliminar de Calidad de esta pieza, costura a embalaje)
AUTO = dict(tam='100%', frec='Por lote.', reg='Autocontrol.', resp=OP, reac=REAC)
# primera y ultima pieza de costura: plan preliminar ("1 pieza - Inicio y fin de turno - Registro de control")
PRIMERA = dict(tam='1 pieza', frec='Inicio y fin de turno.', reg='Registro de control', resp=OP, reac=REAC)
# controles sin frecuencia en ningun papel de esta pieza
SINPAPEL = dict(tam='TBD', frec='TBD', reg='Autocontrol.', resp=OP, reac=REAC)
# la hoja de operaciones (hojas 30, 32 y 34) dice frecuencia "1" sin unidad: la frecuencia va TBD
HO_UNO = dict(tam='1 control', frec='TBD', reg='Autocontrol.', resp=OP, reac=REAC)
# mezcla del adhesivo: ningun papel da la frecuencia
MEZCLA = dict(tam='Cada mezcla', frec='TBD', reg='Registro de set up', resp=OP, reac=REAC)
CADA_CORTE = dict(tam='1 control', frec='Antes de cada corte', reg='Autocontrol.', resp=OP, reac=REAC)


def doble(fuente, base, n, prod='', proc='', clas='', esp='', inst=''):
    """Caracteristica con primera y ultima pieza registrada + 100 % autocontrol (plan preliminar de Calidad, costura)."""
    return [fila(fuente, **base, n=n, prod=prod, proc=proc, clas=clas, esp=esp, inst=inst, **PRIMERA),
            fila(fuente, _une=True, **AUTO)]


# ---------------------------------------------------------------- recepcion (op 10)
def filas_recepcion():
    from _pcIpPadRecepcion import RECEPCION
    from _pcIpPadForm import CAMPOS  # noqa: F401
    REC = dict(tam='1 muestra', frec='Por lote de entrega.', reg='P-10/I. / ARB', resp='Auditor de recepción.', reac='P-14.')
    R = [seccion('Recepción')]
    op10 = dict(op='Operación 10.', nom='Recepción y control de materia prima')
    n = 0
    for i, mat in enumerate(RECEPCION):
        n += 1
        for j, (car, clas, esp, inst, extra) in enumerate(mat['filas']):
            k = dict(REC)
            k.update(extra or {})
            R.append(fila(mat['fuente'], **(op10 if (i == 0 and j == 0) else {}),
                          n=str(n) if j == 0 else '', prod=mat['prod'] if j == 0 else '', proc=car, clas=clas,
                          esp=esp, inst=inst, **k))
    return R


# ---------------------------------------------------------------- proceso
def filas_proceso():
    R = [seccion('Proceso')]

    # --- 20 y 21: el plan de inyeccion de Calidad
    R.append(fila(f'{FLUJO} op 20 y 21 + plan de Calidad PC INYECCION PLASTICA IP PAD Rev A (14/06/2026)',
                  op='Operación 20 - 21.', nom='Inyección de piezas plásticas y control de pieza inyectada', maq='Inyectora',
                  n='1', prod='Resina PC+ABS Cycoloy C1200HF y sustrato inyectado (High y Low)',
                  esp='Según plan de control de inyección plástica IP PAD (Rev. A, 14/06/2026)',
                  inst='---', tam='---', frec='---', reg='---', resp='---', reac=REAC))

    # --- 30 preparacion y carga de vinilo (hoja 30) — maquina: el AMFE dice BMA090 y el preliminar BM 149; numero TBD hasta que lo confirme Fak (22/10)
    f30 = f'{FLUJO} op 30 + {HO} hoja 30 + {AMFE} op 30-31'
    b30 = dict(op='Operación 30.', nom='Preparación y carga de vinilo', maq='Mesa de corte automática (N° TBD)')
    R += [
        fila(f30, **b30, n='1', proc='Código de material del rollo', esp='Igual al de la orden de producción y la planilla de mesa de corte',
             inst='Visual contra planilla de corte', **HO_UNO),
        fila(f30, n='2', proc='Posición del lado vista del vinilo', esp='Según planilla de mesa de corte', inst='Visual contra planilla de corte', **HO_UNO),
    ]

    # --- 31 corte automatico (hojas 31 a 37)
    f31 = f'{FLUJO} op 31 + {HO} hojas 31 a 37 + {AMFE} op 30-31'
    b31 = dict(op='Operación 31.', nom='Corte automático de componentes', maq='Mesa de corte automática (N° TBD)')
    R += [
        fila(f31, **b31, n='1', proc='Alineación del vinilo detrás de los rodillos', esp='Vinilo alineado detrás de los rodillos', inst='Visual', **HO_UNO),
        fila(f31, n='2', proc='Velocidad de la máquina', esp='TBD (el operador no la modifica)', inst='Visual en el panel de la máquina', **SETUP_CORTE),
        fila(f31, n='3', proc='Tensión del vinilo', esp='TBD', inst='Visual en el panel de la máquina', **SETUP_CORTE),
        fila(f31, n='4', prod='Largo de la capa (largo de tizada + demasía)', esp='Según planilla de mesa de corte', inst='Regla (código MC TBD)',
             tam='1 control', frec='TBD', reg='Autocontrol.', resp=OP, reac=REAC),
        # plan preliminar de Calidad (op 0.25): "Cantidad de capas · 1 control · Inicio de turno · Registro de set up"
        fila(f31, n='5', proc='Cantidad de capas', esp='Según planilla de mesa de corte', inst='Visual contra planilla de corte',
             tam='1 control', frec='Inicio de turno', reg='Registro de set up', resp=OP, reac=REAC),
        fila(f31, n='6', proc='Alineación de las capas en la mesa', esp='Vinilo recto y sobre las líneas rojas de la mesa', inst='Visual', **HO_UNO),
        fila(f31, n='7', proc='Ancho de cuchilla', esp='4 mm mínimo, medido desde la punta hasta 10 cm hacia el centro', inst='Calibre MC167',
             tam='1 control', frec='Antes de cada corte', reg='Registro de set up', resp=OP, reac=REAC),
        fila(f31, n='8', proc='Margen entre el cabezal y el borde del vinilo', esp='Máximo 2,5 cm por lado', inst='Visual y láser de la máquina', **CADA_CORTE),
        fila(f31, n='9', proc='Posición del cabezal y del plato al iniciar el corte', esp='Plato elevado antes de iniciar el corte', inst='Visual', **CADA_CORTE),
    ]

    # --- 32 control con Mylar (hoja 38): el cronograma tiene la plantilla MC517 solo del High
    f32 = f'{FLUJO} op 32 + {HO} hoja 38 + {AMFE} op 32 + cronograma de calibracion 2026 Rev.7 (MC517)'
    b32 = dict(op='Operación 32.', nom='Control con Mylar', maq='Plantilla Mylar')
    mylar = dict(tam='1 pieza', frec=CUATRO, reg='Registro de set up', resp='Operador de producción / Operador de calidad.', reac=REAC)
    R += [
        fila(f32, **b32, n='1', proc='Plantilla Mylar correcta', esp='La de la referencia y el material de la planilla de corte',
             inst='Visual contra planilla de corte', **mylar),
        fila(f32, n='2', prod='Contorno de la pieza cortada', esp='Dentro del área OK de la plantilla, ± 1 mm (ni más grande ni más chica)',
             inst='Plantilla Mylar MC517 (High) / plantilla del Low (código MC TBD)', **mylar),
        # AMFE 149 op 32: "Comparación con plantilla Mylar 100%"
        fila(f32, _une=True, **AUTO),
    ]

    # --- 40 costura union (valores confirmados 14/10; aguja union N° 18)
    f40 = f'{FLUJO} op 40 + {COSTURA} + {HO} hoja 40 + {AMFE} op 40 + {PRELIM}'
    b40 = dict(op='Operación 40.', nom='Costura unión', maq='Máquina de coser recta (N° TBD)')
    R.append(fila(f40, **b40, n='1', proc='Set up: aguja e hilo en aguja y bobina',
                  esp='Aguja N° 18 · hilo Nm 30/3 PET Jet Black FX284-E0PTO en aguja y bobina', inst='Visual', **SETUP))
    for n, (prod, esp, inst) in enumerate([
        ('Densidad de puntada', '4 puntadas en 16 mm ± 1 mm', 'Regla (código MC TBD)'),
        ('Toma (margen) de costura', '6 mm (tolerancia TBD)', 'Regla (código MC TBD)'),
        ('Atraque', '3 a 4 puntadas al inicio y al final, una vez atrás y una adelante', 'Visual'),
        ('Costura completa', 'Sin puntadas flojas, saltadas ni faltantes', 'Visual / muestra límite (TBD: la define Calidad)'),
        ('Vivo (piping) alineado y continuo (solo L2 / L3)', 'Sin vivo torcido ni cortado', 'Visual / muestra límite (TBD: la define Calidad)'),
        ('Unión directa de los paños (solo L1)', 'Paños unidos sin desfasaje', 'Visual / muestra límite (TBD: la define Calidad)'),
    ], start=2):
        R += doble(f40, {}, str(n), prod=prod, esp=esp, inst=inst)
    R.append(fila(f40, n='8', prod='Vinilo sin roturas en la zona de costura', esp='Sin roturas ni perforaciones', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO))

    # --- 41 segunda costura de union, solo L2 y L3
    f41 = f'{FLUJO} op 41 + {COSTURA} + {HO} hoja 41 + {AMFE} op 41 + {PRELIM}'
    b41 = dict(op='Operación 41.', nom='Costura de unión - 2ª parte (solo L2 / L3, con vivo)', maq='Máquina de coser recta (N° TBD)')
    R.append(fila(f41, **b41, n='1', proc='Set up: aguja e hilo en aguja y bobina',
                  esp='Aguja N° 18 · hilo Nm 30/3 PET Jet Black FX284-E0PTO en aguja y bobina', inst='Visual', **SETUP))
    for n, (prod, esp, inst) in enumerate([
        ('Densidad de puntada', '4 puntadas en 16 mm ± 1 mm', 'Regla (código MC TBD)'),
        ('Distancia de la 2ª costura al vivo', '6 mm, la misma que la primera costura (tolerancia TBD)', 'Regla (código MC TBD)'),
        ('Atraque', '3 a 4 puntadas al inicio y al final, una vez atrás y una adelante', 'Visual'),
        ('Vivo (piping) centrado y continuo en las dos costuras', 'Sin vivo descentrado ni cortado', 'Visual / muestra límite (TBD: la define Calidad)'),
        ('Costura completa', 'Sin puntadas flojas, saltadas ni faltantes', 'Visual / muestra límite (TBD: la define Calidad)'),
    ], start=2):
        R += doble(f41, {}, str(n), prod=prod, esp=esp, inst=inst)

    # --- 42 costura vista (aguja vista N° 22; hilo de aguja segun variante)
    f42 = f'{FLUJO} op 42 + {COSTURA} + {HO} hoja 42 + {AMFE} op 42 + {PRELIM}'
    b42 = dict(op='Operación 42.', nom='Costura vista', maq='Máquina de coser (N° TBD)')
    R.append(fila(f42, **b42, n='1', proc='Set up: aguja e hilos',
                  esp='Aguja N° 22 · hilo de aguja Nm 20/3: L1 Alpe Gray FX483TK-11930E / L2 y L3 Gray Violet FX483TK-11703E · '
                      'bobina Nm 30/3 Jet Black FX284-E0PTO', inst='Visual', **SETUP))
    for n, (prod, esp, inst) in enumerate([
        ('Densidad de puntada', '4 puntadas en 16 mm ± 1 mm', 'Regla (código MC TBD)'),
        ('Separación de la costura al borde', '4 mm ± 0,5 mm', 'Regla (código MC TBD)'),
        ('Color del hilo según versión', 'L1 Alpe Gray / L2 y L3 Gray Violet', 'Visual contra el patrón de color del hilo'),
        ('Atraque', '3 a 4 puntadas al inicio y al final, una vez atrás y una adelante', 'Visual'),
        ('Costura completa', 'Sin puntadas flojas, saltadas ni faltantes', 'Visual / muestra límite (TBD: la define Calidad)'),
    ], start=2):
        R += doble(f42, {}, str(n), prod=prod, esp=esp, inst=inst)

    # --- 50 troquelado de espumas (hoja 50 sin ciclo de control): controles del AMFE, frecuencia sin papel
    f50 = f'{FLUJO} op 50 + {HO} hoja 50 + {AMFE} op 50'
    b50 = dict(op='Operación 50.', nom='Troquelado de espumas', maq='Troqueladora · troquel N° TBD')
    R += [
        fila(f50, **b50, n='1', proc='Espuma correcta cargada (código y espesor)', esp='La de la orden de producción', inst='Visual contra etiqueta del rollo', **SINPAPEL),
        fila(f50, n='2', prod='Espesor de la espuma troquelada', esp=ESPUMA['espesor'], inst='Calibre (código MC TBD)', **SINPAPEL),
        fila(f50, n='3', prod='Forma y dimensión de la espuma troquelada', esp='Contorno completo, sin cortes incompletos', inst='Visual / muestra límite (TBD: la define Calidad)', **SINPAPEL),
    ]

    # --- 60 ensamble sustrato + espuma (hoja 60 por completar): AMFE 149 op 60
    f60 = f'{FLUJO} op 60 + {AMFE} op 60'
    b60 = dict(op='Operación 60.', nom='Ensamble sustrato + espuma', maq='Dispositivo de ensamble (N° TBD)')
    R += [
        fila(f60, **b60, n='1', proc='Dispositivo de ensamble: topes y centrado', esp='Topes en su lugar, sin desgaste', inst='Visual',
             tam='1 control', frec='Inicio de turno', reg='Registro de set up', resp=OP, reac=REAC),
        fila(f60, n='2', prod='Cinta adhesiva Tesa 52110 presente y adherida', esp='Cinta completa, sin zonas sin pegar', inst='Visual / muestra límite (TBD: la define Calidad)', **SINPAPEL),
        fila(f60, n='3', prod='Posición de la espuma sobre el sustrato', esp='Alineada con el sustrato, contra los topes del dispositivo', inst='Visual', **SINPAPEL),
    ]

    # --- 70 adhesivado (hoja 70 por completar): AMFE 149 op 70 (AP H en proporcion de mezcla y cantidad de adhesivo) y
    # plan preliminar de Calidad (adhesivo en buen estado, adhesivado completo, 100 % por lote)
    f70 = f'{FLUJO} op 70 + {AMFE} op 70 + {PRELIM} (op 30 adhesivado) + {ADHESIVO["fuente"]}'
    b70 = dict(op='Operación 70.', nom='Adhesivado', maq='Pistola de adhesivado (N° TBD)')
    R += [
        fila(f70, **b70, n='1', proc='Vencimiento del adhesivo FA y del reticulante GV', esp='Dentro de la fecha de vencimiento de la etiqueta; se usa primero el lote más viejo (FIFO)',
             inst='Visual de la etiqueta', **SETUP),
        fila(f70, n='2', proc='Proporción de mezcla adhesivo FA + reticulante GV', esp=ADHESIVO['mezcla'], inst='Balanza (código MC TBD)', **MEZCLA),
        fila(f70, n='3', proc='Tiempo de agitación de la mezcla', esp=ADHESIVO['agitacion'], inst='Reloj / cronómetro (código MC TBD)', **MEZCLA),
        fila(f70, n='4', proc='Vida útil de la mezcla preparada', esp=ADHESIVO['vida_mezcla'], inst='Hora de preparación anotada en el recipiente', **MEZCLA),
        fila(f70, n='5', prod='Superficie adhesivada completa', esp='Superficie cubierta completa, sin zonas sin adhesivo', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f70, n='6', prod='Cantidad de adhesivo', esp='Sin exceso ni falta de adhesivo', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
    ]

    # --- 80 control de adhesivado (hoja 80: con la mano, grumos y uniformidad; patrones en el puesto)
    f80 = f'{FLUJO} op 80 + {HO} hoja 80 + {AMFE} op 80'
    b80 = dict(op='Operación 80.', nom='Control de calidad adhesivado', maq='Piezas NOK de referencia en el puesto (a confirmar por Calidad)')
    ctl80 = dict(tam='TBD', frec='TBD', reg='Registro de control', resp=OC, reac=REAC)
    R += [
        fila(f80, **b80, n='1', prod='Adhesivo uniforme en la zona vista, sin grumos', esp='Sin grumos ni zonas desparejas', inst='Visual y táctil / muestra límite (TBD: la define Calidad)', **ctl80),
        fila(f80, n='2', prod='Adhesivo en el vinilo', esp='Sin falta ni exceso de adhesivo', inst='Visual contra las piezas NOK del puesto (falta y exceso de adhesivo)', **ctl80),
        fila(f80, n='3', prod='Adhesivo en el sustrato', esp='Sin falta de adhesivo', inst='Visual contra las piezas NOK del puesto (falta de adhesivo en el sustrato)', **ctl80),
    ]

    # --- 81 retrabajo de adhesivado (AMFE 149 op 81: reinspeccion obligatoria en op 80)
    f81 = f'{FLUJO} op 81 + {AMFE} op 81'
    b81 = dict(op='Operación 81.', nom='Retrabajo de adhesivado', maq='Pistola de adhesivado / herramientas de retrabajo')
    R += [
        fila(f81, **b81, n='1', proc='Lote y vencimiento del adhesivo de retrabajo', esp='Dentro de la fecha de vencimiento', inst='Visual de la etiqueta', **SINPAPEL),
        fila(f81, n='2', prod='Pieza retrabajada', esp='Vuelve a la operación 80 y se controla completa', inst='Control de la operación 80',
             tam='100%', frec='Cada pieza retrabajada', reg='Registro de control', resp=OC, reac=REAC),
    ]

    # --- 90 alineacion de costura (pre-fixing)
    f90 = f'{FLUJO} op 90 + {HO} hoja 90 + {AMFE} op 90-91 + {PRELIM} (op 40 tapizado)'
    b90 = dict(op='Operación 90.', nom='Alineación de costura (pre-fixing)', maq='Dispositivo de alineación con clamps y alineadores centrales · pistola de calor')
    R += [
        fila(f90, **b90, n='1', proc='Temperatura de la pistola de calor', esp=CALOR_90, inst='TBD', **SETUP),
        fila(f90, n='2', prod='Costura encastrada en la ranura del sustrato', esp='Talón de costura dentro de la canaleta de la pieza plástica', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f90, n='3', proc='Clamps cerrados sobre la costura', esp='Todos los clamps cerrados', inst='Visual', **AUTO),
        fila(f90, n='4', prod='Ancho de la zona pegada debajo de la costura', esp='5 cm (tolerancia TBD)', inst='Regla (código MC TBD)', **dict(AUTO, reg='Registro de control')),
    ]

    # --- 91 tapizado y fijado superior
    f91 = f'{FLUJO} op 91 + {HO} hoja 91 + {AMFE} op 90-91 + {PRELIM} (op 40 tapizado)'
    b91 = dict(op='Operación 91.', nom='Tapizado y fijado superior', maq='Dispositivo de alineación · pistola de calor')
    R += [
        fila(f91, **b91, n='1', proc='Temperatura de la pistola de calor', esp=CALOR_91, inst='TBD', **SETUP),
        fila(f91, proc='Tiempo de aplicación de calor', esp=CALOR_91, inst='TBD', **SETUP),
        fila(f91, n='2', prod='Tapizado sin arrugas', esp='Sin arrugas', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f91, n='3', prod='Sin marcas de tapizado', esp='Sin marcas', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f91, n='4', prod='Posición del vinilo respecto de la pieza plástica', esp='Vinilo centrado, sin corrimiento', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f91, n='5', prod='Adherencia del vinilo a la pieza plástica', esp='Sin despegues', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f91, n='6', prod='Costura alineada en el perfil', esp='100 mm ± 1 mm', inst='Calibre de control (código MC TBD)', **dict(AUTO, reg='Registro de control')),
    ]

    # --- 100 wrapping + edge folding (AMFE 149 op 100: set up de parametros al inicio de turno; bordes 100 % visual)
    f100 = f'{FLUJO} op 100 + {HO} hoja 100 + {AMFE} op 100 + {PRELIM} (op 50 virolado)'
    b100 = dict(op='Operación 100.', nom='Wrapping + edge folding', maq='Máquina de virolado automático (N° TBD)')
    R += [
        fila(f100, **b100, n='1', proc='Temperatura de la máquina', esp=VIROLADO, inst='Visual en el panel de la máquina', **SETUP),
        fila(f100, proc='Presión de la máquina', esp=VIROLADO, inst='Visual en el panel de la máquina', **SETUP),
        fila(f100, n='2', proc='Pieza encastrada completa antes de accionar los pedales', esp='Pieza apoyada en todo el nido', inst='Visual', **AUTO),
        fila(f100, n='3', prod='Virolado de todo el contorno de la pieza', esp='Borde plegado completo, sin arrugas ni despegues', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f100, n='4', prod='Pegado de todos los pliegues', esp='Pliegues pegados', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f100, n='5', prod='Zonas críticas despejadas de material excedente', esp='Sin material excedente en las zonas críticas (TBD: las define Calidad)', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f100, n='6', prod='Vinilo sin zonas quemadas en la cara vista', esp='Sin quemaduras', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f100, n='7', prod='Pieza plástica sin deformaciones por calor', esp='Sin deformaciones', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
    ]

    # --- 110 soldadura por ultrasonido y ensamble (logo airbag: D/TLD S9 O2 en el AMFE 149 op 110)
    f110 = f'{FLUJO} op 110 + {HO} hoja 110 + {AMFE} op 110 + {PRELIM} (op 60 logo) + BOM Barack V3 (componentes) + cronograma 2026 Rev.7 (MC400)'
    b110 = dict(op='Operación 110.', nom='Soldadura con ultrasonido y ensamble', maq='Dispositivo de ultrasonido (N° TBD) · atornilladora Atlas Copco MC400')
    R += [
        fila(f110, **b110, n='1', proc='Parámetros de ultrasonido', esp=ULTRASONIDO, inst='Visual en el panel de la máquina', **SETUP),
        # logo airbag: D/TLD S9 O2 (AMFE 149 op 110, "logo airbag faltante o mal soldado"); el plano del cliente C00751801
        # tiene el logo en la lista de materiales (pag. 3) y sus 2 alojamientos con nervio antierror (pag. 6)
        fila(f110, n='2', prod='Logo airbag presente', clas='D', esp='Logo 2HC.853.438 presente', inst='Visual contra el plano', **AUTO),
        fila(f110, n='3', prod='Posición del logo airbag', clas='D', esp='En sus 2 alojamientos con nervio antierror (plano C00751801, pág. 6)',
             inst='Visual contra el plano', **AUTO),
        fila(f110, n='4', prod='Fijación del logo airbag', clas='D', esp='El logo no se mueve al empujarlo a mano (fuerza de prueba TBD)', inst='Prueba manual de fijación', **AUTO),
        fila(f110, n='5', prod='Resistencia de la soldadura', esp='TBD', inst='Ensayo destructivo', tam='TBD', frec='TBD', reg='Registro de control', resp=OC, reac=REAC),
        fila(f110, n='6', prod='Aspecto de la zona soldada', esp='Sin despegues, cortes ni manchas', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f110, n='7', prod='Carcasa de difusor 2HC.819.728', esp='Montada en su alojamiento, según plano C00751801', inst='Visual contra el plano', **AUTO),
        fila(f110, n='8', prod='Clips 2HC.867.190.A', esp='L1: 12 / L2 y L3: 10', inst='Conteo visual', **AUTO),
        fila(f110, n='9', prod='Tornillos 2HC.075.701.HE', esp='5 tornillos colocados', inst='Conteo visual', **AUTO),
        fila(f110, n='10', proc='Torque de atornillado', esp='TBD', inst='Atornilladora Atlas Copco MC400', **SETUP),
    ]

    # --- 120 terminacion: engrampado de puntas (hoja A3 del 01/10/2026), refilado y sellado de puntas (AMFE 149 op 120)
    f120 = f'{FLUJO} op 120 + hoja A3 de engrampado de la op 120 (01/10/2026) + {AMFE} op 120'
    b120 = dict(op='Operación 120.', nom='Terminación', maq='Engrampadora neumática · herramientas de refilado · dispositivo de calor')
    R += [
        fila(f120, **b120, n='1', proc='Grampa cargada', esp='Grampa Dorking 84/06 de 6 mm', inst='Visual', **SETUP),
        fila(f120, n='2', prod='Grampas en las puntas', esp='High (L2 / L3): punta A (lado del logo airbag) 7 y punta B 4, total 11 · '
             'Low (L1): punta A 6 y punta B 6, total 12 · sin grampas en el resto de la pieza', inst='Conteo visual', **AUTO),
        fila(f120, n='3', prod='Refilado del material sobrante', esp='Sin exceso ni falta de refilado', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
        fila(f120, n='4', prod='Puntas selladas sin quemaduras', esp='Puntas selladas, sin vinilo quemado', inst='Visual / muestra límite (TBD: la define Calidad)', **AUTO),
    ]

    # --- 130 control final (hoja 130 por completar): AMFE 149 op 130 + plan preliminar (op 70 inspeccion final)
    f130 = f'{FLUJO} op 130 + {AMFE} op 130 + {PRELIM} (op 70 inspección final)'
    b130 = dict(op='Operación 130.', nom='Control final de calidad', maq='Mesa de inspección · calibre de control')
    fin = dict(tam='100%', frec='Por lote.', reg='Registro de control', resp=OC, reac=REAC)
    R += [
        fila(f130, **b130, n='1', prod='Dimensional de la pieza tapizada', esp='Según calibre de control', inst='Calibre de control (código MC TBD)',
             tam='5 piezas', frec='Por lote de inyección del sustrato', reg='Según instructivo de medición de calibre', resp='Metrología.', reac=REAC),
        fila(f130, n='2', prod='Vinilo sin despegues', esp='Sin despegues del vinilo', inst='Visual / muestra límite (TBD: la define Calidad)', **fin),
        fila(f130, n='3', prod='Aspecto: sin cortes, manchas, rayas ni arrugas', esp='Sin cortes, manchas, rayas ni arrugas', inst='Visual / muestra límite (TBD: la define Calidad)', **fin),
        # la costura que se ve en la pieza terminada es la vista (la de union queda dentro de la canaleta)
        fila(f130, n='4', prod='Costura vista alineada y paralela al borde', esp='Sin costura vista torcida ni corrida', inst='Visual / muestra límite (TBD: la define Calidad)', **fin),
        fila(f130, n='5', prod='Logo airbag presente', esp='Logo 2HC.853.438 presente', inst='Visual contra el plano', **fin),
        # plan preliminar (inspeccion final: "terminacion con soldadura ultrasonido ok") y AMFE 149 op 120 ("verificar fijacion y soldaduras")
        fila(f130, n='6', prod='Fijación del logo airbag', esp='El logo no se mueve al empujarlo a mano (fuerza de prueba TBD)', inst='Prueba manual de fijación', **fin),
        fila(f130, n='7', prod='Logo airbag sin daños', esp='Sin rayas, golpes ni marcas', inst='Visual / muestra límite (TBD: la define Calidad)', **fin),
        fila(f130, n='8', prod='Carcasa de difusor', esp='Carcasa 2HC.819.728 montada, según plano C00751801', inst='Visual contra el plano', **fin),
        fila(f130, n='9', prod='Clips', esp='L1: 12 / L2 y L3: 10', inst='Conteo visual', **fin),
        fila(f130, n='10', prod='Tornillos', esp='5 por pieza', inst='Conteo visual', **fin),
        fila(f130, n='11', prod='Grampas de las puntas', esp='High (L2 / L3): 11 / Low (L1): 12', inst='Conteo visual', **fin),
        fila(f130, n='12', prod='Identificación de la pieza', esp='Etiqueta ET-SATO-50X20 con el código de la versión', inst='Visual', **fin),
    ]

    # --- 140 retrabajo de producto terminado (vuelve a la 130, flujograma)
    f140 = f'{FLUJO} op 140 + {AMFE} op 140'
    b140 = dict(op='Operación 140.', nom='Retrabajo de producto terminado', maq='Herramientas de retrabajo')
    R += [
        fila(f140, **b140, n='1', prod='Pieza retrabajada', esp='Vuelve a la operación 130 y se controla completa; si no se puede corregir, va a scrap',
             inst='Control de la operación 130', tam='100%', frec='Cada pieza retrabajada', reg='Registro de control', resp=OC, reac=REAC),
    ]

    # --- 150 embalaje: no hay ficha de embalaje de serie vigente (la GE-279 es borrador)
    f150 = f'{FLUJO} op 150 + BOM arb 06/10/2026 (ET-SATO-100X60, EMBEPE2X1X20) + {PRELIM} (op 80 embalaje) + mail de Motherson (D. Díaz a M. Meszaros, 25/02/2026, Minuta Embalaje IP Patagonia, punto 8)'
    b150 = dict(op='Operación 150.', nom='Embalaje de producto terminado', maq='Medio de embalaje (TBD)')
    emb = dict(tam='100%', frec='Por turno.', reg='Autocontrol.', resp='Operador de logística.', reac=REAC)
    R += [
        fila(f150, **b150, n='1', prod='Identificación del medio', esp='Etiqueta ET-SATO-100X60 con el código de la versión', inst='Visual', **emb),
        fila(f150, n='2', prod='Cantidad por medio', esp='TBD', inst='Conteo visual', **emb),
        fila(f150, n='3', prod='Protección de cada pieza', esp='1 bolsa de polietileno o pluribol por pieza', inst='Visual', **emb),
        fila(f150, n='4', prod='Espuma de polietileno de protección', esp='Espuma de polietileno EMBEPE2X1X20 en el medio', inst='Visual', **emb),
    ]

    # --- test de lay out: dimensional y flamabilidad del plan preliminar de Calidad (op 90); el valor de flamabilidad y los
    # ensayos de la pieza vestida salen de la hoja ADV PKK1 "Wrapping trim assembly" del cliente (legajo 13-, p. 15 a 22) y
    # del plano C00751801. Frecuencia anual: control anual de cotas y ensayos del cliente (CSR VW, layout inspection)
    flo = f'{PRELIM} (op 90 test de lay out) + plano del cliente C00751801 + hoja ADV PKK1 Wrapping trim assembly + CSR VW (layout inspection and functional testing)'
    lab = dict(frec='Anual', reg='Informe de laboratorio', resp='Calidad.', reac=REAC)
    R.append(seccion('TEST DE LAY OUT'))
    R += [
        fila(flo, op='---', nom='Test de lay out', maq='Laboratorio / metrología', n='1', prod='Dimensional completo',
             esp='Cotas del plano del cliente C00751801', inst='Calibre de control y medición dimensional',
             tam='30 muestras', frec='Auditoría de producto', reg='Informe de medición', resp='Metrólogo.', reac=REAC),
        fila(flo, n='2', prod='Flamabilidad horizontal de la pieza', esp=FLAMA_PIEZA, inst='Laboratorio',
             tam='5 muestras', **lab),
        fila(flo, n='3', prod='Adhesión del vinilo (pelado a 180°, después de 2 ciclos M de CVTC 54122)', esp='≥ 525 N/m o rotura de la espuma (CVTC 35041)',
             inst='Laboratorio', tam='3 muestras', **lab),
        fila(flo, n='4', prod='Rayado de la pieza vestida', esp='Sin rayas (CVTC 35005)', inst='Laboratorio', tam='3 muestras', **lab),
        fila(flo, n='5', prod='Solidez a la luz', esp='ΔE ≤ 3,0 y escala de grises ≥ 4 (CVTC 52031)', inst='Laboratorio', tam='3 muestras', **lab),
        fila(flo, n='6', prod='Fogging', esp='≤ 2 mg (CVTC 54004)', inst='Laboratorio', tam='3 muestras', **lab),
        fila(flo, n='7', prod='Olor', esp='≤ 3 húmedo y normal, ≤ 3,5 seco (CVTC 54003 tipo C)', inst='Laboratorio', tam='3 muestras', **lab),
    ]
    return R


def encabezado(ws):
    poner(ws, 'D4', '2HC.858.417.B FAM (L1)')
    poner(ws, 'D5', '2HC.858.417.C GKK (L2) / GKN (L3)')
    poner(ws, 'I4', DESCRIPCION)
    # revisiones: se borra la del plan de inyeccion; queda la del plan preliminar de Calidad de esta pieza (Rev 0,
    # M. Nieve, 05/04/2025). Sin revision nueva y sin el nombre de Fak (Fak, 19/10/2026): la revision la abre Calidad
    for r in range(9, 12):
        for c in range(2, 16):
            try:
                ws.Cells(r, c).MergeArea.Cells(1, 1).Value = ''
            except Exception:
                pass
    poner(ws, 'B9', '0')
    poner(ws, 'C9', '05/04/2025')
    poner(ws, 'D9', 'N/A.')
    poner(ws, 'F9', 'EMISION INICIAL.')
    poner(ws, 'O9', 'MN')
    poner(ws, 'B23', 'N° PLAN DE CONTROL:')
    poner(ws, 'L23', '05/04/2025')
    poner(ws, 'N23', '')
    poner(ws, 'D24', '2HC.858.417.B FAM (L1 - Low)')
    poner(ws, 'D25', '2HC.858.417.C GKK (L2) / GKN (L3) (High)')
    poner(ws, 'L25', '')
    poner(ws, 'B27', 'IP PAD PATAGONIA - COSTURA Y TAPIZADO')
    poner(ws, 'H29', CODIGOS)
    celda_superior(ws, 'H29').Font.Size = 9
    nivel_actualizacion(ws, 'A')


def todas_las_filas():
    return filas_recepcion() + filas_proceso()


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
    nombre = sys.argv[3] if len(sys.argv) > 3 else f'PC IP PAD Patagonia costura y tapizado - propuesta de Ingenieria {FECHA.replace("/", "-")}.xlsx'
    destino = os.path.join(salida, nombre)
    shutil.copyfile(origen, destino)
    xl = abrir_excel()
    try:
        wb = xl.Workbooks.Open(destino)
        ws = wb.Worksheets(HOJA_FORM)
        ws.Name = 'PC IP PAD COSTURA Y TAPIZADO'
        encabezado(ws)
        logos = logo_oficial(ws)
        # la hoja de revisiones del formulario (Rev.) trae el mismo logo viejo
        logos += logo_en_celda(wb.Worksheets('Rev.'), 'B2')
        n = escribir(ws, filas, salto_antes_de=('Proceso', 'Operación 41.', 'Operación 70.', 'Operación 110.', 'TEST DE LAY OUT'))
        # los titulos de las columnas (filas 31 y 32 del formulario) se repiten en cada hoja impresa
        ws.PageSetup.PrintTitleRows = '$31:$32'
        wb.BuiltinDocumentProperties('Author').Value = 'Barack Mercosul'
        wb.BuiltinDocumentProperties('Last Author').Value = 'Barack Mercosul'
        wb.BuiltinDocumentProperties('Title').Value = 'Plan de control IP PAD Patagonia costura y tapizado'
        wb.Save()
        wb.ExportAsFixedFormat(0, os.path.splitext(destino)[0] + '.pdf')
        wb.Close(False)
        print(f'{n} filas, {logos} logo(s) cambiados por el oficial')
    finally:
        xl.Quit()
    autor_limpio_xlsx(destino)
    print(destino)


if __name__ == '__main__':
    main()
