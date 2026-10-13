"""Mini reporte de un laminado: en que se va el tiempo y el material.

Uso: reporte_laminado.py <carpeta del laminado>      (la que deja laminar_bambu.py)
Lee result.json (tiempos por tipo de trazo, que calcula Bambu Studio) y resumen.json.
"""
import json
import sys
from pathlib import Path

c = Path(sys.argv[1])
res = json.load(open(c / "result.json", encoding="utf-8"))
resumen = json.load(open(c / "resumen.json", encoding="utf-8")) if (c / "resumen.json").exists() else {}
p = res["sliced_plates"][0]
NOMBRES = {"Sparse infill": "Relleno interior", "Internal solid infill": "Relleno macizo (pisos y techos por dentro)",
           "Outer wall": "Pared de afuera", "Inner wall": "Paredes de adentro", "Top surface": "Cara de arriba",
           "Bottom surface": "Primera capa (cara de abajo)", "Bridge": "Puentes (techos sobre el relleno)",
           "Travel": "Movimientos sin imprimir", "Prime tower": "Torre de purga (cambio de color)",
           "Custom": "Arranque y cambios de filamento", "Gap infill": "Relleno de huecos finos",
           "Overhang wall": "Paredes en voladizo", "Skirt": "Falda", "Floating vertical shell": "Paredes sobre el relleno",
           "Undefined": "Otros", "Support": "Soportes", "Support interface": "Interfaz de soportes"}
t = {k: float(v) for k, v in p.get("feature_type_times", {}).items() if float(v) > 0}
tot = sum(t.values())
print(f"TIEMPO total estimado: {resumen.get('tiempo', '?')}  ({tot/60:.0f} min sumando los trazos)")
for k, v in sorted(t.items(), key=lambda kv: -kv[1]):
    barra = "#" * round(30 * v / tot)
    print(f"  {NOMBRES.get(k, k):<44} {v/60:5.1f} min  {100*v/tot:4.0f} %  {barra}")
print("\nMATERIAL por filamento:")
for f in p.get("filaments", []):
    util, total = f.get("main_used_g", 0), f.get("total_used_g", 0)
    print(f"  filamento {f.get('id')}: {total:.1f} g  (en la pieza {util:.1f} g, purga y torre {total-util:.1f} g)")
print(f"\ncambios de filamento: {p.get('filament_change_times')}  |  capas: {resumen.get('capas', '?')}"
      f"  |  alto: {resumen.get('alto_mm', '?')} mm")
