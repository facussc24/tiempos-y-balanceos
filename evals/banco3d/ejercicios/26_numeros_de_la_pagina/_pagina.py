"""Comun del ejercicio 26 (numeros de la pagina de entrega): arma un modelo chico con build123d, MIDE sus luces con la
distancia exacta de OpenCASCADE y escribe, al lado del .stl y del .step, la fuente de la pagina (pasos.json), la pagina
(html) y el JSON de medidas. Asi el JSON sale del build, que es lo que pide el P13 (docs/PROPUESTAS_SKILL_3D_2026-10-23.md
l.498): no se escribe a mano.

El modelo es de ensayo, NO el virolador: un panel de 200 x 40 x 4 y ocho tacos de 8 x 8 x 3 puestos sobre su cara
superior a las distancias que el auditor midio el 20/10/2026 sobre el virolador manual (AUDITORIA_auditor.md l.57:
tope de borde 1 = 0,577, tope de borde 2 = 0,5755, tope lateral = 2,016, machos 0,1394 / 0,1404, apoyos 0,495; l.122-125:
barra a 69,6 mm del panel, brazo B a 47,208). Los nombres de las claves llevan la unidad al final (luz_mm), como pide el
control para poder decir que un numero contradice a su medida.

  construir(luces) -> (compuesto, medidas)   medidas[clave] = distancia medida (4 decimales)
  pasos_leidos(m, m_viejo=None)              la fuente de la pagina LEYENDO el JSON (BIEN y MAL 2)
  pasos_tipeados()                           la fuente de la pagina del 20/10 con los dos numeros escritos a mano (MAL 1)
  escribir(nombre, compuesto, medidas, pasos, medidas_viejas=None)
Escribe <carpeta>/<nombre>.stl y .step, <nombre>__pasos.json, <nombre>__pagina.html y <nombre>__medidas.json (y
<nombre>__medidas_v1.json si hay una version vieja de las medidas)."""
import html
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
from _comun import carpeta_salida, salir_error  # noqa: E402

# (clave del JSON, distancia al panel en mm): lo que midio el auditor del 20/10 (ver el docstring)
LUCES = [
    ('tope_borde_1_luz_mm', 0.577),
    ('tope_borde_2_luz_mm', 0.5755),
    ('tope_lateral_luz_mm', 2.016),
    ('macho_1_plastico_luz_mm', 0.1394),
    ('macho_2_plastico_luz_mm', 0.1404),
    ('apoyo_tapizado_luz_mm', 0.495),
    ('barra_a_panel_mm', 69.6),
    ('brazo_B_a_panel_mm', 47.208),
]


def luces(**cambios):
    """LUCES con algun valor cambiado (la version vieja del modelo del MAL 2)."""
    return [(k, cambios.get(k, v)) for k, v in LUCES]


def construir(lista):
    from build123d import Box, Compound, Pos
    panel = Pos(0, 0, -2.0) * Box(200, 40, 4)                 # la cara de arriba esta en z = 0
    piezas, medidas = [panel], {}
    for i, (clave, luz) in enumerate(lista):
        taco = Pos(-80.0 + 20.0 * i, 0, luz + 1.5) * Box(8, 8, 3)       # su base esta en z = luz
        d = taco.distance_to(panel)
        if abs(d - luz) > 1e-6:
            salir_error(f'{clave}: la distancia medida {d} no es la construida {luz}')
        medidas[clave] = round(d, 4)
        piezas.append(taco)
    return Compound(children=piezas), medidas


def coma(x, decimales):
    return f'{x:.{decimales}f}'.replace('.', ',')


def pasos_leidos(m, m_viejo=None):
    """La fuente de la pagina armada LEYENDO el JSON de medidas por clave. Con m_viejo (MAL 2) el resumen lee la
    luz del tope de borde 2 de la version vieja del JSON, que se quedo en la carpeta."""
    paso = [
        'Asentado: entre machos y plástico de la ranura quedan %s mm (ahí va la tela). El tope de borde 2 queda a %s mm '
        'del plástico del borde: si el tapizado envuelve ese borde, el tope se corre (a confirmar con la pieza).'
        % (coma(m['macho_1_plastico_luz_mm'], 2), coma(m['tope_borde_2_luz_mm'], 2)),
    ]
    if m_viejo is None:
        # el mismo dato dicho con otra precision: 0,58 arriba y 0,5755 aca. No es un dato con dos valores.
        paso.append('Resumen: tope de borde 2, luz de %s mm.' % coma(m['tope_borde_2_luz_mm'], 4))
    else:
        paso.append('Resumen: el tope de borde 2 queda a %s mm del plástico del borde.'
                    % coma(m_viejo['tope_borde_2_luz_mm'], 1))
    paso.append('Revisado el 24/10 a las 13:50 contra la v14; criterio ISO 13854, tornillos M4x16, 3 patitas.')
    return {
        'ahora': 'Fase 2 cerrada; seguimos con la fase 3. Objetivo: imprimir el lunes 26/10.',
        'pasos': [{'titulo': 'Fase 2 · Que funcione', 'estado': 'hecho', 'decidido': paso}],
        'grupos': {'4 Operario y puesto': 'carga de arriba con la palanca abierta (la barra queda %s mm arriba del panel); '
                                          'una sola palanca; sin herramientas.' % coma(m['barra_a_panel_mm'], 1)},
    }


def pasos_tipeados():
    """Las dos frases de pasos.json de las 13:50 del 20/10/2026, con sus numeros escritos a mano. Texto tomado del
    Edit que las escribio (transcripto en la sesion cc6c4c38, linea 1784 del jsonl, 16:50:12Z) y de grupos «4 Operario y
    puesto» del mismo archivo (pasos.json:56 y :100 segun AUDITORIA_auditor.md l.54 y l.122)."""
    return {
        'ahora': 'Fase 2 cerrada; seguimos con la fase 3. Objetivo: imprimir el lunes 26/10.',
        'pasos': [{'titulo': 'Fase 2 · Que funcione', 'estado': 'hecho', 'decidido': [
            'Asentado: entre machos y plástico de la ranura quedan 0,14 mm (ahí va la tela). El tope de borde 2 queda a '
            '0,1 mm del plástico del borde: si el tapizado envuelve ese borde, el tope se corre (a confirmar con la '
            'pieza).',
            'Revisado el 24/10 a las 13:50 contra la v14; criterio ISO 13854, tornillos M4x16, 3 patitas.']}],
        'grupos': {'4 Operario y puesto': 'carga de arriba con la palanca abierta (la barra queda 47 mm arriba del '
                                          'panel); una sola palanca; sin herramientas.'},
    }


def pagina_html(pasos):
    """La pagina como la arma pagina.py del virolador: titulos y listas, todo escapado."""
    partes = []
    for i, p in enumerate(pasos['pasos'], 1):
        items = ''.join(f'<li>{html.escape(x)}</li>' for x in p.get('decidido', []))
        partes.append(f'<section><h2>{i}. {html.escape(p["titulo"])}</h2><ul>{items}</ul></section>')
    grupos = ''.join(f'<li><b>{html.escape(k)}:</b> {html.escape(v)}</li>' for k, v in pasos['grupos'].items())
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pagina de avance</title>'
            '<style>body{font:16px system-ui}</style></head><body>\n'
            f'<p class="ahora">Ahora: {html.escape(pasos["ahora"])}</p>\n' + '\n'.join(partes) +
            f'\n<details><summary>Las preguntas antes de disenar</summary><ul>{grupos}</ul></details>\n</body></html>\n')


def escribir(nombre, compuesto, medidas, pasos, medidas_viejas=None):
    from build123d import export_step, export_stl
    out = carpeta_salida()
    export_stl(compuesto, os.path.join(out, nombre + '.stl'))
    export_step(compuesto, os.path.join(out, nombre + '.step'))
    with open(os.path.join(out, nombre + '__pasos.json'), 'w', encoding='utf-8') as f:
        json.dump(pasos, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, nombre + '__pagina.html'), 'w', encoding='utf-8') as f:
        f.write(pagina_html(pasos))
    with open(os.path.join(out, nombre + '__medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(medidas, f, ensure_ascii=False, indent=1)
    if medidas_viejas is not None:
        with open(os.path.join(out, nombre + '__medidas_v1.json'), 'w', encoding='utf-8') as f:
            json.dump(medidas_viejas, f, ensure_ascii=False, indent=1)
    print('ok', len(medidas), 'medidas')
