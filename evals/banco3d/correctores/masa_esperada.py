"""Corrector 'masa_esperada': la masa de la pieza (volumen del STEP x densidad) contra la masa esperada, con tolerancia.

Uso:
  python masa_esperada.py <archivo.step> --esperado <g> [--tolerancia 1] [--densidad 7.86]
  python masa_esperada.py <archivo.step> --esperado q3=934.78,q4=1027.09 [--tolerancia 1] [--densidad 7.86]

  --esperado    un numero: la masa (g) de todo el STEP (la suma de sus solidos).
                nombre=g,nombre=g: la masa (g) de cada pieza con ese nombre en el STEP (el nombre de producto que
                lleva el STEP). Tienen que estar todas, y no puede haber piezas de mas ni solidos sin nombre.
  --tolerancia  g de diferencia admitida (por defecto 1).
  --densidad    g/cm3 (por defecto 7.86: el «Steel» de CATIA V5, 7860 kg/m3, segun el informe que genera CATIA en
                la skill cad-design: scripts/catia/_casos_fem/informe_completo_ej60.html, l.82 y l.94).

Nunca da verde sin medir: archivo que no esta, STEP ilegible, sin solidos, un solido invalido o de volumen 0, un nombre
que falta, sobra o se repite = ROJO con el motivo. Sin --esperado (o con TBD) sale con 2: sin la masa esperada no se
juzga. La masa no ve un espejo ni dos cotas que se compensan: es un control de lectura del plano, no de forma.
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse, json, os, sys

NOMBRE = 'masa_esperada'


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': NOMBRE, 'veredicto': veredicto, 'detalle': detalle, 'medidas': medidas or {}},
                     ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def leer_esperado(texto):
    """'934.78' -> 934.78 (todo el STEP); 'q3=934.78,q4=1027.09' -> {'q3': 934.78, 'q4': 1027.09}."""
    t = (texto or '').strip()
    if not t or t.upper() == 'TBD':
        salir('error', 'falta la masa esperada (--esperado TBD o vacio): no se puede juzgar')
    try:
        if '=' not in t:
            return float(t)
        esperado = {}
        for par in t.split(','):
            nombre, valor = par.split('=')
            nombre = nombre.strip()
            if not nombre or nombre in esperado:
                raise ValueError(f'nombre vacio o repetido en {par!r}')
            esperado[nombre] = float(valor)
        return esperado
    except ValueError as e:
        salir('error', f'--esperado tiene que ser un numero o nombre=g,nombre=g (llego {texto!r}: {e})')


def piezas_del_step(raiz):
    """Separa las piezas con nombre (nombre -> lista de formas) y los solidos sueltos sin nombre."""
    con_nombre, sin_nombre = {}, []

    def visitar(forma):
        nombre = (getattr(forma, 'label', '') or '').strip()
        if nombre:
            con_nombre.setdefault(nombre, []).append(forma)
            return
        hijos = list(getattr(forma, 'children', None) or [])
        if hijos:
            for h in hijos:
                visitar(h)
        else:
            sin_nombre.extend(forma.solids())

    hijos = list(getattr(raiz, 'children', None) or [])
    for h in (hijos or [raiz]):
        visitar(h)
    return con_nombre, sin_nombre


def volumen(solidos, quien):
    """Suma de volumenes (mm3); None y el motivo si no se puede medir bien."""
    if not solidos:
        return None, f'{quien}: no tiene solidos'
    malos = sum(1 for s in solidos if not s.is_valid)
    if malos:
        return None, f'{quien}: {malos} solido(s) invalido(s), el volumen no es confiable'
    v = sum(s.volume for s in solidos)
    if not v > 0:
        return None, f'{quien}: volumen {v:.3f} mm3 (cero o negativo)'
    return v, ''


def main():
    ap = argparse.ArgumentParser(description='masa del STEP contra la masa esperada')
    ap.add_argument('archivo')
    ap.add_argument('--esperado')
    ap.add_argument('--tolerancia', type=float, default=1.0)
    ap.add_argument('--densidad', type=float, default=7.86)
    a = ap.parse_args()
    esperado = leer_esperado(a.esperado)
    if not a.tolerancia >= 0 or not a.densidad > 0:
        salir('error', f'tolerancia ({a.tolerancia}) tiene que ser >= 0 y densidad ({a.densidad}) > 0')
    if not a.archivo.lower().endswith(('.step', '.stp')):
        salir('error', f'este corrector lee STEP (llego {os.path.basename(a.archivo)})')
    base = {'unidad': 'g', 'densidad_g_cm3': a.densidad, 'tolerancia_g': a.tolerancia}
    if not os.path.exists(a.archivo):
        salir('rojo', f'no esta el archivo: no se midio nada ({a.archivo})', base)
    try:
        from build123d import import_step
        raiz = import_step(a.archivo)
    except Exception as e:  # STEP ilegible: no se midio, no puede dar verde
        salir('rojo', f'STEP ilegible: {type(e).__name__}: {str(e)[:200]}', base)
    g_por_mm3 = a.densidad / 1000.0

    if isinstance(esperado, float):
        v, motivo = volumen(raiz.solids(), 'el STEP')
        if v is None:
            salir('rojo', motivo, {**base, 'masa_esperada': esperado})
        m = v * g_por_mm3
        dif = m - esperado
        med = {**base, 'masa_esperada': esperado, 'masa_obtenida': round(m, 3), 'diferencia': round(dif, 3),
               'volumen_mm3': round(v, 3)}
        ok = abs(dif) <= a.tolerancia + 1e-9
        salir('verde' if ok else 'rojo',
              f'{m:.3f} g (esperado {esperado:.2f}, dif {dif:+.3f}, tolerancia {a.tolerancia:g})', med)

    con_nombre, sin_nombre = piezas_del_step(raiz)
    med = {**base, 'masa_esperada': esperado, 'masa_obtenida': {}, 'diferencia': {}, 'volumen_mm3': {},
           'por_pieza': {}, 'nombres_en_el_step': sorted(con_nombre), 'solidos_sin_nombre': len(sin_nombre)}
    rojos, verdes = [], []
    for nombre, esp in esperado.items():
        formas = con_nombre.get(nombre)
        if not formas:
            rojos.append(f'{nombre}: no esta en el STEP')
            med['por_pieza'][nombre] = 'rojo'
            continue
        if len(formas) > 1:
            rojos.append(f'{nombre}: el nombre esta {len(formas)} veces')
            med['por_pieza'][nombre] = 'rojo'
            continue
        v, motivo = volumen(formas[0].solids(), nombre)
        if v is None:
            rojos.append(motivo)
            med['por_pieza'][nombre] = 'rojo'
            continue
        m = v * g_por_mm3
        dif = m - esp
        med['masa_obtenida'][nombre] = round(m, 3)
        med['diferencia'][nombre] = round(dif, 3)
        med['volumen_mm3'][nombre] = round(v, 3)
        linea = f'{nombre} {m:.3f} g (esperado {esp:.2f}, dif {dif:+.3f})'
        if abs(dif) <= a.tolerancia + 1e-9:
            verdes.append(linea)
            med['por_pieza'][nombre] = 'verde'
        else:
            rojos.append(linea + f' FUERA de {a.tolerancia:g} g')
            med['por_pieza'][nombre] = 'rojo'
    sobran = sorted(set(con_nombre) - set(esperado))
    if sobran:
        rojos.append(f'piezas en el STEP sin masa esperada: {", ".join(sobran)}')
    if sin_nombre:
        rojos.append(f'{len(sin_nombre)} solido(s) sin nombre en el STEP')
    if rojos:
        salir('rojo', ' · '.join(rojos + verdes), med)
    salir('verde', ' · '.join(verdes) + f' (tolerancia {a.tolerancia:g} g, densidad {a.densidad:g} g/cm3)', med)


if __name__ == '__main__':
    main()
