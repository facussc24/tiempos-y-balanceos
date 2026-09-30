# -*- coding: utf-8 -*-
"""mails_equipo.py - deja en la nube compartida del equipo de Ingenieria los mails de trabajo de
esta PC, en segundo plano. Lo corre `sync_equipo.ps1` (la tarea "Barack - Base Claude y mails").

Que hace, en una linea: lee el buzon propio de Outlook clasico (solo lectura) y, por cada mail
nuevo, segun el filtro de esta PC:

    privado    -> NO sube (direccion de privados.json en De/Para/CC, o remitente de Anthropic)
    cuarentena -> <nube>\\mails\\_cuarentena\\<autor>\\   (sueldos, licencias, sanciones, etc.)
    entrada    -> <nube>\\mails\\_entrada\\<autor>\\

Reglas que cumple este script:
  - Solo AGREGA archivos en la nube: nunca borra ni pisa uno que ya este (un nombre repetido se
    desempata con -2, -3...). No modifica ni borra nada del buzon.
  - Sin adjuntos: solo guarda sus nombres.
  - Lo hecho queda anotado en `<estado>\\mails-subidos.txt`: una corrida que se corta (limite de
    tiempo, Outlook colgado) no pierde avance, y la siguiente sigue donde quedo.
  - Sin `privados.json` (ni en la nube ni la copia local) NO sube nada: ese archivo es lo unico
    que deja afuera los buzones de Direccion, RRHH y sueldos. No se sube "por las dudas".
  - Solo mira Outlook clasico YA ABIERTO (COM). No lo abre ni muestra ventanas.

Identidad de un mail: el Message-ID de internet (el mismo en todos los buzones que lo recibieron).

Uso a mano (por defecto usa %LOCALAPPDATA%\\BarackEquipo):
    python mails_equipo.py --nube "<carpeta Base Claude Ingenieria>"
    python mails_equipo.py --nube X --dry-run          # cuenta, no escribe
    python mails_equipo.py --nube X --dias-atras 30    # primera corrida: hasta donde mira hacia atras
    python mails_equipo.py --selftest

Codigos de salida: 0 bien (completo o parcial por tiempo) - 1 error - 3 falta el perfil -
4 Outlook no esta abierto (se reintenta) - 5 falta privados.json - 6 no hay carpeta de nube.
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timedelta

ESTADO_POR_DEFECTO = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'BarackEquipo')
DIAS_ATRAS_POR_DEFECTO = 90
MARGEN_DIAS = 3            # cada pasada completa vuelve a mirar los ultimos 3 dias (mails que llegaron tarde)
LOTE = 300                 # mails por archivo: una corrida cortada conserva lo ya subido
MAX_CUERPO = 20000
MAX_MINUTOS_POR_DEFECTO = 14
PR_INTERNET_MESSAGE_ID = 'http://schemas.microsoft.com/mapi/proptag/0x1035001F'
PR_SMTP_ADDRESS = 'http://schemas.microsoft.com/mapi/proptag/0x39FE001E'
CARPETAS_FUERA = (3, 4, 16, 23)     # Eliminados, Bandeja de salida, Borradores, Correo no deseado

# Palabras que mandan un mail a CUARENTENA (no al archivo compartido) hasta que alguien lo mire.
# Asunto + cuerpo, sin acentos.
CUARENTENA = re.compile(
    r'\b(sueldos?|haberes|recibo de sueldo|recibos? de haberes|anticipo|liquidacion final|'
    r'licencia medica|licencias medicas|certificado medico|certificados medicos|parte medico|reposo|'
    r'sancion|sanciones|apercibimiento|suspension disciplinaria|despido|desvinculacion|telegrama|'
    r'sindicato|sindical|delegado gremial|smata|uom|obra social|prepaga|embargo|cuota alimentaria|'
    r'evaluacion de desempeno|aumento salarial|escala salarial|paritaria)\b', re.I)

# Los codigos de acceso de la cuenta de Claude viajan por mail: esos nunca suben.
NUNCA_SUBE = re.compile(r'@(anthropic\.com|claude\.ai|mail\.anthropic\.com|claude\.com)$', re.I)


# ----------------------------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------------------------

def normalizar(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().lower()


def leer_json(p, por_defecto=None):
    try:
        with open(p, encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception:
        return por_defecto


def escribir_atomico(p, texto):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = '%s.%d.tmp' % (p, os.getpid())
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    os.replace(tmp, p)


def ahora_iso():
    return datetime.now().strftime('%Y-%m-%dT%H:%M:%S')


def sello():
    return datetime.now().strftime('%Y%m%d-%H%M%S')


def carpeta_segura(nombre):
    """Nombre de carpeta valido en Windows a partir de 'Nombre Apellido - Sector'."""
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', str(nombre or '')).strip(' .')
    return n[:80]


def parsear_fecha(texto):
    """'2026-09-30 14:05', '2026-09-30T14:05:00' o '2026-09-30' -> datetime (o None)."""
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?', str(texto or ''))
    if not m:
        return None
    try:
        a, me, d, h, mi, s = (int(x) if x else 0 for x in m.groups())
        return datetime(a, me, d, h, mi, s)
    except ValueError:
        return None


# ----------------------------------------------------------------------------------------------
# Filtro de lo privado
# ----------------------------------------------------------------------------------------------

def cargar_privados(nube, estado_dir):
    """(direcciones, dominios, palabras_extra, de_donde) o None si no hay ningun privados.json.
    El de la nube manda y deja una copia local; sin nube vale la copia local."""
    copia = os.path.join(estado_dir, 'privados.json')
    origen_nube = os.path.join(nube, 'privados.json') if nube else None
    for ruta, donde in ((origen_nube, 'nube'), (copia, 'copia local')):
        if not ruta or not os.path.isfile(ruta):
            continue
        d = leer_json(ruta)
        if not isinstance(d, dict):
            continue
        dirs = {str(x).strip().lower() for x in d.get('direcciones', []) if x}
        doms = {str(x).strip().lower().lstrip('@') for x in d.get('dominios', []) if x}
        pal = []
        for x in d.get('palabras_extra', []):
            try:
                pal.append(re.compile(normalizar(x), re.I))
            except re.error:
                pass
        if donde == 'nube':
            try:
                with open(ruta, encoding='utf-8-sig') as f:
                    escribir_atomico(copia, f.read())
            except Exception:
                pass
        return dirs, doms, pal, donde
    return None


def direcciones_de(m):
    out = set()
    if m.get('de_mail'):
        out.add(str(m['de_mail']).lower())
    for k in ('para_mails', 'cc_mails'):
        for x in m.get(k) or []:
            if x:
                out.add(str(x).lower())
    return out


def clasificar(m, dirs_priv, doms_priv, palabras_extra=()):
    """'privado' (no sube), 'cuarentena' (sube aparte) o 'entrada'."""
    dirs = direcciones_de(m)
    if any(NUNCA_SUBE.search(d) for d in dirs):
        return 'privado'
    if dirs & dirs_priv:
        return 'privado'
    if any(d.split('@')[-1] in doms_priv for d in dirs if '@' in d):
        return 'privado'
    texto = normalizar((m.get('asunto') or '') + ' ' + (m.get('cuerpo') or '')[:4000])
    if CUARENTENA.search(texto):
        return 'cuarentena'
    for r in palabras_extra:
        if r.search(texto):
            return 'cuarentena'
    return 'entrada'


# ----------------------------------------------------------------------------------------------
# Lo ya subido
# ----------------------------------------------------------------------------------------------

def ids_subidos(ruta):
    ids = set()
    try:
        with open(ruta, encoding='utf-8') as f:
            for ln in f:
                ln = ln.rstrip('\r\n')
                if ln:
                    ids.add(ln)
    except OSError:
        pass
    return ids


def anotar_ids(ruta, lote):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'a', encoding='utf-8', newline='\n') as f:
        for m in lote:
            f.write(re.sub(r'[\r\n]+', ' ', m['id']) + '\n')


# ----------------------------------------------------------------------------------------------
# Fuentes de mails
# ----------------------------------------------------------------------------------------------

def _limpiar(txt):
    txt = str(txt or '').replace('\r\n', '\n').replace('\r', '\n')
    out, vacias = [], 0
    for ln in (x.rstrip() for x in txt.split('\n')):
        vacias = vacias + 1 if not ln else 0
        if vacias <= 1:
            out.append(ln)
    return '\n'.join(out).strip()[:MAX_CUERPO]


def _smtp(rec):
    try:
        a = rec.PropertyAccessor.GetProperty(PR_SMTP_ADDRESS)
        if a and '@' in str(a):
            return str(a).lower()
    except Exception:
        pass
    try:
        a = str(rec.Address or '')
        return a.lower() if '@' in a else ''
    except Exception:
        return ''


def _remitente_smtp(m):
    try:
        if str(getattr(m, 'SenderEmailType', '') or '').upper() == 'EX':
            eu = m.Sender.GetExchangeUser()
            if eu is not None and eu.PrimarySmtpAddress:
                return str(eu.PrimarySmtpAddress).lower()
    except Exception:
        pass
    a = str(getattr(m, 'SenderEmailAddress', '') or '')
    return a.lower() if '@' in a else a


def _id_de(m):
    try:
        mid = str(m.PropertyAccessor.GetProperty(PR_INTERNET_MESSAGE_ID) or '')
    except Exception:
        mid = ''
    eid = str(getattr(m, 'EntryID', '') or '')
    return (mid or ('eid:' + eid)), eid


def _fecha_recibido(m):
    try:
        rt = m.ReceivedTime
    except Exception:
        return None
    try:
        return rt.replace(tzinfo=None)
    except Exception:
        try:
            return datetime(rt.year, rt.month, rt.day, rt.hour, rt.minute, rt.second)
        except Exception:
            return None


def _leer_mail(m, carpeta, mid, eid, rt):
    para, cc, adj = [], [], []
    try:
        for i in range(1, m.Recipients.Count + 1):
            r = m.Recipients.Item(i)
            (para if r.Type == 1 else cc).append(_smtp(r))
    except Exception:
        pass
    try:
        for k in range(1, m.Attachments.Count + 1):
            adj.append(str(m.Attachments.Item(k).FileName))
    except Exception:
        pass
    return {
        'id': mid, 'eid': eid, 'carpeta': carpeta, 'fecha': rt.strftime('%Y-%m-%d %H:%M') if rt else '',
        'de': str(getattr(m, 'SenderName', '') or ''), 'de_mail': _remitente_smtp(m),
        'para': str(getattr(m, 'To', '') or ''), 'para_mails': [x for x in para if x],
        'cc': str(getattr(m, 'CC', '') or ''), 'cc_mails': [x for x in cc if x],
        'asunto': str(getattr(m, 'Subject', '') or ''), 'adjuntos': adj,
        'conversacion': str(getattr(m, 'ConversationID', '') or ''),
        'cuerpo': _limpiar(getattr(m, 'Body', '')),
    }


def abrir_outlook():
    """Namespace MAPI de un Outlook clasico que YA esta abierto, o None. No lo arranca."""
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        return 'sin_pywin32'
    pythoncom.CoInitialize()
    try:
        return win32com.client.GetActiveObject('Outlook.Application').GetNamespace('MAPI')
    except Exception:
        return None


def mails_de_outlook(ns, corte, conocidos, ctx):
    """Mails NUEVOS (no subidos) del buzon por defecto con fecha >= corte. Por cada carpeta los
    ordena del mas nuevo al mas viejo y corta en cuanto pasa el corte. Si se acaba el tiempo,
    deja ctx['completa'] = False y termina."""
    raiz = ns.DefaultStore.GetRootFolder()
    fuera = set()
    for k in CARPETAS_FUERA:
        try:
            fuera.add(ns.GetDefaultFolder(k).EntryID)
        except Exception:
            pass
    pila = [(raiz, '')]
    while pila:
        carpeta, ruta = pila.pop()
        try:
            if carpeta.EntryID in fuera or getattr(carpeta, 'DefaultItemType', 0) != 0:
                continue
            nombre = carpeta.Name
        except Exception:
            continue
        p = (ruta + ' / ' + nombre) if ruta else nombre
        ordenado = True
        try:
            items = carpeta.Items
            try:
                items.Sort('[ReceivedTime]', True)
            except Exception:
                ordenado = False
            n = items.Count
        except Exception:
            n = 0
        for i in range(1, n + 1):
            if time.monotonic() > ctx['limite']:
                ctx['completa'] = False
                return
            ctx['revisados'] += 1
            try:
                m = items.Item(i)
                if getattr(m, 'Class', 43) != 43:
                    continue
                rt = _fecha_recibido(m)
                if rt is not None and rt < corte:
                    if ordenado:
                        break
                    continue
                mid, eid = _id_de(m)
                if mid in conocidos:
                    continue
                conocidos.add(mid)
                yield _leer_mail(m, p, mid, eid, rt)
            except Exception:
                pass
        try:
            for j in range(1, carpeta.Folders.Count + 1):
                pila.append((carpeta.Folders.Item(j), p))
        except Exception:
            pass


def mails_de_jsonl(ruta, corte, conocidos, ctx):
    """Fuente de PRUEBA: un .jsonl con mails en el mismo formato que se sube."""
    with open(ruta, encoding='utf-8-sig') as f:
        for ln in f:
            if time.monotonic() > ctx['limite']:
                ctx['completa'] = False
                return
            try:
                m = json.loads(ln)
            except Exception:
                continue
            ctx['revisados'] += 1
            f_ = parsear_fecha(m.get('fecha'))
            if f_ is not None and f_ < corte:
                continue
            if not m.get('id') or m['id'] in conocidos:
                continue
            conocidos.add(m['id'])
            yield m


# ----------------------------------------------------------------------------------------------
# Subir un lote
# ----------------------------------------------------------------------------------------------

def escribir_lote(nube, destino, autor, lista):
    """Un archivo nuevo en <nube>\\mails\\_<destino>\\<autor>\\. Nunca pisa uno existente."""
    carpeta = os.path.join(nube, 'mails', '_' + destino, carpeta_segura(autor))
    os.makedirs(carpeta, exist_ok=True)
    base = sello()
    ruta = os.path.join(carpeta, base + '.jsonl')
    for i in range(2, 1000):
        if not os.path.exists(ruta):
            break
        ruta = os.path.join(carpeta, '%s-%d.jsonl' % (base, i))
    tmp = ruta + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        for m in lista:
            f.write(json.dumps(m, ensure_ascii=False) + '\n')
    os.replace(tmp, ruta)
    return ruta


def volcar(lote, nube, autor, priv, dry, ids_path, cuenta):
    por_destino = {'entrada': [], 'cuarentena': []}
    for m in lote:
        c = clasificar(m, priv[0], priv[1], priv[2])
        cuenta[c] += 1
        if c != 'privado':
            por_destino[c].append(m)
    if dry:
        return
    for destino, lista in por_destino.items():
        if lista:
            escribir_lote(nube, destino, autor, lista)
    anotar_ids(ids_path, lote)


# ----------------------------------------------------------------------------------------------
# Corrida
# ----------------------------------------------------------------------------------------------

def correr(a):
    estado_dir = os.path.abspath(a.estado_dir or ESTADO_POR_DEFECTO)
    perfil = leer_json(os.path.join(estado_dir, 'perfil.json'), {}) or {}
    autor = carpeta_segura(perfil.get('autor'))
    if not autor:
        print('Falta el perfil (nombre y sector) en %s: lo deja Instalar.' % os.path.join(estado_dir, 'perfil.json'))
        return 3
    nube = os.path.abspath(a.nube) if a.nube else None
    if not a.dry_run and (not nube or not os.path.isdir(nube)):
        print('No hay carpeta de nube (%s): se reintenta en la proxima corrida.' % (nube or 'sin ruta'))
        return 6
    priv = cargar_privados(nube if nube and os.path.isdir(nube) else None, estado_dir)
    if priv is None:
        print('Falta privados.json (ni en la nube ni la copia local): no se sube nada hasta que Fak lo deje en la carpeta de la base.')
        return 5

    ids_path = os.path.join(estado_dir, 'mails-subidos.txt')
    estado_path = os.path.join(estado_dir, 'mails-estado.json')
    estado = leer_json(estado_path, {}) or {}
    inicio = datetime.now()
    dias = a.dias_atras or perfil.get('mails_dias') or DIAS_ATRAS_POR_DEFECTO
    if a.desde:
        corte = parsear_fecha(a.desde) or (inicio - timedelta(days=dias))
    elif estado.get('marca'):
        corte = (parsear_fecha(estado['marca']) or inicio) - timedelta(days=MARGEN_DIAS)
    else:
        corte = parsear_fecha(estado.get('corte_inicial')) or (inicio - timedelta(days=dias))

    conocidos = ids_subidos(ids_path)
    ctx = {'limite': time.monotonic() + a.max_minutos * 60, 'completa': True, 'revisados': 0}
    if a.fuente_jsonl:
        fuente = mails_de_jsonl(a.fuente_jsonl, corte, conocidos, ctx)
    else:
        ns = abrir_outlook()
        if ns == 'sin_pywin32':
            print('Falta pywin32 de Python (python -m pip install pywin32): sin eso no se puede leer Outlook.')
            return 2
        if ns is None:
            print('Outlook clasico no esta abierto: se reintenta en la proxima corrida.')
            return 4
        fuente = mails_de_outlook(ns, corte, conocidos, ctx)

    cuenta = {'privado': 0, 'cuarentena': 0, 'entrada': 0}
    lote, nuevos = [], 0
    try:
        for m in fuente:
            lote.append(m)
            nuevos += 1
            if len(lote) >= LOTE:
                volcar(lote, nube, autor, priv, a.dry_run, ids_path, cuenta)
                lote = []
        if lote:
            volcar(lote, nube, autor, priv, a.dry_run, ids_path, cuenta)
    except OSError as e:
        print('No pude escribir en la nube (%s): lo que quedo sin subir se reintenta.' % e)
        return 1

    print('Revisados %d - nuevos %d - desde %s - %s' % (ctx['revisados'], nuevos, corte.strftime('%Y-%m-%d'), 'completo' if ctx['completa'] else 'PARCIAL (se acabo el tiempo)'))
    print('Nube: entrada %d - cuarentena %d - privados (no suben) %d - filtro: %s' % (cuenta['entrada'], cuenta['cuarentena'], cuenta['privado'], priv[3]))
    if not a.dry_run:
        nuevo = dict(estado)
        nuevo.setdefault('corte_inicial', corte.strftime('%Y-%m-%dT%H:%M:%S'))
        nuevo.update({'ultima': ahora_iso(), 'revisados': ctx['revisados'], 'nuevos': nuevos, 'completa': ctx['completa'], 'autor': autor, **cuenta})
        if ctx['completa']:
            nuevo['marca'] = inicio.strftime('%Y-%m-%dT%H:%M:%S')
        escribir_atomico(estado_path, json.dumps(nuevo, ensure_ascii=False, indent=2) + '\n')
    return 0


def selftest():
    dirs = {'gerencia@ejemplo.com'}
    casos = [
        ({'de_mail': 'compras@ejemplo.com', 'para_mails': ['prov@x.com'], 'asunto': 'OC 1234', 'cuerpo': 'adjunto la orden'}, 'entrada'),
        ({'de_mail': 'gerencia@ejemplo.com', 'para_mails': ['f@ejemplo.com'], 'asunto': 'reunion', 'cuerpo': ''}, 'privado'),
        ({'de_mail': 'x@ejemplo.com', 'cc_mails': ['Gerencia@Ejemplo.com'], 'asunto': 'hola', 'cuerpo': ''}, 'privado'),
        ({'de_mail': 'rrhh@ejemplo.com', 'para_mails': ['todos@ejemplo.com'], 'asunto': 'Anticipo de Pascua', 'cuerpo': 'se paga el viernes'}, 'cuarentena'),
        ({'de_mail': 'a@ejemplo.com', 'para_mails': ['b@ejemplo.com'], 'asunto': 'Licencia médica de Juan', 'cuerpo': ''}, 'cuarentena'),
        ({'de_mail': 'noreply@mail.anthropic.com', 'para_mails': ['f@ejemplo.com'], 'asunto': 'Your login code', 'cuerpo': '123456'}, 'privado'),
        ({'de_mail': 'prov@x.com', 'para_mails': ['compras@ejemplo.com'], 'asunto': 'Pesos HotMelt', 'cuerpo': 'el sueldo no importa aca'}, 'cuarentena'),
    ]
    ok = True
    for m, esperado in casos:
        got = clasificar(m, dirs, set())
        paso = got == esperado
        ok = ok and paso
        print('%s %r -> %s (esperado %s)' % ('OK   ' if paso else 'FALLA', m.get('asunto'), got, esperado))
    print('selftest:', 'OK' if ok else 'FALLA')
    return 0 if ok else 1


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass
    ap = argparse.ArgumentParser(description='Deja en la nube del equipo los mails de trabajo de esta PC.')
    ap.add_argument('--nube', help='carpeta "Base Claude Ingenieria" de la biblioteca sincronizada')
    ap.add_argument('--estado-dir', help='carpeta local de estado (por defecto %%LOCALAPPDATA%%\\BarackEquipo)')
    ap.add_argument('--dias-atras', type=int, help='primera corrida: hasta cuantos dias hacia atras mira (%d)' % DIAS_ATRAS_POR_DEFECTO)
    ap.add_argument('--desde', help='AAAA-MM-DD: mira desde esa fecha (ignora la marca de la ultima pasada)')
    ap.add_argument('--max-minutos', type=float, default=MAX_MINUTOS_POR_DEFECTO, help='tiempo maximo de la corrida (%d)' % MAX_MINUTOS_POR_DEFECTO)
    ap.add_argument('--dry-run', action='store_true', help='cuenta, no escribe nada')
    ap.add_argument('--fuente-jsonl', help='SOLO PRUEBAS: lee los mails de este .jsonl en vez de Outlook')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    return correr(a)


if __name__ == '__main__':
    sys.exit(main())
