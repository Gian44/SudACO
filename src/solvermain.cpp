#include "board.h"
#include "arguments.h"
#include "solver_api.h"   // <-- NEW: the GUI/CLI-friendly API
#include <iostream>
#include <fstream>
#include <string>
using namespace std;

static string ReadFile(string fileName) {
    char *puzString;
    ifstream inFile;
    inFile.open(fileName);
    if (inFile.is_open())
    {
        int order, idum;
        inFile >> order;
        int numCells = order*order*order*order;
        inFile >> idum;
        puzString = new char[numCells+1];
        for (int i = 0; i < numCells; i++)
        {
            int val;
            inFile >> val;
            if (val == -1)
                puzString[i] = '.';
            else if (order == 3)
                puzString[i] = '1' + (val - 1);
            else if (order == 4)
                if (val < 11)
                    puzString[i] = '0' + val - 1;
                else
                    puzString[i] = 'a' + val - 11;
            else
                puzString[i] = 'a' + val - 1;
        }
        puzString[numCells] = 0;
        inFile.close();
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

int main(int argc, char* argv[])
{
    // Same CLI UX as before: prints success/fail + time (non-verbose) OR human output (verbose)
    Arguments a(argc, argv);

    // Build puzzle string (blank/order OR puzzle/file) exactly as before
    string puzzleString;
    if (a.GetArg("blank", 0) && a.GetArg("order", 0)) {
        int order = a.GetArg("order", 0);
        if (order != 0)
            puzzleString = string(order*order*order*order, '.');
    } else {
        puzzleString = a.GetArg(string("puzzle"), string());
        if (puzzleString.empty()) {
            string fileName = a.GetArg(string("file"), string());
            puzzleString = ReadFile(fileName);
        }
        if (puzzleString.empty()) {
            cerr << "no puzzle specified" << endl;
            return 0;
        }
    }

    // Parse flags -> SolverParams (defaults mirror your previous main)
    SolverParams p;
    p.alg      = a.GetArg("alg", 0);
    p.timeout  = a.GetArg("timeout", 10);

    // Algorithm-specific defaults: alg=2 (multi-colony) => 4 ants/colony, 3 colonies; else 12 ants, 1 colony
    {
        int nAntsDefault    = (p.alg == 2 ? 4 : 12);
        int coloniesDefault = (p.alg == 2 ? 3 : 1);
        // Support both --nAnts and legacy --ants
        p.nAnts     = a.GetArg("nAnts", a.GetArg("ants", nAntsDefault));
        p.colonies  = a.GetArg("colonies", coloniesDefault);
    }

    p.q0       = a.GetArg("q0",   0.9f);
    p.rho      = a.GetArg("rho",  0.9f);
    p.evap     = a.GetArg("evap", 0.005f);
    p.migrate  = a.GetArg("migrate", 10);
    p.mix      = a.GetArg("mix", 0.2f);
    p.showInitial = a.GetArg("showinitial", 0);
    bool verbose = a.GetArg("verbose", 0);

    // Optional: show initial constrained grid (unchanged behavior)
    if (p.showInitial) {
        Board board(puzzleString);
        cout << "Initial constrained grid" << endl;
        cout << board.AsString(false, true) << endl;
    }

    // Solve via API
    auto R = SolveSudoku(puzzleString, p);

    // Preserve exact output contract
    if (!verbose) {
        cout << !R.success << endl << R.timeSec << endl;
    } else {
        if (!R.success) {
            cout << "failed in time " << R.timeSec << endl;
            if (!R.error.empty()) cout << "Error: " << R.error << endl;
        } else {
            cout << "Solution:" << endl;
            cout << R.solvedPretty << endl;
            cout << "solved in " << R.timeSec << endl;
        }
    }
    return 0;
}
