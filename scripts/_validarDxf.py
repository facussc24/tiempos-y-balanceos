#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Validar / normalizar un DXF antes de entregarlo.

POR QUE EXISTE
--------------
El 2026-08-06 entregue 3 DXF de moldes de corte escritos con ezdxf y los "verifique"
releyendolos con ezdxf — la misma libreria que los habia escrito. AutoCAD 2026 no los
abria ("invalid name"): ezdxf agrega a la tabla LTYPE las entradas `ByBlock` y `ByLayer`,
que para AutoCAD son nombres RESERVADOS y aparecen como duplicados:

    Duplicate name "BYBLOCK" in Linetype symbol table.
    Duplicate name "BYLAYER" in Linetype symbol table.

Fak descubrio los archivos rotos en produccion. Regla que sale de ahi:
**el que dice si un DXF sirve es AutoCAD, no la libreria que lo genero.**

USO
---
    .venv-cad/Scripts/python.exe scripts/_validarDxf.py <archivo.dxf> [...]
        Valida. Exit 0 = apto para entregar. Exit 1 = NO entregar.

    .venv-cad/Scripts/python.exe scripts/_validarDxf.py <entrada.dxf> --normalizar <salida.dxf>
        Saca los artefactos de ezdxf y recalcula los extents. No toca la geometria:
        las secciones ENTITIES y BLOCKS quedan byte por byte iguales (se verifica).

    --sin-autocad   salta el AUDIT real (solo para depurar; NO alcanza para entregar)

QUE CHEQUEA
-----------
Capa estatica (rapida, sin AutoCAD):
  1. `ByBlock`/`ByLayer` en LTYPE. **La regla es ASIMETRICA y hay que respetar las dos
     puntas**: en R12 (AC1009) estan PROHIBIDAS (nombres reservados) y en R13+ son
     OBLIGATORIAS. Sacarlas de un R2013 hace que AutoCAD descarte el dibujo entero
     ("Missing Default entry ByLayer in SymbolTable:LTYPE") — me paso al "arreglar" uno.
  2. Nombres de tabla con caracteres ilegales para AutoCAD  (< > / \\ " : ; ? * | , = `).
     El `*` inicial de los nombres internos (*Model_Space, *Active, *U3) SI es legal.
  3. $EXTMIN/$EXTMAX calculados (no el 1e+20 / -1e+20 que deja ezdxf sin calcular).
  4. Capas / linetypes / estilos referenciados por entidades que no existen en su tabla.
  5. El archivo termina en EOF y los pares (codigo, valor) cierran.

NO se chequea el conteo declarado de la tabla (codigo 70) contra las entradas reales: por
spec es la cantidad MAXIMA que puede seguir, no la exacta — los propios archivos de AutoCAD
declaran 5 y traen 3. Chequearlo por igualdad daba falso positivo en el caso de control.

Capa real (la que vale):
  7. accoreconsole.exe de AutoCAD abre el archivo y AUDIT devuelve
     "Total errors found 0". Si AutoCAD no lo abre limpio, esto FALLA.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile

ACCORECONSOLE = r"C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe"

# Nombres que ezdxf mete en la tabla LTYPE y que AutoCAD rechaza como duplicados
LTYPE_RESERVADOS = {"BYBLOCK", "BYLAYER"}

# Caracteres que AutoCAD no acepta en un nombre de tabla
CARACTERES_ILEGALES = set('<>/\\":;?*|,=`')

# Marcadores de extents sin calcular que deja ezdxf
_EXT_SIN_CALCULAR = (1e19, -1e19)

# Limite clasico de Windows para la ruta completa (MAX_PATH 260, contando el NUL).
# Explorer MUESTRA bien archivos mas alla de esto, pero al hacer DOBLE CLICK el shell
# TRUNCA la ruta en 259 caracteres: el nombre se corta, se pierde la extension .dxf y
# Windows abre el cartel "Seleccione una aplicacion para abrir <nombre cortado>".
# AutoCAD, cuando recibe eso, contesta "invalid name".
#
# Medido el 2026-08-10 sobre dos carpetas reales, y la cuenta cierra clavada en las dos:
# con la carpeta en 240 caracteres el nombre queda en 19 (240+19 = 259); con la carpeta en
# 246 queda en 14 (246+14 = 260). El MISMO archivo (mismo MD5) copiado a C:\tmp\ abre con
# doble click. Le pasa a CUALQUIER archivo de esa carpeta: no depende del contenido.
# Ojo: el limite es del SHELL. Pasarle el archivo directo al .exe (o a accoreconsole, o a
# Python) FUNCIONA aunque la ruta mida 300+ — por eso una verificacion headless puede dar
# verde mientras el usuario no lo puede abrir. Hay que probar el camino que usa el.
MAX_PATH_WINDOWS = 259


class DxfInvalido(Exception):
    """El DXF no esta en condiciones de entregarse."""


# --------------------------------------------------------------------------- lectura


def _leer_lineas(path: str) -> tuple[list[str], str]:
    """Devuelve (lineas sin terminador, terminador detectado)."""
    with open(path, "rb") as fh:
        crudo = fh.read()
    nl = "\r\n" if b"\r\n" in crudo[:4096] else "\n"
    texto = crudo.decode("cp1252", errors="replace")
    lineas = texto.split(nl)
    if lineas and lineas[-1] == "":
        lineas.pop()
    return lineas, nl


def _pares(lineas: list[str]) -> list[tuple[int, str, int]]:
    """[(codigo, valor, indice de la linea del codigo)] — tolera basura al final."""
    out: list[tuple[int, str, int]] = []
    for i in range(0, len(lineas) - 1, 2):
        cru = lineas[i].strip()
        if not re.fullmatch(r"-?\d+", cru):
            raise DxfInvalido(
                f"linea {i + 1}: se esperaba un codigo de grupo numerico y hay {lineas[i]!r}"
            )
        out.append((int(cru), lineas[i + 1], i))
    return out


class Dxf:
    """Vista minima de un DXF a nivel de etiquetas, sin re-serializar nada."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lineas, self.nl = _leer_lineas(path)
        self.pares = _pares(self.lineas)
        self.header: dict[str, list[tuple[int, str]]] = {}
        self.tablas: dict[str, list[dict]] = {}
        self.tabla_conteo: dict[str, tuple[int, int]] = {}  # nombre -> (declarado, indice linea)
        self.refs: dict[str, dict[str, int]] = {"layer": {}, "ltype": {}, "style": {}}
        self.secciones: list[str] = []
        self._parsear()

    def _parsear(self) -> None:
        sect = None
        tabla = None
        entrada: dict | None = None
        for k, (c, v, li) in enumerate(self.pares):
            if c == 0 and v == "SECTION":
                sect = self.pares[k + 1][1].strip()
                self.secciones.append(sect)
                continue
            if sect == "HEADER" and c == 9:
                nombre = v.strip()
                vals: list[tuple[int, str]] = []
                for c2, v2, _ in self.pares[k + 1:]:
                    if c2 == 9 or c2 == 0:
                        break
                    vals.append((c2, v2))
                self.header[nombre] = vals
                continue
            if sect == "TABLES":
                if c == 0 and v == "TABLE":
                    tabla = self.pares[k + 1][1].strip()
                    self.tablas.setdefault(tabla, [])
                    for c2, v2, li2 in self.pares[k + 2:]:
                        if c2 == 70:
                            self.tabla_conteo[tabla] = (int(float(v2.strip())), li2 + 1)
                            break
                        if c2 == 0:
                            break
                    continue
                if c == 0 and v == "ENDTAB":
                    tabla = None
                    entrada = None
                    continue
                if c == 0 and tabla and v.strip() == tabla:
                    entrada = {"nombre": None, "linea_ini": li, "linea_fin": None}
                    self.tablas[tabla].append(entrada)
                    continue
                if entrada is not None and c == 2 and entrada["nombre"] is None:
                    entrada["nombre"] = v.strip()
                    continue
            if sect in ("ENTITIES", "BLOCKS"):
                if c == 8:
                    self.refs["layer"][v.strip().upper()] = self.refs["layer"].get(v.strip().upper(), 0) + 1
                elif c == 6:
                    self.refs["ltype"][v.strip().upper()] = self.refs["ltype"].get(v.strip().upper(), 0) + 1
                elif c == 7:
                    self.refs["style"][v.strip().upper()] = self.refs["style"].get(v.strip().upper(), 0) + 1

        # cerrar el rango de cada entrada de tabla
        for nombre, entradas in self.tablas.items():
            for i, e in enumerate(entradas):
                if i + 1 < len(entradas):
                    e["linea_fin"] = entradas[i + 1]["linea_ini"]
                else:
                    e["linea_fin"] = self._linea_endtab(e["linea_ini"])

    def _linea_endtab(self, desde: int) -> int:
        for c, v, li in self.pares:
            if li >= desde and c == 0 and v == "ENDTAB":
                return li
        return len(self.lineas)

    # ------------------------------------------------------------------ auxiliares

    @property
    def version(self) -> str:
        v = self.header.get("$ACADVER", [])
        return v[0][1].strip() if v else "?"

    def nombres(self, tabla: str) -> list[str]:
        return [e["nombre"] for e in self.tablas.get(tabla, []) if e["nombre"] is not None]

    def indice_seccion(self, nombre: str) -> int | None:
        for k, (c, v, li) in enumerate(self.pares):
            if c == 0 and v == "SECTION" and self.pares[k + 1][1].strip() == nombre:
                return li
        return None

    def bytes_seccion(self, nombre: str) -> str:
        """Texto crudo de una seccion — para comparar geometria sin interpretarla."""
        ini = self.indice_seccion(nombre)
        if ini is None:
            return ""
        for c, v, li in self.pares:
            if li > ini and c == 0 and v == "ENDSEC":
                return self.nl.join(self.lineas[ini:li])
        return self.nl.join(self.lineas[ini:])

    def extents(self) -> tuple[list[float] | None, list[float] | None]:
        def leer(nombre):
            vals = self.header.get(nombre)
            if not vals:
                return None
            try:
                return [float(v.strip()) for c, v in vals if c in (10, 20, 30)]
            except ValueError:
                return None

        return leer("$EXTMIN"), leer("$EXTMAX")


# --------------------------------------------------------------------------- chequeos


def chequeos_estaticos(d: Dxf) -> list[str]:
    fallas: list[str] = []

    ltypes = [n.upper() for n in d.nombres("LTYPE")]
    # ByBlock/ByLayer en la tabla LTYPE son legales desde R13 (los archivos de AutoCAD
    # R2013 los traen). Solo en R12 (AC1009) son nombres reservados y AutoCAD los
    # rechaza como duplicados: ese es el bug que rompio los 2 moldes.
    if d.version == "AC1009":
        malos = [n for n in d.nombres("LTYPE") if n.upper() in LTYPE_RESERVADOS]
        if malos:
            fallas.append(
                f"tabla LTYPE de un R12 con nombres reservados {malos} -- AutoCAD los rechaza: "
                f'Duplicate name "{malos[0].upper()}" in Linetype symbol table'
            )
    else:
        # y al reves: desde R13 estas dos entradas son OBLIGATORIAS. Si faltan, AutoCAD dice
        # "Missing Default entry ByLayer in SymbolTable:LTYPE" y descarta el dibujo entero.
        faltan = sorted(LTYPE_RESERVADOS - set(ltypes))
        if faltan:
            fallas.append(
                f"tabla LTYPE de un {d.version} sin las entradas obligatorias {faltan} -- "
                "AutoCAD descarta el dibujo"
            )

    for tabla in ("LAYER", "LTYPE", "STYLE", "DIMSTYLE", "APPID", "BLOCK_RECORD", "VPORT"):
        for n in d.nombres(tabla):
            # los nombres internos de AutoCAD arrancan con * (*Model_Space, *Active, *U3):
            # son legales, el * solo es ilegal en medio del nombre
            ilegales = sorted(set(n.lstrip("*")) & CARACTERES_ILEGALES)
            if ilegales:
                fallas.append(f"tabla {tabla}: nombre {n!r} con caracteres ilegales {ilegales}")

    emin, emax = d.extents()
    if emin is None or emax is None:
        fallas.append("falta $EXTMIN o $EXTMAX en el HEADER")
    elif any(abs(v) >= _EXT_SIN_CALCULAR[0] for v in emin + emax):
        fallas.append(
            f"$EXTMIN/$EXTMAX sin calcular ({emin[0]:g} / {emax[0]:g}) -- "
            "el que importa el archivo dimensiona la hoja con esto"
        )

    layers = {n.upper() for n in d.nombres("LAYER")}
    styles = {n.upper() for n in d.nombres("STYLE")}
    for k, existentes, extra in (
        ("layer", layers, set()),
        ("ltype", set(ltypes), {"BYLAYER", "BYBLOCK"}),
        ("style", styles, set()),
    ):
        colgados = [n for n in d.refs[k] if n not in existentes and n not in extra]
        if colgados:
            fallas.append(f"entidades referencian {k} inexistente en su tabla: {colgados}")

    # OJO: el codigo 70 de una TABLE es "cantidad MAXIMA de entradas que pueden seguir",
    # no la cantidad exacta — los propios archivos de AutoCAD declaran 5 y traen 3.
    # Chequearlo por igualdad da falso positivo; por eso no se chequea.

    if not d.pares or d.pares[-1][1].strip() != "EOF":
        fallas.append("el archivo no termina en EOF (truncado?)")

    return fallas


def audit_autocad(path: str) -> tuple[bool, str]:
    """Abre el DXF con el motor de AutoCAD y corre AUDIT. (paso, salida)."""
    if not os.path.exists(ACCORECONSOLE):
        raise DxfInvalido(
            f"no encuentro accoreconsole.exe en {ACCORECONSOLE} — sin AutoCAD no se puede validar"
        )
    with tempfile.TemporaryDirectory() as tmp:
        scr = os.path.join(tmp, "audit.scr")
        with open(scr, "wb") as fh:
            fh.write(b"_AUDIT\r\nY\r\n_QUIT\r\nY\r\n")
        try:
            proc = subprocess.run(
                [ACCORECONSOLE, "/i", os.path.abspath(path), "/s", scr],
                capture_output=True,
                timeout=180,
                stdin=subprocess.DEVNULL,
            )
        except subprocess.TimeoutExpired:
            return False, "accoreconsole se colgo (>180 s)"
    salida = proc.stdout.decode("utf-16-le", errors="replace").replace("\r", "")
    m = re.search(r"Total errors found\s+(\d+)\s+fixed\s+(\d+)", salida)
    if not m:
        return False, "AutoCAD no llego a auditar el archivo (no abrio):\n" + _resumen(salida)
    errores = int(m.group(1))
    detalle = "\n".join(
        l for l in salida.splitlines()
        if re.search(r"Duplicate|Invalid|Total errors|Erased|error", l, re.I)
    )
    return errores == 0, detalle.strip()


def _resumen(salida: str) -> str:
    ruido = re.compile(
        r"CoreHeartBeat|Execution Path|Current Directory|Version Number|Copyright|"
        r"LogFilePath|menu utilities|Redirect stdout|StdOutConsoleMode|System Variable|"
        r"monitored system|^\s*$|^Command:\s*$"
    )
    return "\n".join(l for l in salida.splitlines() if not ruido.search(l))[:2000]


# ------------------------------------------------------------------------ normalizar


def _calcular_extents(path: str) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Extents reales, leidos con ezdxf (aca ezdxf solo MIDE, no escribe)."""
    import ezdxf
    from ezdxf import bbox

    doc = ezdxf.readfile(path)
    caja = bbox.extents(doc.modelspace(), fast=False)
    if not caja.has_data:
        raise DxfInvalido("no pude calcular los extents: el modelspace esta vacio")
    return tuple(caja.extmin), tuple(caja.extmax)


def normalizar(entrada: str, salida: str) -> list[str]:
    """Saca los artefactos de ezdxf y escribe los extents reales. Devuelve el log."""
    d = Dxf(entrada)
    log: list[str] = []
    lineas = list(d.lineas)
    borrar: list[tuple[int, int]] = []

    # OJO, esto es asimetrico y me equivoque una vez: en R12 (AC1009) ByBlock/ByLayer en la
    # tabla LTYPE son nombres reservados y AutoCAD rechaza el archivo por duplicados; desde
    # R13 son entradas OBLIGATORIAS y si se las saca AutoCAD tambien lo rechaza
    # ("Missing Default entry ByLayer in SymbolTable:LTYPE"). Solo se tocan en R12.
    if d.version == "AC1009":
        for e in d.tablas.get("LTYPE", []):
            if e["nombre"] and e["nombre"].upper() in LTYPE_RESERVADOS:
                borrar.append((e["linea_ini"], e["linea_fin"]))
                log.append(f'LTYPE {e["nombre"]!r}: entrada eliminada (reservada en R12)')
    else:
        faltan = LTYPE_RESERVADOS - {n.upper() for n in d.nombres("LTYPE")}
        if faltan:
            raise DxfInvalido(
                f"{d.version} sin las entradas obligatorias {sorted(faltan)} en LTYPE -- "
                "AutoCAD descarta el dibujo"
            )

    if borrar:
        declarado, li_conteo = d.tabla_conteo["LTYPE"]
        nuevo = declarado - len(borrar)
        lineas[li_conteo] = re.sub(r"-?\d+", str(nuevo), lineas[li_conteo], count=1)
        log.append(f"tabla LTYPE: conteo {declarado} -> {nuevo}")
        for ini, fin in sorted(borrar, reverse=True):
            del lineas[ini:fin]

    emin, emax = _calcular_extents(entrada)
    for nombre, vec in (("$EXTMIN", emin), ("$EXTMAX", emax)):
        if nombre not in d.header:
            continue
        # la posicion se busca sobre la lista YA recortada, no sobre la original
        base = _buscar_header(lineas, nombre)
        for j, comp in enumerate(vec[:3]):
            lineas[base + 1 + 2 * j] = f"{comp:.16g}"
        log.append(f"{nombre} = {vec[0]:.6f}, {vec[1]:.6f}, {vec[2]:.6f}")

    with open(salida, "wb") as fh:
        fh.write((d.nl.join(lineas) + d.nl).encode("cp1252", errors="replace"))

    # la geometria NO se toca: lo verifico comparando el texto crudo
    nuevo_doc = Dxf(salida)
    for sec in ("ENTITIES", "BLOCKS"):
        if d.bytes_seccion(sec) != nuevo_doc.bytes_seccion(sec):
            raise DxfInvalido(
                f"la seccion {sec} cambio al normalizar -- abortado, la geometria no se toca"
            )
    log.append("secciones ENTITIES y BLOCKS: identicas byte por byte")
    return log


def _buscar_header(lineas: list[str], nombre: str) -> int:
    for i in range(0, len(lineas) - 1, 2):
        if lineas[i].strip() == "9" and lineas[i + 1].strip() == nombre:
            return i + 2
    raise DxfInvalido(f"no encontre {nombre} en el HEADER")


# ------------------------------------------------------------------------------ cli


def validar(path: str, con_autocad: bool = True) -> bool:
    print(f"\n=== {os.path.basename(path)}")
    try:
        d = Dxf(path)
    except DxfInvalido as exc:
        print(f"  RECHAZADO: {exc}")
        return False
    print(f"  version {d.version}  secciones {d.secciones}")
    fallas = chequeos_estaticos(d)
    for f in fallas:
        print(f"  [estatico] {f}")
    if not fallas:
        print("  [estatico] OK")

    if con_autocad:
        paso, detalle = audit_autocad(path)
        etiqueta = "OK" if paso else "FALLA"
        print(f"  [AutoCAD AUDIT] {etiqueta}")
        for l in detalle.splitlines():
            print(f"      {l}")
        if not paso:
            fallas.append("AutoCAD AUDIT no dio 0 errores")
    else:
        print("  [AutoCAD AUDIT] SALTEADO -- esto NO alcanza para entregar")
        fallas.append("no se corrio el AUDIT de AutoCAD")

    print(f"  --> {'APTO PARA ENTREGAR' if not fallas else 'NO ENTREGAR'}")
    return not fallas


class EntregaRechazada(Exception):
    """El DXF no paso el gate. NO se copia al destino."""


def entregar_dxf(origen: str, destino: str, forzar: bool = False) -> str:
    """ENFORCEMENT DURO: copia el DXF al destino SOLO si AutoCAD lo abre limpio.

    Mismo criterio que `patronlib.entregar()` para los PLT: el gate no vive en la buena
    voluntad del que lo usa, vive en el unico camino que produce el entregable. Todo DXF
    que va al server, a un pendrive o a un mail pasa por aca.

    `forzar=True` solo con decision explicita de Fak.
    """
    import shutil

    if not validar(origen, con_autocad=True) and not forzar:
        raise EntregaRechazada(
            f"NO se copio {os.path.basename(origen)} a {destino}: no paso la validacion "
            "contra AutoCAD. Correr --normalizar y volver a validar."
        )
    destino_final = destino
    if os.path.isdir(destino):
        destino_final = os.path.join(destino, os.path.basename(origen))
    shutil.copyfile(origen, destino_final)
    print(f"  entregado -> {destino_final}")

    # SEGUNDA CAUSA, independiente del contenido: la ruta de destino pasa MAX_PATH.
    # El archivo queda bien pero Fak NO lo puede abrir con doble click. No se bloquea la
    # entrega (la carpeta del server es la que es), pero hay que avisarlo SIEMPRE y dejar
    # una copia en ruta corta.
    n = len(os.path.abspath(destino_final))
    if n > MAX_PATH_WINDOWS:
        print(
            f"  !! ATENCION: la ruta de destino mide {n} caracteres (limite de Windows "
            f"{MAX_PATH_WINDOWS}).\n"
            f"     El archivo esta bien, pero al DOBLE CLICK Windows corta el nombre en el "
            f"caracter {MAX_PATH_WINDOWS}, se pierde el '.dxf' y sale\n"
            f"     'Seleccione una aplicacion para abrir ...' / AutoCAD dice 'invalid name'.\n"
            f"     Nombre que le queda: {os.path.basename(destino_final)[: max(0, MAX_PATH_WINDOWS - (n - len(os.path.basename(destino_final))))]!r}\n"
            f"     Hay que darle una ruta corta (unidad mapeada a una carpeta mas abajo, o "
            f"copia local) y decirselo."
        )
    return destino_final


def main() -> int:
    ap = argparse.ArgumentParser(description="Validar / normalizar DXF contra AutoCAD")
    ap.add_argument("dxf", nargs="+")
    ap.add_argument("--normalizar", metavar="SALIDA")
    ap.add_argument("--entregar", metavar="DESTINO",
                    help="copia al destino SOLO si pasa el gate de AutoCAD")
    ap.add_argument("--sin-autocad", action="store_true")
    a = ap.parse_args()

    if a.entregar:
        if len(a.dxf) != 1:
            ap.error("--entregar toma un solo archivo de entrada")
        entregar_dxf(a.dxf[0], a.entregar)
        return 0

    if a.normalizar:
        if len(a.dxf) != 1:
            ap.error("--normalizar toma un solo archivo de entrada")
        print(f"=== normalizando {a.dxf[0]}")
        for l in normalizar(a.dxf[0], a.normalizar):
            print(f"  {l}")
        print(f"=== escrito {a.normalizar}")
        return 0 if validar(a.normalizar, not a.sin_autocad) else 1

    # sin short-circuit: quiero el reporte de TODOS los archivos, no solo hasta el primero malo
    resultados = [validar(p, not a.sin_autocad) for p in a.dxf]
    return 0 if all(resultados) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except DxfInvalido as exc:
        print(f"RECHAZADO: {exc}", file=sys.stderr)
        sys.exit(1)
