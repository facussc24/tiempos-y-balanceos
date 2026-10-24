"""Corrector 'gate_barrido': el gate 3d tal como corre de verdad (23/10/2026): barrido.py <conjunto.json> [opciones]
(choque, contacto y luz por par a lo largo del recorrido, con la guarda del paso y el cronometro). Mismo gate que corre
export_deliverables.py en la entrega cuando se declara movimiento.

Uso: python gate_barrido.py <conjunto.json> [--paso 60] [--dedo 25] [--mano 100] [--tope-seg 120]
Juzga por lo MEDIDO (la linea JSON del gate: veredicto rojo / verde / no_medido), no por el codigo de salida: hasta el
30/10/2026 el gate avisa y sale con 0 aunque haya choque, y la luz de dedo queda en aviso tambien despues; el banco no
puede depender de la fecha.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error, o
NO MEDIDO: no cuenta como verde)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'barrido.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'gate_barrido', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith('.json'):
        salir('error', 'uso: gate_barrido.py <conjunto.json> [opciones del gate]')
    if not os.path.exists(GATE):
        salir('error', f'no esta barrido.py ({os.path.normpath(GATE)})')
    cmd = [sys.executable, '-I', GATE, sys.argv[1], *sys.argv[2:]]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=900,
                           env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el gate tardo mas de 900 s')
    if r.returncode == 3:
        salir('error', 'el autotest del gate fallo: no juzga ningun conjunto')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{"gate": "barrido"')]
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'barrido.py salio con {r.returncode} sin JSON')
    g = med.get('guarda') or {}
    medidas = {'veredicto': med.get('veredicto'), 'modo': med.get('modo'), 'poses': med.get('poses'),
               'paso_pedido': g.get('paso_pedido'), 'paso_grados': g.get('paso_grados'),
               'guarda_grados': g.get('guarda_grados'), 'refinado': g.get('refinado'),
               'choques': med.get('choques'), 'contactos': med.get('contactos'), 'pellizcos': med.get('pellizcos'),
               'pose_peor': med.get('pose_peor'), 'segundos': med.get('segundos')}
    if med.get('medido') is True and med.get('veredicto') == 'rojo':
        pp = med.get('pose_peor') or {}
        salir('rojo', f'{pp.get("que")} {"-".join(pp.get("par") or [])} a {pp.get("pose")} '
              f'({len(med.get("choques") or [])} choques, {len(med.get("pellizcos") or [])} luces bajo el dedo; '
              f'{med.get("poses")} poses, paso {g.get("paso_grados")} pedido {g.get("paso_pedido")}); '
              f'modo del gate hoy: {med.get("modo")}', medidas)
    if med.get('medido') is True and med.get('veredicto') == 'verde':
        salir('verde', f'{med.get("poses")} poses sin choque ni contacto en pares no declarados '
              f'(paso {g.get("paso_grados")}, pedido {g.get("paso_pedido")})', medidas)
    salir('error', f'NO MEDIDO: {med.get("motivo")}', medidas)


if __name__ == '__main__':
    main()
