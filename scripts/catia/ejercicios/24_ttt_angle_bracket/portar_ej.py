# -*- coding: utf-8 -*-
"""Copia un ejNN_*.py de la practica del 19/10 y su gemelo a una carpeta de ejercicio del banco de CATIA, con los
cambios minimos: cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y los elementos de construccion para
ocultarlos) en vez de capturar y guardar; sin __main__. El gemelo escribe el STEP en la ruta del 1.er argumento y la
ultima linea es un JSON con el volumen. Uso: python portar_ej.py <carpeta practica> <ejNN_nombre> <destino> <N ejercicio>"""
import io
import os
import re
import sys

src, nombre, dst, num = sys.argv[1:5]
p = io.open(os.path.join(src, nombre + ".py"), encoding="utf-8").read()

imp = re.search(r"^from catia_base import (.+)$", p, re.M)
nombres = [n.strip() for n in imp.group(1).split(",") if n.strip() not in ("captura", "correr", "guardar_pieza")]
p = p.replace(imp.group(0), "from catia_base import " + ", ".join(nombres))
cuerpo_var = re.search(r"^    doc, part, (\w+), sf = nueva_pieza\(", p, re.M).group(1)
if p.count("    o = part.OriginElements\n") != 1:
    raise SystemExit("esperaba una vez «o = part.OriginElements»")
p = p.replace("    o = part.OriginElements\n", "    o = part.OriginElements\n    ctx = {\"construccion\": []}\n")
p, n = re.subn(r"^(\s+)(.+)\.InsertHybridShape\((\w+)\)[ \t]*$", r'\1\2.InsertHybridShape(\3)\n\1ctx["construccion"].append(\3)',
               p, flags=re.M)
corte = "    def final():" if "    def final():" in p else '    reg.paso("captura"'      # el ej54 no tiene final()
ini, fin = p.index(corte), p.index('if __name__ == "__main__":')
p = p[:ini] + f"    ctx.update(doc=doc, part=part, body={cuerpo_var}, sf=sf)\n    return ctx\n\n\n"
cab = (f"# Origen: {nombre}.py de la practica del 19/10/2026 (C:\\Dev\\_catia_practica de la PC principal, copiado a CATA\n"
       f"# por el PEDIDO PARA CATA 6). Cambios para el ejercicio {num} del banco de CATIA (24/10/2026), nada mas: 1) no importa\n"
       f"# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y los {n}\n"
       f"# llamadas a InsertHybridShape, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el\n"
       f"# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script, sin tocar nada mas).\n")
p = p.replace("# -*- coding: utf-8 -*-\n", "# -*- coding: utf-8 -*-\n" + cab, 1).rstrip() + "\n"
io.open(os.path.join(dst, "pieza_" + nombre.split("_")[0] + ".py"), "w", encoding="utf-8", newline="\n").write(p)

if not os.path.isfile(os.path.join(src, nombre + "_gemelo.py")):                 # el ej54 no tiene gemelo propio
    print("ok", nombre, "cuerpo:", cuerpo_var, "construccion:", n, "(sin gemelo)")
    sys.exit(0)
g = io.open(os.path.join(src, nombre + "_gemelo.py"), encoding="utf-8").read()
g = g[:g.index('if __name__ == "__main__":')] + (
    'if __name__ == "__main__":\n    import json\n    import sys\n    r = pieza()\n'
    '    s = r[0] if isinstance(r, tuple) else r\n    if len(sys.argv) > 1:\n        export_step(s, sys.argv[1])\n'
    '    print(json.dumps({"volumen": round(s.volume, 3), "solidos": len(s.solids())}))\n')
cabg = (f"# Origen: {nombre}_gemelo.py de la practica del 19/10/2026 (copiado a CATA por el PEDIDO PARA CATA 6). Unico cambio\n"
        f"# (24/10/2026, ejercicio {num}): el bloque __main__ arma pieza() con sus valores por defecto, escribe el STEP en la ruta\n"
        f"# del 1.er argumento (antes, fija en C:\\Dev\\_catia_practica) y la ultima linea es un JSON con el volumen. Con .venv-cad.\n")
g = g.replace("# -*- coding: utf-8 -*-\n", "# -*- coding: utf-8 -*-\n" + cabg, 1)
io.open(os.path.join(dst, "gemelo_b123d.py"), "w", encoding="utf-8", newline="\n").write(g)
print("ok", nombre, "cuerpo:", cuerpo_var, "construccion:", n)
