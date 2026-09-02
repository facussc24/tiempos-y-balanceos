# -*- coding: utf-8 -*-
"""FOTO del 3D: motor de render por TRAZADO DE RAYOS, ortografico.

Por que existe. El render que se entrego el 31/08 lo dibujaba matplotlib con
Poly3DCollection y el algoritmo del pintor: sin sombras, sin oclusion real y con todo
del mismo color, un caballete de tubos se ve como una CHAPA. Fak lo miro y no pudo
decir que era cada cosa ("no veo el insert, veo esa cosa extrana"). Un entregable que
tiene que hacer entender un proceso necesita una imagen que se lea sola.

Que hace distinto:
  - ORTOGRAFICA: la escala mm->pixel es CONSTANTE en toda la imagen, asi que una
    persona dibujada al lado esta a escala de verdad y una cota medida en pixeles es
    una cota medida en milimetros. Con perspectiva eso no vale.
  - oclusion EXACTA (el rayo pega en lo que esta adelante, no en lo que se ordeno
    primero), sombra proyectada al piso y sombreado difuso: eso es lo que da volumen.
  - contorno por discontinuidad de PROFUNDIDAD y de COLOR sobre el buffer, que es lo
    que hace que un tubo se distinga del tubo de atras.

El motor de rayos es embree (embreex), que trimesh toma solo. Sin el, esto tarda
100 veces mas pero da lo mismo.

Se usa como libreria (Escena / camara / render) desde los scripts de entregable.

PROCEDENCIA: nacio suelto en C:/Dev/_adhesivado (la carpeta de trabajo del carro de
adhesivado) el 01/09/2026, y se promovio a este skill el 02/09/2026. Vivir en una carpeta
de trabajo de una tarea significaba que la tarea siguiente volvia a matplotlib, que es
exactamente el fallo que este archivo existe para no repetir. El gate de entregable
(gate_entregable.py) exige que el motor declarado sea uno de los de procesoCanon.data.json,
y matplotlib esta en la lista de RECHAZADOS.
"""
import numpy as np
import trimesh

EPS = 0.05          # mm que se despega el rayo de sombra de la superficie

# FONDO BLANCO por decision de Fak (02/09/2026): "nada que ver, totalmente equivocado eso.
# Necesito verlos bien los modelos 3D, con fondo blanco". No es una preferencia estetica:
# el entregable se imprime y se pega en un PDF de proceso, y sobre negro no se lee.
COLOR_FONDO = "#ffffff"
# El piso NO puede ser casi blanco cuando el fondo es blanco. El calculo de luz de render()
# le mete un factor ~1,14 a una cara horizontal, asi que un piso #eceae5 CLIPEA a 1,0 y
# desaparece contra el fondo: la pieza queda flotando y la sombra parece una mancha suelta.
# Medido con verificar_fondo_blanco.py. El valor de abajo es el que deja el piso iluminado
# por debajo de 1,0 con el mismo calculo de luz.
COLOR_PISO = "#c9c6bf"


def _rgb(c):
    c = c.lstrip("#")
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


class Escena(object):
    """Triangulos + un color por triangulo. Se arma sumando grupos."""

    def __init__(self):
        self.tris = []
        self.cols = []
        self.ids = []
        self._n = 0

    def agregar(self, T, color, nombre=None):
        T = np.asarray(T, np.float64)
        if T.ndim != 3 or T.shape[1:] != (3, 3) or len(T) == 0:
            return self
        self.tris.append(T)
        self.cols.append(np.repeat(_rgb(color)[None, :], len(T), 0))
        self.ids.append(np.full(len(T), self._n, np.int32))
        self._n += 1
        return self

    def agregar_malla(self, m, color):
        return self.agregar(np.asarray(m.vertices)[np.asarray(m.faces)], color)

    def piso(self, mn, mx, color=None, margen=None, z=0.0, lados=72):
        """Una TARIMA circular a z. Sin piso el carro flota y no hay donde caiga la sombra.

        OJO, y esto lo destapo el control de pixel del 02/09/2026: el piso era un cuadrado
        de 30 m de lado, o sea INFINITO para la escena. Una camara ORTOGRAFICA no tiene
        punto de fuga: un plano infinito que no es paralelo al rayo tapa el 100 % de la
        imagen. Medido: 0 pixeles de fondo en 395.200. Consecuencia -- el parametro `fondo`
        NO SE VEIA NUNCA, y renderizar con fondo blanco o con fondo negro daba EXACTAMENTE
        la misma imagen (las 4 esquinas en 255,255,255 en los dos casos). El "fondo blanco"
        que se veia era el piso CLIPEANDO a 1,0, no el fondo.

        Por eso la tarima es ACOTADA: arriba del borde se ve fondo de verdad. Y es un disco
        y no un rectangulo porque la esquina de un rectangulo se lee como el borde de una
        mesa que no existe.

        margen: cuanto sobresale la tarima. Por defecto se deriva del tamano de la pieza y
        de su ALTURA, porque la sombra de algo alto cae lejos: con luz a 35 grados sobre la
        horizontal la sombra se corre ~0,7 de la altura, y una tarima que no la contiene
        corta la sombra al medio.
        """
        color = COLOR_PISO if color is None else color
        mn, mx = np.asarray(mn, float), np.asarray(mx, float)
        dx, dy = mx[0] - mn[0], mx[1] - mn[1]
        dz = (mx[2] - mn[2]) if len(mx) > 2 else 0.0
        if margen is None:
            margen = max(0.28 * max(dx, dy), 0.90 * dz, 50.0)
        cx, cy = (mn[0] + mx[0]) / 2.0, (mn[1] + mx[1]) / 2.0
        r = float(np.hypot(dx, dy)) / 2.0 + float(margen)
        th = np.linspace(0.0, 2 * np.pi, int(lados), endpoint=False)
        v = np.stack([cx + r * np.cos(th), cy + r * np.sin(th), np.full(len(th), z)], 1)
        c = np.array([cx, cy, z], float)
        T = np.stack([np.repeat(c[None, :], len(v), 0), v, np.roll(v, -1, axis=0)], 1)
        return self.agregar(T, color)

    def compilar(self):
        T = np.concatenate(self.tris)
        V = T.reshape(-1, 3)
        F = np.arange(len(V)).reshape(-1, 3)
        self.malla = trimesh.Trimesh(vertices=V, faces=F, process=False)
        self.color_tri = np.concatenate(self.cols)
        self.id_tri = np.concatenate(self.ids)
        n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        self.normal_tri = n / np.where(ln < 1e-12, 1.0, ln)
        self.bbox = (V.min(0), V.max(0))
        return self


class Camara(object):
    """Camara ORTOGRAFICA. elev/azim en grados; ancho de la ventana en mm."""

    def __init__(self, centro, elev, azim, ancho_mm, px=(1600, 1100)):
        e, a = np.radians(elev), np.radians(azim)
        self.d = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
        up = np.array([0.0, 0.0, 1.0])
        if abs(self.d[2]) > 0.999:
            up = np.array([0.0, 1.0, 0.0])
        self.right = np.cross(up, self.d)
        self.right /= np.linalg.norm(self.right)
        self.up = np.cross(self.d, self.right)
        self.centro = np.asarray(centro, float)
        self.W, self.H = px
        self.mm_px = float(ancho_mm) / self.W
        self.ancho_mm = float(ancho_mm)

    def proyectar(self, p):
        """Punto 3D -> pixel (col, fila). Exacto: la camara es ortografica."""
        p = np.atleast_2d(np.asarray(p, float)) - self.centro
        x = p @ self.right / self.mm_px + self.W / 2.0
        y = self.H / 2.0 - p @ self.up / self.mm_px
        return np.stack([x, y], 1)

    def rayos(self):
        j, i = np.meshgrid(np.arange(self.W), np.arange(self.H))
        # el 0,137 corre la grilla del borde exacto del pixel: un rayo tangente a la
        # silueta es ambiguo y da ruido de un pixel en el contorno.
        u = (j + 0.137 - self.W / 2.0) * self.mm_px
        v = (self.H / 2.0 - i - 0.137) * self.mm_px
        o = (self.centro + self.d * 1e5
             + self.right * u[..., None] + self.up * v[..., None])
        return o.reshape(-1, 3), np.repeat((-self.d)[None, :], self.W * self.H, 0)


def render(esc, cam, luz=(-0.45, -0.35, 0.82), sombra=True, fondo=COLOR_FONDO,
           ambiente=0.52, rim=0.14, relleno=(0.55, -0.62, 0.30), k_relleno=0.20):
    """Devuelve (imagen RGB float HxWx3, buffer de profundidad, buffer de id).

    Dos luces a proposito: con una sola, toda cara que no la mira cae al ambiente y un
    tubo negro al lado de otro tubo negro no se distingue. La de relleno no proyecta
    sombra (es luz de ambiente direccionada), solo levanta el lado oscuro.
    """
    L = np.asarray(luz, float)
    L /= np.linalg.norm(L)
    L2 = np.asarray(relleno, float)
    L2 /= np.linalg.norm(L2)
    o, d = cam.rayos()
    idx, ray, loc = esc.malla.ray.intersects_id(
        ray_origins=o, ray_directions=d, multiple_hits=False, return_locations=True)

    img = np.repeat(_rgb(fondo)[None, None, :], cam.H * cam.W, 0).reshape(-1, 3)
    prof = np.full(cam.H * cam.W, np.inf)
    ident = np.full(cam.H * cam.W, -1, np.int32)
    if len(ray):
        nrm = esc.normal_tri[idx]
        # normal hacia la camara: el STEP no garantiza orientacion consistente
        nrm = np.where((nrm @ cam.d)[:, None] < 0, -nrm, nrm)
        base = esc.color_tri[idx]
        dif = np.clip(nrm @ L, 0.0, 1.0)
        dif2 = np.clip(nrm @ L2, 0.0, 1.0)
        vis = np.ones(len(ray))
        if sombra:
            hit = esc.malla.ray.intersects_any(
                ray_origins=loc + nrm * EPS, ray_directions=np.repeat(L[None, :], len(ray), 0))
            vis = np.where(hit, 0.34, 1.0)
        # rim: realza el borde que mira de canto a la camara, separa pieza de pieza
        borde = 1.0 - np.abs(nrm @ cam.d)
        f = ambiente + 0.62 * dif * vis + k_relleno * dif2 + rim * borde ** 3
        img[ray] = np.clip(base * f[:, None], 0, 1)
        prof[ray] = (loc - cam.centro) @ (-cam.d)
        ident[ray] = esc.id_tri[idx]
    img = img.reshape(cam.H, cam.W, 3)
    prof = prof.reshape(cam.H, cam.W)
    ident = ident.reshape(cam.H, cam.W)
    return img, prof, ident


def contornos(img, prof, ident, cam=None, salto_mm=None, fuerza=0.62):
    """Oscurece donde la profundidad QUIEBRA o donde cambia la pieza.

    OJO, y aca me equivoque una vez: no sirve la DERIVADA de la profundidad. Un piso
    visto casi de canto (elevacion 12 grados) cambia de profundidad ~13 mm por pixel, o
    sea mas que cualquier umbral razonable de salto, y el control marcaba el piso ENTERO
    como contorno -- la imagen salia gris uniforme. Un plano inclinado no es un borde.
    Lo que distingue un borde de una rampa es la SEGUNDA derivada: sobre una rampa vale
    cero, y en un escalon vale el escalon. El umbral, ademas, se mide en pixeles de ESTA
    camara (mm_px), no en un numero fijo en milimetros.
    """
    fin = np.isfinite(prof)
    P = np.where(fin, prof, (prof[fin].max() + 1e4) if fin.any() else 0.0)
    lap = np.zeros_like(P)
    lap[1:-1, 1:-1] = np.abs(P[1:-1, 2:] + P[1:-1, :-2] - 2 * P[1:-1, 1:-1]) \
        + np.abs(P[2:, 1:-1] + P[:-2, 1:-1] - 2 * P[1:-1, 1:-1])
    if salto_mm is None:
        salto_mm = 8.0 * (cam.mm_px if cam is not None else 1.0)
    di = np.zeros(P.shape, bool)
    di[1:-1, 1:-1] = (ident[1:-1, 2:] != ident[1:-1, :-2]) | (ident[2:, 1:-1] != ident[:-2, 1:-1])
    linea = (lap > salto_mm) | di
    out = img.copy()
    out[linea] *= (1.0 - fuerza)
    return out


def autotest_contornos():
    """Gemelo del control de arriba, en VERDE y en ROJO.

    Verde: un plano inclinado (rampa pura) no puede tener contorno adentro.
    Rojo:  el mismo plano con un escalon si lo tiene, y justo en el escalon.
    Devuelve (fraccion marcada en la rampa, fraccion marcada con el escalon).
    """
    n = 120
    rampa = np.tile(np.linspace(0.0, 4000.0, n), (n, 1))
    ident = np.zeros((n, n), np.int32)
    img = np.ones((n, n, 3))
    cam_px = 4000.0 / n
    a = contornos(img, rampa, ident, salto_mm=8.0 * cam_px)
    con_escalon = rampa.copy()
    con_escalon[:, n // 2:] += 300.0
    b = contornos(img, con_escalon, ident, salto_mm=8.0 * cam_px)
    return float((a[:, :, 0] < 0.9).mean()), float((b[:, :, 0] < 0.9).mean())


# --------------------------------------------------------------------------- persona
def maniqui(estatura_mm=1700.0, origen=(0.0, 0.0, 0.0), rumbo_deg=0.0,
            brazos_deg=(-20.0, -20.0), color="#3f4c63"):
    """Operario de referencia de ESCALA, parado, con los brazos posables.

    NO es un dato tecnico: es una figura de escala, y su estatura va declarada al lado
    en el entregable. Las proporciones son las canonicas de dibujo (cabeza = 1/7,5 de
    la estatura); lo que importa aca es el TAMANO, que si esta a escala del carro.

    brazos_deg: angulo de cada brazo respecto de la vertical, hacia adelante (+ = sube).
    """
    H = float(estatura_mm)
    piezas = []

    def cil(p0, p1, r, secciones=14):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        v = p1 - p0
        h = float(np.linalg.norm(v))
        if h < 1e-6:
            return
        m = trimesh.creation.cylinder(radius=r, height=h, sections=secciones)
        d = v / h
        z = np.array([0.0, 0.0, 1.0])
        ejeR = np.cross(z, d)
        s = float(np.linalg.norm(ejeR))
        if s < 1e-9:
            R = np.eye(3) if d[2] > 0 else np.diag([1.0, -1.0, -1.0])
        else:
            ejeR /= s
            c = float(z @ d)
            K = np.array([[0, -ejeR[2], ejeR[1]], [ejeR[2], 0, -ejeR[0]], [-ejeR[1], ejeR[0], 0]])
            R = np.eye(3) + K * s + K @ K * (1 - c)
        M = np.eye(4)
        M[:3, :3] = R
        M[:3, 3] = (p0 + p1) / 2.0
        m.apply_transform(M)
        piezas.append(m)

    def esf(c, r):
        m = trimesh.creation.icosphere(subdivisions=2, radius=r)
        m.apply_translation(c)
        piezas.append(m)

    # proporciones de la figura, en fraccion de la estatura
    z_tobillo, z_rodilla, z_cadera = 0.039 * H, 0.285 * H, 0.530 * H
    z_hombro, z_cuello, z_coronilla = 0.818 * H, 0.870 * H, H
    sep_pie, sep_hombro = 0.052 * H, 0.105 * H
    r_pierna, r_brazo, r_torso = 0.030 * H, 0.022 * H, 0.088 * H

    for s in (-1, 1):
        cil((s * sep_pie, 0, z_tobillo), (s * sep_pie, 0, z_rodilla), r_pierna)
        cil((s * sep_pie, 0, z_rodilla), (s * sep_pie * 0.6, 0, z_cadera), r_pierna * 0.92)
        # pie
        pie = trimesh.creation.box((0.145 * H, 0.058 * H, z_tobillo * 1.6))
        pie.apply_translation((s * sep_pie, 0.030 * H, z_tobillo * 0.8))
        piezas.append(pie)
    # torso: tronco de prisma redondeado
    torso = trimesh.creation.cylinder(radius=r_torso, height=z_hombro - z_cadera, sections=18)
    torso.apply_scale((1.0, 0.56, 1.0))
    torso.apply_translation((0, 0, (z_hombro + z_cadera) / 2.0))
    piezas.append(torso)
    cil((0, 0, z_hombro), (0, 0, z_cuello), 0.032 * H)
    esf((0, 0.006 * H, z_cuello + 0.068 * H), 0.068 * H)
    # brazos: hombro -> codo -> mano, girando hacia ADELANTE (+y)
    largo_b = 0.185 * H
    for k, s in enumerate((-1, 1)):
        ang = np.radians(brazos_deg[k])
        hom = np.array([s * sep_hombro, 0.0, z_hombro - 0.012 * H])
        cod = hom + np.array([s * 0.012 * H, np.sin(ang) * largo_b, -np.cos(ang) * largo_b])
        man = cod + np.array([0.0, np.sin(ang + np.radians(38)) * largo_b,
                              -np.cos(ang + np.radians(38)) * largo_b])
        cil(hom, cod, r_brazo)
        cil(cod, man, r_brazo * 0.88)
        esf(man, r_brazo * 1.15)

    m = trimesh.util.concatenate(piezas)
    th = np.radians(rumbo_deg)
    R = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1.0]])
    M = np.eye(4)
    M[:3, :3] = R
    m.apply_transform(M)
    m.apply_translation(np.asarray(origen, float))
    m.metadata["color"] = color
    return m
