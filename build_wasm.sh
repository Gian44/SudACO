#!/bin/bash

# Build script for compiling C++ Sudoku solver to WebAssembly
# Requires Emscripten to be installed and activated

echo "Building WebAssembly module..."

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found. Please install and activate Emscripten SDK."
    echo "Visit: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create client/public directory if it doesn't exist
mkdir -p client/public

# Compile C++ to WebAssembly
emcc \
  src/board.cpp \
  src/sudokuant.cpp \
  src/sudokuantsystem.cpp \
  src/colonyant.cpp \
  src/multicolonyantsystem.cpp \
  src/backtracksearch.cpp \
  src/wasm_interface.cpp \
  -o client/public/sudoku_solver.js \
  -I src \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_solve_sudoku","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME='createSudokuModule' \
  -std=c++11 \
  -O3

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo "✓ WebAssembly module compiled successfully!"
    echo "  Output: client/public/sudoku_solver.js"
    echo "  Output: client/public/sudoku_solver.wasm"
else
    echo "✗ Compilation failed!"
    exit 1
fi

