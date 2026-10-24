"""Corrector 'numeros_pagina': el control de numeros de la pagina de entrega tal como corre de verdad (24/10/2026):
numeros_pagina.py --fuentes <pieza>__pasos.json <pieza>__pagina.html --medidas <pieza>__medidas*.json (cada numero con unidad
de la pagina se busca en las medidas del modelo; tipeado, que contradice su medida, o el mismo dato con dos valores es
rojo; autotest BIEN/MAL propio antes de juzgar). Es el mismo programa que corre gate_entregable.py --fuentes-pagina.

Uso: python numeros_pagina.py <pieza.stl>
La pieza (ver el ejercicio 26) escribe al lado de su .stl: <stem>__pasos.json (la fuente de la pagina), <stem>__pagina.html
y uno o mas <stem>__medidas*.json (los JSON de medidas que salieron del build). Juzga por lo MEDIDO (el veredicto de la
linea JSON del control: rojo / aviso / verde / no_medido), no por el codigo de salida: hasta el 31/10/2026 el control avisa
y sale con 0 aunque haya rojo, y el banco no puede depender de la fecha.
  - rojo       -> rojo.
  - aviso      -> verde (solo numeros dudosos: el control los muestra y no frena nunca; la BIEN del ejercicio no tiene).
  - verde      -> verde.
  - no_medido, autotest que falla (codigo 3), sin JSON de medidas o sin JSON -> error (no cuenta como verde).
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error)."""
import glob, json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'numeros_pagina.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'numeros_pagina', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    args = sys.argv[1:]
    if not args or not args[0].lower().endswith('.stl'):
        salir('error', 'uso: numeros_pagina.py <pieza.stl>  (la pieza deja al lado __pasos.json, __pagina.html y __medidas*.json)')
    if not os.path.exists(GATE):
        salir('error', f'no esta numeros_pagina.py ({os.path.normpath(GATE)})')
    base = os.path.splitext(args[0])[0]
    fuentes = [p for p in (base + '__pasos.json', base + '__pagina.html') if os.path.exists(p)]
    medidas = sorted(glob.glob(base + '__medidas*.json'))
    if not fuentes:
        salir('error', 'la pieza no dejo __pasos.json ni __pagina.html al lado del .stl')
    cmd = [sys.executable, '-I', GATE, '--fuentes', *fuentes]
    if medidas:
        cmd += ['--medidas', *medidas]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=600)
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el control tardo mas de 600 s')
    if r.returncode == 3:
        salir('error', 'el autotest del control fallo: no juzga ninguna pagina')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{"gate": "numeros_pagina"')]
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'numeros_pagina.py salio con {r.returncode} sin JSON')
    m = {k: med.get(k) for k in ('veredicto', 'modo', 'numeros', 'leidos', 'dudosos', 'exentos', 'tipeados', 'contradicen',
                                 'dobles', 'sin_unidad', 'medidas_hojas', 'segundos')}
    m['rojos'] = [f'{x["lugar"]} {x["numero"]} ({x["estado"]})' for x in med.get('rojos_detalle', [])]
    m['dobles_pares'] = [f'{x["a"]} {x["numero_a"]} / {x["b"]} {x["numero_b"]}' for x in med.get('dobles_detalle', [])]
    v = med.get('veredicto')
    if med.get('medido') is not True or v not in ('verde', 'aviso', 'rojo'):
        salir('error', f'NO MEDIDO: {med.get("motivo")}', m)
    if v == 'rojo':
        salir('rojo', f'{med.get("tipeados")} tipeados, {med.get("contradicen")} contradicen su medida, '
              f'{med.get("dobles")} datos con dos valores; ' + '; '.join(m['rojos'][:4] + m['dobles_pares'][:2]), m)
    salir('verde', f'{med.get("numeros")} numeros con unidad: {med.get("leidos")} leidos del modelo, {med.get("dudosos")} '
          f'dudosos, {med.get("exentos")} exentos; ninguno tipeado, contradicho ni con dos valores', m)


if __name__ == '__main__':
    main()
