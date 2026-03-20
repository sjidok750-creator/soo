import { useRef, useState } from 'react';
import type { CategoryConfig, CategoryKey, Expense } from '../types';
import { categorize } from '../utils/categorize';
import { getToday } from '../utils/format';
import ReceiptScanner from './ReceiptScanner';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface ExpenseFormProps {
  categories: CategoryConfig[];
  onAdd: (expense: Expense) => void;
  apiKey: string;
}

export default function ExpenseForm({ categories, onAdd, apiKey }: ExpenseFormProps) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getToday());
  const [category, setCategory] = useState<CategoryKey | ''>('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanImage, setScanImage] = useState<{ base64: string; url: string; mediaType: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const autoCategory = merchant ? categorize(merchant, categories) : null;
  const finalCategory = category || autoCategory || 'other';

  const handleAdd = () => {
    if (!merchant.trim() || !amount || Number(amount) <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      merchant: merchant.trim(),
      amount: Number(amount),
      date,
      category: finalCategory,
      manualCategory: category !== '',
    });
    setMerchant('');
    setAmount('');
    setDate(getToday());
    setCategory('');
  };

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setScanImage({ base64: result.split(',')[1], url, mediaType: file.type || 'image/jpeg' });
      setScannerOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const base = 'w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none';
  const iStyle = { borderColor: '#E5E8EB', fontFamily: FONT, color: CORAL };
  const lStyle = { fontFamily: FONT, color: CORAL, fontSize: '0.7rem' };

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
        {/* Row 1: Date + Amount */}
        <div>
          <label className="block mb-0.5" style={lStyle}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={base}
            style={{ ...iStyle, boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label className="block mb-0.5" style={lStyle}>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            placeholder="0"
            className={`${base} text-right`}
            style={iStyle}
          />
        </div>
        {/* Row 2: Merchant + Category */}
        <div>
          <label className="block mb-0.5" style={lStyle}>Merchant</label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Vendor name"
            className={base}
            style={iStyle}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div>
          <label className="block mb-0.5" style={lStyle}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey | '')}
            className={base}
            style={iStyle}
          >
            <option value="">Auto</option>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Buttons: same flex-1, slim */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleAdd}
          disabled={!merchant.trim() || !amount || Number(amount) <= 0}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{
            fontFamily: FONT,
            backgroundColor:
              !merchant.trim() || !amount || Number(amount) <= 0 ? '#FBCAB8' : CORAL,
          }}
        >
          Add
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium border"
          style={{ fontFamily: FONT, color: CORAL, borderColor: CORAL, backgroundColor: 'transparent' }}
        >
          Scan Receipt
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleScanFile} className="hidden" />
      </div>

      {scannerOpen && scanImage && (
        <ReceiptScanner
          categories={categories}
          onAdd={onAdd}
          onClose={() => { setScannerOpen(false); setScanImage(null); }}
          initialImage={scanImage}
          apiKey={apiKey}
        />
      )}
    </div>
  );
}
