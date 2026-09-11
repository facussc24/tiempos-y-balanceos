# -*- coding: utf-8 -*-
"""Cama musical original para los institucionales de Barack — version 4.

Sintetizada de cero con numpy/scipy: no lleva sample, loop ni pista de terceros, asi que el
video se puede mostrar y mandar sin problema de derechos. Lo unico grabado son GOLPES DE LA
PRENSA sacados del propio master (golpes_prensa.wav), que acá quedan como un color suave en
los cortes de seccion, no como percusion.

POR QUE ESTA VERSION. Fak, 10/09/2026, sobre la v3: *"le llego a mandar eso a mi dueño y
tiene el volumen al maximo... una musiquita tranquilita, suavecita, bajar el volumen, asi
por mas que tenga yo el volumen al cien no avanza tan fuerte"*, y despues: *"busca ejemplos
reales de YouTube, de Volkswagen, de Ford"* y *"el canal se llama Morning Light Music, el
video es 'inspiring and uplifting background music for videos and presentations'"*.

O sea: se midio la REFERENCIA REAL en vez de discutir. Se bajaron 5 temas del canal que
nombro Fak y 8 institucionales oficiales (Ford, Renault, Bosch, Siemens, TRUMPF, VW Group)
y se les midio lo mismo que a la mia. Los que son SOLO MUSICA (sin locucion) dieron:

    parametro          referencias        v3 (rechazada)     objetivo v4
    mediana espectral  54 - 135 Hz            479 Hz          90 - 150 Hz
    energia <120 Hz    44 - 75 %               14 %           50 - 60 %
    energia 400-3k     9 - 24 %                49 %           15 - 25 %
    energia 3k-8k      0,2 - 2,3 %            4,7 %           <= 2 %
    LRA                2,1 - 7,4 LU           6,8 LU          3 - 5 LU
    tempo              60 - 129 BPM           101 BPM         101 BPM (no era el problema)

Las tres cosas que estaban mal, en orden de cuanto se notan:

  1. LA MEZCLA VIVIA EN EL MEDIO. La mediana espectral daba 479 Hz contra 54-135 Hz de
     todas las referencias: mi musica tenia la energia justo en la banda donde el oido es
     mas sensible, y por eso "sonaba al maximo" aunque el numero de LUFS fuera normal. Las
     referencias se apoyan ABAJO (la mitad de la energia por debajo de 120 Hz) y dejan el
     medio casi vacio. Peor: en la v3 yo habia subido el gancho una octava a proposito,
     moviendo la mediana de 329 a 479 Hz — corregi en la direccion contraria porque elegi
     el numero objetivo de mi cabeza en vez de medir un tema real.
  2. HABIA BATERIA. Bombo en cada negra, golpes de prensa en el 2 y el 4, y charles en
     semicorcheas. Lo que sube la energia percibida de una pista no es el tempo: es cuan
     marcado esta el pulso. Afuera los tres. Queda un latido suave en el 1 y el 3, filtrado
     a 110 Hz, sin click.
  3. ESTABA 4,5 dB FUERTE Y CON DEMASIADO ARCO. La entrega va a -20 LUFS (AES TD1008 §5
     pone ese piso para material que se reproduce SIN normalizacion de plataforma, que es
     este caso: un archivo que se abre en el reproductor del celular). El arco baja de 10 a
     4,5 dB, para que el maximo short-term no pase el objetivo +5 LU (EBU R128 s1 §d).

Lo que NO se toco, porque funcionaba:

  EL TEMPO SALE DEL CORTE. No se elige un BPM lindo: se toma el compas que hace caer el
  GESTO exactamente en una linea de compas, y de ahi sale todo (aca dan 101 BPM). Las
  referencias van de 60 a 129 BPM, asi que 101 esta adentro: el tempo nunca fue el problema
  y cambiarlo habria tirado abajo toda la sincronizacion.

  EL GESTO TIENE SU EFECTO — Fak lo pidio de nuevo: *"en la parte de Manuel me gusto eso
  que hiciste"*. Se conserva el "stopdown" (la musica se corta 0,24 s antes y queda el
  aire), pero lo que cae en el cuadro ya no es un impacto de cinco capas con click y metal:
  es una FLORACION grave — un swell invertido, el acorde que vuelve con ataque lento y la
  cola del hall abierta. Misma figura, sin el golpe.

  NINGUN GOLPE VA ADELANTADO. ITU-R BT.1359-1: el oido detecta el audio adelantado a partir
  de 45 ms y el atrasado recien a los 125 ms. Por eso la grilla entera va corrida 40 ms
  (un cuadro) DESPUES del corte: nunca antes.

Uso:
    python musica.py <segundos> <salida.wav> --marcas <armado.json>
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 48000
AQUI = os.path.dirname(os.path.abspath(__file__))

# Un cuadro a 25 fps. La grilla se corre esto DESPUES del corte (ITU-R BT.1359-1: el audio
# atrasado tolera 125 ms y el adelantado solo 45).
RETARDO = 0.040
# Compases desde que entra la planta hasta el gesto. De aca sale el tempo: es el numero que
# deja el gesto en una linea de compas y da 101 BPM, adentro de la banda 60-129 que midieron
# las referencias.
COMPASES_AL_GESTO = 19


# --------------------------------------------------------------------------- utilitarios
def nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def cents(f, c):
    return f * 2 ** (c / 1200.0)


def pasaaltos(x, fc, orden=2):
    return sosfilt(butter(orden, min(fc / (SR / 2.0), 0.99), "highpass", output="sos"), x)


def pasabajos(x, fc, orden=2):
    return sosfilt(butter(orden, min(fc / (SR / 2.0), 0.99), "lowpass", output="sos"), x)


def pasabanda(x, f1, f2, orden=2):
    lo = max(f1 / (SR / 2.0), 1e-4)
    hi = min(f2 / (SR / 2.0), 0.99)
    return sosfilt(butter(orden, [lo, hi], "bandpass", output="sos"), x)


def env_perc(n, ataque, tau):
    """Ataque lineal + caida exponencial. El ataque largo es lo que separa un instrumento
    'suave' de uno percusivo: el tiempo de ataque es una de las dimensiones del timbre, y un
    ataque corto se lee como agresivo."""
    t = np.arange(n) / float(SR)
    e = np.exp(-t / tau)
    na = max(2, int(ataque * SR))
    if na < n:
        e[:na] *= np.linspace(0, 1, na) ** 1.5
    return e


def env_asr(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.4
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.4
    return e


def sumar(dst, i0, x, g=1.0):
    """Suma x en dst desde la muestra i0, recortando lo que se sale."""
    i0 = int(i0)
    if i0 >= len(dst):
        return
    if i0 < 0:
        x = x[-i0:]
        i0 = 0
    l = min(len(x), len(dst) - i0)
    if l > 0:
        dst[i0:i0 + l] += x[:l] * g


def ir_reverb(rt60, predelay, corte_agudo=6000.0, semilla=7):
    """Respuesta de sala a la Moorer: ruido por una exponencial, banda por banda, con los
    agudos cayendo antes que los graves (que es lo que hace una sala real). Se normaliza por
    ENERGIA, no por pico: normalizar por pico cambia el nivel del envio segun el RT60."""
    rng = np.random.default_rng(semilla)
    n = int(rt60 * 1.6 * SR)
    t = np.arange(n) / float(SR)
    ir = np.zeros(n)
    for f1, f2, k in ((60, 250, 1.00), (250, 1000, 0.90), (1000, 3000, 0.70),
                      (3000, corte_agudo, 0.45)):
        if f1 >= SR / 2:
            break
        r = pasabanda(rng.standard_normal(n), f1, min(f2, SR / 2 - 100))
        ir += r * np.exp(-6.9078 * t / (rt60 * k))
    np_ = int(predelay * SR)
    ir = np.concatenate([np.zeros(np_), ir])
    return ir / math.sqrt(max((ir ** 2).sum(), 1e-12))


def conv(x, ir):
    return fftconvolve(x, ir)[:len(x)]


def saturar(x, drive=2.0, asim=0.0):
    """tanh SOBREMUESTREADO 4x. Sin sobremuestrear, los armonicos que genera se pliegan
    arriba de Nyquist y vuelven como frecuencias que no son armonicas de nada: ese plegado
    ES el sonido 'digital barato'."""
    y = resample_poly(x, 4, 1)
    y = np.tanh(drive * y + asim * drive * y * y) / math.tanh(drive)
    return resample_poly(y, 1, 4)[:len(x)]


# ------------------------------------------------------------------- ecualizacion (RBJ)
def _sos_cookbook(b0, b1, b2, a0, a1, a2):
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def estante(x, fc, db, alto=True, S=0.8):
    if abs(db) < 0.05:
        return x
    A = 10 ** (db / 40.0)
    w = 2 * math.pi * fc / SR
    cw, sw = math.cos(w), math.sin(w)
    al = sw / 2.0 * math.sqrt((A + 1 / A) * (1 / S - 1) + 2)
    r = 2 * math.sqrt(A) * al
    if alto:
        return sosfilt(_sos_cookbook(
            A * ((A + 1) + (A - 1) * cw + r), -2 * A * ((A - 1) + (A + 1) * cw),
            A * ((A + 1) + (A - 1) * cw - r),
            (A + 1) - (A - 1) * cw + r, 2 * ((A - 1) - (A + 1) * cw),
            (A + 1) - (A - 1) * cw - r), x)
    return sosfilt(_sos_cookbook(
        A * ((A + 1) - (A - 1) * cw + r), 2 * A * ((A - 1) - (A + 1) * cw),
        A * ((A + 1) - (A - 1) * cw - r),
        (A + 1) + (A - 1) * cw + r, -2 * ((A - 1) + (A + 1) * cw),
        (A + 1) + (A - 1) * cw - r), x)


def campana(x, fc, db, Q=0.8):
    if abs(db) < 0.05:
        return x
    A = 10 ** (db / 40.0)
    w = 2 * math.pi * fc / SR
    al = math.sin(w) / (2 * Q)
    cw = math.cos(w)
    return sosfilt(_sos_cookbook(1 + al * A, -2 * cw, 1 - al * A,
                                 1 + al / A, -2 * cw, 1 - al / A), x)


# Objetivo de reparto por banda. NO sale de mi criterio: es la mediana de lo que midieron
# las referencias que nombro Fak (5 temas de Morning Light Music) y los institucionales
# oficiales que son solo musica (TRUMPF, VW Group, Siemens). Una cama corporativa se apoya
# ABAJO y deja vacio el medio, que es donde el oido es mas sensible; la v3 hacia lo
# contrario y por eso "sonaba al maximo".
OBJETIVO = [(0, 120, 55.0), (120, 400, 20.0), (400, 1200, 13.0),
            (1200, 3500, 8.0), (3500, 8000, 3.0), (8000, 20000, 1.0)]
TOPE_CORRECCION = 5.0


def reparto(x):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    tot = max(X.sum(), 1e-30)
    med = f[np.searchsorted(np.cumsum(X) / tot, 0.5)]
    return [100 * X[(f >= a) & (f < b)].sum() / tot for a, b, _ in OBJETIVO], float(med)


def corregir_espectro(L, R):
    """Mide el reparto real y lo acerca al objetivo con tres etapas, topeadas en 5 dB.
    Si hiciera falta mas de 5 dB el problema es del arreglo, no de la ecualizacion."""
    r, med = reparto((L + R) / 2.0)
    print("  espectro antes:  " + " ".join("%.0f%%" % v for v in r)
          + "   mediana %.0f Hz" % med)

    def falta(i):
        return max(-TOPE_CORRECCION, min(TOPE_CORRECCION,
                                         10 * math.log10(OBJETIVO[i][2] / max(r[i], 0.05))))
    etapas = [("estante", 170.0, falta(0), False),
              ("campana", 700.0, falta(2), None),
              ("estante", 3500.0, (falta(4) + falta(5)) / 2.0, True)]
    for tipo, fc, db, alto in etapas:
        print("     %-8s %6.0f Hz  %+5.1f dB" % (tipo, fc, db))
        if tipo == "estante":
            L, R = estante(L, fc, db, alto), estante(R, fc, db, alto)
        else:
            L, R = campana(L, fc, db), campana(R, fc, db)
    r, med = reparto((L + R) / 2.0)
    print("  espectro despues:" + " ".join("%.0f%%" % v for v in r)
          + "   mediana %.0f Hz" % med)
    return L, R


def comp_bus(x, umbral_db=-20.0, ratio=1.6, atk=0.030, rel=0.250, tope_gr=1.5):
    """Compresion de pegamento, muy suave. En una cama tranquila el compresor junta, no
    aplasta: 1,5 dB de reduccion como tope. Detector RMS de un polo, asimetrico."""
    a_at = math.exp(-1.0 / (atk * SR))
    a_re = math.exp(-1.0 / (rel * SR))
    env = np.empty(len(x))
    y = 0.0
    for i, v in enumerate(np.abs(x)):
        a = a_at if v > y else a_re
        y = a * y + (1 - a) * v
        env[i] = y
    nivel = 20 * np.log10(env + 1e-9)
    exceso = np.maximum(nivel - umbral_db, 0.0)
    gr = -np.minimum(exceso * (1 - 1.0 / ratio), tope_gr)
    k = int(0.015 * SR)
    v = np.hanning(k)
    gr = np.convolve(gr, v / v.sum(), mode="same")
    return x * 10 ** (gr / 20.0), float(-gr.min())


def limitar(x, techo=0.85, lookahead=0.006):
    """Limitador con lookahead: la ganancia se erosiona con un filtro de MINIMO sobre la
    ventana de anticipacion, asi ya esta baja cuando llega el pico, y despues se suaviza.
    El suavizado es lo que lo separa de un recortador."""
    pico = np.abs(x)
    n = max(4, int(lookahead * SR))
    g = np.minimum(1.0, techo / np.maximum(pico, 1e-9))
    m = g.copy()
    for d in (n // 2, n):
        m = np.minimum(m, np.concatenate([g[d:], np.ones(d)]))
        m = np.minimum(m, np.concatenate([np.ones(d), g[:-d]]))
    v = np.hanning(2 * n + 1)
    m = np.convolve(m, v / v.sum(), mode="same")
    return x * np.minimum(m, 1.0)


def side_mono_abajo(L, R, fc=120.0):
    """Abajo de ~120 Hz el oido no localiza y ensanchar solo trae cancelacion de fase: el
    canal Side se pasa-altos y el grave queda mono. Con una mezcla apoyada abajo esto pesa
    mas que antes: si el grave no es mono, en un parlante de celular se cancela."""
    M, S = (L + R) / 2.0, (L - R) / 2.0
    S = pasaaltos(S, fc, 2)
    return M + S, M - S


# --------------------------------------------------------------------------- los golpes
def cargar_golpes():
    """Los cinco golpes de la prensa, del propio master. Cada uno sale de un plano donde en
    cuadro esta SOLO la maquina (verificado mirando el fotograma): nadie hablando, nadie
    cerca del microfono. En la v3 hacian de bateria en el 2 y el 4 — eso es justo lo que
    volvia agitada la pista. Aca quedan como un color grave y lejano en tres cortes de
    seccion: la maquina sigue estando en la musica, pero no marca el pulso."""
    ruta = os.path.join(AQUI, "golpes_prensa.wav")
    with wave.open(ruta, "rb") as w:
        crudo = w.readframes(w.getnframes())
    x = np.frombuffer(crudo, dtype="<i2").astype(np.float64) / 32768.0
    n = 21600                                  # 0,45 s cada uno
    nombres = ["seco", "seco2", "cuerpo", "brillo", "brillo2"]
    return {nom: x[i * n:(i + 1) * n].copy() for i, nom in enumerate(nombres)}


# --------------------------------------------------------------------------- voces
def mallet(f, n, rng, tau=0.55, ataque=0.008, brillo=1.0):
    """El gancho: marimba de fieltro. Las barras se afinan a la relacion 1 : 4 : 10, pero
    aca los dos parciales de arriba van MUY abajo (0,20 y 0,07 contra 0,42 y 0,16 de la
    v3): son ellos los que ponen energia en 1,5-4 kHz, que es la banda que la volvia dura.
    Ataque de 8 ms en vez de 2, caida de 0,55 s en vez de 0,18 y sin ruido de mazo: eso es
    la diferencia entre 'percusivo' y 'suave'."""
    t = np.arange(n) / float(SR)
    # cada nota afina distinto y arranca en otra fase: sin esto dos notas iguales salen
    # identicas y suena a ametralladora
    f = cents(f, rng.normal(0, 1.5))
    fase = rng.uniform(0, 2 * math.pi, 3)
    v = 1.00 * np.sin(2 * math.pi * f * t + fase[0])
    for k, (ratio, amp) in enumerate(((4.00, 0.20), (9.80, 0.070)), start=1):
        # guarda de Nyquist: un parcial arriba de 24 kHz vuelve PLEGADO como una frecuencia
        # que no es armonica de nada, y ese plegado es el sonido "digital barato"
        if f * ratio < 18000.0:
            v += amp * brillo * np.sin(2 * math.pi * f * ratio * t + fase[k])
    v *= env_perc(n, ataque, tau * rng.uniform(0.95, 1.05))
    return pasabajos(v, 17000.0, 2)


def sierras(f, n, rng):
    """Pad. Siete sierras como el supersaw del JP-8000, con los ratios asimetricos que
    midio Szabo y la perilla al medio (x0,0967): +-3,3 / +-10,4 / +-18 cents. Dieciseis armonicos
    y pasa-bajos a 11 kHz — la v3 llegaba al doceavo y a 9 kHz, y ese brillo es el que
    aparecia en la banda 3-8 kHz, donde las referencias tienen 0,2 a 2%."""
    t = np.arange(n) / float(SR)
    ratios = [-201.8, -112.4, -34.1, 0.0, 34.1, 104.4, 176.7]
    pan = [-1.0, -0.6, -0.25, 0.0, 0.25, 0.6, 1.0]
    L = np.zeros(n)
    R = np.zeros(n)
    for c, p in zip(ratios, pan):
        fv = cents(f, c * 0.0967 + rng.normal(0, 1.0))
        # deriva lenta: un LFO aleatorio muy lento por voz, como la afinacion analogica
        deriva = 1.0 + 3e-5 * np.sin(2 * math.pi * rng.uniform(0.05, 0.30) * t
                                     + rng.uniform(0, 6.28))
        fase = rng.uniform(0, 2 * math.pi)
        v = np.zeros(n)
        for h in range(1, 17):
            if fv * h > 16000:
                break
            v += np.sin(2 * math.pi * fv * h * np.cumsum(deriva) / SR + fase * h) / (h ** 1.15)
        gi = 0.585 if c else 1.0
        L += v * gi * (1 - p) / 2.0
        R += v * gi * (1 + p) / 2.0
    L, R = pasaaltos(L, f * 0.85), pasaaltos(R, f * 0.85)
    L, R = pasabajos(L, 11000.0, 2), pasabajos(R, 11000.0, 2)
    e = env_asr(n, 0.70, 1.0)                   # ataque lento: el pad no empuja, envuelve
    return L / 5.0 * e, R / 5.0 * e


def bajo_nota(f, n, rng, tau=0.55, ataque=0.020):
    """Bajo legato. Seno + 12% del 2do armonico, pasa-bajos a 500 Hz. Es la mitad del
    ancla grave: la otra mitad es el sub."""
    t = np.arange(n) / float(SR)
    fase = rng.uniform(0, 2 * math.pi)
    v = (np.sin(2 * math.pi * f * t + fase)
         + 0.12 * np.sin(2 * math.pi * 2 * f * t + fase * 2))
    v = pasabajos(v, 500.0) * env_perc(n, ataque, tau * rng.uniform(0.95, 1.05))
    return pasaaltos(v, 38.0, 2)


def sub_nota(f, n, ataque=0.15, salida=0.35):
    """Seno puro en la fundamental del bajo (65-110 Hz), sostenido todo el compas. ES EL
    ANCLA: es lo que lleva la energia de <120 Hz del 14% de la v3 al 50-60% que midieron las
    referencias, y por lo tanto lo que baja la mediana espectral de 479 a ~120 Hz. Sin esto
    la mezcla vive en el medio y se percibe fuerte aunque el LUFS sea bajo.

    Va en la MISMA octava que el bajo, no una abajo: a 33-55 Hz (primer intento) se comia el
    97% de la energia y dejaba la mediana en 49 Hz — fuera del rango de todas las
    referencias, y ademas es una banda que el parlante de un celular no reproduce."""
    t = np.arange(n) / float(SR)
    v = np.sin(2 * math.pi * f * t)
    return pasaaltos(v * env_asr(n, ataque, salida), 28.0, 2)


def latido(n):
    """Lo que reemplaza al bombo: un seno de 58 Hz que cae en 90 ms, SIN click, SIN
    saturacion y pasa-bajos a 110 Hz. Marca que la pista avanza sin marcar el pulso — que
    es lo que sube la energia percibida de una pista, mas que el tempo."""
    t = np.arange(n) / float(SR)
    f = 86 * np.exp(-t / 0.035) + 52
    v = np.sin(2 * math.pi * np.cumsum(f) / SR) * env_perc(n, 0.006, 0.090)
    return pasabajos(pasaaltos(v, 34.0, 2), 110.0, 2)


def floracion(n, f0=110.0):
    """Lo que cae en el cuadro del gesto. NO es un impacto: no tiene click, ni capa de
    metal inarmonico, ni ataque. Es una floracion — un cuerpo grave que crece en 35 ms y
    dura tres segundos, con dos armonicos y nada arriba de 900 Hz. Conserva la figura que a
    Fak le gusto y le saca el golpe."""
    t = np.arange(n) / float(SR)
    e = env_perc(n, 0.035, 1.10)
    v = (np.sin(2 * math.pi * f0 * t)
         + 0.45 * np.sin(2 * math.pi * f0 * 2 * t + 1.1)
         + 0.18 * np.sin(2 * math.pi * f0 * 3 * t + 2.3)) * e
    return pasabajos(v / 1.6, 900.0, 2)


def sub_drop(n, f0=80.0, f1=34.0):
    """Un seno que se desliza hacia abajo: lleva peso, no melodia. Sin saturar (la v3 lo
    pasaba por un tanh y eso le agregaba armonicos que subian al medio)."""
    t = np.arange(n) / float(SR)
    f = f0 * (f1 / f0) ** (t / max(t[-1], 1e-9))
    v = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / (0.8 * (n / float(SR))))
    v = pasaaltos(v * 0.8, 24.0, 2)
    nc = int(0.15 * SR)
    v[-nc:] *= np.linspace(1, 0, nc)
    return v


def swell_invertido(n, ir, rng):
    """Pre-eco: se invierte el material, se le pone la cola y se vuelve a invertir. Asi el
    swell TERMINA en el punto en vez de empezar ahi. Aca va filtrado a 2,5 kHz: el de la v3
    llegaba a 6 kHz y siseaba."""
    x = pasabanda(rng.standard_normal(n), 200, 2500) * np.linspace(0.15, 1.0, n)
    y = conv(x[::-1], ir)[:n][::-1]
    y[:int(0.010 * SR)] *= np.linspace(0, 1, int(0.010 * SR))
    return y / max(np.abs(y).max(), 1e-9)


# --------------------------------------------------------------------------- armonia
# I - V - vi - IV en Do mayor, con las cuartas y novenas que definen el genero: el add9 es
# un sus2 con la tercera puesta arriba, y al no pelearse con la melodia deja el acorde
# ABIERTO. Lo que cambia el caracter no es el acorde: es como se toca.
ACORDES = [
    dict(bajo=36, tonos=[55, 62, 64, 67], nom="Cadd9"),    # G3 D4 E4 G4 sobre C2
    dict(bajo=43, tonos=[55, 59, 62, 64], nom="G6"),       # G3 B3 D4 E4 sobre G2
    dict(bajo=45, tonos=[52, 57, 59, 64], nom="Am(add9)"), # E3 A3 B3 E4 sobre A2
    dict(bajo=41, tonos=[52, 57, 60, 64], nom="Fmaj7"),    # E3 A3 C4 E4 sobre F2
]
# El gancho, en CORCHEAS (la v3 iba en semicorcheas: el doble de notas por compas es el
# doble de ataques por segundo, y eso es agitacion). 8 pasos por compas, en grados del
# acorde; -1 = silencio. Sube y vuelve, como el arpegio de piano del genero. Con la caida
# de 0,55 s las notas se pisan entre si y queda un lavado legato, no un punteo.
MOTIVO = [0, 1, 2, 3, 2, 1, 2, -1]
# Contramelodia: notas largas, UNA OCTAVA ABAJO de la v3 (MIDI 64-72 = 330-523 Hz en vez de
# 660-1050). Es lo cantable, y arriba de 600 Hz pasaba a ser lo mas fuerte de la mezcla.
MELODIA = [
    [(69, 2.0), (72, 1.0), (71, 1.0)],
    [(69, 2.0), (67, 2.0)],
    [(64, 1.5), (69, 0.5), (72, 2.0)],
    [(71, 2.0), (69, 2.0)],
]


# El arco, en dB por compas. La v3 tenia 10 dB: demasiado para una pieza de 61 s. EBU R128
# s1 §d fija el maximo short-term en objetivo +5 LU, asi que 4,5 dB deja margen. Estos
# escalones van sobre la CAMA; los efectos quedan afuera.
ARCO_DB = [(0, -3.4), (2, -2.8), (4, -2.2), (6, -1.6), (10, -0.7), (14, 0.0)]


def envolvente_arco(n, m, n_compases):
    """Ganancia por compas. Entre punto y punto va un smoothstep, no una recta: asi la
    subida no tiene esquinas y no hace falta suavizarla despues (suavizar con una ventana
    de 12.000 taps sobre 2,9 M de muestras es convolucion directa y cuesta 6 minutos)."""
    g = np.empty(n)
    puntos = [(m(b), 10 ** (db / 20.0)) for b, db in ARCO_DB]
    puntos.append((max(m(n_compases), n), puntos[-1][1]))
    g[:max(puntos[0][0], 0)] = puntos[0][1]
    for (i0, v0), (i1, v1) in zip(puntos, puntos[1:]):
        i0, i1 = max(i0, 0), min(i1, n)
        if i1 <= i0:
            continue
        u = np.linspace(0.0, 1.0, i1 - i0)
        g[i0:i1] = v0 + (v1 - v0) * (u * u * (3 - 2 * u))
    if puntos[-1][0] < n:
        g[puntos[-1][0]:] = puntos[-1][1]
    return g


# Balance. Los numeros salen de medir la mezcla contra el reparto de las referencias, no de
# la intuicion: el grave (sub + bajo + latido) tiene que MANDAR y el medio quedar atras.
NIV = dict(sub=0.55, bajo=0.30, latido=0.22, mallet=0.62, pad=0.85, mel=0.55,
           perc=0.34, fx=0.34, aire=0.055)

# Secciones: entra un elemento cada 2-4 compases. El pico va entre el 70 y el 80% del
# metraje, pero con 4,5 dB de recorrido, no 10.
S_PAD, S_SUB, S_BAJO, S_GANCHO, S_LATIDO, S_MELODIA = 0, 0, 0, 0, 10, 13


# --------------------------------------------------------------------------- el arreglo
def construir(dur, marcas):
    cortes = [c["t"] for c in marcas["cortes"]]
    c0 = cortes[1]                                   # ahi entra la planta
    t_gesto, t_fin_gesto = marcas["gesto"]
    t_salida = cortes[-1]                            # ahi entra la placa final

    compas = (t_gesto - c0) / float(COMPASES_AL_GESTO)
    beat = compas / 4.0
    bpm = 60.0 / beat
    org = c0 + RETARDO                               # la grilla, corrida un cuadro
    n = int(dur * SR)
    rng = np.random.default_rng(20260911)
    golpes_prensa = cargar_golpes()

    def m(bar, b=0.0):
        """Muestra donde cae el compas `bar`, tiempo `b`."""
        return int((org + bar * compas + b * beat) * SR)

    def bar_de(t):
        return (t - org) / compas

    n_compases = int(math.ceil((dur - org) / compas)) + 1
    b_gesto = COMPASES_AL_GESTO
    b_vuelta = int(round(bar_de(t_fin_gesto - 0.55)))    # ahi la imagen vuelve a la prensa
    b_final = int(round(bar_de(t_salida)))

    print("  compas %.4f s -> %.1f BPM   |  gesto = compas %d  vuelta = %d  placa = %d"
          % (compas, bpm, b_gesto, b_vuelta, b_final))
    for t, nom in ((t_gesto, "gesto"), (t_fin_gesto, "fin gesto"), (t_salida, "placa")):
        b = bar_de(t)
        print("     %-10s %6.2f s  =  compas %6.3f   (desvio %+.0f ms)"
              % (nom, t, b, (round(b) - b) * compas * 1000))

    pistas = {k: np.zeros(n) for k in
              ("sub", "bajo", "latido", "perc", "mallet_l", "mallet_r", "pad_l", "pad_r",
               "mel", "fx_l", "fx_r", "aire_l", "aire_r")}

    def quieto(bar):
        return b_gesto <= bar < b_vuelta

    # ---------- APERTURA. La placa del logo dura 2,7 s y hasta la v3 quedaba en SILENCIO
    # ABSOLUTO: medido, -120 dB. Un video que arranca mudo se lee como archivo roto — el
    # que lo abre revisa el volumen en vez de mirar la maquina. Entra el primer acorde
    # creciendo desde 0,20 s, con su sub, y desemboca en el primer compas.
    i_ap = int(0.20 * SR)
    largo_ap = m(0) + int(0.9 * compas * SR) - i_ap
    if largo_ap > 0:
        ac0 = ACORDES[0]
        Lp = np.zeros(largo_ap)
        Rp = np.zeros(largo_ap)
        for md in ac0["tonos"]:
            l, r = sierras(nota(md), largo_ap, rng)
            Lp += l
            Rp += r
        subida = np.linspace(0.45, 1.0, largo_ap) ** 1.2
        sumar(pistas["pad_l"], i_ap, Lp / 4.0 * subida)
        sumar(pistas["pad_r"], i_ap, Rp / 4.0 * subida)
        sumar(pistas["sub"], i_ap,
              sub_nota(nota(ac0["bajo"]), largo_ap, 1.20, 0.50) * subida, 0.60)

    for b in range(n_compases):
        ac = ACORDES[b % 4]
        t_bar = org + b * compas
        if t_bar >= dur:
            break
        i_bar = m(b)
        largo_bar = min(int(compas * SR), n - i_bar)
        if largo_bar <= 0:
            break

        # ---------- PAD: el pegamento. Entra primero y no se va nunca.
        if b >= S_PAD:
            largo = min(int(compas * SR * 1.35), n - i_bar)
            if largo > 0:
                L = np.zeros(largo)
                R = np.zeros(largo)
                for md in ac["tonos"]:
                    l, r = sierras(nota(md), largo, rng)
                    L += l
                    R += r
                d = int(rng.normal(0.015, 0.020) * SR)      # el pad no tiene ataque: el
                sumar(pistas["pad_l"], i_bar + d, L / 4.0)  # error de tiempo no se oye
                sumar(pistas["pad_r"], i_bar + d, R / 4.0)

        # ---------- SUB: el ancla. Una nota sostenida por compas, nunca se corta.
        if b >= S_SUB:
            g = 0.70 if quieto(b) else 1.0
            sumar(pistas["sub"], i_bar,
                  sub_nota(nota(ac["bajo"]), int(largo_bar * 1.15)
                           if i_bar + int(largo_bar * 1.15) < n else largo_bar), g)

        # ---------- BAJO: legato, una nota por compas y la quinta en el 3. Nunca corcheas:
        #            las corcheas eran "el motor" de la v3 y el motor es lo agitado.
        if b >= S_BAJO:
            fb = nota(ac["bajo"])
            g = 0.55 if quieto(b) else 1.0
            sumar(pistas["bajo"], i_bar, bajo_nota(fb, int(largo_bar * 0.62), rng, 0.62), g)
            if not quieto(b):
                i3 = m(b, 2.0)
                l3 = min(int(beat * 2.0 * SR), n - i3)
                if l3 > 0:
                    sumar(pistas["bajo"], i3, bajo_nota(fb, l3, rng, 0.50), 0.62)

        # ---------- GANCHO de mallet en corcheas, con eco a negra
        if b >= S_GANCHO:
            brillo = 0.55 if quieto(b) else 1.0
            for j, grado in enumerate(MOTIVO):
                if grado < 0:
                    continue
                if quieto(b) and j % 4:             # en la camara lenta, solo las negras
                    continue
                tonos = ac["tonos"]
                md = tonos[grado % len(tonos)] + 12 * (grado // len(tonos))
                i = m(b, j * 0.5) + int(rng.normal(0.000, 0.004) * SR)
                largo = min(int(0.95 * SR), n - i)
                if largo <= 0:
                    continue
                # acento por posicion metrica, MUY plano: 2 dB entre el 1 y el contratiempo.
                # Marcar fuerte los tiempos es lo que hace que se oiga el pulso.
                ac_db = 0.0 if j % 2 == 0 else -2.0
                g = 10 ** ((ac_db + rng.normal(0, 0.8)) / 20.0) * brillo
                v = mallet(nota(md), largo, rng) * g
                # la octava de arriba, 10 dB abajo y mas corta: es la que pone la banda de
                # 1,2 a 8 kHz que tienen todas las referencias y la mezcla no tenia
                v = v + mallet(nota(md + 12), largo, rng, tau=0.40, ataque=0.006,
                               brillo=2.2) * g * 0.72
                if j == 0 and b % 2 == 0:
                    # la campanita: dos octavas arriba, en el 1 de cada dos compases. Es la
                    # unica voz del arreglo que llega a 12-19 kHz, y sin ella la mezcla
                    # queda cortada en 11 kHz (escalon de 37 dB contra 1-8 de las
                    # referencias) y suena tapada aunque el reparto por bandas cierre.
                    v = v + mallet(nota(md + 24), largo, rng, tau=0.90, ataque=0.004,
                                   brillo=3.0) * g * 0.17
                pan = 0.5 + 0.20 * math.sin(j * 1.7)
                sumar(pistas["mallet_l"], i, v, 1 - pan)
                sumar(pistas["mallet_r"], i, v, pan)
                ie = i + int(1.0 * beat * SR)       # eco cruzado: ancho sin ensuciar
                sumar(pistas["mallet_r"], ie, v, 0.26 * (1 - pan))
                sumar(pistas["mallet_l"], ie, v, 0.26 * pan)

        # ---------- LATIDO: en el 1 y el 3, nunca en las cuatro negras.
        if b >= S_LATIDO and not quieto(b):
            for j in (0, 2):
                i = m(b, j) + int(rng.normal(0, 0.004) * SR)
                largo = min(int(0.40 * SR), n - i)
                if largo > 0:
                    sumar(pistas["latido"], i, latido(largo), 1.0 if j == 0 else 0.72)

        # ---------- CONTRAMELODIA
        if S_MELODIA <= b and not quieto(b):
            pos = 0.0
            for md, largo_beats in MELODIA[b % 4]:
                i = m(b, pos) + int(rng.normal(0.004, 0.010) * SR)
                largo = min(int(largo_beats * beat * SR * 1.15), n - i)
                if largo > 0:
                    v = mallet(nota(md), largo, rng, tau=largo_beats * beat * 0.75,
                               ataque=0.035, brillo=1.0)
                    v = v + mallet(nota(md + 12), largo, rng, tau=largo_beats * beat * 0.55,
                                   ataque=0.050, brillo=1.9) * 0.55
                    sumar(pistas["mel"], i, v, 10 ** (rng.normal(0, 1.2) / 20.0))
                pos += largo_beats

    # ------------------------------------------------------------------ diseño de sonido
    fx_l, fx_r = pistas["fx_l"], pistas["fx_r"]
    ir_sala = ir_reverb(0.80, 0.012, 10000, 3)
    ir_hall = ir_reverb(3.00, 0.045, 13000, 11)

    def fx(i, v, ancho=0.0):
        sumar(fx_l, i, v, 1.0 - ancho * 0.5)
        sumar(fx_r, i, v, 1.0 + ancho * 0.5 - ancho)

    # 1) la planta aparece: una floracion grave, sin golpe
    fx(m(0), floracion(int(2.2 * SR), 98.0) * 0.40)

    # 2) los cortes de seccion llevan un color, NO un acento: el golpe de la prensa pasado
    #    por un pasa-bajos de 600 Hz y mandado casi entero a la reverb. Se oye la maquina,
    #    no se oye un tambor.
    for t in (cortes[4], cortes[10], cortes[13]):        # la pieza / control / terminadas
        i = int((t + RETARDO) * SR)
        sumar(pistas["perc"], i, pasabajos(golpes_prensa["cuerpo"], 600.0, 3), 1.0)

    # 3) EL GESTO. Se conserva el stopdown que a Fak le gusto: todo se corta 0,24 s antes y
    #    el swell invertido ocupa el hueco. Lo que cae en el cuadro ya no es un impacto: es
    #    la floracion grave, el sub que baja y el acorde que vuelve con ataque lento.
    i_g = m(b_gesto)
    corte = i_g - int(0.24 * SR)
    caida = int(0.018 * SR)
    TODAS = ("latido", "perc", "bajo", "mel", "mallet_l", "mallet_r", "pad_l", "pad_r")
    for k in TODAS:
        pistas[k][corte + caida:i_g] = 0.0
        pistas[k][corte:corte + caida] *= np.linspace(1, 0, caida)
    # el sub NO se corta del todo: baja 8 dB y sigue. Que el grave no desaparezca es lo que
    # evita que el hueco se lea como un error del archivo.
    pistas["sub"][corte:i_g] *= np.linspace(1.0, 0.15, i_g - corte)
    # DESPUES del golpe, durante la camara lenta, no hay latido ni contramelodia.
    for k in ("latido", "perc", "mel"):
        pistas[k][i_g:m(b_vuelta)] = 0.0
    ns = int(1.30 * SR)
    fx(i_g - ns, swell_invertido(ns, ir_hall, rng) * 0.30, 0.5)
    fx(i_g, floracion(int(3.4 * SR), 88.0) * 2.00)
    fx(i_g, sub_drop(int(1.8 * SR), 80.0, 34.0) * 0.60)

    # 4) la imagen vuelve a la prensa: un swell que muere en el cuadro y otra floracion. Sin
    #    riser: un riser es la figura mas "trailer" que hay y no va en una cama tranquila.
    i_v = m(b_vuelta) + int(0.10 * SR)      # 100 ms mas tarde: el compas caia 38 ms
    nv = int(1.50 * SR)                     # ANTES del arranque del encadenado de salida,
    fx(i_v - nv, swell_invertido(nv, ir_hall, rng) * 0.26, 0.4)   # y del lado adelantado
    fx(i_v, floracion(int(2.6 * SR), 104.0) * 1.10)               # el oido tolera 3x menos

    # 5) la placa final: floracion larga y cola
    fx(m(b_final), floracion(int(3.6 * SR), 92.0) * 0.50)

    # ------------------------------------------------------------------ mezcla
    # EQ de arreglo: pasa-altos a todo lo que no sea sub, bajo ni latido, para que el grave
    # lo lleven solo los que tienen que llevarlo y no se acumule barro.
    pistas["perc"] = pasaaltos(pistas["perc"], 90, 2)
    for k in ("mallet_l", "mallet_r"):
        pistas[k] = pasaaltos(pistas[k], 200, 2)
    for k in ("pad_l", "pad_r"):
        # hueco de 3 dB en la banda del gancho: cuando dos elementos pelean se corta al
        # que NO manda esa banda, no se sube al que manda
        pistas[k] = campana(pasaaltos(pistas[k], 150, 2), 1200, -3.0, 0.9)
    pistas["mel"] = pasaaltos(pistas["mel"], 230, 2)
    pistas["sub"] = pasabajos(pistas["sub"], 140, 2)
    pistas["bajo"] = pasaaltos(pistas["bajo"], 40, 2)

    # el arco va sobre la cama, antes de los envios: asi la reverb tambien lo sigue
    arco = envolvente_arco(n, m, n_compases)
    for k in ("sub", "bajo", "latido", "perc", "mallet_l", "mallet_r",
              "pad_l", "pad_r", "mel"):
        pistas[k] *= arco
    print("  arco: %+.1f dB en la apertura -> 0 dB en el pico"
          % (20 * math.log10(max(arco[m(0) + 1000], 1e-6))))

    # La camara lenta: el bed se filtra a 700 Hz y se va 5 dB abajo; al volver la imagen a
    # la prensa el filtro se abre en 250 ms.
    g0, g1 = m(b_gesto), m(b_vuelta)
    for k in ("pad_l", "pad_r", "mallet_l", "mallet_r", "bajo"):
        seg = pistas[k][g0:g1]
        if len(seg):
            oscuro = pasabajos(seg, 700, 3) * 10 ** (-5.0 / 20.0)
            na = min(int(0.30 * SR), len(seg))
            nb = min(int(0.25 * SR), len(seg))
            mezcla = np.ones(len(seg))
            mezcla[:na] = np.linspace(0, 1, na)
            mezcla[-nb:] = np.linspace(1, 0, nb)
            pistas[k][g0:g1] = seg * (1 - mezcla) + oscuro * mezcla

    # ---------- AIRE. Toda la mezcla es suma de senos, y una suma de senos no tiene nada
    # arriba de su parcial mas alto: medido, la banda de 12,5-15 kHz caia 39 dB por debajo
    # de la de 8-10 kHz, contra 1 a 8 dB en las ocho referencias de musica sola. Eso se oye
    # como "tapado" aunque el reparto por bandas anchas cierre. Se agrega ruido pasa-altos
    # modulado por la envolvente de la cama YA EDITADA: asi sigue el arco, se oscurece en la
    # camara lenta y se apaga en el hueco del gesto, sin una linea extra de codigo.
    cama = (pistas["mallet_l"] + pistas["mallet_r"] + pistas["pad_l"] + pistas["pad_r"]
            + pistas["mel"])
    k_env = int(0.040 * SR)
    cum = np.concatenate([[0.0], np.cumsum(np.abs(cama))])
    env_aire = (cum[k_env:] - cum[:-k_env]) / k_env            # media movil sin convolucion
    env_aire = np.concatenate([env_aire, np.full(n - len(env_aire), env_aire[-1])])
    env_aire = (env_aire / max(env_aire.max(), 1e-12)) ** 0.75
    for lado in ("aire_l", "aire_r"):                          # ruido distinto a cada lado:
        ruido = pasabajos(pasaaltos(rng.standard_normal(n), 6500, 4), 15000, 2)
        pistas[lado] = ruido * env_aire                         # da ancho

    # NO HAY SIDECHAIN. Sin bombo en cada negra no hay que duckear nada, y el bombeo del
    # sidechain es una firma de pista energica: se oye como que la musica "respira" rapido.

    L = (pistas["sub"] * NIV["sub"] + pistas["bajo"] * NIV["bajo"]
         + pistas["latido"] * NIV["latido"] + pistas["perc"] * NIV["perc"]
         + pistas["mallet_l"] * NIV["mallet"] + pistas["pad_l"] * NIV["pad"]
         + pistas["mel"] * NIV["mel"] + pistas["fx_l"] * NIV["fx"]
         + pistas["aire_l"] * NIV["aire"])
    R = (pistas["sub"] * NIV["sub"] + pistas["bajo"] * NIV["bajo"]
         + pistas["latido"] * NIV["latido"] + pistas["perc"] * NIV["perc"]
         + pistas["mallet_r"] * NIV["mallet"] + pistas["pad_r"] * NIV["pad"]
         + pistas["mel"] * NIV["mel"] + pistas["fx_r"] * NIV["fx"]
         + pistas["aire_r"] * NIV["aire"])

    # Dos envios: una sala corta para el color de la prensa y un hall largo para pad,
    # gancho, melodia y efectos. Los retornos van filtrados — un reverb con graves embarra.
    env_sala = pistas["perc"] * 0.9 + (pistas["mallet_l"] + pistas["mallet_r"]) * 0.25
    env_hall = ((pistas["pad_l"] + pistas["pad_r"]) * 0.32 + pistas["mel"] * 0.50
                + (pistas["fx_l"] + pistas["fx_r"]) * 0.30)
    for envio, ir, g in ((env_sala, ir_sala, 0.18), (env_hall, ir_hall, 0.28)):
        cola = conv(envio, ir)
        cola = pasabajos(pasaaltos(cola, 220, 2), 13000, 2) * g
        L += cola
        R += cola * 0.92                       # la cola apenas distinta a cada lado

    # En la camara lenta la cola del hall se abre: es la mitad del efecto.
    extra = conv(env_hall, ir_hall)
    extra = pasabajos(pasaaltos(extra, 220, 2), 13000, 2)
    vent = np.zeros(n)
    vent[g0:g1] = 1.0
    na = min(int(0.30 * SR), g1 - g0)
    vent[g0:g0 + na] = np.linspace(0, 1, na)
    nb = min(int(0.25 * SR), g1 - g0)
    vent[g1 - nb:g1] = np.linspace(1, 0, nb)
    L += extra * vent * 0.40
    R += extra * vent * 0.37

    L, R = corregir_espectro(L, R)
    L, R = side_mono_abajo(L, R, 120.0)
    # Sin saturacion de bus: el tanh agrega armonicos, y los armonicos van justo a la banda
    # que hay que vaciar. La v3 saturaba el bajo y el bus entero.
    L, gr = comp_bus(L)
    R, _ = comp_bus(R)
    print("  compresion de bus: %.1f dB de reduccion en los picos" % gr)

    # arranque y final limpios
    nf = int(0.30 * SR)
    L[:nf] *= np.linspace(0, 1, nf)
    R[:nf] *= np.linspace(0, 1, nf)
    nf = int(2.30 * SR)                     # el cierre RESUELVE, no se corta: 2,3 s
    L[-nf:] *= np.linspace(1, 0, nf)        # de cola debajo del fundido a negro de
    R[-nf:] *= np.linspace(1, 0, nf)        # la placa final (antes eran 0,97 s)

    p = max(np.abs(L).max(), np.abs(R).max())
    L, R = L / p * 0.88, R / p * 0.88
    return limitar(L), limitar(R)


def escribir(ruta, L, R):
    y = np.stack([np.clip(L, -1, 1), np.clip(R, -1, 1)], axis=1)
    with wave.open(ruta, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dur", type=float)
    ap.add_argument("salida")
    ap.add_argument("--marcas", required=True, help="armado.json que deja armar.py")
    a = ap.parse_args()
    marcas = json.load(open(a.marcas, encoding="utf-8"))
    L, R = construir(a.dur, marcas)
    escribir(a.salida, L, R)
    print("  %s  %.2f s  estereo" % (a.salida, len(L) / float(SR)))


if __name__ == "__main__":
    main()
