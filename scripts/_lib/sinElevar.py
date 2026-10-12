# -*- coding: utf-8 -*-
"""
sinElevar.py — un script de mail lanzado COMO ADMINISTRADOR no puede hablar con el Outlook de Fak (12/10/2026).

Lo que paso: Fak pidio borrar borradores; `_mails.py` contestaba "No pude hablar con Outlook clasico
(-2146959355, 'Error en la ejecucion de servidor')" con Outlook abierto y respondiendo. Es 0x80080005
(CO_E_SERVER_EXEC_FAILURE): Windows no deja que un proceso elevado se conecte por COM a un Outlook que corre con
permisos normales. La sesion de Claude colgaba de un `claude.exe daemon` arrancado desde una ventana "como
administrador"; el sync programado de las 12:31 (permisos normales) andaba bien con el mismo Outlook.
Y si Outlook esta CERRADO es peor: el proceso elevado lo levanta elevado, y despues el sync y toda sesion normal
fallan al reves.

Regla: un proceso elevado no habla con Outlook. `relanzar_si_elevado()` va ANTES de `asegurar_outlook()` y del
`Dispatch`, y vuelve a correr el MISMO comando con permisos normales a traves de una tarea programada de un solo
uso (RunLevel LeastPrivilege, sesion interactiva de Fak), igual que `_arbVigilante.ps1`:
  - los argumentos viajan en un JSON en UTF-8 y los toma un stub de Python: no pasan por cmd, asi que un asunto con
    "5 %", "&" o acentos llega intacto (por cmd se rompian, y un --buscar podia agarrar OTRO borrador);
  - el codigo de salida lo escribe el stub en un archivo: no depende de LastTaskResult. `_mailEnviar` (1 y 4) y
    `--limpiar-borradores` (3) lo usan para decir "no reenviar sin mirar Outlook";
  - la tarea arranca con bateria (por defecto Windows la deja "En cola" para siempre: medido en la notebook de Fak);
  - `conhost --headless` para que no aparezca una consola (pythonw trabado desde el Programador: ver _arbVigilante);
  - la tarea se borra al terminar, ande o no.
La salida se muestra toda junta al final (no en vivo). Sin elevacion, no hace nada.

    python scripts/_lib/sinElevar.py --selftest      # sin Outlook ni tareas
    python scripts/_lib/sinElevar.py --probar        # corre un hijo de prueba sin elevar: acentos, %, & y codigo 3
"""
import ctypes
import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from xml.sax.saxutils import escape

MARCA = 'BARACK_SIN_ELEVAR'               # la lleva el hijo: nunca se relanza dos veces
HRESULT_ELEVACION = -2146959355           # 0x80080005 CO_E_SERVER_EXEC_FAILURE
ESPERA_ARRANQUE = 90                      # segundos para que la tarea arranque; si no, se avisa y se borra
TOPE = int(os.environ.get('BARACK_SIN_ELEVAR_TOPE', '3600'))


def elevado():
    """True si este proceso corre como administrador (token elevado)."""
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def es_error_elevacion(e):
    """True si la excepcion de COM es la de un proceso elevado contra un Outlook sin elevar."""
    args = getattr(e, 'args', ()) or ()
    return HRESULT_ELEVACION in args or '0x80080005' in str(e).lower() or str(HRESULT_ELEVACION) in str(e)


def xml_tarea(python, stub, pedido, tope=TOPE, usuario=None):
    """XML del Programador de tareas. Solo lleva rutas: el comando de verdad va en el JSON del pedido."""
    usuario = usuario or os.environ.get('USERNAME', '')
    conhost = os.path.join(os.environ.get('SystemRoot', r'C:\Windows'), 'System32', 'conhost.exe')
    args = '--headless "%s" "%s" --correr "%s"' % (python, stub, pedido)
    return '''<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Principals><Principal id="Author"><UserId>%s</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT%dS</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author"><Exec><Command>%s</Command><Arguments>%s</Arguments></Exec></Actions>
</Task>
''' % (escape(usuario), int(tope) + 60, escape(conhost), escape(args))


def _schtasks(*args):
    r = subprocess.run(['schtasks'] + list(args), capture_output=True)
    return r.returncode, (r.stdout + r.stderr).decode('cp850', errors='replace').strip()


def correr_sin_elevar(argv, cwd=None, tope=TOPE, python=None):
    """Corre `[python] + argv` con permisos normales. Imprime su salida y devuelve su codigo de salida.
    124 = no termino en `tope` segundos; 125 = la tarea no arranco o no se pudo crear."""
    python = python or sys.executable
    cwd = cwd or os.getcwd()
    base = os.path.join(tempfile.gettempdir(), 'barack_sin_elevar_' + uuid.uuid4().hex[:10])
    pedido, salida, codigo, xml = base + '.json', base + '.out.txt', base + '.code', base + '.xml'
    arranco = base + '.arranco'
    nombre = 'Barack - sin elevar ' + os.path.basename(base)[-10:]
    with open(pedido, 'w', encoding='utf-8') as f:
        json.dump({'python': python, 'argv': list(argv), 'cwd': cwd, 'salida': salida, 'codigo': codigo,
                   'arranco': arranco}, f, ensure_ascii=False)
    with open(xml, 'w', encoding='utf-16') as f:
        f.write(xml_tarea(python, os.path.abspath(__file__), pedido, tope))
    try:
        rc, txt = _schtasks('/create', '/tn', nombre, '/xml', xml, '/f')
        if rc != 0:
            print('NO SE HIZO: no pude crear la tarea para correr sin permisos de administrador (%s).' % txt)
            return 125
        rc, txt = _schtasks('/run', '/tn', nombre)
        if rc != 0:
            print('NO SE HIZO: no pude arrancar la tarea sin permisos de administrador (%s).' % txt)
            return 125
        t0 = time.time()
        while not os.path.exists(codigo):
            espera = time.time() - t0
            if not os.path.exists(arranco) and espera > ESPERA_ARRANQUE:
                print('NO SE HIZO: Windows no arranco la tarea en %d s (quedo en cola). No se corrio nada.' % ESPERA_ARRANQUE)
                return 125
            if espera > tope:
                print('*** CORTE POR TIEMPO (%d s): el comando puede haber hecho parte del trabajo. Mirar Outlook antes de repetir.' % tope)
                return 124
            time.sleep(0.5)
        time.sleep(0.2)
        if os.path.exists(salida):
            with open(salida, encoding='utf-8', errors='replace') as f:
                sys.stdout.write(f.read())
            sys.stdout.flush()
        with open(codigo, encoding='utf-8') as f:
            return int(f.read().strip() or 1)
    finally:
        _schtasks('/delete', '/tn', nombre, '/f')
        for p in (pedido, salida, codigo, xml, arranco):
            try:
                os.remove(p)
            except OSError:
                pass


def relanzar_si_elevado(argv=None):
    """Va ANTES de abrir o conectarse a Outlook. Si este proceso esta elevado, corre el mismo comando sin elevar y
    sale con su codigo. Si no esta elevado (o ya es el hijo relanzado), no hace nada."""
    if os.environ.get(MARCA) or not elevado():
        return
    argv = list(sys.argv if argv is None else argv)
    print('(Esta consola corre como administrador y Outlook no: Windows no los deja hablar. '
          'Repito el comando con permisos normales; la salida aparece al terminar.)')
    sys.stdout.flush()
    sys.exit(correr_sin_elevar(argv))


def _correr(pedido):
    """El stub que corre adentro de la tarea, ya sin elevar."""
    with open(pedido, encoding='utf-8') as f:
        p = json.load(f)
    open(p['arranco'], 'w').close()
    env = dict(os.environ, **{MARCA: '1', 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'})
    try:
        with open(p['salida'], 'w', encoding='utf-8') as out:
            rc = subprocess.run([p['python']] + p['argv'], cwd=p['cwd'], env=env, stdout=out,
                                stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL).returncode
    except Exception as e:
        with open(p['salida'], 'a', encoding='utf-8') as out:
            out.write('No pude correr el comando sin elevar: %s\n' % e)
        rc = 1
    with open(p['codigo'], 'w', encoding='utf-8') as f:
        f.write(str(rc))


def selftest():
    ok = [0]

    def chk(nombre, obtenido, esperado):
        bien = obtenido == esperado
        ok[0] += not bien
        print('%s %s' % ('ok  ' if bien else 'FALLA', nombre) + ('' if bien else '  -> %r != %r' % (obtenido, esperado)))

    class ComError(Exception):
        pass
    chk('detecta 0x80080005 de pywin32', es_error_elevacion(ComError(-2146959355, 'Error en la ejecución de servidor', None, None)), True)
    chk('no confunde otro error de COM', es_error_elevacion(ComError(-2147221005, 'Cadena de clase no válida', None, None)), False)
    x = xml_tarea(r'C:\Py\python.exe', r'C:\r\sinElevar.py', r'C:\T\p & q.json', tope=100, usuario='Fak')
    chk('sin elevar', '<RunLevel>LeastPrivilege</RunLevel>' in x, True)
    chk('arranca con bateria', '<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>' in x, True)
    chk('no se corta con bateria', '<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>' in x, True)
    chk('ruta con & escapada en el XML', 'p &amp; q.json' in x, True)
    chk('tope con margen', '<ExecutionTimeLimit>PT160S</ExecutionTimeLimit>' in x, True)
    os.environ[MARCA] = '1'
    try:
        chk('el hijo no se relanza', relanzar_si_elevado(['x']), None)
    finally:
        del os.environ[MARCA]
    return ok[0]


def probar():
    """Prueba de verdad (crea y borra una tarea): el texto con acentos, % y & y el codigo 3 tienen que volver iguales."""
    texto = 'revisión 5 % & "comillas" Ingeniería'
    salida = []
    real = sys.stdout

    class Copia:
        def write(self, s):
            salida.append(s)

        def flush(self):
            pass
    sys.stdout = Copia()
    try:
        rc = correr_sin_elevar(['-c', 'import sys,ctypes; print(sys.argv[1]); '
                                      'print("elevado", bool(ctypes.windll.shell32.IsUserAnAdmin())); sys.exit(3)', texto],
                               tope=120)
    finally:
        sys.stdout = real
    txt = ''.join(salida)
    print(txt.rstrip())
    fallas = 0
    for nombre, bien in (('codigo 3', rc == 3), ('texto intacto', texto in txt), ('hijo sin elevar', 'elevado False' in txt)):
        print('%s %s' % ('ok  ' if bien else 'FALLA', nombre))
        fallas += not bien
    return fallas


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--correr':
        _correr(sys.argv[2])
    elif '--selftest' in sys.argv:
        sys.exit(1 if selftest() else 0)
    elif '--probar' in sys.argv:
        sys.exit(1 if probar() else 0)
    else:
        sys.exit(__doc__)
