"""
_pcApcPatagonia.py — copia corregida del plan de control de los apoyacabezas Patagonia (Rev 0 de
Calidad, N. Perez, 04/06/2026: `PC APOYACABEZAS Patagonia Delantero Rev0.xls`, hojas PC DELANTERO,
PC CENTRAL y PC LATERAL), en el MISMO formulario de Calidad.

Pedido de Fak, 15/10/2026: armar la skill de planes de control y despues "mejorar los de los APC...
aunque no coincida perfectamente con el AMFE o flujograma... con todos los parametros disponibles".
Camino: skill `planes-de-control` §5 (el que Fak aprobo el 06/10 con el PC de Nicolas): copia, cada
fila nueva o cambiada en amarillo con un comentario (fuente + ANTES), lo que no tiene papel va TBD o
CONFLICTO y a la lista aparte. Las filas que quedan como las tenia Calidad van en blanco.

Fuentes (leidas el 15/10/2026; detalle en la lista que acompaña el archivo):
  flujograma 152 Rev.A del 15/10/2026 (tools/flowchart/data/152-APOYACABEZAS.json) - manda la numeracion
  HO-968 / 969 / 970 Rev.A (SGC, 08/10/2026; sus pestañas de corte y costura todavia tienen la numeracion vieja)
  AMFE-HF-PAT / HRC-PAT / HRO-PAT (Supabase live, renumerados el 15/10) - siglas asignadas y controles
  BOM del arb al 29/09/2026 (exports/BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx)
  planes de recepcion 1043, 1062-1064 (hilos), 1063-1065 (estructuras), 818/822 (PU)
  fichas de embalaje GE-103/104/105 Rev.C, cronograma de calibracion 2026 Rev.7,
  Costura Patagonia - valores 14-10-2026.pptx (tabla vigente, hoja 3),
  planilla HTO de la PIP (registro de pruebas: dice QUE variables, nunca el valor)

Uso:  python scripts/apc/_pcApcPatagonia.py <rev0.xls> <carpeta_salida>
No escribe en el servidor ni en Supabase: copia el original y trabaja sobre la copia.
"""
import os
import shutil
import sys

import win32com.client as win32

AMARILLO = 65535
ROJO_FUENTE = 255
FECHA = '15/10/2026'
QUIEN = 'Ingenieria (F.Santoro)'
FLUJO = 'Flujograma 152 Rev.A (15/10/2026)'

# ---------------------------------------------------------------- variantes
V = {
    'DEL': dict(
        hoja='PC DELANTERO', ho='HO-968', amfe='AMFE 151 (AMFE-HF-PAT)',
        codigos='2HC.881.901 RL1 / 2HC.881.901.A GFV / 2HC.881.901.B GEV / 2HC.881.901.C EFG',
        asta=('2HC.881.937', 'ASTA DELANTERO', 'HEADREST POLE C00686689 (MAXUS) 2HC 881937'),
        epp=('2HC.881.915', 'EPP APOYACABEZA DELANTERO', 'SOPORTE APOYACABEZAS C00686690 (MAXUS) 2HC 881915'),
        rec_estr='1064', rec_estr_nota='el plan 1064 dice N° de parte 2HC.885.915 ("soporte apoyacabezas delantero"), que no está en la BOM',
        asta_car='Material / aspecto\nDiámetro\nCota\nDiámetro',
        asta_esp='Cromado, libre de rayas, manchas y falta de material\n90 mm\n130 mm\n14 mm +0,05 / -0,1 mm',
        bolsa=('427VAR002TAP01', 'Bolsa PP 600 x 500 mm'),
        ge='GE-103 Rev. C', cant='24 piezas por contenedor (12 por piso)', calibre='MC506',
        hojas_union='30, 32, 33 y 34 (paneles 101+102+103, 105+106, (105+106)+104 y cerrado completo)',
        pv2005_antes="Rev 0: 'sin grietas tras el almacenamiento de 8 ciclos (TRASERO CENTRAL) y de 5 ciclos (TRASERO LATERAL)' en la hoja del DELANTERO",
        shot='450 g en las pruebas',
    ),
    'TC': dict(
        hoja='PC CENTRAL ', ho='HO-969', amfe='AMFE 153 (AMFE-HRC-PAT)',
        codigos='2HC.885.900 RL1 / 2HC.885.900.A EIF / 2HC.885.900.B SIY / 2HC.885.900.C SIY',
        asta=('2HC.885.942', 'ASTA APOYACABEZA TRASERO CENTRAL', 'HEADREST FRAME C00683052 (MAXUS) 2HC 885942'),
        epp=None,
        rec_estr='1063', rec_estr_nota='el plan 1063 dice N° de parte 2HC.885.941 en el encabezado y código 2HC.885.942 en el cuerpo',
        asta_car='Material / aspecto\nDiámetro\nCota\nDiámetro\nCota 4.1\nCota',
        asta_esp='Cromado, libre de rayas, manchas y falta de material\nØ 7 mm ± 0,1 mm\n167 mm\nØ 12,7 mm +0,02 / -0,1 mm\n80 mm ± 1 mm\n6,8 mm ± 1 mm',
        bolsa=('BA 35 50', 'Bolsa 35 x 50 cristal virgen'),
        ge='GE-105 Rev. C', cant='40 piezas por contenedor (20 por piso)', calibre='MC507',
        hojas_union='30, 32 y 33 (paneles 101+102+103, conjunto trasero 105+106+104 y cerrado completo)',
        pv2005_antes=None, shot='180 a 200 g en las pruebas',
    ),
    'TL': dict(
        hoja='PC LATERAL )', ho='HO-970', amfe='AMFE 155 (AMFE-HRO-PAT)',
        codigos='2HC.885.901 RL1 / 2HC.885.901.A GFU / 2HC.885.901.B GEQ / 2HC.885.901.C DZS',
        asta=('2HC.885.941', 'ASTA APOYACABEZA TRASERO LATERAL', 'HEADREST FRAME C00683050 (MAXUS) 2HC 885941'),
        epp=None,
        rec_estr='1065', rec_estr_nota='el plan 1065 dice N° de parte 2HC.885.941 (coincide con el arb)',
        asta_car='Material / aspecto\nCota 1\nCota 2\nCota 3\nCota 4',
        asta_esp='Cromado, libre de rayas, manchas y falta de material\n102,6 mm\n7 ± 0,1 mm\n130 ± 1 mm\n12,75 +0,02 / -0,1 mm',
        bolsa=('BA 35 50', 'Bolsa 35 x 50 cristal virgen'),
        ge='GE-104 Rev. C', cant='36 piezas por contenedor (18 por piso)', calibre='MC508',
        hojas_union='30, 32 y 33 (paneles 107+108+109, conjunto trasero 111+112+110 y cerrado completo)',
        pv2005_antes=None, shot='270 g en las pruebas',
    ),
}

COLS = 'ABCDEFGHIJKLMN'
CAMPOS = ['op', 'nom', 'maq', 'n', 'prod', 'proc', 'clas', 'esp', 'inst', 'tam', 'frec', 'reg', 'resp', 'reac']

REC = dict(tam='1 Muestra', frec='Por entrega', reg='P-10/I. / ARB', resp='Auditor de recepción', reac='P-14.')
SETUP = dict(tam='1 control', frec='Inicio de turno / Falla mantenimiento / Corte de energía / Problema de calidad',
             reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.')
AUTO = dict(tam='100%', frec='Por lote', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.')
PIEZA_TURNO = dict(tam='1 Pieza', frec='Inicio y fin de turno', reg='Registro de control', resp='Operador de producción', reac='Según P-09/I.')

COSTURA_SRC = 'Costura Patagonia - valores 14-10-2026.pptx (tabla vigente, hoja 3: aguja y atraque)'


def fila(estado='nueva', fuente='', antes='', **k):
    """estado: 'igual' (identica a la Rev 0, sin color) o 'nueva' / 'cambia' (fila entera en amarillo)."""
    d = {c: '' for c in CAMPOS}
    d.update(k)
    d['_estado'] = estado
    d['_fuente'] = fuente
    d['_antes'] = antes
    return d


def seccion(texto):
    return {'_seccion': texto}


def una_por_fila(filas):
    """Parte las filas con varias caracteristicas (renglones en PRODUCTO o PROCESO) en una fila por
    caracteristica, como los planes de Calidad (PWA 2025): asi cada fila lleva una sola sigla."""
    out = []
    for f in filas:
        if '_seccion' in f:
            out.append(f)
            continue
        campo = 'proc' if '\n' in f['proc'] else ('prod' if '\n' in f['prod'] else None)
        esp = f['esp'].split('\n')
        if campo is None or len(esp) != len(f[campo].split('\n')):
            out.append(f)
            continue
        car = f[campo].split('\n')
        n = len(car)
        inst = f['inst'].split('\n')
        if len(inst) != n:
            inst = inst[:1] + [inst[-1]] * (n - 1) if len(inst) == 2 else [inst[0]] * n
        clas = f['clas'].split('\n') if f['clas'] else [''] * n
        if len(clas) != n:
            clas = [f['clas']] * n
        for i in range(n):
            g = dict(f)
            if i > 0:
                for k in ('op', 'nom', 'maq', 'n'):
                    g[k] = ''
                if campo == 'proc':
                    g['prod'] = ''
            g[campo], g['esp'], g['inst'], g['clas'] = car[i], esp[i], inst[i], clas[i]
            out.append(g)
    return out


def filas_variante(key):
    v = V[key]
    ho = v['ho']
    R = [seccion('Recepción')]
    op10 = dict(op='Operación 10.', nom='Recepción e inspección de materia prima')

    # --- recepcion: vinilos y tela (siglas de causas de op 10 que cumplen el criterio de I-AC-005)
    esp_vin = ('Según patrón de color\nEspesor: CONFLICTO — arb: "PU 4,5 mm + PVC 1 mm" / lista VW: "PVC 1,1 ±10 % + PUR 1,0 +0,5" / '
               'Rev 0: "2,1 +/-" sin tolerancia\n< 100 mm/min')
    fuente_vin = ('BOM arb 29/09/2026 + LISTADO PC PATAGONIA.xlsx (hoja separado APC). No hay plan de recepción de vinilo Patagonia: '
                  'la carpeta VINILO\\Patagonia está vacía. Siglas del AMFE op 10: SC por "material con especificación errónea" '
                  '(S7 O4 y O5) y "variación de color entre lotes" (S6 O4); D/TLD por flamabilidad TL 1010 (S9 O2)')
    antes_vin = 'Rev 0: espesor "2,1 +/-", gramaje "mín. 800 - máx. 1000 GMS/MT2", instrumento sin código en las filas 2 y 3, sin siglas'
    titan_niv = 'L0 y L1-L3 (laterales)' if key == 'DEL' else 'L0'
    vinilos = [('1246030198', 'Vinilo PU 4,5 mm + PVC 1 mm TITAN BLACK (Sansuy BAH RL1)', titan_niv),
               ('1246030199', 'Vinilo PU 4,5 mm + PVC 1 mm ANDINO GRAY (Sansuy ST Haptik)', 'L2'),
               ('1246030200', 'Vinilo PU 4,5 mm + PVC 1 mm DARK SLATE (York ML14)', 'L3')]
    n = 0
    for i, (cod, desc, lv) in enumerate(vinilos):
        n += 1
        R.append(fila('cambia', fuente_vin, antes_vin, **(op10 if i == 0 else {}), n=f'{n}.0',
                      prod=f'{desc} — código {cod} — {lv}', proc='Grabado y color\nEspesor\nFlamabilidad',
                      clas='SC\nSC\nD/TLD', esp=esp_vin,
                      inst='Visual con patrón\nCalibre MC212 (ver lista: sector y checklist)\nCámara de flamabilidad MC184 (ver lista: calibración)', **REC))
    n += 1
    R.append(fila('cambia', 'BOM arb 2951P098297 + LISTADO PC PATAGONIA (Fabric + Ether-PUR 1,5 +0,5 + base 50 g/m² ±10 %). '
                  'Sin plan de recepción encontrado. Siglas del AMFE op 10 (mismas causas que los vinilos)',
                  'Rev 0: espesor "2,1 +/-" y gramaje "800-1000 GMS/MT2" (los mismos valores que los vinilos)',
                  n=f'{n}.0', prod='Tela TEAR RENNES MELANGE BLACK 4,5 mm (Aunde TPB-8VA) — código 2951P098297 — L1',
                  proc='Grabado y color\nEspesor\nGramaje\nFlamabilidad', clas='SC\nSC\n\nD/TLD',
                  esp='Según patrón de color\nTBD (sin plan de recepción)\nTBD\n< 100 mm/min',
                  inst='Visual con patrón\nCalibre (TBD)\nBalanza (TBD)\nCámara de flamabilidad MC184', **REC))
    n += 1
    R.append(fila('nueva', 'AMFE op 10: emisiones VOC VW 50180 y sustancias prohibidas, D/TLD (S9 O3); el control que declara el AMFE '
                  'es documental. Frecuencia TBD: ningún plan de recepción la fija',
                  n=f'{n}.0', prod='Vinilos y tela (todos)', proc='Emisiones VOC (VW 50180)\nSustancias prohibidas (ELV / anexo II)',
                  clas='D/TLD\nD/TLD', esp='Según VW 50180\nSegún anexo II / ELV', inst='Certificado del proveedor',
                  tam='1 certificado', frec='TBD', reg='P-10/I. / ARB', resp='Auditor de recepción', reac='P-14.'))
    # --- hilos: sin sigla en recepcion (las SC del AMFE son de la seleccion del hilo en costura, op 30/31)
    n += 1
    R.append(fila('cambia', 'Plan de recepción N° 1043 (Linhanyl FX284-E0PTO, C. Rodríguez rev B 03/09/2025) + BOM arb. '
                  f'CONFLICTO de código: la {ho} (pestañas de costura de unión) y la Rev 0 dicen FX284TK-E0PTO; el arb y el plan 1043 dicen FX284-E0PTO',
                  "Rev 0: 'Hilo Union JET BLACK Pantone 19-0303 TPG / FX284TK-E0PTO 30/3Nm'",
                  n=f'{n}.0', prod='Hilo unión Nm 30/3 PET negro — código FX284-E0PTO (Linhanyl)',
                  proc='Número métrico\nMaterial\nCabos\nColor\nSolidez a la luz\nFlamabilidad',
                  esp='30/3\n100 % poliéster (VW 50106)\n3 cabos\nE0PTO negro según patrón\n≥ 4 (certificado, anual)\n100 mm/min (certificado, anual)',
                  inst='Visual en etiqueta\nCertificado del proveedor\nVisual\nVisual con patrón\nCertificado\nCertificado',
                  tam='1 Muestra por lote', frec='Por entrega (solidez y flamabilidad: anual)', reg='P-10/I. / ARB',
                  resp='Auditor de recepción', reac='P-14.'))
    hilos_vista = [('FX483TK-11930E', 'ALPE GRAY TGA IP3', 'L1', '1063'),
                   ('FX483TK-11703E', 'GRAY VIOLET TGA AT2 (Pantone 14-4103)', 'L2 y L3', '1064'),
                   ('FX483TK-E0PTO', 'JET BLACK', 'L0 (CONFLICTO: la HO dice que el L0 no lleva costura vista; el arb le carga este hilo)', '1062')]
    for cod, col, lv, plan in hilos_vista:
        n += 1
        R.append(fila('cambia' if cod == 'FX483TK-11703E' else 'nueva',
                      f'Plan de recepción N° {plan} (HILOS\\LINHANYL, mismo formato que el 1043) + BOM arb',
                      "Rev 0: 'Hilo Vista TGA AT2 Pantone 14-4103 / FX483TK-11703E' (la fila del ALPE GRAY FX483TK-11930E tambien estaba)" if cod != 'FX483TK-E0PTO' else '',
                      n=f'{n}.0', prod=f'Hilo vista Nm 20/3 PET {col} — código {cod} — {lv}',
                      proc='Número métrico\nCabos\nColor', esp=f'20/3\n3 cabos\n{col} según patrón — ver plan de recepción N° {plan}',
                      inst='Visual en etiqueta / con patrón', tam='1 Muestra por lote', frec='Por entrega', reg='P-10/I. / ARB',
                      resp='Auditor de recepción', reac='P-14.'))
    # --- componentes PU: sin sigla en recepcion (la causa D/TLD esta en la op 52 del AMFE: ver lista)
    for cod, nombre, plan_viejo in [('POLI-PLUS FF636', 'Poliol (componente A)', 'POLI-PLUS FF 629'),
                                    ('ISO-PLUS 1355', 'Isocianato (componente B)', 'ISO-PLUS 1290')]:
        n += 1
        R.append(fila('cambia',
                      f'BOM arb 29/09/2026 ({cod}); la planilla de pruebas de la PIP usa F636/FF636 desde el 18/05/2026. '
                      'Hay planes de recepción para FF-620/FF-629 (821/822) e ISO-1290/1394 (818/819), NO para FF636 ni ISO 1355',
                      f"Rev 0: '{plan_viejo}' - 'Según certificado del proveedor' - 'Visual'",
                      n=f'{n}.0', prod=f'{nombre} — {cod} (Mas-Tin)',
                      proc='Vencimiento\nPropiedades del lote (viscosidad, densidad, tiempos de reacción / NCO)',
                      esp='Vigente al uso (FIFO)\nTBD: falta el plan de recepción de este componente',
                      inst='Visual en etiqueta\nCertificado del fabricante', **REC))
    if v['epp']:
        cod, desc, antes = v['epp']
        n += 1
        R.append(fila('cambia', f'BOM arb ({cod}, VW consignado). {v["rec_estr_nota"]}: confirmar a qué pieza corresponde',
                      f"Rev 0: '{antes}' sin característica ni especificación",
                      n=f'{n}.0', prod=f'{desc} — {cod} (VW consignado)', proc='Material\nDimensional',
                      esp='TBD: no hay plan de recepción identificado para el EPP', inst='TBD', **REC))
    cod, desc, antes = v['asta']
    n += 1
    R.append(fila('cambia', f'Plan de recepción N° {v["rec_estr"]} (C. Rodríguez / A. Aguayo / M. Ruiz, 30/04/2026) + BOM arb ({cod}). '
                  f'OJO: {v["rec_estr_nota"]}',
                  f"Rev 0: '{antes}' - 'Cromado libre de rayas y falta material' - 'Visual / Calibre MC 212' - '1 Pieza'",
                  n=f'{n}.0', prod=f'{desc} — {cod} (VW consignado)', proc=v['asta_car'],
                  esp=v['asta_esp'],
                  inst='Patrón de aspecto\nCalibre digital', tam='3 % del lote', frec='Por entrega', reg='P-10.1',
                  resp='Auditor de recepción', reac='P-14.'))
    for cod, desc in [('427VAR001INY01', 'Embudo PIP PP entrada 34 x 38 mm salida D8'),
                      ('427VAR002INY01', 'Bolsa de inyección PUR (inlet bag) nylon PA'),
                      ('PRECFIN75MM-PIP', 'Precinto pin fino 75 mm para funda PIP'),
                      v['bolsa'],
                      ('ET-SATO-100X60 / ET-SATO-50X20', 'Etiquetas SATO 100 x 60 (medio) y 50 x 20 (pieza)')]:
        n += 1
        R.append(fila('nueva', 'BOM arb 29/09/2026: material comprado que la Rev 0 no tenía en recepción. Sin plan de recepción encontrado',
                      n=f'{n}.0', prod=f'{desc} — código {cod}', proc='Identificación y estado del material',
                      esp='TBD (sin plan de recepción)', inst='Visual', **REC))

    # --- corte: 20 / 21 / 22 del flujograma Rev.A; la HO todavia tiene las pestañas 20 a 28
    R.append(seccion('Proceso'))
    mesa = 'Máquina de corte N° BM 068 / BM 069'
    f1 = "1 (la HO dice 'Frec. 1')"
    corte = [
        ('20', 'Preparación y carga de vinilo', '20 a 24', [
            dict(proc='Código de material del rollo', esp='Según planilla de mesa de corte', inst='Visual — planilla de corte (HO pestaña 20)',
                 tam='1 control', frec=f1, reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Posición del lado vista del vinilo', esp='Según planilla de mesa de corte', inst='Visual — planilla de corte (HO pestaña 20)',
                 tam='1 control', frec=f1, reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Alineación del vinilo detrás de los rodillos (los parámetros de velocidad no los cambia el operador)', esp='Alineado',
                 inst='Visual (HO pestaña 22)', tam='1 control', frec=f1, reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Velocidad y tensión del vinilo', esp='Según instructivo de parámetros por producto (valores TBD: el instructivo no está en el legajo)',
                 inst='Instructivo de parámetros — visual (HO pestaña 23)', **SETUP),
            dict(proc='Cantidad de capas', esp='Según planilla de mesa de corte', inst='Panel de la máquina — visual (HO pestaña 23)', **SETUP),
            dict(prod='Largo de la capa (tizada + demasía)', esp='Según planilla de mesa de corte', inst='Regla (código TBD) (HO pestaña 23)',
                 tam='1 control', frec='Primera capa de cada tizada', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Alineación del vinilo hasta las líneas rojas de la mesa', esp='Recto y coincidente con las marcas rojas', inst='Visual (HO pestaña 24)',
                 tam='1 control', frec=f1, reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.')]),
        ('21', 'Corte automático de componentes', '25 a 27', [
            dict(proc='Ancho de cuchilla', esp='4 mm mínimo', inst='Calibre MC167 (HO pestaña 25)', tam='1 control', frec='Antes de cada corte',
                 reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Alineación del cabezal y margen', esp='Margen máximo 2,5 cm por lado', inst='Visual + láser de la máquina (HO pestaña 26)',
                 tam='1 control', frec='Antes de cada corte', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Posición del cabezal y elevación del plato', esp='Según HO pestaña 27', inst='Visual', tam='1 control',
                 frec='Antes de cada corte', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'),
            dict(proc='Verificación automática de medidas del vinilo (sensores de la máquina)', esp='La máquina no arranca si el vinilo no cumple las medidas',
                 inst='Verificación del sensor con falla simulada (I-AC-032)', tam='TBD', frec='TBD', reg='TBD',
                 resp='TBD (el I-AC-032 asigna al líder de producción las verificaciones de inicio de turno)', reac='Según P-09/I.')]),
        ('22', 'Control con Mylar', '28', [
            dict(proc='Identificación de la plantilla Mylar según referencia y material', esp='Según planilla de corte',
                 inst='Visual — planilla de corte', tam='1 control', frec='Inicio de turno / Falla mantenimiento / Corte de energía / Problema de calidad',
                 reg='Registro de set up', resp='Operador de producción / Calidad', reac='Según P-09/I.'),
            dict(prod='Contorno de la pieza cortada', esp='Dentro del área OK de la plantilla: ± 1 mm (ni más grande ni más chica)',
                 inst='Plantilla Mylar (código MC TBD)', tam='1 Pieza', frec='Inicio de turno / Falla mantenimiento / Corte de energía / Problema de calidad',
                 reg='Registro de set up', resp='Operador de producción / Calidad', reac='Según P-09/I.')]),
    ]
    antes_corte = ("Rev 0: una sola 'Operación 20' con set up 'Ver hoja de set up', cuchilla 'debe medir 4mm' con calibre MC 212 al inicio de turno, "
                   "capas y 'dimensional de corte según mayler'")
    for i, (op, nom, pest, items) in enumerate(corte):
        for j, it in enumerate(items):
            R.append(fila('nueva', f'{FLUJO} op {op} + {ho} pestañas {pest} (numeración vieja de la HO, ciclo de control)',
                          antes_corte if (i == 0 and j == 0) else '',
                          **({'op': f'Operación {op}.', 'nom': nom, 'maq': mesa} if j == 0 else {}), n=f'{j + 1}.0', **it))
    # refilado: tal cual la Rev 0 (no esta en flujograma, AMFE ni HO -> lista)
    ref = dict(op='Operación 30 y 30,2', nom='Operación de Refilado de Cortes de APC Vinilos Laterales', maq='Maquina refiladora N°  BM 001 BM 003')
    nota_ref = 'Filas como las tenía Calidad en la Rev 0. OJO: esta operación no está en el flujograma 152, ni en el AMFE, ni en las HO, y su número choca con la costura de unión (ver lista)'
    R.append(fila('igual', nota_ref, '', **ref, n='1.0', prod='Forma', esp='Refilado de 10+/-2mm', inst='Regla Metalica N° MC 310',
                  tam='1 Pieza.', frec='Inicio y fin de turno.', reg='set up', resp='Operador de producción.', reac='Según P-09/I.'))
    R.append(fila('igual', '', '', tam='1.0', frec='Por lote.', reg='Autocontrol.', resp='Operador de producción.', reac='Según P-09/I.'))
    R.append(fila('igual', '', '', n='2.0', prod='Aspecto', esp='Refilado Ok según Patron sin dañar vinilo',
                  tam='1 Pieza.', frec='Inicio y fin de turno.', reg='set up', resp='Operador de producción.', reac='Según P-09/I.'))
    R.append(fila('igual', '', '', tam='1.0', frec='Por lote.', reg='Autocontrol.', resp='Operador de producción.', reac='Según P-09/I.'))

    # --- costura union: una sola operacion 30 (todas las costuras de union de la pieza)
    union_src = (f'{FLUJO} op 30 + {ho} pestañas de unión {v["hojas_union"]} + {COSTURA_SRC}. '
                 'Siglas del AMFE op 30: SC "selección incorrecta del hilo" (S8 O4), "largo de puntada fuera de especificación" (S6 O4), '
                 '"toma de costura fuera de especificación" (S6 O4)')
    base = {'op': 'Operación 30.', 'nom': 'Costura unión (todas las uniones de la pieza: ' + v['hojas_union'] + ')',
            'maq': 'Máquina de coser recta (código TBD)'}
    R.append(fila('cambia', union_src, "Rev 0 ('Operación 30 Costura Union'): set up 'Sin pérdida de aceite / medios identificados / hilo correcto / linterna funcionamiento de crochet ok', aguja 'TBD', margen 'TBD'",
                  **base, n='1.0', proc='Set up: aguja, hilo, tensión, máquina sin pérdida de aceite, medios identificados, linterna y crochet OK',
                  esp='Aguja N° 18 · hilo Nm 30/3 PET negro en aguja y bobina', inst='Visual — hoja de set up',
                  tam='1 control', frec='Inicio de turno / Después de cada intervención mecánica o parada de más de 1 h',
                  reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.'))
    for k, (prod, esp, inst, clas) in enumerate([
        ('Toma (margen) de costura', 'L1 tela 8 ± 2 mm · L0-L2-L3 PVC 8 ± 1 mm · cortes X1 3 ± 1 mm', 'Regla metálica (código MC TBD)', 'SC'),
        ('Densidad de puntada', '4 puntadas en 16 mm (± 1)', 'Regla metálica (código MC TBD)', 'SC'),
        ('Hilo aguja y bobina', 'Nm 30/3 PET negro — código: CONFLICTO FX284TK-E0PTO (HO) / FX284-E0PTO (arb y plan 1043)', 'Visual en la bobina', 'SC'),
        ('Atraque', '3 a 4 puntadas al inicio y al final', 'Visual', ''),
        ('Costura completa: sin falta de costura, sin costura floja ni salteada, sin arrugas ni pliegues', 'Según muestra patrón / biblia de defectos',
         'Visual / muestra patrón', ''),
    ]):
        R.append(fila('cambia', union_src, "Rev 0: 'Margen costura TBD', 'Largo puntada 4mm / 4 puntadas cada 16mm' sin tolerancia, 'Hilo' vacío, "
                      "y cuatro filas de criterios ('Sin falta de costura', 'Sin costura floja', 'Sin costura salteada', 'Sin arrugas')" if k == 0 else '',
                      n=f'{k + 2}.0', prod=prod, clas=clas, esp=esp, inst=inst, **PIEZA_TURNO))
        R.append(fila('cambia', union_src, '', **AUTO))

    # --- costura vista: 31 (antes la Rev 0 la tenia como 40)
    vista_src = (f'{FLUJO} op 31 + {ho} pestaña 31 + {COSTURA_SRC}. Siglas del AMFE op 31 (live 15/10/2026): SC "selección incorrecta del hilo" (S6 O4), '
                 '"largo de puntada fuera de especificación" (S6 O5) y "ancho de cubierta fuera de 4 mm ±1" (S6 O4)')
    vista = [
        ('Set up: aguja, hilo, tensión', 'Aguja N° 22 · hilo aguja Nm 20/3 PET (color según versión) · bobina Nm 30/3 PET', 'Visual — hoja de set up', '', 'proc'),
        ('Separación al borde (las dos líneas)', '4 mm ± 1 mm', 'Regla metálica (código MC TBD)', 'SC', 'prod'),
        ('Densidad de puntada', '4 puntadas en 16 mm (± 1)', 'Regla metálica (código MC TBD)', 'SC', 'prod'),
        ('Color del hilo vista según versión', 'L1 Alpe Gray FX483TK-11930E · L2 y L3 Gray Violet FX483TK-11703E · L0 sin costura vista', 'Visual en la bobina', 'SC', 'prod'),
        ('Atraque', '3 a 4 puntadas al inicio y al final de cada línea', 'Visual', '', 'prod'),
        ('Línea vista alineada con la costura de unión, completa, sin puntadas irregulares ni arrugas', 'Según muestra patrón / biblia de defectos', 'Visual / muestra patrón', '', 'prod'),
    ]
    antes_vista = ("Rev 0 ('Operación 40 Costura vista'): filas escritas como modo de falla ('Costura descosida o débil', 'Costura desviada o fuera de especificación', "
                   "'Puntadas irregulares', 'Selección incorrecta del hilo', 'Largo de puntada', 'Distancia entre costuras') sin especificación")
    for k, (c, esp, inst, clas, tipo) in enumerate(vista):
        extra = {'op': 'Operación 31.', 'nom': 'Costura vista (L1 / L2 / L3)', 'maq': 'Máquina de costura vista (código TBD)'} if k == 0 else {}
        if tipo == 'proc':
            R.append(fila('cambia', vista_src, antes_vista, **extra, n='1.0', proc=c, esp=esp, inst=inst,
                          tam='1 control', frec='Inicio de turno / Después de cada intervención mecánica o parada de más de 1 h',
                          reg='Registro de set up', resp='Operador de producción', reac='Según P-09/I.'))
        else:
            R.append(fila('cambia', vista_src, '', n=f'{k + 1}.0', prod=c, clas=clas, esp=esp, inst=inst, **PIEZA_TURNO))
            R.append(fila('cambia', vista_src, '', **AUTO))

    # --- tapizado y carga del molde
    tap = [
        ('40', 'Enfundado', 'Funda asentada hasta el fondo, centrada respecto del asta, sin pliegues; las dos varillas sobresalen parejas',
         'Visual', f'{ho} pestaña 40 pasos 3-4 + AMFE op 40 (detección: inspección visual del operador antes del cierre del molde)'),
        ('41', 'Inserción de varilla', 'Vinilo en contacto continuo con la varilla en todo el contorno (sello), sin huecos ni separaciones',
         'Visual con foto OK / NOK', f'{ho} pestaña 41 pasos 3-4. El AMFE op 41 tiene la detección en TBD'),
        ('42', 'Colocación de precinto con pistola etiquetadora', 'Precinto en ambos lados, atraviesa todo el espesor del vinilo y queda firme al tironear; igual a la foto OK',
         'Tironeo manual + visual con foto OK', f'{ho} pestaña 42 pasos 3-5. El AMFE op 42 tiene la detección en TBD'),
        ('50', 'Colocación de bolsa y carga del apoyacabezas en el molde', 'Bolsita hacia las astas; marca de las astas coincide con la del molde; sin vinilo sobresaliente',
         'Visual', f'{ho} pestaña 50 pasos 1-5. El AMFE op 50 tiene la detección en TBD'),
        ('51', 'Cierre del molde y colocación de boquilla', 'Bolsa por fuera del molde y boquilla dentro de la bolsa; clamps cerrados; precinto enganchado a los soportes',
         'Visual', f'{ho} pestaña 51 pasos 1-6 + AMFE op 51'),
    ]
    for op, nom, prod, inst, src in tap:
        R.append(fila('nueva', src + f'. Tamaño 100 %: la verificación es un paso de la instrucción en cada ciclo. Frecuencia de registro TBD '
                      f'(el ciclo de control de la {ho} en esta pestaña está en TBD)', '',
                      op=f'Operación {op}.', nom=nom, maq='Dispositivo de tapizado / molde PIP' if op in ('50', '51') else 'Mesa de tapizado',
                      n='1.0', prod=prod, esp=f'Según {ho} pestaña {op} (fotos OK / NOK)', inst=inst,
                      tam='100%', frec='TBD', reg='Autocontrol', resp='Operador de producción', reac='Según P-09/I.'))

    # --- inyeccion PU
    pu_src = ('Variables: planilla HTO de la PIP (Lattanzi, registro de pruebas, NO especificación) + AMFE op 52. '
              f'Valores TBD: la {ho} pestaña 52 tiene el ciclo de control en TBD y no hay parametría liberada en el legajo')
    pu_antes = "Rev 0 ('Operación 50 INYECCION DE PU'): 'Hoja de set-up / Ver hoja de Set-Up', 'Espumado - Tiempo de presión', 'Varilla desalineada', 'Sellado incompleto del orificio inferior'"
    pu = [
        ('Temperatura del poliol (POLY)', '', 'TBD °C ± TBD (la planilla de pruebas registra ± 5 °C sobre la consigna)', 'Panel HMI de la inyectora', ''),
        ('Temperatura del isocianato (ISO)', '', 'TBD °C ± TBD', 'Panel HMI de la inyectora', ''),
        ('Caudal (g/s)', 'D/TLD', 'TBD', 'Panel HMI — flujómetros POLY / ISO', 'AMFE op 52: "el flujómetro mide caudal incorrecto y entrega ratio A:B fuera de especificación" D/TLD (S9 O6)'),
        ('Relación de mezcla POLY : ISO (P = 100)', 'D/TLD', 'TBD', 'Panel HMI', 'AMFE op 52: "mezcla iso/poliol mal hecha en planta" y "variador desincronizado" D/TLD (S9 O4 / O6)'),
        ('Peso del shot (g)', '', f'TBD ({v["shot"]})', 'Panel HMI', ''),
        ('Tiempo de inyección (s)', '', 'TBD', 'Panel HMI', ''),
        ('Temperatura del molde', '', 'TBD', 'TBD', 'AMFE op 52 causa "temperatura de molde fuera de rango"'),
        ('Tiempo de curado / desmoldeo', '', 'TBD', 'Panel HMI', ''),
        ('Temperatura y humedad ambiente', '', 'TBD (se registran en la planilla de pruebas)', 'Termohigrómetro (código TBD)', ''),
        ('Agitación de los componentes en los tanques', 'D/TLD', 'Agitadores funcionando; tiempo de agitación TBD', 'Visual — panel',
         'AMFE op 52: "agitador del tanque POLY o ISO parado" D/TLD (S9 O4). Por analogía, la VDA 6.3 de VW (2025) marcó que la mezcla y agitación de ADHESIVO Y RETICULANTE no estaban en el plan'),
    ]
    for k, (proc, clas, esp, inst, extra_src) in enumerate(pu):
        extra = {'op': 'Operación 52.', 'nom': 'Inyección automática de PU', 'maq': 'Inyectora PU TP900 (Liqin) con dosificadora A:B + molde en carrusel'} if k == 0 else {}
        R.append(fila('nueva', pu_src + ('. ' + extra_src if extra_src else ''), pu_antes if k == 0 else '',
                      **extra, n=f'{k + 1}.0', proc=proc, clas=clas, esp=esp, inst=inst, **SETUP))
    poka = [
        ('Alarma de desviación de caudal con parada automática', 'D/TLD'),
        ('Alarma de desviación de presión con parada automática / corte por nivel bajo de tanques', ''),
        ('Bloqueo de inyección hasta alcanzar la consigna de temperatura', ''),
        ('Confirmación de purga del cabezal entre ciclos', ''),
        ('Calibración de flujómetros POLY / ISO (POL1 / ISO1 = 1 en HMI)', 'D/TLD'),
    ]
    for k, (proc, clas) in enumerate(poka):
        R.append(fila('nueva', 'AMFE op 52 (controles de detección y prevención; las D/TLD vienen de las causas de flujómetro y caudal S9) + '
                      'IATF 16949 10.2.4 (los dispositivos a prueba de error se verifican con falla simulada y la frecuencia va en el plan). '
                      'Método, frecuencia y responsable: TBD (el I-AC-032 asigna al líder de producción la verificación al inicio de turno; confirmar si aplica a estas alarmas)',
                      n=f'{len(pu) + k + 1}.0', proc=proc, clas=clas, esp='Detiene / bloquea ante la falla simulada',
                      inst='Verificación con falla simulada (I-AC-032)', tam='1 control', frec='TBD', reg='TBD',
                      resp='TBD', reac='Según P-09/I.'))
    R.append(fila('nueva', 'Planilla HTO de la PIP: el peso de la pieza se registra en cada prueba; especificación TBD', '',
                  n=f'{len(pu) + len(poka) + 1}.0', prod='Peso de la pieza espumada', esp='TBD', inst='Balanza (código TBD)',
                  tam='TBD', frec='TBD', reg='TBD', resp='Operador de producción', reac='Según P-09/I.'))

    # --- control final
    R.append(fila('cambia', f'{ho} pestaña 60 + {FLUJO} op 60 + cronograma de calibración 2026 Rev.7 ({v["calibre"]}: calibre de forma APC Patagonia, sector Inyección VWA)',
                  "Rev 0: 'Operación 80 - Inspección final + carga de ARB' - 'Control dimensional de piezas terminadas' - 'Calibre de control' - '5 piezas por lote de inyección de sustrato plástico' - 'Metrología'",
                  op='Operación 60.', nom='Control final de calidad', maq='Mesa de control final',
                  n='1.0', prod='Dimensional contra calibre de control', esp='Según calibre dimensional', inst=f'Calibre de forma {v["calibre"]}',
                  tam='1 Pieza', frec='Primera pieza', reg='Registro de control', resp='Inspector de calidad', reac='Según P-09/I.'))
    R.append(fila('cambia', f'{ho} pestaña 60 pasos 1-6 (biblia de defectos y pieza patrón)',
                  "Rev 0: 'Apariencia sin despegues, cortes, terminación ok, sin manchas ni marcas ni abertura..., sin filtraciones de espuma por costuras' - 'Operador de Calidad'",
                  n='2.0', prod='Aspecto', esp='Costura alineada; sin arrugas ni pliegues; sin agujeros ni filtración de espuma por costura ni zona de astas; sin puntadas salteadas; atraque sin hilos sueltos; sin hilo sobrante; sin rasgaduras',
                  inst='Visual — biblia de defectos y pieza patrón', tam='100%', frec='Por lote', reg='Autocontrol', resp='Inspector de calidad', reac='Según P-09/I.'))
    R.append(fila('nueva', f'{ho} pestaña 60 paso 7', '', n='3.0', prod='Etiqueta de trazabilidad 50 x 20 según referencia', esp='Pieza en bolsa cerrada y etiquetada',
                  inst='Visual', tam='100%', frec='Por lote', reg='Autocontrol', resp='Inspector de calidad', reac='Según P-09/I.'))
    R.append(fila('cambia', 'Rev 0 de Calidad (solo cambia el número de característica)', "Rev 0: '3.0 Carga en el sitema ARB'",
                  n='4.0', prod='Carga en el sistema ARB', esp='Cantidad OK / cantidad NOK', inst='Visual',
                  tam='1.0', frec='Por lote.', reg='Autocontrol.', resp='Operador de Calidad', reac='Según P-09/I.'))

    # --- reprocesos
    rep = [
        ('70', 'Reproceso: eliminación de hilo sobrante', 'TBD', 'TBD', f'{ho} pestaña 70 en TBD (sin pasos ni ciclo de control)'),
        ('71', 'Reproceso: puntada floja', 'Tensión correcta del hilo: la aguja Nm 140 (N° 22) pasa bajo el hilo entre dos puntadas y el hilo vuelve a su posición',
         'Método aguja Nm 140', f'{ho} pestaña 71 pasos 6-9 + AMFE op 71'),
        ('72', 'Reproceso: eliminación de arrugas en horno', 'TBD (temperatura y tiempo del horno; pirómetro en condiciones y calibrado)', 'TBD',
         f'{ho} pestaña 72 en TBD. La VDA 6.3 de VW (2025) marcó el pirómetro del horno de los apoyacabezas dañado (6.4.1) y sin calibrar (6.4.3)'),
    ]
    for op, nom, esp, inst, src in rep:
        R.append(fila('nueva', src + '. A-10 del APQP: el retrabajo va en el plan y tiene que estar aprobado por el cliente (ver lista)', '',
                      op=f'Operación {op}.', nom=nom, maq='Puesto de reproceso', n='1.0', prod='Pieza reprocesada' if op != '72' else 'Arrugas eliminadas',
                      esp=esp, inst=inst, tam='100%', frec='Piezas reprocesadas', reg='Registro de calidad', resp='Líder de producción',
                      reac='Según P-09/I.'))

    # --- embalaje (SC del AMFE op 80: S5 O4 en el AMFE live del 15/10/2026)
    R.append(fila('cambia', f'Ficha de embalaje {v["ge"]} (maestro de fichas, vigente desde 17/06/2026) + {ho} pestaña 80. '
                  'Sigla: AMFE op 80 SC "marcado de identificación ausente o incorrecto" (S5 O4)',
                  "Rev 0: 'Operación 100 - Embalaje' - 'Identificación de medio correcto de la pieza' - 'Según hoja de operaciones'",
                  op='Operación 80.', nom='Embalaje y etiquetado de producto terminado', maq='Contenedor según ficha ' + v['ge'],
                  n='1.0', prod='Identificación del medio', clas='SC', esp='Etiqueta SATO 100 x 60 según código de la pieza (ARB)',
                  inst=f'Visual — ficha {v["ge"]}', tam='1.0', frec='Por lote.', reg='Autocontrol.', resp='Operador de Calidad', reac='Según P-09/I.'))
    R.append(fila('cambia', f'Ficha de embalaje {v["ge"]}', "Rev 0: 'Cantidad correcta de piezas por medio' - 'Según hoja de operaciones'",
                  n='2.0', prod='Cantidad por medio', esp=v['cant'], inst=f'Visual — ficha {v["ge"]}', tam='1.0', frec='Por lote.',
                  reg='Autocontrol.', resp='Operador de Calidad', reac='Según P-09/I.'))

    # --- test de lay out
    R.append(seccion('TEST DE LAY OUT'))
    if v['pv2005_antes']:
        R.append(fila('cambia', 'La Rev 0 de esta hoja copiaba el texto de los traseros. Ciclos para el delantero: TBD según especificación VW', v['pv2005_antes'],
                      op='1.0', nom='Test de revalidacion', n='1.0', prod='Ensayo de la resistencia al cambio de climas - PV2005 A',
                      esp='Sin grietas ni alteración tras los ciclos que fije VW para el delantero (TBD)', inst='Ensayo de laboratorio',
                      tam='1 muestra de cada refrencia', frec='Anual', reg='Informe de Laboratorio interno', resp='Calidad', reac='Según P-09/I.'))
    else:
        R.append(fila('igual', '', '', op='1.0', nom='Test de revalidacion', n='1.0',
                      prod='Ensayo de la resistencia al cambio de climas  - PV2005 A',
                      esp='sin grietas tras el almacenamineto de 8 ciclos(TRASERO CENTRAL ) y de 5 ciclos (TRASERO LATERAL), sin envejecimiento anterios',
                      tam='1 muestra de cada refrencia', frec='Anual', reg='Informe de Laboratorio interno', resp='Calidad', reac='Según P-09/I.'))
    R.append(fila('nueva', 'VDA 6.3 de VW 2025, ítem 7.2: "incluir en los cronogramas de ensayos los referidos a compresión según PV 3410 para conjuntos completos de apoyacabezas"', '',
                  n='2.0', prod='Compresión del conjunto — PV 3410', esp='Según PV 3410 (valores TBD)', inst='Ensayo de laboratorio',
                  tam='1 muestra de cada referencia', frec='Anual', reg='Informe de laboratorio', resp='Calidad', reac='Según P-09/I.'))
    R.append(fila('nueva', 'AMFE op 10 y 52 (D/TLD: flamabilidad TL 1010, emisiones VW 50180) + CSR VW (layout inspection and functional testing; la VDA 6.3 2025 lo marcó incompleto, ítem 7.1)', '',
                  n='3.0', prod='Flamabilidad y emisiones del conjunto', clas='D/TLD\nD/TLD', esp='TL 1010: < 100 mm/min · VW 50180',
                  inst='Cámara de flamabilidad MC184 / laboratorio externo', tam='1 muestra de cada referencia', frec='Anual',
                  reg='Informe de laboratorio', resp='Calidad', reac='Según P-09/I.'))
    R.append(fila('nueva', 'CSR VW: layout inspection (VDA 6.3 2025 ítem 7.1). Cotas del plano: TBD', '',
                  n='4.0', prod='Dimensional completo según plano (lay out)', esp='Cotas del plano del cliente (TBD)', inst='Calibre dimensional / laboratorio',
                  tam='1 muestra de cada referencia', frec='Anual', reg='Informe dimensional', resp='Laboratorio', reac='Según P-09/I.'))
    return R


# ---------------------------------------------------------------- Excel
def celda_superior(ws, direccion):
    """La celda que manda en una combinada (escribir en otra no muestra nada)."""
    return ws.Range(direccion).MergeArea.Cells(1, 1)


def escribir_hoja(ws, key):
    v = V[key]
    xl_up = -4162
    # encabezado: N° de parte (C5:F6 combinada) y S/R con una sola marca (hay D/TLD asignadas en el AMFE)
    np_cel = celda_superior(ws, 'C6')
    np_cel.Value = v['codigos']
    sr = celda_superior(ws, 'N66')
    if str(sr.Value or '').strip().upper() == 'X':
        sr.Value = ''

    # cuerpo: desde la fila "Recepción" hasta la ultima usada
    primera = None
    for r in range(70, 90):
        if str(ws.Cells(r, 1).Value or '').strip().lower().startswith('recep'):
            primera = r
            break
    if primera is None:
        raise RuntimeError(f'{v["hoja"]}: no encuentro la fila "Recepción"')
    ultima = primera
    for c in range(1, 15):
        ultima = max(ultima, ws.Cells(ws.Rows.Count, c).End(xl_up).Row)
    fuente_letra = ws.Cells(primera + 1, 5).Font.Name
    tam_letra = ws.Cells(primera + 1, 5).Font.Size
    sec_color = ws.Cells(primera, 1).Interior.Color
    ws.Range(ws.Cells(primera, 1), ws.Cells(ultima + 5, 14)).UnMerge()
    ws.Range(ws.Rows(primera), ws.Rows(ultima + 5)).Delete()

    filas = una_por_fila(filas_variante(key))
    r = primera
    grupos = []
    grupo_ini = None
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
        rng.WrapText = True
        rng.VerticalAlignment = -4108
        rng.Borders.LineStyle = 1
        for i, campo in enumerate(CAMPOS):
            cel = ws.Cells(r, i + 1)
            cel.NumberFormat = '@'
            valor = f[campo]
            if campo == 'clas':
                # la marca de la casa en los planes de Calidad es la D (D y TLD son la misma marca, Formel Q §7.5)
                valor = valor.replace('D/TLD', 'D')
            cel.Value = valor
            if 'TBD' in str(valor) or 'CONFLICTO' in str(valor):
                cel.Font.Color = ROJO_FUENTE
            if campo == 'clas' and valor.strip() == 'D':
                cel.Font.Color = ROJO_FUENTE   # la casa marca la D en rojo (planes de Calidad, Cozzuol)
                cel.Font.Bold = True
        for c in (4, 7, 10, 11):
            ws.Cells(r, c).HorizontalAlignment = -4108
        # Sin amarillo ni notas: Fak, 15/10/2026 ("todo amarillo con demasiadas notas"). El cambio de cada
        # fila y su fuente quedan en este script (_fuente, _antes) y lo pendiente en la lista que acompaña.
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
    return len([f for f in filas if '_seccion' not in f])


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    origen, salida = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(salida, exist_ok=True)
    nombre = sys.argv[3] if len(sys.argv) > 3 else 'PC APOYACABEZAS Patagonia - propuesta de Ingenieria 15-10-2026.xls'
    destino = os.path.join(salida, nombre)
    shutil.copyfile(origen, destino)
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(destino)
        for key in ('DEL', 'TC', 'TL'):
            ws = wb.Worksheets(V[key]['hoja'])
            n = escribir_hoja(ws, key)
            print(f'{V[key]["hoja"]!r}: {n} filas', flush=True)
        wb.Save()
        wb.ExportAsFixedFormat(0, os.path.splitext(destino)[0] + '.pdf')
        wb.Close(False)
    finally:
        xl.Quit()
    print(destino)


if __name__ == '__main__':
    main()
