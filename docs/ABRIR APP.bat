@echo off
title Barack Mercosul - Iniciando...
echo.
echo  ============================================
echo   BARACK MERCOSUL - Iniciando aplicacion...
echo  ============================================
echo.
echo  Espera unos segundos, se va a abrir el navegador.
echo  NO CIERRES esta ventana mientras uses la app.
echo.
cd /d "C:\dev\BarackMercosul"
start "" "http://localhost:3002" 2>nul
timeout /t 3 /nobreak >nul
start "" "http://localhost:3002"
npm run dev
