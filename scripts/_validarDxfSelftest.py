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

        if con_autocad:
            print("== capa real: AutoCAD tiene que abrir los normalizados y rechazar el roto")
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
        else:
            print("== capa real SALTEADA (correr con --con-autocad; tarda ~40 s por archivo)")

    print()
    if fallidos:
        print(f"SELFTEST FALLADO: {fallidos}")
        return 1
    print("SELFTEST OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
