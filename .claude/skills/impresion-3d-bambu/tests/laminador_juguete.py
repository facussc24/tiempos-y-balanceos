"""Laminador de JUGUETE para los tests de laminar_bambu.py: hace de bambu-studio.exe sin abrir Bambu Studio.

laminar_bambu.py lo usa cuando BAMBU_STUDIO_EXE apunta a este archivo (lo corre con el mismo Python). Recibe los
mismos argumentos que bambu-studio.exe (--load-settings, --load-filaments, --curr-bed-type, --export-3mf, --outputdir,
<entrada>), deja en --outputdir un llamado.txt con los argumentos (la prueba de que laminar llego hasta el laminador)
y un resultado minimo con los datos de los perfiles que le pasaron (result.json, plate_1.gcode, el .gcode.3mf), para
que los controles de laminar_bambu.py se puedan correr de punta a punta. No es un laminado: no hay codigo de verdad.
Con LAMINADOR_JUGUETE_FALLA=1 sale con 1 sin dejar resultado.
"""
import json
import os
import sys
import zipfile
from pathlib import Path


def valor(args, clave):
    return args[args.index(clave) + 1] if clave in args else None


def main(args):
    out = Path(valor(args, "--outputdir"))
    out.mkdir(parents=True, exist_ok=True)
    (out / "llamado.txt").write_text(json.dumps(args, ensure_ascii=False), encoding="utf-8")
    if os.environ.get("LAMINADOR_JUGUETE_FALLA") == "1":
        return 1
    ajustes = (valor(args, "--load-settings") or "").split(";")
    fil = [json.load(open(f, encoding="utf-8")) for f in (valor(args, "--load-filaments") or "").split(";") if f]
    maq = json.load(open(ajustes[0], encoding="utf-8")) if ajustes and ajustes[0] else {}
    pro = json.load(open(ajustes[1], encoding="utf-8")) if len(ajustes) > 1 else {}
    arranque = str(maq.get("machine_start_gcode", "")).replace("\n", "\\n")
    g = ["; HEADER_BLOCK_START", "; total estimated time: 1m 0s", "; total layer number: 10",
         "; max_z_height: 10.00", "; total filament weight [g] : 1.00", "; HEADER_BLOCK_END", "; CONFIG_BLOCK_START",
         f"; printer_model = {maq.get('printer_model', '')}", f"; print_settings_id = {pro.get('name', '')}",
         "; filament_settings_id = " + ";".join(f.get("name", "") for f in fil),
         "; nozzle_temperature = " + ",".join(str((f.get("nozzle_temperature") or ["?"])[0]) for f in fil),
         "; filament_density = " + ",".join(str((f.get("filament_density") or ["1.24"])[0]) for f in fil),
         f"; curr_bed_type = {valor(args, '--curr-bed-type') or ''}", f"; machine_start_gcode = {arranque}",
         "; CONFIG_BLOCK_END", "G1 X0 Y0"]
    (out / "plate_1.gcode").write_text("\n".join(g) + "\n", encoding="utf-8")
    with zipfile.ZipFile(out / valor(args, "--export-3mf"), "w") as z:
        z.writestr("Metadata/slice_info.config", '<config><plate><metadata key="printer_model_id" value=""/>'
                                                 '</plate></config>')
        z.writestr("Metadata/plate_1.gcode", "\n".join(g) + "\n")
    (out / "result.json").write_text(json.dumps({"return_code": 0, "error_string": "", "sliced_plates": [
        {"id": 1, "filament_change_times": 0, "warning_message": ""}]}), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
