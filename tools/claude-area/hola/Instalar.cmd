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
"%NODE%" "%PROG%" --instalar --proyecto area --preguntar
set "COD=%ERRORLEVEL%"
echo.
if "%COD%"=="0" goto listo
if "%COD%"=="3" goto esperar
echo  No quedo instalado (codigo %COD%).
echo  Sacale una foto a esta ventana y mandasela a Ingenieria.
goto fin

:listo
echo  LISTO. Ahora:
echo    1. Abri el programa Claude (esta en el menu Inicio).
echo    2. Arriba, hace clic en Code y despues en Local.
echo    3. Elegi la carpeta C:\ClaudeBarack y escribi: hola
if exist "%LOCALAPPDATA%\AnthropicClaude\claude.exe" goto fin
echo.
echo  Si el programa Claude todavia no esta en esta PC, se baja de claude.ai/download
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
