/*******************************************************************************
 * CONSTRAINT PROPAGATION - Implementation
 * Reduces search space before and during ACO (Rule 1: elimination, Rule 2: hidden single).
 ******************************************************************************/

#include "constraintpropagation.h"
#include "board.h"
#include <chrono>
#include <atomic>

static void AtomicAddFloat(std::atomic<float>& target, float value)
{
	float current = target.load();
	while (!target.compare_exchange_weak(current, current + value));
}

static std::atomic<float> g_initialCPTime{0.0f};
static std::atomic<float> g_antCPTime{0.0f};
static std::atomic<int> g_cpCallCount{0};
static bool g_inInitialCP = false;

void ResetCPTiming()
{
	g_initialCPTime.store(0.0f);
	g_antCPTime.store(0.0f);
	g_cpCallCount.store(0);
	g_inInitialCP = false;
}

float GetInitialCPTime() { return g_initialCPTime.load(); }
float GetAntCPTime() { return g_antCPTime.load(); }
int GetCPCallCount() { return g_cpCallCount.load(); }
void BeginInitialCP() { g_inInitialCP = true; }
void EndInitialCP() { g_inInitialCP = false; }

static void AddCPTime(float elapsed)
{
	if (g_inInitialCP)
		AtomicAddFloat(g_initialCPTime, elapsed);
	else
		AtomicAddFloat(g_antCPTime, elapsed);
}

bool Rule1_Elimination(Board& board, int cellIndex)
{
	auto startTime = std::chrono::high_resolution_clock::now();
	const ValueSet& cell = board.GetCell(cellIndex);

	if (cell.Empty() || cell.Fixed())
	{
		auto endTime = std::chrono::high_resolution_clock::now();
		AddCPTime(std::chrono::duration<float>(endTime - startTime).count());
		return false;
	}

	int numUnits = board.GetNumUnits();
	int iBox = board.BoxForCell(cellIndex);
	int iCol = board.ColForCell(cellIndex);
	int iRow = board.RowForCell(cellIndex);

	ValueSet colFixed(numUnits), rowFixed(numUnits), boxFixed(numUnits);
	for (int j = 0; j < numUnits; j++)
	{
		int k = board.BoxCell(iBox, j);
		if (k != cellIndex && board.GetCell(k).Fixed())
			boxFixed += board.GetCell(k);
		k = board.ColCell(iCol, j);
		if (k != cellIndex && board.GetCell(k).Fixed())
			colFixed += board.GetCell(k);
		k = board.RowCell(iRow, j);
		if (k != cellIndex && board.GetCell(k).Fixed())
			rowFixed += board.GetCell(k);
	}

	ValueSet fixedCellsConstraint = ~(rowFixed + colFixed + boxFixed);

	auto endTime = std::chrono::high_resolution_clock::now();
	AddCPTime(std::chrono::duration<float>(endTime - startTime).count());

	if (fixedCellsConstraint.Fixed())
	{
		SetCellAndPropagate(board, cellIndex, fixedCellsConstraint);
		return true;
	}
	board.SetCellDirect(cellIndex, board.GetCell(cellIndex) ^ fixedCellsConstraint);
	return false;
}

bool Rule2_HiddenSingle(Board& board, int cellIndex)
{
	auto startTime = std::chrono::high_resolution_clock::now();
	const ValueSet& cell = board.GetCell(cellIndex);

	if (cell.Empty() || cell.Fixed())
	{
		auto endTime = std::chrono::high_resolution_clock::now();
		AddCPTime(std::chrono::duration<float>(endTime - startTime).count());
		return false;
	}

	int numUnits = board.GetNumUnits();
	int iBox = board.BoxForCell(cellIndex);
	int iCol = board.ColForCell(cellIndex);
	int iRow = board.RowForCell(cellIndex);

	ValueSet colAll(numUnits), rowAll(numUnits), boxAll(numUnits);
	for (int j = 0; j < numUnits; j++)
	{
		int k = board.BoxCell(iBox, j);
		if (k != cellIndex) boxAll += board.GetCell(k);
		k = board.ColCell(iCol, j);
		if (k != cellIndex) colAll += board.GetCell(k);
		k = board.RowCell(iRow, j);
		if (k != cellIndex) rowAll += board.GetCell(k);
	}

	auto endTime = std::chrono::high_resolution_clock::now();
	AddCPTime(std::chrono::duration<float>(endTime - startTime).count());

	if ((cell - rowAll).Fixed())
	{
		SetCellAndPropagate(board, cellIndex, cell - rowAll);
		return true;
	}
	if ((cell - colAll).Fixed())
	{
		SetCellAndPropagate(board, cellIndex, cell - colAll);
		return true;
	}
	if ((cell - boxAll).Fixed())
	{
		SetCellAndPropagate(board, cellIndex, cell - boxAll);
		return true;
	}
	return false;
}

void PropagateConstraints(Board& board, int cellIndex)
{
	const ValueSet& cell = board.GetCell(cellIndex);
	if (cell.Empty() || cell.Fixed())
		return;
	if (Rule1_Elimination(board, cellIndex))
		return;
	Rule2_HiddenSingle(board, cellIndex);
	if (board.GetCell(cellIndex).Empty())
		board.IncrementInfeasible();
}

void SetCellAndPropagate(Board& board, int cellIndex, const ValueSet& value)
{
	if (board.GetCell(cellIndex).Fixed())
		return;
	board.SetCellDirect(cellIndex, value);
	board.IncrementFixedCells();
	if (!g_inInitialCP)
		g_cpCallCount.fetch_add(1);

	int numUnits = board.GetNumUnits();
	int iBox = board.BoxForCell(cellIndex);
	int iCol = board.ColForCell(cellIndex);
	int iRow = board.RowForCell(cellIndex);

	for (int j = 0; j < numUnits; j++)
	{
		int k = board.BoxCell(iBox, j);
		if (k != cellIndex) PropagateConstraints(board, k);
		k = board.ColCell(iCol, j);
		if (k != cellIndex) PropagateConstraints(board, k);
		k = board.RowCell(iRow, j);
		if (k != cellIndex) PropagateConstraints(board, k);
	}
}
