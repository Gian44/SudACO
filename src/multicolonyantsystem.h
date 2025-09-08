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
    int numACS;
    int numMMAS;
    int antsPerColony;
    float q0;
    float rho;
    float pher0;
    float bestEvap;

    // migration control
    int migrationInterval;   // unused in new algorithm (kept for CLI compatibility)
    float migrationRate;     // unused in new algorithm (kept for CLI compatibility)

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

    // per-colony heterogeneity
    std::vector<float> colonyQ0;
    std::vector<float> colonyRho;

    // dynamic collaborative mechanism parameters
    float entropyThreshold;   // E*(P) threshold for ACS fusion trigger
    float convThreshold;      // convergence threshold for MMAS public path trigger

    // pheromone helpers
    void InitPheromone(Colony &c, int numCells, int valuesPerCell);
    void ClearPheromone(Colony &c);
    void UpdatePheromone(int colonyIdx, Colony &c, const Board &bestSol, float bestPher);
    float PherAdd(int numCells, int cellsFilled);
    void ClampPheromone(Colony &c);

    // helpers for new algorithm
    void ComputeColonyParams(int colonyIdx, float baseQ0, float baseRho,
                             float &outQ0, float &outRho);
    float EntropyTriggerThreshold(float maxACSentropy) const;
    float ComputeEntropy(const Colony &c) const;
    void ACSCooperativeGameAllocate(std::vector<int> &acsIdx,
                                    std::vector<float> &allocatedBestPher);
    void ApplyPheromoneFusion(const std::vector<int> &acsIdx,
                              const std::vector<int> &mmasIdx);
    void ApplyPublicPathRecommendation(int iter,
                                       const std::vector<int> &acsIdx,
                                       const std::vector<int> &mmasIdx);

public:
    // New constructor allowing explicit colony mix {numACS,numMMAS}; defaults to 2 ACS + 1 MMAS
    MultiColonyAntSystem(int antsPerColony, float q0, float rho, float pher0,
                         float bestEvap, int migrationInterval, float migrationRate,
                         int numACS = 2, int numMMAS = 1);

    // Legacy constructor taking total number of colonies and splitting half ACS / half MMAS
    MultiColonyAntSystem(int numColonies, int antsPerColony, float q0, float rho,
                         float pher0, float bestEvap, int migrationInterval,
                         float migrationRate);

    ~MultiColonyAntSystem();

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

    // tunable thresholds
    void SetEntropyThreshold(float t) { entropyThreshold = t; }
    float GetEntropyThreshold() const { return entropyThreshold; }
    void SetConvergenceThreshold(float t) { convThreshold = t; }
    float GetConvergenceThreshold() const { return convThreshold; }
};
