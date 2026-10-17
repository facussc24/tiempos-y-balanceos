"""Lo comun a los tests de la skill: TODAS las rutas que escriben van a una carpeta temporal.

Se importa antes que los scripts. Deja puestas, para este proceso y los que lance:
  BAMBU_PRUEBA=1        registro.py y bambu_red.py se niegan a escribir fuera de la carpeta temporal
  BAMBU_REGISTRO        el registro compartido (en vez de la nube de Ingenieria)
  BAMBU_DATOS           el archivo de datos de esta PC (en vez de %USERPROFILE%\\.claude\\bambu-a2l.json)
  BAMBU_DATOS_NUBE      la copia de la nube (en vez de la de Ingenieria)
  BAMBU_BUSCAR_EN       ubicar() prueba solo estas direcciones: sin anuncio en la red, sin barrido de ping,
                        sin arp y sin recorrer la red de la planta
  BAMBU_SIN_INTERNET    --ambiente no pide el pronostico
Ningun test habla con la impresora real ni escribe en el registro real.
"""
import io
import json
import os
import shutil
import sys
import tempfile
import zipfile
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SCRIPTS = AQUI.parent / "scripts"
FIXTURES = AQUI / "fixtures"
RAIZ_TMP = Path(tempfile.mkdtemp(prefix="bambu_tests_"))
# Ruta FUERA de la carpeta temporal que no existe: los tests de la guardia apuntan aca y no a los archivos reales, asi
# un freno roto no pisa nada de verdad (auditoria 16/10).
FUERA_DE_LA_TEMPORAL = Path(os.environ["USERPROFILE"]) / ".claude" / "bambu-PRUEBA-NO-EXISTE"

os.environ["BAMBU_PRUEBA"] = "1"
os.environ["BAMBU_REGISTRO"] = str(RAIZ_TMP / "registro")
os.environ["BAMBU_DATOS"] = str(RAIZ_TMP / "claude" / "bambu-a2l.json")
os.environ["BAMBU_DATOS_NUBE"] = str(RAIZ_TMP / "nube" / "bambu-a2l.json")
os.environ["BAMBU_BUSCAR_EN"] = "127.0.0.1"
os.environ["BAMBU_SIN_INTERNET"] = "1"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(AQUI))

import registro  # noqa: E402

SERIE = "01P09A0A1600999"          # serie de JUGUETE (no es la de la impresora de Barack)
OTRA_SERIE = "01P09A0A1600888"
CODIGO = "juguete1"                # codigo de acceso de JUGUETE


def carpeta_nueva(nombre):
    """Una carpeta vacia adentro de la temporal de esta corrida."""
    p = Path(tempfile.mkdtemp(prefix=nombre + "_", dir=RAIZ_TMP))
    return p


def apuntar(tmp, registro_de=None):
    """Redirige las rutas de los dos modulos a `tmp` (y copia un registro de fixtures si se pide)."""
    import bambu_red
    reg = tmp / "registro"
    reg.mkdir(parents=True, exist_ok=True)
    if registro_de:
        for f in (FIXTURES / registro_de).glob("*.jsonl"):
            shutil.copy(f, reg / f.name)
    registro.CARPETA = reg
    registro.ULTIMO_ESTADO = tmp / "claude" / "bambu-a2l-ultimo-estado.json"
    bambu_red.DATOS = tmp / "claude" / "bambu-a2l.json"
    bambu_red.DATOS_NUBE = tmp / "nube" / "bambu-a2l.json"
    (tmp / "claude").mkdir(exist_ok=True)
    return reg


def escribir_datos(tmp, ip, serie=SERIE, codigo=CODIGO, donde="claude"):
    ruta = tmp / donde / "bambu-a2l.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps({"ip": ip, "serie": serie, "codigo_acceso": codigo}), encoding="utf-8")
    return ruta


def gcode_3mf(ruta, minutos=60, gramos=(10.0,), colores=("#000000",), perfil="GFA18", capas=50, placas=1):
    """Un .gcode.3mf minimo, como el que deja Bambu Studio: Metadata/slice_info.config y Metadata/plate_1.gcode
    con la cabecera de tiempo y filamento y el bloque de ajustes."""
    h, m = divmod(int(minutos), 60)
    tiempo = (f"{h}h {m}m 0s" if h else f"{m}m 0s")
    fils = "\n".join(
        f'    <filament id="{i + 1}" tray_info_idx="{perfil}" type="PLA" color="{c}" used_m="1.00" used_g="{g}"/>'
        for i, (g, c) in enumerate(zip(gramos, colores)))
    slice_info = ('<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <plate>\n'
                  '    <metadata key="index" value="1"/>\n'
                  f'    <metadata key="prediction" value="{int(minutos * 60)}"/>\n'
                  '    <metadata key="label_object_enabled" value="false"/>\n'
                  f'    <object identify_id="8" name="pieza" skipped="false" />\n{fils}\n  </plate>\n</config>\n')
    gcode = ("; HEADER_BLOCK_START\n; BambuStudio 02.08.02.61\n"
             f"; model printing time: {tiempo}; total estimated time: {tiempo}\n"
             f"; total layer number: {capas}\n"
             f"; total filament weight [g] : {','.join(str(g) for g in gramos)}\n"
             "; HEADER_BLOCK_END\n\n; CONFIG_BLOCK_START\n"
             "; wall_loops = 2\n; sparse_infill_density = 15%\n; top_shell_layers = 5\n; bottom_shell_layers = 3\n"
             "; brim_type = auto_brim\n; brim_width = 5\n; enable_support = 0\n; support_type = tree(auto)\n"
             "; CONFIG_BLOCK_END\n\n"
             "; CHANGE_LAYER\n; FEATURE: Outer wall\nG1 X10 Y10\nG1 X60 Y10 E2\nG1 X60 Y60 E2\nG1 X10 Y60 E2\nG1 X10 Y10 E2\n"
             "; CHANGE_LAYER\nG1 X0 Y0\n")
    with zipfile.ZipFile(ruta, "w") as z:
        z.writestr("Metadata/slice_info.config", slice_info)
        for i in range(1, placas + 1):
            z.writestr(f"Metadata/plate_{i}.gcode", gcode)
    return Path(ruta)


def correr(funcion, *args, **kw):
    """Corre una funcion capturando lo que imprime. Devuelve (resultado, stdout, stderr)."""
    o, e = io.StringIO(), io.StringIO()
    with redirect_stdout(o), redirect_stderr(e):
        r = funcion(*args, **kw)
    return r, o.getvalue(), e.getvalue()
