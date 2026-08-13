# -*- coding: utf-8 -*-
"""pipeline — cadenas de scripts que NO pueden fallar en silencio.

POR QUE EXISTE (tres fallas reales de UNA sola sesion de diseno, cadena
`calibrar -> aplicar -> build -> verificar` corriendo en segundo plano):

1. `calibrar` no encontro geometria valida y salio con codigo 1. Como falla ANTES
   de escribir su JSON, el archivo de la corrida ANTERIOR quedo en disco. El paso
   siguiente lo leyo tan tranquilo y la cadena entera corrio con el diseno viejo.
   El contrato de aceptacion dio "1 solo rojo" — sobre la pieza equivocada.
   -> Aca: al abortar, la salida se RENOMBRA a `<nombre>.ABORTADO`. Nunca queda
      una version vieja intacta haciendose pasar por la de esta corrida.

2. Un `assert len(familia)==3` corto el script a mitad de camino. No habia `&&`
   en la cadena: el build siguio con los parametros viejos y nada lo dijo.
   -> Aca: el paso declara sus SALIDAS. Si el bloque termina con excepcion (o con
      SystemExit != 0, o con un assert), las salidas se invalidan y el codigo de
      salida es != 0. Y el paso siguiente se niega a leer una entrada ABORTADA.

3. El mensaje de error mentia sobre la causa: el filtro que rechazaba las 87
   geometrias era un tope de precarga de 0,90 mm, pero el mensaje decia "no se
   cubre 70..200 kPa sin huecos" (el ULTIMO filtro, no el culpable). Media hora
   buscando en el lugar equivocado.
   -> Aca: `Criba`. Un candidato solo se puede rechazar nombrando el filtro y el
      valor que lo hizo fallar, y el veredicto se CONSTRUYE con esos registros:
      no se puede escribir a mano un motivo que no sea el real. Si alguien
      devuelve None sin pasar por la criba, `veredicto()` lo detecta (los numeros
      no cierran) y revienta.

ESTADOS DE UNA SALIDA `X`
    X                 escrita y sellada por una corrida que TERMINO
    X.EN_CURSO        habia una version vieja y la corrida arranco (si esto queda,
                      el proceso murio sin terminar: kill, corte de luz, cierre de
                      consola). NO hay resultado.
    X.ABORTADO        la corrida fallo; ahi adentro esta el contenido viejo y el
                      motivo, para forensia. X no existe -> nadie lo puede leer.

SELLO. Cada salida escrita con `escribir_json` lleva un bloque `_pipeline` con la
FIRMA (tamano + mtime + sha1) de cada entrada. Un mtime solo miente: alcanza con
copiar un archivo para dar vuelta el orden. La leccion "un cache sin la firma del
archivo miente" (regla cad-3d, GATE 3) vale igual para una cadena de scripts.

USO
    from cadlib.pipeline import Paso, Criba, salida_fresca

    with Paso("aplicar_calibracion",
              entradas=["calibracion.json", "params_ANTES.json"],
              salidas=["params.json"]) as p:
        C = p.leer_json("calibracion.json")
        ...
        p.escribir_json("params.json", P)

AUTOTEST
    python cadlib/pipeline.py        # par BIEN/MAL de cada guardia; exit 3 si falla

CODIGOS DE SALIDA
    0 ok · 1 falla propia del script · 3 autotest del guardian fallo
    4 gate de cadena (entrada podrida / salida no escrita)
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field

SELLO = "_pipeline"
SUF_ABORTADO = ".ABORTADO"
SUF_EN_CURSO = ".EN_CURSO"

# --- codigos de frescura -----------------------------------------------------------------
FRESCA = "FRESCA"
NO_EXISTE = "NO_EXISTE"
ABORTADO = "ABORTADO"
CORRIDA_MURIO = "CORRIDA_MURIO"
ENTRADA_FALTA = "ENTRADA_FALTA"
VIEJA = "VIEJA"
FIRMA_DISTINTA = "FIRMA_DISTINTA"
SIN_SELLO = "SIN_SELLO"

EXIT_AUTOTEST = 3
EXIT_CADENA = 4

_TOPE_HASH = 64 * 1024 * 1024          # arriba de esto se hashean los extremos, no todo


# =========================================================================================
# firma y sello
# =========================================================================================
def firma(ruta):
    """Firma de un archivo: tamano + mtime_ns + sha1. El sha1 es lo que no se puede fingir."""
    ruta = os.fspath(ruta)
    st = os.stat(ruta)
    h = hashlib.sha1()
    with open(ruta, "rb") as f:
        if st.st_size <= _TOPE_HASH:
            for bloque in iter(lambda: f.read(1 << 20), b""):
                h.update(bloque)
        else:                                   # archivo pesado: extremos + tamano
            h.update(f.read(1 << 20))
            f.seek(-(1 << 20), os.SEEK_END)
            h.update(f.read())
            h.update(str(st.st_size).encode())
    return {"size": st.st_size, "mtime_ns": st.st_mtime_ns, "sha1": h.hexdigest()}


def _clave(ruta, base):
    """Ruta relativa al directorio de la salida si se puede; si no, absoluta."""
    ruta, base = os.path.abspath(ruta), os.path.abspath(base)
    try:
        rel = os.path.relpath(ruta, base)
    except ValueError:                          # otra unidad en Windows
        return ruta.replace("\\", "/")
    return ruta.replace("\\", "/") if rel.startswith("..") else rel.replace("\\", "/")


def _resolver(clave, base):
    return clave if os.path.isabs(clave) else os.path.join(base, clave)


def leer_sello(archivo):
    """Bloque `_pipeline` de una salida JSON. None si no es JSON o no lo trae."""
    try:
        with open(archivo, "r", encoding="utf-8") as f:
            doc = json.load(f)
    except Exception:
        return None
    return doc.get(SELLO) if isinstance(doc, dict) else None


def _hora(ns):
    return time.strftime("%d/%m %H:%M:%S", time.localtime(ns / 1e9)) + ",%03d" % (ns % 10 ** 9 // 10 ** 6)


def _delta(ns):
    s = abs(ns) / 1e9
    if s < 90:
        return "%.1f s" % s
    if s < 5400:
        return "%.1f min" % (s / 60)
    return "%.1f h" % (s / 3600)


# =========================================================================================
# frescura
# =========================================================================================
@dataclass
class Frescura:
    """Resultado de un chequeo de frescura. Booleano Y razon concreta.

    Se puede usar en un `if` (define __bool__), pero imprimirlo dice POR QUE.
    """
    ok: bool
    codigo: str
    razon: str
    detalle: dict = field(default_factory=dict)

    def __bool__(self):
        return self.ok

    def __str__(self):
        return ("[OK] " if self.ok else "[NO] ") + self.codigo + ": " + self.razon

    def abortar_si_no(self, codigo=EXIT_CADENA):
        if not self.ok:
            print("[GATE CADENA] " + self.razon, file=sys.stderr)
            raise SystemExit(codigo)
        return self


def _motivo_abortado(marca):
    """Motivo guardado dentro de un `<X>.ABORTADO` (el archivo viejo, anotado)."""
    try:
        with open(marca, "r", encoding="utf-8") as f:
            doc = json.load(f)
        if isinstance(doc, dict) and "_abortado" in doc:
            a = doc["_abortado"]
            return "%s (%s, paso '%s')" % (a.get("motivo", "?"), a.get("fecha", "?"),
                                           a.get("paso", "?"))
    except Exception:
        pass
    return "(sin motivo legible en %s)" % os.path.basename(marca)


def salida_fresca(archivo, entradas=None, exigir_sello=False):
    """La salida `archivo` es MAS NUEVA que todas sus `entradas` y de una corrida que TERMINO?

    entradas=None -> se usan las que el propio archivo declara en su sello.
    Devuelve `Frescura` (ok + codigo + razon concreta), nunca un booleano pelado.
    """
    archivo = os.fspath(archivo)
    nom = os.path.basename(archivo)
    base = os.path.dirname(os.path.abspath(archivo))
    hay = os.path.isfile(archivo)
    mt = os.stat(archivo).st_mtime_ns if hay else -1

    en_curso, abort = archivo + SUF_EN_CURSO, archivo + SUF_ABORTADO
    if os.path.exists(en_curso) and os.stat(en_curso).st_mtime_ns >= mt:
        return Frescura(False, CORRIDA_MURIO,
                        "quedo '%s%s': una corrida arranco a escribir '%s' y NUNCA termino "
                        "(el proceso murio: kill, cierre de consola, corte). No hay resultado "
                        "que usar." % (nom, SUF_EN_CURSO, nom),
                        {"marca": en_curso})
    if os.path.exists(abort) and os.stat(abort).st_mtime_ns >= mt:
        return Frescura(False, ABORTADO,
                        "la ultima corrida que escribia '%s' ABORTO: %s. El contenido viejo "
                        "quedo en '%s%s' y NO se puede usar como si fuera de ahora."
                        % (nom, _motivo_abortado(abort), nom, SUF_ABORTADO),
                        {"marca": abort})
    if not hay:
        return Frescura(False, NO_EXISTE, "'%s' no existe" % archivo)

    sello = leer_sello(archivo)
    declaradas = (sello or {}).get("entradas", {})
    if entradas is None:
        if sello is None:
            return Frescura(not exigir_sello, SIN_SELLO,
                            "'%s' no declara sus entradas (no tiene bloque %s): es una entrada "
                            "de hoja, o la escribio un script que no usa pipeline. No se puede "
                            "juzgar su frescura." % (nom, SELLO))
        entradas = [_resolver(k, base) for k in declaradas]

    for e in entradas:
        e = os.fspath(e)
        if not os.path.isfile(e):
            return Frescura(False, ENTRADA_FALTA,
                            "la entrada '%s' de '%s' no existe" % (e, nom), {"entrada": e})
        emt = os.stat(e).st_mtime_ns
        if emt > mt:
            return Frescura(False, VIEJA,
                            "'%s' es MAS VIEJA que su entrada '%s' por %s (salida %s, entrada "
                            "%s): se genero con otra version de esa entrada."
                            % (nom, os.path.basename(e), _delta(emt - mt), _hora(mt), _hora(emt)),
                            {"entrada": e, "salida_mtime_ns": mt, "entrada_mtime_ns": emt})

    for clave, fr_vieja in declaradas.items():           # la firma: el mtime solo, miente
        p = _resolver(clave, base)
        if not os.path.isfile(p):
            return Frescura(False, ENTRADA_FALTA,
                            "'%s' se genero con la entrada '%s', que ya no esta" % (nom, clave))
        fr_hoy = firma(p)
        if fr_hoy["sha1"] != fr_vieja.get("sha1"):
            gemelo = "FRESCA" if fr_hoy["mtime_ns"] <= mt else "VIEJA"
            return Frescura(False, FIRMA_DISTINTA,
                            "'%s' se genero con una version DISTINTA de '%s' (sha1 %s en el "
                            "sello, %s hoy; %d -> %d bytes). Por mtime este control habria dicho "
                            "%s: por eso la firma no es opcional."
                            % (nom, clave, str(fr_vieja.get("sha1"))[:8], fr_hoy["sha1"][:8],
                               fr_vieja.get("size", -1), fr_hoy["size"], gemelo),
                            {"entrada": p})

    if sello is not None and not sello.get("completo"):
        return Frescura(False, SIN_SELLO,
                        "'%s' tiene sello pero sin `completo`: se escribio a medias" % nom)
    if sello is None and exigir_sello:
        return Frescura(False, SIN_SELLO, "'%s' no tiene sello y se exigio sello" % nom)
    return Frescura(True, FRESCA,
                    "'%s' (%s) es mas nueva que sus %d entrada(s) y la corrida termino"
                    % (nom, _hora(mt), len(entradas)))


# =========================================================================================
# invalidacion
# =========================================================================================
def invalidar(archivo, motivo, paso="", conservar=True):
    """Saca de circulacion una salida: `X` -> `X.ABORTADO` (con el motivo adentro).

    Esta es la raiz del caso 1: si el script muere ANTES de escribir, lo que queda
    en disco es la corrida ANTERIOR. Renombrarla es lo unico que impide que el paso
    siguiente la lea como si fuera de ahora.
    """
    archivo = os.fspath(archivo)
    marca = archivo + SUF_ABORTADO
    nota = {"motivo": str(motivo), "fecha": time.strftime("%Y-%m-%d %H:%M:%S"),
            "paso": paso or "(sin nombre)", "salida": os.path.basename(archivo)}
    doc = None
    if os.path.isfile(archivo) and conservar:
        try:
            with open(archivo, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except Exception:
            doc = None
        if isinstance(doc, dict):
            doc["_abortado"] = nota
            _volcar_json(marca, doc)
            os.remove(archivo)
        else:                                    # no es JSON (.step, .npy): se mueve tal cual
            os.replace(archivo, marca)
            _volcar_json(marca + ".motivo.json", nota)
    else:
        if os.path.isfile(archivo):
            os.remove(archivo)
        _volcar_json(marca, {"_abortado": nota,
                             "_nota": "la corrida aborto y no habia salida previa"})
    return marca


def _volcar_json(destino, obj):
    """Escritura atomica: tmp + replace. Un kill a mitad no deja un JSON truncado."""
    destino = os.fspath(destino)
    d = os.path.dirname(os.path.abspath(destino))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
        os.replace(tmp, destino)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


# =========================================================================================
# Paso
# =========================================================================================
class Paso:
    """Context manager: declara ENTRADAS y SALIDAS de un eslabon de la cadena.

    Al entrar   verifica que ninguna entrada este ABORTADA / a medias / mas nueva
                que su propia salida, y aparta las salidas viejas (`.EN_CURSO`).
    Al salir OK verifica que las salidas declaradas se hayan escrito de verdad.
    Al salir MAL (excepcion, assert, SystemExit != 0) INVALIDA las salidas.
    """

    def __init__(self, nombre, entradas=(), salidas=(), base=None,
                 exigir_frescura=True, reservar=True, verbose=True):
        self.nombre = nombre
        self.base = os.path.abspath(base or os.getcwd())
        self.entradas = [self._p(e) for e in entradas]
        self.salidas = [self._p(s) for s in salidas]
        self.exigir_frescura = exigir_frescura
        self.reservar = reservar
        self.verbose = verbose
        self.t0_ns = None
        self._reservadas = []

    def _p(self, x):
        x = os.fspath(x)
        return x if os.path.isabs(x) else os.path.join(self.base, x)

    # ---- entrada ------------------------------------------------------------------------
    def __enter__(self):
        self.t0_ns = time.time_ns()
        if self.verbose:
            print("[PASO %s] %d entrada(s), %d salida(s)"
                  % (self.nombre, len(self.entradas), len(self.salidas)))
        for e in self.entradas:
            # OJO con el orden: si el archivo no esta, la razon PUEDE ser que la corrida
            # que lo generaba aborto. "falta la entrada" seria verdad y no serviria de
            # nada; el que lee tiene que enterarse de que aborto y por que.
            fr = salida_fresca(e)
            if fr.codigo == NO_EXISTE:
                raise SystemExit("[GATE CADENA] paso '%s': falta la entrada '%s' y no hay "
                                 "rastro de quien la genera" % (self.nombre, e))
            if not fr.ok and fr.codigo != SIN_SELLO:
                raise SystemExit(
                    "[GATE CADENA] paso '%s' NO arranca: %s\n"
                    "  Una entrada que no se sabe de cuando es, no es una entrada."
                    % (self.nombre, fr.razon))
            if self.verbose:
                print("   entrada  %-34s %s" % (os.path.basename(e), fr.codigo))
        if self.reservar:
            for s in self.salidas:
                if os.path.isfile(s):
                    os.replace(s, s + SUF_EN_CURSO)
                    self._reservadas.append(s)
        return self

    # ---- utilidades del paso ------------------------------------------------------------
    def leer_json(self, archivo):
        p = self._p(archivo)
        if p not in self.entradas:
            raise SystemExit("[GATE CADENA] paso '%s' lee '%s' pero NO la declaro como entrada: "
                             "una dependencia sin declarar es la que despues queda vieja."
                             % (self.nombre, os.path.basename(p)))
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    def escribir_json(self, archivo, obj, **extra):
        """Escribe una salida declarada, atomica y con el sello (firma de las entradas)."""
        p = self._p(archivo)
        if p not in self.salidas:
            raise SystemExit("[GATE CADENA] paso '%s' escribe '%s' sin declararla como salida"
                             % (self.nombre, os.path.basename(p)))
        if not isinstance(obj, dict):
            raise TypeError("escribir_json necesita un dict (para poder sellarlo)")
        d = dict(obj)
        d[SELLO] = self.sello(p, **extra)
        _volcar_json(p, d)
        return p

    def sello(self, salida, **extra):
        base = os.path.dirname(os.path.abspath(salida))
        s = {"paso": self.nombre, "script": os.path.basename(sys.argv[0] or "?"),
             "fecha": time.strftime("%Y-%m-%d %H:%M:%S"), "completo": True,
             "entradas": {_clave(e, base): firma(e) for e in self.entradas}}
        s.update(extra)
        return s

    def sellar(self, archivo):
        """Sello para una salida que NO es JSON (.step, .npy): sidecar `<X>.sello.json`."""
        p = self._p(archivo)
        _volcar_json(p + ".sello.json", {SELLO: self.sello(p), "salida": os.path.basename(p)})
        return p

    def fallar(self, motivo, codigo=1):
        """Corta el paso a proposito: la salida queda ABORTADA y el exit code es `codigo`."""
        print(str(motivo), file=sys.stderr)
        raise SystemExit(codigo)

    # ---- salida -------------------------------------------------------------------------
    def __exit__(self, et, ev, tb):
        malo = None
        if et is not None:
            if et is SystemExit:
                cod = ev.code if isinstance(ev.code, int) else (0 if ev.code is None else 1)
                if isinstance(ev.code, str):
                    malo = "SystemExit: " + ev.code
                elif cod != 0:
                    malo = "SystemExit(%s)" % cod
            else:
                malo = "%s: %s" % (et.__name__, ev)
        if malo is None:                          # exito -> las salidas tienen que estar
            faltan = [s for s in self.salidas if not os.path.isfile(s)]
            if faltan:
                malo = ("el paso termino OK pero NO escribio %s"
                        % ", ".join(os.path.basename(f) for f in faltan))

        if malo is not None:
            for s in self.salidas:
                # el .ABORTADO tiene que llevarse el CONTENIDO que habia: el nuevo si el
                # paso alcanzo a escribirlo, y si no el viejo que se habia apartado. Un
                # marcador sin contenido no sirve para entender que se estuvo usando.
                prev = s + SUF_EN_CURSO
                if not os.path.isfile(s) and os.path.isfile(prev):
                    os.replace(prev, s)
                m = invalidar(s, malo, paso=self.nombre)
                if os.path.isfile(prev):          # habia vieja Y nueva: se guardan las dos
                    os.replace(prev, s + SUF_ABORTADO + ".previo")
                print("[ABORTADO] %s -> %s" % (os.path.basename(s), os.path.basename(m)),
                      file=sys.stderr)
            corto = malo.strip().splitlines()[0]          # el motivo entero va en el .ABORTADO
            print("[ABORTADO] paso '%s': %s%s"
                  % (self.nombre, corto, " [...]" if corto != malo.strip() else ""),
                  file=sys.stderr)
            if et is None:                        # falla detectada por el propio guardian
                raise SystemExit(EXIT_CADENA)
            return False                          # se propaga la excepcion original

        for s in self.salidas:                    # exito: se limpian marcas viejas
            for suf in (SUF_EN_CURSO, SUF_ABORTADO, SUF_ABORTADO + ".previo",
                        SUF_ABORTADO + ".motivo.json"):
                if os.path.isfile(s + suf):
                    os.remove(s + suf)
        if self.verbose:
            for s in self.salidas:
                print("   salida   %-34s OK (%.1f s)"
                      % (os.path.basename(s), (time.time_ns() - self.t0_ns) / 1e9))
        return False


def paso_de_cadena(nombre, entradas=(), salidas=(), **kw):
    """Decorador: la funcion recibe el `Paso` como primer argumento."""
    def deco(fn):
        def envuelta(*a, **k):
            with Paso(nombre, entradas, salidas, **kw) as p:
                return fn(p, *a, **k)
        envuelta.__name__ = fn.__name__
        envuelta.__doc__ = fn.__doc__
        return envuelta
    return deco


# =========================================================================================
# Criba — no se puede rechazar sin decir cual filtro y con que numero
# =========================================================================================
class CribaIncoherente(RuntimeError):
    """Los numeros no cierran: hay rechazos que no pasaron por la criba."""


def _n(x):
    if x is None:
        return "?"
    ax = abs(x)
    if x != 0 and (ax < 1e-3 or ax >= 1e5):
        return "%.3g" % x
    return "%.3f" % x


class Criba:
    """Registro de rechazos. La UNICA forma de rechazar un candidato.

    El caso 3: `variante()` hacia `return None` en cinco filtros distintos y el
    unico mensaje se armaba al final, culpando al ULTIMO filtro. Con Criba, el
    veredicto se CONSTRUYE con los rechazos registrados: no hay forma de escribir
    un motivo que no sea el real, y el filtro dominante sale primero.

        c = Criba("variante")
        for cand in grilla:
            c.candidato()
            if d > 1.20:
                c.rechazar(filtro="precarga_max", valor=d, limite=1.20, op="<=", unidad="mm")
                continue
            c.aceptar()
        print(c.veredicto())
    """

    def __init__(self, nombre):
        self.nombre = nombre
        self.evaluados = 0
        self.aceptados = 0
        self.rechazos = {}                        # filtro -> dict

    # -- registro -------------------------------------------------------------------------
    def candidato(self, n=1):
        self.evaluados += n
        return self

    def aceptar(self, x=None):
        self.aceptados += 1
        return x

    def rechazar(self, *, filtro, valor, limite=None, op="", unidad="", detalle=""):
        """Registra un rechazo. Devuelve None, para caer en el `return None` de siempre.

        `filtro` y `valor` son OBLIGATORIOS y por nombre: un rechazo anonimo no
        compila. `valor` tiene que ser un numero — es el dato que se perdio en el
        caso 3 ("87 rechazos" sin decir de que valor contra que tope).
        """
        if not isinstance(filtro, str) or not filtro.strip():
            raise TypeError("rechazar() exige `filtro` no vacio: un rechazo sin nombre es "
                            "exactamente el bug que esta clase existe para impedir")
        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            raise TypeError("rechazar(filtro=%r) exige `valor` numerico (el numero que hizo "
                            "fallar el filtro), no %r" % (filtro, type(valor).__name__))
        r = self.rechazos.setdefault(filtro, {"n": 0, "min": None, "max": None, "op": op,
                                              "limite": limite, "unidad": unidad,
                                              "cerca": None, "falta": None, "detalle": detalle})
        r["n"] += 1
        r["min"] = valor if r["min"] is None else min(r["min"], valor)
        r["max"] = valor if r["max"] is None else max(r["max"], valor)
        if limite is not None:
            falta = abs(float(valor) - float(limite))
            if r["falta"] is None or falta < r["falta"]:
                r["falta"], r["cerca"] = falta, valor
        return None

    # -- lectura --------------------------------------------------------------------------
    @property
    def rechazados(self):
        return sum(r["n"] for r in self.rechazos.values())

    def dominante(self):
        """(filtro, registro) del que mas rechazo. None si no hubo rechazos."""
        if not self.rechazos:
            return None
        f = max(self.rechazos, key=lambda k: self.rechazos[k]["n"])
        return f, self.rechazos[f]

    def _linea(self, filtro, r):
        lim = ("  contra  %s %s" % (r["op"] or "limite", _n(r["limite"]))
               if r["limite"] is not None else "")
        rango = _n(r["min"]) if r["min"] == r["max"] else "%s..%s" % (_n(r["min"]), _n(r["max"]))
        cerca = ("   (el que menos lejos quedo: %s, falta %s)" % (_n(r["cerca"]), _n(r["falta"]))
                 if r["cerca"] is not None else "")
        return "   %5d x  %-22s valor %s %s%s%s" % (r["n"], filtro, rango, r["unidad"], lim, cerca)

    def veredicto(self, estricto=True):
        """Informe. Revienta si los numeros no cierran (rechazos anonimos)."""
        huerfanos = self.evaluados - self.aceptados - self.rechazados
        if estricto and self.evaluados and huerfanos != 0:
            raise CribaIncoherente(
                "criba '%s': %d evaluados, %d aceptados, %d rechazados registrados -> %d "
                "candidato(s) se cayeron SIN pasar por la criba (algun `return None` suelto). "
                "Un rechazo que no se registra es el que despues no aparece en el mensaje."
                % (self.nombre, self.evaluados, self.aceptados, self.rechazados, huerfanos))
        out = ["CRIBA '%s': %d evaluados, %d pasaron, %d rechazados."
               % (self.nombre, self.evaluados, self.aceptados, self.rechazados)]
        for f, r in sorted(self.rechazos.items(), key=lambda kv: -kv[1]["n"]):
            out.append(self._linea(f, r))
        if self.aceptados == 0 and self.rechazos:
            f, r = self.dominante()
            out.append("   NINGUN candidato paso. El responsable es '%s': %d de %d rechazos%s."
                       % (f, r["n"], self.rechazados,
                          ("; el mejor quedo en %s contra %s %s" % (_n(r["cerca"]), r["op"] or "limite",
                                                                    _n(r["limite"])))
                          if r["cerca"] is not None else ""))
        elif self.aceptados == 0:
            out.append("   NINGUN candidato paso y NO hay rechazos registrados: la criba nunca "
                       "se uso, asi que el motivo real se desconoce.")
        return "\n".join(out)

    def abortar_si_vacio(self, codigo=1):
        if self.aceptados == 0:
            raise SystemExit(self.veredicto())
        return self


# =========================================================================================
# AUTOTEST — corre siempre. Un guardian sin par BIEN/MAL declara deteccion CERO.
# =========================================================================================
_HIJO = r'''# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, r"{scripts}")
from cadlib.pipeline import Paso
with Paso("hijo_que_revienta", entradas=[r"{ent}"], salidas=[r"{sal}"], verbose=False) as p:
    familia = [1]
    assert len(familia) == 3, "la familia trae %d y se esperaban 3" % len(familia)
    p.escribir_json(r"{sal}", {{"nunca": "llega"}})
'''


def autotest(verbose=True):
    """Par BIEN/MAL de cada guardia. Devuelve la lista de problemas (vacia = OK)."""
    prob = []
    scripts = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = tempfile.mkdtemp(prefix="autotest_pipeline_")
    p = lambda *x: os.path.join(d, *x)
    ent, sal = p("entrada.json"), p("salida.json")
    di = print if verbose else (lambda *a, **k: None)
    try:
        # ---- 1. BIEN: salida legitima ---------------------------------------------------
        _volcar_json(ent, {"cota": 12.96})
        with Paso("calibrar", entradas=[ent], salidas=[sal], base=d, verbose=False) as ps:
            ps.escribir_json(sal, {"elegida": {"brazo": 25.0}})
        f_ok = salida_fresca(sal)
        di("    1 BIEN  salida recien escrita         -> %-14s %s"
           % (f_ok.codigo, "usable" if f_ok else "NO usable"))
        if not f_ok.ok:
            prob.append("1: una salida legitima da '%s' (%s): FALSO POSITIVO, la cadena no "
                        "arrancaria nunca" % (f_ok.codigo, f_ok.razon))
        contenido_bueno = json.load(open(sal, encoding="utf-8"))["elegida"]["brazo"]

        # ---- 2. MAL: corrida abortada (CASO 1 del incidente) ----------------------------
        try:
            with Paso("calibrar", entradas=[ent], salidas=[sal], base=d, verbose=False):
                raise SystemExit(1)               # "NINGUNA geometria cumple" -> sys.exit(1)
        except SystemExit:
            pass
        f_ab = salida_fresca(sal)
        di("    2 MAL   corrida abortada (exit 1)     -> %-14s %s"
           % (f_ab.codigo, "usable" if f_ab else "NO usable"))
        if f_ab.ok:
            prob.append("2: despues de una corrida ABORTADA la salida vieja sigue dando OK: "
                        "FALSO NEGATIVO — es exactamente el caso 1 (la cadena entera corriendo "
                        "sobre el diseno anterior)")
        if f_ab.codigo != ABORTADO:
            prob.append("2: el codigo fue '%s' y no ABORTADO: el motivo no llega al que lee"
                        % f_ab.codigo)
        if os.path.isfile(sal):
            prob.append("2: '%s' sigue en disco despues de abortar: cualquier script que no use "
                        "pipeline la lee igual" % os.path.basename(sal))
        marca = sal + SUF_ABORTADO
        if not os.path.isfile(marca):
            prob.append("2: no quedo el archivo %s (se perdio la forensia)" % SUF_ABORTADO)
        else:
            viejo = json.load(open(marca, encoding="utf-8"))
            if viejo.get("elegida", {}).get("brazo") != contenido_bueno:
                prob.append("2: el .ABORTADO no conservo el contenido viejo")
            if "_abortado" not in viejo:
                prob.append("2: el .ABORTADO no dice POR QUE aborto")

        # ---- 3. MAL: entrada tocada despues de la salida ---------------------------------
        with Paso("calibrar", entradas=[ent], salidas=[sal], base=d, verbose=False) as ps:
            ps.escribir_json(sal, {"elegida": {"brazo": 25.0}})
        t = os.stat(sal).st_mtime_ns + 10 * 10 ** 9
        os.utime(ent, ns=(t, t))
        f_vj = salida_fresca(sal)
        di("    3 MAL   entrada 10 s mas nueva        -> %-14s %s"
           % (f_vj.codigo, "usable" if f_vj else "NO usable"))
        if f_vj.ok or f_vj.codigo != VIEJA:
            prob.append("3: una salida generada ANTES de su entrada da '%s': FALSO NEGATIVO"
                        % f_vj.codigo)
        if "entrada.json" not in f_vj.razon:
            prob.append("3: el mensaje no NOMBRA la entrada culpable ('%s'): es un control "
                        "ciego, obliga a buscar a mano" % f_vj.razon)

        # ---- 4. MAL: mismo mtime, contenido distinto (el cache que miente) --------------
        mt_ent = time.time_ns() - 60 * 10 ** 9    # entrada vieja: por fecha, todo en orden
        os.utime(ent, ns=(mt_ent, mt_ent))
        with Paso("calibrar", entradas=[ent], salidas=[sal], base=d, verbose=False) as ps:
            ps.escribir_json(sal, {"elegida": {"brazo": 25.0}})
        _volcar_json(ent, {"cota": 12.30})        # cota vieja: OTRA pieza
        os.utime(ent, ns=(mt_ent, mt_ent))        # y le devuelvo el mtime: el orden "cierra"
        f_fi = salida_fresca(sal)
        gemelo = os.stat(ent).st_mtime_ns <= os.stat(sal).st_mtime_ns
        di("    4 MAL   entrada cambiada, mtime intacto -> %-12s %s   (gemelo: por mtime daria "
           "%s)" % (f_fi.codigo, "usable" if f_fi else "NO usable",
                    "FRESCA" if gemelo else "VIEJA"))
        if not gemelo:
            prob.append("4: el caso no quedo armado (el mtime no se restauro), no prueba nada")
        if f_fi.ok or f_fi.codigo != FIRMA_DISTINTA:
            prob.append("4: contenido de entrada cambiado con el mismo mtime da '%s': el sello "
                        "sin firma miente igual que un cache sin firma" % f_fi.codigo)

        # ---- 5. MAL: assert en un proceso hijo (CASO 2 del incidente) -------------------
        _volcar_json(ent, {"cota": 12.96})
        sal2 = p("params.json")
        with Paso("aplicar", entradas=[ent], salidas=[sal2], base=d, verbose=False) as ps:
            ps.escribir_json(sal2, {"durezas": {"media": 1.6}, "version": "vieja"})
        hijo = p("hijo.py")
        with open(hijo, "w", encoding="utf-8") as f:
            f.write(_HIJO.format(scripts=scripts, ent=ent, sal=sal2))
        r = subprocess.run([sys.executable, hijo], capture_output=True, text=True)
        f_as = salida_fresca(sal2)
        di("    5 MAL   assert en subproceso           -> exit %d   %-14s %s"
           % (r.returncode, f_as.codigo, "usable" if f_as else "NO usable"))
        if r.returncode == 0:
            prob.append("5: un assert que corta el script devolvio exit 0: la cadena seguiria "
                        "de largo (caso 2)")
        if f_as.ok:
            prob.append("5: tras el assert los params VIEJOS siguen usables: el build correria "
                        "con el diseno anterior (caso 2)")
        if "AssertionError" not in (r.stderr or ""):
            prob.append("5: el hijo no reporto AssertionError en stderr (%r)" % (r.stderr or "")[:80])

        # ---- 6. Criba: BIEN/MAL del mensaje de rechazo (CASO 3) -------------------------
        c = Criba("variante")
        for i in range(87):                       # las 87 geometrias del incidente
            c.candidato()
            c.rechazar(filtro="precarga_max", valor=0.920 + i * 0.0026, limite=0.90,
                       op="<=", unidad="mm")
        for i in range(5):
            c.candidato()
            c.rechazar(filtro="cobertura_presion", valor=62.0 + i, limite=70.0, op=">=",
                       unidad="kPa")
        ver = c.veredicto()
        dom = c.dominante()[0]
        di("    6 BIEN  veredicto de la criba          -> culpa a '%s' (%d de %d)"
           % (dom, c.rechazos[dom]["n"], c.rechazados))
        if dom != "precarga_max":
            prob.append("6: la criba culpa a '%s' en vez de al filtro que mas rechazo" % dom)
        for tiene in ("precarga_max", "87", "0.900", "0.920"):
            if tiene not in ver:
                prob.append("6: el veredicto no dice %r — el mensaje del caso 3 fallaba justo "
                            "por eso" % tiene)
        try:                                      # rechazo anonimo: no tiene que compilar
            c.rechazar(filtro="", valor=1.0)
            prob.append("6: se pudo rechazar SIN nombrar el filtro")
        except TypeError:
            di("    6 MAL   rechazar(filtro='')            -> TypeError (no se puede)")
        try:
            c.rechazar(filtro="x", valor="no cumple")
            prob.append("6: se pudo rechazar SIN un valor numerico")
        except TypeError:
            di("    6 MAL   rechazar(valor='no cumple')    -> TypeError (no se puede)")
        c2 = Criba("con_fuga")
        c2.candidato(10)
        c2.aceptar()
        c2.rechazar(filtro="algo", valor=1.0, limite=0.5)
        try:
            c2.veredicto()
            prob.append("6: la criba no detecto 8 rechazos anonimos (un `return None` suelto "
                        "pasa desapercibido)")
        except CribaIncoherente:
            di("    6 MAL   8 `return None` sin registrar  -> CribaIncoherente")
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return prob


def correr_autotest(verbose=True):
    """Corre el autotest y devuelve 0 / EXIT_AUTOTEST. Lo usan los CLI de la cadena."""
    if verbose:
        print("AUTOTEST pipeline (cada guardia con su par BIEN/MAL)")
    prob = autotest(verbose)
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se audita ninguna cadena con guardias que no probaron detectar.")
        return EXIT_AUTOTEST
    if verbose:
        print("  [AUTOTEST OK] 6 casos, 5 de ellos tienen que dar ROJO y dieron ROJO.\n")
    return 0


if __name__ == "__main__":
    sys.exit(correr_autotest())
