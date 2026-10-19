"""medir_step.py <archivo.step>: volumen, area, caja y cantidad de solidos con build123d (una linea JSON)."""
import json
import sys
from build123d import import_step

s = import_step(sys.argv[1])
bb = s.bounding_box()
solidos = s.solids()
print(json.dumps({"volumen": round(sum(x.volume for x in solidos), 3), "area": round(s.area, 3),
                  "caja": [round(bb.size.X, 3), round(bb.size.Y, 3), round(bb.size.Z, 3)],
                  "min": [round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3)], "solidos": len(solidos)}))
