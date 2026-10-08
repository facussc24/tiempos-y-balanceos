# -*- coding: utf-8 -*-
"""
vocabulario_planta.py - en un documento para la planta va solo vocabulario que Barack usa.

Origen (Fak, 08/10/2026): un flujograma generado por Claude decia «RESTITUCION DE CONTROL DE
MATERIA PRIMA (IQC) CON CUARENTENA...» y Fak: «no se entiende un carajo... es gravisimo... jamas
podes poner algo que yo no pueda defender o que no entienda... nadie lo va a entender, incluso
los gerentes». Los controles que ya existian miran palabras PROHIBIDAS (lista negra): una palabra
nueva que nadie penso en prohibir pasaba. Este control da vuelta la logica: es una LISTA BLANCA.
Una palabra pasa si Barack la usa (esta en lo que escribieron sus personas) o si alguien la
aprobo con fuente. Todo lo demas se frena y se dice cual palabra y donde.

De donde sale lo que Barack usa (`vocabularioPlanta.data.json`, lo arma
`scripts/_vocabularioPlanta.py --construir`):
  - las hojas de operaciones de Excel del servidor (modificadas antes del 01/08/2026),
  - los procedimientos e instructivos del SGC (carpeta SISTEMA),
  - los mensajes que escribio Fak.
Mas dos listas a mano, ambas con `fuente` obligatoria: `aprobadas` y `prohibidas`.

GEMELO: `vocabularioPlanta.mjs` hace exactamente lo mismo leyendo el MISMO data.json. Si se toca
una regla de aca se toca alla, y el test de paridad (`__tests__/scripts/vocabularioPlanta.test.mjs`)
corre las dos sobre los mismos textos y exige la misma respuesta.

Que cuenta como palabra (identico en los dos lenguajes):
  - minusculas y sin tildes ni virgulilla (la enie es n: asi escribe Fak y asi lo hace redaccion.py);
  - solo letras de a-z, de 2 a 40 letras;
  - un trozo que lleva ALGUN numero es un codigo y no se mira: 2HC.858.417, N 231, MP8147,
    21-9689, OP-10, 10mm, I-IN-002.4-R01. Las siglas SI cuentan como palabras: IQC no pasa si
    no esta en el corpus.
  - las unidades (mm, kg, bar...) se ignoran, y estan en `ignoradas`, con su fuente.

Uso como libreria:
    from vocabulario_planta import revisar_textos, exigir_vocabulario
    exigir_vocabulario([("paso 3", "Colocar la pieza")])   # SystemExit(1) si hay palabras fuera
CLI: `python scripts/_vocabularioPlanta.py --revisar "texto"`.
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
DATOS = os.path.join(AQUI, 'vocabularioPlanta.data.json')
# Las otras listas de palabras prohibidas que ya existian: se LEEN, no se copian (una sola fuente).
VOCAB_HOJAS = os.path.join(RAIZ, '.claude', 'skills', 'hojas-de-proceso', 'vocabulario.data.json')
FORBIDDEN_AMFE = os.path.join(RAIZ, 'core', 'amfe', 'forbiddenContent.data.json')

# Un trozo = letras y numeros pegados, con . _ / - adentro (2HC.858.417, 21-9689, pre-armado).
_TROZO = re.compile(r'[a-z0-9]+(?:[._/\-][a-z0-9]+)*')
_URL_MAIL = re.compile(r'(?:https?://|www\.)\S+|\S+@\S+\.\S+')
# Rutas de Windows (C:\Dev\...), de red (\\servidor\...) y nombres de archivo (ico_13756.png): los
# specs de las hojas llevan las rutas de los iconos EPP en el mismo campo que el texto.
_RUTA = re.compile(r'[a-z]:[\\/][^\s"\'<>|]*|\\\\[^\s"\'<>|]+|'
                   r'\b[\w\-]+\.(?:png|jpe?g|ico|gif|bmp|svg|pdf|xlsx?|docx?|pptx?|json|py|mjs|txt|csv)\b')
_SEPARA = re.compile(r'[._/\-]')
_TIENE_NUMERO = re.compile(r'[0-9]')
MIN_LARGO = 2
MAX_LARGO = 40


def plano(s):
    """Minusculas y sin tildes ni virgulilla. Igual que `_plano` de redaccion.py."""
    s = unicodedata.normalize('NFD', str(s if s is not None else ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def palabras(texto):
    """Las palabras de un texto, en orden y con repetidas (ver el docstring de arriba)."""
    t = _RUTA.sub(' ', _URL_MAIL.sub(' ', plano(texto)))
    out = []
    for trozo in _TROZO.findall(t):
        if _TIENE_NUMERO.search(trozo):
            continue
        for p in _SEPARA.split(trozo):
            if MIN_LARGO <= len(p) <= MAX_LARGO:
                out.append(p)
    return out


def variantes(p):
    """Formas de una palabra que cuentan como LA MISMA para el corpus: plural y genero.
    pieza/piezas, reproceso/reprocesos/reprocesa, operacion/operaciones, control/controles."""
    bases = {p}
    if p.endswith('ones') and len(p) > 5:
        bases.add(p[:-2])                    # operaciones -> operacion
    if p.endswith('ces') and len(p) > 4:
        bases.add(p[:-3] + 'z')              # lapices -> lapiz
    if p.endswith('es') and len(p) > 4:
        bases.add(p[:-2])                    # controles -> control
    if p.endswith('s') and len(p) > 3:
        bases.add(p[:-1])                    # piezas -> pieza
    out = set()
    for b in bases:
        out.add(b)
        out.add(b + 's')
        out.add(b + 'es')
        if len(b) > 3 and b[-1] in 'ao':
            g = b[:-1] + ('o' if b[-1] == 'a' else 'a')
            out.add(g)
            out.add(g + 's')
    return out


_cache = {}


def cargar(ruta=DATOS):
    """Lee el data.json y le suma las otras listas de prohibidas. Si falta un archivo, FALLA:
    un control que no encuentra su lista y sigue como si nada esta apagado."""
    clave = os.path.abspath(ruta)
    if clave in _cache:
        return _cache[clave]
    with open(ruta, encoding='utf-8') as f:
        d = json.load(f)
    reglas = d.get('reglas', {})
    corpus = d.get('corpus', {})
    fuentes = d.get('corpus_fuentes', [])
    ign = set()
    for blk in d.get('ignoradas', {}).values():
        if isinstance(blk, dict):
            ign.update(blk.get('palabras', []))
    aprob = d.get('aprobadas', {})
    proh = d.get('prohibidas', {})
    # Sin fuente no entra (Fak, 08/10/2026): una entrada a mano sin fuente rompe la carga.
    for seccion, lista in (('aprobadas', aprob), ('prohibidas', proh)):
        for k, v in lista.items():
            if not isinstance(v, dict) or not str(v.get('fuente', '')).strip():
                raise ValueError(f'vocabularioPlanta.data.json: "{k}" de {seccion} no tiene fuente')
            if k != plano(k) or palabras(k) != [k]:
                raise ValueError(f'vocabularioPlanta.data.json: "{k}" de {seccion} tiene que ser UNA palabra '
                                 'en minusculas y sin tildes')
    patrones = []   # (regex compilada, reemplazo, motivo, fuente) de las otras listas
    # 1. las hojas de proceso (regex sobre el texto plano)
    with open(VOCAB_HOJAS, encoding='utf-8') as f:
        hojas = json.load(f)
    for e in hojas.get('prohibidos', []):
        patrones.append((re.compile(e['patron']), e.get('reemplazo', ''), e.get('motivo', ''),
                         e.get('fuente', '') + ' [vocabulario.data.json de hojas-de-proceso]'))
    # 2. el candado anti-invento del AMFE (peninsulares e ingles random)
    with open(FORBIDDEN_AMFE, encoding='utf-8') as f:
        amfe = json.load(f)
    for lista, motivo in (('PENINSULAR_TERMS', 'espanolismo que en Barack no se dice'),
                          ('ENGLISH_RANDOM_TERMS', 'ingles o castellano que nadie en Barack usa')):
        for t in amfe.get(lista, []):
            patrones.append((re.compile(r'\b' + re.escape(plano(t)) + r'\b'), '', motivo,
                             'core/amfe/forbiddenContent.data.json ' + lista))
    r = {'datos': d, 'reglas': reglas, 'corpus': corpus, 'fuentes': fuentes, 'ignoradas': ign,
         'aprobadas': aprob, 'prohibidas': proh, 'patrones': patrones}
    _cache[clave] = r
    return r


def _fuente_de(corpus_entry, fuentes):
    out = []
    for x in corpus_entry[3:]:
        if isinstance(x, int) and 0 <= x < len(fuentes):
            out.append(fuentes[x])
    return out


def _evidencia(entry, reglas):
    """True si el corpus alcanza para decir «Barack usa esta palabra»."""
    ho, sgc, fak = entry[0], entry[1], entry[2]
    if ho >= reglas.get('min_docs_ho', 1) or sgc >= reglas.get('min_docs_sgc', 1):
        return True
    # Lo que dice Fak en el chat NO alcanza solo salvo que `min_mensajes_fak` sea un numero: medido el
    # 08/10/2026, de las 1.969 palabras que solo estan en sus mensajes (3+ veces) la mitad son typos
    # («bine», «lso», «digmaos») y el resto castellano de chat o jerga de programacion (commit, build).
    minimo = reglas.get('min_mensajes_fak')
    return bool(minimo) and fak >= minimo


def evaluar_palabra(p, cfg):
    """('ok', info) | ('prohibida', info) | ('fuera', info) para UNA palabra ya normalizada."""
    vs = variantes(p)
    for v in sorted(vs):
        if v in cfg['prohibidas']:
            e = cfg['prohibidas'][v]
            return 'prohibida', {'reemplazo': e.get('reemplazo', ''), 'nota': e.get('nota', ''),
                                 'fuente': e.get('fuente', '')}
    for v in sorted(vs):
        if v in cfg['ignoradas']:
            return 'ok', {'por': 'ignorada'}
        if v in cfg['aprobadas']:
            return 'ok', {'por': 'aprobada', 'fuente': cfg['aprobadas'][v].get('fuente', '')}
    for v in sorted(vs):
        e = cfg['corpus'].get(v)
        if e is not None and _evidencia(e, cfg['reglas']):
            return 'ok', {'por': 'corpus', 'palabra': v, 'fuentes': _fuente_de(e, cfg['fuentes'])}
    return 'fuera', {}


def revisar_textos(items, ruta=DATOS):
    """items: lista de (donde, texto). Devuelve la lista de hallazgos, UNO por palabra y lugar:
    {palabra, motivo: 'prohibida'|'fuera_del_corpus', donde, texto, reemplazo, nota, fuente}.
    Vacia = el documento pasa."""
    cfg = cargar(ruta)
    out = []
    for donde, texto in items:
        if not isinstance(texto, str) or not texto.strip():
            continue
        vistas = set()
        for p in palabras(texto):
            if p in vistas:
                continue
            vistas.add(p)
            estado, info = evaluar_palabra(p, cfg)
            if estado == 'prohibida':
                out.append({'palabra': p, 'motivo': 'prohibida', 'donde': donde, 'texto': texto,
                            'reemplazo': info['reemplazo'], 'nota': info['nota'],
                            'fuente': info['fuente']})
            elif estado == 'fuera':
                out.append({'palabra': p, 'motivo': 'fuera_del_corpus', 'donde': donde,
                            'texto': texto, 'reemplazo': '', 'nota': '', 'fuente': ''})
        # las prohibidas en forma de regex (varias palabras: «contenedor de rechazo»)
        pl = plano(texto)
        for rx, reemplazo, motivo, fuente in cfg['patrones']:
            m = rx.search(pl)
            if m:
                pal = m.group(0)
                exist = next((h for h in out if h['palabra'] == pal and h['donde'] == donde), None)
                if exist:
                    if exist['motivo'] != 'prohibida' or (not exist['reemplazo'] and reemplazo):
                        exist['motivo'] = 'prohibida'
                        exist['reemplazo'] = reemplazo or exist['reemplazo']
                        exist['nota'] = motivo or exist['nota']
                        exist['fuente'] = fuente or exist['fuente']
                else:
                    out.append({'palabra': pal, 'motivo': 'prohibida', 'donde': donde,
                                'texto': texto, 'reemplazo': reemplazo, 'nota': motivo,
                                'fuente': fuente})
    return out


def resumir(hallazgos):
    """Agrupa por palabra: {palabra: {motivo, donde: [lugares], reemplazo, nota, fuente}}."""
    r = {}
    for h in hallazgos:
        e = r.setdefault(h['palabra'], {'motivo': h['motivo'], 'donde': [], 'reemplazo': h['reemplazo'],
                                        'nota': h['nota'], 'fuente': h['fuente']})
        e['donde'].append(h['donde'])
        if h['motivo'] == 'prohibida':
            e['motivo'] = 'prohibida'
    return r


def texto_de_hallazgos(hallazgos, maximo_lugares=3):
    """El mensaje que lee Fak: cada palabra, por que, y en que renglon esta."""
    lineas = []
    for p, e in sorted(resumir(hallazgos).items()):
        lugares = ', '.join(e['donde'][:maximo_lugares]) + (
            f' (+{len(e["donde"]) - maximo_lugares} mas)' if len(e['donde']) > maximo_lugares else '')
        if e['motivo'] == 'prohibida':
            sugerencia = f' -> va "{e["reemplazo"]}"' if e['reemplazo'] else ''
            lineas.append(f'  "{p}": prohibida{sugerencia}. {e["nota"]} [{e["fuente"]}]\n      en: {lugares}')
        else:
            lineas.append(f'  "{p}": no la usa nadie de Barack (no esta en sus hojas, procedimientos ni en lo que '
                          f'dice Fak).\n      en: {lugares}')
    return '\n'.join(lineas)


def exigir_vocabulario(items, ruta=DATOS, nombre='el documento'):
    """El gate bloqueante: imprime lo hallado y sale con 1 si hay una palabra fuera."""
    h = revisar_textos(items, ruta)
    if h:
        print(f'\n  {nombre.upper()} NO SE GENERA: tiene {len(resumir(h))} palabra(s) que Barack no usa.')
        print(texto_de_hallazgos(h))
        print('\n  Se reemplaza por la palabra que la planta usa. Si la palabra es correcta, se agrega a\n'
              '  `aprobadas` de scripts/_lib/vocabularioPlanta.data.json CON su fuente (un documento de\n'
              '  Barack o un mensaje de Fak). Sin fuente no entra (Fak, 08/10/2026).')
        raise SystemExit(1)
    return True


if __name__ == '__main__':
    for _f in (sys.stdout, sys.stderr):
        try:
            _f.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    txt = ' '.join(sys.argv[1:])
    hal = revisar_textos([('texto', txt)])
    print(texto_de_hallazgos(hal) if hal else 'verde: todas las palabras son de Barack')
    sys.exit(1 if hal else 0)
