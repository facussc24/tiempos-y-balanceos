@echo off
rem Abre la pagina "Tareas en segundo plano" de Barack y la mantiene al dia (se regenera cada 30 s).
rem Cerrar esta ventana la deja de actualizar. Tanda 6 del plan del sistema, 17/10/2026.
cd /d "%~dp0..\.."
node scripts\_programita.mjs %*
