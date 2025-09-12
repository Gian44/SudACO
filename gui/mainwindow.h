#pragma once
#include <QMainWindow>

class QPlainTextEdit;
class QLineEdit;
class QPushButton;
class QComboBox;
class QSpinBox;
class QDoubleSpinBox;
class QCheckBox;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override = default;

private slots:
    void on_openFile_clicked();
    void on_solve_clicked();

private:
    QString readFileToString(const QString& path);

    // widgets
    QPlainTextEdit *puzzleEdit = nullptr;
    QLineEdit      *fileEdit   = nullptr;
    QPushButton    *openFile   = nullptr;
    QComboBox      *algCombo   = nullptr;
    QSpinBox       *timeoutSpin = nullptr;
    QSpinBox       *nAntsSpin   = nullptr;
    QSpinBox       *coloniesSpin = nullptr;
    QSpinBox       *migrateSpin  = nullptr;
    QDoubleSpinBox *mixDouble   = nullptr;
    QDoubleSpinBox *q0Double    = nullptr;
    QDoubleSpinBox *rhoDouble   = nullptr;
    QDoubleSpinBox *evapDouble  = nullptr;
    QCheckBox      *showInitCheck = nullptr;
    QPlainTextEdit *output      = nullptr;
    QPushButton    *solveBtn    = nullptr;
};
