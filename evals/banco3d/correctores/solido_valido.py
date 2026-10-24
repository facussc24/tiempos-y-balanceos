"""Corrector 'solido_valido': el gate de validez del solido tal como corre de verdad (24/10/2026):
export_deliverables.py validez --step <pieza.step> (is_valid de cada solido del STEP, con BRepCheck de OpenCASCADE, y
sentido de los triangulos del STL que sale de ese STEP con los parametros de la entrega). Mismo gate que corre
export_deliverables.py en la entrega (gate_validez_solido).

Uso: python solido_valido.py <pieza.step> [--stl-lc N] [--stl-curvature N]
Juzga por lo MEDIDO (la linea JSON del gate: veredicto rojo / verde / no_medido), no por el codigo de salida: hasta el
31/10/2026 el gate avisa y sale con 0 aunque haya rojo, y el banco no puede depender de la fecha. El STL se hace en una
carpeta temporal del gate; no se usa ningun .stl que ya exista junto al STEP.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error, o
NO MEDIDO: no cuenta como verde)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'export_deliverables.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'solido_valido', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith(('.step', '.stp')):
        salir('error', 'uso: solido_valido.py <pieza.step> [opciones del gate]')
    if not os.path.exists(GATE):
        salir('error', f'no esta export_deliverables.py ({os.path.normpath(GATE)})')
    cmd = [sys.executable, '-I', GATE, 'validez', '--step', sys.argv[1], *sys.argv[2:]]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=1500)
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el gate tardo mas de 1500 s')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{"gate": "validez"')]
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'export_deliverables.py validez salio con {r.returncode} sin JSON')
    medidas = {k: med.get(k) for k in ('veredicto', 'modo', 'solidos', 'solidos_invalidos', 'malla_cerrada',
                                       'sentido_consistente', 'motivos', 'avisos', 'no_medido', 'hoy', 'segundos')}
    if med.get('veredicto') == 'rojo' and med.get('medido') is True:
        salir('rojo', '; '.join(med.get('motivos') or []) + f'; modo del gate hoy: {med.get("modo")}', medidas)
    if med.get('veredicto') == 'verde' and med.get('medido') is True:
        # el texto sale de lo medido: con solidos validos y el sentido malo el gate da verde con AVISO (no "un solo sentido")
        if med.get('sentido_consistente') is True:
            sentido = 'los triangulos de la malla tienen un solo sentido'
        else:
            sentido = 'AVISO: ' + ('; '.join(med.get('avisos') or [])
                                   or f'sentido de los triangulos = {med.get("sentido_consistente")}')
        salir('verde', f'{med.get("solidos")} solido(s) validos (BRepCheck); {sentido}', medidas)
    salir('error', 'NO MEDIDO: ' + '; '.join(med.get('no_medido') or ['sin motivo']), medidas)


if __name__ == '__main__':
    main()
