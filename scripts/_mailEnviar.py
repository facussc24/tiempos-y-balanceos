# -*- coding: utf-8 -*-
"""
_mailEnviar.py — UNICA via autorizada para mandar un mail desde Outlook.

POR QUE EXISTE (incidente 2026-08-14)
  Fak mando el mail del AMFE 150. Quedo en la Bandeja de salida sin transmitir.
  Yo mire la cola, vi el item ahi y le afirme "el mail no salio, no hay nada que
  recuperar". Lo saque de la cola, lo edite y lo mande: salieron DOS mails a
  Marcelo, Nicolas y Carlos.
  Lo peor no fue no mirar: al listar Enviados APARECIO la entrada que coincidia
  en asunto, destinatarios, CC y adjunto, y la explique como "copia vieja".

  Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado:
  Outlook puede tener la copia en Enviados y el item en cola al mismo tiempo.

QUE HACE
  Antes de enviar corre un GATE de duplicados que ABORTA si en Enviados hay algo
  que se le parezca. No avisa: aborta. Despues del envio verifica de verdad que
  salio (cola vacia + item en Enviados posterior al Send).

USO
    python scripts/_mailEnviar.py --buscar "APB TRA CEN"              # dry-run
    python scripts/_mailEnviar.py --buscar "APB TRA CEN" --enviar
    python scripts/_mailEnviar.py --id <EntryID> --enviar
    python scripts/_mailEnviar.py --selftest                          # sin Outlook

  Dry-run por default, como todo script del proyecto que escribe.
  --forzar solo si Fak lo autoriza EXPLICITAMENTE para ese mail puntual.

DESTINATARIOS DE AFUERA (regla dura de Fak, 30/09/2026)
  Si alguno de los destinatarios no es @barackmercosul.com, ABORTA salvo --externos-ok.
  Fak: "no vamos a andar agregando a personas externas de esta empresa... a no ser que sea
  un mail que ya venga de ellos y yo te diga respondele a todos". Nombrar a alguien interno
  en el cuerpo lo suma al mail; a un externo, nunca: se enteraria de cosas internas.
  --externos-ok solo con el OK de Fak para ESE mail.
"""
import argparse
import os
import re
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
from vozMail import mostrar_voz                                          # noqa: E402
from outlookUi import asegurar_outlook, cartel_de_seguridad, vigilando   # noqa: E402
from gerenteCopia import GERENTE_NOMBRE, falta_gerente, selftest as selftest_gerente  # noqa: E402
import firmaIA                                                                    # noqa: E402


def firma_ia_del_mail(it):
    """Hallazgos BLOQUEANTES de "lo hizo Claude o una IA" en el asunto, el cuerpo, el nombre y el
    CONTENIDO de cada adjunto (Fak, 08/10/2026: ningun documento de Barack nombra a Claude ni a una
    IA, ni en lo oculto: pestañas, propiedades, la marca del complemento de Excel)."""
    import tempfile
    hs = firmaIA.revisar_texto(str(it.Subject or ''), 'mail', 'asunto', con_avisos=False)
    hs += firmaIA.revisar_texto(str(it.Body or ''), 'mail', 'cuerpo', con_avisos=False)
    with tempfile.TemporaryDirectory() as td:
        for k in range(it.Attachments.Count):
            a = it.Attachments.Item(k + 1)
            fn = str(a.FileName or f'adjunto{k}')
            hs += firmaIA.revisar_texto(fn, fn, 'nombre del adjunto', con_avisos=False)
            if os.path.splitext(fn)[1].lower() in firmaIA.DOCUMENTO and not re.match(r'(?i)image\d+\.', fn):
                p = os.path.join(td, f'{k}_{fn}')
                a.SaveAsFile(p)
                for h in firmaIA.revisar_archivo(p):
                    h.archivo = fn
                    hs.append(h)
    return [h for h in hs if h.nivel == 'BLOQUEANTE']

VENTANA_HORAS = 72          # cuanto para atras se mira Enviados
DOMINIO_INTERNO = '@barackmercosul.com'
PR_SMTP_ADDRESS = 'http://schemas.microsoft.com/mapi/proptag/0x39FE001E'
INLINE = re.compile(r'^(image\d+\.(png|jpg|jpeg|gif)|Outlook-[\w\-]+\.(png|jpg|jpeg))$', re.I)


# ── logica pura (testeable sin Outlook) ─────────────────────────────────────

def normalizar_asunto(s: str) -> str:
    """Saca los prefijos de respuesta/reenvio y normaliza espacios."""
    s = (s or '').strip()
    while True:
        nuevo = re.sub(r'^\s*(re|rv|fw|fwd|res)\s*:\s*', '', s, flags=re.I)
        if nuevo == s:
            break
        s = nuevo
    return re.sub(r'\s+', ' ', s).strip().lower()


def adjuntos_reales(nombres):
    """Descarta imagenes embebidas de firma: no identifican un mail."""
    return {n.strip().lower() for n in nombres if n and not INLINE.match(n.strip())}


def destinatarios_norm(s: str):
    return {p.strip().lower() for p in re.split(r'[;,]', s or '') if p.strip()}


def es_duplicado(cand, previo):
    """
    cand/previo: dict con asunto, para, cc, adjuntos (lista de nombres).
    Devuelve (bool, motivo). Falla hacia BLOQUEAR: con que coincida el asunto y
    UNA de las otras dos señales, alcanza.
    """
    if normalizar_asunto(cand['asunto']) != normalizar_asunto(previo['asunto']):
        return False, ''
    dest_c = destinatarios_norm(cand['para']) | destinatarios_norm(cand['cc'])
    dest_p = destinatarios_norm(previo['para']) | destinatarios_norm(previo['cc'])
    adj_c = adjuntos_reales(cand['adjuntos'])
    adj_p = adjuntos_reales(previo['adjuntos'])

    motivos = []
    if dest_c and dest_c == dest_p:
        motivos.append('mismos destinatarios')
    elif dest_c & dest_p:
        motivos.append(f"destinatarios en comun: {', '.join(sorted(dest_c & dest_p))}")
    if adj_c and adj_c == adj_p:
        motivos.append(f"mismos adjuntos: {', '.join(sorted(adj_c))}")

    if motivos:
        return True, 'mismo asunto + ' + ' + '.join(motivos)
    return False, ''


def es_interno(direccion: str) -> bool:
    """Casilla de Barack: solo la que termina en @barackmercosul.com. Un DN de Exchange
    (/o=...) NO prueba nada: los invitados externos tambien tienen uno (lista PAGOS GHS,
    30/09/2026: dos casillas de ghs-pharma.com con DN de la organizacion). Vacio tampoco:
    lo que no se pudo leer cuenta como de afuera."""
    d = (direccion or '').strip().lower()
    return d.endswith(DOMINIO_INTERNO)


def destinatarios_externos(direcciones):
    """Las direcciones que no son de Barack, en el orden en que vienen."""
    return [d for d in direcciones if not es_interno(d)]


# ── selftest ────────────────────────────────────────────────────────────────

def selftest() -> int:
    casos = []

    def chk(nombre, obtenido, esperado):
        casos.append((nombre, obtenido == esperado, obtenido, esperado))

    chk('prefijo RE', normalizar_asunto('RE: Hola'), 'hola')
    chk('prefijo anidado', normalizar_asunto('RE: RV: RE: Hola  mundo'), 'hola mundo')
    chk('inline fuera', adjuntos_reales(['image001.png', 'AMFE.pdf']), {'amfe.pdf'})
    chk('Outlook-xxx fuera', adjuntos_reales(['Outlook-abc123.png']), set())

    base = dict(asunto='RE: APB TRA CEN', para='Marcelo Nieve; Nicolas Perez',
                cc='Carlos Baptista', adjuntos=['image001.png', 'AMFE 150.pdf'])

    # EL CASO DEL INCIDENTE: mismo asunto, mismos destinatarios, mismo adjunto
    dup, _ = es_duplicado(base, dict(base))
    chk('detecta el duplicado del 14/08', dup, True)

    # cuerpo distinto pero todo lo demas igual -> IGUAL es duplicado
    otro = dict(base); otro['asunto'] = 'APB TRA CEN'
    dup, _ = es_duplicado(base, otro)
    chk('sin prefijo RE tambien matchea', dup, True)

    # solo un destinatario en comun -> bloquea igual (falla hacia el lado seguro)
    parcial = dict(base); parcial['para'] = 'Marcelo Nieve'; parcial['cc'] = ''
    parcial['adjuntos'] = ['otra cosa.pdf']
    dup, _ = es_duplicado(base, parcial)
    chk('un destinatario en comun bloquea', dup, True)

    # asunto distinto -> NO es duplicado
    distinto = dict(base); distinto['asunto'] = 'Otra cosa'
    dup, _ = es_duplicado(base, distinto)
    chk('asunto distinto no bloquea', dup, False)

    # mismo asunto pero otra gente y otro adjunto -> NO
    ajeno = dict(base); ajeno['para'] = 'Pablo Gamboa'; ajeno['cc'] = ''
    ajeno['adjuntos'] = ['otro.pdf']
    dup, _ = es_duplicado(base, ajeno)
    chk('mismo asunto pero otra gente no bloquea', dup, False)

    # destinatarios de afuera (regla del 30/09/2026)
    chk('todos internos: ninguno externo',
        destinatarios_externos(['pcejas@barackmercosul.com', 'CBaptista@BarackMercosul.com']), [])
    chk('el proveedor del hilo es externo',
        destinatarios_externos(['pcejas@barackmercosul.com', 'jorge.uresandi@partner.aunde.com']),
        ['jorge.uresandi@partner.aunde.com'])
    chk('dominio parecido no pasa por interno',
        destinatarios_externos(['x@barackmercosul.com.ar', 'y@mail-barackmercosul.com.br']),
        ['x@barackmercosul.com.ar', 'y@mail-barackmercosul.com.br'])
    dn = '/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP/CN=RECIPIENTS/CN=abc-Guest_46eeb'
    chk('un DN de Exchange solo no prueba que sea de Barack (invitado externo)',
        destinatarios_externos([dn]), [dn])
    chk('sin direccion resuelta cuenta como externo', destinatarios_externos(['']), [''])

    ok = all(c[1] for c in casos)
    for nombre, paso, obt, esp in casos:
        print(f"  {'OK  ' if paso else '*** FALLA'} {nombre}" + ('' if paso else f"  obtenido={obt} esperado={esp}"))
    print(f"\nselftest: {sum(c[1] for c in casos)}/{len(casos)}")
    return 0 if ok else 1


# ── Outlook ─────────────────────────────────────────────────────────────────

def _smtp_de_entrada(ae, nombre=''):
    """Casilla de un AddressEntry: la de Exchange, o la tipeada. Una direccion tipeada a mano
    (`cbaptista@...` sin resolver) trae Address vacio y la casilla en el nombre."""
    smtp = ''
    try:
        eu = ae.GetExchangeUser()
        smtp = eu.PrimarySmtpAddress if eu else ''
    except Exception:
        smtp = ''
    if not smtp:
        try:   # PR_SMTP_ADDRESS: la trae tambien un invitado externo, que no es ExchangeUser
            smtp = str(ae.PropertyAccessor.GetProperty(PR_SMTP_ADDRESS) or '')
        except Exception:
            smtp = ''
    if not smtp or smtp.lower().startswith('/o='):
        if '@' in (nombre or ''):
            smtp = nombre.strip()
        elif not smtp:
            try:
                smtp = str(ae.Address or '')
            except Exception:
                smtp = ''
    return smtp


def _miembros_de_lista(ae, nombre, prof=0):
    """[(nombre, smtp)] de los miembros de una lista de distribucion de Exchange (anidadas
    hasta 3 niveles). Una lista no es interna por su DN: sus miembros pueden ser de afuera."""
    res = []
    dl = ae.GetExchangeDistributionList()
    miembros = dl.GetExchangeDistributionListMembers()
    for k in range(miembros.Count):
        m = miembros.Item(k + 1)
        mnom = f"{nombre} > {m.Name}"
        if prof < 3 and getattr(m, 'AddressEntryUserType', None) == 1:
            res.extend(_miembros_de_lista(m, mnom, prof + 1))
        else:
            res.append((mnom, _smtp_de_entrada(m, str(m.Name or ''))))
    return res


def _direcciones(item):
    """[(nombre, smtp)] de cada destinatario, con la casilla REAL (no el nombre mostrado).
    Falla hacia BLOQUEAR: un destinatario que no se puede leer vuelve sin direccion, y sin
    direccion cuenta como de afuera."""
    res = []
    for k in range(item.Recipients.Count):
        nombre = ''
        try:
            r = item.Recipients.Item(k + 1)
            nombre = str(r.Name or '')
            ae = r.AddressEntry
            if getattr(ae, 'AddressEntryUserType', None) == 1:   # lista de distribucion
                res.extend(_miembros_de_lista(ae, nombre))
                continue
            smtp = _smtp_de_entrada(ae, nombre)
            if not smtp:
                smtp = str(r.Address or '')
        except Exception:
            smtp = ''
        res.append((nombre or f'destinatario {k + 1}', smtp))
    return res


def _campos(item):
    return dict(
        asunto=str(item.Subject or ''),
        para=str(item.To or ''),
        cc=str(item.CC or ''),
        adjuntos=[item.Attachments.Item(k + 1).FileName for k in range(item.Attachments.Count)],
    )


def main() -> int:
    ap = argparse.ArgumentParser(description='Envia un borrador de Outlook con gate anti-duplicado.')
    ap.add_argument('--buscar', help='texto del asunto del borrador a enviar')
    ap.add_argument('--id', help='EntryID exacto del borrador')
    ap.add_argument('--enviar', action='store_true', help='ejecuta (sin esto es dry-run)')
    ap.add_argument('--forzar', action='store_true',
                    help='saltea el gate de duplicados — SOLO con OK explicito de Fak')
    ap.add_argument('--sin-chequeo-voz', action='store_true', dest='sin_chequeo_voz',
                    help='saltea el gate de voz — solo con OK de Fak para ESE mail')
    ap.add_argument('--externos-ok', action='store_true', dest='externos_ok',
                    help='deja mandar a destinatarios de fuera de Barack — solo con OK de Fak para ESE mail')
    ap.add_argument('--sin-gerente', action='store_true', dest='sin_gerente',
                    help='deja mandar sin Carlos Baptista en el mail — solo con OK de Fak para ESE mail')
    ap.add_argument('--sin-chequeo-firma', action='store_true', dest='sin_chequeo_firma',
                    help='saltea el chequeo de "lo hizo Claude/IA" — solo con OK de Fak para ESE mail (falso positivo: un tercero citado)')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()

    if a.selftest:
        return selftest() or selftest_gerente()
    if not (a.buscar or a.id):
        ap.error('falta --buscar o --id')

    import win32com.client as win32
    import pythoncom
    pythoncom.CoInitialize()
    # Outlook se abre ANTES del Dispatch y como programa del usuario: uno que levanta el
    # Dispatch queda sin ventana y ademas el Object Model Guard le saca el cartel
    # "un programa intenta enviar correo en su nombre" en cada Send() (15/09/2026).
    print(f'Outlook: {asegurar_outlook()}')
    ol = win32.Dispatch('Outlook.Application')
    ns = ol.GetNamespace('MAPI')

    # 1. ubicar el borrador
    drafts = ns.GetDefaultFolder(16)
    if a.id:
        cands = [ns.GetItemFromID(a.id)]
    else:
        cands = [x for x in drafts.Items if a.buscar.lower() in str(x.Subject or '').lower()]
    if len(cands) != 1:
        print(f"ABORTA: esperaba 1 borrador y hay {len(cands)}.")
        for x in cands:
            print(f"   - {x.LastModificationTime} | {x.Subject} | {x.To}")
        return 1
    it = cands[0]
    cand = _campos(it)
    print(f"BORRADOR: {cand['asunto']}")
    print(f"  Para: {cand['para']}   CC: {cand['cc']}")
    print(f"  Adj : {cand['adjuntos']}")

    # 1a. GATE — ningun documento dice que lo hizo Claude o una IA (regla dura de Fak, 08/10/2026)
    firma = firma_ia_del_mail(it)
    if firma:
        print(f"\n  *** EL MAIL NOMBRA A CLAUDE O A UNA IA ({len(firma)}) ***")
        for h in firma[:15]:
            print(h.renglon())
        if not a.sin_chequeo_firma:
            print("\nABORTA. Se saca del cuerpo o del adjunto (python scripts/_sinFirmaIA.py --arreglar <archivo> --apply")
            print("para la marca del complemento y las propiedades) y se rearma el borrador. Si es un tercero citado")
            print("en el hilo y Fak lo ve: --sin-chequeo-firma.")
            return 3
        print("  --sin-chequeo-firma activo: sigo igual.")
    else:
        print("  Firma de IA: ninguna (cuerpo, asunto y adjuntos).")

    # 1b. GATE — destinatarios de fuera de Barack (regla dura de Fak, 30/09/2026)
    direcciones = _direcciones(it)
    afuera = [(n, d) for n, d in direcciones if not es_interno(d)]
    sin_resolver = [(n, d) for n, d in afuera if '@' not in d]
    externos = [(n, d) for n, d in afuera if '@' in d]
    if sin_resolver:
        print(f"\n  *** {len(sin_resolver)} DESTINATARIO(S) SIN CASILLA RESUELTA ***")
        for n, d in sin_resolver:
            print(f"      {n} <{d or 'vacio'}>")
        print("\nABORTA. Sin casilla no se sabe si es de Barack, y asi Exchange suele rebotar")
        print("(incidente 08/09). Abrir el borrador, resolver el nombre (Ctrl+K) y volver a correr.")
        return 3
    if externos:
        print(f"\n  *** {len(externos)} DESTINATARIO(S) DE FUERA DE BARACK ***")
        for n, d in externos:
            print(f"      {n} <{d}>")
        if not a.externos_ok:
            print("\nABORTA. A un externo no se lo suma a un mail: solo si el mail ya viene de el y")
            print("Fak dice 'respondele a todos' para ESE mail. Con su OK: --externos-ok.")
            return 3
        print("  --externos-ok activo: sigo igual.")
    else:
        print(f"  Destinatarios: los {len(direcciones)} son de Barack.")

    # 1c. GATE — el gerente va siempre, como minimo en copia (regla dura de Fak, 02/10/2026)
    if falta_gerente(direcciones):
        print(f"\n  *** {GERENTE_NOMBRE} NO ESTA EN EL MAIL ***")
        if not a.sin_gerente:
            print("\nABORTA. El gerente va siempre, como minimo en copia: rehacer el borrador con el")
            print("script que lo armo (lo agrega solo). Si Fak dijo que ESE mail va sin el: --sin-gerente.")
            return 3
        print("  --sin-gerente activo: sigo igual.")
    else:
        print(f"  {GERENTE_NOMBRE}: esta en el mail.")

    # 2. GATE — ¿ya hay algo parecido en Enviados?
    print(f"\nGATE anti-duplicado (Enviados, ultimas {VENTANA_HORAS} h)")
    import datetime
    corte = datetime.datetime.now() - datetime.timedelta(hours=VENTANA_HORAS)
    sent = ns.GetDefaultFolder(5).Items
    sent.Sort("[SentOn]", True)
    choques = []
    for x in sent:
        try:
            envio = x.SentOn.replace(tzinfo=None)
        except Exception:
            continue
        if envio < corte:
            break
        dup, motivo = es_duplicado(cand, _campos(x))
        if dup:
            choques.append((envio, motivo, str(x.To or '')))
    if choques:
        print(f"  *** {len(choques)} COINCIDENCIA(S) — ESTE MAIL YA SE ENVIO ***")
        for envio, motivo, para in choques:
            print(f"      [{envio:%Y-%m-%d %H:%M:%S}] {motivo}  -> {para}")
        if not a.forzar:
            print("\nABORTA. Si de verdad hay que mandarlo igual, requiere OK explicito de Fak")
            print("y se corre con --forzar.")
            return 2
        print("\n  --forzar activo: sigo igual.")
    else:
        print("  OK — nada parecido en Enviados.")

    # 3. la Bandeja de salida tiene que estar limpia de este asunto
    out = ns.GetDefaultFolder(4)
    encolados = [x for x in out.Items
                 if normalizar_asunto(str(x.Subject or '')) == normalizar_asunto(cand['asunto'])]
    if encolados:
        print(f"\nABORTA: ya hay {len(encolados)} item(s) de este asunto en la Bandeja de salida.")
        return 2
    print(f"  Bandeja de salida: {out.Items.Count} item(s), ninguno de este asunto.")

    # 3b. la VOZ: el mail sale a nombre de Fak y tiene que sonar a el.
    # Fak, 11/09/2026: "revise porque revisamos, yo revise". Regla mail-envio.md; el gate y
    # sus numeros, en scripts/_lib/vozGate.mjs (calibrado contra 935 mails suyos).
    if not a.sin_chequeo_voz:
        cuerpo_txt = str(getattr(it, 'Body', '') or '')
        print("\n[3b] Voz del mail:")
        mostrar_voz(cuerpo_txt, bloquear=a.enviar and not a.forzar)
    else:
        print("\n[3b] Voz del mail: SALTEADO (--sin-chequeo-voz)")

    # 4. Outlook sin ventana no ejecuta envio/recepcion (incidente 14/08)
    if ol.Explorers.Count == 0:
        print("\n  Outlook no tiene ninguna ventana abierta: la abro o no transmite.")
        if a.enviar:
            exp = ol.Explorers.Add(ns.GetDefaultFolder(6), 0)
            exp.Display()
            time.sleep(5)

    if not a.enviar:
        print("\nDRY-RUN: no se envio nada. Agrega --enviar cuando este OK.")
        return 0

    # 5. enviar — vigilado: si Outlook saca el cartel de seguridad, el Send() se queda
    #    bloqueado esperando un clic y el script se colgaba MUDO hasta el timeout.
    _, cartel = vigilando(it.Send, descripcion='el envio')
    if cartel:
        print("  (hubo cartel de seguridad de Outlook y se respondio; sigo)")
    try:
        ns.SendAndReceive(False)
    except Exception as e:
        print(f"  (SendAndReceive aviso: {e})")

    # 6. verificar DE VERDAD que salio
    for i in range(24):
        if out.Items.Count == 0:
            break
        time.sleep(5)
    if out.Items.Count:
        x = out.Items.Item(1)
        try:
            f = x.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x0E070003")
            print(f"\n*** SIGUE EN COLA. PR_MESSAGE_FLAGS=0x{f:08X} "
                  f"UNSENT={bool(f & 0x08)} SUBMIT={bool(f & 0x04)}")
            if f & 0x08 and not f & 0x04:
                print("    Es un borrador parado en la Bandeja de salida: no va a salir nunca.")
                print("    Se destraba moviendolo a Borradores y haciendo Send() desde ahi.")
        except Exception:
            print("\n*** SIGUE EN COLA (no pude leer los flags)")
        return 1

    sent = ns.GetDefaultFolder(5).Items
    sent.Sort("[SentOn]", True)
    x = sent.GetFirst()
    print(f"\nENVIADO — [{x.SentOn}] {x.Subject}")
    print(f"  Para: {x.To}   CC: {x.CC}")
    print(f"  Adj : {[x.Attachments.Item(k + 1).FileName for k in range(x.Attachments.Count)]}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
