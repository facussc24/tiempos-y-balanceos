# -*- coding: utf-8 -*-
"""Fotos base de las hojas de proceso de la PRENSA DE EMBOSSING Jfortune (Upper Trim).

De donde sale cada foto (24/09/2026):
  - el MANUAL del proveedor (`Suzhou Jfortune machine manual.pdf`, carpeta del try out):
    sus fotos traen la pantalla legible. En el video la pantalla sale quemada, blanca.
  - el VIDEO del proveedor (`preview.mp4`, 544x960, subtitulado en ingles): para el ciclo
    con la pieza, que el manual no muestra.

Cada archivo guarda ADENTRO de donde salio (fotodevideo.guardar): documento, pagina,
figura, rotacion y recorte; o video y segundo. Sin eso es un huerfano.

    py -3 scripts/embossing/preparar_fotos.py            # arma assets/ desde las fuentes
"""
import json
import os
import subprocess
import sys

import fitz
from PIL import Image
import io

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", ".."))
SK = os.path.join(REPO, ".claude", "skills", "hojas-de-proceso", "scripts")
sys.path.insert(0, SK)
from fotodevideo import guardar  # noqa: E402

ASSETS = os.path.join(AQUI, "assets")

TRY_OUT = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\COZZUOL"
           r"\00_VW427-1LA_K-PATAGONIA\00- Upper Trimming\_BACKUP_UpperTrim_2026-07-01\APQP"
           r"\28- Corrida de Produccion\01- Try Out Embossing Machine JFortune")
MANUAL = os.path.join(TRY_OUT, "Suzhou Jfortune machine manual.pdf")
VIDEO = os.path.join(TRY_OUT, "preview.mp4")

# (archivo, pagina del manual, indice de imagen en la pagina, medida esperada, figura,
#  rotacion antihoraria, recorte en px sobre la imagen YA girada, que se ve)
DEL_MANUAL = [
    ("m_tablero.jpg", 4, 2, (608, 694), "Fig. 1", 0, (0, 60, 608, 694),
     "tablero: controlador de temperatura, parada de emergencia, pantalla y botonera"),
    ("m_pantalla_operacion.jpg", 4, 3, (694, 1048), "Fig. 2", 90, (118, 148, 982, 652),
     "pantalla de operacion, foto del proveedor"),
    ("m_bimanual.jpg", 4, 4, (527, 657), "Fig. 3", 0, (0, 0, 406, 657),
     "las dos manos en los botones naranjas del mando bimanual"),
    ("m_parametros.jpg", 4, 1, (625, 908), "Fig. 4", 90, (118, 105, 832, 535),
     "pantalla de ajuste de parametros, foto del proveedor"),
    ("m_temperatura.jpg", 5, 1, (580, 879), "foto unica", 90, (360, 190, 820, 578),
     "controlador de temperatura XMTD-6000 y parada de emergencia"),
    # recortada desde y=168: arriba del plato hay un atado de cigarrillos (ajeno)
    ("m_molde_tornillos.jpg", 6, 3, (954, 583), "Fig. 3", 0, (100, 168, 830, 530),
     "molde apoyado sobre la pieza (la figura de los cuatro tornillos)"),
    ("m_molde_conector.jpg", 6, 4, (576, 609), "Fig. 4", 0, (150, 0, 480, 540),
     "el conector redondo tipo aviacion de atras"),
    ("m_molde.jpg", 7, 1, (924, 693), "Fig. 1", 0, (240, 40, 800, 640),
     "el molde calefaccionado con su cable, colgado del plato"),
    # la de la pag. 6 Fig. 3 tiene un paquete ajeno arriba de la prensa: la portada va con
    # la de la pag. 2, que muestra la maquina entera (columna, molde, bimanual y tablero)
    ("m_portada.jpg", 2, 3, (630, 1299), "Presentacion del equipo", 0, (0, 40, 630, 1260),
     "la prensa entera: columna, molde, botones naranjas del bimanual y tablero"),
    # la misma pantalla que la Fig. 2 de la pag. 4 (mismo archivo, md5 igual), recortada a
    # la mitad derecha: el selector y el recuadro de modo manual con BAJAR / SUBIR
    ("m_pantalla_manual.jpg", 6, 1, (694, 1048), "Fig. 1", 90, (657, 148, 964, 652),
     "pantalla de operacion, mitad derecha: selector y recuadro de modo manual"),
]

# Rotulado: (sale, entra, marcas). Sin ideogramas: el EXIF de un JPG es ASCII y los guarda
# como "??" (24/09/2026). Las marcas son x,y,w,h en % de la foto, MEDIDAS sobre la
# foto con grilla (24/09/2026), o por color. El numero del rotulo ES el numero del paso.
ROTULOS = [
    ("r1_tablero.jpg", "m_tablero.jpg", [
        "81,76,13,15|Llave general",
        "color:verde|Boton verde de arranque",
        "35,29,47,28|Pantalla",
        "63,77,12,14|Boton rojo",
        "49,7,15,14|Parada de emergencia"]),
    ("r2_temperatura.jpg", "m_temperatura.jpg", [
        "36,20,30,22|Temperatura real (PV, rojo) y seteada (SV, verde)",
        "33,46,9,10|SET",
        "42,45.5,8.5,9.5|Cambio de digito",
        "51,44.5,8.5,9.5|Bajar",
        "60,43.5,8.5,9.5|Subir"]),
    ("r3_pantalla.jpg", "m_pantalla_operacion.jpg", [
        "41,14,14,22|Selector MANUAL / AUTOMATICO",
        "44,38,16,13|VOLVER A ORIGEN",
        "13,66,17,13|PONER A CERO"]),
    ("r5_parametros.jpg", "m_parametros.jpg", [
        "30,24,40,10.5|Posicion rapida",
        "30,35.5,40,10|Velocidad rapida",
        "30,47,40,10|Posicion lenta",
        "30,58,40,10|Velocidad lenta",
        "30,69.5,40,10.5|Tiempo de presion"]),
    ("s1_selector_manual.jpg", "m_pantalla_operacion.jpg", [
        "41,14,14,22|Selector MANUAL / AUTOMATICO"]),
    ("s2_bajar.jpg", "m_pantalla_operacion.jpg", [
        "76,59,14,13|BAJAR"]),
    ("s6_subir.jpg", "m_pantalla_manual.jpg", [
        "41,73,37,13|SUBIR"]),
]

# (archivo, segundo, recorte en % x,y,w,h, que se ve)
DEL_VIDEO = [
    ("v_retirar.jpg", 60.5, "0,0,77,72", "la mano en la pieza, debajo del molde, con el plato arriba"),
    ("v_colocar.jpg", 69.5, "0,0,77,72", "las manos llevan la pieza siguiente debajo del molde"),
]


def imagen_del_manual(doc, pagina, indice):
    p = doc[pagina - 1]
    xs = p.get_images(full=True)
    datos = doc.extract_image(xs[indice][0])
    return Image.open(io.BytesIO(datos["image"])).convert("RGB")


def main():
    os.makedirs(ASSETS, exist_ok=True)
    doc = fitz.open(MANUAL)
    for arch, pag, idx, medida, fig, rot, crop, nota in DEL_MANUAL:
        im = imagen_del_manual(doc, pag, idx)
        if im.size != medida:
            raise SystemExit(f"{arch}: la imagen {idx} de la pagina {pag} mide {im.size}, "
                             f"esperaba {medida}. El manual cambio: revisar antes de seguir.")
        if rot:
            im = im.rotate(rot, expand=True)
        if crop:
            im = im.crop(crop)
        origen = json.dumps({"documento": os.path.basename(MANUAL), "pagina": pag,
                             "figura": fig, "rot": rot, "crop_px": list(crop or ()),
                             "nota": nota}, ensure_ascii=False)
        guardar(im, os.path.join(ASSETS, arch), origen)
        print(f"{arch:28s} {im.size[0]}x{im.size[1]}  manual pag {pag} {fig}")

    fdv = os.path.join(SK, "fotodevideo.py")
    for arch, seg, crop, nota in DEL_VIDEO:
        r = subprocess.run([sys.executable, fdv, "sacar", "--video", VIDEO, "--seg", str(seg),
                            "--radio", "0.25", "--crop", crop,
                            "--out", os.path.join(ASSETS, arch), "--nota", nota],
                           capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())
        if r.returncode:
            raise SystemExit(f"{arch}: fotodevideo fallo")

    rot = os.path.join(SK, "rotular.py")
    for sale, entra, marcas in ROTULOS:
        cmd = [sys.executable, rot, "--foto", os.path.join(ASSETS, entra),
               "--out", os.path.join(ASSETS, sale), "--banda", "ninguna", "--ancho", "1200"]
        for m in marcas:
            cmd += ["--marca", m]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        print((r.stdout.strip() or r.stderr.strip()).splitlines()[-1])
        if r.returncode:
            print(r.stderr)
            raise SystemExit(f"{sale}: rotular fallo")


if __name__ == "__main__":
    main()
