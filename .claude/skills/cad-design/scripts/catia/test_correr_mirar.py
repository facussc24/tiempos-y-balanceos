"""Pruebas SIN CATIA de correr() en modo mirar y sin mirar (arnes del auditor Opus, 19/10). Nada llega al COM real,
al tasklist ni a taskkill: se pisan antes de llamar. Casos:
(a) la CATIA abierta no es la mia (otro pid / pid reciclado / dos CATIA / fresca): SystemExit y 0 documentos cerrados.
(b) mirando, es la mia: al arrancar cierra lo del ejercicio anterior y al terminar deja abierta la pieza nueva.
(c) sin mirar: al terminar cierra lo del ejercicio.
(d) mirando, Fak abrio un documento SUYO en la CATIA propia: no se cierra (ni al arrancar ni al terminar).
(e) paso() con CATIA_PAUSA con coma («1,5»): el paso queda ok una sola vez.
(f) captura() deja la ventana en Layout 2 (arbol + pieza) al terminar."""
import json
import os
import sys
import tempfile
import time as _time
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
TRABAJO = tempfile.mkdtemp(prefix="catia_test_")
os.environ["CATIA_TRABAJO"] = TRABAJO
os.environ["CATIA_PAUSA"] = "0"
sys.path.insert(0, AQUI)
import catia_base as cb  # noqa: E402

assert cb.PRACTICA == TRABAJO
fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


class Doc:
    def __init__(self, nombre, cat, ruta):
        self.nombre, self.cat, self.FullName = nombre, cat, ruta

    def Close(self):
        self.cat.cerrados.append(self.nombre)
        self.cat.docs.remove(self)


class Docs:
    def __init__(self, cat):
        self.cat = cat

    @property
    def Count(self):
        return len(self.cat.docs)

    def Item(self, i):
        return self.cat.docs[i - 1]


class Catia:
    def __init__(self, docs):
        self.cerrados = []
        self.docs = [Doc(n, self, r) for n, r in docs]
        self.Documents = Docs(self)
        self.DisplayFileAlerts = True
        self.Visible = False


ESTADO = {"cat": None, "com": []}


def preparar(docs, pids, guardado, horas):
    cat = Catia(docs)
    ESTADO["cat"], ESTADO["com"] = cat, []
    cb.win32com = types.SimpleNamespace(client=types.SimpleNamespace(
        Dispatch=lambda x: ESTADO["com"].append("Dispatch") or cat,
        GetActiveObject=lambda x: ESTADO["com"].append("GetActiveObject") or cat))
    cb.pythoncom = types.SimpleNamespace(CoInitialize=lambda: None)
    seq = list(pids)
    cb.cnext_abiertos = lambda correr=None: seq.pop(0) if len(seq) > 1 else seq[0]
    cb.es_mia.__defaults__ = (lambda pid: horas.get(pid),)
    cb.hora_de_arranque = lambda pid: horas.get(pid)
    cb.Vigia = lambda pid: types.SimpleNamespace(start=lambda: None, parar=lambda: None, vistos=[])
    cb.subprocess = types.SimpleNamespace(run=lambda *a, **k: None)
    cb.time = types.SimpleNamespace(time=_time.time, sleep=lambda s: None, strftime=_time.strftime)
    json.dump(guardado, open(cb.ESTADO, "w", encoding="utf-8"))
    return cat


def cuerpo(c, reg):
    c.docs.append(Doc("pieza_nueva", c, "Part5"))                      # recien creada: sin ruta


def correr(mirar, docs, pids, horas, fresca=False):
    if mirar is None:
        os.environ.pop("CATIA_MIRAR", None)
    else:
        os.environ["CATIA_MIRAR"] = mirar
    cat = preparar(docs, pids, {"pid": 4321, "hora": 111}, horas)
    try:
        cb.correr("_test_correr", cuerpo, fresca=fresca)
        res = "corrio"
    except SystemExit:
        res = "SystemExit"
    return res, cat


H = {4321: 111, 4325: 999}
FAK = ("FAK_tablero", r"C:\Users\Fak\Documents\tablero.CATPart")
EJ_VIEJO = ("ej31", os.path.join(TRABAJO, "ej31", "ej31.CATPart"))

# (a) no es la mia
for titulo, pids, horas, fresca in (("otro pid", [[4325]], H, False), ("pid reciclado", [[4321]], {4321: 999}, False),
                                    ("dos CATIA", [[4321, 4325]], H, False), ("fresca y no es la mia", [[4325]], H, True)):
    res, cat = correr("1", [FAK], pids, horas, fresca)
    chequear(f"(a) {titulo}: se niega y no cierra nada", res == "SystemExit" and cat.cerrados == [], (res, cat.cerrados))

# (b) mirando, es la mia
res, cat = correr("1", [EJ_VIEJO], [[4321]], H)
chequear("(b) mirando: cierra el ejercicio anterior al arrancar", "ej31" in cat.cerrados, cat.cerrados)
chequear("(b) mirando: la pieza nueva queda abierta", [d.nombre for d in cat.docs] == ["pieza_nueva"], [d.nombre for d in cat.docs])
chequear("(b) mirando: CATIA visible", cat.Visible is True)
chequear("(b) se engancha con GetActiveObject, nunca Dispatch", ESTADO["com"] == ["GetActiveObject"], ESTADO["com"])

# (c) sin mirar
res, cat = correr(None, [EJ_VIEJO], [[4321]], H)
chequear("(c) sin mirar: al terminar cierra lo del ejercicio", cat.docs == [] and "pieza_nueva" in cat.cerrados,
         [d.nombre for d in cat.docs])

# (d) un documento de Fak en la CATIA propia
res, cat = correr("1", [EJ_VIEJO, FAK], [[4321]], H)
chequear("(d) mirando: el documento de Fak NO se cierra", "FAK_tablero" not in cat.cerrados, cat.cerrados)
res, cat = correr(None, [FAK], [[4321]], H)
chequear("(d) sin mirar: el documento de Fak tampoco", "FAK_tablero" not in cat.cerrados, cat.cerrados)

# (d2) fresca=True con un documento de Fak en la CATIA propia: se niega a reiniciar y no cierra nada (auditor ronda 2)
for mirar in ("1", None):
    res, cat = correr(mirar, [EJ_VIEJO, FAK], [[4321]], H, fresca=True)
    chequear(f"(d2) fresca=True con un documento de Fak (mirar={mirar}): se niega y no cierra nada",
             res == "SystemExit" and cat.cerrados == [], (res, cat.cerrados))
res, cat = correr(None, [EJ_VIEJO], [[4321], [], []], H, fresca=True)
chequear("(d2) fresca=True solo con lo del ejercicio: reinicia (cierra lo viejo)", "ej31" in cat.cerrados, (res, cat.cerrados))

# (d3) que es del ejercicio: carpeta parecida NO, catalogo de la instalacion SI, FullName que revienta NO
D = types.SimpleNamespace
chequear("(d3) carpeta parecida (_catia_test_X_vieja) no es del ejercicio",
         not cb.es_del_ejercicio(D(FullName=TRABAJO + "_vieja\\x.CATPart")))
chequear("(d3) archivo en la carpeta de trabajo si", cb.es_del_ejercicio(D(FullName=os.path.join(TRABAJO, "a", "x.CATPart"))))
chequear("(d3) catalogo de materiales de la instalacion si",
         cb.es_del_ejercicio(D(FullName=os.path.join(cb.CATIA_INSTALADA, "intel_a", "startup", "materials", "Catalog.CATMaterial"))))


class Revienta:
    @property
    def FullName(self):
        raise RuntimeError("COM")


chequear("(d3) FullName que revienta: NO es del ejercicio (lado seguro)", not cb.es_del_ejercicio(Revienta()))

# (d4) un cierre que revienta en el finally no impide guardar el registro (auditor ronda 2)
os.environ.pop("CATIA_MIRAR", None)
cat = preparar([EJ_VIEJO], [[4321]], {"pid": 4321, "hora": 111}, H)


def item_roto(i):
    raise RuntimeError("Item roto")


cat.Documents.Item = item_roto
reg_json = os.path.join(TRABAJO, "_test_finally", "registro.json")
try:
    os.remove(reg_json)
except OSError:
    pass
try:
    cb.correr("_test_finally", lambda c, reg: None)
    corrio = True
except Exception:  # noqa: BLE001
    corrio = False
chequear("(d4) Item que revienta al cerrar: correr termina y guarda registro.json", corrio and os.path.exists(reg_json))

# (e) pausa con coma
os.environ["CATIA_MIRAR"] = "lento"
for pausa in ("1,5", "dos"):
    os.environ["CATIA_PAUSA"] = pausa
    reg = cb.Registro("_test_paso")
    reg.catia = types.SimpleNamespace(ActiveWindow=types.SimpleNamespace(ActiveViewer=None))
    r = reg.paso("medir algo", lambda: 42)
    chequear(f"(e) CATIA_PAUSA={pausa!r}: el paso devuelve 42 y queda una sola vez ok",
             r == 42 and len(reg.pasos) == 1 and reg.pasos[0]["ok"], reg.pasos)
os.environ["CATIA_PAUSA"] = "0"
os.environ.pop("CATIA_MIRAR", None)


# (f) captura deja Layout 2
class Visor:
    Viewpoint3D = types.SimpleNamespace(PutSightDirection=lambda d: None, PutUpDirection=lambda d: None)

    def PutBackgroundColor(self, c):
        pass

    def Reframe(self):
        pass

    def Update(self):
        pass

    def CaptureToFile(self, fmt, ruta):
        open(ruta, "wb").close()


class Ventana:
    def __init__(self):
        object.__setattr__(self, "historia", [])
        object.__setattr__(self, "ActiveViewer", Visor())

    def __setattr__(self, k, v):
        if k == "Layout":
            self.historia.append(v)
        object.__setattr__(self, k, v)


w = Ventana()
cb.captura(types.SimpleNamespace(ActiveWindow=w), cb.Registro("_test_captura"), "x", vistas=("iso",))
chequear("(f) captura deja Layout 2 al terminar", w.historia[-1:] == [2], w.historia)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)
