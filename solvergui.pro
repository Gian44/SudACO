QT += widgets concurrent
CONFIG += c++17 release
TEMPLATE = app
TARGET = solvergui

INCLUDEPATH += $$PWD/src

DEFINES += NOMINMAX WIN32_LEAN_AND_MEAN

QMAKE_CXXFLAGS += /U_HAS_STD_BYTE
QMAKE_CFLAGS   += /U_HAS_STD_BYTE

SOURCES += \
    gui/main.cpp \
    gui/mainwindow.cpp \
    src/solver_api.cpp \
    src/backtracksearch.cpp \
    src/board.cpp \
    src/colonyant.cpp \
    src/multicolonyantsystem.cpp \
    src/sudokuant.cpp \
    src/sudokuantsystem.cpp

HEADERS += \
    gui/mainwindow.h \
    src/solver_api.h \
    src/backtracksearch.h \
    src/board.h \
    src/colonyant.h \
    src/multicolonyantsystem.h \
    src/sudokuant.h \
    src/sudokuantsystem.h \
    src/sudokusolver.h \
    src/arguments.h \
    src/timer.h \
    src/valueset.h
