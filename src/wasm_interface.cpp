#include <emscripten/emscripten.h>
#include <string>
#include <cstring>
#include <sstream>
#include <iomanip>
#include <limits>
#include "board.h"
#include "sudokusolver.h"
#include "backtracksearch.h"
#include "sudokuantsystem.h"
#include "multicolonyantsystem.h"

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
    float timeout
) {
    try {
        // Create board from puzzle string
        Board board{std::string(puzzleString)};
        
        // Create solver based on algorithm type
        SudokuSolver* solver = nullptr;
        
        if (algorithm == 0) {
            // Ant Colony System (ACS) - single colony
            solver = new SudokuAntSystem(nAnts, q0, rho, 1.0f/board.CellCount(), evap);
        } else if (algorithm == 1) {
            // Backtracking search
            solver = new BacktrackSearch();
        } else if (algorithm == 2) {
            // Multi-Colony DCM-ACO
            solver = new MultiColonyAntSystem(
                nAnts, q0, rho, 1.0f/board.CellCount(), evap,
                numColonies, numACS, convThresh, entropyThresh
            );
        } else {
            // Default to backtracking
            solver = new BacktrackSearch();
        }
        
        // Solve the puzzle
        bool success = solver->Solve(board, timeout);
        Board solution = solver->GetSolution();
        float solTime = solver->GetSolutionTime();
        int iterations = solver->GetIterationCount();
        
        // Get solution as string (without formatting, just the grid)
        std::string solutionStr = solution.AsString(false, false);
        
        // Clean up newlines and extra spaces from the solution string
        std::string cleanSolution;
        for (char c : solutionStr) {
            if (c != '\n' && c != ' ' && c != '\t' && c != '|' && c != '-' && c != '+') {
                cleanSolution += c;
            }
        }
        
        // Build JSON response
        std::ostringstream jsonStream;
        // Use maximum precision for time to get exact values
        jsonStream << std::setprecision(std::numeric_limits<float>::max_digits10);
        jsonStream << "{";
        jsonStream << "\"success\":" << (success ? "true" : "false") << ",";
        jsonStream << "\"solution\":\"" << escapeJson(cleanSolution) << "\",";
        jsonStream << "\"time\":" << solTime << ",";
        jsonStream << "\"cellsFilled\":" << solution.FixedCellCount() << ",";
        jsonStream << "\"iterations\":" << iterations;
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

} // extern "C"

