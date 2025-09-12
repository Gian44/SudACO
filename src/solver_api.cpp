#include "solver_api.h"
#include "board.h"
#include "sudokusolver.h"
#include "sudokuantsystem.h"
#include "multicolonyantsystem.h"
#include "backtracksearch.h"
#include <stdexcept>

SolverResult SolveSudoku(const std::string& puzzleString, const SolverParams& p) {
    SolverResult R;

    try {
        if (puzzleString.empty())
            throw std::runtime_error("Empty puzzle string.");

        Board board(puzzleString);

        const int nAntsDefault    = (p.alg == 2 ? 4 : 12);
        const int coloniesDefault = (p.alg == 2 ? 3 : 1);
        const int nAnts    = (p.nAnts    > 0 ? p.nAnts    : nAntsDefault);
        const int colonies = (p.colonies > 0 ? p.colonies : coloniesDefault);

        SudokuSolver* solver = nullptr;
        if (p.alg == 0) {
            solver = new SudokuAntSystem(nAnts, p.q0, p.rho, 1.0f/board.CellCount(), p.evap);
        } else if (p.alg == 2) {
            solver = new MultiColonyAntSystem(colonies, nAnts, p.q0, p.rho, 1.0f/board.CellCount(), p.evap,
                                              p.migrate, p.mix);
        } else {
            solver = new BacktrackSearch();
        }

        const bool ok = solver->Solve(board, (float)p.timeout);
        const float t = solver->GetSolutionTime();
        auto solution = solver->GetSolution();

        R.success = ok;
        R.timeSec = t;

        if (ok) {
            if (!board.CheckSolution(solution)) {
                R.success = false;
                R.error   = "Solution not valid.";
            } else {
                R.solvedPretty = solution.AsString(true);
            }
        }

        delete solver;
    } catch (const std::exception& ex) {
        R.success = false;
        R.error   = ex.what();
    } catch (...) {
        R.success = false;
        R.error   = "Unknown error.";
    }
    return R;
}
