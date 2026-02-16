#pragma once

/*******************************************************************************
 * CONSTRAINT PROPAGATION - Sudoku Logic Rules
 *
 * Implements constraint propagation to reduce the search space before ACO:
 * - Rule 1 (Elimination): Remove values fixed in same row/column/box; fix cell if one value remains.
 * - Rule 2 (Hidden Single): Fix cell when a value can only appear in that cell in a unit.
 *
 * Used during puzzle initialization and during ant solution construction.
 ******************************************************************************/

#include "board.h"
#include "valueset.h"

// Reset all CP timing statistics
void ResetCPTiming();

float GetInitialCPTime();
float GetAntCPTime();
int GetCPCallCount();

void BeginInitialCP();
void EndInitialCP();

bool Rule1_Elimination(Board& board, int cellIndex);
bool Rule2_HiddenSingle(Board& board, int cellIndex);
void PropagateConstraints(Board& board, int cellIndex);
void SetCellAndPropagate(Board& board, int cellIndex, const ValueSet& value);
