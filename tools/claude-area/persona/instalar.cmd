@echo off
title Instalar Claude - {{NOMBRE}}
set "PS1=%~dp0_instalador\instalar.ps1"
if exist "%PS1%" goto correr
echo.
echo  No encuentro la carpeta _instalador al lado de este archivo.
echo  Tienen que estar los dos juntos, en el pendrive o en la misma carpeta.
echo.
pause
exit /b 1
:correr
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
