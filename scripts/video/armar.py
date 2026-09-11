# -*- coding: utf-8 -*-
"""Une los planos ya corregidos en el video final.

Criterio de montaje (skill editar-video, seccion 5): corte seco DENTRO de cada bloque y
disolvencia corta ENTRE bloques. Nada de transiciones de efecto.

Los cortes secos se hacen con el demuxer concat (`-c copy`, sin recomprimir) y solo las
disolvencias pasan por `xfade`. Los desplazamientos del xfade se calculan de la duracion
REAL medida de cada segmento, no de la nominal: encadenar xfades a mano con offsets
acumulados es donde se rompe todo.

Ademas escribe `armado.json` con las MARCAS del montaje (cuando entra la planta, donde cae
la camara lenta, cuando empieza la placa de cierre). Esas marcas las consume musica.py:
la musica se arma contra el corte, no al reves.
"""
import json, os, subprocess, sys

RAIZ = r"C:\Dev\BarackMercosul"
CLIPS = os.path.join(RAIZ, ".video", "clips")
WORK = os.path.join(RAIZ, ".video", "work")
FFMPEG = (r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe")
FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")

# (nombre del bloque, planos que lo forman, disolvencia en segundos HACIA el bloque siguiente)
BLOQUES = [
    ("b0_apertura",   ["p00_intro"],                             0.70),
    ("b1_maquina",    ["p01", "p02", "p14"],                     0.50),
    ("b2_pieza",      ["p03"],                                   0.45),
    ("b3_retiro",     ["p05", "p06", "p07", "p08", "p09"],       0.45),
    ("b4_control",    ["p10", "p11", "p12"],                     0.45),
    ("b5_terminadas", ["p13"],                                   0.50),
    ("b6_gesto",      ["p15"],                                   0.55),
    ("b7_cierre",     ["p16"],                                   0.70),
    ("b8_marca",      ["p99_outro"],                             None),
]
I_GESTO = 6
I_CIERRE = 8


def dur(f):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", f], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def concatenar(nombre, planos):
    """Cortes secos dentro del bloque, sin recomprimir."""
    destino = os.path.join(WORK, nombre + ".mp4")
    if len(planos) == 1:
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error",
                        "-i", os.path.join(CLIPS, planos[0] + ".mp4"),
                        "-c", "copy", "-y", destino], check=True)
        return destino
    lista = os.path.join(WORK, nombre + ".txt")
    with open(lista, "w", encoding="utf-8") as f:
        for p in planos:
            f.write("file '%s'\n" % os.path.join(CLIPS, p + ".mp4").replace("\\", "/"))
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-f", "concat",
                    "-safe", "0", "-i", lista, "-c", "copy", "-y", destino], check=True)
    return destino


def main():
    segs, duraciones = [], []
    for nombre, planos, _ in BLOQUES:
        for p in planos:
            f = os.path.join(CLIPS, p + ".mp4")
            if not os.path.exists(f):
                raise SystemExit("falta el plano %s (%s)" % (p, f))
        s = concatenar(nombre, planos)
        d = dur(s)
        segs.append(s)
        duraciones.append(d)
        print("%-13s %2d plano(s)  %6.2f s" % (nombre, len(planos), d))

    # cadena de xfade con los desplazamientos acumulados
    filtro, etiqueta, largo = [], "[0:v]", duraciones[0]
    arranque = [0.0]                      # arranque[i] = segundo en que empieza a entrar el bloque i
    for i in range(1, len(segs)):
        tr = BLOQUES[i - 1][2]
        off = largo - tr
        arranque.append(off)
        sal = "[v%d]" % i
        filtro.append("%s[%d:v]xfade=transition=fade:duration=%.3f:offset=%.3f%s"
                      % (etiqueta, i, tr, off, sal))
        largo = largo + duraciones[i] - tr
        etiqueta = sal
        print("   disolvencia %.2f s en %.2f s -> total %.2f s" % (tr, off, largo))

    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error"]
    for s in segs:
        cmd += ["-i", s]
    armado = os.path.join(WORK, "armado.mp4")
    cmd += ["-filter_complex", ";".join(filtro), "-map", etiqueta,
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-r", "25", "-an", "-y", armado]
    subprocess.run(cmd, check=True)

    # Lista COMPLETA de cortes: el segundo en que cambia la imagen, plano por plano, no
    # solo los limites de bloque. La musica la consume para poner un acento en cada uno —
    # es lo que hace que se sienta escrita para este video y no una pista de fondo
    # (Fak, 10/09/2026: *"si logras que la musica coincida con las partes..."*).
    cortes = []
    for i, (nombre, planos, _) in enumerate(BLOQUES):
        t = arranque[i]
        for j, p in enumerate(planos):
            cortes.append(dict(t=round(t, 3), plano=p, bloque=nombre if j == 0 else None))
            t += dur(os.path.join(CLIPS, p + ".mp4"))

    marcas = dict(
        duracion=largo,
        # la planta aparece durante la disolvencia que sale de la placa: el golpe va al medio
        entrada=arranque[1] + BLOQUES[0][2] * 0.5,
        gesto=[arranque[I_GESTO], arranque[I_GESTO] + duraciones[I_GESTO]],
        salida=arranque[I_CIERRE] + BLOQUES[I_CIERRE - 1][2] * 0.5,
        cortes=cortes,
    )
    json.dump(marcas, open(os.path.join(WORK, "armado.json"), "w"), indent=1)
    print("armado: %.2f s -> %s" % (dur(armado), armado))
    print("marcas: entrada %.2f  gesto %.2f-%.2f  salida %.2f"
          % (marcas["entrada"], marcas["gesto"][0], marcas["gesto"][1], marcas["salida"]))


if __name__ == "__main__":
    main()
