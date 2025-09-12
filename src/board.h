#pragma once
#include "valueset.h"
#include <string>
#include <vector>
using namespace std;

class Board
{
public:
	// sudoku board
	Board(){};
	Board(const string &puzzleString);
        Board(const Board &other);
        ~Board();

        string AsString(bool useNmbers=false, bool showUnfixed = false);
        // Return one-line puzzle representation using '.' for unfixed cells
        // and digits/letters for fixed values.
        string ToPuzzleString() const;
        int FixedCellCount(void) const;
	int InfeasibleCellCount(void) const;
	void SetCell(int i, const ValueSet &c );
	const ValueSet &GetCell(int i) const;

	int GetNumUnits() const;
	void Copy(const Board &other);
	int CellCount(void) const;
	bool CheckSolution(const Board& other) const;
	// helpers
	int RowCell(int iRow, int iCell) const;
	int ColCell(int iCol, int iCell) const;
	int BoxCell(int iBox, int iCell) const;
	int RowForCell(int iCell) const;
	int ColForCell(int iCell) const;
	int BoxForCell(int iCell) const;


private:
	ValueSet *cells = nullptr;

	int order;   // order of puzzle
	int numUnits; // number of units (rows, columns, blocks)
	int numCells; // numer of cells
	int numFixedCells; // number of cells with uniquely determined value
	int numInfeasible; // number of cells with no possibilities.
	void Eliminate(int i, const ValueSet &c );
	void Eliminate2(int i, const ValueSet &c );
	void ConstrainCell(int i );
};

