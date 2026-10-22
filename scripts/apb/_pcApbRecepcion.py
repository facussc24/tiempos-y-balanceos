"""
_pcApbRecepcion.py — filas de recepcion (operacion 10) del plan de control del APB trasero central Patagonia.

Un material por cada linea de la BOM ultimo nivel del arb (22/09/2026, legajo 7-) que se compra. Las
caracteristicas, especificaciones e instrumentos salen del plan de recepcion de Calidad de ese material
(`Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\Recepcion De Materiales\\1 - Planes de control\\`, relevado el 19/10/2026);
lo que no tiene plan de recepcion sale del plan Rev 1 de Calidad de esta pieza (M. Nieve, 31/07/2026, adjunto del mail
del 12/08/2026) o del control de deteccion del AMFE 150 op 10, y lo que falta va TBD.

Sin bloque generico "Todos los materiales" (Fak, 19/10/2026: ningun plan de Calidad lo tiene; embalaje, remito y lote
los cubre el P-10/I). Las siglas del AMFE 150 op 10 que estaban en ese bloque se COPIAN en la fila de esa caracteristica
de cada material (skill §4): SC de "contaminacion / suciedad en la materia prima" (FM 4, S8 O5-O6) en la fila "Aspecto /
limpieza"; SC de "material con especificacion erronea (dimensiones, color...)" (FM 3, S8 O5-O7) en las filas de
dimensiones y color; D de flamabilidad TL 1010 y emisiones VW 50180 (S9 O3) en el vinilo, que es el unico material de
tapizado de la BOM. Instrumentos contra el cronograma de calibracion 2026 Rev.7.

Cada fila de `filas`: (caracteristica, sigla, especificacion, instrumento, cambios a la muestra/frecuencia/registro o None).
"""

LOTE = dict(tam='1 Muestra por lote')
ANUAL = dict(tam='---', frec='Anual')
REV1 = 'plan Rev 1 de Calidad de esta pieza (M. Nieve, 31/07/2026)'
LIMPIO = ('Aspecto / limpieza', 'SC', 'Sin suciedad ni contaminación; embalaje con protección', 'Visual / muestra límite (TBD: la define Calidad)', None)
LIBRE = ('La pieza debe estar libre de rebaba, marcas de herramental, deformaciones, bordes afilados, aceite, grasa '
         'y cualquier otro defecto que afecte su conformación')
# consignados de VW: el plan Rev 1 (p. 2 a 5) dice muestra "Según acuerdo plan de control del proveedor"
ACUERDO = dict(tam='Según acuerdo plan de control del proveedor')
DIM_PROV = ('Dimensional de control', 'SC', 'Según informe de control del proveedor', 'Certificado del proveedor', ACUERDO)
P10 = dict(reg='P-10/I.')

RECEPCION = [
    dict(prod='Vinilo Sansuy TIPO IV IS LE TITAN BLACK (PVC 1,1 mm + PU 1,0 mm) — código 197.025.0425-6',
         fuente=(f'{REV1} (espesor 1,8 a 2,5 mm con medidor de espesor; gramaje 800 a 1000 g/m2) + BOM005 Rev A (PVC 1,1 + PU 1,0) '
                 '+ AMFE 150 op 10 (lote; flamabilidad TL 1010 y emisiones VW 50180 D/TLD S9 O3; SC FM 3 y 4) + plan 1036 (registro del ensayo)'),
         filas=[
             LIMPIO,
             ('Color y grabado', 'SC', 'Según patrón de aspecto', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             ('Espesor', 'SC', '1,8 a 2,5 mm', 'Micrómetro MC405', None),
             ('Gramaje', 'SC', '800 a 1000 g/m²', 'Balanza (código TBD)', None),
             ('Ancho del rollo', 'SC', '1400 mm (tolerancia TBD)', 'Cinta métrica MC403', None),
             ('Flamabilidad (TL 1010)', '', '< 100 mm/min', 'Cámara de flamabilidad MC184', dict(reg='I-AC-027.I / P-10/I. / ARB')),
             ('Certificado de flamabilidad TL 1010', 'D', 'Certificado vigente por lote', 'Certificado del proveedor', None),
             ('Certificado de emisiones VW 50180', 'D', 'Certificado vigente por lote', 'Certificado del proveedor', None),
             ('Lote', '', 'Lote en el certificado y la etiqueta, registrado en ARB', 'Visual y certificado del proveedor', None),
         ]),
    dict(prod='Fieltro agujado SOLET 480/15 blanco — código 427TEL003COR01',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (fieltro duro 480 g/m²; SC FM 3 y 4). Sin plan de recepción de este código',
         filas=[
             LIMPIO,
             ('Gramaje', 'SC', '480 g/m² (tolerancia TBD)', 'Balanza (código TBD)', None),
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Fieltro punzonado RESILIN 300/20 TITAN BLACK — código RES30020TIT',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (fieltro punzonado 270 - 320 g/m²; SC FM 3 y 4). Sin plan de recepción de este código',
         filas=[
             LIMPIO,
             ('Gramaje', 'SC', '270 a 320 g/m²', 'Balanza (código TBD)', None),
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Aplix 10 x 60 mm mold in foam hook — código APLIX_225LLB',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 4). Sin plan de recepción de este código (el 803 es del APLIX-A999R8395)',
         filas=[
             LIMPIO,
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Cierre CIF C 056 — código 427VAR001COS01',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 3 y 4). Sin plan de recepción de este código',
         filas=[
             LIMPIO,
             ('Largo del cierre', 'SC', '360 ± 1 mm', 'Regla (código TBD)', None),
             ('Dientes', '', 'Sin dientes faltantes ni dañados', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
         ]),
    dict(prod='Cinta sarga 24 mm — código 5825',
         fuente='BOM arb 22/09/2026 (SC FM 3 y 4 del AMFE 150). Sin plan de recepción de este código (el 1005, obsoleto, es de la 5826 de 25 mm)',
         filas=[
             LIMPIO,
             ('Ancho', 'SC', '24 mm (tolerancia TBD)', 'Calibre (código TBD)', None),
             ('Espesor', 'SC', 'TBD', 'Micrómetro MC405', None),
         ]),
    dict(prod='Hilo unión Nm 30/3 negro — código FX284-E0PTO (Linhanyl)',
         fuente='Plan de recepción N° 1043 Rev B (03/09/2025) + BOM arb 22/09/2026 + TL 1010 Tabla 1 (BR < 100) + AMFE 150 op 10 (SC FM 3 y 4)',
         filas=[
             LIMPIO,
             ('Número métrico', 'SC', '30/3', 'Visual en etiqueta', LOTE),
             ('Material', '', '100 % poliéster (VW 50106)', 'Certificado del proveedor', LOTE),
             ('Cantidad de cabos', 'SC', '3', 'Visual', LOTE),
             ('Color', 'SC', 'E0PTO negro, según patrón', 'Visual con patrón', LOTE),
             ('Solidez a la luz', '', '≥ 4', 'Certificado del proveedor', ANUAL),
             ('Flamabilidad', '', '< 100 mm/min', 'Certificado del proveedor', ANUAL),
         ]),
    dict(prod='Isocianato ISO-PLUS 1394 (Mas-Tin)',
         fuente=(f'Plan de recepción N° 819 Rev B (03/09/2025) + especificación Mas-Tin ISO-PLUS 1394 Rev.07 y certificado lote 90 '
                 f'(densidad en g/cm³) + {REV1} (certificado y lote). Vencimiento: AMFE 150 y Rev 1 dicen más de 6 meses desde la '
                 'recepción, el 819 dice 6 meses desde producido: TBD a la lista'),
         filas=[
             ('Certificado de calidad', '', 'Recepción del certificado en cada entrega', 'Certificado del proveedor', None),
             ('Lote', '', 'Número de lote indicado en la etiqueta', 'Certificado del proveedor', None),
             ('Fecha de vencimiento', '', 'TBD', 'Etiqueta del producto', None),
             ('Contenido de NCO', '', '30 ± 2,5 %', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
             ('Viscosidad', '', '200 a 400 cps', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
             ('Densidad', '', '1,2 ± 0,05 g/cm³', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
         ]),
    dict(prod='Poliol POLI-PLUS FF-629 (Mas-Tin)',
         fuente=(f'Plan de recepción N° 822 + certificado Mas-Tin FF-629 lote 49 y especificación FF-629 + ISO 1394 Rev.01 (unidades) '
                 f'+ {REV1} (certificado y lote). Vencimiento: AMFE 150 y Rev 1 dicen más de 6 meses desde la recepción, el 822 dice '
                 '"según certificado": TBD a la lista'),
         filas=[
             ('Certificado de calidad', '', 'Recepción del certificado en cada entrega', 'Certificado del proveedor', P10),
             ('Lote', '', 'Número de lote indicado en la etiqueta', 'Certificado del proveedor', P10),
             ('Fecha de vencimiento', '', 'TBD', 'Etiqueta del producto', P10),
             ('Viscosidad', '', '1200 a 2000 cps', 'Certificado del proveedor', P10),
             ('Densidad libre', '', '55 a 85 kg/m³', 'Certificado del proveedor', P10),
             ('Tiempo de crema', '', '12 a 18 s', 'Certificado del proveedor', P10),
             ('Tiempo de pegajosidad', '', '80 a 120 s', 'Certificado del proveedor', P10),
         ]),
    dict(prod='Estructura interna del apoyabrazos 2HC.885.925 (consignado VWA)',
         fuente=f'BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 3 y 4) + {REV1} (color, dimensional y aspecto)',
         filas=[
             ('Aspecto / limpieza', 'SC', LIBRE + '; sin faltante de pintura', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             ('Color', 'SC', 'Negro, según patrón de aspecto', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             DIM_PROV,
         ]),
    dict(prod='Posavasos 2HC.885.119 (consignado VWA)',
         fuente=f'BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 3 y 4) + {REV1} (pestañas, color, dimensional y aspecto)',
         filas=[
             ('Aspecto / limpieza', 'SC', LIBRE, 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', ACUERDO),
             ('Pestañas de retención', '', ('Las 8 pestañas sujetan el vaso, sin roturas, deformación ni interferencias, '
                                           'y permiten sacarlo a mano'), 'Ensayo funcional con vaso patrón', ACUERDO),
             ('Color', 'SC', 'Negro, según patrón de aspecto', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             DIM_PROV,
         ]),
    dict(prod='Marco posavasos 2HC.885.725 (consignado VWA)',
         fuente=f'BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 3 y 4) + {REV1} (aspecto, color y dimensional)',
         filas=[
             ('Aspecto / limpieza', 'SC', LIBRE, 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             ('Color', 'SC', 'Negro, según patrón de aspecto', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             DIM_PROV,
         ]),
    dict(prod='Tornillo fijador 2HC.075.701.GS (consignado VWA)',
         fuente=f'BOM arb 22/09/2026 + AMFE 150 op 10 (SC FM 3 y 4) + {REV1} (tipo, color y aspecto)',
         filas=[
             ('Aspecto / limpieza', 'SC', LIBRE, 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
             ('Largo', 'SC', '12,2 ± 0,5 mm', 'Certificado del proveedor', ACUERDO),
             ('Color', 'SC', 'Negro, según patrón de aspecto', 'Visual / patrón de aspecto (TBD: confirmar con Calidad)', None),
         ]),
    dict(prod='Bolsa PP 600 x 500 mm — código 427VAR002TAP01',
         fuente='BOM arb (medida corregida el 24/09/2026). Sin plan de recepción ni control en el AMFE o el plan Rev 1: TBD a la lista',
         filas=[('Control de recepción', '', 'TBD', 'TBD', None)]),
    dict(prod='Etiquetas ET-SATO-100X60 y ET-SATO-50X20',
         fuente='BOM arb 22/09/2026. Sin plan de recepción ni control en el AMFE o el plan Rev 1: TBD a la lista',
         filas=[('Control de recepción', '', 'TBD', 'TBD', None)]),
]
