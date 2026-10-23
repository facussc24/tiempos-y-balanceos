"""Corrector 'gate_voladizos': el gate 3a tal como corre de verdad antes de laminar (23/10/2026):
laminar_bambu.py --solo-voladizos <pieza.3mf> (mide cada parte con voladizos_3mf.py, dos votos: chequeo_voladizos2.py
frena, dfam solo avisa). No lamina ni abre Bambu Studio.

Uso: python gate_voladizos.py <pieza.3mf>
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde: OK o solo aviso
informativo de dfam), 3 (rojo: voladizos2 OJO en alguna parte) o 2 (error, o NO MEDIDO: no cuenta como verde)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
LAMINAR = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'impresion-3d-bambu', 'scripts', 'laminar_bambu.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'gate_voladizos', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1 or not args[0].lower().endswith('.3mf'):
        salir('error', 'uso: gate_voladizos.py <pieza.3mf>')
    if not os.path.exists(LAMINAR):
        salir('error', f'no esta laminar_bambu.py ({os.path.normpath(LAMINAR)})')
    r = subprocess.run([sys.executable, '-I', LAMINAR, '--solo-voladizos', args[0]], capture_output=True, timeout=300)
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{')]
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'laminar_bambu.py --solo-voladizos salio con {r.returncode} sin JSON')
    partes = {p.get('parte'): p.get('veredicto') for p in med.get('partes', [])}
    medidas = {'veredicto_gate': med.get('veredicto'), 'partes': partes, 'segundos': med.get('segundos')}
    if r.returncode == 1:
        salir('rojo', 'queda en el aire: ' + ', '.join(n for n, v in partes.items() if v == 'freno'), medidas)
    if r.returncode == 0:
        salir('verde', f'gate {med.get("veredicto")}: nada en el aire para voladizos2', medidas)
    salir('error', f'NO MEDIDO: {med.get("motivo") or med.get("faltan")}', medidas)


if __name__ == '__main__':
    main()
