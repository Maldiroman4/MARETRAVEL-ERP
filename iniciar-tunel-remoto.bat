@echo off
title MARETRAVEL ERP - Tunel Remoto Cloudflare
echo ==============================================================
echo   MARETRAVEL ERP - ACCESO REMOTO SEGURO (CLOUDFLARE TUNNEL)
echo ==============================================================
echo.
echo Conectando tu servidor local (puerto 3000) a Internet...
echo Copia el enlace 'https://....trycloudflare.com' que aparecera abajo.
echo.
cloudflared.exe tunnel --url http://localhost:3000
pause
