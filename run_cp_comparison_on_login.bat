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
echo [%date% %time%] CP comparison reruns start (25x25 only workflow)>> "%PIPELINE_LOG%"
echo Detailed log: %ORCH_LOG%>> "%PIPELINE_LOG%"
echo ================================================================>> "%PIPELINE_LOG%"

echo [%date% %time%] Step 1: Resume 25x25 run2 for alg0 with legacy reps=100>> "%PIPELINE_LOG%"
python scripts\run_cp_comparison_repeats.py --size 25x25 --run-start 2 --run-end 2 --alg 0 --reps 100 --pool-workers 4 --verbose >> "%ORCH_LOG%" 2>&1
set "RC=%errorlevel%"
if not "%RC%"=="0" goto :done

echo [%date% %time%] Step 2: Run 25x25 runs3-5 for alg0+alg2 with reps=1>> "%PIPELINE_LOG%"
python scripts\run_cp_comparison_repeats.py --size 25x25 --run-start 3 --run-end 5 --reps 1 --pool-workers 4 --verbose >> "%ORCH_LOG%" 2>&1
set "RC=%errorlevel%"

:done
echo [%date% %time%] CP comparison reruns end exit_code=%RC%>> "%PIPELINE_LOG%"
exit /b %RC%
