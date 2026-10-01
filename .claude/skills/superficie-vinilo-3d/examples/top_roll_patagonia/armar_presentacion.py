# -*- coding: utf-8 -*-
"""Caso real, 01/10/2026: "Superficie de vinilo - Top Roll Patagonia" (9 hojas, pedido del dueño).

Es el EJEMPLO a copiar para la proxima pieza: se cambian las rutas y los textos de arriba, el
resto sale de los numeros que deja sv_medir.py. Corre con el Python del SISTEMA (python-pptx).

Antes (Python de CAD), sobre una carpeta de trabajo W:
  sv_modelo.py <del.step>  W/del_modelo.npz  --ejes x,-z,y
  sv_modelo.py <tras.step> W/tras_modelo.npz --ejes x,-z,y
  sv_medir.py  W/del_modelo.npz  W --clave del
  sv_medir.py  W/tras_modelo.npz W --clave tras --hueco "hueco del parlante:3495,3645,668,745"
  sv_fotos.py  W/del_modelo.npz  W/del_clases.npz  W --clave del  --elev 24 --azim 90
  sv_fotos.py  W/tras_modelo.npz W/tras_clases.npz W --clave tras --elev 24 --azim 90

Despues:
  python armar_presentacion.py W "W/Superficie de vinilo - Top Roll Patagonia.pptx"
"""
import json
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', 'scripts')))
import svlib_capturas as cap                      # noqa: E402
from svlib_lamina import (Mazo, exportar, es, miles, AZUL, NARANJA, OSC, GRIS, GRIS_BARRA, ROJO, AZUL_B, CEN)   # noqa: E402
from PIL import Image, ImageDraw                  # noqa: E402

W, SALIDA = sys.argv[1], sys.argv[2]

# ------------------------------------------------------------------ lo que cambia de un caso a otro
LEG = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX\Tapizadas puerta'
LEG_CORTO = r'PPAP CLIENTES\NOVAX\Tapizadas puerta'
TIZ = LEG + r'\13-Especificaciones de Ingenieria F\02 -Computo Tizada de Corte- Consumo de Materiales\TOP ROLL'
FOTOGRAMAS = (r'C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)'
              r'\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG\.claude\fotogramas de cada video')
PIEZAS = {
    'del': dict(nombre='Top Roll delantero', arb='N 216 (izquierdo)  ·  N 256 (derecho)', cliente='VW 2HC 868 087 / 088',
                borde='Borde que se dobla hacia atrás',
                dxf=TIZ + r'\DELANTERO\Top Roll Front V1.2.dxf', dxf_txt=('Top Roll Front V1.2.dxf', '26/01/2026'), dxf_hueco_mm=1.0),
    'tras': dict(nombre='Top Roll trasero', arb='N 285 (izquierdo)  ·  N 315 (derecho)', cliente='VW 2HC 868 605 / 606',
                 borde='Borde y hueco del parlante',
                 dxf=TIZ + r'\TRASERO\Top Roll rear V4.1 IZQ.dxf', dxf_txt=('Top Roll rear V4.1 IZQ.dxf', '18/05/2026'),
                 dxf_hueco_mm=20.0),      # este contorno viene abierto 14,83 mm: se acepta cerrarlo y se dice en la hoja
}
BOM_CLIENTE = LEG + r'\13-Especificaciones de Ingenieria F\01- Documentacion Novax\Copia de Attachment1-BOM-PATAGONIA-DP-2024-9-9.xlsx'
BOM_CLIENTE_M2 = {'del': '0,14', 'tras': '0,13'}          # hoja 1, renglones 42 y 93 (se ven en la captura)
BOM_ARB = LEG + r'\7-Lista de materiales preliminares\01_BOM MATERIAL\BOM ARB ultimo nivel_Top Roll_20260928.pdf'
OC = r'Z:\arb\oc\ocauto\BA\OC15873-HAARTZ CORPORATION.PDF'
ANCHO_M, LARGO_M, PZAS = 0.835, 1.100, 4                   # rollo (OC 15873) · largo de lamina (pantalla 10/09/2026) · cavidades
# ------------------------------------------------------------------

E = os.path.join(W, 'evidencia'); os.makedirs(E, exist_ok=True)
N = {k: json.load(open(os.path.join(W, k + '_numeros.json'), encoding='utf-8')) for k in PIEZAS}


AVISOS_QUE_NO_FRENAN = ('la cara vista del sustrato no se pudo separar', 'superficie suelta de')


def numeros(k):
    """Los numeros que van a la hoja, y los frenos: este mazo solo se arma con una medicion completa."""
    r = N[k]
    if r.get('n_pieles') != 2:
        raise SystemExit('%s: el 3D trae %s piel(es). Esta presentacion muestra "a la vista" y eso solo se mide con las dos pieles.'
                         % (k, r.get('n_pieles')))
    frenan = [a for a in r['avisos'] if not a.startswith(AVISOS_QUE_NO_FRENAN)]
    if frenan:
        raise SystemExit('%s: el medidor dejo avisos que hay que resolver antes de armar la presentacion:\n  - %s' % (k, '\n  - '.join(frenan)))
    if not r.get('vista_m2_estable_a_2_decimales'):
        raise SystemExit('%s: "a la vista" cambia a 2 decimales segun el borde (%s): se informa el rango, no un numero'
                         % (k, r.get('vista_rango_cm2')))
    total, vista, doblez = r['total_cm2'], r['vista_cm2'], r['doblez_cm2']
    if not (0 < vista < total and abs(vista + doblez - total) < 0.5):
        raise SystemExit('%s: los numeros del medidor no cierran (total %.1f, vista %.1f, doblez %.1f)' % (k, total, vista, doblez))
    total3 = round(total / 1e4, 3); total2 = round(total / 1e4, 2)
    vista2 = round(vista / 1e4, 2); borde2 = round(total2 - vista2, 2)
    if abs(borde2 - round(doblez / 1e4, 2)) > 0.011:       # el borde que se escribe (total - vista) no puede alejarse del medido
        raise SystemExit('%s: a 2 decimales el borde quedaria %.2f y el medido es %.2f: escribir los tres numeros con 3 decimales'
                         % (k, borde2, doblez / 1e4))
    return dict(total3=total3, total2=total2, vista2=vista2, borde2=borde2)


for k in PIEZAS:
    PIEZAS[k]['n'] = numeros(k)

# ---- evidencia: patrones, lista del cliente, BOM del arb, orden de compra, fotos del proceso
PAT = {}
for k, p in PIEZAS.items():
    PAT[k] = cap.dibujo_dxf(p['dxf'], os.path.join(E, 'patron_%s.png' % k), hueco_max_mm=p['dxf_hueco_mm'])

enc, r_del, r_tras = cap.captura_xlsx(BOM_CLIENTE, ['B2:H3', 'B40:H43', 'B91:H94'])
cap.marcar_fila(r_del, 4, 3); cap.marcar_fila(r_tras, 4, 3)        # el TPO es el tercero de los cuatro renglones
cli = Image.new('RGB', (enc.width, enc.height + r_del.height + r_tras.height + 26), 'white')
cli.paste(enc, (0, 0)); cli.paste(r_del, (0, enc.height)); cli.paste(r_tras, (0, enc.height + r_del.height + 26))
cli.save(os.path.join(E, 'cliente.png'))

bom = shutil.copy2(BOM_ARB, os.path.join(E, 'bom_arb.pdf'))
ARB = {}
for k, pag in (('del', 1), ('tras', 3)):
    im, txt = cap.pdf_bloque(bom, pag, marcar='427VIN005COR01', exigir=('TPO', 'MTL', '0.275'), hasta='22020541')
    im.save(os.path.join(E, 'arb_%s.png' % k)); ARB[k] = txt
oc = shutil.copy2(OC, os.path.join(E, 'oc.pdf'))
ancho_rollo, _ = cap.pdf_bloque(oc, 1, marcar='ROLL', exigir=('835',), desde='Comentarios', hasta='PROGRAM', dpi=220)
cap.apilar([cap.pdf_fila(oc, 1, '15873', dpi=220),
            cap.pdf_fila(oc, 1, '427VIN005COR01', hasta_palabra='MTL', encabezado='Código', dpi=220, abajo=40),   # sin los precios
            ancho_rollo]).save(os.path.join(E, 'oc.png'))

Image.open(os.path.join(FOTOGRAMAS, '0631', '0631_02.jpg')).convert('RGB').save(os.path.join(E, 'molde.jpg'), quality=95)
h = Image.open(os.path.join(FOTOGRAMAS, '0830', '0830_09.jpg')).convert('RGB')
ImageDraw.Draw(h).rounded_rectangle((752, 327, 1000, 356), radius=6, outline=(214, 39, 40), width=4)   # "Largo Lamina: +1100,0"
c = h.crop((455, 92, 1345, 442)); c.resize((c.width * 2, c.height * 2), Image.LANCZOS).save(os.path.join(E, 'pantalla.png'))

# ---- el mazo
m = Mazo(titulo='Superficie de vinilo - Top Roll Patagonia')
D, T = PIEZAS['del']['n'], PIEZAS['tras']['n']

s = m.base('Top Roll Patagonia · superficie con vinilo', 'Medida sobre el 3D de cada pieza')            # 1. la respuesta
for i, k in enumerate(PIEZAS):
    q = PIEZAS[k]; y = 1.75 + i * 2.8
    m.imagen(s, os.path.join(W, k + '_terminada.png'), 0.5, y + 0.1, 6.6, 2.3)
    m.texto(s, 7.4, y, 5.5, 0.45, q['nombre'], 22, AZUL_B, True)
    m.texto(s, 7.4, y + 0.45, 5.5, 0.35, q['arb'], 14, GRIS)
    m.caja(s, 7.4, y + 0.95, 2.65, 1.45, AZUL, 'Lo que se ve tapizado', es(q['n']['vista2'], 2) + ' m²', sz_et=14, sz_val=30)
    m.caja(s, 10.2, y + 0.95, 2.65, 1.45, OSC, 'Vinilo de la pieza, en total', es(q['n']['total3'], 3) + ' m²', sz_et=14, sz_val=30)

for k, q in PIEZAS.items():                                                                           # 2 y 3. el 3D pintado
    s = m.base(q['nombre'], q['arb'] + '     ' + q['cliente'])
    m.imagen(s, os.path.join(W, k + '_pintada.png'), 0.5, 1.65, 12.35, 3.45)
    y = 5.3; w = 3.95; g = 0.25
    m.caja(s, 0.5, y, w, 1.5, AZUL, 'Lo que se ve tapizado', es(q['n']['vista2'], 2) + ' m²')
    m.caja(s, 0.5 + w + g, y, w, 1.5, NARANJA, q['borde'], es(q['n']['borde2'], 2) + ' m²')
    m.caja(s, 0.5 + 2 * (w + g), y, w, 1.5, OSC, 'Vinilo de la pieza, en total', es(q['n']['total3'], 3) + ' m²')
    m.texto(s, 0.5, 6.9, 12.35, 0.35, 'Medido el izquierdo; el derecho es su espejo y tiene la misma superficie.', 13, GRIS, False, CEN)

lam_m2 = ANCHO_M * LARGO_M; ml_pieza = LARGO_M / PZAS; m2_pieza = round(lam_m2 / PZAS, 2)               # 4. consumo del proceso
assert ('%.3f' % ml_pieza) == '0.275' and all('0.275' in ARB[k] for k in ARB)      # es lo que esta cargado en el arb
queda = D['total2']
if queda != T['total2']:
    raise SystemExit('las dos piezas no dan el mismo total a 2 decimales (%s y %s): la hoja del consumo lleva una barra por pieza'
                     % (D['total2'], T['total2']))
recorte = round(m2_pieza - queda, 2)
pct = int(round(100 * queda / m2_pieza / 10.0) * 10)
s = m.base('Consumo actual del proceso', 'Moldeadora IMG: de cada lámina de vinilo salen %d piezas' % PZAS)
m.imagen(s, os.path.join(E, 'molde.jpg'), 0.5, 1.62, 6.2, 3.5)
m.texto(s, 0.5, 5.13, 6.2, 0.35, 'El molde, visto de arriba: %d piezas por lámina' % PZAS, 14, OSC, True, CEN)
m.imagen(s, os.path.join(E, 'pantalla.png'), 6.95, 1.62, 5.9, 2.33)
m.texto(s, 6.95, 3.96, 5.9, 0.35, 'Pantalla de la moldeadora, 10/09/2026', 14, OSC, True, CEN)
m.texto(s, 6.95, 4.45, 5.9, 1.1, [('Lámina: 835 mm × 1.100 mm  =  %s m²' % es(lam_m2, 2), 18, OSC, False),
                                  ('Por pieza: %s m de rollo  =  %s m²' % (es(ml_pieza, 3), es(m2_pieza, 2)), 18, OSC, True)])
m.texto(s, 0.5, 5.52, 12.35, 0.35, 'De los %s m² que consume cada pieza:' % es(m2_pieza, 2), 15, GRIS)
m.barra(s, 0.5, 5.9, 12.35, 0.7, [(queda, OSC, 'Queda en la pieza: %s m²  (unos %d %%)' % (es(queda, 2), pct)),
                                  (recorte, GRIS_BARRA, 'Recorte: %s m²' % es(recorte, 2))])
m.texto(s, 0.5, 6.75, 12.35, 0.35, 'Por vehículo (2 delanteros + 2 traseros): %s m de rollo.' % es(ml_pieza * 4, 2), 14, GRIS, False, CEN)

s = m.base('El mismo dato en otros documentos', 'Vinilo de la pieza, en m²')                           # 5. cruce
m.tabla(s, [('', 'Delantero', 'Trasero'),
            ('Medido en el 3D de la piel recortada (17/03/2026)', es(D['total3'], 3), es(T['total3'], 3)),
            ('Patrón de corte en plano', es(PAT['del']['area_cm2'] / 1e4, 3), es(PAT['tras']['area_cm2'] / 1e4, 3)),
            ('Lista de materiales del cliente (09/2024)', BOM_CLIENTE_M2['del'], BOM_CLIENTE_M2['tras'])])

s = m.base('De dónde sale · 3D de la piel recortada', 'VW Patagonia Front / Rear Door Final Trimmed Skin 3-17-2026.step')   # 6
m.texto(s, 0.5, 1.6, 6, 0.35, 'Delantero, visto de atrás', 14, OSC, True)
m.imagen(s, os.path.join(W, 'del_atras.png'), 0.5, 1.9, 12.35, 2.05)
m.texto(s, 0.5, 3.95, 6, 0.35, 'Trasero, visto de atrás', 14, OSC, True)
m.imagen(s, os.path.join(W, 'tras_atras.png'), 0.5, 4.25, 12.35, 2.2)
m.pie(s, ['Gris: el plástico.   Azul y naranja: la piel de vinilo, recortada y sin doblar.   Enviado por GS Engineering a Carlos Baptista el 18/03/2026.',
          'Carpeta: ' + LEG_CORTO + r'\6-Planos de la pieza\3D\00- 3D sin Edgefolding'])

s = m.base('De dónde sale · Patrón de corte en plano')                                                # 7
for i, (k, q) in enumerate(PIEZAS.items()):
    y = 1.62 + i * 2.55; a = PAT[k]['area_cm2']
    m.imagen(s, os.path.join(E, 'patron_%s.png' % k), 0.5, y, 7.3, 2.5)
    m.texto(s, 8.3, y + 0.25, 4.55, 0.4, q['nombre'].replace('Top Roll ', '').capitalize(), 22, AZUL_B, True)
    m.texto(s, 8.3, y + 0.7, 4.55, 0.35, q['dxf_txt'][0] + '  ·  ' + q['dxf_txt'][1], 14, GRIS)
    m.texto(s, 8.3, y + 1.1, 4.55, 0.7, es(a / 1e4, 3) + ' m²', 36, ROJO, True)
    m.texto(s, 8.3, y + 1.75, 4.55, 0.35, miles(a) + ' cm²', 16, OSC)
abiertos = ['El contorno del %s viene abierto %s mm en el archivo; se cerró con un tramo recto.'
            % (PIEZAS[k]['nombre'].replace('Top Roll ', ''), es(PAT[k]['hueco_de_cierre_mm'], 0)) for k in PIEZAS if PAT[k]['hueco_de_cierre_mm'] > 1.0]
m.pie(s, abiertos + ['Carpeta: ' + LEG_CORTO + r'\13-Especificaciones de Ingenieria F\02 -Computo Tizada de Corte- Consumo de Materiales\TOP ROLL'],
      y=6.75 if not abiertos else 6.6)

s = m.base('De dónde sale · Lista de materiales del cliente', os.path.basename(BOM_CLIENTE))            # 8
m.imagen(s, os.path.join(E, 'cliente.png'), 0.5, 1.9, 12.35, 3.2)
m.texto(s, 0.5, 5.35, 12.35, 0.4, 'Renglón 1.1.2: puerta delantera, %s m².     Renglón 7.1.2: puerta trasera, %s m².'
        % (BOM_CLIENTE_M2['del'], BOM_CLIENTE_M2['tras']), 18, OSC, True)
m.pie(s, ['Carpeta: ' + LEG_CORTO + r'\13-Especificaciones de Ingenieria F\01- Documentacion Novax'], y=6.75)

s = m.base('De dónde sale · Consumo cargado en el sistema', 'BOM del arb (28/09/2026) y orden de compra 15873 a Haartz (20/08/2026)')   # 9
m.imagen(s, os.path.join(E, 'arb_del.png'), 0.5, 1.65, 7.6, 2.0)
m.imagen(s, os.path.join(E, 'arb_tras.png'), 0.5, 3.75, 7.6, 2.15)
m.imagen(s, os.path.join(E, 'oc.png'), 8.35, 1.65, 4.5, 4.25)
m.texto(s, 0.5, 6.05, 12.35, 0.45, '%s m de lámina  ×  %s m de ancho de rollo  =  %s m² por pieza'
        % (es(ml_pieza, 3), es(ANCHO_M, 3), es(m2_pieza, 2)), 20, OSC, True)
m.pie(s, ['BOM: ' + LEG_CORTO + r'\7-Lista de materiales preliminares\01_BOM MATERIAL\BOM ARB ultimo nivel_Top Roll_20260928.pdf',
          'Orden de compra: ' + OC], y=6.6)

m.guardar(SALIDA)
qa = os.path.join(W, 'qa'); print(exportar(SALIDA, qa, os.path.splitext(SALIDA)[0] + '.pdf'))
print('listo: %s  (mirar las hojas en %s antes de entregar)' % (SALIDA, qa))
print(json.dumps({k: PIEZAS[k]['n'] for k in PIEZAS}))
