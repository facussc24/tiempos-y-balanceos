# -*- coding: utf-8 -*-
"""catia_medir.py — abrir STEP en CATIA V5 por COM, medirlos, calcular el choque y probar qué módulos responden.

Corre con el Python que tiene pywin32 (NO el .venv-cad):
    C:\\Dev\\_catia_env\\Scripts\\python.exe catia_medir.py <subcomando> ...

Subcomandos:
  estado                                   ¿hay una CATIA abierta? (no la toca)
  medir --step A.step [--step B.step ...]  volumen, área y centro de cada sólido según CATIA
        [--choque PANEL.stp PIEZA.step --frame frame.json --holgura 0.3]
        [--modulos] [--cadlib] --salida informe.json

Reglas que cumple (memoria reference_catia_por_com y lo que costó el 10 y 13/10/2026):
- Se NIEGA a correr si ya hay un CNEXT.exe abierto: con la CATIA de Fak abierta le cerraría sus documentos.
  Abre SU propia CATIA, cierra solo lo que abrió y la apaga al final.
- Un STEP de OpenCASCADE trae la cabecera con FILE_NAME antes de FILE_DESCRIPTION y CATIA R21 lo lee VACÍO:
  se arregla en una COPIA temporal (ISO 10303-21: FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA). El original no se toca.
- CATIA oculta igual muestra cuadros de aviso: un hilo los lista y acepta SOLO los de su propio proceso que tengan
  un único botón OK/Aceptar, con un mensaje dirigido al cuadro (nunca teclas ni foco). Cada cuadro queda anotado.
- Los módulos se prueban CREANDO un elemento de cada uno y midiéndolo, con un control negativo (una orden que no
  existe tiene que fallar). IsProductAuthorized / StartWorkbench contestan que sí a un nombre inventado: no sirven.
- El tiempo de arranque de CATIA se informa aparte del de la medición.
- --cadlib corre la misma medición con build123d en el .venv-cad (otro programa, otro núcleo) para comparar.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

VENV_CAD = Path(r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe")


# ---------------------------------------------------------------- utilidades sin COM (se prueban sin CATIA)
def cnext_abiertos():
    """PIDs de CNEXT.exe (el proceso de CATIA V5) que corren ahora."""
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq CNEXT.exe", "/FO", "CSV", "/NH"],
                             capture_output=True, text=True, timeout=20).stdout
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [int(m.group(1)) for m in re.finditer(r'"CNEXT\.exe","(\d+)"', out, re.I)]


def cabecera_en_orden(texto):
    """Devuelve (texto_corregido, orden_que_tenia). ISO 10303-21 fija FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA."""
    i, j = texto.index("HEADER;") + len("HEADER;"), texto.index("ENDSEC;")
    cab = texto[i:j]
    claves = ("FILE_DESCRIPTION", "FILE_NAME", "FILE_SCHEMA")
    partes = {}
    for k in claves:
        m = re.search(k + r"\s*\(.*?\)\s*;", cab, re.S)
        if not m:
            raise ValueError(f"la cabecera no trae {k}")
        partes[k] = m.group(0)
    orden = sorted(claves, key=lambda k: cab.index(partes[k]))
    nueva = "\n" + "\n".join(partes[k] for k in claves) + "\n"
    return texto[:i] + nueva + texto[j:], orden


def copia_con_cabecera(step, carpeta):
    s = Path(step).read_text(encoding="utf-8", errors="replace")
    corregido, orden = cabecera_en_orden(s)
    dst = Path(carpeta) / (Path(step).stem + "_cabecera.step")
    dst.write_text(corregido, encoding="utf-8", newline="\n")
    return dst, orden


def matriz_desde_frame(frame):
    """12 valores de Move.Apply que llevan el panel (marco del cliente) al marco local del utillaje."""
    ex, ey, ez, o = (frame[k] for k in ("ex", "ey", "ez", "origen"))
    M = [ex, ey, ez]                     # filas = ejes locales en coordenadas del cliente (M = MR^T)
    t = [-sum(M[r][c] * o[c] for c in range(3)) for r in range(3)]
    return [M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2], t[0], t[1], t[2]]


def macro_mover(v12):
    return ("Function CATMain(prod)\n    Dim a(11)\n" + "".join(f"    a({i}) = {x:.9f}\n" for i, x in enumerate(v12)) +
            "    prod.Move.Apply a\n    CATMain = \"ok\"\nEnd Function")


MACRO_COG = """Function CATMain(m)
    Dim c(2)
    m.GetCOG c
    CATMain = c(0) & ";" & c(1) & ";" & c(2)
End Function"""


# ---------------------------------------------------------------- cuadros de aviso del propio proceso
class VigiaCuadros(threading.Thread):
    def __init__(self, pid):
        super().__init__(daemon=True)
        self.pid, self.vistos, self._parar = pid, [], threading.Event()

    def run(self):
        import pythoncom
        import win32con
        import win32gui
        import win32process
        pythoncom.CoInitialize()

        def cb(hwnd, _):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid != self.pid or win32gui.GetClassName(hwnd) != "#32770" or not win32gui.IsWindowVisible(hwnd):
                return True
            botones, textos = [], []

            def hijo(h, _):
                cls, t = win32gui.GetClassName(h), win32gui.GetWindowText(h)
                if cls == "Button":
                    botones.append((h, t))
                elif t.strip():
                    textos.append(t.strip()[:160])
                return True

            win32gui.EnumChildWindows(hwnd, hijo, None)
            titulo = win32gui.GetWindowText(hwnd)
            if len(botones) == 1 and botones[0][1].strip().replace("&", "").upper() in ("OK", "ACEPTAR", "CERRAR", "CLOSE"):
                win32gui.PostMessage(hwnd, win32con.WM_COMMAND, win32gui.GetDlgCtrlID(botones[0][0]), botones[0][0])
                self.vistos.append({"titulo": titulo, "texto": textos[:4], "accion": "aceptado"})
            else:
                clave = (titulo, tuple(b[1] for b in botones))
                if clave not in [(v["titulo"], tuple(v.get("botones", []))) for v in self.vistos]:
                    self.vistos.append({"titulo": titulo, "texto": textos[:4], "botones": [b[1] for b in botones],
                                        "accion": "NO tocado (más de un botón)"})
            return True

        while not self._parar.wait(1.5):
            try:
                win32gui.EnumWindows(cb, None)
            except Exception:  # noqa: BLE001
                pass

    def parar(self):
        self._parar.set()


# ---------------------------------------------------------------- COM
def arrancar():
    previos = cnext_abiertos()
    if previos:
        raise SystemExit(f"Hay una CATIA abierta (CNEXT.exe pid {previos}): no la uso para no tocar documentos ajenos. "
                         "Cerrala y volvé a correr.")
    import win32com.client
    t0 = time.time()
    c = win32com.client.Dispatch("CATIA.Application")
    seg = round(time.time() - t0, 1)
    pids = cnext_abiertos()
    c.DisplayFileAlerts = False
    return c, seg, (pids[0] if len(pids) == 1 else None)


def medir_documento(c, doc):
    """Un STEP puede entrar como pieza (PartDocument) o como producto con piezas adentro (ProductDocument)."""
    try:
        doc.Part
        return {"tipo": "pieza", **medir_parte(c, doc, doc)}
    except AttributeError:
        pass
    prods = doc.Product.Products
    piezas = []
    for i in range(prods.Count):
        pr = prods.Item(i + 1)
        try:
            pdoc = pr.ReferenceProduct.Parent
            piezas.append({"nombre": pr.Name, **medir_parte(c, pdoc, doc)})
        except Exception as e:  # noqa: BLE001
            piezas.append({"nombre": pr.Name, "error": repr(e)[-140:]})
    return {"tipo": "producto", "piezas": piezas}


def medir_parte(c, doc, doc_spa):
    p = doc.Part
    try:
        spa = doc.GetWorkbench("SPAWorkbench")
    except Exception:  # noqa: BLE001
        spa = doc_spa.GetWorkbench("SPAWorkbench")
    cuerpos = []
    for k in range(p.Bodies.Count):
        b = p.Bodies.Item(k + 1)
        try:
            m = spa.GetMeasurable(p.CreateReferenceFromObject(b))
            cog = [float(x) for x in str(c.SystemService.Evaluate(MACRO_COG, 0, "CATMain", [m])).replace(",", ".").split(";")]
            cuerpos.append({"cuerpo": b.Name, "volumen_mm3": round(m.Volume * 1e9, 3), "area_mm2": round(m.Area * 1e6, 3),
                            "centro_crudo": [round(x, 3) for x in cog]})   # GetCOG: la unidad no es la misma en todo STEP (17/10): no se compara
        except Exception as e:  # noqa: BLE001
            cuerpos.append({"cuerpo": b.Name, "sin_volumen": repr(e)[-140:]})
    return {"cuerpos": cuerpos, "conjuntos_de_superficies": p.HybridBodies.Count}


def probar_modulos(c):
    """Crea un elemento de Part Design y uno de superficies, los mide, y corre un control negativo."""
    out = {}
    doc = c.Documents.Add("Part")
    try:
        p = doc.Part
        hsf = p.HybridShapeFactory
        try:   # Part Design: cilindro r=10 h=5 desde un sketch
            sk = p.Bodies.Item(1).Sketches.Add(p.OriginElements.PlaneXY)
            f2 = sk.OpenEdition()
            f2.CreateClosedCircle(0.0, 0.0, 10.0)
            sk.CloseEdition()
            p.ShapeFactory.AddNewPad(sk, 5.0)
            p.Update()
            m = doc.GetWorkbench("SPAWorkbench").GetMeasurable(p.CreateReferenceFromObject(p.MainBody))
            v, esp = m.Volume * 1e9, math.pi * 100 * 5
            out["part_design"] = {"volumen_mm3": round(v, 3), "esperado_mm3": round(esp, 3), "ok": abs(v - esp) < 0.5}
        except Exception as e:  # noqa: BLE001
            out["part_design"] = {"ok": False, "error": repr(e)[-200:]}
        try:   # superficies (GSM): línea de 10 mm extruida 5 mm -> 50 mm2; luego un offset de 1 mm
            hb = p.HybridBodies.Add()
            ref = p.CreateReferenceFromObject      # las fábricas piden REFERENCIAS, no objetos (17/10)
            a = hsf.AddNewPointCoord(0, 0, 20)
            hb.AppendHybridShape(a)
            b = hsf.AddNewPointCoord(10, 0, 20)
            hb.AppendHybridShape(b)
            ln = hsf.AddNewLinePtPt(ref(a), ref(b))
            hb.AppendHybridShape(ln)
            ext = hsf.AddNewExtrude(ref(ln), 5.0, 0.0, hsf.AddNewDirectionByCoord(0, 0, 1))
            hb.AppendHybridShape(ext)
            off = hsf.AddNewOffset(ref(ext), 1.0, True, 0.01)
            hb.AppendHybridShape(off)
            p.Update()
            spa = doc.GetWorkbench("SPAWorkbench")
            m, mo = spa.GetMeasurable(ref(ext)), spa.GetMeasurable(ref(off))
            out["superficies_gsm"] = {"area_mm2": round(m.Area * 1e6, 3), "esperado_mm2": 50.0,
                                      "area_offset_mm2": round(mo.Area * 1e6, 3),
                                      "ok": abs(m.Area * 1e6 - 50) < 0.05 and abs(mo.Area * 1e6 - 50) < 0.05}
        except Exception as e:  # noqa: BLE001
            out["superficies_gsm"] = {"ok": False, "error": repr(e)[-200:]}
        try:   # control negativo: una orden que no existe TIENE que fallar
            hsf.AddNewOrdenQueNoExiste(1)
            out["control_negativo"] = {"ok": False, "detalle": "una orden inventada NO falló: la prueba no sirve"}
        except Exception as e:  # noqa: BLE001
            out["control_negativo"] = {"ok": True, "detalle": "la orden inventada falló, como debe: " + type(e).__name__}
    finally:
        doc.Close()
    out["dse_escaneo"] = {"ok": None, "detalle": "sin biblioteca de tipos de automatización de DSE en esta instalación "
                          "(las 86 registradas no traen ninguna de nubes de puntos; los CATCld*.dll están instalados): "
                          "se usa desde la ventana de CATIA, no por programa"}
    return out


def choque(c, panel, pieza, frame, holgura, abiertos):
    import glob
    import pythoncom
    doc = c.Documents.Add("Product")
    abiertos.append(doc)
    prods = doc.Product.Products
    t0 = time.time()
    prods.AddComponentsFromFiles([str(panel), str(pieza)], "All")
    res = {"segundos_importar": round(time.time() - t0, 1), "componentes": prods.Count}
    if frame:   # OJO 17/10: con el panel movido así el choque cae donde ninguna de las dos piezas tiene material;
        # lo seguro es llevar el panel al marco del utillaje ANTES (OpenCASCADE) y no pasar --frame
        res["mover_panel"] = str(c.SystemService.Evaluate(macro_mover(matriz_desde_frame(frame)), 0, "CATMain", [prods.Item(1)]))
    else:
        res["mover_panel"] = "no: las dos piezas ya vienen en el mismo marco"
    enums = {}
    for tlb in glob.glob(r"C:\Program Files (x86)\Dassault Systemes\B21\intel_a\code\bin\SPATypeLib.tlb"):
        lib = pythoncom.LoadTypeLib(tlb)
        for i in range(lib.GetTypeInfoCount()):
            if lib.GetTypeInfoType(i) == pythoncom.TKIND_ENUM:
                ti = lib.GetTypeInfo(i)
                enums[lib.GetDocumentation(i)[0]] = {ti.GetNames(ti.GetVarDesc(j).memid)[0]: ti.GetVarDesc(j).value
                                                     for j in range(ti.GetTypeAttr().cVars)}
    cl = doc.Product.GetTechnologicalObject("Clashes").Add()
    for nom, val in enums.get("CatClashComputationType", {}).items():
        if "BetweenAll" in nom:
            cl.ComputationType = val
    for nom, val in enums.get("CatClashInterferenceType", {}).items():
        if nom.endswith("Clearance"):
            cl.InterferenceType = val
    cl.Clearance = float(holgura)
    t0 = time.time()
    cl.Compute()
    res["segundos_choque"] = round(time.time() - t0, 2)
    res["holgura_pedida_mm"] = holgura
    confl = []
    for i in range(cl.Conflicts.Count):
        cf = cl.Conflicts.Item(i + 1)
        confl.append({"tipo": cf.Type, "valor_mm": round(float(cf.Value), 4)})
    res["conflictos"] = confl
    res["listas_usadas"] = {k: v for k, v in enums.items() if k in ("CatClashComputationType", "CatClashInterferenceType", "CatConflictType")}
    return res


def medir_con_cadlib(step):
    code = ("import json,sys\nfrom build123d import import_step\ns=import_step(sys.argv[1])\n"
            "sol=list(s.solids())\nprint(json.dumps([{'volumen_mm3':round(x.volume,3),'area_mm2':round(x.area,3),"
            "'centro_mm':[round(v,3) for v in x.center()]} for x in sol]))")
    r = subprocess.run([str(VENV_CAD), "-c", code, str(step)], capture_output=True, text=True, timeout=600,
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    if r.returncode:
        return {"error": r.stderr[-300:]}
    return json.loads(r.stdout.strip().splitlines()[-1])


def cmd_medir(a):
    t_total = time.time()
    tmp = Path(tempfile.mkdtemp(prefix="catia_medir_"))
    informe = {"fecha": time.strftime("%Y-%m-%d %H:%M"), "archivos": [], "cuadros": []}
    c, seg, pid = arrancar()
    informe["catia"] = {"segundos_arranque": seg, "pid": pid, "release": c.SystemConfiguration.Release,
                        "version": c.SystemConfiguration.Version}
    vigia = VigiaCuadros(pid) if pid else None
    if vigia:
        vigia.start()
    abiertos = []
    t_med = time.time()
    try:
        for step in a.step:
            copia, orden = copia_con_cabecera(step, tmp)
            t0 = time.time()
            c.Documents.Open(str(copia))
            doc = c.ActiveDocument      # el objeto que devuelve Open no expone Part/Product a pywin32 (17/10)
            abiertos.append(doc)
            fila = {"archivo": str(step), "cabecera_que_traia": orden, "segundos_abrir": round(time.time() - t0, 1)}
            fila.update(medir_documento(c, doc))
            if a.cadlib:
                fila["cadlib"] = medir_con_cadlib(step)
            informe["archivos"].append(fila)
        if a.choque:
            panel, pieza = a.choque
            fr = json.load(open(a.frame, encoding="utf-8")) if a.frame else None
            cp, _ = copia_con_cabecera(panel, tmp) if Path(panel).suffix.lower() in (".step", ".stp") else (Path(panel), None)
            cz, _ = copia_con_cabecera(pieza, tmp)
            informe["choque"] = choque(c, cp, cz, fr, a.holgura, abiertos)
        informe["segundos_medicion_sin_arranque"] = round(time.time() - t_med, 1)
        if a.modulos:
            informe["modulos"] = probar_modulos(c)
    finally:
        for d in reversed(abiertos):
            try:
                d.Close()
            except Exception:  # noqa: BLE001
                pass
        quedan = c.Documents.Count
        informe["documentos_que_quedaron"] = quedan
        if quedan == 0:
            try:
                c.Quit()
            except Exception:  # noqa: BLE001
                pass
        time.sleep(3)
        if vigia:
            vigia.parar()
            informe["cuadros"] = vigia.vistos
        informe["catia_sigue_abierta"] = bool(cnext_abiertos())
        informe["segundos_total"] = round(time.time() - t_total, 1)
        Path(a.salida).write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(informe, ensure_ascii=False, indent=1))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("estado")
    m = sub.add_parser("medir")
    m.add_argument("--step", action="append", default=[])
    m.add_argument("--choque", nargs=2, metavar=("PANEL", "PIEZA"))
    m.add_argument("--frame")
    m.add_argument("--holgura", type=float, default=0.3)
    m.add_argument("--modulos", action="store_true")
    m.add_argument("--cadlib", action="store_true")
    m.add_argument("--salida", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "estado":
        pids = cnext_abiertos()
        print(json.dumps({"catia_abierta": bool(pids), "pids": pids}))
        return 0
    cmd_medir(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
