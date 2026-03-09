#pragma once
#include "board.h"

#ifdef __EMSCRIPTEN__
#include <functional>
#include <string>
#endif

// pure virtual interface shared between backtrack search and sudoku ant system
class SudokuSolver
{
public:
	virtual bool Solve(const Board& puzzle, float maxTime) = 0;
	virtual float GetSolutionTime() = 0;
	virtual const Board& GetSolution() = 0;
	virtual int GetIterationCount() = 0;

#ifdef __EMSCRIPTEN__
	using ProgressCallback = std::function<void(int iter, int bestVal, int totalCells, const std::string& boardStr)>;
	void SetProgressCallback(ProgressCallback cb) { progressCallback_ = cb; }
	void SetProgressInterval(int n) { progressInterval_ = n; }
protected:
	ProgressCallback progressCallback_;
	int progressInterval_ = 5;
#endif
};
