import type { CategoryConfig, CategoryKey, MonthlySummary } from '../types';
import { formatAmount, formatMonth } from '../utils/format';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface DashboardProps {
  month: string;
  onMonthChange: (month: string) => void;
  summary: MonthlySummary;
  barChartData: Array<{ month: string; total: number } & Record<CategoryKey, number>>;
  categories: CategoryConfig[];
}

export default function Dashboard({ month, onMonthChange, summary, categories }: DashboardProps) {
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

  const catEntries = categories
    .map((c) => ({ ...c, amount: summary.byCategory[c.key] ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3" style={{ fontFamily: FONT }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600">‹</button>
          <p className="text-sm font-medium" style={{ color: CORAL }}>{formatMonth(month)}</p>
          <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600">›</button>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: CORAL }}>{formatAmount(summary.total)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{summary.count} transactions</p>
        </div>
      </div>

      {/* Category breakdown */}
      {catEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3" style={{ fontFamily: FONT }}>
          <p className="text-xs font-medium mb-2" style={{ color: CORAL }}>By Category</p>
          <div className="space-y-2">
            {catEntries.map((cat) => {
              const pct = summary.total > 0 ? (cat.amount / summary.total) * 100 : 0;
              return (
                <div key={cat.key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: '#374151' }}>{cat.name}</span>
                    <span style={{ color: CORAL }}>{formatAmount(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {catEntries.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: FONT }}>
          No data for this month
        </p>
      )}
    </div>
  );
}
