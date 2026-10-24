"""Corrector 'espesor_pared': el control de pared minima tal como corre de verdad (24/10/2026):
espesor_pared.py --step <pieza.step> (rayos hacia adentro desde una grilla densa sobre cada cara; rojo si una pared de
caras PARALELAS mide menos de 0,45 mm, aviso si mide menos de 0,8 o es una cuna; la punta de un cono no se juzga; autotest
BIEN/MAL propio antes de juzgar). Es el mismo programa que se usa en la entrega.

Uso: python espesor_pared.py <pieza.step> [--aviso-cuenta-rojo] [--paso 0.5]
Juzga por lo MEDIDO (la linea JSON del control: veredicto verde / aviso / rojo / no_medido), no por el codigo de salida:
hasta el 31/10/2026 el control avisa y sale con 0 aunque haya un rojo, y el banco no puede depender de la fecha.
  - rojo  -> rojo.
  - aviso -> verde, salvo con --aviso-cuenta-rojo (entonces rojo). El yaml de cada ejercicio decide: el 25 lo pone
    porque sus dos mutantes de aviso (alma de 0,60 y cuna de 3 a 0,3) son defectos de la regla G3 y su pieza BIEN no
    tiene ningun aviso, asi que contar el aviso como rojo no puede dar un falso rojo sobre ella.
  - no_medido, autotest que falla (codigo 3) o sin JSON -> error (no cuenta como verde).
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo) o 2 (error)."""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(AQUI, '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts', 'espesor_pared.py')


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'espesor_pared', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    args = sys.argv[1:]
    if not args or not args[0].lower().endswith(('.step', '.stp')):
        salir('error', 'uso: espesor_pared.py <pieza.step> [--aviso-cuenta-rojo] [--paso 0.5]')
    aviso_rojo = '--aviso-cuenta-rojo' in args
    resto = [a for a in args[1:] if a != '--aviso-cuenta-rojo']
    if not os.path.exists(GATE):
        salir('error', f'no esta espesor_pared.py ({os.path.normpath(GATE)})')
    try:
        r = subprocess.run([sys.executable, '-I', GATE, '--step', args[0], *resto], capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        salir('error', 'NO MEDIDO: el control tardo mas de 900 s')
    lineas = [x for x in r.stdout.decode('utf-8', errors='replace').splitlines() if x.startswith('{"gate": "pared_minima"')]
    if r.returncode == 3:
        salir('error', 'el autotest del control fallo: no juzga ninguna pieza')
    try:
        med = json.loads(lineas[-1])
    except (IndexError, ValueError):
        salir('error', f'espesor_pared.py salio con {r.returncode} sin JSON')
    fino = med.get('fino_juzgado') or {}
    medidas = {'veredicto': med.get('veredicto'), 'modo': med.get('modo'), 'espesor_min_juzgado_mm': fino.get('espesor_mm'),
               'clase': fino.get('clase'), 'punto': fino.get('punto'), 'angulo_grados': fino.get('angulo_grados'),
               'espesor_min_todos_mm': med.get('espesor_min_todos_mm'), 'rayos': med.get('rayos'),
               'impacto_pct': med.get('impacto_pct'), 'paralelas_bajo_rojo_mm2': med.get('paralelas_bajo_rojo_mm2'),
               'paralelas_bajo_aviso_mm2': med.get('paralelas_bajo_aviso_mm2'),
               'cunas_bajo_aviso_mm2': med.get('cunas_bajo_aviso_mm2'),
               'puntas_sin_juzgar_rayos': med.get('puntas_sin_juzgar_rayos'),
               'segundos_medicion': med.get('segundos_medicion'), 'aviso_cuenta_rojo': aviso_rojo}
    v = med.get('veredicto')
    if med.get('medido') is not True or v not in ('verde', 'aviso', 'rojo'):
        salir('error', f'NO MEDIDO: {med.get("motivo")}', medidas)
    donde = ''
    if fino:
        donde = f'; la mas fina {fino.get("espesor_mm")} mm ({fino.get("clase")}, {fino.get("angulo_grados")} grados entre caras) en {fino.get("punto")}'
    if v == 'rojo' or (v == 'aviso' and aviso_rojo):
        salir('rojo', f'veredicto del control: {v}{donde}', medidas)
    if v == 'aviso':
        salir('verde', f'solo aviso (no cuenta como rojo en este ejercicio){donde}', medidas)
    salir('verde', f'ninguna pared bajo {med.get("umbral_aviso_mm")} mm; minimo de todos los rayos {med.get("espesor_min_todos_mm")} mm '
          f'({med.get("puntas_sin_juzgar_rayos")} rayos de punta sin juzgar)', medidas)


if __name__ == '__main__':
    main()
