# -*- coding: utf-8 -*-
"""
_archivoCorreo.py — archiva un buzon de Outlook (.ost/.pst) a un formato que sobreviva
a que borren la cuenta: un .eml por mail + los adjuntos sueltos + un indice.

POR QUE ESTE FORMATO
    Un .eml se abre con doble click en cualquier Windows, sin Outlook, sin Exchange y sin
    Claude. Lleva los adjuntos adentro. Es lo que queda legible dentro de 10 anios.
    Ademas se extraen los adjuntos SUELTOS y deduplicados por contenido (el mismo AMFE que
    viajo 19 veces se guarda una sola vez), para poder buscarlos desde el Explorador.

ESTRUCTURA QUE GENERA
    <destino>/
        <ROL>/<AAAA>/AAAA-MM-DD_HHMM_asunto.eml
        ADJUNTOS/<ROL>/<AAAA>/<archivo>
        _indice.jsonl          <- una linea por mail, insumo del Excel

USO
    python scripts/_archivoCorreo.py --ost "<ruta.ost>" --rol "CALIDAD" --destino "<carpeta>"
        --limite 50           prueba corta antes de la corrida larga
        --sin-adjuntos        no extrae los adjuntos sueltos (la mitad de espacio)
        --carpetas-no "Problemas de sincronizacion,Dias festivos"   excluye por nombre

NOTA: el interprete es .venv-mail (Python 3.12 con pypff compilado). El del sistema (3.13)
      no tiene pypff: no hay wheel y libpff hay que compilarlo con MSVC.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

try:
    import pypff
except ImportError:
    sys.exit("falta pypff — usar .venv-mail\\Scripts\\python.exe (ver cabecera del archivo)")


# ---------------------------------------------------------------- utilidades

def sin_tildes(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


PROHIBIDOS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def nombre_seguro(s, tope=70):
    """Nombre de archivo que Windows Y SharePoint aceptan."""
    s = sin_tildes(s or '').strip()
    s = PROHIBIDOS.sub('-', s)
    s = re.sub(r'\s+', ' ', s).strip(' .')
    if not s:
        s = 'sin-asunto'
    return s[:tope].strip(' .')


def texto(obj, metodo):
    """pypff devuelve str, bytes o tira excepcion segun el campo. Normaliza a str."""
    try:
        v = getattr(obj, metodo)()
    except Exception:
        return ''
    if v is None:
        return ''
    if isinstance(v, bytes):
        for cp in ('utf-8', 'cp1252', 'latin-1'):
            try:
                return v.decode(cp)
            except UnicodeDecodeError:
                continue
        return v.decode('utf-8', 'replace')
    return str(v)


# El nombre del adjunto no siempre esta expuesto como metodo: vive en los record sets.
ENTRADAS_NOMBRE = (0x3707, 0x3704, 0x3001)  # long filename, filename 8.3, display name


def nombre_adjunto(att, i):
    for metodo in ('get_name', 'get_long_filename', 'get_filename'):
        n = texto(att, metodo)
        if n:
            return n
    try:
        for r in range(att.get_number_of_record_sets()):
            rs = att.get_record_set(r)
            for e in range(rs.get_number_of_entries()):
                ent = rs.get_entry(e)
                if ent.get_entry_type() in ENTRADAS_NOMBRE:
                    v = ent.get_data_as_string()
                    if v:
                        return v
    except Exception:
        pass
    return 'adjunto-%02d.bin' % i


# Los mails ENVIADOS no tienen cabeceras RFC822 (se generan al salir del servidor): el
# destinatario vive en los metadatos MAPI. Estos son los codigos que hacen falta.
PR_DISPLAY_TO, PR_DISPLAY_CC, PR_SENDER_NAME, PR_SENT_REPR_NAME = 0x0E04, 0x0E03, 0x0C1A, 0x0042


def campo_registro(msg, tipo):
    try:
        for r in range(msg.get_number_of_record_sets()):
            rs = msg.get_record_set(r)
            for e in range(rs.get_number_of_entries()):
                ent = rs.get_entry(e)
                if ent.get_entry_type() == tipo:
                    v = ent.get_data_as_string()
                    if v:
                        return v
    except Exception:
        pass
    return ''


# Outlook redacta en HTML de Word: el mail arranca con un bloque <!--[if gte mso 9]><xml>
# de cientos de lineas de CSS. Si no se saca ANTES de quitar etiquetas, esa basura se
# convierte en el "texto" del mail ("Clean DocumentEmail false 21 X-NONE...").
COMENTARIO = re.compile(r'(?is)<!--.*?-->|<xml\b.*?</xml>|<(script|style)\b.*?</\1>')
ETIQUETA = re.compile(r'(?s)<[^>]+>')
ESPACIOS = re.compile(r'[ \t]*\n[ \t]*')


def html_a_texto(html):
    """El 90% de los mails de Exchange vienen SOLO en HTML. Sin esto el .eml queda sin
    texto: no se lee de un vistazo ni lo encuentra una busqueda por contenido."""
    import html as _h
    t = COMENTARIO.sub(' ', html)
    t = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</tr>', '\n', t)
    t = ETIQUETA.sub(' ', t)
    t = _h.unescape(t)
    t = re.sub(r'[ \t\xa0]{2,}', ' ', t)
    t = ESPACIOS.sub('\n', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def fecha_de(msg):
    for metodo in ('get_delivery_time', 'get_client_submit_time', 'get_creation_time'):
        try:
            d = getattr(msg, metodo)()
            if d:
                return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


# ---------------------------------------------------------------- armado del .eml

def construir_eml(msg, adjuntos):
    """Reconstruye un RFC822. Si el mail traia sus cabeceras originales se respetan."""
    from email.message import EmailMessage
    from email.utils import format_datetime

    em = EmailMessage()
    cab = texto(msg, 'get_transport_headers')
    puestas = set()
    if cab:
        for linea in cab.splitlines():
            m = re.match(r'^([A-Za-z\-]+):\s*(.*)$', linea)
            if m and m.group(1).lower() in ('from', 'to', 'cc', 'subject', 'date', 'message-id'):
                clave = m.group(1)
                if clave.lower() not in puestas:
                    em[clave] = m.group(2)
                    puestas.add(clave.lower())

    if 'subject' not in puestas:
        em['Subject'] = texto(msg, 'get_subject')
    if 'from' not in puestas:
        em['From'] = (texto(msg, 'get_sender_name') or campo_registro(msg, PR_SENDER_NAME)
                      or campo_registro(msg, PR_SENT_REPR_NAME) or '(desconocido)')
    if 'to' not in puestas:
        para = campo_registro(msg, PR_DISPLAY_TO)
        if para:
            em['To'] = para
    if 'cc' not in puestas:
        cc = campo_registro(msg, PR_DISPLAY_CC)
        if cc:
            em['Cc'] = cc
    if 'date' not in puestas:
        f = fecha_de(msg)
        if f:
            em['Date'] = format_datetime(f)

    cuerpo = texto(msg, 'get_plain_text_body')
    html = texto(msg, 'get_html_body')
    if not cuerpo and html:
        cuerpo = html_a_texto(html)
    em.set_content(cuerpo or '(sin cuerpo)')
    if html:
        em.add_alternative(html, subtype='html')

    for nombre, datos in adjuntos:
        em.add_attachment(datos, maintype='application', subtype='octet-stream',
                          filename=nombre_seguro(nombre, 90))
    return em, cuerpo


def leer_adjuntos(msg):
    salida = []
    try:
        n = msg.get_number_of_attachments()
    except Exception:
        return salida
    for i in range(n):
        try:
            att = msg.get_attachment(i)
            tam = att.get_size()
            if not tam:
                continue
            datos = att.read_buffer(tam)
            salida.append((nombre_adjunto(att, i), datos))
        except Exception:
            continue
    return salida


# ---------------------------------------------------------------- recorrido

BASURA_NOMBRE = re.compile(r'(?i)^(image\d+\.(png|jpg|jpeg|gif)|oledata\.mso|~.*)$')


def exportar(ost, rol, destino, limite=0, sin_adjuntos=False, carpetas_no=(), carpetas_solo=()):
    f = pypff.file()
    f.open(ost)

    raiz_rol = os.path.join(destino, nombre_seguro(rol, 60))
    raiz_adj = os.path.join(destino, 'ADJUNTOS', nombre_seguro(rol, 60))
    os.makedirs(raiz_rol, exist_ok=True)

    indice_path = os.path.join(destino, '_indice.jsonl')
    vistos_adj = {}          # hash -> ruta relativa, para deduplicar
    cont = {'mails': 0, 'saltados': 0, 'adj': 0, 'adj_unicos': 0, 'bytes': 0}

    idx = open(indice_path, 'a', encoding='utf-8')

    def una_carpeta(folder, camino):
        nom = folder.get_name() or '(raiz)'
        ruta = (camino + '/' + nom).strip('/')
        if any(x.lower() in nom.lower() for x in carpetas_no if x):
            return
        # --carpetas-solo: se recorre todo el arbol igual, pero se archiva unicamente lo que
        # cuelga de la rama pedida (los buzones de terceros que Outlook dejo cacheados).
        activos = [x for x in carpetas_solo if x]
        dentro = (not activos) or any(x.lower() in ruta.lower() for x in activos)
        n = folder.get_number_of_sub_messages() if dentro else 0
        for i in range(n):
            if limite and cont['mails'] >= limite:
                return
            try:
                msg = folder.get_sub_message(i)
            except Exception:
                cont['saltados'] += 1
                continue
            asunto = texto(msg, 'get_subject')
            fecha = fecha_de(msg)
            if not asunto and not fecha:
                cont['saltados'] += 1      # metadatos de sincronizacion, no es un mail
                continue

            anio = fecha.strftime('%Y') if fecha else 'sin-fecha'
            sello = fecha.strftime('%Y-%m-%d_%H%M') if fecha else '0000-00-00_0000'
            carpeta = os.path.join(raiz_rol, anio)
            os.makedirs(carpeta, exist_ok=True)

            adjuntos = leer_adjuntos(msg)
            base = '%s_%s' % (sello, nombre_seguro(asunto))
            eml_path = os.path.join(carpeta, base + '.eml')
            k = 2
            while os.path.exists(eml_path):
                eml_path = os.path.join(carpeta, '%s (%d).eml' % (base, k))
                k += 1

            try:
                em, cuerpo_txt = construir_eml(msg, adjuntos)
                with open(eml_path, 'wb') as fh:
                    fh.write(bytes(em))
            except Exception:
                cont['saltados'] += 1
                continue

            sueltos = []
            if not sin_adjuntos:
                for nombre, datos in adjuntos:
                    if BASURA_NOMBRE.match(nombre.strip()):
                        continue
                    h = hashlib.sha256(datos).hexdigest()
                    cont['adj'] += 1
                    if h in vistos_adj:
                        sueltos.append(vistos_adj[h])
                        continue
                    dest_dir = os.path.join(raiz_adj, anio)
                    os.makedirs(dest_dir, exist_ok=True)
                    limpio = nombre_seguro(nombre, 90)
                    p = os.path.join(dest_dir, limpio)
                    j = 2
                    while os.path.exists(p):
                        raiz_n, ext = os.path.splitext(limpio)
                        p = os.path.join(dest_dir, '%s (%d)%s' % (raiz_n, j, ext))
                        j += 1
                    with open(p, 'wb') as fh:
                        fh.write(datos)
                    rel = os.path.relpath(p, destino)
                    vistos_adj[h] = rel
                    sueltos.append(rel)
                    cont['adj_unicos'] += 1
                    cont['bytes'] += len(datos)

            idx.write(json.dumps({
                'rol': rol,
                'carpeta_origen': ruta,
                'fecha': fecha.strftime('%Y-%m-%d %H:%M') if fecha else '',
                'asunto': asunto,
                'de': texto(msg, 'get_sender_name') or campo_registro(msg, PR_SENDER_NAME),
                'para': campo_registro(msg, PR_DISPLAY_TO),
                'cc': campo_registro(msg, PR_DISPLAY_CC),
                'extracto': re.sub(r'\s+', ' ', (cuerpo_txt or ''))[:400],
                'adjuntos': [nombre_seguro(a, 90) for a, _ in adjuntos],
                'adjuntos_sueltos': sueltos,
                'eml': os.path.relpath(eml_path, destino),
            }, ensure_ascii=False) + '\n')

            cont['mails'] += 1
            if cont['mails'] % 250 == 0:
                idx.flush()
                print('   %5d mails  |  %5d adjuntos unicos  |  %6.1f MB'
                      % (cont['mails'], cont['adj_unicos'], cont['bytes'] / 1024 ** 2), flush=True)

        for i in range(folder.get_number_of_sub_folders()):
            if limite and cont['mails'] >= limite:
                return
            una_carpeta(folder.get_sub_folder(i), ruta)

    una_carpeta(f.get_root_folder(), '')
    idx.close()
    return cont


def main():
    ap = argparse.ArgumentParser(description='Archiva un buzon .ost/.pst a .eml + adjuntos + indice')
    ap.add_argument('--ost', required=True)
    ap.add_argument('--rol', required=True, help='ej: "CALIDAD - QUALITY PROJECTS"')
    ap.add_argument('--destino', required=True)
    ap.add_argument('--limite', type=int, default=0)
    ap.add_argument('--sin-adjuntos', action='store_true')
    ap.add_argument('--carpetas-no', default='')
    ap.add_argument('--carpetas-solo', default='', help='archiva SOLO lo que cuelga de esta rama')
    a = ap.parse_args()

    # La ruta puede venir con comodin: los nombres con tilde ("Ingenieria") se rompen al
    # pasar por Git Bash, asi que se acepta "Ingenier*a" y se resuelve aca.
    if not os.path.exists(a.ost):
        import glob as _g
        cand = _g.glob(a.ost)
        if len(cand) == 1:
            a.ost = cand[0]
        elif len(cand) > 1:
            sys.exit('el patron da %d archivos, se esperaba 1:\n  %s' % (len(cand), '\n  '.join(cand)))
        else:
            sys.exit('no existe el buzon: %s' % a.ost)
    os.makedirs(a.destino, exist_ok=True)

    print('buzon : %s  (%.2f GB)' % (os.path.basename(a.ost), os.path.getsize(a.ost) / 1024 ** 3))
    print('rol   : %s' % a.rol)
    print('destino: %s' % a.destino)
    print('arranca: %s' % datetime.now().strftime('%H:%M:%S'), flush=True)

    c = exportar(a.ost, a.rol, a.destino, a.limite, a.sin_adjuntos,
                 [x.strip() for x in a.carpetas_no.split(',')],
                 [x.strip() for x in a.carpetas_solo.split(',')])

    print()
    print('LISTO %s' % datetime.now().strftime('%H:%M:%S'))
    print('  mails archivados : %d' % c['mails'])
    print('  items salteados  : %d  (metadatos sin asunto ni fecha)' % c['saltados'])
    print('  adjuntos vistos  : %d' % c['adj'])
    print('  adjuntos unicos  : %d  (%.1f MB tras deduplicar)' % (c['adj_unicos'], c['bytes'] / 1024 ** 2))


if __name__ == '__main__':
    main()
