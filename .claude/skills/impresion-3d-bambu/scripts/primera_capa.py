"""Dibuja lo que la impresora va a apoyar en la cama: la PRIMERA CAPA del codigo laminado, vista de arriba.

Uso (python del sistema, con Pillow):
  primera_capa.py <archivo.gcode.3mf> [salida.png]
Sin salida, deja <archivo>_PRIMERA_CAPA.png al lado del archivo. `bambu_red.py --imprimir` lo llama
solo y avisa si no hay borde de adherencia.

Por que existe (15/10/2026): tres pines acostados apoyaban solo en dos islitas de 3,6 mm por pieza;
la miniatura de Bambu Studio los mostraba enteros y lindos, y se despegaron al 27 %. Lo que pega en
la cama solo se ve en la primera capa. Fak: *"guardaste una foto del antes de imprimir?... estaria
bueno agregarlo a la skill"*.
"""
import re
import sys
import zipfile
from pathlib import Path

ANCHO_LINEA = 0.42      # mm; el encabezado dice 0,5 en la primera capa: con 0,42 el apoyo da ~6 % abajo del calculo por volumen
NO_PIEZA = ("Prime tower", "Support", "Support interface", "Skirt")   # pegan en la cama pero no son la pieza
APOYO_CHICO = 1000      # mm2 de apoyo total por debajo del cual, sin borde, se avisa (los pines que se despegaron: 100)


def segmentos(archivo):
    """Tramos con material de la primera capa: (x0, y0, x1, y1, tipo)."""
    g = zipfile.ZipFile(archivo).read("Metadata/plate_1.gcode").decode("utf-8", "ignore").splitlines()
    segs, x, y, capa, tipo = [], None, None, 0, ""
    for ren in g:
        if ren.startswith("; CHANGE_LAYER"):
            capa += 1
            if capa > 1:
                break
        if ren.startswith("; FEATURE:"):
            tipo = ren.split(":", 1)[1].strip()
        if ren.startswith(("G1 ", "G0 ")):
            mx, my, me = (re.search(p, ren) for p in (r"X([-\d.]+)", r"Y([-\d.]+)", r"E([-\d.]+)"))
            nx = float(mx.group(1)) if mx else x
            ny = float(my.group(1)) if my else y
            if capa == 1 and me and float(me.group(1)) > 0 and x is not None and (mx or my):
                segs.append((x, y, nx, ny, tipo))
            x, y = nx, ny
    return segs


def dibujar(archivo, salida=None):
    """Guarda la imagen y devuelve {'png', 'borde', 'apoyo_mm2'} (apoyo = la pieza, sin el borde)."""
    from PIL import Image, ImageDraw
    archivo = Path(archivo)
    base = archivo.name[:-len(".gcode.3mf")] if archivo.name.lower().endswith(".gcode.3mf") else archivo.stem
    salida = Path(salida) if salida else archivo.with_name(base + "_PRIMERA_CAPA.png")
    segs = segmentos(archivo)
    if not segs:
        raise SystemExit("el archivo no tiene primera capa legible")
    xs = [s[0] for s in segs] + [s[2] for s in segs]
    ys = [s[1] for s in segs] + [s[3] for s in segs]
    x0, x1, y0, y1 = min(xs) - 8, max(xs) + 8, min(ys) - 8, max(ys) + 8
    k = 1000 / max(x1 - x0, y1 - y0)
    W, H = int((x1 - x0) * k), int((y1 - y0) * k) + 70
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    for a, b, c, e, t in segs:
        d.line([((a - x0) * k, H - 70 - (b - y0) * k), ((c - x0) * k, H - 70 - (e - y0) * k)],
               fill=(230, 140, 30) if t == "Brim" else (160, 160, 160) if t in NO_PIEZA else (30, 30, 30), width=max(1, int(ANCHO_LINEA * k)))
    borde = any(s[4] == "Brim" for s in segs)
    apoyo = sum(((c - a) ** 2 + (e - b) ** 2) ** 0.5 for a, b, c, e, t in segs if t != "Brim" and t not in NO_PIEZA) * ANCHO_LINEA
    d.text((10, H - 60), f"Primera capa vista de arriba (lo que pega en la cama). Ancho mostrado {x1 - x0:.0f} mm. "
                         f"Apoyo de las piezas: {apoyo:.0f} mm2", fill="black")
    d.text((10, H - 40), ("Negro = la pieza   Naranja = borde de adherencia" if borde
           else "Negro = la pieza (SIN borde de adherencia)") + "   Gris = torre de purga o soporte", fill="black")
    im.save(salida)
    return {"png": str(salida), "borde": borde, "apoyo_mm2": round(apoyo, 1), "chico": apoyo < APOYO_CHICO}


if __name__ == "__main__":
    r = dibujar(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print("primera capa:", r["png"], "| borde de adherencia:", "si" if r["borde"] else "NO",
          "| apoyo de las piezas:", r["apoyo_mm2"], "mm2")
