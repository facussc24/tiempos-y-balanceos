# -*- coding: utf-8 -*-
"""Pone la musica a la medida exacta del armado y saca el master de entrega.

La musica se arma CONTRA EL CORTE: armar.py deja en armado.json el segundo en que entra la
planta, el tramo del gesto y el arranque de la placa de cierre, y esas marcas mandan.
Con `--cancion` se monta un tema real a esa medida (cancion.py) — es lo que se entrega
desde el 11/09/2026, con el MP3 que eligio Fak. Sin `--cancion` la cama se sintetiza
(musica.py): no lleva ningun sample ni pista de terceros, asi que no depende de la licencia
de nadie, pero Fak la rechazo.

H.264 en MP4 (no HEVC): el que lo abre es alguien con un Windows cualquiera, y HEVC puede
pedirle un codec de la Store. `+faststart` deja el indice al principio, para que empiece a
verse sin bajarlo entero desde OneDrive o WeTransfer.
"""
import argparse, json, os, subprocess, sys

RAIZ = r"C:\Dev\BarackMercosul"
WORK = os.path.join(RAIZ, ".video", "work")
AQUI = os.path.dirname(os.path.abspath(__file__))
FFMPEG = (r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe")
FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")


# -20 LUFS. El numero NO sale de mi criterio: AES TD1008 §5 pone ese piso para material
# que se reproduce SIN normalizacion de plataforma, y este video se manda como ARCHIVO —
# lo abre el reproductor del celular o de Windows, que no normalizan nada. EBU R128 s2 §g
# sanciona el rango -20 a -16 LUFS para ese caso. La v3 salio a -15,5 (altura de un master
# de Spotify) y Fak, 10/09/2026: *"tiene el volumen al maximo, despertar a toda su
# familia"*. -4,5 dB se perciben como ~27% menos fuerte, muy por encima del umbral de 1 dB.
OBJETIVO_LUFS = -20.0
PICO_MAX = -4.0           # techo del limitador. NO es el pico del entregable: el AAC
                          # agrega sobrepico entre muestras (medido: hasta +2,2 dB), y
                          # con -2,0 el master salio en +0,2 dBFS, o sea recortando.
                          # Con -4,0 el entregable queda cerca de -1,8 dBTP, que es lo que
                          # pide EBU R128 §m (-1 dBTP) con margen extra por la recodificacion
                          # de WhatsApp (AES TD1008 §7B: bajar el umbral si baja el bitrate).


def dur(f):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", f], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def sonoridad(f):
    """(LUFS integrados, pico real en dBFS) segun EBU R128. Se MIDE, no se supone: el
    mismo pico normalizado da LUFS muy distintos segun cuanta energia sostenida tenga la
    mezcla — la version con bateria y pluck midio 4 dB menos que la de pad largo."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", f,
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    lufs = pico = None
    lineas = r.stderr.splitlines()
    for i, l in enumerate(lineas):
        if "Integrated loudness" in l:
            for j in lineas[i + 1:i + 3]:
                if j.strip().startswith("I:"):
                    lufs = float(j.split()[1])
        if "True peak" in l:
            for j in lineas[i + 1:i + 3]:
                if j.strip().startswith("Peak:"):
                    pico = float(j.split()[1])
    if lufs is None or pico is None:
        raise SystemExit("no pude medir la sonoridad de %s" % f)
    return lufs, pico


def main(destino, cancion=None):
    armado = os.path.join(WORK, "armado.mp4")
    d = dur(armado)
    marcas = json.load(open(os.path.join(WORK, "armado.json")))
    print("armado: %.2f s   entrada %.2f  gesto %.2f-%.2f  salida %.2f"
          % (d, marcas["entrada"], marcas["gesto"][0], marcas["gesto"][1], marcas["salida"]))

    musica = os.path.join(WORK, "musica.wav")
    # Dos caminos. Con --cancion se MONTA un tema real a la medida del corte (cancion.py);
    # sin el, se SINTETIZA la cama (musica.py). Fak eligio el tema el 11/09/2026 — *"usa
    # esa cancion, las tuyas son malisimas"* — asi que el camino vivo es el primero; el
    # sintetizado queda porque no depende de la licencia de nadie.
    # Los dos leen el armado.json entero: no les alcanza con tres marcas sueltas, necesitan
    # la lista completa de cortes.
    if cancion:
        orden = [sys.executable, os.path.join(AQUI, "cancion.py"), cancion, "%.2f" % d, musica]
    else:
        orden = [sys.executable, os.path.join(AQUI, "musica.py"), "%.2f" % d, musica]
    subprocess.run(orden + ["--marcas", os.path.join(WORK, "armado.json")], check=True)

    lufs, pico = sonoridad(musica)
    ganancia = OBJETIVO_LUFS - lufs
    # La ganancia la fija la SONORIDAD, no el pico: recortarla por el pico deja la cama
    # 1,5 dB por debajo del objetivo. El pico lo sostiene un limitador, que es lo que
    # corresponde — una mezcla con bateria tiene picos altos y poca energia sostenida.
    tope = 10 ** (PICO_MAX / 20.0)
    filtro_audio = ("volume=%.2fdB,alimiter=limit=%.4f:attack=1:release=60:level=disabled"
                    % (ganancia, tope))
    print("musica: %.1f LUFS, pico %.1f dBFS  ->  ganancia %+.1f dB + limitador a %.1f dBFS"
          % (lufs, pico, ganancia, PICO_MAX))

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    # Los tres tags de color se escriben por x264: con -color_trc/-color_primaries solos
    # el archivo sale con transfer y primaries "unknown".
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error",
                    "-i", armado, "-i", musica,
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                    "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
                    "-af", filtro_audio,
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                    "-shortest", "-movflags", "+faststart", "-y", destino], check=True)
    lf, pk = sonoridad(destino)
    print("master: %.2f s  %.1f MB  %.1f LUFS  pico %.1f dBFS -> %s" % (
        dur(destino), os.path.getsize(destino) / 1e6, lf, pk, destino))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("destino")
    ap.add_argument("--cancion", help="MP3/WAV real para montar en vez de sintetizar la cama")
    a = ap.parse_args()
    main(a.destino, a.cancion)
