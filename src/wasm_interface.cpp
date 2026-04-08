#include <emscripten/emscripten.h>
#include <string>
#include <cstring>
#include <sstream>
#include <iomanip>
#include <limits>
#include <cmath>
#include "board.h"
#include "sudokusolver.h"
#include "backtracksearch.h"
#include "sudokuantsystem.h"
#include "multicolonyantsystem.h"
#include "constraintpropagation.h"

// Helper function to escape JSON strings
std::string escapeJson(const std::string& str) {
    std::ostringstream o;
    for (auto c : str) {
        if (c == '"' || c == '\\') {
            o << '\\';
        }
        o << c;
    }
    return o.str();
}

static std::string toCompactSolutionString(const Board& board) {
    Board copy(board);
    std::string solutionStr = copy.AsString(false, false);
    std::string compact;
    compact.reserve(solutionStr.size());
    for (char c : solutionStr) {
        if (c != '\n' && c != ' ' && c != '\t' && c != '|' && c != '-' && c != '+') {
            compact += c;
        }
    }
    return compact;
}

static char* run_solver_json(
    const char* puzzleString,
    int algorithm,
    int nAnts,
    int numColonies,
    int numACS,
    float q0,
    float rho,
    float evap,
    float convThresh,
    float entropyThresh,
    float timeout,
    float xi,
    bool emitProgress
) {
    try {
        // Create board from puzzle string
        Board board{std::string(puzzleString)};

        // Mirror solvermain defaults/safety fallbacks when values are not sensible.
        if (algorithm == 2) {
            if (nAnts <= 0) {
                nAnts = 3;
            }
            if (numACS <= 0) {
                numACS = 6;
            }
            if (numColonies <= 0) {
                numColonies = numACS + 1;
            }
            if (evap <= 0.0f) {
                evap = 0.0125f;
            }
            if (convThresh <= 0.0f) {
                convThresh = 0.8f;
            }
            if (entropyThresh <= 0.0f) {
                const float entropyPctDefault = 92.5f;
                entropyThresh = static_cast<float>(
                    std::log2(static_cast<double>(nAnts)) * (entropyPctDefault / 100.0f)
                );
            }
        } else if (algorithm == 0) {
            if (nAnts <= 0) {
                nAnts = 10;
            }
            if (evap <= 0.0f) {
                evap = 0.005f;
            }
        }

        // Reset CP timing before solve (matches solvermain)
        ResetCPTiming();

        // Create solver based on algorithm type (match solvermain constructors)
        SudokuSolver* solver = nullptr;

        if (algorithm == 0) {
            // Ant Colony System (ACS) - single colony, with xi
            solver = new SudokuAntSystem(nAnts, q0, rho, 1.0f / board.CellCount(), evap, xi);
        } else if (algorithm == 1) {
            // Backtracking search
            solver = new BacktrackSearch();
        } else if (algorithm == 2) {
            // Multi-Colony DCM-ACO, with xi
            auto* mcas = new MultiColonyAntSystem(
                nAnts, q0, rho, 1.0f / board.CellCount(), evap,
                numColonies, numACS, convThresh, entropyThresh, xi
            );
            if (emitProgress) {
                mcas->SetProgressCallback([](int iteration, const Board& bestSol, int cellsFilled) {
                    std::string compactSolution = toCompactSolutionString(bestSol);
                    EM_ASM({
                        if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
                            self.postMessage({
                                type: 'progress',
                                payload: {
                                    iteration: $0,
                                    solution: UTF8ToString($1),
                                    cellsFilled: $2
                                }
                            });
                        }
                    }, iteration, compactSolution.c_str(), cellsFilled);
                });
            }
            solver = mcas;
        } else {
            // Default to backtracking
            solver = new BacktrackSearch();
        }

        // Solve the puzzle
        bool success = solver->Solve(board, timeout);
        Board solution = solver->GetSolution();
        float solTime = solver->GetSolutionTime();
        int iterations = solver->GetIterationCount();

        // Keep solvermain parity: if solved but invalid, treat as failure.
        if (success && !board.CheckSolution(solution)) {
            success = false;
        }

        // CP timing (matches solvermain: add initial CP to total time)
        float initialCPTime = GetInitialCPTime();
        float antCPTime = GetAntCPTime();
        int cpCallCount = GetCPCallCount();
        solTime += initialCPTime;

        std::string cleanSolution = toCompactSolutionString(solution);

        // Build JSON response (include timing fields to match solvermain output)
        std::ostringstream jsonStream;
        jsonStream << std::setprecision(std::numeric_limits<float>::max_digits10);
        jsonStream << "{";
        jsonStream << "\"success\":" << (success ? "true" : "false") << ",";
        jsonStream << "\"solution\":\"" << escapeJson(cleanSolution) << "\",";
        jsonStream << "\"time\":" << solTime << ",";
        jsonStream << "\"cellsFilled\":" << solution.FixedCellCount() << ",";
        jsonStream << "\"iterations\":" << iterations << ",";
        jsonStream << "\"cp_initial\":" << initialCPTime << ",";
        jsonStream << "\"cp_ant\":" << antCPTime << ",";
        jsonStream << "\"cp_calls\":" << cpCallCount << ",";
        jsonStream << "\"cp_total\":" << (initialCPTime + antCPTime);

        // DCM-ACO timing (algorithm 2 only, matches solvermain)
        if (algorithm == 2) {
            MultiColonyAntSystem* mcas = dynamic_cast<MultiColonyAntSystem*>(solver);
            if (mcas) {
                jsonStream << ",\"dcm_aco\":" << mcas->GetDCMAcoTime();
                jsonStream << ",\"cooperative_game\":" << mcas->GetCooperativeGameTime();
                jsonStream << ",\"pheromone_fusion\":" << mcas->GetPheromoneFusionTime();
                jsonStream << ",\"public_path\":" << mcas->GetPublicPathRecommendationTime();
            }
        }
        jsonStream << "}";

        std::string result = jsonStream.str();

        // Clean up solver
        delete solver;

        // Allocate memory for return string (caller must free)
        char* output = (char*)malloc(result.length() + 1);
        strcpy(output, result.c_str());
        return output;

    } catch (const std::exception& e) {
        // Return error as JSON
        std::string errorMsg = std::string("{\"success\":false,\"error\":\"") +
                              escapeJson(e.what()) + "\"}";
        char* output = (char*)malloc(errorMsg.length() + 1);
        strcpy(output, errorMsg.c_str());
        return output;
    } catch (...) {
        // Return generic error
        const char* errorMsg = "{\"success\":false,\"error\":\"Unknown error occurred\"}";
        char* output = (char*)malloc(strlen(errorMsg) + 1);
        strcpy(output, errorMsg);
        return output;
    }
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
char* solve_sudoku(
    const char* puzzleString,
    int algorithm,
    int nAnts,
    int numColonies,
    int numACS,
    float q0,
    float rho,
    float evap,
    float convThresh,
    float entropyThresh,
    float timeout,
    float xi
) {
    return run_solver_json(
        puzzleString, algorithm, nAnts, numColonies, numACS,
        q0, rho, evap, convThresh, entropyThresh, timeout, xi, false
    );
}

EMSCRIPTEN_KEEPALIVE
char* solve_sudoku_with_progress(
    const char* puzzleString,
    int algorithm,
    int nAnts,
    int numColonies,
    int numACS,
    float q0,
    float rho,
    float evap,
    float convThresh,
    float entropyThresh,
    float timeout,
    float xi
) {
    return run_solver_json(
        puzzleString, algorithm, nAnts, numColonies, numACS,
        q0, rho, evap, convThresh, entropyThresh, timeout, xi, true
    );
}

} // extern "C"

