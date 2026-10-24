"""Corrector 'gate_fase': el gate 3f tal como corre de verdad (24/10/2026): gate_fase.py iniciar|cerrar|pasar --fase N
--workdir W (fases con criterio de salida; el cierre de la fase 2 corre barrido.py sobre el conjunto). Mismo gate que
corre export_deliverables.py en la entrega.

Uso: python gate_fase.py <escenario.json>
El escenario lo arma la pieza del ejercicio 12: un workdir nuevo y la secuencia de llamadas al gate ({"args": [...]})
y de retoques ({"copiar": [[desde, hasta], ...]}). Todos los pasos menos el ultimo preparan el estado y tienen que dar
verde (si no, el escenario esta roto: error). El ultimo es el que se juzga, por lo MEDIDO (veredicto de la linea JSON
del gate: verde / rojo / no_medido), no por el codigo de salida: hasta el 30/10/2026 el gate avisa y sale con 0 aunque
de rojo, y el banco no puede depender de la fecha.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error, o
NO MEDIDO: no cuenta como verde)."""
import json, os, shutil, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'gate_fase.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'gate_fase', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def correr(args):
    env = {k: v for k, v in os.environ.items() if k not in ('CAD_GATE_TEST', 'CAD_HOY')}
    env['PYTHONIOENCODING'] = 'utf-8'
    try:
        r = subprocess.run([sys.executable, '-I', GATE, *args], capture_output=True, timeout=900, env=env)
    except subprocess.TimeoutExpired:
        return None, 'el gate tardo mas de 900 s'
    out = r.stdout.decode('utf-8', errors='replace')
    lineas = [x for x in out.splitlines() if x.startswith('{"gate": "fase"')]
    try:
        return json.loads(lineas[-1]), out
    except (IndexError, ValueError):
        return None, out


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith('.json'):
        salir('error', 'uso: gate_fase.py <escenario.json>')
    if not os.path.exists(GATE):
        salir('error', f'no esta gate_fase.py ({os.path.normpath(GATE)})')
    try:
        with open(sys.argv[1], encoding='utf-8') as f:
            pasos = json.load(f)['pasos']
    except (OSError, ValueError, KeyError) as e:
        salir('error', f'escenario ilegible: {e}')
    if not pasos or 'args' not in pasos[-1]:
        salir('error', 'el escenario no termina en una llamada al gate')
    hechos, j = [], None
    for i, p in enumerate(pasos):
        if 'copiar' in p:
            for desde, hasta in p['copiar']:
                shutil.copyfile(desde, hasta)
            hechos.append('retoque: %d archivos' % len(p['copiar']))
            continue
        j, out = correr(p['args'])
        if j is None:
            salir('error', f'el paso {i} ({" ".join(p["args"][:1])}) no dejo la linea JSON del gate: {str(out)[-300:]}')
        hechos.append('%s %s: %s' % (j.get('op'), j.get('fase'), j.get('veredicto')))
        if i < len(pasos) - 1 and j.get('veredicto') != 'verde':
            salir('error', f'el escenario esta roto: el paso {i} ({j.get("op")} {j.get("fase")}) dio '
                  f'{j.get("veredicto")}: {"; ".join(j.get("motivos") or []) or j.get("motivo")}', {'pasos': hechos})
    medidas = {'pasos': hechos, 'modo': j.get('modo'), 'motivos': j.get('motivos'), 'reabiertas': j.get('reabiertas'),
               'step_firma': j.get('step_firma')}
    if j.get('veredicto') == 'rojo':
        salir('rojo', f'{j.get("op")} --fase {j.get("fase")}: {"; ".join(j.get("motivos") or [])[:400]}; modo del '
              f'gate hoy: {j.get("modo")}', medidas)
    if j.get('veredicto') == 'verde':
        salir('verde', f'{j.get("op")} --fase {j.get("fase")}: fases anteriores cerradas y vigentes '
              f'({len(hechos)} pasos)', medidas)
    salir('error', f'NO MEDIDO: {j.get("motivo")}', medidas)


if __name__ == '__main__':
    main()
