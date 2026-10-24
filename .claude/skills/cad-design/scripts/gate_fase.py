# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe -I gate_fase.py --help
"""GATE de FASES del diseno 3D: criterio de salida por fase y un freno en el medio (gate 3f, 24/10/2026; propuesta P1
de docs/PROPUESTAS_SKILL_3D_2026-10-23.md, l.47-84, y su Agregado l.639).

POR QUE EXISTE. Fak disena por fases y se las saltean, o se sigue optimizando despues de su OK. 20/10/2026, virolador
del Upper Trim: nervios y chaflanes con la barra todavia sin unir al brazo («entraste en detalles antes de hacer que
funcione 100 % el diseno... debo respetar mis fases»); la probeta de tornillo que andaba y se rompio en tres
iteraciones mas despues del «enrosca muchisimo mejor». Los controles estaban en los dos extremos y en el medio no se
disparaba nada (P1, l.51-52).

    gate_fase.py iniciar --workdir W
    gate_fase.py cerrar --fase N --workdir W [--step conj.step] [--movimiento conj.json | --sin-moviles "<motivo>"]
                 [--ok-fak "<frase de Fak>"] [--nota "<concepto>"] [--zona x0,y0,z0,x1,y1,z1]
                 [--acepto-fase "<frase de Fak>"] [--hoy AAAA-MM-DD (solo con CAD_GATE_TEST=1)]
    gate_fase.py pasar --fase N --workdir W [--step conj.step] [--acepto-fase "<frase>"] [--reason "<motivo>"]
    gate_fase.py estado --workdir W
    gate_fase.py --solo-autotest

LAS FASES (faseCanon.data.json; las cinco de P1 l.56-61, no otras):
  0 contrato   GATE P (proceso_declarado con el pliego vigente) y GATE 0 (zona_confirmada) + OK de Fak.
  1 concepto   el concepto y las alternativas escritos (--nota): texto declarado, ningun control lo verifica.
  2 mecanismo  barrido.py VERDE (o aceptado) sobre el conjunto vigente si hay partes moviles (--movimiento o
               params.movimiento), o --sin-moviles "<motivo>" (P1 l.74); firma del STEP del conjunto + OK de Fak.
  3 detalle    gate_aristas.py --cantos-convexos medido sobre el STEP vigente: verde o aceptado; sin zona de mano
               declarada queda como aviso, igual que en la entrega (cantosCanon, sin_zona_en_entrega).
  4 entrega    export_deliverables.py --final despues del cierre de la 3 (P15, el cierre en planta, no frena).

QUE HACE CADA COMANDO.
  cerrar  exige las fases anteriores cerradas y vigentes y la evidencia de salida de esa fase. El barrido (fase 2) y
          los cantos (fase 3) se CORREN aca por subproceso y se juzga SU salida: una evidencia del manifest no vale
          como verde. Deja en W/fases.json el cierre con fecha, firma del STEP, referencia a la evidencia y el OK.
  pasar   falla si una fase anterior no esta cerrada o si lo que la cerro cambio despues: la firma del STEP del
          conjunto, la firma del conjunto del barrido (json + un STEP por parte) o el pliego. Vuelve a leer la
          evidencia del barrido del manifest y la valida contra el conjunto de hoy (barrido.salida_barrido_valida):
          una evidencia sembrada sin poses, sin guarda o de otra firma es NO MEDIDO.
  SEGUIR OPTIMIZANDO DESPUES DEL OK = ROJO: si cambia lo que cerro una fase que tenia el OK de Fak, la fase queda
          REABIERTA en fases.json y el mensaje cita la frase de Fak y las dos firmas. Un OK ya usado para otra firma
          no se vuelve a aceptar.
  Un reexportado identico cambia la firma (FILE_NAME lleva la hora) y FRENA igual (decision F3): la salida es volver
          a correr el barrido (menos de 2 minutos) y cerrar de nuevo; el mensaje dice si los datos son iguales.

MODO. Hasta el aviso_hasta de faseCanon (30/10/2026 inclusive) un rojo AVISA (exit 0) y no escribe ningun cierre;
desde el 31/10 FRENA (exit 1). --acepto-fase "<frase de Fak, 10+>" deja frase, fecha, fase y firma en fases.json y
vale para esa fase y esa firma sola (aceptar la 2 no acepta la 3). --reason "<motivo>" en pasar deja huella y pasa,
pero NO cierra la fase que falta (la entrega la sigue viendo abierta).

Salida: texto y UNA linea JSON {"gate": "fase", ...} al final. Codigos: 0 verde, aviso, aceptado o salteado; 1 freno o
frase mal; 2 NO MEDIDO (fases.json ilegible, STEP ausente, evidencia que no valida); 3 autotest. Un control que no
midio nunca da verde. Par BIEN/MAL propio antes de cada corrida (y con --solo-autotest): si no los separa, exit 3.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)
CANON = os.path.join(AQUI, "faseCanon.data.json")
ARCHIVO = "fases.json"


class NoMedido(Exception):
    """La medicion no se pudo hacer: el gate NUNCA da verde en este caso (exit 2)."""


# ----------------------------------------------------------------------------------------------------------------
# canon, fecha, modo
# ----------------------------------------------------------------------------------------------------------------
def canon_fase():
    with open(CANON, encoding="utf-8") as f:
        return json.load(f)


def hoy_fase(hoy_arg=None):
    """La fecha de hoy. --hoy o CAD_HOY solo valen con CAD_GATE_TEST=1 (los tests); si no, el reloj."""
    from datetime import date
    simulada = hoy_arg or os.environ.get("CAD_HOY", "").strip() or None
    if simulada:
        if os.environ.get("CAD_GATE_TEST") != "1":
            raise NoMedido("--hoy / CAD_HOY solo valen con CAD_GATE_TEST=1 (fecha simulada de los tests)")
        return date.fromisoformat(simulada)
    return date.today()


def dia_siguiente(iso):
    from datetime import date, timedelta
    return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()


def modo_fase(ok, hoy, aviso_hasta, aceptada=False):
    """verde | aceptado | aviso | freno (el NO MEDIDO se decide antes: siempre exit 2)."""
    from datetime import date
    if isinstance(aviso_hasta, str):
        aviso_hasta = date.fromisoformat(aviso_hasta)
    if ok:
        return "verde"
    if aceptada:
        return "aceptado"
    return "aviso" if hoy <= aviso_hasta else "freno"


def _fase_canon(can, n):
    for f in can["fases"]:
        if int(f["n"]) == int(n):
            return f
    raise NoMedido("la fase %s no existe (fases %s)" % (n, ", ".join(str(f["n"]) for f in can["fases"])))


def _ultima_fase(can):
    return max(int(f["n"]) for f in can["fases"])


# ----------------------------------------------------------------------------------------------------------------
# fases.json
# ----------------------------------------------------------------------------------------------------------------
def ruta_fases(w):
    return os.path.join(w, ARCHIVO)


def hay_fases(w):
    return os.path.isfile(ruta_fases(w))


def leer_fases(w):
    p = ruta_fases(w)
    if not os.path.isfile(p):
        raise NoMedido("el workdir no tiene %s (las fases no se declararon: gate_fase.py iniciar --workdir %s)"
                       % (ARCHIVO, w))
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError) as e:
        raise NoMedido("%s ilegible (%s): no se juzga ni se sobreescribe" % (p, e))
    if not isinstance(d, dict) or not isinstance(d.get("fases"), dict):
        raise NoMedido("%s no tiene la forma de un archivo de fases (falta 'fases')" % p)
    d.setdefault("aceptaciones", [])
    d.setdefault("historial", [])
    d.setdefault("ok_usados", [])
    return d


def guardar_fases(w, d):
    with open(ruta_fases(w), "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)


def _ahora():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _firma(path):
    from cadlib import workdir
    return workdir.file_signature(path)


def _firma_datos(path):
    """sha1 de la seccion DATA del STEP (sin la cabecera, que lleva la hora). Solo para DECIR si un cambio de firma es
    un reexportado identico; no se usa para dejar pasar (decision F3 en faseCanon)."""
    import hashlib
    try:
        with open(path, "rb") as f:
            t = f.read()
    except OSError:
        return None
    i = t.find(b"DATA;")
    return hashlib.sha1(t[i:] if i >= 0 else t).hexdigest()[:16]


def _frase_ok(frase, can):
    return frase is not None and len(frase.strip()) >= int(can["frase_minima"])


# ----------------------------------------------------------------------------------------------------------------
# evidencia del manifest
# ----------------------------------------------------------------------------------------------------------------
def _manifest(w):
    from cadlib import workdir
    try:
        return workdir.load_manifest(w)
    except FileNotFoundError:
        return {"evidence": [], "params": {}}
    except (OSError, ValueError) as e:
        raise NoMedido("manifest.json ilegible (%s)" % e)


def _find(man, kind, **match):
    hits = [e for e in man.get("evidence", []) if e.get("kind") == kind
            and all(e.get(k) == v for k, v in match.items())]
    return hits[-1] if hits else None


def _pliego(w, ev):
    pl = (ev or {}).get("pliego")
    for cand in ((os.path.join(w, pl), pl) if pl else ()):
        if os.path.isfile(cand):
            return cand
    return None


def _movimiento(w, arg, man):
    """(ruta del json del conjunto, fuente) o (None, motivo de params.sin_movimiento o None). Igual que export."""
    if arg:
        return os.path.abspath(arg), "--movimiento"
    params = man.get("params") or {}
    mv = params.get("movimiento")
    if mv:
        r = mv if os.path.isabs(mv) else os.path.join(w, mv)
        return os.path.abspath(r), "manifest params.movimiento"
    return None, params.get("sin_movimiento")


def firma_conjunto_de(mov):
    """La firma del conjunto de HOY (json + un STEP por parte + estados), con la misma funcion de barrido.py."""
    import barrido as gb
    try:
        spec = gb.leer_conjunto(mov, float(gb.canon_barrido()["paso_grados"]))
        return gb.firma_conjunto(spec)[0]
    except gb.NoMedido as e:
        raise NoMedido("el json del movimiento (%s) no se pudo leer: %s" % (mov, e))


def barrido_valido(man, firma):
    """(estado, motivo, ev): estado verde | aceptado | rojo; NoMedido si la evidencia no esta o no valida."""
    import barrido as gb
    ev = _find(man, "barrido", firma_conjunto=firma)
    if ev is None:
        ultima = _find(man, "barrido")
        if ultima is not None:
            raise NoMedido("no hay evidencia de barrido del conjunto de hoy (firma %s); la ultima es de otra firma "
                           "(%s): el conjunto cambio despues del barrido" % (firma, ultima.get("firma_conjunto")))
        raise NoMedido("no hay evidencia de barrido en el manifest para el conjunto de hoy (firma %s)" % firma)
    # la evidencia del manifest no guarda la clave "gate" (barrido.py la saca al escribirla): se la vuelve a poner
    # para validar con la MISMA funcion que usa la entrega
    ok, motivo = gb.salida_barrido_valida(dict(ev, gate="barrido"), firma)
    if not ok:
        raise NoMedido("la evidencia de barrido del manifest no valida: %s" % motivo)
    if ev.get("veredicto") == "verde":
        return "verde", "", ev
    if _find(man, "barrido_aceptado", firma_conjunto=firma):
        return "aceptado", "", ev
    return "rojo", "el barrido del conjunto de hoy dio ROJO (pose peor %s)" % (ev.get("pose_peor") or {}), ev


# ----------------------------------------------------------------------------------------------------------------
# una fase cerrada, ¿sigue vigente?
# ----------------------------------------------------------------------------------------------------------------
def faltantes_del_cierre(n, cierre, can=None):
    """Lo que `cerrar` siempre escribe y a este cierre le falta (lista vacia = completo). Un fases.json armado o
    editado a mano con {"estado": "cerrada"} y nada mas NO es un cierre: es NO MEDIDO, nunca verde (P1 l.75: «que la
    IA llene las evidencias solo para pasar»; revisor del 24/10, caso B)."""
    can = can or canon_fase()
    fc = _fase_canon(can, n)
    minimo = int(can["frase_minima"])

    def frase(x):
        return isinstance(x, str) and len(x.strip()) >= minimo

    falta = []
    ev = cierre.get("evidencia") if isinstance(cierre.get("evidencia"), dict) else {}
    if fc["usa_step"] and not (cierre.get("step") and cierre.get("step_firma")):
        falta.append("la firma del STEP (step y step_firma)")
    if cierre.get("estado") == "aceptada":
        if not frase((cierre.get("aceptacion") or {}).get("frase")):
            falta.append("la frase de la aceptacion de Fak")
        return falta
    if fc["pide_ok_fak"] and not frase((cierre.get("ok_fak") or {}).get("frase")):
        falta.append("el OK de Fak con su frase")
    if int(n) == 1 and not frase(ev.get("nota")):
        falta.append("la nota del concepto")
    if int(n) == 2:
        if ev.get("movimiento"):
            if not ev.get("firma_conjunto"):
                falta.append("la firma del conjunto del barrido")
        elif not frase(ev.get("sin_moviles")):
            falta.append("el movimiento (barrido) o «sin partes moviles» con su motivo")
    if int(n) == 3 and not ev.get("cantos_estado"):
        falta.append("el resultado de los cantos")
    if int(n) == 4 and not ev.get("entrega"):
        falta.append("la entrega --final")
    return falta


def vigencia(w, n, cierre, man, step_hoy=None):
    """(ok, motivos, cambio) de una fase cerrada. cambio=True si lo que la cerro cambio despues (firma, conjunto,
    pliego): con OK de Fak eso la REABRE. NoMedido si no se puede leer lo que hay que comparar, o si el cierre no trae
    lo que `cerrar` escribe (fases.json armado a mano)."""
    motivos, cambio = [], False
    if not cierre or cierre.get("estado") not in ("cerrada", "aceptada"):
        estado = (cierre or {}).get("estado") or "sin cerrar"
        return False, ["la fase %s esta %s" % (n, estado)], False
    falta = faltantes_del_cierre(n, cierre)
    if falta:
        raise NoMedido("la fase %s figura %s en fases.json sin lo que escribe gate_fase.py cerrar (falta: %s): un "
                       "cierre armado o editado a mano no es evidencia; volver a cerrarla con gate_fase.py cerrar"
                       % (n, cierre.get("estado"), "; ".join(falta)))
    if cierre.get("estado") == "aceptada":
        # aceptada sin su evidencia: vale para la firma con la que se acepto
        if cierre.get("step"):
            p = step_hoy or cierre["step"]
            if not os.path.isfile(p):
                raise NoMedido("el STEP de la fase %s no esta: %s" % (n, p))
            if _firma(p) != cierre.get("step_firma"):
                return False, ["la fase %s se acepto para la firma %s y el STEP de hoy es otro (%s)"
                               % (n, cierre.get("step_firma"), _firma(p))], True
        return True, [], False
    ev = cierre.get("evidencia") or {}
    if int(n) == 0:
        zona = _find(man, "zona_confirmada")
        proc = _find(man, "proceso_declarado")
        if zona is None:
            motivos.append("ya no hay zona_confirmada (GATE 0) en el manifest")
        if proc is None:
            motivos.append("ya no hay proceso_declarado (GATE P) en el manifest")
        pl = _pliego(w, proc)
        if pl and ev.get("pliego_firma") and _firma(pl) != ev.get("pliego_firma"):
            motivos.append("el pliego cambio despues del cierre (firma %s, al cerrar %s)"
                           % (_firma(pl), ev.get("pliego_firma")))
            cambio = True
    if cierre.get("step"):
        p = step_hoy or cierre["step"]
        if not os.path.isfile(p):
            raise NoMedido("el STEP de la fase %s no esta: %s" % (n, p))
        f = _firma(p)
        if f != cierre.get("step_firma"):
            igual = _firma_datos(p) == cierre.get("step_datos")
            motivos.append("el conjunto cambio despues del %s (firma %s, evidencia %s)%s" % (
                "barrido" if int(n) == 2 and ev.get("movimiento") else "cierre de la fase %s" % n, f,
                cierre.get("step_firma"),
                "; los datos del STEP son iguales (solo cambio la cabecera): es un reexportado, volver a correr el "
                "barrido (menos de 2 minutos) y cerrar de nuevo" if igual else ""))
            cambio = True
    if int(n) == 2 and ev.get("movimiento"):
        firma_hoy = firma_conjunto_de(ev["movimiento"])
        if firma_hoy != ev.get("firma_conjunto"):
            motivos.append("el conjunto del barrido cambio despues del cierre (firma %s, evidencia %s): volver a "
                           "correr barrido.py" % (firma_hoy, ev.get("firma_conjunto")))
            cambio = True
        else:
            estado, mot, _ = barrido_valido(man, firma_hoy)
            if estado == "rojo":
                motivos.append(mot)
    return not motivos, motivos, cambio


def evaluar_pasar(w, n, step=None, piezas=(), escribir=False, hoy=None):
    """Lo que dice `pasar --fase n`: las fases 0..n-1 cerradas y vigentes. Lo usa tambien export_deliverables.

    Devuelve {"ok", "motivos", "reabiertas", "firma", "step"}; NoMedido si no se puede juzgar. piezas: los STEP que
    se entregan (si uno tiene el nombre del STEP de una fase, se compara ESE archivo)."""
    can = canon_fase()
    d = leer_fases(w)
    man = _manifest(w)
    motivos, reabiertas, step_ultimo = [], [], step
    for k in range(int(n)):
        cierre = d["fases"].get(str(k))
        step_hoy = step
        if cierre and cierre.get("step"):
            for p in piezas or ():
                if os.path.basename(p) == os.path.basename(cierre["step"]):
                    step_hoy = p
        ok, mot, cambio = vigencia(w, k, cierre, man, step_hoy=step_hoy if (cierre or {}).get("step") else None)
        if cierre and cierre.get("step"):
            step_ultimo = step_hoy or cierre["step"]
        if ok:
            continue
        nombre = _fase_canon(can, k)["nombre"]
        okf = (cierre or {}).get("ok_fak")
        if cambio and okf:
            motivos.append("SEGUIR OPTIMIZANDO DESPUES DEL OK: la fase %d (%s) tenia el OK de Fak («%s», %s) y %s: la "
                           "fase queda REABIERTA" % (k, nombre, okf.get("frase"), okf.get("fecha"), "; ".join(mot)))
            reabiertas.append(k)
        elif cambio:
            motivos.append("la fase %d (%s): %s; la fase queda REABIERTA" % (k, nombre, "; ".join(mot)))
            reabiertas.append(k)
        else:
            motivos.append("la fase %d (%s) no esta cerrada: %s" % (k, nombre, "; ".join(mot)))
    if step_ultimo is None and piezas and len(piezas) == 1:
        # ninguna fase cerro con STEP y se entrega una sola pieza: la aceptacion se ata a la firma de esa pieza
        step_ultimo = piezas[0]
    if escribir and reabiertas:
        for k in reabiertas:
            c = d["fases"][str(k)]
            c["estado"] = "reabierta"
            c["reabierta"] = {"fecha": _ahora(), "hoy": hoy.isoformat() if hoy else None,
                              "motivo": [m for m in motivos if ("fase %d" % k) in m]}
        d["historial"].append({"fecha": _ahora(), "op": "reabrir", "fases": reabiertas})
        guardar_fases(w, d)
    firma = _firma(step_ultimo) if step_ultimo and os.path.isfile(step_ultimo) else None
    return {"ok": not motivos, "motivos": motivos, "reabiertas": reabiertas, "firma": firma, "step": step_ultimo}


def aceptacion(d, n, op, firma):
    """La aceptacion de Fak para esa fase, esa operacion y esa firma (None si no hay)."""
    for a in reversed(d.get("aceptaciones") or []):
        if int(a.get("fase", -1)) == int(n) and a.get("operacion") == op and a.get("step_firma") == firma:
            return a
    return None


# ----------------------------------------------------------------------------------------------------------------
# criterio de salida de cada fase (cerrar)
# ----------------------------------------------------------------------------------------------------------------
def _zona_mano(w, man, base, arg):
    if arg:
        z = [float(x) for x in arg.split(",")]
        if len(z) != 6:
            raise NoMedido("--zona se escribe x0,y0,z0,x1,y1,z1")
        return z
    z = (man.get("params") or {}).get("zona_mano")
    if isinstance(z, dict):
        z = z.get(base, z.get(os.path.splitext(base)[0]))
    if z is None:
        return None
    try:
        z = [float(x) for x in z]
        assert len(z) == 6
    except (TypeError, ValueError, AssertionError):
        raise NoMedido("params.zona_mano se escribe [x0,y0,z0,x1,y1,z1]; llego %r" % (z,))
    return z


def _correr(cmd, prefijo, tope):
    j, out = None, ""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=tope,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        out = (r.stdout or "") + (r.stderr or "")
        for linea in reversed((r.stdout or "").splitlines()):
            if linea.startswith(prefijo):
                j = json.loads(linea)
                break
    except (subprocess.TimeoutExpired, ValueError) as e:
        out = str(e)
    return j, out


def criterio(w, n, a, man, hoy_arg):
    """(ok, motivos, evidencia del cierre, step, firma). Corre lo que haya que correr. NoMedido si no se puede medir."""
    can = canon_fase()
    fc = _fase_canon(can, n)
    motivos, ev, step, firma = [], {}, None, None
    if fc["usa_step"]:
        if not a.step:
            raise NoMedido("la fase %d (%s) se cierra sobre un STEP: falta --step" % (n, fc["nombre"]))
        step = os.path.abspath(a.step)
        if not os.path.isfile(step):
            raise NoMedido("el STEP no esta: %s" % step)
        firma = _firma(step)
    if n == 0:
        zona, proc = _find(man, "zona_confirmada"), _find(man, "proceso_declarado")
        if zona is None:
            motivos.append("falta zona_confirmada en el manifest (GATE 0: gate_zona.py ... --confirmar <id> --quien Fak)")
        if proc is None:
            motivos.append("falta proceso_declarado en el manifest (GATE P: gate_proceso.py verificar pliego.json)")
        else:
            if proc.get("no_resueltas"):
                motivos.append("el pliego deja fuerzas sin resolver: %s" % ", ".join(str(x) for x in proc["no_resueltas"]))
            pl = _pliego(w, proc)
            if pl and proc.get("pliego_firma") and _firma(pl) != proc.get("pliego_firma"):
                motivos.append("el pliego cambio despues de verificarse: volver a correr gate_proceso.py")
            ev["pliego"] = proc.get("pliego")
            ev["pliego_firma"] = _firma(pl) if pl else proc.get("pliego_firma")
        if zona is not None:
            ev["zona"] = {"date": zona.get("date"), "quien": zona.get("quien"), "ids": zona.get("ids")}
    elif n == 1:
        if not _frase_ok(a.nota, can):
            motivos.append("la fase 1 se cierra con --nota \"<concepto elegido y alternativas descartadas>\" (%d "
                           "caracteres o mas)" % int(can["frase_minima"]))
        else:
            ev["nota"] = a.nota.strip()
            ev["declarado"] = "texto: ningun control lo verifica (P1 l.58)"
    elif n == 2:
        mov, fuente = _movimiento(w, a.movimiento, man)
        if mov and a.sin_moviles:
            raise NoMedido("se declaro movimiento (%s) y --sin-moviles a la vez: una de las dos" % fuente)
        sin = a.sin_moviles if a.sin_moviles is not None else (None if mov else fuente)
        if mov:
            import barrido as gb
            fbc = firma_conjunto_de(mov)
            tope = float(gb.canon_barrido()["tope_segundos"])
            cmd = [sys.executable, "-I", os.path.join(AQUI, "barrido.py"), mov, "--workdir", w]
            if hoy_arg:
                cmd += ["--hoy", hoy_arg]
            j, out = _correr(cmd, '{"gate": "barrido"', tope + 120)
            ok_b, mot_b = gb.salida_barrido_valida(j, fbc)
            if not ok_b:
                raise NoMedido("el barrido del conjunto no sirve como evidencia: %s" % mot_b)
            man = _manifest(w)
            estado, mot, evb = barrido_valido(man, fbc)
            if estado == "rojo":
                motivos.append(mot)
            ev.update(movimiento=mov, movimiento_fuente=fuente, firma_conjunto=fbc, barrido_veredicto=j["veredicto"],
                      barrido_estado=estado, barrido_fecha=evb.get("date"), poses=j.get("poses"),
                      pellizcos=len(j.get("pellizcos") or []),
                      paso_grados=(j.get("guarda") or {}).get("paso_grados"))
        elif sin is not None:
            if not _frase_ok(sin, can):
                motivos.append("«sin partes moviles» necesita el motivo (%d caracteres o mas); llego «%s»"
                               % (int(can["frase_minima"]), sin))
            else:
                ev["sin_moviles"] = sin.strip()
        else:
            motivos.append("falta declarar el movimiento (--movimiento conj.json o params.movimiento: se corre "
                           "barrido.py) o --sin-moviles \"<motivo>\" si no se mueve nada")
    elif n == 3:
        import gate_aristas as ga
        cc = ga.canon_cantos()
        zona = _zona_mano(w, man, os.path.basename(step), a.zona)
        tope = float(can["tope_cantos_segundos"])
        cmd = [sys.executable, "-I", os.path.join(AQUI, "gate_aristas.py"), "--step", step, "--cantos-convexos",
               "--umbral", str(cc["umbral_mm"]), "--workdir", w, "--tope-seg", "%g" % tope]
        cmd += ["--zona=" + ",".join("%g" % x for x in zona)] if zona else ["--sin-zona", "sin zona declarada"]
        if hoy_arg:
            cmd += ["--hoy", hoy_arg]
        j, out = _correr(cmd, '{"gate": "cantos_convexos"', tope + 120)
        ok_c, mot_c = ga.salida_cantos_valida(j, firma)
        if not ok_c:
            raise NoMedido("los cantos no se pudieron medir: %s" % mot_c)
        n_malos = j["cantos_vivos"] + j["radios_chicos"]
        man = _manifest(w)
        aceptada = _find(man, "cantos_aceptados", fixture=os.path.basename(step), step_firma=firma)
        ev.update(cantos_vivos=j["cantos_vivos"], radios_chicos=j["radios_chicos"], zona=zona,
                  convexas_revisadas=j["convexas_revisadas"])
        if n_malos and aceptada:
            ev["cantos_estado"] = "aceptado"
        elif n_malos and not zona:
            ev["cantos_estado"] = "aviso sin zona"
            ev["aviso"] = ("%d cantos vivos o redondeos chicos en la pieza entera, sin zona de mano declarada: queda "
                           "como aviso (cantosCanon, sin_zona_en_entrega)" % n_malos)
        elif n_malos:
            motivos.append("%d cantos vivos (R0) y %d redondeos menores que R%s en la zona de mano"
                           % (j["cantos_vivos"], j["radios_chicos"], cc["umbral_mm"]))
        else:
            ev["cantos_estado"] = "verde"
    elif n == 4:
        cierre3 = (leer_fases(w)["fases"].get("3") or {})
        dl = [e for e in man.get("evidence", []) if e.get("kind") == "delivery" and e.get("final")
              and (e.get("date") or "") >= (cierre3.get("fecha") or "9")]
        if not dl:
            motivos.append("no hay una entrega --final (evidencia delivery) despues del cierre de la fase 3")
        else:
            ev.update(entrega=dl[-1].get("dest"), entrega_fecha=dl[-1].get("date"),
                      planta="pendiente: cierre en planta de P15 (no frena la entrega)")
    if fc["pide_ok_fak"] and not _frase_ok(a.ok_fak, can):
        motivos.append("la fase %d (%s) la cierra Fak: falta --ok-fak \"<frase textual de Fak, %d caracteres o mas>\""
                       % (n, fc["nombre"], int(can["frase_minima"])))
    return not motivos, motivos, ev, step, firma


# ----------------------------------------------------------------------------------------------------------------
# autotest: par BIEN/MAL propio con archivos sinteticos (sin OCC)
# ----------------------------------------------------------------------------------------------------------------
def autotest():
    """Lista de problemas (vacia = el gate separa BIEN de MAL). Workdir temporal con un STEP de texto."""
    from cadlib import workdir
    prob = []
    with tempfile.TemporaryDirectory(prefix="gate_fase_autotest_") as t:
        w = os.path.join(t, "w")
        workdir.ensure_workdir(w)
        stp = os.path.join(w, "out", "conj.step")
        with open(stp, "w") as f:
            f.write("ISO-10303-21;\nHEADER;\nFILE_NAME('a','2026-01-01');\nENDSEC;\nDATA;\n#1=X(1);\nENDSEC;\n")
        d = {"version": 1, "actual": 2, "fases": {
            "0": {"estado": "cerrada", "evidencia": {}, "ok_fak": {"frase": "contrato ok de prueba", "fecha": "x"}},
            "1": {"estado": "cerrada", "evidencia": {"nota": "concepto de prueba"}},
            "2": {"estado": "cerrada", "evidencia": {"sin_moviles": "autotest sin partes moviles"}, "step": stp,
                  "step_firma": _firma(stp), "step_datos": _firma_datos(stp),
                  "ok_fak": {"frase": "mecanismo ok de prueba", "fecha": "x"}}},
             "aceptaciones": [], "historial": [], "ok_usados": []}
        guardar_fases(w, d)
        workdir.record_evidence(w, "zona_confirmada", quien="autotest")
        workdir.record_evidence(w, "proceso_declarado")
        r = evaluar_pasar(w, 3)
        if not r["ok"]:
            prob.append("BIEN (fases 0-2 cerradas, STEP sin tocar) no pasa a la 3: %s" % r["motivos"])
        with open(stp, "a") as f:
            f.write("/* retoque */\n")
        r = evaluar_pasar(w, 3)
        if r["ok"] or 2 not in r["reabiertas"] or "DESPUES DEL OK" not in " ".join(r["motivos"]):
            prob.append("MAL (STEP retocado despues del OK de la fase 2) no da rojo con la fase reabierta: %s" % r)
        d["fases"]["1"] = {"estado": "sin cerrar"}
        guardar_fases(w, d)
        r = evaluar_pasar(w, 2)
        if r["ok"]:
            prob.append("MAL (fase 1 sin cerrar) pasa a la 2")
        # MAL fabricado: fases.json a mano con {"estado": "cerrada"} de la 0 a la 3 y nada mas (caso B del revisor)
        guardar_fases(w, {"version": 1, "actual": 3, "aceptaciones": [], "historial": [], "ok_usados": [],
                          "fases": {str(k): {"estado": "cerrada"} for k in range(4)}})
        try:
            r = evaluar_pasar(w, 4)
            prob.append("MAL (fases.json armado a mano, solo «cerrada») no da NO MEDIDO: %s" % r)
        except NoMedido:
            pass
    return prob


# ----------------------------------------------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("op", nargs="?", choices=["iniciar", "cerrar", "pasar", "estado"])
    ap.add_argument("--fase", type=int, default=None)
    ap.add_argument("--workdir", default=None)
    ap.add_argument("--step", default=None, help="STEP del conjunto (fases 2 y 3)")
    ap.add_argument("--movimiento", default=None, metavar="CONJUNTO_JSON",
                    help="fase 2: json del conjunto que se mueve (se corre barrido.py; tambien params.movimiento)")
    ap.add_argument("--sin-moviles", default=None, metavar="MOTIVO",
                    help="fase 2: no hay partes que se muevan (motivo de 10 caracteres o mas)")
    ap.add_argument("--ok-fak", default=None, metavar="FRASE", help="fases 0 y 2: la frase textual del OK de Fak")
    ap.add_argument("--nota", default=None, help="fase 1: el concepto elegido y las alternativas descartadas")
    ap.add_argument("--zona", default=None, help="fase 3: zona de mano x0,y0,z0,x1,y1,z1 (si no, params.zona_mano)")
    ap.add_argument("--acepto-fase", default=None, metavar="FRASE",
                    help="Fak asume lo que falta: frase de 10 caracteres o mas; queda en fases.json con fecha, fase y "
                         "firma (vale para esa fase y esa firma sola)")
    ap.add_argument("--reason", default=None, help="pasar: saltear con huella (no cierra la fase que falta)")
    ap.add_argument("--hoy", default=None, help="fecha simulada AAAA-MM-DD (solo con CAD_GATE_TEST=1)")
    ap.add_argument("--solo-autotest", action="store_true", help="probar el par BIEN/MAL propio y salir")
    a = ap.parse_args(argv)
    res = {"gate": "fase", "op": a.op, "fase": a.fase, "workdir": a.workdir, "veredicto": "no_medido", "modo": None,
           "motivos": [], "reabiertas": [], "step": None, "step_firma": None, "hoy": None, "aviso_hasta": None}

    def cerrar_salida(codigo, texto):
        print(texto)
        print(json.dumps(res, ensure_ascii=True), flush=True)
        return codigo

    def no_medido(motivo):
        res["veredicto"], res["modo"], res["motivo"] = "no_medido", "no_medido", motivo
        return cerrar_salida(2, "NO MEDIDO: %s. Un control que no midio nunca da verde." % motivo)

    try:
        can = canon_fase()
    except (OSError, ValueError) as e:
        return no_medido("no se pudo leer %s (%s)" % (CANON, e))
    res["aviso_hasta"] = can["aviso_hasta"]
    try:
        hoy = hoy_fase(a.hoy)
    except (NoMedido, ValueError) as e:
        return no_medido(str(e))
    res["hoy"] = hoy.isoformat()
    if a.solo_autotest:
        print("AUTOTEST del gate de fases (par BIEN/MAL propio con archivos sinteticos)")
        prob = autotest()
        for x in prob:
            print("  - " + x)
        print("  [AUTOTEST FALLA] no se juzga ningun workdir" if prob else "  [AUTOTEST OK] el gate separa BIEN de "
              "MAL (fases cerradas y STEP sin tocar; STEP retocado despues del OK; fase sin cerrar)")
        return 3 if prob else 0
    if not a.op or not a.workdir:
        return no_medido("falta el comando (iniciar, cerrar, pasar, estado) o --workdir")
    if a.op in ("cerrar", "pasar"):
        # par BIEN/MAL propio antes de juzgar (como barrido y cantos): un gate que no separa no juzga
        prob = autotest()
        if prob:
            res.update(veredicto="no_medido", modo="autotest", motivo="; ".join(prob))
            print("[AUTOTEST FALLA]")
            for x in prob:
                print("  - " + x)
            return cerrar_salida(3, "No se juzga ningun workdir con un gate de fases que no probo distinguir.")
    w = os.path.abspath(a.workdir)
    res["workdir"] = w
    if a.op == "iniciar":
        if hay_fases(w):
            try:
                d = leer_fases(w)
            except NoMedido as e:
                return no_medido(str(e))
            res.update(veredicto="verde", modo="verde")
            return cerrar_salida(0, "Las fases ya estaban declaradas en %s (fase actual %s): no se toca nada"
                                 % (ruta_fases(w), d.get("actual")))
        from cadlib import workdir
        workdir.ensure_workdir(w)
        guardar_fases(w, {"_que_es": "Fases del diseno de este workdir (gate_fase.py, faseCanon.data.json): cierre "
                          "por fase con fecha, firma del STEP, evidencia y OK de Fak. Lo escribe gate_fase.py; no se "
                          "edita a mano.", "version": 1, "creado": _ahora(), "actual": 0,
                          "fases": {}, "aceptaciones": [], "historial": [], "ok_usados": []})
        res.update(veredicto="verde", modo="verde")
        return cerrar_salida(0, "Fases declaradas en %s: %s" % (ruta_fases(w), "; ".join(
            "%d %s (%s)" % (f["n"], f["nombre"], f["criterio"]) for f in can["fases"])))
    try:
        d = leer_fases(w)
    except NoMedido as e:
        return no_medido(str(e))
    if a.op == "estado":
        lineas = []
        for f in can["fases"]:
            c = d["fases"].get(str(f["n"])) or {}
            lineas.append("  %d %-10s %-10s %s%s" % (f["n"], f["nombre"], c.get("estado") or "abierta",
                                                   c.get("fecha") or "", (" OK de Fak «%s»" % c["ok_fak"]["frase"])
                                                   if c.get("ok_fak") else ""))
        for x in d.get("aceptaciones") or []:
            lineas.append("  aceptacion fase %s (%s) %s: «%s» firma %s" % (x.get("fase"), x.get("operacion"),
                                                                         x.get("fecha"), x.get("frase"),
                                                                         x.get("step_firma")))
        res.update(veredicto="verde", modo="verde")
        return cerrar_salida(0, "FASES de %s (actual %s):\n%s" % (w, d.get("actual"), "\n".join(lineas)))
    if a.fase is None:
        return no_medido("falta --fase N")
    try:
        _fase_canon(can, a.fase)
    except NoMedido as e:
        return no_medido(str(e))
    for nombre, frase in (("--acepto-fase", a.acepto_fase), ("--ok-fak", a.ok_fak), ("--reason", a.reason)):
        if frase is not None and not _frase_ok(frase, can):
            res.update(veredicto="rojo", modo="frase", motivo="frase corta")
            return cerrar_salida(1, "NO SE ACEPTA: %s necesita %d caracteres o mas; llego «%s» (frase corta)"
                                 % (nombre, int(can["frase_minima"]), frase))
    n = int(a.fase)
    try:
        if a.op == "pasar":
            if n == 0:
                res.update(veredicto="verde", modo="verde")
                return cerrar_salida(0, "[OK] la fase 0 no tiene fase anterior")
            step = os.path.abspath(a.step) if a.step else None
            if step and not os.path.isfile(step):
                raise NoMedido("el STEP no esta: %s" % step)
            r = evaluar_pasar(w, n, step=step, escribir=True, hoy=hoy)
            res.update(motivos=r["motivos"], reabiertas=r["reabiertas"], step=r["step"], step_firma=r["firma"])
            d = leer_fases(w)
            if r["ok"]:
                d["actual"] = n
                d["historial"].append({"fecha": _ahora(), "hoy": hoy.isoformat(), "op": "pasar", "fase": n,
                                       "resultado": "verde"})
                guardar_fases(w, d)
                res.update(veredicto="verde", modo="verde")
                return cerrar_salida(0, "[OK] fases 0 a %d cerradas y vigentes: se pasa a la fase %d (%s)"
                                     % (n - 1, n, _fase_canon(can, n)["nombre"]))
            res["veredicto"] = "rojo"
            texto = "; ".join(r["motivos"])
            if a.acepto_fase is not None:
                if not r["firma"]:
                    raise NoMedido("la aceptacion queda atada a la firma de un STEP y ninguna fase cerro con STEP: "
                                   "pasar --fase %d --step <pieza o conjunto> --acepto-fase \"<frase>\"" % n)
                frase = a.acepto_fase.strip()
                otra = [x for x in d["aceptaciones"] if (x.get("frase") or "").strip() == frase
                        and (int(x.get("fase", -1)) != n or x.get("step_firma") != r["firma"])]
                if otra:
                    res.update(modo="frase", motivo="frase usada para otra version")
                    return cerrar_salida(1, "NO SE ACEPTA: esa frase ya acepto otra fase o version (fase %s, firma "
                                         "%s). Una aceptacion vale para UNA fase y UNA firma." % (
                                             otra[-1].get("fase"), otra[-1].get("step_firma")))
                d["aceptaciones"].append({"fase": n, "operacion": "pasar", "frase": frase, "fecha": hoy.isoformat(),
                                          "registrada": _ahora(), "step_firma": r["firma"], "step": r["step"],
                                          "lo_que_faltaba": r["motivos"]})
                d["actual"] = n
                d["historial"].append({"fecha": _ahora(), "op": "pasar", "fase": n, "resultado": "aceptado"})
                guardar_fases(w, d)
                res.update(modo="aceptado", aceptacion={"frase": frase, "fecha": hoy.isoformat()})
                return cerrar_salida(0, "[ACEPTADO] se pasa a la fase %d con lo que falta asumido por Fak («%s»): %s"
                                     % (n, frase, texto))
            if aceptacion(d, n, "pasar", r["firma"]):
                res["modo"] = "aceptado"
                return cerrar_salida(0, "[ACEPTADO] pasar a la fase %d ya estaba aceptado por Fak para esta firma: %s"
                                     % (n, texto))
            if a.reason is not None:
                d["historial"].append({"fecha": _ahora(), "op": "pasar", "fase": n, "resultado": "salteado",
                                       "reason": a.reason.strip(), "lo_que_faltaba": r["motivos"]})
                guardar_fases(w, d)
                res["modo"] = "salteado"
                return cerrar_salida(0, "SALTEADO con --reason (huella en fases.json; la fase que falta sigue "
                                     "abierta y la entrega la ve): %s" % texto)
            modo = modo_fase(False, hoy, can["aviso_hasta"])
            res["modo"] = modo
            if modo == "aviso":
                return cerrar_salida(0, "AVISO: no se pasa limpio a la fase %d: %s. Freno desde %s. Salidas: %s"
                                     % (n, texto, dia_siguiente(can["aviso_hasta"]), "; ".join(can["salidas"])))
            return cerrar_salida(1, "FRENO: no se pasa a la fase %d: %s. Salidas: %s"
                                 % (n, texto, "; ".join(can["salidas"])))

        # ---- cerrar ----
        man = _manifest(w)
        # las fases anteriores se juzgan con los STEP con que se cerraron (si el detalle de la 3 retoco el conjunto,
        # la 2 queda reabierta: el barrido tiene que ser del conjunto vigente, P1 l.65)
        previo = evaluar_pasar(w, n, escribir=True, hoy=hoy) if n > 0 else {"ok": True, "motivos": [],
                                                                             "reabiertas": []}
        d = leer_fases(w)
        fc = _fase_canon(can, n)
        if previo["ok"]:
            ok, motivos, ev, step, firma = criterio(w, n, a, man, a.hoy)
        else:
            ok, motivos, ev, step, firma = False, previo["motivos"], {}, None, None
            res["reabiertas"] = previo["reabiertas"]
        res.update(step=step, step_firma=firma, motivos=motivos)
        ok_fak = None
        if ok and fc["pide_ok_fak"]:
            frase = a.ok_fak.strip()
            usado = [x for x in d["ok_usados"] if (x.get("frase") or "").strip() == frase
                     and (int(x.get("fase", -1)) != n or x.get("step_firma") != firma)]
            if usado:
                res.update(veredicto="rojo", modo="frase", motivo="OK usado para otra version")
                return cerrar_salida(1, "NO SE ACEPTA: ese OK de Fak ya cerro otra fase o version (fase %s, firma %s). "
                                     "Despues de un cambio hace falta un OK nuevo: seguir optimizando despues del OK "
                                     "no hereda el OK." % (usado[-1].get("fase"), usado[-1].get("step_firma")))
            ok_fak = {"frase": frase, "fecha": hoy.isoformat(), "registrado": _ahora()}
        if ok:
            anterior = d["fases"].get(str(n))
            d["fases"][str(n)] = {"estado": "cerrada", "nombre": fc["nombre"], "fecha": _ahora(),
                                  "hoy": hoy.isoformat(), "evidencia": ev, "step": step, "step_firma": firma,
                                  "step_datos": _firma_datos(step) if step else None, "ok_fak": ok_fak}
            if ok_fak:
                d["ok_usados"].append({"fase": n, "frase": ok_fak["frase"], "step_firma": firma,
                                       "fecha": hoy.isoformat()})
            d["historial"].append({"fecha": _ahora(), "hoy": hoy.isoformat(), "op": "cerrar", "fase": n,
                                   "resultado": "cerrada", "step_firma": firma,
                                   "antes": (anterior or {}).get("estado")})
            guardar_fases(w, d)
            res.update(veredicto="verde", modo="verde", evidencia=ev)
            avisos = [ev["aviso"]] if ev.get("aviso") else []
            if a.acepto_fase is not None:
                print("  (--acepto-fase no hace falta: la fase cierra con su evidencia; no se escribe ninguna "
                      "aceptacion)")
            return cerrar_salida(0, "[OK] fase %d (%s) CERRADA: %s%s%s" % (
                n, fc["nombre"], fc["criterio"], (" | firma %s" % firma) if firma else "",
                (" | AVISO: " + "; ".join(avisos)) if avisos else ""))
        res["veredicto"] = "rojo"
        texto = "; ".join(motivos)
        if a.acepto_fase is not None:
            frase = a.acepto_fase.strip()
            otra = [x for x in d["aceptaciones"] if (x.get("frase") or "").strip() == frase
                    and (int(x.get("fase", -1)) != n or x.get("step_firma") != firma)]
            if otra:
                res.update(modo="frase", motivo="frase usada para otra version")
                return cerrar_salida(1, "NO SE ACEPTA: esa frase ya acepto otra fase o version (fase %s, firma %s)"
                                     % (otra[-1].get("fase"), otra[-1].get("step_firma")))
            if fc["usa_step"] and not step:
                raise NoMedido("aceptar la fase %d exige --step (la aceptacion queda atada a su firma)" % n)
            d["aceptaciones"].append({"fase": n, "operacion": "cerrar", "frase": frase, "fecha": hoy.isoformat(),
                                      "registrada": _ahora(), "step_firma": firma, "step": step,
                                      "lo_que_faltaba": motivos})
            d["fases"][str(n)] = {"estado": "aceptada", "nombre": fc["nombre"], "fecha": _ahora(),
                                  "hoy": hoy.isoformat(), "evidencia": ev, "step": step, "step_firma": firma,
                                  "step_datos": _firma_datos(step) if step else None, "ok_fak": None,
                                  "aceptacion": {"frase": frase, "fecha": hoy.isoformat(), "lo_que_faltaba": motivos}}
            d["historial"].append({"fecha": _ahora(), "op": "cerrar", "fase": n, "resultado": "aceptada"})
            guardar_fases(w, d)
            res.update(modo="aceptado", aceptacion={"frase": frase, "fecha": hoy.isoformat()})
            return cerrar_salida(0, "[ACEPTADO] fase %d (%s) cerrada SIN su evidencia, asumido por Fak («%s»): %s"
                                 % (n, fc["nombre"], frase, texto))
        modo = modo_fase(False, hoy, can["aviso_hasta"])
        res["modo"] = modo
        if modo == "aviso":
            return cerrar_salida(0, "AVISO: la fase %d (%s) NO se cierra (no se escribe ningun cierre): %s. Freno desde "
                                 "%s. Salidas: %s" % (n, fc["nombre"], texto, dia_siguiente(can["aviso_hasta"]),
                                                     "; ".join(can["salidas"])))
        return cerrar_salida(1, "FRENO: la fase %d (%s) no se cierra: %s. Salidas: %s"
                             % (n, fc["nombre"], texto, "; ".join(can["salidas"])))
    except NoMedido as e:
        return no_medido(str(e))


if __name__ == "__main__":
    sys.exit(main())
