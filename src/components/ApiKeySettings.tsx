import { useState } from 'react';

interface ApiKeySettingsProps {
  apiKey: string;
  onSave: (key: string) => void;
}

export default function ApiKeySettings({ apiKey, onSave }: ApiKeySettingsProps) {
  const [input, setInput] = useState(apiKey);
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave(input.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputBorder = '#E5E8EB';

  return (
    <div className="bg-white rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          영수증 스캔 설정
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          영수증 스캔 기능을 사용하려면 Google Gemini API 키를 입력하세요.
          키는 이 기기의 브라우저에만 저장되며 외부로 전송되지 않습니다.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Gemini API 키
        </label>
        <div className="flex gap-2">
          <input
            type={visible ? 'text' : 'password'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AIza..."
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2"
            style={{ borderColor: inputBorder }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--toss-blue)')}
            onBlur={(e) => (e.target.style.borderColor = inputBorder)}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="px-3 border rounded-xl text-sm transition-colors"
            style={{ borderColor: inputBorder, color: 'var(--text-tertiary)' }}
          >
            {visible ? '숨김' : '표시'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          API 키는{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--toss-blue)' }}
          >
            aistudio.google.com
          </a>
          {' '}에서 무료로 발급받을 수 있습니다.
        </p>
      </div>

      <button
        onClick={handleSave}
        className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-colors"
        style={{ backgroundColor: saved ? '#22c55e' : 'var(--toss-blue)' }}
      >
        {saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  );
}
