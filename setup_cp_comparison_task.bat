@echo off
setlocal

set "TASK_NAME=SudACO_CP_Comparison_OnLogon"
set "SCRIPT_PATH=%~dp0run_cp_comparison_on_login.bat"
set "TASK_CMD=cmd /c \"\"%SCRIPT_PATH%\"\""

echo Creating/updating Task Scheduler entry: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /TR "%TASK_CMD%" /SC ONLOGON /F
set "RC=%errorlevel%"

if not "%RC%"=="0" (
    echo Failed to create or update scheduled task. Exit code: %RC%
    exit /b %RC%
)

echo Scheduled task is ready.
echo To verify:
echo   schtasks /Query /TN "%TASK_NAME%" /V /FO LIST
endlocal
exit /b 0
