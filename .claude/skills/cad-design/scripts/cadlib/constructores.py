# -*- coding: utf-8 -*-
"""Constructores de la casa (build123d): las piezas que Barack ya invento y no se vuelven a dibujar a mano.

Propuesta 2 del informe del sistema 3D (docs/INVESTIGACION_SISTEMA_3D_2026-10-23.md §10.2). La regla que la origina:
«el redondeo es PROPIEDAD del constructor» (reference/utillajes-de-apriete.md, 19/08/2026). Esa propiedad vivia en
caja_tope_redondeado() de C:\\Dev\\_utrim\\build_v10.py (gmsh) y el 20/10 se perdio al modelar con scripts/catia/: las
cajas salieron peladas. Aca vive una sola vez, y su gemelo de CATIA (scripts/catia/constructores_casa.py, raiz del
repo) tiene los mismos nombres y parametros; test_constructores.py falla si se separan.

Los valores por defecto salen de data/lenguaje_diseno.json (cada uno con su fuente). Ninguna funcion rellena en silencio:
si algo no entra o falta un dato, se niega con el motivo (la de agosto devolvia la caja sin redondear con un AVISO).

  caja(largo, ancho, alto, radio=None, motivo=None, centro=(0, 0, 0))
      apoyada en z = centro[2], centrada en XY. Redondea las 4 aristas verticales y el contorno de ARRIBA (en dos pasos:
      la esquina queda esferica, como el ejercicio 05 del juez de CATIA). La cara de abajo queda viva: se funde a otra
      pieza (como la de agosto). Radio por defecto: el de la casa (R1,5).
  placa(largo, ancho, espesor, chaflan_cama=None, radio=None, motivo=None, centro=(0, 0, 0))
      la cara de abajo es la de la CAMA: su contorno lleva chaflan a 45 grados, no filete (ficha-fdm.md G6). Arriba y
      verticales con el radio de la casa. El tamano del chaflan no tiene fuente (lenguaje_diseno.json: A DECIDIR):
      mientras sea null hay que pasarlo y queda escrito en la procedencia.
  marco(eje_x, eje_y, origen=(0, 0, 0)) -> matriz 4x4 con det +1 POR CONSTRUCCION (z = x × y).
  colocar(forma, M) -> copia ubicada. Se niega si M no es una rotacion o si es un ESPEJO (det -1): la palanca del
      20/10 quedo armada asi en las 7 piezas y 64 estados (AUDITORIA_auditor.md hallazgo 1). Acepta build123d o trimesh.
  verificar_poses(datos) -> lista de matrices que no son rotaciones propias (estados.json y parecidos).
  procedencia(forma), heredar(nueva, *origenes, cambio), registrar(workdir, nombre, forma, archivo=None),
  declarar(workdir, nombre, tipo, **datos), informe_procedencias(workdir):
      GATE 1 (SKILL.md): cada pieza dice de donde sale; la de un constructor dice «catalogo_casa», con el constructor,
      sus parametros y la version del lenguaje (las COTAS que se le pasan siguen saliendo del CAD medido o de Fak).
      Una pieza que sale de operar piezas de la casa la hereda con heredar(); «catalogo_casa» no se autodeclara.
  buscar(texto): el catalogo de la casa (data/catalogo_casa.json), el PRIMER paso del orden de busqueda antes de dibujar.

CLI (con .venv-cad):  python -m cadlib.constructores --buscar palanca | --lenguaje | --poses <estados.json>
                      | --procedencias <workdir>
El nucleo (lenguaje, radios, matrices) es Python puro: lo importa el gemelo de CATIA en _catia_env, sin build123d.
"""
import json
import math
import os
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(SKILL, "data")
LENGUAJE = os.path.join(DATA, "lenguaje_diseno.json")
CATALOGO = os.path.join(DATA, "catalogo_casa.json")
TOL_ROTACION = 1e-6
MOTIVO_MIN = 10            # caracteres: el mismo piso que la frase de Fak en los gates (frase_minima de los canon)
TIPOS_PROCEDENCIA = ("medida", "fak", "catalogo_casa", "catalogo_comercial", "de_cero")


class NoSePuede(ValueError):
    """Base: el constructor se niega y dice por que (nunca devuelve algo distinto de lo pedido)."""


class SinMotivo(NoSePuede):
    pass


class NoEntra(NoSePuede):
    pass


class FaltaDato(NoSePuede):
    pass


class Espejo(NoSePuede):
    pass


class NoEsRotacion(NoSePuede):
    pass


# ---------------------------------------------------------------- lenguaje de diseno (datos)
def _resolver(nodo, base):
    """Reemplaza {"desde": "archivo#clave"} por el valor del canon (clave «valor»): un numero vive en un solo lugar."""
    if isinstance(nodo, dict):
        out = {k: _resolver(v, base) for k, v in nodo.items()}
        if isinstance(nodo.get("desde"), str):
            archivo, _, clave = nodo["desde"].partition("#")
            with open(os.path.join(base, archivo), encoding="utf-8") as f:
                canon = json.load(f)
            if clave not in canon:
                raise FaltaDato(f"lenguaje_diseno.json apunta a {nodo['desde']} y esa clave no esta")
            out["valor"] = canon[clave]
        return out
    if isinstance(nodo, list):
        return [_resolver(v, base) for v in nodo]
    return nodo


def lenguaje(ruta=LENGUAJE):
    with open(ruta, encoding="utf-8") as f:
        return _resolver(json.load(f), SKILL)


def radio_mano(L=None):
    return float((L or lenguaje())["radios"]["mano_y_pieza"]["valor"])


def chaflan_cama_por_defecto(L=None):
    """mm del chaflan de cama del lenguaje, o None si esta A DECIDIR."""
    v = (L or lenguaje())["chaflanes"]["cara_de_cama"].get("mm")
    return None if v is None else float(v)


def _motivo_ok(motivo):
    return isinstance(motivo, str) and len(motivo.strip()) >= MOTIVO_MIN


def resolver_radio(radio, motivo, L=None):
    """El radio que va a usar el constructor. Sin radio: el de la casa. Menor que el de la casa (o 0): solo con motivo
    escrito, que queda en la procedencia (el patron de make_screw_nut.py --tuerca-baja)."""
    casa = radio_mano(L)
    r = casa if radio is None else float(radio)
    if r < 0:
        raise NoEntra(f"radio negativo ({r})")
    if r < casa - 1e-9 and not _motivo_ok(motivo):
        raise SinMotivo(f"radio {r:g} menor que el de la casa (R{casa:g}, lenguaje_diseno.json radios.mano_y_pieza): "
                        f"pasá motivo=\"<por que>\" ({MOTIVO_MIN} caracteres o mas) o usá el radio de la casa")
    return r


def resolver_chaflan(chaflan_cama, motivo, L=None):
    c = chaflan_cama_por_defecto(L) if chaflan_cama is None else float(chaflan_cama)
    if c is None:
        raise FaltaDato("el tamano del chaflan de cama esta A DECIDIR (lenguaje_diseno.json chaflanes.cara_de_cama: "
                        "ninguna fuente lo da; la casa uso 0,6 el 20/10 sin validar): pasá chaflan_cama=<mm>")
    if c <= 0 and not _motivo_ok(motivo):
        raise SinMotivo("sin chaflan en la cara de cama (ficha-fdm.md G6 pide chaflan a 45 grados): pasá motivo=\"...\"")
    if c < 0:
        raise NoEntra(f"chaflan negativo ({c})")
    return c


def chequear_caja(largo, ancho, alto, r):
    if min(largo, ancho, alto) <= 0:
        raise NoEntra(f"medidas no positivas: {largo} x {ancho} x {alto}")
    if r > 0 and (2 * r >= min(largo, ancho) - 1e-6 or r >= alto - 1e-6):
        raise NoEntra(f"R{r:g} no entra en {largo:g} x {ancho:g} x {alto:g} (hace falta 2R < largo y ancho, R < alto)")


def chequear_placa(largo, ancho, espesor, r, c):
    chequear_caja(largo, ancho, espesor, r)
    if c + r >= espesor - 1e-6:
        raise NoEntra(f"chaflan {c:g} + R{r:g} no entran en el espesor {espesor:g} (se tocarian arriba y abajo)")
    if r > 0 and c >= r - 1e-6:
        raise NoEntra(f"chaflan {c:g} >= R{r:g} de las esquinas: el chaflan se come el redondeo de la esquina")


# ---------------------------------------------------------------- matrices (Python puro)
def _det3(R):
    return (R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1])
            - R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0])
            + R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]))


def estado_matriz(M, tol=TOL_ROTACION):
    """{'det', 'error_ortonormal', 'ok', 'motivo'} de la parte 3x3 de una matriz 4x4 (o 3x4)."""
    R = [[float(M[i][j]) for j in range(3)] for i in range(3)]
    err = 0.0
    for i in range(3):
        for j in range(3):
            prod = sum(R[i][k] * R[j][k] for k in range(3))
            err = max(err, abs(prod - (1.0 if i == j else 0.0)))
    det = _det3(R)
    if err > tol:
        motivo = f"no es una rotacion (R·Rt se aleja de la identidad {err:.2e} > {tol:g}): tiene escala o corte"
    elif det < 0:
        motivo = ("es un ESPEJO (det %.6f): la pieza queda reflejada. Fue el hallazgo 1 de la auditoria del 20/10 "
                  "(palanca: det -1 en las 7 piezas). Armá la matriz con marco(eje_x, eje_y), que da det +1" % det)
    else:
        motivo = ""
    return {"det": round(det, 9), "error_ortonormal": err, "ok": not motivo, "motivo": motivo}


def validar_matriz(M, tol=TOL_ROTACION):
    e = estado_matriz(M, tol)
    if not e["ok"]:
        raise (Espejo if e["det"] < 0 and e["error_ortonormal"] <= tol else NoEsRotacion)(e["motivo"])
    return e


def marco(eje_x, eje_y, origen=(0.0, 0.0, 0.0)):
    """Matriz 4x4 (lista) cuyas columnas son x, y, z = x × y y el origen: una rotacion propia por construccion.
    eje_y se ortogonaliza contra eje_x; si son paralelos, se niega."""
    def norm(v):
        n = math.sqrt(sum(a * a for a in v))
        if n < 1e-12:
            raise NoEsRotacion("eje de largo cero")
        return [a / n for a in v]
    x = norm([float(a) for a in eje_x])
    y0 = [float(a) for a in eje_y]
    d = sum(a * b for a, b in zip(x, y0))
    yo = [a - d * b for a, b in zip(y0, x)]
    if math.sqrt(sum(a * a for a in yo)) < 1e-9:
        raise NoEsRotacion("eje_x y eje_y son paralelos: no definen un plano")
    y = norm(yo)
    z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]
    o = [float(a) for a in origen]
    return [[x[0], y[0], z[0], o[0]], [x[1], y[1], z[1], o[1]], [x[2], y[2], z[2], o[2]], [0.0, 0.0, 0.0, 1.0]]


def componentes_catia(M):
    """Los 12 numeros de Position.SetComponents de CATIA (la rotacion por COLUMNAS y despues la traslacion), validando
    antes: CATIA acepta una matriz espejo sin avisar y la muestra reflejada (y al exportar el STEP la corre de lugar,
    AUDITORIA_auditor.md hallazgo 1). Orden validado el 20/10 (anim_catia2.py componentes(); control_posiciones.py,
    CATIA = cuenta a 0,000 mm)."""
    validar_matriz(M)
    return [M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2], M[0][3], M[1][3], M[2][3]]


def verificar_poses(datos, tol=TOL_ROTACION):
    """[(camino, estado)] de cada matriz que no es una rotacion propia (ver revisar_poses)."""
    return revisar_poses(datos, tol)["malas"]


def revisar_poses(datos, tol=TOL_ROTACION):
    """Recorre un json de poses (dict o lista anidada): matrices 4x4 o 3x4 como listas de filas, o 16 numeros seguidos
    (4x4 por filas). Devuelve {'revisadas': N, 'malas': [(camino, estado)]}. Auditor 24/10: sin contar las revisadas,
    un archivo con la matriz escrita plana o vacio daba «0 malas» y salia verde."""
    malas, revisadas = [], [0]

    def es_matriz(v):
        return (isinstance(v, list) and len(v) in (3, 4) and all(isinstance(f, list) and len(f) == 4 for f in v)
                and all(isinstance(a, (int, float)) for f in v for a in f))

    def es_plana(v):
        return isinstance(v, list) and len(v) == 16 and all(isinstance(a, (int, float)) for a in v)

    def recorrer(v, camino):
        if es_plana(v):
            v = [v[0:4], v[4:8], v[8:12], v[12:16]]
        if es_matriz(v):
            revisadas[0] += 1
            e = estado_matriz(v, tol)
            if not e["ok"]:
                malas.append((camino, e))
            return
        if isinstance(v, dict):
            for k, w in v.items():
                recorrer(w, f"{camino}/{k}")
        elif isinstance(v, list):
            for i, w in enumerate(v):
                recorrer(w, f"{camino}[{i}]")
    recorrer(datos, "")
    return {"revisadas": revisadas[0], "malas": malas}


# ---------------------------------------------------------------- procedencia (GATE 1)
def _marcar(forma, constructor, parametros, motivo, L):
    forma.procedencia = {"procedencia": "catalogo_casa", "constructor": f"cadlib.constructores.{constructor}",
                         "parametros": parametros, "lenguaje_version": L["version"],
                         "volumen": float(forma.volume),       # ata la procedencia a ESTA forma (registrar lo compara)
                         **({"motivo": motivo.strip()} if _motivo_ok(motivo) else {})}
    try:
        forma.label = constructor
    except Exception:  # noqa: BLE001
        pass
    return forma


CONSTRUCTORES = ("cadlib.constructores.caja", "cadlib.constructores.placa",
                 "scripts/catia/constructores_casa.caja", "scripts/catia/constructores_casa.placa")
# GATE 1: que procedencia es fuente valida. catalogo_casa lo es SOLO de lo que pone el constructor (radio, chaflan,
# tornilleria del lenguaje); las cotas que se le pasan (largo, ancho, alto) las da quien llama, del CAD medido o de Fak
# (auditor 24/10). catalogo_comercial se puede DECLARAR (queda escrito) pero no es fuente de cota hasta la propuesta P5
# (toca core-prohibiciones #1); de_cero no es fuente, es un motivo.
FUENTE_VALIDA = {"medida": True, "fak": True, "catalogo_casa": True, "catalogo_comercial": False, "de_cero": False}


def procedencia(forma):
    p = getattr(forma, "procedencia", None)
    return p if isinstance(p, dict) and p.get("procedencia") else None


def heredar(nueva, *origenes, cambio):
    """La procedencia de una pieza que sale de operar piezas de la casa (restarle un hueco, unir dos cajas, agujerear):
    la de sus origenes, con el cambio escrito. Sin esto la procedencia se perdia en el primer booleano (revisor 24/10).
    Todos los origenes tienen que venir de un constructor; si no, se niega (se declara aparte)."""
    ps = [procedencia(o) for o in origenes]
    if not ps or any(p is None or p["procedencia"] != "catalogo_casa" or not p.get("constructor") for p in ps):
        raise FaltaDato("heredar(): algun origen no salio de un constructor de la casa: declaralo con declarar()")
    if not _motivo_ok(cambio):
        raise SinMotivo(f"heredar(): escribí el cambio ({MOTIVO_MIN} caracteres o mas), p. ej. «hueco de paredes 4»")
    # la pieza nueva tiene que salir de operar los origenes (restar, cortar, agujerear, unirlos): cabe en la caja de los
    # origenes y no tiene mas volumen que ellos juntos. Revisor 24/10: heredar(esfera_a_mano, caja) se aceptaba.
    try:
        bbs = [o.bounding_box() for o in origenes]
        bn = nueva.bounding_box()
        lo = [min(getattr(b.min, e) for b in bbs) - 1e-3 for e in "XYZ"]
        hi = [max(getattr(b.max, e) for b in bbs) + 1e-3 for e in "XYZ"]
        cabe = all(lo[i] <= getattr(bn.min, e) and getattr(bn.max, e) <= hi[i] for i, e in enumerate("XYZ"))
        vol_ok = nueva.volume <= sum(o.volume for o in origenes) + 1e-3
    except AttributeError as e:
        raise FaltaDato(f"heredar(): no pude medir la pieza nueva ni los origenes ({e})") from e
    if not (cabe and vol_ok):
        raise FaltaDato("heredar(): la pieza nueva no sale de operar los origenes (se sale de su caja o tiene mas "
                        "volumen): lo agregado se declara aparte con declarar()")
    previos = [c for p in ps for c in p.get("cambios", [])]
    nueva.procedencia = {"procedencia": "catalogo_casa",
                         "constructor": sorted({c for p in ps for c in ([p["constructor"]] if isinstance(
                             p["constructor"], str) else p["constructor"])}),
                         "parametros": [p.get("parametros") for p in ps], "lenguaje_version": ps[0].get("lenguaje_version"),
                         "volumen": float(nueva.volume), "cambios": previos + [cambio.strip()]}
    return nueva


def registrar(workdir, nombre, forma, archivo=None):
    """Evidencia 'procedencia' en el manifest del workdir para una pieza que salio de un constructor de la casa (o que
    heredo su procedencia con heredar()), atada a la firma del archivo exportado si se pasa (la misma firma que usan los
    gates de entrega)."""
    p = procedencia(forma)
    if not p:
        raise FaltaDato(f"{nombre}: la forma no salio de un constructor de la casa (sin procedencia); usá declarar() "
                        "o heredar()")
    vol = getattr(forma, "volume", None)
    if p.get("volumen") is None or vol is None or abs(float(vol) - p["volumen"]) > max(1e-6 * abs(float(vol)), 1e-3):
        raise FaltaDato(f"{nombre}: la procedencia no es de esta forma (volumen {vol} contra {p.get('volumen')}): "
                        "se pego a mano o la pieza cambio despues; usá heredar() o declarar()")
    return _escribir_procedencia(workdir, nombre, archivo, **p)


def declarar(workdir, nombre, procedencia, archivo=None, **datos):
    """Declara de donde sale una pieza que NO salio de un constructor (GATE 1): medida | fak | catalogo_comercial |
    de_cero. catalogo_comercial pide archivo, fabricante, codigo y fecha y queda con fuente_valida False (P5 sin
    habilitar); de_cero pide motivo. «catalogo_casa» no se autodeclara: sale de un constructor (registrar) o de
    heredar(). No decide si la fuente es buena: deja escrito cual es (la maquina mata un dato, nunca lo aprueba)."""
    if procedencia == "catalogo_casa":
        raise FaltaDato(f"{nombre}: «catalogo_casa» no se declara a mano: la deja el constructor (registrar) o "
                        "heredar() desde piezas de un constructor")
    return _escribir_procedencia(workdir, nombre, archivo, procedencia=procedencia, **datos)


def _escribir_procedencia(workdir, nombre, archivo, procedencia, **datos):
    from . import workdir as wd
    if procedencia not in TIPOS_PROCEDENCIA:
        raise FaltaDato(f"procedencia «{procedencia}»: tiene que ser una de {', '.join(TIPOS_PROCEDENCIA)}")
    reservadas = sorted(set(datos) & {"archivo", "firma", "pieza", "kind", "date", "fuente_valida", "fuente_valida_de"})
    if reservadas:
        raise FaltaDato(f"{nombre}: estos datos los escribe el sistema, no se pasan: {', '.join(reservadas)}")
    falta = []
    if procedencia == "fak" and not _motivo_ok(datos.get("cita")):
        falta = ["cita (la frase de Fak con su fecha, 10 caracteres o mas)"]
    if procedencia == "medida" and not (isinstance(datos.get("de"), str) and datos["de"].strip()):
        falta = ["de (el archivo o la pieza donde se midio)"]
    if procedencia == "catalogo_comercial":
        falta = [k for k in ("fabricante", "codigo", "fecha") if not datos.get(k)] + ([] if archivo else ["archivo"])
    if procedencia == "de_cero" and not _motivo_ok(datos.get("motivo")):
        falta = ["motivo (por que no salio del catalogo de la casa)"]
    if procedencia == "catalogo_casa":
        cs = datos.get("constructor")
        cs = [cs] if isinstance(cs, str) else (list(cs) if isinstance(cs, (list, tuple)) else [])
        if not cs or any(not isinstance(c, str) or c not in CONSTRUCTORES for c in cs):
            falta = [f"un constructor de la casa ({', '.join(CONSTRUCTORES)}); vino {cs}"]
    if falta:
        raise FaltaDato(f"{nombre}: procedencia {procedencia} sin {', '.join(falta)}")
    wd.ensure_workdir(workdir)
    extra = {}
    if archivo:
        extra = {"archivo": os.path.basename(archivo), "firma": wd.file_signature(archivo)}
    if procedencia == "catalogo_casa":
        extra["fuente_valida_de"] = ("radio, chaflan y tornilleria del lenguaje de diseno; las cotas (largo, ancho, alto)"
                                     " las da quien llama: del CAD medido o de Fak")
    return wd.record_evidence(workdir, "procedencia", pieza=nombre, procedencia=procedencia,
                              fuente_valida=FUENTE_VALIDA[procedencia], **datos, **extra)


def informe_procedencias(workdir):
    """Para medir «cero piezas redibujadas»: cada pieza de out/ (STEP o STL) con su procedencia del manifest, y las que
    no tienen ninguna. Devuelve {'piezas': [{archivo, procedencia, fuente_valida, firma_ok}], 'sin_procedencia': [...]}"""
    from . import workdir as wd
    m = wd.load_manifest(workdir)
    ev = [e for e in m.get("evidence", []) if e.get("kind") == "procedencia"]
    out = os.path.join(workdir, "out")
    archivos = sorted(f for f in (os.listdir(out) if os.path.isdir(out) else [])
                      if f.lower().endswith((".step", ".stp", ".stl")))
    piezas, sin = [], []
    for f in archivos:
        e = next((x for x in reversed(ev) if x.get("archivo") == f), None)
        if e is None:
            sin.append(f)
            continue
        ok, _ = wd.check_signature(e, "firma", os.path.join(out, f))
        piezas.append({"archivo": f, "procedencia": e["procedencia"], "fuente_valida": e.get("fuente_valida"),
                       "firma_ok": ok})
    return {"piezas": piezas, "sin_procedencia": sin}


# ---------------------------------------------------------------- constructores (build123d)
def _validar_solido(forma, que):
    sol = forma.solids()
    if len(sol) != 1 or not forma.is_valid or forma.volume <= 0:
        raise NoSePuede(f"{que}: el resultado no es UN solido valido ({len(sol)} solidos, valido={forma.is_valid})")


def _en(forma, centro):
    from build123d import Location
    cx, cy, cz = (float(a) for a in centro)
    if cx or cy or cz:
        p = getattr(forma, "procedencia", None)
        forma = forma.moved(Location((cx, cy, cz)))
        if p is not None:
            forma.procedencia = p
    return forma


def caja(largo, ancho, alto, radio=None, motivo=None, centro=(0.0, 0.0, 0.0)):
    from build123d import Align, Axis, Box, fillet
    L = lenguaje()
    r = resolver_radio(radio, motivo, L)
    chequear_caja(largo, ancho, alto, r)
    b = Box(largo, ancho, alto, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if r > 0:
        b = fillet(b.edges().filter_by(Axis.Z), r)                 # paso 1: las 4 verticales
        b = fillet(b.edges().group_by(Axis.Z)[-1], r)              # paso 2: el contorno de arriba (esquina esferica)
    _validar_solido(b, "caja")
    _marcar(b, "caja", {"largo": largo, "ancho": ancho, "alto": alto, "radio": r, "centro": list(centro)}, motivo, L)
    return _en(b, centro)


def placa(largo, ancho, espesor, chaflan_cama=None, radio=None, motivo=None, centro=(0.0, 0.0, 0.0), motivo_cama=None):
    """motivo: para un radio menor que el de la casa; motivo_cama: para sacar el chaflan de la cama. Un apartamiento,
    un motivo (auditor 24/10: con uno solo, «radio chico por falta de lugar» dejaba tambien la cama sin chaflan)."""
    from build123d import Align, Axis, Box, chamfer, fillet
    L = lenguaje()
    r = resolver_radio(radio, motivo, L)
    c = resolver_chaflan(chaflan_cama, motivo_cama, L)
    chequear_placa(largo, ancho, espesor, r, c)
    b = Box(largo, ancho, espesor, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if r > 0:
        b = fillet(b.edges().filter_by(Axis.Z), r)
        b = fillet(b.edges().group_by(Axis.Z)[-1], r)
    if c > 0:
        b = chamfer(b.edges().group_by(Axis.Z)[0], c)              # contorno de la cama: 45 grados (largo = largo)
    _validar_solido(b, "placa")
    _marcar(b, "placa", {"largo": largo, "ancho": ancho, "espesor": espesor, "chaflan_cama": c, "radio": r,
                         "centro": list(centro)}, motivo, L)
    if _motivo_ok(motivo_cama):
        b.procedencia["motivo_cama"] = motivo_cama.strip()
    return _en(b, centro)


def colocar(forma, M, tol=TOL_ROTACION):
    """Copia de la forma ubicada con M (4x4). Se niega ANTES de mover si M es un espejo o no es una rotacion."""
    e = validar_matriz(M, tol)
    pose = {"det": e["det"], "matriz": [[float(a) for a in fila] for fila in M[:3]]}
    colocaciones = list(getattr(forma, "colocaciones", None) or []) + [pose]
    p = procedencia(forma)
    if hasattr(forma, "apply_transform"):                          # trimesh
        import numpy as np
        out = forma.copy()
        out.apply_transform(np.array([list(map(float, f)) for f in M[:3]] + [[0.0, 0.0, 0.0, 1.0]]))
    else:                                                          # build123d
        from build123d import Location
        from OCP.gp import gp_Trsf
        t = gp_Trsf()
        t.SetValues(*[float(M[i][j]) for i in range(3) for j in range(4)])
        out = forma.moved(Location(t))
    try:
        out.colocaciones = colocaciones                            # todas las poses aplicadas, en orden
        if p is not None:
            out.procedencia = dict(p)
    except Exception:  # noqa: BLE001
        pass
    return out


# ---------------------------------------------------------------- catalogo de la casa
def catalogo(ruta=CATALOGO):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def buscar(texto, ruta=CATALOGO):
    """Fichas del catalogo de la casa que nombran alguna palabra del texto (id, que_es o palabras)."""
    import unicodedata

    def plano(s):
        return "".join(ch for ch in unicodedata.normalize("NFD", str(s).lower()) if unicodedata.category(ch) != "Mn")
    pal = [p for p in plano(texto).split() if len(p) > 2]
    out = []
    for f in catalogo(ruta)["fichas"]:
        hay = plano(" ".join([f.get("id", ""), f.get("que_es", ""), " ".join(f.get("palabras", []))]))
        if any(p in hay for p in pal):
            out.append(f)
    return out


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="Constructores y catalogo de la casa (cad-design)")
    ap.add_argument("--buscar", help="busca en el catalogo de la casa (primer paso antes de dibujar)")
    ap.add_argument("--lenguaje", action="store_true", help="imprime el lenguaje de diseno con los valores resueltos")
    ap.add_argument("--poses", help="json de poses (estados.json): lista las matrices que no son rotaciones propias")
    ap.add_argument("--procedencias", metavar="WORKDIR",
                    help="cada pieza de <workdir>/out con su procedencia del manifest, y las que no tienen (GATE 1)")
    a = ap.parse_args(argv)
    if a.procedencias:
        try:
            r = informe_procedencias(a.procedencias)
        except FileNotFoundError as e:
            print(f"NO MEDIDO: {e}")
            return 2
        for p in r["piezas"]:
            print(f"  {p['archivo']}: {p['procedencia']} (fuente valida: {p['fuente_valida']}, "
                  f"firma {'ok' if p['firma_ok'] else 'CAMBIO despues de registrar'})")
        for f in r["sin_procedencia"]:
            print(f"  {f}: SIN PROCEDENCIA")
        print(f"{len(r['piezas'])} con procedencia, {len(r['sin_procedencia'])} sin")
        return 0
    if a.lenguaje:
        print(json.dumps(lenguaje(), ensure_ascii=False, indent=1))
    if a.buscar:
        r = buscar(a.buscar)
        for f in r:
            print(f"- {f['id']} ({f['tipo']}): {f['que_es']}")
            print(f"    estado: {f.get('estado', '')}")
            for k, v in (f.get("donde") or {}).items():
                print(f"    {k}: {v}")
        if not r:
            print("nada en el catalogo de la casa para «%s»: seguir con el orden de busqueda (SKILL.md GATE 1)" % a.buscar)
    if a.poses:
        with open(a.poses, encoding="utf-8") as f:
            rv = revisar_poses(json.load(f))
        malas = rv["malas"]
        for camino, e in malas[:20]:
            print(f"  ROJO {camino}: det {e['det']}  {e['motivo'][:90]}")
        if rv["revisadas"] == 0:
            print("NO MEDIDO: no encontre ninguna matriz (4x4 o 3x4 por filas, o 16 numeros) en el archivo")
            return 2
        print(f"{len(malas)} de {rv['revisadas']} matrices no son rotaciones propias")
        return 3 if malas else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
