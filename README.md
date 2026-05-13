# SudACO

C++ implementation of a Sudoku solver using **Multi-Colony Ant Colony Optimization with a Dynamic Collaborative Mechanism and Cooperative Game (DCM-ACO)**, alongside an Ant Colony System (ACS) baseline and a backtracking-with-constraint-propagation reference.

The same core compiles to:
- A **native CLI executable** (`sudoku_ants.exe` on Windows / `sudokusolver` on Linux/macOS) for benchmarking and reproducing thesis experiments.
- A **WebAssembly module** that the deployed React frontend consumes. The frontend lives in a separate folder/repo (the deployed version of this project).

## Quick start

```bash
git clone https://github.com/Gian44/SudACO.git
cd SudACO
```

Then jump to one of:

- [Building the native CLI](#building-the-native-cli) — to run the solver locally.
- [Rebuilding the WebAssembly module](#rebuilding-the-webassembly-module) — only if you change the C++ and need a new `.wasm` for the frontend.

## Repository layout

```
.
├── src/                       # C++ source
│   ├── wasm_interface.cpp     # Emscripten entry points (used by the WASM build)
│   ├── solvermain.cpp         # Native CLI entry point
│   ├── multicolonyantsystem.* # DCM-ACO implementation
│   ├── sudokuantsystem.*      # ACS implementation
│   ├── backtracksearch.*      # Backtracking + constraint propagation
│   ├── board.*                # Sudoku board representation
│   ├── colonyant.*            # Per-colony ant state
│   ├── constraintpropagation.*
│   └── arguments.h, sudokusolver.h, timer.h, valueset.h, ...
├── instances/                 # Sample puzzles
│   ├── 9x9/                   # 100 puzzles
│   ├── 16x16/                 # 100 puzzles
│   ├── 25x25/                 # 100 puzzles
│   └── F% (25x25)/            # 25x25 puzzles grouped by filled-cell percentage
├── vs2017/                    # Visual Studio project (Windows native build)
│   └── sudoku_ants.vcxproj
├── obj/                       # Object-file output (kept via .gitkeep)
├── build.bat                  # Native build via MSBuild (Windows)
├── build_wasm.bat             # Compile C++ -> WebAssembly (Windows)
├── build_wasm.sh              # Compile C++ -> WebAssembly (Linux / macOS)
├── Makefile                   # Native build via g++ (Linux / macOS / MinGW)
├── install_emscripten.ps1     # One-shot Emscripten SDK installer for Windows
├── .gitignore
├── LICENSE
└── README.md
```

## Algorithms (`--alg` flag)

| Value | Algorithm                                                                            |
| ----- | ------------------------------------------------------------------------------------ |
| `0`   | Single-colony Ant Colony System (ACS) — `SudokuAntSystem`                            |
| `1`   | Backtracking search with constraint propagation — `BacktrackSearch`                  |
| `2`   | Multi-colony DCM-ACO with cooperative-game pheromone fusion — `MultiColonyAntSystem` |

## Prerequisites

- **C++ toolchain** for the native build:
  - Windows: Visual Studio 2022 Build Tools (MSBuild + MSVC v143), or MinGW g++
  - Linux / macOS: g++ with `-std=c++0x` support (g++ 4.8+)
- **Emscripten SDK** (only if you want to rebuild the WebAssembly module)

## Building the native CLI

### Windows — MSBuild (recommended)

From any PowerShell or cmd prompt:

```powershell
.\build.bat
```

This calls MSBuild on `vs2017\sudoku_ants.vcxproj` for `Release|x64`. The expected output is:

```
vs2017\x64\Release\sudoku_ants.exe
```

If `build.bat` cannot find MSBuild, edit the path inside `build.bat` to match your Visual Studio install, or run from a Developer Command Prompt and invoke MSBuild manually:

```powershell
cmd /c '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 && msbuild .\vs2017\sudoku_ants.vcxproj /t:Build /p:Configuration=Release /p:Platform=x64'
```

### Linux / macOS / MinGW — Make

```bash
make
```

Output: `./sudokusolver` (object files land in `obj/`).

To clean:

```bash
make clean
```

## Running the native CLI

Examples (Windows paths shown; on Linux/macOS replace `.\vs2017\x64\Release\sudoku_ants.exe` with `./sudokusolver`):

```powershell
# Single-colony ACS on a 9x9 puzzle, verbose with initial grid
.\vs2017\x64\Release\sudoku_ants.exe --alg 0 --file instances\9x9\2020_00004.txt --showinitial --verbose

# Multi-colony DCM-ACO on a 25x25 puzzle, 2-minute timeout
.\vs2017\x64\Release\sudoku_ants.exe --alg 2 --file instances\25x25\inst25x25_40_10.txt --showinitial --verbose --timeout 120

# Backtracking search
.\vs2017\x64\Release\sudoku_ants.exe --alg 1 --file instances\16x16\16x16_02203.txt --verbose
```

### CLI parameters

| Flag                 | Default                            | Meaning                                          |
| -------------------- | ---------------------------------- | ------------------------------------------------ |
| `--file <path>`      | —                                  | Instance file to load                            |
| `--puzzle <string>`  | —                                  | One-line puzzle string (alternative to `--file`) |
| `--alg <0\|1\|2>`    | `0`                                | 0 = ACS, 1 = Backtracking, 2 = DCM-ACO           |
| `--timeout <secs>`   | `10`                               | Wall-clock cutoff                                |
| `--nAnts <n>`        | `10` (alg 0) / `3` (alg 2)         | Ants (per colony for alg 2)                      |
| `--q0 <0..1>`        | `0.9`                              | ACS exploitation probability                     |
| `--rho <0..1>`       | `0.9`                              | Pheromone evaporation rate                       |
| `--evap <float>`     | `0.005` (alg 0) / `0.0125` (alg 2) | Best-solution evaporation                        |
| `--xi <float>`       | `0.1`                              | Local pheromone-update rate                      |
| `--numACS <n>`       | `6`                                | Number of ACS colonies (alg 2)                   |
| `--numColonies <n>`  | `numACS + 1`                       | Total colonies (alg 2)                           |
| `--convThresh`       | `0.8`                              | Convergence threshold (alg 2)                    |
| `--entropythreshold` | derived from `nAnts`               | Pheromone-fusion entropy threshold (alg 2)       |
| `--showinitial`      | off                                | Print the constraint-propagated initial grid     |
| `--verbose`          | off                                | Human-readable output (vs. machine-parseable)    |

## Instance file format

Each puzzle is whitespace-separated integers:

```
3          # order (3 for 9x9, 4 for 16x16, 5 for 25x25)
4          # secondary header value (read but unused by the solver)
-1 -1 -1 -1 -1 -1 -1  3  9    # one row per line, tab- or space-separated
...
```

- `-1` for empty cells
- `1`..`N²` for filled cells (where `N²` is the puzzle side length)

Sample puzzles are bundled under [instances/9x9/](instances/9x9), [instances/16x16/](instances/16x16) and [instances/25x25/](instances/25x25) (100 each), plus a larger sweep grouped by filled-cell percentage in [instances/F% (25x25)/](<instances/F%25 (25x25)>).

## Rebuilding the WebAssembly module

This is what the deployed frontend consumes. You only need to rebuild when you modify any C++ file.

### 1. Install Emscripten

**Windows** (one-time):

```powershell
powershell -ExecutionPolicy Bypass -File install_emscripten.ps1
```

This installs the SDK under `C:\emsdk\`. `build_wasm.bat` sources `C:\emsdk\emsdk_env.bat` automatically.

**Linux / macOS**: follow the [official Emscripten instructions](https://emscripten.org/docs/getting_started/downloads.html) and ensure `emcc` is on your `PATH`.

### 2. Compile

**Windows**:

```powershell
.\build_wasm.bat
```

Output goes to `client\src\wasm\sudoku_solver.{js,wasm}`.

**Linux / macOS**:

```bash
./build_wasm.sh
```

Output goes to `client/public/sudoku_solver.{js,wasm}`.

### 3. Drop into the deployed frontend repo

The build produces:
- `sudoku_solver.js` (glue code)
- `sudoku_solver.wasm` (binary)

Copy both into the deployed frontend repo at the following locations and commit:

- `client/wasm/sudoku_solver.js`
- `client/public/sudoku_solver.wasm`
- (`client/public/sudoku_solver.js` if your frontend loads from `public/`)

Vercel will pick the new binary up on the next deploy — no C++ toolchain is run on Vercel itself.

## Troubleshooting

- **`emcc: not found`** — install Emscripten (`install_emscripten.ps1` on Windows) and re-open the shell so `emsdk_env` is loaded.
- **MSBuild can't find compilers** — run from a Developer Command Prompt or invoke `VsDevCmd.bat -arch=x64` first (see the build instructions above).
- **`build.bat` fails with "MSBuild.exe not found"** — confirm Visual Studio 2022 Build Tools are installed, or update the hard-coded path inside `build.bat` to match your install.
- **`make: g++: command not found`** — install a g++ toolchain (`build-essential` on Debian/Ubuntu, `xcode-select --install` on macOS, or MinGW on Windows).

## License

MIT — see [LICENSE](LICENSE).
