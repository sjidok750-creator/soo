import { useRef } from 'react';
import type { CategoryConfig, Expense } from '../types';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface FileManagerCompactProps {
  expenses: Expense[];
  categories: CategoryConfig[];
  onImport: (expenses: Expense[], categories: CategoryConfig[]) => void;
  onClear: () => void;
}

export default function FileManagerCompact({ expenses, categories, onImport, onClear }: FileManagerCompactProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = [false, () => {}];

  const handleExport = () => {
    const data = JSON.stringify({ expenses, categories }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-expenses-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string) as {
          expenses: Expense[];
          categories: CategoryConfig[];
        };
        if (data.expenses && data.categories) {
          onImport(data.expenses, data.categories);
        }
      } catch {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="flex gap-2 flex-wrap"
      style={{ fontFamily: FONT }}
    >
      <button
        onClick={handleExport}
        className="py-1.5 px-3 rounded-lg text-xs border"
        style={{ color: CORAL, borderColor: CORAL }}
      >
        Export
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="py-1.5 px-3 rounded-lg text-xs border border-gray-200 text-gray-500"
      >
        Import
      </button>
      <button
        onClick={() => {
          if (window.confirm('Clear all expense data?')) onClear();
        }}
        className="py-1.5 px-3 rounded-lg text-xs border border-red-200 text-red-400"
      >
        Clear All
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
    </div>
  );
}
