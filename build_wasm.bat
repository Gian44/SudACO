@echo off
REM Build script for compiling C++ Sudoku solver to WebAssembly (Windows)
REM Requires Emscripten to be installed and activated

echo Building WebAssembly module...

REM Check if emcc is available
where emcc >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Emscripten (emcc) not found. Please install and activate Emscripten SDK.
    echo Visit: https://emscripten.org/docs/getting_started/downloads.html
    exit /b 1
)

REM Create client/public directory if it doesn't exist
if not exist "client\public" mkdir "client\public"

REM Set up Emscripten environment
call C:\emsdk\emsdk_env.bat

REM Compile C++ to WebAssembly
emcc ^
  src/board.cpp ^
  src/sudokuant.cpp ^
  src/sudokuantsystem.cpp ^
  src/colonyant.cpp ^
  src/multicolonyantsystem.cpp ^
  src/backtracksearch.cpp ^
  src/wasm_interface.cpp ^
  -o client/public/sudoku_solver.js ^
  -I src ^
  -s WASM=1 ^
  -s EXPORTED_FUNCTIONS="[\"_solve_sudoku\",\"_free\"]" ^
  -s EXPORTED_RUNTIME_METHODS="[\"ccall\",\"cwrap\",\"UTF8ToString\"]" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -s INITIAL_MEMORY=67108864 ^
  -s MODULARIZE=1 ^
  -s EXPORT_ES6=1 ^
  -s EXPORT_NAME="createSudokuModule" ^
  -std=c++11 ^
  -O3

REM Check if compilation was successful
if %ERRORLEVEL% EQU 0 (
    echo [OK] WebAssembly module compiled successfully!
    echo   Output: client/public/sudoku_solver.js
    echo   Output: client/public/sudoku_solver.wasm
) else (
    echo [ERROR] Compilation failed!
    exit /b 1
)

