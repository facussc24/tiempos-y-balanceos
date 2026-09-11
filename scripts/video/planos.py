# -*- coding: utf-8 -*-
"""Arma el institucional a partir del .MOV original.

Cada plano se rinde por separado desde el archivo de camara (nunca desde el proxy), con:
  1. tonemap real de HLG/Dolby Vision a bt709   (sin esto el video sale casi negro)
  2. conformado a 25 fps CFR
  3. correccion de color PROPIA DE ESE PLANO, calculada de las mediciones de
     .video/analisis.csv: negro al piso, medio llevado al mismo objetivo en todos los
     planos y saturacion emparejada. La inconsistencia de color entre planos es de lo
     que mas delata un video amateur.
  4. ruido + nitidez suaves (el material de iPhone 17 ya viene muy nitido: mediana 593
     de laplaciano, asi que aca se afila poco)
  5. el rotulo de la etapa, si el plano abre una

Uso:
    python planos.py listar
    python planos.py render <clave|todos>
"""
import csv, math, os, subprocess, sys

RAIZ = r"C:\Dev\BarackMercosul"
# Por defecto, el master del institucional del 10/09 ya archivado en la biblioteca
# (regla video-maquina.md: el master no se borra). Para otro video: VIDEO_ORIGEN.
ORIGEN = os.environ.get("VIDEO_ORIGEN", os.path.join(
    r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General",
    r"INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\3- INSTITUCIONAL",
    r"2026-09-10 - La prensa y el equipo",
    r"2026-09-10 - INSTITUCIONAL - la prensa y el equipo (IMG_0844).MOV"))
CSV = os.path.join(RAIZ, ".video", "analisis.csv")
SALIDA = os.path.join(RAIZ, ".video", "clips")
FFMPEG = (r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe")

FPS = 25
OBJ_MEDIO = 0.60          # a donde va el medio de TODOS los planos (el material ronda 0.63)
OBJ_SAT = 66.0            # saturacion pareja entre planos
FUENTE = "C\\:/Windows/Fonts/arialbd.ttf"

TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")

# clave, t0, dur (de FUENTE), velocidad, rotulo de etapa (o None), descripcion
#
# `velocidad` es el factor de setpts: 1.0 normal, >1 camara LENTA, <1 camara RAPIDA.
# La duracion en pantalla es dur * velocidad.
#
# ORDEN: es la SECUENCIA del proceso, no una seleccion de planos lindos. Fak, 10/09:
# *"quiero que se entienda como es el proceso... se repetia mucho lo mismo y no entendias
# la secuencia"*. Por eso el corte sigue una sola linea: la maquina -> sale el molde con la
# pieza -> la retiran -> la controlan -> quedan terminadas -> el saludo -> la maquina.
# Dos reglas mas al ordenar:
#  - nada del logo del fabricante de la maquina (proyectado en verde sobre la pared) en el
#    plano de apertura ni en el de cierre: este video es de Barack, no del proveedor;
#  - tramos de la MISMA toma van en orden cronologico y con la accion avanzando (eso se lee
#    como accion condensada); dos tramos con el MISMO encuadre y nada distinto en el medio
#    se leen como un error de continuidad.
#
# LO QUE NO ESTA EN EL MATERIAL: la prensa nunca cierra en los 9:25 (medido: el plato
# superior no baja en ninguna muestra) y nadie aprieta el boton de arranque. Era una puesta
# a punto del molde, no un ciclo de produccion. Eso no se inventa: si hace falta mostrarlo,
# se filman 20 segundos del ciclo y entra aca como un plano mas.
PLANOS = [
    # --- la maquina. Cortita: la primera version abria con 18 s de prensa quieta y ESO era
    #     lo que se sentia repetido. Entra una persona al tercer plano para romperla.
    ("p01", 43.80,  4.4, 1.00, "01   LA PRENSA",      "la prensa por dentro: molde arriba, utillaje abajo"),
    ("p02", 449.80, 3.6, 1.00, None,                  "la prensa completa, con el molde montado"),
    ("p14", 340.00, 3.2, 1.00, None,                  "el operario de buzo Barack, frente a la prensa"),
    # --- la pieza formada. Sale de la misma toma que el plano siguiente (391->405), asi que
    #     encadena solo: la pieza esta en el molde y van a buscarla.
    ("p03", 391.60, 4.8, 1.00, "02   LA PIEZA",       "la pieza ya formada, sobre el utillaje"),
    # --- se retira la pieza. Toda esta parte va ACELERADA, y del 486 al 507 es UNA SOLA
    #     accion continua: asi se lee como una secuencia y no como cinco planos de lo mismo.
    ("p05", 401.00, 4.2, 0.75, "03   SE RETIRA",      "la sacan del molde y la giran en el aire"),
    ("p06", 486.20, 4.2, 0.78, None,                  "el operario la levanta del molde"),
    ("p07", 491.60, 3.8, 0.78, None,                  "la saca de la maquina y se la pasan"),
    ("p08", 496.60, 3.8, 0.72, None,                  "la llevan por la planta"),
    ("p09", 503.40, 3.8, 0.85, None,                  "la apoyan sobre la fila de terminadas"),
    # --- control
    ("p10", 433.40, 4.0, 1.00, "04   CONTROL",        "la operaria levanta la pieza y la mira"),
    ("p11", 442.80, 4.0, 1.00, None,                  "la controla con la herramienta"),
    ("p12", 99.80,  3.6, 1.00, None,                  "comparan dos piezas sobre la mesa"),
    # --- terminadas, el gesto y el cierre
    ("p13", 509.20, 4.6, 1.00, "05   TERMINADAS",     "el equipo sobre la fila de piezas terminadas"),
    ("p15", 521.55, 2.2, 2.50, None,                  "EL GESTO: el OK a camara, en camara lenta"),
    ("p16", 345.60, 5.4, 1.00, None,                  "la prensa, plano de cierre"),
]


def medidas(t0, dur):
    """Promedio de las mediciones del tramo (el CSV tiene una fila por segundo)."""
    filas = []
    with open(CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            t = float(r["t"])
            if t0 - 0.5 <= t <= t0 + dur + 0.5:
                filas.append(r)
    if not filas:
        raise SystemExit("sin mediciones para t=%.1f" % t0)
    med = lambda k: sum(float(x[k]) for x in filas) / len(filas)
    return med("p1"), med("p50"), med("sat"), med("sharp")


def grade(t0, dur):
    p1, p50, sat, sharp = medidas(t0, dur)
    rimin = max(0.0, (p1 - 3.0) / 255.0)          # el piso de negro real, con margen
    rimax = 0.990
    m = (p50 / 255.0 - rimin) / (rimax - rimin)
    m = min(max(m, 0.02), 0.98)
    gamma = math.log(m) / math.log(OBJ_MEDIO)     # eq hace out = in^(1/gamma)
    gamma = min(max(gamma, 0.70), 1.45)
    fsat = min(max(OBJ_SAT / max(sat, 1.0), 0.75), 1.45)
    afilar = 0.42 if sharp < 400 else 0.26        # lo ya nitido casi no se toca
    f = ("colorlevels=rimin=%.4f:gimin=%.4f:bimin=%.4f:rimax=%.3f:gimax=%.3f:bimax=%.3f,"
         "eq=contrast=1.05:saturation=%.3f:gamma=%.3f" % (
             rimin, rimin, rimin, rimax, rimax, rimax, fsat, gamma))
    return f, afilar, (p1, p50, sat, sharp, gamma, fsat)


def rotulo(texto, dur_pantalla):
    """Rotulo de etapa, abajo a la izquierda, con la barrita azul de la marca.

    Va corto y describe LO QUE SE VE, no un dato de proceso: nombrar una operacion, un
    tiempo de ciclo o una certificacion seria contenido tecnico y eso no se inventa
    (core-prohibiciones.md §1, skill editar-video §5).

    Dos trampas de ffmpeg que costaron una vuelta:
      - En `drawbox` las variables `w`/`h` son las de LA CAJA, no las del cuadro: `y=h-158`
        da -94 y la barra se dibuja fuera de pantalla, sin ningun error. Va `ih`.
        En `drawtext`, en cambio, `h` SI es la del cuadro.
      - La planta es muy blanca: texto blanco con sombra no se lee. Va con borde oscuro.
    La barra no tiene opcion de alfa, asi que en vez de fundirla se le anima la ALTURA."""
    t_in = 0.35
    t_out = min(3.2, max(t_in + 0.8, dur_pantalla - 0.4))
    alfa = ("if(lt(t,%(a).2f),t/%(a).2f,if(lt(t,%(b).2f),1,max(0,(%(c).2f-t)/0.45)))"
            % dict(a=t_in, b=t_out, c=t_out + 0.45))
    crece = ("64*min(1\\,max(0\\,(t-0.20)/0.30))*min(1\\,max(0\\,(%.2f-t)/0.35))"
             % (t_out + 0.45))
    barra = "drawbox=x=88:y=ih-158:w=10:h=%s:color=0x005194@0.95:t=fill" % crece
    txt = ("drawtext=fontfile='%s':text='%s':x=120:y=h-150:fontsize=46:fontcolor=white:"
           "borderw=4:bordercolor=0x102A3F@0.90:alpha='%s'"
           % (FUENTE, texto, alfa))
    return barra + "," + txt


def cadena(t0, dur, vel, texto):
    g, afilar, _ = grade(t0, dur)
    partes = [TONEMAP, "fps=%d" % FPS, "scale=1920:1080:flags=lanczos",
              "hqdn3d=1.6:1.2:2.6:2.2", g, "cas=strength=%.2f" % afilar]
    if vel > 1.0:
        # camara lenta: sin interpolar se ve a tirones (repite cuadros)
        partes += ["setpts=%.4f*PTS" % vel,
                   "minterpolate=fps=%d:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" % FPS]
    elif vel < 1.0:
        # camara rapida: alcanza con tirar cuadros, pero hay que volver a fijar el CFR
        partes += ["setpts=%.4f*PTS" % vel, "fps=%d" % FPS]
    if texto:
        partes.append(rotulo(texto, dur * vel))
    return ",".join(partes)


def render(clave):
    for c, t0, dur, vel, texto, desc in PLANOS:
        if clave not in ("todos", c):
            continue
        _, _, m = grade(t0, dur)
        dst = os.path.join(SALIDA, c + ".mp4")
        print("%s  t=%.2f dur=%.1f vel=%.2f (%.2f s)  p1=%.1f p50=%.1f sat=%.1f sharp=%.0f "
              "-> gamma=%.3f sat x%.2f\n     %s" % (
                  c, t0, dur, vel, dur * vel, m[0], m[1], m[2], m[3], m[4], m[5], desc),
              flush=True)
        cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", "%.3f" % t0,
               "-t", "%.3f" % dur, "-i", ORIGEN, "-vf", cadena(t0, dur, vel, texto),
               "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
               "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
               "-an", "-y", dst]
        subprocess.run(cmd, check=True)
        print("     -> %s" % dst, flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "listar":
        tot = 0.0
        for c, t0, dur, vel, texto, desc in PLANOS:
            d = dur * vel
            tot += d
            print("%s  %5.2f s  (fuente %7.2f-%7.2f  x%.2f)  %-16s %s" % (
                c, d, t0, t0 + dur, 1 / vel, texto or "", desc))
        print("total planos: %.1f s (sin placas ni disolvencias)" % tot)
    else:
        os.makedirs(SALIDA, exist_ok=True)
        render(sys.argv[2])
