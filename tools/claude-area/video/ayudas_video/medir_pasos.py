#!/usr/bin/env python
# medir_pasos.py SECTOR DESDE HASTA [paso]: sigue la linea gris "Recibido un mensaje," (o, en Calidad, la segunda
# "Mensaje recibido de") y dice en que instante cambia de lugar (la conversacion se desplaza de a saltos).
import sys, subprocess
import numpy as np

C = r"C:\Dev\BarackMercosul\.sgc-cache\claude-por-area\tomas-crudas"
H = 1010
sector, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
paso = float(sys.argv[4]) if len(sys.argv) > 4 else 0.1


def cuadros(ruta, desde, hasta, paso, x0, x1):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{desde}", "-t", f"{hasta - desde}", "-i", ruta, "-vf",
           f"fps=1/{paso},crop={x1 - x0}:{H}:{x0}:0,format=gray", "-f", "rawvideo", "-"]
    p = subprocess.run(cmd, capture_output=True)
    n = len(p.stdout) // ((x1 - x0) * H)
    return np.frombuffer(p.stdout, dtype=np.uint8)[: n * (x1 - x0) * H].reshape(n, H, x1 - x0).astype(np.int32)


if sector == "calidad":
    x0, x1, yp0, yp1, tp, ref = 420, 560, 616, 640, 14.0, "calidad"
    qual = 1
else:
    x0, x1, yp0, yp1, tp, ref = 420, 525, 354, 376, 33.0, "logistica"
    qual = 0
plantilla = cuadros(f"{C}\\sector-{ref}.mp4", tp, tp + 0.5, 0.5, x0, x1)[0][yp0:yp1]
alto = yp1 - yp0
marcos = cuadros(f"{C}\\sector-{sector}.mp4", t0, t1, paso, x0, x1)
anterior = None
for i, f in enumerate(marcos):
    d = np.array([np.abs(f[y:y + alto] - plantilla).mean() for y in range(0, H - alto)])
    cand = [y for y in range(1, len(d) - 1) if d[y] < 10 and d[y] <= d[y - 1] and d[y] <= d[y + 1]]
    y = (cand[-1] if qual else (cand[0] if cand else None))
    if y != anterior:
        print(f"{t0 + i * paso:6.2f} s  y={y}")
        anterior = y
