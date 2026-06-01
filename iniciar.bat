@echo off
title Diagnostico CEPAL - Servidor Local
echo ==========================================================
echo   Iniciando Servidor Local para Diagnostico CEPAL
echo ==========================================================
echo.
echo 1. Abriendo la aplicacion en tu navegador predeterminado...
start "" "http://localhost:8081"
echo 2. Iniciando servidor Python en http://localhost:8081 ...
echo.
python -m http.server 8081
if %ERRORLEVEL% neq 0 (
  echo.
  echo ERROR: No se pudo iniciar el servidor de Python.
  echo Asegurate de tener Python instalado y agregado a tu variable de entorno PATH.
  echo.
  pause
)
