import { useRef, useState } from 'react';
import type { CategoryConfig, CategoryKey, Expense } from '../types';
import { categorize } from '../utils/categorize';
import { getToday } from '../utils/format';

interface ScanResult {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  memo: string | null;
  error?: string;
}

interface ReceiptScannerProps {
  categories: CategoryConfig[];
  onAdd: (expense: Expense) => void;
  onClose: () => void;
  initialImage: { base64: string; url: string; mediaType: string };
  apiKey: string;
}

export default function ReceiptScanner({ categories, onAdd, onClose, initialImage, apiKey }: ReceiptScannerProps) {
  const reSelectRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string>(initialImage.url);
  const [imageBase64, setImageBase64] = useState<string>(initialImage.base64);
  const [mediaType, setMediaType] = useState<string>(initialImage.mediaType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // 검토 폼 상태
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getToday());
  const [manualCategory, setManualCategory] = useState<CategoryKey | ''>('');
  const [memo, setMemo] = useState('');

  const autoCategory = merchant ? categorize(merchant, categories) : null;
  const finalCategory = manualCategory || autoCategory || '기타';
  const matchedConfig = categories.find((c) => c.key === finalCategory);

  function handleReSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setMediaType(file.type || 'image/jpeg');
    setError(null);
    setScanResult(null);
    setMerchant('');
    setAmount('');
    setDate(getToday());
    setMemo('');
    setManualCategory('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setImageBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!imageBase64) return;

    if (!apiKey) {
      setError('설정 탭에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    const today = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mediaType,
                      data: imageBase64,
                    },
                  },
                  {
                    text: `이 영수증 이미지를 분석해서 아래 JSON 형식으로만 답변하세요. 다른 텍스트는 절대 포함하지 마세요.\n\n{"merchant":"상호명","amount":최종결제금액숫자,"date":"YYYY-MM-DD","memo":"특이사항 또는 null"}\n\n오늘 날짜: ${today}\n날짜를 찾을 수 없으면 오늘 날짜를 사용하세요.\n금액은 총 결제 금액 기준으로 숫자만 반환하세요.`,
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 512 },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(errData.error?.message ?? '분석 실패');
      }

      const raw = await res.json() as {
        candidates: { content: { parts: { text: string }[] } }[];
      };
      const text = raw.candidates[0].content.parts[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('영수증을 인식하지 못했습니다.');

      const data = JSON.parse(jsonMatch[0]) as ScanResult;

      setScanResult(data);
      setMerchant(data.merchant ?? '');
      setAmount(data.amount != null ? String(data.amount) : '');
      setDate(data.date ?? getToday());
      setMemo(data.memo ?? '');
      setManualCategory('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '영수증 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!merchant.trim() || !amount || Number(amount) <= 0) return;

    const expense: Expense = {
      id: crypto.randomUUID(),
      merchant: merchant.trim(),
      amount: Number(amount),
      date,
      category: finalCategory,
      manualCategory: manualCategory !== '',
      memo: memo.trim() || undefined,
    };

    onAdd(expense);
    onClose();
  }

  const inputStyle = { borderColor: '#E5E8EB' };
  const inputClass = 'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[92vh] overflow-y-auto space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            영수증 스캔
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 다시 선택용 숨겨진 파일 입력 */}
        <input
          ref={reSelectRef}
          type="file"
          accept="image/*"
          onChange={handleReSelectFile}
          className="hidden"
        />

        {/* Step 1: 미리보기 + 분석 */}
        {!scanResult && (
          <div className="space-y-4">
            <img
              src={imageUrl}
              alt="영수증"
              className="w-full max-h-64 object-contain rounded-xl border border-gray-200"
            />

            {error && (
              <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => reSelectRef.current?.click()}
                className="flex-1 h-12 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                다시 선택
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-[2] h-12 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: loading ? '#93c5fd' : 'var(--toss-blue)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    분석 중...
                  </span>
                ) : (
                  '분석하기'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 검토 및 확인 */}
        {scanResult && (
          <div className="space-y-4">
            <img
              src={imageUrl}
              alt="영수증"
              className="w-full max-h-28 object-contain rounded-xl border border-gray-200"
            />

            <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2">
              ✓ 분석 완료 — 내용을 확인하고 수정하세요
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  사용처
                </label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E8EB')}
                />
                {merchant && autoCategory && !manualCategory && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    자동 분류:{' '}
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                      style={{ backgroundColor: matchedConfig?.color }}
                    >
                      {autoCategory}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  금액 (원)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  className={`${inputClass} font-bold text-right`}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E8EB')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  날짜
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                  style={{ ...inputStyle, boxSizing: 'border-box', maxWidth: '100%' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E8EB')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  카테고리
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as CategoryKey | '')}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E8EB')}
                >
                  <option value="">자동 분류</option>
                  {categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.key}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  메모 (선택)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E8EB')}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-12 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={!merchant.trim() || !amount || Number(amount) <= 0}
                className="flex-[2] h-12 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{
                  backgroundColor:
                    !merchant.trim() || !amount || Number(amount) <= 0
                      ? '#93c5fd'
                      : 'var(--toss-blue)',
                }}
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
