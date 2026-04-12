import React, { useState, useMemo } from 'react';
import { getTodayISOString, isDailyCompleted } from '../utils/dailyPuzzleService';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Daily puzzle calendar - month view with clickable days
 * @param {Object} props
 * @param {Array<{date: string, dateDisplay?: string, size?: number, difficulty?: string}>} props.puzzles - List of puzzles with date (YYYY-MM-DD)
 * @param {Function} props.onDateSelect - (dateISO: string) => void
 * @param {string|null} props.selectedDateISO - currently selected date
 * @param {boolean} props.isLoading
 */
const DailyCalendar = ({ puzzles = [], onDateSelect, selectedDateISO = null, isLoading = false }) => {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = getTodayISOString().split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const todayISO = getTodayISOString();
  const [todayYear, todayMonth, todayDay] = todayISO.split('-').map(Number);

  // Dates for which we actually have a stored/generated daily puzzle
  const puzzleDates = useMemo(() => {
    const set = new Set();
    (puzzles || []).forEach(p => {
      if (p && p.date) set.add(p.date);
    });
    return set;
  }, [puzzles]);

  const { weeks, monthName, year } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();

    const days = [];
    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    while (weeks[weeks.length - 1]?.length < 7) {
      weeks[weeks.length - 1].push(null);
    }

    return {
      weeks,
      monthName: new Date(year, month).toLocaleDateString('en-US', { month: 'long' }),
      year
    };
  }, [viewDate]);

  const getDateISO = (day) => {
    if (!day) return null;
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${viewDate.getFullYear()}-${m}-${d}`;
  };

  const isFuture = (day) => {
    if (!day) return false;
    const dateISO = getDateISO(day);
    return dateISO > todayISO;
  };

  const isToday = (day) => {
    if (!day) return false;
    return (
      viewDate.getFullYear() === todayYear &&
      viewDate.getMonth() === todayMonth - 1 &&
      day === todayDay
    );
  };

  const handlePrevMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const canGoNext = () => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    return nextISO <= todayISO;
  };

  return (
    <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2 sm:py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
          {monthName} {year}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          disabled={!canGoNext()}
          className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px bg-[var(--color-border)]">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="bg-[var(--color-bg-elevated)] py-1 text-center text-xs font-medium text-[var(--color-text-muted)]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--color-border)]">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            const dateISO = getDateISO(day);
            const future = isFuture(day);
            const today = isToday(day);
            const inRange = day && !future;
            const hasPuzzle = inRange && dateISO && puzzleDates.has(dateISO);
            const completed = hasPuzzle && isDailyCompleted(dateISO);
            const selected = hasPuzzle && selectedDateISO === dateISO;

            return (
              <button
                key={`${wi}-${di}-${day ?? 'e'}`}
                type="button"
                onClick={() => hasPuzzle && onDateSelect?.(dateISO)}
                disabled={!hasPuzzle}
                aria-pressed={selected}
                className={`
                  min-h-[36px] sm:min-h-[40px] flex flex-col items-center justify-center
                  text-sm font-medium transition-colors
                  ${!day ? 'bg-[var(--color-bg-secondary)]' : ''}
                  ${day && future ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed' : ''}
                  ${day && inRange && !hasPuzzle ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]' : ''}
                  ${day && inRange && hasPuzzle ? 'bg-[var(--color-bg-elevated)] hover:bg-[var(--color-primary)]/20 cursor-pointer' : ''}
                  ${today ? 'ring-1 ring-[var(--color-primary)] ring-inset' : ''}
                  ${selected ? 'ring-2 ring-[var(--color-secondary)] ring-inset' : ''}
                  ${isLoading && hasPuzzle ? 'cursor-wait' : ''}
                `}
              >
                {day || ''}
                {day && hasPuzzle && (
                  <span className="mt-0.5">
                    {completed ? (
                      <svg className="w-3.5 h-3.5 text-[var(--color-success)] mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[var(--color-primary)] mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 px-2 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)]">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Completed
        </span>
      </div>
    </div>
  );
};

export default DailyCalendar;
