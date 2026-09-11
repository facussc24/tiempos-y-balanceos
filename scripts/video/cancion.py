# -*- coding: utf-8 -*-
"""Monta una cancion real a la medida del corte, en vez de sintetizar la cama.

Fak, 11/09/2026: *"usa esa cancion, las tuyas son malisimas"*, y paso el MP3. Asi que la
musica ya no se genera (musica.py): se EDITA. El trabajo pasa a ser de montaje, y el
montaje tiene tres problemas concretos:

1. **Sobra cancion.** El tema dura 144 s y el video 60,8. Hay que sacarle 83 s del medio y
   que no se note. Un pedazo que no entra y sale en el mismo lugar del compas hace tropezar
   la musica, asi que lo primero es medir el compas: 46 compases seguidos de golpes dan
   96,003 s, o sea **2,086893 s por compas = 115,0 BPM exactos**.
2. **El final tiene que caer con el final.** Un video que termina con la musica cortada al
   medio se lee como archivo roto. El tema resuelve a los 137,4 s y la cola muere a los
   139,5: ese pedazo va debajo de la placa de cierre, si o si.
3. **El gesto de Manuel.** Fak, 10/09: *"hacele un poco de edicion al sonido, en la parte de
   Manuel, me gusto eso que hiciste"*. En la version sintetizada eso era un hueco fabricado
   a mano. Aca no hace falta fabricar nada: **la cancion tiene su propio bajon a los
   50,374 s** — todo se cae 10 dB y quedan solo agudos. Se alinea ese bajon con el corte al
   plano del gesto y el efecto lo hace el tema solo, que es mil veces mejor que duckear.

De ahi sale el montaje entero: **dos pedazos y un solo empalme**. El primero va del
arranque del tema hasta pasado el bajon (ahi el bajon cae en el corte del gesto, sin
empalmar nada: es cancion corrida). El segundo es el final del tema, entrando en el compas
en que la imagen vuelve a la prensa. El empalme cae en la parte mas silenciosa de la
cancion y entra en un tiempo fuerte con acento: es donde menos se puede oir.

El nivel NO se toca aca — lo pone master.py a -20 LUFS (AES TD1008 §5), que fue el problema
de la ronda anterior.
"""
import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
FFMPEG = (r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe")

# Un cuadro a 25 fps. El audio va DESPUES del corte, nunca antes: ITU-R BT.1359-1 mide que
# el oido detecta el sonido adelantado a partir de 45 ms y el atrasado recien a los 125.
RETARDO = 0.040

# ---------------------------------------------------------------------------------------
# Todo lo que sigue esta MEDIDO sobre el MP3 que paso Fak (scratchpad/grilla.py y zonas.py),
# no estimado. Si algun dia se cambia de tema, estos cuatro numeros se vuelven a medir.
COMPAS = 2.086893      # s. 115,0 BPM. De 56 compases entre los golpes de 18,454 y 135,320.
BAJON = 50.374         # s. Ahi se cae todo: -15 -> -24 dB, los graves de 30 a 11.
VUELTA = 131.149       # s. Tiempo fuerte con acento, adentro de la ultima seccion entera.
COLA = 139.25          # s. El ultimo acorde cae en 137,41 y la cola llega hasta aca.
# ---------------------------------------------------------------------------------------

CRUCE_SALE = 0.250     # el pedazo que se va sigue sonando debajo del que entra
CRUCE_ENTRA = 0.020    # el que entra sube en 20 ms: no alcanza a ablandar el ataque
ENTRADA = 0.35         # la musica no arranca de golpe sobre la placa del logo


def leer(mp3):
    """El MP3 a 48 kHz estereo. soxr porque el tema viene en 44,1 y el video va en 48."""
    crudo = subprocess.run(
        [FFMPEG, "-v", "error", "-i", mp3, "-ac", "2",
         "-af", "aresample=48000:resampler=soxr:precision=28", "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    x = np.frombuffer(crudo, dtype=np.float32).astype(np.float64).reshape(-1, 2)
    return x[:, 0].copy(), x[:, 1].copy()


def tramo(L, R, a, b):
    i, j = int(round(a * SR)), int(round(b * SR))
    if i < 0 or j > len(L):
        raise SystemExit("la cancion no llega: pedi %.3f a %.3f s y dura %.3f"
                         % (a, b, len(L) / float(SR)))
    return L[i:j].copy(), R[i:j].copy()


def db(x):
    return 20 * np.log10(max(float(np.sqrt(np.mean(x ** 2))), 1e-12))


def construir(mp3, dur, marcas):
    L, R = leer(mp3)
    print("  cancion: %.2f s  (%s)" % (len(L) / float(SR), os.path.basename(mp3)))

    t_gesto, t_fin_gesto = marcas["gesto"]
    cortes = [c["t"] for c in marcas["cortes"]]
    # El corte en que la imagen vuelve a la prensa: el mismo criterio que usaba musica.py.
    t_vuelta = min(cortes, key=lambda t: abs(t - (t_fin_gesto - 0.55)))

    # El bajon de la cancion cae un cuadro despues del corte al plano del gesto.
    g = t_gesto + RETARDO
    v = t_vuelta + RETARDO
    arranque = BAJON - g
    if arranque < 0:
        raise SystemExit("el bajon de la cancion (%.3f s) cae antes que el gesto" % BAJON)

    print("  gesto en %.2f s -> el bajon de la cancion (%.3f s) cae ahi" % (g, BAJON))
    print("  vuelta en %.2f s -> entra el final de la cancion (%.3f s)" % (v, VUELTA))

    # --- pedazo 1: del arranque del tema hasta pasado el bajon. Sin ningun empalme: el
    #     bajon es el propio de la cancion, con su swell de platos entrando.
    p1 = (arranque, arranque + v)
    # --- pedazo 2: el final del tema. Arranca en el tiempo fuerte de la vuelta y llega
    #     hasta la cola, de modo que el ultimo acorde quede debajo de la placa de cierre.
    p2 = (VUELTA, VUELTA + (dur - v))
    if p2[1] > COLA + 0.5:
        print("  AVISO: el pedazo final pide hasta %.2f s y la cola muere en %.2f"
              % (p2[1], COLA))
    for nom, (a, b) in (("pedazo 1", p1), ("pedazo 2", p2)):
        print("  %s: cancion %7.3f -> %7.3f  (%5.2f s = %.2f compases)"
              % (nom, a, b, b - a, (b - a) / COMPAS))

    n = int(round(dur * SR))
    sL, sR = np.zeros(n), np.zeros(n)

    # pedazo 1
    aL, aR = tramo(L, R, p1[0], p1[1] + CRUCE_SALE)      # con cola para cruzar
    k = len(aL)
    corte = int(round(v * SR))
    cola = np.ones(k)
    cola[corte:] = np.linspace(1, 0, k - corte) ** 1.5
    aL, aR = aL * cola, aR * cola
    k = min(k, n)
    sL[:k] += aL[:k]
    sR[:k] += aR[:k]

    # pedazo 2, encima
    bL, bR = tramo(L, R, p2[0], p2[1])
    ent = int(CRUCE_ENTRA * SR)
    bL[:ent] *= np.linspace(0, 1, ent)
    bR[:ent] *= np.linspace(0, 1, ent)
    k = min(len(bL), n - corte)
    sL[corte:corte + k] += bL[:k]
    sR[corte:corte + k] += bR[:k]

    # La musica no arranca de golpe: sube en 0,35 s sobre la placa del logo. Tampoco
    # arranca muda — a los 0,2 s ya se oye (la v3 se comia 2,7 s de silencio absoluto).
    ne = int(ENTRADA * SR)
    sub = np.linspace(0, 1, ne) ** 0.7
    sL[:ne] *= sub
    sR[:ne] *= sub
    # y el ultimo cuarto de segundo baja a cero, para no dejar un click al cortar la cola.
    nf = int(0.25 * SR)
    sL[-nf:] *= np.linspace(1, 0, nf)
    sR[-nf:] *= np.linspace(1, 0, nf)

    print("  empalme en %.2f s: sale a %.1f dB, entra a %.1f dB"
          % (v, db(aL[corte - SR // 4:corte]), db(bL[:SR // 4])))

    # Aire antes de escribir el WAV. Un tema comercial ya viene masterizado tocando 0 dBFS,
    # y remuestrear de 44,1 a 48 kHz sobrepasa ese tope: escrito tal cual, el archivo
    # intermedio recorta y ese recorte queda adentro para siempre. El nivel final no se
    # pierde — master.py lo devuelve por sonoridad (-20 LUFS), no por pico.
    p = max(np.abs(sL).max(), np.abs(sR).max())
    print("  pico del montaje: %.3f (%.1f dBFS) -> lo dejo en -2,0 dBFS para escribirlo"
          % (p, 20 * np.log10(max(p, 1e-9))))
    k = 10 ** (-2.0 / 20.0) / max(p, 1e-9)
    return sL * k, sR * k


def escribir(ruta, L, R):
    y = np.stack([np.clip(L, -1, 1), np.clip(R, -1, 1)], axis=1)
    with wave.open(ruta, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp3")
    ap.add_argument("dur", type=float)
    ap.add_argument("salida")
    ap.add_argument("--marcas", required=True, help="armado.json que deja armar.py")
    a = ap.parse_args()
    marcas = json.load(open(a.marcas, encoding="utf-8"))
    L, R = construir(a.mp3, a.dur, marcas)
    escribir(a.salida, L, R)
    print("  %s  %.2f s  estereo" % (a.salida, len(L) / float(SR)))


if __name__ == "__main__":
    main()
