#pragma once
#include <vector>
#include <random>
#include "board.h"
#include "timer.h"
#include "sudokusolver.h"
#include "colonyant.h"

class MultiColonyAntSystem : public SudokuSolver
{
    struct Colony
    {
        std::vector<ColonyAnt*> ants;
        float **pher;         // pheromone matrix [cell][value]
        int numCells;
        int valuesPerCell;
        Board bestSol;        // colony-best solution
        float bestPher;       // colony-best pheromone score
        int bestVal;          // colony-best number of cells filled
        // Max-Min parameters
        float tauMin;
        float tauMax;
        float tau0;
        int lastImproveIter;
        // colony type: ACS or MMAS (0 = ACS, 1 = MMAS)
        int type;
        Colony() : pher(nullptr), numCells(0), valuesPerCell(0), bestPher(0.0f), bestVal(0), tauMin(0.0f), tauMax(0.0f), tau0(0.0f), lastImproveIter(0) {}
    };

    int numColonies;
    int antsPerColony;
    float q0;
    float rho;
    float pher0;
    float bestEvap;

    // global best
    Board globalBestSol;
    float globalBestPher;
    int globalBestVal;

    // time / rng
    Timer solutionTimer;
    float solTime;
    std::mt19937 randGen;
    std::uniform_real_distribution<float> randomDist;

    std::vector<Colony> colonies;

    // per-colony heterogeneity (kept as in implementation)
    std::vector<float> colonyQ0;
    std::vector<float> colonyRho;

    // DCM-ACO thresholds
    float entropyFrac;    // fraction of max ACS entropy for fusion trigger
    float convThreshold;  // MMAS public-path convergence trigger

    // pheromone helpers
    void InitPheromone(Colony &c, int numCells, int valuesPerCell);
    void ClearPheromone(Colony &c);
    void UpdatePheromone(int colonyIdx, Colony &c, const Board &bestSol, float bestPher);
    float PherAdd(int numCells, int cellsFilled);
    void ClampPheromone(Colony &c);

    // helpers for new algorithm
    float ComputeEntropy(const Colony &c) const;
    void ACSCooperativeGameAllocate(std::vector<int> &acsIdx,
                                    std::vector<float> &allocatedBestPher);
    void ApplyPheromoneFusion(const std::vector<int> &acsIdx,
                              const std::vector<int> &mmasIdx);
    void ApplyPublicPathRecommendation(int iter,
                                       const std::vector<int> &acsIdx,
                                       const std::vector<int> &mmasIdx);

public:
    // Fixed to 3 colonies (2 ACS, 1 MMAS) as per the paper
    MultiColonyAntSystem(int antsPerColony, float q0, float rho, float pher0, float bestEvap,
                         float entropyFrac, float convThreshold)
        : numColonies(3), antsPerColony(antsPerColony), q0(q0), rho(rho), pher0(pher0), bestEvap(bestEvap),
          globalBestPher(0.0f), globalBestVal(0), solTime(0.0f),
          entropyFrac(entropyFrac), convThreshold(convThreshold)
    {
        colonies.resize(numColonies);
        randomDist = std::uniform_real_distribution<float>(0.0f, 1.0f);
        std::random_device rd;
        randGen = std::mt19937(rd());
    }

    ~MultiColonyAntSystem()
    {
        for (auto &c : colonies)
        {
            for (auto *a : c.ants) delete a;
            if (c.pher) ClearPheromone(c);
        }
    }

    // SudokuSolver interface
    virtual bool Solve(const Board &puzzle, float maxTime);
    virtual float GetSolutionTime() { return solTime; }
    virtual const Board &GetSolution() { return globalBestSol; }

    // helpers for ants
    inline float Getq0() { return q0; }
    inline float Getq0(int colony) { return (colony >= 0 && colony < (int)colonyQ0.size()) ? colonyQ0[colony] : q0; }
    inline float GetRho(int colony) { return (colony >= 0 && colony < (int)colonyRho.size()) ? colonyRho[colony] : rho; }
    inline float random() { return randomDist(randGen); }
    inline float Pher(int colony, int iCell, int iValue) { return colonies[colony].pher[iCell][iValue]; }
    void LocalPheromoneUpdate(int colony, int iCell, int iChoice)
    {
        // ACS local update only; MMAS does not use local updates
        if (colonies[colony].type == 0)
        {
            float &ref = colonies[colony].pher[iCell][iChoice];
            ref = ref * 0.9f + colonies[colony].tau0 * 0.1f;
        }
    }
};
