@echo off
chcp 65001 >nul
cd /d "%~dp0game"
where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Установи Python с python.org и поставь галочку Add to PATH.
  pause
  exit /b
)
echo Игра "На даче" запускается на http://localhost:8123
echo Чтобы выйти, закрой это окно.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8123"
python -m http.server 8123
