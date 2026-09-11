# -*- coding: utf-8 -*-
"""Cama musical original para los institucionales de Barack — version 3.

Sintetizada de cero con numpy/scipy: no lleva sample, loop ni pista de terceros, asi que
el video se puede mostrar y mandar sin problema de derechos. Lo unico grabado son cinco
GOLPES DE LA PRENSA sacados del propio master (golpes_prensa.wav), que hacen de percusion.

POR QUE ESTA VERSION. Fak, 10/09/2026, sobre la v2: *"la cancion es una mierda... fijate
como hace Volkswagen, como hace Renault... si logras que la musica coincida con las partes,
por ejemplo con la parte de Manuel que hace el OK con los dedos, que la musica tenga un
efecto distinto ahi"*. Se investigo el genero y la v2 fallaba en cuatro cosas medibles:

  1. NO TENIA ARCO. Medido: de 5 s a 58 s el nivel se movia 3 dB. Una pista corporativa se
     construye por secciones, sumando un elemento cada 4 compases, con el pico entre el 70
     y el 80% del metraje. Una plancha pareja es la firma de la musica de stock.
  2. EL GANCHO ERA UNA SIERRA. En este genero el gancho lo lleva un MALLET (marimba,
     vibrafono): parciales afinados 1 : 4 : 10, ataque de 2 ms y caida corta. Una sierra
     desafinada suena a sinte barato.
  3. ESPECTRO APAGADO. Medido: 38% de la energia entre 400 y 1200 Hz y 5,4% arriba de
     3,5 kHz. El gancho tiene que leerse en el parlante de una notebook.
  4. NO MIRABA AL VIDEO. La grilla salia de un BPM redondo y caia donde caia.

Lo que hace esta version, en orden de cuanto se nota:

  EL TEMPO SALE DEL CORTE. No se elige un BPM lindo: se toma el compas que hace caer el
  GESTO exactamente en una linea de compas, y de ahi sale todo (aca dan 101 BPM). Con eso
  el gesto queda en el compas 19, la vuelta en el 21 y la placa final en el 23, y otros
  cuatro cortes caen a menos de 60 ms de un tiempo.

  EL GESTO TIENE SU EFECTO. Es un "stopdown": la musica se corta 0,24 s ANTES, queda el
  aire, y sobre el cuadro del corte caen un swell invertido, un impacto de cinco capas y un
  sub que baja de 110 a 28 Hz. Durante la camara lenta no hay bateria: queda el pad
  filtrado a 600 Hz con la cola del hall abierta, 9 dB abajo. Cuando la imagen vuelve a la
  prensa, el filtro se abre en 200 ms y entra todo de nuevo.

  NINGUN GOLPE VA ADELANTADO. ITU-R BT.1359-1: el oido detecta el audio adelantado a partir
  de 45 ms y el atrasado recien a los 125 ms. Por eso la grilla entera va corrida 40 ms
  (un cuadro) DESPUES del corte: nunca antes.

  POCOS ACENTOS, NO TODOS. Marcar cada corte es "mickey-mousing" y cansa. Se marcan los
  cortes de seccion, no los 16.

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
# deja el gesto en una linea de compas y da 101 BPM, que es la banda del video de fabrica.
COMPASES_AL_GESTO = 19


# --------------------------------------------------------------------------- utilitarios
def nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def cents(f, c):
    return f * 2 ** (c / 1200.0)


def pasaaltos(x, fc, orden=2):
    return sosfilt(butter(orden, min(fc, SR * 0.45) / (SR / 2.0), btype="highpass",
                          output="sos"), x)


def pasabajos(x, fc, orden=2):
    return sosfilt(butter(orden, min(fc, SR * 0.45) / (SR / 2.0), btype="lowpass",
                          output="sos"), x)


def pasabanda(x, f1, f2, orden=2):
    return sosfilt(butter(orden, [f1 / (SR / 2.0), min(f2, SR * 0.45) / (SR / 2.0)],
                          btype="bandpass", output="sos"), x)


def env_perc(n, ataque, tau):
    """Ataque corto + caida exponencial. Es la envolvente de todo lo percutido."""
    t = np.arange(n) / float(SR)
    e = np.exp(-t / tau)
    na = max(1, int(ataque * SR))
    e[:na] *= np.linspace(0.0, 1.0, na) ** 0.6
    return e


def env_asr(n, a, r):
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    e = np.ones(n)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr:
        e[n - nr:] = np.linspace(1, 0, nr) ** 1.5
    return e


def sumar(dst, i0, x, g=1.0):
    """Suma x en dst a partir de i0, recortando lo que se pasa de largo."""
    i0 = int(i0)
    if i0 >= len(dst) or i0 + len(x) <= 0:
        return
    a = max(0, -i0)
    i0 = max(0, i0)
    l = min(len(x) - a, len(dst) - i0)
    if l > 0:
        dst[i0:i0 + l] += x[a:a + l] * g


def ir_reverb(rt60, predelay, corte_agudo=6000.0, semilla=7):
    """Cola sintetica segun el modelo de Moorer: ruido por una exponencial de -60 dB en el
    RT60. Los agudos mueren antes que los graves, como en una sala real, asi que la cola se
    arma por bandas con RT60 decreciente. Normalizada por ENERGIA y no por pico: por pico la
    ganancia se dispara y, como la cola va filtrada, se come la mezcla en graves."""
    n = int(rt60 * SR)
    rng = np.random.default_rng(semilla)
    r = rng.standard_normal(n)
    t = np.arange(n) / float(SR)
    ir = np.zeros(n)
    for f1, f2, k in ((120, 500, 1.00), (500, 1800, 0.78), (1800, corte_agudo, 0.52)):
        ir += pasabanda(r, f1, f2) * np.exp(-6.9078 * t / (rt60 * k))
    ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
    return ir / math.sqrt(float((ir ** 2).sum()) + 1e-12)


def conv(x, ir):
    return fftconvolve(x, ir)[:len(x)]


def saturar(x, drive=2.0, asim=0.0):
    """tanh con SOBREMUESTREO x4. Sin sobremuestrear, los armonicos que la no linealidad
    genera arriba de Nyquist se pliegan como aliasing — y el aliasing es exactamente el
    sonido 'barato/digital' que hay que evitar."""
    if drive <= 1.0001 and asim == 0.0:
        return x
    y = resample_poly(x, 4, 1)
    y = y * drive
    if asim:
        y = y + asim * y ** 2          # asimetria -> armonicos PARES, no solo impares
    y = np.tanh(y) / math.tanh(drive)
    y = resample_poly(y, 1, 4)
    return y[:len(x)]


def _sos_cookbook(b0, b1, b2, a0, a1, a2):
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def estante(x, fc, db, alto=True, S=0.8):
    """Filtro de estanteria (low/high shelf) con las formulas del Audio EQ Cookbook. Sirve
    para corregir el reparto por banda sin tocar la fase de forma brusca."""
    if abs(db) < 0.05:
        return x
    A = 10 ** (db / 40.0)
    w = 2 * math.pi * fc / SR
    cw, sw = math.cos(w), math.sin(w)
    al = sw / 2 * math.sqrt((A + 1 / A) * (1 / S - 1) + 2)
    r = 2 * math.sqrt(A) * al
    if alto:
        b0 = A * ((A + 1) + (A - 1) * cw + r)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - r)
        a0 = (A + 1) - (A - 1) * cw + r
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - r
    else:
        b0 = A * ((A + 1) - (A - 1) * cw + r)
        b1 = 2 * A * ((A - 1) - (A + 1) * cw)
        b2 = A * ((A + 1) - (A - 1) * cw - r)
        a0 = (A + 1) + (A - 1) * cw + r
        a1 = -2 * ((A - 1) + (A + 1) * cw)
        a2 = (A + 1) + (A - 1) * cw - r
    return sosfilt(_sos_cookbook(b0, b1, b2, a0, a1, a2), x)


def campana(x, fc, db, Q=0.8):
    """Filtro de campana, mismas formulas. Un corte ANCHO de 2-4 dB rinde mas que uno
    quirurgico de 10."""
    if abs(db) < 0.05:
        return x
    A = 10 ** (db / 40.0)
    w = 2 * math.pi * fc / SR
    al = math.sin(w) / (2 * Q)
    cw = math.cos(w)
    return sosfilt(_sos_cookbook(1 + al * A, -2 * cw, 1 - al * A,
                                 1 + al / A, -2 * cw, 1 - al / A), x)


# Objetivo de reparto por banda. No es el de musica electronica de club (sub 27% / bajo
# 54%): en un video corporativo el gancho tiene que leerse en el parlante de una notebook,
# asi que se le saca sub y se le pone medio y brillo.
OBJETIVO = [(0, 120, 16.0), (120, 400, 32.0), (400, 1200, 30.0),
            (1200, 3500, 14.0), (3500, 8000, 5.0), (8000, 20000, 3.0)]
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
              ("campana", 300.0, falta(1), None),
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


def transitorio(x, golpes, ms=0.012, factor=1.7):
    """Le sube el ataque a cada golpe. El ataque 'pega' por contraste de nivel en los
    primeros 10 ms, no por volumen general."""
    n = int(ms * SR)
    forma = np.linspace(factor, 1.0, n) ** 2
    g = np.ones(len(x))
    for i in golpes:
        i = int(i)
        if 0 <= i < len(x):
            l = min(n, len(x) - i)
            g[i:i + l] = np.maximum(g[i:i + l], forma[:l])
    return x * g


def curva_sidechain(n, golpes, prof_db, T):
    """Atenuacion disparada por el bombo, sin compresor: se dibuja la curva directo desde
    la grilla, que ya se conoce. Caida casi vertical y recuperacion CONVEXA (1-t)^2, que es
    la panza del volume-shaper; con exponencial sube muy rapido y suena menos musical."""
    g = np.ones(n)
    prof = 1 - 10 ** (-prof_db / 20.0)
    nt = max(8, int(T * SR))
    t = np.arange(nt) / float(nt)
    curva = 1 - prof * (1 - t) ** 2
    for i in golpes:
        i = int(i)
        if i >= n:
            continue
        a = max(0, i)
        l = min(nt, n - a)
        g[a:a + l] = np.minimum(g[a:a + l], curva[:l])
    # el flanco de bajada se suaviza 3 ms o chasquea
    k = int(0.003 * SR)
    v = np.hanning(k)
    return np.convolve(g, v / v.sum(), mode="same")


def comp_bus(x, umbral_db=-18.0, ratio=2.0, atk=0.020, rel=0.150, tope_gr=3.0):
    """Compresion de pegamento con detector RMS de un polo, asimetrico. El ataque lento
    deja pasar el transitorio y comprime el cuerpo: eso es lo que pega la mezcla sin
    aplastarla. Se limita la reduccion a 3 dB, que es la regla del bus."""
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
    k = int(0.010 * SR)
    v = np.hanning(k)
    gr = np.convolve(gr, v / v.sum(), mode="same")
    return x * 10 ** (gr / 20.0), float(-gr.min())


def limitar(x, techo=0.85, lookahead=0.004):
    """Limitador con lookahead: la ganancia se erosiona con un filtro de MINIMO sobre la
    ventana de anticipacion, asi ya esta baja cuando llega el pico, y despues se suaviza.
    El suavizado es lo que lo separa de un recortador."""
    pico = np.abs(x)
    n = max(4, int(lookahead * SR))
    g = np.minimum(1.0, techo / np.maximum(pico, 1e-9))
    # erosion: minimo movil hacia atras y hacia adelante
    m = g.copy()
    for d in (n // 2, n):
        m = np.minimum(m, np.concatenate([g[d:], np.ones(d)]))
        m = np.minimum(m, np.concatenate([np.ones(d), g[:-d]]))
    v = np.hanning(2 * n + 1)
    m = np.convolve(m, v / v.sum(), mode="same")
    return x * np.minimum(m, 1.0)


def side_mono_abajo(L, R, fc=120.0):
    """Abajo de ~120 Hz el oido no localiza y ensanchar solo trae cancelacion de fase: el
    canal Side se pasa-altos y el grave queda mono."""
    M, S = (L + R) / 2.0, (L - R) / 2.0
    S = pasaaltos(S, fc, 2)
    return M + S, M - S


# --------------------------------------------------------------------------- los golpes
def cargar_golpes():
    """Los cinco golpes de la prensa, del propio master. Cada uno sale de un plano donde en
    cuadro esta SOLO la maquina (verificado mirando el fotograma): nadie hablando, nadie
    cerca del microfono. Es la tecnica de los brand films que nombro Fak — Skoda mando a
    grabar su linea de montaje para el spot del Roomster y Ford armo 'Sounds of Fusion' con
    portazos y chicharras del propio auto. Un golpe de la prensa de Barack es lo unico que
    ninguna libreria de stock puede dar."""
    ruta = os.path.join(AQUI, "golpes_prensa.wav")
    with wave.open(ruta, "rb") as w:
        crudo = w.readframes(w.getnframes())
    x = np.frombuffer(crudo, dtype="<i2").astype(np.float64) / 32768.0
    n = 21600                                  # 0,45 s cada uno
    nombres = ["seco", "seco2", "cuerpo", "brillo", "brillo2"]
    return {nom: x[i * n:(i + 1) * n].copy() for i, nom in enumerate(nombres)}


# --------------------------------------------------------------------------- voces
def mallet(f, n, rng, brillo=1.0):
    """El gancho. Marimba: las barras se afinan a la relacion 1 : 4 : 10 (fundamental, dos
    octavas arriba, y tres octavas mas una tercera). Eso —y no una sierra— es lo que suena
    a instrumento y no a sinte. Se le suma el golpe del mazo: 3 ms de ruido de 2 a 5 kHz."""
    t = np.arange(n) / float(SR)
    f = cents(f, rng.normal(0, 1.5))                       # cada nota afina distinto
    fase = rng.uniform(0, 2 * math.pi, 3)                  # y arranca en otra fase:
    v = (1.00 * np.sin(2 * math.pi * f * t + fase[0])      # sin esto, dos notas iguales
         + 0.42 * np.sin(2 * math.pi * f * 4.00 * t + fase[1])   # salen identicas y suena
         + 0.16 * np.sin(2 * math.pi * f * 9.80 * t + fase[2]))  # a ametralladora
    tau = 0.18 * rng.uniform(0.95, 1.05)
    v *= env_perc(n, 0.002, tau)
    mazo = pasabanda(rng.standard_normal(n), 2000, 5000) * env_perc(n, 0.0004, 0.003)
    return (v + mazo * 0.10) * brillo


def sierras(f, n, rng):
    """Pad. Siete sierras como el supersaw del JP-8000, con los ratios que midio Szabo:
    la distribucion es ASIMETRICA (-202 contra +177 cents a fondo) y eso es parte del
    caracter. Con la perilla al medio (x0,0967) queda en +-3,3 / +-10,4 / +-18 cents, que
    es donde vive un apilado ancho pero musical — no en 50."""
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
        for h in range(1, 13):
            if fv * h > 15000:
                break
            v += np.sin(2 * math.pi * fv * h * np.cumsum(deriva) / SR + fase * h) / h
        gi = 0.585 if c else 1.0
        L += v * gi * (1 - p) / 2.0
        R += v * gi * (1 + p) / 2.0
    # pasa-altos que sigue al fundamental: limpia lo que queda por debajo de la nota
    L, R = pasaaltos(L, f * 0.85), pasaaltos(R, f * 0.85)
    e = env_asr(n, 0.45, 0.9)
    return L / 5.0 * e, R / 5.0 * e


def bajo_nota(f, n, rng, tau=0.14):
    """Seno + 15% del 2do armonico + 8% del 3ero, pasa-bajos a 800 Hz. Sub puro se pierde
    en el parlante de una notebook, que es donde se mira un video corporativo."""
    t = np.arange(n) / float(SR)
    fase = rng.uniform(0, 2 * math.pi)
    v = (np.sin(2 * math.pi * f * t + fase)
         + 0.15 * np.sin(2 * math.pi * 2 * f * t + fase * 2)
         + 0.08 * np.sin(2 * math.pi * 3 * f * t + fase * 3))
    v = pasabajos(v, 800.0) * env_perc(n, 0.005, tau * rng.uniform(0.95, 1.05))
    return pasaaltos(v, 45.0, 3)


def bombo(n, rng):
    t = np.arange(n) / float(SR)
    f = 126 * np.exp(-t / 0.018) + 54
    cuerpo = np.sin(2 * math.pi * np.cumsum(f) / SR) * env_perc(n, 0.001, 0.036)
    click = pasaaltos(rng.standard_normal(n), 3500) * env_perc(n, 0.0004, 0.005)
    return pasaaltos(saturar(cuerpo * 0.90 + click * 0.70, 2.2, 0.10), 42.0, 3)


def platillo(n, rng, abierto=False):
    r = pasabanda(rng.standard_normal(n), 3000, 11000, 2)
    return r * env_perc(n, 0.0004, 0.085 if abierto else 0.014)


def impacto(n, rng, f0=320.0):
    """Cinco capas alineadas al cuadro del golpe: click, punch, sub, metal inarmonico y
    cola. Los modos del metal son una serie INARMONICA (no multiplos), que es lo que
    distingue una campana de un acorde."""
    t = np.arange(n) / float(SR)
    click = pasaaltos(rng.standard_normal(n), 3000) * env_perc(n, 0.0003, 0.004)
    fp = 180 * np.exp(-t / 0.080) + 55
    punch = np.sin(2 * math.pi * np.cumsum(fp) / SR) * env_perc(n, 0.001, 0.12)
    sub = np.sin(2 * math.pi * 48 * t) * env_perc(n, 0.002, 0.38)
    metal = np.zeros(n)
    modos = [1.0, 1.43, 2.11, 2.87, 3.61, 4.52, 5.90, 7.31, 9.04, 11.2]
    for k, m in enumerate(modos):
        tau = 1.2 * (0.08 / 1.2) ** (k / float(len(modos) - 1))
        metal += np.sin(2 * math.pi * f0 * m * t + rng.uniform(0, 6.28)) * np.exp(-t / tau) / (k + 1)
    v = click * 0.80 + punch * 0.70 + saturar(sub, 1.8) * 0.32 + metal * 0.75
    return saturar(v, 1.4, 0.06)


def sub_drop(n, f0=110.0, f1=28.0):
    """Un seno que se desliza hacia abajo: lleva peso, no melodia. Se satura a proposito —
    un seno puro a 30 Hz no existe en el parlante de un celular."""
    t = np.arange(n) / float(SR)
    f = f0 * (f1 / f0) ** (t / max(t[-1], 1e-9))
    v = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / (0.8 * (n / float(SR))))
    v = np.tanh(1.8 * v) * 0.8
    v = pasaaltos(v, 22.0, 2)
    nc = int(0.10 * SR)
    v[-nc:] *= np.linspace(1, 0, nc)
    return v


def riser(n, rng):
    """Ruido por un pasabanda que barre 200 -> 12000 Hz, mas seis sierras que suben una
    octava. La curva del corte se percibe en OCTAVAS, no en Hz: lineal suena robotico."""
    t = np.arange(n) / float(SR)
    p = t / max(t[-1], 1e-9)
    r = rng.standard_normal(n)
    out = np.zeros(n)
    tramos = 24
    for k in range(tramos):
        a, b = int(k * n / tramos), int((k + 1) * n / tramos)
        fc = 200 * (12000.0 / 200.0) ** (k / float(tramos - 1))
        q = 2.0 + 4.0 * k / float(tramos - 1)
        anch = max(fc / q, 60.0)
        out[a:b] = pasabanda(r, max(fc - anch, 60), min(fc + anch, 15000))[a:b]
    tono = np.zeros(n)
    for c in (-14, -7, 0, 7, 14, 21):
        tono += np.sin(2 * math.pi * np.cumsum(cents(160.0, c) * 2 ** p) / SR)
    amp = 10 ** ((-24 + 24 * p ** 2.5) / 20.0)
    return (out * 0.55 + tono / 6.0 * 0.30) * amp


def whoosh(n, rng):
    """Barrido corto. El pico va EN el cuadro del corte: es lo que arrastra el ojo."""
    t = np.arange(n) / float(SR)
    T = t[-1]
    pico = 0.55 * T
    r = rng.standard_normal(n)
    out = np.zeros(n)
    tramos = 16
    for k in range(tramos):
        a, b = int(k * n / tramos), int((k + 1) * n / tramos)
        u = (k + 0.5) / tramos
        fc = (250 + (5000 - 250) * (u / 0.55)) if u < 0.55 else (5000 - (5000 - 900) * ((u - 0.55) / 0.45))
        out[a:b] = pasabanda(r, max(fc * 0.6, 80), min(fc * 1.6, 15000))[a:b]
    amp = np.exp(-((t - pico) / (T / 5.0)) ** 2)
    grave = pasabajos(r, 200.0) * amp
    return out * amp * 0.8 + grave * 0.5


def swell_invertido(n, ir, rng):
    """Pre-eco: se invierte el material, se le pone la cola y se vuelve a invertir. Asi el
    swell TERMINA en el ataque en vez de empezar ahi. Es el cue canonico antes de un golpe."""
    x = pasabanda(rng.standard_normal(n), 300, 6000) * np.linspace(0.2, 1.0, n)
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
# El gancho, en semicorcheas: 16 pasos por compas, en grados del acorde. Tocar el acorde
# desgranado en 1/16 da textura de pad con una sola voz. -1 = silencio, que es lo que le da
# respiracion; una grilla llena de notas suena a ejercicio.
MOTIVO = [0, -1, 2, 1, -1, 3, 2, -1, 0, 2, -1, 3, 4, -1, 2, 1]
# Contramelodia: notas largas una octava arriba, desde la seccion 3. Es lo CANTABLE.
MELODIA = [
    [(81, 2.0), (84, 1.0), (83, 1.0)],
    [(81, 2.0), (79, 2.0)],
    [(76, 1.5), (81, 0.5), (84, 2.0)],
    [(83, 2.0), (81, 2.0)],
]


# El arco, en dB por compas. Una pista corporativa no es una plancha: arranca abajo, suma
# un elemento cada 4 compases y llega al pico entre el 70 y el 80% del metraje. Estos
# escalones van sobre la CAMA; los impactos quedan afuera, porque un golpe tiene que pegar
# igual de fuerte donde caiga.
ARCO_DB = [(0, -10.0), (2, -7.0), (4, -4.5), (6, -3.0), (8, -1.5), (13, 0.0)]


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
    rng = np.random.default_rng(20260910)
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

    # --- secciones: se suma un elemento cada 4 compases y el pico va al 70-80% del metraje
    S_PAD, S_BAJO, S_RITMO, S_MELODIA = 2, 4, 8, 13
    B_BUILD = b_gesto - 2

    pistas = {k: np.zeros(n) for k in
              ("bombo", "perc", "hats", "bajo", "mallet_l", "mallet_r", "pad_l", "pad_r",
               "mel", "fx_l", "fx_r")}
    golpes_bombo = []

    def quieto(bar):
        return b_gesto <= bar < b_vuelta

    for b in range(n_compases):
        ac = ACORDES[b % 4]
        t_bar = org + b * compas
        if t_bar >= dur:
            break
        i_bar = m(b)
        pleno = b >= S_RITMO and not quieto(b)

        # ---------- PAD: el pegamento. Entra segundo y no se va nunca.
        if b >= S_PAD:
            largo = min(int(compas * SR * 1.20), n - i_bar)
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

        # ---------- GANCHO de mallet en semicorcheas, con eco a corchea con puntillo
        brillo = 0.55 if quieto(b) else 1.0
        for j, grado in enumerate(MOTIVO):
            if grado < 0:
                continue
            if quieto(b) and j % 4:                 # en la camara lenta, solo las negras
                continue
            tonos = ac["tonos"]
            md = tonos[grado % len(tonos)] + 12 * (1 + grado // len(tonos))
            i = m(b, j * 0.25) + int(rng.normal(0.000, 0.003) * SR)
            largo = min(int(0.55 * SR), n - i)
            if largo <= 0:
                continue
            # acento por posicion metrica: el 1 y el 3 pesan, los contratiempos no
            ac_db = (0.0 if j % 4 == 0 else -3.5 if j % 2 == 0 else -6.0)
            g = 10 ** ((ac_db + rng.normal(0, 0.8)) / 20.0) * brillo
            v = mallet(nota(md), largo, rng) * g
            pan = 0.5 + 0.22 * math.sin(j * 1.7)
            sumar(pistas["mallet_l"], i, v, 1 - pan)
            sumar(pistas["mallet_r"], i, v, pan)
            ie = i + int(0.75 * beat * SR)          # eco cruzado: ancho sin ensuciar
            sumar(pistas["mallet_r"], ie, v, 0.30 * (1 - pan))
            sumar(pistas["mallet_l"], ie, v, 0.30 * pan)

        # ---------- BAJO
        if b >= S_BAJO and not quieto(b):
            fb = nota(ac["bajo"])
            if pleno:
                for j in range(8):                  # corcheas: el motor
                    i = m(b, j * 0.5) + int(rng.normal(-0.003, 0.005) * SR)
                    largo = min(int(beat * 0.48 * SR), n - i)
                    if largo > 0:
                        g = 10 ** (((0.0 if j % 2 == 0 else -2.5) + rng.normal(0, 0.8)) / 20.0)
                        sumar(pistas["bajo"], i, bajo_nota(fb * (2.0 if j == 6 else 1.0),
                                                           largo, rng, 0.13), 0.62 * g)
            else:
                largo = min(int(compas * SR), n - i_bar)
                if largo > 0:
                    sumar(pistas["bajo"], i_bar, bajo_nota(fb, largo, rng, 0.45)
                          * env_asr(largo, 0.12, 0.45), 0.45)
        elif quieto(b):
            largo = min(int(compas * SR), n - i_bar)
            if largo > 0:                            # en la camara lenta queda solo el sub
                sumar(pistas["bajo"], i_bar, bajo_nota(nota(ac["bajo"]), largo, rng, 0.55)
                      * env_asr(largo, 0.30, 0.70), 0.30)

        # ---------- RITMO
        if pleno:
            for j in range(4):                       # bombo en negras
                i = m(b, j) + int(rng.normal(0, 0.003) * SR)
                largo = min(int(0.35 * SR), n - i)
                if largo > 0:
                    g = 10 ** ((0.0 if j % 2 == 0 else -1.5) / 20.0)
                    sumar(pistas["bombo"], i, bombo(largo, rng), 0.80 * g)
                    golpes_bombo.append(i)
            for j in (1, 3):                         # el golpe de la PRENSA en el 2 y el 4
                i = m(b, j) + int(rng.normal(0.005, 0.003) * SR)
                cual = "seco" if (b + j) % 2 else "seco2"   # alternados: nunca dos iguales
                v = golpes_prensa[cual]
                sumar(pistas["perc"], i, pasaaltos(v, 250, 2), 0.52 * rng.uniform(0.92, 1.06))
            for j in range(16):                      # hats en semicorcheas
                i = m(b, j * 0.25) + int(rng.normal(0, 0.002) * SR)
                largo = min(int(0.12 * SR), n - i)
                if largo > 0:
                    g = (1.0 if j % 4 == 0 else 0.55) * rng.uniform(0.9, 1.1)
                    sumar(pistas["hats"], i, platillo(largo, rng, j == 14), 0.42 * g)
        elif b >= S_BAJO and not quieto(b):
            for j in (1, 3):                         # antes del ritmo pleno, solo el aire
                i = m(b, j) + int(rng.normal(0.004, 0.003) * SR)
                v = golpes_prensa["brillo" if (b + j) % 2 else "brillo2"]
                sumar(pistas["perc"], i, pasaaltos(v, 1200, 2), 0.20)

        # ---------- CONTRAMELODIA
        if S_MELODIA <= b < B_BUILD and not quieto(b):
            pos = 0.0
            for md, largo_beats in MELODIA[b % 4]:
                i = m(b, pos) + int(rng.normal(0.004, 0.010) * SR)
                largo = min(int(largo_beats * beat * SR * 0.95), n - i)
                if largo > 0:
                    v = mallet(nota(md), largo, rng)
                    v += mallet(nota(md + 12), largo, rng) * 0.25
                    sumar(pistas["mel"], i, v, 0.55 * 10 ** (rng.normal(0, 1.5) / 20.0))
                pos += largo_beats

    # ------------------------------------------------------------------ diseño de sonido
    fx_l, fx_r = pistas["fx_l"], pistas["fx_r"]
    ir_sala = ir_reverb(0.60, 0.008, 7000, 3)
    ir_hall = ir_reverb(2.40, 0.035, 6000, 11)

    def fx(i, v, ancho=0.0):
        sumar(fx_l, i, v, 1.0 - ancho * 0.5)
        sumar(fx_r, i, v, 1.0 + ancho * 0.5 - ancho)

    # 1) la planta aparece: golpe de la prensa + whoosh con el pico EN el corte
    i = m(0)
    fx(i, impacto(int(1.6 * SR), rng, 300.0) * 0.45)
    nw = int(0.45 * SR)
    fx(i - int(nw * 0.55), whoosh(nw, rng) * 0.30, 0.6)

    # 2) los cortes de seccion llevan un acento, NO los 16: marcar todos es mickey-mousing
    for t in (cortes[4], cortes[10], cortes[13]):        # la pieza / control / terminadas
        i = int((t + RETARDO) * SR)
        fx(i, golpes_prensa["cuerpo"] * 0.34)
        nw = int(0.40 * SR)
        fx(i - int(nw * 0.55), whoosh(nw, rng) * 0.20, 0.8)

    # 3) EL GESTO. Stopdown: todo se corta 0,24 s antes, el swell invertido ocupa el hueco
    #    y sobre el cuadro del corte caen el impacto y el sub.
    i_g = m(b_gesto)
    corte = i_g - int(0.24 * SR)
    caida = int(0.012 * SR)
    TODAS = ("bombo", "perc", "hats", "bajo", "mel", "mallet_l", "mallet_r", "pad_l", "pad_r")
    # El HUECO: 0,24 s en que no suena nada. Es corto a proposito — el silencio existe para
    # que el golpe tenga donde aterrizar, no para dejar la escena sin musica.
    for k in TODAS:
        pistas[k][corte + caida:i_g] = 0.0
        pistas[k][corte:corte + caida] *= np.linspace(1, 0, caida)
    # DESPUES del golpe, durante la camara lenta, se va la bateria y la contramelodia; el
    # pad, el gancho en negras y el sub se quedan (filtrados y 6 dB abajo, mas abajo).
    for k in ("bombo", "perc", "hats", "mel"):
        pistas[k][i_g:m(b_vuelta)] = 0.0
    ns = int(1.10 * SR)
    fx(i_g - ns, swell_invertido(ns, ir_hall, rng) * 0.38, 0.5)
    fx(i_g, impacto(int(3.0 * SR), rng, 260.0) * 0.95)
    fx(i_g, sub_drop(int(1.6 * SR), 110.0, 30.0) * 0.30)

    # 4) la imagen vuelve a la prensa: riser corto que MUERE 0,18 s antes, e impacto
    i_v = m(b_vuelta)
    nr = int(1.30 * SR)
    fx(i_v - nr - int(0.18 * SR), riser(nr, rng) * 0.42, 0.4)
    fx(i_v, impacto(int(2.4 * SR), rng, 320.0) * 0.70)

    # 5) la placa final: ultimo golpe y cola
    i_f = m(b_final)
    fx(i_f, impacto(int(3.2 * SR), rng, 240.0) * 0.55)

    # ------------------------------------------------------------------ mezcla
    # EQ de arreglo: pasa-altos a todo lo que no sea bombo ni bajo, para que no se acumulen
    # graves. Con un filtro de 2do orden por etapa; los hats piden mas pendiente.
    pistas["perc"] = pasaaltos(pistas["perc"], 220, 2)
    pistas["hats"] = pasaaltos(pistas["hats"], 400, 3)
    for k in ("mallet_l", "mallet_r"):
        pistas[k] = pasaaltos(pistas[k], 260, 2)
    for k in ("pad_l", "pad_r"):
        # hueco de 3 dB en la banda del gancho: cuando dos elementos pelean se corta al
        # que NO manda esa banda, no se sube al que manda
        pistas[k] = campana(pasabajos(pasaaltos(pistas[k], 180, 2), 9000, 2), 1800, -3.5, 0.9)
    pistas["mel"] = pasaaltos(pistas["mel"], 300, 2)
    pistas["bombo"] = pasaaltos(pistas["bombo"], 30, 2)
    pistas["bajo"] = pasaaltos(pistas["bajo"], 35, 2)

    # el arco va sobre la cama, antes de los envios: asi la reverb tambien lo sigue
    arco = envolvente_arco(n, m, n_compases)
    for k in ("bombo", "perc", "hats", "bajo", "mallet_l", "mallet_r",
              "pad_l", "pad_r", "mel"):
        pistas[k] *= arco
    print("  arco: %+.1f dB en la apertura -> 0 dB en el pico"
          % (20 * math.log10(max(arco[m(0) + 1000], 1e-6))))

    pistas["bombo"] = transitorio(pistas["bombo"], golpes_bombo)
    pistas["bajo"] = saturar(pistas["bajo"], 2.2, 0.08)

    # La camara lenta: el bed se filtra a 600 Hz, se va 9 dB abajo, y al volver la imagen a
    # la prensa el filtro se abre en 200 ms. Es lo que hace una banda en un slow-motion.
    g0, g1 = m(b_gesto), m(b_vuelta)
    for k in ("pad_l", "pad_r", "mallet_l", "mallet_r", "bajo"):
        seg = pistas[k][g0:g1]
        if len(seg):
            oscuro = pasabajos(seg, 700, 3) * 10 ** (-6.0 / 20.0)
            na = min(int(0.30 * SR), len(seg))
            nb = min(int(0.20 * SR), len(seg))
            mezcla = np.ones(len(seg))
            mezcla[:na] = np.linspace(0, 1, na)
            mezcla[-nb:] = np.linspace(1, 0, nb)
            pistas[k][g0:g1] = seg * (1 - mezcla) + oscuro * mezcla

    # Sidechain: la atenuacion la dispara el bombo, y en corporativo NO se tiene que oir
    # el bombeo — 3 a 5 dB, no 8. El retorno de reverb es el que mas duckea.
    T_sc = 0.30 * beat
    sc_bajo = curva_sidechain(n, golpes_bombo, 5.0, T_sc)
    sc_pad = curva_sidechain(n, golpes_bombo, 4.0, T_sc)
    sc_rev = curva_sidechain(n, golpes_bombo, 7.0, T_sc)
    pistas["bajo"] *= sc_bajo
    pistas["pad_l"] *= sc_pad
    pistas["pad_r"] *= sc_pad
    pistas["mel"] *= curva_sidechain(n, golpes_bombo, 2.5, T_sc)

    # Balance. Los numeros salen de medir la mezcla, no de la intuicion: el objetivo es
    # sacar energia de 400-1200 Hz (la v2 tenia 38%) y ponerla arriba de 2 kHz.
    NIV = dict(bombo=0.58, perc=0.92, hats=0.72, bajo=0.38, mallet=1.35, pad=0.30,
               mel=0.80, fx=0.70)

    L = (pistas["bombo"] * NIV["bombo"] + pistas["perc"] * NIV["perc"]
         + pistas["hats"] * NIV["hats"] + pistas["bajo"] * NIV["bajo"]
         + pistas["mallet_l"] * NIV["mallet"] + pistas["pad_l"] * NIV["pad"]
         + pistas["mel"] * NIV["mel"] + pistas["fx_l"] * NIV["fx"])
    R = (pistas["bombo"] * NIV["bombo"] + pistas["perc"] * NIV["perc"]
         + pistas["hats"] * NIV["hats"] + pistas["bajo"] * NIV["bajo"]
         + pistas["mallet_r"] * NIV["mallet"] + pistas["pad_r"] * NIV["pad"]
         + pistas["mel"] * NIV["mel"] + pistas["fx_r"] * NIV["fx"])

    # Dos envios, no doce convoluciones: una sala corta para lo percutido y un hall largo
    # para pad, gancho y efectos. Los retornos van filtrados (un reverb con graves embarra)
    # y duckeados por el bombo.
    env_sala = (pistas["perc"] * 0.5 + pistas["hats"] * 0.3
                + (pistas["mallet_l"] + pistas["mallet_r"]) * 0.35)
    env_hall = ((pistas["pad_l"] + pistas["pad_r"]) * 0.30 + pistas["mel"] * 0.45
                + (pistas["fx_l"] + pistas["fx_r"]) * 0.30)
    for envio, ir, g in ((env_sala, ir_sala, 0.16), (env_hall, ir_hall, 0.26)):
        cola = conv(envio, ir)
        cola = pasabajos(pasaaltos(cola, 280, 2), 7000, 2) * sc_rev * g
        L += cola
        R += cola * 0.92                       # la cola apenas distinta a cada lado

    # En la camara lenta la cola del hall se abre: es la mitad del efecto.
    extra = conv(env_hall, ir_hall)
    extra = pasabajos(pasaaltos(extra, 280, 2), 7000, 2)
    vent = np.zeros(n)
    vent[g0:g1] = 1.0
    na = min(int(0.30 * SR), g1 - g0)
    vent[g0:g0 + na] = np.linspace(0, 1, na)
    nb = min(int(0.25 * SR), g1 - g0)
    vent[g1 - nb:g1] = np.linspace(1, 0, nb)
    L += extra * vent * 0.42
    R += extra * vent * 0.39

    L, R = corregir_espectro(L, R)
    L, R = side_mono_abajo(L, R, 120.0)
    L, R = saturar(L, 1.15), saturar(R, 1.15)
    L, gr = comp_bus(L)
    R, _ = comp_bus(R)
    print("  compresion de bus: %.1f dB de reduccion en los picos" % gr)

    # arranque y final limpios
    nf = int(0.12 * SR)
    L[:nf] *= np.linspace(0, 1, nf)
    R[:nf] *= np.linspace(0, 1, nf)
    nf = int(0.90 * SR)
    L[-nf:] *= np.linspace(1, 0, nf) ** 1.4
    R[-nf:] *= np.linspace(1, 0, nf) ** 1.4

    p = max(np.abs(L).max(), np.abs(R).max())
    L, R = L / p * 0.90, R / p * 0.90
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
