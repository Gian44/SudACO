#include "mainwindow.h"

#include <QPlainTextEdit>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QSpinBox>
#include <QDoubleSpinBox>
#include <QCheckBox>
#include <QFileDialog>
#include <QFile>
#include <QVBoxLayout>
#include <QGridLayout>
#include <QtConcurrent>
#include <QFutureWatcher>
#include "../src/solver_api.h"

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    auto *central = new QWidget(this);
    setCentralWidget(central);

    // Top row: file picker + paste puzzle
    fileEdit  = new QLineEdit;
    openFile  = new QPushButton("Open...");
    connect(openFile, &QPushButton::clicked, this, &MainWindow::on_openFile_clicked);

    puzzleEdit = new QPlainTextEdit;
    puzzleEdit->setPlaceholderText("Paste puzzle (one-line, '.' for blanks) or choose a file...");

    // Params
    algCombo = new QComboBox;                      // 0=ACS, 2=Multi, else Backtrack
    algCombo->addItems({"ACS (0)", "Multi-colony (2)", "Backtrack (other)"});

    timeoutSpin  = new QSpinBox;  timeoutSpin->setRange(1, 3600); timeoutSpin->setValue(10);
    nAntsSpin    = new QSpinBox;  nAntsSpin->setRange(1, 10000);  nAntsSpin->setValue(12);
    coloniesSpin = new QSpinBox;  coloniesSpin->setRange(1, 1024); coloniesSpin->setValue(3);
    migrateSpin  = new QSpinBox;  migrateSpin->setRange(0, 100000); migrateSpin->setValue(10);

    mixDouble = new QDoubleSpinBox; mixDouble->setRange(0.0,1.0); mixDouble->setSingleStep(0.05); mixDouble->setValue(0.2);
    q0Double  = new QDoubleSpinBox; q0Double->setRange(0.0,1.0);  q0Double->setValue(0.9);
    rhoDouble = new QDoubleSpinBox; rhoDouble->setRange(0.0,1.0); rhoDouble->setValue(0.9);
    evapDouble= new QDoubleSpinBox; evapDouble->setRange(0.0,1.0); evapDouble->setDecimals(4); evapDouble->setValue(0.005);

    showInitCheck = new QCheckBox("Show initial constrained grid");

    // Solve + output
    solveBtn = new QPushButton("Solve");
    connect(solveBtn, &QPushButton::clicked, this, &MainWindow::on_solve_clicked);

    output = new QPlainTextEdit; output->setReadOnly(true);

    // Layouts
    auto *topGrid = new QGridLayout;
    topGrid->addWidget(new QLabel("Puzzle file:"), 0,0);
    topGrid->addWidget(fileEdit, 0,1);
    topGrid->addWidget(openFile, 0,2);

    topGrid->addWidget(new QLabel("Algorithm:"), 1,0);
    topGrid->addWidget(algCombo, 1,1);

    topGrid->addWidget(new QLabel("Timeout (s):"), 2,0);
    topGrid->addWidget(timeoutSpin, 2,1);

    topGrid->addWidget(new QLabel("nAnts:"), 3,0);
    topGrid->addWidget(nAntsSpin, 3,1);

    topGrid->addWidget(new QLabel("Colonies:"), 4,0);
    topGrid->addWidget(coloniesSpin, 4,1);

    topGrid->addWidget(new QLabel("Migrate:"), 5,0);
    topGrid->addWidget(migrateSpin, 5,1);

    topGrid->addWidget(new QLabel("mix:"), 6,0);
    topGrid->addWidget(mixDouble, 6,1);

    topGrid->addWidget(new QLabel("q0:"), 7,0);
    topGrid->addWidget(q0Double, 7,1);

    topGrid->addWidget(new QLabel("rho:"), 8,0);
    topGrid->addWidget(rhoDouble, 8,1);

    topGrid->addWidget(new QLabel("evap:"), 9,0);
    topGrid->addWidget(evapDouble, 9,1);

    auto *mainLayout = new QVBoxLayout;
    mainLayout->addLayout(topGrid);
    mainLayout->addWidget(showInitCheck);
    mainLayout->addWidget(new QLabel("Puzzle (text):"));
    mainLayout->addWidget(puzzleEdit, 1);
    mainLayout->addWidget(solveBtn);
    mainLayout->addWidget(new QLabel("Output:"));
    mainLayout->addWidget(output, 2);

    central->setLayout(mainLayout);
    resize(900, 700);
    setWindowTitle("Sudoku ACO GUI");
}

QString MainWindow::readFileToString(const QString& path) {
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly | QIODevice::Text)) return {};
    return QString::fromUtf8(f.readAll()).trimmed();
}

void MainWindow::on_openFile_clicked() {
    const QString path = QFileDialog::getOpenFileName(this, "Open puzzle file");
    if (!path.isEmpty()) fileEdit->setText(path);
}

void MainWindow::on_solve_clicked() {
    QString puzzle = puzzleEdit->toPlainText().trimmed();
    if (puzzle.isEmpty() && !fileEdit->text().isEmpty()) {
        puzzle = readFileToString(fileEdit->text());
    }
    if (puzzle.isEmpty()) {
        output->setPlainText("Please paste a puzzle or choose a file.");
        return;
    }

    SolverParams p;
    const int algIndex = algCombo->currentIndex();
    p.alg = (algIndex == 0 ? 0 : (algIndex == 1 ? 2 : 99));
    p.timeout  = timeoutSpin->value();
    p.nAnts    = nAntsSpin->value();
    p.colonies = coloniesSpin->value();
    p.migrate  = migrateSpin->value();
    p.mix      = (float)mixDouble->value();
    p.q0       = (float)q0Double->value();
    p.rho      = (float)rhoDouble->value();
    p.evap     = (float)evapDouble->value();
    p.showInitial = showInitCheck->isChecked();

    output->setPlainText("Solving...");
    solveBtn->setEnabled(false);

    auto fut = QtConcurrent::run([p, s = puzzle.toStdString()]() {
        return SolveSudoku(s, p);
    });
    auto *watcher = new QFutureWatcher<SolverResult>(this);
    connect(watcher, &QFutureWatcher<SolverResult>::finished, this, [this, watcher]() {
        auto R = watcher->result();
        watcher->deleteLater();
        solveBtn->setEnabled(true);

        if (!R.error.empty()) {
            output->setPlainText(QString("Error: %1").arg(QString::fromStdString(R.error)));
            return;
        }
        if (!R.success) {
            output->setPlainText(QString("Failed in time %1 s").arg(R.timeSec));
            return;
        }
        output->setPlainText(
            QString("Solution:\n%1\nSolved in %2 s")
                .arg(QString::fromStdString(R.solvedPretty))
                .arg(R.timeSec)
        );
    });
    watcher->setFuture(fut);
}
