@echo off
title Instalar mi asistente completo en esta PC
echo.
echo Instalando tu asistente completo (skills, memoria y reglas) en esta PC...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0programa\instalar_mi_pc.ps1"
echo.
pause
