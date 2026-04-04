@echo off
cd /d "C:\Users\renom\OneDrive\Desktop\Thesis\SudACO"
set "LOG_DIR=logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG_FILE=%LOG_DIR%\ablation_login.log"

echo.>> "%LOG_FILE%"
echo ================================================================>> "%LOG_FILE%"
echo [%date% %time%] Ablation login run start>> "%LOG_FILE%"
echo ================================================================>> "%LOG_FILE%"
python scripts\run_ablation_parallel.py --max-jobs 8 >> "%LOG_FILE%" 2>&1
set "RC=%errorlevel%"
echo [%date% %time%] Ablation login run end exit_code=%RC%>> "%LOG_FILE%"
exit /b %RC%
