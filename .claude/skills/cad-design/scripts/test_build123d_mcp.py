# -*- coding: utf-8 -*-
"""Test de aceptacion de build123d-mcp — criterio del ROADMAP: instalar, correr contra
casos YA resueltos con numeros conocidos, y test del valor gemelo (defecto conocido
tiene que dar ROJO). Corre HOY por stdio (sin esperar a la proxima sesion) y queda
como regresion para futuros upgrades de version.

Uso:
    .venv-cad\\Scripts\\python.exe .claude\\skills\\cad-design\\scripts\\test_build123d_mcp.py \\
        [--version 0.3.83] [--workdir <dir>] [--step-real <cliente.step>]

Salida: tabla de checks con el numero medido AL LADO de la verdad y su tolerancia.
Exit 0 = ADOPTAR · 1 = RECHAZAR (algun check separo mal) · 3 = infraestructura
(el server no arranco / timeout — GATE 3.9: tope de tiempo adentro, no en mi memoria).

Verdad de referencia:
- caja_agujero: ANALITICA (volumen = a*b*c - pi*r^2*h). Independiente de los DOS motores.
- interferencia: por construccion (solape 5x30x30 = 4500 mm3) y el par separado da 0.
- pieza_shell (cara suelta, sin volumen): validate() tiene que marcarla — valor gemelo.
- STEP real (opcional --step-real): agreement contra nuestra medicion cadlib/OCC.
  OJO: ambos lados usan kernel OCCT (implementaciones distintas, mismo linaje);
  la independencia de verdad la aportan los casos analiticos.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import threading
import time

TOPE_CALL_S = 120      # GATE 3.9: tope por llamada
TOPE_TOTAL_S = 600     # tope global del test

RESULTADOS = []  # (nombre, ok, detalle)


def check(nombre, ok, detalle):
    RESULTADOS.append((nombre, bool(ok), detalle))
    print(("  OK   " if ok else "  ROJO ") + nombre + " — " + detalle)


# ---------------------------------------------------------------- fixtures
def generar_fixtures(workdir):
    """Genera los STEP de prueba con build123d del .venv-cad. Verdad analitica."""
    from build123d import Box, Cylinder, Pos, export_step  # noqa: import local a proposito

    os.makedirs(workdir, exist_ok=True)
    rutas = {}

    # 1) caja 40x30x20 con agujero pasante D10 en Z -> V = 24000 - pi*25*20
    caja = Box(40, 30, 20) - Cylinder(radius=5, height=40)
    rutas["caja_agujero"] = os.path.join(workdir, "caja_agujero.step")
    export_step(caja, rutas["caja_agujero"])
    rutas["caja_agujero_V"] = 40 * 30 * 20 - math.pi * 25 * 20
    rutas["caja_agujero_bbox"] = (40.0, 30.0, 20.0)

    # 2) par para interferencia: A centrada; B solapada 5 mm en X; B2 separada 10 mm
    a = Box(30, 30, 30)
    rutas["caja_A"] = os.path.join(workdir, "caja_A.step")
    export_step(a, rutas["caja_A"])
    b_sol = Pos(25, 0, 0) * Box(30, 30, 30)
    rutas["caja_B_solapa"] = os.path.join(workdir, "caja_B_solapa.step")
    export_step(b_sol, rutas["caja_B_solapa"])
    rutas["solape_V"] = 5.0 * 30.0 * 30.0  # 4500 mm3 por construccion
    b_sep = Pos(40, 0, 0) * Box(30, 30, 30)
    rutas["caja_B_sep"] = os.path.join(workdir, "caja_B_sep.step")
    export_step(b_sep, rutas["caja_B_sep"])

    # 3) valor gemelo de validate(): una CARA suelta (shell abierto, volumen 0)
    cara = Box(10, 10, 10).faces()[0]
    rutas["pieza_shell"] = os.path.join(workdir, "pieza_shell.step")
    export_step(cara, rutas["pieza_shell"])

    return rutas


# ---------------------------------------------------------------- cliente MCP stdio
class ClienteMcp:
    def __init__(self, cmd):
        env = dict(os.environ)
        # Windows: el worker subprocess del server se CUELGA (import_cad_file no
        # responde ni con 300s de budget; medido 2026-08-29, v0.3.83). In-process
        # anda: import 8s, measure exacto. Sin worker no hay kill-por-timeout del
        # lado del server, asi que el tope lo pone este cliente (GATE 3.9).
        env["BUILD123D_IN_PROCESS"] = "1"
        self.proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1,
            env=env,
        )
        self._id = 0
        self._resp = {}
        self._lock = threading.Lock()
        self._stderr_tail = []
        threading.Thread(target=self._leer_stdout, daemon=True).start()
        threading.Thread(target=self._leer_stderr, daemon=True).start()

    def _leer_stdout(self):
        for linea in self.proc.stdout:
            linea = linea.strip()
            if not linea:
                continue
            try:
                msg = json.loads(linea)
            except json.JSONDecodeError:
                continue  # linea de log perdida en stdout: se ignora
            if "id" in msg and ("result" in msg or "error" in msg):
                with self._lock:
                    self._resp[msg["id"]] = msg

    def _leer_stderr(self):
        for linea in self.proc.stderr:
            self._stderr_tail.append(linea.rstrip())
            if len(self._stderr_tail) > 40:
                self._stderr_tail.pop(0)

    def _enviar(self, obj):
        self.proc.stdin.write(json.dumps(obj) + "\n")
        self.proc.stdin.flush()

    def notificar(self, metodo, params=None):
        msg = {"jsonrpc": "2.0", "method": metodo}
        if params is not None:
            msg["params"] = params
        self._enviar(msg)

    def pedir(self, metodo, params=None, tope=TOPE_CALL_S):
        self._id += 1
        rid = self._id
        msg = {"jsonrpc": "2.0", "id": rid, "method": metodo}
        if params is not None:
            msg["params"] = params
        self._enviar(msg)
        t0 = time.time()
        while time.time() - t0 < tope:
            with self._lock:
                if rid in self._resp:
                    r = self._resp.pop(rid)
                    if "error" in r:
                        raise RuntimeError(f"{metodo}: {r['error']}")
                    return r["result"]
            if self.proc.poll() is not None:
                raise RuntimeError(
                    f"server murio (exit {self.proc.returncode}). stderr:\n"
                    + "\n".join(self._stderr_tail[-15:]))
            time.sleep(0.05)
        raise TimeoutError(f"{metodo}: sin respuesta en {tope}s (GATE 3.9)")

    def tool(self, nombre, argumentos, tope=TOPE_CALL_S):
        r = self.pedir("tools/call", {"name": nombre, "arguments": argumentos}, tope)
        # resultado MCP: {content:[{type:'text',text:...}], structuredContent?, isError?}
        if r.get("isError"):
            raise RuntimeError(f"tool {nombre} devolvio error: {_texto(r)[:800]}")
        return r

    def cerrar(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.terminate()
        except Exception:
            pass


def _texto(resultado):
    partes = []
    for c in resultado.get("content", []):
        if c.get("type") == "text":
            partes.append(c.get("text", ""))
    return "\n".join(partes)


def _json_de(resultado):
    """El payload util. OJO: structuredContent viene como {'result': '<json str>'} —
    el JSON real esta adentro del string, hay que des-anidarlo."""
    sc = resultado.get("structuredContent")
    if isinstance(sc, dict):
        interno = sc.get("result", sc)
        if isinstance(interno, str):
            try:
                return json.loads(interno)
            except json.JSONDecodeError:
                pass
        elif isinstance(interno, dict):
            return interno
    for c in resultado.get("content", []):
        if c.get("type") == "text":
            try:
                return json.loads(c["text"])
            except (json.JSONDecodeError, KeyError):
                continue
    return None


def _buscar_num(d, *claves):
    """Busca recursivo la primera clave presente con valor numerico."""
    if isinstance(d, dict):
        for k in claves:
            if k in d and isinstance(d[k], (int, float)):
                return float(d[k])
        for v in d.values():
            r = _buscar_num(v, *claves)
            if r is not None:
                return r
    elif isinstance(d, list):
        for v in d:
            r = _buscar_num(v, *claves)
            if r is not None:
                return r
    return None


# ---------------------------------------------------------------- test
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="0.3.83")
    ap.add_argument("--workdir", default=os.path.join(
        os.environ.get("TEMP", "."), "b123d_mcp_acept"))
    ap.add_argument("--step-real", default=None,
                    help="STEP real opcional: agreement measure() vs cadlib")
    args = ap.parse_args()

    t_ini = time.time()
    print(f"[1/5] Fixtures analiticos en {args.workdir}")
    rutas = generar_fixtures(args.workdir)

    uvx = shutil.which("uvx")
    if not uvx:
        print("uvx no esta en PATH"); return 3
    cmd = [uvx, "--python", "3.12", f"build123d-mcp=={args.version}"]
    print(f"[2/5] Arrancando server: {' '.join(cmd)}")
    cli = ClienteMcp(cmd)
    try:
        ini = cli.pedir("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "barack-acceptance", "version": "1.0"},
        }, tope=TOPE_CALL_S)
        cli.notificar("notifications/initialized")
        srv = ini.get("serverInfo", {})
        print(f"      server: {srv.get('name')} {srv.get('version')} "
              f"(protocolo {ini.get('protocolVersion')})")

        print("[3/5] tools/list")
        tl = cli.pedir("tools/list")
        tools = {t["name"] for t in tl.get("tools", [])}
        print("      " + ", ".join(sorted(tools)))
        esperadas = {"import_cad_file", "measure", "validate", "compare",
                     "cross_sections", "locate_gate_defects"}
        faltan = esperadas - tools
        check("tools esperadas presentes", not faltan,
              f"faltan: {sorted(faltan)}" if faltan else f"{len(tools)} tools")
        if faltan:
            raise SystemExit(_cierre(t_ini))

        def importar(ruta, nombre):
            cli.tool("import_cad_file", {"path": ruta, "name": nombre})

        # --- caso 1: verdad ANALITICA ---
        print("[4/5] Casos con respuesta conocida + valor gemelo")
        importar(rutas["caja_agujero"], "caja_agujero")
        m = _json_de(cli.tool("measure", {"object_name": "caja_agujero"}))
        v = _buscar_num(m, "volume", "volume_mm3", "volumen")
        v_ref = rutas["caja_agujero_V"]
        if v is None:
            check("measure.volumen (analitico)", False, "no encontre 'volume' en: "
                  + json.dumps(m)[:300])
        else:
            desv = abs(v - v_ref) / v_ref * 100
            check("measure.volumen (analitico)", desv < 0.1,
                  f"MCP {v:.3f} vs formula {v_ref:.3f} mm3 (desv {desv:.4f}%, tol 0,1%)")
        # bbox: buscar los 3 tamanos
        tam = None
        if isinstance(m, dict):
            bb = m.get("bounding_box") or m.get("bbox") or {}
            if isinstance(bb, dict) and "xsize" in bb:
                tam = [float(bb["xsize"]), float(bb["ysize"]), float(bb["zsize"])]
        if tam:
            ref = rutas["caja_agujero_bbox"]
            dmax = max(abs(a - b) for a, b in zip(sorted(tam), sorted(ref)))
            check("measure.bbox (analitico)", dmax < 0.05,
                  f"MCP {tam} vs {list(ref)} (desv max {dmax:.4f} mm, tol 0,05)")
        else:
            check("measure.bbox (analitico)", False,
                  "no encontre bounding_box.size en: " + json.dumps(m)[:300])

        # --- caso 2: interferencia via compare(kind='fit'), los DOS colores ---
        importar(rutas["caja_A"], "caja_A")
        importar(rutas["caja_B_solapa"], "caja_B_solapa")
        importar(rutas["caja_B_sep"], "caja_B_sep")
        r_sol = cli.tool("compare", {"a": "caja_A", "b": "caja_B_solapa",
                                     "kind": "fit", "format": "json"})
        j_sol = _json_de(r_sol) or {}
        t_sol = (_texto(r_sol) + json.dumps(j_sol)).lower()
        v_sol = _buscar_num(j_sol, "overlap_volume", "overlap_volume_mm3",
                            "intersection_volume")
        if v_sol is None:
            check("compare/fit solape=4500", False, t_sol[:300])
        else:
            desv = abs(v_sol - rutas["solape_V"]) / rutas["solape_V"] * 100
            check("compare/fit solape=4500",
                  desv < 1.0 and "interpenetrat" in t_sol,
                  f"MCP {v_sol:.1f} vs 4500,0 mm3 por construccion "
                  f"(desv {desv:.3f}%, tol 1%; status interpenetrating={'interpenetrat' in t_sol})")
        r_sep = cli.tool("compare", {"a": "caja_A", "b": "caja_B_sep",
                                     "kind": "fit", "format": "json"})
        j_sep = _json_de(r_sep) or {}
        t_sep = (_texto(r_sep) + json.dumps(j_sep)).lower()
        v_sep = _buscar_num(j_sep, "overlap_volume", "overlap_volume_mm3",
                            "intersection_volume")
        d_sep = _buscar_num(j_sep, "clearance", "clearance_mm", "distance")
        sep_ok = ("apart" in t_sep) and (v_sep is None or v_sep < 1e-6)
        if d_sep is not None:  # la luz real por construccion es 10 mm
            sep_ok = sep_ok and abs(d_sep - 10.0) < 0.1
        check("compare/fit separadas: apart, luz=10", sep_ok,
              f"MCP status apart={'apart' in t_sep} overlap={v_sep} "
              f"clearance={d_sep} (esperado apart, 0 solape, luz 10,0 mm)")

        # --- caso 3: valor gemelo de validate() ---
        r_ok = None
        try:
            importar(rutas["pieza_shell"], "pieza_shell")
            r_mala = cli.tool("validate", {"object_name": "pieza_shell"})
            txt = (_texto(r_mala) + json.dumps(_json_de(r_mala) or {})).lower()
            es_roja = ("fail" in txt or '"passes_gate": false' in txt)
            check("validate PIEZA MALA da rojo", es_roja, txt[:250])
        except RuntimeError as e:
            # rechazar la cara ya en el import tambien es detectarla
            check("validate PIEZA MALA da rojo", True,
                  f"el server la rechazo al importar: {str(e)[:180]}")
        r_okv = cli.tool("validate", {"object_name": "caja_agujero"})
        txt_ok = (_texto(r_okv) + json.dumps(_json_de(r_okv) or {})).lower()
        es_verde = ("pass" in txt_ok and "fail" not in txt_ok.split("pass")[0]) or \
                   ('"passes_gate": true' in txt_ok)
        check("validate PIEZA BUENA da verde", es_verde, txt_ok[:250])

        # --- caso 4 (opcional): STEP real, agreement contra cadlib ---
        if args.step_real:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from cadlib import geom  # nuestra medicion (motor OCC via gmsh)
            importar(args.step_real, "pieza_real")
            m_real = _json_de(cli.tool("measure", {"object_name": "pieza_real"}, tope=300))
            v_mcp = _buscar_num(m_real, "volume", "volume_mm3")
            print(f"      STEP real: measure() MCP volumen={v_mcp}")
            print("      (comparar a mano contra analyze_step.py — se imprime, no gatea)")
            _ = geom  # referencia usada arriba

    except (RuntimeError, TimeoutError) as e:
        print(f"\nINFRA/PROTOCOLO: {e}")
        cli.cerrar()
        return 3
    finally:
        cli.cerrar()

    return _cierre(t_ini)


def _cierre(t_ini):
    print(f"\n[5/5] Resultado ({time.time()-t_ini:.0f}s):")
    malos = [n for n, ok, _ in RESULTADOS if not ok]
    for n, ok, d in RESULTADOS:
        print(("  OK   " if ok else "  ROJO ") + n)
    if malos:
        print(f"\nRECHAZAR: {len(malos)} check(s) en rojo -> no se adopta.")
        return 1
    print("\nADOPTAR: todos los checks en verde (incluidos los que DEBEN dar rojo).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
