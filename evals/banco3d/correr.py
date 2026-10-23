"""Banco 3D: construye cada pieza (BIEN y MAL) de cada ejercicio, le pasa los correctores listados en su tarea.yaml y
compara el veredicto con el esperado. Forma adaptada de pzfreo/cadgenbench-build123d (carpeta por ejercicio, yaml de
tarea, puntajes guardados en json + run_meta.json, 4 ejercicios a la vez); ver LICENSES/NOTICE.md.

Uso:
  python correr.py [-j 4] [--solo <id>] [--congelado scores/congelado.json]
  python correr.py --congelar          (copia el ultimo scores a scores/congelado.json; no corre nada)

Reglas de conteo:
  - un mutante (pieza con esperado rojo) cuenta CAZADO si al menos un corrector listado da rojo;
  - un corrector con existe:false, que no esta en correctores/, o que sale con 2 (error) NO cuenta como rojo;
  - una BIEN cuenta EN VERDE si al menos un corrector la juzgo y ninguno dio rojo ni error.
La carpeta .build no se vacia (aca no se borra nada): de cada pieza se usan solo los archivos escritos en esta corrida.
Sale con 0 cuando la corrida termina (aunque queden mutantes sin cazar); 2 si no pudo correr."""
import argparse, concurrent.futures as cf, datetime as dt, glob, importlib.metadata as md, json, os, platform
import shutil, socket, subprocess, sys, time

import yaml

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
EJ, CORR, SCORES, BUILD = (os.path.join(BASE, d) for d in ('ejercicios', 'correctores', 'scores', '.build'))
PY = sys.executable
T_PIEZA, T_CORRECTOR = 900, 1800


def leer_tareas(solo=None):
    tareas = []
    for y in sorted(glob.glob(os.path.join(EJ, '*', 'tarea.yaml'))):
        with open(y, encoding='utf-8') as f:
            t = yaml.safe_load(f)
        t['_dir'] = os.path.dirname(y)
        if solo and t.get('id') != solo and os.path.basename(t['_dir']) != solo:
            continue
        tareas.append(t)
    return tareas


def normalizar_control(c):
    if isinstance(c, str):
        c = {'nombre': c}
    c = dict(c)
    c.setdefault('existe', True)
    c.setdefault('formato', 'stl')
    c['opciones'] = [str(o) for o in (c.get('opciones') or [])]
    return c


def ultima_json(texto):
    for linea in reversed(texto.strip().splitlines()):
        linea = linea.strip()
        if linea.startswith('{'):
            try:
                return json.loads(linea)
            except ValueError:
                continue
    return None


def archivos_nuevos(carpeta, desde):
    return sorted(p for p in glob.glob(os.path.join(carpeta, '*')) if os.path.getmtime(p) >= desde - 1)


def archivo_de(construccion, formato):
    ext = '.' + formato.lower().lstrip('.')
    cands = [p for p in construccion['rutas'] if p.lower().endswith(ext) and '__' not in os.path.basename(p)]
    return cands[0] if cands else None


def construir(tarea, pieza):
    stem = os.path.splitext(pieza['archivo'])[0]
    sub = os.path.join(BUILD, tarea['id'], stem)
    os.makedirs(sub, exist_ok=True)
    t0 = time.time()
    script = os.path.join(tarea['_dir'], pieza['archivo'])
    try:
        r = subprocess.run([PY, '-I', script, sub], capture_output=True, timeout=T_PIEZA, cwd=tarea['_dir'])
        salida = (r.stdout + r.stderr).decode('utf-8', errors='replace').strip().splitlines()
        ok = r.returncode == 0
        detalle = 'ok' if ok else f'salio con {r.returncode}: {(salida[-1] if salida else "")[:300]}'
    except subprocess.TimeoutExpired:
        ok, detalle = False, f'tardo mas de {T_PIEZA} s'
    rutas = archivos_nuevos(sub, t0)
    return {'ok': ok, 'detalle': detalle, 'segundos': round(time.time() - t0, 1),
            'archivos': [os.path.basename(p) for p in rutas], 'rutas': rutas}


def juzgar(control, cons):
    t0 = time.time()
    nombre = control['nombre']
    ruta = os.path.join(CORR, nombre + '.py')
    if not control['existe'] or not os.path.exists(ruta):
        return {'obtenido': 'falta', 'detalle': 'el corrector todavia no existe' if not control['existe']
                else f'no esta correctores/{nombre}.py', 'medidas': {}, 'segundos': 0.0}
    if not cons['ok']:
        return {'obtenido': 'error', 'detalle': 'la pieza no se pudo construir', 'medidas': {}, 'segundos': 0.0}
    f = archivo_de(cons, control['formato'])
    if not f:
        return {'obtenido': 'error', 'detalle': f'la pieza no dejo .{control["formato"]}', 'medidas': {},
                'segundos': 0.0}
    try:
        r = subprocess.run([PY, '-I', ruta, f, *control['opciones']], capture_output=True, timeout=T_CORRECTOR)
        j = ultima_json(r.stdout.decode('utf-8', errors='replace')) or {}
        obtenido = {0: 'verde', 3: 'rojo'}.get(r.returncode, 'error')
        detalle = j.get('detalle') or (r.stderr.decode('utf-8', errors='replace').strip().splitlines() or [''])[-1]
        medidas = j.get('medidas', {})
    except subprocess.TimeoutExpired:
        obtenido, detalle, medidas = 'error', f'tardo mas de {T_CORRECTOR} s', {}
    return {'obtenido': obtenido, 'detalle': str(detalle)[:600], 'medidas': medidas,
            'segundos': round(time.time() - t0, 1), 'archivo': os.path.basename(f)}


def correr_ejercicio(tarea):
    t0 = time.time()
    controles = [normalizar_control(c) for c in tarea.get('controles', [])]
    piezas = {}
    for p in tarea['piezas']:
        cons = construir(tarea, p)
        res = {'esperado': p['esperado'], 'falla': p.get('falla', ''), 'construccion': cons, 'controles': {}}
        for c in controles:
            if c.get('piezas') and p['archivo'] not in c['piezas']:
                continue
            j = juzgar(c, cons)
            j['esperado'] = p['esperado']
            res['controles'][c['nombre']] = j
        cons.pop('rutas', None)
        obt = [j['obtenido'] for j in res['controles'].values()]
        if p['esperado'] == 'rojo':
            res['resultado'] = 'cazado' if 'rojo' in obt else 'no cazado'
        else:
            juzgo = any(o in ('verde', 'rojo') for o in obt)
            res['resultado'] = ('en verde' if juzgo and 'rojo' not in obt and 'error' not in obt
                                else 'falso rojo' if 'rojo' in obt else 'sin juzgar')
        piezas[p['archivo']] = res
    faltan = sorted({c['nombre'] for c in controles
                     if not c['existe'] or not os.path.exists(os.path.join(CORR, c['nombre'] + '.py'))})
    return tarea['id'], {'nombre': tarea.get('nombre', ''), 'piezas': piezas, 'faltan': faltan,
                         'segundos': round(time.time() - t0, 1)}


def git(*a):
    try:
        return subprocess.run(['git', '-C', BASE, *a], capture_output=True, timeout=30).stdout.decode().strip()
    except Exception:
        return ''


def resumen(ejercicios):
    mut = cazados = bien = bien_verde = 0
    faltan = set()
    for e in ejercicios.values():
        faltan.update(e['faltan'])
        for p in e['piezas'].values():
            if p['esperado'] == 'rojo':
                mut += 1
                cazados += p['resultado'] == 'cazado'
            else:
                bien += 1
                bien_verde += p['resultado'] == 'en verde'
    return {'mutantes': mut, 'cazados': cazados, 'bien': bien, 'bien_en_verde': bien_verde,
            'correctores_que_faltan': sorted(faltan)}


def comparar(actual, congelado):
    regresion, nuevos = [], []
    for eid, e in actual.items():
        antes = congelado.get('ejercicios', {}).get(eid, {}).get('piezas', {})
        for arch, p in e['piezas'].items():
            a = antes.get(arch, {}).get('resultado')
            if p['esperado'] != 'rojo' and a == 'en verde' and p['resultado'] != 'en verde':
                regresion.append(f'{eid}/{arch}')
            if p['esperado'] == 'rojo' and p['resultado'] == 'cazado' and a != 'cazado':
                nuevos.append(f'{eid}/{arch}')
    return regresion, nuevos


def ultimo_score():
    c = sorted(p for p in glob.glob(os.path.join(SCORES, '*.json'))
               if os.path.basename(p) not in ('run_meta.json', 'congelado.json'))
    return c[-1] if c else None


def main():
    ap = argparse.ArgumentParser(description='Banco 3D')
    ap.add_argument('-j', type=int, default=4)
    ap.add_argument('--solo')
    ap.add_argument('--congelado')
    ap.add_argument('--congelar', action='store_true')
    a = ap.parse_args()
    os.makedirs(SCORES, exist_ok=True)
    if a.congelar:
        u = ultimo_score()
        if not u:
            print('no hay scores para congelar')
            return 2
        shutil.copyfile(u, os.path.join(SCORES, 'congelado.json'))
        print(f'congelado: {os.path.basename(u)} -> scores/congelado.json')
        return 0
    tareas = leer_tareas(a.solo)
    if not tareas:
        print(f'no hay ejercicios{" con id " + a.solo if a.solo else ""}')
        return 2
    t0, inicio = time.time(), dt.datetime.now()
    ejercicios = {}
    with cf.ThreadPoolExecutor(max_workers=max(1, a.j)) as ex:
        for eid, res in ex.map(correr_ejercicio, tareas):
            ejercicios[eid] = res
    r = resumen(ejercicios)
    destino = os.path.join(SCORES, inicio.strftime('%Y-%m-%d_%H%M') + '.json')
    if os.path.exists(destino):
        destino = os.path.join(SCORES, inicio.strftime('%Y-%m-%d_%H%M%S') + '.json')
    datos = {'run': os.path.splitext(os.path.basename(destino))[0], 'fecha': inicio.isoformat(timespec='seconds'),
             'solo': a.solo, 'resumen': r, 'ejercicios': ejercicios}
    with open(destino, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    try:
        b123 = md.version('build123d')
    except Exception:
        b123 = 'no instalado'
    meta = {'run': datos['run'], 'fecha': datos['fecha'], 'duracion_s': round(time.time() - t0, 1),
            'git_commit': git('rev-parse', 'HEAD'), 'git_rama': git('rev-parse', '--abbrev-ref', 'HEAD'),
            'git_sucio': bool(git('status', '--porcelain', '--', BASE)), 'python': platform.python_version(),
            'python_exe': PY, 'build123d': b123, 'hostname': socket.gethostname(), 'jobs': a.j,
            'ejercicios': sorted(ejercicios)}
    with open(os.path.join(SCORES, 'run_meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    for eid in sorted(ejercicios):
        for arch, p in ejercicios[eid]['piezas'].items():
            ctl = ', '.join(f'{n}={j["obtenido"]}' for n, j in p['controles'].items())
            print(f'  {eid:22s} {arch:34s} esperado {p["esperado"]:5s} -> {p["resultado"]:10s} [{ctl}]')
    faltan = r['correctores_que_faltan']
    print(f'BANCO 3D: caza {r["cazados"]} de {r["mutantes"]} mutantes (un mutante cuenta cazado si al menos un '
          f'corrector listado da rojo) · BIEN en verde {r["bien_en_verde"]} de {r["bien"]} · correctores que faltan: '
          f'{len(faltan)}' + (f' ({", ".join(faltan)})' if faltan else ''))
    print(f'scores: {os.path.relpath(destino, BASE)}  ({meta["duracion_s"]} s)')
    if a.congelado:
        ruta = a.congelado if os.path.isabs(a.congelado) else os.path.join(BASE, a.congelado)
        with open(ruta, encoding='utf-8') as f:
            cong = json.load(f)
        reg, nuevos = comparar(ejercicios, cong)
        print('BIEN que antes daba verde y ahora rojo: ' + (', '.join(reg) if reg else 'ninguna'))
        print('mutantes nuevos cazados: ' + (', '.join(nuevos) if nuevos else 'ninguno'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
