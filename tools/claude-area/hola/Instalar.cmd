@echo off
setlocal
title Claude de Barack - instalar en esta PC
rem Instalador de doble clic. Corre el MISMO programa que usa Claude cuando alguien escribe "instala" en esta carpeta,
rem con el Node que viaja adentro (la PC no necesita tener nada instalado). Solo ASCII en este archivo.
set "AQUI=%~dp0"
set "NODE=%AQUI%contenido\marketplace\plugins\barack-area\bin\node.exe"
set "PROG=%AQUI%contenido\programas\_paquete.mjs"
echo.
echo  Claude de Barack - instalacion en esta PC
echo  ------------------------------------------
echo.
if not exist "%NODE%" goto falta
if not exist "%PROG%" goto falta
echo  Verificando y copiando. Puede tardar uno o dos minutos (mas si se
echo  esta bajando de la nube): no cierres esta ventana.
echo.
"%NODE%" "%PROG%" --instalar --proyecto area --preguntar
set "COD=%ERRORLEVEL%"
echo.
if "%COD%"=="0" goto listo
if "%COD%"=="3" goto esperar
echo  No quedo instalado (codigo %COD%).
echo  Sacale una foto a esta ventana y mandasela a Ingenieria.
goto fin

:listo
rem LISTO se dice solo si quedo la marca de instalado (el programa pudo salir con 0 sin haber hecho nada).
set "CASA=C:\ClaudeBarack"
if defined CLAUDE_AREA_HOME set "CASA=%CLAUDE_AREA_HOME%"
if exist "%CASA%\instalado.json" goto quedo
echo  El programa termino pero NO quedo instalado.
echo  Sacale una foto a esta ventana y mandasela a Ingenieria.
set "COD=1"
goto fin

:quedo
rem Con carpetas de prueba (las pruebas del programa) no se abre nada.
if defined CLAUDE_AREA_HOME goto pasos
rem El programa Claude, cuando esta instalado, registra los enlaces claude:// en Windows.
reg query "HKCR\claude\shell\open\command" >nul 2>&1
if errorlevel 1 goto sinclaude
rem Abrir Claude solo queda APAGADO salvo que el archivo abrir-claude.txt, al lado de este instalador, empiece con: si
if not exist "%AQUI%abrir-claude.txt" goto pasos
findstr /x /i /c:"si" "%AQUI%abrir-claude.txt" >nul 2>&1
if errorlevel 1 goto pasos
echo  LISTO. Ahora se abre Claude en la carpeta C:\ClaudeBarack.
echo    1. Cuando pregunte por la carpeta, acepta.
echo    2. Ya esta escrito "hola": apreta Enter.
echo.
echo  Si Claude no se abre solo: abrilo, hace clic en Code y despues en Local,
echo  elegi la carpeta C:\ClaudeBarack y escribi: hola
start "" "claude://code/new?folder=C%%3A%%5CClaudeBarack&q=hola"
goto fin

:sinclaude
echo  LISTO, pero falta el programa Claude en esta PC: se baja de claude.com/download
echo  Despues: abrir Claude, clic en Code y en Local, elegir la carpeta C:\ClaudeBarack
echo  y escribir: hola
goto fin

:pasos
echo  LISTO. Ahora:
echo    1. Abri el programa Claude (esta en el menu Inicio).
echo    2. Arriba, hace clic en Code y despues en Local.
echo    3. Elegi la carpeta C:\ClaudeBarack y escribi: hola
echo.
echo  Si Claude pide permiso a cada paso: en Configuracion, Claude Code, prender
echo  la opcion que permite "Omitir permisos" (una sola vez, lo hace Ingenieria).
goto fin

:esperar
echo  Esta carpeta todavia no termino de bajar o de copiarse. Proba de nuevo en un rato.
goto fin

:falta
echo  A esta carpeta le faltan archivos: todavia no termino de bajar o de copiarse.
echo  Proba de nuevo en un rato. Si sigue igual, avisale a Ingenieria.
set "COD=3"

:fin
echo.
pause
exit /b %COD%
