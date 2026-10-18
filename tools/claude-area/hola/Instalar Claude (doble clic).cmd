@echo off
rem Acceso facil al instalador del asistente de Barack. Se deja en la carpeta "0- INSTALAR CLAUDE (entrar aca)" de la nube
rem de Ingenieria y tambien adentro de la carpeta del asistente por area. El instalador de verdad esta en el "1- PUBLICADO" de
rem esa carpeta: esto solo lo busca y lo abre.
rem Mudanza del 17/10/2026: esta carpeta paso de la raiz de la nube a "ASISTENTE INGENIERIA\9- VIEJO (no usar)", y la del asistente
rem por area tambien (hoy se llama "_CUARENTENA_CLAUDE POR AREA"; antes de la cuarentena, "CLAUDE POR AREA"). Las dos son HERMANAS
rem antes y despues de mover, por eso la misma ruta relativa sirve en los dos lugares. Se prueban los nombres del area del canon
rem (scripts/_lib/nubeCarpetas.data.json, clave area_vieja), el nuevo primero y despues el de antes.
setlocal
set "INSTALADOR=%~dp0..\_CUARENTENA_CLAUDE POR AREA\1- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" set "INSTALADOR=%~dp0..\CLAUDE POR AREA\1- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" set "INSTALADOR=%~dp01- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" set "INSTALADOR=%~dp0..\1- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" (
  echo.
  echo  No encuentro el instalador en esta PC.
  echo  Fijate que la carpeta del asistente por area de la nube de Ingenieria este sincronizada, o avisale a Ingenieria.
  echo.
  pause
  exit /b 1
)
call "%INSTALADOR%"
exit /b %ERRORLEVEL%
