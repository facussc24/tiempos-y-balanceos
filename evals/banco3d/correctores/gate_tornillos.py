"""Corrector 'gate_tornillos': el gate 3e tal como corre de verdad (23/10/2026):
gate_tornillos.py --step <conjunto.step> --tornillos <conjunto.tornillos.json> (largo de agarre y de rosca contra la
pila real del STEP). Mismo gate que corre export_deliverables.py en la entrega cuando se declaran tornillos.

Uso: python gate_tornillos.py <conjunto.step> [opciones del gate]
El json de tornillos va al lado del STEP, con el mismo nombre: <conjunto>.tornillos.json (lo escribe la pieza).
Juzga por lo MEDIDO (la linea JSON del gate: veredicto rojo / verde / no_medido), no por el codigo de salida: hasta el
30/10/2026 el gate avisa y sale con 0 aunque haya rojos, y el banco no puede depender de la fecha.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error, o
NO MEDIDO: no cuenta como verde)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'gate_tornillos.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'gate_tornillos', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith(('.step', '.stp')):
        salir('error', 'uso: gate_tornillos.py <conjunto.step> [opciones del gate]')
    if not os.path.exists(GATE):
        salir('error', f'no esta gate_tornillos.py ({os.path.normpath(GATE)})')
    tj = os.path.splitext(sys.argv[1])[0] + '.tornillos.json'
    if not os.path.exists(tj):
        salir('error', f'NO MEDIDO: no esta el json de tornillos al lado del STEP ({os.path.basename(tj)})')
    cmd = [sys.executable, '-I', GATE, '--step', sys.argv[1], '--tornillos', tj, *sys.argv[2:]]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el gate tardo mas de 900 s')
    if r.returncode == 3:
        salir('error', 'el autotest del gate fallo: no juzga ningun conjunto')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{"gate": "tornillos"')]
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'gate_tornillos.py salio con {r.returncode} sin JSON')
    ts = med.get('tornillos') or []
    medidas = {'veredicto': med.get('veredicto'), 'modo': med.get('modo'), 'rojos': med.get('rojos'),
               'tornillos': [{k: t.get(k) for k in ('id', 'largo_medido_mm', 'pila_mm', 'margen_mm', 'veredicto')}
                             for t in ts]}
    if med.get('veredicto') == 'rojo' and med.get('medido') is True:
        salir('rojo', '; '.join(f'{t["id"]}: {" / ".join(t["rojos"])}' for t in ts if t.get('rojos'))
              + f'; modo del gate hoy: {med.get("modo")}', medidas)
    if med.get('veredicto') == 'verde' and med.get('medido') is True:
        salir('verde', '; '.join(f'{t["id"]}: largo {t["largo_medido_mm"]} contra pila {t["pila_mm"]}, margen '
                                 f'{t["margen_mm"]}' for t in ts), medidas)
    salir('error', f'NO MEDIDO: {med.get("motivo")}', medidas)


if __name__ == '__main__':
    main()
