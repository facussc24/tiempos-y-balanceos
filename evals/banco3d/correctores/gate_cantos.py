"""Corrector 'gate_cantos': el gate 3c tal como corre de verdad (23/10/2026):
gate_aristas.py --step <pieza.step> --cantos-convexos [opciones] (cantos convexos con radio menor que el de la casa,
R1,5, en la zona de mano; toda arista que TOQUE la zona). Mismo gate que corre export_deliverables.py en la entrega.

Uso: python gate_cantos.py <pieza.step> [--zona x0,y0,z0,x1,y1,z1 | --sin-zona "<motivo>"] [--umbral 1.5]
Juzga por lo MEDIDO (la linea JSON del gate: veredicto rojo / verde / no_medido), no por el codigo de salida: hasta el
30/10/2026 el gate avisa y sale con 0 aunque haya cantos vivos, y el banco no puede depender de la fecha.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error, o
NO MEDIDO: no cuenta como verde)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'gate_aristas.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'gate_cantos', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith(('.step', '.stp')):
        salir('error', 'uso: gate_cantos.py <pieza.step> [opciones del gate]')
    if not os.path.exists(GATE):
        salir('error', f'no esta gate_aristas.py ({os.path.normpath(GATE)})')
    cmd = [sys.executable, '-I', GATE, '--step', sys.argv[1], '--cantos-convexos', *sys.argv[2:]]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el gate tardo mas de 900 s')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines()
              if x.startswith('{"gate": "cantos_convexos"')]
    if r.returncode == 3:
        salir('error', 'el autotest del gate fallo: no juzga ninguna pieza')
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'gate_aristas.py --cantos-convexos salio con {r.returncode} sin JSON')
    medidas = {k: med.get(k) for k in ('veredicto', 'modo', 'cantos_vivos', 'radios_chicos', 'convexas_revisadas',
                                       'cilindros_completos', 'caras_curvas_sin_juzgar', 'rmin', 'zona', 'sin_zona',
                                       'umbral_mm', 'segundos')}
    if med.get('veredicto') == 'rojo' and med.get('medido') is True:
        salir('rojo', f'{med.get("cantos_vivos")} cantos vivos y {med.get("radios_chicos")} redondeos menores que '
              f'R{med.get("umbral_mm")} en la zona (el mas chico R{med.get("rmin")}); modo del gate hoy: {med.get("modo")}',
              medidas)
    if med.get('veredicto') == 'verde' and med.get('medido') is True:
        salir('verde', f'{med.get("convexas_revisadas")} convexas en la zona, todas con R >= {med.get("umbral_mm")}',
              medidas)
    salir('error', f'NO MEDIDO: {med.get("motivo")}', medidas)


if __name__ == '__main__':
    main()
