@echo off
REM Build script for compiling C++ Sudoku solver to WebAssembly (Windows)
REM Requires Emscripten to be installed and activated

echo Building WebAssembly module...

REM Set up Emscripten environment
call C:\emsdk\emsdk_env.bat

REM Create client/src/wasm directory if it doesn't exist
if not exist "client\src\wasm" mkdir "client\src\wasm"

REM Compile C++ to WebAssembly
emcc src/board.cpp src/sudokuant.cpp src/sudokuantsystem.cpp src/colonyant.cpp src/multicolonyantsystem.cpp src/backtracksearch.cpp src/wasm_interface.cpp -o client/src/wasm/sudoku_solver.js -I src -s WASM=1 -s EXPORTED_FUNCTIONS="[_solve_sudoku,_free]" -s EXPORTED_RUNTIME_METHODS="[ccall,cwrap,UTF8ToString]" -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME="createSudokuModule" -std=c++11 -O3

REM Check if compilation was successful
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] WebAssembly module compiled successfully!
    echo   Output: client/src/wasm/sudoku_solver.js
    echo   Output: client/src/wasm/sudoku_solver.wasm
) else (
    echo.
    echo [ERROR] Compilation failed!
    echo Please ensure Emscripten SDK is installed at C:\emsdk\
    exit /b 1
)
