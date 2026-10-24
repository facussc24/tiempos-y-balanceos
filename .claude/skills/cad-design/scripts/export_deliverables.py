# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe export_deliverables.py --help
"""Exporta y entrega piezas (STEP + STL binario + GLB opcional) — CON GATE DE EVIDENCIA.

Este es el enforcement REAL de los gates (el hook cad-guard solo recuerda). Exige en el
manifest, una sola vez:

  (0) zona_confirmada    — GATE 0: la ZONA la confirmo Fak. Un utillaje perfecto sobre la
                           feature equivocada pasa todas las demas verificaciones.
  (P) proceso_declarado  — GATE DE PROCESO: que le pasa a la PIEZA mientras la trabajan.
                           Agregado el 02/09/2026 despues de tres entregas rechazadas del
                           dispositivo de adhesivado en las que el calculo estructural
                           estaba bien y el proceso no se habia disenado (gate_proceso.py).
                           Aca ademas es DURO con las fuerzas 'no_resuelto': el gate de
                           diseno las deja pasar marcadas, la ENTREGA no.

y por cada pieza (1) collision_check con n_inside=0 y contacto, (2) evidencia de ensamble
si el STEP trae 2+ solidos, (3) un render mas nuevo que el STEP. Al copiar, (4) la cabecera
del STEP ENTREGADO queda en el orden de ISO 10303-21 y se vuelve a leer (17/10/2026).

(C) CANTOS CONVEXOS donde va la mano (gate 3c, 23/10/2026; P6): por cada pieza corre
gate_aristas.py --cantos-convexos sobre el archivo de out/ que se entrega y lee SU salida (no le
cree a una evidencia vieja del manifest): la firma tiene que ser la de ese archivo, medido:true y
los conteos enteros. La zona de mano sale de params.zona_mano del manifest o del campo zona_mano
del pliego; sin zona juzga la pieza entera y queda como aviso. Hasta el aviso_hasta de
cantosCanon.data.json (30/10/2026) avisa y entrega; desde el 31/10 un rojo o un NO MEDIDO con
zona declarada sale con [GATE cantos] antes de crear la carpeta destino. Salida de Fak:
gate_aristas.py ... --workdir W --acepto-cantos "<frase>" (vale para esa firma sola).

(B) BARRIDO del recorrido (gate 3d, 23/10/2026; P3 + P12): si la entrega declara movimiento
(--movimiento <conjunto.json> o params.movimiento del manifest), corre barrido.py sobre ese json y
lee SU salida (no le cree a una evidencia del manifest): medido:true, poses, paso dentro de la
guarda, pares medidos y la firma del conjunto de hoy. Las partes del json tienen que estar en out/
(se juzga lo que se entrega) y una pieza entregada de 2+ solidos tiene que tener los mismos solidos
que las partes. Hasta el aviso_hasta de barridoCanon.data.json (30/10/2026) avisa y entrega; desde el
31/10 un choque o contacto en un par no declarado, o un NO MEDIDO, sale con [GATE barrido] antes de
crear la carpeta destino (la luz menor que un dedo queda como aviso: luces_frenan). Sin movimiento
declarado, si dos solidos comparten un eje (perno coaxial) avisa «¿se mueve?» y nunca frena.
Salida de Fak: barrido.py <conjunto.json> --workdir W --acepto-barrido "<frase>" (vale para esa firma).
(T) TORNILLOS: largo de agarre y de rosca contra la pila real (gate 3e, 23/10/2026; P14). Si la entrega declara
tornillos (--tornillos <json>, params.tornillos del manifest o campo tornillos del pliego), corre gate_tornillos.py
sobre el STEP de out/ y lee SU salida (firma de ese archivo, medido:true, largo, pila y margen por tornillo). Hasta
el aviso_hasta de tornillosCanon.data.json (30/10/2026) avisa y entrega; desde el 31/10 un rojo o un NO MEDIDO sale
con [GATE tornillos] antes de crear la carpeta destino. Sin tornillos declarados no mide nada; si un solido del STEP
se llama como tornillo, tuerca o inserto, avisa «¿que tornillo va aca?» sin frenar. Salida de Fak:
gate_tornillos.py ... --workdir W --acepto-tornillos "<frase>" (vale para esa firma y esos tornillos).

(F) FASES con criterio de salida (gate 3f, 24/10/2026; P1): si el workdir declaro sus fases (fases.json de
gate_fase.py), la entrega exige poder pasar a la fase 4: las fases 0 (contrato), 1 (concepto), 2 (mecanismo) y 3
(detalle) cerradas con su evidencia y vigentes (la firma del STEP del conjunto, la del conjunto del barrido y el pliego
no cambiaron despues del cierre; si el STEP de una fase es una pieza que se entrega, se compara ESE archivo). Hasta el
aviso_hasta de faseCanon.data.json (30/10/2026) avisa y entrega; desde el 31/10 sale con [GATE fases] antes de crear la
carpeta destino. Sin fases.json (lo ya entregado) avisa «sin fases declaradas» y no frena. Salida de Fak:
gate_fase.py pasar --fase 4 --workdir W --acepto-fase "<frase>" (vale para esa firma).

Con --final (la entrega que va a Fak, no una copia de trabajo) corre ademas el GATE DE
ENTREGABLE sobre la carpeta destino: PDF + STEP + simulacion grabada, misma corrida, y
renders con motor declarado y con color medido (gate_entregable.py). Sin --final la
corrida queda registrada como entrega de trabajo y lo dice.

Sin evidencia NO entrega. Override explicito --skip-gate con --reason, y queda huella en
el manifest.
"""
import argparse
import glob
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import envcheck, geom, step_cabecera, workdir  # noqa: E402

import gmsh  # noqa: E402


def _contar_solidos(step_path):
    """Cuantos solidos trae el STEP. Barato: OCC sin mallar.

    Decide si lo que se entrega es un ENSAMBLE (>=2 solidos) y por lo tanto necesita la
    evidencia de gate_ensamble. Hasta el 2026-08-24 eso se decidia por el NOMBRE del
    archivo ("ENSAMBLE" in base.upper()): un ensamble entregado como conjunto.step no
    disparaba el gate. Es la leccion "el nombre no es el contenido" aplicada al gate
    que la estaba violando.
    """
    from OCP.STEPControl import STEPControl_Reader
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopAbs import TopAbs_SOLID
    r = STEPControl_Reader()
    if r.ReadFile(step_path) != 1:
        return 0
    r.TransferRoots()
    ex = TopExp_Explorer(r.OneShape(), TopAbs_SOLID)
    n = 0
    while ex.More():
        n += 1
        ex.Next()
    return n


def _stl_export(step_path, stl_path, lc, curvature):
    with geom.gmsh_session():
        geom._load(step_path)
        gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
        gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.25)
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", curvature)
        gmsh.option.setNumber("Mesh.Binary", 1)
        gmsh.model.mesh.generate(2)
        gmsh.write(stl_path)


def stl_cuerpos(stl_path):
    """Carga EL STL QUE SE ENTREGA (no un re-mallado) y lo parte en cuerpos conexos.

    Medicion del gate de cuerpos/cavidades. La importa tambien smoke_test.py [9/9]:
    hay UNA copia de esta logica, no una por script que pueda divergir.
    Devuelve (mesh, cuerpos, negativos); negativos = cavidades selladas (volumen < 0).
    """
    envcheck.require(("trimesh",))
    import trimesh
    m = trimesh.load(stl_path)
    cuerpos = list(m.split(only_watertight=False))
    negativos = [c for c in cuerpos if c.volume < 0]
    return m, cuerpos, negativos


def gate_validez_cuerpos(stl_path, base, n_solidos=1):
    """GATEs validez + cuerpos/cavidades sobre EL STL QUE SE ENTREGA.

    Antes esto re-mallaba el STEP con step_to_trimesh y juzgaba ESA malla: el
    2026-08-18 un STL con 8 cuerpos (4 de ellos CAVIDADES SELLADAS de volumen
    negativo) paso el gate porque la malla juzgada era otra. Patron "medir la orden
    y no el resultado". Ahora se carga el archivo exportado.

    Cavidades: quitar un agujero puede SELLAR una cavidad interna que ese agujero
    ventilaba de casualidad (caso real: el vaciado de la base respiraba por los 2 M5;
    al sacar los M5 quedaron bolsas de aire = cuerpos de volumen NEGATIVO que el
    laminador tapa a ciegas). Y un cuerpo POSITIVO suelto es una pieza partida.

    EL TECHO LO DECLARA UNA PERSONA, NO EL ARCHIVO. (2026-09-03, corregido el mismo dia)

    "Un solo cuerpo" es criterio de PIEZA IMPRESA: en un ensamble las piezas van separadas
    a proposito y el gate rechazaba entregas correctas (leccion 20 del skill). La primera
    correccion de hoy puso el techo en `_contar_solidos(step)` y ESO ESTABA MAL, con un
    agujero demostrado en corrida por una auditoria independiente el mismo dia:

        el techo y lo que se mide salian DEL MISMO ARCHIVO. Un boolean fuse que falla y
        deja 2 solidos sueltos produce un STEP que declara 2 y un STL con 2 cuerpos: los
        dos numeros coinciden SIEMPRE, el gate no dispara nunca y encima imprime "es un
        ENSAMBLE, no una pieza partida". O sea que para el bug de dominio mas comun --
        el que este control existe para cazar, y del que hay precedente en este repo --
        el gate quedaba tautologico. Con el techo viejo (1 fijo) ese caso daba ROJO.

    Es la leccion 24 con otra ropa: subir el umbral hasta que el problema desaparece no
    lo corrige, APAGA el control. Y ademas cualquier resto de geometria de construccion
    olvidado en el STEP (un sliver disociado) subia el techo solo.

    Ahora: el techo es 1 salvo que quien entrega DECLARE que la pieza es un ensamble, con
    `--ensamble <nombre>:<N>`. Esa declaracion se coteja contra los solidos del STEP (si
    no coinciden, el que declara no esta mirando la misma pieza) y queda escrita en el
    manifest. No es infalsificable: convierte una mentira comoda -- el archivo
    auto-legitimandose -- en una laboriosa y firmada, que es todo lo que un gate puede
    hacer. Las cavidades selladas siguen siendo rojo SIEMPRE, se declare lo que se declare.

    Devuelve la malla si pasa; SystemExit si no.
    """
    m, cuerpos, negativos = stl_cuerpos(stl_path)
    if not m.is_watertight:
        raise SystemExit("[GATE validez] La malla de '%s' NO es watertight — no se entrega." % base)
    tope = max(1, int(n_solidos))
    if len(cuerpos) > tope or negativos:
        for c in sorted(cuerpos, key=lambda s: s.volume):
            lo, hi = c.bounds
            print("   cuerpo: vol %+9.3f cm3 | bbox %.1f x %.1f x %.1f | centro (%.1f, %.1f, %.1f)"
                  % (c.volume / 1000, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2],
                     (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
        raise SystemExit(
            "[GATE cuerpos] '%s' tiene %d cuerpos y el techo DECLARADO es %d "
            "(%d cavidades selladas de volumen negativo) — no se entrega.\n"
            "Si es una cavidad: abrirla al exterior o hacer la zona maciza.\n"
            "Si son cuerpos de mas: o el diseño se partio (un fuse que no cerro), o es\n"
            "un ENSAMBLE y hay que DECLARARLO a mano: --ensamble %s:%d\n"
            "El techo NO se lee del archivo que se esta juzgando." %
            (base, len(cuerpos), tope, len(negativos), base, len(cuerpos)))
    if len(cuerpos) > 1:
        print("  %s: %d cuerpos, techo declarado %d, 0 cavidades selladas — ensamble "
              "declarado a mano." % (base, len(cuerpos), tope))
    return m


def _aviso_frame_impresion(base, mesh):
    """Avisa si la pieza sale en coordenadas del cliente en vez de listas para imprimir.

    Incidente 2026-07-31: dos piezas entregadas en el frame del cliente, o sea inclinadas y a
    metros del origen — el laminador las recibe torcidas. El entregable impreso va apoyado en
    z=0 y centrado en XY -> `a_plano.py --normal=x,y,z`.
    Es AVISO, no gate: hay entregables (conjuntos, contrapiezas) que si van en el frame cliente.
    """
    lo, hi = mesh.bounds
    centro = (lo + hi) / 2.0
    lejos = max(abs(centro[0]), abs(centro[1])) > 200.0
    despegada = abs(lo[2]) > 1.0
    if lejos or despegada:
        print("  AVISO frame de impresion en '%s': centro XY (%.0f, %.0f), z_min %.2f.\n"
              "    Si esto se imprime, pasarla por a_plano.py (apoyada en z=0, centrada)."
              % (base, centro[0], centro[1], lo[2]))


def _zona_mano(w, base):
    """(zona, fuente) de la zona de mano declarada para la pieza, o (None, None).

    Primero params.zona_mano del manifest; si no, el campo zona_mano del pliego que verifico
    gate_proceso.py (proceso_declarado). Puede ser una caja [x0,y0,z0,x1,y1,z1] para todas las
    piezas o un dict {nombre de pieza: caja}."""
    z, fuente = (workdir.load_manifest(w).get("params") or {}).get("zona_mano"), "manifest params.zona_mano"
    if z is None:
        ev = workdir.find_evidence(w, "proceso_declarado") or {}
        pl = ev.get("pliego")
        for cand in ((os.path.join(w, pl), pl) if pl else ()):
            if os.path.isfile(cand):
                import json
                try:
                    with open(cand, encoding="utf-8") as f:
                        z = json.load(f).get("zona_mano")
                except (OSError, ValueError, AttributeError):
                    z = None
                fuente = "pliego %s, campo zona_mano" % pl
                break
    if isinstance(z, dict):
        z = z.get(base, z.get(os.path.splitext(base)[0]))
    if z is None:
        return None, None
    try:
        z = [float(x) for x in z]
        assert len(z) == 6 and all(z[i] <= z[i + 3] for i in range(3))
    except (TypeError, ValueError, AssertionError):
        raise SystemExit("[GATE cantos] la zona_mano de '%s' (%s) se escribe [x0,y0,z0,x1,y1,z1] con "
                         "x0<=x1, y0<=y1, z0<=z1; llego %r" % (base, fuente, z))
    return z, fuente


def gate_cantos(w, piece, base, hoy_arg=None):
    """GATE de cantos convexos sobre EL ARCHIVO QUE SE ENTREGA. Devuelve el resumen o SystemExit.

    Corre gate_aristas.py por subproceso (con tope) y juzga la linea JSON de ESA corrida: una
    evidencia del manifest con medido:false, sin conteo o de otra firma no vale como verde."""
    import json
    import subprocess
    import gate_aristas as ga
    can = ga.canon_cantos()
    try:
        hoy = ga.hoy_cantos(hoy_arg)
    except (ga.NoMedido, ValueError) as e:
        raise SystemExit("[GATE cantos] %s" % e)
    zona, fuente = _zona_mano(w, base)
    firma = workdir.file_signature(piece)
    cmd = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gate_aristas.py"),
           "--step", piece, "--cantos-convexos", "--umbral", str(can["umbral_mm"]), "--workdir", w]
    cmd += ["--zona=" + ",".join("%g" % x for x in zona)] if zona else ["--sin-zona", "sin zona declarada en el pliego"]
    if hoy_arg:
        cmd += ["--hoy", hoy_arg]
    tope = float(os.environ.get("CAD_CANTOS_TOPE") or can["tope_segundos"]) \
        if os.environ.get("CAD_GATE_TEST") == "1" else float(can["tope_segundos"])
    cmd += ["--tope-seg", "%g" % tope]
    j = None
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=tope + 120, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        for linea in reversed((r.stdout or "").splitlines()):
            if linea.startswith('{"gate": "cantos_convexos"'):
                j = json.loads(linea)
                break
    except (subprocess.TimeoutExpired, ValueError):
        j = None
    ok, motivo = ga.salida_cantos_valida(j, firma)
    n_malos = (j["cantos_vivos"] + j["radios_chicos"]) if ok else None
    aceptada = bool(ok and n_malos and workdir.find_evidence(w, "cantos_aceptados", fixture=base,
                                                             step_firma=firma))
    modo = ga.modo_cantos(ok, n_malos or 0, hoy, can["aviso_hasta"], zona is not None, aceptada)
    if ok:
        texto = ("%d cantos vivos (R0) y %d redondeos menores que R%s en %s"
                 % (j["cantos_vivos"], j["radios_chicos"], ga._mm(can["umbral_mm"]),
                    "la zona de mano (%s)" % fuente if zona else "la pieza entera (sin zona declarada)"))
    else:
        texto = "NO MEDIDO: %s" % motivo
    resumen = {"modo": modo, "medido": ok, "step_firma": firma, "zona": zona, "zona_fuente": fuente,
               "cantos_vivos": j.get("cantos_vivos") if ok else None,
               "radios_chicos": j.get("radios_chicos") if ok else None,
               "hoy": hoy.isoformat(), "motivo": None if ok else motivo}
    if modo == "freno":
        raise SystemExit(
            "[GATE cantos] '%s': %s. Desde el %s esto frena la entrega.\n"
            "Salidas: %s" % (base, texto, ga._dia_siguiente(can["aviso_hasta"]), "; ".join(can["salidas"])))
    if modo == "aviso":
        print("  AVISO [GATE cantos] '%s': %s%s" % (
            base, texto, "" if zona else ". Sin zona de mano declarada: queda como aviso (cantosCanon, "
                                         "sin_zona_en_entrega); declararla en params.zona_mano o en el pliego"))
        if zona:
            print("    freno desde %s" % ga._dia_siguiente(can["aviso_hasta"]))
    elif modo == "aceptado":
        print("  [GATE cantos] '%s': %s, ACEPTADO por frase en el manifest (firma %s)" % (base, texto, firma))
    else:
        print("  [GATE cantos] '%s': OK, %s" % (base, texto))
    return resumen


def _movimiento(w, arg):
    """(ruta del json del conjunto, fuente) o (None, motivo de sin_movimiento o None)."""
    if arg:
        return os.path.abspath(arg), "--movimiento"
    params = workdir.load_manifest(w).get("params") or {}
    mv = params.get("movimiento")
    if mv:
        r = mv if os.path.isabs(mv) else os.path.join(w, mv)
        return os.path.abspath(r), "manifest params.movimiento"
    return None, params.get("sin_movimiento")


def _volumenes(step_path):
    """Volumenes de los solidos del STEP (OCC, sin mallar), ordenados."""
    from OCP.BRepGProp import BRepGProp
    from OCP.GProp import GProp_GProps
    from OCP.STEPControl import STEPControl_Reader
    from OCP.TopAbs import TopAbs_SOLID
    from OCP.TopExp import TopExp_Explorer
    r = STEPControl_Reader()
    if r.ReadFile(step_path) != 1:
        return None
    r.TransferRoots()
    ex = TopExp_Explorer(r.OneShape(), TopAbs_SOLID)
    vols = []
    while ex.More():
        g = GProp_GProps()
        BRepGProp.VolumeProperties_s(ex.Current(), g)
        vols.append(g.Mass())
        ex.Next()
    return sorted(vols)


def _mismos_solidos(a, b, rel=0.005):
    return a is not None and b is not None and len(a) == len(b) and all(
        abs(x - y) <= rel * max(abs(x), abs(y), 1e-9) for x, y in zip(a, b))


def gate_barrido(w, mov, fuente, pieces, hoy_arg=None):
    """GATE de barrido sobre el conjunto que se entrega. Devuelve el resumen o SystemExit.

    Corre barrido.py por subproceso (con tope) y juzga la linea JSON de ESA corrida, validada con
    barrido.salida_barrido_valida: una evidencia del manifest sin poses, sin paso, sin pares o con un
    paso mas grueso que la guarda (el --paso 60 del banco) no vale como verde."""
    import json
    import subprocess
    import barrido as gb
    can = gb.canon_barrido()
    try:
        hoy = gb.hoy_barrido(hoy_arg)
    except (gb.NoMedido, ValueError) as e:
        raise SystemExit("[GATE barrido] %s" % e)
    problemas, firma, j = [], None, None
    try:
        spec = gb.leer_conjunto(mov, float(can["paso_grados"]))
        firma = gb.firma_conjunto(spec)[0]
    except gb.NoMedido as e:
        spec = None
        problemas.append("el json del movimiento (%s) no se pudo leer: %s" % (mov, e))
    if spec:
        out_dir = os.path.normcase(os.path.abspath(os.path.join(w, "out")))
        fuera = []
        for p, r in spec["archivos"].items():
            try:
                dentro = os.path.commonpath([os.path.normcase(os.path.abspath(r)), out_dir]) == out_dir
            except ValueError:          # otra unidad de disco
                dentro = False
            if not dentro:
                fuera.append(p)
        if fuera:
            problemas.append("las partes %s del movimiento no estan en out/ (el barrido juzga los STEP que se "
                             "entregan)" % ", ".join(sorted(fuera)))
        firmas_partes = {workdir.file_signature(r) for r in spec["archivos"].values()}
        vols_partes = sorted(v for r in spec["archivos"].values() for v in (_volumenes(r) or []))
        for piece in pieces:
            if workdir.file_signature(piece) in firmas_partes:
                continue
            vp = _volumenes(piece)
            if vp and len(vp) >= 2 and not _mismos_solidos(vp, vols_partes):
                problemas.append("'%s' tiene %d solidos que no son los de las partes del movimiento (%d): el barrido "
                                 "no habla de lo que se entrega" % (os.path.basename(piece), len(vp), len(vols_partes)))
    if not problemas:
        tope = float(can["tope_segundos"])
        cmd = [sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "barrido.py"), mov,
               "--workdir", w]
        if hoy_arg:
            cmd += ["--hoy", hoy_arg]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                               timeout=tope + 120, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
            for linea in reversed((r.stdout or "").splitlines()):
                if linea.startswith('{"gate": "barrido"'):
                    j = json.loads(linea)
                    break
        except (subprocess.TimeoutExpired, ValueError):
            j = None
        ok, motivo = gb.salida_barrido_valida(j, firma)
        if not ok:
            problemas.append(motivo)
    ok = not problemas
    duro = bool(ok and (j.get("choques") or j.get("contactos") or (can["luces_frenan"] and j.get("pellizcos"))))
    rojo = bool(ok and j.get("veredicto") == "rojo")
    aceptada = bool(ok and rojo and workdir.find_evidence(w, "barrido_aceptado", firma_conjunto=firma))
    modo = gb.modo_barrido(ok, duro or not ok, rojo, hoy, can["aviso_hasta"], aceptada)
    if ok:
        partes = []
        for c in j.get("choques") or []:
            partes.append("choca %s-%s %s mm3 a %s" % (c["par"][0], c["par"][1], c["mm3"], c["pose"]))
        for c in j.get("contactos") or []:
            partes.append("toca %s-%s a %s" % (c["par"][0], c["par"][1], c["pose"]))
        for c in j.get("pellizcos") or []:
            partes.append("luz %s mm a %s < dedo (%s-%s)" % (c["luz_mm"], c["pose"], c["par"][0], c["par"][1]))
        texto = "%d poses, %s" % (j["poses"], "; ".join(partes) if partes else "sin choque ni contacto en pares no "
                                   "declarados")
    else:
        texto = "NO MEDIDO: %s" % "; ".join(problemas)
    resumen = {"modo": modo, "medido": ok, "movimiento": mov, "fuente": fuente, "firma_conjunto": firma,
               "poses": j.get("poses") if ok else None, "veredicto": j.get("veredicto") if ok else "no_medido",
               "pose_peor": j.get("pose_peor") if ok else None, "hoy": hoy.isoformat(),
               "motivo": None if ok else "; ".join(problemas)}
    if modo == "freno":
        raise SystemExit("[GATE barrido] %s: %s. Desde el %s esto frena la entrega.\nSalidas: %s"
                         % (os.path.basename(mov), texto, gb.dia_siguiente(can["aviso_hasta"]),
                            "; ".join(can["salidas"])))
    if modo == "aviso":
        print("  AVISO [GATE barrido] %s: %s%s" % (os.path.basename(mov), texto, (
            "; freno desde %s" % gb.dia_siguiente(can["aviso_hasta"])) if (duro or not ok) else
            "; la luz de dedo queda como aviso (luces_frenan, se revisa el %s)" % can["luces_revisar"]))
    elif modo == "aceptado":
        print("  [GATE barrido] %s: %s, ACEPTADO por frase en el manifest (firma %s)" % (os.path.basename(mov), texto,
                                                                                          firma))
    else:
        print("  [GATE barrido] %s: OK, %s" % (os.path.basename(mov), texto))
    return resumen


def gate_fases(w, pieces, hoy_arg=None):
    """GATE de fases (3f, 24/10/2026; P1): la entrega exige poder pasar a la fase 4, o sea las fases 0 a 3 cerradas y
    vigentes (cada una con su evidencia y la firma de lo que la cerro; si el STEP de una fase es una de las piezas que
    se entregan, se compara ESE archivo). Devuelve el resumen o SystemExit.

    Un workdir sin fases.json (lo ya entregado antes del 24/10) AVISA «sin fases declaradas» y no frena. No escribe en
    fases.json: el que reabre una fase es gate_fase.py."""
    import gate_fase as gf
    can = gf.canon_fase()
    try:
        hoy = gf.hoy_fase(hoy_arg)
    except (gf.NoMedido, ValueError) as e:
        raise SystemExit("[GATE fases] %s" % e)
    if not gf.hay_fases(w):
        print("  AVISO [GATE fases] sin fases declaradas (el workdir no tiene fases.json): no se frena. Para un diseno "
              "nuevo: gate_fase.py iniciar --workdir %s y cerrar cada fase con su evidencia" % w)
        return {"modo": "sin_fases", "medido": False, "hoy": hoy.isoformat()}
    ultima = gf._ultima_fase(can)
    try:
        prob = gf.autotest()          # par BIEN/MAL propio antes de juzgar
        if prob:
            raise gf.NoMedido("el autotest del gate de fases fallo (%s): no se juzga" % "; ".join(prob))
        r = gf.evaluar_pasar(w, ultima, piezas=pieces)
        ok, motivos, firma, no_medido = r["ok"], r["motivos"], r["firma"], None
    except gf.NoMedido as e:
        ok, motivos, firma, no_medido = False, ["NO MEDIDO: %s" % e], None, str(e)
        r = {"reabiertas": [], "step": None}
    aceptada = None
    if not ok and not no_medido:
        try:
            aceptada = gf.aceptacion(gf.leer_fases(w), ultima, "pasar", firma)
        except gf.NoMedido:
            aceptada = None
    modo = gf.modo_fase(ok, hoy, can["aviso_hasta"], bool(aceptada))
    texto = "; ".join(motivos) if motivos else "fases 0 a %d cerradas y vigentes" % (ultima - 1)
    resumen = {"modo": modo, "medido": no_medido is None, "motivos": motivos, "reabiertas": r["reabiertas"],
               "step": r["step"], "step_firma": firma, "hoy": hoy.isoformat(),
               "aceptacion": (aceptada or {}).get("frase")}
    if modo == "freno":
        raise SystemExit("[GATE fases] no se entrega: %s. Desde el %s esto frena la entrega.\nSalidas: %s"
                         % (texto, gf.dia_siguiente(can["aviso_hasta"]), "; ".join(can["salidas"])))
    if modo == "aviso":
        print("  AVISO [GATE fases] %s; freno desde %s" % (texto, gf.dia_siguiente(can["aviso_hasta"])))
    elif modo == "aceptado":
        print("  [GATE fases] %s, ACEPTADO por Fak en fases.json («%s», firma %s)" % (texto, aceptada.get("frase"),
                                                                                    firma))
    else:
        print("  [GATE fases] OK, %s" % texto)
    return resumen


def _cilindros(step_path, etiqueta):
    """[(solido, punto del eje, direccion, radio)] de las caras cilindricas del STEP (OCC, sin mallar)."""
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Cylinder
    from OCP.STEPControl import STEPControl_Reader
    from OCP.TopAbs import TopAbs_FACE, TopAbs_SOLID
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopoDS import TopoDS
    r = STEPControl_Reader()
    if r.ReadFile(step_path) != 1:
        return []
    r.TransferRoots()
    out, i = [], 0
    ex = TopExp_Explorer(r.OneShape(), TopAbs_SOLID)
    while ex.More():
        fx = TopExp_Explorer(ex.Current(), TopAbs_FACE)
        while fx.More():
            s = BRepAdaptor_Surface(TopoDS.Face_s(fx.Current()))
            if s.GetType() == GeomAbs_Cylinder:
                c = s.Cylinder()
                p, d = c.Axis().Location(), c.Axis().Direction()
                out.append(((etiqueta, i), (p.X(), p.Y(), p.Z()), (d.X(), d.Y(), d.Z()), c.Radius()))
            fx.Next()
        i += 1
        ex.Next()
    return out


def coaxiales(pieces, tol_eje=0.05, tol_radio=1.0):
    """Pares de solidos distintos con caras cilindricas en el mismo eje y radios parecidos (un perno en dos piezas).

    Es el indicio de que el conjunto se mueve: si nadie declaro el movimiento, la entrega avisa «¿se mueve?»."""
    import numpy as np
    cil = []
    for piece in pieces:
        cil += _cilindros(piece, os.path.basename(piece))
    hallados = {}
    for i in range(len(cil)):
        si, pi, di, ri = cil[i]
        for k in range(i + 1, len(cil)):
            sk, pk, dk, rk = cil[k]
            if si == sk or abs(ri - rk) > tol_radio:
                continue
            a = np.asarray(di, float)
            if np.linalg.norm(np.cross(a, np.asarray(dk, float))) > 1e-3:
                continue
            if np.linalg.norm(np.cross(np.asarray(pk, float) - np.asarray(pi, float), a)) > tol_eje:
                continue
            hallados.setdefault(tuple(sorted([si, sk])), (pi, di, ri, rk))
    return [{"solidos": ["%s:%d" % x for x in k], "punto": [round(c, 2) for c in v[0]],
             "dir": [round(c, 3) for c in v[1]], "radios": [round(v[2], 3), round(v[3], 3)]}
            for k, v in hallados.items()]


def _tornillos_decl(w, base, arg):
    """(ruta del json de tornillos, fuente) para la pieza, o (None, None) si la entrega no declara tornillos.

    Primero --tornillos; si no, params.tornillos del manifest (ruta relativa al workdir, o la lista/el dict en linea,
    que se escribe en cache/); si no, el campo tornillos del pliego que verifico gate_proceso.py. Si el json dice
    "conjunto" y no es esta pieza, no se aplica a esta pieza."""
    import json
    decl, fuente = None, None
    if arg:
        decl, fuente = arg, "--tornillos"
    else:
        decl = (workdir.load_manifest(w).get("params") or {}).get("tornillos")
        fuente = "manifest params.tornillos"
        if decl is None:
            ev = workdir.find_evidence(w, "proceso_declarado") or {}
            pl = ev.get("pliego")
            for cand in ((os.path.join(w, pl), pl) if pl else ()):
                if os.path.isfile(cand):
                    try:
                        with open(cand, encoding="utf-8") as f:
                            decl = json.load(f).get("tornillos")
                    except (OSError, ValueError, AttributeError):
                        decl = None
                    fuente = "pliego %s, campo tornillos" % pl
                    break
    if decl is None:
        return None, None
    if isinstance(decl, (list, dict)):
        ruta = os.path.join(w, "cache", "tornillos_%s.json" % os.path.splitext(base)[0])
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(decl if isinstance(decl, dict) else {"tornillos": decl}, f, indent=1, ensure_ascii=False)
        decl = ruta
    elif not os.path.isabs(decl) and not os.path.isfile(decl) and os.path.isfile(os.path.join(w, decl)):
        decl = os.path.join(w, decl)
    try:
        with open(decl, encoding="utf-8") as f:
            conj = (json.load(f) or {}).get("conjunto")
    except (OSError, ValueError, AttributeError):
        conj = None                                   # lo dice el gate como NO MEDIDO
    if conj and os.path.basename(str(conj)) not in (base, os.path.splitext(base)[0]):
        return None, "%s, que habla de %s" % (fuente, conj)    # declarado, pero no para esta pieza
    return decl, fuente


def _tornillos_sin_pieza(fuente, piezas, hoy_arg=None):
    """La entrega declara tornillos y ninguna pieza es el conjunto del json (p. ej. se renombro el conjunto entre
    versiones): NO MEDIDO, nunca verde por silencio. Aviso hasta el 30/10 y freno desde el 31/10."""
    import gate_tornillos as gt
    can = gt.canon()
    try:
        hoy = gt.hoy_tornillos(hoy_arg)
    except (gt.NoMedido, ValueError) as e:
        raise SystemExit("[GATE tornillos] %s" % e)
    motivo = ("la entrega declara tornillos (%s) y ese conjunto no esta entre las piezas que se entregan (%s)"
              % (fuente, ", ".join(os.path.basename(x) for x in piezas)))
    modo = gt.modo_tornillos(False, 0, hoy, can["aviso_hasta"])
    if modo == "freno":
        raise SystemExit("[GATE tornillos] NO MEDIDO: %s. Desde el %s esto frena la entrega.\n"
                         "Corregir el campo conjunto del json (o --skip-gate tornillos --reason '...')"
                         % (motivo, gt.dia_siguiente(can["aviso_hasta"])))
    print("  AVISO [GATE tornillos] NO MEDIDO: %s\n    freno desde %s" % (motivo, gt.dia_siguiente(can["aviso_hasta"])))
    return {"modo": modo, "medido": False, "motivo": motivo, "hoy": hoy.isoformat(), "tornillos": []}


def _aviso_sin_tornillos(piece, base):
    """Sin tornillos declarados: si algun solido del STEP se llama como tornillo, tuerca o inserto, avisa sin frenar.
    Nunca levanta una excepcion (es un aviso)."""
    try:
        import re
        if _contar_solidos(piece) < 2:
            return
        import gate_tornillos as gt
        from build123d import import_step
        nombres = [n for n, _ in gt.solidos_con_nombre(import_step(piece))]
        pat = re.compile(r"tornill|bul[oó]n|screw|bolt|tuerca|\bnut|inserto|insert|perno|\bM\d{1,2}\b", re.I)
        sosp = [n for n in nombres if pat.search(n)]
        if sosp:
            print("  AVISO [GATE tornillos] '%s': ¿que tornillo va aca? El conjunto trae %s y la entrega no declara "
                  "tornillos (--tornillos <json> o params.tornillos): el largo de agarre no se midio."
                  % (base, ", ".join(sosp[:6]) + (" y %d mas" % (len(sosp) - 6) if len(sosp) > 6 else "")))
    except Exception:
        pass


def gate_tornillos(w, piece, base, decl, hoy_arg=None):
    """GATE de tornillos sobre EL ARCHIVO QUE SE ENTREGA. Devuelve el resumen o SystemExit.

    Corre gate_tornillos.py por subproceso y juzga la linea JSON de ESA corrida: una evidencia del manifest con
    medido:false, sin numeros por tornillo o de otra firma no vale como verde."""
    import json
    import subprocess
    import gate_tornillos as gt
    can = gt.canon()
    try:
        hoy = gt.hoy_tornillos(hoy_arg)
    except (gt.NoMedido, ValueError) as e:
        raise SystemExit("[GATE tornillos] %s" % e)
    firma = workdir.file_signature(piece)
    cmd = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gate_tornillos.py"),
           "--step", piece, "--tornillos", decl, "--workdir", w]
    if hoy_arg:
        cmd += ["--hoy", hoy_arg]
    j = None
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=900, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        for linea in reversed((r.stdout or "").splitlines()):
            if linea.startswith('{"gate": "tornillos"'):
                j = json.loads(linea)
                break
    except (subprocess.TimeoutExpired, ValueError):
        j = None
    ok, motivo = gt.salida_valida(j, firma)
    rojos = [t for t in j["tornillos"] if t["veredicto"] == "rojo"] if ok else []
    ids = {t["id"] for t in rojos}
    aceptada = False
    if ok and rojos:
        for e in workdir.load_manifest(w).get("evidence", []):
            if (e.get("kind") == "tornillos_aceptados" and e.get("fixture") == base and e.get("step_firma") == firma
                    and ids <= set(e.get("ids") or [])):
                aceptada = True
    modo = gt.modo_tornillos(ok, len(rojos), hoy, can["aviso_hasta"], aceptada)
    por_tornillo = [{k: t.get(k) for k in ("id", "veredicto", "largo_medido_mm", "pila_mm", "margen_mm", "pila",
                                            "inserto", "carga_N", "rojos", "avisos")}
                    for t in j["tornillos"]] if ok else []
    if not ok:
        texto = "NO MEDIDO: %s" % motivo
    elif rojos:
        texto = "; ".join("%s: %s" % (t["id"], " / ".join(t["rojos"])) for t in rojos)
    else:
        texto = "%d tornillos pasan la pila y toman su rosca" % len(por_tornillo)
    resumen = {"modo": modo, "medido": ok, "step_firma": firma, "tornillos_json": decl, "hoy": hoy.isoformat(),
               "tornillos": por_tornillo, "motivo": None if ok else motivo}
    if modo == "freno":
        raise SystemExit(
            "[GATE tornillos] '%s': %s. Desde el %s esto frena la entrega.\n"
            "Salidas: %s" % (base, texto, gt.dia_siguiente(can["aviso_hasta"]), "; ".join(can["salidas"])))
    if modo == "aviso":
        print("  AVISO [GATE tornillos] '%s': %s\n    freno desde %s"
              % (base, texto, gt.dia_siguiente(can["aviso_hasta"])))
    elif modo == "aceptado":
        print("  [GATE tornillos] '%s': %s, ACEPTADO por frase en el manifest (firma %s)" % (base, texto, firma))
    else:
        print("  [GATE tornillos] '%s': OK, %s" % (base, texto))
    return resumen


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--pieces", nargs="+", required=True, help="STEPs a entregar (tipicamente en out/)")
    ap.add_argument("--deliver", required=True, help="carpeta destino de la entrega")
    ap.add_argument("--stl-lc", type=float, default=geom.LC_PRINT)
    ap.add_argument("--stl-curvature", type=int, default=geom.CURVATURE_PRINT)
    ap.add_argument("--glb", action="store_true", help="exportar tambien GLB (visor web)")
    ap.add_argument("--ensamble", action="append", default=[], metavar="NOMBRE:N",
                    help="declarar que una pieza es un ENSAMBLE de N cuerpos y no una "
                         "pieza impresa. Sin esto el techo es 1. El numero lo pone una "
                         "PERSONA: si se leyera del propio STEP, un fuse que falla y deja "
                         "2 solidos declararia 2, el STL tendria 2 y el gate no dispararia "
                         "NUNCA (demostrado en corrida el 03/09). Se coteja contra los "
                         "solidos del STEP y queda escrito en el manifest.")
    ap.add_argument("--skip-gate", action="append", default=[],
                    choices=["zona", "proceso", "collision", "render", "ensamble", "entregable",
                             "cantos", "barrido", "tornillos", "fases"],
                    help="saltear un gate (queda registrado; exige --reason)")
    ap.add_argument("--reason", default=None, help="justificacion del --skip-gate")
    ap.add_argument("--final", action="store_true",
                    help="esta es LA entrega que va a Fak: corre ademas el gate de entregable "
                         "sobre la carpeta destino (PDF + STEP + simulacion + renders legibles)")
    ap.add_argument("--motor", default="", help="--final: motor de imagen de los renders (ver procesoCanon)")
    ap.add_argument("--render", nargs="*", default=[], help="--final: los PNG que muestran el 3D")
    ap.add_argument("--hoy", default=None,
                    help="solo tests: fecha simulada AAAA-MM-DD para los gates de cantos, barrido, tornillos y fases "
                         "(exige CAD_GATE_TEST=1)")
    ap.add_argument("--movimiento", default=None, metavar="CONJUNTO_JSON",
                    help="json del conjunto que se mueve (partes en out/, movil/eje/rango o estados): corre el gate "
                         "de barrido (tambien se toma de params.movimiento del manifest)")
    ap.add_argument("--tornillos", default=None, metavar="JSON",
                    help="json de los tornillos del conjunto (gate_tornillos.py); sin esto se lee params.tornillos "
                         "del manifest o el campo tornillos del pliego")
    args = ap.parse_args()

    if args.skip_gate and not args.reason:
        raise SystemExit("--skip-gate exige --reason (la huella queda en el manifest)")
    if args.hoy and os.environ.get("CAD_GATE_TEST") != "1":
        raise SystemExit("--hoy solo vale con CAD_GATE_TEST=1 (fecha simulada de los tests)")
    cantos_por_pieza = {}
    tornillos_por_pieza = {}
    tornillos_sin_pieza = None

    declarados = {}
    for d in args.ensamble:
        if ":" not in d:
            raise SystemExit("--ensamble se escribe NOMBRE:N (ej: nido_volteador_SAB1740:5)")
        nom, n = d.rsplit(":", 1)
        declarados[nom] = int(n)
    cuerpos_por_pieza = {}

    w = workdir.ensure_workdir(args.workdir)

    # ---- GATE 0: la ZONA (una sola vez, no por pieza) ----
    if "zona" not in args.skip_gate:
        if workdir.find_evidence(w, "zona_confirmada") is None:
            raise SystemExit(
                "[GATE 0 zona] No hay 'zona_confirmada' en el manifest de %s.\n"
                "Un utillaje puede estar perfecto y estar sobre la feature EQUIVOCADA: eso no lo\n"
                "detecta ninguna verificacion posterior, porque todas miden contra la zona que eligi yo.\n"
                "Correr:  gate_zona.py inventario <cliente.stp> --workdir %s --render\n"
                "         -> mandarle renders/gate0_mapa.png a Fak, que circule cual es\n"
                "         gate_zona.py inventario <cliente.stp> --workdir %s --confirmar <id> "
                "--quien Fak --evidencia '<como lo confirmo>'\n"
                "(o --skip-gate zona --reason '...' si genuinamente no aplica)" % (w, w, w))

    # ---- GATE DE PROCESO: que le pasa a la PIEZA mientras la trabajan (una sola vez) ----
    if "proceso" not in args.skip_gate:
        ev = workdir.find_evidence(w, "proceso_declarado")
        if ev is None:
            raise SystemExit(
                "[GATE proceso] No hay 'proceso_declarado' en el manifest de %s.\n"
                "Los otros gates miran la pieza QUIETA: la zona, el ensamble, el tamano. Un\n"
                "dispositivo puede pasarlos todos y no servir, porque lo que lo hace fallar pasa\n"
                "MIENTRAS el operario trabaja. El 31/08/2026 el carro apoyaba la pieza y el\n"
                "adhesivo iba a pistola: 'pones la tela ahi, le tiras adhesivo directamente, se\n"
                "va a volar la tela'.\n"
                "Correr:  gate_proceso.py plantilla --tags <etiquetas> --out pliego.json\n"
                "         gate_proceso.py verificar pliego.json --workdir %s\n"
                "(o --skip-gate proceso --reason '...' si genuinamente no aplica)" % (w, w))
        # La evidencia tiene que hablar del pliego que hay HOY en disco. Es la misma leccion
        # que cerro el agujero (A) del 24/08 para las piezas —"un cache sin la firma del
        # archivo miente"— aplicada al pliego: verificar, editarlo y entregar no puede pasar.
        pliego = ev.get("pliego")
        firma = ev.get("pliego_firma")
        if firma and pliego:
            for cand in (os.path.join(w, pliego), pliego):
                if os.path.isfile(cand):
                    ok_f, motivo = workdir.check_signature(ev, "pliego_firma", cand)
                    if not ok_f:
                        raise SystemExit(
                            "[GATE proceso] El pliego cambio despues de verificarse: %s\n"
                            "Re-correr gate_proceso.py sobre la version que vale." % motivo)
                    break
        pendientes = ev.get("no_resueltas") or []
        if pendientes:
            raise SystemExit(
                "[GATE proceso] El pliego deja %d fuerza(s) SIN RESOLVER: %s\n"
                "Durante el diseno eso es un estado valido y queda marcado; en la entrega no.\n"
                "Pliego v2, 31/08/2026: 'un dispositivo con una fuerza sin contestar no esta\n"
                "terminado, por mas que la estructura calcule perfecto'."
                % (len(pendientes), ", ".join(str(x) for x in pendientes)))

    # ---- GATES por pieza ----
    for piece in args.pieces:
        base = os.path.basename(piece)
        if not os.path.isfile(piece):
            raise SystemExit("No existe la pieza: %s" % piece)

        if "collision" not in args.skip_gate:
            ev = workdir.find_evidence(w, "collision_check", fixture=base)
            if ev is None:
                raise SystemExit(
                    "[GATE colision] Sin collision_check para '%s' en el manifest.\n"
                    "Correr: check_collision.py --workdir %s --fixture %s --substrate <cliente.step>\n"
                    "(o --skip-gate collision --reason '...' si genuinamente no aplica)" % (base, w, piece))
            if ev.get("n_inside", 1) != 0:
                raise SystemExit(
                    "[GATE colision] El ultimo collision_check de '%s' dio %s puntos DENTRO (%s).\n"
                    "Corregir la pieza y re-verificar antes de entregar." % (base, ev.get("n_inside"), ev.get("date")))
            # "no penetra" NO alcanza: un utillaje flotando a 60 mm de la pieza da 0 puntos
            # dentro exactamente igual que uno bien apoyado. Hay que exigir ademas que
            # ASIENTE — es la falla del 2026-08-07, que este mismo gate dejo pasar.
            ok_firma, motivo = workdir.check_signature(ev, "fixture_firma", piece)
            if not ok_firma:
                raise SystemExit(
                    "[GATE colision] La evidencia de '%s' NO habla del archivo que se va a\n"
                    "entregar: %s\n"
                    "Correr: check_collision.py --workdir %s --fixture %s --substrate <cliente.step>"
                    % (base, motivo, w, piece))
            if ev.get("contacto_ok") is not True:
                raise SystemExit(
                    "[GATE colision] El collision_check de '%s' no registra CONTACTO (%s).\n"
                    "0 puntos dentro solo dice que no penetra: un utillaje a 60 mm de la pieza da\n"
                    "lo mismo. Re-correr check_collision.py (mide tambien distancia minima y\n"
                    "cuantos puntos apoyan)." % (base, ev.get("date")))

        # GATE ENSAMBLE: si lo que se entrega es un ensamble (pieza del cliente + dispositivo),
        # el collision_check NO alcanza. El 2026-08-07 se entrego un ensamble con el macho
        # fuera de la ranura y las verificaciones de entonces (bbox dentro, volumen conservado)
        # dieron las dos bien: ninguna PODIA ver un corrimiento. Hace falta la evidencia del
        # emparejamiento macho-hembra, que se saca con gate_ensamble.py.
        if "ensamble" not in args.skip_gate and _contar_solidos(piece) >= 2:
            ev = workdir.find_evidence(w, "ensamble_posicionado", fixture=base)
            if ev is None:
                raise SystemExit(
                    "[GATE ensamble] Sin evidencia de gate_ensamble para '%s'.\n"
                    "Correr: gate_ensamble.py --step %s --pareja <x,y,z de cada abertura> "
                    "--render %s/renders --workdir %s\n"
                    "El bbox y el volumen NO sirven aca: los dos dan bien con el dispositivo "
                    "corrido 60 mm.\n"
                    "(o --skip-gate ensamble --reason '...' si genuinamente no aplica)"
                    % (base, piece, w, w))
            if not ev.get("ok", False):
                raise SystemExit(
                    "[GATE ensamble] El ultimo gate_ensamble de '%s' dio FALLA (%s): %s\n"
                    "Corregir la posicion y re-verificar antes de entregar."
                    % (base, ev.get("date"), ev.get("motivo", "ver salida del gate")))

            ok_firma, motivo = workdir.check_signature(ev, "step_firma", piece)
            if not ok_firma:
                raise SystemExit(
                    "[GATE ensamble] La evidencia de '%s' NO habla del archivo que se va a\n"
                    "entregar: %s" % (base, motivo))

        if "render" not in args.skip_gate:
            step_mtime = os.path.getmtime(piece)
            renders = glob.glob(os.path.join(w, "renders", "*.png"))
            fresh = [r for r in renders if os.path.getmtime(r) >= step_mtime]
            if not fresh:
                raise SystemExit(
                    "[GATE render] Ningun PNG en %s/renders es mas nuevo que %s.\n"
                    "Renderizar y MIRAR el resultado (render_step.py / check_collision.py --render) "
                    "antes de entregar." % (w, base))

        # GATE CANTOS (3c, 23/10/2026): va ultimo en el loop y antes de crear la carpeta destino,
        # asi un freno no deja nada entregado y los mensajes de los gates de arriba salen primero.
        if "cantos" not in args.skip_gate:
            cantos_por_pieza[base] = gate_cantos(w, piece, base, args.hoy)

        # GATE TORNILLOS (3e, 23/10/2026): tambien antes de crear la carpeta destino.
        if "tornillos" not in args.skip_gate:
            decl, fuente_t = _tornillos_decl(w, base, args.tornillos)
            if decl:
                tornillos_por_pieza[base] = gate_tornillos(w, piece, base, decl, args.hoy)
            elif fuente_t:
                tornillos_sin_pieza = fuente_t
            else:
                _aviso_sin_tornillos(piece, base)

    # tornillos declarados que ninguna pieza tomo: NO MEDIDO (antes de crear la carpeta destino)
    if "tornillos" not in args.skip_gate and tornillos_sin_pieza and not tornillos_por_pieza:
        tornillos_por_pieza["(ninguna pieza)"] = _tornillos_sin_pieza(tornillos_sin_pieza, args.pieces, args.hoy)

    # GATE BARRIDO (3d, 23/10/2026): una vez por entrega, despues de los gates por pieza y antes de crear la carpeta
    # destino. Sin movimiento declarado, el indicio de un perno coaxial en dos solidos avisa «¿se mueve?» y no frena.
    barrido_res = None
    if "barrido" not in args.skip_gate:
        mov, fuente = _movimiento(w, args.movimiento)
        if mov:
            barrido_res = gate_barrido(w, mov, fuente, args.pieces, args.hoy)
        elif fuente and len(str(fuente).strip()) >= 10:
            print("  [GATE barrido] sin movimiento declarado: %s (params.sin_movimiento)" % fuente)
            barrido_res = {"modo": "sin_movimiento", "medido": False, "motivo": fuente}
        else:
            try:
                coax = coaxiales(args.pieces)
            except Exception as e:  # el indicio nunca rompe una entrega
                coax = []
                print("  (no se pudieron revisar los ejes compartidos: %s: %s)" % (type(e).__name__, e))
            if coax:
                c = coax[0]
                print("  AVISO [GATE barrido] ¿se mueve? %d par(es) de solidos comparten un eje (perno coaxial): %s y "
                      "%s en (%s) dir (%s). Si se mueve: declarar el movimiento (--movimiento <conjunto.json> o "
                      "params.movimiento) y correr barrido.py; si no se mueve: params.sin_movimiento con el motivo."
                      % (len(coax), c["solidos"][0], c["solidos"][1], ", ".join("%g" % x for x in c["punto"]),
                         ", ".join("%g" % x for x in c["dir"])))
                barrido_res = {"modo": "aviso", "medido": False, "se_mueve": coax}

    # GATE FASES (3f, 24/10/2026): una vez por entrega, despues del barrido y antes de crear la carpeta destino.
    fases_res = None
    if "fases" not in args.skip_gate:
        fases_res = gate_fases(w, args.pieces, args.hoy)

    # ---- export + entrega ----
    os.makedirs(args.deliver, exist_ok=True)
    delivered = []
    for piece in args.pieces:
        base = os.path.splitext(os.path.basename(piece))[0]
        stl = os.path.join(os.path.dirname(piece) or ".", base + ".stl")
        _stl_export(piece, stl, args.stl_lc, args.stl_curvature)
        n_step = _contar_solidos(piece)
        n_decl = declarados.get(base)
        if n_decl is None:
            tope = 1
        elif n_decl != n_step:
            raise SystemExit(
                "[GATE cuerpos] Se declaro --ensamble %s:%d pero el STEP tiene %d solidos.\n"
                "El que declara no esta mirando la misma pieza: revisar cual es el archivo."
                % (base, n_decl, n_step))
        else:
            tope = n_decl
        m = gate_validez_cuerpos(stl, base, tope)
        cuerpos_por_pieza[base] = {"solidos_step": n_step, "techo_declarado": tope,
                                   "cuerpos_stl": len(stl_cuerpos(stl)[1])}
        _aviso_frame_impresion(base, m)
        outs = [piece, stl]
        if args.glb:
            envcheck.require(("trimesh",))
            import trimesh
            glb = os.path.join(os.path.dirname(piece) or ".", base + ".glb")
            trimesh.load(stl).export(glb)
            outs.append(glb)
        for f in outs:
            # copy2 y no copy: G-E2 compara las fechas de la carpeta de entrega para ver si
            # el PDF y el STEP son de la misma corrida. Con copy (que pone la hora de la
            # copia) el STEP quedaba siempre mas nuevo -- se copia despues, a proposito --
            # y el gate no podia dar verde nunca. Conservando la fecha del original compara
            # cuando se CONSTRUYO cada cosa, que es lo que dice medir.
            shutil.copy2(f, args.deliver)
            delivered.append(os.path.basename(f))
            # Cabecera STEP en el orden de ISO 10303-21 (tanda 2, 17/10/2026): OpenCASCADE 7.8 escribe FILE_NAME
            # antes que FILE_DESCRIPTION y CATIA V5 lee ese archivo VACIO sin avisar. Se arregla la COPIA que se
            # entrega (conservando su fecha, por G-E2) y se vuelve a LEER: se verifica el archivo que se entrega.
            if f.lower().endswith((".step", ".stp")):
                dst = os.path.join(args.deliver, os.path.basename(f))
                # si la cabecera no se puede leer o arreglar (le falta una entidad o HEADER;), la entrega SIGUE con un
                # aviso, como antes de este paso (revisor por API del 18/10: abortaba con un traceback)
                try:
                    cambio, orden = step_cabecera.arreglar_archivo(dst)
                except (OSError, ValueError) as e:
                    print("  AVISO cabecera STEP de %s: no se pudo arreglar (%s); se entrega como estaba"
                          % (os.path.basename(f), e))
                    cambio, orden = False, None
                o = step_cabecera.orden_de_archivo(dst)
                if o is None:
                    print("  AVISO cabecera STEP de %s: no se encontro una cabecera completa para revisar"
                          % os.path.basename(f))
                elif o != step_cabecera.CLAVES:
                    raise SystemExit("[GATE cabecera STEP] %s quedo con la cabecera fuera de orden" % dst)
                if cambio:
                    print("  cabecera STEP de %s reordenada (tenia %s; ISO 10303-21)"
                          % (os.path.basename(f), ", ".join(orden)))
        print("entregado: %s (%s)" % (base, ", ".join(os.path.splitext(x)[1] for x in outs)))

    # ---- GATE DE ENTREGABLE: solo la entrega que va a Fak ----
    # Va DESPUES de copiar a proposito: juzga la carpeta como la va a recibir Fak, con el
    # PDF y el video adentro. Si sale rojo, los archivos quedan pero la entrega NO se
    # certifica: no se escribe la evidencia y el script sale con codigo 1.
    if args.final and "entregable" not in args.skip_gate:
        print("")
        import gate_entregable
        if gate_entregable.verificar(args.deliver, args.motor, args.render, workdir_path=w) != 0:
            raise SystemExit(
                "\n[GATE entregable] La carpeta tiene los archivos pero NO esta certificada.\n"
                "Corregir lo de arriba y volver a correr con --final. La entrega no queda registrada.")

    # La evidencia de entrega guarda, por pieza, los solidos del STEP, el techo que se
    # DECLARO y los cuerpos que tenia el STL entregado. Sin esos tres numeros el manifest
    # no deja rastro auditable de con que criterio paso el gate de cuerpos, que es
    # justamente el que se aflojo y se volvio a apretar el 03/09.
    workdir.record_evidence(w, "delivery", dest=args.deliver, files=delivered,
                            final=bool(args.final),
                            cuerpos_por_pieza=cuerpos_por_pieza,
                            cantos_por_pieza=cantos_por_pieza,
                            barrido=barrido_res,
                            tornillos_por_pieza=tornillos_por_pieza,
                            fases=fases_res,
                            ensambles_declarados=args.ensamble,
                            skipped_gates=args.skip_gate, reason=args.reason)
    print("\nENTREGA OK -> %s (%d archivos). Evidencia registrada en el manifest." % (args.deliver, len(delivered)))
    if not args.final:
        print("OJO: esto es una entrega de TRABAJO. La que va a Fak se corre con --final "
              "--motor <motor> --render <png...>, que ademas exige PDF + simulacion grabada.")
    print("Ultimo paso humano: ABRIR los archivos y mirarlos (regla verify-before-close).")


if __name__ == "__main__":
    main()
