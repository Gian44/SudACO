#pragma once
#include <string>

struct SolverParams {
    int alg = 0;          // 0 = ACS, 2 = Multi-colony, else Backtrack
    int timeout = 10;
    int nAnts = -1;       // -1 = use default per alg (4 if alg==2, else 12)
    int colonies = -1;    // -1 = use default per alg (3 if alg==2, else 1)
    int migrate = 10;
    float mix = 0.2f;
    float q0 = 0.9f;
    float rho = 0.9f;
    float evap = 0.005f;
    bool showInitial = false;
};

struct SolverResult {
    bool success = false;
    float timeSec = 0.f;
    std::string solvedPretty; // pretty grid if success
    std::string error;        // filled on exceptions/invalid solution
};

// Solve a flattened one-line puzzle ('.' for blanks)
SolverResult SolveSudoku(const std::string& puzzleString, const SolverParams& p);
