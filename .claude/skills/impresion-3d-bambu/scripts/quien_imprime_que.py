"""Lee un plate_N.gcode de Bambu Studio y dice que filamento imprime cada cosa.

Uso: quien_imprime_que.py <plate_1.gcode>
Por filamento: en que capas trabaja, cuantos mm extruye y el rectangulo XY que ocupa sobre la
PIEZA (sin la torre de purga ni el arranque). Sirve para comprobar un dos colores sin fiarse
de la miniatura del archivo, que por comando sale de un solo color.
"""
import collections
import re
import sys

tool = "inicial"
capa, feat, x, y = 0, None, None, None
mm = collections.defaultdict(float)
capas = collections.defaultdict(set)
caja = {}
orden = []
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    if line.startswith("; CHANGE_LAYER"):       # una por capa, en todos los perfiles de Bambu
        capa += 1
    elif line.startswith("; FEATURE:"):
        feat = line.split(":", 1)[1].strip()
    elif re.match(r"^T\d+\s*$", line):
        t = int(line[1:])
        if t < 16:
            tool = t + 1                      # filamento 1..4 como en el cargador
            orden.append((capa, tool))
    elif line.startswith(("G1 ", "G0 ", "G2 ", "G3 ")):
        mx, my, me = (re.search(r" %s(-?[\d.]+)" % c, line) for c in "XYE")
        nx = float(mx.group(1)) if mx else x
        ny = float(my.group(1)) if my else y
        if me and float(me.group(1)) > 0 and (mx or my) and capa > 0 and feat not in ("Prime tower", "Custom", None):
            mm[tool] += float(me.group(1))
            capas[tool].add(capa)
            c = caja.setdefault(tool, [1e9, 1e9, -1e9, -1e9])
            for px, py in ((x, y), (nx, ny)):
                if px is not None and py is not None:
                    c[0], c[1], c[2], c[3] = min(c[0], px), min(c[1], py), max(c[2], px), max(c[3], py)
        x, y = nx, ny
print("cambios (capa -> filamento):", orden)
for t in sorted(mm, key=str):
    c = caja[t]
    cs = sorted(capas[t])
    print(f"filamento {t}: {mm[t]:.0f} mm | capas {cs[0]} a {cs[-1]} ({len(cs)}) | "
          f"ocupa {c[2]-c[0]:.1f} x {c[3]-c[1]:.1f} mm en x {c[0]:.1f}..{c[2]:.1f}, y {c[1]:.1f}..{c[3]:.1f}")
