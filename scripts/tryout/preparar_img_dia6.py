# -*- coding: utf-8 -*-
"""Prepara las 6 imagenes que van al deck del Dia 6 a partir de las fotos de Carlos.

Las fotos ORIGINALES son las que mando Carlos por WhatsApp el 08/09/2026; mientras la
tarea estuvo abierta vivieron en el Escritorio, en `Hacer informe tryout`, y al archivarse
la tarea se van con ella (regla escritorio-tareas.md). Si SRC ya no existe, buscar esa
carpeta en el archivo del Escritorio y pasarla como primer argumento.

Las imagenes de salida NO se versionan ni se guardan al lado del entregable: se regeneran
con este script. El 10/09/2026 Windows borro el scratchpad de la sesion con todo adentro,
y lo unico que se salvo fue lo que estaba escrito en un script del repo.

    py scripts/tryout/preparar_img_dia6.py [carpeta_origen] [carpeta_destino]

Las dos capturas de HMI se recortan al MISMO bloque de la pantalla (etiquetas + Valor
Ajuste + Val. Act.), no al encuadre que trae cada foto: la de las 16:02:48 esta tomada mas
de cerca, y con encuadres distintos las filas no se pueden comparar una al lado de la otra.
"""
import os, sys
from PIL import Image

SRC = (sys.argv[1] if len(sys.argv) > 1 else
       r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hacer informe tryout")
OUT = (sys.argv[2] if len(sys.argv) > 2 else
       os.path.join(os.environ.get("TEMP", "."), "tryout_img_dia6"))

# destino, origen, recorte en fracciones (x0, y0, x1, y1); None = la foto entera
TRABAJOS = [
    ("cav4_hundimiento.jpg",  "WhatsApp Image 2026-09-08 at 2.30.05 PM.jpeg", None),
    ("cav3_marcas_vacio.jpg", "WhatsApp Image 2026-09-08 at 2.30.50 PM.jpeg", None),
    ("suplemento_cav4.jpg",   "WhatsApp Image 2026-09-08 at 2.58.58 PM.jpeg", None),
    ("arruga_cav4.jpg",       "WhatsApp Image 2026-09-08 at 2.59.20 PM.jpeg", None),
    # OJO con cual es cual: las dos capturas se mandaron a las 16:02 y Carlos las identifico
    # a las 16:03 — la de 5,3 s es la de ANTES y la de 11,0 s la de AHORA, aunque la de 11,0
    # se haya mandado 7 segundos antes. Lo confirman la pantalla china de las 16:12:48
    # (下模快抽真空延时 = 11.0) y el audio de las 16:17 ("快抽11秒").
    ("hmi_antes.jpg",         "WhatsApp Image 2026-09-08 at 4.02.48 PM.jpeg",   # 5,3 s
     (0.1000, 0.2911, 0.5813, 0.8778)),
    ("hmi_ahora.jpg",         "WhatsApp Image 2026-09-08 at 4.02.41 PM.jpeg",   # 11,0 s
     (0.1938, 0.2056, 0.6563, 0.7778)),
]

os.makedirs(OUT, exist_ok=True)
for dst, src, rec in TRABAJOS:
    ruta = os.path.join(SRC, src)
    if not os.path.exists(ruta):
        raise SystemExit("no esta la foto original: %s" % ruta)
    im = Image.open(ruta)
    W, H = im.size
    if rec is not None:
        x0, y0, x1, y1 = rec
        im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    im.save(os.path.join(OUT, dst), quality=94)
    print("%-24s %s -> %s  (%.4f)" % (dst, (W, H), im.size, im.size[0] / im.size[1]))
print("\nsalida: %s" % OUT)
