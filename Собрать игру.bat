@echo off
chcp 65001 >nul
cd /d "%~dp0game"
where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Установи Python с python.org и поставь галочку Add to PATH.
  pause
  exit /b
)
python build.py
echo.
echo Готовый файл: "На даче.html" (рядом с этим файлом) и game\dist\index.html
pause
