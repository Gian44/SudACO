@echo off
cd /d "C:\Users\renom\OneDrive\Desktop\Thesis\SudACO"

set "LOG_DIR=logs"
set "CP_LOG_DIR=%LOG_DIR%\cp_comparison"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%CP_LOG_DIR%" mkdir "%CP_LOG_DIR%"

set "PIPELINE_LOG=%LOG_DIR%\cp_comparison_login_pipeline.log"
set "ORCH_LOG=%CP_LOG_DIR%\cp_comparison_orchestrator.log"

echo.>> "%PIPELINE_LOG%"
echo ================================================================>> "%PIPELINE_LOG%"
echo [%date% %time%] CP comparison reruns start>> "%PIPELINE_LOG%"
echo Detailed log: %ORCH_LOG%>> "%PIPELINE_LOG%"
echo ================================================================>> "%PIPELINE_LOG%"

python scripts\run_cp_comparison_repeats.py --pool-workers 4 --verbose >> "%ORCH_LOG%" 2>&1
set "RC=%errorlevel%"

echo [%date% %time%] CP comparison reruns end exit_code=%RC%>> "%PIPELINE_LOG%"
exit /b %RC%
