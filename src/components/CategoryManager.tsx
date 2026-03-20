import { useState } from 'react';
import type { CategoryConfig } from '../types';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface CategoryManagerProps {
  categories: CategoryConfig[];
  onUpdate: (cats: CategoryConfig[]) => void;
  onReset: () => void;
}

export default function CategoryManager({ categories, onUpdate, onReset }: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366F1');

  const addCategory = () => {
    if (!newName.trim()) return;
    const key = newName.toLowerCase().replace(/\s+/g, '-');
    if (categories.some((c) => c.key === key)) return;
    onUpdate([...categories, { key, name: newName.trim(), color: newColor, keywords: [] }]);
    setNewName('');
  };

  const removeCategory = (key: string) => {
    if (categories.length <= 1) return;
    onUpdate(categories.filter((c) => c.key !== key));
  };

  const base = 'border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none';
  const iStyle = { borderColor: '#E5E8EB', fontFamily: FONT, color: CORAL };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-3">
      <p className="text-xs font-medium" style={{ fontFamily: FONT, color: CORAL }}>
        Categories
      </p>

      <div className="space-y-1.5">
        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="flex-1 text-xs" style={{ fontFamily: FONT, color: '#374151' }}>
              {cat.name}
            </span>
            <button
              onClick={() => removeCategory(cat.key)}
              className="text-gray-300 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category"
          className={`${base} flex-1`}
          style={iStyle}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-gray-200"
        />
        <button
          onClick={addCategory}
          className="py-1.5 px-3 rounded-lg text-xs font-medium text-white"
          style={{ fontFamily: FONT, backgroundColor: CORAL }}
        >
          Add
        </button>
      </div>

      <button
        onClick={onReset}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
        style={{ fontFamily: FONT }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
