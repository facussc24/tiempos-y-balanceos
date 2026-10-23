@echo off
setlocal
title Obrero CATIA - no cerrar esta ventana
set PYTHONDONTWRITEBYTECODE=1
cd /d "%~dp0"
echo.
echo  Obrero de CATIA - Barack Mercosul
echo  Esta ventana tiene que quedar abierta. Para pararlo: Ctrl+C o cerrar la ventana.
echo.
if not exist "obrero.py" goto falta_obrero
set "PY="
python -c "import sys; assert sys.version_info >= (3, 8)" >nul 2>&1 && set "PY=python"
if not defined PY py -3 -c "import sys; assert sys.version_info >= (3, 8)" >nul 2>&1 && set "PY=py -3"
if not defined PY goto falta_python
%PY% -c "import win32com.client" >nul 2>&1
if not errorlevel 1 goto arrancar
echo  Falta pywin32: lo instalo con pip (tarda un minuto)...
%PY% -m pip install -r requisitos.txt
%PY% -c "import win32com.client" >nul 2>&1
if errorlevel 1 goto falta_pywin32

:arrancar
%PY% obrero.py
if errorlevel 2 if not errorlevel 3 goto ya_corre
echo.
echo  El obrero se detuvo. Lo vuelvo a arrancar en 60 segundos (para no arrancarlo: Ctrl+C).
"%SystemRoot%\System32\timeout.exe" /t 60
goto arrancar

:ya_corre
echo.
echo  Ya hay otro obrero corriendo en esta PC (otra ventana negra). Deje esa abierta y cierre esta.
pause
exit /b 2

:falta_obrero
echo  ERROR: en esta carpeta no esta obrero.py. Avisele a Facundo: la carpeta COLA 3D\obrero esta incompleta.
pause
exit /b 1

:falta_python
echo  ERROR: no encuentro Python en esta PC.
echo  Instale Python 3.12 desde python.org y marque la casilla "Add python.exe to PATH".
echo  Despues vuelva a hacer doble clic en Arrancar-obrero.cmd.
pause
exit /b 1

:falta_pywin32
echo  ERROR: no pude instalar pywin32. Abra una consola (tecla Windows, escribir cmd) y escriba:
echo     pip install pywin32
echo  Despues vuelva a hacer doble clic en Arrancar-obrero.cmd.
pause
exit /b 1
