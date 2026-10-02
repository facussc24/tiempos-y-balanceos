#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Arma el video tutorial "Claude en Barack" a partir de la narracion ya grabada.

Lee  escenas.json  (el video como datos)  +  la carpeta de la voz (narracion.txt y partes/NN.wav, mas
partes/NN.json con cuando empieza y termina cada frase y cuando dice cada palabra: lo dejan narrar.py y
transcribir.py --partes)
Deja el MP4 (1920x1080, 30 cuadros por segundo, H.264 + AAC), un .srt al lado y, en control/,
un cuadro de cada toma y una hoja con todos juntos.

Lo que se ve y como se mueve (todo por escenas.json):
  - recurso = ruta de imagen o grabacion, 'lamina' (texto), 'ticker' (documentos que corren) o 'triptico'
    (tres capturas con su paso).
  - recuadros: aparecen cuando la voz dice la frase ('con_la_frase') o la palabra ('con_la_palabra'); el resto de la
    captura se oscurece (foco) y pueden llevar una etiqueta con el nombre del boton.
  - omitir: franjas horizontales de la captura que se sacan (para no mostrar una ruta interna).
  - entrada suave a cada toma (fundido corto), acercamiento lento, placas de apertura y cierre animadas.

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
import unicodedata
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
W, H, FPS = 1920, 1080, 30
DIR_FUENTES = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
EXT_VIDEO = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v")
EXT_IMAGEN = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
MAX_PALABRAS = 6           # el texto de cabecera (el nombre del paso)
MAX_PALABRAS_LAMINA = 8    # un renglon de una lamina de texto

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

SUB_PX = 56                # letra de los subtitulos: 5,2 % del alto del cuadro (BBC: entre 1/20 y 1/10)
SUB_ANCHO = 1120           # 58 % del ancho: con esta letra entran ~43 caracteres por renglon (Netflix, espanol: 42;
                           # BBC: hasta 68 % del ancho)
SUB_MAX_CPS = 20.0         # caracteres por segundo que se tolera (Netflix: 17 para adultos, hasta 20)
CHIP_PX = 30
FUNDIDO_NEGRO_ENTRADA = 0.3
FUNDIDO_NEGRO_SALIDA = 0.7
FUNDIDO_ESTADO = 0.3       # lo que tarda en aparecer un recuadro o un renglon
FUNDIDO_TOMA = 0.25        # entrada suave de cada toma dentro de una escena
DIM_FOCO = 0.52            # cuanto se oscurece lo que NO se marca (1 = nada)


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


def plano_txt(s):
    """Palabras en minuscula, sin tildes ni signos: para comparar lo escrito con lo buscado."""
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9]+", s)


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
    """Un parrafo de la voz. Lo que se sabe de el, de lo mas exacto a lo menos:
       partes/NN.json 'frases'   cuando empieza y termina cada frase (lo mide narrar.py al generarla)
       partes/NN.json 'palabras' cuando dice cada palabra (transcribir.py --partes)
       si no hay json: se miden las pausas del WAV, o se reparte por cantidad de letras."""

    def __init__(self, n, texto, wav, info, cortes_medidos):
        self.n, self.texto, self.wav = n, texto, wav
        with wave.open(str(wav), "rb") as w:
            self.formato = (w.getnchannels(), w.getsampwidth(), w.getframerate())
            self.muestras = w.getnframes()
        self.dur = self.muestras / self.formato[2]
        self.frases = [f for f in re.split(r"(?<=[.?!])\s+", texto) if f]
        self.tokens = texto.split()
        self.t0 = self.t1 = 0.0
        self.aviso = None
        self.palabras = None
        m = len(self.frases)
        exactas = info.get("frases")
        if exactas and len(exactas) == m:
            self.cortes = [(exactas[j][1], exactas[j + 1][0]) for j in range(m - 1)]
        elif len(cortes_medidos) == m - 1:
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
        pal = info.get("palabras")
        if pal and len(pal) == len(self.tokens) and [x["t"] for x in pal] == self.tokens:
            self.palabras = [(x["ini"], x["fin"]) for x in pal]
        elif pal:
            self.aviso = (self.aviso or "") + (f" parrafo {n}: partes/{n:02d}.json no coincide con narracion.txt "
                                              "(correr transcribir.py --partes de nuevo)")

    def frase_ini(self, j):                       # j desde 1
        return 0.0 if j == 1 else self.cortes[j - 2][1]

    def frase_fin(self, j):
        return self.dur if j == len(self.frases) else self.cortes[j - 1][0]

    def corte_medio(self, j):                     # el medio de la pausa que sigue a la frase j
        a, b = self.cortes[j - 1]
        return (a + b) / 2

    def tokens_de_frase(self, j):                 # (desde, hasta_sin_incluir) en self.tokens
        antes = sum(len(f.split()) for f in self.frases[:j - 1])
        return antes, antes + len(self.frases[j - 1].split())

    def t_token(self, i):
        """Segundo (dentro del parrafo) en que empieza la palabra i. Sin tiempos por palabra, se reparte por letras
        adentro de su frase."""
        if self.palabras:
            return self.palabras[i][0]
        for j in range(1, len(self.frases) + 1):
            a, b = self.tokens_de_frase(j)
            if a <= i < b:
                largo = sum(len(t) + 1 for t in self.tokens[a:b])
                antes = sum(len(t) + 1 for t in self.tokens[a:i])
                return self.frase_ini(j) + (self.frase_fin(j) - self.frase_ini(j)) * antes / largo
        return 0.0

    def t_fin_token(self, i):
        if self.palabras:
            return self.palabras[i][1]
        return self.t_token(i + 1) if i + 1 < len(self.tokens) else self.dur


def pausas_del_wav(wav, dur):
    """Las pausas entre frases (la voz deja ~0,6 s entre una y otra)."""
    r = correr([ffmpeg_bin("ffmpeg"), "-hide_banner", "-nostats", "-i", str(wav), "-af",
                "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"])
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
        jf = wav.with_suffix(".json")
        info = json.loads(jf.read_text(encoding="utf-8")) if jf.exists() else {}
        if info.get("texto") and info["texto"] != texto:
            raise ErrorDeDatos(f"partes/{n:02d}.json es de otro texto: narracion.txt cambio despues de generar la voz. "
                               "Correr narrar.py de nuevo.")
        parrafos[n] = Parrafo(n, texto, wav, info, [] if info.get("frases") else pausas_del_wav(wav, dur))
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
        self.tipo = None           # imagen | video | lamina | ticker | triptico | falta
        self.ruta = None
        self.visual = None
        self.parrafos = {}         # la voz (para buscar el segundo de una palabra)
        self.extra = float(d.get("segundos_extra", 0) or 0)
        self.texto = d.get("texto_en_pantalla", escena.texto)
        self.que = d.get("que_tiene_que_verse", "")
        self.recuadros = d.get("recuadros", []) or []
        self.zoom = d.get("zoom")
        self.zoom_maximo = d.get("zoom_maximo")        # tope del acercamiento de ESTA toma
        self.encuadre = d.get("encuadre")              # que parte de la imagen se usa (porcentaje)
        self.omitir = d.get("omitir") or []            # franjas horizontales que se sacan (porcentaje del alto)
        self.escala_maxima = d.get("escala_maxima")    # cuanto se la puede agrandar (1.0 = tamaño real)
        self.pendiente = d.get("pendiente")            # "falta reemplazar por la toma real: ..."
        self.avisos = []

    def t_palabra(self, frase, ocurrencia=1):
        """Segundo (dentro de la toma) en que la voz dice 'frase' (una o varias palabras, en el orden escrito).
        Busca solo en lo que dice esta toma, y la ocurrencia que se pida."""
        buscado = [x for x in plano_txt(frase)]
        if not buscado:
            raise ErrorDeDatos(f"{self.nombre}: 'con_la_palabra' vacio.")
        visto = 0
        for (p, a, b) in self.piezas:
            par = self.parrafos[p]
            for j in range(a, b + 1):
                d0, d1 = par.tokens_de_frase(j)
                toks = [plano_txt(t) for t in par.tokens[d0:d1]]
                for i in range(len(toks)):
                    junto, k = [], i
                    while k < len(toks) and len(junto) < len(buscado):
                        junto += toks[k]
                        k += 1
                    if junto[:len(buscado)] == buscado:
                        visto += 1
                        if visto == ocurrencia:
                            return max(0.0, par.t0 + par.t_token(d0 + i) - self.t0 - 0.05)
        raise ErrorDeDatos(f"{self.nombre}: la voz de esta toma no dice «{frase}» (ocurrencia {ocurrencia}).")

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

    def _anterior(self, tm):
        return self.tomas[tm.k - 1] if tm.k > 0 else None

    def cuadro(self, t):
        tm = self.toma_en(t)
        im = tm.visual.cuadro(t - tm.t0)
        ant = self._anterior(tm)
        if ant is not None and t - tm.t0 < FUNDIDO_TOMA:       # entrada suave de la toma nueva
            alfa = suave((t - tm.t0) / FUNDIDO_TOMA)
            im = Image.blend(ant.visual.cuadro(t - ant.t0), im, alfa)
        return im

    def clave(self, t):
        tm = self.toma_en(t)
        if self._anterior(tm) is not None and t - tm.t0 < FUNDIDO_TOMA:
            return None
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
            tm.parrafos = parrafos
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
                    if palabras(t) > MAX_PALABRAS_LAMINA:
                        raise ErrorDeDatos(f"{dt}: el renglon «{t}» tiene mas de {MAX_PALABRAS_LAMINA} palabras.")
            if tm.d["recurso"] == "triptico" and len((tm.d.get("triptico") or {}).get("tarjetas", [])) != 3:
                raise ErrorDeDatos(f"{dt}: el triptico necesita 'tarjetas' con tres capturas.")
            if tm.d["recurso"] == "ticker" and len((tm.d.get("ticker") or {}).get("documentos", [])) < 12:
                raise ErrorDeDatos(f"{dt}: el ticker necesita 'documentos' (al menos 12 [codigo, titulo]).")
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
            if rec in ("lamina", "ticker", "triptico"):
                tm.tipo = rec
                if rec == "triptico":
                    for tj in tm.d["triptico"]["tarjetas"]:
                        r = Path(tj["recurso"])
                        r = (r if r.is_absolute() else (base / r)).resolve()
                        if not r.exists():
                            raise ErrorDeDatos(f"{tm.nombre}: el triptico usa {r.name} y no existe.")
                        tj["ruta_abs"] = r
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
    # donde cortar: primero los dos puntos y el punto y coma (cortan una idea), despues la coma, y si no hay, un espacio
    cortes = ([m.end() for m in re.finditer(r"[:;]\s", frase)] or [m.end() for m in re.finditer(r",\s", frase)]
              or [m.end() for m in re.finditer(r"\s", frase)])
    c = min(cortes, key=lambda x: abs(x - medio))
    return trozos_de_subtitulo(frase[:c].strip(), fnt) + trozos_de_subtitulo(frase[c:].strip(), fnt)


def armar_subtitulos(escenas, parrafos):
    """Una entrada por frase (o por pedazo de frase si no entra en dos renglones), con su tiempo.
    Cada entrada aparece cuando la voz dice su primera palabra y se queda un momento despues de la ultima."""
    fnt = fuente(SUB_PX, "media")
    cues = []
    for e in escenas:
        for n in e.parrafos:
            p = parrafos[n]
            propios = []
            for j, frase in enumerate(p.frases, 1):
                d0, _ = p.tokens_de_frase(j)
                i = d0
                for x in trozos_de_subtitulo(frase, fnt):
                    k = len(x.split())
                    ini = max(p.t0, p.t0 + p.t_token(i) - 0.05)
                    fin = p.t0 + p.t_fin_token(i + k - 1) + 0.30
                    propios.append([ini, fin, partir_parejo(x, fnt, SUB_ANCHO)])
                    i += k
            for i, c in enumerate(propios):
                sig = propios[i + 1][0] if i + 1 < len(propios) else p.t1 + 0.4
                c[1] = max(min(c[1], sig - 0.02), c[0] + 0.5)
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
    """Donde va cada cosa en el cuadro: arriba el nombre del paso, en el medio lo que se muestra y abajo,
    en su propia franja (para que nunca tape la captura), el subtitulo."""

    def __init__(self, con_subtitulos):
        self.cabecera = (0, 0, W, 76)
        if con_subtitulos:
            self.area = (40, 88, W - 40, 884)       # 1840 x 796
            self.subs = (0, 896, W, H)              # 184 px: dos renglones de subtitulo con aire
        else:
            self.area = (40, 88, W - 40, 1040)
            self.subs = None
        self.aw, self.ah = self.area[2] - self.area[0], self.area[3] - self.area[1]
        self._bandas = {}

    def base(self, texto):
        im = Image.new("RGB", (W, H), AZUL_OSC)
        d = ImageDraw.Draw(im)
        if self.subs:
            d.rectangle([self.subs[0], self.subs[1], self.subs[2] - 1, self.subs[3] - 1], fill=SUB_FONDO)
        if texto:                                    # el nombre del paso, arriba a la izquierda
            fnt = fuente(CHIP_PX, "negrita")
            w = round(fnt.getlength(texto)) + 56
            d.rounded_rectangle([40, 14, 40 + w, 62], radius=24, fill=AZUL, outline=AZUL_CLARO, width=2)
            d.text((40 + w / 2, 38), texto, font=fnt, fill=BLANCO, anchor="mm")
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


class PlacaAnimada:
    """Placa de apertura o de cierre: sobre fondo claro entran, una despues de otra y con un fundido suave,
    el logo, una linea, el titulo, la frase de abajo y (si hay) el credito. Despues queda quieta."""

    # cuando empieza cada capa y cuanto tarda en entrar (segundos desde el principio de la placa)
    ENTRADAS = {"logo": (0.10, 0.55), "linea": (0.45, 0.50), "titulo": (0.65, 0.50), "frase": (0.95, 0.50),
                "credito": (1.20, 0.50)}

    def __init__(self, nombre, titulo, frase, credito, logo, t0, t1):
        self.nombre, self.t0, self.t1 = nombre, t0, t1
        self.fondo = Image.new("RGB", (W, H), PLACA_FONDO)
        self.capas = {}
        y = 300
        if logo:
            lg = Image.open(logo).convert("RGBA")
            ancho = 560
            lg = lg.resize((ancho, round(ancho * lg.size[1] / lg.size[0])), Image.LANCZOS)
            c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            c.paste(lg, ((W - ancho) // 2, y - lg.size[1] // 2), lg)
            self.capas["logo"] = c
            y += lg.size[1] // 2 + 70
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(c).rectangle([W // 2 - 120, y, W // 2 + 120, y + 5], fill=AZUL + (255,))
        self.capas["linea"] = c
        y += 105
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(c).text((W / 2, y), titulo, font=letra_que_entra(titulo, "negrita", 92, 52, W - 240),
                               fill=AZUL_OSC + (255,), anchor="mm")
        self.capas["titulo"] = c
        y += 92
        if frase:
            c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(c).text((W / 2, y), frase, font=letra_que_entra(frase, "normal", 50, 34, W - 240),
                                   fill=AZUL + (255,), anchor="mm")
            self.capas["frase"] = c
        if credito:
            c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(c).text((W / 2, H - 70), credito, font=letra_que_entra(credito, "normal", 30, 22, W - 200),
                                   fill=GRIS + (255,), anchor="mm")
            self.capas["credito"] = c
        self._ultimo = None

    def _alfa(self, clave, t):
        ini, dur = self.ENTRADAS[clave]
        return suave((t - ini) / dur)

    def cuadro(self, t):
        t = t - self.t0
        if self._ultimo is not None and t >= 1.8:
            return self._ultimo
        im = self.fondo.copy()
        for clave, capa in self.capas.items():
            a = self._alfa(clave, t)
            if a <= 0:
                continue
            if a < 1:
                capa = capa.copy()
                capa.putalpha(capa.getchannel("A").point(lambda v, a=a: int(v * a)))
            im.paste(capa, (0, 0), capa)
        if t >= 1.8:
            self._ultimo = im
        return im

    def clave(self, t):
        return (self.nombre, 0) if t - self.t0 >= 1.8 else None


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


def dibujar_lamina(tam, titulo, renglones, visibles, cita=None, icono=None):
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
                if icono == "x":                          # una cruz roja: lo que Claude NO hace
                    rad = 26
                    d.ellipse([margen, cy - rad, margen + 2 * rad, cy + rad], fill=ROJO)
                    d.line([margen + 15, cy - 11, margen + 37, cy + 11], fill=BLANCO, width=7)
                    d.line([margen + 15, cy + 11, margen + 37, cy - 11], fill=BLANCO, width=7)
                    d.text((margen + 86, cy - 3), r, font=f_r, fill=TINTA, anchor="lm")
                else:
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


def recortar_franjas(im, franjas):
    """Saca franjas horizontales de la captura (porcentaje del alto, de la imagen original) y une lo que queda.
    Sirve para no mostrar una ruta interna sin tener que cortar el cartel por la mitad."""
    if not franjas:
        return im
    iw, ih = im.size
    sacar = sorted((round(ih * f["desde"] / 100), round(ih * f["hasta"] / 100)) for f in franjas)
    quedan, y = [], 0
    for a, b in sacar:
        if a > y:
            quedan.append((y, a))
        y = max(y, b)
    if y < ih:
        quedan.append((y, ih))
    out = Image.new("RGB", (iw, sum(b - a for a, b in quedan)))
    y = 0
    for a, b in quedan:
        out.paste(im.crop((0, a, iw, b)), (0, y))
        y += b - a
    return out


def marcar_foco(im, r, escala):
    """La captura con UN recuadro rojo (con borde blanco, por si la app es oscura). Lo que no se marca se oscurece
    un poco, para que la mirada vaya a lo que la voz esta nombrando. Si el recuadro trae 'etiqueta', lleva el nombre
    del boton o del campo al lado."""
    iw, ih = im.size
    g = max(3, round(5 / escala))
    halo = max(1, round(1.5 / escala))
    x0, y0 = iw * r["x"] / 100, ih * r["y"] / 100
    x1, y1 = x0 + iw * r["ancho"] / 100, y0 + ih * r["alto"] / 100
    # el marco va por AFUERA de lo marcado (no le pisa la letra), salvo donde se termina la imagen
    ex0, ey0 = max(0, x0 - g - 2 * halo), max(0, y0 - g - 2 * halo)
    ex1, ey1 = min(iw - 1, x1 + g + 2 * halo), min(ih - 1, y1 + g + 2 * halo)
    out = im.copy()
    if r.get("foco", True):
        oscuro = im.point(lambda v: int(v * DIM_FOCO))
        caja = (int(ex0), int(ey0), int(ex1) + 1, int(ey1) + 1)
        oscuro.paste(im.crop(caja), caja[:2])
        out = oscuro
    d = ImageDraw.Draw(out)
    d.rectangle([ex0, ey0, ex1, ey1], outline=BLANCO, width=g + 2 * halo)
    d.rectangle([ex0 + halo, ey0 + halo, ex1 - halo, ey1 - halo], outline=ROJO, width=g)
    if r.get("numero") is not None:
        rad = max(12, round(26 / escala))
        d.ellipse([ex0 - rad, ey0 - rad, ex0 + rad, ey0 + rad], fill=ROJO, outline=BLANCO, width=halo * 2)
        d.text((ex0, ey0 - rad * 0.08), str(r["numero"]), font=fuente(round(rad * 1.3), "negrita"), fill=BLANCO, anchor="mm")
    if r.get("etiqueta"):
        fpx = max(16, round(CHIP_PX / escala))
        fnt = fuente(fpx, "negrita")
        texto = r["etiqueta"]
        ancho, alto, sep = fnt.getlength(texto) + fpx * 1.2, fpx * 1.55, fpx * 0.35
        lado = r.get("etiqueta_lado", "arriba")
        if lado == "arriba" and ey0 - sep - alto < 0:
            lado = "abajo"
        if lado == "abajo" and ey1 + sep + alto > ih:
            lado = "arriba"
        if lado in ("arriba", "abajo"):
            lx = min(max(0, ex0), iw - ancho - 1)
            ly = ey0 - sep - alto if lado == "arriba" else ey1 + sep
        else:
            ly = min(max(0, (ey0 + ey1) / 2 - alto / 2), ih - alto - 1)
            lx = ex1 + sep if lado == "derecha" else ex0 - sep - ancho
            lx = min(max(0, lx), iw - ancho - 1)
        d.rounded_rectangle([lx, ly, lx + ancho, ly + alto], radius=alto / 2, fill=ROJO, outline=BLANCO, width=halo)
        d.text((lx + ancho / 2, ly + alto / 2 - fpx * 0.05), texto, font=fnt, fill=BLANCO, anchor="mm")
    return out


def marcar(im, recuadros, escala):
    """Todos los recuadros juntos (la grilla de ubicacion los muestra asi)."""
    im = im.copy()
    d = ImageDraw.Draw(im)
    iw, ih = im.size
    g = max(3, round(5 / escala))
    for r in recuadros:
        x0, y0 = iw * r["x"] / 100, ih * r["y"] / 100
        x1, y1 = x0 + iw * r["ancho"] / 100, y0 + ih * r["alto"] / 100
        d.rectangle([x0 - g, y0 - g, x1 + g, y1 + g], outline=ROJO, width=g)
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
    if isinstance(item, dict) and item.get("con_la_palabra"):       # cuando la voz dice esa palabra
        return tm.t_palabra(item["con_la_palabra"], int(item.get("ocurrencia", 1)))
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
            contenidos = [dibujar_lamina(tam, titulo, textos, fijos + i, lam.get("cita"), lam.get("icono"))
                          for i in range(len(tiempos) + 1)]
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
    d = ImageDraw.Draw(base)
    d.rectangle([pos[0] + 8, pos[1] + 10, pos[0] + ow + 9, pos[1] + oh + 11], fill=(13, 27, 47))      # sombra suave
    d.rectangle([pos[0] - 2, pos[1] - 2, pos[0] + ow + 1, pos[1] + oh + 1], outline=GRIS_BORDE, width=2)
    return base


class VisualImagen:
    """Imagen fija con un acercamiento muy lento, o que se acerca despacio a lo marcado. Los recuadros aparecen de a
    uno, cuando la voz los nombra, y lo que no se marca se oscurece."""

    def __init__(self, tm, plano, aj):
        self.tm = tm
        im = recortar_franjas(abrir_imagen(tm.ruta), tm.omitir)
        recuadros = tm.recuadros
        if tm.encuadre:                                # se usa solo una parte de la imagen
            e = tm.encuadre
            W0, H0 = im.size
            x0, y0 = W0 * e["x"] / 100, H0 * e["y"] / 100
            im = im.crop((round(x0), round(y0), round(x0 + W0 * e["ancho"] / 100), round(y0 + H0 * e["alto"] / 100)))
            recuadros = [dict(r, x=(r["x"] - e["x"]) * 100 / e["ancho"], y=(r["y"] - e["y"]) * 100 / e["alto"],
                              ancho=r["ancho"] * 100 / e["ancho"], alto=r["alto"] * 100 / e["alto"]) for r in recuadros]
        relleno = int(tm.d.get("relleno_abajo", 0) or 0)       # una captura cortada justo debajo del texto marcado
        if relleno:                                            # no deja lugar para el borde del recuadro: se le agrega fondo
            W1, H1 = im.size
            fondo = im.getpixel((W1 // 2, H1 - 1))
            nueva = Image.new("RGB", (W1, H1 + relleno), fondo)
            nueva.paste(im, (0, 0))
            recuadros = [dict(r, y=r["y"] * H1 / (H1 + relleno), alto=r["alto"] * H1 / (H1 + relleno)) for r in recuadros]
            im = nueva
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
        self.fuentes = [im] + [marcar_foco(im, r, s) for r in orden]
        self.estados = Estados([t for t, _ in entradas])
        self.vel, self.tope = aj["zoom_lento_por_segundo"], aj["zoom_lento_tope"]
        self.destino = None
        self.quieta = tm.zoom == "no"
        z = tm.zoom
        zmax = float(tm.zoom_maximo or aj["zoom_maximo"])
        if z == "al_recuadro" and not tm.recuadros:
            raise ErrorDeDatos(f"{tm.nombre}: pide zoom 'al_recuadro' y no tiene recuadros.")
        if z == "al_recuadro" or isinstance(z, dict):
            cajas = recuadros if z == "al_recuadro" else [z]
            x0 = min(c["x"] for c in cajas) * self.iw / 100
            y0 = min(c["y"] for c in cajas) * self.ih / 100
            x1 = max(c["x"] + c["ancho"] for c in cajas) * self.iw / 100
            y1 = max(c["y"] + c["alto"] for c in cajas) * self.ih / 100
            w = max((x1 - x0) * 1.25, (y1 - y0) * 1.25 * self.iw / self.ih, self.iw / zmax)
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
        mayor = s * (self.iw / self.destino[2] if self.destino else (1 + (0 if self.quieta else self.tope)))
        tm.escala_final = mayor
        if mayor > 1.7:
            tm.avisos.append(f"{tm.nombre}: la captura se ve agrandada {mayor:.1f} veces: puede verse borrosa "
                             "(bajar 'zoom_maximo' o 'escala_maxima').")

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


def texto_que_entra(texto, fnt, ancho):
    """El texto cortado con '…' si no entra en 'ancho' pixeles."""
    if fnt.getlength(texto) <= ancho:
        return texto
    while texto and fnt.getlength(texto + "…") > ancho:
        texto = texto[:-1]
    return texto.rstrip() + "…"


class VisualTicker:
    """Tarjetas de documentos reales de Barack que suben en tres columnas, a distinta velocidad: la sensacion de
    'hay mucho escrito y encontrar el renglon justo cuesta'. No es una pantalla: es una animacion."""

    COLUMNAS, ANCHO, ALTO, SEP, SEP_COL = 3, 560, 108, 30, 70
    VELOCIDADES = (74, 108, 90)                  # pixeles por segundo, hacia arriba

    def __init__(self, tm, plano):
        self.tm = tm
        self.aw, self.ah = plano.aw, plano.ah
        self.pos_area = (plano.area[0], plano.area[1])
        docs = [(str(c), str(t)) for c, t in tm.d["ticker"]["documentos"]]
        self.base = plano.base(tm.texto)
        self.fondo = Image.new("RGB", (self.aw, self.ah), AZUL_OSC)
        total = self.COLUMNAS * self.ANCHO + (self.COLUMNAS - 1) * self.SEP_COL
        self.x0 = (self.aw - total) // 2
        paso = self.ALTO + self.SEP
        self.tiras, self.vuelta = [], []
        for c in range(self.COLUMNAS):
            mias = docs[c::self.COLUMNAS]
            vuelta = len(mias) * paso
            veces = 2 + self.ah // vuelta
            tira = Image.new("RGBA", (self.ANCHO, vuelta * veces), (0, 0, 0, 0))
            for k in range(len(mias) * veces):
                tira.paste(self._tarjeta(*mias[k % len(mias)]), (0, k * paso))
            self.tiras.append(tira)
            self.vuelta.append(vuelta)
        # arriba y abajo las tarjetas se funden con el fondo
        m = Image.new("L", (1, self.ah), 255)
        for y in range(self.ah):
            borde = 130
            a = min(y, self.ah - 1 - y)
            m.putpixel((0, y), int(255 * suave(a / borde)))
        self.mascara = m.resize((self.aw, self.ah))

    def _tarjeta(self, codigo, titulo):
        im = Image.new("RGBA", (self.ANCHO, self.ALTO), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, self.ANCHO - 1, self.ALTO - 1], radius=16, fill=(244, 247, 251, 255),
                            outline=GRIS_BORDE + (255,), width=2)
        d.rectangle([2, 14, 11, self.ALTO - 15], fill=AZUL + (255,))
        d.text((36, 16), codigo, font=fuente(34, "negrita"), fill=AZUL_OSC + (255,))
        d.text((36, 62), texto_que_entra(titulo, fuente(28, "normal"), self.ANCHO - 70), font=fuente(28, "normal"),
               fill=TINTA + (255,))
        return im

    def cuadro(self, t):
        area = self.fondo.copy()
        for c, (tira, vuelta, vel) in enumerate(zip(self.tiras, self.vuelta, self.VELOCIDADES)):
            off = int((t * vel + c * 150) % vuelta)
            tr = tira.crop((0, off, self.ANCHO, off + self.ah))
            area.paste(tr, (self.x0 + c * (self.ANCHO + self.SEP_COL), 0), tr)
        area = Image.composite(area, self.fondo, self.mascara)
        f = self.base.copy()
        f.paste(area, self.pos_area)
        return f

    def clave(self, t):
        return None

    def cerrar(self):
        pass


class VisualTriptico:
    """Tres capturas una al lado de la otra, cada una con su numero y su nombre. Cada paso se enciende cuando
    la voz lo dice ('con_la_palabra'); antes de eso queda atenuado."""

    ANCHO, ALTO, SEP = 560, 340, 70

    def __init__(self, tm, plano):
        self.tm = tm
        self.plano = plano
        self.base = plano.base(tm.texto)
        tarjetas = tm.d["triptico"]["tarjetas"]
        total = 3 * self.ANCHO + 2 * self.SEP
        x0 = plano.area[0] + (plano.aw - total) // 2
        y0 = plano.area[1] + (plano.ah - (self.ALTO + 130)) // 2
        self.items = []
        for i, tj in enumerate(tarjetas):
            x = x0 + i * (self.ANCHO + self.SEP)
            im = abrir_imagen(tj["ruta_abs"])
            e = tj.get("encuadre")
            if e:
                W0, H0 = im.size
                im = im.crop((round(W0 * e["x"] / 100), round(H0 * e["y"] / 100),
                              round(W0 * (e["x"] + e["ancho"]) / 100), round(H0 * (e["y"] + e["alto"]) / 100)))
            s = max(self.ANCHO / im.size[0], self.ALTO / im.size[1])       # se llena el recuadro (sin deformar)
            im = im.resize((round(im.size[0] * s) + 1, round(im.size[1] * s) + 1), Image.LANCZOS)
            sx, sy = (im.size[0] - self.ANCHO) // 2, (im.size[1] - self.ALTO) // 2
            tile = im.crop((sx, sy, sx + self.ANCHO, sy + self.ALTO))
            fondo = self.base.crop((x, y0, x + self.ANCHO, y0 + self.ALTO + 130))
            apagada, prendida = fondo.copy(), fondo.copy()
            # antes de nombrarlo, el paso se ve atenuado y con su rotulo en gris; al nombrarlo se enciende
            for im2, tile2, c_num, c_txt in ((apagada, tile.point(lambda v: int(v * 0.60)), AZUL, AZUL_CLARO),
                                             (prendida, tile, ROJO, BLANCO)):
                ImageDraw.Draw(im2).rectangle([0, 0, self.ANCHO - 1, self.ALTO - 1], outline=GRIS_BORDE, width=2)
                im2.paste(tile2.crop((2, 2, self.ANCHO - 2, self.ALTO - 2)), (2, 2))
                d = ImageDraw.Draw(im2)
                fnt = fuente(52, "negrita")
                txt = tj["titulo"]
                gx = (self.ANCHO - (fnt.getlength(txt) + 84)) / 2          # el grupo numero + nombre, centrado
                cy = self.ALTO + 70
                d.ellipse([gx, cy - 34, gx + 68, cy + 34], fill=c_num, outline=BLANCO, width=3)
                d.text((gx + 34, cy - 2), str(i + 1), font=fuente(44, "negrita"), fill=BLANCO, anchor="mm")
                d.text((gx + 84, cy - 2), txt, font=fnt, fill=c_txt, anchor="lm")
            self.items.append({"pos": (x, y0), "fondo": fondo, "apagada": apagada, "prendida": prendida,
                               "t_on": cuando_entra(tj, tm, 1e9)})
        self.t_fin = max(it["t_on"] for it in self.items) + 0.6

    def cuadro(self, t):
        f = self.base.copy()
        for i, it in enumerate(self.items):
            a_in = suave((t - 0.15 - 0.30 * i) / 0.55)
            a_on = suave((t - it["t_on"]) / 0.35)
            c = Image.blend(it["apagada"], it["prendida"], a_on) if a_on > 0 else it["apagada"]
            if a_in < 1:
                c = Image.blend(it["fondo"], c, a_in)
            f.paste(c, it["pos"])
        return f

    def clave(self, t):
        return ("fin", 0) if t > self.t_fin else None

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


def sonoridad(archivo, hasta=None, filtro=None):
    """Sonoridad integrada (LUFS) y pico real (dBTP), medidos con ffmpeg (opcionalmente despues de un filtro)."""
    cmd = [ffmpeg_bin("ffmpeg"), "-hide_banner", "-nostats"]
    if hasta:
        cmd += ["-t", f"{hasta:.3f}"]
    cmd += ["-i", str(archivo), "-map", "0:a:0", "-af", (filtro + "," if filtro else "") + "ebur128=peak=true",
            "-f", "null", "-"]
    err = correr(cmd).stderr
    cola = err[err.rfind("Summary:"):] if "Summary:" in err else err
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", cola)
    p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", cola)
    if not i or not p:
        raise ErrorDeDatos(f"No pude medir el volumen de {Path(archivo).name}.")
    return float(i.group(1)), float(p.group(1))


def filtro_de_sonido(voz_wav, total, aj, musica):
    objetivo = aj["sonoridad_lufs"]
    base = "highpass=f=70"                                    # saca el ruido grave
    limite = "alimiter=limit=0.80:attack=3:release=40:level=false"   # tope de picos: ~ -1,9 dB (el AAC suma un poco)
    lufs, pico = sonoridad(voz_wav, filtro=base)
    gan = objetivo - lufs
    for _ in range(4):                                        # se ajusta la ganancia MIDIENDO ya con el limitador puesto
        l2, p2 = sonoridad(voz_wav, filtro=f"{base},volume={gan:.2f}dB,{limite}")
        if abs(l2 - objetivo) <= 0.1:
            break
        gan += objetivo - l2
    pasos = [base, f"volume={gan:.2f}dB", limite, "aresample=48000", "aformat=sample_fmts=fltp:channel_layouts=stereo"]
    filtro = "[1:a]" + ",".join(pasos) + "[voz]"
    nota = (f"voz medida {lufs:.1f} LUFS, pico {pico:.1f} dB -> ganancia {gan:+.1f} dB y limitador: "
            f"{l2:.1f} LUFS, pico {p2:.1f} dB (se busca {objetivo:.0f} LUFS)")
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


def cuadros_sueltos(tiempos, elementos, cues, plano, fundido, total, destino):
    """Deja en 'destino' el cuadro de cada segundo pedido (sin armar el video): sirve para revisar rapido un recuadro,
    un subtitulo o el momento en que cambia una toma. Es la misma composicion que usa renderizar()."""
    destino.mkdir(parents=True, exist_ok=True)
    negro = Image.new("RGB", (W, H), NEGRO)
    for t in tiempos:
        i = next((k for k, e in enumerate(elementos) if t < e.t1), len(elementos) - 1)
        e = elementos[i]
        cue = next((c for c in cues if c[0] <= t < c[1]), None) if plano.subs else None
        if i > 0 and t < e.t0 + fundido / 2:
            img = Image.blend(elementos[i - 1].cuadro(t), e.cuadro(t), min(max((t - (e.t0 - fundido / 2)) / fundido, 0.0), 1.0))
        elif i < len(elementos) - 1 and t >= e.t1 - fundido / 2:
            img = Image.blend(e.cuadro(t), elementos[i + 1].cuadro(t), min(max((t - (e.t1 - fundido / 2)) / fundido, 0.0), 1.0))
        else:
            img = e.cuadro(t)
        if cue:
            img = img.copy()
            img.paste(plano.banda_sub(cue[2]), (plano.subs[0], plano.subs[1]))
        ruta = destino / f"t{t:06.2f}.png".replace(".", "_", 1)
        img.save(ruta)
        print(f"  {t:6.2f} s -> {ruta.name}")


# ================================================================== el control
def controlar(mp4, elementos, escenas, plano, dir_control, cues=None):
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
    chequeo(-17.0 <= lufs <= -15.0 and pico <= -1.0,
            f"sonoridad {lufs:.1f} LUFS, pico real {pico:.1f} dBTP (se busca -16 LUFS y pico bajo -1)")
    chequeo(105.0 <= dur <= 140.0, f"duracion {int(dur // 60)}:{dur % 60:04.1f} (el pedido: entre 1:45 y 2:20)")
    if cues:
        fnt = fuente(SUB_PX, "media")
        lineas = max(len(c[2]) for c in cues)
        ancho = max(fnt.getlength(l) for c in cues for l in c[2])
        letras = max(max(len(l) for l in c[2]) for c in cues)
        cps = [(sum(len(l) for l in c[2]) + len(c[2]) - 1) / max(0.1, c[1] - c[0]) for c in cues]
        chequeo(lineas <= 2 and ancho <= SUB_ANCHO + 1,
                f"subtitulos: {len(cues)}, hasta {lineas} renglones, el mas ancho {ancho:.0f} px de {SUB_ANCHO} y {letras} letras")
        peor = max(range(len(cues)), key=lambda i: cps[i])
        out.append(f"  Velocidad de lectura de los subtitulos: media {sum(cps) / len(cps):.1f}, maxima {cps[peor]:.1f} "
                   f"letras por segundo (Netflix: 17 a 20) en «{' '.join(cues[peor][2])[:40]}…»")

    dir_control.mkdir(parents=True, exist_ok=True)
    puntos = [("00-placa-apertura", "Placa de apertura", elementos[0].t0 + (elementos[0].t1 - elementos[0].t0) * 0.5)]
    for e in escenas:
        for tm in e.tomas:
            puntos.append((f"{tm.nombre}", f"{tm.nombre} · {tm.tipo}", tm.t0 + tm.dur * 0.85))   # mismo nombre siempre: se pisa
            if tm.dur > 6.0:                                    # las tomas largas: tambien un cuadro de la mitad
                puntos.append((f"{tm.nombre}-mitad", f"{tm.nombre} mitad", tm.t0 + tm.dur * 0.45))
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
            im = recortar_franjas(abrir_imagen(tm.ruta), tm.omitir)      # con las franjas sacadas, como se ve en el video
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
    print("\nESCENA                         PÁRRAFOS  TOMA  VOZ        DESDE    DURA     QUÉ SE VE HOY")
    faltan, estimados = {}, []
    for e in escenas:
        for tm in e.tomas:
            if tm.tipo in ("lamina", "ticker", "triptico"):
                hoy = {"lamina": "lámina de texto (generada)", "ticker": "animación de documentos (generada)",
                       "triptico": "tres capturas (generada)"}[tm.tipo]
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
                  f"{tm.k + 1:<5} {tm.voz_txt():<10} {seg(tm.t0):<8} {seg(tm.dur):<8} {hoy}")
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
           "sonoridad_lufs": -16.0, "musica_db_bajo_la_voz": 22.0,
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
    ap.add_argument("--cuadros", help="segundos separados por coma (por ejemplo 5,20.5,47): deja esos cuadros en "
                                      "control/_cuadros/ y no arma el video")
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
        elementos = [PlacaAnimada("apertura", ap_d.get("titulo", "Claude en Barack"), ap_d.get("frase", "Cómo se usa"),
                                  None, logo, 0.0, ap_s)]
        elementos += escenas
        elementos.append(PlacaAnimada("final", fin_d.get("titulo", "Claude en Barack"), fin_d.get("frase"),
                                      fin_d.get("credito", "Voz: Piper es_AR-daniela (CC BY-SA 4.0)"),
                                      logo, fin_escenas, total))

        if not (a.faltan or a.solo_control):
            for e in escenas:
                for tm in e.tomas:
                    if tm.tipo == "imagen":
                        tm.visual = VisualImagen(tm, plano, aj)
                    elif tm.tipo == "video":
                        tm.visual = VisualVideo(tm, plano)
                    elif tm.tipo == "ticker":
                        tm.visual = VisualTicker(tm, plano)
                    elif tm.tipo == "triptico":
                        tm.visual = VisualTriptico(tm, plano)
                    else:
                        tm.visual = VisualFijo(tm, plano)
            if a.cuadros:
                try:
                    cuadros_sueltos(sorted(float(x) for x in a.cuadros.split(",")), elementos, cues, plano,
                                    aj["fundido_entre_escenas_s"], total, dir_control / "_cuadros")
                finally:
                    for e in escenas:
                        for tm in e.tomas:
                            if tm.visual:
                                tm.visual.cerrar()
                return 0
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
            paso, renglones = controlar(salida, elementos, escenas, plano, dir_control, cues if plano.subs else None)
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
