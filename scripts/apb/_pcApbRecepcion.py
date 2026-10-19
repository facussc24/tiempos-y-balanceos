"""
_pcApbRecepcion.py — filas de recepcion (operacion 10) del plan de control del APB trasero central Patagonia.

Un material por cada linea de la BOM ultimo nivel del arb (22/09/2026, legajo 7-) que se compra. Las
caracteristicas, especificaciones e instrumentos salen del plan de recepcion de Calidad de ese material
(`Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\Recepcion De Materiales\\1 - Planes de control\\`, relevado el 19/10/2026);
si el material no tiene plan, salen del control de deteccion del AMFE 150 op 10 y lo que falta va TBD.
Siglas: se COPIAN del AMFE 150 op 10 (SC de "material con especificacion erronea" S8 O5-O7 y de
"contaminacion / suciedad en la materia prima" S8 O5-O6; D de "Material: tela tapizado", flamabilidad
TL 1010 y emisiones VW 50180, S9 O3). Instrumentos contra el cronograma de calibracion 2026 Rev.7.

Cada fila de `filas`: (caracteristica, sigla, especificacion, instrumento, cambios a la muestra/frecuencia o None).
"""

ANUAL = dict(frec='Anual')
LOTE = dict(tam='1 Muestra por lote')

RECEPCION = [
    dict(prod='Todos los materiales de la lista de materiales',
         fuente='HO-986 hoja 10 (pasos 1 a 4) + AMFE 150 op 10 (FM 1, 2, 3 y 4; SC de la FM 3 S8 O5-O7 y de la FM 4 S8 O5/O6)',
         filas=[
             ('Estado del embalaje recibido', '', 'Sin daños', 'Visual', None),
             ('Material sin suciedad ni contaminación', 'SC', 'Material y embalaje limpios, con protección', 'Visual', None),
             ('Código y cantidad contra la orden de compra y el remito', '', 'Coincide con la orden de compra', 'Visual / remito', None),
             ('Material según su especificación de compra (dimensiones, color)', 'SC', 'Según el control de cada material', 'Según cada material', None),
             ('Trazabilidad del lote', '', 'Lote registrado en ARB y etiqueta en el envase', 'Sistema ARB', None),
         ]),
    dict(prod='Vinilo Sansuy TIPO IV IS LE 1,10 mm TITAN BLACK — código 197.025.0425-6',
         fuente=('BOM arb 22/09/2026 (descripción 1,10 mm; rollo de 1,40 m) + AMFE 150 op 10 (controles de detección del vinilo, '
                 'sin sigla: S6 O3, S5 O3, S4 O3, S9 O3). Flamabilidad < 100 mm/min como los planes de recepción de vinilos Sansuy (1036). '
                 'Sin plan de recepción de este código (VINILO\\Patagonia vacía)'),
         filas=[
             ('Color y grabado', '', 'Según patrón de aspecto', 'Visual con patrón', None),
             ('Espesor', '', '1,10 mm (tolerancia TBD)', 'Calibre MC413', None),
             ('Gramaje', '', 'TBD', 'Balanza (código TBD)', None),
             ('Ancho del rollo', '', '1400 mm (tolerancia TBD)', 'Cinta métrica MC406', None),
             ('Flamabilidad (TL 1010)', '', '< 100 mm/min', 'Cámara de flamabilidad MC184', None),
         ]),
    dict(prod='Material de tapizado (todos)',
         fuente='AMFE 150 op 10, "Material: tela tapizado": flamabilidad TL 1010 y emisiones VW 50180, D/TLD (S9 O3); control: verificación documental P-14',
         filas=[
             ('Certificado de flamabilidad TL 1010', 'D', 'Certificado vigente por lote', 'Certificado del proveedor', None),
             ('Certificado de emisiones VW 50180', 'D', 'Certificado vigente por lote', 'Certificado del proveedor', None),
         ]),
    dict(prod='Fieltro agujado SOLET 480/15 blanco — código 427TEL003COR01',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (fieltro duro 480 g/m²). Sin plan de recepción de este código',
         filas=[
             ('Gramaje', '', '480 g/m² (tolerancia TBD)', 'Balanza (código TBD)', None),
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Fieltro punzonado RESILIN 300/20 TITAN BLACK — código RES30020TIT',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10 (fieltro punzonado 270 - 320 g/m²). Sin plan de recepción de este código',
         filas=[
             ('Gramaje', '', '270 a 320 g/m²', 'Balanza (código TBD)', None),
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Aplix 10 x 60 mm mold in foam hook — código APLIX_225LLB',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10. Sin plan de recepción de este código (el 803 es del APLIX-A999R8395)',
         filas=[
             ('Flamabilidad', '', 'Según informe de control del proveedor', 'Informe del proveedor', None),
         ]),
    dict(prod='Cierre CIF C 056 — código 427VAR001COS01',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10. Sin plan de recepción de este código',
         filas=[
             ('Largo del cierre', '', '360 ± 1 mm', 'Regla (código TBD)', None),
             ('Dientes', '', 'Sin dientes faltantes ni dañados', 'Visual con patrón', None),
         ]),
    dict(prod='Cinta sarga 24 mm — código 5825',
         fuente='BOM arb 22/09/2026. Sin plan de recepción de este código (el 1005, obsoleto, es de la 5826 de 25 mm)',
         filas=[
             ('Ancho', '', '24 mm (tolerancia TBD)', 'Calibre (código TBD)', None),
             ('Espesor', '', 'TBD', 'Medidor de espesor (código TBD)', None),
         ]),
    dict(prod='Hilo unión Nm 30/3 negro — código FX284-E0PTO (Linhanyl)',
         fuente='Plan de recepción N° 1043 Rev B (03/09/2025) + BOM arb 22/09/2026',
         filas=[
             ('Número métrico', '', '30/3', 'Visual en etiqueta', LOTE),
             ('Material', '', '100 % poliéster (VW 50106)', 'Certificado del proveedor', LOTE),
             ('Cantidad de cabos', '', '3', 'Visual', LOTE),
             ('Color', '', 'E0PTO negro, según patrón', 'Visual con patrón', LOTE),
             ('Solidez a la luz', '', '≥ 4', 'Certificado del proveedor', dict(tam='1 Muestra', frec='Anual')),
             ('Flamabilidad', '', '100 mm/min', 'Certificado del proveedor', dict(tam='1 Muestra', frec='Anual')),
         ]),
    dict(prod='Isocianato ISO-PLUS 1394 (Mas-Tin)',
         fuente='Plan de recepción N° 819 Rev B (03/09/2025) + BOM arb 22/09/2026',
         filas=[
             ('Fecha de vencimiento', '', '6 meses desde producido', 'Etiqueta del producto', dict(frec='Por lote de entrega')),
             ('Contenido de NCO', '', '30 ± 2,5 %', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
             ('Viscosidad', '', '200 a 400 cps', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
             # el 819 escribe "1,2 ± 0,05gr/m³": la unidad queda a confirmar por Calidad (lista de pendientes)
             ('Densidad', '', '1,2 ± 0,05 (unidad TBD)', 'Certificado del proveedor', dict(frec='Por lote de entrega')),
         ]),
    dict(prod='Poliol POLI-PLUS FF-629 (Mas-Tin)',
         fuente='Plan de recepción N° 822 + BOM arb 22/09/2026',
         filas=[
             ('Fecha de vencimiento', '', 'Según certificado del proveedor', 'Certificado del proveedor', None),
             ('Viscosidad', '', '1200 a 2000', 'Certificado del proveedor', None),
             ('Densidad libre', '', '55 a 85', 'Certificado del proveedor', None),
             ('Tiempo de crema', '', '12 a 18', 'Certificado del proveedor', None),
             ('Tiempo de pegajosidad', '', '80 a 120', 'Certificado del proveedor', None),
         ]),
    dict(prod='Estructura interna del apoyabrazos 2HC.885.925 (consignado VWA)',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10. Sin plan de recepción de este código',
         filas=[('Pintura', '', 'Sin faltante de pintura, según patrón', 'Visual con patrón', None)]),
    dict(prod='Posavasos 2HC.885.119 (consignado VWA)',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10. Sin plan de recepción de este código',
         filas=[('Pestañas de retención', '', 'Sujetan el vaso; sin roturas ni deformaciones', 'Ensayo funcional con vaso patrón', None)]),
    dict(prod='Marco posavasos 2HC.885.725 (consignado VWA)',
         fuente='BOM arb 22/09/2026. Sin plan de recepción ni causa propia en el AMFE',
         filas=[('Aspecto', '', 'TBD', 'Visual con patrón', None)]),
    dict(prod='Tornillo fijador 2HC.075.701.GS (consignado VWA)',
         fuente='BOM arb 22/09/2026 + AMFE 150 op 10. Sin plan de recepción de este código',
         filas=[('Largo', '', '12,2 ± 0,5 mm', 'Informe de control del proveedor', None)]),
    dict(prod='Bolsa PP 600 x 500 mm — código 427VAR002TAP01',
         fuente=('Medida corregida en el arb el 24/09/2026 (mail de F. Santoro a D. Rosello "Plasticos Estrada - Nueva Medida"; '
                 'la BOM del legajo del 22/09 todavía dice 520 x 470). Sin plan de recepción'),
         filas=[('Medida', '', '600 x 500 mm', 'Cinta métrica MC406', None)]),
    dict(prod='Etiquetas ET-SATO-100X60 y ET-SATO-50X20',
         fuente='BOM arb 22/09/2026. Sin plan de recepción de estos códigos',
         filas=[('Código', '', 'Según la orden de compra', 'Visual / remito', None)]),
]
