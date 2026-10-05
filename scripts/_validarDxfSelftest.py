#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Self-test de scripts/_validarDxf.py — casos MALOS que tienen que ser rechazados.

    .venv-cad/Scripts/python.exe scripts/_validarDxfSelftest.py
    .venv-cad/Scripts/python.exe scripts/_validarDxfSelftest.py --con-autocad

Geometria sintetica (cuadrados). Nada de datos de piezas reales: el repo es publico.

El caso 1 es el que rompio la entrega del 2026-08-06 (AutoCAD: Duplicate name "BYBLOCK"
in Linetype symbol table) y el caso 2 es el error INVERSO en el que cai al arreglarlo
(AutoCAD: Missing Default entry ByLayer in SymbolTable:LTYPE). Los dos tienen que estar
cubiertos: la regla es asimetrica segun la version del DXF.
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ezdxf  # noqa: E402

from _validarDxf import (  # noqa: E402
    Dxf,
    DxfInvalido,
    chequeos_estaticos,
    normalizar,
    audit_autocad,
)

CUADRADO = [(0, 0), (100, 0), (100, 50), (0, 50)]


def _base(version: str, path: str) -> str:
    doc = ezdxf.new(version)
    doc.layers.add("CORTE", color=1)
    msp = doc.modelspace()
    if version == "R12":
        # R12 no tiene LWPOLYLINE: va POLYLINE + VERTEX, igual que los moldes reales
        pl = msp.add_polyline2d(CUADRADO, close=True, dxfattribs={"layer": "CORTE"})
        assert pl is not None
    else:
        msp.add_lwpolyline(CUADRADO, close=True, dxfattribs={"layer": "CORTE"})
    doc.saveas(path)
    return path


def _sin_ltype(path: str, salida: str) -> str:
    """Saca ByBlock/ByLayer de la tabla LTYPE a nivel de texto."""
    d = Dxf(path)
    lineas = list(d.lineas)
    rangos = [
        (e["linea_ini"], e["linea_fin"])
        for e in d.tablas.get("LTYPE", [])
        if e["nombre"] and e["nombre"].upper() in {"BYBLOCK", "BYLAYER"}
    ]
    for ini, fin in sorted(rangos, reverse=True):
        del lineas[ini:fin]
    with open(salida, "wb") as fh:
        fh.write((d.nl.join(lineas) + d.nl).encode("cp1252", errors="replace"))
    return salida


def _sacar_eje_z(path: str, salida: str) -> str:
    """Deja $EXTMIN/$EXTMAX con solo 10/20, como los DXF 2D."""
    d = Dxf(path)
    lineas = list(d.lineas)
    for nombre in ("$EXTMAX", "$EXTMIN"):  # de atras para adelante, no corre indices
        i = next(k for k in range(0, len(lineas) - 1, 2)
                 if lineas[k].strip() == "9" and lineas[k + 1].strip() == nombre)
        # el 30 y su valor son las lineas i+6 e i+7
        assert lineas[i + 6].strip() == "30", f"{nombre} no tiene eje Z donde esperaba"
        del lineas[i + 6:i + 8]
    with open(salida, "wb") as fh:
        fh.write((d.nl.join(lineas) + d.nl).encode("cp1252", errors="replace"))
    return salida


def _renombrar_capa_en_tabla(path: str, salida: str, viejo: str, nuevo: str) -> str:
    """Renombra la capa SOLO en la tabla LAYER; las entidades siguen apuntando al nombre
    viejo. Trabaja sobre la lista de lineas (no sobre el texto crudo: con CRLF un replace
    de texto no engancha y el caso pasaba sin modificar nada)."""
    d = Dxf(path)
    lineas = list(d.lineas)
    entrada = next(e for e in d.tablas["LAYER"] if e["nombre"] == viejo)
    for i in range(entrada["linea_ini"], entrada["linea_fin"]):
        if lineas[i].strip() == "2" and lineas[i + 1].strip() == viejo:
            lineas[i + 1] = nuevo
            break
    else:
        raise AssertionError(f"no encontre la capa {viejo} en la tabla LAYER")
    with open(salida, "wb") as fh:
        fh.write((d.nl.join(lineas) + d.nl).encode("cp1252", errors="replace"))
    return salida


def _fallas(path: str) -> list[str]:
    try:
        return chequeos_estaticos(Dxf(path))
    except DxfInvalido as exc:
        return [str(exc)]


def main() -> int:
    con_autocad = "--con-autocad" in sys.argv
    fallidos: list[str] = []

    def malo(nombre: str, path: str, texto_esperado: str) -> None:
        f = _fallas(path)
        hit = any(texto_esperado.lower() in x.lower() for x in f)
        print(f"  [{'OK ' if hit else 'MAL'}] rechaza {nombre}")
        if not hit:
            print(f"        esperaba algo con {texto_esperado!r}, obtuve: {f}")
            fallidos.append(nombre)

    def bueno(nombre: str, path: str) -> None:
        f = _fallas(path)
        print(f"  [{'OK ' if not f else 'MAL'}] acepta  {nombre}")
        if f:
            print(f"        no deberia tener fallas y tiene: {f}")
            fallidos.append(nombre)

    with tempfile.TemporaryDirectory() as tmp:
        p = lambda n: os.path.join(tmp, n)  # noqa: E731

        print("== casos que tienen que ser RECHAZADOS")

        # 1) el bug real del 06/08: R12 escrito por ezdxf, con ByBlock/ByLayer en LTYPE
        r12 = _base("R12", p("r12_ezdxf.dxf"))
        malo("R12 con ByBlock/ByLayer en LTYPE", r12, "nombres reservados")

        # 2) el error inverso, en el que cai al arreglar: R2013 SIN esas entradas
        r13 = _base("R2013", p("r2013.dxf"))
        malo("R2013 sin ByBlock/ByLayer", _sin_ltype(r13, p("r2013_pelado.dxf")),
             "entradas obligatorias")

        # 3) extents sin calcular (lo que deja ezdxf cuando no se los pide)
        malo("extents 1e+20", r13, "sin calcular")

        # 4) entidad en una capa que no existe en la tabla LAYER
        malo("capa colgada",
             _renombrar_capa_en_tabla(r13, p("capa_colgada.dxf"), "CORTE", "NO_EXISTE"),
             "layer inexistente")

        # 5) nombre de capa con caracteres que AutoCAD no acepta
        malo("capa con caracter ilegal",
             _renombrar_capa_en_tabla(r13, p("capa_ilegal.dxf"), "CORTE", "COR:TE"),
             "caracteres ilegales")

        # 6) archivo cortado a la mitad
        crudo = open(r13, "rb").read()
        with open(p("truncado.dxf"), "wb") as fh:
            fh.write(crudo[: len(crudo) // 2])
        malo("archivo truncado", p("truncado.dxf"), "eof")

        print("== casos que tienen que ser ACEPTADOS")

        # normalizar el caso 1 tiene que dejarlo limpio, sin tocar la geometria
        fix = p("r12_fix.dxf")
        log = normalizar(r12, fix)
        assert any("ENTITIES" in l for l in log), "normalizar no verifico la geometria"
        bueno("R12 normalizado", fix)

        # y normalizar un R2013 NO tiene que sacarle las entradas obligatorias
        fix13 = p("r2013_fix.dxf")
        normalizar(r13, fix13)
        bueno("R2013 normalizado", fix13)

        # $EXTMIN/$EXTMAX de 2 ejes (DXF 2D): escribir un tercero a ciegas pisaba la
        # variable siguiente del HEADER y corrompia el archivo en silencio
        dos_ejes = _sacar_eje_z(r13, p("r2013_2ejes.dxf"))
        fix2 = p("r2013_2ejes_fix.dxf")
        log2 = normalizar(dos_ejes, fix2)
        assert any("2 ejes" in l for l in log2), f"no detecto los 2 ejes: {log2}"
        d_antes, d_desp = Dxf(dos_ejes), Dxf(fix2)
        ok = list(d_antes.header) == list(d_desp.header) and all(
            [c for c, _ in d_antes.header[v]] == [c for c, _ in d_desp.header[v]]
            for v in d_antes.header
        )
        print(f"  [{'OK ' if ok else 'MAL'}] normaliza extents de 2 ejes sin romper el HEADER")
        if not ok:
            fallidos.append("extents de 2 ejes")

        if con_autocad:
            print("== capa real: AutoCAD tiene que abrir los normalizados y rechazar el roto")
            import _validarDxf as _real
            memoria_de_verdad = _real.MEMORIA_AUDIT
            _real.MEMORIA_AUDIT = p("memoria-de-la-prueba.json")    # la prueba no lee ni ensucia la memoria de verdad
            try:
                for nombre, path, esperado in (
                    ("R12 normalizado", fix, True),
                    ("R2013 normalizado", fix13, True),
                    ("R2013 sin ByLayer", p("r2013_pelado.dxf"), False),
                ):
                    paso, det = audit_autocad(path)
                    ok = paso is esperado
                    print(f"  [{'OK ' if ok else 'MAL'}] AutoCAD {'abre' if esperado else 'rechaza'} {nombre}")
                    if not ok:
                        print(f"        {det}")
                        fallidos.append("autocad:" + nombre)
                # el camino de verdad de la memoria: el mismo archivo, la segunda vez, no abre AutoCAD
                paso, det = audit_autocad(fix13)
                ok = paso and "ya audito estos mismos bytes" in det
                print(f"  [{'OK ' if ok else 'MAL'}] la segunda vez sobre el mismo R2013 no abre AutoCAD")
                if not ok:
                    print(f"        {det}")
                    fallidos.append("autocad:memoria")
            finally:
                _real.MEMORIA_AUDIT = memoria_de_verdad
        else:
            print("== capa real SALTEADA (correr con --con-autocad; tarda unos 10 a 20 s en total)")

    # ── la memoria del AUDIT: los mismos bytes no se vuelven a abrir; otros bytes, un AUDIT con errores o --sin-memoria, si.
    # Sin AutoCAD de verdad: se cuenta cuantas veces se lo llama (el programa de mentira contesta lo que AutoCAD imprime).
    # Los casos de la segunda mitad salen de la auditoria independiente del 04/10/2026 (6 de 11 cambios malos puestos a
    # proposito pasaban en verde).
    print("== memoria del AUDIT (sin abrir AutoCAD: se cuentan las llamadas)")
    import contextlib
    import io
    import json
    import subprocess

    import _validarDxf as V
    CERO = "Total errors found 0 fixed 0\n"
    llamadas = {"n": 0, "salida": CERO, "antes": None, "tira": None}

    class _Falso:
        def __init__(self, texto: str) -> None:
            self.stdout = texto.encode("utf-16-le")

    def _correr_falso(*_a, **_k):
        llamadas["n"] += 1
        if llamadas["antes"]:
            llamadas["antes"]()
        if llamadas["tira"]:
            raise llamadas["tira"]
        return _Falso(llamadas["salida"])

    def _escribir(ruta: str, contenido: bytes) -> str:
        with open(ruta, "wb") as fh:
            fh.write(contenido)
        return ruta

    def _callado(funcion, *a):
        """Corre sin imprimir. Devuelve (resultado, excepcion, lo que imprimio)."""
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            try:
                return funcion(*a), None, buf.getvalue()
            except Exception as exc:  # noqa: BLE001
                return None, exc, buf.getvalue()

    guardado = (V.subprocess.run, V.MEMORIA_AUDIT, V.USAR_MEMORIA, V.ACCORECONSOLE)
    with tempfile.TemporaryDirectory() as tmpm:
        try:
            V.subprocess.run = _correr_falso
            V.MEMORIA_AUDIT = os.path.join(tmpm, "memoria.json")
            V.USAR_MEMORIA = True
            # «el programa» es uno de mentira en una carpeta propia: asi la prueba puede cambiarle el tamano, la fecha y los DLL
            motor = os.path.join(tmpm, "autocad")
            os.makedirs(motor)
            V.ACCORECONSOLE = _escribir(os.path.join(motor, "accoreconsole.exe"), b"v1")
            a1 = _escribir(os.path.join(tmpm, "a.dxf"), b"uno")

            def caso(nombre: str, hacer, esperadas: int) -> None:
                antes = llamadas["n"]
                hacer()
                ok = llamadas["n"] - antes == esperadas
                print(f"  [{'OK ' if ok else 'MAL'}] {nombre}")
                if not ok:
                    print(f"        esperaba {esperadas} llamada(s) a AutoCAD y hubo {llamadas['n'] - antes}")
                    fallidos.append("memoria:" + nombre)

            def comprobar(nombre: str, ok: bool, nota: str = "") -> None:
                print(f"  [{'OK ' if ok else 'MAL'}] {nombre}")
                if not ok:
                    if nota:
                        print(f"        {nota}")
                    fallidos.append("memoria:" + nombre)

            caso("la primera vez audita", lambda: V.audit_autocad(a1), 1)
            caso("los mismos bytes no se vuelven a abrir", lambda: V.audit_autocad(a1), 0)
            paso, det = V.audit_autocad(a1)
            comprobar("el aviso de la memoria dice que no se abrio", paso and "ya audito estos mismos bytes" in det, repr(det))
            copia = _escribir(os.path.join(tmpm, "copia con otro nombre.dxf"), b"uno")
            caso("una copia con otro nombre (mismos bytes) tampoco", lambda: V.audit_autocad(copia), 0)
            _escribir(a1, b"dos")
            caso("si cambia un byte, audita de nuevo", lambda: V.audit_autocad(a1), 1)
            V.USAR_MEMORIA = False
            caso("con --sin-memoria audita siempre", lambda: V.audit_autocad(a1), 1)
            V.USAR_MEMORIA = True
            malo_dxf = _escribir(os.path.join(tmpm, "malo.dxf"), b"tres")
            llamadas["salida"] = "Total errors found 2 fixed 0\n"
            caso("un AUDIT con errores no se recuerda (1)", lambda: V.audit_autocad(malo_dxf), 1)
            caso("un AUDIT con errores no se recuerda (2)", lambda: V.audit_autocad(malo_dxf), 1)
            llamadas["salida"] = CERO
            _escribir(V.MEMORIA_AUDIT, b"{esto no es json")
            caso("con la memoria rota, audita (no se cae)", lambda: V.audit_autocad(copia), 1)
            _escribir(V.MEMORIA_AUDIT, b"[" * 200000)
            caso("con una memoria que no se puede leer por lo anidada, audita (no se cae)", lambda: V.audit_autocad(a1), 1)
            os.remove(V.MEMORIA_AUDIT)

            # -- lo que no es «0 errores» no se recuerda
            b1 = _escribir(os.path.join(tmpm, "b.dxf"), b"no-abre")
            llamadas["salida"] = "Invalid or incomplete DXF input -- drawing discarded.\n"
            caso("«AutoCAD no abrio» no se recuerda (1)", lambda: V.audit_autocad(b1), 1)
            caso("«AutoCAD no abrio» no se recuerda (2)", lambda: V.audit_autocad(b1), 1)
            llamadas["salida"], llamadas["tira"] = CERO, subprocess.TimeoutExpired("accoreconsole", 180)
            caso("«se colgo» no se recuerda (1)", lambda: V.audit_autocad(b1), 1)
            caso("«se colgo» no se recuerda (2)", lambda: V.audit_autocad(b1), 1)
            llamadas["tira"], llamadas["salida"] = None, "Total errors found 3 fixed 3\n"
            paso, _ = V.audit_autocad(b1)
            comprobar("«3 encontrados, 3 arreglados» es FALLA y no se recuerda", paso is False and not V._leer_memoria())
            llamadas["salida"] = CERO

            # -- la clave es del archivo Y del AutoCAD que lo juzga (el .exe y los DLL del motor)
            c1 = _escribir(os.path.join(tmpm, "c.dxf"), b"cuatro")
            V.audit_autocad(c1)
            comprobar("la clave lleva el programa que audita", V.ACCORECONSOLE in (V._clave_de_memoria(c1) or ""))
            _escribir(V.ACCORECONSOLE, b"v2-mas-largo")
            caso("si cambia el tamano del programa, audita de nuevo", lambda: V.audit_autocad(c1), 1)
            os.utime(V.ACCORECONSOLE, (1_700_000_500, 1_700_000_500))
            caso("si cambia la fecha del programa, audita de nuevo", lambda: V.audit_autocad(c1), 1)
            _escribir(os.path.join(motor, "accore.dll"), b"motor-1")
            caso("si aparece o cambia accore.dll, audita de nuevo", lambda: V.audit_autocad(c1), 1)
            _escribir(os.path.join(motor, "acdb25.dll"), b"base-1")
            caso("si aparece o cambia acdb25.dll, audita de nuevo", lambda: V.audit_autocad(c1), 1)
            _escribir(os.path.join(motor, "acdb25.dll"), b"base-2-parche")
            caso("un parche que toca solo el DLL, audita de nuevo", lambda: V.audit_autocad(c1), 1)
            caso("y con el mismo motor no se vuelve a abrir", lambda: V.audit_autocad(c1), 0)

            # -- AutoCAD juzga tambien el nombre: sin «.dxf» no se usa la memoria
            raro = _escribir(os.path.join(tmpm, "c.dxf.tmp"), b"cuatro")
            caso("los mismos bytes con un nombre que no termina en .dxf se auditan (1)", lambda: V.audit_autocad(raro), 1)
            caso("los mismos bytes con un nombre que no termina en .dxf se auditan (2)", lambda: V.audit_autocad(raro), 1)

            # -- --sin-memoria que da errores borra el OK viejo de esos bytes
            s1 = _escribir(os.path.join(tmpm, "s.dxf"), b"cinco")
            V.audit_autocad(s1)
            V.USAR_MEMORIA, llamadas["salida"] = False, "Total errors found 2 fixed 0\n"
            paso_forzado, _ = V.audit_autocad(s1)
            V.USAR_MEMORIA, llamadas["salida"] = True, CERO
            comprobar("--sin-memoria: AutoCAD dijo 2 errores sobre bytes que estaban recordados", paso_forzado is False)
            caso("y la corrida siguiente los vuelve a auditar (el OK viejo se borro)", lambda: V.audit_autocad(s1), 1)

            # -- si el archivo cambia entre la huella y el AUDIT, no se anota la huella de lo que AutoCAD no vio
            t1 = _escribir(os.path.join(tmpm, "t.dxf"), b"version-A")
            llamadas["antes"] = lambda: _escribir(t1, b"version-B")
            V.audit_autocad(t1)
            llamadas["antes"] = None
            _escribir(t1, b"version-A")
            caso("un archivo pisado mientras AutoCAD lo auditaba no queda recordado", lambda: V.audit_autocad(t1), 1)

            # -- el tope: se van las primeras anotadas y entra la nueva
            with open(V.MEMORIA_AUDIT, "w", encoding="utf-8") as fh:
                json.dump({f"k{i:03d}": "x" for i in range(V._TOPE_MEMORIA + 50)}, fh)
            V._anotar_en_memoria("nueva")
            d = V._leer_memoria()
            comprobar("con el tope pasado quedan las ultimas y entra la nueva",
                      len(d) == V._TOPE_MEMORIA and "k000" not in d and "k051" in d and list(d)[-1] == "nueva",
                      f"quedaron {len(d)}; primera {list(d)[0]}; ultima {list(d)[-1]}")
            os.remove(V.MEMORIA_AUDIT)

            # -- la memoria ahorra abrir AutoCAD, no el chequeo estatico ni el gate de entrega
            doc = ezdxf.new("R2013")
            doc.layers.add("CORTE", color=1)
            doc.modelspace().add_lwpolyline(CUADRADO, close=True, dxfattribs={"layer": "CORTE"})
            malo_estatico = os.path.join(tmpm, "falla el estatico.dxf")
            doc.saveas(malo_estatico)
            V.audit_autocad(malo_estatico)                       # el AUDIT de mentira da 0 y queda recordado
            antes = llamadas["n"]
            resultado, exc, salida = _callado(V.validar, malo_estatico)
            comprobar("validar(): con el AUDIT de la memoria, el que falla el estatico sigue en NO ENTREGAR",
                      llamadas["n"] == antes and resultado is False and exc is None and "NO ENTREGAR" in salida
                      and "ya audito estos mismos bytes" in salida, salida[-400:])
            destino = os.path.join(tmpm, "entregado.dxf")
            _, exc, _ = _callado(V.entregar_dxf, malo_estatico, destino)
            comprobar("entregar_dxf(): no copia el que falla el estatico aunque el AUDIT este en la memoria",
                      isinstance(exc, V.EntregaRechazada) and not os.path.exists(destino), repr(exc))
            bueno = os.path.join(tmpm, "bueno.dxf")
            _callado(V.normalizar, malo_estatico, bueno)
            V.audit_autocad(bueno)
            antes = llamadas["n"]
            _, exc, salida = _callado(V.entregar_dxf, bueno, destino)
            comprobar("entregar_dxf(): el bueno se copia sin volver a abrir AutoCAD y el reporte lo dice",
                      exc is None and llamadas["n"] == antes and os.path.exists(destino) and "no se volvio a abrir" in salida,
                      f"{exc!r} · {salida[-300:]}")
            llamadas["salida"] = "Total errors found 4 fixed 0\n"
            malo_audit = os.path.join(tmpm, "falla el audit.dxf")
            _callado(V.normalizar, malo_estatico, malo_audit)
            with open(malo_audit, "ab") as fh:
                fh.write(b"\n")                                  # otros bytes: no estan en la memoria
            os.remove(destino)
            _, exc, _ = _callado(V.entregar_dxf, malo_audit, destino)
            comprobar("entregar_dxf(): no copia el que AutoCAD rechaza",
                      isinstance(exc, V.EntregaRechazada) and not os.path.exists(destino), repr(exc))
            llamadas["salida"] = CERO
        finally:
            V.subprocess.run, V.MEMORIA_AUDIT, V.USAR_MEMORIA, V.ACCORECONSOLE = guardado

    print()
    if fallidos:
        print(f"SELFTEST FALLADO: {fallidos}")
        return 1
    print("SELFTEST OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
