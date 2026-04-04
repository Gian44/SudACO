@echo off
cd /d "C:\Users\renom\OneDrive\Desktop\Thesis\SudACO"
set "LOG_DIR=logs"
set "TIMEOUT_LOG_DIR=%LOG_DIR%\timeout_comparison"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%TIMEOUT_LOG_DIR%" mkdir "%TIMEOUT_LOG_DIR%"
set "LOG_FILE=%LOG_DIR%\timeout_login_pipeline.log"

echo.>> "%LOG_FILE%"
echo ================================================================>> "%LOG_FILE%"
echo [%date% %time%] Timeout comparison start>> "%LOG_FILE%"
echo Detailed logs: %TIMEOUT_LOG_DIR%\timeout_orchestrator.log>> "%LOG_FILE%"
echo                 %TIMEOUT_LOG_DIR%\timeout_alg0.log  (ACO)>> "%LOG_FILE%"
echo                 %TIMEOUT_LOG_DIR%\timeout_alg2.log  (CP-DCM-ACO)>> "%LOG_FILE%"
echo ================================================================>> "%LOG_FILE%"

python scripts\run_algo_timeout_comparison.py --workers-per-alg 4 --verbose --log-dir "%TIMEOUT_LOG_DIR%"
set "RC=%errorlevel%"
echo [%date% %time%] Timeout comparison end exit_code=%RC%>> "%LOG_FILE%"
exit /b %RC%
