"""test_choque_veredicto.py: choque_exacto.py contra tres pares de cajas con respuesta conocida (build123d, segundos):
luz 0,5 -> «no choca»; apoyadas -> «toca (luz 0)»; 0,5 encimadas -> «CHOCA»."""
import json
import os
import subprocess
import sys
import tempfile

from build123d import Box, Location, export_step

AQUI = os.path.dirname(os.path.abspath(__file__))
casos = {"no choca": 0.5, "toca (luz 0)": 0.0, "CHOCA": -0.5}
d = tempfile.mkdtemp()
panel = os.path.join(d, "panel.step")
export_step(Box(40, 40, 10).moved(Location((0, 0, 5))), panel)            # z 0 a 10
mal = 0
for esperado, luz in casos.items():
    u = os.path.join(d, f"u_{luz}.step")
    export_step(Box(20, 20, 10).moved(Location((0, 0, -5 - luz))), u)    # tope en z = -luz
    r = subprocess.run([sys.executable, os.path.join(AQUI, "choque_exacto.py"), u, panel], capture_output=True, text=True)
    v = json.loads(r.stdout.strip().splitlines()[-1])["veredicto"]
    ok = v == esperado
    mal += not ok
    print(f"{'ok ' if ok else 'MAL'} luz {luz:+.1f}: {v} (esperado {esperado})")
sys.exit(1 if mal else 0)
