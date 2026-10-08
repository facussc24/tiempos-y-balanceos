@echo off
title Mails de las cuentas de Calidad a la nube de Ingenieria
echo.
echo Dejando andando la copia de los mails de las cuentas de Calidad a la nube de Ingenieria...
if exist "%~dp0programa\instalar.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0programa\instalar.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
)
echo.
pause
