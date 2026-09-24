# -*- coding: utf-8 -*-
"""
arbExcel.py — que ventanas de Excel son DEL EXPORT del arb y cuales son de Fak.

El export `Tabla EXcel` del arb abre `C:\\tmp\\RELACIONES.TXT` en Excel y Excel se queda con el
archivo: el export siguiente falla en silencio. `_arbVer.cerrar_excel()` lo libera. Hasta el
24/09/2026 lo hacia a lo bruto: WM_CLOSE a TODAS las ventanas `XLMAIN` visibles y un click a
ciegas en (383, 227) de TODO `NUIDialog` visible. Ese dia imprimio *"Excel cerrado (2 ventana/s)"*
y se llevo lo que Fak tenia abierto. Y el click a ciegas era peor: el cartel de *"¿Quiere guardar
los cambios?"* de Office 2016+ tambien es un `NUIDialog`, con el mismo titulo, y el click podia
caer en `No guardar`.

Aca vive la DECISION, sin Windows adentro, para poder probarla en CI (Ubuntu):
  - `es_ventana_del_export(titulo)`: el titulo de un `XLMAIN` nombra al archivo del export.
  - `clasificar_cartel(elementos)`: los textos y botones de un `NUIDialog`, leidos por UI
    Automation, son el cartel de conversiones ("quitar ceros iniciales") y no otro.
El `NUIDialog` es DirectUI: no tiene controles Win32 hijos y `WM_GETTEXT` solo da el titulo
("Microsoft Excel", igual en los dos carteles). Por eso se lee con UI Automation
(`leer_cartel`), que viene con Windows (.NET + PowerShell 5.1): nada que instalar.

    python scripts/_lib/arbExcel.py --selftest
"""
import base64
import json
import re
import subprocess
import sys
import unicodedata

# Lo que abre `_arbVer.export()`: solo RELACIONES. ARTICULO.TXT / INSUMOS.TXT tambien los
# escribe el arb en C:\tmp, pero ningun script los exporta: si estan abiertos en Excel, los
# abrio Fak y son suyos.
ARCHIVOS_EXPORT = ('RELACIONES.TXT',)

# Botones del cartel "De forma predeterminada, Excel realizara las siguientes conversiones de
# datos: • Quitar ceros iniciales" (y su version en ingles). Se compara normalizado.
BOTON_NO_CONVERTIR = ('no convertir', "don't convert", 'do not convert')
BOTON_CONVERTIR = ('convertir', 'convert')
SENALES_CONVERSION = ('conversiones de datos', 'data conversions',
                      'ceros iniciales', 'leading zeros')
# Si uno de estos esta en el cartel, es el de guardar: NO se toca, nunca.
BOTONES_GUARDAR = ('guardar', 'no guardar', 'guardar como', 'save', "don't save",
                   'do not save', 'save as')


def _norm(s):
    """minusculas, sin tildes, sin '&' de acelerador, apostrofo tipografico -> recto."""
    s = unicodedata.normalize('NFD', str(s or '').replace('\u2019', "'").replace('&', ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ' '.join(s.casefold().split())


def libro_del_titulo(titulo):
    """El nombre del libro que muestra el titulo de una ventana `XLMAIN`.

    'RELACIONES.TXT - Excel' -> 'RELACIONES.TXT'. Se descartan las marcas que Excel le agrega
    al nombre: '[Solo lectura]', '[Modo de compatibilidad]', y el ':2' de una segunda ventana
    del mismo libro. Separador: guion (o raya) CON espacios alrededor; un nombre de archivo con
    guion pegado ('RELACIONES-viejo.TXT') no se parte.
    """
    primero = re.split(r'\s+[-\u2013\u2014\u2022]\s+', str(titulo or '').strip())[0]
    primero = re.sub(r'(\s*\[[^\]]*\])+\s*$', '', primero)
    primero = re.sub(r':\d+$', '', primero.strip())
    return primero.strip()


def es_ventana_del_export(titulo, archivos=ARCHIVOS_EXPORT):
    """True si el titulo nombra EXACTAMENTE a uno de los archivos del export.

    Con la extension ('RELACIONES.TXT') o sin ella ('RELACIONES', si Windows oculta las
    extensiones). 'RELACIONES.xlsx', 'Copia de RELACIONES.TXT' o 'RELACIONES_viejo' NO: son
    libros de Fak con un nombre parecido, y justamente esos son los que no se cierran.
    """
    libro = _norm(libro_del_titulo(titulo))
    if not libro:
        return False
    for a in archivos:
        a = _norm(a)
        if libro == a or libro == a.rsplit('.', 1)[0]:
            return True
    return False


def clasificar_cartel(elementos):
    """Que cartel es un `NUIDialog` de Excel, a partir de lo que leyo UI Automation.

    `elementos`: [(tipo, nombre)], tipo como lo da UIA ('ControlType.Button', 'ControlType.Text'...).
    Devuelve (clase, boton):
      ('conversiones', '<nombre exacto del boton No convertir>')  -> se puede contestar
      ('guardar', None)       -> cartel de guardar cambios: NO se toca
      ('desconocido', None)   -> cualquier otra cosa (o no se pudo leer): NO se toca
    Para ser 'conversiones' tienen que estar las TRES señales: el boton No convertir (uno
    solo), el boton Convertir, y el texto que habla de conversiones / ceros iniciales. Y
    ningun boton de guardar: si aparece uno, gana 'guardar', diga lo que diga el resto.
    """
    botones = [n for t, n in elementos if str(t).endswith('Button') and str(n or '').strip()]
    nb = [_norm(b) for b in botones]
    if any(b in BOTONES_GUARDAR for b in nb):
        return 'guardar', None
    texto = _norm(' '.join(str(n or '') for _t, n in elementos))
    no_conv = [b for b, n in zip(botones, nb) if n in BOTON_NO_CONVERTIR]
    if (len(no_conv) == 1 and any(n in BOTON_CONVERTIR for n in nb)
            and any(s in texto for s in SENALES_CONVERSION)):
        return 'conversiones', no_conv[0]
    return 'desconocido', None


# ------------------------------------------------------------- UI Automation (solo Windows)

_UIA = """
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$e = $A::FromHandle([IntPtr]%d)
"""

_LEER = _UIA + """
$out = @()
foreach ($x in $e.FindAll([System.Windows.Automation.TreeScope]::Subtree,
                           [System.Windows.Automation.Condition]::TrueCondition)) {
    $out += [pscustomobject]@{ t = $x.Current.ControlType.ProgrammaticName; n = $x.Current.Name }
}
ConvertTo-Json -InputObject $out -Compress
"""

# Busca el boton por NOMBRE EXACTO (el que leyo `leer_cartel` y aprobo `clasificar_cartel`)
# y lo aprieta con InvokePattern: sin mouse ni coordenadas, asi que no puede caer en otro boton.
_APRETAR = _UIA + """
$nombre = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('%s'))
$c = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button)),
    (New-Object System.Windows.Automation.PropertyCondition($A::NameProperty, $nombre)))
$b = $e.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c)
if (-not $b) { 'NO-ENCONTRADO'; exit 2 }
$b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
'OK'
"""


def _powershell(script, timeout=25):
    enc = base64.b64encode(script.encode('utf-16-le')).decode('ascii')
    r = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-EncodedCommand', enc],
                       capture_output=True, timeout=timeout)
    return r.returncode, r.stdout.decode('utf-8', 'replace').strip(), \
        r.stderr.decode('utf-8', 'replace').strip()


def leer_cartel(hwnd):
    """[(tipo, nombre)] de todo lo que hay adentro de la ventana, o None si no se pudo leer."""
    try:
        code, out, _err = _powershell(_LEER % int(hwnd))
        if code != 0 or not out:
            return None
        datos = json.loads(out.lstrip('\ufeff'))
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return None
    if isinstance(datos, dict):             # ConvertTo-Json de un solo elemento no da lista
        datos = [datos]
    return [(d.get('t') or '', d.get('n') or '') for d in datos]


def apretar_boton(hwnd, nombre):
    """InvokePattern sobre el boton de nombre EXACTO `nombre`. True si lo apreto."""
    b64 = base64.b64encode(str(nombre).encode('utf-8')).decode('ascii')
    try:
        code, out, _err = _powershell(_APRETAR % (int(hwnd), b64))
    except (OSError, subprocess.TimeoutExpired):
        return False
    return code == 0 and out.endswith('OK')


# ------------------------------------------------------------------------------ selftest

def selftest():
    """Las dos direcciones: lo del export se reconoce, y lo de Fak NO."""
    malos = 0

    def caso(desc, obtenido, esperado):
        nonlocal malos
        ok = obtenido == esperado
        malos += not ok
        print('  %s  %-58s esperado=%r obtenido=%r' % ('ok  ' if ok else 'MAL ', desc[:58],
                                                        esperado, obtenido))

    print('ventanas XLMAIN (titulo -> es del export):')
    for titulo, esp in [
        ('RELACIONES.TXT - Excel', True),
        ('RELACIONES.TXT  -  Excel', True),
        ('RELACIONES - Excel', True),                             # extensiones ocultas
        ('relaciones.txt - Excel', True),
        ('RELACIONES.TXT [Solo lectura] - Excel', True),
        ('RELACIONES.TXT  [Modo de compatibilidad] - Excel', True),
        ('RELACIONES.TXT:2 - Excel', True),
        ('RELACIONES.TXT \u2013 Excel', True),
        # los de Fak: lo que NO se cierra
        ('RELACIONES.xlsx - Excel', False),
        ('Copia de RELACIONES.TXT - Excel', False),
        ('RELACIONES_viejo.TXT - Excel', False),
        ('RELACIONES-viejo.TXT - Excel', False),
        ('INSUMOS.TXT - Excel', False),                           # lo exporta Fak, no el robot
        ('ARTICULO.TXT - Excel', False),
        ('Listado hojas de proceso.xlsx - Excel', False),
        ('Libro1 - Excel', False),
        ('Excel', False),
        ('', False),
    ]:
        caso(titulo or '(vacio)', es_ventana_del_export(titulo), esp)
    caso('INSUMOS.TXT si se pide explicito',
         es_ventana_del_export('INSUMOS.TXT - Excel', ('INSUMOS.TXT',)), True)

    print('carteles NUIDialog (lo que leyo UIA -> clase):')
    B, T, W, P = 'ControlType.Button', 'ControlType.Text', 'ControlType.Window', 'ControlType.Pane'
    # Los tres en castellano son LEIDOS con `leer_cartel` del Excel de esta PC el 24/09/2026
    # (16.0.20326), sobre archivos de prueba: no son de memoria.
    conv_es = [(W, 'Microsoft Excel'), (P, ''), (W, 'Microsoft Excel'), (T, 'Microsoft Excel'),
               ('ControlType.Image', 'Icono de advertencia'),
               (T, 'De forma predeterminada, Excel realizará las siguientes conversiones de datos '
                   'en este archivo:\n\n• Quitar ceros iniciales\n\n¿Desea conservar '
                   'permanentemente estas conversiones?'),
               ('ControlType.CheckBox', 'No notificarme de conversiones predeterminadas en .csv o similares.'),
               (B, 'Convertir'), (B, 'No convertir')]
    guardar_es = [(W, ''), (P, ''), (W, '¿Guardar los cambios en este archivo?'), (P, ''),
                  (T, 'Evite perder cambios en este archivo en el futuro guardándolo en una carpeta '
                      'de la que se haya realizado una copia de seguridad en la nube.'),
                  ('ControlType.Edit', 'Nombre de archivo'), ('ControlType.ComboBox', 'Guardar como tipo'),
                  ('ControlType.ComboBox', 'Elegir una ubicación'), (T, 't1'),
                  (B, 'Abrir'), (B, 'Guardar'), (B, 'No guardar'), (B, 'Cancelar')]
    analisis_rapido = [(W, ''), (P, ''), (W, ''), (B, 'Análisis rápido')]
    # En ingles no hay Office en esta PC para leerlos: son los textos que publica Microsoft.
    conv_en = [(T, 'By default, Excel will perform the following data conversions:'),
               (T, 'Remove leading zeros'), (B, 'Convert'), (B, 'Don\u2019t Convert')]
    guardar_es_corto = [(W, 'Microsoft Excel'), (T, '¿Quiere guardar los cambios en RELACIONES.TXT?'),
                        (B, 'Guardar'), (B, 'No guardar'), (B, 'Cancelar')]
    guardar_en = [(T, 'Want to save your changes to Book1?'),
                  (B, 'Save'), (B, "Don't Save"), (B, 'Cancel')]
    for desc, elems, esp in [
        ('conversiones, castellano (real)', conv_es, ('conversiones', 'No convertir')),
        ('guardar cambios, castellano (real)', guardar_es, ('guardar', None)),
        ('boton flotante Analisis rapido (real)', analisis_rapido, ('desconocido', None)),
        ('guardar cambios, castellano sin carpeta', guardar_es_corto, ('guardar', None)),
        ('conversiones, ingles', conv_en, ('conversiones', 'Don\u2019t Convert')),
        ('guardar cambios, ingles', guardar_en, ('guardar', None)),
        # un cartel con No convertir Y un boton de guardar: gana guardar
        ('mezcla: conversiones + boton Guardar', conv_es + [(B, 'Guardar')], ('guardar', None)),
        ('sin el texto de conversiones', [(B, 'Convertir'), (B, 'No convertir')],
         ('desconocido', None)),
        ('sin el boton Convertir', [(T, 'Quitar ceros iniciales'), (B, 'No convertir')],
         ('desconocido', None)),
        ('No convertir repetido', conv_es + [(B, 'No convertir')], ('desconocido', None)),
        ('"no convertir" como TEXTO, no boton',
         [(T, 'conversiones de datos'), (B, 'Convertir'), (T, 'No convertir')],
         ('desconocido', None)),
        ('otro cartel de Excel (Aceptar)', [(T, 'No se encuentra el archivo'), (B, 'Aceptar')],
         ('desconocido', None)),
        ('solo el titulo (lo que da WM_GETTEXT)', [('ControlType.Window', 'Microsoft Excel')],
         ('desconocido', None)),
        ('nada leido', [], ('desconocido', None)),
    ]:
        caso(desc, clasificar_cartel(elems), esp)

    print('\nselftest arbExcel: %s' % ('todo verde' if not malos else '%d MAL' % malos))
    return 1 if malos else 0


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    sys.exit(__doc__)
