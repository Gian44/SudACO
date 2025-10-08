@echo off
echo Building Sudoku Solver...
"C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe" .\vs2017\sudoku_ants.vcxproj /t:Build /p:Configuration=Release /p:Platform=x64
if %errorlevel% equ 0 (
    echo.
    echo Build successful! Executable: .\vs2017\x64\Release\sudoku_ants.exe
) else (
    echo.
    echo Build failed!
)
