#include "sudokuantsystem.h"
#include "sudokusolver.h"
#include "multicolonyantsystem.h"
#include "backtracksearch.h"
#include "board.h"
#include "arguments.h"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
using namespace std;

string ReadFile( string fileName )
{
	char *puzString;
	ifstream inFile;
	inFile.open(fileName);
	if ( inFile.is_open() )
	{
		int firstNumber, idum;
		inFile >> firstNumber;
		inFile >> idum;
		
		// Read all values into a vector first
		vector<int> values;
		int val;
		while (inFile >> val)
		{
			values.push_back(val);
		}
		inFile.close();
		
		// Determine format based on number of values
		int numUnits;
		bool isOldFormat = false;
		
		// Old format: firstNumber is order, has order^4 values
		// New format: firstNumber is size, has size^2 values
		if (values.size() == firstNumber * firstNumber * firstNumber * firstNumber)
		{
			// Old format (9x9, 16x16, 25x25): firstNumber is order
			isOldFormat = true;
			numUnits = firstNumber * firstNumber;
		}
		else if (values.size() == firstNumber * firstNumber)
		{
			// New format (6x6, 12x12): firstNumber is size
			isOldFormat = false;
			numUnits = firstNumber;
		}
		else
		{
			cerr << "Invalid file format: expected " << firstNumber * firstNumber 
			     << " or " << firstNumber * firstNumber * firstNumber * firstNumber 
			     << " values, got " << values.size() << endl;
			return string();
		}
		
		int numCells = numUnits * numUnits;
		puzString = new char[numCells+1];
		
		for (int i = 0; i < numCells; i++)
		{
			val = values[i];
			if (val == -1)
				puzString[i] = '.';
			else if (numUnits == 6)
				puzString[i] = '1' + (val - 1);  // 1-6 -> '1'-'6'
			else if (numUnits == 9)
				puzString[i] = '1' + (val - 1);  // 1-9 -> '1'-'9'
			else if (numUnits == 12)
			{
				if (val <= 10)
					puzString[i] = '0' + val - 1;  // 1-10 -> '0'-'9'
				else
					puzString[i] = 'a' + val - 11;  // 11-12 -> 'a'-'b'
			}
			else if (numUnits == 16)
			{
				if (val < 11)
					puzString[i] = '0' + val - 1;
				else
					puzString[i] = 'a' + val - 11;
			}
			else  // 25x25 and larger
				puzString[i] = 'a' + val - 1;
		}
		puzString[numCells] = 0;
		string retVal = string(puzString);
		delete [] puzString;
		return retVal;
	}
	else
	{
		cerr << "could not open file: " << fileName << endl;
		return string();
	}
}

int main( int argc, char *argv[] )
{
	// solve, then spit out 0 for success, 1 for fail, followed by time in seconds
	Arguments a( argc, argv );
	string puzzleString;
	if ( a.GetArg("blank", 0 ) && a.GetArg("order", 0 ))
	{
		int order = a.GetArg("order", 0 );
		if ( order != 0 )
			puzzleString = string(order*order*order*order,'.');
	}
	else 
	{
		// read in the puzzle from a one-line string
		puzzleString = a.GetArg(string("puzzle"),string());
		if ( puzzleString.length() == 0 )
		{
			// try from a file
			string fileName = a.GetArg(string("file"),string());
			puzzleString = ReadFile(fileName);
		}
		if ( puzzleString.length() == 0 )
		{
			cerr << "no puzzle specified" << endl;
			exit(0);
		}
	}
	Board board(puzzleString);

    int algorithm = a.GetArg("alg", 0);
    int timeOutSecs = a.GetArg("timeout", 10);
    // Algorithm-specific defaults:
    int nAntsDefault = (algorithm == 2 ? 4 : 10);
    int nAnts = a.GetArg("nAnts", a.GetArg("ants", nAntsDefault));
    float q0 = a.GetArg("q0", 0.9f);
    float rho = a.GetArg("rho", 0.9f);
    float evap = a.GetArg("evap", 0.005f );
    // DCM-ACO parameters:
    int numColonies = a.GetArg("numColonies", 3);
    int numACS = a.GetArg("numACS", 2);
    float convThresh  = a.GetArg("convThresh", 0.8f);
    float entropyThreshold = a.GetArg("entropyThreshold", 4.0f);
    bool blank = a.GetArg("blank", false );
    bool verbose = a.GetArg("verbose", 0);
    bool showInitial = a.GetArg("showinitial", 0);
    bool success;

	float solTime;
	Board solution;
    SudokuSolver *solver;
	
    if ( algorithm == 0 )
    {
        // Single-colony Ant Colony System
        solver = new SudokuAntSystem( nAnts, q0, rho, 1.0f/board.CellCount(), evap);
    }
    else if ( algorithm == 2 )
    {
        // Multi-colony ACO (ants count is per colony)
        solver = new MultiColonyAntSystem(nAnts, q0, rho, 1.0f/board.CellCount(), evap,
                                          numColonies, numACS, convThresh, entropyThreshold);
    }
    else
    {
        solver = new BacktrackSearch();
    }

	
	if ( showInitial )
	{
		// print inital grid
		cout << "Initial constrained grid" << endl;
		cout << board.AsString(false,true) << endl;
	}
	
	success = solver->Solve(board, (float)timeOutSecs );
	solution = solver->GetSolution();
	solTime = solver->GetSolutionTime();

	// sanity chack the solution:
	if ( success && !board.CheckSolution(solution) )
	{
		cout << "solution not valid" << a.GetArg("file",string()) << " " << algorithm << endl;
		cout << "numfixedCells " << solution.FixedCellCount() << endl;

		string outString = solution.AsString(true );
		cout << outString << endl;

		success = false;
	}
	if ( !verbose )
		cout << !success << endl << solTime << endl;
	else
	{
		if ( !success )
		{
			cout << "failed in time " << solTime << endl;
		}
		else
		{
			cout << "Solution:" << endl;
			string outString = solution.AsString( true );
			cout << outString << endl;
			cout << "solved in " << solTime << endl;
		}
	}
}
