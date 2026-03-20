import { useState } from 'react';
import type { CategoryConfig, Expense } from '../types';
import { formatAmount, formatMonth } from '../utils/format';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface ExpenseListProps {
  expenses: Expense[];
  month: string;
  onMonthChange: (month: string) => void;
  categories: CategoryConfig[];
  onUpdate: (id: string, updates: Partial<Expense>) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseList({
  expenses,
  month,
  onMonthChange,
  categories,
  onDelete,
}: ExpenseListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const getCat = (key: string) => categories.find((c) => c.key === key);

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    let pm = m - 1, py = y;
    if (pm <= 0) { pm = 12; py--; }
    onMonthChange(`${py}-${String(pm).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    let nm = m + 1, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    onMonthChange(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Month nav */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-100"
        style={{ fontFamily: FONT }}
      >
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 px-1">‹</button>
        <div className="text-center">
          <p className="text-xs font-medium" style={{ color: CORAL }}>{formatMonth(month)}</p>
          <p className="text-xs text-gray-400">{monthExpenses.length} items · {formatAmount(total)}</p>
        </div>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 px-1">›</button>
      </div>

      {/* List */}
      {monthExpenses.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6" style={{ fontFamily: FONT }}>
          No expenses this month
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {monthExpenses.map((e) => {
            const cat = getCat(e.category);
            return (
              <li key={e.id} className="flex items-center px-3 py-2 gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat?.color ?? '#94A3B8' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ fontFamily: FONT, color: '#374151' }}
                  >
                    {e.merchant}
                  </p>
                  <p className="text-xs text-gray-400" style={{ fontFamily: FONT }}>
                    {e.date} · {cat?.name ?? e.category}
                  </p>
                </div>
                <span
                  className="text-xs font-medium flex-shrink-0"
                  style={{ fontFamily: FONT, color: CORAL }}
                >
                  {formatAmount(e.amount)}
                </span>
                {confirmId === e.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { onDelete(e.id); setConfirmId(null); }}
                      className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white"
                      style={{ fontFamily: FONT }}
                    >
                      Del
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-500"
                      style={{ fontFamily: FONT }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(e.id)}
                    className="text-gray-300 hover:text-gray-500 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
