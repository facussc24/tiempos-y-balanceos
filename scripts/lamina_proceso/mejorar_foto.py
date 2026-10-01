#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
mejorar_foto.py - fotos de celular -> "foto de catalogo" para la lamina A3.

SE CORRE CON (el venv nuevo, aparte de los otros):
    C:\\Dev\\BarackMercosul\\.venv-fotos\\Scripts\\python.exe mejorar_foto.py <comando> ...

COMANDOS
  pieza   <entrada> <salida.png> [--x 2] [--sombra 0.30] [--blanco] [--modelo isnet-general-use]
          Recorta el fondo, agranda, ajusta el tono y deja la pieza sola con una sombra suave.
          La salida es un PNG con transparencia (la sombra va dentro del canal alfa: sobre
          blanco se ve igual que una foto de estudio). --blanco guarda ademas <salida>_blanco.png.

  maquina <entrada> <salida.jpg> [--x 2] [--fondo 0.0] [--recorte auto|x0,y0,x1,y1] [--sin-enderezar]
          Corrige balance de blancos, exposicion, contraste local y nitidez, endereza y agranda.
          La foto sigue siendo la foto: no se redibuja nada. --fondo 0..1 atenua el fondo
          (desenfoque + desaturado suave con mascara); 0 = apagado (por defecto).

  lote    <carpeta_entrada> <carpeta_salida> pieza|maquina [opciones]
          Corre el mismo comando sobre todas las imagenes de una carpeta.

AUMENTO DE RESOLUCION (--sr): fsrcnn (por defecto, 0,1-0,4 s), espcn, lanczos (piso de comparacion) y
edsr (NO usar en esta notebook: 17 s para un recorte de 160x280 px, 97 s para uno de 300x156; una foto
entera tardaria decenas de minutos). En las pruebas fsrcnn/espcn/lanczos se ven casi iguales.
No inventa detalle: son redes chicas de OpenCV (no generativas).

OTRAS OPCIONES: --girar GRADOS (giro manual con recorte; el enderezado automatico es muy conservador y
casi no se activa), --limpiar 2.5 (reduce ruido; alisa texturas, por eso viene apagado), --recorte auto.
--fondo solo conviene con UN sujeto claro (rollo, pieza sobre mesa). En una escena con varias cosas
a mostrar (troqueladora + mesa + pieza) desenfoca lo que si hay que mostrar: usar --recorte.

TIEMPOS (notebook sin GPU): pieza ~22-30 s/foto dentro de `lote`; una sola foto en frio ~30-70 s
(carga de rembg y del modelo). maquina sin --fondo 2-12 s; con --fondo 11-51 s.

MODELOS: ./modelos/ (rembg en ./modelos/rembg, super-resolucion .pb de OpenCV).
Todo lo que baja rembg queda en esa carpeta (U2NET_HOME), nada en el perfil del usuario.
"""
import argparse
import os
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MODELOS = AQUI / "modelos"
os.environ.setdefault("U2NET_HOME", str(MODELOS / "rembg"))

import cv2
import numpy as np
from PIL import Image, ImageOps

cv2.setNumThreads(max(1, (os.cpu_count() or 4)))

EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


# ----------------------------------------------------------------------------- util
def log(*a):
    print(*a, flush=True)


def cargar(ruta):
    """BGR uint8. Respeta EXIF; si hay transparencia real, la apoya sobre blanco."""
    im = Image.open(ruta)
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
        im = im.convert("RGBA")
        base = Image.new("RGBA", im.size, (255, 255, 255, 255))
        base.alpha_composite(im)
        im = base
    im = im.convert("RGB")
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)


def quitar_barras_negras(bgr, max_frac=0.05):
    """Saca las barras negras de captura de pantalla pegadas al borde (<= 5 % por lado)."""
    h, w = bgr.shape[:2]
    g = bgr.astype(np.float32).mean(axis=2)

    def cuenta(vals):
        n = 0
        for v in vals:
            if v:
                n += 1
            else:
                break
        return n

    # fila/columna "barra": oscura (< 55) y casi uniforme (desvio < 5) en todo su largo
    fila_barra = (g.mean(axis=1) < 55) & (g.std(axis=1) < 5)
    col_barra = (g.mean(axis=0) < 55) & (g.std(axis=0) < 5)
    arriba = min(cuenta(fila_barra), int(h * max_frac))
    abajo = min(cuenta(fila_barra[::-1]), int(h * max_frac))
    izq = min(cuenta(col_barra), int(w * max_frac))
    der = min(cuenta(col_barra[::-1]), int(w * max_frac))
    if arriba or abajo or izq or der:
        # unos pixeles de mas, por el borde difuso de la barra
        arriba, abajo, izq, der = [(v + 3 if v else 0) for v in (arriba, abajo, izq, der)]
        bgr = bgr[arriba:h - abajo, izq:w - der]
    return bgr


# ----------------------------------------------------------------------------- agrandar
_SR = {}


def _sr(modelo, escala):
    clave = (modelo, escala)
    if clave not in _SR:
        arch = MODELOS / f"{modelo.upper()}_x{escala}.pb"
        if not arch.exists():
            return None
        sr = cv2.dnn_superres.DnnSuperResImpl_create()
        sr.readModel(str(arch))
        sr.setModel(modelo.lower(), escala)
        _SR[clave] = sr
    return _SR[clave]


def _sr_tiles(sr, bgr, escala, tile=128, solape=8):
    h, w = bgr.shape[:2]
    out = np.zeros((h * escala, w * escala, 3), np.uint8)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(0, y - solape), max(0, x - solape)
            y1, x1 = min(h, y + tile + solape), min(w, x + tile + solape)
            up = sr.upsample(np.ascontiguousarray(bgr[y0:y1, x0:x1]))
            oy, ox = (y - y0) * escala, (x - x0) * escala
            hh, ww = min(tile, h - y) * escala, min(tile, w - x) * escala
            out[y * escala:y * escala + hh, x * escala:x * escala + ww] = up[oy:oy + hh, ox:ox + ww]
    return out


def agrandar(bgr, factor, modo="fsrcnn"):
    if factor == 1:
        return bgr
    h, w = bgr.shape[:2]
    dest = (int(round(w * factor)), int(round(h * factor)))
    if modo != "lanczos":
        base = 2 if factor <= 2 else 4
        sr = _sr(modo, base)
        if sr is None and modo == "espcn" or sr is None:
            log(f"  (sin modelo {modo} x{base}: uso Lanczos)")
        else:
            res = _sr_tiles(sr, bgr, base)
            if res.shape[1] != dest[0]:
                res = cv2.resize(res, dest, interpolation=cv2.INTER_AREA if res.shape[1] > dest[0] else cv2.INTER_LANCZOS4)
            return res
    return cv2.resize(bgr, dest, interpolation=cv2.INTER_LANCZOS4)


def nitidez(bgr, cantidad=0.5, radio=1.1, umbral=3):
    """Unsharp mask suave solo sobre el brillo (no toca el color)."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[..., 0].astype(np.float32)
    borroso = cv2.GaussianBlur(L, (0, 0), radio)
    d = L - borroso
    d = np.where(np.abs(d) < umbral, 0, d)
    lab[..., 0] = np.clip(L + cantidad * d, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


# ----------------------------------------------------------------------------- color
def balance_blancos(bgr, mascara_neutra=None, fuerza=0.7, p=6):
    """
    Balance de blancos 'shades of gray' (norma p=6): mas robusto que gris-mundo cuando
    hay una maquina azul grande. Si se da mascara_neutra (fondo blanco/gris conocido) se
    usa SOLO esa zona como referencia. Los factores se limitan a 0,8-1,25 y se mezclan con
    `fuerza` para no pasarse.
    """
    f = bgr.astype(np.float32) / 255.0
    if mascara_neutra is not None and mascara_neutra.sum() > 200:
        sel = f[mascara_neutra]
        ref = np.power(np.mean(np.power(sel, p), axis=0), 1.0 / p)
    else:
        ref = np.power(np.mean(np.power(f.reshape(-1, 3), p), axis=0), 1.0 / p)
    ref = np.maximum(ref, 1e-4)
    gan = ref.mean() / ref
    gan = np.clip(gan, 0.8, 1.25)
    gan = 1.0 + fuerza * (gan - 1.0)
    return np.clip(f * gan, 0, 1).__mul__(255).astype(np.uint8)


def exposicion(bgr, objetivo=0.50, max_gamma=1.6, p_bajo=0.5, p_alto=99.5):
    """Estira niveles sobre el brillo y mueve la mediana hacia `objetivo` con un gamma acotado."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[..., 0].astype(np.float32) / 255.0
    lo, hi = np.percentile(L, [p_bajo, p_alto])
    if hi - lo > 0.2:
        L = np.clip((L - lo) / (hi - lo), 0, 1)
    med = float(np.median(L))
    if 0.02 < med < 0.98 and not (0.40 <= med <= 0.58):  # zona muerta: si ya esta bien expuesta no se toca
        g = np.log(objetivo) / np.log(med)
        g = float(np.clip(g, 1.0 / max_gamma, max_gamma))
        L = np.power(L, g)
    lab[..., 0] = np.clip(L * 255, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def clahe_suave(bgr, clip=1.6, grilla=8, mezcla=0.6, mascara=None):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[..., 0]
    c = cv2.createCLAHE(clipLimit=clip, tileGridSize=(grilla, grilla)).apply(L)
    nuevo = (L.astype(np.float32) * (1 - mezcla) + c.astype(np.float32) * mezcla)
    if mascara is not None:
        m = mascara.astype(np.float32)
        nuevo = L.astype(np.float32) * (1 - m) + nuevo * m
    lab[..., 0] = np.clip(nuevo, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def levantar_sombras(bgr, mascara, gamma=0.82):
    """Piezas negras: sube un poco las sombras SOLO dentro de la pieza para que se vea textura."""
    f = bgr.astype(np.float32) / 255.0
    g = np.power(f, gamma)
    m = (mascara.astype(np.float32) if mascara is not None else 1.0)
    if mascara is not None:
        m = m[..., None]
    return np.clip((f * (1 - m) + g * m) * 255, 0, 255).astype(np.uint8)


def neutralizar_negros(bgr, mascara, fuerza=0.85, solo_si_oscura=True):
    """
    Una pieza negra tiene que verse NEGRA, no azulada ni marron: baja el color (a,b de LAB) de los
    pixeles oscuros dentro de la pieza. Si la pieza no es mayormente oscura no hace nada.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0]
    sel = mascara > 0.5
    if sel.sum() < 100:
        return bgr
    if solo_si_oscura and np.median(L[sel]) > 95:
        return bgr
    # una pieza con color propio (turquesa, amarillo...) NO se toca: solo negros con un tinte leve
    croma = np.hypot(lab[..., 1][sel] - 128, lab[..., 2][sel] - 128)
    if np.median(croma) > 6.0:
        return bgr
    w = np.clip(1.0 - L / 120.0, 0, 1) * np.clip(mascara, 0, 1)
    for c in (1, 2):
        lab[..., c] = 128 + (lab[..., c] - 128) * (1 - fuerza * w)
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


# ----------------------------------------------------------------------------- rembg
_SES = {}


def mascara_rembg(bgr, modelo="isnet-general-use"):
    """Mascara float 0..1 con rembg (CPU)."""
    from rembg import new_session, remove
    if modelo not in _SES:
        _SES[modelo] = new_session(modelo, providers=["CPUExecutionProvider"])
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    m = remove(Image.fromarray(rgb), session=_SES[modelo], only_mask=True)
    return np.array(m).astype(np.float32) / 255.0


def limpiar_mascara(m, solo_mayor=True):
    """Umbral, mayor componente, rellena huecos internos, alisa el borde sin comer forma."""
    b = (m > 0.5).astype(np.uint8)
    if solo_mayor:
        n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
        if n > 1:
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            b = (lab == k).astype(np.uint8)
    # rellenar huecos
    inv = (1 - b).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    h, w = b.shape
    for k in range(1, n):
        x, y, ww, hh, area = st[k]
        toca_borde = x == 0 or y == 0 or x + ww == w or y + hh == h
        if not toca_borde:
            b[lab == k] = 1
    return b.astype(np.float32)


def suavizar_alfa(m_alta, sigma=1.0):
    a = cv2.GaussianBlur(m_alta, (0, 0), sigma)
    # smoothstep para que el borde quede nitido pero sin escalones
    a = np.clip((a - 0.35) / 0.30, 0, 1)
    return a * a * (3 - 2 * a)


def descontaminar_color(bgr, alfa, sigma=3.0, banda=3):
    """
    Saca el halo claro del borde: el color de la franja de `banda` px pegada al borde (y de todo lo
    semitransparente) sale de lo que hay ADENTRO de la pieza, no de la mezcla pieza+fondo.
    """
    solido = (alfa > 0.5).astype(np.uint8)
    interior = cv2.erode(solido, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * banda + 1, 2 * banda + 1))).astype(np.float32)
    num = cv2.GaussianBlur(bgr.astype(np.float32) * interior[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(interior, (0, 0), sigma)[..., None]
    est = num / np.maximum(den, 1e-4)
    usar = (interior < 0.5)[..., None] & (den > 1e-3)
    return np.where(usar, est, bgr.astype(np.float32)).astype(np.uint8)


def componer_con_sombra(bgr, alfa, intensidad=0.30, margen=0.10):
    """
    RGBA final: pieza + sombra suave pareja (dentro del alfa). Sombra = silueta desenfocada,
    corrida un poco hacia abajo, mas una sombra de contacto mas chica y oscura.
    """
    h, w = alfa.shape
    mh, mw = int(h * margen), int(w * margen * 1.6)
    mw = max(mw, int(0.12 * min(h, w)))
    H, W = h + 2 * mh, w + 2 * mw
    A = np.zeros((H, W), np.float32)
    A[mh:mh + h, mw:mw + w] = alfa
    C = np.full((H, W, 3), 0, np.uint8)
    C[mh:mh + h, mw:mw + w] = bgr
    lado = min(h, w)
    dy = max(2, int(0.012 * h))
    M = np.float32([[1, 0, 0], [0, 1, dy]])
    sombra_g = cv2.GaussianBlur(cv2.warpAffine(A, M, (W, H)), (0, 0), max(3.0, 0.045 * lado))
    sombra_c = cv2.GaussianBlur(cv2.warpAffine(A, M, (W, H)), (0, 0), max(1.5, 0.010 * lado))
    sh = np.clip(intensidad * (0.65 * sombra_g + 0.55 * sombra_c), 0, 0.9)
    out_a = A + sh * (1 - A)
    rgb = (C.astype(np.float32) * A[..., None]) / np.maximum(out_a[..., None], 1e-4)
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(out_a * 255, 0, 255).astype(np.uint8)])
    return rgba


# ----------------------------------------------------------------------------- pieza
def cmd_pieza(entrada, salida, x=2, sombra=0.30, blanco=False, modelo="isnet-general-use", sr="fsrcnn", barras=True, mascara_guardar=None):
    t0 = time.time()
    bgr = cargar(entrada)
    if barras:
        bgr = quitar_barras_negras(bgr)
    h0, w0 = bgr.shape[:2]
    # 1) mascara en tamano original (rembg trabaja a 320/1024 igual)
    m0 = mascara_rembg(bgr, modelo)
    m0b = limpiar_mascara(m0)
    # 2) balance de blancos con el FONDO como referencia (el fondo es blanco/gris: neutro)
    fondo = cv2.erode((m0b < 0.5).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    bgr = balance_blancos(bgr, fondo, fuerza=0.5)
    # 3) agrandar la foto y la mascara
    big = agrandar(bgr, x, sr)
    H, W = big.shape[:2]
    m_alta = cv2.resize(m0b, (W, H), interpolation=cv2.INTER_CUBIC)
    alfa = suavizar_alfa(np.clip(m_alta, 0, 1), sigma=0.8 * x / 2 + 0.4)
    # 4) tono dentro de la pieza
    dentro = (cv2.erode((alfa > 0.5).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)).astype(np.float32)
    big = descontaminar_color(big, alfa, sigma=2.0 + x, banda=int(round(1.5 * x)))
    big = neutralizar_negros(big, cv2.GaussianBlur(dentro, (0, 0), 1.5))
    big = levantar_sombras(big, cv2.GaussianBlur(dentro, (0, 0), 1.5), gamma=0.84)
    big = clahe_suave(big, clip=1.4, grilla=6, mezcla=0.5, mascara=cv2.GaussianBlur(dentro, (0, 0), 1.5))
    big = nitidez(big, cantidad=0.45, radio=1.0 + 0.25 * x, umbral=2)
    big = descontaminar_color(big, alfa, sigma=2.0 + x, banda=int(round(1.5 * x)))
    # 5) componer con sombra
    rgba = componer_con_sombra(big, alfa, intensidad=sombra)
    out = Path(salida)
    out.parent.mkdir(parents=True, exist_ok=True)
    # rgba esta en orden B,G,R,A (como todo OpenCV): imencode lo espera asi, sin convertir
    cv2.imencode(".png", rgba)[1].tofile(str(out))
    if blanco:
        a = rgba[..., 3:4].astype(np.float32) / 255.0
        # straight-alpha: componer sobre blanco
        plano = (rgba[..., :3].astype(np.float32) * a + 255 * (1 - a)).astype(np.uint8)
        pb = out.with_name(out.stem + "_blanco.png")
        cv2.imencode(".png", plano)[1].tofile(str(pb))
    if mascara_guardar:
        cv2.imencode(".png", (alfa * 255).astype(np.uint8))[1].tofile(str(mascara_guardar))
    log(f"  pieza {Path(entrada).name}: {w0}x{h0} -> {rgba.shape[1]}x{rgba.shape[0]}  {time.time() - t0:.1f} s")
    return rgba


# ----------------------------------------------------------------------------- maquina
def enderezar(bgr, max_grados=4.0, min_grados=0.25):
    """
    Estima la inclinacion con las lineas largas casi horizontales/verticales (paredes,
    guardas, estantes) y gira. Recorta el borde que queda vacio. Si no hay consenso, no toca.
    """
    h, w = bgr.shape[:2]
    escala = 800.0 / max(h, w) if max(h, w) > 800 else 1.0
    chico = cv2.resize(bgr, None, fx=escala, fy=escala, interpolation=cv2.INTER_AREA) if escala < 1 else bgr
    g = cv2.cvtColor(chico, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(g, (0, 0), 1.2)
    e = cv2.Canny(g, 60, 150)
    minlen = int(0.18 * min(chico.shape[:2]))
    lin = cv2.HoughLinesP(e, 1, np.pi / 720, threshold=60, minLineLength=minlen, maxLineGap=8)
    if lin is None:
        return bgr, 0.0
    ang, pesos = [], []
    for x1, y1, x2, y2 in np.asarray(lin).reshape(-1, 4):  # OpenCV 4 devuelve (N,1,4), OpenCV 5 (N,4)
        dx, dy = x2 - x1, y2 - y1
        l = float(np.hypot(dx, dy))
        a = np.degrees(np.arctan2(dy, dx))
        # llevar a [-45, 45): desvio respecto del eje mas cercano (horizontal o vertical)
        a = (a + 45) % 90 - 45
        if abs(a) <= max_grados + 1.5:
            ang.append(a)
            pesos.append(l)
    if len(ang) < 6:
        return bgr, 0.0
    ang, pesos = np.array(ang), np.array(pesos)
    # mediana ponderada
    o = np.argsort(ang)
    cum = np.cumsum(pesos[o])
    med = float(ang[o][np.searchsorted(cum, cum[-1] / 2)])
    # consenso: que la mayoria este cerca de la mediana
    cerca = np.abs(ang - med) < 0.6
    if pesos[cerca].sum() < 0.60 * pesos.sum() or abs(med) < min_grados or abs(med) > max_grados:
        return bgr, 0.0
    # recorte: el rectangulo mas grande, de la misma proporcion, que entra dentro de la foto girada
    r = np.radians(abs(med))
    s = np.cos(r) + np.sin(r) * max(w / h, h / w)
    if s > 1.08:
        # girar costaria recortar mas del 8 % de la foto: no se gira (foto angosta o giro grande)
        log(f"  (inclinacion {med:+.2f} grados detectada, no se corrige: costaria recortar {1 - 1 / s:.0%} de la foto)")
        return bgr, 0.0
    M = cv2.getRotationMatrix2D((w / 2, h / 2), med, 1.0)
    rot = cv2.warpAffine(bgr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    cw, ch = int(w / s) - 2, int(h / s) - 2
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    return rot[y0:y0 + ch, x0:x0 + cw], med


def girar_recortar(bgr, grados):
    """Giro manual (positivo = antihorario) y recorte al rectangulo mas grande de la misma proporcion."""
    h, w = bgr.shape[:2]
    r = np.radians(abs(grados))
    s = np.cos(r) + np.sin(r) * max(w / h, h / w)
    M = cv2.getRotationMatrix2D((w / 2, h / 2), grados, 1.0)
    rot = cv2.warpAffine(bgr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    cw, ch = int(w / s) - 2, int(h / s) - 2
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    return rot[y0:y0 + ch, x0:x0 + cw]


def recorte_manual(bgr, spec):
    h, w = bgr.shape[:2]
    x0, y0, x1, y1 = [float(v) for v in spec.split(",")]
    if max(x0, y0, x1, y1) <= 1.0:
        x0, x1, y0, y1 = x0 * w, x1 * w, y0 * h, y1 * h
    return bgr[int(y0):int(y1), int(x0):int(x1)]


def atenuar_fondo(bgr, mascara, fuerza):
    """Fondo: desenfoque + desaturado + un pelo mas claro, con mascara emplumada. Primer plano intacto."""
    h, w = bgr.shape[:2]
    m = cv2.GaussianBlur(mascara, (0, 0), max(2.0, 0.006 * max(h, w)))
    m = np.clip(m, 0, 1)[..., None]
    sig = max(2.0, 0.010 * max(h, w)) * (0.4 + fuerza)
    borr = cv2.GaussianBlur(bgr, (0, 0), sig).astype(np.float32)
    gris = cv2.cvtColor(cv2.cvtColor(borr.astype(np.uint8), cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR).astype(np.float32)
    des = borr * (1 - 0.6 * fuerza) + gris * (0.6 * fuerza)
    des = des * (1 - 0.10 * fuerza) + 255 * 0.10 * fuerza  # un pelo mas claro
    fondo = bgr.astype(np.float32) * (1 - fuerza) + des * fuerza
    return np.clip(m * bgr.astype(np.float32) + (1 - m) * fondo, 0, 255).astype(np.uint8)


def cmd_maquina(entrada, salida, x=2, fondo=0.0, recorte=None, enderezar_=True, sr="fsrcnn", barras=True,
                modelo="isnet-general-use", calidad=95, limpiar=0.0, girar=None):
    t0 = time.time()
    bgr = cargar(entrada)
    if barras:
        bgr = quitar_barras_negras(bgr)
    h0, w0 = bgr.shape[:2]
    grados = 0.0
    if girar:
        bgr, grados = girar_recortar(bgr, girar), girar
    elif enderezar_:
        bgr, grados = enderezar(bgr)
    if recorte:
        if recorte == "auto":
            m = limpiar_mascara(mascara_rembg(bgr, modelo), solo_mayor=False)
            ys, xs = np.where(m > 0.5)
            if len(xs):
                h, w = bgr.shape[:2]
                pad = 0.04
                x0, x1 = max(0, xs.min() - pad * w), min(w, xs.max() + pad * w)
                y0, y1 = max(0, ys.min() - pad * h), min(h, ys.max() + pad * h)
                bgr = bgr[int(y0):int(y1), int(x0):int(x1)]
        else:
            bgr = recorte_manual(bgr, recorte)
    # limpieza de ruido: APAGADA por defecto (en pruebas dejaba las superficies lisas como "pintura al oleo")
    if limpiar > 0:
        bgr = cv2.fastNlMeansDenoisingColored(bgr, None, limpiar, limpiar, 5, 15)
    bgr = balance_blancos(bgr, None, fuerza=0.6)
    bgr = exposicion(bgr, objetivo=0.48, max_gamma=1.4)
    bgr = clahe_suave(bgr, clip=1.3, grilla=8, mezcla=0.35)
    mascara = None
    if fondo > 0:
        mascara = limpiar_mascara(mascara_rembg(bgr, modelo), solo_mayor=False)
    bgr = agrandar(bgr, x, sr)
    if fondo > 0:
        mascara = cv2.resize(mascara, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_CUBIC)
        bgr = atenuar_fondo(bgr, np.clip(mascara, 0, 1), fondo)
    bgr = nitidez(bgr, cantidad=0.55, radio=1.0 + 0.3 * x, umbral=2)
    out = Path(salida)
    out.parent.mkdir(parents=True, exist_ok=True)
    ext = out.suffix.lower()
    prm = [cv2.IMWRITE_JPEG_QUALITY, calidad] if ext in (".jpg", ".jpeg") else []
    cv2.imencode(ext, bgr, prm)[1].tofile(str(out))
    log(f"  maquina {Path(entrada).name}: {w0}x{h0} -> {bgr.shape[1]}x{bgr.shape[0]}  giro {grados:+.2f} grados  {time.time() - t0:.1f} s")
    return bgr


# ----------------------------------------------------------------------------- CLI
def main(argv=None):
    ap = argparse.ArgumentParser(description="Fotos de celular -> foto de catalogo (local, CPU).")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def comunes(p):
        p.add_argument("--x", type=float, default=2, help="factor de agrandado (1, 2, 3, 4). Por defecto 2")
        p.add_argument("--sr", default="fsrcnn", choices=["fsrcnn", "edsr", "espcn", "lanczos"])
        p.add_argument("--modelo", default="isnet-general-use", help="modelo de rembg (isnet-general-use, u2net, birefnet-general-lite...)")
        p.add_argument("--no-barras", action="store_true", help="no sacar barras negras de captura")

    p = sub.add_parser("pieza")
    p.add_argument("entrada"), p.add_argument("salida")
    comunes(p)
    p.add_argument("--sombra", type=float, default=0.30, help="intensidad de la sombra 0..1 (0 = sin sombra)")
    p.add_argument("--blanco", action="store_true", help="guardar tambien <salida>_blanco.png (plano, fondo blanco)")
    p.add_argument("--guardar-mascara", default=None)

    p = sub.add_parser("maquina")
    p.add_argument("entrada"), p.add_argument("salida")
    comunes(p)
    p.add_argument("--fondo", type=float, default=0.0, help="atenuar fondo 0..1 (0 = apagado)")
    p.add_argument("--recorte", default=None, help="'auto' o 'x0,y0,x1,y1' (fracciones 0..1 o pixeles)")
    p.add_argument("--sin-enderezar", action="store_true")
    p.add_argument("--limpiar", type=float, default=0.0, help="reduccion de ruido (0 = apagada; 2-3 = suave). Alisa texturas")
    p.add_argument("--girar", type=float, default=None, help="giro manual en grados (+ = antihorario), con recorte. Es lo confiable; el automatico es muy conservador")
    p.add_argument("--calidad", type=int, default=95)

    p = sub.add_parser("lote")
    p.add_argument("entrada"), p.add_argument("salida"), p.add_argument("tipo", choices=["pieza", "maquina"])
    comunes(p)
    p.add_argument("--sombra", type=float, default=0.30)
    p.add_argument("--fondo", type=float, default=0.0)
    p.add_argument("--recorte", default=None)
    p.add_argument("--solo", default=None, help="nombres (sin extension) separados por coma")
    p.add_argument("--blanco", action="store_true", help="(pieza) guardar tambien la version plana sobre blanco")
    p.add_argument("--limpiar", type=float, default=0.0, help="(maquina) reduccion de ruido, 0 = apagada")

    a = ap.parse_args(argv)
    fx = int(a.x) if float(a.x).is_integer() else a.x
    if a.cmd == "pieza":
        cmd_pieza(a.entrada, a.salida, fx, a.sombra, a.blanco, a.modelo, a.sr, not a.no_barras, a.guardar_mascara)
    elif a.cmd == "maquina":
        cmd_maquina(a.entrada, a.salida, fx, a.fondo, a.recorte, not a.sin_enderezar, a.sr, not a.no_barras, a.modelo, a.calidad, a.limpiar, a.girar)
    else:
        ent, sal = Path(a.entrada), Path(a.salida)
        for f in sorted(ent.iterdir()):
            if f.suffix.lower() not in EXT:
                continue
            if a.solo and f.stem not in a.solo.split(","):
                continue
            if a.tipo == "pieza":
                cmd_pieza(f, sal / (f.stem + ".png"), fx, a.sombra, a.blanco, a.modelo, a.sr, not a.no_barras)
            else:
                cmd_maquina(f, sal / (f.stem + ".jpg"), fx, a.fondo, a.recorte, True, a.sr, not a.no_barras, a.modelo, 95, a.limpiar)


if __name__ == "__main__":
    main()
