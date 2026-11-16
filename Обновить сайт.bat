@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\Git\cmd"

where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Установи Python с python.org и поставь галочку Add to PATH.
  pause
  exit /b
)
where git >nul 2>nul
if errorlevel 1 (
  echo Git не найден. Установи Git: https://git-scm.com
  pause
  exit /b
)

echo [1/3] Собираю игру...
pushd game
python build.py
if errorlevel 1 (
  popd
  echo Сборка не удалась.
  pause
  exit /b
)
popd
copy /y "На даче.html" "index.html" >nul

echo [2/3] Сохраняю изменения...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Изменений нет, обновлять нечего.
  pause
  exit /b
)
git commit -q -m "Обновление игры"

echo [3/3] Отправляю на GitHub...
git push
if errorlevel 1 (
  echo Не удалось отправить. Проверь интернет и вход в GitHub.
  pause
  exit /b
)

echo.
echo Готово! Через 1-2 минуты обновится: https://bytherumak.github.io/na-dache/
pause
