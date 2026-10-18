@echo off
rem Acceso facil al instalador del asistente de Barack. Se deja en la carpeta "0- INSTALAR CLAUDE (entrar aca)" de la nube
rem de Ingenieria y tambien adentro de "CLAUDE POR AREA". El instalador de verdad esta en "CLAUDE POR AREA\1- PUBLICADO":
rem esto solo lo busca y lo abre.
setlocal
set "INSTALADOR=%~dp0..\CLAUDE POR AREA\1- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" set "INSTALADOR=%~dp01- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" set "INSTALADOR=%~dp0..\1- PUBLICADO\Instalar.cmd"
if not exist "%INSTALADOR%" (
  echo.
  echo  No encuentro el instalador en esta PC.
  echo  Fijate que la carpeta "CLAUDE POR AREA" de la nube de Ingenieria este sincronizada, o avisale a Ingenieria.
  echo.
  pause
  exit /b 1
)
call "%INSTALADOR%"
exit /b %ERRORLEVEL%
