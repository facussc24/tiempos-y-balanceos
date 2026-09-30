# -*- coding: utf-8 -*-
"""
arbRelaciones.py - UN solo parser del export del arb (RELACIONES / ARTICULO / INSUMOS) y las
consultas de SOLO LECTURA que se le hacen a la BOM. Lo usa `scripts/_consumo.py`; la proxima
sesion que necesite leer el export lo importa de aca en vez de escribir otro `iconv` + parser
(03/08-30/09/2026: 258 iconv propios y 63 parsers inline, ver
docs/auto-mejora/2026-09-30-automejora-10-frentes.md §2).

    # desde otro script (la convencion del repo: cargar _lib por ruta, no por sys.path)
    import importlib.util, os
    spec = importlib.util.spec_from_file_location('arbRelaciones', os.path.join(AQUI, '_lib', 'arbRelaciones.py'))
    AR = importlib.util.module_from_spec(spec); spec.loader.exec_module(AR)

    rel, sello = AR.cargar()                  # elige el export RELACIONES mas nuevo y lo parsea
    rel.bom('0024760703-FZHE')                # lineas directas del producto (en el orden del export)
    rel.explotar('0024760703-FZHE', 3)        # BOM explotada: lista de Nodo con el acumulado
    rel.donde_se_usa('124.602.0228-1')        # quien usa el insumo, directo y por semielaborado
    rel.buscar('top roll')                    # por codigo o por texto de la descripcion
    sello.lineas()                            # el SELLO del dato (fecha del export, cargas posteriores)

    python scripts/_lib/arbRelaciones.py --selftest     # corre con fixtures reales recortados

NO ESCRIBE NADA: ni en el arb, ni en .arb-cache, ni en C:\\tmp. Solo lee.

EL FORMATO DEL EXPORT RELACIONES.TXT (verificado contra el export del 30/09/2026, 7515 lineas)
  cp1252, una fila por linea separada por TAB, arbol por bloques horizontales. En los DATOS cada
  nivel del arbol corre +7 columnas (0, 7, 14, 21); el ENCABEZADO usa otro layout (0, 9, 18, 27) y
  leer el offset de ahi da +9 y pierde los sub-ensambles (incidente 27/07/2026).
  Un bloque = [padre, rubro, medida(=codigo del insumo), descripcion, unidad, consumo] y, en el
  nivel 0, tambien [modulo, proceso]. Consumo con coma decimal y 8 decimales (`0,09800000`).
  Las filas de nivel 1 y 2 cuelgan del ultimo nivel 0 (la col 0 NO se repite: carry-forward) y
  su `padre` es el semielaborado al que pertenecen. Medido el 30/09/2026: todo semielaborado
  anidado tiene ademas su propia BOM como producto y las dos coinciden (409 de 409), asi que el
  grafo se arma con las filas de nivel 0 de cada producto.
  Una fila parte su descripcion en 2 lineas fisicas cuando la descripcion trae un salto (hasta
  agosto ~58 casos, casi todos hilos): la linea del codigo queda SIN unidad ni consumo y la
  siguiente es `<resto de la descripcion> | <unidad> | <consumo> [| <modulo> | <proceso>]`. Esa
  continuacion no tiene codigo en ningun bloque: el discriminador es el RUBRO (numero) al lado
  del codigo. Mismo criterio que scripts/_refreshArb.mjs y scripts/_lib/unidadesArb.mjs.
"""
import datetime
import io
import json
import os
import re
import sys
import unicodedata
from collections import OrderedDict, defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
# Las dos carpetas se pueden cambiar con variables de entorno (para probar sin tocar el arb real):
#   BARACK_ARB_TMP    donde exporta el arb (default C:\tmp)
#   BARACK_ARB_CACHE  el cache .arb-cache del repo (default <repo>/.arb-cache)
CACHE = os.environ.get('BARACK_ARB_CACHE') or os.path.join(RAIZ, '.arb-cache')
TMP_ARB = os.environ.get('BARACK_ARB_TMP') or 'C:\\tmp'
FIXTURES = os.path.join(RAIZ, '__tests__', 'scripts', 'fixtures')

OFFSETS = (0, 7, 14, 21)
HORAS_VIEJO = 24     # un export con mas de 24 h "puede estar viejo"
ESTADOS_ESCRITURA = ('enter_ok', 'escrita')   # journal de _arbCargar.py / _arbSustituir.py

# ---------------------------------------------------------------------------- canon de unidades
# Las familias de unidad (UN = UNI = UNID; MTS = MTL = ML, metro lineal...) viven en el canon
# que lee tambien el validador de JS. Una grafia nueva se agrega ALLA, no aca.
with io.open(os.path.join(AQUI, 'consumosCanon.data.json'), encoding='utf-8') as _fh:
    CANON = json.load(_fh)

ALIAS = {}
for _fam, _grafias in CANON['unidades_alias'].items():
    if _fam.startswith('_') or not isinstance(_grafias, list):
        continue
    for _g in _grafias:
        ALIAS[str(_g).upper()] = _fam
ENVASES = {str(e).upper() for e in CANON['unidades_empaque']['envases']}

# Solo para MOSTRAR (nombre corriente de la familia); la decision de familia es del canon.
NOMBRE_FAMILIA = {
    'UN': 'unidades', 'KG': 'kilos', 'GR': 'gramos', 'LT': 'litros', 'ML': 'metro lineal',
    'M2': 'metro cuadrado', 'M3': 'metro cubico', 'ROLLO': 'rollo', 'BI': 'bidon', 'LAT': 'lata',
    'CAJ': 'caja', 'BO': 'bolsa', 'JG': 'juego', 'FT2': 'pie cuadrado', 'GAL': 'galon', 'TON': 'tonelada',
}


def normalizar_unidad(u):
    """'UNID' -> ('UNID', 'UN'). Desconocida -> familia = la misma grafia. Vacia -> ('', '')."""
    crudo = str(u or '').strip().upper().rstrip('.')
    if not crudo:
        return '', ''
    return crudo, ALIAS.get(crudo, crudo)


def familia_unidad(u):
    return normalizar_unidad(u)[1]


def es_envase(u):
    return normalizar_unidad(u)[0] in ENVASES


# ---------------------------------------------------------------------------- texto y numeros

def decodificar(datos):
    """Los TXT del arb vienen en cp1252, no en UTF-8. bytes -> str; un str pasa como esta."""
    if isinstance(datos, str):
        return datos
    return datos.decode('cp1252', errors='replace')


def clave(codigo):
    """Clave para cruzar CODIGOS: sin NBSP, sin espacios en las puntas, en mayusculas (igual que
    claveCodigo de unidadesArb.mjs: el maestro real tiene 21 codigos con minuscula)."""
    return str(codigo or '').replace('\u00a0', ' ').strip().upper()


def normalizar_texto(s):
    """Para buscar: mayusculas, sin tildes, espacios colapsados."""
    s = str(s or '')
    if s.isascii():   # casi todo el maestro: se evita el NFD, que es lo caro
        return ' '.join(s.upper().split())
    t = unicodedata.normalize('NFD', s)
    t = ''.join(ch for ch in t if not unicodedata.combining(ch)).upper()
    return ' '.join(t.split())   # split() tambien junta el NBSP


def compacto(s):
    """Solo letras y numeros: '124.602.0228-1' y '1246020228 1' se comparan igual."""
    return re.sub(r'[^A-Z0-9]', '', normalizar_texto(s))


def num(s):
    """'0,09800000' -> 0.098 ; '1.234,5' -> 1234.5 ; '0.0002215' -> 0.0002215 ; vacio/ilegible -> None."""
    t = str(s if s is not None else '').replace('\u00a0', '').strip()
    if not t:
        return None
    if ',' in t and '.' in t:
        t = t.replace('.', '').replace(',', '.')
    elif ',' in t:
        t = t.replace(',', '.')
    try:
        return float(t)
    except ValueError:
        return None


def fmt_cant(x):
    """Cantidad como la imprime el arb: coma decimal y 8 decimales ('0,09800000')."""
    if x is None:
        return ''
    return ('%.8f' % x).replace('.', ',')


_ES_NUM = re.compile(r'^\d+([.,]\d+)?$')
_SOLO_NUMERO = re.compile(r'^[\d.,]+$')


def _g(fila, i):
    """Acceso seguro: el TXT no paddea, las filas vienen cortas."""
    return fila[i].strip() if i < len(fila) else ''


def _lineas(texto):
    """Parte en lineas sin tocar un \\r suelto adentro de una descripcion (el maestro real trae
    algunos): solo se normaliza el salto de linea de Windows."""
    return decodificar(texto).replace('\r\n', '\n').split('\n')


# ---------------------------------------------------------------------------- RELACIONES

class _Registro:
    """Base de las clases de datos de abajo. Se usan clases con __slots__ y no `dataclasses`:
    importar `dataclasses` arrastra `inspect` y suma ~0,3 s al arranque en esta PC cargada."""
    __slots__ = ()

    def __repr__(self):
        return '%s(%s)' % (type(self).__name__, ', '.join('%s=%r' % (k, getattr(self, k)) for k in self.__slots__))


class Fila(_Registro):
    """Una linea de BOM tal como la imprime el arb."""
    __slots__ = ('linea', 'nivel', 'raiz', 'padre', 'rubro', 'codigo', 'desc', 'unidad', 'consumo',
                 'cantidad', 'modulo', 'proceso')

    def __init__(self, linea, nivel, raiz, padre, rubro, codigo, desc='', unidad='', consumo='',
                 cantidad=None, modulo='', proceso=''):
        self.linea = linea          # numero de linea del TXT (desde 1)
        self.nivel = nivel          # 0 = directa del producto; 1 y 2 = anidada (colgada de un semielaborado)
        self.raiz = raiz            # producto de la col 0 (carry-forward)
        self.padre = padre          # quien la contiene: el producto (nivel 0) o el semielaborado (nivel >= 1)
        self.rubro = rubro
        self.codigo = codigo
        self.desc = desc
        self.unidad = unidad
        self.consumo = consumo      # texto tal cual ('0,09800000')
        self.cantidad = cantidad    # float, o None si no parsea
        self.modulo = modulo
        self.proceso = proceso


class Parseo(_Registro):
    __slots__ = ('filas', 'fusionadas', 'descartadas', 'cabecera')

    def __init__(self):
        self.filas = []
        self.fusionadas = []     # lineas que eran continuacion de otra
        self.descartadas = []    # filas con codigo que quedaron sin consumo
        self.cabecera = False


def _es_cabecera(celdas):
    return _g(celdas, 0).lower().startswith('art') and _g(celdas, 1).lower() == 'rubro'


_VACIAS = [''] * 40


def parsear_relaciones(texto):
    """RELACIONES.TXT (str o bytes cp1252) -> Parseo. Ver el formato en el docstring del modulo.

    No descarta nada en silencio: una fila con codigo que se queda sin consumo va a
    `descartadas` (tiene que dar 0 en un export sano)."""
    lineas = _lineas(texto)
    p = Parseo()
    filas = p.filas
    carry = {}
    pendiente = None   # fila con codigo a la que le falta unidad/consumo (sigue en la linea de abajo)

    def cerrar():
        nonlocal pendiente
        if pendiente is not None:
            if pendiente.consumo:
                filas.append(pendiente)
            else:
                p.descartadas.append((pendiente.codigo, pendiente.linea))
            pendiente = None

    for i, ln in enumerate(lineas, start=1):
        if not ln.strip():
            continue
        r = [c.strip() for c in ln.split('\t')]
        n = len(r)
        if n < 32:
            r.extend(_VACIAS[:32 - n])   # el TXT no paddea: con esto r[i] nunca se sale
        if not p.cabecera and not filas and _es_cabecera(r):
            p.cabecera = True
            continue
        # Una linea es fila real si en ALGUN bloque trae codigo Y rubro numerico. La continuacion de
        # una descripcion partida deja la unidad donde iria el rubro y no tiene codigo.
        bloques = [b for b in OFFSETS if r[b + 2] and (r[b + 1].isdigit() or _ES_NUM.match(r[b + 1]))]
        if not bloques:
            destino = pendiente if pendiente is not None else (filas[-1] if filas else None)
            trozo = [x for x in r if x]
            if destino is not None and trozo:
                txt, resto = trozo[0], trozo[1:]
                if txt and not _SOLO_NUMERO.match(txt):
                    destino.desc = ('%s %s' % (destino.desc, txt)).strip()
                for v in (resto if resto else [txt]):
                    if _SOLO_NUMERO.match(v) and not destino.consumo:
                        destino.consumo = v
                    elif not _SOLO_NUMERO.match(v) and not destino.unidad and v != txt:
                        destino.unidad = v
                if len(trozo) >= 4 and destino.modulo == '' and destino.nivel == 0:
                    # 6 columnas: resto | unidad | consumo | modulo | proceso
                    destino.modulo, destino.proceso = r[3], r[4]
                p.fusionadas.append((i, destino.codigo))
            if pendiente is not None and pendiente.consumo:
                cerrar()
            continue
        cerrar()   # la fila anterior ya no puede recibir fragmentos
        for nivel, b in enumerate(OFFSETS):
            if r[b]:
                carry[nivel] = r[b]
            if b not in bloques:
                continue
            f = Fila(linea=i, nivel=nivel, raiz=carry.get(0, ''), padre=carry.get(nivel, ''), rubro=r[b + 1],
                     codigo=r[b + 2], desc=r[b + 3], unidad=r[b + 4], consumo=r[b + 5],
                     modulo=r[b + 6] if nivel == 0 else '', proceso=r[b + 7] if nivel == 0 else '')
            if f.consumo:
                filas.append(f)
            else:
                pendiente = f
    cerrar()
    for f in filas:
        f.cantidad = num(f.consumo)
    return p


# ---------------------------------------------------------------------------- ARTICULO / INSUMOS

def parsear_articulos(texto):
    """ARTICULO.TXT -> {codigo: descripcion} (primera ocurrencia gana; la linea 1 es el encabezado)."""
    out = OrderedDict()
    for ln in _lineas(texto)[1:]:
        r = ln.split('\t')
        cod = _g(r, 0)
        if cod and cod not in out:
            out[cod] = _g(r, 1)
    return out


# Los marcos del reporte son caracteres de cp437 leidos como cp1252: bordes con una tira de la letra A con dieresis
# (ÚÄÄÄ...¿ / ÀÄÄÄ...Ù) y renglones que abren y cierran con ³. Una letra suelta de esa lista en una descripcion
# ("M³", "ÀNGELA") NO es un marco.
_RX_MARCO = re.compile('\u00c4{3,}|^\\s*\u00b3.*\u00b3\\s*$')


def _es_marco(s):
    return bool(_RX_MARCO.search(s))


def formato_insumos(texto):
    """'tabulado' (export con columnas, tiene unidad) | 'listado' (el reporte impreso) | 'vacio'."""
    lineas = [l for l in _lineas(texto[:4096]) if l.strip()]   # alcanza con el principio
    if not lineas:
        return 'vacio'
    return 'tabulado' if lineas[0].count('\t') >= 4 else 'listado'


def parsear_insumos(texto):
    """INSUMOS.TXT -> OrderedDict {codigo: {'desc', 'rubro', 'unidad'}} segun el formato.

    - tabulado: col[2] = codigo, col[3] = descripcion, col[5] = unidad.
    - listado (el reporte "Listado de Insumos BA", con "Hoja N"): columnas fijas, rubro en 0-4,
      codigo en 5-23, descripcion desde la 24; la descripcion larga sigue en lineas de abajo.
      NO trae unidad: queda ''. (Las descripciones con un salto adentro salen desordenadas del
      arb: sirven para buscar, no para citar.)"""
    out = OrderedDict()
    fmt = formato_insumos(texto)
    lineas = _lineas(texto)
    if fmt == 'tabulado':
        for ln in lineas[1:]:
            if not ln.strip():
                continue
            r = ln.split('\t')
            cod = _g(r, 2)
            if cod and cod not in out:
                out[cod] = {'desc': _g(r, 3), 'rubro': '', 'unidad': _g(r, 5)}
        return out
    if fmt == 'vacio':
        return out
    ultimo = None
    for ln in lineas:
        s = ln.rstrip()
        if not s.strip() or _es_marco(s) or s.startswith('\x1b') or re.match(r'^\s*Hoja\s+\d+', s):
            ultimo = None if _es_marco(s) else ultimo
            continue
        if len(s) > 24 and re.match(r'^\s*\d{1,2}\s*$', s[:5]) and s[5:24].strip():
            cod = s[5:24].strip()
            ultimo = cod
            if cod not in out:
                out[cod] = {'desc': s[24:].replace('\r', ' ').strip(), 'rubro': s[:5].strip(), 'unidad': ''}
            else:
                ultimo = None
        elif ultimo is not None:
            extra = s.replace('\r', ' ').strip()
            if extra:
                out[ultimo]['desc'] = ('%s %s' % (out[ultimo]['desc'], extra)).strip()
    return out


def parsear_maestro_csv(texto):
    """.arb-cache/insumos*.csv (`codigo,descripcion,unidad`) -> {codigo: unidad}."""
    out = {}
    lineas = decodificar(texto).replace('\ufeff', '').splitlines()
    for ln in lineas[1:]:
        i, j = ln.find(','), ln.rfind(',')
        if i < 0 or j <= i:
            continue
        cod = ln[:i].strip().strip('"')
        if cod:
            out[cod] = ln[j + 1:].strip().strip('"')
    return out


# ---------------------------------------------------------------------------- el modelo

class Nodo(_Registro):
    """Una linea de la BOM explotada."""
    __slots__ = ('nivel', 'fila', 'es_semi', 'acumulado', 'ciclo', 'cortado')

    def __init__(self, nivel, fila, es_semi, acumulado, ciclo=False, cortado=False):
        self.nivel = nivel            # 0 = directa del producto
        self.fila = fila
        self.es_semi = es_semi        # tiene BOM propia
        self.acumulado = acumulado    # cantidad por UNIDAD DEL PRODUCTO (producto de las cantidades del camino)
        self.ciclo = ciclo            # vuelve a un codigo que ya esta arriba en el camino
        self.cortado = cortado        # es semielaborado pero no se abrio (limite de niveles)


class Busqueda(_Registro):
    __slots__ = ('exacto', 'raices', 'otros')

    def __init__(self, exacto=None):
        self.exacto = exacto    # codigo exacto (str) o None
        self.raices = []        # productos con BOM que coinciden
        self.otros = []         # codigos sin BOM (insumos, articulos sin BOM)


class Relaciones:
    """El export RELACIONES indexado, mas las descripciones de ARTICULO e INSUMOS (opcionales).

    Todo se cruza por `clave(codigo)` (mayusculas, sin NBSP); los metodos aceptan el codigo tal
    cual y devuelven el codigo tal cual lo escribe el arb."""

    def __init__(self, parseo, articulos=None, insumos=None, maestro_viejo=None,
                 maestro_viejo_nombre='foto vieja del maestro'):
        """`articulos`, `insumos` y `maestro_viejo` pueden ser un dict o una funcion que lo devuelve: se
        llama recien cuando hace falta (INSUMOS.TXT pesa 1,3 MB y casi nunca se necesita)."""
        self.parseo = parseo
        self.filas = parseo.filas
        self._fuentes = {'articulos': articulos, 'insumos': insumos, 'viejo': maestro_viejo}
        self.maestro_viejo_nombre = maestro_viejo_nombre
        self._lazy = {}
        self._boms = OrderedDict()      # clave raiz -> (codigo, [Fila nivel 0])
        self._anidadas = {}             # clave padre -> [Fila] (solo para semis que NO son producto)
        self._desc = {}                 # clave -> (codigo, descripcion) de la linea de BOM
        self._unis = defaultdict(OrderedDict)   # clave -> {unidad: cuantas veces}
        self._padres = defaultdict(list)  # clave hijo -> [(codigo padre, Fila)]
        memo = {}

        def K(c):
            v = memo.get(c)
            if v is None:
                v = memo[c] = clave(c)
            return v
        for f in self.filas:
            k = K(f.codigo)
            self._desc.setdefault(k, (f.codigo, f.desc))
            if f.unidad:
                u = self._unis[k]
                u[f.unidad] = u.get(f.unidad, 0) + 1
            if f.nivel == 0:
                kr = K(f.raiz)
                if kr not in self._boms:
                    self._boms[kr] = (f.raiz, [])
                self._boms[kr][1].append(f)
        anid_raiz = {}
        for f in self.filas:
            if f.nivel == 0:
                continue
            kp = K(f.padre)
            if kp in self._boms:
                continue
            # un semielaborado sin BOM propia en el export: se usa lo que el arb anido (la primera raiz)
            anid_raiz.setdefault(kp, K(f.raiz))
            if anid_raiz[kp] == K(f.raiz):
                self._anidadas.setdefault(kp, []).append(f)
        for kr, (raiz, fs) in self._boms.items():
            for f in fs:
                self._padres[K(f.codigo)].append((raiz, f))
        for kp, fs in self._anidadas.items():
            for f in fs:
                self._padres[K(f.codigo)].append((f.padre, f))

    def _fuente(self, nombre):
        if nombre not in self._lazy:
            src = self._fuentes[nombre]
            self._lazy[nombre] = (src() if callable(src) else src) or {}
        return self._lazy[nombre]

    @property
    def articulos(self):
        """{clave: (codigo, descripcion)} de ARTICULO.TXT."""
        if 'articulos_k' not in self._lazy:
            self._lazy['articulos_k'] = {clave(k): (k, v) for k, v in self._fuente('articulos').items()}
        return self._lazy['articulos_k']

    @property
    def insumos(self):
        """{clave: (codigo, descripcion, rubro)} de INSUMOS.TXT (tabulado o listado)."""
        if 'insumos_k' not in self._lazy:
            self._lazy['insumos_k'] = {clave(k): (k, v['desc'], v.get('rubro', '')) for k, v in self._fuente('insumos').items()}
        return self._lazy['insumos_k']

    @property
    def maestro_viejo(self):
        """{clave: unidad} de la foto vieja del maestro (.arb-cache/insumos_AAAAMMDD_backup.csv)."""
        if 'viejo_k' not in self._lazy:
            self._lazy['viejo_k'] = {clave(k): v for k, v in self._fuente('viejo').items()}
        return self._lazy['viejo_k']

    # ----------------------------------------------------------------------- datos de un codigo
    def bom(self, codigo):
        """Lineas directas de un producto/semielaborado, en el orden del export. [] si no tiene."""
        k = clave(codigo)
        if k in self._boms:
            return list(self._boms[k][1])
        return list(self._anidadas.get(k, []))

    def es_producto(self, codigo):
        """Tiene BOM propia."""
        k = clave(codigo)
        return k in self._boms or k in self._anidadas

    def nombre(self, codigo):
        """El codigo tal cual lo escribe el arb (o el recibido si no esta)."""
        k = clave(codigo)
        if k in self._boms:
            return self._boms[k][0]
        if k in self._desc:
            return self._desc[k][0]
        for fuente in (self.articulos, self.insumos):
            if k in fuente:
                return fuente[k][0]
        return str(codigo)

    def descripcion(self, codigo):
        """De la linea de BOM (el maestro de hoy) > ARTICULO.TXT > INSUMOS.TXT. '' si ninguna."""
        k = clave(codigo)
        if k in self._desc and self._desc[k][1]:
            return self._desc[k][1]
        if k in self.articulos and self.articulos[k][1]:
            return self.articulos[k][1]
        if k in self.insumos:
            return self.insumos[k][1]
        return ''

    def unidades(self, codigo):
        """Unidades con que aparece el codigo en el export, la mas usada primero."""
        d = self._unis.get(clave(codigo), {})
        return [u for u, _ in sorted(d.items(), key=lambda kv: -kv[1])]

    def unidad(self, codigo):
        u = self.unidades(codigo)
        return u[0] if u else ''

    def tipo(self, codigo):
        """PRODUCTO (tiene BOM y nadie lo usa) | SEMI (tiene BOM y lo usa otro) | INSUMO (lo usan,
        no tiene BOM) | SIN USO (solo figura en ARTICULO/INSUMOS)."""
        k = clave(codigo)
        usado = k in self._padres
        if self.es_producto(k):
            return 'SEMI' if usado else 'PRODUCTO'
        return 'INSUMO' if usado else 'SIN USO'

    def avisos_unidad(self, codigo):
        """Lo que hay que saber de la unidad de un codigo antes de usar su consumo."""
        out = []
        us = self.unidades(codigo)
        if len(us) > 1:
            fams = {familia_unidad(u) for u in us}
            out.append('sale con DOS unidades en el export (%s)%s: mirar el maestro antes de cargar nada'
                       % (', '.join(us), ' - misma familia' if len(fams) == 1 else ''))
        if us and es_envase(us[0]):
            out.append('la unidad %s es un ENVASE: la BOM va en la unidad que lleva la pieza (canon unidades_empaque)' % us[0])
        viejo = self.maestro_viejo.get(clave(codigo))
        if us and viejo and familia_unidad(viejo) and familia_unidad(viejo) != familia_unidad(us[0]):
            out.append('la unidad cambio de %s (%s) a %s (cambio de ETIQUETA): confirmar que el consumo cargado '
                       'ya este en la unidad nueva' % (viejo, self.maestro_viejo_nombre, us[0]))
        return out

    # ----------------------------------------------------------------------- busqueda
    def _universo(self):
        u = OrderedDict()
        for kr, (raiz, _) in self._boms.items():
            u.setdefault(kr, raiz)
        for k, (cod, _) in self._desc.items():
            u.setdefault(k, cod)
        for k, (cod, _) in self.articulos.items():
            u.setdefault(k, cod)
        for k, (cod, _, _) in self.insumos.items():
            u.setdefault(k, cod)
        for kp in self._anidadas:
            u.setdefault(kp, self.nombre(kp))
        return u

    def buscar(self, consulta):
        """Por codigo (exacto, o que lo contiene) o por texto: todas las palabras tienen que estar
        en el codigo + la descripcion. Un codigo exacto gana solo."""
        universo = self._universo()
        kq = clave(consulta)
        if kq in universo:
            return Busqueda(exacto=universo[kq])
        palabras = [p for p in normalizar_texto(consulta).split(' ') if p]
        res = Busqueda()
        if not palabras:
            return res
        cq = compacto(consulta)
        for k, cod in universo.items():
            pajar = normalizar_texto('%s %s' % (cod, self.descripcion(cod)))
            ok = all(p in pajar for p in palabras)
            if not ok and len(cq) >= 4 and len(palabras) == 1:
                ok = cq in compacto(cod)   # '1246020228' encuentra '124.602.0228-1'
            if not ok:
                continue
            (res.raices if self.es_producto(k) else res.otros).append(cod)
        return res

    # ----------------------------------------------------------------------- explosion
    def explotar(self, codigo, max_nivel=3):
        """BOM explotada en el orden del export. `max_nivel` = cuantos niveles se abren por debajo
        de las lineas directas (0 = solo las directas). Cada Nodo trae el acumulado: la cantidad
        por unidad del producto, multiplicando las cantidades del camino."""
        out = []
        k0 = clave(codigo)

        def rec(cod, nivel, mult, camino):
            for f in self.bom(cod):
                kf = clave(f.codigo)
                semi = self.es_producto(kf)
                acum = None if (mult is None or f.cantidad is None) else mult * f.cantidad
                ciclo = kf in camino
                cortado = semi and not ciclo and nivel >= max_nivel
                out.append(Nodo(nivel, f, semi, acum, ciclo, cortado))
                if semi and not ciclo and nivel < max_nivel:
                    rec(f.codigo, nivel + 1, acum, camino | {kf})
        rec(codigo, 0, 1.0, {k0})
        return out

    @staticmethod
    def totales_hojas(nodos):
        """Suma del acumulado de los insumos finales (los que no se abren), por codigo, en el orden en
        que aparecen. Devuelve [(codigo, unidad, total, cuantas_lineas)]."""
        acc = OrderedDict()
        for n in nodos:
            if n.es_semi and not n.cortado and not n.ciclo:
                continue
            k = clave(n.fila.codigo)
            if k not in acc:
                acc[k] = [n.fila.codigo, n.fila.unidad, 0.0, 0, False]
            acc[k][3] += 1
            if n.acumulado is None:
                acc[k][4] = True
            else:
                acc[k][2] += n.acumulado
        return [(c, u, (None if ilegible else t), n) for c, u, t, n, ilegible in acc.values()]

    # ----------------------------------------------------------------------- donde se usa
    def donde_se_usa(self, codigo, max_nivel=8):
        """Quien usa el codigo. Devuelve dict con
           'directos':   [(producto, Fila)]  lineas de nivel 0 donde aparece (producto o semielaborado)
           'terminados': [{'codigo', 'acumulado', 'vias': [[semi, semi..]]}] productos que nadie mas
                          usa y que lo consumen directo o por semielaborado, con la cantidad acumulada."""
        k = clave(codigo)
        directos = list(self._padres.get(k, []))
        terminados = OrderedDict()

        def subir(kh, mult, via, camino, nivel):
            for padre, f in self._padres.get(kh, []):
                kp = clave(padre)
                if kp in camino or nivel > max_nivel:
                    continue
                m = None if (mult is None or f.cantidad is None) else mult * f.cantidad
                if kp not in self._padres:   # nadie lo usa: es un producto final
                    t = terminados.setdefault(kp, {'codigo': padre, 'acumulado': 0.0, 'ilegible': False, 'vias': []})
                    if m is None:
                        t['ilegible'] = True
                    else:
                        t['acumulado'] += m
                    t['vias'].append(list(reversed(via)))
                else:
                    subir(kp, m, via + [padre], camino | {kp}, nivel + 1)
        subir(k, 1.0, [], {k}, 0)
        for t in terminados.values():
            if t['ilegible']:
                t['acumulado'] = None
        return {'directos': directos, 'terminados': list(terminados.values())}


# ---------------------------------------------------------------------------- sello del dato

def _listar(carpeta, patron):
    """[(ruta, mtime, tamano)] de los archivos de `carpeta` cuyo nombre cumple `patron` (regex).
    Un solo scandir: en Windows trae fecha y tamano sin otra llamada por archivo."""
    out = []
    try:
        with os.scandir(carpeta) as it:
            for e in it:
                if patron.match(e.name) and e.is_file():
                    st = e.stat()
                    out.append((e.path, st.st_mtime, st.st_size))
    except OSError:
        pass
    return out


_RX_RELACIONES = re.compile(r'^RELACIONES_.*\.TXT$', re.I)
_RX_CARGA = re.compile(r'^carga_\d{8}\.jsonl$', re.I)
_RX_TABLAS = re.compile(r'^(alta|carga|sust|sustituir|unidad|semis)_.*\.csv$', re.I)


def candidatos_relaciones(tmp=TMP_ARB, cache=CACHE):
    """Los exports RELACIONES que hay: el del arb (C:\\tmp\\RELACIONES.TXT) y las copias con
    nombre de .arb-cache y .arb-cache/pre-cambio. NO entran C:\\tmp\\RELACIONES_CORREGIDO_*.TXT:
    son tablas armadas a mano, no un export. Devuelve [(mtime, ruta, tamano)], el mas nuevo primero."""
    crudos = []
    p = os.path.join(tmp, 'RELACIONES.TXT')
    try:
        if os.path.isfile(p):
            st = os.stat(p)
            crudos.append((p, st.st_mtime, st.st_size))
    except OSError:
        pass
    crudos += _listar(cache, _RX_RELACIONES)
    crudos += _listar(os.path.join(cache, 'pre-cambio'), _RX_RELACIONES)
    vistos, out = set(), []
    for ruta, mt, tam in crudos:
        clave_ruta = os.path.normcase(os.path.abspath(ruta))
        if clave_ruta in vistos:
            continue
        vistos.add(clave_ruta)
        out.append((mt, ruta, tam))
    out.sort(key=lambda t: t[0], reverse=True)
    return out


def _mismo_contenido(datos, ruta):
    """True si el archivo es byte a byte igual a `datos`. Corta en el primer bloque que difiere:
    dos exports del mismo tamano pero con un numero distinto se descartan leyendo 256 KB."""
    try:
        with open(ruta, 'rb') as fh:
            pos = 0
            while True:
                trozo = fh.read(1 << 18)
                if not trozo:
                    return pos == len(datos)
                if trozo != datos[pos:pos + len(trozo)]:
                    return False
                pos += len(trozo)
    except OSError:
        return False


def elegir_export(tmp=TMP_ARB, cache=CACHE, export=None):
    """El export RELACIONES mas nuevo POR FECHA DE ARCHIVO, con su hora REAL.

    Ojo con las copias: `cp` (sin -p) le pone al archivo la hora de la copia, no la del export. El
    30/09/2026 `.arb-cache/pre-cambio/RELACIONES_20260930_pre-grampas-ippad.TXT` tiene fecha 14:30 y
    es byte a byte igual a C:\\tmp\\RELACIONES.TXT de las 13:20. Si se tomara 14:30, una carga de las
    14:00 pareceria anterior al export y no avisaria. Regla: si el archivo mas nuevo es igual (mismo
    tamano y mismos bytes) a otros, la hora del export es la MAS VIEJA de todos los iguales
    (conservador: el original se escribio antes que sus copias).

    Devuelve dict: ruta, archivo_dt, export_dt, iguales (rutas de las copias identicas), original
    (la ruta mas vieja si no es `ruta`, si no None) y datos (los bytes leidos, para no releerlos)."""
    if export:
        mt = os.path.getmtime(export)
        dt = datetime.datetime.fromtimestamp(mt)
        return {'ruta': export, 'archivo_dt': dt, 'export_dt': dt, 'iguales': [], 'original': None, 'datos': None}
    cand = candidatos_relaciones(tmp, cache)
    if not cand:
        raise FileNotFoundError('no hay ningun RELACIONES*.TXT en %s ni en %s: exportar Relaciones desde el arb' % (tmp, cache))
    mt0, ruta, tam = cand[0]
    with open(ruta, 'rb') as fh:
        datos = fh.read()
    iguales = [(mt, r) for mt, r, t in cand[1:] if t == tam and _mismo_contenido(datos, r)]
    mt_real = min([mt0] + [mt for mt, _ in iguales])
    original = None
    if iguales and mt_real < mt0:
        original = min(iguales, key=lambda t: t[0])[1]
    return {'ruta': ruta, 'archivo_dt': datetime.datetime.fromtimestamp(mt0),
            'export_dt': datetime.datetime.fromtimestamp(mt_real),
            'iguales': [r for _, r in iguales], 'original': original, 'datos': datos}


def _fecha_de_nombre(nombre):
    m = re.search(r'(\d{4})(\d{2})(\d{2})', nombre)
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def cargas_al_arb(cache=CACHE):
    """Escrituras al arb que dejo el journal `.arb-cache/carga_AAAAMMDD.jsonl` (lo escriben
    `_arbCargar.py` y `_arbSustituir.py` con --apply). Cuenta `enter_ok` y `escrita`; un `por_grabar`
    sin su `enter_ok` es una escritura SIN CONFIRMAR y va aparte.
    Devuelve (escritas, sin_confirmar): listas de dict(dt, producto, estado, archivo), ordenadas."""
    escritas, sin_confirmar = [], []
    for ruta, _, _ in sorted(_listar(cache, _RX_CARGA)):
        dia = _fecha_de_nombre(os.path.basename(ruta))
        if dia is None:
            continue
        pendientes = {}
        with io.open(ruta, encoding='utf-8', errors='replace') as fh:
            for ln in fh:
                ln = ln.strip()
                if not ln:
                    continue
                try:
                    ev = json.loads(ln)
                    hh, mm, ss = (int(x) for x in str(ev.get('t', '')).split(':'))
                    dt = datetime.datetime.combine(dia, datetime.time(hh, mm, ss))
                except (ValueError, TypeError, AttributeError):
                    continue
                reg = {'dt': dt, 'producto': ev.get('producto', ''), 'estado': ev.get('estado', ''),
                       'archivo': os.path.basename(ruta)}
                if reg['estado'] == 'por_grabar':
                    pendientes[reg['producto']] = reg
                elif reg['estado'] in ESTADOS_ESCRITURA:
                    pendientes.pop(reg['producto'], None)
                    escritas.append(reg)
                elif reg['estado'] == 'abortada':
                    pendientes.pop(reg['producto'], None)
        sin_confirmar += list(pendientes.values())
    f = lambda r: r['dt']
    return sorted(escritas, key=f), sorted(sin_confirmar, key=f)


def tablas_de_carga(cache=CACHE):
    """Tablas de carga/alta/sustitucion/unidad que hay en .arb-cache (csv): [(nombre, dt)]. No prueban
    que se aplicaron: `_arbAlta.py`, `_arbUnidad.py` y compania no dejan journal."""
    out = [(os.path.basename(r), datetime.datetime.fromtimestamp(mt)) for r, mt, _ in _listar(cache, _RX_TABLAS)]
    return sorted(out, key=lambda t: t[1])


class Sello(_Registro):
    """De donde sale el dato y si puede estar viejo."""
    __slots__ = ('ruta', 'archivo_dt', 'export_dt', 'ahora', 'original', 'iguales', 'escritas', 'sin_confirmar',
                 'ultima_escritura', 'tablas_posteriores', 'articulo', 'insumos', 'avisos')

    def __init__(self, ruta, archivo_dt, export_dt, ahora, original=None, iguales=None):
        self.ruta = ruta
        self.archivo_dt = archivo_dt
        self.export_dt = export_dt
        self.ahora = ahora
        self.original = original
        self.iguales = list(iguales or [])
        self.escritas = []              # escrituras al arb DESPUES del export
        self.sin_confirmar = []
        self.ultima_escritura = None    # la ultima del journal, sea cual sea
        self.tablas_posteriores = []
        self.articulo = None            # (ruta, dt) o None
        self.insumos = None             # (ruta, dt, formato) o None
        self.avisos = []

    @property
    def edad(self):
        return self.ahora - self.export_dt

    @property
    def motivos_viejo(self):
        m = []
        if self.edad > datetime.timedelta(hours=HORAS_VIEJO):
            m.append('el export tiene %s (mas de %d h)' % (_dur(self.edad), HORAS_VIEJO))
        if self.escritas:
            m.append('%d escritura(s) al arb despues del export' % len(self.escritas))
        if self.sin_confirmar:
            m.append('%d escritura(s) sin confirmar despues del export' % len(self.sin_confirmar))
        return m

    @property
    def viejo(self):
        return bool(self.motivos_viejo)

    def lineas(self):
        """El sello como lista de lineas de texto (para imprimir arriba de todo)."""
        L = ['SELLO DEL DATO']
        L.append('  export:   %s  -  hecho %s (hace %s)' % (os.path.basename(self.ruta), _f(self.export_dt), _dur(self.edad)))
        if self.original:
            L.append('            el archivo tiene fecha %s pero es copia identica de %s: vale la hora del original'
                     % (_f(self.archivo_dt), self.original))
        elif self.iguales:
            L.append('            hay %d copia(s) identica(s) con nombre en .arb-cache' % len(self.iguales))
        if self.escritas:
            u = self.escritas[-1]
            L.append('  cargas al arb despues del export: %d (la ultima %s, producto %s)' % (len(self.escritas), _f(u['dt']), u['producto']))
        else:
            ult = (' (ultima escritura del journal: %s, producto %s)' % (_f(self.ultima_escritura['dt']), self.ultima_escritura['producto'])
                   if self.ultima_escritura else ' (el journal no tiene ninguna escritura)')
            L.append('  cargas al arb despues del export: ninguna%s' % ult)
        if self.sin_confirmar:
            L.append('  sin confirmar: %d "por_grabar" sin su "enter_ok" despues del export (%s)'
                     % (len(self.sin_confirmar), ', '.join(sorted({r['producto'] for r in self.sin_confirmar}))))
        partes = []
        if self.articulo:
            dias = (self.ahora - self.articulo[1]).days
            partes.append('ARTICULO.TXT del %s%s' % (_f(self.articulo[1], corto=True),
                                                     ' (%d dias: un producto nuevo sale sin descripcion)' % dias if dias > 7 else ''))
        else:
            partes.append('sin ARTICULO.TXT (los productos salen sin descripcion propia)')
        if self.insumos:
            partes.append('INSUMOS.TXT del %s (%s)' % (_f(self.insumos[1], corto=True),
                                                        'listado impreso, sin unidad: la unidad sale de RELACIONES' if self.insumos[2] == 'listado' else self.insumos[2]))
        L.append('  descripciones: %s' % ' - '.join(partes))
        if self.tablas_posteriores:
            nombres = ', '.join('%s (%s)' % (n, _f(dt, corto=True, hora=True)) for n, dt in self.tablas_posteriores[:4])
            mas = '' if len(self.tablas_posteriores) <= 4 else ' y %d mas' % (len(self.tablas_posteriores) - 4)
            L.append('  ojo: hay tablas de carga mas nuevas que el export: %s%s (no prueban que se aplicaron)' % (nombres, mas))
        for a in self.avisos:
            L.append('  ojo: %s' % a)
        if self.viejo:
            L.append('  >>> PUEDE ESTAR VIEJO: %s. Re-exportar RELACIONES antes de afirmar un consumo.' % '; '.join(self.motivos_viejo))
        else:
            L.append('  estado: al dia (export de menos de %d h y sin cargas posteriores en el journal)' % HORAS_VIEJO)
        return L


def _f(dt, corto=False, hora=False):
    if dt is None:
        return '?'
    if corto and not hora:
        return dt.strftime('%d/%m/%Y')
    return dt.strftime('%d/%m/%Y %H:%M')


def _dur(td):
    s = int(td.total_seconds())
    if s < 0:
        return 'fecha en el futuro (reloj?)'
    d, r = divmod(s, 86400)
    h, r = divmod(r, 3600)
    m = r // 60
    if d:
        return '%d d %d h' % (d, h)
    if h:
        return '%d h %d min' % (h, m)
    return '%d min' % m


def armar_sello(elegido, tmp=TMP_ARB, cache=CACHE, ahora=None, insumos_info=None):
    """Junta el sello: hora real del export + escrituras posteriores + tablas posteriores."""
    ahora = ahora or datetime.datetime.now()
    s = Sello(ruta=elegido['ruta'], archivo_dt=elegido['archivo_dt'], export_dt=elegido['export_dt'], ahora=ahora,
              original=elegido.get('original'), iguales=list(elegido.get('iguales', [])))
    escritas, sin = cargas_al_arb(cache)
    s.ultima_escritura = escritas[-1] if escritas else None
    s.escritas = [e for e in escritas if e['dt'] > s.export_dt]
    s.sin_confirmar = [e for e in sin if e['dt'] > s.export_dt]
    s.tablas_posteriores = [(n, dt) for n, dt in tablas_de_carga(cache) if dt > s.export_dt]
    art = os.path.join(tmp, 'ARTICULO.TXT')
    if os.path.isfile(art):
        s.articulo = (art, datetime.datetime.fromtimestamp(os.path.getmtime(art)))
    if insumos_info:
        s.insumos = insumos_info
    if elegido['export_dt'] > ahora + datetime.timedelta(minutes=1):
        s.avisos.append('el export tiene fecha en el futuro: revisar el reloj de la PC')
    if (ahora - elegido['archivo_dt']) < datetime.timedelta(seconds=60):
        s.avisos.append('el archivo se modifico hace menos de 1 minuto: puede estar escribiendose todavia')
    return s


def _leer(ruta):
    with open(ruta, 'rb') as fh:
        return fh.read()


_RX_MAESTRO_VIEJO = re.compile(r'^insumos_\d{8}.*backup.*\.csv$', re.I)


def cargar(export=None, tmp=TMP_ARB, cache=CACHE, ahora=None):
    """Elige el export mas nuevo, lo parsea y arma el sello. Devuelve (Relaciones, Sello).

    Las descripciones de productos vienen de ARTICULO.TXT (C:\\tmp) y, donde falten, de INSUMOS.TXT; las
    unidades viejas (para detectar un cambio de etiqueta) de .arb-cache/insumos_AAAAMMDD_backup.csv.
    Esas tres se leen SOLO si hacen falta: cargar un producto conocido tarda lo que tarda RELACIONES."""
    elegido = elegir_export(tmp, cache, export)
    datos = elegido.pop('datos', None)
    parseo = parsear_relaciones(datos if datos is not None else _leer(elegido['ruta']))
    p_art = os.path.join(tmp, 'ARTICULO.TXT')
    p_ins = os.path.join(tmp, 'INSUMOS.TXT')
    ins_info = None
    if os.path.isfile(p_ins):
        with open(p_ins, 'rb') as fh:
            cabeza = fh.read(4096)   # alcanza para saber si es el tabulado o el listado impreso
        ins_info = (p_ins, datetime.datetime.fromtimestamp(os.path.getmtime(p_ins)), formato_insumos(cabeza))
    backups = sorted(_listar(cache, _RX_MAESTRO_VIEJO))
    dia_viejo = _fecha_de_nombre(os.path.basename(backups[-1][0])) if backups else None
    rel = Relaciones(
        parseo,
        (lambda: parsear_articulos(_leer(p_art))) if os.path.isfile(p_art) else None,
        (lambda: parsear_insumos(_leer(p_ins))) if ins_info else None,
        (lambda: parsear_maestro_csv(_leer(backups[-1][0]))) if backups else None,
        ('maestro del %s' % dia_viejo.strftime('%d/%m/%Y')) if dia_viejo else 'foto vieja del maestro')
    return rel, armar_sello(elegido, tmp, cache, ahora, ins_info)


def _correr_selftest():
    """Carga arbRelaciones_selftest.py por ruta (solo cuando se pide --selftest) y lo corre."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('arbRelaciones_selftest', os.path.join(AQUI, 'arbRelaciones_selftest.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.selftest(globals())


if __name__ == '__main__':
    if '--selftest' in sys.argv[1:]:
        sys.exit(_correr_selftest())
    print(__doc__)
