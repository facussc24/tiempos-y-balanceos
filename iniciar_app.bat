@echo off
title Smart Price Manager
echo Iniciando aplicacion...

:: Si no existe la carpeta node_modules, instalamos
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
)

:: Iniciamos la app
echo [INFO] Iniciando servidor...
call npm run dev

:: Si llega aqui es porque se cerro el servidor
echo.
echo [FIN] La aplicacion se ha cerrado.
pause
