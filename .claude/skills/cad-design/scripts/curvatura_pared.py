# -*- coding: utf-8 -*-
"""¿La pared del pico (zona de empuje) es plana o curva? Si es curva, la cara plana
del empujador solo tocaria en los picos. Mido la desviacion de los puntos de la pared
respecto de su mejor plano, en la zona X[461,498] Z[780,825] (frame posicionador)."""
import numpy as np

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
full = np.load(D + r"\full_pts_posframe.npy")

# zona de empuje: barra en X[461.5,498], la pared interna del pico mira hacia -Y aprox
# (la cara del empujador empuja en +Y). Tomamos puntos en esa franja X, Z medio-alto,
# y del lado interno (Y alto, cerca de la cara del empujador que esta en Y~57-60 local...
# en frame posicionador la cara de empuje esta cerca de Y de la barra).
# Filtramos por X y Z; el "lado" lo tomamos por el Y mas cercano a la barra.
sel = (full[:, 0] > 461) & (full[:, 0] < 498) & (full[:, 2] > 778) & (full[:, 2] < 826)
z = full[sel]
print(f"puntos en zona de empuje: {len(z)}")
print(f"rango Y en la zona: [{z[:,1].min():.1f}, {z[:,1].max():.1f}]")

# la pared que empuja el empujador es la superficie del lado del empujador.
# El empujador (barra) esta en Y alto (~57-60 en la cara de empuje). Tomamos el
# 'skin' del lado +Y: para cada (x,z) el punto de mayor Y.
from collections import defaultdict
# grid en X,Z, tomar max Y por celda (superficie que mira al empujador)
nx, nz = 40, 40
xi = np.clip(((z[:, 0]-461)/(498-461)*nx).astype(int), 0, nx-1)
zi = np.clip(((z[:, 2]-778)/(826-778)*nz).astype(int), 0, nz-1)
wall = {}
for p, ix, iz in zip(z, xi, zi):
    k = (ix, iz)
    if k not in wall or p[1] > wall[k][1]:
        wall[k] = p
wpts = np.array(list(wall.values()))
print(f"puntos de pared (max Y por celda): {len(wpts)}")

# mejor plano por SVD
ctr = wpts.mean(0)
U, S, Vt = np.linalg.svd(wpts - ctr)
normal = Vt[2]
dist = (wpts - ctr) @ normal
print(f"\nDESVIACION de la pared del pico respecto de su mejor plano:")
print(f"  RMS={np.sqrt((dist**2).mean()):.3f} mm | max={np.abs(dist).max():.3f} mm | p95={np.percentile(np.abs(dist),95):.3f} mm")
print(f"  normal del plano de pared: ({normal[0]:+.3f},{normal[1]:+.3f},{normal[2]:+.3f})")

# comparar con la normal de la cara de empuje del empujador (b local ~ (0.0147,0.9898,0.1419))
b = np.array([0.0147, 0.9898, 0.1419]); b /= np.linalg.norm(b)
ang = np.degrees(np.arccos(np.clip(abs(normal @ b), 0, 1)))
print(f"  angulo entre normal de pared y la cara del empujador (b): {ang:.1f} deg")

# curvatura en X (a lo largo del pico) y en Z (altura): rango de Y proyectado
# ajustar Y como funcion de X y de Z por separado
for axis, name in ((0, "X (a lo largo del pico)"), (2, "Z (altura)")):
    order = np.argsort(wpts[:, axis])
    w = wpts[order]
    # residuo de un ajuste lineal Y vs axis
    A = np.column_stack([w[:, axis], np.ones(len(w))])
    coef, *_ = np.linalg.lstsq(A, w[:, 1], rcond=None)
    resid = w[:, 1] - A @ coef
    print(f"  curvatura en {name}: pendiente dY/d{name[0]}={coef[0]:+.3f}, residuo no-lineal RMS={np.sqrt((resid**2).mean()):.3f} mm rango={resid.max()-resid.min():.3f} mm")
