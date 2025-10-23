# SudACO - WebAssembly Sudoku Solver

A web-based Sudoku solver implementing **Multi-Colony Ant Optimization with Dynamic Collaborative Mechanism and Cooperative Game (DCM-ACO)**. The solver runs entirely in the browser using WebAssembly, providing near-native performance without requiring a backend server.

## Features

- **Three Solving Algorithms**:
  - **Backtracking Search**: Classic constraint propagation with guaranteed solutions
  - **Ant Colony System (ACS)**: Single-colony metaheuristic approach
  - **Multi-Colony DCM-ACO**: Advanced multi-colony algorithm with dynamic collaboration

- **Multiple Puzzle Sizes**: Supports 9×9, 16×16, and 25×25 Sudoku puzzles
- **Instance File Support**: Load puzzles from the included instance files or upload your own
- **Real-time Solving**: Watch the solver work with live parameter adjustment
- **WebAssembly Performance**: Near-native C++ performance in the browser
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Quick Start

### Prerequisites

- **Node.js** (version 18+)
- **Emscripten SDK** (for WASM compilation)
- **Git** (for cloning the repository)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd SudACO
   ```

2. **Install Emscripten SDK** (if not already installed):
   ```bash
   # Run the installation script
   powershell -ExecutionPolicy Bypass -File install_emscripten.ps1
   
   # Or install manually:
   git clone https://github.com/emscripten-core/emsdk.git C:\emsdk
   cd C:\emsdk
   emsdk.bat install latest
   emsdk.bat activate latest
   ```

3. **Compile WebAssembly module**:
   ```bash
   .\build_wasm_simple.bat
   ```

4. **Install React dependencies**:
   ```bash
   cd client
   npm install
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser** and navigate to `http://localhost:5173`

## Build and Deployment

### Development Build

```bash
# Compile WASM (if not already done)
.\build_wasm_simple.bat

# Copy instance files and build React app
cd client
npm run build
```

### Production Deployment (Vercel)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add WebAssembly Sudoku solver"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Connect your GitHub repository to Vercel
   - Set the **Root Directory** to `client`
   - Deploy automatically

3. **Vercel Configuration**:
   - The `client/vercel.json` file is already configured for WASM support
   - No additional setup required

## Project Structure

```
SudACO/
├── src/                          # C++ source code
│   ├── wasm_interface.cpp       # WebAssembly interface
│   ├── multicolonyantsystem.cpp # DCM-ACO implementation
│   ├── sudokuantsystem.cpp      # ACS implementation
│   ├── backtracksearch.cpp      # Backtracking implementation
│   └── ...                      # Other solver components
├── client/                       # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── utils/               # Utility functions
│   │   └── App.jsx              # Main application
│   ├── public/
│   │   ├── instances/           # Puzzle instance files
│   │   ├── sudoku_solver.js     # Compiled WASM glue code
│   │   └── sudoku_solver.wasm   # Compiled WebAssembly binary
│   └── vercel.json              # Deployment configuration
├── instances/                    # Original puzzle files
│   ├── logic-solvable/           # 16 logic-solvable puzzles
│   └── general/                  # 6300 general puzzles
├── build_wasm_simple.bat        # WASM compilation script
└── install_emscripten.ps1       # Emscripten installation script
```

## Usage

### Loading Puzzles

1. **From Instance Files**:
   - Select a category (Logic-Solvable or General)
   - Choose a puzzle from the dropdown
   - Click "Load Puzzle"

2. **Upload Custom Puzzle**:
   - Click "Or upload your own"
   - Select a `.txt` file in the correct format
   - The puzzle will be loaded automatically

### File Format

Instance files should follow this format:
```
3                    # Order (3, 4, or 5)
1                    # Unused integer
-1 -1 7 -1 -1 9 -1 2 -1    # Tab-separated values per row
...                   # Continue for all rows
```

- Use `-1` for empty cells
- Use `1` to `N²` for filled cells (where N is the order)

### Algorithm Parameters

**Backtracking**:
- `timeout`: Maximum solving time in seconds

**Ant Colony System (ACS)**:
- `nAnts`: Number of ants (1-50)
- `q0`: Exploitation probability (0-1)
- `rho`: Evaporation rate (0-1)
- `evap`: Best solution evaporation (0-0.1)
- `timeout`: Maximum solving time

**Multi-Colony DCM-ACO**:
- `nAnts`: Ants per colony (1-20)
- `numColonies`: Total colonies (2-10)
- `numACS`: ACS colonies (1-5)
- `q0`: Exploitation probability (0-1)
- `rho`: Evaporation rate (0-1)
- `evap`: Best solution evaporation (0-0.1)
- `convThresh`: Convergence threshold (0-1)
- `entropyThresh`: Entropy threshold (0-10)
- `timeout`: Maximum solving time

## Technical Details

### WebAssembly Architecture

- **C++ Core**: All solving algorithms implemented in C++
- **WebAssembly Compilation**: Using Emscripten to compile to WASM
- **JavaScript Bridge**: Clean interface between React and WASM
- **Memory Management**: Proper allocation and cleanup of WASM memory

### Performance

- **Near-native Speed**: WebAssembly provides ~90% of native C++ performance
- **Client-side Processing**: No server required, all solving happens in browser
- **Memory Efficient**: Optimized memory usage for large puzzles

### Browser Compatibility

- **Modern Browsers**: Chrome 57+, Firefox 52+, Safari 11+, Edge 16+
- **WebAssembly Support**: Required for solver functionality
- **ES6 Modules**: Uses modern JavaScript features

## Troubleshooting

### Common Issues

1. **"Emscripten not found"**:
   - Run `install_emscripten.ps1` to install Emscripten SDK
   - Ensure `C:\emsdk\emsdk_env.bat` is accessible

2. **"WASM module failed to load"**:
   - Check that `sudoku_solver.js` and `sudoku_solver.wasm` exist in `client/public/`
   - Recompile with `.\build_wasm_simple.bat`

3. **"Instance files not found"**:
   - Run `npm run prebuild` to copy instance files
   - Check that `client/public/instances/index.json` exists

4. **Node.js version issues**:
   - Update to Node.js 18+ for best compatibility
   - The app will work with older versions but may show warnings

### Development Tips

- **Hot Reload**: React dev server supports hot reloading
- **WASM Debugging**: Use browser DevTools to debug WASM issues
- **Performance Profiling**: Use browser performance tools to analyze solver performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Emscripten**: For WebAssembly compilation tools
- **React**: For the frontend framework
- **Vite**: For fast development and building
- **Vercel**: For easy deployment hosting