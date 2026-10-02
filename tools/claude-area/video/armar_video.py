#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Arma el video tutorial "Claude en Barack" a partir de la narracion ya grabada.

Lee  escenas.json  (el video como datos)  +  la carpeta de la voz (narracion.txt y partes/NN.wav)
Deja el MP4 (1920x1080, 30 cuadros por segundo, H.264 + AAC), un .srt al lado y, en control/,
un cuadro de cada toma y una hoja con todos juntos.

Uso:
    python armar_video.py                     arma el video, el .srt y el control
    python armar_video.py --sin-subtitulos    no graba los subtitulos en la imagen (el .srt sale igual)
    python armar_video.py --musica tema.mp3   pone ese tema debajo de la voz (22 dB mas bajo)
    python armar_video.py --faltan            solo lista las tomas que faltan; no arma nada
    python armar_video.py --grilla            deja en control/_grilla/ cada captura con una cuadricula
                                              de 10 en 10 y los recuadros, para ubicarlos
    python armar_video.py --solo-control      vuelve a controlar el video que ya esta armado
    python armar_video.py --escenas otro.json --salida otro.mp4

Sale con:
    0  salio completo
    1  falta alguna toma (sale igual, con una lamina "FALTA LA TOMA") o hay un recuadro en
       posicion estimada sobre una captura que ya esta puesta
    2  escenas.json o la voz tienen algo mal (lo dice en pantalla); no arma nada
    3  el video se armo pero no pasa el control tecnico

Solo usa Python, Pillow y ffmpeg (que ya esta en la PC). No baja ni instala nada.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
W, H, FPS = 1920, 1080, 30
DIR_FUENTES = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
EXT_VIDEO = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v")
EXT_IMAGEN = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
MAX_PALABRAS = 6

# ------------------------------------------------------------------ colores (los del manual)
BLANCO = (255, 255, 255)
NEGRO = (0, 0, 0)
AZUL_OSC = (0x1F, 0x3A, 0x5F)
AZUL = (0x2F, 0x6F, 0xB0)
CELESTE = (0xEA, 0xF2, 0xFB)
PLACA_FONDO = (0xF4, 0xF7, 0xFB)
TINTA = (0x1B, 0x27, 0x33)
GRIS = (0x6B, 0x77, 0x83)
GRIS_BORDE = (0xC9, 0xD2, 0xDC)
AZUL_CLARO = (0xA9, 0xC0, 0xDA)
ROJO = (0xE1, 0x25, 0x1B)
AMBAR = (0x7A, 0x52, 0x00)
AMBAR_FONDO = (0xFF, 0xF0, 0xCC)
SUB_FONDO = (0x12, 0x22, 0x38)

SUB_PX = 58                # letra de los subtitulos: se tiene que leer en un celular
SUB_ANCHO = 1740
FRANJA_PX = 52
FUNDIDO_NEGRO_ENTRADA = 0.3
FUNDIDO_NEGRO_SALIDA = 0.7
FUNDIDO_ESTADO = 0.3       # lo que tarda en aparecer un recuadro o un renglon


class ErrorDeDatos(Exception):
    pass


# ================================================================== utilidades
def ffmpeg_bin(nombre):
    ruta = shutil.which(nombre)
    if not ruta:
        raise ErrorDeDatos(f"No encuentro {nombre} en esta PC (tiene que estar instalado y en el PATH).")
    return ruta


def correr(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def suave(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def seg(x):
    return f"{x:.1f}".replace(".", ",") + " s"


def palabras(texto):
    return len(re.findall(r"[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", texto or ""))


_FUENTES = {}
_ARCHIVOS = {
    "normal": ("segoeui.ttf", "arial.ttf"),
    "media": ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"),
    "negrita": ("segoeuib.ttf", "arialbd.ttf"),
}


def fuente(px, peso="normal"):
    clave = (px, peso)
    if clave not in _FUENTES:
        for nombre in _ARCHIVOS[peso]:
            if (DIR_FUENTES / nombre).exists():
                _FUENTES[clave] = ImageFont.truetype(str(DIR_FUENTES / nombre), px)
                break
        else:
            raise ErrorDeDatos("No encuentro la letra Segoe UI ni Arial en " + str(DIR_FUENTES))
    return _FUENTES[clave]


def partir(texto, fnt, ancho):
    """Parte un texto en renglones que entren en 'ancho' pixeles."""
    renglones, actual = [], ""
    for pal in texto.split():
        prueba = (actual + " " + pal).strip()
        if actual and fnt.getlength(prueba) > ancho:
            renglones.append(actual)
            actual = pal
        else:
            actual = prueba
    if actual:
        renglones.append(actual)
    return renglones


def partir_parejo(texto, fnt, ancho):
    """Como partir(), pero si son dos renglones los deja de largo parecido."""
    renglones = partir(texto, fnt, ancho)
    if len(renglones) != 2:
        return renglones
    pals = texto.split()
    mejor, mejor_w = renglones, max(fnt.getlength(r) for r in renglones)
    for i in range(1, len(pals)):
        a, b = " ".join(pals[:i]), " ".join(pals[i:])
        w = max(fnt.getlength(a), fnt.getlength(b))
        if w < mejor_w and w <= ancho:
            mejor, mejor_w = [a, b], w
    return mejor


def letra_que_entra(texto, peso, px_max, px_min, ancho):
    px = px_max
    while px > px_min and fuente(px, peso).getlength(texto) > ancho:
        px -= 2
    return fuente(px, peso)


def punteado(d, caja, color, grosor=3, raya=22, hueco=14):
    x0, y0, x1, y1 = caja
    for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x0, y1, x1, y1), (x0, y0, x0, y1), (x1, y0, x1, y1)):
        largo, p = max(bx - ax, by - ay), 0
        while p < largo:
            q = min(p + raya, largo)
            if ay == by:
                d.line([ax + p, ay, ax + q, ay], fill=color, width=grosor)
            else:
                d.line([ax, ay + p, ax, ay + q], fill=color, width=grosor)
            p += raya + hueco


# ================================================================== la voz
class Parrafo:
    def __init__(self, n, texto, wav, cortes_medidos):
        self.n, self.texto, self.wav = n, texto, wav
        with wave.open(str(wav), "rb") as w:
            self.formato = (w.getnchannels(), w.getsampwidth(), w.getframerate())
            self.muestras = w.getnframes()
        self.dur = self.muestras / self.formato[2]
        self.frases = [f for f in re.split(r"(?<=[.?!])\s+", texto) if f]
        self.t0 = self.t1 = 0.0
        self.aviso = None
        m = len(self.frases)
        if len(cortes_medidos) == m - 1:
            self.cortes = cortes_medidos
        else:
            # no se pudo medir donde termina cada frase: se reparte por cantidad de letras
            total, acum, self.cortes = sum(len(f) for f in self.frases), 0, []
            for f in self.frases[:-1]:
                acum += len(f)
                tc = self.dur * acum / total
                self.cortes.append((tc - 0.15, tc + 0.15))
            self.aviso = (f"parrafo {n}: tiene {m} frases y se midieron {len(cortes_medidos)} pausas; "
                          f"los cambios adentro del parrafo van repartidos por cantidad de letras")

    def frase_ini(self, j):                       # j desde 1
        return 0.0 if j == 1 else self.cortes[j - 2][1]

    def frase_fin(self, j):
        return self.dur if j == len(self.frases) else self.cortes[j - 1][0]

    def corte_medio(self, j):                     # el medio de la pausa que sigue a la frase j
        a, b = self.cortes[j - 1]
        return (a + b) / 2


def pausas_del_wav(wav, dur):
    """Las pausas entre frases (la voz deja ~0,6 s entre una y otra)."""
    r = correr([ffmpeg_bin("ffmpeg"), "-hide_banner", "-nostats", "-i", str(wav), "-af",
                "silencedetect=noise=-40dB:d=0.40", "-f", "null", "-"])
    ini = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    fin = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", r.stderr)]
    return [(a, b) for a, b in zip(ini, fin) if a > 0.10 and b < dur - 0.10]


def leer_voz(carpeta):
    txt = carpeta / "narracion.txt"
    if not txt.exists():
        raise ErrorDeDatos(f"No encuentro la narracion: {txt}")
    textos = [" ".join(p.split()) for p in txt.read_text(encoding="utf-8").split("\n\n") if p.strip()]
    wavs = sorted(p for p in (carpeta / "partes").glob("*.wav") if re.fullmatch(r"\d+", p.stem))
    if len(wavs) != len(textos):
        raise ErrorDeDatos(f"narracion.txt tiene {len(textos)} parrafos y en partes/ hay {len(wavs)} WAV: no coinciden.")
    parrafos = {}
    for texto, wav in zip(textos, wavs):
        n = int(wav.stem)
        with wave.open(str(wav), "rb") as w:
            dur = w.getnframes() / w.getframerate()
        parrafos[n] = Parrafo(n, texto, wav, pausas_del_wav(wav, dur))
    if sorted(parrafos) != list(range(1, len(textos) + 1)):
        raise ErrorDeDatos("Los WAV de partes/ no estan numerados de corrido desde 01.")
    formatos = {p.formato for p in parrafos.values()}
    if len(formatos) != 1:
        raise ErrorDeDatos(f"Los WAV de la voz no tienen todos el mismo formato: {formatos}")
    return parrafos


# ================================================================== escenas.json
class Toma:
    def __init__(self, escena, k, d):
        self.escena, self.k, self.d = escena, k, d
        self.piezas = []           # (parrafo, frase_desde, frase_hasta)
        self.t0 = self.t1 = 0.0
        self.frases_t = []         # cuando empieza cada frase de la toma (segundos del video)
        self.tipo = None           # imagen | video | lamina | falta
        self.ruta = None
        self.visual = None
        self.extra = float(d.get("segundos_extra", 0) or 0)
        self.texto = d.get("texto_en_pantalla", escena.texto)
        self.que = d.get("que_tiene_que_verse", "")
        self.recuadros = d.get("recuadros", []) or []
        self.zoom = d.get("zoom")
        self.encuadre = d.get("encuadre")              # que parte de la imagen se usa (porcentaje)
        self.escala_maxima = d.get("escala_maxima")    # cuanto se la puede agrandar (1.0 = tamaño real)
        self.pendiente = d.get("pendiente")            # "falta reemplazar por la toma real: ..."
        self.avisos = []

    @property
    def nombre(self):
        return f"E{self.escena.numero}-T{self.k + 1}"

    @property
    def dur(self):
        return self.t1 - self.t0

    def voz_txt(self):
        return " + ".join(str(v) for v in self.d.get("voz", []))


class Escena:
    def __init__(self, d):
        self.d = d
        self.numero = d.get("numero")
        self.titulo = d.get("titulo", "")
        self.parrafos = d.get("parrafos", [])
        self.texto = d.get("texto_en_pantalla", "")
        self.antes = d.get("antes_de_publicar", []) or []
        self.t0 = self.t1 = 0.0
        tomas = d.get("tomas")
        if not tomas:              # forma corta: un solo recurso para toda la escena
            tomas = [{c: d[c] for c in ("recurso", "que_tiene_que_verse", "recuadros", "zoom", "lamina",
                                        "desde", "hasta", "velocidad") if c in d}]
            tomas[0]["voz"] = [str(n) for n in self.parrafos]
        self.tomas = [Toma(self, k, t) for k, t in enumerate(tomas)]

    # --- lo que pide la linea de tiempo
    def toma_en(self, t):
        for tm in self.tomas:
            if t < tm.t1:
                return tm
        return self.tomas[-1]

    def cuadro(self, t):
        tm = self.toma_en(t)
        return tm.visual.cuadro(t - tm.t0)

    def clave(self, t):
        tm = self.toma_en(t)
        c = tm.visual.clave(t - tm.t0)
        return None if c is None else (tm.nombre, c)


def leer_pieza(texto, parrafos, donde):
    m = re.fullmatch(r"\s*(\d+)\s*(?::\s*(\d+)\s*(?:-\s*(\d+))?)?\s*", str(texto))
    if not m:
        raise ErrorDeDatos(f"{donde}: no entiendo la voz '{texto}'. Va '4', '4:1' o '4:2-3'.")
    p = int(m.group(1))
    if p not in parrafos:
        raise ErrorDeDatos(f"{donde}: el parrafo {p} no existe (hay {len(parrafos)}).")
    total = len(parrafos[p].frases)
    a = int(m.group(2)) if m.group(2) else 1
    b = int(m.group(3)) if m.group(3) else (a if m.group(2) else total)
    if not (1 <= a <= b <= total):
        raise ErrorDeDatos(f"{donde}: el parrafo {p} tiene {total} frases; '{texto}' pide de la {a} a la {b}.")
    return (p, a, b)


def leer_escenas(ruta, parrafos):
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise ErrorDeDatos(f"No puedo leer {ruta}: {e}")
    escenas = [Escena(d) for d in datos.get("escenas", [])]
    if not escenas:
        raise ErrorDeDatos("escenas.json no trae ninguna escena.")
    usados = []
    for e in escenas:
        donde = f"escena {e.numero}"
        if not e.parrafos:
            raise ErrorDeDatos(f"{donde}: no tiene parrafos.")
        if palabras(e.titulo) > MAX_PALABRAS:
            raise ErrorDeDatos(f"{donde}: el titulo tiene mas de {MAX_PALABRAS} palabras.")
        usados += e.parrafos
        esperado = [(p, j) for p in e.parrafos if p in parrafos for j in range(1, len(parrafos[p].frases) + 1)]
        cubierto = []
        for tm in e.tomas:
            dt = f"{donde}, toma {tm.k + 1}"
            if not tm.d.get("voz"):
                raise ErrorDeDatos(f"{dt}: no dice que parte de la voz tapa ('voz').")
            if not tm.d.get("recurso"):
                raise ErrorDeDatos(f"{dt}: no tiene 'recurso'.")
            tm.piezas = [leer_pieza(v, parrafos, dt) for v in tm.d["voz"]]
            cubierto += [(p, j) for (p, a, b) in tm.piezas for j in range(a, b + 1)]
            if palabras(tm.texto) > MAX_PALABRAS:
                raise ErrorDeDatos(f"{dt}: el texto en pantalla «{tm.texto}» tiene mas de {MAX_PALABRAS} palabras.")
            if tm.extra:
                p, _, b = tm.piezas[-1]
                if b != len(parrafos[p].frases):
                    raise ErrorDeDatos(f"{dt}: 'segundos_extra' solo va si la toma termina con un parrafo entero.")
            for r in tm.recuadros:
                if not all(isinstance(r.get(c), (int, float)) for c in ("x", "y", "ancho", "alto")):
                    raise ErrorDeDatos(f"{dt}: un recuadro necesita x, y, ancho y alto (en porcentaje).")
            if tm.d["recurso"] == "lamina":
                for r in (tm.d.get("lamina") or {}).get("renglones", []):
                    t = r["texto"] if isinstance(r, dict) else r
                    if palabras(t) > MAX_PALABRAS:
                        raise ErrorDeDatos(f"{dt}: el renglon «{t}» tiene mas de {MAX_PALABRAS} palabras.")
        if cubierto != esperado:
            raise ErrorDeDatos(f"{donde}: las tomas no cubren justo sus parrafos {e.parrafos}, frase por frase y en orden.")
    if usados != sorted(parrafos):
        faltan = sorted(set(parrafos) - set(usados))
        repetidos = sorted({p for p in usados if usados.count(p) > 1})
        raise ErrorDeDatos("Los parrafos de la narracion tienen que estar todos, una vez y en orden. "
                           f"Sin escena: {faltan or 'ninguno'}. Repetidos: {repetidos or 'ninguno'}. Orden leido: {usados}")
    return datos, escenas


def buscar_grabacion(base, nombre):
    for carpeta in (base / "tomas",):
        for ext in EXT_VIDEO:
            p = carpeta / (nombre + ext)
            if p.exists():
                return p
    return None


def resolver_recursos(escenas, base):
    """Decide que se ve en cada toma: la grabacion si esta, si no la imagen, si no 'falta'."""
    for e in escenas:
        entera = buscar_grabacion(base, f"escena-{e.numero}")
        if entera:
            d = dict(e.d.get("grabacion") or {})
            d.update({"voz": [str(n) for n in e.parrafos], "recurso": str(entera),
                      "que_tiene_que_verse": "la escena entera"})
            unica = Toma(e, 0, d)
            unica.piezas = [(p, 1, None) for p in e.parrafos]
            unica.tipo, unica.ruta = "video", entera
            unica.extra = sum(t.extra for t in e.tomas)
            e.tomas = [unica]
            continue
        for tm in e.tomas:
            rec = tm.d["recurso"]
            if rec == "lamina":
                tm.tipo = "lamina"
                continue
            p = Path(rec)
            p = (p if p.is_absolute() else (base / p)).resolve()
            tm.ruta = p
            grab = buscar_grabacion(base, p.stem)
            if grab:
                tm.tipo, tm.ruta = "video", grab
            elif p.exists() and p.suffix.lower() in EXT_VIDEO:
                tm.tipo = "video"
            elif p.exists() and p.suffix.lower() in EXT_IMAGEN:
                tm.tipo = "imagen"
            elif p.exists():
                raise ErrorDeDatos(f"{tm.nombre}: no se que hacer con {p.name} (va una imagen png/jpg o un video mp4/mov/mkv).")
            else:
                tm.tipo = "falta"


# ================================================================== la linea de tiempo
def armar_linea(escenas, parrafos, aj, inicio):
    aire, pausa = aj["aire_de_escena_s"], aj["pausa_entre_parrafos_s"]
    t = inicio
    for e in escenas:
        extra_tras = {}
        for tm in e.tomas:
            tm.piezas = [(p, a, b if b else len(parrafos[p].frases)) for (p, a, b) in tm.piezas]
            if tm.extra:
                extra_tras[tm.piezas[-1][0]] = tm.extra
        e.t0 = t
        cur = t + aire / 2
        for i, n in enumerate(e.parrafos):
            p = parrafos[n]
            p.t0, p.t1 = cur, cur + p.dur
            p.extra = extra_tras.get(n, 0.0)
            cur = p.t1 + p.extra + (pausa if i < len(e.parrafos) - 1 else 0.0)
        e.t1 = cur + aire / 2
        t = e.t1
        for k, tm in enumerate(e.tomas):
            tm.t0 = e.t0 if k == 0 else e.tomas[k - 1].t1
            if k == len(e.tomas) - 1:
                tm.t1 = e.t1
            else:
                p, _, b = tm.piezas[-1]
                p2 = e.tomas[k + 1].piezas[0][0]
                tm.t1 = (parrafos[p].t0 + parrafos[p].corte_medio(b)) if p2 == p else (parrafos[p2].t0 - pausa / 2)
            tm.frases_t = [parrafos[p].t0 + parrafos[p].frase_ini(j) for (p, a, b) in tm.piezas for j in range(a, b + 1)]
    return t


# ================================================================== subtitulos
def trozos_de_subtitulo(frase, fnt):
    if len(partir(frase, fnt, SUB_ANCHO)) <= 2:
        return [frase]
    medio = len(frase) / 2
    cortes = [m.end() for m in re.finditer(r"[,:;]\s", frase)] or [m.end() for m in re.finditer(r"\s", frase)]
    c = min(cortes, key=lambda x: abs(x - medio))
    return trozos_de_subtitulo(frase[:c].strip(), fnt) + trozos_de_subtitulo(frase[c:].strip(), fnt)


def armar_subtitulos(escenas, parrafos):
    """Una entrada por frase (o por pedazo de frase si no entra en dos renglones), con su tiempo."""
    fnt = fuente(SUB_PX, "media")
    cues = []
    for e in escenas:
        for n in e.parrafos:
            p = parrafos[n]
            propios = []
            for j, frase in enumerate(p.frases, 1):
                ini, fin = p.t0 + p.frase_ini(j), p.t0 + p.frase_fin(j)
                partes = trozos_de_subtitulo(frase, fnt)
                total, acum = sum(len(x) for x in partes), 0
                for x in partes:
                    propios.append([ini + (fin - ini) * acum / total, None, partir_parejo(x, fnt, SUB_ANCHO)])
                    acum += len(x)
            for i, c in enumerate(propios):
                c[1] = propios[i + 1][0] if i + 1 < len(propios) else p.t1
            cues += propios
    return [tuple(c) for c in cues]


def hora_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def escribir_srt(cues, ruta):
    bloques = [f"{i}\n{hora_srt(a)} --> {hora_srt(b)}\n" + "\n".join(lineas) + "\n"
               for i, (a, b, lineas) in enumerate(cues, 1)]
    ruta.write_text("\n".join(bloques), encoding="utf-8")


# ================================================================== el dibujo
class Plano:
    """Donde va cada cosa en el cuadro. Con subtitulos, abajo quedan dos franjas: el texto y el subtitulo."""

    def __init__(self, con_subtitulos):
        if con_subtitulos:
            self.area = (24, 16, W - 24, 790)
            self.franja = (0, 804, W, 892)
            self.subs = (0, 892, W, H)      # 188 px: dos renglones de subtitulo con aire
        else:
            self.area = (24, 20, W - 24, 956)
            self.franja = (0, 974, W, H)
            self.subs = None
        self.aw, self.ah = self.area[2] - self.area[0], self.area[3] - self.area[1]
        self._bandas = {}

    def base(self, texto):
        im = Image.new("RGB", (W, H), AZUL_OSC)
        d = ImageDraw.Draw(im)
        if self.subs:
            d.rectangle([self.subs[0], self.subs[1], self.subs[2] - 1, self.subs[3] - 1], fill=SUB_FONDO)
        if texto:
            x0, y0, x1, y1 = self.franja
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=AZUL)
            fnt = letra_que_entra(texto, "negrita", FRANJA_PX, 34, W - 160)
            d.text(((x0 + x1) / 2, (y0 + y1) / 2 - 2), texto, font=fnt, fill=BLANCO, anchor="mm")
        return im

    def banda_sub(self, lineas):
        clave = tuple(lineas)
        if clave not in self._bandas:
            x0, y0, x1, y1 = self.subs
            im = Image.new("RGB", (x1 - x0, y1 - y0), SUB_FONDO)
            d = ImageDraw.Draw(im)
            fnt = fuente(SUB_PX, "media")
            paso = round(SUB_PX * 1.22)
            y = (y1 - y0) / 2 - paso * (len(lineas) - 1) / 2 - 3
            for l in lineas:
                d.text(((x1 - x0) / 2, y), l, font=fnt, fill=BLANCO, anchor="mm")
                y += paso
            self._bandas[clave] = im
        return self._bandas[clave]


def dibujar_placa(texto, credito=None, logo=None):
    im = Image.new("RGB", (W, H), PLACA_FONDO)
    d = ImageDraw.Draw(im)
    y = 330 if logo else 470
    if logo:
        lg = Image.open(logo).convert("RGBA")
        ancho = 560
        lg = lg.resize((ancho, round(ancho * lg.size[1] / lg.size[0])), Image.LANCZOS)
        im.paste(lg, ((W - ancho) // 2, y - lg.size[1] // 2), lg)
        y += lg.size[1] // 2 + 70
        d.rectangle([W // 2 - 120, y, W // 2 + 120, y + 5], fill=AZUL)
        y += 95
    fnt = letra_que_entra(texto, "negrita", 84, 48, W - 240)
    d.text((W / 2, y), texto, font=fnt, fill=AZUL_OSC, anchor="mm")
    if credito:
        d.text((W / 2, H - 70), credito, font=letra_que_entra(credito, "normal", 30, 22, W - 200), fill=GRIS, anchor="mm")
    return im


def dibujar_falta(tam, tm):
    """La lamina que ocupa el lugar de una toma que todavia no existe."""
    aw, ah = tam
    im = Image.new("RGB", tam, AZUL_OSC)
    d = ImageDraw.Draw(im)
    punteado(d, (8, 8, aw - 9, ah - 9), AZUL_CLARO)
    e = tm.escena
    etiqueta = f"ESCENA {e.numero} · TOMA {tm.k + 1} DE {len(e.tomas)} · VOZ: PÁRRAFO {tm.voz_txt().replace(':', ', FRASE ')}"
    f_tit = letra_que_entra(e.titulo, "negrita", 92, 56, aw - 240)
    for px in (40, 36, 32, 28):
        f_desc = fuente(px, "normal")
        desc = partir(tm.que or "(sin describir)", f_desc, aw - 320)
        if len(desc) <= 5:
            break
    paso = round(f_desc.size * 1.32)
    try:
        esperado = tm.ruta.relative_to(AQUI.parent).as_posix() if tm.ruta else ""
    except ValueError:
        esperado = tm.ruta.name
    alto = 40 + 22 + round(f_tit.size * 1.2) + 34 + 66 + 30 + paso * len(desc) + 30 + 34
    y = (ah - alto) / 2
    d.text((aw / 2, y + 20), etiqueta, font=fuente(28, "media"), fill=AZUL_CLARO, anchor="mm")
    y += 40 + 22
    d.text((aw / 2, y + f_tit.size * 0.6), e.titulo, font=f_tit, fill=BLANCO, anchor="mm")
    y += round(f_tit.size * 1.2) + 34
    f_pill = fuente(38, "negrita")
    wp = f_pill.getlength("FALTA LA TOMA") + 64
    d.rounded_rectangle([aw / 2 - wp / 2, y, aw / 2 + wp / 2, y + 66], radius=12, fill=AMBAR_FONDO)
    d.text((aw / 2, y + 31), "FALTA LA TOMA", font=f_pill, fill=AMBAR, anchor="mm")
    y += 66 + 30
    for l in desc:
        d.text((aw / 2, y + paso / 2), l, font=f_desc, fill=BLANCO, anchor="mm")
        y += paso
    y += 30
    d.text((aw / 2, y + 17), f"Archivo que se espera: {esperado}", font=fuente(26, "normal"), fill=AZUL_CLARO, anchor="mm")
    return im


def dibujar_lamina(tam, titulo, renglones, visibles, cita=None):
    """Lamina de texto sobre fondo claro. Los renglones que todavia no aparecieron dejan su lugar.
    Con 'cita' muestra, en un globo, lo que la persona le escribe a Claude."""
    aw, ah = tam
    im = Image.new("RGB", tam, CELESTE)
    d = ImageDraw.Draw(im)
    if cita:
        margen = 190
        f_tit = letra_que_entra(titulo or " ", "negrita", 70, 46, aw - 2 * margen)
        for px in (58, 52, 46, 40):
            f_c = fuente(px, "normal")
            lineas = partir("«" + cita + "»", f_c, aw - 2 * margen - 120)
            if len(lineas) <= 4:
                break
        paso = round(f_c.size * 1.4)
        alto_globo = paso * len(lineas) + 90
        alto = (round(f_tit.size * 1.25) + 50 if titulo else 0) + alto_globo
        y = (ah - alto) / 2
        if titulo:
            d.text((margen, y + f_tit.size * 0.62), titulo, font=f_tit, fill=AZUL_OSC, anchor="lm")
            y += round(f_tit.size * 1.25) + 50
        d.rounded_rectangle([margen, y, aw - margen, y + alto_globo], radius=28, fill=BLANCO, outline=AZUL, width=4)
        yy = y + 45 + paso / 2
        for l in lineas:
            d.text((margen + 60, yy - 3), l, font=f_c, fill=TINTA, anchor="lm")
            yy += paso
        return im
    if titulo:
        margen = 190
        f_tit = letra_que_entra(titulo, "negrita", 78, 50, aw - 2 * margen)
        mas_largo = max(renglones, key=len) if renglones else ""
        f_r = letra_que_entra(mas_largo, "negrita", 74, 44, aw - 2 * margen - 70)
        paso = round(f_r.size * 1.75)
        alto = round(f_tit.size * 1.25) + 36 + 60 + paso * len(renglones)
        y = (ah - alto) / 2
        d.text((margen, y + f_tit.size * 0.62), titulo, font=f_tit, fill=AZUL_OSC, anchor="lm")
        y += round(f_tit.size * 1.25) + 36
        d.rectangle([margen, y, margen + 200, y + 6], fill=AZUL)
        y += 60
        for i, r in enumerate(renglones):
            if i < visibles:
                cy = y + paso / 2
                d.rectangle([margen, cy - 13, margen + 26, cy + 13], fill=AZUL)
                d.text((margen + 70, cy - 3), r, font=f_r, fill=TINTA, anchor="lm")
            y += paso
    else:
        mas_largo = max(renglones, key=len) if renglones else ""
        f_r = letra_que_entra(mas_largo, "negrita", 104, 50, aw - 300)
        paso = round(f_r.size * 1.6)
        y = (ah - paso * len(renglones)) / 2
        for i, r in enumerate(renglones):
            if i < visibles:
                d.text((aw / 2, y + paso / 2 - 4), r, font=f_r, fill=AZUL_OSC, anchor="mm")
            y += paso
    return im


def abrir_imagen(ruta):
    im = Image.open(ruta)
    if im.mode in ("RGBA", "LA", "P"):             # con transparencia: se apoya sobre blanco
        im = im.convert("RGBA")
        fondo = Image.new("RGB", im.size, BLANCO)
        fondo.paste(im, (0, 0), im)
        return fondo
    return im.convert("RGB")


def huella(ruta):
    """El principio del sha1 del archivo: para saber si la captura cambio desde que se ubico un recuadro."""
    return hashlib.sha1(Path(ruta).read_bytes()).hexdigest()[:12]


def confirmado(recuadro, ruta):
    """posicion_confirmada: la huella de la captura sobre la que se ubico el recuadro (o true).
    Con la huella, si despues cambian la captura el recuadro vuelve a quedar 'sin ubicar' solo."""
    c = recuadro.get("posicion_confirmada")
    if isinstance(c, str):
        return c.strip().lower() == huella(ruta)
    return c is True


def marcar(im, recuadros, escala):
    """Dibuja los recuadros rojos (con borde blanco, por si la app es oscura) arriba de la imagen."""
    im = im.copy()
    d = ImageDraw.Draw(im)
    iw, ih = im.size
    g = max(3, round(5 / escala))
    halo = max(1, round(1.5 / escala))
    for r in recuadros:
        x0, y0 = iw * r["x"] / 100, ih * r["y"] / 100
        x1, y1 = x0 + iw * r["ancho"] / 100, y0 + ih * r["alto"] / 100
        # el marco va por AFUERA de lo marcado (no le pisa la letra), salvo donde se termina la imagen
        ex0, ey0 = max(0, x0 - g - 2 * halo), max(0, y0 - g - 2 * halo)
        ex1, ey1 = min(iw - 1, x1 + g + 2 * halo), min(ih - 1, y1 + g + 2 * halo)
        d.rectangle([ex0, ey0, ex1, ey1], outline=BLANCO, width=g + 2 * halo)
        d.rectangle([ex0 + halo, ey0 + halo, ex1 - halo, ey1 - halo], outline=ROJO, width=g)
        x0, y0 = ex0, ey0
        if r.get("numero") is not None:
            rad = max(12, round(26 / escala))
            d.ellipse([x0 - rad, y0 - rad, x0 + rad, y0 + rad], fill=ROJO, outline=BLANCO, width=halo * 2)
            d.text((x0, y0 - rad * 0.08), str(r["numero"]), font=fuente(round(rad * 1.3), "negrita"), fill=BLANCO, anchor="mm")
    return im


# ================================================================== lo que se ve en cada toma
class Estados:
    """Una toma pasa por estados (recuadro 1, recuadro 2... o renglon 1, 2, 3) que entran con un fundido corto."""

    def __init__(self, tiempos):
        self.tiempos = sorted(tiempos)          # cuando ENTRA cada estado 1..n (el 0 esta desde el principio)

    def en(self, t):
        k = sum(1 for x in self.tiempos if t >= x)
        if k and t < self.tiempos[k - 1] + FUNDIDO_ESTADO:
            antes = sum(1 for x in self.tiempos if x < self.tiempos[k - 1] - 1e-9)   # si entran dos juntos, entran juntos
            return antes, k, (t - self.tiempos[k - 1]) / FUNDIDO_ESTADO
        return k, k, 1.0


def cuando_entra(item, tm, por_defecto):
    n = item.get("con_la_frase") if isinstance(item, dict) else None
    if n is None:
        return por_defecto
    if not (1 <= n <= len(tm.frases_t)):
        raise ErrorDeDatos(f"{tm.nombre}: 'con_la_frase': {n}, y la toma tiene {len(tm.frases_t)} frases.")
    return max(0.0, tm.frases_t[n - 1] - tm.t0)


class VisualFijo:
    """Lamina de texto o lamina de 'falta la toma': no se mueve; a lo sumo le aparecen renglones."""

    def __init__(self, tm, plano):
        self.tm = tm
        tam = (plano.aw, plano.ah)
        if tm.tipo == "falta":
            contenidos, tiempos = [dibujar_falta(tam, tm)], []
        else:
            lam = tm.d.get("lamina") or {}
            titulo = lam.get("titulo", tm.escena.titulo)
            reng = lam.get("renglones") or ([] if lam.get("cita") else [tm.escena.texto or tm.escena.titulo])
            textos = [r["texto"] if isinstance(r, dict) else r for r in reng]
            entradas = [cuando_entra(r, tm, 0.0) for r in reng]
            if entradas != sorted(entradas):
                raise ErrorDeDatos(f"{tm.nombre}: los renglones de la lamina tienen que aparecer en orden.")
            fijos = sum(1 for x in entradas if x <= 0.0)
            tiempos = [x for x in entradas if x > 0.0]
            contenidos = [dibujar_lamina(tam, titulo, textos, fijos + i, lam.get("cita")) for i in range(len(tiempos) + 1)]
        base = plano.base(tm.texto)
        self.cuadros = []
        for c in contenidos:
            f = base.copy()
            f.paste(c, (plano.area[0], plano.area[1]))
            self.cuadros.append(f)
        self.estados = Estados(tiempos)

    def cuadro(self, t):
        a, b, alfa = self.estados.en(t)
        return self.cuadros[b] if a == b else Image.blend(self.cuadros[a], self.cuadros[b], alfa)

    def clave(self, t):
        a, b, _ = self.estados.en(t)
        return b if a == b else None

    def cerrar(self):
        pass


def encajar(iw, ih, plano, tope=None):
    s = min(plano.aw / iw, plano.ah / ih)
    if tope:                                           # una captura que ya viene agrandada se ve mejor mas chica
        s = min(s, float(tope))
    ow, oh = max(2, round(iw * s)), max(2, round(ih * s))
    pos = (plano.area[0] + (plano.aw - ow) // 2, plano.area[1] + (plano.ah - oh) // 2)
    return s, ow, oh, pos


def base_con_marco(plano, texto, pos, ow, oh):
    base = plano.base(texto)
    ImageDraw.Draw(base).rectangle([pos[0] - 2, pos[1] - 2, pos[0] + ow + 1, pos[1] + oh + 1], outline=GRIS_BORDE, width=2)
    return base


class VisualImagen:
    """Imagen fija con un acercamiento muy lento, o que se acerca despacio a lo marcado."""

    def __init__(self, tm, plano, aj):
        self.tm = tm
        im = abrir_imagen(tm.ruta)
        recuadros = tm.recuadros
        if tm.encuadre:                                # se usa solo una parte de la imagen
            e = tm.encuadre
            W0, H0 = im.size
            x0, y0 = W0 * e["x"] / 100, H0 * e["y"] / 100
            im = im.crop((round(x0), round(y0), round(x0 + W0 * e["ancho"] / 100), round(y0 + H0 * e["alto"] / 100)))
            recuadros = [dict(r, x=(r["x"] - e["x"]) * 100 / e["ancho"], y=(r["y"] - e["y"]) * 100 / e["alto"],
                              ancho=r["ancho"] * 100 / e["ancho"], alto=r["alto"] * 100 / e["alto"]) for r in recuadros]
        self.iw, self.ih = im.size
        s, self.ow, self.oh, self.pos = encajar(self.iw, self.ih, plano, tm.escala_maxima)
        if s < 0.7 and tm.zoom in (None, "no", "lento"):
            # imagen mucho mas grande que la pantalla (un PDF a 200 dpi) y sin acercamiento fuerte:
            # se la achica UNA vez, bien, en lugar de achicarla en cada cuadro
            f = min(1.0, s * 1.3)
            im = im.resize((round(self.iw * f), round(self.ih * f)), Image.LANCZOS)
            self.iw, self.ih = im.size
            s = s / f
        self.base = base_con_marco(plano, tm.texto, self.pos, self.ow, self.oh)
        entradas = sorted(((cuando_entra(r, tm, 0.8), i) for i, r in enumerate(recuadros)))
        orden = [recuadros[i] for _, i in entradas]
        self.fuentes = [im] + [marcar(im, orden[:n], s) for n in range(1, len(orden) + 1)]
        self.estados = Estados([t for t, _ in entradas])
        self.vel, self.tope = aj["zoom_lento_por_segundo"], aj["zoom_lento_tope"]
        self.destino = None
        self.quieta = tm.zoom == "no"
        z = tm.zoom
        if z == "al_recuadro" and not tm.recuadros:
            raise ErrorDeDatos(f"{tm.nombre}: pide zoom 'al_recuadro' y no tiene recuadros.")
        if z == "al_recuadro" or isinstance(z, dict):
            cajas = recuadros if z == "al_recuadro" else [z]
            x0 = min(c["x"] for c in cajas) * self.iw / 100
            y0 = min(c["y"] for c in cajas) * self.ih / 100
            x1 = max(c["x"] + c["ancho"] for c in cajas) * self.iw / 100
            y1 = max(c["y"] + c["alto"] for c in cajas) * self.ih / 100
            w = max((x1 - x0) * 1.25, (y1 - y0) * 1.25 * self.iw / self.ih, self.iw / aj["zoom_maximo"])
            w = min(w, self.iw)
            h = w * self.ih / self.iw
            dx = min(max((x0 + x1) / 2 - w / 2, 0), self.iw - w)
            dy = min(max((y0 + y1) / 2 - h / 2, 0), self.ih - h)
            if self.iw / w >= 1.08:                # si lo marcado ya ocupa casi todo, queda el acercamiento lento
                self.destino = (dx, dy, w)
            # se acerca durante toda la toma (despacio); el recuadro aparece cuando lo dice la voz
            self.t_ini = min(0.8, tm.dur * 0.15)
            self.t_fin = max(self.t_ini + 0.5, tm.dur - 0.4)
        elif z not in (None, "no", "lento"):
            raise ErrorDeDatos(f"{tm.nombre}: no entiendo el zoom '{z}'.")
        # el acercamiento lento se hace hacia lo marcado (o hacia el centro)
        if recuadros:
            r = orden[0]
            self.ancla = (self.iw * (r["x"] + r["ancho"] / 2) / 100, self.ih * (r["y"] + r["alto"] / 2) / 100)
        else:
            self.ancla = (self.iw / 2, self.ih / 2)

    def vista(self, t):
        iw, ih = self.iw, self.ih
        if self.quieta:
            return (0.0, 0.0, float(iw), float(ih))
        if self.destino:
            dx, dy, dw = self.destino
            u = suave((t - self.t_ini) / (self.t_fin - self.t_ini))
            w = iw * (dw / iw) ** u
            k = (iw - w) / (iw - dw) if iw - dw > 1e-6 else 0.0
            x0, y0 = dx * k, dy * k
        else:
            z = 1.0 + min(self.tope, self.vel * max(0.0, t))
            w = iw / z
            x0, y0 = self.ancla[0] * (1 - 1 / z), self.ancla[1] * (1 - 1 / z)
        x0, y0 = max(0.0, x0), max(0.0, y0)
        return (x0, y0, min(float(iw), x0 + w), min(float(ih), y0 + w * ih / iw))

    def cuadro(self, t):
        a, b, alfa = self.estados.en(t)
        caja = self.vista(t)
        c = self.fuentes[b].resize((self.ow, self.oh), Image.BICUBIC, box=caja)
        if a != b:
            c = Image.blend(self.fuentes[a].resize((self.ow, self.oh), Image.BICUBIC, box=caja), c, alfa)
        f = self.base.copy()
        f.paste(c, self.pos)
        return f

    def clave(self, t):
        a, b, _ = self.estados.en(t)
        return b if (self.quieta and a == b) else None

    def cerrar(self):
        pass


class VisualVideo:
    """Una grabacion de pantalla: se la lleva a la duracion de la voz y se lee cuadro por cuadro."""

    def __init__(self, tm, plano):
        self.tm = tm
        r = correr([ffmpeg_bin("ffprobe"), "-v", "error", "-select_streams", "v:0", "-show_entries",
                    "stream=width,height:format=duration", "-of", "json", str(tm.ruta)])
        try:
            info = json.loads(r.stdout)
            iw, ih = info["streams"][0]["width"], info["streams"][0]["height"]
            largo = float(info["format"]["duration"])
        except (ValueError, KeyError, IndexError):
            raise ErrorDeDatos(f"{tm.nombre}: no puedo leer la grabacion {tm.ruta.name}.")
        _, self.ow, self.oh, self.pos = encajar(iw, ih, plano, tm.escala_maxima)
        self.base = base_con_marco(plano, tm.texto, self.pos, self.ow, self.oh)
        self.desde = float(tm.d.get("desde", 0) or 0)
        hasta = float(tm.d.get("hasta", largo) or largo)
        self.tramo = max(0.1, min(hasta, largo) - self.desde)
        vel = tm.d.get("velocidad", "ajustar")
        self.vel = self.tramo / max(0.1, tm.dur) if vel == "ajustar" else float(vel)
        if not (0.5 <= self.vel <= 3.0):
            tm.avisos.append(f"{tm.nombre}: la grabacion dura {seg(self.tramo)} y la voz {seg(tm.dur)}: va a {self.vel:.2f}x. "
                             "Si se ve apurada o lenta, recortarla con 'desde' y 'hasta' o darle 'segundos_extra'.")
        if tm.recuadros or tm.zoom not in (None, "no", "lento"):
            tm.avisos.append(f"{tm.nombre}: es una grabacion; los recuadros y el zoom de la imagen fija no se aplican.")
        self.proc, self.n, self.ultimo = None, -1, None

    def _abrir(self):
        filtro = f"setpts=(PTS-STARTPTS)/{self.vel:.6f},fps={FPS},scale={self.ow}:{self.oh}:flags=lanczos"
        self.proc = subprocess.Popen(
            [ffmpeg_bin("ffmpeg"), "-v", "error", "-ss", f"{self.desde:.3f}", "-t", f"{self.tramo:.3f}", "-i", str(self.tm.ruta),
             "-an", "-vf", filtro, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def cuadro(self, t):
        if self.proc is None:
            self._abrir()
        quiero, tam = max(0, int(t * FPS)), self.ow * self.oh * 3
        while self.n < quiero:
            crudo = self.proc.stdout.read(tam)
            if len(crudo) < tam:
                break                              # se termino la grabacion: queda el ultimo cuadro
            self.ultimo, self.n = Image.frombytes("RGB", (self.ow, self.oh), crudo), self.n + 1
        f = self.base.copy()
        if self.ultimo is not None:
            f.paste(self.ultimo, self.pos)
        return f

    def clave(self, t):
        return None

    def cerrar(self):
        if self.proc:
            self.proc.stdout.close()
            self.proc.kill()
            self.proc.wait()


class Placa:
    def __init__(self, nombre, imagen, t0, t1):
        self.nombre, self.imagen, self.t0, self.t1 = nombre, imagen, t0, t1

    def cuadro(self, t):
        return self.imagen

    def clave(self, t):
        return (self.nombre, 0)


# ================================================================== el sonido
def armar_voz(parrafos, total, destino):
    nch, ancho, hz = next(iter(parrafos.values())).formato
    paso = nch * ancho
    buf = bytearray(int(round(total * hz)) * paso)
    for p in parrafos.values():
        with wave.open(str(p.wav), "rb") as w:
            datos = w.readframes(w.getnframes())
        ini = int(round(p.t0 * hz)) * paso
        buf[ini:ini + len(datos)] = datos
    buf = buf[:int(round(total * hz)) * paso]
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(ancho)
        w.setframerate(hz)
        w.writeframes(bytes(buf))


def sonoridad(archivo, hasta=None):
    """Sonoridad integrada (LUFS) y pico real (dBTP), medidos con ffmpeg."""
    cmd = [ffmpeg_bin("ffmpeg"), "-hide_banner", "-nostats"]
    if hasta:
        cmd += ["-t", f"{hasta:.3f}"]
    cmd += ["-i", str(archivo), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"]
    err = correr(cmd).stderr
    cola = err[err.rfind("Summary:"):] if "Summary:" in err else err
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", cola)
    p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", cola)
    if not i or not p:
        raise ErrorDeDatos(f"No pude medir el volumen de {Path(archivo).name}.")
    return float(i.group(1)), float(p.group(1))


def filtro_de_sonido(voz_wav, total, aj, musica):
    objetivo = aj["sonoridad_lufs"]
    lufs, pico = sonoridad(voz_wav)
    gan = objetivo - lufs
    pasos = [f"volume={gan:.2f}dB"]
    if pico + gan > -3.0:                          # el AAC suma sobrepico: se deja margen
        pasos.append("alimiter=limit=0.708:level=false:attack=5:release=60")
    pasos += ["aresample=48000", "aformat=sample_fmts=fltp:channel_layouts=stereo"]
    filtro = "[1:a]" + ",".join(pasos) + "[voz]"
    nota = f"voz medida {lufs:.1f} LUFS, pico {pico:.1f} dB -> se le suma {gan:+.1f} dB para dejarla en {objetivo:.0f} LUFS"
    if not musica:
        return filtro.replace("[voz]", "[a]"), nota
    m_lufs, _ = sonoridad(musica, hasta=total)
    m_gan = (objetivo - aj["musica_db_bajo_la_voz"]) - m_lufs
    cola = max(0.0, total - 2.5)
    filtro += (f";[2:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={m_gan:.2f}dB,"
               f"atrim=0:{total:.3f},afade=t=in:d=1.0,afade=t=out:st={cola:.3f}:d=2.5[mus];"
               "[voz][mus]amix=inputs=2:duration=first:normalize=0[a]")
    nota += (f"; musica medida {m_lufs:.1f} LUFS -> {m_gan:+.1f} dB, queda {aj['musica_db_bajo_la_voz']:.0f} dB debajo de la voz")
    return filtro, nota


# ================================================================== armar el MP4
def renderizar(elementos, cues, plano, total, fundido, voz_wav, musica, aj, salida):
    n_total = int(round(total * FPS))
    filtro_a, nota = filtro_de_sonido(voz_wav, total, aj, musica)
    print("  Sonido: " + nota)
    cmd = [ffmpeg_bin("ffmpeg"), "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(voz_wav)]
    if musica:
        cmd += ["-stream_loop", "-1", "-i", str(musica)]
    cmd += ["-filter_complex", "[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v];" + filtro_a,
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", str(aj["calidad_crf"]), "-profile:v", "high", "-level", "4.0",
            "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2),
            "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
            "-t", f"{n_total / FPS:.3f}", "-movflags", "+faststart", str(salida)]
    registro = tempfile.TemporaryFile()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=registro)
    negro = Image.new("RGB", (W, H), NEGRO)
    guardados = {}                                  # cuadros que se repiten (laminas quietas): se guardan ya armados
    idx_cue, hora, ultimo = 0, time.time(), len(elementos) - 1
    i = 0
    try:
        for n in range(n_total):
            t = n / FPS
            while i < ultimo and t >= elementos[i].t1:
                i += 1
            e = elementos[i]
            while idx_cue < len(cues) and t >= cues[idx_cue][1]:
                idx_cue += 1
            cue = cues[idx_cue] if (plano.subs and idx_cue < len(cues) and cues[idx_cue][0] <= t) else None
            mezcla = None
            if i > 0 and t < e.t0 + fundido / 2:
                mezcla = (elementos[i - 1], e, (t - (e.t0 - fundido / 2)) / fundido)
            elif i < ultimo and t >= e.t1 - fundido / 2:
                mezcla = (e, elementos[i + 1], (t - (e.t1 - fundido / 2)) / fundido)
            a_negro = None
            if t < FUNDIDO_NEGRO_ENTRADA:
                a_negro = t / FUNDIDO_NEGRO_ENTRADA
            elif t > total - FUNDIDO_NEGRO_SALIDA:
                a_negro = max(0.0, (total - t) / FUNDIDO_NEGRO_SALIDA)
            clave = None
            if mezcla is None and a_negro is None:
                c = e.clave(t)
                if c is not None:
                    clave = (c, idx_cue if cue else -1)
            if clave is not None and clave in guardados:
                crudo = guardados[clave]
            else:
                if mezcla:
                    img = Image.blend(mezcla[0].cuadro(t), mezcla[1].cuadro(t), min(max(mezcla[2], 0.0), 1.0))
                else:
                    img = e.cuadro(t)
                if cue:
                    img = img.copy()
                    img.paste(plano.banda_sub(cue[2]), (plano.subs[0], plano.subs[1]))
                if a_negro is not None:
                    img = Image.blend(negro, img, a_negro)
                crudo = img.tobytes()
                if clave is not None:
                    if len(guardados) >= 4:
                        guardados.pop(next(iter(guardados)))
                    guardados[clave] = crudo
            try:
                proc.stdin.write(crudo)
            except (BrokenPipeError, OSError):
                break
            if time.time() - hora > 15:
                hora = time.time()
                print(f"  ... {t:5.0f} de {total:.0f} s", flush=True)
        try:
            proc.stdin.close()
        except OSError:
            pass
    except BaseException:
        proc.kill()
        raise
    finally:
        codigo = proc.wait()
        registro.seek(0)
        error = registro.read().decode("utf-8", "replace").strip()
        registro.close()
    if codigo != 0:
        raise ErrorDeDatos("ffmpeg no pudo armar el video:\n" + error[-1500:])


# ================================================================== el control
def controlar(mp4, elementos, escenas, plano, dir_control):
    """Mide el archivo terminado y saca un cuadro de cada toma. Devuelve (paso, renglones)."""
    out, ok = [], True
    r = correr([ffmpeg_bin("ffprobe"), "-v", "error", "-show_entries",
                "format=duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt,"
                "duration,sample_rate,channels,color_space,color_transfer,color_primaries", "-of", "json", str(mp4)])
    info = json.loads(r.stdout)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    dv, da, dur = float(v["duration"]), float(a["duration"]), float(info["format"]["duration"])
    mb = int(info["format"]["size"]) / 1e6

    def chequeo(bien, texto):
        nonlocal ok
        ok = ok and bien
        out.append(("  OK    " if bien else "  MAL   ") + texto)

    out.append(f"  Archivo: {mp4.name} · {int(dur // 60)}:{dur % 60:04.1f} · {mb:.1f} MB")
    chequeo(v["width"] == W and v["height"] == H, f"resolucion {v['width']}x{v['height']}")
    chequeo(v["r_frame_rate"] == f"{FPS}/1", f"cuadros por segundo {v['r_frame_rate']}")
    chequeo(v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p", f"video {v['codec_name']} ({v.get('profile')}) {v['pix_fmt']}")
    chequeo(a["codec_name"] == "aac", f"sonido {a['codec_name']} {a['sample_rate']} Hz, {a['channels']} canales")
    chequeo(v.get("color_space") == "bt709" and v.get("color_transfer") == "bt709",
            f"color {v.get('color_space')}/{v.get('color_transfer')}/{v.get('color_primaries')}")
    chequeo(abs(dv - da) <= 0.2, f"video {dv:.2f} s y sonido {da:.2f} s (diferencia {abs(dv - da):.2f} s; tope 0,2)")
    esperado = elementos[-1].t1
    chequeo(abs(dur - esperado) <= 0.2, f"duracion {dur:.2f} s contra {esperado:.2f} s de la linea de tiempo")
    err = correr([ffmpeg_bin("ffmpeg"), "-hide_banner", "-nostats", "-i", str(mp4), "-vn", "-af", "volumedetect",
                  "-f", "null", "-"]).stderr
    medio = re.search(r"mean_volume: (-?[\d.]+) dB", err)
    maximo = re.search(r"max_volume: (-?[\d.]+) dB", err)
    lufs, pico = sonoridad(mp4)
    out.append(f"  Volumen (volumedetect): medio {medio.group(1)} dB, maximo {maximo.group(1)} dB")
    chequeo(-21.5 <= lufs <= -18.5 and pico <= -1.0, f"sonoridad {lufs:.1f} LUFS, pico real {pico:.1f} dBTP (se busca -20 LUFS y pico bajo -1)")

    dir_control.mkdir(parents=True, exist_ok=True)
    puntos = [("00-placa-apertura", "Placa de apertura", elementos[0].t0 + (elementos[0].t1 - elementos[0].t0) * 0.5)]
    for e in escenas:
        for tm in e.tomas:
            puntos.append((f"{tm.nombre}", f"{tm.nombre} · {tm.tipo}", tm.t0 + tm.dur * 0.85))   # mismo nombre siempre: se pisa
    puntos.append(("99-placa-final", "Placa final", elementos[-1].t0 + (elementos[-1].t1 - elementos[-1].t0) * 0.45))
    miniaturas = []
    for nombre, rotulo, t in puntos:
        jpg = dir_control / (nombre + ".jpg")
        correr([ffmpeg_bin("ffmpeg"), "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1",
                "-q:v", "2", str(jpg)])
        if not jpg.exists():
            chequeo(False, f"no pude sacar el cuadro de {rotulo} a los {t:.1f} s")
            continue
        miniaturas.append((rotulo + f" · {t:.0f} s", Image.open(jpg).convert("RGB")))
    # el fondo tiene que salir del color pedido (si la conversion de color esta mal, se corre)
    for rotulo, im in miniaturas[1:2]:
        px = im.getpixel((8, 8))
        chequeo(all(abs(px[i] - AZUL_OSC[i]) <= 8 for i in range(3)), f"color del fondo {px} contra {AZUL_OSC} pedido")
    col, mw, mh, alto_r = 4, 480, 270, 34
    filas = math.ceil(len(miniaturas) / col)
    hoja = Image.new("RGB", (col * mw, filas * (mh + alto_r)), BLANCO)
    d = ImageDraw.Draw(hoja)
    for i, (rotulo, im) in enumerate(miniaturas):
        x, y = (i % col) * mw, (i // col) * (mh + alto_r)
        hoja.paste(im.resize((mw, mh), Image.LANCZOS), (x, y + alto_r))
        d.text((x + 8, y + 5), rotulo, font=fuente(20, "media"), fill=TINTA)
    hoja.save(dir_control / "hoja_de_contacto.jpg", quality=88)
    out.append(f"  Cuadros de control: {len(miniaturas)} en {dir_control} (y hoja_de_contacto.jpg)")
    return ok, out


def grilla(escenas, dir_control):
    """Cada captura con una cuadricula de 10 en 10 y los recuadros actuales, para ubicarlos."""
    destino = dir_control / "_grilla"
    destino.mkdir(parents=True, exist_ok=True)
    n = 0
    for e in escenas:
        for tm in e.tomas:
            if tm.tipo != "imagen":
                continue
            im = abrir_imagen(tm.ruta)
            iw, ih = im.size
            im = marcar(im, tm.recuadros, 1920 / iw * 0.75)
            d = ImageDraw.Draw(im)
            if tm.encuadre:                        # en azul, la parte de la imagen que usa la toma
                e = tm.encuadre
                d.rectangle([iw * e["x"] / 100, ih * e["y"] / 100, iw * (e["x"] + e["ancho"]) / 100 - 1,
                             ih * (e["y"] + e["alto"]) / 100 - 1], outline=(0, 90, 255), width=max(3, iw // 300))
            fnt = fuente(max(14, iw // 90), "negrita")
            for p in range(10, 100, 10):
                x, y = iw * p / 100, ih * p / 100
                d.line([x, 0, x, ih], fill=(0, 160, 255), width=max(1, iw // 1200))
                d.line([0, y, iw, y], fill=(0, 160, 255), width=max(1, iw // 1200))
                d.text((x + 4, 4), str(p), font=fnt, fill=(0, 110, 200))
                d.text((4, y + 2), str(p), font=fnt, fill=(0, 110, 200))
            im.save(destino / f"{tm.nombre} {tm.ruta.stem}.png")
            print(f"  {tm.nombre} {tm.ruta.name}: {iw}x{ih} · huella {huella(tm.ruta)}")
            n += 1
    print(f"Grilla: {n} capturas en {destino}")


# ================================================================== informe
def informe(escenas, base):
    print("\nESCENA                         PÁRRAFOS  TOMA  VOZ        DURA     QUÉ SE VE HOY")
    faltan, estimados = {}, []
    for e in escenas:
        for tm in e.tomas:
            if tm.tipo == "lamina":
                hoy = "lámina de texto (generada)"
            else:
                try:
                    rel = tm.ruta.relative_to(base).as_posix()
                except ValueError:
                    rel = os.path.relpath(tm.ruta, base).replace("\\", "/")
                hoy = {"imagen": "imagen  ", "video": "GRABACIÓN ", "falta": "FALTA  "}[tm.tipo] + rel
                if tm.tipo == "falta":
                    faltan.setdefault(rel, []).append(tm)
                if tm.tipo == "imagen":
                    estimados += [(tm, r) for r in tm.recuadros if not confirmado(r, tm.ruta)]
            primero = tm.k == 0
            print(f"{(str(e.numero) + ' ' + e.titulo) if primero else '':<30} {(','.join(map(str, e.parrafos))) if primero else '':<9} "
                  f"{tm.k + 1:<5} {tm.voz_txt():<10} {seg(tm.dur):<8} {hoy}")
    avisos = [a for e in escenas for tm in e.tomas for a in tm.avisos]
    if avisos:
        print("\nAVISOS:")
        for a in avisos:
            print("  - " + a)
    if estimados:
        print(f"\nRECUADROS SIN UBICAR ({len(estimados)}): ubicarlos con --grilla y poner en posicion_confirmada la huella que da")
        for tm, r in estimados:
            motivo = "la captura cambió desde que se ubicó" if isinstance(r.get("posicion_confirmada"), str) else "posición estimada"
            print(f"  - {tm.nombre} ({tm.ruta.name}): {r.get('que_marca', 'recuadro')} [{motivo}]")
    provisorias = [tm for e in escenas for tm in e.tomas if tm.pendiente]
    if provisorias:
        print()
        print(f"PENDIENTE DE REEMPLAZAR POR LA TOMA REAL ({len(provisorias)}): hoy van con una lámina o con la toma de al lado")
        for tm in provisorias:
            print(f"  - {tm.nombre} (voz {tm.voz_txt()}): {tm.pendiente}")
    pendientes = [(e, x) for e in escenas for x in e.antes]
    if pendientes:
        print("\nA CONFIRMAR ANTES DE PUBLICAR (del guion):")
        for e, x in pendientes:
            print(f"  - Escena {e.numero}: {x}")
    if faltan:
        print(f"\nFALTAN {len(faltan)} TOMAS (cada una es un archivo; al lado, donde se usa):")
        for rel, tomas in faltan.items():
            print(f"  - {rel}   [{', '.join(t.nombre for t in tomas)}]")
            print(f"      {tomas[0].que}")
    return len(faltan), len(estimados)


# ================================================================== principal
AJUSTES = {"aire_de_escena_s": 0.5, "pausa_entre_parrafos_s": 0.4, "fundido_entre_escenas_s": 0.5,
           "zoom_lento_por_segundo": 0.008, "zoom_lento_tope": 0.06, "zoom_maximo": 2.2,
           "sonoridad_lufs": -20.0, "musica_db_bajo_la_voz": 22.0,
           "calidad_crf": 23}                       # 23 = liviano para WhatsApp; 18 = mas pesado y mas nitido


def main():
    ap = argparse.ArgumentParser(description="Arma el video tutorial de Claude en Barack.")
    ap.add_argument("--escenas", default=str(AQUI / "escenas.json"))
    ap.add_argument("--salida")
    ap.add_argument("--sin-subtitulos", action="store_true")
    ap.add_argument("--musica")
    ap.add_argument("--faltan", action="store_true")
    ap.add_argument("--grilla", action="store_true")
    ap.add_argument("--solo-control", action="store_true")
    ap.add_argument("--sin-control", action="store_true")
    a = ap.parse_args()

    ruta_json = Path(a.escenas).resolve()
    base = ruta_json.parent
    dir_control = base / "control"

    def ruta(x):
        p = Path(x)
        return p if p.is_absolute() else (base / p).resolve()

    try:
        crudo = json.loads(ruta_json.read_text(encoding="utf-8"))
        vid = crudo.get("video", {})
        parrafos = leer_voz(ruta(vid.get("voz", "voz")))
        datos, escenas = leer_escenas(ruta_json, parrafos)
        aj = dict(AJUSTES)
        aj.update(datos.get("ajustes", {}))
        resolver_recursos(escenas, base)
        ap_d, fin_d = vid.get("placa_apertura", {}), vid.get("placa_final", {})
        ap_s, fin_s = float(ap_d.get("segundos", 2.0)), float(fin_d.get("segundos", 4.0))
        fin_escenas = armar_linea(escenas, parrafos, aj, ap_s)
        total = fin_escenas + fin_s
        salida = Path(a.salida).resolve() if a.salida else ruta(vid.get("salida", "video.mp4"))
        plano = Plano(not a.sin_subtitulos)
        cues = armar_subtitulos(escenas, parrafos)

        if a.grilla:
            grilla(escenas, dir_control)
            return 0
        if a.musica and not Path(a.musica).exists():
            raise ErrorDeDatos(f"No encuentro la musica: {a.musica}")

        logo = ruta(vid["logo"]) if vid.get("logo") and ruta(vid["logo"]).exists() else None
        elementos = [Placa("apertura", dibujar_placa(ap_d.get("texto", "Claude en Barack — cómo se usa"), None, logo), 0.0, ap_s)]
        elementos += escenas
        elementos.append(Placa("final", dibujar_placa(fin_d.get("texto", "Claude en Barack"),
                                                      fin_d.get("credito", "Voz: Piper es_AR-daniela, datos OpenSLR 61, CC BY-SA 4.0"),
                                                      logo), fin_escenas, total))

        if not (a.faltan or a.solo_control):
            for e in escenas:
                for tm in e.tomas:
                    if tm.tipo == "imagen":
                        tm.visual = VisualImagen(tm, plano, aj)
                    elif tm.tipo == "video":
                        tm.visual = VisualVideo(tm, plano)
                    else:
                        tm.visual = VisualFijo(tm, plano)
            print(f"Armando {salida.name}: {len(escenas)} escenas, {sum(len(e.tomas) for e in escenas)} tomas, "
                  f"{len(parrafos)} parrafos de voz, {int(total // 60)}:{total % 60:04.1f}")
            for p in parrafos.values():
                if p.aviso:
                    print("  AVISO " + p.aviso)
            salida.parent.mkdir(parents=True, exist_ok=True)
            parcial = salida.with_name(salida.stem + ".armando.mp4")
            with tempfile.TemporaryDirectory(prefix="armar_video_") as tmp:
                voz_wav = Path(tmp) / "voz.wav"
                n_total = int(round(total * FPS))
                armar_voz(parrafos, n_total / FPS, voz_wav)
                try:
                    renderizar(elementos, cues, plano, n_total / FPS, aj["fundido_entre_escenas_s"], voz_wav,
                               a.musica, aj, parcial)
                finally:
                    for e in escenas:
                        for tm in e.tomas:
                            if tm.visual:
                                tm.visual.cerrar()
            try:
                os.replace(parcial, salida)
            except OSError:
                raise ErrorDeDatos(f"El video quedo armado en {parcial.name} pero no pude reemplazar {salida.name}: "
                                   "¿esta abierto en un reproductor? Cerralo y volve a correr.")
            escribir_srt(cues, salida.with_suffix(".srt"))
            print(f"Listo: {salida}")
            print(f"       {salida.with_suffix('.srt').name} ({len(cues)} subtitulos)")

        n_faltan, n_estimados = informe(escenas, base)

        paso = True
        if not a.faltan and not a.sin_control:
            if not salida.exists():
                raise ErrorDeDatos(f"No hay video para controlar: {salida}")
            print("\nCONTROL DEL ARCHIVO TERMINADO")
            paso, renglones = controlar(salida, elementos, escenas, plano, dir_control)
            print("\n".join(renglones))
        if not paso:
            print("\nEl video NO pasa el control tecnico.")
            return 3
        if n_faltan or n_estimados:
            print(f"\nPrimer corte: faltan {n_faltan} tomas y hay {n_estimados} recuadros sin ubicar.")
            return 1
        print("\nNo falta ninguna toma." if a.faltan else "\nVideo completo.")
        return 0
    except ErrorDeDatos as e:
        print("ERROR: " + str(e))
        return 2


if __name__ == "__main__":
    sys.exit(main())
