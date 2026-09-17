@echo off
title MARETRAVEL ERP - Sistema y Base de Datos Local
cd /d "%~dp0"
cls
echo ========================================================================
echo               MARETRAVEL ERP - SISTEMA DE AGENCIA DE VIAJES
echo ========================================================================
echo.
echo  [1/2] Iniciando servidor con persistencia en carpeta...
echo  [2/2] Abriendo el sistema en su navegador predeterminado...
echo.
echo  Base de datos vinculada: data\database.json
echo  Direccion web local:    http://localhost:3000
echo.
echo  NOTA: Mantenga esta ventana abierta mientras trabaje con el sistema.
echo  Para cerrar el sistema, simplemente cierre esta ventana.
echo ========================================================================
echo.
start http://localhost:3000
node server.js
pause
