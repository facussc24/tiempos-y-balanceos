"""Corrector 'lo_demas_no_cambio' (propuesta 4 / P9 del 23/10): una correccion cambia SOLO lo que se pidio. Envuelve
.claude/skills/cad-design/scripts/diff_modelo.py (con su autotest propio): compara <pieza>.step (despues) contra
<pieza>__antes.step (antes) que la pieza deja al lado.
Uso: python lo_demas_no_cambio.py <pieza.step> [--puede-cambiar a,b] [--zona x0,y0,z0,x1,y1,z1] [--tol 0.01]
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo), 2 (error)."""
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DIFF = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts',
                                     'diff_modelo.py'))


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'lo_demas_no_cambio', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].lower().endswith(('.step', '.stp')):
        salir('error', 'uso: lo_demas_no_cambio.py <despues.step> [opciones de diff_modelo.py]')
    despues = sys.argv[1]
    antes = despues[: despues.rfind('.')] + '__antes.step'
    if not os.path.exists(antes):
        salir('error', f'falta {os.path.basename(antes)} al lado de la pieza')
    salida_json = despues[: despues.rfind('.')] + '__diff.json'
    r = subprocess.run([sys.executable, '-I', DIFF, antes, despues, *sys.argv[2:], '--json', salida_json],
                       capture_output=True, text=True, timeout=900)
    texto = (r.stdout or '').strip().splitlines()
    medidas = {}
    if os.path.exists(salida_json):
        with open(salida_json, encoding='utf-8') as f:
            d = json.load(f)
        medidas = {'resumen': d['resumen'], 'cambio_lo_que_no_se_pidio': d['cambio_lo_que_no_se_pidio'],
                   'solidos': d['solidos']}
    if r.returncode == 0:
        salir('verde', texto[-1] if texto else 'solo cambio lo que se pidio', medidas)
    if r.returncode == 3 and medidas:
        salir('rojo', 'cambio algo que no se pidio: ' + '; '.join(medidas['cambio_lo_que_no_se_pidio'])[:500], medidas)
    salir('error', ' / '.join(texto[-3:])[:500] or (r.stderr or '')[-300:], medidas)


if __name__ == '__main__':
    main()
